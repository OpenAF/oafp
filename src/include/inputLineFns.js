var _inputLineFns = {
    "lines": (r, options) => {
        if (!isBoolean(params.linesjoin)) params.linesjoin = toBoolean(_$(params.linesjoin, "linesjoin").isString().default(__))

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
    "javagc": (r, options) => {
        let _procLine = _line => {
            try {
                let regexes = [
                    // JDK 8 style regexes
                    /([^ ]+) (\d+\.\d+): \[GC \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\(.*?\)\] (\d+K)->(\d+K)\(.*?\), (\d+\.\d+) secs\]/,
                    /([^ ]+) (\d+\.\d+): \[Full GC \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\(.*?\)\] \[ParOldGen: (\d+K)->(\d+K)\(.*?\)\] (\d+K)->(\d+K)\(.*?\), \[Metaspace: (\d+K)->(\d+K)\(.*?\)\], (\d+\.\d+) secs\]/,
                    // Updated JDK 9+ style regexes
                    /\[(\d+\.\d+)s\]\[\w+\]\[gc\s*\]\s*GC\((\d+)\)\s*(.*?)\s*(\d+[GMK])->(\d+[GMK])\((\d+[GMK])\)\s*(\d+\.\d+)ms/,
                    /\[(\d+\.\d+)s\]\[\w+\]\[gc,\w+\]\s*GC\((\d+)\)\s*(.*?)\s*Heap:\s*(\d+[GMK])->(\d+[GMK])\((\d+[GMK])\)\s*Metaspace:\s*(\d+[GMK])->(\d+[GMK])\((\d+[GMK])\)\s*(\d+\.\d+)ms/
                ]
                
                for (let regex of regexes) {
                    let match = _line.match(regex)
                    if (match) {
                        let result = {}
                        
                        if (_line.startsWith('[')) {
                            // JDK 9+ style parsing
                            result.sinceStart = parseFloat(match[1])
                            result.gcId = parseInt(match[2])
                            result.gcType = match[3].trim()
                            result.durationSecs = parseFloat(match[match.length - 1]) / 1000 // convert ms to secs
        
                            if (regex === regexes[2]) {
                                // Match for GC pause with heap info
                                result.beforeGC = ow.format.fromBytesAbbreviation(match[4] + "B")
                                result.afterGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                            } else if (regex === regexes[3]) {
                                // Match for GC pause with heap and metaspace info
                                result.heapBeforeGC = ow.format.fromBytesAbbreviation(match[4] + "B")
                                result.heapAfterGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                                result.metaspaceBeforeGC = ow.format.fromBytesAbbreviation(match[7] + "B")
                                result.metaspaceAfterGC = ow.format.fromBytesAbbreviation(match[8] + "B")
                            }
                        } else {
                            // JDK 8 style parsing
                            result.timestamp = ow.format.toDate(match[1], "yyyy-MMdd'T'HH:mm:ss.SSSZ")
                            result.sinceStart = parseFloat(match[2])
                            result.gcType = match[3]
                            result.durationSecs = parseFloat(match[match.length - 1])
                            
                            if (match.length === 9) {
                                result.PSYoungGenBeforeGC = ow.format.fromBytesAbbreviation(match[4] + "B")
                                result.PSYoungGenAfterGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                                result.beforeGC = ow.format.fromBytesAbbreviation(match[6] + "B")
                                result.afterGC = ow.format.fromBytesAbbreviation(match[7] + "B")
                            } else if (match.length === 13) {
                                result.PSYoungGenBeforeGC = ow.format.fromBytesAbbreviation(match[4] + "B")
                                result.PSYoungGenAfterGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                                result.ParOldGenBeforeGC = ow.format.fromBytesAbbreviation(match[6] + "B")
                                result.ParOldGenAfterGC = ow.format.fromBytesAbbreviation(match[7] + "B")
                                result.beforeGC = ow.format.fromBytesAbbreviation(match[8] + "B")
                                result.afterGC = ow.format.fromBytesAbbreviation(match[9] + "B")
                                result.metaspaceBeforeGC = ow.format.fromBytesAbbreviation(match[10] + "B")
                                result.metaspaceAfterGC = ow.format.fromBytesAbbreviation(match[11] + "B")
                            }
                        }
                        return result
                    }
                }
            } catch(e) {
                printErr(e)
                _exit(-2, "Error parsing Java GC log: " + e)
            }
        }

        ow.loadFormat()

        var _res = _procLine(r)
        if (isMap(_res)) _$o(_res, options, true)
    },
    "ndjson": (r, options) => {
        if (!isBoolean(params.ndjsonjoin)) params.ndjsonjoin = toBoolean(_$(params.ndjsonjoin, "ndjsonjoin").isString().default(__))
        
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
    }
}