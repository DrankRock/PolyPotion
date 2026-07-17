// ============================================================
// lipsync-engine.js — LIPSYNC  (LipsyncEngine)
// Give your character a voice. Load a rigged/morphed character, then an
// audio take (file or microphone). The engine decodes the audio ON-DEVICE,
// extracts a 30fps envelope (RMS → mouth-open, zero-crossing rate → wide/
// round shape), and drives the character three possible ways, best first:
//   1. viseme / mouth morph targets found on the mesh (viseme_aa, jawOpen,
//      mouthOpen, A/E/I/O/U, ARKit names …)
//   2. a jaw BONE found in the skeleton (rotated open)
//   3. a procedural jaw-open morph built on the fly from the head region
//      (head-bone height when rigged, top of the bbox otherwise)
// Preview plays audio + mouth in sync; export bakes a THREE.AnimationClip
// (morph-influence or bone-rotation tracks) into the GLB, so the take
// plays in Showcase / Director / any glTF viewer.
// ============================================================
import * as THREE from 'three';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { fetchAssetBuffer } from './chunk-loader.js';

const FPS = 30;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

// name → role guesses, checked lowercase without separators
const OPEN_NAMES = ['viseme_aa', 'visemeaa', 'jawopen', 'mouthopen', 'aa', 'a', 'ah', 'mouth_a', 'vrc.v_aa', 'open'];
const WIDE_NAMES = ['viseme_ih', 'visemeih', 'mouthsmile', 'ee', 'e', 'i', 'ih', 'mouth_e', 'vrc.v_ih', 'wide', 'smile'];
const ROUND_NAMES = ['viseme_ou', 'visemeou', 'mouthpucker', 'oo', 'o', 'u', 'ou', 'mouth_o', 'vrc.v_ou', 'round', 'pucker'];
const norm = (s) => String(s).toLowerCase().replace(/[\s_\-.]+/g, '');

