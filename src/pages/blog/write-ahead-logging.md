---
layout: ../../layouts/BlogPost.astro
title: 'Write-Ahead Logging and Database Durability'
date: '2026-04-21 18:30 MDT'
description: 'Write-ahead logging is the mechanism behind crash safety in almost every serious storage system. This post explains how it works from first principles, and how PostgreSQL, SQLite, RocksDB, and etcd each implement the same core idea.'
tags: ['databases', 'storage', 'wal', 'postgres']
showToc: true
---

I've been thinking a lot about the internals of deeply distributed, highly resilient systems lately. In my [previous post on Multi-Raft Architecture](/blog/multi-raft-architecture), I wrote about how distributed databases achieve consensus across thousands of nodes. But before a node can agree with its peers, it needs to ensure its *own* data is secure. Before a database cluster can survive a network partition, a single node must survive having its power cord pulled out.

Almost every serious data system, from massive streaming architectures detailed by [Netflix](https://netflixtechblog.com/building-a-resilient-data-platform-with-write-ahead-log-at-netflix-127b6712359a) to the SQLite file embedded in your phone, solves local durability with the exact same mechanism: **Write-Ahead Logging (WAL)**.

## The Problem WAL Solves

A naive database design writes data directly to disk. If an application updates a customer's balance, the database finds the exact location of that record on the hard drive and overwrites it. 

The problem is that writes are not atomic at the hardware level. If the system crashes mid-write, or if power is lost while the disk is partially through flushing a sector, you get **torn pages** - partial data corruption that leaves your database in an unreadable state. 

To solve this, the database needs a way to make changes safely without destroying the current state if something goes wrong.

The solution is to write a description of the change to an append-only log first, then apply it to the data files asynchronously. If the system crashes, it reads the log on startup to replay the missing changes.

## How It Works

The fundamental rule of Write-Ahead Logging is that the log record must be safely flushed to disk before the database acknowledges the transaction.

Writing to the log is fast because it is append-only. The disk drive doesn't have to seek to find specific rows. It just sequentially writes blocks of data to the end of a file. Sequential I/O is orders of magnitude faster than random I/O, even on modern NVMe drives.

A typical WAL record contains:
1. **What changed** (the payload).
2. **Where it changed** (the specific page or row).
3. A **Log Sequence Number (LSN)** to track its exact position in the log history.

The database periodically performs a **checkpoint**. It flushes all the pending changes from memory into the permanent data files and records the current LSN. Once a checkpoint finishes successfully, any WAL files older than that LSN can be safely deleted or archived, because those changes are now permanently embedded in the main database files.

```mermaid
sequenceDiagram
    participant C as Client
    participant DB as DB Engine (RAM)
    participant W as WAL (Disk)
    participant D as Data Files (Disk)

    C->>DB: UPDATE table SET value = 1
    DB->>DB: Update in memory
    DB->>W: Append WAL Entry (Sequential I/O)
    Note over W: Fsync (forced write)
    W-->>DB: Ack
    DB-->>C: Success!

    Note over DB,D: ... Sometime later (Checkpoint) ...
    DB->>D: Flush modified pages (Random I/O)
    DB->>W: Update Checkpoint LSN
```

While the core concept is the same, databases implement WALs differently depending on their architecture. 

## PostgreSQL

In PostgreSQL, the write-ahead logs live in the `pg_wal` directory (formerly `pg_xlog`). Each default file is 16MB of dense, sequential history.

PostgreSQL relies heavily on a massive chunk of RAM called `shared_buffers`. When you write to Postgres, it modifies the page in `shared_buffers` and immediately writes a WAL record. The actual data file isn't touched until a background process called the "checkpointer" wakes up and flushes the dirty buffers to disk.

This setup gives you a lot of control. For absolute safety, keeping `synchronous_commit = on` means Postgres will wait for the WAL to hit the physical disk before telling the app the transaction succeeded. For raw speed at the cost of potentially losing a few milliseconds of data on a hard crash, `synchronous_commit = off` tells Postgres to report success immediately and flush the WAL to disk a split second later.

I always wondered how Amazon RDS for PostgreSQL achieves Point-In-Time Recovery (PITR), allowing you to restore a database to a specific *second*. Under the hood, AWS is just taking a periodic base snapshot and endlessly streaming the `pg_wal` files to an S3 bucket. When requesting a restore, RDS instantiates the snapshot and rapidly replays the archived WAL files precisely up to the target timestamp.

## SQLite

SQLite traditionally used a "rollback journal", where it would copy the *old* data to a separate file, write the *new* data to the main file, and delete the journal on success. If a crash occurred, it would use the old data to roll back the corrupted changes.

Modern SQLite offers a WAL mode (`pragma journal_mode=WAL;`), which flips this process around to match the append-only paradigm of larger databases. 

WAL mode also improves concurrency in SQLite. Because writers only append to the WAL and readers can read from the main database file (checking the WAL for recent changes), readers no longer block writers, and writers no longer block readers.

## RocksDB

RocksDB, and the systems built on it like CockroachDB's storage engine Pebble, uses a **Log-Structured Merge (LSM) tree** instead of traditional B-trees.

When writing to RocksDB, the data is stored in an in-memory structure called a **MemTable**. Maintaining a massive, sorted tree structure on disk during active writes is way too slow. 

Because RAM is volatile, RocksDB appends every write to a Write-Ahead Log before updating the MemTable. When the MemTable fills up, it is flushed to disk as an immutable **SSTable (Sorted String Table)**. Once the SSTable is safely on disk, the corresponding WAL is discarded. The WAL only exists to protect data until it is safely flushed from memory.


## etcd

For a distributed key-value store like etcd, the log is used for more than local crash recovery. 

Etcd uses the Raft consensus algorithm. In Raft, the log is the authoritative state of the cluster.

When a leader receives a write, it appends the entry to its WAL and proposes it to the followers. The leader only commits the write after a quorum (majority) of nodes have flushed the entry to their own WALs.

The WAL acts as the distributed consensus mechanism. Because the log is durable across multiple independent machines, the cluster can maintain consensus and tolerate node failures.

## What They Have In Common

Despite the different architectures, all these systems rely on Write-Ahead Logging for the same core reasons:

- **Sequential I/O:** Appending data is significantly faster than performing random I/O to overwrite existing pages.
- **Deferred work:** The database can acknowledge a write immediately after the sequential WAL write, deferring the expensive updates to B-trees or LSM trees to background processes.
- **Checkpointing:** Every implementation requires a way to flush in-memory state and truncate the log, preventing it from consuming the entire disk or causing slow recovery times.

The core durability mechanism across all these storage systems remains the same: an append-only log.

## Further Reading

- [PostgreSQL WAL Documentation](https://www.postgresql.org/docs/current/wal-intro.html)
- [How SQLite WAL Works](https://www.sqlite.org/wal.html)
- [RocksDB Write-Ahead Log](https://github.com/facebook/rocksdb/wiki/Write-Ahead-Log-%28WAL%29)
- [Building a resilient data platform with WAL at Netflix](https://netflixtechblog.com/building-a-resilient-data-platform-with-write-ahead-log-at-netflix-127b6712359a)
- *Designing Data-Intensive Applications* by Martin Kleppmann - Chapter 3 provides an incredible deep dive into storage engines and WAL.

<div class="quiz-widget">
  <div class="quiz-header">
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    Knowledge Check <span class="quiz-progress"></span>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">What is the fundamental hardware problem that makes Write-Ahead Logging necessary?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>CPUs process data faster than RAM can store it.</div></div>
      <div class="quiz-option" data-letter="B"><div>Writes are not atomic, leading to torn pages and data corruption during a crash.</div></div>
      <div class="quiz-option" data-letter="C"><div>Hard drives have a limited number of read/write cycles.</div></div>
      <div class="quiz-option" data-letter="D"><div>Network latency causes packets to arrive out of order.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> If power is lost while the disk is partially through flushing a sector, you get torn pages. A WAL ensures changes are safely recorded before modifying the actual data files.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. The core issue is that disk writes are not hardware-atomic. A mid-write crash causes torn pages, which corrupt the database.</div>
  </div>

  <div class="quiz-question-block" data-correct="C">
    <div class="quiz-question">Why is writing to the WAL significantly faster than writing directly to the main database tables?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>The WAL only stores metadata, not actual payloads.</div></div>
      <div class="quiz-option" data-letter="B"><div>The WAL bypasses the operating system's filesystem cache.</div></div>
      <div class="quiz-option" data-letter="C"><div>The WAL is append-only, utilizing extremely fast sequential I/O instead of random I/O.</div></div>
      <div class="quiz-option" data-letter="D"><div>The WAL is kept entirely in volatile RAM.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> Sequential I/O is orders of magnitude faster than random I/O, even on modern NVMe drives, because the disk doesn't have to seek to specific locations.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>C</strong>. The WAL is an append-only log, meaning all writes are strictly sequential, which is incredibly fast compared to the random I/O required to update B-tree pages in place.</div>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">In PostgreSQL, what does setting <code>synchronous_commit = off</code> do?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>It disables the WAL entirely to maximize throughput.</div></div>
      <div class="quiz-option" data-letter="B"><div>It acknowledges the transaction immediately and flushes the WAL a split second later, risking a few milliseconds of data loss on a hard crash.</div></div>
      <div class="quiz-option" data-letter="C"><div>It forces the database to write to both the WAL and the main heap file simultaneously.</div></div>
      <div class="quiz-option" data-letter="D"><div>It prevents autovacuum from running during heavy write loads.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> It trades absolute durability for raw speed. If the server loses power in that exact split second, you lose those transactions, but your database itself won't be corrupted.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. It tells Postgres to report success immediately and flush the WAL asynchronously, trading absolute durability for performance.</div>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">How does modern SQLite's WAL mode improve database concurrency?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>It eliminates the need for any locking by storing each row in a separate file.</div></div>
      <div class="quiz-option" data-letter="B"><div>It allows readers to read the main database file while writers append to the WAL, meaning they no longer block each other.</div></div>
      <div class="quiz-option" data-letter="C"><div>It compresses write payloads so they can be transmitted over the network faster.</div></div>
      <div class="quiz-option" data-letter="D"><div>It partitions the database across multiple independent nodes.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> By separating active writes (in the WAL) from the established data (in the main file), readers and writers can operate simultaneously without locking each other out.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. Because writers only append to the WAL, readers can read from the main file uninterrupted. Readers and writers no longer block each other.</div>
  </div>

  <div class="quiz-question-block" data-correct="A">
    <div class="quiz-question">In a distributed key-value store like etcd, what additional role does the WAL play beyond local crash recovery?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>It serves as the distributed consensus mechanism, acting as the authoritative state of the cluster across multiple nodes.</div></div>
      <div class="quiz-option" data-letter="B"><div>It automatically encrypts data before it is sent over the network.</div></div>
      <div class="quiz-option" data-letter="C"><div>It garbage collects old versions of keys to save disk space.</div></div>
      <div class="quiz-option" data-letter="D"><div>It acts as a cache for frequently read queries.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> Under the Raft algorithm, the log is the authoritative state. A write is only committed once a quorum of nodes have safely appended it to their respective WALs.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>A</strong>. In systems using Raft (like etcd), the WAL serves as the distributed consensus mechanism. A transaction is committed when a majority of nodes have it in their WALs.</div>
  </div>

  <div class="quiz-footer">
    <button class="quiz-next-btn">Next Question →</button>
  </div>
  
  <div class="quiz-results">
    <h4>Quiz Complete!</h4>
    <p>You scored <strong class="quiz-score">0</strong> out of <strong>5</strong>.</p>
  </div>
</div>
