---
name: oafp-json-schema
description: Author and debug oafp JSON Schema validation, schema inference and sample-generation recipes. Use for schema options, draft compatibility, validation errors and automation that must reject invalid data.
---

# Work with JSON Schema

Identify the requested operation before composing the recipe:

| Operation | oafp option | Result |
| --- | --- | --- |
| Validate a data map | `jsonschema=schema.json` or `jsonschemacmd=...` | `{valid, errors}` |
| Infer a schema from a data map | `jsonschemagen=true` | Inferred draft-07 schema |
| Generate sample data from a schema | `in=jsonschema` | Best-effort sample data |

Locate the checkout and read `src/docs/JSON-SCHEMA.md`; resolve validation behavior in `src/include/transformFns.js`, and sample generation in `src/include/inputFns.js`. Without the checkout, use `oafp help=jsonschema out=raw`. Check runtime support rather than assuming the installed OpenAF matches repository documentation.

## Choose validation behavior

Use one schema source. Prefer a local file for reproducible checks; `jsonschemacmd` executes a command and is appropriate when the user actually needs a dynamically produced schema. Validation replaces the input with its result, so subsequent filters see `valid` and `errors`, not the original data. Pre-transform `path` must select a map suitable for validation.

`jsonschemaoptions` accepts a JSON/SLON string or native parameter-map object and merges over `{allErrors:true}`. Defaults do not insert defaults or coerce types. Enable mutation options such as `useDefaults` and `coerceTypes` only when that behavior is intended; they can change the validated input even though output remains the validation result.

The updated OpenAF Ajv engine selects draft-07, 2019-09 or 2020-12 from root `$schema`; omission selects draft-07. Older runtimes may support only older drafts. Unsupported dialects and unresolved references are errors; oafp does not automatically fetch remote schemas. In a long-running OpenAF process, the first schema-engine initialization determines options: use fresh CLI processes when verifying different configurations.

## Interpret and deliver

Invalid data produces ordinary `{valid:false, errors:[...]}` output, not a nonzero status by itself. Automation must check both successful command execution and `valid === true`. Invalid schemas, options or unresolved references are command errors. Keep machine-readable JSON separate from display formatting until the gate has evaluated it.

Ajv 8 errors use JSON Pointer `instancePath`; older runtimes can use `dataPath`. Prefer the keyword and field path to exact message wording. See [fixtures and an exit-status gate](references/examples.md) for valid/invalid recipes and a fail-closed shell example.

Inference from one example does not establish the intended full schema. Sample generation does not guarantee constraint satisfaction, especially for newer drafts. Validate generated samples explicitly when correctness matters. Return the schema/recipe, launch command, expected valid and invalid behavior, and any runtime compatibility limitation.
