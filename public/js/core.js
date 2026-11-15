// ═══════════════════════════════════════════════════════════════
// PUNK CITY — CORE (pure logic, no THREE / DOM)
// Collision (OBB vs AABB, OBB vs OBB), car physics, city road graph,
// camera arm, on-foot movement.  Unit-tested in node (see /test).
// ═══════════════════════════════════════════════════════════════
(function (root) {
'use strict';
var Core = {};

// ── tiny math helpers ───────────────────────────
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function damp(cur, target, rate, dt) { return cur + (target - cur) * (1 - Math.exp(-rate * dt)); }
function angDiff(from, to) {                       // shortest signed angle from -> to
  var d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
Core.clamp = clamp; Core.lerp = lerp; Core.damp = damp; Core.angDiff = angDiff;

// HUD shows km/h = world units/s * KMH.  Every "30 km/h" rule uses this.
Core.KMH = 2;
Core.SAFE_KMH = 30;                  // impacts slower than this do NO damage

// ── CITY LAYOUT ─────────────────────────────────
// Blocks sit at multiples of 60 (±60 … ±300), 44 wide with sidewalk.
// Street centre-lines (between blocks) + the two central avenues:
Core.ROAD_LINES = [-330, -270, -210, -150, -90, 0, 90, 150, 210, 270, 330];
Core.CITY_HALF = 342;                // perimeter wall centre-line

// ── COLLIDERS ───────────────────────────────────
// Axis-aligned boxes in the XZ plane: {minx,maxx,minz,maxz,type,ref}
Core.box = function (cx, cz, hx, hz, type, ref) {
  return { minx: cx - hx, maxx: cx + hx, minz: cz - hz, maxz: cz + hz, type: type || 'wall', ref: ref };
};

// OBB (centre, yaw a, half-width hw, half-length hl) vs AABB → push-out vector.
// Forward = (sin a, cos a).  Returned normal points from the box TOWARD the OBB.
function obbAabb(cx, cz, a, hw, hl, b) {
  var fx = Math.sin(a), fz = Math.cos(a), lx = fz, lz = -fx;
  var bx = (b.minx + b.maxx) * 0.5, bz = (b.minz + b.maxz) * 0.5;
  var bhx = (b.maxx - b.minx) * 0.5, bhz = (b.maxz - b.minz) * 0.5;
  var dx = cx - bx, dz = cz - bz;
  var best = Infinity, nx = 0, nz = 0, ov, r, d;
  r = Math.abs(fx) * hl + Math.abs(lx) * hw;
  ov = bhx + r - Math.abs(dx); if (ov <= 0) return null;
  if (ov < best) { best = ov; nx = dx < 0 ? -1 : 1; nz = 0; }
  r = Math.abs(fz) * hl + Math.abs(lz) * hw;
  ov = bhz + r - Math.abs(dz); if (ov <= 0) return null;
  if (ov < best) { best = ov; nx = 0; nz = dz < 0 ? -1 : 1; }
  r = Math.abs(fx) * bhx + Math.abs(fz) * bhz; d = dx * fx + dz * fz;
  ov = hl + r - Math.abs(d); if (ov <= 0) return null;
  if (ov < best) { best = ov; nx = d < 0 ? -fx : fx; nz = d < 0 ? -fz : fz; }
  r = Math.abs(lx) * bhx + Math.abs(lz) * bhz; d = dx * lx + dz * lz;
  ov = hw + r - Math.abs(d); if (ov <= 0) return null;
  if (ov < best) { best = ov; nx = d < 0 ? -lx : lx; nz = d < 0 ? -lz : lz; }
  return { nx: nx, nz: nz, depth: best };
}
Core.obbAabb = obbAabb;

// OBB vs OBB (SAT). Normal points from B toward A.
function obbObb(ax, az, aa, ahw, ahl, bx, bz, ba, bhw, bhl) {
  var f1x = Math.sin(aa), f1z = Math.cos(aa), l1x = f1z, l1z = -f1x;
  var f2x = Math.sin(ba), f2z = Math.cos(ba), l2x = f2z, l2z = -f2x;
  var dx = ax - bx, dz = az - bz;
  var axes = [[f1x, f1z], [l1x, l1z], [f2x, f2z], [l2x, l2z]];
  var best = Infinity, nx = 0, nz = 0;
  for (var i = 0; i < 4; i++) {
    var ux = axes[i][0], uz = axes[i][1];
    var r1 = ahl * Math.abs(f1x * ux + f1z * uz) + ahw * Math.abs(l1x * ux + l1z * uz);
    var r2 = bhl * Math.abs(f2x * ux + f2z * uz) + bhw * Math.abs(l2x * ux + l2z * uz);
    var d = dx * ux + dz * uz;
    var ov = r1 + r2 - Math.abs(d);
    if (ov <= 0) return null;
    if (ov < best) { best = ov; nx = d < 0 ? -ux : ux; nz = d < 0 ? -uz : uz; }
  }
  return { nx: nx, nz: nz, depth: best };
}
Core.obbObb = obbObb;

// Is a point inside any collider (optionally grown by pad)?
Core.pointBlocked = function (x, z, cols, pad) {
  pad = pad || 0;
  for (var i = 0; i < cols.length; i++) {
    var b = cols[i];
    if (x > b.minx - pad && x < b.maxx + pad && z > b.minz - pad && z < b.maxz + pad) return b;
  }
  return null;
};

// Segment vs AABB (slab). Returns entry t in [0,1] or -1 if no hit.
function segAabb(x0, z0, x1, z1, b, pad) {
  pad = pad || 0;
  var dx = x1 - x0, dz = z1 - z0, tmin = 0, tmax = 1;
  var minx = b.minx - pad, maxx = b.maxx + pad, minz = b.minz - pad, maxz = b.maxz + pad;
  if (Math.abs(dx) < 1e-9) { if (x0 < minx || x0 > maxx) return -1; }
  else {
    var t1 = (minx - x0) / dx, t2 = (maxx - x0) / dx;
    if (t1 > t2) { var s = t1; t1 = t2; t2 = s; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return -1;
  }
  if (Math.abs(dz) < 1e-9) { if (z0 < minz || z0 > maxz) return -1; }
  else {
    var u1 = (minz - z0) / dz, u2 = (maxz - z0) / dz;
    if (u1 > u2) { var s2 = u1; u1 = u2; u2 = s2; }
    tmin = Math.max(tmin, u1); tmax = Math.min(tmax, u2); if (tmin > tmax) return -1;
  }
  return tmin;
}
Core.segAabb = segAabb;

// Earliest hit of a segment against all colliders: returns t (0..1) or 1 if clear.
Core.segFirstHit = function (x0, z0, x1, z1, cols, pad) {
  var best = 1;
  for (var i = 0; i < cols.length; i++) {
    var t = segAabb(x0, z0, x1, z1, cols[i], pad);
    if (t >= 0 && t < best) best = t;
  }
  return best;
};
Core.lineOfSight = function (x0, z0, x1, z1, cols) {
  return Core.segFirstHit(x0, z0, x1, z1, cols, 0) >= 1;
};

// ── CAR PHYSICS ─────────────────────────────────
// Car size used for collision (matches the visual mesh):
Core.CAR_HW = 1.85;      // half width
Core.CAR_HL = 4.2;       // half length
Core.WHEELBASE = 5.2;

Core.makeCar = function (x, z, a) {
  return {
    x: x || 0, z: z || 0, a: a || 0,
    vx: 0, vz: 0, w: 0,            // world velocity, yaw rate
    steer: 0,                      // smoothed steering input -1..1 (+ = left)
    vf: 0, vl: 0,                  // forward / lateral speed (derived, for animation)
    slip: 0, braking: false, boosting: false,
    nitro: 100, health: 100, fuel: 100,
    hitCD: 0
  };
};

Core.defaultParams = function () {
  return {
    top: 62,            // top speed (u/s)  → 124 km/h
    acc: 25,            // engine accel at standstill (u/s²)
    brake: 75,          // brake decel
    rev: 20,            // max reverse speed
    revAcc: 20,
    roll: 5.5,          // rolling resistance (u/s²)
    drag: 0.0011,       // quadratic drag
    grip: 8.5,          // lateral grip (1/s)
    hand: 2.2,          // handbrake lateral grip
    latMax: 62,         // max lateral accel (limits yaw rate at speed)
    nitroAcc: 30, nitroTopMul: 1.28, nitroUse: 34, nitroRegen: 11,
    armor: 1.0          // damage multiplier
  };
};

// One physics frame. inp = {throttle 0..1, brake 0..1, steer -1..1, hand bool, nitro bool}
// hooks.onImpact(impactSpeed(u/s), collider, nx, nz)  — called once per contact event
Core.stepCar = function (car, inp, P, dt, cols, hooks) {
  var speed = Math.sqrt(car.vx * car.vx + car.vz * car.vz);
  var n = clamp(Math.ceil(speed * dt / 1.1), 1, 8);
  var sdt = dt / n;
  var outOfFuel = car.fuel <= 0;
  var throttle = outOfFuel ? 0 : inp.throttle;

  // steering input smoothing (frame-rate independent)
  var tgt = clamp(inp.steer, -1, 1);
  var rate = Math.abs(tgt) > Math.abs(car.steer) ? 7.5 : 10;     // quicker return to centre
  if (inp.analog) rate = 14;                                      // analog input is already smooth
  car.steer = damp(car.steer, tgt, rate, dt);
  if (Math.abs(car.steer) < 0.003 && tgt === 0) car.steer = 0;

  // nitro tank
  var wantBoost = inp.nitro && car.nitro > 1 && !outOfFuel;
  car.boosting = wantBoost;
  if (wantBoost) car.nitro = Math.max(0, car.nitro - P.nitroUse * dt);
  else car.nitro = Math.min(100, car.nitro + P.nitroRegen * dt * (inp.throttle > 0 ? 0.5 : 1));

  car.braking = inp.brake > 0.05 && car.vf > 1;
  car.hitCD = Math.max(0, car.hitCD - dt);

  for (var s = 0; s < n; s++) {
    var fx = Math.sin(car.a), fz = Math.cos(car.a), lx = fz, lz = -fx;
    var vf = car.vx * fx + car.vz * fz;
    var vl = car.vx * lx + car.vz * lz;
    var top = P.top * (wantBoost ? P.nitroTopMul : 1);

    // ── longitudinal ──
    if (throttle > 0.01) {
      if (vf < -0.6) vf = Math.min(0, vf + P.brake * throttle * sdt);           // throttle while rolling backwards = brake
      else {
        var k = clamp(vf / top, 0, 1);
        vf += P.acc * (1 - k * k * k) * throttle * sdt;                        // strong launch, tapers near top
      }
    }
    if (wantBoost) vf += P.nitroAcc * sdt;
    if (inp.brake > 0.01) {
      if (vf > 0.6) vf = Math.max(0, vf - P.brake * inp.brake * sdt);
      else {
        var rk = clamp(-vf / P.rev, 0, 1);
        vf -= P.revAcc * (1 - rk) * inp.brake * sdt;                           // reverse
      }
    }
    if (inp.hand) vf *= Math.exp(-1.6 * sdt);
    if (throttle < 0.01 && inp.brake < 0.01) {                                  // coasting
      var rr = P.roll * sdt;
      vf = Math.abs(vf) <= rr ? 0 : vf - (vf > 0 ? rr : -rr);
    }
    vf -= vf * Math.abs(vf) * P.drag * sdt;
    if (vf > top) vf = Math.max(top, vf - 40 * sdt);                            // ease back after nitro
    if (vf < -P.rev) vf = -P.rev;

    // ── lateral grip (slide) ──
    var grip = inp.hand ? P.hand : P.grip;
    vl *= Math.exp(-grip * sdt);

    // ── yaw (bicycle model, limited by lateral acceleration) ──
    var sp = Math.abs(vf);
    var maxSteer = lerp(0.62, 0.12, Math.pow(clamp(sp / P.top, 0, 1), 0.7));
    var wT = vf / Core.WHEELBASE * Math.tan(car.steer * maxSteer);
    var wLim = P.latMax / Math.max(sp, 1);
    wT = clamp(wT, -wLim, wLim);
    if (inp.hand && sp > 8) wT *= 1.45;
    car.w = damp(car.w, wT, 13, sdt);
    car.a += car.w * sdt;

    fx = Math.sin(car.a); fz = Math.cos(car.a); lx = fz; lz = -fx;
    car.vx = fx * vf + lx * vl;
    car.vz = fz * vf + lz * vl;
    car.x += car.vx * sdt;
    car.z += car.vz * sdt;

    // ── world collisions ──
    Core.resolveCar(car, cols, hooks, sdt);
  }

  var f2x = Math.sin(car.a), f2z = Math.cos(car.a);
  car.vf = car.vx * f2x + car.vz * f2z;
  car.vl = car.vx * f2z - car.vz * f2x;
  car.slip = Math.abs(car.vl);
};

// Push the car out of every collider and respond (bounce + scrape + spin).
Core.resolveCar = function (car, cols, hooks, dt) {
  var HW = Core.CAR_HW, HL = Core.CAR_HL;
  var reach = HL + 1.5;
  for (var pass = 0; pass < 3; pass++) {
    var any = false;
    for (var i = 0; i < cols.length; i++) {
      var b = cols[i];
      if (car.x < b.minx - reach || car.x > b.maxx + reach || car.z < b.minz - reach || car.z > b.maxz + reach) continue;
      var m = obbAabb(car.x, car.z, car.a, HW, HL, b);
      if (!m) continue;
      any = true;
      car.x += m.nx * (m.depth + 0.002);
      car.z += m.nz * (m.depth + 0.002);
      var vn = car.vx * m.nx + car.vz * m.nz;
      if (vn < 0) {
        var impact = -vn;
        var e = impact > 14 ? 0.28 : 0.1;
        car.vx -= (1 + e) * vn * m.nx;
        car.vz -= (1 + e) * vn * m.nz;
        // scrape: lose some tangential speed
        var tx = -m.nz, tz = m.nx, vt = car.vx * tx + car.vz * tz;
        var fr = Math.exp(-2.2 * dt);
        car.vx -= tx * vt * (1 - fr); car.vz -= tz * vt * (1 - fr);
        // spin kick from the corner that hit
        var fx = Math.sin(car.a), fz = Math.cos(car.a), lx = fz, lz = -fx, bestd = Infinity, rx = 0, rz = 0;
        for (var cI = 0; cI < 4; cI++) {
          var sx = (cI & 1) ? HW : -HW, sz = (cI & 2) ? HL : -HL;
          var px = lx * sx + fx * sz, pz = lz * sx + fz * sz;
          var dd = px * m.nx + pz * m.nz;
          if (dd < bestd) { bestd = dd; rx = px; rz = pz; }
        }
        var jn = (1 + e) * impact;
        var dw = jn * (m.nx * rz - m.nz * rx) / 7.0;
        car.w += clamp(dw, -2.2, 2.2);
        if (hooks && hooks.onImpact) hooks.onImpact(impact, b, m.nx, m.nz);
      }
    }
    if (!any) break;
  }
};

// Car ↔ car (player vs cop / remote player).  Returns relative impact speed or 0.
// mA, mB are mass weights (share of the push).  Both cars are modified.
Core.collideCars = function (A, B, mA, mB) {
  var m = obbObb(A.x, A.z, A.a, Core.CAR_HW, Core.CAR_HL, B.x, B.z, B.a, Core.CAR_HW, Core.CAR_HL);
  if (!m) return 0;
  var tot = mA + mB, sa = mB / tot, sb = mA / tot;
  A.x += m.nx * m.depth * sa; A.z += m.nz * m.depth * sa;
  B.x -= m.nx * m.depth * sb; B.z -= m.nz * m.depth * sb;
  var rvx = A.vx - B.vx, rvz = A.vz - B.vz;
  var vn = rvx * m.nx + rvz * m.nz;                        // <0 → closing
  if (vn >= 0) return 0;
  var e = 0.25, j = -(1 + e) * vn / (1 / mA + 1 / mB);
  A.vx += m.nx * j / mA; A.vz += m.nz * j / mA;
  B.vx -= m.nx * j / mB; B.vz -= m.nz * j / mB;
  // small spin
  A.w += clamp((m.nx * (B.z - A.z) * 0 + (Math.random() - 0.5)) * 0.8, -0.8, 0.8) * Math.min(1, -vn / 20);
  B.w += clamp((Math.random() - 0.5) * 0.8, -0.8, 0.8) * Math.min(1, -vn / 20);
  return -vn;
};

// ── DAMAGE RULE (the "no damage below 30 km/h" requirement) ───
// impact in world units/s → hit points lost.
Core.crashDamage = function (impactUnits, armor) {
  var kmh = impactUnits * Core.KMH;
  if (kmh <= Core.SAFE_KMH) return 0;
  return Math.min(45, (kmh - Core.SAFE_KMH) * 0.3) * (armor || 1);
};

// ── ON-FOOT (circle vs AABBs) ───────────────────
Core.moveCircle = function (x, z, r, dx, dz, cols) {
  x += dx; z += dz;
  for (var pass = 0; pass < 3; pass++) {
    for (var i = 0; i < cols.length; i++) {
      var b = cols[i];
      var cx = clamp(x, b.minx, b.maxx), cz = clamp(z, b.minz, b.maxz);
      var ox = x - cx, oz = z - cz, d2 = ox * ox + oz * oz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { var d = Math.sqrt(d2), p = (r - d) / d; x += ox * p; z += oz * p; }
      else {                       // centre inside box: push out along shortest axis
        var l = x - b.minx, rr = b.maxx - x, t = z - b.minz, bt = b.maxz - z, m = Math.min(l, rr, t, bt);
        if (m === l) x = b.minx - r; else if (m === rr) x = b.maxx + r; else if (m === t) z = b.minz - r; else z = b.maxz + r;
      }
    }
  }
  return { x: x, z: z };
};

// ── CAMERA SPRING ARM ───────────────────────────
// Shorten the arm from (px,pz)→(cx,cz) so the camera never ends up inside a collider.
// Returns t in (0,1]: use position = p + (c-p)*t
Core.armT = function (px, pz, cx, cz, cols, pad) {
  var t = Core.segFirstHit(px, pz, cx, cz, cols, pad || 0.8);
  return t >= 1 ? 1 : Math.max(0.12, t - 0.04);
};

// Keep a camera point inside a rectangular room (with margin).
Core.clampInRoom = function (px, pz, cx, cz, room, margin) {
  // room: {minx,maxx,minz,maxz}; player is inside. Shrink arm so camera stays in the room.
  var m = margin || 0.7, t = 1;
  var minx = room.minx + m, maxx = room.maxx - m, minz = room.minz + m, maxz = room.maxz - m;
  var dx = cx - px, dz = cz - pz;
  if (cx < minx && dx < 0) t = Math.min(t, (minx - px) / dx);
  if (cx > maxx && dx > 0) t = Math.min(t, (maxx - px) / dx);
  if (cz < minz && dz < 0) t = Math.min(t, (minz - pz) / dz);
  if (cz > maxz && dz > 0) t = Math.min(t, (maxz - pz) / dz);
  return clamp(t, 0.15, 1);
};

// ── ROAD GRAPH (cops, spawns, unstuck) ──────────
var L = Core.ROAD_LINES, NL = L.length;
Core.nearestLine = function (v) {
  var best = 0, bd = Infinity;
  for (var i = 0; i < NL; i++) { var d = Math.abs(L[i] - v); if (d < bd) { bd = d; best = i; } }
  return best;
};
Core.nodePos = function (i, j) { return { x: L[i], z: L[j] }; };
Core.nearestNode = function (x, z) { return { i: Core.nearestLine(x), j: Core.nearestLine(z) }; };

// BFS over the grid (every node connects to its 4 neighbours). Returns [{x,z}…] excluding start.
Core.findPath = function (x0, z0, x1, z1, maxNodes) {
  var s = Core.nearestNode(x0, z0), g = Core.nearestNode(x1, z1);
  var key = function (i, j) { return i * NL + j; };
  var prev = {}, q = [s], seen = {}; seen[key(s.i, s.j)] = true;
  var head = 0, found = false;
  while (head < q.length) {
    var c = q[head++];
    if (c.i === g.i && c.j === g.j) { found = true; break; }
    var nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (var k = 0; k < 4; k++) {
      var ni = c.i + nb[k][0], nj = c.j + nb[k][1];
      if (ni < 0 || nj < 0 || ni >= NL || nj >= NL) continue;
      var kk = key(ni, nj); if (seen[kk]) continue;
      seen[kk] = true; prev[kk] = c; q.push({ i: ni, j: nj });
    }
  }
  var path = [];
  if (!found) return path;
  var cur = g;
  while (!(cur.i === s.i && cur.j === s.j)) { path.push({ x: L[cur.i], z: L[cur.j] }); cur = prev[key(cur.i, cur.j)]; }
  path.reverse();
  if (maxNodes) path = path.slice(0, maxNodes);
  return path;
};

// ── AI DRIVER (cops) ────────────────────────────
// Produces an input object for stepCar given a target point.
Core.driveToward = function (car, tx, tz, topSpeed, brain, dt) {
  var dx = tx - car.x, dz = tz - car.z;
  var want = Math.atan2(dx, dz);
  var ad = angDiff(car.a, want);
  var steer = clamp(ad * 2.2, -1, 1);
  var vf = car.vf || 0;
  var dist = Math.sqrt(dx * dx + dz * dz);
  var vt = topSpeed * (1 - Math.min(0.72, Math.abs(ad) / 1.3));
  if (dist < 14) vt = Math.min(vt, 18);
  var inp = { throttle: 0, brake: 0, steer: steer, hand: false, nitro: false };
  if (vf < vt) inp.throttle = 1; else if (vf > vt + 6) inp.brake = 0.6;
  // stuck handling: if barely moving while throttling, back out for a moment
  if (brain) {
    if (brain.rev > 0) { brain.rev -= dt; inp.throttle = 0; inp.brake = 1; inp.steer = -brain.revSteer; }
    else {
      if (Math.abs(vf) < 1.5 && inp.throttle > 0) brain.stuck = (brain.stuck || 0) + dt; else brain.stuck = 0;
      if (brain.stuck > 0.9) { brain.rev = 1.1; brain.revSteer = steer >= 0 ? 1 : -1; brain.stuck = 0; }
    }
  }
  return inp;
};

root.Core = Core;
if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : globalThis);
