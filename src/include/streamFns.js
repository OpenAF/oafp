const _withCommandStream = (cmd, fn) => {
    var result, failure, called = false
    var commandResult = sh(cmd, __, __, false, __, true, (out, err, input) => {
        called = true
        // Drain stderr concurrently without retaining it or mixing it with data.
        var drain = $do(() => {
            ioStreamReadLines(err, line => { _progressGuard(() => { _eraseProgress(); printErr(line) }); return false }, __, true, _cs)
        }).catch(e => { failure = failure || e })
        try {
            input.close()
            result = fn(out)
        } catch(e) {
            failure = e
        } finally {
            // Also drain any remaining stdout if a reader terminates early.
            try { ioStreamReadBytes(out, () => false) } catch(ignore) {}
            out.close()
            $doWait(drain)
            err.close()
        }
    }, _cs, false, __, () => isDef(failure) ? "force" : __)
    if (isDef(failure)) throw failure
    // A very short-lived child may finish before OpenAF invokes its stream callback.
    if (!called) {
        if (commandResult.stderr) _progressGuard(() => { _eraseProgress(); printErr(commandResult.stderr) })
        var stream = af.fromString2InputStream(commandResult.stdout || "")
        try { return fn(stream) } finally { stream.close() }
    }
    return result
}

// Compression is a file transport option, independent of the input format.
const _isGzipFile = () => isString(params.file) &&
    (isDef(params.ingzip) ? toBoolean(params.ingzip) : /\.gz$/i.test(params.file))
const _inputFileName = () => _isGzipFile() ? params.file.replace(/\.gz$/i, "") : params.file
const _withFileStream = fn => {
    var stream = _isGzipFile() ? io.readFileGzipStream(params.file) : io.readFileStream(params.file)
    try { return fn(stream) } finally { stream.close() }
}
const _readFileText = () => {
    if (!_isGzipFile()) return io.readFileString(params.file, _cs)
    return _withFileStream(stream => af.fromInputStream2String(stream, _cs || "UTF-8"))
}
// Some OpenAF parsers require a path. Only those readers need a temporary file.
const _withInputFilePath = fn => {
    if (!_isGzipFile()) return fn(params.file)
    var file = io.createTempFile("oafp-gzip-", "." + _inputFileName().replace(/^.*[.\/\\]/, ""))
    try {
        _withFileStream(input => {
            var output = io.writeFileStream(file)
            try { ioStreamCopy(output, input) } finally { output.close() }
        })
        return fn(file)
    } finally { io.rm(file) }
}

// Keep streams owned by this call separate from the process-wide stdin stream.
const _withInputStream = (res, fn) => {
    if (isDef(params.file) && isUnDef(params.cmd)) {
        return _withFileStream(fn)
    }
    if (isDef(params.cmd)) return _withCommandStream(params.cmd, fn)
    if (isDef(params.data) || isDef(params.url) || _version) {
        var stream = af.fromString2InputStream(res)
        try { return fn(stream) } finally { stream.close() }
    }
    return fn(java.lang.System.in)
}
const _readInputString = res => _withInputStream(res, stream => {
    var text = new java.lang.StringBuilder()
    ioStreamRead(stream, chunk => { text.append(chunk); return false }, __, true, _cs)
    return String(text.toString())
})
const _readInputLines = (res, fn) => _withInputStream(res, stream =>
    ioStreamReadLines(stream, line => fn(String(line).replace(/\r$/, "")), __, true, _cs))

// The bundled implementation keeps the new input usable on older OpenAF runtimes.
// Keep this function in sync with OpenAF's additive io.readJSONArray API.
const _readJSONArray = (source, callback, encoding, raw) => {
    var owned = Object.prototype.toString.call(source) == "[object String]"
    var stream = owned ? io.readFileStream(source) : source
    var count = 0
    try {
        var reader = new java.io.InputStreamReader(stream, encoding || "UTF-8")
        var json = new Packages.com.google.gson.stream.JsonReader(reader)
        json.setLenient(false)
        json.beginArray()
        while (json.hasNext()) {
            var text = String(Packages.com.google.gson.internal.Streams.parse(json).toString())
            if (callback(raw === true ? text : jsonParse(text), count++) === true) return count
        }
        json.endArray()
        if (String(json.peek()) != "END_DOCUMENT") throw "Unexpected content after JSON array"
        return count
    } finally {
        if (owned) stream.close()
    }
}

