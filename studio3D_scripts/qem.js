// ============================================================
// qem.js — QUADRIC ERROR-METRIC DECIMATION  (Garland–Heckbert, pure JS)
//
// Collapses a triangle mesh down to a target triangle count while
// preserving its silhouette: every vertex carries a 4×4 error quadric
// (the summed squared distance to the planes of its faces), each edge is
// scored by the error of contracting it to its optimal position, and the
// cheapest edge is collapsed over and over from a lazy-deleted min-heap.
//
// decimateMesh(positions, target, opts) ->
//   { position:Float32Array, normal:Float32Array, stats:{...} } | null
//   positions : non-indexed triangle verts (length = 9 * triCount)
//   target    : 0<r<1 => keep that fraction of triangles; >=1 => that many tris
//   opts.onStatus(msg), opts.preserveBorder (default true)
//   opts.uv   : optional non-indexed UVs (length = 6 * triCount). When given,
//               verts weld by position+uv (seams preserved), UVs are lerped on
//               each edge collapse, and the result carries a uv Float32Array so
//               textures survive decimation.
// ============================================================

function det3(a, b, c, d, e, f, g, h, i) {
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p].cost <= a[i].cost) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } }
  pop() { const a = this.a; const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0, n = a.length; for (;;) { let l = i * 2 + 1, r = l + 1, s = i; if (l < n && a[l].cost < a[s].cost) s = l; if (r < n && a[r].cost < a[s].cost) s = r; if (s === i) break; [a[s], a[i]] = [a[i], a[s]]; i = s; } } return top; }
}

