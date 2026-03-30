import Parser from 'rss-parser';
import { AtpAgent, RichText } from '@atproto/api';
import 'dotenv/config';

const parser = new Parser();

const MASTODON_URL = process.env.MASTODON_URL;
const MASTODON_ACCESS_TOKEN = process.env.MASTODON_ACCESS_TOKEN;
const BLUESKY_IDENTIFIER = process.env.BLUESKY_IDENTIFIER;
const BLUESKY_APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;


async function main() {
    // 1. Fetch RSS Feed
    console.log('Fetching RSS feed...');
    try {
        const feed = await parser.parseURL('https://ikristina.github.io/rss.xml');

        if (!feed.items || feed.items.length === 0) {
            console.log('No items found in RSS feed.');
            return;
        }

        const MAX_AGE_MS = 24 * 60 * 60 * 1000;
        const force = process.env.FORCE_POST === 'true';
        const now = new Date();

        const recentPosts = feed.items.filter(item => {
            const age = now - new Date(item.pubDate);
            return force || age <= MAX_AGE_MS;
        });

        if (recentPosts.length === 0) {
            console.log('No recent posts to syndicate.');
            return;
        }

        console.log(`Found ${recentPosts.length} recent post(s) to syndicate.`);

        // 2. Post to Mastodon
        let mastodonStatuses = null;
        let mastodonHeaders = null;
        let mastodonApiBase = null;

        if (MASTODON_URL && MASTODON_ACCESS_TOKEN) {
            try {
                mastodonHeaders = { 'Authorization': `Bearer ${MASTODON_ACCESS_TOKEN}` };
                mastodonApiBase = `${MASTODON_URL}/api/v1`;
                const verify = await fetch(`${mastodonApiBase}/accounts/verify_credentials`, { headers: mastodonHeaders });
                const { id: myId } = await verify.json();
                const statusesRes = await fetch(`${mastodonApiBase}/accounts/${myId}/statuses?limit=40`, { headers: mastodonHeaders });
                mastodonStatuses = await statusesRes.json();
            } catch (error) {
                console.error('Error fetching Mastodon state:', error);
            }
        }

        // 3. Set up Bluesky
        let bskyAgent = null;
        let bskyFeedPosts = null;

        if (BLUESKY_IDENTIFIER && BLUESKY_APP_PASSWORD) {
            try {
                bskyAgent = new AtpAgent({ service: 'https://bsky.social' });
                await bskyAgent.login({ identifier: BLUESKY_IDENTIFIER, password: BLUESKY_APP_PASSWORD });
                const bskyFeed = await bskyAgent.getAuthorFeed({ actor: BLUESKY_IDENTIFIER, limit: 40 });
                bskyFeedPosts = bskyFeed.data.feed;
            } catch (error) {
                console.error('Error fetching Bluesky state:', error);
            }
        }

        for (const post of recentPosts) {
            const pubDate = new Date(post.pubDate);
            console.log(`\nPost: "${post.title}"`);
            console.log(`Link: ${post.link}`);
            console.log(`Published: ${pubDate.toISOString()}`);

            const categories = post.categories || [];
            const hashtags = categories.map(tag => `#${tag.replace(/\s+/g, '')}`).join(' ');
            const message = `${post.title}\n\n${post.link}\n\n${hashtags}`;

            if (mastodonStatuses) {
                try {
                    const alreadyPosted = mastodonStatuses.some(s => s.content.includes(post.link));
                    if (alreadyPosted && !force) {
                        console.log('Already posted to Mastodon. Skipping.');
                    } else {
                        console.log('Posting to Mastodon...');
                        await fetch(`${mastodonApiBase}/statuses`, {
                            method: 'POST',
                            headers: { ...mastodonHeaders, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: message }),
                        });
                        console.log('Successfully posted to Mastodon.');
                    }
                } catch (error) {
                    console.error('Error posting to Mastodon:', error);
                }
            }

            if (bskyAgent && bskyFeedPosts) {
                try {
                    const alreadyPosted = bskyFeedPosts.some(p => (p.post.record.text || '').includes(post.link));
                    if (alreadyPosted && !force) {
                        console.log('Already posted to Bluesky. Skipping.');
                    } else {
                        console.log('Posting to Bluesky...');
                        const rt = new RichText({ text: message });
                        await rt.detectFacets(bskyAgent);

                        let embed;
                        if (post.enclosure?.url) {
                            try {
                                const imgRes = await fetch(post.enclosure.url);
                                const imgBuf = await imgRes.arrayBuffer();
                                const contentType = imgRes.headers.get('content-type') || 'image/png';
                                const { data: blobData } = await bskyAgent.uploadBlob(new Uint8Array(imgBuf), { encoding: contentType });
                                embed = {
                                    $type: 'app.bsky.embed.external',
                                    external: {
                                        uri: post.link,
                                        title: post.title,
                                        description: post.contentSnippet || '',
                                        thumb: blobData.blob,
                                    },
                                };
                            } catch (imgError) {
                                console.warn('Could not attach image to Bluesky post:', imgError.message);
                            }
                        }

                        await bskyAgent.post({
                            text: rt.text,
                            facets: rt.facets,
                            createdAt: new Date().toISOString(),
                            ...(embed && { embed }),
                        });
                        console.log('Successfully posted to Bluesky.');
                    }
                } catch (error) {
                    console.error('Error posting to Bluesky:', error);
                }
            }
        }

    } catch (error) {
        console.error('Error fetching/parsing RSS feed:', error);
    }
}

main().catch(console.error);
