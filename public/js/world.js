// ═══════════════════════════════════════════════
// WORLD — city, places, colliders, sky, labels
// Everything outdoors lives in W.root so interiors can hide it.
// ═══════════════════════════════════════════════
var W = { cols: [], places: {}, pumps: [], blocks: [], nightMats: [], glow: null, animated: [], ready: false };

function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Places: centre, size, colour and the SERVICE ring (where the car must be to interact)
var PLACES = {
  gas:    { id: 'gas',    name: 'GAS STATION', icon: '⛽', color: 0x00ffcc, css: '#00ffcc', cx: 180,  cz: -120, svc: { x: 180,  z: -116, r: 7 },  info: 'Refuel your car' },
  garage: { id: 'garage', name: 'GARAGE',      icon: '🔧', color: 0x00d8ff, css: '#00d8ff', cx: -180, cz: -120, svc: { x: -180, z: -120, r: 8 },  info: 'Repair your car' },
  bank:   { id: 'bank',   name: 'BANK',        icon: '💰', color: 0xffcc00, css: '#ffcc00', cx: -180, cz: 180,  svc: { x: -180, z: 202,  r: 7 },  info: 'Rob it (story mission)' },
  club:   { id: 'club',   name: 'CLUB NEON',   icon: '🎵', color: 0xff00cc, css: '#ff44dd', cx: 120,  cz: 120,  svc: { x: 120,  z: 144,  r: 7 },  info: 'Hide from police, buy nitro' },
  tune:   { id: 'tune',   name: 'TUNE SHOP',   icon: '⚡', color: 0xff8833, css: '#ff9944', cx: 180,  cz: 180,  svc: { x: 180,  z: 199,  r: 7 },  info: 'Buy car upgrades' }
};

// ── materials / helpers ──
var _matCache = {};
function lam(color, opts) {
  var k = 'L' + color + (opts ? JSON.stringify(opts) : '');
  if (!_matCache[k]) { var o = opts || {}; o.color = color; _matCache[k] = new THREE.MeshLambertMaterial(o); }
  return _matCache[k];
}
function bas(color, opts) {
  var k = 'B' + color + (opts ? JSON.stringify(opts) : '');
  if (!_matCache[k]) { var o = opts || {}; o.color = color; _matCache[k] = new THREE.MeshBasicMaterial(o); }
  return _matCache[k];
}
function addBox(parent, w, h, d, x, y, z, mat) {
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); parent.add(m); return m;
}
function canvasTex(w, h, draw, repeat) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  var t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function addCol(cx, cz, hx, hz, type, ref) { var b = Core.box(cx, cz, hx, hz, type, ref); W.cols.push(b); return b; }

