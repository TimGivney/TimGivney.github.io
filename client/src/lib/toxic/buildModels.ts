// Parametric Three.js geometry for every /toxic specimen. Each builder returns a
// THREE.Group roughly normalised to fit a ~2-unit sphere, so the camera frames
// them consistently. These are stylised-but-recognisable models — the shapes
// real microbiologists use to identify each organism (diplococci, bipolar
// "safety pins", corona spikes, bullet rabies, the double helix, …).

import * as THREE from "three";

function mat(
  color: string,
  opts: Partial<THREE.MeshStandardMaterialParameters> = {}
) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.45,
    metalness: 0.05,
    ...opts,
  });
}

// Scatter small bumps over a sphere-ish surface to read as a membrane texture.
function addBumps(
  group: THREE.Group,
  count: number,
  radius: number,
  bumpR: number,
  material: THREE.Material,
  jitter = 1
) {
  const geo = new THREE.SphereGeometry(bumpR, 8, 8);
  const inst = new THREE.InstancedMesh(geo, material, count);
  const m = new THREE.Matrix4();
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    // even-ish distribution (Fibonacci sphere)
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963;
    v.set(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(
      radius * (0.97 + Math.random() * 0.06 * jitter)
    );
    m.makeTranslation(v.x, v.y, v.z);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  group.add(inst);
}

// ---- bacteria ----------------------------------------------------------

function buildMeningococcus(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.5 });
  // diplococcus: two flattened spheres pressed together (coffee bean)
  const colonies: [number, number, number][] = [
    [0, 0, 0],
    [1.55, 0.4, 0.3],
    [-1.35, -0.5, -0.4],
    [0.3, 1.6, -0.6],
  ];
  for (const [cx, cy, cz] of colonies) {
    for (const dx of [-0.52, 0.52]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 24), body);
      s.scale.set(1, 0.96, 0.92);
      s.position.set(cx + dx, cy, cz);
      g.add(s);
      addBumps(
        (() => {
          const sub = new THREE.Group();
          sub.position.copy(s.position);
          g.add(sub);
          return sub;
        })(),
        40,
        0.6,
        0.05,
        mat(c2, { roughness: 0.6 })
      );
    }
  }
  g.scale.setScalar(0.62);
  return g;
}

function rod(
  length: number,
  radius: number,
  material: THREE.Material
): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 12, 24),
    material
  );
}

function buildAnthrax(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.55 });
  // chain of rods end-to-end (streptobacilli)
  const n = 4;
  const rlen = 0.9;
  const rad = 0.32;
  const step = rlen + rad * 2 + 0.02;
  for (let i = 0; i < n; i++) {
    const r = rod(rlen, rad, body);
    r.position.y = (i - (n - 1) / 2) * step;
    g.add(r);
    // an oval endospore glowing inside the second cell
    if (i === 1) {
      const spore = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 20, 16),
        mat(c2, {
          emissive: new THREE.Color(c2).multiplyScalar(0.4),
          roughness: 0.3,
        })
      );
      spore.scale.set(1, 1.5, 1);
      spore.position.y = r.position.y;
      g.add(spore);
    }
  }
  g.rotation.z = 0.18;
  g.scale.setScalar(0.62);
  return g;
}

function buildPlague(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.5 });
  const cap = mat(c2, { roughness: 0.5 });
  // bipolar "safety pin": rod with two dark stained ends
  const positions: [number, number, number, number][] = [
    [0, 0, 0, 0],
    [1.3, 0.7, 0.2, 0.5],
    [-1.2, -0.6, -0.3, -0.4],
  ];
  for (const [x, y, z, rot] of positions) {
    const sub = new THREE.Group();
    const r = rod(0.95, 0.36, body);
    sub.add(r);
    for (const sgn of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.SphereGeometry(0.37, 20, 16), cap);
      end.position.y = sgn * (0.95 / 2);
      end.scale.set(1, 0.7, 1);
      sub.add(end);
    }
    sub.position.set(x, y, z);
    sub.rotation.z = rot;
    g.add(sub);
  }
  g.scale.setScalar(0.6);
  return g;
}

