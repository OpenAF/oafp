var _outputFns = new Map([
    ["?" , (r, options) => {
        r = Array.from(_outputFns.keys()).filter(r => r != '?').sort()
        $o(r, options)
    }],
    ["pm", (r, options) => {
        $o(r, options)
    }],
    ["key", (r, options) => {
        $o(r, options)
    }],
    ["html", (r, options) => {
        if (isString(r)) {
            ow.loadTemplate()
            print(ow.template.html.genStaticVersion(ow.template.parseMD2HTML(r, !toBoolean(params.htmlpart), !toBoolean(params.htmlcompact))))
        } else {
            $o(r, options)
        }
    }],
    ["ctable", (r, options) => {
        $o(r, options)
    }],
    ["stable", (r, options) => {
        $o(r, options)
    }],
    ["table", (r, options) => {
        $o(r, options)
    }],
    ["log", (r, options) => {
        if (isString(r) && toBoolean(params.logprintall)) {
            print(r.replace(/\n$/, ""))
        } else {
            var _arr = r
            if (isMap(r)) _arr = [ r ]
            if (isArray(_arr)) {
                _arr.forEach(_r => {
                    if (isMap(_r)) {
                        let d = (isDef(_r["@timestamp"]) ? _r["@timestamp"] : __)
                        let l = (isDef(_r.level) ? _r.level : __)
                        let m = (isDef(_r.message) ? _r.message : __)
                        let lineC
                        if (isDef(l)) {
                            if (l.toLowerCase().indexOf("err") >= 0)  lineC = "RED,BOLD"
                            if (l.toLowerCase().indexOf("warn") >= 0) lineC = "YELLOW"
                        }
                        if (isDef(d) && d.length > 24) d = d.substring(0, 23) + "Z"
                        if (isDef(m) || isDef(d)) print(ansiColor("BOLD", d) + (isDef(l) ? " | " + ansiColor(lineC, l) : "") + " | " + ansiColor(lineC, m))
                    }
                })
            }
        }
    }],
    ["raw", (r, options) => {
        if (isString(r))
            print(r)
        else
            sprint(r)
    }],
    ["ini", (r, options) => {
        if (!isString(r)) {
            ow.loadJava()
            var ini = new ow.java.ini()
            print( ini.put(r).save() )
        }
    }],
    ["mdyaml", (r, options) => {
        if (isArray(r)) {
            r.forEach((_y, i) => {
                $o(_y, merge(options, { __format: "yaml" }))
                if (i < r.length - 1) print("---\n")
            })
        } else {
            $o(r, merge(options, { __format: "yaml" }))
        }
    }],
    ["mdtable", (r, options) => {
        if (isArray(r)) {
            ow.loadTemplate()
            print( ow.template.md.table(r) )
        }
    }],
    ["template", (r, options) => {
        if (!isString(r)) {
            ow.loadTemplate()
            ow.template.addConditionalHelpers()
            ow.template.addOpenAFHelpers()
            ow.template.addFormatHelpers()
            if (isUnDef(params.template)) _exit(-1, "For output=handlebars you need to provide a template=someFile.hbs")
            tprint(io.readFileString(params.template), r)
        }
    }],
    ["openmetrics", (r, options) => {
        if (!isString(r)) {
            ow.loadMetrics()
            var _out = ow.metrics.fromObj2OpenMetrics(r, params.metricsprefix, params.metricstimestamp)
            _out = _out.split("\n").map(line => {
                if (line.indexOf("{_id=\"") >= 0) line = line.replace(/{_id=\"\d+\",/, "{")
                if (line.indexOf(",_id=\"") >= 0) line = line.replace(/,_id=\"\d+\"}/, "}")
                if (line.indexOf("_id=\"") >= 0) line = line.replace(/,_id=\"\d+\",/, ",")
                return line
            }).join("\n")
            $o(_out, options)
        }
    }],
    ["pjson", (r, options) => {
        options.__format = "prettyjson"
        $o(r, options)
    }],
    ["base64", (r, options) => {
        var _o = ""
        if (isString(r))
            _o = r
        else
            _o = stringify(r)

        if (toBoolean(params.base64gzip)) {
            print(af.fromBytes2String(af.toBase64Bytes(io.gzip(af.fromString2Bytes(_o)))))
        } else {
            print(af.fromBytes2String(af.toBase64Bytes(_o)))
        }
    }],
    ["chart", (r, options) => {
        if (isUnDef(params.chart)) _exit(-1, "For output=chart you need to provide a chart=\"<units> [<path[:color][:legend]>...]\"")
        if (isUnDef(splitBySepWithEnc)) _exit(-1, "Output=chart is not supported in this version of OpenAF")

        let parts = splitBySepWithEnc(params.chart, " ", [["\"","\""],["'","'"]])
        let nparts = []
        if (parts.length > 1) {
            for(let i = 0; i < parts.length; i++) {
                if (i == 0) {
                    nparts.push(parts[i])
                } else {
                    let _n = splitBySepWithEnc(parts[i], ":", [["\"","\""],["'","'"]]).map((_p, j) => {
                        if (j == 0) {
                            if (!_p.startsWith("-")) {
                                global["_oafp_fn_" + i] = () => $path(r, _p)
                                return "_oafp_fn_" + i
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

            if (toBoolean(params.chartcls)) cls()
            print(printChart("oafp " + nparts.join(" ")))
        }

    }],
    ["ch", (r, options) => {
        if (isUnDef(params.ch))    _exit(-1, "For output=ch you need to provide a ch=\"(type: ...)\"")
        if (isUnDef(params.chkey)) _exit(-1, "For output=ch you need to provide a chkey=\"key1, key2\"")

        var _r = (isMap(r) ? [ r ] : r)
        params.ch = _fromJSSLON(params.ch)
        if (isMap(params.ch)) {
            if (isUnDef(params.ch.type)) _exit(-1, "ch.type is not defined.")
            if (isDef(params.ch.lib)) loadLib(params.ch.lib)
            if (params.ch.type == "remote") {
                $ch("oafp::outdata").createRemote(params.ch.url)
            } else {
                $ch("oafp::outdata").create(params.ch.type, params.ch.options)
            }

            if (toBoolean(params.chunset)) {
                $ch("oafp::outdata").unsetAll(params.chkey.split(",").map(r => r.trim()), _r)
            } else {
                $ch("oafp::outdata").setAll(params.chkey.split(",").map(r => r.trim()), _r)
            }
            $ch("oafp::outdata").destroy()
        } else {
            _exit(-1, "Invalid ch parameter")
        }
    }],
    ["db", (r, options) => {
        if (!isArray(r) || r.length < 1) _exit(-1, "db is only supported for filled arrays/lists")
        params.dbtable = _$(params.dbtable, "outdbtable").isString().default("data")
        params.dbnocreate = toBoolean(_$(params.dbnocreate, "outdbnocreate").isString().default("false"))
        params.dbicase = toBoolean(_$(params.dbicase, "outdbicase").isString().default("false"))
        params.dbbatchsize = _$(params.dbbatchsize, "dbbatchsize").isNumber().default(__)

        ow.loadObj()
        var _db
        try {
            if (!isString(params.dbjdbc)) _exit(-1, "dbjdbc URL is not defined.")
            if (isDef(params.dblib)) loadLib("jdbc-" + params.dblib + ".js")
            _db = new DB(params.dbjdbc, params.dbuser, params.dbpass, params.dbtimeout)

            // Creating table
            if (!params.dbnocreate) {
                try {
                    var _sql = ow.obj.fromObj2DBTableCreate(params.dbtable, r, __, !params.dbicase)
                    _db.u(_sql)
                    _db.commit() // needed for some jdbcs
                } catch(idbe) {
                    _db.rollback()
                    _exit(-1, "Error creating table: " + idbe)
                }
            }

            // Inserting into table
            var okeys, ookeys = Object.keys(ow.obj.flatMap(r[0]))
            if (!params.dbicase) 
                okeys = "\"" + ookeys.join("\", \"") + "\""
            else 
                okeys = ookeys.join(",").toUpperCase()
    
            let _sqlH = ""
            let _parseVal = aValue => {
                var _value = ow.obj.flatMap(aValue)
                var values = [];
                for(var k in ookeys) {
                    values.push(_value[ookeys[k]]);
                }
                var binds = ookeys.map(k => {
                    var v = _value[k]
                    return String(v)
                })
                var __h = "INSERT INTO " + (!params.dbicase ? "\"" + params.dbtable + "\"" : params.dbtable) + " (" + okeys + ") VALUES (" + binds.map(r => "?").join(", ") + ")"
                if (__h.length > _sqlH.length) {
                    _sqlH = String(__h)
                }

                return binds
            }

            var vals = r.map(_parseVal)
            _db.usArray(_sqlH, vals, params.dbbatchsize)
        } catch(dbe) {
            if (isDef(_db)) _db.rollback()
            printErr(dbe)
            _exit(-1, "Error connecting to the database: " + dbe)
        } finally {
            if (isDef(_db)) {
                _db.commit()
                _db.close()
            }
        }
    }],
    ["sql", (r, options) => {
        if (!isArray(r) || r.length < 1) _exit(-1, "sql is only supported for filled arrays/lists")
        params.sqltable = _$(params.sqltable, "sqltable").isString().default("data")
        params.sqlicase = toBoolean(_$(params.sqlicase, "sqlicase").isString().default("false"))
        params.sqlnocreate = toBoolean(_$(params.sqlnocreate, "sqlnocreate").isString().default("false"))

        ow.loadObj()
        if (!params.sqlnocreate) print(ow.obj.fromObj2DBTableCreate(params.sqltable, r, __, !params.sqlicase)+";\n")

        var okeys, ookeys = Object.keys(ow.obj.flatMap(r[0]))
        if (!params.sqlicase) 
            okeys = "\"" + ookeys.join("\", \"") + "\""
        else 
            okeys = ookeys.join(",").toUpperCase()

        let _parseVal = aValue => {
            var _value = ow.obj.flatMap(aValue)
            var values = [];
            for(var k in ookeys) {
                values.push(_value[ookeys[k]]);
            }
            var binds = ookeys.map(k => {
                var v = _value[k]
                if (isString(v)) v = "'" + v.replace(/'/g, "''") + "'"
                if (isNull(v))   v = "null"
                return v
            })
            var _sql = "INSERT INTO " + (!params.sqlicase ? "\"" + params.sqltable + "\"" : params.sqltable) + " (" + okeys + ") VALUES (" + binds.join(",") + ");"
            return _sql
        }

        print(r.map(_parseVal).join("\n"))
    }],
    ["xls", (r, options) => {
        if (!isString(r)) {
            try {
                includeOPack("plugin-XLS")
            } catch(e) {
                _exit(-1, "plugin-XLS not found. You need to install it to use the XLS output (opack install plugin-XLS)")
            }
    
            plugin("XLS")
            var ar
            if (isMap(r)) {
                ow.loadObj()
                var o = ow.obj.flatMap(r)
                ar = Object.keys(o).map(r => ({ key: r, value: o[r] }))
            }
            if (isArray(r)) {
                ar = r
            }
            traverse(ar, (aK, aV, aP, aO) => {
                if (isString(aV) && aV.startsWith("=")) aO[aK] = "'" + aV
            })
    
            var tempFile = false, origFile = params.xlsfile
            if (isUnDef(params.xlsfile)) {
                tempFile = true
                params.xlsfile = io.createTempFile("oafp", ".xlsx")
            }
  
            var xls = new XLS(isDef(origFile) && io.fileExists(origFile) ? origFile : __)
            var sheet = xls.getSheet(_$(params.xlssheet, "xlssheet").isString().default("data"))
            params.xlsformat = _$(params.xlsformat, "xlsformat").isString().default("(bold: true, borderBottom: \"medium\", borderBottomColor: \"red\")")
            params.xlsformat = _fromJSSLON(params.xlsformat)
            ow.format.xls.setTable(xls, sheet, "A", 1, ar, __, params.xlsformat)
            xls.writeFile(params.xlsfile)
            xls.close()
    
            params.xlsopenwait = _$(params.xlsopenwait, "xlsopenwait").isNumber().default(5000)
            params.xlsopen     = toBoolean(_$(params.xlsopen, "xlsopen").isString().default("true"))
            if (params.xlsopen) {
                if (ow.format.isWindows()) {
                    $sh("start " + params.xlsfile).exec()
                    if (tempFile) sleep(params.xlsopenwait, true)
                } else if (ow.format.getOS().startsWith("Mac")) {
                    $sh("open " + params.xlsfile).exec()
                    if (tempFile) sleep(params.xlsopenwait, true)
                } 
            }
        }
    }]
])