// ── textures ──
function texAsphalt() {
  return canvasTex(256, 256, function (x, w, h) {
    x.fillStyle = '#16161c'; x.fillRect(0, 0, w, h);
    for (var i = 0; i < 4500; i++) { var v = 16 + Math.floor(Math.random() * 16); x.fillStyle = 'rgb(' + v + ',' + v + ',' + (v + 4) + ')'; x.fillRect(Math.random() * w, Math.random() * h, Math.random() * 3 + 1, Math.random() * 2 + 1); }
  }, [60, 60]);
}
function texSidewalk() {
  return canvasTex(128, 128, function (x, w, h) {
    x.fillStyle = '#2b2b3a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#1b1b28'; x.lineWidth = 1.4;
    for (var i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
  }, [5, 5]);
}
function texGlow(r, g, b) {
  return canvasTex(128, 128, function (x, w, h) {
    var gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',0.9)'); gr.addColorStop(0.4, 'rgba(' + r + ',' + g + ',' + b + ',0.3)'); gr.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
  });
}
// Window tile: 16 wide x 24 tall world units, 4 x 6 windows.  Returns {map, emi}
function texBuilding(hue, rnd) {
  var cw = 128, ch = 192, cell = 32;
  var map = document.createElement('canvas'); map.width = cw; map.height = ch;
  var emi = document.createElement('canvas'); emi.width = cw; emi.height = ch;
  var m = map.getContext('2d'), e = emi.getContext('2d');
  m.fillStyle = 'hsl(' + hue + ',12%,17%)'; m.fillRect(0, 0, cw, ch);
  e.fillStyle = '#000'; e.fillRect(0, 0, cw, ch);
  for (var r = 0; r < 6; r++) for (var c = 0; c < 4; c++) {
    var x = c * cell + 6, y = r * cell + 7, ww = cell - 12, hh = cell - 14;
    var lit = rnd() > 0.38, warm = rnd() > 0.45;
    m.fillStyle = lit ? (warm ? '#6a5a30' : '#2f4a60') : '#0b0e16'; m.fillRect(x, y, ww, hh);
    m.fillStyle = 'rgba(255,255,255,0.06)'; m.fillRect(x, y, ww, 3);
    if (lit) { e.fillStyle = warm ? '#ffd860' : '#8fd0ff'; e.fillRect(x, y, ww, hh); }
  }
  var t1 = new THREE.CanvasTexture(map), t2 = new THREE.CanvasTexture(emi);
  t1.wrapS = t1.wrapT = t2.wrapS = t2.wrapT = THREE.RepeatWrapping;
  return { map: t1, emi: t2 };
}

// Text label sprite (always faces camera, ignores fog) — used for place names
function makeLabel(text, cssColor, w, h, sub) {
  var tex = canvasTex(512, 160, function (x, cw, ch) {
    x.fillStyle = 'rgba(0,0,0,0.72)'; x.strokeStyle = cssColor; x.lineWidth = 6;
    var r = 22; x.beginPath(); x.moveTo(r + 4, 4); x.arcTo(cw - 4, 4, cw - 4, ch - 4, r); x.arcTo(cw - 4, ch - 4, 4, ch - 4, r); x.arcTo(4, ch - 4, 4, 4, r); x.arcTo(4, 4, cw - 4, 4, r); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = cssColor; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold ' + (sub ? 70 : 84) + 'px Orbitron, Arial Black, sans-serif'; x.fillText(text, cw / 2, sub ? 62 : ch / 2 + 4);
    if (sub) { x.font = '32px Orbitron, Arial, sans-serif'; x.fillStyle = '#ffffff'; x.fillText(sub, cw / 2, 124); }
  });
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(w || 40, h || 12.5, 1);
  return sp;
}

// Merge a list of {w,h,d,x,y,z} boxes into ONE mesh with window UVs scaled to world size
function mergeBuildings(list, material) {
  var pos = [], nor = [], uv = [], idx = [], off = 0;
  list.forEach(function (b) {
    var g = new THREE.BoxGeometry(b.w, b.h, b.d);
    var u = g.attributes.uv, p = g.attributes.position, n = g.attributes.normal;
    for (var f = 0; f < 6; f++) {
      var su = 1, sv = b.h / 24;
      if (f < 2) su = b.d / 16; else if (f >= 4) su = b.w / 16;
      for (var v = 0; v < 4; v++) {
        var i = f * 4 + v;
        if (f === 2 || f === 3) u.setXY(i, 0.02, 0.02);
        else u.setXY(i, u.getX(i) * su + b.ou, u.getY(i) * sv);
      }
    }
    g.translate(b.x, b.y, b.z);
    for (var i2 = 0; i2 < p.count; i2++) { pos.push(p.getX(i2), p.getY(i2), p.getZ(i2)); nor.push(n.getX(i2), n.getY(i2), n.getZ(i2)); uv.push(u.getX(i2), u.getY(i2)); }
    var ix = g.index.array; for (var k = 0; k < ix.length; k++) idx.push(ix[k] + off);
    off += p.count;
  });
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return new THREE.Mesh(geo, material);
}

