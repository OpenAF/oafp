---
name: oafp-decide
description: Author and troubleshoot oafp stateless decision requests with in=llmdecide, including provider samples, named questions, images, stats and answer extraction. Use for classification, routing and ordinal scoring over a supplied state.
---

# Author stateless decisions

Deliver a request file, its oafp invocation and the expected answer shape. Distinguish a decision request (`state`, `questions`, optional `options`, loaded with `file=`) from an oafp parameter map (loaded with `-f`). An array state is evaluated as a whole; it does not imply one call per record.

Locate the oafp checkout. Read the LLM Decide section of `src/docs/USAGE.md` and the relevant Gemini/Ollama examples in `src/docs/EXAMPLES.md`; resolve behavior in `src/include/inputFns.js`. If source is unavailable, use `oafp help=usage out=raw` and `oafp help=examples out=raw`. Check the installed OpenAF decision API separately; updating oafp alone does not supply it.

## Compose the request

- Use named `choice`, `boolean` or `score` questions with instructions. Choice criteria are a map of named alternatives; score criteria are an ordered array with zero-based levels. Preserve the user's intended ordering and meaning.
- Begin with `oafp in=llmdecide llmdecidesample=gemini out=yaml` or the `ollama` sample. These emit editable request envelopes without credentials or inference. See [examples and fixtures](references/examples.md) for a reusable request and offline result filtering.
- Keep provider configuration in `llmoptions` or the selected environment variable, separate from request `options`. Explicit `llmoptions` wins. With the default environment name, lookup is `OAFP_MODEL`, then `OAF_DECIDE_MODEL`, then `OAF_MODEL` when absent; an explicit custom `llmenv` selects that variable.
- Select native versus structured strategy using the target runtime/provider contract. Do not promise probabilities merely because an answer exists: structured probability fields are null, and selected-alternative probability, provider confidence and ordinal expectation have different meanings. Use `requireProbabilities` only when required by the task and supported by the chosen strategy.
- For images, consult current provider requirements. `llmimage` names one local file; `options.images` holds an ordered array of raw base64 strings, not paths, URLs or data URLs. They cannot be combined. All questions share the images and state remains required.

OpenAF validates the question and option contracts. Unknown request envelope fields fail. `llmconversation`, `llmcontext` and `llmprompt` are unsupported for this input. Failures propagate without automatic retry or fallback; do not add either unless requested.

## Extract and verify

Normal results expose `answers`; `llmdecidestats=true` wraps the result in `{response, stats}`. For example, select `path=answers.route.value`, or `path=response.answers.route.value` with stats. Stats come from one `decideWithStats()` execution, not a second inference. Apply ordinary recipe stages using the authoring skill if available.

Validate sample generation and extraction with synthetic data first. A stub can check forwarding and output shape but cannot establish provider support or model quality. Run inference only when it is part of the user's task, with their intended configuration; report separately which behavior was verified locally and against a provider.
