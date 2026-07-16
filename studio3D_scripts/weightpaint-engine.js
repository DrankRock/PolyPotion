// ============================================================
// weightpaint-engine.js — WEIGHT PAINT  (WPEngine)
// Hand-paint skin weights on a rigged character. Auto-skinning gets you 90%
// of the way; this fixes the collapsing elbow, the torn skirt, the shoulder
// that drags the chest. You paint in the BIND pose (like every DCC tool):
//   • pick a bone (list or click in the viewport)
//   • brush Add / Subtract / Blur / Set influence onto the surface
//   • per-vertex weights are re-normalized to sum to 1 automatically
//   • Mirror +X → −X copies weights across the body, remapping L/R bones
//   • a blue→red heat-map shows the selected bone's influence live
// Export re-bakes the skinned mesh (updated weights) to GLB and can hand it
// straight back to the studio. Loaded by dynamic import from WeightPaint.dc.html.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { applyOrbitScheme } from './nav-scheme.js';
import { buildMirrorMap, mirrorBonePartners } from './symmetry-map.js';
import { fetchAssetBuffer } from './chunk-loader.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp01 = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
const themeViewport = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };

// blue → cyan → green → yellow → red heat ramp for a 0..1 weight
function heat(w, out) {
  w = clamp01(w);
  let r, g, b;
  if (w < 0.25) { const t = w / 0.25; r = 0.05; g = 0.15 + t * 0.55; b = 0.85; }
  else if (w < 0.5) { const t = (w - 0.25) / 0.25; r = 0.05 + t * 0.1; g = 0.7 + t * 0.25; b = 0.85 - t * 0.75; }
  else if (w < 0.75) { const t = (w - 0.5) / 0.25; r = 0.15 + t * 0.75; g = 0.95 - t * 0.1; b = 0.1; }
  else { const t = (w - 0.75) / 0.25; r = 0.9 + t * 0.1; g = 0.85 - t * 0.7; b = 0.1 - t * 0.05; }
  out[0] = r; out[1] = g; out[2] = b;
}

