interface WorkerMessage {
  id: number;
  model: string;
  fn: string;
  args: string[];
}

interface WorkerResponse {
  id: number;
  result?: string;
  error?: string;
}

let lastId = 0;

const worker = new Worker(new URL("./wasm.worker.ts", import.meta.url), {
  type: "module",
});

export function runWasm(
  model: string,
  fn: string,
  ...args: string[]
): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = ++lastId;

    function listener(event: MessageEvent<WorkerResponse>) {
      if (event.data?.id !== id) return;
      worker.removeEventListener("message", listener);
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.result!);
      }
    }

    worker.addEventListener("message", listener);
    worker.postMessage({ id, model, fn, args } as WorkerMessage);
  });
}