function buildCholera(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.4 });
  // comma shape: a curved tube
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.0, -0.9, 0),
    new THREE.Vector3(-0.7, 0.1, 0),
    new THREE.Vector3(0, 0.7, 0),
    new THREE.Vector3(0.8, 0.6, 0),
    new THREE.Vector3(1.1, 0.0, 0),
  ]);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 48, 0.34, 20, false),
    body
  );
  // rounded caps
  for (const t of [0, 1]) {
    const p = curve.getPoint(t);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 12), body);
    cap.position.copy(p);
    g.add(cap);
  }
  g.add(tube);
  // single polar flagellum: a thin helical tail
  const helixPts: THREE.Vector3[] = [];
  const start = curve.getPoint(0);
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    helixPts.push(
      new THREE.Vector3(
        start.x - t * 1.7,
        start.y + Math.sin(t * 22) * 0.18 - t * 0.2,
        Math.cos(t * 22) * 0.18
      )
    );
  }
  const flag = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(helixPts),
      80,
      0.04,
      8,
      false
    ),
    mat(c2, { roughness: 0.6 })
  );
  g.add(flag);
  g.scale.setScalar(0.8);
  return g;
}

function buildBotulinum(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.55 });
  // tennis-racket: rod with a bulging terminal spore
  const r = rod(1.4, 0.34, body);
  g.add(r);
  const spore = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 24, 18),
    mat(c2, {
      roughness: 0.35,
      emissive: new THREE.Color(c2).multiplyScalar(0.25),
    })
  );
  spore.position.y = 1.4 / 2 + 0.34;
  g.add(spore);
  g.rotation.z = 0.25;
  g.scale.setScalar(0.78);
  return g;
}

function buildPneumococcus(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.5 });
  const capsule = mat(c2, { transparent: true, opacity: 0.28, roughness: 0.2 });
  const pairs: [number, number, number, number][] = [
    [0, 0, 0, 0.15],
    [1.25, 0.65, -0.2, -0.35],
    [-1.15, -0.7, 0.25, 0.45],
  ];
  for (const [x, y, z, rotation] of pairs) {
    const pair = new THREE.Group();
    for (const dx of [-0.34, 0.34]) {
      const cell = new THREE.Mesh(new THREE.SphereGeometry(0.46, 28, 20), body);
      cell.scale.set(0.72, 1, 0.82);
      cell.position.x = dx;
      cell.rotation.z = dx < 0 ? -0.22 : 0.22;
      pair.add(cell);
    }
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.86, 28, 20),
      capsule
    );
    halo.scale.set(1.05, 0.75, 0.72);
    pair.add(halo);
    pair.position.set(x, y, z);
    pair.rotation.z = rotation;
    g.add(pair);
  }
  g.scale.setScalar(0.72);
  return g;
}

function buildAcidFastRods(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.7 });
  const texture = mat(c2, { roughness: 0.65 });
  const positions: [number, number, number, number][] = [
    [0, 0, 0, 0.2],
    [1.15, 0.65, -0.2, -0.55],
    [-1.1, -0.65, 0.2, 0.6],
    [0.3, 1.25, -0.4, 1.0],
    [-0.45, -1.25, 0.3, -0.8],
  ];
  for (const [x, y, z, rotation] of positions) {
    const cell = rod(1.1, 0.22, body);
    cell.position.set(x, y, z);
    cell.rotation.z = rotation;
    g.add(cell);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), texture);
    bead.position.set(x, y, z + 0.21);
    g.add(bead);
  }
  g.scale.setScalar(0.68);
  return g;
}

