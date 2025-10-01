export async function GET() {
  const posts = await import.meta.glob('./blog/*.md', { eager: true });
  const site = 'https://ikristina.github.io';
  
  const postUrls = Object.values(posts)
    .filter(post => new Date(post.frontmatter.date) <= new Date())
    .map(post => `    <url><loc>${site}${post.url}</loc></url>`)
    .join('\n');

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${site}</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${postUrls}
</urlset>`;

  return new Response(sitemap, {
    headers: { 'Content-Type': 'application/xml' }
  });
}