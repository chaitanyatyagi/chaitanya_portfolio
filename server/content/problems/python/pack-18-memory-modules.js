// Python pack 18 — copying, memory and modules: shallow vs deep copy,
// writing deepcopy yourself (shared references and cycles), reference counting
// and garbage collection of cycles, is vs ==, how imports find modules
// (sys.path / PYTHONPATH), __all__ and star imports, relative imports inside
// packages, and pip requirement specifiers.
import { python, md, code, ex, hid } from './define.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'shallow-vs-deep-copy',
      title: 'Shallow vs Deep Copy of a Nested Config',
      difficulty: 'Easy',
      topics: ['Copying & Mutability'],
      patterns: ['copy.deepcopy for nested data'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Derive an environment config from a base config without mutating the base.',
      description: md(
        'Write `override(base, env, changes)`: return a new config equal to `base` with `config["env"] = env` and, for each `[section, key, value]` in `changes`, `config[section][key] = value`. **`base` must not change** — not at the top level, and not inside nested dicts or lists.',
        '',
        '`run(changes)` calls `override` twice on the same base and returns `[first, second, base afterwards]`.',
      ),
      hints: ['`dict(base)` or `base.copy()` is shallow: the nested dicts are shared, so writing into them edits the base.', '`copy.deepcopy(base)` copies every level.'],
      entry: 'run',
      signature: 'run(changes: list[list]) -> list',
      starter: code`import copy

def override(base, env, changes):
    config = base.copy()
    config["env"] = env
    for section, key, value in changes:
        config[section][key] = value
    return config


# The tests call run(); don't change it.
def run(changes):
    base = {"env": "base", "db": {"host": "localhost", "pool": 5}, "tags": ["etl"]}
    first = override(base, "dev", changes)
    second = override(base, "prod", [])
    return [first, second, base]
`,
      solution: code`import copy

def override(base, env, changes):
    config = copy.deepcopy(base)
    config["env"] = env
    for section, key, value in changes:
        config[section][key] = value
    return config


def run(changes):
    base = {"env": "base", "db": {"host": "localhost", "pool": 5}, "tags": ["etl"]}
    first = override(base, "dev", changes)
    second = override(base, "prod", [])
    return [first, second, base]
`,
      explanation: md('A shallow copy creates a new outer container whose items are the **same objects** as before. For nested config that means "dev" overrides leak into "base" and then into "prod" — a nasty, order-dependent bug. `deepcopy` recursively copies everything (and handles shared references and cycles).'),
      tests: [
        ex('Example', [['db', 'host', 'dev-db'], ['db', 'pool', 2]]),
        ex('No changes', []),
        hid('New key in a section', [['db', 'ssl', true]]),
        hid('Several sections', [['db', 'pool', 1], ['db', 'host', 'x']]),
      ],
    }),

    python({
      id: 'implement-deepcopy',
      title: 'Write deepcopy Yourself',
      difficulty: 'Medium',
      topics: ['Copying & Mutability', 'Recursion'],
      patterns: ['Recursive copy with a memo'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Copy nested dicts/lists/tuples/sets, preserving shared references and surviving cycles.',
      description: md(
        'Implement `clone(obj)` for structures built from dicts, lists, tuples, sets and immutable scalars. Like `copy.deepcopy`, it must:',
        '',
        '- create new containers at every level;',
        '- preserve **sharing**: if the same list appears twice in the input, both places point to one new list in the copy;',
        '- handle **cycles** (a list that contains itself) without infinite recursion.',
        '',
        '`run(case)` builds a test structure, clones it and returns facts about the copy.',
      ),
      hints: ['Keep `memo = {id(original): copy}`; register a container in the memo **before** filling it, so a cycle finds the copy.', 'Tuples can\'t be filled after creation — build their items first (cycles through tuples are rare; you can ignore them).'],
      entry: 'run',
      signature: 'run(case: str) -> list',
      starter: code`def clone(obj, memo=None):
    pass


# The tests call run(); don't change it.
def run(case):
    if case == "nested":
        src = {"a": [1, {"b": (2, 3)}], "s": {4, 5}}
        dst = clone(src)
        dst["a"][1]["b"] = "changed"
        return [src["a"][1]["b"] == (2, 3), dst["a"] is not src["a"], sorted(dst["s"])]
    if case == "shared":
        inner = [1, 2]
        src = {"x": inner, "y": inner}
        dst = clone(src)
        return [dst["x"] is dst["y"], dst["x"] is not inner, dst["x"] == [1, 2]]
    if case == "cycle":
        src = [1]
        src.append(src)
        dst = clone(src)
        return [dst[1] is dst, dst is not src, dst[0]]
    if case == "scalars":
        return [clone(5), clone("x"), clone(None)]
`,
      solution: code`def clone(obj, memo=None):
    if memo is None:
        memo = {}
    if id(obj) in memo:
        return memo[id(obj)]
    if isinstance(obj, dict):
        out = {}
        memo[id(obj)] = out
        for k, v in obj.items():
            out[clone(k, memo)] = clone(v, memo)
        return out
    if isinstance(obj, list):
        out = []
        memo[id(obj)] = out
        out.extend(clone(v, memo) for v in obj)
        return out
    if isinstance(obj, set):
        out = set()
        memo[id(obj)] = out
        out.update(clone(v, memo) for v in obj)
        return out
    if isinstance(obj, tuple):
        out = tuple(clone(v, memo) for v in obj)
        memo[id(obj)] = out
        return out
    return obj


def run(case):
    if case == "nested":
        src = {"a": [1, {"b": (2, 3)}], "s": {4, 5}}
        dst = clone(src)
        dst["a"][1]["b"] = "changed"
        return [src["a"][1]["b"] == (2, 3), dst["a"] is not src["a"], sorted(dst["s"])]
    if case == "shared":
        inner = [1, 2]
        src = {"x": inner, "y": inner}
        dst = clone(src)
        return [dst["x"] is dst["y"], dst["x"] is not inner, dst["x"] == [1, 2]]
    if case == "cycle":
        src = [1]
        src.append(src)
        dst = clone(src)
        return [dst[1] is dst, dst is not src, dst[0]]
    if case == "scalars":
        return [clone(5), clone("x"), clone(None)]
`,
      explanation: md('The memo is the key idea: it maps each original object\'s `id` to its copy, which both preserves sharing and terminates cycles. Registering the empty container **before** recursing is what makes `src.append(src)` work. This is how `copy.deepcopy` (and `__deepcopy__(self, memo)`) operate.'),
      tests: [
        ex('Nested structure', 'nested'),
        ex('Shared references stay shared', 'shared'),
        hid('Self-referencing list', 'cycle'),
        hid('Scalars pass through', 'scalars'),
      ],
    }),

    python({
      id: 'reference-counting',
      title: 'Reference Counting: When Is an Object Freed?',
      difficulty: 'Medium',
      topics: ['Copying & Mutability'],
      patterns: ['Refcount simulation'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Track references from names and containers and report the order objects are freed.',
      description: md(
        'Simulate CPython reference counting. Ops:',
        '',
        '- `["new", obj]` — create object `obj` (refcount 0, not yet freed);',
        '- `["bind", name, obj]` — make variable `name` refer to `obj` (dropping whatever `name` referred to before);',
        '- `["unbind", name]` — `del name`;',
        '- `["put", container, obj]` — `container` now holds one more reference to `obj`;',
        '- `["drop", container, obj]` — remove one such reference.',
        '',
        'An object is **freed** the moment its count reaches 0 after having been referenced, and freeing it drops all references it holds (which may free more objects, depth-first in the order they were put). Return the order of frees. Cycles never reach 0 — that is the garbage collector\'s job.',
      ),
      hints: ['Keep `refs[obj]`, `names[name] -> obj`, and `holds[container] -> list of objs`.', 'Write one `decref(obj)` that frees and recursively decrefs the contents.'],
      entry: 'freed_order',
      signature: 'freed_order(ops: list[list[str]]) -> list[str]',
      solution: code`def freed_order(ops: list[list[str]]) -> list[str]:
    refs, names, holds, freed = {}, {}, {}, []

    def incref(o):
        refs[o] += 1

    def decref(o):
        refs[o] -= 1
        if refs[o] == 0:
            freed.append(o)
            for child in holds.pop(o, []):
                decref(child)

    for op in ops:
        kind = op[0]
        if kind == "new":
            refs[op[1]] = 0
            holds[op[1]] = []
        elif kind == "bind":
            _, name, obj = op
            incref(obj)
            if name in names:
                decref(names[name])
            names[name] = obj
        elif kind == "unbind":
            decref(names.pop(op[1]))
        elif kind == "put":
            _, container, obj = op
            incref(obj)
            holds[container].append(obj)
        elif kind == "drop":
            _, container, obj = op
            holds[container].remove(obj)
            decref(obj)
    return freed
`,
      explanation: md('CPython frees most objects deterministically the instant their reference count drops to zero — which is why files closed by going out of scope "just work" there. Rebinding a name first increments the new object, then decrements the old (so `x = x` is safe). Objects in a reference **cycle** keep each other above zero; the cyclic garbage collector (`gc`) finds and frees those.'),
      tests: [
        ex('Example', [['new', 'a'], ['new', 'b'], ['bind', 'x', 'a'], ['put', 'a', 'b'], ['unbind', 'x']]),
        ex('Rebinding frees the old object', [['new', 'a'], ['new', 'b'], ['bind', 'x', 'a'], ['bind', 'x', 'b']]),
        hid('A cycle is never freed', [['new', 'a'], ['new', 'b'], ['bind', 'x', 'a'], ['put', 'a', 'b'], ['put', 'b', 'a'], ['unbind', 'x']]),
        hid('Two names, one object', [['new', 'o'], ['bind', 'p', 'o'], ['bind', 'q', 'o'], ['unbind', 'p'], ['unbind', 'q']]),
        hid('Dropping from a container', [['new', 'list'], ['new', 'item'], ['bind', 'l', 'list'], ['put', 'list', 'item'], ['drop', 'list', 'item']]),
      ],
    }),

    python({
      id: 'gc-unreachable-cycles',
      title: 'Find Unreachable Cycles Like the Garbage Collector',
      difficulty: 'Medium',
      topics: ['Copying & Mutability', 'Graphs (BFS / DFS)'],
      patterns: ['Mark and sweep'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Given an object graph and its roots, find the objects nothing reachable refers to.',
      description: md('`refs` maps each object to the objects it references; `roots` are the objects referenced from live variables. Return the sorted objects that are **unreachable** from the roots — the ones a tracing collector would free (including cycles that refcounting alone can\'t).'),
      hints: ['Mark: BFS/DFS from the roots. Sweep: everything not marked.'],
      entry: 'unreachable',
      signature: 'unreachable(refs: dict[str, list[str]], roots: list[str]) -> list[str]',
      solution: code`def unreachable(refs: dict[str, list[str]], roots: list[str]) -> list[str]:
    everything = set(refs) | {r for targets in refs.values() for r in targets}
    marked, stack = set(), list(roots)
    while stack:
        o = stack.pop()
        if o in marked:
            continue
        marked.add(o)
        stack.extend(refs.get(o, []))
    return sorted(everything - marked)
`,
      explanation: md('Reachability, not reference counts, defines garbage. CPython combines both: refcounting frees most objects immediately, and the generational `gc` module periodically finds unreachable cycles (it is why `gc.collect()` can free memory that `del` alone didn\'t).'),
      tests: [
        ex('Example', { app: ['cache'], cache: ['entry'], a: ['b'], b: ['a'], entry: [] }, ['app']),
        ex('Everything reachable', { r: ['x'], x: ['r'] }, ['r']),
        hid('No roots', { a: ['b'], b: [] }, []),
        hid('Self loop', { s: ['s'], live: [] }, ['live']),
      ],
    }),

    python({
      id: 'module-search-path',
      title: 'Which File Does import Load?',
      difficulty: 'Medium',
      topics: ['Modules & Packages'],
      patterns: ['sys.path resolution'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Resolve imports against sys.path entries the way Python does, including shadowing.',
      description: md(
        '`path` is `sys.path` in order (the script\'s directory first, then PYTHONPATH entries, then site-packages). `files` is the set of existing file paths. For `import name` (possibly dotted, like `etl.load`), Python tries each directory in order and takes the first match of:',
        '',
        '- a package: `<dir>/<a>/__init__.py` for the first part, then sub-parts inside that package directory (each sub-package needs its own `__init__.py`; a final module may be `<x>.py`);',
        '- a module: `<dir>/<name>.py` (only for undotted names).',
        '',
        'Return the file that would be loaded for each import, or `"ModuleNotFoundError"`. A package beats a module of the same name in the same directory.',
      ),
      hints: ['For a dotted name, find the top-level package first (searching `path`), then resolve the rest only inside that package — Python does not search `path` again for sub-modules.'],
      entry: 'resolve_imports',
      signature: 'resolve_imports(path: list[str], files: list[str], imports: list[str]) -> list[str]',
      solution: code`def resolve_imports(path: list[str], files: list[str], imports: list[str]) -> list[str]:
    exists = set(files)

    def find_top(name):
        for d in path:
            if f"{d}/{name}/__init__.py" in exists:
                return f"{d}/{name}", f"{d}/{name}/__init__.py"
            if f"{d}/{name}.py" in exists:
                return None, f"{d}/{name}.py"
        return None, None

    out = []
    for imp in imports:
        parts = imp.split(".")
        pkg_dir, found = find_top(parts[0])
        for part in parts[1:]:
            if pkg_dir is None:
                found = None
                break
            if f"{pkg_dir}/{part}/__init__.py" in exists:
                pkg_dir, found = f"{pkg_dir}/{part}", f"{pkg_dir}/{part}/__init__.py"
            elif f"{pkg_dir}/{part}.py" in exists:
                pkg_dir, found = None, f"{pkg_dir}/{part}.py"
            else:
                found = None
                break
        out.append(found or "ModuleNotFoundError")
    return out
`,
      explanation: md('Imports search `sys.path` front to back and stop at the first hit, so a local file named `json.py` or `pandas.py` next to your script **shadows** the real library — a very common confusing bug. PYTHONPATH entries are inserted before site-packages, which is how you point Python at in-house code.'),
      tests: [
        ex('Example', ['/app', '/opt/libs', '/site'], ['/app/job.py', '/opt/libs/etl/__init__.py', '/opt/libs/etl/load.py', '/site/requests/__init__.py', '/app/json.py', '/site/json/__init__.py'], ['etl.load', 'requests', 'json', 'missing']),
        ex('Package beats module in the same directory', ['/d'], ['/d/util.py', '/d/util/__init__.py'], ['util']),
        hid('Sub-package without __init__', ['/p'], ['/p/pkg/__init__.py', '/p/pkg/sub/mod.py'], ['pkg.sub.mod']),
        hid('Dotted name into a plain module fails', ['/p'], ['/p/tools.py'], ['tools.x']),
      ],
    }),

    python({
      id: 'star-import-all',
      title: 'What Does from module import * Bring In?',
      difficulty: 'Easy',
      topics: ['Modules & Packages'],
      patterns: ['__all__ semantics'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Compute the names a star import exposes, with and without __all__.',
      description: md('Given a module\'s top-level names (in definition order) and its `__all__` (or `None` if it has none), return the names `from module import *` binds: with `__all__`, exactly those names in that order (a name in `__all__` that doesn\'t exist raises — return `["AttributeError", name]`); without it, every name that doesn\'t start with an underscore, in definition order.'),
      hints: ['`__all__` is an explicit public API; the underscore rule is the fallback.'],
      entry: 'star_names',
      signature: 'star_names(names: list[str], all_: list[str] | None) -> list[str]',
      solution: code`def star_names(names: list[str], all_) -> list[str]:
    if all_ is None:
        return [n for n in names if not n.startswith("_")]
    defined = set(names)
    for n in all_:
        if n not in defined:
            return ["AttributeError", n]
    return list(all_)
`,
      explanation: md('`__all__` lets a module say which names are public — and it **overrides** the underscore convention in both directions (a listed `_helper` is exported). Star imports are discouraged in application code because they make it unclear where names come from, but packages commonly use `__all__` in `__init__.py`.'),
      tests: [
        ex('No __all__', ['load', '_retry', 'Client', 'VERSION'], null),
        ex('With __all__', ['load', '_retry', 'Client'], ['Client', '_retry']),
        hid('Missing name in __all__', ['a'], ['a', 'b']),
        hid('Empty __all__', ['x', 'y'], []),
      ],
    }),

    python({
      id: 'relative-import-resolution',
      title: 'Resolve Relative Imports in a Package',
      difficulty: 'Medium',
      topics: ['Modules & Packages'],
      patterns: ['Package-relative name resolution'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Turn from .x / from ..y import statements into absolute module names.',
      description: md(
        'Inside module `current` (a dotted name like `etl.jobs.daily`; set `is_package=True` if `current` is a package\'s `__init__`), resolve each relative import target like `.utils`, `..config`, `...` or `.` to an absolute module name.',
        '',
        'One dot means "the current package" (for a module, its parent; for a package `__init__`, itself); each extra dot goes one level up. Going above the top-level package returns `"ImportError"`.',
      ),
      hints: ['Start from `current` if it is a package, else from its parent; then strip one more component per extra dot.'],
      entry: 'resolve_relative',
      signature: 'resolve_relative(current: str, is_package: bool, targets: list[str]) -> list[str]',
      solution: code`def resolve_relative(current: str, is_package: bool, targets: list[str]) -> list[str]:
    base = current.split(".")
    if not is_package:
        base = base[:-1]
    out = []
    for target in targets:
        dots = len(target) - len(target.lstrip("."))
        rest = target[dots:]
        up = dots - 1
        if up > len(base) - 1 or not base:
            out.append("ImportError")
            continue
        package = base[: len(base) - up]
        out.append(".".join(package + ([rest] if rest else [])))
    return out
`,
      explanation: md('Relative imports are resolved from `__package__`, not from the file system or the current directory — which is why running a package module directly as a script (`python etl/jobs/daily.py`) breaks them ("attempted relative import with no known parent package"); use `python -m etl.jobs.daily` instead.'),
      tests: [
        ex('From a module', 'etl.jobs.daily', false, ['.helpers', '..config', '...', '.']),
        ex('From a package __init__', 'etl.jobs', true, ['.daily', '..io']),
        hid('Beyond the top level', 'etl.jobs.daily', false, ['....x']),
        hid('Top-level module has no package', 'script', false, ['.x']),
      ],
    }),

    python({
      id: 'pip-requirements-check',
      title: 'Check Installed Packages Against requirements.txt',
      difficulty: 'Medium',
      topics: ['Modules & Packages', 'Parsing (CSV / JSON)', 'Strings'],
      patterns: ['Version specifier evaluation'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Parse ==, >=, <, ~= and != specifiers and report which requirements an environment violates.',
      description: md(
        'Each requirement line looks like `pandas>=2.0,<3`, `requests==2.31.0`, `numpy~=1.26.0`, `urllib3!=2.0.0` or just `pyyaml`. Ignore blank lines and `#` comments (also trailing ones). Package names compare case-insensitively with `-` and `_` treated as equal. Versions are dot-separated integers (pad shorter versions with zeros).',
        '',
        '`~=X.Y.Z` means `>= X.Y.Z` and `< X.(Y+1)` (bump the second-to-last component). Return `{"missing": [...], "conflicts": [[name, installed, spec], ...]}` sorted by name.',
      ),
      hints: ['Normalise names with `re.sub(r"[-_.]+", "-", name).lower()`.', 'Compare versions as integer tuples padded to the same length.'],
      entry: 'check_requirements',
      signature: 'check_requirements(requirements: str, installed: dict[str, str]) -> dict',
      solution: code`import re

def _norm(name):
    return re.sub(r"[-_.]+", "-", name).lower()

def _v(text):
    return [int(p) for p in text.split(".")]

def _cmp(a, b):
    n = max(len(a), len(b))
    a, b = a + [0] * (n - len(a)), b + [0] * (n - len(b))
    return (a > b) - (a < b)

def _ok(installed, op, ver):
    c = _cmp(_v(installed), _v(ver))
    if op == "~=":
        parts = _v(ver)
        upper = parts[:-2] + [parts[-2] + 1]
        return c >= 0 and _cmp(_v(installed), upper) < 0
    return {"==": c == 0, "!=": c != 0, ">=": c >= 0, "<=": c <= 0, ">": c > 0, "<": c < 0}[op]

def check_requirements(requirements: str, installed: dict[str, str]) -> dict:
    have = {_norm(k): v for k, v in installed.items()}
    missing, conflicts = [], []
    for raw in requirements.splitlines():
        line = raw.split("#")[0].strip()
        if not line:
            continue
        m = re.match(r"([A-Za-z0-9_.-]+)\s*(.*)", line)
        name, spec = _norm(m.group(1)), m.group(2).replace(" ", "")
        if name not in have:
            missing.append(name)
            continue
        for clause in filter(None, spec.split(",")):
            op, ver = re.match(r"(==|!=|>=|<=|~=|>|<)(.+)", clause).groups()
            if not _ok(have[name], op, ver):
                conflicts.append([name, have[name], spec])
                break
    return {"missing": sorted(missing), "conflicts": sorted(conflicts)}
`,
      explanation: md('This is a tiny version of what pip\'s resolver checks (the real rules are PEP 440, handled by `packaging.specifiers`). Pinning exact versions (`==`) gives reproducible builds; ranges (`>=2,<3`) and compatible releases (`~=`) trade reproducibility for easier upgrades — which is why teams lock files with tools like pip-tools or uv.'),
      tests: [
        ex('Example', 'pandas>=2.0,<3\nrequests==2.31.0  # pinned\nnumpy~=1.26.0\n\npyyaml\n', { pandas: '2.2.1', requests: '2.32.0', numpy: '1.27.0' }),
        ex('Name normalisation', 'Scikit_Learn>=1.4', { 'scikit-learn': '1.5.0' }),
        hid('Not-equal and padding', 'urllib3!=2.0.0\nboto3>=1.34', { urllib3: '2.0', boto3: '1.34.0' }),
        hid('Compatible release with two parts', 'pydantic~=2.5', { pydantic: '2.9.1' }),
      ],
    }),
  ],
};