export class WPEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(themeViewport());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(themeViewport()); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.03, 100);
    this.camera.position.set(0.4, 1.1, 3.2);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.4; this.controls.maxDistance = 12;

    this.scene.add(new THREE.HemisphereLight(0xdfe7f2, 0x22262c, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2.4, 4.2, 3.0); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb4de, 0.4); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.45; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.root = new THREE.Group(); this.scene.add(this.root);

    this.model = null; this.meshes = []; this.mesh = null; // active skinned mesh
    this.bones = []; this.boneName = []; this.selBone = -1;
    this.modelName = ''; this.modelRadius = 1;
    this.showSkel = true; this.skelHelper = null;

    // brush
    this.brush = { mode: 'add', radius: 0.12, strength: 0.5, value: 1.0 };
    this.painting = false; this._space = false;

    // per-mesh caches
    this._adj = null; this._worldPos = null; this._colorAttr = null;
    this.onStatus = null; this.onChange = null; this.onLoaded = null;

    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader();
    this._ray = new THREE.Raycaster();
    this._ndc = new THREE.Vector2();

    // brush ring cursor
    const ringGeo = new THREE.RingGeometry(0.98, 1.0, 48);
    this._ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffcf6b, transparent: true, opacity: 0.85, depthTest: false, side: THREE.DoubleSide }));
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
  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts);
    return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop());
  }
  async loadFile(file) { return this._ingest(await file.arrayBuffer(), (file.name.split('.').pop() || '').toLowerCase(), file.name); }
  async loadBuffer(buf, name, ext) { return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name); }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || ext) + '…');
    let obj;
    if (ext === 'fbx') obj = this._fbx.parse(buf, '');
    else if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); obj = g.scene || (g.scenes && g.scenes[0]); }
    else throw new Error('Unsupported .' + ext + ' — Weight Paint needs a rigged GLB/FBX');
    this._clear();

    obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
    obj.updateMatrixWorld(true);

    const skinned = [];
    obj.traverse(o => { if (o.isSkinnedMesh && o.geometry && o.skeleton) { o.frustumCulled = false; skinned.push(o); } });
    if (!skinned.length) throw new Error('No skinned mesh — this character has no skin weights to paint. Rig it first.');

    // normalize to ~1.8 tall, feet on ground
    const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1); obj.scale.setScalar(s); obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj); const c = box2.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y; obj.updateMatrixWorld(true);

    this.root.add(obj); this.model = obj;
    this.modelName = (name || 'character').replace(/\.(glb|gltf|fbx)$/i, '');
    this.modelRadius = box2.getSize(new THREE.Vector3()).y || 1.8;
    this.meshes = skinned;

    // shared skeleton bone list (from the first skinned mesh)
    const skel = skinned[0].skeleton;
    this.bones = skel.bones.slice();
    this.boneName = this.bones.map(b => b.name || 'bone');

    this.skelHelper = new THREE.SkeletonHelper(this.model);
    this.skelHelper.material.transparent = true; this.skelHelper.material.opacity = 0.55;
    this.skelHelper.visible = this.showSkel; this.scene.add(this.skelHelper);

    this.setActiveMesh(0);
    this.selBone = this._guessInterestingBone();
    this._refreshColors();
    this._frame();
    this._status(''); this._changed();
    if (this.onLoaded) this.onLoaded();
    return this.stats();
  }

  // pick the bone with the most spread influence as a sensible starting selection
  _guessInterestingBone() {
    const g = this.mesh.geometry; const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const tally = new Float32Array(this.bones.length);
    for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) { const bi = si.getComponent(i, k); const w = sw.getComponent(i, k); if (w > 0.15) tally[bi] += w; }
    let best = 0, bv = -1; for (let i = 0; i < tally.length; i++) if (tally[i] > bv) { bv = tally[i]; best = i; }
    return best;
  }

  setActiveMesh(i) {
    const m = this.meshes[i]; if (!m) return;
    this.mesh = m; this._meshIndex = i;
    // ensure editable, unindexed-safe attributes: keep indexed but give vertex colors
    const g = m.geometry;
    // make skin attrs writable float arrays we own
    this._ensureWritable(g);
    // vertex-color material overlay for weight heat-map
    if (!m.userData._origMat) m.userData._origMat = m.material;
    const heatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide, flatShading: false });
    m.material = heatMat;
    if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3), 3));
    this._colorAttr = g.attributes.color;
    this._buildAdjacency(g);
    this._cacheWorldPos(m);
  }

  _ensureWritable(g) {
    // clone skin attrs so edits don't touch shared buffers
    const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    if (!si || !sw) throw new Error('Mesh is missing skin attributes');
    if (!si.array.__wp) { const a = new Uint16Array(si.array); a.__wp = true; g.setAttribute('skinIndex', new THREE.BufferAttribute(a, 4)); }
    if (!sw.array.__wp) { const a = new Float32Array(sw.array); a.__wp = true; g.setAttribute('skinWeight', new THREE.BufferAttribute(a, 4)); }
  }

  _buildAdjacency(g) {
    // weld by position so smoothing crosses the triangle soup
    const pos = g.attributes.position; const n = pos.count;
    const q = 1e4; const map = new Map(); const weld = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const k = Math.round(pos.getX(i) * q) + '_' + Math.round(pos.getY(i) * q) + '_' + Math.round(pos.getZ(i) * q);
      let id = map.get(k); if (id === undefined) { id = i; map.set(k, i); } weld[i] = id;
    }
    const nb = new Map(); const add = (a, b) => { if (a === b) return; let s = nb.get(a); if (!s) { s = new Set(); nb.set(a, s); } s.add(b); };
    const idx = g.index ? g.index.array : null;
    const tri = (a, b, c) => { const A = weld[a], B = weld[b], C = weld[c]; add(A, B); add(B, C); add(C, A); };
    if (idx) for (let i = 0; i < idx.length; i += 3) tri(idx[i], idx[i + 1], idx[i + 2]);
    else for (let i = 0; i < n; i += 3) tri(i, i + 1, i + 2);
    this._weld = weld; this._nb = nb;
    // build reverse: for a welded id, all raw verts sharing it
    const group = new Map(); for (let i = 0; i < n; i++) { const w = weld[i]; let s = group.get(w); if (!s) { s = []; group.set(w, s); } s.push(i); }
    this._group = group;
  }

  _cacheWorldPos(m) {
    const g = m.geometry; const pos = g.attributes.position; const n = pos.count;
    const wp = new Float32Array(n * 3); const v = new THREE.Vector3();
    m.updateWorldMatrix(true, false); const mat = m.matrixWorld;
    for (let i = 0; i < n; i++) { v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mat); wp[i * 3] = v.x; wp[i * 3 + 1] = v.y; wp[i * 3 + 2] = v.z; }
    this._worldPos = wp;
  }

  // weight for (vertex i, bone b) from the 4 skin slots
  _getW(si, sw, i, b) { for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === b) return sw.getComponent(i, k); return 0; }

  // set weight for (vertex i, selected bone b) then renormalize the 4 slots to 1
  _setW(si, sw, i, b, val) {
    val = clamp01(val);
    let slot = -1, minSlot = 0, minW = Infinity;
    for (let k = 0; k < 4; k++) {
      const bi = si.getComponent(i, k), w = sw.getComponent(i, k);
      if (bi === b) slot = k;
      if (w < minW) { minW = w; minSlot = k; }
    }
    if (slot === -1) { slot = minSlot; si.setComponent(i, slot, b); sw.setComponent(i, slot, 0); }
    sw.setComponent(i, slot, val);
    // distribute the remaining (1-val) across the other slots proportional to their current weights
    let othSum = 0; for (let k = 0; k < 4; k++) if (k !== slot) othSum += sw.getComponent(i, k);
    const rem = 1 - val;
    if (othSum > 1e-6) { const f = rem / othSum; for (let k = 0; k < 4; k++) if (k !== slot) sw.setComponent(i, k, sw.getComponent(i, k) * f); }
    else { // no other influence — give it all to the parent-ish first slot
      for (let k = 0; k < 4; k++) if (k !== slot) sw.setComponent(i, k, 0);
      if (rem > 0) { const alt = (slot + 1) % 4; si.setComponent(i, alt, si.getComponent(i, alt) || 0); sw.setComponent(i, alt, rem); }
    }
  }

  _refreshColors() {
    if (!this.mesh || this.selBone < 0) return;
    const g = this.mesh.geometry; const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const col = this._colorAttr; const n = g.attributes.position.count; const c = [0, 0, 0];
    for (let i = 0; i < n; i++) { heat(this._getW(si, sw, i, this.selBone), c); col.setXYZ(i, c[0], c[1], c[2]); }
    col.needsUpdate = true;
  }

  selectBone(i) { this.selBone = i; this._refreshColors(); this._changed(); }
  selectBoneByName(name) { const i = this.boneName.indexOf(name); if (i >= 0) this.selectBone(i); }

  // ---------------------------------------------------------- PAINT
  _bindPointer() {
    const c = this.canvas;
    const toNdc = e => { const r = c.getBoundingClientRect(); this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    c.addEventListener('pointermove', e => {
      toNdc(e);
      const hit = this._raycast();
      this._updateRing(hit, e);
      if (this.painting && hit) this._stroke(hit, e);
    });
    c.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      toNdc(e);
      // alt-click to sample/select the bone with most influence under cursor
      if (e.altKey) { const hit = this._raycast(); if (hit) this._sampleBone(hit); return; }
      const hit = this._raycast(); if (!hit) return;
      e.preventDefault();
      this.painting = true; this.controls.enableRotate = false; c.style.cursor = 'crosshair';
      this._pushUndo();
      this._stroke(hit, e);
    });
    window.addEventListener('pointerup', () => { if (this.painting) { this.painting = false; this.controls.enableRotate = true; this.canvas.style.cursor = 'default'; this._changed(); } });
    c.addEventListener('wheel', e => { if (e.shiftKey) { e.preventDefault(); this.brush.radius = clamp01(this.brush.radius + (e.deltaY < 0 ? 0.01 : -0.01) / 1) ; if (this.brush.radius < 0.02) this.brush.radius = 0.02; this._changed(); } }, { passive: false });
  }

  _raycast() {
    if (!this.mesh) return null;
    this._ray.setFromCamera(this._ndc, this.camera);
    const hits = this._ray.intersectObject(this.mesh, false);
    if (!hits.length) return null;
    return { point: hits[0].point, face: hits[0].face };
  }
  _updateRing(hit, e) {
    if (!hit) { this._ring.visible = false; return; }
    this._ring.visible = true;
    this._ring.position.copy(hit.point);
    const nrm = hit.face ? hit.face.normal.clone().transformDirection(this.mesh.matrixWorld) : this.camera.getWorldDirection(new THREE.Vector3()).negate();
    this._ring.lookAt(hit.point.clone().add(nrm));
    this._ring.scale.setScalar(this.brush.radius);
    const cmap = { add: 0x6ee08a, subtract: 0xe0714f, blur: 0x6bb6d8, set: 0xffcf6b };
    this._ring.material.color.setHex(cmap[this.brush.mode] || 0xffcf6b);
  }
  _sampleBone(hit) {
    const g = this.mesh.geometry; const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const f = hit.face; const cand = [f.a, f.b, f.c];
    const tally = {}; cand.forEach(vi => { for (let k = 0; k < 4; k++) { const bi = si.getComponent(vi, k), w = sw.getComponent(vi, k); tally[bi] = (tally[bi] || 0) + w; } });
    let best = this.selBone, bv = -1; for (const bi in tally) if (tally[bi] > bv) { bv = tally[bi]; best = +bi; }
    this.selectBone(best);
  }

  _stroke(hit, e) {
    if (this.selBone < 0) return;
    const g = this.mesh.geometry; const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
    const wp = this._worldPos; const n = g.attributes.position.count;
    const R = this.brush.radius * this.modelRadius * 1.0;  // radius scaled to model
    const R2 = R * R;
    const px = hit.point.x, py = hit.point.y, pz = hit.point.z;
    const invert = e && (e.buttons === 2 || e.shiftKey && this.brush.mode === 'add');
    const b = this.selBone;
    // stylus pressure: a pen drives strength directly; mouse/touch stays at full
    const pen = e && e.pointerType === 'pen' && e.pressure > 0;
    const str = this.brush.strength * (pen ? Math.max(0.05, e.pressure) : 1);

    // gather affected welded ids for blur mode
    if (this.brush.mode === 'blur') {
      const touched = [];
      for (let i = 0; i < n; i++) { const dx = wp[i * 3] - px, dy = wp[i * 3 + 1] - py, dz = wp[i * 3 + 2] - pz; const d2 = dx * dx + dy * dy + dz * dz; if (d2 <= R2) touched.push([i, Math.sqrt(d2)]); }
      // compute averaged weight (over welded neighbours) for the selected bone
      const newVals = new Map();
      for (const [i, d] of touched) {
        const wid = this._weld[i]; const nb = this._nb.get(wid);
        let sum = this._getW(si, sw, i, b), cnt = 1;
        if (nb) nb.forEach(o => { const raw = this._group.get(o); if (raw) { sum += this._getW(si, sw, raw[0], b); cnt++; } });
        const avg = sum / cnt; const fall = this._falloff(d / R) * str;
        newVals.set(i, this._getW(si, sw, i, b) * (1 - fall) + avg * fall);
      }
      newVals.forEach((val, i) => { this._group.get(this._weld[i]).forEach(r => this._setW(si, sw, r, b, val)); });
    } else {
      for (let i = 0; i < n; i++) {
        const dx = wp[i * 3] - px, dy = wp[i * 3 + 1] - py, dz = wp[i * 3 + 2] - pz;
        const d2 = dx * dx + dy * dy + dz * dz; if (d2 > R2) continue;
        const fall = this._falloff(Math.sqrt(d2) / R) * str;
        if (fall <= 0) continue;
        const cur = this._getW(si, sw, i, b);        let val;
        if (this.brush.mode === 'set') val = cur + (this.brush.value - cur) * fall;
        else if (this.brush.mode === 'subtract' || invert) val = cur - fall;
        else val = cur + fall; // add
        // apply to every raw vertex sharing this position (seams stay welded)
        this._group.get(this._weld[i]).forEach(r => this._setW(si, sw, r, b, val));
      }
    }
    si.needsUpdate = true; sw.needsUpdate = true;
    this._refreshColors();
    this._dirty = true;
  }
  _falloff(t) { t = clamp01(t); const s = 1 - t; return s * s * (3 - 2 * s); } // smoothstep

  // ---------------------------------------------------------- OPERATIONS
  normalizeAll() {
    if (!this.mesh) return;
    const g = this.mesh.geometry; const sw = g.attributes.skinWeight; const n = g.attributes.position.count;
    for (let i = 0; i < n; i++) {
      let s = 0; for (let k = 0; k < 4; k++) s += sw.getComponent(i, k);
      if (s > 1e-6) for (let k = 0; k < 4; k++) sw.setComponent(i, k, sw.getComponent(i, k) / s);
    }
    sw.needsUpdate = true; this._refreshColors(); this._dirty = true; this._changed();
  }

  // mirror weights across X: for each vertex on −X, copy the mirrored +X vertex's
  // weights, remapping left/right bone indices by name.
  mirror(fromPositive) {
    if (!this.mesh) return 0;
    const g = this.mesh.geometry; const pos = g.attributes.position; const si = g.attributes.skinIndex, sw = g.attributes.skinWeight; const n = pos.count;
    const remap = this._mirrorBoneMap();
    // shared symmetry contract: one scale-relative mirror map, same as sculpt/morph
    const mir = buildMirrorMap(pos.array).mirror;
    const wantPos = !!fromPositive;
    let done = 0;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i); if ((wantPos && x > 0) || (!wantPos && x < 0)) continue; // only write dest side (and midline)
      const sIdx = mir[i]; if (sIdx < 0 || sIdx === i) continue;
      for (let kk = 0; kk < 4; kk++) { let bi = si.getComponent(sIdx, kk); const w = sw.getComponent(sIdx, kk); bi = remap[bi]; si.setComponent(i, kk, bi); sw.setComponent(i, kk, w); }
      done++;
    }
    si.needsUpdate = true; sw.needsUpdate = true; this._refreshColors(); this._dirty = true; this._changed();
    return done;
  }
  _mirrorBoneMap() { return mirrorBonePartners(this.boneName); }

  // ---------------------------------------------------------- UNDO
  _pushUndo() {
    if (!this.mesh) return;
    const g = this.mesh.geometry;
    this._undo = this._undo || [];
    this._undo.push({ mesh: this._meshIndex, si: new Uint16Array(g.attributes.skinIndex.array), sw: new Float32Array(g.attributes.skinWeight.array) });
    if (this._undo.length > 24) this._undo.shift();
  }
  undo() {
    if (!this._undo || !this._undo.length) return false;
    const u = this._undo.pop(); this.setActiveMesh(u.mesh);
    const g = this.mesh.geometry;
    g.attributes.skinIndex.array.set(u.si); g.attributes.skinWeight.array.set(u.sw);
    g.attributes.skinIndex.needsUpdate = true; g.attributes.skinWeight.needsUpdate = true;
    this._refreshColors(); this._dirty = true; this._changed(); return true;
  }

  // ---------------------------------------------------------- EXPORT
  async exportGLB() {
    if (!this.model) throw new Error('Nothing to export');
    // restore original materials for export (heat-map is a paint overlay only)
    this.meshes.forEach(m => { if (m.userData._origMat) m.material = m.userData._origMat; });
    const exporter = new GLTFExporter();
    const glb = await new Promise((res, rej) => exporter.parse(this.model, res, rej, { binary: true, animations: this.model.animations || [] }));
    // put heat-map materials back for continued painting
    this.meshes.forEach(m => { const g = m.geometry; if (g.attributes.color) { const heatMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }); m.material = heatMat; } });
    if (this.mesh) this.setActiveMesh(this._meshIndex);
    this._refreshColors();
    return glb instanceof ArrayBuffer ? glb : new Uint8Array(glb).buffer;
  }

  // ---------------------------------------------------------- VIEW
  setBrush(patch) { Object.assign(this.brush, patch || {}); }
  setSkeleton(on) { this.showSkel = !!on; if (this.skelHelper) this.skelHelper.visible = on; }
  boneList() {
    if (!this.mesh) return [];
    const g = this.mesh.geometry; const si = g.attributes.skinIndex, sw = g.attributes.skinWeight; const n = g.attributes.position.count;
    const tally = new Float32Array(this.bones.length);
    for (let i = 0; i < n; i++) for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > 0.001) tally[si.getComponent(i, k)] += w; }
    return this.bones.map((b, i) => ({ index: i, name: this.boneName[i], influence: tally[i] })).filter(x => x.influence > 0.01 || true);
  }
  meshList() { return this.meshes.map((m, i) => ({ index: i, name: m.name || ('mesh ' + i), verts: m.geometry.attributes.position.count })); }
  setView(name) {
    const box = new THREE.Box3().setFromObject(this.model);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    this.controls.target.copy(c); const d = Math.max(sz.y, sz.x) * 1.9;
    const set = (x, y, z) => this.camera.position.set(x, y, z);
    if (name === 'front') set(c.x, c.y, c.z + d);
    else if (name === 'side') set(c.x + d, c.y, c.z);
    else if (name === 'back') set(c.x, c.y, c.z - d);
    else set(c.x + d * 0.25, c.y + sz.y * 0.1, c.z + d);
    this.controls.update();
  }
  _frame() {
    const box = new THREE.Box3().setFromObject(this.model);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    this.controls.target.copy(c); const d = Math.max(sz.y, sz.x) * 1.9;
    this.camera.position.set(c.x + d * 0.25, c.y + sz.y * 0.1, c.z + d); this.controls.update();
  }
  stats() { return { name: this.modelName, bones: this.bones.length, sel: this.selBone, selName: this.boneName[this.selBone] || '—', meshes: this.meshes.length, verts: this.mesh ? this.mesh.geometry.attributes.position.count : 0 }; }

  _clear() {
    if (this.model) { this.root.remove(this.model); this.model = null; }
    if (this.skelHelper) { this.scene.remove(this.skelHelper); this.skelHelper = null; }
    this.meshes = []; this.mesh = null; this.bones = []; this.boneName = []; this.selBone = -1; this._undo = [];
  }
  resize() { const el = this.canvas.parentElement || this.canvas; const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  _loop() { if (!this._run) return; requestAnimationFrame(this._loop); this.controls.update(); this.renderer.render(this.scene, this.camera); }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

export default WPEngine;
