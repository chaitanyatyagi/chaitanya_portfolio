# Data Security Design Patterns

Production datasets are valuable, easy to reach, and therefore prime targets. Modern data security stands on four pillars: **compliance management** (GDPR/CCPA deletion rights), **fine-grained access control** (cell/row/column-level gates), **data protection** (unreadable at rest and in transit), and **hardened connectivity** (no credentials in Git — ever).

## Vertical Partitioner (Compliance)

**Problem.** A compliance pipeline must execute rolling "right to be forgotten" deletions across terabytes of transaction history. Personal attributes (birthdates, government IDs) are cloned identically across millions of transaction logs — so a single user's erasure means scrubbing everywhere, at enormous compute cost.

**Solution.** Separate mutable transactional attributes from static personal data. Store PII **once**, in its own physical location, linked to events by a non-sensitive `user_id`. Deleting a person becomes a one-row operation instead of a terabyte scan.

```text
Incoming raw row ──▶ Event table (no PII)      [user_id + actions]
                 └─▶ PII master table          [stored ONCE per user]
```

```python
def split_visit_attributes(visits_to_save, batch_id):
    visits_to_save.persist()

    # Path A: non-PII transaction properties
    events = (visits_to_save
        .filter("user_id IS NOT NULL")
        .withColumn("context", F.col("context").dropFields("user"))
        .select(F.col("visit_id").alias("key"), F.to_json(F.struct("*")).alias("value")))

    # Path B: isolate PII to a single dedicated target
    pii = (visits_to_save
        .selectExpr("context.user.user_id", "context.user.birthday", "context.user.personal_id")
        .select(F.col("user_id").alias("key"), F.to_json(F.struct("*")).alias("value")))

    # write each path to its own topic / table
    visits_to_save.unpersist()
```

**Erasure mechanics you must know:**

- **Delta/Iceberg lakehouses** — `.delete()` only updates metadata pointers. You **must** run `VACUUM` afterward to physically purge old file blocks, or Time Travel can resurrect the data.
- **Kafka** — publish a **tombstone** (the record key with a NULL payload) to a topic with `cleanup.policy=compact`; background compaction removes all matching history.

**Trade-offs.** Writes get faster and storage shrinks (no duplicated heavy strings), but analytical reads pay a join penalty to reconstruct unified rows.

## In-Place Overwriter

**Problem.** You inherit an immutable legacy system: terabytes of flat JSON/CSV files, no deletion strategy, no budget to migrate to a lakehouse — and new privacy laws to satisfy.

**Solution.** An asynchronous batch pipeline scans the dataset, filters out records of users who requested removal, and **rewrites the remainder**. To survive mid-job crashes, write output to a hidden **staging area** first and swap it with the public directory only after the write fully succeeds.

**Optimization:** with footer-stats formats like Parquet, the job reads only row-group min/max statistics; if a file's stats prove the target user isn't inside, the whole block is skipped — no wasted I/O.

## Fine-Grained Accessor for Tables

**Problem.** Everyone with database access sees every column of every row — including columns only the fraud team should see.

**Solution.** Runtime query alteration inside the warehouse engine:

- **Column-level grants** — `GRANT SELECT(col_a) ON table TO role`.
- **Dynamic masking** — cells transform at execution time based on group membership; authorized users see real data, others see placeholders.
- **Row filters / access policies** — the engine silently appends filters from session context (`WHERE region = user_session_region`).

```sql
-- Databricks Unity Catalog: dynamic column masking
CREATE FUNCTION ip_mask(ip STRING)
RETURN CASE WHEN is_member('engineers') THEN ip ELSE '0.0.0.0' END;

CREATE TABLE dedp.visits (
    visit_id STRING,
    ip       STRING MASK ip_mask
);
```

## Fine-Grained Accessor for Resources

**Problem.** Processing clusters run with broad read/write permissions. One compromised script or misconfigured job can overwrite unrelated data in the object store.

**Solution.** Enforce least privilege at the infrastructure layer, via either **resource-based** policies (attached to the specific bucket/stream) or **identity-based** policies (scoped to the exact execution identity running the job).

```hcl
resource "aws_iam_policy" "visits_read_writer_policy" {
  name = "visits_rw"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["kinesis:Get*", "kinesis:Describe*", "kinesis:Put*"]
      Resource = ["arn:aws:kinesis:us-east-1:12345:stream/visits-stream"]
    }]
  })
}
```

