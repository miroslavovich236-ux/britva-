import * as THREE from './vendor/three.module.min.js';
import { buildHelicopter, MAST, SKID_Y } from './model.js';
import { MODEL, PARTS, STEPS, OVERVIEW, SPECS } from './content.js';

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const DEG = Math.PI / 180;
const SVGNS = 'http://www.w3.org/2000/svg';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const N = STEPS.length;
const HOLD = 0.2;          // доля шага, когда вертолёт стоит на месте
const HOVER = 0.32;        // высота зависания над площадкой
const OVERVIEW_STEP = STEPS.findIndex((s) => s.kind === 'overview');
const SPECS_STEP = STEPS.findIndex((s) => s.kind === 'specs');
const SNAP = /[?&]snap\b/.test(location.search); // для скриншотов: без плавного догоняния

/* ---------- разметка из content.js ---------- */

function renderCopy() {
  $('#hero-eyebrow').textContent = MODEL.eyebrow;
  $('#hero-title').textContent = MODEL.name;
  $('#hero-text').textContent = MODEL.intro;
  $('#cue-text').textContent = MODEL.cue;
  $('#ov-eyebrow').textContent = OVERVIEW.eyebrow;
  $('#ov-title').textContent = OVERVIEW.title;
  $('#specs-eyebrow').textContent = SPECS.eyebrow;
  $('#specs-title').textContent = SPECS.title;
  $('#specs-note').textContent = SPECS.note;
  $('#specs-restart').lastChild.textContent = SPECS.button;
  $('#specs-grid').innerHTML = SPECS.items.map(([v, u, k]) =>
    `<div class="spec"><dd class="spec__value">${v}<small>${u}</small></dd><dt class="spec__key">${k}</dt></div>`).join('');

  // навигация по узлам
  $('#ov-legend').innerHTML = PARTS.map((p) => `<li><span>${p.num}</span>${p.tag}</li>`).join('');
  $('#parts').innerHTML = PARTS.map((p, i) => {
    const step = STEPS.findIndex((s) => s.part === i);
    return `<button type="button" class="parts__item" data-step="${step}" aria-label="${p.num}. ${p.tag}">
      <span class="parts__num">${p.num}</span><span class="parts__name">${p.tag}</span></button>`;
  }).join('');

  // секции прокрутки (их содержимое читают скринридеры)
  $('#track').innerHTML = STEPS.map((s, i) => {
    let body = '';
    if (s.kind === 'hero') body = `<h2>${MODEL.name}</h2><p>${MODEL.intro}</p>`;
    if (s.kind === 'part') { const p = PARTS[s.part]; body = `<h2>${p.num}. ${p.title}</h2><p>${p.text}</p><p>${p.stats.map(([v, k]) => `${k}: ${v}`).join('; ')}</p>`; }
    if (s.kind === 'overview') body = `<h2>${OVERVIEW.title}</h2>`;
    if (s.kind === 'specs') body = `<h2>${SPECS.title}</h2>`;
    return `<section class="step" id="step-${i}"><div class="sr-only">${body}</div></section>`;
  }).join('');
}

/* ---------- сцена ---------- */

function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  const sky = new THREE.SphereGeometry(60, 48, 24);
  const col = [];
  const p = sky.attributes.position;
  const top = new THREE.Color('#0c1622'), mid = new THREE.Color('#2b3a4c'), warm = new THREE.Color('#6a4a33'), low = new THREE.Color('#07090c');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 60;
    if (y > 0.12) c.lerpColors(mid, top, (y - 0.12) / 0.88);
    else if (y > -0.05) c.lerpColors(warm, mid, (y + 0.05) / 0.17);
    else c.lerpColors(low, warm, clamp((y + 0.4) / 0.35, 0, 1));
    col.push(c.r, c.g, c.b);
  }
  sky.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  env.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (w, h, intensity, color, pos, look) => {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    m.color.multiplyScalar(intensity);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    mesh.position.set(...pos);
    mesh.lookAt(...look);
    env.add(mesh);
  };
  panel(34, 10, 4.2, '#ffffff', [0, 26, 4], [0, 0, 0]);        // верхний софтбокс
  panel(3, 26, 5.0, '#fff4e6', [28, 8, 10], [0, 0, 0]);        // боковая полоса
  panel(3, 22, 3.2, '#cfe2ff', [-26, 6, -14], [0, 0, 0]);      // контровой
  panel(60, 3, 2.4, '#ff9d55', [0, 1.5, -36], [0, 0, 0]);      // закат на горизонте
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}

