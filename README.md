# Threads of Thought

A personal blog about Go programming, software development, and random thoughts. Built with [Astro](https://astro.build) and deployed to GitHub Pages.

## 🚀 Features

- **Responsive Design**: Clean, readable layout that works on all devices
- **GitHub Activity Heatmap**: Visual display of GitHub contributions on homepage
- **Client-Side Search**: Powered by [Lunr.js](https://lunrjs.com/) with dropdown results and dedicated search page
- **Pagination**: Posts organized with 8 posts per page
- **Interactive Calendar**: Click on dates to see posts from that day
- **Tag System**: Browse posts by topic with tag cloud
- **RSS Feed**: Subscribe at `/rss.xml` for automatic updates on new posts
- **Image Popups**: Click images for full-size view
- **Post Navigation**: Previous/next links between posts
- **Table of Contents**: Optional TOC generation for long posts
- **Code Syntax Highlighting**: Shiki with copy buttons and language labels
- **Comments System**: Powered by [Giscus](https://giscus.app/) using GitHub Discussions
- **Social Media SEO**: Open Graph and Twitter Card meta tags with automatic first image extraction
- **Search Engine Friendly**: Sitemap and proper meta tags
- **Future Post Support**: Posts with future dates are hidden until published
- **Privacy-Friendly Analytics**: [GoatCounter](https://www.goatcounter.com/) tracking without cookies

## 📚 Technology Stack

- **Framework**: [Astro](https://astro.build) - Static site generator
- **Styling**: Vanilla CSS with custom design system
- **Search**: [Lunr.js](https://lunrjs.com/) - Client-side full-text search
- **Syntax Highlighting**: [Shiki](https://shiki.matsu.io/) with Material Theme Palenight
- **Comments**: [Giscus](https://giscus.app/) - GitHub Discussions integration
- **Analytics**: [GoatCounter](https://www.goatcounter.com/) - Privacy-friendly tracking
- **Fonts**: Google Fonts (Courier Prime, Libre Baskerville, Source Serif Pro)
- **Deployment**: GitHub Pages with GitHub Actions
- **Content**: Markdown with frontmatter

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
image: '/images/post-image.jpg'  # Optional: for social media sharing
showToc: true
---

Your post content here...
```

**Image for Social Sharing**: If no `image` is specified, the system automatically uses the first image found in your post content for social media previews.

## 🔍 Search

The blog includes client-side search functionality:

- **Dropdown Search**: Type in the search box to see instant results
- **Search Page**: Press Enter to go to `/search` for full results
- **Search Index**: Automatically generated from published posts
- **Search Fields**: Searches titles, descriptions, and tags

## 🚀 Deployment

Automatically deploys to GitHub Pages on push to `main` branch via GitHub Actions.

## 📄 License

MIT License - feel free to use this code as a template for your own blog!

**Note**: The blog template and code are MIT licensed, but the actual blog posts and content remain copyrighted by the author.