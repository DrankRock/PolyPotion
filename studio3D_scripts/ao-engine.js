// ============================================================
// ao-engine.js — BAKE  (AOEngine)
// Loads a model (GLB/FBX/OBJ), bakes it into one normalized surface,
// builds a BVH over the triangle soup, and fires cosine-weighted
// hemisphere rays from every (welded) vertex to bake RAYTRACED ambient
// occlusion + crevice/cavity darkening straight into per-vertex colors.
// Raw photogrammetry / meshy.ai scans go from flat-and-plasticky to
// "already rendered" — soft contact shadows under arms & chins, dark
// creases in folds and seams — entirely on-device, no UVs needed.
// Loaded by dynamic import from Bake.dc.html, like the other engines.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { fetchAssetBuffer } from './chunk-loader.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ============================================================
// BVH over a non-indexed triangle soup (Float32Array, 9 floats / tri)
// Flat typed-array layout, median split on the longest axis, explicit
// stacks for both build and traversal. Nearest-hit query with a tmax.
// ============================================================
const LEAF = 4;
const RAY_STACK = new Int32Array(128);

export function buildBVH(pos) {
  const triCount = pos.length / 9;
  const cent = new Float32Array(triCount * 3);
  const tmin = new Float32Array(triCount * 3);
  const tmax = new Float32Array(triCount * 3);
  for (let i = 0; i < triCount; i++) {
    const o = i * 9;
    const ax = pos[o], ay = pos[o + 1], az = pos[o + 2];
    const bx = pos[o + 3], by = pos[o + 4], bz = pos[o + 5];
    const cx = pos[o + 6], cy = pos[o + 7], cz = pos[o + 8];
    cent[i * 3] = (ax + bx + cx) / 3; cent[i * 3 + 1] = (ay + by + cy) / 3; cent[i * 3 + 2] = (az + bz + cz) / 3;
    tmin[i * 3] = Math.min(ax, bx, cx); tmin[i * 3 + 1] = Math.min(ay, by, cy); tmin[i * 3 + 2] = Math.min(az, bz, cz);
    tmax[i * 3] = Math.max(ax, bx, cx); tmax[i * 3 + 1] = Math.max(ay, by, cy); tmax[i * 3 + 2] = Math.max(az, bz, cz);
  }
  const triIdx = new Uint32Array(triCount);
  for (let i = 0; i < triCount; i++) triIdx[i] = i;

  const maxNodes = Math.max(2, triCount * 2);
  const nMin = new Float32Array(maxNodes * 3);
  const nMax = new Float32Array(maxNodes * 3);
  const nLeft = new Int32Array(maxNodes);   // internal: left child index · leaf: first tri slot
  const nCount = new Int32Array(maxNodes);  // 0 = internal node · >0 = leaf tri count
  let nodeCount = 0;
  const makeNode = () => nodeCount++;

  function updateBounds(node) {
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    const first = nLeft[node], cnt = nCount[node];
    for (let i = 0; i < cnt; i++) {
      const t = triIdx[first + i] * 3;
      if (tmin[t] < mnx) mnx = tmin[t]; if (tmin[t + 1] < mny) mny = tmin[t + 1]; if (tmin[t + 2] < mnz) mnz = tmin[t + 2];
      if (tmax[t] > mxx) mxx = tmax[t]; if (tmax[t + 1] > mxy) mxy = tmax[t + 1]; if (tmax[t + 2] > mxz) mxz = tmax[t + 2];
    }
    nMin[node * 3] = mnx; nMin[node * 3 + 1] = mny; nMin[node * 3 + 2] = mnz;
    nMax[node * 3] = mxx; nMax[node * 3 + 1] = mxy; nMax[node * 3 + 2] = mxz;
  }

  const root = makeNode();
  nLeft[root] = 0; nCount[root] = triCount; updateBounds(root);
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    const cnt = nCount[node];
    if (cnt <= LEAF) continue;
    const ex = nMax[node * 3] - nMin[node * 3], ey = nMax[node * 3 + 1] - nMin[node * 3 + 1], ez = nMax[node * 3 + 2] - nMin[node * 3 + 2];
    let axis = 0, ext = ex; if (ey > ext) { axis = 1; ext = ey; } if (ez > ext) { axis = 2; ext = ez; }
    const splitPos = nMin[node * 3 + axis] + ext * 0.5;
    const first = nLeft[node];
    let i = first, j = first + cnt - 1;
    while (i <= j) {
      if (cent[triIdx[i] * 3 + axis] < splitPos) i++;
      else { const tmp = triIdx[i]; triIdx[i] = triIdx[j]; triIdx[j] = tmp; j--; }
    }
    const leftCount = i - first;
    if (leftCount === 0 || leftCount === cnt) continue; // degenerate split → keep as leaf
    const left = makeNode(), right = makeNode();
    nLeft[left] = first; nCount[left] = leftCount;
    nLeft[right] = i; nCount[right] = cnt - leftCount;
    nLeft[node] = left; nCount[node] = 0;
    updateBounds(left); updateBounds(right);
    stack.push(left); stack.push(right);
  }
  return { pos, triIdx, nMin, nMax, nLeft, nCount };
}

