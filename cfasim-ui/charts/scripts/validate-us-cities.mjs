// Correctness audit of the bundled city data — run after regenerating it to
// catch wrong-state assignments, bad capitals, dupes, or off coordinates.
// Reads the built dist, so build first. Not part of the build.
//   cd cfasim-ui/charts && pnpm run build && node scripts/validate-us-cities.mjs
// Validates every city is inside its claimed state (point-in-polygon vs
// us-atlas), each state capital + DC is correct, and metadata is consistent.
import { createRequire } from "node:module";
import { feature } from "topojson-client";
import { geoContains, geoDistance } from "d3-geo";
import { usCities } from "../dist/us-cities.js";

const require = createRequire(import.meta.url);
const statesTopo = require("us-atlas/states-10m.json");
const statesFc = feature(statesTopo, statesTopo.objects.states);
const byFips = new Map(
  statesFc.features.map((f) => [String(f.id).padStart(2, "0"), f]),
);
const nameByFips = new Map(
  statesTopo.objects.states.geometries.map((g) => [
    String(g.id).padStart(2, "0"),
    g.properties.name,
  ]),
);

// Canonical state capitals (source of truth) keyed by 2-digit FIPS.
const CAPITALS = {
  "01": "Montgomery",
  "02": "Juneau",
  "04": "Phoenix",
  "05": "Little Rock",
  "06": "Sacramento",
  "08": "Denver",
  "09": "Hartford",
  10: "Dover",
  11: "Washington",
  12: "Tallahassee",
  13: "Atlanta",
  15: "Honolulu",
  16: "Boise",
  17: "Springfield",
  18: "Indianapolis",
  19: "Des Moines",
  20: "Topeka",
  21: "Frankfort",
  22: "Baton Rouge",
  23: "Augusta",
  24: "Annapolis",
  25: "Boston",
  26: "Lansing",
  27: "Saint Paul",
  28: "Jackson",
  29: "Jefferson City",
  30: "Helena",
  31: "Lincoln",
  32: "Carson City",
  33: "Concord",
  34: "Trenton",
  35: "Santa Fe",
  36: "Albany",
  37: "Raleigh",
  38: "Bismarck",
  39: "Columbus",
  40: "Oklahoma City",
  41: "Salem",
  42: "Harrisburg",
  44: "Providence",
  45: "Columbia",
  46: "Pierre",
  47: "Nashville",
  48: "Austin",
  49: "Salt Lake City",
  50: "Montpelier",
  51: "Richmond",
  53: "Olympia",
  54: "Charleston",
  55: "Madison",
  56: "Cheyenne",
};

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/^st\s/, "saint ")
    .replace(/^ft\s/, "fort ")
    .replace(/\s+/g, " ")
    .replace(/ dc$/, "")
    .trim();

const problems = [];
const note = (sev, msg) => problems.push({ sev, msg });

// 1. Coordinate order + range.
for (const c of usCities) {
  const [lng, lat] = c.coordinates;
  if (!(lng >= -180 && lng <= -64))
    note("ERROR", `${c.name} (${c.stateAbbr}): lng out of US range: ${lng}`);
  if (!(lat >= 15 && lat <= 72))
    note("ERROR", `${c.name} (${c.stateAbbr}): lat out of US range: ${lat}`);
}

// 2. Duplicates (name + state).
const seen = new Set();
for (const c of usCities) {
  const k = `${norm(c.name)}|${c.stateFips}`;
  if (seen.has(k)) note("ERROR", `duplicate: ${c.name} (${c.stateAbbr})`);
  seen.add(k);
}

// 3. Capitals: exactly one per state (50 + DC), each matches canon.
const capByFips = new Map();
for (const c of usCities.filter((c) => c.capital)) {
  if (capByFips.has(c.stateFips))
    note(
      "ERROR",
      `two capitals for FIPS ${c.stateFips}: ${capByFips.get(c.stateFips)} & ${c.name}`,
    );
  capByFips.set(c.stateFips, c.name);
}
for (const [fips, canon] of Object.entries(CAPITALS)) {
  const got = capByFips.get(fips);
  if (!got)
    note(
      "ERROR",
      `missing capital for ${nameByFips.get(fips)} (${fips}); expected ${canon}`,
    );
  else if (norm(got) !== norm(canon))
    note(
      "ERROR",
      `wrong capital for ${nameByFips.get(fips)}: got "${got}", expected "${canon}"`,
    );
}
// nationalCapital only DC
for (const c of usCities.filter((c) => c.nationalCapital)) {
  if (c.stateFips !== "11")
    note("ERROR", `nationalCapital set on non-DC: ${c.name} (${c.stateAbbr})`);
}
const natCapCount = usCities.filter((c) => c.nationalCapital).length;
if (natCapCount !== 1)
  note("ERROR", `expected exactly 1 nationalCapital, got ${natCapCount}`);

// 4. stateAbbr↔stateFips consistency.
const abbrByFips = new Map();
for (const c of usCities) {
  if (
    abbrByFips.has(c.stateFips) &&
    abbrByFips.get(c.stateFips) !== c.stateAbbr
  )
    note(
      "ERROR",
      `FIPS ${c.stateFips} maps to two abbrs: ${abbrByFips.get(c.stateFips)} & ${c.stateAbbr}`,
    );
  abbrByFips.set(c.stateFips, c.stateAbbr);
  if (!c.stateAbbr) note("ERROR", `${c.name}: empty stateAbbr`);
}

// 5. Point-in-state: is each city actually inside its claimed state?
for (const c of usCities) {
  const claimed = byFips.get(c.stateFips);
  if (!claimed) {
    note("ERROR", `${c.name}: unknown FIPS ${c.stateFips}`);
    continue;
  }
  if (geoContains(claimed, c.coordinates)) continue;
  // Not inside — is it inside a DIFFERENT state (wrong assignment) or just
  // offshore near its claimed state (coastal coord, minor)?
  const other = statesFc.features.find(
    (f) => f !== claimed && geoContains(f, c.coordinates),
  );
  if (other) {
    note(
      "ERROR",
      `${c.name} claims ${c.stateAbbr} but coords fall in ${nameByFips.get(String(other.id).padStart(2, "0"))}`,
    );
  } else {
    // distance (km) from the claimed state's centroid — flag only if far.
    note(
      "WARN",
      `${c.name} (${c.stateAbbr}) coords are outside the state polygon (likely coastal/offshore): [${c.coordinates}]`,
    );
  }
}

// 6. Name hygiene.
for (const c of usCities) {
  if (/\s{2,}/.test(c.name)) note("WARN", `double space in name: "${c.name}"`);
  if (/^\s|\s$/.test(c.name))
    note("WARN", `leading/trailing space: "${c.name}"`);
}

console.log(`Audited ${usCities.length} cities.`);
const errs = problems.filter((p) => p.sev === "ERROR");
const warns = problems.filter((p) => p.sev === "WARN");
console.log(`\nERRORS (${errs.length}):`);
for (const p of errs) console.log("  ✗", p.msg);
console.log(`\nWARNINGS (${warns.length}):`);
for (const p of warns) console.log("  ⚠", p.msg);
if (!errs.length && !warns.length) console.log("  clean.");
