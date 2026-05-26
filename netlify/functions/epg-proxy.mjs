// SportFinder UK — EPG proxy (Phase 2)
// ---------------------------------------------------------------------------
// Combines three upstream sources into one normalised payload for the client:
//
//   1. EPG.pw         — good for BBC/ITV/C4/S4C (verified UK FTA IDs)
//   2. awk.epgsky.com — Sky's own schedule API, used for all Sky/TNT/Premier
//                       Sports channels. Vastly better coverage than EPG.pw
//                       (which returned empty for 11/15 of those sub-channels).
//   3. TheSportsDB    — date-keyed fixtures across football/cricket/rugby/
//                       motorsport. Mapped to broadcaster channels via the
//                       hand-maintained rights table so streaming-only
//                       services (Amazon Prime Video, DAZN, BBC iPlayer Live)
//                       get real fixtures.
//
// Each per-channel source returns the same shape:
//   { channelId, name, programmes: [ { title, desc, start, end } ] }
//
// Channel-level merge rule: whichever source has *more* programmes for a
// given channel wins. Ties go to Sky (it has timezones right by default and
// includes durations). The dual-source design means a single upstream outage
// doesn't blank out a channel.
//
// Saturday 14:45-17:15 UK football blackout is applied last — fixtures are
// not removed, just flagged with `blacked: true` so the client can render
// a "not televised" pill.
//
// Endpoint: /api/epg  (mapped via netlify.toml redirect)

import { fetchSkyEpg, SKY_CHANNELS, ukDateStamp } from "./lib/sky-epg.mjs";
import { fetchSportsdbFixtures } from "./lib/sportsdb.mjs";
import { resolveRights } from "./lib/rights-table.mjs";
import { checkBlackout } from "./lib/blackout.mjs";

// Sky's event sub-genre (esg) → our sport id. eg=7 is always "sport"; the
// esg refines it. Mapped by observing actual Sky programme genres across
// every Sky Sports channel — see the README for the full mapping table.
// Using esg eliminates the keyword-regex guesswork that previously caused
// misclassifications like "Ramsay's Kitchen Nightmares" → horse-racing.
const ESG_TO_SPORT = {
  1:  "nfl",            // American football / NFL
  3:  null,             // Studio / news (filter out, not a sport fixture)
  4:  null,             // Basketball (we don't support NBA/WNBA in client)
  5:  "boxing",         // Boxing / MMA
  6:  "cricket",        // Cricket
  8:  "football",       // Football (PL, EFL, La Liga, etc.)
  11: "f1",             // F1 / Motorsport (sometimes MotoGP — we treat as f1)
  13: "rugby-league",   // Rugby League
  14: null,             // Equestrian (we don't expose as a sport in client)
  17: "tennis",         // Tennis
  19: "darts"           // Darts
};

function skySportFromEsg(esg) {
  if (typeof esg !== "number") return null;
  // ESG_TO_SPORT has explicit null for "not a sport we surface".
  return ESG_TO_SPORT.hasOwnProperty(esg) ? ESG_TO_SPORT[esg] : null;
}

