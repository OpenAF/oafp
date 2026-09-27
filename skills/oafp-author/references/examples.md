# Composition patterns

Run from the oafp repository root. The assets contain synthetic data and do not need network access.

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

## Adapt repository and sibling examples

Search `src/docs/EXAMPLES.md` for `Docker ps formatting`: it combines `input=ndjson`, `ndjsonjoin=true`, field projection and SQL sorting. Substitute fixture NDJSON for the Docker command to validate locally.

The sibling `../ojob.io/oafp-examples.yaml` stores recipes in `data[]` with `c` (category), `s` (subcategory), `d` (description), and `e` (example). Useful patterns include:

- Grid / Java: `in=oafp` combines hsperf and RSS sources, then `merge=true` feeds a grid.
- Generic / YAML: filters example records for empty metadata fields using `nvl` and `length`.
- Set/diff examples: compare child datasets through `in=oafp` and paths `[0]` / `[1]`.
- DB / H2: demonstrates separate read and write recipes; do not execute these just to validate syntax.

Treat examples as patterns to check against the target runtime, not commands to execute wholesale. Read the `e` value as YAML before adapting its shell quoting; escaped text embedded in another format may have extra quoting layers.
