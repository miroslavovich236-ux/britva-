import * as THREE from './vendor/three.module.min.js';
import { buildHelicopter } from './heli.js';
import { buildPlane } from './plane.js';
import { SITE, VEHICLES, STEPS } from './content.js';

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const DEG = Math.PI / 180;
const SVGNS = 'http://www.w3.org/2000/svg';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SNAP = /[?&]snap\b/.test(location.search); // для скриншотов: без плавного догоняния
const N = STEPS.length;
const HOLD = 0.2; // доля шага, когда машина стоит на месте
const KEYS = Object.keys(VEHICLES);
const stepOf = (kind, subject) => STEPS.findIndex((s) => s.kind === kind && (!subject || s.subject === subject));
const INTRO = stepOf('intro');
const OUTRO = stepOf('outro');

/* ---------- разметка из content.js ---------- */

function renderCopy() {
  $('#intro-eyebrow').textContent = SITE.eyebrow;
  $('#intro-title').innerHTML = SITE.title.map((w) => `<span>${w}</span>`).join('');
  $('#intro-lead').textContent = SITE.lead;
  $('#cue-text').textContent = SITE.cue;
  $('#brand').textContent = SITE.title.join(' ');
  $('#outro-title').textContent = SITE.outro.title;
  $('#outro-text').textContent = SITE.outro.text;
  $('#outro-restart').lastChild.textContent = SITE.outro.button;
  $('#outro-note').textContent = SITE.outro.note;

  $('#chapters').innerHTML = KEYS.map((k) => {
    const v = VEHICLES[k];
    return `<section class="chapter" data-veh="${k}">
      <p class="eyebrow"><b>${v.num}</b> ${v.kind}</p>
      <h2 class="chapter__name">${v.name}</h2>
      <p class="chapter__lead">${v.lead}</p></section>`;
  }).join('');

  $('#sheets').innerHTML = KEYS.map((k) => {
    const v = VEHICLES[k];
    return `<section class="sheet" data-veh="${k}">
      <p class="eyebrow">${v.name} · характеристики</p>
      <dl class="sheet__grid">${v.specs.map(([val, u, key]) =>
        `<div class="spec"><dd class="spec__value">${val}<small>${u}</small></dd><dt class="spec__key">${key}</dt></div>`).join('')}</dl>
      <ol class="sheet__legend">${v.parts.map((p) => `<li><span>${p.num}</span>${p.tag}</li>`).join('')}</ol></section>`;
  }).join('');

  $('#parts').innerHTML = KEYS.map((k) => `<div class="parts__group" data-veh="${k}">${VEHICLES[k].parts.map((p, i) => {
    const step = STEPS.findIndex((s) => s.subject === k && s.part === i);
    return `<button type="button" class="parts__item" data-step="${step}" aria-label="${VEHICLES[k].kind}: ${p.tag}">
      <span class="parts__num">${p.num}</span><span class="parts__name">${p.tag}</span></button>`;
  }).join('')}</div>`).join('');

  $('#track').innerHTML = STEPS.map((s, i) => {
    const v = VEHICLES[s.subject];
    let body = '';
    if (s.kind === 'intro') body = `<h2>${SITE.title.join(' ')}</h2><p>${SITE.lead}</p>`;
    if (s.kind === 'chapter') body = `<h2>${v.kind} ${v.name}</h2><p>${v.lead}</p>`;
    if (s.kind === 'part') { const p = v.parts[s.part]; body = `<h3>${p.title}</h3><p>${p.text}</p><p>${p.stats.map(([a, b]) => `${b}: ${a}`).join('; ')}</p>`; }
    if (s.kind === 'specs') body = `<h3>${v.name}: характеристики</h3><p>${v.specs.map(([a, u, k]) => `${k} — ${a} ${u}`).join('; ')}</p>`;
    if (s.kind === 'outro') body = `<p>${SITE.outro.text}</p>`;
    return `<section class="step" id="step-${i}"><div class="sr-only">${body}</div></section>`;
  }).join('');
}

/* ---------- студия ---------- */

function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  const sky = new THREE.SphereGeometry(60, 48, 24);
  const col = [];
  const p = sky.attributes.position;
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 60;
    const v = y > 0 ? lerp(0.16, 0.03, y) : lerp(0.16, 0.01, Math.min(1, -y * 3));
    c.setRGB(v, v, v);
    col.push(c.r, c.g, c.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, intensity, pos) => {
    const m = new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide });
    m.color.multiplyScalar(intensity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  panel(34, 10, 4.5, [0, 26, 4]);     // верхний софтбокс
  panel(3, 26, 5.5, [28, 8, 10]);     // боковая полоса
  panel(3, 22, 4.0, [-26, 6, -14]);   // контровой
  panel(50, 2, 1.6, [0, 1.5, -36]);   // горизонт
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}

