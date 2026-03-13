# oafp - LLM Guide for Command Generation

This guide is designed for LLM models to understand how `oafp` (OpenAF Processor) works and how to suggest correct `oafp` command lines to achieve data input/output/transformation goals.

## What is oafp?

`oafp` is a versatile command-line data processor that takes input data (JSON, CSV, YAML, XML, etc.), optionally transforms and filters it, and outputs it in a different format or visualization. Think of it as a universal data format converter and query tool.

**Core syntax:**
```
oafp [file] [option=value ...]
```

Input can come from: a **file**, **stdin/pipe**, the **cmd** option (execute a command), the **data** option (inline data), or a **url** option (fetch from URL).

## Key Concepts

### Data Flow Pipeline

```
input data -> ifrom/isql -> path -> transforms -> from -> sql -> opath -> output
```

- **`path`** (JMESPath): Select/reshape data before transforms
- **`from`** (nLinq): Filter data after transforms
- **`sql`** (SQL): Query data after transforms
- Filters apply in order: `path` -> `from` -> `sql`
- Pre-filters `ifrom`/`isql` apply before `path`; `opath` applies after `sql`

### SLON Format

SLON is OpenAF's simplified notation used frequently instead of JSON for inline data. Key differences from JSON:
- Parentheses `()` instead of curly braces `{}` for maps
- Pipes `|` instead of commas `,` for array separators
- No quotes needed for simple keys
- Example: `(name: John, age: 30)` = `{"name":"John","age":30}`
- Array example: `[1|2|3]` = `[1,2,3]`

---

## Input Types (`in=`)

Input is often auto-detected from file extension or content. Override with `in=<type>`.

| Input | Description | Common Use |
|-------|-------------|------------|
| `json` | JSON format (auto-detected) | Default for most APIs |
| `yaml` | YAML format (auto-detected) | Config files |
| `csv` | CSV format (auto-detected) | Tabular data files |
| `xml` | XML format (auto-detected) | RSS feeds, configs |
| `slon` | SLON format (auto-detected) | OpenAF's simplified notation |
| `lines` | Text processed line by line | Command output parsing |
| `ndjson` | Newline-delimited JSON | Log files, streaming data |
| `ndslon` | Newline-delimited SLON | OpenAF streaming data |
| `md` | Markdown | Documentation |
| `mdtable` | Markdown table | Tables in docs |
| `ini` | INI/Properties format | Config files |
| `toml` | TOML format | Config files |
| `toon` | TOON format | Config files |
| `base64` | Base64 encoded data | Encoded payloads |
| `xls` | Excel XLSX (requires `file=`) | Spreadsheets |
| `db` | JDBC database query | Database queries |
| `raw` | Pass input directly | Raw text processing |
| `llm` | LLM prompt input | AI data generation |
| `ls` | File/directory listing | File exploration |
| `sh` | Shell command execution | Command output as map |
| `oaf` | OpenAF script execution | Custom data generation |
| `ch` | OpenAF channel | Data stores |
| `openmetrics` | Prometheus/OpenMetrics | Monitoring data |
| `sql` | SQL to AST or beautified | SQL formatting |
| `jwt` | JSON Web Token decode | Token inspection |
| `rawhex` | Hex representation | Binary inspection |
| `ask` | Interactive user prompts | User input |
| `mcp` | Model Context Protocol | MCP tool calls |
| `gb64json` | Gzipped base64 JSON | Compressed payloads |
| `hsperf` | Java hsperfdata | JVM monitoring |
| `javagc` | Java GC logs | JVM GC analysis |
| `javathread` | Java thread dumps | JVM thread analysis |
| `jfr` | Java Flight Recorder | JVM profiling |
| `jmx` | Java JMX | JVM management |
| `javas` | List local Java processes | JVM discovery |
| `snmp` | SNMP device data | Network device monitoring |
| `jsonschema` | JSON Schema sample gen | Generate sample data |
| `oafp` | Sub-oafp call | Recursive processing |
| `ojob` | oJob execution | Workflow execution |
| `llmmodels` | List available LLM models | Model discovery |
| `mdcode` | Markdown code blocks | Extract code from docs |

## Output Formats (`out=`)

