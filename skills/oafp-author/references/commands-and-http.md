# Commands and HTTP inputs

Choose the direction first: `cmd` supplies input, `out=cmd` consumes results. There is no general `run=` option. Check `src/include/streamFns.js`, the `cmd` output handler, and the URL dispatch in `src/oafp.source.js.hbs` when targeting different versions.

## Read a command's stdout

```sh
oafp 'cmd=printf [1,2,3]' in=json 'path={total:sum(@)}' out=json
```

Expected: `{"total":6}`. The [command-input.yaml asset](../assets/command-input.yaml) uses an object input to show how YAML avoids nested CLI quoting. Prefer a file for commands containing embedded JSON strings. Set `in` to the producer's format; for newline-delimited JSON use `in=ndjson ndjsonjoin=true` when the next stage needs the entire collection. Use machine-readable producer flags such as `--json` rather than parsing presentation tables.

Do not assume the command runner expands shell operators, variables, globs or builtins. For shell composition, prefer a visible shell pipeline (`producer | oafp ...`) or explicitly invoke the required shell in `cmd`, with quoting appropriate to that shell. POSIX examples require compatible programs on PATH. Input command stderr is separate from data in the current stream helper. A valid stdout result is not proof the child exited successfully: that helper does not enforce its exit status. For strict failure gates, run the producer in a shell wrapper that checks status before processing, or use OpenAF `$sh(...).get(0)` and explicitly check `exitcode`.

## Send data to a command

```yaml
in: json
data: [{name: alpha}, {name: beta}]
out: cmd
outcmd: cat
outcmdjoin: true
```

This calls `cat` once with the JSON array on stdin. Without `outcmdjoin`, an array invokes one command per entry, in parallel by default; `outcmdseq=true` makes those calls sequential. Strings are passed as strings, other values are JSON-serialized. `outcmdnl=true` prints each nonempty command output with a newline; it does not change the input payload.

Prefer stdin for arbitrary data. `outcmdparam=true` substitutes `{}` directly into command text; `outcmdtmpl=true` renders command text as Handlebars against the entry. Neither is automatic shell escaping. Use them only when command construction is intended and values are controlled or correctly escaped. The output handler prints stdout/stderr directly and does not turn a child nonzero status into an oafp failure. Do not build a strict automation gate on this sink's exit status alone.

## URL input

```sh
oafp 'url=https://example.org/items.json' in=json 'path=items[].name' out=json
```

Adapt the endpoint and response shape before use. A reusable GET recipe is [url-input.yaml](../assets/url-input.yaml); `example.org` is illustrative, not a tested service. For a JSON request body:

```yaml
url: https://example.org/search
urlmethod: POST
urlparams:
  requestHeaders:
    Accept: application/json
    Content-Type: application/json
  connectionTimeout: 10000
urldata:
  query: alpha
in: json
path: items[].name
out: json
```

`urlparams` configures OpenAF `$rest` (for example `requestHeaders`, `connectionTimeout` in milliseconds); it is not a generic query-string map. Put query parameters in the URL with proper encoding. `urldata` is the body, not input `data`. Native maps work for these options in parameter files; CLI forms need JSON/SLON strings. Do not combine `data` or another input source with `url` when intending a request.

The normal buffered URL dispatch explicitly handles GET/default, POST, PUT, DELETE and HEAD. Do not emit `urlmethod=PATCH` as if supported: an unrecognized method falls through to GET in this source. For another method, use a verified OpenAF HTTP API in `in=oaf` or an explicit HTTP client command. Streaming handlers can differ, so check their method behavior before adapting a recipe. HEAD has no ordinary JSON response body to filter.

Keep TLS verification enabled. Reference the user's credential mechanism rather than embedding tokens. YAML does not expand environment placeholders inside headers; for dynamic credentials, use the existing sBucket mechanism or explicit OpenAF code reading the intended environment variable. Validate parsing with a response fixture first. The optional loopback check in `scripts/check_recipes.py --http` verifies GET/POST dispatch, headers and request bodies against a temporary local server; it proves no external endpoint or authentication behavior.
