// Python pack 12 — files and serialisation: JSON (parse, navigate, flatten,
// custom encode/decode), CSV with the csv module, CSV → JSON Lines in chunks,
// pickling with __getstate__/__setstate__, file I/O (modes, append, with),
// schema-tolerant parsing, reconciling duplicate API pulls, and constants
// with Enum.
import { python, md, code, ex, hid } from './define.js';
import { dev, dv, gfg, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'flatten-line-items',
      title: 'Flatten Nested Line Items from a JSON Feed',
      difficulty: 'Medium',
      topics: ['Parsing (CSV / JSON)', 'Error Handling', 'Data Wrangling'],
      patterns: ['Explode nested arrays'],
      domains: ['E-commerce / Sales'],
      ...tag(dv('Microsoft', 'flatten a daily JSON file with nested line_items, skipping malformed records')),
      roles: DE,
      summary: 'Explode transactions with nested line_items into one flat row per item, skipping malformed records.',
      description: md(
        '`text` is a JSON array of transactions: `{"customer_id", "transaction_id", "line_items": [{"item_id", "quantity", "price"}, ...]}`.',
        '',
        'Return one flat row `[customer_id, transaction_id, item_id, quantity, price]` per line item. Skip (and count) **malformed transactions**: missing ids, or `line_items` not a list, or any item missing a field. Return `[rows, malformed_count]`. If `text` itself is not valid JSON, return `[[], -1]`.',
      ),
      hints: ['`json.loads` once, then a nested loop; validate a whole transaction before emitting any of its rows so a bad record is all-or-nothing.'],
      entry: 'flatten',
      signature: 'flatten(text: str) -> list',
      solution: code`import json

ITEM_FIELDS = ("item_id", "quantity", "price")

def flatten(text: str) -> list:
    try:
        txns = json.loads(text)
    except json.JSONDecodeError:
        return [[], -1]
    rows, bad = [], 0
    for t in txns:
        items = t.get("line_items") if isinstance(t, dict) else None
        ok = (
            isinstance(t, dict) and "customer_id" in t and "transaction_id" in t
            and isinstance(items, list)
            and all(isinstance(i, dict) and all(f in i for f in ITEM_FIELDS) for i in items)
        )
        if not ok:
            bad += 1
            continue
        for i in items:
            rows.append([t["customer_id"], t["transaction_id"], i["item_id"], i["quantity"], i["price"]])
    return [rows, bad]
`,
      explanation: md('Exploding nested arrays is the most common JSON → table step (`explode` in Spark, `json_normalize` in pandas). Validating the whole transaction first keeps partial transactions out of the output, and counting malformed records turns silent skips into a metric.'),
      tests: [
        ex('Example', '[{"customer_id": 1, "transaction_id": "t1", "line_items": [{"item_id": "a", "quantity": 2, "price": 3.5}, {"item_id": "b", "quantity": 1, "price": 10}]}, {"customer_id": 2, "line_items": []}]'),
        ex('Invalid JSON', '[{"customer_id": 1,'),
        hid('Item missing a field', '[{"customer_id": 1, "transaction_id": "t", "line_items": [{"item_id": "a", "quantity": 1}]}]'),
        hid('No line items is fine', '[{"customer_id": 3, "transaction_id": "t3", "line_items": []}]'),
        hid('line_items not a list', '[{"customer_id": 4, "transaction_id": "t4", "line_items": "x"}, "junk"]'),
      ],
    }),

    python({
      id: 'json-path-extract',
      title: 'Extract Fields with a Dotted JSON Path',
      difficulty: 'Easy',
      topics: ['Parsing (CSV / JSON)', 'Dicts & Sets'],
      patterns: ['Path navigation'],
      domains: ['APIs / Integration'],
      ...tag(dev('Oracle', 'dicts for JSON extraction')),
      roles: DE,
      summary: 'Parse a JSON document and read values like "order.lines[1].sku".',
      description: md(
        'Parse `text` as JSON and evaluate each path in `paths`. A path is dot-separated keys with optional `[n]` indexes: `"order.lines[1].sku"`, `"meta.tags[0]"`, `"count"`. Return the value or `None` if the path doesn\'t exist.',
      ),
      hints: ['`re.findall(r"[^.\\[\\]]+|\\[\\d+\\]", path)` splits a path into keys and `[n]` steps.'],
      entry: 'extract',
      signature: 'extract(text: str, paths: list[str]) -> list',
      solution: code`import json
import re

def extract(text: str, paths: list[str]) -> list:
    doc = json.loads(text)
    out = []
    for path in paths:
        node = doc
        try:
            for step in re.findall(r"[^.\[\]]+|\[\d+\]", path):
                node = node[int(step[1:-1])] if step.startswith("[") else node[step]
        except (KeyError, IndexError, TypeError):
            node = None
        out.append(node)
    return out
`,
      explanation: md('`json.loads` maps objects → dicts and arrays → lists, so a path is just a chain of `[...]` lookups. Tokenising with one regex handles keys and indexes uniformly; catching the three lookup errors covers every "path doesn\'t exist" case.'),
      tests: [
        ex('Example', '{"order": {"id": 7, "lines": [{"sku": "A"}, {"sku": "B"}]}, "meta": {"tags": ["x"]}}', ['order.lines[1].sku', 'meta.tags[0]', 'order.id']),
        ex('Missing paths', '{"a": [1]}', ['a[5]', 'b', 'a.c']),
        hid('Top-level array', '[{"v": 1}, {"v": 2}]', ['[1].v']),
        hid('Null values exist', '{"x": null, "y": {"z": false}}', ['x', 'y.z']),
      ],
    }),

    python({
      id: 'json-custom-encoder',
      title: 'Serialise Dates, Decimals and Sets to JSON',
      difficulty: 'Medium',
      topics: ['Serialization', 'Datetime'],
      patterns: ['json.dumps default hook'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Write a default= hook so json.dumps can handle types it doesn\'t know about.',
      description: md(
        '`json.dumps` fails on `date`, `datetime`, `Decimal` and `set`. Write `encode(record)` that returns `json.dumps(record, default=..., sort_keys=True)` where dates/datetimes become ISO strings, `Decimal` becomes a **string** (to keep precision), sets become sorted lists, and any other unknown type raises `TypeError`.',
        '',
        '`run(case)` builds a record with those types from a small spec and returns the JSON text or `"TypeError"`.',
      ),
      hints: ['`default` is only called for objects `json` can\'t serialise; return something it can.', 'Check `datetime` before `date` (a datetime **is** a date).'],
      entry: 'run',
      signature: 'run(case: str) -> str',
      starter: code`import json
from datetime import date, datetime
from decimal import Decimal

def encode(record):
    pass


# The tests call run(); don't change it.
def run(case):
    records = {
        "order": {"id": 1, "placed": datetime(2024, 3, 5, 14, 30), "ship_by": date(2024, 3, 9),
                  "total": Decimal("19.990"), "tags": {"gift", "express"}},
        "plain": {"a": 1, "b": [1, 2]},
        "unknown": {"cb": complex(1, 2)},
        "empty": {},
    }
    try:
        return encode(records[case])
    except TypeError:
        return "TypeError"
`,
      solution: code`import json
from datetime import date, datetime
from decimal import Decimal

def _default(o):
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    if isinstance(o, Decimal):
        return str(o)
    if isinstance(o, (set, frozenset)):
        return sorted(o)
    raise TypeError(f"{type(o).__name__} is not JSON serialisable")

def encode(record):
    return json.dumps(record, default=_default, sort_keys=True)


def run(case):
    records = {
        "order": {"id": 1, "placed": datetime(2024, 3, 5, 14, 30), "ship_by": date(2024, 3, 9),
                  "total": Decimal("19.990"), "tags": {"gift", "express"}},
        "plain": {"a": 1, "b": [1, 2]},
        "unknown": {"cb": complex(1, 2)},
        "empty": {},
    }
    try:
        return encode(records[case])
    except TypeError:
        return "TypeError"
`,
      explanation: md('The `default` hook is the extension point of the JSON encoder: called once per unsupported object, it returns a serialisable stand-in. Money as a string avoids float rounding; raising `TypeError` for unknown types keeps the encoder from silently writing garbage (e.g. `str(obj)`).'),
      tests: [
        ex('Rich record', 'order'),
        ex('Plain record', 'plain'),
        hid('Unknown type', 'unknown'),
        hid('Empty record', 'empty'),
      ],
    }),

    python({
      id: 'json-object-hook',
      title: 'Decode JSON into Rich Types with object_hook',
      difficulty: 'Medium',
      topics: ['Serialization', 'Datetime', 'Parsing (CSV / JSON)'],
      patterns: ['json.loads object_hook'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Turn ISO date strings and money strings back into date and Decimal objects while parsing.',
      description: md(
        'Write `decode(text)` using `json.loads(text, object_hook=...)`: in every JSON object, a key ending in `_at` holding an ISO datetime string becomes a `datetime`, a key ending in `_on` becomes a `date`, and a key ending in `_amount` holding a string becomes a `Decimal`. Leave everything else alone.',
        '',
        '`run(text)` decodes and returns a description: for every top-level key, `[key, type name, str(value)]`, sorted by key.',
      ),
      hints: ['`object_hook` is called with every decoded dict (innermost first) and its return value replaces the dict.'],
      entry: 'run',
      signature: 'run(text: str) -> list',
      starter: code`import json
from datetime import date, datetime
from decimal import Decimal

def decode(text):
    pass


# The tests call run(); don't change it.
def run(text):
    doc = decode(text)
    return [[k, type(v).__name__, str(v)] for k, v in sorted(doc.items())]
`,
      solution: code`import json
from datetime import date, datetime
from decimal import Decimal

def _hook(obj):
    for key, value in obj.items():
        if not isinstance(value, str):
            continue
        if key.endswith("_at"):
            obj[key] = datetime.fromisoformat(value)
        elif key.endswith("_on"):
            obj[key] = date.fromisoformat(value)
        elif key.endswith("_amount"):
            obj[key] = Decimal(value)
    return obj

def decode(text):
    return json.loads(text, object_hook=_hook)


def run(text):
    doc = decode(text)
    return [[k, type(v).__name__, str(v)] for k, v in sorted(doc.items())]
`,
      explanation: md('JSON has no date or decimal types, so APIs send strings and a naming convention. Doing the conversion in `object_hook` means the rest of the code only ever sees proper Python types, at every nesting level.'),
      tests: [
        ex('Example', '{"created_at": "2024-05-01T10:00:00", "due_on": "2024-05-31", "net_amount": "12.50", "id": 7}'),
        ex('Nothing to convert', '{"name": "x", "count_amount": 3}'),
        hid('Nested objects', '{"order": {"paid_at": "2024-01-02T03:04:05"}, "z": null}'),
        hid('Non-string values untouched', '{"x_at": 5, "y_on": null, "z_amount": 1.5}'),
      ],
    }),

    python({
      id: 'pickle-getstate',
      title: 'Pickle an Object but Not Its Cache',
      difficulty: 'Medium',
      topics: ['Serialization', 'OOP'],
      patterns: ['__getstate__ / __setstate__'],
      domains: ['Machine learning'],
      roles: DE,
      summary: 'Control what pickle saves so a lookup table drops its cache and lock, then rebuilds them.',
      description: md(
        '`Lookup(name, mapping)` keeps a `_cache` dict of recent hits and a `_lock` (a `threading.Lock`, which **can\'t** be pickled). Implement `__getstate__` (save everything except `_cache` and `_lock`) and `__setstate__` (restore and recreate an empty cache and a new lock), plus `get(key)` that uses the cache.',
        '',
        '`run(name, mapping, keys)` warms the cache, pickles and unpickles the object, and returns `[restored name, restored mapping, len(cache before), len(cache after), restored.get(keys[0]) if keys else None]`.',
      ),
      hints: ['Copy `self.__dict__`, delete the unpicklable keys, return the copy.', '`__setstate__(self, state)` receives that dict.'],
      entry: 'run',
      signature: 'run(name: str, mapping: dict, keys: list[str]) -> list',
      starter: code`import pickle
import sys
import threading
import types

class Lookup:
    def __init__(self, name, mapping):
        self.name = name
        self.mapping = dict(mapping)
        self._cache = {}
        self._lock = threading.Lock()

    def get(self, key):
        pass


# The tests call run(); don't change it.
def run(name, mapping, keys):
    # pickle stores classes by module + name; make this file's module importable.
    module = types.ModuleType(Lookup.__module__)
    module.Lookup = Lookup
    sys.modules[module.__name__] = module
    lk = Lookup(name, mapping)
    for k in keys:
        lk.get(k)
    before = len(lk._cache)
    restored = pickle.loads(pickle.dumps(lk))
    return [restored.name, restored.mapping, before, len(restored._cache), restored.get(keys[0]) if keys else None]
`,
      solution: code`import pickle
import sys
import threading
import types

class Lookup:
    def __init__(self, name, mapping):
        self.name = name
        self.mapping = dict(mapping)
        self._cache = {}
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            if key not in self._cache:
                self._cache[key] = self.mapping.get(key)
            return self._cache[key]

    def __getstate__(self):
        state = self.__dict__.copy()
        del state["_cache"], state["_lock"]
        return state

    def __setstate__(self, state):
        self.__dict__.update(state)
        self._cache = {}
        self._lock = threading.Lock()


def run(name, mapping, keys):
    # pickle stores classes by module + name; make this file's module importable.
    module = types.ModuleType(Lookup.__module__)
    module.Lookup = Lookup
    sys.modules[module.__name__] = module
    lk = Lookup(name, mapping)
    for k in keys:
        lk.get(k)
    before = len(lk._cache)
    restored = pickle.loads(pickle.dumps(lk))
    return [restored.name, restored.mapping, before, len(restored._cache), restored.get(keys[0]) if keys else None]
`,
      explanation: md('Pickle saves an object\'s `__dict__` by default. Locks, open files and connections can\'t be pickled, and caches shouldn\'t be — `__getstate__`/`__setstate__` let you choose. (Only unpickle data you trust: loading a pickle can run arbitrary code.)'),
      tests: [
        ex('Example', 'fx', { USD: 1.0, EUR: 0.92 }, ['EUR', 'USD', 'GBP']),
        ex('No warm-up', 'empty', { a: 1 }, []),
        hid('Repeated keys', 'k', { x: 9 }, ['x', 'x', 'x']),
        hid('Unknown key caches None', 'm', { a: 1 }, ['zzz']),
      ],
    }),

    python({
      id: 'csv-module-quoting',
      title: 'Parse CSV Properly with the csv Module',
      difficulty: 'Easy',
      topics: ['Parsing (CSV / JSON)'],
      patterns: ['csv.DictReader over StringIO'],
      domains: ['E-commerce / Sales'],
      roles: DE,
      summary: 'Read CSV with quoted commas and escaped quotes — the cases split(",") gets wrong.',
      description: md(
        'Parse `text` (CSV with a header row; fields may be quoted and contain commas, doubled quotes `""` and newlines) and return the rows as dicts with values stripped. Also return how many rows a naive `line.split(",")` would have mis-parsed (a data line whose naive field count differs from the header\'s).',
        '',
        'Return `[rows, naive_mistakes]`.',
      ),
      hints: ['`csv.DictReader(io.StringIO(text))` handles quoting and embedded newlines.'],
      entry: 'parse_csv',
      signature: 'parse_csv(text: str) -> list',
      solution: code`import csv
import io

def parse_csv(text: str) -> list:
    rows = [{k: v.strip() for k, v in r.items()} for r in csv.DictReader(io.StringIO(text))]
    lines = text.splitlines()
    width = len(lines[0].split(",")) if lines else 0
    naive_mistakes = sum(1 for line in lines[1:] if line and len(line.split(",")) != width)
    return [rows, naive_mistakes]
`,
      explanation: md('Real CSV has quoting rules (RFC 4180): commas and newlines inside quotes, `""` for a literal quote. Hand-rolled `split(",")` breaks on all of them; the `csv` module (or pandas) is the only safe way to parse it.'),
      tests: [
        ex('Example', 'id,name,city\n1,"Lee, Ana",Pune\n2,"Say ""hi""",Goa\n'),
        ex('Simple file', 'a,b\n1,2\n'),
        hid('Header only', 'x,y\n'),
        hid('Embedded newline', 'id,note\n7,"line one\nline two"\n'),
      ],
    }),

    python({
      id: 'csv-to-ldjson-chunks',
      title: 'Convert CSV to JSON Lines in Chunks',
      difficulty: 'Medium',
      topics: ['Parsing (CSV / JSON)', 'Generators & Iterators', 'Serialization'],
      patterns: ['Chunked conversion'],
      domains: ['Event pipelines'],
      ...tag(dev('Bloomberg', 'chunked CSV to LDJSON processor')),
      roles: DE,
      summary: 'Stream CSV rows into newline-delimited JSON files of at most n records, with typed values.',
      description: md(
        'Convert CSV `text` (with a header) into chunks of newline-delimited JSON (one JSON object per line), at most `chunk_size` records per chunk. Convert values: integers → int, decimals → float, `""` → `null`, everything else stays a string. Use compact JSON (`separators=(",", ":")`) with keys in header order.',
        '',
        'Return the list of chunk strings (each chunk\'s lines joined by `"\\n"`, with a trailing newline).',
      ),
      hints: ['Read with `csv.DictReader`, group with `itertools.islice` (or a counter), and write each chunk with `"\\n".join(json.dumps(...))`.'],
      entry: 'to_ldjson',
      signature: 'to_ldjson(text: str, chunk_size: int) -> list[str]',
      solution: code`import csv
import io
import json
from itertools import islice

def _typed(v):
    if v == "":
        return None
    for cast in (int, float):
        try:
            return cast(v)
        except ValueError:
            pass
    return v

def to_ldjson(text: str, chunk_size: int) -> list[str]:
    reader = csv.DictReader(io.StringIO(text))
    chunks = []
    while True:
        batch = list(islice(reader, chunk_size))
        if not batch:
            return chunks
        lines = [json.dumps({k: _typed(v) for k, v in row.items()}, separators=(",", ":")) for row in batch]
        chunks.append("\n".join(lines) + "\n")
`,
      explanation: md('JSON Lines is the lingua franca of data loading (BigQuery, Snowflake, Spark all read it), and chunking keeps files at a size loaders like. Reading through `DictReader` + `islice` never holds more than one chunk in memory.'),
      tests: [
        ex('Example', 'id,price,name\n1,9.5,tea\n2,,cake\n3,10,bun\n', 2),
        ex('Single chunk', 'a\nx\n', 5),
        hid('Header only', 'a,b\n', 3),
        hid('Leading zeros and exponents become numbers', 'code,qty\n007,1e3\nabc,-4\n', 1),
      ],
    }),

    python({
      id: 'schema-tolerant-parsing',
      title: 'Parse Records from Three Schema Versions',
      difficulty: 'Medium',
      topics: ['Parsing (CSV / JSON)', 'Data Wrangling', 'Error Handling'],
      patterns: ['Schema normalisation'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Normalise events whose producers renamed fields over time into one canonical shape.',
      description: md(
        'Events arrive as JSON strings from producers on three schema versions:',
        '',
        '- v1: `{"uid", "evt", "ts"}` (ts = epoch seconds);',
        '- v2: `{"user_id", "event", "timestamp"}` (ISO string `"YYYY-MM-DDTHH:MM:SS"`, UTC);',
        '- v3: `{"user": {"id"}, "event": {"name"}, "occurred_at"}` (ISO string).',
        '',
        'Return `[canonical, rejected]`: canonical rows `[user_id (str), event (lowercase), epoch_seconds (int)]` sorted by time then user, and the count of lines that are invalid JSON or match no version.',
      ),
      hints: ['Try each version\'s extractor in turn; the first that succeeds wins.', '`datetime.fromisoformat(s).replace(tzinfo=timezone.utc).timestamp()` converts ISO UTC to epoch.'],
      entry: 'normalise_events',
      signature: 'normalise_events(lines: list[str]) -> list',
      solution: code`import json
from datetime import datetime, timezone

def _epoch(iso):
    return int(datetime.fromisoformat(iso).replace(tzinfo=timezone.utc).timestamp())

EXTRACTORS = [
    lambda d: (d["uid"], d["evt"], int(d["ts"])),
    lambda d: (d["user_id"], d["event"], _epoch(d["timestamp"])),
    lambda d: (d["user"]["id"], d["event"]["name"], _epoch(d["occurred_at"])),
]

def normalise_events(lines: list[str]) -> list:
    rows, rejected = [], 0
    for line in lines:
        try:
            doc = json.loads(line)
        except json.JSONDecodeError:
            rejected += 1
            continue
        for extract in EXTRACTORS:
            try:
                user, event, ts = extract(doc)
            except (KeyError, TypeError, ValueError):
                continue
            if isinstance(event, str):
                rows.append([str(user), event.lower(), ts])
                break
        else:
            rejected += 1
    rows.sort(key=lambda r: (r[2], r[0]))
    return [rows, rejected]
`,
      explanation: md('Producers evolve independently, so consumers must accept every live version. A list of extractors tried in order keeps each version\'s logic in one line, and anything that matches none of them is counted, not silently dropped. Note v2 has `"event"` as a string while v3 has it as an object — the extractor\'s `TypeError` routes each to the right version.'),
      tests: [
        ex('Example', ['{"uid": 7, "evt": "Click", "ts": 1700000000}', '{"user_id": "u2", "event": "VIEW", "timestamp": "2023-11-14T22:13:20"}', '{"user": {"id": "u3"}, "event": {"name": "buy"}, "occurred_at": "2023-11-14T22:13:21"}', 'not json', '{"foo": 1}']),
        ex('Empty', []),
        hid('Bad timestamp is rejected', ['{"user_id": "u", "event": "x", "timestamp": "yesterday"}']),
        hid('Ties sorted by user', ['{"uid": "b", "evt": "e", "ts": 5}', '{"uid": "a", "evt": "e", "ts": 5}']),
      ],
    }),

    python({
      id: 'reconcile-vendor-pulls',
      title: 'Reconcile Duplicate Vendor Pulls',
      difficulty: 'Medium',
      topics: ['Parsing (CSV / JSON)', 'Data Wrangling', 'Dicts & Sets'],
      patterns: ['Latest-wins merge with null handling'],
      domains: ['Logistics'],
      ...tag(dev('Tesla', 'HTTP snapshots, JSON hygiene and merge semantics (reconciling duplicate vendor pulls)')),
      roles: DE,
      summary: 'Merge overlapping API snapshots: latest updated_at wins per field, but nulls never erase data.',
      description: md(
        'Several pulls of the same vendor API (JSON arrays as strings) contain overlapping parts records `{"part_id", "updated_at", ...fields}`. Merge them into one record per `part_id`:',
        '',
        '- process records in `updated_at` order (ISO strings; ties → later pull wins);',
        '- a newer record overwrites fields **except** where its value is `null` (a null means "not sent", not "erase");',
        '- the merged `updated_at` is the latest seen.',
        '',
        'Return the merged records sorted by `part_id`, with keys sorted.',
      ),
      hints: ['Flatten all pulls into `(updated_at, pull_index, record)` tuples and sort them.', 'Update a per-part dict with `{k: v for k, v in rec.items() if v is not None}`.'],
      entry: 'reconcile',
      signature: 'reconcile(pulls: list[str]) -> list[dict]',
      solution: code`import json

def reconcile(pulls: list[str]) -> list[dict]:
    records = []
    for i, text in enumerate(pulls):
        for rec in json.loads(text):
            records.append((rec["updated_at"], i, rec))
    merged = {}
    for _, _, rec in sorted(records, key=lambda t: (t[0], t[1])):
        current = merged.setdefault(rec["part_id"], {})
        current.update({k: v for k, v in rec.items() if v is not None})
    return [dict(sorted(merged[p].items())) for p in sorted(merged)]
`,
      explanation: md('Ordering by event time (not by arrival) makes the merge deterministic even when pulls overlap or arrive out of order. Treating `null` as "unknown" is a deliberate merge semantic — the opposite choice (null erases) is also valid, but it must be decided and documented.'),
      tests: [
        ex('Example', ['[{"part_id": "p1", "updated_at": "2024-01-02", "price": 10, "stock": 5}]', '[{"part_id": "p1", "updated_at": "2024-01-03", "price": 12, "stock": null}, {"part_id": "p2", "updated_at": "2024-01-01", "price": 3}]']),
        ex('Older pull arriving later loses', ['[{"part_id": "x", "updated_at": "2024-05-02", "v": "new"}]', '[{"part_id": "x", "updated_at": "2024-05-01", "v": "old"}]']),
        hid('Same timestamp — later pull wins', ['[{"part_id": "a", "updated_at": "t", "v": 1}]', '[{"part_id": "a", "updated_at": "t", "v": 2}]']),
        hid('No pulls', []),
      ],
    }),

    python({
      id: 'status-enum-constants',
      title: 'Constants with Enum Instead of Magic Strings',
      difficulty: 'Easy',
      topics: ['OOP', 'Data Wrangling'],
      patterns: ['Enum for constants'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Model job statuses as an Enum, parse messy inputs into it, and use its ordering.',
      description: md(
        'Define `class Status(Enum)` with members `QUEUED = 1`, `RUNNING = 2`, `SUCCEEDED = 3`, `FAILED = 4`. Write `parse(value)` that accepts a member name in any case/spacing (`" running "`), or its number (`2` or `"2"`), and raises `ValueError` otherwise.',
        '',
        '`run(values)` returns, for each input, `[member name, member value, is_terminal]` (terminal = SUCCEEDED or FAILED) or `"invalid"`; then appends the name of the **furthest** status reached (highest value) among the valid ones (or `None`).',
      ),
      hints: ['`Status[name]` looks up by name, `Status(value)` by value — each raises on a miss (`KeyError` / `ValueError`).'],
      entry: 'run',
      signature: 'run(values: list) -> list',
      starter: code`from enum import Enum

class Status(Enum):
    pass

def parse(value):
    pass


# The tests call run(); don't change it.
def run(values):
    out, valid = [], []
    for v in values:
        try:
            s = parse(v)
        except ValueError:
            out.append("invalid")
            continue
        valid.append(s)
        out.append([s.name, s.value, s in (Status.SUCCEEDED, Status.FAILED)])
    out.append(max(valid, key=lambda s: s.value).name if valid else None)
    return out
`,
      solution: code`from enum import Enum

class Status(Enum):
    QUEUED = 1
    RUNNING = 2
    SUCCEEDED = 3
    FAILED = 4

def parse(value):
    if isinstance(value, int) and not isinstance(value, bool):
        return Status(value)
    text = str(value).strip()
    if text.isdigit():
        return Status(int(text))
    try:
        return Status[text.upper()]
    except KeyError:
        raise ValueError(f"unknown status {value!r}") from None


def run(values):
    out, valid = [], []
    for v in values:
        try:
            s = parse(v)
        except ValueError:
            out.append("invalid")
            continue
        valid.append(s)
        out.append([s.name, s.value, s in (Status.SUCCEEDED, Status.FAILED)])
    out.append(max(valid, key=lambda s: s.value).name if valid else None)
    return out
`,
      explanation: md('Scattering `"running"` strings through a codebase invites typos that fail silently. An `Enum` gives one source of truth, readable names, values for storage, and a closed set of members — a typo becomes an error at the boundary where data is parsed.'),
      tests: [
        ex('Example', [' running ', 3, 'FAILED', 'paused', '1']),
        ex('Nothing valid', ['x', 99]),
        hid('Case-insensitive names', ['Queued', 'queued']),
        hid('Bool is not a number', [true]),
      ],
    }),

    python({
      id: 'file-modes-append',
      title: 'Write, Append and Read Back a File',
      difficulty: 'Easy',
      topics: ['Parsing (CSV / JSON)', 'Error Handling'],
      patterns: ['with open(...) modes'],
      domains: ['Event pipelines'],
      ...tag(gfg('LTIMindtree', 'Python file handling questions')),
      roles: DE,
      summary: 'Use "w", "a", "x" and "r" modes correctly to build and read a small checkpoint log.',
      description: md(
        'Implement `checkpoint(path, batches)`: create the file with mode `"x"` (fail if it exists), write a header line `"batch,rows"`, then for each batch **reopen in append mode** and write `"<name>,<rows>"`. Finally read it back with mode `"r"` and return the list of lines.',
        '',
        'If the file already exists, return `["exists"]` and don\'t touch it. `run(batches, pre_existing)` uses a fresh temporary path (and creates it first when `pre_existing` is true).',
      ),
      hints: ['`open(path, "x")` raises `FileExistsError` if the file exists.', 'Always open files with `with` so they are closed (and flushed) even on errors.'],
      entry: 'run',
      signature: 'run(batches: list[list], pre_existing: bool) -> list[str]',
      starter: code`import os
import tempfile

def checkpoint(path, batches):
    pass


# The tests call run(); don't change it.
def run(batches, pre_existing):
    path = os.path.join(tempfile.mkdtemp(), "checkpoint.csv")
    if pre_existing:
        with open(path, "w") as f:
            f.write("old\n")
    return checkpoint(path, batches)
`,
      solution: code`import os
import tempfile

def checkpoint(path, batches):
    try:
        with open(path, "x") as f:
            f.write("batch,rows\n")
    except FileExistsError:
        return ["exists"]
    for name, rows in batches:
        with open(path, "a") as f:
            f.write(f"{name},{rows}\n")
    with open(path, "r") as f:
        return f.read().splitlines()


def run(batches, pre_existing):
    path = os.path.join(tempfile.mkdtemp(), "checkpoint.csv")
    if pre_existing:
        with open(path, "w") as f:
            f.write("old\n")
    return checkpoint(path, batches)
`,
      explanation: md('`"w"` truncates, `"a"` appends, `"x"` creates exclusively (safe against clobbering someone else\'s file), `"r"` reads. The `with` block closes the file — and flushes buffered writes — the moment it ends, which is why the read sees everything that was appended.'),
      tests: [
        ex('Example', [['b1', 100], ['b2', 250]], false),
        ex('File already exists', [['b1', 1]], true),
        hid('No batches', [], false),
        hid('Single batch', [['only', 0]], false),
      ],
    }),

    python({
      id: 'log-aggregation-text',
      title: 'Aggregate an Application Log',
      difficulty: 'Medium',
      topics: ['Parsing (CSV / JSON)', 'Hash Maps & Counting', 'Datetime'],
      patterns: ['Parse → bucket → count'],
      domains: ['Web server logs'],
      ...tag(dev('Google', 'file I/O and log aggregation')),
      roles: DE,
      summary: 'Count log levels and find the busiest hour for errors from raw log text.',
      description: md(
        'Each log line looks like `2024-05-01 13:45:10 ERROR [payments] message…`. Ignore lines that don\'t match that shape. Return a dict:',
        '',
        '- `"levels"`: count per level (sorted by level name);',
        '- `"error_services"`: services with at least one ERROR, sorted;',
        '- `"peak_error_hour"`: the `"YYYY-MM-DD HH"` hour with the most ERRORs (earliest on ties), or `None`.',
      ),
      hints: ['`line.split(maxsplit=4)` gives date, time, level, `[service]`, message.', 'A `Counter` keyed by `f"{date} {time[:2]}"` finds the busiest hour.'],
      entry: 'summarise_log',
      signature: 'summarise_log(text: str) -> dict',
      solution: code`from collections import Counter

def summarise_log(text: str) -> dict:
    levels = Counter()
    error_services = set()
    error_hours = Counter()
    for line in text.splitlines():
        parts = line.split(maxsplit=4)
        if len(parts) < 4 or not (parts[3].startswith("[") and parts[3].endswith("]")):
            continue
        date, time, level, service = parts[0], parts[1], parts[2], parts[3][1:-1]
        if len(date) != 10 or len(time) != 8:
            continue
        levels[level] += 1
        if level == "ERROR":
            error_services.add(service)
            error_hours[f"{date} {time[:2]}"] += 1
    peak = min(error_hours, key=lambda h: (-error_hours[h], h)) if error_hours else None
    return {"levels": dict(sorted(levels.items())), "error_services": sorted(error_services), "peak_error_hour": peak}
`,
      explanation: md('Log analysis is parse → filter → bucket → count. `split(maxsplit=4)` keeps the free-text message (which may contain spaces) in one piece. `min` with `(-count, hour)` picks the highest count and breaks ties by the earliest hour.'),
      tests: [
        ex('Example', '2024-05-01 13:45:10 ERROR [payments] card declined\n2024-05-01 13:59:59 ERROR [orders] timeout\n2024-05-01 14:00:01 INFO [orders] ok\ngarbage line\n2024-05-01 14:10:00 ERROR [payments] retry failed'),
        ex('No errors', '2024-01-01 00:00:00 INFO [x] started'),
        hid('Empty log', ''),
        hid('Tie goes to the earlier hour', '2024-01-01 09:00:00 ERROR [a] x\n2024-01-01 08:00:00 ERROR [b] y'),
      ],
    }),
  ],
};
