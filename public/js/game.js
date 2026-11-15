// ═══════════════════════════════════════════════
// GAME — state, input, driving, police, pedestrians, camera, main loop
// ═══════════════════════════════════════════════
var UPGRADES = [
  { id: 'nitro2',   name: 'NITRO II',  price: 300, req: null,     desc: 'More boost power, burns less nitro' },
  { id: 'nitro3',   name: 'NITRO III', price: 500, req: 'nitro2', desc: 'Massive boost, very efficient' },
  { id: 'topspeed', name: 'ENGINE',    price: 400, req: null,     desc: 'Higher top speed' },
  { id: 'armor',    name: 'ARMOR',     price: 350, req: null,     desc: 'Take 40% less crash damage' }
];
function findUpgrade(id) { for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) return UPGRADES[i]; return null; }

var G = {
  built: false, running: false, paused: false, over: false,
  mode: 'car', place: null,
  t: 0, tod: 9.0,
  car: null, carMesh: null, hero: null, foot: null,
  camYaw: 0, camPitch: 0.32, camT: 1, fov: 62, lookIdle: 9, shake: 0, shakeT: 0,
  money: 0, score: 0, kills: 0, heat: 0, stars: 0, evadeT: 0, bustT: 0,
  cops: [], peds: [], parts: [], upg: {}, P: null,
  interact: null, grace: 0, copSpawnCD: 0, clubSecs: 0, clubDecay: 0,
  m: null, bonus: {}, flags: {}, selCar: 0, name: 'PLAYER', outFuelWarn: false, nearMiss: 0, speedMax: 0
};
var IN = { gas: false, brk: false, nos: false, hnd: false, spr: false, actHeld: false };   // touch buttons
var keys = {};
var CV = null, clock = null, VW = window.innerWidth, VH = window.innerHeight;
var isTouchDevice = false;

function $(id) { return document.getElementById(id); }
var _tc = {};
function setT(id, v) { if (_tc[id] === v) return; _tc[id] = v; var e = $(id); if (e) e.textContent = v; }
function setW(id, pct) { var e = $(id); if (!e) return; var k = 'w' + id; var v = Math.round(pct); if (_tc[k] === v) return; _tc[k] = v; e.firstElementChild.style.width = v + '%'; }
function show(id, on, disp) { var e = $(id); if (e) e.style.display = on ? (disp || 'block') : 'none'; }
function hasClass(el, c) { return el.classList.contains(c); }

// ═══════════ INPUT ═══════════
var pad = { id: null, x: 0, y: 0 };
var look = { id: null, lx: 0, ly: 0, dx: 0, dy: 0 };

