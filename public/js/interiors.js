// ═══════════════════════════════════════════════
// INTERIORS — real enclosed rooms, separate from the city.
// The city (W.root) is hidden while inside, so cops / traffic / the parked car
// cannot touch the player, and the camera is clamped to the room.
// Room coordinates are centred on (0,0); the door is on the +z wall.
// ═══════════════════════════════════════════════
W.int = {};

function makeRoom(id, w, d, h, o) {
  var g = new THREE.Group(); g.visible = false;
  var hx = w / 2, hz = d / 2, cols = [], lights = [];
  var room = { minx: -hx, maxx: hx, minz: -hz, maxz: hz };
  function col(cx, cz, sx, sz, type, ref) { var b = Core.box(cx, cz, sx, sz, type || 'prop', ref); cols.push(b); return b; }
  var wallM = lam(o.wall), floorM = o.floorMat || lam(o.floor);
  var fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorM); fl.rotation.x = -Math.PI / 2; g.add(fl);
  var ce = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lam(o.ceil || 0x15151c)); ce.rotation.x = Math.PI / 2; ce.position.y = h; g.add(ce);
  var DW = 7;                                                         // doorway width
  addBox(g, w + 2, h, 1, 0, h / 2, -hz - 0.5, wallM);
  addBox(g, 1, h, d + 2, -hx - 0.5, h / 2, 0, wallM);
  addBox(g, 1, h, d + 2, hx + 0.5, h / 2, 0, wallM);
  var segW = (w + 2 - DW) / 2;
  addBox(g, segW, h, 1, -(DW / 2 + segW / 2), h / 2, hz + 0.5, wallM);
  addBox(g, segW, h, 1, (DW / 2 + segW / 2), h / 2, hz + 0.5, wallM);
  addBox(g, DW, h - 5.2, 1, 0, 5.2 + (h - 5.2) / 2, hz + 0.5, wallM);
  var outside = new THREE.Mesh(new THREE.PlaneGeometry(DW, 5.2), new THREE.MeshBasicMaterial({ color: 0xc8dcff }));
  outside.position.set(0, 2.6, hz + 1.2); outside.rotation.y = Math.PI; g.add(outside);
  addBox(g, DW + 0.4, 0.3, 0.4, 0, 5.3, hz + 0.1, bas(o.accent || 0xffffff));        // door header glow
  // wall colliders (player can never leave the box)
  col(0, -hz - 1, hx + 3, 1, 'wall'); col(-hx - 1, 0, 1, hz + 3, 'wall'); col(hx + 1, 0, 1, hz + 3, 'wall'); col(0, hz + 1, hx + 3, 1, 'wall');
  var hemi = new THREE.HemisphereLight(o.hemiSky || 0xffffff, o.hemiGround || 0x555566, o.hemiI !== undefined ? o.hemiI : 0.9); g.add(hemi);
  W.scene.add(g);
  var r = { id: id, group: g, room: room, cols: cols, h: h, col: col, lights: lights, hx: hx, hz: hz,
            door: { x: 0, z: hz - 2.2, r: 3.4 }, spawn: { x: 0, z: hz - 3.4 }, npcs: [], update: function () {} };
  W.int[id] = r;
  return r;
}
function addLight(r, color, intensity, dist, x, y, z) {
  var l = new THREE.PointLight(color, intensity, dist); l.position.set(x, y, z); r.group.add(l); r.lights.push(l); return l;
}
function addNpc(r, mesh, x, z, rot, radius) {
  mesh.position.set(x, 0, z); mesh.rotation.y = rot || 0; mesh.userData.baseY = 0; mesh.userData.ph = Math.random() * 6; r.group.add(mesh); r.npcs.push(mesh);
  if (radius) r.col(x, z, radius, radius, 'npc');
  return mesh;
}
function idleNpcs(r, t) { for (var i = 0; i < r.npcs.length; i++) { var n = r.npcs[i]; if (n.userData.dancer || n.userData.down) continue; n.position.y = Math.sin(t * 1.6 + n.userData.ph) * 0.02; } }

