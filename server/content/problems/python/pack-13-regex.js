// Python pack 13 — regular expressions: compile, search vs match vs
// fullmatch, findall / finditer, groups and named groups, character classes,
// quantifiers, anchors, sub with a function, lookaheads, and regex-based
// tokenising (up to a full arithmetic evaluator).
import { python, md, code, ex, hid } from './define.js';
import { dev, ddp, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'match-search-fullmatch',
      title: 'match vs search vs fullmatch',
      difficulty: 'Easy',
      topics: ['Regular Expressions'],
      patterns: ['Compiled pattern semantics'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'For each pattern/text pair, report which of the three re functions find a match.',
      description: md('For each `[pattern, text]`, compile the pattern once and return `[match?, search?, fullmatch?]` (booleans) for `pattern.match(text)`, `pattern.search(text)` and `pattern.fullmatch(text)`.'),
      hints: ['`match` anchors at the start only, `search` scans anywhere, `fullmatch` must consume the whole string.'],
      entry: 'which_match',
      signature: 'which_match(cases: list[list[str]]) -> list[list[bool]]',
      solution: code`import re

def which_match(cases: list[list[str]]) -> list[list[bool]]:
    out = []
    for pattern, text in cases:
        p = re.compile(pattern)
        out.append([p.match(text) is not None, p.search(text) is not None, p.fullmatch(text) is not None])
    return out
`,
      explanation: md('This is the most common regex bug in validation code: using `match` (or `search`) when you meant "the whole string must look like this". `fullmatch` (or `^…$` with `search`) is the right tool for validation; `re.compile` is worth it when a pattern is reused.'),
      tests: [
        ex('Example', [['\\d+', '123abc'], ['\\d+', 'abc123'], ['\\d+', '123']]),
        ex('Empty pattern', [['', 'x']]),
        hid('Anchors', [['^a.*z$', 'abcz'], ['b', 'abc']]),
        hid('Nothing matches', [['x', 'abc']]),
      ],
    }),

    python({
      id: 'extract-emails',
      title: 'Extract Email Addresses from Free Text',
      difficulty: 'Easy',
      topics: ['Regular Expressions', 'Strings'],
      patterns: ['findall'],
      domains: ['Marketing / CRM'],
      roles: DE,
      summary: 'Pull every email address out of support tickets, deduplicated case-insensitively.',
      description: md('Find all email addresses in `text`: a local part of letters, digits and `._%+-`, an `@`, then a domain of letters, digits, dots and hyphens ending in a dot and 2+ letters. Return them lowercased, deduplicated, in order of first appearance.'),
      hints: ['`re.findall(r"[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}", text)`; `\\w` also covers underscore.'],
      entry: 'emails',
      signature: 'emails(text: str) -> list[str]',
      solution: code`import re

EMAIL = re.compile(r"[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}")

def emails(text: str) -> list[str]:
    return list(dict.fromkeys(m.lower() for m in EMAIL.findall(text)))
`,
      explanation: md('`findall` returns every non-overlapping match. A full RFC 5322 email regex is enormous; for extraction a practical pattern plus normalisation is the right trade-off.'),
      tests: [
        ex('Example', 'Contact Ana.Lee@Corp.com or support@help.io; cc ana.lee@corp.com.'),
        ex('None', 'no emails here @ all'),
        hid('Plus addressing and subdomains', 'x+tag@mail.eu.example.org, bad@nodot, y@z.co'),
        hid('Underscores and hyphens', 'first_last@my-corp.com and FIRST_LAST@MY-CORP.COM'),
      ],
    }),

    python({
      id: 'sum-numbers-in-text',
      title: 'Sum the Integers Mentioned in Text',
      difficulty: 'Easy',
      topics: ['Regular Expressions'],
      patterns: ['findall + convert'],
      domains: ['Search & text'],
      ...tag(dev('ByteDance', 'regular expressions: summing integers extracted from text')),
      roles: DE,
      summary: 'Find every (possibly negative) integer in a string and add them up.',
      description: md('Return the sum of all integers in `text`. An integer is an optional `-` directly followed by digits; digits that are part of a decimal like `3.75` count as two integers (`3` and `75`).'),
      hints: ['`re.findall(r"-?\\d+", text)`.'],
      entry: 'sum_ints',
      signature: 'sum_ints(text: str) -> int',
      solution: code`import re

def sum_ints(text: str) -> int:
    return sum(int(n) for n in re.findall(r"-?\d+", text))
`,
      explanation: md('`\\d+` is greedy, so `"120"` is one match, not three. The rule about decimals is a reminder that a regex defines exactly what counts as a token — write the spec first.'),
      tests: [
        ex('Example', 'Shipped 120 units, 7 returned, balance -15.'),
        ex('No numbers', 'none'),
        hid('Decimals split', 'price 3.75'),
        hid('Hyphen as a range', 'pages 10-20'),
      ],
    }),

    python({
      id: 'validate-phone-numbers',
      title: 'Validate Phone Numbers with Character Classes',
      difficulty: 'Easy',
      topics: ['Regular Expressions'],
      patterns: ['fullmatch validation'],
      domains: ['Marketing / CRM'],
      roles: DE,
      summary: 'Accept a few phone formats and reject everything else using one fullmatch pattern.',
      description: md(
        'A valid number is, after stripping surrounding spaces: an optional `+` and 1–3 digit country code followed by a space, then 10 digits written either together (`9876543210`), as `xxx-xxx-xxxx`, or as `(xxx) xxx-xxxx`. Return a boolean per number.',
      ),
      hints: ['Group the alternatives: `(?:\\d{10}|\\d{3}-\\d{3}-\\d{4}|\\(\\d{3}\\) \\d{3}-\\d{4})`.'],
      entry: 'valid_phones',
      signature: 'valid_phones(numbers: list[str]) -> list[bool]',
      solution: code`import re

PHONE = re.compile(r"(?:\+\d{1,3} )?(?:\d{10}|\d{3}-\d{3}-\d{4}|\(\d{3}\) \d{3}-\d{4})")

def valid_phones(numbers: list[str]) -> list[bool]:
    return [PHONE.fullmatch(n.strip()) is not None for n in numbers]
`,
      explanation: md('`\\d{3}` is a quantified character class; `(?:…)` groups without capturing; escaping `(`, `)` and `+` makes them literal. `fullmatch` ensures nothing extra sneaks in before or after.'),
      tests: [
        ex('Example', ['9876543210', '+91 987-654-3210', '(987) 654-3210', '98765-43210']),
        ex('Spaces around are fine', ['  +1 (555) 123-4567 ']),
        hid('Too many digits', ['98765432101', '+1234 9876543210']),
        hid('Missing space after country code', ['+919876543210']),
      ],
    }),

    python({
      id: 'parse-access-log-named-groups',
      title: 'Parse Access-Log Lines with Named Groups',
      difficulty: 'Medium',
      topics: ['Regular Expressions', 'Parsing (CSV / JSON)'],
      patterns: ['Named groups → dict'],
      domains: ['Web server logs'],
      roles: DE,
      summary: 'Turn common-log-format lines into dicts with groupdict(), skipping malformed lines.',
      description: md(
        'Lines look like `203.0.113.9 - - [10/Oct/2024:13:55:36 +0000] "GET /api/orders?id=7 HTTP/1.1" 200 2326`. Parse each into `{"ip", "time", "method", "path", "status", "bytes"}` — `path` without the query string, `status` an int, `bytes` an int (or 0 when the field is `-`). Skip lines that don\'t match.',
      ),
      hints: ['`(?P<name>…)` names a group; `match.groupdict()` returns them as a dict.', 'Capture the path as `[^ ?]+` and optionally consume `\\?\\S*`.'],
      entry: 'parse_log',
      signature: 'parse_log(lines: list[str]) -> list[dict]',
      solution: code`import re

LINE = re.compile(
    r'(?P<ip>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] '
    r'"(?P<method>[A-Z]+) (?P<path>[^ ?]+)(?:\?\S*)? HTTP/[\d.]+" '
    r'(?P<status>\d{3}) (?P<bytes>\d+|-)'
)

def parse_log(lines: list[str]) -> list[dict]:
    out = []
    for line in lines:
        m = LINE.fullmatch(line.strip())
        if not m:
            continue
        d = m.groupdict()
        d["status"] = int(d["status"])
        d["bytes"] = 0 if d["bytes"] == "-" else int(d["bytes"])
        out.append(d)
    return out
`,
      explanation: md('Named groups make a long pattern self-documenting and give you a dict for free. Adjacent string literals inside `re.compile(...)` are concatenated, which keeps a complex pattern readable across lines.'),
      tests: [
        ex('Example', ['203.0.113.9 - - [10/Oct/2024:13:55:36 +0000] "GET /api/orders?id=7 HTTP/1.1" 200 2326', 'garbage']),
        ex('Dash for bytes', ['10.0.0.1 - bob [01/Jan/2024:00:00:00 +0000] "POST /login HTTP/2" 302 -']),
        hid('Empty', []),
        hid('Bad status code', ['1.2.3.4 - - [x] "GET / HTTP/1.1" 2000 1']),
      ],
    }),

    python({
      id: 'sql-table-extractor',
      title: 'The Table Thief: Which Tables Does a Query Read?',
      difficulty: 'Medium',
      topics: ['Regular Expressions', 'Strings'],
      patterns: ['Tokenise, then scan'],
      domains: ['Data lineage'],
      ...tag(ddp('DoorDash', 'The Table Thief')),
      roles: DE,
      summary: 'Extract the tables a SQL query reads from, for a lineage tool — ignoring CTE names.',
      description: md(
        'Return the sorted, lowercased, distinct table names that follow `FROM` or `JOIN` (any case, any join type) in `sql`. Table names may be schema-qualified (`sales.orders`) and quoted with backticks or double quotes (strip the quotes). **Exclude** names defined as CTEs (`WITH name AS (` and `, name AS (`), and ignore subqueries (`FROM (`).',
        '',
        'Assume no comments or string literals contain these keywords.',
      ),
      hints: ['Find candidates with a case-insensitive pattern for `from` or `join`, whitespace, then an identifier made of word characters, dots and quote characters; a `(` right after FROM won\'t match, so subqueries skip themselves.', 'Collect CTE names with `re.findall(r"(?:with|,)\\s*(\\w+)\\s+as\\s*\\(", sql, re.I)`.'],
      entry: 'tables_read',
      signature: 'tables_read(sql: str) -> list[str]',
      solution: code`import re

def tables_read(sql: str) -> list[str]:
    ctes = {c.lower() for c in re.findall(r"(?:\bwith|,)\s*(\w+)\s+as\s*\(", sql, re.I)}
    found = set()
    for name in re.findall(r"\b(?:from|join)\s+([\x60\"\w.]+)", sql, re.I):
        clean = name.replace("\x60", "").replace('"', "").lower()
        if clean and clean not in ctes:
            found.add(clean)
    return sorted(found)
`,
      explanation: md('Real lineage tools use a SQL parser (sqlglot, sqlparse), but a careful regex is the interview answer and shows the traps: CTE names look like tables, subqueries follow `FROM`, and identifiers may be quoted or schema-qualified. `re.I` makes keywords case-insensitive.'),
      tests: [
        ex('Example', 'WITH recent AS (SELECT * FROM sales.orders WHERE d > 1) SELECT * FROM recent r LEFT JOIN `dim`.`customers` c ON r.cid = c.id'),
        ex('Subquery', 'select x from (select 1 as x) t join items i on true'),
        hid('Several CTEs and joins', 'with a as (select * from t1), b as (select * from t2) select * from a inner join b on 1=1 cross join "Raw"."Events"'),
        hid('Duplicates', 'SELECT * FROM t JOIN t ON 1=1'),
      ],
    }),

    python({
      id: 'mask-pii-sub-function',
      title: 'Mask PII with re.sub and a Function',
      difficulty: 'Medium',
      topics: ['Regular Expressions', 'Strings'],
      patterns: ['sub with a replacement function'],
      domains: ['Privacy / PII'],
      roles: DE,
      summary: 'Redact emails and card numbers in log text while keeping just enough to debug.',
      description: md(
        'Redact two kinds of PII in `text`:',
        '',
        '- emails: keep the first character of the local part and the domain → `a***@corp.com`;',
        '- card numbers: 13–16 digits, optionally grouped by single spaces or dashes → `****-****-****-1234` style, i.e. replace with `"**** " + last 4 digits`.',
        '',
        'Return `[redacted_text, number_of_replacements]`.',
      ),
      hints: ['`re.subn(pattern, func, text)` returns the new text and the count; `func` receives the match object.', 'For cards, match `\\b(?:\\d[ -]?){12,15}\\d\\b` and strip separators inside the function.'],
      entry: 'redact',
      signature: 'redact(text: str) -> list',
      solution: code`import re

EMAIL = re.compile(r"\b([\w.%+-])[\w.%+-]*@([\w.-]+\.[A-Za-z]{2,})\b")
CARD = re.compile(r"\b(?:\d[ -]?){12,15}\d\b")

def _card(m):
    digits = re.sub(r"\D", "", m.group())
    return "**** " + digits[-4:]

def redact(text: str) -> list:
    text, n_cards = CARD.subn(_card, text)
    text, n_emails = EMAIL.subn(lambda m: f"{m.group(1)}***@{m.group(2)}", text)
    return [text, n_cards + n_emails]
`,
      explanation: md('A replacement **function** gets each match and can compute the replacement — keeping the last four digits, or part of the address. Running the card pattern first stops the email pattern from ever seeing the digits. `subn` reports how many replacements happened, which is worth logging.'),
      tests: [
        ex('Example', 'user ana.lee@corp.com paid with 4111 1111 1111 1234 today'),
        ex('Nothing to redact', 'order 12345 shipped'),
        hid('Dashes and multiple emails', 'cards 5500-0000-0000-0004, x@y.io and Zed@Mail.co'),
        hid('Short digit runs are not cards', 'pin 1234 and phone 9876543210'),
      ],
    }),

    python({
      id: 'key-value-findall',
      title: 'Parse key=value Pairs from a Log Line',
      difficulty: 'Easy',
      topics: ['Regular Expressions', 'Dicts & Sets'],
      patterns: ['findall with groups'],
      domains: ['Web server logs'],
      roles: DE,
      summary: 'Extract key=value fields, including quoted values with spaces, into a dict.',
      description: md('Parse `line` like `level=warn user="Ana Lee" latency_ms=35 path=/api` into a dict. Keys are word characters; values are either a double-quoted string (quotes removed, may contain spaces) or a run of non-space characters. Numbers stay strings. Later keys overwrite earlier ones.'),
      hints: ['With two groups, `findall` returns tuples: `re.findall(r\'(\\w+)=("[^"]*"|\\S+)\', line)`.'],
      entry: 'parse_kv',
      signature: 'parse_kv(line: str) -> dict[str, str]',
      solution: code`import re

def parse_kv(line: str) -> dict[str, str]:
    pairs = re.findall(r'(\w+)=("[^"]*"|\S+)', line)
    return {k: v[1:-1] if v.startswith('"') else v for k, v in pairs}
`,
      explanation: md('When a pattern has groups, `findall` returns the groups instead of the whole match — one tuple per match for several groups. Alternation tries the quoted form first, so quoted values with spaces stay whole.'),
      tests: [
        ex('Example', 'level=warn user="Ana Lee" latency_ms=35 path=/api'),
        ex('No pairs', 'just a message'),
        hid('Empty quoted value and overwrite', 'a=1 note="" a=2'),
        hid('Values with symbols', 'url=https://x.io/a?b=c status=200'),
      ],
    }),

    python({
      id: 'camel-to-snake',
      title: 'Convert camelCase Column Names to snake_case',
      difficulty: 'Easy',
      topics: ['Regular Expressions', 'Strings'],
      patterns: ['sub with backreferences'],
      domains: ['Data modeling'],
      roles: DE,
      summary: 'Normalise API field names like userID and HTTPStatusCode into snake_case.',
      description: md('Convert each name to snake_case: insert `_` between a lowercase letter or digit and an uppercase letter, and between an acronym and a following capitalised word (`HTTPStatus` → `http_status`), then lowercase. Existing underscores and non-alphanumerics other than `_` are kept as is.'),
      hints: ['Two passes: `re.sub(r"([A-Z]+)([A-Z][a-z])", r"\\1_\\2", s)` then `re.sub(r"([a-z\\d])([A-Z])", r"\\1_\\2", s)`.'],
      entry: 'snake_names',
      signature: 'snake_names(names: list[str]) -> list[str]',
      solution: code`import re

def snake_names(names: list[str]) -> list[str]:
    out = []
    for s in names:
        s = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", s)
        s = re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s)
        out.append(s.lower())
    return out
`,
      explanation: md('Backreferences (`\\1`, `\\2`) put captured text back into the replacement. Handling acronyms needs its own rule — that is why `HTTPStatusCode` is the classic test case.'),
      tests: [
        ex('Example', ['userId', 'HTTPStatusCode', 'createdAt2', 'already_snake']),
        ex('Single word', ['Name']),
        hid('Digits before capitals', ['ipV4Address', 'sha256Hash']),
        hid('Acronym at the end', ['parseJSON', 'getHTTPResponseCode']),
      ],
    }),

    python({
      id: 'password-policy-lookaheads',
      title: 'Password Policy with Lookaheads',
      difficulty: 'Medium',
      topics: ['Regular Expressions'],
      patterns: ['Lookahead assertions'],
      domains: ['Security'],
      roles: DE,
      summary: 'Check several independent rules in one pattern with (?=…) lookaheads.',
      description: md('A password is valid when it is 10–64 characters, contains at least one lowercase letter, one uppercase letter, one digit and one character that is not a letter or digit, and contains **no whitespace**. Return a boolean per password, using a single compiled pattern.'),
      hints: ['Each `(?=.*[a-z])` checks a rule without consuming characters; finish with `\\S{10,64}` under `fullmatch`.'],
      entry: 'strong',
      signature: 'strong(passwords: list[str]) -> list[bool]',
      solution: code`import re

POLICY = re.compile(r"(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{10,64}")

def strong(passwords: list[str]) -> list[bool]:
    return [POLICY.fullmatch(p) is not None for p in passwords]
`,
      explanation: md('Lookaheads are zero-width: each one scans ahead for its rule and then returns to the start, so several independent conditions can be AND-ed in one pattern. In application code, separate checks give better error messages — but the pattern is a classic interview test of regex fluency.'),
      tests: [
        ex('Example', ['Str0ng!Pass', 'weakpassword', 'NoDigits!!xx', 'Sh0rt!']),
        ex('Whitespace not allowed', ['Has Space1!x']),
        hid('Exactly ten characters', ['Aa1!Aa1!Aa']),
        hid('Too long', ['Aa1!' + 'x'.repeat(61)]),
      ],
    }),

    python({
      id: 'arithmetic-evaluator',
      title: 'Evaluate an Arithmetic Formula',
      difficulty: 'Hard',
      topics: ['Regular Expressions', 'Stacks & Queues', 'Recursion'],
      patterns: ['Tokenise + recursive descent'],
      domains: ['Finance'],
      ...tag(dev('Meta', 'arithmetic formula evaluator (array, math, string parsing)', 'Facebook')),
      roles: DE,
      summary: 'Tokenise with a regex and evaluate +, -, *, /, unary minus and parentheses — without eval().',
      description: md(
        'Evaluate `formula` containing non-negative numbers (ints or decimals), `+ - * /`, parentheses, unary minus and spaces. Use normal precedence and left-to-right associativity. Return the result rounded to 4 decimals, or `"error"` for division by zero, unbalanced parentheses or any invalid token/syntax. Do **not** use `eval`.',
      ),
      hints: [
        'Tokenise with `re.findall(r"\\d+\\.?\\d*|\\.\\d+|[-+*/()]|\\S", formula)` — the final `\\S` catches invalid characters.',
        'Recursive descent: `expr = term (("+"|"-") term)*`, `term = factor (("*"|"/") factor)*`, `factor = "-" factor | number | "(" expr ")"`.',
      ],
      entry: 'evaluate',
      signature: 'evaluate(formula: str)',
      solution: code`import re

TOKEN = re.compile(r"\d+\.?\d*|\.\d+|[-+*/()]|\S")

def evaluate(formula: str):
    tokens = TOKEN.findall(formula)
    pos = 0

    def peek():
        return tokens[pos] if pos < len(tokens) else None

    def take():
        nonlocal pos
        tok = peek()
        pos += 1
        return tok

    def expr():
        value = term()
        while peek() in ("+", "-"):
            value = value + term() if take() == "+" else value - term()
        return value

    def term():
        value = factor()
        while peek() in ("*", "/"):
            op = take()
            rhs = factor()
            value = value * rhs if op == "*" else value / rhs
        return value

    def factor():
        tok = take()
        if tok == "-":
            return -factor()
        if tok == "(":
            value = expr()
            if take() != ")":
                raise SyntaxError("expected )")
            return value
        if tok is not None and re.fullmatch(r"\d+\.?\d*|\.\d+", tok):
            return float(tok)
        raise SyntaxError(f"unexpected {tok!r}")

    try:
        result = expr()
        if pos != len(tokens):
            raise SyntaxError("trailing tokens")
        return round(result, 4)
    except (SyntaxError, ZeroDivisionError):
        return "error"
`,
      explanation: md(
        'The regex turns characters into tokens; the grammar handles precedence by nesting — `term` binds tighter than `expr`, `factor` tighter still — and each `while` loop gives left associativity (`8 - 3 - 2 = 3`).',
        '',
        '`eval` would "work" but executes arbitrary code; never use it on input. The two-stack shunting-yard algorithm is the iterative alternative.',
      ),
      tests: [
        ex('Example', '2 + 3 * (4 - 1) / 2'),
        ex('Division by zero', '1 / (2 - 2)'),
        hid('Left associativity', '8 - 3 - 2'),
        hid('Unary minus', '-(2 + 3) * -2'),
        hid('Unbalanced parentheses', '(1 + 2'),
        hid('Invalid character', '2 ^ 3'),
        hid('Decimals', '.5 + 1.25 * 4'),
      ],
    }),
  ],
};