function buildFlagellatedRods(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.5 });
  const flagella = mat(c2, { roughness: 0.6 });
  const positions: [number, number, number, number][] = [
    [0, 0, 0, 0.35],
    [1.2, 0.65, -0.25, -0.5],
    [-1.1, -0.7, 0.2, 0.7],
  ];
  for (const [x, y, z, rotation] of positions) {
    const cell = rod(1.0, 0.3, body);
    cell.position.set(x, y, z);
    cell.rotation.z = rotation;
    g.add(cell);
    for (let f = 0; f < 4; f++) {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        points.push(
          new THREE.Vector3(
            x +
              Math.cos(rotation) * (0.25 + t * 1.15) +
              Math.sin(t * 16 + f) * 0.12,
            y +
              Math.sin(rotation) * (0.25 + t * 1.15) +
              Math.cos(t * 13 + f) * 0.12,
            z + (f - 1.5) * 0.08 + Math.sin(t * 10) * 0.08
          )
        );
      }
      g.add(
        new THREE.Mesh(
          new THREE.TubeGeometry(
            new THREE.CatmullRomCurve3(points),
            36,
            0.025,
            6
          ),
          flagella
        )
      );
    }
  }
  g.scale.setScalar(0.65);
  return g;
}

function buildShortRods(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.55 });
  const tip = mat(c2, { roughness: 0.5 });
  const positions: [number, number, number, number][] = [
    [0, 0, 0, 0.2],
    [1.1, 0.7, -0.25, -0.5],
    [-1.1, -0.7, 0.2, 0.65],
    [0.1, 1.3, -0.4, 1.1],
    [-0.3, -1.25, 0.35, -0.9],
  ];
  for (const [x, y, z, rotation] of positions) {
    const cell = rod(0.7, 0.25, body);
    cell.position.set(x, y, z);
    cell.rotation.z = rotation;
    g.add(cell);
    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), tip);
    spot.position.set(x, y, z + 0.24);
    g.add(spot);
  }
  g.scale.setScalar(0.7);
  return g;
}

// ---- viruses -----------------------------------------------------------

function buildCorona(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.0, 3),
    mat(c, { roughness: 0.35, flatShading: false })
  );
  g.add(shell);
  // club-shaped spikes pointing outward (the "corona")
  const spikeMat = mat(c2, { roughness: 0.4 });
  const count = 60;
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963;
    const dir = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
    const spike = new THREE.Group();
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 0.4, 8),
      spikeMat
    );
    stalk.position.y = 1.0 + 0.2;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      spikeMat
    );
    head.position.y = 1.0 + 0.45;
    spike.add(stalk, head);
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(spike);
  }
  g.scale.setScalar(0.85);
  return g;
}

function buildEbola(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  // long filament curling into the iconic shepherd's-crook / "6"
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 100; i++) {
    const t = i / 100;
    // straight shaft then a hook at the top
    if (t < 0.62) {
      pts.push(new THREE.Vector3(0.0, -1.7 + t * 3.4, 0));
    } else {
      const a = (t - 0.62) / 0.38;
      const ang = a * Math.PI * 1.6;
      pts.push(
        new THREE.Vector3(
          0.55 * (1 - Math.cos(ang)),
          0.42 + 0.55 * Math.sin(ang),
          0.1 * Math.sin(ang * 1.5)
        )
      );
    }
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 160, 0.13, 14, false),
    mat(c, { roughness: 0.5 })
  );
  g.add(tube);
  // faint helical nucleocapsid ridge
  const ridgePts: THREE.Vector3[] = [];
  const frames = curve.computeFrenetFrames(160, false);
  for (let i = 0; i <= 160; i++) {
    const t = i / 160;
    const p = curve.getPoint(t);
    const n = frames.normals[i];
    const b = frames.binormals[i];
    const ang = t * 160;
    const off = n
      .clone()
      .multiplyScalar(Math.cos(ang) * 0.135)
      .add(b.clone().multiplyScalar(Math.sin(ang) * 0.135));
    ridgePts.push(p.clone().add(off));
  }
  const ridge = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(ridgePts),
      240,
      0.025,
      6,
      false
    ),
    mat(c2, { roughness: 0.6 })
  );
  g.add(ridge);
  g.scale.setScalar(0.85);
  return g;
}

