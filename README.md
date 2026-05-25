# SportFinder UK

Single-file HTML app that answers one question: **what live sport is on UK TV right now and today, and which channels do I need?**

Live at **[sportfinder.netlify.app](https://sportfinder.netlify.app)**.

## What it does

- **Today** — time-grouped live sport listings across every UK sport channel (Sky, TNT, BBC, ITV, Channel 4, Eurosport, Premier Sports, Amazon Prime, DAZN). Filter by sport, toggle to your channels only, search by team or event, export any fixture to your calendar.
- **My Sports** — three-step setup wizard captures your sports, teams (Premier League, Championship, Welsh, Scottish, URC, county cricket, F1, Super League…) and current subscriptions. Stored entirely in your browser.
- **Cost Calculator** — splits *needed* from *optional* packages so you see the minimum subscription cost to watch what you actually follow. Shows free coverage, weekly cost and a pub-pint comparison.
- **Settings** — dark/light theme, reset, about. Notification toggles are stubbed for v2.

## How it works

- One file, no frameworks, no build step.
- All preferences in `localStorage` (key `sportfinder_v1`, schema versioned).
- EPG data: probes [EPG.pw](https://epg.pw) on load. When the live feed is reachable the status pill says so; the visible schedule is always rendered from a hand-built sample set so the UI demonstrates correctly even when CORS blocks the request.
- WCAG 2.2 AA, keyboard accessible, mobile-first (verified at 375px), no inline event handlers, all dynamic text escaped, CSP-safe.

## Deploying

### Netlify Drop (easiest)

Drag `index.html` to [app.netlify.com/drop](https://app.netlify.com/drop). Site name: `sportfinder`.

### Netlify from this repo

Connect this repository in Netlify. No build command, publish directory `/`.

### Anywhere else

It's a static file. Drop it on any host that serves HTML.

## TODO before going past V1

The following EPG.pw channel IDs need verifying at [epg.pw/test_channel_xml.html](https://epg.pw/test_channel_xml.html?lang=en) and patching into the `CHANNELS` array in `index.html`:

- BBC One HD, BBC Two HD
- ITV1 HD, ITV4 HD
- Channel 4 HD, S4C HD
- Eurosport 1 HD, Eurosport 2 HD
- Premier Sports 1 HD, Premier Sports 2 HD
- Amazon Prime Video, DAZN

Sky Sports and TNT Sports IDs are already verified in the file.

If the live feed CORS-blocks from your domain, add a Netlify Function proxy at `netlify/functions/epg-proxy.js` and route fetches through it.

## License

MIT.
