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
            if (typeof _idescSample == "undefined" || failure !== _idescSample.stop) {
                try { ioStreamReadBytes(out, () => false) } catch(ignore) {}
            }
            out.close()
            $doWait(drain)
            err.close()
        }
    }, _cs, false, __, () => isDef(failure) ? "force" : __)
    if (isDef(failure)) throw failure
    // A very short-lived child may finish before OpenAF invokes its stream callback.
    if (!called) {
        if (commandResult.stderr) _progressGuard(() => { _eraseProgress(); printErr(commandResult.stderr) })
        var stream = _codecs.textInput(commandResult.stdout || "")
        try { return fn(stream, String(java.nio.charset.Charset.defaultCharset().name())) } finally { stream.close() }
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

// Keep jsondesc's legacy paths/order, but never decode scalar values on newer runtimes.
const _describeJSONPaths = (file, prefix) => {
    var paths = new Set(), add = path => {
        var p = path.substring(2)
        if (isUnDef(prefix) || p.startsWith(prefix)) paths.add(p)
    }
    if (isFunction(io.scanJSON)) {
        try {
            io.scanJSON(file, e => {
                var path = "$" + e.path.map(k => typeof k == "number" ? "[" + k + "]" : "." + k).join("")
                if (e.phase == "value" && e.type != "map" && e.type != "array") add(path)
            })
            return Array.from(paths)
        } catch(e) { paths.clear() } // Preserve readStreamJSON's lenient JSON support.
    }
    io.readStreamJSON(file, path => { add(path); return false })
    return Array.from(paths)
}

// Set once stdin/cmd output has already been read into memory (e.g. to auto-detect the input type)
var _inputBuffered = false
// Keep streams owned by this call separate from the process-wide stdin stream.
const _withInputStream = (res, fn) => {
    // stdin/cmd can only be consumed once: stream from what was already buffered instead
    if (_inputBuffered && isString(res)) {
        var bstream = _codecs.textInput(res)
        try { return fn(bstream) } finally { bstream.close() }
    }
    if (isDef(params.file) && isUnDef(params.cmd)) {
        return _withFileStream(fn)
    }
    if (isDef(params.cmd)) return _withCommandStream(params.cmd, fn)
    if (isDef(params.data) || isDef(params.url) || _version) {
        var stream = _codecs.textInput(res)
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

// All codecs leave caller-owned streams open. The fallback keeps older runtimes usable.
const _codecs = typeof __streamCodec != "undefined" ? __streamCodec : (() => {
  var IO = Packages.org.apache.commons.io, Codec = Packages.org.apache.commons.codec.binary
  var charset = value => java.nio.charset.Charset.forName(String(value || java.nio.charset.Charset.defaultCharset().name()))
  var use = (resources, fn) => {
    var result, failure, failed = false
    try { result = fn() } catch(e) { failure = e; failed = true }
    resources.forEach(resource => {
      try { resource.close() } catch(e) {
        if (!failed) { failure = e; failed = true }
        else {
          try { (failure.javaException || failure).addSuppressed(e.javaException || e) } catch(ignore) {}
        }
      }
    })
    if (failed) throw failure
    return result
  }
  var textInput = (text, encoding) => new IO.input.ReaderInputStream(new java.io.StringReader(String(text)), charset(encoding))
  var textOutput = (writer, encoding) => new IO.output.WriterOutputStream(writer, charset(encoding))
  var copy = (input, output) => { IO.IOUtils.copyLarge(input, output); output.flush() }
  var encode = (input, output, gzip) => {
    if (!gzip && isFunction(af.toBase64Stream)) return af.toBase64Stream(input, output, true)
    var base64 = new Codec.Base64OutputStream(IO.output.CloseShieldOutputStream.wrap(output), true, 0, null)
    use([base64], () => {
      if (gzip) {
        if (isFunction(io.gzipStream)) io.gzipStream(input, base64, true)
        else {
          var zipped = new java.util.zip.GZIPOutputStream(IO.output.CloseShieldOutputStream.wrap(base64))
          use([zipped], () => copy(input, zipped))
        }
      } else copy(input, base64)
    })
    output.flush()
  }
  var decode = (input, output, gzip) => {
    if (!gzip && isFunction(af.fromBase64Stream)) return af.fromBase64Stream(input, output, true)
    var base64 = new Codec.Base64InputStream(IO.input.CloseShieldInputStream.wrap(input), false)
    use([base64], () => {
      if (gzip) {
        if (isFunction(io.gunzipStream)) io.gunzipStream(base64, output, true)
        else {
          var zipped = new java.util.zip.GZIPInputStream(IO.input.CloseShieldInputStream.wrap(base64))
          use([zipped], () => copy(zipped, output))
        }
      } else copy(base64, output)
    })
    output.flush()
  }
  var toText = (input, convert, encoding) => {
    var writer = new java.io.StringWriter(), output = textOutput(writer, encoding)
    use([output], () => convert(input, output))
    return String(writer.toString())
  }
  var fileInput = file => {
    if (String(file).indexOf("::") < 0) return io.readFileStream(file)
    plugin("ZIP")
    var split = String(file).indexOf("::"), zip = new ZIP()
    return zip.streamGetFileStream(String(file).substring(0, split), String(file).substring(split + 2))
  }
  return {
    use: use, textInput: textInput, textOutput: textOutput, copy: copy,
    encode: encode, decode: decode, fileInput: fileInput,
    encodeText: (text, output, gzip) => {
      var input = textInput(text)
      return use([input], () => encode(input, output, gzip))
    },
    encodeToString: (input, gzip) => toText(input, (i, o) => encode(i, o, gzip), "US-ASCII"),
    decodeToString: (input, gzip) => toText(input, (i, o) => decode(i, o, gzip)),
    encodeFile: file => {
      var input = fileInput(file)
      return use([input], () => toText(input, (i, o) => encode(i, o, false), "US-ASCII"))
    },
    gzipText: (text, output) => {
      var input = textInput(text)
      return use([input], () => {
        if (isFunction(io.gzipStream)) return io.gzipStream(input, output, true)
        var zipped = new java.util.zip.GZIPOutputStream(IO.output.CloseShieldOutputStream.wrap(output))
        return use([zipped], () => copy(input, zipped))
      })
    },
    gunzipText: input => toText(input, (i, o) => {
      if (isFunction(io.gunzipStream)) return io.gunzipStream(i, o, true)
      var zipped = new java.util.zip.GZIPInputStream(IO.input.CloseShieldInputStream.wrap(i))
      return use([zipped], () => copy(zipped, o))
    })
  }
})()

const _codecDestination = (fn, stage) => {
    // Finish reading before replacing/appending a file: input and output may be aliases,
    // or an opaque command/HTTP handler may still be reading the destination.
    if (stage && isDef(params.outfile)) {
        var temporary = io.createTempFile("oafp-base64-output-", ".tmp")
        try {
            var sink = io.writeFileStream(temporary)
            _codecs.use([sink], () => fn(sink))
            var source = io.readFileStream(temporary)
            return _codecs.use([source], () => _codecDestination(output => _codecs.copy(source, output), false))
        } finally { io.rm(temporary) }
    }
    // Never hold the progress lock while consuming input: command stderr drains
    // need that lock too, and a full stderr pipe would otherwise deadlock stdout.
    _clearTmpMsg()
    if (isUnDef(params.outfile)) {
        if (toBoolean(params.loopcls)) _progressGuard(() => cls())
        fn(java.lang.System.out)
        _progressGuard(() => print(""))
    } else if (isDef(global.__oafp_streams) && isDef(global.__oafp_streams[params.outfile])) {
        var stream = global.__oafp_streams[params.outfile].s
        fn(stream)
        if (toBoolean(params.outfileappend)) _progressGuard(() => ioStreamWrite(stream, "\n"))
    } else {
        var stream = io.writeFileStream(params.outfile)
        _codecs.use([stream], () => fn(stream))
    }
}
const _codecOutput = (value, gzip) => {
    var text = isString(value) ? value : stringify(value)
    if (isDef(params.pipe) || toBoolean(params.pause)) {
        var input = _codecs.textInput(text)
        return _codecs.use([input], () => _print(_codecs.encodeToString(input, gzip)))
    }
    return _codecDestination(output => _codecs.encodeText(text, output, gzip))
}
// Match io.pipeLn: normalize CR/LF/CRLF and omit the final line terminator.
// Work in UTF-8 so newline bytes cannot occur inside another encoded character.
const _codecStdin = source => {
    var utf8 = new Packages.org.apache.commons.io.input.ReaderInputStream(
        new java.io.InputStreamReader(Packages.org.apache.commons.io.input.CloseShieldInputStream.wrap(source)),
        java.nio.charset.StandardCharsets.UTF_8)
    var raw = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 8192)
    var chunk, position = 0, pending = false, skipLF = false, ended = false
    var fill = () => {
        while (!ended && (isUnDef(chunk) || position >= chunk.length)) {
            var count = utf8.read(raw)
            if (count < 0) { ended = true; break }
            var text = new java.lang.String(raw, 0, count, java.nio.charset.StandardCharsets.ISO_8859_1)
            if (skipLF && text.startsWith("\n")) text = text.substring(1)
            skipLF = text.endsWith("\r")
            text = String(text.replaceAll("\r\n?", "\n"))
            if (pending) text = "\n" + text
            pending = text.endsWith("\n")
            if (pending) text = text.substring(0, text.length - 1)
            chunk = new java.lang.String(text).getBytes(java.nio.charset.StandardCharsets.ISO_8859_1)
            position = 0
        }
        return isDef(chunk) && position < chunk.length
    }
    var normalized = new JavaAdapter(java.io.InputStream, {
        read: function(buffer, offset, length) {
            if (arguments.length == 0) return fill() ? chunk[position++] & 255 : -1
            if (arguments.length == 1) { offset = 0; length = buffer.length }
            if (length == 0) return 0
            if (!fill()) return -1
            var count = Math.min(length, chunk.length - position)
            java.lang.System.arraycopy(chunk, position, buffer, offset, count)
            position += count
            return count
        },
        close: function() { utf8.close() }
    })
    return new Packages.org.apache.commons.io.input.ReaderInputStream(
        new java.io.InputStreamReader(normalized, java.nio.charset.StandardCharsets.UTF_8),
        java.nio.charset.Charset.defaultCharset())
}
const _withCodecSource = (res, fn) => {
    if ((_inputBuffered && isString(res)) || isDef(params.data)) {
        var input = _codecs.textInput(res)
        return _codecs.use([input], () => fn(input))
    }
    if (isDef(params.url) && !_inputBuffered) {
        // Keep HEAD metadata and JSON-valued REST responses on their existing path.
        var hp = Object.assign({}, _fromJSSLON(_$(params.urlparams).or().isString().isMap().default("{}")))
        var method = String(params.urlmethod || "GET").toLowerCase()
        if (method == "head") return false
        ow.loadObj()
        var owned = isUnDef(hp.httpClient)
        var client = hp.httpClient || ow.obj.rest.connectionFactory()
        hp.httpClient = client
        var rest = $rest(hp), body = isDef(params.urldata) ? _fromJSSLON(params.urldata) : __
        return _codecs.use(owned ? [client] : [], () => {
            var stream
            if (method == "post") stream = rest.post2Stream(params.url, body)
            else if (method == "put") stream = rest.put2Stream(params.url, body)
            else if (method == "delete") stream = rest.delete2Stream(params.url)
            else stream = rest.get2Stream(params.url)
            if (!isJavaObject(stream) || !isFunction(stream.read)) {
                // The REST default/error response is already materialized.
                var input = _codecs.textInput(isObject(stream) ? stringify(stream, __, "") : String(stream))
                return _codecs.use([input], () => fn(input, String(java.nio.charset.Charset.defaultCharset().name())))
            }
            return _codecs.use([stream], () => {
                var buffered = new java.io.BufferedInputStream(stream)
                buffered.mark(8192)
                var head = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 4)
                var size = Packages.org.apache.commons.io.IOUtils.read(buffered, head)
                buffered.reset()
                var b = index => Number(head[index]) & 255
                var type = isFunction(client.responseType) ? String(client.responseType() || "") : ""
                var match = type.match(/charset\s*=\s*["']?([^;"'\s]+)/i), encoding = match ? match[1] : "UTF-8"
                try { encoding = String(java.nio.charset.Charset.forName(encoding).name()) } catch(ignore) { encoding = "UTF-8" }
                var skip = 0
                if (size >= 4 && b(0) == 0 && b(1) == 0 && b(2) == 254 && b(3) == 255) { encoding = "UTF-32BE"; skip = 4 }
                else if (size >= 4 && b(0) == 255 && b(1) == 254 && b(2) == 0 && b(3) == 0) { encoding = "UTF-32LE"; skip = 4 }
                else if (size >= 3 && b(0) == 239 && b(1) == 187 && b(2) == 191) { encoding = "UTF-8"; skip = 3 }
                else if (size >= 2 && b(0) == 254 && b(1) == 255) { encoding = "UTF-16BE"; skip = 2 }
                else if (size >= 2 && b(0) == 255 && b(1) == 254) { encoding = "UTF-16LE"; skip = 2 }
                var decodedText
                if (skip || encoding != "UTF-8") {
                    if (skip) buffered.skip(skip)
                    var writer = new java.io.StringWriter()
                    Packages.org.apache.commons.io.IOUtils.copy(new java.io.InputStreamReader(buffered, encoding), writer)
                    decodedText = String(writer.toString())
                }
                var first = -1, scanned = 0
                do { first = buffered.read(); scanned++ } while (first >= 0 && first <= 32 && scanned < 8192)
                if (isUnDef(decodedText)) buffered.reset()
                if (isDef(decodedText) || scanned >= 8192 || (first >= 0 && '{["-0123456789tfn'.indexOf(String.fromCharCode(first)) >= 0)) {
                    var text = isDef(decodedText) ? decodedText : af.fromInputStream2String(buffered, "UTF-8")
                    var parsed = jsonParse(text)
                    if (isObject(parsed)) text = stringify(parsed, __, "")
                    else if (isString(parsed)) text = parsed
                    else if (params.type == "raw") {
                        if (parsed == null) return
                        text = stringify(parsed, __, "")
                    } else {
                        // Preserve legacy REST scalar/error behavior; these are not text payloads.
                        var bytes = af.fromBase64(parsed)
                        if (params.type == "gb64json" || toBoolean(params.base64gzip)) bytes = io.gunzip(bytes)
                        return _$o(af.fromBytes2String(bytes), options)
                    }
                    var input = _codecs.textInput(text)
                    return _codecs.use([input], () => fn(input, String(java.nio.charset.Charset.defaultCharset().name())))
                }
                return fn(buffered, "UTF-8")
            })
        })
    }
    if (isUnDef(params.file) && isUnDef(params.cmd) && isUnDef(params.data) && !_inputBuffered) {
        var input = _codecStdin(java.lang.System.in)
        return _codecs.use([input], () => fn(input))
    }
    return _withInputStream(res, fn)
}
const _tryRawCodec = () => {
    if ((isString(params.file) && params.file.indexOf("::") >= 0) || params.type != "raw" || ["base64", "gb64json"].indexOf(params.format) < 0 ||
        _activeTransforms.length || Object.keys(options).some(key =>
            ["__ijq", "__ojq", "__ifrom", "__isql", "__path", "__from", "__sql", "__opath"].indexOf(key) >= 0 && isDef(options[key])) ||
        isDef(params.pipe) || toBoolean(params.pause) ||
        toBoolean(params._shebang) || isDef(params.outkey) || isDef(params.outputkey) ||
        isDef(params.idescrecipe) || isDef(params.jsonprefix) || toBoolean(params.jsondesc)) return false
    var gzip = params.format == "gb64json" || toBoolean(params.base64gzip)
    if (isDef(params.url) && String(params.urlmethod || "GET").toLowerCase() == "head") return false
    if (isDef(params.insecure) && toBoolean(params.insecure)) ow.loadJava().setIgnoreSSLDomains()
    _withCodecSource(isString(params.data) ? params.data : "", (input, encoding) => {
        // File/raw text is decoded as before, then re-encoded in the runtime charset.
        var source = input
        if (isDef(params.file) || isDef(params.cmd) || isDef(params.url)) source = new Packages.org.apache.commons.io.input.ReaderInputStream(
            new java.io.InputStreamReader(Packages.org.apache.commons.io.input.CloseShieldInputStream.wrap(input), encoding || _cs || "UTF-8"),
            java.nio.charset.Charset.defaultCharset())
        _codecs.use(source === input ? [] : [source], () => _codecDestination(output => _codecs.encode(source, output, gzip), true))
    })
    return true
}
const _codecInput = (res, options, gzip) => {
    _showTmpMsg()
    _withCodecSource(res, (input, encoding) => {
        var charset = encoding || ((isDef(params.file) || isDef(params.cmd)) && !_inputBuffered
            ? _cs || "UTF-8" : String(java.nio.charset.Charset.defaultCharset().name()))
        var source = new Packages.org.apache.commons.io.input.ReaderInputStream(
            new java.io.InputStreamReader(Packages.org.apache.commons.io.input.CloseShieldInputStream.wrap(input), charset),
            java.nio.charset.StandardCharsets.UTF_8)
        return _codecs.use([source], () => _$o(_codecs.decodeToString(source, gzip), options))
    })
}

// Each GC pattern owns its capture mapping; parser state belongs to one input.
const _javaGCParser = () => {
    var bytes = value => ow.format.fromBytesAbbreviation(value + "B")
    var fields = (result, match, start, names) => {
        names.forEach((name, i) => { result[name] = bytes(match[start + i]) })
    }
    var timestamp = text => ow.format.toDate(text.replace(/:$/, ""), "yyyy-MM-dd'T'HH:mm:ss.SSSZ")
    var legacy = (m, start, full, times) => {
        var r = {timestamp:timestamp(m[1]), sinceStart:parseFloat(m[2]), gcType:m[3] + " " + m[4]}
        fields(r,m,start,["PSYoungGenBeforeGC","PSYoungGenAfterGC","PSYoungGenTotal"])
        start += 3
        if (full) { fields(r,m,start,["ParOldGenBeforeGC","ParOldGenAfterGC","ParOldGenTotal"]); start += 3 }
        fields(r,m,start,["heapBeforeGC","heapAfterGC","heapTotal"]); start += 3
        if (full) { fields(r,m,start,["metaBeforeGC","metaAfterGC","metaTotal"]); start += 3 }
        r.durationSecs = parseFloat(m[start++])
        if (times) ["userTime","sysTime","realTime"].forEach(name => { r[name] = parseFloat(m[start++]) })
        return r
    }
    var youngMultiline = m => legacy(m,6,false,true)
    var young = m => legacy(m,5,false,false)
    var youngTimes = m => legacy(m,5,false,true)
    var full = m => legacy(m,5,true,false)
    var fullTimes = m => legacy(m,5,true,true)
    var generic = m => {
        var r = {sinceStart:parseFloat(m[1]),gcType:m[2] + " " + m[3],durationSecs:parseFloat(m[7])}
        fields(r,m,4,["heapBeforeGC","heapAfterGC","heapTotal"])
        return r
    }
    var modern = m => {
        var r = {gcId:parseInt(m[2]),gcType:m[3].trim() || "none"}
        m[1].split("][").forEach(head => {
            if (/^\d+\.\d+s$/.test(head)) r.sinceStart = parseFloat(head)
            else if (/\d{4}-\d{2}-\d{2}T/.test(head)) r.timestamp = timestamp(head)
        })
        return r
    }
    var heap = m => {
        var r = modern(m)
        fields(r,m,4,["heapBeforeGC","heapAfterGC","heapTotal"])
        r.durationSecs = parseFloat(m[7]) / 1000
        return r
    }
    var allocation = m => {
        var r = modern(m)
        fields(r,m,5,["heapBeforeGC","heapAfterGC","heapTotal"])
        r.durationSecs = parseFloat(m[8]) / 1000
        return r
    }
    var meta = m => {
        var r = modern(m)
        fields(r,m,4,["metaUsedBeforeGC","metaTotalBeforeGC","metaUsedAfterGC","metaTotalAfterGC",
            "nonClassUsedBeforeGC","nonClassTotalBeforeGC","nonClassUsedAfterGC","nonClassTotalAfterGC",
            "classUsedBeforeGC","classTotalBeforeGC","classUsedAfterGC","classTotalAfterGC"])
        return r
    }
    // Specific timed and allocation forms precede shorter alternatives.
    var patterns = [
        {pattern: /([^ ]+) (\d+\.\d+): \[(GC) \((.*?)\)(.+?)\[PSYoungGen: (\d+K)->(\d+K)\((.*?)\)\] (\d+K)->(\d+K)\((.*?)\), (\d+\.\d+) secs\] \[Times: user=(\d+\.\d+) sys=(\d+\.\d+), real=(\d+\.\d+) secs\]/s, read: youngMultiline},
        {pattern: /([^ ]+) (\d+\.\d+): \[(GC) \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\((.*?)\)\] (\d+K)->(\d+K)\((.*?)\), (\d+\.\d+) secs\] \[Times: user=(\d+\.\d+) sys=(\d+\.\d+), real=(\d+\.\d+) secs\]/, read: youngTimes},
        {pattern: /([^ ]+) (\d+\.\d+): \[(GC) \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\((.*?)\)\] (\d+K)->(\d+K)\((.*?)\), (\d+\.\d+) secs\]/, read: young},
        {pattern: /([^ ]+) (\d+\.\d+): \[(Full GC) \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\((.*?)\)\] \[ParOldGen: (\d+K)->(\d+K)\((.*?)\)\] (\d+K)->(\d+K)\((.*?)\), \[Metaspace: (\d+K)->(\d+K)\((.*?)\)\], (\d+\.\d+) secs\] \[Times: user=(\d+\.\d+) sys=(\d+\.\d+), real=(\d+\.\d+) secs\]/, read: fullTimes},
        {pattern: /([^ ]+) (\d+\.\d+): \[(Full GC) \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\((.*?)\)\] \[ParOldGen: (\d+K)->(\d+K)\((.*?)\)\] (\d+K)->(\d+K)\((.*?)\), \[Metaspace: (\d+K)->(\d+K)\((.*?)\)\], (\d+\.\d+) secs\]/, read: full},
        {pattern: /(\d+\.\d+): \[(GC|Full GC) \((.*?)\)\s+(\d+K)->(\d+K)\((\d+K)\), (\d+\.\d+) secs\]/, read: generic},
        {pattern: /^\[(.+)\]\s+GC\((\d+)\)\s*(Allocation Failure)\s*(.*?)\s+(\d+[KMGT])->(\d+[KMGT])\((\d+[KMGT])\)\s+(\d+\.\d+)ms/, read: allocation},
        {pattern: /^\[(.+)\]\s+GC\((\d+)\)\s*(.*?)\s*(\d+[GMK])->(\d+[GMK])\((\d+[GMK])\)\s*(\d+\.\d+)ms/, read: heap},
        {pattern: /^\[(.+)\]\s+GC\((\d+)\)\s*(.*?)\s*Metaspace:\s*(\d+[GMK])\((\d+[GMK])\)->(\d+[GMK])\((\d+[GMK])\)\s*NonClass:\s*(\d+[GMK])\((\d+[GMK])\)->(\d+[GMK])\((\d+[GMK])\)\s*Class:\s*(\d+[GMK])\((\d+[GMK])\)->(\d+[GMK])\((\d+[GMK])\)/, read: meta},
    ]
    return event => {
        for (var i = 0; i < patterns.length; i++) {
            var match = event.match(patterns[i].pattern)
            if (match) return patterns[i].read(match)
        }
    }
}
const _javaGCFramer = () => {
    var lines = []
    var start = /^(\[?\d+|\d{4}-\d{2}-\d{2}T)/
    var flush = emit => { if (lines.length) emit(lines.join("\n")); lines = [] }
    var frame = (line, emit) => {
        if (start.test(line)) { flush(emit); lines.push(line) }
        else if (lines.length) lines.push(line)
    }
    frame.end = emit => flush(emit)
    return frame
}
