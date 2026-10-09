#!/usr/bin/env python3
"""PTY regressions for the stderr activity indicator (macOS/Linux). Build first."""
import argparse
import os
from pathlib import Path
import pty
import shutil
import signal
import time
import subprocess
import termios


def run(oaf, script, expression, terminal=True):
    master, slave = pty.openpty()
    before = termios.tcgetattr(slave)
    try:
        result = subprocess.run([oaf, "-f", str(script), "-e", expression], stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=slave if terminal else subprocess.PIPE,
                                env={**os.environ, "TERM": "xterm-256color"}, timeout=20)
        after = termios.tcgetattr(slave)
        os.set_blocking(master, False)
        error = bytearray()
        while terminal:
            try:
                error.extend(os.read(master, 4096))
            except BlockingIOError:
                break
        return result, bytes(error) if terminal else result.stderr, before == after
    finally:
        os.close(master)
        os.close(slave)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oaf", default=shutil.which("oaf"))
    parser.add_argument("--script", type=Path, default=Path(__file__).resolve().parents[1] / "oafp.source.js")
    args = parser.parse_args()
    plain = "data={} in=json out=json"
    slow = plain + ' xfn="(sleep(700),args)"'
    for expression, terminal, animate in [(plain, True, False), (slow, True, True),
                                         (slow + " progress=off", True, False), (slow, False, False),
                                         (slow + " __inception=true", True, False)]:
        result, error, restored = run(args.oaf, args.script, expression, terminal)
        assert result.returncode == 0 and result.stdout == b"{}\n", (expression, result.stdout, error)
        assert (b"Processing data" in error) == animate, (expression, error)
        if animate:
            assert error.endswith(b"\r\x1b[2K"), error
        else:
            assert error == b"", (expression, error)
        assert restored, "Terminal settings changed"
    failure = plain + ' xfn="(sleep(700),(function(){throw \'indicator-failure\'})())"'
    result, error, restored = run(args.oaf, args.script, failure)
    assert b"Processing data" in error and b"indicator-failure" in error + result.stdout, (error, result.stdout)
    assert error.endswith(b"\r\x1b[2K") and restored, error
    master, slave = pty.openpty()
    before = termios.tcgetattr(slave)
    process = None
    try:
        process = subprocess.Popen([args.oaf, "-f", str(args.script), "-e", plain + ' xfn="(sleep(10000),args)"'],
                                   stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=slave,
                                   env={**os.environ,"TERM":"xterm-256color"}, start_new_session=True)
        os.set_blocking(master,False)
        seen = bytearray()
        deadline = time.monotonic() + 10
        while b"Processing data" not in seen and time.monotonic() < deadline:
            try: seen.extend(os.read(master,4096))
            except BlockingIOError: time.sleep(0.05)
        assert b"Processing data" in seen, "Indicator did not start before interruption"
        os.killpg(process.pid,signal.SIGINT)
        process.communicate(timeout=5)
        assert termios.tcgetattr(slave) == before, "Interruption changed terminal settings"
    finally:
        if process and process.poll() is None:
            os.killpg(process.pid,signal.SIGKILL)
            process.communicate()
        os.close(master)
        os.close(slave)
    print("PTY and redirected progress tests passed")


if __name__ == "__main__":
    main()
