# MySQL: Stored Procedures — Complete Syntax

Stored procedures put multi-step logic inside the database: one `CALL` replaces round-trips of application queries. This chapter covers every construct with its syntax, purpose, and gotchas. Mantra for the whole chapter: **procedures automate actions, functions automate calculations, triggers automate reactions.**

## DELIMITER

The MySQL client treats `;` as end-of-statement — which would truncate a procedure body at its first internal semicolon. `DELIMITER` changes the terminator so the whole block reaches the server intact.

```sql
DELIMITER //
CREATE PROCEDURE procedure_name()
BEGIN
    SELECT * FROM table_name;   -- internal ; no longer ends the statement
END //
DELIMITER ;                      -- ALWAYS reset back!
```

Gotchas: forgetting the reset (`DELIMITER ;`) silently breaks every subsequent query in the session. GUI routine editors handle this automatically; the CLI and SQL tabs don't.

## DECLARE

Creates a **local variable** scoped strictly to the `BEGIN…END` block — unlike session variables (`@var`) which live for the whole connection.

```sql
DECLARE user_count INT DEFAULT 0;
DECLARE full_name  VARCHAR(100);
DECLARE is_active  BOOLEAN DEFAULT TRUE;
```

Rules: declarations must appear **at the top of the block**, before any executable statement — and can't be introduced inside `IF`/`LOOP` bodies. There's no array type; think in terms of scalars and cursors.

## SET

Assigns values to declared or session variables.

```sql
SET user_count = 0;
SET total = price * quantity;
SET user_count = (SELECT COUNT(*) FROM users WHERE active = 1);  -- must return ONE value
SET a = 1, b = 2, c = a + b;   -- chained
```

No compound operators — write `SET x = x + 1`, not `x += 1`. For query results, `SELECT ... INTO var` is often cleaner than a subquery in `SET`.

## Parameter Modes: IN / OUT / INOUT

```sql
CREATE PROCEDURE get_stats(
    IN    dept_id   INT,        -- read-only input
    OUT   emp_count INT,        -- write-only output (starts NULL)
    INOUT threshold DECIMAL     -- read, mutate, return
)
BEGIN
    SELECT COUNT(*) INTO emp_count FROM employees WHERE dept = dept_id;
    SET threshold = threshold * 1.1;
END;

-- Calling: OUT/INOUT require session variables
SET @limit = 100;
CALL get_stats(3, @count, @limit);
SELECT @count, @limit;
```

| Mode | Direction | Mutability | Typical use |
| --- | --- | --- | --- |
| `IN` | caller → proc | read-only copy | filters, IDs |
| `OUT` | proc → caller | NULL until SET | computed results |
| `INOUT` | both | read + mutate + return | counters, accumulators |

Gotcha: omitting the mode silently defaults to `IN` — a classic source of "why is my OUT param NULL" confusion.

## IF / ELSEIF / ELSE

```sql
IF credit_score < 500 THEN
    SET rating = 'Poor';
ELSEIF credit_score < 700 THEN
    SET rating = 'Average';
ELSEIF credit_score >= 900 THEN
    SET rating = 'Excellent';
ELSE
    SET rating = 'Good';
END IF;    -- the semicolon after END IF is mandatory and often forgotten
```

## CASE

Cleaner than long IF chains for value/condition mapping. Two forms:

```sql
-- Simple CASE: match a value
CASE delivery_zone
    WHEN 1 THEN SET rate = 5.00;
    WHEN 2 THEN SET rate = 7.50;
    ELSE        SET rate = 12.00;
END CASE;

-- Searched CASE: match conditions
CASE
    WHEN civil_score < 500 THEN SET label = 'Poor';
    WHEN civil_score < 700 THEN SET label = 'Average';
    ELSE                        SET label = 'Good';
END CASE;
```

Gotcha: a statement-level `CASE` with **no matching WHEN and no ELSE raises an error** — always provide `ELSE`.

## Loops: LOOP, WHILE, REPEAT

Three constructs, differing only in *when* the exit condition is checked:

| Construct | Check | Guarantees |
| --- | --- | --- |
| `LOOP` + `LEAVE` | manual | infinite unless you `LEAVE` |
| `WHILE ... DO` | before body | may never run |
| `REPEAT ... UNTIL` | after body | always runs at least once |

