import { createUseModel } from "@cfasim-ui/shared/use-model";
import { callPython, loadModule } from "./pyodideWorkerApi.js";

export const useModel = createUseModel({
  load: loadModule,
  run: (module, fn, params) => callPython(module, fn, params),
});
