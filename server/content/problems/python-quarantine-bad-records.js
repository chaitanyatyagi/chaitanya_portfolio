const o = (order_id, amount, currency) => ({ order_id, amount, currency });

export default {
  id: 'quarantine-bad-records',
  track: 'python',
  title: 'Parse Orders, Quarantine Bad Rows',
  difficulty: 'Medium',
  topics: ['Parsing (CSV / JSON)', 'Error Handling', 'Strings', 'Data Wrangling'],
  patterns: ['Schema-tolerant parsing (quarantine)', 'Validate then load'],
  domains: ['Data quality'],
  companies: [],
  sources: [{ label: 'DEV — "The 6 Python data engineering interview questions": schema-tolerant parsing', url: 'https://dev.to/datadriven/the-6-python-data-engineering-interview-questions-you-will-actually-be-asked-in-2026-504j' }],
  summary: 'Turn messy CSV lines into typed records and report which lines were rejected.',

  description: `A partner sends order files as lines of \`order_id,amount,currency\`. Load the good rows and **quarantine** the bad ones instead of failing the whole file.

Rules:

- If the first line starts with \`order_id\`, it's a header — skip it.
- Blank lines (only whitespace) are skipped, not rejected.
- Whitespace around fields is ignored.
- A row is **valid** when it has exactly 3 fields, \`order_id\` is an integer, \`amount\` is a number **≥ 0**, and \`currency\` is exactly 3 letters (normalize to upper case).
- If an \`order_id\` was already loaded, later rows with the same id are rejected.

Return \`{"valid": [{"order_id": int, "amount": float, "currency": str}, …], "rejected": [line numbers]}\` — valid rows in file order, rejected **1-based** line numbers ascending (the header is line 1 when present).`,

  hints: [
    'enumerate(lines, start=1) gives you the line numbers.',
    'Wrap int()/float() in try/except ValueError and send the line to the rejected list.',
    'str.isalpha() and len() == 3 for the currency; keep a set of loaded order ids.',
  ],

  entry: 'parse_orders',
  signature: 'parse_orders(lines: list[str]) -> dict',

  starter: `def parse_orders(lines: list[str]) -> dict:
    valid = []
    for line in lines:
        order_id, amount, currency = line.split(",")
        valid.append({"order_id": int(order_id), "amount": float(amount), "currency": currency})
    return {"valid": valid, "rejected": []}
`,

  solution: `def parse_orders(lines: list[str]) -> dict:
    valid, rejected, seen = [], [], set()
    for no, line in enumerate(lines, start=1):
        if no == 1 and line.strip().startswith("order_id"):
            continue
        if not line.strip():
            continue
        parts = [p.strip() for p in line.split(",")]
        try:
            if len(parts) != 3:
                raise ValueError("wrong field count")
            order_id, amount, currency = int(parts[0]), float(parts[1]), parts[2].upper()
            if amount < 0 or len(currency) != 3 or not currency.isalpha() or order_id in seen:
                raise ValueError("invalid value")
        except ValueError:
            rejected.append(no)
            continue
        seen.add(order_id)
        valid.append({"order_id": order_id, "amount": amount, "currency": currency})
    return {"valid": valid, "rejected": rejected}
`,

  explanation: `**Validate each row in isolation; never let one bad row stop the load.** Every check raises \`ValueError\` — the same exception \`int()\` and \`float()\` raise — so one \`except\` sends the line to quarantine.

This is the "dead-letter" pattern of production pipelines: good rows flow on, bad rows are kept with enough context (here the line number) to fix and replay them.

**Complexity:** O(n).`,

  tests: [
    {
      name: 'Example',
      args: [['order_id,amount,currency', '1,10.5,usd', '2,abc,EUR', '3, 7 ,GBP', '  ', '4,-1,USD', '5,3.25,US']],
      expected: { valid: [o(1, 10.5, 'USD'), o(3, 7, 'GBP')], rejected: [3, 6, 7] },
    },
    {
      name: 'No header; duplicate order id',
      args: [['1,5,USD', '1,6,USD', '2,1,eur']],
      expected: { valid: [o(1, 5, 'USD'), o(2, 1, 'EUR')], rejected: [2] },
    },
    { name: 'Empty file', hidden: true, args: [[]], expected: { valid: [], rejected: [] } },
    {
      name: 'Wrong field counts and bad currencies',
      hidden: true,
      args: [['1,2', '2,3,USD,extra', '3,4,U5D', '4,0,inr']],
      expected: { valid: [o(4, 0, 'INR')], rejected: [1, 2, 3] },
    },
    {
      name: 'Header only',
      hidden: true,
      args: [['order_id,amount,currency']],
      expected: { valid: [], rejected: [] },
    },
  ],
};
