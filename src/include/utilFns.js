// Util functions
const _transform = r => {
    var _ks = Object.keys(_transformFns)
    for(var ikey = 0; ikey < _ks.length; ikey++) {
        var key = _ks[ikey]
        if (isDef(params[key])) r = _transformFns[key](r)
    }
    return r
}
const _$f = (r, options) => {
    params.__origr = r
    if (options.__ifrom) {
        r = $from(r).query(af.fromNLinq(options.__ifrom.trim()))
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

    if (isString(r)) return _transform(r)
    r = _transform(r)

    if (options.__from) {
        r = $from(r).query(af.fromNLinq(options.__from.trim()))
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
    
    return r
}
const _$o = (r, options, lineByLine) => {
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
        if (r.trim().startsWith("{") && r.trim().endsWith("}")) {
            r = _$f(jsonParse(r, __, __, true), nOptions)
        } else {
            r = _$f(r, nOptions)
        }
    }

    if (isDef(params.outputkey)) r = $$({}).set(params.outputkey, r)
    if (isDef(params.outkey))    r = $$({}).set(params.outkey, r)

    _clearTmpMsg()
    if (isUnDef(nOptions.__format)) nOptions.__format = getEnvsDef("OAFP_OUTPUT", nOptions.__format, "mtree")
    if (_outputFns.has(nOptions.__format)) {
        _outputFns.get(nOptions.__format)(r, nOptions)
    } else {
        _o$o(r, nOptions, __)
    }
}
const _runCmd2Bytes = (cmd, toStr) => {
    var data = af.fromString2Bytes("")
    var ostream = af.newOutputStream()
    $sh(cmd)
    .cb((o, e, i) => {
      ioStreamCopy(ostream, o)
      var ba = ostream.toByteArray()
      if (ba.length > 0) data = ba
    })
    .get()
    return toStr ? af.fromBytes2String(data) : data
}
const _fromJSSLON = (aString, checkYAML) => {
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
const _print = (m) => {
    if ("undefined" !== typeof m) {
        if ("undefined" === typeof params.outfile) {
            if (toBoolean(params.loopcls)) cls()
            print(m)
        } else {
            if ("undefined" === typeof global.__oafp_streams) global.__oafp_streams = {}
            if ("undefined" !== typeof global.__oafp_streams[params.outfile]) {
                var _ofa = toBoolean(params.outfileappend)
                if (_ofa) {
                    ioStreamWrite(global.__oafp_streams[params.outfile].s, m + (_ofa ? "\n" : ""))
                } else {
                    io.writeFileBytes(params.outfile, isString(m) ? af.fromString2Bytes(m) : m)
                }
            }
        }
    }
}
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
const _msg = "(processing data...)"
const _showTmpMsg  = msg => { if (params.out != 'grid' && !params.__inception && !toBoolean(params.loopcls) && !toBoolean(params.chartcls)) printErrnl(_$(msg).default(_msg)) } 
const _clearTmpMsg = msg => { if (params.out != 'grid' && !params.__inception && !toBoolean(params.loopcls) && !toBoolean(params.chartcls)) printErrnl("\r" + " ".repeat(_$(msg).default(_msg).length) + "\r") }
