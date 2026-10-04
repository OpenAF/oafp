# Expression construction reference

## Types and projection semantics

| Task | Expression |
| --- | --- |
| Identity | `@` |
| Key containing punctuation | `"build.version"` |
| Slice/reverse array | `items[:5]`, `items[-1]`, `items[::-1]` |
| Flatten one list level | `items[]` |
| Select active rows | ``items[?active == `true`]`` |
| Compare numeric strings | ``items[?to_number(score) >= `10`]`` |
| Rename and compute | ``items[].{name:name,kib:div(bytes,`1024`)}`` |
| Sort by numeric field | `sort_by(items, &score)` |
| Get one result after projection | `items[].name | [0]` |
| Count or total | `length(items)`, `sum(items[].score)` |
| Default missing/null value | `nvl(label, 'unknown')` |

Bare identifiers select fields. Single-quoted literals are strings; backticks enclose JSON literals (numbers, booleans, null, arrays, objects, or JSON strings). For example, ``add(`1`, `2`)`` has numeric arguments; `add(1, 2)` is not the correct literal form. `&score` is an expression reference used by functions such as `sort_by`, not a quoted string.

`items[].optional` drops null projection results. Use `map(&optional, items)` when positions/nulls must be retained, or project an object `items[].{value:optional}` to retain each row. `[]` flattens one level; `[*]` projects without that flattening. `items[].name | [0]` selects from the complete names array; attaching `[0]` inside a projection changes the context.

JMESPath filters use `==`, `!=`, `<`, `<=`, `>`, `>=`, `&&`, `||`, and `!`. A missing value and a string containing digits are not automatically a numeric zero. Choose conversion/default behavior deliberately and test null input against each function signature.

## OpenAF extensions and exact signatures

Find functions in the full `src/docs/FILTERS.md` table and verify their entries in `$path` in `../openaf/js/openaf.js`. It loads `jmespath_js`, merges `__flags.PATH_CFN` and per-call custom functions, and then evaluates the query. The installed runtime may be older or have custom overrides.

Useful groups to search:

- Arithmetic and defaults: `add`, `sub`, `mul`, `div`, `mod`, `nvl`, `if`.
- Strings and formats: `concat`, `split`, `split_re`, `replace`, `match`, `trim`, `lower_case`, `upper_case`, `format`.
- Data conversion: `from_json`, `from_yaml`, `from_slon`, `to_json`, `to_yaml`, `to_csv`, `to_toon`, byte/time/date converters.
- Collections: `group`, `group_by`, `count_by`, `unique`, `to_map`, `a2m`, `a4m`, `m2a`, `m4a`, `k2a`, `ranges`.
- Context: `path`, `opath`, `get`, `set`, `setp`, `geta`.

Examples where shorthand documentation can mislead:

- `to_json(value, '')` takes a spacing string; `to_yaml(value, \`false\`)` takes a boolean second argument.
- `at(array, index)` takes two arguments; use `at(items, \`0\`)` or simply `items[0]`.
- `match(value, pattern, flags)` requires the flags string, even when empty.
- `set(obj, name)` stores the whole supplied object under that name; `setp(obj, objectPath, name)` stores a selected value and returns `obj`.
- `get`/`geta` use a truthy fallback to the original object in the inspected implementation. Do not rely on them to retrieve saved `false`, zero, or empty strings without testing.
- Date/byte conversions have strict type signatures; `correcttypes=true` cannot repair a value before `path=` because it runs later.

For a root `{ "region":"eu", "items":[{"name":"alpha"}] }`, this expression reads the parent context while projecting items:

```text
items[].{name:name,region:opath('region')}
```

Expected: `[{"name":"alpha","region":"eu"}]`. By contrast, in a later `opath=` stage whose input is already the items array, `opath('region')` has no access to that discarded envelope.

## Quoting at the delivery boundary

POSIX shell: quote the entire parameter. Backticks inside single quotes remain literal:

```sh
oafp 'data={"items":[{"score":"10"},{"score":"2"}]}' in=json 'path=items[?to_number(score) >= `10`]' out=json
```

Expected: `[{"score":"10"}]`.

For expressions containing string literals, YAML avoids shell apostrophe juggling:

```yaml
data:
  items:
    - {name: alpha, label: null, bytes: 2048}
in: json
path: >-
  items[].{name:name,label:nvl(label, 'unknown'),kib:div(bytes,`1024`)}
out: json
```

Run with `oafp -f recipe.yaml`; expected: `[{"name":"alpha","label":"unknown","kib":2}]`. No backslashes are needed before the backticks in YAML. YAML double-quoted strings, JavaScript string literals and shell double quotes each have different escaping rules; do not copy escapes across them.

In a JavaScript file (run with `oaf -f check.js`), the same query is:

```javascript
var data = { items: [{ name: "alpha", label: null, bytes: 2048 }] }
var result = $path(data, "items[].{name:name,label:nvl(label, 'unknown'),kib:div(bytes,`1024`)}")
print(stringify(result))
```

`src/docs/EXAMPLES.md` and `../ojob.io/oafp-examples.yaml` contain additional real queries. Inspect parsed example text and verify signatures before reusing it: an example embedded in YAML, shell and a nested SLON string can contain several escape layers.

## Runnable edge cases

Run [edge-cases.yaml](../assets/edge-cases.yaml) from the repository root:

```sh
oafp -f skills/openaf-path/assets/edge-cases.yaml
```

Expected output:

```json
{"projected":[],"retained":[null,null],"rows":[{"name":"alpha","region":"eu","enabled":false,"count":0},{"name":"beta","region":"eu","enabled":null,"count":null}],"sorted":["beta","alpha"],"emptyCount":0,"emptySum":0}
```

This checks omitted/null projection values, preservation through `map`, false/zero fields, numeric-string sorting, empty collections and parent context. Missing and explicit-null fields both evaluate to null in these expressions; do not claim the query distinguishes their presence. The regression suite also overrides the input with an empty collection and selects `items` in a preceding stage to check that a later `opath('region')` cannot recover the discarded root.
