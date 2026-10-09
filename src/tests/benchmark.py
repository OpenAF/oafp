#!/usr/bin/env python3
"""Compare oafp entrypoints without retaining their output in the benchmark process.

Run after building, e.g. python3 src/tests/benchmark.py --baseline /tmp/baseline.js.
RSS is sampled with ps; use --latency-only for startup measurements without sampling.
Fixtures and diagnostics live in an automatically removed temporary directory.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import statistics
import subprocess
import tempfile
import threading
import sys
import time


def measure(command, stdin, rows, sample_rss, slow):
    with tempfile.TemporaryFile() as errors:
        start = time.monotonic()
        with open(stdin, "rb") if stdin else open(os.devnull, "rb") as input_file:
            proc = subprocess.Popen(command, stdin=input_file, stdout=subprocess.PIPE, stderr=errors, start_new_session=True)
            state = {"first": None, "sha256": hashlib.sha256(), "bytes": 0}

            def consume():
                chunk = proc.stdout.read(1)
                if chunk:
                    state["first"] = time.monotonic() - start
                while chunk:
                    state["sha256"].update(chunk)
                    state["bytes"] += len(chunk)
                    if slow:
                        time.sleep(slow)
                    chunk = proc.stdout.read(65536)
                proc.stdout.close()

            reader = threading.Thread(target=consume)
            reader.start()
            peak = 0
            try:
                while proc.poll() is None:
                    if sample_rss:
                        try:
                            result = subprocess.run(["ps", "-axo", "pgid=,rss="], capture_output=True, text=True)
                            # Launchers often fork Java: measure the entire owned process group.
                            rss = sum(int(fields[1]) for line in result.stdout.splitlines()
                                      if len(fields := line.split()) == 2 and int(fields[0]) == proc.pid)
                            peak = max(peak, rss)
                        except OSError:
                            sample_rss = False
                            print("RSS sampling unavailable in this environment", file=sys.stderr)
                    if time.monotonic() - start > 180:
                        os.killpg(proc.pid, signal.SIGKILL)
                        reader.join()
                        raise TimeoutError("Benchmark exceeded 180 seconds")
                    time.sleep(0.01 if not sample_rss else 0.05)
            except BaseException:
                if proc.poll() is None:
                    os.killpg(proc.pid, signal.SIGKILL)
                    proc.wait()
                reader.join()
                raise
            reader.join()
            elapsed = time.monotonic() - start
        errors.seek(0)
        diagnostic = errors.read().decode(errors="replace")
    # Some OpenAF launchers return zero for uncaught script exceptions.
    if proc.returncode or "Error" in diagnostic or "Exception" in diagnostic:
        raise RuntimeError(f"Benchmark failed ({proc.returncode}): {diagnostic[:2000]}")
    return {"seconds": elapsed, "first_output_seconds": state["first"], "peak_rss_kib": peak or None,
            "rows_per_second": rows / elapsed if rows else None, "output_bytes": state["bytes"],
            "sha256": state["sha256"].hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oaf", default=shutil.which("oaf"))
    parser.add_argument("--script", type=Path, default=Path(__file__).resolve().parents[1] / "oafp.js")
    parser.add_argument("--baseline", type=Path)
    parser.add_argument("--rows", type=int, nargs="+", default=[10000, 100000])
    parser.add_argument("--fields", type=int, default=0, help="Additional nested keys per record for CPU-heavy sorting tests")
    parser.add_argument("--repeat", type=int, default=3)
    parser.add_argument("--case", help="Only run cases whose names contain this text")
    parser.add_argument("--latency-only", action="store_true")
    parser.add_argument("--slow-consumer-ms", type=float, default=0)
    args = parser.parse_args()
    if not args.oaf or args.repeat < 1 or args.fields < 0 or any(n < 1 for n in args.rows):
        parser.error("An oaf executable, positive row counts and repeat count are required")
    scripts = [("current", args.script)]
    if args.baseline:
        scripts.insert(0, ("baseline", args.baseline))
    report = []
    with tempfile.TemporaryDirectory(prefix="oafp-benchmark-") as directory:
        root = Path(directory)
        cases = [("tiny-json", "data={} in=json out=json", None, 0),
                 ("tiny-raw", "data=hello in=raw out=raw", None, 0),
                 ("help", "help=usage out=raw", None, 0)]
        if not args.latency_only:
            for count in args.rows:
                ndjson, array, csv, lines = [root / f"{count}.{ext}" for ext in ("ndjson", "json", "csv", "txt")]
                with ndjson.open("w") as nf, array.open("w") as af, csv.open("w") as cf, lines.open("w") as lf:
                    af.write("[")
                    cf.write("id,text\n")
                    for i in range(count):
                        value = {"id": i, "text": "x" * 128}
                        if args.fields:
                            value["values"] = {f"key{k}": i + k for k in reversed(range(args.fields))}
                        record = json.dumps(value, separators=(",", ":"))
                        nf.write(record + "\n")
                        af.write(("," if i else "") + record)
                        cf.write(f"{i}," + "x" * 128 + "\n")
                        lf.write("x" * 128 + "\n")
                    af.write("]")
                for mode in ("false", "auto", "true"):
                    cases.append((f"ndjson-{count}-{mode}", f"file={ndjson} in=ndjson out=json parallel={mode}", None, count))
                    cases.append((f"json-stream-{count}-{mode}", f"file={array} in=json stream=true out=json parallel={mode}", None, count))
                    cases.append((f"sortkeys-{count}-{mode}", f"file={array} in=json sortmapkeys=true out=json parallel={mode}", None, count))
                cases.extend([(f"stdin-{count}", "in=ndjson out=json parallel=false", ndjson, count),
                              (f"json-document-{count}", f"file={array} in=json out=json", None, count),
                              (f"csv-{count}", f"file={csv} in=csv out=json", None, count),
                              (f"lines-{count}", f"file={lines} in=lines out=json", None, count)])
        for case, expression, stdin, count in cases:
            if args.case and args.case not in case:
                continue
            for label, script in scripts:
                if label == "baseline" and case.startswith("json-stream-"):
                    continue  # New mode has intentionally different output semantics.
                runs = [measure([args.oaf, "-f", str(script.resolve()), "-e", expression], stdin, count,
                                bool(count), args.slow_consumer_ms / 1000) for _ in range(args.repeat)]
                result = {"case": case, "entrypoint": label, "median_seconds": statistics.median(r["seconds"] for r in runs), "runs": runs}
                report.append(result)
                print(json.dumps(result), flush=True)
    return report


if __name__ == "__main__":
    main()
