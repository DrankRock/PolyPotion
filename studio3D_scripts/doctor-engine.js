// ============================================================
// doctor-engine.js — MESH DOCTOR  (DoctorEngine)
// Loads a model (GLB/FBX/OBJ) WITHOUT flattening it — hierarchy, skinning,
// materials and animations all survive — then audits the topology:
//   · non-manifold edges (an edge shared by 3+ faces)
//   · open boundary edges (is it watertight?)
//   · inconsistent winding / inside-out shells (signed-volume test)
//   · zero-area (degenerate) triangles
//   · weldable duplicate vertices, isolated vertices
//   · missing normals / missing UVs / UVs out of 0–1 / overlapping UV area
//   · scale + placement sanity (tiny/huge, below floor, off-center)
// Each finding can be highlighted in the viewport, and most have a one-click
// fix that operates in place and re-runs the audit. Health score 0–100.
// Loaded by dynamic import from MeshDoctor.dc.html, like the other engines.
// ============================================================
import * as THREE from 'three';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fetchAssetBuffer } from './chunk-loader.js';

const EDGE_M = 1 << 22;                      // numeric edge-key base (fits in a double)
const ekey = (a, b) => a < b ? a * EDGE_M + b : b * EDGE_M + a;

export class DoctorEngine {
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
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);

    const hemi = new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.05); this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(2.4, 4.2, 3.0); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.5); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe9cf, 0.32); fill.position.set(0.5, 1.0, -3.0); this.scene.add(fill);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.modelRoot = new THREE.Group(); this.scene.add(this.modelRoot);
    this.overlayRoot = new THREE.Group(); this.scene.add(this.overlayRoot);

    this.meshes = [];               // [{ mesh }] every Mesh/SkinnedMesh in the model
    this.report = null;             // last audit
    this.modelName = ''; this.modelRadius = 1; this.modelCenter = new THREE.Vector3(0, 0.95, 0);
    this.animations = [];           // clips carried through to export
    this._origBuffer = null; this._origExt = 'glb';
    this.wire = false; this.xray = false;
    this._overlayOn = {};           // id -> bool
    this._overlayObj = {};          // id -> Object3D

    this.onStatus = null; this.onChange = null;
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__drEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return this.meshes.length > 0; }
  stats() { return { name: this.modelName, report: this.report }; }

  // ---------------------------------------------------------- LOADING
  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts);
    return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop());
  }
  async loadFile(file) { return this._ingest(await file.arrayBuffer(), (file.name.split('.').pop() || '').toLowerCase(), file.name); }
  async loadBuffer(buf, name, ext) { return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name); }

  async reloadOriginal() {
    if (!this._origBuffer) throw new Error('nothing to restore');
    return this._ingest(this._origBuffer.slice(0), this._origExt, this.modelName, true);
  }

  async _ingest(buf, ext, name, isRestore) {
    this._status('Parsing ' + (name || 'model') + '…');
    let obj = null, anims = [];
    if (ext === 'glb' || ext === 'gltf') {
      const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej));
      obj = g.scene; anims = g.animations || [];
    } else if (ext === 'fbx') {
      obj = this._fbx.parse(buf, ''); anims = obj.animations || [];
    } else if (ext === 'obj') {
      obj = this._obj.parse(new TextDecoder().decode(buf));
    } else throw new Error('Unsupported format .' + ext);

    // clear previous
    while (this.modelRoot.children.length) { const c = this.modelRoot.children.pop(); this.modelRoot.remove(c); }
    this._clearOverlays();
    this.meshes = [];
    this.modelRoot.position.set(0, 0, 0);

    this.modelRoot.add(obj);
    obj.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) { o.frustumCulled = false; this.meshes.push({ mesh: o }); } });
    if (!this.meshes.length) throw new Error('No triangle meshes found in file');

    this.animations = anims;
    this.modelName = name || 'model';
    if (!isRestore) { this._origBuffer = buf.slice ? buf.slice(0) : buf; this._origExt = ext; }

    this._fitCamera();
    this.setWire(this.wire); this.setXray(this.xray);
    this._status('Auditing topology…');
    await new Promise(r => setTimeout(r, 20));      // let the loader paint
    this.analyze();
    this._status('');
    this._changed();
    return { name: this.modelName, report: this.report };
  }

  _fitCamera() {
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()); const s = box.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.y, s.z) * 0.5 || 1;
    this.modelCenter.copy(c); this.modelRadius = r;
    this.camera.near = Math.max(r / 200, 1e-4); this.camera.far = r * 40; this.camera.updateProjectionMatrix();
    this.controls.target.copy(c);
    this.controls.minDistance = r * 0.2; this.controls.maxDistance = r * 12;
    this.camera.position.set(c.x + r * 1.2, c.y + r * 0.9, c.z + r * 2.4);
    // grid sized to the model
    this.scene.remove(this.grid); this.grid.geometry.dispose(); this.grid.material.dispose();
    const gs = Math.max(2, Math.ceil(r * 5));
    this.grid = new THREE.GridHelper(gs, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);
  }

  setView(v) {
    const c = this.modelCenter, r = this.modelRadius, d = r * 2.8;
    const P = { persp: [c.x + r * 1.2, c.y + r * 0.9, c.z + d * 0.86], front: [c.x, c.y, c.z + d], back: [c.x, c.y, c.z - d], side: [c.x + d, c.y, c.z], top: [c.x, c.y + d, c.z + 0.001] }[v];
    if (P) { this.camera.position.set(P[0], P[1], P[2]); this.controls.target.copy(c); }
  }

  // ---------------------------------------------------------- ANALYSIS
  // Welds positions on a tolerance grid; returns a welded id per raw vertex.
  _weld(geo, tol) {
    const pos = geo.attributes.position, n = pos.count;
    const inv = 1 / tol, map = new Map(), ids = new Int32Array(n), first = [];
    for (let i = 0; i < n; i++) {
      const k = Math.round(pos.getX(i) * inv) + '_' + Math.round(pos.getY(i) * inv) + '_' + Math.round(pos.getZ(i) * inv);
      let id = map.get(k);
      if (id === undefined) { id = first.length; map.set(k, id); first.push(i); }
      ids[i] = id;
    }
    return { ids, unique: first.length, first };
  }

  // Full per-mesh audit. Returns counts + world-space overlay buffers + face flags.
  _auditMesh(mesh, tol) {
    const geo = mesh.geometry, pos = geo.attributes.position;
    mesh.updateWorldMatrix(true, false);
    const mw = mesh.matrixWorld, v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const idx = geo.getIndex();
    const faceCount = ((idx ? idx.count : pos.count) / 3) | 0;
    const F = idx ? ((f, k) => idx.getX(f * 3 + k)) : ((f, k) => f * 3 + k);
    const { ids, unique, first } = this._weld(geo, tol);

    const wpos = (rawI, out) => out.set(pos.getX(rawI), pos.getY(rawI), pos.getZ(rawI)).applyMatrix4(mw);

    // --- pass 1: faces — degenerates, edges, winding dirs
    const areaEps = Math.pow(this.modelRadius * 2e-6 + 1e-9, 2);
    const deg = new Uint8Array(faceCount);
    let degCount = 0;
    const edges = new Map();                 // key -> { n, f0, d0, pairs:[...] }
    const pairs = [];                        // [fA, fB, sameDir]
    let nonManifold = 0; const nmSegs = [], bSegs = [];
    const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), cr = new THREE.Vector3();

    for (let f = 0; f < faceCount; f++) {
      const a = F(f, 0), b = F(f, 1), c = F(f, 2);
      const wa = ids[a], wb = ids[b], wc = ids[c];
      wpos(a, v[0]); wpos(b, v[1]); wpos(c, v[2]);
      if (wa === wb || wb === wc || wc === wa) { deg[f] = 1; degCount++; }
      else {
        e1.subVectors(v[1], v[0]); e2.subVectors(v[2], v[0]); cr.crossVectors(e1, e2);
        if (cr.lengthSq() * 0.25 < areaEps) { deg[f] = 1; degCount++; }
      }
      if (deg[f]) continue;
      const tri = [[wa, wb], [wb, wc], [wc, wa]];
      for (let k = 0; k < 3; k++) {
        const p = tri[k][0], q = tri[k][1], key = ekey(p, q), dir = p < q; // dir: traversed low->high?
        let e = edges.get(key);
        if (!e) { edges.set(key, { n: 1, f0: f, d0: dir, p, q }); }
        else {
          e.n++;
          if (e.n === 2) { pairs.push([e.f0, f, e.d0 === dir]); }
          if (e.n === 3) { nonManifold++; this._pushSeg(nmSegs, e.p, e.q, first, pos, mw); }
        }
      }
    }

    // --- boundary edges + per-face boundary flag
    let boundary = 0; const onBoundary = new Uint8Array(faceCount);
    edges.forEach(e => {
      if (e.n === 1) { boundary++; onBoundary[e.f0] = 1; this._pushSeg(bSegs, e.p, e.q, first, pos, mw); }
    });

    // --- winding: BFS components over 2-manifold pairs
    const adj = new Array(faceCount); pairs.forEach(p => {
      (adj[p[0]] || (adj[p[0]] = [])).push([p[1], p[2]]);
      (adj[p[1]] || (adj[p[1]] = [])).push([p[0], p[2]]);
    });
    const compId = new Int32Array(faceCount).fill(-1);
    const flip = new Uint8Array(faceCount);
    const comps = [];
    for (let f = 0; f < faceCount; f++) {
      if (compId[f] !== -1 || deg[f]) continue;
      const comp = { faces: [], open: false }; comps.push(comp);
      const ci = comps.length - 1;
      const q = [f]; compId[f] = ci; flip[f] = 0;
      while (q.length) {
        const cur = q.pop(); comp.faces.push(cur);
        if (onBoundary[cur]) comp.open = true;
        const ns = adj[cur]; if (!ns) continue;
        for (let i = 0; i < ns.length; i++) {
          const [nf, same] = ns[i];
          const want = same ? (flip[cur] ^ 1) : flip[cur];   // same traversal dir ⇒ opposite orientation
          if (compId[nf] === -1) { compId[nf] = ci; flip[nf] = want; q.push(nf); }
        }
      }
    }
    // per component: minority = flipped faces; closed comps also get a signed-volume test
    let flippedCount = 0, insideOut = 0; const flipFaces = [];
    for (let ci = 0; ci < comps.length; ci++) {
      const comp = comps[ci];
      let f1 = 0; comp.faces.forEach(f => { if (flip[f]) f1++; });
      const minorityIsFlip = f1 * 2 <= comp.faces.length;
      comp.faces.forEach(f => { const isMin = minorityIsFlip ? !!flip[f] : !flip[f]; if (isMin) { flippedCount++; flipFaces.push(f); flip[f] = 1; } else flip[f] = 0; });
      if (!comp.open && comp.faces.length > 3) {
        // signed volume with the unified orientation
        let vol = 0;
        for (let i = 0; i < comp.faces.length; i++) {
          const f = comp.faces[i];
          wpos(F(f, 0), v[0]); wpos(F(f, 1), v[1]); wpos(F(f, 2), v[2]);
          let s = v[0].dot(cr.crossVectors(v[1], v[2])) / 6;
          if (flip[f]) s = -s;
          vol += s;
        }
        if (vol < 0) { insideOut++; comp.faces.forEach(f => { flip[f] ^= 1; if (flip[f]) flipFaces.push(f); }); flippedCount = flipFaces.length; }
      }
    }

    // --- duplicates / isolated
    const weldable = pos.count - unique;
    let isolated = 0;
    if (idx) {
      const used = new Uint8Array(pos.count);
      for (let i = 0; i < idx.count; i++) used[idx.getX(i)] = 1;
      for (let i = 0; i < pos.count; i++) if (!used[i]) isolated++;
    }

    // --- normals / uvs
    const hasNormals = !!geo.attributes.normal, uv = geo.attributes.uv;
    let uvOut = 0, uvOverlapPct = 0;
    if (uv) {
      for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), w = uv.getY(i); if (u < -0.001 || u > 1.001 || w < -0.001 || w > 1.001) uvOut++; }
      uvOverlapPct = this._uvOverlap(uv, idx, faceCount, deg, F);
    }

    return {
      tris: faceCount, verts: pos.count, unique, indexed: !!idx, skinned: !!mesh.isSkinnedMesh,
      degCount, deg, nonManifold, boundary, flippedCount, flip, insideOut,
      weldable, isolated, hasNormals, hasUV: !!uv, uvOut, uvOverlapPct,
      nmSegs, bSegs, flipFaces,
    };
  }

  _pushSeg(arr, wp, wq, first, pos, mw) {
    const t = new THREE.Vector3();
    t.set(pos.getX(first[wp]), pos.getY(first[wp]), pos.getZ(first[wp])).applyMatrix4(mw); arr.push(t.x, t.y, t.z);
    t.set(pos.getX(first[wq]), pos.getY(first[wq]), pos.getZ(first[wq])).applyMatrix4(mw); arr.push(t.x, t.y, t.z);
  }

  _uvOverlap(uv, idx, faceCount, deg, F) {
    const G = 128, cov = new Uint8Array(G * G);
    const clampi = (x) => x < 0 ? 0 : (x > G - 1 ? G - 1 : x);
    for (let f = 0; f < faceCount; f++) {
      if (deg[f]) continue;
      const a = F(f, 0), b = F(f, 1), c = F(f, 2);
      const ax = uv.getX(a) * G, ay = uv.getY(a) * G, bx = uv.getX(b) * G, by = uv.getY(b) * G, cx = uv.getX(c) * G, cy = uv.getY(c) * G;
      const x0 = clampi(Math.floor(Math.min(ax, bx, cx))), x1 = clampi(Math.ceil(Math.max(ax, bx, cx)));
      const y0 = clampi(Math.floor(Math.min(ay, by, cy))), y1 = clampi(Math.ceil(Math.max(ay, by, cy)));
      const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(d) < 1e-9) continue;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / d;
        const w1 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) / d;
        const w2 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) / d;
        const inA = w0 >= 0 && w1 >= 0 && w2 >= 0, inB = w0 <= 0 && w1 <= 0 && w2 <= 0;
        if (inA || inB) { const i = y * G + x; if (cov[i] < 250) cov[i]++; }
      }
    }
    let used = 0, over = 0;
    for (let i = 0; i < cov.length; i++) { if (cov[i] > 0) used++; if (cov[i] > 1) over++; }
    return used ? Math.round(over / used * 100) : 0;
  }

  analyze() {
    if (!this.hasModel()) { this.report = null; return null; }
    const tol = Math.max(1e-6, this.modelRadius * 2 * 1e-6);
    const per = []; this._per = per;
    const T = { tris: 0, verts: 0, degCount: 0, nonManifold: 0, boundary: 0, flippedCount: 0, insideOut: 0, weldable: 0, isolated: 0, uvOut: 0 };
    let missNormals = 0, missUV = 0, overlapMax = 0, unindexed = 0, skinned = 0;
    const nmSegs = [], bSegs = [], flipTris = [], degPts = [];

    for (let i = 0; i < this.meshes.length; i++) {
      const m = this.meshes[i].mesh;
      const r = this._auditMesh(m, tol);
      per.push(r);
      Object.keys(T).forEach(k => T[k] += r[k]);
      if (!r.hasNormals) missNormals++; if (!r.hasUV) missUV++;
      if (!r.indexed) unindexed++; if (r.skinned) skinned++;
      overlapMax = Math.max(overlapMax, r.uvOverlapPct);
      for (let j = 0; j < r.nmSegs.length; j++) nmSegs.push(r.nmSegs[j]);
      for (let j = 0; j < r.bSegs.length; j++) bSegs.push(r.bSegs[j]);
      // world-space triangles for flipped faces + centroids for degenerates
      this._collectFaceOverlays(m, r, flipTris, degPts);
    }

    // materials / textures (informational)
    const mats = new Set(), texs = new Set();
    this.modelRoot.traverse(o => {
      if (!o.isMesh) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach(mt => { if (!mt) return; mats.add(mt); ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach(k => { if (mt[k]) texs.add(mt[k]); }); });
    });

    // placement / scale
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    const size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
    const height = size.y, maxDim = Math.max(size.x, size.y, size.z);
    const scaleFlag = maxDim < 0.01 ? 'tiny' : (maxDim > 100 ? 'huge' : 'ok');
    const belowFloor = box.min.y < -maxDim * 0.01;
    const offCenter = Math.hypot(ctr.x, ctr.z) > maxDim * 0.25;

    // ---- score
    let score = 100;
    const dNM = Math.min(15, T.nonManifold * 1.5), dWind = Math.min(20, T.flippedCount * 0.25 + T.insideOut * 8),
      dDeg = Math.min(10, T.degCount * 0.5), dWeld = Math.min(8, T.weldable / Math.max(1, T.verts) * 60),
      dIso = Math.min(4, T.isolated * 0.2), dN = missNormals ? 6 : 0, dUV = missUV ? 6 : 0,
      dOver = overlapMax > 3 ? Math.min(10, overlapMax * 0.4) : 0, dScale = scaleFlag !== 'ok' ? 8 : 0,
      dFloor = (belowFloor || offCenter) ? 4 : 0;
    score = Math.max(0, Math.round(score - dNM - dWind - dDeg - dWeld - dIso - dN - dUV - dOver - dScale - dFloor));
    const grade = score >= 97 ? 'A+' : score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F';

    const chk = (id, label, count, bad, warnOnly, detail, overlay) => ({
      id, label, count, overlay: overlay || null,
      status: count === 0 || bad === false ? 'pass' : (warnOnly ? 'warn' : 'fail'),
      detail: detail || '',
    });
    const checks = [
      chk('nonmanifold', 'Non-manifold edges', T.nonManifold, undefined, false, 'edges shared by 3+ faces — breaks booleans, printing & unwrap', 'nonmanifold'),
      chk('winding', 'Flipped faces', T.flippedCount + (T.insideOut ? 0 : 0), undefined, false, T.insideOut ? (T.insideOut + ' inside-out shell' + (T.insideOut > 1 ? 's' : '') + ' detected') : 'faces wound opposite to their neighbours', 'winding'),
      chk('degenerate', 'Zero-area triangles', T.degCount, undefined, true, 'collapsed slivers that break normals & bakes', 'degenerate'),
      chk('boundary', 'Open boundary edges', T.boundary, undefined, true, T.boundary ? 'mesh is not watertight (fine for clothes / planes)' : 'watertight ✓', 'boundary'),
      chk('weld', 'Weldable duplicate verts', T.weldable, undefined, true, 'coincident vertices that could be merged', null),
      chk('isolated', 'Isolated vertices', T.isolated, undefined, true, 'vertices no triangle uses', null),
      chk('normals', 'Normals', missNormals, undefined, true, missNormals ? missNormals + ' mesh(es) missing normals' : 'present on every mesh', null),
      chk('uvs', 'UVs', missUV, undefined, true, missUV ? missUV + ' mesh(es) have no UVs — run UV Unwrap' : 'present on every mesh', null),
      chk('uvrange', 'UVs outside 0–1', T.uvOut, undefined, true, 'verts outside the unit square (tiling is sometimes intentional)', null),
      chk('uvoverlap', 'UV overlap', overlapMax > 3 ? overlapMax : 0, undefined, true, overlapMax > 3 ? '≈' + overlapMax + '% of used UV space is covered twice' : 'islands are clean', null),
      chk('scale', 'Scale sanity', scaleFlag === 'ok' ? 0 : 1, undefined, true, scaleFlag === 'ok' ? this._fmtDim(size) : ('model is ' + this._fmtDim(size) + ' — looks ' + scaleFlag + ' (unit mixup?)'), null),
      chk('floor', 'Placement', (belowFloor || offCenter) ? 1 : 0, undefined, true, belowFloor ? 'geometry sinks below the floor' : (offCenter ? 'model sits away from the origin' : 'grounded at the origin ✓'), null),
    ];

    this.report = {
      name: this.modelName, meshCount: this.meshes.length, skinned, unindexed,
      tris: T.tris, verts: T.verts, materials: mats.size, textures: texs.size,
      height, dims: { x: size.x, y: size.y, z: size.z },
      totals: T, missNormals, missUV, overlapMax, scaleFlag, belowFloor, offCenter,
      score, grade, checks,
    };

    this._buildOverlays({ nonmanifold: nmSegs, boundary: bSegs, winding: flipTris, degenerate: degPts });
    return this.report;
  }

  _collectFaceOverlays(mesh, r, flipTris, degPts) {
    const geo = mesh.geometry, pos = geo.attributes.position, idx = geo.getIndex();
    mesh.updateWorldMatrix(true, false); const mw = mesh.matrixWorld;
    const F = idx ? ((f, k) => idx.getX(f * 3 + k)) : ((f, k) => f * 3 + k);
    const t = new THREE.Vector3();
    const push = (arr, i) => { t.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mw); arr.push(t.x, t.y, t.z); };
    for (let j = 0; j < r.flipFaces.length; j++) { const f = r.flipFaces[j]; push(flipTris, F(f, 0)); push(flipTris, F(f, 1)); push(flipTris, F(f, 2)); }
    for (let f = 0; f < r.tris; f++) {
      if (!r.deg[f]) continue;
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { const i = F(f, k); t.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mw); cx += t.x / 3; cy += t.y / 3; cz += t.z / 3; }
      degPts.push(cx, cy, cz);
    }
  }

  _fmtDim(s) {
    const f = (n) => n >= 1 ? n.toFixed(2) : n.toFixed(4);
    return f(s.x) + ' × ' + f(s.y) + ' × ' + f(s.z) + ' units';
  }

  // ---------------------------------------------------------- OVERLAYS
  _clearOverlays() {
    Object.values(this._overlayObj).forEach(o => { this.overlayRoot.remove(o); if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this._overlayObj = {};
  }
  _buildOverlays(data) {
    this._clearOverlays();
    const mk = (arr, obj) => { if (!arr.length) return null; obj.visible = !!this._overlayOn[obj.userData.id]; this.overlayRoot.add(obj); return obj; };
    const lineGeo = (arr) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return g; };
    if (data.nonmanifold.length) {
      const o = new THREE.LineSegments(lineGeo(data.nonmanifold), new THREE.LineBasicMaterial({ color: 0xd94f2f, depthTest: false, transparent: true, opacity: 0.95 }));
      o.userData.id = 'nonmanifold'; o.renderOrder = 30; this._overlayObj.nonmanifold = mk(data.nonmanifold, o);
    }
    if (data.boundary.length) {
      const o = new THREE.LineSegments(lineGeo(data.boundary), new THREE.LineBasicMaterial({ color: 0xe0a93b, depthTest: false, transparent: true, opacity: 0.9 }));
      o.userData.id = 'boundary'; o.renderOrder = 29; this._overlayObj.boundary = mk(data.boundary, o);
    }
    if (data.winding.length) {
      const g = lineGeo(data.winding); g.computeVertexNormals();
      const o = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xe0722f, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2 }));
      o.userData.id = 'winding'; o.renderOrder = 28; this._overlayObj.winding = mk(data.winding, o);
    }
    if (data.degenerate.length) {
      const o = new THREE.Points(lineGeo(data.degenerate), new THREE.PointsMaterial({ color: 0xc85ad9, size: 9, sizeAttenuation: false, depthTest: false, transparent: true, opacity: 0.95 }));
      o.userData.id = 'degenerate'; o.renderOrder = 31; this._overlayObj.degenerate = mk(data.degenerate, o);
    }
  }
  setOverlay(id, on) {
    this._overlayOn[id] = on;
    const o = this._overlayObj[id]; if (o) o.visible = on;
  }
  overlayAvailable(id) { return !!this._overlayObj[id]; }

  // ---------------------------------------------------------- FIXES
  async fixWeld() {
    let removed = 0;
    this.meshes.forEach(({ mesh }) => {
      const before = mesh.geometry.attributes.position.count;
      const g2 = mergeVertices(mesh.geometry, 1e-4);
      removed += before - g2.attributes.position.count;
      if (g2 !== mesh.geometry) { mesh.geometry.dispose(); mesh.geometry = g2; }
    });
    this.analyze(); this._changed();
    return removed;
  }

  fixNormals() {
    this.meshes.forEach(({ mesh }) => { mesh.geometry.deleteAttribute('normal'); mesh.geometry.computeVertexNormals(); });
    this.analyze(); this._changed();
  }

  fixDegenerate() {
    let removed = 0;
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i].mesh, r = this._per && this._per[i];
      if (!r || !r.degCount) continue;
      removed += this._dropFaces(mesh.geometry, r.deg);
    }
    this.analyze(); this._changed();
    return removed;
  }

  _dropFaces(geo, dropFlag) {
    const idx = geo.getIndex();
    const faceCount = ((idx ? idx.count : geo.attributes.position.count) / 3) | 0;
    let dropped = 0;
    const groups = geo.groups && geo.groups.length ? geo.groups.map(g => ({ ...g })) : null;
    if (idx) {
      const keep = [];
      const newGroups = [];
      let gi = 0, gCount = 0;
      for (let f = 0; f < faceCount; f++) {
        if (groups && gi < groups.length && f * 3 >= groups[gi].start + groups[gi].count) {
          newGroups.push({ start: keep.length - gCount * 3, count: gCount * 3, materialIndex: groups[gi].materialIndex }); gi++; gCount = 0;
        }
        if (dropFlag[f]) { dropped++; continue; }
        keep.push(idx.getX(f * 3), idx.getX(f * 3 + 1), idx.getX(f * 3 + 2)); gCount++;
      }
      geo.setIndex(keep);
      if (groups) {
        newGroups.push({ start: keep.length - gCount * 3, count: gCount * 3, materialIndex: groups[gi] ? groups[gi].materialIndex : 0 });
        // recompute starts sequentially
        let s = 0; geo.clearGroups();
        newGroups.forEach(g => { geo.addGroup(s, g.count, g.materialIndex); s += g.count; });
      }
    } else {
      const attrs = Object.keys(geo.attributes);
      const keepFaces = [];
      for (let f = 0; f < faceCount; f++) { if (!dropFlag[f]) keepFaces.push(f); else dropped++; }
      attrs.forEach(name => {
        const a = geo.attributes[name], sz = a.itemSize;
        const out = new a.array.constructor(keepFaces.length * 3 * sz);
        for (let j = 0; j < keepFaces.length; j++) {
          const f = keepFaces[j];
          out.set(a.array.subarray(f * 3 * sz, (f + 1) * 3 * sz), j * 3 * sz);
        }
        geo.setAttribute(name, new THREE.BufferAttribute(out, sz, a.normalized));
      });
      geo.clearGroups();
    }
    return dropped;
  }

  fixWinding() {
    let flipped = 0;
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i].mesh, r = this._per && this._per[i];
      if (!r || !r.flippedCount) continue;
      const geo = mesh.geometry, idx = geo.getIndex();
      if (idx) {
        for (let f = 0; f < r.tris; f++) {
          if (!r.flip[f]) continue;
          const b = idx.getX(f * 3 + 1), c = idx.getX(f * 3 + 2);
          idx.setX(f * 3 + 1, c); idx.setX(f * 3 + 2, b); flipped++;
        }
        idx.needsUpdate = true;
      } else {
        const attrs = Object.values(geo.attributes);
        for (let f = 0; f < r.tris; f++) {
          if (!r.flip[f]) continue;
          attrs.forEach(a => {
            const sz = a.itemSize, i1 = (f * 3 + 1) * sz, i2 = (f * 3 + 2) * sz;
            for (let k = 0; k < sz; k++) { const t = a.array[i1 + k]; a.array[i1 + k] = a.array[i2 + k]; a.array[i2 + k] = t; }
            a.needsUpdate = true;
          });
          flipped++;
        }
      }
      geo.deleteAttribute('normal'); geo.computeVertexNormals();
    }
    this.analyze(); this._changed();
    return flipped;
  }

  fixFloor() {
    const box = new THREE.Box3().setFromObject(this.modelRoot);
    const c = box.getCenter(new THREE.Vector3());
    this.modelRoot.position.x -= c.x; this.modelRoot.position.z -= c.z; this.modelRoot.position.y -= box.min.y;
    this._fitCamera();
    this.analyze(); this._changed();
  }

  async fixAll() {
    const t = this.report ? this.report.totals : null;
    this._status('Welding duplicates…'); await this._tick(); if (!t || t.weldable) await this.fixWeld();
    this._status('Removing zero-area triangles…'); await this._tick(); this.fixDegenerate();
    this._status('Unifying winding…'); await this._tick(); this.fixWinding();
    this._status('Rebuilding normals…'); await this._tick(); this.fixNormals();
    this._status('Grounding at origin…'); await this._tick();
    if (this.report && (this.report.belowFloor || this.report.offCenter)) this.fixFloor();
    this._status('');
    return this.report;
  }
  _tick() { return new Promise(r => setTimeout(r, 30)); }

  // ---------------------------------------------------------- VIEW MODES
  _eachMat(fn) {
    this.meshes.forEach(({ mesh }) => { (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => m && fn(m)); });
  }
  setWire(on) { this.wire = on; this._eachMat(m => { m.wireframe = on; m.needsUpdate = true; }); }
  setXray(on) {
    this.xray = on;
    this._eachMat(m => {
      if (on) { if (m.userData.__dr === undefined) m.userData.__dr = { t: m.transparent, o: m.opacity, dw: m.depthWrite }; m.transparent = true; m.opacity = 0.3; m.depthWrite = false; }
      else if (m.userData.__dr !== undefined) { m.transparent = m.userData.__dr.t; m.opacity = m.userData.__dr.o; m.depthWrite = m.userData.__dr.dw; delete m.userData.__dr; }
      m.needsUpdate = true;
    });
  }

  // ---------------------------------------------------------- EXPORT
  exportGLB() {
    const exp = new GLTFExporter();
    const opts = { binary: true, animations: this.animations || [] };
    return new Promise((res, rej) => exp.parse(this.modelRoot, (r) => res(r), (e) => rej(e), opts));
  }

  // ---------------------------------------------------------- LOOP / RESIZE
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
  dispose() { this._run = false; this._ro.disconnect(); this.renderer.dispose(); }
}
