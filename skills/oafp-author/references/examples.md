# Composition patterns

Run from the oafp repository root. The assets contain synthetic data and do not need network access.

The original filter, summary and NDJSON assets below are checked by `testSkillRecipes` in `src/tests/autoTest.js` through the generated CLI. To run the full regression suite after rebuilding, use `cd src && ojob build.yaml op=test`. Installed `oafp` commands below exercise the installed version, which may differ from the checkout.

## Filter, transform, sort, project

[filter-report.yaml](../assets/filter-report.yaml) selects active rows, converts numeric strings, sorts descending with nLinq, and limits the final output:

```sh
oafp -f skills/oafp-author/assets/filter-report.yaml
```

Expected: `[{"name":"beta","score":20},{"name":"alpha","score":10}]`.
Equivalent POSIX shell command:

```sh
oafp 'data={"items":[{"name":"alpha","active":true,"score":"10"},{"name":"beta","active":true,"score":"20"},{"name":"gamma","active":false,"score":"30"}]}' in=json 'path=items[?active == `true`]' correcttypes=true 'from=sort(-score)' 'opath=[:2].{name:name,score:score}' out=json
```

`path` runs before `correcttypes`; a numeric comparison on the string score would need `to_number(score)` there. `opath` sees the converted and sorted rows.

## Two processing stages

[pipe-summary.yaml](../assets/pipe-summary.yaml) formats the first stage as JSON, passes it to the second and sums its numeric fields:

```sh
oafp -f skills/oafp-author/assets/pipe-summary.yaml
```

Expected: `{"total":6,"count":3}`. Put `outfile` on the final stage if writing the result; the parent's `outfile` would bypass its `pipe`.

## Multiple inputs

To collect two independent datasets, use a parameter file with this shape:

```yaml
in: oafp
data:
  - file: current.json
    in: json
  - file: previous.json
    in: json
diff: "(a:'[0]',b:'[1]')"
out: json
```

Children omit `out` so their structured values are captured. This produces an array of child results before the parent `diff`; it is different from a sequential `pipe`. Inspect `inoafpseq` in the input handler if sequencing matters.

## NDJSON records versus collections

```sh
oafp -f skills/oafp-author/assets/ndjson-records.yaml
oafp -f skills/oafp-author/assets/ndjson-joined.yaml
```

[ndjson-records.yaml](../assets/ndjson-records.yaml) transforms each record separately, emitting two NDJSON records: `{"name":"alpha","double":4}` and `{"name":"beta","double":20}`. This handler presents each record as an array, so the expression uses `[].{...}` rather than treating its root as the record map. [ndjson-joined.yaml](../assets/ndjson-joined.yaml) uses `ndjsonjoin:true` so the expression sees the complete array and returns `{"total":12,"names":["alpha","beta"]}`. Joining retains the collection in memory; per-record processing cannot compute a global sort or total using the same expression.

For schema result handling, use the [validation fixtures](../../oafp-json-schema/references/examples.md). For decision envelopes and offline answer extraction, use the [decision fixtures](../../oafp-decide/references/examples.md).

## Adapt repository and sibling examples

Search `src/docs/EXAMPLES.md` for `Docker ps formatting`: it combines `input=ndjson`, `ndjsonjoin=true`, field projection and SQL sorting. Substitute fixture NDJSON for the Docker command to validate locally.

The sibling `../ojob.io/oafp-examples.yaml` stores recipes in `data[]` with `c` (category), `s` (subcategory), `d` (description), and `e` (example). Useful patterns include:

- Grid / Java: `in=oafp` combines hsperf and RSS sources, then `merge=true` feeds a grid.
- Generic / YAML: filters example records for empty metadata fields using `nvl` and `length`.
- Set/diff examples: compare child datasets through `in=oafp` and paths `[0]` / `[1]`.
- DB / H2: demonstrates separate read and write recipes; do not execute these just to validate syntax.

Treat examples as patterns to check against the target runtime, not commands to execute wholesale. Read the `e` value as YAML before adapting its shell quoting; escaped text embedded in another format may have extra quoting layers.

## Commands, URLs, JavaScript and nested pipelines

Use [commands and HTTP](commands-and-http.md) for `cmd`, `out=cmd` and URL request configuration; [JavaScript](javascript.md) for generation, transformation and output; and [parameter files and pipes](files-and-pipes.md) for stage boundaries and file invocation.

| Asset | Expected result | Check |
| --- | --- | --- |
| [command-input.yaml](../assets/command-input.yaml) | `{"total":6}` | Local `printf` stdout |
| [javascript-input.yaml](../assets/javascript-input.yaml) | `{"total":12,"count":3}` | OpenAF code generation and filtering |
| [pipe-code.yaml](../assets/pipe-code.yaml) | `{"names":["alpha","beta"],"total":6}` | Three sequential stages |
| [url-input.yaml](../assets/url-input.yaml) | Array of names from `items` | Requires an endpoint override; optional loopback test |

Run `python3 skills/oafp-author/scripts/check_recipes.py` from the repository root to check the new assets and equivalent CLI forms, parameter overrides, stdin modes, code files and output sinks. Add `--http` to test GET/POST using a temporary loopback server; no external service or credentials are needed. Use `--oafp /absolute/path/to/oafp` to select a different executable. This is a targeted recipe check, independent of the repository build and full suite.
