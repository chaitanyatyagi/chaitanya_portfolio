// Python pack 10 — inheritance and magic methods: single / multilevel /
// hierarchical / multiple inheritance, constructor overriding and super(), MRO
// (including implementing C3 linearisation), polymorphism, operator
// overloading (+, *, ==, <, @, abs, len, in, []), comparison with
// total_ordering, __eq__/__hash__, method "overloading" (defaults and
// singledispatch), mixins, and __str__ / __repr__.
import { python, md, code, ex, hid } from './define.js';
import { gfg, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'payroll-inheritance',
      title: 'Override Pay Rules with Inheritance and super()',
      difficulty: 'Easy',
      topics: ['Inheritance & MRO', 'OOP'],
      patterns: ['Method overriding + super()'],
      domains: ['HR / People'],
      ...tag(gfg('LTIMindtree', 'OOP and polymorphism questions')),
      roles: DE,
      summary: 'A base Employee with subclasses that extend the constructor and override monthly pay.',
      description: md(
        '`Employee(name, salary)` pays `salary / 12` per month. Write subclasses:',
        '',
        '- `Manager(name, salary, reports)` — the base pay plus 100 per direct report;',
        '- `Contractor(name, rate, hours)` — `rate * hours`, with **no** salary (call the base constructor with `salary=0`);',
        '- `Intern(name, salary)` — inherits everything unchanged.',
        '',
        'Each subclass constructor must call `super().__init__`. `run(staff)` builds the staff from specs and returns `[class name, name, monthly pay rounded to 2]`.',
      ),
      hints: ['Overriding `monthly()` in a subclass replaces it; `super().monthly()` reuses the parent version.'],
      entry: 'run',
      signature: 'run(staff: list[list]) -> list[list]',
      starter: code`class Employee:
    def __init__(self, name, salary):
        self.name = name
        self.salary = salary

    def monthly(self):
        return self.salary / 12

class Manager(Employee):
    pass

class Contractor(Employee):
    pass

class Intern(Employee):
    pass


# The tests call run(); don't change it.
def run(staff):
    kinds = {"employee": Employee, "manager": Manager, "contractor": Contractor, "intern": Intern}
    out = []
    for kind, *args in staff:
        e = kinds[kind](*args)
        out.append([type(e).__name__, e.name, round(e.monthly(), 2)])
    return out
`,
      solution: code`class Employee:
    def __init__(self, name, salary):
        self.name = name
        self.salary = salary

    def monthly(self):
        return self.salary / 12

class Manager(Employee):
    def __init__(self, name, salary, reports):
        super().__init__(name, salary)
        self.reports = reports

    def monthly(self):
        return super().monthly() + 100 * self.reports

class Contractor(Employee):
    def __init__(self, name, rate, hours):
        super().__init__(name, salary=0)
        self.rate, self.hours = rate, hours

    def monthly(self):
        return self.rate * self.hours

class Intern(Employee):
    pass


def run(staff):
    kinds = {"employee": Employee, "manager": Manager, "contractor": Contractor, "intern": Intern}
    out = []
    for kind, *args in staff:
        e = kinds[kind](*args)
        out.append([type(e).__name__, e.name, round(e.monthly(), 2)])
    return out
`,
      explanation: md('Subclasses **extend** the constructor (call `super().__init__` and then add fields) and **override** behaviour (`monthly`). The driver calls `e.monthly()` without caring which class `e` is — that is polymorphism. Forgetting `super().__init__` leaves `name` unset.'),
      tests: [
        ex('Example', [['employee', 'Ana', 120000], ['manager', 'Raj', 180000, 3], ['contractor', 'Li', 80, 160], ['intern', 'Zoe', 24000]]),
        ex('Manager with no reports', [['manager', 'M', 12000, 0]]),
        hid('Fractional pay', [['employee', 'E', 100000]]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'multilevel-super-chain',
      title: 'Multilevel Inheritance: Who Runs First?',
      difficulty: 'Easy',
      topics: ['Inheritance & MRO'],
      patterns: ['super() chain'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Trace a three-level super() chain to see constructor and method order.',
      description: md(
        '`Source → FileSource → CsvSource` is a three-level hierarchy. Every class\'s `__init__` and `describe()` must append its own name to a shared `trace` list **after** calling `super()` (so the base runs first), and `describe()` returns the list of parts collected.',
        '',
        '`run(kinds)` builds each requested class, calls `describe()` once, and returns `[init_trace, describe_result, [c.__name__ for c in type(obj).__mro__]]` per kind.',
      ),
      hints: ['In each class: `super().__init__(trace)` then `trace.append("ThisClass")`.'],
      entry: 'run',
      signature: 'run(kinds: list[str]) -> list',
      starter: code`class Source:
    def __init__(self, trace):
        pass

    def describe(self):
        pass

class FileSource(Source):
    pass

class CsvSource(FileSource):
    pass


# The tests call run(); don't change it.
def run(kinds):
    out = []
    for kind in kinds:
        trace = []
        obj = {"source": Source, "file": FileSource, "csv": CsvSource}[kind](trace)
        out.append([list(trace), obj.describe(), [c.__name__ for c in type(obj).__mro__]])
    return out
`,
      solution: code`class Source:
    def __init__(self, trace):
        self.trace = trace
        trace.append("Source")

    def describe(self):
        return ["Source"]

class FileSource(Source):
    def __init__(self, trace):
        super().__init__(trace)
        trace.append("FileSource")

    def describe(self):
        return super().describe() + ["FileSource"]

class CsvSource(FileSource):
    def __init__(self, trace):
        super().__init__(trace)
        trace.append("CsvSource")

    def describe(self):
        return super().describe() + ["CsvSource"]


def run(kinds):
    out = []
    for kind in kinds:
        trace = []
        obj = {"source": Source, "file": FileSource, "csv": CsvSource}[kind](trace)
        out.append([list(trace), obj.describe(), [c.__name__ for c in type(obj).__mro__]])
    return out
`,
      explanation: md('`super()` means "the next class in the MRO", so a chain of `super()` calls visits every ancestor exactly once. Calling `super()` first and then doing your own work runs the base class\'s logic first — the usual order for initialisation.'),
      tests: [
        ex('Deepest class', ['csv']),
        ex('Base class', ['source']),
        hid('Middle class', ['file']),
        hid('Each class builds independently', ['csv', 'source', 'file']),
      ],
    }),

    python({
      id: 'c3-linearization',
      title: 'Compute the MRO with C3 Linearisation',
      difficulty: 'Hard',
      topics: ['Inheritance & MRO', 'Graphs (BFS / DFS)'],
      patterns: ['C3 merge'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Implement the algorithm Python uses to order base classes, including detecting impossible hierarchies.',
      description: md(
        '`bases` maps each class name to its list of direct bases, in declaration order (a class with no bases maps to `[]`). Return the C3 method resolution order of `cls` as a list of names — the same order `cls.__mro__` would give — or `"TypeError"` if no consistent order exists.',
        '',
        '`L[C] = C + merge(L[B1], …, L[Bn], [B1, …, Bn])`, where **merge** repeatedly takes the first head (first element of a list) that does not appear in the **tail** (any later position) of any list, removes it from all lists, and appends it to the result.',
      ),
      hints: ['Compute `L` recursively (memoise it).', 'If at some point no head qualifies while lists are non-empty, the hierarchy is inconsistent.'],
      entry: 'mro',
      signature: 'mro(bases: dict[str, list[str]], cls: str) -> list',
      solution: code`def mro(bases: dict[str, list[str]], cls: str) -> list:
    memo = {}

    def merge(seqs):
        seqs = [list(s) for s in seqs if s]
        out = []
        while seqs:
            for seq in seqs:
                head = seq[0]
                if not any(head in s[1:] for s in seqs):
                    break
            else:
                raise TypeError("inconsistent hierarchy")
            out.append(head)
            seqs = [[x for x in s if x != head] for s in seqs]
            seqs = [s for s in seqs if s]
        return out

    def lin(c):
        if c not in memo:
            parents = bases.get(c, [])
            memo[c] = [c] + merge([lin(p) for p in parents] + [parents])
        return memo[c]

    try:
        return lin(cls)
    except TypeError:
        return "TypeError"
`,
      explanation: md(
        'C3 guarantees three things: a class comes before its bases, the declared base order is kept, and every parent\'s own MRO is respected. The merge picks a class only when no other list still needs something to come before it.',
        '',
        '`class X(A, B)` together with `class Y(B, A)` and `class Z(X, Y)` is impossible to order — Python raises `TypeError: Cannot create a consistent method resolution order`, and so does this function.',
      ),
      tests: [
        ex('Diamond', { A: [], B: ['A'], C: ['A'], D: ['B', 'C'] }, 'D'),
        ex('Single class', { A: [] }, 'A'),
        hid('Classic textbook hierarchy', { O: [], A: ['O'], B: ['O'], C: ['O'], D: ['O'], E: ['O'], K1: ['A', 'B', 'C'], K2: ['D', 'B', 'E'], K3: ['D', 'A'], Z: ['K1', 'K2', 'K3'] }, 'Z'),
        hid('Inconsistent order', { A: [], B: [], X: ['A', 'B'], Y: ['B', 'A'], Z: ['X', 'Y'] }, 'Z'),
        hid('Multilevel chain', { A: [], B: ['A'], C: ['B'] }, 'C'),
      ],
    }),

    python({
      id: 'diamond-super-order',
      title: 'Cooperative super() in a Diamond',
      difficulty: 'Medium',
      topics: ['Inheritance & MRO'],
      patterns: ['Cooperative multiple inheritance'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Make every class in a diamond run exactly once using cooperative super() calls.',
      description: md(
        'A pipeline step inherits from two mixins that both inherit from `Step`:',
        '',
        '```',
        'class Step                         # base',
        'class Retrying(Step)',
        'class Logged(Step)',
        'class LoadStep(Retrying, Logged)',
        '```',
        '',
        'Each class\'s `setup(trace)` must append its name **before** calling `super().setup(trace)` (`Step` just appends `"Step"`), so that calling `LoadStep().setup(trace)` visits every class **exactly once**, in MRO order. `run(kinds)` returns the trace for each chosen class.',
      ),
      hints: ['If `Retrying.setup` called `Step.setup(self, trace)` directly, `Logged` would be skipped. `super()` follows the MRO of the **instance**, not of the class where the code is written.'],
      entry: 'run',
      signature: 'run(kinds: list[str]) -> list[list[str]]',
      starter: code`class Step:
    def setup(self, trace):
        trace.append("Step")

class Retrying(Step):
    def setup(self, trace):
        trace.append("Retrying")
        Step.setup(self, trace)

class Logged(Step):
    def setup(self, trace):
        trace.append("Logged")
        Step.setup(self, trace)

class LoadStep(Retrying, Logged):
    def setup(self, trace):
        trace.append("LoadStep")
        Retrying.setup(self, trace)
        Logged.setup(self, trace)


# The tests call run(); don't change it.
def run(kinds):
    out = []
    for kind in kinds:
        trace = []
        {"load": LoadStep, "retrying": Retrying, "logged": Logged}[kind]().setup(trace)
        out.append(trace)
    return out
`,
      solution: code`class Step:
    def setup(self, trace):
        trace.append("Step")

class Retrying(Step):
    def setup(self, trace):
        trace.append("Retrying")
        super().setup(trace)

class Logged(Step):
    def setup(self, trace):
        trace.append("Logged")
        super().setup(trace)

class LoadStep(Retrying, Logged):
    def setup(self, trace):
        trace.append("LoadStep")
        super().setup(trace)


def run(kinds):
    out = []
    for kind in kinds:
        trace = []
        {"load": LoadStep, "retrying": Retrying, "logged": Logged}[kind]().setup(trace)
        out.append(trace)
    return out
`,
      explanation: md('The MRO of `LoadStep` is `LoadStep, Retrying, Logged, Step, object`. Inside `Retrying.setup`, `super()` on a `LoadStep` instance points to `Logged` — not `Step` — which is why cooperative `super()` visits each class once. Explicit `Base.method(self)` calls run `Step` twice and are the classic diamond bug.'),
      tests: [
        ex('Diamond', ['load']),
        ex('Single mixin', ['retrying']),
        hid('Other mixin', ['logged']),
        hid('All three', ['logged', 'load', 'retrying']),
      ],
    }),

    python({
      id: 'money-operator-overloading',
      title: 'A Money Type with Operator Overloading',
      difficulty: 'Medium',
      topics: ['Magic Methods', 'OOP', 'Error Handling'],
      patterns: ['Operator overloading', 'Value object'],
      domains: ['Payments'],
      roles: DE,
      summary: 'Implement +, -, *, ==, < and sum() support for an amount-in-cents value type.',
      description: md(
        'Implement `Money(amount, currency)` storing **integer cents** (`round(amount * 100)`). Support:',
        '',
        '- `a + b`, `a - b` (same currency only, else `ValueError`), and `sum([...])` (so `0 + Money` must work);',
        '- `m * n` and `n * m` for an int/float `n` (result rounded to the cent);',
        '- `==` and `<` between same-currency amounts;',
        '- `str(m)` → `"12.50 EUR"`.',
        '',
        '`run(ops)` evaluates small expressions and returns their string results or the error class name.',
      ),
      hints: ['`__radd__` handles `0 + Money` (which is what `sum` starts with); `__rmul__` handles `3 * m`.', 'Return `NotImplemented` (not raise) for unsupported operand types.'],
      entry: 'run',
      signature: 'run(ops: list[list]) -> list',
      starter: code`class Money:
    def __init__(self, amount, currency):
        pass


# The tests call run(); don't change it.
def run(ops):
    out = []
    for op in ops:
        try:
            kind = op[0]
            if kind == "add":
                out.append(str(Money(*op[1]) + Money(*op[2])))
            elif kind == "sub":
                out.append(str(Money(*op[1]) - Money(*op[2])))
            elif kind == "mul":
                out.append(str(Money(*op[1]) * op[2]))
            elif kind == "rmul":
                out.append(str(op[2] * Money(*op[1])))
            elif kind == "sum":
                out.append(str(sum(Money(*m) for m in op[1])))
            elif kind == "eq":
                out.append(Money(*op[1]) == Money(*op[2]))
            elif kind == "lt":
                out.append(Money(*op[1]) < Money(*op[2]))
        except (ValueError, TypeError) as e:
            out.append(type(e).__name__)
    return out
`,
      solution: code`class Money:
    def __init__(self, amount, currency):
        self.cents = round(amount * 100)
        self.currency = currency

    @classmethod
    def _from_cents(cls, cents, currency):
        m = cls(0, currency)
        m.cents = cents
        return m

    def _check(self, other):
        if not isinstance(other, Money):
            return False
        if other.currency != self.currency:
            raise ValueError("currency mismatch")
        return True

    def __add__(self, other):
        if not self._check(other):
            return NotImplemented
        return Money._from_cents(self.cents + other.cents, self.currency)

    def __radd__(self, other):
        if other == 0:
            return self
        return NotImplemented

    def __sub__(self, other):
        if not self._check(other):
            return NotImplemented
        return Money._from_cents(self.cents - other.cents, self.currency)

    def __mul__(self, n):
        if isinstance(n, bool) or not isinstance(n, (int, float)):
            return NotImplemented
        return Money._from_cents(round(self.cents * n), self.currency)

    __rmul__ = __mul__

    def __eq__(self, other):
        return isinstance(other, Money) and self._check(other) and self.cents == other.cents

    def __lt__(self, other):
        if not self._check(other):
            return NotImplemented
        return self.cents < other.cents

    def __hash__(self):
        return hash((self.cents, self.currency))

    def __str__(self):
        sign = "-" if self.cents < 0 else ""
        return f"{sign}{abs(self.cents) // 100}.{abs(self.cents) % 100:02d} {self.currency}"


def run(ops):
    out = []
    for op in ops:
        try:
            kind = op[0]
            if kind == "add":
                out.append(str(Money(*op[1]) + Money(*op[2])))
            elif kind == "sub":
                out.append(str(Money(*op[1]) - Money(*op[2])))
            elif kind == "mul":
                out.append(str(Money(*op[1]) * op[2]))
            elif kind == "rmul":
                out.append(str(op[2] * Money(*op[1])))
            elif kind == "sum":
                out.append(str(sum(Money(*m) for m in op[1])))
            elif kind == "eq":
                out.append(Money(*op[1]) == Money(*op[2]))
            elif kind == "lt":
                out.append(Money(*op[1]) < Money(*op[2]))
        except (ValueError, TypeError) as e:
            out.append(type(e).__name__)
    return out
`,
      explanation: md(
        'Storing integer cents avoids float drift (`0.1 + 0.2`). Python tries `a.__add__(b)` and, if that returns `NotImplemented`, `b.__radd__(a)` — which is how `sum()` (starting from `0`) and `3 * m` work. Returning `NotImplemented` instead of raising lets Python produce the standard `TypeError` for nonsense like `m * "x"`.',
        '',
        'Defining `__eq__` removes the default `__hash__`, so a value object that should live in sets or dict keys needs `__hash__` too.',
      ),
      tests: [
        ex('Example', [['add', [10.25, 'EUR'], [2.25, 'EUR']], ['sum', [[1, 'EUR'], [2.5, 'EUR'], [0.05, 'EUR']]], ['rmul', [9.99, 'USD'], 3]]),
        ex('Currency mismatch', [['add', [1, 'EUR'], [1, 'USD']], ['lt', [1, 'EUR'], [2, 'USD']]]),
        hid('Floats are exact in cents', [['add', [0.1, 'EUR'], [0.2, 'EUR']], ['eq', [0.3, 'EUR'], [0.1, 'EUR']]]),
        hid('Negative results', [['sub', [1, 'GBP'], [2.5, 'GBP']], ['mul', [3.333, 'GBP'], 3]]),
        hid('Bad multiplier', [['mul', [1, 'EUR'], 'x']]),
      ],
    }),

    python({
      id: 'vector-magic-methods',
      title: 'A 2-D Vector with Arithmetic Dunder Methods',
      difficulty: 'Easy',
      topics: ['Magic Methods'],
      patterns: ['Operator overloading'],
      domains: ['Logistics'],
      roles: DE,
      summary: 'Implement +, -, scalar *, abs(), ==, bool() and repr() for a vector type.',
      description: md(
        'Implement `Vec(x, y)` with `+`, `-`, `* scalar`, `abs(v)` (length, rounded to 3), `==`, truthiness (`bool(Vec(0, 0))` is False) and `repr` → `"Vec(x, y)"`.',
        '',
        '`run(points)` treats `points` as a route: it returns `[repr(total displacement), total distance travelled rounded to 3, repr(last leg * 2), bool(displacement)]`.',
      ),
      hints: ['`__add__`, `__sub__`, `__mul__`, `__abs__`, `__eq__`, `__bool__`, `__repr__`.', '`math.hypot(x, y)` computes the length.'],
      entry: 'run',
      signature: 'run(points: list[list[float]]) -> list',
      starter: code`import math

class Vec:
    def __init__(self, x, y):
        self.x, self.y = x, y


# The tests call run(); don't change it.
def run(points):
    vs = [Vec(*p) for p in points]
    legs = [b - a for a, b in zip(vs, vs[1:])]
    displacement = vs[-1] - vs[0]
    distance = round(sum(abs(l) for l in legs), 3)
    last = repr(legs[-1] * 2) if legs else None
    return [repr(displacement), distance, last, bool(displacement)]
`,
      solution: code`import math

class Vec:
    def __init__(self, x, y):
        self.x, self.y = x, y

    def __add__(self, o):
        return Vec(self.x + o.x, self.y + o.y)

    def __sub__(self, o):
        return Vec(self.x - o.x, self.y - o.y)

    def __mul__(self, k):
        return Vec(self.x * k, self.y * k)

    def __abs__(self):
        return round(math.hypot(self.x, self.y), 3)

    def __eq__(self, o):
        return isinstance(o, Vec) and (self.x, self.y) == (o.x, o.y)

    def __bool__(self):
        return bool(self.x or self.y)

    def __repr__(self):
        return f"Vec({self.x}, {self.y})"


def run(points):
    vs = [Vec(*p) for p in points]
    legs = [b - a for a, b in zip(vs, vs[1:])]
    displacement = vs[-1] - vs[0]
    distance = round(sum(abs(l) for l in legs), 3)
    last = repr(legs[-1] * 2) if legs else None
    return [repr(displacement), distance, last, bool(displacement)]
`,
      explanation: md('Dunder ("double underscore") methods are how built-in syntax and functions call into your class: `a + b` → `a.__add__(b)`, `abs(v)` → `v.__abs__()`, `if v:` → `v.__bool__()`. A good `__repr__` looks like the code that would recreate the object.'),
      tests: [
        ex('Example', [[0, 0], [3, 4], [3, 0]]),
        ex('Round trip', [[1, 1], [2, 2], [1, 1]]),
        hid('Single point', [[5, 5]]),
        hid('Negative coordinates', [[-1, -1], [-4, 3]]),
      ],
    }),

    python({
      id: 'version-total-ordering',
      title: 'Comparable Versions with functools.total_ordering',
      difficulty: 'Medium',
      topics: ['Magic Methods', 'Sorting'],
      patterns: ['Rich comparisons'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Make semantic versions sortable with __eq__ and __lt__ — pre-releases included.',
      description: md(
        'Implement `Version(text)` for strings like `"2.10.1"` or `"2.10.1-rc.2"`. Compare major, minor, patch numerically; a version **with** a pre-release tag is lower than the same version without one; pre-release tags compare by their parts (numbers numerically, words alphabetically, numbers before words).',
        '',
        'Define only `__eq__` and `__lt__` and let `@functools.total_ordering` fill in the rest. `run(versions)` returns `[sorted versions, max(versions), versions[0] >= versions[-1]]`.',
      ),
      hints: ['Build a sort key tuple once: `(major, minor, patch, no_pre_flag, pre_parts)` where releases get flag 1 and pre-releases 0.', 'Turn each pre-release part into `(0, int)` or `(1, str)` so numbers and words compare without errors.'],
      entry: 'run',
      signature: 'run(versions: list[str]) -> list',
      starter: code`import functools

class Version:
    def __init__(self, text):
        self.text = text

    def __str__(self):
        return self.text


# The tests call run(); don't change it.
def run(versions):
    vs = [Version(v) for v in versions]
    return [[str(v) for v in sorted(vs)], str(max(vs)), vs[0] >= vs[-1]]
`,
      solution: code`import functools

@functools.total_ordering
class Version:
    def __init__(self, text):
        self.text = text
        core, _, pre = text.partition("-")
        major, minor, patch = (int(x) for x in core.split("."))
        pre_key = tuple((0, int(p)) if p.isdigit() else (1, p) for p in pre.split(".")) if pre else ()
        self.key = (major, minor, patch, 0 if pre else 1, pre_key)

    def __eq__(self, other):
        return isinstance(other, Version) and self.key == other.key

    def __lt__(self, other):
        if not isinstance(other, Version):
            return NotImplemented
        return self.key < other.key

    def __hash__(self):
        return hash(self.key)

    def __str__(self):
        return self.text


def run(versions):
    vs = [Version(v) for v in versions]
    return [[str(v) for v in sorted(vs)], str(max(vs)), vs[0] >= vs[-1]]
`,
      explanation: md('String comparison gets versions wrong (`"2.10" < "2.9"`). Parsing into a tuple key makes the comparison numeric, and `total_ordering` derives `<=`, `>`, `>=` from `__eq__` + `__lt__`. Tagging pre-release parts as `(0, n)` / `(1, word)` avoids comparing an int with a str.'),
      tests: [
        ex('Example', ['2.10.0', '2.9.3', '2.10.0-rc.1', '1.0.0']),
        ex('Pre-release ordering', ['1.0.0-beta', '1.0.0-alpha.2', '1.0.0-alpha.10', '1.0.0-alpha']),
        hid('Equal versions', ['3.1.4', '3.1.4']),
        hid('Numbers before words', ['1.0.0-rc', '1.0.0-1']),
      ],
    }),

    python({
      id: 'eq-hash-dedupe',
      title: 'Deduplicate Records with __eq__ and __hash__',
      difficulty: 'Medium',
      topics: ['Magic Methods', 'Dicts & Sets'],
      patterns: ['Value equality for set membership'],
      domains: ['Marketing / CRM'],
      roles: DE,
      summary: 'Make Customer objects equal by normalised email so a set removes duplicates.',
      description: md(
        'Two `Customer(email, name)` objects are the same customer when their emails match **ignoring case and surrounding spaces**. Implement `__eq__` and `__hash__` consistently so that `set(customers)` and `dict` keys deduplicate them.',
        '',
        '`run(rows)` returns `[len(set(customers)), names kept by dict.fromkeys(customers) in order, Customer(a) == "a" ]` — the last item checks that comparing with a non-Customer returns False.',
      ),
      hints: ['Objects that compare equal **must** have equal hashes; hash the same normalised key you compare.', 'Return `NotImplemented` from `__eq__` for other types — Python then falls back and the result is `False`.'],
      entry: 'run',
      signature: 'run(rows: list[list[str]]) -> list',
      starter: code`class Customer:
    def __init__(self, email, name):
        self.email, self.name = email, name


# The tests call run(); don't change it.
def run(rows):
    cs = [Customer(*r) for r in rows]
    kept = [c.name for c in dict.fromkeys(cs)]
    return [len(set(cs)), kept, (cs[0] == rows[0][0]) if cs else None]
`,
      solution: code`class Customer:
    def __init__(self, email, name):
        self.email, self.name = email, name

    @property
    def key(self):
        return self.email.strip().lower()

    def __eq__(self, other):
        if not isinstance(other, Customer):
            return NotImplemented
        return self.key == other.key

    def __hash__(self):
        return hash(self.key)


def run(rows):
    cs = [Customer(*r) for r in rows]
    kept = [c.name for c in dict.fromkeys(cs)]
    return [len(set(cs)), kept, (cs[0] == rows[0][0]) if cs else None]
`,
      explanation: md('Sets and dicts first compare **hashes**, then `==` within a bucket. If equal objects had different hashes, the set would never notice they are equal. By default every object is equal only to itself (identity) — and defining `__eq__` without `__hash__` makes instances unhashable.'),
      tests: [
        ex('Example', [['Ana@x.io', 'Ana'], [' ana@x.io ', 'Ana L.'], ['raj@y.io', 'Raj']]),
        ex('All different', [['a@a', 'A'], ['b@b', 'B']]),
        hid('Empty', []),
        hid('Many duplicates', [['K@k', '1'], ['k@K', '2'], ['  k@k', '3']]),
      ],
    }),

    python({
      id: 'custom-collection-dunders',
      title: 'A Batch Collection: len, in, [] and iteration',
      difficulty: 'Medium',
      topics: ['Magic Methods', 'Generators & Iterators'],
      patterns: ['Sequence protocol'],
      domains: ['Event pipelines'],
      roles: DE,
      summary: 'Make a Batch class behave like a read-only sequence of records.',
      description: md(
        'Implement `Batch(records)` (a list of dicts with an `"id"`) supporting: `len(b)`, `b[i]` and slicing (`b[1:3]` returns a **Batch**), `"id-7" in b` (membership by id, O(1)), iteration, and `b + other` (a new Batch; on duplicate ids keep the first).',
        '',
        '`run(a, b, probe)` returns `[len(a + b), [r["id"] for r in (a + b)[1:]], probe in a, a[-1]["id"]]`.',
      ),
      hints: ['`__getitem__` receives an int or a `slice` object — check with `isinstance(index, slice)`.', 'Keep a set of ids for `__contains__`.'],
      entry: 'run',
      signature: 'run(a: list[dict], b: list[dict], probe: str) -> list',
      starter: code`class Batch:
    def __init__(self, records):
        pass


# The tests call run(); don't change it.
def run(a, b, probe):
    A, B = Batch(a), Batch(b)
    merged = A + B
    return [len(merged), [r["id"] for r in merged[1:]], probe in A, A[-1]["id"]]
`,
      solution: code`class Batch:
    def __init__(self, records):
        self.records = list(records)
        self.ids = {r["id"] for r in self.records}

    def __len__(self):
        return len(self.records)

    def __getitem__(self, index):
        if isinstance(index, slice):
            return Batch(self.records[index])
        return self.records[index]

    def __contains__(self, record_id):
        return record_id in self.ids

    def __iter__(self):
        return iter(self.records)

    def __add__(self, other):
        merged = list(self.records)
        seen = set(self.ids)
        for r in other:
            if r["id"] not in seen:
                seen.add(r["id"])
                merged.append(r)
        return Batch(merged)


def run(a, b, probe):
    A, B = Batch(a), Batch(b)
    merged = A + B
    return [len(merged), [r["id"] for r in merged[1:]], probe in A, A[-1]["id"]]
`,
      explanation: md('Python\'s syntax maps onto protocols: `len()` → `__len__`, `x[i]` / `x[a:b]` → `__getitem__`, `in` → `__contains__`, `for` → `__iter__`. Implementing them makes a domain object feel like a built-in. Returning a `Batch` from a slice (instead of a list) keeps the type closed under slicing, like `str` and `list` do.'),
      tests: [
        ex('Example', [{ id: 'a' }, { id: 'b' }], [{ id: 'b' }, { id: 'c' }], 'b'),
        ex('Probe missing', [{ id: 'x' }], [], 'y'),
        hid('All duplicates', [{ id: '1' }], [{ id: '1' }], '1'),
        hid('Order is kept across both batches', [{ id: 'z' }, { id: 'y' }, { id: 'x' }], [{ id: 'w' }, { id: 'z' }], 'w'),
      ],
    }),

    python({
      id: 'str-vs-repr',
      title: '__str__ for Humans, __repr__ for Developers',
      difficulty: 'Easy',
      topics: ['Magic Methods'],
      patterns: ['String representations'],
      domains: ['Reporting'],
      roles: DE,
      summary: 'Give a pipeline-run object a readable str() and an unambiguous repr().',
      description: md(
        'Implement `Run(job, status, rows)` with:',
        '',
        '- `str(r)` → `"<job>: <STATUS> (<rows with thousands separators> rows)"`, e.g. `"orders: OK (1,234 rows)"`;',
        '- `repr(r)` → `"Run(job=\'orders\', status=\'ok\', rows=1234)"` (exactly like the constructor call, using `!r`);',
        '- an f-string `f"{r}"` uses `__str__`, and a list of runs shows each item\'s `__repr__`.',
        '',
        '`run(specs)` returns `[[str(r), repr(r)] for each run, str(list_of_runs)]`.',
      ),
      hints: ['`f"{rows:,}"` adds thousands separators; `f"{job!r}"` gives the quoted repr.'],
      entry: 'run',
      signature: 'run(specs: list[list]) -> list',
      starter: code`class Run:
    def __init__(self, job, status, rows):
        self.job, self.status, self.rows = job, status, rows


# The tests call run(); don't change it.
def run(specs):
    runs = [Run(*s) for s in specs]
    return [[str(r), repr(r)] for r in runs] + [str(runs)]
`,
      solution: code`class Run:
    def __init__(self, job, status, rows):
        self.job, self.status, self.rows = job, status, rows

    def __str__(self):
        return f"{self.job}: {self.status.upper()} ({self.rows:,} rows)"

    def __repr__(self):
        return f"Run(job={self.job!r}, status={self.status!r}, rows={self.rows!r})"


def run(specs):
    runs = [Run(*s) for s in specs]
    return [[str(r), repr(r)] for r in runs] + [str(runs)]
`,
      explanation: md('`str()` is for end users; `repr()` is for debugging and should be unambiguous (ideally valid code). Containers always use `repr` for their items — which is why printing a list of objects without a `__repr__` shows `<__main__.Run object at 0x…>`.'),
      tests: [
        ex('Example', [['orders', 'ok', 1234]]),
        ex('Two runs', [['a', 'failed', 0], ["it's", 'ok', 1000000]]),
        hid('Empty', []),
        hid('Zero rows and long names', [['nightly_orders_backfill', 'running', 0]]),
      ],
    }),

    python({
      id: 'singledispatch-overloading',
      title: 'Method Overloading the Python Way',
      difficulty: 'Medium',
      topics: ['Magic Methods', 'Functions & Lambdas'],
      patterns: ['functools.singledispatch', 'Default arguments'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'Python has no overloading by signature — dispatch on argument type with singledispatch instead.',
      description: md(
        'Write `to_cents(value)` that accepts several types, using `functools.singledispatch`:',
        '',
        '- `int` → treated as whole currency units (`5` → 500);',
        '- `float` → rounded to the nearest cent;',
        '- `str` → strip a leading `$` or `€` and commas, then parse as a float (`"$1,234.5"` → 123450);',
        '- `list` / `tuple` → the sum of converting each item;',
        '- `None` → 0;',
        '- anything else (including `bool`) → raise `TypeError` — return the string `"TypeError"` from `run` in that case.',
      ),
      hints: ['`@singledispatch` on the generic function, then `@to_cents.register` on functions whose first parameter is annotated with the type.', '`bool` is a subclass of `int`, so register `bool` explicitly to reject it.'],
      entry: 'run',
      signature: 'run(values: list) -> list',
      starter: code`from functools import singledispatch

def to_cents(value):
    pass


# The tests call run(); don't change it.
def run(values):
    out = []
    for v in values:
        try:
            out.append(to_cents(v))
        except TypeError:
            out.append("TypeError")
    return out
`,
      solution: code`from functools import singledispatch

@singledispatch
def to_cents(value):
    raise TypeError(f"unsupported type {type(value).__name__}")

@to_cents.register
def _(value: bool):
    raise TypeError("bool is not money")

@to_cents.register
def _(value: int):
    return value * 100

@to_cents.register
def _(value: float):
    return round(value * 100)

@to_cents.register
def _(value: str):
    return round(float(value.strip().lstrip("$€").replace(",", "")) * 100)

@to_cents.register(list)
@to_cents.register(tuple)
def _(value):
    return sum(to_cents(v) for v in value)

@to_cents.register(type(None))
def _(value):
    return 0


def run(values):
    out = []
    for v in values:
        try:
            out.append(to_cents(v))
        except TypeError:
            out.append("TypeError")
    return out
`,
      explanation: md('Defining `def f(x)` twice just replaces the first definition, so Python can\'t overload by signature. The usual answers are default/optional arguments, or `singledispatch`, which picks an implementation by the **type of the first argument** (following the MRO — hence the explicit `bool` registration, which is more specific than `int`).'),
      tests: [
        ex('Example', [5, 2.499, '$1,234.5', [1, '0.5'], null]),
        ex('Unsupported types', [true, { a: 1 }]),
        hid('Euro strings and negatives', ['€-3.10', -2]),
        hid('Nested lists', [[[1, 2], 3]]),
      ],
    }),

    python({
      id: 'json-mixin',
      title: 'Share Behaviour with a Mixin',
      difficulty: 'Medium',
      topics: ['Inheritance & MRO', 'Serialization'],
      patterns: ['Mixin class'],
      domains: ['APIs / Integration'],
      roles: DE,
      summary: 'Add to_json / from_json to unrelated classes with a small mixin.',
      description: md(
        'Write `JsonMixin` providing `to_json()` (the instance\'s public attributes as a JSON string with sorted keys) and a classmethod `from_json(text)` that creates an instance of the **calling** class by passing the decoded dict as keyword arguments. Then make `Order(order_id, total)` and `User(name, email, active=True)` use it.',
        '',
        '`run(kind, payload)` builds an object from `payload` (a dict) via the constructor, round-trips it through `to_json`/`from_json`, and returns `[type name, json text, round-tripped equals original?]`.',
      ),
      hints: ['`vars(self)` gives the attributes; skip names that start with `_`.', '`cls(**json.loads(text))` in a classmethod builds the right subclass.'],
      entry: 'run',
      signature: 'run(kind: str, payload: dict) -> list',
      starter: code`import json

class JsonMixin:
    pass

class Order(JsonMixin):
    def __init__(self, order_id, total):
        self.order_id, self.total = order_id, total
        self._cache = {}

class User(JsonMixin):
    def __init__(self, name, email, active=True):
        self.name, self.email, self.active = name, email, active


# The tests call run(); don't change it.
def run(kind, payload):
    cls = {"order": Order, "user": User}[kind]
    obj = cls(**payload)
    text = obj.to_json()
    back = cls.from_json(text)
    return [type(back).__name__, text, back.to_json() == text]
`,
      solution: code`import json

class JsonMixin:
    def to_json(self):
        public = {k: v for k, v in vars(self).items() if not k.startswith("_")}
        return json.dumps(public, sort_keys=True)

    @classmethod
    def from_json(cls, text):
        return cls(**json.loads(text))

class Order(JsonMixin):
    def __init__(self, order_id, total):
        self.order_id, self.total = order_id, total
        self._cache = {}

class User(JsonMixin):
    def __init__(self, name, email, active=True):
        self.name, self.email, self.active = name, email, active


def run(kind, payload):
    cls = {"order": Order, "user": User}[kind]
    obj = cls(**payload)
    text = obj.to_json()
    back = cls.from_json(text)
    return [type(back).__name__, text, back.to_json() == text]
`,
      explanation: md('A mixin is a small class that adds one capability and is meant to be combined with others, not instantiated alone. Because `from_json` is a classmethod using `cls`, `User.from_json` builds a `User` and `Order.from_json` an `Order` — one implementation, many classes.'),
      tests: [
        ex('Order', 'order', { order_id: 'o-9', total: 12.5 }),
        ex('User with default', 'user', { name: 'Ana', email: 'a@x.io' }),
        hid('Inactive user', 'user', { name: 'Raj', email: 'r@x.io', active: false }),
        hid('Private attributes are not serialised', 'order', { order_id: 'o-1', total: 0 }),
      ],
    }),

    python({
      id: 'matrix-matmul',
      title: 'Matrix Multiplication with the @ Operator',
      difficulty: 'Medium',
      topics: ['Magic Methods', 'Matrices'],
      patterns: ['__matmul__'],
      domains: ['Math'],
      roles: ['Data Engineer', 'Data Scientist'],
      summary: 'Implement a tiny Matrix type supporting @, ==, shape and transpose.',
      description: md(
        'Implement `Matrix(rows)` with `shape` (a property → `(r, c)`), `T` (transpose, a property), `a @ b` (matrix product; mismatched shapes raise `ValueError`), and `==`.',
        '',
        '`run(a, b)` returns `[(A @ B).rows, (A @ B).T.rows, (A @ B) == (B.T @ A.T).T]`, or `"ValueError"` if the product is undefined.',
      ),
      hints: ['`zip(*self.rows)` gives the columns.', '`c[i][j] = sum(a * b for a, b in zip(row_i, col_j))`.'],
      entry: 'run',
      signature: 'run(a: list[list[float]], b: list[list[float]]) -> list',
      starter: code`class Matrix:
    def __init__(self, rows):
        self.rows = [list(r) for r in rows]


# The tests call run(); don't change it.
def run(a, b):
    A, B = Matrix(a), Matrix(b)
    try:
        C = A @ B
    except ValueError:
        return "ValueError"
    return [C.rows, C.T.rows, C == (B.T @ A.T).T]
`,
      solution: code`class Matrix:
    def __init__(self, rows):
        self.rows = [list(r) for r in rows]

    @property
    def shape(self):
        return (len(self.rows), len(self.rows[0]) if self.rows else 0)

    @property
    def T(self):
        return Matrix([list(col) for col in zip(*self.rows)])

    def __matmul__(self, other):
        if self.shape[1] != other.shape[0]:
            raise ValueError(f"cannot multiply {self.shape} by {other.shape}")
        cols = list(zip(*other.rows))
        return Matrix([[sum(x * y for x, y in zip(row, col)) for col in cols] for row in self.rows])

    def __eq__(self, other):
        return isinstance(other, Matrix) and self.rows == other.rows


def run(a, b):
    A, B = Matrix(a), Matrix(b)
    try:
        C = A @ B
    except ValueError:
        return "ValueError"
    return [C.rows, C.T.rows, C == (B.T @ A.T).T]
`,
      explanation: md('`@` (PEP 465) calls `__matmul__`, the same hook NumPy and pandas use. The last check verifies the identity (AB)ᵀ = BᵀAᵀ. Properties like `shape` and `T` read like attributes but are computed.'),
      tests: [
        ex('Example', [[1, 2], [3, 4]], [[5, 6], [7, 8]]),
        ex('Shape mismatch', [[1, 2, 3]], [[1, 2]]),
        hid('Row times column', [[1, 2, 3]], [[1], [0], [-1]]),
        hid('Identity', [[1, 0], [0, 1]], [[9, 8], [7, 6]]),
      ],
    }),

    python({
      id: 'context-manager-dunders',
      title: 'A Transaction Context Manager',
      difficulty: 'Medium',
      topics: ['Magic Methods', 'Error Handling'],
      patterns: ['__enter__ / __exit__'],
      domains: ['Database Access'],
      roles: DE,
      summary: 'Commit on success and roll back on error with __enter__ and __exit__.',
      description: md(
        'Implement `Transaction(store, log)` as a context manager. `__enter__` copies the dict `store` into a working copy and returns it; on a clean exit, `__exit__` writes the working copy back into `store` (in place) and logs `"commit"`; if the block raised, it leaves `store` untouched, logs `"rollback <ErrorName>"`, and **suppresses** `KeyError` only (other errors propagate).',
        '',
        '`run(initial, batches)` applies each batch of `[key, delta]` updates inside its own `with Transaction(...)`, where an update to a missing key raises `KeyError` and a delta of `None` raises `TypeError`. It returns `[final store, log]`.',
      ),
      hints: ['`__exit__(self, exc_type, exc, tb)` — returning `True` suppresses the exception.', 'Update the original with `store.clear(); store.update(work)` so callers holding the dict see the change.'],
      entry: 'run',
      signature: 'run(initial: dict, batches: list[list[list]]) -> list',
      starter: code`class Transaction:
    def __init__(self, store, log):
        self.store, self.log = store, log


# The tests call run(); don't change it.
def run(initial, batches):
    store, log = dict(initial), []
    for batch in batches:
        try:
            with Transaction(store, log) as work:
                for key, delta in batch:
                    if key not in work:
                        raise KeyError(key)
                    work[key] += delta
        except TypeError:
            log.append("caller saw TypeError")
    return [store, log]
`,
      solution: code`class Transaction:
    def __init__(self, store, log):
        self.store, self.log = store, log

    def __enter__(self):
        self.work = dict(self.store)
        return self.work

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.store.clear()
            self.store.update(self.work)
            self.log.append("commit")
            return False
        self.log.append(f"rollback {exc_type.__name__}")
        return issubclass(exc_type, KeyError)


def run(initial, batches):
    store, log = dict(initial), []
    for batch in batches:
        try:
            with Transaction(store, log) as work:
                for key, delta in batch:
                    if key not in work:
                        raise KeyError(key)
                    work[key] += delta
        except TypeError:
            log.append("caller saw TypeError")
    return [store, log]
`,
      explanation: md('`with` guarantees `__exit__` runs, whether the block finished or raised. Working on a copy and swapping it in at the end makes each batch all-or-nothing. Suppressing only the errors you expect (and letting the rest propagate) is the important design choice — a context manager that swallows everything hides bugs.'),
      tests: [
        ex('Example', { a: 10, b: 5 }, [[['a', -3], ['b', 2]], [['a', 1], ['zzz', 1]]]),
        ex('Unexpected error propagates', { x: 1 }, [[['x', null]]]),
        hid('All good', { k: 0 }, [[['k', 1]], [['k', 1]]]),
        hid('Partial batch fully rolled back', { a: 1, b: 1 }, [[['a', 5], ['b', 5], ['c', 5]]]),
      ],
    }),
  ],
};
