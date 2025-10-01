# Blog Notification & Auto-Posting Setup TODO

## 🔔 Subscription Bell Component

- [ ] **Create subscription bell UI**
  - Floating bell icon (top-right corner)
  - Modal popup with subscription options
  - Email input form
  - Social media follow buttons
  - RSS feed link

- [ ] **Email subscription backend**
  - Choose service (Buttondown recommended)
  - API integration for email collection
  - Store emails securely
  - Confirmation email flow

- [ ] **Automated notification system**
  - GitHub Action to detect new posts by date
  - Send emails when post date becomes "live"
  - Post to all social media simultaneously
  - Handle timezone considerations

## Social Media Auto-Posting

- [ ] **Set up auto tweets**
  - Create Twitter Developer account
  - Get API keys (v2 API)
  - Add GitHub Action workflow
  - Store secrets in repo settings

- [ ] **Set up auto Mastodon posting**
  - Choose Mastodon instance
  - Create application for API access
  - Get access token
  - Add to GitHub Action workflow

- [ ] **Set up auto Bluesky posting**
  - ✅ Yes, possible via AT Protocol API
  - Create Bluesky account
  - Generate app password
  - Add to GitHub Action workflow

- [ ] **Create Telegram channel and bot**
  - Create Telegram channel
  - Create bot via @BotFather
  - Get bot token and channel ID
  - Add to GitHub Action workflow

## Implementation Notes

### Twitter API

- Use Twitter API v2 with Bearer Token
- Free tier: 1,500 tweets/month
- Need: `TWITTER_BEARER_TOKEN`

### Mastodon API

- Instance: mastodon.social
- Profile: <https://mastodon.social/@ikristina>
- Create app in Settings → Development
- Need: `MASTODON_ACCESS_TOKEN`, `MASTODON_INSTANCE_URL`

### Bluesky API

- Use AT Protocol API
- Generate app password in Settings
- Need: `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`

### Telegram Bot

- Create bot: message @BotFather with `/newbot`
- Add bot to channel as admin
- Need: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`

## GitHub Action Workflow

Will trigger on:

- **Daily cron job** (check for posts with today's date)
- **Push to main** (backup trigger)
- **Manual dispatch** for testing

## Subscription Bell Features

- **Email signup** with instant confirmation
- **RSS feed** button with copy-to-clipboard
- **Social media** follow buttons (Twitter, Mastodon, Bluesky)
- **Telegram channel** join link
- **Close/minimize** options

## Secrets to Add in GitHub

```bash
TWITTER_BEARER_TOKEN
MASTODON_ACCESS_TOKEN
MASTODON_INSTANCE_URL
BLUESKY_HANDLE
BLUESKY_APP_PASSWORD
TELEGRAM_BOT_TOKEN
TELEGRAM_CHANNEL_ID
```