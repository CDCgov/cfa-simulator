import type { Topology } from "topojson-specification";
import { usHsaTopologyJson } from "./data.js";

/**
 * Pre-merged US Health Service Area topology, derived at generation time from
 * us-atlas `counties-10m.json` (public domain) and the county→HSA mapping.
 *
 * Contains `objects.hsas` (948 merged HSA geometries, ids are 6-char HSA
 * codes: state FIPS + 4-digit HSA number) and an unchanged `objects.states`.
 * Pass it as `<ChoroplethMap :topology>` with `geoType="hsas"` in place of a
 * counties topology — it renders identically to the runtime county merge at
 * roughly half the size, since intra-HSA county arcs are pre-merged away.
 *
 * Counties without an HSA mapping (the island territories, which geoAlbersUsa
 * cannot project, and the five NYC boroughs, which the mapping currently
 * lacks) are omitted, matching what the runtime merge renders. County-level
 * maps and `geoType: "counties"` data rows still require a counties topology.
 */
export const usHsaTopology: Topology = JSON.parse(
  usHsaTopologyJson,
) as Topology;
