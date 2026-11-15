// Headless smoke test: runs the real game scripts against a stubbed THREE/DOM.
const fs = require('fs'), vm = require('vm'), path = require('path');
const errors = [];
function Gen(name) {                                   // permissive stand-in for anything not modelled
  const f = function () { return Gen(name + '()'); };
  return new Proxy(f, {
    get(t, k) { if (k === Symbol.toPrimitive) return () => 0; if (k === 'then') return undefined; if (k === 'length') return 0; if (!(k in t)) t[k] = Gen(name + '.' + String(k)); return t[k]; },
    set(t, k, v) { t[k] = v; return true; }, apply() { return Gen(name + '()'); }, construct() { return Gen('new ' + name); }
  });
}
class Vec { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; } add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; } clone() { return new Vec(this.x, this.y, this.z); } project() { this.z = 0.5; return this; } setScalar(s) { return this.set(s, s, s); } }
class Col { constructor(c) { this.r = this.g = this.b = 1; } setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; } setHex() { return this; } setHSL() { return this; } set() { return this; } copy() { return this; } }
class Obj { constructor() { this.position = new Vec(); this.rotation = new Vec(); this.scale = new Vec(1, 1, 1); this.children = []; this.visible = true; this.userData = {}; this.matrix = {}; this.parent = null; }
  add(c) { this.children.push(c); c.parent = this; return this; } remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
  updateMatrix() {} lookAt() {} traverse(f) { f(this); this.children.forEach(c => c.traverse && c.traverse(f)); } setMatrixAt() {} updateProjectionMatrix() {} }
function Mat(opts) { const m = Object.assign({ color: new Col(), emissive: new Col(), opacity: 1, map: { dispose() {} }, dispose() {} }, opts || {}); if (typeof m.color === 'number') m.color = new Col(); if (typeof m.emissive === 'number') m.emissive = new Col(); return m; }
class Geo { constructor() { this.attributes = {}; } translate() { return this; } rotateX() { return this; } rotateY() { return this; } rotateZ() { return this; } setAttribute(k, v) { this.attributes[k] = v; } setIndex(i) { this.index = { array: i }; } dispose() {} clearGroups() {} }
class BoxGeo extends Geo { constructor() { super(); const n = 24; const mk = (c) => { const a = new Float32Array(n * c); return { count: n, array: a, getX: i => a[i * c], getY: i => a[i * c + 1], getZ: i => a[i * c + 2], setXY: (i, x, y) => { a[i * c] = x; a[i * c + 1] = y; } }; };
  this.attributes = { position: mk(3), normal: mk(3), uv: mk(2) }; this.index = { array: Uint16Array.from({ length: 36 }, (_, i) => i % 24) }; } }
