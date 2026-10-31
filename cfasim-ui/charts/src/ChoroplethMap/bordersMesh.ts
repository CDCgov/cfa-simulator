// Decor meshes for ChoroplethMap (theme.countyBorders / theme.hsaBorders):
// both mesh the topology's county geometries, scoped to the selected state
// in single-state mode, differing only in which shared arcs the predicate
// keeps. Kept free of Vue so the filtering can be unit tested without
// rendering a county map.
import { mesh } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";

export const pad5 = (id: unknown) => String(id).padStart(5, "0");

/** Decides whether the arc shared by two counties is drawn. */
export type ArcPredicate = (aId: unknown, bId: unknown) => boolean;

export interface MeshCountiesOptions {
  /** State FIPS in single-state mode: only that state's counties are meshed. */
  scope?: string | null;
  /**
   * States re-tiled through `data[].geoType`. They are not tiled at the base
   * level, so the base-derived ruling would contradict their own feature
   * strokes: a state reported as one merged state-level shape stays unruled
   * inside.
   */
  overridden?: { has(state: string): boolean };
}

/**
 * Mesh the shared county arcs that `predicate` keeps. Null without a
 * `counties` object: a states-only or pre-merged HSA topology never draws
 * either decor mesh.
 */
export function meshCounties(
  topology: Topology | undefined,
  predicate: ArcPredicate,
  { scope, overridden }: MeshCountiesOptions = {},
): GeoJSON.MultiLineString | null {
  const counties = (
    topology as { objects?: { counties?: GeometryCollection } } | undefined
  )?.objects?.counties;
  if (!counties) return null;
  const geometries = counties.geometries.filter((g) => {
    const state = pad5(g.id).slice(0, 2);
    return (!scope || state === scope) && !overridden?.has(state);
  });
  return mesh(
    topology!,
    { type: "GeometryCollection", geometries } as GeometryCollection,
    (a, b) => a !== b && predicate(a.id, b.id),
  );
}

/**
 * County-boundary predicate (theme.countyBorders): only arcs interior to a
 * base feature (same group on both sides) are kept, so the base separators
 * keep their own stroke. An undefined group (a county with no HSA mapping)
 * is a hole in the base map and stays unruled rather than ruled over the
 * background wash.
 */
export function countyBordersPredicate(
  groupOf: (id: unknown) => string | undefined,
): ArcPredicate {
  return (aId, bId) => {
    const group = groupOf(aId);
    return group !== undefined && group === groupOf(bId);
  };
}

/**
 * HSA-boundary predicate (theme.hsaBorders): the county mesh's complement.
 * State-crossing arcs are excluded (they belong to the state layers); a
 * mapped-to-unmapped county edge IS an HSA exterior, so it draws.
 */
export function hsaBordersPredicate(
  table: Record<string, string | undefined>,
): ArcPredicate {
  return (aId, bId) => {
    const a = pad5(aId);
    const b = pad5(bId);
    if (a.slice(0, 2) !== b.slice(0, 2)) return false;
    return table[a] !== table[b];
  };
}
