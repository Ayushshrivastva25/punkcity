// ═══════════════════════════════════════════════
// ON FOOT — bank, club and tune shop interiors
// Standard third-person controller:
//   move = camera-relative (stick / WASD), hero turns toward the move direction,
//   camera orbits with drag / right stick, auto-follows when running forward,
//   and is always clamped INSIDE the room (spring arm).
// While inside, the outdoor world is hidden and frozen: no cops, no traffic,
// no collision damage — the parked car is untouchable.
// ═══════════════════════════════════════════════
var _intBg = null;

function enterPlace(k) {
  var I = W.int[k]; if (!I) return;
  G.mode = 'foot'; G.place = k; G.interact = null;
  var car = G.car; car.vx = car.vz = car.w = 0;
  if (!_intBg) _intBg = new THREE.Color(0x07050c);
  W.root.visible = false; I.group.visible = true;
  W.scene.fog = null; W.scene.background = _intBg;
  G.foot = { x: I.spawn.x, z: I.spawn.z, yaw: Math.PI, vx: 0, vz: 0, t: 0, punch: 0 };
  G.hero.visible = true; G.hero.position.set(G.foot.x, 0, G.foot.z); G.hero.rotation.y = Math.PI;
  G.camYaw = Math.PI; G.camPitch = 0.3; G.lookIdle = 9; G.fT = 1; G.holdProg = 0;
  if (!I.camCols) I.camCols = I.cols.filter(function (c) { return c.type === 'desk' || c.type === 'prop'; });
  document.body.classList.add('foot');
  look.id = null; look.dx = look.dy = 0;
  if (G.stars > 0) setSirenVolume(0.12);
  var cam = W.camera; if (cam.fov !== 62) { cam.fov = 62; cam.updateProjectionMatrix(); }
  if (k === 'club') { triggerDrama('CLUB NEON', 'COPS CAN\'T FIND YOU HERE', '', '#ff00ff'); playClubEntry(); setTimeout(startClubMusic, 400); G.clubDecay = 0; }
  else if (k === 'bank') { if (!G.bank.done) triggerDrama('BANK', 'THE GUARD BLOCKS THE VAULT', '', '#ffcc00'); }
  else if (k === 'tune') { I.refreshLabels(); triggerDrama('TUNE SHOP', 'WALK TO A PEDESTAL TO BUY', '', '#ff9944'); }
  mpSetInside && mpSetInside(true);
}

function leaveInteriorState() {
  Object.keys(W.int).forEach(function (id) { W.int[id].group.visible = false; });
  W.root.visible = true;
  W.scene.fog = W.fog; W.scene.background = W.bgColor;
  if (G.hero) G.hero.visible = false;
  stopClubMusic();
  G.place = null; G.mode = 'car';
  document.body.classList.remove('foot');
}

function exitPlace() {
  var k = G.place; if (!k) return;
  var I = W.int[k], b = G.bank;
  if (k === 'bank') {
    if (b.stage >= 3 && b.loot) { b.done = true; I.alarm = false; mEvent('bankDone'); toast('YOU GOT AWAY WITH THE CASH — RUN!', 2600, '#ff4433'); }
    else if (!b.done) { I.reset(); G.bank = { stage: 0, vaultT: 0, alarmT: 0, loot: false, done: false, cd: 0 }; }
  }
  leaveInteriorState();
  G.grace = 2.5; G.interact = null; G.copSpawnCD = 0.5;
  if (G.stars > 0) setSirenVolume(1);
  setCarCameraSnap();
  clock.getDelta();
  mpSetInside && mpSetInside(false);
}

