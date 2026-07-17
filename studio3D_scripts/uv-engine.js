// ============================================================
// uv-engine.js — UV UNWRAP  (UVEngine)
//
// Loads a model (GLB/FBX/OBJ), welds it into one indexed surface,
// finds seams (auto by dihedral-angle region growing, or painted
// by hand — click an edge, shift-click extends the whole edge loop),
// splits the surface into charts along them, and parameterizes each
// chart with LSCM in a worker (WASM-accelerated CG). Charts are
// area-normalized, shelf-packed into [0,1]², and previewed live as
// a checkerboard, a stretch-distortion heatmap, and a pannable 2D
// UV layout. Exports OBJ or GLB with the new UVs. All on-device.
// ============================================================
import * as THREE from 'three';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { fetchAssetBuffer } from './chunk-loader.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const cssBg = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };

export class UVEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(cssBg());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(cssBg()); this.draw2D(); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 100);
    this.camera.position.set(1.4, 1.2, 3.0);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.3; this.controls.maxDistance = 14;

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.45); key.position.set(2.4, 4.2, 3.0); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.5); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe9cf, 0.32); fill.position.set(0.5, 1.0, -3.0); this.scene.add(fill);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.root = new THREE.Group(); this.scene.add(this.root);

    // topology (welded)
    this.pos = null; this.tri = null; this.nV = 0; this.nF = 0;
    this.painted = new Set();       // hand-painted seam edge keys
    this.autoSeams = new Set();     // dihedral-detected seam edge keys
    this._adj = null;               // edgeKey -> faces array (built per load)
    this._vAdj = null;              // vert -> neighbor verts
    // unwrap result
    this.uvs = null; this.wedgeTri = null; this.uvVertOf = null; this.nUV = 0;
    this.chartOfFace = null; this.chartCount = 0;
    this.coverage = 0; this.avgStretch = 0;

    this.mesh = null; this.seamLines = null;
    this.mode = 'checker';          // checker | heat | plain
    this.paintMode = false;
    this.checkerN = 24;
    this.modelName = '';
    this._checkerTex = null;

    this.onStatus = null; this.onChange = null;
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();
    this._ray = new THREE.Raycaster();

    // 2D view state
    this.c2d = null; this._t2d = { x: 0.08, y: 0.08, s: 0.84 };

    canvas.addEventListener('pointerdown', e => this._onDown(e));
    canvas.addEventListener('pointerup', e => this._onUp(e));

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__uvEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return !!this.mesh; }
  hasUVs() { return !!this.uvs; }
  stats() {
    return { name: this.modelName, verts: this.nV, tris: this.nF, charts: this.chartCount,
      coverage: this.coverage, stretch: this.avgStretch, seams: this.painted.size + this.autoSeams.size };
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
    const srcs = [];
    obj.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry) srcs.push(o); });
    if (!srcs.length) throw new Error('No mesh found in file');

    this._status('Welding surface…');
    // bake to world, normalize height to 1.8, weld by position
    const gbox = new THREE.Box3();
    const baked = [];
    for (const m of srcs) {
      let g = m.geometry; if (g.index) g = g.toNonIndexed(); else g = g.clone();
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', g.attributes.position.clone());
      pg.applyMatrix4(m.matrixWorld); pg.computeBoundingBox(); gbox.union(pg.boundingBox);
      baked.push(pg);
    }
    const size = gbox.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1);
    const cx = (gbox.min.x + gbox.max.x) / 2, cz = (gbox.min.z + gbox.max.z) / 2, minY = gbox.min.y;
    const normM = new THREE.Matrix4().makeTranslation(-cx * s, -minY * s, -cz * s).multiply(new THREE.Matrix4().makeScale(s, s, s));

    const map = new Map();
    const wpos = []; const tris = [];
    const Q = 1e5;
    for (const pg of baked) {
      pg.applyMatrix4(normM);
      const p = pg.attributes.position.array, n = pg.attributes.position.count;
      const local = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
        const k = Math.round(x * Q) + ',' + Math.round(y * Q) + ',' + Math.round(z * Q);
        let id = map.get(k);
        if (id === undefined) { id = wpos.length / 3; map.set(k, id); wpos.push(x, y, z); }
        local[i] = id;
      }
      for (let f = 0; f < n; f += 3) {
        const a = local[f], b = local[f + 1], c = local[f + 2];
        if (a !== b && b !== c && a !== c) tris.push(a, b, c);
      }
      pg.dispose();
    }
    this.pos = new Float32Array(wpos);
    this.tri = new Uint32Array(tris);
    this.nV = this.pos.length / 3;
    this.nF = this.tri.length / 3;
    this.modelName = (name || 'model').replace(/\.(glb|gltf|fbx|obj)$/i, '');
    this.painted.clear(); this.autoSeams.clear();
    this.uvs = null; this.wedgeTri = null; this.chartOfFace = null; this.chartCount = 0;
    this.coverage = 0; this.avgStretch = 0;

    this._buildAdjacency();
    this._setPlainGeometry();
    this._updateSeamLines();
    this._frame();
    this.draw2D();
    this._status('');
    this._changed();
    return { name: this.modelName, verts: this.nV, tris: this.nF };
  }

  _buildAdjacency() {
    const adj = new Map(); const vAdj = new Map();
    const nV = this.nV, tri = this.tri;
    const ek = (a, b) => a < b ? a * nV + b : b * nV + a;
    this._ek = ek;
    for (let f = 0; f < this.nF; f++) {
      for (let e = 0; e < 3; e++) {
        const a = tri[f * 3 + e], b = tri[f * 3 + (e + 1) % 3];
        const k = ek(a, b);
        let l = adj.get(k); if (!l) { l = []; adj.set(k, l); }
        l.push(f);
        if (!vAdj.has(a)) vAdj.set(a, new Set()); vAdj.get(a).add(b);
        if (!vAdj.has(b)) vAdj.set(b, new Set()); vAdj.get(b).add(a);
      }
    }
    this._adj = adj; this._vAdj = vAdj;
    // face normals
    const fn = new Float32Array(this.nF * 3);
    const p = this.pos;
    for (let f = 0; f < this.nF; f++) {
      const a = tri[f * 3] * 3, b = tri[f * 3 + 1] * 3, c = tri[f * 3 + 2] * 3;
      const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2];
      const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const l = Math.hypot(nx, ny, nz) || 1;
      fn[f * 3] = nx / l; fn[f * 3 + 1] = ny / l; fn[f * 3 + 2] = nz / l;
    }
    this._fn = fn;
  }

  _setPlainGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setIndex(new THREE.BufferAttribute(this.tri, 1));
    g.computeVertexNormals();
    this._swapGeometry(g);
  }

  _swapGeometry(g) {
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); }
    const mat = new THREE.MeshStandardMaterial({ color: 0xb9bfc8, roughness: 0.82, metalness: 0.03 });
    this.mesh = new THREE.Mesh(g, mat);
    this.root.add(this.mesh);
    this._applyMode();
  }

  // ---------------------------------------------------------- SEAMS
  edgeKeyToVerts(k) { const a = Math.floor(k / this.nV), b = k % this.nV; return [a, b]; }

  runAutoSeams(angleDeg) {
    if (!this.pos) return 0;
    this._status('Detecting seams…');
    const cosT = Math.cos(angleDeg * Math.PI / 180);
    const nF = this.nF, tri = this.tri, fn = this._fn, ek = this._ek;
    const labels = new Int32Array(nF).fill(-1);
    let nL = 0;
    const canCross = (k, f0, f1) => {
      if (this.painted.has(k)) return false;
      const d = fn[f0 * 3] * fn[f1 * 3] + fn[f0 * 3 + 1] * fn[f1 * 3 + 1] + fn[f0 * 3 + 2] * fn[f1 * 3 + 2];
      return d >= cosT;
    };
    const stack = new Int32Array(nF);
    for (let seed = 0; seed < nF; seed++) {
      if (labels[seed] >= 0) continue;
      const L = nL++;
      let top = 0; stack[top++] = seed; labels[seed] = L;
      while (top > 0) {
        const f = stack[--top];
        for (let e = 0; e < 3; e++) {
          const k = ek(tri[f * 3 + e], tri[f * 3 + (e + 1) % 3]);
          const fs = this._adj.get(k);
          if (!fs || fs.length !== 2) continue;
          const g = fs[0] === f ? fs[1] : fs[0];
          if (labels[g] >= 0 || !canCross(k, f, g)) continue;
          labels[g] = L; stack[top++] = g;
        }
      }
    }
    // merge tiny charts into their best neighbor
    const minSize = Math.max(4, Math.round(nF * 0.0008));
    for (let pass = 0; pass < 3; pass++) {
      const sizes = new Map();
      for (let f = 0; f < nF; f++) sizes.set(labels[f], (sizes.get(labels[f]) || 0) + 1);
      let merged = 0;
      for (const [L, sz] of sizes) {
        if (sz >= minSize) continue;
        const shared = new Map();
        for (let f = 0; f < nF; f++) {
          if (labels[f] !== L) continue;
          for (let e = 0; e < 3; e++) {
            const k = ek(tri[f * 3 + e], tri[f * 3 + (e + 1) % 3]);
            const fs = this._adj.get(k);
            if (!fs || fs.length !== 2) continue;
            const g = fs[0] === f ? fs[1] : fs[0];
            if (labels[g] !== L) shared.set(labels[g], (shared.get(labels[g]) || 0) + 1);
          }
        }
        let bestL = -1, bestC = 0;
        for (const [gl, c] of shared) if (c > bestC) { bestC = c; bestL = gl; }
        if (bestL >= 0) { for (let f = 0; f < nF; f++) if (labels[f] === L) labels[f] = bestL; merged++; }
      }
      if (!merged) break;
    }
    // seams = edges between labels
    this.autoSeams.clear();
    for (const [k, fs] of this._adj) {
      if (fs.length === 2 && labels[fs[0]] !== labels[fs[1]]) this.autoSeams.add(k);
    }
    const uniq = new Set(labels);
    this._updateSeamLines();
    this._status('');
    this._changed();
    return uniq.size;
  }

  clearPainted() { this.painted.clear(); this._updateSeamLines(); this._changed(); }
  clearAllSeams() { this.painted.clear(); this.autoSeams.clear(); this._updateSeamLines(); this._changed(); }

  setPaintMode(on) { this.paintMode = !!on; }

  _onDown(e) { this._dx = e.clientX; this._dy = e.clientY; }
  _onUp(e) {
    if (!this.paintMode || !this.mesh || !this.pos) return;
    if (Math.hypot(e.clientX - this._dx, e.clientY - this._dy) > 5) return;   // was a drag/orbit
    const r = this.canvas.getBoundingClientRect();
    const nd = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this._ray.setFromCamera(nd, this.camera);
    const hits = this._ray.intersectObject(this.mesh, false);
    if (!hits.length) return;
    const hit = hits[0], f = hit.faceIndex;
    // nearest edge of the hit face
    const t = this.tri, p = this.pos, pt = hit.point;
    let bestK = -1, bestD = Infinity, bestPair = null;
    for (let e2 = 0; e2 < 3; e2++) {
      const a = t[f * 3 + e2], b = t[f * 3 + (e2 + 1) % 3];
      const d = this._distToSeg(pt, a, b);
      if (d < bestD) { bestD = d; bestK = this._ek(a, b); bestPair = [a, b]; }
    }
    if (bestK < 0) return;
    if (e.shiftKey) this._paintLoop(bestPair[0], bestPair[1]);
    else { if (this.painted.has(bestK)) this.painted.delete(bestK); else this.painted.add(bestK); }
    this._updateSeamLines();
    this._changed();
  }

  _distToSeg(pt, a, b) {
    const p = this.pos;
    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const bx = p[b * 3], by = p[b * 3 + 1], bz = p[b * 3 + 2];
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const t = Math.max(0, Math.min(1, ((pt.x - ax) * abx + (pt.y - ay) * aby + (pt.z - az) * abz) / ((abx * abx + aby * aby + abz * abz) || 1)));
    return Math.hypot(pt.x - (ax + abx * t), pt.y - (ay + aby * t), pt.z - (az + abz * t));
  }

  // extend an edge loop from (a,b): keep walking the most-collinear next edge
  _paintLoop(a, b) {
    const walk = (u, v) => {
      let steps = 0;
      while (steps++ < 600) {
        const k = this._ek(u, v);
        if (this.painted.has(k)) break;
        this.painted.add(k);
        const p = this.pos;
        const dx = p[v * 3] - p[u * 3], dy = p[v * 3 + 1] - p[u * 3 + 1], dz = p[v * 3 + 2] - p[u * 3 + 2];
        const dl = Math.hypot(dx, dy, dz) || 1;
        let bestW = -1, bestDot = 0.72;
        for (const w of (this._vAdj.get(v) || [])) {
          if (w === u) continue;
          const ex = p[w * 3] - p[v * 3], ey = p[w * 3 + 1] - p[v * 3 + 1], ez = p[w * 3 + 2] - p[v * 3 + 2];
          const el = Math.hypot(ex, ey, ez) || 1;
          const dot = (dx * ex + dy * ey + dz * ez) / (dl * el);
          if (dot > bestDot) { bestDot = dot; bestW = w; }
        }
        if (bestW < 0) break;
        u = v; v = bestW;
      }
    };
    walk(a, b); walk(b, a);
  }

  _updateSeamLines() {
    if (this.seamLines) { this.root.remove(this.seamLines); this.seamLines.geometry.dispose(); this.seamLines = null; }
    if (!this.pos) return;
    const all = [...this.painted, ...this.autoSeams];
    if (!all.length) return;
    const arr = new Float32Array(all.length * 6);
    let o = 0;
    for (const k of all) {
      const [a, b] = this.edgeKeyToVerts(k);
      arr[o++] = this.pos[a * 3]; arr[o++] = this.pos[a * 3 + 1]; arr[o++] = this.pos[a * 3 + 2];
      arr[o++] = this.pos[b * 3]; arr[o++] = this.pos[b * 3 + 1]; arr[o++] = this.pos[b * 3 + 2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.seamLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.95 }));
    this.seamLines.renderOrder = 5;
    this.root.add(this.seamLines);
  }

  // ---------------------------------------------------------- UNWRAP
  async unwrap() {
    if (!this.pos) throw new Error('Load a mesh first');
    const nF = this.nF, nV = this.nV, tri = this.tri, ek = this._ek;
    this._status('Splitting charts…');
    await new Promise(r => setTimeout(r, 20));

    const seam = (k) => this.painted.has(k) || this.autoSeams.has(k);

    // union-find over face corners → UV vertices ; over faces → charts
    const nC = nF * 3;
    const parent = new Int32Array(nC); for (let i = 0; i < nC; i++) parent[i] = i;
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    const union = (x, y) => { const a = find(x), b = find(y); if (a !== b) parent[a] = b; };
    const fparent = new Int32Array(nF); for (let i = 0; i < nF; i++) fparent[i] = i;
    const ffind = (x) => { while (fparent[x] !== x) { fparent[x] = fparent[fparent[x]]; x = fparent[x]; } return x; };
    const funion = (x, y) => { const a = ffind(x), b = ffind(y); if (a !== b) fparent[a] = b; };

    const cornerOf = (f, v) => { for (let e = 0; e < 3; e++) if (tri[f * 3 + e] === v) return f * 3 + e; return -1; };
    for (const [k, fs] of this._adj) {
      if (fs.length !== 2 || seam(k)) continue;
      const [a, b] = this.edgeKeyToVerts(k);
      const c0a = cornerOf(fs[0], a), c1a = cornerOf(fs[1], a);
      const c0b = cornerOf(fs[0], b), c1b = cornerOf(fs[1], b);
      if (c0a >= 0 && c1a >= 0) union(c0a, c1a);
      if (c0b >= 0 && c1b >= 0) union(c0b, c1b);
      funion(fs[0], fs[1]);
    }
    // UV-vertex ids
    const uvIdOf = new Map();
    const wedgeTri = new Uint32Array(nF * 3);
    const uvOrig = [];                 // uvVert -> original welded vert
    for (let c = 0; c < nC; c++) {
      const r = find(c);
      let id = uvIdOf.get(r);
      if (id === undefined) { id = uvOrig.length; uvIdOf.set(r, id); uvOrig.push(tri[c]); }
      wedgeTri[c] = id;
    }
    const nUV = uvOrig.length;
    // charts
    const chartIdOf = new Map();
    const chartOfFace = new Int32Array(nF);
    const chartFaces = [];
    for (let f = 0; f < nF; f++) {
      const r = ffind(f);
      let id = chartIdOf.get(r);
      if (id === undefined) { id = chartFaces.length; chartIdOf.set(r, id); chartFaces.push([]); }
      chartOfFace[f] = id; chartFaces[id].push(f);
    }
    const chartCount = chartFaces.length;

    // build per-chart local meshes for the worker
    this._status(`Preparing ${chartCount} chart${chartCount > 1 ? 's' : ''}…`);
    await new Promise(r => setTimeout(r, 10));
    const charts = []; const localOfChart = [];
    for (let ci = 0; ci < chartCount; ci++) {
      const faces = chartFaces[ci];
      const localOf = new Map(); const lpos = []; const ltri = new Uint32Array(faces.length * 3);
      let o = 0;
      for (const f of faces) {
        for (let e = 0; e < 3; e++) {
          const uvv = wedgeTri[f * 3 + e];
          let li = localOf.get(uvv);
          if (li === undefined) {
            li = lpos.length / 3; localOf.set(uvv, li);
            const ov = uvOrig[uvv] * 3;
            lpos.push(this.pos[ov], this.pos[ov + 1], this.pos[ov + 2]);
          }
          ltri[o++] = li;
        }
      }
      charts.push({ pos: new Float32Array(lpos), tri: ltri });
      localOfChart.push(localOf);
    }

    // solve in worker
    const uvsLocal = await this._solve(charts);

    // area-normalize + collect rects
    this._status('Packing charts…');
    const uvs = new Float32Array(nUV * 2);
    const rects = [];
    for (let ci = 0; ci < chartCount; ci++) {
      const ch = charts[ci], uvL = uvsLocal[ci];
      // areas
      let a3 = 0, a2 = 0;
      for (let f = 0; f < ch.tri.length; f += 3) {
        const i0 = ch.tri[f] * 3, i1 = ch.tri[f + 1] * 3, i2 = ch.tri[f + 2] * 3;
        const ux = ch.pos[i1] - ch.pos[i0], uy = ch.pos[i1 + 1] - ch.pos[i0 + 1], uz = ch.pos[i1 + 2] - ch.pos[i0 + 2];
        const vx = ch.pos[i2] - ch.pos[i0], vy = ch.pos[i2 + 1] - ch.pos[i0 + 1], vz = ch.pos[i2 + 2] - ch.pos[i0 + 2];
        a3 += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
        const q0 = ch.tri[f] * 2, q1 = ch.tri[f + 1] * 2, q2 = ch.tri[f + 2] * 2;
        a2 += Math.abs((uvL[q1] - uvL[q0]) * (uvL[q2 + 1] - uvL[q0 + 1]) - (uvL[q2] - uvL[q0]) * (uvL[q1 + 1] - uvL[q0 + 1])) / 2;
      }
      const sc = a2 > 1e-12 ? Math.sqrt(a3 / a2) : 1;
      let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
      for (let i = 0; i < uvL.length; i += 2) {
        uvL[i] *= sc; uvL[i + 1] *= sc;
        if (uvL[i] < minU) minU = uvL[i]; if (uvL[i] > maxU) maxU = uvL[i];
        if (uvL[i + 1] < minV) minV = uvL[i + 1]; if (uvL[i + 1] > maxV) maxV = uvL[i + 1];
      }
      if (!isFinite(minU)) { minU = 0; minV = 0; maxU = 1; maxV = 1; }
      rects.push({ ci, w: Math.max(1e-6, maxU - minU), h: Math.max(1e-6, maxV - minV), minU, minV });
    }
    // shelf pack
    let area = 0; rects.forEach(r => area += r.w * r.h);
    const pad = Math.sqrt(area) * 0.012;
    const W = Math.sqrt(area) * 1.12;
    const sorted = [...rects].sort((a, b) => b.h - a.h);
    let px = pad, py = pad, shelfH = 0, maxW = 0;
    for (const r of sorted) {
      if (px + r.w + pad > W && px > pad) { px = pad; py += shelfH + pad; shelfH = 0; }
      r.x = px; r.y = py;
      px += r.w + pad; shelfH = Math.max(shelfH, r.h);
      maxW = Math.max(maxW, r.x + r.w);
    }
    const totalH = py + shelfH + pad;
    const norm = 1 / Math.max(maxW + pad, totalH);
    // write final uvs
    for (const r of rects) {
      const localOf = localOfChart[r.ci], uvL = uvsLocal[r.ci];
      for (const [uvv, li] of localOf) {
        uvs[uvv * 2] = (uvL[li * 2] - r.minU + r.x) * norm;
        uvs[uvv * 2 + 1] = (uvL[li * 2 + 1] - r.minV + r.y) * norm;
      }
    }

    this.uvs = uvs; this.wedgeTri = wedgeTri; this.uvOrig = uvOrig; this.nUV = nUV;
    this.chartOfFace = chartOfFace; this.chartCount = chartCount;

    // coverage + distortion
    let cov = 0, stretchSum = 0, stretchN = 0;
    this._faceStretch = new Float32Array(nF);
    for (let f = 0; f < nF; f++) {
      const i0 = tri[f * 3] * 3, i1 = tri[f * 3 + 1] * 3, i2 = tri[f * 3 + 2] * 3;
      const q0 = wedgeTri[f * 3] * 2, q1 = wedgeTri[f * 3 + 1] * 2, q2 = wedgeTri[f * 3 + 2] * 2;
      const p = this.pos;
      const e1 = [p[i1] - p[i0], p[i1 + 1] - p[i0 + 1], p[i1 + 2] - p[i0 + 2]];
      const e2 = [p[i2] - p[i0], p[i2 + 1] - p[i0 + 1], p[i2 + 2] - p[i0 + 2]];
      const x1 = Math.hypot(...e1);
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const A2 = Math.hypot(...cr);
      const uvA = Math.abs((uvs[q1] - uvs[q0]) * (uvs[q2 + 1] - uvs[q0 + 1]) - (uvs[q2] - uvs[q0]) * (uvs[q1 + 1] - uvs[q0 + 1]));
      cov += uvA / 2;
      if (x1 < 1e-9 || A2 < 1e-12) { this._faceStretch[f] = 1; continue; }
      const x2 = (e1[0] * e2[0] + e1[1] * e2[1] + e1[2] * e2[2]) / x1, y2 = A2 / x1;
      // Jacobian local(2D)→UV
      const du1 = uvs[q1] - uvs[q0], dv1 = uvs[q1 + 1] - uvs[q0 + 1];
      const du2 = uvs[q2] - uvs[q0], dv2 = uvs[q2 + 1] - uvs[q0 + 1];
      const Ju = [du1 / x1, (du2 - du1 * x2 / x1) / y2];
      const Jv = [dv1 / x1, (dv2 - dv1 * x2 / x1) / y2];
      const E = Ju[0] * Ju[0] + Jv[0] * Jv[0], G = Ju[1] * Ju[1] + Jv[1] * Jv[1];
      this._faceStretch[f] = Math.sqrt(Math.max(0, (E + G) / 2));
      stretchSum += this._faceStretch[f]; stretchN++;
    }
    this.coverage = Math.min(1, cov);
    const meanS = stretchN ? stretchSum / stretchN : 1;
    // normalize stretch to its mean so the heatmap shows RELATIVE distortion
    if (meanS > 1e-9) for (let f = 0; f < nF; f++) this._faceStretch[f] /= meanS;
    this.avgStretch = 1;
    let dev = 0;
    for (let f = 0; f < nF; f++) dev += Math.abs(this._faceStretch[f] - 1);
    this.avgStretch = stretchN ? 1 + dev / stretchN : 1;

    this._buildSplitGeometry();
    this._updateSeamLinesFromCharts();
    this.draw2D();
    this._status('');
    this._changed();
    return { charts: chartCount, coverage: this.coverage, stretch: this.avgStretch };
  }

  _solve(charts) {
    return new Promise((resolve, reject) => {
      let worker;
      try { worker = new Worker(new URL('./uv-worker.js', import.meta.url), { type: 'module' }); }
      catch (e) { reject(new Error('Worker failed: ' + e.message)); return; }
      worker.onmessage = (ev) => {
        const m = ev.data;
        if (m.type === 'progress') this._status(m.phase + ' — ' + Math.round(m.frac * 100) + '%');
        else if (m.type === 'done') { worker.terminate(); resolve(m.uvs); }
      };
      worker.onerror = (err) => { worker.terminate(); reject(new Error(err.message || 'solver failed')); };
      const transfer = [];
      charts.forEach(c => { transfer.push(c.pos.buffer, c.tri.buffer); });
      worker.postMessage({ type: 'solve', charts }, transfer);
    });
  }

  _buildSplitGeometry() {
    const nUV = this.nUV;
    const pos = new Float32Array(nUV * 3);
    for (let i = 0; i < nUV; i++) {
      const ov = this.uvOrig[i] * 3;
      pos[i * 3] = this.pos[ov]; pos[i * 3 + 1] = this.pos[ov + 1]; pos[i * 3 + 2] = this.pos[ov + 2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));
    g.setIndex(new THREE.BufferAttribute(this.wedgeTri, 1));
    g.computeVertexNormals();
    // heat colors (per uv-vertex: average of adjacent faces)
    const col = new Float32Array(nUV * 3);
    const cnt = new Float32Array(nUV);
    const c = new THREE.Color();
    for (let f = 0; f < this.nF; f++) {
      const s = this._faceStretch ? this._faceStretch[f] : 1;
      this._stretchColor(s, c);
      for (let e = 0; e < 3; e++) {
        const i = this.wedgeTri[f * 3 + e];
        col[i * 3] += c.r; col[i * 3 + 1] += c.g; col[i * 3 + 2] += c.b; cnt[i]++;
      }
    }
    for (let i = 0; i < nUV; i++) { const n = cnt[i] || 1; col[i * 3] /= n; col[i * 3 + 1] /= n; col[i * 3 + 2] /= n; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this._swapGeometry(g);
  }

  _stretchColor(s, c) {
    // 1 = calm green ; 1.35 = amber ; ≥1.8 = red ; <0.75 = compressed → blue
    if (s < 0.75) c.setHSL(0.62, 0.75, 0.5);
    else if (s <= 1.12) c.setHSL(0.36, 0.62, 0.46);
    else if (s <= 1.5) c.setHSL(0.36 - (s - 1.12) / 0.38 * 0.24, 0.78, 0.5);
    else c.setHSL(Math.max(0, 0.12 - (s - 1.5) * 0.1), 0.85, 0.52);
  }

  // after unwrap, show the REAL seams: edges whose corners weren't merged
  _updateSeamLinesFromCharts() {
    const segs = [];
    for (const [k, fs] of this._adj) {
      if (fs.length === 2 && !this.painted.has(k) && !this.autoSeams.has(k)) continue;
      const [a, b] = this.edgeKeyToVerts(k);
      segs.push(a, b);
    }
    if (this.seamLines) { this.root.remove(this.seamLines); this.seamLines.geometry.dispose(); this.seamLines = null; }
    if (!segs.length) return;
    const arr = new Float32Array(segs.length * 3);
    for (let i = 0; i < segs.length; i++) {
      arr[i * 3] = this.pos[segs[i] * 3]; arr[i * 3 + 1] = this.pos[segs[i] * 3 + 1]; arr[i * 3 + 2] = this.pos[segs[i] * 3 + 2];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    this.seamLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.95 }));
    this.seamLines.renderOrder = 5;
    this.root.add(this.seamLines);
  }

  // ---------------------------------------------------------- DISPLAY MODES
  setMode(m) { this.mode = m; this._applyMode(); }
  setCheckerN(n) { this.checkerN = n; this._checkerTex = null; this._applyMode(); }

  _checker() {
    if (this._checkerTex) return this._checkerTex;
    const S = 1024, n = this.checkerN;
    const cv = document.createElement('canvas'); cv.width = cv.height = S;
    const ctx = cv.getContext('2d');
    const cell = S / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#8f96a3' : '#c9cfd8';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    ctx.strokeStyle = 'rgba(255,90,31,.55)'; ctx.lineWidth = 2;
    for (let i = 0; i <= n; i += Math.max(1, n / 4)) {
      ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(S, i * cell); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this._checkerTex = tex;
    return tex;
  }

  _applyMode() {
    if (!this.mesh) return;
    const mat = this.mesh.material;
    mat.map = null; mat.vertexColors = false; mat.color.set(0xb9bfc8);
    if (this.uvs) {
      if (this.mode === 'checker') { mat.map = this._checker(); mat.color.set(0xffffff); }
      else if (this.mode === 'heat') { mat.vertexColors = true; mat.color.set(0xffffff); }
    }
    mat.needsUpdate = true;
  }

  // ---------------------------------------------------------- 2D UV VIEW
  attach2D(canvas) {
    this.c2d = canvas;
    let drag = false, lx = 0, ly = 0;
    canvas.addEventListener('pointerdown', e => { drag = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!drag) return;
      const r = canvas.getBoundingClientRect();
      this._t2d.x += (e.clientX - lx) / r.width; this._t2d.y += (e.clientY - ly) / r.width;
      lx = e.clientX; ly = e.clientY; this.draw2D();
    });
    canvas.addEventListener('pointerup', () => drag = false);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const f = Math.pow(1.0015, -e.deltaY);
      this._t2d.s *= f;
      this.draw2D();
    }, { passive: false });
    this._ro2d = new ResizeObserver(() => this.draw2D());
    this._ro2d.observe(canvas.parentElement || canvas);
    this.draw2D();
  }

  draw2D() {
    const cv = this.c2d; if (!cv) return;
    const holder = cv.parentElement || cv;
    const W = holder.clientWidth || 300, H = holder.clientHeight || 300;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = cssBg(); ctx.fillRect(0, 0, W, H);

    const S = Math.min(W, H) * this._t2d.s;
    const ox = this._t2d.x * Math.min(W, H) + (W - S) / 2;
    const oy = this._t2d.y * Math.min(W, H) + (H - S) / 2;
    const px = (u) => ox + u * S;
    const py = (v) => oy + (1 - v) * S;

    // unit square + subtle grid
    ctx.strokeStyle = 'rgba(140,150,165,.35)'; ctx.lineWidth = 1;
    ctx.strokeRect(px(0), py(1), S, S);
    ctx.strokeStyle = 'rgba(140,150,165,.10)';
    for (let i = 1; i < 8; i++) {
      ctx.beginPath(); ctx.moveTo(px(i / 8), py(0)); ctx.lineTo(px(i / 8), py(1)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px(0), py(i / 8)); ctx.lineTo(px(1), py(i / 8)); ctx.stroke();
    }
    if (!this.uvs) {
      ctx.fillStyle = 'rgba(140,150,165,.6)'; ctx.font = '11px "Spline Sans Mono",monospace';
      ctx.textAlign = 'center';
      ctx.fillText('no UVs yet — run Unwrap', W / 2, H / 2);
      return;
    }
    const uvs = this.uvs, wt = this.wedgeTri;
    // fills per chart
    for (let f = 0; f < this.nF; f++) {
      const c = this.chartOfFace[f];
      ctx.fillStyle = `hsla(${(c * 47) % 360},58%,55%,.30)`;
      ctx.beginPath();
      ctx.moveTo(px(uvs[wt[f * 3] * 2]), py(uvs[wt[f * 3] * 2 + 1]));
      ctx.lineTo(px(uvs[wt[f * 3 + 1] * 2]), py(uvs[wt[f * 3 + 1] * 2 + 1]));
      ctx.lineTo(px(uvs[wt[f * 3 + 2] * 2]), py(uvs[wt[f * 3 + 2] * 2 + 1]));
      ctx.closePath(); ctx.fill();
    }
    // wire (only when zoomed in enough to read it)
    if (S > 260 && this.nF < 90000) {
      ctx.strokeStyle = 'rgba(230,235,245,.14)'; ctx.lineWidth = 0.5;
      ctx.beginPath();
      for (let f = 0; f < this.nF; f++) {
        const a = wt[f * 3] * 2, b = wt[f * 3 + 1] * 2, c = wt[f * 3 + 2] * 2;
        ctx.moveTo(px(uvs[a]), py(uvs[a + 1])); ctx.lineTo(px(uvs[b]), py(uvs[b + 1]));
        ctx.lineTo(px(uvs[c]), py(uvs[c + 1])); ctx.lineTo(px(uvs[a]), py(uvs[a + 1]));
      }
      ctx.stroke();
    }
  }

  reset2D() { this._t2d = { x: 0.08, y: 0.08, s: 0.84 }; this.draw2D(); }

  // ---------------------------------------------------------- EXPORT
  exportOBJ() {
    if (!this.pos) return '';
    let out = '# UV Unwrap — STUDIO\no ' + this.modelName + '\n';
    if (this.uvs) {
      for (let i = 0; i < this.nUV; i++) {
        const ov = this.uvOrig[i] * 3;
        out += 'v ' + this.pos[ov].toFixed(6) + ' ' + this.pos[ov + 1].toFixed(6) + ' ' + this.pos[ov + 2].toFixed(6) + '\n';
      }
      for (let i = 0; i < this.nUV; i++) out += 'vt ' + this.uvs[i * 2].toFixed(6) + ' ' + this.uvs[i * 2 + 1].toFixed(6) + '\n';
      for (let f = 0; f < this.nF; f++) {
        const a = this.wedgeTri[f * 3] + 1, b = this.wedgeTri[f * 3 + 1] + 1, c = this.wedgeTri[f * 3 + 2] + 1;
        out += 'f ' + a + '/' + a + ' ' + b + '/' + b + ' ' + c + '/' + c + '\n';
      }
    } else {
      for (let i = 0; i < this.nV; i++) out += 'v ' + this.pos[i * 3].toFixed(6) + ' ' + this.pos[i * 3 + 1].toFixed(6) + ' ' + this.pos[i * 3 + 2].toFixed(6) + '\n';
      for (let f = 0; f < this.nF; f++) out += 'f ' + (this.tri[f * 3] + 1) + ' ' + (this.tri[f * 3 + 1] + 1) + ' ' + (this.tri[f * 3 + 2] + 1) + '\n';
    }
    return out;
  }

  exportGLB() {
    return new Promise((resolve, reject) => {
      if (!this.mesh) { reject(new Error('No mesh')); return; }
      const g = this.mesh.geometry.clone();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xb9bfc8, roughness: 0.85 }));
      m.name = this.modelName;
      new GLTFExporter().parse(m, (bin) => resolve(bin), (e) => reject(e), { binary: true });
    });
  }

  // ---------------------------------------------------------- VIEW / LOOP
  setView(name) {
    const t = this.controls.target, d = this.camera.position.distanceTo(t);
    if (name === 'front') this.camera.position.set(t.x, t.y, t.z + d);
    else if (name === 'back') this.camera.position.set(t.x, t.y, t.z - d);
    else if (name === 'side') this.camera.position.set(t.x + d, t.y, t.z);
    else if (name === 'top') this.camera.position.set(t.x, t.y + d, t.z + 0.001);
    else this.camera.position.set(t.x + d * 0.55, t.y + d * 0.4, t.z + d * 0.75);
    this.camera.lookAt(t);
  }

  _frame() {
    if (!this.mesh) return;
    const box = new THREE.Box3().setFromObject(this.mesh);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    this.controls.target.copy(c);
    const d = Math.max(sz.x, sz.y, sz.z) * 1.6 + 0.4;
    this.camera.position.set(c.x + d * 0.55, c.y + d * 0.35, c.z + d * 0.8);
  }

  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  _loop() {
    requestAnimationFrame(this._loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
