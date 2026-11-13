// Процедурная модель вертолёта (без внешних 3D-файлов).
// Единица длины ≈ 1 метр. Нос смотрит в +X, верх +Y, правый борт +Z.
import * as THREE from './vendor/three.module.min.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const spow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);

export const MAST = new THREE.Vector3(0.15, 0, 0); // ось несущего винта
export const SKID_Y = -1.5;                          // низ полозьев

const X_NOSE = 2.18;
const X_TAIL = -6.42;

const COLORS = {
  white: '#e7eaee',
  graphite: '#20262e',
  amber: '#f2b134',
  seam: 'rgba(16, 22, 30, 0.55)',
};

/* ---------- математика профилей ---------- */

// Монотонная кубическая интерполяция (Fritsch–Carlson), xs по возрастанию
function monotone(xs, ys) {
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

// Сечение — суперэллипс: полуширина W, высота вверх Ht, вниз Hb, центр C, степени nT/nB.
// capFront / capRear — эллиптические «шапки» на концах: [где начинается, где острие].
function makeProfile(rows, capFront, capRear) {
  const xs = rows.map((r) => r[0]);
  const f = [1, 2, 3, 4, 5, 6].map((k) => monotone(xs, rows.map((r) => r[k])));
  const cap = (x) => {
    let k = 1;
    if (capFront && x > capFront[0]) {
      const t = clamp((x - capFront[0]) / (capFront[1] - capFront[0]), 0, 1);
      k *= Math.sqrt(Math.max(0, 1 - t * t));
    }
    if (capRear && x < capRear[0]) {
      const t = clamp((capRear[0] - x) / (capRear[0] - capRear[1]), 0, 1);
      k *= Math.sqrt(Math.max(0, 1 - t * t));
    }
    return k;
  };
  return {
    width: (x) => f[0](x) * cap(x),
    // th: -π/2 низ, 0 правый борт, π/2 верх, π левый борт
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

//              x      W      Ht     Hb     C      nT   nB
const BODY_ROWS = [
  [-6.42, 0.085, 0.100, 0.085, 0.585, 2.0, 2.0],
  [-6.00, 0.095, 0.115, 0.095, 0.575, 2.0, 2.0],
  [-4.60, 0.125, 0.150, 0.125, 0.550, 2.1, 2.1],
  [-3.20, 0.150, 0.175, 0.150, 0.520, 2.1, 2.1],
  [-2.40, 0.190, 0.220, 0.180, 0.490, 2.2, 2.2],
  [-1.95, 0.300, 0.360, 0.240, 0.420, 2.3, 2.4],
  [-1.50, 0.520, 0.640, 0.400, 0.290, 2.4, 2.7],
  [-1.00, 0.720, 0.870, 0.600, 0.150, 2.5, 3.0],
  [-0.40, 0.810, 0.950, 0.700, 0.090, 2.5, 3.2],
  [ 0.30, 0.830, 0.970, 0.730, 0.080, 2.5, 3.2],
  [ 0.90, 0.810, 0.950, 0.710, 0.060, 2.4, 3.0],
  [ 1.35, 0.760, 0.870, 0.660, 0.020, 2.3, 2.8],
  [ 1.70, 0.680, 0.760, 0.600, -0.040, 2.2, 2.5],
  [ 2.20, 0.600, 0.660, 0.550, -0.120, 2.0, 2.2],
];

const COWL_ROWS = [
  [-2.20, 0.260, 0.220, 0.260, 0.900, 2.4, 2.4],
  [-1.60, 0.400, 0.290, 0.300, 0.970, 2.6, 2.6],
  [-0.80, 0.480, 0.330, 0.300, 1.000, 2.8, 2.8],
  [ 0.00, 0.490, 0.330, 0.300, 1.000, 2.8, 2.8],
  [ 0.66, 0.420, 0.260, 0.300, 0.950, 2.6, 2.6],
];

// Нижняя граница стекла кабины (угол θ в зависимости от x)
const canopyLow = monotone([0.75, 0.9, 1.3, 1.7, 2.0, 2.2], [0.52, 0.30, -0.02, -0.40, -0.78, -1.05]);
// Граница тёмной нижней окраски
const liveryLine = monotone([-6.42, -2.4, -1.2, 0, 1.2, 2.18], [0.22, 0.18, 0.02, -0.12, -0.24, -0.34]);
const CANOPY_X0 = 0.75;

/* ---------- построители геометрии ---------- */

function stations(xMin, xMax, step) {
  const xs = [xMax];
  let x = xMax;
  while (x > xMin) { x -= step(x); xs.push(Math.max(x, xMin)); }
  return xs; // по убыванию x: от носа к хвосту
}

function loft(profile, xs, nTh, uvOf) {
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
  // нормали должны смотреть наружу: проверяем на правом борту середины
  const probe = Math.floor(rows / 2) * cols + Math.round(nTh / 4);
  if (g.attributes.normal.getZ(probe) < 0) { g.setIndex(build(true)); g.computeVertexNormals(); }
  const n = g.attributes.normal;
  for (let i = 0; i < rows; i++) {
    const a = i * cols, b = a + nTh;
    const nx = n.getX(a) + n.getX(b), ny = n.getY(a) + n.getY(b), nz = n.getZ(a) + n.getZ(b);
    const l = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / l, ny / l, nz / l); n.setXYZ(b, nx / l, ny / l, nz / l);
  }
  // полюса (острие носа и хвоста)
  for (const i of [0, rows - 1]) {
    const dir = i === 0 ? Math.sign(xs[0] - xs[1]) : Math.sign(xs[rows - 1] - xs[rows - 2]);
    for (let j = 0; j < cols; j++) n.setXYZ(i * cols + j, dir, 0, 0);
  }
  return g;
}

// Прямоугольный (в координатах x/θ) участок поверхности
function patch(profile, nu, nv, map, grow, uvMap) {
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
  // разворачиваем треугольники наружу, чтобы стекло можно было рисовать с одной стороны
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

// Скруглённое окно (сквиркл) на поверхности
function roundPatch(profile, cx, cth, rx, rth, m, grow) {
  return patch(profile, 18, 64, (s, t) => {
    const a = t * TAU;
    return [cx + s * rx * spow(Math.cos(a), 2 / m), cth + s * rth * spow(Math.sin(a), 2 / m)];
  }, grow, (s, t) => {
    const a = t * TAU;
    return [0.5 + 0.5 * s * spow(Math.cos(a), 2 / m), 0.5 + 0.5 * s * spow(Math.sin(a), 2 / m)];
  });
}

function surfaceTube(profile, pts, grow, radius, mat) {
  const v = pts.map(([x, th]) => profile.point(x, th, grow));
  const curve = new THREE.CatmullRomCurve3(v, false, 'centripetal');
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 3), radius, 8, false), mat);
}

