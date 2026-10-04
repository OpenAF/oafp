---
name: openaf-path
description: Construct and debug OpenAF $path expressions and oafp path/opath filters, including requests for ipath, using JMESPath plus OpenAF custom functions. Use for projections, predicates, aggregation, nested data and correct CLI/YAML quoting.
---

# Build OpenAF $path expressions

Locate the oafp checkout and its sibling OpenAF source. Read `src/docs/FILTERS.md` for the function and query catalog, then inspect the relevant `$path` custom function's `_signature` and `_func` in `../openaf/js/openaf.js`. Use the implementation when examples and signatures disagree. These paths are relative to the oafp root, not the current working directory of a copied skill.

If either checkout is unavailable, use `oafp help=filters out=raw` and small pure fixtures against the installed runtime. Treat custom-function availability and signatures as unverified until checked there; do not require a sibling checkout or infer support from another version's examples.

## Establish the input and stage

Get a representative input and intended output shape. Identify whether the root is a map, array or scalar, which fields may be absent/null, and whether numeric values are strings. In oafp, structured data flows through `ifrom` → `isql` → `path` → transforms → `from` → `sql` → `opath`; inspect `src/include/utilFns.js` for raw-string or streaming exceptions.

`path=` runs before transforms; `opath=` runs after transforms and output nLinq/SQL filters. There is no `ipath=` option in the inspected oafp source. If asked for it, explain that `path=` is the supported pre-transform filter. If selection must precede `ifrom`/`isql`, introduce a preceding pipeline stage. Verify another target version before claiming it supports `ipath`.

The expression function `opath('expression')` queries the original object of the current `$path` call; it is not the oafp `opath=` processing stage. `path(object, 'expression')` queries an explicitly supplied object. Neither implies access to the original CLI input after earlier stages have replaced it.

## Construct and check

1. Select the collection or field, then add predicates, projections, ordering and aggregation incrementally. Use `@` for the current node and `|` to apply the next operation to a completed result.
2. Read [syntax and function pitfalls](references/expressions.md) for literal types, projection behavior, OpenAF extensions, root context and quoting. Search the full function catalog for the required operation; do not restrict the solution to this reference's examples.
3. Check each selected function's exact argument count/types, including JSON booleans/null and expression references (`&field`). Do not treat JavaScript syntax, JSONPath syntax or `$from` nLinq as interchangeable with JMESPath.
4. Test on a local fixture using `$path` or `oafp ... out=json`. Assert the actual expected values and shape, and add an empty/missing-field example when it affects the result. Then verify the final CLI quoting or YAML parameter-file invocation. An empty result alone does not establish that the intended filter worked.
5. Return the complete expression in the requested form (`$path(data, expression)`, CLI argument, or YAML scalar), expected output, and relevant type/stage assumptions. State if only source inspection was possible.

Prefer pure functions for fixture validation. OpenAF functions such as `sh*`, `ojob`, `oafp`, `oafpd`, `ch`, `chq`, assignments and counters can execute work or change state. Do not run external operations merely to validate a query. `PATH_SAFE` restricts some functions; it is not a blanket guarantee of purity.

For full command/YAML composition, use [oafp-author](../oafp-author/SKILL.md), or inspect the same source documentation directly if that companion is unavailable.