export class LipsyncEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    const vpBg = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };
    this.scene.background = new THREE.Color(vpBg());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(vpBg()); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(32, 1, 0.02, 100);
    this.camera.position.set(0.4, 1.5, 1.6);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(1.6, 3.2, 3.0); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.5); rim.position.set(-2.4, 2.0, -2.2); this.scene.add(rim);

    this.grid = new THREE.GridHelper(6, 16, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.45; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.holder = new THREE.Group(); this.scene.add(this.holder);

    this.modelName = ''; this.hasChar = false;
    this.driver = null;            // { kind:'morph'|'bone'|'proc', ... }
    this.morphNames = [];          // all morph names on the driven mesh
    this.map = { open: -1, wide: -1, round: -1 };   // morph indices per role
    this.gain = 1.6; this.smooth = 0.35; this.jawMax = 0.35; // radians for bone
    this.headNod = true;

    this.audioBuf = null; this.env = null; this.zcr = null; this.audioName = '';
    this.playing = false; this._audioEl = null; this._audioUrl = null;

    this.onStatus = null; this.onState = null; this.onTick = null;
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader();
    this._clock = new THREE.Clock();

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__lsEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _state() { if (this.onState) this.onState(); }

  // -------------------------------------------------- character
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
    else throw new Error('Lipsync needs a .glb or .fbx character');

    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    obj.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    this.holder.add(obj);
    this.animations = anims;
    this.root = obj;

    this._findDriver(obj);
    this._frameFace();
    this.modelName = name || 'model'; this.hasChar = true;
    this._status(''); this._state();
    return { name: this.modelName, driver: this.driverInfo() };
  }

  _findDriver(obj) {
    // gather candidates
    let bestMorphMesh = null, jawBone = null, headBone = null, biggest = null;
    obj.traverse(o => {
      if (o.isMesh && o.geometry && o.geometry.attributes.position) {
        if (!biggest || o.geometry.attributes.position.count > biggest.geometry.attributes.position.count) biggest = o;
        if (o.morphTargetDictionary && Object.keys(o.morphTargetDictionary).length) {
          if (!bestMorphMesh || Object.keys(o.morphTargetDictionary).length > Object.keys(bestMorphMesh.morphTargetDictionary).length) bestMorphMesh = o;
        }
      }
      if (o.isBone) {
        const n = norm(o.name);
        if (!jawBone && (n.includes('jaw') || n.endsWith('chin'))) jawBone = o;
        if (!headBone && /(^|[^a-z])head$|^head/.test(n)) headBone = o;
        if (!headBone && n.includes('head') && !n.includes('top')) headBone = o;
      }
    });
    this.headBone = headBone || null;
    this.map = { open: -1, wide: -1, round: -1 };
    this.morphNames = [];

    if (bestMorphMesh) {
      const dict = bestMorphMesh.morphTargetDictionary;
      this.morphNames = Object.keys(dict);
      const find = (list) => {
        for (const cand of list) { for (const k of this.morphNames) { if (norm(k) === cand) return dict[k]; } }
        for (const cand of list) { for (const k of this.morphNames) { if (norm(k).includes(cand) && cand.length > 2) return dict[k]; } }
        return -1;
      };
      const open = find(OPEN_NAMES);
      if (open >= 0) {
        this.map = { open, wide: find(WIDE_NAMES), round: find(ROUND_NAMES) };
        this.driver = { kind: 'morph', mesh: bestMorphMesh };
        return;
      }
    }
    if (jawBone) {
      this.driver = { kind: 'bone', bone: jawBone, rest: jawBone.quaternion.clone() };
      return;
    }
    // procedural fallback: build a jaw-open morph on the biggest mesh
    if (biggest) { this._buildProcJaw(biggest, headBone); return; }
    this.driver = null;
  }

  _buildProcJaw(mesh, headBone) {
    const geo = mesh.geometry, pos = geo.attributes.position, n = pos.count;
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromBufferAttribute(pos);
    const size = box.getSize(new THREE.Vector3());
    // head region: above head bone (local approximation) or top 14% of mesh
    let headY0 = box.min.y + size.y * 0.86, headY1 = box.max.y;
    if (headBone) {
      const hw = new THREE.Vector3(); headBone.getWorldPosition(hw);
      const lw = mesh.worldToLocal(hw.clone());
      if (lw.y > box.min.y && lw.y < box.max.y) { headY0 = lw.y; headY1 = Math.min(box.max.y, lw.y + size.y * 0.2); }
    }
    const headH = Math.max(1e-6, headY1 - headY0);
    // z center of the head slab, to find the front half
    let zc = 0, cnt = 0;
    for (let i = 0; i < n; i++) { const y = pos.getY(i); if (y >= headY0 && y <= headY1) { zc += pos.getZ(i); cnt++; } }
    zc = cnt ? zc / cnt : 0;
    if (!cnt) { this.driver = null; return; }

    const delta = new Float32Array(n * 3);
    const drop = headH * 0.22;
    for (let i = 0; i < n; i++) {
      const y = pos.getY(i);
      if (y < headY0 || y > headY1) continue;
      const ty = (y - headY0) / headH;                    // 0 chin .. 1 crown
      if (ty > 0.42) continue;                            // lower part of head only
      if (pos.getZ(i) < zc) continue;                     // front half only
      const w = (0.42 - ty) / 0.42;
      delta[i * 3 + 1] = -drop * w;
      delta[i * 3 + 2] = drop * 0.25 * w;
    }
    const attr = new THREE.Float32BufferAttribute(delta, 3);
    if (!geo.morphAttributes.position) geo.morphAttributes.position = [];
    geo.morphAttributesRelative = true; geo.morphTargetsRelative = true;
    geo.morphAttributes.position.push(attr);
    const idx = geo.morphAttributes.position.length - 1;
    mesh.morphTargetDictionary = mesh.morphTargetDictionary || {};
    mesh.morphTargetDictionary['jawOpen (lipsync)'] = idx;
    mesh.morphTargetInfluences = mesh.morphTargetInfluences || [];
    while (mesh.morphTargetInfluences.length <= idx) mesh.morphTargetInfluences.push(0);
    this.morphNames = Object.keys(mesh.morphTargetDictionary);
    this.map = { open: idx, wide: -1, round: -1 };
    this.driver = { kind: 'proc', mesh };
  }

  driverInfo() {
    if (!this.driver) return { kind: 'none', label: 'no mouth found' };
    if (this.driver.kind === 'morph') return { kind: 'morph', label: 'viseme morphs', names: this.morphNames, map: this.map };
    if (this.driver.kind === 'bone') return { kind: 'bone', label: 'jaw bone “' + this.driver.bone.name + '”' };
    return { kind: 'proc', label: 'procedural jaw (built on the fly)', names: this.morphNames, map: this.map };
  }
  setMap(role, morphIndex) { this.map[role] = morphIndex; }

  _frameFace() {
    const box = new THREE.Box3().setFromObject(this.holder);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const full = s.y > Math.max(s.x, s.z) * 1.9;      // looks like a full body
    const fy = full ? box.min.y + s.y * 0.88 : c.y;
    const r = full ? s.y * 0.16 : Math.max(s.x, s.y, s.z) * 0.62;
    this.camera.near = Math.max(r / 100, 1e-4); this.camera.far = r * 80; this.camera.updateProjectionMatrix();
    this.controls.target.set(c.x, fy, c.z);
    this.camera.position.set(c.x + r * 0.5, fy + r * 0.14, c.z + r * 2.2);
    this.controls.minDistance = r * 0.4; this.controls.maxDistance = r * 14;
  }
  frameBody() {
    const box = new THREE.Box3().setFromObject(this.holder);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.y, s.z) * 0.5 || 1;
    this.controls.target.copy(c);
    this.camera.position.set(c.x + r * 0.9, c.y + r * 0.4, c.z + r * 2.6);
  }
  frameFace() { this._frameFace(); }

  // -------------------------------------------------- audio
  async loadAudioFile(file) { return this._ingestAudio(await file.arrayBuffer(), file.name); }
  async loadAudioBlob(blob, name) { return this._ingestAudio(await blob.arrayBuffer(), name); }

  async _ingestAudio(buf, name) {
    this._status('Decoding audio…');
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    ctx.close();
    this.audioBuf = audio; this.audioName = name || 'take';
    this._analyze();
    if (this._audioUrl) URL.revokeObjectURL(this._audioUrl);
    this._audioUrl = URL.createObjectURL(new Blob([buf], { type: 'audio/*' }));
    if (this._audioEl) { this._audioEl.pause(); }
    this._audioEl = new Audio(this._audioUrl);
    this._audioEl.addEventListener('ended', () => { this.playing = false; this._resetMouth(); this._state(); });
    this._status(''); this._state();
    return { name: this.audioName, dur: audio.duration };
  }

  _analyze() {
    const a = this.audioBuf, data = a.getChannelData(0), sr = a.sampleRate;
    const frames = Math.max(1, Math.ceil(a.duration * FPS));
    const win = Math.floor(sr / FPS);
    const env = new Float32Array(frames), zcr = new Float32Array(frames);
    let peak = 1e-6;
    for (let f = 0; f < frames; f++) {
      const s0 = f * win, s1 = Math.min(data.length, s0 + win);
      let sum = 0, zc = 0;
      for (let i = s0 + 1; i < s1; i++) {
        const v = data[i]; sum += v * v;
        if ((v >= 0) !== (data[i - 1] >= 0)) zc++;
      }
      const nsamp = Math.max(1, s1 - s0);
      env[f] = Math.sqrt(sum / nsamp);
      zcr[f] = zc / nsamp;                      // 0..~0.5
      if (env[f] > peak) peak = env[f];
    }
    // normalize + noise gate
    const gate = peak * 0.06;
    for (let f = 0; f < frames; f++) env[f] = env[f] < gate ? 0 : (env[f] - gate) / (peak - gate);
    this.env = env; this.zcr = zcr;
  }

  // sample smoothed mouth values at time t (seconds)
  mouthAt(t, prev) {
    if (!this.env) return { open: 0, wide: 0, round: 0 };
    const f = clamp(Math.floor(t * FPS), 0, this.env.length - 1);
    const raw = clamp(this.env[f] * this.gain, 0, 1);
    const z = this.zcr[f];
    // attack fast, release by smoothing
    const k = prev !== undefined && raw < prev ? (1 - this.smooth * 0.9) : 0.85;
    const open = prev === undefined ? raw : prev + (raw - prev) * k;
    const wide = clamp((z - 0.06) * 9, 0, 1) * open;       // fricatives/vowels 'ee'
    const round = clamp((0.05 - z) * 22, 0, 1) * open;     // low ZCR → rounded 'oo'
    return { open, wide, round };
  }

  applyMouth(m) {
    if (!this.driver) return;
    if (this.driver.kind === 'bone') {
      const b = this.driver.bone;
      b.quaternion.copy(this.driver.rest);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), m.open * this.jawMax);
      b.quaternion.multiply(q);
    } else {
      const mesh = this.driver.mesh, inf = mesh.morphTargetInfluences;
      if (this.map.open >= 0) inf[this.map.open] = m.open;
      if (this.map.wide >= 0) inf[this.map.wide] = m.wide * 0.7;
      if (this.map.round >= 0) inf[this.map.round] = m.round * 0.8;
    }
    if (this.headNod && this.headBone) {
      if (!this._headRest) this._headRest = this.headBone.quaternion.clone();
      this.headBone.quaternion.copy(this._headRest);
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), m.open * 0.035);
      this.headBone.quaternion.multiply(q);
    }
  }
  _resetMouth() { this.applyMouth({ open: 0, wide: 0, round: 0 }); this._prev = undefined; }

  play() {
    if (!this._audioEl || !this.env) return;
    this._audioEl.currentTime = 0; this._prev = undefined;
    this._audioEl.play(); this.playing = true; this._state();
  }
  stop() { if (this._audioEl) this._audioEl.pause(); this.playing = false; this._resetMouth(); this._state(); }

  // -------------------------------------------------- bake + export
  bakeClip() {
    if (!this.env || !this.driver) return null;
    const frames = this.env.length, times = new Float32Array(frames);
    let prev;
    const opens = new Float32Array(frames), wides = new Float32Array(frames), rounds = new Float32Array(frames);
    for (let f = 0; f < frames; f++) {
      times[f] = f / FPS;
      const m = this.mouthAt(f / FPS, prev); prev = m.open;
      opens[f] = m.open; wides[f] = m.wide * 0.7; rounds[f] = m.round * 0.8;
    }
    const tracks = [];
    if (this.driver.kind === 'bone') {
      const b = this.driver.bone, rest = this.driver.rest;
      const vals = new Float32Array(frames * 4), q = new THREE.Quaternion(), ax = new THREE.Vector3(1, 0, 0);
      for (let f = 0; f < frames; f++) {
        q.setFromAxisAngle(ax, opens[f] * this.jawMax).premultiply(rest);
        vals[f * 4] = q.x; vals[f * 4 + 1] = q.y; vals[f * 4 + 2] = q.z; vals[f * 4 + 3] = q.w;
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(b.name + '.quaternion', times, vals));
    } else {
      const mesh = this.driver.mesh, nInf = mesh.morphTargetInfluences.length;
      const vals = new Float32Array(frames * nInf);
      for (let f = 0; f < frames; f++) {
        for (let i = 0; i < nInf; i++) vals[f * nInf + i] = mesh.morphTargetInfluences[i] * 0; // start silent
        if (this.map.open >= 0) vals[f * nInf + this.map.open] = opens[f];
        if (this.map.wide >= 0) vals[f * nInf + this.map.wide] = wides[f];
        if (this.map.round >= 0) vals[f * nInf + this.map.round] = rounds[f];
      }
      tracks.push(new THREE.NumberKeyframeTrack(mesh.name + '.morphTargetInfluences', times, vals));
    }
    const base = (this.audioName || 'take').replace(/\.\w+$/, '');
    return new THREE.AnimationClip('lipsync_' + base, this.env.length / FPS, tracks);
  }

  exportGLB() {
    const clip = this.bakeClip();
    const anims = (this.animations || []).slice();
    if (clip) anims.push(clip);
    this._resetMouth();
    const exp = new GLTFExporter();
    return new Promise((res, rej) => exp.parse(this.root, r => res(r), e => rej(e), { binary: true, animations: anims }));
  }

  // -------------------------------------------------- loop
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return;
    if (this.playing && this._audioEl && this.env) {
      const t = this._audioEl.currentTime;
      const m = this.mouthAt(t, this._prev);
      this._prev = m.open;
      this.applyMouth(m);
      if (this.onTick) this.onTick(t, this.audioBuf ? this.audioBuf.duration : 0, m.open);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
  dispose() { this._run = false; this._ro.disconnect(); this.renderer.dispose(); if (this._audioUrl) URL.revokeObjectURL(this._audioUrl); }
}
