// UK sports broadcast rights table — 2025-26 season.
// ---------------------------------------------------------------------------
// Hand-maintained mapping from competition name (as it appears in
// TheSportsDB's strLeague) to UK broadcaster channel id(s). The first
// channelId in the array is the *primary* broadcaster — the secondary slots
// are co-broadcasts (e.g. FA Cup on BBC+ITV, or PL games on Sky AND Amazon
// for the December weeks).
//
// Source notes (refreshed May 2026):
//   - Premier League: Sky/TNT/Amazon (3-way split through 2028-29)
//   - EFL: Sky Sports (until 2029)
//   - FA Cup: BBC + TNT Sports (2024-29)
//   - UEFA Champions League / Europa / Conference: TNT Sports exclusive UK
//   - Women's UCL: DAZN (free YouTube also; UK signal = DAZN)
//   - Wimbledon: BBC + BBC iPlayer Live
//   - French Open: TNT Sports + Eurosport (via discovery+)
//   - F1: Sky Sports F1 (live), Channel 4 (highlights + 1 race live)
//   - Cricket: Sky Sports + BBC (Hundred women), county T20 = Sky Sports
//   - Super League: Sky Sports
//   - URC / Premiership Rugby: TNT Sports + Premier Sports (some)
//   - NFL: Sky Sports + ITV (some), Amazon (TNF), DAZN (NFL Game Pass)
//   - Boxing: TNT Sports / DAZN / Sky depending on promoter
//   - Top-tier Tennis (Wimbledon final etc.) also on iPlayer Live.
//
// To extend: add an entry below. Pattern is matched case-insensitive against
// the fixture's competition string. Order matters — more specific patterns
// should come before the broader fallbacks.

