import type { ColumnDescriptor, ModelOutputsWire } from "./ModelOutput.js";
import { ModelOutput } from "./ModelOutput.js";

interface ModelOutputsResponsePayload {
  outputs: Record<
    string,
    { length: number; columns: ColumnDescriptor[]; buffers: ArrayBuffer[] }
  >;
}

export interface TransferableResponse {
  id: number;
  result?: unknown;
  buffer?: ArrayBuffer;
  bufferType?: string;
  modelOutputs?: ModelOutputsResponsePayload;
  error?: string;
}

const TYPED_ARRAY_CONSTRUCTORS: Record<
  string,
  new (buffer: ArrayBuffer) => ArrayBufferView
> = {
  Int8Array,
  Uint8Array,
  Uint8ClampedArray,
  Int16Array,
  Uint16Array,
  Int32Array,
  Uint32Array,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
};

function isTypedArray(value: unknown): value is ArrayBufferView {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

export function postWithTransfer(
  port: typeof globalThis,
  id: number,
  result: unknown,
): void {
  if (result instanceof ArrayBuffer) {
    port.postMessage(
      {
        id,
        buffer: result,
        bufferType: "ArrayBuffer",
      } satisfies TransferableResponse,
      { transfer: [result] },
    );
  } else if (isTypedArray(result)) {
    const buffer = result.buffer as ArrayBuffer;
    port.postMessage(
      {
        id,
        buffer,
        bufferType: result.constructor.name,
      } satisfies TransferableResponse,
      { transfer: [buffer] },
    );
  } else {
    port.postMessage({ id, result } satisfies TransferableResponse);
  }
}

export function postModelOutputsWithTransfer(
  port: typeof globalThis,
  id: number,
  wire: ModelOutputsWire,
): void {
  const transferList: ArrayBuffer[] = [];
  const outputs: ModelOutputsResponsePayload["outputs"] = {};

  for (const [key, outputWire] of Object.entries(wire.outputs)) {
    outputs[key] = {
      length: outputWire.length,
      columns: outputWire.columns,
      buffers: outputWire.buffers,
    };
    transferList.push(...outputWire.buffers);
  }

  port.postMessage(
    { id, modelOutputs: { outputs } } satisfies TransferableResponse,
    { transfer: transferList },
  );
}

export function postErrorWithTransfer(
  port: typeof globalThis,
  id: number,
  error: unknown,
): void {
  port.postMessage({
    id,
    error: error instanceof Error ? error.message : String(error),
  } satisfies TransferableResponse);
}

export function unwrapResponse(data: TransferableResponse): unknown {
  if (data.modelOutputs) {
    return ModelOutput.recordFromWire({
      __modelOutputs: true,
      outputs: data.modelOutputs.outputs as Record<
        string,
        {
          __modelOutput: true;
          length: number;
          columns: ColumnDescriptor[];
          buffers: ArrayBuffer[];
        }
      >,
    });
  }
  if (data.buffer != null) {
    if (data.bufferType === "ArrayBuffer") return data.buffer;
    const Ctor = TYPED_ARRAY_CONSTRUCTORS[data.bufferType!];
    if (Ctor) return new Ctor(data.buffer);
    return data.buffer;
  }
  return data.result;
}
