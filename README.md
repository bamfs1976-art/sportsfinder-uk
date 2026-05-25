# SportFinder UK

UK live sport TV listings, personalised, with subscription cost tracking.

Live at **[sportfinder.netlify.app](https://sportfinder.netlify.app)** once deployed.

## What it does

- **Today** — time-grouped live sport listings across every UK sport channel (Sky, TNT, BBC, ITV, Channel 4, S4C, Premier Sports, Eurosport, Amazon Prime, DAZN). Filter by sport, toggle to your channels only, search by team or event, export any fixture to your calendar.
- **My Sports** — three-step setup wizard captures your sports, teams (Premier League, Championship, Welsh, Scottish, URC, county cricket, F1, Super League…) and current subscriptions. Stored entirely in your browser.
- **Cost Calculator** — splits *needed* from *optional* packages so you see the minimum subscription cost to watch what you actually follow. Shows free coverage, weekly cost and a pint comparison.
- **Settings** — dark/light theme, reset, about. Notification toggles stubbed for v2.

## How the data works

Two layers:

1. **Live EPG via Netlify Function.** The client calls `/api/epg`, which a Netlify Function proxies to [EPG.pw](https://epg.pw) server-side. CDN-cached for 30 minutes with stale-while-revalidate, so users always get an instant response. Source: [`netlify/functions/epg-proxy.mjs`](netlify/functions/epg-proxy.mjs).
2. **Curated sample fallback.** For channels EPG.pw doesn't list (UK Eurosport, Amazon Prime Video, DAZN) or where EPG.pw returns an empty programme list, the app fills in a hand-built sample schedule so the UI stays populated. Status pill shows "Live · N/M channels" with the real count.

Verified EPG.pw IDs as of 25 May 2026:

| Channel | EPG.pw ID | Status |
|---|---|---|
| Sky Sports Main Event | 7673 | Live data |
| Sky Sports Premier League | 381876 | Live data (Sky Sports+ feed) |
| Sky Sports Football | 381878 | ID recognised, empty — sample fallback |
| Sky Sports Cricket | 381880 | ID recognised, empty — sample fallback |
| Sky Sports Golf | 381884 | ID recognised, empty — sample fallback |
| Sky Sports F1 | 381886 | ID recognised, empty — sample fallback |
| Sky Sports Arena | 381888 | ID recognised, empty — sample fallback |
| Sky Sports Action | 381890 | ID recognised, empty — sample fallback |
| Sky Sports News | 381892 | ID recognised, empty — sample fallback |
| Sky Sports Tennis | 452498 | ID recognised, empty — sample fallback |
| TNT Sports 1 | 400477 | Live data |
| TNT Sports 2 | 400479 | Live data |
| TNT Sports 3 | 400481 | Live data |
| TNT Sports 4 | 400483 | Sample fallback |
| BBC One | 12385 | Live data |
| BBC Two | 12499 | Live data |
| ITV1 | 12086 | Live data |
| ITV4 | 12271 | Live data |
| Channel 4 | 12113 | Live data |
| S4C | 12378 | Live data |
| Premier Sports 1 | 219100 | Live data |
| Premier Sports 2 | 219104 | Live data |
| Eurosport 1 & 2 | — | Not on EPG.pw for UK — sample only |
| Amazon Prime Video | — | Streaming-only, no published EPG — sample only |
| DAZN | — | Streaming-only, no published EPG — sample only |

**Phase 2 work** will replace the streaming-service sample data with a fixtures-plus-rights mapping (TheSportsDB + Football-Data.org + a hand-maintained rights table).

## Deploying

### Connect this repo to Netlify (recommended)

1. In Netlify, **Add new site → Import from Git → GitHub** → pick `bamfs1976-art/sportsfinder-uk`.
2. **Build settings**: leave as detected. `netlify.toml` already declares `publish = "."` and `functions = "netlify/functions"`.
3. **Site name**: `sportfinder` → resolves to `sportfinder.netlify.app`.
4. Deploy. Every push to `main` redeploys automatically.

The Function deploys with the site. No environment variables needed.

### Netlify Drop (no Function — sample data only)

Drag `index.html` to [app.netlify.com/drop](https://app.netlify.com/drop). The proxy won't exist, so the app falls back entirely to sample data. Only useful for a quick demo.

## Project structure

```
sportsfinder-uk/
├── index.html                          # Single-file app (~2,000 lines)
├── netlify.toml                        # Redirects, security headers
├── netlify/functions/
│   └── epg-proxy.mjs                   # /api/epg → EPG.pw, normalised JSON
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

## Local testing the Function

```bash
# Install Netlify CLI if you haven't
npm i -g netlify-cli

# From repo root
netlify dev
# → http://localhost:8888
# → http://localhost:8888/api/epg (proxied)
```

Or write a small standalone test script that imports the function directly:

```js
import handler from "./netlify/functions/epg-proxy.mjs";
const res = await handler(new Request("https://x/api/epg"));
console.log(await res.json());
```

## License

MIT.
