// Java evidence helpers share invocation-local state with loop and pipe handlers.
var _javaPrevious = Object.create(null)
var _javaOptions = () => {
    var o = isMap(params.javaoptions) ? params.javaoptions : (isString(params.javaoptions) ? _fromJSSLON(params.javaoptions) : {})
    return Object.assign({isolated:true}, o)
}
var _javaAPI = name => {
    ow.loadJava()
    if (!isFunction(ow.java[name])) throw new Error(name + " requires an updated OpenAF runtime")
    return ow.java[name].bind(ow.java)
}
var _javaTarget = () => {
    var target = params.javapid
    if (target !== "self" && !/^[1-9][0-9]*$/.test(String(target))) throw new Error("javapid must be self or a positive PID")
    return target
}
var _javaCommand = command => {
    if (!isString(command) || !command.trim() || /[\r\n\x00]/.test(command)) throw new Error("Expected one diagnostic command string")
    return _javaAPI("jcmd")(_javaTarget(), command, _javaOptions())
}
var _javaCollect = () => {
    var op = params.javadiagop || "snapshot", o = _javaOptions()
    if (op === "bundle") {
        var root = String(params.javabundledir || ""), manifest = io.readFileJSON(root + "/manifest.json")
        if (manifest.schemaVersion !== 1) throw new Error("Unsupported Java bundle version")
        if (!isArray(manifest.files) || manifest.files.length !== 3 || manifest.files.map(f => f.name).sort().join(",") !== "evidence.json,report.json,report.md") throw new Error("Invalid bundle manifest")
        manifest.files.forEach(f => {
            if (["evidence.json", "report.json", "report.md"].indexOf(f.name) < 0) throw new Error("Unexpected bundle path")
            if (sha256(io.readFileBytes(root + "/" + f.name)) !== f.sha256) throw new Error("Bundle checksum mismatch: " + f.name)
        })
        return io.readFileJSON(root + "/evidence.json")
    }
    var target = _javaTarget(), start = now(), data
    switch(op) {
    case "capabilities": data = _javaAPI("diagnosticCapabilities")(target, o); break
    case "snapshot": data = _javaAPI("collectOOM")(target, o); break
    case "histogram": data = _javaAPI("classHistogram")(target, o); break
    case "threads": data = _javaAPI("threadDump")(target, o); break
    case "nmt": data = _javaAPI("nativeMemory")(target, o); break
    case "heapdump": data = _javaAPI("heapDump")(target, params.javafile, o); break
    case "jfr":
        if (!/^JFR\.(start|stop|dump|check)( |$)/.test(String(params.jcmdcommand))) throw new Error("jfr requires an explicit JFR command")
        data = _javaCommand(params.jcmdcommand); break
    default: throw new Error("Unsupported javadiagop: " + op)
    }
    return { schemaVersion: 1, kind: op, target: String(target), timestamp: new Date().toISOString(), durationMs: now() - start,
        helperJava: String(java.lang.System.getProperty("java.version")), source: "ow.java", data: data }
}
var _javaStacks = text => {
    if (isString(text) && /^\s*\{/.test(text)) {
        try { text = jsonParse(text) } catch(e) { throw new Error("Invalid JSON thread dump: " + e) }
    }
    if (isMap(text)) return { format: "json", dump: text, coverage: "Source JSON preserved; JSON stack grouping unavailable" }
    var threads = [], current
    String(text).split(/\r?\n/).forEach(line => {
        var m = line.match(/^"([^"\n]+)"(.*)$/)
        if (m) { current = { name: m[1], header: m[2], frames: [], locks: [] }; threads.push(current) }
        else if (current) {
            var state = line.match(/java.lang.Thread.State:\s*(\S+)/)
            if (state) current.state = state[1]
            else if (/^\s+at /.test(line)) current.frames.push(line.trim())
            else if (/^\s+- /.test(line)) current.locks.push(line.trim())
        }
    })
    return { threads: threads, coverage: "Text platform-thread dump; virtual-thread coverage depends on source" }
}
var _javaOOM = text => {
    var lines = String(text).split(/\r?\n/), matches = []
    lines.forEach((line, i) => {
        if (/OutOfMemoryError|oom-kill|OOMKilled|Cannot allocate memory|unable to create native thread|fatal error.*Java Runtime/i.test(line))
            matches.push({ line: i + 1, message: line.substring(0, 2048), context: lines.slice(Math.max(0, i - 2), i + 3).map(s => s.substring(0, 2048)) })
    })
    return { kind: "oom", matches: matches.slice(0, 100), totalMatches: matches.length, truncated: matches.length > 100,
        limitations: ["Messages classify symptoms; correlate timestamps with process and container evidence"] }
}
var _javaReport = evidence => {
    var rows = isArray(evidence) ? evidence : [evidence], limit = Number(params.javatop || 50)
    if (!isFinite(limit) || limit < 1 || limit > 10000) throw new Error("javatop must be between 1 and 10000")
    var r = { schemaVersion: 1, kind: params.javareportkind || "all", generatedAt: new Date().toISOString(), observations: [], gaps: [], evidence: [] }
    var pauses = [], jfrCounts = Object.create(null), profiles = Object.create(null)
    rows.forEach((row, i) => {
        var d = row && isDef(row.data) ? row.data : row, ref = "evidence/" + i
        r.evidence.push({ ref: ref, timestamp: row && row.timestamp, source: row && row.source, target: row && row.target })
        if (!d) { r.gaps.push({ ref: ref, reason: "Empty evidence" }); return }
        if (d.errors) d.errors.forEach(e => r.gaps.push({ ref: ref, reason: e }))
        var graph = (typeof d.found === "boolean" && isArray(d.path)) || isArray(d.references) ||
            (isArray(d.objects) && isDef(d.scanned)) || (d.id && d.type) ||
            (d.complete === true && isDef(d.references) && isDef(d.roots))
        if (graph) r.observations.push({ ref: ref, type: "heapGraph", data: d, meaning: "Object/reference evidence; no retained-size or dominator calculation" })
        if (d.histogram) r.observations.push({ ref: ref, type: "histogram", classes: d.histogram.slice(0, limit), sizeMeaning: d.payloadBytes ? "serialized payload" : "source-defined bytes; never retained size" })
        if (d.matches) r.observations.push({ ref: ref, type: "oomMessages", matches: d.matches.slice(0, limit) })
        if (d.sections) r.observations.push({ ref: ref, type: "snapshot", sections: d.sections })
        if (d.format === "json") r.gaps.push({ref:ref, reason:d.coverage})
        if (d.threads) {
            var groups = Object.create(null)
            d.threads.forEach(t => { var key = (t.frames || []).join("\n"); if (!groups[key]) groups[key] = { frames: t.frames, count: 0 }; groups[key].count++ })
            r.observations.push({ ref: ref, type: "stacks", groups: Object.keys(groups).map(k => groups[k]).sort((a,b) => b.count-a.count).slice(0,limit) })
        }
        if (isDef(d.durationSecs)) pauses.push({ref:ref, seconds:Number(d.durationSecs), gcType:d.gcType, before:d.heapBeforeGC, after:d.heapAfterGC})
        if (d.name && d.fields) {
            jfrCounts[d.name] = (jfrCounts[d.name] || 0) + 1
            var category = /ExecutionSample|NativeMethodSample/.test(d.name) ? "executionSamples" : /ObjectAllocation/.test(d.name) ? "allocationEvents" : /Monitor|Park/.test(d.name) ? "blockingEvents" : /FileRead|FileWrite|SocketRead|SocketWrite/.test(d.name) ? "ioEvents" : __
            if (isDef(category)) {
                var frames = ((d.fields.stackTrace || {}).frames || []).slice(0, 32)
                var signature = category + ":" + stringify(frames)
                if (!profiles[signature] && Object.keys(profiles).length < 10000) profiles[signature] = {category:category, frames:frames, count:0, observedBytes:"0", durationSeconds:0, evidenceRef:ref}
                if (profiles[signature]) {
                    var group = profiles[signature]
                    group.count++
                    var bytes = d.fields.allocationSize || d.fields.objectSize
                    if (/^[0-9]+$/.test(String(bytes))) group.observedBytes = String(new java.math.BigInteger(group.observedBytes).add(new java.math.BigInteger(String(bytes))))
                    try { group.durationSeconds += Number(java.time.Duration.parse(String(d.duration)).toNanos()) / 1e9 } catch(ignore) {}
                }
            }
        }
        if (!graph && !d.sections && !d.histogram && !d.matches && !d.threads && !(d.name && d.fields) && !isDef(d.durationSecs))
            r.gaps.push({ ref: ref, reason: "No supported summary for this evidence shape; preserve source for analysis" })
    })
    if (pauses.length) {
        var durations = pauses.map(p => p.seconds).filter(isFinite).sort((a,b) => a-b)
        r.observations.push({type:"gcEvents", count:pauses.length, totalEventSeconds:durations.reduce((a,b) => a+b,0),
            p50Seconds:durations[Math.floor((durations.length-1)*0.5)], p95Seconds:durations[Math.floor((durations.length-1)*0.95)],
            maxSeconds:durations[durations.length-1], events:pauses.slice(0,limit), note:"Event durations may include concurrent phases; not application pause percentage"})
    }
    if (Object.keys(profiles).length) r.observations.push({type:"profileGroups", groups:Object.keys(profiles).map(k => profiles[k]).sort((a,b) => b.count-a.count).slice(0,limit), note:"Observed event weights only; allocation samples are not total allocation and stack samples are not CPU time. Group inventory capped at 10000."})
    if (Object.keys(jfrCounts).length) r.observations.push({type:"jfrEventCounts", counts:jfrCounts, note:"Counts are event counts, not CPU time or allocated bytes"})
    r.limitations = ["A snapshot cannot establish a historical OOM cause", "Histogram payload sizes are not retained heap", "Thread samples are not measured CPU time", "Missing evidence is not zero activity"]
    return r
}
var _javaMarkdown = r => "# Java diagnostics: " + r.kind + "\n\n" +
    "Generated: " + r.generatedAt + "\n\n## Observations\n\n```json\n" + stringify(r.observations, __, "  ") +
    "\n```\n\n## Coverage gaps\n\n```json\n" + stringify(r.gaps, __, "  ") + "\n```\n\n" + r.limitations.map(s => "- " + s).join("\n")