// ═══════════ BANK ═══════════
function buildBankInterior() {
  var r = makeRoom('bank', 26, 26, 9, { wall: 0xcfc8b8, floor: 0x8c8a80, accent: 0xffcc00, hemiI: 1.0, ceil: 0xe8e2d4 });
  // marble checker floor
  var ck = canvasTex(64, 64, function (x, w, h) { x.fillStyle = '#d8d4c8'; x.fillRect(0, 0, w, h); x.fillStyle = '#5a5a58'; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32); }, [13, 13]);
  r.group.children[0].material = new THREE.MeshLambertMaterial({ map: ck });
  addLight(r, 0xfff0cc, 1.0, 40, 0, 7.5, 0); addLight(r, 0xfff0cc, 0.6, 30, 0, 7.5, -9);
  // teller counters (leave a 6-wide corridor to the vault)
  [-1, 1].forEach(function (s) {
    addBox(r.group, 9, 1.3, 2.4, s * 7.5, 0.65, -5, lam(0x5a3a1a)); addBox(r.group, 9.2, 0.14, 2.6, s * 7.5, 1.35, -5, lam(0x2a2a2e));
    addBox(r.group, 9, 1.6, 0.12, s * 7.5, 2.2, -5.9, new THREE.MeshLambertMaterial({ color: 0x88aacc, transparent: true, opacity: 0.35 }));
    r.col(s * 7.5, -5, 4.6, 1.3, 'desk');
    addNpc(r, buildFemale(0x224466), s * 7.5, -7.4, 0);
  });
  // vault door
  var vd = new THREE.Group(); vd.position.set(0, 2.9, -12.55);
  var disc = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.7, 24), lam(0x8c9098)); disc.rotation.x = Math.PI / 2; vd.add(disc);
  var ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.25, 8, 28), lam(0x5a5e66)); vd.add(ring);
  var wheel = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.12, 6, 14), lam(0xddcc88)); wheel.position.z = 0.5; vd.add(wheel);
  for (var i = 0; i < 4; i++) { var sp = addBox(vd, 1.8, 0.12, 0.12, 0, 0, 0.5, lam(0xddcc88)); sp.rotation.z = i * Math.PI / 4; }
  r.group.add(vd); r.vaultDoor = vd; r.vaultPos = { x: 0, z: -10.2 };
  addBox(r.group, 7.5, 6.8, 0.4, 0, 3.4, -12.95, lam(0x2a2c32));              // vault frame behind the door
  // cash (appears when the vault is open)
  var cash = new THREE.Group();
  for (var c = 0; c < 6; c++) addBox(cash, 1.1, 0.5, 0.7, (c % 3 - 1) * 1.3, 0.25 + Math.floor(c / 3) * 0.5, 0, bas(0x22dd66));
  cash.position.set(0, 0, -11.3); cash.visible = false; r.group.add(cash); r.cash = cash; r.cashPos = { x: 0, z: -11.3 };
  // guard + customers + decor
  r.guard = addNpc(r, buildMale(0x1c2a66), 0, -2.8, 0); r.guard.userData.hp = 3; r.guardPos = { x: 0, z: -2.8 };
  addNpc(r, buildFemale(), -6, 5, 1.2, 0.5); addNpc(r, buildMale(), 5.5, 7, -2, 0.5);
  [[-11.5, 11.5], [11.5, 11.5], [-11.5, -11.5], [11.5, -11.5]].forEach(function (p) {
    var pot = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.45, 0.9, 8), lam(0x6a4a2a)); pot.position.set(p[0], 0.45, p[1]); r.group.add(pot);
    var leaf = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), lam(0x2a8a3a)); leaf.position.set(p[0], 1.5, p[1]); r.group.add(leaf);
    r.col(p[0], p[1], 0.7, 0.7, 'prop');
  });
  [-3, 3].forEach(function (x) { for (var k = 0; k < 3; k++) { var po = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1, 6), lam(0xddbb44)); po.position.set(x, 0.5, 5 + k * 1.8); r.group.add(po); } });
  // alarm
  var al = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), new THREE.MeshBasicMaterial({ color: 0x550000 })); al.position.set(0, 8.2, 0); r.group.add(al);
  r.alarmMesh = al; r.alarmLight = addLight(r, 0xff0000, 0, 40, 0, 7, 0);
  r.alarm = false;
  r.update = function (dt, t) {
    idleNpcs(r, t);
    if (r.alarm) { var on = Math.floor(t * 4) % 2 === 0; r.alarmMesh.material.color.setHex(on ? 0xff2222 : 0x440000); r.alarmLight.intensity = on ? 1.6 : 0.1; }
    else { r.alarmMesh.material.color.setHex(0x550000); r.alarmLight.intensity = 0; }
  };
  r.reset = function () {
    r.guard.rotation.x = 0; r.guard.position.set(0, 0, -2.8); r.guard.userData.hp = 3; r.guard.userData.down = false;
    r.vaultDoor.rotation.y = 0; r.vaultDoor.position.x = 0; r.cash.visible = false; r.alarm = false;
  };
}