| Output | Description | Best For |
|--------|-------------|----------|
| `ctree` | Colored tree (default) | Interactive viewing of maps |
| `ctable` | Colored table | Interactive viewing of arrays |
| `json` | Compact JSON | Piping to other tools |
| `pjson` / `prettyjson` | Pretty-printed JSON | Human-readable JSON |
| `cjson` | Colored JSON | Interactive JSON viewing |
| `yaml` | YAML | Config generation |
| `cyaml` | Colored YAML | Interactive YAML viewing |
| `kyaml` | Kubernetes YAML | K8s manifests |
| `ckyaml` | Colored Kubernetes YAML | Interactive K8s YAML |
| `csv` | CSV (arrays only) | Spreadsheet import |
| `xml` | XML | XML generation |
| `pxml` | Pretty XML | Human-readable XML |
| `table` | Plain table (arrays only) | Non-colored terminals |
| `stable` | Table with separators | Formal tables |
| `ctable` | Colored table (arrays only) | Interactive table viewing |
| `map` | Rectangle map format | Map visualization |
| `tree` | Plain tree | Non-colored terminals |
| `md` | Markdown | Documentation |
| `mdtable` | Markdown table (arrays only) | Documentation tables |
| `slon` | SLON | OpenAF consumption |
| `cslon` | Colored SLON | Interactive SLON viewing |
| `ndjson` | Newline-delimited JSON | Streaming/log output |
| `ndslon` | Newline-delimited SLON | OpenAF streaming |
| `html` | HTML (opens in browser) | Reports |
| `text` | Plain text string | Simple text output |
| `raw` | Raw internal representation | Debugging |
| `lines` | Array of strings as lines | Text output |
| `base64` | Base64 encoded | Encoding |
| `gb64json` | Gzipped base64 | Compressed encoding |
| `ini` | INI/Properties | Config generation |
| `toml` | TOML | Config generation |
| `toon` | TOON | Config generation |
| `sql` | SQL INSERT statements | Database import scripts |
| `db` | Direct JDBC database output | Database insertion |
| `xls` | Excel XLSX | Spreadsheet generation |
| `template` | Handlebars template | Custom formatted output |
| `chart` | Line chart (use with `loop`) | Real-time monitoring |
| `schart` | Static line chart | Static data visualization |
| `grid` | Multi-panel ASCII grid | Dashboards |
| `log` | Human-readable log | Logstash-compatible data |
| `openmetrics` | Prometheus format | Monitoring export |
| `envs` | Environment variables | Shell integration |
| `cmd` | Execute command per entry | Batch operations |
| `ch` | OpenAF channel | Data store output |
| `jwt` | Sign JWT | Token generation |
| `mdyaml` | Multi-doc YAML (arrays) | K8s multi-resource |
| `rawascii` | ASCII visualization | Non-printable char inspection |

## Transforms (Applied Between Input and Output)

