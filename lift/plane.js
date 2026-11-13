// Бизнес-джет. Единица ≈ 1 м. Нос в +X, верх +Y, правый борт +Z.
import * as THREE from './vendor/three.module.min.js';
import {
  TAU, monotone, makeProfile, stations, loft, patch, roundPatch, liftingSurface, surfaceStrips,
  rod, canvasTex, tireGeometry, addLight, blinkLights, glowLevel,
} from './geo.js';

const XN = 10.3;
const XT = -10.25;
const WHEEL_Y = -2.0;   // ось основных колёс
const MAIN_R = 0.42;
const GROUND = WHEEL_Y - MAIN_R;

const INK = { white: '#ececec', black: '#141414', grey: '#8c8c8c', belly: '#c4c4c4', seam: 'rgba(0,0,0,0.42)' };

//            x       W     Ht    Hb    C      nT  nB
const BODY = [
  [-10.25, 0.20, 0.24, 0.16, 0.98, 2, 2],
  [-8.80, 0.40, 0.46, 0.32, 0.80, 2, 2],
  [-6.80, 0.72, 0.80, 0.62, 0.50, 2, 2],
  [-4.40, 1.04, 1.13, 1.02, 0.14, 2, 2.05],
  [-2.40, 1.15, 1.22, 1.15, 0.00, 2, 2.1],
  [ 4.60, 1.15, 1.22, 1.15, 0.00, 2, 2.1],
  [ 6.60, 1.08, 1.12, 1.10, -0.04, 2, 2.05],
  [ 8.40, 0.88, 0.86, 0.92, -0.14, 2, 2],
  [10.30, 0.70, 0.66, 0.74, -0.26, 2, 2],
];
const FAIRING = [
  [-2.8, 0.50, 0.20, 0.18, -0.86, 2, 2],
  [-1.0, 1.02, 0.30, 0.33, -0.82, 2, 2.6],
  [ 1.5, 1.04, 0.30, 0.35, -0.82, 2, 2.6],
  [ 3.8, 0.55, 0.20, 0.20, -0.86, 2, 2],
];
// линия окраски по борту: от носа поднимается к хвосту
const cheat = monotone([-10.25, -6.5, -3.0, 4.0, 8.0, 10.3], [0.55, 0.32, 0.02, -0.12, -0.2, -0.35]);
const WINDOWS = [4.55, 3.5, 2.45, 1.4, 0.35, -0.7, -1.75];
const WIN_TH = 0.2;

