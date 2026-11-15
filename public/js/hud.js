// ═══════════════════════════════════════════════
// HUD — bars, objective, prompts, minimap, full map, overlays
// ═══════════════════════════════════════════════
var MM = null, MMC = null, MAPC = null, MAPX = null;
var toastTO = null;

function initHud() {
  MM = $('mm'); MMC = MM.getContext('2d'); MAPC = $('map-cv'); MAPX = MAPC.getContext('2d');
  $('mm-wrap').addEventListener('click', function () { toggleOverlay('map-ov'); });
  $('btn-map').addEventListener('click', function () { toggleOverlay('map-ov'); });
  $('btn-missions').addEventListener('click', function () { toggleOverlay('ms-ov'); });
  $('btn-pause').addEventListener('click', togglePause);
  $('map-x').addEventListener('click', closeOverlays);
  $('ms-x').addEventListener('click', closeOverlays);
  $('p-resume').addEventListener('click', closeOverlays);
  $('p-unstuck').addEventListener('click', function () { closeOverlays(); unstuckCar(); });
  $('p-quit').addEventListener('click', function () { location.reload(); });
}

// ───────── toast / drama ─────────
function toast(msg, dur, col) {
  var el = $('toast'); if (!el) return;
  el.textContent = msg; el.style.borderColor = col || '#ffcc00'; el.style.color = col || '#ffcc00'; el.style.display = 'block';
  if (toastTO) clearTimeout(toastTO);
  toastTO = setTimeout(function () { el.style.display = 'none'; }, dur || 2000);
}
function triggerDrama(title, sub, reward, col) {
  var ov = $('drama'), fl = $('drama-flash'), tl = $('drama-title'), sb = $('drama-sub'), rw = $('drama-reward');
  ov.style.display = 'flex'; fl.style.background = col || '#fff'; fl.style.opacity = 0.35;
  tl.textContent = title; tl.style.color = col || '#fff'; tl.style.opacity = 0; tl.style.transform = 'scale(1.5)';
  sb.textContent = sub || ''; sb.style.color = col || '#ccc'; sb.style.opacity = 0;
  rw.textContent = reward || ''; rw.style.opacity = 0; rw.style.transform = 'translateY(20px)';
  setTimeout(function () { fl.style.opacity = 0; tl.style.opacity = 1; tl.style.transform = 'scale(1)'; sb.style.opacity = 1; rw.style.opacity = 1; rw.style.transform = 'translateY(0)'; }, 30);
  setTimeout(function () { tl.style.opacity = 0; sb.style.opacity = 0; rw.style.opacity = 0; }, 1900);
  setTimeout(function () { ov.style.display = 'none'; }, 2200);
}

// ───────── overlays ─────────
function anyOverlay() { return ['map-ov', 'ms-ov', 'pause-ov'].some(function (id) { return $(id).classList.contains('show'); }); }
function closeOverlays() {
  ['map-ov', 'ms-ov', 'pause-ov'].forEach(function (id) { $(id).classList.remove('show'); });
  G.paused = false; if (G.running) clock.getDelta();
}
function toggleOverlay(id) {
  if (!G.running || G.over) return;
  var was = $(id).classList.contains('show');
  closeOverlays();
  if (!was) {
    $(id).classList.add('show'); G.paused = true;
    if (id === 'ms-ov') buildMissionPanel();
    if (id === 'map-ov') drawFullMap();
    keys = {}; IN.gas = IN.brk = IN.nos = IN.hnd = false;
  }
}
function togglePause() { if (anyOverlay()) closeOverlays(); else toggleOverlay('pause-ov'); }