function typing(e) { var t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'); }
window.addEventListener('keydown', function (e) {
  if (typing(e)) return;
  var k = e.key.toLowerCase();
  if (k === ' ' || k.indexOf('arrow') === 0 || k === 'tab') e.preventDefault();
  if (!keys[k]) {
    if (k === 'e' && G.running && !G.paused) actPress();
    else if (k === 'm') toggleOverlay('map-ov');
    else if (k === 'j') toggleOverlay('ms-ov');
    else if (k === 'p' || k === 'escape') togglePause();
    else if (k === 'r' || k === '0') unstuckCar();
  }
  keys[k] = true;
});
window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', function () { keys = {}; IN.gas = IN.brk = IN.nos = IN.hnd = IN.spr = IN.actHeld = false; });

function bindHold(id, prop) {
  var el = $(id); if (!el) return;
  el.addEventListener('pointerdown', function (e) { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) {} IN[prop] = true; el.classList.add('on'); });
  var up = function (e) { IN[prop] = false; el.classList.remove('on'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
  el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}
function setupInput() {
  bindHold('t-gas', 'gas'); bindHold('t-brk', 'brk'); bindHold('t-nos', 'nos'); bindHold('t-hnd', 'hnd'); bindHold('t-spr', 'spr');
  var act = $('t-act');
  act.addEventListener('pointerdown', function (e) { e.preventDefault(); try { act.setPointerCapture(e.pointerId); } catch (x) {} IN.actHeld = true; act.classList.add('on'); if (G.running && !G.paused) actPress(); });
  var aup = function () { IN.actHeld = false; act.classList.remove('on'); };
  act.addEventListener('pointerup', aup); act.addEventListener('pointercancel', aup); act.addEventListener('lostpointercapture', aup);

  // steering / movement pad
  var padEl = $('pad'), knob = $('pad-knob');
  function updPad(e) {
    var r = padEl.getBoundingClientRect(), R = r.width / 2 * 0.78;
    var dx = (e.clientX - (r.left + r.width / 2)) / R, dy = (e.clientY - (r.top + r.height / 2)) / R, l = Math.sqrt(dx * dx + dy * dy);
    if (l > 1) { dx /= l; dy /= l; }
    pad.x = dx; pad.y = dy; knob.style.transform = 'translate(' + (dx * R) + 'px,' + (dy * R) + 'px)';
  }
  padEl.addEventListener('pointerdown', function (e) { e.preventDefault(); pad.id = e.pointerId; try { padEl.setPointerCapture(e.pointerId); } catch (x) {} updPad(e); });
  padEl.addEventListener('pointermove', function (e) { if (e.pointerId === pad.id) updPad(e); });
  var pup = function (e) { if (e.pointerId !== pad.id) return; pad.id = null; pad.x = pad.y = 0; knob.style.transform = 'translate(0,0)'; };
  padEl.addEventListener('pointerup', pup); padEl.addEventListener('pointercancel', pup); padEl.addEventListener('lostpointercapture', pup);

  // camera look (right side of the screen on touch, mouse drag on desktop) — on-foot only
  function lookDown(e) { if (G.mode !== 'foot') return; look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY; try { e.target.setPointerCapture(e.pointerId); } catch (x) {} }
  function lookMove(e) { if (e.pointerId !== look.id) return; look.dx += e.clientX - look.lx; look.dy += e.clientY - look.ly; look.lx = e.clientX; look.ly = e.clientY; }
  function lookUp(e) { if (e.pointerId === look.id) look.id = null; }
  [$('look'), $('c')].forEach(function (el) {
    el.addEventListener('pointerdown', lookDown); el.addEventListener('pointermove', lookMove);
    el.addEventListener('pointerup', lookUp); el.addEventListener('pointercancel', lookUp);
  });
  $('c').addEventListener('contextmenu', function (e) { e.preventDefault(); });

  // device class
  var coarse = window.matchMedia && window.matchMedia('(pointer:coarse)').matches;
  isTouchDevice = coarse || ('ontouchstart' in window && window.innerWidth < 1100);
  document.body.classList.add(isTouchDevice ? 'touch' : 'desktop');
  window.addEventListener('touchstart', function () { if (!isTouchDevice) { isTouchDevice = true; document.body.classList.remove('desktop'); document.body.classList.add('touch'); } }, { passive: true, once: true });
  // block browser gestures (pinch / double-tap zoom / pull-to-refresh)
  document.addEventListener('touchmove', function (e) { if (e.target.closest && e.target.closest('#ms-box,#map-legend')) return; e.preventDefault(); }, { passive: false });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });

  // orientation notice
  var rm = $('rotate-msg');
  function ori() { rm.style.display = (isTouchDevice && window.innerWidth < window.innerHeight) ? 'flex' : 'none'; }
  ori(); window.addEventListener('resize', ori); window.addEventListener('orientationchange', function () { setTimeout(ori, 200); });
}

function carInput() {
  var steer = 0, analog = false;
  if (pad.id !== null && Math.abs(pad.x) > 0.001) {
    var s = pad.x, dz = 0.07;
    s = Math.abs(s) < dz ? 0 : Math.sign(s) * Math.pow((Math.abs(s) - dz) / (1 - dz), 1.35);
    steer = -s; analog = true;
  } else steer = ((keys['a'] || keys['arrowleft']) ? 1 : 0) - ((keys['d'] || keys['arrowright']) ? 1 : 0);
  return {
    throttle: (keys['w'] || keys['arrowup'] || IN.gas) ? 1 : 0,
    brake: (keys['s'] || keys['arrowdown'] || IN.brk) ? 1 : 0,
    steer: steer, analog: analog,
    hand: !!(keys[' '] || IN.hnd),
    nitro: !!(keys['shift'] || IN.nos)
  };
}

// ═══════════ THREE INIT ═══════════
function initThree() {
  CV = $('c');
  var mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || isTouchDevice;
  var scene = new THREE.Scene();
  W.scene = scene;
  var camera = new THREE.PerspectiveCamera(62, VW / VH, 0.5, 1100);
  W.camera = camera;
  var renderer = new THREE.WebGLRenderer({ canvas: CV, antialias: !mobile });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
  renderer.setSize(VW, VH, false);
  W.renderer = renderer;
  W.bgColor = new THREE.Color(0x6699e6); scene.background = W.bgColor;
  W.fog = new THREE.FogExp2(0x6699e6, 0.0011); scene.fog = W.fog;
  clock = new THREE.Clock();
  CV.addEventListener('webglcontextlost', function (e) { e.preventDefault(); G.running = false; }, false);
  CV.addEventListener('webglcontextrestored', function () { if (G.built && !G.over) G.running = true; }, false);
  window.addEventListener('resize', function () {
    VW = window.innerWidth; VH = window.innerHeight;
    camera.aspect = VW / VH; camera.updateProjectionMatrix(); renderer.setSize(VW, VH, false);
  });
}

// ═══════════ START / RESET ═══════════
function applyUpgrades() {
  var P = Core.defaultParams();
  if (G.upg.nitro2) { P.nitroAcc *= 1.3; P.nitroUse *= 0.8; }
  if (G.upg.nitro3) { P.nitroAcc *= 1.25; P.nitroUse *= 0.8; P.nitroTopMul = 1.38; }
  if (G.upg.topspeed) { P.top *= 1.26; P.acc *= 1.1; }
  if (G.upg.armor) P.armor = 0.6;
  G.P = P;
}

