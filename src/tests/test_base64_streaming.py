#!/usr/bin/env python3
"""Offline Base64 transport regressions; pass --large for bounded-memory checks.

python3 test_base64_streaming.py --jar /path/to/openaf.jar [--large]
"""
import argparse
import base64
import gzip
import hashlib
import http.server
import json
import os
import pathlib
import pty
import re
import shutil
import subprocess
import tempfile
import threading


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--jar', required=True)
    parser.add_argument('--large', action='store_true')
    parser.add_argument('--script', action='append', help='Test a specific generated entrypoint')
    args = parser.parse_args()
    jar = str(pathlib.Path(args.jar).resolve())
    scripts = [pathlib.Path(__file__).resolve().parents[1] / name
               for name in ('oafp.source.js', 'oafp.js')]
    if args.script:
        scripts = [pathlib.Path(path).resolve() for path in args.script]
    with tempfile.TemporaryDirectory(prefix='oafp-base64-') as temporary:
        root = pathlib.Path(temporary)
        responses = {'/plain': b'hello world\n', '/json': b'{"x":1}', '/number': b' 123 ', '/null': b'null', '/latin1': b'caf\xe9', '/bom': b'\xef\xbb\xbfhello',
                     '/encoded': base64.b64encode('hello €'.encode())}

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                if self.path == '/large':
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/plain')
                    self.end_headers()
                    try:
                        with (root / 'large').open('rb') as source:
                            shutil.copyfileobj(source, self.wfile, 65536)
                    except (BrokenPipeError, ConnectionResetError):
                        pass
                    return
                payload = responses.get(self.path, b'')
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; charset=ISO-8859-1' if self.path == '/latin1' else 'application/json' if self.path == '/json' else 'text/plain; charset=UTF-8')
                self.end_headers()
                try:
                    self.wfile.write(payload)
                except (BrokenPipeError, ConnectionResetError):
                    pass

            do_POST = do_GET
            do_PUT = do_GET
            do_DELETE = do_GET

            def log_message(self, *_):
                pass

        server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f'http://127.0.0.1:{server.server_port}'

        runners = {}
        for script in scripts:
            runner = root / (script.name + '.runner.js')
            runner.write_text('__flags.OAFP = {libs:[]};\ntry { af.load(' + json.dumps(str(script)) + '); } catch(e) { printErr(e); exit(1); }\n')
            runners[script] = runner

        def run(script, expression, stdin=None, heap='256m', codeset=None):
            result = subprocess.run(['java', '--enable-native-access=ALL-UNNAMED', f'-Xmx{heap}',
                                     '-Djava.awt.headless=true', '-jar', jar, '-f', str(runners[script]), '-e', expression],
                                    input=stdin, capture_output=True, timeout=180, env=dict(os.environ, OAF_HOME=str(root), OAFP_CODESET=codeset or 'UTF-8'))
            assert result.returncode == 0, result.stderr.decode(errors='replace')
            return result.stdout

        try:
            for script in scripts:
                caller = root / 'caller-options.js'
                fixture = root / 'caller.b64'
                caller.write_text('__flags.OAFP={libs:[]}; try { (function() { var processExpr=function(){return undefined;}; '
                                  + 'var entry=eval(io.readFileString(' + json.dumps(str(script)) + ')+"\\n;oafp"); '
                                  + 'var options={}; var params={url:' + json.dumps(url + '/plain') + ',urlparams:options,in:"raw",out:"base64",outfile:'
                                  + json.dumps(str(fixture)) + ',noexit:true,__inception:true,parallel:false}; '
                                  + 'entry(params); entry(params); if(Object.keys(options).length) throw "Caller HTTP options mutated"; })(); '
                                  + '} catch(e) { printErr(e); exit(1); }')
                checked = subprocess.run(['java', '--enable-native-access=ALL-UNNAMED', '-Djava.awt.headless=true',
                                          '-jar', jar, '-f', str(caller)], capture_output=True, timeout=30,
                                         env=dict(os.environ, OAF_HOME=str(root)))
                assert checked.returncode == 0 and not checked.stdout, (checked.stdout, checked.stderr)
                assert base64.b64decode(fixture.read_bytes()) == b'hello world\n'
                for index, payload in enumerate([b'', b'a', b'a\r\nb\r\n\r\n', b'a\n\n', b'a\rb\r',
                                                  'hello € 世界\n'.encode(), b'\xff\xfehi']):
                    file = root / str(index)
                    file.write_bytes(payload)
                    text = payload.decode('utf-8', errors='replace').encode()
                    assert run(script, f'file={file} in=raw out=base64') == base64.b64encode(text) + b'\n'
                    encoded = run(script, f'file={file} in=raw out=base64 base64gzip=true')
                    assert gzip.decompress(base64.b64decode(encoded)) == text
                    lines = re.split(r'\r\n|\r|\n', payload.decode('utf-8', errors='replace'))
                    if payload.endswith((b'\r', b'\n')):
                        lines.pop()
                    normalized = '\n'.join(lines).encode()
                    assert run(script, 'in=raw out=base64', payload) == base64.b64encode(normalized) + b'\n'
                producer = root / 'producer'
                producer.write_text("#!/bin/sh\nprintf 'hello world\\n'\nprintf 'diagnostic\\n' >&2\n")
                producer.chmod(0o755)
                expected = base64.b64encode(b'hello world\n') + b'\n'
                assert run(script, f'cmd={producer} in=raw out=base64') == expected
                noisy = root / 'noisy-producer'
                noisy.write_text("#!/usr/bin/env python3\nimport sys\nsys.stdout.write('a'*65536);sys.stdout.flush()\nsys.stderr.write(('diagnostic'*100+'\\n')*1024);sys.stderr.flush()\nsys.stdout.write('tail');sys.stdout.flush()\n")
                noisy.chmod(0o755)
                tty_output = root / 'tty.b64'
                master, slave = pty.openpty()
                drained = [0]
                def drain():
                    try:
                        while chunk := os.read(master, 65536):
                            drained[0] += len(chunk)
                    except OSError:
                        pass
                stderr_thread = threading.Thread(target=drain, daemon=True)
                stderr_thread.start()
                try:
                    result = subprocess.run(['java', '--enable-native-access=ALL-UNNAMED', '-Djava.awt.headless=true',
                                             '-jar', jar, '-f', str(runners[script]), '-e',
                                             f'cmd={noisy} in=raw out=base64 outfile={tty_output}'],
                                            stdout=subprocess.PIPE, stderr=slave, timeout=30,
                                            env=dict(os.environ, OAF_HOME=str(root), TERM='xterm-256color'))
                    assert result.returncode == 0 and not result.stdout, result.stdout
                    assert base64.b64decode(tty_output.read_bytes()) == b'a'*65536 + b'tail'
                    assert drained[0] > 65536, 'The fixture must drain more than one stderr pipe buffer'
                finally:
                    os.close(slave)
                    stderr_thread.join(5)
                    os.close(master)

                assert run(script, f'url={url}/plain in=raw out=base64') == expected
                for method in ('GET', 'POST', 'PUT', 'DELETE'):
                    assert run(script, f'url={url}/encoded urlmethod={method} in=base64 out=raw') == 'hello €\n'.encode()
                assert run(script, f'url={url}/json in=raw out=base64') == base64.b64encode(b'{"x":1}') + b'\n'
                assert run(script, f'url={url}/number in=raw out=base64') == base64.b64encode(b'123') + b'\n'
                assert run(script, f'url={url}/null in=raw out=base64') == b''
                assert run(script, f'url={url}/latin1 in=raw out=base64') == base64.b64encode('café'.encode()) + b'\n'
                assert run(script, f'url={url}/bom in=raw out=base64') == base64.b64encode(b'hello') + b'\n'
                alias = root / 'alias'
                alias.write_bytes(b'hello world')
                assert run(script, f'file={alias} in=raw out=base64 outfile={alias}') == b''
                assert alias.read_bytes() == base64.b64encode(b'hello world')
                encoded = root / 'b64'
                encoded.write_bytes(base64.b64encode(b'hello world'))
                assert run(script, f'file={encoded} in=base64 out=raw') == b'hello world\n'
                encoded.write_bytes(base64.b64encode(b'hello world').decode().encode('cp037'))
                assert run(script, f'file={encoded} in=base64 out=raw', codeset='IBM037') == b'hello world\n'
                encoded.write_bytes(base64.b64encode(gzip.compress(b'hello world', mtime=0)))
                assert run(script, f'file={encoded} in=gb64json out=raw') == b'hello world\n'
                print(script.name + ': file/stdin/command/HTTP and GZIP parity passed', flush=True)

                if args.large:
                    large = root / 'large'
                    block = b'abcd' * 16384
                    digest = hashlib.sha256()
                    with large.open('wb') as output:
                        for _ in range(3072):  # 192 MiB, greater than the 128 MiB heap.
                            output.write(block)
                            digest.update(block)
                    destination = root / 'large.b64'
                    producer.write_text(f'#!/bin/sh\ncat {large}\n')
                    # Test file, stdin and command transports without retaining the payload.
                    for transport in (f'file={large}', f'cmd={producer}', f'url={url}/large', ''):
                        command = ['java', '--enable-native-access=ALL-UNNAMED', '-Xmx128m', '-Djava.awt.headless=true',
                                   '-jar', jar, '-f', str(runners[script]), '-e',
                                   f'{transport} in=raw out=base64 base64gzip=true outfile={destination}'.strip()]
                        destination.unlink(missing_ok=True)
                        with large.open('rb') as source:
                            result = subprocess.run(command, stdin=source, capture_output=True, timeout=180, env=dict(os.environ, OAF_HOME=str(root)))
                        assert result.returncode == 0 and not result.stdout and destination.exists(), (result.stdout, result.stderr)
                        # A streaming Base64 decoder feeds gzip; no full encoded/decoded payload arrays.
                        compressed = root / 'large.gz'
                        with destination.open('rb') as encoded_stream, compressed.open('wb') as output:
                            while chunk := encoded_stream.read(65536):
                                output.write(base64.b64decode(chunk))
                        actual = hashlib.sha256()
                        with gzip.open(compressed, 'rb') as decoded:
                            while chunk := decoded.read(65536):
                                actual.update(chunk)
                        assert actual.digest() == digest.digest()
                        print(script.name + ': 192 MiB / 128 MiB heap: ' + (transport or 'stdin') + ' passed', flush=True)
                    destination.unlink(missing_ok=True)
                    assert run(script, f'file={large} in=raw out=base64 outfile={destination}', heap='128m') == b''
                    actual = hashlib.sha256()
                    with destination.open('rb') as encoded_stream:
                        while chunk := encoded_stream.read(65536):
                            actual.update(base64.b64decode(chunk))
                    assert actual.digest() == digest.digest()
                    print(script.name + ': plain Base64, 192 MiB / 128 MiB heap passed', flush=True)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    main()
