exports.run = function() {
   var params = {}, create = eval(io.readFileString("../include/idescFns.js") + "\n_idesc")
   var eq = (a,b,msg) => ow.test.assert(a,b,msg)
   var fails = (fn, msg) => { var failed = false; try {fn()} catch(e) {failed = true}; eq(failed,true,msg) }
   var fixture = {items:[{n:1,nested:{s:"long text"}},{n:2},{n:3}], "a.b":[null,{},[],"café €"], "":{}, "quote\"":true, "0":"numeric key"}
   var file = io.createTempFile("idesc-test", ".json")
   try {
      io.writeFileString(file,stringify(fixture))
      ;[undefined,file].forEach(source => {
         var b = create(fixture,source)
         eq(b.list().meta.type,"map","Describe root")
         eq(b.list().rows.map(r => r.key),Object.keys(fixture),"Literal property names")
         b.select(["0"]); eq(b.current(),"numeric key","Numeric string key remains a map key")
         eq($path(fixture,b.path()),"numeric key","Numeric string printed path")
         b.select(["a.b",3]); eq(b.current(),"café €","UTF-8 scalar")
         eq($path(fixture,b.path()),"café €","Printed path is reusable")
         b.parent(); eq(b.current(),fixture["a.b"],"Parent path")
         b.back(); eq(b.current(),"café €","Back restores selection")
         b.select([""]); eq(b.current(),{},"Empty map")
         b.select(["a.b",2]); eq(b.current(),[],"Empty array")
         b.select(["a.b",0]); eq(b.current(),null,"Null selection")
         b.select(["items"]); b.bookmark("rows")
         b.apply({op:"path",expression:"[?n > `1`].{value:n}"})
         eq(b.current(),[{value:2},{value:3}],"Query through existing path engine")
         eq(b.path(),"@","Derived view has its own root")
         eq(b.recipe().operations.length,2,"Retain source and query provenance")
         var saved = b.recipe(), c = create(fixture,source); c.load(saved)
         eq(c.current(),b.current(),"Replay ordered operations")
         b.back(); eq(b.current(),fixture.items,"Undo query")
         b.apply({op:"from",expression:"equals(n, 2)"}); eq(b.current(),[{n:2}],"Existing from engine")
         b.back(); b.apply({op:"sql",expression:"select n where n > 1"})
         eq(b.current().length,2,"Existing SQL engine")
         b.back(); b.apply({op:"slice",start:1,end:3}); eq(b.current(),[{n:2},{n:3}],"Bounded slice")
         b.root(); b.select(["items"])
         var summary = b.fields(); eq(summary.sampled,3,"Field sample coverage")
         eq(summary.fields.filter(r => r.field == "nested")[0].missing,2,"Missing sampled fields")
         b.select(["items",0]); b.bookmark("first"); b.select(["items",1])
         eq(b.compare(b.recipe().bookmarks.first,true).length > 0,true,"Bounded value comparison")
         var before = b.current()
         fails(() => b.apply({op:"path",expression:"[invalid"}),"Bad query rejected")
         eq(b.current(),before,"Bad query keeps state")
         fails(() => b.select(["missing"]),"Missing path rejected")
         eq(b.current(),before,"Bad navigation keeps state")
         fails(() => b.load({version:1,source:source ? "stream" : "loaded",operations:[{op:"eval",expression:"bad"}],bookmarks:{}}),"Reject unknown operations")
         var out = new java.io.ByteArrayOutputStream(); b.exportData(out,"json")
         eq(jsonParse(String(out.toString("UTF-8"))),before,"Export selected JSON")
         out = new java.io.ByteArrayOutputStream(); b.exportData(out,"yaml")
         eq(af.fromYAML(String(out.toString("UTF-8"))),before,"Export selected YAML")
      })
      params = {idescpage:2,idescstring:4,idescdepth:2}
      var b = create(fixture,file)
      eq(b.list().rows.length,2,"Real page size")
      eq(b.list().more,true,"Further page available")
      b.select(["items"])
      eq(b.preview().value.length,3,"Bounded rows plus truncation marker")
      b.select(["a.b",3]); eq(String(b.preview().value).indexOf("truncated") >= 0,true,"Bounded scalar preview")
      params = {idescbytes:8}
      var b = create(fixture,file)
      fails(() => b.current(),"Loading byte limit")
      eq(b.preview().value != null,true,"Metadata preview works beyond loading limit")
      params = {idescnodes:2}
      fails(() => create(fixture,file).current(),"Loading node limit")
      params = {idescpage:0}; fails(() => create(fixture),"Reject invalid options")
      params = {}
      var b = create(fixture,file); b.select(["items"])
      io.writeFileString(file,'{"changed":true}')
      fails(() => b.current(),"Detect changed source")
      eq(b.path(),"@","Restart changed source at root")
      eq(b.current(),{changed:true},"Reload changed source")
      io.writeFileString(file,stringify(fixture))
      ;[undefined,file].forEach(source => {
         var output = io.createTempFile("idesc-export", ".json"), messages = []
         var choices = ['"items"', "🔍 Preview...", "cyaml", "🧰 Tools...", "Slice array...", "🧮 Query...", "path", "🧰 Tools...", "Recipe...", "Print", "💾 Export...", "json", "File…", "Replace", "🚪 Quit"]
         var answers = ["0:2", "[].n", output]
         var ui = {
            write:text => messages.push(text), ask:() => answers.shift(),
            choose:(title, labels) => {
               var wanted = choices.shift(), index = labels.findIndex(s => s === wanted || s.replace(/^[^\x00-\x7f]+ /, "").indexOf(wanted + " |") === 0)
               if (index < 0) throw "Missing test choice: " + wanted
               return index
            }
         }
         try {
            create(fixture,source,ui).run()
            eq(choices.length,0,"Scripted browse/preview/query/export completes")
            eq(io.readFileJSON(output),[1,2],"Export contains selected data only")
            eq(messages.some(s => s.indexOf("Saved: " + output) >= 0),true,"Export confirmation")
            eq(messages.some(s => s.indexOf("oafp | Interactive") >= 0),true,"Plain welcome")
            eq(messages.some(s => s.indexOf("numbered choices") >= 0),true,"Fallback guidance")
            eq(messages.some(s => s.indexOf("Replay:") >= 0),true,"Recipe replay guidance")
            eq(messages.some(s => s.indexOf("📍 ⌂") >= 0),true,"Breadcrumb header")
            eq(messages.some(s => s.indexOf("Recipe: [") >= 0),false,"Headers omit recipe JSON")
         } finally { io.rm(output) }
      })
      ;[undefined,file].forEach(source => {
         var actions = ['"items"', "🧰 Tools...", "Count entries", "🧰 Tools...", "Field summary", "🧰 Tools...", "Recipe...", "Print", "🚪 Quit"]
         var messages = [], b = create(fixture,source,{
            write:s => messages.push(s),
            choose:(title, labels) => {
               var wanted = actions.shift()
               return labels.findIndex(s => s == wanted || s.replace(/^[^\x00-\x7f]+ /, "").indexOf(wanted + " |") == 0)
            }
         })
         b.run()
         eq(actions.length,0,"Structured tool results workflow completes")
         ;[b.list().meta,b.fields(),b.recipe()].forEach(value => {
            eq(messages.indexOf($o(value, {__format:"ctree"}, __, true)) >= 0,true,"Tool result uses ctree")
         })
      })
      var special = {Query:1, Quit:2, "":3, "a.b":4, "日本語":5}
      special[new Array(160).join("long")] = 6
      ;[undefined,file].forEach(source => {
         io.writeFileString(file,stringify(special))
         var actions = ["🧭 Navigate...", "Filter names...", "🧭 Navigate...", "Filter names...", "🧮 Query...", "path", "🧮 Query...", "Back", "🧰 Tools...", "Back", '"Quit"', "🧭 Navigate...", "Parent", "🚪 Quit"]
         var answers = ["no-match", "", null], messages = [], rootMenus = 0
         var b = create(special,source,{
            write:s => messages.push(s), ask:() => answers.shift(),
            choose:(title, labels) => {
               if (title == "Navigate" && rootMenus++ < 2) {
                  eq(labels.indexOf("Parent"),-1,"Root hides Parent")
                  eq(labels.indexOf("Undo last change"),-1,"Root hides Undo")
                  eq(labels.indexOf("Previous page"),-1,"First page hides Previous")
               }
               if (title == "Tools") {
                  eq(labels.indexOf("Slice array..."),-1,"Maps hide Slice")
                  eq(labels.indexOf("Compare with bookmark..."),-1,"No bookmarks hides Compare")
               }
               if (title == "Explore" && labels.some(s => s.indexOf('"Query" |') > 0)) {
                  Object.keys(special).forEach(k => eq(labels.some(s => s.indexOf(stringify(k, __, "") + " |") > 0),true,"Quoted literal key: " + k))
               }
               var wanted = actions.shift(), pick = labels.findIndex(s => s == wanted || s.replace(/^[^\x00-\x7f]+ /, "").indexOf(wanted + " |") == 0)
               if (pick < 0) throw "Missing choice: " + wanted
               return pick
            }
         })
         b.run()
         eq(actions.length,0,"Cancellation and literal-command workflow completes")
         eq(b.path(),"@","Parent returns from scalar")
         eq(b.recipe().operations,[],"Cancelled query leaves operations unchanged")
         eq(messages.some(s => s.indexOf("No matching names") >= 0),true,"Empty filter guidance")
         eq(messages.some(s => s.indexOf("No child entries") >= 0),true,"Scalar guidance")
         eq(messages.some(s => s.indexOf("Error:") >= 0),false,"Cancellation produces no error")
      })
      params = {idescpage:2}
      ;[undefined,file].forEach(source => {
         io.writeFileString(file,stringify(fixture))
         var actions = ["🧭 Navigate...", "Next page", "🧭 Navigate...", "Previous page", "🧭 Navigate...", null, "🧮 Query...", null, "💾 Export...", "Back", "🔍 Preview...", "Back", null]
         var visited = 0, b = create(fixture,source,{
            write:() => {}, choose:(title, labels) => {
               if (title == "Navigate") {
                  eq(labels.indexOf("Previous page") >= 0,visited == 1,"Previous available after Next only")
                  visited++
               }
               var wanted = actions.shift()
               return wanted == null ? -1 : labels.indexOf(wanted)
            }
         })
         b.run(); eq(actions.length,0,"Page navigation and submenu cancellation")
         eq(b.path(),"@","Cancelled menus preserve location")
         eq(b.list().rows[0].key,Object.keys(fixture)[0],"Previous restores first page")
      })
      params = {}
      io.writeFileString(file,stringify(fixture))
      var messages = [], turns = 0, b = create(fixture,file,{
         write:s => messages.push(s), choose:(title, labels) => {
            if (turns++ == 0) {
               io.writeFileString(file,'{"changed":true}')
               return 6
            }
            eq(labels.some(s => s.indexOf('"changed" |') > 0),true,"Changed source listing recovers")
            return labels.indexOf("🚪 Quit")
         }
      })
      b.run()
      eq(b.path(),"@","Changed file resets interactive view")
      eq(messages.some(s => s.indexOf("Error: Source changed;") >= 0),true,"Changed source reports recovery")
      io.writeFileString(file,stringify(fixture))
      var interrupted = false, messages = [], b = create(fixture,file,{
         write:s => messages.push(s), cancel:() => { if (!interrupted) { interrupted = true; return true }; return false },
         choose:(title, labels) => labels.indexOf("🚪 Quit")
      })
      b.run()
      eq(messages.some(s => s == "Scan cancelled."),true,"Scan cancellation feedback")
      eq(messages.some(s => s.indexOf("Error:") == 0),false,"Cancelled scan is not a processing error")
      // ---- full-screen tree browser (key-driven)
      var tdata = {items:[{n:1,nested:{s:"long text"}},{n:2},{n:3}], "a.b":[null,{},[],"café €"], "":{}, "quote\"":true, name:"hello"}
      io.writeFileString(file,stringify(tdata))
      var strip = s => String(s).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\r\n/g, "\n")
      var typed = s => s.split("")
      var tui = (data, source, keys, size) => {
         var queue = keys.slice(), frames = [], b = create(data, source, {write:t => frames.push(strip(t)), readKey:() => queue.length ? queue.shift() : "eof", size:() => size || {width:80, height:20}})
         b.run()
         return {b:b, frames:frames, last:frames[frames.length - 1], all:frames.join("\n")}
      }
      var has = (t, text, msg) => eq(t.indexOf(text) >= 0, true, msg + " (missing: " + text + ")")
      var lacks = (t, text, msg) => eq(t.indexOf(text) >= 0, false, msg + " (unexpected: " + text + ")")
      var cursorRow = t => t.last.split("\n").filter(l => l.charAt(0) == "▌")[0] || ""
      ;[undefined,file].forEach(source => {
         var label = source ? "stream: " : "loaded: "
         var t = tui(tdata, source, ["q"])
         has(t.last, "items [", label + "collapsed array shows its length marker")
         has(t.last, "▸", label + "collapsed containers have a marker")
         eq(t.last.split("\n")[2].replace(/^[ ▌]/, "").indexOf("▾ @"), 0, label + "The root is a flush-left branch label, not a leaf")
         has(t.last, "╭ ▸ items", label + "ctree glyph for the first child")
         has(t.last, "├ ", label + "ctree glyph for middle children")
         has(t.last, "╰ ", label + "ctree glyph for the last child")
         has(t.last, 'hello', label + "root children listed")
         eq(t.b.recipe().operations, [], label + "quit emits nothing and records nothing")
         if (!source) { has(t.last, "items [3]", "Known array length"); has(t.last, '"a.b" [4]', "Quoted literal key with length") }
         t = tui(tdata, source, ["down", "right", "right", "q"])
         has(t.last, "│ ╭ ▸ [0]", label + "Nested children continue the parent line")
         has(t.last, "▾ items", label + "Expand shows the open marker")
         eq(t.b.recipe().operations, [], label + "Expand/collapse is not recorded")
         eq(t.b.path(), "@", label + "Expand keeps the root")
         has(cursorRow(t), "[0]", label + "Cursor moves to first child")
         t = tui(tdata, source, ["down", "right", "right", "right", "right", "right", "q"])
         has(t.last, "n: 1", label + "Inline scalar value")
         t = tui(tdata, source, ["down", "right", "left", "q"])
         lacks(t.last, "▾ items", label + "Left collapses")
         t = tui(tdata, source, ["down", "right", "right", "h", "q"])
         has(cursorRow(t), "items", label + "Left on a collapsed child jumps to the parent row")
         t = tui(tdata, source, ["down", "enter", "q"])
         eq(t.b.path(), '@."items"', label + "Enter zooms")
         eq(t.b.recipe().operations, [{op:"select", path:["items"]}], label + "Zoom is recorded")
         has(t.last, "[0]", label + "Zoomed children visible")
         t = tui(tdata, source, ["down", "enter", "backspace", "q"])
         eq(t.b.path(), "@", label + "Backspace zooms out")
         has(cursorRow(t), "items", label + "Zoom out keeps the cursor on the node we came from")
         t = tui(tdata, source, ["down", "enter", "right", "enter", "~", "q"])
         eq(t.b.path(), "@", label + "~ returns to the original root")
         t = tui(tdata, source, ["down", "enter", "U", "q"])
         eq(t.b.path(), "@", label + "U undoes the zoom")
         t = tui(tdata, source, ["G", "q"])
         has(cursorRow(t), "hello", label + "G jumps to the last row")
         t = tui(tdata, source, ["G", "g", "q"])
         has(cursorRow(t), "@", label + "g jumps to the first row")
         t = tui(tdata, source, typed("/ite").concat(["enter", "q"]))
         has(t.last, "items", label + "Filter keeps matching names")
         lacks(t.last, "hello", label + "Filter hides non-matching names")
         has(t.last, "ite", label + "Filter shown in the status line")
         t = tui(tdata, source, typed("/ite").concat(["esc", "q"]))
         has(t.last, "hello", label + "Esc clears the filter")
         t = tui(tdata, source, ["down"].concat(typed(":path [?n > `1`]"), ["enter", "q"]))
         eq(t.b.current(), [{n:2}, {n:3}], label + ":path queries the focused node")
         eq(t.b.recipe().operations.length, 2, label + "Query records the implicit zoom and the query")
         t = tui(tdata, source, ["down"].concat(typed(":slice 0:2"), ["enter", "q"]))
         eq(t.b.current().length, 2, label + ":slice")
         t = tui(tdata, source, [":"].concat(typed("jump items[1]"), ["enter", "q"]))
         eq(t.b.path(), '@."items"[1]', label + ":jump")
         t = tui(tdata, source, [":"].concat(typed("nonsense"), ["enter", "q"]))
         has(t.last, "Unknown command", label + "Unknown command is reported")
         t = tui(tdata, source, [":"].concat(typed("sl"), ["tab"], typed("0:1"), ["esc", "q"]))
         has(t.all, "slice 0:1", label + "Tab completes command names")
         t = tui(tdata, source, ["down", "p", "q", "q"])
         has(t.all, "Preview", label + "Preview overlay")
         has(t.all, "line 1/", label + "Overlay status")
         t = tui(tdata, source, ["down", "p", "f", "q", "q"])
         has(t.all, "Preview format:", label + "Preview format cycles")
         t = tui(tdata, source, ["?", "G", "q", "q"])
         has(t.all, "Zoom (recorded in the recipe)", label + "Help overlay")
         has(t.all, "Commands", label + "Help overlay lists commands")
         t = tui(tdata, source, ["down", "y", "q"])
         has(t.last, "path=items", label + "y shows a reusable path")
         t = tui(tdata, source, ["down"].concat(typed(":fields"), ["enter", "q", "q"]))
         has(t.all, "Field summary", label + ":fields overlay")
         has(t.all, "present", label + ":fields content")
         t = tui(tdata, source, ["down"].concat(typed(":count"), ["enter", "q", "q"]))
         has(t.all, "Count entries", label + ":count overlay")
         t = tui(tdata, source, ["down"].concat(typed(":bm first"), ["enter"], typed(":bm"), ["enter", "q", "q"]))
         has(t.all, "Bookmarks", label + "Bookmark list overlay")
         has(t.all, "first", label + "Bookmark saved from the focused node")
         eq(t.b.recipe().bookmarks.first, [{op:"select", path:["items"]}], label + "Bookmark records the focus without zooming")
         eq(t.b.path(), "@", label + "Bookmarking does not move the view")
         t = tui(tdata, source, ["down"].concat(typed(":bm first"), ["enter", "down", "down", "enter"], typed(":compare first"), ["enter", "q", "q"]))
         has(t.all, "Compare", label + "Compare overlay")
         t = tui(tdata, source, [":"].concat(typed("recipe"), ["enter", "q", "q"]))
         has(t.all, "Replay:", label + "Recipe overlay")
         var out1 = io.createTempFile("idesc-tui-export", ".json")
         t = tui(tdata, source, ["down"].concat(typed(":export json " + out1), ["enter", "y", "q"]))
         eq(io.readFileJSON(out1), tdata.items, label + "Export writes the focused node only (replace confirmed)")
         eq(t.b.path(), "@", label + "Export does not move the view")
         io.writeFileString(out1, "keep")
         t = tui(tdata, source, ["down"].concat(typed(":export json " + out1), ["enter", "n", "q"]))
         eq(io.readFileString(out1), "keep", label + "Declining replace leaves the file")
         has(t.all, "Replace", label + "Replace confirmation asked")
         io.rm(out1)
         var rfile = io.createTempFile("idesc-tui-recipe", ".json"); io.rm(rfile)
         t = tui(tdata, source, ["down", "enter"].concat(typed(":recipe save " + rfile), ["enter", "q"]))
         eq(io.readFileJSON(rfile).operations, [{op:"select", path:["items"]}], label + "Recipe save")
         t = tui(tdata, source, [":"].concat(typed("recipe load " + rfile), ["enter", "q"]))
         eq(t.b.path(), '@."items"', label + "Recipe load")
         io.rm(rfile)
         t = tui(tdata, source, [":"].concat(typed("slice 1:2"), ["enter", "q"]))
         has(t.last, "Error:", label + "Slicing a map is an error shown in the status line")
         eq(t.b.path(), "@", label + "Failed command keeps the view")
         t = tui(tdata, source, [], {width:30, height:10})
         eq(t.last.split("\n").every(l => l.length <= 30 + 1), true, label + "Narrow terminals clip every line")
         eq(t.last.split("\n").length, 10, label + "Frame fills the terminal height")
      })
      // arrays of flat maps are shown as tables, with a way back to the tree
      var rowsData = {rows:[{id:1, name:"alpha", ok:true}, {id:22, name:"beta", ok:null}, {id:3, name:"gamma"}], nested:[{a:{b:1}}], mixed:[1, {a:1}]}
      io.writeFileString(file,stringify(rowsData))
      ;[undefined,file].forEach(source => {
         var label = "table " + (source ? "stream: " : "loaded: ")
         var t = tui(rowsData, source, ["down", "right", "q"])
         has(t.last, "id│name │ok", label + "Array of flat maps is a table with a header")
         has(t.last, "──┼", label + "Table separator line")
         has(t.last, "22│beta", label + "Table row")
         lacks(t.last, "[0]", label + "No per-entry tree rows while a table")
         t = tui(rowsData, source, ["down", "right", "down", "down", "q"])
         has(cursorRow(t), "beta", label + "Cursor skips the header and separator and rests on entries")
         t = tui(rowsData, source, ["down", "right", "down", "enter", "q"])
         eq(t.b.path(), '@."rows"[0]', label + "Enter on a table row zooms into the entry")
         t = tui(rowsData, source, ["down", "right", "down", "t", "q"])
         has(t.last, "[0]", label + "t switches the array back to a tree")
         lacks(t.last, "id│name", label + "Tree view has no table")
         has(t.all, "Tree view", label + "Switch is announced")
         t = tui(rowsData, source, ["down", "right", "t", "t", "q"])
         has(t.last, "id│name", label + "t toggles back to the table")
         t = tui(rowsData, source, ["down", "right", "T", "q"])
         lacks(t.last, "id│name", label + "T turns tables off everywhere")
         has(t.last, "[0]", label + "T shows trees")
         t = tui(rowsData, source, ["down", "down", "right", "t", "q"])
         has(t.last, "[0]", label + "Nested maps are not tabulated")
         has(t.last, "flat map", label + "t explains why a table is not possible")
         t = tui(rowsData, source, ["down", "down", "down", "right", "q"])
         lacks(t.last, "a │", label + "Mixed arrays stay as trees")
         t = tui(rowsData, source, ["down", "enter", "q"])
         has(t.last, "id│name", label + "A zoomed array of flat maps is a table at the root")
         t = tui(rowsData, source, ["down", "right", "down", "h", "q"])
         has(cursorRow(t), "rows", label + "Left on a table row goes to the array")
      })
      io.writeFileString(file,stringify(tdata))
      // colors follow OpenAF's __colorFormat
      var savedColors = clone(__colorFormat)
      try {
         __colorFormat.key = "RED"; __colorFormat.string = "MAGENTA"; __colorFormat.askPre = "BLUE"
         __colorFormat.tree = {lines:"YELLOW"}; __colorFormat.table = {lines:"CYAN", title:"UNDERLINE", value:"RESET", bandRow:"UNDERLINE"}
         var raw = []
         var queue = ["down", "right", "q"]
         create(tdata, undefined, {console:{}, write:t => raw.push(t), readKey:() => queue.length ? queue.shift() : "eof", size:() => ({width:80, height:20})}).run()
         var frame = raw[raw.length - 1]
         has(frame, ansiColor("RED", "name", true), "Keys use __colorFormat.key")
         has(frame, ansiColor("YELLOW", "├ ", true), "Tree lines use __colorFormat.tree.lines")
         has(frame, ansiColor("BLUE", "oafp", true), "Header uses __colorFormat.askPre")
         queue = ["q"]; raw = []
         create(tdata, undefined, {console:{}, write:t => raw.push(t), readKey:() => queue.length ? queue.shift() : "eof", size:() => ({width:80, height:20})}).run()
         has(raw[raw.length - 1], ansiColor("MAGENTA", '"hello"', true), "String values use __colorFormat.string")
         var tbl = {rows:[{id:1}, {id:2}]}; queue = ["down", "right", "q"]; raw = []
         create(tbl, undefined, {console:{}, write:t => raw.push(t), readKey:() => queue.length ? queue.shift() : "eof", size:() => ({width:80, height:20})}).run()
         has(raw[raw.length - 1], ansiColor("UNDERLINE", "id", true), "Table header uses __colorFormat.table.title")
         has(raw[raw.length - 1], ansiColor("CYAN", "──", true), "Table lines use __colorFormat.table.lines")
         has(raw[raw.length - 1], ansiColor(__colorFormat.number, "1 ", true), "Table cells use their value-type color")
         has(raw[raw.length - 1], ansiColor("UNDERLINE," + __colorFormat.number, "2 ", true), "Every second table row is banded with __colorFormat.table.bandRow")
         lacks(raw[raw.length - 1], ansiColor("UNDERLINE," + __colorFormat.number, "1 ", true), "The first table row is not banded")
      } finally { Object.keys(savedColors).forEach(k => { __colorFormat[k] = savedColors[k] }) }
      // chunked expansion: never more than idescpage children per node
      params = {idescpage:2}
      ;[undefined,file].forEach(source => {
         var label = "chunk " + (source ? "stream: " : "loaded: ")
         var t = tui(tdata, source, ["down", "right", "q"])
         has(t.last, "[1]", label + "First chunk")
         lacks(t.last, "[2]", label + "Second chunk not loaded yet")
         has(t.last, "Enter loads 2", label + "More row")
         if (!source) has(t.last, "… 1 more", label + "More row counts the remaining entries")
         t = tui(tdata, source, ["down", "right", "down", "down", "down", "enter", "q"])
         has(t.last, "[2]", label + "Enter on the more row loads the next chunk")
         lacks(t.last, "… 1 more", label + "The array's more row disappears at the end")
      })
      params = {}
      // numbered fallback when ANSI is unavailable even if a key reader exists
      var fell = false, menuUi = {ansi:false, write:() => {}, readKey:() => { throw "must not read keys" }, size:() => ({width:80, height:20}), choose:(title, labels) => { fell = true; return labels.indexOf("🚪 Quit") }}
      create(tdata, undefined, menuUi).run()
      eq(fell, true, "Non-ANSI terminals use the numbered menu")
      // scalar roots render their value
      var t = tui({a:"deep"}, undefined, ["down", "enter", "q"])
      has(t.last, '"deep"', "Scalar root shows its value")
   } finally {io.rm(file)}
}
