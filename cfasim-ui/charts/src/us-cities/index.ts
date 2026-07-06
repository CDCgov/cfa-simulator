import type { CityMarker } from "../ChoroplethMap/cityLayout.js";
import { usCities } from "./data.js";

/**
 * A US city record from the bundled Natural Earth dataset. `population` is an
 * approximate estimate used only for ranking; it is never displayed.
 */
export interface UsCity {
  /** City name, e.g. `"Austin"`. */
  name: string;
  /** `[longitude, latitude]`. */
  coordinates: [number, number];
  /** Approximate population (Natural Earth `POP_MAX`), used for ranking. */
  population: number;
  /** 2-digit state FIPS code, e.g. `"48"` for Texas. */
  stateFips: string;
  /** 2-letter USPS abbreviation, e.g. `"TX"`. */
  stateAbbr: string;
  /** True for a state capital (or the national capital). */
  capital: boolean;
  /** True only for Washington, DC. */
  nationalCapital: boolean;
}

export { usCities };

/** Options shared by the marker selectors. */
export interface CityMarkerOptions {
  /** Maximum number of non-capital cities to include. */
  limit?: number;
  /**
   * Assign a per-city `minZoom` by population rank (default `true`) so cities
   * reveal progressively as you zoom in. Set `false` for a flat layer where
   * every city shares the map's `citiesMinZoom`.
   */
  tiered?: boolean;
}

// Progressive level-of-detail: bigger cities (lower 0-based population rank)
// get a smaller minZoom, so they appear first and more reveal as you zoom in.
// Thresholds line up with the map's double-click zoom levels (k = 1, 2, 4, 8).
function rankMinZoom(rank: number): number {
  if (rank < 6) return 1; // biggest — visible at the base overview
  if (rank < 20) return 2; // one zoom level in
  if (rank < 45) return 4; // two levels
  return 8; // three levels
}

const byPopulation = (a: UsCity, b: UsCity) => b.population - a.population;

// Build markers from `capitals` (always shown) followed by `rest` (ordered by
// population). When tiered, capitals get minZoom 1 and each non-capital gets a
// tier from its *own* 0-based rank among the non-capitals — not its index in
// the combined list, which would be shifted by the prepended capitals.
function toMarkers(
  capitals: UsCity[],
  rest: UsCity[],
  tiered: boolean,
): CityMarker[] {
  const cap = capitals.map((c) => {
    const m: CityMarker = {
      name: c.name,
      coordinates: c.coordinates,
      capital: true,
    };
    if (tiered) m.minZoom = 1;
    return m;
  });
  const others = rest.map((c, rank) => {
    const m: CityMarker = {
      name: c.name,
      coordinates: c.coordinates,
      capital: false,
    };
    if (tiered) m.minZoom = rankMinZoom(rank);
    return m;
  });
  return [...cap, ...others];
}

/**
 * Markers for the national map: Washington, DC (starred) plus the `limit`
 * most-populous US cities as plain dots — state capitals are *not* starred at
 * the national level, only DC is. Pass directly to `<ChoroplethMap :cities>`.
 *
 * By default (`tiered`) each city also gets a `minZoom` by population rank, so
 * on a zoomable map the biggest cities show first and more reveal as you zoom
 * in (the capital always shows). Pass `{ tiered: false }` for a flat layer.
 */
export function nationalCityMarkers(
  options: CityMarkerOptions = {},
): CityMarker[] {
  const { limit = 100, tiered = true } = options;
  const dc = usCities.filter((c) => c.nationalCapital);
  const rest = usCities
    .filter((c) => !c.nationalCapital)
    .sort(byPopulation)
    .slice(0, limit);
  // Nationally only the national capital gets a star; everything else is a dot.
  return toMarkers(dc, rest, tiered);
}

/**
 * Markers for a single-state map: that state's capital (starred) plus its
 * most-populous cities, capital first. `stateFips` is the 2-digit FIPS code.
 * Tiered by population like `nationalCityMarkers` (the capital always shows);
 * pass `{ tiered: false }` to opt out.
 */
export function stateCityMarkers(
  stateFips: string,
  options: CityMarkerOptions = {},
): CityMarker[] {
  const { limit = 25, tiered = true } = options;
  const fips = String(stateFips).padStart(2, "0");
  const inState = usCities.filter((c) => c.stateFips === fips);
  const capitals = inState.filter((c) => c.capital);
  const rest = inState
    .filter((c) => !c.capital)
    .sort(byPopulation)
    .slice(0, limit);
  return toMarkers(capitals, rest, tiered);
}