// any-hit occlusion test: returns true on the FIRST triangle hit within
// (EPS, tmax). Early-exits, so it is far cheaper than a nearest query —
// exactly what AO needs (we only care *whether* a direction is blocked).
export function rayOccluded(bvh, ox, oy, oz, dx, dy, dz, tmax) {
  const { pos, triIdx, nMin, nMax, nLeft, nCount } = bvh;
  const invx = 1 / dx, invy = 1 / dy, invz = 1 / dz;
  const EPS = 1e-5;
  let sp = 0; RAY_STACK[sp++] = 0;
  while (sp) {
    const node = RAY_STACK[--sp];
    // ray / AABB slab test
    const n3 = node * 3;
    let t1 = (nMin[n3] - ox) * invx, t2 = (nMax[n3] - ox) * invx;
    let tminB = Math.min(t1, t2), tmaxB = Math.max(t1, t2);
    t1 = (nMin[n3 + 1] - oy) * invy; t2 = (nMax[n3 + 1] - oy) * invy;
    tminB = Math.max(tminB, Math.min(t1, t2)); tmaxB = Math.min(tmaxB, Math.max(t1, t2));
    t1 = (nMin[n3 + 2] - oz) * invz; t2 = (nMax[n3 + 2] - oz) * invz;
    tminB = Math.max(tminB, Math.min(t1, t2)); tmaxB = Math.min(tmaxB, Math.max(t1, t2));
    if (tmaxB < Math.max(tminB, 0) || tminB > tmax) continue;

    if (nCount[node] > 0) {
      const first = nLeft[node], cnt = nCount[node];
      for (let k = 0; k < cnt; k++) {
        const ti = triIdx[first + k] * 9;
        // Möller–Trumbore
        const ax = pos[ti], ay = pos[ti + 1], az = pos[ti + 2];
        const e1x = pos[ti + 3] - ax, e1y = pos[ti + 4] - ay, e1z = pos[ti + 5] - az;
        const e2x = pos[ti + 6] - ax, e2y = pos[ti + 7] - ay, e2z = pos[ti + 8] - az;
        const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        if (det > -1e-9 && det < 1e-9) continue;
        const inv = 1 / det;
        const tx = ox - ax, ty = oy - ay, tz = oz - az;
        const u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
        const vv = (dx * qx + dy * qy + dz * qz) * inv;
        if (vv < 0 || u + vv > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > EPS && t < tmax) return true;   // any hit → blocked
      }
    } else {
      const l = nLeft[node];
      RAY_STACK[sp++] = l; RAY_STACK[sp++] = l + 1;
    }
  }
  return false;
}

export class AOEngine {
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
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.3; this.controls.maxDistance = 14;

