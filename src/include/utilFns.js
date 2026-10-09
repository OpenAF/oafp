// Util functions
var _activeTransforms
const _transform = r => {
    var keys = _activeTransforms || Object.keys(_transformFns).filter(key => isDef(params[key]))
    for (var i = 0; i < keys.length; i++) {
        if (keys[i] == "sortmapkeys" && toBoolean(params.sortmapkeys) && isArray(r) && r.length > 128) {
            var sorted = [], processor = _recordProcessor(_sortTransformKeys, value => sorted.push(value), true)
            try { r.forEach(processor.add); processor.done() } catch(e) {
                try { processor.abort() } catch(ignore) {}
                throw e
            }
            r = sorted
        } else r = _transformFns[keys[i]](r)
    }
    return r
}
const _$f = (r, options) => {
    params.__origr = r

    // Input filters
    if (options.__ifrom) {
        r = $from(isArray(r) ? r : [ r ]).query(af.fromNLinq(options.__ifrom.trim()))
        delete options.__ifrom
    }
    if (options.__isql) {
        var method = __
        if (isString(params.sqlfilter)) {
            switch(params.sqlfilter.toLowerCase()) {
            case "simple"  : method = "nlinq"; break
            case "advanced": method = "h2"; break
            default        : method = __
            }
        }
        if (isArray(r) && r.length > 0) {
            if (isString(params.isqlfiltertables)) {
                var _sql = $sql()
                var _tables = _fromJSSLON(params.isqlfiltertables)
                if (isArray(_tables)) {
                    // (table: ..., path: ...)
                    _tables.forEach(t => {
                        if (isUnDef(t.table)) _exit(-1, "One 'table' not defined in isqlfiltertables")
                        t.path = _$(t.path, "isqlfiltertables table " + t.table + " path").isString().default("@")
                        var _rp = $path(r, t.path)
                        if (isArray(_rp)) _sql = _sql.table(t.table, _rp)
                    })
                    // if $sql chained then it's already sqlfilter=advanced by default
                    r = _sql.closeQuery(options.__isql.trim())
                }
            } else {
                r = $sql(r, options.__isql.trim(), method)
            }   
        }

        delete options.__isql
    }
    if (options.__path) {
        r = $path(r, options.__path.trim())
        delete options.__path
    }

    //if (!Array.isArray(params.__origr) && Array.isArray(r) && r.length <= 1) r = r[0]

    // Transforms
    if (isString(r)) return _transform(r)
    r = _transform(r)

    // Output filters
    if (options.__from) {
        r = $from(isArray(r) ? r : [ r ]).query(af.fromNLinq(options.__from.trim()))
        delete options.__from
    }
    if (options.__sql) {
        var method = __
        if (isString(params.sqlfilter)) {
            switch(params.sqlfilter.toLowerCase()) {
            case "simple"  : method = "nlinq"; break
            case "advanced": method = "h2"; break
            default        : method = __
            }
        }
        if (isArray(r) && r.length > 0) {
            if (isString(params.sqlfiltertables)) {
                var _sql = $sql()
                var _tables = _fromJSSLON(params.sqlfiltertables)
                if (isArray(_tables)) {
                    // (table: ..., path: ...)
                    _tables.forEach(t => {
                        if (isUnDef(t.table)) _exit(-1, "One 'table' not defined in sqlfiltertables")
                        t.path = _$(t.path, "sqlfiltertables table " + t.table + " path").isString().default("@")
                        var _rp = $path(r, t.path)
                        if (isArray(_rp)) _sql = _sql.table(t.table, _rp)
                    })
                    // if $sql chained then it's already sqlfilter=advanced by default
                    r = _sql.closeQuery(options.__sql.trim())
                }
            } else {
                r = $sql(r, options.__sql.trim(), method)
            }
        }
        delete options.__sql
    }
    if (options.__opath) {
        r = $path(r, options.__opath.trim())
        delete options.__opath
    }
    
    //if (!Array.isArray(__origr2) && Array.isArray(r) && r.length <= 1) r = r[0]
    return r
}
const _$o = (r, options, lineByLine) => {
    if ((r == null && !options.__keepNull) || ("undefined" == typeof r)) {
        _clearTmpMsg()
        return
    }

    var nOptions = clone(options)

    if (toBoolean(params.color)) {
        __conConsole = true
    } else {
        if (isDef(params.color)) {
            __conAnsi = false
        }
    }
    if (!isString(r)) {
        if (lineByLine)
            r = _$f([r], nOptions)[0]
        else
            r = _$f(r, nOptions)
    } else {
        if ((isDef(params.in) && params.in != "raw") || isUnDef(params.in)) {
            const _tr = r.trim()
            if ((_tr.startsWith("{") && _tr.endsWith("}")) || 
                (_tr.startsWith("[") && _tr.endsWith("]") && /^\[\s*\{/.test(_tr))) {
                r = _$f(jsonParse(r, __, __, true), nOptions)
            } else {
                r = _$f(r, nOptions)
            }
        } else {
            r = _transform(r)
        }
    }

    if (isDef(params.outputkey)) r = $$({}).set(params.outputkey, r)
    if (isDef(params.outkey))    r = $$({}).set(params.outkey, r)

    _clearTmpMsg()
    if (isUnDef(nOptions.__format)) nOptions.__format = getEnvsDef("OAFP_OUTPUT", nOptions.__format, "ctree")
    if (_outputFns.has(nOptions.__format)) {
        _outputFns.get(nOptions.__format)(r, nOptions)
    } else {
        _o$o(r, nOptions, __)
    }
}
const _runCmd2Bytes = (cmd, toStr) => _withCommandStream(cmd, stream => {
    if (toStr) {
        var text = new java.lang.StringBuilder()
        ioStreamRead(stream, chunk => { text.append(chunk); return false }, __, true, _cs)
        return String(text.toString())
    }
    var output = af.newOutputStream()
    try {
        Packages.org.apache.commons.io.IOUtils.copyLarge(stream, output)
        return output.toByteArray()
    } finally { output.close() }
})
const _fromJSSLON = (aString, checkYAML) => {
    if ("[object Object]" == Object.prototype.toString.call(aString) || Array.isArray(aString)) return aString
	if (!isString(aString) || aString == "" || isNull(aString)) return ""

	aString = aString.trim()
    var _r
    if (isDef(af.fromJSSLON)) _r = af.fromJSSLON(aString)
    if (isUnDef(_r)) {
        if (aString.startsWith("{")) {
            _r = jsonParse(aString, __, __, true)
        } else {
            _r = af.fromSLON(aString)
        }
    } else {
        if (isString(_r) && checkYAML) _r = af.fromYAML(_r)
    }
    return _r
}
// Shared stateless decision setup for the input and per-entry transform.
const _llmDecisionSetup = (decisionOptions, context) => {
    ["llmconversation", "llmcontext", "llmprompt"].forEach(key => {
        if (isDef(params[key])) _exit(-1, context + " does not support " + key)
    })
    var opts = isDef(decisionOptions) ? clone(decisionOptions) : __
    if (isDef(params.llmimage)) {
        if (!isString(params.llmimage) || !io.fileExists(params.llmimage) || !io.fileInfo(params.llmimage).isFile)
            _exit(-1, context + " llmimage requires a local image file")
        if (isDef(opts) && Object.prototype.hasOwnProperty.call(opts, "images"))
            _exit(-1, context + " cannot combine llmimage with options.images")
        if (isUnDef(opts)) opts = {}
        opts.images = [af.fromBytes2String(af.toBase64Bytes(io.readFileBytes(params.llmimage)))]
    }
    var env = _$(params.llmenv, "llmenv").isString().default("OAFP_MODEL")
    if (env == "OAFP_MODEL" && isUnDef(getEnv(env)) && isDef(getEnv("OAF_DECIDE_MODEL"))) env = "OAF_DECIDE_MODEL"
    env = _resolveLLMEnvName(env)
    var config = _$(params.llmoptions, "llmoptions").or().isString().isMap().default(__)
    if (isUnDef(config) && !isString(getEnv(env)))
        _exit(-1, "llmoptions not defined and " + env + " not found.")
    config = _getSec(isDef(config) ? _fromJSSLON(config) : $sec("system", "envs").get(env))
    var method = toBoolean(params.llmdecidestats) ? "decideWithStats" : "decide"
    return { options: opts, client: () => {
        var client = $llm(clone(config))
        if (typeof client[method] !== "function")
            _exit(-1, context + " requires an updated OpenAF runtime with $llm()." + method + "() support")
        return client
    }, method: method }
}
const _chartPathParse = (r, frmt, prefix, isStatic) => {
    prefix = _$(prefix).isString().default("_oafp_fn_")
    let parts = splitBySepWithEnc(frmt, " ", [["\"","\""],["'","'"]])
    let nparts = []
    $ch("__oaf::chart").create()
    if (parts.length > 1) {
        for(let i = 0; i < parts.length; i++) {
            if (i == 0) {
                nparts.push(parts[i])
            } else {
                let _n = splitBySepWithEnc(parts[i], ":", [["\"","\""],["'","'"]]).map((_p, j) => {
                    if (j == 0) {
                        if (!_p.startsWith("-")) {
                            global[prefix + i] = () => {
                                if (isString(isStatic)) {
                                    var _d = $ch("__oaf::chart").get({ name: isStatic })
                                    if (isUnDef(_d)) _d = []; else _d = _d.data
                                    var _dr = $path(r, _p)
                                    if (isArray(_dr)) {
                                        _dr.forEach((y, _i) => {
                                            if (isArray(_d[_i])) {
                                                _d[_i].push(y)
                                            } else {
                                                _d[_i] = [ y ]
                                            }
                                        })
                                        let last = _d.pop()
                                        $ch("__oaf::chart").set({ name: isStatic }, { name: isStatic, data: _d })
                                        return last[0]
                                    }
                                } else {
                                   return $path(r, _p)
                                }
                            }
                            return prefix + i
                        } else {
                            return _p
                        }
                    } else {
                        return _p
                    }
                }).join(":")
                nparts.push(_n)
            }
        }
        return nparts.join(" ")
    }
    return ""
}
const _print = m => _progressGuard(() => {
    _eraseProgress()
    if ("undefined" !== typeof m) {
        if ("undefined" === typeof params.outfile) {
            if (toBoolean(params.loopcls)) cls()
            if (isDef(params.pipe)) {
                var _m = isMap(params.pipe) ? params.pipe : _fromJSSLON(params.pipe, true)
                if (isMap(_m)) {
                    _m.data = m
                    oafp(_m)
                }
            } else {
                if (toBoolean(params.pause) && isDef(ow.format.string.pauseString) && isString(m)) {
                    ow.format.string.pauseString(m)
                } else {
                    print(m)
                }
            }
        } else {
            if ("undefined" === typeof global.__oafp_streams) global.__oafp_streams = {}
            if ("undefined" !== typeof global.__oafp_streams[params.outfile]) {
                var _ofa = toBoolean(params.outfileappend)
                if (_ofa) {
                    ioStreamWrite(global.__oafp_streams[params.outfile].s, m + (_ofa ? "\n" : ""))
                } else {
                    io.writeFileBytes(params.outfile, isString(m) ? af.fromString2Bytes(m) : m)
                }
            } else {
                io.writeFileBytes(params.outfile, isString(m) || m instanceof java.lang.String ? af.fromString2Bytes(m) : m)
            }
        }
    }
})
const _o$o = (a, b, c) => {
    if ("undefined" !== typeof a) {
        var _s = $o(a, b, c, true)
        if (isDef(_s)) _print(_s)
    }
}

const _getSec = (aM, aPath) => {
	aM = _$(aM).isMap().default({})
	if (isDef(aM.secKey)) {
		aMap = clone(aM)
		
		aMap.secRepo     = _$(aMap.secRepo).default(getEnv("OAFP_SECREPO"))
		aMap.secBucket   = _$(aMap.secBucket).default(getEnv("OAFP_SECBUCKET"))
		aMap.secPass     = _$(aMap.secPass).default(getEnv("OAFP_SECPASS"))
		aMap.secMainPass = _$(aMap.secMainPass).default(getEnv("OAFP_SECMAINPASS"))
		aMap.secFile     = _$(aMap.secFile).default(getEnv("OAFP_SECFILE"))
		
		var s = $sec(aMap.secRepo, aMap.secBucket, aMap.secPass, aMap.secMainPass, aMap.secFile).get(aMap.secKey)

		delete aMap.secRepo
		delete aMap.secBucket
		delete aMap.secPass
		delete aMap.secMainPass
		delete aMap.secFile
		delete aMap.secKey

		if (isDef(aPath)) {
			return $$(aMap).set(aPath, merge($$(aMap).get(aPath), s))
		} else {
			return merge(aMap, s)
		}
	} else {
		return aM
	}
}
const _msg = "(processing data)"
var _progressActive = false, _progressVisible = false, _progressText = _msg, _progressStart = 0
var _progressFrame = 0, _progressTTY
var _progressLock
const _progressEnabled = () => {
    if (getEnv("TERM") == "dumb" || params.progress == "off" || params.out == "grid" || params.__inception || toBoolean(params.loopcls) || toBoolean(params.chartcls)) return false
    if (isUnDef(_progressTTY)) {
        _progressTTY = false
        try {
            // Avoid loading JLine's native library for files and pipes.
            var mode = Number(java.nio.file.Files.getAttribute(java.nio.file.Paths.get("/dev/fd/2"), "unix:mode"))
            if ((mode & 61440) == 8192) _progressTTY = Number(Packages.org.jline.nativ.CLibrary.isatty(2)) == 1
        } catch(ignore) { _progressTTY = java.lang.System.console() != null }
    }
    return _progressTTY
}
const _progressGuard = fn => {
    if (isDef(_progressLock)) _progressLock.lock()
    try { return fn() } finally { if (isDef(_progressLock)) _progressLock.unlock() }
}
const _eraseProgress = () => {
    if (_progressVisible) printErrnl("\r\u001b[2K")
    _progressVisible = false
}
const _showTmpMsg = msg => {
    if (!_progressEnabled()) return
    _progressGuard(() => {
        _progressText = _$(msg).default(_msg)
        if (!_progressActive) _progressStart = now()
        _progressActive = true
    })
}
const _clearTmpMsg = () => _progressGuard(() => {
    _progressActive = false
    _eraseProgress()
})
const _withProgress = fn => {
    if (!_progressEnabled() || !isFunction(ow.format.progressReport)) return fn()
    _progressLock = new java.util.concurrent.locks.ReentrantLock()
    var unicode = /utf-?8/i.test(String(_cs || java.lang.System.getProperty("file.encoding")))
    var frames = unicode ? ["•", "◦", "·", "◦"] : ["-", "\\", "|", "/"]
    try {
        return ow.format.progressReport(fn, () => _progressGuard(() => {
            if (!_progressActive || now() - _progressStart < 250) return
            printErrnl("\r\u001b[2K" + frames[_progressFrame++ % frames.length] + " " + _progressText)
            _progressVisible = true
        }), 150)
    } finally { _clearTmpMsg() }
}