// ═══════════ BUILD ═══════════
function buildWorld() {
  var scene = W.scene;
  W.root = new THREE.Group(); scene.add(W.root);
  var root = W.root, rnd = mulberry(1337);          // seeded: every player sees the same city

  // lights (only 2 real lights → fast on phones)
  W.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3f55, 1.0); root.add(W.hemi);
  W.sun = new THREE.DirectionalLight(0xffffff, 0.9); W.sun.position.set(120, 250, 80); root.add(W.sun);

  buildSky(root);

  // ground
  var outer = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), bas(0x0a0c10));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.06; root.add(outer);
  var gnd = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshBasicMaterial({ map: texAsphalt() }));
  gnd.rotation.x = -Math.PI / 2; root.add(gnd);

  buildRoadMarks(root);

  // sidewalks (instanced) + buildings (merged per texture variant)
  var swTex = texSidewalk();
  var blocks = [];
  for (var bx = -5; bx <= 5; bx++) for (var bz = -5; bz <= 5; bz++) { if (!bx || !bz) continue; blocks.push({ x: bx * 60, z: bz * 60, special: null }); }
  var specialAt = {};
  Object.keys(PLACES).forEach(function (k) { var p = PLACES[k]; specialAt[p.cx + ',' + p.cz] = k; });
  blocks.forEach(function (b) { b.special = specialAt[b.x + ',' + b.z] || null; });
  W.blocks = blocks;

  var sw = new THREE.InstancedMesh(new THREE.BoxGeometry(44, 0.35, 44), new THREE.MeshBasicMaterial({ map: swTex }), blocks.length);
  var dummy = new THREE.Object3D();
  blocks.forEach(function (b, i) { dummy.position.set(b.x, 0.175, b.z); dummy.updateMatrix(); sw.setMatrixAt(i, dummy.matrix); });
  root.add(sw);

  var variants = [];
  for (var v = 0; v < 6; v++) {
    var t = texBuilding([210, 260, 30, 190, 330, 160][v], rnd);
    var mat = new THREE.MeshLambertMaterial({ map: t.map, emissive: 0xffffff, emissiveMap: t.emi, emissiveIntensity: 0 });
    W.nightMats.push(mat); variants.push({ mat: mat, list: [] });
  }
  var caps = [];
  blocks.forEach(function (b) {
    if (b.special) return;
    var h = 20 + rnd() * 78, v = Math.floor(rnd() * 6);
    variants[v].list.push({ w: 28, h: h, d: 28, x: b.x, y: h / 2 + 0.35, z: b.z, ou: Math.floor(rnd() * 4) / 4 });
    caps.push({ x: b.x, y: h + 0.75, z: b.z, h: h });
    addCol(b.x, b.z, 14, 14, 'building');
  });
  variants.forEach(function (vr) { if (vr.list.length) root.add(mergeBuildings(vr.list, vr.mat)); });
  var capGeoList = caps.map(function (c) { return { w: 28.6, h: 0.8, d: 28.6, x: c.x, y: c.y, z: c.z, ou: 0 }; });
  var capMesh = mergeBuildings(capGeoList, lam(0x0b0b14)); root.add(capMesh);
  // blinking roof beacons on the taller towers
  W.beacons = [];
  caps.forEach(function (c, i) { if (c.h > 60 && i % 2 === 0) { var bl = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2200 })); bl.position.set(c.x, c.y + 1.2, c.z); root.add(bl); W.beacons.push(bl); } });

  // places
  buildGas(root); buildGarage(root); buildBank(root); buildClub(root); buildTune(root);
  Object.keys(PLACES).forEach(function (k) { buildPlaceMarker(root, PLACES[k]); });

  buildStreetLights(root);
  buildPerimeter(root);

  // waypoint beam
  var beam = new THREE.Group();
  var bm = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 260, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  bm.position.y = 130; beam.add(bm);
  var br = new THREE.Mesh(new THREE.RingGeometry(5, 6.5, 32), new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
  br.rotation.x = -Math.PI / 2; br.position.y = 0.2; beam.add(br);
  beam.visible = false; root.add(beam); W.beam = beam; W.beamMat = bm.material; W.beamRing = br.material;

  W.ready = true;
}

