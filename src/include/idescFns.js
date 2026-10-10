// Interactive description: OpenAF owns parsing, prompts, queries and rendering.
const _idesc = (value, file, ui) => {
    var cfg = {page:20, depth:3, string:200, bytes:16777216, nodes:100000}
    Object.keys(cfg).forEach(k => {
        var v = Number(params["idesc" + k])
        if (isDef(params["idesc" + k])) {
            if (!isFinite(v) || v < 1 || Math.floor(v) != v) throw "idesc" + k + " must be a positive integer"
            cfg[k] = v
        }
    })
    var initial = {base:value, file:file, path:[], ops:[]}, state = initial, history = [], bookmarks = Object.create(null), cache = new Map(), stamp
    var format, page = 0, search = "", closed = false, scanCancelled = false, generation = 0
    var equal = (a, b) => stringify(a, __, "") == stringify(b, __, "")
    var prefix = (a, b) => a.length <= b.length && a.every((k, i) => k === b[i])
    var pathText = path => "@" + path.map(k => typeof k == "number" ? "[" + k + "]" : "." + stringify(k, __, "")).join("")
    // The UI draws on its own controlling terminal, so color does not depend on stdout being a terminal.
    var tone = (code, text) => ui && ui.console ? ansiColor(code, text, true) : text
    // Colors come from OpenAF's __colorFormat (read at use time, so runtime theme changes apply); fb is used if an entry is missing or empty.
    var cf = (path, fb) => {
        var v = path.split(".").reduce((o, k) => o == null ? __ : o[k], typeof __colorFormat != "undefined" ? __colorFormat : __)
        return isString(v) && v.length ? v : fb
    }
    var typeTone = type => ({string:cf("string", "GREEN"), number:cf("number", "YELLOW"), boolean:cf("boolean", "BLUE"), date:cf("date", "MAGENTA")})[type] || cf("default", "WHITE")
    var icons = {map:"📁", array:"📚", string:"🔤", number:"🔢", boolean:"🔘", "null":"∅", date:"📅", binary:"💾", function:"λ", regexp:"📐", undefined:"—"}
    var icon = type => icons[type] || "▫"
    var divider = len => tone(cf("tree.lines", "FAINT"), "─".repeat(len || 58))
    var clip = (text, max) => text.length > max ? text.substring(0, max - 1) + "…" : text
    var crumbs = path => {
        var part = (k, last) => {
            var isIdx = typeof k == "number", text = clip(isIdx ? "[" + k + "]" : stringify(k, __, "").replace(/^"|"$/g, ""), 32)
            var code = isIdx ? cf("number", "YELLOW") : cf("key", "CYAN")
            return tone(last ? "BOLD," + code : code, text)
        }
        var items = path.map((k, i) => part(k, i == path.length - 1)), sep = tone(cf("tree.lines", "FAINT"), " › ")
        if (items.length > 5) items = [items[0], tone(cf("tree.lines", "FAINT"), "…")].concat(items.slice(-3))
        return tone(cf("askPre", "BOLD,GREEN"), "⌂") + (items.length ? sep + items.join(sep) : "")
    }
    var describe = v => ({type:isNull(v) ? "null" : descType(v), size:isArray(v) ? v.length : isMap(v) ? Object.keys(v).length : __})
    var get = (v, path) => path.reduce((obj, k) => {
        if (obj == null || !(isArray(obj) || isMap(obj)) || !Object.prototype.hasOwnProperty.call(obj, k)) throw "Path not found: " + pathText(path)
        if (isArray(obj) != (typeof k == "number")) throw "Use numeric indices for arrays and string keys for maps"
        return obj[k]
    }, v)
    var steps = s => s.ops.concat(s.path.length ? [{op:"select", path:s.path}] : [])
    var saveState = next => { history.push(state); state = next; page = 0; search = "" }
    var check = () => {
        if (!file) return
        var info = io.fileInfo(file), next = String(info.size) + ":" + String(info.lastModified)
        if (isDef(stamp) && stamp != next) {
            cache.clear(); generation++; history = []; bookmarks = Object.create(null); state = initial; page = 0; search = ""; stamp = next
            throw "Source changed; cached locations and bookmarks cleared. Browsing restarted at root."
        }
        stamp = next
    }
    var scan = (fn, opts) => {
        check()
        var run = () => io.scanJSON(file, fn, merge({
            cancel:() => { scanCancelled = !!(ui && ui.cancel && ui.cancel()); return scanCancelled },
            progress:n => { if (ui && ui.progress) ui.progress(n) }
        }, opts || {}))
        return ui && ui.scan ? ui.scan(run) : run()
    }
    var range = (path, bounded) => {
        var found, nodes = 0
        scan(e => {
            if (!prefix(e.path, path) && !prefix(path, e.path)) return "skip"
            if (prefix(path, e.path) && e.phase == "value" && bounded && ++nodes > cfg.nodes) throw "Selection exceeds idescnodes; narrow it first"
            if (e.phase == "value" && equal(e.path, path) && !bounded) return "skip"
            if (e.phase == "end" && equal(e.path, path)) { found = e; return "stop" }
        })
        if (!found) throw "Path not found: " + pathText(path)
        if (bounded && found.end - found.start > cfg.bytes) throw "Selection exceeds idescbytes; narrow it first"
        return found
    }
    var read = path => {
        var r = range(path, true), out = new java.io.ByteArrayOutputStream()
        io.copyJSONRange(file, r.start, r.end, out)
        check()
        return jsonParse(String(out.toString("UTF-8")))
    }
    var current = () => { check(); return state.file ? read(state.path) : get(state.base, state.path) }
    var list = (s, offset, filter, count) => {
        check()
        if (!s.file) {
            var v = get(s.base, s.path), meta = describe(v), keys = isArray(v) ? null : isMap(v) ? Object.keys(v) : []
            var rows = [], matched = 0, size = keys ? keys.length : v.length
            for (var i = 0; i < size; i++) {
                var k = keys ? keys[i] : i
                if (filter && String(k).toLowerCase().indexOf(filter) < 0) continue
                if (matched++ >= offset && rows.length <= cfg.page) rows.push(merge({key:k}, describe(v[k])))
                if (!count && rows.length > cfg.page) break
            }
            return {meta:meta, rows:rows.slice(0, cfg.page), more:rows.length > cfg.page}
        }
        var id = stringify([s.path, offset, filter, count], __, "")
        if (cache.has(id)) return cache.get(id)
        var rows = [], meta, matched = 0, more = false
        scan(e => {
            if (!prefix(e.path, s.path) && !prefix(s.path, e.path)) return "skip"
            if (equal(e.path, s.path)) {
                if (e.phase == "value") meta = {type:e.type}
                else meta.size = e.size
            } else if (e.path.length == s.path.length + 1) {
                if (e.phase == "value") {
                    var k = e.path[e.path.length - 1]
                    if (!filter || String(k).toLowerCase().indexOf(filter) >= 0) {
                        if (matched++ >= offset) {
                            if (rows.length == cfg.page) { more = true; if (!count) return "stop" }
                            else rows.push({key:k, type:e.type})
                        }
                    }
                    return "skip"
                }
            }
            if (e.phase == "end" && equal(e.path, s.path)) return "stop"
        })
        if (!meta) throw "Path not found: " + pathText(s.path)
        var result = {meta:meta, rows:rows, more:more}
        if (cache.size >= 64) cache.delete(cache.keys().next().value)
        cache.set(id, result)
        return result
    }
    var isLeaf = t => t != "map" && t != "array"
    var assign = (target, source) => { Object.keys(source).forEach(k => { target[k] = source[k] }); return target }
    var withPath = (path, fn) => {
        var old = state
        state = {base:old.base, file:old.file, path:path, ops:old.ops}
        try { return fn() } finally { state = old }
    }
    var scalarOf = e => {
        var n = e.end - e.start
        if (n > Math.min(cfg.bytes, cfg.string * 8 + 2)) return {omitted:n}
        var out = new java.io.ByteArrayOutputStream()
        io.copyJSONRange(file, e.start, e.end, out)
        return {value:jsonParse(String(out.toString("UTF-8")))}
    }
    // Children of any node (not only the selected one) for the tree view: {meta, rows:[{key,type,size?,bytes?,value?,omitted?}], more, matched?}.
    // File-backed mode reads inline scalars and byte sizes of containers; child container counts stay unknown until expanded.
    var childrenOf = (path, offset, count, filter) => {
        check()
        filter = filter ? String(filter).toLowerCase() : ""
        var match = k => !filter || String(k).toLowerCase().indexOf(filter) >= 0
        if (!state.file) {
            var v = get(state.base, path), meta = describe(v), rows = [], matched = 0, more = false
            if (isArray(v) || isMap(v)) {
                var keys = isArray(v) ? null : Object.keys(v), size = keys ? keys.length : v.length
                for (var i = 0; i < size; i++) {
                    var k = keys ? keys[i] : i
                    if (!match(k)) continue
                    if (matched++ < offset) continue
                    if (rows.length >= count) { more = true; if (!filter) break; continue }
                    var d = describe(v[k]), row = {key:k, type:d.type, size:d.size}
                    if (isLeaf(d.type)) row.value = v[k]
                    rows.push(row)
                }
            } else meta.value = v
            return {meta:meta, rows:rows, more:more, matched:more && !filter ? __ : matched}
        }
        var id = stringify(["children", path, offset, count, filter], __, "")
        if (cache.has(id)) return cache.get(id)
        var rows = [], meta, matched = 0, more = false, byKey = new Map()
        scan(e => {
            if (!prefix(e.path, path) && !prefix(path, e.path)) return "skip"
            if (equal(e.path, path)) {
                if (e.phase == "value") meta = {type:e.type}
                else {
                    if (isLeaf(e.type)) assign(meta, scalarOf(e)); else meta.size = e.size
                    return "stop"
                }
                return
            }
            if (e.path.length == path.length + 1 && prefix(path, e.path)) {
                var k = e.path[e.path.length - 1]
                if (e.phase == "value") {
                    if (match(k)) {
                        if (matched++ >= offset) {
                            if (rows.length >= count) { more = true; return "stop" }
                            var row = {key:k, type:e.type}
                            rows.push(row); byKey.set(k, row)
                        }
                    }
                    return "skip"
                }
                var r = byKey.get(k)
                if (r) { if (isLeaf(e.type)) assign(r, scalarOf(e)); else r.bytes = e.end - e.start }
            }
        })
        if (!meta) throw "Path not found: " + pathText(path)
        var result = {meta:meta, rows:rows, more:more, matched:more ? __ : matched}
        if (cache.size >= 64) cache.delete(cache.keys().next().value)
        cache.set(id, result)
        return result
    }
    var parsePath = text => {
        loadCompiledLib("jmespath_js")
        var walk = node => {
            switch(node.type) {
            case "Identity": case "Current": return []
            case "Field": return [node.name]
            case "Index": if (node.value >= 0) return [node.value]; break
            case "Subexpression": case "IndexExpression": return node.children.reduce((a, n) => a.concat(walk(n)), [])
            }
            throw "Jump accepts an exact property/index path; use Query for expressions"
        }
        return walk(jmespath.compile(text))
    }
    var select = path => {
        var next = {base:state.base, file:state.file, path:path, ops:state.ops}
        list(next, 0, "", false)
        saveState(next)
    }
    // Reads array entries [start, end) of a file-backed array within the bytes/nodes limits.
    var streamSlice = (path, start, end) => {
        var rows = [], bytes = 2, nodes = 1
        scan(e => {
            if (!prefix(e.path, path) && !prefix(path, e.path)) return "skip"
            if (e.phase == "value" && equal(e.path, path) && e.type != "array") throw "Slice requires an array"
            if (e.path.length > path.length && prefix(path, e.path)) {
                var index = e.path[path.length]
                if (e.phase == "value") {
                    if (index >= end) return "stop"
                    if (index < start) return "skip"
                    if (++nodes > cfg.nodes) throw "Slice exceeds idescnodes; choose fewer records"
                }
                if (e.phase == "end" && e.path.length == path.length + 1 && index >= start) {
                    bytes += e.end - e.start + 1
                    if (bytes > cfg.bytes) throw "Slice exceeds idescbytes; choose fewer records"
                    rows.push({start:e.start, end:e.end})
                }
            }
            if (e.phase == "end" && equal(e.path, path)) return "stop"
        })
        var out = new java.io.ByteArrayOutputStream()
        out.write(91)
        rows.forEach((r, i) => { if (i) out.write(44); io.copyJSONRange(file, r.start, r.end, out) })
        out.write(93)
        return jsonParse(String(out.toString("UTF-8")))
    }
    var apply = op => {
        var v, next
        if (op.op == "select") { select(op.path); return }
        if (op.op == "slice" && state.file) {
            v = streamSlice(state.path, op.start, op.end)
        } else {
            v = current()
            switch(op.op) {
            case "slice": if (!isArray(v)) throw "Slice requires an array"; v = v.slice(op.start, op.end); break
            case "path": v = $path(v, op.expression); break
            case "from": v = $from(isArray(v) ? v : [v]).query(af.fromNLinq(op.expression)); break
            case "sql": v = $sql(v, op.expression, params.sqlfilter == "advanced" ? "h2" : params.sqlfilter == "simple" ? "nlinq" : __); break
            default: throw "Unsupported recipe operation"
            }
        }
        if (isUnDef(v)) throw "Query returned undefined"
        if (op.op == "slice" && !state.file) {
            var nodes = 0, countNodes = v => {
                if (++nodes > cfg.nodes) throw "Slice exceeds idescnodes; choose fewer records"
                if (isArray(v) || isMap(v)) Object.keys(v).forEach(k => countNodes(v[k]))
            }
            countNodes(v)
        }
        next = {base:v, path:[], ops:steps(state).concat([op])}
        saveState(next)
    }
    var recipe = () => ({version:1, source:initial.file ? "stream" : "loaded", operations:steps(state), bookmarks:bookmarks})
    var validateOps = ops => {
        if (!isArray(ops) || ops.length > 1000) throw "Invalid recipe operations"
        ops.forEach(op => {
            if (!isMap(op)) throw "Invalid recipe operation"
            if (op.op == "select") {
                if (!isArray(op.path) || !op.path.every(k => isString(k) || (typeof k == "number" && k >= 0 && Math.floor(k) == k))) throw "Invalid selection path"
            } else if (op.op == "slice") {
                if (![op.start, op.end].every(n => typeof n == "number" && isFinite(n) && n >= 0 && Math.floor(n) == n) || op.end < op.start) throw "Invalid slice"
            } else if (["path", "from", "sql"].indexOf(op.op) < 0 || !isString(op.expression)) throw "Invalid recipe operation"
        })
    }
    var replay = ops => {
        validateOps(ops)
        var old = state, oldHistory = history, oldPage = page, oldSearch = search, oldStamp = stamp
        state = initial; history = []
        try { ops.forEach(op => apply(op)); history = oldHistory.concat([old]) }
        catch(e) { if (stamp === oldStamp) { state = old; history = oldHistory; page = oldPage; search = oldSearch }; throw e }
        page = 0; search = ""
    }
    var load = data => {
        if (!isMap(data) || data.version != 1 || data.source != (initial.file ? "stream" : "loaded")) throw "Incompatible idesc recipe"
        validateOps(data.operations)
        if (!isMap(data.bookmarks)) throw "Invalid bookmarks"
        Object.keys(data.bookmarks).forEach(k => validateOps(data.bookmarks[k]))
        replay(data.operations); bookmarks = data.bookmarks
    }
    var preview = () => {
        var budget = cfg.nodes
        var bound = (v, depth) => {
            if (--budget < 0) return "[node limit]"
            if (isString(v)) return v.length > cfg.string ? v.substring(0, cfg.string) + "… [truncated]" : v
            if (!(isMap(v) || isArray(v))) return v
            var size = isArray(v) ? v.length : Object.keys(v).length
            if (depth == 0) return "[" + describe(v).type + ": " + size + "]"
            var out = isArray(v) ? [] : Object.create(null), keys = isArray(v) ? null : Object.keys(v)
            for (var i = 0; i < Math.min(size, cfg.page); i++) {
                var k = keys ? keys[i] : i
                out[k] = bound(v[k], depth - 1)
            }
            if (size > cfg.page) out[isArray(out) ? out.length : "… [truncated]"] = "[" + (size - cfg.page) + " more entries]"
            return out
        }
        // In file mode preview only a bounded selection; never materialize a huge subtree implicitly.
        var result
        if (state.file) {
            var built = new Map(), used = 0
            scan(e => {
                if (!prefix(e.path, state.path) && !prefix(state.path, e.path)) return "skip"
                if (!prefix(state.path, e.path)) return
                var relative = e.path.slice(state.path.length), id = stringify(relative, __, "")
                var parent = built.get(stringify(relative.slice(0, -1), __, "")), key = relative[relative.length - 1]
                var set = v => { if (!relative.length) result = v; else if (parent) parent.value[key] = v }
                if (e.phase == "value") {
                    if (parent && ++parent.count > cfg.page || --budget < 0) {
                        if (parent) parent.value[isArray(parent.value) ? parent.value.length : "… [truncated]"] = "[more entries]"
                        if (relative.length == 1) return "stop"
                        return "skip"
                    }
                    if (e.type == "map" || e.type == "array") {
                        if (relative.length >= cfg.depth) { set("[" + e.type + ": depth limit]"); return "skip" }
                        var container = e.type == "array" ? [] : Object.create(null)
                        built.set(id, {value:container, count:0}); set(container)
                    }
                } else if (e.type != "map" && e.type != "array" && (!parent || parent.count <= cfg.page)) {
                    var size = e.end - e.start
                    if (size > Math.min(cfg.bytes - used, cfg.string * 8 + 2)) {
                        set("[" + e.type + ": " + size + " bytes; omitted]")
                    } else {
                        var out = new java.io.ByteArrayOutputStream()
                        io.copyJSONRange(file, e.start, e.end, out); used += size
                        set(bound(jsonParse(String(out.toString("UTF-8"))), 0))
                    }
                }
                if (e.phase == "end" && !relative.length) return "stop"
            })
            check()
        } else result = bound(current(), cfg.depth)
        // Bounded containers have no prototype (safe for any key name); renderers need ordinary objects.
        if (isDef(result)) result = JSON.parse(JSON.stringify(result))
        return {value:result, format:format || (isArray(result) && result.every(isMap) ? "ctable" : "ctree")}
    }
    var fields = () => {
        var old = state, oldHistory = history, oldPage = page, oldSearch = search, oldStamp = stamp
        try {
            apply({op:"slice", start:0, end:100})
            var rows = current(), out = Object.create(null)
            rows.forEach(row => { if (isMap(row)) Object.keys(row).forEach(k => {
                if (!out[k]) out[k] = {field:k, present:0, types:[]}
                out[k].present++
                var t = describe(row[k]).type
                if (out[k].types.indexOf(t) < 0) out[k].types.push(t)
            }) })
            return {sampled:rows.length, fields:Object.keys(out).map(k => merge(out[k], {missing:rows.length - out[k].present}))}
        } finally { if (stamp === oldStamp) { state = old; history = oldHistory; page = oldPage; search = oldSearch } }
    }
    var compare = (ops, values) => {
        var old = state, oldHistory = history, oldPage = page, oldSearch = search, oldStamp = stamp
        try {
            var a = values ? preview().value : list(state, 0, "", true)
            replay(ops)
            var b = values ? preview().value : list(state, 0, "", true)
            loadDiff()
            var diff = JsDiff.diffLines(stringify(a), stringify(b))
            return diff.map(part => {
                var prefix = part.added ? "+ " : part.removed ? "- " : "  "
                var color = part.added ? "GREEN" : part.removed ? "RED" : "FAINT"
                var lines = part.value.split("\n")
                if (lines[lines.length - 1] === "") lines.pop()
                return lines.map(l => tone(color, prefix + l)).join("\n") + "\n"
            }).join("")
        } finally { if (stamp === oldStamp) { state = old; history = oldHistory; page = oldPage; search = oldSearch } }
    }
    var exportData = (output, type) => {
        if (state.file && type == "json") {
            var r = range(state.path, false)
            check()
            var copy = () => io.copyJSONRange(file, r.start, r.end, output, ui ? {cancel:() => { scanCancelled = !!(ui.cancel && ui.cancel()); return scanCancelled }, progress:ui.progress} : __)
            if (ui && ui.scan) ui.scan(copy); else copy()
            check()
        } else {
            var text = $o(current(), {__format:type}, __, true)
            ioStreamWrite(output, text, __, true)
        }
    }
    var writeFile = (path, fn) => {
        var target = java.nio.file.Paths.get(path).toAbsolutePath(), parent = target.getParent()
        var temp = java.nio.file.Files.createTempFile(parent, ".idesc-", ".tmp"), output = io.writeFileStream(String(temp))
        try {
            try { fn(output) } finally { output.close() }
            java.nio.file.Files.move(temp, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING)
        } finally { java.nio.file.Files.deleteIfExists(temp) }
    }
    // Full-screen tree browser. Expanding/collapsing, the cursor and the name filter are view-only; zooming, queries and slices go through the recorded operations.
    var runTUI = () => {
        ow.loadFormat()
        var S = ow.format.string, chunk = cfg.page
        var view = {nodes:new Map(), expanded:new Set(), filter:"", cursor:__, idx:0, top:0, base:__, opsKey:__, gen:-1, rootKey:__,
                    mode:"tree", input:"", msg:"", err:false, overlay:__, confirm:__, hist:[], histPos:0, size:"", tables:true, noTable:new Set()}
        var rows = [], stdoutExport, oldProgress = ui.progress
        var pkey = path => stringify(path, __, "")
        var rid = (kind, path) => kind + ":" + pkey(path)
        var paint = (code, text) => tone(code, text)
        var plain = (code, text) => text
        var fmtBytes = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(1) + " MB"
        var jpath = path => path.length ? path.map((k, i) => typeof k == "number" ? "[" + k + "]" : (/^[A-Za-z_$][\w$]*$/.test(k) ? (i ? "." : "") + k : (i ? "." : "") + stringify(k, __, ""))).join("") : "@"
        var keyText = k => isString(k) ? (/^[A-Za-z_$][\w$-]*$/.test(k) ? k : stringify(k, __, "")) : "[" + k + "]"
        var dims = () => { var sz = ui.size(); return {w:Math.max(24, sz.width), h:Math.max(9, sz.height)} }
        var nodeId = path => pkey(path) + (equal(path, state.path) ? "?" + view.filter : "")
        var filterFor = path => equal(path, state.path) ? view.filter : ""
        var nodeFor = path => {
            var id = nodeId(path), nd = view.nodes.get(id)
            if (!nd) { nd = childrenOf(path, 0, chunk, filterFor(path)); view.nodes.set(id, nd) }
            return nd
        }
        var loadMore = path => {
            var nd = nodeFor(path), more = childrenOf(path, nd.rows.length, chunk, filterFor(path))
            view.nodes.set(nodeId(path), {meta:nd.meta, rows:nd.rows.concat(more.rows), more:more.more, matched:more.matched})
        }
        var sync = () => {
            var opsKey = stringify(state.ops, __, ""), rootKey = pkey(state.path)
            if (view.base !== state.base || view.opsKey !== opsKey || view.gen !== generation) {
                view.nodes.clear(); view.expanded.clear(); view.filter = ""; view.cursor = __; view.top = 0
                view.base = state.base; view.opsKey = opsKey; view.gen = generation
            }
            if (view.rootKey !== rootKey) { view.filter = ""; view.rootKey = rootKey }
        }
        // Like ctree, an expanded array of flat maps is shown as a table (one line per entry); t / T switch back to the tree.
        var cellText = v => String(isString(v) ? v : stringify(v, __, "")).replace(/[\r\n\t]+/g, " ")
        var buildTable = (path, nd) => {
            if (!nd.rows.length || !nd.rows.every(r => r.type == "map" || r.type == "null") || !nd.rows.some(r => r.type == "map")) return null
            try {
                var data = state.file ? streamSlice(path, 0, nd.rows.length) : get(state.base, path).slice(0, nd.rows.length)
                if (!data.every(e => e === null || (isMap(e) && Object.keys(e).every(k => !(isMap(e[k]) || isArray(e[k])))))) return null
                var cols = []
                data.forEach(e => { if (e) Object.keys(e).forEach(k => { if (cols.indexOf(k) < 0) cols.push(k) }) })
                if (!cols.length) return null
                var cells = data.map(e => cols.map(k => e && isDef(e[k]) ? cellText(e[k]) : ""))
                var types = data.map(e => cols.map(k => e && isDef(e[k]) ? (e[k] === null ? "null" : typeof e[k]) : "null"))
                var widths = cols.map((c, ci) => Math.min(48, cells.reduce((m, r) => Math.max(m, visibleLength(r[ci])), visibleLength(c))))
                return {cols:cols, cells:cells, types:types, widths:widths}
            } catch(e) { return null }
        }
        var fitWidths = (t, room) => {
            // shrink the widest columns until the table fits (cells are clipped, never wrapped)
            var widths = t.widths.slice()
            room = Math.max(8, room)
            while (widths.reduce((a, b) => a + b + 1, -1) > room && Math.max.apply(null, widths) > 6) widths[widths.indexOf(Math.max.apply(null, widths))]--
            return widths
        }
        var tableLine = (widths, cells, p, code) => cells.map((c, ci) => p(isFunction(code) ? code(ci) : code || "RESET", S.ansiPad(S.ansiClip(c, widths[ci], "…"), widths[ci]))).join(p(cf("table.lines", "FAINT"), "│"))
        var useTable = (id, nd) => view.tables && !view.noTable.has(id) && nd.table
        // ctree glyphs: ╭ first, ├ middle, ╰ last, ─ only child; ancestors with later siblings continue with │
        var glyph = {single:"─ ", first:"╭ ", mid:"├ ", last:"╰ "}
        var posOf = (i, total) => total == 1 ? "single" : i == 0 ? "first" : i == total - 1 ? "last" : "mid"
        var flatten = () => {
            var out = []
            var add = (path, info, lead, pos, isRoot) => {
                var id = pkey(path), open = !isLeaf(info.type) && (isRoot || view.expanded.has(id)), nd
                if (open) {
                    nd = nodeFor(path)
                    if (isUnDef(info.size) && !nd.more && !(isRoot && view.filter)) info = assign(assign({}, info), {size:nd.rows.length})
                    if (info.type == "array" && isUnDef(nd.table)) nd.table = buildTable(path, nd)
                }
                var asTable = open && info.type == "array" && useTable(id, nd)
                out.push({kind:"node", path:path, info:info, lead:isRoot ? "" : lead + glyph[pos], open:open, id:id, rid:rid("n", path), root:isRoot, table:asTable, tableable:open && !!(nd && nd.table)})
                if (!open) return
                var next = isRoot ? "" : lead + (pos == "last" || pos == "single" ? "  " : "│ "), total = nd.rows.length + (nd.more ? 1 : 0)
                if (asTable) {
                    var t = nd.table
                    out.push({kind:"decor", rid:"d:" + id + ":h", lead:next, table:t, cells:t.cols, head:true})
                    out.push({kind:"decor", rid:"d:" + id + ":s", lead:next, table:t, sep:true})
                    nd.rows.forEach((c, k) => out.push({kind:"trow", path:path.concat([c.key]), info:c, lead:next, table:t, cells:t.cells[k], types:t.types[k], band:k % 2 == 1, rid:rid("t", path.concat([c.key])), arrayId:id}))
                    if (nd.more) out.push({kind:"more", path:path, lead:next, rid:rid("m", path), remaining:isDef(nd.meta.size) && !view.filter ? nd.meta.size - nd.rows.length : __})
                    return
                }
                nd.rows.forEach((c, k) => add(path.concat([c.key]), c, next, posOf(k, total), false))
                if (nd.more) out.push({kind:"more", path:path, lead:next + glyph[posOf(nd.rows.length, total)], rid:rid("m", path), remaining:isDef(nd.meta.size) && !view.filter ? nd.meta.size - nd.rows.length : __})
            }
            var rootNd = nodeFor(state.path)
            add(state.path, assign({key:state.path.length ? state.path[state.path.length - 1] : "@"}, rootNd.meta), "", "single", true)
            rows = out
        }
        var place = () => {
            var body = dims().h - 5, i = view.cursor ? rows.findIndex(r => r.rid == view.cursor) : -1
            if (i < 0) i = Math.max(0, Math.min(view.idx, rows.length - 1))
            while (i < rows.length - 1 && rows[i] && rows[i].kind == "decor") i++
            view.idx = i; view.cursor = rows.length ? rows[i].rid : __
            if (i < view.top) view.top = i
            if (i >= view.top + body) view.top = i - body + 1
            view.top = Math.max(0, Math.min(view.top, Math.max(0, rows.length - body)))
        }
        var moveTo = (i, dir) => {
            if (!rows.length) return
            dir = dir || (i < view.idx ? -1 : 1)
            i = Math.max(0, Math.min(i, rows.length - 1))
            while (i >= 0 && i < rows.length && rows[i].kind == "decor") i += dir
            if (i < 0 || i >= rows.length) { i = Math.max(0, Math.min(i, rows.length - 1)); while (rows[i].kind == "decor") i -= dir }
            view.idx = i; view.cursor = rows[i].rid
        }
        var cur = () => rows[view.idx]
        var info = (msg, err) => { view.msg = msg; view.err = !!err }

        // ---- rendering
        var rowLine = (r, sel, w) => {
            var p = sel ? plain : paint, inner = w - 1, lc = cf("tree.lines", "FAINT")
            var line
            if (r.kind == "decor" || r.kind == "trow") {
                var widths = fitWidths(r.table, inner - r.lead.length)
                line = p(lc, r.lead)
                if (r.head) line += tableLine(widths, r.cells, p, cf("table.title", "BOLD"))
                else if (r.sep) line += p(cf("table.lines", "FAINT"), widths.map(n => "─".repeat(n)).join("┼"))
                else {
                    // like ctable: cells take their value-type color, and every second row is banded
                    var band = r.band && !(typeof __flags != "undefined" && __flags.TABLE && __flags.TABLE.bandRows === false) ? cf("table.bandRow", "BOLD") + "," : ""
                    line += tableLine(widths, r.cells, p, ci => band + typeTone(r.types[ci]))
                }
                if (r.kind == "decor") return " " + S.ansiClip(line, inner)
            } else if (r.kind == "more") {
                line = p(lc, r.lead) + p(cf("default", "CYAN"), "… " + (isDef(r.remaining) ? r.remaining + " more" : "more entries") + " — Enter loads " + chunk)
            } else {
                var i = r.info, leaf = isLeaf(i.type), marker = leaf ? "  " : r.open ? "▾ " : "▸ "
                var key = p(isString(i.key) ? cf("key", "CYAN") : cf("number", "YELLOW"), r.root && r.path.length == 0 ? "@" : keyText(i.key))
                var tail
                if (leaf) {
                    var text = isDef(i.omitted) ? "‹" + i.type + ", " + fmtBytes(i.omitted) + "›" : isDef(i.value) ? stringify(i.value, __, "") : ""
                    if (text.length > cfg.string) text = text.substring(0, cfg.string) + "…"
                    tail = p(lc, ": ") + p(typeTone(i.type), text)
                } else {
                    var cnt = isDef(i.size) ? String(i.size) : "?"
                    tail = " " + p(typeTone(i.type), (i.type == "map" ? "{" + cnt + "}" : "[" + cnt + "]")) + (isDef(i.bytes) ? p(lc, " " + fmtBytes(i.bytes)) : "")
                }
                line = p(lc, r.lead) + p(lc, marker) + key + tail
                if (w >= 56) {
                    var tw = 9
                    line = S.ansiPad(S.ansiClip(line, inner - tw), inner - tw) + p(lc, " " + (r.table ? "table" : i.type))
                }
            }
            line = S.ansiClip(line, inner)
            if (!sel) return " " + line
            var padded = S.ansiPad("▌" + line, w)
            return tone(cf("askChoose", "BOLD,CYAN"), padded)
        }
        var hints = mode => ({
            tree:"←↑↓→ hjkl move · ⏎ zoom · ⌫ up · ~ top · / filter · t table/tree · : cmd · p preview · ? help · q quit",
            overlay:"↑↓ PgUp/PgDn scroll · g/G ends · f format (preview) · q/Esc close",
            filter:"type to filter child names · ⏎ keep · Esc clear",
            cmd:"⏎ run · Tab complete · ↑↓ history · Esc cancel · try: path [?x>`1`] | slice 0:10 | export json -",
            confirm:"y confirms · any other key cancels"
        })[mode]
        var helpLines = () => {
            var head = t => paint(cf("md.heads.h3", "BOLD"), t), key = (k, d) => "  " + paint(cf("default", "YELLOW"), S.ansiPad(k, 22)) + d
            return [
                head("Move"),
                key("↑ k   ↓ j", "move the cursor"),
                key("PgUp PgDn", "page up / down (Ctrl-U Ctrl-D: half a page)"),
                key("g G   Home End", "first / last row"),
                "",
                head("Expand and collapse (view only, never recorded)"),
                key("→ l", "expand; if open, enter its children; on a “more” row, load more"),
                key("← h", "collapse; else go to the parent row; on the root, zoom out"),
                key("Space", "toggle expand"),
                key("*", "expand all children one level"),
                key("t   T", "table / tree for the focused array  ·  for every array"),
                "",
                head("Zoom (recorded in the recipe)"),
                key("Enter", "make the focused container the root; scalars open a preview"),
                key("Backspace u", "zoom out one level"),
                key("~ 0", "back to the original root"),
                key("U", "undo the last zoom or query"),
                "",
                head("Inspect"),
                key("/", "filter child names of the root as you type (Esc clears)"),
                key("p", "bounded preview of the focused node (f cycles ctree/ctable/cyaml)"),
                key("y", "show the reusable path= of the focused node"),
                key("?", "this help"),
                key("q Ctrl-C", "quit; nothing is emitted unless you export"),
                "",
                head("Commands  (press : then type; Tab completes, ↑↓ recall)"),
                key("path|from|sql <expr>", "query the focused node (also: query path|from|sql <expr>)"),
                key("slice a:b", "array entries a to b (end exclusive)"),
                key("jump <path>", "zoom to an exact path, e.g. items[2].nested"),
                key("count | fields", "entry count | field summary of the focused node"),
                key("bm [name]", "list / save a bookmark;  bm go <name>  ·  bm rm <name>"),
                key("compare <bm> [values]", "diff the focused node with a bookmark"),
                key("recipe [print]", "show;  recipe save <file>  ·  recipe load <file>"),
                key("export json|yaml <file>", "write the focused node; use - to write to stdout and quit"),
                key("format <fmt>", "preview format: ctree, ctable, cyaml or auto"),
                key("quit", "leave without emitting data"),
                "",
                paint(cf("tree.lines", "FAINT"), "  q or Esc closes this help")]
        }
        var frame = () => {
            var d = dims(), w = d.w, body = d.h - 5, out = [], ov = view.overlay
            var lc = cf("tree.lines", "FAINT")
            var src = state.file ? paint(cf("string", "CYAN"), "💾 file") : state.ops.length ? paint(cf("default", "YELLOW"), "⚡ derived") : paint(cf("number", "GREEN"), "📥 loaded")
            var head = paint(cf("askPre", "YELLOW,BOLD"), "oafp") + " " + (ov ? paint(cf("askQuestion", "BOLD"), ov.title) : crumbs(state.path)) + paint(lc, "  │ ") + src + paint(lc, " · " + steps(state).length + " ops")
            out.push(head); out.push(divider(w))
            if (ov) for (var i = 0; i < body; i++) out.push(ov.lines[ov.top + i] != null ? " " + ov.lines[ov.top + i] : "")
            else for (var i = 0; i < body; i++) {
                var r = rows[view.top + i]
                out.push(r ? rowLine(r, view.top + i == view.idx && view.mode != "overlay", w) : "")
            }
            out.push(divider(w))
            var status
            var prompt = ch => paint(cf("askPre", "YELLOW,BOLD"), ch), typed = t => paint(cf("askQuestion", "BOLD"), t)
            if (view.mode == "filter") status = prompt("/") + typed(view.input) + paint(lc, "▏") + paint(lc, "  " + (rows.length ? "" : "no match"))
            else if (view.mode == "cmd") status = prompt(":") + typed(view.input) + paint(lc, "▏")
            else if (view.mode == "confirm") status = prompt("? ") + typed(view.confirm.text)
            else if (view.msg) status = view.err ? paint("RED", view.msg) : paint(cf("askPos", "GREEN"), view.msg)
            else if (ov) status = paint(lc, "line " + (ov.top + 1) + "/" + Math.max(1, ov.lines.length))
            else {
                var r = cur()
                status = r && r.kind != "decor" ? paint(cf("askQuestion", "BOLD"), jpath(r.path)) + paint(lc, "  " + (view.idx + 1) + "/" + rows.length) : ""
                if (view.filter) status += paint(cf("askChooseFilter", "UNDERLINE"), "  🔍 " + stringify(view.filter, __, ""))
            }
            out.push(status); out.push(paint(lc, hints(ov ? "overlay" : view.mode)))
            ui.write("\x1b[H" + out.map(l => S.ansiClip(l, w, "…") + "\x1b[K").join("\r\n"), false)
        }
        var paintStatus = text => ui.write("\x1b[" + (dims().h - 1) + ";1H" + S.ansiClip(text, dims().w, "…") + "\x1b[K", false)

        // ---- actions
        var openOverlay = (title, make, formats) => {
            var lines = String(make()).split("\n")
            view.overlay = {title:title, make:make, formats:!!formats, lines:lines, top:0}; view.mode = "overlay"
        }
        var scroll = n => { var ov = view.overlay, body = dims().h - 5; ov.top = Math.max(0, Math.min(ov.top + n, Math.max(0, ov.lines.length - body))) }
        var ctree = v => $o(v, {__format:"ctree"}, __, true)
        var previewOverlay = path => openOverlay("Preview " + pathText(path) + " (bounded)", () => {
            var p = withPath(path, preview)
            return $o(p.value, {__format:p.format}, __, true)
        }, true)
        var zoom = path => {
            if (equal(path, state.path)) return
            select(path); view.cursor = rid("n", path); view.top = 0
        }
        var zoomOut = () => {
            if (!state.path.length) { info("Already at the top"); return }
            var from = state.path; api.parent(); view.cursor = rid("n", from)
        }
        var expand = r => {
            view.expanded.add(r.id)
            try { nodeFor(r.path) } catch(e) { view.expanded.delete(r.id); throw e }
        }
        var parentIndex = i => {
            var r = rows[i], want = r.kind == "more" ? pkey(r.path) : pkey(r.path.slice(0, -1))
            for (var j = i - 1; j >= 0; j--) if (rows[j].kind == "node" && pkey(rows[j].path) == want) return j
            return -1
        }
        var confirmThen = (text, fn) => { view.mode = "confirm"; view.confirm = {text:text, run:fn} }
        var saveTo = (file, fn, done) => {
            var go = () => { writeFile(file, fn); info("✔ Saved: " + file) }
            if (io.fileExists(file)) confirmThen("Replace " + file + "? (y/N)", go); else go()
        }
        var cmdNames = ["path", "from", "sql", "query", "slice", "jump", "count", "fields", "bm", "compare", "recipe", "export", "format", "help", "quit"]
        var runCmd = text => {
            var m = String(text).trim().match(/^(\S+)\s*(.*)$/)
            if (!m) return
            var name = m[1], arg = m[2], focus = cur() ? cur().path : state.path
            var q
            switch(name) {
            case "path": case "from": case "sql":
                if (!arg) throw "Use: " + name + " <expression>"
                zoom(focus); apply({op:name, expression:arg}); break
            case "query":
                q = arg.match(/^(path|from|sql)\s+(.+)$/)
                if (!q) throw "Use: query path|from|sql <expression>"
                zoom(focus); apply({op:q[1], expression:q[2]}); break
            case "slice":
                q = arg.match(/^(\d+):(\d+)$/)
                if (!q || Number(q[2]) < Number(q[1])) throw "Use non-negative start:end"
                zoom(focus); apply({op:"slice", start:Number(q[1]), end:Number(q[2])}); break
            case "jump": zoom(parsePath(arg)); break
            case "count": openOverlay("Count entries " + pathText(focus), () => ctree(withPath(focus, () => list(state, 0, "", true).meta))); break
            case "fields": openOverlay("Field summary " + pathText(focus), () => ctree(withPath(focus, fields))); break
            case "bm":
                if (!arg) { openOverlay("Bookmarks", () => Object.keys(bookmarks).length ? ctree(Object.keys(bookmarks).map(k => ({name:k, operations:bookmarks[k].length}))) : "No bookmarks yet. Use: bm <name>"); break }
                q = arg.match(/^(go|rm)\s+(.+)$/)
                if (q) {
                    if (!bookmarks[q[2]]) throw "No bookmark named " + q[2]
                    if (q[1] == "rm") { delete bookmarks[q[2]]; info("Removed bookmark " + q[2]) }
                    else { replay(bookmarks[q[2]]); info("Jumped to bookmark " + q[2]) }
                } else { withPath(focus, () => api.bookmark(arg)); info("🔖 Bookmark saved: " + arg) }
                break
            case "compare":
                q = arg.match(/^(.+?)(\s+values)?$/)
                if (!q || !bookmarks[q[1]]) throw "Use: compare <bookmark> [values]"
                openOverlay("Compare " + pathText(focus) + " with " + q[1], () => withPath(focus, () => compare(bookmarks[q[1]], !!q[2]))); break
            case "recipe":
                q = arg.match(/^(print|save|load)?\s*(.*)$/)
                if (!q[1] || q[1] == "print") openOverlay("Recipe", () => ctree(recipe()) + "\n" + (state.ops.length ? "" : "path=" + stringify(pathText(state.path)) + "\n") + "▶ Replay: oafp <source arguments> idescrecipe=<saved-file> out=json")
                else if (!q[2]) throw "Use: recipe " + q[1] + " <file>"
                else if (q[1] == "save") saveTo(q[2], out => ioStreamWrite(out, stringify(recipe()), __, true))
                else load(io.readFileJSON(q[2]))
                break
            case "export":
                q = arg.match(/^(json|yaml)\s+(.+)$/)
                if (!q) throw "Use: export json|yaml <file|->"
                if (q[2] == "-") { stdoutExport = {type:q[1], path:focus}; closed = true }
                else saveTo(q[2], out => withPath(focus, () => exportData(out, q[1])))
                break
            case "format":
                if (["ctree", "ctable", "cyaml", "auto"].indexOf(arg) < 0) throw "Use: format ctree|ctable|cyaml|auto"
                format = arg == "auto" ? __ : arg; info("Preview format: " + arg); break
            case "help": openOverlay("Help", () => helpLines().join("\n")); break
            case "quit": case "q": closed = true; break
            default: throw "Unknown command: " + name + " (try ? for help)"
            }
        }
        var complete = () => {
            var m = view.input.match(/^(\S*)$/)
            if (!m) return
            var found = cmdNames.filter(c => c.indexOf(m[1]) == 0)
            if (found.length == 1) view.input = found[0] + " "
            else if (found.length > 1) info(found.join("  "))
        }
        var handleTree = key => {
            var r = cur(), body = dims().h - 5, tr = r && r.kind == "trow"
            switch(key) {
            case "up": case "k": moveTo(view.idx - 1, -1); break
            case "down": case "j": moveTo(view.idx + 1, 1); break
            case "pgup": case "ctrl-u": moveTo(view.idx - Math.max(1, key == "pgup" ? body - 1 : Math.floor(body / 2)), -1); break
            case "pgdn": case "ctrl-d": moveTo(view.idx + Math.max(1, key == "pgdn" ? body - 1 : Math.floor(body / 2)), 1); break
            case "home": case "g": moveTo(0, 1); break
            case "end": case "G": moveTo(rows.length - 1, -1); break
            case "right": case "l":
                if (!r || tr) break
                if (r.kind == "more") { loadMore(r.path); break }
                if (isLeaf(r.info.type)) break
                if (!r.open) expand(r); else if (rows[view.idx + 1] && rows[view.idx + 1].lead.length > r.lead.length) moveTo(view.idx + 1)
                break
            case "left": case "h":
                if (!r) break
                if (r.kind == "node" && r.open && !r.root) { view.expanded.delete(r.id); break }
                if (r.root) { zoomOut(); break }
                var pi = parentIndex(view.idx)
                if (pi >= 0) moveTo(pi)
                break
            case " ":
                if (r && r.kind == "node" && !r.root && !isLeaf(r.info.type)) { if (r.open) view.expanded.delete(r.id); else expand(r) }
                break
            case "enter":
                if (!r) break
                if (r.kind == "more") loadMore(r.path)
                else if (isLeaf(r.info.type)) previewOverlay(r.path)
                else if (r.root) info("Already the root; use → to open children, ⌫ to zoom out")
                else zoom(r.path)
                break
            case "backspace": case "u": zoomOut(); break
            case "~": case "0":
                if (state.path.length || state.ops.length) { api.root(); view.cursor = rid("n", []) } else info("Already at the original root")
                break
            case "U": if (history.length) { api.back(); view.cursor = __ } else info("Nothing to undo"); break
            case "*":
                if (r && r.kind == "node" && !isLeaf(r.info.type)) {
                    expand(r)
                    nodeFor(r.path).rows.forEach(c => { if (!isLeaf(c.type)) view.expanded.add(pkey(r.path.concat([c.key]))) })
                }
                break
            case "/": view.mode = "filter"; view.input = view.filter; break
            case ":": view.mode = "cmd"; view.input = ""; view.histPos = view.hist.length; break
            case "?": runCmd("help"); break
            case "p": if (r && r.kind != "more") previewOverlay(r.path); break
            case "y": if (r && r.kind != "more") info("path=" + (r.path.length ? jpath(r.path) : "@")); break
            case "t":
                var aid = !r ? __ : tr ? r.arrayId : r.kind == "more" ? pkey(r.path) : r.kind == "node" && r.info.type == "array" && r.open ? r.id : __
                if (isUnDef(aid)) { info("Select an expanded array to switch between table and tree"); break }
                if (!nodeFor(jsonParse(aid)).table) { info("Not shown as a table: every entry must be a flat map"); break }
                if (view.noTable.has(aid)) { view.noTable.delete(aid); info("Table view") }
                else { view.noTable.add(aid); if (tr) view.cursor = rid("n", r.path); info("Tree view") }
                break
            case "T":
                view.tables = !view.tables
                if (!view.tables && tr) view.cursor = rid("n", r.path)
                info(view.tables ? "Arrays of flat maps shown as tables" : "Tables off: arrays shown as trees")
                break
            case "esc": if (view.filter) { view.filter = ""; view.cursor = rid("n", state.path) }; break
            case "q": case "ctrl-c": case "eof": closed = true; break
            }
        }
        var handleInput = key => {
            var filter = view.mode == "filter"
            switch(key) {
            case "esc": case "ctrl-c":
                if (filter) { view.filter = ""; view.cursor = rid("n", state.path) }
                view.mode = "tree"; break
            case "eof": closed = true; break
            case "enter":
                if (filter) view.mode = "tree"
                else {
                    var text = view.input; view.mode = "tree"
                    if (text.trim()) { view.hist.push(text); runCmd(text) }
                }
                break
            case "backspace":
                if (view.input.length) view.input = view.input.substring(0, view.input.length - 1); else if (!filter) view.mode = "tree"
                if (filter) { view.filter = view.input.toLowerCase(); view.cursor = rid("n", state.path) }
                break
            case "tab": if (!filter) complete(); break
            case "up": if (!filter && view.histPos > 0) view.input = view.hist[--view.histPos]; break
            case "down": if (!filter && view.histPos < view.hist.length) view.input = view.histPos + 1 < view.hist.length ? view.hist[++view.histPos] : (view.histPos++, ""); break
            default:
                if (isString(key) && ["left", "right", "home", "end", "pgup", "pgdn", "delete", "insert", "shift-tab"].indexOf(key) < 0 && !/^(ctrl|alt)-/.test(key)) {
                    view.input += key
                    if (filter) { view.filter = view.input.toLowerCase(); view.cursor = rid("n", state.path) }
                }
            }
        }
        var handleOverlay = key => {
            var ov = view.overlay, body = dims().h - 5
            switch(key) {
            case "up": case "k": scroll(-1); break
            case "down": case "j": scroll(1); break
            case "pgup": case "b": scroll(-(body - 1)); break
            case "pgdn": case " ": scroll(body - 1); break
            case "home": case "g": ov.top = 0; break
            case "end": case "G": scroll(ov.lines.length); break
            case "f":
                if (ov.formats) {
                    var order = ["ctable", "ctree", "cyaml"], next = order[(order.indexOf(format) + 1) % order.length]
                    format = next; ov.lines = String(ov.make()).split("\n"); ov.top = 0; info("Preview format: " + next)
                }
                break
            case "q": case "esc": case "enter": view.overlay = __; view.mode = "tree"; break
            case "ctrl-c": case "eof": closed = true; break
            }
        }
        var handle = key => {
            info("")
            if (view.mode == "confirm") { var c = view.confirm; view.mode = "tree"; view.confirm = __; if (key == "y" || key == "Y") c.run(); else info("Cancelled"); return }
            if (view.mode == "overlay") handleOverlay(key)
            else if (view.mode == "tree") handleTree(key)
            else handleInput(key)
        }

        ui.progress = n => { paintStatus(paint(cf("askPre", "YELLOW,BOLD"), "⏳ ") + "Scanning: " + n + " bytes (Ctrl-C cancels)") }
        var loop = () => {
            if (ui.altScreen) ui.altScreen(true)
            try {
                while (!closed) {
                    scanCancelled = false
                    try { sync(); flatten(); place() } catch(e) { rows = rows || []; info(scanCancelled ? "Scan cancelled." : "Error: " + e, true) }
                    try { frame() } catch(e) { info("Error: " + e, true) }
                    var key
                    while (isUnDef(key = ui.readKey(250))) { var d = dims(); if (d.w + "x" + d.h != view.size) { view.size = d.w + "x" + d.h; break } }
                    view.size = dims().w + "x" + dims().h
                    if (isUnDef(key)) continue
                    try { handle(key) } catch(e) { view.mode = view.mode == "confirm" ? "tree" : view.mode; info(scanCancelled ? "Scan cancelled." : "Error: " + e, true) }
                }
            } finally {
                ui.progress = oldProgress
                if (ui.altScreen) ui.altScreen(false)
            }
        }
        if (ui.raw) ui.raw(loop); else loop()
        if (stdoutExport) withPath(stdoutExport.path, () => exportData(java.lang.System.out, stdoutExport.type))
    }
    var api = {
        path:() => pathText(state.path), recipe:recipe, load:load, replay:replay,
        list:() => list(state, page * cfg.page, search, false), current:current,
        saveData:(path, type) => writeFile(path, out => exportData(out, type)),
        select:select, apply:apply, preview:preview, fields:fields, compare:compare, exportData:exportData,
        back:() => { if (history.length) { state = history.pop(); page = 0; search = "" } },
        root:() => saveState(initial), parent:() => { if (state.path.length) select(state.path.slice(0, -1)) },
        bookmark:name => { if (!name.length) throw "Bookmark name is empty"; bookmarks[name] = steps(state) },
        close:() => { closed = true },
        runMenu:() => {
            var choose = (title, choices) => ui.choose ? ui.choose(title, choices) : askChoose(title, choices, 12, __, ui)
            var input = title => {
                var text = ui.ask ? ui.ask(title) : ask(title, __, ui.console, true, ui.write)
                if (text == null) throw cancelled
                return String(text)
            }
            var confirm = path => !io.fileExists(path) || choose("Replace " + path + "?", ["Cancel", "Replace", "Back"]) === 1
            var cancelled = {}
            var command = (id, label, handler, available) => ({id:id, label:label, handler:handler, available:available || (() => true)})
            var menu = (title, commands) => {
                var entries = commands.filter(c => c.available())
                var pick = choose(title, entries.map(c => c.label).concat(["Back"]))
                if (isNumber(pick) && pick >= 0 && pick < entries.length) entries[pick].handler()
            }
            ui.write("\n" + tone("BOLD,CYAN", "oafp") + tone("BOLD", " | Interactive data explorer") + "\n" + divider(58))
            while (!closed) {
                try {
                    scanCancelled = false
                    var listing = api.list()
                    ui.write("\n📍 " + crumbs(state.path) + tone("FAINT", "  " + pathText(state.path)))
                    var srcBadge = state.file ? tone("CYAN", "💾 file-backed") : state.ops.length ? tone("YELLOW", "⚡ derived") : tone("GREEN", "📥 loaded")
                    var sizeText = isDef(listing.meta.size) ? tone("WHITE", String(listing.meta.size)) + tone("FAINT", " entries") : tone("FAINT", "count unknown")
                    var opsText = tone("FAINT", steps(state).length + " operations")
                    ui.write(icon(listing.meta.type) + " " + tone("BOLD," + typeTone(listing.meta.type), listing.meta.type) + tone("FAINT", " · ") + sizeText +
                             tone("FAINT", " · ") + srcBadge + tone("FAINT", " · ") + opsText)
                    var pageInfo = tone("FAINT", "📄 page ") + tone("BOLD,WHITE", String(page + 1)) + tone("FAINT", " · ") + tone("WHITE", listing.rows.length + " shown") +
                             tone("FAINT", " · ") + (listing.more ? tone("BOLD,CYAN", "more ▸") : tone("FAINT", "last page"))
                    var filterInfo = search ? tone("BOLD,YELLOW", " · 🔍 names containing " + stringify(search, __, "")) : ""
                    ui.write(pageInfo + filterInfo)
                    if (!listing.rows.length) ui.write(search ? tone("YELLOW", "⚠️  No matching names. Navigate > Filter names: blank clears the listing filter.") : tone("FAINT", "ℹ️  No child entries. Preview to inspect this value."))
                    ui.write(divider(58))
                    ui.write(tone("FAINT", "💡 Use arrows and Enter to select, or enter a number when numbered choices are shown. Pick ⬆ .. to go up."))
                    var dispatch = id => {
                        switch(id) {

                            case "parent": api.parent(); break
                            case "root": api.root(); break
                            case "undo": api.back(); break
                            case "next": if (listing.more) page++; break
                            case "previous": page = Math.max(0, page - 1); break
                            case "filter": search = input("Listing name contains (blank clears; data is unchanged): ").toLowerCase(); page = 0; break
                            case "jump": select(parsePath(input("Exact path from current view root (e.g. @.items[2]): "))); break
                            case "slice":
                                var slice = input("Array slice start:end (end exclusive): ").match(/^(\d+):(\d+)$/)
                                if (!slice || Number(slice[2]) < Number(slice[1])) throw "Use non-negative start:end"
                                apply({op:"slice", start:Number(slice[1]), end:Number(slice[2])}); break
                            case "count":
                                ui.write(tone("BOLD,CYAN", "── Count Entries ") + divider(40))
                                ui.write($o(list(state, 0, "", true).meta, {__format:"ctree"}, __, true))
                                ui.write(divider(58)); break
                            case "query":
                                var kind = choose("Query engine", ["path", "from", "sql", "Back"])
                                if (isNumber(kind) && kind >= 0 && kind < 3) apply({op:["path", "from", "sql"][kind], expression:input("Expression (relative to selection): ")})
                                break
                            case "preview":
                                var selected = choose("Preview format", ["Automatic / remembered", "ctable", "ctree", "cyaml", "Back"])
                                if (isNumber(selected) && selected >= 0 && selected < 4) {
                                    if (selected) format = ["", "ctable", "ctree", "cyaml"][selected]
                                    var p = preview()
                                    ui.write(tone("BOLD,CYAN", "── Bounded preview ") + tone("FAINT", "(entries/depth/strings may be truncated) ───\n") +
                                             $o(p.value, {__format:p.format}, __, true) + "\n" +
                                             divider(58))
                                }
                                break
                            case "fields":
                                ui.write(tone("BOLD,CYAN", "── Field Summary ") + divider(40))
                                ui.write($o(fields(), {__format:"ctree"}, __, true))
                                ui.write(divider(58)); break
                            case "bookmarks":
                                var names = Object.keys(bookmarks), b = choose("Bookmarks", ["Save current..."].concat(names, ["Back"]))
                                if (b === 0) {
                                    var name = input("Bookmark name: ")
                                    api.bookmark(name)
                                    ui.write(tone("BOLD,GREEN", "🔖 Bookmark saved: ") + tone("WHITE", name))
                                }
                                else if (isNumber(b) && b > 0 && b <= names.length) replay(bookmarks[names[b - 1]])
                                break
                            case "compare":
                                var names = Object.keys(bookmarks)
                                if (!names.length) { ui.write("Save a bookmark first, then compare it with the current selection."); break }
                                var b = choose("Compare current with", names.concat(["Back"]))
                                if (isNumber(b) && b >= 0 && b < names.length) {
                                    var mode = choose("Comparison", ["Structure (first page; counts if available)", "Bounded values (preview limits)", "Back"])
                                    if (isNumber(mode) && mode >= 0 && mode < 2) {
                                        ui.write(tone("BOLD,CYAN", "── Diff Comparison ") + divider(38))
                                        ui.write(compare(bookmarks[names[b]], mode === 1))
                                        ui.write(divider(58))
                                    }
                                }
                                break
                            case "recipe":
                                var r = choose("Recipe", ["Print", "Save…", "Load…", "Back"])
                                if (r === 0) {
                                    ui.write(tone("BOLD,CYAN", "── Recipe ") + divider(47))
                                    ui.write($o(recipe(), {__format:"ctree"}, __, true))
                                    if (!state.ops.length) ui.write(tone("CYAN", "path=") + stringify(pathText(state.path)))
                                    ui.write(tone("BOLD,GREEN", "▶ Replay: ") + tone("WHITE", "oafp <source arguments> idescrecipe=<saved-file> out=json"))
                                    ui.write(divider(58))
                                } else if (r === 1) {
                                    var dest = input("Recipe file: ")
                                    if (confirm(dest)) { writeFile(dest, out => ioStreamWrite(out, stringify(recipe()), __, true)); ui.write(tone("BOLD,GREEN", "✔ Saved: ") + tone("WHITE", dest)) }
                                } else if (r === 2) load(io.readFileJSON(input("Recipe file: ")))
                                break
                            case "export":
                                var t = choose("Data format", ["json", "yaml", "Back"])
                                if (!isNumber(t) || t < 0 || t >= 2) break
                                var dest = choose("Destination", ["File…", "Stdout and exit", "Back"])
                                if (dest === 0) {
                                    var name = input("Output file: ")
                                    if (confirm(name)) { writeFile(name, out => exportData(out, ["json", "yaml"][t])); ui.write(tone("BOLD,GREEN", "✔ Saved: ") + tone("WHITE", name)) }
                                } else if (dest === 1) { exportData(java.lang.System.out, ["json", "yaml"][t]); closed = true }
                                break
                            case "quit": closed = true
                        }
                    }
                    var entry = (id, label, available) => command(id, label, () => dispatch(id), available)
                    var main = [entry("preview", "🔍 Preview..."), entry("query", "🧮 Query..."), entry("export", "💾 Export..."),
                        command("navigate", "🧭 Navigate...", () => menu("Navigate", [
                            entry("parent", "Parent", () => state.path.length > 0),
                            entry("root", "Original root", () => state.path.length > 0 || state.ops.length > 0),
                            entry("undo", "Undo last change", () => history.length > 0),
                            entry("next", "Next page", () => listing.more), entry("previous", "Previous page", () => page > 0),
                            entry("filter", "Filter names..."), entry("jump", "Jump to path...")])),
                        command("tools", "🧰 Tools...", () => menu("Tools", [
                            entry("slice", "Slice array...", () => listing.meta.type == "array"), entry("count", "Count entries"),
                            entry("fields", "Field summary", () => listing.meta.type == "array"), entry("bookmarks", "Bookmarks..."),
                            entry("compare", "Compare with bookmark...", () => Object.keys(bookmarks).length > 0), entry("recipe", "Recipe...")])),
                        entry("quit", "🚪 Quit")]
                    var up = state.path.length ? [entry("parent", "⬆ .. parent" + (state.path.length > 1 ? " (" + clip(pathText(state.path.slice(0, -1)), 40) + ")" : " (root)"))] : []
                    if (state.path.length > 1) up.push(entry("root", "⌂ original root"))
                    main = up.concat(main)
                    var labels = listing.rows.map(r => icon(r.type) + " " + (isString(r.key) ? stringify(r.key, __, "") : "[" + r.key + "]") + " | " + r.type + (isDef(r.size) ? " | " + r.size + " entries" : ""))
                    var pick = choose("Explore", main.map(c => c.label).concat(labels))
                    if (!isNumber(pick) || pick < 0) break
                    if (pick < main.length) main[pick].handler()
                    else if (pick < main.length + listing.rows.length) select(state.path.concat([listing.rows[pick - main.length].key]))
                } catch(e) {
                    if (e !== cancelled) ui.write(scanCancelled ? tone("YELLOW", "Scan cancelled.") : tone("RED", "Error: " + e))
                }
            }
        }
    }
    api.run = () => ui && ui.readKey && ui.size && ui.ansi !== false ? runTUI() : api.runMenu()
    return api
}

