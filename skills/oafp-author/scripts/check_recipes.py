#!/usr/bin/env python3
"""Exercise authoring examples through a selected oafp CLI; no third-party modules."""
import argparse
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import tempfile
import threading


@contextmanager
def fixture_server():
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_GET(self):
            self.reply({"items": [{"name": "alpha"}, {"name": "beta"}]})

        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            self.reply({"body": body, "accept": self.headers.get("Accept")})

        def reply(self, value):
            payload = json.dumps(value).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield "http://127.0.0.1:%d/fixture" % server.server_port
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oafp", default="oafp", help="oafp executable (default: PATH)")
    parser.add_argument("--http", action="store_true", help="also test GET/POST on a temporary loopback server")
    args = parser.parse_args()
    skill = Path(__file__).resolve().parents[1]
    count = 0

    def check(label, options, expected, stdin=None):
        nonlocal count
        result = subprocess.run([args.oafp, *options], input=stdin, text=True,
                                capture_output=True, timeout=60, check=False)
        if result.returncode:
            raise AssertionError(f"{label}: exit {result.returncode}\n{result.stderr}")
        try:
            actual = json.loads(result.stdout)
        except ValueError as error:
            raise AssertionError(f"{label}: invalid JSON: {result.stdout!r}\n{result.stderr}") from error
        if actual != expected:
            raise AssertionError(f"{label}: expected {expected!r}, got {actual!r}")
        count += 1
        print(f"PASS {label}", flush=True)

    def asset(name):
        return ["-f", str(skill / "assets" / name)]

    check("command input file", asset("command-input.yaml"), {"total": 6})
    check("command input argv", ["cmd=printf [1,2,3]", "in=json",
                                 "path={total:sum(@)}", "out=json"], {"total": 6})
    check("JavaScript input file", asset("javascript-input.yaml"), {"total": 12, "count": 3})
    check("JavaScript input argv", ["in=oaf", "data=data = { values: [1,2,3] }",
                                   "path={total:sum(values)}", "out=json"], {"total": 6})
    check("nested code pipeline", asset("pipe-code.yaml"), {"names": ["alpha", "beta"], "total": 6})
    check("empty pipeline", asset("pipe-code.yaml") + ["data=[]"], {"names": [], "total": 0})
    check("CLI overrides file", asset("javascript-input.yaml") + ["path=length(@)"], 3)
    check("parameters from stdin", ["-f", "-"], {"total": 6},
          "in: oaf\ndata: |\n  data = { values: [1,2,3] }\npath: '{total:sum(values)}'\nout: json\n")
    check("command output whole array", ["in=json", 'data=[{"name":"alpha"},{"name":"beta"}]',
                                         "out=cmd", "outcmd=cat", "outcmdjoin=true"],
          [{"name": "alpha"}, {"name": "beta"}])
    check("JavaScript output", ["in=json", 'data={"value":6}', "out=oaf",
                                'outoaf=print(stringify({ result: data.value }, __, ""))'], {"result": 6})
    with tempfile.TemporaryDirectory(prefix="oafp-skill-") as directory:
        folder = Path(directory)
        producer = folder / "producer.js"
        producer.write_text("data = { value: 6 }\n")
        transform = folder / "transform.js"
        transform.write_text("data = { result: data.value * 2 }\n")
        check("JavaScript files", [f"file={producer}", "in=oaf", f"oaf={transform}", "out=json"], {"result": 12})
        recipe = folder / "stdin.yaml"
        recipe.write_text("in: json\npath: '{total:sum(values)}'\nout: json\n")
        check("data from stdin", ["-f", str(recipe)], {"total": 6}, '{"values":[1,2,3]}')
    if args.http:
        with fixture_server() as url:
            check("HTTP GET asset", asset("url-input.yaml") + [f"url={url}"], ["alpha", "beta"])
            request = {"url": url, "urlmethod": "POST", "urlparams": {
                "requestHeaders": {"Accept": "application/json", "Content-Type": "application/json"}},
                "urldata": {"query": "alpha"}, "in": "json", "out": "json"}
            check("HTTP POST native maps", ["-f", "-"],
                  {"body": {"query": "alpha"}, "accept": "application/json"}, json.dumps(request))
    print(f"{count} checks passed against {args.oafp}; external services not tested.")


if __name__ == "__main__":
    main()