// ── sky dome with vertex colours (no custom shader → safe on every phone) ──
function buildSky(root) {
  var geo = new THREE.SphereGeometry(640, 20, 12);
  var cols = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  W.skyGeo = geo;
  W.sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  W.sky.frustumCulled = false; W.sky.renderOrder = -10; root.add(W.sky);
  var sg = new THREE.BufferGeometry(), sv = [];
  for (var i = 0; i < 1500; i++) { var th = Math.random() * Math.PI * 2, ph = Math.random() * 1.25 + 0.05; sv.push(600 * Math.cos(th) * Math.sin(ph), 600 * Math.cos(ph), 600 * Math.sin(th) * Math.sin(ph)); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
  W.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
  W.stars.frustumCulled = false; root.add(W.stars);
  W.sunSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow(255, 240, 170), transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  W.sunSp.scale.set(120, 120, 1); root.add(W.sunSp);
  W.moonSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: texGlow(210, 225, 255), transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  W.moonSp.scale.set(70, 70, 1); root.add(W.moonSp);
  W.skyF = -1;
}

var _c1 = null, _c2 = null;
function updateSky(tod, camPos) {
  // tod: hours 0..24.  Sun elevation drives everything.
  var elev = Math.sin((tod - 6) / 24 * Math.PI * 2);
  var f = Core.clamp((elev + 0.12) / 0.4, 0, 1); f = f * f * (3 - 2 * f);          // 0 night … 1 day
  var warm = Math.max(0, 1 - Math.abs(elev) * 5) * 0.9;                            // sunrise/sunset glow
  W.dayF = f;
  var hor = [Core.lerp(0.09, 0.62, f) + warm * 0.38, Core.lerp(0.05, 0.78, f) + warm * 0.1, Core.lerp(0.18, 0.95, f) - warm * 0.2];
  var zen = [Core.lerp(0.01, 0.16, f), Core.lerp(0.01, 0.40, f), Core.lerp(0.07, 0.85, f)];
  if (Math.abs(f - W.skyF) > 0.004 || warm > 0) {
    var p = W.skyGeo.attributes.position, c = W.skyGeo.attributes.color;
    for (var i = 0; i < p.count; i++) {
      var t = Core.clamp(p.getY(i) / 420, 0, 1); t = Math.pow(t, 0.7);
      c.setXYZ(i, Core.lerp(hor[0], zen[0], t), Core.lerp(hor[1], zen[1], t), Core.lerp(hor[2], zen[2], t));
    }
    c.needsUpdate = true; W.skyF = f;
  }
  W.horizon = hor;
  if (W.scene.fog) W.scene.fog.color.setRGB(hor[0], hor[1], hor[2]);
  if (W.scene.background && W.scene.background.setRGB) W.scene.background.setRGB(hor[0], hor[1], hor[2]);
  W.hemi.intensity = Core.lerp(0.62, 1.05, f);
  W.hemi.color.setRGB(Core.lerp(0.45, 0.75, f), Core.lerp(0.5, 0.85, f), Core.lerp(0.9, 1.0, f));
  W.sun.intensity = Core.lerp(0.0, 0.85, f);
  W.sun.color.setRGB(1, Core.lerp(0.7, 0.97, f), Core.lerp(0.5, 0.92, f));
  W.stars.material.opacity = 1 - f;
  var a = (tod - 6) / 24 * Math.PI * 2;
  W.sunSp.position.set(Math.cos(a) * 420, Math.sin(a) * 420, -150).add(camPos);
  W.moonSp.position.set(-Math.cos(a) * 420, -Math.sin(a) * 420, -150).add(camPos);
  W.sunSp.material.opacity = Core.clamp(elev * 4 + 0.4, 0, 1); W.moonSp.material.opacity = Core.clamp(-elev * 4 + 0.3, 0, 1) * 0.8;
  W.sky.position.copy(camPos); W.stars.position.copy(camPos);
  // windows & neon glow at night
  var night = 1 - f;
  for (var m = 0; m < W.nightMats.length; m++) W.nightMats[m].emissiveIntensity = 0.15 + night * 1.15;
  if (W.glow) W.glow.material.opacity = night * 0.55;
  if (W.sun) W.sun.position.set(120, Math.max(40, 250 * elev + 60), 80);
}

// ── lane markings (instanced dashes) ──
function buildRoadMarks(root) {
  var L = Core.ROAD_LINES, dashes = [], i, j;
  function nearCross(v, along) { for (var k = 0; k < L.length; k++) if (Math.abs(v - L[k]) < (L[k] === 0 ? 40 : 12)) return true; return false; }
  for (i = 0; i < L.length; i++) {
    if (L[i] === 0) continue;                          // avenues get a double-yellow instead
    for (var t = -336; t <= 336; t += 10) {
      if (nearCross(t)) continue;
      dashes.push([L[i], t, 0]); dashes.push([t, L[i], 1]);
    }
  }
  var dg = new THREE.PlaneGeometry(0.7, 5); dg.rotateX(-Math.PI / 2);
  var dm = new THREE.InstancedMesh(dg, bas(0xdddddd), dashes.length), d = new THREE.Object3D();
  dashes.forEach(function (q, n) { d.position.set(q[0], 0.03, q[1]); d.rotation.set(0, q[2] ? Math.PI / 2 : 0, 0); d.updateMatrix(); dm.setMatrixAt(n, d.matrix); });
  root.add(dm);
  // avenues: double yellow
  [[0, 0], [0, 1]].forEach(function (q) {
    [-0.6, 0.6].forEach(function (o) {
      var g = new THREE.PlaneGeometry(q[1] ? 680 : 0.45, q[1] ? 0.45 : 680); g.rotateX(-Math.PI / 2);
      var m = new THREE.Mesh(g, bas(0xd8b820)); m.position.set(q[1] ? 0 : o, 0.035, q[1] ? o : 0); root.add(m);
    });
  });
  // crosswalk stripes at the 4 avenue mouths near the centre
  var cg = new THREE.PlaneGeometry(0.9, 6); cg.rotateX(-Math.PI / 2);
  var stripes = [];
  for (var s = -34; s <= 34; s += 3) { stripes.push([s, 44, 0]); stripes.push([s, -44, 0]); stripes.push([44, s, 1]); stripes.push([-44, s, 1]); }
  var cm = new THREE.InstancedMesh(cg, bas(0xeeeeee), stripes.length);
  stripes.forEach(function (q, n) { d.position.set(q[0], 0.034, q[1]); d.rotation.set(0, q[2] ? Math.PI / 2 : 0, 0); d.updateMatrix(); cm.setMatrixAt(n, d.matrix); });
  root.add(cm);
}

// ── street lights: instanced poles/arms/bulbs + ground glow pools (no real point lights) ──
function buildStreetLights(root) {
  var L = Core.ROAD_LINES, pts = [];
  for (var i = 0; i < L.length; i++) for (var j = 0; j < L.length; j++) {
    if ((i + j) % 2) continue;
    var hx = L[i] === 0 ? 39 : 9, hz = L[j] === 0 ? 39 : 9;
    [[1, 1], [-1, -1]].forEach(function (s) {
      var x = L[i] + s[0] * hx, z = L[j] + s[1] * hz;
      if (Math.abs(x) > 335 || Math.abs(z) > 335) return;
      if (Core.pointBlocked(x, z, W.cols, 1.2)) return;
      pts.push([x, z, s[0], s[1]]);
    });
  }
  var n = pts.length, d = new THREE.Object3D();
  var pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.2, 7, 6), lam(0x667788), n);
  var arm = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, 0.18, 0.18), lam(0x667788), n);
  var bulb = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 6, 6), bas(0xffee99), n);
  var gg = new THREE.CircleGeometry(11, 20); gg.rotateX(-Math.PI / 2);
  var glow = new THREE.InstancedMesh(gg, new THREE.MeshBasicMaterial({ map: texGlow(255, 220, 130), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), n);
  pts.forEach(function (p, k) {
    var dx = -p[2] * 1.4, dz = 0;                      // arm leans toward the road
    d.rotation.set(0, 0, 0);
    d.position.set(p[0], 3.5, p[1]); d.updateMatrix(); pole.setMatrixAt(k, d.matrix);
    d.position.set(p[0] + dx, 7, p[1]); d.updateMatrix(); arm.setMatrixAt(k, d.matrix);
    d.position.set(p[0] + dx * 1.8, 6.85, p[1]); d.updateMatrix(); bulb.setMatrixAt(k, d.matrix);
    d.position.set(p[0] + dx * 1.8, 0.06, p[1]); d.updateMatrix(); glow.setMatrixAt(k, d.matrix);
  });
  root.add(pole); root.add(arm); root.add(bulb); root.add(glow);
  W.glow = glow;
}

