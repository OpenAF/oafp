#!/usr/bin/env /Applications/OpenAF/oaf-sb

var params = processExpr(" ");
// sprint(params)

var _params = processExpr(" ")
// Author : Nuno Aguiar
const oafp = params => {
if (isUnDef(params) || isDef(params.____ojob)) return 

// Process secBuckets
if (isDef($sec().procMap)) params = $sec().procMap(params)

// Ensure params are interpreted as lower case
Object.keys(params).forEach(pk => {
    if (params[pk].length > 0) {
        var npk = pk.toLowerCase()
        if (pk != npk && isUnDef(params[npk])) {
            params[npk] = params[pk]
            delete params[pk]
        }
    }
})

// --- Util functions
!__loadedLibs['include/utilFns.js'] && loadDebug("include/utilFns.js");__loadedLibs['include/utilFns.js']=true
// ---

// Exit function
const _exit = (code, msg) => {
    if (isUnDef(msg)) msg = "exit: " + code
    if (isUnDef(ow.oJob) && !toBoolean(params.noexit)) {
        if (code != 0) printErr(msg)
        exit(code)
    } else {
        throw msg
    }
}

const showHelp = () => {
    __initializeCon()

    var _ff
    params.help = _$(params.help, "help").isString().default("")

    var _f
    switch(params.help.toLowerCase()) {
    case "filters" : _ff = "docs/FILTERS.md"; break
    case "template": _ff = "docs/TEMPLATE.md"; break
    case "examples": _ff = "docs/EXAMPLES.md"; break
    case "readme"  :
    case "usage"   : _ff = "docs/USAGE.md"; break
    default        : 
        var _r = params.help.toLowerCase()
        if (isDef(_oafhelp_libs[_r]))
            _ff = "docs/" + _r + ".md"
        else
            _ff = "docs/USAGE.md"
    }

    _f = (getOPackPath("oafproc") || ".") + "/" + _ff

    let _customHelp = ""
    if (_ff == "docs/USAGE.md" && Object.keys(_oafhelp_libs).length > 0) {
        _customHelp = "\n---\n\n## 📚 Libs help documents\n\n| Lib | Help |\n| --- | --- |\n"
        for (let key in _oafhelp_libs) {
            _customHelp += "| " + key + " | help=" + key + " |\n"
        }
    }

    if (isDef(_f) && io.fileExists(_f)) {
        __ansiColorFlag = true
		__conConsole = true
        if (isDef(ow.format.string.pauseString) && toBoolean(params.pause))
            ow.format.string.pauseString( ow.format.withMD( io.readFileString(_f) + _customHelp ) )
        else
            _print((isDef(params.out) && params.out == "raw") ? io.readFileString(_f) + _customHelp : ow.format.withMD( io.readFileString(_f) + _customHelp ))
    } else {
        if (isDef(global._oafphelp) && isDef(global._oafphelp[_ff])) {
            __ansiColorFlag = true
            __conConsole = true
            if (isDef(ow.format.string.pauseString) && toBoolean(params.pause))
                ow.format.string.pauseString( ow.format.withMD( global._oafphelp[_ff] + _customHelp ) )
            else
                _print((isDef(params.out) && params.out == "raw") ? global._oafphelp[_ff] + _customHelp : ow.format.withMD( global._oafphelp[_ff] + _customHelp))
        } else {
            if (isString(_oafhelp_libs[params.help])) {
                __ansiColorFlag = true
                __conConsole = true
                if (isDef(ow.format.string.pauseString) && toBoolean(params.pause))
                    ow.format.string.pauseString( ow.format.withMD( _oafhelp_libs[params.help] ) )
                else
                    _print((isDef(params.out) && params.out == "raw") ? _oafhelp_libs[params.help] : ow.format.withMD( _oafhelp_libs[params.help] ))
            } else {
                _print("Check https://github.com/OpenAF/oafp/blob/master/src/" + _ff)
            }
        }
    }

    _exit(0)
}

const showVersion = () => {
    var _ff = (getOPackPath("oafproc") || ".") + "/.package.yaml"
    var oafpv = (io.fileExists(_ff) ? io.readFileYAML(_ff).version : "(not available/embedded)")
    var _v = {
        oafp: {
            version: oafpv,
            inputs: Array.from(_inputFns.keys()).filter(r => r != '?').sort(),
            transforms: Object.keys(_transformFns).filter(r => r != 'transforms').sort(),
            outputs: Array.from(_outputFns.keys()).filter(r => r != '?').sort(),
            flags: __flags.OAFP
        },
        openaf: {
            version: getVersion(),
            distribution: getDistribution(),
            home: getOpenAFPath(),
            opacks: $from($m4a(getOPackLocalDB())).notEquals("name", "OpenAF").sort("name").select({ name: "", version: ""})
        },
        java: {
            version: ow.format.getJavaVersion(),
            home: ow.format.getJavaHome(),
            vendor: String(java.lang.System.getProperty("java.vendor")),
            params: af.fromJavaArray(java.lang.management.ManagementFactory.getRuntimeMXBean().getInputArguments())
        },
        os: {
            name: String(java.lang.System.getProperty("os.name")),
            version: String(java.lang.System.getProperty("os.version")),
            arch: ow.format.getOSArch(),
            cpuCores: getNumberOfCores(true),
            mem: {
                max: Number(java.lang.Runtime.getRuntime().maxMemory()),
                total: Number(java.lang.Runtime.getRuntime().totalMemory())
            },
            store: {
                tmpDirPath: String(java.lang.System.getProperty("java.io.tmpdir")),
                freeTmpDirBytes: Number(java.nio.file.Files.getFileStore(java.nio.file.Paths.get(java.lang.System.getProperty("java.io.tmpdir"))).getUsableSpace()),
            }
        }
    }
    return stringify(_v, __, "")
}

ow.loadFormat()

params.format = params.output || params.format || params.out, params.type = params.input || params.type || params.in
params.out = params.format
params.output = params.format
params.in = params.type
params.input = params.type

// Check if file is provided
if ("undefined" == typeof params.file && "undefined" == typeof params.cmd && "undefined" == typeof params.data && "undefined" == typeof params.url) {
    let _found = __
    for (let key in params) {
        if ("undefined" == typeof _found && params[key] === "" && key != "-debug" && key != "-v" && key != "-examples") {
            _found = key
            break;
        }
    }
    params.file = _found
}

params.debug = toBoolean(params.debug)
if (isDef(params["-debug"])) params.debug = true

// Verify the data param
if ("[object Object]" == Object.prototype.toString.call(params.data)) {
    params.data = stringify(params.data, __, "")
}

// --- File extensions list
const _fileExtensions = new Map(io.readFileJSON("include/fileExtensions.json"))
// --- add extra _fileExtensions here ---
const _addSrcFileExtensions = (ext, type) => {
    if (!_fileExtensions.has(ext)) {
        _fileExtensions.set(ext, type)
    } else {
        if (params.debug) printErr("WARN: Extension '" + ext + "' already exists.")
    }
}

// --- List of input types that should not be stored in memory
var _inputNoMem = new Set(io.readFileJSON("include/fileExtensionsNoMem.json"))
// --- add extra _inputNoMem here ---
const _addSrcFileExtensionsNoMem = ext => {
    if (!_inputNoMem.has(ext)) {
        _inputNoMem.add(ext)
    } else {
        if (params.debug) printErr("WARN: Extension '" + ext + "' already exists.")
    }
}

// --- Input functions processing per line
!__loadedLibs['include/inputLineFns.js'] && loadDebug("include/inputLineFns.js");__loadedLibs['include/inputLineFns.js']=true
// --- add extra _inputLineFns here ---
const _addSrcInputLineFns = (type, fn) => {
    if (isUnDef(_inputLinesFns[type])) {
        _inputLineFns[type] = fn
    } else {
        if (params.debug) printErr("WARN: Input type '" + type + "' already exists.")
    }
}

// --- Transform functions
!__loadedLibs['include/transformFns.js'] && loadDebug("include/transformFns.js");__loadedLibs['include/transformFns.js']=true
// --- add extra _transformFns here ---
const _addSrcTransformFns = (type, fn) => {
    if (isUnDef(_transformFns[type])) {
        _transformFns[type] = fn
    } else {
        if (params.debug) printErr("WARN: Transform '" + type + "' already exists.")
    }
}

// --- Output functions
!__loadedLibs['include/outputFns.js'] && loadDebug("include/outputFns.js");__loadedLibs['include/outputFns.js']=true
// --- add extra _outputFns here ---
const _addSrcOutputFns = (type, fn) => {
    if (!_outputFns.has(type)) {
        _outputFns.set(type, fn)
    } else {
        if (params.debug) printErr("WARN: Output type '" + type + "' already exists.")
    }
}

// --- Input functions (input parsers)
!__loadedLibs['include/inputFns.js'] && loadDebug("include/inputFns.js");__loadedLibs['include/inputFns.js']=true
// --- add extra _inputFns here ---
const _addSrcInputFns = (type, fn) => {
    if (!_inputFns.has(type)) {
        _inputFns.set(type, fn)
    } else {
        if (params.debug) printErr("WARN: Input type '" + type + "' already exists.")
    }
}

// Check libs and add them (oafp_name.js on oPacks and __flags.OAFP.libs)
let _oafhelp_libs = {}
if (isString(params.libs)) params.libs = params.libs.split(",").map(r => r.trim()).filter(r => r.length > 0)
if (isDef(__flags.OAFP) && isArray(__flags.OAFP.libs) && isArray(params.libs)) 
    params.libs = __flags.OAFP.libs.concat(params.libs)
else
    params.libs = (isDef(__flags.OAFP) ? __flags.OAFP.libs : [])
if (isArray(params.libs)) {
    params.libs.forEach(lib => {
        try {
            if (lib.startsWith("@")) {
                if (/^\@([^\/]+)\/(.+)\.js$/.test(lib)) {
                    var _ar = lib.match(/^\@([^\/]+)\/(.+)\.js$/)
                    var _path = getOPackPath(_ar[1])
                    var _file = _path + "/" + _ar[2] + ".js"
                    if (io.fileExists(_file)) {
                        loadLib(_file)
                    } else {
                        _exit(-1, "ERROR: Library '" + lib + "' not found.")
                    }
                } else {
                    _exit(-1, "ERROR: Library '" + lib + "' does not have the correct format (@oPack/library.js).")
                }
            } else {
                var _req = require("oafp_" + lib + ".js")
                if (isDef(_req.oafplib)) {
                    var res = _req.oafplib(clone(params), _$o, _o$o, {
                        _runCmd2Bytes: _runCmd2Bytes,
                        _fromJSSLON: _fromJSSLON,
                        _msg: _msg,
                        _showTmpMsg: _showTmpMsg,
                        _clearTmpMsg: _clearTmpMsg,
                        _chartPathParse: _chartPathParse,
                        _exit: _exit,
                        _print: _print,
                        _o$o: _o$o
                    })
                    if (isMap(res)) {
                        if (isArray(res.fileExtensions))      res.fileExtensions.forEach(r => _addSrcFileExtensions(r.ext, r.type))
                        if (isArray(res.fileExtensionsNoMem)) res.fileExtensionsNoMem.forEach(r => _addSrcFileExtensionsNoMem(r.ext))
                        if (isArray(res.input))               res.input.forEach(r => _addSrcInputFns(r.type, r.fn))
                        if (isArray(res.inputLine))           res.inputLine.forEach(r => _addSrcInputLineFns(r.type, r.fn))
                        if (isArray(res.transform))           res.transform.forEach(r => _addSrcTransformFns(r.type, r.fn))
                        if (isArray(res.output))              res.output.forEach(r => _addSrcOutputFns(r.type, r.fn))
                        if (isString(res.help))               _oafhelp_libs[lib.toLowerCase()] = res.help
                    }
                } else {
                    printErr("WARN: Library '" + lib + "' does not have oafplib.")
                }
            }
        } catch(e) {
            printErr("WARN: Library '" + lib + "' error: " + e)
        }
    })
}

// Check if help is requested
if (params["-h"] == "" || (isString(params.help) && params.help.length > 0)) showHelp()

// Default format
params.format = _$(params.format, "format").isString().default(__)

// Initialize console detection
__initializeCon()
var _dr = !String(java.lang.System.getProperty("os.name")).match(/Windows/)
var _drev = getEnv("OAFP_RESET")
var _cs = getEnv("OAFP_CODESET")
if (isDef(_drev)) {
    if (toBoolean(_drev)) {
        _dr = false
    } else {
        _dr = true
    }
}
if (_dr && isDef(__con)) __con.getTerminal().settings.set("sane")

// Check for OpenAF's sec buckets

if (isDef(params.secKey)) {
    if (toBoolean(params.secEnv)) {
        params.secRepo = "system"
        params.secBucket = "envs"
    }
    params.secRepo = _$(params.secRepo, "secRepo").isString().default(getEnv("OAFP_SECREPO"))
    params.secBucket = _$(params.secBucket, "secBucket").isString().default(getEnv("OAFP_SECBUCKET"))
    params.secPass = _$(params.secPass, "secPass").isString().default(getEnv("OAFP_SECPASS"))
    params.secMainPass = _$(params.secMainPass, "secMainPass").isString().default(getEnv("OAFP_SECMAINPASS"))
    params.secFile = _$(params.secFile, "secFile").isString().default(getEnv("OAFP_SECFILE"))

    let res = $sec(params.secRepo, params.secBucket, params.secPass, params.secMainPass, params.secFile).get(secKey)
    if (isDef(res)) {
        Object.keys(res).forEach(r => params[r] = res[r])
    }
}

// Set options
var options = { 
    __format: params.format, 
    __from: params.from, 
    __ifrom: params.ifrom, 
    __isql: params.isql, 
    __sql: params.sql, 
    __path: params.path, 
    __opath: params.opath,
    __csv: params.csv, 
    __pause: params.pause, 
    __key: params.__key 
}
// ndjson options
/*if (params.type == "ndjson") {
    params.ndjsonjoin = toBoolean(_$(params.ndjsonjoin, "ndjsonjoin").isString().default(__))
}*/
// csv options
if (isDef(params.inputcsv)) {
    params.inputcsv = _fromJSSLON(params.inputcsv)
}
if (isDef(params.incsv)) {
    params.incsv = _fromJSSLON(params.incsv)
}
if (isDef(params.csv)) {
    params.csv = _fromJSSLON(params.csv)
}

// Check version
var _version = false
if (params["-v"] == "" || toBoolean(params.version)) {
    _version = true
    showVersion()
}

// Check list of examples
if (params["-examples"] == "" || (isString(params.examples) && params.examples.length > 0)) {
    params.url = "https://ojob.io/oafp-examples.yaml"
    params.in  = "yaml"

    if (isString(params.examples) && params.examples.length > 0) {
        if (params.examples.trim() != "?") options.__format = "template"
        options.__path   = "data"
        params.templatepath = "tmpl"
        if (params.examples.indexOf("::") > 0) {
            var parts = params.examples.split("::").filter(r => r.length > 0)
            if (parts.length == 1) {
                options.__sql    = "select * where c like '" + parts[0] + "'"
            } else {
                options.__sql    = "select * where c like '" + parts[0] + "' and s like '" + parts[1] + "'"
            }
        } else {
            if (params.examples.trim() == "?") {
                options.__path = "data.sort(map(&concat(c,concat('::',s)),[]))"
                params.removedups = true
            } else {
                options.__sql = "select * where d like '%" + params.examples + "%' or s like '%" + params.examples + "%' or c like '%" + params.examples + "%'"
            }
        } 
    } else {
        options.__path   = "data[].{category:c,subCategory:s,description:d}"
        options.__from   = "sort(category,subCategory,description)"
        options.__format = "ctable"
    }

    delete params["-examples"]
}

// Read input from stdin or file
var _res = "", noFurtherOutput = false

// Check for output streams
if (isDef(params.outfile)) {
    if ("undefined" === typeof global.__oafp_streams) global.__oafp_streams = {}
    if ("undefined" === typeof global.__oafp_streams[params.outfile])
        global.__oafp_streams[params.outfile] = { s: io.writeFileStream(params.outfile, toBoolean(params.outfileappend)) }
}

// Check chs
if (isString(params.chs)) {
    var _chs = af.fromJSSLON(params.chs)
    if (!isArray(_chs)) _chs = [_chs]
    _chs.forEach(ch => {
        if (isMap(ch)) {
            if (isString(ch.name) && isString(ch.type)) {
                $ch(ch.name).create(ch.type, ch.options)
            } else {
                _exit(-1, "ERROR: chs must have a name and a type.")
            }
        } else {
            _exit(-1, "ERROR: chs must be an object or array of objects with name and a type")
        }
    })
}

var _run = () => {
    if (_version) {
        _res = showVersion()
    } else {
        // JSON base options
        params.jsonprefix = _$(params.jsonprefix, "jsonprefix").isString().default(__)
        params.jsondesc   = toBoolean(_$(params.jsondesc, "jsondesc").default("false"))

        if (isDef(params.insecure) && toBoolean(params.insecure)) {
            ow.loadJava().setIgnoreSSLDomains()
        }

        if (isDef(params.file)) {
            if (params.file.indexOf("::") < 0 && !(io.fileExists(params.file))) {
                _exit(-1, "ERROR: File not found: '" + params.file + "'")
            }

            if (!_inputNoMem.has(params.type)) {
                if (params.type == "json" || isUnDef(params.type)) {
                    if (params.jsondesc) {
                        var _s = new Set()
                        io.readStreamJSON(params.file, path => {
                            var _p = path.substring(2)
                            if (isDef(params.jsonprefix)) {
                                if (_p.startsWith(params.jsonprefix)) {
                                    _s.add(_p)
                                }
                            } else {
                                _s.add(_p)
                            }
                            return false
                        })
                        _res = stringify(Array.from(_s), __, "")
                    } else {
                        if (isDef(params.jsonprefix)) {
                            var _r = io.readStreamJSON(params.file, path => path.substring(2).startsWith(params.jsonprefix))
                            _res = stringify(_r, __, "")
                        } else {
                            _res = io.readFileString(params.file, _cs)
                            if (toBoolean(params._shebang)) _res = _res.replace(/^#!.*\n/, "")
                        }
                    }
                } else {
                    _res = io.readFileString(params.file, _cs)
                    if (toBoolean(params._shebang)) _res = _res.replace(/^#!.*\n/, "")
                }
            }
        } else {
            if (params.jsondesc) _exit(-1, "ERROR: jsondesc only available for file input.")
            if (params.jsonprefix) _exit(-1, "ERROR: jsonprefix only available for file input.")

            if (isDef(params.cmd)) {
                _res = _runCmd2Bytes(params.cmd, true)
            } else {
                if (isString(params.data)) {
                    _res = params.data
                } else {
                    if (isDef(params.url)) {
                        params.urlmethod = _$(params.urlmethod, "urlmethod").isString().default("GET")
                        let _hp = _fromJSSLON(_$(params.urlparams).isString().default("{}"))

                        let _hd
                        if (isDef(params.urldata)) _hd = _fromJSSLON(params.urldata)

                        switch(params.urlmethod.toLowerCase()) {
                        case "post":
                            _res = $rest(_hp).post(params.url, _hd)
                            break
                        case "put":
                            _res = $rest(_hp).put(params.url, _hd)
                            break
                        case "delete":
                            _res = $rest(_hp).delete(params.url, _hd)
                            break
                        case "head":
                            _res = $rest(_hp).head(params.url, _hd)
                            break
                        default:
                            _res = $rest(_hp).get(params.url)
                        }
                        if (isObject(_res)) _res = stringify(_res, __, "")
                    } else {
                        if (params.input != "pm") {
                            _res = []
                            io.pipeLn(r => {
                                try {
                                    if (isDef(_inputLineFns[params.type])) {
                                        if (_inputLineFns[params.type](_transform(r), clone(options))) {
                                            _res.push(r)
                                        }
                                    } else { 
                                        _res.push(r)
                                    }
                                } catch(ipl) {
                                    printErr("ERROR: " + ipl)
                                }

                                return false
                            })
                            _res = _res.join('\n')
                        }
                    }
                }

            }
        }
    }

    if (!noFurtherOutput) {
        // Detect type if not provided
        if (isUnDef(params.type)) {
            // File name based
            if (isDef(params.file)) {
                let _ext = params.file.substring(params.file.lastIndexOf('.'))
                if (_fileExtensions.has(_ext)) params.type = _fileExtensions.get(_ext)
            }

            // Content-based
            if (isUnDef(params.type)) {
                let _tres = _res.trim()
                if (_tres.startsWith("{") || _tres.startsWith("[")) {
                    params.type = "json"
                } else if (_tres.startsWith("(")) {
                    params.type = "slon"
                } else if (_tres.startsWith("<")) {
                    params.type = "xml"
                } else {
                    if (isString(_tres) && _tres.length > 0) {
                        if (_tres.substring(0, _tres.indexOf('\n')).split(",").length > 1) {
                            params.type = "csv"
                        } else if (_tres.substring(0, _tres.indexOf(': ') > 0)) {
                            params.type = "yaml"
                        }
                    } else {
                        _exit(-1, "Please provide the input type.")
                    }
                }
            }
        }

        // Determine input type and execute
        if (isDef(params.type) && _inputFns.has(params.type)) {
            _inputFns.get(params.type)(_res, options)
        } else {
            if (isString(params.type)) printErr("WARN: " + params.type + " input type not supported. Using json.")
            _inputFns.get("json")(_res, options)
        }
        delete params.__origr
    }
}

// Verify debug
if (params.debug) {
    //__initializeCon()
    printErr("DEBUG: " + colorify(params))
}

if (isNumber(params.loop)) {
    while(1) {
        if (toBoolean(params.loopcls)) {
            if (isDef(params.outfile)) {
                global.__oafp_streams[params.outfile].close()
                global.__oafp_streams[params.outfile] = io.writeFileStream(params.outfile, toBoolean(params.outfileappend))
            }
        }
        _run()
        sleep(params.loop * 1000, true)
    }
} else {
    _run()
}

// Close streams
if (isDef(global.__oafp_streams)) Object.keys(global.__oafp_streams).forEach(s => global.__oafp_streams[s].s.close())
}
oafp(_params)
