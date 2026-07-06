// Parametric Three.js geometry for every /ausengine entry. Each builder returns
// a THREE.Group, and buildEngineModel normalises it to a consistent size so the
// camera frames them all the same way. These are stylised-but-recognisable
// exteriors keyed off the engine's archetype — an inline block with a cam
// cover, a splayed V8, a star-shaped radial, a jet nacelle, a hopper-cooled
// stationary single with a great flywheel, and Sarich's orbital drum.

import * as THREE from "three";
import type { Engine, EngineModelSpec } from "./engines";

const DEG = Math.PI / 180;

function mat(color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.42,
    metalness: 0.7,
    ...opts,
  });
}

// darker/lighter shades derived from a base colour
function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l * f)));
  return `#${c.getHexString()}`;
}

function box(w: number, h: number, d: number, m: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  return mesh;
}

// cylinder with its axis along +Y, centred at origin
function cyl(
  rTop: number,
  rBot: number,
  h: number,
  m: THREE.Material,
  seg = 24
): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), m);
}

// an air-cooled cylinder: barrel + stacked cooling fins + a head block.
// Built along +Y with its base at y=0.
function finnedCylinder(
  len: number,
  rad: number,
  nFins: number,
  bodyMat: THREE.Material,
  finMat: THREE.Material
): THREE.Group {
  const g = new THREE.Group();
  const barrel = cyl(rad, rad, len, bodyMat, 20);
  barrel.position.y = len / 2;
  g.add(barrel);
  const finR = rad * 1.5;
  for (let i = 0; i < nFins; i++) {
    const fin = cyl(finR, finR, len / (nFins * 3), finMat, 20);
    fin.position.y = (len * (i + 0.5)) / nFins;
    g.add(fin);
  }
  // head at the top
  const head = box(rad * 2.6, rad * 1.1, rad * 2.6, bodyMat);
  head.position.y = len + rad * 0.45;
  g.add(head);
  return g;
}

// a spoked flywheel: rim disc + hub + spokes, axis along +X
function flywheel(rad: number, thick: number, m: THREE.Material, hubMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const rim = cyl(rad, rad, thick, m, 40);
  rim.rotation.z = 90 * DEG; // axis -> X
  g.add(rim);
  const hub = cyl(rad * 0.22, rad * 0.22, thick * 1.6, hubMat, 20);
  hub.rotation.z = 90 * DEG;
  g.add(hub);
  const spokeMat = hubMat;
  for (let i = 0; i < 6; i++) {
    const spoke = box(thick * 0.5, rad * 1.7, rad * 0.13, spokeMat);
    spoke.rotation.x = i * 30 * DEG;
    g.add(spoke);
  }
  return g;
}

// crank pulley + a small accessory, mounted on the +X end at engine centreline
function frontAccessories(x: number, m: THREE.Material, accMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const pulley = cyl(0.36, 0.36, 0.16, m, 28);
  pulley.rotation.z = 90 * DEG;
  pulley.position.set(x, -0.15, 0);
  g.add(pulley);
  const alt = cyl(0.2, 0.2, 0.36, accMat, 20);
  alt.rotation.z = 90 * DEG;
  alt.position.set(x - 0.05, 0.35, 0.5);
  g.add(alt);
  return g;
}

function turboSnail(x: number, z: number, m: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const snail = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.16, 16, 24), m);
  snail.position.set(x, -0.1, z);
  g.add(snail);
  const inlet = cyl(0.14, 0.18, 0.4, m, 18);
  inlet.rotation.z = 90 * DEG;
  inlet.position.set(x + 0.3, -0.1, z);
  g.add(inlet);
  return g;
}

