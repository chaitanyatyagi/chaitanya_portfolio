export default {
  id: 'best-equipped-city',
  track: 'pandas',
  title: 'Best-Equipped City',
  difficulty: 'Easy',
  topics: ['String Methods', 'GroupBy & Aggregation', 'Missing Data', 'Sorting & Ranking'],
  patterns: ['Parse a delimited string column', 'Top-1 with ties'],
  domains: ['Travel / Hospitality'],
  companies: ['Airbnb'],
  sources: [{ company: 'Airbnb', label: 'StrataScratch — Airbnb "City With Most Amenities"', url: 'https://www.stratascratch.com/blog/python-pandas-interview-questions-for-data-science-part-2' }],
  summary: 'Count amenities packed into a pipe-separated column and find the top city.',

  description: `Each row of \`listings\` is a rental. \`amenities\` lists its amenities separated by \`|\` (e.g. \`"Wifi|Kitchen|TV"\`); it may be empty or missing, which means **no amenities**.

Find the city whose listings have the **most amenities in total**. If several cities tie, return all of them.

Return \`city\`, \`amenities\` (the total), ordered by \`city\`.`,

  hints: [
    'fillna("") then str.split("|") — but splitting "" gives [""], which has length 1!',
    'Count with: s.str.count(r"\\|") + 1 where the string is non-empty, else 0.',
    'Group by city, sum, then keep rows equal to the max.',
  ],

  entry: 'solve',
  signature: 'solve(listings: pd.DataFrame) -> pd.DataFrame',
  schema: [{ name: 'listings', columns: [['listing_id', 'INTEGER', 'Primary key'], ['city', 'VARCHAR', 'City'], ['amenities', 'VARCHAR', 'Pipe-separated list (nullable)']] }],
  outputColumns: ['city', 'amenities'],

  starter: `import pandas as pd


def solve(listings: pd.DataFrame) -> pd.DataFrame:
    df = listings.fillna({"amenities": ""})
    df["amenities"] = df["amenities"].str.split("|").str.len()
    out = df.groupby("city", as_index=False)["amenities"].sum()
    return out[out["amenities"] == out["amenities"].max()].sort_values("city")
`,

  solution: `import pandas as pd


def solve(listings: pd.DataFrame) -> pd.DataFrame:
    a = listings["amenities"].fillna("").str.strip()
    counts = (a.str.count(r"\\|") + 1).where(a != "", 0).astype(int)
    out = (listings.assign(amenities=counts)
           .groupby("city", as_index=False)["amenities"].sum())
    if out.empty:
        return out
    best = out[out["amenities"] == out["amenities"].max()]
    return best.sort_values("city").reset_index(drop=True)
`,

  explanation: `**Count separators, not split pieces.** \`"a|b|c"\` has 2 pipes → 3 amenities. The trap: \`"".split("|")\` is \`[""]\`, length **1**, so naive splitting counts an empty listing as one amenity. Treat empty and missing as 0 explicitly.

Then aggregate per city and keep every city equal to the maximum, so ties aren't silently dropped (\`idxmax\` would return only one).

**Complexity:** O(n).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: { listings: [[1, 'Lisbon', 'Wifi|Kitchen|TV'], [2, 'Lisbon', 'Wifi'], [3, 'Porto', 'Wifi|Kitchen'], [4, 'Porto', 'Pool|Gym']] },
      expected: [['Lisbon', 4], ['Porto', 4]],
    },
    {
      name: 'Empty and missing amenities count as zero',
      ordered: true,
      tables: { listings: [[1, 'Oslo', ''], [2, 'Oslo', null], [3, 'Bergen', 'Sauna']] },
      expected: [['Bergen', 1]],
    },
    { name: 'No listings', hidden: true, ordered: true, tables: { listings: [] }, expected: [] },
    {
      name: 'A single clear winner',
      hidden: true,
      ordered: true,
      tables: { listings: [[1, 'Pune', 'A|B|C|D'], [2, 'Goa', 'A'], [3, 'Goa', ''], [4, 'Pune', null]] },
      expected: [['Pune', 4]],
    },
  ],
};
