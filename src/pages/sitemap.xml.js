export async function GET({ site }) {
  const posts = await import.meta.glob('./blog/*.md', { eager: true });
  
  const postUrls = Object.values(posts)
    .filter(post => new Date(post.frontmatter.date) <= new Date())
    .map(post => `${site}${post.url}`)
    .join('\n  ');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${site}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  ${postUrls.split('\n').map(url => url.trim() ? `<url><loc>${url}</loc></url>` : '').join('\n  ')}
</urlset>`;

  return new Response(sitemap, {
    headers: { 'Content-Type': 'application/xml' }
  });
}