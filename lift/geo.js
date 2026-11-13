// Общие построители геометрии для процедурных моделей.
import * as THREE from './vendor/three.module.min.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const spow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

// Монотонная кубическая интерполяция (Fritsch–Carlson), xs по возрастанию
export function monotone(xs, ys) {
  const n = xs.length, d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Фюзеляж: сечение-суперэллипс. rows: [x, W, Ht, Hb, C, nT, nB] по возрастанию x.
// cap: [где начинается скругление, острие, a, b] — профиль (1 − t^a)^b.
export function makeProfile(rows, capFront, capRear) {
  const xs = rows.map((r) => r[0]);
  const f = [1, 2, 3, 4, 5, 6].map((k) => monotone(xs, rows.map((r) => r[k])));
  const capK = (c, t) => Math.pow(Math.max(0, 1 - Math.pow(clamp(t, 0, 1), c[2] ?? 2)), c[3] ?? 0.5);
  const cap = (x) => {
    let k = 1;
    if (capFront && x > capFront[0]) k *= capK(capFront, (x - capFront[0]) / (capFront[1] - capFront[0]));
    if (capRear && x < capRear[0]) k *= capK(capRear, (capRear[0] - x) / (capRear[0] - capRear[1]));
    return k;
  };
  return {
    width: (x) => f[0](x) * cap(x),
    center: (x) => f[3](x),
    // th: −π/2 низ, 0 правый борт, π/2 верх, π левый борт
    point(x, th, grow = 0, out = new THREE.Vector3()) {
      const k = cap(x);
      const s = Math.sin(th), c = Math.cos(th);
      const up = s >= 0;
      const W = f[0](x) * k + grow;
      const H = (up ? f[1](x) : f[2](x)) * k + grow;
      const p = 2 / (up ? f[4](x) : f[5](x));
      return out.set(x, f[3](x) + H * spow(s, p), W * spow(c, p));
    },
  };
}

export function stations(xMin, xMax, step) {
  const xs = [xMax];
  let x = xMax;
  while (x > xMin) { x -= step(x); xs.push(Math.max(x, xMin)); }
  return xs; // по убыванию x
}

export function loft(profile, xs, nTh, uvOf) {
  const rows = xs.length, cols = nTh + 1;
  const pos = new Float32Array(rows * cols * 3);
  const uv = new Float32Array(rows * cols * 2);
  const v = new THREE.Vector3();
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const t = j / nTh;
      profile.point(xs[i], -Math.PI / 2 + t * TAU, 0, v);
      const k = i * cols + j;
      pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
      uv[k * 2] = uvOf ? uvOf(xs[i]) : i / (rows - 1);
      uv[k * 2 + 1] = t;
    }
  }
  const build = (flip) => {
    const idx = [];
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < nTh; j++) {
        const a = i * cols + j, b = (i + 1) * cols + j, c = a + 1, d = b + 1;
        if (flip) idx.push(a, b, c, c, b, d); else idx.push(a, c, b, c, d, b);
      }
    }
    return idx;
  };
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(build(false));
  g.computeVertexNormals();
  const probe = Math.floor(rows / 2) * cols + Math.round(nTh / 4);
  if (g.attributes.normal.getZ(probe) < 0) { g.setIndex(build(true)); g.computeVertexNormals(); }
  const n = g.attributes.normal;
  for (let i = 0; i < rows; i++) {
    const a = i * cols, b = a + nTh;
    const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
  }
  for (const i of [0, rows - 1]) {
    const dir = i === 0 ? Math.sign(xs[0] - xs[1]) : Math.sign(xs[rows - 1] - xs[rows - 2]);
    for (let j = 0; j < cols; j++) n.setXYZ(i * cols + j, dir, 0, 0);
  }
  return g;
}