function startGame() {
  show('title', false); $('title').classList.remove('show');
  document.body.classList.add('playing');
  initAudio();
  if (!G.built) {
    initThree(); buildWorld(); buildInteriors();
    G.hero = buildHero(); G.hero.visible = false; W.scene.add(G.hero);
    G.built = true; buildMapLegend(); loop();
  }
  resetGame();
}

function resetGame() {
  var i;
  for (i = 0; i < G.peds.length; i++) W.root.remove(G.peds[i].mesh); G.peds = [];
  removeCops(); stopSiren(); stopClubMusic();
  for (i = 0; i < G.parts.length; i++) W.root.remove(G.parts[i]); G.parts = [];
  if (G.place) leaveInteriorState();
  if (G.carMesh) W.root.remove(G.carMesh);
  var m = CAR_MODELS[G.selCar];
  G.carMesh = buildCarMesh({ color: m.color, accent: m.accent, roof: m.roof, stripe: m.stripe });
  W.root.add(G.carMesh);
  G.car = Core.makeCar(4, 4, 0); G.car.fuel = 35; G.car.nitro = 100;
  G.upg = {}; applyUpgrades();
  G.mode = 'car'; G.place = null; G.over = false; G.paused = false;
  G.money = 200; G.score = 0; G.kills = 0; G.heat = 0; G.stars = 0; G.evadeT = 0; G.bustT = 0;
  G.tod = 9.0; G.t = 0; G.grace = 3; G.clubSecs = 0; G.clubDecay = 0; G.copSpawnCD = 0; G.outFuelWarn = false; G.speedMax = 0;
  G.camYaw = 0; G.camT = 1; G.fov = 62; G.shake = 0; G.interact = null;
  G.flags = {}; G.bonus = {};
  W.pumps.forEach(function (p) { if (!p.alive) { p.alive = true; p.group.visible = true; if (W.cols.indexOf(p.col) < 0) W.cols.push(p.col); } });
  W.int.bank.reset(); G.bank = { stage: 0, vaultT: 0, alarmT: 0, loot: false, done: false, cd: 0 };
  W.int.tune.refreshLabels();
  document.body.classList.remove('foot');
  ['gameover', 'winscreen'].forEach(function (id) { $(id).classList.remove('show'); });
  closeOverlays();
  show('toast', false); show('prompt', false);
  spawnPeds();
  initMissions();
  updateHUD(0.016, true);
  setCarCameraSnap();
  clock.getDelta(); G.running = true;
  setupMpHud();
}

function setCarCameraSnap() {
  G.camYaw = G.car.a;
  var f = Math.sin(G.camYaw), z = Math.cos(G.camYaw);
  W.camera.position.set(G.car.x - f * 16, 7, G.car.z - z * 16);
  W.camera.lookAt(G.car.x, 1.6, G.car.z);
}

// ═══════════ CRASH / DAMAGE ═══════════
var crashHooks = {
  onImpact: function (impact, col) {
    var car = G.car;
    if (col && col.type === 'pump' && impact > 5 && col.ref && col.ref.alive) { blowPump(col.ref); }
    if (car.hitCD > 0) return;
    var dmg = Core.crashDamage(impact, G.P.armor);
    if (dmg > 0) {
      car.hitCD = 0.18;
      applyDamage(dmg, impact);
    } else if (impact > 3) {                           // gentle bump: sound only, never damage
      car.hitCD = 0.25; playBump(0.18);
    }
  }
};
function applyDamage(dmg, impact) {
  if (G.grace > 0 || G.mode !== 'car') return;
  G.car.health = Math.max(0, G.car.health - dmg);
  playBump(Math.min(1, impact / 40)); cameraShake(0.25, Math.min(0.9, 0.2 + impact / 60));
  if (G.car.health <= 0) gameOver('WRECKED');
}
function cameraShake(dur, amt) { G.shakeT = Math.max(G.shakeT, dur); G.shake = Math.max(G.shake, amt); }

function blowPump(p) {
  p.alive = false; p.group.visible = false;
  var k = W.cols.indexOf(p.col); if (k >= 0) W.cols.splice(k, 1);
  explode(p.x, 2, p.z);
  applyDamage(14, 40);
  addHeat(2); mEvent('pump'); bonusDone('pump');
  toast('PUMP DESTROYED!', 1800, '#ff6600');
}

