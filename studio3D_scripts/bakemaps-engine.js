// ============================================================
// bakemaps-engine.js — BAKE MAPS  (BMEngine)
// Close the sculpt → retopo → UV → bake loop: project surface detail from a
// high-res mesh onto a low-poly mesh's UV layout as texture maps.
//   • NORMAL   tangent-space normal map (high detail on a light cage)
//   • AO       ambient occlusion (hemisphere rays against the high mesh)
//   • CURVATURE  convex/concave edges (great for masks & edge wear)
//   • HEIGHT   signed distance high↔low along the cage
// A uniform triangle grid accelerates the ray/closest queries so a 1k map
// bakes in seconds, on-device. Maps are dilated (edge-padded) to kill seams,
// previewed live on the model, and exported as PNG. If only one mesh is
// loaded it self-bakes AO + curvature. Loaded by import from BakeMaps.dc.html.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { fetchAssetBuffer } from './chunk-loader.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js';

const themeViewport = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };

// --------------------------------------------------------- triangle grid
// Uniform voxel grid over a triangle soup for fast ray-hit + closest-point.
class TriGrid {
  constructor(pos, nor) {
    this.pos = pos; this.nor = nor; this.nt = pos.length / 9;
    const box = new THREE.Box3();
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]); box.expandByPoint(v); }
    box.expandByScalar(1e-4);
    this.min = box.min.clone(); const size = box.getSize(new THREE.Vector3());
    const res = Math.max(8, Math.min(64, Math.round(Math.cbrt(this.nt))));
    this.res = res;
    this.cell = new THREE.Vector3(size.x / res || 1, size.y / res || 1, size.z / res || 1);
    this.cells = new Map();
    const key = (x, y, z) => x + ',' + y + ',' + z;
    const tb = new THREE.Box3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < this.nt; t++) {
      const o = t * 9;
      a.set(pos[o], pos[o + 1], pos[o + 2]); b.set(pos[o + 3], pos[o + 4], pos[o + 5]); c.set(pos[o + 6], pos[o + 7], pos[o + 8]);
      tb.makeEmpty(); tb.expandByPoint(a); tb.expandByPoint(b); tb.expandByPoint(c);
      const lo = this._cellOf(tb.min), hi = this._cellOf(tb.max);
      for (let x = lo.x; x <= hi.x; x++) for (let y = lo.y; y <= hi.y; y++) for (let z = lo.z; z <= hi.z; z++) {
        const k = key(x, y, z); let arr = this.cells.get(k); if (!arr) { arr = []; this.cells.set(k, arr); } arr.push(t);
      }
    }
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3();
  }
  _cellOf(p) {
    return {
      x: Math.max(0, Math.min(this.res - 1, Math.floor((p.x - this.min.x) / this.cell.x))),
      y: Math.max(0, Math.min(this.res - 1, Math.floor((p.y - this.min.y) / this.cell.y))),
      z: Math.max(0, Math.min(this.res - 1, Math.floor((p.z - this.min.z) / this.cell.z))),
    };
  }
  _tri(t, a, b, c) { const o = t * 9; a.set(this.pos[o], this.pos[o + 1], this.pos[o + 2]); b.set(this.pos[o + 3], this.pos[o + 4], this.pos[o + 5]); c.set(this.pos[o + 6], this.pos[o + 7], this.pos[o + 8]); }

  // Möller–Trumbore; returns {t,tri,bary} of nearest hit within [0,maxT], or null
  raycast(ro, rd, maxT) {
    // walk voxels along the ray (3D DDA), test triangles per cell
    const a = this._a, b = this._b, c = this._c;
    let best = null;
    const seen = new Set();
    let px = ro.x, py = ro.y, pz = ro.z;
    let cell = this._cellOf({ x: px, y: py, z: pz });
    const step = { x: rd.x > 0 ? 1 : -1, y: rd.y > 0 ? 1 : -1, z: rd.z > 0 ? 1 : -1 };
    const inv = { x: rd.x !== 0 ? 1 / rd.x : 1e30, y: rd.y !== 0 ? 1 / rd.y : 1e30, z: rd.z !== 0 ? 1 / rd.z : 1e30 };
    const nextBound = (i, mn, cs, st) => this.min[i] + (st > 0 ? (cell[i] + 1) : cell[i]) * cs;
    let tMaxX = (this.min.x + (step.x > 0 ? cell.x + 1 : cell.x) * this.cell.x - px) * inv.x;
    let tMaxY = (this.min.y + (step.y > 0 ? cell.y + 1 : cell.y) * this.cell.y - py) * inv.y;
    let tMaxZ = (this.min.z + (step.z > 0 ? cell.z + 1 : cell.z) * this.cell.z - pz) * inv.z;
    const tDelta = { x: Math.abs(this.cell.x * inv.x), y: Math.abs(this.cell.y * inv.y), z: Math.abs(this.cell.z * inv.z) };
    let guard = 0;
    while (guard++ < this.res * 3 + 3) {
      const arr = this.cells.get(cell.x + ',' + cell.y + ',' + cell.z);
      if (arr) for (const t of arr) {
        if (seen.has(t)) continue; seen.add(t);
        this._tri(t, a, b, c);
        const hit = this._mt(ro, rd, a, b, c);
        if (hit != null && hit >= 0 && hit <= maxT && (!best || hit < best.t)) best = { t: hit, tri: t };
      }
      if (best) return best; // first cell with a hit is closest enough (grid ordered along ray)
      // advance
      if (tMaxX < tMaxY && tMaxX < tMaxZ) { cell.x += step.x; if (cell.x < 0 || cell.x >= this.res) break; tMaxX += tDelta.x; }
      else if (tMaxY < tMaxZ) { cell.y += step.y; if (cell.y < 0 || cell.y >= this.res) break; tMaxY += tDelta.y; }
      else { cell.z += step.z; if (cell.z < 0 || cell.z >= this.res) break; tMaxZ += tDelta.z; }
      if (Math.min(tMaxX, tMaxY, tMaxZ) > maxT) break;
    }
    return best;
  }
  _mt(ro, rd, a, b, c) {
    const e1x = b.x - a.x, e1y = b.y - a.y, e1z = b.z - a.z;
    const e2x = c.x - a.x, e2y = c.y - a.y, e2z = c.z - a.z;
    const px = rd.y * e2z - rd.z * e2y, py = rd.z * e2x - rd.x * e2z, pz = rd.x * e2y - rd.y * e2x;
    const det = e1x * px + e1y * py + e1z * pz;
    if (det > -1e-9 && det < 1e-9) return null;
    const inv = 1 / det;
    const tx = ro.x - a.x, ty = ro.y - a.y, tz = ro.z - a.z;
    const u = (tx * px + ty * py + tz * pz) * inv; if (u < -1e-4 || u > 1.0001) return null;
    const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
    const vv = (rd.x * qx + rd.y * qy + rd.z * qz) * inv; if (vv < -1e-4 || u + vv > 1.0001) return null;
    return (e2x * qx + e2y * qy + e2z * qz) * inv;
  }
  triNormal(t, out) { const o = t * 3 * 3; // average of the 3 vertex normals if present
    if (this.nor) { out.set((this.nor[o] + this.nor[o + 3] + this.nor[o + 6]) / 3, (this.nor[o + 1] + this.nor[o + 4] + this.nor[o + 7]) / 3, (this.nor[o + 2] + this.nor[o + 5] + this.nor[o + 8]) / 3).normalize(); return out; }
    const a = this._a, b = this._b, c = this._c; this._tri(t, a, b, c);
    out.crossVectors(b.sub(a), c.sub(a)).normalize(); return out;
  }
}

