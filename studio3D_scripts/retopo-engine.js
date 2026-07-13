// ============================================================
// retopo-engine.js — RETOPO  (RetopoEngine)
// Guided retopology: load any mesh (GLB/FBX/OBJ) as a REFERENCE surface,
// then hand-draw a clean, all-quad cage directly on top of it:
//   · QUAD DRAW — click 4 points on the surface → a quad; click near an
//     open boundary edge afterwards → a new quad extrudes from that edge
//     toward the cursor (the classic strip-building workflow)
//   · X-SYMMETRY — every point, quad, move and delete is mirrored across
//     X=0; points near the centreline weld onto it exactly
//   · MOVE — drag any cage vertex, it stays glued to the reference surface;
//     drop it on another vertex to weld them (closes loops)
//   · RELAX — brush over the cage: Laplacian smoothing re-spaced along the
//     surface (every smoothed vertex is re-projected onto the reference)
//   · DELETE — click a quad to remove it (mirror removed too)
// Winding is auto-oriented against the reference surface normal, so the
// exported cage is consistently outward-facing. Export packs the cage into
// an indexed GLB (two triangles per quad, shared verts, fresh normals).
// Loaded by dynamic import from Retopo.dc.html, like the other engines.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';
import { fetchAssetBuffer } from './chunk-loader.js';

const COL = {
  fill: 0xff7a2f, fillMirror: 0xff7a2f,
  wire: 0xffa15e, point: 0xffd2b0, draft: 0x7fd7b8,
  boundary: 0x39c58f, hover: 0xffe27a,
};