// ───────── per-frame ─────────
function updateFoot(dt) {
  var I = W.int[G.place], f = G.foot, cam = W.camera;
  f.t += dt;
  // --- input (camera-relative) ---
  var ix = ((keys['d'] || keys['arrowright']) ? 1 : 0) - ((keys['a'] || keys['arrowleft']) ? 1 : 0);
  var iz = ((keys['w'] || keys['arrowup']) ? 1 : 0) - ((keys['s'] || keys['arrowdown']) ? 1 : 0);
  if (pad.id !== null) {
    var dz0 = 0.12, px = Math.abs(pad.x) < dz0 ? 0 : pad.x, py = Math.abs(pad.y) < dz0 ? 0 : pad.y;
    if (px || py) { ix = px; iz = -py; }
  }
  var sprint = keys['shift'] || IN.spr;
  if (look.dx || look.dy) {
    G.camYaw -= look.dx * 0.0065; G.camPitch = Core.clamp(G.camPitch + look.dy * 0.0045, 0.05, 1.15);
    look.dx = look.dy = 0; G.lookIdle = 0;
  } else G.lookIdle += dt;
  var len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; len = 1; }
  if (iz > 0.15 && G.lookIdle > 1.0) G.camYaw += Core.angDiff(G.camYaw, f.yaw) * (1 - Math.exp(-1.8 * dt)) * iz;   // auto-follow

  var fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw), rx = -fz, rz = fx;
  var dx = fx * iz + rx * ix, dzv = fz * iz + rz * ix;
  var spd = sprint ? 8.2 : 5.2;
  f.vx = Core.damp(f.vx, dx * spd, 13, dt); f.vz = Core.damp(f.vz, dzv * spd, 13, dt);
  var np = Core.moveCircle(f.x, f.z, 0.5, f.vx * dt, f.vz * dt, I.cols);
  f.x = np.x; f.z = np.z;
  var sp = Math.hypot(f.vx, f.vz);
  if (sp > 0.6) f.yaw += Core.angDiff(f.yaw, Math.atan2(f.vx, f.vz)) * (1 - Math.exp(-15 * dt));

  var h = G.hero; h.position.set(f.x, 0, f.z); h.rotation.y = f.yaw;
  animateWalk(h, f.t * (sprint ? 13 : 9), sp / 5.2);
  if (f.punch > 0) { f.punch -= dt; h.userData.rArm.rotation.x = -1.6 * Math.sin(Math.min(1, (0.3 - f.punch) / 0.3) * Math.PI); }

  // --- place logic ---
  I.update(dt, G.t);
  if (G.place === 'club') clubTick(dt);
  if (G.place === 'bank') bankTick(I, dt);
  footInteract(I, f, dt);

  // --- camera: orbit + spring arm kept inside the room ---
  var dist = 5.0, pitch = G.camPitch, py0 = 1.6;
  var hd = Math.cos(pitch) * dist, cx = f.x - fx * hd, cz = f.z - fz * hd, cy = py0 + Math.sin(pitch) * dist;
  var t = Math.min(Core.clampInRoom(f.x, f.z, cx, cz, I.room, 0.9), Core.armT(f.x, f.z, cx, cz, I.camCols, 0.7));
  t = Math.max(0.28, t);
  G.fT = Core.damp(G.fT === undefined ? 1 : G.fT, t, t < G.fT ? 40 : 6, dt);
  var tt = Math.min(G.fT, t < 1 ? t : 1);
  cam.position.set(f.x + (cx - f.x) * tt, Math.min(I.h - 0.5, Math.max(1.0, py0 + (cy - py0) * tt)), f.z + (cz - f.z) * tt);
  cam.lookAt(f.x, 1.45, f.z);
}

function footInteract(I, f, dt) {
  var it = null, k = G.place; G.holdProg = 0;
  if (k === 'bank') it = bankInteract(I, f, dt);
  else if (k === 'club') it = clubInteract(I, f);
  else if (k === 'tune') it = tuneInteract(I, f);
  if (!it && Math.hypot(f.x - I.door.x, f.z - I.door.z) < I.door.r) it = { text: 'LEAVE ' + PLACES[k].name, short: 'EXIT', act: exitPlace };
  G.interact = it;
}

