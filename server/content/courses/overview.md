# Welcome to the Guide

This is my living, breathing data engineering reference — the notes I actually study from, cleaned up and published. Everything here comes from production experience (migrating 10+ global markets to GCP, building PySpark data-quality frameworks, orchestrating real-time pipelines) and deliberate study, organized so you can either **read it end-to-end** or **jump straight to the topic an interviewer just asked you about**.

## What's inside

**Data Design Patterns** — the architecture vocabulary of data engineering. Five chapters covering how data flows, how quality is enforced, how storage is organized, how data is secured, and how raw records become valuable assets. Each pattern follows the same structure: *the problem → the solution → a diagram → real code → the trade-offs*. If you internalize these, system-design interviews become conversations instead of interrogations.

**Apache Airflow** — a complete deep-dive on the orchestrator that runs most of the world's batch pipelines. Architecture, DAG authoring, operators, sensors, XComs, the TaskFlow API, executors, scheduling semantics, and the production practices that separate a demo DAG from one that survives on-call.

**PySpark** — twelve chapters from "what is a cluster" to AQE internals: architecture and how Python really talks to the JVM, the execution model (DAGs, stages, Catalyst), reading data and schemas, the DataFrame API, window functions, join strategies, Parquet internals, memory management, caching, skew optimization, and real-world patterns like SCD2. Built from my own class notes and production experience — this is the Spark interview canon.

**Databases & MySQL** — the storage-engine fundamentals: how indexes actually work under the hood, and the full syntax + semantics of stored procedures and triggers, with the gotchas that show up in interviews and in production incidents.

## How to read a pattern

Every pattern page uses the same skeleton, on purpose:

```text
Problem Context     →  the real-world pain, told as a scenario
The Solution        →  what the pattern does and why it works
Diagram             →  the shape of the architecture
Code                →  a runnable, realistic implementation
Trade-offs          →  what it costs you (nothing is free)
```

The **trade-offs section is the most important one**. Junior engineers memorize solutions; senior engineers reason about costs. When an interviewer asks *"how would you coordinate two pipelines?"*, the answer that gets the offer isn't "use a readiness marker" — it's "use a readiness marker, and here's what happens when the upstream job crashes before writing it."

## A note on the code

Code samples use the tools I use daily — **Airflow, PySpark, Spark Structured Streaming, Delta Lake, BigQuery-style SQL, Kafka** — but every pattern is tool-agnostic. A Readiness Marker is the same idea whether the marker is a `_SUCCESS` file in GCS, a row in a Postgres control table, or an S3 event notification.

> This guide grows continuously. New chapters, patterns, and interview questions are added as I learn, build, and break things in production.
