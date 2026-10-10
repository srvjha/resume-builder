import { Worker } from "node:worker_threads";

// pdf.js parses on the thread that calls it, so an uploaded file built to be slow or huge would stall every request.
// This runs one export of a module in a worker thread with capped memory and time instead.
export function inWorker<T>(module: string, name: string, arg: Uint8Array, timeoutMs = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      `const { parentPort, workerData: w } = require("node:worker_threads");
       import(w.module).then((m) => m[w.name](w.arg)).then((result) => parentPort.postMessage(result));`,
      { eval: true, workerData: { module, name, arg }, resourceLimits: { maxOldGenerationSizeMb: 256 } },
    );
    const timer = setTimeout(() => {
      reject(new Error(`${name} took over ${timeoutMs}ms`));
      void worker.terminate();
    }, timeoutMs);
    const done = () => {
      clearTimeout(timer);
      void worker.terminate();
    };
    worker.once("message", (result: T) => {
      done();
      resolve(result);
    });
    worker.once("error", (err) => {
      done();
      reject(err);
    });
    worker.once("exit", (code) => {
      done();
      reject(new Error(`${name} worker exited with code ${code}`));
    });
  });
}