// ───────── per-frame HUD ─────────
function updateHUD(dt, force) {
  var car = G.car;
  var foot = G.mode === 'foot';
  var cl = document.body.classList; if (cl.contains('foot') !== foot) cl.toggle('foot', foot);
  setT('hspeed', foot ? '0' : Math.round(Math.hypot(car.vx, car.vz) * Core.KMH));
  setW('b-health', car.health); setW('b-fuel', car.fuel); setW('b-nitro', car.nitro);
  var hb = $('b-health').firstElementChild, fb = $('b-fuel').firstElementChild;
  hb.style.background = car.health < 30 ? '#ff2222' : '#ff6644';
  fb.style.background = car.fuel < 20 ? '#ff4433' : car.fuel < 40 ? '#ffcc00' : '#00ffcc';
  setT('money', '$' + Math.floor(G.money));
  var st = ''; for (var i = 0; i < 5; i++) st += i < G.stars ? '<b>★</b>' : '☆';
  if (_tc.stars !== st) { _tc.stars = st; $('stars').innerHTML = st; }
  var ws = '';
  if (G.stars > 0) {
    if (G.bustT > 0.4) ws = 'BUSTED IN ' + Math.max(1, Math.ceil(3 - G.bustT)) + '…';
    else if (G.evadeT > 0.6) ws = 'LOSING THEM ' + Math.round(G.evadeT / 7 * 100) + '%';
    else ws = 'POLICE CHASE';
  }
  setT('wstatus', ws);
  var hrs = Math.floor(G.tod), mins = Math.floor((G.tod % 1) * 60);
  setT('clock', ((W.dayF !== undefined && W.dayF < 0.4) ? 'NIGHT ' : 'DAY ') + (hrs < 10 ? '0' : '') + hrs + ':' + (mins < 10 ? '0' : '') + mins);

  updateObjectiveHud();
  updatePromptHud();
  drawMiniMap();
  if (typeof mpUpdateHud === 'function') mpUpdateHud();
}

function updatePromptHud() {
  var it = G.interact, pr = $('prompt'), act = $('t-act');
  if (it && !G.paused) {
    var key = isTouchDevice ? 'ACT' : 'E';
    var txt = it.act ? (it.hold ? 'HOLD ' + key + ' — ' : (isTouchDevice ? 'TAP ACT — ' : 'PRESS E — ')) + it.text : it.text;
    setT('prompt-txt', txt);
    pr.style.display = 'block'; pr.classList.toggle('hold', !!it.hold);
    var bar = $('prompt-bar');
    if (it.hold && G.holdProg > 0) { bar.style.display = 'block'; bar.firstElementChild.style.width = Math.round(G.holdProg * 100) + '%'; } else bar.style.display = 'none';
    act.classList.toggle('ready', !!it.act);
    var short = it.short || (it.act ? 'GO' : '…'); setT('t-act', short);
  } else { pr.style.display = 'none'; act.classList.remove('ready'); setT('t-act', 'ACT'); }
}

function updateObjectiveHud() {
  var o = missionHudInfo();
  setT('obj-title', o.title); setT('obj-sub', o.sub);
  var tg = currentTarget(), d = '';
  var px = G.mode === 'foot' ? G.foot.x : G.car.x, pz = G.mode === 'foot' ? G.foot.z : G.car.z;
  var arrow = $('obj-arrow');
  if (tg && G.mode === 'car') {
    var dx = tg.x - px, dz = tg.z - pz, dist = Math.hypot(dx, dz);
    d = Math.round(dist) + ' m';
    var rel = Core.angDiff(G.camYaw, Math.atan2(dx, dz));
    arrow.firstElementChild.style.transform = 'rotate(' + (-rel * 180 / Math.PI).toFixed(1) + 'deg)';
    arrow.style.visibility = 'visible';
  } else arrow.style.visibility = 'hidden';
  setT('obj-dist', d);
  var tm = missionTimer(), te = $('timer');
  if (tm !== null) { te.style.display = 'block'; setT('timer', Math.max(0, Math.ceil(tm)) + 's'); te.classList.toggle('warn', tm < 10); }
  else te.style.display = 'none';
}

