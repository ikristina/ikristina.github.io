---
layout: ../../layouts/BlogPost.astro
title: 'Pagination: cursor or offset?'
date: '2026-04-19 14:20 MDT'
description: 'When to use cursor-based vs offset-based pagination.'
tags: ['pagination', 'cursor', 'offset', 'database', 'sql', 'shorts', 'postgres', 'performance']
showToc: true
---

We often have many more results returned than we want to display at once. To solve this, we normally use pagination. There are two main types of pagination we can use: offset-based and cursor-based.

## Offset-based pagination

For offset pagination, we need to decide how many items we want to display per page. Let's say we want to display 10 items per page. We can then use the offset and limit parameters to get the desired page of results.

```sql
SELECT * FROM items ORDER BY id LIMIT 10 OFFSET 0;
SELECT * FROM items ORDER BY id LIMIT 10 OFFSET 10;
```

Here, we selected 2 pages. The first page has items 1-10, and the second page has items 11-20. 

It makes it easy to jump to a specific page. For example, if we want to go to page 100, we can just set the offset to 990.

The downside of this approach is that Postgres (or another engine) needs to scan all the items up to the offset to return the results. We might not see a big difference in performance when we have only a few small pages to scan. However, when we set an offset of 10000, it means that the engine would still need to scan all of the 10k items to then discard them and return the next page of 10. The larger the dataset, the more inefficient the query becomes.
Another downside is that if we update/delete rows while paginating, the items would shift and we'll get an incorrect result. For example, if we delete the first item, the second page will now start with the third item instead of the second.

To solve these problems, there's a cursor-based approach to pagination.

## Cursor-based pagination

Instead of using an offset, we use a cursor to keep track of our position in the dataset. The cursor is the value of the last item on the previous page. 

```sql
SELECT * FROM items WHERE id > 10 ORDER BY id LIMIT 10;
```

This query will return the next 10 items after the item with id 10. Here, we need to keep track of the last item's id to get the next page. We return the cursor to the client so it knows where it has to start. It solves the performance issue of offset pagination because we don't need to scan all the items up to the offset. We just need to scan the items after the cursor. 

One downside of this approach is that we can't easily jump to a specific page. For example, if we want to go to page 100, we can't just set the cursor to 990. We would need to fetch all the previous pages to get to the 100th page. 

Something else to note is that we need to make sure to select the correct fields to make a cursor for. For example, if we say that we want to order by createdAt, and then we have two items with the same createdAt, we might want to add another field to order by to resolve which one goes first to not return the same result on both adjacent pages.

This in theory should prevent the issue of items shifting due to updates/deletes because, as mentioned above, we do not care about the values we have already seen. We set a cursor at a specific value from which we start the next page.

If you need to go backwards, the implementation can get complex.

## When to use which

If you need to jump to a specific page, offset pagination is the way to go. If you need to fetch a large dataset, cursor pagination is the way to go.

<div class="quiz-widget">
  <div class="quiz-header">
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    Knowledge Check <span class="quiz-progress"></span>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">What is the main performance drawback of offset-based pagination on large datasets?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>It forces the database to lock the table during the query.</div></div>
      <div class="quiz-option" data-letter="B"><div>The database engine must scan through and discard all items up to the offset, which becomes very slow for deep pages.</div></div>
      <div class="quiz-option" data-letter="C"><div>It requires too much memory on the application server.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> If you ask for `OFFSET 10000`, the database still has to read 10,000 rows just to throw them away and give you the next 10. As you page deeper, queries get slower.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. Offset forces the database engine to scan rows linearly and discard them until it reaches the offset number, which is very inefficient for large offsets.</div>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">How does cursor-based pagination solve the "shifting items" problem (where inserting/deleting an item causes the next page to skip or duplicate an item)?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>By using a database transaction to temporarily lock the rows being viewed.</div></div>
      <div class="quiz-option" data-letter="B"><div>It doesn't rely on relative row numbers. Instead, it asks for items strictly <em>after</em> a specific unique value (the cursor), so changes before the cursor don't affect the result.</div></div>
      <div class="quiz-option" data-letter="C"><div>By caching the entire table in memory before pagination begins.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> Because you are saying "give me 10 items starting after ID 54", it doesn't matter if items 1 through 53 were completely deleted while you were looking at the page!</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. Cursors are absolute markers in the dataset (like an ID or timestamp), whereas offsets are relative. Absolute markers aren't impacted by rows being added or deleted behind them.</div>
  </div>

  <div class="quiz-question-block" data-correct="B">
    <div class="quiz-question">When is offset pagination still the correct choice over cursor pagination?</div>
    <div class="quiz-options">
      <div class="quiz-option" data-letter="A"><div>When you have an infinitely scrolling feed like social media.</div></div>
      <div class="quiz-option" data-letter="B"><div>When you need the ability to let users jump directly to a specific page number (e.g., "Go to page 10").</div></div>
      <div class="quiz-option" data-letter="C"><div>When the dataset updates very frequently.</div></div>
    </div>
    <div class="quiz-success-msg"><strong>Correct! 🎉</strong> You can't jump to "page 10" with a cursor because you don't know what the cursor value for page 10 is until you fetch pages 1 through 9. Offset pagination handles this easily.</div>
    <div class="quiz-error-msg"><strong>Not quite.</strong> The correct answer is <strong>B</strong>. Offset pagination allows arbitrary jumping (e.g. `OFFSET 100`) which is required for traditional numbered page navigation. Cursor pagination only allows "next" and "previous".</div>
  </div>

  <div class="quiz-footer">
    <button class="quiz-next-btn">Next Question →</button>
  </div>
  
  <div class="quiz-results">
    <h4>Quiz Complete!</h4>
    <p>You scored <strong class="quiz-score">0</strong> out of <strong>3</strong>.</p>
  </div>
</div>
