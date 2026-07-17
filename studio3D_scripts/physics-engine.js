// ============================================================
// physics-engine.js — real-time soft-body & cloth on imported meshes.
// Particles + distance/bending constraints solved by the hand-authored
// WASM XPBD core (wasm-physics.js). Runs entirely client-side.
// ============================================================
import * as THREE from 'three';
import { applyOrbitScheme } from './nav-scheme.js';
import { fetchAssetBuffer } from './chunk-loader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';
import { createSolver } from './wasm-physics.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CLOTH = 0xc25b54, SOFT = 0xb9a690, PIN = 0x4d82d6, RING = 0x43b6c4;

export class PHEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})());
    window.addEventListener("studiothemechange", () => { try { if (!this._bgOverride) this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})()); } catch(e){} });
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 100);
    this.camera.position.set(1.8, 1.4, 3.4);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.4; this.controls.maxDistance = 16;

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(2.6, 4.4, 3.2);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 18;
    key.shadow.camera.left = -3.5; key.shadow.camera.right = 3.5; key.shadow.camera.top = 4.5; key.shadow.camera.bottom = -1.5;
    key.shadow.bias = -0.0009; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.55); rim.position.set(-3, 2.4, -2.6); this.scene.add(rim);
    this.scene.add(new THREE.DirectionalLight(0xffe9cf, 0.32).translateX(0));

    this.grid = new THREE.GridHelper(12, 28, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.32 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);
    this._floor = floor; this._bgOverride = null;
    this.waterStyle = { color: '#3f9df8', gloss: 0.75, glow: 0, opacity: 1 };

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.helpers = new THREE.Group(); this.scene.add(this.helpers);

    // sim state
    this.mesh = null; this._geo = null;
    this.vpos = null; this.vnrm = null; this.corner = null; this.adj = null;
    this.nUnique = 0; this.nCorner = 0;
    this.invMass = null; this.pinned = null;          // per-unique
    this.solver = null; this.view = null; this.nC = 0;
    this.mode = 'soft';                                // 'soft' | 'cloth'
    this.modelName = ''; this.modelRadius = 1; this.modelCenter = V(0, 0.9, 0);

    // tunables
    this.simulating = false;
    this.gravity = -9.8; this.stiffness = 6; this.damping = 0.985;
    this.wind = 0; this.windDir = V(1, 0, 0.25).normalize();
    this.groundY = 0; this.substeps = 3;
    this.pinMode = false; this.pinPaintRadius = 0.16;
    this.colliders = []; this._colliderMeshes = [];

    // liquid · container · motion program · capture
    this.liq = null; this.liqVisc = 0.08;
    this._mcHQ = null;                                 // offline metaball renderer — export only, never live
    this._offline = false; this._bake = null;
    this._cdragTarget = null;
    this._liqSpawn = { R: 0.26, spacing: 0.07 };
    this._placeMode = false;
    this.container = null;
    this._prog = null; this._progSteps = [];
    this._gifCap = null; this._recording = false;
    this._cdrag = null;
    this._tmpV = new THREE.Vector3(); this._tmpM = new THREE.Matrix4(); this._tmpQ = new THREE.Quaternion();

    this.onStatus = null; this.onChange = null; this.onStats = null; this.onFps = null;

    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();
    this._ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2();
    this._grab = null; this._t = 0; this._fpsT = 0; this._fpsN = 0;

    this._ring = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.0, 48),
      new THREE.MeshBasicMaterial({ color: RING, side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthTest: false }));
    this._ring.renderOrder = 999; this._ring.visible = false; this.helpers.add(this._ring);

    this._bindPointer();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    createSolver().then(s => { this.solver = s; this._status(''); });
    if (typeof window !== 'undefined') window.__phEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return !!this.mesh || !!(this.liq && this.liq.n) || !!this.container; }

  resize() {
    const w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

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
    else if (ext === 'obj') obj = this._obj.parse(new TextDecoder().decode(buf));
    else throw new Error('Unsupported .' + ext);

    obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
    obj.updateMatrixWorld(true);
    const srcs = []; obj.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry) srcs.push(o); });
    if (!srcs.length) throw new Error('No mesh found in file');

    const chunks = []; const gbox = new THREE.Box3();
    for (const m of srcs) {
      let g = m.geometry; if (g.index) g = g.toNonIndexed(); g = g.clone();
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', g.attributes.position.clone());
      pg.applyMatrix4(m.matrixWorld); pg.computeBoundingBox(); gbox.union(pg.boundingBox); chunks.push(pg);
    }
    const size = gbox.getSize(new THREE.Vector3()); const s = 1.8 / (size.y || 1);
    const cx = (gbox.min.x + gbox.max.x) / 2, cz = (gbox.min.z + gbox.max.z) / 2, minY = gbox.min.y;
    const normM = new THREE.Matrix4().makeTranslation(-cx * s, -minY * s, -cz * s).multiply(new THREE.Matrix4().makeScale(s, s, s));
    let total = 0; chunks.forEach(c => total += c.attributes.position.count);
    const flat = new Float32Array(total * 3); let o = 0;
    for (const c of chunks) { c.applyMatrix4(normM); const p = c.attributes.position; flat.set(p.array.subarray(0, p.count * 3), o); o += p.count * 3; c.dispose(); }

    this._status('Welding ' + total.toLocaleString() + ' verts…');
    this.mode = 'soft';
    this._build(flat, total, name);
    this._buildSim();
    this._status('');
    return this.stats();
  }

  // ---- weld corners -> unique verts + adjacency ----
  _build(flat, nCorner, name) {
    this._disposeMesh();
    this.modelName = (name || 'model').replace(/\.(glb|gltf|fbx|obj)$/i, '');
    this.nCorner = nCorner;
    const q = 2200;
    const key = (x, y, z) => Math.round(x * q) + ',' + Math.round(y * q) + ',' + Math.round(z * q);
    const map = new Map(); const corner = new Int32Array(nCorner); const pos = [];
    for (let i = 0; i < nCorner; i++) {
      const x = flat[i * 3], y = flat[i * 3 + 1], z = flat[i * 3 + 2];
      const k = key(x, y, z); let id = map.get(k);
      if (id == null) { id = pos.length / 3; pos.push(x, y, z); map.set(k, id); }
      corner[i] = id;
    }
    const nUnique = pos.length / 3;
    this.vpos = new Float32Array(pos); this.vnrm = new Float32Array(nUnique * 3);
    this.corner = corner; this.nUnique = nUnique;

    const nbset = Array.from({ length: nUnique }, () => new Set());
    for (let f = 0; f < nCorner; f += 3) {
      const a = corner[f], b = corner[f + 1], c = corner[f + 2];
      nbset[a].add(b); nbset[a].add(c); nbset[b].add(a); nbset[b].add(c); nbset[c].add(a); nbset[c].add(b);
    }
    this.adj = nbset.map(s => Int32Array.from(s));

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(nCorner * 3), 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(nCorner * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(nCorner * 3), 3));
    this._geo = geo;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    this.mesh = mesh; this.root.add(mesh);

    const box = new THREE.Box3(); box.setFromArray(this.vpos);
    this.modelCenter = box.getCenter(new THREE.Vector3());
    this.modelRadius = box.getBoundingSphere(new THREE.Sphere()).radius || 1;
    this._recomputeNormals(); this._writePositions(); this._writeColors(); this._frame();
    this._changed();
  }

  // ---- build particle system from welded mesh ----
  _buildSim() {
    const n = this.nUnique;
    this.invMass = new Float32Array(n).fill(1);
    this.pinned = new Uint8Array(n);
    // edges (unique, both directions deduped) -> distance constraints
    const seen = new Set(); const edges = [];
    const addEdge = (a, b) => { const k = a < b ? a * n + b : b * n + a; if (!seen.has(k)) { seen.add(k); edges.push(a, b); } };
    for (let i = 0; i < n; i++) for (const j of this.adj[i]) addEdge(i, j);
    // bending: connect 2-ring neighbours for volume/stiffness (sampled to keep count sane)
    if (this.mode === 'soft') {
      for (let i = 0; i < n; i++) {
        const ring1 = this.adj[i];
        for (const j of ring1) for (const k of this.adj[j]) if (k !== i && k > i && (k % 2 === 0)) addEdge(i, k);
      }
    }
    this._edges = edges;
    // auto-pin: soft body pins the bottom 12% (feet), cloth pins handled by preset
    if (this.mode === 'soft') {
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < n; i++) { const y = this.vpos[i * 3 + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      const thresh = minY + (maxY - minY) * 0.12;
      for (let i = 0; i < n; i++) if (this.vpos[i * 3 + 1] <= thresh) { this.pinned[i] = 1; this.invMass[i] = 0; }
    }
    this._uploadSim();
    this._writeColors();
    if (this.onStats) this.onStats(this.stats());
  }

  _uploadSim() {
    if (!this.solver) { this._pendingUpload = true; return; }
    const n = this.nUnique, nc = this._edges.length / 2;
    this.nC = nc;
    this.view = this.solver.alloc(n, nc);
    this.view.pos.set(this.vpos);
    this.view.prev.set(this.vpos);
    this.view.invMass.set(this.invMass);
    const e = this._edges, vp = this.vpos;
    for (let k = 0; k < nc; k++) {
      const a = e[k * 2], b = e[k * 2 + 1];
      const dx = vp[a * 3] - vp[b * 3], dy = vp[a * 3 + 1] - vp[b * 3 + 1], dz = vp[a * 3 + 2] - vp[b * 3 + 2];
      this.solver.setConstraint(k, a, b, Math.hypot(dx, dy, dz));
    }
    this.vpos0 = this.vpos.slice(0);
    this._pendingUpload = false;
  }

  // ---- procedural cloth (banner / cape) so the tool works with no mesh ----
  loadCloth(cols = 44, rows = 30) {
    this._disposeMesh();
    this.mode = 'cloth'; this.modelName = 'Cloth ' + cols + '×' + rows;
    const W = 1.7, H = 1.15, x0 = -W / 2, y0 = 1.7;
    const n = cols * rows;
    const vp = new Float32Array(n * 3);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      vp[i * 3] = x0 + (c / (cols - 1)) * W;
      vp[i * 3 + 1] = y0 - (r / (rows - 1)) * H;
      vp[i * 3 + 2] = (Math.random() - 0.5) * 0.004;
    }
    // triangles (two per quad) as corners
    const tris = [];
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      tris.push(a, d, b, b, d, e);
    }
    this.nUnique = n; this.nCorner = tris.length;
    this.corner = Int32Array.from(tris);
    this.vpos = vp; this.vnrm = new Float32Array(n * 3);
    // adjacency
    const nbset = Array.from({ length: n }, () => new Set());
    for (let f = 0; f < this.nCorner; f += 3) {
      const A = this.corner[f], B = this.corner[f + 1], C = this.corner[f + 2];
      nbset[A].add(B); nbset[A].add(C); nbset[B].add(A); nbset[B].add(C); nbset[C].add(A); nbset[C].add(B);
    }
    this.adj = nbset.map(s => Int32Array.from(s));

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.nCorner * 3), 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(this.nCorner * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.nCorner * 3), 3));
    this._geo = geo;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.0, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.root.add(this.mesh);

    this.invMass = new Float32Array(n).fill(1); this.pinned = new Uint8Array(n);
    // structural + shear + bend edges
    const seen = new Set(); const edges = [];
    const add = (a, b) => { if (a < 0 || b < 0 || a >= n || b >= n) return; const k = a < b ? a * n + b : b * n + a; if (!seen.has(k)) { seen.add(k); edges.push(a, b); } };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols) add(i, i + 1);
      if (r + 1 < rows) add(i, i + cols);
      if (c + 1 < cols && r + 1 < rows) { add(i, i + cols + 1); add(i + 1, i + cols); }   // shear
      if (c + 2 < cols) add(i, i + 2);                                                     // bend
      if (r + 2 < rows) add(i, i + 2 * cols);
    }
    this._edges = edges;
    // pin the top row
    for (let c = 0; c < cols; c++) { this.pinned[c] = 1; this.invMass[c] = 0; }

    const box = new THREE.Box3(); box.setFromArray(this.vpos);
    this.modelCenter = box.getCenter(new THREE.Vector3()); this.modelRadius = box.getBoundingSphere(new THREE.Sphere()).radius || 1;
    this._recomputeNormals(); this._writePositions(); this._writeColors(); this._frame();
    this._uploadSim();
    this.simulating = true;
    this._changed(); if (this.onStats) this.onStats(this.stats());
    return this.stats();
  }

  // ---- sphere colliders (cloth drapes / soft-bodies push off them) ----
  clearColliders() {
    for (const m of this._colliderMeshes) { this.helpers.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this._colliderMeshes = []; this.colliders = [];
    if (this.solver) this.solver.setSpheres([]);
  }
  _syncColliders() {
    if (this.solver) this.solver.setSpheres(this.colliders);
    // rebuild visual meshes
    for (const m of this._colliderMeshes) { this.helpers.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this._colliderMeshes = [];
    for (const c of this.colliders) {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(c.r, 32, 24),
        new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: 0.85, metalness: 0.0 }));
      mesh.position.set(c.x, c.y, c.z); mesh.castShadow = true; mesh.receiveShadow = true;
      this.helpers.add(mesh); this._colliderMeshes.push(mesh);
    }
  }
  addSphereCollider(x, y, z, r) { this.colliders.push({ x, y, z, r }); this._syncColliders(); }

  // ---- drape preset: a flat sheet dropped onto a sphere ----
  loadDrape(cols = 46, rows = 46) {
    this._disposeMesh();
    this.mode = 'cloth'; this.modelName = 'Drape ' + cols + '×' + rows;
    const sphR = 0.62, sphY = 0.95, W = 2.0, D = 2.0;
    const n = cols * rows; const vp = new Float32Array(n * 3);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      vp[i * 3] = -W / 2 + (c / (cols - 1)) * W;
      vp[i * 3 + 1] = sphY + sphR + 0.55 + (Math.random() - 0.5) * 0.004;
      vp[i * 3 + 2] = -D / 2 + (r / (rows - 1)) * D;
    }
    const tris = [];
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1; tris.push(a, d, b, b, d, e);
    }
    this.nUnique = n; this.nCorner = tris.length; this.corner = Int32Array.from(tris);
    this.vpos = vp; this.vnrm = new Float32Array(n * 3);
    const nbset = Array.from({ length: n }, () => new Set());
    for (let f = 0; f < this.nCorner; f += 3) { const A = this.corner[f], B = this.corner[f + 1], C = this.corner[f + 2]; nbset[A].add(B); nbset[A].add(C); nbset[B].add(A); nbset[B].add(C); nbset[C].add(A); nbset[C].add(B); }
    this.adj = nbset.map(s => Int32Array.from(s));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.nCorner * 3), 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(this.nCorner * 3), 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.nCorner * 3), 3));
    this._geo = geo;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.0, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.root.add(this.mesh);
    this.invMass = new Float32Array(n).fill(1); this.pinned = new Uint8Array(n);   // nothing pinned — it just drops
    const seen = new Set(); const edges = [];
    const add = (a, b) => { if (a < 0 || b < 0 || a >= n || b >= n) return; const k = a < b ? a * n + b : b * n + a; if (!seen.has(k)) { seen.add(k); edges.push(a, b); } };
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols) add(i, i + 1);
      if (r + 1 < rows) add(i, i + cols);
      if (c + 1 < cols && r + 1 < rows) { add(i, i + cols + 1); add(i + 1, i + cols); }
      if (c + 2 < cols) add(i, i + 2);
      if (r + 2 < rows) add(i, i + 2 * cols);
    }
    this._edges = edges;
    const box = new THREE.Box3(); box.setFromArray(this.vpos);
    this.modelCenter = V(0, sphY, 0); this.modelRadius = 1.4;
    this._recomputeNormals(); this._writePositions(); this._writeColors(); this._frame();
    this._uploadSim();
    this.colliders = [{ x: 0, y: sphY, z: 0, r: sphR }]; this._syncColliders();
    this.simulating = true;
    this._changed(); if (this.onStats) this.onStats(this.stats());
    return this.stats();
  }

  // ---------------------------------------------------------- SIM STEP
  _simStep(dt) {
    if (!this.solver || !this.view) return;
    const pos = this.view.pos;
    // sync any external edits (grab) into solver pos already done in grab handler
    // wind: nudge free particles along windDir (impulse on pos so velocity picks it up)
    if (this.wind > 0.001) {
      const t = this._t;
      const gust = this.wind * (0.6 + 0.4 * Math.sin(t * 2.3) + 0.2 * Math.sin(t * 7.1));
      const wx = this.windDir.x * gust * dt * dt, wy = this.windDir.y * gust * dt * dt, wz = this.windDir.z * gust * dt * dt;
      const im = this.view.invMass, n = this.nUnique, nrm = this.vnrm;
      for (let i = 0; i < n; i++) {
        if (im[i] === 0) continue;
        // cloth catches wind on its faces: scale by |normal·wind| for a billowing feel
        const fl = this.mode === 'cloth' ? Math.abs(nrm[i * 3] * this.windDir.x + nrm[i * 3 + 1] * this.windDir.y + nrm[i * 3 + 2] * this.windDir.z) * 1.6 + 0.2 : 1;
        pos[i * 3] += wx * fl; pos[i * 3 + 1] += wy * fl; pos[i * 3 + 2] += wz * fl;
      }
    }
    this.solver.step(this.stiffness, dt, this.gravity, this.damping, this.groundY);
    if (this.colliders.length) this.solver.collide();
  }

  _loop(now) {
    requestAnimationFrame(this._loop);
    // wall-clock fixed-step accumulator: rAF may fire at 60/120/180Hz, but the
    // sim, motion program and recordings must advance in real seconds.
    const dt = 1 / 60;
    if (this._lastNow == null) this._lastNow = now;
    this._acc = Math.min(0.1, (this._acc || 0) + (now - this._lastNow) / 1000);
    this._lastNow = now;
    let ticks = 0;
    while (this._acc >= dt && ticks < 5) { this._tick(dt); this._acc -= dt; ticks++; }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this._gifCap) this._gifFrame(now);
    // fps (measured in sim ticks per second so the readout stays meaningful)
    if (ticks && this.simulating) {
      this._fpsN++; if (now - this._fpsT > 500) { const f = Math.round(this._fpsN * 1000 / (now - this._fpsT)); this._fpsN = 0; this._fpsT = now; if (this.onFps) this.onFps(Math.min(60, f)); }
    }
  }

  _tick(dt) {
    if (this._offline) return;                        // offline export owns the scene
    const liqOn = !!(this.liq && this.liq.n);
    const active = this.simulating && (this.mesh || liqOn);
    const sub = this.substeps, sdt = dt / sub;
    if (active) this._t += dt;
    // program, drag and collision all advance per SUBSTEP so a fast-moving
    // container can never skip past a particle in a single step (tunneling)
    for (let s = 0; s < sub; s++) {
      if (this._prog && this._prog.playing) this._progStep(sdt);
      this._advanceDrag(sdt);
      if (this.container) this._containerSync();
      if (active) { if (this.mesh) this._simStep(sdt); if (liqOn) this._liquidStep(sdt); }
    }
    if (this._bake) this._bakeTick(liqOn);
    if (!active) return;
    // copy solver positions back to vpos, refresh render
    if (this.mesh) {
      if (this.view) {
        if (this.container) this._pushOutContainer(this.view.pos, this.nUnique, 0.006, this.view.invMass);
        this.vpos.set(this.view.pos);
      }
      this._recomputeNormals(); this._writePositions();
    }
    if (liqOn) this._writeLiquid();
  }

  // ---------------------------------------------------------- WRITE-BACK
  _writePositions() {
    const p = this._geo.attributes.position.array;
    for (let i = 0; i < this.nCorner; i++) { const vi = this.corner[i] * 3, o = i * 3; p[o] = this.vpos[vi]; p[o + 1] = this.vpos[vi + 1]; p[o + 2] = this.vpos[vi + 2]; }
    this._geo.attributes.position.needsUpdate = true; this._geo.computeBoundingSphere();
  }
  _writeColors() {
    const c = this._geo.attributes.color.array;
    const base = this.mode === 'cloth' ? CLOTH : SOFT;
    const br = ((base >> 16) & 255) / 255, bg = ((base >> 8) & 255) / 255, bb = (base & 255) / 255;
    const pr = ((PIN >> 16) & 255) / 255, pg = ((PIN >> 8) & 255) / 255, pb = (PIN & 255) / 255;
    for (let i = 0; i < this.nCorner; i++) {
      const vi = this.corner[i]; const m = this.pinned[vi] ? 1 : 0; const o = i * 3;
      c[o] = br * (1 - m) + pr * m; c[o + 1] = bg * (1 - m) + pg * m; c[o + 2] = bb * (1 - m) + pb * m;
    }
    this._geo.attributes.color.needsUpdate = true;
  }
  _recomputeNormals() {
    const vn = this.vnrm; vn.fill(0); const vp = this.vpos, corner = this.corner;
    for (let f = 0; f < this.nCorner; f += 3) {
      const a = corner[f], b = corner[f + 1], c = corner[f + 2];
      const ax = vp[a * 3], ay = vp[a * 3 + 1], az = vp[a * 3 + 2];
      const e1x = vp[b * 3] - ax, e1y = vp[b * 3 + 1] - ay, e1z = vp[b * 3 + 2] - az;
      const e2x = vp[c * 3] - ax, e2y = vp[c * 3 + 1] - ay, e2z = vp[c * 3 + 2] - az;
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      vn[a * 3] += nx; vn[a * 3 + 1] += ny; vn[a * 3 + 2] += nz;
      vn[b * 3] += nx; vn[b * 3 + 1] += ny; vn[b * 3 + 2] += nz;
      vn[c * 3] += nx; vn[c * 3 + 1] += ny; vn[c * 3 + 2] += nz;
    }
    for (let i = 0; i < this.nUnique; i++) { const x = vn[i * 3], y = vn[i * 3 + 1], z = vn[i * 3 + 2]; const l = Math.hypot(x, y, z) || 1; vn[i * 3] = x / l; vn[i * 3 + 1] = y / l; vn[i * 3 + 2] = z / l; }
    const nrm = this._geo.attributes.normal.array;
    for (let i = 0; i < this.nCorner; i++) { const vi = this.corner[i] * 3, o = i * 3; nrm[o] = vn[vi]; nrm[o + 1] = vn[vi + 1]; nrm[o + 2] = vn[vi + 2]; }
    this._geo.attributes.normal.needsUpdate = true;
  }
  _frame() {
    const c = this.modelCenter, r = this.modelRadius;
    this.controls.target.copy(c);
    this.camera.position.set(c.x + r * 0.7, c.y + r * 0.25, c.z + r * 2.7); this.controls.update();
  }

  // ---------------------------------------------------------- INTERACTION
  _bindPointer() {
    const c = this.canvas;
    const ndc = e => { const r = c.getBoundingClientRect(); this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    c.addEventListener('pointermove', e => {
      ndc(e);
      if (this._cdrag) { this._dragContainer(); return; }
      if (this._grab) { this._dragGrab(); return; }
      if (this.pinMode) this._updateRing();
    });
    c.addEventListener('pointerdown', e => {
      if (e.button !== 0) return; ndc(e);
      if (this._placeMode) { e.preventDefault(); this._placeLiquidAtPointer(); return; }
      if (!this.pinMode) {
        const ch = this._pickContainer();
        if (ch) { e.preventDefault(); this._beginContainerDrag(ch); return; }
      }
      if (!this.mesh) return;
      const hit = this._pick(); if (!hit) return; e.preventDefault();
      if (this.pinMode) { this._paintPin(hit.point, e.altKey); this.controls.enableRotate = false; this._painting = true; }
      else { this._beginGrab(hit); }
    });
    window.addEventListener('pointerup', () => { this._grab = null; this._cdrag = null; this._painting = false; this.controls.enableRotate = true; });
    c.addEventListener('pointermove', e => { if (this._painting && this.pinMode) { ndc(e); const hit = this._pick(); if (hit) this._paintPin(hit.point, e.altKey); } });
    c.addEventListener('pointerleave', () => { this._ring.visible = false; });
  }
  _pick() {
    if (!this.mesh) return null;
    this._ray.setFromCamera(this._ndc, this.camera);
    const hit = this._ray.intersectObject(this.mesh, false)[0];
    return hit ? { point: hit.point } : null;
  }
  _nearestVert(p) {
    let best = -1, bd = Infinity; const vp = this.vpos;
    for (let i = 0; i < this.nUnique; i++) { const dx = vp[i * 3] - p.x, dy = vp[i * 3 + 1] - p.y, dz = vp[i * 3 + 2] - p.z; const d = dx * dx + dy * dy + dz * dz; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  _beginGrab(hit) {
    if (!this.view) return;
    const i = this._nearestVert(hit.point);
    const r = this.modelRadius * 0.18;
    const group = [];
    const vp = this.vpos, c = hit.point;
    for (let k = 0; k < this.nUnique; k++) { const dx = vp[k * 3] - c.x, dy = vp[k * 3 + 1] - c.y, dz = vp[k * 3 + 2] - c.z; const d = Math.hypot(dx, dy, dz); if (d < r) group.push([k, 1 - d / r]); }
    // drag plane through hit, facing camera
    const nrm = this.camera.getWorldDirection(new THREE.Vector3()).negate();
    this._grab = { center: hit.point.clone(), group, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(nrm, hit.point) };
    this.controls.enableRotate = false;
    if (!this.simulating) { /* allow posing static */ }
  }
  _dragGrab() {
    if (!this._grab || !this.view) return;
    this._ray.setFromCamera(this._ndc, this.camera);
    const tp = new THREE.Vector3();
    if (!this._ray.ray.intersectPlane(this._grab.plane, tp)) return;
    const dx = tp.x - this._grab.center.x, dy = tp.y - this._grab.center.y, dz = tp.z - this._grab.center.z;
    const pos = this.view.pos, prev = this.view.prev;
    for (const [k, w] of this._grab.group) {
      const ox = this.vpos[k * 3] + dx * w, oy = this.vpos[k * 3 + 1] + dy * w, oz = this.vpos[k * 3 + 2] + dz * w;
      pos[k * 3] = ox; pos[k * 3 + 1] = oy; pos[k * 3 + 2] = oz;
      if (!this.simulating) { prev[k * 3] = ox; prev[k * 3 + 1] = oy; prev[k * 3 + 2] = oz; }
    }
    if (!this.simulating) { this.vpos.set(pos); this._recomputeNormals(); this._writePositions(); }
  }
  _paintPin(p, erase) {
    const r = this.pinPaintRadius * this.modelRadius; const vp = this.vpos;
    let changed = false;
    for (let i = 0; i < this.nUnique; i++) {
      const dx = vp[i * 3] - p.x, dy = vp[i * 3 + 1] - p.y, dz = vp[i * 3 + 2] - p.z;
      if (Math.hypot(dx, dy, dz) < r) { const v = erase ? 0 : 1; if (this.pinned[i] !== v) { this.pinned[i] = v; this.invMass[i] = v ? 0 : 1; changed = true; } }
    }
    if (changed) { if (this.view) this.view.invMass.set(this.invMass); this._writeColors(); if (this.onStats) this.onStats(this.stats()); }
  }
  _updateRing() {
    this._ray.setFromCamera(this._ndc, this.camera);
    const hit = this.mesh && this._ray.intersectObject(this.mesh, false)[0];
    if (!hit) { this._ring.visible = false; return; }
    const r = this.pinPaintRadius * this.modelRadius;
    this._ring.visible = true; this._ring.position.copy(hit.point);
    this._ring.scale.setScalar(r); this._ring.lookAt(this.camera.position);
  }

  // ---------------------------------------------------------- CONTROLS API
  play() { if (this.mesh) { this.simulating = true; this._changed(); } }
  pause() { this.simulating = false; this._changed(); }
  toggle() { this.simulating = !this.simulating && this.hasModel(); this._changed(); return this.simulating; }
  reset() {
    if (this.view) {
      this.view.pos.set(this.vpos0 || this.vpos);
      this.view.prev.set(this.vpos0 || this.vpos);
      if (this.vpos0) { this.vpos.set(this.vpos0); this._recomputeNormals(); this._writePositions(); }
    }
    if (this.liq && this.liq.pos0) { const s = this.liq.pos0.subarray(0, this.liq.n * 3); this.liq.pos.set(s); this.liq.prev.set(s); this._writeLiquid(); }
    this.stopProgram();
    this.resetContainerPose();
    this._t = 0;
  }
  rememberRest() { this.vpos0 = this.vpos.slice(0); }
  setGravity(v) { this.gravity = v; }
  setStiffness(v) { this.stiffness = Math.max(1, v | 0); }
  setDamping(v) { this.damping = Math.min(0.9999, Math.max(0.9, v)); }
  setWind(v) { this.wind = v; }
  setWindAngle(deg) { const a = deg * Math.PI / 180; this.windDir.set(Math.cos(a), 0.12, Math.sin(a)).normalize(); }
  setPinMode(on) { this.pinMode = on; if (!on) this._ring.visible = false; this._changed(); }
  clearPins() { this.pinned.fill(0); this.invMass.fill(1); if (this.view) this.view.invMass.set(this.invMass); this._writeColors(); if (this.onStats) this.onStats(this.stats()); }
  flick(impulse = 0.06) {
    // give every free particle a random shove — instant "boing"
    if (!this.view) return; const pos = this.view.pos, im = this.view.invMass;
    for (let i = 0; i < this.nUnique; i++) if (im[i] > 0) { pos[i * 3] += (Math.random() - 0.5) * impulse; pos[i * 3 + 1] += (Math.random() - 0.2) * impulse; pos[i * 3 + 2] += (Math.random() - 0.5) * impulse; }
    this.simulating = true; this._changed();
  }

  // ============================================================
  // LIQUID — granular position-based fluid (JS, spatial hash)
  // ============================================================
  setLiquidBall(R, spacing) { this._liqSpawn = { R, spacing }; }
  setLiquidViscosity(v) { this.liqVisc = Math.min(1, Math.max(0, v)); }
  setPlaceMode(on) { this._placeMode = !!on; this._changed(); }
  liquidCount() { return this.liq ? this.liq.n : 0; }

  spawnLiquid(center) {
    const { R } = this._liqSpawn;
    const sp = (this.liq && this.liq.n) ? this.liq.spacing : this._liqSpawn.spacing;
    const pts = [];
    for (let x = -R; x <= R; x += sp) for (let y = -R; y <= R; y += sp) for (let z = -R; z <= R; z += sp)
      if (x * x + y * y + z * z <= R * R) pts.push(x, y, z);
    if (!pts.length) pts.push(0, 0, 0);
    const add = pts.length / 3;
    const cur = this.liq ? this.liq.n : 0;
    if (cur + add > 12000) return { ok: false, reason: 'That would exceed the 12k particle budget — clear some liquid first' };
    const c = center || this._liquidSpawnPoint(R);
    this._ensureLiquid(cur + add, sp);
    const L = this.liq, jit = sp * 0.12;
    for (let k = 0; k < add; k++) {
      const o = (cur + k) * 3;
      L.pos[o] = c.x + pts[k * 3] + (Math.random() - 0.5) * jit;
      L.pos[o + 1] = Math.max(this.groundY + sp * 0.5, c.y + pts[k * 3 + 1] + (Math.random() - 0.5) * jit);
      L.pos[o + 2] = c.z + pts[k * 3 + 2] + (Math.random() - 0.5) * jit;
      L.prev[o] = L.pos[o]; L.prev[o + 1] = L.pos[o + 1]; L.prev[o + 2] = L.pos[o + 2];
      L.pos0[o] = L.pos[o]; L.pos0[o + 1] = L.pos[o + 1]; L.pos0[o + 2] = L.pos[o + 2];
    }
    L.n = cur + add;
    L.mesh.count = L.n;
    this._writeLiquid();
    this.simulating = true;
    this._changed(); if (this.onStats) this.onStats(this.stats());
    return { ok: true, n: L.n, added: add };
  }

  _liquidSpawnPoint(R) {
    if (this.container) {
      const g = this.container.group.position;
      return V(g.x, g.y + (this.container.topY || 1) + R + 0.12, g.z);
    }
    return V(0, 1.4, 0);
  }

  _ensureLiquid(total, sp) {
    if (!this.liq) {
      this.liq = { n: 0, cap: 0, spacing: sp, pos: null, prev: null, pos0: null, mesh: null, _head: null, _next: null, _tableSize: 0 };
    }
    const L = this.liq;
    if (total > L.cap) {
      let cap = Math.max(1024, L.cap || 0); while (cap < total) cap *= 2;
      const grow = (old) => { const a = new Float32Array(cap * 3); if (old) a.set(old.subarray(0, L.n * 3)); return a; };
      L.pos = grow(L.pos); L.prev = grow(L.prev); L.pos0 = grow(L.pos0);
      L._next = new Int32Array(cap);
      let ts = 1; while (ts < cap * 2) ts *= 2;
      L._tableSize = ts; L._head = new Int32Array(ts);
      if (L.mesh) { this.scene.remove(L.mesh); L.mesh.geometry.dispose(); L.mesh.material.dispose(); }
      const geo = new THREE.SphereGeometry(L.spacing * 0.62, 10, 8);
      const mat = this._makeWaterMaterial();
      L.mesh = new THREE.InstancedMesh(geo, mat, cap);
      L.mesh.castShadow = true; L.mesh.frustumCulled = false;
      L.mesh.count = L.n;
      L.mesh.visible = true;
      this.scene.add(L.mesh);
      L.cap = cap;
    }
  }

  clearLiquid() {
    const L = this.liq; if (!L) return;
    if (L.mesh) { this.scene.remove(L.mesh); L.mesh.geometry.dispose(); L.mesh.material.dispose(); }
    if (this._mcHQ) this._mcHQ.visible = false;
    this.liq = null;
    this._changed(); if (this.onStats) this.onStats(this.stats());
  }

  setLiquidDisplay() { /* live view is always balls now — fluid is rendered offline at export time */ }

  // ---- water look (shared by the live balls and the offline fluid surface) ----
  _applyWaterStyle(mat) {
    const S = this.waterStyle;
    mat.color.set(S.color);
    mat.roughness = 0.05 + (1 - S.gloss) * 0.55;
    mat.metalness = 0.0;
    mat.emissive.set(S.color);
    mat.emissiveIntensity = S.glow * 0.85;
    mat.transparent = S.opacity < 0.999;
    mat.opacity = S.opacity;
    mat.depthWrite = S.opacity >= 0.999;
    mat.needsUpdate = true;
  }
  _makeWaterMaterial() {
    const mat = new THREE.MeshStandardMaterial();
    this._applyWaterStyle(mat);
    return mat;
  }
  setWaterStyle(s) {
    Object.assign(this.waterStyle, s || {});
    if (this.liq && this.liq.mesh) this._applyWaterStyle(this.liq.mesh.material);
    if (this._mcHQ) this._applyWaterStyle(this._mcHQ.material);
  }

  // ---- scene options (useful to clean the frame before recording) ----
  setGridVisible(v) { this.grid.visible = !!v; }
  setShadowVisible(v) { if (this._floor) this._floor.visible = !!v; }
  setBackground(color) {
    this._bgOverride = color || null;
    const c = color || (function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})();
    this.scene.background = new THREE.Color(c);
  }

  _writeLiquid() {
    const L = this.liq; if (!L || !L.mesh) return;
    const m = this._tmpM, p = L.pos;
    for (let i = 0; i < L.n; i++) { m.makeTranslation(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); L.mesh.setMatrixAt(i, m); }
    L.mesh.count = L.n;
    L.mesh.instanceMatrix.needsUpdate = true;
  }

  // high-res metaball object — used ONLY by the offline export renderer
  _ensureMCHQ() {
    if (this._mcHQ) return;
    const mat = this._makeWaterMaterial();
    this._mcHQ = new MarchingCubes(64, mat, false, false, 600000);
    this._mcHQ.castShadow = true; this._mcHQ.frustumCulled = false; this._mcHQ.visible = false;
    this.scene.add(this._mcHQ);
  }
  _updateMC(mc, p, n, spacing) {
    if (!n) { mc.visible = false; return; }
    let minX = 1e9, minY = 1e9, minZ = 1e9, maxX = -1e9, maxY = -1e9, maxZ = -1e9;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      if (p[o] < minX) minX = p[o]; if (p[o] > maxX) maxX = p[o];
      if (p[o + 1] < minY) minY = p[o + 1]; if (p[o + 1] > maxY) maxY = p[o + 1];
      if (p[o + 2] < minZ) minZ = p[o + 2]; if (p[o + 2] > maxZ) maxZ = p[o + 2];
    }
    const pad = spacing * 2.4;
    minX -= pad; minY -= pad; minZ -= pad; maxX += pad; maxY += pad; maxZ += pad;
    const side = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 0.25);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    mc.visible = true;
    mc.position.set(cx, cy, cz);
    mc.scale.setScalar(side / 2);
    mc.isolation = 80;
    const subtract = 12;
    const rn = (spacing * 1.25) / side;                 // metaball radius, normalized to the field cube
    const strength = rn * rn * (mc.isolation + subtract);
    mc.reset();
    const invSide = 1 / side;
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      mc.addBall((p[o] - cx) * invSide + 0.5, (p[o + 1] - cy) * invSide + 0.5, (p[o + 2] - cz) * invSide + 0.5, strength, subtract);
    }
    mc.update();
  }

  _cellHash(x, y, z) { return ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)); }

  _liquidStep(sdt) {
    const L = this.liq; if (!L || !L.n) return;
    const n = L.n, p = L.pos, q = L.prev, h = L.spacing, rad = h * 0.5;
    const dampE = Math.min(0.999, this.damping) * (1 - this.liqVisc * 0.09);
    const g = this.gravity * sdt * sdt;
    const gy = this.groundY;
    // verlet integrate
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const x = p[o], y = p[o + 1], z = p[o + 2];
      const vx = (x - q[o]) * dampE, vy = (y - q[o + 1]) * dampE, vz = (z - q[o + 2]) * dampE;
      q[o] = x; q[o + 1] = y; q[o + 2] = z;
      p[o] = x + vx; p[o + 1] = y + vy + g; p[o + 2] = z + vz;
    }
    // spatial hash
    const ts = L._tableSize, mask = ts - 1, head = L._head, next = L._next, inv = 1 / h;
    head.fill(-1);
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      const k = this._cellHash(Math.floor(p[o] * inv), Math.floor(p[o + 1] * inv), Math.floor(p[o + 2] * inv)) & mask;
      next[i] = head[k]; head[k] = i;
    }
    // pair separation + weak cohesion (2 relax iterations)
    const coh = 1.28 * h, coh2 = coh * coh;
    for (let it = 0; it < 2; it++) {
      for (let i = 0; i < n; i++) {
        const oi = i * 3;
        const cx = Math.floor(p[oi] * inv), cy = Math.floor(p[oi + 1] * inv), cz = Math.floor(p[oi + 2] * inv);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          let j = head[this._cellHash(cx + dx, cy + dy, cz + dz) & mask];
          while (j >= 0) {
            if (j > i) {
              const oj = j * 3;
              const ddx = p[oj] - p[oi], ddy = p[oj + 1] - p[oi + 1], ddz = p[oj + 2] - p[oi + 2];
              const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
              if (d2 > 1e-12 && d2 < coh2) {
                const d = Math.sqrt(d2);
                const s = d < h ? 0.5 * (h - d) / d * 0.85 : -0.5 * (d - h) / d * 0.014;
                p[oi] -= ddx * s; p[oi + 1] -= ddy * s; p[oi + 2] -= ddz * s;
                p[oj] += ddx * s; p[oj + 1] += ddy * s; p[oj + 2] += ddz * s;
              }
            }
            j = next[j];
          }
        }
      }
    }
    // ground + friction
    for (let i = 0; i < n; i++) {
      const o = i * 3;
      if (p[o + 1] < gy + rad) {
        p[o + 1] = gy + rad;
        q[o] += (p[o] - q[o]) * 0.22; q[o + 2] += (p[o + 2] - q[o + 2]) * 0.22;
      }
    }
    // container + sphere colliders
    if (this.container) this._pushOutContainer(p, n, rad, null);
    for (const col of this.colliders) {
      const cr = col.r + rad;
      for (let i = 0; i < n; i++) {
        const o = i * 3;
        const dx = p[o] - col.x, dy = p[o + 1] - col.y, dz = p[o + 2] - col.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < cr * cr && d2 > 1e-10) { const d = Math.sqrt(d2), s = cr / d; p[o] = col.x + dx * s; p[o + 1] = col.y + dy * s; p[o + 2] = col.z + dz * s; }
      }
    }
  }

  _placeLiquidAtPointer() {
    this._ray.setFromCamera(this._ndc, this.camera);
    const targets = [];
    if (this.container) targets.push(this.container.group);
    if (this.mesh) targets.push(this.mesh);
    let pt = null;
    const hit = targets.length ? this._ray.intersectObjects(targets, true)[0] : null;
    if (hit) pt = hit.point.clone().add(V(0, this._liqSpawn.R * 1.08, 0));
    else {
      const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()).negate(), this.controls.target);
      const tp = new THREE.Vector3();
      if (this._ray.ray.intersectPlane(pl, tp)) pt = tp;
    }
    if (!pt) return;
    pt.y = Math.max(pt.y, this.groundY + this._liqSpawn.R * 1.05);
    this._placeMode = false;
    const r = this.spawnLiquid(pt);
    if (!r.ok && this.onStatus) { /* budget hit — surface via stats/toast in the app */ }
    this._changed();
  }

  // ============================================================
  // CONTAINER — a rigid vessel (glass preset or imported mesh)
  // the liquid & soft bodies collide with. Moving it carries the
  // contents because collision happens in the vessel's LOCAL space.
  // ============================================================
  _glassMaterial(opacity) {
    return new THREE.MeshPhysicalMaterial({ color: 0xbfd6e4, transparent: true, opacity: opacity || 0.3,
      roughness: 0.08, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
  }

  addGlass() {
    this.removeContainer();
    const innerR = 0.42, wall = 0.055, H = 0.9, bt = 0.07, outerR = innerR + wall;
    const pts = [new THREE.Vector2(0.001, 0), new THREE.Vector2(outerR, 0), new THREE.Vector2(outerR, H),
      new THREE.Vector2(innerR, H), new THREE.Vector2(innerR, bt), new THREE.Vector2(0.001, bt)];
    const geo = new THREE.LatheGeometry(pts, 56);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this._glassMaterial(0.3));
    mesh.renderOrder = 20;
    const group = new THREE.Group(); group.add(mesh);
    this.scene.add(group);
    this.container = { group, kind: 'cup', cup: { innerR, outerR, H, bt }, topY: H, name: 'Glass', eps: 0.02,
      home: { p: group.position.clone(), q: group.quaternion.clone() } };
    this._containerSync();
    if (!this.mesh) { this.controls.target.set(0, H * 0.55, 0); this.camera.position.set(1.1, 0.9, 2.2); }
    this._changed(); if (this.onStats) this.onStats(this.stats());
  }

  async importContainer(buf, ext, name) {
    this._status('Parsing ' + (name || ext) + '…');
    let obj;
    if (ext === 'fbx') obj = this._fbx.parse(buf, '');
    else if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); obj = g.scene || (g.scenes && g.scenes[0]); }
    else if (ext === 'obj') obj = this._obj.parse(new TextDecoder().decode(buf));
    else throw new Error('Unsupported .' + ext);
    obj.updateMatrixWorld(true);
    const srcs = []; obj.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry) srcs.push(o); });
    if (!srcs.length) throw new Error('No mesh found in file');

    const geos = []; const gbox = new THREE.Box3();
    let tris = 0;
    for (const m of srcs) {
      let g = m.geometry.clone(); if (g.index) g = g.toNonIndexed();
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', g.attributes.position.clone());
      pg.applyMatrix4(m.matrixWorld); pg.computeBoundingBox(); gbox.union(pg.boundingBox);
      tris += pg.attributes.position.count / 3;
      geos.push(pg);
    }
    if (tris > 120000) throw new Error('Container mesh too heavy (' + Math.round(tris / 1000) + 'k tris) — decimate it first');
    const size = gbox.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const s = 1.25 / maxDim;
    const cx = (gbox.min.x + gbox.max.x) / 2, cz = (gbox.min.z + gbox.max.z) / 2, minY = gbox.min.y;
    const normM = new THREE.Matrix4().makeTranslation(-cx * s, -minY * s, -cz * s).multiply(new THREE.Matrix4().makeScale(s, s, s));
    const lbox = new THREE.Box3();
    for (const g of geos) { g.applyMatrix4(normM); g.computeVertexNormals(); g.computeBoundingBox(); lbox.union(g.boundingBox); }

    this.removeContainer();
    const group = new THREE.Group();
    const mat = this._glassMaterial(0.42);
    const rayMeshes = [];
    for (const g of geos) {
      const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = 20; group.add(mesh);
      const rm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); rm.updateMatrixWorld(true);
      rayMeshes.push(rm);
    }
    this.scene.add(group);
    const cname = (name || 'container').replace(/\.(glb|gltf|fbx|obj)$/i, '');
    this.container = { group, kind: 'mesh', topY: lbox.max.y, name: cname, home: { p: group.position.clone(), q: group.quaternion.clone() } };
    this._containerSync();
    await this._buildSDF(rayMeshes, lbox);
    rayMeshes.forEach(m => m.material.dispose());
    if (!this.mesh) { this.controls.target.copy(lbox.getCenter(new THREE.Vector3())); }
    this._status('');
    this._changed(); if (this.onStats) this.onStats(this.stats());
    return { name: cname, tris: Math.round(tris) };
  }

  // voxelize the container into a signed distance field (local space)
  async _buildSDF(rayMeshes, box) {
    const pad = 0.06;
    const min = box.min.clone().subScalar(pad), max = box.max.clone().addScalar(pad);
    const size = max.clone().sub(min);
    const maxDim = Math.max(size.x, size.y, size.z);
    const cell = maxDim / 56;
    const nx = Math.max(4, Math.ceil(size.x / cell)), ny = Math.max(4, Math.ceil(size.y / cell)), nz = Math.max(4, Math.ceil(size.z / cell));
    const inside = new Uint8Array(nx * ny * nz);
    const ray = new THREE.Raycaster();
    const dir = V(0, 0, 1);
    const idx = (x, y, z) => (z * ny + y) * nx + x;
    for (let ix = 0; ix < nx; ix++) {
      if ((ix & 3) === 0) { this._status('Building collision field… ' + Math.round(ix / nx * 100) + '%'); await new Promise(r => setTimeout(r, 0)); }
      for (let iy = 0; iy < ny; iy++) {
        const ox = min.x + (ix + 0.5) * cell, oy = min.y + (iy + 0.5) * cell;
        ray.set(V(ox, oy, min.z - cell), dir); ray.near = 0; ray.far = size.z + cell * 3;
        const raw = ray.intersectObjects(rayMeshes, false).map(h => h.distance).sort((a, b) => a - b);
        const hits = [];
        for (const d of raw) { if (!hits.length || d - hits[hits.length - 1] > cell * 0.02) hits.push(d); }
        if (!hits.length) continue;
        let hi = 0, in_ = false;
        for (let iz = 0; iz < nz; iz++) {
          const zdist = (min.z + (iz + 0.5) * cell) - (min.z - cell);
          while (hi < hits.length && hits[hi] < zdist) { in_ = !in_; hi++; }
          if (in_) inside[idx(ix, iy, iz)] = 1;
        }
      }
    }
    // chamfer distance transform (voxel units)
    this._status('Distancing…'); await new Promise(r => setTimeout(r, 0));
    const BIG = 1e6;
    const dist = new Float32Array(nx * ny * nz).fill(BIG);
    for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = idx(x, y, z), v = inside[i];
      const nb = (dx, dy, dz) => { const X = x + dx, Y = y + dy, Z = z + dz; return (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) ? 0 : inside[idx(X, Y, Z)]; };
      if (nb(1, 0, 0) !== v || nb(-1, 0, 0) !== v || nb(0, 1, 0) !== v || nb(0, -1, 0) !== v || nb(0, 0, 1) !== v || nb(0, 0, -1) !== v) dist[i] = 0.5;
    }
    const W1 = 1, W2 = 1.4142, W3 = 1.7321;
    const offs = [];
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0 && dz === 0) continue;
      const w = [0, W1, W2, W3][Math.abs(dx) + Math.abs(dy) + Math.abs(dz)];
      offs.push([dx, dy, dz, w]);
    }
    const pass = (fwd) => {
      const zs = fwd ? [0, nz, 1] : [nz - 1, -1, -1];
      for (let z = zs[0]; z !== zs[1]; z += zs[2]) for (let y = fwd ? 0 : ny - 1; fwd ? y < ny : y >= 0; y += fwd ? 1 : -1) for (let x = fwd ? 0 : nx - 1; fwd ? x < nx : x >= 0; x += fwd ? 1 : -1) {
        const i = idx(x, y, z); let d = dist[i];
        for (const [dx, dy, dz, w] of offs) {
          const X = x + dx, Y = y + dy, Z = z + dz;
          if (X < 0 || Y < 0 || Z < 0 || X >= nx || Y >= ny || Z >= nz) continue;
          const nd = dist[idx(X, Y, Z)] + w;
          if (nd < d) d = nd;
        }
        dist[i] = d;
      }
    };
    pass(true); pass(false);
    const data = new Float32Array(nx * ny * nz);
    for (let i = 0; i < data.length; i++) data[i] = (inside[i] ? -1 : 1) * Math.min(dist[i], 40) * cell;
    this.container.sdf = { data, nx, ny, nz, min: [min.x, min.y, min.z], cell };
    this.container.eps = cell * 0.75;
    this._status('');
  }

  _sd(x, y, z) {
    const C = this.container;
    if (C.kind === 'cup') {
      const { innerR, outerR, H, bt } = C.cup;
      const rd = Math.hypot(x, z);
      const d1 = Math.max(rd - outerR, Math.abs(y - H / 2) - H / 2);   // solid cylinder
      const d2 = Math.max(rd - innerR, bt - y);                        // open-top cavity
      return Math.max(d1, -d2);
    }
    const g = C.sdf; if (!g) return 1;
    const fx = (x - g.min[0]) / g.cell - 0.5, fy = (y - g.min[1]) / g.cell - 0.5, fz = (z - g.min[2]) / g.cell - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), z0 = Math.floor(fz);
    if (x0 < 0 || y0 < 0 || z0 < 0 || x0 >= g.nx - 1 || y0 >= g.ny - 1 || z0 >= g.nz - 1) return 1; // far outside
    const tx = fx - x0, ty = fy - y0, tz = fz - z0;
    const at = (X, Y, Z) => g.data[(Z * g.ny + Y) * g.nx + X];
    const c00 = at(x0, y0, z0) * (1 - tx) + at(x0 + 1, y0, z0) * tx;
    const c10 = at(x0, y0 + 1, z0) * (1 - tx) + at(x0 + 1, y0 + 1, z0) * tx;
    const c01 = at(x0, y0, z0 + 1) * (1 - tx) + at(x0 + 1, y0, z0 + 1) * tx;
    const c11 = at(x0, y0 + 1, z0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1, z0 + 1) * tx;
    return (c00 * (1 - ty) + c10 * ty) * (1 - tz) + (c01 * (1 - ty) + c11 * ty) * tz;
  }

  _pushOutContainer(arr, n, radius, invMassArr) {
    const C = this.container; if (!C || !C.inv || (C.kind === 'mesh' && !C.sdf)) return;
    const inv = C.inv, mat = C.mat, v = this._tmpV, eps = C.eps || 0.02;
    for (let i = 0; i < n; i++) {
      if (invMassArr && invMassArr[i] === 0) continue;
      const o = i * 3;
      v.set(arr[o], arr[o + 1], arr[o + 2]).applyMatrix4(inv);
      const d = this._sd(v.x, v.y, v.z);
      if (d >= radius) continue;
      const gx = this._sd(v.x + eps, v.y, v.z) - this._sd(v.x - eps, v.y, v.z);
      const gy = this._sd(v.x, v.y + eps, v.z) - this._sd(v.x, v.y - eps, v.z);
      const gz = this._sd(v.x, v.y, v.z + eps) - this._sd(v.x, v.y, v.z - eps);
      const gl = Math.hypot(gx, gy, gz);
      if (gl < 1e-6) { v.y += (radius - d); }
      else { const sc = (radius - d) / gl; v.x += gx * sc; v.y += gy * sc; v.z += gz * sc; }
      v.applyMatrix4(mat);
      arr[o] = v.x; arr[o + 1] = v.y; arr[o + 2] = v.z;
    }
  }

  _containerSync() {
    const C = this.container; if (!C) return;
    C.group.updateMatrixWorld(true);
    C.mat = C.group.matrixWorld;
    C.inv = (C.inv || new THREE.Matrix4()).copy(C.mat).invert();
  }

  removeContainer() {
    const C = this.container; if (!C) return;
    this.stopProgram();
    this._cdragTarget = null; this._cdrag = null;
    this.scene.remove(C.group);
    C.group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); } });
    this.container = null;
    this._changed(); if (this.onStats) this.onStats(this.stats());
  }

  hasContainer() { return !!this.container; }
  resetContainerPose() {
    const C = this.container; if (!C || !C.home) return;
    C.group.position.copy(C.home.p); C.group.quaternion.copy(C.home.q);
    this._containerSync();
  }

  _pickContainer() {
    if (!this.container) return null;
    this._ray.setFromCamera(this._ndc, this.camera);
    const hit = this._ray.intersectObjects(this.container.group.children, true)[0];
    return hit ? { point: hit.point } : null;
  }
  _beginContainerDrag(hit) {
    const nrm = this.camera.getWorldDirection(new THREE.Vector3()).negate();
    this._cdrag = { plane: new THREE.Plane().setFromNormalAndCoplanarPoint(nrm, hit.point),
      offset: this.container.group.position.clone().sub(hit.point) };
    this.controls.enableRotate = false;
  }
  _dragContainer() {
    if (!this._cdrag || !this.container) return;
    this._ray.setFromCamera(this._ndc, this.camera);
    const tp = new THREE.Vector3();
    if (!this._ray.ray.intersectPlane(this._cdrag.plane, tp)) return;
    tp.add(this._cdrag.offset);
    tp.y = Math.max(tp.y, this.groundY);
    // don't jump there — record a target; _advanceDrag approaches it with a
    // clamped speed so the contents can't tunnel through the walls
    this._cdragTarget = tp;
  }
  _advanceDrag(sdt) {
    const T = this._cdragTarget, C = this.container;
    if (!T || !C) return;
    const p = C.group.position;
    const dx = T.x - p.x, dy = T.y - p.y, dz = T.z - p.z;
    const len = Math.hypot(dx, dy, dz);
    const maxStep = 3.2 * sdt;                    // max container speed: 3.2 units/s
    if (len <= maxStep) { p.set(T.x, T.y, T.z); if (!this._cdrag) this._cdragTarget = null; }
    else { const s = maxStep / len; p.x += dx * s; p.y += dy * s; p.z += dz * s; }
  }

  // ============================================================
  // MOTION PROGRAM — timed steps that animate the container:
  //   {type:'rotate'|'move'|'wait', axis:'x'|'y'|'z', amount, dur}
  //   rotate amount = degrees · move amount = scene units · dur = seconds
  // ============================================================
  setProgram(steps) { this._progSteps = (steps || []).slice(); }
  programDuration() { return this._progSteps.reduce((s, x) => s + Math.max(0.05, +x.dur || 0), 0); }
  programActive() { return !!(this._prog && this._prog.playing); }
  runProgram(loop) {
    if (!this.container || !this._progSteps.length) return false;
    this._prog = { i: 0, t: 0, loop: !!loop, playing: true };
    if ((this.liq && this.liq.n) || this.mesh) this.simulating = true;
    this._changed();
    return true;
  }
  stopProgram() { if (this._prog) { this._prog = null; this._changed(); } }
  _ease(f) { return f * f * (3 - 2 * f); }
  _progStep(dt) {
    const P = this._prog, steps = this._progSteps, C = this.container;
    if (!P || !C || !steps.length) { this.stopProgram(); return; }
    let remaining = dt, guard = 0;
    while (remaining > 1e-9 && P.playing && guard++ < 32) {
      const st = steps[P.i];
      const dur = Math.max(0.05, +st.dur || 1);
      const t0 = P.t, t1 = Math.min(dur, t0 + remaining);
      const df = this._ease(t1 / dur) - this._ease(t0 / dur);
      if (st.type === 'rotate' && df) {
        const ang = (+st.amount || 0) * Math.PI / 180 * df;
        const ax = st.axis === 'x' ? V(1, 0, 0) : st.axis === 'y' ? V(0, 1, 0) : V(0, 0, 1);
        C.group.quaternion.premultiply(this._tmpQ.setFromAxisAngle(ax, ang));
      } else if (st.type === 'move' && df) {
        C.group.position[st.axis || 'x'] += (+st.amount || 0) * df;
      }
      remaining -= (t1 - t0); P.t = t1;
      if (t1 >= dur - 1e-9) {
        P.i++; P.t = 0;
        if (P.i >= steps.length) {
          if (P.loop) P.i = 0;
          else { this._prog = null; this._changed(); break; }
        }
      }
    }
    this._containerSync();
  }

  // ============================================================
  // CAPTURE — record the viewport to a video (MP4 where the
  // browser supports it, else WebM) or an animated GIF.
  // ============================================================
  async recordVideo(seconds) {
    if (this._recording) throw new Error('Already recording');
    this._recording = true;
    try {
      const stream = this.canvas.captureStream(60);
      const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
      const mime = (window.MediaRecorder && types.find(t => MediaRecorder.isTypeSupported(t))) || '';
      if (!window.MediaRecorder) throw new Error('MediaRecorder not supported in this browser');
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 10e6 } : undefined);
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise(res => { rec.onstop = res; });
      rec.start(250);
      await new Promise(r => setTimeout(r, Math.max(0.5, seconds) * 1000));
      rec.stop(); await stopped;
      const type = rec.mimeType || mime || 'video/webm';
      return { blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm' };
    } finally { this._recording = false; }
  }

  async recordGif(seconds, fps = 14, width = 480) {
    if (this._recording || this._gifCap) throw new Error('Already recording');
    this._recording = true;
    try {
      const srcW = this.canvas.width || 640, srcH = this.canvas.height || 360;
      const w = Math.min(width, srcW), h = Math.max(2, Math.round(srcH * (w / srcW)));
      const cnv = document.createElement('canvas'); cnv.width = w; cnv.height = h;
      const ctx = cnv.getContext('2d', { willReadFrequently: true });
      const frames = [];
      const maxFrames = Math.min(220, Math.max(2, Math.round(seconds * fps)));
      await new Promise(res => { this._gifCap = { ctx, w, h, frames, interval: 1000 / fps, nextT: 0, maxFrames, done: res }; });
      this._status('Encoding GIF…');
      const { GIFEncoder, quantize, applyPalette } = await import('https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js');
      const gif = GIFEncoder();
      const delay = Math.round(1000 / fps);
      for (let i = 0; i < frames.length; i++) {
        const palette = quantize(frames[i], 256);
        const index = applyPalette(frames[i], palette);
        gif.writeFrame(index, w, h, { palette, delay });
        if ((i & 7) === 7) { this._status('Encoding GIF… ' + Math.round(i / frames.length * 100) + '%'); await new Promise(r => setTimeout(r, 0)); }
      }
      gif.finish();
      this._status('');
      return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), ext: 'gif' };
    } finally { this._recording = false; this._gifCap = null; this._status(''); }
  }

  _gifFrame(now) {
    const G = this._gifCap; if (!G || !G.done) return;
    if (G.nextT && now < G.nextT) return;
    G.nextT = now + G.interval;
    G.ctx.drawImage(this.canvas, 0, 0, G.w, G.h);
    G.frames.push(new Uint8ClampedArray(G.ctx.getImageData(0, 0, G.w, G.h).data));
    if (G.frames.length >= G.maxFrames) { const done = G.done; G.done = null; done(); }
  }

  isRecording() { return this._recording; }

  // ============================================================
  // OFFLINE FLUID EXPORT — capture is cheap (balls stay on screen,
  // we just store particle/camera/container state per frame), then
  // the metaball water is rendered + encoded frame-by-frame with no
  // real-time budget. MP4 needs WebCodecs (Chrome); GIF works anywhere.
  // ============================================================
  _bakeTick(liqOn) {
    const B = this._bake; if (!B) return;
    if (B.count++ % B.every) return;
    const L = this.liq;
    const f = {
      liq: liqOn ? L.pos.slice(0, L.n * 3) : null,
      cam: [this.camera.position.x, this.camera.position.y, this.camera.position.z,
        this.camera.quaternion.x, this.camera.quaternion.y, this.camera.quaternion.z, this.camera.quaternion.w],
      cont: this.container ? [this.container.group.position.x, this.container.group.position.y, this.container.group.position.z,
        this.container.group.quaternion.x, this.container.group.quaternion.y, this.container.group.quaternion.z, this.container.group.quaternion.w] : null,
      mesh: this.mesh ? this.vpos.slice(0) : null,
    };
    B.frames.push(f);
    if (B.frames.length >= B.max) { const done = B.done; this._bake = null; done(); }
  }

  async recordOffline(seconds, fps, format) {
    if (this._recording) throw new Error('Already recording');
    if (format === 'mp4' && typeof VideoEncoder === 'undefined')
      throw new Error('Offline MP4 needs WebCodecs (recent Chrome/Edge) — use GIF, or switch water to live Balls mode');
    this._recording = true;
    try {
      const every = Math.max(1, Math.round(60 / fps));
      const realFps = 60 / every;
      const max = Math.max(2, Math.round(seconds * realFps));
      const perFrame = ((this.liq ? this.liq.n : 0) + (this.mesh ? this.nUnique : 0)) * 12 + 200;
      if (max * perFrame > 350e6) throw new Error('Too much to bake — shorten the clip or use less liquid');
      const frames = [];
      await new Promise(res => { this._bake = { frames, every, count: 0, max, done: res }; });
      return await this._renderOffline(frames, realFps, format);
    } finally { this._recording = false; this._bake = null; }
  }

  async _renderOffline(frames, fps, format) {
    const L = this.liq;
    const wasSim = this.simulating;
    this._offline = true; this.simulating = false; this.controls.enabled = false;
    try {
      if (L && L.n) { this._ensureMCHQ(); if (L.mesh) L.mesh.visible = false; }
      const W = (this.canvas.width || 640) & ~1, H = (this.canvas.height || 360) & ~1;
      let encoder = null, muxer = null, gifFrames = null, ctx2 = null, gw = 0, gh = 0, encErr = null;
      if (format === 'mp4') {
        const M = await import('https://esm.sh/mp4-muxer@5.0.1');
        muxer = new M.Muxer({ target: new M.ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H }, fastStart: 'in-memory' });
        encoder = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => { encErr = e; } });
        encoder.configure({ codec: 'avc1.420028', width: W, height: H, bitrate: 9e6, framerate: fps });
      } else {
        gifFrames = [];
        gw = Math.min(480, W); gh = Math.max(2, Math.round(H * gw / W));
        const cnv = document.createElement('canvas'); cnv.width = gw; cnv.height = gh;
        ctx2 = cnv.getContext('2d', { willReadFrequently: true });
      }
      for (let i = 0; i < frames.length; i++) {
        const F = frames[i];
        if (F.cam) {
          this.camera.position.set(F.cam[0], F.cam[1], F.cam[2]);
          this.camera.quaternion.set(F.cam[3], F.cam[4], F.cam[5], F.cam[6]);
          this.camera.updateMatrixWorld(true);
        }
        if (F.cont && this.container) {
          const g = this.container.group;
          g.position.set(F.cont[0], F.cont[1], F.cont[2]);
          g.quaternion.set(F.cont[3], F.cont[4], F.cont[5], F.cont[6]);
          g.updateMatrixWorld(true);
        }
        if (F.mesh && this.mesh) { this.vpos.set(F.mesh); this._recomputeNormals(); this._writePositions(); }
        if (F.liq && this._mcHQ) this._updateMC(this._mcHQ, F.liq, F.liq.length / 3, L.spacing);
        this.renderer.render(this.scene, this.camera);
        if (format === 'mp4') {
          if (encErr) throw encErr;
          while (encoder.encodeQueueSize > 4) await new Promise(r => setTimeout(r, 4));
          const vf = new VideoFrame(this.canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
          encoder.encode(vf, { keyFrame: i % 60 === 0 }); vf.close();
        } else {
          ctx2.drawImage(this.canvas, 0, 0, gw, gh);
          gifFrames.push(new Uint8ClampedArray(ctx2.getImageData(0, 0, gw, gh).data));
        }
        if ((i & 3) === 3) { this._status('Rendering water… ' + Math.round((i + 1) / frames.length * 100) + '%'); await new Promise(r => setTimeout(r, 0)); }
      }
      if (format === 'mp4') {
        this._status('Finalizing MP4…');
        await encoder.flush(); muxer.finalize();
        if (encErr) throw encErr;
        return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
      }
      this._status('Encoding GIF…');
      const { GIFEncoder, quantize, applyPalette } = await import('https://unpkg.com/gifenc@1.0.3/dist/gifenc.esm.js');
      const gif = GIFEncoder(); const delay = Math.round(1000 / fps);
      for (let i = 0; i < gifFrames.length; i++) {
        const palette = quantize(gifFrames[i], 256);
        gif.writeFrame(applyPalette(gifFrames[i], palette), gw, gh, { palette, delay });
        if ((i & 7) === 7) { this._status('Encoding GIF… ' + Math.round(i / gifFrames.length * 100) + '%'); await new Promise(r => setTimeout(r, 0)); }
      }
      gif.finish();
      return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), ext: 'gif' };
    } finally {
      this._offline = false; this.controls.enabled = true; this.simulating = wasSim;
      if (this._mcHQ) this._mcHQ.visible = false;
      if (L && L.mesh) L.mesh.visible = true;
      this._status('');
    }
  }

  stats() {
    let pins = 0; if (this.pinned) for (let i = 0; i < this.nUnique; i++) if (this.pinned[i]) pins++;
    const fluid = this.liq ? this.liq.n : 0;
    const name = this.mesh ? this.modelName : (this.container ? this.container.name + (fluid ? ' + liquid' : '') : (fluid ? 'Liquid' : this.modelName));
    const mode = this.mesh ? this.mode : (fluid ? 'liquid' : (this.container ? 'container' : this.mode));
    return { name, mode, verts: this.mesh ? this.nUnique : 0, tris: this.mesh ? this.nCorner / 3 : 0, constraints: this.mesh && this._edges ? this._edges.length / 2 : 0, pins, fluid,
      container: this.container ? this.container.name : '', placeMode: this._placeMode, sim: this.simulating, program: this._prog ? (this._prog.loop ? 'loop' : 'run') : '' };
  }

  _disposeMesh() {
    if (this.colliders && this.colliders.length) this.clearColliders();
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null; }
    this.vpos0 = null;
  }
}