// ═══════════ CLUB NEON ═══════════
function buildClubInterior() {
  var r = makeRoom('club', 32, 32, 10, { wall: 0x1a0a2c, floor: 0x0c0614, accent: 0xff00cc, hemiI: 0.55, hemiSky: 0xaa66ff, hemiGround: 0x220033, ceil: 0x08040f });
  r.tiles = [];
  var tileMats = [0xff0066, 0x00ffcc, 0xff9900, 0x8800ff].map(function (c) { return new THREE.MeshBasicMaterial({ color: c }); });
  var tg = new THREE.PlaneGeometry(1.9, 1.9);
  for (var i = 0; i < 8; i++) for (var j = 0; j < 8; j++) {
    var tl = new THREE.Mesh(tg, tileMats[(i + j) % 4]); tl.rotation.x = -Math.PI / 2; tl.position.set(-7 + i * 2, 0.04, -7 + j * 2 - 2); r.group.add(tl);
  }
  r.tileMats = tileMats;
  r.lights2 = [addLight(r, 0xff0066, 1.6, 34, -8, 7, -6), addLight(r, 0x00ccff, 1.6, 34, 8, 7, -6), addLight(r, 0xcc00ff, 1.6, 34, 0, 7, 8)];
  // bar (left wall)
  addBox(r.group, 2.4, 1.4, 18, -12.6, 0.7, -3, lam(0x331100)); addBox(r.group, 2.6, 0.15, 18.2, -12.6, 1.45, -3, bas(0xff00cc));
  r.col(-12.6, -3, 1.3, 9.1, 'desk');
  for (var s = 0; s < 6; s++) { var st = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.0, 8), lam(0xcc1166)); st.position.set(-10.2, 0.5, -9 + s * 3); r.group.add(st); }
  for (var b = 0; b < 3; b++) addBox(r.group, 0.4, 0.9, 0.4, -14.5, 2.4 + 0.0, -9 + b * 6, lam(0x66aaff));
  addBox(r.group, 0.3, 4, 18, -15.6, 3, -3, lam(0x2a1040));
  addNpc(r, buildMale(0xcc0066), -14.4, -3, Math.PI / 2);
  r.barZone = { x: -10.2, z: -3, hx: 2.6, hz: 9.5 };
  // DJ booth
  addBox(r.group, 10, 1.6, 2.6, 0, 0.8, -13.6, lam(0x14101c)); addBox(r.group, 10.2, 0.14, 2.8, 0, 1.65, -13.6, bas(0x00ffcc));
  r.col(0, -13.6, 5.1, 1.4, 'desk');
  addNpc(r, buildMale(0x5500aa), 0, -15.2, 0);
  [-9, 9].forEach(function (x) { addBox(r.group, 2.4, 4.4, 2.4, x, 2.2, -14.6, lam(0x111118)); addBox(r.group, 1.4, 1.4, 0.1, x, 1.4, -13.35, bas(0x220033)); r.col(x, -14.6, 1.3, 1.3, 'prop'); });
  // sofas (right wall)
  [-8, 6].forEach(function (z) { addBox(r.group, 2.4, 1.0, 6, 13.6, 0.5, z, lam(0x7a1050)); addBox(r.group, 0.7, 2.0, 6, 14.6, 1.0, z, lam(0x7a1050)); r.col(13.8, z, 1.5, 3.1, 'prop'); });
  // dancers
  r.dancers = [];
  for (var d = 0; d < 8; d++) {
    var a = d * Math.PI / 4, dx = Math.cos(a) * 4.6, dz = Math.sin(a) * 4.6 - 2;
    var f = buildFemale(); f.position.set(dx, 0, dz); f.userData.dancer = true; f.userData.ph = Math.random() * 6; r.group.add(f); r.dancers.push(f);
    var m = buildMale(); m.position.set(dx + 0.8, 0, dz + 0.3); m.userData.dancer = true; m.userData.ph = Math.random() * 6 + 1; r.group.add(m); r.dancers.push(m);
    r.col(dx + 0.4, dz + 0.1, 1.0, 0.7, 'npc');
  }
  // disco ball + neon ring
  var ball = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xcfd8ff })); ball.position.set(0, 8.3, -2); r.group.add(ball); r.ball = ball;
  var ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.12, 6, 40), new THREE.MeshBasicMaterial({ color: 0xff00cc })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 9.6, -2); r.group.add(ring);
  var logo = makeLabel('CLUB NEON', '#ff44dd', 16, 5); logo.position.set(0, 6.5, -15.3); r.group.add(logo);
  r.t = 0;
  r.update = function (dt, t) {
    idleNpcs(r, t);
    r.ball.rotation.y += dt * 1.2;
    for (var k = 0; k < r.tileMats.length; k++) r.tileMats[k].color.setHSL((t * 0.25 + k * 0.25) % 1, 1, 0.5);
    for (var q = 0; q < r.lights2.length; q++) r.lights2[q].intensity = 1.0 + Math.sin(t * 3.5 + q * 2) * 0.9;
    for (var i2 = 0; i2 < r.dancers.length; i2++) {
      var dn = r.dancers[i2], ph = t * 3 + dn.userData.ph;
      dn.position.y = Math.abs(Math.sin(ph)) * 0.2; dn.rotation.y = Math.sin(ph * 0.4) * 0.8;
      var u = dn.userData; u.lLeg.rotation.x = Math.sin(ph) * 0.4; u.rLeg.rotation.x = -Math.sin(ph) * 0.4; u.lArm.rotation.x = -2.4 + Math.sin(ph + 1) * 0.5; u.rArm.rotation.x = -2.4 - Math.sin(ph + 1) * 0.5;
    }
  };
}

