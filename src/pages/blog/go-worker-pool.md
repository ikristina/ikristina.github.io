---
layout: ../../layouts/BlogPost.astro
title: Building a Worker Pool in Go
date: '2026-03-29 17:00 MDT'
description: 'When you have a list of tasks to run concurrently, the naive approach is to spin up one goroutine per task. That works until it doesn''t. A worker pool gives you bounded concurrency, backpressure, and clean shutdown without much added complexity.'
tags: ['concurrency', 'go', 'channels']
image: '/images/gophers-worker-pool.png'
showToc: true
---

The naive way to run N tasks concurrently in Go is to launch N goroutines:

```go
for _, url := range urls {
    go fetch(url)
}
```

That works fine for 10 URLs. It starts to hurt at 10,000. Every goroutine consumes memory (starting around 8KB for the stack, growing as needed), and if each goroutine is making a network request, you can saturate your <span class="def" data-def="A small integer the OS assigns to each open resource (file, socket, pipe). Each process has a cap (typically 1024 by default on Linux/macOS) on how many it can hold open at once.">file descriptor limit</span> or overwhelm the downstream service before the first result comes back.

A worker pool fixes this. Instead of one goroutine per task, you create a fixed pool of workers and feed them work through a channel. The channel acts as a queue, and <span class="def" data-def="When a producer generates work faster than consumers can process it, backpressure is the mechanism that slows the producer down rather than letting the queue grow unboundedly. In Go channels, it's built in: if you send on a full buffered channel (or any unbuffered channel with no receiver ready), the send blocks. The producer can't continue until a worker picks up the job. That blocking is the backpressure. The alternative (no backpressure) would be an ever-growing queue that eventually exhausts memory, or spawning unlimited goroutines, which is exactly the problem the worker pool solves.">backpressure</span> comes for free: if all workers are busy, the producer blocks until one is available.

## The Shape of the Problem

The pattern fits any workload where:
- You have more tasks than you want to run simultaneously
- Each task is independent (no shared mutable state between tasks)
- You want all results before moving on

In this project, the tasks are HTTP fetches. Each job carries an ID and a URL. Each result carries the ID and either an HTTP status or an error.

```go
type Job struct {
    ID  int
    URL string
}

type Result struct {
    ID    int
    Value string
    Err   error
}
```

The `ID` field threads through so results can be matched to their jobs even when they complete out of order.

## The Pipeline

The full implementation has three stages connected by channels:

```
producer → jobs channel → workers → results channel → collector
```

All stages run concurrently. The channels between them regulate flow.

### The Channels

```go
jobs    := make(chan task.Job, NUM_JOBS)
results := make(chan task.Result, NUM_JOBS)
```

Both channels are buffered. The buffer size here equals the total number of jobs, which means the producer can enqueue everything without blocking. For a large or infinite job stream you would use a smaller buffer, and the producer would block naturally when the pool is saturated.

### The Workers

```go
func worker(ctx context.Context, id int, jobs <-chan task.Job, results chan<- task.Result, wg *sync.WaitGroup) {
    defer wg.Done()
    for job := range jobs {
        results <- task.Run(ctx, &job)
    }
}
```

Each worker ranges over the jobs channel. When the channel is closed and drained, the range loop exits and the worker calls `wg.Done()`. No explicit stop signal needed. Channel close is the shutdown mechanism.

Starting the pool looks like this:

```go
var wg sync.WaitGroup
for i := range NUM_WORKERS {
    wg.Add(1)
    go worker(ctx, i, jobs, results, &wg)
}
```

### The Producer

```go
go func() {
    for i, url := range urls {
        jobs <- task.Job{ID: i, URL: url}
    }
    close(jobs)
}()
```

The producer runs in its own goroutine so it doesn't block the workers from starting. It closes the jobs channel when all jobs are enqueued, which signals the workers to stop once they drain the remaining work.

### The Collector

Results need to be consumed as workers produce them. If the results channel fills up and workers can't send, they block, which stalls the entire pool. A separate goroutine handles collection:

