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
        if (isArray(r) && r.length > 0) r = $sql(r, options.__isql.trim(), method)
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
        if (isArray(r) && r.length > 0) r = $sql(r, options.__sql.trim(), method)
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
    if (_outputFns.has(nOptions.__format)) {
        _outputFns.get(nOptions.__format)(r, nOptions)
    } else {
        if (isUnDef(nOptions.__format)) nOptions.__format = "tree"
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
const _fromJSSLON = aString => {
	if (!isString(aString) || aString == "" || isNull(aString)) return ""

	aString = aString.trim()
	if (aString.startsWith("{")) {
		return jsonParse(aString, __, __, true)
	} else {
		return af.fromSLON(aString)
	}
}
const _chartPathParse = (r, frmt,prefix) => {
    prefix = _$(prefix).isString().default("_oafp_fn_")
    let parts = splitBySepWithEnc(frmt, " ", [["\"","\""],["'","'"]])
    let nparts = []
    if (parts.length > 1) {
        for(let i = 0; i < parts.length; i++) {
            if (i == 0) {
                nparts.push(parts[i])
            } else {
                let _n = splitBySepWithEnc(parts[i], ":", [["\"","\""],["'","'"]]).map((_p, j) => {
                    if (j == 0) {
                        if (!_p.startsWith("-")) {
                            global[prefix + i] = () => $path(r, _p)
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
    if ("undefined" === typeof params.outfile) {
        print(m)
    } else {
        if ("undefined" === typeof global.__oafp_streams) global.__oafp_streams = {}
        if ("undefined" !== typeof global.__oafp_streams[params.outfile]) {
            ioStreamWrite(global.__oafp_streams[params.outfile].s, m)
        }
    }
}
const _o$o = (a, b, c) => {
    _print($o(a, b, c, true))
}
const _msg = "(processing data...)"
const _showTmpMsg  = msg => { if (params.out != 'grid' && !toBoolean(params.loopcls) && !toBoolean(params.chartcls)) printErrnl(_$(msg).default(_msg)) } 
const _clearTmpMsg = msg => { if (params.out != 'grid' && !toBoolean(params.loopcls) && !toBoolean(params.chartcls)) printErrnl("\r" + " ".repeat(_$(msg).default(_msg).length) + "\r") }
