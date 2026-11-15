// ═══════════════════════════════════════════════
// AUDIO — Web Audio synthesized sounds
// ═══════════════════════════════════════════════
var audioCtx = null, engineOsc = null, engineGain = null, engineFilter = null;
var sirenOsc = null, sirenGain = null, sirenLFO = null, sirenOn = false;
var clubMusicOsc = null, clubMusicGain = null, clubMusicOn = false, clubBeatInterval = null;

function initAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (!engineOsc) {
      engineOsc = audioCtx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineGain = audioCtx.createGain();
      engineFilter = audioCtx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 520;
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(audioCtx.destination);
      engineOsc.frequency.value = 70;
      engineOsc.start();
    }
  } catch (err) {}
}

function playTone(freq, dur, type, gain) {
  try {
    if (!audioCtx) initAudio();
    if (!audioCtx) return;
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.0001;
    o.connect(g); g.connect(audioCtx.destination);
    var t = audioCtx.currentTime;
    g.gain.exponentialRampToValueAtTime(gain || 0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
    o.start();
    o.stop(t + (dur || 0.12) + 0.02);
  } catch (err) {}
}

// engine: speed in world units/s, throttle 0..1, active=false mutes it (interiors, menus)
function updateEngineSound(speed, throttle, active, boosting) {
  if (!audioCtx || !engineOsc || !engineGain) return;
  var s = Math.abs(speed);
  var targetGain = active ? Math.min(0.035, 0.006 + s / 1800 + throttle * 0.006) : 0.0;
  var t = audioCtx.currentTime;
  engineGain.gain.setTargetAtTime(targetGain, t, 0.06);
  engineOsc.frequency.setTargetAtTime(48 + s * 2.4 + throttle * 14 + (boosting ? 25 : 0), t, 0.06);
  if (engineFilter) engineFilter.frequency.setTargetAtTime(230 + s * 9 + throttle * 120, t, 0.06);
}

function playBump(strength) {
  if (!audioCtx) return;
  var k = Math.max(0.15, Math.min(1, strength === undefined ? 0.6 : strength));
  var buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.18), audioCtx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < d.length; i++) { var t = i / audioCtx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 28) * 0.9; }
  var src = audioCtx.createBufferSource(); src.buffer = buf;
  var filt = audioCtx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 160 + 120 * k;
  var g = audioCtx.createGain(); g.gain.value = 0.55 * k;
  src.connect(filt); filt.connect(g); g.connect(audioCtx.destination); src.start();
}

function playPedHit() {
  if (!audioCtx) return;
  var o = audioCtx.createOscillator(), g = audioCtx.createGain(), dist = audioCtx.createWaveShaper();
  var curve = new Float32Array(256); for (var i = 0; i < 256; i++) { var x = i * 2 / 256 - 1; curve[i] = x * (3 + 80 * Math.abs(x) * Math.abs(x)) / (3 + 80 * 0.5); }
  dist.curve = curve;
  o.type = 'sawtooth'; o.frequency.value = 320 + Math.random() * 80;
  g.gain.value = 0.0001;
  o.connect(dist); dist.connect(g); g.connect(audioCtx.destination);
  var t = audioCtx.currentTime;
  g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.18);
  o.start(); o.stop(t + 0.2);
}

function playPunch() {
  if (!audioCtx) return;
  var buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.1), audioCtx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < d.length; i++) { var t = i / audioCtx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 45); }
  var src = audioCtx.createBufferSource(); src.buffer = buf;
  var f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
  var g = audioCtx.createGain(); g.gain.value = 0.5;
  src.connect(f); f.connect(g); g.connect(audioCtx.destination); src.start();
  playTone(110, 0.1, 'sine', 0.08);
}

function playKissSound() {
  if (!audioCtx) return;
  var buf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.12), audioCtx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < d.length; i++) { var t = i / audioCtx.sampleRate; d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * t / 0.12) * 0.4; }
  var src = audioCtx.createBufferSource(); src.buffer = buf;
  var filt = audioCtx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 2;
  var g = audioCtx.createGain(); g.gain.value = 0.18;
  src.connect(filt); filt.connect(g); g.connect(audioCtx.destination); src.start();
}

