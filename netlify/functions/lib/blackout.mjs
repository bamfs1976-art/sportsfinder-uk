// UK 3pm Saturday football blackout.
// ---------------------------------------------------------------------------
// Live televised coverage of professional football matches kicking off on a
// Saturday afternoon (14:45 - 17:15 UK time) is prohibited under UEFA's
// Article 48 — adopted in the UK to protect attendance at lower-league
// grounds. Applies to Premier League, EFL Championship, League One, League
// Two and Scottish Premiership fixtures with UK kickoffs in that window.
//
// We don't strip the fixture — users still want to know the match is
// happening. We just flag it so the UI can show a "not televised" pill.

const COMPETITION_PATTERN = /premier league$|championship$|league one|league two|scottish premiership|sky bet|efl/i;
const BLACKOUT_START_MIN = 14 * 60 + 45; // 14:45
const BLACKOUT_END_MIN   = 17 * 60 + 15; // 17:15

// Returns { blacked: bool, reason?: string }. Pure — no fetch.
export function checkBlackout(fixture) {
  if (!fixture || !fixture.start) return { blacked: false };
  if (fixture.sport && fixture.sport !== "football") return { blacked: false };
  const comp = fixture.competition || fixture.title || "";
  if (!COMPETITION_PATTERN.test(comp)) return { blacked: false };

  // Convert ISO start to Europe/London weekday + minute-of-day.
  const startUtc = new Date(fixture.start);
  if (Number.isNaN(startUtc.getTime())) return { blacked: false };

  // Use Intl to get UK weekday and HH:mm — DST safe.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(startUtc);
  const weekday = parts.find(p => p.type === "weekday")?.value || "";
  const hh = Number(parts.find(p => p.type === "hour")?.value || 0);
  const mm = Number(parts.find(p => p.type === "minute")?.value || 0);

  if (weekday !== "Sat") return { blacked: false };
  const minOfDay = hh * 60 + mm;
  if (minOfDay >= BLACKOUT_START_MIN && minOfDay <= BLACKOUT_END_MIN) {
    return { blacked: true, reason: "UK 3pm Saturday blackout — not televised live" };
  }
  return { blacked: false };
}