// EPG.pw IDs — retained for FTA + as a fallback for Sky/TNT if their API
// stalls. Channels covered by Sky's API are still listed here so the merge
// step has both candidates.
const EPG_PW_CHANNELS = [
  // Sky Sports
  { id: "sky-main-event", name: "Sky Sports Main Event",     epgId: "7673" },
  { id: "sky-premier",    name: "Sky Sports Premier League", epgId: "381876" },
  { id: "sky-football",   name: "Sky Sports Football",       epgId: "381878" },
  { id: "sky-cricket",    name: "Sky Sports Cricket",        epgId: "381880" },
  { id: "sky-golf",       name: "Sky Sports Golf",           epgId: "381884" },
  { id: "sky-f1",         name: "Sky Sports F1",             epgId: "381886" },
  { id: "sky-arena",      name: "Sky Sports Arena",          epgId: "381888" },
  { id: "sky-action",     name: "Sky Sports Action",         epgId: "381890" },
  { id: "sky-plus",       name: "Sky Sports+",               epgId: "381882" },
  { id: "sky-news",       name: "Sky Sports News",           epgId: "381892" },
  { id: "sky-tennis",     name: "Sky Sports Tennis",         epgId: "452498" },

  // TNT Sports
  { id: "tnt-1", name: "TNT Sports 1", epgId: "400477" },
  { id: "tnt-2", name: "TNT Sports 2", epgId: "400479" },
  { id: "tnt-3", name: "TNT Sports 3", epgId: "400481" },
  { id: "tnt-4", name: "TNT Sports 4", epgId: "400483" },

  // Free-to-air (Sky's API doesn't cover these — EPG.pw is the canonical source)
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

// Pseudo-channels that exist solely as targets for rights-table-driven
// fixtures. The Sky and EPG.pw APIs don't list them at all, but the client
// renders them and we inject fixtures into them via TheSportsDB.
const SYNTHETIC_CHANNELS = [
  { id: "bbc-iplayer-live", name: "BBC iPlayer Live" },
  { id: "amazon",           name: "Amazon Prime Video" },
  { id: "dazn",             name: "DAZN" },
  { id: "eurosport-1",      name: "Eurosport 1" },
  { id: "eurosport-2",      name: "Eurosport 2" }
];

const FETCH_TIMEOUT_MS = 4000;
const UPSTREAM_EPG_PW = "https://epg.pw/api/epg.json";

async function fetchEpgPwChannel(channel) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${UPSTREAM_EPG_PW}?channel_id=${encodeURIComponent(channel.epgId)}&lang=en`;
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    const list = Array.isArray(raw?.epg_list) ? raw.epg_list : [];
    const sorted = list
      .filter(p => p && p.title && p.start_date)
      .sort((a, b) => a.start_date.localeCompare(b.start_date));
    const programmes = sorted.map((p, i) => {
      const start = new Date(p.start_date);
      const next = sorted[i + 1];
      const end = next ? new Date(next.start_date) : new Date(start.getTime() + 60 * 60 * 1000);
      return {
        title: String(p.title).trim(),
        desc: p.desc ? String(p.desc).trim() : "",
        start: start.toISOString(),
        end: end.toISOString()
      };
    });
    return { channelId: channel.id, name: channel.name, programmes };
  } catch (err) {
    return { channelId: channel.id, name: channel.name, programmes: [], error: String(err.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAllEpgPw() {
  const results = await Promise.all(EPG_PW_CHANNELS.map(fetchEpgPwChannel));
  const map = new Map();
  for (const r of results) map.set(r.channelId, r);
  return map;
}

// Channel-level merge: prefer whichever source has more programmes.
// Returns merged Map<channelId, { name, source, programmes }>.
function mergeChannels(skyMap, pwMap) {
  const allIds = new Set([...skyMap.keys(), ...pwMap.keys()]);
  const out = new Map();
  for (const id of allIds) {
    const sky = skyMap.get(id);
    const pw = pwMap.get(id);
    const skyCount = sky?.programmes?.length || 0;
    const pwCount = pw?.programmes?.length || 0;
    // Sky wins on ties because it includes real durations.
    const pickSky = skyCount >= pwCount && skyCount > 0;
    const chosen = pickSky ? sky : pw;
    if (!chosen) continue;
    const programmes = (chosen.programmes || []).map(p => {
      const out = { ...p };
      // For Sky-sourced programmes, fill in sport from the esg sub-genre
      // and the image URL from programmeuuid. This lets the client skip
      // its keyword classification path entirely for these entries.
      if (pickSky) {
        const sport = skySportFromEsg(p.skyEsg);
        if (sport) out.sport = sport;
        if (p.programmeuuid) {
          out.image = `https://images.metadata.sky.com/pd-image/${p.programmeuuid}/16-9/640`;
        }
      }
      return out;
    });
    out.set(id, {
      channelId: id,
      name: chosen.name,
      source: pickSky ? "sky" : (pwCount > 0 ? "epg.pw" : "none"),
      programmes
    });
  }
  // Make sure synthetic channels have an entry even if no fixtures land later.
  for (const sc of SYNTHETIC_CHANNELS) {
    if (!out.has(sc.id)) out.set(sc.id, { channelId: sc.id, name: sc.name, source: "rights", programmes: [] });
  }
  return out;
}

