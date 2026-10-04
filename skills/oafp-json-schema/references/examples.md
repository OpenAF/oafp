# Validation fixtures

Run from the oafp repository root:

```sh
oafp -f skills/oafp-json-schema/assets/validate.yaml
oafp -f skills/oafp-json-schema/assets/invalid.yaml
```

Both use [schema.json](../assets/schema.json). The valid recipe returns `{"valid":true,"errors":null}`. The invalid recipe uses a string for the integer `age`: it returns `valid:false` with a `type` error. Both commands complete successfully; invalid data is not a command error. Error paths depend on the installed Ajv version.

These parameter files use a repository-relative schema path. Adjust `jsonschema` when moving them or override it on the command line. Native YAML `jsonschemaoptions` maps are supported; `allErrors:false` stops after the first validation error.

## Turn validation into an exit-status gate

This POSIX shell script uses Python 3 to check one JSON result. It returns nonzero if the command fails, output is malformed, or the validation result is not explicitly true. Save it as a script and pass a schema file followed by a data file:

```sh
#!/bin/sh
set -eu
result_file=$(mktemp)
trap 'rm -f "$result_file"' EXIT
oafp in=json "jsonschema=$1" "file=$2" out=json > "$result_file"
python3 - "$result_file" <<'PY'
import json
import sys
with open(sys.argv[1]) as stream:
    result = json.load(stream)
sys.exit(0 if isinstance(result, dict) and result.get("valid") is True else 1)
PY
```

For another automation environment, use its JSON parser and the same explicit boolean check. Merely checking the oafp exit code misses invalid data; searching output for the word `true` can accept an unrelated value.

## Inference and sample generation

```sh
oafp in=json file=example.json jsonschemagen=true out=json
oafp in=jsonschema file=schema.json out=json
```

The second command generates sample data; it does not validate the schema's instances. Save its output and validate it separately against the intended schema. Validation options do not configure sample generation.
