var _inputLineFns = {
    "lines": (r, options) => {
        params.linesjoin = _$(toBoolean(params.linesjoin), "linesjoin").isBoolean().default(false)

        if (!params.linesjoin && isString(r)) {
            if (r.trim().length == 0) {
                noFurtherOutput = true
                return
            }
            if (r.trim().length > 0) {
                r = r.trim().split(/\r?\n/)
            }
            _$o(r, options, true)
            noFurtherOutput = true
        } else {
            return true
        }
    },
    "ndjson": (r, options) => {
        params.ndjsonjoin = _$(toBoolean(params.ndjsonjoin), "ndjsonjoin").isBoolean().default(false)
        
        if (!params.ndjsonjoin) {
            if (isUnDef(global.__ndjsonbuf) && r.length != 0 && r.trim().startsWith("{")) global.__ndjsonbuf = ""
            if (isDef(global.__ndjsonbuf)) {
                if (r.length != 0 && !r.trim().endsWith("}")) { global.__ndjsonbuf += r.trim(); return }
                if (global.__ndjsonbuf.length > 0) { r = global.__ndjsonbuf + r; global.__ndjsonbuf = __ }
            }
            if (r.length == 0 || r.length > 0 && r.trim().substring(0, 1) != "{") { 
                _$o(jsonParse(global.__ndjsonbuf, __, __, true), options, true)
                noFurtherOutput = true
                global.__ndjsonbuf = __
                return 
            }
            _$o(jsonParse(r, __, __, true), options, true)
            noFurtherOutput = true
        } else {
            return true
        }
    },
    "ndslon": (r, options) => {
        params.ndslonjoin = _$(toBoolean(params.ndslonjoin), "ndslonjoin").isBoolean().default(false)
        
        if (!params.ndslonjoin) {
            if (isUnDef(global.__ndslonbuf) && r.length != 0 && r.trim().startsWith("(")) global.__ndslonbuf = ""
            if (isDef(global.__ndslonbuf)) {
                if (r.length != 0 && !r.trim().endsWith(")")) { global.__ndslonbuf += r.trim(); return }
                if (global.__ndslonbuf.length > 0) { r = global.__ndslonbuf + r; global.__ndslonbuf = __ }
            }
            if (r.length == 0 || r.length > 0 && r.trim().substring(0, 1) != "(") { 
                _$o(af.fromSLON(global.__ndslonbuf), options, true)
                noFurtherOutput = true
                global.__ndslonbuf = __
                return 
            }
            _$o(af.fromSLON(String(r)), options, true)
            noFurtherOutput = true
        } else {
            return true
        }
    },
    "dsv": (r, options) => {
        if (isUnDef(params.indsvsep)) params.indsvsep = ","
        if (isUnDef(params.indsvsepre)) params.indsvsepre = __
        if (isUnDef(params.indsvquote)) params.indsvquote = "\""
        if (isUnDef(params.indsvescape)) params.indsvescape = "\\"
        if (isUnDef(params.indsvcomment)) params.indsvcomment = "#"
        if (isUnDef(params.indsvheader)) params.indsvheader = true
        if (isUnDef(params.indsvtrim)) params.indsvtrim = true
        if (isUnDef(params.indsvjoin)) params.indsvjoin = false
        if (isUnDef(params.indsvfields)) params.indsvfields = __
        params.indsvheader = toBoolean(params.indsvheader)
        params.indsvtrim = toBoolean(params.indsvtrim)
        params.indsvjoin = toBoolean(params.indsvjoin)

        if (isString(params.indsvfields)) params.indsvfields = params.indsvfields.trim().split(",").map(f => f.trim())
        if (isDef(params.indsvfields) && !isArray(params.indsvfields)) params.indsvfields = __

        var _dsvmap = rs => {
            var _r = {}
            params.indsvfields.forEach((f, i) => {
                _r[f] = rs[i]
            })
            return _r
        }

        var _dsvproc = rs => {
            if (isUnDef(rs) || rs.length == 0) return __

            if (toBoolean(params.indsvheader)) {
                if (isUnDef(params.indsvfields)) {
                    if (isUnDef(params.indsvsepre)) {
                        params.indsvfields = rs.split(params.indsvsep)
                    } else {
                        params.indsvfields = rs.split(new RegExp(params.indsvsepre))
                    }
                    params.indsvfields = params.indsvfields.map(f => {
                        if (params.indsvtrim) f = f.trim()
                        if (params.indsvquote && f.startsWith(params.indsvquote) && f.endsWith(params.indsvquote)) {
                            f = f.substring(1, f.length - 1)
                        }
                        if (params.indsvescape) {
                            f = f.replace(new RegExp(params.indsvescape + params.indsvquote, "g"), params.indsvquote)
                        }
                        return f
                    })
                    return __
                }
            }

            var _r = {}
            if (isString(rs)) {
                if (isUnDef(params.indsvsepre)) {
                    _r = pForEach(rs.split(params.indsvsep), s => {
                        if (params.indsvtrim) s = s.trim()
                        if (params.indsvquote && s.startsWith(params.indsvquote) && s.endsWith(params.indsvquote)) {
                            s = s.substring(1, s.length - 1)
                        }
                        if (params.indsvescape) {
                            s = s.replace(new RegExp(params.indsvescape + params.indsvquote, "g"), params.indsvquote)
                        }
                        return s
                    })
                } else {
                    _r = pForEach(rs.split(new RegExp(params.indsvsepre)), s => {
                        if (params.indsvtrim) s = s.trim()
                        if (params.indsvquote && s.startsWith(params.indsvquote) && s.endsWith(params.indsvquote)) {
                            s = s.substring(1, s.length - 1)
                        }
                        if (params.indsvescape) {
                            s = s.replace(new RegExp(params.indsvescape + params.indsvquote, "g"), params.indsvquote)
                        }
                        return s
                    })
                }
                return _dsvmap(_r)
            }
        }

        if (!params.indsvjoin) {
            noFurtherOutput = true
            r = String(r)
            if (r.length > 0 && !r.trim().startsWith(params.indsvcomment)) {
                var _rs = _dsvproc(r)
                if (isDef(_rs)) _$o(_rs, options, true)
            }
        } else {
            return true
        }
    }
}