// ── perimeter wall ──
function buildPerimeter(root) {
  var H = Core.CITY_HALF, mat = lam(0x2a2a36), stripe = bas(0xff3355);
  [[0, -H, H + 4, 1.5], [0, H, H + 4, 1.5], [-H, 0, 1.5, H + 4], [H, 0, 1.5, H + 4]].forEach(function (q) {
    addBox(root, q[2] * 2, 6, q[3] * 2, q[0], 3, q[1], mat);
    addBox(root, q[2] * 2 + 0.2, 0.5, q[3] * 2 + 0.2, q[0], 5.2, q[1], stripe);
    addCol(q[0], q[1], q[2], q[3], 'wall');
  });
}

// ── place exterior helpers ──
function buildPlaceMarker(root, p) {
  // pulsing ground ring at the service point
  var ring = new THREE.Mesh(new THREE.RingGeometry(p.svc.r - 0.7, p.svc.r, 40), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(p.svc.x, 0.45, p.svc.z); root.add(ring);
  var fill = new THREE.Mesh(new THREE.CircleGeometry(p.svc.r - 0.7, 40), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
  fill.rotation.x = -Math.PI / 2; fill.position.set(p.svc.x, 0.44, p.svc.z); root.add(fill);
  W.animated.push({ kind: 'ring', mat: ring.material });
  // name label above the building
  var lab = makeLabel(p.name, p.css, 44, 13.75, p.info);
  lab.position.set(p.cx, (p.top || 20) + 9, p.cz); root.add(lab);
  // tall coloured pillar so the place can be spotted from far away
  var pil = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 70, 8, 1, true), new THREE.MeshBasicMaterial({ color: p.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  pil.position.set(p.svc.x, 35, p.svc.z); root.add(pil);
  p.label = lab;
}
function signBox(root, w, h, x, y, z, color, rotY) {
  var m = addBox(root, w, h, 0.5, x, y, z, bas(color)); if (rotY) m.rotation.y = rotY; return m;
}

function buildBank(root) {
  var p = PLACES.bank, cx = p.cx, cz = p.cz; p.top = 16;
  addBox(root, 28, 16, 28, cx, 8.35, cz, lam(0xb8b4a8));
  addBox(root, 29, 1.2, 29, cx, 16.5, cz, lam(0x6e6a60));
  addBox(root, 30, 0.6, 30, cx, 0.65, cz, lam(0x8a867a));
  for (var i = -2; i <= 2; i++) { var col = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.9, 14, 10), lam(0xe8e4d8)); col.position.set(cx + i * 5.2, 7.6, cz + 14.8); root.add(col); }
  addBox(root, 28, 1.4, 2.6, cx, 15.2, cz + 14.4, lam(0xe8e4d8));                         // pediment
  addBox(root, 7, 7, 0.4, cx, 3.9, cz + 14.05, bas(0x14110a));                              // door
  addBox(root, 8, 0.5, 0.6, cx, 7.5, cz + 14.1, bas(0xffcc00));
  signBox(root, 16, 2.6, cx, 13.8, cz + 15.9, 0xffcc00);
    addCol(cx, cz, 14, 14, 'building', 'bank');
}

function buildClub(root) {
  var p = PLACES.club, cx = p.cx, cz = p.cz; p.top = 15;
  addBox(root, 32, 14, 32, cx, 7.35, cz, lam(0x1c0830));
  addBox(root, 33, 0.8, 33, cx, 14.4, cz, lam(0x0a0314));
  var cols = [0xff0066, 0x00ffcc, 0xff9900, 0xcc00ff];
  W.clubNeon = [];
  for (var i = 0; i < 4; i++) { var st = addBox(root, 0.7, 11, 0.4, cx - 13.5 + i * 9, 6.5, cz + 16.2, bas(cols[i])); W.clubNeon.push(st); }
  var sg = addBox(root, 22, 3.6, 0.6, cx, 11.6, cz + 16.4, bas(0xff00cc)); W.clubSign = sg;
  addBox(root, 6, 7, 0.4, cx, 3.9, cz + 16.1, bas(0x0a0015));
  addBox(root, 7, 0.5, 0.6, cx, 7.5, cz + 16.2, bas(0xff44aa));
  [-4, 4].forEach(function (o) { var pst = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.6, 6), bas(0xffcc00)); pst.position.set(cx + o, 1.1, cz + 18.5); root.add(pst); });
  // roof searchlight beams
  W.clubBeams = [];
  for (var b = 0; b < 2; b++) {
    var bm = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 12, 1, true), new THREE.MeshBasicMaterial({ color: b ? 0x00ffcc : 0xff00cc, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    bm.geometry.translate(0, 30, 0); bm.position.set(cx + (b ? 8 : -8), 14.8, cz); root.add(bm); W.clubBeams.push(bm);
  }
  addCol(cx, cz, 16, 16, 'building', 'club');
}

