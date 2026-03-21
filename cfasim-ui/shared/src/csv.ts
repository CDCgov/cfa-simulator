import type { ModelOutput } from "./ModelOutput.js";

export function modelOutputToCSV(output: ModelOutput): string {
  const header = output.names.join(",");
  const rows: string[] = [header];
  for (let r = 0; r < output.length; r++) {
    const cells: string[] = [];
    for (let c = 0; c < output.columns.length; c++) {
      const desc = output.columns[c];
      const val = output.buffers[c][r];
      if (desc.type === "enum") {
        cells.push(desc.enumLabels![val as number]);
      } else if (desc.type === "bool") {
        cells.push(val ? "true" : "false");
      } else {
        cells.push(String(val));
      }
    }
    rows.push(cells.join(","));
  }
  return rows.join("\n");
}
