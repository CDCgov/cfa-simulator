// Regenerates src/us-hsa-topology/data.ts from us-atlas counties-10m.json.
//
// HSAs are unions of counties. ChoroplethMap can build them at runtime by
// merging county geometries through fipsToHsa, but that forces consumers to
// ship the full county topology (~824 KB). This script performs the merge at
// generation time instead: counties are grouped by HSA, each group is merged
// into one geometry stored in a new `objects.hsas` collection (id = 6-char
// HSA code, state FIPS + 4-digit HSA number), `objects.states` is kept
// unchanged for state borders and mixed-level maps, and arcs interior to an
// HSA are pruned. The result renders identically to the runtime merge at
// roughly half the size.
//
// Counties with no fipsToHsa entry are dropped: the island territories (PR,
// AS, GU, MP, VI), which geoAlbersUsa cannot project, and the five NYC
// boroughs, which the mapping currently lacks — the runtime merge skips all
// of them too, so rendering matches.
//
// Run from the charts package root:  node scripts/generate-us-hsa-topology.mjs
//
// The committed output (src/us-hsa-topology/data.ts) is what ships; this
// script is a dev-time regeneration tool and is never run at build.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { mergeArcs, quantize } from "topojson-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Matches the us-atlas quantization so the round-trip reproduces its grid.
const QUANTIZATION = 1e5;

// The only counties allowed to lack a fipsToHsa entry: the island territories
// (by state FIPS prefix) and the five NYC boroughs. Anything else dropping out
// means the mapping regressed, and silently emitting a holey map would slip
// past the equality tests (they derive expectations from the same inputs).
const TERRITORY_PREFIXES = new Set(["60", "66", "69", "72", "78"]);
const NYC_BOROUGHS = new Set(["36005", "36047", "36061", "36081", "36085"]);

/** Applies the topology's transform to every arc, making coordinates absolute. */
export function dequantize(topo) {
  if (!topo.transform) return topo;
  const { scale, translate } = topo.transform;
  topo.arcs = topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
    });
  });
  delete topo.transform;
  return topo;
}

/** Drops arcs no longer referenced by any geometry and reindexes the rest. */
export function pruneArcs(topo) {
  const used = new Set();
  const walk = (arcs) => {
    for (const a of arcs) {
      if (Array.isArray(a)) walk(a);
      else used.add(a < 0 ? ~a : a);
    }
  };
  for (const obj of Object.values(topo.objects)) {
    for (const g of obj.geometries) if (g.arcs) walk(g.arcs);
  }
  const remap = new Map();
  const newArcs = [];
  for (let i = 0; i < topo.arcs.length; i++) {
    if (used.has(i)) {
      remap.set(i, newArcs.length);
      newArcs.push(topo.arcs[i]);
    }
  }
  const rewrite = (arcs) =>
    arcs.map((a) =>
      Array.isArray(a) ? rewrite(a) : a < 0 ? ~remap.get(~a) : remap.get(a),
    );
  for (const obj of Object.values(topo.objects)) {
    for (const g of obj.geometries) if (g.arcs) g.arcs = rewrite(g.arcs);
  }
  topo.arcs = newArcs;
  return topo;
}

/**
 * Builds the pre-merged HSA topology from a us-atlas counties topology and
 * the county→HSA mapping. Pure, so tests can pin it against the runtime merge.
 */
export function buildHsaTopology(countiesTopo, fipsToHsa) {
  const topo = structuredClone(countiesTopo);

  const groups = new Map();
  const dropped = [];
  for (const geom of topo.objects.counties.geometries) {
    const fips = String(geom.id).padStart(5, "0");
    const hsaCode = fipsToHsa[fips];
    if (!hsaCode) {
      dropped.push(fips);
      continue;
    }
    if (hsaCode.slice(0, 2) !== fips.slice(0, 2)) {
      throw new Error(
        `HSA code ${hsaCode} is not prefixed with its county's state FIPS (${fips}); ` +
          `prefix-based state scoping would break`,
      );
    }
    if (!groups.has(hsaCode)) groups.set(hsaCode, []);
    groups.get(hsaCode).push(geom);
  }

  const unexpected = dropped.filter(
    (fips) =>
      !TERRITORY_PREFIXES.has(fips.slice(0, 2)) && !NYC_BOROUGHS.has(fips),
  );
  if (unexpected.length) {
    throw new Error(
      `counties unexpectedly missing from fipsToHsa: ${unexpected.join(", ")}`,
    );
  }

  const geometries = [];
  for (const [hsaCode, geoms] of groups) {
    const merged = mergeArcs(topo, geoms);
    merged.id = hsaCode;
    geometries.push(merged);
  }

  topo.objects = {
    hsas: { type: "GeometryCollection", geometries },
    // Kept as-is: shares the arc set and is needed for state borders,
    // mixed-level maps, and the `state` prop's name lookup.
    states: topo.objects.states,
  };
  pruneArcs(topo);
  // `bbox` is kept from the source topology so quantize reuses the exact
  // us-atlas grid, making the round-trip through dequantize lossless.
  return {
    topology: quantize(dequantize(topo), QUANTIZATION),
    hsaCount: geometries.length,
    dropped,
  };
}

async function main() {
  const countiesTopo = require("us-atlas/counties-10m.json");
  const { fipsToHsa } = await import("../src/ChoroplethMap/hsaMapping.ts");

  const { topology, hsaCount, dropped } = buildHsaTopology(
    countiesTopo,
    fipsToHsa,
  );
  console.log(
    `merged ${countiesTopo.objects.counties.geometries.length} counties into ` +
      `${hsaCount} HSAs (${dropped.length} unmapped counties dropped), ` +
      `arcs ${countiesTopo.arcs.length} -> ${topology.arcs.length}`,
  );

  const json = JSON.stringify(topology);
  // Emitted as a single-quoted string literal (JSON is double-quote heavy) and
  // parsed at module init: JSON.parse beats a giant object literal for both
  // V8 startup and tsc, and prettier/typecheck stay fast.
  const literal = json
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const out =
    "// Generated by scripts/generate-us-hsa-topology.mjs. Do not edit.\n" +
    "// Pre-merged US HSA topology derived from us-atlas counties-10m.json\n" +
    "// (public domain) and the fipsToHsa mapping. Parsed in index.ts.\n" +
    "// prettier-ignore\n" +
    `export const usHsaTopologyJson: string =\n  '${literal}';\n`;

  const dest = resolve(__dirname, "../src/us-hsa-topology/data.ts");
  await writeFile(dest, out);
  console.log(`wrote ${dest} (${(out.length / 1024).toFixed(0)} KB)`);
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
