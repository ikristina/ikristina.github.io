---
layout: ../../layouts/BlogPost.astro
title: How Go Decides When to Garbage Collect
date: 2026-02-10 07:00
description: Learn the formula Go uses to trigger garbage collection and how to tune the GOGC variable to balance memory vs. CPU.
tags: ['garbage-collector', 'memory', 'performance']
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

<div class="quiz-widget">
  <div class="quiz-header">
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    Knowledge Check <span class="quiz-progress"></span>
  </div>

  <div class="quiz-question-block" data-correct="C">
    <div class="quiz-question">If your live heap is 100 MB after a GC cycle and <code>GOGC</code> is set to its default value of 100, at what heap size will the garbage collector run next?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>100 MB</div></div>
      <div class="quiz-option" data-letter="B"><div>150 MB</div></div>
      <div class="quiz-option" data-letter="C"><div>200 MB</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> `GOGC=100` means the heap is allowed to grow by 100% of the live heap size. So 100 MB + (100 MB * 1.0) = 200 MB!</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>C</strong>. The default `GOGC` of 100 sets the target heap size to 2x the live heap size.</div>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">What is the effect of lowering the <code>GOGC</code> environment variable to <code>50</code>?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>It physically restricts the application from using more than 50% of the server's RAM.</div></div>
      <div class="quiz-option" data-letter="B"><div>The GC will run more frequently (at 1.5x live heap), saving memory but spending more CPU time on garbage collection.</div></div>
      <div class="quiz-option" data-letter="C"><div>It limits the GC to only run a maximum of 50 times per second.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> Tuning `GOGC` is a direct CPU vs Memory tradeoff. Lowering it saves memory but forces the CPU to spend more time running GC cycles.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. Lowering `GOGC` reduces the heap growth multiplier, causing GC cycles to trigger earlier and more often.</div>
  </div>

  <div class="quiz-footer">
    <button class="quiz-next-btn">Next Question →</button>
  </div>
  
  <div class="quiz-results">
    <h4>Quiz Complete!</h4>
    <p>You scored <strong class="quiz-score">0</strong> out of <strong>2</strong>.</p>
  </div>
</div>
