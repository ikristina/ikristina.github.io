export async function GET() {
  const posts = await import.meta.glob('./blog/*.md', { eager: true });
  
  const items = Object.values(posts)
    .filter(post => new Date(post.frontmatter.date) <= new Date() && !post.frontmatter.draft)
    .sort((a, b) => new Date(b.frontmatter.date) - new Date(a.frontmatter.date))
    .map(post => `
    <item>
      <title><![CDATA[${post.frontmatter.title}]]></title>
      <description><![CDATA[${post.frontmatter.description}]]></description>
      <pubDate>${new Date(post.frontmatter.date).toUTCString()}</pubDate>
      <link>https://ikristina.github.io${post.url}</link>
      <guid>https://ikristina.github.io${post.url}</guid>
    </item>`)
    .join('');

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Threads of Thought</title>
    <description>A blog about Go programming, software development, and random thoughts</description>
    <link>https://ikristina.github.io</link>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>${items}
  </channel>
</rss>`;

  return new Response(rss, {
    headers: { 'Content-Type': 'application/rss+xml' }
  });
}