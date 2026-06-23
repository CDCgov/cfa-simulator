import {
  postErrorWithTransfer,
  postModelOutputsWithTransfer,
  postWithTransfer,
} from "@cfasim-ui/shared/transfer";
import type {
  ColumnDescriptor,
  ModelOutputsWire,
} from "@cfasim-ui/shared/model-output";
import type {
  JsonValue,
  RwasmBundleManifest,
  RWorkerRequest,
} from "./rwasmWorkerApi.js";

interface RSession {
  webR: any;
  manifest: RwasmBundleManifest;
}

const sessions = new Map<string, Promise<RSession>>();
const baseUrl = import.meta.env.BASE_URL ?? "/";

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

function appUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return joinUrl(`${self.location.origin}${baseUrl}`, path);
}

export function manifestUrl(model: string): string {
  const base = `${self.location.origin}${baseUrl}`;
  return joinUrl(base, `rwasm/${model}/manifest.json`);
}

function assertIdentifier(name: string): void {
  if (!/^[A-Za-z.][A-Za-z0-9._]*$/.test(name)) {
    throw new Error(`Invalid R function name: ${name}`);
  }
}

function rLiteral(value: JsonValue): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("R arguments must be finite");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `list(${value.map(rLiteral).join(", ")})`;
  return `list(${Object.entries(value)
    .map(([key, val]) => `${key} = ${rLiteral(val)}`)
    .join(", ")})`;
}

function buildCall(fn: string, params?: Record<string, JsonValue>): string {
  assertIdentifier(fn);
  const args = Object.entries(params ?? {})
    .map(([key, val]) => `${key} = ${rLiteral(val)}`)
    .join(", ");
  return `${fn}(${args})`;
}

function asArrayBuffer(value: unknown, type: string): ArrayBuffer {
  const values = Array.from(value as Iterable<number | boolean>);
  switch (type) {
    case "f64":
      return new Float64Array(values as number[]).buffer;
    case "i32":
      return new Int32Array(values as number[]).buffer;
    case "u32":
    case "enum":
      return new Uint32Array(values as number[]).buffer;
    case "bool":
      return new Uint8Array(values.map((v) => (v ? 1 : 0))).buffer;
    default:
      throw new Error(`Unsupported R output column type: ${type}`);
  }
}

function arrayFromNamedList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return null;
}

export function normalizeWebRValue(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries(
      Array.from(value, ([key, val]) => [String(key), normalizeWebRValue(val)]),
    );
  }
  if (Array.isArray(value)) return value.map(normalizeWebRValue);
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value;
  if (isWebRDataJs(value)) return decodeWebRDataJs(value);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, normalizeWebRValue(val)]),
    );
  }
  return value;
}

function isWebRDataJs(value: unknown): value is {
  type: string;
  names?: string[] | null;
  values?: unknown[];
} {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { type?: unknown }).type === "string" &&
    ("values" in value || (value as { type?: string }).type === "null")
  );
}

function decodeWebRDataJs(value: {
  type: string;
  names?: string[] | null;
  values?: unknown[];
}): unknown {
  if (value.type === "null") return null;
  const values = (value.values ?? []).map(normalizeWebRValue);
  const names = value.names ?? null;
  if (names?.some(Boolean)) {
    return Object.fromEntries(names.map((name, i) => [name, values[i]]));
  }
  if (value.type === "list") return values;
  return values.length === 1 ? values[0] : values;
}

async function evalRValue(webR: any, code: string): Promise<unknown> {
  const proxy = await webR.evalR(code);
  try {
    const value =
      proxy && typeof proxy.toJs === "function" ? await proxy.toJs() : proxy;
    return normalizeWebRValue(value);
  } finally {
    if (proxy && typeof proxy.destroy === "function") proxy.destroy();
  }
}

