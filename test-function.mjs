// Local smoke test for the EPG proxy function.
// Usage: NODE_TLS_REJECT_UNAUTHORIZED=0 node test-function.mjs
//
// (TLS flag works around corporate-proxy MITM on Anthony's Windows machine —
// see lessons.md 2026-05-25 SportFinder Phase 1 #4.)

import handler from "./netlify/functions/epg-proxy.mjs";

const start = Date.now();
const req = new Request("https://example.com/api/epg?debug=1");
const res = await handler(req);
const body = await res.json();
const elapsed = ((Date.now() - start) / 1000).toFixed(2);

console.log(`\n=== Proxy returned in ${elapsed}s ===\n`);
console.log(`Date stamp:          ${body.dateStamp}`);
console.log(`Channels returned:   ${body.channelsReturned}`);
console.log(`Channels with data:  ${body.channelsOk}`);
console.log(`Total programmes:    ${body.totalProgrammes}`);
console.log(`\nSources:`);
console.log(`  Sky API channels OK:  ${body.sources.skyChannelsOk}`);
console.log(`  EPG.pw channels OK:   ${body.sources.epgPwChannelsOk}`);
console.log(`  Fixtures fetched:     ${body.sources.fixturesFetched}`);
console.log(`  Fixtures injected:    ${body.sources.fixturesInjected}`);

console.log(`\nPer-channel summary:`);
console.log(`  channel-id              source     programmes`);
console.log(`  ----------------------  ---------  ----------`);
for (const row of body.debug.perChannelSummary) {
  const id = row.id.padEnd(22);
  const src = (row.source || "—").padEnd(9);
  console.log(`  ${id}  ${src}  ${row.programmes}`);
}

// Pull out a few sample programmes from each kind of source.
const skyExample = body.channels.find(c => c.source === "sky" && c.programmes.length);
const pwExample = body.channels.find(c => c.source === "epg.pw" && c.programmes.length);
const rightsExample = body.channels.find(c => c.source === "rights" && c.programmes.length);
const blackouts = body.channels.flatMap(c => c.programmes.filter(p => p.blacked).map(p => ({ ch: c.channelId, ...p })));

console.log(`\nSample Sky-sourced programme (${skyExample?.channelId || "n/a"}):`);
if (skyExample) {
  const p = skyExample.programmes.find(x => /live|grand prix|cup|final|premier|champ/i.test(x.title)) || skyExample.programmes[0];
  console.log(`  ${p.start.slice(11,16)} - ${p.end.slice(11,16)} | ${p.title}`);
}

console.log(`\nSample EPG.pw-sourced programme (${pwExample?.channelId || "n/a"}):`);
if (pwExample) {
  const p = pwExample.programmes.find(x => /live|cup|final|premier|champ/i.test(x.title)) || pwExample.programmes[0];
  console.log(`  ${p.start.slice(11,16)} - ${p.end.slice(11,16)} | ${p.title}`);
}

console.log(`\nSample rights-injected programme (${rightsExample?.channelId || "n/a"}):`);
if (rightsExample) {
  const p = rightsExample.programmes[0];
  console.log(`  ${p.start.slice(11,16)} - ${p.end.slice(11,16)} | ${p.title}`);
  console.log(`  competition: ${p.competition} | sport: ${p.sport}`);
}

console.log(`\nBlackout flags raised: ${blackouts.length}`);
for (const b of blackouts.slice(0, 5)) {
  console.log(`  ${b.ch}: ${b.start.slice(11,16)} | ${b.title} | ${b.blackoutReason}`);
}

console.log(`\n=== Test done ===\n`);
