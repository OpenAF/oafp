(function() {

   exports.testSetRegressions = function() {
      var params = {set:{a:"a",b:"b"}}
      var _fromJSSLON = value => value
      var transforms = eval(io.readFileString("../include/transformFns.js") + "\n_transformFns")
      var eq = (a,b,msg) => ow.test.assert(a,b,msg)
      var data = {a:[{id:1,"*":"existing"},{id:2,"*":"old"}],b:[{id:1,"*":"existing"},{id:3,"*":"new"}]}
      var original = stringify(data)
      params.setop = "diff"
      eq(transforms.set(data),[{id:2,"*":"a"},{id:3,"*":"b"}],"Reserved marker cannot override membership")
      eq(stringify(data),original,"Set leaves inputs unchanged")
      params.setkeys = "id"
      eq(transforms.set({a:[{id:1,"*":"a"}],b:[{id:1,"*":"b"}]}),[],"setkeys ignores non-key marker")
      delete params.setkeys
      var operations = {union:[1,1,2,3,3],diffa:[1,1],diffb:[3,3],diffab:[1,1,3,3],intersect:[2]}
      Object.keys(operations).forEach(op => {
         params.setop = op
         eq(transforms.set({a:[1,1,2],b:[2,3,3]}),operations[op],"Preserve duplicate/order behavior: " + op)
         eq(transforms.set({a:[],b:[]}),[],"Empty set: " + op)
      })
      params.setop = "diffab"
      eq(transforms.set({a:[{z:[1,{b:2,a:1}]}],b:[{z:[1,{a:1,b:2}]}]}),[],"Nested canonical keys")
      var nativeStringify = global.stringify, count = $atomic()
      var counted = function() { count.inc(); return nativeStringify.apply(null,arguments) }
      transforms = (function(stringify) { return eval(io.readFileString("../include/transformFns.js") + "\n_transformFns") })(counted)
      transforms.set({a:Array.from({length:1000},(v,i)=>i),b:Array.from({length:1000},(v,i)=>i)})
      eq(count.get(),2000,"One serialization per input element")
   }

   exports.testNestedFailures = function() {
      ow.loadObj()
      var params, output, keys = new java.util.concurrent.ConcurrentHashMap(), calls = new ow.obj.syncArray(), fail = {}
      var _exit = (code, error) => { throw error }
      var _fromJSSLON = value => value
      var $get = key => Number(keys.get(key))
      var $unset = key => keys.remove(key)
      var _$o = value => { output = value }
      var oafp = request => {
         calls.add({id:request.id,noexit:request.noexit})
         if (request.__key) keys.put(request.__key,request.id)
         if (fail[request.id]) throw "failure-" + request.id
      }
      var handler = eval(io.readFileString("../include/inputFns.js") + "\n_inputFns.get('oafp')")
      ;[true,false].forEach(seq => {
         params = {inoafpseq:seq}; calls = new ow.obj.syncArray(); fail = {}; output = undefined
         var requests = [{id:0},{id:1},{id:2}]
         handler(requests,{})
         ow.test.assert(output,[0,1,2],"Nested success ordering")
         ow.test.assert(requests,[{id:0},{id:1},{id:2}],"Nested parameters unchanged")
         fail = {0:true,2:true}; output = undefined; calls = new ow.obj.syncArray()
         var error
         try { handler(requests,{}) } catch(e) { error = String(e) }
         ow.test.assert(error.indexOf("entry 0") >= 0,true,"Deterministic indexed failure")
         ow.test.assert(isUnDef(output),true,"No successful aggregate on failure")
         ow.test.assert(calls.length(),3,"Workers settled before failure")
         ow.test.assert(calls.toArray().every(call => call.noexit === true),true,"Nested calls throw rather than exit")
         ow.test.assert(Number(keys.size()),0,"Captured keys cleaned after failure")
      })
      var fixture = io.createTempFile("oafp-nested-", ".json")
      try {
         ["../oafp.source.js","../oafp.js"].forEach(script => {
            ;[true,false].forEach(seq => {
               io.writeFileJSON(fixture,[{in:"json",data:"1"},{in:"json",data:"2"}])
               var args = "in=oafp out=json file=" + fixture + " inoafpseq=" + seq
               var result = $sh([getOpenAFPath()+"/oaf","-f",script,"-e",args]).get(0)
               ow.test.assert(jsonParse(result.stdout),[1,2],"Nested CLI success")
               io.writeFileJSON(fixture,[{in:"json",data:"1"},{in:"json",file:fixture+".missing",noexit:false}])
               result = $sh([getOpenAFPath()+"/oaf","-f",script,"-e",args]).get(0)
               ow.test.assert(result.exitcode != 0,true,"Nested failure has nonzero CLI status")
               ow.test.assert(result.stderr.indexOf("entry 1") >= 0,true,"Nested CLI error identifies child")
               ow.test.assert(result.stdout.trim(),"","Nested CLI emits no aggregate on failure")
            })
         })
      } finally { io.rm(fixture) }
   }

   exports.testJavaGC = function() {
      ow.loadFormat()
      var processExpr = () => undefined
      var __flags = clone(global.__flags); __flags.OAFP = {libs:[]}
      var eq = (a,b,msg) => ow.test.assert(a,b,msg)
      var parser = eval(io.readFileString("../include/streamFns.js") + "\n_javaGCParser()")
      var stamp = "2015-05-26T14:25:13.123+0000: "
      var young = "1.234: [GC (Allocation Failure) [PSYoungGen: 1024K->256K(2048K)] 4096K->3328K(8192K), 0.005 secs]"
      var times = " [Times: user=0.01 sys=0.02, real=0.03 secs]"
      var full = "1.234: [Full GC (Ergonomics) [PSYoungGen: 1024K->0K(2048K)] [ParOldGen: 4096K->2048K(8192K)] 5120K->2048K(10240K), [Metaspace: 100K->90K(1024K)], 0.020 secs]"
      var heap = "[1.234s][info][gc] GC(0) Pause Young (Normal) (G1 Evacuation Pause) 100M->10M(256M) 5.000ms"
      var meta = "[1.234s][info][gc,metaspace] GC(0) Metaspace: 100K(200K)->90K(200K) NonClass: 60K(120K)->50K(120K) Class: 40K(80K)->40K(80K)"
      var fixtures = [stamp+young,stamp+young+times,stamp+young.replace(" [PSYoungGen", "\n [PSYoungGen")+times,stamp+full,stamp+full+times,
         "1.234: [GC (Allocation Failure) 4096K->3328K(8192K), 0.005 secs]",heap,meta,
         "[1.234s][info][gc] GC(0) Allocation Failure extra 100M->10M(256M) 5.000ms"]
      fixtures.forEach((text,i) => {
         var r = parser(text)
         eq(isMap(r),true,"GC fixture parsed: " + i)
         if (i != 7) eq(r.durationSecs,i == 3 || i == 4 ? 0.02 : 0.005,"GC duration: " + i)
         if (i < 3 || i == 5) { eq(r.heapBeforeGC,4194304,"Young heap before"); eq(r.heapAfterGC,3407872,"Young heap after") }
         if (i == 3 || i == 4) { eq(r.ParOldGenAfterGC,2097152,"Old generation"); eq(r.metaAfterGC,92160,"Legacy metaspace") }
         if (i == 1 || i == 2 || i == 4) eq([r.userTime,r.sysTime,r.realTime],[0.01,0.02,0.03],"Timing fields")
         if (i == 6 || i == 8) { eq(r.heapBeforeGC,104857600,"Modern heap"); eq(r.heapTotal,268435456,"Modern capacity"); eq(isUnDef(r.metaUsedBeforeGC),true,"Heap is not metaspace") }
         if (i == 7) { eq(r.metaUsedAfterGC,92160,"Modern metaspace"); eq(r.classTotalAfterGC,81920,"Class capacity"); eq(isUnDef(r.durationSecs),true,"No fabricated duration") }
      })
      var directory = io.createTempDir("oafp-gc-"), input = directory + "/input", result = directory + "/result"
      var data = fixtures.join("\n"), expected = fixtures.map(parser)
      io.writeFileString(input,data)
      try {
         ["../oafp.source.js","../oafp.js"].forEach(script => {
            var run = eval(io.readFileString(script) + "\noafp")
            ;[{data:data},{file:input},{cmd:"cat " + input}].forEach(source => {
               run(merge({in:"javagc",out:"json",javagcjoin:true,outfile:result,noexit:true,__inception:true},source))
               eq(io.readFileJSON(result),jsonParse(stringify(expected)),"GC joined source parity")
            })
            io.writeFileString(result, "")
            run({in:"javagc",out:"ndjson",file:input,outfile:result,outfileappend:true,noexit:true,__inception:true})
            eq(io.readFileString(result).trim().split(/\r?\n/).map(text => jsonParse(text)),jsonParse(stringify(expected)),"GC nonjoined EOF flush")
            var stdin = $sh(["sh","-c","cat " + input + " | " + getOpenAFPath() + "/oaf -f " + script + " -e \"in=javagc out=json javagcjoin=true\""]).get(0)
            eq(stdin.exitcode,0,"GC stdin succeeds")
            eq(jsonParse(stdin.stdout),jsonParse(stringify(expected)),"GC stdin parity and EOF flush")
         })
      } finally { io.rm(directory) }
   }

   exports.testBase64Streaming = function() {
      var processExpr = () => undefined
      var __flags = clone(global.__flags); __flags.OAFP = {libs:[]}
      var directory = io.createTempDir("oafp-codec-test-"), result = directory + "/out", input = directory + "/in"
      var eq = (a,b,msg) => ow.test.assert(a,b,msg)
      try {
         ["../oafp.source.js", "../oafp.js"].forEach(script => {
            var run = eval(io.readFileString(script) + "\noafp")
            var invoke = params => {
               run(merge({outfile:result,noexit:true,__inception:true,parallel:false},params))
               return io.readFileString(result)
            }
            var text = "hello € 世界\n", encoded = af.fromBytes2String(af.toBase64Bytes(text))
            io.writeFileString(input,text)
            eq(invoke({file:input,in:"raw",out:"base64"}),encoded,"File stream Base64")
            eq(invoke({data:text,in:"raw",out:"base64"}),encoded,"Data Base64")
            var alias = directory + "/alias"
            io.writeFileString(alias, text)
            run({file:alias,in:"raw",out:"base64",outfile:alias,noexit:true,__inception:true,parallel:false})
            eq(io.readFileString(alias), encoded, "Input/output alias does not truncate input")
            var compressed = invoke({file:input,in:"raw",out:"base64",base64gzip:true})
            eq(af.fromBytes2String(io.gunzip(af.fromBase64(compressed))),text,"GZIP/Base64 output")
            eq(invoke({data:compressed,in:"base64",out:"raw",base64gzip:true}),text,"GZIP/Base64 input")
            eq(invoke({data:encoded,in:"base64",out:"raw"}),text,"Base64 input")
            var object = {x:"€",a:[1,2]}
            var structured = invoke({data:stringify(object),in:"json",out:"gb64json"})
            eq(jsonParse(af.fromBytes2String(io.gunzip(af.fromBase64(structured)))),object,"Structured GB64JSON")
            eq(invoke({data:structured,in:"gb64json",out:"json"}),stringify(object,__ ,""),"GB64JSON input")
            eq(invoke({data:encoded,in:"base64",out:"raw",jq:"ascii_upcase"}),text.toUpperCase(),"Input filters preserved")
            io.writeFileString(result, "")
            invoke({data:"one",in:"raw",out:"base64",outfileappend:true})
            invoke({data:"two",in:"raw",out:"base64",outfileappend:true})
            eq(io.readFileString(result),"b25l\ndHdv\n","Append boundaries")
            var oldBytes = af.toBase64Bytes, oldGzip = io.gzip, oldRead = io.readFileBytes
            try {
               af.toBase64Bytes = io.gzip = io.readFileBytes = function() { throw "Whole-payload bytes forbidden" }
               eq(invoke({file:input,in:"raw",out:"base64"}),encoded,"Raw conversion avoids complete byte arrays")
               eq(invoke({file:input,in:"raw",out:"base64",base64gzip:true}),compressed,"Composed output avoids complete byte arrays")
            } finally { af.toBase64Bytes = oldBytes; io.gzip = oldGzip; io.readFileBytes = oldRead }
         })
      } finally { io.rm(directory) }
   }


   exports.testCompletionData = function() {
      var generate = require("../buildCompletion.js").generate
      var find = (entries, name) => entries.filter(entry => entry.name == name)[0]
      var hints = io.readFileYAML("../completionHints.yaml")
      var markdown = io.readFileString("../docs/USAGE.md")
      var data = generate(markdown, hints)
      var input = find(data.complete, "in="), output = find(data.complete, "out=")
      ow.test.assert(isDef(find(input.opts, "in=llmdecide")), true, "New documented input formats are completed")
      ow.test.assert(isDef(find(find(output.opts, "out=idesc").opts, "idescrecords=")), true, "Output options are grouped under their format")
      ow.test.assert(isDef(find(data.complete, "ijq=")), true, "Main options are included")
      ow.test.assert(isDef(find(data.complete, "secKey=")), true, "Case-sensitive sBucket parameters are preserved")
      ow.test.assert(isDef(find(find(data.complete, "secKey=").opts, "secFile=")), true, "sBucket options remain grouped under secKey")
      ow.test.assert(isDef(find(data.complete, "statePath=")), false, "Nested decision configuration fields are excluded")
      ow.test.assert(isDef(find(data.complete, "withHeader=")), false, "CSV configuration fields are excluded")
      ow.test.assert(isDef(find(find(input.opts, "in=dsv").opts, "indsvsep=")), true, "DSV input options remain available")
      ow.test.assert(isDef(find(find(data.complete, "llmprompt=").opts, "llmenv=")), true, "Shared LLM options remain grouped across explanatory headings")
      ow.test.assert(isDef(find(find(find(data.complete, "set=").opts, "setop=").opts, "setop=union")), true, "Curated values remain nested under their option")
      ow.test.assert(isDef(find(find(data.complete, "help=").opts, "help=jsonschema")), true, "Help suggestions follow the documentation")
      var fixture = markdown + '\n## Main options:\n\n| Option | Description |\n|---|---|\n| newflag | Fresh \\| description |\n\n~~~md\n| Option | Description |\n|---|---|\n| fakeflag | Example only |\n~~~\n'
      var updated = generate(fixture, hints)
      ow.test.assert(find(updated.complete, "newflag=").desc, "Fresh | description", "New options and escaped table pipes are handled")
      ow.test.assert(isDef(find(updated.complete, "fakeflag=")), false, "Example tables are excluded")
      ow.test.assert(stringify(generate(markdown, hints)), stringify(data), "Generation is deterministic")
   }

   exports.testEnvsNoCmd = function() {
      var params, printed
      var _print = text => { printed = text }
      var output = eval(io.readFileString("../include/outputFns.js") + "\n_outputFns.get('envs')")
      var defaultCmd = ow.format.isWindows() ? "set" : "export"
      var run = options => {
         params = clone(options)
         output({"some-key": "two words", nested: {value: 7}}, {})
         return printed
      }
      var assignments = '_OAFP_some_key="two words"\n_OAFP_nested_value=7'
      var withCmd = cmd => assignments.split("\n").map(line => cmd + " " + line).join("\n")
      ow.test.assert(run({}), withCmd(defaultCmd), "envs keeps the default command")
      ;[false, "false"].forEach(flag => {
         ow.test.assert(run({envsnocmd:flag}), withCmd(defaultCmd), "envsnocmd=false keeps the command")
         ow.test.assert(run({envsnocmd:flag, envscmd:"custom"}), withCmd("custom"), "envsnocmd=false keeps a custom command")
      })
      ;[true, "true"].forEach(flag => {
         ow.test.assert(run({envsnocmd:flag}), assignments, "envsnocmd omits command and space")
         ow.test.assert(run({envsnocmd:flag, envscmd:"custom"}), assignments, "envsnocmd overrides a custom command")
      })
      ow.test.assert(run({envsnocmd:true, envsnoprefix:true}), assignments.replace(/_OAFP_/g, ""), "envsnocmd combines with envsnoprefix")
      ow.test.assert(run({envsnocmd:true, envsprefix:"APP_"}), assignments.replace(/_OAFP_/g, "APP_"), "envsnocmd preserves custom prefixes")
   }

   exports.testTerminalInitialization = function() {
      var source = io.readFileString("../oafp.source.js.hbs")
      var code = source.substring(source.indexOf("// Default format"), source.indexOf("// Check for OpenAF's sec buckets"))
      ;[false, true].forEach(interactive => {
         ;[{}, {color:false}, {color:true}, {pause:true}].forEach(options => {
            var params = clone(options), calls = 0, resets = 0, __con
            var java = {lang:{System:{console:() => interactive ? {} : null, getProperty:() => "Mac OS X"}}}
            var getEnv = () => undefined
            var __initializeCon = () => {
               calls++
               __con = {getTerminal:() => ({settings:{set:() => { resets++ }}})}
            }
            eval(code)
            var expected = interactive || options.color === true || options.pause === true ? 1 : 0
            ow.test.assert(calls,expected,"Console initialization: " + stringify({interactive:interactive,options:options}))
            ow.test.assert(resets,expected,"Only initialized consoles receive terminal settings")
            ow.test.assert(params.color,options.color,"Terminal detection preserves explicit color preference")
         })
      })
   }

   exports.testIDesc = function() { require("idesc_test.js").run() }

   exports.testJSONDescriptions = function() {
      var params = {}, describe = eval(io.readFileString("../include/streamFns.js") + "\n_describeJSONPaths")
      var file = io.createTempFile("oafp-jsondesc", ".json"), scan = io.scanJSON, reader = io.readStreamJSON
      var expected = prefix => {
         var paths = new Set()
         reader(file, path => { var p = path.substring(2); if (isUnDef(prefix) || p.startsWith(prefix)) paths.add(p); return false })
         return Array.from(paths)
      }
      try {
         ;['{}','[]','null','42','"café €"',
           '{"rows":[{"x":1},{"x":null},[],{}],"nested":{"empty":{}},"end":true}',
           '[1,{},[],{"a.b":[false,"x"]}]',
           '{"":{},"a.b":{"a[0]":1},"0":[null],"quote\\\"":2}',
           '{"duplicate":1,"duplicate":{"x":2}}'].forEach(text => {
            io.writeFileString(file,text)
            ;[undefined,"rows","nested", "0", "missing"].forEach(prefix => {
               var paths = expected(prefix)
               ow.test.assert(describe(file,prefix),paths,"Metadata paths preserve legacy order/format")
               io.scanJSON = undefined
               try { ow.test.assert(describe(file,prefix),paths,"Older-runtime fallback") }
               finally { io.scanJSON = scan }
            })
         })
         io.writeFileString(file,"{a: /* lenient */ 1, b: 'text'}")
         ow.test.assert(describe(file),expected(),"Lenient JSON fallback")
         io.writeFileString(file,'{"a":"café €","rows":[1,2]}')
         var paths = expected()
         io.readStreamJSON = () => { throw "Must not decode scalar values" }
         ow.test.assert(describe(file),paths,"Strict JSON uses metadata reader only")
      } finally { io.scanJSON = scan; io.readStreamJSON = reader; io.rm(file) }
   }

   exports.testFormatHelp = function() {
      ow.loadFormat()
      var eq = (a,b,msg) => ow.test.assert(a,b,msg)
      var source = io.readFileString("../oafp.source.js.hbs")
      var code = source.substring(source.indexOf("const _formatHelp ="), source.indexOf("const showVersion ="))
      var params, printed, rendered, paused, root = ".."
      var __initializeCon = () => {}, __ansiColorFlag, __conConsole
      var _oafhelp_libs = {}, _print = text => { printed = text }
      var _exit = () => {}, getOPackPath = () => root
      var help = eval(code + "\n({select:_formatHelp,show:showHelp})")
      var docs = io.readFileString("../docs/USAGE.md")
      var filters = io.readFileString("../docs/FILTERS.md")
      ;["keys","tF","to_kyaml","path"].forEach(name => {
         var row = filters.split("\n").filter(line => line.indexOf("| " + name + "(") == 0)[0]
         eq(help.select(filters,"filter=" + name).split("\n"),[
            "| Function | OpenAF | Description | Example |", "|----------|--------|-------------|---------|", row
         ],"Exact original row for " + name)
      })
      eq(help.select(filters," FILTER= keys "),help.select(filters,"filter=keys"),"Trim selector")
      ;["", "key", "TF", "keys.*"].forEach(name => {
         eq(help.select(filters,"filter=" + name).indexOf("help=filters") >= 0,true,"Missing exact function " + name)
      })
      ;[["in:json","JSON input options"],["out:sql","SQL output options"],
        ["IN:CsV","CSV input/output options"],["out:csv","CSV input/output options"],
        ["in:base64","Base64 input/output options"],["out:base64","Base64 input/output options"],
        ["in:LLM-DECIDE","LLM Decide input options"],["in:mini a","mini-a input options"]].forEach(test => {
         var selected = help.select(docs,test[0])
         eq(selected.indexOf(test[1]) >= 0,true,"Select " + test[0])
         eq(selected.indexOf("|" ) >= 0,true,"Preserve options table")
         eq(selected.indexOf("## ⬆️  Output options"),-1,"Exclude unrelated sections")
      })
      eq(help.select(docs,"out:javathread").indexOf("help=usage") >= 0,true,"Missing direction")
      eq(help.select(docs,"in:unknown").indexOf("help=in:unknown") >= 0,true,"Identify missing selector")
      var fixture = "```inline example```\n### CSV input/output options\nTable\n```sh\n### SQL output options\n```\n#### Nested\nExample\n~~~\n### Fake\n~~~\n### Next\nUnrelated"
      var selected = help.select(fixture,"in:csv")
      eq(selected.indexOf("#### Nested\nExample") >= 0,true,"Preserve nested examples")
      eq(selected.indexOf("### SQL output options") >= 0,true,"Ignore fenced headings")
      eq(selected.indexOf("Unrelated"),-1,"Stop at peer heading")
      var md = ow.format.withMD, pause = ow.format.string.pauseString, embedded = global._oafphelp
      try {
         ow.format.withMD = text => { rendered = text; return "rendered" }
         ow.format.string.pauseString = text => { paused = text }
         params = {help:"in:csv"}; help.show()
         eq(rendered,help.select(docs,params.help),"Renderer receives selected Markdown")
         eq(printed,"rendered","Print rendered output")
         params.out = "raw"; rendered = undefined; help.show()
         eq(rendered,undefined,"Raw bypasses rendering")
         eq(printed,help.select(docs,params.help),"Raw Markdown")
         params.pause = true; help.show()
         eq(paused,printed,"Pause raw output")
         params.out = undefined; help.show(); eq(paused,"rendered","Pause rendered output")
         params = {help:"filter=keys",out:"raw"}; help.show()
         eq(printed,help.select(filters,params.help),"File function help")
         params.pause = true; help.show(); eq(paused,printed,"Page function help")
         params.out = undefined; help.show(); eq(paused,"rendered","Render function help")
         root = "../missing-help-fixture"
         global._oafphelp = {"docs/USAGE.md":docs}
         params = {help:"in:csv",out:"raw"}; help.show()
         eq(printed,help.select(docs,params.help),"Embedded and installed parity")
         global._oafphelp["docs/FILTERS.md"] = filters
         params = {help:"filter=keys",out:"raw"}; help.show()
         eq(printed,help.select(filters,params.help),"Embedded function help")
      } finally {
         ow.format.withMD = md; ow.format.string.pauseString = pause; global._oafphelp = embedded
      }
   }

   exports.testFilterReference = function() {
      loadCompiledLib("jmespath_js")
      var eq = (a,b,msg) => ow.test.assert(a,b,msg), examples = {}
      io.readFileString("../docs/FILTERS.md").split("\n").forEach(line => {
         var name = line.match(/^\| (\w+)\(/)
         if (!name) return
         var cells = line.replace(/\\\|/g,"\u0000").split("|")
         eq(cells.length,6,"Four table cells for " + name[1])
         eq(isDef(examples[name[1]]),false,"Unique function " + name[1])
         var expression = cells[4].trim().replace(/\u0000/g,"|").replace(/\\`/g,"`")
         jmespath.compile(expression)
         examples[name[1]] = expression
      })
      ;[["at",[10,20],10],["add",{},3],["ceil",{},2],["floor",{},1],
        ["div",{},3],["from_json",{},{a:123}],["length",{a:1,b:2},2],
        ["insert",{a:1},{a:1,status:"valid"}],["assign",{a:1},{a:1,status:"valid"}],
        ["assignp",{items:[{id:1}]},{items:[{id:1,status:"valid"}]}],
        ["substring","abcdef","abcde"],["reverse","abc","cba"],
        ["sort",[3,1,2],[1,2,3]],["sub",{},3],["to_numSpace",{},"123,456"],
        ["merge",{},{a:1,b:2}],["ranges",{},[4,6,8]],["split","a\nb",["a","b"]],["split_sep","a,(b,c),d",["a","b,c","d"]]
      ].forEach(test => eq($path(test[1],examples[test[0]]),test[2],"Documented example " + test[0]))
   }

   exports.testJqFilters = function() {
      var processExpr = () => undefined
      var __flags = clone(global.__flags); __flags.OAFP = {libs:[]}
      var output = [], nativeJq = global.$jq, $jq = nativeJq
      var print = value => output.push(String(value))
      var runOafp = eval(io.readFileString("../oafp.source.js") + "\noafp")
      var eq = (a,b,msg) => ow.test.assert(a,b,msg)
      var run = (data, extra) => {
         output = []
         runOafp(merge({in:"json",data:data,out:"json",noexit:true,__inception:true,parallel:false},extra || {}))
         return output.map(text => jsonParse(text))
      }
      var rejects = (extra, diagnostic) => {
         var error
         try { run("{}",extra) } catch(e) { error = e }
         eq(isDef(error),true,"Reject " + diagnostic)
         eq(String(error).indexOf(diagnostic) >= 0,true,"Diagnostic " + diagnostic)
         eq(output,[],"No output on failure")
      }
      eq(run('{"a":2}',{jq:".a",ojq:". * 3"}),[6],"Both stages and jq alias")
      eq(run('{"a":2}',{ijq:".a"}),[2],"Explicit input jq")
      eq(run('[1,2,3]',{jq:"map(select(. > 1))"}),[[2,3]],"Array remains one input")
      ;[null,false,0,"",[],{}].forEach(value => {
         eq(run(stringify(value),{jq:".",ojq:"."}),[value],"Identity preserves " + stringify(value))
         eq(run("{}",{jq:stringify(value)}),[value],"Emitted value " + stringify(value))
      })
      eq(run(stringify('{"a":1}'),{jq:"type"}),["string"],"Parsed JSON string is not reparsed")
      eq(run('hello',{in:"raw",jq:"ascii_upcase",ojq:"length"}),[5],"Raw input and string output stage")
      eq(run('{}',{jq:"1,2"}),[[1,2]],"Multiple results remain collected")
      eq(run('{}',{ojq:"1,2"}),[[1,2]],"Multiple output results remain collected")
      eq(run('{}',{jq:"empty",ojq:"error(\"must not run\")"}),[],"Empty input stage stops pipeline")
      eq(run('{}',{ojq:"empty",outkey:"wrapped"}),[],"Empty output stage suppresses before wrapping")
      eq(run('{"users":[{"x":1},{"x":2}]}',{
         path:"users",ijq:"map(.x)",opath:"[0]",ojq:". + 10"
      }),[11],"Path stages surround jq stages")
      eq(run('[{"x":"2"}]',{ijq:"map({x:.x})",correcttypes:true,ojq:".[0].x | type"}),["number"],"Transforms run between jq stages")
      eq(run('[{"x":3,"extra":true},{"x":2,"extra":true},{"x":1,"extra":true}]',{
         ifrom:"limit(2)",isql:"select x",sqlfilter:"simple",
         ijq:'map(if has("extra") then error("isql must run first") else . end)',
         from:"sort(x)",sql:"select x where x > 2",opath:"[].x",ojq:"map(. + 10)"
      }),[[13]],"nLinq and SQL surround jq in pipeline order")
      var records = '{"x":1}\n{"x":2}\n'
      eq(run('null\nfalse\n0\n""\n[]\n{}\n',{in:"ndjson",jq:"."}),[null,false,0,"",[],{}],"NDJSON scalar records")
      eq(run(records,{in:"ndjson",jq:".x, .x + 10"}),[[1,11],[2,12]],"NDJSON direct records preserve multiple results")
      eq(run(records,{in:"ndjson",ijq:"select(.x > 1)",ojq:".x"}),[2],"Record suppression and options reused")
      eq(run(records,{in:"ndjson",ndjsonjoin:true,jq:"map(.x)"}),[[1,2]],"Joined NDJSON array")
      eq(run('[null,false,0,"",[],{}]',{stream:true,jq:"."}),[null,false,0,"",[],{}],"Stream preserves JSON values")
      eq(run('[1,2]',{stream:true,jq:"., . + 10"}),[[1,11],[2,12]],"Stream retains collected results")
      eq(run(records,{in:"ndjson",path:"[].x"}),[1,2],"Legacy record wrapper without jq")
      rejects({jq:".",ijq:"."},"either jq or ijq")
      ;["", "   ", true, 1, {}].forEach(value => rejects({jq:value},"nonempty jq expression"))
      rejects({ojq:" "},"nonempty jq expression")
      rejects({jq:"["},"JqCompileError")
      rejects({ojq:'error("fixture")'},"fixture")
      ;["jq","ijq","ojq"].forEach(name => {
         var spec = {out:"idesc",idescsource:"stream"}; spec[name] = "."
         rejects(spec,name)
      })
      $jq = undefined
      try { rejects({jq:"."},"runtime providing $jq"); eq(run('{}'),[{}],"Legacy invocation needs no jq runtime") }
      finally { $jq = nativeJq }
   }

   exports.testGzipInputs = function() {
      var processExpr = () => undefined
      var __flags = clone(global.__flags); __flags.OAFP = {libs:[]}
      var output = []
      var print = value => output.push(String(value))
      var runOafp = eval(io.readFileString("../oafp.source.js") + "\noafp")
      var run = params => {
         output = []
         runOafp(merge({out:"json",noexit:true,__inception:true,parallel:false},params))
         return output.map(text => jsonParse(text))
      }
      var files = []
      var fixture = (suffix, text, plain, encoding) => {
         var file = io.createTempFile("oafp-gzip", suffix)
         files.push(file)
         var bytes = af.fromString2Bytes(text, encoding || "UTF-8")
         io.writeFileBytes(file, plain ? bytes : io.gzip(bytes))
         return file
      }
      var eq = (a,b,msg) => ow.test.assert(a,b,msg)
      try {
         var json = fixture(".json.gz", '{"name":"café €","nested":{"n":2}}')
         eq(run({file:json}), [{name:"café €",nested:{n:2}}], "Gzip JSON extension and UTF-8")
         var rows = [{x:1},{x:2}]
         var array = fixture(".json.gz", '[{"x":1},{"x":2}]')
         eq(run({file:array,stream:true}), rows, "Gzip JSON array streams")
         var ndjson = fixture(".ndjson.gz", '{"x":1}\n{"x":2}\n')
         eq(run({file:ndjson}), rows, "Gzip NDJSON extension selects record reader")
         eq(run({file:ndjson,ndjsonjoin:true}), [rows], "Gzip joined NDJSON")
         eq(run({file:fixture(".yaml.GZ", "name: gzip\nn: 2\n")}), [{name:"gzip",n:2}], "Gzip YAML and uppercase suffix")
         eq(run({file:fixture(".csv.gz", "a,b\n1,2\n"),correcttypes:true}), [[{a:1,b:2}]], "Gzip CSV")
         eq(run({file:fixture(".dat", '{"x":3}'),ingzip:true,in:"json"}), [{x:3}], "Explicit gzip flag")
         eq(run({file:fixture(".gz", '{"x":4}')}), [{x:4}], "Decompressed content detection")
         var plain = fixture(".gz", '{"x":5}', true)
         eq(run({file:plain,ingzip:false,in:"json"}), [{x:5}], "Explicit gzip opt-out")
         eq(run({file:fixture(".txt.gz", "one\r\ntwo"),in:"lines"}), ["one","two"], "Explicit lines input")
         eq(run({file:fixture(".ini.gz", "[section]\nname=gzip\n")}), [{section:{name:"gzip"}}], "Gzip INI")
         var truncated = fixture(".json.gz", '{"x":1}')
         var bytes = af.fromBytes2Array(io.readFileBytes(truncated))
         io.writeFileBytes(truncated,af.fromArray2Bytes(bytes.slice(0,bytes.length - 6)))
         var truncatedFailed = false
         try { run({file:truncated}) } catch(e) { truncatedFailed = true }
         eq(truncatedFailed,true,"Truncated gzip must fail")
         var uncompressed = fixture(".json", io.readFileString(plain), true)
         eq(run({file:uncompressed}), [{x:5}], "Plain files retain behavior")
         ;[{jsonprefix:"nested"},{jsondesc:true}].forEach(options => {
            var original = fixture(".json", '{"name":"café €","nested":{"n":2}}', true)
            eq(run(merge({file:json},options)),run(merge({file:original},options)),"Gzip path-only JSON reader")
         })
         var failed = false
         try { run({file:plain,in:"json"}) } catch(e) { failed = true }
         eq(failed,true,"Invalid gzip must fail")
         eq(run({file:json}), [{name:"café €",nested:{n:2}}], "Gzip state resets after failure")
         eq(run({file:json,in:"rawhex"}),run({file:fixture(".json", '{"name":"café €","nested":{"n":2}}',true),in:"rawhex"}),"Gzip raw bytes")
         // Verify stream ownership for successful and failing consumers.
         var params = {file:json}, held
         var helpers = eval(io.readFileString("../include/streamFns.js") + "\n({withStream:_withFileStream,readText:_readFileText,withPath:_withInputFilePath})")
         ;[false,true].forEach(fail => {
            try { helpers.withStream(stream => { held = stream; if (fail) throw "consumer failed" }) } catch(e) {}
            var closed = false
            try { held.read() } catch(e) { closed = true }
            eq(closed,true,"Gzip stream closes after consumer completion or failure")
         })
         var _cs = "UTF-16"
         params.file = fixture(".json.gz", '{"name":"café €"}',false,"UTF-16")
         eq(jsonParse(helpers.readText()),{name:"café €"},"Gzip respects configured encoding")
         params.file = json
         var temporary
         try { helpers.withPath(file => { temporary = file; throw "consumer failed" }) } catch(e) {}
         eq(isString(temporary) && !io.fileExists(temporary),true,"Temporary gzip file removed on failure")
         // Check binary-reader handoffs without requiring optional XLS/JFR fixtures.
         var _showTmpMsg = () => {}, _$o = value => { output = value }
         var _exit = (code, message) => { throw message }
         var plugin = () => {}, includeOPack = () => {}, xlsClosed = false
         var XLS = function(bytes) {
            eq(af.fromBytes2String(bytes),"binary fixture","XLS receives decompressed bytes")
            this.getSheetNames = () => ["Sheet1"]
            this.close = () => { xlsClosed = true }
         }
         eval(io.readFileString("../include/inputFns.js"))
         params = {file:fixture(".xlsx.gz","binary fixture"),inxlsdesc:"true"}
         _inputFns.get("xls")("",{})
         eq(output,["Sheet1"],"Gzip XLS handoff")
         eq(xlsClosed,true,"XLS reader closed")
         ow.loadJava()
         var parseJFR = ow.java.parseJFR, jfrPath
         try {
            ow.java.parseJFR = (file, callback) => {
               jfrPath = file
               eq(io.readFileString(file),"binary fixture","JFR receives decompressed file")
               if (isFunction(callback)) callback({event:"test"})
               else return [{event:"test"}]
            }
            ;[false,true].forEach(join => {
               params = {file:fixture(".jfr.gz","binary fixture"),jfrjoin:join}
               _inputFns.get("jfr")("",{})
               eq(output,join ? [{event:"test"}] : {event:"test"},"Gzip JFR handoff")
               eq(io.fileExists(jfrPath),false,"JFR temporary file removed")
            })
         } finally { ow.java.parseJFR = parseJFR }
         ;["../oafp.source.js","../oafp.js"].forEach(script => {
            var result = $sh([getOpenAFPath()+"/oaf","-f",script,"-e",ndjson + " out=json parallel=false"]).get(0)
            eq(result.exitcode,0,"Gzip CLI exit status: " + script)
            eq(result.stdout.trim().split(/\r?\n/).map(text => jsonParse(text)),rows,"Positional gzip CLI: " + script)
         })
      } finally { files.forEach(file => io.rm(file)) }
   }

   exports.testDevScope = function() {
      var processExpr = () => undefined
      // OpenAF uses an empty string while its console is being initialized.
      var __con = "", consoleInitializations = 0
      var __initializeCon = () => { consoleInitializations++ }
      var __flags = clone(global.__flags); __flags.OAFP = {libs:[]}
      var output = []
      var print = value => output.push(String(value))
      var template = io.readFileString("../oafp.source.js.hbs")
      ;["Util", "Stream", "Idesc", "InputLine", "Transform", "Output", "Input"].forEach(name => {
         var file = name.charAt(0).toLowerCase() + name.substring(1) + "Fns"
         template = template.replace("{{{src" + name + "Fns}}}", 'eval(io.readFileString("../include/' + file + '.js"))')
      })
      ;["FileExtensions", "FileExtensionsNoMem"].forEach(name => {
         var file = name.charAt(0).toLowerCase() + name.substring(1)
         template = template.replace("{{{src" + name + "}}}", 'io.readFileJSON("../include/' + file + '.json")')
      })
      var run = eval(template + "\noafp")
      var invoke = params => {
         output = []
         run(merge({out:"json",noexit:true,__inception:true,parallel:false},params))
         return output.map(value => jsonParse(value))
      }
      ow.test.assert(invoke({in:"json",stream:true,data:'[null,{"z":1,"a":2}]',sortmapkeys:true}),
         [null,{a:2,z:1}],"Dev streaming helpers capture invocation scope")
      ow.test.assert(invoke({in:"ndjson",data:'{"z":3}\n{"z":4}'}),
         [{z:3},{z:4}],"Dev helpers refresh state for each invocation")
      ow.test.assert(invoke({in:"json",data:'{"z":5}'}),[{z:5}],"Dev aggregate input captures invocation scope")
      ow.test.assert(invoke({in:"json",data:'[1,2,3]',pipe:{in:"json",path:"{total:sum(@),count:length(@)}",out:"json"}}),
         [{total:6,count:3}],"Nested pipe tolerates console initialization in progress")
      ow.test.assert(consoleInitializations,0,"Noninteractive invocations do not initialize the console")
   }

   exports.testStreamingPerformance = function() {
      var processExpr = () => undefined
      var __flags = clone(global.__flags); __flags.OAFP = {libs:[]}
      var output = [], diagnostics = []
      var print = value => output.push(String(value))
      var printErr = value => diagnostics.push(String(value))
      var printErrnl = value => diagnostics.push(String(value))
      var runOafp = eval(io.readFileString("../oafp.source.js") + "\noafp")
      var run = params => {
         output = [], diagnostics = []
         runOafp(merge({out:"json",noexit:true,__inception:true,parallel:false},params))
         return output.map(text => jsonParse(text))
      }
      var eq = (a,b,msg) => ow.test.assert(a,b,msg)
      var rejects = params => {
         var error
         try { run(params) } catch(e) { error = e }
         eq(isDef(error),true,"Invalid streaming input must throw: " + params.in)
      }
      eq(run({in:"json",stream:true,data:'[null,true,false,1.25,"€",[],{},[{"x":2}]]'}),
         [null,true,false,1.25,"€",[],{},[{x:2}]],"JSON array values")
      eq(run({in:"json",stream:true,data:'[]'}),[],"Empty JSON stream")
      eq(run({in:"json",stream:true,data:'[{"x":1},{"x":2}]',path:"[].x"}),[1,2],"Per-record filters")
      ;['{}','[1,]','[','[1]false','[NaN]'].forEach(data => rejects({in:"json",stream:true,data:data}))
      rejects({in:"json",stream:true,data:'[]',jsonprefix:"x"})
      rejects({in:"json",stream:true,data:'[]',parallel:"invalid"})
      eq(run({in:"ndjson",data:'{\n"x":1, "text":"}\\\"{"\n}\n{"x":2}\n'}),
         [{x:1,text:'}\"{'},{x:2}],"Multiline JSON and quoted braces")
      eq(run({in:"ndjson",data:'1\n[1,2]\ntrue\n"text"\n'}),[1,[1,2],true,"text"],"Scalar NDJSON")
      rejects({in:"ndjson",data:'{"unfinished":'});
      eq(run({in:"ndjson",data:'{"x":3}'}),[{x:3}],"Framing state does not leak after errors")
      eq(run({in:"ndslon",data:'(x:1)\n(x:2)'}),[{x:1},{x:2}],"NDSLON records")
      eq(run({in:"lines",data:'hello\r\nworld'}),["hello","world"],"Lines source normalization")
      eq(run({in:"ndjson",ndjsonjoin:true,data:'{"x":1}\n{"x":2}'}),[[{x:1},{x:2}]],"Joined records retain aggregate semantics")
      var rows = Array.from({length:1200},(v,i) => ({z:i,a:{z:i,a:i}}))
      var ndjson = rows.map(r => stringify(r,__,"")).join("\n")
      ;["false","auto","true"].forEach(parallel => {
         eq(run({in:"ndjson",data:ndjson,parallel:parallel}),rows,"Ordered bounded records: " + parallel)
         eq(run({in:"json",stream:true,data:stringify(rows),parallel:parallel}),rows,"Ordered JSON stream: " + parallel)
      })
      var sorted = rows.map(r => ({a:{a:r.z,z:r.z},z:r.z}))
      eq(run({in:"json",data:stringify(rows),sortmapkeys:true,parallel:true}),[sorted],"Parallel pure key sorting")
      var params = {parallel:true}
      var makeProcessor = eval(io.readFileString("../include/streamFns.js") + "\n_recordProcessor")
      var processor = makeProcessor(value => { if (value == 513) throw "worker-failure"; return value }, () => {}, true)
      var failed = false
      try { for (var i = 0; i < 1500; i++) processor.add(i); processor.done() } catch(e) {
         failed = String(e).indexOf("worker-failure") >= 0
         try { processor.abort() } catch(ignore) {}
      }
      eq(failed,true,"Worker errors propagate after settling pending work")
      params.parallel = "auto"
      var live = $atomic(), peak = $atomic(), lock = new java.util.concurrent.locks.ReentrantLock()
      var ordered = [], caller = java.lang.Thread.currentThread().getId()
      processor = makeProcessor(value => {
         var count = live.inc()
         lock.lock()
         try { peak.set(Math.max(peak.get(),count)) } finally { lock.unlock() }
         try { sleep(1, true); return value } finally { live.dec() }
      }, value => {
         eq(java.lang.Thread.currentThread().getId(),caller,"Output stays on caller thread")
         ordered.push(value)
      }, true)
      for (var i = 0; i < 1200; i++) processor.add(i)
      processor.done()
      eq(ordered,Array.from({length:1200},(v,i) => i),"Adaptive workers preserve ordering")
      eq(live.get(),0,"All workers settled")
      eq(peak.get() <= Math.min(4,getNumberOfCores()),true,"Concurrency cap")
      if (getNumberOfCores() > 1) eq(peak.get() > 1,true,"Expensive pure work activates automatic workers")

      eq(diagnostics,[],"Nested processing emits no wait output")
      var outputFile = io.createTempFile("oafp-output-owner", ".txt")
      var previousStreams = global.__oafp_streams, borrowed = io.writeFileStream(outputFile, true)
      try {
         global.__oafp_streams = {}
         global.__oafp_streams[outputFile] = {s:borrowed}
         run({in:"json",data:'{"x":1}',outfile:outputFile,outfileappend:true})
         ioStreamWrite(borrowed,"parent\n")
         eq(io.readFileString(outputFile),'{"x":1}\nparent\n',"Nested output keeps borrowed streams open")
      } finally {
         borrowed.close()
         global.__oafp_streams = previousStreams
         io.rm(outputFile)
      }
      var file = io.createTempFile("oafp-stream", ".ndjson")
      try {
         io.writeFileString(file, ndjson)
         eq(run({file:file,parallel:true}),rows,"Extension detection selects streaming reader")
         var counter = io.createTempFile("oafp-command", ".txt")
         try {
            var command = "printf x >> '" + counter + "'; cat '" + file + "'; printf 'diagnostic\\n' >&2"
            eq(run({in:"ndjson",cmd:command,parallel:true}),rows,"Command stdout streams once")
            eq(io.readFileString(counter),"x","Command executes once")
            eq(diagnostics,["diagnostic"],"Command stderr is drained separately")
         } finally { io.rm(counter) }
         io.writeFileString(file, "a,b\n1,2\n3,4")
         eq(run({in:"csv",file:file,correcttypes:true}),[[{a:1,b:2},{a:3,b:4}]],"CSV aggregate")
         ;["../oafp.source.js","../oafp.js"].forEach(script => {
            var result = $sh([getOpenAFPath()+"/oaf","-f",script,"-e","in=ndjson out=json parallel=false"],'{"x":1}\n{"x":2}').get(0)
            eq(result.stdout.trim().split(/\r?\n/).map(text => jsonParse(text)),[{x:1},{x:2}],"Real stdin: " + script)
            eq(result.stderr,"","Redirected stderr has no progress escapes")
         })
      } finally { io.rm(file) }
   }

   exports.testSkillRecipes = function() {
      var run = function(asset, extra) {
         // Use the documented working directory and the checkout's generated CLI.
         var result = $sh().pwd("../..").sh([getOpenAFPath() + "/oaf", "-f", "src/oafp.source.js", "-e",
            "-f skills/" + asset + (extra ? " " + extra : "")]).get(0)
         ow.test.assert(result.exitcode, 0, "Skill recipe failed: " + asset + " " + result.stderr)
         return result.stdout
      }
      var cases = [
         ["oafp-author/assets/filter-report.yaml", [{name:"beta",score:20},{name:"alpha",score:10}]],
         ["oafp-author/assets/pipe-summary.yaml", {total:6,count:3}],
         ["oafp-author/assets/ndjson-joined.yaml", {total:12,names:["alpha","beta"]}],
         ["oafp-decide/assets/filter-result.yaml", "billing"],
         ["oafp-decide/assets/filter-stats.yaml", "billing"],
         ["oafp-json-schema/assets/validate.yaml", {valid:true,errors:null}],
         ["openaf-path/assets/edge-cases.yaml", {
            projected:[],retained:[null,null],rows:[
               {name:"alpha",region:"eu",enabled:false,count:0},
               {name:"beta",region:"eu",enabled:null,count:null}
            ],sorted:["beta","alpha"],emptyCount:0,emptySum:0
         }]
      ]
      cases.forEach(c => ow.test.assert(jsonParse(run(c[0])), c[1], "Skill recipe output: " + c[0]))
      var records = run("oafp-author/assets/ndjson-records.yaml").trim().split(/\r?\n/).map(line => jsonParse(line))
      ow.test.assert(records, [{name:"alpha",double:4},{name:"beta",double:20}], "Per-record NDJSON recipe")
      var invalid = jsonParse(run("oafp-json-schema/assets/invalid.yaml"))
      ow.test.assert(invalid.valid, false, "Invalid recipe must report false despite successful exit")
      ow.test.assert(invalid.errors.some(e => e.keyword == "type" && (e.instancePath == "/age" || e.dataPath == ".age")), true, "Invalid recipe must identify age")
      ow.test.assert(jsonParse(run("openaf-path/assets/edge-cases.yaml", 'data="{items:[],empty:[]}"')), {
         projected:[],retained:[],rows:[],sorted:[],emptyCount:0,emptySum:0
      }, "Empty collection and CLI override")
      ow.test.assert(jsonParse(run("openaf-path/assets/edge-cases.yaml", 'path=items opath="[].{name:name,region:opath(\'region\')}"')), [
         {name:"alpha",region:null},{name:"beta",region:null}
      ], "Later output stage cannot recover discarded root context")
   }

   exports.testLLMDecide = function() {
      var eq = (a, b, msg) => ow.test.assert(a, b, msg)
      var env = {}, calls = [], configs = [], secretCalls = [], failure, clientMode = "normal"
      var getEnv = name => env[name]
      var __flags = clone(global.__flags); __flags.OAFP = {libs:[]}
      var processExpr = () => undefined
      var printed, helpRoot = ".."
      var print = msg => { printed = String(msg) }
      var getOPackPath = name => name == "oafproc" ? helpRoot : undefined
      var $sec = function(repo, bucket) {
         return {get: key => {
            secretCalls.push([repo, bucket, key])
            return repo == "system" ? af.fromJSSLON(env[key]) : {key:"fixture-secret"}
         }}
      }
      var response = {contractVersion:1,provider:"fixture",model:"fixture-model",strategy:"native",answers:{
         route:{type:"choice",value:"billing",probabilities:{billing:0.8,technical:0.2},selectedProbability:0.8,providerConfidence:0.6,probabilitySource:"provider"},
         urgent:{type:"boolean",value:true,probabilityTrue:0.9},
         priority:{type:"score",level:2,expectedScore:1.8}
      }}
      var $llm = config => {
         configs.push(config)
         var execute = (method, state, questions, options) => {
            calls.push({method:method,state:state,questions:questions,options:options})
            if (failure) throw failure
            if (clientMode == "ordered") {
               sleep(state == "first" ? 20 : 1, true)
               return {answers:{route:{value:state}}}
            }
            return method == "decide" ? response : {response:response,stats:{prompt:0,total:12}}
         }
         if (clientMode == "missing") return {}
         return {
            decide: (s,q,o) => execute("decide",s,q,o),
            decideWithStats: (s,q,o) => execute("decideWithStats",s,q,o),
            promptJSON: s => { calls.push({method:"promptJSON",state:s}); return '{"legacy":true}' },
            prompt: s => { calls.push({method:"prompt",state:s}); return "legacy" },
            getModels: () => ["fixture-model"]
         }
      }
      // Run the generated entrypoint with real parsing, configuration, filters and output.
      var loadEntrypoint = path => eval(io.readFileString(path) + "\noafp")
      var runOafp = loadEntrypoint("../oafp.source.js")
      var originalPipeLn = io.pipeLn
      var key = genUUID(), file = io.createTempFile("oafp-decide", ".yaml")
      var request = {state:{ticket:"Charged twice"},questions:{
         route:{type:"choice",instructions:"Route",criteria:{billing:"Payments",technical:"Errors"}},
         urgent:{type:"boolean",instructions:"Urgent?"},
         priority:{type:"score",instructions:"Priority",criteria:["Routine","Soon","Urgent"]}
      },options:{strategy:"auto",model:"override",requireProbabilities:true,providerOptions:{keepAlive:0}}}
      var run = (data, extra) => {
         runOafp(merge({in:"llmdecide",data:data,out:"key",__key:key,noexit:true,__inception:true,llmoptions:{type:"fixture"}},extra || {}))
         return $get(key)
      }
      var rejects = (data, extra, text) => {
         var before = calls.length, thrown
         try { run(data, extra) } catch(e) { thrown = e }
         eq(isDef(thrown),true,"reject " + text)
         if (text) eq(String(thrown).indexOf(text) >= 0,true,"diagnostic " + text)
         eq(calls.length,before,"invalid request never executes")
      }
      var transformCases = () => {
         var spec = {questions:request.questions,options:request.options,statePath:"ticket",
            assign:{classification:"answers.route.value",urgent:"answers.urgent.value"}}
         var rows = [{id:1,ticket:"Charged twice"},{id:2,ticket:"Another charge"}]
         var expected = rows.map(r => merge(r,{classification:"billing",urgent:true}))
         var batch = (data, config, extra) => run(stringify(data),merge({in:"json",llmdecide:isDef(config) ? config : spec},extra || {}))
         var bad = (data, config, extra, diagnostic, inference) => {
            var before = calls.length, error
            try {batch(data,config,extra)} catch(e) {error=e}
            eq(isDef(error),true,"transform rejects " + diagnostic)
            eq(String(error).indexOf(diagnostic) >= 0,true,"transform diagnostic " + diagnostic)
            if (!inference) eq(calls.length,before,"transform preflight avoids inference")
            return error
         }
         var before = calls.length
         eq(batch(rows),expected,"transform enriches entries")
         eq(calls.length-before,2,"transform one call per entry")
         eq(calls[before],{method:"decide",state:rows[0].ticket,questions:spec.questions,options:spec.options},"transform forwarded arguments")
         eq(rows,[{id:1,ticket:"Charged twice"},{id:2,ticket:"Another charge"}],"source entries unchanged")
         eq(batch(rows,stringify(spec)),expected,"inline JSON config")
         eq(batch(rows,af.toSLON(spec)),expected,"inline SLON config")
         ;[stringify(spec),af.toSLON(spec),af.toYAML(spec)].forEach(content => {
            io.writeFileString(file,content)
            eq(batch(rows,file),expected,"config file parsing")
         })
         eq(batch(rows,spec,{parallel:true}),expected,"parallel results retain association")
         var savedParallelFlags = clone(global.__flags.PFOREACH)
         try {
            global.__flags.PFOREACH.min_par_size = 0
            global.__flags.PFOREACH.forceSeq = false
            global.__flags.PFOREACH.seq_ratio = 1000
            clientMode = "ordered"
            var ordered = ["first","second","third","fourth"]
            eq(batch(ordered,{questions:spec.questions},{parallel:true}),
               ordered.map(v => ({answers:{route:{value:v}}})),"parallel distinct results remain in order")
         } finally { global.__flags.PFOREACH = savedParallelFlags; clientMode = "normal" }
         env.OAFP_PARALLEL = "true"
         eq(batch(rows),expected,"parallel environment")
         delete env.OAFP_PARALLEL
         eq(batch(rows[0]),expected[0],"single map enrichment")
         before = calls.length
         eq(batch([]),[],"empty array")
         eq(calls.length,before,"empty array no inference")
         eq(batch(rows,{questions:spec.questions}),[response,response],"whole-entry replacement")
         eq(calls[calls.length-1].state,rows[1],"whole-entry state")
         eq(batch(["text"],{questions:spec.questions}),[response],"string entry replacement")
         eq(batch(rows,merge(clone(spec),{assign:{classification:"response.answers.route.value",urgent:"response.answers.urgent.value"}}),{llmdecidestats:true}),
            expected,"stats extraction")
         eq(batch(rows,spec,{opath:"[].classification"}),["billing","billing"],"post-transform projection")
         eq(batch(rows,spec,{path:"[0]"}),expected[0],"pre-transform projection")
         eq(batch(rows,spec,{outkey:"rows"}),{rows:expected},"final output wrapper")
         eq(batch([{ticket:"text",classification:"old"}],merge(clone(spec),{overwrite:true})),
            [{ticket:"text",classification:"billing",urgent:true}],"explicit overwrite")
         eq(batch(rows,merge(clone(spec),{assign:{"class.name":"answers.route.value"}}))[0]["class.name"],"billing","literal field name")
         bad(rows,"missing-decision-config.yaml",{},"llmdecide requires")
         io.writeFileString(file,"{}")
         bad(rows,file,{},"llmdecide requires")
         bad(rows,merge(clone(spec),{statePath:"missing"}),{},"state must be")
         bad(["text"],spec,{},"must be a map")
         bad([{ticket:"text",classification:"old"}],spec,{},"already has")
         bad(rows,merge(clone(spec),{assign:{classification:42}}),{},"assign requires")
         bad(rows,merge(clone(spec),{unknown:true}),{},"llmdecide requires")
         bad(rows,spec,{llmconversation:"conversation.json"},"does not support")
         clientMode = "missing"
         bad(rows,spec,{},"updated OpenAF")
         clientMode = "normal"
         failure = new Error("fixture transform failure"); failure.code = "FIXTURE"
         eq(bad(rows,spec,{},"entry 0",true).code,"FIXTURE","provider error code")
         bad(rows,spec,{parallel:true},"entry ",true)
         failure = undefined
         bad(rows,merge(clone(spec),{assign:{classification:"unknown()"}}),{},"entry 0",true)
      }
      try {
         transformCases()
         var skillRequest = io.readFileString("../../skills/oafp-decide/assets/request.yaml")
         var skillMap = af.fromYAML(skillRequest)
         run(skillRequest)
         eq(calls[calls.length-1], {method:"decide",state:skillMap.state,questions:skillMap.questions,options:skillMap.options}, "Skill request forwards through the real parser")
         ;[stringify(request),af.toSLON(request).replace("[Routine | Soon | Urgent]", '["Routine"|"Soon"|"Urgent"]'),af.toYAML(request)].forEach(data => {
            var before = calls.length
            eq(run(data),response,"normalized envelope")
            eq(calls.length,before+1,"one execution")
            eq(calls[calls.length-1],{method:"decide",state:request.state,questions:request.questions,options:request.options},"forward all questions and options")
         })
         ;["whole text",[{id:1},{id:2}]].forEach(state => {
            var r = clone(request); r.state = state; delete r.options
            run(stringify(r))
            eq(calls[calls.length-1].state,state,"whole state")
            eq(isUnDef(calls[calls.length-1].options),true,"preserve OpenAF defaults")
         })
         var imageRequest = clone(request)
         imageRequest.options.images = ["aW1hZ2Ux", "aW1hZ2Uy"]
         ;[stringify(imageRequest), af.toYAML(imageRequest), af.toSLON(imageRequest).replace("[aW1hZ2Ux | aW1hZ2Uy]", '["aW1hZ2Ux"|"aW1hZ2Uy"]').replace("[Routine | Soon | Urgent]", '["Routine"|"Soon"|"Urgent"]')].forEach(data => {
            var before = calls.length
            run(data)
            eq(calls.length,before+1,"one image decision execution")
            eq(calls[calls.length-1].options,imageRequest.options,"preserve ordered base64 images and options")
         })
         run(stringify(imageRequest),{llmdecidestats:true})
         eq(calls[calls.length-1].method,"decideWithStats","image stats method")
         eq(calls[calls.length-1].options.images,imageRequest.options.images,"stats images")
         io.writeFileString(file,"image fixture")
         var encoded = af.fromBytes2String(af.toBase64Bytes(io.readFileBytes(file)))
         run(stringify(request),{llmimage:file})
         eq(calls[calls.length-1].options,merge(request.options,{images:[encoded]}),"local image encoding preserves options")
         var defaultImageRequest = clone(request); delete defaultImageRequest.options
         run(stringify(defaultImageRequest),{llmimage:file,llmdecidestats:true})
         eq(calls[calls.length-1].options,{images:[encoded]},"local image with default options and stats")
         rejects(stringify(imageRequest),{llmimage:file},"cannot combine")
         ;["missing-image.png","https://example.com/image.png",true,".."].forEach(image => {
            rejects(stringify(request),{llmimage:image},"local image file")
         })
         var statsBefore = calls.length
         eq(run(stringify(request),{llmdecidestats:"true"}),{response:response,stats:{prompt:0,total:12}},"stats wrapper")
         eq(calls.length,statsBefore+1,"exactly one stats execution")
         eq(calls[calls.length-1].method,"decideWithStats","stats method")
         eq(run(stringify(request),{llmdecidestats:"false",path:"answers.route.value"}),"billing","normal output filtering")
         eq(run(stringify(request),{llmdecidestats:true,path:"response.answers.priority.level"}),2,"stats filtering")
         io.writeFileString(file,af.toYAML(request))
         run(undefined,{file:file})
         eq(calls[calls.length-1].state,request.state,"file input")
         io.pipeLn = fn => { af.toYAML(request).split("\n").forEach(line => fn(line)) }
         run(undefined)
         eq(calls[calls.length-1].state,request.state,"stdin input")
         io.pipeLn = () => { throw new Error("sample must not read stdin") }
         run(undefined,{llmdecidesample:"gemini",llmoptions:undefined,file:"missing-sample-input"})
         io.pipeLn = originalPipeLn
         env.OAF_MODEL = '(type: fixture, model: fallback)'
         run(stringify(request),{llmoptions:undefined})
         eq(configs[configs.length-1].model,"fallback","OAF_MODEL fallback")
         env.OAF_DECIDE_MODEL = '(type: fixture, model: decision)'
         run(stringify(request),{llmoptions:undefined})
         eq(configs[configs.length-1].model,"decision","OAF_DECIDE_MODEL overrides OAF_MODEL")
         run(stringify(request),{llmoptions:undefined,llmenv:"OAF_MODEL"})
         eq(configs[configs.length-1].model,"fallback","explicit OAF_MODEL environment")
         run("hello",{in:"llm",llmoptions:undefined})
         eq(configs[configs.length-1].model,"fallback","ordinary LLM keeps OAF_MODEL fallback")
         env.OAFP_MODEL = '(type: fixture, model: preferred)'
         run(stringify(request),{llmoptions:undefined})
         eq(configs[configs.length-1].model,"preferred","OAFP_MODEL priority")
         env.CUSTOM_MODEL = '(type: fixture, model: custom)'
         run(stringify(request),{llmoptions:undefined,llmenv:"CUSTOM_MODEL"})
         eq(configs[configs.length-1].model,"custom","custom environment")
         run(stringify(request),{llmoptions:'(type: fixture, model: explicit)'})
         eq(configs[configs.length-1].model,"explicit","explicit string configuration")
         run(stringify(request),{llmoptions:{type:"fixture",secKey:"test",secRepo:"repo",secBucket:"bucket"}})
         eq(configs[configs.length-1],{type:"fixture",key:"fixture-secret"},"secret resolution")
         eq(secretCalls[secretCalls.length-1],["repo","bucket","test"],"secret selector")
         env = {}
         ;["gemini", "ollama", "openai"].forEach(provider => {
            var before = calls.length, configBefore = configs.length
            var sample = run(undefined,{llmdecidesample:provider,llmoptions:undefined})
            eq(sample.options.strategy,provider == "gemini" ? "structured" : "native","sample strategy")
            if (provider == "openai") eq(sample.options,{strategy:"native",requireProbabilities:true},"OpenAI native sample options")
            eq(calls.length,before,"sample makes no inference")
            eq(configs.length,configBefore,"sample needs no configuration")
            run(af.toYAML(sample))
            eq(calls[calls.length-1].questions,sample.questions,"sample can be submitted")
         })
         rejects(undefined,{llmdecidesample:"invalid"},"gemini, ollama or openai")
         rejects(stringify(request),{llmoptions:undefined},"llmoptions not defined")
         ;["invalid","[]","{}",'{"state":2,"questions":{}}','{"state":{},"questions":[]}',
           '{"state":{},"questions":{},"options":[]}', '{"state":{},"questions":{},"extra":true}'].forEach(data => rejects(data,{},"requires"))
         ;["llmconversation","llmcontext","llmprompt"].forEach(name => {
            var extra = {}; extra[name] = "forbidden"
            rejects(stringify(request),extra,name)
         })
         clientMode = "missing"
         rejects(stringify(request),{},"updated OpenAF")
         rejects(stringify(request),{llmdecidestats:true},"decideWithStats")
         clientMode = "normal"
         failure = new Error("fixture OpenAF failure"); failure.code = "LLM_DECISION_INVALID_REQUEST"
         var before = calls.length, caught
         try { run(stringify(request)) } catch(e) { caught = e }
         eq(caught === failure,true,"preserve OpenAF error identity and code")
         eq(calls.length,before+1,"no retry on failure")
         failure = undefined
         eq(run("hello",{in:"llm"}),{legacy:true},"existing JSON LLM input")
         eq(run("",{in:"llmmodels"}),["fixture-model"],"existing model listing")
         var docs = io.readFileString("../docs/EXAMPLES.md")
         var decisionDocs = docs.substring(docs.indexOf("## Stateless LLM decisions"))
         var fixtures = decisionDocs.match(/```yaml\n[\s\S]*?```/g)
         var exampleConfigs = decisionDocs.match(/export OAFP_MODEL="[^"]+"/g).map(line => line.replace(/^export OAFP_MODEL="/, "").replace(/"$/, ""))
         ;[fixtures[0],fixtures[2]].forEach((block,i) => {
            var r = af.fromYAML(block.replace(/^```yaml\n/,"").replace(/```$/, ""))
            run(af.toYAML(r),{llmoptions:exampleConfigs[i]})
            eq(configs[configs.length-1],af.fromJSSLON(exampleConfigs[i]),"documented provider configuration")
            eq(calls[calls.length-1].state,r.state,"documented state fixture")
            eq(calls[calls.length-1].questions,r.questions,"documented question fixture")
            eq(calls[calls.length-1].options,r.options,"documented provider options")
            eq(r.options.strategy,i == 0 ? "structured" : "native","documented strategy")
         })
         // Verify the compiled artifact and both help entrypoints against local docs.
         runOafp = loadEntrypoint("../oafp.js")
         transformCases()
         eq(run(undefined,{llmdecidesample:"ollama",llmoptions:undefined}).options.strategy,"native","compiled sample")
         eq(run(undefined,{llmdecidesample:"openai",llmoptions:undefined}).options,{strategy:"native",requireProbabilities:true},"compiled OpenAI sample")
         eq(run(stringify(request),{path:"answers.route.value"}),"billing","compiled decision filter")
         run(stringify(imageRequest))
         eq(calls[calls.length-1].options.images,imageRequest.options.images,"compiled image decision")
         run(stringify(request),{llmimage:file})
         eq(calls[calls.length-1].options.images,[af.fromBytes2String(af.toBase64Bytes(io.readFileBytes(file)))],"compiled local image")
         ;["usage","examples"].forEach(help => {
            printed = ""
            try { run(undefined,{help:help,out:"raw"}) } catch(e) {
               eq(String(e),"exit: 0","help exits normally")
            }
            eq(printed.indexOf("llmdecidesample") >= 0,true,"generated help exposes samples")
            eq(printed.indexOf("in=llmdecide") >= 0,true,"generated help exposes decisions")
         })
      } finally { io.pipeLn = originalPipeLn; io.rm(file); $unset(key) }
   }

   exports.testHSPerfInputs = function() {
      ow.loadJava()
      var params = {}, output, cmdCalls = 0
      var _showTmpMsg = () => {}, _$o = value => { output = value }
      var _exit = (code, message) => { throw new Error(message) }
      var file = io.createTempFile("oafp-hsperf", ".bin")
      var _runCmd2Bytes = cmd => { cmdCalls++; return io.readFileBytesRO(file) }
      var plugin = () => {}, JMX = function() { this.getLocals = () => ({Locals:[{id:"123",name:"a"},{id:456,name:"b"},{id:String(getPid()),name:"self"}]}) }
      var parse = ow.java.parseHSPerf, pids = ow.java.getLocalJavaPIDs
      eval(io.readFileString("../include/streamFns.js"))
      eval(io.readFileString("../include/inputFns.js"))
      var eq = (a,b,msg) => ow.test.assert(a,b,msg)
      try {
         // Test oafp's parser contract independently of the installed OpenAF version.
         // Binary decoding and metadata support belong to OpenAF's parser tests.
         io.writeFileBytes(file, af.fromString2Bytes("fixture"))
         ow.java.parseHSPerf = (input, flat, options) => {
            eq(flat,false,"nested parser output")
            eq(options.metadata,params.hsperfmetadata,"metadata parser option")
            if (isDef(params.cmd)) {
               eq(isByteArray(input),true,"command parser bytes")
               eq(af.fromBytes2String(input),"fixture","command parser content")
            } else {
               eq(input,file,"file parser path")
            }
            var values = {test:{value:"42"}}
            return options.metadata ? {values:values,header:{numEntries:1},entries:{"test.value":{type:"J"}}} : values
         }
         ;[undefined, "false", "true"].forEach(flag => {
            params = {file:file,hsperfmetadata:flag}
            _inputFns.get("hsperf")("", {})
            var values = flag == "true" ? output.values : output
            eq(values.test.value,"42","hsperf values")
            eq(isDate(values.__ts),true,"hsperf enrichment")
            eq(isDef(output.header),flag == "true","opt-in metadata")
         })
         var gzipFile = io.createTempFile("oafp-hsperf", ".gz"), decompressedPath
         try {
            io.writeFileBytes(gzipFile, io.gzip(af.fromString2Bytes("fixture")))
            var parseFixture = ow.java.parseHSPerf
            ow.java.parseHSPerf = (input, flat, options) => {
               decompressedPath = input
               eq(io.readFileString(input),"fixture","gzip hsperf decompressed contents")
               return {test:{value:"42"}}
            }
            params = {file:gzipFile}
            _inputFns.get("hsperf")("", {})
            eq(output.test.value,"42","gzip hsperf output")
            eq(io.fileExists(decompressedPath),false,"gzip temporary file removed")
            ow.java.parseHSPerf = parseFixture
         } finally { io.rm(gzipFile) }
         params = {cmd:"fixture",hsperfmetadata:true}
         _inputFns.get("hsperf")("", {})
         eq(cmdCalls,1,"command input")
         eq(output.header.numEntries,1,"header")
         eq(output.entries["test.value"].type,"J","entry metadata")
         ow.java.parseHSPerf = () => ({sun:{os:{hrt:{frequency:"1000"}},gc:{generation:[{space:[{name:"heap",used:"2",capacity:"10"}]}],collector:[{name:"PSScavenge",time:"200",invocations:"2"}]}}})
         params = {file:file}
         _inputFns.get("hsperf")("",{})
         eq(output.java.__mem.total,10,"string capacity")
         eq(output.sun.gc.__ygct,0.2,"timer frequency")
         eq(isUnDef(output.sun.gc.__percUsed_meta),true,"absent metaspace")
         params.hsperfmetadata = true
         var failed = false
         try { _inputFns.get("hsperf")("",{}) } catch(e) { failed = String(e).indexOf("updated OpenAF") >= 0 }
         eq(failed,true,"old runtime metadata diagnostic")
         ow.java.parseHSPerf = () => 4
         failed = false
         try { _inputFns.get("hsperf")("",{}) } catch(e) { failed = String(e).indexOf("Invalid") >= 0 }
         eq(failed,true,"invalid parser result")
         ow.java.getLocalJavaPIDs = () => [{pid:123,path:"/tmp/hsperf/123"},{pid:String(getPid()),path:"/tmp/hsperf/self"}]
         params = {}
         _inputFns.get("javas")("",{})
         eq(output.length,2,"exclude self")
         eq(output[0].path,"/tmp/hsperf/123","match numeric/string pid")
         eq(isUnDef(output[1].path),true,"unmatched process")
         params = {javasinception:true}
         _inputFns.get("javas")("",{})
         eq(output[2].path,"/tmp/hsperf/self","include self")
         ow.java.getLocalJavaPIDs = () => { throw new Error("unavailable") }
         _inputFns.get("javas")("",{})
         eq(output.length,3,"retain processes without perfdata")
      } finally {
         ow.java.parseHSPerf = parse; ow.java.getLocalJavaPIDs = pids
         io.rm(file)
      }
   }

   // Inputs & outputs
   // ----------------

   exports.testJSON2JSON = function() {
      var _f  = io.createTempFile("testJSON2JSON", ".json")
      var data = { a: 123, b: true, c: [ 1, 2, 3 ] }

      // Test input json formatted and json output
      io.writeFileJSON(_f, data)
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=json"]).get(0)

      ow.test.assert(compare(jsonParse(_r.stdout), data), true, "Problem with input json formatted and json output")

      // Test input json and json output
      io.writeFileJSON(_f, data, "")
      _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=json"]).get(0)
      
      ow.test.assert(compare(jsonParse(_r.stdout), data), true, "Problem with input json and json output")
   }

   exports.testJSON2YAML = function() {
      var _f  = io.createTempFile("testJSON2JSON", ".json")
      var data = { a: 123, b: true, c: [ 1, 2, 3 ] }

      // Test input json formatted and yaml output
      io.writeFileJSON(_f, data)
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=yaml"]).get(0)

      ow.test.assert(compare(af.fromYAML(_r.stdout), data), true, "Problem with input json formatted and yaml output")

      // Test input json and yaml output
      io.writeFileJSON(_f, data, "")
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=yaml"]).get(0)

      ow.test.assert(compare(af.fromYAML(_r.stdout), data), true, "Problem with input json and yaml output")
   }

   exports.testYAML2YAML = function() {
      var _f  = io.createTempFile("testYAML2YAML", ".yaml")
      var data = { a: 123, b: true, c: [ 1, 2, 3 ] }

      // Test input yaml formatted and yaml output
      io.writeFileYAML(_f, data)
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=yaml output=yaml"]).get(0)

      ow.test.assert(compare(af.fromYAML(_r.stdout), data), true, "Problem with input yaml formatted and yaml output")
   }

   exports.testYAML2JSON = function() {
      var _f  = io.createTempFile("testYAML2JSON", ".yaml")
      var data = { a: 123, b: true, c: [ 1, 2, 3 ] }

      // Test input yaml formatted and json output
      io.writeFileYAML(_f, data)
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=yaml output=json"]).get(0)

      ow.test.assert(compare(jsonParse(_r.stdout), data), true, "Problem with input yaml formatted and json output")
   }

   exports.testJSON2Base64 = function() {
      var _f  = io.createTempFile("testJSON2B64", ".json")
      var data = { a: 123, b: true, c: [ 1, 2, 3 ] }

      // Test input yaml formatted and json output
      io.writeFileJSON(_f, data)
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=base64"]).get(0)

      var _fs = io.createTempFile("testB642JSON", ".txt")
      io.writeFileString(_fs, _r.stdout)
      var _s = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _fs + " input=base64 output=json"]).get(0)

      ow.test.assert(compare(jsonParse(_s.stdout), data), true, "Problem with input/output base64 (simple)")
   }

   exports.testJSON2Base64Gzip = function() {
      var _f  = io.createTempFile("testJSON2B64", ".json")
      var data = { a: 123, b: true, c: [ 1, 2, 3 ] }

      // Test input yaml formatted and json output
      io.writeFileJSON(_f, data)
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=base64 base64gzip=true"]).get(0)

      var _fs = io.createTempFile("testB642JSON", ".txt")
      io.writeFileString(_fs, _r.stdout)
      var _s = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _fs + " input=base64 output=json base64gzip=true"]).get(0)

      ow.test.assert(compare(jsonParse(_s.stdout), data), true, "Problem with input/output base64 (simple)")
   }

   exports.testOutHTTP = function() {
      ow.loadServer()
      var port = findRandomOpenPort(), received = []
      var hs = ow.server.httpd.start(port, "127.0.0.1")
      ow.server.httpd.route(hs, {}, req => {
         var f = req.files || {}, body = f.postData
         if (isUnDef(body) && isString(f.content)) { body = io.readFileString(f.content); io.rm(f.content) }
         received.push({ method: req.method, uri: req.uri, ctype: req.header["content-type"], auth: req.header["authorization"], body: body })
         return hs.reply(stringify({ ok: true }, __, ""), "application/json", 200)
      })
      try {
         var _f = io.createTempFile("testOutHTTP", ".json")
         io.writeFileJSON(_f, [ { a: 1 }, { a: 2 } ])
         var url = "httpurl=http://127.0.0.1:" + port + "/in"
         var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=http " + url + " httpparams=\"{requestHeaders:{Authorization:'Bearer x'}}\""]).get(0)
         ow.test.assert(compare(jsonParse(_r.stdout), { ok: true }), true, "out=http prints the server response")
         ow.test.assert(received.length, 1, "out=http sends a single request for the whole array")
         ow.test.assert(received[0].method, "POST", "out=http defaults to POST")
         ow.test.assert(received[0].uri, "/in", "out=http uses the URL path")
         ow.test.assert(received[0].ctype, "application/json", "out=http defaults to a JSON content type")
         ow.test.assert(received[0].auth, "Bearer x", "out=http sends httpparams request headers")
         ow.test.assert(compare(jsonParse(received[0].body), [ { a: 1 }, { a: 2 } ]), true, "out=http sends the output as the body")

         received.length = 0
         $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=http " + url + " httpeach=true httpmethod=put httpformat=yaml httpquiet=true"]).get(0)
         ow.test.assert(received.length, 2, "out=http httpeach sends one request per entry")
         ow.test.assert(received[0].method, "PUT", "out=http honors httpmethod")
         ow.test.assert(received[0].ctype, "application/yaml", "out=http honors httpformat")
         ow.test.assert(received[0].body.trim(), "a: 1", "out=http formats each entry as YAML")

         var _e = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=http httpurl=http://127.0.0.1:1/nope"]).get(0)
         ow.test.assert(_e.exitcode != 0, true, "out=http fails when the request fails")
      } finally {
         ow.server.httpd.stop(hs)
      }
   }

   exports.testInHTTPd = function() {
      // Tests share a JVM and findRandomOpenPort releases the port before the subprocess binds it,
      // so use a range that other tests do not draw from
      var findRandomOpenPort = () => {
         for (var i = 0; i < 100; i++) {
            var p = 20000 + Math.floor(Math.random() * 10000)
            try { new java.net.ServerSocket(p, 1, java.net.InetAddress.getByName("127.0.0.1")).close(); return p } catch(e) {}
         }
         throw "No free port found"
      }
      var port = findRandomOpenPort()
      var run = (extra) => {
         var out, pr = $do(() => $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=httpd inhttpdport=" + port + " inhttpdtimeout=120000 out=json " + extra]).get(0)).then(v => { out = v })
         return () => { $doWait(pr); return out }
      }
      var send = (method, path, body, ctype, uri) => {
         var res, tries = 0
         while (isUnDef(res) && tries++ < 240) {
            try {
               var h = new ow.obj.http()
               res = h.exec("http://127.0.0.1:" + port + path, method, body, { "Content-Type": ctype })
            } catch(e) {
               // Non-2xx replies are thrown with the response map in the message
               var m = String(e), i = m.indexOf("response = ")
               if (i > 0) res = jsonParse(m.substring(i + 11)); else sleep(500, true)
            }
            // A 5xx means the server is listening but not routing yet: the request was not consumed
            if (isDef(res) && res.responseCode >= 500) { res = __; sleep(250, true) }
         }
         return res
      }
      ow.loadObj()

      // JSON body via POST
      var p = run("inhttpdreply=received")
      var r = send("POST", "/hook", stringify({ a: 1, b: [ 1, 2 ] }, __, ""), "application/json")
      var o = p()
      ow.test.assert(isDef(r) && r.response, "received", "in=httpd replies with inhttpdreply")
      ow.test.assert(compare(jsonParse(o.stdout), { a: 1, b: [ 1, 2 ] }), true, "in=httpd parses a JSON POST body")

      // YAML body via PUT (spooled to a temporary file) and envelope
      port = findRandomOpenPort()
      p = run("inhttpdenvelope=true")
      send("PUT", "/x/y", "k: v", "application/yaml")
      var raw = p()
      o = jsonParse(raw.stdout)
      if (!isMap(o)) throw "in=httpd envelope test got no output: " + stringify(raw)
      ow.test.assert(o.method, "PUT", "in=httpd envelope includes the method")
      ow.test.assert(o.uri, "/x/y", "in=httpd envelope includes the uri")
      ow.test.assert(o.body, "k: v", "in=httpd reads PUT bodies")

      // Content type driven parsing, and a path filter
      port = findRandomOpenPort()
      p = run("inhttpdpath=/only")
      var nf = send("POST", "/other", "{}", "application/json")
      ow.test.assert(nf.responseCode, 404, "in=httpd rejects other paths")
      send("POST", "/only", "k: 2", "application/yaml")
      ow.test.assert(compare(jsonParse(p().stdout), { k: 2 }), true, "in=httpd parses YAML from the Content-Type")

      // Timeout
      port = findRandomOpenPort()
      var t = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=httpd inhttpdport=" + port + " inhttpdtimeout=500"]).get(0)
      ow.test.assert(t.exitcode != 0, true, "in=httpd fails on timeout")
   }

   exports.testOutHTTPd = function() {
      // Same port range trick as testInHTTPd: other tests draw ports from a different range
      var findRandomOpenPort = () => {
         for (var i = 0; i < 100; i++) {
            var p = 20000 + Math.floor(Math.random() * 10000)
            try { new java.net.ServerSocket(p, 1, java.net.InetAddress.getByName("127.0.0.1")).close(); return p } catch(e) {}
         }
         throw "No free port found"
      }
      ow.loadObj()
      var port = findRandomOpenPort()
      var run = extra => {
         var out, pr = $do(() => $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "data='[{a:1,b:x},{a:2,b:y}]' in=slon out=httpd httpdport=" + port + " " + extra]).get(0)).then(v => { out = v })
         return () => { $doWait(pr); return out }
      }
      var get = (method, path, headers, body) => {
         var res, tries = 0
         while (isUnDef(res) && tries++ < 60) {
            try {
               res = (new ow.obj.http()).exec("http://127.0.0.1:" + port + path, method, body, headers || {})
            } catch(e) {
               // Non-2xx replies are thrown with the response map in the message
               var m = String(e), i = m.indexOf("response = ")
               if (i > 0) res = jsonParse(m.substring(i + 11)); else sleep(500, true)
            }
         }
         return res
      }

      var p = run("httpdcount=3 httpdcors=true httpduser=u httpdpass=p")
      var auth = { Authorization: "Basic " + af.fromBytes2String(af.toBase64Bytes(af.fromString2Bytes("u:p"))) }
      ow.test.assert(get("GET", "/").responseCode, 401, "out=httpd requires credentials when httpduser is set")
      var r = get("GET", "/", auth)
      ow.test.assert(r.responseCode, 200, "out=httpd accepts valid credentials")
      ow.test.assert(compare(jsonParse(r.response), [ { a: 1, b: "x" }, { a: 2, b: "y" } ]), true, "out=httpd serves JSON by default")
      ow.test.assert(isDef(r.responseCode) && String(r.contentType).indexOf("application/json") >= 0, true, "out=httpd sets the JSON content type")
      r = get("GET", "/?format=yaml", auth)
      ow.test.assert(r.response.indexOf("- a: 1") >= 0, true, "out=httpd honors ?format=")
      r = get("GET", "/?format=csv", auth)
      ow.test.assert(r.response.split("\n")[0].trim(), "a,b", "out=httpd renders CSV")
      ow.test.assert(get("GET", "/?format=grid", auth).responseCode, 400, "out=httpd rejects unsupported formats")
      ow.test.assert(get("POST", "/", merge(auth, { "Content-Type": "text/plain" }), "x").responseCode, 405, "out=httpd only accepts GET")
      var o = p()
      ow.test.assert(o.exitcode, 0, "out=httpd exits after httpdcount requests")

      // Path filter and timeout
      port = findRandomOpenPort()
      p = run("httpdpath=/data httpdtimeout=4000 httpdcount=1")
      ow.test.assert(get("GET", "/other").responseCode, 404, "out=httpd rejects other paths")
      ow.test.assert(get("GET", "/data").responseCode, 200, "out=httpd serves the configured path")
      ow.test.assert(p().exitcode, 0, "out=httpd exits when httpdcount is reached")
      port = findRandomOpenPort()
      var t = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "data='{a:1}' in=slon out=httpd httpdport=" + port + " httpdtimeout=500"]).get(0)
      ow.test.assert(t.exitcode, 0, "out=httpd exits on idle timeout")
   }

   exports.testJSON2TOON = function() {
      var _f = io.createTempFile("testJSON2TOON", ".json")
      var data = { a: 123, b: true, c: [ 1, 2, 3 ] }

      io.writeFileJSON(_f, data)
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=toon"]).get(0)

      var _fs = io.createTempFile("testTOON2JSON", ".toon")
      io.writeFileString(_fs, _r.stdout)
      var _s = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _fs + " input=toon output=json"]).get(0)

      ow.test.assert(compare(jsonParse(_s.stdout), data), true, "Problem with input/output toon")
   }

   exports.testJSON2Markdown = function() {
      var data = { title: "Example", metadata: { active: true, owner: "Ada" }, entries: [ { name: "first", score: 1 }, { name: "second", score: 2 } ], tags: [ "one", "two" ] }
      var _f = io.createTempFile("testJSON2Markdown", ".json")
      io.writeFileJSON(_f, data)

      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=md"]).get(0)
      ow.test.assert(_r.stdout.indexOf("# title") >= 0, true, "Problem with structured Markdown headings")
      ow.test.assert(_r.stdout.indexOf("| Field | Value |") >= 0, true, "Problem with structured Markdown map table")
      ow.test.assert(_r.stdout.indexOf("| name | score |") >= 0, true, "Problem with structured Markdown array table")
      ow.test.assert(_r.stdout.indexOf("- one") >= 0, true, "Problem with structured Markdown list")

      _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=md mdformat=json"]).get(0)
      ow.test.assert(_r.stdout.indexOf("```json") >= 0 && _r.stdout.indexOf('"metadata"') >= 0, true, "Problem with JSON Markdown code block")

      _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " input=json output=md mdformat=yaml"]).get(0)
      ow.test.assert(_r.stdout.indexOf("```yaml") >= 0 && _r.stdout.indexOf("metadata:") >= 0, true, "Problem with YAML Markdown code block")
   }

   exports.testDSV = function() {
      var fixture = io.createTempFile("oafp-dsv", ".txt")
      var input = "name,n\nalpha,1\nbeta,2\n"
      io.writeFileString(fixture, input)
      var eq = (a, b, msg) => ow.test.assert(a, b, msg)
      try {
         ["../oafp.source.js", "../oafp.js"].forEach(file => {
            var run = (args, data) => {
               var result = $sh([getOpenAFPath() + "/oaf", "-f", file, "-e", args], data).get(0)
               eq(result.exitcode, 0, file + ": DSV CLI exits successfully: " + result.stderr)
               return result.stdout.trim().split(/\r?\n/).filter(line => line.length > 0)
            }
            var rows = [{name:"alpha",n:"1"},{name:"beta",n:"2"}]
            eq(run("in=dsv out=json", input).map(line => jsonParse(line)), rows, file + ": stdin emits each row once and skips header")
            eq(run("in=dsv out=json indsvjoin=false indsvtrim=false", "name,n\n alpha , 1 \n").map(line => jsonParse(line)), [{name:" alpha ",n:" 1 "}], file + ": CLI false flags preserve whitespace and stream rows")
            eq(run("in=dsv out=json indsvjoin=true", input).map(line => jsonParse(line)), [rows], file + ": joined stdin")
            eq(run("in=dsv out=json indsvjoin=false file=" + fixture, "").map(line => jsonParse(line)), rows, file + ": file false flag streams rows")
            eq(run("in=dsv out=json indsvfields=name,n indsvheader=false", "# comment\nalpha,1\n\nbeta,2\n").map(line => jsonParse(line)), rows, file + ": explicit fields and comments")
            eq(run("in=dsv out=json indsvjoin=true indsvtrim=false", " name , n \n alpha , 1 \n").map(line => jsonParse(line)), [[{" name ":" alpha "," n ":" 1 "}]], file + ": joined parser preserves header and value whitespace")
            eq(run("in=dsv out=json", "# comment\n\n"), [], file + ": comment-only stdin emits nothing")
            eq(run("in=json out=dsv dsvheader=false dsvuseslon=false dsvquote=~", '{"nested":{"x":1}}'), ['"{~x~:1}"'], file + ": explicit false keeps nested cells in JSON")
            var records = [{name:"alpha",n:1},{n:2,name:"beta"},{name:"gamma",extra:3}]
            var outputArgs = "in=json out=dsv dsvsep=;"
            eq(run(outputArgs, stringify(records)), ['"name";"n"','"alpha";1','"beta";2','"gamma";'], file + ": output header separator and stable column order")
            eq(run(outputArgs + " dsvfields=n,name dsvheader=false", stringify(records)), ['1;"alpha"','2;"beta"',';"gamma"'], file + ": explicit field order without header")
         })
      } finally { io.rm(fixture) }
   }

   exports.testNDJSON2JSON = function() {
      var _f  = io.createTempFile("testNDJSON2JSON", ".ndjson")
      var data = { a: 123, b: true, c: [ 1, 2, 3 ] }
      var data2 = { a: 456, b: false, c: [ 4, 5, 6 ] }
      var data3 = { a: 789, b: true, c: [ 7, 8, 9 ] }

      var out = stringify(data, __, "") + "\n" + stringify(data2, __, "") + "\n" + stringify(data3, __, "")
      io.writeFileString(_f, out)

      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " in=ndjson ndjsonjoin=true out=json"]).get(0)
      var _d = jsonParse(_r.stdout)

      ow.test.assert(_d.length, 3, "Problem with input ndjson and json output")
      ow.test.assert(compare(_d[0], data), true, "Problem with input ndjson and json output (1)")
      ow.test.assert(compare(_d[1], data2), true, "Problem with input ndjson and json output (2)")
      ow.test.assert(compare(_d[2], data3), true, "Problem with input ndjson and json output (3)")
   }

   exports.testNDJSON2JSON_2 = function() {
      var _f = io.createTempFile("testNDJSON2JSON_2", ".ndjson")
      var tdata = { a: 123, b: true, c: [ 1, 2, 3 ] }
      var indata = []

      for (var i = 0; i < 100; i++) {
         var data = clone(tdata)
         data.a = i
         data.c = [ i, i + 1, i + 2 ]
         indata.push(data)
      }
      indata = indata.map(r => stringify(r, __, "")).join("\n")
      io.writeFileString(_f, indata)

      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " in=ndjson ndjsonjoin=true out=json"]).get(0)
      var _d = jsonParse(_r.stdout)
      ow.test.assert(_d.length, 100, "Problem with input ndjson and json output (2)")
      for (var i = 0; i < _d.length; i++) {
         ow.test.assert($from(_d).equals("a", i).count(), 1, "Problem with input ndjson and json output (2) - " + i)
      }
   }

   exports.testNDJSON2JSON_2p = function() {
      var _f = io.createTempFile("testNDJSON2JSON_2p", ".ndjson")
      var tdata = { a: 123, b: true, c: [ 1, 2, 3 ] }
      var indata = []

      for (var i = 0; i < 100; i++) {
         var data = clone(tdata)
         data.a = i
         data.c = [ i, i + 1, i + 2 ]
         indata.push(data)
      }
      indata = indata.map(r => stringify(r, __, "")).join("\n")
      io.writeFileString(_f, indata)

      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "file=" + _f + " in=ndjson parallel=true out=json"]).get(0)
      var _d = _r.stdout.split("\n").filter(r => r.trim() !== "").map(r => jsonParse(r))
      ow.test.assert(_d.length, 100, "Problem with input ndjson and json output (3)")
      for (var i = 0; i < _d.length; i++) {
         ow.test.assert($from(_d).equals("a", i).count(), 1, "Problem with input ndjson and json output (3) - " + i)
      }
   }

   // Transforms
   // ----------
   exports.testMerge = function() {
      var _f = io.createTempFile("testMerge", ".ndjson")
      var data1 = { a: 123, b: true, c: [ 1, 2, 3 ] }
      var data2 = clone(data1)
      data2.d = "test"
      delete data2.a

      io.writeFileString(_f, stringify(data1, __, "") + "\n" + stringify(data2, __, ""))
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=ndjson output=json ndjsonjoin=true merge=true file=" + _f]).getJson(0)

      ow.test.assert(compare(_r.stdout, { a: 123, b: true, c: [ 1, 2, 3, 1, 2, 3 ], d: "test" }), true, "Problem with merge")
   }

   exports.testTransformDataIntegrity = function() {
      var processExpr = () => undefined
      var key = genUUID()
      var eq = (a, b, msg) => ow.test.assert(a, b, msg)
      try {
         ["../oafp.source.js", "../oafp.js"].forEach(file => {
            var runOafp = eval(io.readFileString(file) + "\noafp")
            var run = (data, options) => {
               $unset(key)
               runOafp(merge({in:"json",data:stringify(data),out:"key",__key:key,noexit:true,__inception:true},options))
               return $get(key)
            }
            var nested = [{z:1,a:2}, [[{z:3,a:4}], null], []]
            var sorted = run(nested, {sortmapkeys:true})
            eq(isArray(sorted), true, file + ": sorting preserves root arrays")
            eq(stringify(sorted, __, ""), '[{"a":2,"z":1},[[{"a":4,"z":3}],null],[]]', file + ": recursive sorting preserves array shape and order")
            eq(run({z:nested,a:0}, {sortmapkeys:true}).z, sorted, file + ": nested arrays")
            var distinct = [[1], {"0":1}, {n:{b:2,a:1}}, {n:{a:1,b:2}}, [2,1], [1,2]]
            eq(run(distinct, {removedups:true}), [distinct[0],distinct[1],distinct[2],distinct[4],distinct[5]], file + ": dedup preserves types and ignores nested key order")
            eq(run({a:[[1]],b:[{"0":1}]}, {set:"(a: a, b: b)",setop:"intersect"}), [], file + ": set comparison distinguishes arrays and maps")
            eq(run({a:[{n:{b:2,a:1}}],b:[{n:{a:1,b:2}}]}, {set:"(a: a, b: b)",setop:"intersect"}), [{n:{b:2,a:1}}], file + ": set comparison ignores nested key order")
            eq(run({a:[[1]],b:[{"0":1}]}, {set:"(a: a, b: b)",setop:"union"}), [[1],{"0":1}], file + ": union retains distinct shapes")
            eq(run({a:[{id:{x:[1]},label:"a"}],b:[{id:{x:{"0":1}},label:"b"}]}, {set:"(a: a, b: b)",setkeys:"id",setop:"intersect"}), [], file + ": selected set keys preserve nested shapes")
            eq(run([null, false, 0, "0", null, false, 0], {removedups:true}), [null,false,0,"0"], file + ": primitive dedup preserves types")
            eq(run({rows:[1,2]}, {getlist:false}), {rows:[1,2]}, file + ": disabled getlist preserves input")
            ;["plain", 42, false].forEach(value => eq(run(value, {getlist:true}), value, file + ": getlist preserves scalars"))
            eq(run({first:[1],second:[2]}, {getlist:2}), [2], file + ": getlist selects requested array")
            eq(run({value:1}, {getlist:true}), {value:1}, file + ": missing list preserves input")
         })
      } finally { $unset(key) }
   }

   exports.testMapDiff = function() {
      var processExpr = () => undefined
      var key = genUUID()
      var eq = (actual, expected, message) => ow.test.assert(stringify(actual, __, ""), stringify(expected, __, ""), message)
      try {
         ["../oafp.source.js", "../oafp.js"].forEach(file => {
            var runOafp = eval(io.readFileString(file) + "\noafp")
            var run = (data, options) => {
               $unset(key)
               runOafp(merge({in:"json",data:JSON.stringify(data),out:"key",__key:key,noexit:true,__inception:true,mapdiff:"(a: old, b: new)"}, options))
               return $get(key)
            }
            var check = (a, b, expected, message) => eq(run({old:a,new:b}), expected, file + ": " + message)
            var empty = {onlyA:{},onlyB:{},changed:{}}
            check({z:1,a:[{z:2,a:3},[[1]],null]}, {a:[{a:3,z:2},[[1]],null],z:1}, empty, "key order ignored at every map depth")
            check({name:"old",config:{port:80},legacy:true}, {name:"new",config:{port:443},enabled:true},
               {onlyA:{legacy:true},onlyB:{enabled:true},changed:{"/config/port":{a:80,b:443},"/name":{a:"old",b:"new"}}}, "documented comparison")
            check({n:{a:null,empty:{},list:[]},gone:{z:1,a:2}}, {n:{b:false}},
               {onlyA:{gone:{a:2,z:1},n:{a:null,empty:{},list:[]}},onlyB:{n:{b:false}},changed:{}}, "nested missing values and complete missing containers")
            check({n:null,f:false,z:0,s:"",obj:{}}, {n:0,f:0,z:"0",s:null,obj:[]},
               {onlyA:{},onlyB:{},changed:{"/f":{a:false,b:0},"/n":{a:null,b:0},"/obj":{a:{},b:[]},"/s":{a:"",b:null},"/z":{a:0,b:"0"}}}, "strict scalar and container types")
            check({x:{a:1}}, {x:2}, {onlyA:{},onlyB:{},changed:{"/x":{a:{a:1},b:2}}}, "map to scalar reported once")
            ;[[[1,2],[2,1]], [[1,1],[1]], [[[1]], [{"0":1}]], [[{a:2,z:1}], [{a:3,z:1}]]].forEach(pair => {
               check({x:pair[0]}, {x:pair[1]}, {onlyA:{},onlyB:{},changed:{"/x":{a:pair[0],b:pair[1]}}}, "array change is atomic")
            })
            check({"a/b":{"~":1},"":1,"x.y":1}, {"a/b":{"~":2},"":2,"x.y":2},
               {onlyA:{},onlyB:{},changed:{"/":{a:1,b:2},"/a~1b/~0":{a:1,b:2},"/x.y":{a:1,b:2}}}, "JSON Pointer escaping")
            var specialA = JSON.parse('{"__proto__":{"z":1,"a":2},"constructor":1,"hasOwnProperty":true}')
            var specialB = JSON.parse('{"constructor":2,"hasOwnProperty":false,"new":1}')
            check(specialA, specialB, JSON.parse('{"onlyA":{"__proto__":{"a":2,"z":1}},"onlyB":{"new":1},"changed":{"/constructor":{"a":1,"b":2},"/hasOwnProperty":{"a":true,"b":false}}}'), "special property names")
            check({x:[{constructor:1}]}, {x:[{constructor:1}]}, empty, "array equality handles constructor keys")
            check({}, JSON.parse('{"__proto__":{"z":1,"a":2}}'), JSON.parse('{"onlyA":{},"onlyB":{"__proto__":{"a":2,"z":1}},"changed":{}}'), "special missing key in B")
            check({x:JSON.parse('{"__proto__":1}')}, {x:JSON.parse('{"__proto__":2}')},
               {onlyA:{},onlyB:{},changed:{"/x/__proto__":{a:1,b:2}}}, "special changed key")
            var ordered = run({old:{z:1,a:2,n:{z:3,a:4}},new:{z:2,a:3,n:{z:4,a:5}}})
            eq(run({old:{n:{a:4,z:3},a:2,z:1},new:{n:{a:5,z:4},a:3,z:2}}), ordered, file + ": deterministic output for reordered inputs")
            eq(run({old:{},new:{}}, {mapdiff:{a:"old",b:"new"}}), empty, file + ": map configuration")
            eq(run({old:{},new:{}}, {transforms:true,mapdiff:undefined}).indexOf("mapdiff") >= 0, true, file + ": transform discovery")
            var baseline = run({old:"a",new:"b"}, {mapdiff:undefined,diff:"(a: old, b: new)"})
            ow.test.assert(isArray(baseline), true, file + ": existing diff still returns chunks")
         })
         // Inspect the transform directly to prove it does not mutate or alias the input.
         var params = {mapdiff:"(a: old, b: new)"}
         var _fromJSSLON = value => isString(value) ? af.fromSLON(value) : value
         var _exit = (code, message) => { throw message }
         var transform = eval(io.readFileString("../include/transformFns.js") + "\n_transformFns.mapdiff")
         var input = {old:{z:[[{z:1,a:2}]],nested:{missing:{z:2,a:1}}},new:{z:[]}}
         var before = JSON.stringify(input), result = transform(input)
         eq(JSON.stringify(input), before, "mapdiff preserves input values and order")
         result.onlyA.nested.missing.a = 99
         result.changed["/z"].a[0][0].a = 99
         eq(JSON.stringify(input), before, "mapdiff copies reported containers")
         ;["not a map", "[]", "{}", "(a: old)", {a:1,b:"new"}, {a:"",b:"new"}, {a:"old",b:"missing"}, {a:"old",b:"scalar"}, {a:"old",b:"["}].forEach(config => {
            params.mapdiff = config
            var error
            try { transform({old:{},new:{},scalar:1}) } catch(e) { error = String(e) }
            ow.test.assert(isString(error) && error.indexOf("mapdiff") >= 0, true, "Invalid mapdiff reports an actionable error: " + stringify(config))
         })
      } finally { $unset(key) }
   }

   exports.testSortMapKeys = function() {
      var _f = io.createTempFile("testSortMapKeys", ".json")
      var data1 = { a: 123, z:[{b:4,a:3},{a:1,b:2}],b: true, c: [ 1, 2, 3 ] }

      io.writeFileString(_f, stringify(data1, __, ""))
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=ndjson output=json sortmapkeys=true file=" + _f]).get(0)

      ow.test.assert(_r.stdout.trim(), '{"a":123,"b":true,"c":[1,2,3],"z":[{"a":3,"b":4},{"a":1,"b":2}]}', "Problem with sortmapkeys")
   }

   exports.testCorrectTypes = function() {
      var _f = io.createTempFile("testCorrectTypes", ".json")
      var data1 = { a: "123", b: "true", c: [ "1", 2, "3" ] }

      io.writeFileString(_f, stringify(data1, __, ""))
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json correcttypes=true file=" + _f]).get(0)

      ow.test.assert(_r.stdout.trim(), '{"a":123,"b":true,"c":[1,2,3]}', "Problem with correcttypes")
   }

   exports.testSearchKeys = function() {
      var _f = io.createTempFile("testSearchKeys", ".json")
      var data1 = { a: 123, b: true, c: [ 1, 2, 3 ], d: { e: true } }

      io.writeFileString(_f, stringify(data1, __, ""))
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json searchkeys=a file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, {".a":123}, "Problem with searchkeys (1)")

      _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json searchkeys=c file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, {".c":[1,2,3]}, "Problem with searchkeys (2)")

      _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json searchkeys=e file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, {".d.e":true}, "Problem with searchkeys (3)")
   }

   exports.testSearchValues = function() {
      var _f = io.createTempFile("testSearchValues", ".json")
      var data1 = { a: 123, b: true, c: [ 1, 2, 3 ], d: { e: true } }

      io.writeFileString(_f, stringify(data1, __, ""))
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json searchvalues=123 file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, {".a":123}, "Problem with searchvalues (1)")

      _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json searchvalues=true file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, {".b":true,".d.e":true}, "Problem with searchvalues (2)")
   }

   exports.testMapToArray = function() {
      var _f = io.createTempFile("testMapToArray", ".json")
      var data1 = { a: { x: 1, y: -1 }, b: { x: 0, y: 0 }, c: { x: 1, y: 1 } }

      io.writeFileString(_f, stringify(data1, __, ""))
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json maptoarray=true file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, [{ x: 1, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 1 }], "Problem with maptoarray (1)")

      _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json maptoarray=true maptoarraykey=type file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, [{ type: "a", x: 1, y: -1 }, { type: "b", x: 0, y: 0 }, { type: "c", x: 1, y: 1 }], "Problem with maptoarray (2)")
   }

   exports.testArrayToMap = function() {
      var _f = io.createTempFile("testArrayToMap", ".json")
      var data1 = [{ type: "a", x: 1, y: -1 }, { type: "b", x: 0, y: 0 }, { type: "c", x: 1, y: 1 }]

      io.writeFileString(_f, stringify(data1, __, ""))
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json arraytomap=true file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, {"row0":{"type":"a","x":1,"y":-1},"row1":{"type":"b","x":0,"y":0},"row2":{"type":"c","x":1,"y":1}}, "Problem with arraytomap (1)")

      _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json arraytomap=true arraytomapkey=type file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, {"a":{"x":1,"y":-1},"b":{"x":0,"y":0},"c":{"x":1,"y":1}}, "Problem with arraytomap (2)")

      _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json arraytomap=true arraytomapkey=type arraytomapkeepkey=true file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, {"a":{"type":"a","x":1,"y":-1},"b":{"type":"b","x":0,"y":0},"c":{"type":"c","x":1,"y":1}}, "Problem with arraytomap (3)")
   }

   exports.testFlatMap = function() {
      var _f = io.createTempFile("testFlatMap", ".json")
      var data1 = { a: { x: 1, y: -1 }, b: { x: 0, y: 0 }, c: { x: 1, y: 1 } }

      io.writeFileString(_f, stringify(data1, __, ""))
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "input=json output=json flatmap=true file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, {"c.x":1,"c.y":1,"b.x":0,"b.y":0,"a.x":1,"a.y":-1}, "Problem with flatmap")
   }

   // Set transform
   exports.testSet = function() {
      var _f = io.createTempFile("testFlatMap", ".json")
      var data1 = {
         old: [ { x: 1, y: 1 }, { x: 2, y: -2 }, { x: 0, y: 0 } ],
         new: [ { x: 0, y: 0 }, { x: 1, y: 1  }, { x: 3, y: -3 } ]
      }

      io.writeFileString(_f, stringify(data1, __, ""))

      // Intersect
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=json out=json set=\"(a: 'old', b: 'new')\" setop=intersect file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, [{"x":1,"y":1},{"x":0,"y":0}], "Problem with set intersect")

      // Union
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=json out=json set=\"(a: 'old', b: 'new')\" setop=union file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, [{"x":1,"y":1},{"x":2,"y":-2},{"x":0,"y":0},{"x":3,"y":-3}], "Problem with set union")

      // DiffA
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=json out=json set=\"(a: 'old', b: 'new')\" setop=diffa file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, [{"x":2,"y":-2}], "Problem with set diffa")

      // DiffB
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=json out=json set=\"(a: 'old', b: 'new')\" setop=diffb file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, [{"x":3,"y":-3}], "Problem with set diffb")

      // DiffAB
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=json out=json set=\"(a: 'old', b: 'new')\" setop=diffab file=" + _f]).getJson(0)
      ow.test.assert(_r.stdout, [{"x":2,"y":-2},{"x":3,"y":-3}], "Problem with set diffab")
   }

   // JSON Schema
   exports.testJsonSchema = function() {
      var _f = io.createTempFile("testJsonSchema", ".json")
      var data1 = { a: 123, b: true, c: [ 1, 2, 3 ] }
      var sch1  = {"$id":"https://example.com/schema.json","$schema":"http://json-schema.org/draft-07/schema#","required":[],"type":"object","properties":{"a":{"type":"number"},"b":{"type":"boolean"},"c":{"type":"array","items":{"type":"number"}}}}

      io.writeFileString(_f, stringify(data1, __, ""))
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=json jsonschemagen=true out=json file=" + _f]).get(0)
      ow.test.assert(jsonParse(_r.stdout), sch1, "Problem with generating a jsonschema")

      var _f2 = io.createTempFile("testJsonSchema2", ".json")
      io.writeFileString(_f2, stringify(sch1, __, ""))
      var _r2 = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=jsonschema out=json file=" + _f2]).get(0)
      ow.test.assert(isMap(jsonParse(_r2.stdout)), true, "Problem with generating data from a jsonschema")

      var _f3 = io.createTempFile("testJsonSchema3", ".json")
      io.writeFileString(_f3, _r2.stdout)
      var _r3 = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=json out=json jsonschema=" + _f2 + " file=" + _f3]).get(0)
      ow.test.assert(jsonParse(_r3.stdout).valid, true, "Problem with validating generated data from a jsonschema")
   }

   // Run each validation in a fresh CLI process so options cannot leak between cases.
   exports.testJsonSchemaOptions = function() {
      var dataFile = io.createTempFile("schemaData", ".json")
      var schemaFile = io.createTempFile("schemaDefinition", ".json")
      var run = function(data, schema, options, command) {
         io.writeFileJSON(dataFile, data)
         io.writeFileJSON(schemaFile, schema)
         var expr = "in=json out=json file=" + dataFile + (command ? ' jsonschemacmd="cat ' + schemaFile + '"' : " jsonschema=" + schemaFile)
         if (isDef(options)) expr += ' jsonschemaoptions="' + options.replace(/"/g, '\\"') + '"'
         return $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", expr]).get(0)
      }
      try {
         var schema = { type: "object", required: ["name"], properties: { age: { type: "integer" }, name: { type: "string", default: "sample" } } }
         var result = jsonParse(run({ age: "2" }, schema).stdout)
         ow.test.assert(result.valid, false, "Default validation must not coerce types or insert defaults")
         ow.test.assert(result.errors.length, 2, "Default validation must collect all errors")
         var modernAjv = result.errors.some(e => isDef(e.instancePath))
         ow.test.assert(result.errors.some(e => (modernAjv ? e.instancePath == "/age" : e.dataPath == ".age") && e.keyword == "type"), true, "Validation error must identify age using the runtime's Ajv path")
         ow.test.assert(jsonParse(run({ age: "2" }, schema, '(useDefaults: true, coerceTypes: true)').stdout), { valid: true, errors: null }, "SLON mutation options not applied")
         ow.test.assert(jsonParse(run({ age: "2" }, schema, '{"allErrors":false}').stdout).errors.length, 1, "JSON allErrors override not applied")
         ow.test.assert(jsonParse(run({ age: 2, name: "ok" }, schema, '(strict: true)', true).stdout).valid, true, "Options must work with command schemas")
         var dateSchema = { type: "object", properties: { date: { type: "string", format: "date" } } }
         ow.test.assert(jsonParse(run({ date: "2023-02-31" }, dateSchema, '(format: full)').stdout).valid, false, "Full format checks missing")
         ow.test.assert(jsonParse(run({ date: "invalid" }, dateSchema, '(format: false)').stdout).valid, true, "Format checks were not disabled")
         // Newer drafts require OpenAF's Ajv 8 upgrade; legacy runtimes use draft-07.
         var drafts = modernAjv ? ["2019-09", "2020-12"] : []
         drafts.forEach(draft => {
            var s = { "$schema": "https://json-schema.org/draft/" + draft + "/schema", type: "object", properties: { allowed: { type: "integer" } }, unevaluatedProperties: false }
            ow.test.assert(jsonParse(run({ allowed: 1 }, s).stdout).valid, true, "Draft " + draft + " valid data rejected")
            ow.test.assert(jsonParse(run({ extra: 1 }, s).stdout).valid, false, "Draft " + draft + " unevaluatedProperties ignored")
         })
         var badOptions = run({}, { type: "object" }, '[]')
         ow.test.assert(badOptions.exitcode != 0, true, "Non-map options must fail")
         ow.test.assert(badOptions.stderr.indexOf("jsonschemaoptions must be a JSON/SLON map") >= 0, true, "Options error is not actionable")
      } finally {
         io.rm(dataFile)
         io.rm(schemaFile)
      }
   }

   // CSV 
   exports.testCSV = function() {
      var _f = io.createTempFile("testCSV", ".csv")
      var data1 = [ 
         {id: 1, status: true, text: "abc", number: 123},
         {id: 2, status: false, text: "def", number: 456},
         {id: 3, status: true, text: "ghi", number: 789}
      ]
      var out1 = "id|status|text|number\r\n1|true|abc|123\r\n2|false|def|456\r\n3|true|ghi|789"

      io.writeFileString(_f, stringify(data1, __, ""))
      var _r = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=json out=csv csv=\"(withDelimiter: '|')\" file=" + _f]).get(0)
      ow.test.assert(_r.stdout.trim(), out1.trim(), "Problem with json to csv")

      var _f2 = io.createTempFile("testCSV2", ".csv")
      io.writeFileString(_f2, _r.stdout)
      var _r2 = $sh([getOpenAFPath() + "/oaf", "-f", "../oafp.source.js", "-e", "in=csv inputcsv=\"(withDelimiter: '|')\" correcttypes=true out=json file=" + _f2]).get(0)
      ow.test.assert(compare(jsonParse(_r2.stdout), data1), true, "Problem with csv to json")
   }
})()
