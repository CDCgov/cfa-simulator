import { describe, it, expect } from "vitest";
import { usCities, nationalCityMarkers, stateCityMarkers } from "./index.js";

describe("usCities dataset", () => {
  it("includes Washington, DC flagged as the national capital", () => {
    const dc = usCities.find((c) => c.nationalCapital);
    expect(dc).toBeTruthy();
    expect(dc!.name).toMatch(/Washington/);
    expect(dc!.capital).toBe(true);
    expect(dc!.stateFips).toBe("11");
  });

  it("has exactly one capital per state (50 states + DC)", () => {
    const capitalFips = new Set(
      usCities.filter((c) => c.capital).map((c) => c.stateFips),
    );
    expect(capitalFips.size).toBe(51);
  });

  it("gives every record a boolean capital flag and [lng, lat] coordinates", () => {
    for (const c of usCities) {
      expect(typeof c.capital).toBe("boolean");
      expect(c.coordinates).toHaveLength(2);
      const [lng, lat] = c.coordinates;
      expect(lng).toBeGreaterThanOrEqual(-180);
      expect(lng).toBeLessThanOrEqual(-60); // US longitudes are negative
      expect(lat).toBeGreaterThan(15);
      expect(lat).toBeLessThan(72);
    }
  });
});

describe("nationalCityMarkers", () => {
  it("starts with DC (capital) and then top cities by population", () => {
    const markers = nationalCityMarkers();
    expect(markers[0].capital).toBe(true);
    expect(markers[0].name).toMatch(/Washington/);
    // DC + up to 100 others.
    expect(markers.length).toBeLessThanOrEqual(101);
    expect(markers.length).toBeGreaterThan(50);
  });

  it("stars only DC nationally, not populous state capitals", () => {
    const stars = nationalCityMarkers().filter((m) => m.capital);
    expect(stars).toHaveLength(1);
    expect(stars[0].name).toMatch(/Washington/);
  });

  it("honours the limit option", () => {
    const markers = nationalCityMarkers({ limit: 10 });
    expect(markers.length).toBe(11); // DC + 10
  });

  it("returns markers shaped for the ChoroplethMap `cities` prop", () => {
    // Tiered by default → includes minZoom; the flat form is just the core keys.
    const [tieredFirst] = nationalCityMarkers();
    expect(Object.keys(tieredFirst).sort()).toEqual(
      ["capital", "coordinates", "minZoom", "name"].sort(),
    );
    const [flatFirst] = nationalCityMarkers({ tiered: false });
    expect(Object.keys(flatFirst).sort()).toEqual(
      ["capital", "coordinates", "name"].sort(),
    );
  });
});

describe("stateCityMarkers", () => {
  it("puts the state capital first and only returns in-state cities", () => {
    // Texas FIPS 48 — capital Austin.
    const markers = stateCityMarkers("48");
    expect(markers[0].capital).toBe(true);
    expect(markers[0].name).toBe("Austin");
    // Every returned city belongs to Texas.
    const txNames = new Set(
      usCities.filter((c) => c.stateFips === "48").map((c) => c.name),
    );
    for (const m of markers) expect(txNames.has(m.name)).toBe(true);
  });

  it("accepts an unpadded FIPS code", () => {
    const padded = stateCityMarkers("06");
    const unpadded = stateCityMarkers("6");
    expect(unpadded.map((m) => m.name)).toEqual(padded.map((m) => m.name));
  });

  it("returns just the capital for a state with a single mapped city", () => {
    // Vermont FIPS 50 — Montpelier is the only Natural Earth entry.
    const markers = stateCityMarkers("50");
    expect(markers.length).toBeGreaterThanOrEqual(1);
    expect(markers[0].name).toBe("Montpelier");
    expect(markers[0].capital).toBe(true);
  });
});

describe("progressive minZoom tiers", () => {
  it("assigns a per-city minZoom by population rank, with the capital at 1", () => {
    const markers = nationalCityMarkers();
    expect(markers.every((c) => typeof c.minZoom === "number")).toBe(true);
    expect(markers.find((c) => c.capital)!.minZoom).toBe(1);
    const base = markers.filter((c) => c.minZoom === 1).length;
    const deepest = Math.max(...markers.map((c) => c.minZoom!));
    // Some cities show at the base overview, the rest reveal deeper in.
    expect(base).toBeGreaterThan(0);
    expect(base).toBeLessThan(markers.length);
    expect(deepest).toBeGreaterThan(1);
    // minZoom is non-decreasing down the (population-ordered) list.
    for (let i = 1; i < markers.length; i++) {
      expect(markers[i].minZoom!).toBeGreaterThanOrEqual(
        markers[i - 1].minZoom!,
      );
    }
  });

  it("omits minZoom when tiered is false", () => {
    const markers = nationalCityMarkers({ tiered: false });
    expect(markers.every((c) => c.minZoom === undefined)).toBe(true);
  });

  it("tiers a state's cities too, capital always at the base level", () => {
    const tx = stateCityMarkers("48");
    expect(tx[0].capital).toBe(true);
    expect(tx[0].minZoom).toBe(1);
    expect(Math.max(...tx.map((c) => c.minZoom!))).toBeGreaterThanOrEqual(1);
  });
});
