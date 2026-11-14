# Signal Desk

One screen, no scrolling: AI news, markets, repos, models, papers, a daily lesson and build ideas.
Anything you like can be saved (bookmark, or hover and press `S`).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

It works with no keys at all: news comes from Hacker News, repos from GitHub, models and papers from Hugging Face,
new-model releases from OpenRouter, cricket from ESPNcricinfo, service status from each provider's status page, gold from Yahoo (through a proxy).
Saves go to this browser.

Weather uses your location: the browser asks once on first visit. Allow it and the card follows you; say no and it
falls back to the city from your timezone (type any city with "Change city"). No key is needed for any of this.

## OpenAI and Jev

Copy `.env.example` to `.env`, fill in what you have, and restart `npm run dev`. The dev server runs the same
routes Vercel runs (`/api/*`), so no Firebase login is needed locally.

| Set | What changes |
|---|---|
| `TYPESAFE_API_KEY` | Jev reads each Hacker News headline once, tags it (Model, Tool, Research, Business, Policy) and scores it against `INTERESTS`. Low scores drop out and the card says "Hacker News + Jev". Verdicts are remembered per story, so a refresh only pays for new headlines. |
| `OPENAI_API_KEY` and `OPENAI_MODEL` | A fresh daily lesson with a quiz, and a batch of project ideas. Pick a small, cheap chat model your account can use. |
| `PERPLEXITY_API_KEY` | AI news from live search instead of Hacker News (Jev still tags and scores it). |
| `GITHUB_TOKEN` | The Today desk lists your open pull requests and the ones waiting on your review. The token stays on the server. |
| `VERCEL_TOKEN`, `VERCEL_TEAM_ID` | The Today desk lists your Vercel projects, how many are live, and flags failed builds or sites that stop answering. Create the token at vercel.com/account/tokens; the team id is only for team projects. |
| `INTERESTS` | Comma list that steers Jev and the idea batch, for example `agents, dev tools, evals`. |

A route whose key is missing is skipped, and the card keeps its free source. Nothing shows an error.

## Deploying on Vercel

No database is needed. Everything except the integrations works for anyone who opens the site (it only shows public data), and the
integrations are protected by one passcode you choose.

1. Push the project to a Git repo (the `.env` file is ignored), then import it at vercel.com/new. Vercel detects Vite and the `api/` folder.
   Or run `npx vercel` from this folder and answer the prompts.
2. In the project's **Settings → Environment Variables**, add the variables below, then redeploy.
3. Open the site, click **Unlock** in the top bar, and enter your passcode. This is once per device; your password manager can remember it.

| Variable | Needed for |
|---|---|
| `DASHBOARD_PASSCODE` | **Required for everything below.** Pick a long random string (at least 12 characters). It is the only thing standing between the internet and your API keys. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Daily lesson, project ideas, "Plan it" |
| `TYPESAFE_API_KEY` | Jev tags and scores the news |
| `GITHUB_TOKEN` | Your open PRs and review requests |
| `VERCEL_TOKEN` (and `VERCEL_TEAM_ID` for team projects) | The Vercel projects card. If Vercel won't let you create a variable starting with `VERCEL_`, name them `SD_VERCEL_TOKEN` and `SD_VERCEL_TEAM_ID` instead; both spellings work. |
| `INTERESTS` | Optional: steers Jev and the idea batch |
| `PERPLEXITY_API_KEY` | Optional: live-search news |

Never prefix any of these with `VITE_`; that would put them in the public JavaScript. Firebase is optional and not needed for any of this.
Without it, saves, layout and settings live in each browser instead of syncing.

## What's where

Three desks, side by side (Today, Build, Pulse; slide with `1` `2` `3`, the arrows, or a swipe):

- **Today:** a brief assembled from everything else (top stories, the lesson, a repo, an idea, the weather and markets), your GitHub pull requests, quiz questions you got wrong coming back on a schedule, a scratchpad, a token meter and a focus timer.
- **Build:** AI news (filter by topic, hide what you don't want, a dot marks what's new since your last visit), Hacker News, the daily lesson, ideas with a "Plan it" button, repos, models, papers and your saved items.
- **Pulse:** an AI model radar (the newest models from the main labs with price and context window), live cricket scores and fixtures, live status of GitHub, npm, Vercel, Cloudflare, Claude and OpenAI, currencies, gold, weather and air quality, world clocks and your links. The pencil on currencies and clocks lets you choose what they track.

## Signing in syncs your settings

With Firebase configured, signing in with Google syncs your saves and also your layout, links, city, watchlists, quiz schedule,
scratchpad, theme and spend counter, so every device matches. Without it everything stays in this browser.

## Token spend

OpenAI, Jev and Perplexity usage is counted from the providers' own numbers and shown on the Today desk against a daily cap
(150K tokens by default, editable). At the cap, those routes pause and the dashboard falls back to free sources until tomorrow.

## Install as an app

In a production build the site is installable (the install icon in the address bar) and opens offline from its last visit.
To make it your new-tab page, set your browser's home or new-tab URL to the deployed address.

## Shortcuts

`1` `2` `3` or ← → switch desk · `N` jump to the scratchpad · `E` customise · `T` theme · `S` save the item under the cursor ·
`Ctrl K` or `/` opens the palette, which also searches stories, saved items and links, and copies a weekly digest.

In customise mode drag a card to move it, drop it on a gap between columns to start a new column, drag the gaps
to resize, or focus a card and use the arrow keys to move it and Delete to remove it.

## Token budget

News refreshes at most once per 2 hours and only while the dashboard is open (cached in the browser
between visits). Lesson and ideas: once a day each. Jev gets one request per story.
