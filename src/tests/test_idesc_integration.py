#!/usr/bin/env python3
"""Run against a rebuilt OpenAF JAR: python3 test_idesc_integration.py /path/openaf.jar.
Uses generated source and compiled oafp; --large-mb 192 proves traversal with a 96 MiB heap.
"""
import argparse
import gzip
import hashlib
import http.server
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import threading

parser = argparse.ArgumentParser()
parser.add_argument('jar', type=Path)
parser.add_argument('--large-mb', type=int, default=0)
args = parser.parse_args()
jar = args.jar.resolve()
src = Path(__file__).resolve().parents[1]

with tempfile.TemporaryDirectory(prefix='idesc-integration-') as directory:
    root = Path(directory)
    data = {'rows': [{'id': 1}, {'id': 2}, {'id': 3}], 'empty': {}, 'a.b': ['café €']}
    source = root / 'data.json'
    source.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    recipe = root / 'selection.json'
    operations = [{'op': 'select', 'path': ['rows']}, {'op': 'slice', 'start': 1, 'end': 3},
                  {'op': 'path', 'expression': '[].id'}]
    recipe.write_text(json.dumps({'version': 1, 'source': 'stream', 'operations': operations, 'bookmarks': {}}))

    def run(script, options, input_data=None, heap='256m'):
        cmd = ['java', '--enable-native-access=ALL-UNNAMED', '-Xmx' + heap,
               '-Djava.io.tmpdir=' + str(root), '-jar', str(jar), '-f', str(script), '-e', options]
        return subprocess.run(cmd, input=input_data, capture_output=True, timeout=90)

    def selected(script, options, input_data=None):
        result = run(script, options + ' idescrecipe=' + str(recipe) + ' out=json', input_data)
        assert result.returncode == 0, result.stderr.decode(errors='replace')
        assert json.loads(result.stdout) == [2, 3], result.stdout
        assert not list(root.glob('oafp-idesc-*')), 'Session temporary files leaked'
        assert not list(root.glob('oafp-gzip-*')), 'Decompression temporary files leaked'
        return result

    requests = []
    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            requests.append((self.command, self.headers.get('X-IDesc')))
            body = source.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        def do_POST(self):
            self.rfile.read(int(self.headers.get('Content-Length', '0')))
            self.do_GET()
        def log_message(self, *unused):
            pass

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        for script in (src / 'oafp.source.js', src / 'oafp.js'):
            selected(script, 'file=' + str(source))
            selected(script, 'in=json', source.read_bytes())
            zipped = root / 'data.json.gz'
            with gzip.open(zipped, 'wb') as out:
                out.write(source.read_bytes())
            selected(script, 'file=' + str(zipped))
            counter = root / 'count.txt'
            producer = root / 'producer.py'
            producer.write_text('from pathlib import Path\nimport sys\np=Path(' + repr(str(counter)) + ')\n'
                                'p.write_text(p.read_text()+"x" if p.exists() else "x")\n'
                                'sys.stdout.buffer.write(Path(' + repr(str(source)) + ').read_bytes())\n'
                                'sys.stderr.write("source diagnostic\\n")\n')
            counter.unlink(missing_ok=True)
            result = selected(script, 'in=json cmd="' + sys.executable + ' ' + str(producer) + '"')
            assert counter.read_text() == 'x', 'Source command ran more than once'
            assert result.stderr.count(b'source diagnostic') == 1, result.stderr
            url = 'http://127.0.0.1:' + str(server.server_port) + '/data'
            before = len(requests)
            selected(script, 'in=json url=' + url + ' urlparams="(requestHeaders: (X-IDesc: test))"')
            assert requests[before:] == [('GET', 'test')], requests
            selected(script, 'in=json url=' + url + ' urlmethod=post urldata="{}"')
            assert requests[-1][0] == 'POST'
            rejected = run(script, 'file=' + str(source) + ' idescsource=stream path=rows out=json')
            assert rejected.returncode != 0 and not rejected.stdout, rejected
            assert b'cannot use path' in rejected.stderr, rejected.stderr
            loaded = root / 'loaded.json'
            loaded.write_text(json.dumps({'version': 1, 'source': 'loaded', 'operations': operations, 'bookmarks': {}}))
            result = run(script, 'file=' + str(source) + ' idescrecipe=' + str(loaded) + ' out=json')
            assert result.returncode == 0 and json.loads(result.stdout) == [2, 3], result
            same = root / 'replace.json'
            same.write_bytes(source.read_bytes())
            result = run(script, 'file=' + str(same) + ' idescrecipe=' + str(recipe) + ' out=json outfile=' + str(same))
            assert result.returncode == 0 and json.loads(same.read_bytes()) == [2, 3], result
            print(script.name + ': file/stdin/gzip/command/GET/POST/replay/atomic export passed')

        if args.large_mb:
            huge = root / 'huge.json'
            with huge.open('wb') as out:
                out.write(b'{"bulk":"')
                for _ in range(args.large_mb):
                    out.write(b'x' * 1048576)
                out.write(b'","rows":[{"id":1},{"id":2},{"id":3}]}')
            for script in (src / 'oafp.source.js', src / 'oafp.js'):
                result = run(script, 'file=' + str(huge) + ' idescrecipe=' + str(recipe) + ' out=json', heap='96m')
                assert result.returncode == 0 and json.loads(result.stdout) == [2, 3], result
                description = run(script, 'file=' + str(huge) + ' jsondesc=true out=json', heap='96m')
                assert description.returncode == 0, description.stderr
                paths = json.loads(description.stdout)
                assert 'bulk' in paths and 'rows[2].id' in paths, paths
                filtered = run(script, 'file=' + str(huge) + ' jsondesc=true jsonprefix=rows out=json', heap='96m')
                assert filtered.returncode == 0 and json.loads(filtered.stdout) == [p for p in paths if p.startswith('rows')], filtered.stderr
            print(str(args.large_mb) + ' MiB scalar: jsondesc passed with 96 MiB heap')
            root_recipe = root / 'root.json'
            root_recipe.write_text(json.dumps({'version':1,'source':'stream','operations':[],'bookmarks':{}}))
            exported = root / 'exported.json'
            result = run(src / 'oafp.js', 'file=' + str(huge) + ' idescrecipe=' + str(root_recipe)
                         + ' out=json outfile=' + str(exported), heap='96m')
            assert result.returncode == 0, result.stderr
            def digest(path):
                with path.open('rb') as inp:
                    return hashlib.file_digest(inp, 'sha256').hexdigest()
            assert digest(huge) == digest(exported), 'Raw export changed source bytes'
            print(str(args.large_mb) + ' MiB scalar: selection and byte-exact export passed with 96 MiB heap')
    finally:
        server.shutdown()
        server.server_close()
        thread.join()
print('IDesc integration passed')