function paintLivery(body) {
  const W = 2048, H = 1024;
  const px = (x) => ((XN - x) / (XN - XT)) * W;
  const py = (th) => (1 - (th + Math.PI / 2) / TAU) * H;
  const mirror = (th) => Math.PI - th;
  return canvasTex(W, H, (g) => {
    g.fillStyle = INK.white;
    g.fillRect(0, 0, W, H);
    const fill = (lo, hi) => {
      for (const port of [false, true]) {
        const xs = [];
        for (let x = XN; x >= XT - 0.001; x -= 0.05) xs.push(x);
        g.beginPath();
        xs.forEach((x, i) => { const a = port ? mirror(lo(x)) : lo(x); i ? g.lineTo(px(x), py(a)) : g.moveTo(px(x), py(a)); });
        for (let i = xs.length - 1; i >= 0; i--) { const b = port ? mirror(hi(xs[i])) : hi(xs[i]); g.lineTo(px(xs[i]), py(b)); }
        g.closePath();
        g.fill();
      }
    };
    const R = (x) => Math.max(0.25, body.width(x));
    // светло-серое брюхо
    g.fillStyle = INK.belly;
    fill(() => -Math.PI / 2, (x) => cheat(x) - 0.55);
    // чёрная полоса под иллюминаторами и тонкая серая над ней
    g.fillStyle = INK.black;
    fill((x) => cheat(x) - 0.2 / R(x), (x) => cheat(x) - 0.06 / R(x));
    g.fillStyle = INK.grey;
    fill((x) => cheat(x) - 0.02 / R(x), (x) => cheat(x) + 0.0 / R(x));

    // чёрная рамка вокруг остекления кабины, как на настоящих бизнес-джетах
    g.fillStyle = INK.black;
    fill((x) => {
      if (x < 6.36 || x > 8.24) return 0;
      if (x < 7.16) return 0.4 + ((x - 6.45) / 0.68) * 0.06;
      return 0.6 - (x - 7.2) * 0.25;
    }, (x) => {
      if (x < 6.36 || x > 8.24) return 0;
      if (x < 7.16) return 0.99 - ((x - 6.45) / 0.68) * 0.12;
      return Math.PI / 2;
    });

    g.strokeStyle = INK.seam;
    g.lineWidth = 2;
    const seam = (pts, sides = ['s', 'p']) => {
      for (const sd of sides) {
        g.beginPath();
        pts.forEach(([x, th], i) => { const t = sd === 'p' ? mirror(th) : th; i ? g.lineTo(px(x), py(t)) : g.moveTo(px(x), py(t)); });
        g.stroke();
      }
    };
    // входная дверь (левый борт) и служебный люк (правый)
    seam([[6.25, 0.62], [5.35, 0.62], [5.35, -0.78], [6.25, -0.78], [6.25, 0.62]], ['p']);
    seam([[5.7, 0.4], [5.05, 0.4], [5.05, -0.35], [5.7, -0.35], [5.7, 0.4]], ['s']);
    // аварийный выход над крылом
    seam([[0.9, 0.42], [-0.05, 0.42], [-0.05, -0.12], [0.9, -0.12], [0.9, 0.42]]);
    // стыки панелей
    for (const x of [9.25, 6.8, -4.6, -8.0]) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), H); g.stroke(); }
    // надпись
    const label = (text, xc, thc, hM, port) => {
      const pv = (H / TAU) / R(xc), ph = W / (XN - XT);
      g.save();
      g.translate(px(xc), py(port ? mirror(thc) : thc));
      if (port) g.scale(ph / pv, -1); else g.scale(-ph / pv, 1);
      g.font = `800 ${Math.round(hM * pv / 0.72)}px Onest, Arial, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = INK.black;
      g.fillText(text, 0, 0);
      g.restore();
    };
    label('AERIS J9', -3.4, 0.32, 0.34, false);
    label('AERIS J9', -3.4, 0.32, 0.34, true);
  });
}

export function buildPlane({ lowDetail = false } = {}) {
  const group = new THREE.Group();
  const inner = new THREE.Group();
  group.add(inner);
  const add = (m, parent = inner) => { parent.add(m); return m; };
  const seg = lowDetail ? 0.7 : 1;

  const body = makeProfile(BODY, [6.9, XN, 1.7, 0.6], [-9.9, XT]);
  const fairing = makeProfile(FAIRING, [3.0, 3.8], [-2.0, -2.8]);

  const paint = { roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.07 };
  const M = {
    body: new THREE.MeshPhysicalMaterial({ ...paint, map: paintLivery(body) }),
    white: new THREE.MeshPhysicalMaterial({ ...paint, color: INK.white, side: THREE.DoubleSide }),
    belly: new THREE.MeshPhysicalMaterial({ ...paint, color: INK.belly }),
    chrome: new THREE.MeshStandardMaterial({ color: '#d6d6d6', roughness: 0.16, metalness: 1, side: THREE.DoubleSide }),
    seam: new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.6, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#050505', roughness: 0.03, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2 }),
    dark: new THREE.MeshStandardMaterial({ color: '#161616', roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }),
    fan: new THREE.MeshStandardMaterial({ color: '#7a7a7a', roughness: 0.3, metalness: 1 }),
    rubber: new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.92, metalness: 0 }),
    hub: new THREE.MeshStandardMaterial({ color: '#9a9a9a', roughness: 0.3, metalness: 1 }),
  };

  // Фюзеляж
  const xs = stations(XT, XN, (x) => (x > 9.6 || x < -9.6 ? 0.03 / seg : x > 6.5 ? 0.08 / seg : 0.16 / seg));
  add(new THREE.Mesh(loft(body, xs, Math.round(112 * seg), (x) => (XN - x) / (XN - XT)), M.body)).receiveShadow = true;
  add(new THREE.Mesh(loft(fairing, stations(-2.8, 3.8, () => 0.12 / seg), 64), M.belly));

  // Кабина пилотов: лобовые стёкла и боковые форточки
  const wsLo = (x) => 0.62 - (x - 7.2) * 0.25;
  for (const [a, b] of [[0, 0.5 - 0.02], [0.5 + 0.02, 1]]) {
    add(new THREE.Mesh(patch(body, 16, 16, (u, v) => {
      const x = 7.2 + u * 0.95;
      const lo = wsLo(x), hi = Math.PI - lo;
      return [x, lo + (a + (b - a) * v) * (hi - lo)];
    }, 0.006), M.glass));
  }
  for (const side of [0, 1]) {
    add(new THREE.Mesh(patch(body, 12, 12, (u, v) => {
      const x = 6.45 + u * 0.68;
      const lo = 0.44 + u * 0.06, hi = 0.95 - u * 0.12;
      const th = lo + v * (hi - lo);
      return [x, side ? Math.PI - th : th];
    }, 0.006), M.glass));
  }
  // Иллюминаторы
  for (const x of WINDOWS) for (const th of [WIN_TH, Math.PI - WIN_TH]) add(new THREE.Mesh(roundPatch(body, x, th, 0.21, 0.2, 2.4, 0.006), M.glass));

  // Крыло с законцовками
  const strips = surfaceStrips(M.white, M.chrome, M.seam);
  const wingStations = (side) => {
    const st = [];
    const s = side;
    const tan = Math.tan(29 * Math.PI / 180);
    for (let i = 0; i <= 14; i++) {
      const z = 0.55 + (i / 14) * 8.45;
      const k = (z - 0.55) / 8.45;
      st.push({
        O: new THREE.Vector3(2.75 - (z - 0.55) * tan, -0.7 + (z - 0.55) * 0.055, s * z),
        C: new THREE.Vector3(-1, 0, 0), T: new THREE.Vector3(0, 1, 0),
        c: 3.7 + (1.3 - 3.7) * k, t: 0.13 + (0.095 - 0.13) * k,
      });
    }
    const B = st[st.length - 1].O.clone();
    const rb = 0.5;
    for (let i = 1; i <= 8; i++) {
      const phi = (i / 8) * (80 * Math.PI / 180);
      st.push({
        O: new THREE.Vector3(B.x - rb * phi * 0.75, B.y + rb * (1 - Math.cos(phi)), s * (Math.abs(B.z) + rb * Math.sin(phi))),
        C: new THREE.Vector3(-1, 0, 0), T: new THREE.Vector3(0, Math.cos(phi), -s * Math.sin(phi)),
        c: 1.3 - 0.2 * (i / 8), t: 0.095,
      });
    }
    const top = st[st.length - 1].O.clone();
    for (let i = 1; i <= 5; i++) {
      const h = (i / 5) * 1.35;
      st.push({
        O: new THREE.Vector3(top.x - h * 0.85, top.y + h * 0.985, s * (Math.abs(top.z) + h * 0.17)),
        C: new THREE.Vector3(-1, 0, 0), T: new THREE.Vector3(0, 0.17, -s * 0.985),
        c: 1.1 - 0.55 * (i / 5), t: 0.09,
      });
    }
    return st;
  };
  const wingTips = {};
  for (const side of [1, -1]) {
    const st = wingStations(side);
    add(liftingSurface(st, strips, M.white));
    wingTips[side] = st[st.length - 1].O.clone();
    // обтекатели механизмов закрылков
    for (const z of [3.2, 5.4]) {
      const k = (z - 0.55) / 8.45;
      const te = 2.75 - (z - 0.55) * Math.tan(29 * Math.PI / 180) - (3.7 + (1.3 - 3.7) * k);
      const pod = add(new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), M.white));
      pod.scale.set(0.85, 0.11, 0.11);
      pod.position.set(te + 0.35, -0.82 + (z - 0.55) * 0.055, side * z);
    }
  }

  // Т-образное оперение
  const finSt = [];
  for (let i = 0; i <= 8; i++) {
    const y = 1.0 + (i / 8) * 3.25;
    const k = i / 8;
    finSt.push({ O: new THREE.Vector3(-6.6 - (y - 1.0) * 0.95, y, 0), C: new THREE.Vector3(-1, 0, 0), T: new THREE.Vector3(0, 0, 1), c: 3.3 - 1.6 * k, t: 0.11 });
  }
  add(liftingSurface(finSt, strips, M.white, { capEnd: false }));
  const finTop = finSt[finSt.length - 1];
  for (const side of [1, -1]) {
    const st = [];
    for (let i = 0; i <= 6; i++) {
      const z = (i / 6) * 3.4;
      st.push({ O: new THREE.Vector3(finTop.O.x + 0.3 - z * 0.62, 4.3 - z * 0.03, side * z), C: new THREE.Vector3(-1, 0, 0), T: new THREE.Vector3(0, 1, 0), c: 1.7 - 0.95 * (i / 6), t: 0.1 });
    }
    add(liftingSurface(st, strips, M.white));
  }
  const bullet = add(new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14), M.white));
  bullet.scale.set(1.25, 0.2, 0.2);
  bullet.position.set(finTop.O.x - 0.7, 4.3, 0);

  // Двигатели на пилонах
  const fans = [];
  const nacelle = (side) => {
    const g = new THREE.Group();
    const prof = (pts) => pts.map(([r, y]) => new THREE.Vector2(r, y));
    const lip = new THREE.Mesh(new THREE.LatheGeometry(prof([[0.47, 0.42], [0.47, 0.14], [0.5, 0.035], [0.545, 0.0], [0.59, 0.03], [0.625, 0.13]]), 48), M.chrome);
    const shell = new THREE.Mesh(new THREE.LatheGeometry(prof([[0.625, 0.13], [0.655, 0.5], [0.665, 1.1], [0.65, 1.8], [0.6, 2.4], [0.53, 2.85], [0.5, 3.0]]), 48), M.white);
    const nozzle = new THREE.Mesh(new THREE.LatheGeometry(prof([[0.5, 3.0], [0.47, 2.92], [0.45, 2.6]]), 48), M.dark);
    const plug = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.75, 32), M.dark);
    plug.position.y = 3.0;
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.47, 40), M.dark);
    face.rotation.x = Math.PI / 2;
    face.position.y = 0.48;
    const fan = new THREE.Group();
    fan.position.y = 0.44;
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.34, 32), M.dark);
    spinner.rotation.x = Math.PI;
    spinner.position.y = -0.14;
    fan.add(spinner);
    for (let i = 0; i < 22; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.012, 0.07), M.fan);
      const a = (i / 22) * TAU;
      b.position.set(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
      b.rotation.set(0.5, -a, 0, 'YXZ');
      fan.add(b);
    }
    fans.push(fan);
    g.add(lip, shell, nozzle, plug, face, fan);
    g.rotation.z = Math.PI / 2; // ось лофта Y → назад (−X)
    g.position.set(-4.5, 0.78, side * 1.98);
    add(g);
    // пилон
    const st = [];
    for (let i = 0; i <= 3; i++) {
      const z = 0.6 + (i / 3) * 0.95;
      st.push({ O: new THREE.Vector3(-5.05, 0.78, side * z), C: new THREE.Vector3(-1, 0, 0), T: new THREE.Vector3(0, 1, 0), c: 1.9, t: 0.14 });
    }
    add(liftingSurface(st, [{ from: 0, to: 2, n: 28, mat: M.white }], M.white, { capEnd: false }));
  };
  nacelle(1);
  nacelle(-1);

  // Шасси
  const nose = new THREE.Group();
  add(nose);
  nose.add(rod(new THREE.Vector3(7.35, -0.85, 0), new THREE.Vector3(7.38, -2.12, 0), 0.065, M.chrome));
  nose.add(rod(new THREE.Vector3(7.36, -1.75, 0.0), new THREE.Vector3(7.2, -1.95, 0.0), 0.03, M.hub));
  const noseTire = tireGeometry(0.3, 0.15);
  for (const z of [0.16, -0.16]) {
    const t = new THREE.Mesh(noseTire, M.rubber);
    t.position.set(7.38, -2.12, z);
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.13, 24), M.hub);
    h.rotation.x = Math.PI / 2;
    h.position.copy(t.position);
    nose.add(t, h);
  }
  nose.add(rod(new THREE.Vector3(7.38, -2.12, -0.24), new THREE.Vector3(7.38, -2.12, 0.24), 0.035, M.hub));
  for (const z of [0.32, -0.32]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.3, 0.02), M.white);
    door.position.set(7.35, -1.05, z * 0.85);
    nose.add(door);
  }
  const mainTire = tireGeometry(MAIN_R, 0.22);
  for (const side of [1, -1]) {
    const z = side * 1.62;
    add(rod(new THREE.Vector3(-0.45, -0.82, z), new THREE.Vector3(-0.72, WHEEL_Y, z), 0.09, M.chrome));
    add(rod(new THREE.Vector3(-0.3, -0.95, z), new THREE.Vector3(-0.62, -1.6, z - side * 0.25), 0.04, M.hub));
    for (const dz of [0.21, -0.21]) {
      const t = add(new THREE.Mesh(mainTire, M.rubber));
      t.position.set(-0.75, WHEEL_Y, z + dz);
      const h = add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 28), M.hub));
      h.rotation.x = Math.PI / 2;
      h.position.copy(t.position);
    }
    add(rod(new THREE.Vector3(-0.75, WHEEL_Y, z - 0.33), new THREE.Vector3(-0.75, WHEEL_Y, z + 0.33), 0.05, M.hub));
    const door = add(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.85, 0.025), M.white));
    door.position.set(-0.6, -1.25, z + side * 0.16);
    door.rotation.x = side * 0.06;
  }

  // Антенны
  add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.22, 0.03), M.dark)).position.set(1.5, 1.3, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.03), M.dark)).position.set(-2.4, -1.3, 0);

  inner.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const lights = [];
  addLight(inner, lights, wingTips[1].clone().add(new THREE.Vector3(-0.2, 0, 0)), 0.9, 0.2);
  addLight(inner, lights, wingTips[-1].clone().add(new THREE.Vector3(-0.2, 0, 0)), 0.9, 0.2);
  addLight(inner, lights, new THREE.Vector3(0.8, 1.26, 0), 1.1, 0.0);
  addLight(inner, lights, new THREE.Vector3(0.2, -1.2, 0), 1.1, 0.65);
  addLight(inner, lights, new THREE.Vector3(7.5, -1.55, 0), 0.9);
  addLight(inner, lights, new THREE.Vector3(-10.3, 1.0, 0), 0.5);

  const anchors = {
    cockpit: body.point(7.95, Math.PI / 2 + 0.42, 0.02),
    cockpitStbd: body.point(7.6, 0.75, 0.02),
    wing: wingTips[-1].clone().add(new THREE.Vector3(0.1, -0.4, -0.05)),
    wingStbd: wingTips[1].clone().add(new THREE.Vector3(0.1, -0.4, 0.05)),
    cabin: body.point(WINDOWS[3], Math.PI - WIN_TH, 0.03),
    cabinStbd: body.point(WINDOWS[3], WIN_TH, 0.03),
    engine: new THREE.Vector3(-5.6, 0.78, -1.98 - 0.67),
    engineStbd: new THREE.Vector3(-5.6, 0.78, 1.98 + 0.67),
    tail: new THREE.Vector3(finTop.O.x - 0.05 - 3.4 * 0.62 - 0.3, 4.2, 3.35),
    tailStbd: new THREE.Vector3(finTop.O.x - 0.9, 3.6, 0.12),
    gear: new THREE.Vector3(-0.75, WHEEL_Y, 1.62 + 0.33),
    gearStbd: new THREE.Vector3(-0.75, WHEEL_Y + 0.1, 1.62 + 0.33),
  };

  return {
    group, inner, anchors,
    radius: 10.5,
    lift: -GROUND,
    glow: (k) => glowLevel(lights, k),
    update(t, dt, speed) {
      for (const f of fans) f.rotation.y += dt * (2.5 + speed * 2);
      blinkLights(lights, t);
    },
  };
}