function buildSmallpox(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  // rounded brick (poxvirus)
  const brick = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.3, 1.1, 4, 4, 4),
    mat(c, { roughness: 0.55 })
  );
  // round the corners a touch by scaling a slightly inflated sphere overlay? keep box.
  g.add(brick);
  // surface tubule texture: short criss-crossing ridges
  const ridge = mat(c2, { roughness: 0.6 });
  for (let i = 0; i < 26; i++) {
    const t = new THREE.Mesh(
      new THREE.TorusGeometry(0.18 + Math.random() * 0.1, 0.03, 6, 14),
      ridge
    );
    t.position.set(
      (Math.random() - 0.5) * 1.7,
      (Math.random() - 0.5) * 1.2,
      0.56 * (Math.random() > 0.5 ? 1 : -1)
    );
    t.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    g.add(t);
  }
  // inner dumbbell core hint (slightly visible through edges)
  const core = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.7, 8, 16),
    mat(c2, { roughness: 0.4, transparent: true, opacity: 0.5 })
  );
  core.rotation.z = Math.PI / 2;
  g.add(core);
  g.scale.setScalar(0.85);
  return g;
}

function buildRabies(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  // bullet shape: cylinder with one hemispherical (rounded) end and a flat base
  const body = mat(c, { roughness: 0.45 });
  const cyl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 1.7, 32),
    body
  );
  g.add(cyl);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    body
  );
  dome.position.y = 0.85;
  g.add(dome);
  const base = new THREE.Mesh(new THREE.CircleGeometry(0.6, 32), body);
  base.rotation.x = Math.PI / 2;
  base.position.y = -0.85;
  g.add(base);
  // surface ridges (the helical ribonucleoprotein striations)
  for (let i = 0; i < 9; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.61, 0.025, 6, 40),
      mat(c2, { roughness: 0.6 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.7 + i * 0.18;
    g.add(ring);
  }
  g.rotation.z = 0.5;
  g.scale.setScalar(0.95);
  return g;
}

function buildHIV(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  // spherical envelope
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.0, 2),
    mat(c, { roughness: 0.4, transparent: true, opacity: 0.92 })
  );
  g.add(shell);
  // gp120 "knobs" (mushroom glycoproteins) — fewer, stubbier than corona
  const knobMat = mat(c2, { roughness: 0.4 });
  const count = 22;
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963;
    const dir = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
    const knob = new THREE.Group();
    const stalk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.22, 8),
      knobMat
    );
    stalk.position.y = 1.0 + 0.11;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 12, 10),
      knobMat
    );
    head.position.y = 1.0 + 0.26;
    knob.add(stalk, head);
    knob.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(knob);
  }
  // conical capsid inside
  const capsid = new THREE.Mesh(
    new THREE.ConeGeometry(0.4, 1.1, 24, 1, true),
    mat(c2, { roughness: 0.5, side: THREE.DoubleSide })
  );
  capsid.rotation.z = 0.2;
  g.add(capsid);
  g.scale.setScalar(0.85);
  return g;
}

function buildSphericalVirus(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 4),
    mat(c, { roughness: 0.45 })
  );
  g.add(shell);
  addBumps(g, 72, 1.0, 0.07, mat(c2, { roughness: 0.5 }), 0.7);
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.48, 1),
    mat(c2, { transparent: true, opacity: 0.55, roughness: 0.4 })
  );
  g.add(core);
  g.scale.setScalar(0.86);
  return g;
}

// ---- prion -------------------------------------------------------------

function buildPrion(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  // tangled aggregate of twisted beta-sheet ribbons
  const ribbon = mat(c, {
    roughness: 0.5,
    side: THREE.DoubleSide,
    metalness: 0.1,
  });
  for (let s = 0; s < 5; s++) {
    const pts: THREE.Vector3[] = [];
    const ox = (Math.random() - 0.5) * 1.2;
    const oy = (Math.random() - 0.5) * 1.2;
    const oz = (Math.random() - 0.5) * 1.2;
    for (let i = 0; i <= 40; i++) {
      const t = i / 40;
      pts.push(
        new THREE.Vector3(
          ox + Math.sin(t * 9 + s) * 0.6 + Math.cos(t * 4) * 0.3,
          oy - 1.0 + t * 2.0,
          oz + Math.cos(t * 9 + s) * 0.6 + Math.sin(t * 5) * 0.3
        )
      );
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 80, 0.09, 4, false),
      s % 2 ? mat(c2, { roughness: 0.5 }) : ribbon
    );
    g.add(tube);
  }
  g.scale.setScalar(0.8);
  return g;
}