export const RIGHTS = [
  // FOOTBALL — domestic
  { match: /premier league$/i,            primary: ["sky-premier"],    secondary: ["sky-main-event", "amazon", "tnt-1"] },
  { match: /championship play-?off/i,     primary: ["sky-main-event"], secondary: ["sky-premier"] },
  { match: /^championship$|sky bet championship/i, primary: ["sky-football"], secondary: ["sky-main-event"] },
  { match: /efl|league one|league two|carabao/i,   primary: ["sky-football"], secondary: ["sky-main-event"] },
  { match: /fa cup/i,                     primary: ["bbc-one"],        secondary: ["tnt-1", "itv-1"] },
  { match: /community shield/i,           primary: ["bbc-one"],        secondary: [] },
  { match: /women.?s super league|fa wsl|barclays wsl/i, primary: ["sky-football"], secondary: ["bbc-iplayer-live", "bbc-one"] },

  // FOOTBALL — Scottish & Welsh & Irish
  { match: /scottish premiership/i,       primary: ["sky-football"],   secondary: ["premier-1"] },
  { match: /scottish (cup|championship)/i, primary: ["premier-1"],     secondary: [] },
  { match: /cymru premier/i,              primary: ["s4c"],            secondary: [] },
  { match: /league of ireland/i,          primary: ["premier-1"],      secondary: [] },

  // FOOTBALL — European club
  { match: /champions league|uefa.*champions/i, primary: ["tnt-1"],   secondary: ["tnt-2", "tnt-3"] },
  { match: /europa league|uefa.*europa/i,       primary: ["tnt-2"],   secondary: ["tnt-3"] },
  { match: /europa conference|uefa.*conference/i, primary: ["tnt-3"], secondary: [] },
  { match: /uefa super cup/i,             primary: ["tnt-1"],          secondary: [] },
  { match: /uefa women.?s champions/i,    primary: ["dazn"],           secondary: [] },

  // FOOTBALL — international
  { match: /world cup qualif/i,           primary: ["itv-1"],          secondary: ["bbc-one"] },
  { match: /world cup|fifa world/i,       primary: ["bbc-one"],        secondary: ["itv-1"] },
  { match: /euro 20|uefa euro|european champ/i, primary: ["bbc-one"],  secondary: ["itv-1"] },
  { match: /nations league/i,             primary: ["itv-1"],          secondary: ["channel-4"] },

  // FOOTBALL — top European leagues (UK rights)
  { match: /la liga|primera divisi/i,     primary: ["premier-1"],      secondary: ["premier-2"] },
  { match: /serie a/i,                    primary: ["tnt-1"],          secondary: ["tnt-2"] },
  { match: /bundesliga/i,                 primary: ["sky-football"],   secondary: ["sky-main-event"] },
  { match: /ligue 1/i,                    primary: ["amazon"],         secondary: [] },
  { match: /eredivisie/i,                 primary: ["premier-1"],      secondary: [] },
  { match: /\bmls\b|major league soccer/i, primary: ["amazon"],        secondary: [] },

  // CRICKET
  { match: /the hundred/i,                primary: ["sky-cricket"],    secondary: ["bbc-two", "sky-main-event"] },
  { match: /vitality blast|t20 blast|english t20/i, primary: ["sky-cricket"], secondary: ["sky-main-event"] },
  { match: /county championship/i,        primary: ["sky-cricket"],    secondary: [] },
  { match: /royal london|one[- ]day cup/i, primary: ["sky-cricket"],   secondary: [] },
  { match: /the ashes|ashes/i,            primary: ["sky-cricket"],    secondary: ["sky-main-event"] },
  { match: /\bipl\b|indian premier/i,     primary: ["sky-cricket"],    secondary: ["sky-main-event"] },
  { match: /icc.*world cup|cricket world cup/i, primary: ["sky-cricket"], secondary: ["sky-main-event"] },
  { match: /^test match|england.*test/i,  primary: ["sky-cricket"],    secondary: ["sky-main-event"] },

  // RUGBY UNION
  { match: /six nations/i,                primary: ["itv-1"],          secondary: ["bbc-one"] },
  { match: /\burc\b|united rugby championship/i, primary: ["premier-1"], secondary: ["s4c", "premier-2"] },
  { match: /premiership rugby|gallagher/i, primary: ["tnt-1"],         secondary: ["tnt-2"] },
  { match: /champions cup.*rugby|rugby.*champions cup|epcr/i, primary: ["tnt-2"], secondary: [] },
  { match: /challenge cup.*rugby|rugby.*challenge cup/i, primary: ["tnt-2"], secondary: [] },
  { match: /world rugby|rugby world cup/i, primary: ["itv-1"],         secondary: [] },

  // RUGBY LEAGUE
  { match: /super league/i,               primary: ["sky-arena"],      secondary: ["sky-action", "bbc-two"] },
  { match: /challenge cup(?!.*rugby)/i,   primary: ["bbc-one"],        secondary: ["bbc-two"] }, // RL Challenge Cup
  { match: /\bnrl\b/i,                    primary: ["sky-arena"],      secondary: [] },
  { match: /state of origin/i,            primary: ["sky-arena"],      secondary: [] },

  // FORMULA 1 & MOTORSPORT
  { match: /formula 1|f1\b|grand prix/i,  primary: ["sky-f1"],         secondary: ["sky-main-event", "channel-4"] },
  { match: /motogp/i,                     primary: ["tnt-4"],          secondary: ["tnt-2"] },
  { match: /world rally|\bwrc\b/i,        primary: ["tnt-2"],          secondary: [] },
  { match: /\bbtcc\b|british touring/i,   primary: ["itv-4"],          secondary: [] },
  { match: /\bnascar\b/i,                 primary: ["premier-1"],      secondary: [] },
  { match: /indycar/i,                    primary: ["sky-f1"],         secondary: [] },
  { match: /world superbike|wsbk/i,       primary: ["tnt-2"],          secondary: [] },
  { match: /le mans|world endurance/i,    primary: ["eurosport-1"],    secondary: [] },
  { match: /british gt|british speedway/i, primary: ["premier-2"],     secondary: [] },

  // TENNIS
  { match: /wimbledon/i,                  primary: ["bbc-one"],        secondary: ["bbc-two", "bbc-iplayer-live"] },
  { match: /roland garros|french open/i,  primary: ["tnt-2"],          secondary: ["tnt-3", "eurosport-1"] },
  { match: /us open.*tennis|tennis.*us open/i, primary: ["sky-tennis"], secondary: ["sky-main-event"] },
  { match: /australian open/i,            primary: ["eurosport-1"],    secondary: ["eurosport-2"] },
  { match: /atp finals|wta finals/i,      primary: ["sky-tennis"],     secondary: [] },
  { match: /queen.?s.*club|cinch champ/i, primary: ["sky-tennis"],     secondary: ["bbc-two"] },
  { match: /geneva open|atp\b|wta\b/i,    primary: ["sky-tennis"],     secondary: [] },

  // GOLF
  { match: /the open|open championship/i, primary: ["sky-golf"],       secondary: ["sky-main-event", "bbc-two"] },
  { match: /masters|us masters/i,         primary: ["sky-golf"],       secondary: ["sky-main-event", "bbc-two"] },
  { match: /us open.*golf|golf.*us open/i, primary: ["sky-golf"],      secondary: [] },
  { match: /pga championship/i,           primary: ["sky-golf"],       secondary: [] },
  { match: /ryder cup/i,                  primary: ["sky-golf"],       secondary: ["sky-main-event"] },
  { match: /dp world tour|european tour/i, primary: ["sky-golf"],      secondary: [] },
  { match: /pga tour/i,                   primary: ["sky-golf"],       secondary: [] },
  { match: /charles schwab|bmw pga/i,     primary: ["sky-golf"],       secondary: [] },

  // BOXING & MMA
  { match: /matchroom|dazn fight/i,       primary: ["dazn"],           secondary: [] },
  { match: /queensberry|frank warren/i,   primary: ["tnt-1"],          secondary: [] },
  { match: /world title.*boxing|boxing.*world title|heavyweight/i, primary: ["tnt-1"], secondary: ["dazn", "sky-main-event"] },
  { match: /\bufc\b/i,                    primary: ["tnt-1"],          secondary: ["tnt-2"] },
  { match: /bellator/i,                   primary: ["bbc-iplayer-live"], secondary: [] },

  // NFL & US SPORTS
  { match: /\bnfl\b|super bowl/i,         primary: ["sky-main-event"], secondary: ["sky-action", "itv-1"] },
  { match: /thursday night football/i,    primary: ["amazon"],         secondary: [] },
  { match: /\bnba\b/i,                    primary: ["sky-mix"],        secondary: ["sky-main-event"] },
  { match: /\bmlb\b|major league baseball/i, primary: ["bt-sport", "tnt-1"], secondary: [] },
  { match: /\bnhl\b/i,                    primary: ["premier-1"],      secondary: [] },

  // HORSE RACING & DARTS & SNOOKER
  { match: /royal ascot/i,                primary: ["itv-1"],          secondary: ["itv-4"] },
  { match: /cheltenham|grand national|aintree/i, primary: ["itv-1"],   secondary: ["itv-4"] },
  { match: /horse racing/i,               primary: ["itv-4"],          secondary: ["sky-main-event"] },
  { match: /world darts|world matchplay/i, primary: ["sky-action"],    secondary: ["sky-arena"] },
  { match: /premier league darts/i,       primary: ["sky-action"],     secondary: ["sky-arena"] },
  { match: /world snooker|crucible/i,     primary: ["bbc-two"],        secondary: ["bbc-one", "eurosport-1"] },
  { match: /uk championship.*snooker|masters.*snooker/i, primary: ["bbc-two"], secondary: ["eurosport-1"] }
];

// Returns the rights entry that best matches the competition, or null. Longer
// pattern strings win ties so "Champions League" wins over "League".
export function resolveRights(competition) {
  if (!competition) return null;
  let best = null;
  let bestLen = 0;
  for (const r of RIGHTS) {
    if (r.match.test(competition)) {
      const len = r.match.source.length;
      if (len > bestLen) {
        best = r;
        bestLen = len;
      }
    }
  }
  return best;
}