function helipadTexture() {
  const S = 2048, U = S / 40; // 40 м на текстуру
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2;
  const rg = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  rg.addColorStop(0, 'rgba(46,58,72,0.95)');
  rg.addColorStop(0.35, 'rgba(30,40,52,0.75)');
  rg.addColorStop(0.62, 'rgba(18,26,36,0.25)');
  rg.addColorStop(1, 'rgba(18,26,36,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, S, S);
  // круг посадочной площадки (жёлтый, как на настоящих вертолётных площадках)
  g.strokeStyle = 'rgba(242,177,52,0.34)';
  g.lineWidth = 0.22 * U;
  g.beginPath(); g.arc(cx, cx, 4.6 * U, 0, Math.PI * 2); g.stroke();
  // буква H
  g.fillStyle = 'rgba(226,234,242,0.12)';
  const hw = 1.6 * U, hh = 2.6 * U, st = 0.42 * U;
  g.fillRect(cx - hw, cx - hh, st, hh * 2);
  g.fillRect(cx + hw - st, cx - hh, st, hh * 2);
  g.fillRect(cx - hw, cx - st / 2, hw * 2, st);
  // компасная роза
  g.strokeStyle = 'rgba(215,230,242,0.26)';
  g.fillStyle = 'rgba(215,230,242,0.34)';
  g.font = `500 ${0.5 * U}px "JetBrains Mono", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const R = 7.8 * U;
  for (let d = 0; d < 360; d += 5) {
    const a = (d - 90) * DEG;
    const len = d % 30 === 0 ? 0.75 : d % 10 === 0 ? 0.45 : 0.25;
    g.lineWidth = d % 30 === 0 ? 0.06 * U : 0.035 * U;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * R, cx + Math.sin(a) * R);
    g.lineTo(cx + Math.cos(a) * (R - len * U), cx + Math.sin(a) * (R - len * U));
    g.stroke();
    if (d % 30 === 0) {
      g.save();
      g.translate(cx + Math.cos(a) * (R + 0.6 * U), cx + Math.sin(a) * (R + 0.6 * U));
      g.rotate(a + Math.PI / 2);
      g.fillText(d === 0 ? 'N' : String(d / 10).padStart(2, '0'), 0, 0);
      g.restore();
    }
  }
  g.lineWidth = 0.04 * U;
  g.beginPath(); g.arc(cx, cx, R, 0, Math.PI * 2); g.stroke();
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
  PARTS.forEach((p, i) => {
    for (const mini of [false, true]) {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', mini ? 'leader leader--mini' : 'leader');
      const path = document.createElementNS(SVGNS, 'path');
      const ring = document.createElementNS(SVGNS, 'circle');
      const dot = document.createElementNS(SVGNS, 'circle');
      ring.setAttribute('class', 'leader__ring');
      ring.setAttribute('r', mini ? 7 : 11);
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
        part: p, mini, g, path, ring, dot, knee, el, w: 0, h: 0,
        step: mini ? OVERVIEW_STEP : STEPS.findIndex((s) => s.part === i),
        cfg: mini ? p.mini : p.label,
        anchor: null, shown: false,
      });
    }
  });
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
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);

  // шрифт нужен для надписей на корпусе
  await Promise.race([
    Promise.all([document.fonts.load('600 64px Tektur'), document.fonts.load('500 32px "JetBrains Mono"')]),
    new Promise((r) => setTimeout(r, 1500)),
  ]).catch(() => {});

  const scene = new THREE.Scene();
  scene.environment = makeEnvironment(renderer);
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);

  scene.add(new THREE.HemisphereLight('#a9c1de', '#1b140f', 0.45));
  const key = new THREE.DirectionalLight('#fff0dc', 2.4);
  key.position.set(6, 16, 9);
  key.castShadow = true;
  key.shadow.mapSize.set(phone.matches ? 1024 : 2048, phone.matches ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 45 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight('#8db4ff', 1.8);
  rim.position.set(-7, 6, -10);
  scene.add(rim);
  const dusk = new THREE.DirectionalLight('#ff9a52', 0.7);
  dusk.position.set(-9, 1.5, 5);
  scene.add(dusk);

  // площадка
  const groundY = SKID_Y - HOVER;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: helipadTexture(), transparent: true, depthWrite: false }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = groundY;
  pad.renderOrder = -2;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), new THREE.ShadowMaterial({ color: '#02050a', opacity: 0.55, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = groundY + 0.004;
  shadow.receiveShadow = true;
  shadow.renderOrder = -1;
  scene.add(pad, shadow);
  key.target.position.set(0, groundY, 0);

  const heli = buildHelicopter({ lowDetail: phone.matches });
  scene.add(heli.group);

  const callouts = makeCallouts();
  const measure = () => {
    for (const c of callouts) {
      c.el.classList.toggle('callout--docked', !c.mini && phone.matches);
      c.w = c.el.offsetWidth;
      c.h = c.el.offsetHeight;
    }
  };

  /* --- размеры --- */
  let vw = 0, vh = 0, baseDist = 20;
  const resize = () => {
    const w = innerWidth, h = innerHeight;
    if (w === vw && h === vh) return;
    vw = w; vh = h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    const aspect = w / h;
    // на узком экране шире угол обзора, чтобы вертолёт не был «плоским»
    const vfov = Math.max(30, 2 * Math.atan(Math.tan(12 * DEG) / aspect) / DEG);
    camera.fov = vfov;
    camera.aspect = aspect;
    const hfov = 2 * Math.atan(Math.tan(vfov * DEG / 2) * aspect);
    baseDist = 5.0 / Math.sin(Math.min(vfov * DEG, hfov) / 2);
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
  $('#specs-restart').addEventListener('click', () => scrollToStep(0));
  $('#brand').addEventListener('click', (e) => { e.preventDefault(); scrollToStep(0); });

  const getView = (i) => {
    const st = STEPS[i];
    return phone.matches ? { ...st.view, ...(st.mview || {}) } : st.view;
  };
  const viewAt = (x) => {
    const i = Math.min(Math.floor(x), N - 2);
    const f = clamp(x - i, 0, 1);
    const e = ease(clamp((f - HOLD) / (1 - 2 * HOLD), 0, 1));
    const a = getView(i), b = getView(i + 1);
    return {
      yaw: lerp(a.yaw, b.yaw, e), elev: lerp(a.elev, b.elev, e), dist: lerp(a.dist, b.dist, e),
      target: a.target.map((v, k) => lerp(v, b.target[k], e)),
      shift: a.shift.map((v, k) => lerp(v, b.shift[k], e)),
    };
  };

  /* --- HUD --- */
  const hud = { hdg: $('#hdg'), step: $('#stepno'), bar: $('#progress-fill') };
  const partButtons = [...document.querySelectorAll('.parts__item')];
  const fades = { hero: $('#hero-copy'), cue: $('#cue'), overview: $('#overview-copy'), legend: $('#ov-legend'), specs: $('#specs') };
  const setFade = (el, v) => {
    el.style.opacity = v.toFixed(3);
    el.style.visibility = v < 0.01 ? 'hidden' : 'visible';
  };
  let lastHdg = -1, lastStep = -1;

  /* --- кадр --- */
  const Y = new THREE.Vector3(0, 1, 0);
  const tgt = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const clock = new THREE.Clock();
  let prevYaw = null, bank = 0, t = 0;

  const frame = () => {
    resize();
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;
    const prevS = s;
    s += (sTarget - s) * (1 - Math.exp(-dt * (reduceMotion ? 30 : 6.5)));
    if (Math.abs(sTarget - s) < 1e-4 || SNAP) s = sTarget;
    const speed = Math.abs(s - prevS) / Math.max(dt, 1e-3);

    const v = viewAt(s);
    const idle = reduceMotion ? 0 : Math.sin(t * 0.35) * 1.2;
    const yaw = (v.yaw + idle) * DEG;

    // вертолёт: разворот, лёгкое покачивание и крен в повороте
    const yawRate = prevYaw === null ? 0 : (yaw - prevYaw) / Math.max(dt, 1e-3);
    prevYaw = yaw;
    bank = lerp(bank, clamp(-yawRate * 0.05, -0.06, 0.06), 1 - Math.exp(-dt * 3));
    heli.group.rotation.set(0, yaw, 0);
    heli.group.rotateX(reduceMotion ? 0 : bank);
    heli.group.position.y = reduceMotion ? 0 : Math.sin(t * 1.3) * 0.05 + Math.sin(t * 0.7) * 0.025;
    heli.update(t, dt, (reduceMotion ? 1.2 : 2.6) + speed * 4);

    // камера
    tgt.set(v.target[0] - MAST.x, v.target[1], v.target[2]).applyAxisAngle(Y, yaw);
    const d = v.dist * baseDist;
    const el = v.elev * DEG;
    camera.position.set(tgt.x, tgt.y + Math.sin(el) * d, tgt.z + Math.cos(el) * d);
    camera.lookAt(tgt);
    camera.setViewOffset(vw, vh, -v.shift[0] * vw, -v.shift[1] * vh, vw, vh);

    renderer.render(scene, camera);
    updateOverlay();
    updateHud(yaw);
  };

  const updateOverlay = () => {
    const docked = phone.matches;
    const m = 16;
    const mTop = docked ? 64 : 76;
    const mBot = docked ? 64 : 72;
    for (const c of callouts) {
      const vis = c.mini
        ? 1 - smooth(0.12, 0.36, Math.abs(s - c.step))
        : 1 - smooth(0.16, 0.4, Math.abs(s - c.step));
      if (vis <= 0.002) {
        if (c.shown) { c.shown = false; c.g.style.display = 'none'; c.el.style.visibility = 'hidden'; }
        continue;
      }
      if (!c.shown) { c.shown = true; c.g.style.display = ''; c.el.style.visibility = 'visible'; }

      tmp.copy(heli.anchors[c.mini ? c.part.overview : c.part.anchor]);
      heli.inner.localToWorld(tmp);
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
        left = dir > 0 ? ex : ex - c.w;
        top = rise > 0 ? ey - c.h : ey;
        left = clamp(left, m, vw - m - c.w);
        top = clamp(top, mTop, vh - mBot - c.h);
        ex = dir > 0 ? left : left + c.w;
        ey = rise > 0 ? top + c.h : top;
        const px = ex + dir * c.w;
        d = `M${ax.toFixed(1)},${ay.toFixed(1)}L${ex.toFixed(1)},${ey.toFixed(1)}L${px.toFixed(1)},${ey.toFixed(1)}`;
        len = Math.hypot(ex - ax, ey - ay) + c.w;
        kx = ex; ky = ey;
      }
      const draw = smooth(0.05, 0.7, vis);
      const lab = smooth(0.5, 1, vis);
      c.path.setAttribute('d', d);
      c.path.style.strokeDasharray = `${len.toFixed(1)} ${(len + 2).toFixed(1)}`;
      c.path.style.strokeDashoffset = (len * (1 - draw)).toFixed(1);
      for (const node of [c.dot, c.ring]) { node.setAttribute('cx', ax.toFixed(1)); node.setAttribute('cy', ay.toFixed(1)); }
      c.dot.setAttribute('r', (c.mini ? 3 : 4) * smooth(0, 0.3, vis));
      c.knee.setAttribute('cx', kx.toFixed(1));
      c.knee.setAttribute('cy', ky.toFixed(1));
      c.knee.style.opacity = smooth(0.35, 0.6, vis);
      c.g.style.opacity = smooth(0, 0.25, vis);
      const lift = (1 - lab) * 10 * (c.cfg.rise > 0 || docked ? 1 : -1);
      c.el.style.opacity = lab.toFixed(3);
      c.el.style.transform = `translate3d(${left.toFixed(1)}px, ${(top + lift).toFixed(1)}px, 0)`;
    }
  };

  const updateHud = (yaw) => {
    const hdg = Math.round((((-yaw / DEG) % 360) + 360) % 360);
    if (hdg !== lastHdg) { hud.hdg.textContent = `HDG ${String(hdg).padStart(3, '0')}°`; lastHdg = hdg; }
    const i = Math.round(s);
    if (i !== lastStep) {
      lastStep = i;
      const st = STEPS[i];
      hud.step.textContent = st.kind === 'part' ? `${PARTS[st.part].num} / ${String(PARTS.length).padStart(2, '0')}`
        : st.kind === 'hero' ? 'Обзор' : st.kind === 'overview' ? 'Все узлы' : 'ТТХ';
      partButtons.forEach((b) => b.classList.toggle('is-active', +b.dataset.step === i));
    }
    hud.bar.style.transform = `scaleX(${(s / (N - 1)).toFixed(4)})`;
    setFade(fades.hero, 1 - smooth(0.04, 0.32, s));
    setFade(fades.cue, 1 - smooth(0.02, 0.15, s));
    setFade(fades.overview, 1 - smooth(0.14, 0.38, Math.abs(s - OVERVIEW_STEP)));
    setFade(fades.legend, 1 - smooth(0.14, 0.38, Math.abs(s - OVERVIEW_STEP)));
    setFade(fades.specs, smooth(SPECS_STEP - 0.55, SPECS_STEP - 0.12, s));
  };

  renderer.setAnimationLoop(frame);
  frame();
  document.body.classList.add('is-ready');
}

start();
