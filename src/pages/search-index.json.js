export async function GET() {
  const posts = await import.meta.glob('./blog/*.md', { eager: true });
  
  const searchIndex = Object.values(posts)
    .filter(post => new Date(post.frontmatter.date) <= new Date() && !post.frontmatter.draft)
    .map(post => ({
      id: post.url,
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      tags: post.frontmatter.tags?.join(' ') || '',
      date: post.frontmatter.date,
      url: post.url
    }));

  return new Response(JSON.stringify(searchIndex), {
    headers: { 'Content-Type': 'application/json' }
  });
}