// ═══════════════════════════════════════════════
// ENTITIES — car mesh + human characters
// ═══════════════════════════════════════════════
var CAR_MODELS = [
  { name: 'MUSCLE', color: 0xcc1111, accent: 0x2a0a0a, roof: 0x1a1a1a, css: '#ff4433', stripe: true },
  { name: 'RACER',  color: 0x0066dd, accent: 0x0a1a33, roof: 0x0a0a14, css: '#3388ff', stripe: false },
  { name: 'STREET', color: 0x22aa33, accent: 0x0e2a12, roof: 0x111111, css: '#33cc44', stripe: true },
  { name: 'GHOST',  color: 0xd0d4dc, accent: 0x222630, roof: 0x30343c, css: '#cccccc', stripe: false },
  { name: 'GOLD',   color: 0xe0a010, accent: 0x2a1c00, roof: 0x1a1200, css: '#ffbb22', stripe: true }
];

// Extrude a side-profile [(z,y)…] across the car's width → one clean solid
function profileGeo(pts, width, bevel) {
  var sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (var i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]);
  sh.closePath();
  var b = bevel || 0;
  var g = new THREE.ExtrudeGeometry(sh, { depth: width - 2 * b, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: 1, steps: 1 });
  g.translate(0, 0, -(width - 2 * b) / 2);
  g.rotateY(-Math.PI / 2);                         // shape-x → car forward (+z), extrusion → car width (x)
  return g;
}

var _wheelGeo = null;
function wheelParts() {
  if (_wheelGeo) return _wheelGeo;
  var tire = new THREE.CylinderGeometry(0.68, 0.68, 0.56, 18); tire.rotateZ(Math.PI / 2);
  var rim = new THREE.CylinderGeometry(0.46, 0.46, 0.6, 10); rim.rotateZ(Math.PI / 2);
  var hub = new THREE.CylinderGeometry(0.14, 0.14, 0.64, 8); hub.rotateZ(Math.PI / 2);
  var s1 = new THREE.BoxGeometry(0.62, 0.86, 0.1), s2 = new THREE.BoxGeometry(0.62, 0.1, 0.86);
  _wheelGeo = { tire: tire, rim: rim, hub: hub, s1: s1, s2: s2, arch: (function () { var a = new THREE.CylinderGeometry(0.78, 0.78, 0.06, 20); a.rotateZ(Math.PI / 2); return a; })() };
  return _wheelGeo;
}

