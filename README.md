# Threads of Thought

A personal blog about Go programming, software development, and random thoughts. Built with [Astro](https://astro.build) and deployed to GitHub Pages.

## 🚀 Features

- **Responsive Design**: Clean, readable layout that works on all devices
- **Pagination**: Posts organized with 8 posts per page
- **Interactive Calendar**: Click on dates to see posts from that day
- **Tag System**: Browse posts by topic with tag cloud
- **RSS Feed**: Subscribe at `/rss.xml`
- **Image Popups**: Click images for full-size view
- **Post Navigation**: Previous/next links between posts
- **Search Engine Friendly**: Sitemap and proper meta tags

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📝 Writing Posts

Create new posts in `src/pages/blog/` as Markdown files with frontmatter:

```markdown
---
layout: ../../layouts/BlogPost.astro
title: 'Your Post Title'
date: '2025-01-15 14:30 EST'
description: 'Brief description of your post'
tags: ['go', 'programming', 'tutorial']
showToc: true
---

Your post content here...
```

## 🚀 Deployment

Automatically deploys to GitHub Pages on push to `main` branch via GitHub Actions.

## 📄 License

MIT License - feel free to use this code as a template for your own blog!

**Note**: The blog template and code are MIT licensed, but the actual blog posts and content remain copyrighted by the author.