export function convertRModelOutputs(value: unknown): ModelOutputsWire | null {
  if (!value || typeof value !== "object") return null;
  const maybe = value as { __modelOutputs?: unknown; outputs?: unknown };
  if (
    !maybe.__modelOutputs ||
    !maybe.outputs ||
    typeof maybe.outputs !== "object"
  ) {
    return null;
  }

  const outputs: ModelOutputsWire["outputs"] = {};
  for (const [name, output] of Object.entries(
    maybe.outputs as Record<string, any>,
  )) {
    const columns = arrayFromNamedList(output.columns) as
      | ColumnDescriptor[]
      | null;
    const data = arrayFromNamedList(output.buffers ?? output.data);
    if (!columns || !data) {
      throw new Error(`Invalid R ModelOutput: ${name}`);
    }

    const buffers = columns.map((col, i) => asArrayBuffer(data[i], col.type));
    const firstColumn = data[0] as { length?: number } | undefined;
    const length =
      typeof output.length === "number"
        ? output.length
        : (firstColumn?.length ?? 0);

    outputs[name] = {
      __modelOutput: true,
      length,
      columns,
      buffers,
    };
  }
  return { __modelOutputs: true, outputs };
}

async function loadManifest(model: string): Promise<RwasmBundleManifest> {
  const response = await fetch(manifestUrl(model));
  if (!response.ok) {
    throw new Error(`Failed to load R model manifest for ${model}`);
  }
  return (await response.json()) as RwasmBundleManifest;
}

async function createSession(model: string): Promise<RSession> {
  const manifest = await loadManifest(model);
  const { WebR, ChannelType } = await import("webr");
  const webR = new WebR(
    manifest.webRBaseUrl
      ? {
          baseUrl: appUrl(manifest.webRBaseUrl),
          channelType: ChannelType.PostMessage,
        }
      : { channelType: ChannelType.PostMessage },
  );
  await webR.init();

  if (manifest.packages.length > 0) {
    if (!manifest.repoUrl) {
      throw new Error(`R model ${model} lists packages without a repoUrl`);
    }
    const packages = manifest.packages
      .map((pkg) => JSON.stringify(pkg))
      .join(", ");
    const repoUrl = appUrl(manifest.repoUrl);
    console.log(`[rwasm] installing packages from ${repoUrl}`);
    try {
      await webR.installPackages(manifest.packages, {
        repos: repoUrl,
        mount: true,
      });
      await webR.evalRVoid(
        `missing <- c(${packages})[!vapply(c(${packages}), requireNamespace, logical(1), quietly = TRUE)]; if (length(missing) > 0) stop(paste("Missing installed packages:", paste(missing, collapse = ", ")))`,
      );
      console.log(`[rwasm] packages installed successfully`);
    } catch (e) {
      console.error(`[rwasm] package install failed:`, e);
      throw e;
    }
  }

  if (manifest.libraryImageUrl) {
    throw new Error("R filesystem image bundles are not implemented yet");
  }

  if (manifest.modelPackage) {
    await webR.evalRVoid(
      `library(${JSON.stringify(manifest.modelPackage)}, character.only = TRUE)`,
    );
  } else {
    const entryUrl = joinUrl(appUrl(manifest.modelBaseUrl), manifest.entry);
    const entry = await fetch(entryUrl);
    if (!entry.ok) throw new Error(`Failed to load R model entry: ${entryUrl}`);
    await webR.evalRVoid(await entry.text());
  }
  return { webR, manifest };
}

function ensureSession(model: string): Promise<RSession> {
  if (!sessions.has(model)) {
    const promise = createSession(model);
    promise.catch((error) => {
      console.error(`[rwasm] session creation failed for ${model}:`, error);
      sessions.delete(model);
    });
    sessions.set(model, promise);
  }
  return sessions.get(model)!;
}

self.onmessage = async (event: MessageEvent<RWorkerRequest>) => {
  const { id, type, model, fn, params } = event.data;
  try {
    const session = await ensureSession(model);
    if (type === "loadModel") {
      postWithTransfer(self, id, true);
      return;
    }

    if (!fn) throw new Error("R function name is required");
    const result = await evalRValue(session.webR, buildCall(fn, params));
    const modelOutputs = convertRModelOutputs(result);
    if (modelOutputs) {
      postModelOutputsWithTransfer(self, id, modelOutputs);
    } else {
      postWithTransfer(self, id, result);
    }
  } catch (error) {
    postErrorWithTransfer(self, id, error);
  }
};