// ---------------------------------------------------------------- inline
function buildInline(n: number, spec: EngineModelSpec, c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const blockMat = mat(c, { metalness: 0.55, roughness: 0.5 });
  const coverMat = mat(c2, { metalness: 0.4, roughness: 0.4 });
  const steel = mat("#9a9ea6");
  const dark = mat(shade(c, 0.6), { metalness: 0.6 });

  const pitch = 0.52;
  const blockW = n * pitch + 0.5;
  const blockH = 1.15;
  const depth = 1.05;

  // block
  g.add(box(blockW, blockH, depth, blockMat));
  // sump
  const sump = box(blockW * 0.82, 0.5, depth * 0.72, dark);
  sump.position.y = -(blockH / 2 + 0.24);
  g.add(sump);
  // head
  const head = box(blockW * 0.99, 0.34, depth * 0.96, blockMat);
  head.position.y = blockH / 2 + 0.17;
  g.add(head);
  // cam / valve cover
  const coverH = spec.dohc ? 0.4 : 0.3;
  const coverW = spec.dohc ? depth * 0.72 : depth * 0.5;
  const cover = box(blockW * 0.82, coverH, coverW, coverMat);
  cover.position.y = blockH / 2 + 0.34 + coverH / 2;
  g.add(cover);
  if (spec.dohc) {
    for (const dz of [-coverW * 0.28, coverW * 0.28]) {
      const ridge = cyl(0.1, 0.1, blockW * 0.8, steel, 16);
      ridge.rotation.z = 90 * DEG;
      ridge.position.set(0, cover.position.y + coverH / 2, dz);
      g.add(ridge);
    }
  }

  // intake manifold (+Z) and exhaust (-Z)
  const logZ = depth / 2 + 0.22;
  const intakeLog = cyl(0.16, 0.16, blockW * 0.82, mat(shade(c2, 1.1), { metalness: 0.5 }), 18);
  intakeLog.rotation.z = 90 * DEG;
  intakeLog.position.set(0, blockH * 0.18, logZ);
  g.add(intakeLog);
  const exLog = cyl(0.15, 0.15, blockW * 0.82, dark, 18);
  exLog.rotation.z = 90 * DEG;
  exLog.position.set(0, -blockH * 0.12, -logZ);
  g.add(exLog);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * pitch;
    // intake runner
    const ir = cyl(0.09, 0.09, 0.4, steel, 12);
    ir.rotation.x = 90 * DEG;
    ir.position.set(x, blockH * 0.3, depth / 2 + 0.05);
    g.add(ir);
    if (spec.dohc) {
      // velocity stack
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.22, 16), steel);
      stack.position.set(x, blockH * 0.55, logZ + 0.02);
      g.add(stack);
    }
    // exhaust runner
    const er = cyl(0.08, 0.08, 0.42, dark, 12);
    er.rotation.x = 90 * DEG;
    er.position.set(x, -blockH * 0.02, -(depth / 2 + 0.05));
    g.add(er);
  }

  g.add(frontAccessories(blockW / 2 + 0.12, steel, dark));
  if (spec.turbo) g.add(turboSnail(blockW / 2 - 0.1, -logZ - 0.15, mat("#9a9ea6")));
  return g;
}

// ---------------------------------------------------------------- vee
function buildVee(n: number, angle: number, spec: EngineModelSpec, c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const blockMat = mat(c, { metalness: 0.55, roughness: 0.5 });
  const coverMat = mat(c2, { metalness: 0.45, roughness: 0.4 });
  const steel = mat("#9a9ea6");
  const dark = mat(shade(c, 0.6), { metalness: 0.6 });

  const perBank = n / 2;
  const pitch = 0.5;
  const blockW = perBank * pitch + 0.6;
  const depth = 0.92;

  // crankcase
  g.add(box(blockW, 0.62, depth, blockMat));
  const sump = box(blockW * 0.8, 0.44, depth * 0.66, dark);
  sump.position.y = -0.5;
  g.add(sump);

  const half = angle / 2;
  const bankTop = 0.31;
  for (const s of [-1, 1]) {
    const bank = new THREE.Group();
    // cylinder bank + head, standing up before the group is splayed
    const bankBlock = box(blockW * 0.96, 0.72, 0.44, blockMat);
    bankBlock.position.y = 0.36;
    bank.add(bankBlock);
    const coverH = spec.dohc ? 0.34 : 0.28;
    const cover = box(blockW * 0.86, coverH, spec.dohc ? 0.42 : 0.34, coverMat);
    cover.position.y = 0.72 + coverH / 2;
    bank.add(cover);
    // exhaust headers running down the outside of the bank
    for (let i = 0; i < perBank; i++) {
      const x = (i - (perBank - 1) / 2) * pitch;
      const hdr = cyl(0.08, 0.08, 0.42, dark, 12);
      hdr.rotation.x = 90 * DEG;
      hdr.position.set(x, 0.34, 0.28);
      bank.add(hdr);
    }
    bank.position.y = bankTop;
    bank.rotation.x = s * half * DEG;
    g.add(bank);
  }

  // intake valley plenum sitting down in the vee
  const plenum = box(blockW * 0.7, 0.26, depth * 0.4, mat(shade(c2, 1.1), { metalness: 0.5 }));
  plenum.position.y = 0.66;
  g.add(plenum);
  if (spec.dohc) {
    const tb = cyl(0.16, 0.16, 0.3, steel, 18);
    tb.rotation.z = 90 * DEG;
    tb.position.set(blockW / 2 + 0.05, 0.66, 0);
    g.add(tb);
  } else {
    // carb / air cleaner on top
    const carb = cyl(0.36, 0.36, 0.2, steel, 24);
    carb.position.y = 0.92;
    g.add(carb);
    const lid = cyl(0.4, 0.4, 0.05, dark, 24);
    lid.position.y = 1.04;
    g.add(lid);
  }

  g.add(frontAccessories(blockW / 2 + 0.12, steel, dark));
  return g;
}

