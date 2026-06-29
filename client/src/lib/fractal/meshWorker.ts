// Web Worker: runs the (expensive) marching-cubes mesh extraction off the main
// thread so the UI stays responsive, reporting progress as it goes.

import {
  generateMesh,
  meshToBinarySTL,
  meshToOBJ,
  type MeshParams,
  type MeshResult,
} from "./fractalMesh";

export interface MeshRequest {
  params: MeshParams;
  format: "stl" | "obj";
}

export type MeshResponse =
  | { kind: "progress"; frac: number }
  | {
      kind: "done";
      format: "stl" | "obj";
      triangles: number;
      bounds: MeshResult["bounds"];
      stl?: ArrayBuffer;
      obj?: string;
    }
  | { kind: "error"; message: string };

self.onmessage = (e: MessageEvent<MeshRequest>) => {
  const { params, format } = e.data;
  try {
    const mesh = generateMesh(params, frac => {
      (self as unknown as Worker).postMessage({
        kind: "progress",
        frac,
      } as MeshResponse);
    });
    if (mesh.triangles === 0) {
      (self as unknown as Worker).postMessage({
        kind: "error",
        message:
          "No surface found at this resolution — try increasing iterations.",
      } as MeshResponse);
      return;
    }
    if (format === "stl") {
      const stl = meshToBinarySTL(mesh.positions);
      (self as unknown as Worker).postMessage(
        {
          kind: "done",
          format,
          triangles: mesh.triangles,
          bounds: mesh.bounds,
          stl,
        } as MeshResponse,
        [stl]
      );
    } else {
      const obj = meshToOBJ(mesh.positions);
      (self as unknown as Worker).postMessage({
        kind: "done",
        format,
        triangles: mesh.triangles,
        bounds: mesh.bounds,
        obj,
      } as MeshResponse);
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({
      kind: "error",
      message: err instanceof Error ? err.message : String(err),
    } as MeshResponse);
  }
};