function floorTexture() {
  const S = 2048;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2;
  const rg = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  rg.addColorStop(0, 'rgba(40,40,40,0.95)');
  rg.addColorStop(0.3, 'rgba(26,26,26,0.8)');
  rg.addColorStop(0.62, 'rgba(12,12,12,0.3)');
  rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  // тонкие кольца поворотного стола
  g.strokeStyle = 'rgba(255,255,255,0.09)';
  g.lineWidth = 2;
  for (const r of [0.2, 0.34]) { g.beginPath(); g.arc(cx, cx, r * S, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = 'rgba(255,255,255,0.12)';
  for (let d = 0; d < 360; d += 5) {
    const a = d * DEG, r = 0.34 * S, len = d % 45 === 0 ? 26 : 10;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
    g.lineTo(cx + Math.cos(a) * (r - len), cx + Math.sin(a) * (r - len));
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* ---------- выноски ---------- */

function makeCallouts() {
  const svg = $('#leaders');
  const layer = $('#callouts');
  const list = [];
  for (const key of KEYS) {
    const specsStep = stepOf('specs', key);
    VEHICLES[key].parts.forEach((p, i) => {
      for (const mini of [false, true]) {
        const g = document.createElementNS(SVGNS, 'g');
        g.setAttribute('class', mini ? 'leader leader--mini' : 'leader');
        g.style.display = 'none';
        const path = document.createElementNS(SVGNS, 'path');
        const ring = document.createElementNS(SVGNS, 'circle');
        ring.setAttribute('class', 'leader__ring');
        ring.setAttribute('r', mini ? 7 : 11);
        const dot = document.createElementNS(SVGNS, 'circle');
        dot.setAttribute('class', 'leader__dot');
        const knee = document.createElementNS(SVGNS, 'circle');
        knee.setAttribute('class', 'leader__knee');
        knee.setAttribute('r', mini ? 1.5 : 2);
        g.append(path, ring, dot, knee);
        svg.append(g);
        const el = document.createElement('div');
        if (mini) {
          el.className = 'tag';
          el.innerHTML = `<span class="tag__num">${p.num}</span><span class="tag__name">${p.tag}</span>`;
        } else {
          el.className = 'callout';
          el.innerHTML = `
            <div class="callout__head"><span class="callout__num">${p.num}</span><span class="callout__tag">${p.tag}</span></div>
            <h3 class="callout__title">${p.title}</h3>
            <p class="callout__text">${p.text}</p>
            <dl class="callout__stats">${p.stats.map(([v, k]) => `<div><dd>${v}</dd><dt>${k}</dt></div>`).join('')}</dl>`;
        }
        layer.append(el);
        list.push({
          key, part: p, mini, g, path, ring, dot, knee, el, w: 0, h: 0, shown: false,
          step: mini ? specsStep : STEPS.findIndex((s) => s.subject === key && s.part === i),
          cfg: mini ? p.mini : p.label,
        });
      }
    });
  }
  return list;
}

/* ---------- запуск ---------- */

async function start() {
  renderCopy();
  const canvas = $('#scene');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (err) {
    document.body.classList.add('no-webgl');
    return;
  }
  const phone = matchMedia('(max-width: 759px)');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  await Promise.race([
    Promise.all([document.fonts.load('800 64px Onest'), document.fonts.load('500 32px "JetBrains Mono"')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => {});

  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 0.9;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 600);

  scene.add(new THREE.HemisphereLight('#ffffff', '#111111', 0.4));
  const key = new THREE.DirectionalLight('#ffffff', 2.6);
  key.position.set(8, 22, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(phone.matches ? 1024 : 2048, phone.matches ? 1024 : 2048);
  Object.assign(key.shadow.camera, { near: 1, far: 70 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#ffffff', 2.4);
  rim.position.set(-9, 8, -14);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#ffffff', 0.5);
  fill.position.set(-12, 2, 8);
  scene.add(fill);

  // пол студии
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: floorTexture(), transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2;
  floor.renderOrder = -2;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ color: '#000000', opacity: 0.6, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.receiveShadow = true;
  shadow.renderOrder = -1;
  scene.add(floor, shadow);

  const V = {
    heli: buildHelicopter({ lowDetail: phone.matches }),
    plane: buildPlane({ lowDetail: phone.matches }),
  };
  for (const k of KEYS) scene.add(V[k].group);

  const callouts = makeCallouts();
  const measure = () => {
    for (const c of callouts) {
      c.el.classList.toggle('callout--docked', !c.mini && phone.matches);
      c.w = c.el.offsetWidth;
      c.h = c.el.offsetHeight;
    }
  };

  /* --- размеры --- */
  let vw = 0, vh = 0, fitK = 1;
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    if (w === vw && h === vh) return;
    vw = w; vh = h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const aspect = w / h;
    const vfov = Math.max(30, 2 * Math.atan(Math.tan(12 * DEG) / aspect) / DEG);
    camera.fov = vfov;
    camera.aspect = aspect;
    const hfov = 2 * Math.atan(Math.tan(vfov * DEG / 2) * aspect);
    fitK = 1 / Math.sin(Math.min(vfov * DEG, hfov) / 2);
    measure();
  };
  resize();
  addEventListener('resize', resize);
  document.fonts.ready.then(measure);
  if ('ResizeObserver' in window) {
    const ro = new ResizeObserver(() => measure());
    callouts.forEach((c) => ro.observe(c.el));
  }

  /* --- прокрутка --- */
  let sTarget = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    sTarget = max > 0 ? clamp(scrollY / max, 0, 1) * (N - 1) : 0;
  };
  addEventListener('scroll', readScroll, { passive: true });
  readScroll();
  let s = sTarget;
  const scrollToStep = (i) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollTo({ top: (i / (N - 1)) * max, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  $('#parts').addEventListener('click', (e) => {
    const b = e.target.closest('[data-step]');
    if (b) scrollToStep(+b.dataset.step);
  });
  $('#outro-restart').addEventListener('click', () => scrollToStep(0));
  $('#brand').addEventListener('click', (e) => { e.preventDefault(); scrollToStep(0); });

  const getView = (i) => {
    const st = STEPS[i];
    return { exposure: 1, ...st.view, ...(phone.matches ? st.mview || {} : {}) };
  };

  /* --- HUD и текстовые слои --- */
  const hud = { hdg: $('#hdg'), step: $('#stepno'), bar: $('#progress-fill') };
  const intro = $('#intro');
  const introInner = $('#intro-inner');
  const cue = $('#cue');
  const outro = $('#outro');
  const chapters = [...document.querySelectorAll('.chapter')].map((el) => ({ el, step: stepOf('chapter', el.dataset.veh) }));
  const sheets = [...document.querySelectorAll('.sheet')].map((el) => ({ el, step: stepOf('specs', el.dataset.veh) }));
  const groups = [...document.querySelectorAll('.parts__group')];
  const partButtons = [...document.querySelectorAll('.parts__item')];
  const setFade = (el, v) => {
    const o = v.toFixed(3);
    if (el._o === o) return;
    el._o = o;
    el.style.opacity = o;
    el.style.visibility = v < 0.01 ? 'hidden' : 'visible';
  };
  let lastHdg = -1, lastStep = -1;

  /* --- кадр --- */
  const Y = new THREE.Vector3(0, 1, 0);
  const tgt = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const clock = new THREE.Clock();
  let t = 0, bank = 0, prevYaw = null, shadowSize = 0;
  const yawNow = {};

  const frame = () => {
    resize();
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    const prevS = s;
    s += (sTarget - s) * (1 - Math.exp(-dt * (reduceMotion ? 30 : 6.5)));
    if (Math.abs(sTarget - s) < 1e-4 || SNAP) s = sTarget;
    const speed = Math.abs(s - prevS) / Math.max(dt, 1e-3);

    const i = Math.min(Math.floor(s), N - 2);
    const f = clamp(s - i, 0, 1);
    const e = ease(clamp((f - HOLD) / (1 - 2 * HOLD), 0, 1));
    const A = STEPS[i], B = STEPS[i + 1];
    const va = getView(i), vb = getView(i + 1);
    const swap = A.subject !== B.subject;
    const idle = reduceMotion ? 0 : Math.sin(t * 0.35) * 1.2;

    // машины: поворот, взлёт вертолёта, посадка самолёта
    for (const k of KEYS) {
      const veh = V[k];
      const inA = A.subject === k, inB = B.subject === k;
      veh.group.visible = inA || inB;
      if (!veh.group.visible) continue;
      const yawDeg = inA && inB ? lerp(va.yaw, vb.yaw, e) : inA ? va.yaw : vb.yaw;
      const yaw = (yawDeg + idle) * DEG;
      yawNow[k] = yaw;
      let pitch = 0, up = 0, ahead = 0;
      if (swap && inA) { // улетает
        const p = e;
        up = 16 * p * p; ahead = 26 * p * p * p; pitch = -0.22 * Math.min(1, p * 2);
      }
      if (swap && inB) { // прилетает
        const r = 1 - e;
        ahead = -80 * Math.pow(r, 1.6); up = 12 * r * r; pitch = 0.07 * Math.min(1, r * 3);
      }
      fwd.set(Math.cos(yaw), 0, -Math.sin(yaw));
      const bob = k === 'heli' && !reduceMotion ? Math.sin(t * 1.3) * 0.05 + Math.sin(t * 0.7) * 0.025 : 0;
      veh.group.position.set(fwd.x * ahead, veh.lift + up + bob, fwd.z * ahead);
      veh.group.rotation.set(0, yaw, 0);
      veh.group.rotateZ(pitch);
      if (k === 'heli') {
        const rate = prevYaw === null ? 0 : (yaw - prevYaw) / Math.max(dt, 1e-3);
        prevYaw = yaw;
        bank = lerp(bank, clamp(-rate * 0.05, -0.06, 0.06), 1 - Math.exp(-dt * 3));
        if (!reduceMotion) veh.group.rotateX(bank);
      }
      const rotorBoost = k === 'heli' && swap && inA ? e * 10 : 0;
      veh.update(t, dt, (reduceMotion ? 1.2 : 2.6) + speed * 4 + rotorBoost);
    }

    // камера
    const vA = V[A.subject], vB = V[B.subject];
    let dist;
    if (!swap) {
      const target = va.target.map((v, k) => lerp(v, vb.target[k], e));
      tgt.set(...target).add(vA.inner.position).applyAxisAngle(Y, yawNow[A.subject]);
      tgt.y += vA.lift;
      dist = lerp(va.dist, vb.dist, e) * vA.radius * fitK;
    } else {
      tA.set(...va.target).add(vA.inner.position).applyAxisAngle(Y, yawNow[A.subject]); tA.y += vA.lift;
      tB.set(...vb.target).add(vB.inner.position).applyAxisAngle(Y, yawNow[B.subject]); tB.y += vB.lift;
      tgt.lerpVectors(tA, tB, e);
      dist = lerp(va.dist * vA.radius, vb.dist * vB.radius, e) * fitK;
    }
    const el = lerp(va.elev, vb.elev, e) * DEG;
    camera.position.set(tgt.x, tgt.y + Math.sin(el) * dist, tgt.z + Math.cos(el) * dist);
    camera.lookAt(tgt);
    camera.setViewOffset(vw, vh, -lerp(va.shift[0], vb.shift[0], e) * vw, -lerp(va.shift[1], vb.shift[1], e) * vh, vw, vh);
    const exposure = lerp(va.exposure, vb.exposure, e);
    renderer.toneMappingExposure = exposure * 1.05;
    const glow = smooth(0.25, 0.8, exposure);
    for (const k of KEYS) V[k].glow(glow);

    // тень: охват под размер текущей машины
    const want = Math.round(lerp(vA.radius, vB.radius, e) * 1.45);
    if (want !== shadowSize) {
      shadowSize = want;
      Object.assign(key.shadow.camera, { left: -want, right: want, top: want, bottom: -want });
      key.shadow.camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
    updateOverlay();
    updateHud();
  };

  const updateOverlay = () => {
    const docked = phone.matches;
    const m = 16, mTop = docked ? 64 : 76, mBot = docked ? 64 : 72;
    for (const c of callouts) {
      const d0 = Math.abs(s - c.step);
      const vis = c.mini ? 1 - smooth(0.12, 0.36, d0) : 1 - smooth(0.16, 0.4, d0);
      if (vis <= 0.002 || !V[c.key].group.visible) {
        if (c.shown) { c.shown = false; c.g.style.display = 'none'; c.el.style.visibility = 'hidden'; }
        continue;
      }
      if (!c.shown) { c.shown = true; c.g.style.display = ''; c.el.style.visibility = 'visible'; }
      tmp.copy(V[c.key].anchors[c.mini ? c.part.overview : c.part.anchor]);
      V[c.key].inner.localToWorld(tmp);
      tmp.project(camera);
      const ax = (tmp.x * 0.5 + 0.5) * vw;
      const ay = (-tmp.y * 0.5 + 0.5) * vh;
      let d, len, left, top, kx, ky;
      if (!c.mini && docked) {
        left = (vw - c.w) / 2;
        top = vh - c.h - mBot;
        const px = clamp(ax, left + 18, left + c.w - 18);
        d = `M${ax.toFixed(1)},${ay.toFixed(1)}L${px.toFixed(1)},${top.toFixed(1)}M${left.toFixed(1)},${top.toFixed(1)}L${(left + c.w).toFixed(1)},${top.toFixed(1)}`;
        len = Math.hypot(px - ax, top - ay) + c.w;
        kx = px; ky = top;
      } else {
        const { dir, rise } = c.cfg;
        const base = c.mini ? (docked ? 22 : 34) : 80;
        const dx = docked ? base : (c.cfg.dx ?? base);
        const dy = docked ? base : (c.cfg.dy ?? base);
        let ex = ax + dir * dx, ey = ay - rise * dy;
        left = clamp(dir > 0 ? ex : ex - c.w, m, vw - m - c.w);
        top = clamp(rise > 0 ? ey - c.h : ey, mTop, vh - mBot - c.h);
        ex = dir > 0 ? left : left + c.w;
        ey = rise > 0 ? top + c.h : top;
        d = `M${ax.toFixed(1)},${ay.toFixed(1)}L${ex.toFixed(1)},${ey.toFixed(1)}L${(ex + dir * c.w).toFixed(1)},${ey.toFixed(1)}`;
        len = Math.hypot(ex - ax, ey - ay) + c.w;
        kx = ex; ky = ey;
      }
      const draw = smooth(0.05, 0.7, vis);
      const lab = smooth(0.5, 1, vis);
      c.path.setAttribute('d', d);
      c.path.style.strokeDasharray = `${len.toFixed(1)} ${(len + 2).toFixed(1)}`;
      c.path.style.strokeDashoffset = (len * (1 - draw)).toFixed(1);
      for (const node of [c.dot, c.ring]) { node.setAttribute('cx', ax.toFixed(1)); node.setAttribute('cy', ay.toFixed(1)); }
      c.dot.setAttribute('r', ((c.mini ? 3 : 4) * smooth(0, 0.3, vis)).toFixed(2));
      c.knee.setAttribute('cx', kx.toFixed(1));
      c.knee.setAttribute('cy', ky.toFixed(1));
      c.knee.style.opacity = smooth(0.35, 0.6, vis);
      c.g.style.opacity = smooth(0, 0.25, vis);
      const lift = (1 - lab) * 10 * (c.cfg.rise > 0 || docked ? 1 : -1);
      c.el.style.opacity = lab.toFixed(3);
      c.el.style.transform = `translate3d(${left.toFixed(1)}px, ${(top + lift).toFixed(1)}px, 0)`;
    }
  };

  const updateHud = () => {
    const cur = STEPS[Math.round(s)];
    const yaw = yawNow[cur.subject] ?? 0;
    const hdg = Math.round((((-yaw / DEG) % 360) + 360) % 360);
    if (hdg !== lastHdg) { hud.hdg.textContent = `HDG ${String(hdg).padStart(3, '0')}°`; lastHdg = hdg; }
    const ri = Math.round(s);
    if (ri !== lastStep) {
      lastStep = ri;
      const v = VEHICLES[cur.subject];
      hud.step.textContent = cur.kind === 'part' ? `${v.kind} · ${v.parts[cur.part].num}/${String(v.parts.length).padStart(2, '0')}`
        : cur.kind === 'intro' || cur.kind === 'outro' ? 'Выставка' : `${v.kind} · ${v.name}`;
      groups.forEach((g) => g.classList.toggle('is-current', g.dataset.veh === cur.subject));
      partButtons.forEach((b) => b.classList.toggle('is-active', +b.dataset.step === ri));
    }
    hud.bar.style.transform = `scaleX(${(s / (N - 1)).toFixed(4)})`;

    // название: уходит вверх, растворяется и размывается
    const q = smooth(0.02, 0.85, s - INTRO);
    setFade(intro, 1 - q);
    if (q < 1) {
      introInner.style.transform = `translate3d(0, ${(-q * 9).toFixed(2)}vh, 0) scale(${(1 + q * 0.22).toFixed(4)})`;
      introInner.style.filter = q > 0.01 ? `blur(${(q * 14).toFixed(1)}px)` : 'none';
    }
    setFade(cue, 1 - smooth(0.02, 0.15, s));
    for (const c of chapters) setFade(c.el, 1 - smooth(0.14, 0.4, Math.abs(s - c.step)));
    for (const c of sheets) setFade(c.el, 1 - smooth(0.14, 0.4, Math.abs(s - c.step)));
    setFade(outro, smooth(OUTRO - 0.6, OUTRO - 0.1, s));
    document.body.classList.toggle('at-edge', s < INTRO + 0.5 || s > OUTRO - 0.5);
  };

  renderer.setAnimationLoop(frame);
  frame();
  document.body.classList.add('is-ready');
}

start();
