export type RedbackMood =
  | "watching"
  | "rushing"
  | "repairing"
  | "annoyed"
  | "giving-up"
  | "gave-up";

export interface RedbackStatus {
  mood: RedbackMood;
  repairs: number;
  repairLimit: number;
  openHoles: number;
}

interface Point {
  x: number;
  y: number;
}

interface Strand {
  a: number;
  b: number;
  health: number;
}

interface Damage {
  id: number;
  x: number;
  y: number;
  strands: number[];
  repaired: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface Spider {
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  targetX: number;
  targetY: number;
  heading: number;
  mode: RedbackMood;
  phaseStarted: number;
  phaseDuration: number;
  damageId: number | null;
  dropOriginX: number;
  dropOriginY: number;
}

interface RedbackWebOptions {
  onStatus?: (status: RedbackStatus) => void;
}

const TAU = Math.PI * 2;
const REPAIR_LIMIT = 6;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function easeInOut(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
  const amount = clamp(
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    0,
    1
  );
  const x = start.x + amount * dx;
  const y = start.y + amount * dy;
  return Math.hypot(point.x - x, point.y - y);
}

function seeded(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

export class RedbackWeb {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly options: RedbackWebOptions;
  private readonly reduceMotion: boolean;
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private points: Point[] = [];
  private strands: Strand[] = [];
  private damages: Damage[] = [];
  private particles: Particle[] = [];
  private nextDamageId = 1;
  private repairs = 0;
  private pointer = { x: 0, y: 0, active: false };
  private spider: Spider = {
    x: 0,
    y: 0,
    fromX: 0,
    fromY: 0,
    targetX: 0,
    targetY: 0,
    heading: 0,
    mode: "watching",
    phaseStarted: 0,
    phaseDuration: 0,
    damageId: null,
    dropOriginX: 0,
    dropOriginY: 0,
  };

  constructor(canvas: HTMLCanvasElement, options: RedbackWebOptions = {}) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D is unavailable");
    this.canvas = canvas;
    this.context = context;
    this.options = options;
    this.reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
  }

  tear(x: number, y: number) {
    const radius = clamp(Math.min(this.width, this.height) * 0.085, 46, 92);
    const candidates = this.strands
      .map((strand, index) => ({
        index,
        distance: distanceToSegment(
          { x, y },
          this.points[strand.a],
          this.points[strand.b]
        ),
      }))
      .filter(candidate => this.strands[candidate.index].health > 0.1)
      .sort((a, b) => a.distance - b.distance);

    let broken = candidates
      .filter(candidate => candidate.distance < radius)
      .map(candidate => candidate.index);
    if (broken.length < 4)
      broken = candidates.slice(0, 7).map(item => item.index);
    broken = broken.slice(0, 22);
    for (const index of broken) this.strands[index].health = 0;

    const damage: Damage = {
      id: this.nextDamageId++,
      x,
      y,
      strands: broken,
      repaired: false,
    };
    this.damages.push(damage);
    this.spawnTearParticles(x, y, broken.length);

    if (this.spider.mode === "gave-up" || this.spider.mode === "giving-up") {
      this.emitStatus();
      return;
    }
    if (this.spider.mode === "watching" || this.spider.mode === "annoyed") {
      this.rushToNextDamage(performance.now());
    } else {
      this.emitStatus();
    }
  }

  setPointer(x: number, y: number, active: boolean) {
    this.pointer = { x, y, active };
  }

  reset() {
    this.repairs = 0;
    this.damages = [];
    this.particles = [];
    this.nextDamageId = 1;
    this.buildWeb();
    this.placeSpider();
    this.emitStatus();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.damages = [];
    this.particles = [];
    this.repairs = 0;
    this.nextDamageId = 1;
    this.buildWeb();
    this.placeSpider();
    this.emitStatus();
  }

  private buildWeb() {
    this.points = [];
    this.strands = [];
    const compact = this.width < 600;
    const spokes = compact ? 16 : 22;
    const rings = compact ? 7 : 10;
    const center = {
      x: this.width * (compact ? 0.5 : 0.54),
      y: this.height * 0.5,
    };
    const radiusX = Math.max(this.width * 0.55, 360);
    const radiusY = Math.max(this.height * 0.52, 300);
    this.points.push(center);

    for (let ring = 1; ring <= rings; ring++) {
      const radial = ring / rings;
      for (let spoke = 0; spoke < spokes; spoke++) {
        const noise = seeded(ring * 101 + spoke * 17);
        const angle =
          (spoke / spokes) * TAU + (noise - 0.5) * 0.055 * (1 - radial * 0.35);
        const warp = 1 + (seeded(spoke * 31 + ring * 7) - 0.5) * 0.08;
        this.points.push({
          x: center.x + Math.cos(angle) * radiusX * radial * warp,
          y: center.y + Math.sin(angle) * radiusY * radial * warp,
        });
      }
    }

    const pointIndex = (ring: number, spoke: number) =>
      ring === 0 ? 0 : 1 + (ring - 1) * spokes + ((spoke + spokes) % spokes);

    for (let spoke = 0; spoke < spokes; spoke++) {
      for (let ring = 0; ring < rings; ring++) {
        this.strands.push({
          a: pointIndex(ring, spoke),
          b: pointIndex(ring + 1, spoke),
          health: 1,
        });
      }
    }
    for (let ring = 1; ring <= rings; ring++) {
      for (let spoke = 0; spoke < spokes; spoke++) {
        this.strands.push({
          a: pointIndex(ring, spoke),
          b: pointIndex(ring, spoke + 1),
          health: 1,
        });
      }
    }
  }

  private placeSpider() {
    const point = this.points[Math.min(4, this.points.length - 1)] ?? {
      x: this.width * 0.5,
      y: this.height * 0.25,
    };
    this.spider = {
      x: point.x,
      y: point.y,
      fromX: point.x,
      fromY: point.y,
      targetX: point.x,
      targetY: point.y,
      heading: Math.PI / 2,
      mode: "watching",
      phaseStarted: performance.now(),
      phaseDuration: 0,
      damageId: null,
      dropOriginX: point.x,
      dropOriginY: point.y,
    };
  }

  private rushToNextDamage(now: number) {
    const next = this.damages.find(damage => !damage.repaired);
    if (!next) {
      this.spider.mode = this.repairs > 2 ? "annoyed" : "watching";
      this.spider.damageId = null;
      this.emitStatus();
      return;
    }
    const distance = Math.hypot(next.x - this.spider.x, next.y - this.spider.y);
    this.spider.fromX = this.spider.x;
    this.spider.fromY = this.spider.y;
    this.spider.targetX = next.x;
    this.spider.targetY = next.y;
    this.spider.heading = Math.atan2(
      next.y - this.spider.y,
      next.x - this.spider.x
    );
    this.spider.mode = "rushing";
    this.spider.phaseStarted = now;
    this.spider.phaseDuration = this.reduceMotion
      ? 120
      : clamp(distance / 1.05, 260, 850);
    this.spider.damageId = next.id;
    this.emitStatus();
  }

  private startGivingUp(now: number) {
    this.spider.mode = "giving-up";
    this.spider.phaseStarted = now;
    this.spider.phaseDuration = this.reduceMotion ? 300 : 1900;
    this.spider.dropOriginX = this.spider.x;
    this.spider.dropOriginY = this.spider.y;
    this.spider.damageId = null;
    this.emitStatus();
  }

  private updateSpider(now: number) {
    const elapsed = now - this.spider.phaseStarted;
    if (this.spider.mode === "rushing") {
      const progress = clamp(elapsed / this.spider.phaseDuration, 0, 1);
      const eased = easeInOut(progress);
      this.spider.x =
        this.spider.fromX + (this.spider.targetX - this.spider.fromX) * eased;
      this.spider.y =
        this.spider.fromY + (this.spider.targetY - this.spider.fromY) * eased;
      if (progress >= 1) {
        this.spider.mode = "repairing";
        this.spider.phaseStarted = now;
        this.spider.phaseDuration = this.reduceMotion ? 240 : 1500;
        this.emitStatus();
      }
      return;
    }

    if (this.spider.mode === "repairing") {
      const damage = this.damages.find(
        candidate => candidate.id === this.spider.damageId
      );
      if (!damage) {
        this.rushToNextDamage(now);
        return;
      }
      const progress = clamp(elapsed / this.spider.phaseDuration, 0, 1);
      for (const index of damage.strands)
        this.strands[index].health = easeInOut(progress);
      if (progress >= 1) {
        damage.repaired = true;
        this.repairs++;
        if (this.repairs >= REPAIR_LIMIT) this.startGivingUp(now);
        else this.rushToNextDamage(now);
      }
      return;
    }

    if (this.spider.mode === "giving-up") {
      const progress = clamp(elapsed / this.spider.phaseDuration, 0, 1);
      const shake = progress < 0.28 ? Math.sin(elapsed * 0.09) * 7 : 0;
      const drop = clamp((progress - 0.28) / 0.72, 0, 1);
      this.spider.x = this.spider.dropOriginX + shake;
      this.spider.y =
        this.spider.dropOriginY + easeInOut(drop) * (this.height + 100);
      this.spider.heading = Math.PI / 2;
      if (progress >= 1) {
        this.spider.mode = "gave-up";
        this.emitStatus();
      }
      return;
    }

    if (this.spider.mode === "watching" || this.spider.mode === "annoyed") {
      const idle = this.reduceMotion ? 0 : Math.sin(now * 0.0014) * 4;
      const anchor = this.points[Math.min(4, this.points.length - 1)];
      if (anchor) {
        this.spider.x += (anchor.x + idle - this.spider.x) * 0.025;
        this.spider.y += (anchor.y - this.spider.y) * 0.025;
      }
    }
  }

  private spawnTearParticles(x: number, y: number, strength: number) {
    const count = clamp(strength, 8, 18);
    for (let index = 0; index < count; index++) {
      const angle = seeded(this.nextDamageId * 53 + index * 11) * TAU;
      const speed = 18 + seeded(index * 71 + this.nextDamageId) * 55;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.45 + seeded(index * 19) * 0.45,
      });
    }
  }

  private updateParticles(delta: number) {
    for (const particle of this.particles) {
      particle.life += delta;
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= 0.97;
      particle.vy *= 0.97;
    }
    this.particles = this.particles.filter(
      particle => particle.life < particle.maxLife
    );
  }

  private drawBackground(now: number) {
    const context = this.context;
    const glow = context.createRadialGradient(
      this.width * 0.52,
      this.height * 0.42,
      0,
      this.width * 0.52,
      this.height * 0.42,
      Math.max(this.width, this.height) * 0.72
    );
    glow.addColorStop(0, "#171b1d");
    glow.addColorStop(0.5, "#090b0c");
    glow.addColorStop(1, "#020303");
    context.fillStyle = glow;
    context.fillRect(0, 0, this.width, this.height);

    context.save();
    context.globalAlpha = 0.08;
    for (let index = 0; index < 80; index++) {
      const x = seeded(index * 23) * this.width;
      const y = seeded(index * 41 + 5) * this.height;
      const pulse = 0.45 + Math.sin(now * 0.0004 + index) * 0.15;
      context.fillStyle = `rgba(207,225,219,${pulse})`;
      context.fillRect(x, y, 1, 1);
    }
    context.restore();
  }

  private drawWeb(now: number) {
    const context = this.context;
    const pointerPull = this.pointer.active ? 1 : 0;
    context.save();
    context.lineCap = "round";
    context.shadowColor = "rgba(206, 229, 222, 0.25)";
    context.shadowBlur = 5;

    for (let index = 0; index < this.strands.length; index++) {
      const strand = this.strands[index];
      if (strand.health <= 0.01) continue;
      const start = this.points[strand.a];
      const end = this.points[strand.b];
      const midX = (start.x + end.x) * 0.5;
      const midY = (start.y + end.y) * 0.5;
      const sway = this.reduceMotion
        ? 0
        : Math.sin(now * 0.0008 + index * 0.63) * 1.8;
      const pointerDistance = Math.hypot(
        midX - this.pointer.x,
        midY - this.pointer.y
      );
      const pull = pointerPull * clamp(1 - pointerDistance / 180, 0, 1) * 5;
      const controlX = midX + sway + (this.pointer.x - midX) * pull * 0.015;
      const controlY = midY + sway + (this.pointer.y - midY) * pull * 0.015;
      const edgeFade = clamp(
        1 -
          Math.max(
            Math.abs(midX - this.width / 2) / (this.width * 0.68),
            Math.abs(midY - this.height / 2) / (this.height * 0.7)
          ),
        0.08,
        1
      );
      context.strokeStyle = `rgba(205, 224, 218, ${
        strand.health * edgeFade * 0.6
      })`;
      context.lineWidth = 0.55 + strand.health * 0.55;
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.quadraticCurveTo(controlX, controlY, end.x, end.y);
      context.stroke();
    }
    context.restore();

    context.save();
    context.fillStyle = "rgba(220, 239, 232, 0.8)";
    for (const particle of this.particles) {
      context.globalAlpha = 1 - particle.life / particle.maxLife;
      context.beginPath();
      context.arc(particle.x, particle.y, 1.2, 0, TAU);
      context.fill();
    }
    context.restore();
  }

  private drawRepairThread(now: number) {
    if (this.spider.mode !== "repairing") return;
    const damage = this.damages.find(
      candidate => candidate.id === this.spider.damageId
    );
    if (!damage) return;
    const progress = clamp(
      (now - this.spider.phaseStarted) / this.spider.phaseDuration,
      0,
      1
    );
    const angle = progress * TAU * 3;
    const radius = (1 - progress) * 32 + 8;
    this.context.save();
    this.context.strokeStyle = "rgba(245, 248, 238, 0.85)";
    this.context.lineWidth = 1.1;
    this.context.setLineDash([3, 4]);
    this.context.beginPath();
    this.context.moveTo(this.spider.x, this.spider.y);
    this.context.lineTo(
      damage.x + Math.cos(angle) * radius,
      damage.y + Math.sin(angle) * radius
    );
    this.context.stroke();
    this.context.restore();
  }

  private drawSpider(now: number) {
    if (this.spider.mode === "gave-up") return;
    const context = this.context;
    const scale = clamp(Math.min(this.width, this.height) / 760, 0.72, 1.15);
    const rush = this.spider.mode === "rushing";
    const repair = this.spider.mode === "repairing";
    const legPhase = rush ? now * 0.025 : now * 0.006;
    const bodyBob = this.reduceMotion
      ? 0
      : Math.sin(legPhase) * (rush ? 2 : 0.8);

    if (this.spider.mode === "giving-up") {
      context.save();
      context.strokeStyle = "rgba(221, 231, 226, 0.6)";
      context.lineWidth = 0.8;
      context.beginPath();
      context.moveTo(this.spider.dropOriginX, this.spider.dropOriginY);
      context.lineTo(this.spider.x, this.spider.y);
      context.stroke();
      context.restore();
    }

    context.save();
    context.translate(this.spider.x, this.spider.y + bodyBob);
    context.rotate(this.spider.heading - Math.PI / 2);
    context.scale(scale, scale);
    context.shadowColor = "rgba(0,0,0,0.9)";
    context.shadowBlur = 10;

    context.strokeStyle = "#111516";
    context.lineWidth = 3.2;
    context.lineCap = "round";
    for (const side of [-1, 1]) {
      for (let leg = 0; leg < 4; leg++) {
        const startY = -9 + leg * 7;
        const gait = Math.sin(legPhase + leg * 1.6) * (rush ? 5 : 2);
        const jointX = side * (17 + leg * 1.5);
        const jointY = startY + gait;
        const footX = side * (31 + (leg % 2) * 5);
        const footY = startY + (leg - 1.5) * 6 - gait * 0.45;
        context.beginPath();
        context.moveTo(side * 5, startY);
        context.lineTo(jointX, jointY);
        context.lineTo(footX, footY);
        context.stroke();
      }
    }

    const abdomen = context.createRadialGradient(-5, -8, 2, 0, 0, 24);
    abdomen.addColorStop(0, "#303638");
    abdomen.addColorStop(0.35, "#111516");
    abdomen.addColorStop(1, "#020303");
    context.fillStyle = abdomen;
    context.beginPath();
    context.ellipse(0, 5, 14, 19, 0, 0, TAU);
    context.fill();

    context.fillStyle = "#0b0e0f";
    context.beginPath();
    context.ellipse(0, -12, 9, 10, 0, 0, TAU);
    context.fill();

    context.shadowBlur = 8;
    context.shadowColor = "rgba(235,32,43,0.7)";
    context.fillStyle = repair ? "#ff4650" : "#d71928";
    context.beginPath();
    context.moveTo(-5, -1);
    context.quadraticCurveTo(0, -7, 5, -1);
    context.lineTo(3.2, 8);
    context.quadraticCurveTo(0, 13, -3.2, 8);
    context.closePath();
    context.fill();

    context.shadowBlur = 0;
    context.fillStyle = "rgba(255,255,255,0.24)";
    context.beginPath();
    context.ellipse(-4, -1, 2.2, 5.5, -0.4, 0, TAU);
    context.fill();
    context.restore();
  }

  private drawVignette() {
    const context = this.context;
    const vignette = context.createRadialGradient(
      this.width / 2,
      this.height / 2,
      Math.min(this.width, this.height) * 0.24,
      this.width / 2,
      this.height / 2,
      Math.max(this.width, this.height) * 0.7
    );
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.68)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, this.width, this.height);
  }

  private emitStatus() {
    this.options.onStatus?.({
      mood: this.spider.mode,
      repairs: this.repairs,
      repairLimit: REPAIR_LIMIT,
      openHoles: this.damages.filter(damage => !damage.repaired).length,
    });
  }

  private animate = (now: number) => {
    const previous = this.lastFrame || now;
    const delta = Math.min((now - previous) / 1000, 0.05);
    this.lastFrame = now;
    this.updateSpider(now);
    this.updateParticles(delta);
    this.drawBackground(now);
    this.drawWeb(now);
    this.drawRepairThread(now);
    this.drawSpider(now);
    this.drawVignette();
    this.frame = requestAnimationFrame(this.animate);
  };

  private lastFrame = 0;
}