// ───────── maps ─────────
function mapProject(S, cx, cz, scale, a) {
  var ca = Math.cos(a), sa = Math.sin(a);
  return function (x, z) {
    var dx = x - cx, dz = z - cz;
    var u = dx * ca - dz * sa, v = dx * sa + dz * ca;
    return [S / 2 - u * scale, S / 2 - v * scale];
  };
}
function renderMap(ctx, S, cx, cz, scale, a, full) {
  var P = mapProject(S, cx, cz, scale, a), i, p, q;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = full ? '#07080f' : 'rgba(6,8,16,0.92)'; ctx.fillRect(0, 0, S, S);
  // city floor
  var H = Core.CITY_HALF;
  ctx.fillStyle = '#10121c'; ctx.beginPath();
  [[-H, -H], [H, -H], [H, H], [-H, H]].forEach(function (c, k) { var pp = P(c[0], c[1]); k ? ctx.lineTo(pp[0], pp[1]) : ctx.moveTo(pp[0], pp[1]); }); ctx.closePath(); ctx.fill();
  // roads
  ctx.strokeStyle = '#2a2d3e'; ctx.lineCap = 'butt';
  Core.ROAD_LINES.forEach(function (L) {
    ctx.lineWidth = (L === 0 ? 76 : 16) * scale;
    p = P(L, -H); q = P(L, H); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    p = P(-H, L); q = P(H, L); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
  });
  // blocks (buildings)
  for (i = 0; i < W.cols.length; i++) {
    var b = W.cols[i]; if (b.type !== 'building') continue;
    ctx.fillStyle = b.ref ? '#3a3350' : '#1b1d2c';
    var c1 = P(b.minx, b.minz), c2 = P(b.maxx, b.minz), c3 = P(b.maxx, b.maxz), c4 = P(b.minx, b.maxz);
    ctx.beginPath(); ctx.moveTo(c1[0], c1[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(c3[0], c3[1]); ctx.lineTo(c4[0], c4[1]); ctx.closePath(); ctx.fill();
  }
  // street names (full map)
  if (full) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = (S * 0.016) + 'px Orbitron, sans-serif'; ctx.textAlign = 'center';
    p = P(0, -H + 14); ctx.fillText('PUNK AVENUE', p[0], p[1]);
    p = P(-H + 10, 0); ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(-Math.PI / 2); ctx.fillText('CENTRAL BLVD', 0, 0); ctx.restore();
    p = P(0, H - 8); ctx.fillText('RING ROAD', p[0], p[1]);
  }
  // places
  var fs = full ? S * 0.027 : S * 0.1;
  Object.keys(PLACES).forEach(function (k) {
    var pl = PLACES[k], pp = P(pl.cx, pl.cz);
    if (!full && (pp[0] < -20 || pp[0] > S + 20 || pp[1] < -20 || pp[1] > S + 20)) { drawEdgeIcon(ctx, S, pp, pl); return; }
    ctx.fillStyle = pl.css; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(pp[0], pp[1], fs * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.font = fs + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(pl.icon, pp[0], pp[1] + 1);
    if (full) { ctx.font = 'bold ' + (S * 0.02) + 'px Orbitron, sans-serif'; ctx.fillStyle = '#fff'; ctx.textBaseline = 'top'; ctx.fillText(pl.name, pp[0], pp[1] + fs * 0.95); ctx.textBaseline = 'middle'; }
  });
  // objective
  var tg = currentTarget();
  if (tg) {
    var tp = P(tg.x, tg.z), pulse = 1 + Math.sin(G.t * 5) * 0.18, r = (full ? S * 0.02 : S * 0.055) * pulse;
    var inside = tp[0] > 6 && tp[0] < S - 6 && tp[1] > 6 && tp[1] < S - 6;
    if (!inside) { var cxm = S / 2, cym = S / 2, vx = tp[0] - cxm, vy = tp[1] - cym, l = Math.hypot(vx, vy) || 1, ed = S / 2 - 10; tp = [cxm + vx / l * ed, cym + vy / l * ed]; }
    ctx.fillStyle = '#ffcc00'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tp[0], tp[1] - r); ctx.lineTo(tp[0] + r, tp[1]); ctx.lineTo(tp[0], tp[1] + r); ctx.lineTo(tp[0] - r, tp[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (full) { ctx.font = 'bold ' + (S * 0.019) + 'px Orbitron, sans-serif'; ctx.fillStyle = '#ffcc00'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(tg.label || 'OBJECTIVE', tp[0], tp[1] + r + 3); }
  }
  // police
  ctx.fillStyle = '#3355ff';
  G.cops.forEach(function (c) { var cp = P(c.car.x, c.car.z); ctx.beginPath(); ctx.arc(cp[0], cp[1], full ? S * 0.008 : S * 0.022, 0, Math.PI * 2); ctx.fill(); });
  // other players
  if (typeof mpDrawMarkers === 'function') mpDrawMarkers(ctx, P, full ? S * 0.01 : S * 0.025);
  // player arrow
  var me = G.mode === 'foot' ? PLACES[G.place] : G.car, mx, mz, ang;
  if (G.mode === 'foot') { mx = me.cx; mz = me.cz; ang = 0; } else { mx = G.car.x; mz = G.car.z; ang = G.car.a; }
  var pp2 = P(mx, mz), al = full ? S * 0.022 : S * 0.065;
  var ca = ang - a;                                        // heading relative to the map rotation
  ctx.save(); ctx.translate(pp2[0], pp2[1]); ctx.rotate(-ca + (full ? 0 : 0));
  ctx.fillStyle = '#ff3355'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -al); ctx.lineTo(al * 0.7, al * 0.8); ctx.lineTo(0, al * 0.35); ctx.lineTo(-al * 0.7, al * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawEdgeIcon(ctx, S, pp, pl) {
  var vx = pp[0] - S / 2, vy = pp[1] - S / 2, l = Math.hypot(vx, vy) || 1, ed = S / 2 - S * 0.07;
  var x = S / 2 + vx / l * ed, y = S / 2 + vy / l * ed;
  ctx.fillStyle = pl.css; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.arc(x, y, S * 0.045, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.font = (S * 0.06) + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#000'; ctx.fillText(pl.icon, x, y + 1);
}
function drawMiniMap() {
  var c = G.mode === 'foot' ? { x: PLACES[G.place].cx, z: PLACES[G.place].cz, a: 0 } : G.car;
  // clip to a circle once
  renderMap(MMC, 256, c.x, c.z, 0.52, G.mode === 'foot' ? Math.PI : c.a, false);
}
function drawFullMap() {
  var c = G.mode === 'foot' ? PLACES[G.place] : G.car;
  renderMap(MAPX, 900, 0, 0, 900 / (Core.CITY_HALF * 2 + 30), Math.PI, true);
}
function buildMapLegend() {
  var el = $('map-legend'), h = '';
  Object.keys(PLACES).forEach(function (k) { var p = PLACES[k]; h += '<div class="lg" style="border-color:' + p.css + '55"><i>' + p.icon + '</i><div style="color:' + p.css + '">' + p.name + '<small>' + p.info + '</small></div></div>'; });
  h += '<div class="lg"><i style="color:#ffcc00">◆</i><div>OBJECTIVE<small>Your current mission</small></div></div>';
  h += '<div class="lg"><i style="color:#ff3355">▲</i><div>YOU</div></div>';
  h += '<div class="lg"><i style="color:#3355ff">●</i><div>POLICE</div></div>';
  el.innerHTML = h;
}

// ───────── mission list overlay ─────────
function buildMissionPanel() {
  var h = '<div class="mh">STORY — FINISH ALL 10 TO WIN</div>';
  MAIN.forEach(function (m, i) {
    var st = i < G.m.cur ? 'done' : i === G.m.cur ? 'active' : 'locked';
    h += '<div class="mrow ' + st + '"><div class="n">' + (st === 'done' ? '✓' : (i + 1)) + '</div><div><div class="t">' + m.title + '</div><div class="b">' + (st === 'locked' ? 'Locked — finish the previous mission' : m.brief) + '</div></div><div class="r">+$' + m.reward + '</div></div>';
  });
  h += '<div class="mh">BONUS CHALLENGES — OPTIONAL</div>';
  BONUS.forEach(function (b) {
    var done = G.bonus[b.id];
    h += '<div class="mrow ' + (done ? 'done' : '') + '"><div class="n">' + (done ? '✓' : '★') + '</div><div><div class="t">' + b.title + '</div><div class="b">' + b.brief + '</div></div><div class="r">+$' + b.reward + '</div></div>';
  });
  $('ms-box').innerHTML = h;
}
