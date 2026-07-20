// ============================================================
// SCULPT — ENGINE  (SCEngine)
// Real-time vertex sculpting on an imported model (GLB / FBX / OBJ).
// The model is baked, normalized and WELDED into one editable surface:
// every render-corner maps to a shared unique vertex, so brushes that
// move a vertex move every triangle that touches it — no cracks.
//
// Brushes operate on the model's real geometry:
//   • DRAW     push/pull the surface along its normals (alt = carve in)
//   • INFLATE  swell verts outward along their own normals
//   • SMOOTH   Laplacian relax toward the neighbour average (shift = anywhere)
//   • GRAB     drag a soft region of the surface through space with the cursor
//   • PINCH    pull verts toward the brush centre (sharpen ridges)
//   • FLATTEN  push verts onto the average brush-plane
//   • MASK     paint a protected region the deform brushes can't touch
//
// Plus: X-symmetry, midpoint SUBDIVIDE for more resolution, full-stroke
// UNDO, wireframe overlay, turntable, clay matcap-ish shading.
// Loaded by dynamic import from Sculpt.dc.html — same pattern as mesh-engine.js.
// ============================================================
import * as THREE from 'three';
import { applyOrbitScheme } from './nav-scheme.js';
import { buildMirrorMap } from './symmetry-map.js';
import { fetchAssetBuffer } from './chunk-loader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CLAY = 0xb9a690;       // warm sculpt clay
const MASKCOL = 0x3a4760;    // masked region tint
const RING = 0x4d82d6;