export async function decimateMesh(positions, target, opts) {
  opts = opts || {};
  const status = opts.onStatus || function () {};
  const job = opts.job || null;   // JobController → cooperative cancel + yield
  const onProgress = opts.onProgress || null;
  const inTris = (positions.length / 9) | 0;
  if (inTris < 4) return null;
  const targetTris = target < 1 ? Math.max(4, Math.round(inTris * target)) : Math.max(4, Math.round(target));
  if (targetTris >= inTris) {
    // nothing to do — return a copy with smooth normals
    return _emit(_weld(positions, opts.uv), null, inTris, inTris);
  }

  status('Welding ' + inTris.toLocaleString() + ' tris…');
  const W = _weld(positions, opts.uv);
  const VX = W.VX, VY = W.VY, VZ = W.VZ;
  const UVU = W.UVU, UVV = W.UVV, hasUV = W.hasUV;
  let nv = W.nv;
  const fA = W.fA, fB = W.fB, fC = W.fC;
  let nf = W.nf;
  const alive = new Uint8Array(nf).fill(1);
  const removed = new Uint8Array(nv);

  // ---- per-vertex quadrics (10 floats: xx xy xz xw yy yz yw zz zw ww) ----
  status('Building quadrics…');
  const Q = new Float64Array(nv * 10);
  const addPlane = (v, a, b, c, d, w) => {
    const o = v * 10;
    Q[o] += a * a * w; Q[o + 1] += a * b * w; Q[o + 2] += a * c * w; Q[o + 3] += a * d * w;
    Q[o + 4] += b * b * w; Q[o + 5] += b * c * w; Q[o + 6] += b * d * w;
    Q[o + 7] += c * c * w; Q[o + 8] += c * d * w; Q[o + 9] += d * d * w;
  };
  const vfaces = Array.from({ length: nv }, () => new Set());
  const facePlane = (f) => {
    const a = fA[f], b = fB[f], c = fC[f];
    const ux = VX[b] - VX[a], uy = VY[b] - VY[a], uz = VZ[b] - VZ[a];
    const vx = VX[c] - VX[a], vy = VY[c] - VY[a], vz = VZ[c] - VZ[a];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    const area = len * 0.5;
    if (len > 1e-20) { nx /= len; ny /= len; nz /= len; }
    const d = -(nx * VX[a] + ny * VY[a] + nz * VZ[a]);
    return { nx, ny, nz, d, area };
  };
  for (let f = 0; f < nf; f++) {
    const p = facePlane(f);
    const w = p.area || 1e-6;
    addPlane(fA[f], p.nx, p.ny, p.nz, p.d, w);
    addPlane(fB[f], p.nx, p.ny, p.nz, p.d, w);
    addPlane(fC[f], p.nx, p.ny, p.nz, p.d, w);
    vfaces[fA[f]].add(f); vfaces[fB[f]].add(f); vfaces[fC[f]].add(f);
  }

  const qErr = (o, x, y, z) =>
    Q[o] * x * x + 2 * Q[o + 1] * x * y + 2 * Q[o + 2] * x * z + 2 * Q[o + 3] * x +
    Q[o + 4] * y * y + 2 * Q[o + 5] * y * z + 2 * Q[o + 6] * y +
    Q[o + 7] * z * z + 2 * Q[o + 8] * z + Q[o + 9];

  // optimal contraction point for the merged quadric of i & j (sum stored in tmp)
  const T = new Float64Array(10);
  const best = { x: 0, y: 0, z: 0, cost: 0 };
  function optimal(i, j) {
    const oi = i * 10, oj = j * 10;
    for (let k = 0; k < 10; k++) T[k] = Q[oi + k] + Q[oj + k];
    const a = T[0], b = T[1], c = T[2], e = T[4], f = T[5], g = T[7];
    const D = det3(a, b, c, b, e, f, c, f, g);
    const qe = (x, y, z) => T[0] * x * x + 2 * T[1] * x * y + 2 * T[2] * x * z + 2 * T[3] * x + T[4] * y * y + 2 * T[5] * y * z + 2 * T[6] * y + T[7] * z * z + 2 * T[8] * z + T[9];
    if (Math.abs(D) > 1e-12) {
      const bx = -T[3], by = -T[6], bz = -T[8];
      const iD = 1 / D;
      const x = det3(bx, b, c, by, e, f, bz, f, g) * iD;
      const y = det3(a, bx, c, b, by, f, c, bz, g) * iD;
      const z = det3(a, b, bx, b, e, by, c, f, bz) * iD;
      best.x = x; best.y = y; best.z = z; best.cost = Math.max(0, qe(x, y, z)); return best;
    }
    // singular -> try endpoints + midpoint
    const cand = [[VX[i], VY[i], VZ[i]], [VX[j], VY[j], VZ[j]], [(VX[i] + VX[j]) / 2, (VY[i] + VY[j]) / 2, (VZ[i] + VZ[j]) / 2]];
    let bc = Infinity;
    for (const [x, y, z] of cand) { const c2 = qe(x, y, z); if (c2 < bc) { bc = c2; best.x = x; best.y = y; best.z = z; } }
    best.cost = Math.max(0, bc); return best;
  }

  // ---- pair (edge) heap with lazy versioning ----
  status('Scoring edges…');
  const ekey = (i, j) => (i < j ? i * nv + j : j * nv + i);
  const ver = new Map();
  const heap = new MinHeap();
  const pushPair = (i, j) => {
    if (i === j || removed[i] || removed[j]) return;
    const r = optimal(i, j);
    const k = ekey(i, j);
    const v = (ver.get(k) || 0) + 1; ver.set(k, v);
    heap.push({ i, j, x: r.x, y: r.y, z: r.z, cost: r.cost, k, v });
  };
  const neigh = new Set();
  const neighborsOf = (i, out) => {
    out.clear();
    for (const f of vfaces[i]) { if (!alive[f]) continue; const a = fA[f], b = fB[f], c = fC[f]; if (a !== i) out.add(a); if (b !== i) out.add(b); if (c !== i) out.add(c); }
  };
  for (let f = 0; f < nf; f++) { pushPair(fA[f], fB[f]); pushPair(fB[f], fC[f]); pushPair(fC[f], fA[f]); }

  // flip guard: would moving i (and merging j into it) invert any incident face?
  function causesFlip(i, j, nx, ny, nz) {
    for (const f of vfaces[i]) {
      if (!alive[f]) continue;
      let a = fA[f], b = fB[f], c = fC[f];
      if ((a === i && (b === j || c === j)) || (b === i && (a === j || c === j)) || (c === i && (a === j || b === j))) continue; // becomes degenerate, removed
      const ax = a === i ? nx : VX[a], ay = a === i ? ny : VY[a], az = a === i ? nz : VZ[a];
      const bx = b === i ? nx : VX[b], by = b === i ? ny : VY[b], bz = b === i ? nz : VZ[b];
      const cx = c === i ? nx : VX[c], cy = c === i ? ny : VY[c], cz = c === i ? nz : VZ[c];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      const n1x = uy * vz - uz * vy, n1y = uz * vx - ux * vz, n1z = ux * vy - uy * vx;
      const o0x = VX[b] - VX[a], o0y = VY[b] - VY[a], o0z = VZ[b] - VZ[a], p0x = VX[c] - VX[a], p0y = VY[c] - VY[a], p0z = VZ[c] - VZ[a];
      const m0x = o0y * p0z - o0z * p0y, m0y = o0z * p0x - o0x * p0z, m0z = o0x * p0y - o0y * p0x;
      if (n1x * m0x + n1y * m0y + n1z * m0z < 0) return true;
    }
    return false;
  }

  // ---- collapse loop ----
  status('Collapsing…');
  let faceCount = nf;
  const tmpN = new Set();
  while (faceCount > targetTris && heap.size) {
    const e = heap.pop();
    if (ver.get(e.k) !== e.v) continue;                 // stale
    let { i, j } = e;
    if (removed[i] || removed[j]) continue;
    // need them to still share at least one alive face (manifold edge)
    let shared = 0; for (const f of vfaces[i]) { if (alive[f] && (fA[f] === j || fB[f] === j || fC[f] === j)) shared++; }
    if (!shared) continue;
    if (causesFlip(i, j, e.x, e.y, e.z) || causesFlip(j, i, e.x, e.y, e.z)) continue;

    // lerp UV toward the optimal point along the collapsed edge (before we
    // overwrite vertex i's position)
    if (hasUV) {
      const dijx = VX[j] - VX[i], dijy = VY[j] - VY[i], dijz = VZ[j] - VZ[i];
      const dij = Math.hypot(dijx, dijy, dijz);
      let t = dij > 1e-12 ? Math.hypot(e.x - VX[i], e.y - VY[i], e.z - VZ[i]) / dij : 0;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      UVU[i] = UVU[i] * (1 - t) + UVU[j] * t;
      UVV[i] = UVV[i] * (1 - t) + UVV[j] * t;
    }
    // move i to optimal, fold j's quadric in
    VX[i] = e.x; VY[i] = e.y; VZ[i] = e.z;
    const oi = i * 10, oj = j * 10; for (let k = 0; k < 10; k++) Q[oi + k] += Q[oj + k];

    // retarget j's faces to i; kill degenerate ones
    for (const f of vfaces[j]) {
      if (!alive[f]) continue;
      if (fA[f] === j) fA[f] = i; if (fB[f] === j) fB[f] = i; if (fC[f] === j) fC[f] = i;
      const a = fA[f], b = fB[f], c = fC[f];
      if (a === b || b === c || c === a) { alive[f] = 0; faceCount--; }
      else vfaces[i].add(f);
    }
    removed[j] = 1; vfaces[j] = null;

    // recompute pairs around i
    neighborsOf(i, tmpN);
    for (const k of tmpN) pushPair(i, k);
    if ((faceCount & 8191) === 0) {
      status('Collapsing… ' + faceCount.toLocaleString() + ' tris');
      if (onProgress) onProgress((nf - faceCount) / Math.max(1, nf - targetTris));
      // Yield to the event loop so a Cancel click can be processed, then
      // checkpoint. job.tick() throws JobCancelled when cancelled.
      if (job) await job.tick();
    }
  }

  // ---- compact survivors ----
  status('Finalizing…');
  const remap = new Int32Array(nv).fill(-1);
  let outNv = 0;
  for (let v = 0; v < nv; v++) if (!removed[v]) remap[v] = outNv++;
  const outFaces = [];
  for (let f = 0; f < nf; f++) {
    if (!alive[f]) continue;
    const a = remap[fA[f]], b = remap[fB[f]], c = remap[fC[f]];
    if (a < 0 || b < 0 || c < 0 || a === b || b === c || c === a) continue;
    outFaces.push(a, b, c);
  }
  const oVX = new Float64Array(outNv), oVY = new Float64Array(outNv), oVZ = new Float64Array(outNv);
  const oUVU = hasUV ? new Float64Array(outNv) : null, oUVV = hasUV ? new Float64Array(outNv) : null;
  for (let v = 0; v < nv; v++) if (remap[v] >= 0) { const r = remap[v]; oVX[r] = VX[v]; oVY[r] = VY[v]; oVZ[r] = VZ[v]; if (hasUV) { oUVU[r] = UVU[v]; oUVV[r] = UVV[v]; } }
  return _emit({ VX: oVX, VY: oVY, VZ: oVZ, UVU: oUVU, UVV: oUVV, hasUV, nv: outNv, faces: outFaces }, null, inTris, outFaces.length / 3);
}

