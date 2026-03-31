---
layout: ../../layouts/BlogPost.astro
title: 'The Multi-Raft Architecture'
date: '2026-03-25 12:00 MDT'
draft: false
description: 'The Raft consensus protocol is widely adopted for building fault-tolerant distributed systems. It ensures that even if a node crashes or becomes unreachable, the cluster agrees on a single consistent state. However, single-group Raft does not scale well.'
tags: ['distributed-systems', 'Raft', 'consensus', 'architecture', 'cockroachDB', 'Redpanda', 'YugabyteDB', 'TiKV']
showToc: true
---
 
**TL;DR** Single-group Raft routes all writes through one leader, which becomes a bottleneck at scale. Multi-Raft splits the keyspace into independent ranges, each with its own Raft group and leader, so writes can proceed in parallel. Real systems like CockroachDB, TiKV, YugabyteDB, and Redpanda all do this, but differ in how they handle the operational overhead of running thousands of consensus groups at once. The hard part isn't sharding the writes - it's atomically updating keys that land in different ranges.

## How single-group Raft works

In single-group Raft, all nodes participate in **one** consensus group:
* One node is elected **leader**, all others are followers.
* Every write goes to the leader, which appends it to its **log** and replicates it to its followers.
    * A *log* is an append-only sequence of commands (or entries) that represent every write operation, in order. Each entry gets an index and a **term** (which election cycle it was created in).
    * The *log* is also used for node recovery - the restarted node replays its log to rebuild state.
* Once a **quorum** (majority) of the nodes acknowledges the entry, it's committed and applied to the _state machine_.
    * In the Raft context, a state machine is whatever system you're keeping consistent - a key-value store, a database, a configuration registry, etc. The idea is that if every node starts from the same initial state and applies the same log entries in the same order, they all end up with identical state. Raft's job is to guarantee that ordering.