| Transform | Type | Description |
|-----------|------|-------------|
| `flatmap=true` | Boolean | Flatten nested map to single level (use `flatmapsep` for custom separator) |
| `maptoarray=true` | Boolean | Convert map to array (with optional `maptoarraykey`) |
| `arraytomap=true` | Boolean | Convert array to map (with `arraytomapkey`) |
| `merge=true` | Boolean | Merge array of maps into one map |
| `sortmapkeys=true` | Boolean | Sort map keys alphabetically |
| `correcttypes=true` | Boolean | Auto-convert strings to numbers/dates/booleans |
| `removedups=true` | Boolean | Remove duplicates from arrays |
| `removenulls=true` | Boolean | Remove null/undefined values |
| `removeempty=true` | Boolean | Remove null/undefined array entries |
| `trim=true` | Boolean | Trim all string values |
| `searchkeys=<str>` | String | Return only matching keys |
| `searchvalues=<str>` | String | Return only matching values |
| `getlist=true` | Boolean/Number | Find first array in input |
| `forcearray=true` | Boolean | Force map input to single-element array |
| `allstrings=true` | Boolean | Convert all values to strings |
| `field2byte=<fields>` | String | Convert fields to byte abbreviations |
| `field2date=<fields>` | String | Convert fields to date values |
| `field2si=<fields>` | String | Convert fields to SI abbreviations |
| `field2str=<fields>` | String | Convert fields to string representation |
| `field4map=<fields>` | String | Convert JSON/SLON string fields to maps |
| `numformat=<fmt>` | String | Apply Java format to all numbers |
| `spacekeys=<str>` | String | Replace spaces in keys |
| `val2icon=default` | String | Convert booleans/nulls to emoticons |
| `llmprompt=<prompt>` | String | Use LLM to transform data |
| `llmcontext=<ctx>` | String | Extra context for LLM transform |
| `diff=<spec>` | String | Compare data at two paths |
| `set=<spec>` | String | Set operations (intersect, union, diff) |
| `regression=<type>` | String | Statistical regression (linear, log, exp, poly, power) |
| `kmeans=<n>` | Number | K-means clustering |
| `cmlt=true` | Boolean | Accumulate values over loop iterations |
| `oaf=<code>` | String | Execute OpenAF code on data |
| `xfn=<code>` | String | Execute JS code (`args` = input, return result) |
| `xrfn=<code>` | String | Execute JS code per array record |
| `jsonschema=<file>` | String | Validate data against JSON schema |
| `jsonschemagen=true` | Boolean | Generate JSON schema from data |
| `normalize=<schema>` | String | Normalize data with schema |
| `denormalize=<schema>` | String | Reverse normalization |

---

## Filter Syntax Quick Reference

### JMESPath (`path=`)

JMESPath is the primary query language. Key patterns:

```bash
# Select a nested field
path="response.data"

# Array projection - get specific fields from each element
path="items[].{name:metadata.name, status:status.phase}"

# Filter array elements
path="items[?status=='Running']"

# Sort
path="sort_by(items[], &name)"

# Pipe expressions
path="items[].name | sort(@)"

# Slice arrays
path="items[0:5]"       # first 5
path="items[-1]"        # last element
```

### Useful JMESPath Functions in oafp

These are the most commonly needed functions beyond standard JMESPath:

**String manipulation:**
- `replace(str, 're', 'flags', 'replacement')` - Regex replace
- `split(str, 'sep')` - Split string
- `split_re(str, 'regex')` - Split by regex
- `trim(str)` - Trim whitespace
- `lower_case(str)` / `upper_case(str)` - Case conversion
- `substring(str, start, length)` - Substring
- `concat(a, b)` - Concatenate strings/arrays
- `match(str, 'regex', 'flags')` - Regex match (boolean)
- `index_of(str, 'search')` - Find position

**Number/Math:**
- `add(a, b)`, `sub(a, b)`, `mul(a, b)`, `div(a, b)`, `mod(a, b)` - Arithmetic
- `sum(arr)`, `avg(arr)`, `min(arr)`, `max(arr)` - Aggregation
- `to_number(x)` - Cast to number
- `abs(n)`, `ceil(n)`, `floor(n)` - Math functions
- `random(min, max)` - Random number

**Date/Time:**
- `now(diff)` - Current timestamp (ms), with optional diff
- `to_date(x)` - Convert to date
- `to_datef(str, 'pattern')` - Parse date with Java format
- `from_datef(date, 'format')` - Format date
- `to_isoDate(x)` - To ISO date string
- `date_diff(field, 'unit', nullval)` - Difference from now
- `timeago(ms)` - Human-readable time ago
- `from_ms(ms, 'format')` - Format milliseconds

**Format conversions:**
- `to_bytesAbbr(n)` / `from_bytesAbbr(str)` - Byte abbreviations (e.g., "1.5 GB")
- `to_numAbbr(n)` / `from_siAbbr(str)` - SI abbreviations (e.g., "100m")
- `from_timeAbbr(str)` - Time abbreviation to ms (e.g., "12s")
- `format(val, 'fmt')` - Printf-style formatting
- `to_slon(obj)` / `from_slon(str)` - SLON conversion
- `to_json(obj)` / `from_json(str)` - JSON conversion
- `to_yaml(obj)` / `from_yaml(str)` - YAML conversion
- `to_csv(obj)` / `from_csv(str)` - CSV conversion
- `to_xml(obj)` / `from_xml(str)` - XML conversion
- `to_base64(str)` / `from_base64(str)` - Base64 conversion