export class SCEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})());
    window.addEventListener("studiothemechange", () => { try { this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})()); } catch(e){} });
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 100);
    this.camera.position.set(1.4, 1.2, 3.0);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.3; this.controls.maxDistance = 14;

    const hemi = new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0); this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.45); key.position.set(2.4, 4.2, 3.0);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 16;
    key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0009; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.5); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe9cf, 0.35); fill.position.set(0.5, 1.0, -3.0); this.scene.add(fill);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.helpers = new THREE.Group(); this.scene.add(this.helpers);

    // editable surface state
    this.mesh = null;            // THREE.Mesh of the editable geometry
    this.vpos = null;            // Float32Array unique vertex positions
    this.vnrm = null;            // Float32Array unique vertex normals
    this.mask = null;            // Float32Array unique vertex mask 0..1
    this.corner = null;          // Int32Array  render-corner -> unique vertex idx
    this.faceV = null;           // Int32Array  unique idx per corner (== corner, kept for normals)
    this.adj = null;             // Array<Int32Array> unique-vertex neighbour lists
    this.mirrorIdx = null;       // Int32Array  unique idx of X-mirror vertex (-1 none)
    this.nUnique = 0; this.nCorner = 0;
    this.modelName = ''; this.modelRadius = 1; this.modelCenter = V(0, 0.9, 0);

    // tool state
    this.brush = 'draw';
    this.radiusFrac = 0.13;      // fraction of model radius
    this.strength = 0.5;
    this.symmetry = true;
    this.symAxis = 'x';        // 'x' | 'y' | 'z'
    this.dyntopo = false;
    this.detail = 0.4;
    this._strokeRefined = false; this._lastRefine = null;
    this.invert = false;
    this.wire = false;
    this.turntable = false;

    this.onStatus = null; this.onChange = null; this.onStats = null;

    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();
    this._ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2();
    this._painting = false; this._normalsDirty = false; this._posDirty = false;
    this._undo = []; this._redo = []; this._grab = null; this._shift = false;
    this._wireMesh = null;

    // brush cursor ring
    this._ring = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1.0, 48),
      new THREE.MeshBasicMaterial({ color: RING, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false })
    );
    this._ring.renderOrder = 999; this._ring.visible = false; this.helpers.add(this._ring);
    this._ringInner = new THREE.Mesh(
      new THREE.RingGeometry(0.0, 0.04, 16),
      new THREE.MeshBasicMaterial({ color: RING, side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthTest: false })
    );
    this._ringInner.renderOrder = 999; this._ringInner.visible = false; this.helpers.add(this._ringInner);

    this._bindPointer(); this._bindKeys();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__scEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return !!this.mesh; }
  worldRadius() { return this.radiusFrac * this.modelRadius; }

  // ---------------------------------------------------------- LOADING
  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts);
    return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop());
  }
  async loadFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    return this._ingest(await file.arrayBuffer(), ext, file.name);
  }
  async loadBuffer(buf, name, ext) {
    return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name);
  }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || ext) + '…');
    let obj;
    if (ext === 'fbx') obj = this._fbx.parse(buf, '');
    else if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); obj = g.scene || (g.scenes && g.scenes[0]); }
    else if (ext === 'obj') obj = this._obj.parse(new TextDecoder().decode(buf));
    else throw new Error('Unsupported .' + ext);

    obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
    obj.updateMatrixWorld(true);

    const srcs = [];
    obj.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry) srcs.push(o); });
    if (!srcs.length) throw new Error('No mesh found in file');

    // 1. bake every source mesh's positions into world space
    this._status('Baking surface…');
    const chunks = [];
    const gbox = new THREE.Box3();
    // remember the source look so a sculpt can leave textured the way it arrived
    this._srcMaterial = null; this._multiMat = false;
    for (const m of srcs) {
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if (mat) { if (!this._srcMaterial) this._srcMaterial = mat; else if (this._srcMaterial !== mat) this._multiMat = true; }
      let g = m.geometry; if (g.index) g = g.toNonIndexed(); g = g.clone();
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', g.attributes.position.clone());
      const n = g.attributes.position.count;
      const uvSrc = g.attributes.uv;
      const uv = new Float32Array(n * 2);
      if (uvSrc) uv.set(uvSrc.array.subarray(0, n * 2));
      pg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      pg.applyMatrix4(m.matrixWorld);
      pg.computeBoundingBox(); gbox.union(pg.boundingBox);
      chunks.push(pg);
    }
    // 2. normalize to ~1.8 tall, centered, feet on floor
    const size = gbox.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1);
    const cx = (gbox.min.x + gbox.max.x) / 2, cz = (gbox.min.z + gbox.max.z) / 2, minY = gbox.min.y;
    const normM = new THREE.Matrix4().makeTranslation(-cx * s, -minY * s, -cz * s)
      .multiply(new THREE.Matrix4().makeScale(s, s, s));

    // 3. concat all corners
    let total = 0; chunks.forEach(c => total += c.attributes.position.count);
    const flat = new Float32Array(total * 3); const uvFlat = new Float32Array(total * 2); let o = 0, uo = 0;
    for (const c of chunks) { c.applyMatrix4(normM); const p = c.attributes.position; flat.set(p.array.subarray(0, p.count * 3), o); o += p.count * 3; const u = c.attributes.uv; if (u) { uvFlat.set(u.array.subarray(0, p.count * 2), uo); } uo += p.count * 2; c.dispose(); }
    this._uvCorner = uvFlat;   // aligned to render corners; valid until topology changes

    this._status('Welding ' + (total).toLocaleString() + ' verts…');
    this._build(flat, total, name);
    this._status('');
    return this.stats();
  }

  // ---- weld corners -> unique verts, build adjacency + mirror + render mesh ----
  _build(flat, nCorner, name) {
    this._disposeMesh();
    this._topoChanged = false;
    this.modelName = (name || 'model').replace(/\.(glb|gltf|fbx|obj)$/i, '');
    this.nCorner = nCorner;

    const q = 4000;
    const key = (x, y, z) => Math.round(x * q) + ',' + Math.round(y * q) + ',' + Math.round(z * q);
    const map = new Map();
    const corner = new Int32Array(nCorner);
    const pos = [];
    for (let i = 0; i < nCorner; i++) {
      const x = flat[i * 3], y = flat[i * 3 + 1], z = flat[i * 3 + 2];
      const k = key(x, y, z); let id = map.get(k);
      if (id == null) { id = pos.length / 3; pos.push(x, y, z); map.set(k, id); }
      corner[i] = id;
    }
    const nUnique = pos.length / 3;
    this.vpos = new Float32Array(pos);
    this.vnrm = new Float32Array(nUnique * 3);
    this.mask = new Float32Array(nUnique);
    this.corner = corner; this.nUnique = nUnique;

    // adjacency (unique vertex neighbours via faces)
    const nbset = Array.from({ length: nUnique }, () => new Set());
    for (let f = 0; f < nCorner; f += 3) {
      const a = corner[f], b = corner[f + 1], c = corner[f + 2];
      nbset[a].add(b); nbset[a].add(c); nbset[b].add(a); nbset[b].add(c); nbset[c].add(a); nbset[c].add(b);
    }
    this.adj = nbset.map(s => Int32Array.from(s));

    // X-mirror map (find vertex at -x,y,z)
    this.mirrorIdx = new Int32Array(nUnique).fill(-1);
    for (let i = 0; i < nUnique; i++) {
      const x = this.vpos[i * 3], y = this.vpos[i * 3 + 1], z = this.vpos[i * 3 + 2];
      const m = map.get(key(-x, y, z)); if (m != null && m !== i) this.mirrorIdx[i] = m;
    }

    // render geometry (non-indexed corners reference unique verts)
    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.Float32BufferAttribute(new Float32Array(nCorner * 3), 3);
    const nrmAttr = new THREE.Float32BufferAttribute(new Float32Array(nCorner * 3), 3);
    const colAttr = new THREE.Float32BufferAttribute(new Float32Array(nCorner * 3), 3);
    geo.setAttribute('position', posAttr);
    geo.setAttribute('normal', nrmAttr);
    geo.setAttribute('color', colAttr);
    this._geo = geo;

    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.62, metalness: 0.0, flatShading: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.mesh = mesh; this.root.add(mesh);

    // bounds for radius / framing
    const box = new THREE.Box3(); box.setFromArray(this.vpos);
    this.modelCenter = box.getCenter(new THREE.Vector3());
    this.modelRadius = box.getBoundingSphere(new THREE.Sphere()).radius || 1;

    this._recomputeNormals();
    this._writePositions();
    this._writeColors();
    this._frame();
    this._undo = []; this._redo = [];
    this._origPos = this.vpos.slice(0); this._origCorner = this.corner.slice(0, this.nCorner); this._showOrig = false;
    this._changed();
  }

  // ---- write unique verts back to render corners ----
  _writePositions() {
    const p = this._geo.attributes.position.array;
    for (let i = 0; i < this.nCorner; i++) { const vi = this.corner[i] * 3; const o = i * 3; p[o] = this.vpos[vi]; p[o + 1] = this.vpos[vi + 1]; p[o + 2] = this.vpos[vi + 2]; }
    this._geo.attributes.position.needsUpdate = true;
    this._geo.computeBoundingSphere();
  }
  _writeColors() {
    const c = this._geo.attributes.color.array;
    const cr = ((CLAY >> 16) & 255) / 255, cg = ((CLAY >> 8) & 255) / 255, cb = (CLAY & 255) / 255;
    const mr = ((MASKCOL >> 16) & 255) / 255, mg = ((MASKCOL >> 8) & 255) / 255, mb = (MASKCOL & 255) / 255;
    for (let i = 0; i < this.nCorner; i++) {
      const vi = this.corner[i]; const m = this.mask[vi]; const o = i * 3;
      c[o] = cr * (1 - m) + mr * m; c[o + 1] = cg * (1 - m) + mg * m; c[o + 2] = cb * (1 - m) + mb * m;
    }
    this._geo.attributes.color.needsUpdate = true;
  }
  _recomputeNormals() {
    const vn = this.vnrm; vn.fill(0);
    const vp = this.vpos, corner = this.corner;
    const ax = V(), bx = V(), cx = V(), e1 = V(), e2 = V(), nf = V();
    for (let f = 0; f < this.nCorner; f += 3) {
      const a = corner[f], b = corner[f + 1], c = corner[f + 2];
      ax.set(vp[a * 3], vp[a * 3 + 1], vp[a * 3 + 2]);
      bx.set(vp[b * 3], vp[b * 3 + 1], vp[b * 3 + 2]);
      cx.set(vp[c * 3], vp[c * 3 + 1], vp[c * 3 + 2]);
      e1.subVectors(bx, ax); e2.subVectors(cx, ax); nf.crossVectors(e1, e2);
      vn[a * 3] += nf.x; vn[a * 3 + 1] += nf.y; vn[a * 3 + 2] += nf.z;
      vn[b * 3] += nf.x; vn[b * 3 + 1] += nf.y; vn[b * 3 + 2] += nf.z;
      vn[c * 3] += nf.x; vn[c * 3 + 1] += nf.y; vn[c * 3 + 2] += nf.z;
    }
    for (let i = 0; i < this.nUnique; i++) {
      const x = vn[i * 3], y = vn[i * 3 + 1], z = vn[i * 3 + 2];
      const l = Math.hypot(x, y, z) || 1; vn[i * 3] = x / l; vn[i * 3 + 1] = y / l; vn[i * 3 + 2] = z / l;
    }
    // write to corners
    const nrm = this._geo.attributes.normal.array;
    for (let i = 0; i < this.nCorner; i++) { const vi = this.corner[i] * 3; const o = i * 3; nrm[o] = vn[vi]; nrm[o + 1] = vn[vi + 1]; nrm[o + 2] = vn[vi + 2]; }
    this._geo.attributes.normal.needsUpdate = true;
  }

  _frame() {
    const c = this.modelCenter, r = this.modelRadius;
    this.controls.target.copy(c);
    this.camera.position.set(c.x + r * 0.6, c.y + r * 0.2, c.z + r * 2.6);
    this.controls.update();
  }

  // ---------------------------------------------------------- POINTER / STROKES
  _bindPointer() {
    const c = this.canvas;
    const toNdc = e => { const r = c.getBoundingClientRect(); this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this._lastE = e; };
    c.addEventListener('pointermove', e => {
      toNdc(e);
      if (this._painting) { this._strokeMove(e); return; }
      this._updateCursor();
    });
    c.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !this.mesh) return;
      toNdc(e); const hit = this._pick();
      if (!hit) return;
      e.preventDefault();
      this._painting = true; this.controls.enableRotate = false;
      this._snapshot();
      if (this.brush === 'grab' || this.brush === 'snake') this._beginGrab(hit);
      else this._applyBrush(hit.point, e.altKey);
    });
    window.addEventListener('pointerup', () => {
      if (this._painting) { this._painting = false; this.controls.enableRotate = true; this._grab = null; this._changed(); }
    });
    c.addEventListener('pointerleave', () => { this._ring.visible = false; this._ringInner.visible = false; });
  }
  _bindKeys() {
    window.addEventListener('keydown', e => {
      if (e.key === 'Shift') this._shift = true;
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); this.redo(); }
      if (e.key === '[') this.setRadiusFrac(this.radiusFrac - 0.02);
      // Blender-style brush hotkeys — the UI subscribes via onBrushKey
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && this.onBrushKey) {
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          const map = { d: 'draw', i: 'inflate', s: 'smooth', g: 'grab', p: 'pinch', f: 'flatten', m: 'mask', c: 'crease', l: 'clay', v: 'scrape', k: 'snake' };
          const b = map[e.key.toLowerCase()];
          if (b) this.onBrushKey(b);
        }
      }
      if (e.key === ']') this.setRadiusFrac(this.radiusFrac + 0.02);
    });
    window.addEventListener('keyup', e => { if (e.key === 'Shift') this._shift = false; });
  }
  _pick() {
    if (!this.mesh) return null;
    this._ray.setFromCamera(this._ndc, this.camera);
    const hits = this._ray.intersectObject(this.mesh, false);
    return hits.length ? hits[0] : null;
  }
  _updateCursor() {
    const hit = this._pick();
    if (!hit) { this._ring.visible = false; this._ringInner.visible = false; this.canvas.style.cursor = 'default'; return; }
    const r = this.worldRadius();
    this._ring.visible = this._ringInner.visible = true;
    [this._ring, this._ringInner].forEach(m => {
      m.position.copy(hit.point);
      m.lookAt(hit.point.clone().add(hit.face ? hit.face.normal.clone().transformDirection(this.mesh.matrixWorld) : V(0, 0, 1)));
    });
    this._ring.scale.setScalar(r);
    this._ringInner.scale.setScalar(r * 0.5);
    const col = this.brush === 'mask' ? 0x9aa6b8 : (this._effInvert() ? 0xcf5c5c : RING);
    this._ring.material.color.setHex(col); this._ringInner.material.color.setHex(col);
    this.canvas.style.cursor = 'crosshair';
  }
  _effInvert() { return this.invert; }

  _snapshot() {
    this._strokeRefined = false; this._lastRefine = null;
    this._undo.push({ vpos: this.vpos.slice(0), mask: this.mask.slice(0) });
    if (this._undo.length > 24) this._undo.shift();
    this._redo = [];
  }
  undo() {
    if (this._strokeRefined) { this._strokeRefined = false; return this.restorePreRebuild(); }
    const s = this._undo.pop(); if (!s) return false;
    this._redo.push({ vpos: this.vpos.slice(0), mask: this.mask.slice(0) });
    this.vpos.set(s.vpos); this.mask.set(s.mask);
    this._recomputeNormals(); this._writePositions(); this._writeColors(); this._changed();
    return true;
  }

  redo() {
    const s = this._redo.pop(); if (!s) return false;
    this._undo.push({ vpos: this.vpos.slice(0), mask: this.mask.slice(0) });
    this.vpos.set(s.vpos); this.mask.set(s.mask);
    this._recomputeNormals(); this._writePositions(); this._writeColors(); this._changed();
    return true;
  }

  _strokeMove(e) {
    const hit = this._pick(); this._updateCursor();
    if (this.brush === 'grab' || this.brush === 'snake') { if (this._grab) this._moveGrab(); return; }
    if (hit) this._applyBrush(hit.point, e.altKey);
  }

  // core deform — one dab at world point P
  _applyBrush(P, alt) {
    const eff = (this._shift && this.brush !== 'mask') ? 'smooth' : this.brush;
    if (this.dyntopo && eff !== 'mask' && this.brush !== 'grab' && this.brush !== 'snake') {
      const rr = this.worldRadius();
      if (!this._lastRefine || this._lastRefine.distanceTo(P) > rr * this.detail * 0.7) {
        if (this._refineRegion(P)) { this._strokeRefined = true; this._lastRefine = P.clone(); }
      }
    }
    const invert = (alt ? !this.invert : this.invert);
    this._dab(P, eff, invert, 1);
    if (this.symmetry) this._dab(this._mirror(P), eff, invert, -1);
    this._posDirty = true; this._normalsDirty = true;
  }

  _dab(P, type, invert, sx) {
    const r = this.worldRadius(), r2 = r * r;
    const vp = this.vpos, vn = this.vnrm, msk = this.mask, n = this.nUnique;
    const str = this.strength * ((this._lastE && this._lastE.pointerType === 'pen' && this._lastE.pressure > 0) ? Math.max(0.05, this._lastE.pressure) : 1);
    // gather affected
    const idx = []; const wts = [];
    for (let i = 0; i < n; i++) {
      const dx = vp[i * 3] - P.x, dy = vp[i * 3 + 1] - P.y, dz = vp[i * 3 + 2] - P.z;
      const d2 = dx * dx + dy * dy + dz * dz; if (d2 > r2) continue;
      const t = 1 - Math.sqrt(d2) / r; const f = t * t * (3 - 2 * t); // smoothstep falloff
      idx.push(i); wts.push(f);
    }
    if (!idx.length) return;

    if (type === 'mask') {
      const dir = invert ? -1 : 1;
      for (let k = 0; k < idx.length; k++) { const i = idx[k]; msk[i] = Math.max(0, Math.min(1, msk[i] + dir * wts[k] * str * 0.5)); }
      this._writeColors();
      return;
    }

    if (type === 'crease') {
      // pinch toward centre + push down along averaged normal — sharp valleys
      let cnx = 0, cny = 0, cnz = 0;
      for (let k = 0; k < idx.length; k++) { const i = idx[k], w = wts[k]; cnx += vn[i * 3] * w; cny += vn[i * 3 + 1] * w; cnz += vn[i * 3 + 2] * w; }
      const cnl = Math.hypot(cnx, cny, cnz) || 1; cnx /= cnl; cny /= cnl; cnz /= cnl;
      const push = r * 0.1 * str * (invert ? 1 : -1);
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k]; const w = wts[k] * str * (1 - msk[i]); if (w <= 0) continue;
        vp[i * 3] += (P.x - vp[i * 3]) * w * 0.5 + cnx * push * wts[k];
        vp[i * 3 + 1] += (P.y - vp[i * 3 + 1]) * w * 0.5 + cny * push * wts[k];
        vp[i * 3 + 2] += (P.z - vp[i * 3 + 2]) * w * 0.5 + cnz * push * wts[k];
      }
      return;
    }
    if (type === 'clay' || type === 'scrape') {
      // shared plane fit: weighted centroid + normal over the brush region
      let px = 0, py = 0, pz = 0, pnx = 0, pny = 0, pnz = 0, ws = 0;
      for (let k = 0; k < idx.length; k++) { const i = idx[k], w = wts[k]; px += vp[i * 3] * w; py += vp[i * 3 + 1] * w; pz += vp[i * 3 + 2] * w; pnx += vn[i * 3] * w; pny += vn[i * 3 + 1] * w; pnz += vn[i * 3 + 2] * w; ws += w; }
      px /= ws; py /= ws; pz /= ws; const pnl = Math.hypot(pnx, pny, pnz) || 1; pnx /= pnl; pny /= pnl; pnz /= pnl;
      if (type === 'clay') {
        // clay strips: fill toward a plane offset ABOVE the surface — builds
        // volume in flat layers instead of blobs (the Blender clay feel)
        const off = r * 0.15 * (invert ? -1 : 1);
        px += pnx * off; py += pny * off; pz += pnz * off;
        const flip = invert ? -1 : 1;
        for (let k = 0; k < idx.length; k++) {
          const i = idx[k]; const w = wts[k] * str * 0.7 * (1 - msk[i]); if (w <= 0) continue;
          const dot = (vp[i * 3] - px) * pnx + (vp[i * 3 + 1] - py) * pny + (vp[i * 3 + 2] - pz) * pnz;
          if (dot * flip > 0) continue;               // fill up to the plane, never past it
          vp[i * 3] -= pnx * dot * w; vp[i * 3 + 1] -= pny * dot * w; vp[i * 3 + 2] -= pnz * dot * w;
        }
      } else {
        // scrape: flatten that ONLY cuts peaks down to the plane (never lifts)
        for (let k = 0; k < idx.length; k++) {
          const i = idx[k]; const w = wts[k] * str * (1 - msk[i]); if (w <= 0) continue;
          const dot = (vp[i * 3] - px) * pnx + (vp[i * 3 + 1] - py) * pny + (vp[i * 3 + 2] - pz) * pnz;
          if (dot <= 0) continue;                     // valley — leave it
          vp[i * 3] -= pnx * dot * w; vp[i * 3 + 1] -= pny * dot * w; vp[i * 3 + 2] -= pnz * dot * w;
        }
      }
      return;
    }
    const sign = invert ? -1 : 1;
    if (type === 'smooth') {
      const adj = this.adj;
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k]; const w = wts[k] * str * (1 - msk[i]); if (w <= 0) continue;
        const nb = adj[i]; if (!nb.length) continue;
        let ax = 0, ay = 0, az = 0;
        for (let j = 0; j < nb.length; j++) { const m = nb[j] * 3; ax += vp[m]; ay += vp[m + 1]; az += vp[m + 2]; }
        ax /= nb.length; ay /= nb.length; az /= nb.length;
        vp[i * 3] += (ax - vp[i * 3]) * w; vp[i * 3 + 1] += (ay - vp[i * 3 + 1]) * w; vp[i * 3 + 2] += (az - vp[i * 3 + 2]) * w;
      }
      return;
    }
    if (type === 'flatten') {
      // average position + normal over affected -> plane
      let px = 0, py = 0, pz = 0, nx = 0, ny = 0, nz = 0, ws = 0;
      for (let k = 0; k < idx.length; k++) { const i = idx[k], w = wts[k]; px += vp[i * 3] * w; py += vp[i * 3 + 1] * w; pz += vp[i * 3 + 2] * w; nx += vn[i * 3] * w; ny += vn[i * 3 + 1] * w; nz += vn[i * 3 + 2] * w; ws += w; }
      px /= ws; py /= ws; pz /= ws; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k]; const w = wts[k] * str * (1 - msk[i]); if (w <= 0) continue;
        const dot = (vp[i * 3] - px) * nx + (vp[i * 3 + 1] - py) * ny + (vp[i * 3 + 2] - pz) * nz;
        vp[i * 3] -= nx * dot * w; vp[i * 3 + 1] -= ny * dot * w; vp[i * 3 + 2] -= nz * dot * w;
      }
      return;
    }
    if (type === 'pinch') {
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k]; const w = wts[k] * str * 0.6 * (1 - msk[i]); if (w <= 0) continue;
        vp[i * 3] += (P.x - vp[i * 3]) * w; vp[i * 3 + 1] += (P.y - vp[i * 3 + 1]) * w; vp[i * 3 + 2] += (P.z - vp[i * 3 + 2]) * w;
      }
      return;
    }
    // draw / inflate : move along normal
    const disp = r * 0.18 * str * sign;
    if (type === 'draw') {
      // cohesive push along the averaged brush normal (directional, like a thumb press)
      let nx = 0, ny = 0, nz = 0, ws = 0;
      for (let k = 0; k < idx.length; k++) { const i = idx[k], w = wts[k]; nx += vn[i * 3] * w; ny += vn[i * 3 + 1] * w; nz += vn[i * 3 + 2] * w; ws += w; }
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k]; const w = wts[k] * (1 - msk[i]); if (w <= 0) continue;
        vp[i * 3] += nx * disp * w; vp[i * 3 + 1] += ny * disp * w; vp[i * 3 + 2] += nz * disp * w;
      }
    } else {
      // inflate : each vertex swells along its OWN normal (puffy)
      for (let k = 0; k < idx.length; k++) {
        const i = idx[k]; const w = wts[k] * (1 - msk[i]); if (w <= 0) continue;
        vp[i * 3] += vn[i * 3] * disp * w; vp[i * 3 + 1] += vn[i * 3 + 1] * disp * w; vp[i * 3 + 2] += vn[i * 3 + 2] * disp * w;
      }
    }
  }

  // ---- GRAB : move a soft region with the cursor through a view-parallel plane ----
  _beginGrab(hit) {
    const r = this.worldRadius(), r2 = r * r, P = hit.point;
    const idx = [], wts = [];
    for (let i = 0; i < this.nUnique; i++) {
      const dx = this.vpos[i * 3] - P.x, dy = this.vpos[i * 3 + 1] - P.y, dz = this.vpos[i * 3 + 2] - P.z;
      const d2 = dx * dx + dy * dy + dz * dz; if (d2 > r2) continue;
      const t = 1 - Math.sqrt(d2) / r; idx.push(i); wts.push(t * t * (3 - 2 * t) * (1 - this.mask[i]));
    }
    // mirror set
    let midx = null, mwts = null;
    if (this.symmetry) {
      const MP = this._mirror(P); midx = []; mwts = [];
      for (let i = 0; i < this.nUnique; i++) {
        const dx = this.vpos[i * 3] - MP.x, dy = this.vpos[i * 3 + 1] - MP.y, dz = this.vpos[i * 3 + 2] - MP.z;
        const d2 = dx * dx + dy * dy + dz * dz; if (d2 > r2) continue;
        const t = 1 - Math.sqrt(d2) / r; midx.push(i); mwts.push(t * t * (3 - 2 * t) * (1 - this.mask[i]));
      }
    }
    const planeN = this.camera.getWorldDirection(new THREE.Vector3());
    this._grab = { idx, wts, midx, mwts, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(planeN, P), last: P.clone() };
  }
  _moveGrab() {
    const g = this._grab; if (!g) return;
    this._ray.setFromCamera(this._ndc, this.camera);
    const hitP = new THREE.Vector3();
    if (!this._ray.ray.intersectPlane(g.plane, hitP)) return;
    const d = hitP.clone().sub(g.last); if (d.lengthSq() === 0) return;
    const vp = this.vpos;
    for (let k = 0; k < g.idx.length; k++) { const i = g.idx[k], w = g.wts[k]; vp[i * 3] += d.x * w; vp[i * 3 + 1] += d.y * w; vp[i * 3 + 2] += d.z * w; }
    if (g.midx) for (let k = 0; k < g.midx.length; k++) { const i = g.midx[k], w = g.mwts[k]; vp[i * 3] += -d.x * w; vp[i * 3 + 1] += d.y * w; vp[i * 3 + 2] += d.z * w; }
    g.last.copy(hitP);
    // snake hook: re-anchor plane + region to the cursor each step so the
    // stroke drags matter along its whole path instead of one fixed blob
    if (this.brush === 'snake') {
      g.plane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()), hitP);
      const r = this.worldRadius(), r2 = r * r;
      const idx = [], wts = [];
      for (let i = 0; i < this.nUnique; i++) {
        const dx = vp[i * 3] - hitP.x, dy = vp[i * 3 + 1] - hitP.y, dz = vp[i * 3 + 2] - hitP.z;
        const d2 = dx * dx + dy * dy + dz * dz; if (d2 > r2) continue;
        const t = 1 - Math.sqrt(d2) / r; idx.push(i); wts.push(t * t * (3 - 2 * t) * (1 - this.mask[i]));
      }
      g.idx = idx; g.wts = wts; g.midx = null; g.mwts = null;
    }
    this._posDirty = true; this._normalsDirty = true;
  }

  // ---------------------------------------------------------- SUBDIVIDE (midpoint)
  subdivide() {
    if (!this.mesh) return null;
    const corner = this.corner, vp = this.vpos, mask = this.mask;
    const nF = this.nCorner / 3;
    const newPos = Array.from(vp); const newMask = Array.from(mask);
    const edgeMid = new Map();
    const mid = (a, b) => {
      const k = a < b ? a + '_' + b : b + '_' + a; let m = edgeMid.get(k); if (m != null) return m;
      m = newPos.length / 3;
      newPos.push((vp[a * 3] + vp[b * 3]) / 2, (vp[a * 3 + 1] + vp[b * 3 + 1]) / 2, (vp[a * 3 + 2] + vp[b * 3 + 2]) / 2);
      newMask.push((mask[a] + mask[b]) / 2);
      edgeMid.set(k, m); return m;
    };
    const outCorner = new Int32Array(nF * 4 * 3); let oi = 0;
    const tri = (a, b, c) => { outCorner[oi++] = a; outCorner[oi++] = b; outCorner[oi++] = c; };
    for (let f = 0; f < nF; f++) {
      const a = corner[f * 3], b = corner[f * 3 + 1], c = corner[f * 3 + 2];
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      tri(a, ab, ca); tri(ab, b, bc); tri(ca, bc, c); tri(ab, bc, ca);
    }
    this._rebuildFromUnique(new Float32Array(newPos), new Float32Array(newMask), outCorner);
    this._changed();
    return this.stats();
  }
  // rebuild adjacency/mirror/render from explicit unique verts + corner list
  _rebuildFromUnique(vpos, mask, corner, keepPre) {
    this._topoChanged = true;   // welded corners renumbered — original UVs no longer align
    // topology changed — keep ONE restore point (pre-op surface), not silence
    if (!keepPre) this._preRebuild = { vpos: this.vpos.slice(0), mask: this.mask.slice(0), corner: this.corner.slice(0, this.nCorner) };
    const nUnique = vpos.length / 3, nCorner = corner.length;
    this.vpos = vpos; this.mask = mask; this.corner = corner;
    this.vnrm = new Float32Array(nUnique * 3); this.nUnique = nUnique; this.nCorner = nCorner;
    const nbset = Array.from({ length: nUnique }, () => new Set());
    for (let f = 0; f < nCorner; f += 3) { const a = corner[f], b = corner[f + 1], c = corner[f + 2]; nbset[a].add(b); nbset[a].add(c); nbset[b].add(a); nbset[b].add(c); nbset[c].add(a); nbset[c].add(b); }
    this.adj = nbset.map(s => Int32Array.from(s));
    // mirror map — shared symmetry contract (scale-relative weld tolerance)
    this.mirrorIdx = buildMirrorMap(vpos.subarray ? vpos.subarray(0, nUnique * 3) : vpos.slice(0, nUnique * 3)).mirror;
    // new render geometry
    this._geo.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(nCorner * 3), 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(nCorner * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(nCorner * 3), 3));
    this._geo = geo; this.mesh.geometry = geo;
    this._recomputeNormals(); this._writePositions(); this._writeColors();
    if (this._wireMesh) this._refreshWire();
    this._undo = []; this._redo = [];
  }

  restorePreRebuild() {
    const p = this._preRebuild; if (!p) return false;
    this._preRebuild = null;
    this._rebuildFromUnique(p.vpos, p.mask, p.corner);
    this._changed();
    return true;
  }

  // ---------------------------------------------------------- WASM SUBDIVIDE / RELAX
  async _kernel() {
    if (!this._meshK) { const m = await import('./wasm-mesh.js'); this._meshK = await m.createMeshKernel(); }
    return this._meshK;
  }

  // Loop (smooth) subdivision — quadruples faces AND repositions every vertex
  // toward the limit surface, so blocky imports turn smooth. The per-vertex
  // weighted gather (which explodes as the mesh grows) runs in the WASM kernel.
  async loopSubdivide() {
    if (!this.mesh) return null;
    if (this.nCorner / 3 > 90000) return { tooDense: true, tris: Math.round(this.nCorner / 3) };
    const K = await this._kernel();
    const op = this._buildLoopOperator();
    const newPos = K.apply(this.vpos, op.rowStart, op.idx, op.w, op.nOut);
    this._rebuildFromUnique(newPos, op.newMask, op.outCorner);
    this._changed();
    return this.stats();
  }

  // Taubin λ|μ relaxation — global smoothing that doesn't shrink the model.
  // Two weighted-gather passes per iteration, both in WASM. Masked verts held.
  async relax(lambda = 0.5, mu = -0.53, passes = 1) {
    if (!this.mesh) return null;
    const K = await this._kernel();
    const opL = this._buildAvgOperator(lambda);
    const opM = this._buildAvgOperator(mu);
    const n = this.nUnique;
    let pos = this.vpos.slice(0);
    for (let p = 0; p < passes; p++) {
      pos = K.apply(pos, opL.rowStart, opL.idx, opL.w, n);
      pos = K.apply(pos, opM.rowStart, opM.idx, opM.w, n);
    }
    for (let i = 0; i < n; i++) {
      const m = this.mask[i]; if (m <= 0) continue;
      const o = i * 3;
      pos[o] = pos[o] * (1 - m) + this.vpos[o] * m;
      pos[o + 1] = pos[o + 1] * (1 - m) + this.vpos[o + 1] * m;
      pos[o + 2] = pos[o + 2] * (1 - m) + this.vpos[o + 2] * m;
    }
    this._snapshot();
    this.vpos.set(pos);
    this._recomputeNormals(); this._writePositions(); this._changed();
    return this.stats();
  }

  // Laplacian-with-factor operator (CSR):  newV = (1-f)·v + (f/n)·Σ neighbours
  _buildAvgOperator(f) {
    const n = this.nUnique, adj = this.adj;
    const rowStart = new Int32Array(n + 1); const idxA = []; const wA = [];
    for (let i = 0; i < n; i++) {
      rowStart[i] = idxA.length;
      const nb = adj[i]; const k = nb.length;
      idxA.push(i); wA.push(1 - f);
      if (k > 0) { const wn = f / k; for (let j = 0; j < k; j++) { idxA.push(nb[j]); wA.push(wn); } }
    }
    rowStart[n] = idxA.length;
    return { rowStart, idx: Int32Array.from(idxA), w: Float32Array.from(wA) };
  }

  // Loop subdivision operator + new topology, built from the welded faces.
  _buildLoopOperator() {
    const n = this.nUnique, corner = this.corner, nF = this.nCorner / 3, mask = this.mask;
    const ek = (a, b) => (a < b ? a * n + b : b * n + a);
    const edges = new Map();
    const addE = (u, v, opp) => { const k = ek(u, v); let e = edges.get(k); if (!e) { e = { u: Math.min(u, v), v: Math.max(u, v), opp: [] }; edges.set(k, e); } e.opp.push(opp); };
    for (let f = 0; f < nF; f++) { const a = corner[3 * f], b = corner[3 * f + 1], c = corner[3 * f + 2]; addE(a, b, c); addE(b, c, a); addE(c, a, b); }
    let next = n; for (const e of edges.values()) e.idx = next++;
    const nOut = next;
    const adj = Array.from({ length: n }, () => new Set());
    const isB = new Uint8Array(n); const bnb = Array.from({ length: n }, () => new Set());
    for (const e of edges.values()) {
      adj[e.u].add(e.v); adj[e.v].add(e.u);
      if (e.opp.length === 1) { isB[e.u] = isB[e.v] = 1; bnb[e.u].add(e.v); bnb[e.v].add(e.u); }
    }
    const rowStart = new Int32Array(nOut + 1); const idxA = []; const wA = [];
    const newMask = new Float32Array(nOut);
    for (let i = 0; i < n; i++) {
      rowStart[i] = idxA.length;
      if (isB[i]) {
        idxA.push(i); wA.push(0.75);
        for (const v of bnb[i]) { idxA.push(v); wA.push(0.125); }
      } else {
        const nb = [...adj[i]]; const k = nb.length || 1;
        const beta = k > 3 ? 3 / (8 * k) : (k === 3 ? 3 / 16 : (k === 2 ? 1 / 8 : 0));
        idxA.push(i); wA.push(1 - k * beta);
        for (const v of nb) { idxA.push(v); wA.push(beta); }
      }
      newMask[i] = mask[i];
    }
    for (const e of edges.values()) {
      rowStart[e.idx] = idxA.length;
      if (e.opp.length >= 2) { idxA.push(e.u, e.v, e.opp[0], e.opp[1]); wA.push(0.375, 0.375, 0.125, 0.125); }
      else { idxA.push(e.u, e.v); wA.push(0.5, 0.5); }
      newMask[e.idx] = (mask[e.u] + mask[e.v]) * 0.5;
    }
    rowStart[nOut] = idxA.length;
    const outCorner = new Int32Array(nF * 4 * 3); let oi = 0;
    const midOf = (a, b) => edges.get(ek(a, b)).idx;
    for (let f = 0; f < nF; f++) {
      const a = corner[3 * f], b = corner[3 * f + 1], c = corner[3 * f + 2];
      const ab = midOf(a, b), bc = midOf(b, c), ca = midOf(c, a);
      outCorner[oi++] = a; outCorner[oi++] = ab; outCorner[oi++] = ca;
      outCorner[oi++] = ab; outCorner[oi++] = b; outCorner[oi++] = bc;
      outCorner[oi++] = ca; outCorner[oi++] = bc; outCorner[oi++] = c;
      outCorner[oi++] = ab; outCorner[oi++] = bc; outCorner[oi++] = ca;
    }
    return { rowStart, idx: Int32Array.from(idxA), w: Float32Array.from(wA), nOut, outCorner, newMask };
  }

  // ---------------------------------------------------------- TOOL SETTERS
  _mirror(P) {
    if (this.symAxis === 'y') return V(P.x, -P.y, P.z);
    if (this.symAxis === 'z') return V(P.x, P.y, -P.z);
    return V(-P.x, P.y, P.z);
  }
  setSymAxis(a) { this.symAxis = (a === 'y' || a === 'z') ? a : 'x'; }
  // mask editing: blur / grow / shrink over the vertex adjacency graph
  blurMask(passes) {
    if (!this.mask) return; const n = this.nUnique, adj = this.adj;
    for (let p = 0; p < (passes || 2); p++) {
      const out = new Float32Array(n);
      for (let i = 0; i < n; i++) { const nb = adj[i]; let a = this.mask[i], c = 1; for (let j = 0; j < nb.length; j++) { a += this.mask[nb[j]]; c++; } out[i] = a / c; }
      this.mask.set(out);
    }
    this._writeColors(); this._changed();
  }
  growMask(shrink) {
    if (!this.mask) return; const n = this.nUnique, adj = this.adj;
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let v = this.mask[i]; const nb = adj[i];
      for (let j = 0; j < nb.length; j++) { const m = this.mask[nb[j]]; v = shrink ? Math.min(v, m) : Math.max(v, m); }
      out[i] = v;
    }
    this.mask.set(out); this._writeColors(); this._changed();
  }
  setDyntopo(on) { this.dyntopo = !!on; }
  setDetail(frac) { this.detail = Math.max(0.12, Math.min(0.9, frac)); }
  // Adaptive local refinement: split in-brush faces whose edges exceed the
  // target length, with red/green closure on neighbours so no cracks form.
  _refineRegion(P) {
    if (!this.mesh) return false;
    const nF = this.nCorner / 3; if (nF > 220000) return false;
    const r = this.worldRadius(), r2 = r * r;
    const detail = Math.max(0.004, this.detail * r), detail2 = detail * detail;
    const vp = this.vpos, corner = this.corner, n = this.nUnique;
    const ekey = (a, b) => a < b ? a * n + b : b * n + a;
    const el2 = (u, w) => { const dx = vp[u*3]-vp[w*3], dy = vp[u*3+1]-vp[w*3+1], dz = vp[u*3+2]-vp[w*3+2]; return dx*dx+dy*dy+dz*dz; };
    const splitE = new Map(); let any = false;
    for (let f = 0; f < nF; f++) {
      const a = corner[3*f], b = corner[3*f+1], c = corner[3*f+2];
      let inr = false;
      const vs = [a, b, c];
      for (let j = 0; j < 3; j++) { const v = vs[j]; const dx = vp[v*3]-P.x, dy = vp[v*3+1]-P.y, dz = vp[v*3+2]-P.z; if (dx*dx+dy*dy+dz*dz <= r2) { inr = true; break; } }
      if (!inr) continue;
      const pr = [[a,b],[b,c],[c,a]];
      for (let j = 0; j < 3; j++) { const u = pr[j][0], w = pr[j][1]; if (el2(u, w) > detail2) { splitE.set(ekey(u, w), { u, w }); any = true; } }
    }
    if (!any) return false;
    const newPos = Array.from(vp.subarray(0, n * 3));
    const newMask = Array.from(this.mask.subarray(0, n));
    for (const e of splitE.values()) { e.mid = newPos.length / 3; newPos.push((vp[e.u*3]+vp[e.w*3])/2, (vp[e.u*3+1]+vp[e.w*3+1])/2, (vp[e.u*3+2]+vp[e.w*3+2])/2); newMask.push((this.mask[e.u]+this.mask[e.w])/2); }
    const midOf = (u, w) => { const e = splitE.get(ekey(u, w)); return e ? e.mid : -1; };
    const out = []; const push = function() { for (let i = 0; i < arguments.length; i++) out.push(arguments[i]); };
    for (let f = 0; f < nF; f++) {
      const a = corner[3*f], b = corner[3*f+1], c = corner[3*f+2];
      const ab = midOf(a, b), bc = midOf(b, c), ca = midOf(c, a);
      const k = (ab>=0?1:0) + (bc>=0?1:0) + (ca>=0?1:0);
      if (k === 0) { push(a, b, c); }
      else if (k === 3) { push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca); }
      else if (k === 1) {
        if (ab >= 0) push(a, ab, c, ab, b, c);
        else if (bc >= 0) push(a, b, bc, a, bc, c);
        else push(a, b, ca, b, c, ca);
      } else {
        if (ab >= 0 && bc >= 0) push(b, bc, ab, ab, bc, c, ab, c, a);
        else if (bc >= 0 && ca >= 0) push(c, ca, bc, bc, ca, a, bc, a, b);
        else push(a, ab, ca, ca, ab, b, ca, b, c);
      }
    }
    this._rebuildFromUnique(new Float32Array(newPos), new Float32Array(newMask), Int32Array.from(out), true);
    return true;
  }
  setShading(p) {
    if (!this.mesh) return; const m = this.mesh.material;
    const P = {
      clay:  { roughness: 0.62, metalness: 0.0,  emissive: 0x000000, ei: 0 },
      wax:   { roughness: 0.34, metalness: 0.0,  emissive: 0x2a0f0a, ei: 0.35 },
      shiny: { roughness: 0.16, metalness: 0.12, emissive: 0x000000, ei: 0 },
      matte: { roughness: 0.95, metalness: 0.0,  emissive: 0x000000, ei: 0 },
    }[p] || null; if (!P) return;
    m.roughness = P.roughness; m.metalness = P.metalness;
    m.emissive = new THREE.Color(P.emissive); m.emissiveIntensity = P.ei; m.needsUpdate = true;
    this.shading = p;
  }
  toggleOriginal(on) {
    if (!this._origPos || !this.mesh) return false;
    this._showOrig = on == null ? !this._showOrig : !!on;
    const p = this._geo.attributes.position.array, src = this._showOrig ? this._origPos : this.vpos, corner = this._showOrig ? this._origCorner : this.corner;
    // before/after only differs when topology is unchanged; if corner counts match, swap positions live
    if (this._showOrig && this._origCorner.length === this.nCorner) {
      for (let i = 0; i < this.nCorner; i++) { const vi = this._origCorner[i] * 3, o = i * 3; p[o] = this._origPos[vi]; p[o+1] = this._origPos[vi+1]; p[o+2] = this._origPos[vi+2]; }
      this._geo.attributes.position.needsUpdate = true; this._recomputeNormals();
    } else { this._writePositions(); this._recomputeNormals(); }
    return this._showOrig;
  }
  setBrush(b) { this.brush = b; }
  setRadiusFrac(v) { this.radiusFrac = Math.max(0.02, Math.min(0.6, v)); }
  setStrength(v) { this.strength = Math.max(0, Math.min(1, v)); }
  setSymmetry(on) { this.symmetry = !!on; }
  setInvert(on) { this.invert = !!on; }
  clearMask() { if (this.mask) { this.mask.fill(0); this._writeColors(); this._changed(); } }
  invertMask() { if (this.mask) { for (let i = 0; i < this.nUnique; i++) this.mask[i] = 1 - this.mask[i]; this._writeColors(); this._changed(); } }
  setTurntable(on) { this.turntable = !!on; }
  setWire(on) {
    this.wire = !!on;
    if (on && !this._wireMesh) { this._refreshWire(); }
    if (this._wireMesh) this._wireMesh.visible = on;
  }
  _refreshWire() {
    if (this._wireMesh) { this.root.remove(this._wireMesh); this._wireMesh.geometry.dispose(); this._wireMesh = null; }
    const wg = new THREE.WireframeGeometry(this._geo);
    this._wireMesh = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x0e1014, transparent: true, opacity: 0.18 }));
    this._wireMesh.visible = this.wire; this.root.add(this._wireMesh);
  }

  resetMesh() { /* placeholder for future original snapshot */ }

  // ---------------------------------------------------------- VIEW
  setView(name) {
    const c = this.modelCenter, r = this.modelRadius, d = r * 2.6;
    this.controls.target.copy(c);
    const set = (x, y, z) => this.camera.position.set(x, y, z);
    if (name === 'front') set(c.x, c.y, c.z + d);
    else if (name === 'side') set(c.x + d, c.y, c.z);
    else if (name === 'top') set(c.x + 0.001, c.y + d, c.z + 0.001);
    else if (name === 'back') set(c.x, c.y, c.z - d);
    else set(c.x + r * 0.6, c.y + r * 0.2, c.z + d);
    this.controls.update();
  }
  frameModel() { this._frame(); }

  stats() {
    let m = 0; if (this.mask) for (let i = 0; i < this.nUnique; i++) if (this.mask[i] > 0.01) m++;
    return { name: this.modelName, verts: this.nUnique, tris: Math.round(this.nCorner / 3), masked: m };
  }

  // ---------------------------------------------------------- EXPORT
  // Pack the current sculpted surface as an indexed GLB — unique verts +
  // corner indices (the welded topology), fresh smooth normals.
  async exportGLB() {
    if (!this.mesh) throw new Error('Nothing to export — load a model first');
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const g = new THREE.BufferGeometry();
    const keepUV = !this._topoChanged && this._uvCorner && this._uvCorner.length === this.nCorner * 2;
    let material;
    if (keepUV) {
      // topology intact — export non-indexed so original per-corner UVs ride along,
      // and reuse the source material (textures/maps) so the character stays dressed
      const pos = new Float32Array(this.nCorner * 3);
      for (let i = 0; i < this.nCorner; i++) { const vi = this.corner[i] * 3, oo = i * 3; pos[oo] = this.vpos[vi]; pos[oo+1] = this.vpos[vi+1]; pos[oo+2] = this.vpos[vi+2]; }
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this._uvCorner.slice(0, this.nCorner * 2), 2));
      g.computeVertexNormals();
      material = this._srcMaterial ? this._srcMaterial.clone() : new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.85 });
      this._lastExportDegraded = this._multiMat ? 'multimat' : false;
    } else {
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.vpos.slice(0, this.nUnique * 3), 3));
      g.setIndex(new THREE.BufferAttribute(Uint32Array.from(this.corner.subarray(0, this.nCorner)), 1));
      g.computeVertexNormals();
      material = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.85 });
      this._lastExportDegraded = this._uvCorner ? 'topo' : 'nouv';   // topo change dropped UVs, or model never had them
    }
    const mesh = new THREE.Mesh(g, material);
    mesh.name = (this.modelName || 'model') + '_sculpt';
    const scene = new THREE.Scene(); scene.add(mesh);
    const glb = await new Promise((res, rej) => new GLTFExporter().parse(scene, res, rej, { binary: true }));
    g.dispose();
    return glb;
  }

  _disposeMesh() {
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null; }
    if (this._wireMesh) { this.root.remove(this._wireMesh); this._wireMesh.geometry.dispose(); this._wireMesh = null; }
  }
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return; requestAnimationFrame(this._loop);
    if (this.turntable && this.mesh) this.root.rotation.y += 0.006;
    if (this._posDirty) { this._writePositions(); this._posDirty = false; }
    if (this._normalsDirty) { this._recomputeNormals(); this._normalsDirty = false; if (this.wire && this._wireMesh) this._refreshWire(); }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

export default SCEngine;