// Участок поверхности фюзеляжа (стекло, решётки). map(u, v) → [x, θ]
export function patch(profile, nu, nv, map, grow, uvMap) {
  const pos = [], uv = [], idx = [];
  const v = new THREE.Vector3();
  for (let i = 0; i <= nu; i++) {
    for (let j = 0; j <= nv; j++) {
      const [x, th] = map(i / nu, j / nv);
      profile.point(x, th, grow, v);
      pos.push(v.x, v.y, v.z);
      if (uvMap) uv.push(...uvMap(i / nu, j / nv)); else uv.push(i / nu, j / nv);
    }
  }
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // треугольники наружу — стекло рисуется с одной стороны
  const [px, pth] = map(0.5, 0.5);
  const out = profile.point(px, pth, grow + 0.05).sub(profile.point(px, pth, grow));
  const mid = Math.floor(nu / 2) * (nv + 1) + Math.floor(nv / 2);
  const nrm = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, mid);
  if (nrm.dot(out) < 0) {
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

// Скруглённое окно (сквиркл)
export function roundPatch(profile, cx, cth, rx, rth, m, grow) {
  return patch(profile, 14, 48, (s, t) => {
    const a = t * TAU;
    return [cx + s * rx * spow(Math.cos(a), 2 / m), cth + s * rth * spow(Math.sin(a), 2 / m)];
  }, grow, (s, t) => {
    const a = t * TAU;
    return [0.5 + 0.5 * s * spow(Math.cos(a), 2 / m), 0.5 + 0.5 * s * spow(Math.sin(a), 2 / m)];
  });
}

export function surfaceTube(profile, pts, grow, radius, mat) {
  const v = pts.map(([x, th]) => profile.point(x, th, grow));
  const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 3), radius, 8, false), mat);
}

