---
name: oafp-java-diagnostics
description: Collect and summarize Java GC, OOM, HPROF, JFR and thread evidence with oafp, including local evidence bundles and container debugging recipes.
---

Read `src/docs/JAVA-DIAGNOSTICS.md` and the Java diagnostics option table in `src/docs/USAGE.md` relative to this repository. Inspect installed OpenAF APIs before capture; checkout capabilities may differ.

Require an explicit target. `self` describes the collector, not the application. Begin with capabilities and lightweight snapshots. Histograms, heap dumps and JFR operations require explicit selection. Target-generated files use the target filesystem. Timeout does not establish cancellation.

Use JSON/NDJSON for evidence, javareport for supplied evidence and javabundle for local export. Preserve timestamps, identity, units, errors and unknown fields. Identify missing historical evidence before proposing an OOM cause. HPROF payload bytes are not retained size; thread samples are not CPU measurements; JFR counts are not allocation weights. Do not claim the Java 8–27 live matrix is validated.

For Kubernetes/gcutils use the guide's namespace/UID/artifact instructions. No automatic cluster mutation, privilege escalation or remote transmission follows from analyzing evidence. Host-to-container translation and explicit nsenter transport require updated OpenAF and live platform verification; inspect the guide before selecting a transport.

For retained-object investigations, build `in=hprof hprofmode=index hprofindex=DIR file=DUMP`, then use `find`, `object`, `refs` and `path` modes. Follow pagination and inspect truncation/unknown-string indicators. A root path establishes reachability, not retained bytes or a dominator. Exclude Reference.referent edges by default. The index contains the original heap's sensitive data and needs substantial disk space; do not put it into a selected-evidence bundle automatically.