// ---------------------------------------------------------------- flat / boxer
function buildFlat(n: number, c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const caseMat = mat(c, { metalness: 0.45, roughness: 0.55 });
  const finMat = mat(c2, { metalness: 0.65, roughness: 0.35 });
  const steel = mat("#b6bac0");

  const perSide = n / 2;
  const caseLen = perSide * 0.66 + 0.5;
  // crankcase (axis along X = prop axis)
  const crank = cyl(0.42, 0.42, caseLen, caseMat, 28);
  crank.rotation.z = 90 * DEG;
  g.add(crank);
  const caseBox = box(caseLen, 0.7, 0.62, caseMat);
  g.add(caseBox);

  const cylLen = 0.62;
  for (const s of [-1, 1]) {
    for (let i = 0; i < perSide; i++) {
      const x = (i - (perSide - 1) / 2) * 0.66 + (s > 0 ? 0.08 : -0.08);
      const c1 = finnedCylinder(cylLen, 0.2, 6, caseMat, finMat);
      // orient along Z (pointing out to side s)
      c1.rotation.x = s > 0 ? -90 * DEG : 90 * DEG;
      c1.position.set(x, 0, s * 0.42);
      g.add(c1);
    }
  }

  // prop flange + 2-blade prop at +X
  const flange = cyl(0.28, 0.28, 0.12, steel, 24);
  flange.rotation.z = 90 * DEG;
  flange.position.x = caseLen / 2 + 0.1;
  g.add(flange);
  const hub = cyl(0.16, 0.16, 0.3, steel, 20);
  hub.rotation.z = 90 * DEG;
  hub.position.x = caseLen / 2 + 0.24;
  g.add(hub);
  for (const s of [-1, 1]) {
    const blade = box(0.06, 1.9, 0.24, mat("#3a3d42", { metalness: 0.3 }));
    blade.position.set(caseLen / 2 + 0.26, s * 0.95, 0);
    blade.rotation.x = 12 * DEG;
    g.add(blade);
  }
  return g;
}

// ---------------------------------------------------------------- radial
function buildRadial(n: number, c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const caseMat = mat(c, { metalness: 0.6, roughness: 0.4 });
  const finMat = mat(c2, { metalness: 0.5, roughness: 0.45 });
  const steel = mat("#c2c6cc");
  const dark = mat("#33363b", { metalness: 0.3 });

  const twinRow = n > 9;
  const perRow = twinRow ? n / 2 : n;
  const rows = twinRow ? 2 : 1;
  const cylLen = 0.95;
  const ring = 0.5; // crankcase radius

  // crankcase drum (axis along Z toward viewer)
  const drum = cyl(ring, ring, 0.55 * rows, caseMat, 36);
  drum.rotation.x = 90 * DEG;
  g.add(drum);

  for (let r = 0; r < rows; r++) {
    const z = twinRow ? (r - 0.5) * 0.5 : 0;
    const stagger = twinRow && r === 1 ? Math.PI / perRow : 0;
    for (let i = 0; i < perRow; i++) {
      const a = (i / perRow) * Math.PI * 2 + stagger;
      const cylG = finnedCylinder(cylLen, 0.19, 7, caseMat, finMat);
      // point radially outward in the XY plane
      cylG.position.set(Math.cos(a) * ring, Math.sin(a) * ring, z);
      cylG.rotation.z = a - Math.PI / 2;
      g.add(cylG);
      // pushrod tube
      const rod = cyl(0.03, 0.03, cylLen, dark, 8);
      rod.position.set(
        Math.cos(a) * (ring + cylLen * 0.5),
        Math.sin(a) * (ring + cylLen * 0.5),
        z + 0.12
      );
      rod.rotation.z = a - Math.PI / 2;
      g.add(rod);
    }
  }

  // nose case + prop hub + blades (toward +Z)
  const noseZ = twinRow ? 0.6 : 0.35;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 28), steel);
  nose.rotation.x = 90 * DEG;
  nose.position.z = noseZ + 0.25;
  g.add(nose);
  const hub = cyl(0.34, 0.34, 0.16, steel, 28);
  hub.rotation.x = 90 * DEG;
  hub.position.z = noseZ;
  g.add(hub);
  const blades = twinRow ? 3 : 2;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2;
    const blade = box(0.26, 2.3, 0.06, mat("#3a3d42", { metalness: 0.3 }));
    blade.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15, noseZ + 0.05);
    blade.rotation.z = a;
    g.add(blade);
  }
  return g;
}

