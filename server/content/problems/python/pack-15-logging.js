// Python pack 15 — logging: logger objects, levels and filtering, formatting
// log messages, handlers that write to a stream, logging exception details,
// filters for redaction, and an ETL run summary built from log records.
// Each problem captures logs in a StringIO handler so the output can be graded.
import { python, md, code, ex, hid } from './define.js';
import { dev, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'logger-with-format',
      title: 'Create a Logger and Format Its Messages',
      difficulty: 'Easy',
      topics: ['Logging'],
      patterns: ['Logger + handler + formatter'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Configure a named logger that writes "LEVEL name: message" lines to a stream.',
      description: md(
        'Write `make_logger(name, stream, level)` returning a `logging.Logger` named `name` that writes to `stream` with format `"%(levelname)s %(name)s: %(message)s"`, at the given minimum level (a string like `"INFO"`), and does **not** propagate to the root logger. Calling it twice with the same name must not add a second handler (no duplicate lines).',
        '',
        '`run(level, messages)` logs each `[level, text]` and returns the captured lines.',
      ),
      hints: ['`logging.getLogger(name)` returns the same object for the same name — clear `logger.handlers` (or check them) before adding.', '`logger.setLevel("INFO")` accepts level names.'],
      entry: 'run',
      signature: 'run(level: str, messages: list[list[str]]) -> list[str]',
      starter: code`import io
import logging

def make_logger(name, stream, level):
    pass


# The tests call run(); don't change it.
def run(level, messages):
    stream = io.StringIO()
    make_logger("etl.load", stream, level)
    log = make_logger("etl.load", stream, level)     # second call: must not duplicate output
    for lvl, text in messages:
        log.log(logging.getLevelName(lvl), text)
    return stream.getvalue().splitlines()
`,
      solution: code`import io
import logging

def make_logger(name, stream, level):
    logger = logging.getLogger(name)
    logger.handlers.clear()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(level)
    logger.propagate = False
    return logger


def run(level, messages):
    stream = io.StringIO()
    make_logger("etl.load", stream, level)
    log = make_logger("etl.load", stream, level)
    for lvl, text in messages:
        log.log(logging.getLevelName(lvl), text)
    return stream.getvalue().splitlines()
`,
      explanation: md('Loggers are singletons per name, so naive setup code that adds a handler on every call produces duplicated log lines — a very common bug in notebooks and Lambda functions. The formatter controls the line layout; `propagate = False` stops the root logger from printing a second copy.'),
      tests: [
        ex('Example', 'INFO', [['DEBUG', 'connecting'], ['INFO', 'loaded 10 rows'], ['ERROR', 'disk full']]),
        ex('Warnings and above', 'WARNING', [['INFO', 'skip me'], ['WARNING', 'slow query']]),
        hid('Debug shows everything', 'DEBUG', [['DEBUG', 'x'], ['CRITICAL', 'y']]),
        hid('Nothing logged', 'INFO', []),
      ],
    }),

    python({
      id: 'logging-levels-filter',
      title: 'Logging Levels: What Gets Through?',
      difficulty: 'Easy',
      topics: ['Logging'],
      patterns: ['Logger level vs handler level'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Two handlers with different levels on one logger — predict and capture what each receives.',
      description: md(
        'Set up a logger at `logger_level` with two handlers: a "console" handler at `console_level` and an "alerts" handler at `alert_level`, each writing `"%(levelname)s:%(message)s"` to its own stream. Log every message in `messages` (`[level, text]`) and return `{"console": [...lines], "alerts": [...lines]}`.',
      ),
      hints: ['A record must pass the **logger\'s** level first, then each handler\'s level separately.'],
      entry: 'route_logs',
      signature: 'route_logs(logger_level: str, console_level: str, alert_level: str, messages: list[list[str]]) -> dict',
      solution: code`import io
import logging

def route_logs(logger_level: str, console_level: str, alert_level: str, messages: list[list[str]]) -> dict:
    logger = logging.getLogger("router")
    logger.handlers.clear()
    logger.propagate = False
    logger.setLevel(logger_level)
    streams = {}
    for name, level in (("console", console_level), ("alerts", alert_level)):
        streams[name] = io.StringIO()
        h = logging.StreamHandler(streams[name])
        h.setLevel(level)
        h.setFormatter(logging.Formatter("%(levelname)s:%(message)s"))
        logger.addHandler(h)
    for level, text in messages:
        logger.log(logging.getLevelName(level), text)
    return {name: s.getvalue().splitlines() for name, s in streams.items()}
`,
      explanation: md('Levels are a two-stage filter: `DEBUG < INFO < WARNING < ERROR < CRITICAL`. The logger level gates everything; each handler then applies its own threshold — which is how one logger sends everything to a file but only errors to a pager.'),
      tests: [
        ex('Example', 'INFO', 'INFO', 'ERROR', [['DEBUG', 'd'], ['INFO', 'i'], ['ERROR', 'e'], ['CRITICAL', 'c']]),
        ex('Logger level wins', 'ERROR', 'DEBUG', 'DEBUG', [['INFO', 'hidden'], ['ERROR', 'shown']]),
        hid('Nothing to alert', 'DEBUG', 'DEBUG', 'CRITICAL', [['WARNING', 'w']]),
        hid('Console stricter than alerts', 'DEBUG', 'ERROR', 'WARNING', [['WARNING', 'w'], ['ERROR', 'e']]),
      ],
    }),

    python({
      id: 'etl-logging-summary',
      title: 'An ETL Step That Logs and Summarises',
      difficulty: 'Medium',
      topics: ['Logging', 'Error Handling', 'Parsing (CSV / JSON)'],
      patterns: ['Validate, log, summarise'],
      domains: ['Payments'],
      ...tag(dev('Stripe', 'end-to-end ETL with validation and a logging summary')),
      roles: DE,
      summary: 'Load CSV rows, log a WARNING per rejected row and an INFO summary at the end.',
      description: md(
        'Process CSV `text` with header `id,amount,currency`: a row is valid when `amount` parses as a float > 0 and `currency` is one of `USD`, `EUR`, `INR`. For each invalid row log `WARNING row <n>: <reason>` (n = data row number from 1; reason `"bad amount"` or `"bad currency"`, amount checked first). At the end log `INFO loaded <ok> rows, rejected <bad>, total <sum by currency>` where the sum is like `EUR=10.5 USD=3.0` (currencies sorted, totals rounded to 2).',
        '',
        'Return the captured log lines (format `"%(levelname)s %(message)s"`).',
      ),
      hints: ['Use `logger.warning("row %d: %s", n, reason)` — lazy formatting.', '`csv.DictReader` handles the header.'],
      entry: 'load_payments',
      signature: 'load_payments(text: str) -> list[str]',
      solution: code`import csv
import io
import logging

CURRENCIES = {"USD", "EUR", "INR"}

def load_payments(text: str) -> list[str]:
    stream = io.StringIO()
    log = logging.getLogger("payments.load")
    log.handlers.clear()
    log.propagate = False
    log.setLevel(logging.INFO)
    h = logging.StreamHandler(stream)
    h.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    log.addHandler(h)

    ok = bad = 0
    totals = {}
    for n, row in enumerate(csv.DictReader(io.StringIO(text)), start=1):
        try:
            amount = float(row["amount"])
            if amount <= 0:
                raise ValueError
        except (ValueError, TypeError):
            log.warning("row %d: %s", n, "bad amount")
            bad += 1
            continue
        if row["currency"] not in CURRENCIES:
            log.warning("row %d: %s", n, "bad currency")
            bad += 1
            continue
        ok += 1
        totals[row["currency"]] = totals.get(row["currency"], 0) + amount
    summary = " ".join(f"{c}={round(v, 2)}" for c, v in sorted(totals.items()))
    log.info("loaded %d rows, rejected %d, total %s", ok, bad, summary)
    return stream.getvalue().splitlines()
`,
      explanation: md('Per-row warnings make rejects traceable; one summary line makes the run monitorable (alert when `rejected` jumps). Passing arguments to `log.warning("…%s", x)` instead of an f-string defers formatting until a handler actually emits the record.'),
      tests: [
        ex('Example', 'id,amount,currency\n1,10.5,EUR\n2,-3,USD\n3,abc,USD\n4,3,usd\n5,3,USD\n'),
        ex('All good', 'id,amount,currency\n1,1,INR\n'),
        hid('Header only', 'id,amount,currency\n'),
        hid('Rounding totals', 'id,amount,currency\n1,0.1,USD\n2,0.2,USD\n'),
      ],
    }),

    python({
      id: 'log-exception-details',
      title: 'Log Exception Details with logger.exception',
      difficulty: 'Medium',
      topics: ['Logging', 'Error Handling'],
      patterns: ['logger.exception in except'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Record failures with their traceback, then reduce the log to a structured error report.',
      description: md(
        'Run each task in `tasks` (a name and an expression: `"ok"`, `"zero"` → `1 / 0`, `"key"` → `{}["x"]`, `"type"` → `"a" + 1`). On failure call `logger.exception("task %s failed", name)` — which logs at ERROR level and appends the traceback.',
        '',
        'Return `[ERROR line count, list of exception class names found on the traceback\'s last line, number of lines containing "Traceback (most recent call last)"]`.',
      ),
      hints: ['`logger.exception` must be called inside an `except` block; it adds `exc_info` automatically.', 'The last line of a formatted traceback is `"ExcType: message"`.'],
      entry: 'run',
      signature: 'run(tasks: list[str]) -> list',
      starter: code`import io
import logging

def run_tasks(tasks, logger):
    pass


# The tests call run(); don't change it.
def run(tasks):
    stream = io.StringIO()
    logger = logging.getLogger("tasks")
    logger.handlers.clear()
    logger.propagate = False
    h = logging.StreamHandler(stream)
    h.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    logger.addHandler(h)
    run_tasks(tasks, logger)
    lines = stream.getvalue().splitlines()
    errors = [l for l in lines if l.startswith("ERROR ")]
    exc_names = [l.split(":")[0] for l in lines if l and not l.startswith((" ", "ERROR", "Traceback", "INFO"))]
    tracebacks = sum("Traceback (most recent call last)" in l for l in lines)
    return [len(errors), exc_names, tracebacks]
`,
      solution: code`import io
import logging

ACTIONS = {
    "ok": lambda: 1,
    "zero": lambda: 1 / 0,
    "key": lambda: {}["x"],
    "type": lambda: "a" + 1,
}

def run_tasks(tasks, logger):
    for name in tasks:
        try:
            ACTIONS[name]()
        except Exception:
            logger.exception("task %s failed", name)


def run(tasks):
    stream = io.StringIO()
    logger = logging.getLogger("tasks")
    logger.handlers.clear()
    logger.propagate = False
    h = logging.StreamHandler(stream)
    h.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    logger.addHandler(h)
    run_tasks(tasks, logger)
    lines = stream.getvalue().splitlines()
    errors = [l for l in lines if l.startswith("ERROR ")]
    exc_names = [l.split(":")[0] for l in lines if l and not l.startswith((" ", "ERROR", "Traceback", "INFO"))]
    tracebacks = sum("Traceback (most recent call last)" in l for l in lines)
    return [len(errors), exc_names, tracebacks]
`,
      explanation: md('`logger.exception(...)` = `logger.error(..., exc_info=True)`: the message plus the full traceback, which is what you need to debug a failure later. Logging `str(e)` alone loses the stack — and the job keeps running, because the exception was handled.'),
      tests: [
        ex('Example', ['ok', 'zero', 'key']),
        ex('No failures', ['ok', 'ok']),
        hid('Type error', ['type']),
        hid('Every kind', ['type', 'zero', 'ok', 'key']),
      ],
    }),

    python({
      id: 'redacting-log-filter',
      title: 'A Logging Filter that Redacts Secrets',
      difficulty: 'Medium',
      topics: ['Logging', 'Regular Expressions'],
      patterns: ['logging.Filter'],
      domains: ['Security'],
      roles: DE,
      summary: 'Scrub tokens and passwords from every log record before any handler sees them.',
      description: md(
        'Write `Redact(logging.Filter)` whose `filter(record)` replaces, in the **fully formatted** message, any `password=<value>`, `token=<value>` or `api_key=<value>` (case-insensitive key, value up to whitespace or `&`) with `<key>=***`, and drops records whose message contains `"healthcheck"` entirely. Attach it to the logger.',
        '',
        '`run(messages)` logs each `[format, args]` pair (e.g. `["login user=%s password=%s", ["ana", "s3cret"]]`) at INFO and returns the captured lines.',
      ),
      hints: ['`record.getMessage()` merges `msg` and `args`; set `record.msg` to the redacted text and `record.args = None`.', 'Return `False` from `filter` to drop a record.'],
      entry: 'run',
      signature: 'run(messages: list[list]) -> list[str]',
      starter: code`import io
import logging
import re

class Redact(logging.Filter):
    pass


# The tests call run(); don't change it.
def run(messages):
    stream = io.StringIO()
    logger = logging.getLogger("api")
    logger.handlers.clear()
    logger.filters.clear()
    logger.propagate = False
    logger.setLevel(logging.INFO)
    h = logging.StreamHandler(stream)
    h.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(h)
    logger.addFilter(Redact())
    for fmt, args in messages:
        logger.info(fmt, *args)
    return stream.getvalue().splitlines()
`,
      solution: code`import io
import logging
import re

SECRET = re.compile(r"\b(password|token|api_key)=[^\s&]+", re.I)

class Redact(logging.Filter):
    def filter(self, record):
        message = record.getMessage()
        if "healthcheck" in message:
            return False
        record.msg = SECRET.sub(lambda m: f"{m.group(1)}=***", message)
        record.args = None
        return True


def run(messages):
    stream = io.StringIO()
    logger = logging.getLogger("api")
    logger.handlers.clear()
    logger.filters.clear()
    logger.propagate = False
    logger.setLevel(logging.INFO)
    h = logging.StreamHandler(stream)
    h.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(h)
    logger.addFilter(Redact())
    for fmt, args in messages:
        logger.info(fmt, *args)
    return stream.getvalue().splitlines()
`,
      explanation: md('Filters see each `LogRecord` before handlers do, so redaction happens once, centrally, for every destination. Redacting the **formatted** message matters: the secret usually arrives through `args`, not the format string.'),
      tests: [
        ex('Example', [['login user=%s password=%s', ['ana', 's3cret']], ['GET /x?token=%s&page=2', ['abc123']], ['healthcheck ok', []]]),
        ex('Nothing secret', [['loaded %d rows', [5]]]),
        hid('Case-insensitive keys', [['API_KEY=%s Password=%s', ['k1', 'p2']]]),
        hid('Only healthchecks', [['healthcheck %s', ['db']]]),
      ],
    }),
  ],
};