## Encryptor

**Problem.** If physical disks or transport lanes are compromised, plaintext data is immediately readable.

**Solution.** End-to-end cryptographic safeguards:

- **Client-side encryption** — the producer encrypts locally *before* transmission and owns key isolation and rotation.
- **Server-side encryption (SSE)** — the storage layer encrypts transparently during I/O, integrated with managed key stores (AWS KMS, Cloud KMS, Azure Key Vault) that validate access tokens before decrypting.

> **Key-loss is data-loss.** Deleting an encryption key renders every associated file permanently unreadable. Always configure a soft-delete retention window (e.g., `deletion_window_in_days = 14`) so an accidental key deletion can be recovered.

## Anonymizer vs. Pseudo-Anonymizer

Two patterns with fundamentally different goals when sharing data externally:

| Attribute | Anonymizer | Pseudo-Anonymizer |
| --- | --- | --- |
| Mechanism | Irreversible removal or perturbation (random noise) | Replace values with realistic tokens; real values live in a secure vault |
| Downstream utility | Low — data loss limits analytics/ML | High — preserves structure and relational lookups |
| Re-identification risk | Zero, even when joining tables | Real — tokens joined with complementary datasets can re-identify people |

Pick **Anonymizer** when the recipient never needs to trace back to individuals; pick **Pseudo-Anonymizer** when analytics needs joinability and you can protect the token vault.

## Secrets Pointer

**Problem.** A job authenticates to a billing API with a username/password pair. An engineer commits the raw credentials to a public Git repo. Exploitation is immediate; the billing liability is massive.

**Solution.** No raw secrets in source, ever. Store them in a **cloud secrets manager** and reference them by *name*; fetch values dynamically at runtime.

```python
import boto3

sm = boto3.client('secretsmanager')
db_user = sm.get_secret_value(SecretId='prod-db-username')['SecretString']
db_pass = sm.get_secret_value(SecretId='prod-db-password')['SecretString']

(spark.read
    .option('driver', 'org.postgresql.Driver')
    .properties({'user': db_user, 'password': db_pass})
    .jdbc(url='jdbc:postgresql:dedp', table='dedp.devices'))
```

> **The caching trade-off.** Caching secrets locally saves API calls and rate limits, but if credentials rotate mid-run, long-lived pipelines hit auth errors. The pragmatic pattern: let the job fail on rejection — the restart fetches the fresh secret.

## Secretless Connector

**Problem.** Even with a secrets manager, you're still managing credentials: rotating keys on a compliance schedule, supporting legacy formats during rotation windows.

**Solution.** Eliminate passwords and API keys entirely. The platform assigns a **cryptographic service identity** to the compute itself (service accounts, IAM roles, workload identity), and the cloud authenticates operations natively on the backend.

```hcl
# 1. A dedicated service identity for the compute cluster
resource "google_service_account" "visits_job_sa" {
  account_id   = "dataflow-visits-processor"
  display_name = "Dataflow identity with zero stored passwords"
}

# 2. Bind the identity directly to the bucket
resource "google_storage_bucket_iam_binding" "visits_access" {
  bucket  = "production-raw-visits-bucket"
  role    = "roles/storage.objectViewer"
  members = ["serviceAccount:${google_service_account.visits_job_sa.email}"]
}
```

## Pattern Selection Matrix

| Pattern | Pillar | Use it for | Key trade-off |
| --- | --- | --- | --- |
| Vertical Partitioner | Compliance | Cheap GDPR erasure via PII isolation | Join penalty on analytical reads |
| In-Place Overwriter | Compliance | Deletion in immutable legacy file stores | Full-directory rewrites; needs staging swap |
| Fine-Grained Accessor (tables) | Access control | Column masks, row policies at query time | Policy sprawl needs governance |
| Fine-Grained Accessor (resources) | Access control | Least-privilege compute identities | More IAM objects to manage |
| Encryptor | Protection | Unreadable data at rest/in transit | Key management is now your SPOF |
| Anonymizer / Pseudo-Anonymizer | Protection | Sharing datasets externally | Utility vs. re-identification risk |
| Secrets Pointer | Connectivity | Removing credentials from source code | Rotation vs. caching tension |
| Secretless Connector | Connectivity | Removing credentials entirely | Platform lock-in; needs infra maturity |