// weld non-indexed positions into unique verts + face index list
function _weld(positions, uvs) {
  const n = positions.length / 3;
  const q = 1e5, qUV = 1e4;
  const hasUV = !!uvs;
  const map = new Map();
  const VX = [], VY = [], VZ = [], UVU = [], UVV = [];
  const corner = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    let uu = 0, vv = 0;
    if (hasUV) { uu = uvs[i * 2]; vv = uvs[i * 2 + 1]; }
    let k = Math.round(x * q) + '_' + Math.round(y * q) + '_' + Math.round(z * q);
    if (hasUV) k += '_' + Math.round(uu * qUV) + '_' + Math.round(vv * qUV);   // seam-aware
    let id = map.get(k);
    if (id == null) { id = VX.length; VX.push(x); VY.push(y); VZ.push(z); if (hasUV) { UVU.push(uu); UVV.push(vv); } map.set(k, id); }
    corner[i] = id;
  }
  const nf = n / 3;
  const fA = new Int32Array(nf), fB = new Int32Array(nf), fC = new Int32Array(nf);
  for (let f = 0; f < nf; f++) { fA[f] = corner[f * 3]; fB[f] = corner[f * 3 + 1]; fC[f] = corner[f * 3 + 2]; }
  return { VX: Float64Array.from(VX), VY: Float64Array.from(VY), VZ: Float64Array.from(VZ), UVU: hasUV ? Float64Array.from(UVU) : null, UVV: hasUV ? Float64Array.from(UVV) : null, hasUV, nv: VX.length, fA, fB, fC, nf };
}

