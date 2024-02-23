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
    if (isString(r)) return _transform(r)

    if (options.__path) {
        r = $path(r, options.__path.trim())
        delete options.__path
    }
    if (options.__from) {
        r = $from(r).query(af.fromNLinq(options.__from.trim()))
        delete options.__from
    }
    if (options.__sql) {
        var method = "auto"
        if (isString(params.sqlfilter)) {
            switch(params.sqlfilter.toLowerCase()) {
            case "simple"  : method = "nlinq"; break
            case "advanced": method = "h2"; break
            default        : method = "auto"
            }
        }
        if (isArray(r) && r.length > 0) r = $sql(r, options.__sql.trim(), method)
        delete options.__sql
    }
    r = _transform(r)
    
    return r
}
const _$o = (r, options, lineByLine) => {
    if (!isString(r)) {
        if (lineByLine)
            r = _$f([r], options)[0]
        else
            r = _$f(r, options)
    } else {
        if (r.trim().startsWith("{") && r.trim().endsWith("}")) {
            r = _$f(jsonParse(r, __, __, true), options)
        } else {
            r = _$f(r, options)
        }
    }

    if (isDef(params.outputkey)) r = $$({}).set(params.outputkey, r)
    if (isDef(params.outkey))    r = $$({}).set(params.outkey, r)

    _clearTmpMsg()
    if (_outputFns.has(options.__format)) {
        _outputFns.get(options.__format)(r, options)
    } else {
        $o(r, options)
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
const _msg = "(processing data...)"
const _showTmpMsg  = msg => printErrnl(_$(msg).default(_msg))
const _clearTmpMsg = msg => printErrnl("\r" + " ".repeat(_$(msg).default(_msg).length) + "\r")
