// SportFinder UK — EPG proxy
// ---------------------------------------------------------------------------
// Fans out one fetch per UK sport channel to epg.pw, normalises the payload,
// and returns a single combined JSON response. Each channel is parallelised
// with a 4-second per-channel abort, so a slow upstream can't blow the
// function's overall budget.
//
// Cache strategy: CDN-edge cached for 30 minutes via response headers, with
// 1-hour stale-while-revalidate so users always get an instant response and
// the cache refreshes in the background.
//
// Endpoint: /api/epg  (mapped via netlify.toml redirect)

// Channels with known EPG.pw IDs as of 25 May 2026. Verified via WebFetch
// against epg.pw/areas/gb.html and live API probes.
const CHANNELS = [
  // Sky Sports
  { id: "sky-main-event",   name: "Sky Sports Main Event",     epgId: "7673" },
  { id: "sky-premier",      name: "Sky Sports Premier League", epgId: "381876" },
  { id: "sky-football",     name: "Sky Sports Football",       epgId: "381878" },
  { id: "sky-cricket",      name: "Sky Sports Cricket",        epgId: "381880" },
  { id: "sky-golf",         name: "Sky Sports Golf",           epgId: "381884" },
  { id: "sky-f1",           name: "Sky Sports F1",             epgId: "381886" },
  { id: "sky-arena",        name: "Sky Sports Arena",          epgId: "381888" },
  { id: "sky-action",       name: "Sky Sports Action",         epgId: "381890" },
  { id: "sky-plus",         name: "Sky Sports+",               epgId: "381882" },
  { id: "sky-news",         name: "Sky Sports News",           epgId: "381892" },
  { id: "sky-tennis",       name: "Sky Sports Tennis",         epgId: "452498" },

  // TNT Sports
  { id: "tnt-1", name: "TNT Sports 1", epgId: "400477" },
  { id: "tnt-2", name: "TNT Sports 2", epgId: "400479" },
  { id: "tnt-3", name: "TNT Sports 3", epgId: "400481" },
  { id: "tnt-4", name: "TNT Sports 4", epgId: "400483" },

  // Free-to-air
  { id: "bbc-one", name: "BBC One",   epgId: "12385" },
  { id: "bbc-two", name: "BBC Two",   epgId: "12499" },
  { id: "itv-1",   name: "ITV1",      epgId: "12086" },
  { id: "itv-4",   name: "ITV4",      epgId: "12271" },
  { id: "c4",      name: "Channel 4", epgId: "12113" },
  { id: "s4c",     name: "S4C",       epgId: "12378" },

  // Premier Sports
  { id: "premier-1", name: "Premier Sports 1", epgId: "219100" },
  { id: "premier-2", name: "Premier Sports 2", epgId: "219104" }
];

// Per-channel upstream fetch timeout. Keep tight so 23 parallel fetches fit
// inside Netlify's 10s function budget even when a few channels stall.
const FETCH_TIMEOUT_MS = 4000;
const UPSTREAM_BASE = "https://epg.pw/api/epg.json";

async function fetchChannel(channel) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${UPSTREAM_BASE}?channel_id=${encodeURIComponent(channel.epgId)}&lang=en`;
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    return { ok: true, channel, raw };
  } catch (err) {
    return { ok: false, channel, error: String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

// EPG.pw returns programmes with `start_date` only — no end times. We derive
// each programme's end as the next programme's start. The last programme
// of the day gets a sensible 1-hour default end.
function normaliseProgrammes(channel, raw) {
  const list = Array.isArray(raw?.epg_list) ? raw.epg_list : [];
  // Sort defensively by start_date in case upstream returns out of order.
  const sorted = list
    .filter(p => p && p.title && p.start_date)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  return sorted.map((p, i) => {
    const start = new Date(p.start_date);
    const next = sorted[i + 1];
    const end = next
      ? new Date(next.start_date)
      : new Date(start.getTime() + 60 * 60 * 1000);
    return {
      title: String(p.title).trim(),
      desc: p.desc ? String(p.desc).trim() : "",
      start: start.toISOString(),
      end: end.toISOString()
    };
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const single = url.searchParams.get("channel_id");

  // Single-channel mode: ?channel_id=7673 — useful for debugging
  const targets = single
    ? CHANNELS.filter(c => c.epgId === single)
    : CHANNELS;

  if (targets.length === 0) {
    return json({ error: "Unknown channel_id", available: CHANNELS.map(c => c.epgId) }, 400);
  }

  const results = await Promise.all(targets.map(fetchChannel));

  const channels = results.map(r => {
    if (!r.ok) {
      return {
        channelId: r.channel.id,
        name: r.channel.name,
        epgId: r.channel.epgId,
        error: r.error,
        programmes: []
      };
    }
    return {
      channelId: r.channel.id,
      name: r.raw?.name || r.channel.name,
      epgId: r.channel.epgId,
      timezone: r.raw?.timezone || "Europe/London",
      programmes: normaliseProgrammes(r.channel, r.raw)
    };
  });

  // "ok" means the channel returned at least one programme. EPG.pw sometimes
  // recognises an ID but has no data for it — we don't want to claim "23/23"
  // when 10 of those came back empty.
  const okCount = channels.filter(c => !c.error && c.programmes.length > 0).length;
  const totalProgrammes = channels.reduce((sum, c) => sum + c.programmes.length, 0);

  return json(
    {
      fetchedAt: new Date().toISOString(),
      channelsReturned: channels.length,
      channelsOk: okCount,
      totalProgrammes,
      channels
    },
    200,
    {
      // CDN cache for 30 minutes, stale revalidation for an extra 30 minutes.
      // Function returns instantly from edge after first request.
      "cache-control": "public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800",
      "netlify-cdn-cache-control": "public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800"
    }
  );
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "x-content-type-options": "nosniff",
      ...extraHeaders
    }
  });
}
