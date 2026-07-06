// Regenerates src/us-cities/data.ts from Natural Earth populated places.
//
// Source: Natural Earth 10m Populated Places (public domain), via the nvkelso
// natural-earth-vector mirror. Natural Earth data carries a population estimate
// (POP_MAX) and a capital classification (FEATURECLA), which is all we need.
//
// Run from the charts package root:  node scripts/generate-us-cities.mjs
// Optionally pass a local geojson path or URL as argv[2].
//
// The committed output (src/us-cities/data.ts) is what ships; this script is a
// dev-time regeneration tool and is never run at build.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const DEFAULT_SOURCE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson";

// State capitals whose Natural Earth population estimate is small enough that
// they'd otherwise be dropped are kept regardless. Beyond capitals, we keep the
// top N most-populous non-capital cities so the national view has ~100 points.
const TOP_NON_CAPITAL = 100;

// 2-letter USPS abbreviations, keyed by the state name us-atlas uses.
const STATE_ABBR = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  "District of Columbia": "DC",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
};

// name -> 2-digit FIPS, from us-atlas (already a devDependency).
function buildNameToFips() {
  const states = require("us-atlas/states-10m.json");
  const map = new Map();
  for (const g of states.objects.states.geometries) {
    map.set(g.properties.name, String(g.id).padStart(2, "0"));
  }
  return map;
}

// Property keys differ in case between the full file (UPPERCASE) and the
// "_simple" variant (lowercase); read case-insensitively.
function prop(props, key) {
  if (key in props) return props[key];
  const upper = key.toUpperCase();
  if (upper in props) return props[upper];
  const lower = key.toLowerCase();
  if (lower in props) return props[lower];
  return undefined;
}

async function loadGeojson(source) {
  if (/^https?:/.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`fetch ${source} -> ${res.status}`);
    return res.json();
  }
  // Parse the file ourselves — require() routes a .geojson extension through
  // the CommonJS .js loader and throws on the JSON body.
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(resolve(process.cwd(), source), "utf8"));
}

async function main() {
  const source = process.argv[2] ?? DEFAULT_SOURCE;
  console.error(`Loading ${source} …`);
  const geo = await loadGeojson(source);
  const nameToFips = buildNameToFips();

  const rows = [];
  for (const f of geo.features ?? []) {
    const props = f.properties ?? {};
    if (prop(props, "ADM0_A3") !== "USA") continue;

    const featurecla = String(prop(props, "FEATURECLA") ?? "");
    const nationalCapital = featurecla === "Admin-0 capital";
    const capital = featurecla === "Admin-1 capital" || nationalCapital;

    const stateName = String(prop(props, "ADM1NAME") ?? "");
    const stateFips = nameToFips.get(stateName);
    if (!stateFips) continue; // territories / unmatched admin-1 -> skip

    // Natural Earth names carry stray double spaces and abbreviate "Fort".
    const name = String(prop(props, "NAME") ?? "")
      .replace(/\s+/g, " ")
      .replace(/^Ft\. /, "Fort ")
      .trim();
    if (!name) continue;

    const coords = f.geometry?.coordinates ?? [
      Number(prop(props, "LONGITUDE")),
      Number(prop(props, "LATITUDE")),
    ];
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    const population = Math.max(
      0,
      Math.round(Number(prop(props, "POP_MAX") ?? 0)),
    );

    rows.push({
      name,
      // Round coordinates to keep the committed file compact; ~5 decimals is
      // sub-meter and far finer than the map ever renders.
      coordinates: [Number(lng.toFixed(4)), Number(lat.toFixed(4))],
      population,
      stateFips,
      stateAbbr: STATE_ABBR[stateName] ?? "",
      capital,
      nationalCapital,
    });
  }

  // De-duplicate (name + state); keep the higher-population / capital entry.
  const byKey = new Map();
  for (const r of rows) {
    const key = `${r.name}|${r.stateFips}`;
    const prev = byKey.get(key);
    if (
      !prev ||
      r.population > prev.population ||
      (r.capital && !prev.capital)
    ) {
      byKey.set(key, {
        ...prev,
        ...r,
        // Keep the larger population and the capital flag if either had it, so
        // a lower-population capital duplicate can't understate the city.
        population: Math.max(prev?.population ?? 0, r.population),
        capital: Boolean(r.capital || prev?.capital),
      });
    }
  }
  const deduped = [...byKey.values()];

  // Keep every capital, plus the top-N non-capital cities by population.
  const capitals = deduped.filter((r) => r.capital);
  const nonCapitals = deduped
    .filter((r) => !r.capital)
    .sort((a, b) => b.population - a.population)
    .slice(0, TOP_NON_CAPITAL);

  const kept = [...capitals, ...nonCapitals].sort(
    (a, b) => b.population - a.population || a.name.localeCompare(b.name),
  );

  const capitalCount = kept.filter((r) => r.capital).length;
  console.error(
    `Kept ${kept.length} cities (${capitalCount} capitals incl. DC, ` +
      `${kept.length - capitalCount} other).`,
  );

  const raw =
    `// AUTO-GENERATED by scripts/generate-us-cities.mjs — do not edit by hand.\n` +
    `//\n` +
    `// Source: Natural Earth 10m Populated Places (public domain).\n` +
    `// https://www.naturalearthdata.com/ — no rights reserved.\n` +
    `//\n` +
    `// POP_MAX is an approximate (metro-ish) estimate used only for ranking;\n` +
    `// labels never display population.\n\n` +
    `import type { UsCity } from "./index.js";\n\n` +
    `export const usCities: UsCity[] = ${JSON.stringify(kept, null, 2)};\n`;

  const dest = resolve(__dirname, "../src/us-cities/data.ts");
  // Run through the repo's prettier config so the committed file stays stable
  // and passes `plz format` without a manual fix step.
  const prettier = await import("prettier");
  const config = (await prettier.resolveConfig(dest)) ?? {};
  const out = await prettier.format(raw, {
    ...config,
    parser: "typescript",
  });
  await writeFile(dest, out);
  console.error(`Wrote ${dest}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
