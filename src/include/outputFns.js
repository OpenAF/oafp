var _outputFns = new Map([
    ["?" , (r, options) => {
        r = Array.from(_outputFns.keys()).filter(r => r != '?').sort()
        _o$o(r, options)
    }],
    ["pm", (r, options) => {
        _o$o(r, options)
    }],
    ["key", (r, options) => {
        _o$o(r, options)
    }],
    ["html", (r, options) => {
        let html, tmpf, res = false

        params.htmlopen = toBoolean(_$(params.htmlopen, "htmlopen").isString().default("true"))
        params.htmlwait = _$(params.htmlwait, "htmlwait").isNumber().default(2500)

        if (params.htmlopen) tmpf = io.createTempFile("oafp_", ".html")

        ow.loadTemplate()
        if (isString(r)) {
            html = ow.template.html.genStaticVersion(ow.template.parseMD2HTML(r, !toBoolean(params.htmlpart), !toBoolean(params.htmlcompact)))
            html = html.replace("<html>", "<html><meta charset=\"utf-8\">")
        } else {
            let _res = ow.template.html.parseMap(r, true)
            html = "<html><meta charset=\"utf-8\"><style>" + _res.css + "</style><body>" + _res.out + "</body></html>"
        }
        if (params.htmlopen) {
            io.writeFileString(tmpf, html)
            res = openInBrowser("file:///" + tmpf.replace(/\\/g, "/"))
        }
        if (res) {
            sleep(params.htmlwait, true)
        } else {
            _print(html)
        }
    }],
    ["ctable", (r, options) => {
        _o$o(r, options)
    }],
    ["stable", (r, options) => {
        _o$o(r, options)
    }],
    ["table", (r, options) => {
        _o$o(r, options)
    }],
    ["json", (r, options) => {
        _o$o(r, options)
    }],
    ["yaml", (r, options) => {
        _o$o(r, options)
    }],
    ["cyaml", (r, options) => {
        _o$o(r, options)
    }],
    ["cjson", (r, options) => {
        _o$o(r, options)
    }],
    ["slon", (r, options) => {
        _o$o(r, options)
    }],
    ["cslon", (r, options) => {
        _o$o(r, options)
    }],
    ["ctree", (r, options) => {
        _o$o(r, options)
    }],
    ["tree", (r, options) => {
        _o$o(r, options)
    }],
    ["res", (r, options) => {
        _o$o(r, options)
    }],
    ["key", (r, options) => {
        _o$o(r, options)
    }],
    ["text", (r, options) => {
        _o$o(r, options)
    }],
    ["csv", (r, options) => {
        _o$o(r, options)
    }],
    ["map", (r, options) => {
        _o$o(r, options)
    }],
    ["md", (r, options) => {
        _o$o((toBoolean(params.mdtemplate) ? $t(r) : r), options)
    }],
    ["log", (r, options) => {
        if (isString(r) && toBoolean(params.logprintall)) {
            _print(r.replace(/\n$/, ""))
        } else {
            var _arr = r
            if (isMap(r)) _arr = [ r ]
            if (isArray(_arr)) {
                if (isUnDef(params.logtheme) && isDef(getEnv("OAFP_LOGTHEME"))) params.logtheme = getEnv("OAFP_LOGTHEME")
                let _lt = _fromJSSLON(_$(params.logtheme, "logtheme").isString().default(""))
                _lt = merge({
                    errorLevel: "RED,BOLD",
                    warnLevel : "YELLOW",
                    timestamp : "BOLD"
                }, _lt)
                _arr.forEach(_r => {
                    if (isMap(_r)) {
                        let d = (isDef(_r["@timestamp"]) && isString(_r["@timestamp"]) ? _r["@timestamp"] : __)
                        let l = (isDef(_r.level) ? _r.level : __)
                        let m = (isDef(_r.message) ? _r.message : __)
                        let lineC
                        if (isDef(l)) {
                            if (l.toLowerCase().indexOf("err") >= 0)  lineC = _lt.errorLevel
                            if (l.toLowerCase().indexOf("warn") >= 0) lineC = _lt.warnLevel
                        }
                        if (isDef(d) && d.length > 24) d = d.substring(0, 23) + "Z"
                        if (isDef(m) || isDef(d)) _print(ansiColor(_lt.timestamp, d) + (isDef(l) ? " | " + ansiColor(lineC, l) : "") + " | " + ansiColor(lineC, m))
                    }
                })
            }
        }
    }],
    ["raw", (r, options) => {
        if (isString(r))
            _print(r)
        else
            _print(stringify(r))
    }],
    ["lines", (r, options) => {
        if (isArray(r)) {
            r.forEach(_r => _print(_r))
        } else {
            _print(r)
        }
    }],
    ["ini", (r, options) => {
        if (!isString(r)) {
            ow.loadJava()
            var ini = new ow.java.ini()
            _print( ini.put(r).save() )
        }
    }],
    ["toml", (r, options) => {
        if (isUnDef(af.toTOML)) _exit(-1, "TOML support not found.")
        if (isMap(r)) {
            _print( af.toTOML(r) )
        } else if (isArray(r)) {
            _print( af.toTOML({ list: r}) )
        } else {
            return __
        }
    }],
    ["mdyaml", (r, options) => {
        if (isArray(r)) {
            r.forEach((_y, i) => {
                _o$o(_y, merge(options, { __format: "yaml" }))
                if (i < r.length - 1) _print("---\n")
            })
        } else {
            _o$o(r, merge(options, { __format: "yaml" }))
        }
    }],
    ["mdtable", (r, options) => {
        if (isArray(r)) {
            ow.loadTemplate()
            _print( ow.template.md.table(r) )
        }
    }],
    ["template", (r, options) => {
        if (!isString(r)) {
            ow.loadTemplate()
            ow.template.addConditionalHelpers()
            ow.template.addOpenAFHelpers()
            ow.template.addFormatHelpers()
            if (isUnDef(params.template) && isUnDef(params.templatepath)) _exit(-1, "For out=template you need to provide a template=someFile.hbs or templatepath=...")
            params.templatedata = _$(params.templatedata, "templatedata").isString().default("@")
            
            var tmpl
            if (isDef(params.template)) {
                if (toBoolean(params.templatetmpl)) {
                    tmpl = params.template
                } else {
                    tmpl = io.readFileString(params.template)
                }
            } else {
                tmpl = $path(params.__origr, params.templatepath)
            }
            //_print($t( isUnDef(params.template) ? $path(params.__origr, params.templatepath) : ( isDef(params.templatetmpl) ? params.templatetmpl : io.readFileString(params.template) ), $path(r, params.templatedata) ) )
            _print($t(tmpl, $path(r, params.templatedata)))
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
            _print(_out)
        } else {
            _exit(-1, "For out=openmetrics input needs to be an array or map.")
        }
    }],
    ["pjson", (r, options) => {
        options.__format = "prettyjson"
        _o$o(r, options)
    }],
    ["ndjson", (r, options) => {
        if (isArray(r)) {
            r.forEach(_r => _print(stringify(_r, __, "")))
        } else if (isMap(r)) {
            _print(stringify(r, __, ""))
        } else {
            _o$o(r, options)
        }
    }],
    ["base64", (r, options) => {
        var _o = ""
        if (isString(r))
            _o = r
        else
            _o = stringify(r)

        if (toBoolean(params.base64gzip)) {
            _print(af.fromBytes2String(af.toBase64Bytes(io.gzip(af.fromString2Bytes(_o)))))
        } else {
            _print(af.fromBytes2String(af.toBase64Bytes(_o)))
        }
    }],
    ["gb64json", (r, options) => {
        var _o = ""
        if (isString(r))
            _o = r
        else
            _o = stringify(r)

        _print(af.fromBytes2String(af.toBase64Bytes(io.gzip(af.fromString2Bytes(_o)))))
    }],
    ["jwt", (r, options) => {
        if (isMap(r)) {
            if (isUnDef(params.jwtsecret) && isUnDef(params.jwtprivkey)) _exit(-1, "For out=jwt you need to provide a jwtsecret or a jwtprivkey")
            //if (isDef(params.jwtalg)) _exit(-1, "For out=jwt you need to provide a jwtalg")
            ow.loadServer()
            
            if (isDef(params.jwtprivkey)) {
                ow.loadJava()
                var c = new ow.java.cipher()
                _print(ow.server.jwt.sign(c.readKey4File(params.jwtprivkey, true, params.jwtalg), r))
            } else {
                _print(ow.server.jwt.sign(params.jwtsecret, r))
            }
        } else {
            _exit(-1, "For out=jwt input needs to be a map.")
        }
    }],   
    ["grid" , (r, options) => {
        if (isUnDef(params.grid)) _exit(-1, "For out=grid you need to provide a grid=...")
        let _f = _fromJSSLON(_$(params.grid, "grid").isString().$_())

        if (isArray(_f) && _f.length > 0 && isArray(_f[0])) {
            _f.forEach((y, yi) => {
                y.forEach((x, xi) => {
                    let _rd
                    if (isUnDef(x.type) || x.type != "empty") {
                        if (isDef(x.cmd)) {
                            var _cr = $sh(x.cmd).getJson(0)
                            if (isDef(_cr) && isDef(_cr.stdout)) 
                                _rd = _cr.stdout
                            else
                                _rd = ""
                        } else {
                            _rd = r
                        }
                        if (x.type == "chart" || x.type == "bar") {
                            var _n = "_chrt" + (yi+1) + "." + (xi+1)
                            x.obj = (x.type == "chart" ? _n + " " : "") + _chartPathParse(_rd, x.obj, _n)
                            if (isUnDef(x.title)) x.title = "Chart " + _n
                        }
                        if (isDef(x.path)) {
                            x.obj = $path(_rd, x.path)
                            if (isUnDef(x.title)) x.title = x.path
                        } else {
                            if (isString(_rd)) 
                                x.obj = _rd
                            else if (isObject(_rd) && x.type != "chart")
                                x.obj = $path(_rd, "@")
                        }
                    } else {
                        x.obj = ""
                    }
                })
            })
            let _out = ow.format.string.grid(_f, __, __, " ", true)
            _print(_out)
        } else {
            _exit(-1, "Invalid grid parameter: '" + stringify(params.grid, __, "") + "'")
        }
    }],
    ["envs", (r, options) => {
        var res
        if (isArray(r)) {
            res = r.map(_r => isObject(_r) ? ow.loadObj().flatMap(_r, "_") : _r)
        } else {
            res = ow.loadObj().flatMap(r, "_")
        }
        var crt = k => params.envsprefix + k.replace(/[^a-zA-Z0-9_]/g, '_')
        var vcrt = v => String(v).indexOf(" ") >= 0 ? "\"" + v + "\"" : v

        if (isUnDef(params.envscmd)) params.envscmd = (ow.format.isWindows() ? "set" : "export")
        params.envscmd = String(params.envscmd)

        if (isUnDef(params.envsprefix)) params.envsprefix = "_OAFP_"
        params.envsprefix = String(params.envsprefix)

        var out = new Set()
        for (var k in res) {
            out.add(params.envscmd + (params.envscmd.length > 0 ? " " : "") + crt(k) + "=" + vcrt(res[k]))
        }
        _print(Array.from(out).join("\n"))
    }],
    ["cmd", (r, options) => {
        if (!isString(params.outcmd)) _exit(-1, "For out=cmd you need to provide a outcmd=\"...\"")
        if (toBoolean(params.outcmdtmpl)) {
            ow.loadTemplate()
            ow.template.addConditionalHelpers()
            ow.template.addOpenAFHelpers()
            ow.template.addFormatHelpers()
        }

        let _exe = data => {
            var _s, _d = isString(data) ? data : stringify(data, __, "")
            if (toBoolean(params.outcmdparam)) {
                try {
                _s = $sh(params.outcmd.replace(/([^\\]?){}/g, "$1"+_d)).get(0)
                } catch(e) {sprintErr(e)}
            } else if (toBoolean(params.outcmdtmpl)) {
                _s = $sh($t(params.outcmd, data)).get(0)
            } else {
                _s = $sh(params.outcmd, _d).get(0)
            }
            if (toBoolean(params.outcmdnl)) {
                if (_s.stdout.length > 0) print(_s.stdout)
                if (_s.stderr.length > 0) printErr(_s.stderr)
            } else {
                if (_s.stdout.length > 0) printnl(_s.stdout)
                if (_s.stderr.length > 0) printErrnl(_s.stderr)
            }
        }

        if (isArray(r)) {
            if (toBoolean(params.outcmdjoin)) {
                _exe(r)
            } else {
                if (toBoolean(params.outcmdseq)) {
                    r.forEach(_exe)
                } else {
                    if (isDef(pForEach)) {
                        pForEach(r, _r => {
                            _exe(_r)
                        })
                    } else {
                        parallel4Array(r, _r => {
                            _exe(_r)
                        })
                    }
                }
            }
        } else {
            if (isString(r))
                _exe(r)
            else
                _exe(r)
        }
    }],
    ["chart", (r, options) => {
        if (isUnDef(params.chart)) _exit(-1, "For out=chart you need to provide a chart=\"<units> [<path[:color][:legend]>...]\"")
        if (isUnDef(splitBySepWithEnc)) _exit(-1, "output=chart is not supported in this version of OpenAF")

        let fmt = _chartPathParse(r, params.chart)
        if (fmt.length > 0) {
            var _out = printChart("oafp " + fmt)
            if (toBoolean(params.chartcls)) cls()
            _print(_out)
        }

    }],
    ["schart", (r, options) => {
        if (isUnDef(params.schart)) _exit(-1, "For out=schart you need to provide a schart=\"<units> [<path[:color][:legend]>...]\"")
        if (isUnDef(splitBySepWithEnc)) _exit(-1, "Output=schart is not supported in this version of OpenAF")

        let fmt = _chartPathParse(r, params.schart, "_oafp_sfn_", "soafp")
        if (fmt.length > 0) {
            _print(printChart("soafp " + fmt))
        }
    }],
    ["ch", (r, options) => {
        if (isUnDef(params.ch))    _exit(-1, "For out=ch you need to provide a ch=\"(type: ...)\"")
        if (isUnDef(params.chkey)) _exit(-1, "For out=ch you need to provide a chkey=\"key1, key2\"")

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
        if (!params.sqlnocreate) _print(ow.obj.fromObj2DBTableCreate(params.sqltable, r, __, !params.sqlicase)+";\n")

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

        _print(r.map(_parseVal).join("\n"))
    }],
    ["xml", (r, options) => {
        _o$o(r, options)
    }],
    ["pxml", (r, options) => {
        var _r = af.fromObj2XML(r, true)
        _print('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + new XMLList(_r))
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