// ---- protozoa & amoebae -----------------------------------------------

function buildMalaria(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const blood = mat("#a82735", { roughness: 0.55 });
  const parasite = mat(c, {
    roughness: 0.4,
    emissive: new THREE.Color(c).multiplyScalar(0.12),
  });
  const nucleus = mat(c2, { roughness: 0.45 });
  const cells: [number, number, number, number][] = [
    [0, 0, 0, 0],
    [1.15, 0.65, -0.25, 0.35],
    [-1.1, -0.7, 0.25, -0.45],
  ];
  for (let index = 0; index < cells.length; index++) {
    const [x, y, z, rotation] = cells[index];
    const cell = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.3, 18, 44),
      blood
    );
    cell.scale.set(1, 1, 0.28);
    cell.position.set(x, y, z);
    cell.rotation.z = rotation;
    g.add(cell);
    if (index < 2) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.16, 0.045, 10, 28),
        parasite
      );
      ring.position.set(x + 0.08, y - 0.02, z + 0.1);
      ring.rotation.z = rotation + 0.4;
      g.add(ring);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 12, 10),
        nucleus
      );
      dot.position.set(x + 0.22, y + 0.08, z + 0.11);
      g.add(dot);
    }
  }
  g.scale.setScalar(0.78);
  return g;
}

function buildAmoeba(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const cytoplasm = mat(c, {
    transparent: true,
    opacity: 0.78,
    roughness: 0.55,
  });
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 3),
    cytoplasm
  );
  body.scale.set(1.15, 0.82, 0.9);
  g.add(body);
  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 24, 18),
    mat(c2, { roughness: 0.5 })
  );
  nucleus.position.set(-0.18, 0.1, 0.18);
  g.add(nucleus);
  const directions = [
    new THREE.Vector3(1, 0.2, 0.1),
    new THREE.Vector3(-1, -0.15, 0.2),
    new THREE.Vector3(0.25, 1, -0.15),
    new THREE.Vector3(-0.2, -1, 0.1),
    new THREE.Vector3(0.45, 0.25, 1),
    new THREE.Vector3(-0.3, 0.2, -1),
  ];
  for (const direction of directions) {
    const length = 0.4 + Math.random() * 0.4;
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.16, length, 8, 14),
      cytoplasm
    );
    const normal = direction.clone().normalize();
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    arm.position.copy(normal.multiplyScalar(0.85 + length * 0.35));
    g.add(arm);
  }
  for (let i = 0; i < 12; i++) {
    const vacuole = new THREE.Mesh(
      new THREE.SphereGeometry(0.05 + Math.random() * 0.07, 10, 8),
      mat("#d9f1e7", { transparent: true, opacity: 0.5, roughness: 0.3 })
    );
    vacuole.position
      .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .multiplyScalar(1.15);
    g.add(vacuole);
  }
  g.scale.setScalar(0.9);
  return g;
}

// ---- fungus ------------------------------------------------------------

function buildDeathcap(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  // a small mushroom silhouette + a scatter of amyloid spores
  const capMat = mat(c2, { roughness: 0.6 });
  const stemMat = mat(c, { roughness: 0.6 });
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    capMat
  );
  cap.scale.set(1, 0.6, 1);
  cap.position.y = 0.5;
  g.add(cap);
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.28, 1.2, 20),
    stemMat
  );
  stem.position.y = -0.1;
  g.add(stem);
  // volva (cup at the base) — the death-cap tell
  const volva = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    stemMat
  );
  volva.position.y = -0.72;
  g.add(volva);
  // floating spores
  const sporeMat = mat(c, {
    roughness: 0.3,
    emissive: new THREE.Color(c).multiplyScalar(0.15),
  });
  for (let i = 0; i < 18; i++) {
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), sporeMat);
    sp.scale.set(1, 1.25, 1);
    sp.position.set(
      (Math.random() - 0.5) * 2.6,
      -0.3 + Math.random() * 1.6,
      (Math.random() - 0.5) * 2.6
    );
    g.add(sp);
  }
  g.scale.setScalar(0.8);
  return g;
}

