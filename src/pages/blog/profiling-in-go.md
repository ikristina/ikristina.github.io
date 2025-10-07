---
layout: ../../layouts/BlogPost.astro
title: 'A Guide to Using Built-in Profiling Tools in Go'
date: '2025-10-07 11:00 MDT'
description: 'Profiling helps you identify where your program spends time and memory. Go provides built-in tools to collect and analyze this data. This guide covers profiling, benchmarks, and tracing, including examples and instructions for interpreting results.'
tags: ['go', 'cli', 'pprof', 'benchmarks']
showToc: true
---

Profiling helps you identify where your program spends time and memory. Go provides built-in tools to collect and analyze this data. This guide covers profiling, benchmarks, and tracing, including examples and instructions for interpreting results.

## Profiling Overview

Profiling is a way to measure program performance automatically. It identifies code sections responsible for high CPU usage, memory allocations, or blocking operations.

Go provides four main diagnostic approaches:

1. **Profiling** – Measures CPU, memory, and blocking costs
    
2. **Tracing** – Tracks latency and concurrency across requests
    
3. ***Debugging*** *– Pauses execution to inspect state and flow // not important here*
    
4. ***Runtime statistics*** *– Provides a high-level overview of app health // not important here*
    

I’d like to focus more on profiling and especially, pprof tool.

## Collecting Profile Data

### Profiling Tests

Use `go test` with profiling flags:

* **CPU profile.** Records which functions are active during CPU cycles.
    
    ```bash
    $ go test -cpuprofile=cpu.out
    ```
    

* **Memory (Heap) profile.** This tracks the stack trace every time a **heap** allocation is made.
    
    ```bash
    $ go test -memprofile=mem.out
    ```
    

* **Blocking profile**. To track goroutines blocked by locks, channels, or system calls.
    
    ```bash
    $ go test -blockprofile=block.out
    ```
    

**Important.** Avoid enabling more than one type of profile simultaneously, as the profiling mechanism itself can distort the result.

### Benchmarking

Benchmarks are only reliable if written properly. Example:

```go
func BenchmarkProcessData(b *testing.B) {
    data := loadTestData()
    b.ResetTimer()
    for i := range b.N {
        processData(data)
    }
}
```

* Always set up test data outside the timed loop
    
* Reset the timer after setup to avoid measuring preparation time
    
* Use `-benchmem` to collect memory allocation metrics:
    

```bash
$ go test -bench=. -benchmem
```

Output includes:

* **ns/op** – Time per operation
    
* **B/op** – Bytes allocated per operation
    
* **allocs/op** – Number of heap allocations
    

Compare before and after optimizations to verify improvements.

### Profiling Live Applications (using pprof)

For web servers or long-running programs, you need to import `"net/http/pprof"`. This enables profiling at runtime which is especially useful for web applications. It installs diagnostic handlers under the `/debug/pprof` endpoint.

```go
import _ "net/http/pprof"
import "net/http"

func main() {
    go http.ListenAndServe(":6060", nil)
    runApplication()
}
```

Access profiles in a browser or with `go tool pprof`:

