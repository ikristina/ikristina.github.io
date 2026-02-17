import Parser from 'rss-parser';
import Masto from 'mastodon-api';
import { BskyAgent, RichText } from '@atproto/api';
import 'dotenv/config';

const parser = new Parser();

const MASTODON_URL = process.env.MASTODON_URL;
const MASTODON_ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER;
const BLUESKY_APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;

// --- Config ---
// How old can a post be to be considered "new"? (e.g. 24 hours)
// Increased to 24h to handle timezone mismatches (UTC vs local) and deployment delays.
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function main() {
    // 1. Fetch RSS Feed
    console.log('Fetching RSS feed...');
    try {
        const feed = await parser.parseURL('https://ikristina.github.io/rss.xml');

        if (!feed.items || feed.items.length === 0) {
            console.log('No items found in RSS feed.');
            return;
        }

        const latestPost = feed.items[0];
        const pubDate = new Date(latestPost.pubDate);
        const now = new Date();
        const diff = now - pubDate;

        console.log(`Latest post: "${latestPost.title}"`);
        console.log(`Link:        ${latestPost.link}`);
        console.log(`Published:   ${pubDate.toISOString()}`);

        const categories = latestPost.categories || [];
        const hashtags = categories.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');

        const message = `${latestPost.title}\n\n${latestPost.link}\n\n${hashtags}`;
        const force = process.env.FORCE_POST === 'true';

        // 2. Post to Mastodon
        if (MASTODON_URL && MASTODON_ACCESS_TOKEN) {
            try {
                const M = new Masto({
                    access_token: MASTODON_ACCESS_TOKEN,
                    timeout_ms: 60 * 1000,
                    api_url: `${MASTODON_URL}/api/v1/`,
                });

                // Check if already posted
                const verify = await M.get('accounts/verify_credentials');
                const myId = verify.data.id;
                const statuses = await M.get(`accounts/${myId}/statuses`, { limit: 20 });

                const alreadyPosted = statuses.data.some(status =>
                    status.content.includes(latestPost.link)
                );

                if (alreadyPosted && !force) {
                    console.log('Already posted to Mastodon. Skipping.');
                } else {
                    console.log('Posting to Mastodon...');
                    await M.post('statuses', { status: message });
                    console.log('Successfully posted to Mastodon.');
                }
            } catch (error) {
                console.error('Error Mastodon:', error);
            }
        }

        // 3. Post to Bluesky
        if (BLUESKY_IDENTIFIER && BLUESKY_APP_PASSWORD) {
            try {
                const agent = new BskyAgent({ service: 'https://bsky.social' });
                await agent.login({ identifier: BLUESKY_IDENTIFIER, password: BLUESKY_APP_PASSWORD });

                // Check if already posted
                const feed = await agent.getAuthorFeed({ actor: BLUESKY_IDENTIFIER, limit: 20 });
                const alreadyPosted = feed.data.feed.some(post => {
                    const text = post.post.record.text || '';
                    return text.includes(latestPost.link);
                });

                if (alreadyPosted && !force) {
                    console.log('Already posted to Bluesky. Skipping.');
                } else {
                    console.log('Posting to Bluesky...');
                    const rt = new RichText({ text: message });
                    await rt.detectFacets(agent);

                    await agent.post({
                        text: rt.text,
                        facets: rt.facets,
                        createdAt: new Date().toISOString(),
                    });
                    console.log('Successfully posted to Bluesky.');
                }
            } catch (error) {
                console.error('Error Bluesky:', error);
            }
        }

    } catch (error) {
        console.error('Error fetching/parsing RSS feed:', error);
    }
}

main().catch(console.error);