function buildTune(root) {
  var p = PLACES.tune, cx = p.cx, cz = p.cz; p.top = 12;
  addBox(root, 24, 11, 22, cx, 5.85, cz, lam(0x2b2f3a));
  addBox(root, 25, 0.8, 23, cx, 11.4, cz, lam(0x14161c));
  addBox(root, 14, 7.4, 0.4, cx, 4.1, cz + 11.05, lam(0x6a7080));                           // roll-up door
  for (var i = 0; i < 7; i++) addBox(root, 14, 0.12, 0.45, cx, 1 + i * 1.0, cz + 11.1, lam(0x4a5060));
  addBox(root, 3, 5, 0.3, cx + 9, 3, cz + 11.1, bas(0x0a0a10));                              // person door
  signBox(root, 18, 2.4, cx, 13, cz + 11.6, 0xff8833);
  for (var t = 0; t < 4; t++) { var tr = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.38, 8, 14), lam(0x111111)); tr.rotation.x = Math.PI / 2; tr.position.set(cx - 15.5, 0.6 + t * 0.7, cz + 6); root.add(tr); }
  W.tuneSign = null;
  addCol(cx, cz, 12, 11, 'building', 'tune');
  addCol(cx - 15.5, cz + 6, 1.1, 1.1, 'prop');
}