// ---- pollens -----------------------------------------------------------

function buildRagweed(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.95, 2),
    mat(c, { roughness: 0.55 })
  );
  g.add(body);
  // echinate spikes all over (cone spines)
  const spikeMat = mat(c2, { roughness: 0.5 });
  const count = 90;
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963;
    const dir = new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);
    const spine = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.32, 8),
      spikeMat
    );
    spine.position.copy(dir.clone().multiplyScalar(0.95 + 0.16));
    spine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(spine);
  }
  g.scale.setScalar(0.85);
  return g;
}

function buildGrassPollen(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 48, 36),
    mat(c, { roughness: 0.4 })
  );
  g.add(body);
  // single pore (annulus) on one side
  const pore = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.06, 10, 24),
    mat(c2, { roughness: 0.5 })
  );
  pore.position.set(0, 0, 1.0);
  g.add(pore);
  const lid = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), mat(c2));
  lid.position.set(0, 0, 1.0);
  g.add(lid);
  g.scale.setScalar(0.85);
  return g;
}

function buildBirchPollen(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(1.0, 48, 36),
    mat(c, { roughness: 0.45 })
  );
  body.scale.set(1.1, 1.1, 0.82); // oblate, triangular-ish
  g.add(body);
  // three protruding pores spaced around the equator
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
    const pore = new THREE.Mesh(
      new THREE.SphereGeometry(0.2, 16, 12),
      mat(c2, { roughness: 0.5 })
    );
    pore.position.copy(dir.clone().multiplyScalar(1.08));
    g.add(pore);
  }
  g.scale.setScalar(0.85);
  return g;
}

// ---- human (you) -------------------------------------------------------

function buildDNA(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const turns = 2.6;
  const height = 3.4;
  const radius = 0.62;
  const n = 220;
  const strandA: THREE.Vector3[] = [];
  const strandB: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const ang = t * turns * Math.PI * 2;
    const y = -height / 2 + t * height;
    strandA.push(
      new THREE.Vector3(Math.cos(ang) * radius, y, Math.sin(ang) * radius)
    );
    strandB.push(
      new THREE.Vector3(
        Math.cos(ang + Math.PI) * radius,
        y,
        Math.sin(ang + Math.PI) * radius
      )
    );
  }
  const backboneA = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(strandA),
      n,
      0.08,
      10,
      false
    ),
    mat(c, { roughness: 0.35, metalness: 0.2 })
  );
  const backboneB = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(strandB),
      n,
      0.08,
      10,
      false
    ),
    mat(c2, { roughness: 0.35, metalness: 0.2 })
  );
  g.add(backboneA, backboneB);
  // base-pair rungs
  const baseColors = ["#5ad1ff", "#ff7aa8", "#ffd166", "#8af0a8"];
  const rungs = 22;
  for (let i = 0; i < rungs; i++) {
    const idx = Math.round((i / (rungs - 1)) * n);
    const a = strandA[idx];
    const b = strandB[idx];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, len, 8),
      mat(baseColors[i % baseColors.length], { roughness: 0.4 })
    );
    rung.position.copy(mid);
    rung.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize()
    );
    g.add(rung);
  }
  return g;
}