// ---------------------------------------------------------------- turbojet
function buildTurbojet(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const skin = mat(c, { metalness: 0.85, roughness: 0.3 });
  const dark = mat(shade(c, 0.65), { metalness: 0.8 });
  const hot = mat(c2, { metalness: 0.7, roughness: 0.35 });

  // main casing (axis along X)
  const casing = cyl(0.52, 0.58, 2.2, skin, 40);
  casing.rotation.z = 90 * DEG;
  g.add(casing);
  // banding rings
  for (const x of [-0.6, 0, 0.6]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 12, 40), dark);
    ring.rotation.y = 90 * DEG;
    ring.position.x = x;
    g.add(ring);
  }
  // intake lip + nose bullet (front = +X)
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 16, 40), skin);
  lip.rotation.y = 90 * DEG;
  lip.position.x = 1.12;
  g.add(lip);
  const bullet = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 28), dark);
  bullet.rotation.z = -90 * DEG;
  bullet.position.x = 1.2;
  g.add(bullet);
  // turbine / exhaust (back = -X)
  const turbine = cyl(0.5, 0.42, 0.5, hot, 36);
  turbine.rotation.z = 90 * DEG;
  turbine.position.x = -1.35;
  g.add(turbine);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 28), hot);
  cone.rotation.z = 90 * DEG;
  cone.position.x = -1.75;
  g.add(cone);
  // accessory gearbox bump underneath, front
  const acc = box(0.7, 0.34, 0.6, dark);
  acc.position.set(0.5, -0.55, 0);
  g.add(acc);
  return g;
}

// ---------------------------------------------------------------- stationary
function buildStationary(twin: boolean, c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const iron = mat(c, { metalness: 0.45, roughness: 0.6 });
  const iron2 = mat(shade(c, 0.7), { metalness: 0.5, roughness: 0.6 });
  const brass = mat("#b9962e", { metalness: 0.7, roughness: 0.4 });
  const wheelMat = mat(c2, { metalness: 0.45, roughness: 0.6 });

  // skid base (crank axis along X)
  const base = box(2.4, 0.34, 1.05, iron2);
  base.position.y = -0.75;
  g.add(base);
  // crank / bearing housing near +X end
  const crankHouse = box(0.7, 0.7, 0.9, iron);
  crankHouse.position.set(0.65, -0.28, 0);
  g.add(crankHouse);

  // horizontal power cylinder toward -X
  const barrel = cyl(0.4, 0.4, 1.15, iron, 28);
  barrel.rotation.z = 90 * DEG;
  barrel.position.set(-0.55, -0.1, 0);
  g.add(barrel);
  // hopper cooling tank on top of the cylinder
  const hopper = box(0.78, 0.62, 0.86, iron2);
  hopper.position.set(-0.55, 0.42, 0);
  g.add(hopper);
  const water = box(0.62, 0.06, 0.7, mat("#2a4a63", { metalness: 0.2, roughness: 0.3 }));
  water.position.set(-0.55, 0.7, 0);
  g.add(water);
  // cylinder head end cap + rocker gear (-X end)
  const headCap = cyl(0.34, 0.34, 0.2, iron, 24);
  headCap.rotation.z = 90 * DEG;
  headCap.position.set(-1.2, -0.1, 0);
  g.add(headCap);
  const rockerPost = box(0.06, 0.4, 0.06, brass);
  rockerPost.position.set(-1.28, 0.2, 0.18);
  g.add(rockerPost);
  const rocker = box(0.4, 0.05, 0.05, brass);
  rocker.position.set(-1.15, 0.36, 0.18);
  g.add(rocker);

  // big flywheel(s) on the crank (X axis) at the +X end
  const fw = flywheel(0.9, 0.13, wheelMat, iron);
  fw.position.set(1.15, -0.28, 0);
  g.add(fw);
  if (twin) {
    const fw2 = flywheel(0.9, 0.13, wheelMat, iron);
    fw2.position.set(0.15, -0.28, 0);
    g.add(fw2);
  }
  return g;
}

