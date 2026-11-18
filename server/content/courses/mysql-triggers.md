# MySQL: Triggers — Complete Reference

A trigger is a stored program that **fires automatically** in response to a DML event (`INSERT`, `UPDATE`, `DELETE`) on a table. You can't call one manually — the event is the invocation. Combined with timing (`BEFORE`/`AFTER`), that gives six trigger types.

## The Model: Timing × Event × OLD/NEW

| Timing | Fires… | Superpower |
| --- | --- | --- |
| `BEFORE` | before the row change is written | can **modify NEW values** or **reject** the change |
| `AFTER` | after the change is committed | can safely **react** — log, cascade, aggregate |

| Reference | Available in | Meaning |
| --- | --- | --- |
| `NEW.column` | INSERT, UPDATE | the incoming value |
| `OLD.column` | UPDATE, DELETE | the previous value |

## BEFORE INSERT — validate & normalize

```sql
DELIMITER //
CREATE TRIGGER validate_new_employee
BEFORE INSERT ON employees
FOR EACH ROW
BEGIN
    IF NEW.salary < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Salary cannot be negative';
    END IF;
    SET NEW.created_at = NOW();          -- auto-populate fields
END //
DELIMITER ;
```

Use for: rejecting invalid rows with `SIGNAL`, auto-filling slugs/timestamps, forcing formats (uppercase codes). Cost: adds latency to every insert; failures are silent to debug unless you `SIGNAL` explicitly.

## AFTER INSERT — react & cascade

```sql
DELIMITER //
CREATE TRIGGER log_new_user
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_log (action, user_id, timestamp)
    VALUES ('USER_CREATED', NEW.id, NOW());
END //
DELIMITER ;
```

Use for: audit logs, cascading inserts, decrementing `inventory.stock` by `NEW.quantity` when an order lands. The row is committed — you can't modify it anymore, only respond to it.

## BEFORE UPDATE — compare OLD vs NEW, block or correct

```sql
DELIMITER //
CREATE TRIGGER validate_salary_update
BEFORE UPDATE ON employees
FOR EACH ROW
BEGIN
    -- block cuts deeper than 20%
    IF NEW.salary < OLD.salary * 0.80 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Salary cut exceeds 20% limit';
    END IF;
    SET NEW.updated_at = NOW();
END //
DELIMITER ;
```

Gotcha: the trigger fires on **every** UPDATE, even when the monitored column didn't change — guard with `IF NEW.col != OLD.col`. And silently correcting NEW values means the stored data differs from what the app sent; document it.

## AFTER UPDATE — the audit trail

```sql
DELIMITER //
CREATE TRIGGER audit_salary_change
AFTER UPDATE ON employees
FOR EACH ROW
BEGIN
    IF OLD.salary != NEW.salary THEN
        INSERT INTO salary_audit (employee_id, old_salary, new_salary, changed_at)
        VALUES (OLD.id, OLD.salary, NEW.salary, NOW());
    END IF;
END //
DELIMITER ;
```

Having both `OLD` and `NEW` makes this the canonical change-delta logger (GDPR-friendly email-change history, etc.). Watch the audit table's growth on hot rows.

## BEFORE DELETE — block or archive

```sql
DELIMITER //
CREATE TRIGGER prevent_admin_delete
BEFORE DELETE ON users
FOR EACH ROW
BEGIN
    IF OLD.role = 'admin' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Admin accounts cannot be deleted';
    END IF;
    INSERT INTO users_archive SELECT *, NOW() FROM users WHERE id = OLD.id;
END //
DELIMITER ;
```

Last line of defense against destructive deletes; archives rows before they vanish. Only `OLD` exists (there's no new row in a delete). Bulk deletes pay the per-row cost.

## AFTER DELETE — cleanup & aggregates

```sql
DELIMITER //
CREATE TRIGGER log_deleted_order
AFTER DELETE ON orders
FOR EACH ROW
BEGIN
    INSERT INTO deletion_log (table_name, record_id, deleted_at)
    VALUES ('orders', OLD.id, NOW());

    UPDATE customers
       SET order_count = order_count - 1
     WHERE id = OLD.customer_id;
END //
DELIMITER ;
```

Keeps denormalized aggregates in sync without application code. Caution: aggregate updates inside triggers can race under heavy concurrency.

## Managing Triggers

```sql
DROP TRIGGER IF EXISTS trigger_name;

SHOW TRIGGERS;                          -- all triggers in the current DB
SHOW CREATE TRIGGER trigger_name;       -- full definition

SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'your_table';

-- MySQL has NO native DISABLE TRIGGER:
-- workaround = a control-flag table the trigger checks, or drop + recreate
```

## Rules & Gotchas

| Rule | Detail |
| --- | --- |
| `FOR EACH ROW` only | MySQL triggers are row-level: a 10,000-row UPDATE fires the trigger 10,000 times |
| No recursion | A trigger can't UPDATE the table it's defined on — error |
| `SIGNAL SQLSTATE '45000'` | The standard way to raise a custom error and abort the operation |
| Ordering (5.7+) | Multiple triggers on one event fire in creation order; control with `FOLLOWS` / `PRECEDES` |
| No result sets | Triggers can't `SELECT` back to the client |
| Transactional | Trigger effects roll back with the enclosing transaction |

## Quick Reference

| Trigger | Purpose | Remember |
| --- | --- | --- |
| BEFORE INSERT | validate / modify NEW | can reject with SIGNAL |
| AFTER INSERT | log / cascade | row is committed, immutable |
| BEFORE UPDATE | compare OLD vs NEW, block or correct | fires even when column unchanged |
| AFTER UPDATE | change-delta audit trail | can't undo the update |
| BEFORE DELETE | block or archive | no NEW reference exists |
| AFTER DELETE | cleanup, aggregate sync | the row is already gone |