**Array/Map manipulation:**
- `sort_by(arr, &field)` - Sort array of maps by field
- `group(arr, 'field')` - Group array by field value
- `group_by(arr, 'field1,field2')` - Multi-level grouping
- `count_by(arr, 'field')` - Count by field value
- `unique(arr)` - Deduplicate
- `reverse(arr)` - Reverse array
- `flat_map(map)` - Flatten map
- `keys(obj)` / `values(obj)` - Get keys/values
- `merge(a, b)` - Merge maps
- `amerge(a, b)` - Merge with array support
- `delete(map, 'field')` - Remove a field
- `insert(map, 'field', value)` - Add a field
- `to_map(arr, 'field')` - Array to map using field as key
- `a4m(arr, 'key', dontRemove)` - Array for map conversion
- `m4a(obj, 'key')` - Map for array conversion
- `k2a(map, 'regex', 'outkey', removeEmpties)` - Keys to array by regex match
- `search_keys(arr, 'text')` - Search by key name
- `search_values(arr, 'text')` - Search by value

**Conditional/Control:**
- `if(cond, then, else)` - Conditional
- `nvl(field, default)` - Null coalesce
- `not_null(a, b, ...)` - First non-null value

**Counter/State:**
- `inc('name')` / `dec('name')` / `getc('name')` - Counters
- `set(obj, 'path')` / `get('nameOrPath')` - Store/retrieve values
- `setp(obj, 'path', 'name')` / `geta('name', idx)` - Named store/retrieve

**Ranges:**
- `range(size)` - Array [1..size]
- `ranges(size, start, step)` - Custom range array

**Template:**
- `t(obj, 'template')` - Apply Handlebars template
- `tF(obj, 'template')` - Apply template with OpenAF helpers

**Other useful:**
- `progress(value, max, min, size, indicator, space)` - ASCII progress bar
- `oafp('(options)')` - Recursive oafp call
- `oafpd(data, '(options)')` - Recursive oafp with data
- `env('VAR')` - Get environment variable
- `semver(ver, op, arg)` - Semantic version operations
- `sh(cmd, stdin)` - Execute shell command

### SQL Filter (`sql=`)

Standard SQL syntax. The table is implicitly `_TMP`. Column names with special characters need double quotes.

```bash
# Select and order
sql="select name, status order by name"

# Aggregate
sql="select category, count(1) as total group by category"

# Filter
sql="select * where status = 'Running'"

# Column names with spaces or special chars
sql="select \"Column Name\", count(1) group by \"Column Name\""
```

### nLinq Filter (`from=`)

OpenAF's functional query language, useful for chaining operations:

```bash
# Limit results
from="limit(5)"

# Sort
from="sort(name)"

# Filter and sort
from="equals(status,'Running').sort(name)"

# Select specific fields
from="select(name,status)"

# Multiple conditions
from="greater(age,18).less(age,65).sort(name)"
```

---

## Common Patterns and Recipes

### 1. Reading and Converting Formats

```bash
# JSON to YAML
oafp file=data.json out=yaml

# YAML to JSON
oafp file=config.yaml out=json

# CSV to JSON
oafp file=data.csv out=json

# JSON to CSV
oafp file=data.json path="items" out=csv

# XML to JSON (e.g., RSS feed)
curl -s https://blog.google/rss | oafp out=json

# JSON to XML
oafp file=data.json out=xml

# JSON to Excel
oafp file=data.json path="items" out=xls xlsfile=output.xlsx

# Excel to JSON
oafp file=input.xlsx in=xls out=json

# INI to JSON
oafp file=config.ini in=ini out=json

# Markdown to colored display
oafp file=README.md in=md

# JSON to Markdown table
oafp file=data.json path="items" out=mdtable

# TOML to YAML
oafp file=config.toml in=toml out=yaml
```

### 2. Piping Command Output

