import {
  postWithTransfer,
  postModelOutputsWithTransfer,
  postErrorWithTransfer,
} from "@cfasim-ui/shared";
import type { ColumnDescriptor, ModelOutputsWire } from "@cfasim-ui/shared";

interface WorkerMessage {
  id: number;
  type?: "run" | "loadModule";
  python?: string;
  module?: string;
  context?: Record<string, unknown>;
}

let wheelMap: Record<string, string> = {};
const loadedModules = new Set<string>();

const baseUrl = import.meta.env.BASE_URL ?? "/";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let micropip: any;

const pyodideReadyPromise = (async () => {
  // @ts-expect-error - Pyodide types from CDN
  const { loadPyodide } = await import(
    /* @vite-ignore */ "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.mjs"
  );
  // Load micropip and numpy in parallel with Pyodide bootstrap
  const pyodide = await loadPyodide({
    packages: ["micropip", "numpy"],
  });

  micropip = pyodide.pyimport("micropip");

  // Build module→wheel lookup but don't install yet
  const res = await fetch(`${self.location.origin}${baseUrl}wheels.json`);
  const wheelFiles: string[] = await res.json();
  for (const filename of wheelFiles) {
    const moduleName = filename.split("-")[0];
    wheelMap[moduleName] = filename;
  }

  return pyodide;
})();

let wheelsInstalled = false;

async function installAllWheels() {
  if (wheelsInstalled) return;
  wheelsInstalled = true;
  const urls = Object.values(wheelMap).map(
    (f) => `${self.location.origin}${baseUrl}${f}`,
  );
  if (urls.length > 0) {
    await micropip.install(urls);
  }
}

async function ensureModule(
  pyodide: Awaited<typeof pyodideReadyPromise>,
  moduleName: string,
) {
  if (loadedModules.has(moduleName)) return;
  if (!wheelMap[moduleName]) throw new Error(`Unknown module: ${moduleName}`);
  await installAllWheels();
  pyodide.pyimport(moduleName);
  loadedModules.add(moduleName);
}

// Map Python struct format characters to TypedArray constructors
const FORMAT_TO_TYPED_ARRAY: Record<
  string,
  new (buffer: ArrayBuffer) => ArrayBufferView
> = {
  b: Int8Array,
  B: Uint8Array,
  h: Int16Array,
  H: Uint16Array,
  i: Int32Array,
  I: Uint32Array,
  f: Float32Array,
  d: Float64Array,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractNumpyBuffer(proxy: any): ArrayBuffer {
  const pyBuffer = proxy.getBuffer();
  const Ctor = FORMAT_TO_TYPED_ARRAY[pyBuffer.format] ?? Float64Array;
  const typed = new Ctor(
    pyBuffer.data.buffer.slice(
      pyBuffer.data.byteOffset,
      pyBuffer.data.byteOffset + pyBuffer.data.byteLength,
    ),
  );
  pyBuffer.release();
  return typed.buffer as ArrayBuffer;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertModelOutputs(jsResult: any): ModelOutputsWire | null {
  if (!jsResult || typeof jsResult !== "object" || !jsResult.__modelOutputs) {
    return null;
  }

  const outputs: ModelOutputsWire["outputs"] = {};
  for (const [key, outputProxy] of Object.entries(
    jsResult.outputs as Record<string, Record<string, unknown>>,
  )) {
    const wire = outputProxy as {
      length: number;
      columns: { name: string; type: string; enumLabels?: string[] }[];
      buffers: unknown[];
    };

    const buffers: ArrayBuffer[] = [];
    for (const buf of wire.buffers) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (buf && typeof buf === "object" && (buf as any).getBuffer) {
        buffers.push(extractNumpyBuffer(buf));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((buf as any).destroy) (buf as any).destroy();
      } else if (buf instanceof ArrayBuffer) {
        buffers.push(buf);
      } else if (ArrayBuffer.isView(buf)) {
        buffers.push(
          buf.buffer.slice(
            buf.byteOffset,
            buf.byteOffset + buf.byteLength,
          ) as ArrayBuffer,
        );
      }
    }

    outputs[key] = {
      __modelOutput: true,
      length: wire.length,
      columns: wire.columns as ColumnDescriptor[],
      buffers,
    };
  }

  return { __modelOutputs: true, outputs };
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const pyodide = await pyodideReadyPromise;
  const { id, type, python, module: moduleName, context } = event.data;

  try {
    if (type === "loadModule" && moduleName) {
      await ensureModule(pyodide, moduleName);
      postWithTransfer(self, id, true);
      return;
    }

    let globals;
    if (context) {
      const dict = pyodide.globals.get("dict");
      globals = dict(Object.entries(context));
    }

    const t0 = performance.now();

    // Use synchronous runPython (models don't use top-level await)
    const rawResult = pyodide.runPython(
      python!,
      globals ? { globals } : undefined,
    );

    const tPython = performance.now();

    // Destroy PyProxy if returned to prevent memory leaks
    let result = rawResult;
    if (rawResult && typeof rawResult === "object" && rawResult.destroy) {
      if (rawResult.toJs) {
        result = rawResult.toJs({ dict_converter: Object.fromEntries });
      } else if (rawResult.getBuffer) {
        // Single numpy array: use getBuffer() for direct typed array access
        const pyBuffer = rawResult.getBuffer();
        const Ctor = FORMAT_TO_TYPED_ARRAY[pyBuffer.format] ?? Float64Array;
        result = new Ctor(
          pyBuffer.data.buffer.slice(
            pyBuffer.data.byteOffset,
            pyBuffer.data.byteOffset + pyBuffer.data.byteLength,
          ),
        );
        pyBuffer.release();
      } else {
        result = rawResult.toString();
      }
      rawResult.destroy();
    }

    // Destroy globals proxy if created
    if (globals && globals.destroy) {
      globals.destroy();
    }

    const tConvert = performance.now();
    const bench = {
      python_ms: Math.round((tPython - t0) * 10) / 10,
      convert_ms: Math.round((tConvert - tPython) * 10) / 10,
    };
    console.log(
      `[pyodide-worker] python=${bench.python_ms}ms convert=${bench.convert_ms}ms`,
    );

    // Check for ModelOutputs wire format
    const modelOutputs = convertModelOutputs(result);
    if (modelOutputs) {
      postModelOutputsWithTransfer(self, id, modelOutputs);
    } else {
      postWithTransfer(self, id, result);
    }
  } catch (error) {
    postErrorWithTransfer(self, id, error);
  }
};
