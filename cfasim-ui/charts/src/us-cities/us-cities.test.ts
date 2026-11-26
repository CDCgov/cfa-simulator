import { describe, it, expect } from "vitest";
import { nationalCityMarkers, stateCityMarkers } from "./index.js";

describe("us-cities markers", () => {
  it("nationalCityMarkers starts with DC, honors limit, and assigns monotonic minZoom", () => {
    const markers = nationalCityMarkers({ limit: 10 });
    expect(markers).toHaveLength(11);
    expect(markers[0].capital).toBe(true);
    expect(markers[0].name).toMatch(/Washington/);
    expect(markers[0].minZoom).toBe(1);
    for (let idx = 1; idx < markers.length; idx++) {
      expect(markers[idx].minZoom!).toBeGreaterThanOrEqual(
        markers[idx - 1].minZoom!,
      );
    }
    const flat = nationalCityMarkers({ limit: 5, tiered: false });
    expect(flat.every((city) => city.minZoom === undefined)).toBe(true);
  });

  it("stateCityMarkers puts state capital first and accepts unpadded FIPS", () => {
    const texas = stateCityMarkers("48");
    expect(texas[0].name).toBe("Austin");
    expect(texas[0].capital).toBe(true);
    expect(stateCityMarkers("6").map((city) => city.name)).toEqual(
      stateCityMarkers("06").map((city) => city.name),
    );
  });
});