export class RetopoEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    const vpBg = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };
    this.scene.background = new THREE.Color(vpBg());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(vpBg()); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 100);
    this.camera.position.set(1.4, 1.2, 3.0);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);

    const hemi = new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.05); this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(2.4, 4.2, 3.0); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.5); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.modelRoot = new THREE.Group(); this.scene.add(this.modelRoot);   // reference
    this.cageRoot = new THREE.Group(); this.scene.add(this.cageRoot);     // retopo overlays

    this.refMeshes = [];            // Mesh list for raycasting
    this.modelName = ''; this.modelRadius = 1; this.modelCenter = new THREE.Vector3(0, 0.95, 0);
    this._origBuffer = null; this._origExt = 'glb';

    // --- retopo topology (arrays may contain null holes after deletes) ---
    this.verts = [];                // { p:Vector3, m:int }  m = mirror index (own index if on centreline / no mirror)
    this.quads = [];                // { v:[a,b,c,d], m:int } m = mirror quad index (own index if self-mirrored)
    this.draft = [];                // vert indices of in-progress quad-draw clicks (0..3)
    this._undo = [];

    this.mode = 'draw';             // draw | move | relax | delete
    this.symmetry = true;
    this.xray = false; this.refVisible = true;
    this.brushRadius = 0.12;        // fraction of model radius
    this.brushStrength = 0.5;

    this._hoverEdge = null;         // {a,b,qi} boundary edge under cursor (draw mode)
    this._hoverQuad = -1;           // quad under cursor (delete mode)
    this._dragVert = -1;

    this.ray = new THREE.Raycaster();
    this.onChange = null; this.onStatus = null;
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();

    this._buildOverlays();
    this._bindPointer();
    this._applyMouseButtons();

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__rtEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return this.refMeshes.length > 0; }
  stats() {
    let nv = 0, nq = 0; this.verts.forEach(v => { if (v) nv++; }); this.quads.forEach(q => { if (q) nq++; });
    return { name: this.modelName, verts: nv, quads: nq, tris: nq * 2, draft: this.draft.length, canUndo: this._undo.length > 0 };
  }

  // ---------------------------------------------------------- LOADING
  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts);
    return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop());
  }
  async loadFile(file) { return this._ingest(await file.arrayBuffer(), (file.name.split('.').pop() || '').toLowerCase(), file.name); }
  async loadBuffer(buf, name, ext) { return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name); }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || 'model') + '…');
    let obj = null;
    if (ext === 'glb' || ext === 'gltf') {
      const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej));
      obj = g.scene;
    } else if (ext === 'fbx') {
      obj = this._fbx.parse(buf, '');
    } else if (ext === 'obj') {
      obj = this._obj.parse(new TextDecoder().decode(buf));
    } else throw new Error('Unsupported format .' + ext);

    while (this.modelRoot.children.length) { const c = this.modelRoot.children.pop(); this.modelRoot.remove(c); }
    this.refMeshes = [];
    this.modelRoot.add(obj);

    // neutral clay material — the reference is a guide, not the star
    this._refMat = new THREE.MeshStandardMaterial({ color: 0x8a8f98, roughness: 0.92, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: 1.5, polygonOffsetUnits: 1.5 });
    obj.traverse(o => {
      if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
        o.frustumCulled = false; o.material = this._refMat; this.refMeshes.push(o);
      }
    });
    if (!this.refMeshes.length) throw new Error('No triangle meshes found in file');

    this.modelName = name || 'model';
    this._origBuffer = buf.slice ? buf.slice(0) : buf; this._origExt = ext;

    // fresh cage for a fresh reference
    this.verts = []; this.quads = []; this.draft = []; this._undo = [];
    this._hoverEdge = null; this._hoverQuad = -1;

    this._fitCamera();
    this.setXray(this.xray);
    this._rebuild();
    this._status('');
    this._changed();
    return { name: this.modelName };
  }

  _fitCamera() {
    const box = new THREE.Box3();
    this.refMeshes.forEach(({ geometry }, i) => { const m = this.refMeshes[i]; m.updateWorldMatrix(true, false); box.expandByObject(m); });
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    this.modelRadius = Math.max(s.x, s.y, s.z) * 0.5 || 1;
    this.modelCenter = c;
    this.controls.target.copy(c);
    const d = this.modelRadius * 2.8;
    this.camera.position.set(c.x + d * 0.5, c.y + d * 0.35, c.z + d);
    this.camera.near = Math.max(0.001, this.modelRadius / 200); this.camera.far = this.modelRadius * 60;
    this.camera.updateProjectionMatrix();
  }

  setView(v) {
    const c = this.modelCenter, d = this.modelRadius * 2.8;
    const P = { persp: [c.x + d * 0.5, c.y + d * 0.35, c.z + d], front: [c.x, c.y, c.z + d], side: [c.x + d, c.y, c.z], top: [c.x, c.y + d, c.z + 0.001], back: [c.x, c.y, c.z - d] }[v];
    if (P) { this.camera.position.set(P[0], P[1], P[2]); this.controls.target.copy(c); }
  }

  // ---------------------------------------------------------- MODES / SETTINGS
  setMode(m) { this.mode = m; if (m !== 'draw') this._setHoverEdge(null); this._hoverQuad = -1; this._applyMouseButtons(); this._rebuild(); this._changed(); }
  _applyMouseButtons() {
    // right-drag always orbits; left is the tool. (Middle = zoom, like the other tools.)
    this.controls.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  }
  setSymmetry(on) { this.symmetry = !!on; this._changed(); }
  setXray(on) {
    this.xray = !!on;
    if (this._refMat) { this._refMat.transparent = this.xray; this._refMat.opacity = this.xray ? 0.42 : 1; this._refMat.depthWrite = !this.xray; this._refMat.needsUpdate = true; }
  }
  setRefVisible(on) { this.refVisible = !!on; this.modelRoot.visible = this.refVisible; }
  setBrush(o) { if (o.radius != null) this.brushRadius = o.radius; if (o.strength != null) this.brushStrength = o.strength; }

  // ---------------------------------------------------------- UNDO
  _snap() {
    const vs = this.verts.map(v => v ? [v.p.x, v.p.y, v.p.z, v.m] : null);
    const qs = this.quads.map(q => q ? [q.v[0], q.v[1], q.v[2], q.v[3], q.m] : null);
    this._undo.push({ vs, qs, draft: this.draft.slice() });
    if (this._undo.length > 60) this._undo.shift();
  }
  undo() {
    const s = this._undo.pop(); if (!s) return false;
    this.verts = s.vs.map(a => a ? { p: new THREE.Vector3(a[0], a[1], a[2]), m: a[3] } : null);
    this.quads = s.qs.map(a => a ? { v: [a[0], a[1], a[2], a[3]], m: a[4] } : null);
    this.draft = s.draft.slice();
    this._setHoverEdge(null); this._hoverQuad = -1;
    this._rebuild(); this._changed();
    return true;
  }
  clearTopo() { if (!this.verts.length && !this.draft.length) return; this._snap(); this.verts = []; this.quads = []; this.draft = []; this._rebuild(); this._changed(); }
  cancelDraft() { if (!this.draft.length) return; this.draft = []; this._rebuild(); this._changed(); }

  // ---------------------------------------------------------- SURFACE HELPERS
  _pointerRay(e) {
    const r = this.canvas.getBoundingClientRect();
    const nd = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(nd, this.camera);
    return this.ray;
  }
  _hitSurface(e) {
    if (!this.refMeshes.length) return null;
    const hits = this._pointerRay(e).intersectObjects(this.refMeshes, false);
    return hits.length ? hits[0] : null;
  }
  // re-glue a cage point to the reference surface (cast in ± normal, keep nearest)
  _project(p, n) {
    if (!this.refMeshes.length) return p;
    const eps = this.modelRadius * 0.6;
    let best = null, bd = Infinity;
    const tryCast = (origin, dir) => {
      this.ray.set(origin, dir);
      this.ray.far = eps * 2;
      const hits = this.ray.intersectObjects(this.refMeshes, false);
      for (const h of hits) { const d = h.point.distanceTo(p); if (d < bd) { bd = d; best = h.point; } }
    };
    const dir = (n && n.lengthSq() > 0) ? n.clone().normalize() : this.camera.getWorldDirection(new THREE.Vector3()).negate();
    tryCast(p.clone().addScaledVector(dir, eps), dir.clone().negate());
    tryCast(p.clone().addScaledVector(dir, -eps), dir);
    this.ray.far = Infinity;
    return (best && bd < this.modelRadius * 0.35) ? best : p;
  }
  _surfaceNormalAt(p) {
    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    this.ray.set(p.clone().addScaledVector(dir, -this.modelRadius), dir);
    const hits = this.ray.intersectObjects(this.refMeshes, false);
    if (hits.length && hits[0].face) {
      const n = hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld);
      return n;
    }
    return null;
  }
  _vertNormal(i) {
    const n = new THREE.Vector3(); const a = new THREE.Vector3(), b = new THREE.Vector3();
    this.quads.forEach(q => {
      if (!q || q.v.indexOf(i) === -1) return;
      const [p0, p1, p2] = [this.verts[q.v[0]].p, this.verts[q.v[1]].p, this.verts[q.v[2]].p];
      a.subVectors(p1, p0); b.subVectors(p2, p0); n.add(a.clone().cross(b));
    });
    return n.lengthSq() > 0 ? n.normalize() : null;
  }

  // ---------------------------------------------------------- TOPOLOGY OPS
  _centerTol() { return this.modelRadius * 0.02; }
  _weldTol() { return this.modelRadius * 0.03; }

  _findNearVert(p, tol, skip) {
    let best = -1, bd = tol != null ? tol : this._weldTol();
    this.verts.forEach((v, i) => { if (!v || i === skip) return; const d = v.p.distanceTo(p); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  // create (or reuse) a cage vertex at surface point p — handles symmetry
  _addVert(p) {
    const near = this._findNearVert(p);
    if (near >= 0) return near;
    const P = p.clone();
    if (this.symmetry && Math.abs(P.x) < this._centerTol()) {
      P.x = 0;
      const i = this.verts.length; this.verts.push({ p: P, m: i }); return i;
    }
    const i = this.verts.length; this.verts.push({ p: P, m: i });
    if (this.symmetry) {
      const Pm = P.clone(); Pm.x = -Pm.x;
      const j = this.verts.length; this.verts.push({ p: Pm, m: i });
      this.verts[i].m = j;
    }
    return i;
  }

  // orient quad outward against the reference surface, then store (+ mirror)
  _addQuad(ids) {
    const pts = ids.map(i => this.verts[i].p);
    const cen = pts[0].clone().add(pts[1]).add(pts[2]).add(pts[3]).multiplyScalar(0.25);
    const n = new THREE.Vector3().subVectors(pts[1], pts[0]).cross(new THREE.Vector3().subVectors(pts[3], pts[0]));
    const sn = this._surfaceNormalAt(cen);
    let v = ids.slice();
    if (sn && n.dot(sn) < 0) v = [v[0], v[3], v[2], v[1]];
    const qi = this.quads.length; this.quads.push({ v, m: qi });
    if (this.symmetry) {
      const mv = v.map(i => this.verts[i].m);
      const same = mv.every((x, k) => x === v[k]);
      if (!same) {
        const qj = this.quads.length;
        this.quads.push({ v: [mv[0], mv[3], mv[2], mv[1]], m: qi });
        this.quads[qi].m = qj;
      }
    }
    return qi;
  }

  _moveVert(i, p) {
    const v = this.verts[i]; if (!v) return;
    v.p.copy(p);
    if (this.symmetry && v.m === i && Math.abs(v.p.x) < this._centerTol()) v.p.x = 0;
    if (v.m !== i && this.verts[v.m]) { const mp = v.p.clone(); mp.x = -mp.x; this.verts[v.m].p.copy(mp); }
  }

  _weldVerts(from, into) {
    if (from === into) return;
    const fm = this.verts[from] ? this.verts[from].m : from;
    const im = this.verts[into] ? this.verts[into].m : into;
    const remap = (a, b) => {
      this.quads.forEach(q => { if (q) q.v = q.v.map(x => x === a ? b : x); });
      this.draft = this.draft.map(x => x === a ? b : x);
      this.verts[a] = null;
    };
    remap(from, into);
    if (fm !== from && fm !== im && this.verts[fm]) remap(fm, im);
    // drop quads that collapsed (repeated verts)
    this.quads.forEach((q, qi) => { if (q && new Set(q.v).size < 4) this._nullQuad(qi); });
  }

  _nullQuad(qi) {
    const q = this.quads[qi]; if (!q) return;
    const mq = q.m;
    this.quads[qi] = null;
    if (mq !== qi && this.quads[mq]) this.quads[mq] = null;
  }

  _boundaryEdges() {
    const count = new Map(); const dir = new Map();
    const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
    this.quads.forEach((q, qi) => {
      if (!q) return;
      for (let k = 0; k < 4; k++) {
        const a = q.v[k], b = q.v[(k + 1) % 4], K = key(a, b);
        count.set(K, (count.get(K) || 0) + 1);
        dir.set(K, { a, b, qi });
      }
    });
    const out = [];
    count.forEach((c, K) => { if (c === 1) out.push(dir.get(K)); });
    return out;
  }

  // extrude a new quad from boundary edge (a→b as it appears in its quad) toward p
  _extrude(edge, p) {
    this._snap();
    const A = this.verts[edge.a].p, B = this.verts[edge.b].p;
    const mid = A.clone().add(B).multiplyScalar(0.5);
    const dir = p.clone().sub(mid);
    const n = this._surfaceNormalAt(mid);
    let A2 = this._project(A.clone().add(dir), n);
    let B2 = this._project(B.clone().add(dir), n);
    const ia2 = this._addVert(A2), ib2 = this._addVert(B2);
    // owner quad walks a→b, so the new quad walks b→a to face the same way
    this._addQuad([edge.b, edge.a, ia2, ib2]);
    this._rebuild(); this._changed();
  }

  // ---------------------------------------------------------- POINTER
  _bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointerdown', e => this._down(e));
    c.addEventListener('pointermove', e => this._move(e));
    window.addEventListener('pointerup', e => this._up(e));
    c.addEventListener('contextmenu', e => e.preventDefault());
  }

  _pickVertScreen(e, maxPx) {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    let best = -1, bd = maxPx || 14;
    const v = new THREE.Vector3();
    this.verts.forEach((vt, i) => {
      if (!vt) return;
      v.copy(vt.p).project(this.camera);
      if (v.z > 1) return;
      const sx = (v.x * 0.5 + 0.5) * r.width, sy = (-v.y * 0.5 + 0.5) * r.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  _pickBoundaryEdge(e, maxPx) {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const proj = (p, out) => { out.copy(p).project(this.camera); return { x: (out.x * 0.5 + 0.5) * r.width, y: (-out.y * 0.5 + 0.5) * r.height, z: out.z }; };
    const tmp = new THREE.Vector3();
    let best = null, bd = maxPx || 12;
    for (const ed of this._boundaryEdges()) {
      const a = proj(this.verts[ed.a].p, tmp); if (a.z > 1) continue;
      const b = proj(this.verts[ed.b].p, tmp); if (b.z > 1) continue;
      const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
      let t = L2 > 0 ? (((px - a.x) * dx + (py - a.y) * dy) / L2) : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
      if (d < bd) { bd = d; best = ed; }
    }
    return best;
  }

  _pickQuad(e) {
    if (!this._fill || !this._fill.visible) return -1;
    const hits = this._pointerRay(e).intersectObject(this._fill, false);
    if (!hits.length) return -1;
    const tri = hits[0].faceIndex;
    return this._triToQuad ? (this._triToQuad[tri] != null ? this._triToQuad[tri] : -1) : -1;
  }

  _down(e) {
    if (e.button !== 0 || !this.hasModel()) return;
    if (this.mode === 'draw') {
      // near a boundary edge? extrude. otherwise place a draft point.
      const hit = this._hitSurface(e);
      const edge = this._pickBoundaryEdge(e);
      if (edge && hit) { this._extrude(edge, hit.point); return; }
      if (!hit) return;
      this._snap();
      const vi = this._addVert(hit.point);
      if (this.draft.indexOf(vi) === -1) this.draft.push(vi);
      if (this.draft.length >= 4) { this._addQuad(this.draft.slice(0, 4)); this.draft = []; }
      this._rebuild(); this._changed();
    } else if (this.mode === 'move') {
      const vi = this._pickVertScreen(e);
      if (vi >= 0) { this._snap(); this._dragVert = vi; this.canvas.setPointerCapture(e.pointerId); }
    } else if (this.mode === 'relax') {
      this._snap(); this._relaxing = true; this._relaxAt(e); this.canvas.setPointerCapture(e.pointerId);
    } else if (this.mode === 'delete') {
      const qi = this._pickQuad(e);
      if (qi >= 0) { this._snap(); this._nullQuad(qi); this._pruneOrphans(); this._rebuild(); this._changed(); }
    }
  }

  _move(e) {
    if (!this.hasModel()) return;
    if (this._dragVert >= 0) {
      const hit = this._hitSurface(e);
      if (hit) { this._moveVert(this._dragVert, hit.point); this._rebuild(); }
      return;
    }
    if (this._relaxing) { this._relaxAt(e); return; }
    if (this.mode === 'draw') {
      const edge = this._pickBoundaryEdge(e);
      this._setHoverEdge(edge);
    } else if (this.mode === 'delete') {
      const qi = this._pickQuad(e);
      if (qi !== this._hoverQuad) { this._hoverQuad = qi; this._rebuild(); }
    }
  }

  _up(e) {
    if (this._dragVert >= 0) {
      const near = this._findNearVert(this.verts[this._dragVert].p, this._weldTol(), this._dragVert);
      if (near >= 0 && near !== this.verts[this._dragVert].m) { this._weldVerts(this._dragVert, near); }
      this._dragVert = -1; this._rebuild(); this._changed();
    }
    if (this._relaxing) { this._relaxing = false; this._changed(); }
  }

  _relaxAt(e) {
    const hit = this._hitSurface(e); if (!hit) return;
    const R = this.brushRadius * this.modelRadius * 2;
    const S = this.brushStrength;
    // neighbour graph
    const nb = new Map();
    this.quads.forEach(q => {
      if (!q) return;
      for (let k = 0; k < 4; k++) {
        const a = q.v[k], b = q.v[(k + 1) % 4];
        if (!nb.has(a)) nb.set(a, new Set()); if (!nb.has(b)) nb.set(b, new Set());
        nb.get(a).add(b); nb.get(b).add(a);
      }
    });
    const moved = [];
    nb.forEach((ns, i) => {
      const v = this.verts[i]; if (!v) return;
      const d = v.p.distanceTo(hit.point); if (d > R) return;
      const fall = 1 - (d / R); const w = S * fall * fall;
      const avg = new THREE.Vector3();
      let n = 0; ns.forEach(j => { if (this.verts[j]) { avg.add(this.verts[j].p); n++; } });
      if (!n) return;
      avg.multiplyScalar(1 / n);
      const target = v.p.clone().lerp(avg, w);
      const nrm = this._vertNormal(i);
      moved.push([i, this._project(target, nrm)]);
    });
    moved.forEach(([i, p]) => this._moveVert(i, p));
    if (moved.length) this._rebuild();
  }

  _pruneOrphans() {
    const used = new Set(this.draft);
    this.quads.forEach(q => { if (q) q.v.forEach(i => used.add(i)); });
    this.verts.forEach((v, i) => { if (v && !used.has(i)) this.verts[i] = null; });
  }

  // ---------------------------------------------------------- OVERLAYS
  _buildOverlays() {
    this._fillMat = new THREE.MeshBasicMaterial({ color: COL.fill, transparent: true, opacity: 0.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, depthWrite: false });
    this._fillHotMat = new THREE.MeshBasicMaterial({ color: 0xd94f2f, transparent: true, opacity: 0.55, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false });
    this._fill = new THREE.Mesh(new THREE.BufferGeometry(), this._fillMat); this._fill.frustumCulled = false; this.cageRoot.add(this._fill);
    this._fillHot = new THREE.Mesh(new THREE.BufferGeometry(), this._fillHotMat); this._fillHot.frustumCulled = false; this.cageRoot.add(this._fillHot);
    this._wire = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COL.wire })); this._wire.frustumCulled = false; this.cageRoot.add(this._wire);
    this._bnd = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COL.boundary })); this._bnd.frustumCulled = false; this.cageRoot.add(this._bnd);
    this._hover = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: COL.hover, linewidth: 2 })); this._hover.frustumCulled = false; this.cageRoot.add(this._hover);
    this._pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: COL.point, size: 6, sizeAttenuation: false, depthTest: false })); this._pts.frustumCulled = false; this._pts.renderOrder = 5; this.cageRoot.add(this._pts);
    this._dpts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: COL.draft, size: 10, sizeAttenuation: false, depthTest: false })); this._dpts.frustumCulled = false; this._dpts.renderOrder = 6; this.cageRoot.add(this._dpts);
  }

  _setHoverEdge(edge) {
    const changed = JSON.stringify(edge && [edge.a, edge.b]) !== JSON.stringify(this._hoverEdge && [this._hoverEdge.a, this._hoverEdge.b]);
    this._hoverEdge = edge;
    if (!changed) return;
    const arr = [];
    if (edge && this.verts[edge.a] && this.verts[edge.b]) {
      const A = this.verts[edge.a].p, B = this.verts[edge.b].p;
      arr.push(A.x, A.y, A.z, B.x, B.y, B.z);
    }
    this._hover.geometry.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  }

  _rebuild() {
    // fill (2 tris per quad) + tri→quad map for delete picking
    const fp = [], hp = [];
    this._triToQuad = [];
    this.quads.forEach((q, qi) => {
      if (!q) return;
      const P = q.v.map(i => this.verts[i].p);
      const isHot = qi === this._hoverQuad || (this._hoverQuad >= 0 && this.quads[this._hoverQuad] && this.quads[this._hoverQuad].m === qi);
      const dst = isHot ? hp : fp;
      dst.push(P[0].x, P[0].y, P[0].z, P[1].x, P[1].y, P[1].z, P[2].x, P[2].y, P[2].z);
      dst.push(P[0].x, P[0].y, P[0].z, P[2].x, P[2].y, P[2].z, P[3].x, P[3].y, P[3].z);
      if (!isHot) { this._triToQuad.push(qi, qi); }
    });
    this._fill.geometry.dispose(); this._fill.geometry = new THREE.BufferGeometry();
    this._fill.geometry.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    this._fillHot.geometry.dispose(); this._fillHot.geometry = new THREE.BufferGeometry();
    this._fillHot.geometry.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));

    // wire (all quad edges) + boundary
    const wp = [];
    this.quads.forEach(q => {
      if (!q) return;
      for (let k = 0; k < 4; k++) {
        const A = this.verts[q.v[k]].p, B = this.verts[q.v[(k + 1) % 4]].p;
        wp.push(A.x, A.y, A.z, B.x, B.y, B.z);
      }
    });
    this._wire.geometry.dispose(); this._wire.geometry = new THREE.BufferGeometry();
    this._wire.geometry.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));

    const bp = [];
    this._boundaryEdges().forEach(ed => {
      const A = this.verts[ed.a].p, B = this.verts[ed.b].p;
      bp.push(A.x, A.y, A.z, B.x, B.y, B.z);
    });
    this._bnd.geometry.dispose(); this._bnd.geometry = new THREE.BufferGeometry();
    this._bnd.geometry.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
    this._bnd.visible = this.mode === 'draw';

    // points
    const pp = [];
    this.verts.forEach(v => { if (v) pp.push(v.p.x, v.p.y, v.p.z); });
    this._pts.geometry.dispose(); this._pts.geometry = new THREE.BufferGeometry();
    this._pts.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3));

    const dp = [];
    this.draft.forEach(i => { const v = this.verts[i]; if (v) dp.push(v.p.x, v.p.y, v.p.z); });
    this._dpts.geometry.dispose(); this._dpts.geometry = new THREE.BufferGeometry();
    this._dpts.geometry.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
  }

  // ---------------------------------------------------------- EXPORT
  exportGeometry() {
    // compact verts, index quads as tri pairs
    const map = new Map(); const pos = [];
    const idx = [];
    const get = (i) => {
      if (map.has(i)) return map.get(i);
      const v = this.verts[i]; const k = map.size;
      pos.push(v.p.x, v.p.y, v.p.z); map.set(i, k); return k;
    };
    this.quads.forEach(q => {
      if (!q) return;
      const [a, b, c, d] = q.v.map(get);
      idx.push(a, b, c, a, c, d);
    });
    if (!idx.length) throw new Error('Nothing drawn yet — the cage is empty');
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  async exportGLB() {
    const g = this.exportGeometry();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.85 }));
    mesh.name = (this.modelName || 'mesh').replace(/\.\w+$/, '') + '_retopo';
    const scene = new THREE.Scene(); scene.add(mesh);
    const exporter = new GLTFExporter();
    const glb = await new Promise((res, rej) => exporter.parse(scene, res, rej, { binary: true }));
    return glb;
  }

  // ---------------------------------------------------------- FRAME
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} try { this.renderer.dispose(); } catch (e) {} }
}