```bash
# Docker containers as table
docker ps --format json | oafp in=ndjson ndjsonjoin=true out=ctable

# kubectl pods as table
kubectl get pods -A -o json | oafp path="items[].{ns:metadata.namespace,name:metadata.name,status:status.phase}" out=ctable

# Parse command output line by line
ls -la | oafp in=lines linesjoin=true linesvisual=true out=ctable

# Using cmd= to execute a command
oafp cmd="docker ps --format json" in=ndjson ndjsonjoin=true out=ctable

# curl JSON API directly
oafp url="https://api.github.com/repos/openaf/openaf/releases" path="[].{name:name,date:published_at}" out=ctable
```

### 3. Filtering and Querying Data

```bash
# JMESPath: select specific fields
oafp file=data.json path="items[].{name:name,status:status}"

# JMESPath: filter array
oafp file=data.json path="items[?status=='active']"

# SQL: aggregate query
oafp file=data.json path="items" sql="select category, count(1) total group by category" out=ctable

# SQL: filter and order
oafp file=data.json path="items" sql="select * where price > 100 order by price desc" out=ctable

# Combine path and sql
curl -s https://api.example.com/data | oafp path="results[].{name:name,value:metrics.value}" sql="select * order by value desc" out=ctable
```

### 4. Transforming Data

```bash
# Flatten nested maps
oafp file=data.json flatmap=true out=ctree

# Convert map to array
oafp file=data.json maptoarray=true out=ctable

# Remove null values
oafp file=data.json removenulls=true

# Correct types (strings to numbers where possible)
oafp file=data.csv in=csv correcttypes=true out=json

# Sort map keys
oafp file=data.json sortmapkeys=true

# Merge array of maps
oafp file=data.json path="configs" merge=true

# Custom JS transform on each record
oafp file=data.json path="items" xrfn="args.fullName=args.first+' '+args.last; return args" out=ctable

# Custom JS transform on entire data
oafp file=data.json xfn="args.total=args.items.length; return args"
```

### 5. Working with Text/Lines

```bash
# Parse structured text (e.g., with visual column detection)
ps aux | oafp in=lines linesvisual=true linesjoin=true out=ctable

# Parse each line with custom logic
cat syslog | oafp in=raw path="split(trim(@),'\n').map(&split(@,' ').{date:[0],host:[3],msg:join(' ',[4:])},[])" out=ctable

# Process delimited text as CSV
cat data.txt | oafp in=csv inputcsv="(withDelimiter: '|')" out=ctable

# Convert text lines to array
cat file.txt | oafp in=lines linesjoin=true out=json
```

### 6. AI/LLM Integration

```bash
# Set up model (environment variable)
export OAFP_MODEL="(type: openai, model: gpt-4, key: sk-..., timeout: 900000)"
# Or for Ollama:
export OAFP_MODEL="(type: ollama, model: llama3, url: 'http://localhost:11434')"

# Generate data from prompt
echo "list 10 countries with population and capital" | oafp in=llm out=json > data.json

# Transform existing data with LLM
oafp file=data.json llmprompt="add a continent field to each country" out=json

# Summarize data
oafp file=report.json llmprompt="summarize the key findings" out=md

# Ask about data with context
oafp file=data.json llmcontext="sales data for Q1 2024" llmprompt="what are the top trends?" out=md
```

### 7. Database Operations

```bash
# Query a database
echo "SELECT * FROM users WHERE active=1" | oafp in=db indbjdbc="jdbc:h2:./mydb" indbuser=sa indbpass=sa out=ctable

# Store JSON data into a database table
oafp file=data.json out=db dbjdbc="jdbc:h2:./mydb" dbuser=sa dbpass=sa dbtable=mytable

# Generate SQL INSERT statements from JSON
oafp file=data.json path="items" out=sql sqltable=items
```

### 8. Looping and Monitoring

```bash
# Monitor with refresh every 5 seconds
oafp cmd="kubectl get pods -A -o json" path="items[].{name:metadata.name,status:status.phase}" out=ctable loop=5

# Chart with real-time data
oafp cmd="curl -s http://api.example.com/metrics" out=chart chart="dec2 value:blue:metric -min:0" loop=5 loopcls=true

# Dashboard grid
oafp cmd="curl -s http://api.example.com/stats" out=grid grid="[[(title:CPU,type:chart,obj:'dec2 cpu:red:usage -min:0 -max:100')|(title:Memory,type:chart,obj:'bytes memory:blue:used -min:0')]]" loop=5
```