function buildCarMesh(o) {
  o = o || {};
  var police = !!o.police;
  var body = o.color !== undefined ? o.color : 0xcc1111;
  var accent = o.accent !== undefined ? o.accent : 0x222222;
  var roofC = o.roof !== undefined ? o.roof : 0x151515;
  var g = new THREE.Group(), shell = new THREE.Group(); g.add(shell);
  var mBody = lam(body), mAcc = lam(accent), mRoof = lam(roofC);
  var mGlass = lam(0x2b4658, { emissive: 0x0a1822 });
  var mChrome = lam(0xb8c4d0), mDark = lam(0x0c0c10), mTyre = lam(0x131313), mRim = lam(0xc8ccd4);

  // lower body: nose → hood → cowl → trunk → tail
  var tub = new THREE.Mesh(profileGeo([
    [-4.15, 0.42], [-4.22, 0.7], [-4.2, 1.18], [-3.7, 1.4], [-2.3, 1.44], [2.2, 1.46], [3.5, 1.3], [4.12, 1.1], [4.22, 0.75], [4.15, 0.42]
  ], 3.7, 0.1), mBody);
  shell.add(tub);
  // underbody (hides the see-through gap between wheels)
  addBox(shell, 3.3, 0.35, 7.6, 0, 0.38, 0, mDark);
  // greenhouse (glass) + roof cap + pillars
  var cabin = new THREE.Mesh(profileGeo([[-2.45, 1.42], [-1.45, 2.3], [0.95, 2.3], [2.0, 1.44]], 3.1, 0), mGlass);
  shell.add(cabin);
  addBox(shell, 3.2, 0.14, 2.55, 0, 2.34, -0.25, police ? lam(0x101420) : mRoof);
  addBox(shell, 3.14, 0.95, 0.16, 0, 1.88, -0.55, mRoof);                  // B pillar
  var pa = addBox(shell, 3.16, 0.14, 0.16, 0, 1.9, 1.5, mRoof); pa.rotation.x = -0.9;     // windshield header
  var pr = addBox(shell, 3.16, 0.14, 0.16, 0, 1.9, -1.98, mRoof); pr.rotation.x = 0.8;
  // paint details
  if (o.stripe && !police) { addBox(shell, 0.5, 0.03, 3.2, 0, 1.465, 3.0, mAcc); addBox(shell, 0.5, 0.03, 1.6, 0, 1.455, -3.1, mAcc); addBox(shell, 0.5, 0.03, 4.6, 0, 2.4, -0.25, mAcc); }
  addBox(shell, 0.9, 0.12, 1.0, 0, 1.5, 2.3, mDark);                       // hood vent
  [-1, 1].forEach(function (s) {
    addBox(shell, 0.05, 0.62, 0.05, s * 1.87, 0.95, 0.95, mDark);          // door seams
    addBox(shell, 0.05, 0.62, 0.05, s * 1.87, 0.95, -1.7, mDark);
    addBox(shell, 0.06, 0.1, 0.4, s * 1.88, 1.18, 0.4, mChrome);          // handles
    addBox(shell, 0.34, 0.2, 0.14, s * 1.8, 1.68, 1.45, mBody);           // mirrors
    addBox(shell, 0.06, 0.2, 7.0, s * 1.86, 0.58, 0, mAcc);               // side skirts
  });
  // front: grille, lamps, splitter
  addBox(shell, 1.9, 0.34, 0.1, 0, 0.82, 4.3, mDark);
  addBox(shell, 1.9, 0.05, 0.1, 0, 0.95, 4.33, mChrome);
  addBox(shell, 3.6, 0.2, 0.5, 0, 0.44, 4.05, mDark);
  var hl = bas(0xfff2b0), drl = bas(0xffffff);
  [-1, 1].forEach(function (s) {
    addBox(shell, 0.95, 0.28, 0.12, s * 1.2, 1.0, 4.2, hl);
    addBox(shell, 0.95, 0.06, 0.1, s * 1.2, 0.82, 4.22, drl);
  });
  // rear: tail lights (swap colour when braking), plate, bumper, exhaust
  g.userData.tail = [new THREE.MeshBasicMaterial({ color: 0x8a1010 })];
  var tm = g.userData.tail[0];
  [-1, 1].forEach(function (s) {
    addBox(shell, 1.0, 0.26, 0.12, s * 1.25, 1.02, -4.22, tm);
    var ex = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8), mChrome); ex.rotation.x = Math.PI / 2; ex.position.set(s * 1.0, 0.45, -4.3); shell.add(ex);
  });
  addBox(shell, 3.2, 0.18, 0.4, 0, 0.48, -4.1, mDark);
  addBox(shell, 0.95, 0.34, 0.05, 0, 0.78, -4.25, bas(0xeeeeee));
  if (!police && o.spoiler !== false) {
    [-1, 1].forEach(function (s) { addBox(shell, 0.14, 0.5, 0.4, s * 1.3, 1.66, -3.9, mAcc); });
    addBox(shell, 3.5, 0.1, 0.65, 0, 1.95, -3.95, mBody);
  }
  if (police) {
    [-1, 1].forEach(function (s) { addBox(shell, 0.04, 0.62, 2.7, s * 1.88, 0.95, -0.2, bas(0xe8eef8)); });
    addBox(shell, 2.2, 0.16, 0.6, 0, 2.5, -0.25, mDark);
    var rl = new THREE.MeshBasicMaterial({ color: 0xff1100 }), bl = new THREE.MeshBasicMaterial({ color: 0x1122ff });
    addBox(shell, 1.0, 0.2, 0.5, -0.55, 2.62, -0.25, rl); addBox(shell, 1.0, 0.2, 0.5, 0.55, 2.62, -0.25, bl);
    g.userData.sirenL = { material: rl }; g.userData.sirenR = { material: bl };
  }
  // wheels: pivot (steer) → spin (roll) → tyre/rim/spokes, plus a dark arch disc on the body side
  var wp = wheelParts(); g.userData.wheels = []; g.userData.front = [];
  [[-1, 2.75, true], [1, 2.75, true], [-1, -2.7, false], [1, -2.7, false]].forEach(function (w) {
    var piv = new THREE.Group(); piv.position.set(w[0] * 1.72, 0.68, w[1]);
    var spin = new THREE.Group(); piv.add(spin);
    spin.add(new THREE.Mesh(wp.tire, mTyre)); spin.add(new THREE.Mesh(wp.rim, mRim));
    spin.add(new THREE.Mesh(wp.s1, mDark)); spin.add(new THREE.Mesh(wp.s2, mDark)); spin.add(new THREE.Mesh(wp.hub, mChrome));
    g.add(piv); g.userData.wheels.push(spin); if (w[2]) g.userData.front.push(piv);
    var arch = new THREE.Mesh(wp.arch, mDark); arch.position.set(w[0] * 1.87, 0.68, w[1]); g.add(arch);
  });
  // soft shadow blob
  var sh = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 9.4), new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.06; g.add(sh);
  // headlight pool (visible at night)
  var beam = new THREE.Mesh(new THREE.PlaneGeometry(7, 20), new THREE.MeshBasicMaterial({ map: beamTex(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  beam.rotation.x = -Math.PI / 2; beam.position.set(0, 0.12, 15); g.add(beam); g.userData.beam = beam;
  g.userData.shell = shell;
  if (police) {
    [-1, 1].forEach(function (s) {
      var pl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshBasicMaterial({ map: policeTex(), transparent: true }));
      pl.position.set(s * 1.89, 0.95, -0.2); pl.rotation.y = s * Math.PI / 2; shell.add(pl);
    });
  }
  return g;
}

var _shadowT = null, _beamT = null, _policeT = null;
function shadowTex() { if (!_shadowT) _shadowT = canvasTex(64, 128, function (x, w, h) { var gr = x.createRadialGradient(32, 64, 4, 32, 64, 60); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }); return _shadowT; }
function beamTex() { if (!_beamT) _beamT = canvasTex(64, 128, function (x, w, h) { var gr = x.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,245,190,0.55)'); gr.addColorStop(1, 'rgba(255,245,190,0)'); x.fillStyle = gr; x.beginPath(); x.moveTo(w * 0.35, h); x.lineTo(w * 0.65, h); x.lineTo(w, 0); x.lineTo(0, 0); x.closePath(); x.fill(); }); return _beamT; }
function policeTex() { if (!_policeT) _policeT = canvasTex(256, 56, function (x, w, h) { x.fillStyle = '#10182c'; x.font = 'bold 40px Arial Black, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('POLICE', w / 2, h / 2); }); return _policeT; }

// Per-frame car mesh sync: position, heading, body roll/pitch, wheels, lights
function syncCarMesh(mesh, car, dt, nightF) {
  mesh.position.set(car.x, 0, car.z);
  mesh.rotation.y = car.a;
  var shell = mesh.userData.shell;
  if (shell) {
    var tr = -Core.clamp(car.vl * 0.012, -0.05, 0.05) - car.steer * Core.clamp(car.vf / 60, 0, 1) * 0.03;
    var tp = -Core.clamp((car.accel || 0) * 0.0015, -0.04, 0.04);
    shell.rotation.z = Core.damp(shell.rotation.z, tr, 8, dt);
    shell.rotation.x = Core.damp(shell.rotation.x, tp, 8, dt);
  }
  var ws = mesh.userData.wheels, fr = mesh.userData.front;
  if (ws) { var rot = car.vf * dt / 0.68; for (var i = 0; i < ws.length; i++) ws[i].rotation.x += rot; }
  if (fr) { var st = car.steer * Core.lerp(0.5, 0.15, Core.clamp(Math.abs(car.vf) / 60, 0, 1)); for (var j = 0; j < fr.length; j++) fr[j].rotation.y = st; }
  if (mesh.userData.tail) mesh.userData.tail[0].color.setHex(car.braking ? 0xff2020 : 0x8a1010);
  if (mesh.userData.beam) mesh.userData.beam.material.opacity = Core.clamp(nightF, 0, 1) * 0.55;
}

// ═══════ HUMANS ═══════
var skinTones = [0xffccaa, 0xdd9966, 0xcc8844, 0xffddcc, 0xaa7744, 0x885533];
var femHair = [0x111111, 0x882200, 0xddbb44, 0x332211, 0xff6699, 0x221133];
var malHair = [0x111111, 0x332211, 0x554433, 0x221100];
var femTops = [0xee2266, 0xcc44aa, 0x8822cc, 0xff6600, 0x22aacc, 0xee4488, 0xdd6622];
var malTops = [0x223388, 0x334422, 0x443322, 0x222255, 0x226644, 0x552222];
var femBots = [0x111122, 0x441133, 0x223344, 0x332200, 0x110022];
var malBots = [0x111122, 0x222233, 0x333322, 0x221100];
function rndPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildHuman(cfg) {
  var g = new THREE.Group();
  var sk = lam(cfg.skin), tm = lam(cfg.top), bm = lam(cfg.bot), hm = lam(cfg.hair), shoeM = lam(0x111111);
  var lLeg = addBox(g, 0.22, cfg.lh, 0.22, -cfg.ls, cfg.lh / 2, 0, bm), rLeg = addBox(g, 0.22, cfg.lh, 0.22, cfg.ls, cfg.lh / 2, 0, bm);
  addBox(g, 0.24, 0.14, 0.4, -cfg.ls, 0.07, 0.08, shoeM); addBox(g, 0.24, 0.14, 0.4, cfg.ls, 0.07, 0.08, shoeM);
  addBox(g, cfg.tw + 0.04, 0.12, cfg.td + 0.04, 0, cfg.lh + 0.07, 0, lam(0x221100));
  addBox(g, cfg.tw, cfg.toh, cfg.td, 0, cfg.lh + cfg.toh / 2, 0, tm);
  // arms hang from the shoulder pivot so they swing naturally
  var lArm = new THREE.Group(), rArm = new THREE.Group();
  lArm.position.set(-(cfg.tw / 2 + 0.12), cfg.lh + cfg.toh - 0.08, 0); rArm.position.set(cfg.tw / 2 + 0.12, cfg.lh + cfg.toh - 0.08, 0);
  addBox(lArm, 0.2, cfg.ah, 0.2, 0, -cfg.ah / 2 + 0.05, 0, sk); addBox(rArm, 0.2, cfg.ah, 0.2, 0, -cfg.ah / 2 + 0.05, 0, sk);
  g.add(lArm); g.add(rArm);
  var neckY = cfg.lh + cfg.toh;
  var neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.22, 8), sk); neck.position.y = neckY + 0.11; g.add(neck);
  var headY = neckY + cfg.hh / 2 + 0.22;
  addBox(g, cfg.hw, cfg.hh, cfg.hd, 0, headY, 0, sk);
  addBox(g, cfg.hw + 0.04, cfg.hairH, cfg.hd + 0.04, 0, neckY + cfg.hh + 0.22 - cfg.hairH * 0.3, 0, hm);
  var eyeM = bas(0x111111);
  addBox(g, 0.1, 0.08, 0.05, -0.13, neckY + cfg.hh * 0.38 + 0.22, cfg.hd / 2 + 0.01, eyeM); addBox(g, 0.1, 0.08, 0.05, 0.13, neckY + cfg.hh * 0.38 + 0.22, cfg.hd / 2 + 0.01, eyeM);
  if (cfg.female) {
    addBox(g, 0.18, 0.05, 0.04, 0, neckY + cfg.hh * 0.14 + 0.22, cfg.hd / 2 + 0.01, bas(0xdd1144));
    addBox(g, cfg.hw + 0.06, 0.55, cfg.hd * 0.55, 0, neckY + cfg.hh * 0.55 + 0.22, -cfg.hd * 0.28, hm);
    if (cfg.skirt) addBox(g, cfg.tw + 0.22, 0.5, cfg.td + 0.22, 0, cfg.lh + 0.25, 0, tm);
  }
  g.userData.lLeg = lLeg; g.userData.rLeg = rLeg; g.userData.lArm = lArm; g.userData.rArm = rArm;
  g.userData.headY = headY;
  return g;
}
function buildFemale(top) { return buildHuman({ skin: rndPick(skinTones), top: top || rndPick(femTops), bot: rndPick(femBots), hair: rndPick(femHair), lh: 0.72, ls: 0.16, tw: 0.56, toh: 0.62, td: 0.28, ah: 0.52, hw: 0.44, hh: 0.44, hd: 0.44, hairH: 0.18, female: true, skirt: Math.random() > 0.4 }); }
function buildMale(top) { return buildHuman({ skin: rndPick(skinTones), top: top || rndPick(malTops), bot: rndPick(malBots), hair: rndPick(malHair), lh: 0.82, ls: 0.18, tw: 0.64, toh: 0.68, td: 0.32, ah: 0.60, hw: 0.48, hh: 0.46, hd: 0.46, hairH: 0.12, female: false }); }
// the player on foot: punk with a neon mohawk and a dark jacket
function buildHero() {
  var h = buildHuman({ skin: 0xddaa88, top: 0x15151c, bot: 0x22222c, hair: 0x15151c, lh: 0.82, ls: 0.18, tw: 0.68, toh: 0.7, td: 0.34, ah: 0.62, hw: 0.48, hh: 0.46, hd: 0.46, hairH: 0.1, female: false });
  addBox(h, 0.12, 0.36, 0.58, 0, h.userData.headY + 0.36, -0.02, bas(0x33ff99));
  addBox(h, 0.7, 0.1, 0.36, 0, 1.64, 0.0, lam(0xff2288));                                    // collar stripe
  addBox(h, 0.5, 0.1, 0.06, 0, h.userData.headY + 0.04, 0.25, bas(0x000000));                 // shades
  return h;
}
function animateWalk(h, t, speed) {
  var u = h.userData; if (!u.lLeg) return;
  var s = Math.sin(t) * 0.7 * Math.min(1, speed);
  u.lLeg.rotation.x = s; u.rLeg.rotation.x = -s;
  u.lArm.rotation.x = -s * 0.8; u.rArm.rotation.x = s * 0.8;
}