* If the _leader fails_, followers hold a new **election**. The node with the most up-to-date log wins.
* Reads can be served from the *leader* (strong consistency) or *followers* (with caveats):
    * If the reads are served from followers, they might be **stale**. A follower's log might lag behind the leader's. A follower has no way to know it's behind without checking the leader.
    * To *mitigate* the stale reads, the following techniques might be employed: 
        * **lease reads** (the leader holds a time-based lease guaranteeing it's still the leader), 
        * **linearizable reads** (the leader confirms it's still the leader by getting a quorum heartbeat acknowledgment before serving the read, *adds latency*), 
        * **follower reads with bounded staleness** (acceptable in some use cases where slightly stale data is tolerable, e.g. caches or analytics). 
    * Most systems that allow *follower reads* expose this as an explicit consistency knob (e.g. CockroachDB's `AS OF SYSTEM TIME`, TiKV's follower read).

Here are a few diagrams.

#### Node State Machine (leader election)

The diagram below shows the three states a Raft node can be in and how it moves between them:

**Follower** - the default state. A node stays here as long as it keeps receiving heartbeats from a leader. If the heartbeat times out (leader is dead or unreachable), it promotes itself to Candidate.

**Candidate** - the node votes for itself and asks others to vote for it. Three outcomes:
* Wins a majority → becomes Leader
* Hears from a node with a higher term (more recent election) → steps back to Follower
* Nobody wins (split vote) → restarts the election and stays Candidate

**Leader** - handles all writes and sends periodic heartbeats. Two ways to lose leadership:
* Hears from a node with a higher term → steps down to Follower
* Loses quorum (too many nodes unreachable) → steps down to Follower

The key insight: there is **no direct Follower → Leader** path. A node **must campaign first**.

```mermaid
flowchart LR
    Follower -->|election timeout| Candidate
    Candidate -->|split vote / timeout| Candidate
    Candidate -->|quorum votes| Leader
    Candidate -->|higher term| Follower
    Leader -->|higher term| Follower
    Leader -->|loses quorum| Follower
```

#### Log Replication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant L as Leader
    participant F1 as Follower 1
    participant F2 as Follower 2

    C->>L: Write (SET x=1)
    L->>L: Append to log [idx=5]
    L->>F1: AppendEntries [idx=5]
    L->>F2: AppendEntries [idx=5]
    F1->>L: ACK
    F2->>L: ACK
    Note over L: Quorum reached → commit
    L->>L: Apply to state machine
    L->>C: Success
    L-->>F1: Notify commit
    L-->>F2: Notify commit
```

#### Log State Across Nodes
Not all nodes have the same log at any given moment, followers can lag behind the leader, for example:

| Node | Log |
|---|---|
| Leader | [1][2][3][4][5] |
| Follower 1 | [1][2][3][4][5] |
| Follower 2 | [1][2][3][4] |
| Follower 3 | [1][2] |

Raft **doesn't require** all nodes to be up to date, only a quorum (majority). Entries 1–5 are already committed because the leader + follower 1 + follower 2 = 3 out of 4 nodes acknowledged them. Follower 3 will catch up eventually.

### The problem with single-group Raft
Every write serializes through a single leader. As throughput demands grow, that one leader becomes the ceiling - you can add more nodes, but they only improve fault tolerance, not write throughput.

* **Hot key problem**. Even if your dataset is large and distributed across many machines, a single Raft leader means all writes to any key funnel through one node. One popular key can saturate the leader regardless of how much hardware you have.
* The leader is a **single point of CPU/network pressure**. It must send *AppendEntries* to every follower for every write. With many followers, this fan-out becomes expensive.
* **Snapshots and log compaction**. As the log grows unboundedly, compaction becomes a heavyweight operation that competes with normal leader duties.
* **Geographic distribution** is hard. Placing followers in distant regions increases *replication latency*, which directly hurts write commit latency since the leader waits for a quorum ACK. Amazon RDS Multi-AZ is a familiar instance of this: it places a synchronous standby in a separate availability zone for failover, but all writes still route through a single primary.

The answer is to stop thinking of the cluster as one consensus group, and start thinking of it as many.

## Multi-Raft
If you have petabytes of data, you can't put it into a single Raft log. The leader would become a **massive bottleneck**, and re-syncing a lagging follower would take weeks. 

Let's say we have 1PB of data and network bandwidth between the nodes ~ 1 Gbps (125 MB/s)

$$1 PB = 1,000,000\ GB = 1,000,000,000\ MB$$
$$1,000,000,000\ MB ÷ 125\ MB/s = 8,000,000\ seconds$$
$$= 133,333\ minutes$$
$$= 2,222\ hours$$
$$= ~92\ days$$

Even at 10 Gbps:
$$1,000,000,000\ MB ÷ 1,250\ MB/s = 800,000\ seconds ≈ 9\ days$$

At petabyte scale, re-syncing a follower over a 10 Gbps link would take roughly 9 days under ideal conditions (assuming the link is 100% dedicated to replication with no competing traffic, no CPU overhead, no disk I/O bottleneck on the receiving end) - far longer in practice.

To solve this, modern distributed systems use **Multi-Raft**.

In Multi-Raft, the keyspace is split into **ranges** (sometimes called shards or regions). Each range covers a contiguous slice of the keyspace and is managed by its own independent Raft group, with its own leader, its own log, and its own set of replicas. A write to key `a` goes to range 1's leader; a write to key `z` goes to range 2's leader - in parallel, with no coordination between them.

```mermaid
flowchart LR
    subgraph Node1["Node 1"]
        R1L["Range 1 - Leader"]
        R2F1["Range 2 - Follower"]
        R3F1["Range 3 - Follower"]
    end
    subgraph Node2["Node 2"]
        R1F2["Range 1 - Follower"]
        R2L["Range 2 - Leader"]
        R3F2["Range 3 - Follower"]
    end
    subgraph Node3["Node 3"]
        R1F3["Range 1 - Follower"]
        R2F3["Range 2 - Follower"]
        R3L["Range 3 - Leader"]
    end
```

This unlocks what single-group Raft cannot provide:

- **Horizontal write throughput** - multiple leaders accept writes simultaneously
- **Bounded resync** - a lagging follower only needs to catch up on its range's log, not the entire dataset
- **Geographic flexibility** - each range's leader can be placed close to the clients that write to it

### How it looks in practice

Several real systems are built exactly this way.

#### CockroachDB

CockroachDB splits data into **512 MB ranges by default**, each backed by an **independent Raft group**. A single node in a large cluster can be a member of tens of thousands of Raft groups simultaneously.

To keep heartbeat traffic from overwhelming the network, *CockroachDB coalesces all heartbeats between any two nodes into a single RPC*, reducing overhead from O(ranges) to O(nodes).

```mermaid
sequenceDiagram
    participant A as Node A
    participant B as Node B

    Note over A,B: Without coalescing
    A->>B: Heartbeat (Range 1)
    A->>B: Heartbeat (Range 2)
    A->>B: Heartbeat (Range 3)

    Note over A,B: With coalescing
    A->>B: Heartbeat (Range 1 + Range 2 + Range 3)
```

CockroachDB also introduces the concept of a **leaseholder**: the Raft leader is granted a **time-based lease** during which it can serve reads locally, without a quorum round-trip. This avoids the latency cost of standard Raft where every read requires confirmation that the leader hasn't been deposed.

```mermaid
sequenceDiagram
    participant C as Client
    participant L as Leaseholder
    participant F1 as Follower 1
    participant F2 as Follower 2

    Note over C,F2: Standard Raft read
    C->>L: Read
    L->>F1: Confirm still leader?
    L->>F2: Confirm still leader?
    F1->>L: ACK
    F2->>L: ACK
    L->>C: Response

    Note over C,F2: Leaseholder read
    C->>L: Read
    Note over L: Lease valid - no round-trip needed
    L->>C: Response
```

([Cockroach Labs Blog: Scaling Raft](https://www.cockroachlabs.com/blog/scaling-raft/))

#### TiKV

TiKV (the storage layer behind TiDB, a distributed SQL database) calls its ranges **regions** (default 96 MB) and uses a **placement driver** to manage leader distribution and rebalancing. The naive approach to managing thousands of Raft groups would be **one thread per group**. TiKV avoids this by driving all Raft state machines through a **shared event loop written in Rust**, processing multiple ready-states in a single batch to reduce context-switching overhead.

TiKV's event loop is essentially a pipeline. At each tick it *collects all Raft groups* that have something to do (new entries, heartbeats, timeouts), *processes* them together, *writes to RocksDB* in one batch, then sends all network messages. Here's how that looks:

```mermaid
sequenceDiagram
    participant R1 as Region 1
    participant R2 as Region 2
    participant R3 as Region 3
    participant EL as Event Loop
    participant DB as RocksDB
    participant N as Network

    R1->>EL: Ready (new entries)
    R2->>EL: Ready (heartbeat)
    R3->>EL: Ready (commit)
    Note over EL: Collect all ready regions
    EL->>DB: WriteBatch (R1 + R2 + R3)
    EL->>N: Send messages (R1 + R2 + R3)
    DB->>EL: Done
    N->>EL: Done
    Note over EL: Advance all state machines
```

([TiKV Blog: Building a large-scale distributed storage system based on Raft](https://tikv.org/blog/building-distributed-storage-system-on-raft/))

#### YugabyteDB

YugabyteDB is an open-source distributed SQL database built by Yugabyte. It's PostgreSQL-compatible at the SQL layer (YSQL) and sits on top of a distributed storage engine called DocDB, which is where the Multi-Raft logic lives.

YugabyteDB splits data into **tablets** and runs an independent **Raft group per tablet**. To reduce the heartbeat overhead of thousands of groups, it uses a **MultiRaft layer that multiplexes heartbeats** across groups sharing the same set of nodes - similar in spirit to CockroachDB's coalescing but at the library level. YSQL sits above DocDB and translates queries into operations that may fan out across multiple tablet Raft groups.

```mermaid
flowchart TD
    C["Client (SQL query)"] --> YSQL["YSQL Layer\n(PostgreSQL-compatible)"]
    YSQL --> T1["Tablet 1\n(Raft group)"]
    YSQL --> T2["Tablet 2\n(Raft group)"]
    YSQL --> T3["Tablet 3\n(Raft group)"]
    subgraph DocDB["DocDB (storage layer)"]
        T1
        T2
        T3
    end
```

([YugabyteDB Blog: How Raft-based replication works in YugabyteDB](https://www.yugabyte.com/blog/how-does-the-raft-consensus-based-replication-protocol-work-in-yugabyte-db/))

#### Redpanda

Redpanda is a Kafka-compatible streaming platform where each *partition* is its own Raft group. This gives stronger consistency guarantees than Kafka's ISR replication, which can acknowledge a write before all in-sync replicas have persisted it.

Rather than managing thousands of Raft groups with a shared thread pool, Redpanda uses a **thread-per-core** architecture via the *Seastar framework* - each CPU core owns a fixed set of partitions and their Raft groups exclusively, eliminating lock contention and context switching entirely.

```mermaid
flowchart TB
    subgraph Core0["CPU Core 0"]
        P1["Partition 1 (Raft)"]
        P2["Partition 2 (Raft)"]
    end
    subgraph Core1["CPU Core 1"]
        P3["Partition 3 (Raft)"]
        P4["Partition 4 (Raft)"]
    end
    subgraph Core2["CPU Core 2"]
        P5["Partition 5 (Raft)"]
        P6["Partition 6 (Raft)"]
    end
```

([Redpanda Blog: Simplifying Raft replication in Redpanda](https://www.redpanda.com/blog/simplifying-raft-replication-in-redpanda))

| System | Range name | Default size | Language | Scaling strategy |
|---|---|---|---|---|
| CockroachDB | Range | 512 MB | Go | Heartbeat coalescing + leaseholder reads |
| TiKV | Region | 96 MB | Rust | Shared event loop, batch I/O |
| YugabyteDB | Tablet | configurable | C++ | MultiRaft library, two-layer SQL/storage |
| Redpanda | Partition | N/A (streaming) | C++ | Thread-per-core via Seastar |

Each system makes different tradeoffs in range size, leader placement, and, most critically, how they handle writes that touch more than one range.

### Day 2 challenges

Running Multi-Raft in production surfaces problems that don't show up in a 3-node test cluster.

**Election storm.** When a node holding thousands of Raft leaders crashes, that many elections fire simultaneously. Followers across the cluster all hit their election timeout at roughly the same time and flood the network with `RequestVote` RPCs. Real implementations mitigate this with randomized election timeouts - each group waits a slightly different amount of time before starting an election - and priority-based leadership, where the cluster steers elections toward nodes that were already leaders to restore the previous distribution faster.

**Log truncation.** The Raft log cannot grow forever - it must be periodically compacted. But truncating too aggressively means a lagging follower may no longer be able to catch up incrementally; it needs a full snapshot of the state machine instead, which is far more expensive. The tradeoff is between disk usage and the cost of snapshot transfer, and getting it wrong in either direction causes operational pain under load.

**Range splitting.** When a range grows too large or becomes a hotspot, it must be split into two - which means creating a new Raft group on the fly, electing a leader for it, and redistributing replicas, all without interrupting writes to the affected keyspace.

### The hard part: cross-range transactions

Multi-Raft gives you independent consensus groups per range. A write to range 1 and a write to range 2 can proceed in parallel with no coordination between them. But what happens when a single transaction needs to atomically update keys in both?

Take a bank transfer: debit account A in range 1, credit account B in range 2. Both changes must either commit or roll back together. There is no Raft group that spans both ranges. Each one only knows about its own log.

DynamoDB faces the same problem. Its `TransactWriteItems` API provides ACID transactions across multiple items in different partitions, but [the 2PC mechanism requires two operations per item](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/transaction-apis.html#transaction-capacity-handling) (one prepare, one commit), so each transactional write consumes twice the capacity units of a standard write. That is the cost of coordination, not a surcharge.

**Two-phase commit (2PC)**:

1. **Prepare**: A transaction coordinator sends a "prepare" to all involved range leaders. Each range tentatively locks the rows and votes yes or no.
2. **Commit**: If all ranges voted yes, the coordinator sends "commit." If any voted no, it sends "abort."

The hard part is not the happy path. It is what happens when the coordinator crashes between prepare and commit. The involved ranges are left holding locks with no further instruction. They cannot commit (the coordinator never confirmed) and they cannot safely abort (the coordinator might have committed before dying).

**CockroachDB** solves this by making the transaction record itself a replicated key. Before writing to any range, the coordinator writes a **transaction record** to one of the involved ranges. Provisional writes ("write intents") are stored in place alongside normal data. Any reader that encounters an intent looks up the transaction record to determine whether it committed. If the coordinator dies, the transaction record is the source of truth: no ambiguity, no stuck locks.

**TiKV** uses a model inspired by Google's **Percolator**. One key in the transaction is designated the **primary lock**. The transaction commits atomically by writing to the primary key's Raft group. All secondary writes point back to the primary. Any node encountering a secondary lock can follow the pointer to the primary and determine the outcome from there.

In both cases, a cross-range transaction requires at least two quorum writes (one per range) plus the coordination overhead of the transaction record or primary lock. This is the unavoidable cost of Multi-Raft: you get parallel write throughput across ranges, but atomicity across them always requires coordination.

### Wrapping up

Multi-Raft is not a single design, it is a family of tradeoffs. Every system here splits data into independent consensus groups, but they diverge immediately on what to optimize: CockroachDB minimizes network overhead with heartbeat coalescing and cuts read latency with leases; TiKV batches I/O through a shared event loop to reduce context switching; YugabyteDB keeps the SQL and storage layers cleanly separated; Redpanda eliminates scheduler overhead entirely by pinning partitions to cores.

The common thread is **minimizing the coordination tax**, the overhead that consensus imposes on every operation. At scale, that tax compounds fast, and each of these systems found a different way to contain it.

## Further reading

**Raft**
- [In Search of an Understandable Consensus Algorithm](https://raft.github.io/raft.pdf) - Diego Ongaro & John Ousterhout (the original paper)
- [The Raft Consensus Algorithm](https://raft.github.io) - interactive visualizations

**CockroachDB**
- [Scaling Raft](https://www.cockroachlabs.com/blog/scaling-raft/) - Ben Darnell, Cockroach Labs
- [Parallel Commits: An atomic commit protocol for globally distributed transactions](https://www.cockroachlabs.com/blog/parallel-commits/) - Nathan VanBenschoten, Cockroach Labs
- [Transaction Layer](https://www.cockroachlabs.com/docs/stable/architecture/transaction-layer) - CockroachDB docs (write intents, transaction records)

**TiKV**
- [Building a Large-scale Distributed Storage System Based on Raft](https://tikv.org/blog/building-distributed-storage-system-on-raft/) - Edward Huang, TiKV
- [Multi-Raft](https://tikv.org/deep-dive/scalability/multi-raft/) - TiKV deep dive

**YugabyteDB**
- [How Does the Raft Consensus-Based Replication Protocol Work in YugabyteDB?](https://www.yugabyte.com/blog/how-does-the-raft-consensus-based-replication-protocol-work-in-yugabyte-db/) - Yugabyte

**Redpanda**
- [Simplifying Redpanda Raft implementation](https://www.redpanda.com/blog/simplifying-raft-replication-in-redpanda) - Redpanda

**Cross-range transactions**
- [Large-scale Incremental Processing Using Distributed Transactions and Notifications](https://research.google/pubs/large-scale-incremental-processing-using-distributed-transactions-and-notifications/) - Daniel Peng & Frank Dabek, Google (the Percolator paper)