// Лофт из замкнутых сечений с заглушками (лопасти)
export function loftRings(rings) {
  const M = rings[0].length, R = rings.length;
  const pos = [], idx = [];
  for (const ring of rings) for (const p of ring) pos.push(p.x, p.y, p.z);
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j, b = i * M + ((j + 1) % M), c = a + M, d = b + M;
      idx.push(a, c, b, b, c, d);
    }
  }
  for (const [ri, flip] of [[0, true], [R - 1, false]]) {
    const ctr = new THREE.Vector3();
    rings[ri].forEach((p) => ctr.add(p));
    ctr.multiplyScalar(1 / M);
    const ci = pos.length / 3;
    pos.push(ctr.x, ctr.y, ctr.z);
    for (let j = 0; j < M; j++) {
      const a = ri * M + j, b = ri * M + ((j + 1) % M);
      if (flip) idx.push(ci, b, a); else idx.push(ci, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Открытая сетка из незамкнутых сечений
function loftOpen(rings) {
  const M = rings[0].length, R = rings.length;
  const pos = [], idx = [];
  for (const ring of rings) for (const p of ring) pos.push(p.x, p.y, p.z);
  for (let i = 0; i < R - 1; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = i * M + j, b = a + 1, c = a + M, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const yt = (a, t) => 5 * t * (0.2969 * Math.sqrt(a) - 0.126 * a - 0.3516 * a * a + 0.2843 * a ** 3 - 0.1036 * a ** 4);

// Симметричный профиль NACA 00xx: точки [доля хорды от носка, полутолщина]
export function airfoil(M, t) {
  const pts = [], half = M / 2;
  for (let i = 0; i < half; i++) { const a = (1 + Math.cos(Math.PI * i / half)) / 2; pts.push([a, yt(a, t)]); }
  for (let i = 0; i < half; i++) { const a = (1 - Math.cos(Math.PI * i / half)) / 2; pts.push([a, -yt(a, t)]); }
  return pts;
}

// Координата обвода профиля w: 0…1 — верх от задней кромки к носку, 1…2 — низ от носка назад
const foilA = (w) => (w <= 1 ? (1 + Math.cos(Math.PI * w)) / 2 : (1 - Math.cos(Math.PI * (w - 1))) / 2);
export const wUpper = (a) => Math.acos(2 * a - 1) / Math.PI;
export const wLower = (a) => 1 + Math.acos(1 - 2 * a) / Math.PI;

// Несущая поверхность (крыло, киль, стабилизатор) из полос с разными материалами.
// st: [{ O: носок, C: направление хорды, T: «верх» профиля, c: хорда, t: относительная толщина }]
// strips: [{ from, to, n, mat }] — диапазоны w
export function liftingSurface(st, strips, capMat, { capStart = false, capEnd = true } = {}) {
  const group = new THREE.Group();
  const pt = (s, w) => {
    const a = foilA(w);
    const y = (w <= 1 ? 1 : -1) * yt(a, s.t);
    return s.O.clone().addScaledVector(s.C, a * s.c).addScaledVector(s.T, y * s.c);
  };
  for (const sp of strips) {
    const rings = st.map((s) => {
      const r = [];
      for (let k = 0; k <= sp.n; k++) r.push(pt(s, sp.from + (sp.to - sp.from) * (k / sp.n)));
      return r;
    });
    group.add(new THREE.Mesh(loftOpen(rings), sp.mat));
  }
  const capAt = (s) => {
    const ring = [];
    for (let k = 0; k < 48; k++) ring.push(pt(s, (k / 48) * 2));
    const ctr = s.O.clone().addScaledVector(s.C, 0.4 * s.c);
    const pos = [ctr.x, ctr.y, ctr.z];
    ring.forEach((p) => pos.push(p.x, p.y, p.z));
    const idx = [];
    for (let k = 0; k < 48; k++) idx.push(0, 1 + k, 1 + ((k + 1) % 48));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new THREE.Mesh(g, capMat);
  };
  if (capStart) group.add(capAt(st[0]));
  if (capEnd) group.add(capAt(st[st.length - 1]));
  return group;
}

// Стандартный набор полос: металлический носок, шов руля/закрылка
export function surfaceStrips(paint, metal, seam) {
  return [
    { from: wUpper(0.12), to: wLower(0.12), n: 12, mat: metal },
    { from: wUpper(0.72), to: wUpper(0.12), n: 10, mat: paint },
    { from: wUpper(0.735), to: wUpper(0.72), n: 1, mat: seam },
    { from: 0, to: wUpper(0.735), n: 4, mat: paint },
    { from: wLower(0.12), to: 2, n: 12, mat: paint },
  ];
}

// Лопасть вдоль +X, носок к −Z, толщина по Y
export function bladeGeometry({ r0, r1, chord, t, pitch, twist, cone = 0, tipFrom = 1.1, tipChord = 0.55, tipSweep = 0.35, steps = 28 }) {
  const foil = airfoil(30, t);
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const r = r0 + (r1 - r0) * u;
    const span = (r - r0) / (tipFrom - r0 || 1);
    let c = chord, sweep = 0;
    if (r > tipFrom) {
      const k = (r - tipFrom) / (r1 - tipFrom);
      c = chord * (1 - (1 - tipChord) * k * k);
      sweep = chord * tipSweep * k * k;
    }
    const phi = pitch + twist * (1 - clamp(span, 0, 1));
    const cs = Math.cos(phi), sn = Math.sin(phi);
    rings.push(foil.map(([a, y]) => {
      const z = (a - 0.25) * c + sweep;
      const yy = y * c;
      return new THREE.Vector3(r, yy * cs - z * sn + r * Math.tan(cone), yy * sn + z * cs);
    }));
  }
  return loftRings(rings);
}

export function rod(a, b, r, mat, seg = 10) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), seg), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

// Шина: профиль со скруглёнными боковинами, ось вращения — Z
export function tireGeometry(R, width, seg = 40) {
  const r0 = R * 0.56, h = width / 2;
  const pts = [new THREE.Vector2(r0, -h * 0.85)];
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI;
    pts.push(new THREE.Vector2(R - h * 0.55 + Math.cos(a) * h * 0.55, Math.sin(a) * h));
  }
  pts.push(new THREE.Vector2(r0, h * 0.85));
  const g = new THREE.LatheGeometry(pts, seg);
  g.rotateX(Math.PI / 2);
  return g;
}

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let glow = null;
export function glowTexture() {
  if (glow) return glow;
  glow = canvasTex(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.6)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.1)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
  return glow;
}

// Огонёк: лампа + ореол. blink — сдвиг фазы для проблескового
export function addLight(parent, list, pos, size, blink) {
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03 * Math.max(1, size), 12, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  bulb.position.copy(pos);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffffff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sprite.position.copy(pos);
  sprite.scale.setScalar(size);
  parent.add(bulb, sprite);
  list.push({ glow: sprite, bulb, size, blink });
}

// яркость огней (в тёмной сцене гасим ореолы)
export function glowLevel(list, k) {
  for (const l of list) {
    l.glow.material.opacity = k;
    l.bulb.material.color.setScalar(0.25 + 0.75 * k);
  }
}

export function blinkLights(list, t) {
  for (const l of list) {
    if (l.blink === undefined) continue;
    const on = ((t + l.blink) % 1.3) < 0.08;
    l.glow.scale.setScalar(on ? l.size * 1.8 : 0.0001);
    l.bulb.visible = on;
  }
}
