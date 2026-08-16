declare module "cubejs" {
  interface CubeStateJson {
    center: number[];
    cp: number[];
    co: number[];
    ep: number[];
    eo: number[];
  }

  class Cube {
    constructor();
    static fromString(facelets: string): Cube;
    static initSolver(): void;
    asString(): string;
    move(algorithm: string): void;
    toJSON(): CubeStateJson;
    solve(maxDepth?: number): string;
  }

  export default Cube;
}