// ═══════════ PARTICLES ═══════════
function explode(x, y, z) {
  for (var i = 0; i < 24; i++) {
    var pg = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.4, 5, 5), new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff6600 : 0xffcc00, transparent: true, opacity: 1 }));
    pg.position.set(x, y, z);
    pg.userData = { vx: (Math.random() - 0.5) * 18, vy: Math.random() * 12 + 4, vz: (Math.random() - 0.5) * 18, life: 1, kind: 'boom' };
    W.root.add(pg); G.parts.push(pg);
  }
  playBump(1); cameraShake(0.5, 0.6);
}
function spawnSmoke(x, y, z) {
  var m = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.25, 6, 6), new THREE.MeshBasicMaterial({ color: 0x8a8a8a, transparent: true, opacity: 0.35 }));
  m.position.set(x, y, z); m.userData = { kind: 'smoke', vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 0.8 + 0.5, vz: (Math.random() - 0.5) * 1.2, life: 0.9 };
  W.root.add(m); G.parts.push(m);
}
function updateParticles(dt) {
  for (var i = G.parts.length - 1; i >= 0; i--) {
    var p = G.parts[i], u = p.userData;
    if (u.kind === 'smoke') { u.vy += 0.4 * dt; p.scale.multiplyScalar(1 + 0.6 * dt); p.material.opacity = Math.max(0, u.life * 0.35); u.life -= dt * 0.7; }
    else { u.vy -= 20 * dt; u.life -= dt * 1.2; p.material.opacity = Math.max(0, u.life); }
    p.position.x += u.vx * dt; p.position.y += u.vy * dt; p.position.z += u.vz * dt;
    if (u.life <= 0) { W.root.remove(p); p.geometry.dispose(); p.material.dispose(); G.parts.splice(i, 1); }
  }
}

// ═══════════ PEDESTRIANS (walk the sidewalk loop around each block) ═══════════
function spawnPed(avoidX, avoidZ) {
  var cands = W.blocks.filter(function (b) { return !b.special && (avoidX === undefined || Math.hypot(b.x - avoidX, b.z - avoidZ) > 70); });
  var b = cands[Math.floor(Math.random() * cands.length)];
  var female = Math.random() > 0.5;
  var mesh = female ? buildFemale() : buildMale();
  var kind = rndPick(['walk', 'walk', 'walk', 'run', 'kiss']);
  var p = { mesh: mesh, bx: b.x, bz: b.z, s: Math.random() * 144, off: (Math.random() - 0.5) * 5, dir: Math.random() > 0.5 ? 1 : -1, kind: kind, dead: false, deadT: 0, ph: Math.random() * 6, x: 0, z: 0, partner: null };
  W.root.add(mesh); placePed(p); return p;
}
function placePed(p) {
  var s = ((p.s % 144) + 144) % 144, side = Math.floor(s / 36), u = (s % 36) - 18, R = 18 + p.off, x, z, hx, hz;
  if (side === 0) { x = u; z = -R; hx = 1; hz = 0; }
  else if (side === 1) { x = R; z = u; hx = 0; hz = 1; }
  else if (side === 2) { x = -u; z = R; hx = -1; hz = 0; }
  else { x = -R; z = -u; hx = 0; hz = -1; }
  p.x = p.bx + x; p.z = p.bz + z;
  p.mesh.position.set(p.x, 0.35, p.z);
  p.mesh.rotation.y = Math.atan2(hx * p.dir, hz * p.dir);
}
function spawnPeds() {
  for (var i = 0; i < 70; i++) G.peds.push(spawnPed());
  var kissers = G.peds.filter(function (p) { return p.kind === 'kiss'; });
  for (var k = 0; k + 1 < kissers.length; k += 2) {
    var a = kissers[k], b = kissers[k + 1]; a.partner = b; b.partner = a;
    b.bx = a.bx; b.bz = a.bz; b.s = a.s; b.off = a.off + 0.9; b.dir = -a.dir; placePed(a); placePed(b);
    a.mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); b.mesh.rotation.y = a.mesh.rotation.y + Math.PI;
  }
  G.peds.forEach(function (p) { if (p.kind === 'kiss' && !p.partner) p.kind = 'walk'; });
}
function updatePeds(dt) {
  var car = G.car;
  for (var i = 0; i < G.peds.length; i++) {
    var p = G.peds[i];
    if (p.dead) {
      p.deadT += dt;
      if (p.deadT > 9) { W.root.remove(p.mesh); G.peds[i] = spawnPed(car.x, car.z); }
      continue;
    }
    // too far away to matter: skip animation work
    var dx = p.x - car.x, dz = p.z - car.z;
    if (dx * dx + dz * dz > 260 * 260) continue;
    p.ph += dt;
    if (p.kind === 'kiss') { p.mesh.position.y = 0.35 + Math.sin(p.ph * 0.8) * 0.015; continue; }
    var spd = p.kind === 'run' ? 6.5 : 2.6;
    p.s += p.dir * spd * dt; placePed(p);
    p.mesh.position.y = 0.35 + Math.abs(Math.sin(p.ph * spd * 1.4)) * 0.08;
    animateWalk(p.mesh, p.ph * spd * 1.6, 1);
    if (p.mesh.userData.lArm) { /* arms already swinging */ }
  }
}
function checkKills() {
  var car = G.car, sp = Math.hypot(car.vx, car.vz);
  if (G.grace > 1.5) return;
  var s = Math.sin(car.a), c = Math.cos(car.a);
  for (var i = 0; i < G.peds.length; i++) {
    var p = G.peds[i]; if (p.dead) continue;
    var dx = p.x - car.x, dz = p.z - car.z;
    if (dx * dx + dz * dz > 30) continue;
    var lf = dx * s + dz * c, ll = dx * c - dz * s;
    if (Math.abs(ll) < Core.CAR_HW + 0.5 && Math.abs(lf) < Core.CAR_HL + 0.5) {
      if (sp < 7) { p.s += p.dir * 3 * 0.02; p.off += (ll > 0 ? 1 : -1) * 0.05; continue; }   // slow roll: ped is nudged, not killed
      p.dead = true; p.deadT = 0; p.mesh.rotation.x = Math.PI / 2; p.mesh.position.y = 0.25;
      if (p.partner) p.partner.partner = null;
      G.kills++; G.score += 100; G.money += 40;
      addHeat(1);
      playPedHit();
      // splat flies forward a little
      p.mesh.position.x += car.vx * 0.05; p.mesh.position.z += car.vz * 0.05;
    }
  }
}

