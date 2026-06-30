import { createUseModel } from "@cfasim-ui/shared/use-model";
import { loadModel, runR } from "./rwasmWorkerApi.js";
import type { JsonValue } from "./rwasmWorkerApi.js";

export const useModel = createUseModel({
  load: loadModel,
  run: (model, fn, params) =>
    runR(model, fn, params as Record<string, JsonValue>),
});
