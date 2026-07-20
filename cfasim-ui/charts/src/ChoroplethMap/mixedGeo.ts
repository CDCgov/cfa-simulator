// Mixed-level geography for ChoroplethMap: render most of the map at the base
// `geoType` while a few states render at a different level — a county map where
// California is one merged shape (a single state-level estimate), or a state map
// where New York is broken out into its counties.
//
// The unit of substitution is always a whole state: a data row that declares a
// `geoType` other than the base marks its state, and that state's entire area is
// re-tiled at the row's level. That keeps the map a partition of the same
// territory (no gaps, no double-painted areas) whichever direction you mix in.
//
// Kept free of Vue/DOM/topojson so it can be unit tested in isolation.

import type { GeoType } from "./ChoroplethMap.vue";

/** Minimal shape of the GeoJSON features this module shuffles around. */
export interface MixFeature {
  id?: string | number | null;
  properties?: { name?: string } | null;
}

/** id → feature and name → id indexes for one geographic level. */
export interface LevelLookup<F extends MixFeature = MixFeature> {
  byId: Map<string, F>;
  byName: Map<string, string>;
}

/**
 * Lazily resolves the lookup for a level, so a map that never mixes never pays
 * to index the levels it doesn't render. Returns null when the topology can't
 * supply that level (e.g. "counties" from a states-only topology, or "hsas"
 * before the lazy HSA chunk loads).
 */
export type LevelResolver<F extends MixFeature = MixFeature> = (
  level: GeoType,
) => LevelLookup<F> | null;

/** Digits in a fully-qualified id at each level ("06" / "06075"). */
const ID_WIDTH: Record<GeoType, number> = { states: 2, counties: 5, hsas: 6 };

/**
 * 2-digit state FIPS a feature id belongs to, or null when it can't be
 * determined. States and counties carry it as their first two digits; HSA
 * codes need the FIPS→HSA table (inverted into `hsaToState`), because an HSA
 * code isn't state-prefixed. No HSA spans two states, so the mapping is total.
 */
export function stateOfId(
  level: GeoType,
  id: string,
  hsaToState?: ReadonlyMap<string, string> | null,
): string | null {
  if (level === "hsas") return hsaToState?.get(id) ?? null;
  const padded = id.padStart(ID_WIDTH[level], "0");
  return /^\d{2}/.test(padded) ? padded.slice(0, 2) : null;
}

/** Resolves a user-supplied id (code or feature name) to a canonical feature id. */
function canonicalId(
  rawId: string,
  level: GeoType,
  lookup: LevelLookup,
): string | null {
  if (lookup.byId.has(rawId)) return rawId;
  const padded = rawId.padStart(ID_WIDTH[level], "0");
  if (lookup.byId.has(padded)) return padded;
  return lookup.byName.get(rawId) ?? null;
}

/** A `data` row as far as mixing is concerned. */
export interface MixRow {
  id: string;
  geoType?: GeoType;
}

export interface OverrideResolution {
  /** state FIPS → the level that state renders at. */
  overrides: Map<string, GeoType>;
  /** Row ids whose state couldn't be resolved (bad id, or level unavailable). */
  unresolved: string[];
  /**
   * Row ids that named an already-claimed state at a different level. The first
   * row wins; these are reported so the caller can warn.
   */
  conflicts: string[];
}

/**
 * Collects the per-state level overrides implied by `rows`. Rows without a
 * `geoType`, or whose `geoType` matches the base map, are plain data and are
 * ignored here.
 */
export function resolveGeoOverrides(
  rows: readonly MixRow[] | undefined,
  baseGeoType: GeoType,
  getLevel: LevelResolver,
  hsaToState?: ReadonlyMap<string, string> | null,
): OverrideResolution {
  const overrides = new Map<string, GeoType>();
  const unresolved: string[] = [];
  const conflicts: string[] = [];
  if (!rows) return { overrides, unresolved, conflicts };

  for (const row of rows) {
    const level = row.geoType;
    if (!level || level === baseGeoType) continue;
    const lookup = getLevel(level);
    if (!lookup) {
      unresolved.push(row.id);
      continue;
    }
    const id = canonicalId(row.id, level, lookup);
    const fips = id == null ? null : stateOfId(level, id, hsaToState);
    if (!fips) {
      unresolved.push(row.id);
      continue;
    }
    const claimed = overrides.get(fips);
    if (claimed == null) overrides.set(fips, level);
    else if (claimed !== level) conflicts.push(row.id);
  }
  return { overrides, unresolved, conflicts };
}

/**
 * Serializes overrides into a comparable key. The caller derives the override
 * map from this string so its identity only changes when the *set* of overrides
 * does — otherwise every `data` update would rebuild the whole feature tree.
 */
export function serializeOverrides(overrides: Map<string, GeoType>): string {
  return [...overrides]
    .map(([fips, level]) => `${fips}:${level}`)
    .sort()
    .join(",");
}

/** Inverse of `serializeOverrides`. */
export function parseOverrides(key: string): Map<string, GeoType> {
  const map = new Map<string, GeoType>();
  if (!key) return map;
  for (const part of key.split(",")) {
    const [fips, level] = part.split(":");
    map.set(fips, level as GeoType);
  }
  return map;
}

export interface MixedFeatures<F extends MixFeature> {
  features: F[];
  /**
   * Feature id → level, for substituted features only. Ids absent from the map
   * render at the base `geoType`.
   */
  levelById: Map<string, GeoType>;
}

/**
 * Replaces every overridden state's base features with that state's features at
 * the override level. Returns `base` untouched when there's nothing to mix, so
 * the common case costs one `size` check.
 *
 * `scopeFips` mirrors the map's single-state mode: substituted features outside
 * the scoped state are dropped, exactly as the base set already is.
 */
export function mixFeatures<F extends MixFeature>(
  base: readonly F[],
  baseGeoType: GeoType,
  overrides: Map<string, GeoType>,
  getLevel: LevelResolver<F>,
  hsaToState?: ReadonlyMap<string, string> | null,
  scopeFips?: string | null,
): MixedFeatures<F> {
  const levelById = new Map<string, GeoType>();
  if (overrides.size === 0) return { features: base as F[], levelById };

  // Collect the replacements first: a state is only cut out of the base once
  // something is standing by to cover it, so a level that isn't ready yet (the
  // lazy HSA chunk) leaves the base map intact instead of punching a hole.
  const substitutes: F[] = [];
  const replaced = new Set<string>();
  for (const [fips, level] of overrides) {
    if (scopeFips && fips !== scopeFips) continue;
    const lookup = getLevel(level);
    if (!lookup) continue;
    const forState: F[] = [];
    for (const [id, f] of lookup.byId) {
      if (stateOfId(level, id, hsaToState) !== fips) continue;
      forState.push(f);
      levelById.set(id, level);
    }
    if (!forState.length) continue;
    replaced.add(fips);
    substitutes.push(...forState);
  }
  if (!replaced.size) return { features: base as F[], levelById };

  const features = base.filter((f) => {
    const fips = stateOfId(baseGeoType, String(f.id), hsaToState);
    return !(fips && replaced.has(fips));
  });
  features.push(...substitutes);
  return { features, levelById };
}