// ═══════════ WANTED / POLICE ═══════════
function addHeat(h) {
  G.heat += h;
  var s = Math.min(5, Math.floor(G.heat / 2));
  if (s > G.stars) { G.stars = s; G.evadeT = 0; onStarsUp(); }
}
function setStars(n) {
  n = Core.clamp(n, 0, 5);
  var up = n > G.stars; G.stars = n; G.heat = n * 2; G.evadeT = 0;
  if (n === 0) { removeCops(); stopSiren(); }
  else if (up) onStarsUp();
}
function onStarsUp() {
  startSiren(); G.copSpawnCD = 0;
  toast('WANTED LEVEL ' + G.stars + ' — POLICE!', 2000, '#ff4433');
}
function removeCops() { for (var i = 0; i < G.cops.length; i++) W.root.remove(G.cops[i].mesh); G.cops = []; }

function spawnCop() {
  var car = G.car, tries = 0, n;
  do { n = { i: Math.floor(Math.random() * Core.ROAD_LINES.length), j: Math.floor(Math.random() * Core.ROAD_LINES.length) }; tries++; }
  while (tries < 30 && (Math.hypot(Core.ROAD_LINES[n.i] - car.x, Core.ROAD_LINES[n.j] - car.z) < 110 || Math.hypot(Core.ROAD_LINES[n.i] - car.x, Core.ROAD_LINES[n.j] - car.z) > 230));
  placeCopAt(Core.ROAD_LINES[n.i], Core.ROAD_LINES[n.j]);
}
function placeCopAt(x, z) {
  var c = Core.makeCar(x, z, 0);
  var toP = Math.atan2(G.car.x - x, G.car.z - z); c.a = Math.round(toP / (Math.PI / 2)) * (Math.PI / 2);
  var mesh = buildCarMesh({ police: true, color: 0x15204a, accent: 0x0a0a18, roof: 0x0a0a14 });
  W.root.add(mesh);
  G.cops.push({ car: c, mesh: mesh, brain: {}, path: [], pathT: 0, blink: 0, hitCD: 0 });
  return G.cops[G.cops.length - 1];
}
function copParams() { var P = Core.defaultParams(); P.top = 34 + G.stars * 5; P.acc = 18 + G.stars * 2; P.nitroTopMul = 1; return P; }

