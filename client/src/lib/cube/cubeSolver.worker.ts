import Cube from "cubejs";
import { validateCubieState } from "./physicalSolver";

interface SolveRequest {
  id: number;
  facelets: string;
}

let initialized = false;

self.onmessage = (event: MessageEvent<SolveRequest>) => {
  const { id, facelets } = event.data;
  try {
    if (!initialized) {
      self.postMessage({ id, type: "initializing" });
      Cube.initSolver();
      initialized = true;
    }
    const cube = Cube.fromString(facelets);
    const problem = validateCubieState(cube.toJSON());
    if (problem) throw new Error(problem);
    const algorithm = cube.solve();
    self.postMessage({ id, type: "solved", algorithm });
  } catch (error) {
    self.postMessage({
      id,
      type: "error",
      message:
        error instanceof Error ? error.message : "The cube state is invalid.",
    });
  }
};