### 9. File Operations

```bash
# List files in directory
oafp in=ls data="." out=ctable

# List files recursively
oafp in=ls data="." lsrecursive=true out=ctable

# List contents of zip/tar
oafp in=ls file=archive.zip out=ctable

# Write output to file
oafp file=data.json out=csv outfile=output.csv

# Append to file
oafp file=data.json out=ndjson outfile=log.ndjson outfileappend=true
```

### 10. Comparing Data (Diff)

```bash
# Compare two paths in the same data
oafp file=data.json diff="(a: old_config, b: new_config)" color=true

# Compare with line numbers
oafp file=data.json diff="(a: before, b: after)" diffnlines=true color=true
```

### 11. Inline Data

```bash
# Provide data directly (JSON)
oafp data="[{\"name\":\"Alice\",\"age\":30},{\"name\":\"Bob\",\"age\":25}]" out=ctable

# Provide data directly (SLON - easier to type)
oafp data="[(name: Alice, age: 30)|(name: Bob, age: 25)]" in=slon out=ctable

# Use data= for simple values
oafp data="[1,2,3,4,5]" path="sum(@)"
```

### 12. Chaining oafp Calls (Unix Pipes)

```bash
# Multi-step processing
curl -s https://api.example.com/data | oafp path="results" out=json | oafp sql="select * where value > 100" out=ctable

# Using the pipe option (alternative to Unix pipes)
oafp file=data.json path="items" out=json pipe="(sql: 'select name, count(1) total group by name', out: ctable)"
```

### 13. Template Output

```bash
# Inline template
oafp file=data.json path="items" out=template templatetmpl=true template="{{#each this}}Name: {{name}}, Age: {{age}}\n{{/each}}"

# Template file
oafp file=data.json out=template template=report.hbs

# Template with OpenAF helpers
oafp file=data.json out=template templatetmpl=true template="{{#each this}}{{$acolor 'GREEN' name}}: {{$f '%05d' age}}\n{{/each}}"
```

### 14. Environment Variable Output

```bash
# Export data as env variables
eval $(oafp file=config.json out=envs)

# Custom prefix
oafp file=config.json out=envs envsprefix="APP_"
```

---

## Important Rules for Command Generation

### Quoting and Escaping

1. **Option values with spaces or special chars** need shell quoting:
   ```bash
   oafp file=data.json sql="select name, count(1) group by name" out=ctable
   ```

2. **JMESPath backtick literals** for numbers in path expressions:
   ```bash
   path="items[?age > \`18\`]"
   ```

3. **Double quotes inside SQL** need escaping for column names with spaces:
   ```bash
   sql="select \"Column Name\" from data"
   ```

4. **Single quotes inside path** for string comparisons:
   ```bash
   path="items[?status=='active']"
   ```

### Option Naming

- `in=` / `input=` - Both work for input type
- `out=` / `output=` - Both work for output format
- Options use `=` with no spaces: `out=ctable` not `out = ctable`

### Common Gotchas

1. **Arrays vs Maps**: `ctable` and `csv` only work with arrays. Use `path=` to select the array first.
2. **Auto-detection**: Input type is auto-detected. Only specify `in=` when auto-detection fails.
3. **SQL column quoting**: Always double-quote column names in SQL that contain special characters, spaces, or are case-sensitive.
4. **Default output**: The default output is `ctree` (colored tree).
5. **ndjson needs join**: When reading ndjson to get an array, use `ndjsonjoin=true`.
6. **Lines visual**: For visually-formatted command output (columns separated by spaces), use `in=lines linesvisual=true linesjoin=true`.
7. **File from stdin**: If no `file=`, `cmd=`, `data=`, or `url=` is provided, input comes from stdin.

### Choosing the Right Approach