function buildCell(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  // translucent cell membrane
  const membrane = new THREE.Mesh(
    new THREE.SphereGeometry(1.5, 48, 36),
    mat(c, { roughness: 0.2, transparent: true, opacity: 0.28, metalness: 0.0 })
  );
  g.add(membrane);
  // nucleus
  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(0.62, 32, 24),
    mat(c2, { roughness: 0.4, transparent: true, opacity: 0.85 })
  );
  nucleus.position.set(0.2, 0.1, 0);
  g.add(nucleus);
  const nucleolus = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 20, 16),
    mat("#274b73")
  );
  nucleolus.position.copy(nucleus.position);
  g.add(nucleolus);
  // mitochondria (capsule organelles) + vesicles
  for (let i = 0; i < 7; i++) {
    const mito = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.35, 8, 12),
      mat("#e8a05a", { roughness: 0.5 })
    );
    mito.position.set(
      (Math.random() - 0.5) * 2.0,
      (Math.random() - 0.5) * 2.0,
      (Math.random() - 0.5) * 2.0
    );
    mito.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    if (mito.position.length() > 1.35) mito.position.setLength(1.2);
    g.add(mito);
  }
  for (let i = 0; i < 10; i++) {
    const ves = new THREE.Mesh(
      new THREE.SphereGeometry(0.1 + Math.random() * 0.08, 12, 10),
      mat("#9ec9f0", { roughness: 0.4 })
    );
    ves.position
      .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .setLength(0.6 + Math.random() * 0.7);
    g.add(ves);
  }
  return g;
}

function buildHuman(c: string, c2: string): THREE.Group {
  const g = new THREE.Group();
  const skin = mat(c, { roughness: 0.7 });
  const add = (mesh: THREE.Mesh, x: number, y: number, z = 0) => {
    mesh.position.set(x, y, z);
    g.add(mesh);
    return mesh;
  };
  // head
  add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 18), skin), 0, 1.5);
  // torso
  const torso = add(
    new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.9, 12, 20), skin),
    0,
    0.62
  );
  torso.scale.set(1, 1, 0.6);
  // arms
  for (const sgn of [-1, 1]) {
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.12, 0.95, 8, 14),
      skin
    );
    arm.position.set(sgn * 0.55, 0.62, 0);
    arm.rotation.z = sgn * 0.18;
    g.add(arm);
  }
  // legs
  for (const sgn of [-1, 1]) {
    const leg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.15, 1.1, 8, 14),
      skin
    );
    leg.position.set(sgn * 0.2, -0.75, 0);
    g.add(leg);
  }
  g.position.y = -0.1;
  g.scale.setScalar(0.92);
  return g;
}

// ---- dispatch ----------------------------------------------------------

const BUILDERS: Record<string, (c: string, c2: string) => THREE.Group> = {
  meningococcus: buildMeningococcus,
  anthrax: buildAnthrax,
  plague: buildPlague,
  cholera: buildCholera,
  botulinum: buildBotulinum,
  tuberculosis: buildAcidFastRods,
  pneumococcus: buildPneumococcus,
  tetanus: buildBotulinum,
  ecoli: buildFlagellatedRods,
  salmonella: buildFlagellatedRods,
  listeria: buildShortRods,
  cdiff: buildBotulinum,
  sarscov2: buildCorona,
  influenza: buildSphericalVirus,
  "hepatitis-b": buildSphericalVirus,
  "hepatitis-c": buildSphericalVirus,
  dengue: buildSphericalVirus,
  mers: buildCorona,
  ebola: buildEbola,
  marburg: buildEbola,
  nipah: buildSphericalVirus,
  hantavirus: buildSphericalVirus,
  lassa: buildSphericalVirus,
  cchf: buildSphericalVirus,
  mpox: buildSmallpox,
  smallpox: buildSmallpox,
  rabies: buildRabies,
  hiv: buildHIV,
  prion: buildPrion,
  cjd: buildPrion,
  kuru: buildPrion,
  malaria: buildMalaria,
  balamuthia: buildAmoeba,
  naegleria: buildAmoeba,
  deathcap: buildDeathcap,
  ragweed: buildRagweed,
  grasspollen: buildGrassPollen,
  birchpollen: buildBirchPollen,
  dna: buildDNA,
  cell: buildCell,
  human: buildHuman,
};

export function buildSpecimenModel(
  id: string,
  color: string,
  color2: string
): THREE.Group {
  const fn = BUILDERS[id] || buildCorona;
  return fn(color, color2);
}
