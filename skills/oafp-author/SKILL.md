---
name: oafp-author
description: Build, explain, and troubleshoot oafp command lines and YAML parameter files, combining inputs, filters, transforms, outputs, pipes, and extension parameters. Use for OpenAF processor recipes and conversions between CLI and YAML.
---

# Author oafp recipes

Produce the requested executable command or YAML parameter map, with its invocation and expected result shape. Use the user's input schema and destination; ask for a representative record only when the expression cannot be determined without it.

## Find the actual capabilities

Locate the oafp checkout (this skill lives at `skills/oafp-author/`); all repository paths below are relative to that root. Read [the parameter discovery guide](references/parameters.md) for the source map covering every parameter family, extension discovery, and examples. Search the complete sources for the requested features instead of treating the examples here as a fixed parameter whitelist.

Use `src/docs/USAGE.md` for option names, values, defaults and companion options; `src/docs/FILTERS.md` for queries; and the relevant `src/include/*Fns.js` handler to resolve ambiguities. Check the installed runtime separately when executing: it may differ from this checkout. Do not copy suspected documentation mistakes into a recipe.

For stateless decision requests, consult [oafp-decide](../oafp-decide/SKILL.md); for validation, inference or sample generation, consult [oafp-json-schema](../oafp-json-schema/SKILL.md). If those companions are unavailable, use the corresponding documentation listed in the discovery guide.

## Compose the stages

1. Choose one input source: stdin, `file`, `data`, `cmd`, or `url`; specify `in` when detection is ambiguous. Distinguish a data YAML file (`oafp file=data.yaml in=yaml`) from a parameter YAML file (`oafp -f recipe.yaml`). The latter is a top-level parameter map, not an oJob `todo/jobs` document.
2. Track the data shape through `ifrom` → `isql` → `path` → transforms → `from` → `sql` → `opath` → formatting. This is the structured-data route in `src/include/utilFns.js`. Raw strings and streaming input have different routes; inspect the handler if relevant.
3. Select transforms and their companion options. Transforms run in registry order in `src/include/transformFns.js`, not CLI argument or YAML key order. If two operations require a different order, use explicit stages.
4. Choose an output suited to the next consumer. Use `out=json` for a machine-readable intermediate stage; do not feed a colored tree/table into a JSON parser. `pipe` passes formatted output via another oafp parameter map; `outfile` bypasses that pipe path. Use `in=oafp` to collect results from multiple parameter maps; omit child `out` when their results should be captured. See the examples reference for both patterns.
5. Build `$path` expressions against the shape at that stage. The companion [openaf-path skill](../openaf-path/SKILL.md) covers expression construction. No `ipath` parameter is implemented in this checkout: use `path` for selection before transforms, or a preceding stage if selection must happen before `ifrom`/`isql`. Recheck support if targeting another version; never silently emit an ignored parameter.

## Serialize without changing meaning

- Prefer canonical lowercase `in` and `out`; avoid mixing aliases (`input/type`, `output/format`) in overrides.
- `oafp -f recipe.yaml` and `oafp paramsfile=recipe.yaml` load parameter maps. Existing CLI keys take precedence over the same keys from the file. `oafp -f -` consumes stdin for the parameters, so give the recipe another input source.
- Use native YAML maps/lists for `data` and `pipe`. For options documented and parsed as JSON/SLON **strings** (such as `csv`, `diff`, `set`, or `sqlfiltertables`), preserve that string representation unless the handler explicitly accepts native objects.
- Use YAML `>-` for long expressions and `|` for literal input/code. YAML does not expand shell variables; an environment variable reference inside a YAML scalar is not shell interpolation.
- Quote whole shell arguments containing whitespace, `|`, `&`, `>`, `$`, backticks or glob characters. POSIX single quotes preserve backticks but cannot contain a raw apostrophe; use a YAML file for quote-heavy expressions or correctly escape double-quoted shell arguments. Never add shell escaping to a YAML expression.
- Include only parameters that contribute to the request. Explain mutually exclusive sources, dependencies, and version requirements when they affect this recipe. Capability breadth does not mean enabling every parameter together.

## Verify and deliver

Start from [tested composition patterns](references/examples.md) or the runnable YAML assets linked there. Use small local fixtures and `out=json` to verify values, types, empty/missing fields, and the final shape. Test the actual shell quoting or `-f` invocation, not only the underlying expression. Set explicit data for capability probes so they do not wait on stdin.

Creating a recipe does not require executing its database writes, shell commands, network requests, model calls, loops, or channel operations. Verify the pure data path with fixtures and state which external behavior remains untested. Supply the finished artifact, its launch command, relevant prerequisites and a concise explanation of stage placement.
