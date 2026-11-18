export default {
  id: 'longest-winning-streak',
  track: 'pandas',
  title: 'Longest Winning Streak',
  difficulty: 'Hard',
  topics: ['Window & Rolling', 'Sorting & Ranking', 'GroupBy & Aggregation', 'Apply & Vectorization'],
  patterns: ['Gaps & islands (cumsum of breaks)', 'Top-1 with ties'],
  domains: ['Gaming / Sports'],
  companies: ['Amazon'],
  sources: [{ company: 'Amazon', label: 'StrataScratch — Amazon "Player with the Longest Streak"', url: 'https://www.stratascratch.com/blog/python-pandas-interview-questions-for-data-science-part-2' }],
  summary: 'Find the player(s) with the most consecutive wins — vectorized, no loops.',

  description: `\`matches\` records each player's results: \`W\` (win), \`L\` (loss) or \`D\` (draw). A **winning streak** is a run of consecutive \`W\` results in a player's matches ordered by \`match_date\` (a player plays at most once per day). Any \`L\` or \`D\` breaks it.

Return the player(s) whose longest winning streak is the **largest of all**, with that length as \`streak\`. Return nothing if nobody has won a match.

Return \`player_id\`, \`streak\`, ordered by \`player_id\`.`,

  hints: [
    'Sort by player and date first.',
    'Islands trick: a counter that increases every time the result is NOT a win — grp = (result != "W").groupby(player).cumsum(). Wins in the same streak share (player, grp).',
    'Count wins per (player, grp), take the max per player, then keep the players equal to the overall max.',
  ],

  entry: 'solve',
  signature: 'solve(matches: pd.DataFrame) -> pd.DataFrame',
  schema: [{ name: 'matches', columns: [['player_id', 'INTEGER', 'Player'], ['match_date', 'DATE', 'Day of the match'], ['result', 'VARCHAR', "'W' · 'L' · 'D'"]] }],
  outputColumns: ['player_id', 'streak'],

  starter: `import pandas as pd


def solve(matches: pd.DataFrame) -> pd.DataFrame:
    wins = matches[matches["result"] == "W"].groupby("player_id", as_index=False).size()
    wins = wins.rename(columns={"size": "streak"})
    return wins[wins["streak"] == wins["streak"].max()].sort_values("player_id")
`,

  solution: `import pandas as pd


def solve(matches: pd.DataFrame) -> pd.DataFrame:
    m = matches.sort_values(["player_id", "match_date"]).reset_index(drop=True)
    is_win = m["result"] == "W"
    m["grp"] = (~is_win).astype(int).groupby(m["player_id"]).cumsum()
    streaks = (m[is_win].groupby(["player_id", "grp"]).size()
                        .groupby(level="player_id").max()
                        .rename("streak").reset_index())
    if streaks.empty:
        return pd.DataFrame({"player_id": [], "streak": []})
    best = streaks[streaks["streak"] == streaks["streak"].max()]
    return best.sort_values("player_id").reset_index(drop=True)
`,

  explanation: `**Gaps and islands with a cumulative sum.** Walking a player's matches in order, a counter that goes up on every non-win stays constant across a run of wins. So \`(player, counter)\` labels each winning streak; counting wins per label gives each streak's length.

Then: longest streak per player, and every player tied with the overall maximum.

This is the pandas twin of SQL's \`date − ROW_NUMBER()\` trick and avoids a Python loop over rows.

**Complexity:** O(n log n) for the sort, O(n) after.`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        matches: [
          [1, '2024-01-01', 'W'], [1, '2024-01-02', 'W'], [1, '2024-01-03', 'L'], [1, '2024-01-04', 'W'],
          [2, '2024-01-01', 'W'], [2, '2024-01-02', 'W'], [2, '2024-01-03', 'W'], [3, '2024-01-01', 'L'],
        ],
      },
      expected: [[2, 3]],
    },
    {
      name: 'A draw breaks the streak; ties return everyone',
      ordered: true,
      tables: { matches: [[5, '2024-02-03', 'W'], [5, '2024-02-01', 'W'], [5, '2024-02-02', 'D'], [4, '2024-02-01', 'W'], [4, '2024-02-02', 'L']] },
      expected: [[4, 1], [5, 1]],
    },
    { name: 'Nobody won', hidden: true, ordered: true, tables: { matches: [[1, '2024-03-01', 'L'], [2, '2024-03-01', 'D']] }, expected: [] },
    {
      name: 'Unordered dates hide the real streak',
      hidden: true,
      ordered: true,
      tables: {
        matches: [
          [7, '2024-04-04', 'W'], [7, '2024-04-01', 'W'], [7, '2024-04-03', 'W'], [7, '2024-04-02', 'W'], [7, '2024-04-05', 'L'],
          [8, '2024-04-01', 'W'], [8, '2024-04-02', 'W'], [8, '2024-04-03', 'W'],
        ],
      },
      expected: [[7, 4]],
    },
    { name: 'No matches', hidden: true, ordered: true, tables: { matches: [] }, expected: [] },
  ],
};
