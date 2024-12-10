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
        if (!isBoolean(params.javagcjoin)) params.javagcjoin = toBoolean(_$(params.javagcjoin, "javagcjoin").isString().default(__))

        if (params.javagcjoin) return true

        if (isUnDef(global.__javagc_buffer) || global.__javagc_buffer.length > 1048576) global.__javagc_buffer = ""
        
        let _procLine = _event => {
            try {
                let regexes = [
                    // JDK 8 Allocation Failure (adjusted to handle multiline events)
                    /([^ ]+) (\d+\.\d+): \[GC \((.*?)\)(.+?)\[PSYoungGen: (\d+K)->(\d+K)\(.*?\)\] (\d+K)->(\d+K)\(.*?\), (\d+\.\d+) secs\] \[Times: user=(\d+\.\d+) sys=(\d+\.\d+), real=(\d+\.\d+) secs\]/s,
                    // JDK 8 style regexes
                    /([^ ]+) (\d+\.\d+): \[GC \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\(.*?\)\] (\d+K)->(\d+K)\(.*?\), (\d+\.\d+) secs\]/,
                    /([^ ]+) (\d+\.\d+): \[Full GC \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\(.*?\)\] \[ParOldGen: (\d+K)->(\d+K)\(.*?\)\] (\d+K)->(\d+K)\(.*?\), \[Metaspace: (\d+K)->(\d+K)\(.*?\)\], (\d+\.\d+) secs\]/,
                    // JDK 8 with +PrintTenuringDistribution
                    /([^ ]+) (\d+\.\d+): \[GC \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\(.*?\)\] (\d+K)->(\d+K)\(.*?\), (\d+\.\d+) secs\] \[Times: user=(\d+\.\d+) sys=(\d+\.\d+), real=(\d+\.\d+) secs\]/,
                    // JDK 8 with +PrintHeapAtGC
                    /([^ ]+) (\d+\.\d+): \[Full GC \((.*?)\) \[PSYoungGen: (\d+K)->(\d+K)\(.*?\)\] \[ParOldGen: (\d+K)->(\d+K)\(.*?\)\] (\d+K)->(\d+K)\(.*?\), \[Metaspace: (\d+K)->(\d+K)\(.*?\)\], (\d+\.\d+) secs\] \[Times: user=(\d+\.\d+) sys=(\d+\.\d+), real=(\d+\.\d+) secs\]/,
                    // JDK 9+ style regexes
                    ///\[(\d+\.\d+)s\]\[\w+\]\[gc(?:,\w+)?\]\s*GC\((\d+)\)\s*(.*?)\s+(\d+[KMGT])->(\d+[KMGT])\((\d+[KMGT])\)\s+(\d+\.\d+)ms/,
                    ///\[(\d+\.\d+)s\]\[\w+\]\[gc(?:,\w+)?\]\s*GC\((\d+)\)\s*(.*?)\s*Heap:\s*(\d+[KMGT])->(\d+[KMGT])\((\d+[KMGT])\)\s*Metaspace:\s*(\d+[KMGT])->(\d+[KMGT])\((\d+[KMGT])\)\s*(\d+\.\d+)ms/,
                    /^\[(.+)\]\s+GC\((\d+)\)\s*(.*?)\s*(\d+[GMK])->(\d+[GMK])\((\d+[GMK])\)\s*(\d+\.\d+)ms/,
                    ///\[(\d+\.\d+)s\]\[\w+\]\[gc,\w+\]\s*GC\((\d+)\)\s*(.*?)\s*Heap:\s*(\d+[GMK])->(\d+[GMK])\((\d+[GMK])\)\s*Metaspace:\s*(\d+[GMK])->(\d+[GMK])\((\d+[GMK])\)\s*(\d+\.\d+)ms/,
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
                            var heads = match[1].split("][")
                            heads.forEach(head => {
                                if (head.match(/^\d+\.\d+s$/)) {
                                    result.sinceStart = parseFloat(head.replace(/s$/, ""))
                                } else if (head.match(/\d{4}-\d{2}-\d{2}T/)) {
                                    result.timestamp = ow.format.toDate(head, "yyyy-MM-dd'T'HH:mm:ss.SSSZ")
                                }
                            })
                            //result.index = index
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
                            result.timestamp = ow.format.toDate(match[1], "yyyy-MMdd'T'HH:mm:ss.SSSZ")
                            result.sinceStart = parseFloat(match[2])
                            result.gcType = match[3]
                            result.durationSecs = parseFloat(match[match.length - 1])

                            if (index === 0 || index === 6) {
                                result.PSYoungGenBeforeGC = ow.format.fromBytesAbbreviation(match[4] + "B")
                                result.PSYoungGenAfterGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                                result.beforeGC = ow.format.fromBytesAbbreviation(match[6] + "B")
                                result.afterGC = ow.format.fromBytesAbbreviation(match[7] + "B")
                                if (index === 6 && _event.includes("Allocation Failure")) {
                                    result.gcCause = "Allocation Failure"
                                }
                            } else if (index === 1 || index === 3) {
                                result.PSYoungGenBeforeGC = ow.format.fromBytesAbbreviation(match[4] + "B")
                                result.PSYoungGenAfterGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                                result.ParOldGenBeforeGC = ow.format.fromBytesAbbreviation(match[6] + "B")
                                result.ParOldGenAfterGC = ow.format.fromBytesAbbreviation(match[7] + "B")
                                result.beforeGC = ow.format.fromBytesAbbreviation(match[8] + "B")
                                result.afterGC = ow.format.fromBytesAbbreviation(match[9] + "B")
                                result.metaspaceBeforeGC = ow.format.fromBytesAbbreviation(match[10] + "B")
                                result.metaspaceAfterGC = ow.format.fromBytesAbbreviation(match[11] + "B")
                            } else if (index === 2) {
                                // Match for GC with +PrintTenuringDistribution
                                result.PSYoungGenBeforeGC = ow.format.fromBytesAbbreviation(match[4] + "B")
                                result.PSYoungGenAfterGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                                result.beforeGC = ow.format.fromBytesAbbreviation(match[6] + "B")
                                result.afterGC = ow.format.fromBytesAbbreviation(match[7] + "B")
                                result.userTime = parseFloat(match[8])
                                result.sysTime = parseFloat(match[9])
                                result.realTime = parseFloat(match[10])
                            } else if (index === 6) {
                                // Adjusted Allocation Failure parsing
                                result.PSYoungGenBeforeGC = ow.format.fromBytesAbbreviation(match[5] + "B")
                                result.PSYoungGenAfterGC = ow.format.fromBytesAbbreviation(match[6] + "B")
                                result.beforeGC = ow.format.fromBytesAbbreviation(match[7] + "B")
                                result.afterGC = ow.format.fromBytesAbbreviation(match[8] + "B")
                                result.durationSecs = parseFloat(match[9])
                                if (match[10]) {
                                    result.userTime = parseFloat(match[10])
                                    result.sysTime = parseFloat(match[11])
                                    result.realTime = parseFloat(match[12])
                                }
                                result.gcCause = "Allocation Failure"
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

        global.__javagc_buffer += r
        var _res = _procLine(r)
        if (isMap(_res)) {
            _$o(_res, options, true)
            global.__javagc_buffer = ""
        }
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