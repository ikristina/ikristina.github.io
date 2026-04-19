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
