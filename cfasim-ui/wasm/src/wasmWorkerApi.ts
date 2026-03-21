import type { TransferableResponse } from "@cfasim-ui/shared";
import { unwrapResponse } from "@cfasim-ui/shared";

interface WorkerMessage {
  id: number;
  model: string;
  fn: string;
  args: string[];
}

let lastId = 0;

const worker = new Worker(new URL("./wasm.worker.ts", import.meta.url), {
  type: "module",
});

export function runWasm(
  model: string,
  fn: string,
  ...args: string[]
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++lastId;

    function listener(event: MessageEvent<TransferableResponse>) {
      if (event.data?.id !== id) return;
      worker.removeEventListener("message", listener);
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(unwrapResponse(event.data));
      }
    }

    worker.addEventListener("message", listener);
    worker.postMessage({ id, model, fn, args } as WorkerMessage);
  });
}
