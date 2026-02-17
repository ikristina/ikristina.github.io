---
layout: ../../layouts/BlogPost.astro
title: "Automating Social Media Posts with GitHub Actions"
date: 2026-02-17 14:30
description: "How to automate cross-posting blog updates to Bluesky and Mastodon using a custom GitHub Action workflow."
tags: ['automation', 'github-actions', 'bluesky', 'mastodon', 'ci-cd']
showToc: true
---

Manually posting links to social media is easy to forget. Automation solves that.

Here is a simple way to set up automatic cross-posting to **Bluesky** and **Mastodon** whenever a new blog post is successfully deployed.

## Requirements

The ideal setup is something simple that lives in the repo without integrating with third-party tools (like Zapier or IFTTT or whatever else is out there).

Key requirements:
1.  **Run only on success**: Don't post if the deployment fails.
2.  **Avoid reposting**: Only post *new* content.
3.  **Own the code**: Use a simple script that's easy to tweak.

## The Solution

My AI assistant and I created a custom script using Node.js and a GitHub Action to run it.

### 1. The Script (`scripts/syndicate.js`)

The script handles three main tasks:

1.  **Fetches the RSS feed**: It grabs the site's `rss.xml` to find the latest post.
2.  **Prevents Duplicates**: It checks the last 20 posts on your social media accounts to see if the link has already been shared.
3.  **Posts to APIs**: If it's new, it uses the official API libraries to post the update.

First, we need a few dependencies:

```bash
npm install rss-parser mastodon-api @atproto/api dotenv
```

Then, the script itself. It fetches the RSS feed, checks if the latest post is recent (within 24 hours), and cross-posts it.

```javascript
import Parser from 'rss-parser';
import Masto from 'mastodon-api';
import { BskyAgent, RichText } from '@atproto/api';
import 'dotenv/config';

const parser = new Parser();

// Config: How old can a post be to be considered "new"? 
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

async function main() {
    console.log('Fetching RSS feed...');
    const feed = await parser.parseURL('https://ikristina.github.io/rss.xml');
    
    if (!feed.items || feed.items.length === 0) return;

    const latestPost = feed.items[0];
    const pubDate = new Date(latestPost.pubDate);
    const diff = new Date() - pubDate;

    // Skip if too old (unless forced)
    if (diff > MAX_AGE_MS && process.env.FORCE_POST !== 'true') {
        console.log(`Post is too old. Skipping.`);
        return;
    }
    
    // Add hashtags from RSS categories
    const categories = latestPost.categories || [];
    const hashtags = categories.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');
    const message = `${latestPost.title}\n\n${latestPost.link}\n\n${hashtags}`;
    
    const force = process.env.FORCE_POST === 'true';

    // Post to Mastodon
    if (process.env.MASTODON_ACCESS_TOKEN) {
        const M = new Masto({
            access_token: process.env.MASTODON_ACCESS_TOKEN,
            timeout_ms: 60 * 1000,
            api_url: `${process.env.MASTODON_URL}/api/v1/`,
        });

        // Check if already posted
        const verify = await M.get('accounts/verify_credentials');
        const statuses = await M.get(`accounts/${verify.data.id}/statuses`, { limit: 20 });
        const alreadyPosted = statuses.data.some(s => s.content.includes(latestPost.link));

        if (alreadyPosted && !force) {
            console.log('Already posted to Mastodon. Skipping.');
        } else {
            await M.post('statuses', { status: message });
            console.log('Posted to Mastodon.');
        }
    }

    // Post to Bluesky
    if (process.env.BLUESKY_IDENTIFIER) {
        const agent = new BskyAgent({ service: 'https://bsky.social' });
        await agent.login({ 
            identifier: process.env.BLUESKY_IDENTIFIER, 
            password: process.env.BLUESKY_APP_PASSWORD 
        });
        
        // Check if already posted
        const feed = await agent.getAuthorFeed({ actor: process.env.BLUESKY_IDENTIFIER, limit: 20 });
        const alreadyPosted = feed.data.feed.some(post => {
            const text = post.post.record.text || '';
            return text.includes(latestPost.link);
        });

        if (alreadyPosted && !force) {
            console.log('Already posted to Bluesky. Skipping.');
        } else {
            const rt = new RichText({ text: message });
            await rt.detectFacets(agent);
            await agent.post({
                text: rt.text,
                facets: rt.facets,
                createdAt: new Date().toISOString(),
            });
            console.log('Posted to Bluesky.');
        }
    }
}

main().catch(console.error);
```

### 2. The Workflow (`.github/workflows/syndicate.yml`)

Everything happens in GitHub Actions. This workflow listens for the `deployment_status` event and only runs when the "github-pages" environment is successfully deployed. I also added a `workflow_dispatch` trigger so I can force a run manually if needed.

```yaml
name: Syndicate to Social Media

on:
  deployment_status:
  workflow_dispatch:
    inputs:
      force:
        description: "Force post even if old"
        required: false
        default: false
        type: boolean

jobs:
  syndicate:
    # Only run on successful deploy OR manual trigger
    if: github.event.deployment_status.state == 'success' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run syndication script
        env:
          MASTODON_URL: ${{ secrets.MASTODON_URL }}
          MASTODON_ACCESS_TOKEN: ${{ secrets.MASTODON_ACCESS_TOKEN }}
          BLUESKY_IDENTIFIER: ${{ secrets.BLUESKY_IDENTIFIER }}
          BLUESKY_APP_PASSWORD: ${{ secrets.BLUESKY_APP_PASSWORD }}
          FORCE_POST: ${{ inputs.force }}
        run: node scripts/syndicate.js
```

## Why this is cool

*   **Self-contained**: No Zapier, no IFTTT.
*   **Safe**: It only check the RSS feed when the site is *actually* live (`deployment_status.state == 'success'`), so no broken links.
*   **Cheap**: It runs on GitHub Actions' free tier.