| Goal | Approach |
|------|----------|
| Select specific fields | `path="[].{alias:original, ...}"` |
| Filter rows | `path="[?condition]"` or `sql="select * where ..."` |
| Sort data | `path="sort_by(@, &field)"` or `sql="select * order by field"` |
| Aggregate/Group | `sql="select field, count(1) group by field"` |
| Limit rows | `from="limit(10)"` or `sql="select * limit 10"` |
| Rename fields | `path="[].{newName:oldName}"` |
| Convert format | Use `in=` and `out=` |
| Transform values | Use path functions or `xfn=`/`xrfn=` |
| Flatten nested | `flatmap=true` or `path=` to select nested data |
| Parse text output | `in=lines linesvisual=true linesjoin=true` |

---

## Real-World Example Patterns

### API Data Processing
```bash
# GitHub releases table
curl -s https://api.github.com/repos/openaf/openaf/releases | oafp path="[].{name:name,tag:tag_name,date:published_at}" sql="select * order by date desc" out=ctable

# NASA asteroids
curl "https://api.nasa.gov/neo/rest/v1/feed?API_KEY=DEMO_KEY" | oafp path="near_earth_objects" maptoarray=true out=json | oafp path="[0][].{name:name,magnitude:absolute_magnitude_h,hazardous:is_potentially_hazardous_asteroid}" out=ctable
```

### System Administration
```bash
# Docker containers
oafp cmd="docker ps --format json" in=ndjson ndjsonjoin=true path="[].{id:ID,name:Names,state:State,image:Image}" out=ctable

# Kubernetes pods with restarts and age
kubectl get pods -A -o json | oafp path="items[].{ns:metadata.namespace,name:metadata.name,status:status.phase,restarts:sum(status.containerStatuses[].restartCount),age:timeago(status.startTime)}" sql="select * order by ns,name" out=ctable

# Parse /etc/passwd
oafp cmd="cat /etc/passwd" in=csv inputcsv="(withDelimiter: ':')" path="[].{user:f0,uid:to_number(f2),gid:to_number(f3),home:f5,shell:f6}" from="sort(uid)" out=ctable

# Disk usage
df -h | tail -n +2 | oafp in=lines linesjoin=true linesvisual=true out=ctable

# Process list
ps aux | oafp in=lines linesvisual=true linesjoin=true out=ctable
```

### AWS
```bash
# EC2 instances
aws ec2 describe-instances | oafp path="Reservations[].Instances[].{name:join('',Tags[?Key=='Name'].Value),type:InstanceType,vpc:VpcId,ip:PrivateIpAddress}" sql="select * order by vpc" out=ctable
```

### Data Conversion Pipelines
```bash
# JSON to ndjson
find /some/data -name "*.json" -exec oafp {} output=json \; > data.ndjson

# Build Excel from multiple sources
oafp file=data1.json path=items out=xls xlsfile=report.xlsx xlssheet=Sheet1 xlsopen=false
oafp file=data2.json path=results out=xls xlsfile=report.xlsx xlssheet=Sheet2 xlsopen=false

# Convert RSS to markdown table
curl -s https://blog.google/rss | oafp path="rss.channel.item[].{title:title,date:pubDate}" out=mdtable
```

### Network and Diagnostics
```bash
# Public IP info
curl -s https://ifconfig.co/json | oafp flatmap=true out=map

# DNS lookup
curl -s "https://8.8.8.8/resolve?name=example.com&type=a" | oafp path="Answer" out=ctable

# Cloudflare trace
curl -s https://1.1.1.1/cdn-cgi/trace | oafp in=ini out=ctree
```

---

## Parameter File (-f)

For complex commands, use a YAML/JSON/SLON parameter file:

```yaml
# params.yaml
file: data.json
path: "items[].{name:name,value:metrics.value}"
sql: "select * where value > 100 order by value desc"
out: ctable
```

```bash
oafp -f params.yaml
```

Or pipe it:

```yaml
# pipeline.yaml
data:
  set: [1, 2, 3]
path: "set[].{ x: @ }"
out: json
pipe:
  isql: "SELECT sum(\"x\") \"SUM\""
  opath: "[0].SUM"
```

```bash
cat pipeline.yaml | oafp -f -
```

## Version and Discovery

```bash
# Show version info
oafp -v

# List available inputs
oafp in="?"

# List available outputs
oafp out="?"

# List available transforms
oafp transforms=true

# Show help
oafp -h

# Search examples
oafp examples=kubernetes
oafp examples=docker::
```