function updateCops(dt) {
  var car = G.car, i, j;
  if (G.stars > 0) {
    G.copSpawnCD -= dt;
    if (G.cops.length < G.stars && G.copSpawnCD <= 0) { spawnCop(); G.copSpawnCD = 2.2; }
  }
  var P = copParams(), seen = false, nearest = 1e9, anyClose = false;
  for (i = 0; i < G.cops.length; i++) {
    var c = G.cops[i], cc = c.car;
    var dx = car.x - cc.x, dz = car.z - cc.z, dist = Math.sqrt(dx * dx + dz * dz);
    nearest = Math.min(nearest, dist);
    var los = dist < 90 && Core.lineOfSight(cc.x, cc.z, car.x, car.z, W.cols);
    if (los || dist < 30) seen = true;
    // target: straight at the player when in sight, otherwise follow the road graph
    var tx, tz;
    if (los && dist < 90) { tx = car.x + car.vx * Math.min(0.6, dist / 80); tz = car.z + car.vz * Math.min(0.6, dist / 80); }
    else {
      c.pathT -= dt;
      if (c.pathT <= 0 || !c.path.length) { c.path = Core.findPath(cc.x, cc.z, car.x, car.z, 6); c.pathT = 0.9; }
      while (c.path.length && Math.hypot(c.path[0].x - cc.x, c.path[0].z - cc.z) < 16) c.path.shift();
      if (c.path.length) { tx = c.path[0].x; tz = c.path[0].z; } else { tx = car.x; tz = car.z; }
    }
    var inp = Core.driveToward(cc, tx, tz, P.top, c.brain, dt);
    Core.stepCar(cc, inp, P, dt, W.cols, null);
    // car ↔ car
    if (G.mode === 'car' && G.grace <= 0) {
      var rel = Core.collideCars(car, cc, 1.0, 1.1);
      if (rel > 0 && c.hitCD <= 0) {
        c.hitCD = 0.25;
        var dmg = Core.crashDamage(rel, G.P.armor) * 0.8;
        if (dmg > 0) applyDamage(dmg, rel); else if (rel > 3) playBump(0.25);
      }
    }
    c.hitCD = Math.max(0, c.hitCD - dt);
    for (j = i + 1; j < G.cops.length; j++) Core.collideCars(cc, G.cops[j].car, 1, 1);
    // runaway cop: bring it back near the action
    if (dist > 320) { var r = G.cops.splice(i, 1)[0]; W.root.remove(r.mesh); i--; continue; }
    syncCarMesh(c.mesh, cc, dt, W.dayF === undefined ? 0 : 1 - W.dayF);
    c.blink += dt;
    var on = Math.floor(c.blink * 6) % 2 === 0;
    c.mesh.userData.sirenL.material.color.setHex(on ? 0xff1100 : 0x330000);
    c.mesh.userData.sirenR.material.color.setHex(on ? 0x000833 : 0x1122ff);
    if (dist < 14 && Math.hypot(car.vx, car.vz) < 4) anyClose = true;
  }
  if (G.stars > 0) {
    // evade: stay out of sight for a while and the heat drops a star
    if (!seen) G.evadeT += dt * (nearest > 220 ? 2 : 1); else G.evadeT = Math.max(0, G.evadeT - dt * 1.5);
    if (G.evadeT >= 7) { setStars(G.stars - 1); G.evadeT = 0; toast(G.stars ? 'HEAT DOWN — ' + G.stars + ' STAR' + (G.stars > 1 ? 'S' : '') : 'YOU LOST THE POLICE!', 1800, '#0ffcd4'); if (G.cops.length > G.stars) { var rm = G.cops.pop(); W.root.remove(rm.mesh); } }
    // busted: stopped with a cop on top of you
    if (anyClose) G.bustT += dt; else G.bustT = Math.max(0, G.bustT - dt * 2);
    if (G.bustT > 3) bust();
    setSirenVolume(Core.clamp(1.4 - nearest / 150, 0.15, 1));
  } else { G.evadeT = 0; G.bustT = 0; }
}
function bust() {
  var fine = Math.floor(G.money * 0.4);
  G.money -= fine; setStars(0); G.bustT = 0; G.grace = 2;
  triggerDrama('BUSTED!', 'FINED 40% OF YOUR CASH', '-$' + fine, '#ffcc00');
  playTone(220, 0.25, 'sawtooth', 0.06);
}

// ═══════════ CAR MODE ═══════════
function updateCarMode(dt) {
  var car = G.car, inp = carInput();
  var vf0 = car.vf;
  Core.stepCar(car, inp, G.P, dt, W.cols, crashHooks);
  car.accel = (car.vf - vf0) / Math.max(dt, 0.001);
  G.grace = Math.max(0, G.grace - dt);
  var sp = Math.hypot(car.vx, car.vz);
  G.speedMax = Math.max(G.speedMax, sp * Core.KMH);

  // fuel (more speed → more fuel)
  if (sp > 0.5) car.fuel = Math.max(0, car.fuel - (0.05 + sp * 0.0062) * dt);
  if (car.fuel <= 0 && !G.outFuelWarn) { G.outFuelWarn = true; toast('OUT OF FUEL!  Roll to a stop and call a tow', 3000, '#ff4433'); }
  if (car.fuel > 5) G.outFuelWarn = false;

  if (car.health < 35 && sp > 5) {
    G.smokeT = (G.smokeT || 0) - dt;
    if (G.smokeT <= 0) { G.smokeT = 0.09 + Math.random() * 0.08; spawnSmoke(car.x + Math.sin(car.a) * 3.4, 1.6, car.z + Math.cos(car.a) * 3.4); }
  }
  checkKills();
  syncCarMesh(G.carMesh, car, dt, W.dayF === undefined ? 0 : 1 - W.dayF);
  computeCarInteract();
}

