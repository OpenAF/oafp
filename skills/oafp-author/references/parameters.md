# Discover all applicable parameters

Resolve paths from the oafp repository root. These are live references, not a frozen copy of the option catalog.

| Need | Authoritative local source |
| --- | --- |
| Source selection, aliases, parameter-file loading, runtime flags, library registration | `src/oafp.source.js.hbs` and Main options in `src/docs/USAGE.md` |
| All built-in input types and their options | Input types and Input options in `src/docs/USAGE.md`; `src/include/inputFns.js`, `inputLineFns.js`, `fileExtensions.json`, `fileExtensionsNoMem.json` |
| All transforms, companion parameters and execution order | Optional transforms and Transform options in `src/docs/USAGE.md`; `src/include/transformFns.js` |
| All output formats and options | Output formats and Output options in `src/docs/USAGE.md`; `src/include/outputFns.js`; fallback OpenAF `$output` implementation for formats not handled there |
| Shared CSV/Base64 options, credentials | Input/Output options and sBuckets in `src/docs/USAGE.md`; corresponding handlers |
| Stage order, raw/streaming behavior, piping and output files | `_$f`, `_$o`, `_print` in `src/include/utilFns.js` |
| JMESPath/OpenAF functions, nLinq, SQL | `src/docs/FILTERS.md`; `$path` in `../openaf/js/openaf.js` |
| Handlebars templates and helpers | `src/docs/TEMPLATE.md`; template handler in `src/include/outputFns.js` |
| Searchable generated data | `data/usage.json`, `data/filters.json`, `data/template.json`, `data/completion.yaml` (may lag source; do not edit) |
| Real recipes | `src/docs/EXAMPLES.md`, `src/docs/USAGE.md`, `src/tests/`, `../ojob.io/oafp-examples.yaml` |

Find the relevant section and read its entire option table, including companion options:

```sh
rg -n '^##|^###' src/docs/USAGE.md
rg -n -i 'ndjson|csv|regression|sqlfilter' src/docs/USAGE.md src/include
rg -n 'params\.' src/oafp.source.js.hbs src/include
rg -n -i 'keyword' src/docs/EXAMPLES.md ../ojob.io/oafp-examples.yaml
```

Replace the sample keywords with the task's formats/operations. Dynamic or extension parameters may not appear as `params.name`: inspect the selected registry handler and its library help as well. Documentation catalogs the public surface; a source-only internal `__*` key is not automatically a supported user option.

For runtime inventory, these commands supply explicit input:

```sh
oafp -v out=json
oafp 'data=()' 'in=?' out=json
oafp 'data=()' 'out=?'
oafp 'data=()' transforms=true out=json
oafp help=filters out=raw
```

For an extension, include the intended `libs=Name` during discovery, then read `help=name` and the installed `oafp_Name.js` implementation. Do not guess extension parameters or assume an oPack is installed because it appears in an example. Library inputs/transforms/outputs and OpenAF versions determine what is actually available. If repository or sibling sources are unavailable, use installed help and state any unresolved support rather than claiming completeness from a subset.

Important combinations to inspect:

- NDJSON/NDSLON/lines: join options determine whether a filter sees each record or the whole collection; global sorting/aggregation needs the collection.
- CSV/DSV: delimiters, headers and type conversion affect filter types.
- SQL: `sqlfilter` selects parser behavior; table mappings and SQL quoting must match the selected engine. `isql` sees data before `path`.
- `arraytomap`/`maptoarray`, `flatmap`, `merge`, `set`, `diff`, regression and schema transforms: track the new shape before subsequent filters.
- Charts, grids, templates, Markdown/HTML, XLS, DB, channels and command output: read format-specific parameters and distinguish formatting from side effects.
- `libs`, `chs`, sBuckets, model options and environment settings: retain the user's intended configuration; do not put credentials into examples.