var _javaSelected = value => {
    if (isArray(value)) return value.slice(0, 1000).map(_javaSelected)
    if (isMap(value)) {
        var out = Object.create(null)
        Object.keys(value).forEach(k => {
            if (/password|secret|token|credential|environment|properties|raw|context|values/i.test(k)) return
            out[k] = _javaSelected(value[k])
        })
        return out
    }
    if (isString(value)) return value.substring(0, 8192).replace(/(password|token|secret|authorization)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    return value
}
var _javaBundle = evidence => {
    var dir = params.javabundledir
    if (!isString(dir) || !dir.length) throw new Error("javabundledir is required")
    if (io.fileExists(dir)) throw new Error("Bundle destination already exists")
    var selected = _javaSelected(evidence), report = _javaReport(selected)
    io.mkdir(dir)
    io.writeFileJSON(dir + "/evidence.json", selected)
    io.writeFileJSON(dir + "/report.json", report)
    io.writeFileString(dir + "/report.md", _javaMarkdown(report))
    var files = ["evidence.json", "report.json", "report.md"].map(name => ({ name: name, sha256: sha256(io.readFileBytes(dir + "/" + name)) }))
    var manifest = { schemaVersion: 1, createdAt: new Date().toISOString(), files: files,
        exclusions: ["Sensitive-key fields, raw text, heap values and binary artifacts excluded", "Lists limited to 1000 entries; text limited to 8192 characters", "Review before transfer; filtering cannot guarantee removal of secrets"] }
    io.writeFileJSON(dir + "/manifest.json", manifest)
    return manifest
}
var _counterDelta = row => {
    var o = isMap(params.counterdelta) ? params.counterdelta : _fromJSSLON(params.counterdelta)
    if (!isMap(o) || !isArray(o.counters)) throw new Error("counterdelta requires identity, timestamp and counters paths")
    var read = p => String(p).split(".").reduce((v,k) => isDef(v) ? v[k] : __, row)
    var identity = String(read(o.identity)), timestamp = new Date(read(o.timestamp)).getTime(), prior = _javaPrevious[identity]
    var result = { data: row, baseline: true, delta: {}, rate: {} }, counters = {}
    o.counters.forEach(p => { var v = read(p); if (/^[0-9]+$/.test(String(v))) counters[p] = String(v) })
    if (prior && timestamp > prior.timestamp) {
        result.elapsedSeconds = (timestamp - prior.timestamp) / 1000
        Object.keys(counters).forEach(p => {
            if (isDef(prior.counters[p])) {
                var delta = new java.math.BigInteger(counters[p]).subtract(new java.math.BigInteger(prior.counters[p]))
                if (delta.signum() >= 0) { result.delta[p] = String(delta); result.rate[p] = Number(String(delta)) / result.elapsedSeconds; result.baseline = false }
            }
        })
    }
    _javaPrevious[identity] = { timestamp: timestamp, counters: counters }
    return result
}

// HPROF graph queries use an existing index without reading stdin or buffering the heap.
var _javaHPROF = () => {
    var mode = params.hprofmode || "records", o = _javaOptions()
    if (["records", "summary", "index", "object", "find", "refs", "path"].indexOf(mode) < 0) throw new Error("Unsupported hprofmode: " + mode)
    if (["records", "summary", "index"].indexOf(mode) >= 0 && !isString(params.file)) throw new Error("hprof " + mode + " requires file (plain or gzip)")
    if (["records", "summary"].indexOf(mode) < 0 && (!isString(params.hprofindex) || !params.hprofindex.length)) throw new Error("hprof " + mode + " requires hprofindex directory")
    if (["object", "refs", "path"].indexOf(mode) >= 0 && !isString(params.hprofid)) throw new Error("hprof " + mode + " requires hprofid hexadecimal object ID")
    switch (mode) {
    case "summary": return _javaAPI("hprofSummary")(params.file, o)
    case "index": return _javaAPI("hprofIndex")(params.file, params.hprofindex, o)
    case "object": return _javaAPI("hprofObject")(params.hprofindex, params.hprofid, o)
    case "find": return _javaAPI("hprofFind")(params.hprofindex, o)
    case "refs": return _javaAPI("hprofReferences")(params.hprofindex, params.hprofid, o)
    case "path": return _javaAPI("hprofPath")(params.hprofindex, params.hprofid, o)
    }
}