function computeCarInteract() {
  var car = G.car, kmh = Math.hypot(car.vx, car.vz) * Core.KMH, best = null, k;
  for (k in PLACES) {
    var p = PLACES[k], d = Math.hypot(car.x - p.svc.x, car.z - p.svc.z);
    if (d < p.svc.r + 2.5) {
      if (kmh > 25) { best = { text: 'SLOW DOWN — ' + p.name, act: null }; }
      else best = { text: placeActionLabel(k), act: function (key) { return function () { placeAction(key); }; }(k), place: k };
      break;
    }
  }
  if (!best && car.fuel <= 0 && kmh < 4) best = { text: 'CALL TOW TRUCK — FREE RIDE TO THE GAS STATION', act: callTow };
  G.interact = best;
}
function placeActionLabel(k) {
  var car = G.car;
  if (k === 'gas') { var need = 100 - car.fuel; return need < 3 ? 'TANK IS FULL' : 'REFUEL — $' + Math.ceil(need * 0.5); }
  if (k === 'garage') { var hp = Math.ceil(100 - car.health); return hp <= 0 ? 'FREE INSPECTION' : (G.flags.garage ? 'REPAIR — $' + hp * 2 : 'REPAIR — FREE (FIRST VISIT)'); }
  if (k === 'bank') return 'ENTER THE BANK';
  if (k === 'club') return 'ENTER CLUB NEON';
  if (k === 'tune') return 'ENTER THE TUNE SHOP';
  return PLACES[k].name;
}
function placeAction(k) {
  var car = G.car;
  if (k === 'gas') {
    var need = 100 - car.fuel;
    if (need < 3) { toast('Tank is already full', 1400, '#00ffcc'); return; }
    var cost = Math.ceil(need * 0.5);
    if (G.money <= 0) { toast('No money for fuel!', 1600, '#ff4433'); return; }
    var pay = Math.min(cost, G.money), add = need * (pay / cost);
    G.money -= pay; car.fuel = Math.min(100, car.fuel + add);
    playTone(400, 0.06, 'sine', 0.04); setTimeout(function () { playTone(500, 0.06, 'sine', 0.04); }, 80); setTimeout(function () { playTone(650, 0.12, 'sine', 0.05); }, 160);
    triggerDrama('REFUELLED', 'FUEL +' + Math.round(add), '-$' + pay, '#00ffcc');
    mEvent('refuel');
  } else if (k === 'garage') {
    var hp = Math.ceil(100 - car.health);
    if (hp <= 0) { toast('Car checked — all good!', 1500, '#00d8ff'); mEvent('garage'); G.flags.garage = true; return; }
    var cost2 = G.flags.garage ? hp * 2 : 0;
    if (G.money < cost2) { toast('Need $' + cost2 + ' to repair', 1800, '#ff4433'); return; }
    G.money -= cost2; car.health = 100; G.flags.garage = true;
    cameraShake(0.4, 0.25); playTone(300, 0.08, 'sine', 0.04); setTimeout(function () { playTone(550, 0.14, 'sine', 0.05); }, 150);
    triggerDrama('REPAIRED', 'FULL HEALTH', cost2 ? '-$' + cost2 : 'FREE', '#00d8ff');
    mEvent('garage');
  } else enterPlace(k);
}
function callTow() {
  var s = PLACES.gas.svc; var c = G.car;
  c.x = s.x; c.z = s.z + 0.5; c.a = Math.PI; c.vx = c.vz = 0; c.w = 0; c.fuel = 10;
  G.outFuelWarn = false; setCarCameraSnap(); toast('TOWED TO THE GAS STATION (+10 fuel)', 2200, '#00ffcc');
}
function actPress() {
  if (!G.interact || !G.interact.act) return;
  G.interact.act();
}

function unstuckCar() {
  if (!G.running || G.mode !== 'car' || G.over) return;
  var c = G.car, n = Core.nearestNode(c.x, c.z);
  c.x = Core.ROAD_LINES[n.i]; c.z = Core.ROAD_LINES[n.j];
  c.a = Math.round(c.a / (Math.PI / 2)) * (Math.PI / 2); c.vx = c.vz = c.w = 0;
  setCarCameraSnap(); toast('POSITION RESET', 1200, '#0ffcd4');
}

// ═══════════ CAMERA (car) ═══════════
function updateCarCamera(dt) {
  var car = G.car, sp = Math.hypot(car.vx, car.vz);
  var ty = car.a;
  if (sp > 8 && car.vf > 0) ty = car.a + Core.angDiff(car.a, Math.atan2(car.vx, car.vz)) * 0.45;      // lean into drifts
  G.camYaw += Core.angDiff(G.camYaw, ty) * (1 - Math.exp(-6 * dt));
  var dist = 14.5 + sp * 0.06, h = 6.2 + sp * 0.028;
  var fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw);
  var cx = car.x - fx * dist, cz = car.z - fz * dist;
  var t = Core.armT(car.x, car.z, cx, cz, W.cols, 1.3);                        // never inside a building
  G.camT = Core.damp(G.camT, t, t < G.camT ? 30 : 3.5, dt);
  var tt = Math.min(G.camT, t < 1 ? t : 1);
  var px = car.x + (cx - car.x) * tt, pz = car.z + (cz - car.z) * tt, py = Core.lerp(3.2, h, tt);
  var cam = W.camera;
  cam.position.set(px, py, pz);
  if (G.shakeT > 0) { G.shakeT -= dt; var a = G.shake * Math.min(1, G.shakeT * 4); cam.position.x += (Math.random() - 0.5) * a; cam.position.y += (Math.random() - 0.5) * a * 0.6; cam.position.z += (Math.random() - 0.5) * a; if (G.shakeT <= 0) G.shake = 0; }
  cam.lookAt(car.x + fx * 7, 1.8, car.z + fz * 7);
  var tf = 62 + sp * 0.14 + (car.boosting ? 10 : 0);
  G.fov = Core.damp(G.fov, tf, 4, dt);
  if (Math.abs(cam.fov - G.fov) > 0.05) { cam.fov = G.fov; cam.updateProjectionMatrix(); }
}

