# SportFinder UK

UK live sport TV listings, personalised, with subscription cost tracking.

Live at **[sportfinder.netlify.app](https://sportfinder.netlify.app)** once deployed.

## What it does

- **Today** — time-grouped live sport listings across every UK sport channel (Sky, TNT, BBC, ITV, Channel 4, S4C, Premier Sports, Eurosport, Amazon Prime, DAZN, BBC iPlayer Live). Filter by sport, toggle to your channels only, search by team or event, export any fixture to your calendar.
- **My Sports** — three-step setup wizard captures your sports, teams (Premier League, Championship, Welsh, Scottish, URC, county cricket, F1, Super League…) and current subscriptions. Stored entirely in your browser.
- **Cost Calculator** — splits *needed* from *optional* packages so you see the minimum subscription cost to watch what you actually follow. Shows free coverage, weekly cost and a pint comparison.
- **Settings** — dark/light theme, reset, about. Notification toggles stubbed for v2.

## How the data works

Three sources fan out from a single Netlify Function at [`/api/epg`](netlify/functions/epg-proxy.mjs):

1. **Sky's own EPG API** — `awk.epgsky.com/hawk/linear/schedule/{YYYYMMDD}/{site_id}`. Same upstream the iptv-org/epg `sky.com` grabber uses. Covers all 11 Sky Sports sub-channels, 4 TNT Sports channels, Sky Sports Mix and Premier Sports 1/2. Returns 16-47 programmes per channel per day with real durations. Code: [`lib/sky-epg.mjs`](netlify/functions/lib/sky-epg.mjs).
2. **EPG.pw** — UK free-to-air (BBC, ITV, Channel 4, S4C) plus a fallback layer for any Sky/TNT channel where Sky's API stalls. The merger picks whichever source has *more* programmes per channel.
3. **TheSportsDB + UK rights table** — date-keyed fixtures across football/cricket/rugby/motorsport mapped onto broadcaster channels via a hand-maintained rights table. Lets streaming-only services (Amazon Prime Video, DAZN, BBC iPlayer Live, Eurosport 1/2) carry real fixtures even though they publish no traditional EPG. Code: [`lib/sportsdb.mjs`](netlify/functions/lib/sportsdb.mjs), [`lib/rights-table.mjs`](netlify/functions/lib/rights-table.mjs).

The response is CDN-cached for 30 minutes with stale-while-revalidate, so users always get an instant response and the cache refreshes in the background.

### UK 3pm Saturday blackout

Under UEFA Article 48, live televised coverage of professional football kicking off between 14:45 and 17:15 on a Saturday is prohibited in the UK. We don't strip those fixtures — they still appear in listings — but each is flagged with a red **Not televised** pill and a tooltip explaining the rule. Logic: [`lib/blackout.mjs`](netlify/functions/lib/blackout.mjs).

### Channel coverage (verified 25 May 2026)

Sky API uses Sky's `site_id`; EPG.pw uses its numeric channel id; rights-only channels are populated from TheSportsDB fixtures alone.

| Channel | Primary source | ID | Phase 2 status |
|---|---|---|---|
| Sky Sports Main Event | Sky API | 4002 | 22 programmes |
| Sky Sports Premier League | Sky API | 4010 | 47 programmes |
| Sky Sports Football | Sky API | 3939 | 37 programmes |
| Sky Sports Cricket | Sky API | 4081 | 27 programmes |
| Sky Sports Golf | Sky API | 4026 | 19 programmes |
| Sky Sports F1 | Sky API | 3835 | 26 programmes |
| Sky Sports Arena | Sky API | 3940 | 41 programmes |
| Sky Sports Action | Sky API | 4022 | 27 programmes |
| Sky Sports Mix | Sky API | 4090 | 26 programmes (new in Phase 2) |
| Sky Sports News | Sky API | 4049 | 28 programmes |
| Sky Sports Tennis | Sky API | 1284 | 27 programmes |
| Sky Sports+ | EPG.pw | 381882 | 82 programmes |
| TNT Sports 1 | EPG.pw (Sky API as backup) | 400477 / 1120 | 34 programmes |
| TNT Sports 2 | EPG.pw (Sky API as backup) | 400479 / 3627 | 49 programmes |
| TNT Sports 3 | Sky API | 3629 | 26 programmes |
| TNT Sports 4 | Sky API | 4040 | 18 programmes |
| Premier Sports 1 | EPG.pw (Sky API as backup) | 219100 / 1289 | 51 programmes |
| Premier Sports 2 | EPG.pw (Sky API as backup) | 219104 / 1290 | 37 programmes |
| BBC One | EPG.pw | 12385 | 52 programmes |
| BBC Two | EPG.pw | 12499 | 46 programmes |
| ITV1 | EPG.pw | 12086 | 48 programmes |
| ITV4 | EPG.pw | 12271 | 52 programmes |
| Channel 4 | EPG.pw | 12113 | 61 programmes |
| S4C | EPG.pw | 12378 | 79 programmes |
| BBC iPlayer Live | Rights table | — | 0+ fixtures (Wimbledon, WSL, FA Cup) |
| Amazon Prime Video | Rights table | — | 1+ fixtures (PL Dec week, MLS, TNF) |
| DAZN | Rights table | — | 0+ fixtures (boxing, UWCL) |
| Eurosport 1 | Rights table | — | 0+ fixtures (French Open, Australian Open) |
| Eurosport 2 | Rights table | — | 0+ fixtures (French Open outer courts) |

Phase 1 baseline was 12 channels with data / ~600 programmes/day. Phase 2 lifts that to 25 channels / ~960 programmes/day plus rights-based fixtures for the streaming services.

## Local testing the Function

```bash
# Smoke test that hits all three upstreams and prints a per-channel summary.
NODE_TLS_REJECT_UNAUTHORIZED=0 node test-function.mjs

# Or via netlify dev for the full proxy experience
npm i -g netlify-cli
netlify dev
# → http://localhost:8888/api/epg
# → http://localhost:8888/api/epg?debug=1   (adds debug.perChannelSummary)
```

The `NODE_TLS_REJECT_UNAUTHORIZED=0` flag is only needed when running locally behind a corporate proxy that MITMs HTTPS — Netlify's runtime trusts the upstream certs natively.

## Deploying

### Connect this repo to Netlify (recommended)

1. In Netlify, **Add new site → Import from Git → GitHub** → pick `bamfs1976-art/sportsfinder-uk`.
2. **Build settings**: leave as detected. `netlify.toml` already declares `publish = "."` and `functions = "netlify/functions"`.
3. **Site name**: `sportfinder` → resolves to `sportfinder.netlify.app`.
4. Deploy. Every push to `main` redeploys automatically.

The Function deploys with the site. No environment variables needed — TheSportsDB v3 is keyless and Sky's EPG endpoint is public.

### Netlify Drop (no Function — sample data only)

Drag `index.html` to [app.netlify.com/drop](https://app.netlify.com/drop). The proxy won't exist, so the app falls back entirely to sample data. Only useful for a quick demo.

## Project structure

```
sportsfinder-uk/
├── index.html                          # Single-file app (~2,050 lines)
├── netlify.toml                        # Redirects, security headers
├── netlify/functions/
│   ├── epg-proxy.mjs                   # /api/epg — orchestrator
│   └── lib/
│       ├── sky-epg.mjs                 # awk.epgsky.com client
│       ├── sportsdb.mjs                # TheSportsDB client
│       ├── rights-table.mjs            # UK broadcaster rights map
│       └── blackout.mjs                # Sat 3pm UK football blackout
├── test-function.mjs                   # Local smoke test
├── README.md
└── .gitignore
```

## Tech notes

- Vanilla HTML/CSS/JS — no frameworks, no build step.
- Node 20+ runtime for the Function (Netlify default).
- All preferences in `localStorage` (key `sportfinder_v1`, schema versioned).
- WCAG 2.2 AA, keyboard accessible, mobile-first (verified at 375px).
- No inline event handlers, all dynamic text escaped, CSP-restricted.
- ICS calendar export (RFC5545 compliant) for any fixture.

## Phase 3 ideas

- Postponement / abandonment handling — fixture APIs catch this faster than EPG.
- Notification opt-in (Web Push API) for fixtures involving your teams.
- Server-side caching of TheSportsDB league pulls (currently fetched on every cold start).
- Football-Data.org as a second fixtures source (requires a free API key in Netlify env vars).
- Boxing / UFC promoter scrape for fight cards (DAZN / TNT / Sky split).

## License

MIT.