// Лофт из замкнутых сечений (лопасти, стабилизатор)
function loftRings(rings) {
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

// Симметричный профиль NACA 00xx: точки [доля хорды от носка, полутолщина]
function airfoil(M, t) {
  const yt = (a) => 5 * t * (0.2969 * Math.sqrt(a) - 0.126 * a - 0.3516 * a * a + 0.2843 * a ** 3 - 0.1036 * a ** 4);
  const pts = [], half = M / 2;
  for (let i = 0; i < half; i++) { const a = (1 + Math.cos(Math.PI * i / half)) / 2; pts.push([a, yt(a)]); }
  for (let i = 0; i < half; i++) { const a = (1 - Math.cos(Math.PI * i / half)) / 2; pts.push([a, -yt(a)]); }
  return pts;
}

// Лопасть вдоль +X, носок к −Z, толщина по Y
function bladeGeometry({ r0, r1, chord, t, pitch, twist, cone = 0, tipFrom = 1.1, tipChord = 0.55, tipSweep = 0.35, steps = 28 }) {
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
    const ring = foil.map(([a, y]) => {
      const z = (a - 0.25) * c + sweep;
      const yy = y * c;
      return new THREE.Vector3(r, yy * cs - z * sn + r * Math.tan(cone), yy * sn + z * cs);
    });
    rings.push(ring);
  }
  return loftRings(rings);
}

