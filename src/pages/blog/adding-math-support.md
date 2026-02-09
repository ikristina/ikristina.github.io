---
layout: ../../layouts/BlogPost.astro
title: Adding Math Support
date: 2026-02-09 12:00
description: I've added LaTeX support to the blog using KaTeX. Here's a quick guide on how to use it.
tags: ['meta', 'latex', 'katex']
showToc: false
---

I've added support for mathematical formulas using **LaTeX** syntax (powered by `remark-math` and `rehype-katex`).

This allows to write inline math like $E=mc^2$ or block math for more complex equations.

## How to use it

### Inline Math
Wrap your formula in single dollar signs `$`:

`The mass-energy equivalence is $E=mc^2$`

Result: The mass-energy equivalence is $E=mc^2$

### Block Math
Wrap your formula in double dollar signs `$$`:

```latex
$$
f(x) = \int_{-\infty}^\infty
    \hat f(\xi)\,e^{2 \pi i \xi x}
    \,d\xi
$$
```

Result:

$$
f(x) = \int_{-\infty}^\infty
    \hat f(\xi)\,e^{2 \pi i \xi x}
    \,d\xi
$$

This will be super useful for future posts about algorithms, complexity analysis (Big O notation), and performance metrics!

## Common Symbols Cheat Sheet

Here are some common symbols you might need:

| Category | Symbol Name | LaTeX Syntax | Rendered Example |
| :--- | :--- | :--- | :--- |
| **Complexity** | Big O / Omega / Theta | `O(n), \Omega(n), \Theta(n)` | $O(n), \Omega(n), \Theta(n)$ |
| **Greek (Stats)** | Alpha, Beta, Delta | `\alpha, \beta, \Delta` | $\alpha, \beta, \Delta$ |
| **Greek (Stats)** | Mu, Sigma, Theta | `\mu, \sigma, \theta` | $\mu, \sigma, \theta$ |
| **Arithmetic** | Fractions | `\frac{n}{2}` | $\frac{n}{2}$ |
| **Arithmetic** | Square Root | `\sqrt{n}` | $\sqrt{n}$ |
| **Algebra** | Exponents / Subs | `n^2, x_i` | $n^2, x_i$ |
| **Calculus** | Summation | `\sum_{i=0}^n i` | $\sum_{i=0}^n i$ |
| **Calculus** | Integration | `\int_{a}^{b} x dx` | $\int_{a}^{b} x dx$ |
| **Calculus** | Partial Derivative | `\frac{\partial y}{\partial x}` | $\frac{\partial y}{\partial x}$ |
| **Comparison** | Inequality / Approx | `\leq, \geq, \approx, \neq` | $\leq, \geq, \approx, \neq$ |
| **Logic** | AND, OR, NOT | `\wedge, \vee, \neg` | $\wedge, \vee, \neg$ |
| **Logic** | Quantifiers | `\forall, \exists` | $\forall, \exists$ |
| **Sets** | Membership / Subset | `\in, \subset, \emptyset` | $\in, \subset, \emptyset$ |
| **Sets** | Union / Intersect | `\cup, \cap` | $\cup, \cap$ |
| **Arrows** | Implies / Mapping | `\to, \Rightarrow, \iff` | $\to, \Rightarrow, \iff$ |
| **Matrices** | 2x2 Matrix | `\begin{bmatrix} a & b \\ c & d \end{bmatrix}` | $\begin{bmatrix} a & b \\ c & d \end{bmatrix}$ |
| **Misc** | Infinity / Dots | `\infty, \dots, \cdots` | $\infty, \dots, \cdots$ |
| **Text** | Roman Text | `\text{efficiency}` | $\text{efficiency}$ |

---

### Common Algorithm & ML Snippets

| Concept | LaTeX Snippet | Rendered |
| :--- | :--- | :--- |
| **Master Theorem** | `T(n) = aT\left(\frac{n}{b}\right) + f(n)` | $T(n) = aT\left(\frac{n}{b}\right) + f(n)$ |
| **Bayes' Theorem** | `P(A \mid B) = \frac{P(B \mid A)P(A)}{P(B)}` | $P(A \mid B) = \frac{P(B \mid A)P(A)}{P(B)}$ |
| **Sigmoid Function** | `S(x) = \frac{1}{1 + e^{-x}}` | $S(x) = \frac{1}{1 + e^{-x}}$ |
| **Euclidean Distance** | `d = \sqrt{\sum_{i=1}^n (q_i - p_i)^2}` | $d = \sqrt{\sum_{i=1}^n (q_i - p_i)^2}$ |
| **Gradient Descent** | `\theta_{j} := \theta_{j} - \alpha \frac{\partial}{\partial \theta_{j}} J(\theta)` | $\theta_{j} := \theta_{j} - \alpha \frac{\partial}{\partial \theta_{j}} J(\theta)$ |


For a full list, check out the [KaTeX Support Table](https://katex.org/docs/supported.html).