* Heap: [`http://localhost:6060/debug/pprof/heap`](http://localhost:6060/debug/pprof/heap)
    
* CPU: [`http://localhost:6060/debug/pprof/profile?seconds=30`](http://localhost:6060/debug/pprof/profile?seconds=30)
    
* Goroutine: [`http://localhost:6060/debug/pprof/goroutine`](http://localhost:6060/debug/pprof/goroutine).
    

You can also write your own custom profilers [https://go.dev/wiki/CustomPprofProfiles](https://go.dev/wiki/CustomPprofProfiles)

## Analyzing Profiles with `pprof`

To collect the profiling log.

```bash
$ go tool pprof cpu.out
```

You can also use the following flags:

* `topN` - show top N samples by function
    
* `-cum` flag - sort by cumulative time
    
* `list` FunctionName - shows source code with samples per line.
    
* `disasm` - shows disassembly.
    
* `web/gv` - writes profile graph for browser/Ghostview.
    

Example `top2` output:

```go
(pprof) top
Showing nodes accounting for 90% of 2s total
      flat  flat%   sum%        cum   cum%
     0.8s  40%   40%      1.2s   60%  main.processData
     0.4s  20%   60%      0.4s   20%  main.calculate
```

**How to read:**

* **flat**: Time spent in the function itself
    
* **cum**: Cumulative time spent in the function and all functions it calls
    

Focus on functions with high **cumulative time** to target optimizations.

### Interpreting Heap Profiles

A heap profile shows which parts of the program allocate the most memory. Memory profiling records the stack trace whenever a heap allocation happens. The profiling library samples calls to the internal memory allocation routines, usually recording about one event per 512KB of allocated memory (this can be adjusted).

It **doesn't** track **stack** allocations because they are considered free. The Go compiler uses an algorithm called "escape analysis" to decide if a value should be created on the stack or the heap. **Only constructions on the heap are classified as allocations.** This is important because the main goal of optimizing memory usage is to reduce the load on the **garbage collector (GC)**. Reducing allocations shortens the duration of collections and prevents the GC from causing high latency in the running application.

Once a profile log is created (e.g. `mem.out`), use the go tool pprof to read it.

* If you run `go tool pprof` with the `--inuse_objects` flag, the tool will report **allocation counts instead of sizes.**
    

```bash
$ go tool pprof mem.out
(pprof) top
```

Example output:

```bash
Showing nodes accounting for 90% of 5MB total
      flat  flat%   sum%        cum   cum%
     2MB   40%   40%       2MB   40%  main.loadData
     1MB   20%   60%       1MB   20%  main.buildObjects
```

**How to read:**

* Focus on functions with high memory allocations
    
* Frequent allocations in these functions can increase GC pressure
    
* Consider reusing objects, pooling, or reducing allocations
    

Visualization:

```bash
(pprof) web
```

Shows a call graph with memory usage per function. Example (top of it) is from [**here**](https://go.dev/blog/pprof).

![](https://cdn.hashnode.com/res/hashnode/image/upload/v1759187144260/33024988-0d23-465d-9c99-4368156cfaf5.png align="center")

* Using `—inuse_objects` flag output example ([from here](https://go.dev/blog/pprof)):
    
* ```bash
    $ go tool pprof --inuse_objects havlak3 havlak3.mprof
    Adjusting heap profiles for 1-in-524288 sampling rate
    Welcome to pprof!  For help, type 'help'.
    (pprof) list FindLoops
    Total: 1763108 objects
    ROUTINE ====================== main.FindLoops in /home/rsc/g/benchgraffiti/havlak/havlak3.go
    720903 720903 Total objects (flat / cumulative)
    ...
         .      .  277:     for i := 0; i < size; i++ {
    311296 311296  278:             nodes[i] = new(UnionFindNode)
         .      .  279:     }
         .      .  280:
         .      .  281:     // Step a:
         .      .  282:     //   - initialize all nodes as unvisited.
         .      .  283:     //   - depth-first traversal and numbering.
         .      .  284:     //   - unreached BB's are marked as dead.
         .      .  285:     //
         .      .  286:     for i, bb := range cfgraph.Blocks {
         .      .  287:             number[bb.Name] = unvisited
    409600 409600  288:             nonBackPreds[i] = make(map[int]bool)
         .      .  289:     }
    ...
    (pprof)
    ```
    

## Tracing for Latency and Concurrency

Tracing captures latency across functions and goroutines:

```bash
$ go test -trace trace.out
$ go tool trace trace.out
```

Traces help identify:

* Functions causing delays
    
* Goroutines waiting on locks or channels
    
* Latency bottlenecks across processes
    

# Takeaways

1. **Profile Before Optimizing:** The most critical step is to identify bottlenecks using tools like `go tool pprof`. This helps to focus on the right areas.
    
2. **Prioritize Simple Data Structures:** The CPU profile often reveals performance degradation due to inefficient use of complex data types, such as Go's `map`. The takeaway is that **"There’s no reason to use a map when an array or slice will do"** for indexed access or simple sets. Switching from maps to slices significantly improves runtime (e.g., cutting time [by nearly a factor of two](https://go.dev/blog/pprof)).
    
3. **Minimize Allocation to Reduce GC Pressure:** If the CPU profile shows high time spent in `runtime.mallocgc`, the program is memory-bound. The memory profile helps pinpoint code sections responsible for allocating the most memory. The general principle is that the **fastest program is often the one that makes the fewest memory allocations**. Reducing allocations minimizes garbage collector (GC) work.
    
4. **Implement Memory Reuse for Inner Loops:** Even necessary bookkeeping structures can generate significant allocations if created repeatedly in inner loops. Consider object pooling or reusing buffers to minimize GC pressure.

Profiling is essential for writing efficient Go programs. Use these tools regularly to identify bottlenecks and verify that optimizations actually improve performance.nificant garbage if repeatedly allocated across calls. Introducing simple **caching or memory reuse** strategies (e.g., re-using storage across iterations) is essential for performance, especially when a function is called many times.
    
5. **Achieving Competitive Performance:** The overall conclusion of the optimization study is that when Go programmers use profiling tools to meticulously manage the garbage generated by inner loops, the resulting **Go program can be competitive with equivalent C++ code**.
    

### Main Sources with more info:

* [https://go.dev/doc/diagnostics#profiling](https://go.dev/doc/diagnostics#profiling)
    
* [https://go.dev/blog/pprof](https://go.dev/blog/pprof)
