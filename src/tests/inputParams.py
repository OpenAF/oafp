"""Run request-source CLI smoke tests against source and compiled builds."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
launcher = os.environ.get("OAF", "/Applications/OpenAF/oaf")
with tempfile.TemporaryDirectory() as directory:
    Path(directory, "marker").touch()
    request = json.dumps({"data": directory, "lsrecursive": False})
    request_file = Path(directory, "request.json")
    request_file.write_text(request)
    cases = [
        ("stdin", "in=ls inparams=true out=json", request),
        ("inline", 'in=ls inparams=true out=json data="(data: ' + directory + ', lsrecursive: false)"', None),
        ("file", "in=ls inparams=true out=json file=" + str(request_file), None),
        ("cmd", 'in=ls inparams=true out=json cmd="cat ' + str(request_file) + '"', None),
        ("legacy", "in=ls out=json data=" + directory, None),
    ]
    for artifact in ["src/oafp.source.js", "src/oafp.js"]:
        for name, expression, payload in cases:
            result = subprocess.run([launcher, "-f", str(root / artifact), "-e", expression],
                                    input=payload, text=True, capture_output=True, timeout=30, cwd=directory)
            rows = json.loads(result.stdout)
            assert any(row["filename"] == "marker" for row in rows), (artifact, name, result.stderr)
            print(artifact + " " + name + ": passed")