function rod(a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 10), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/* ---------- текстуры ---------- */

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function paintLivery(body) {
  const W = 2048, H = 1024;
  const U = (x) => (X_NOSE - x) / (X_NOSE - X_TAIL);
  const px = (x) => U(x) * W;
  const py = (th) => (1 - (th + Math.PI / 2) / TAU) * H;
  const mirror = (th) => Math.PI - th;

  return canvasTex(W, H, (g) => {
    g.fillStyle = COLORS.white;
    g.fillRect(0, 0, W, H);

    // полоса = граница + отступ, ширина задаётся в метрах, поэтому на тонкой балке она не исчезает
    const band = (fromM, toM) => (x) => {
      const R = Math.max(0.09, body.width(x));
      return [liveryLine(x) + fromM / R, liveryLine(x) + toM / R];
    };
    const fillBetween = (lo, hi, side) => {
      const xs = [];
      for (let x = X_NOSE; x >= X_TAIL - 0.001; x -= 0.02) xs.push(x);
      g.beginPath();
      xs.forEach((x, i) => {
        let [a] = [lo(x)];
        if (side === 'port') a = mirror(a);
        i ? g.lineTo(px(x), py(a)) : g.moveTo(px(x), py(a));
      });
      for (let i = xs.length - 1; i >= 0; i--) {
        let b = hi(xs[i]);
        if (side === 'port') b = mirror(b);
        g.lineTo(px(xs[i]), py(b));
      }
      g.closePath();
      g.fill();
    };

    // тёмный низ
    g.fillStyle = COLORS.graphite;
    fillBetween(() => -Math.PI / 2, liveryLine, 'stbd');
    fillBetween(() => -Math.PI / 2, liveryLine, 'port');
    // янтарная полоса
    g.fillStyle = COLORS.amber;
    const b = band(0.028, 0.085);
    fillBetween((x) => b(x)[0], (x) => b(x)[1], 'stbd');
    fillBetween((x) => b(x)[0], (x) => b(x)[1], 'port');

    // кончик носа под остеклением — тёмный, чтобы не светился «линзой»
    g.fillStyle = COLORS.graphite;
    g.fillRect(0, 0, px(2.0), H);

    // швы панелей и двери
    g.strokeStyle = COLORS.seam;
    g.lineWidth = 2.4;
    g.lineJoin = 'round';
    const seam = (pts) => {
      for (const side of ['stbd', 'port']) {
        g.beginPath();
        pts.forEach(([x, th], i) => {
          const t = side === 'port' ? mirror(th) : th;
          i ? g.lineTo(px(x), py(t)) : g.moveTo(px(x), py(t));
        });
        g.stroke();
      }
    };
    seam([[1.12, canopyLow(1.12)], [1.12, -0.55], [0.44, -0.55], [0.44, 1.05]]);          // передняя дверь
    seam([[0.36, 1.0], [0.36, -0.52], [-0.64, -0.52], [-0.64, 1.0], [0.36, 1.0]]);          // сдвижная дверь
    seam([[-1.05, 0.55], [-1.05, -0.2], [-1.45, -0.05], [-1.45, 0.62], [-1.05, 0.55]]);      // багажный люк
    seam([[-0.5, -1.2], [1.6, -1.2]]);                                                       // киль днища
    // ручки дверей
    g.fillStyle = 'rgba(16,22,30,0.75)';
    for (const [x, th] of [[0.56, 0.05], [0.2, 0.08]]) {
      for (const t of [th, mirror(th)]) g.fillRect(px(x) - 14, py(t) - 5, 28, 10);
    }
    // стыки хвостовой балки с заклёпками
    for (const x of [-2.35, -4.25]) {
      g.strokeStyle = COLORS.seam;
      g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), H); g.stroke();
      g.fillStyle = 'rgba(16,22,30,0.45)';
      for (let y = 6; y < H; y += 18) { g.beginPath(); g.arc(px(x) - 7, y, 2.2, 0, TAU); g.fill(); }
    }

    // надпись на балке (с учётом разного масштаба развёртки)
    const label = (text, xc, thc, hM, side) => {
      const R = Math.max(0.09, body.width(xc));
      const pv = (H / TAU) / R, ph = W / (X_NOSE - X_TAIL);
      g.save();
      g.translate(px(xc), py(side === 'port' ? mirror(thc) : thc));
      if (side === 'port') g.scale(ph / pv, -1); else g.scale(-ph / pv, 1);
      g.font = `600 ${Math.round(hM * pv / 0.72)}px Tektur, "Arial Narrow", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(231,234,238,0.92)';
      g.fillText(text, 0, 0);
      g.restore();
    };
    label('AERIS H7', -3.25, -0.26, 0.085, 'stbd');
    label('AERIS H7', -3.25, -0.26, 0.085, 'port');
  });
}

function grilleTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#0b0e12';
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h; y += 22) {
      const grd = g.createLinearGradient(0, y, 0, y + 12);
      grd.addColorStop(0, '#5b636d');
      grd.addColorStop(1, '#22272e');
      g.fillStyle = grd;
      g.fillRect(0, y, w, 12);
    }
  });
}

function finDecal() {
  return canvasTex(512, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = '700 170px Tektur, "Arial Narrow", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = COLORS.graphite;
    g.fillText('H7', w / 2, h / 2 + 8);
  });
}

export function glowTexture() {
  return canvasTex(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.18, 'rgba(255,255,255,0.65)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, w);
  });
}

/* ---------- сборка ---------- */

export function buildHelicopter({ lowDetail = false } = {}) {
  const group = new THREE.Group();          // точка вращения — ось винта
  const inner = new THREE.Group();
  inner.position.x = -MAST.x;
  group.add(inner);

  const body = makeProfile(BODY_ROWS, [1.25, X_NOSE], [-6.2, X_TAIL]);
  const cowl = makeProfile(COWL_ROWS, [0.2, 0.64], [-1.7, -2.18]);

  const paint = { roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.1 };
  const M = {
    body: new THREE.MeshPhysicalMaterial({ ...paint, map: paintLivery(body) }),
    white: new THREE.MeshPhysicalMaterial({ ...paint, color: COLORS.white }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#09111a', roughness: 0.03, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02,
      envMapIntensity: 2.0, transparent: true, opacity: 0.86,
    }),
    cabin: new THREE.MeshStandardMaterial({ color: '#1a1f26', roughness: 0.85, metalness: 0.1, side: THREE.BackSide, envMapIntensity: 0.25 }),
    seat: new THREE.MeshStandardMaterial({ color: '#30343b', roughness: 0.75, envMapIntensity: 0.4 }),
    dash: new THREE.MeshStandardMaterial({ color: '#0f1216', roughness: 0.7, envMapIntensity: 0.4 }),
    frame: new THREE.MeshStandardMaterial({ color: '#13171c', roughness: 0.5, metalness: 0.3 }),
    graphite: new THREE.MeshStandardMaterial({ color: COLORS.graphite, roughness: 0.45, metalness: 0.35 }),
    steel: new THREE.MeshStandardMaterial({ color: '#a7b0ba', roughness: 0.26, metalness: 1 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: '#4b525b', roughness: 0.34, metalness: 0.9 }),
    blade: new THREE.MeshStandardMaterial({ color: '#1b1f25', roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide }),
    amber: new THREE.MeshPhysicalMaterial({ color: COLORS.amber, roughness: 0.38, clearcoat: 0.7, side: THREE.DoubleSide }),
    grille: new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.55, metalness: 0.6, side: THREE.DoubleSide }),
    exhaust: new THREE.MeshStandardMaterial({ color: '#463c36', roughness: 0.42, metalness: 0.85, side: THREE.DoubleSide }),
    soot: new THREE.MeshBasicMaterial({ color: '#050607', side: THREE.DoubleSide }),
  };
  const add = (mesh, parent = inner) => { parent.add(mesh); return mesh; };
  const seg = lowDetail ? 0.7 : 1;

  // Фюзеляж + хвостовая балка
  const xs = stations(X_TAIL, X_NOSE, (x) => {
    if (x > 1.95 || x < -6.15) return 0.014 / seg;
    if (x > 1.1) return 0.03 / seg;
    if (x > -2.5) return 0.045 / seg;
    return 0.12 / seg;
  });
  const fuselageGeo = loft(body, xs, Math.round(128 * seg), (x) => (X_NOSE - x) / (X_NOSE - X_TAIL));
  const fuselage = add(new THREE.Mesh(fuselageGeo, M.body));
  fuselage.receiveShadow = true;

  // Салон: внутренняя обшивка, кресла, приборная панель с дисплеями
  const interior = new THREE.Group();
  add(interior);
  interior.add(new THREE.Mesh(fuselageGeo, M.cabin));
  const seat = (x, z, w) => {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.1, w), M.seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, w), M.seat);
    back.position.set(-0.22, 0.31, 0); back.rotation.z = 0.14;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, w * 0.55), M.seat);
    head.position.set(-0.3, 0.72, 0); head.rotation.z = 0.14;
    g.add(base, back, head);
    g.position.set(x, -0.3, z);
    return g;
  };
  interior.add(seat(1.0, 0.36, 0.42), seat(1.0, -0.36, 0.42), seat(-0.22, 0, 1.18));
  const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.96), M.dash);
  dash.position.set(1.55, -0.05, 0);
  const shield = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 1.0), M.dash);
  shield.position.set(1.5, 0.1, 0);
  interior.add(dash, shield);
  for (const [z, color] of [[0.24, '#55c8ff'], [-0.24, '#55c8ff'], [0, '#f2b134']]) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(z ? 0.26 : 0.14, 0.17), new THREE.MeshBasicMaterial({ color }));
    scr.material.color.multiplyScalar(z ? 0.9 : 0.75);
    scr.position.set(1.465, -0.03, z);
    scr.rotation.y = -Math.PI / 2;
    interior.add(scr);
  }
  for (const z of [0.36, -0.36]) interior.add(rod(new THREE.Vector3(1.24, -0.52, z), new THREE.Vector3(1.28, -0.1, z), 0.016, M.graphite));

  // Капот двигателя
  const cowlMesh = add(new THREE.Mesh(loft(cowl, stations(-2.18, 0.64, (x) => (x > 0.3 || x < -1.8 ? 0.016 : 0.05)), 96), M.white));
  cowlMesh.receiveShadow = true;
  // Воздухозаборники
  for (const th of [0.34, Math.PI - 0.34]) add(new THREE.Mesh(roundPatch(cowl, 0.0, th, 0.3, 0.27, 5, 0.006), M.grille));
  // Выхлоп
  const exhaust = new THREE.Group();
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.52, 32, 1, true), M.exhaust);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 10, 40), M.exhaust);
  lip.position.y = 0.26; lip.rotation.x = Math.PI / 2;
  const plug = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), M.soot);
  plug.position.y = 0.2; plug.rotation.x = -Math.PI / 2;
  exhaust.add(pipe, lip, plug);
  exhaust.position.set(-1.98, 1.02, 0);
  exhaust.rotation.z = Math.PI / 2 + 0.26;
  add(exhaust);

  // Остекление кабины
  const canopyMap = (u, v) => {
    const x = CANOPY_X0 + u * (X_NOSE - 0.012 - CANOPY_X0);
    const lo = canopyLow(x);
    return [x, lo + v * (Math.PI - 2 * lo)];
  };
  add(new THREE.Mesh(patch(body, Math.round(90 * seg), Math.round(80 * seg), canopyMap, 0.008), M.glass));
  // Окна сдвижных дверей
  for (const th of [0.42, Math.PI - 0.42]) {
    add(new THREE.Mesh(roundPatch(body, -0.13, th, 0.36, 0.3, 4, 0.008), M.glass));
    const ring = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      ring.push([-0.13 + 0.36 * spow(Math.cos(a), 0.5), th + 0.3 * spow(Math.sin(a), 0.5)]);
    }
    add(surfaceTube(body, ring, 0.01, 0.018, M.frame));
  }
  // Рама кабины
  const edge = [];
  for (let x = CANOPY_X0; x <= X_NOSE - 0.02; x += 0.03) edge.push([x, canopyLow(x)]);
  add(surfaceTube(body, edge, 0.012, 0.022, M.frame));
  add(surfaceTube(body, edge.map(([x, t]) => [x, Math.PI - t]), 0.012, 0.022, M.frame));
  const rear = [];
  for (let i = 0; i <= 24; i++) rear.push([CANOPY_X0, canopyLow(CANOPY_X0) + (i / 24) * (Math.PI - 2 * canopyLow(CANOPY_X0))]);
  add(surfaceTube(body, rear, 0.012, 0.024, M.frame));
  const center = [];
  for (let x = CANOPY_X0; x <= 1.98; x += 0.04) center.push([x, Math.PI / 2]);
  add(surfaceTube(body, center, 0.012, 0.02, M.frame));
  for (const flip of [false, true]) {
    const f = (t) => (flip ? Math.PI - t : t);
    const pillar = [];
    for (let i = 0; i <= 10; i++) pillar.push([1.12, f(canopyLow(1.12) + (i / 10) * (1.2 - canopyLow(1.12)))]);
    add(surfaceTube(body, pillar, 0.012, 0.022, M.frame));
    const roof = [];
    for (let i = 0; i <= 10; i++) roof.push([CANOPY_X0 + (i / 10) * (1.12 - CANOPY_X0), f(1.2)]);
    add(surfaceTube(body, roof, 0.012, 0.02, M.frame));
  }

  // Обтекатель вала
  const fairing = add(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.38, 1.2), new THREE.Vector2(0.37, 1.3), new THREE.Vector2(0.31, 1.4),
    new THREE.Vector2(0.2, 1.47), new THREE.Vector2(0.11, 1.5), new THREE.Vector2(0.0, 1.5),
  ], 48), M.graphite));
  fairing.position.x = MAST.x;
  const mast = add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.5, 24), M.steel));
  mast.position.set(MAST.x, 1.7, 0);
  const swash = add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.045, 40), M.darkSteel));
  swash.position.set(MAST.x, 1.56, 0);

  // Несущий винт
  const rotor = new THREE.Group();
  rotor.position.set(MAST.x, 0, 0);
  add(rotor);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.13, 32), M.darkSteel);
  hub.position.y = 1.86;
  rotor.add(hub);
  const swashTop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 40), M.steel);
  swashTop.position.y = 1.61;
  rotor.add(swashTop);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16, 0, TAU, 0, Math.PI / 2), M.white);
  cap.position.y = 1.92;
  rotor.add(cap);
  const mainBlade = bladeGeometry({ r0: 0.7, r1: 4.95, chord: 0.34, t: 0.12, pitch: 0.07, twist: 0.14, cone: 0.025, tipFrom: 5.0, steps: Math.round(26 * seg) });
  const tipBlade = bladeGeometry({ r0: 4.95, r1: 5.4, chord: 0.34, t: 0.12, pitch: 0.07, twist: 0.0, cone: 0.025, tipFrom: 5.05, tipChord: 0.5, tipSweep: 0.4, steps: 10 });
  for (let k = 0; k < 4; k++) {
    const arm = new THREE.Group();
    arm.rotation.y = k * (Math.PI / 2) + Math.PI / 4;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.15), M.darkSteel);
    plate.position.set(0.3, 1.86, 0);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.062, 0.42, 16), M.graphite);
    cuff.rotation.z = -Math.PI / 2;
    cuff.position.set(0.66, 1.88, 0);
    const blade = new THREE.Mesh(mainBlade, M.blade);
    const tip = new THREE.Mesh(tipBlade, M.amber);
    blade.position.y = tip.position.y = 1.88;
    arm.add(plate, cuff, blade, tip);
    arm.add(rod(new THREE.Vector3(0.21, 1.62, -0.08), new THREE.Vector3(0.36, 1.84, -0.1), 0.014, M.steel));
    rotor.add(arm);
  }

  // Киль
  const finShape = new THREE.Shape();
  finShape.moveTo(-5.42, 0.66);
  finShape.lineTo(-6.12, 1.7);
  finShape.quadraticCurveTo(-6.2, 1.81, -6.34, 1.81);
  finShape.lineTo(-6.56, 1.79);
  finShape.lineTo(-6.52, 1.2);
  finShape.lineTo(-6.5, 0.4);
  finShape.lineTo(-6.53, -0.04);
  finShape.quadraticCurveTo(-6.5, -0.13, -6.4, -0.12);
  finShape.lineTo(-6.26, -0.08);
  finShape.lineTo(-5.86, 0.42);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 10 });
  finGeo.translate(0, 0, -0.025);
  add(new THREE.Mesh(finGeo, M.white));
  const decal = finDecal();
  for (const side of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ map: decal, transparent: true, roughness: 0.4, depthWrite: false }));
    p.position.set(-6.28, 1.42, side * 0.0525);
    if (side < 0) p.rotation.y = Math.PI;
    p.castShadow = false;
    add(p);
  }
  const tailSkid = add(rod(new THREE.Vector3(-6.36, -0.1, 0), new THREE.Vector3(-6.62, -0.2, 0), 0.02, M.steel));
  tailSkid.castShadow = true;

  // Стабилизатор с концевыми шайбами
  const foil = airfoil(28, 0.12);
  const stabRings = [];
  const spanPts = [-1.07, -1.05, -1.0, -0.6, 0, 0.6, 1.0, 1.05, 1.07];
  for (const z of spanPts) {
    const k = Math.abs(z) > 1.0 ? 0.82 + 0.18 * (1.07 - Math.abs(z)) / 0.07 : 1;
    const c = 0.48 * k;
    stabRings.push(foil.map(([a, y]) => new THREE.Vector3(-4.72 - a * c, 0.55 + y * c, z)));
  }
  add(new THREE.Mesh(loftRings(stabRings), M.white));
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-4.77, 0.4);
  plateShape.lineTo(-4.86, 0.88);
  plateShape.lineTo(-5.18, 0.92);
  plateShape.lineTo(-5.24, 0.36);
  plateShape.closePath();
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2 });
  plateGeo.translate(0, 0, -0.015);
  for (const z of [1.07, -1.07]) { const p = add(new THREE.Mesh(plateGeo, M.amber)); p.position.z = z; }

  // Рулевой винт (левый борт)
  const trHub = new THREE.Vector3(-6.26, 1.0, -0.24);
  const gearbox = add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.2, 24), M.white));
  gearbox.rotation.x = Math.PI / 2;
  gearbox.position.set(trHub.x, trHub.y, -0.1);
  const tailRotor = new THREE.Group();
  tailRotor.position.copy(trHub);
  add(tailRotor);
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.16, 24), M.graphite);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -0.08;
  tailRotor.add(spinner);
  const trGeo = bladeGeometry({ r0: 0.08, r1: 0.95, chord: 0.15, t: 0.12, pitch: 0.12, twist: 0.08, tipFrom: 0.82, tipChord: 0.7, tipSweep: 0.2, steps: 12 });
  trGeo.rotateX(Math.PI / 2);
  trGeo.rotateZ(Math.PI / 2);
  for (let k = 0; k < 2; k++) {
    const b = new THREE.Mesh(trGeo, M.blade);
    b.rotation.z = k * Math.PI;
    b.position.z = -0.02;
    tailRotor.add(b);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.152), M.amber);
    tip.position.set(0, 0.9 * (k ? -1 : 1), -0.02);
    tip.rotation.y = Math.PI / 2;
    tailRotor.add(tip);
  }

  // Полозковое шасси
  const skidY = SKID_Y + 0.045;
  for (const z of [0.86, -0.86]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.78, skidY, z), new THREE.Vector3(-0.6, skidY, z), new THREE.Vector3(0.6, skidY, z),
      new THREE.Vector3(1.22, skidY, z), new THREE.Vector3(1.56, skidY + 0.05, z), new THREE.Vector3(1.74, skidY + 0.18, z),
      new THREE.Vector3(1.8, skidY + 0.3, z),
    ]);
    add(new THREE.Mesh(new THREE.TubeGeometry(path, 90, 0.045, 14, false), M.steel));
    for (const p of [path.getPoint(0), path.getPoint(1)]) {
      const s = add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), M.steel));
      s.position.copy(p);
    }
  }
  const crossTube = (x, top) => {
    const pts = [[-0.86, skidY], [-0.84, skidY + 0.28], [-0.77, top - 0.2], [-0.56, top - 0.04], [-0.3, top], [0, top + 0.01]];
    const all = [...pts, ...pts.slice(0, -1).reverse().map(([z, y]) => [-z, y])];
    const curve = new THREE.CatmullRomCurve3(all.map(([z, y]) => new THREE.Vector3(x, y, z)));
    add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.05, 12, false), M.steel));
  };
  crossTube(0.85, -0.69);
  crossTube(-0.9, -0.57);

  // Антенны
  add(rod(new THREE.Vector3(-3.0, 0.68, 0), new THREE.Vector3(-3.35, 1.12, 0), 0.008, M.graphite));
  const blade = add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.02), M.graphite));
  blade.position.set(-0.6, -0.68, 0);

  inner.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  interior.traverse((o) => { o.castShadow = false; o.receiveShadow = true; });

  // Огни: БАНО, проблесковые маяки, посадочная фара
  const glowMap = glowTexture();
  const lights = [];
  const light = (pos, color, size, blink) => {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color }));
    bulb.position.copy(pos);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.position.copy(pos);
    glow.scale.setScalar(size);
    add(bulb); add(glow);
    lights.push({ glow, bulb, size, blink });
  };
  light(new THREE.Vector3(-4.8, 0.64, 1.1), '#3dff8a', 0.42);
  light(new THREE.Vector3(-4.8, 0.64, -1.1), '#ff3b3b', 0.42);
  light(new THREE.Vector3(-6.6, 0.55, 0), '#ffffff', 0.32);
  light(new THREE.Vector3(-6.4, 1.86, 0), '#ff2a2a', 0.8, 0);
  light(new THREE.Vector3(-0.3, -0.72, 0), '#ff2a2a', 0.8, 0.6);
  light(body.point(2.06, -1.32, 0.012), '#ffe9c4', 0.7);

  // Точки привязки выносок (координаты модели)
  const anchors = {
    cockpit: body.point(1.94, Math.PI / 2 + 0.42, 0.02),
    cockpitStbd: body.point(1.8, 0.66, 0.02),
    rotor: new THREE.Vector3(MAST.x, 2.0, 0),
    engine: cowl.point(0.0, Math.PI - 0.34, 0.012),
    engineStbd: cowl.point(0.0, 0.34, 0.012),
    tail: new THREE.Vector3(trHub.x, trHub.y, -0.34),
    tailStbd: new THREE.Vector3(trHub.x, trHub.y, 0.06),
    boom: new THREE.Vector3(-4.98, 0.64, 1.1),
    skids: new THREE.Vector3(1.5, skidY + 0.04, 0.86),
    skidsMid: new THREE.Vector3(0.55, skidY, 0.86),
  };

  const beaconOn = new THREE.Color('#ff2a2a');
  const beaconOff = beaconOn.clone().multiplyScalar(0.25);
  const update = (t, dt, rotorSpeed) => {
    rotor.rotation.y += dt * rotorSpeed;
    tailRotor.rotation.z -= dt * rotorSpeed * 5.2;
    for (const l of lights) {
      if (l.blink === undefined) continue;
      const on = ((t + l.blink) % 1.3) < 0.1;
      l.glow.scale.setScalar(on ? l.size * 1.6 : 0.0001);
      l.bulb.material.color.copy(on ? beaconOn : beaconOff);
    }
  };

  return { group, inner, rotor, tailRotor, anchors, update };
}
