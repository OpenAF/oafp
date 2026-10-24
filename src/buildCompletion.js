// Build completion metadata from documented CLI tables. No installed oafp is required.
exports.generate = function(markdown, hints) {
   var complete = [], byName = {}, groups = [], bucketOptions = [], section = "", group, headers, fence
   var normalize = value => value.toLowerCase().replace(/[^a-z0-9]/g, "")
   var plain = value => value.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/`/g, "").trim()
   var optionName = value => /^-/.test(value) ? value : value + "="
   var add = (list, name, desc) => {
      var entry = list.filter(item => item.name == name)[0]
      if (!entry) { entry = {name:name, desc:plain(desc)}; list.push(entry) }
      return entry
   }
   var root = (name, desc) => {
      var entry = add(complete, name, desc)
      byName[name] = entry
      return entry
   }
   markdown.split(/\r?\n/).forEach(line => {
      var marker = line.match(/^ {0,3}(`{3,}|~{3,})/)
      if (fence) {
         if (marker && marker[1].charAt(0) == fence.charAt(0) && marker[1].length >= fence.length && /^\s*$/.test(line.substring(marker[0].length))) fence = undefined
         return
      }
      if (marker && !(marker[1].charAt(0) == "`" && line.substring(marker[0].length).indexOf("`") >= 0)) { fence = marker[1]; return }
      var heading = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
      if (heading) {
         headers = undefined
         if (heading[1].length == 2) { section = normalize(heading[2]); group = undefined }
         if (heading[1].length <= 3) {
            var match = heading[2].match(/^(.*?)\s+(input(?:\/output|\/transform)?|output|transform)\s+options$/i)
            if (match) {
               group = {name:normalize(match[1]), directions:match[2].toLowerCase().split("/"), entries:[]}
               groups.push(group)
            }
         }
         return
      }
      if (!/^\s*\|.*\|\s*$/.test(line)) { headers = undefined; return }
      var cells = line.trim().slice(1, -1).replace(/\\\|/g, "\u0000").split("|").map(cell => cell.replace(/\u0000/g, "|").trim())
      if (cells.every(cell => /^[-: ]+$/.test(cell))) return
      if (!headers) { headers = cells; return }
      var description = headers.indexOf("Description")
      if (description < 0 || !cells[description]) return
      var key = plain(cells[0]), desc = cells[description]
      if (headers[0] == "Input type" || headers[0] == "Output format") {
         var direction = headers[0] == "Input type" ? "in=" : "out="
         var parent = root(direction, direction == "in=" ? "The input type" : "The output format")
         add(parent.opts || (parent.opts = []), direction + key, desc)
      } else if (headers[0] == "Option" || (headers[0] == "Parameter" && section == "sbuckets")) {
         if (!/^-?[A-Za-z][A-Za-z0-9_-]*$/.test(key)) return
         var entry = root(optionName(key), desc)
         if (group) group.entries.push(entry)
         if (headers[0] == "Parameter") bucketOptions.push(entry)
      } else if (headers[0] == "Help" && /^help=[a-z]+$/.test(key)) {
         var help = root("help=", "Show help")
         add(help.opts || (help.opts = []), key, desc)
      }
   })
   groups.forEach(group => {
      group.directions.forEach(direction => {
         var parents = []
         if (direction == "input" || direction == "output") {
            var parent = byName[direction == "input" ? "in=" : "out="]
            if (parent && parent.opts) parents = parent.opts.filter(entry => normalize(entry.name.split("=")[1]) == group.name)
         } else if (byName[group.name + "="]) parents = [byName[group.name + "="]]
         // The shared LLM section also documents llmprompt and decision transforms.
         if (direction == "transform" && group.name == "llm") parents = [byName["llmprompt="], byName["llmdecide="]].filter(Boolean)
         parents.forEach(parent => {
            group.entries.forEach(entry => {
               if (entry !== parent && !(parent.opts || []).some(item => item.name == entry.name)) (parent.opts || (parent.opts = [])).push(entry)
            })
         })
      })
   })
   if (byName["secKey="]) byName["secKey="].opts = bucketOptions.filter(entry => entry !== byName["secKey="])
   Object.keys(hints || {}).forEach(name => {
      if (byName[name]) hints[name].forEach(entry => add(byName[name].opts || (byName[name].opts = []), entry.name, entry.desc))
   })
   if (!byName["in="] || !byName["out="]) throw "Completion generation requires documented input and output tables"
   // Expand shared entries so the YAML stays readable without anchors/aliases.
   return JSON.parse(JSON.stringify({complete:complete}))
}