// ───────── BANK HEIST ─────────
function bankTick(I, dt) {
  var b = G.bank;
  b.cd = Math.max(0, b.cd - dt);
  var g = I.guard.userData; if (g.flinch > 0) { g.flinch -= dt; I.guard.rotation.x = g.down ? -Math.PI / 2 : -0.35 * (g.flinch / 0.25); if (g.flinch <= 0 && !g.down) I.guard.rotation.x = 0; }
  if (b.stage >= 2 && !b.done) {
    b.alarmT -= dt;
    if (b.alarmT <= 0) {
      toast('THE POLICE STORM THE BANK!', 3000, '#ff4433');
      if (b.loot) G.money = Math.max(0, G.money - 500);
      I.reset(); G.bank = { stage: 0, vaultT: 0, alarmT: 0, loot: false, done: false, cd: 0 };
      setStars(5); G.stars = 5; startSiren();
      exitPlace();
    }
  }
}
function bankInteract(I, f, dt) {
  var b = G.bank; if (b.done) return null;
  if (b.stage === 0) {
    if (Math.hypot(f.x - I.guardPos.x, f.z - I.guardPos.z) < 2.5) return { text: 'PUNCH THE GUARD (' + (3 - I.guard.userData.hp) + '/3)', short: 'PUNCH', act: bankPunch };
  } else if (b.stage === 1) {
    if (Math.hypot(f.x - I.vaultPos.x, f.z - I.vaultPos.z) < 3.4) {
      var held = keys['e'] || IN.actHeld;
      if (held) b.vaultT += dt; else b.vaultT = Math.max(0, b.vaultT - dt * 1.5);
      G.holdProg = Math.min(1, b.vaultT / 1.8);
      if (b.vaultT >= 1.8) bankOpenVault(I);
      return { text: 'CRACK THE VAULT', hold: true, short: 'HOLD', act: function () {} };
    }
    b.vaultT = 0;
  } else if (b.stage === 2) {
    if (Math.hypot(f.x - I.cashPos.x, f.z - I.cashPos.z) < 2.8) return { text: 'GRAB THE CASH  +$500', short: 'GRAB', act: bankGrab };
  }
  return null;
}
function bankPunch() {
  var b = G.bank, I = W.int.bank; if (b.cd > 0 || b.stage !== 0) return;
  b.cd = 0.42; G.foot.punch = 0.3; playPunch();
  var gd = I.guard.userData; gd.hp--; gd.flinch = 0.25;
  if (gd.hp <= 0) {
    gd.down = true; I.guard.rotation.x = -Math.PI / 2; I.guard.position.y = 0.35; gd.flinch = 0.25;
    b.stage = 1; toast('GUARD DOWN!  Crack the vault at the back wall.', 3200, '#00ff88');
  }
}
function bankOpenVault(I) {
  var b = G.bank; b.stage = 2; b.alarmT = 30; b.vaultT = 0;
  I.vaultDoor.rotation.y = -1.45; I.vaultDoor.position.x = 3.6;
  I.cash.visible = true; I.alarm = true; playAlarm();
  toast('VAULT OPEN — ALARM! Grab the cash!', 2800, '#ff4433');
}
function bankGrab() {
  var b = G.bank, I = W.int.bank; if (b.stage !== 2) return;
  b.stage = 3; b.loot = true; I.cash.visible = false;
  G.money += 500; G.score += 300; addHeat(6); playCoin(); setTimeout(playAlarm, 300);
  triggerDrama('CASH GRABBED!', 'GET OUT — POLICE ARE COMING', '+$500', '#00ff44');
}

// ───────── CLUB ─────────
function clubTick(dt) {
  G.clubSecs += dt;
  if (G.stars > 0) {
    G.clubDecay += dt;
    if (G.clubDecay >= 6) {
      G.clubDecay = 0; setStars(G.stars - 1);
      toast(G.stars ? 'HEAT DROPPING… ' + G.stars + '★' : 'THE POLICE LOST YOU!', 2000, '#0ffcd4');
    }
  } else G.clubDecay = 0;
}
function clubInteract(I, f) {
  var z = I.barZone;
  if (Math.abs(f.x - z.x) < z.hx && Math.abs(f.z - z.z) < z.hz) {
    return { text: 'ENERGY DRINK — $25 (REFILLS NITRO)', short: 'DRINK', act: function () {
      if (G.money < 25) { toast('Not enough cash', 1500, '#ff4433'); return; }
      if (G.car.nitro > 95) { toast('Nitro tank already full', 1400, '#ff9900'); return; }
      G.money -= 25; G.car.nitro = 100; playCoin(); toast('NITRO REFILLED!', 1600, '#ff9900');
    } };
  }
  return null;
}

// ───────── TUNE SHOP ─────────
function tuneInteract(I, f) {
  for (var i = 0; i < I.pedestals.length; i++) {
    var p = I.pedestals[i];
    if (Math.hypot(f.x - p.x, f.z - p.z) < 3.0) {
      var u = p.up;
      if (G.upg[u.id]) return { text: u.name + ' — OWNED', act: null };
      if (u.req && !G.upg[u.req]) return { text: u.name + ' — LOCKED (buy ' + findUpgrade(u.req).name + ' first)', act: null };
      return { text: u.name + ' — $' + u.price + '  ·  ' + u.desc, short: 'BUY', act: (function (uu) { return function () { buyUpgrade(uu); }; })(u) };
    }
  }
  return null;
}
function buyUpgrade(u) {
  if (G.money < u.price) { toast('Need $' + u.price, 1600, '#ff4433'); return; }
  G.money -= u.price; G.upg[u.id] = true; applyUpgrades();
  W.int.tune.refreshLabels(); playCoin(); cameraShake(0.3, 0.2);
  triggerDrama(u.name + ' INSTALLED', u.desc.toUpperCase(), '-$' + u.price, '#ff9944');
  mEvent('upgrade');
}
