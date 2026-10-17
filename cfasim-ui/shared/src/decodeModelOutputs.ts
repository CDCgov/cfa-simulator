import type { ColumnDescriptor } from "./ModelOutput.js";
import { COLUMN_TYPE_TO_CTOR, ModelOutput } from "./ModelOutput.js";

/**
 * Header of a `.cfasim` outputs file. The file is a little-endian u32 header
 * length, a UTF-8 JSON header (space-padded to an 8-byte boundary), then the
 * raw column buffers; `byteOffsets` are relative to the start of the buffers.
 */
export interface ModelOutputsFileTable {
  length: number;
  columns: ColumnDescriptor[];
  byteOffsets: number[];
  /** Unpadded byte length per column. */
  byteLengths: number[];
}

export interface ModelOutputsFileHeader {
  version: number;
  outputs: Record<string, ModelOutputsFileTable>;
}

function readModelOutputsHeader(buffer: ArrayBuffer): {
  header: ModelOutputsFileHeader;
  dataStart: number;
} {
  if (buffer.byteLength < 4) {
    throw new Error("outputs file is truncated (no header length)");
  }
  const headerLength = new DataView(buffer).getUint32(0, true);
  const dataStart = 4 + headerLength;
  if (dataStart > buffer.byteLength) {
    throw new Error("outputs file is truncated (header)");
  }
  const text = new TextDecoder().decode(
    new Uint8Array(buffer, 4, headerLength),
  );
  const header = JSON.parse(text) as ModelOutputsFileHeader;
  if (header.version !== 1) {
    throw new Error(`unsupported outputs file version ${header.version}`);
  }
  return { header, dataStart };
}

/**
 * Decode a `.cfasim` outputs file (as served by `GET /api/runs/{id}/outputs`
 * or read from disk) into named `ModelOutput` tables. Column buffers are
 * copied out of `buffer`, so the file bytes can be released afterwards.
 */
export function decodeModelOutputs(
  buffer: ArrayBuffer,
): Record<string, ModelOutput> {
  const { header, dataStart } = readModelOutputsHeader(buffer);
  const result: Record<string, ModelOutput> = {};
  for (const [name, table] of Object.entries(header.outputs)) {
    const buffers = table.columns.map((col, i) => {
      const bpe = COLUMN_TYPE_TO_CTOR[col.type]?.BYTES_PER_ELEMENT;
      if (bpe === undefined) {
        throw new Error(`column ${col.name} has unknown type ${col.type}`);
      }
      const start = dataStart + table.byteOffsets[i];
      const bytes = table.byteLengths[i];
      if (bytes !== table.length * bpe) {
        throw new Error(
          `column ${col.name} has ${bytes} bytes for ${table.length} rows`,
        );
      }
      if (start + bytes > buffer.byteLength) {
        throw new Error(`outputs file is truncated (column ${col.name})`);
      }
      return buffer.slice(start, start + bytes);
    });
    result[name] = ModelOutput.fromWire({
      __modelOutput: true,
      length: table.length,
      columns: table.columns,
      buffers,
    });
  }
  return result;
}
