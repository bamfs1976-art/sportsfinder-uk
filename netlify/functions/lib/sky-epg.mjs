// Sky EPG client — calls Sky's own public schedule API (awk.epgsky.com).
// ---------------------------------------------------------------------------
// This is the same upstream the iptv-org/epg `sky.com` grabber uses, just
// reached directly instead of via a Node CLI. One HTTP call per channel per
// day, returns rich programme data for every Sky/TNT/Premier Sports channel
// in the Sky UK bouquet — far better coverage than EPG.pw for these channels.
//
// site_id values verified against:
//   https://raw.githubusercontent.com/iptv-org/epg/master/sites/sky.com/sky.com.channels.xml
// Live-probed 2026-05-25: every id below returned >=16 programmes.

export const SKY_CHANNELS = [
  // Our channel id        Sky site_id   Display name
  { channelId: "sky-main-event", siteId: "4002", name: "Sky Sports Main Event" },
  { channelId: "sky-premier",    siteId: "4010", name: "Sky Sports Premier League" },
  { channelId: "sky-football",   siteId: "3939", name: "Sky Sports Football" },
  { channelId: "sky-cricket",    siteId: "4081", name: "Sky Sports Cricket" },
  { channelId: "sky-golf",       siteId: "4026", name: "Sky Sports Golf" },
  { channelId: "sky-f1",         siteId: "3835", name: "Sky Sports F1" },
  { channelId: "sky-arena",      siteId: "3940", name: "Sky Sports Arena" },
  { channelId: "sky-action",     siteId: "4022", name: "Sky Sports Action" },
  { channelId: "sky-mix",        siteId: "4090", name: "Sky Sports Mix" },
  { channelId: "sky-news",       siteId: "4049", name: "Sky Sports News" },
  { channelId: "sky-tennis",     siteId: "1284", name: "Sky Sports Tennis" },

  // TNT Sports
  { channelId: "tnt-1", siteId: "1120", name: "TNT Sports 1" },
  { channelId: "tnt-2", siteId: "3627", name: "TNT Sports 2" },
  { channelId: "tnt-3", siteId: "3629", name: "TNT Sports 3" },
  { channelId: "tnt-4", siteId: "4040", name: "TNT Sports 4" },

  // Premier Sports
  { channelId: "premier-1", siteId: "1289", name: "Premier Sports 1" },
  { channelId: "premier-2", siteId: "1290", name: "Premier Sports 2" }
];

const FETCH_TIMEOUT_MS = 4000;
const API_BASE = "https://awk.epgsky.com/hawk/linear/schedule";

// YYYYMMDD format that the Sky API expects, in Europe/London terms.
export function ukDateStamp(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit"
  });
  return fmt.format(d).replace(/-/g, ""); // YYYY-MM-DD -> YYYYMMDD
}

async function fetchOne(siteId, dateStamp) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/${dateStamp}/${siteId}`, {
      signal: ctl.signal,
      headers: { accept: "application/json" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Sky returns events with `st` (unix seconds) and `d` (duration seconds).
function normalise(events) {
  if (!Array.isArray(events)) return [];
  return events
    .filter(e => e && e.t && Number.isFinite(e.st))
    .sort((a, b) => a.st - b.st)
    .map(e => {
      const start = new Date(e.st * 1000);
      const end = new Date((e.st + (e.d || 3600)) * 1000);
      // Sky prefixes some titles with "⋗" (or other glyph markers) for
      // "next up" hints. Strip any leading non-alphanumeric symbol so the
      // title starts on a real word.
      const cleanTitle = String(e.t).replace(/^[^\w\d"'(]+/, "").trim();
      return {
        title: cleanTitle,
        desc: e.sy ? String(e.sy).trim() : "",
        start: start.toISOString(),
        end: end.toISOString(),
        // Sky metadata pass-through:
        //  esg — sport sub-genre code (server-side classification)
        //  hd  — HD broadcast flag
        //  programmeuuid — used to compose pd-image thumbnail URLs
        skyEsg: typeof e.esg === "number" ? e.esg : null,
        hd: e.hd === true,
        programmeuuid: e.programmeuuid || null
      };
    });
}

// Returns Map<channelId, { name, programmes[] }>. Empty entry on per-channel
// fail so the orchestrator can still merge.
export async function fetchSkyEpg(dateStamp = ukDateStamp()) {
  const results = await Promise.all(
    SKY_CHANNELS.map(async ch => {
      try {
        const raw = await fetchOne(ch.siteId, dateStamp);
        const events = raw?.schedule?.[0]?.events || [];
        return { channelId: ch.channelId, name: ch.name, siteId: ch.siteId, programmes: normalise(events) };
      } catch (err) {
        return { channelId: ch.channelId, name: ch.name, siteId: ch.siteId, programmes: [], error: String(err.message || err) };
      }
    })
  );
  const map = new Map();
  for (const r of results) map.set(r.channelId, r);
  return map;
}
