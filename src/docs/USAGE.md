# OpenAF processor
    
**Usage**: _oafp [file] [options]_

Takes an input, usually a data structure such as json, and transforms it to an equivalent data structure in another format or visualization. The output data can be filtered through JMESPath, SQL or OpenAF's nLinq and provided transformers can also be applied to it.

> If a _file_ or _file=somefile_ or _file=zipfile::somefile_ is not provided the input will be expected to be provided through stdin/pipe.
> Options are expected to be provided as _option=value_. Check the lists below for all the available options.
> Use `-v` or `in="?"` and `out="?"` to discover supported inputs, transforms and outputs.

## Main options:

| Option | Description | 
|--------|-------------|
| -h     | Show this document |
| help   | Alternative way to show this document or others (e.g. filters, template) |
| file   | The file to parse (if not provided stdin is used) |
| cmd    | Alternative to file and stdin to execute a command (e.g. kubectl, docker) to get the file contents |
| data   | Alternative to file, stdin and cmd to provide data input |
| out    | The output format (default: ctree) |
| in     | The input type (if not provided it will try to be auto-detected) |
| ifrom | An OpenAF nLinq expression to filter input data |
| isql | A SQL expression to filter input data |
| from   | An OpenAF nLinq path expression to filter output |
| sql    | A SQL expression to filter output |
| opath | A JMESPath expression to filter output data |
| sqlfilter | Enables the forcing of the sql filter parser (values: auto, simple, advanced) |
| sqlfiltertables | A JSON/SLON array composed of 'table' name and 'path' to each table's data to be used with the sqlfilter |
| path   | A JMESPath expression to filter output |
| csv    | If type=csv, the CSV options to use | 
| outkey | If defined the map/list output will be prefixed with the provided key |
| outfile | If defined all output will be written to the provided file |
| outfileappend | If 'true' and outfile=true the output will be appended on the provided file |
| parallel | If 'true' and input supports parallel processing it will try to process the input in parallel disregarding input order |
| pause  | If 'true' will try to pause contents in alternative to _less -r_ |
| color  | If 'true' will force colored output if available |
| url    | Retrieves data from the provided URL |
| urlmethod | If 'url' is provided defines the http method to use if different from GET | 
| urlparams | If 'url' is provided extra parameters (equivalent to OpenAF's $rest) can be provided in JSON/SLON |
| urldata | If 'url' is provided a JSON/SLON/text data can be provided | 
| insecure | If true will ignore SSL/TLS certificate validation |
| chs | A JSON/SLON map or array composed of an OpenAF channel 'name', 'type' and optional 'options' |
| loop   | If defined will loop the processing by the number of seconds provided |
| loopcls | If 'true' and loop is defined it will clear the screen (or file) on each loop cycle |
| libs | Comma delimited list of installed OpenAF's oPacks to consider to extend oafp's inputs, transformations and outputs | 
| pipe | A JSON/SLON/YAML map for recursive call of oafp similar to using unix pipes (useful with -f) |
| -f | Enables to provide a JSON/SLON/YAML file with all the oafp parameters as a map |
| -examples | Will access an internet based list of oafp examples and list them |
| examples | Will search the provided keyword or 'category::subcategory' in the internet based list of oafp examples |
| version | Alternative way to change the input to a map with the tool's version |
| -v | Changes the input to a map with the tool's version info |
| debug | If true prints debugging messages |

> Filter options apply in the following order: _path_, _from_ and _sql_.

> For _path_ syntax check https://jmespath.org/tutorial.html

> You can list inputs by using _in="?"_; outputs by _out="?"_; transforms by _transforms=true_

> _sqlfilterstable_ assumes and forces _sqlfilter=advanced_

> Use 'OAFP_RESET=true' to force resetting the terminal before waiting for input or displaying an output (use this if you experience terminal related issues)

> Use 'OAFP_CODESET=UTF-16' to force reading files in a different codeset (e.g. UTF-16) different from the default UTF-8.

---

## ⬇️  Input types

List of data input types that can be auto-detected (through the file extension or through its contents). You can always override it by using the _in_ option:

| Input type | Description |
|------------|-------------|
| ask | Interactively asks questions to an user (using JSON/SLON for OpenAF's askStruct) |
| base64 | A base64 text format |
| ch | An OpenAF channel format |
| csv | A CSV format (auto-detected) |
| db | A JDBC query to a database |
| gb64json | Equivalent to in=base64 and base64gzip=true |
| hsperf | A Java hsperfdata* file (requires file=hsperfdata_user/123) |
| ini | INI/Properties format |
| javas | Tries to list java processes running locally (javainception=true to include itself) |
| javagc | The Java GC log lines text format |
| javathread | The Java Thread stack dump lines text format |
| jfr | The Java Flight Recorder format |
| jmx | Uses Java JMX to retrieve data from another Java process |
| json | A JSON format (auto-detected) |
| jsonschema | Given a JSON schema format tries to generate sample data for it |
| jwt | Decodes and/or verifies a JSON Web Token (JWT) |
| lines | A given string/text to be processed line by line |
| llm | A large language model input (uses 'llmenv' or 'llmoptions') |
| llmmodels | Lists the large language models available (using 'llmenv' or 'llmoptions') |
| ls | Returns a list of files and folders for a given directory path or zip or tar or tgz file |
| md | A Markdown format |
| mdtable | A Markdown table format |
| mdcode | A Markdown code blocks format |
| ndjson | A NDJSON (new-line delimited JSON) format |
| ndslon | A NDSLON (new-line delimited SLON) format |
| oaf | Takes an OpenAF scripting code or OpenAF scripting file to execute and use the result as input |
| oafp | Takes a JSON/SLON/YAML map input as parameters for calling a sub oafp process (arrays will call multiple oafp processes; inoafpseq=true will process sequentially) |
| ojob | Takes a JSON/SLON/YAML map input with a 'ojob' string and a 'args' map parameter |
| openmetrics | An OpenMetrics/Prometheus compatible format |
| raw | Passes the input directly to transforms and output |
| rawhex | Tries to read the input char by char converting into lines with the hexadecimal representation |
| sh | Executes a shell command returning stdout, stderr and exitcode as a map |
| slon | A SLON format (auto-detected) |
| snmp | A SNMP device source |
| sql | One or more SQLs statements to AST (Abstract Syntax Tree) or beautified SQL |
| toml | TOML format |
| xls | A XLSx compatible file (requires file=abc.xlsx) |
| xml | An XML format (auto-detected) |
| yaml | A YAML format (auto-detected) |

---

## 🚜 Optional transforms:

These options will change the parsed input data included any filters provided.

| Option | Type | Description |
|--------|------|-------------|
| arraytomap | Boolean | If true will try to convert the input array to a map (see arraytomapkey, arraytomapkeepkey) |
| arraytomapkeepkey | Boolean | If true and arraytomap=true the defined arraytomapkey won't be removed from each map |
| arraytomapkey | String | For arraytomap=true defines the name of the map property that will be each element key (see arraytomapkeepkey) |
| allstrings | Boolean | If true will try to convert all values to strings |
| cmlt | Boolean | If true will accumulate the input values into an output array (useful with loop) |
| correcttypes | Boolean | If true will try to convert alpha-numeric field values with just numbers to number fields, string date fields to dates and boolean fields |
| denormalize | String | Reverses 'normalize' given a JSON/SLON map with a normalize schema (see OpenAF's ow.ai.normalize.withSchema) |
| diff | String | A JSON/SLON map with a 'a' path and a 'b' path to compare and provide diff data |
| field2byte | String | A comma delimited list of fields whose value should be converted to a byte abbreviation |
| field2date | String | A comma delimited list of fields whose value should be converted to date values |
| field2si | String | A comma delimited list of fields whose value should be converted to a SI abbreviation |
| field2str | String | A comma delimited list of fields whose value should be converted to a string representation |
| field4map | Boolean | A comma delimited list of fields whose value should be converted from JSON/SLON string representation to a map |
| flatmap | Boolean | If true a map structure will be flat to just one level (optionally flatmapsep=[char] to use a different separator that '.') |
| getlist | Number | If true will try to find the first array on the input value (if number will stop only after the number of checks) |
| forcearray | Boolean | If true and if the input is a map it will force it to be an array with that map as the only element |
| jsonschema | String | The JSON schema file to use for validation returning a map with a boolean valid and errors if exist |
| jsonschemacmd | String | Alternative option to 'jsonschema' to retrieve the JSON schema data to use for validation returning a map with a boolean valid and errors if exist |
| jsonschemagen | Boolean | If true will taken the provided input map as an example to generate an output json schema |
| kmeans | Number | Given an array of 'normalized' data will cluster data into the number of centroids provided |
| llmcontext | String | If 'llmprompt' is defined provides extra context to the model regarding the input data |
| llmprompt | String | A large language model prompt to transform the input data to json (uses the same input options 'llmenv' and 'llmoptions') |
| maptoarray | Boolean | If true will try to convert the input map to an array (see maptoarraykey) |
| maptoarraykey | String | If maptoarray=true defines the name of the map property that will hold the key for each map in the new array |
| merge | Boolean | If input is a list/array of maps will merge each element into one map |
| normalize | String | A JSON/SLON map with a normalize schema (see OpenAF's ow.ai.normalize.withSchema) |
| numformat | String | For all number values applies a java.util.Formatter format (e.g. %,d) |
| oaf | String | An OpenAF scripting code or OpenAF scripting file to execute taking input as 'data' and returning the transformed data |
| regression | String | Performs a regression (linear, log, exp, poly or power) over a provided list/array of numeric values |
| removedups | Boolean | If true will try to remove duplicates from an array |
| removeempty | Boolean | If true will remove array/list entries that are either null or undefined |
| removenulls | Boolean | If true will try to remove nulls and undefined values from a map or array |
| searchkeys | String | Will return a map with only keys that match the provided string |
| searchvalues | String | Will return am map with only values that match the provided string |
| set | String | Performs set operations (intersection by default) over an 'a' and 'b' path to an array defined in a JSON/SLON map |
| sortmapkeys | Boolean | If true the resulting map keys will be sorted |
| spacekeys | String | Replaces spaces in keys with the provided string (for example, helpful for XML output) |
| trim | Boolean | If true all the strings of the result map/list will be trimmed |
| val2icon | String | If defined will transform undefined, null and boolean values to emoticons (values can be 'default' or 'simple') |
| xjs | String | A .js file with function code manipulating an input 'args'. Returns the transformed 'args' variable. |
| xpy | String | A .py file with Python function code manipulating an input 'args'. Returns the transformed 'args' variable. |
| xfn | String | A javascript code, receiving input as 'args' and return it's code evaluation. |
| xrjs | String | A .js file with function code to manipulate each input array record as 'args'. Returns the transformed 'args' record. |
| xrpy | String | A .py file with function code to manipulate each input array record as 'args'. Returns the transformed 'args' record. |
| xrfn | String | A javascript code, receiving each input array record as 'args' and return it's code evaluation. |

---

## ⬆️  Output formats

List of available formats to use with the _output_ option:

| Output format | Description |
|---------------|-------------|
| base64 | A base64 text format |
| ch | An OpenAF channel format |
| chart | A line-chart style chart (useful together with 'loop') |
| cjson | A JSON forcely colored format |
| cmd | Executes a command for each input data entry |
| cslon | A SLON format forcely colored |
| csv | A CSV format (only for list outputs) |
| ctable | A table-like forcely colored format (only for list outputs) |
| ctree | A tree-like forcely colored format |
| cyaml | An YAML colored format |
| db | Output to a JDBC database |
| envs | Tries to output the input data as OS environment variables setting commands |
| gb64json | Equivalent to out=base64 and base64gzip=true |
| grid | A multiple output ascii grid (useful together with 'loop') |
| html | An HTML format |
| ini | A INI/Properties format (arrays are not supported) |
| json | A JSON format without spacing |
| jwt | Signs map data into a JSON Web Token (JWT) |
| key | Stores data into an OpenAF global (used inside OpenAF) |
| lines | Given an array of strings prints each line |
| log | If input has Logstash compatible fields outputs a human-readable log |
| map | A rectangle map format |
| md | A Markdown format |
| mdtable | A Markdown table format (only for list outputs) |
| mdyaml | A multi document YAML format (only for list outputs) |
| ndjson | A NDJSON (new-line delimited JSON) format |
| ndslon | A NDSLON (new-line delimited SLON) format |
| openmetrics | Converts a map or list to OpenMetrics/Prometheus compatible format |
| oaf | An OpenAF scripting code or OpenAF scripting file (together with 'outoaf') to execute taking input transformed as 'data' |
| pjson | A JSON format with spacing (equivalent to prettyjson) |
| prettyjson | A JSON format with spacing |
| pxml | Tries to output the input data into pretty xml |
| raw | Tries to output the internal representation (string or json) of the input transformed data |
| res | Outputs data to an OpenAF global 'res' (used in oJobs) | 
| schart | A static line-chart like chart (for a fixed list/array of values) |
| slon | A SLON format |
| sql | Outputs a series of SQL statements for an input list/array data |
| stable | A table-like format with separation (only for list outputs) |
| table | A table-like format without size constraints (only for list outputs) |
| template | A Handlebars template format |
| text | A string text format |
| toml | A TOML format (arrays will have outkey=list) |
| tree | A tree-like format |
| xls | A XLSx output format |
| xml | An XML format |
| yaml | A YAML format |

> For 'template' check https://docs.openaf.io/docs/guides/oafp/oafp-template.html

> For 'log' you can use 'logtheme' or the environment variable 'OAFP_LOGTHEME' with a JSON/SLON map with the colors to use '(errorLevel: red, warnLevel: yellow, timestamp: bold)'

---

## ⬇️  Input options

---

### 🧾 CH input options

List of options to use when _in=ch_:

| Option | Type | Description |
|--------|------|-------------|
| inch   | String | A JSON/SLON configuration string with type and options/url |
| inchall | Boolean | A boolean flag to determine if the input map will be used for a getAll query |

> Example of options provided in JSON: inch="{type:'mvs',options:{file:'data.db'}}"
> Example of options provided in SLON: inch="(type: remote, url: 'http://some.host:1234/chname')"

The input data can be JSON/SLON/YAML and will be used for the 'get' or 'getAll' query.

> You can use sBuckets variables (e.g. secKey, secRepo, secBucket, secPass, secMainPass, secFile) on the 'options' map to fill it.

---

### 🧾 DB input options

List of options to use when _in=db_ (SQL query):

| Option | Type | Description |
|--------|------|-------------|
| indbjdbc | String | The JDBC URL to access the input database |
| indbuser | String | The JDBC access user |
| indbpass | String | The JDBC access password |
| indbtimeout | String | The JDBC access timeout |
| indblib | String | Use a JDBC driver oPack generated by ojob.io/db/getDriver |
| indbstream | Boolean | If true the output will be processed record by record |
| indbexec | Boolean | If true the input SQL is not a query but a DML statement | 
| indbautocommit | Boolean | If true the input SQL will be executed with autocommit enabled |
| indbdesc | Boolean | If true the output will be a list of column names and types (use 'LIMIT 1' for faster results) |

> JDBC oracle: jdbc:oracle:thin:@[host]:[port]:[database]
> JDBC postgreSQL: jdbc:postgresql://[host]:[port]/[database]
> JDBC H2: jdbc:h2:[file]   

---

### 🧾 DSV input options

List of options to use when _in=dsv_:

| Option | Type | Description |
|--------|------|-------------|
| indsvsep | String | The separator to use (default is ',') |
| indsvsepre | String | The regular expression to use as separator |
| indsvquote | String | The quote character to use (default is '"') |
| indsvescape | String | The escape character to use for double-quotes |
| indsvcomment | String | The comment character to use (default is '#') |
| indsvheader | Boolean | If true will try to use the first line as header (default is true) |
| indsvtrim | Boolean | If true will trim all values (default is true) |
| indsvjoin | Boolean | If true it will return an array with each processed line |
| indsvfields | String | Comma separated list of fields to use as header (overrides indsvheader) |

> Support parallel=true if indsvjoin=false or not defined

---

### 🧾 JavaGC input options

List of options to use when _in=javagc_:

| Option | Type | Description |
|--------|------|-------------|
| javagcjoin | Boolean | If true it will return an array with each processed line. |

---

### 🧾 JavaThread input options

List of options to use when _in=javathread_:

| Option | Type | Description |
|--------|------|-------------|
| javathreadpid | Number | Optional you can provider the local java process pid to try to get the thread stack trace (*) |

> (*) This requires running openaf/oafp with a Java JDK. Keep in mind that it will interrupt the target application to dump the necessary data.

> You can extract the input text data by executing ```kill -3 pid```

---

### 🧾 JFR input options

List of options to use when _in=jfr_:

| Option | Type | Description |
|--------|------|-------------|
| jfrjoin | Boolean | If true will join the JFR records to build an output array |
| jfrdesc | Boolean | If true it will include a __desc_ entry with the JFR event description |

---

### 🧾 JMX input options

List of options to use when _in=jmx_:

| Option | Type | Description |
|--------|------|-------------|
| jmxpid | Number | The local java process pid to connect to if 'jmxurl' is not provided. |
| jmxurl | String | The JMX URL to connect to if 'jmxpid' is not provided. |
| jmxuser | String | The JMX user to use if JMX URL was provided. |
| jmxpass | String | The JMX password to use if JMX URL was provided. |
| jmxprovider | String | The JMX provider Java class if JMX URL was provided. |
| jmxop | String | The operation to perform (see below for options) |

Options available to use with 'jmxop':

| Op | Description |
|----|-------------|
| all | Tries to retrieve all JMX data available. |
| domains | Retrieves just a list of JMX domains available. |
| query | Performs a JMX query from the input data provided (e.g. java.lang:*) |
| get | Retrieves a specific JMX object (e.g. java.lang:type=Memory) |

---

### 🧾 JSON input options

List of options to use when _in=json_:

| Option | Type | Description |
|--------|------|-------------|
| jsondesc | Boolean | If true the output will be a list of JSON paths of the original json.  |
| jsonprefix | String | Given the 'jsondesc=true' output list you can use each to filter big json files by prefix. |

---

### 🧾 JWT input options

List of options to use when _in=jwt_:

| Option | Type | Description |
|--------|------|-------------|
| injwtverify | Boolean | If true the boolean entry '__verified' will be added to the result. |
| injwtsecret | String | A string secret for using HS256, HS384 or HS512 depending on secret size used to verify. |
| injwtpubkey | String | A public key file used to verify (might require specifying the injwtalg). |
| injwtalg | String | Specifies the algorithm used to verify the JWT (HS* or RSA by default). Depends on available algorithms on the current JVM. |
| injwtraw | Boolean | If true it won't try to convert Unix epoch timestamps to dates. |

---

### 🧾 Lines input options

List of options to use when _in=lines_:

| Option | Type | Description |
|--------|------|-------------|
| linesjoin | Boolean | If true it will return an array with each processed line |
| linesvisual | Boolean | If true it will try to determine header and column position from spaces and tabs |
| linesvisualsepre | String | Regular expression representing the separator between columns when linesvisual=true (defaults to ' \\s+') | 
| linesvisualheadsep | Boolean | If true will try to process the second line as header separator aiding on column position determination (if linesvisualsepre is not defined it will default to '\\s+') |

> Supports parallel=true if linesjoin=false or not defined

---

### 🧾 LS input options

List of options to use when _in=ls_:

| Option | Type | Description |
|--------|------|-------------|
| lsext | String | Forces the file format parsing of the provided path or file (between zip, tar, tgz) |
| lsrecursive | Boolean | Will list all files and folders recursively (for folders) |
| lsposix | Boolean | Tries to add extra posix data if available (for ZIP files) |

---

### 🧾 MDTable input options

List of options to use when _in=mdtable_:

| Option | Type | Description |
|--------|------|-------------|
| inmdtablejoin | Boolean | Scans an entire markdown input for tables and returns an array with the data of each markdown table |

---

### 🧾 ndJSON input options

List of options to use when _in=ndjson_:

| Option | Type | Description |
|--------|------|-------------|
| ndjsonjoin | Boolean | If true will join the ndjson records to build an output array |
| ndjsonfilter | Boolean | If true each line is interpreted as an array before filters execute (this allows to filter json records on a ndjson) |

> Supports parallel=true if ndjsonjoin=false or not defined

---

### 🧾 ndSLON input options

List of options to use when _in=ndslon_:

| Option | Type | Description |
|--------|------|-------------|
| ndslonjoin | Boolean | If true will join the ndslon records to build an output array |
| ndslonfilter | Boolean | If true each line is interpreted as an array before filters execute (this allows to filter slon records on a ndslon) |

> Supports parallel=true if ndslonjoin=false or not defined

---

### 🧾 RAWHEX input options

List of options to use when _in=rawhex_:

| Option | Type | Description |
|--------|------|-------------|
| inrawhexline | Number | Number of hexadecimal characters per returned array line | 

---

### 🧾 SH input options

List of options to use when _in=sh_:

| Option | Type | Description |
|--------|------|-------------|
| inshformat | String | The format to parse stdout and stderr between raw, yaml or json (default) |

The input data JSON/SLON/YAML map can be composed of:

* cmd (mandatory string/array) - the command to execute
* envs (map) - a series of environment variables to use
* envsall (boolean) - if true all existing environment variables will also be included
* prefix (string) - if defined will output to the console stdout/stderr with the provided prefix
* pwd (string) - the command path working directory

---

### 🧾 SNMP input options

List of options to use when _in=snmp_:

| Option | Type | Description |
|--------|------|-------------|
| insnmp | String | A SNMP address in the form 'udp://1.2.3.4/161' |
| insnmpcommunity | String | The SNMP community to use (default 'public') |
| insnmptimeout | Number | The timeout to wait for a reply |
| insnmpretries | Number | Number of retries in case of failure |
| insnmpversion | Number | Version of the SNMP server (e.g. 2, 3) |
| insnmpsec     | String | A JSON/SLON representation of security attributes (see below) |

The input data can be either:

  * A single string with an OID
  * Multiple lines each with just an OID
  * A JSON/SLON/YAML array of OID strings
  * A JSON/SLON/YAML map with OID string values

The 'insnmpsec' (in case of version 3 or newer) entry should be a JSON/SLON map with:

| Entry | Description |
|-------|-------------|
| securityName | The security name to use |
| authProtocol | One of: HMAC128SHA224, HMAC192SHA256, HMAC256SHA384, HMAC384SHA512, MD5, SHA |
| privProtocol | One of: 3DES, AES128, AES192, AES256, DES |
| authPassphrase | The authorization passphrase to use |
| privPassphrase | The private passphrase to use |
| engineId | The engine id in hexadecimal format |

---

### 🧾 SQL input options

List of options to use when _in=sql_:

| Option | Type | Description |
|--------|------|-------------|
| sqlparse | Boolean | If true instead of returning a SQL AST representation it will beautify the SQL statement(s) | 
| sqloptions | String | A JSON/SLON map with options for sqlparse=true |

SQL options available:

* indent: the indentation string (defaults to "  ")
* uppercase: if true will uppercase the SQL (defaults to false)
* linesBetweenQueries: number of lines between queries (defaults to 1)
* maxColumnLength: maximum column length (defaults to 50)
* skipWhitespaceNearBlockParentheses: if true will whitespace near block parentheses (defaults to false)
* language: the SQL language dialect (Db2, MariaDb, MySql, N1ql, PlSql, PostgreSql, Redshift, SparkSql, StandardSql and TSql)

---

### 🧾 XLS input options

List of options to use when _in=xls_:

| Option | Type | Description |
|--------|------|-------------|
| inxlssheet | String | The name of sheet to consider (default to the first sheet) |
| inxlsevalformulas | Boolean | If false the existing formulas won't be evaluated (defaults to true) |
| inxlsdesc | Boolean | If true, instead of retrieving data, either a list of sheet names will be returned, or, if inxlssheet is provided, a table with '___' of empty cells and '###' for non-empty cells will be returned |
| inxlscol | String | The column on the sheet where a table should be detected (e.g. "A") |
| inxlsrow | Number | The row on the sheet where a table should be detected (e.g. 1) |

### 🧾 XML input options

List of options to use when _in=xml_:

| Option | Type | Description |
|--------|------|-------------|
| xmlignored | String | A comma-separated list of XML tags to ignore |
| xmlprefix | String | A prefix to add to all XML tags |
| xmlfiltertag | Boolean | If true will filter the XML tags |

---

## ⬇️⬆️  Input/Output options

---

### 🧾 Base64 input/output options

List of options to use when _in=base64_ or _out=base64_:

| Option | Type | Description |
|--------|------|-------------|
| base64gzip | Boolean | If true the contents will thet gzip/gunzip respectively to reduce the size of the base64 output |

---

### 🧾 CSV input/output options

List of options to use with the _inputcsv_ input option (when input type=csv) and/or the _csv_ output option (when output=csv). Both expect the corresponding options to be provided in single JSON or SLON value (see below for example):

| Option | Type | Description |
|--------|------|-------------|
| format | String | You can choose between DEFAULT, EXCEL, INFORMIX_UNLOAD, INFORMIX_UNLOAD_CSV, MYSQL, RFC4180, ORACLE, POSTGRESQL_CSV, POSTGRESQL_TEXT and TDF |
| withHeader | Boolean | If true tries to automatically use the available header |
| withHeaders | Array | A list of headers to use with the corresponding order |
| quoteMode | String | You can choose between ALL, ALL_NON_NULL, MINIMAL, NON_NUMERIC and NONE. |
| withDelimiter | String | A single character as a custom delimiter  |
| withEscape | String | A single character as a custom escape |
| withNullString | String | String to use as representation of null values |

> Example of options provided in JSON: csv="{withHeader:false,withDelimiter:'|'}"
> Example of options provided in SLON: inputcsv="(withHeader: false, quoteMode: ALL)"

> You can also use _incsv_ as a shortcut for _inputcsv_

---

## 🚜 Transform options

---

### 🧾 CMLT transform options

List of options to use when _cmlt=true_:

| Option | Type | Description |
|--------|------|-------------|
| cmltch | String | A JSON/SLON OpenAF channel configuration string with type and options/url (defaults to simple) |
| cmltsize | Number | The number of input data values to keep (default 100). If -1 it will keep without a limit |

---

### 🧾 Diff transform options

List of options to use when _diff=..._:

| Option | Type | Description |
|--------|------|-------------|
| difftheme | String | A JSON/SLON map with the colors to use if color = true |
| diffnlines | Boolean | If true will append each line with a line number of the final result of the differences between 'a' and 'b' (just for rough reference) |
| diffwords | Boolean | If true and the input is text based will perform the diff at the word level | 
| diffwordswithspace | Boolean | If true and the input is text based will perform the diff at the word + spaces level |
| difflines | Boolean | If true and the input is text based will perform the diff at the lines level |
| diffsentences | Boolean | If true and the input is text based will perform the diff at the sentence level |
| diffchars | Boolean | If true and the input is text based will perform the diff at the char level |

> 'difftheme' example: "(added: GREEN, removed: RED, common: FAINT, linenum: ITALIC, linediv: FAINT, linesep: ':')"

> If color=true a visual colored diff will be output instead of an array of differences

> If both inputs are array based and color=false (or not provided) the comparison will be performed at the array elements level

> The contents of 'difftheme' can also be provided through the 'OAFP_DIFFTHEME' environment variable

---

### 🧾 LLM input/transform options

List of options to use when _in=llm_ or _llmprompt=..._:

| Option | Type | Description |
|--------|------|-------------|
| llmenv | String | The environment variable containing the value of 'llmoptions' (defaults to OAFP_MODEL) |
| llmoptions | String | A JSON or SLON string with OpenAF's LLM 'type' (e.g. openai/ollama), 'model' name, 'timeout' in ms for answers, 'url' for the ollama type or 'key' for openai type | 
| llmconversation | String | File to keep the LLM conversation |
| llmimage | String | For visual models you can provide a base64 image or an image file path or an URL of an image |

> OpenAF sBuckets are supported in llmoptions. You can set any of the environment variables OAFP_SECREPO, OAFP_SECBUCKET, OAFP_SECPASS, OAFP_SECMAINPASS and OAFP_SECFILE OR set the corresponding map values secRepo, secBucket, secPass, secMainPass and secFile.

> Tip: Use the 'getlist=' optional transform to automatically filter list of data from LLMs prompt responses if relevant.
> Example: `OAFP_MODEL="(type:ollama,model:llama3)" oafp llmprompt="hello world"`

---

### 🧾 Regression transform options

List of options to use when _regression=..._:

| Option | Type | Description |
|--------|------|-------------|
| regressionpath | String | The path to the array of y values for the regression formulas |
| regressionx | String | Optional path to the array of x values for the regression formulas (defaults to 1, 2, 3, ...) |
| regressionoptions | String | A JSON/SLON configuration with order (defaults to 2) and/or precision (defaults to 5) |
| regressionforecast | String | Optional path to an array of x values for which to forecast the corresponding y |

> Example: ```oafp data="[1,2,3]" regression=linear regressionforecast="from_slon('[4|5]')" out=ctable```

---

### 🧾 Set transform options

List of options to use when _set=..._:

| Option | Type | Description |
|--------|------|-------------|
| setop | String | Allows to choose a different set operation between 'union', 'diffa', 'diffb', 'diffab' (symmetric difference), 'diff' and 'intersect' (default) |

> Example: ```set="(a: old, b: new)" setop=diffb```
> 'setop=diff' will add an extra column '*' to identify if a line only exists in 'a' or in 'b'

---

## ⬆️  Output options

---

### 🧾 CH output options

List of options to use when _out=ch_:

| Option | Type | Description |
|--------|------|-------------|
| ch   | String | A JSON/SLON configuration string with type and options/url |
| chkey | String | A comma delimited list of map keys to build a key from each array value |
| chunset | Boolean | If true the input data will be used to unset data on the output channel instead of set |

> Example of options provided in JSON: ch="{type:'mvs',options:{file:'data.db'}}"
> Example of options provided in SLON: ch="(type: remote, url: 'http://some.host:1234/chname')"

> You can use sBuckets variables (e.g. secKey, secRepo, secBucket, secPass, secMainPass, secFile) on the 'options' map to fill it.

---

### 🧾 Chart output options

List of options to use when _out=chart_:

| Option | Type | Description |
|--------|------|-------------|
| chart  | String | Chart definition in the format "<unit> <path:color:legend>... [-min:0] [-max:100]". The 'unit' used should be either 'int', 'dec1', 'dec2', 'dec3', 'dec', 'bytes' or 'si'. The 'path' is equivalent to the 'path=' jmespath filter (quotes should be used for non-basic 'path' expressions; and '@' should be used for the current value). The 'color' should be one of the basic color names. The 'legend' should be the label of the value (in quotes if includes spaces) |
| chartcls | Boolean | If true the screen will be cleared for each execution |

Example: 
```oafp cmd="curl -s http://api.open-notify.org/iss-now.json" out=chart chartcls=true chart="dec3 iss_position.latitude:blue:lat iss_position.longitude:red:long" loop=5```

---

### 🧾 Cmd output options

List of options to use when _out=cmd_:

| Option | Type | Description |
|--------|------|-------------|
| outcmd | String | The command to execute receiving, in pipeline, each input entry in json |
| outcmdjoin | Boolean | If true and if input is an array the entire array will be the input entry |
| outcmdseq | Boolean | If true and if input is an array the commands will be executed in sequence |
| outcmdnl | Boolean | If true each command execution output will be appended with a new-line |
| outcmdparam | Boolean | If true the input entry will be replaced on the 'outcmd' where '{}' is found |
| outcmdtmpl | Boolean | If true the input entry will be considered as an HandleBars' template |

> If input is an array, without outcmdjoin=true, each entry will result in a command execution in parallel

---

### 🧾 DB output options

List of options to use when _out=db_:

| Option | Type | Description |
|--------|------|-------------|
| dbjdbc | String | The JDBC URL to access the input database |
| dbuser | String | The JDBC access user |
| dbpass | String | The JDBC access password |
| dbtimeout | String | The JDBC access timeout |
| dblib | String | Use a JDBC driver oPack generated by ojob.io/db/getDriver |
| dbtable | String | The db table in which should be inserted ('data' by default) | 
| dbnocreate | Boolean | If true no table creation command will be executed (if the table already exists set this to true) |
| dbicase | Boolean | If true table and field names will try to ignore case |
| dbbatchsize | Number | If defined it will changed the default batch data insert process | 

> You can use _out=sql_ to get a preview of the SQL statements the _db_ output type will use

> JDBC oracle: jdbc:oracle:thin:@[host]:[port]:[database]
> JDBC postgreSQL: jdbc:postgresql://[host]:[port]/[database]
> JDBC H2: jdbc:h2:[file]   

---

### 🧾 DSV output options

List of options to use when _out=dsv_:

| Option | Type | Description |
|--------|------|-------------|
| dsvsep | String | The separator to use (default is ',') |
| dsvquote | String | The quote character to use (default is '"') |
| dsvfields | String | Comma separated list of fields to use as header (overrides dsvheader) |
| dsvuseslon | Boolean | If true the output of value objects will be in SLON format (default is false) |
| dsvheader | Boolean | If true will try to output the first line as header (default is true) |
| dsvnl | String | Newline sequence to use (default is '\n') |

---

### 🧾 Envs output options

List of options to use when _out=envs_:

| Option | Type | Description |
|--------|------|-------------|
| envscmd | String | If defined will output the provided command to set each environment variable (defaults to 'export' or 'set' in Windows) |
| envsprefix | String | If defined uses the provided prefix for each environment variable key (defaults to '_OAFP_') |
| envsnoprefix | Boolean | Boolean flag to indicate that no envsprefix should be used (defaults to false) |

Example of a shell script using 'out=envs': 

```
#!/bin/sh
eval $(oafp -v out=envs)
echo Using OpenAF version: $_OAFP_openaf_version - $_OAFP_openaf_distribution
echo On the operating system: $_OAFP_os_name
```

> Setting envsprefix="" won't result in an empty prefix. Use envsnoprefix=true instead.

---

### 🧾 JWT output options

List of options to use when _out=jwt_:

| Option | Type | Description |
|--------|------|-------------|
| jwtsecret | String | A string secret for using HS256, HS384 or HS512 depending on secret size used to sign the JWT. |
| jwtprivkey | String | A private key file used to sign (might require specifying the jwtalg). |
| jwtalg | String | Specifies the algorithm used to sign the JWT (HS* or RSA by default). Depends on available algorithms on the current JVM. |

The data map to sign can have the following entries:

  * audience (String)
  * claims (Map)
  * expiration (Date)
  * headers (Map)
  * issuer (String)
  * id (String)
  * issuedAt (Daterrrr)
  * notBefore (Date)
  * subject (String)

---

### 🧾 Grid output options

List of options to use when _out=grid_:

| Option | Type | Description |
|--------|------|-------------|
| grid   | String | A JSON/SLON configuration composed of an array with another array per grid line. Each line array should have a map per column (see below for the map options) | 

Each map should be composed of a:

  * 'title'
  * 'type' (tree, map, chart, bar, table, area, text and md)
  * a 'path' to select the data (for non chart types) 
  * an 'obj' (for chart type the format is the same of chart=...) 
  * or 'cmd' (to run a command that outputs json on stdout)

---

### 🧾 HTML output options

List of options to use when _out=html_:

| Option | Type | Description |
|--------|------|-------------|
| htmlcompact | Boolean | Boolean flag that if true and the input data is a string or markdown the generated html will have a visual compact width format |
| htmlpart | Boolean | Boolean flag that if true and the input data is a string or markdown the generated html will be partial and not the complete file |
| htmlopen | Boolean | Boolean that if false won't try to open the output contents in a browser (defaults to true). To use outfile= you need to set htmlopen=false. |
| htmlwait | Number | Amount of ms, when htmlopen=true, to wait for the system browser to open an render the html output | 
| htmldark | Boolean | If supported and true the output html will use a dark theme. |

---

### 🧾 Log output options

List of options to use when _out=log_:

| Option | Type | Description |
|--------|------|-------------|
| logprintall | Boolean | If true all original non data (string) lines will be output |

---

### 🧾 MD output options

List of options to use when _out=md_:

| Option | Type | Description |
|--------|------|-------------|
| mdtemplate | Boolean | If true will apply a template output without any input data |

---

### 🧾 PXML output options

List of options to use when _out=pxml_:

| Option | Type | Description |
|--------|------|-------------|
| pxmlprefix | String | A prefix added to all XML tags |

---

### 🧾 OpenMetrics output options

List of options to use when _out=openmetrics_:

| Option | Type | Description |
|--------|------|-------------|
| metricsprefix | String | The prefix to use for each metric (defaults to 'metrics') |
| metricstimestamp | Number | Unix Epoch in seconds for each metric |

---

### 🧾 SChart output options

List of options to use when _out=schart_:

| Option | Type | Description |
|--------|------|-------------|
| schart  | String | Chart definition in the format "<unit> <path:color:legend>... [-min:0] [-max:100]". Unit is either 'int', 'dec1', 'dec2', 'dec3', 'dec', 'bytes' or 'si'. Path is equivalent to the 'path' filter (quotes should be used for non-basic 'path' expressions). |

Example: 
```oafp data="[(x:1,y:2)|(x:2,y:5)|(x:1,y:4)|(x:2,y:5)|(x:1,y:5)]" in=slon out=schart schart="int '[].x':red:x '[].y':blue:y -min:0 -vsize:8"```

---

### 🧾 SQL output options

List of options to use when _out=sql_:

| Option | Type | Description |
|--------|------|-------------|
| sqltable | String | The table name to use for the SQL statements (defaults to 'data') |
| sqlicase | Boolean | If true the table and fields names won't be double-quoted |
| sqlnocreate | Boolean | If true the create table statement won't be generated |

---

### 🧾 Template output options

List of options to use when _out=template_:

| Option | Type | Description |
|--------|------|-------------|
| template | String | A file path to a HandleBars' template or a string template definition if 'templatetmpl' is true |
| templatepath | String | If 'template' is not provided a path to the template definition (pre-transformation) |
| templatedata | String | If defined the template data will be retrieved from the provided path |
| templatetmpl | String | If true the 'template' will be interpreted as the template definition instead of a file path |

---

### 🧾 XLS output options

List of options to use when _out=xls_:

| Option | Type | Description |
|--------|------|-------------|
| xlsfile | String | The output filename (if not defined a temporary file will be used to open with the OS's Excel-compatible application) |
| xlssheet | String | The name of sheet to use (default to 'data') |
| xlsformat | String | A SLON or JSON string with the formatting of the output file (e.g. (bold: true, borderBottom: "medium", borderBottomColor: "red")) |
| xlsopen | Boolean | If false it won't try to open the OS's Excel-compatible application (defaults to true) |
| xlsopenwait | Number | The amount of time, in ms, to keep the temporary file for the OS's Excel-compatible application to start and open the file |

---

### 🧾 XML output options

List of options to use when _out=xml_:

| Option | Type | Description |
|--------|------|-------------|
| outxmlprefix | String | A prefix added to all XML tags |

---

## 🔐 sBuckets

To use OpenAF's sBuckets to retrieve secrets you can use the following parameters or environment variables:

| Parameter | Env variable | Description |
|-----------|--------------|-------------|
| secRepo | OAFP_SECREPO | sBucket repository |
| secBucket | OAFP_SECBUCKET | sBucket bucket name |
| secPass | OAFP_SECPASS | sBucket bucket password |
| secMainPass | OAFP_SECMAINPASS | sBucket repository password |
| secFile | OAFP_SECFILE | Optional sBucket file source |
| secEnv | n/a | A boolean flag to use environment variables as sBuckets |
| secKey | n/a | The mandatory sBucket bucket key to use |

> Check more in https://docs.openaf.io/docs/concepts/sBuckets

---

## 📝 Examples

```bash
# simple processing through pipe
cat someJsonFile.json | oafp

# simple processing through pipe with scrolling
cat someJsonFile.json | oafp output=ctree | less -r

# specifying the input type and output format
cat data.ndjson | oafp input=ndjson output=cslon
```

```bash
# markdown parsing of a file
oafp file=someFile.md input=md

# table with the latest news from Google
curl -s -L https://blog.google/rss | oafp path="rss.channel.item" sql="select title, pubDate" output=ctable

# ask an LLM model to summarise some text
echo "A very long text to be summarized" | oafp llmprompt="summarize this" llmoptions="(type: ollama, model: llama3)"
```

```bash
# list of OpenAF oPacks and their corresponding version
oafp -v path="openaf.opacks" output=ctable

# list of OpenAF processor inputs, transforms and outputs
oafp -v path="oafp.inputs" output=cslon
oafp -v path="oafp.transforms" output=cslon
oafp -v path="oafp.outputs" output=cslon

# list examples with kubectl
oafp examples=kubectl
# list examples for category 'openaf' and sub-category 'oafp'
oafp examples=openaf::oafp
# list examples for category 'kubernetes'
oafp examples=kubernetes::

# yaml options input to link to oafp executions
echo '
data:
  set:
  - 1
  - 2
  - 3
path: "set[].{ x: @ }"
out : json
pipe:
  isql : |
    SELECT sum("x") "SUM"
  opath: "[0].SUM"
' | oafp -f -
```

---

## 📚 Other help documents

| Help | Description |
|------|-------------|
| help=filters | Provides more details regarding the use of "path=", "from=" and "sql=" |
| help=template | Provides more details regarding the use of "output=template" |
| help=examples | Provide several examples |
| help=readme | Returns this document |

> You can use [OpenAI's ChatGPT oAFp GPT](https://chatgpt.com/g/g-uBUaPluLw-oafp) to generate commands
