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
        if (_res.indexOf("<?xml") >= 0) _res = _res.substring(_res.indexOf("?>") + 2).trim()
        if (_res.indexOf("<!DOCTYPE") >= 0) _res = _res.substring(_res.indexOf(">") + 1).trim()
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

            ioStreamReadLines(_stream, r => {
                // If linesvisual=true then the first line is the header and the space position of
                // each header title determines the column position for the remaining lines

                if (toBoolean(params.linesvisual)) {
                    var _r = _visualProc(r)
                    if (isDef(_r)) _$o(_r, clone(options), true)
                } else {
                    _$o(r, clone(options), true)
                }
            })
            _stream.close()
        }
    }],
    ["ndjson", (_res, options) => {
        if (!isBoolean(params.ndjsonjoin)) params.ndjsonjoin = toBoolean(_$(params.ndjsonjoin, "ndjsonjoin").isString().default(__))

        _showTmpMsg()
        global.__ndjsonbuf = __
        var _ndjline = (r, fn) => {
            if (isUnDef(global.__ndjsonbuf) && r.length != 0 && r.trim().startsWith("{")) global.__ndjsonbuf = ""
            if (isDef(global.__ndjsonbuf)) {
                if (r.length != 0 && !r.trim().endsWith("}")) { global.__ndjsonbuf += r.trim(); return }
                if (global.__ndjsonbuf.length > 0) { r = global.__ndjsonbuf + r; global.__ndjsonbuf = __ }
            }
            if (r.length == 0 || r.length > 0 && r.trim().substring(0, 1) != "{") { 
                fn(r)
                global.__ndjsonbuf = __
                return 
            }
            fn(r)
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

            ioStreamReadLines(_stream, r => {
                _ndjline(r, line => _$o(jsonParse(line, __, __, true), clone(options), true) )
            })
            _stream.close()
        }
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
    ["ask", (_res, options) => {
        var _d = []
        _res = af.fromJSSLON(_res)
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

            var _r = _fromJSSLON(r)
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
                if (toBoolean(params.indbexec)) {
                    var _r = _db.u(r)
                    _$o({ affectedRows: _r }, options)
                    _db.commit()
                } else {
                    var _r = _db.q(r)
                    if (isMap(_r) && isArray(_r.results)) {
                        _$o(_r.results, options)
                    } else {
                        _exit(-1, "Invalid DB result: " + stringify(_r))
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
    ["xls", (_res, options) => {
        _showTmpMsg()
        try {
            includeOPack("plugin-XLS")
        } catch(e) {
            _exit(-1, "plugin-XLS not found. You need to install it to use the XLS output (opack install plugin-XLS)")
        }
        
        params.inxlssheet        = _$(params.inxlssheet || params.xlssheet, "xlssheet").isString().default(0)
        params.inxlsevalformulas = toBoolean(_$(params.inxlsevalformulas || params.xlsevalformulas, "xlsevalformulas").isString().default(true))
        params.inxlscol          = _$(params.inxlscol || params.xlscol, "xlscol").isString().default("A")
        params.inxlsrow          = _$(params.inxlsrow || params.xlsrow, "xlsrow").isString().default(1)

        plugin("XLS")
        if (isDef(params.file) || isDef(params.cmd)) {
            var xls = new XLS(isDef(params.cmd) ? _runCmd2Bytes(params.cmd) : params.file)
            var sheet = xls.getSheet(params.inxlssheet)
            var _r = xls.getTable(sheet, params.inxlsevalformulas, params.inxlscol, params.inxlsrow)
            xls.close()
            if (isDef(_r) && isMap(_r)) _r = _r.table

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
    ["javagc", (_res, options) => {
        if (!isBoolean(params.javagcjoin)) params.javagcjoin = toBoolean(_$(params.javagcjoin, "javagcjoin").isString().default(__))

        let _procLine = _event => {
            try {
                let regexes = [
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
                    // JDK 9+ style regexes
                    /^\[(.+)\]\s+GC\((\d+)\)\s*(.*?)\s*(\d+[GMK])->(\d+[GMK])\((\d+[GMK])\)\s*(\d+\.\d+)ms/,
                    /^\[(.+)\]\s+GC\((\d+)\)\s*(.*?)\s*Metaspace:\s*(\d+[GMK])\((\d+[GMK])\)->(\d+[GMK])\((\d+[GMK])\)\s*NonClass:\s*(\d+[GMK])\((\d+[GMK])\)->(\d+[GMK])\((\d+[GMK])\)\s*Class:\s*(\d+[GMK])\((\d+[GMK])\)->(\d+[GMK])\((\d+[GMK])\)/,
                    // JDK 9+ Allocation Failure
                    /^\[(.+)\]\s+GC\((\d+)\)\s*(Allocation Failure)\s*(.*?)\s+(\d+[KMGT])->(\d+[KMGT])\((\d+[KMGT])\)\s+(\d+\.\d+)ms/,
                ]

                for (let index = 0; index < regexes.length; index++) {
                    let regex = regexes[index]
                    let match = _event.match(regex)
                    if (match) {
                        let result = {}

                        if (_event.startsWith('[')) {
                            // JDK 9+ style parsing
                            //result.index = index
                            var heads = match[1].split("][")
                            heads.forEach(head => {
                                if (head.match(/^\d+\.\d+s$/)) {
                                    result.sinceStart = parseFloat(head.replace(/s$/, ""))
                                } else if (head.match(/\d{4}-\d{2}-\d{2}T/)) {
                                    result.timestamp = ow.format.toDate(head, "yyyy-MM-dd'T'HH:mm:ss.SSSZ")
                                }
                            })
                            result.gcId = parseInt(match[2])
                            result.gcType = match[3].trim()
                            if (result.gcType == "") result.gcType = "none"
                            result.durationSecs = parseFloat(match[match.length - 1]) / 1000 // convert ms to secs

                            if (index === 5) {
                                // Match for GC pause with heap info
                                result.heapBeforeGC = ow.format.fromBytesAbbreviation(match[4] + "B")
                                result.heapAfterGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                                result.heapTotal = ow.format.fromBytesAbbreviation(match[6] + "B")
                            } else if (index > 5) {
                                if (index == 6) {
                                    result.metaUsedBeforeGC = ow.format.fromBytesAbbreviation(match[4] + "B")
                                    result.metaTotalBeforeGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                                    result.metaUsedAfterGC = ow.format.fromBytesAbbreviation(match[6] + "B")
                                    result.metaTotalAfterGC = ow.format.fromBytesAbbreviation(match[7] + "B")
                                    result.nonClassUsedBeforeGC = ow.format.fromBytesAbbreviation(match[8] + "B")
                                    result.nonClassTotalBeforeGC = ow.format.fromBytesAbbreviation(match[9] + "B")
                                    result.nonClassUsedAfterGC = ow.format.fromBytesAbbreviation(match[10] + "B")
                                    result.nonClassTotalAfterGC = ow.format.fromBytesAbbreviation(match[11] + "B")
                                    result.classUsedBeforeGC = ow.format.fromBytesAbbreviation(match[12] + "B")
                                    result.classTotalBeforeGC = ow.format.fromBytesAbbreviation(match[13] + "B")
                                    result.classUsedAfterGC = ow.format.fromBytesAbbreviation(match[14] + "B")
                                    result.classTotalAfterGC = ow.format.fromBytesAbbreviation(match[15] + "B")
                                } else {
                                    result.heapBeforeGC = ow.format.fromBytesAbbreviation(match[4] + "B")
                                    result.heapAfterGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                                    result.heapTotal = ow.format.fromBytesAbbreviation(match[6] + "B")
                                }
                            }
                        } else {
                            // JDK 8 style parsing
                            //result.index = index
                            result.timestamp = ow.format.toDate(match[1], "yyyy-MM-dd'T'HH:mm:ss.SSSZ")
                            result.sinceStart = parseFloat(match[2])
                            result.gcType = match[3] + " " + match[4]

                            //print(index)
                            //cprint(match)
                            if (index <= 4) {
                                let idx = 5
                                result.PSYoungGenBeforeGC = ow.format.fromBytesAbbreviation(match[idx++] + "B")
                                result.PSYoungGenAfterGC = ow.format.fromBytesAbbreviation(match[idx++] + "B")
                                result.PSYoungGenTotal = ow.format.fromBytesAbbreviation(match[idx++] + "B")

                                if (index == 2 || index == 3) {
                                    result.ParOldGenBeforeGC = ow.format.fromBytesAbbreviation(match[idx++] + "B")
                                    result.ParOldGenAfterGC = ow.format.fromBytesAbbreviation(match[idx++] + "B")
                                    result.ParOldGenTotal = ow.format.fromBytesAbbreviation(match[idx++] + "B")
                                }

                                result.heapBeforeGC = ow.format.fromBytesAbbreviation(match[idx++] + "B")
                                result.heapAfterGC = ow.format.fromBytesAbbreviation(match[idx++] + "B")
                                result.heapTotal = ow.format.fromBytesAbbreviation(match[idx++] + "B")

                                if (index == 2 || index == 3) {
                                    result.metaBeforeGC = ow.format.fromBytesAbbreviation(match[idx++] + "B")
                                    result.metaAfterGC = ow.format.fromBytesAbbreviation(match[idx++] + "B")
                                    result.metaTotal = ow.format.fromBytesAbbreviation(match[idx++] + "B")
                                }

                                result.durationSecs = parseFloat(match[idx++])

                                if (index == 0 || index == 2 || index == 4) {
                                    result.userTime = parseFloat(match[idx++])
                                    result.sysTime = parseFloat(match[idx++])
                                    result.realTime = parseFloat(match[idx++])
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
        ow.loadFormat()

        _showTmpMsg()
        if (isString(_res)) {
            let lines = _res.split("\n")
            let gcStartPattern = /^(\[\d+|\d{4}-\d{2}-\d{2}T)/ // Matches lines starting with '[\d+' or a timestamp

            let gcEvents = []
            let currentEvent = []

            for (let line of lines) {
                if (gcStartPattern.test(line)) {
                    // New GC event detected
                    if (currentEvent.length > 0) {
                        gcEvents.push(currentEvent.join("\n"))
                    }
                    currentEvent = [line]
                } else {
                    // Continuation of the current GC event
                    currentEvent.push(line)
                }
            }
            // Add the last GC event
            if (currentEvent.length > 0) {
                gcEvents.push(currentEvent.join("\n"))
            }

            let results = gcEvents.map(_procLine).filter(r => isMap(r))

            if (params.javagcjoin) {
                _$o(results, options, true)
            } else {
                results.forEach(result => _$o(result, options, true))
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
        var _r = af.eval(_res)
        _$o(_r, options)
    }],
    ["oafp", (_res, options) => {
        //params.__inception = true
        var _r = _fromJSSLON(_res)
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
                __r.out         = "key"
                __r.__key       = sid
                __r.__inception = true
                //return $do(() => {
                var _rr
                try {
                    oafp(__r)
                    _rr = $get(sid)
                    $unset(sid)
                } catch(e) {
                    sprintErr(e)
                } finally {
                    return _rr
                }
            })
            //$doWait($doAll(_p))
            _$o(_out, options)
        } else {
            _exit(-1, "oafp input data needs to be a map or an array.")
        }
    }],
    ["sh", (_res, options) => {
        _showTmpMsg()
        var _r
        _res = _fromJSSLON(_res)
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
        params.llmoptions = _$(params.llmoptions, "llmoptions").isString().default(__)
        if (isUnDef(params.llmoptions) && !isString(getEnv(params.llmenv))) 
            _exit(-1, "llmoptions not defined and " + params.llmenv + " not found.")

        _showTmpMsg()
        var res = $llm(isDef(params.llmoptions) ? _fromJSSLON(params.llmoptions) : $sec("system", "envs").get(params.llmenv))
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
        if (params.output == "md" || params.output == "mdtable" || params.output == "raw") {
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
            _conv.push({ role: "assistant", content: stringify(__res, __, "") })
            io.writeFileJSON( params.llmconversation, _conv, "" )
        }

        _$o(jsonParse(__res, __, __, isString(__res)), options)
    }],
    ["llmmodels", (_res, options) => {
        params.llmenv     = _$(params.llmenv, "llmenv").isString().default("OAFP_MODEL")
        params.llmoptions = _$(params.llmoptions, "llmoptions").isString().default(__)
        if (isUnDef(params.llmoptions) && !isString(getEnv(params.llmenv))) 
            _exit(-1, "llmoptions not defined and " + params.llmenv + " not found.")

        _showTmpMsg()

        var res = $llm(isDef(params.llmoptions) ? _fromJSSLON(params.llmoptions) : $sec("system", "envs").get(params.llmenv))
        if (isUnDef(res.getModels)) _exit(-1, "OpenAF support for llm model listing API not found.")
        _$o(res.getModels(), options)
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