const _idescUI = () => {
    if (typeof askConsole != "function") throw "idesc requires OpenAF askConsole/askChoose UI support; rebuild/update OpenAF"
    var ui = askConsole(), terminal = ui.console.getConsoleReader().getTerminal().unwrap(), last = 0
    if (ui.ansi) {
        if (typeof askKey != "function" || !["read", "size", "raw", "altScreen"].every(k => isFunction(ui[k]))) throw "out=idesc needs OpenAF askKey and askConsole read/size/raw/altScreen support; rebuild/update OpenAF"
        ui.readKey = timeout => askKey(ui, timeout)
    }
    ui.scan = fn => {
        var attrs = terminal.enterRawMode()
        try { return fn() } finally { terminal.setAttributes(attrs) }
    }
    ui.cancel = () => terminal.reader().read(1) == 3
    ui.progress = n => { if (now() - last > 1000) { ui.write((ui && ui.console ? ansiColor("CYAN", "⏳ ") : "") + "Scanning: " + n + " bytes (Ctrl-C cancels)"); last = now() } }
    return ui
}
const _idescOutput = value => {
    var ui
    try {
        ui = _idescUI()
        var browser = _idesc(value, __, ui)
        if (params.idescrecipe) browser.load(io.readFileJSON(params.idescrecipe))
        browser.run()
    }
    catch(e) { _exit(-1, String(e)) }
    finally { if (ui) ui.close() }
}
const _idescSource = () => {
    if (!isFunction(io.scanJSON) || !isFunction(io.copyJSONRange)) throw "idescsource=stream requires OpenAF io.scanJSON/copyJSONRange; rebuild/update OpenAF"
    if (isDef(params.type) && params.type != "json") throw "idescsource=stream supports JSON input only"
    var incompatible = ["path", "opath", "from", "ifrom", "sql", "isql", "jsonprefix", "jsondesc", "stream", "outputkey", "outkey", "loop", "pipe", "outfileappend"]
        .concat(Object.keys(_transformFns))
    incompatible.forEach(k => { if (isDef(params[k])) throw "idescsource=stream cannot use " + k + "; narrow/query inside idesc or use loaded mode" })
    if (isDef(params.chs) || isDef(params.paramsfile) && params.paramsfile == "-") throw "idescsource=stream requires an independent JSON source"
    if (isDef(_cs) && !/^utf-?8$/i.test(_cs)) throw "idescsource=stream requires UTF-8 JSON"
    var interactive = params.format == "idesc", ui = interactive ? _idescUI() : __, temp
    var run = file => {
        var browser = _idesc(__, file, ui)
        if (params.idescrecipe) browser.load(io.readFileJSON(params.idescrecipe))
        if (interactive) browser.run()
        else if (params.outfile) browser.saveData(params.outfile, params.format || "json")
        else browser.exportData(java.lang.System.out, params.format || "json")
    }
    try {
        if (isString(params.file) && params.file.indexOf("::") < 0) return _withInputFilePath(run)
        temp = io.createTempFile("oafp-idesc-", ".json")
        new java.io.File(temp).deleteOnExit()
        var copy = input => {
            var out = io.writeFileStream(temp)
            try { ioStreamCopy(out, input) } finally { out.close() }
        }
        if (isDef(params.url)) {
            var rest = $rest(_fromJSSLON(params.urlparams || "{}")), method = String(params.urlmethod || "get").toLowerCase()
            if (["get", "post", "put", "delete"].indexOf(method) < 0) throw "Unsupported JSON URL method"
            var input = method == "get" || method == "delete" ? rest[method + "2Stream"](params.url) : rest[method + "2Stream"](params.url, _fromJSSLON(params.urldata || "{}"))
            try { copy(input) } finally { input.close() }
        } else if (isString(params.file)) {
            var input = io.readFileStream(params.file)
            try { copy(input) } finally { input.close() }
        }
        else _withInputStream(isString(params.data) ? params.data : "", copy)
        return run(temp)
    } finally { try { if (temp) io.rm(temp) } finally { if (ui) ui.close() } }
}