function buildGas(root) {
  var p = PLACES.gas, cx = p.cx, cz = p.cz; p.top = 12;
  addBox(root, 20, 5, 8, cx, 2.85, cz - 15, lam(0xe8e8d8));                                  // kiosk
  addBox(root, 21, 0.6, 9, cx, 5.6, cz - 15, lam(0xcc2200));
  addBox(root, 14, 2.4, 0.2, cx, 3, cz - 10.9, bas(0x88ddff));                               // shop window
  signBox(root, 10, 2.2, cx, 7.4, cz - 15, 0xff4400);
  addCol(cx, cz - 15, 10, 4, 'building', 'gas');
  // canopy
  addBox(root, 26, 0.8, 16, cx, 7.4, cz + 4, lam(0xdde8d0));
  addBox(root, 26.2, 0.3, 16.2, cx, 7.0, cz + 4, bas(0x00ffcc));
  [[-12, -2], [12, -2], [-12, 10], [12, 10]].forEach(function (o) {
    var pl = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 7.2, 8), lam(0x99aaaa)); pl.position.set(cx + o[0], 3.6, cz + o[1]); root.add(pl);
    addCol(cx + o[0], cz + o[1], 0.5, 0.5, 'prop');
  });
  // pumps
  W.pumps = [];
  [-6.5, 6.5].forEach(function (ox) {
    addBox(root, 2.2, 0.45, 7, cx + ox, 0.55, cz + 4, lam(0x777777));                         // island
    var g = new THREE.Group(); g.position.set(cx + ox, 0, cz + 4);
    addBox(g, 1.5, 2.6, 1.0, 0, 1.75, 0, lam(0xee3311));
    addBox(g, 1.7, 0.5, 1.2, 0, 3.25, 0, lam(0xcc2200));
    addBox(g, 0.9, 0.7, 0.14, 0, 2.2, 0.56, bas(0x88ffcc));
    root.add(g);
    var col = addCol(cx + ox, cz + 4, 0.9, 0.7, 'pump');
    var pump = { group: g, x: cx + ox, z: cz + 4, alive: true, col: col }; col.ref = pump; W.pumps.push(pump);
  });
}

