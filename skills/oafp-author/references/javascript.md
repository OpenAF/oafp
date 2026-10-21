# OpenAF JavaScript in recipes

These are OpenAF/Rhino function bodies, not Node.js programs. Use OpenAF globals (`io`, `af`, `ow`, `$from`, `$path`, `getEnv`) and explicitly load wrappers as required, such as `ow.loadFormat()`. Do not assume `require`, `process.env`, `fetch`, ES modules, or top-level await are available.

| Mode | Code receives | How to produce the result |
| --- | --- | --- |
| `in=oaf` with `data` or `file` | Local `var data`, initially undefined | Assign `data`; the wrapper returns it |
| Transform `oaf` | Current structured value as argument `data` | Mutate or replace `data`; the wrapper returns it |
| `out=oaf` with `outoaf` | Final filtered value as argument `data` | Explicitly write/print; return value is ignored |

All three support code strings or the file-reading behavior in their handlers. Prefer `file=producer.js in=oaf` for an input code file, `oaf=transform.js` for a transform file, and `outoaf=sink.js` for a sink file. Relative code paths use the process working directory. With `in=oaf`, `data=producer.js` also treats an existing path as a code file. Avoid coincidental filenames when intending literal code.

## Generate data

```sh
oafp in=oaf 'data=data = { values: [1, 2, 3] }' 'path={total:sum(values)}' out=json
oafp -f skills/oafp-author/assets/javascript-input.yaml
```

The two `data` tokens in the command have different roles: the first names the CLI option, the second assigns the JavaScript result. The command returns `{"total":6}`. Printing JSON from input code is not a replacement for assigning `data`: it emits unrelated stdout before normal processing. Avoid declaring `let data` or `const data` in the generated function because the wrapper declares `var data`.

## Transform data

```yaml
in: json
data:
  - {name: alpha, score: 2}
  - {name: beta, score: 4}
oaf: |
  data = data.map(function(row) {
    return { name: row.name, doubled: row.score * 2 }
  })
opath: '{total:sum([].doubled)}'
out: json
```

Expected: `{"total":12}`. `path` selects before the transform; `opath` sees its result. Other transforms run in registry order, not the location of `oaf` in YAML. Use a `pipe` stage to enforce a different ordering. For record inputs, check the handler's per-record shape rather than assuming `data` is the entire dataset.

## Custom output

```sh
oafp 'data={"value":6}' in=json out=oaf 'outoaf=print(stringify({ result: data.value }, __, ""))'
```

Expected stdout: `{"result":6}`. `out=oaf` does not automatically serialize the return value or forward it through recursive `pipe`/`outfile`. Use an `oaf` transform followed by `out=json` when normal formatting, piping or file output is needed.

Keep diagnostics on stderr (`printErr`). Code has access to OpenAF APIs and can perform external actions; fixture verification should use deterministic values. Use the user's actual required APIs in the delivered recipe, and separately identify untested database/network/provider behavior. `loop` repeats code and any side effects; omit it for one-shot jobs and bounded fixture checks.
