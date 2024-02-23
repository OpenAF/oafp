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
        if (params.linesjoin) {
            if (isDef(params.file) && isUnDef(params.cmd)) {
                _res = io.readFileString(params.file)
            }
            if (isDef(params.cmd)) {
                _res = _runCmd2Bytes(params.cmd, true)
            }
            _res = _res.split(/\r?\n/)
            _$o(_res, options)
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
                _$o(r, clone(options), true)
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
        var _s = ow.template.md.fromTable(_res)
        _$o(_s, options)
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
    ["sql", (r, options) => {
        if (isString(r)) {
            _$o(af.fromSQL(r).ast, options)
        } else {
            _$o(r, options)
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
        
        params.xlssheet        = _$(params.xlssheet, "xlssheet").isString().default(0)
        params.xlsevalformulas = toBoolean(_$(params.xlsevalformulas, "xlsevalformulas").isString().default(true))
        params.xlscol          = _$(params.xlscol, "xlscol").isString().default("A")
        params.xlsrow          = _$(params.xlsrow, "xlsrow").isString().default(1)

        plugin("XLS")
        if (isDef(params.file) || isDef(params.cmd)) {
            var xls = new XLS(isDef(params.cmd) ? _runCmd2Bytes(params.cmd) : params.file)
            var sheet = xls.getSheet(params.xlssheet)
            var _r = xls.getTable(sheet, params.xlsevalformulas, params.xlscol, params.xlsrow)
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
        if (isDef(params.file) || isDef(params.cmd)) {
            var is = isDef(params.cmd) ? af.fromBytes2InputStream(_runCmd2Bytes(params.cmd)) : io.readFileStream(params.file)
            _r = $csv(params.inputcsv).fromInStream(is).toOutArray()
            is.close()
        } else {
            _r = $csv(params.inputcsv).fromInString( _res ).toOutArray()
        }
        _$o(_r, options)
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
    ["llm", (_res, options) => {
        params.llmenv     = _$(params.llmenv, "llmenv").isString().default("OAFP_MODEL")
        params.llmoptions = _$(params.llmoptions, "llmoptions").isString().default(__)
        if (isUnDef(params.llmoptions) && !isString(getEnv(params.llmenv))) 
            _exit(-1, "llmoptions not defined and " + params.llmenv + " not found.")

        _showTmpMsg()
        var res = $llm(isDef(params.llmoptions) ? params.llmoptions : $sec("system", "envs").get(params.llmenv))
        if (params.output == "md" || params.output == "mdtable" || params.output == "raw") {
            res = res.prompt(_res)
        } else {
            res = res.promptJSON(_res)
        }

        _$o(jsonParse(res, __, __, isString(res)), options)
    }],
    ["json", (_res, options) => {
        _showTmpMsg()
        _$o(jsonParse(_res, __, __, isString(_res)), options)
    }]
])