class Attr { constructor(a, n) { this.array = a; this.count = a.length / n; this.n = n; } setXYZ(i, x, y, z) { this.array[i * 3] = x; this.array[i * 3 + 1] = y; this.array[i * 3 + 2] = z; } getY(i) { return this.array[i * 3 + 1]; } getX(i) { return this.array[i * 3]; } getZ(i) { return this.array[i * 3 + 2]; } }
class SphereGeo extends Geo { constructor() { super(); this.attributes.position = new Attr(new Float32Array(30), 3); } setAttribute(k, v) { this.attributes[k] = v; } }
const THREE = new Proxy({
  Vector3: Vec, Color: Col, Object3D: Obj, Group: Obj, Mesh: class extends Obj { constructor(g, m) { super(); this.geometry = g || new Geo(); this.material = m || Mat(); } },
  InstancedMesh: class extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; this.instanceMatrix = {}; } },
  Sprite: class extends Obj { constructor(m) { super(); this.material = m || Mat(); } }, Points: class extends Obj { constructor(g, m) { super(); this.material = m; } },
  Scene: class extends Obj { constructor() { super(); this.fog = null; this.background = null; } },
  PerspectiveCamera: class extends Obj { constructor() { super(); this.fov = 62; this.aspect = 1; } },
  WebGLRenderer: class { constructor() { this.frames = 0; } setPixelRatio() {} setSize() {} render() { this.frames++; } },
  Clock: class { getDelta() { return 0.016; } },
  FogExp2: class { constructor(c) { this.color = new Col(); } }, Fog: class { constructor() { this.color = new Col(); } },
  HemisphereLight: class extends Obj { constructor() { super(); this.color = new Col(); } }, DirectionalLight: class extends Obj { constructor() { super(); this.color = new Col(); } }, PointLight: class extends Obj {},
  BoxGeometry: BoxGeo, SphereGeometry: SphereGeo, BufferGeometry: Geo, BufferAttribute: Attr, Float32BufferAttribute: class extends Attr { constructor(a, n) { super(a, n); } },
  Shape: class { moveTo() {} lineTo() {} closePath() {} },
  MeshLambertMaterial: Mat, MeshBasicMaterial: Mat, SpriteMaterial: Mat, PointsMaterial: Mat,
  CanvasTexture: class { constructor() { this.repeat = new Vec(); } dispose() {} },
  AdditiveBlending: 1, RepeatWrapping: 1, BackSide: 1, DoubleSide: 1
}, { get(t, k) { if (k in t) return t[k]; const G = class extends Obj { constructor() { super(); this.material = Mat(); this.geometry = new Geo(); } rotateX() {} rotateY() {} rotateZ() {} translate() {} }; if (/Geometry$/.test(String(k))) return class extends Geo { constructor() { super(); this.attributes.position = new Attr(new Float32Array(30), 3); } }; return G; } });
const ctx2d = Gen('ctx');
const elements = {};
function el(id) {
  if (elements[id]) return elements[id];
  const cls = new Set(); const e = { id, style: {}, children: [], textContent: '', innerHTML: '', value: '', width: 256, height: 256, offsetWidth: 100,
    classList: { add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c), toggle: (c, f) => { (f === undefined ? !cls.has(c) : f) ? cls.add(c) : cls.delete(c); } },
    addEventListener() {}, appendChild() {}, setPointerCapture() {}, getContext: () => ctx2d, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }), closest: () => null,
    parentNode: null, firstElementChild: { style: {} } };
  e.firstElementChild.style = {}; return elements[id] = e;
}
const sandbox = { console, Math, Date, performance: { now: () => Date.now() }, setTimeout: (f) => { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {}, requestAnimationFrame() {},
  navigator: { userAgent: 'node' }, THREE, io: undefined, Float32Array, Uint16Array, Array, Object, JSON, Set, Map, Number, String, parseInt, isFinite, Infinity, NaN };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.innerWidth = 844; sandbox.innerHeight = 390; sandbox.devicePixelRatio = 2;
sandbox.matchMedia = () => ({ matches: false }); sandbox.addEventListener = () => {};
sandbox.document = { getElementById: el, createElement: (t) => { const e = el('_' + Math.random()); e.getContext = () => ctx2d; e.style = {}; return e; }, body: { classList: el('body').classList, appendChild() {} }, addEventListener() {} };
sandbox.document.body = el('body'); sandbox.AudioContext = undefined; sandbox.location = { reload() {} };
vm.createContext(sandbox);
const dir = path.join(__dirname, '../public/js');
['core', 'audio', 'world', 'entities', 'interiors', 'game', 'hud', 'missions', 'foot', 'mp'].forEach(f => {
  try { vm.runInContext(fs.readFileSync(path.join(dir, f + '.js'), 'utf8').replace(/\bvar (UPGRADES|G|IN|W|PLACES|MAIN|BONUS|keys|pad|look|mp|CAR_MODELS)\b/g, 'var $1'), sandbox, { filename: f + '.js' }); }
  catch (e) { errors.push('LOAD ' + f + ': ' + e.stack.split('\n').slice(0, 3).join(' | ')); }
});
const run = (code, label) => { try { return vm.runInContext(code, sandbox); } catch (e) { errors.push(label + ': ' + e.stack.split('\n').slice(0, 4).join(' | ')); } };
const frames = (n, label, pre) => { for (let i = 0; i < n; i++) { try { if (pre) vm.runInContext(pre, sandbox); vm.runInContext('(function(){var dt=0.016; if(G.running&&!G.paused){G.t+=dt; if(G.mode==="car"){G.tod=(G.tod+dt*0.08)%24;updateCarMode(dt);updateCops(dt);updatePeds(dt);updateParticles(dt);updateMissions(dt);mpModeUpdate(dt);updateCarCamera(dt);updateSky(G.tod,W.camera.position);updateWorldFx(dt);}else{updateFoot(dt);} updateHUD(dt);} })()', sandbox); } catch (e) { errors.push(label + ' frame ' + i + ': ' + e.stack.split('\n').slice(0, 5).join(' | ')); return; } } };

run('window.addEventListener=function(){}; setupInput(); buildCarChips(); initHud();', 'setup');
run('startGame()', 'startGame');
console.log('world built:', run('W.ready'), 'colliders:', run('W.cols.length'), 'peds:', run('G.peds.length'));
frames(120, 'idle');
run('keys["w"]=true', 'keys'); frames(300, 'drive'); run('keys["a"]=true', 'k'); frames(120, 'turn'); run('keys["a"]=false;keys["d"]=true', 'k'); frames(60, 'turn2'); run('keys["d"]=false;keys["shift"]=true', 'k'); frames(100, 'nitro'); run('keys={}', 'k');
console.log('after driving: speed km/h', run('Math.round(Math.hypot(G.car.vx,G.car.vz)*2)'), 'pos', run('Math.round(G.car.x)+","+Math.round(G.car.z)'), 'health', run('G.car.health'), 'fuel', run('G.car.fuel.toFixed(1)'));
// drive into a wall hard → damage only above 30 km/h
run('G.grace=0; G.car.x=30;G.car.z=60;G.car.a=Math.PI/2;G.car.vx=40;G.car.vz=0;G.car.health=100;', 'setup crash'); frames(60, 'crash');
console.log('after 80km/h crash health', run('G.car.health.toFixed(1)'));
run('G.car.x=38;G.car.z=60;G.car.a=Math.PI/2;G.car.vx=12;G.car.vz=0;G.car.health=100;', 'setup slow'); frames(60, 'slow');
console.log('after 24km/h bump health', run('G.car.health'));
// missions: fuel
run('G.car.x=PLACES.gas.svc.x;G.car.z=PLACES.gas.svc.z;G.car.vx=0;G.car.vz=0;G.car.a=0', 'tp'); frames(5, 'gas');
console.log('gas prompt:', run('G.interact&&G.interact.text')); run('actPress()', 'refuel'); frames(3, 'post'); console.log('mission now', run('G.m.cur'), run('MAIN[G.m.cur].id'));
// kill peds → rampage
run('for(var i=0;i<5;i++){G.kills++; addHeat(1);}', 'kills'); frames(3, 'r'); console.log('mission now', run('MAIN[G.m.cur].id'), 'stars', run('G.stars'));
frames(900, 'cops', 'G.car.vx=Math.sin(G.car.a)*30;G.car.vz=Math.cos(G.car.a)*30;'); console.log('cops spawned', run('G.cops.length'));
// interiors
console.log('player health after chase', run('G.car.health.toFixed(0)'), 'over', run('G.over')); run('G.car.health=100;G.over=false;G.running=true;G.grace=0;setStars(0);', 'revive');
for (const k of ['club', 'tune', 'bank']) {
  run(`G.car.x=PLACES.${k}.svc.x;G.car.z=PLACES.${k}.svc.z;G.car.vx=0;G.car.vz=0`, 'tp'); frames(3, 'near ' + k);
  console.log(k, 'prompt:', run('G.interact&&G.interact.text')); run('actPress()', 'enter ' + k);
  console.log('  mode', run('G.mode'), 'place', run('G.place'));
  run('keys["w"]=true', 'k'); frames(200, 'walk ' + k); run('keys["w"]=false;keys["a"]=true', 'k'); frames(100, 'walk2 ' + k); run('keys={}', 'k');
  const inside = run('(function(){var I=W.int[G.place],f=G.foot;return f.x>I.room.minx&&f.x<I.room.maxx&&f.z>I.room.minz&&f.z<I.room.maxz})()');
  const camIn = run('(function(){var I=W.int[G.place],c=W.camera.position;return c.x>I.room.minx&&c.x<I.room.maxx&&c.z>I.room.minz&&c.z<I.room.maxz&&c.y>0&&c.y<I.h})()');
  console.log('  player inside room:', inside, ' camera inside room:', camIn, ' health', run('G.car.health.toFixed(0)'));
  if (k === 'bank') {
    run('var I=W.int.bank;G.foot.x=I.guardPos.x;G.foot.z=I.guardPos.z+1.5', 'tp guard'); frames(2, 'g');
    for (let i = 0; i < 3; i++) { run('G.bank.cd=0;actPress()', 'punch'); frames(2, 'p'); }
    console.log('  guard down, stage', run('G.bank.stage'));
    run('G.foot.x=I.vaultPos.x;G.foot.z=I.vaultPos.z', 'tp vault'); run('keys["e"]=true', 'e'); frames(140, 'crack'); run('keys["e"]=false', 'e');
    console.log('  stage after crack', run('G.bank.stage')); run('G.foot.x=I.cashPos.x;G.foot.z=I.cashPos.z+1', 'tp cash'); frames(2, 'c'); run('actPress()', 'grab'); console.log('  loot', run('G.bank.loot'), 'stars', run('G.stars'), 'money', run('Math.floor(G.money)'));
    run('G.foot.x=I.door.x;G.foot.z=I.door.z', 'tp door'); frames(2, 'd'); console.log('  exit prompt:', run('G.interact&&G.interact.text'));
  }
  if (k === 'club') { run('G.foot.x=W.int.club.barZone.x;G.foot.z=W.int.club.barZone.z', 'tp'); frames(2, 'b'); console.log('  bar prompt:', run('G.interact&&G.interact.text')); }
  if (k === 'tune') { run('G.money=2000;G.foot.x=W.int.tune.pedestals[0].x;G.foot.z=W.int.tune.pedestals[0].z+1.5', 'tp'); frames(2, 't'); console.log('  prompt:', run('G.interact&&G.interact.text')); run('actPress()', 'buy'); console.log('  upgrade owned:', run('JSON.stringify(G.upg)')); }
  run('G.foot.x=W.int[G.place].door.x;G.foot.z=W.int[G.place].door.z', 'tp door'); frames(2, 'door'); run('actPress()', 'exit');
  console.log('  after exit mode', run('G.mode'), 'visible root', run('W.root.visible'));
  frames(60, 'after exit ' + k);
}
console.log('missions at', run('G.m.cur'), run('MAIN[G.m.cur]&&MAIN[G.m.cur].id'), 'flags', run('JSON.stringify(G.flags)'));
// force through all missions
run('for(var i=0;i<12;i++){ if(G.m.cur<MAIN.length){ var m=MAIN[G.m.cur]; completeMission(m);} }', 'complete all');
console.log('won:', run('G.over'), 'cur', run('G.m.cur'));
run('resetGame()', 'reset'); frames(30, 'after reset');
run('pause=togglePause();toggleOverlay("map-ov");drawFullMap();buildMissionPanel();closeOverlays()', 'overlays');

// ───────── multiplayer modes (fake socket, real client code) ─────────
console.log('\n[multiplayer]');
run('mp.socket={sent:[],emit:function(n,d){this.sent.push([n,d]);}}; mp.myId="me"; mp.players={me:{name:"ME",color:"#0f0",role:null},b:{name:"BOB",color:"#f00",role:null}};', 'mp setup');
const info = { mode: 'race', cps: [{x:-210,z:-210},{x:0,z:-210},{x:210,z:-210},{x:210,z:0},{x:210,z:210},{x:0,z:210},{x:-210,z:210},{x:-210,z:0}], laps: 2, starts: { me: { x: -234, z: -214, a: Math.PI / 2 }, b: { x: -234, z: -206, a: Math.PI / 2 } } };
run('mpOnGameStart(mp.players,' + JSON.stringify(info) + ')', 'race start');
console.log('race: frozen at start', run('G.freeze'), 'pos', run('Math.round(G.car.x)+","+Math.round(G.car.z)'), 'heading', run('G.car.a.toFixed(2)'), 'peds', run('G.peds.length'), 'gm', run('G.gm'));
run('keys["w"]=true','k'); frames(60, 'frozen'); console.log('  speed while frozen', run('Math.hypot(G.car.vx,G.car.vz).toFixed(1)'));
run('mpOnCountdown(0)', 'go'); frames(120, 'racing'); console.log('  speed after GO', run('Math.hypot(G.car.vx,G.car.vz).toFixed(1)'), 'interact', run('G.interact'));
console.log('  hud', run('JSON.stringify(mpHudInfo())'), 'target', run('JSON.stringify(mpTarget())'));
run('G.car.x=0;G.car.z=-210;G.car.vx=0;G.car.vz=0', 'tp cp1'); frames(3, 'cp'); console.log('  sent', run('JSON.stringify(mp.socket.sent.filter(function(x){return x[0]==="cpHit"}))'));
run('mpOnCpOK(1)', 'ok'); console.log('  next target', run('JSON.stringify(mpTarget())'), 'respawn point', run('JSON.stringify(mp.lastCp)'));
run('G.car.x=50;G.car.z=-100;G.car.health=0.5;G.grace=0;applyDamage(20,40)', 'wreck'); console.log('  after wreck: health', run('G.car.health'), 'at', run('Math.round(G.car.x)+","+Math.round(G.car.z)'), 'over', run('G.over'));
run('mpOnRaceEnd([{id:"b",pos:1,name:"BOB",finishedAt:61234},{id:"me",pos:2,name:"ME",finishedAt:65000}])', 'end'); console.log('  end title', run('$("mp-win-name").textContent'), '| list', run('$("mp-win-list").innerHTML.length > 10'));
// chase as robber
run('keys={};G.over=false;G.running=true;', 'reset flags');
const ci = { mode: 'chase', robber: 'me', time: 150, starts: { me: { x: 4, z: 4, a: 0 }, b: { x: 0, z: -150, a: Math.PI } } };
run('mp.players={me:{name:"ME",color:"#0f0",role:"robber"},b:{name:"BOB",color:"#f00",role:"cop"}}; mpOnGameStart(mp.players,' + JSON.stringify(ci) + ')', 'chase start');
run('mpOnCountdown(0)', 'go'); run('mpRemoteUpdate("b",{x:0,z:-150,angle:3.14,vx:0,vz:0,hidden:false,model:0,role:"cop"})', 'remote cop');
frames(120, 'chase'); console.log('robber: stars', run('G.stars'), 'cops(AI)', run('G.cops.length'), 'hud', run('JSON.stringify(mpHudInfo())'));
run('mp.chase={t:120,bust:2.5}', 'cs'); console.log('  hud with bust', run('JSON.stringify(mpHudInfo())'), 'timer', run('mpTimer()'));
run('G.car.health=0.2;G.grace=0;applyDamage(30,45)', 'wreck robber'); console.log('  robber wreck emits', run('JSON.stringify(mp.socket.sent.filter(function(x){return x[0]==="robberWrecked"}).length)'));
run('mpOnChaseEnd({winner:"cops",reason:"THE ROBBER WAS WRECKED",robber:"me"})', 'end'); console.log('  robber sees:', run('$("mp-win-name").textContent'));
// chase as cop
run('G.over=false;G.running=true;mp.role="cop";mp.players.me.role="cop";mp.players.b.role="robber";mp.info.robber="b";', 'swap');
run('mpOnGameStart(mp.players,' + JSON.stringify({ mode: 'chase', robber: 'b', time: 150, starts: { me: { x: 0, z: -150, a: Math.PI }, b: { x: 4, z: 4, a: 0 } } }) + ')', 'cop start');
run('mpOnCountdown(0)', 'go'); run('mpRemoteUpdate("b",{x:4,z:4,angle:0,vx:0,vz:0,hidden:false,model:0,role:"robber"})', 'remote robber');
frames(60, 'cop'); console.log('cop: police mesh', run('!!G.carMesh.userData.sirenL'), 'target', run('JSON.stringify(mpTarget())'));
run('G.car.health=100;G.grace=0;applyDamage(30,45)', 'cop dmg'); console.log('  cop health after big hit (invulnerable)', run('G.car.health'));
run('G.gm="story";mp.active=false;mp.mode="story";document.body.classList.remove("gm-chase")', 'back');

console.log(errors.length ? '\nERRORS:\n' + errors.join('\n') : '\nNO RUNTIME ERRORS');
process.exit(errors.length ? 1 : 0);
