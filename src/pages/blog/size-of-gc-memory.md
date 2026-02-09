---
layout: ../../layouts/BlogPost.astro
title: How Go Decides When to Garbage Collect
date: 2026-02-10 07:00
description: Learn the formula Go uses to trigger garbage collection and how to tune the GOGC variable to balance memory vs. CPU.
tags: ['garbageCollector', 'memory', 'performance']
showToc: false
---
## The Formula

Here's the formula that the GC uses to figure out what size heap you need:

$$
\text{next\_gc} = \text{live\_heap} \times (1 + \frac{\text{GOGC}}{100})
$$


For example, if the actual memory in use after the garbage collector has done its job is 82MB, that means:
- **Live heap**: 82 MB (actual memory in use after GC).

- **GOGC**: 100 (default value, meaning 100%).

- **Calculation**: $82 \text{ MB} \times (1 + \frac{100}{100}) = 82 \text{ MB} \times 2 = \textbf{164 MB}$


The slight difference might occur due to rounding and internal GC accounting.

This means that the GC **won't run again until the heap grows to ~164 MB**. This is Go's way of balancing:
- **Memory usage**: Don't let the heap grow unbounded.

- **CPU efficiency**: Don't run GC too frequently (wastes CPU).


## Tuning GOGC

You can adjust this behaviour with the `GOGC` environment variable:

- `GOGC=100` (default): Next GC at 2× live heap.

- `GOGC=200`: Next GC at 3× live heap (less frequent GC, more memory).

- `GOGC=50`: Next GC at 1.5× live heap (more frequent GC, less memory).

- `GOGC=off`: Disable automatic GC entirely (not recommended for production).
