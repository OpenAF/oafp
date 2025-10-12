var _inputFns = new Map([
    ["?"    , (_res, options) => {
        _res = Array.from(_inputFns.keys()).filter(r => r != '?').sort()
        _$o(_res, options)
    }],
    ["pm"   , (_res, options) => { 
        _showTmpMsg()
        if (isDef(__pm._map)) _res = __pm._map
        if (isDef(__pm._list)) _res = __pm._list
        _$o(_res, options) 
    }],
    ["key", (_res, options) => {
        _showTmpMsg()
        if (!isString(_res)) _exit(-1, "key is only supported with a string.")
        _$o($get(_res), options)
    }],
    ["jsonschema", (_res, options) => {
        _showTmpMsg()
        var _s = jsonParse(_res, __, __, true)
        if (!isMap(_s)) _exit(-1, "jsonschema is only supported with a map.")
        ow.loadObj()
        var _d = ow.obj.schemaSampleGenerator(_s)
        _$o(_d, options)
    }],   
    ["yaml" , (_res, options) => {
        _showTmpMsg()
        var _r = af.fromYAML(_res)
        _$o(_r, options)
    }],
    ["xml"  , (_res, options) => {
        _showTmpMsg()
        params.xmlignored = _$(params.xmlignored, "xmlignored").isString().default(__)
        params.xmlprefix = _$(params.xmlprefix, "xmlprefix").isString().default(__)
        params.xmlfiltertag = toBoolean(_$(params.xmlfiltertag, "xmlfiltertag").isString().default(__))
        //if (_res.indexOf("<?xml") >= 0) _res = _res.substring(_res.indexOf("?>") + 2).trim()
        //if (_res.indexOf("<!DOCTYPE") >= 0) _res = _res.substring(_res.indexOf(">") + 1).trim()
        var _r = af.fromXML2Obj(_res, params.xmlignored, params.xmlprefix, !params.xmlfiltertag)
        _$o(_r, options)
    }],
    ["lines", (_res, options) => {
        if (!isBoolean(params.linesjoin)) params.linesjoin = toBoolean(_$(params.linesjoin, "linesjoin").isString().default(__))

        _showTmpMsg()

        let _linesvisual_header = __
        let _linesvisual_header_pos = []

        params.linesvisualheadsep = toBoolean(_$(params.linesvisualheadsep, "linesvisualheadsep").isString().default(__))
        let _headTitles = false
        let _headSep    = false
        if (isUnDef(params.linesvisualsepre)) params.linesvisualsepre = (params.linesvisualheadsep ? "\\s+" : " \\s+")

        let _visualProc = r => {
            // Replace tabs with spaces with the right tab stops
            r = r.split('\n').map(line => {
                let endL = ''
                let c = 0
                for (let i = 0; i < line.length; i++) {
                    if (line[i] === '\t') {
                        let add = 8 - (c % 8)
                        endL += ' '.repeat(add)
                        c += add
                    } else {
                        endL += line[i]
                        c++
                    }
                }
                return endL
            }).join('\n')
            // If the header is not defined, then the first line is the header
            if (!_headTitles || !_headSep) {
                if (!_headTitles) _linesvisual_header = []
                r.split(new RegExp(params.linesvisualsepre)).reduce((lastPos, h) => {
                    if (h.trim().length == 0) return
                    if (!_headTitles) _linesvisual_header.push(h)
                    if ((!params.linesvisualheadsep && !_headTitles) || (_headTitles && params.linesvisualheadsep && !_headSep)) {
                        let _mr = r.substring(lastPos).match(new RegExp(ow.format.escapeRE(h) + "(" + params.linesvisualsepre + "|$)"))
                        if (!isNull(_mr) && isDef(_mr.index)) {
                            _linesvisual_header_pos.push(lastPos + _mr.index)
                            lastPos += _mr[0].length
                        } else {
                            _exit(-1, "Problem with linesvisual to find header positioning.")
                        }
                    }
                    return lastPos
                }, 0)
                if (!_headTitles) {
                    _headTitles = true
                    if (!params.linesvisualheadsep) _headSep = true
                } else if (params.linesvisualheadsep && !_headSep) {
                    _headSep = true
                }
                return __
            } else {
                var _l = {}
                _linesvisual_header_pos.forEach((p, i) => {
                    _l[_linesvisual_header[i]] = r.substring(p, (i + 1 < _linesvisual_header_pos.length ? _linesvisual_header_pos[i + 1]-1 : __)).trim()
                })
                return _l
            }
        }

        if (params.linesjoin) {
            if (isDef(params.file) && isUnDef(params.cmd)) {
                _res = io.readFileString(params.file)
            }
            if (isDef(params.cmd)) {
                _res = _runCmd2Bytes(params.cmd, true)
            }
            _res = _res.split(/\r?\n/)

            if (toBoolean(params.linesvisual)) {
                var _newRes = []
                _res.forEach(r => {
                    if (r.length == 0) return
                    var _r = _visualProc(r)
                    if (isDef(_r)) _newRes.push(_r)
                })
                _$o(_newRes, options)
            } else {
                _$o(_res, options)
            }
        } else {
            var _stream
            if (isDef(params.file) && isUnDef(params.cmd)) {
                _stream = io.readFileStream(params.file)
            } else {
                if (isDef(params.cmd)) {
                    _stream = af.fromBytes2InputStream(_runCmd2Bytes(params.cmd))
                } else {
                    _stream = af.fromString2InputStream(_res)
                }
            }

            var _p = _parInit()
            ioStreamReadLines(_stream, r => {
                _parExec(_p, () => {
                    // If linesvisual=true then the first line is the header and the space position of
                    // each header title determines the column position for the remaining lines

                    if (toBoolean(params.linesvisual)) {
                        var _r = _visualProc(r)
                        if (isDef(_r)) _$o(_r, clone(options), true)
                    } else {
                        _$o(r, clone(options), true)
                    }
                })
                _p = _parCheck(_p)
            })
            _parDone(_p)
            _stream.close()
        }
    }],
    ["ndjson", (_res, options) => {
        if (!isBoolean(params.ndjsonjoin)) params.ndjsonjoin = toBoolean(_$(params.ndjsonjoin, "ndjsonjoin").isString().default(__))

        _showTmpMsg()
        global.__ndjsonbuf = __, noOut = true
        var _ndjline = (r, fn) => {
            if (isUnDef(global.__ndjsonbuf) && r.length != 0 && r.trim().startsWith("{")) global.__ndjsonbuf = ""
            if (isDef(global.__ndjsonbuf)) {
                if (r.length != 0 && !r.trim().endsWith("}")) { global.__ndjsonbuf += r.trim(); return }
                if (global.__ndjsonbuf.length > 0) { r = global.__ndjsonbuf + r; global.__ndjsonbuf = __ }
            }
            if (r.length == 0 || r.length > 0 && r.trim().substring(0, 1) != "{") { 
                noOut = false
                fn(r)
                global.__ndjsonbuf = __
                return 
            }
            if (r.trim().length > 0) {
                noOut = false
                fn(r)
            }
        }
        var _ndjproc = res => {
            var _j = []
            res.split("\n").filter(l => l.length > 0).forEach(r => _ndjline(r, r => _j.push(jsonParse(r, __, __, toBoolean(params.ndjsonfilter)))))
            return _j
        }

        if (params.ndjsonjoin) {
            if (isDef(params.file) && isUnDef(params.cmd)) {
                _res = io.readFileString(params.file)
            }
            if (isDef(params.cmd)) {
                _res = _runCmd2Bytes(params.cmd, true)
            }

            _$o(_ndjproc(_res), options)
        } else {
            var _stream
            if (isDef(params.file) && isUnDef(params.cmd)) {
                _stream = io.readFileStream(params.file)
            } else {
                if (isDef(params.cmd)) {
                    _stream = af.fromBytes2InputStream(_runCmd2Bytes(params.cmd))
                } else {
                    _stream = af.fromString2InputStream(_res)
                }
            }

            var _p = _parInit()
            ioStreamReadLines(_stream, r => {
                _parExec(_p, () => _ndjline(r, line => _$o(jsonParse(line, __, __, true), clone(options), true) ) )
                _p = _parCheck(_p)
            })
            _parDone(_p)
            _stream.close()
        }
        if (noOut) _clearTmpMsg()
    }],
    ["ndslon", (_res, options) => {
        if (!isBoolean(params.ndslonjoin)) params.ndslonjoin = toBoolean(_$(params.ndslonjoin, "ndslonjoin").isString().default(__))

        _showTmpMsg()
        global.__ndslonbuf = __, noOut = true
        var _ndslonline = (r, fn) => {
            if (isUnDef(global.__ndslonbuf) && r.length != 0 && r.trim().startsWith("(")) global.__ndslonbuf = ""
            if (isDef(global.__ndslonbuf)) {
                if (r.length != 0 && !r.trim().endsWith(")")) { global.__ndslonbuf += r.trim(); return }
                if (global.__ndslonbuf.length > 0) { r = global.__ndslonbuf + r; global.__ndslonbuf = __ }
            }
            if (r.length == 0 || r.length > 0 && r.trim().substring(0, 1) != "(") { 
                noOut = false
                fn(r)
                global.__ndslonbuf = __
                return 
            }
            if (r.trim().length > 0) {
                noOut = false
                fn(r)
            }
        }
        var _ndslonproc = res => {
            var _j = []
            res.split("\n").filter(l => l.length > 0).forEach(r => _ndslonline(r, r => _j.push(af.fromSLON(r))))
            return _j
        }

        if (params.ndslonjoin) {
            if (isDef(params.file) && isUnDef(params.cmd)) {
                _res = io.readFileString(params.file)
            }
            if (isDef(params.cmd)) {
                _res = _runCmd2Bytes(params.cmd, true)
            }

            _$o(_ndslonproc(_res), options)
        } else {
            var _stream
            if (isDef(params.file) && isUnDef(params.cmd)) {
                _stream = io.readFileStream(params.file)
            } else {
                if (isDef(params.cmd)) {
                    _stream = af.fromBytes2InputStream(_runCmd2Bytes(params.cmd))
                } else {
                    _stream = af.fromString2InputStream(_res)
                }
            }

            var _p = _parInit()
            ioStreamReadLines(_stream, r => {
                _parExec(_p, () => _ndslonline(r, line => _$o(af.fromSLON(line), clone(options), true) ) )
                _p = _parCheck(_p)
            })
            _parDone(_p)
            _stream.close()
        }
        if (noOut) _clearTmpMsg()
    }],
    ["dsv", (_res, options) => {
        _showTmpMsg()
        if (isUnDef(params.indsvsep)) params.indsvsep = ","
        if (isUnDef(params.indsvsepre)) params.indsvsepre = __
        if (isUnDef(params.indsvquote)) params.indsvquote = "\""
        if (isUnDef(params.indsvescape)) params.indsvescape = "\\"
        if (isUnDef(params.indsvcomment)) params.indsvcomment = "#"
        if (isUnDef(params.indsvheader)) params.indsvheader = true
        if (isUnDef(params.indsvtrim)) params.indsvtrim = true
        if (isUnDef(params.indsvjoin)) params.indsvjoin = false
        if (isUnDef(params.indsvfields)) params.indsvfields = __

        if (isString(params.indsvfields)) params.indsvfields = params.indsvfields.trim().split(",").map(f => f.trim())
        if (isDef(params.indsvfields) && !isArray(params.indsvfields)) params.indsvfields = __
        var _dsvmap = r => {
            var _r = {}
            params.indsvfields.forEach((f, i) => {
                _r[f] = r[i]
            })
            return _r
        }

        var _dsvproc = r => {
            if (isUnDef(r) || r.length == 0) return {}

            if (toBoolean(params.indsvheader)) {
                if (isUnDef(params.indsvfields)) {
                    if (isUnDef(params.indsvsepre)) {
                        params.indsvfields = r.trim().split(params.indsvsep)
                    } else {
                        params.indsvfields = r.trim().split(new RegExp(params.indsvsepre))
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
            if (isString(r)) {
                if (isUnDef(params.indsvsepre)) {
                    _r = pForEach(r.split(params.indsvsep), s => {
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
                    _r = pForEach(r.split(new RegExp(params.indsvsepre)), s => {
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
                
        var noOut = true
        if (params.indsvjoin) {
            if (isDef(params.file) && isUnDef(params.cmd)) {
                _res = io.readFileString(params.file)
            }
            if (isDef(params.cmd)) {
                _res = _runCmd2Bytes(params.cmd, true)
            }

            _$o( _res.split(/\r?\n/).map(r => {
                if (isUnDef(r) || r.length == 0) return __
                if (r.trim().startsWith(params.indsvcomment)) return __
                return _dsvproc(r)
            }).filter(r => isDef(r)), options)
        } else {
            var _stream
            if (isDef(params.file) && isUnDef(params.cmd)) {
                _stream = io.readFileStream(params.file)
            } else {
                if (isDef(params.cmd)) {
                    _stream = af.fromBytes2InputStream(_runCmd2Bytes(params.cmd))
                } else {
                    _stream = af.fromString2InputStream(_res)
                }
            }

            var _p = _parInit()
            ioStreamReadLines(_stream, r => {
                if (isUnDef(r) || r.length == 0) return
                if (r.trim().startsWith(params.indsvcomment)) return
                _parExec(_p, () => {
                    if (isString(r)) {
                        var _dsv = _dsvproc(r)
                        if (isDef(_dsv)) _$o(_dsv, clone(options), true)
                    }
                    return true
                })
                _p = _parCheck(_p)
                return false
            })
            _parDone(_p)
            _stream.close()
        }
        if (noOut) _clearTmpMsg()
    }],
    ["md", (_res, options) => {
        _showTmpMsg()
        __ansiColorFlag = true
        __conConsole = true
        //print(ow.format.withMD(_res))
        if (isUnDef(params.format) && isUnDef(options.__format)) {
            params.format = "md"
            options.__format = "md"
        }
        _$o(_res, options)
    }],
    ["mdtable", (_res, options) => {
        _showTmpMsg()
        ow.loadTemplate()

        if (toBoolean(params.inmdtablejoin)) {
            var _d = new Set(), _s = new Set()
            // match all multiline markdown tables
            var fnProc = () => {
                if (_s.size > 0) {
                    _d.add(ow.template.md.fromTable(Array.from(_s).join("\n")))
                    _s.clear()
                }
            }
            _res.split("\n").forEach(l => {
                if (/^\|.+\|$/.test(l.trim())) {
                    _s.add(l.trim())
                } else {
                    fnProc()
                }
            })
            fnProc()
            _$o(Array.from(_d), options)
        } else {
            var _s = ow.template.md.fromTable(_res)
            _$o(_s, options)
        }
    }],
    ["mdcode", (_res, options) => {
        _showTmpMsg()
        
        var _d = []
        var lines = _res.split("\n")
        var inCodeBlock = false
        var currentBlock = { language: "", code: [], startLine: -1, endLine: -1 }
        
        lines.forEach((line, index) => {
            var oneLineCodeBlock = line.trim().match(/^```+[^`]+```+$/)
            var codeBlockMatch = line.trim().match(/^```+(.+)?$/)
            var endBlockMatch = inCodeBlock && (line.trim().match(/^```+$/) || line.trim().match(/[^`]```+$/))

            if (oneLineCodeBlock) {
                inCodeBlock = false
                currentBlock = {
                    language : __,
                    code     : line.replace(/^```+/, "").replace(/```+$/, "").trim(),
                    startLine: index + 1,
                    endLine  : index + 1
                }
                _d.push(currentBlock)
                return
            }

            if (codeBlockMatch && !inCodeBlock) {
                // Start of code block
                inCodeBlock = true
                currentBlock = {
                    language : codeBlockMatch[1],
                    code     : [],
                    startLine: index + 1,
                    endLine  : -1
                }
            } else if (endBlockMatch && inCodeBlock) {
                // End of code block
                inCodeBlock = false
                currentBlock.endLine = index + 1
                currentBlock.code = currentBlock.code.join("\n")
                _d.push(currentBlock)
                currentBlock = { language: "", code: [], startLine: -1, endLine: -1 }
            } else if (inCodeBlock) {
                // Inside code block
                currentBlock.code.push(line)
            }
        })
        
        // Handle unclosed code block
        if (inCodeBlock) {
            currentBlock.endLine = lines.length
            currentBlock.code = currentBlock.code.join("\n")
            _d.push(currentBlock)
        }
        
        _$o(_d, options)

    }],
    ["ask", (_res, options) => {
        var _d = []
        _res = _fromJSSLON(_res)
        if (isDef(askStruct) && isArray(_res)) {
            __conConsole = true
            __con.getTerminal().settings.set("-icanon min 1 -echo")
            _d = askStruct(_res)
            __con.getTerminal().settings.set("icanon echo")
            print("")
        }
        _$o(_d, options)
    }],
    ["raw", (_res, options) => {
        _showTmpMsg()
        _$o(_res, options)
    }],
    ["ini", (r, options) => {
        _showTmpMsg()
        ow.loadJava()
        var ini = new ow.java.ini(), _r
        if (isDef(params.file)) {
            _r = ini.loadFile(params.file).get()
        } else {
            _r = ini.load(r).get()
        }
        _$o(_r, options)
    }],
    ["jwt", (r, options) => {
        ow.loadServer()
        var _r, verify
        if (toBoolean(params.injwtverify)) {
            if (isUnDef(params.injwtsecret) && isUnDef(params.injwtpubkey)) _exit(-1, "injwtsecret or injwtpubkey is not defined.")
            try {
                if (isDef(params.injwtpubkey)) {
                    ow.loadJava()
                    var c = new ow.java.cipher()
                    _r = ow.server.jwt.verify(c.readKey4File(params.injwtpubkey, false, params.injwtalg), r.trim())
                } else {
                    ow.server.jwt.verify(params.injwtsecret, r.trim())
                }
                verify = true
            } catch(e) {
                if (isDef(e.javaException)) printErr(e.javaException.getMessage())
                verify = false
            }
        } 

        _r = ow.server.jwt.decode(r)
        if (isDef(verify)) _r.__verified = verify
        if (!toBoolean(params.injwtraw) && isDef(_r) && isMap(_r.claims)) {
            if (isDef(_r.claims.exp)) _r.claims.exp = new Date(_r.claims.exp * 1000)
            if (isDef(_r.claims.iat)) _r.claims.iat = new Date(_r.claims.iat * 1000)
            if (isDef(_r.claims.nbf)) _r.claims.nbf = new Date(_r.claims.nbf * 1000)
            
        }
        _$o(_r, options)
    }],
    ["sql", (r, options) => {
        if (isString(r)) {
            if (toBoolean(params.sqlparse)) {
                if (isUnDef(ow.format.sqlFormat)) _exit(-1, "SQL parse not available.")
                _$o(ow.format.sqlFormat(r, isDef(params.sqloptions) ? _fromJSSLON(params.sqloptions) : __), options)
            } else {
                _$o(af.fromSQL(r).ast, options)
            }
        } else {
            _$o(r, options)
        }
    }],
    ["openmetrics", (r, options) => {
        if (isString(r)) {
            ow.loadMetrics()
            _$o(ow.metrics.fromOpenMetrics2Array(r), options)
        } else {
            _$o(r, options)
        }
    }],
    ["ch", (r, options) => {
        _showTmpMsg()
        if (isUnDef(params.inch)) _exit(-1, "inch is not defined.")
        params.inch = _fromJSSLON(params.inch)
        if (isMap(params.inch)) {
            if (isUnDef(params.inch.type)) _exit(-1, "inch.type is not defined.")
            if (isDef(params.inch.lib)) loadLib(params.inch.lib)
            if (params.inch.type == "remote") {
                $ch("oafp::indata").createRemote(params.inch.url)
            } else {
                $ch("oafp::indata").create(params.inch.type, isDef($sec().procMap) ? $sec().procMap(params.inch.options) : params.inch.options) 
            }

            var _r = _fromJSSLON(r, true)
            if (toBoolean(params.inchall) || r.trim().length == 0) {
                _$o($ch("oafp::indata").getAll(isMap(_r) ? _r : __), options)
            } else {
                _$o($ch("oafp::indata").get(isMap(_r) ? _r : __), options)
            }
            $ch("oafp::indata").destroy()
        } else {
            _exit(-1, "inch is not a valid map.")
        }
    }],
    ["db", (r, options) => {
        if (isString(r)) {
            _showTmpMsg()
            if (!isString(params.indbjdbc)) _exit(-1, "indbjdbc URL is not defined.")
            var _db
            try {
                if (isDef(params.indblib)) loadLib("jdbc-" + params.indblib + ".js")
                _db = new DB(params.indbjdbc, params.indbuser, params.indbpass, params.indbtimeout)
                _db.convertDates(true)
                if (toBoolean(params.indbautocommit)) _db.setAutoCommit(true)
                if (toBoolean(params.indbexec)) {
                    var _r = _db.u(r)
                    _$o({ affectedRows: _r }, options)
                    _db.commit()
                } else {
                    if (toBoolean(params.indbstream)) {
                        var _rs = _db.qsRS(r)
                        try {
                            while(_rs.next()) {
                                var _r = {}
                                for (var i = 1; i <= _rs.getMetaData().getColumnCount(); i++) {
                                    var _v = _rs.getObject(i)
                                    switch(_rs.getMetaData().getColumnType(i)) {
                                    case java.sql.Types.BIGINT:
                                    case java.sql.Types.INTEGER:
                                    case java.sql.Types.TINYINT:
                                    case java.sql.Types.SMALLINT:
                                    case java.sql.Types.NUMERIC:
                                        _v = Number(_v)
                                        break
                                    case java.sql.Types.DOUBLE:
                                    case java.sql.Types.FLOAT:
                                    case java.sql.Types.REAL:
                                    case java.sql.Types.DECIMAL:
                                        _v = Number(_v)
                                        break
                                    case java.sql.Types.BOOLEAN:
                                        _v = Boolean(_v)
                                        break
                                    case java.sql.Types.TIME:
                                    case java.sql.Types.DATE:
                                    case java.sql.Types.TIMESTAMP:
                                        _v = new Date(_v.getTime())
                                        break
                                    case java.sql.Types.NULL:
                                        _v = null
                                        break
                                    default:
                                        _v = String(_v)
                                    }
                                    _r[_rs.getMetaData().getColumnName(i)] = _v
                                }
                                _$o(_r, options)
                            }
                        } catch(e) {
                            _exit(-1, "Error streaming SQL: " + e.message)
                        } finally {
                            _db.closeStatement(r)
                            _rs.close()
                        }
                    } else {
                        if (toBoolean(params.indbdesc)) {
                            var _r = _db.qsRS(r)
                            var _o = []
                            try {
                                for(let i = 1; i <= _r.getMetaData().getColumnCount(); i++) {
                                    _o.push({
                                        name: _r.getMetaData().getColumnName(i),
                                        type: _r.getMetaData().getColumnTypeName(i),
                                        size: _r.getMetaData().getColumnDisplaySize(i),
                                        nullable: _r.getMetaData().isNullable(i) == 1,
                                        autoIncrement: _r.getMetaData().isAutoIncrement(i),
                                        precision: _r.getMetaData().getPrecision(i),
                                        scale: _r.getMetaData().getScale(i),
                                        table: _r.getMetaData().getTableName(i),
                                        schema: _r.getMetaData().getSchemaName(i),
                                        catalog: _r.getMetaData().getCatalogName(i),
                                        columnType: _r.getMetaData().getColumnType(i)
                                    })
                                }
                                _$o(_o, options)
                            } catch(e) {
                                _exit(-1, "Error getting SQL description: " + e.message)
                            } finally {
                                _db.closeStatement(r)
                                _r.close()
                            }

                        } else {
                            var _r = _db.q(r)
                            if (isMap(_r) && isArray(_r.results)) {
                                _$o(_r.results, options)
                            } else {
                                _exit(-1, "Invalid DB result: " + stringify(_r))
                            }
                        }
                    }
                }
            } catch(edb) {
                printErr(edb.message)
                if (isDef(_db)) _db.rollback()
                _exit(-1, "Error executing SQL: " + edb.message)
            } finally {
                if (isDef(_db)) {
                    _db.rollback()
                    _db.close()
                }
            }
        } else {
            _exit(-1, "db is only supported with a SQL string.")
        }
    }],
    ["minia", (_res, options) => {
        params.minianolog = toBoolean( _$(params.minianolog, "minianolog").isString().default(false) )
        if (params.minianolog) _showTmpMsg()
        try {
            includeOPack("mini-a")
        } catch(e) {
            _exit(-1, "mini-a not found. You need to install it to use the mini-a output (opack install mini-a)")
        }

        loadLib("mini-a.js")
        var _r = _fromJSSLON(_res, true)
        if (!isMap(_r) && !isArray(_r)) _exit(-1, "mini-a is only supported with a map or array input.")
        
        var ma = new MiniA()

        if (isUnDef(_r.__format)) _r.__format = "json"
        if (isDef(_r.goal) && _r.__format == "json") _r.goal += "; answer in json"
        _r.shellbatch = true

        ma.setInteractionFn((e, m) => { 
            ma.defaultInteractionFn(e, m, (_e, _m, _i) => {
                if (!params.minianolog) printErr(_e + "  " + ansiColor("FAINT,ITALIC", _m))
                if (isDef(params.minialogfile)) io.writeFileString(params.minialogfile, `${ow.format.fromDate(new Date(), "yyyy-MM-dd HH:mm:ss.SSS")} | INFO | ${_i} | ${_e} | ${_m}\n`, __, true)
            })
        })
        ma.init(_r)
        var _res = ma.start(_r)
        var __r = _fromJSSLON(_res, true)
        if (isDef(params.miniametrics)) io.writeFileJSON($t(params.miniametrics, { id: ma.getId() }), ma.getMetrics(), "")
        _$o(isObject(__r) ? __r : _res, options)
    }],
    ["xls", (_res, options) => {
        _showTmpMsg()
        try {
            includeOPack("plugin-XLS")
        } catch(e) {
            _exit(-1, "plugin-XLS not found. You need to install it to use the XLS output (opack install plugin-XLS)")
        }
        
        plugin("XLS")
        let _xlsdss = false, _xlsds = false
        params.inxlsdesc = toBoolean( _$(params.inxlsdesc, "inxlsdesc").isString().default(false) )
        if (params.inxlsdesc) {
            if (isUnDef(params.inxlssheet)) {
                _xlsds = true
            } else {
                _xlsdss = true
            }
        }

        params.inxlssheet        = _$(params.inxlssheet || params.xlssheet, "xlssheet").isString().default(0)
        params.inxlsevalformulas = toBoolean(_$(params.inxlsevalformulas || params.xlsevalformulas, "xlsevalformulas").isString().default(true))
        params.inxlscol          = _$(params.inxlscol || params.xlscol, "xlscol").isString().default("A")
        params.inxlsrow          = _$(params.inxlsrow || params.xlsrow, "xlsrow").isString().default(1)

        if (isDef(params.file) || isDef(params.cmd)) {
            var xls = new XLS(isDef(params.cmd) ? _runCmd2Bytes(params.cmd) : params.file)

            if (_xlsds) {
                _r = xls.getSheetNames()
            } else {
                var sheet = xls.getSheet(params.inxlssheet)
                if (_xlsdss) {
                    var _vls = xls.getCellValues(sheet, false)
                    var cols = []
                    Object.keys(_vls).forEach(r => {
                        var _c = Object.keys(_vls[r])
                        if (_c.length > cols.length) cols = _c
                    })

                    _r = []
                    var _rr = Object.keys(_vls).map(r => {
                        var __r = { " ": r }
                        cols.forEach(_c => __r[_c] = isNull(_vls[r][_c]) || _vls[r][_c].type == "BLANK" ? "___" : "###" )
                        _r.push(__r)
                    })

                    if (isUnDef(params.format) && isUnDef(options.__format)) {
                        params.format = "ctable"
                        options.__format = "ctable"
                    }
                } else {
                    var _r = xls.getTable(sheet, params.inxlsevalformulas, params.inxlscol, params.inxlsrow)
                    if (isDef(_r) && isMap(_r)) _r = _r.table
                }
            }
            xls.close()

            _$o(_r, options)
        } else {

            _exit(-1, "XLS is only support with 'file' or 'cmd' defined. Please provide a file=... or a cmd=...")
        }
    }],
    ["csv", (_res, options) => {
        var _r
        _showTmpMsg()
        if (isUnDef(params.inputcsv) && isDef(params.incsv)) params.inputcsv = params.incsv
        if (isDef(params.file) || isDef(params.cmd)) {
            var is = isDef(params.cmd) ? af.fromBytes2InputStream(_runCmd2Bytes(params.cmd)) : io.readFileStream(params.file)
            _r = $csv(params.inputcsv).fromInStream(is).toOutArray()
            is.close()
        } else {
            _r = $csv(params.inputcsv).fromInString( _res ).toOutArray()
        }
        _$o(_r, options)
    }],
    ["javathread", (_res, options) => {
        var lines
        _showTmpMsg()
        if (isDef(params.javathreadpid)) {
            ow.loadJava()
            try {
                lines = ow.java.jcmd(params.javathreadpid, "Thread.print")
                lines = lines.split("\n").filter(l => l.startsWith("\""))
            } catch(e) {
                _exit(-1, "Error getting Java thread dump: " + e.message)
            }
        } else {
            if (isString(_res)) {
                lines = _res.split("\n")
            } else {
                _exit(-1, "javathreads is only supported with a raw input or javathreadpid=.")
            }
        }

        // TODO: remove after OpenAF stable > 20240212
        var fnFromTimeAbbr = aStr => {	
            _$(aStr, "aStr").isString().$_()

            var ars = aStr.trim().match(/[\d\.]+[a-zA-Z]+/g), res = 0;
            if (!isArray(ars) || ars.length === 0) return parseFloat(aStr);
            for (var i in ars) {
                var ar = ars[i].match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
                if (isArray(ar) && ar.length > 0) {
                    var v = Number(ar[1])
                    var u = String(ar[2])
        
                    var _u = {
                        "ms": 1,
                        "s": 1000,
                        "m": 60 * 1000,
                        "h": 60 * 60 * 1000,
                        "d": 24 * 60 * 60 * 1000,
                        "w": 7 * 24 * 60 * 60 * 1000,
                        "M": 30 * 24 * 60 * 60 * 1000,
                        "y": 365 * 24 * 60 * 60 * 1000
                    }
                    if (isDef(_u[u])) {
                        res += v * _u[u]
                    } else {
                        res += v
                    }
                }
            }
        
            return res
        }

        var fnJavaTrans = (v, tA) => {
            if (v === null) return ""
            if (v === undefined) return ""
            if (isBoolean(v)) return Boolean(v)
            if (isNumber(v)) return Number(v)
            if (tA) return fnFromTimeAbbr(String(v))
            return String(v)
        }

        var _r = []
        lines.forEach(line => {
            if (line.startsWith("\"")) {
                var pt = java.util.regex.Pattern.compile("^\\\"(?<threadName>[^\"]+)\\\"" +
                            "(?:\\s+#(?<threadId>\\d+))?" +
                            "(?:\\s+\\[(?<threadIndex>\\d+)\\])?" +
                            "(?:\\s+(?<daemon>daemon))?" +
                            "(?:\\s+prio=(?<prio>\\d+))?" +
                            "\\s+os_prio=(?<osPrio>\\d+)" +
                            "(?:\\s+cpu=(?<cpu>[0-9.]+ms))?" +
                            "(?:\\s+elapsed=(?<elapsed>[0-9.]+s))?" +
                            "(?:\\s+tid=(?<tid>0x[a-fA-F0-9]+))?" +
                            "(?:\\s+nid=(?<nid>0x[a-fA-F0-9]+|\\d+|\\S+))?" +
                            "(?:\\s+(?<state>.*?))?" +
                            "(?:\\s+\\[(?<address>[^\\]]+)\\])?" +
                            "\\s*$")

                var mt = pt.matcher(line)
                if (mt.find()) {
                    var m = {
                        threadGroup: fnJavaTrans(mt.group("threadName")).replace(/[^a-zA-z]?\d+$/, ""),
                        threadName : fnJavaTrans(mt.group("threadName")),
                        threadId   : fnJavaTrans(mt.group("threadId")),  
                        threadIndex: fnJavaTrans(mt.group("threadIndex")), 
                        daemon     : fnJavaTrans(mt.group("daemon")),
                        prio       : fnJavaTrans(mt.group("prio")),
                        osPrio     : fnJavaTrans(mt.group("osPrio")),    
                        cpu_ms     : fnJavaTrans(mt.group("cpu"), true),
                        elapsed_ms : fnJavaTrans(mt.group("elapsed"), true),  
                        tid        : fnJavaTrans(mt.group("tid")),         
                        nid        : fnJavaTrans(mt.group("nid")),         
                        state      : fnJavaTrans(mt.group("state")),       
                        address    : fnJavaTrans(mt.group("address"))
                    }
                    _r.push(m)
                } else {
                    _r.push({ error: "Could not parse line: " + line })
                }
            }
        })
        _$o(_r, options)
    }],
    ["javagc", (_res, options) => {
        if (!isBoolean(params.javagcjoin)) params.javagcjoin = toBoolean(_$(params.javagcjoin, "javagcjoin").isString().default(__))

        // Pre-compile regex patterns for performance (moved outside hot path)
        const regexes = [
            // JDK 8 Allocation Failure (adjusted to handle multiline events)
            /([^ ]+) (\d+\.\d+): \[(GC) \((.*?)\)(.+?)\[PSYoungGen: (\d+K)->(\d+K)\((.*?)\)\] (\d+K)->(\d+K)\((.*?)\), (\d+\.\d+) secs\] \[Times: user=(\d+\.\d+) sys=(\d+\.\d+), real=(\d+\.\d+) secs\]/s,
            // JDK 8 style regexes
            /([^ ]+) (\d+\.\d+): \[(GC) \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\((.*?)\)\] (\d+K)->(\d+K)\((.*?)\), (\d+\.\d+) secs\]/,
            // JDK 8 with +PrintHeapAtGC
            /([^ ]+) (\d+\.\d+): \[(Full GC) \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\((.*?)\)\] \[ParOldGen: (\d+K)->(\d+K)\((.*?)\)\] (\d+K)->(\d+K)\((.*?)\), \[Metaspace: (\d+K)->(\d+K)\((.*?)\)\], (\d+\.\d+) secs\] \[Times: user=(\d+\.\d+) sys=(\d+\.\d+), real=(\d+\.\d+) secs\]/,
            // JDK 8 with +PrintHeapAtGC and +PrintTenuringDistribution
            /([^ ]+) (\d+\.\d+): \[(Full GC) \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\((.*?)\)\] \[ParOldGen: (\d+K)->(\d+K)\((.*?)\)\] (\d+K)->(\d+K)\((.*?)\), \[Metaspace: (\d+K)->(\d+K)\((.*?)\)\], (\d+\.\d+) secs\]/,
            // JDK 8 with +PrintTenuringDistribution
            /([^ ]+) (\d+\.\d+): \[(GC) \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\((.*?)\)\] (\d+K)->(\d+K)\((.*?)\), (\d+\.\d+) secs\] \[Times: user=(\d+\.\d+) sys=(\d+\.\d+), real=(\d+\.\d+) secs\]/,
            // JDK 8 Generic GC logs (simple format)
            /(\d+\.\d+): \[(GC|Full GC) \((.*?)\)\s+(\d+K)->(\d+K)\((\d+K)\), (\d+\.\d+) secs\]/,
            // JDK 9+ style regexes
            /^\[(.+)\]\s+GC\((\d+)\)\s*(.*?)\s*(\d+[GMK])->(\d+[GMK])\((\d+[GMK])\)\s*(\d+\.\d+)ms/,
            /^\[(.+)\]\s+GC\((\d+)\)\s*(.*?)\s*Metaspace:\s*(\d+[GMK])\((\d+[GMK])\)->(\d+[GMK])\((\d+[GMK])\)\s*NonClass:\s*(\d+[GMK])\((\d+[GMK])\)->(\d+[GMK])\((\d+[GMK])\)\s*Class:\s*(\d+[GMK])\((\d+[GMK])\)->(\d+[GMK])\((\d+[GMK])\)/,
            // JDK 9+ Allocation Failure
            /^\[(.+)\]\s+GC\((\d+)\)\s*(Allocation Failure)\s*(.*?)\s+(\d+[KMGT])->(\d+[KMGT])\((\d+[KMGT])\)\s+(\d+\.\d+)ms/,
        ]

        // Pre-compile patterns for head parsing
        const timePattern = /^\d+\.\d+s$/
        const timestampPattern = /\d{4}-\d{2}-\d{2}T/

        // Helper function to avoid repeated string concatenation
        const fromBytesAbbr = val => isDef(val) ? ow.format.fromBytesAbbreviation(val + "B") : __

        let _procLine = _event => {
            try {

                for (let index = 0; index < regexes.length; index++) {
                    let match = _event.match(regexes[index])
                    if (match) {
                        let result = {}

                        if (_event.charCodeAt(0) === 91) { // '[' char - faster than startsWith
                            // JDK 9+ style parsing
                            var heads = match[1].split("][")
                            for (let i = 0; i < heads.length; i++) {
                                let head = heads[i]
                                if (timePattern.test(head)) {
                                    result.sinceStart = parseFloat(head.slice(0, -1)) // faster than replace
                                } else if (timestampPattern.test(head)) {
                                    result.timestamp = ow.format.toDate(head, "yyyy-MM-dd'T'HH:mm:ss.SSSZ")
                                }
                            }
                            result.gcId = parseInt(match[2])
                            result.gcType = match[3].trim() || "none"
                            result.durationSecs = parseFloat(match[match.length - 1]) / 1000 // convert ms to secs

                            if (index === 5) {
                                // Match for GC pause with heap info
                                result.heapBeforeGC = fromBytesAbbr(match[4])
                                result.heapAfterGC = fromBytesAbbr(match[5])
                                result.heapTotal = fromBytesAbbr(match[6])
                            } else if (index > 5) {
                                if (index == 6) {
                                    result.metaUsedBeforeGC = fromBytesAbbr(match[4])
                                    result.metaTotalBeforeGC = fromBytesAbbr(match[5])
                                    result.metaUsedAfterGC = fromBytesAbbr(match[6])
                                    result.metaTotalAfterGC = fromBytesAbbr(match[7])
                                    result.nonClassUsedBeforeGC = fromBytesAbbr(match[8])
                                    result.nonClassTotalBeforeGC = fromBytesAbbr(match[9])
                                    result.nonClassUsedAfterGC = fromBytesAbbr(match[10])
                                    result.nonClassTotalAfterGC = fromBytesAbbr(match[11])
                                    result.classUsedBeforeGC = fromBytesAbbr(match[12])
                                    result.classTotalBeforeGC = fromBytesAbbr(match[13])
                                    result.classUsedAfterGC = fromBytesAbbr(match[14])
                                    result.classTotalAfterGC = fromBytesAbbr(match[15])
                                } else {
                                    result.heapBeforeGC = fromBytesAbbr(match[4])
                                    result.heapAfterGC = fromBytesAbbr(match[5])
                                    result.heapTotal = fromBytesAbbr(match[6])
                                }
                            }
                        } else {
                            // JDK 8 style parsing
                            if (index == 5) {
                                // JDK 8 Generic GC logs (simple format)
                                result.sinceStart = parseFloat(match[1])
                                result.gcType = match[2] + " " + match[3]
                                result.heapBeforeGC = fromBytesAbbr(match[4])
                                result.heapAfterGC = fromBytesAbbr(match[5])
                                result.heapTotal = fromBytesAbbr(match[6])
                                result.durationSecs = parseFloat(match[7])
                            } else {
                                result.timestamp = ow.format.toDate(match[1], "yyyy-MM-dd'T'HH:mm:ss.SSSZ")
                                result.sinceStart = parseFloat(match[2])
                                result.gcType = match[3] + " " + match[4]

                                if (index <= 4) {
                                    let idx = 5
                                    result.PSYoungGenBeforeGC = fromBytesAbbr(match[idx++])
                                    result.PSYoungGenAfterGC = fromBytesAbbr(match[idx++])
                                    result.PSYoungGenTotal = fromBytesAbbr(match[idx++])

                                    if (index == 2 || index == 3) {
                                        result.ParOldGenBeforeGC = fromBytesAbbr(match[idx++])
                                        result.ParOldGenAfterGC = fromBytesAbbr(match[idx++])
                                        result.ParOldGenTotal = fromBytesAbbr(match[idx++])
                                    }

                                    result.heapBeforeGC = fromBytesAbbr(match[idx++])
                                    result.heapAfterGC = fromBytesAbbr(match[idx++])
                                    result.heapTotal = fromBytesAbbr(match[idx++])

                                    if (index == 2 || index == 3) {
                                        result.metaBeforeGC = fromBytesAbbr(match[idx++])
                                        result.metaAfterGC = fromBytesAbbr(match[idx++])
                                        result.metaTotal = fromBytesAbbr(match[idx++])
                                    }

                                    result.durationSecs = parseFloat(match[idx++])

                                    if (index == 0 || index == 2 || index == 4) {
                                        result.userTime = parseFloat(match[idx++])
                                        result.sysTime = parseFloat(match[idx++])
                                        result.realTime = parseFloat(match[idx++])
                                    }
                                }
                            }
                        }
                        return result
                    }
                }
            } catch (e) {
                printErr(e)
                _exit(-2, "Error parsing Java GC log: " + e)
            }
        }

        _showTmpMsg()
        if (isString(_res)) {
            let lines = _res.split("\n")
            let gcStartPattern = /^(\[?\d+|\d{4}-\d{2}-\d{2}T)/ // Matches lines starting with '[\d+' or a timestamp

            let gcEvents = []
            let currentEvent = ""
            let hasCurrentEvent = false

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i]
                if (gcStartPattern.test(line)) {
                    // New GC event detected
                    if (hasCurrentEvent) {
                        gcEvents.push(currentEvent)
                    }
                    currentEvent = line
                    hasCurrentEvent = true
                } else {
                    // Continuation of the current GC event
                    if (hasCurrentEvent) {
                        currentEvent += "\n" + line
                    }
                }
            }
            // Add the last GC event
            if (hasCurrentEvent) {
                gcEvents.push(currentEvent)
            }

            // Process events and filter valid results in one pass
            let results = []
            for (let i = 0; i < gcEvents.length; i++) {
                let result = _procLine(gcEvents[i])
                if (isMap(result)) {
                    results.push(result)
                }
            }

            if (params.javagcjoin) {
                _$o(results, options, true)
            } else {
                for (let i = 0; i < results.length; i++) {
                    _$o(results[i], options, true)
                }
            }
        } else {
            _exit(-1, "javagc is only supported with a string input.")
        }
    }],
    ["hsperf", (_res, options) => {
        if (isDef(params.file) || isDef(params.cmd)) {
            _showTmpMsg()
            ow.loadJava()
            var data = isDef(params.cmd) ? ow.java.parseHSPerf(_runCmd2Bytes(params.cmd)) : ow.java.parseHSPerf(params.file)
            // Enrich data
            data.__ts = new Date()

            var r = { max: 0, total: 0, used: 0, free: 0 }
            data.sun.gc.generation.forEach(gen => {
                gen.space.forEach(space => {
                    r.max   = (r.max < Number(space.maxCapacity)) ? Number(space.maxCapacity) : r.max
                    r.used  = r.used + Number(space.used)
                    r.total = isNumber(space.capacity) ? r.total + Number(space.capacity) : r.total
                    data.sun.gc["__percUsed_" + space.name] = (100 * space.used) / space.capacity
                })
            })
            data.sun.gc.__percUsed_meta = (100 * data.sun.gc.metaspace.used) / data.sun.gc.metaspace.capacity
            data.sun.gc.__percUsed_ccs = (100 * data.sun.gc.compressedclassspace.used) / data.sun.gc.compressedclassspace.capacity

            // Java 8
            var _ygc = $from(data.sun.gc.collector).equals("name", "PSScavenge").at(0)
            data.sun.gc.__ygc = isDef(_ygc) ? Number(_ygc.invocations) : 0
            data.sun.gc.__ygct = isDef(_ygc) ? Number(_ygc.time / 1000000000) : 0
            
            var _fgc = $from(data.sun.gc.collector).equals("name", "PSParallelCompact").orEquals("name", "").at(0)
            data.sun.gc.__fgc = isDef(_fgc) ? Number(_fgc.invocations) : 0
            data.sun.gc.__fgct = isDef(_fgc) ? Number(_fgc.time / 1000000000) : 0

            data.sun.gc.__gct = $from(data.sun.gc.collector).sum("time") / 1000000000

            data.java.__mem = {
            total    : r.total,
            used     : r.used,
            free     : r.total - r.used,
            metaMax  : data.sun.gc.metaspace.maxCapacity,
            metaTotal: data.sun.gc.metaspace.capacity,
            metaUsed : data.sun.gc.metaspace.used,
            metaFree : data.sun.gc.metaspace.capacity - data.sun.gc.metaspace.used
            }

            _$o( data, options )
        } else {
            _exit(-1, "hsperf is only supported with either 'file' or 'cmd' defined.")
        }
    }],
    ["jfr", (_res, options) => {
        ow.loadJava()
        if (isUnDef(ow.java.parseJFR)) _exit(-1, "jfr not available.")

        if (!isBoolean(params.jfrjoin)) params.jfrjoin = toBoolean(_$(params.jfrjoin, "jfrjoin").isString().default(__))
        if (!isBoolean(params.jfrdesc)) params.jfrdesc = toBoolean(_$(params.jfrdesc, "jfrdesc").isString().default(__))
        
        _showTmpMsg()
        var _r
        if (isDef(params.file) && isUnDef(params.cmd)) {
            _res = params.file
        }
        if (isDef(params.cmd)) {
            _res = _runCmd2Bytes(params.cmd, true)
            var _ft = io.createTempFile("jfr", ".jfr")
            io.writeFileBytes(_ft, _res)
            _res = _ft
        }

        if (params.jfrjoin) {
            _$o(ow.java.parseJFR(_res, __, params.jfrdesc), options)
        } else {
            ow.java.parseJFR(_res, event => _$o(event, options), params.jfrdesc)
        }
    }],
    ["rawhex", (_res, options) => {
        var _r
        params.inrawhexline = _$(params.inrawhexline, "inrawhexline").isNumber().default(__)
        _showTmpMsg()
        if (isDef(params.file) || isDef(params.cmd)) {
            _r = isDef(params.cmd) ? _runCmd2Bytes(params.cmd) : io.readFileBytes(params.file)
        } else {
            _r = af.fromString2Bytes(_res)
        }
        var __r = ow.format.string.toHexArray(_r, params.inrawhexline)
        __r.forEach(r => {
            r.characters = r.characters.replace(/[\x00-\x1F\x80-\xFF]/g, '.')
        })
        _$o(__r, options)
    }],
    ["base64", (_res, options) => {
        var _r
        _showTmpMsg()
        if (toBoolean(params.base64gzip)) {
            _r = af.fromBytes2String(io.gunzip(af.fromBase64(_res, true)))
        } else {
            _r = af.fromBytes2String(af.fromBase64(_res))
        }
        _$o(_r, options)
    }],
    ["gb64json", (_res, options) => {
        var _r
        _showTmpMsg()
        _r = af.fromBytes2String(io.gunzip(af.fromBase64(_res, true)))
        _$o(_r, options)
    }],
    ["oaf", (_res, options) => {
        if (!isString(_res)) _exit(-1, "oaf is only supported with a string.")
        _showTmpMsg()
        var _r
        if (isString(_res)) {
            let _t
            if (io.fileExists(_res)) {
                _t = io.readFileString(_res)
            } else {
                _t = _res
            }
            if (isString(_t)) {
                let _f = new Function("var data;" + _t + ";return data")
                _r = _f()
            }
        }
        _$o(_r, options)
    }],
    ["oafp", (_res, options) => {
        // Detects if input is YAML of JSON/SLON
        var _r = _fromJSSLON(_res, true)
        var id = "_oafp_key_" + genUUID()
        if (isMap(_r)) {
            _r.out         = "key"
            _r.__key       = id
            _r.__inception = true
            oafp(_r)
            var _d = $get(id)
            $unset(id)
            _$o(_d, options)
        } else if (isArray(_r)) {
            $set(id, true)
            var _out = pForEach(_r, (__r, i) => {
                var sid = id + "_" + String(i)
                var _ok = false
                if (isUnDef(__r.out)) {
                    __r.out         = "key"
                    __r.__key       = sid
                    __r.__inception = true
                    _ok = true
                }
                //return $do(() => {
                var _rr
                try {
                    oafp(__r)
                    if (_ok) {
                        _rr = $get(sid)
                        $unset(sid)
                    }
                } catch(e) {
                    sprintErr(e)
                } finally {
                    return _rr
                }
            }, __, isDef(params.inoafpseq) ? toBoolean(params.inoafpseq) : __)
            //$doWait($doAll(_p))
            _$o(_out, options)
        } else {
            _exit(-1, "oafp input data needs to be a map or an array.")
        }
    }],
    ["ojob", (_res, options) => {
        var _oj = _fromJSSLON(_res, true)
        if (isString(_oj)) {
            _oj = { ojob: _oj, args: {} }
        }
        _$(_oj.ojob, "ojob").isString().$_()
        _oj.args = _$( _oj.args, "args").isMap().default({})

        _showTmpMsg()

        var _id = genUUID()
        _oj.args.__format = "key"
        _oj.args.__key    = _id
        oJobRunFile(_oj.ojob, _oj.args)
        var _r = $get(_id)
        delete _r.__format
        delete _r.__key
        _$o($get(_id), options)
    }],
    ["sh", (_res, options) => {
        _showTmpMsg()
        var _r
        _res = _fromJSSLON(_res, true)
        if (isString(_res)) {
            _r = $sh(_res).get(0)
        } else {
            if (!isMap(_res)) _exit(-1, "For in=sh the input data needs to a string or a map")
            var _s = $sh()
            if (isUnDef(_res.cmd)) _exit(-1, "For in=sh the input data needs to a string or a map with the a 'cmd'")

            _s = _s.sh(_res.cmd)
            if (isDef(_res.envs))   _s = _s.envs(_res.envs, _res.envsall)
            if (isDef(_res.prefix)) _s = _s.prefix(_res.prefix)
            if (isDef(_res.pwd))    _s = _s.pwd(_res.pwd)
            switch(params.inshformat) {
            case 'raw' : _r = _s.get(0); break
            case 'yaml': _r = _s.getYaml(0); break
            case 'json':
            default    : _r = _s.getJson(0)
            }
        }
        _$o(_r, options)
    }],
    ["llm", (_res, options) => {
        params.llmenv     = _$(params.llmenv, "llmenv").isString().default("OAFP_MODEL")
        params.llmoptions = _$(params.llmoptions, "llmoptions").or().isString().isMap().default(__)
        if (params.llmenv == "OAFP_MODEL" && isUnDef(getEnv("OAFP_MODEL")) && isDef(getEnv("OAF_MODEL"))) {
            params.llmenv = "OAF_MODEL"
        }
        if (isUnDef(params.llmoptions) && !isString(getEnv(params.llmenv))) 
            _exit(-1, "llmoptions not defined and " + params.llmenv + " not found.")

        _showTmpMsg()
        var res = $llm( _getSec(isDef(params.llmoptions) ? _fromJSSLON(params.llmoptions) : $sec("system", "envs").get(params.llmenv)) )
        if (isDef(params.llmconversation) && io.fileExists(params.llmconversation)) 
            res.getGPT().setConversation( io.readFileJSON(params.llmconversation) )
        let __res
        let img
        if (isString(params.llmimage)) {
            if (params.llmimage.toLowerCase().match(/^https?:\/\//))
                img = af.fromBytes2String(af.toBase64Bytes(af.fromInputStream2Bytes($rest().get2Stream(params.llmimage))))
            else if (io.fileExists(params.llmimage))
                img = af.fromBytes2String(af.toBase64Bytes(io.readFileBytes(params.llmimage)))
        } 
        if (params.out == "md" || params.out == "mdtable" || params.out == "raw") {
            __res = isDef(img) ? res.promptImage(_res, img) : res.prompt(_res)
        } else {
            if (isDef(img)) {
                __res = res.promptImage(_res, img, __, __, __, __, true) 
            } else {
                __res = res.promptJSON(_res) 
            }   
        }
        if (isDef(params.llmconversation)) {
            var _conv = res.getGPT().getConversation()
            //_conv.push({ role: "assistant", content: stringify(__res, __, "") })
            io.writeFileJSON( params.llmconversation, _conv, "" )
        }

        _$o(jsonParse(__res, __, __, isString(__res)), options)
    }],
    ["llmmodels", (_res, options) => {
        params.llmenv     = _$(params.llmenv, "llmenv").isString().default("OAFP_MODEL")
        params.llmoptions = _$(params.llmoptions, "llmoptions").or().isString().isMap().default(__)
        if (isUnDef(params.llmoptions) && !isString(getEnv(params.llmenv))) 
            _exit(-1, "llmoptions not defined and " + params.llmenv + " not found.")
        if (params.llmenv == "OAFP_MODEL" && isUnDef(getEnv("OAFP_MODEL")) && isDef(getEnv("OAF_MODEL"))) {
            params.llmenv = "OAF_MODEL"
        }
        _showTmpMsg()

        var res = $llm( _getSec(isDef(params.llmoptions) ? _fromJSSLON(params.llmoptions) : $sec("system", "envs").get(params.llmenv)) )
        if (isUnDef(res.getModels)) _exit(-1, "OpenAF support for llm model listing API not found.")
        _$o(res.getModels(), options)
    }],
    ["javas", (_res, options) => {
        params.javasinception = toBoolean(params.javasinception)
        _showTmpMsg()
        plugin("JMX")
        var jmx = new JMX()
        var _r = jmx.getLocals().Locals
        if (!params.javasinception) {
            _r = _r.filter(r => r.id != getPid())
        }
        _$o(_r, options)
    }],
    ["jmx", (_res, options) => {
        params.jmxop = _$(params.jmxop, "jmxop").oneOf(["all","get","query","domains"]).default("all")
        if (isUnDef(params.jmxurl) && isUnDef(params.jmxpid)) _exit(-1, "jmxurl or jmxpid is not defined.")
        
        _showTmpMsg()
        plugin("JMX")
        ow.loadJava()
        let jmx
        if (isUnDef(params.jmxurl)) {
            ow.loadServer()
            jmx = new ow.java.JMX((new JMX()).attach2Local(params.jmxpid).URL)
        } else {
            jmx = new ow.java.JMX(params.jmxurl, params.jmxuser, params.jmxpass, params.jmxprovider)
        }
        let _r
        switch(params.jmxop) {
        case "domains": _r = jmx.getDomains(); break
        case "query"  : if (isString(_res)) _r = jmx.queryNames(_res); else _exit(-1, "Input needs to be a JMX query string (e.g. java.lang:*)"); break
        case "get"    : if (isString(_res)) _r = jmx.getObject(_res); else _exit(-1, "Input needs to be a JMX object name (e.g. java.lang:type=Memory)"); break
        default       :
        case "all"    : _r = jmx.getAll(); break
        }
        _$o(_r, options)
    }],
    ["snmp", (_res, options) => {
        _$(params.insnmp, "insnmp").isString().$_()
        params.insnmpcommunity = _$(params.insnmpcommunity, "insnmpcommunity").isString().default("public")
        params.insnmptimeout = _$(params.insnmptimeout, "insnmptimeout").isNumber().default(__)
        params.insnmpretries = _$(params.insnmpretries, "insnmpretries").isNumber().default(__)
        params.insnmpversion = _$(params.insnmpversion, "insnmpversion").isString().default(__)
        params.insnmpsec = _fromJSSLON(_$(params.insnmpsec, "insnmpsec").or().isString().isMap().default(__))
        _showTmpMsg()
        plugin("SNMP")
        var snmp = new SNMP(params.insnmp, params.insnmpcommunity, params.insnmptimeout, params.insnmpversion, params.insnmpsec)
        let _r = {}, _i = _fromJSSLON(_res, true)
        if (isString(_i)) {
            var _p = _i.split("\n").map(p => p.trim()).filter(p => p.length > 0)
            if (_p.length == 1) {
                _r = snmp.get(_res)
                if (isMap(_r)) _r = _r[_res]
            } else {
                _r = pForEach(_p, p => {
                    var _r = snmp.get(p)
                    if (isMap(_r)) _r = _r[p]
                    return _r
                })
            }
        } else {
            let _ism = isMap(_i)
            ow.loadObj()
            var _fn = _oid => snmp.get(_oid)[_oid]
            if (_ism) {
                let _ac = []
                _r = _i
                traverse(_r, (aK, aV, aP, aO) => {
                    if (isString(aV)) _ac.push({ o: aO, k: aK, v: aV })
                })
                pForEach(_ac, ac => ac.o[ac.k] = _fn(ac.v))
            } else {
                _r = pForEach(_i, a => _fn(a))
            }
        }
        _$o(_r, options)
    }],
    ["ls", (_res, options) => {
        _showTmpMsg()
        if (isString(_res)) {
            var _r
            var isPosix = toBoolean(params.lsposix)

            if (isDef(params.file)) _res = params.file

            var _i = io.fileExists(_res), _f
            if (_i) _f = io.fileInfo(_res)
            if (_i && _f.isFile) {
                var ext = isDef(params.lsext) ? params.lsext :_f.filename.replace(/^.*\./, '').toLowerCase()
                switch(ext) {
                case "tgz":
                case "gz":
                    _r = io.listFilesTAR(_res, true)
                    break
                case "tar":
                    _r = io.listFilesTAR(_res)
                    break
                case "jar":
                case "zip":
                default   :
                    plugin("ZIP")
                    _r = $m4a((new ZIP()).list(_res))
                }
            } else {
                if (toBoolean(params.lsrecursive)) {
                    _r = listFilesRecursive(_res, isPosix)
                } else {
                    _r = io.listFiles(_res, isPosix).files
                }
            }
            _$o(_r, options)
        } else {
            _exit(-1, "ls is only supported with a string.")
        }
    }],  
    ["mcp", (_res, options) => {
        _showTmpMsg()
        if (isUnDef($mcp)) _exit(-1, "mcp support not found.")
        var _mres = _fromJSSLON(_res, true)
        var _m = $mcp(_mres)
        _m = _m.initialize()

        var _r
        if (toBoolean(params.inmcptoolslist)) {
            _r = _m.listTools()
            if (isMap(_r) && isDef(_r.tools)) _r = _r.tools
        } else if (toBoolean(params.inmcplistprompts)) {
            _r = _m.listPrompts()
            if (isMap(_r) && isDef(_r.prompts)) _r = _r.prompts
        } else {
            if (isUnDef(_mres.tool)) _exit(-1, "For in=mcp a tool needs to be defined.")
            if (isUnDef(_mres.params)) _mres.params = {}
            
            _r = _m.callTool(_mres.tool, _mres.params)
        }
        _m.destroy()
        _$o(_r, options)
    }],
    ["toml", (_res, options) => {
        _showTmpMsg()
        if (isUnDef(af.fromTOML)) _exit(-1, "TOML support not found.")
        _$o(af.fromTOML(_res), options)
    }],
    ["slon", (_res, options) => {
        _showTmpMsg()
        _$o(af.fromSLON(_res), options)
    }],
    ["json", (_res, options) => {
        _showTmpMsg()
        _$o(jsonParse(_res, __, __, isString(_res)), options)
    }]
])