    this.hemi = new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0); this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffffff, 1.35); this.key.position.set(2.4, 4.2, 3.0);
    this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.camera.near = 0.5; this.key.shadow.camera.far = 16;
    this.key.shadow.camera.left = -3; this.key.shadow.camera.right = 3; this.key.shadow.camera.top = 4; this.key.shadow.camera.bottom = -1;
    this.key.shadow.bias = -0.0009; this.scene.add(this.key);
    this.rim = new THREE.DirectionalLight(0x86a0d8, 0.45); this.rim.position.set(-3, 2.2, -2.4); this.scene.add(this.rim);
    this.fill = new THREE.DirectionalLight(0xffe9cf, 0.3); this.fill.position.set(0.5, 1.0, -3.0); this.scene.add(this.fill);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);

    this.root = new THREE.Group(); this.scene.add(this.root);

    this.mesh = null;
    this.origPos = null;       // Float32Array, non-indexed triangle soup (source of truth)
    this.smoothNormal = null;  // Float32Array, smooth per-source-vertex normals
    this.aoColors = null;      // Float32Array rgb per source vertex (the bake)
    this.bvh = null;
    this.weld = null;          // { vidx:Uint32, count, pos:Float32, normal:Float32 }
    this.tris = 0; this.verts = 0;
    this.modelName = ''; this.modelRadius = 1; this.modelCenter = V(0, 0.95, 0);
    this.baked = false; this.display = 'shaded'; // shaded | occlusion | off

    this.onStatus = null; this.onChange = null;
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__aoEngine = this;
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
    else if (ext === 'obj') obj = this._obj.parse(new TextDecoder().decode(buf));
    else throw new Error('Unsupported .' + ext);

    obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
    obj.updateMatrixWorld(true);

    const srcs = [];
    obj.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry) srcs.push(o); });
    if (!srcs.length) throw new Error('No mesh found in file');

    this._status('Baking surface…');
    const chunks = []; const gbox = new THREE.Box3();
    for (const m of srcs) {
      let g = m.geometry; if (g.index) g = g.toNonIndexed(); g = g.clone();
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', g.attributes.position.clone());
      pg.applyMatrix4(m.matrixWorld); pg.computeBoundingBox(); gbox.union(pg.boundingBox);
      chunks.push(pg);
    }
    const size = gbox.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1);
    const cx = (gbox.min.x + gbox.max.x) / 2, cz = (gbox.min.z + gbox.max.z) / 2, minY = gbox.min.y;
    const normM = new THREE.Matrix4().makeTranslation(-cx * s, -minY * s, -cz * s).multiply(new THREE.Matrix4().makeScale(s, s, s));

    let total = 0; chunks.forEach(c => total += c.attributes.position.count);
    const flat = new Float32Array(total * 3); let o = 0;
    for (const c of chunks) { c.applyMatrix4(normM); const p = c.attributes.position; flat.set(p.array.subarray(0, p.count * 3), o); o += p.count * 3; c.dispose(); }

    this.origPos = flat;
    this.tris = total / 3; this.verts = total;
    this.modelName = (name || 'model').replace(/\.(glb|gltf|fbx|obj)$/i, '');

    this._status('Welding & normals…');
    this._buildWeld();          // weld verts + smooth normals
    this._status('Building BVH…');
    await new Promise(r => setTimeout(r, 0));
    this.bvh = buildBVH(flat);  // ray-accel structure

    this.aoColors = null; this.baked = false; this.display = 'shaded';
    this._setGeometry();
    this._frame();
    this._status('');
    this._changed();
    return this.stats();
  }

  // weld exact-shared verts → unique points; accumulate smooth normals.
  _buildWeld() {
    const pos = this.origPos, n = pos.length / 3;
    const q = 1e5;
    const map = new Map();
    const vidx = new Uint32Array(n);
    const ux = [], uy = [], uz = [];
    for (let i = 0; i < n; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const k = Math.round(x * q) + '_' + Math.round(y * q) + '_' + Math.round(z * q);
      let id = map.get(k);
      if (id === undefined) { id = ux.length; ux.push(x); uy.push(y); uz.push(z); map.set(k, id); }
      vidx[i] = id;
    }
    const uc = ux.length;
    const upos = new Float32Array(uc * 3), unrm = new Float32Array(uc * 3);
    for (let i = 0; i < uc; i++) { upos[i * 3] = ux[i]; upos[i * 3 + 1] = uy[i]; upos[i * 3 + 2] = uz[i]; }
    // accumulate face normals onto unique verts
    for (let t = 0; t < n; t += 3) {
      const a = vidx[t], b = vidx[t + 1], c = vidx[t + 2];
      const ax = pos[t * 3], ay = pos[t * 3 + 1], az = pos[t * 3 + 2];
      const bx = pos[t * 3 + 3], by = pos[t * 3 + 4], bz = pos[t * 3 + 5];
      const cx = pos[t * 3 + 6], cy = pos[t * 3 + 7], cz = pos[t * 3 + 8];
      const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      unrm[a * 3] += nx; unrm[a * 3 + 1] += ny; unrm[a * 3 + 2] += nz;
      unrm[b * 3] += nx; unrm[b * 3 + 1] += ny; unrm[b * 3 + 2] += nz;
      unrm[c * 3] += nx; unrm[c * 3 + 1] += ny; unrm[c * 3 + 2] += nz;
    }
    for (let i = 0; i < uc; i++) {
      let x = unrm[i * 3], y = unrm[i * 3 + 1], z = unrm[i * 3 + 2];
      const l = Math.hypot(x, y, z) || 1; unrm[i * 3] = x / l; unrm[i * 3 + 1] = y / l; unrm[i * 3 + 2] = z / l;
    }
    // expand smooth normals back to source verts (for nice shading too)
    const sn = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const u = vidx[i]; sn[i * 3] = unrm[u * 3]; sn[i * 3 + 1] = unrm[u * 3 + 1]; sn[i * 3 + 2] = unrm[u * 3 + 2]; }
    this.weld = { vidx, count: uc, pos: upos, normal: unrm };
    this.smoothNormal = sn;
  }

  // ---------------------------------------------------------- BAKE
  // Fire cosine-weighted hemisphere rays from each welded vertex into the
  // BVH. Nearest-hit distance feeds two terms in one pass:
  //   AO     — soft occlusion over the whole radius (distance falloff)
  //   cavity — high-frequency crease darkening (short radius hits only)
  async bake(opts) {
    if (!this.origPos || !this.bvh || !this.weld) return null;
    const samples = Math.max(8, opts.samples | 0);
    const strength = (opts.strength != null ? opts.strength : 1.0);   // 0..~1.6
    const radius = (opts.radius != null ? opts.radius : 0.25) * this.modelRadius;
    const cavityAmt = (opts.cavity != null ? opts.cavity : 0.6);      // 0..~1.4
    const cavRadius = radius * 0.17;
    const gamma = (opts.contrast != null ? opts.contrast : 1.0);
    const tintR = 0.78, tintG = 0.80, tintB = 0.84; // base albedo the bake multiplies into

    const w = this.weld, pos = w.pos, nrm = w.normal, uc = w.count, bvh = this.bvh;
    const uAO = new Float32Array(uc);
    const eps = this.modelRadius * 0.0016;

    const t0 = performance.now();
    const CHUNK = 1400;
    for (let base = 0; base < uc; base += CHUNK) {
      const end = Math.min(uc, base + CHUNK);
      for (let i = base; i < end; i++) {
        const nx = nrm[i * 3], ny = nrm[i * 3 + 1], nz = nrm[i * 3 + 2];
        // tangent frame
        let tx, ty, tz;
        if (Math.abs(nx) > 0.9) { tx = 0; ty = 1; tz = 0; } else { tx = 1; ty = 0; tz = 0; }
        // t = normalize(t - n*(t·n))
        let d = tx * nx + ty * ny + tz * nz;
        tx -= nx * d; ty -= ny * d; tz -= nz * d;
        let tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
        const ox = pos[i * 3] + nx * eps, oy = pos[i * 3 + 1] + ny * eps, oz = pos[i * 3 + 2] + nz * eps;

        let seed = (i * 9781 + 12347) >>> 0;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

        let occ = 0, cav = 0;
        for (let s = 0; s < samples; s++) {
          const u1 = rnd(), u2 = rnd();
          const r = Math.sqrt(u1), th = 6.2831853 * u2;
          const lx = r * Math.cos(th), ly = r * Math.sin(th), lz = Math.sqrt(Math.max(0, 1 - u1));
          const dx = lx * tx + ly * bx + lz * nx;
          const dy = lx * ty + ly * by + lz * ny;
          const dz = lx * tz + ly * bz + lz * nz;
          // short crease ray first (cheap, hard-prunes the BVH). A near hit
          // implies a far hit too, so it covers both terms in one trace;
          // only when the crease ray misses do we pay for the full-radius ray.
          if (rayOccluded(bvh, ox, oy, oz, dx, dy, dz, cavRadius)) { occ++; cav++; }
          else if (rayOccluded(bvh, ox, oy, oz, dx, dy, dz, radius)) occ++;
        }
        occ /= samples; cav /= samples;
        let val = (1 - Math.min(1, strength * occ)) * (1 - Math.min(1, cavityAmt * cav));
        if (gamma !== 1) val = Math.pow(Math.max(0, val), gamma);
        uAO[i] = 0.03 + 0.97 * Math.max(0, Math.min(1, val));
      }
      this._status('Tracing occlusion… ' + Math.round(end / uc * 100) + '%');
      await new Promise(r => setTimeout(r, 0));
    }

    // expand to per-source-vertex colors (smooth across shared edges)
    const n = this.origPos.length / 3;
    const col = new Float32Array(n * 3);
    const vidx = w.vidx;
    for (let i = 0; i < n; i++) {
      const a = uAO[vidx[i]];
      col[i * 3] = a * tintR; col[i * 3 + 1] = a * tintG; col[i * 3 + 2] = a * tintB;
    }
    this.aoColors = col; this.baked = true;
    this._setGeometry();
    this._status('');
    this._changed();
    return { tris: this.tris, verts: uc, samples, ms: Math.round(performance.now() - t0) };
  }

  clearBake() {
    this.aoColors = null; this.baked = false; this.display = 'shaded';
    this._setGeometry(); this._changed();
  }

  // ---------------------------------------------------------- DISPLAY
  setDisplay(mode) { this.display = mode; this._setGeometry(); }

  _setGeometry() {
    this._disposeMesh();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.origPos.slice(0), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.smoothNormal.slice(0), 3));
    const useCol = this.baked && this.aoColors && this.display !== 'off';
    if (useCol) geo.setAttribute('color', new THREE.BufferAttribute(this.aoColors.slice(0), 3));
    geo.computeBoundingBox(); geo.computeBoundingSphere();

    let mat;
    if (this.display === 'occlusion' && useCol) {
      // flat, lighting-independent readout of the pure baked occlusion
      mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: useCol ? 0xffffff : 0x9aa3ad, vertexColors: useCol,
        roughness: 0.74, metalness: 0.02, side: THREE.DoubleSide, flatShading: false,
      });
    }
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    this.mesh = mesh; this.root.add(mesh);
    const box = geo.boundingBox; this.modelCenter = box.getCenter(new THREE.Vector3());
    this.modelRadius = box.getBoundingSphere(new THREE.Sphere()).radius || 1;
  }

  // ---------------------------------------------------------- EXPORT (vertex-colored OBJ)
  exportOBJ() {
    if (!this.mesh) return '';
    const pos = this.mesh.geometry.attributes.position;
    const col = this.aoColors;
    const map = new Map(); const verts = []; const cols = []; const idx = new Int32Array(pos.count);
    const q = 1e5;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = Math.round(x * q) + '_' + Math.round(y * q) + '_' + Math.round(z * q);
      let id = map.get(k);
      if (id == null) { id = verts.length / 3; verts.push(x, y, z); if (col) cols.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]); map.set(k, id); }
      idx[i] = id;
    }
    let s = '# ' + (this.modelName || 'mesh') + ' — AO + cavity baked to vertex colors (Studio · Bake)\n';
    for (let i = 0; i < verts.length; i += 3) {
      s += 'v ' + verts[i].toFixed(6) + ' ' + verts[i + 1].toFixed(6) + ' ' + verts[i + 2].toFixed(6);
      if (col && cols.length) s += ' ' + cols[i].toFixed(4) + ' ' + cols[i + 1].toFixed(4) + ' ' + cols[i + 2].toFixed(4);
      s += '\n';
    }
    for (let f = 0; f < pos.count; f += 3) s += 'f ' + (idx[f] + 1) + ' ' + (idx[f + 1] + 1) + ' ' + (idx[f + 2] + 1) + '\n';
    return s;
  }

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
  _frame() {
    const c = this.modelCenter, r = this.modelRadius;
    this.controls.target.copy(c);
    this.camera.position.set(c.x + r * 0.6, c.y + r * 0.2, c.z + r * 2.6);
    this.controls.update();
  }
  frameModel() { this._frame(); }

  stats() { return { name: this.modelName, tris: this.tris, verts: this.weld ? this.weld.count : 0, baked: this.baked }; }

  _disposeMesh() {
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null; }
  }
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return; requestAnimationFrame(this._loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

export default AOEngine;