```go
done := make(chan struct{})
go func() {
    for result := range results {
        if result.Err != nil {
            fmt.Printf("job %d failed: %v\n", result.ID, result.Err)
        } else {
            fmt.Printf("job %d done: %s\n", result.ID, result.Value)
        }
    }
    close(done)
}()
```

The `done` channel is a zero-allocation signal. When the results channel closes, the range exits and `done` gets closed.

### Shutdown

The shutdown sequence in `main` coordinates all of this:

```go
wg.Wait()          // Wait for all workers to finish
close(results)     // Signal collector there are no more results
<-done             // Wait for collector to drain and exit
```

Order matters here. Closing `results` before `wg.Wait()` would be a bug: a worker that's still running could try to send on a closed channel and panic. Waiting for `wg.Wait()` first guarantees no worker will ever write to `results` again before it's closed.

## Context and Cancellation

Each task receives the context passed to `Run`:

```go
func Run(ctx context.Context, job *Job) Result {
    req, err := http.NewRequestWithContext(ctx, http.MethodGet, job.URL, nil)
    if err != nil {
        return Result{ID: job.ID, Err: fmt.Errorf("request error: %w", err)}
    }

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return Result{ID: job.ID, Err: fmt.Errorf("fetch failed: %w", err)}
    }
    defer resp.Body.Close()

    return Result{ID: job.ID, Value: resp.Status}
}
```

Using `http.NewRequestWithContext` means that if the context is cancelled (say, via a timeout or an explicit cancel call), in-flight requests abort cleanly. Workers surface the cancellation error as a `Result` rather than silently dropping it.

## Why This Structure Works

**Backpressure is automatic.** If workers are slow, the jobs channel fills up, and the producer blocks. You never accumulate more in-flight work than the channel can hold.

**Shutdown is deterministic.** Channel close propagates through the pipeline in order. Closing `jobs` stops workers. Workers finishing lets you close `results`. Closing `results` stops the collector. There are no goroutine leaks.

**The stages are decoupled.** The producer doesn't know how many workers there are. Workers don't know about the collector. You can change `NUM_WORKERS` without touching anything else.

**Testing is straightforward.** `task.Run` takes a context and a job pointer and returns a result. There's nothing to mock. You can test it directly:

```go
func TestRun(t *testing.T) {
    tests := []struct {
        name    string
        job     task.Job
        wantErr bool
    }{
        {"valid URL", task.Job{ID: 1, URL: "https://google.com"}, false},
        {"invalid URL", task.Job{ID: 2, URL: "not-a-url"}, true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
            defer cancel()

            result := task.Run(ctx, &tt.job)
            if tt.wantErr {
                assert.Error(t, result.Err)
            } else {
                assert.NoError(t, result.Err)
                assert.Equal(t, "200 OK", result.Value)
            }
        })
    }
}
```

## When to Use This Pattern

A worker pool adds real complexity: channels, goroutines, WaitGroups, and a specific shutdown sequence. It pays off when:

- You have many tasks and can't run them all at once (resource limits, rate limits, downstream capacity)
- Tasks are IO-bound, so goroutines spend most of their time waiting rather than computing
- You need all results before proceeding

It's overkill when:
- You have a small, bounded number of tasks (just spawn the goroutines directly)
- Tasks are CPU-bound and you're already at `GOMAXPROCS` concurrency
- You don't need results at all (fire-and-forget has simpler patterns)

The full source for this project is at [github.com/ikristina/go-worker-pool](https://github.com/ikristina/go-worker-pool).

## What's Next

This is the foundation. The next iteration will add Prometheus metrics (queue depth, job latency histogram, worker utilization), a proper `Pool` struct with explicit `Shutdown` and `ShutdownNow` modes, and retry with exponential backoff and <span class="def" data-def="Randomness added to retry wait times to prevent a thundering herd. Without jitter, all failing goroutines retry after the same delay and hit the server in another synchronized wave. With jitter, each retry waits a slightly different random duration, spreading load out over time.">jitter</span>. I also want to run a proper benchmark suite across different worker counts and use `go tool trace` to visualize the goroutine scheduling.