// ═══════════ GAME OVER / WIN ═══════════
function gameOver(title) {
  if (G.over) return;
  G.over = true; G.running = false;
  stopSiren(); updateEngineSound(0, 0, false);
  $('go-title').textContent = title || 'WRECKED';
  setT('goscore', G.score); setT('gomis', G.m.cur);
  $('gameover').classList.add('show');
}
function triggerWin() {
  if (G.over) return;
  G.over = true; G.running = false; stopSiren(); updateEngineSound(0, 0, false);
  setT('winscore', G.score); setT('winmoney', G.money);
  $('winscreen').classList.add('show');
  playTone(660, 0.14, 'square', 0.05); setTimeout(function () { playTone(880, 0.18, 'sine', 0.05); }, 150);
}

// ═══════════ MAIN LOOP ═══════════
function loop() {
  requestAnimationFrame(loop);
  if (!G.built) return;
  var dt = Math.min(clock.getDelta(), 0.05);
  if (G.running) {
    if (G.paused) { if ($('map-ov').classList.contains('show')) drawFullMap(); }
    else {
      G.t += dt;
      if (G.mode === 'car') {
        G.tod = (G.tod + dt * 0.08) % 24;
        updateCarMode(dt);
        updateCops(dt);
        updatePeds(dt);
        updateParticles(dt);
        updateMissions(dt);
        if (typeof mpCollide === 'function') mpCollide(dt);
        updateCarCamera(dt);
        updateSky(G.tod, W.camera.position);
        updateWorldFx(dt);
        updateEngineSound(Math.hypot(G.car.vx, G.car.vz), carInput().throttle, true, G.car.boosting);
      } else {
        updateFoot(dt);
        updateEngineSound(0, 0, false);
      }
      updateHUD(dt);
    }
  }
  if (typeof mpUpdateRemotes === 'function') mpUpdateRemotes(dt);
  W.renderer.render(W.scene, W.camera);
}

function updateWorldFx(dt) {
  var t = G.t, i;
  for (i = 0; i < W.animated.length; i++) { var a = W.animated[i]; if (a.kind === 'ring') a.mat.opacity = 0.55 + Math.sin(t * 3) * 0.3; }
  var on = Math.floor(t * 1.6) % 2 === 0;
  for (i = 0; i < W.beacons.length; i++) W.beacons[i].material.color.setHex(on ? 0xff2200 : 0x330800);
  if (W.clubBeams) { W.clubBeams[0].rotation.z = Math.sin(t * 0.9) * 0.6; W.clubBeams[0].rotation.x = Math.cos(t * 0.7) * 0.4; W.clubBeams[1].rotation.z = Math.cos(t * 0.8) * 0.6; W.clubBeams[1].rotation.x = Math.sin(t * 1.1) * 0.4; }
  if (W.clubNeon) for (i = 0; i < W.clubNeon.length; i++) W.clubNeon[i].material.color.setHSL((t * 0.2 + i * 0.2) % 1, 1, 0.55);
  // objective beam
  var tg = currentTarget();
  if (tg && G.mode === 'car') {
    W.beam.visible = true; W.beam.position.set(tg.x, 0, tg.z);
    var col = tg.color || 0xffcc00; W.beamMat.color.setHex(col); W.beamRing.color.setHex(col);
    var s = tg.r ? tg.r / 6 : 1.3; W.beamRing.opacity = 0.6 + Math.sin(t * 4) * 0.3;
    W.beam.children[1].scale.set(s, s, s);
  } else W.beam.visible = false;
}

window.addEventListener('load', function () {
  setupInput();
  buildCarChips();
  $('btn-solo-play').addEventListener('click', function () { G.name = ($('mp-name').value || 'PLAYER').toUpperCase(); startGame(); });
  $('btn-retry').addEventListener('click', function () { resetGame(); });
  $('btn-again').addEventListener('click', function () { resetGame(); });
  initHud();
});

function buildCarChips() {
  var box = $('car-chips');
  CAR_MODELS.forEach(function (m, i) {
    var d = document.createElement('div'); d.className = 'chip' + (i === 0 ? ' active' : ''); d.textContent = m.name; d.style.color = m.css; d.style.borderColor = m.css;
    d.addEventListener('click', function () { G.selCar = i; Array.prototype.forEach.call(box.children, function (c, j) { c.classList.toggle('active', j === i); }); });
    box.appendChild(d);
  });
}