// ═══════════ TUNE SHOP ═══════════
function buildTuneInterior() {
  var r = makeRoom('tune', 24, 22, 8, { wall: 0x2b2f3a, floor: 0x3a3d46, accent: 0xff8833, hemiI: 1.0, ceil: 0x1a1c22 });
  addLight(r, 0xffffff, 1.0, 36, 0, 6.5, 0); addLight(r, 0xff8833, 1.0, 26, 0, 5, -8);
  // counter + dealer
  addBox(r.group, 8, 1.3, 2, 0, 0.65, -8.2, lam(0x20222a)); addBox(r.group, 8.2, 0.14, 2.2, 0, 1.35, -8.2, bas(0xff8833)); r.col(0, -8.2, 4.1, 1.1, 'desk');
  addNpc(r, buildMale(0xcc5500), 0, -9.8, 0);
  // wall neon + posters
  addBox(r.group, 20, 0.2, 0.2, 0, 6.2, -10.8, bas(0xff8833)); addBox(r.group, 0.2, 0.2, 20, -11.8, 6.2, 0, bas(0x00d8ff)); addBox(r.group, 0.2, 0.2, 20, 11.8, 6.2, 0, bas(0x00d8ff));
  // tyre stacks
  [[-10, 8], [10, 8], [-10, -3], [10, -3]].forEach(function (p) { for (var t = 0; t < 4; t++) { var tr = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.38, 8, 14), lam(0x111111)); tr.rotation.x = Math.PI / 2; tr.position.set(p[0], 0.4 + t * 0.7, p[1]); r.group.add(tr); } r.col(p[0], p[1], 1.4, 1.4, 'prop'); });
  // upgrade pedestals
  r.pedestals = [];
  var xs = [-7.5, -2.5, 2.5, 7.5];
  UPGRADES.forEach(function (u, i) {
    var x = xs[i], z = -2.5;
    var base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.9, 12), lam(0x20222a)); base.position.set(x, 0.45, z); r.group.add(base);
    var rimR = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.07, 6, 20), bas(0xff8833)); rimR.rotation.x = Math.PI / 2; rimR.position.set(x, 0.92, z); r.group.add(rimR);
    var item = new THREE.Group(); item.position.set(x, 2.2, z);
    if (u.id === 'armor') { addBox(item, 1.3, 1.3, 0.2, 0, 0, 0, bas(0x99aabb)); addBox(item, 0.8, 0.8, 0.25, 0, 0, 0, bas(0x445566)); }
    else if (u.id === 'topspeed') { var tb = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.25, 8, 14), bas(0xff4422)); item.add(tb); addBox(item, 0.3, 0.3, 1.4, 0, 0, 0, bas(0xffaa33)); }
    else { var tank = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, u.id === 'nitro3' ? 1.9 : 1.4, 10), bas(u.id === 'nitro3' ? 0xff5500 : 0x33aaff)); item.add(tank); addBox(item, 0.3, 0.3, 0.3, 0, u.id === 'nitro3' ? 1.1 : 0.85, 0, bas(0xdddddd)); }
    r.group.add(item);
    r.col(x, z, 1.3, 1.3, 'prop');
    r.pedestals.push({ x: x, z: z, item: item, up: u, label: null });
  });
  r.refreshLabels = function () {
    r.pedestals.forEach(function (p) {
      if (p.label) { r.group.remove(p.label); p.label.material.map.dispose(); p.label.material.dispose(); }
      var owned = G.upg[p.up.id], locked = p.up.req && !G.upg[p.up.req];
      var sub = owned ? 'OWNED' : locked ? 'NEEDS ' + findUpgrade(p.up.req).name : '$' + p.up.price;
      p.label = makeLabel(p.up.name, owned ? '#7dff9a' : locked ? '#888888' : '#ff9944', 6.4, 2.0, sub);
      p.label.position.set(p.x, 4.4, p.z); r.group.add(p.label);
    });
  };
  r.update = function (dt, t) { idleNpcs(r, t); r.pedestals.forEach(function (p, i) { p.item.rotation.y = t * 1.4 + i; p.item.position.y = 2.2 + Math.sin(t * 2 + i) * 0.12; }); };
}

function buildInteriors() { buildBankInterior(); buildClubInterior(); buildTuneInterior(); }
