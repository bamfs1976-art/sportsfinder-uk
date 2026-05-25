// TheSportsDB fixtures client.
// ---------------------------------------------------------------------------
// Calls the public v3 API (no key needed for free tier). One call per sport
// per date. Returns a flat list of normalised fixtures ready for the rights
// table to map onto broadcasters.

const API_BASE = "https://www.thesportsdb.com/api/v1/json/3/eventsday.php";
const NEXT_LEAGUE = "https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php";
const FETCH_TIMEOUT_MS = 4000;

// Sport names TheSportsDB recognises. Tennis returned 0 on probe — we leave
// it off and rely on EPG titles for tennis coverage instead.
const SPORTS = ["Soccer", "Cricket", "Rugby", "Motorsport"];

// Marquee UK-broadcast leagues — eventsday.php has thin coverage for some
// of these, so we top up with eventsnextleague.php (returns next 15) and
// filter to today's UK date. League IDs are TheSportsDB's stable IDs.
const PRIORITY_LEAGUES = [
  { id: "4328", name: "English Premier League" },
  { id: "4480", name: "UEFA Champions League" },
  { id: "4481", name: "UEFA Europa League" },
  { id: "4329", name: "EFL Championship" },
  { id: "4396", name: "FA Cup" },
  { id: "4346", name: "Scottish Premiership" },
  { id: "4335", name: "Spanish La Liga" },
  { id: "4332", name: "Italian Serie A" },
  { id: "4331", name: "German Bundesliga" },
  { id: "4334", name: "French Ligue 1" }
];

// Map TheSportsDB sport name → our internal sport id.
const SPORT_ID = {
  Soccer: "football",
  Cricket: "cricket",
  Rugby: "rugby-union",      // refined per-league below
  Motorsport: "motorsport"   // refined per-league below
};

// Some leagues need more specific sport ids than TheSportsDB's bucket.
const LEAGUE_SPORT_OVERRIDES = [
  { pattern: /super league/i, sport: "rugby-league" },
  { pattern: /\bnrl\b/i,      sport: "rugby-league" },
  { pattern: /formula 1|f1\b/i, sport: "f1" }
];

function ukDateIso(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(d);
}

async function fetchSport(sport, dateIso) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `${API_BASE}?d=${encodeURIComponent(dateIso)}&s=${encodeURIComponent(sport)}`;
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return Array.isArray(body.events) ? body.events : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function refineSport(baseSport, league) {
  for (const { pattern, sport } of LEAGUE_SPORT_OVERRIDES) {
    if (pattern.test(league || "")) return sport;
  }
  return baseSport;
}

// TheSportsDB dates/times are UTC. Build an ISO timestamp and a 2-hour default
// duration if `strTimestamp` is missing.
function buildStart(ev) {
  if (ev.strTimestamp) {
    const d = new Date(ev.strTimestamp);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  // Fallback: combine dateEvent + strTime (assumed UTC).
  const date = ev.dateEvent;
  const time = (ev.strTime || "12:00:00").slice(0, 8);
  if (date) {
    const d = new Date(`${date}T${time}Z`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function normalise(ev, baseSport) {
  const start = buildStart(ev);
  if (!start) return null;
  // 2h default for football/rugby, longer for cricket/F1.
  const duration = /cricket/i.test(baseSport) ? 4 * 3600
                : /motorsport|f1/i.test(baseSport) ? 3 * 3600
                : 2 * 3600;
  const end = new Date(new Date(start).getTime() + duration * 1000).toISOString();
  const home = (ev.strHomeTeam || "").trim();
  const away = (ev.strAwayTeam || "").trim();
  const eventName = (ev.strEvent || "").trim();
  const title = home && away
    ? `${home} v ${away}`
    : eventName || ev.strLeague || "Sport";
  return {
    id: `sdb-${ev.idEvent || `${start}-${title}`}`,
    sport: refineSport(SPORT_ID[baseSport] || baseSport.toLowerCase(), ev.strLeague),
    competition: ev.strLeague || "",
    title,
    homeTeam: home,
    awayTeam: away,
    start,
    end,
    venue: ev.strVenue || "",
    country: ev.strCountry || ""
  };
}

async function fetchPriorityLeague(league, dateIso) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${NEXT_LEAGUE}?id=${league.id}`, {
      signal: ctl.signal, headers: { accept: "application/json" }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const events = Array.isArray(body.events) ? body.events : [];
    // Filter to fixtures whose dateEvent matches today's UK date.
    return events.filter(e => e.dateEvent === dateIso);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSportsdbFixtures(date = new Date()) {
  const dateIso = ukDateIso(date);
  const dayBuckets = SPORTS.map(s => fetchSport(s, dateIso).then(events => ({ sport: s, events })));
  const leagueBuckets = PRIORITY_LEAGUES.map(l => fetchPriorityLeague(l, dateIso).then(events => ({ sport: "Soccer", events })));
  const all = await Promise.all([...dayBuckets, ...leagueBuckets]);
  const out = [];
  const seen = new Set();
  for (const { sport, events } of all) {
    for (const ev of events) {
      const key = ev.idEvent || `${ev.dateEvent}-${ev.strHomeTeam}-${ev.strAwayTeam}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const norm = normalise(ev, sport);
      if (norm) out.push(norm);
    }
  }
  return out;
}
