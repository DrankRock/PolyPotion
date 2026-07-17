// ============================================================
// director-engine.js — DIRECTOR (camera sequencer + video render-out)
// Load a character (GLB/FBX/OBJ), pick one of its animation clips, then cut
// a sequence of camera shots — orbit, push-in, arc, low rise, close-up,
// still — each with its own duration and easing. Scrub it, play it, and
// record the whole sequence off the live canvas to a .webm video.
// All framing is computed from the model's bounding box, so the same
// sequence works on any character. Loaded by Director.dc.html.
// ============================================================
import * as THREE from 'three';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { fetchAssetBuffer } from './chunk-loader.js';

const EASE = {
  linear: (t) => t,
  'ease in-out': (t) => t * t * (3 - 2 * t),
  'ease in': (t) => t * t,
  'ease out': (t) => 1 - (1 - t) * (1 - t),
};

// Camera moves. Each returns { pos:Vector3, look:Vector3 } for u ∈ [0,1],
// given center c, radius r, height h (bbox), and the shot's seed variance.
export const MOVES = {
  orbit:   { name: 'Orbit',    desc: '360° sweep at eye level' },
  arc:     { name: 'Arc',      desc: 'quarter sweep, drifting up' },
  push:    { name: 'Push-in',  desc: 'slow dolly toward the chest' },
  pull:    { name: 'Pull-out', desc: 'retreat and reveal' },
  rise:    { name: 'Low rise', desc: 'hero shot from the floor up' },
  closeup: { name: 'Close-up', desc: 'tight on the head, slow drift' },
  still:   { name: 'Still',    desc: 'locked three-quarter view' },
};

function moveCam(move, u, c, r, h, dir) {
  const p = new THREE.Vector3(), look = c.clone();
  const s = dir || 1;
  if (move === 'orbit') {
    const a = -0.6 + u * Math.PI * 2 * s;
    p.set(c.x + Math.sin(a) * r * 2.6, c.y + h * 0.12, c.z + Math.cos(a) * r * 2.6);
  } else if (move === 'arc') {
    const a = (-0.7 + u * 1.5) * s;
    p.set(c.x + Math.sin(a) * r * 2.5, c.y - h * 0.1 + u * h * 0.45, c.z + Math.cos(a) * r * 2.5);
  } else if (move === 'push') {
    const d = 3.4 - u * 1.9;
    p.set(c.x + r * 0.5 * s, c.y + h * 0.1, c.z + r * d);
    look.y = c.y + h * 0.15;
  } else if (move === 'pull') {
    const d = 1.5 + u * 2.1;
    p.set(c.x - r * 0.4 * s, c.y + h * 0.08 + u * h * 0.2, c.z + r * d);
  } else if (move === 'rise') {
    p.set(c.x + r * (0.7 - u * 0.4) * s, c.y - h * 0.42 + u * h * 0.85, c.z + r * (2.4 - u * 0.3));
    look.y = c.y + (u - 0.35) * h * 0.3;
  } else if (move === 'closeup') {
    const a = (-0.35 + u * 0.7) * s;
    const hy = c.y + h * 0.33;
    p.set(c.x + Math.sin(a) * r * 1.15, hy + h * 0.02, c.z + Math.cos(a) * r * 1.15);
    look.y = hy;
  } else { // still
    p.set(c.x + r * 1.7 * s, c.y + h * 0.14, c.z + r * 2.1);
  }
  return { pos: p, look };
}

