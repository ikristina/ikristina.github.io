export function calculateReadingTime(content) {
  const wordsPerMinute = 200;
  const text = typeof content === 'string' ? content : String(content || '');
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / wordsPerMinute);
  return minutes;
}