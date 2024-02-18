;(function() {
    exports.oafplib = function(params, _$o, $o) {
        var _r = {
            fileExtensions: [ { ext: ".test", type: "test" } ],
            input         : [ { 
                type: "test", 
                fn: (r, options) => {
                    _$o({ test: 'test input' }, options)
                }
            } ],
            output        : [ { 
                type: "test", 
                fn: (r, options) => {
                    $o({ test: 'test output' }, options)
                }
            } ],
            transform     : [ { 
                type: "test", 
                fn: (r) => {
                    return { test: 'test transform' }
                }
            } ],
            help          : 
`# Test oafp lib

## ⬇️  Test input types:

Extra input types added by the test lib:

| Input type | Description |
|------------|-------------|
| test       | Test input  |

---

## 🚜 Test optional transforms:

Extra optional transforms added by the test lib:

| Option | Type | Description |
|--------|------|-------------|
| test   | Boolean | Test transform |

---

## ⬆️  Output formats

Extra output formats added by the test lib:

| Output format | Description |
|---------------|-------------|
| test          | Test output  |
`
        }

        return _r
    }
})()