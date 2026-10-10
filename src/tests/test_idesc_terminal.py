#!/usr/bin/env python3
"""POSIX controlling-terminal regression: python3 test_idesc_terminal.py /path/openaf.jar [--script oafp.source.js].
Checks piped input, redirected stdout, the full-screen tree browser (and the numbered TERM=dumb fallback),
alternate-screen exit and terminal restoration.
"""
import argparse
import json
import os
from pathlib import Path
import pty
import select
import shlex
import signal
import struct
import tempfile
import termios
import time
import fcntl

parser = argparse.ArgumentParser()
parser.add_argument('jar', type=Path)
parser.add_argument('--script', type=Path, default=Path(__file__).resolve().parents[1] / 'oafp.source.js')
args = parser.parse_args()
script = args.script.resolve()

with tempfile.TemporaryDirectory(prefix='idesc-terminal-') as directory:
    root = Path(directory)
    source = root / 'input.json'
    source.write_text('{"rows":[{"id":1},{"id":2}]}')

    def session(mode, cancel=False, width=120, numbered=False, scan_cancel=False):
        output, before, after = [root / (mode + str(cancel) + str(width) + str(numbered) + str(scan_cancel) + suffix) for suffix in ('.json', '.before', '.after')]
        command = ['java', '--enable-native-access=ALL-UNNAMED', '-jar', str(args.jar.resolve()),
                   '-f', str(script), '-e', 'in=json out=idesc idescsource=' + mode + (' idescpage=20000' if scan_cancel else '')]
        shell = ('stty -g > ' + shlex.quote(str(before)) + '; cat ' + shlex.quote(str(source)) +
                 ' | ' + shlex.join(command) + ' > ' + shlex.quote(str(output)) +
                 '; result=$?; stty -g > ' + shlex.quote(str(after)) + '; exit "$result"')
        pid, fd = pty.fork()
        if pid == 0:
            os.environ['TERM'] = 'dumb' if numbered else 'xterm-256color'
            fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack('HHHH', 35, width, 0, 0))
            os.execl('/bin/sh', 'sh', '-c', shell)
        received = bytearray()
        cursor = 0
        finished = False
        try:
            def expect(marker):
                deadline = time.monotonic() + 30
                while marker not in received[cursor:]:
                    assert time.monotonic() < deadline, 'Timed out waiting for ' + repr(marker) + ': ' + received[-1000:].decode(errors='replace')
                    if select.select([fd], [], [], .1)[0]:
                        block = os.read(fd, 65536)
                        assert block, 'Terminal closed early: ' + received.decode(errors='replace')
                        received.extend(block)
                return received.index(marker, cursor) + len(marker)

            tree = not numbered
            if scan_cancel:
                cursor = expect(b'Scanning:')
                os.write(fd, b'\x03')
                cursor = expect(b'Scan cancelled.')
            if not (scan_cancel and tree):
                cursor = expect(b'Explore' if numbered else b'rows')
            if scan_cancel and tree:
                os.write(fd, b'q')
            elif cancel:
                os.write(fd, b'\x03')
            elif tree:
                # Tree browser: zoom into rows, preview, query the zoomed node, export to stdout.
                os.write(fd, b'\x1b[B')                       # down arrow -> rows
                os.write(fd, b'\r')                           # Enter zooms in
                cursor = expect(b'id')                        # rows is an array of flat maps: shown as a table
                os.write(fd, b'p')                            # preview overlay
                cursor = expect(b'Preview')
                os.write(fd, b'q')                            # close the overlay
                os.write(fd, b':path [].id\r')                # query the zoomed node
                cursor = expect(b'derived')
                os.write(fd, b':export json -\r')             # leave the alternate screen, write selection to stdout
            else:
                os.write(fd, b'7\n')                           # "rows" (after the six root commands)
                cursor = expect(b'Explore')
                os.write(fd, b'2\n')                           # 1 is the parent entry inside rows
                cursor = expect(b'Preview format')
                os.write(fd, b'4\n')
                cursor = expect(b'Explore')
                assert b'Bounded preview' in received
                os.write(fd, b'3\n')                           # Query
                cursor = expect(b'Query engine')
                os.write(fd, b'1\n')
                cursor = expect(b'Expression (relative to selection):')
                os.write(fd, b'[].id\n')
                cursor = expect(b'Explore')
                os.write(fd, b'3\n')
                cursor = expect(b'Data format')
                os.write(fd, b'1\n')
                cursor = expect(b'Destination')
                os.write(fd, b'2\n')
            deadline = time.monotonic() + 30
            while time.monotonic() < deadline:
                done, status = os.waitpid(pid, os.WNOHANG)
                if done:
                    finished = True
                    while select.select([fd], [], [], 0)[0]:
                        try:
                            block = os.read(fd, 65536)
                            if not block: break
                            received.extend(block)
                        except OSError: break
                    assert os.waitstatus_to_exitcode(status) in ((0, 130) if cancel or scan_cancel else (0,)), received.decode(errors='replace')
                    break
                if select.select([fd], [], [], .1)[0]:
                    try: received.extend(os.read(fd, 65536))
                    except OSError: pass
            assert finished, 'Session did not exit'
            def stable_settings(path):
                settings = path.read_text().strip()
                if settings.startswith('gfmt1:'):
                    # macOS sets transient PENDIN when returning to canonical input.
                    fields = dict(part.split('=', 1) for part in settings.split(':')[1:])
                    fields['lflag'] = format(int(fields['lflag'], 16) & ~termios.PENDIN, 'x')
                    return fields
                return settings
            assert stable_settings(before) == stable_settings(after), 'Terminal settings were not restored: ' + repr((stable_settings(before), stable_settings(after)))
            if tree:
                assert b'\x1b[?1049h' in received and b'\x1b[?1049l' in received, 'Alternate screen was not entered and left'
                assert received.rindex(b'\x1b[?1049l') > received.rindex(b'\x1b[?1049h'), 'Alternate screen left open'
            if cancel or scan_cancel: assert output.read_bytes() == b'', output.read_bytes()
            else:
                assert json.loads(output.read_bytes()) == [1, 2], output.read_bytes()
                if numbered: assert '📍'.encode() in received and b'derived' in received
                else: assert b'derived' in received
            print(mode + (' numbered' if numbered else ' width=' + str(width)) + (' cancellation' if cancel or scan_cancel else ' navigation/preview/query/export') + ' passed')
        finally:
            if not finished:
                done, _ = os.waitpid(pid, os.WNOHANG)
                if not done:
                    os.kill(pid, signal.SIGKILL)
                    os.waitpid(pid, 0)
            os.close(fd)

    for mode in ('loaded', 'stream'):
        session(mode)
        session(mode, cancel=True)
        session(mode, width=40)
        session(mode, numbered=True)

    source.write_text(json.dumps(list(range(50000))))
    session('stream', cancel=True, scan_cancel=True)