```sql
-- LOOP + LEAVE: the backbone of cursor iteration
counter_loop: LOOP
    SET counter = counter + 1;
    IF counter > 10 THEN
        LEAVE counter_loop;
    END IF;
END LOOP;

-- WHILE: pre-check
WHILE counter <= 10 DO
    SET str = CONCAT(str, counter);
    SET counter = counter + 1;
END WHILE;

-- REPEAT: post-check — ideal for retry logic
REPEAT
    SET str = CONCAT(str, counter);
    SET counter = counter + 1;
UNTIL counter > 10
END REPEAT;
```

All three support `LEAVE` (break) and `ITERATE` (continue) with labels. There is **no ranged FOR loop** — manage counters manually. And remember: row-by-row loops are drastically slower than set-based SQL; loop only when the logic truly can't be expressed as a set operation.

## Cursors

A cursor iterates a result set row by row — the only way to apply complex per-row logic inside the database. Four mandatory lifecycle steps: **DECLARE → OPEN → FETCH (loop) → CLOSE.**

```sql
DELIMITER //
CREATE PROCEDURE process_users()
BEGIN
    DECLARE done       BOOLEAN DEFAULT FALSE;
    DECLARE user_email VARCHAR(255);

    -- 1. DECLARE: bind to a query (doesn't execute yet)
    DECLARE user_cursor CURSOR FOR
        SELECT email FROM users WHERE active = 1;

    -- Safety net: flips 'done' when rows are exhausted (MANDATORY)
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN user_cursor;                       -- 2. execute + allocate

    read_loop: LOOP
        FETCH user_cursor INTO user_email;  -- 3. one row per iteration
        IF done THEN
            LEAVE read_loop;
        END IF;
        INSERT INTO email_log (email, sent_at) VALUES (user_email, NOW());
    END LOOP;

    CLOSE user_cursor;                      -- 4. deallocate
END //
DELIMITER ;
```

Gotchas: the `NOT FOUND` handler is mandatory — without it, exhausting the cursor throws an error. Forgetting `CLOSE` leaks memory. And cursors are slow — treat them as a last resort after set-based SQL.

## User-Defined Functions

Functions return **exactly one scalar** and embed directly in SQL expressions — unlike procedures, which are `CALL`ed and can return result sets and OUT params.

| Stored procedure | Function |
| --- | --- |
| `CALL proc();` | `SELECT func(id) FROM t;` |
| Multiple OUT params / result sets | Exactly ONE return value |
| Multi-step batch actions | Reusable calculations |
| Can't appear inside SELECT | Usable anywhere a value fits |

```sql
DELIMITER //
CREATE FUNCTION reverse_string(any_string VARCHAR(120))
RETURNS VARCHAR(120)
DETERMINISTIC
BEGIN
    DECLARE rev VARCHAR(120) DEFAULT '';
    DECLARE i   INT DEFAULT 1;
    DECLARE len INT DEFAULT CHAR_LENGTH(any_string);
    WHILE i <= len DO
        SET rev = CONCAT(SUBSTRING(any_string, (len - i + 1), 1), rev);
        SET i = i + 1;
    END WHILE;
    RETURN rev;
END //
DELIMITER ;

SELECT reverse_string(first_name) FROM users;
```

`DETERMINISTIC` declares that identical inputs always give identical outputs — required for replication safety. Use `NOT DETERMINISTIC` when the function reads tables or calls `NOW()`. Note: functions generally can't perform DML, and some setups require `log_bin_trust_function_creators=1`.

## Quick Reference

| Construct | One-line purpose | Key gotcha |
| --- | --- | --- |
| `DELIMITER` | Change statement terminator | Always reset to `;` after `END` |
| `DECLARE` | Local scoped variable | Top of block only |
| `SET` | Assign values | Subquery must return exactly one value |
| `IN` / `OUT` / `INOUT` | Parameter data flow | Omitted mode silently = IN |
| `IF` / `CASE` | Branching | `END IF;` required; CASE needs ELSE |
| `LOOP` / `WHILE` / `REPEAT` | Iteration | REPEAT always runs once; no FOR loop |
| `CURSOR` | Row-by-row iteration | `NOT FOUND` handler is mandatory |
| `CREATE FUNCTION` | Scalar routine in SQL | One value; no DML; DETERMINISTIC flag |
