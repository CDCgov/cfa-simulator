import {
  postWithTransfer,
  postModelOutputsWithTransfer,
  postErrorWithTransfer,
} from "@cfasim-ui/shared";
import type { ColumnDescriptor, ModelOutputsWire } from "@cfasim-ui/shared";

interface RunMessage {
  id: number;
  type?: "run";
  python: string;
  context?: Record<string, unknown>;
}
interface CallMessage {
  id: number;
  type: "call";
  module: string;
  fn: string;
  kwargs?: Record<string, unknown>;
}
interface LoadModuleMessage {
  id: number;
  type: "loadModule";
  module: string;
}
type WorkerMessage = RunMessage | CallMessage | LoadModuleMessage;

let wheelMap: Record<string, string> = {};

const baseUrl = import.meta.env.BASE_URL ?? "/";

const DEFAULT_PYODIDE_PACKAGES = ["micropip", "numpy"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let micropip: any;

async function fetchPyodidePackages(): Promise<string[]> {
  const url = `${self.location.origin}${baseUrl}pyodide-packages.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(
        `[pyodide-worker] ${url} returned ${res.status}; falling back to default packages`,
      );
      return DEFAULT_PYODIDE_PACKAGES;
    }
    const list = await res.json();
    if (!Array.isArray(list)) {
      console.warn(
        `[pyodide-worker] ${url} did not contain an array; falling back to default packages`,
      );
      return DEFAULT_PYODIDE_PACKAGES;
    }
    return list as string[];
  } catch (err) {
    console.warn(
      `[pyodide-worker] failed to load ${url}; falling back to default packages`,
      err,
    );
    return DEFAULT_PYODIDE_PACKAGES;
  }
}

const pyodideReadyPromise = (async () => {
  const [pyodideModule, packages] = await Promise.all([
    // @ts-expect-error - Pyodide types from CDN
    import(
      /* @vite-ignore */ "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/pyodide.mjs"
    ),
    fetchPyodidePackages(),
  ]);
  const { loadPyodide } = pyodideModule;
  const pyodide = await loadPyodide({ packages });

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

let installPromise: Promise<void> | null = null;

function installAllWheels(): Promise<void> {
  if (!installPromise) {
    installPromise = (async () => {
      const urls = Object.values(wheelMap).map(
        (f) => `${self.location.origin}${baseUrl}${f}`,
      );
      if (urls.length > 0) {
        await micropip.install(urls);
      }
    })();
    installPromise.catch(() => {
      installPromise = null;
    });
  }
  return installPromise;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modulePromises = new Map<string, Promise<any>>();

function ensureModule(
  pyodide: Awaited<typeof pyodideReadyPromise>,
  moduleName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  let p = modulePromises.get(moduleName);
  if (!p) {
    if (!wheelMap[moduleName]) {
      return Promise.reject(new Error(`Unknown module: ${moduleName}`));
    }
    p = (async () => {
      await installAllWheels();
      return pyodide.pyimport(moduleName);
    })();
    p.catch(() => {
      modulePromises.delete(moduleName);
    });
    modulePromises.set(moduleName, p);
  }
  return p;
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

// Copy a Pyodide getBuffer() result into a JS-owned typed array. Releases the
// underlying Python buffer; the returned view's ArrayBuffer is safe to transfer.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function copyPyBuffer(proxy: any): ArrayBufferView {
  const pyBuffer = proxy.getBuffer();
  const Ctor = FORMAT_TO_TYPED_ARRAY[pyBuffer.format] ?? Float64Array;
  const view = new Ctor(
    pyBuffer.data.buffer.slice(
      pyBuffer.data.byteOffset,
      pyBuffer.data.byteOffset + pyBuffer.data.byteLength,
    ),
  );
  pyBuffer.release();
  return view;
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
        buffers.push(copyPyBuffer(buf).buffer as ArrayBuffer);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function convertResult(rawResult: any): unknown {
  if (!rawResult || typeof rawResult.destroy !== "function") return rawResult;
  try {
    if (typeof rawResult.toJs === "function") {
      return rawResult.toJs({ dict_converter: Object.fromEntries });
    }
    if (typeof rawResult.getBuffer === "function") {
      return copyPyBuffer(rawResult);
    }
    return rawResult.toString();
  } finally {
    rawResult.destroy();
  }
}

function send(id: number, result: unknown) {
  const modelOutputs = convertModelOutputs(result);
  if (modelOutputs) {
    postModelOutputsWithTransfer(self, id, modelOutputs);
  } else {
    postWithTransfer(self, id, result);
  }
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const pyodide = await pyodideReadyPromise;
  const msg = event.data;
  const { id } = msg;

  try {
    if (msg.type === "loadModule") {
      await ensureModule(pyodide, msg.module);
      postWithTransfer(self, id, true);
      return;
    }

    if (msg.type === "call") {
      const mod = await ensureModule(pyodide, msg.module);
      const t0 = performance.now();
      // mod[fn] creates a fresh PyProxy on every access — release in finally.
      const pyFn = mod[msg.fn];
      let result: unknown;
      try {
        if (typeof pyFn !== "function") {
          throw new Error(`Module ${msg.module} has no function ${msg.fn}`);
        }
        const rawResult = msg.kwargs ? pyFn.callKwargs(msg.kwargs) : pyFn();
        result = convertResult(rawResult);
      } finally {
        if (pyFn && typeof pyFn.destroy === "function") pyFn.destroy();
      }
      const tEnd = performance.now();
      console.log(
        `[pyodide-worker] ${msg.module}.${msg.fn} ${
          Math.round((tEnd - t0) * 10) / 10
        }ms`,
      );
      send(id, result);
      return;
    }

    // type === "run" or omitted
    let globals;
    if (msg.context) {
      const dict = pyodide.globals.get("dict");
      try {
        globals = dict(Object.entries(msg.context));
      } finally {
        dict.destroy();
      }
    }
    const t0 = performance.now();
    let result: unknown;
    try {
      const rawResult = pyodide.runPython(
        msg.python,
        globals ? { globals } : undefined,
      );
      result = convertResult(rawResult);
    } finally {
      if (globals && globals.destroy) globals.destroy();
    }
    const tEnd = performance.now();
    console.log(
      `[pyodide-worker] runPython ${Math.round((tEnd - t0) * 10) / 10}ms`,
    );
    send(id, result);
  } catch (error) {
    postErrorWithTransfer(self, id, error);
  }
};
