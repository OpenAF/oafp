var _transformFns = {
    "transforms"    : _r => {
        if (toBoolean(params.transforms)) {
            var _t = Object.keys(_transformFns).filter(r => r != 'transforms').sort()
            return _t
        }
    },
    "cmlt"    : r => {
        if (toBoolean(params.cmlt)) {
            var _r = (isArray(r) ? r : [ r ])
            params.cmltch = _$(params.cmltch, "cmltch").or().isString().isMap().default("(type: simple)")
            let cmltch = _fromJSSLON(params.cmltch)
            if (isMap(cmltch)) {
                if (isUnDef(cmltch.type)) _exit(-1, "cmltch.type is not defined.")
                if (isDef(cmltch.lib)) loadLib(cmltch.lib)
                if ($ch().list().indexOf("oafp::cmltdata") < 0) {
                    if (cmltch.type == "remote") {
                        $ch("oafp::cmltdata").createRemote(cmltch.url)
                    } else {
                        $ch("oafp::cmltdata").create(cmltch.type, cmltch.options)
                    }
                    let _sz = Number(_$(params.cmltsize, "cmltsize").isNumber().default(100)) - 1
                    if (_sz > 0) $ch("oafp::cmltdata").subscribe(ow.ch.utils.getHousekeepSubscriber("oafp::cmltdata", _sz))
                }

                _r.forEach(_rt => $ch("oafp::cmltdata").set({ t: nowNano() }, _rt))
                return $ch("oafp::cmltdata").getAll()
            } else {
                _exit(-1, "Invalid cmltch parameter")
            }
        }
    },
    "diff": _r => {
        var _d = _fromJSSLON(params.diff)
        if (isMap(_d)) {
            if (!((isDef(_d.a) && isDef(_d.b)))) _exit(-1, "diff.a path and diff.b path are required.")

            loadDiff() 
            let _d1 = $path(_r, _d.a), _d2 = $path(_r, _d.b), _dt = __
            if (toBoolean(params.color)) {
                if (isUnDef(params.difftheme) && isDef(getEnv("OAFP_DIFFTHEME"))) params.difftheme = getEnv("OAFP_DIFFTHEME")
                _dt = _fromJSSLON(_$(params.difftheme, "difftheme").or().isString().isMap().default(""))
                _dt = merge({
                    added  : "GREEN",
                    removed: "RED",
                    common : "FAINT",
                    linenum: "ITALIC",
                    linediv: "FAINT",
                    linesep: "|"
                }, _dt)
            }

            let _f = (s, e1) => {
                if (toBoolean(params.color)) {
                    if (isUnDef(e1)) e1 = ""
                    var _o = new Set()
                    if (isArray(s)) {
                        let _c = 1
                        let _ssl = toBoolean(params.diffnlines), _mnl = 0
                        if (_ssl) {
                            s.forEach(v => {
                                _mnl += v.value.split("\n").length
                            })
                            _mnl = String(_mnl).length+1
                        }
                        let _sl = inc => {
                            let _o
                            if (_ssl && e1 != "") {
                                _o = ansiColor(_dt.linenum, (inc > 0 ? $ft("% " + _mnl + "d", _c) : " ".repeat(_mnl)) ) + ansiColor(_dt.linediv, `${_dt.linesep}`)
                            } else {
                                _o = ""
                            }
                            _c += inc
                            return _o
                        }
                        s.forEach((sr, i) => {
                            var _v = sr.value
                            if (isString(_v)) {
                                if (e1 != "") {
                                    _v = _v.split(e1)
                                    if (_v[_v.length - 1] == "") _v.pop()
                                } else {
                                    _v = [ _v ]
                                }
                            }
                            _o.add( (sr.added   ? _v.map(_l => _sl(1) + ansiColor(_dt.added,   (e1 != "" ? "+" : "") + _l) ).join(ansiColor("RESET", e1)) :
                                     sr.removed ? _v.map(_l => _sl(0) + ansiColor(_dt.removed, (e1 != "" ? "-" : "") + _l) ).join(ansiColor("RESET", e1)) :
                                                  _v.map(_l => _sl(1) + ansiColor(_dt.common,  (e1 != "" ? " " : "") + _l) ).join(ansiColor("RESET", e1)) ))
                        })
                    }
                    return Array.from(_o).join(ansiColor("RESET", e1))
                }
                
                return $from(s).select({count:__,added:false,removed:false,value:[]})
            }

            if (isString(_d1) && isString(_d2)) {
                if (toBoolean(params.diffwords)) {
                    return _f(JsDiff.diffWords(_d1, _d2, _d.options))
                } else if (toBoolean(params.diffwordswithspace)) {
                    return _f(JsDiff.diffWordsWithSpace(_d1, _d2, _d.options))
                } else if (toBoolean(params.difflines)) {
                    return _f(JsDiff.diffLines(_d1, _d2, _d.options), "\n")
                } else if (toBoolean(params.diffsentences)) {
                    return _f(JsDiff.diffSentences(_d1, _d2, _d.options), "\n")
                } else {
                    return _f(JsDiff.diffChars(_d1, _d2, _d.options))
                }
            } else {
                if (isArray(_d1) && isArray(_d2) && !toBoolean(params.color)) {
                    return _f(JsDiff.diffArrays(_d1, _d2, _d.options))
                } else {
                    return _f(JsDiff.diffJson(_d1, _d2, _d.options), "\n")
                }
            }
        }
    },
    "jsonschemagen" : _r => {
        if (toBoolean(params.jsonschemagen)) {
            ow.loadObj()
            var _js = ow.obj.schemaGenerator(_r)
            return _js
        }
    },
    "jsonschemacmd" : r => {
        return _transformFns["jsonschema"](r)
    },
    "jsonschema": r => {
        if (!isMap(r)) _exit(-1, "jsonschema is only supported with a map.")
        if (isUnDef(params.jsonschema) && isUnDef(params.jsonschemacmd)) _exit(-1, "You need to provide a jsonschema=someFile.json or jsonschemacmd=someCommand")
        
        ow.loadObj()
        var _s
        if (isDef(params.jsonschemacmd)) {
            var _cmd = $sh(params.jsonschemacmd).getJson(0)
            if (_cmd.exitcode == 0)
                _s = _cmd.stdout
            else
                _exit(-1, "Error executing the command '" + params.jsonschemacmd + "': " + _cmd.stderr)
        } else {
            _s = io.readFileJSON(params.jsonschema)
        }
        if (!isMap(_s)) _exit(-1, "The schema provided is not a valid JSON schema.")
        ow.obj.schemaInit({allErrors: true})
        var validate = ow.obj.schemaCompile(_s)
        var res = validate(r)
        return { valid: res, errors: validate.errors}
    },
    "sortmapkeys"   : _r => {
        if (toBoolean(params.sortmapkeys) && isObject(_r)) {
            let _sortMapKeys = (aMap, moreLevels) => {
                let keys = Object.keys(aMap).sort()
                let result = {}
            
                for(let i = 0; i < keys.length; i++) {
                    let key = keys[i]
                    let value = aMap[key]
            
                    if (Array.isArray(value)) {
                        result[key] = value.map(item => {
                            if (typeof item === 'object' && item !== null && item !== undefined) {
                                return sortMapKeys(item, moreLevels)
                            } else {
                                return item
                            }
                        })
                    } else if (moreLevels && typeof value === 'object' && value !== null && value !== undefined) {
                        result[key] = _sortMapKeys(value, moreLevels)
                    } else {
                        result[key] = value
                    }
                }
            
                return result
            }
            return _sortMapKeys(_r, true)
        } else {
            return _r
        }
    },
    "searchkeys"    : _r => (isObject(_r) ? searchKeys(_r, params.searchkeys) : _r),
    "searchvalues"  : _r => (isObject(_r) ? searchValues(_r, params.searchvalues) : _r),
    "maptoarray"    : _r => (toBoolean(params.maptoarray) && isMap(_r) ? $m4a(_r, params.maptoarraykey) : _r),
    "arraytomap"    : _r => (toBoolean(params.arraytomap) && isArray(_r) ? $a4m(_r, params.arraytomapkey, toBoolean(params.arraytomapkeepkey)) : _r),
    "flatmap"       : _r => (toBoolean(params.flatmap) && isObject(_r) ? ow.loadObj().flatMap(_r, params.flatmapsep) : _r),
    "merge"         : _r => {
        if (toBoolean(params.merge) && isArray(_r) && _r.length > 1) {
            var _rr
            for(var i = 0; i < _r.length; i++) {
                _rr = ( i == 0 ? _r[i] : merge(_rr, _r[i]) )
            }
            return _rr
        } else {
            return _r
        }
    },
    "correcttypes"  : _r => {
        if (toBoolean(params.correcttypes) && isObject(_r)) {
            traverse(_r, (aK, aV, aP, aO) => {
                switch(descType(aV)) {
                case "number": if (isString(aV)) aO[aK] = Number(aV); break
                case "string": 
                    // String boolean
                    if (aV.trim().toLowerCase() == "true" || aV.trim().toLowerCase() == "false") { aO[aK] = toBoolean(aV); break }
                    // String ISO date
                    if (isDef(ow.format.fromISODate)) {
                        if (aV.trim().match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\d+Z$/)) { aO[aK] = ow.format.fromISODate(aV); break }
                    } else {
                        if (aV.trim().match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)) { aO[aK] = new Date(aV); break }
                    }
                    // String date
                    if (aV.trim().match(/^\d{4}-\d{2}-\d{2}$/)) { aO[aK] = new Date(aV); break }
                    // String time with seconds
                    if (aV.trim().match(/^\d{2}:\d{2}:\d{2}$/)) { aO[aK] = new Date(aV); break }
                    // String time without seconds
                    if (aV.trim().match(/^\d{2}:\d{2}$/)) { aO[aK] = new Date(aV); break }
                    break
                }
            })
        }
        return _r
    },
    "removenulls": _r => {
        if (toBoolean(params.removenulls)) {
            traverse(_r, (aK, aV, aP, aO) => {
                if (isNull(aV) || isUnDef(aV)) delete aO[aK]
            })
        }
        return _r
    },
    "removeempty": _r => {
        if (toBoolean(params.removeempty)) {
            if (isArray(_r)) {
                return _r.filter(r => isDef(r) && !isNull(r))
            }
        }
        return _r
    },
    "trim": _r => {
        if (toBoolean(params.trim)) {
            traverse(_r, (aK, aV, aP, aO) => {
                if (isString(aV)) aO[aK] = aV.trim()
            })
        }
        return _r
    },
    "removedups": _r => {
        if (toBoolean(params.removedups)) {
            if (isArray(_r)) {
                var _dups = new Set()
                var _r2 = []
                _r.forEach(r => {
                    var rs = r
                    if (isObject(r)) rs = sortMapKeys(rs)
                    rs = stringify(rs, __, true)
                    if (!_dups.has(rs)) {
                        _dups.add(rs)
                        _r2.push(r)
                    }
                })
                return _r2
            } else {
                _exit(-1, "removedups is only supported for arrays")
            }
        }
        return _r
    },
    "llmprompt": _r => {
        if (isString(params.llmprompt)) {
            params.llmenv     = _$(params.llmenv, "llmenv").isString().default("OAFP_MODEL")
            params.llmoptions = _$(params.llmoptions, "llmoptions").isString().default(__)
            if (isUnDef(params.llmoptions) && !isString(getEnv(params.llmenv))) 
                _exit(-1, "llmoptions not defined and " + params.llmenv + " not found.")

            var res = $llm( _getSec(isDef(params.llmoptions) ? params.llmoptions : $sec("system", "envs").get(params.llmenv)) )
            if (isDef(params.llmconversation) && io.fileExists(params.llmconversation)) 
                res.getGPT().setConversation(io.readFileJSON(params.llmconversation))
            var type = "json", shouldStr = true
            if (isString(params.in)) {
                if (params.in == "md") {
                    type = "markdown"
                    shouldStr = false
                }
                if (params.in == "mdtable") {
                    type = "markdown table"
                    shouldStr = false
                }
                if (params.in == "hsperf") type = "java hsperf file"
                if (params.in == "raw") {
                    type = "raw"
                    shouldStr = false
                }
            }
            
            res = res.withContext(shouldStr ? stringify(_r,__,true) : _r, (isDef(params.llmcontext) ? params.llmcontext : `${type} input data`))
            if (isString(params.out)) {
                if (params.out == "md" || params.out == "mdtable" || params.out == "raw") {
                    cprint(res.getGPT().getConversation())
                    let _res = res.prompt(params.llmprompt)
                    if (isDef(params.llmconversation)) io.writeFileJSON( params.llmconversation, res.getGPT().getConversation(), "" )
                    return _res
                }
            }
            let _res = res.promptJSON(params.llmprompt)
            if (isDef(params.llmconversation)) io.writeFileJSON( params.llmconversation, res.getGPT().getConversation(), "" )
            return _res
        }
        return _r
    },
    "splitlines": _r => { 
        if (toBoolean(params.splitlines) && isString(_r)) return _r.split(/\r?\n/)
        return _r
    },
    "regression": _r => {
        if (isString(params.regression)) {
            ow.loadAI()
            var rg = ow.ai.regression()
            let regressionpath    = _$(params.regressionpath, "regressionpath").isString().default("@")
            let regressionoptions = _fromJSSLON(_$(params.regressionoptions, "regressionoptions").or().isString().isMap().default("{order:2,precision:5}"))
            let _data = $path(_r, regressionpath)
            if (isArray(_data)) {
                if (isString(params.regressionx)) {
                    let _datax = $path(_r, params.regressionx)
                    _data = _data.map((v, i) => ([ _datax[i], v ]))
                } else {
                    _data = _data.map((v, i) => ([ i+1, v ]))
                }
                let _rr
                switch(params.regression) {
                case "exp"   : _rr = rg.exponential(_data, regressionoptions); break
                case "poly"  : _rr = rg.polynomial(_data, regressionoptions); break
                case "power" : _rr = rg.power(_data, regressionoptions); break
                case "log"   : _rr = rg.logarithmic(_data, regressionoptions); break
                case "linear": 
                default      : _rr = rg.linear(_data, regressionoptions); break
                }

                if (isDef(_rr) && isDef(_rr.points)) {
                    if (isString(params.regressionforecast)) {
                        var _f = $path(_r, params.regressionforecast)
                        if (isArray(_f)) {
                            _f.forEach(x => {
                                _rr.points.push(_rr.predict(x))
                            })
                        } else {
                            _exit(-1, "Invalid array of x for regression forecast")
                        }
                    }
                    return _rr.points.map(p => ({ x: p[0], y: p[1] }))
                } else {
                    return _rr
                }
            } else {
                _exit(-1, "Invalid data for regression analysis")
            }
        }
        return _r
    },
    "normalize": _r => {
        if (isString(params.normalize) || isMap(params.normalize)) {
            var _s = _fromJSSLON(params.normalize)
            if (isMap(_s)) {
                ow.loadAI()
                if (isMap(_r))   return ow.ai.normalize.withSchema(_r, _s, true)
                if (isArray(_r)) return _r.map(r => ow.ai.normalize.withSchema(r, _s, true))
            } else {
                _exit(-1, "Invalid normalize schema")
            }
        } else {
            _exit(-1, "Invalid normalize schema")
        }
    },
    "denormalize": _r => {
        if (isString(params.denormalize) || isMap(params.denormalize)) {
            var _s = _fromJSSLON(params.denormalize)
            if (isMap(_s)) {
                ow.loadAI()
                if (isUnDef(ow.ai.normalize.denormalizeWithSchema)) _exit(-1, "This version of OpenAF does not support denormalizeWithSchema")
                
                if (isMap(_r))   return ow.ai.normalize.denormalizeWithSchema(_r, _s, false)
                if (isArray(_r)) return _r.map(r => ow.ai.normalize.denormalizeWithSchema(r, _s, false))
            } else {
                _exit(-1, "Invalid denormalize schema")
            }
        } else {
            _exit(-1, "Invalid denormalize schema")
        }
    },
    "kmeans": _r => {
        if (!isNumber(params.kmeans)) params.kmeans = 5
        if (!isArray(_r)) _exit(-1, "For kmeans transform you need to provide an array as input")
        ow.loadAI()
        var _kmeans = ow.ai.cluster({ type: "kmeans", numberOfClusters: Number(params.kmeans) })
        return _kmeans.classify(_r)
    },
    "getlist": _r => {
        if (isObject(_r) && (toBoolean(params.getlist) || isNumber(params.getlist)) ) {
            var found = false, _nr, num = isNumber(params.getlist) ? params.getlist : 1
            traverse(_r, (aK, aV, aP, aO) => {
                if (!found && isArray(aV)) {
                    num--
                    if (num == 0) found = true
                    _nr = aV
                }
            })
            if (found)
                return _nr
            else
                return _r
        }
    },
    "set": _r => {
        var _d = _fromJSSLON(params.set)

        if (!isMap(_d) && isUnDef(_d.a) && isUnDef(_d.b)) _exit(-1, "set.a path and set.b path are required.")
        if (isUnDef(pForEach)) _exit(-1, "This version of OpenAF does not support the set transform")
        if (!isString(_d.a)) _exit(-1, "set.a path is not a string.")
        if (!isString(_d.b)) _exit(-1, "set.b path is not a string.")

        let _d1 = $path(_r, _d.a), _d2 = $path(_r, _d.b)
        if (!isArray(_d1)) _exit(-1, "set.a path result is not an array.")
        if (!isArray(_d2)) _exit(-1, "set.b path result is not an array.")

        let toOrdStr, toOrdStrs
        if (isString(params.setkeys)) {
            ow.loadObj()
            var _ks = params.setkeys.split(",").map(r => r.trim())
            toOrdStr  = r => stringify(isObject(r) ? sortMapKeys(ow.obj.filterKeys(_ks, r), true) : r, __, "")
            toOrdStrs = r => pForEach(r, toOrdStr).reduce((pV, cV) => pV.concat(cV), [])
        } else {
            toOrdStr  = r => stringify(isObject(r) ? sortMapKeys(r, true) : r, __, "")
            toOrdStrs = r => pForEach(r, toOrdStr).reduce((pV, cV) => pV.concat(cV), [])
        }

        switch(params.setop) {
        case "union"    :
            let ca = new Set(toOrdStrs(_d1))
            return _d1.concat(_d2.filter(r => !ca.has(toOrdStr(r))))
        case "diffa"    :
            let cb2 = new Set(toOrdStrs(_d2))
            return _d1.filter(r => !cb2.has(toOrdStr(r)))
        case "diffb"    :
            let cb3 = new Set(toOrdStrs(_d1))
            return _d2.filter(r => !cb3.has(toOrdStr(r)))
        case "diffab"   :
            let cb4 = new Set(toOrdStrs(_d1))
            let cb5 = new Set(toOrdStrs(_d2))
            return _d1.filter(r => !cb5.has(toOrdStr(r))).concat(_d2.filter(r => !cb4.has(toOrdStr(r))))
        case "diff"     :
            let cb6 = new Set(toOrdStrs(_d1))
            let cb7 = new Set(toOrdStrs(_d2))
            return            _d1.map(r => Object.assign({ '*': cb7.has(toOrdStr(r)) ? __ : "a" }, r))
                      .concat(_d2.map(r => Object.assign({ '*': cb6.has(toOrdStr(r)) ? __ : "b" }, r)))
                      .filter(r => isDef(r['*']))
        case "intersect":
        default         :
            let cb1 = new Set(toOrdStrs(_d2))
            return _d1.filter(r => cb1.has(toOrdStr(r)))
        }
    },
    "forcearray": _r => {
        if (isMap(_r))
            return [ _r ]
        else
            return _r
    },
    "spacekeys": _r => {
        if (isMap(_r)) {
            traverse(_r, (aK, aV, aP, aO) => {
                if (aK.indexOf(" ") >= 0) {
                    aO[aK.replace(/ /g, params.spacekeys || "_")] = aV
                    delete aO[aK]
                }
            })
        }
        return _r
    },
    "numformat": _r => {
        traverse(_r, (aK, aV, aP, aO) => {
            if (isTNumber(aV) && isString(params.numformat)) {
                aO[aK] = $ft(params.numformat, aV)
            }
        })
        return _r
    },
    "xjs": _r => {
        if (isString(params.xjs)) {
            if (io.fileExists(params.xjs)) {
                var _t = io.readFileString(params.xjs)
                if (isString(_t)) {
                    var _f = new Function("args", _t + "; return args")
                    return _f(_r)
                }
            }
        }
        return _r
    },
    "xpy": _r => {
        if (isString(params.xpy)) {
            if (io.fileExists(params.xpy)) {
                let __r = $py(params.xpy, { args: _r}, ["args"])
                $pyStop()
                return __r
            }
        }
        return _r
    },
    "xfn": _r => {
        if (isString(params.xfn)) {
            var _f = new Function("args", "return " + params.xfn)
            return _f(_r)
        }
    },
    "xrjs": _r => {
        if (isString(params.xrjs) && isArray(_r)) {
            if (io.fileExists(params.xrjs)) {
                let _t = io.readFileString(params.xrjs)
                if (isString(_t)) {
                    let _f = new Function("args", _t + "; return args")
                    return pForEach(_r, _f)
                }
            }
        }
        return _r
    },
    "xrpy": _r => {
        if (isString(params.xrpy) && isArray(_r)) {
            if (io.fileExists(params.xrpy)) {
                $pyStart()
                let __r = pForEach(_r, r => $py(params.xrpy, { args: r}, ["args"]) )
                $pyStop()
                return __r
            }
        }
        return _r
    },
    "xrfn": _r => {
        if (isString(params.xrfn) && isArray(_r)) {
            let _f = new Function("args", "return " + params.xrfn)
            return pForEach(_r, _f)
        }
        return _r
    },
    "val2icon": _r => {
        let _t = {
            d: [ "🕳️", "✅", "❌" ],
            s: [ "╍", "✓", "✕" ]
        }
        if (isDef(params.val2icon)) {
            var th
            switch(params.val2icon) {
            case "simple": th = _t.s; break
            default      :
            case "default": th = _t.d; break
            }

            traverse(_r, (aK, aV, aP, aO) => {
                if (isUnDef(aV) || isNull(aV)) {
                    aO[aK] = th[0]
                } else {
                    if (isBoolean(aV)) {
                        aO[aK] = aV ? th[1] : th[2]
                    }
                }
            })
        }
        return _r
    },
    "field2date": _r => {
        let _lst = params.field2date.split(",").map(r => r.trim())
        traverse(_r, (aK, aV, aP, aO) => {
            if (_lst.indexOf(aP.length > 0 && !aP.startsWith("[") ? aP.substring(1) + "." + aK : aK) >= 0 && isNumber(aV) && aV > 0) {
                try { aO[aK] = isString(aV) ? ow.format.fromISODate(aV) : new Date(aV) } catch(e) { printErr(e) }
            }
        })
        return _r
    },
    "field2si": _r => {
        let _lst = params.field2si.split(",").map(r => r.trim())
        traverse(_r, (aK, aV, aP, aO) => {
            if (_lst.indexOf(aP.length > 0 && !aP.startsWith("[") ? aP.substring(1) + "." + aK : aK) >= 0 && isNumber(aV)) {
                aO[aK] = ow.format.toAbbreviation(aV)
            }
        })
        return _r
    },
    "field2byte": _r => {
        let _lst = params.field2byte.split(",").map(r => r.trim())
        traverse(_r, (aK, aV, aP, aO) => {
            if (_lst.indexOf(aP.length > 0 && !aP.startsWith("[") ? aP.substring(1) + "." + aK : aK) >= 0 && isNumber(aV)) {
                aO[aK] = ow.format.toBytesAbbreviation(aV)
            }
        })
        return _r
    },
    "field4map": _r => {
        let _lst = params.field4map.split(",").map(r => r.trim())
        traverse(_r, (aK, aV, aP, aO) => {
            if (_lst.indexOf(aP.length > 0 && !aP.startsWith("[") ? aP.substring(1) + "." + aK : aK) >= 0 && isString(aV)) {
                aO[aK] = _fromJSSLON(aV)
            }
        })
        return _r
    },
    "field2str": _r => {
        let _lst = params.field2str.split(",").map(r => r.trim())
        traverse(_r, (aK, aV, aP, aO) => {
            if (_lst.indexOf(aP.length > 0 && !aP.startsWith("[") ? aP.substring(1) + "." + aK : aK) >= 0 && !isString(aV)) {
                aO[aK] = isMap(aO[aK]) || isArray(aO[aK]) ? af.toSLON(aO[aK]) : String(aO[aK])
            }
        })
        return _r
    },
    "allstrings": _r => {
        if (toBoolean(params.allstrings)) {
            traverse(_r, (aK, aV, aP, aO) => {
                if (isDef(aV) && !isString(aV)) {
                    if (isNumber(aV)) {
                        aO[aK] = String(aV)
                    } else if (isBoolean(aV)) {
                        aO[aK] = String(aV)
                    } else if (isNull(aV)) {
                        aO[aK] = ""
                    }
                }
            })
        }
        return _r
    },
    "oaf": _r => {
        if (isString(params.oaf)) {
            let _t
            if (io.fileExists(params.oaf)) {
                _t = io.readFileString(params.oaf)
            } else {
                _t = params.oaf
            }
            if (isString(_t)) {
                let _f = new Function("data", _t + ";return data")
                return _f(_r)
            }
        }
        return _r
    }
}