function startSiren() {
  if (!audioCtx || sirenOn) return; sirenOn = true;
  sirenOsc = audioCtx.createOscillator(); sirenGain = audioCtx.createGain(); sirenLFO = audioCtx.createOscillator();
  var lfoGain = audioCtx.createGain();
  sirenLFO.frequency.value = 0.9; lfoGain.gain.value = 220;
  sirenOsc.type = 'sawtooth'; sirenOsc.frequency.value = 660;
  sirenGain.gain.value = 0.05;
  var filt = audioCtx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 800; filt.Q.value = 1.2;
  sirenLFO.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
  sirenOsc.connect(filt); filt.connect(sirenGain); sirenGain.connect(audioCtx.destination);
  sirenOsc.start(); sirenLFO.start();
}
function stopSiren() {
  if (!sirenOn) return; sirenOn = false;
  try { sirenOsc.stop(); sirenLFO.stop(); } catch (e) {}
  sirenOsc = null; sirenGain = null; sirenLFO = null;
}
function setSirenVolume(v) { if (sirenGain && audioCtx) sirenGain.gain.setTargetAtTime(0.05 * v, audioCtx.currentTime, 0.1); }

function startClubMusic() {
  if (!audioCtx || clubMusicOn) return; clubMusicOn = true;
  clubMusicOsc = audioCtx.createOscillator(); clubMusicGain = audioCtx.createGain();
  clubMusicOsc.type = 'sawtooth'; clubMusicOsc.frequency.value = 55;
  var filt = audioCtx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 180;
  clubMusicGain.gain.value = 0.09;
  clubMusicOsc.connect(filt); filt.connect(clubMusicGain); clubMusicGain.connect(audioCtx.destination);
  clubMusicOsc.start();
  var bpm = 128, beatLen = 60 / bpm, step = 0;
  clubBeatInterval = setInterval(function () {
    if (!clubMusicOn || !audioCtx) return;
    step++;
    if (clubMusicOsc) clubMusicOsc.frequency.setValueAtTime([55, 55, 65.4, 49][(step >> 2) & 3], audioCtx.currentTime);
    var o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.value = 90; g.gain.value = 0.0001;
    o.connect(g); g.connect(audioCtx.destination);
    var t = audioCtx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.12);
    o.start(); o.stop(t + 0.14);
    var hBuf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.04), audioCtx.sampleRate);
    var hd = hBuf.getChannelData(0); for (var i = 0; i < hd.length; i++) hd[i] = Math.random() * 2 - 1;
    var hs = audioCtx.createBufferSource(); hs.buffer = hBuf;
    var hf = audioCtx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 8000;
    var hg = audioCtx.createGain(); hg.gain.value = 0.05;
    hs.connect(hf); hf.connect(hg); hg.connect(audioCtx.destination); hs.start();
  }, beatLen * 1000);
}
function stopClubMusic() {
  if (!clubMusicOn) return; clubMusicOn = false;
  try { clubMusicOsc.stop(); } catch (e) {}
  clubMusicOsc = null; clubMusicGain = null;
  if (clubBeatInterval) { clearInterval(clubBeatInterval); clubBeatInterval = null; }
}

function playClubEntry() {
  if (!audioCtx) return;
  var o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = 'sawtooth'; o.frequency.value = 110; g.gain.value = 0.0001;
  o.connect(g); g.connect(audioCtx.destination);
  var t = audioCtx.currentTime;
  g.gain.exponentialRampToValueAtTime(0.1, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.frequency.exponentialRampToValueAtTime(440, t + 0.5);
  o.start(); o.stop(t + 0.65);
}
function playAlarm() { playTone(880, 0.1, 'square', 0.06); setTimeout(function () { playTone(660, 0.1, 'square', 0.06); }, 130); setTimeout(function () { playTone(880, 0.1, 'square', 0.06); }, 260); }
function playCoin() { playTone(660, 0.08, 'sine', 0.06); setTimeout(function () { playTone(990, 0.12, 'sine', 0.06); }, 80); }
