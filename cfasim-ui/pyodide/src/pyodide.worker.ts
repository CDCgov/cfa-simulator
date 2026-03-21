interface WorkerMessage {
  id: number;
  type?: "run" | "loadModule";
  python?: string;
  module?: string;
  context?: Record<string, unknown>;
}

interface WorkerResponse {
  id: number;
  result?: unknown;
  error?: string;
}

let wheelMap: Record<string, string> = {};
const loadedModules = new Set<string>();

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
  const res = await fetch(`${self.location.origin}/wheels.json`);
  const wheelFiles: string[] = await res.json();
  for (const filename of wheelFiles) {
    const moduleName = filename.split("-")[0];
    wheelMap[moduleName] = filename;
  }

  return pyodide;
})();

async function ensureModule(
  pyodide: Awaited<typeof pyodideReadyPromise>,
  moduleName: string,
) {
  if (loadedModules.has(moduleName)) return;
  const filename = wheelMap[moduleName];
  if (!filename) throw new Error(`Unknown module: ${moduleName}`);
  await micropip.install(`${self.location.origin}/${filename}`);
  pyodide.pyimport(moduleName);
  loadedModules.add(moduleName);
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const pyodide = await pyodideReadyPromise;
  const { id, type, python, module: moduleName, context } = event.data;

  try {
    if (type === "loadModule" && moduleName) {
      await ensureModule(pyodide, moduleName);
      self.postMessage({ result: true, id } as WorkerResponse);
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
      result = rawResult.toJs
        ? rawResult.toJs({ dict_converter: Object.fromEntries })
        : rawResult.toString();
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

    self.postMessage({ result, id } as WorkerResponse);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
      id,
    } as WorkerResponse);
  }
};
