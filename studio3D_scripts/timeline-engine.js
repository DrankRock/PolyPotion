// ============================================================
// timeline-engine.js — TIMELINE  (TimelineEngine)
// Non-linear animation for characters. Lay the character's clips out on a
// timeline as segments — each with trim in/out, speed, and a crossfade into
// the next — scrub and play the result, then BAKE the whole performance
// into one new animation clip and export the GLB with it.
// Clips can also be borrowed from OTHER files: load a second GLB/FBX and
// its clips retarget onto the cast skeleton by bone name.
// Evaluation is manual (per-frame action time + weight, mixer.update(0)),
// which is what makes scrubbing and baking exact.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';
import { fetchAssetBuffer } from './chunk-loader.js';

const FPS = 30;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const normBone = (s) => String(s).toLowerCase().replace(/^mixamorig:?/, '').replace(/[\s_\-.:]+/g, '');

export class TimelineEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    const vpBg = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };
    this.scene.background = new THREE.Color(vpBg());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(vpBg()); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.02, 100);
    this.camera.position.set(1.4, 1.3, 3);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.9, 0);

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(2.4, 4.2, 3.0); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.5); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.holder = new THREE.Group(); this.scene.add(this.holder);

    this.modelName = ''; this.hasChar = false;
    this.root = null; this.mixer = null;
    this.clips = [];              // [{ name, clip, action, source }]
    this.segments = [];           // [{ id, clipIndex, dur, in, speed, fade }]
    this.time = 0; this.playing = false; this.loop = true;

    this.onStatus = null; this.onState = null; this.onTick = null;
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader();
    this._clock = new THREE.Clock();

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__tlEngine = this;
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

  async _parse(buf, ext) {
    if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); return { obj: g.scene, anims: g.animations || [] }; }
    if (ext === 'fbx') { const o = this._fbx.parse(buf, ''); return { obj: o, anims: o.animations || [] }; }
    throw new Error('Timeline needs .glb or .fbx');
  }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || 'model') + '…');
    const { obj, anims } = await this._parse(buf, ext);
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    obj.traverse(o => { if (o.isMesh) o.frustumCulled = false; });
    this.holder.add(obj);
    this.root = obj;
    this.mixer = new THREE.AnimationMixer(obj);
    this.clips = [];
    anims.forEach(c => this._addClip(c, 'own'));

    // frame
    const box = new THREE.Box3().setFromObject(this.holder);
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.y, s.z) * 0.5 || 1;
    this.camera.near = Math.max(r / 200, 1e-4); this.camera.far = r * 60; this.camera.updateProjectionMatrix();
    this.controls.target.copy(c);
    this.camera.position.set(c.x + r * 1.1, c.y + r * 0.5, c.z + r * 2.5);
    this.scene.remove(this.grid);
    const gs = Math.max(2, Math.ceil(r * 6));
    this.grid = new THREE.GridHelper(gs, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.segments = [];
    if (this.clips.length) this.addSegment(0);
    this.modelName = name || 'model'; this.hasChar = true;
    this.time = 0;
    this._status(''); this._state();
    return { name: this.modelName, clips: this.clips.map(c => c.name) };
  }

  _addClip(clip, source) {
    const action = this.mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = true;
    action.play(); action.weight = 0; action.paused = true;
    this.clips.push({ name: clip.name || ('clip ' + (this.clips.length + 1)), clip, action, source: source || 'own' });
  }

  // borrow clips from another file; retarget tracks by normalized bone name
  async borrowClips(buf, ext, name) {
    if (!this.hasChar) throw new Error('Cast a character first');
    this._status('Borrowing clips from ' + name + '…');
    const { anims } = await this._parse(buf, ext);
    if (!anims.length) { this._status(''); throw new Error('No clips inside ' + name); }
    // map of normalized bone names on OUR skeleton
    const ours = new Map();
    this.root.traverse(o => { if (o.isBone || o.isObject3D) ours.set(normBone(o.name), o.name); });
    let brought = 0;
    anims.forEach(clip => {
      const tracks = [];
      clip.tracks.forEach(t => {
        const dot = t.name.lastIndexOf('.');
        const node = t.name.slice(0, dot), prop = t.name.slice(dot);
        const target = ours.get(normBone(node));
        if (target) { const nt = t.clone(); nt.name = target + prop; tracks.push(nt); }
      });
      if (tracks.length > 2) {
        const nc = new THREE.AnimationClip((clip.name || 'clip') + ' (' + name.replace(/\.\w+$/, '') + ')', clip.duration, tracks);
        this._addClip(nc, 'borrowed');
        brought++;
      }
    });
    this._status(''); this._state();
    if (!brought) throw new Error('No tracks matched this skeleton — different bone names');
    return brought;
  }

  // -------------------------------------------------- segments
  addSegment(clipIndex) {
    const c = this.clips[clipIndex]; if (!c) return;
    this.segments.push({
      id: Date.now() + Math.random(), clipIndex,
      in: 0, dur: Math.min(c.clip.duration, 8) || 2, speed: 1,
      fade: this.segments.length ? 0.35 : 0,
    });
    this._state();
  }
  removeSegment(i) { this.segments.splice(i, 1); this._state(); }
  moveSegment(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= this.segments.length) return;
    [this.segments[i], this.segments[j]] = [this.segments[j], this.segments[i]];
    this._state();
  }
  totalDur() {
    // fades overlap the previous segment, so subtract them
    let t = 0;
    this.segments.forEach((s, i) => { t += s.dur - (i > 0 ? Math.min(s.fade, s.dur) : 0); });
    return Math.max(0, t);
  }
  segStart(i) {
    let t = 0;
    for (let k = 0; k < i; k++) t += this.segments[k].dur - (k > 0 ? Math.min(this.segments[k].fade, this.segments[k].dur) : 0);
    if (i > 0) t -= Math.min(this.segments[i].fade, this.segments[i].dur);
    return Math.max(0, t);
  }

  // evaluate the pose at global time t
  evaluate(t) {
    if (!this.mixer || !this.segments.length) return;
    // zero all weights
    this.clips.forEach(c => { c.action.weight = 0; });
    const weights = new Map();   // clipIndex -> {w, time}
    for (let i = 0; i < this.segments.length; i++) {
      const s = this.segments[i], st = this.segStart(i), en = st + s.dur;
      if (t < st || t > en) continue;
      const local = (t - st);
      let w = 1;
      const f = Math.min(s.fade, s.dur);
      if (i > 0 && f > 0 && local < f) w = local / f;                       // fading in
      const nxt = this.segments[i + 1];
      if (nxt) {
        const nf = Math.min(nxt.fade, nxt.dur);
        const nst = this.segStart(i + 1);
        if (nf > 0 && t > nst) w = Math.min(w, 1 - (t - nst) / nf);          // fading out
      }
      const c = this.clips[s.clipIndex]; if (!c) continue;
      const clipT = (s.in + local * s.speed) % Math.max(1e-4, c.clip.duration);
      const cur = weights.get(s.clipIndex);
      if (!cur || w > cur.w) weights.set(s.clipIndex, { w: clamp(w, 0, 1), time: clipT });
    }
    weights.forEach((v, ci) => {
      const a = this.clips[ci].action;
      a.weight = v.w; a.time = v.time; a.paused = false;
    });
    this.mixer.update(0);
    this.clips.forEach(c => { c.action.paused = true; });
  }

  seek(t) { this.time = clamp(t, 0, this.totalDur()); this.evaluate(this.time); if (this.onTick) this.onTick(this.time); }
  play() { if (!this.segments.length) return; if (this.time >= this.totalDur() - 1e-3) this.time = 0; this.playing = true; this._state(); }
  pause() { this.playing = false; this._state(); }

  // -------------------------------------------------- bake + export
  bake() {
    if (!this.segments.length || !this.root) return null;
    const dur = this.totalDur(), frames = Math.max(2, Math.ceil(dur * FPS) + 1);
    // collect animated nodes from all used clips
    const nodeSet = new Set();
    this.segments.forEach(s => {
      const c = this.clips[s.clipIndex]; if (!c) return;
      c.clip.tracks.forEach(t => nodeSet.add(t.name.slice(0, t.name.lastIndexOf('.'))));
    });
    const nodes = [];
    nodeSet.forEach(n => { const o = this.root.getObjectByName(n); if (o) nodes.push(o); });
    if (!nodes.length) return null;

    const times = new Float32Array(frames);
    const data = nodes.map(() => ({ q: new Float32Array(frames * 4), p: new Float32Array(frames * 3) }));
    for (let f = 0; f < frames; f++) {
      const t = Math.min(dur, f / FPS);
      times[f] = t;
      this.evaluate(t);
      for (let ni = 0; ni < nodes.length; ni++) {
        const o = nodes[ni], d = data[ni];
        d.q[f * 4] = o.quaternion.x; d.q[f * 4 + 1] = o.quaternion.y; d.q[f * 4 + 2] = o.quaternion.z; d.q[f * 4 + 3] = o.quaternion.w;
        d.p[f * 3] = o.position.x; d.p[f * 3 + 1] = o.position.y; d.p[f * 3 + 2] = o.position.z;
      }
    }
    const tracks = [];
    for (let ni = 0; ni < nodes.length; ni++) {
      tracks.push(new THREE.QuaternionKeyframeTrack(nodes[ni].name + '.quaternion', times, data[ni].q));
      tracks.push(new THREE.VectorKeyframeTrack(nodes[ni].name + '.position', times, data[ni].p));
    }
    return new THREE.AnimationClip('timeline_mix', dur, tracks);
  }

  exportGLB(bakedOnly) {
    const clip = this.bake();
    if (!clip) return Promise.reject(new Error('Nothing to bake'));
    const anims = bakedOnly ? [clip] : (this.clips.filter(c => c.source === 'own').map(c => c.clip).concat([clip]));
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
    const dt = this._clock.getDelta();
    if (this.playing) {
      this.time += dt;
      const end = this.totalDur();
      if (this.time >= end) {
        if (this.loop) this.time = 0;
        else { this.time = end; this.playing = false; this._state(); }
      }
      this.evaluate(this.time);
      if (this.onTick) this.onTick(this.time);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
  dispose() { this._run = false; this._ro.disconnect(); this.renderer.dispose(); }
}
