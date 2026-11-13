// Вертолёт. Единица ≈ 1 м. Нос в +X, верх +Y, правый борт +Z.
import * as THREE from './vendor/three.module.min.js';
import {
  TAU, spow, monotone, makeProfile, stations, loft, patch, roundPatch, surfaceTube,
  loftRings, airfoil, bladeGeometry, rod, canvasTex, addLight, blinkLights, glowLevel,
} from './geo.js';

const PIVOT = new THREE.Vector3(0.15, 0, 0); // ось несущего винта
const SKID_Y = -1.5;
const X_NOSE = 2.18;
const X_TAIL = -6.42;

const INK = {
  white: '#e6e6e6',
  black: '#151515',
  grey: '#8a8a8a',
  seam: 'rgba(0, 0, 0, 0.5)',
};

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
const canopyLow = monotone([0.75, 0.9, 1.3, 1.7, 2.0, 2.2], [0.52, 0.30, -0.02, -0.40, -0.78, -1.05]);
const liveryLine = monotone([-6.42, -2.4, -1.2, 0, 1.2, 2.18], [0.22, 0.18, 0.02, -0.12, -0.24, -0.34]);
const CANOPY_X0 = 0.75;

function paintLivery(body) {
  const W = 2048, H = 1024;
  const px = (x) => ((X_NOSE - x) / (X_NOSE - X_TAIL)) * W;
  const py = (th) => (1 - (th + Math.PI / 2) / TAU) * H;
  const mirror = (th) => Math.PI - th;
  return canvasTex(W, H, (g) => {
    g.fillStyle = INK.white;
    g.fillRect(0, 0, W, H);
    const fill = (lo, hi) => {
      for (const port of [false, true]) {
        const xs = [];
        for (let x = X_NOSE; x >= X_TAIL - 0.001; x -= 0.02) xs.push(x);
        g.beginPath();
        xs.forEach((x, i) => { const a = port ? mirror(lo(x)) : lo(x); i ? g.lineTo(px(x), py(a)) : g.moveTo(px(x), py(a)); });
        for (let i = xs.length - 1; i >= 0; i--) { const b = port ? mirror(hi(xs[i])) : hi(xs[i]); g.lineTo(px(xs[i]), py(b)); }
        g.closePath();
        g.fill();
      }
    };
    const band = (a, b) => [(x) => liveryLine(x) + a / Math.max(0.09, body.width(x)), (x) => liveryLine(x) + b / Math.max(0.09, body.width(x))];
    g.fillStyle = INK.black;
    fill(() => -Math.PI / 2, liveryLine);
    g.fillStyle = INK.grey;
    fill(...band(0.03, 0.06));
    g.fillStyle = INK.black;
    g.fillRect(0, 0, px(2.0), H); // кончик носа под стеклом

    g.strokeStyle = INK.seam;
    g.lineWidth = 2.4;
    g.lineJoin = 'round';
    const seam = (pts) => {
      for (const port of [false, true]) {
        g.beginPath();
        pts.forEach(([x, th], i) => { const t = port ? mirror(th) : th; i ? g.lineTo(px(x), py(t)) : g.moveTo(px(x), py(t)); });
        g.stroke();
      }
    };
    seam([[1.12, canopyLow(1.12)], [1.12, -0.55], [0.44, -0.55], [0.44, 1.05]]);
    seam([[0.36, 1.0], [0.36, -0.52], [-0.64, -0.52], [-0.64, 1.0], [0.36, 1.0]]);
    seam([[-1.05, 0.55], [-1.05, -0.2], [-1.45, -0.05], [-1.45, 0.62], [-1.05, 0.55]]);
    g.fillStyle = 'rgba(0,0,0,0.75)';
    for (const [x, th] of [[0.56, 0.05], [0.2, 0.08]]) for (const t of [th, mirror(th)]) g.fillRect(px(x) - 14, py(t) - 5, 28, 10);
    for (const x of [-2.35, -4.25]) {
      g.strokeStyle = INK.seam;
      g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), H); g.stroke();
      g.fillStyle = 'rgba(0,0,0,0.4)';
      for (let y = 6; y < H; y += 18) { g.beginPath(); g.arc(px(x) - 7, y, 2.2, 0, TAU); g.fill(); }
    }
    const label = (text, xc, thc, hM, port) => {
      const R = Math.max(0.09, body.width(xc));
      const pv = (H / TAU) / R, ph = W / (X_NOSE - X_TAIL);
      g.save();
      g.translate(px(xc), py(port ? mirror(thc) : thc));
      if (port) g.scale(ph / pv, -1); else g.scale(-ph / pv, 1);
      g.font = `700 ${Math.round(hM * pv / 0.72)}px Onest, Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = 'rgba(235,235,235,0.92)';
      g.fillText(text, 0, 0);
      g.restore();
    };
    label('AERIS H7', -3.25, -0.26, 0.085, false);
    label('AERIS H7', -3.25, -0.26, 0.085, true);
  });
}

const grilleTexture = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#0b0b0b';
  g.fillRect(0, 0, w, h);
  for (let y = 8; y < h; y += 22) {
    const grd = g.createLinearGradient(0, y, 0, y + 12);
    grd.addColorStop(0, '#606060');
    grd.addColorStop(1, '#222222');
    g.fillStyle = grd;
    g.fillRect(0, y, w, 12);
  }
});

const finDecal = () => canvasTex(512, 256, (g, w, h) => {
  g.font = '800 170px Onest, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = INK.black;
  g.fillText('H7', w / 2, h / 2 + 8);
});

export function buildHelicopter({ lowDetail = false } = {}) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  inner.position.x = -PIVOT.x;
  group.add(inner);

  const body = makeProfile(BODY_ROWS, [1.25, X_NOSE], [-6.2, X_TAIL]);
  const cowl = makeProfile(COWL_ROWS, [0.2, 0.64], [-1.7, -2.18]);

  const paint = { roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.08 };
  const M = {
    body: new THREE.MeshPhysicalMaterial({ ...paint, map: paintLivery(body) }),
    white: new THREE.MeshPhysicalMaterial({ ...paint, color: INK.white }),
    whiteDS: new THREE.MeshPhysicalMaterial({ ...paint, color: INK.white, side: THREE.DoubleSide }),
    black: new THREE.MeshPhysicalMaterial({ ...paint, color: INK.black, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({
      color: '#060606', roughness: 0.03, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02,
      envMapIntensity: 2.0, transparent: true, opacity: 0.86,
    }),
    cabin: new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.85, metalness: 0.1, side: THREE.BackSide, envMapIntensity: 0.25 }),
    seat: new THREE.MeshStandardMaterial({ color: '#2e2e2e', roughness: 0.75, envMapIntensity: 0.4 }),
    dash: new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 0.7, envMapIntensity: 0.4 }),
    frame: new THREE.MeshStandardMaterial({ color: '#0e0e0e', roughness: 0.5, metalness: 0.3 }),
    graphite: new THREE.MeshStandardMaterial({ color: '#1e1e1e', roughness: 0.45, metalness: 0.35 }),
    steel: new THREE.MeshStandardMaterial({ color: '#b4b4b4', roughness: 0.24, metalness: 1 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: '#4d4d4d', roughness: 0.34, metalness: 0.9 }),
    blade: new THREE.MeshStandardMaterial({ color: '#191919', roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide }),
    grille: new THREE.MeshStandardMaterial({ map: grilleTexture(), roughness: 0.55, metalness: 0.6, side: THREE.DoubleSide }),
    exhaust: new THREE.MeshStandardMaterial({ color: '#3c3c3c', roughness: 0.42, metalness: 0.85, side: THREE.DoubleSide }),
    soot: new THREE.MeshBasicMaterial({ color: '#050505', side: THREE.DoubleSide }),
  };
  const add = (mesh, parent = inner) => { parent.add(mesh); return mesh; };
  const seg = lowDetail ? 0.7 : 1;

  // Фюзеляж
  const xs = stations(X_TAIL, X_NOSE, (x) => {
    if (x > 1.95 || x < -6.15) return 0.014 / seg;
    if (x > 1.1) return 0.03 / seg;
    if (x > -2.5) return 0.045 / seg;
    return 0.12 / seg;
  });
  const fuselageGeo = loft(body, xs, Math.round(128 * seg), (x) => (X_NOSE - x) / (X_NOSE - X_TAIL));
  add(new THREE.Mesh(fuselageGeo, M.body)).receiveShadow = true;

  // Салон
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
  for (const z of [0.24, -0.24, 0]) {
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(z ? 0.26 : 0.14, 0.17), new THREE.MeshBasicMaterial({ color: '#cfcfcf' }));
    scr.material.color.multiplyScalar(z ? 0.8 : 0.6);
    scr.position.set(1.465, -0.03, z);
    scr.rotation.y = -Math.PI / 2;
    interior.add(scr);
  }
  for (const z of [0.36, -0.36]) interior.add(rod(new THREE.Vector3(1.24, -0.52, z), new THREE.Vector3(1.28, -0.1, z), 0.016, M.graphite));

  // Капот, воздухозаборники, выхлоп
  add(new THREE.Mesh(loft(cowl, stations(-2.18, 0.64, (x) => (x > 0.3 || x < -1.8 ? 0.016 : 0.05)), 96), M.white)).receiveShadow = true;
  for (const th of [0.34, Math.PI - 0.34]) add(new THREE.Mesh(roundPatch(cowl, 0.0, th, 0.3, 0.27, 5, 0.006), M.grille));
  const exhaust = new THREE.Group();
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 10, 40), M.exhaust);
  lip.position.y = 0.26; lip.rotation.x = Math.PI / 2;
  const plug = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), M.soot);
  plug.position.y = 0.2; plug.rotation.x = -Math.PI / 2;
  exhaust.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.52, 32, 1, true), M.exhaust), lip, plug);
  exhaust.position.set(-1.98, 1.02, 0);
  exhaust.rotation.z = Math.PI / 2 + 0.26;
  add(exhaust);

  // Остекление и рама
  const canopyMap = (u, v) => {
    const x = CANOPY_X0 + u * (X_NOSE - 0.012 - CANOPY_X0);
    const lo = canopyLow(x);
    return [x, lo + v * (Math.PI - 2 * lo)];
  };
  add(new THREE.Mesh(patch(body, Math.round(90 * seg), Math.round(80 * seg), canopyMap, 0.008), M.glass));
  for (const th of [0.42, Math.PI - 0.42]) {
    add(new THREE.Mesh(roundPatch(body, -0.13, th, 0.36, 0.3, 4, 0.008), M.glass));
    const ring = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * TAU;
      ring.push([-0.13 + 0.36 * spow(Math.cos(a), 0.5), th + 0.3 * spow(Math.sin(a), 0.5)]);
    }
    add(surfaceTube(body, ring, 0.01, 0.018, M.frame));
  }
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
    const pillar = [], roof = [];
    for (let i = 0; i <= 10; i++) pillar.push([1.12, f(canopyLow(1.12) + (i / 10) * (1.2 - canopyLow(1.12)))]);
    for (let i = 0; i <= 10; i++) roof.push([CANOPY_X0 + (i / 10) * (1.12 - CANOPY_X0), f(1.2)]);
    add(surfaceTube(body, pillar, 0.012, 0.022, M.frame));
    add(surfaceTube(body, roof, 0.012, 0.02, M.frame));
  }

  // Вал, автомат перекоса
  const fairing = add(new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.38, 1.2), new THREE.Vector2(0.37, 1.3), new THREE.Vector2(0.31, 1.4),
    new THREE.Vector2(0.2, 1.47), new THREE.Vector2(0.11, 1.5), new THREE.Vector2(0.0, 1.5),
  ], 48), M.graphite));
  fairing.position.x = PIVOT.x;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.5, 24), M.steel)).position.set(PIVOT.x, 1.7, 0);
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.045, 40), M.darkSteel)).position.set(PIVOT.x, 1.56, 0);

  // Несущий винт
  const rotor = new THREE.Group();
  rotor.position.set(PIVOT.x, 0, 0);
  add(rotor);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.13, 32), M.darkSteel);
  hub.position.y = 1.86;
  const swashTop = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 40), M.steel);
  swashTop.position.y = 1.61;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16, 0, TAU, 0, Math.PI / 2), M.white);
  cap.position.y = 1.92;
  rotor.add(hub, swashTop, cap);
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
    const tip = new THREE.Mesh(tipBlade, M.whiteDS);
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
    const p = add(new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ map: decal, transparent: true, roughness: 0.4, depthWrite: false })));
    p.position.set(-6.28, 1.42, side * 0.0525);
    if (side < 0) p.rotation.y = Math.PI;
  }
  add(rod(new THREE.Vector3(-6.36, -0.1, 0), new THREE.Vector3(-6.62, -0.2, 0), 0.02, M.steel));

  // Стабилизатор
  const foil = airfoil(28, 0.12);
  const stabRings = [];
  for (const z of [-1.07, -1.05, -1.0, -0.6, 0, 0.6, 1.0, 1.05, 1.07]) {
    const k = Math.abs(z) > 1.0 ? 0.82 + 0.18 * (1.07 - Math.abs(z)) / 0.07 : 1;
    const c = 0.48 * k;
    stabRings.push(foil.map(([a, y]) => new THREE.Vector3(-4.72 - a * c, 0.55 + y * c, z)));
  }
  add(new THREE.Mesh(loftRings(stabRings), M.whiteDS));
  const plateShape = new THREE.Shape();
  plateShape.moveTo(-4.77, 0.4);
  plateShape.lineTo(-4.86, 0.88);
  plateShape.lineTo(-5.18, 0.92);
  plateShape.lineTo(-5.24, 0.36);
  plateShape.closePath();
  const plateGeo = new THREE.ExtrudeGeometry(plateShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 2 });
  plateGeo.translate(0, 0, -0.015);
  for (const z of [1.07, -1.07]) add(new THREE.Mesh(plateGeo, M.black)).position.z = z;

  // Рулевой винт
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
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.152), M.white);
    tip.position.set(0, 0.9 * (k ? -1 : 1), -0.02);
    tip.rotation.y = Math.PI / 2;
    tailRotor.add(b, tip);
  }

  // Полозья
  const skidY = SKID_Y + 0.045;
  for (const z of [0.86, -0.86]) {
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.78, skidY, z), new THREE.Vector3(-0.6, skidY, z), new THREE.Vector3(0.6, skidY, z),
      new THREE.Vector3(1.22, skidY, z), new THREE.Vector3(1.56, skidY + 0.05, z), new THREE.Vector3(1.74, skidY + 0.18, z),
      new THREE.Vector3(1.8, skidY + 0.3, z),
    ]);
    add(new THREE.Mesh(new THREE.TubeGeometry(path, 90, 0.045, 14, false), M.steel));
    for (const p of [path.getPoint(0), path.getPoint(1)]) add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), M.steel)).position.copy(p);
  }
  const crossTube = (x, top) => {
    const pts = [[-0.86, skidY], [-0.84, skidY + 0.28], [-0.77, top - 0.2], [-0.56, top - 0.04], [-0.3, top], [0, top + 0.01]];
    const all = [...pts, ...pts.slice(0, -1).reverse().map(([z, y]) => [-z, y])];
    add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(all.map(([z, y]) => new THREE.Vector3(x, y, z))), 80, 0.05, 12, false), M.steel));
  };
  crossTube(0.85, -0.69);
  crossTube(-0.9, -0.57);

  add(rod(new THREE.Vector3(-3.0, 0.68, 0), new THREE.Vector3(-3.35, 1.12, 0), 0.008, M.graphite));
  add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.02), M.graphite)).position.set(-0.6, -0.68, 0);

  inner.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  interior.traverse((o) => { o.castShadow = false; o.receiveShadow = true; });

  const lights = [];
  addLight(inner, lights, new THREE.Vector3(-4.8, 0.64, 1.1), 0.34);
  addLight(inner, lights, new THREE.Vector3(-4.8, 0.64, -1.1), 0.34);
  addLight(inner, lights, new THREE.Vector3(-6.6, 0.55, 0), 0.3);
  addLight(inner, lights, new THREE.Vector3(-6.4, 1.86, 0), 0.8, 0);
  addLight(inner, lights, new THREE.Vector3(-0.3, -0.72, 0), 0.8, 0.6);
  addLight(inner, lights, body.point(2.06, -1.32, 0.012), 0.6);

  const anchors = {
    cockpit: body.point(1.94, Math.PI / 2 + 0.42, 0.02),
    cockpitStbd: body.point(1.8, 0.66, 0.02),
    rotor: new THREE.Vector3(PIVOT.x, 2.0, 0),
    engine: cowl.point(0.0, Math.PI - 0.34, 0.012),
    engineStbd: cowl.point(0.0, 0.34, 0.012),
    tail: new THREE.Vector3(trHub.x, trHub.y, -0.34),
    tailStbd: new THREE.Vector3(trHub.x, trHub.y, 0.06),
    boom: new THREE.Vector3(-4.98, 0.64, 1.1),
    skids: new THREE.Vector3(1.5, skidY + 0.04, 0.86),
    skidsMid: new THREE.Vector3(0.55, skidY, 0.86),
  };

  return {
    group, inner, anchors,
    radius: 5.0,           // радиус кадра «вертолёт целиком»
    lift: -SKID_Y + 0.32,  // высота над полом: зависание
    glow: (k) => glowLevel(lights, k),
    update(t, dt, speed) {
      rotor.rotation.y += dt * speed;
      tailRotor.rotation.z -= dt * speed * 5.2;
      blinkLights(lights, t);
    },
  };
}
