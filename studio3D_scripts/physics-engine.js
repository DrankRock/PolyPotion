// ============================================================
// physics-engine.js — real-time soft-body & cloth on imported meshes.
// Particles + distance/bending constraints solved by the hand-authored
// WASM XPBD core (wasm-physics.js). Runs entirely client-side.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { fetchAssetBuffer } from './chunk-loader.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { createSolver } from './wasm-physics.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CLOTH = 0xc25b54, SOFT = 0xb9a690, PIN = 0x4d82d6, RING = 0x43b6c4;

export class PHEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})());
    window.addEventListener("studiothemechange", () => { try { this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})()); } catch(e){} });
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 100);
    this.camera.position.set(1.8, 1.4, 3.4);
    this.controls = new OrbitControls(this.camera, canvas);
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
  hasModel() { return !!this.mesh; }

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
    const dt = 1 / 60;
    if (this.simulating && this.mesh) {
      this._t += dt;
      const sub = this.substeps, sdt = dt / sub;
      for (let s = 0; s < sub; s++) this._simStep(sdt);
      // copy solver positions back to vpos, refresh render
      if (this.view) this.vpos.set(this.view.pos);
      this._recomputeNormals(); this._writePositions();
      // fps
      this._fpsN++; if (now - this._fpsT > 500) { const f = Math.round(this._fpsN * 1000 / (now - this._fpsT)); this._fpsN = 0; this._fpsT = now; if (this.onFps) this.onFps(f); }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
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
      if (this._grab) { this._dragGrab(); return; }
      if (this.pinMode) this._updateRing();
    });
    c.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !this.mesh) return; ndc(e);
      const hit = this._pick(); if (!hit) return; e.preventDefault();
      if (this.pinMode) { this._paintPin(hit.point, e.altKey); this.controls.enableRotate = false; this._painting = true; }
      else { this._beginGrab(hit); }
    });
    window.addEventListener('pointerup', () => { this._grab = null; this._painting = false; this.controls.enableRotate = true; });
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
  toggle() { this.simulating = !this.simulating && !!this.mesh; this._changed(); return this.simulating; }
  reset() {
    if (!this.view) return;
    this.view.pos.set(this.vpos0 || this.vpos);
    this.view.prev.set(this.vpos0 || this.vpos);
    if (this.vpos0) { this.vpos.set(this.vpos0); this._recomputeNormals(); this._writePositions(); }
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

  stats() {
    let pins = 0; if (this.pinned) for (let i = 0; i < this.nUnique; i++) if (this.pinned[i]) pins++;
    return { name: this.modelName, mode: this.mode, verts: this.nUnique, tris: this.nCorner / 3, constraints: this._edges ? this._edges.length / 2 : 0, pins, sim: this.simulating };
  }

  _disposeMesh() {
    if (this.colliders && this.colliders.length) this.clearColliders();
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null; }
    this.vpos0 = null;
  }
}
