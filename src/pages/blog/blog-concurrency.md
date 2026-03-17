---
layout: ../../layouts/BlogPost.astro
title: When Goroutines Aren't Worth It
date: '2026-03-17 10:00 MDT'
description: It's tempting to reach for goroutines whenever you see two independent operations. Two API calls? Two database queries? Spin up a goroutine, run them in parallel, cut your latency in half. Right? 
  Sometimes. But often the added complexity buys you nothing measurable.
tags: ['concurrency', 'go']
showToc: true
---

## The Setup

Imagine a service that searches for user records across two stores: a primary database and a cache. A composite repository orchestrates both:

```go
type userStore interface {
    FindUsers(ctx context.Context, email, orgID string) ([]User, error)
}

type compositeStore struct {
    db    userStore
    cache userStore
}
```

When a caller wants results from both stores, the sequential version looks like this:

```go
func (c *compositeStore) FindUsers(ctx context.Context, email, orgID string, includeCache bool) ([]User, error) {
    dbUsers, err := c.db.FindUsers(ctx, email, orgID)
    if err != nil {
        return nil, err
    }

    if !includeCache {
        return dbUsers, nil
    }

    cachedUsers, _ := c.cache.FindUsers(ctx, email, orgID)

    return mergeUnique(dbUsers, cachedUsers), nil
}
```

The parallel version fires off the cache lookup in a goroutine:

```go
func (c *compositeStore) FindUsersParallel(ctx context.Context, email, orgID string, includeCache bool) ([]User, error) {
    var cachedUsers []User
    var wg sync.WaitGroup

    if includeCache {
        wg.Add(1)
        go func() {
            defer wg.Done()
            cachedUsers, _ = c.cache.FindUsers(ctx, email, orgID)
        }()
    }

    // Ensure we wait for the goroutine before returning to avoid leaks
    defer wg.Wait()

    dbUsers, err := c.db.FindUsers(ctx, email, orgID)
    if err != nil {
        return nil, err
    }

    return mergeUnique(dbUsers, cachedUsers), nil
}
```

Notice the goroutine launches *before* the DB call — otherwise there's no parallelism.

## The Benchmark

To measure the difference, we wrap both stores with artificial delays:

```go
type slowStore struct {
    users []User
    delay time.Duration
}

func (s slowStore) FindUsers(ctx context.Context, email, orgID string) ([]User, error) {
    time.Sleep(s.delay)
    return s.users, nil
}
```

### High latency (50ms per store)

This simulates two slow external services:

```go
func BenchmarkSequential_HighLatency(b *testing.B) {
    c := compositeStore{
        db:    slowStore{users: []User{{ID: "1"}}, delay: 50 * time.Millisecond},
        cache: slowStore{users: []User{{ID: "2"}}, delay: 50 * time.Millisecond},
    }
    for i := 0; i < b.N; i++ {
        c.FindUsers(context.Background(), "user@test.com", "org1", true)
    }
}

func BenchmarkParallel_HighLatency(b *testing.B) {
    c := compositeStore{
        db:    slowStore{users: []User{{ID: "1"}}, delay: 50 * time.Millisecond},
        cache: slowStore{users: []User{{ID: "2"}}, delay: 50 * time.Millisecond},
    }
    for i := 0; i < b.N; i++ {
        c.FindUsersParallel(context.Background(), "user@test.com", "org1", true)
    }
}
```

Results:

```
BenchmarkSequential_HighLatency-12    57     101,690,572 ns/op    1537 B/op    5 allocs/op
BenchmarkParallel_HighLatency-12     100      50,813,774 ns/op    1805 B/op    9 allocs/op
```

The parallel version is 2x faster. With 50ms per store, cutting from 100ms to 50ms is significant.

### Low latency (sub-millisecond)

This simulates a fast in-memory cache alongside a local database — closer to real-world conditions for most services:

```go
func BenchmarkSequential_LowLatency(b *testing.B) {
    c := compositeStore{
        db:    slowStore{users: []User{{ID: "1"}}, delay: 500 * time.Microsecond},
        cache: slowStore{users: []User{{ID: "2"}}, delay: 100 * time.Microsecond},
    }
    for i := 0; i < b.N; i++ {
        c.FindUsers(context.Background(), "user@test.com", "org1", true)
    }
}

func BenchmarkParallel_LowLatency(b *testing.B) {
    c := compositeStore{
        db:    slowStore{users: []User{{ID: "1"}}, delay: 500 * time.Microsecond},
        cache: slowStore{users: []User{{ID: "2"}}, delay: 100 * time.Microsecond},
    }
    for i := 0; i < b.N; i++ {
        c.FindUsersParallel(context.Background(), "user@test.com", "org1", true)
    }
}
```

Results:

```
BenchmarkSequential_LowLatency-12    8264       608,234 ns/op     1537 B/op    5 allocs/op
BenchmarkParallel_LowLatency-12      7640       512,109 ns/op     1805 B/op    9 allocs/op
```

The parallel version saves ~100 microseconds. That's 0.1ms. No user will ever notice.

## The Tradeoff

What you gain with goroutines:
- Reduced latency when both operations are genuinely slow

What you pay:
- 4 extra allocations per call (goroutine stack, WaitGroup)
- Shared mutable state (`cachedUsers` written in one goroutine, read in another, safe here because of `wg.Wait()`, but easy to get wrong)
- Harder to debug — stack traces split across goroutines
- Harder to reason about error handling
- **Context cancellation:** Managing context across goroutines adds complexity (e.g., if a DB query fails, you often need to explicitly cancel the in-flight cache request to prevent wasting resources)

## When To Use Goroutines

Use them when:
- Both operations have **high latency** (network calls to external services, cross-region queries)
- The latency savings are **meaningful relative to total request time**
- You're on a **hot path** that handles thousands of requests per second

Skip them when:
- One or both operations are **fast** (in-memory cache, local database, sub-ms responses)
- The savings are **microseconds** on a request that takes milliseconds
- The code is **rarely called** and doesn't justify the complexity
- You'd need **synchronization primitives** beyond a simple WaitGroup

## The Rule of Thumb

Benchmark first. If the sequential version is already fast enough, the goroutine version is just complexity for complexity's sake. The fastest code to debug is the code that runs on one goroutine.
