export default {
  id: 'unsold-products',
  track: 'pyspark',
  title: 'Products Never Sold',
  difficulty: 'Easy',
  topics: ['Joins', 'Filtering', 'DataFrame Basics'],
  patterns: ['Anti-join (left_anti)'],
  domains: ['E-commerce / Sales'],
  companies: ['Amazon'],
  sources: [{ company: 'Amazon', label: 'SparkPlayground — Amazon "Unsold Products"', url: 'https://www.sparkplayground.com/pyspark-coding-interview-questions' }],
  summary: 'List catalog products with no sales at all, using an anti-join.',

  description: `Merchandising wants to delist dead stock. Return every product in \`products\` that has **no row** in \`sales\`.

Return \`product_id\`, \`name\`, \`category\`, ordered by \`product_id\`. A sale with a NULL \`product_id\` doesn't belong to any product.`,

  hints: [
    'Spark has a join type for exactly this: how="left_anti".',
    'left_anti keeps the left side\'s columns only — no need to drop anything.',
  ],

  entry: 'solve',
  signature: 'solve(spark: SparkSession, products: DataFrame, sales: DataFrame) -> DataFrame',
  schema: [
    { name: 'products', columns: [['product_id', 'INTEGER', 'Primary key'], ['name', 'VARCHAR', 'Product name'], ['category', 'VARCHAR', 'Category']] },
    { name: 'sales', columns: [['sale_id', 'INTEGER', 'Primary key'], ['product_id', 'INTEGER', 'Sold product (nullable)'], ['qty', 'INTEGER', 'Units'], ['sale_date', 'DATE', 'Day']] },
  ],
  outputColumns: ['product_id', 'name', 'category'],

  starter: `from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F


def solve(spark: SparkSession, products: DataFrame, sales: DataFrame) -> DataFrame:
    return products.orderBy("product_id")
`,

  solution: `from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F


def solve(spark: SparkSession, products: DataFrame, sales: DataFrame) -> DataFrame:
    return (products
            .join(sales, on="product_id", how="left_anti")
            .select("product_id", "name", "category")
            .orderBy("product_id"))
`,

  explanation: `**\`left_anti\` join.** It returns left rows that have **no** match on the right — Spark's built-in anti-join. It's NULL-safe here (a NULL key never matches) and avoids the \`left\` join + \`isNull\` filter + \`drop\` dance.

Its sibling \`left_semi\` keeps rows that **do** match, without duplicating them when the right side has many matches.

**Complexity:** one shuffle (or a broadcast of \`sales\` keys if small).`,

  tests: [
    {
      name: 'Example',
      ordered: true,
      tables: {
        products: [[1, 'Kettle', 'Home'], [2, 'Lamp', 'Home'], [3, 'Mouse', 'Tech'], [4, 'Cable', 'Tech']],
        sales: [[100, 1, 2, '2024-06-01'], [101, 3, 1, '2024-06-01'], [102, 1, 1, '2024-06-02']],
      },
      expected: [[2, 'Lamp', 'Home'], [4, 'Cable', 'Tech']],
    },
    {
      name: 'Everything sold',
      ordered: true,
      tables: { products: [[1, 'A', 'X']], sales: [[1, 1, 5, '2024-06-01']] },
      expected: [],
    },
    {
      name: 'No sales at all',
      hidden: true,
      ordered: true,
      tables: { products: [[9, 'Z', 'Y'], [8, 'W', 'Y']], sales: [] },
      expected: [[8, 'W', 'Y'], [9, 'Z', 'Y']],
    },
    {
      name: 'NULL and unknown product ids in sales',
      hidden: true,
      ordered: true,
      tables: { products: [[1, 'A', 'X'], [2, 'B', 'X']], sales: [[1, null, 1, '2024-06-01'], [2, 77, 1, '2024-06-01'], [3, 2, 1, '2024-06-01']] },
      expected: [[1, 'A', 'X']],
    },
  ],
};