// Convert a TheSportsDB fixture into a programme entry on the right broadcasters.
function fixtureToProgrammes(fixture, channelMap) {
  const rights = resolveRights(fixture.competition);
  if (!rights) return 0;
  const blackout = checkBlackout(fixture);
  const programme = {
    title: blackout.blacked ? `${fixture.title} (3pm blackout)` : `Live: ${fixture.title}`,
    desc: [fixture.competition, fixture.venue, fixture.country].filter(Boolean).join(" — "),
    start: fixture.start,
    end: fixture.end,
    fixture: true,
    competition: fixture.competition,
    sport: fixture.sport,
    blacked: blackout.blacked || false,
    blackoutReason: blackout.reason || null
  };
  let injected = 0;
  for (const channelId of [...(rights.primary || []), ...(rights.secondary || [])]) {
    const channel = channelMap.get(channelId);
    if (!channel) continue;
    // Skip if Sky/EPG.pw already has a programme starting at the same minute
    // for the same channel — avoid duplicates.
    const dupe = channel.programmes.find(p => Math.abs(new Date(p.start) - new Date(fixture.start)) < 60_000
                                            && p.title.toLowerCase().includes(fixture.title.toLowerCase().slice(0, 12)));
    if (dupe) {
      // Annotate the existing programme with blackout data instead of duplicating.
      if (blackout.blacked) {
        dupe.blacked = true;
        dupe.blackoutReason = blackout.reason;
      }
      continue;
    }
    channel.programmes.push(programme);
    injected++;
  }
  return injected;
}

// Annotate existing live programmes from Sky/EPG.pw with blackout flag where
// the title hints at a Sat 3pm PL/EFL kickoff. Catches matches that wouldn't
// be in TheSportsDB but show up in the broadcaster EPG anyway.
//
// Only fires when the title actually looks like a live fixture — defends
// against false positives on documentaries / reviews that happen to mention
// "EFL" or "Premier League" in their title.
const LIVE_FIXTURE_HINT = /^live\b|\bv\s|\bvs\s|kick.?off|matchday/i;
const NON_FIXTURE_HINT  = /review|magazine|preview|highlights|catch.?up|replay|greatest|repeat|build.?up|countdown|story of|years of|champion again|the play.?offs at|years of the/i;

function annotateEpgBlackout(channelMap) {
  for (const ch of channelMap.values()) {
    for (const p of ch.programmes) {
      if (p.blacked) continue; // already flagged
      if (NON_FIXTURE_HINT.test(p.title)) continue;
      if (!LIVE_FIXTURE_HINT.test(p.title)) continue;
      const synthetic = { sport: "football", competition: p.title + " " + (p.desc || ""), title: p.title, start: p.start };
      const bo = checkBlackout(synthetic);
      if (bo.blacked) {
        p.blacked = true;
        p.blackoutReason = bo.reason;
      }
    }
  }
}

export default async (req) => {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";

  // Fan out the three upstream calls in parallel.
  const dateStamp = ukDateStamp();
  const [skyMap, pwMap, fixtures] = await Promise.all([
    fetchSkyEpg(dateStamp).catch(() => new Map()),
    fetchAllEpgPw().catch(() => new Map()),
    fetchSportsdbFixtures().catch(() => [])
  ]);

  // Merge Sky + EPG.pw at the channel level.
  const merged = mergeChannels(skyMap, pwMap);

  // Inject TheSportsDB fixtures onto broadcasters via the rights table.
  let injectedCount = 0;
  for (const fx of fixtures) {
    injectedCount += fixtureToProgrammes(fx, merged);
  }

  // Re-sort programmes by start after injection.
  for (const ch of merged.values()) {
    ch.programmes.sort((a, b) => a.start.localeCompare(b.start));
  }

  // Apply blackout flag to broadcaster-listed programmes too.
  annotateEpgBlackout(merged);

  // Build the response payload.
  const channels = [...merged.values()];
  const okChannels = channels.filter(c => c.programmes.length > 0).length;
  const totalProgrammes = channels.reduce((s, c) => s + c.programmes.length, 0);
  const sources = {
    skyChannelsOk: [...skyMap.values()].filter(c => c.programmes.length > 0).length,
    epgPwChannelsOk: [...pwMap.values()].filter(c => c.programmes.length > 0).length,
    fixturesFetched: fixtures.length,
    fixturesInjected: injectedCount
  };

  const payload = {
    fetchedAt: new Date().toISOString(),
    dateStamp,
    channelsReturned: channels.length,
    channelsOk: okChannels,
    totalProgrammes,
    sources,
    channels
  };

  if (debug) {
    payload.debug = {
      skyKnown: SKY_CHANNELS.length,
      pwKnown: EPG_PW_CHANNELS.length,
      synthetic: SYNTHETIC_CHANNELS.length,
      perChannelSummary: channels.map(c => ({
        id: c.channelId, source: c.source, programmes: c.programmes.length
      }))
    };
  }

  return json(payload, 200, {
    "cache-control": "public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800",
    "netlify-cdn-cache-control": "public, max-age=1800, s-maxage=1800, stale-while-revalidate=1800"
  });
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
