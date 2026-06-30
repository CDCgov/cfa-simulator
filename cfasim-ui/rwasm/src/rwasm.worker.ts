import {
  postErrorWithTransfer,
  postModelOutputsWithTransfer,
  postWithTransfer,
} from "@cfasim-ui/shared/transfer";
import {
  buildCall,
  convertRModelOutputs,
  normalizeWebRValue,
} from "./rConvert.js";
import type { RwasmBundleManifest, RWorkerRequest } from "./rwasmWorkerApi.js";

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

function manifestUrl(model: string): string {
  const base = `${self.location.origin}${baseUrl}`;
  return joinUrl(base, `rwasm/${model}/manifest.json`);
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
