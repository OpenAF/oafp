# Requests and offline results

Run commands from the oafp repository root. [request.yaml](../assets/request.yaml) is a decision request, not an oafp parameter file:

```sh
oafp in=llmdecide file=skills/oafp-decide/assets/request.yaml out=json
```

This invocation performs inference and needs the user's configured model. The asset selects structured strategy and uses synthetic ticket data; edit the state, criteria and strategy for the task. To start with provider-specific defaults without inference:

```sh
oafp in=llmdecide llmdecidesample=gemini out=yaml
oafp in=llmdecide llmdecidesample=ollama out=yaml
```

The following are ordinary JSON-input parameter files containing synthetic decision responses. Neither invokes a model:

```sh
oafp -f skills/oafp-decide/assets/filter-result.yaml
oafp -f skills/oafp-decide/assets/filter-stats.yaml
```

Both return the JSON string `"billing"`. The first selects `answers.route.value`; the second selects `response.answers.route.value`. Their data is deliberately minimal for extraction and is not a complete provider response contract.

When adapting to live inference, pass the request as `file=...`, use `in=llmdecide`, and preserve the matching result path. Set `llmdecidestats=true` for the wrapped path. Do not submit these response fixtures as requests.
