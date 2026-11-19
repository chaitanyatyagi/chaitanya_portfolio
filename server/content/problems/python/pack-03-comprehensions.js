// Python pack 3 — comprehensions: list / dict / set comprehensions, chained
// `for` clauses, conditional expressions (if-elif-else), the walrus operator,
// and the type semantics that trip people up when transforming data.
import { python, md, code, ex, hid } from './define.js';
import { dev, ddp, lds, tag } from './sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    python({
      id: 'squares-of-even-readings',
      title: 'Rewrite the Loop as a Comprehension',
      difficulty: 'Easy',
      topics: ['Comprehensions'],
      patterns: ['Filter + transform in one comprehension'],
      domains: ['IoT / Telemetry'],
      ...tag(dev('PayPal', 'list comprehension conversion')),
      roles: DE,
      summary: 'Square the even sensor readings and drop the rest — in a single list comprehension.',
      description: md(
        'This loop works, but reviewers want a single list comprehension:',
        '',
        '```python',
        'out = []',
        'for r in readings:',
        '    if r % 2 == 0:',
        '        out.append(r * r)',
        '```',
        '',
        'Return the same list for `readings` (integers, possibly negative).',
      ),
      hints: ['`[expression for item in iterable if condition]` — the filtering `if` goes at the end.'],
      entry: 'even_squares',
      signature: 'even_squares(readings: list[int]) -> list[int]',
      solution: code`def even_squares(readings: list[int]) -> list[int]:
    return [r * r for r in readings if r % 2 == 0]
`,
      explanation: md('A comprehension reads in the same order as the loop: transform, source, filter. It is also a little faster than `append` in a loop because the list is built in C.'),
      tests: [
        ex('Example', [1, 2, 3, 4]),
        ex('No evens', [1, 3, 5]),
        hid('Negatives are even too', [-2, -3, 0]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'grade-buckets',
      title: 'Bucket Scores with if-elif-else in a Comprehension',
      difficulty: 'Easy',
      topics: ['Comprehensions'],
      patterns: ['Conditional expression chain'],
      domains: ['Education'],
      ...tag(lds('Pinterest', 'pinterest', 'Classify Users by Activity Level')),
      roles: DE_DA,
      summary: 'Map each score to a letter grade using a chained conditional expression inside one comprehension.',
      description: md(
        'Map each score in `scores` to a grade: `"A"` for 90+, `"B"` for 75–89, `"C"` for 50–74, `"F"` below 50. Scores of `None` (missing) become `"N/A"`. Use one list comprehension.',
      ),
      hints: [
        'Comprehensions have no `elif`, but conditional expressions chain: `"A" if s >= 90 else "B" if s >= 75 else …`.',
        'Check for `None` first so the comparisons never see it.',
      ],
      entry: 'grades',
      signature: 'grades(scores: list) -> list[str]',
      solution: code`def grades(scores: list) -> list[str]:
    return [
        "N/A" if s is None else "A" if s >= 90 else "B" if s >= 75 else "C" if s >= 50 else "F"
        for s in scores
    ]
`,
      explanation: md('`x if c1 else y if c2 else z` parses as `x if c1 else (y if c2 else z)`, which is exactly an if-elif-else chain. Once it grows beyond three or four branches, a small helper function is easier to read.'),
      tests: [
        ex('Example', [95, 80, 50, 49]),
        ex('Missing score', [null, 90]),
        hid('Boundaries', [90, 89, 75, 74, 50, 0]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'transpose-matrix',
      title: 'Transpose a Table with Nested Comprehensions',
      difficulty: 'Easy',
      topics: ['Comprehensions', 'Matrices'],
      patterns: ['Nested comprehension'],
      domains: ['Reporting'],
      roles: DE,
      summary: 'Turn rows into columns with a nested comprehension (and know when zip does it for you).',
      description: md('`rows` is a rectangular table (a list of equal-length lists). Return its transpose: row `i` of the result is column `i` of the input. An empty table returns `[]`.'),
      hints: ['`[[row[c] for row in rows] for c in range(len(rows[0]))]` — the inner comprehension builds one output row.', '`[list(col) for col in zip(*rows)]` is the idiomatic shortcut.'],
      entry: 'transpose',
      signature: 'transpose(rows: list[list]) -> list[list]',
      solution: code`def transpose(rows: list[list]) -> list[list]:
    if not rows:
        return []
    return [[row[c] for row in rows] for c in range(len(rows[0]))]
`,
      explanation: md('In a nested comprehension the **outer** one produces output rows and the **inner** one fills each row. `zip(*rows)` does the same by unpacking the rows as arguments, yielding tuples.'),
      tests: [
        ex('Example', [[1, 2, 3], [4, 5, 6]]),
        ex('Single row', [['a', 'b']]),
        hid('Empty', []),
        hid('Single column', [[1], [2], [3]]),
      ],
    }),

    python({
      id: 'price-index',
      title: 'Build a Price Index with a Dict Comprehension',
      difficulty: 'Easy',
      topics: ['Comprehensions', 'Dicts & Sets'],
      patterns: ['Dict comprehension filter'],
      domains: ['E-commerce / Sales'],
      roles: DE,
      summary: 'Turn a product list into a SKU → gross price lookup, skipping inactive products.',
      description: md('Each product is a dict with `sku`, `price` (net) and `active`. Return `{sku: gross_price}` for active products only, where `gross_price = round(price * (1 + tax), 2)`.'),
      hints: ['`{key_expr: value_expr for item in items if condition}`.'],
      entry: 'price_index',
      signature: 'price_index(products: list[dict], tax: float) -> dict[str, float]',
      solution: code`def price_index(products: list[dict], tax: float) -> dict[str, float]:
    return {p["sku"]: round(p["price"] * (1 + tax), 2) for p in products if p["active"]}
`,
      explanation: md('A dict comprehension builds the lookup in one expression. If a SKU appears twice, the **last** one wins — worth saying out loud in an interview, and deduplicating first if that is wrong for the data.'),
      tests: [
        ex('Example', [{ sku: 'A', price: 10, active: true }, { sku: 'B', price: 5.5, active: false }, { sku: 'C', price: 2.49, active: true }], 0.18),
        ex('No tax', [{ sku: 'Z', price: 3, active: true }], 0),
        hid('Nothing active', [{ sku: 'A', price: 1, active: false }], 0.1),
        hid('Duplicate SKU — last wins', [{ sku: 'A', price: 1, active: true }, { sku: 'A', price: 2, active: true }], 0.5),
      ],
    }),

    python({
      id: 'email-domains',
      title: 'Distinct Email Domains with a Set Comprehension',
      difficulty: 'Easy',
      topics: ['Comprehensions', 'Dicts & Sets', 'Strings'],
      patterns: ['Set comprehension for distinct values'],
      domains: ['Marketing / CRM'],
      roles: DE_DA,
      summary: 'Collect the distinct, lowercased domains of valid-looking email addresses.',
      description: md('Return the sorted distinct domains (lowercased) of the addresses in `emails` that contain exactly one `@` with something on both sides. Ignore everything else.'),
      hints: ['`{expr for x in xs if cond}` builds a set; sort it at the end.', "`addr.split('@')` gives exactly 2 non-empty parts for a valid address."],
      entry: 'domains',
      signature: 'domains(emails: list[str]) -> list[str]',
      solution: code`def domains(emails: list[str]) -> list[str]:
    parts = (e.strip().split("@") for e in emails)
    return sorted({p[1].lower() for p in parts if len(p) == 2 and p[0] and p[1]})
`,
      explanation: md('A generator splits each address once; the set comprehension filters and deduplicates. Sets are unordered, so sort before returning to get a stable result.'),
      tests: [
        ex('Example', ['ana@Mail.com', 'raj@mail.com', 'li@corp.io']),
        ex('Invalid addresses ignored', ['no-at-sign', '@x.com', 'a@', 'a@b@c']),
        hid('Empty', []),
        hid('Whitespace around addresses', ['  x@Y.org ']),
      ],
    }),

    python({
      id: 'flatten-order-lines',
      title: 'Flatten Orders with Chained for Clauses',
      difficulty: 'Easy',
      topics: ['Comprehensions', 'Data Wrangling'],
      patterns: ['Chained comprehension (flatten)'],
      domains: ['E-commerce / Sales'],
      roles: DE,
      summary: 'Flatten nested order lines into (order, sku) pairs with one comprehension using two for clauses.',
      description: md(
        'Each order is `{"id": ..., "lines": [{"sku": ..., "qty": ...}, ...]}`. Return `[order_id, sku]` for every line with `qty > 0`, in order.',
      ),
      hints: ['Two `for` clauses in one comprehension nest left to right: `[... for o in orders for line in o["lines"] if ...]`.'],
      entry: 'order_skus',
      signature: 'order_skus(orders: list[dict]) -> list[list]',
      solution: code`def order_skus(orders: list[dict]) -> list[list]:
    return [[o["id"], line["sku"]] for o in orders for line in o["lines"] if line["qty"] > 0]
`,
      explanation: md('`for o in orders for line in o["lines"]` reads like the nested loops it replaces — outer loop first. The `if` applies to the innermost item.'),
      tests: [
        ex('Example', [{ id: 1, lines: [{ sku: 'A', qty: 2 }, { sku: 'B', qty: 0 }] }, { id: 2, lines: [{ sku: 'C', qty: 1 }] }]),
        ex('No lines', [{ id: 9, lines: [] }]),
        hid('Empty', []),
        hid('Negative quantities dropped', [{ id: 3, lines: [{ sku: 'R', qty: -1 }, { sku: 'S', qty: 5 }] }]),
      ],
    }),

    python({
      id: 'monthly-crosstab',
      title: 'Month-by-Month Sales Crosstab',
      difficulty: 'Medium',
      topics: ['Comprehensions', 'Datetime', 'Data Wrangling'],
      patterns: ['Pivot with a nested dict'],
      domains: ['E-commerce / Sales'],
      ...tag(ddp('JPMorgan', 'The Month-by-Month Snapshot')),
      roles: DE_DA,
      summary: 'Pivot sales rows into one row per employee with a column for every month.',
      description: md(
        'Each sale is `[employee, "YYYY-MM-DD", amount]`. Return `{employee: {month: total}}` where every employee has **all twelve** keys `"jan" … "dec"` (lowercase three-letter abbreviations) — months without sales are `0`. Order employees alphabetically.',
      ),
      hints: [
        'Start every employee with `{m: 0 for m in MONTHS}` — a dict comprehension.',
        'The month index is `int(date[5:7])`; look it up in a list of abbreviations.',
      ],
      entry: 'crosstab',
      signature: 'crosstab(sales: list[list]) -> dict[str, dict[str, float]]',
      solution: code`MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

def crosstab(sales: list[list]) -> dict[str, dict[str, float]]:
    table = {}
    for employee, day, amount in sales:
        row = table.setdefault(employee, {m: 0 for m in MONTHS})
        row[MONTHS[int(day[5:7]) - 1]] += amount
    return {e: table[e] for e in sorted(table)}
`,
      explanation: md('Pre-filling every month makes the shape fixed — the Python equivalent of `SUM(CASE WHEN month = … THEN amount ELSE 0 END)` for each column. Slicing the ISO date is safe because the format is fixed-width.'),
      tests: [
        ex('Example', [['ana', '2024-01-15', 100], ['ana', '2024-01-20', 50], ['raj', '2024-03-02', 75]]),
        ex('No sales', []),
        hid('December and amounts with decimals', [['zed', '2023-12-31', 10.5], ['zed', '2024-12-01', 0.25]]),
        hid('Employees sorted by name', [['zoe', '2024-06-01', 1], ['amy', '2024-07-01', 2]]),
      ],
    }),

    python({
      id: 'doubling-types',
      title: 'What Does Doubling Produce?',
      difficulty: 'Medium',
      topics: ['Comprehensions', 'Error Handling'],
      patterns: ['Type semantics of operators'],
      domains: ['Data quality'],
      ...tag(dev('PayPal', 'type operations output')),
      roles: DE,
      summary: 'Report the type of `value * 2` for mixed JSON values — including the bool and None surprises.',
      description: md(
        'For each value in `values` (any JSON type: int, float, str, bool, list, dict or None), return the **type name** of `value * 2`, or the **exception class name** if the operation raises.',
        '',
        '```',
        '[3, "ab", True, None]   →   ["int", "str", "int", "TypeError"]',
        '```',
        '',
        'Notice `True * 2` is an `int`: `bool` is a subclass of `int`.',
      ),
      hints: ['`type(x).__name__` gives the name; wrap the multiplication in `try/except Exception as e` and use `type(e).__name__`.'],
      entry: 'doubled_types',
      signature: 'doubled_types(values: list) -> list[str]',
      solution: code`def doubled_types(values: list) -> list[str]:
    out = []
    for v in values:
        try:
            out.append(type(v * 2).__name__)
        except Exception as e:
            out.append(type(e).__name__)
    return out
`,
      explanation: md('Sequence types repeat (`"ab" * 2 == "abab"`, `[1] * 2 == [1, 1]`), numbers multiply, `bool` behaves as the int 0/1, and `dict`/`None` don\'t support `*` at all. Catching the exception and reporting its class is how a data-quality check would classify bad inputs.'),
      tests: [
        ex('Example', [3, 'ab', true, null]),
        ex('Containers', [[1], { a: 1 }]),
        hid('Floats stay floats', [1.5, 0.0]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'words-by-length',
      title: 'Index Words by Length',
      difficulty: 'Easy',
      topics: ['Comprehensions', 'Dicts & Sets'],
      patterns: ['Dict comprehension over a set'],
      domains: ['Search & text'],
      roles: DE,
      summary: 'Build {length: sorted distinct words} with comprehensions.',
      description: md('Lowercase every word in `words`, then return `{length: sorted list of distinct words of that length}` with lengths in ascending order.'),
      hints: ['First a set comprehension of lowercased words, then a dict comprehension over the distinct lengths.'],
      entry: 'by_length',
      signature: 'by_length(words: list[str]) -> dict[int, list[str]]',
      solution: code`def by_length(words: list[str]) -> dict[int, list[str]]:
    distinct = {w.lower() for w in words}
    return {n: sorted(w for w in distinct if len(w) == n) for n in sorted({len(w) for w in distinct})}
`,
      explanation: md('Comprehensions compose: a set comprehension for distinct words, another for distinct lengths, and a dict comprehension that groups. For big inputs a single `defaultdict(list)` pass is faster (this version scans `distinct` once per length).'),
      tests: [
        ex('Example', ['ETL', 'sql', 'Spark', 'dbt', 'kafka']),
        ex('Single word', ['x']),
        hid('Empty', []),
        hid('Case folds duplicates together', ['Data', 'DATA', 'data', 'Lake']),
      ],
    }),

    python({
      id: 'parse-valid-ints',
      title: 'Keep the Parsable Numbers (Walrus Operator)',
      difficulty: 'Easy',
      topics: ['Comprehensions', 'Error Handling'],
      patterns: ['Assignment expression in a comprehension'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'Parse a column of strings to ints and keep only the ones that parse — without parsing twice.',
      description: md(
        'Return the integers that the strings in `raw` represent, skipping any that don\'t parse as a base-10 integer (surrounding spaces are fine). Write a small `to_int(s)` helper that returns `None` on failure, and use it **once per item** in a comprehension.',
      ),
      hints: ['`[n for s in raw if (n := to_int(s)) is not None]` — the walrus (`:=`) binds the result so you can test and keep it.'],
      entry: 'valid_ints',
      signature: 'valid_ints(raw: list[str]) -> list[int]',
      solution: code`def to_int(s):
    try:
        return int(s)
    except ValueError:
        return None

def valid_ints(raw: list[str]) -> list[int]:
    return [n for s in raw if (n := to_int(s)) is not None]
`,
      explanation: md('Without `:=` you would write `[to_int(s) for s in raw if to_int(s) is not None]` and parse every value twice. Comparing with `is not None` (not truthiness) keeps legitimate zeros.'),
      tests: [
        ex('Example', ['12', 'x', ' 7 ', '3.5']),
        ex('Zero is kept', ['0', '-0']),
        hid('Empty', []),
        hid('Nothing parses', ['', 'one', '1e3']),
      ],
    }),
  ],
};