export class DirectorEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    const vpBg = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };
    this.scene.background = new THREE.Color(vpBg());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(vpBg()); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.02, 200);
    this.camera.position.set(1.2, 1.3, 3);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.9, 0);

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 0.95));
    const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(2.4, 4.2, 3.0); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.55); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.holder = new THREE.Group(); this.scene.add(this.holder);
    this.mixer = null; this.action = null; this.clips = []; this.clipIndex = -1;
    this.clipSpeed = 1;
    this.modelName = ''; this.hasChar = false;
    this.center = new THREE.Vector3(0, 0.9, 0); this.radius = 1; this.height = 1.8;

    this.shots = []; this.time = 0; this.playing = false;
    this.freeCam = true;            // orbit controls until sequence drives camera
    this.onTick = null; this.onState = null; this.onStatus = null;

    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();
    this._clock = new THREE.Clock();
    this._rec = null; this._recChunks = [];

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__dirEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _state() { if (this.onState) this.onState(); }

  // -------------------------------------------------- loading
  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts);
    return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop());
  }
  async loadFile(file) { return this._ingest(await file.arrayBuffer(), (file.name.split('.').pop() || '').toLowerCase(), file.name); }
  async loadBuffer(buf, name, ext) { return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name); }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || 'model') + '…');
    let obj, anims = [];
    if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); obj = g.scene; anims = g.animations || []; }
    else if (ext === 'fbx') { obj = this._fbx.parse(buf, ''); anims = obj.animations || []; }
    else if (ext === 'obj') { obj = this._obj.parse(new TextDecoder().decode(buf)); }
    else throw new Error('Unsupported format .' + ext);

    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    obj.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    this.holder.add(obj);

    // frame the model
    const box = new THREE.Box3().setFromObject(this.holder);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    this.center = c; this.radius = Math.max(s.x, s.z) * 0.5 || 0.5; this.height = s.y || 1;
    const R = Math.max(s.x, s.y, s.z) * 0.5 || 1;
    this.camera.near = Math.max(R / 200, 1e-4); this.camera.far = R * 60; this.camera.updateProjectionMatrix();
    this.controls.target.copy(c);
    this.camera.position.set(c.x + R * 1.1, c.y + R * 0.5, c.z + R * 2.4);
    this.scene.remove(this.grid);
    const gs = Math.max(2, Math.ceil(R * 6));
    this.grid = new THREE.GridHelper(gs, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.clips = anims; this.mixer = anims.length ? new THREE.AnimationMixer(obj) : null;
    this.action = null; this.clipIndex = -1;
    if (anims.length) this.setClip(0);
    this.modelName = name || 'model'; this.hasChar = true;
    this._status('');
    this._state();
    return { name: this.modelName, clips: anims.map(a => a.name) };
  }

  setClip(i) {
    if (!this.mixer) return;
    if (this.action) { this.action.stop(); this.action = null; }
    this.clipIndex = i;
    if (i >= 0 && this.clips[i]) {
      this.action = this.mixer.clipAction(this.clips[i]);
      this.action.setLoop(THREE.LoopRepeat, Infinity);
      this.action.play();
    }
    this._state();
  }
  setClipSpeed(v) { this.clipSpeed = v; }

  // -------------------------------------------------- sequence
  setShots(shots) { this.shots = shots || []; }
  totalDur() { return this.shots.reduce((a, s) => a + (s.dur || 0), 0); }

  shotAt(t) {
    let acc = 0;
    for (let i = 0; i < this.shots.length; i++) {
      const s = this.shots[i];
      if (t < acc + s.dur || i === this.shots.length - 1) return { shot: s, u: Math.min(1, Math.max(0, (t - acc) / (s.dur || 1e-6))), index: i };
      acc += s.dur;
    }
    return null;
  }

  applyCamera(t) {
    const hit = this.shotAt(t);
    if (!hit) return;
    const e = EASE[hit.shot.ease] || EASE['ease in-out'];
    const { pos, look } = moveCam(hit.shot.move, e(hit.u), this.center, this.radius, this.height, hit.shot.dir || 1);
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
    return hit.index;
  }

  seek(t) {
    this.time = Math.min(this.totalDur(), Math.max(0, t));
    this.freeCam = false;
    this.applyCamera(this.time);
    if (this.onTick) this.onTick(this.time, false);
  }
  play() { if (!this.shots.length) return; if (this.time >= this.totalDur() - 1e-3) this.time = 0; this.playing = true; this.freeCam = false; this._state(); }
  pause() { this.playing = false; this._state(); }
  release() { this.freeCam = true; this.controls.target.copy(this.center); this._state(); }

  // -------------------------------------------------- record
  record(scale) {
    return new Promise((resolve, reject) => {
      if (!this.shots.length) return reject(new Error('Add at least one shot'));
      const prevPR = this.renderer.getPixelRatio();
      this.renderer.setPixelRatio(scale || 2);
      this.resize();
      const stream = this.canvas.captureStream(60);
      let mime = 'video/webm;codecs=vp9';
      if (!('MediaRecorder' in window)) return reject(new Error('Recording not supported in this browser'));
      if (!MediaRecorder.isTypeSupported(mime)) mime = 'video/webm';
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14_000_000 });
      this._recChunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) this._recChunks.push(e.data); };
      rec.onstop = () => {
        this.renderer.setPixelRatio(prevPR); this.resize();
        this._rec = null;
        resolve(new Blob(this._recChunks, { type: 'video/webm' }));
      };
      rec.onerror = (e) => { this.renderer.setPixelRatio(prevPR); this.resize(); this._rec = null; reject(e.error || new Error('Recorder error')); };
      this._rec = rec;
      this.time = 0; this.freeCam = false;
      if (this.mixer && this.action) { this.mixer.setTime(0); }
      rec.start(200);
      this.playing = true;
      this._recording = true;
      this._state();
    });
  }
  isRecording() { return !!this._rec; }
  _finishRec() { this._recording = false; this.playing = false; if (this._rec && this._rec.state !== 'inactive') this._rec.stop(); this._state(); }
  cancelRecord() { if (this._rec) { this._recChunks = []; this._finishRec(); } }

  // -------------------------------------------------- loop
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return;
    const dt = this._clock.getDelta();
    if (this.mixer && this.playing) this.mixer.update(dt * this.clipSpeed);
    else if (this.mixer && this.freeCam) this.mixer.update(dt * this.clipSpeed);
    if (this.playing) {
      this.time += dt;
      const end = this.totalDur();
      if (this.time >= end) {
        this.time = end;
        if (this._recording) this._finishRec();
        else { this.playing = false; this._state(); }
      }
      this.applyCamera(this.time);
      if (this.onTick) this.onTick(this.time, true);
    }
    if (this.freeCam) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
  dispose() { this._run = false; this._ro.disconnect(); this.renderer.dispose(); }
}
