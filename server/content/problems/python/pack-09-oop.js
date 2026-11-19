// Python pack 9 — object-oriented Python: classes and objects, __init__ and
// self, instance vs class variables, @classmethod / @staticmethod, @property
// getters and setters, name mangling, isinstance, getattr/setattr/hasattr,
// built-in class attributes, nested classes, storing objects in lists,
// __call__, abstract base classes, singletons, and stateful interview classes
// (transactions, LRU cache, hit counter).
// Class problems use a driver `run(...)` that creates objects and calls methods.
import { python, md, code, ex, hid } from './define.js';
import { dev, ddp, gfg, jpm, tag } from './sources.js';

const DE = ['Data Engineer'];

export default {
  problems: [
    python({
      id: 'bank-account-class',
      title: 'Your First Class: a Wallet Account',
      difficulty: 'Easy',
      topics: ['OOP', 'Error Handling'],
      patterns: ['State + methods'],
      domains: ['Payments'],
      ...tag(gfg('Cognizant', 'explain OOP concepts; what are classes and objects')),
      roles: DE,
      summary: 'Model a wallet with __init__, methods that change state, and a rule enforced inside the class.',
      description: md(
        'Implement `Wallet(owner, balance=0)` with `deposit(amount)`, `withdraw(amount)` and a `balance` attribute. Amounts must be positive; a withdrawal larger than the balance is refused. Each method returns `True` if it changed the balance, else `False`.',
        '',
        '`run(owner, ops)` applies ops like `["deposit", 50]` and returns `[results, final_balance, owner]`.',
      ),
      hints: ['`__init__` stores state on `self`; every method receives the instance as `self`.'],
      entry: 'run',
      signature: 'run(owner: str, ops: list[list]) -> list',
      starter: code`class Wallet:
    def __init__(self, owner, balance=0):
        pass

    def deposit(self, amount):
        pass

    def withdraw(self, amount):
        pass


# The tests call run(); don't change it.
def run(owner, ops):
    w = Wallet(owner)
    results = [getattr(w, op)(amount) for op, amount in ops]
    return [results, w.balance, w.owner]
`,
      solution: code`class Wallet:
    def __init__(self, owner, balance=0):
        self.owner = owner
        self.balance = balance

    def deposit(self, amount):
        if amount <= 0:
            return False
        self.balance += amount
        return True

    def withdraw(self, amount):
        if amount <= 0 or amount > self.balance:
            return False
        self.balance -= amount
        return True


def run(owner, ops):
    w = Wallet(owner)
    results = [getattr(w, op)(amount) for op, amount in ops]
    return [results, w.balance, w.owner]
`,
      explanation: md('A class bundles data with the operations that keep it valid. `w.deposit(50)` is really `Wallet.deposit(w, 50)` — that is where `self` comes from. Putting the rules in methods means no caller can push the balance negative.'),
      tests: [
        ex('Example', 'ana', [['deposit', 50], ['withdraw', 20], ['withdraw', 100]]),
        ex('Non-positive amounts refused', 'raj', [['deposit', 0], ['deposit', -5], ['withdraw', 0]]),
        hid('Withdraw everything', 'li', [['deposit', 10], ['withdraw', 10], ['withdraw', 1]]),
        hid('No operations', 'zoe', []),
      ],
    }),

    python({
      id: 'class-vs-instance-variables',
      title: 'Class Variables vs Instance Variables',
      difficulty: 'Easy',
      topics: ['OOP'],
      patterns: ['Shared class state'],
      domains: ['Platform / Ops'],
      roles: DE,
      summary: 'Count instances with a class variable and avoid the shared-mutable-list trap.',
      description: md(
        'Implement `Job(name)`:',
        '',
        '- a class variable `created` counting how many jobs were ever created;',
        '- an instance variable `id` equal to the value of `created` at creation (1, 2, 3, …);',
        '- a per-instance list `tags` — `add_tag(t)` must not affect other jobs.',
        '',
        '`run(names, tag_ops)` resets `Job.created = 0`, creates the jobs, applies `[index, tag]` ops and returns `[[id, name, tags] for each job] + [Job.created]`.',
      ),
      hints: ['Update the class variable through the class (`Job.created += 1`), not `self.created += 1` — that would create an instance attribute.', 'Create the list in `__init__`; a list defined at class level would be shared by every job.'],
      entry: 'run',
      signature: 'run(names: list[str], tag_ops: list[list]) -> list',
      starter: code`class Job:
    tags = []   # bug: shared by every instance

    def __init__(self, name):
        self.name = name

    def add_tag(self, t):
        self.tags.append(t)


# The tests call run(); don't change it.
def run(names, tag_ops):
    Job.created = 0
    jobs = [Job(n) for n in names]
    for i, t in tag_ops:
        jobs[i].add_tag(t)
    return [[j.id, j.name, j.tags] for j in jobs] + [Job.created]
`,
      solution: code`class Job:
    created = 0

    def __init__(self, name):
        Job.created += 1
        self.id = Job.created
        self.name = name
        self.tags = []

    def add_tag(self, t):
        self.tags.append(t)


def run(names, tag_ops):
    Job.created = 0
    jobs = [Job(n) for n in names]
    for i, t in tag_ops:
        jobs[i].add_tag(t)
    return [[j.id, j.name, j.tags] for j in jobs] + [Job.created]
`,
      explanation: md('Attribute lookup checks the instance first, then the class. Reading `self.created` finds the class variable, but **assigning** `self.created = …` creates an instance attribute that shadows it. A mutable class attribute (`tags = []`) is shared by all instances — the class-level cousin of the mutable default argument bug.'),
      tests: [
        ex('Example', ['load', 'clean'], [[0, 'daily'], [1, 'pii']]),
        ex('Tags stay separate', ['a', 'b', 'c'], [[0, 'x'], [0, 'y']]),
        hid('No jobs', [], []),
        hid('One job, no tags', ['solo'], []),
      ],
    }),

    python({
      id: 'classmethod-constructor',
      title: 'Alternative Constructors with @classmethod',
      difficulty: 'Easy',
      topics: ['OOP', 'Parsing (CSV / JSON)'],
      patterns: ['Factory classmethod'],
      domains: ['HR / People'],
      roles: DE,
      summary: 'Build objects from a CSV line or a dict with classmethods, and a validator with @staticmethod.',
      description: md(
        'Implement `Employee(name, dept, salary)` with:',
        '',
        '- `Employee.from_csv("name,dept,salary")` and `Employee.from_dict({...})` — `@classmethod` constructors;',
        '- `Employee.valid_salary(x)` — a `@staticmethod` returning True for an int/float ≥ 0 (not bool);',
        '- `to_row()` returning `[name, dept, salary]`.',
        '',
        'The constructors strip whitespace, title-case `name`, upper-case `dept` and convert salary to `int`; an invalid salary raises `ValueError`. `run(inputs)` builds one employee per input (a string → CSV, a dict → dict) and returns rows or `"invalid"`.',
      ),
      hints: ['`cls(...)` inside a classmethod creates an instance of whatever class it was called on — subclasses get subclass instances.'],
      entry: 'run',
      signature: 'run(inputs: list) -> list',
      starter: code`class Employee:
    def __init__(self, name, dept, salary):
        self.name, self.dept, self.salary = name, dept, salary

    def to_row(self):
        return [self.name, self.dept, self.salary]


# The tests call run(); don't change it.
def run(inputs):
    out = []
    for item in inputs:
        try:
            e = Employee.from_csv(item) if isinstance(item, str) else Employee.from_dict(item)
            out.append(e.to_row())
        except ValueError:
            out.append("invalid")
    return out
`,
      solution: code`class Employee:
    def __init__(self, name, dept, salary):
        self.name, self.dept, self.salary = name, dept, salary

    @staticmethod
    def valid_salary(x):
        return isinstance(x, (int, float)) and not isinstance(x, bool) and x >= 0

    @classmethod
    def _build(cls, name, dept, salary):
        if isinstance(salary, str):
            salary = float(salary.strip())  # raises ValueError if not numeric
        if not cls.valid_salary(salary):
            raise ValueError("bad salary")
        return cls(name.strip().title(), dept.strip().upper(), int(salary))

    @classmethod
    def from_csv(cls, line):
        name, dept, salary = line.split(",")
        return cls._build(name, dept, salary)

    @classmethod
    def from_dict(cls, d):
        return cls._build(d["name"], d["dept"], d["salary"])

    def to_row(self):
        return [self.name, self.dept, self.salary]


def run(inputs):
    out = []
    for item in inputs:
        try:
            e = Employee.from_csv(item) if isinstance(item, str) else Employee.from_dict(item)
            out.append(e.to_row())
        except ValueError:
            out.append("invalid")
    return out
`,
      explanation: md('A **classmethod** receives the class (`cls`) instead of an instance — the idiomatic way to offer several constructors (`dict.fromkeys`, `datetime.fromisoformat`). A **staticmethod** receives neither; it lives on the class only because it belongs with it. Note `line.split(",")` into three names raises `ValueError` itself when the field count is wrong.'),
      tests: [
        ex('Example', [' ana lee ,data, 120000', { name: 'raj', dept: 'ops', salary: 95000 }]),
        ex('Invalid salary', ['li,bi,-5', 'x,y,abc']),
        hid('Wrong number of fields', ['only,two']),
        hid('Bool salary rejected', [{ name: 'a', dept: 'b', salary: true }]),
        hid('Float salary truncated', ['zoe,eng,1000.9']),
      ],
    }),

    python({
      id: 'property-validation',
      title: 'Getters and Setters with @property',
      difficulty: 'Easy',
      topics: ['OOP', 'Error Handling'],
      patterns: ['Validated property'],
      domains: ['IoT / Telemetry'],
      roles: DE,
      summary: 'Expose a temperature attribute that validates on assignment and derives Fahrenheit.',
      description: md(
        'Implement `Sensor(celsius)` where `celsius` is a **property**: setting it below −273.15 raises `ValueError`, and `fahrenheit` is a read-only computed property (`c * 9/5 + 32`, rounded to 1). Assigning `fahrenheit` must raise `AttributeError`.',
        '',
        '`run(initial, updates)` creates a sensor, applies each update (`["c", value]` or `["f", value]`) and records `[celsius, fahrenheit]` or the error class name.',
      ),
      hints: ['`@property def celsius(self)` plus `@celsius.setter def celsius(self, value)`; store the real value in `self._celsius`.', 'A property without a setter is read-only.'],
      entry: 'run',
      signature: 'run(initial: float, updates: list[list]) -> list',
      starter: code`class Sensor:
    def __init__(self, celsius):
        self.celsius = celsius


# The tests call run(); don't change it.
def run(initial, updates):
    s = Sensor(initial)
    out = [[s.celsius, s.fahrenheit]]
    for kind, value in updates:
        try:
            if kind == "c":
                s.celsius = value
            else:
                s.fahrenheit = value
            out.append([s.celsius, s.fahrenheit])
        except (ValueError, AttributeError) as e:
            out.append(type(e).__name__)
    return out
`,
      solution: code`class Sensor:
    def __init__(self, celsius):
        self.celsius = celsius          # goes through the setter

    @property
    def celsius(self):
        return self._celsius

    @celsius.setter
    def celsius(self, value):
        if value < -273.15:
            raise ValueError("below absolute zero")
        self._celsius = value

    @property
    def fahrenheit(self):
        return round(self._celsius * 9 / 5 + 32, 1)


def run(initial, updates):
    s = Sensor(initial)
    out = [[s.celsius, s.fahrenheit]]
    for kind, value in updates:
        try:
            if kind == "c":
                s.celsius = value
            else:
                s.fahrenheit = value
            out.append([s.celsius, s.fahrenheit])
        except (ValueError, AttributeError) as e:
            out.append(type(e).__name__)
    return out
`,
      explanation: md('Properties let a class start with a plain attribute and add validation later **without changing callers** — `s.celsius = 20` still works. Assigning in `__init__` through the property means even the constructor is validated.'),
      tests: [
        ex('Example', 20, [['c', 100], ['c', -300], ['f', 50]]),
        ex('Freezing point', 0, []),
        hid('Absolute zero is allowed', 10, [['c', -273.15]]),
        hid('Negative temperatures', -40, [['c', -10.5]]),
      ],
    }),

    python({
      id: 'name-mangling-encapsulation',
      title: 'Encapsulation and Name Mangling',
      difficulty: 'Medium',
      topics: ['OOP'],
      patterns: ['Private attributes (__name)'],
      domains: ['Security'],
      roles: DE,
      summary: 'Hide a secret token behind double-underscore name mangling and controlled accessors.',
      description: md(
        'Implement `Credential(user, token)`: store the token in a double-underscore attribute `__token` so it isn\'t reachable as `c.__token`. Provide `masked()` → the token with all but the last 4 characters replaced by `*`, and `rotate(new)` that only accepts tokens of length ≥ 8 (returns True/False).',
        '',
        '`run(user, token, new)` returns `[masked_before, rotated, masked_after, hasattr(c, "__token"), hasattr(c, "_Credential__token")]`.',
      ),
      hints: ['Inside the class, `self.__token` is rewritten by the compiler to `self._Credential__token`.'],
      entry: 'run',
      signature: 'run(user: str, token: str, new: str) -> list',
      starter: code`class Credential:
    def __init__(self, user, token):
        pass


# The tests call run(); don't change it.
def run(user, token, new):
    c = Credential(user, token)
    before = c.masked()
    rotated = c.rotate(new)
    return [before, rotated, c.masked(), hasattr(c, "__token"), hasattr(c, "_Credential__token")]
`,
      solution: code`class Credential:
    def __init__(self, user, token):
        self.user = user
        self.__token = token

    def masked(self):
        t = self.__token
        return "*" * max(len(t) - 4, 0) + t[-4:]

    def rotate(self, new):
        if len(new) < 8:
            return False
        self.__token = new
        return True


def run(user, token, new):
    c = Credential(user, token)
    before = c.masked()
    rotated = c.rotate(new)
    return [before, rotated, c.masked(), hasattr(c, "__token"), hasattr(c, "_Credential__token")]
`,
      explanation: md('Python has no truly private attributes. A single underscore (`_token`) is a convention ("internal"); a double underscore triggers **name mangling** to `_ClassName__token`, which avoids accidental clashes in subclasses but is still reachable if you know the name. Encapsulation in Python is about clear interfaces, not enforcement.'),
      tests: [
        ex('Example', 'svc', 'abcd1234wxyz', 'newtoken99'),
        ex('Rotation refused', 'svc', 'secret-token', 'short'),
        hid('Short token is fully shown', 'a', 'abc', 'longenough'),
        hid('Exactly four characters', 'b', 'wxyz', '12345678'),
      ],
    }),

    python({
      id: 'sort-objects-in-list',
      title: 'Store Objects in a List and Sort Them',
      difficulty: 'Easy',
      topics: ['OOP', 'Sorting'],
      patterns: ['Sorting objects by attribute'],
      domains: ['E-commerce / Sales'],
      roles: DE,
      summary: 'Create product objects, keep them in a list, and sort and filter them by attributes.',
      description: md(
        'Create a `Product(sku, price, stock)` object for every row in `rows` (`[sku, price, stock]`). Return the SKUs of products **in stock** (stock > 0), sorted by price descending then SKU ascending — using `operator.attrgetter` or a lambda over the objects.',
      ),
      hints: ['`sorted(products, key=lambda p: (-p.price, p.sku))`.'],
      entry: 'in_stock_by_price',
      signature: 'in_stock_by_price(rows: list[list]) -> list[str]',
      solution: code`class Product:
    def __init__(self, sku, price, stock):
        self.sku, self.price, self.stock = sku, price, stock

def in_stock_by_price(rows: list[list]) -> list[str]:
    products = [Product(*r) for r in rows]
    available = [p for p in products if p.stock > 0]
    return [p.sku for p in sorted(available, key=lambda p: (-p.price, p.sku))]
`,
      explanation: md('A list of objects is the OOP version of a table of rows. Sorting keys work on attributes just as on dict keys. (`dataclasses.dataclass(order=True)` can even generate comparison methods for you.)'),
      tests: [
        ex('Example', [['A', 10, 3], ['B', 25, 0], ['C', 25, 1], ['D', 5, 9]]),
        ex('Nothing in stock', [['X', 1, 0]]),
        hid('Price ties by SKU', [['z', 5, 1], ['a', 5, 1]]),
        hid('Empty', []),
      ],
    }),

    python({
      id: 'isinstance-dispatch',
      title: 'isinstance() Dispatch over Shapes',
      difficulty: 'Easy',
      topics: ['OOP', 'Inheritance & MRO'],
      patterns: ['Type-based dispatch'],
      domains: ['Logistics'],
      roles: DE,
      summary: 'Compute package volumes for a mixed list of shape objects, including subclasses.',
      description: md(
        'Classes `Box(l, w, h)`, `Cube(side)` (a subclass of `Box`) and `Cylinder(r, h)` are given. Write `volume(shape)` using `isinstance` checks: Box → l·w·h, Cylinder → π·r²·h (use `math.pi`), anything else → `None`. Round to 2.',
        '',
        '`run(specs)` builds shapes from specs like `["box", 1, 2, 3]`, `["cube", 2]`, `["cyl", 1, 1]`, `["sphere", 1]` and returns `[class_name, volume, isinstance(shape, Box)]` for each.',
      ),
      hints: ['`isinstance(cube, Box)` is True because Cube inherits from Box — so the Box branch covers cubes for free.'],
      entry: 'run',
      signature: 'run(specs: list[list]) -> list[list]',
      starter: code`import math

class Box:
    def __init__(self, l, w, h):
        self.l, self.w, self.h = l, w, h

class Cube(Box):
    def __init__(self, side):
        super().__init__(side, side, side)

class Cylinder:
    def __init__(self, r, h):
        self.r, self.h = r, h

class Sphere:
    def __init__(self, r):
        self.r = r

def volume(shape):
    pass


# The tests call run(); don't change it.
def run(specs):
    kinds = {"box": Box, "cube": Cube, "cyl": Cylinder, "sphere": Sphere}
    out = []
    for kind, *dims in specs:
        s = kinds[kind](*dims)
        out.append([type(s).__name__, volume(s), isinstance(s, Box)])
    return out
`,
      solution: code`import math

class Box:
    def __init__(self, l, w, h):
        self.l, self.w, self.h = l, w, h

class Cube(Box):
    def __init__(self, side):
        super().__init__(side, side, side)

class Cylinder:
    def __init__(self, r, h):
        self.r, self.h = r, h

class Sphere:
    def __init__(self, r):
        self.r = r

def volume(shape):
    if isinstance(shape, Box):
        return round(shape.l * shape.w * shape.h, 2)
    if isinstance(shape, Cylinder):
        return round(math.pi * shape.r ** 2 * shape.h, 2)
    return None


def run(specs):
    kinds = {"box": Box, "cube": Cube, "cyl": Cylinder, "sphere": Sphere}
    out = []
    for kind, *dims in specs:
        s = kinds[kind](*dims)
        out.append([type(s).__name__, volume(s), isinstance(s, Box)])
    return out
`,
      explanation: md('`isinstance` respects inheritance (a `Cube` **is a** `Box`), while `type(s) is Box` would not. Long `isinstance` chains are a hint that a `volume()` **method** on each class (polymorphism) would scale better.'),
      tests: [
        ex('Example', [['box', 1, 2, 3], ['cube', 2], ['cyl', 1, 1], ['sphere', 1]]),
        ex('Single cylinder', [['cyl', 2, 0.5]]),
        hid('Empty', []),
        hid('Decimal box', [['box', 0.5, 0.5, 0.5]]),
      ],
    }),

    python({
      id: 'getattr-setattr-patch',
      title: 'Apply a Patch with getattr / setattr / hasattr',
      difficulty: 'Medium',
      topics: ['OOP', 'Dicts & Sets'],
      patterns: ['Dynamic attribute access'],
      domains: ['Marketing / CRM'],
      roles: DE,
      summary: 'Update an object from a dict of changes, only touching attributes it already has.',
      description: md(
        'Write `apply_patch(obj, patch)` that, for each key in `patch` (in order): if `obj` has that attribute and its current value is not callable, set it with `setattr` and record `"set <key>"`; if the attribute exists but is a method, record `"skip <key> (method)"`; otherwise record `"skip <key> (unknown)"`. Keys starting with `_` are always `"skip <key> (private)"`. Return the log.',
        '',
        '`run(patch)` patches a `Customer` and returns `[log, vars(customer)]`.',
      ),
      hints: ['`hasattr(obj, k)`, `getattr(obj, k)`, `setattr(obj, k, v)`, `callable(x)`.'],
      entry: 'run',
      signature: 'run(patch: dict) -> list',
      starter: code`class Customer:
    def __init__(self):
        self.name = "Ana"
        self.tier = "free"
        self._score = 10

    def upgrade(self):
        self.tier = "pro"

def apply_patch(obj, patch):
    pass


# The tests call run(); don't change it.
def run(patch):
    c = Customer()
    log = apply_patch(c, patch)
    return [log, vars(c)]
`,
      solution: code`class Customer:
    def __init__(self):
        self.name = "Ana"
        self.tier = "free"
        self._score = 10

    def upgrade(self):
        self.tier = "pro"

def apply_patch(obj, patch):
    log = []
    for key, value in patch.items():
        if key.startswith("_"):
            log.append(f"skip {key} (private)")
        elif not hasattr(obj, key):
            log.append(f"skip {key} (unknown)")
        elif callable(getattr(obj, key)):
            log.append(f"skip {key} (method)")
        else:
            setattr(obj, key, value)
            log.append(f"set {key}")
    return log


def run(patch):
    c = Customer()
    log = apply_patch(c, patch)
    return [log, vars(c)]
`,
      explanation: md('`getattr`/`setattr` are attribute access with the name as a **string** — the basis of serializers, ORMs and config loaders. Whitelisting what may be set (existing, public, non-method) prevents a patch from overwriting methods or creating surprise attributes. `vars(obj)` is `obj.__dict__`.'),
      tests: [
        ex('Example', { name: 'Ana Lee', tier: 'pro', email: 'a@x.io', upgrade: 'x', _score: 99 }),
        ex('Empty patch', {}),
        hid('Only unknown keys', { age: 3 }),
        hid('Private and method keys never change the object', { _score: 0, upgrade: 'pro' }),
      ],
    }),

    python({
      id: 'built-in-class-attributes',
      title: 'Describe a Class from Its Built-In Attributes',
      difficulty: 'Easy',
      topics: ['OOP', 'Inheritance & MRO'],
      patterns: ['Introspection'],
      domains: ['Developer tools'],
      roles: DE,
      summary: 'Use __name__, __doc__, __bases__, __dict__ and __module__ to describe classes.',
      description: md(
        'Write `describe(cls)` returning a dict: `name` (`__name__`), `doc` (first line of `__doc__`, or `None`), `bases` (names of `__bases__`), `methods` (sorted names of functions defined **in this class\'s own** `__dict__`, excluding names that start with `_`), and `class_vars` (sorted non-callable, non-underscore names in its own `__dict__`).',
        '',
        '`run(names)` describes classes from a small hierarchy.',
      ),
      hints: ['`cls.__dict__` contains only what the class itself defines, not inherited members.', '`callable(v)` separates methods from plain values.'],
      entry: 'run',
      signature: 'run(names: list[str]) -> list[dict]',
      starter: code`def describe(cls):
    pass


# Classes and driver used by the tests — don't change anything below.
class Source:
    """Base class for data sources.

    Subclasses implement read()."""
    retries = 3

    def read(self):
        raise NotImplementedError

    def _connect(self):
        pass

class S3Source(Source):
    """Reads objects from S3."""
    bucket = "raw"
    region = "eu-west-1"

    def read(self):
        return []

    def list_keys(self):
        return []

class Undocumented(S3Source):
    pass

def run(names):
    classes = {"Source": Source, "S3Source": S3Source, "Undocumented": Undocumented}
    return [describe(classes[n]) for n in names]
`,
      solution: code`def describe(cls):
    own = cls.__dict__
    doc = cls.__doc__.strip().splitlines()[0] if cls.__doc__ else None
    public = {k: v for k, v in own.items() if not k.startswith("_")}
    return {
        "name": cls.__name__,
        "doc": doc,
        "bases": [b.__name__ for b in cls.__bases__],
        "methods": sorted(k for k, v in public.items() if callable(v)),
        "class_vars": sorted(k for k, v in public.items() if not callable(v)),
    }


class Source:
    """Base class for data sources.

    Subclasses implement read()."""
    retries = 3

    def read(self):
        raise NotImplementedError

    def _connect(self):
        pass

class S3Source(Source):
    """Reads objects from S3."""
    bucket = "raw"
    region = "eu-west-1"

    def read(self):
        return []

    def list_keys(self):
        return []

class Undocumented(S3Source):
    pass

def run(names):
    classes = {"Source": Source, "S3Source": S3Source, "Undocumented": Undocumented}
    return [describe(classes[n]) for n in names]
`,
      explanation: md('Classes are objects too, with attributes the interpreter fills in: `__name__`, `__doc__`, `__bases__`, `__module__`, `__dict__`. A subclass with no docstring has `__doc__ = None` — docstrings are not inherited this way — and its own `__dict__` lacks inherited methods.'),
      tests: [
        ex('Base class', ['Source']),
        ex('Subclass', ['S3Source']),
        hid('Empty subclass', ['Undocumented']),
        hid('Several at once', ['Undocumented', 'Source']),
      ],
    }),

    python({
      id: 'nested-class-order',
      title: 'A Nested Class for Order Lines',
      difficulty: 'Easy',
      topics: ['OOP'],
      patterns: ['Inner class', 'Composition'],
      domains: ['E-commerce / Sales'],
      roles: DE,
      summary: 'Model an order that owns its line items through an inner class.',
      description: md(
        'Implement `Order(order_id)` with an inner class `Order.Line(sku, qty, price)` (having a `total()` method). `Order.add(sku, qty, price)` creates and stores a `Line`; `Order.total()` sums the lines; `Order.skus()` returns SKUs sorted. Quantities ≤ 0 are ignored by `add`.',
        '',
        '`run(order_id, lines)` returns `[order_id, skus, total_rounded_to_2, type(line).__qualname__]` (the qualified name of the first line\'s class, or `None`).',
      ),
      hints: ['Refer to the inner class as `self.Line` or `Order.Line` from inside methods.'],
      entry: 'run',
      signature: 'run(order_id: str, lines: list[list]) -> list',
      starter: code`class Order:
    def __init__(self, order_id):
        pass


# The tests call run(); don't change it.
def run(order_id, lines):
    o = Order(order_id)
    for sku, qty, price in lines:
        o.add(sku, qty, price)
    first = type(o.lines[0]).__qualname__ if o.lines else None
    return [o.order_id, o.skus(), round(o.total(), 2), first]
`,
      solution: code`class Order:
    class Line:
        def __init__(self, sku, qty, price):
            self.sku, self.qty, self.price = sku, qty, price

        def total(self):
            return self.qty * self.price

    def __init__(self, order_id):
        self.order_id = order_id
        self.lines = []

    def add(self, sku, qty, price):
        if qty > 0:
            self.lines.append(self.Line(sku, qty, price))

    def total(self):
        return sum(line.total() for line in self.lines)

    def skus(self):
        return sorted(line.sku for line in self.lines)


def run(order_id, lines):
    o = Order(order_id)
    for sku, qty, price in lines:
        o.add(sku, qty, price)
    first = type(o.lines[0]).__qualname__ if o.lines else None
    return [o.order_id, o.skus(), round(o.total(), 2), first]
`,
      explanation: md('A nested class is just a class attribute that happens to be a class — useful to show that `Line` only makes sense as part of an `Order`. Its `__qualname__` (`"Order.Line"`) records where it lives. One class "having" others is **composition**.'),
      tests: [
        ex('Example', 'o-1', [['B', 2, 3.5], ['A', 1, 10]]),
        ex('Non-positive quantities ignored', 'o-2', [['X', 0, 9], ['Y', -1, 9]]),
        hid('Single line', 'o-3', [['Z', 3, 0.1]]),
        hid('Empty order', 'o-4', []),
      ],
    }),

    python({
      id: 'callable-objects',
      title: 'Make Objects Callable with __call__',
      difficulty: 'Easy',
      topics: ['OOP', 'Magic Methods'],
      patterns: ['Callable instance'],
      domains: ['Data quality'],
      roles: DE,
      summary: 'A configurable threshold check you call like a function, which also counts its calls.',
      description: md(
        'Implement `Threshold(limit, inclusive=False)`: calling an instance with a value returns whether it passes (`value > limit`, or `>=` when inclusive). Each instance counts how often it was called in `calls` and how often it returned `False` in `rejected`.',
        '',
        '`run(limit, inclusive, values)` returns `[[t(v) for v in values], t.calls, t.rejected, callable(t)]`.',
      ),
      hints: ['Define `__call__(self, value)`.'],
      entry: 'run',
      signature: 'run(limit: float, inclusive: bool, values: list[float]) -> list',
      starter: code`class Threshold:
    def __init__(self, limit, inclusive=False):
        pass


# The tests call run(); don't change it.
def run(limit, inclusive, values):
    t = Threshold(limit, inclusive)
    results = [t(v) for v in values]
    return [results, t.calls, t.rejected, callable(t)]
`,
      solution: code`class Threshold:
    def __init__(self, limit, inclusive=False):
        self.limit = limit
        self.inclusive = inclusive
        self.calls = 0
        self.rejected = 0

    def __call__(self, value):
        self.calls += 1
        ok = value >= self.limit if self.inclusive else value > self.limit
        if not ok:
            self.rejected += 1
        return ok


def run(limit, inclusive, values):
    t = Threshold(limit, inclusive)
    results = [t(v) for v in values]
    return [results, t.calls, t.rejected, callable(t)]
`,
      explanation: md('`__call__` lets an object be used anywhere a function is expected (`filter(t, values)`), while still holding configuration and state — a more explicit alternative to a closure.'),
      tests: [
        ex('Example', 10, false, [5, 10, 15]),
        ex('Inclusive', 10, true, [10, 9.99]),
        hid('No values', 0, false, []),
        hid('Negative limit', -5, false, [-5, -4, -6]),
      ],
    }),

    python({
      id: 'abstract-readers',
      title: 'Abstract Base Classes for File Readers',
      difficulty: 'Medium',
      topics: ['OOP', 'Inheritance & MRO', 'Parsing (CSV / JSON)'],
      patterns: ['Abstract base class', 'Template method'],
      domains: ['Event pipelines'],
      ...tag(dev('Bloomberg', 'abstract classes, OOP and file I/O (chunked CSV to LDJSON)')),
      roles: DE,
      summary: 'Define an abstract Reader whose subclasses must implement parse(); share the rest.',
      description: md(
        'Create an abstract base class `Reader` (with `abc.ABC`) declaring an abstract method `parse(line)` that returns a dict or `None`. Its concrete method `read(text)` splits `text` into lines, skips blanks, calls `parse` and collects non-`None` results.',
        '',
        'Implement `CsvReader(columns)` (comma-separated values zipped with `columns`; wrong field count → `None`) and `JsonLinesReader` (`json.loads`; invalid JSON or non-dict → `None`). An incomplete subclass `BrokenReader` (no `parse`) is provided.',
        '',
        '`run(kind, text)` returns the parsed records, or `"TypeError"` if the class can\'t be instantiated.',
      ),
      hints: ['`@abstractmethod` on `parse`; instantiating a class that still has abstract methods raises `TypeError`.'],
      entry: 'run',
      signature: 'run(kind: str, text: str) -> list',
      starter: code`import json
from abc import ABC, abstractmethod

class Reader:
    pass

class CsvReader(Reader):
    pass

class JsonLinesReader(Reader):
    pass

class BrokenReader(Reader):
    pass


# The tests call run(); don't change it.
def run(kind, text):
    try:
        reader = {"csv": lambda: CsvReader(["id", "name"]), "jsonl": JsonLinesReader, "broken": BrokenReader}[kind]()
    except TypeError:
        return "TypeError"
    return reader.read(text)
`,
      solution: code`import json
from abc import ABC, abstractmethod

class Reader(ABC):
    @abstractmethod
    def parse(self, line):
        """Return a dict for a good line, or None to skip it."""

    def read(self, text):
        out = []
        for line in text.splitlines():
            if line.strip():
                rec = self.parse(line)
                if rec is not None:
                    out.append(rec)
        return out

class CsvReader(Reader):
    def __init__(self, columns):
        self.columns = columns

    def parse(self, line):
        values = [v.strip() for v in line.split(",")]
        return dict(zip(self.columns, values)) if len(values) == len(self.columns) else None

class JsonLinesReader(Reader):
    def parse(self, line):
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            return None
        return rec if isinstance(rec, dict) else None

class BrokenReader(Reader):
    pass


def run(kind, text):
    try:
        reader = {"csv": lambda: CsvReader(["id", "name"]), "jsonl": JsonLinesReader, "broken": BrokenReader}[kind]()
    except TypeError:
        return "TypeError"
    return reader.read(text)
`,
      explanation: md('The base class owns the shared algorithm (`read`) and leaves one step (`parse`) to subclasses — the **template method** pattern. `ABC` + `@abstractmethod` make the contract enforceable: forgetting `parse` fails at construction time with `TypeError`, not halfway through a job.'),
      tests: [
        ex('CSV', 'csv', '1, Ana\n\n2,Raj\nbad'),
        ex('Incomplete subclass', 'broken', 'x'),
        hid('JSON lines', 'jsonl', '{"a": 1}\nnot json\n[1, 2]\n{"b": 2}'),
        hid('Empty text', 'csv', ''),
      ],
    }),

    python({
      id: 'singleton-config',
      title: 'A Singleton Configuration Object',
      difficulty: 'Medium',
      topics: ['OOP', 'Magic Methods'],
      patterns: ['Singleton via __new__'],
      domains: ['Platform / Ops'],
      ...tag(jpm('write a Singleton class implementation')),
      roles: DE,
      summary: 'Ensure every Config() call returns the same instance, initialised only once.',
      description: md(
        'Implement `Config` so that `Config()` always returns **the same** object. The first construction loads settings from the arguments (`Config(env="prod", workers=4)`); later calls ignore their arguments. Provide `get(key, default=None)` and `Config.reset()` (a classmethod that forgets the instance, for tests).',
        '',
        '`run(calls)` resets, calls `Config(**kwargs)` for each kwargs dict and returns `[all same object?, settings of the last one, Config.inits]` where `inits` counts real initialisations.',
      ),
      hints: ['Override `__new__` to return a stored instance; guard `__init__` with a flag so it runs once.', 'A module-level instance is the simplest Pythonic singleton — but interviewers usually want `__new__`.'],
      entry: 'run',
      signature: 'run(calls: list[dict]) -> list',
      starter: code`class Config:
    def __init__(self, **settings):
        self.settings = settings


# The tests call run(); don't change it.
def run(calls):
    Config.reset()
    objs = [Config(**kw) for kw in calls]
    same = all(o is objs[0] for o in objs)
    return [same, objs[-1].settings if objs else None, Config.inits]
`,
      solution: code`class Config:
    _instance = None
    inits = 0

    def __new__(cls, **settings):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._ready = False
        return cls._instance

    def __init__(self, **settings):
        if self._ready:
            return
        self.settings = dict(settings)
        self._ready = True
        Config.inits += 1

    def get(self, key, default=None):
        return self.settings.get(key, default)

    @classmethod
    def reset(cls):
        cls._instance = None
        cls.inits = 0


def run(calls):
    Config.reset()
    objs = [Config(**kw) for kw in calls]
    same = all(o is objs[0] for o in objs)
    return [same, objs[-1].settings if objs else None, Config.inits]
`,
      explanation: md('`Config(...)` calls `__new__` (create) and then `__init__` (initialise) — **every time**. Returning the cached instance from `__new__` makes the object unique, but `__init__` would still re-run and overwrite settings, hence the `_ready` guard. In real code, also think about thread safety (a lock around creation).'),
      tests: [
        ex('Example', [{ env: 'prod', workers: 4 }, { env: 'dev' }]),
        ex('Single call', [{}]),
        hid('Many calls', [{ a: 1 }, { b: 2 }, { c: 3 }]),
        hid('First settings win', [{ env: 'qa' }, { env: 'prod', debug: true }]),
      ],
    }),

    python({
      id: 'transactional-kv-store',
      title: 'Key-Value Store with Nested Transactions',
      difficulty: 'Hard',
      topics: ['OOP', 'Dicts & Sets', 'Stacks & Queues'],
      patterns: ['Stack of undo logs'],
      domains: ['Database Access'],
      ...tag(dev('Salesforce', 'hash tables for atomic transaction state')),
      roles: DE,
      summary: 'Support SET, GET, DELETE, COUNT and nested BEGIN / ROLLBACK / COMMIT.',
      description: md(
        'Implement `KV` processing commands:',
        '',
        '- `SET k v`, `DELETE k`, `GET k` (→ value or `"NULL"`), `COUNT v` (→ how many keys currently hold value v);',
        '- `BEGIN` opens a (nested) transaction; `ROLLBACK` undoes everything since the most recent `BEGIN` (→ `"NO TRANSACTION"` if none); `COMMIT` makes all open transactions permanent (→ `"NO TRANSACTION"` if none).',
        '',
        '`run(commands)` returns the outputs of `GET`, `COUNT`, and failed `ROLLBACK`/`COMMIT` commands, in order. `COUNT` must not scan every key.',
      ),
      hints: [
        'Keep a stack of undo logs: before changing a key inside a transaction, record its previous value (or "absent") in the top log — once per key per transaction.',
        'Maintain a `value → count` dict alongside the data so COUNT is O(1).',
      ],
      entry: 'run',
      signature: 'run(commands: list[str]) -> list',
      starter: code`class KV:
    def __init__(self):
        pass

    def execute(self, command):
        pass


# The tests call run(); don't change it.
def run(commands):
    kv = KV()
    out = []
    for c in commands:
        r = kv.execute(c)
        if r is not None:
            out.append(r)
    return out
`,
      solution: code`_ABSENT = object()

class KV:
    def __init__(self):
        self.data = {}
        self.counts = {}
        self.undo = []

    def _write(self, key, value):
        if self.undo and key not in self.undo[-1]:
            self.undo[-1][key] = self.data.get(key, _ABSENT)
        old = self.data.get(key, _ABSENT)
        if old is not _ABSENT:
            self.counts[old] -= 1
            del self.data[key]
        if value is not _ABSENT:
            self.data[key] = value
            self.counts[value] = self.counts.get(value, 0) + 1

    def execute(self, command):
        op, *args = command.split()
        if op == "SET":
            self._write(args[0], args[1])
        elif op == "DELETE":
            self._write(args[0], _ABSENT)
        elif op == "GET":
            return self.data.get(args[0], "NULL")
        elif op == "COUNT":
            return self.counts.get(args[0], 0)
        elif op == "BEGIN":
            self.undo.append({})
        elif op == "ROLLBACK":
            if not self.undo:
                return "NO TRANSACTION"
            log = self.undo.pop()
            saved, self.undo = self.undo, []
            for key, value in log.items():
                self._write(key, value)
            self.undo = saved
        elif op == "COMMIT":
            if not self.undo:
                return "NO TRANSACTION"
            self.undo = []
        return None


def run(commands):
    kv = KV()
    out = []
    for c in commands:
        r = kv.execute(c)
        if r is not None:
            out.append(r)
    return out
`,
      explanation: md(
        'Each transaction keeps an **undo log**: the value each key had before its first change in that transaction. ROLLBACK replays the log (with logging turned off so the replay isn\'t recorded); COMMIT simply discards all logs. Memory is proportional to what changed, not to the whole store.',
        '',
        'The `value → count` index is updated on every write, so `COUNT` is O(1) — the point interviewers probe. A `_ABSENT` sentinel distinguishes "key missing" from any real value.',
      ),
      tests: [
        ex('Example', ['SET a 10', 'GET a', 'BEGIN', 'SET a 20', 'GET a', 'ROLLBACK', 'GET a', 'ROLLBACK']),
        ex('Counts', ['SET a 1', 'SET b 1', 'COUNT 1', 'DELETE a', 'COUNT 1', 'GET a']),
        hid('Nested transactions', ['BEGIN', 'SET x 1', 'BEGIN', 'SET x 2', 'COUNT 2', 'ROLLBACK', 'GET x', 'ROLLBACK', 'GET x']),
        hid('Commit closes everything', ['BEGIN', 'SET k v', 'BEGIN', 'DELETE k', 'COMMIT', 'GET k', 'ROLLBACK', 'COMMIT']),
        hid('Rollback restores deleted keys and counts', ['SET a 5', 'BEGIN', 'DELETE a', 'SET b 5', 'COUNT 5', 'ROLLBACK', 'GET a', 'GET b', 'COUNT 5']),
      ],
    }),

    python({
      id: 'lru-cache-class',
      title: 'The Eviction Policy: an LRU Cache Class',
      difficulty: 'Medium',
      topics: ['OOP', 'Dicts & Sets'],
      patterns: ['OrderedDict LRU'],
      domains: ['APIs / Integration'],
      ...tag(ddp('Coinbase', 'The Eviction Policy')),
      roles: DE,
      summary: 'Build a fixed-capacity read-through cache that evicts the least recently used entry.',
      description: md(
        'Implement `LRUCache(capacity)` with `get(key)` (→ value or `-1`, and marks the key as recently used) and `put(key, value)` (inserts or updates, marks as used, and evicts the least recently used key if over capacity). Both O(1).',
        '',
        '`run(capacity, ops)` applies ops `["put", k, v]` / `["get", k]` and returns the results of the gets.',
      ),
      hints: ['`OrderedDict.move_to_end(key)` and `popitem(last=False)`.'],
      entry: 'run',
      signature: 'run(capacity: int, ops: list[list]) -> list[int]',
      starter: code`from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity):
        pass

    def get(self, key):
        pass

    def put(self, key, value):
        pass


# The tests call run(); don't change it.
def run(capacity, ops):
    c = LRUCache(capacity)
    out = []
    for op in ops:
        if op[0] == "get":
            out.append(c.get(op[1]))
        else:
            c.put(op[1], op[2])
    return out
`,
      solution: code`from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.items = OrderedDict()

    def get(self, key):
        if key not in self.items:
            return -1
        self.items.move_to_end(key)
        return self.items[key]

    def put(self, key, value):
        self.items[key] = value
        self.items.move_to_end(key)
        if len(self.items) > self.capacity:
            self.items.popitem(last=False)


def run(capacity, ops):
    c = LRUCache(capacity)
    out = []
    for op in ops:
        if op[0] == "get":
            out.append(c.get(op[1]))
        else:
            c.put(op[1], op[2])
    return out
`,
      explanation: md('The ordered dict *is* the recency list: oldest first, newest last. The common slips are forgetting that `get` counts as a use, and forgetting that updating an existing key must also move it to the end.'),
      tests: [
        ex('Example', 2, [['put', 1, 1], ['put', 2, 2], ['get', 1], ['put', 3, 3], ['get', 2], ['get', 3]]),
        ex('Update refreshes recency', 2, [['put', 'a', 1], ['put', 'b', 2], ['put', 'a', 9], ['put', 'c', 3], ['get', 'b'], ['get', 'a']]),
        hid('Capacity one', 1, [['put', 1, 1], ['put', 2, 2], ['get', 1], ['get', 2]]),
        hid('Miss on empty', 3, [['get', 'x']]),
      ],
    }),

    python({
      id: 'hit-counter-window',
      title: 'The Event Window: Hits in the Last 5 Minutes',
      difficulty: 'Medium',
      topics: ['OOP', 'Stacks & Queues', 'Streaming & State'],
      patterns: ['Sliding window with a deque'],
      domains: ['APIs / Integration'],
      ...tag(ddp('Citadel', 'The Event Window')),
      roles: DE,
      summary: 'Count API hits in a rolling 300-second window with amortised O(1) operations.',
      description: md(
        'Implement `HitCounter` with `hit(ts)` and `count(ts)` → number of hits with timestamp in `(ts - 300, ts]`. Timestamps (seconds) are non-decreasing across calls; many hits can share a timestamp.',
        '',
        '`run(ops)` applies `["hit", ts]` / `["count", ts]` and returns the counts.',
      ),
      hints: ['Store `[ts, n]` pairs in a deque (aggregate equal timestamps) and keep a running total; evict from the left on every call.'],
      entry: 'run',
      signature: 'run(ops: list[list]) -> list[int]',
      starter: code`from collections import deque

class HitCounter:
    def __init__(self):
        pass

    def hit(self, ts):
        pass

    def count(self, ts):
        pass


# The tests call run(); don't change it.
def run(ops):
    h = HitCounter()
    out = []
    for op, ts in ops:
        if op == "hit":
            h.hit(ts)
        else:
            out.append(h.count(ts))
    return out
`,
      solution: code`from collections import deque

class HitCounter:
    WINDOW = 300

    def __init__(self):
        self.buckets = deque()
        self.total = 0

    def _evict(self, ts):
        while self.buckets and self.buckets[0][0] <= ts - self.WINDOW:
            self.total -= self.buckets.popleft()[1]

    def hit(self, ts):
        self._evict(ts)
        if self.buckets and self.buckets[-1][0] == ts:
            self.buckets[-1][1] += 1
        else:
            self.buckets.append([ts, 1])
        self.total += 1

    def count(self, ts):
        self._evict(ts)
        return self.total


def run(ops):
    h = HitCounter()
    out = []
    for op, ts in ops:
        if op == "hit":
            h.hit(ts)
        else:
            out.append(h.count(ts))
    return out
`,
      explanation: md('Each timestamp bucket enters and leaves the deque once, so both operations are amortised O(1), and grouping equal timestamps bounds memory by the number of distinct seconds in the window. The follow-up ("hits are not in order") calls for a 300-slot circular array keyed by `ts % 300`.'),
      tests: [
        ex('Example', [['hit', 1], ['hit', 2], ['hit', 3], ['count', 4], ['hit', 300], ['count', 300], ['count', 301]]),
        ex('Many hits at once', [['hit', 10], ['hit', 10], ['hit', 10], ['count', 10]]),
        hid('Window boundary', [['hit', 0], ['count', 299], ['count', 300]]),
        hid('Long gap empties the window', [['hit', 5], ['hit', 6], ['count', 1000]]),
      ],
    }),
  ],
};
