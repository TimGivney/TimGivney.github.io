interface SolverMessage {
  id: number;
  type: "initializing" | "solved" | "error";
  algorithm?: string;
  message?: string;
}

let worker: Worker | null = null;
let nextRequestId = 1;

export function solveFacelets(
  facelets: string,
  onInitializing: () => void
): Promise<string> {
  if (!worker)
    worker = new Worker(new URL("./cubeSolver.worker.ts", import.meta.url), {
      type: "module",
    });

  const activeWorker = worker;
  const id = nextRequestId++;
  return new Promise<string>((resolve, reject) => {
    const listener = (event: MessageEvent<SolverMessage>) => {
      const response = event.data;
      if (response.id !== id) return;
      if (response.type === "initializing") {
        onInitializing();
        return;
      }
      activeWorker.removeEventListener("message", listener);
      if (response.type === "solved") resolve(response.algorithm ?? "");
      else reject(new Error(response.message ?? "The cube state is invalid."));
    };
    activeWorker.addEventListener("message", listener);
    activeWorker.postMessage({ id, facelets });
  });
}
