// ============================================================
// morph-engine.js — MORPH  (MorphEngine)
// A blendshape / morph-target editor. Characters need faces: this makes the
// expression shapes (blink, smile, jaw-open, brows, visemes) that a body rig
// can't. You:
//   • create a morph target, then SCULPT it — grab / inflate / smooth brushes
//   • drive every morph live with a slider (they stack)
//   • X-symmetry mirrors your edits across the face
//   • import morph targets already in the file, and export them back to GLB
// Editing keeps its own working-position buffer (base + Σ influence·delta) so
// multiple morphs preview together without touching the base mesh. On export
// the deltas become real glTF morph targets. Imported from Morph.dc.html.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { fetchAssetBuffer } from './chunk-loader.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';

const themeViewport = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

export class MorphEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(themeViewport());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(themeViewport()); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    this.camera.position.set(0, 1.5, 1.4);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 1.5, 0);
    this.controls.minDistance = 0.15; this.controls.maxDistance = 8;

    this.scene.add(new THREE.HemisphereLight(0xdfe7f2, 0x22262c, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(1.6, 3.0, 2.4); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffe9cf, 0.4); fill.position.set(-2, 1, 1); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x9fb4de, 0.5); rim.position.set(0, 1.5, -3); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.35; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.root = new THREE.Group(); this.scene.add(this.root);

    this.mesh = null; this.base = null; this.work = null;   // Float32Array positions
    this.morphs = []; this.active = -1; this.modelName = ''; this.modelRadius = 1; this.modelCenter = new THREE.Vector3();
    this.brush = { mode: 'grab', radius: 0.14, strength: 0.6 };
    this.symmetry = true; this.painting = false;
    this._nb = null; this._weld = null; this._group = null; this._mirror = null;

    this.onStatus = null; this.onChange = null; this.onLoaded = null;
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader();
    this._ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2();

    const ringGeo = new THREE.RingGeometry(0.97, 1.0, 40);
    this._ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
    this._ring.renderOrder = 999; this._ring.visible = false; this.scene.add(this._ring);

    this._bindPointer();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return !!this.mesh; }

  // ---------------------------------------------------------- LOADING
  async loadUrl(url, ext, opts) { const buf = await fetchAssetBuffer(url, opts); return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop()); }
  async loadFile(file) { return this._ingest(await file.arrayBuffer(), (file.name.split('.').pop() || '').toLowerCase(), file.name); }
  async loadBuffer(buf, name, ext) { return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name); }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || ext) + '…');
    let obj;
    if (ext === 'fbx') obj = this._fbx.parse(buf, '');
    else if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); obj = g.scene || (g.scenes && g.scenes[0]); }
    else throw new Error('Unsupported .' + ext);
    this._clear();
    obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
    obj.updateMatrixWorld(true);

    // pick the mesh with the most vertices (usually the head/body)
    let best = null;
    obj.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry) { const c = o.geometry.attributes.position.count; if (!best || c > best.geometry.attributes.position.count) best = o; } });
    if (!best) throw new Error('No mesh in file');

    // bake to world, non-indexed-safe but keep index for adjacency
    let g = best.geometry.clone();
    g.applyMatrix4(best.matrixWorld);
    if (!g.attributes.normal) g.computeVertexNormals();

    // normalize to ~1.8 tall, feet at 0
    const box = new THREE.Box3().setFromBufferAttribute(g.attributes.position);
    const size = box.getSize(new THREE.Vector3()); const s = 1.8 / (size.y || 1);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, minY = box.min.y;
    const nm = new THREE.Matrix4().makeTranslation(-cx * s, -minY * s, -cz * s).multiply(new THREE.Matrix4().makeScale(s, s, s));
    g.applyMatrix4(nm); g.computeVertexNormals();

    const pos = g.attributes.position; const n = pos.count;
    this.base = new Float32Array(pos.array); this.work = new Float32Array(pos.array);

    // import existing morph targets (relative or absolute)
    this.morphs = [];
    const mp = g.morphAttributes && g.morphAttributes.position;
    if (mp && mp.length) {
      const rel = g.morphTargetsRelative;
      const dict = best.morphTargetDictionary || {};
      const nameOf = (i) => { for (const k in dict) if (dict[k] === i) return k; return 'morph' + (i + 1); };
      mp.forEach((attr, i) => {
        const delta = new Float32Array(n * 3);
        for (let v = 0; v < n; v++) { const dx = attr.getX(v), dy = attr.getY(v), dz = attr.getZ(v); if (rel) { delta[v * 3] = dx; delta[v * 3 + 1] = dy; delta[v * 3 + 2] = dz; } else { delta[v * 3] = dx - this.base[v * 3]; delta[v * 3 + 1] = dy - this.base[v * 3 + 1]; delta[v * 3 + 2] = dz - this.base[v * 3 + 2]; } }
        // scale deltas by the same normalization scale
        for (let k = 0; k < delta.length; k++) delta[k] *= s;
        this.morphs.push({ name: nameOf(i), delta, influence: (best.morphTargetInfluences && best.morphTargetInfluences[i]) || 0 });
      });
    }

    // clean display geometry (no morphAttributes; we drive positions ourselves)
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(this.work, 3));
    dg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(g.attributes.normal.array), 3));
    if (g.attributes.uv) dg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.uv.array), 2));
    if (g.index) dg.setIndex(new THREE.BufferAttribute(new (g.index.array.constructor)(g.index.array), 1));
    const mat = new THREE.MeshStandardMaterial({ color: 0xd9cfc4, roughness: 0.62, metalness: 0.0, side: THREE.DoubleSide, flatShading: false });
    this.mesh = new THREE.Mesh(dg, mat); this.root.add(this.mesh);

    const b2 = new THREE.Box3().setFromBufferAttribute(dg.attributes.position);
    this.modelCenter = b2.getCenter(new THREE.Vector3()); this.modelRadius = b2.getSize(new THREE.Vector3()).y || 1.8;
    this.modelName = (name || 'character').replace(/\.(glb|gltf|fbx)$/i, '');

    this._buildAdjacency(dg); this._buildMirror();
    this.active = this.morphs.length ? 0 : -1;
    this.recompute(); this._frameHead();
    this._status(''); this._changed(); if (this.onLoaded) this.onLoaded();
    return this.stats();
  }

  _buildAdjacency(g) {
    const pos = g.attributes.position; const n = pos.count; const q = 1e4; const map = new Map(); const weld = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = Math.round(pos.getX(i) * q) + '_' + Math.round(pos.getY(i) * q) + '_' + Math.round(pos.getZ(i) * q); let id = map.get(k); if (id === undefined) { id = i; map.set(k, i); } weld[i] = id; }
    const nb = new Map(); const add = (a, b) => { if (a === b) return; let s = nb.get(a); if (!s) { s = new Set(); nb.set(a, s); } s.add(b); };
    const idx = g.index ? g.index.array : null; const tri = (a, b, c) => { const A = weld[a], B = weld[b], C = weld[c]; add(A, B); add(B, C); add(C, A); };
    if (idx) for (let i = 0; i < idx.length; i += 3) tri(idx[i], idx[i + 1], idx[i + 2]); else for (let i = 0; i < n; i += 3) tri(i, i + 1, i + 2);
    const group = new Map(); for (let i = 0; i < n; i++) { const w = weld[i]; let s = group.get(w); if (!s) { s = []; group.set(w, s); } s.push(i); }
    this._weld = weld; this._nb = nb; this._group = group;
  }
  _buildMirror() {
    const n = this.base.length / 3; const q = 220; const byKey = new Map(); const mir = new Int32Array(n).fill(-1);
    for (let i = 0; i < n; i++) { const k = Math.round(this.base[i * 3] * q) + '_' + Math.round(this.base[i * 3 + 1] * q) + '_' + Math.round(this.base[i * 3 + 2] * q); byKey.set(k, i); }
    for (let i = 0; i < n; i++) { const k = Math.round(-this.base[i * 3] * q) + '_' + Math.round(this.base[i * 3 + 1] * q) + '_' + Math.round(this.base[i * 3 + 2] * q); const j = byKey.get(k); if (j !== undefined) mir[i] = j; }
    this._mirror = mir;
  }

  // ---------------------------------------------------------- COMPUTE
  recompute() {
    if (!this.mesh) return;
    const n = this.base.length; const work = this.work; work.set(this.base);
    for (let m = 0; m < this.morphs.length; m++) {
      const mo = this.morphs[m]; const inf = (m === this.active && this.painting) ? Math.max(mo.influence, 1) : mo.influence;
      if (inf <= 0) continue; const d = mo.delta;
      for (let k = 0; k < n; k++) work[k] += inf * d[k];
    }
    const g = this.mesh.geometry; g.attributes.position.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  }

  // ---------------------------------------------------------- MORPHS
  addMorph(name) { const n = this.base.length; this.morphs.push({ name: name || ('Morph ' + (this.morphs.length + 1)), delta: new Float32Array(n), influence: 1 }); this.active = this.morphs.length - 1; this.recompute(); this._changed(); return this.active; }
  removeMorph(i) { if (i < 0 || i >= this.morphs.length) return; this.morphs.splice(i, 1); if (this.active >= this.morphs.length) this.active = this.morphs.length - 1; this.recompute(); this._changed(); }
  renameMorph(i, name) { if (this.morphs[i]) { this.morphs[i].name = name; this._changed(); } }
  setActive(i) { this.active = i; this._changed(); }
  setInfluence(i, v) { if (this.morphs[i]) { this.morphs[i].influence = clamp(v, -1, 1.5); this.recompute(); this._changed(); } }
  resetMorph(i) { if (this.morphs[i]) { this.morphs[i].delta.fill(0); this.recompute(); this._changed(); } }

  // seed a morph from a coarse facial region (approximate, fully editable after)
  seedRegion(kind) {
    if (this.active < 0) this.addMorph(kind);
    const d = this.morphs[this.active].delta; const b = this.base; const n = b.length / 3;
    const box = new THREE.Box3(); const v = new THREE.Vector3();
    for (let i = 0; i < n; i++) box.expandByPoint(v.set(b[i * 3], b[i * 3 + 1], b[i * 3 + 2]));
    const min = box.min, size = box.getSize(new THREE.Vector3()); const amt = size.y * 0.05;
    for (let i = 0; i < n; i++) {
      const y = b[i * 3 + 1], z = b[i * 3 + 2]; const ty = (y - min.y) / (size.y || 1); const front = z > box.getCenter(new THREE.Vector3()).z;
      let dx = 0, dy = 0, dz = 0;
      if (kind === 'jaw') { if (ty < 0.4 && front) { const w = (0.4 - ty) / 0.4; dy -= amt * w * 1.4; dz += amt * w * 0.4; } }
      else if (kind === 'brows') { if (ty > 0.72 && ty < 0.92 && front) { const w = 1 - Math.abs(ty - 0.82) / 0.1; dy += amt * w; } }
      else if (kind === 'smile') { const cx = Math.abs(b[i * 3]); if (ty > 0.42 && ty < 0.58 && front && cx > size.x * 0.08) { const w = 1 - Math.abs(ty - 0.5) / 0.08; dy += amt * w * 0.8; dx += (b[i * 3] > 0 ? 1 : -1) * amt * w * 0.4; } }
      else if (kind === 'inflate') { const nx = b[i * 3] - box.getCenter(v).x; dx += nx * 0.04; }
      d[i * 3] += dx; d[i * 3 + 1] += dy; d[i * 3 + 2] += dz;
    }
    this.recompute(); this._changed();
  }

  // ---------------------------------------------------------- SCULPT
  _bindPointer() {
    const c = this.canvas;
    const toNdc = e => { const r = c.getBoundingClientRect(); this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    c.addEventListener('pointermove', e => { toNdc(e); const hit = this._raycast(); this._updateRing(hit); if (this.painting && this._drag) this._stroke(e, hit); });
    c.addEventListener('pointerdown', e => {
      if (e.button !== 0 || this.active < 0) return; toNdc(e); const hit = this._raycast(); if (!hit) return; e.preventDefault();
      this.painting = true; this.controls.enableRotate = false; c.style.cursor = 'grabbing'; this._pushUndo();
      const n = this.camera.getWorldDirection(new THREE.Vector3());
      this._drag = { plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, hit.point), last: hit.point.clone(), center: hit.point.clone(), normal: hit.face ? hit.face.normal.clone().transformDirection(this.mesh.matrixWorld) : n.clone().negate() };
      this.recompute();
    });
    window.addEventListener('pointerup', () => { if (this.painting) { this.painting = false; this._drag = null; this.controls.enableRotate = true; this.canvas.style.cursor = 'default'; this.recompute(); this._changed(); } });
    c.addEventListener('wheel', e => { if (e.shiftKey) { e.preventDefault(); this.brush.radius = clamp(this.brush.radius + (e.deltaY < 0 ? 0.01 : -0.01), 0.02, 0.6); this._changed(); } }, { passive: false });
  }
  _raycast() { if (!this.mesh) return null; this._ray.setFromCamera(this._ndc, this.camera); const h = this._ray.intersectObject(this.mesh, false); return h.length ? { point: h[0].point, face: h[0].face } : null; }
  _updateRing(hit) { if (!hit) { this._ring.visible = false; return; } this._ring.visible = true; this._ring.position.copy(hit.point); const nrm = hit.face ? hit.face.normal.clone().transformDirection(this.mesh.matrixWorld) : this.camera.getWorldDirection(new THREE.Vector3()).negate(); this._ring.lookAt(hit.point.clone().add(nrm)); this._ring.scale.setScalar(this.brush.radius); const cm = { grab: 0x8fd0ff, inflate: 0x9be08a, smooth: 0xffd27a }; this._ring.material.color.setHex(cm[this.brush.mode] || 0x8fd0ff); }

  _stroke(e, hit) {
    const d = this._drag; if (!d || this.active < 0) return;
    const R = this.brush.radius * this.modelRadius; const R2 = R * R;
    const delta = this.morphs[this.active].delta; const work = this.work; const b = this.base;
    const n = b.length / 3;
    const pen = e && e.pointerType === 'pen' && e.pressure > 0;
    const str = this.brush.strength * (pen ? Math.max(0.05, e.pressure) : 1);
    const cx = d.center.x, cy = d.center.y, cz = d.center.z;

    if (this.brush.mode === 'grab') {
      const p = new THREE.Vector3(); this._ray.setFromCamera(this._ndc, this.camera); if (!this._ray.ray.intersectPlane(d.plane, p)) return;
      const mv = p.clone().sub(d.last); d.last.copy(p);
      for (let i = 0; i < n; i++) { const dx = work[i * 3] - cx, dy = work[i * 3 + 1] - cy, dz = work[i * 3 + 2] - cz; const dist2 = dx * dx + dy * dy + dz * dz; if (dist2 > R2) continue; const f = this._falloff(Math.sqrt(dist2) / R); delta[i * 3] += mv.x * f; delta[i * 3 + 1] += mv.y * f; delta[i * 3 + 2] += mv.z * f; }
      d.center.add(mv.multiplyScalar(0.5));
    } else if (this.brush.mode === 'inflate') {
      const dir = d.normal; const amt = R * 0.04 * str * (e.shiftKey ? -1 : 1);
      for (let i = 0; i < n; i++) { const dx = work[i * 3] - cx, dy = work[i * 3 + 1] - cy, dz = work[i * 3 + 2] - cz; const dist2 = dx * dx + dy * dy + dz * dz; if (dist2 > R2) continue; const f = this._falloff(Math.sqrt(dist2) / R); delta[i * 3] += dir.x * amt * f; delta[i * 3 + 1] += dir.y * amt * f; delta[i * 3 + 2] += dir.z * amt * f; }
    } else if (this.brush.mode === 'smooth') {
      const touched = [];
      for (let i = 0; i < n; i++) { const dx = work[i * 3] - cx, dy = work[i * 3 + 1] - cy, dz = work[i * 3 + 2] - cz; const dist2 = dx * dx + dy * dy + dz * dz; if (dist2 <= R2) touched.push([i, Math.sqrt(dist2)]); }
      const upd = [];
      for (const [i, dd] of touched) { const wid = this._weld[i]; const nb = this._nb.get(wid); let ax = delta[i * 3], ay = delta[i * 3 + 1], az = delta[i * 3 + 2], c = 1; if (nb) nb.forEach(o => { const raw = this._group.get(o); if (raw) { ax += delta[raw[0] * 3]; ay += delta[raw[0] * 3 + 1]; az += delta[raw[0] * 3 + 2]; c++; } }); const f = this._falloff(dd / R) * str; upd.push([i, ax / c, ay / c, az / c, f]); }
      for (const [i, ax, ay, az, f] of upd) { delta[i * 3] += (ax - delta[i * 3]) * f; delta[i * 3 + 1] += (ay - delta[i * 3 + 1]) * f; delta[i * 3 + 2] += (az - delta[i * 3 + 2]) * f; }
    }

    if (this.symmetry && this._mirror) this._applyMirror(delta);
    this.recompute();
  }
  _applyMirror(delta) {
    // reflect the just-edited deltas across X onto their mirror verts
    const mir = this._mirror; const n = mir.length;
    for (let i = 0; i < n; i++) { const j = mir[i]; if (j < 0 || j === i) continue; if (this.base[i * 3] >= 0) { delta[j * 3] = -delta[i * 3]; delta[j * 3 + 1] = delta[i * 3 + 1]; delta[j * 3 + 2] = delta[i * 3 + 2]; } }
  }
  _falloff(t) { t = clamp(t, 0, 1); const s = 1 - t; return s * s * (3 - 2 * s); }

  _pushUndo() { if (this.active < 0) return; this._undo = this._undo || []; this._undo.push({ i: this.active, delta: new Float32Array(this.morphs[this.active].delta) }); if (this._undo.length > 20) this._undo.shift(); }
  undo() { if (!this._undo || !this._undo.length) return false; const u = this._undo.pop(); if (this.morphs[u.i]) { this.morphs[u.i].delta.set(u.delta); this.active = u.i; this.recompute(); this._changed(); return true; } return false; }

  // ---------------------------------------------------------- EXPORT
  async exportGLB() {
    if (!this.mesh) throw new Error('Nothing to export');
    const g = this.mesh.geometry.clone();
    // set positions back to base, attach morph targets as relative deltas
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.base), 3));
    g.morphAttributes.position = this.morphs.map(m => new THREE.BufferAttribute(new Float32Array(m.delta), 3));
    g.morphTargetsRelative = true;
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xd9cfc4, roughness: 0.62, side: THREE.DoubleSide }));
    mesh.morphTargetInfluences = this.morphs.map(m => m.influence);
    mesh.morphTargetDictionary = {}; this.morphs.forEach((m, i) => mesh.morphTargetDictionary[m.name] = i);
    mesh.name = this.modelName || 'morphed';
    const exporter = new GLTFExporter();
    const glb = await new Promise((res, rej) => exporter.parse(mesh, res, rej, { binary: true }));
    return glb instanceof ArrayBuffer ? glb : new Uint8Array(glb).buffer;
  }

  // ---------------------------------------------------------- VIEW
  setBrush(patch) { Object.assign(this.brush, patch || {}); }
  setSymmetry(on) { this.symmetry = !!on; }
  morphList() { return this.morphs.map((m, i) => ({ index: i, name: m.name, influence: m.influence, active: i === this.active })); }
  _frameHead() {
    // frame the top third (the face) if this looks like a full body, else whole
    const b2 = new THREE.Box3().setFromBufferAttribute(this.mesh.geometry.attributes.position);
    const size = b2.getSize(new THREE.Vector3());
    const tall = size.y > size.x * 1.6;
    const c = b2.getCenter(new THREE.Vector3());
    const focusY = tall ? b2.max.y - size.y * 0.12 : c.y;
    const r = tall ? size.y * 0.18 : Math.max(size.x, size.y) * 0.6;
    this.controls.target.set(c.x, focusY, c.z); this.camera.position.set(c.x, focusY, c.z + r * 3.2); this.controls.update();
  }
  frameAll() { const b2 = new THREE.Box3().setFromBufferAttribute(this.mesh.geometry.attributes.position); const c = b2.getCenter(new THREE.Vector3()); const s = b2.getSize(new THREE.Vector3()); this.controls.target.copy(c); this.camera.position.set(c.x, c.y, c.z + Math.max(s.x, s.y) * 2.2); this.controls.update(); }
  setView(name) { const b2 = new THREE.Box3().setFromBufferAttribute(this.mesh.geometry.attributes.position); const c = this.controls.target.clone(); const d = this.camera.position.distanceTo(c); const set = (x, y, z) => this.camera.position.set(c.x + x, c.y + y, c.z + z); if (name === 'front') set(0, 0, d); else if (name === 'side') set(d, 0, 0); else if (name === 'three') set(d * 0.6, 0, d * 0.8); else set(0, 0, d); this.controls.update(); }
  stats() { return { name: this.modelName, morphs: this.morphs.length, active: this.active, verts: this.mesh ? this.base.length / 3 : 0 }; }
  _clear() { if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh = null; } this.morphs = []; this.active = -1; this._undo = []; }
  resize() { const el = this.canvas.parentElement || this.canvas; const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  _loop() { if (!this._run) return; requestAnimationFrame(this._loop); this.controls.update(); this.renderer.render(this.scene, this.camera); }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

export default MorphEngine;