export class BMEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(themeViewport());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(themeViewport()); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 100);
    this.camera.position.set(1.4, 1.2, 3.0);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.3; this.controls.maxDistance = 14;

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.25); key.position.set(2.4, 4.2, 3.0); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.45); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.45; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.root = new THREE.Group(); this.scene.add(this.root);

    this.lowMesh = null; this.highMesh = null; this.highGrid = null;
    this.lowName = ''; this.highName = ''; this.modelRadius = 1; this.modelCenter = new THREE.Vector3(0, 0.95, 0);
    this.maps = {}; // name -> {canvas, tex}
    this.preview = 'shaded';
    this.onStatus = null; this.onChange = null; this.onProgress = null;
    this._cancel = false;

    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasLow() { return !!this.lowMesh; }
  hasHigh() { return !!this.highMesh; }

  // ---------------------------------------------------------- LOADING
  async _parse(buf, ext, name) {
    let obj;
    if (ext === 'fbx') obj = this._fbx.parse(buf, '');
    else if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); obj = g.scene || (g.scenes && g.scenes[0]); }
    else if (ext === 'obj') obj = this._obj.parse(new TextDecoder().decode(buf));
    else throw new Error('Unsupported .' + ext);
    obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
    obj.updateMatrixWorld(true);
    return obj;
  }
  // merge all sub-meshes into one non-indexed geometry in WORLD space, keeping uv/normal
  _bake(obj, wantUV) {
    const parts = []; let haveUV = false;
    obj.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry) parts.push(o); });
    if (!parts.length) throw new Error('No mesh in file');
    const posA = [], norA = [], uvA = [];
    const gbox = new THREE.Box3();
    for (const m of parts) {
      let g = m.geometry; if (g.index) g = g.toNonIndexed(); else g = g.clone();
      g.applyMatrix4(m.matrixWorld);
      if (!g.attributes.normal) g.computeVertexNormals();
      const p = g.attributes.position, nn = g.attributes.normal, uv = g.attributes.uv;
      if (uv) haveUV = true;
      for (let i = 0; i < p.count; i++) {
        posA.push(p.getX(i), p.getY(i), p.getZ(i));
        norA.push(nn.getX(i), nn.getY(i), nn.getZ(i));
        uvA.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0);
      }
      g.computeBoundingBox(); gbox.union(g.boundingBox); g.dispose();
    }
    return { pos: new Float32Array(posA), nor: new Float32Array(norA), uv: new Float32Array(uvA), box: gbox, haveUV };
  }
  _normMatrix(box) {
    const size = box.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, minY = box.min.y;
    return new THREE.Matrix4().makeTranslation(-cx * s, -minY * s, -cz * s).multiply(new THREE.Matrix4().makeScale(s, s, s));
  }
  _applyMatrixTo(pos, nor, mat) {
    const nm = new THREE.Matrix3().getNormalMatrix(mat); const v = new THREE.Vector3();
    for (let i = 0; i < pos.length; i += 3) { v.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(mat); pos[i] = v.x; pos[i + 1] = v.y; pos[i + 2] = v.z; }
    for (let i = 0; i < nor.length; i += 3) { v.set(nor[i], nor[i + 1], nor[i + 2]).applyMatrix3(nm).normalize(); nor[i] = v.x; nor[i + 1] = v.y; nor[i + 2] = v.z; }
  }

  async loadLow(src) { return this._load(src, 'low'); }
  async loadHigh(src) { return this._load(src, 'high'); }
  async _load(src, which) {
    this._status('Parsing ' + which + '-res mesh…');
    const obj = await this._parse(src.buf, src.ext, src.name);
    const data = this._bake(obj);
    if (which === 'low') {
      // establish the shared normalization from the low mesh
      this._norm = this._normMatrix(data.box);
    }
    if (!this._norm) this._norm = this._normMatrix(data.box);
    this._applyMatrixTo(data.pos, data.nor, this._norm);
    if (which === 'low') {
      this._lowData = data; this.lowName = (src.name || 'low').replace(/\.[^.]+$/, '');
      this._buildLowMesh(data);
    } else {
      this._highData = data; this.highName = (src.name || 'high').replace(/\.[^.]+$/, '');
      this.highGrid = new TriGrid(data.pos, data.nor);
      this._buildHighMesh(data);
    }
    this._frame(); this._changed(); this._status('');
    return { name: which === 'low' ? this.lowName : this.highName, tris: data.pos.length / 9, haveUV: data.haveUV };
  }

  _buildLowMesh(data) {
    if (this.lowMesh) { this.root.remove(this.lowMesh); this.lowMesh.geometry.dispose(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.pos.slice(0), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(data.nor.slice(0), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(data.uv.slice(0), 2));
    const mat = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide });
    this.lowMesh = new THREE.Mesh(g, mat); this.root.add(this.lowMesh);
    const box = new THREE.Box3().setFromBufferAttribute(g.attributes.position);
    this.modelCenter = box.getCenter(new THREE.Vector3()); this.modelRadius = box.getSize(new THREE.Vector3()).y || 1.8;
    this._applyPreview();
  }
  _buildHighMesh(data) {
    if (this.highMesh) { this.root.remove(this.highMesh); this.highMesh.geometry.dispose(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(data.pos.slice(0), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(data.nor.slice(0), 3));
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a93a0, roughness: 0.8, metalness: 0.02, side: THREE.DoubleSide, wireframe: false, transparent: true, opacity: 0.0 });
    this.highMesh = new THREE.Mesh(g, mat); this.highMesh.visible = false; this.root.add(this.highMesh);
  }

  // ---------------------------------------------------------- BAKE
  cancel() { this._cancel = true; }
  async bake(opts) {
    if (!this.lowMesh) throw new Error('Load a low-poly target mesh first');
    const low = this._lowData;
    if (!low.haveUV) throw new Error('The target mesh has no UVs — unwrap it in the UV tool first');
    const res = opts.res || 512;
    const cage = (opts.cage || 0.04) * this.modelRadius;
    const rays = opts.aoRays || 24;
    const which = opts.maps || { normal: true, ao: true, curvature: true, height: false };
    const useHigh = !!this.highGrid;
    this._cancel = false;

    // buffers
    const N = res * res;
    const outNormal = which.normal ? new Uint8ClampedArray(N * 4) : null;
    const outAO = which.ao ? new Uint8ClampedArray(N * 4) : null;
    const outCurv = which.curvature ? new Uint8ClampedArray(N * 4) : null;
    const outHeight = which.height ? new Uint8ClampedArray(N * 4) : null;
    const mask = new Uint8Array(N);
    // per-texel geometry we keep for curvature post-pass
    const gN = which.curvature ? new Float32Array(N * 3) : null;

    // rasterize each triangle into UV space
    const pos = low.pos, nor = low.nor, uv = low.uv; const nt = pos.length / 9;
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const nA = new THREE.Vector3(), nB = new THREE.Vector3(), nC = new THREE.Vector3();
    const p = new THREE.Vector3(), nrm = new THREE.Vector3(), tang = new THREE.Vector3(), bitan = new THREE.Vector3();
    const hitN = new THREE.Vector3(), tmp = new THREE.Vector3();

    let done = 0;
    for (let t = 0; t < nt; t++) {
      if (this._cancel) throw new Error('cancelled');
      const o = t * 9, u = t * 6;
      A.set(pos[o], pos[o + 1], pos[o + 2]); B.set(pos[o + 3], pos[o + 4], pos[o + 5]); C.set(pos[o + 6], pos[o + 7], pos[o + 8]);
      nA.set(nor[o], nor[o + 1], nor[o + 2]); nB.set(nor[o + 3], nor[o + 4], nor[o + 5]); nC.set(nor[o + 6], nor[o + 7], nor[o + 8]);
      const u0 = uv[u], v0 = uv[u + 1], u1 = uv[u + 2], v1 = uv[u + 3], u2 = uv[u + 4], v2 = uv[u + 5];
      // tangent from UV gradient
      this._triTangent(A, B, C, u0, v0, u1, v1, u2, v2, tang);
      // pixel bbox
      const px0 = u0 * res, py0 = (1 - v0) * res, px1 = u1 * res, py1 = (1 - v1) * res, px2 = u2 * res, py2 = (1 - v2) * res;
      let minX = Math.max(0, Math.floor(Math.min(px0, px1, px2))), maxX = Math.min(res - 1, Math.ceil(Math.max(px0, px1, px2)));
      let minY = Math.max(0, Math.floor(Math.min(py0, py1, py2))), maxY = Math.min(res - 1, Math.ceil(Math.max(py0, py1, py2)));
      const denom = (py1 - py2) * (px0 - px2) + (px2 - px1) * (py0 - py2);
      if (Math.abs(denom) < 1e-9) continue;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const cx = x + 0.5, cy = y + 0.5;
        const l0 = ((py1 - py2) * (cx - px2) + (px2 - px1) * (cy - py2)) / denom;
        const l1 = ((py2 - py0) * (cx - px2) + (px0 - px2) * (cy - py2)) / denom;
        const l2 = 1 - l0 - l1;
        if (l0 < -0.001 || l1 < -0.001 || l2 < -0.001) continue;
        const idx = y * res + x;
        // interpolate position + normal
        p.set(A.x * l0 + B.x * l1 + C.x * l2, A.y * l0 + B.y * l1 + C.y * l2, A.z * l0 + B.z * l1 + C.z * l2);
        nrm.set(nA.x * l0 + nB.x * l1 + nC.x * l2, nA.y * l0 + nB.y * l1 + nC.y * l2, nA.z * l0 + nB.z * l1 + nC.z * l2).normalize();
        // tangent basis
        tang.copy(tang).addScaledVector(nrm, -tang.dot(nrm)).normalize();
        bitan.crossVectors(nrm, tang);
        mask[idx] = 1;
        if (gN) { gN[idx * 3] = nrm.x; gN[idx * 3 + 1] = nrm.y; gN[idx * 3 + 2] = nrm.z; }

        // ---- NORMAL: raycast cage → high, encode tangent-space
        if (outNormal) {
          let tn = null;
          if (useHigh) {
            const ro = tmp.copy(p).addScaledVector(nrm, cage);
            const rd = nrm.clone().negate();
            const hit = this.highGrid.raycast(ro, rd, cage * 2.2);
            if (hit) { this.highGrid.triNormal(hit.tri, hitN); tn = hitN; }
          }
          if (!tn) tn = nrm; // self / miss → flat
          const tx = tn.dot(tang), ty = tn.dot(bitan), tz = tn.dot(nrm);
          outNormal[idx * 4] = (tx * 0.5 + 0.5) * 255; outNormal[idx * 4 + 1] = (ty * 0.5 + 0.5) * 255;
          outNormal[idx * 4 + 2] = (tz * 0.5 + 0.5) * 255; outNormal[idx * 4 + 3] = 255;
        }
        // ---- HEIGHT: signed distance low↔high along normal
        if (outHeight) {
          let h = 0.5;
          if (useHigh) {
            const ro = tmp.copy(p).addScaledVector(nrm, cage), rd = nrm.clone().negate();
            const hit = this.highGrid.raycast(ro, rd, cage * 2.2);
            if (hit) h = 1 - (hit.t / (cage * 2.2));
          }
          const hv = Math.max(0, Math.min(255, h * 255)); outHeight[idx * 4] = outHeight[idx * 4 + 1] = outHeight[idx * 4 + 2] = hv; outHeight[idx * 4 + 3] = 255;
        }
        // ---- AO: hemisphere rays against high (or low)
        if (outAO) {
          const occ = this._ao(p, nrm, tang, bitan, rays, useHigh, cage);
          const av = Math.max(0, Math.min(255, (1 - occ) * 255)); outAO[idx * 4] = outAO[idx * 4 + 1] = outAO[idx * 4 + 2] = av; outAO[idx * 4 + 3] = 255;
        }
      }
      done++;
      if ((t & 63) === 0) { const pr = t / nt; if (this.onProgress) this.onProgress(pr * (which.curvature ? 0.85 : 1)); this._status('Baking… ' + Math.round(pr * 100) + '%'); await new Promise(r => setTimeout(r)); }
    }

    // ---- CURVATURE: from baked normal divergence across UV neighbours
    if (outCurv) {
      for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
        const idx = y * res + x; if (!mask[idx]) { outCurv[idx * 4] = outCurv[idx * 4 + 1] = outCurv[idx * 4 + 2] = 128; outCurv[idx * 4 + 3] = 255; continue; }
        let acc = 0, cnt = 0; const bx = gN[idx * 3], by = gN[idx * 3 + 1], bz = gN[idx * 3 + 2];
        const neigh = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of neigh) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= res || ny >= res) continue; const ni = ny * res + nx; if (!mask[ni]) continue; const d = bx * gN[ni * 3] + by * gN[ni * 3 + 1] + bz * gN[ni * 3 + 2]; acc += (1 - d); cnt++; }
        const cv = cnt ? Math.max(0, Math.min(1, 0.5 + acc / cnt * 6)) : 0.5;
        const c8 = cv * 255; outCurv[idx * 4] = outCurv[idx * 4 + 1] = outCurv[idx * 4 + 2] = c8; outCurv[idx * 4 + 3] = 255;
      }
      if (this.onProgress) this.onProgress(0.92);
    }

    // ---- dilate (edge padding) to kill seams
    this.maps = {};
    const finish = (buf, name, flatColor) => { if (!buf) return; this._dilate(buf, mask, res); this.maps[name] = this._toCanvas(buf, res, name); };
    finish(outNormal, 'normal'); finish(outAO, 'ao'); finish(outCurv, 'curvature'); finish(outHeight, 'height');
    if (this.onProgress) this.onProgress(1); this._status('');
    this._applyPreview(); this._changed();
    return { maps: Object.keys(this.maps), res };
  }

  _triTangent(A, B, C, u0, v0, u1, v1, u2, v2, out) {
    const e1 = B.clone().sub(A), e2 = C.clone().sub(A);
    const du1 = u1 - u0, dv1 = v1 - v0, du2 = u2 - u0, dv2 = v2 - v0;
    const r = du1 * dv2 - du2 * dv1;
    if (Math.abs(r) < 1e-9) { out.copy(e1).normalize(); return; }
    const f = 1 / r;
    out.set(f * (dv2 * e1.x - dv1 * e2.x), f * (dv2 * e1.y - dv1 * e2.y), f * (dv2 * e1.z - dv1 * e2.z)).normalize();
  }
  _ao(p, n, tang, bitan, rays, useHigh, cage) {
    let occ = 0; const dir = new THREE.Vector3(); const ro = p.clone().addScaledVector(n, cage * 0.15);
    const maxT = this.modelRadius * 0.9;
    for (let i = 0; i < rays; i++) {
      // cosine-ish hemisphere sample
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      const x = Math.cos(a) * r, y = Math.sin(a) * r, z = Math.sqrt(1 - r * r);
      dir.set(tang.x * x + bitan.x * y + n.x * z, tang.y * x + bitan.y * y + n.y * z, tang.z * x + bitan.z * y + n.z * z).normalize();
      if (useHigh) { const hit = this.highGrid.raycast(ro, dir, maxT); if (hit) occ += 1 - Math.min(1, hit.t / maxT); }
    }
    return rays ? occ / rays : 0;
  }
  _dilate(buf, mask, res) {
    // 2-pass expand of valid pixels into empty neighbours
    for (let pass = 0; pass < 4; pass++) {
      const add = [];
      for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
        const idx = y * res + x; if (mask[idx]) continue;
        let r = 0, g = 0, b = 0, a = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= res || ny >= res) continue; const ni = ny * res + nx; if (mask[ni] === 1) { r += buf[ni * 4]; g += buf[ni * 4 + 1]; b += buf[ni * 4 + 2]; a += buf[ni * 4 + 3]; c++; } }
        if (c) add.push([idx, r / c, g / c, b / c, a / c]);
      }
      for (const [idx, r, g, b, a] of add) { buf[idx * 4] = r; buf[idx * 4 + 1] = g; buf[idx * 4 + 2] = b; buf[idx * 4 + 3] = a; mask[idx] = 1; }
    }
  }
  _toCanvas(buf, res, name) {
    const cv = document.createElement('canvas'); cv.width = cv.height = res;
    const ctx = cv.getContext('2d'); const img = new ImageData(new Uint8ClampedArray(buf), res, res); ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = (name === 'normal') ? THREE.NoColorSpace : THREE.SRGBColorSpace; tex.needsUpdate = true;
    return { canvas: cv, tex };
  }

  // ---------------------------------------------------------- PREVIEW / EXPORT
  setPreview(mode) { this.preview = mode; this._applyPreview(); }
  _applyPreview() {
    if (!this.lowMesh) return;
    const m = this.lowMesh; const mode = this.preview;
    const base = new THREE.MeshStandardMaterial({ color: 0xb8c0cc, roughness: 0.7, metalness: 0.02, side: THREE.DoubleSide });
    if (mode === 'shaded') {
      if (this.maps.normal) base.normalMap = this.maps.normal.tex;
      if (this.maps.ao) { base.aoMap = this.maps.ao.tex; this._ensureUV2(); }
    } else if (this.maps[mode]) {
      base.map = this.maps[mode].tex; base.roughness = 1; base.metalness = 0; if (mode === 'normal') base.color.set(0xffffff);
    }
    m.material.dispose(); m.material = base; m.material.needsUpdate = true;
  }
  _ensureUV2() { const g = this.lowMesh.geometry; if (!g.attributes.uv2 && g.attributes.uv) g.setAttribute('uv2', g.attributes.uv.clone()); }

  downloadMap(name) {
    const m = this.maps[name]; if (!m) return false;
    const a = document.createElement('a'); a.href = m.canvas.toDataURL('image/png'); a.download = (this.lowName || 'mesh') + '_' + name + '.png';
    document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 300); return true;
  }
  downloadAll() { let n = 0; for (const k in this.maps) { this.downloadMap(k); n++; } return n; }

  // ---------------------------------------------------------- VIEW
  setView(name) {
    const c = this.modelCenter, r = this.modelRadius, d = r * 2.4;
    this.controls.target.copy(c);
    const set = (x, y, z) => this.camera.position.set(x, y, z);
    if (name === 'front') set(c.x, c.y, c.z + d); else if (name === 'side') set(c.x + d, c.y, c.z);
    else if (name === 'back') set(c.x, c.y, c.z - d); else set(c.x + r * 0.6, c.y + r * 0.15, c.z + d);
    this.controls.update();
  }
  _frame() { const c = this.modelCenter, r = this.modelRadius; this.controls.target.copy(c); this.camera.position.set(c.x + r * 0.6, c.y + r * 0.15, c.z + r * 2.4); this.controls.update(); }
  stats() { return { low: this.lowName, high: this.highName, hasHigh: !!this.highMesh, maps: Object.keys(this.maps), lowTris: this._lowData ? this._lowData.pos.length / 9 : 0, highTris: this._highData ? this._highData.pos.length / 9 : 0, haveUV: this._lowData ? this._lowData.haveUV : false }; }
  resize() { const el = this.canvas.parentElement || this.canvas; const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  _loop() { if (!this._run) return; requestAnimationFrame(this._loop); this.controls.update(); this.renderer.render(this.scene, this.camera); }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

export default BMEngine;
