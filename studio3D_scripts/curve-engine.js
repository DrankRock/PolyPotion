// ============================================================
// curve-engine.js — CURVES  (CurveEngine)
// An animation curve / dope-sheet editor with onion skinning. Retargeted or
// captured motion gets you keys; this is where you HAND-EDIT them:
//   • scrub the timeline, play / loop, set the loop in–out (trim a take)
//   • pick a bone track + channel and edit its F-curve — drag keyframes in
//     time & value, double-click to add a key, right-click to delete
//   • onion skinning ghosts the pose a few frames before (cool) and after
//     (warm) so you can feel the arc while you key
// Drives a WebGL viewport and a 2D curve canvas (both passed in). Loaded by
// dynamic import from Curves.dc.html.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { applyOrbitScheme } from './nav-scheme.js';
import { fetchAssetBuffer } from './chunk-loader.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'https://esm.sh/three@0.160.0/examples/jsm/utils/SkeletonUtils.js';

const themeViewport = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };
const themeVar = (n, f) => { const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || f; };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

export class CurveEngine {
  constructor(glCanvas, curveCanvas) {
    this.canvas = glCanvas; this.cc = curveCanvas; this.cx = curveCanvas.getContext('2d');
    this.renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(themeViewport());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(themeViewport()); this._drawCurves(); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    this.camera.position.set(0.4, 1.1, 3.4);
    this.controls = new OrbitControls(this.camera, glCanvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09; this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.5; this.controls.maxDistance = 12;

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(2.4, 4.2, 3.0); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.45); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);
    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e); this.grid.material.opacity = 0.45; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.ghosts = new THREE.Group(); this.scene.add(this.ghosts);

    this.model = null; this.mixer = null; this.action = null; this.clips = []; this.clipIndex = -1;
    this.modelName = ''; this.time = 0; this.playing = false; this.fps = 30;
    this.loopMode = 'loop'; this.inT = 0; this.outT = 1;
    this.onion = { on: false, count: 2, step: 3 }; this._ghostList = [];
    this.tracks = []; this.selTrack = -1; this.selComps = [true]; this.selKey = null;
    this.showSkel = false; this.skelHelper = null;

    // curve view transform
    this.vx = { min: 0, max: 1 }; this.vy = { min: -1, max: 1 };
    this.onStatus = null; this.onChange = null; this.onLoaded = null; this.onTime = null;

    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader();
    this._clock = new THREE.Clock();

    this._bindCurve();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(glCanvas.parentElement || glCanvas);
    this._roc = new ResizeObserver(() => { this._sizeCurve(); this._drawCurves(); }); this._roc.observe(curveCanvas.parentElement || curveCanvas);
    this.resize(); this._sizeCurve();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return !!this.model; }

  // ---------------------------------------------------------- LOADING
  async loadUrl(url, ext, opts) { const buf = await fetchAssetBuffer(url, opts); return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop()); }
  async loadFile(file) { return this._ingest(await file.arrayBuffer(), (file.name.split('.').pop() || '').toLowerCase(), file.name); }
  async loadBuffer(buf, name, ext) { return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name); }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || ext) + '…');
    let obj, anims = [];
    if (ext === 'fbx') { obj = this._fbx.parse(buf, ''); anims = obj.animations || []; }
    else if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); obj = g.scene || (g.scenes && g.scenes[0]); anims = g.animations || obj.animations || []; }
    else throw new Error('Unsupported .' + ext);
    this._clear();

    obj.updateMatrixWorld(true);
    // normalize scale
    const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3()); const s = 1.8 / (size.y || 1);
    obj.scale.setScalar(s); obj.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(obj); const c = b2.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y; obj.updateMatrixWorld(true);
    obj.traverse(o => { if (o.isMesh || o.isSkinnedMesh) o.frustumCulled = false; });

    this.root.add(obj); this.model = obj; this.modelName = (name || 'clip').replace(/\.(glb|gltf|fbx)$/i, '');
    this.clips = anims.slice();
    this.mixer = new THREE.AnimationMixer(obj);

    this.skelHelper = new THREE.SkeletonHelper(obj); this.skelHelper.material.transparent = true; this.skelHelper.material.opacity = 0.5; this.skelHelper.visible = this.showSkel; this.scene.add(this.skelHelper);

    this._frame();
    if (this.clips.length) this.selectClip(0); else { this._status(''); this._changed(); }
    if (!this.clips.length) throw new Error('No animation clips in this file — Curves edits existing motion. Retarget one in MoCap first.');
    this._status(''); this._changed(); if (this.onLoaded) this.onLoaded();
    return this.stats();
  }

  // ---------------------------------------------------------- CLIP
  selectClip(i) {
    const clip = this.clips[i]; if (!clip) return;
    if (this.action) this.action.stop();
    this.clipIndex = i;
    this.action = this.mixer.clipAction(clip); this.action.play(); this.action.paused = true;
    this.inT = 0; this.outT = clip.duration || 1; this.time = 0;
    this._buildTracks(clip);
    this.selTrack = this.tracks.length ? 0 : -1; this.selComps = this.selTrack >= 0 ? this.tracks[0].comps.map((_, k) => k === 0) : [];
    this._fitCurveView();
    this._seek(0); this._buildGhosts();
    this._changed();
  }
  _buildTracks(clip) {
    this.tracks = clip.tracks.map((tr, i) => {
      const dot = tr.name.lastIndexOf('.'); const node = tr.name.slice(0, dot); const prop = tr.name.slice(dot + 1);
      const stride = tr.getValueSize();
      const labelsByProp = { quaternion: ['x', 'y', 'z', 'w'], position: ['x', 'y', 'z'], scale: ['x', 'y', 'z'] };
      const comps = (labelsByProp[prop] || Array.from({ length: stride }, (_, k) => '' + k)).slice(0, stride);
      return { index: i, name: tr.name, node: node.replace(/mixamorig\d*/gi, '').replace(/^.*[:/]/, '') || node, prop, stride, comps, track: tr };
    });
  }

  // ---------------------------------------------------------- PLAYBACK
  play() { this.playing = true; if (this.action) this.action.paused = false; this._clock.getDelta(); }
  pause() { this.playing = false; if (this.action) this.action.paused = true; }
  toggle() { this.playing ? this.pause() : this.play(); }
  seek(t) { this.pause(); this._seek(t); }
  _seek(t) {
    const dur = this._dur(); this.time = clamp(t, 0, dur);
    if (this.mixer) { this.mixer.setTime(0); this.mixer.update(this.time); }  // absolute
    this._updateGhosts();
    if (this.onTime) this.onTime(this.time, dur);
    this._drawCurves();
  }
  _dur() { const clip = this.clips[this.clipIndex]; return clip ? clip.duration : 1; }

  setLoop(mode) { this.loopMode = mode; if (this.action) { this.action.loop = mode === 'once' ? THREE.LoopOnce : THREE.LoopRepeat; this.action.clampWhenFinished = mode === 'once'; } }
  setRange(inT, outT) { this.inT = clamp(inT, 0, this._dur()); this.outT = clamp(outT, this.inT + 0.01, this._dur()); this._drawCurves(); this._changed(); }
  // crop the clip to [in,out] (destructive on the clip copy)
  trimToRange() {
    const clip = this.clips[this.clipIndex]; if (!clip) return;
    this.pushUndo();
    const inT = this.inT, outT = this.outT;
    clip.tracks.forEach(tr => {
      const times = tr.times, vs = tr.getValueSize(); const nt = [], nv = [];
      // sample boundary values so cropping keeps the endpoints
      const sampleAt = (time) => { const out = new Array(vs); this._sampleTrack(tr, time, out); return out; };
      const startV = sampleAt(inT), endV = sampleAt(outT);
      nt.push(0); for (let k = 0; k < vs; k++) nv.push(startV[k]);
      for (let i = 0; i < times.length; i++) { const t = times[i]; if (t > inT && t < outT) { nt.push(t - inT); for (let k = 0; k < vs; k++) nv.push(tr.values[i * vs + k]); } }
      nt.push(outT - inT); for (let k = 0; k < vs; k++) nv.push(endV[k]);
      tr.times = new Float32Array(nt); tr.values = new Float32Array(nv);
    });
    clip.duration = outT - inT; clip.resetDuration();
    this.action.stop(); this.action = this.mixer.clipAction(clip); this.action.play(); this.action.paused = true;
    this.inT = 0; this.outT = clip.duration; this._buildTracks(clip); this._fitCurveView(); this._seek(0); this._changed();
  }
  _sampleTrack(tr, time, out) {
    const times = tr.times, vs = tr.getValueSize(), vals = tr.values; const n = times.length;
    if (time <= times[0]) { for (let k = 0; k < vs; k++) out[k] = vals[k]; return; }
    if (time >= times[n - 1]) { for (let k = 0; k < vs; k++) out[k] = vals[(n - 1) * vs + k]; return; }
    let i = 0; while (i < n - 1 && times[i + 1] < time) i++;
    const t0 = times[i], t1 = times[i + 1]; const a = (time - t0) / (t1 - t0 || 1);
    if (tr.name.endsWith('.quaternion')) { const qa = new THREE.Quaternion().fromArray(vals, i * 4), qb = new THREE.Quaternion().fromArray(vals, (i + 1) * 4); qa.slerp(qb, a); qa.toArray(out); }
    else for (let k = 0; k < vs; k++) out[k] = vals[i * vs + k] * (1 - a) + vals[(i + 1) * vs + k] * a;
  }

  // ---------------------------------------------------------- ONION
  setOnion(patch) { Object.assign(this.onion, patch || {}); this._buildGhosts(); this._updateGhosts(); this._changed(); }
  _buildGhosts() {
    this._ghostList.forEach(g => { this.ghosts.remove(g.obj); }); this._ghostList = [];
    this.ghosts.clear();
    if (!this.onion.on || !this.model) return;
    const n = this.onion.count;
    for (let side = -1; side <= 1; side += 2) {
      for (let k = 1; k <= n; k++) {
        const g = skeletonClone(this.model);
        const col = side < 0 ? new THREE.Color(0x4d82d6) : new THREE.Color(0xe0853a);
        const op = 0.28 * (1 - (k - 1) / (n + 0.5));
        g.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.frustumCulled = false; const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false }); o.material = m; } });
        const mixer = new THREE.AnimationMixer(g); const act = mixer.clipAction(this.clips[this.clipIndex]); act.play(); act.paused = true;
        this.ghosts.add(g); this._ghostList.push({ obj: g, mixer, side, k });
      }
    }
  }
  _updateGhosts() {
    if (!this.onion.on) return;
    const dt = this.onion.step / this.fps; const dur = this._dur();
    for (const gh of this._ghostList) {
      let t = this.time + gh.side * gh.k * dt; t = ((t % dur) + dur) % dur;
      gh.mixer.setTime(0); gh.mixer.update(t);
    }
  }

  // ---------------------------------------------------------- CURVE CANVAS
  selectTrack(i) { this.selTrack = i; const t = this.tracks[i]; this.selComps = t ? t.comps.map((_, k) => k === 0) : []; this.selKey = null; this._fitCurveView(); this._drawCurves(); this._changed(); }
  toggleComp(k) { if (this.selComps[k] === undefined) return; this.selComps[k] = !this.selComps[k]; this._drawCurves(); this._changed(); }
  _fitCurveView() {
    const tr = this._curTrack(); this.vx = { min: 0, max: this._dur() || 1 };
    if (!tr) { this.vy = { min: -1, max: 1 }; return; }
    let mn = Infinity, mx = -Infinity; const vs = tr.stride; const vals = tr.track.values;
    for (let i = 0; i < vals.length; i++) { mn = Math.min(mn, vals[i]); mx = Math.max(mx, vals[i]); }
    if (!isFinite(mn)) { mn = -1; mx = 1; } if (mx - mn < 1e-4) { mn -= 0.5; mx += 0.5; }
    const pad = (mx - mn) * 0.12; this.vy = { min: mn - pad, max: mx + pad };
  }
  _curTrack() { return this.tracks[this.selTrack] || null; }
  _sizeCurve() { const el = this.cc.parentElement || this.cc; const dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight); this.cc.width = w * dpr; this.cc.height = h * dpr; this.cx.setTransform(dpr, 0, 0, dpr, 0, 0); this._cw = w; this._ch = h; }
  _px(t) { return this._padL + (t - this.vx.min) / (this.vx.max - this.vx.min || 1) * (this._cw - this._padL - this._padR); }
  _py(v) { return this._padT + (1 - (v - this.vy.min) / (this.vy.max - this.vy.min || 1)) * (this._ch - this._padT - this._padB); }
  _tAt(px) { return this.vx.min + (px - this._padL) / (this._cw - this._padL - this._padR || 1) * (this.vx.max - this.vx.min); }
  _vAt(py) { return this.vy.min + (1 - (py - this._padT) / (this._ch - this._padT - this._padB || 1)) * (this.vy.max - this.vy.min); }

  _drawCurves() {
    const cx = this.cx; if (!cx) return; this._padL = 44; this._padR = 12; this._padT = 12; this._padB = 22;
    const W = this._cw, H = this._ch;
    cx.clearRect(0, 0, W, H);
    const bg = themeVar('--panel', '#1a1c22'), grid = themeVar('--seam', '#2a2d34'), txt = themeVar('--text-2', '#9b958a'), acc = themeVar('--accent', '#7c83ff');
    cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
    // grid + value labels
    cx.strokeStyle = grid; cx.fillStyle = txt; cx.font = '9px "Spline Sans Mono",monospace'; cx.lineWidth = 1;
    for (let r = 0; r <= 4; r++) { const v = this.vy.min + (this.vy.max - this.vy.min) * r / 4; const y = this._py(v); cx.globalAlpha = 0.5; cx.beginPath(); cx.moveTo(this._padL, y); cx.lineTo(W - this._padR, y); cx.stroke(); cx.globalAlpha = 1; cx.fillText(v.toFixed(2), 4, y + 3); }
    // in/out range shading
    const xin = this._px(this.inT), xout = this._px(this.outT);
    cx.fillStyle = acc; cx.globalAlpha = 0.08; cx.fillRect(xin, this._padT, xout - xin, H - this._padT - this._padB); cx.globalAlpha = 1;
    cx.strokeStyle = acc; cx.globalAlpha = 0.5; [xin, xout].forEach(x => { cx.beginPath(); cx.moveTo(x, this._padT); cx.lineTo(x, H - this._padB); cx.stroke(); }); cx.globalAlpha = 1;

    const tr = this._curTrack();
    if (tr) {
      const compCols = ['#e0714f', '#6ee08a', '#6bb6d8', '#e0c14f'];
      const times = tr.track.times, vals = tr.track.values, vs = tr.stride;
      for (let c = 0; c < tr.comps.length; c++) {
        if (!this.selComps[c]) continue;
        cx.strokeStyle = compCols[c % 4]; cx.lineWidth = 1.6; cx.beginPath();
        for (let i = 0; i < times.length; i++) { const x = this._px(times[i]), y = this._py(vals[i * vs + c]); if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y); }
        cx.stroke();
        // keys
        for (let i = 0; i < times.length; i++) { const x = this._px(times[i]), y = this._py(vals[i * vs + c]); const sel = this.selKey && this.selKey.comp === c && this.selKey.i === i; cx.fillStyle = sel ? '#fff' : compCols[c % 4]; cx.beginPath(); cx.arc(x, y, sel ? 4.5 : 3, 0, 7); cx.fill(); }
      }
    } else { cx.fillStyle = txt; cx.fillText('Select a track to edit its curve', this._padL + 8, H / 2); }

    // playhead
    const xp = this._px(this.time); cx.strokeStyle = '#fff'; cx.globalAlpha = 0.85; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(xp, 0); cx.lineTo(xp, H - this._padB); cx.stroke(); cx.globalAlpha = 1;
    // time axis
    cx.fillStyle = txt; cx.font = '9px "Spline Sans Mono",monospace';
    const dur = this._dur(); for (let s = 0; s <= 5; s++) { const t = dur * s / 5; cx.fillText(t.toFixed(2) + 's', this._px(t) - 8, H - 6); }
  }

  _bindCurve() {
    const el = this.cc;
    const pos = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const hitKey = (p) => {
      const tr = this._curTrack(); if (!tr) return null; const times = tr.track.times, vals = tr.track.values, vs = tr.stride;
      for (let c = 0; c < tr.comps.length; c++) { if (!this.selComps[c]) continue; for (let i = 0; i < times.length; i++) { const x = this._px(times[i]), y = this._py(vals[i * vs + c]); if (Math.abs(x - p.x) < 6 && Math.abs(y - p.y) < 6) return { comp: c, i }; } }
      return null;
    };
    el.addEventListener('pointerdown', e => {
      const p = pos(e); if (e.button === 2) { const k = hitKey(p); if (k) { this.pushUndo(); this._removeKey(k); } e.preventDefault(); return; }
      // drag in/out handles
      if (Math.abs(p.x - this._px(this.inT)) < 6 && p.y < this._ch - this._padB) { this._dragRange = 'in'; return; }
      if (Math.abs(p.x - this._px(this.outT)) < 6 && p.y < this._ch - this._padB) { this._dragRange = 'out'; return; }
      const k = hitKey(p);
      if (k) { this.pushUndo(); this.selKey = k; this._dragKey = k; this._changed(); this._drawCurves(); }
      else { // scrub
        this._scrubbing = true; this.seek(this._tAt(p.x));
      }
    });
    el.addEventListener('pointermove', e => {
      const p = pos(e);
      if (this._dragRange) { const t = clamp(this._tAt(p.x), 0, this._dur()); if (this._dragRange === 'in') this.setRange(t, this.outT); else this.setRange(this.inT, t); return; }
      if (this._dragKey) { const tr = this._curTrack(); const t = clamp(this._tAt(p.x), 0, this._dur()); const v = this._vAt(p.y); this._moveKey(this._dragKey, t, v); return; }
      if (this._scrubbing) { this.seek(this._tAt(p.x)); }
    });
    window.addEventListener('pointerup', () => { this._dragKey = null; this._dragRange = null; this._scrubbing = false; });
    el.addEventListener('dblclick', e => { const p = pos(e); this.pushUndo(); this._addKeyAt(this._tAt(p.x)); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('wheel', e => { e.preventDefault(); const f = e.deltaY < 0 ? 0.9 : 1.1; const mid = (this.vy.min + this.vy.max) / 2; this.vy = { min: mid + (this.vy.min - mid) * f, max: mid + (this.vy.max - mid) * f }; this._drawCurves(); }, { passive: false });
  }
  _moveKey(k, t, v) {
    const tr = this._curTrack(); if (!tr) return; const vs = tr.stride; const times = tr.track.times.slice(); const vals = tr.track.values.slice();
    times[k.i] = t; vals[k.i * vs + k.comp] = v;
    // re-sort by time if crossed a neighbour
    const order = Array.from(times.keys()).sort((a, b) => times[a] - times[b]);
    const nt = new Float32Array(times.length), nv = new Float32Array(vals.length); let ni = k.i;
    order.forEach((oi, di) => { nt[di] = times[oi]; for (let c = 0; c < vs; c++) nv[di * vs + c] = vals[oi * vs + c]; if (oi === k.i) ni = di; });
    tr.track.times = nt; tr.track.values = nv; this.selKey = { comp: k.comp, i: ni }; this._dragKey = this.selKey;
    this._commitTrack(); this._seek(this.time); this._changed();
  }
  _addKeyAt(t) {
    const tr = this._curTrack(); if (!tr) return; const vs = tr.stride; const out = new Array(vs); this._sampleTrack(tr.track, t, out);
    const times = Array.from(tr.track.times); const vals = Array.from(tr.track.values);
    let ins = times.findIndex(x => x > t); if (ins < 0) ins = times.length;
    times.splice(ins, 0, t); vals.splice(ins * vs, 0, ...out);
    tr.track.times = new Float32Array(times); tr.track.values = new Float32Array(vals);
    this.selKey = { comp: this.selComps.findIndex(Boolean) < 0 ? 0 : this.selComps.findIndex(Boolean), i: ins };
    this._commitTrack(); this._seek(this.time); this._changed();
  }
  _removeKey(k) {
    const tr = this._curTrack(); if (!tr || tr.track.times.length <= 2) return; const vs = tr.stride;
    const times = Array.from(tr.track.times); const vals = Array.from(tr.track.values);
    times.splice(k.i, 1); vals.splice(k.i * vs, vs);
    tr.track.times = new Float32Array(times); tr.track.values = new Float32Array(vals); this.selKey = null;
    this._commitTrack(); this._seek(this.time); this._changed();
  }
  _commitTrack() {
    // rebuild the action so edited tracks take effect
    const clip = this.clips[this.clipIndex]; if (!clip) return;
    const wasT = this.time; this.action.stop(); this.action = this.mixer.clipAction(clip); this.action.play(); this.action.paused = true;
    this._buildGhosts();
  }

  // snapshot-based undo over the current clip's track data
  _snapClip() { const clip = this.clips[this.clipIndex]; if (!clip) return null; return { dur: clip.duration, tracks: clip.tracks.map(tr => ({ times: tr.times.slice(0), values: tr.values.slice(0) })) }; }
  _applyClipSnap(snap) { const clip = this.clips[this.clipIndex]; if (!clip || !snap) return; clip.tracks.forEach((tr, i) => { if (snap.tracks[i]) { tr.times = snap.tracks[i].times.slice(0); tr.values = snap.tracks[i].values.slice(0); } }); clip.duration = snap.dur; clip.resetDuration(); this._buildTracks(clip); this._commitTrack(); this._seek(Math.min(this.time, this._dur())); this._changed(); }
  pushUndo() { const s = this._snapClip(); if (!s) return; this._undo = this._undo || []; this._undo.push(s); if (this._undo.length > 40) this._undo.shift(); this._redo = []; }
  undo() { if (!this._undo || !this._undo.length) return false; this._redo = this._redo || []; this._redo.push(this._snapClip()); this._applyClipSnap(this._undo.pop()); return true; }
  redo() { if (!this._redo || !this._redo.length) return false; this._undo = this._undo || []; this._undo.push(this._snapClip()); this._applyClipSnap(this._redo.pop()); return true; }

  // ---------------------------------------------------------- EXPORT
  currentClip() { return this.clips[this.clipIndex] || null; }

  // ---------------------------------------------------------- VIEW
  setSkeleton(on) { this.showSkel = !!on; if (this.skelHelper) this.skelHelper.visible = on; }
  setFps(f) { this.fps = f || 30; }
  clipList() { return this.clips.map((c, i) => ({ index: i, name: c.name || ('clip ' + (i + 1)), dur: c.duration, tracks: c.tracks.length })); }
  trackList() { return this.tracks.map(t => ({ index: t.index, node: t.node, prop: t.prop, comps: t.comps, keys: t.track.times.length })); }
  compState() { return this.selComps.slice(); }
  setView(name) { const box = new THREE.Box3().setFromObject(this.model); const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()); this.controls.target.copy(c); const d = Math.max(sz.y, sz.x) * 1.9; const set = (x, y, z) => this.camera.position.set(x, y, z); if (name === 'front') set(c.x, c.y, c.z + d); else if (name === 'side') set(c.x + d, c.y, c.z); else if (name === 'back') set(c.x, c.y, c.z - d); else set(c.x + d * 0.25, c.y + sz.y * 0.1, c.z + d); this.controls.update(); }
  _frame() { const box = new THREE.Box3().setFromObject(this.model); const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()); this.controls.target.copy(c); const d = Math.max(sz.y, sz.x) * 1.9; this.camera.position.set(c.x + d * 0.25, c.y + sz.y * 0.1, c.z + d); this.controls.update(); }
  stats() { return { name: this.modelName, clips: this.clips.length, clip: this.clipIndex, dur: this._dur(), tracks: this.tracks.length, time: this.time }; }
  _clear() { if (this.model) { this.root.remove(this.model); this.model = null; } if (this.skelHelper) { this.scene.remove(this.skelHelper); this.skelHelper = null; } this.ghosts.clear(); this._ghostList = []; this.clips = []; this.tracks = []; this.mixer = null; this.action = null; this.clipIndex = -1; this.selTrack = -1; }
  resize() { const el = this.canvas.parentElement || this.canvas; const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  _loop() {
    if (!this._run) return; requestAnimationFrame(this._loop);
    const dt = this._clock.getDelta();
    if (this.playing && this.mixer) {
      let t = this.time + dt; const inT = this.inT, outT = this.outT;
      if (t > outT) { if (this.loopMode === 'once') { t = outT; this.pause(); } else t = inT + (t - outT); }
      this._seek(t);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); this._roc.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

export default CurveEngine;