// ---------------------------------------------------------------- orbital
function buildOrbital(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const housingMat = mat(c, { metalness: 0.5, roughness: 0.5 });
  const plate = mat(shade(c, 0.65), { metalness: 0.6, roughness: 0.45 });
  const steel = mat("#b6bac0");
  const accent = mat(c2, { metalness: 0.55 });

  // main orbital chamber: a drum (axis along Z)
  const drum = cyl(0.62, 0.62, 0.66, housingMat, 44);
  drum.rotation.x = 90 * DEG;
  g.add(drum);
  // front/back cover plates
  for (const z of [-0.36, 0.36]) {
    const cover = cyl(0.66, 0.66, 0.06, plate, 44);
    cover.rotation.x = 90 * DEG;
    cover.position.z = z;
    g.add(cover);
  }
  // ribs around the housing
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rib = box(0.06, 0.08, 0.66, plate);
    rib.position.set(Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0);
    rib.rotation.z = a;
    g.add(rib);
  }
  // output shaft (+Z)
  const shaft = cyl(0.12, 0.12, 0.6, steel, 20);
  shaft.rotation.x = 90 * DEG;
  shaft.position.z = 0.6;
  g.add(shaft);
  // intake & exhaust ports on the side
  const intake = cyl(0.13, 0.13, 0.5, steel, 18);
  intake.position.set(0.5, 0.5, 0);
  intake.rotation.z = -35 * DEG;
  g.add(intake);
  const exhaust = cyl(0.12, 0.12, 0.55, accent, 18);
  exhaust.position.set(-0.5, -0.5, 0);
  exhaust.rotation.z = -35 * DEG;
  g.add(exhaust);
  // mounting base
  const base = box(1.5, 0.2, 0.9, plate);
  base.position.y = -0.8;
  g.add(base);
  const pillar = box(0.16, 0.6, 0.5, plate);
  pillar.position.y = -0.5;
  g.add(pillar);
  return g;
}

// ---------------------------------------------------------------- dispatch
export function buildEngineModel(engine: Engine): THREE.Group {
  const { model: m, color: c, color2: c2 } = engine;
  let g: THREE.Group;
  switch (m.archetype) {
    case "inline":
      g = buildInline(m.cylinders, m, c, c2);
      break;
    case "vee":
      g = buildVee(m.cylinders, m.veeAngle ?? 90, m, c, c2);
      break;
    case "flat":
      g = buildFlat(m.cylinders, c, c2);
      break;
    case "radial":
      g = buildRadial(m.cylinders, c, c2);
      break;
    case "turbojet":
      g = buildTurbojet(c, c2);
      break;
    case "stationary":
      g = buildStationary(!!m.twinFlywheel, c, c2);
      break;
    case "orbital":
      g = buildOrbital(c, c2);
      break;
    default:
      g = buildInline(4, m, c, c2);
  }
  return normalize(g, 1.15);
}

// Centre a group at the origin and scale it to a target bounding-sphere radius.
function normalize(g: THREE.Group, targetRadius: number): THREE.Group {
  const boxb = new THREE.Box3().setFromObject(g);
  const center = new THREE.Vector3();
  const sphere = new THREE.Sphere();
  boxb.getBoundingSphere(sphere);
  boxb.getCenter(center);
  const wrap = new THREE.Group();
  g.position.sub(center);
  const s = sphere.radius > 0 ? targetRadius / sphere.radius : 1;
  wrap.add(g);
  wrap.scale.setScalar(s);
  return wrap;
}
