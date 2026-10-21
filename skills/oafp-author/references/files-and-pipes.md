# Parameter files and sequential pipelines

Use a command line for short recipes; use a YAML file for code, nested stages, repeated use, or expressions with mixed quotes. `-f` accepts a **parameter map** in JSON, SLON or YAML, not a script or an oJob document. Write lowercase canonical `in`/`out` keys, and put the filename immediately after `-f`:

```sh
oafp -f recipe.yaml
oafp paramsfile=recipe.yaml out=json
```

CLI keys already present win over the same file keys. Overrides are not a recursive merge of nested maps: a CLI `pipe=...` replaces the file's pipe. Keep aliases out of overrides because alias normalization can change which value wins. Paths are relative to the launch directory, including `file`, code filenames and `outfile`; they are not relative to the recipe. Supply an invocation with the correct working directory or explicit paths.

## Three meanings of “pipe”

| Syntax | What crosses the boundary |
| --- | --- |
| `producer | oafp in=json ...` in a shell | Producer stdout becomes oafp stdin |
| `path='items | sort_by(@,&score)'` | JMESPath passes an expression result to another expression |
| `pipe: {in: json, ...}` in a recipe | Each parent `_print` value becomes child `data` in a recursive oafp invocation |

For recursive pipes, choose `out=json` on each intermediate structured stage and `in=json` on the next. The child is its own parameter map: repeat required formats, libraries and options rather than assuming parent parameters carry over. Its `data` is overwritten by the upstream output; omit other input sources. The pipe value is a map, not a list or shell command. Nest another `pipe` inside the child for a third stage.

The [pipe-code.yaml asset](../assets/pipe-code.yaml) exercises three stages: parse and convert strings, run JavaScript over the resulting array, then select a report. Run it from the repository root:

```sh
oafp -f skills/oafp-author/assets/pipe-code.yaml
```

Expected: `{"names":["alpha","beta"],"total":6}`. Key order in YAML does not order transforms. Use separate stages when the desired operation order differs from the transform registry order.

## Streaming and sinks

A pipe is invoked for **each emitted value**, not necessarily once per source. For NDJSON/lines, a child cannot aggregate all records if the parent emits one at a time. Join in the parent (`ndjsonjoin=true`, or the appropriate input's join option) before aggregation. Do not assume parent `out=ndjson` followed by child `ndjsonjoin=true` collects earlier emissions.

Place `outfile` on the final stage: parent `outfile` bypasses its `pipe`. Native sinks such as `out=cmd` and `out=oaf` print directly instead of going through `_print`; do not depend on their stdout entering a nested `pipe` or `outfile`. Use a shell pipe/redirection when you actually need to capture process stdout. `in=oafp` is for captured child results, not serial stage chaining; see [examples](examples.md).

## Quoting and stdin

Keep expressions as YAML strings and code as literal blocks (`|`). For example ``path: 'items[?active == `true`]'`` contains literal JMESPath backticks, without shell escaping. YAML does not expand `$HOME`, `$(...)`, or JavaScript `${...}`. Use OpenAF `getEnv()` in code when environment lookup is intended.

A quoted here-document avoids accidental shell expansion and is useful when a separate file is unnecessary:

```sh
oafp -f - <<'YAML'
in: oaf
data: |
  data = { values: [1, 2, 3] }
path: '{total:sum(values)}'
out: json
YAML
```

This consumes stdin for the **parameters**. Use `data`, `file`, `cmd` or `url` for the recipe's input. To read data from stdin instead, keep the parameters in a separate file: `producer | oafp -f recipe.yaml` with no input-source key in that recipe.

When a recipe hangs, first check whether the selected input expects stdin. When a child sees text or missing fields, inspect the parent's actual serialized output and the child's `in`, then verify the root shape. Unknown options can be ignored; successful exit alone does not prove the requested option ran.
