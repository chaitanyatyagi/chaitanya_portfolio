// Python pack 17 — database access with the DB-API (PEP 249): connections and
// cursors, execute / executemany, fetchone / fetchmany / fetchall,
// parameterised queries (and SQL injection), commit / rollback, inserting JSON
// records, upserts, cursor.description, and building dynamic filters safely.
// The sandbox uses sqlite3 (in-memory); the same API applies to MySQL and
// PostgreSQL drivers (mysql-connector, psycopg) apart from the placeholder style.
import { python, md, code, ex, hid } from './define.js';
import { gfg, tag } from './sources.js';

const DE = ['Data Engineer'];
const DE_DA = ['Data Engineer', 'Data Analyst'];

export default {
  problems: [
    python({
      id: 'dbapi-create-insert-fetch',
      title: 'Connect, Create, Insert, Query',
      difficulty: 'Easy',
      topics: ['Database Access (DB-API)'],
      patterns: ['connect → cursor → execute → fetch'],
      domains: ['E-commerce / Sales'],
      ...tag(gfg('Deloitte', 'how do you connect to a database using Python and pull data')),
      roles: DE_DA,
      summary: 'Load rows into an in-memory database with executemany and query an aggregate back.',
      description: md(
        'Create an in-memory SQLite database with table `orders(id INTEGER PRIMARY KEY, customer TEXT, amount REAL)`, insert `rows` (`[id, customer, amount]`) with **one** `executemany` call, then return the result of: total amount per customer (rounded to 2), customers with total ≥ `min_total`, ordered by total descending then customer. Close the connection when done.',
      ),
      hints: ['`sqlite3.connect(":memory:")`, `conn.executemany("INSERT ... VALUES (?, ?, ?)", rows)`.', 'Pass `min_total` as a parameter too.'],
      entry: 'big_customers',
      signature: 'big_customers(rows: list[list], min_total: float) -> list[list]',
      solution: code`import sqlite3

def big_customers(rows: list[list], min_total: float) -> list[list]:
    conn = sqlite3.connect(":memory:")
    try:
        conn.execute("CREATE TABLE orders (id INTEGER PRIMARY KEY, customer TEXT, amount REAL)")
        conn.executemany("INSERT INTO orders VALUES (?, ?, ?)", rows)
        cur = conn.execute(
            """SELECT customer, ROUND(SUM(amount), 2) AS total FROM orders
               GROUP BY customer HAVING SUM(amount) >= ?
               ORDER BY total DESC, customer""",
            (min_total,),
        )
        return [list(r) for r in cur.fetchall()]
    finally:
        conn.close()
`,
      explanation: md('Every DB-API driver follows the same shape: `connect()` → `cursor()` → `execute()` → `fetch…()` → `close()`. `executemany` sends many rows in one call — far faster than a Python loop of single inserts. Rows come back as tuples (shown as lists here).'),
      tests: [
        ex('Example', [[1, 'ana', 50], [2, 'raj', 20.5], [3, 'ana', 25.25], [4, 'li', 75.25]], 50),
        ex('Nobody qualifies', [[1, 'x', 1]], 100),
        hid('No rows', [], 0),
        hid('Ties by name', [[1, 'b', 10], [2, 'a', 10]], 10),
      ],
    }),

    python({
      id: 'parameterized-query-injection',
      title: 'Stop SQL Injection with Parameters',
      difficulty: 'Easy',
      topics: ['Database Access (DB-API)', 'Strings'],
      patterns: ['Parameterised query'],
      domains: ['Security'],
      roles: DE,
      summary: 'A login lookup built with string formatting leaks every row — rewrite it with placeholders.',
      description: md(
        'This lookup is vulnerable:',
        '',
        '```python',
        'conn.execute(f"SELECT name FROM users WHERE email = \'{email}\'")',
        '```',
        '',
        'With `email = "x\' OR \'1\'=\'1"` it returns every user. Rewrite `find_users(conn, email)` with a `?` placeholder. `run(email)` builds a small users table and returns the matching names (sorted).',
      ),
      hints: ['`conn.execute("... WHERE email = ?", (email,))` — the driver sends the value separately from the SQL text.', 'Note the trailing comma: `(email,)` is a one-element tuple.'],
      entry: 'run',
      signature: 'run(email: str) -> list[str]',
      starter: code`import sqlite3

def find_users(conn, email):
    return conn.execute(f"SELECT name FROM users WHERE email = '{email}'").fetchall()


# The tests call run(); don't change it.
def run(email):
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE users (name TEXT, email TEXT)")
    conn.executemany("INSERT INTO users VALUES (?, ?)", [("Ana", "ana@x.io"), ("Raj", "raj@x.io"), ("O'Neil", "o'neil@x.io")])
    names = sorted(r[0] for r in find_users(conn, email))
    conn.close()
    return names
`,
      solution: code`import sqlite3

def find_users(conn, email):
    return conn.execute("SELECT name FROM users WHERE email = ?", (email,)).fetchall()


def run(email):
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE users (name TEXT, email TEXT)")
    conn.executemany("INSERT INTO users VALUES (?, ?)", [("Ana", "ana@x.io"), ("Raj", "raj@x.io"), ("O'Neil", "o'neil@x.io")])
    names = sorted(r[0] for r in find_users(conn, email))
    conn.close()
    return names
`,
      explanation: md('With parameters, the value never becomes part of the SQL text, so quotes in it are just characters — injection is impossible, and legitimate names like `O\'Neil` stop breaking the query. Placeholder style differs by driver (`?` for sqlite3, `%s` for mysql-connector and psycopg), but the rule is the same: never format values into SQL.'),
      tests: [
        ex('Normal lookup', 'ana@x.io'),
        ex('Injection attempt', "x' OR '1'='1"),
        hid('Apostrophe in a real address', "o'neil@x.io"),
        hid('No match', 'nobody@x.io'),
      ],
    }),

    python({
      id: 'commit-rollback-transfer',
      title: 'Commit or Roll Back a Transfer',
      difficulty: 'Medium',
      topics: ['Database Access (DB-API)', 'Error Handling'],
      patterns: ['Transaction with rollback'],
      domains: ['Payments'],
      roles: DE,
      summary: 'Move money between accounts atomically: both updates or neither.',
      description: md(
        'Accounts live in `accounts(id TEXT PRIMARY KEY, balance REAL CHECK (balance >= 0))`. Write `transfer(conn, src, dst, amount)`: debit `src`, credit `dst`, and commit — but if anything fails (unknown account, the CHECK constraint, non-positive amount), roll back so neither update persists. Return `True` if committed, `False` if rolled back.',
        '',
        '`run(transfers)` applies each `[src, dst, amount]` and returns `[results, final balances sorted by id]`.',
      ),
      hints: ['`with conn:` commits on success and rolls back on an exception.', 'An UPDATE that matches no row doesn\'t raise — check `cursor.rowcount` and raise yourself.'],
      entry: 'run',
      signature: 'run(transfers: list[list]) -> list',
      starter: code`import sqlite3

def transfer(conn, src, dst, amount):
    pass


# The tests call run(); don't change it.
def run(transfers):
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE accounts (id TEXT PRIMARY KEY, balance REAL CHECK (balance >= 0))")
    conn.executemany("INSERT INTO accounts VALUES (?, ?)", [("a", 100), ("b", 50), ("c", 0)])
    conn.commit()
    results = [transfer(conn, *t) for t in transfers]
    balances = [list(r) for r in conn.execute("SELECT id, balance FROM accounts ORDER BY id")]
    conn.close()
    return [results, balances]
`,
      solution: code`import sqlite3

def transfer(conn, src, dst, amount):
    try:
        with conn:
            if amount <= 0:
                raise ValueError("amount must be positive")
            for account, delta in ((src, -amount), (dst, amount)):
                cur = conn.execute("UPDATE accounts SET balance = balance + ? WHERE id = ?", (delta, account))
                if cur.rowcount != 1:
                    raise LookupError(f"unknown account {account}")
        return True
    except (sqlite3.IntegrityError, ValueError, LookupError):
        return False


def run(transfers):
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE accounts (id TEXT PRIMARY KEY, balance REAL CHECK (balance >= 0))")
    conn.executemany("INSERT INTO accounts VALUES (?, ?)", [("a", 100), ("b", 50), ("c", 0)])
    conn.commit()
    results = [transfer(conn, *t) for t in transfers]
    balances = [list(r) for r in conn.execute("SELECT id, balance FROM accounts ORDER BY id")]
    conn.close()
    return [results, balances]
`,
      explanation: md('A transaction makes a group of statements atomic. If the debit succeeded and the credit failed without a rollback, money would vanish. The connection context manager commits on a clean exit and rolls back on any exception — and the CHECK constraint makes the database itself refuse overdrafts.'),
      tests: [
        ex('Example', [['a', 'b', 30], ['b', 'c', 500], ['a', 'zzz', 10]]),
        ex('Non-positive amount', [['a', 'b', 0]]),
        hid('Exact balance', [['b', 'c', 50], ['c', 'a', 50]]),
        hid('Unknown source', [['nope', 'a', 1]]),
      ],
    }),

    python({
      id: 'fetchmany-batches',
      title: 'Stream a Large Result with fetchmany',
      difficulty: 'Medium',
      topics: ['Database Access (DB-API)', 'Generators & Iterators'],
      patterns: ['Batched cursor reads'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Read query results in fixed-size batches through a generator instead of fetchall().',
      description: md(
        'Write a generator `batches(cursor, size)` that yields lists of rows using `cursor.fetchmany(size)` until it returns an empty list. `run(n_rows, size)` inserts `n_rows` events (value = id × 2), selects them ordered by id, and returns `[batch sizes, sum of values per batch, cursor.fetchone() after exhaustion]`.',
      ),
      hints: ['`while True: rows = cursor.fetchmany(size); if not rows: return; yield rows`.'],
      entry: 'run',
      signature: 'run(n_rows: int, size: int) -> list',
      starter: code`import sqlite3

def batches(cursor, size):
    pass


# The tests call run(); don't change it.
def run(n_rows, size):
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE events (id INTEGER, value INTEGER)")
    conn.executemany("INSERT INTO events VALUES (?, ?)", [(i, i * 2) for i in range(1, n_rows + 1)])
    cur = conn.execute("SELECT id, value FROM events ORDER BY id")
    out = list(batches(cur, size))
    after = cur.fetchone()
    conn.close()
    return [[len(b) for b in out], [sum(v for _, v in b) for b in out], after]
`,
      solution: code`import sqlite3

def batches(cursor, size):
    while True:
        rows = cursor.fetchmany(size)
        if not rows:
            return
        yield rows


def run(n_rows, size):
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE events (id INTEGER, value INTEGER)")
    conn.executemany("INSERT INTO events VALUES (?, ?)", [(i, i * 2) for i in range(1, n_rows + 1)])
    cur = conn.execute("SELECT id, value FROM events ORDER BY id")
    out = list(batches(cur, size))
    after = cur.fetchone()
    conn.close()
    return [[len(b) for b in out], [sum(v for _, v in b) for b in out], after]
`,
      explanation: md('`fetchall()` materialises the whole result in memory; `fetchmany(n)` pulls n rows at a time, so memory stays bounded however large the table is. `fetchone()` returns `None` once the cursor is exhausted. (For server-side databases, use a server-side/named cursor so the database also streams.)'),
      tests: [
        ex('Example', 7, 3),
        ex('Exact multiple', 4, 2),
        hid('Empty table', 0, 5),
        hid('Batch larger than table', 3, 10),
      ],
    }),

    python({
      id: 'insert-json-records',
      title: 'Insert JSON Records into a Table',
      difficulty: 'Medium',
      topics: ['Database Access (DB-API)', 'Parsing (CSV / JSON)'],
      patterns: ['executemany with named parameters'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Load a JSON array of loosely-shaped records into a typed table with named placeholders.',
      description: md(
        'Parse `text` (a JSON array of objects) and insert into `products(sku TEXT PRIMARY KEY, name TEXT, price REAL, tags TEXT)` using `executemany` with **named** placeholders (`:sku, :name, …`). Missing keys become NULL; `tags` (a list) is stored as a comma-joined string. Records without `sku` are skipped. If two records share a sku, the insert fails with `IntegrityError` and nothing is inserted (one transaction).',
        '',
        'Return `[inserted count, all rows ordered by sku]` or `["IntegrityError", 0 rows]`.',
      ),
      hints: ['Build a list of dicts with every key present (`rec.get("name")`), then `conn.executemany(sql, records)`.'],
      entry: 'load_products',
      signature: 'load_products(text: str) -> list',
      solution: code`import json
import sqlite3

def load_products(text: str) -> list:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE products (sku TEXT PRIMARY KEY, name TEXT, price REAL, tags TEXT)")
    records = [
        {"sku": r["sku"], "name": r.get("name"), "price": r.get("price"),
         "tags": ",".join(r["tags"]) if isinstance(r.get("tags"), list) else None}
        for r in json.loads(text) if r.get("sku")
    ]
    try:
        with conn:
            conn.executemany("INSERT INTO products VALUES (:sku, :name, :price, :tags)", records)
        inserted = len(records)
    except sqlite3.IntegrityError:
        inserted = "IntegrityError"
    rows = [list(r) for r in conn.execute("SELECT * FROM products ORDER BY sku")]
    conn.close()
    return [inserted, rows]
`,
      explanation: md('Named placeholders bind values from dicts — natural for JSON. Normalising every record to the full key set first means missing fields become NULL instead of raising. Running `executemany` inside one transaction makes the load all-or-nothing.'),
      tests: [
        ex('Example', '[{"sku": "A1", "name": "Tea", "price": 2.5, "tags": ["hot", "drink"]}, {"sku": "B2", "price": 1}, {"name": "no sku"}]'),
        ex('Duplicate sku rolls back', '[{"sku": "X"}, {"sku": "X"}]'),
        hid('Empty array', '[]'),
        hid('Tags not a list', '[{"sku": "Z", "tags": "x"}]'),
      ],
    }),

    python({
      id: 'upsert-on-conflict',
      title: 'Upsert a Product Catalog',
      difficulty: 'Medium',
      topics: ['Database Access (DB-API)', 'Data Wrangling'],
      patterns: ['INSERT … ON CONFLICT DO UPDATE'],
      domains: ['E-commerce / Sales'],
      roles: DE,
      summary: 'Apply a batch of catalog changes as inserts or updates, only when the incoming version is newer.',
      description: md(
        'Table `catalog(sku TEXT PRIMARY KEY, price REAL, version INTEGER)` starts with `existing` rows. Apply `changes` (`[sku, price, version]`) with a single statement per change: insert new skus; for existing ones update price and version **only if the incoming version is greater**. Return the final table ordered by sku.',
      ),
      hints: ['`INSERT INTO catalog VALUES (?, ?, ?) ON CONFLICT(sku) DO UPDATE SET price = excluded.price, version = excluded.version WHERE excluded.version > catalog.version`.'],
      entry: 'upsert',
      signature: 'upsert(existing: list[list], changes: list[list]) -> list[list]',
      solution: code`import sqlite3

def upsert(existing: list[list], changes: list[list]) -> list[list]:
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE catalog (sku TEXT PRIMARY KEY, price REAL, version INTEGER)")
    conn.executemany("INSERT INTO catalog VALUES (?, ?, ?)", existing)
    with conn:
        conn.executemany(
            """INSERT INTO catalog VALUES (?, ?, ?)
               ON CONFLICT(sku) DO UPDATE SET price = excluded.price, version = excluded.version
               WHERE excluded.version > catalog.version""",
            changes,
        )
    rows = [list(r) for r in conn.execute("SELECT * FROM catalog ORDER BY sku")]
    conn.close()
    return rows
`,
      explanation: md('An upsert does insert-or-update in one atomic statement, avoiding the race in "SELECT, then INSERT or UPDATE". The `WHERE excluded.version > …` guard makes the load **idempotent and order-safe**: replaying an old change, or receiving changes out of order, never overwrites newer data. (MySQL spells it `ON DUPLICATE KEY UPDATE`; Spark/Delta use `MERGE`.)'),
      tests: [
        ex('Example', [['A', 10, 1], ['B', 5, 3]], [['A', 12, 2], ['B', 4, 2], ['C', 7, 1]]),
        ex('Replay is a no-op', [['A', 10, 5]], [['A', 1, 5], ['A', 2, 4]]),
        hid('Empty table', [], [['Z', 1, 1], ['Z', 2, 2]]),
        hid('Out-of-order changes', [], [['K', 3, 3], ['K', 1, 1], ['K', 2, 2]]),
      ],
    }),

    python({
      id: 'cursor-description-dicts',
      title: 'Rows as Dicts with cursor.description',
      difficulty: 'Easy',
      topics: ['Database Access (DB-API)', 'Dicts & Sets'],
      patterns: ['Column names from description'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Turn query results into JSON-ready dicts using the cursor\'s column metadata.',
      description: md(
        'Run `query` against a prepared `employees` table and return the rows as dicts keyed by column name (aliases included), using `cursor.description` — not a hard-coded column list. Return `{"columns": [...], "rows": [...]}`.',
      ),
      hints: ['`cursor.description` is a sequence of 7-tuples; the first item of each is the column name.'],
      entry: 'run',
      signature: 'run(query: str) -> dict',
      starter: code`import sqlite3

def as_dicts(cursor):
    pass


# The tests call run(); don't change it.
def run(query):
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE employees (id INTEGER, name TEXT, dept TEXT, salary INTEGER)")
    conn.executemany("INSERT INTO employees VALUES (?, ?, ?, ?)",
                     [(1, "Ana", "data", 120), (2, "Raj", "data", 100), (3, "Li", "ops", 90)])
    result = as_dicts(conn.execute(query))
    conn.close()
    return result
`,
      solution: code`import sqlite3

def as_dicts(cursor):
    columns = [d[0] for d in cursor.description]
    return {"columns": columns, "rows": [dict(zip(columns, row)) for row in cursor.fetchall()]}


def run(query):
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE employees (id INTEGER, name TEXT, dept TEXT, salary INTEGER)")
    conn.executemany("INSERT INTO employees VALUES (?, ?, ?, ?)",
                     [(1, "Ana", "data", 120), (2, "Raj", "data", 100), (3, "Li", "ops", 90)])
    result = as_dicts(conn.execute(query))
    conn.close()
    return result
`,
      explanation: md('`cursor.description` is part of the DB-API standard, so this works with any driver. sqlite3 also offers `conn.row_factory = sqlite3.Row`, and other drivers have dict cursors — but zipping the description is the portable answer.'),
      tests: [
        ex('Example', 'SELECT name, salary FROM employees WHERE dept = \'data\' ORDER BY salary DESC'),
        ex('Aliases become keys', 'SELECT dept, COUNT(*) AS headcount FROM employees GROUP BY dept ORDER BY dept'),
        hid('No rows', 'SELECT * FROM employees WHERE id = 99'),
        hid('Expressions get their alias', 'SELECT MAX(salary) AS top, MIN(salary) AS low FROM employees'),
      ],
    }),

    python({
      id: 'dynamic-filter-builder',
      title: 'Build a Dynamic WHERE Clause Safely',
      difficulty: 'Medium',
      topics: ['Database Access (DB-API)', 'Strings'],
      patterns: ['Whitelisted identifiers + parameters'],
      domains: ['Reporting'],
      roles: DE,
      summary: 'Turn user-chosen filters into SQL with placeholders, whitelisting columns and operators.',
      description: md(
        'Filters are `[column, op, value]` with op one of `=`, `!=`, `<`, `<=`, `>`, `>=`, `in` (value is a list) or `like`. Build `SELECT id FROM orders WHERE … ORDER BY id` joining filters with `AND` — **values go in as `?` parameters**; columns and operators can\'t be parameters, so only allow columns `status`, `amount`, `country` and the listed operators (anything else → return `"rejected"`). No filters means no `WHERE`.',
        '',
        'Return `[sql, params, ids]` after running it on a prepared table.',
      ),
      hints: ['For `in`, generate `column IN (?, ?, ?)` with one placeholder per value.', 'An empty `in` list can match nothing — use `1 = 0`.'],
      entry: 'run',
      signature: 'run(filters: list[list]) -> list',
      starter: code`import sqlite3

def build_query(filters):
    pass


# The tests call run(); don't change it.
def run(filters):
    built = build_query(filters)
    if built == "rejected":
        return "rejected"
    sql, params = built
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE orders (id INTEGER, status TEXT, amount REAL, country TEXT)")
    conn.executemany("INSERT INTO orders VALUES (?, ?, ?, ?)", [
        (1, "paid", 120, "IN"), (2, "refunded", 30, "US"), (3, "paid", 45.5, "US"),
        (4, "new", 999, "IN"), (5, "paid", 10, "DE")])
    ids = [r[0] for r in conn.execute(sql, params)]
    conn.close()
    return [sql, list(params), ids]
`,
      solution: code`import sqlite3

COLUMNS = {"status", "amount", "country"}
OPS = {"=", "!=", "<", "<=", ">", ">=", "in", "like"}

def build_query(filters):
    clauses, params = [], []
    for column, op, value in filters:
        if column not in COLUMNS or op not in OPS:
            return "rejected"
        if op == "in":
            if not value:
                clauses.append("1 = 0")
                continue
            clauses.append(f"{column} IN ({', '.join('?' for _ in value)})")
            params.extend(value)
        else:
            clauses.append(f"{column} {op.upper()} ?")
            params.append(value)
    sql = "SELECT id FROM orders"
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    return sql + " ORDER BY id", params


def run(filters):
    built = build_query(filters)
    if built == "rejected":
        return "rejected"
    sql, params = built
    conn = sqlite3.connect(":memory:")
    conn.execute("CREATE TABLE orders (id INTEGER, status TEXT, amount REAL, country TEXT)")
    conn.executemany("INSERT INTO orders VALUES (?, ?, ?, ?)", [
        (1, "paid", 120, "IN"), (2, "refunded", 30, "US"), (3, "paid", 45.5, "US"),
        (4, "new", 999, "IN"), (5, "paid", 10, "DE")])
    ids = [r[0] for r in conn.execute(sql, params)]
    conn.close()
    return [sql, list(params), ids]
`,
      explanation: md('Placeholders can only stand for **values**. Identifiers and operators must be interpolated into the SQL text, so they have to come from a whitelist — never from the user verbatim. That split (whitelist structure, parameterise data) is how query builders and ORMs stay injection-safe.'),
      tests: [
        ex('Example', [['status', '=', 'paid'], ['amount', '>', 20]]),
        ex('IN list', [['country', 'in', ['US', 'DE']]]),
        hid('Injection via column name', [['status; DROP TABLE orders; --', '=', 'x']]),
        hid('No filters', []),
        hid('Empty IN and LIKE', [['country', 'in', []]]),
        hid('LIKE pattern', [['status', 'like', 'pa%'], ['country', '!=', 'IN']]),
      ],
    }),
  ],
};