const _parallelMode = () => {
    var value = isDef(params.parallel) ? params.parallel : getEnv("OAFP_PARALLEL")
    if (isUnDef(value)) return "auto"
    value = String(value).toLowerCase()
    if (["auto", "true", "false"].indexOf(value) < 0) throw "parallel must be auto, true or false"
    return value
}

// Workers only compute isolated values. Emission and transforms stay on the caller.
// Each queue entry owns at most 128 records / 1 MiB, except a single oversized record.
const _recordProcessor = (parse, emit, safe) => {
    var mode = _parallelMode(), workers = Math.max(1, Math.min(4, getNumberOfCores()))
    var enabled = mode == "true" && safe && workers > 1
    var sampleCount = 0, sampleTime = 0, pending = [], batch = [], bytes = 0, failed = false
    var slots = new java.util.concurrent.Semaphore(workers)
    var compute = rows => rows.map(parse)
    var settle = (entry, output) => {
        $doWait(entry.promise)
        if (isDef(entry.error)) throw entry.error
        if (output) entry.result.forEach(emit)
        entry.result = __
    }
    var drain = output => {
        var error
        while (pending.length > 0) {
            try { settle(pending.shift(), output && isUnDef(error)) } catch(e) { error = error || e }
        }
        if (isDef(error)) throw error
    }
    var flush = () => {
        if (batch.length == 0) return
        var rows = batch
        batch = [], bytes = 0
        if (!enabled) { compute(rows).forEach(emit); return }
        var entry = {}
        entry.promise = $do(() => {
            slots.acquire()
            try { entry.result = compute(rows) } finally { slots.release() }
        }).catch(e => { entry.error = e })
        pending.push(entry)
        if (pending.length >= workers * 2) settle(pending.shift(), true)
    }
    return {
        add: row => {
            if (failed) return
            if (!enabled) {
                if (mode != "auto" || !safe || workers <= 1 || sampleCount >= 256) { emit(parse(row)); return }
                sampleCount++
                // Warm the parser first; cold initialization is not a per-record cost.
                var start = sampleCount > 128 ? nowNano() : 0, value = parse(row)
                if (start > 0) sampleTime += nowNano() - start
                emit(value)
                if (sampleCount == 256) enabled = sampleTime >= 32000000
                return
            }
            var size = String(row).length * 2
            if (size >= 1048576) {
                flush(); drain(true)
                batch.push(row)
                flush(); drain(true)
                return
            }
            if (bytes + size > 1048576) flush()
            batch.push(row), bytes += size
            if (batch.length >= 128 || bytes >= 1048576) flush()
        },
        done: () => {
            try { flush(); drain(true) } catch(e) {
                failed = true
                try { drain(false) } catch(ignore) {}
                throw e
            }
        },
        abort: () => { failed = true; batch = []; drain(false) }
    }
}
const _processRecords = (res, parse, emit, safe, frame) => {
    var processor = _recordProcessor(parse, emit, safe)
    try {
        _readInputLines(res, line => {
            if (isDef(frame)) frame(line, processor.add)
            else processor.add(line)
            return false
        })
        if (isDef(frame) && isFunction(frame.end)) frame.end()
        processor.done()
    } catch(e) {
        try { processor.abort() } catch(ignore) {}
        throw e
    }
}

// Frame complete JSON values before dispatching any parsing work.
const _jsonLineFramer = () => {
    var buffer = "", depth = 0, quoted = false, escaped = false
    var frame = (line, emit) => {
        if (buffer.length == 0 && line.trim().length == 0) return
        if (buffer.length > 0) buffer += "\n"
        buffer += line
        for (var i = 0; i < line.length; i++) {
            var ch = line[i]
            if (quoted) {
                if (escaped) escaped = false
                else if (ch == "\\") escaped = true
                else if (ch == '"') quoted = false
            } else {
                if (ch == '"') quoted = true
                else if (ch == "{" || ch == "[") depth++
                else if (ch == "}" || ch == "]") depth--
            }
        }
        if (depth <= 0 && !quoted) {
            emit(buffer)
            buffer = "", depth = 0, escaped = false
        }
    }
    frame.end = () => { if (buffer.trim().length > 0) throw "Incomplete NDJSON record" }
    return frame
}