function buildGarage(root) {
  var p = PLACES.garage, cx = p.cx, cz = p.cz; p.top = 12;
  var wall = lam(0x3b4658);
  addBox(root, 26, 10, 1, cx, 5.4, cz - 9.5, wall);                                           // back wall
  addBox(root, 1, 10, 20, cx - 12.5, 5.4, cz, wall);                                          // sides
  addBox(root, 1, 10, 20, cx + 12.5, 5.4, cz, wall);
  addBox(root, 28, 1, 22, cx, 10.9, cz, lam(0x555e70));                                       // roof
  addBox(root, 26, 3, 0.8, cx, 9.2, cz + 10, lam(0x2b3342));                                  // front lintel
  addBox(root, 25, 0.12, 19, cx, 0.42, cz, lam(0x6a6f78));                                    // concrete floor
  for (var i = -1; i <= 1; i += 2) addBox(root, 0.9, 5, 0.9, cx + i * 6, 2.9, cz - 6.6, lam(0x888888)); // lift posts
  addBox(root, 13, 0.4, 3, cx, 1.1, cz - 6.6, lam(0xcc8800));                                   // lift arms
  signBox(root, 14, 2.4, cx, 12.4, cz + 10.9, 0x00d8ff);
  addBox(root, 3, 2.4, 2, cx - 9, 1.6, cz - 7, lam(0xcc2200));                                // tool chests
  addBox(root, 3, 2.4, 2, cx + 9, 1.6, cz - 7, lam(0x2266cc));
  addCol(cx, cz - 9.5, 13, 0.55, 'wall', 'garage');
  addCol(cx - 12.5, cz, 0.55, 10, 'wall', 'garage');
  addCol(cx + 12.5, cz, 0.55, 10, 'wall', 'garage');
  addCol(cx - 9, cz - 7, 1.6, 1.1, 'prop'); addCol(cx + 9, cz - 7, 1.6, 1.1, 'prop');
}