// build non-indexed position+smooth-normal output from a welded survivor set
function _emit(W, _u, inTris, outTris) {
  let faces = W.faces;
  if (!faces) { faces = []; for (let f = 0; f < W.nf; f++) faces.push(W.fA[f], W.fB[f], W.fC[f]); }
  const VX = W.VX, VY = W.VY, VZ = W.VZ, nv = W.nv;
  const N = new Float64Array(nv * 3);
  for (let i = 0; i < faces.length; i += 3) {
    const a = faces[i], b = faces[i + 1], c = faces[i + 2];
    const ux = VX[b] - VX[a], uy = VY[b] - VY[a], uz = VZ[b] - VZ[a];
    const vx = VX[c] - VX[a], vy = VY[c] - VY[a], vz = VZ[c] - VZ[a];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    N[a * 3] += nx; N[a * 3 + 1] += ny; N[a * 3 + 2] += nz;
    N[b * 3] += nx; N[b * 3 + 1] += ny; N[b * 3 + 2] += nz;
    N[c * 3] += nx; N[c * 3 + 1] += ny; N[c * 3 + 2] += nz;
  }
  for (let v = 0; v < nv; v++) { const o = v * 3; const l = Math.hypot(N[o], N[o + 1], N[o + 2]) || 1; N[o] /= l; N[o + 1] /= l; N[o + 2] /= l; }
  const nTri = faces.length / 3;
  const position = new Float32Array(nTri * 9), normal = new Float32Array(nTri * 9);
  const hasUV = W.hasUV && W.UVU;
  const uv = hasUV ? new Float32Array(nTri * 6) : null;
  for (let i = 0; i < faces.length; i++) {
    const v = faces[i], o = i * 3;
    position[o] = VX[v]; position[o + 1] = VY[v]; position[o + 2] = VZ[v];
    normal[o] = N[v * 3]; normal[o + 1] = N[v * 3 + 1]; normal[o + 2] = N[v * 3 + 2];
    if (hasUV) { uv[i * 2] = W.UVU[v]; uv[i * 2 + 1] = W.UVV[v]; }
  }
  return { position, normal, uv, stats: { inTris, outTris: nTri, verts: nv } };
}

if (typeof window !== 'undefined') window.decimateMesh = decimateMesh;
export default decimateMesh;
