// ============================================================
// AUTORIG — HIGH-QUALITY SKINNING WORKER
// Voxel-geodesic ("bone glow") weights, GVB-lite.
//   1. Solid-voxelize the mesh (Y-ray parity, XZ triangle bins)
//   2. Per bone: multi-source Dijkstra geodesic distance through the
//      INTERIOR voxel graph (26-connectivity) — so weights flood through
//      the volume and never leak across to the opposite limb.
//   3. Per vertex: sample nearest interior voxel, take the 4 closest
//      bones (geodesically), convert distance → weight with a falloff.
// Runs off the main thread; posts {type:'progress'} and {type:'done'}.
// All geometry arrives pre-transformed into WORLD space.
// ============================================================
'use strict';

function post(o) { self.postMessage(o); }

self.onmessage = function (e) {
  const d = e.data;
  if (d.type !== 'bind') return;
  try {
    run(d);
  } catch (err) {
    post({ type: 'error', message: (err && err.message) || String(err) });
  }
};

function run(d) {
  const tris = d.tris;                 // Float32Array, 9 floats per triangle (world)
  const bones = d.bones;               // [{head:[x,y,z], tail:[x,y,z]}]
  const meshes = d.meshes;             // [{positions:Float32Array}] world-space verts
  const RES = d.res | 0;
  const falloff = d.falloff;           // 0..1 → exponent
  const B = bones.length;

  // ---------- 1. grid setup ----------
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < tris.length; i += 3) {
    const x = tris[i], y = tris[i + 1], z = tris[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const ext = [maxX - minX, maxY - minY, maxZ - minZ];
  const longest = Math.max(ext[0], ext[1], ext[2]) || 1;
  const vs = longest / RES;            // voxel size (uniform)
  const pad = vs * 1.5;
  minX -= pad; minY -= pad; minZ -= pad; maxX += pad; maxY += pad; maxZ += pad;
  const nx = Math.max(2, Math.ceil((maxX - minX) / vs));
  const ny = Math.max(2, Math.ceil((maxY - minY) / vs));
  const nz = Math.max(2, Math.ceil((maxZ - minZ) / vs));
  const nxny = nx * ny;
  const total = nx * ny * nz;
  const cx = i => minX + (i + 0.5) * vs;
  const cy = j => minY + (j + 0.5) * vs;
  const cz = k => minZ + (k + 0.5) * vs;

  // ---------- 2+3. solid voxelization by 3-axis parity VOTING ----------
  // Single-axis parity leaks on non-watertight meshes (separate wings, clothing,
  // open seams). Shooting rays along X, Y and Z and taking the majority vote is
  // far more robust: a voxel is "inside" if at least 2 of the 3 axes agree.
  const triCount = tris.length / 9;
  const votes = new Uint8Array(total);   // accumulate per-axis inside flags

  // axis: 0=X ray (plane Y,Z), 1=Y ray (plane X,Z), 2=Z ray (plane X,Y)
  function voxelizeAxis(axis) {
    const A = axis;                                  // ray axis
    const P = (A === 0) ? 1 : 0;                     // first plane axis
    const Q = (A === 2) ? 1 : 2;                     // second plane axis
    const nP = [nx, ny, nz][P], nQ = [nx, ny, nz][Q], nA = [nx, ny, nz][A];
    const minP = [minX, minY, minZ][P], minQ = [minX, minY, minZ][Q], minA = [minX, minY, minZ][A];
    const cP = i => minP + (i + 0.5) * vs, cQ = j => minQ + (j + 0.5) * vs, cA = k => minA + (k + 0.5) * vs;
    // bin triangles into (P,Q) columns
    const cols = new Array(nP * nQ);
    for (let t = 0; t < triCount; t++) {
      const o = t * 9;
      const p0 = tris[o + P], p1 = tris[o + 3 + P], p2 = tris[o + 6 + P];
      const q0 = tris[o + Q], q1 = tris[o + 3 + Q], q2 = tris[o + 6 + Q];
      let i0 = Math.floor((Math.min(p0, p1, p2) - minP) / vs), i1 = Math.floor((Math.max(p0, p1, p2) - minP) / vs);
      let k0 = Math.floor((Math.min(q0, q1, q2) - minQ) / vs), k1 = Math.floor((Math.max(q0, q1, q2) - minQ) / vs);
      if (i0 < 0) i0 = 0; if (k0 < 0) k0 = 0; if (i1 >= nP) i1 = nP - 1; if (k1 >= nQ) k1 = nQ - 1;
      for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) {
        const c = i + k * nP; (cols[c] || (cols[c] = [])).push(o);
      }
    }
    const hits = [];
    for (let kq = 0; kq < nQ; kq++) {
      for (let ip = 0; ip < nP; ip++) {
        const list = cols[ip + kq * nP]; if (!list || !list.length) continue;
        const pu = cP(ip), qv = cQ(kq);
        hits.length = 0;
        for (let n = 0; n < list.length; n++) { const h = rayAxis(pu, qv, tris, list[n], P, Q, A); if (h !== null) hits.push(h); }
        if (hits.length < 2) continue;
        hits.sort((a, b) => a - b);
        for (let ka = 0; ka < nA; ka++) {
          const a = cA(ka);
          let cnt = 0; for (let s = 0; s < hits.length; s++) { if (hits[s] <= a) cnt++; else break; }
          if (cnt & 1) {
            // map (ip,kq,ka) on (P,Q,A) back to (i,j,k) on (x,y,z)
            const coord = [0, 0, 0]; coord[P] = ip; coord[Q] = kq; coord[A] = ka;
            votes[coord[0] + coord[1] * nx + coord[2] * nxny]++;
          }
        }
      }
    }
  }

  votes.fill(0);
  voxelizeAxis(1); post({ type: 'progress', phase: 'voxelizing volume (Y)', frac: 0.10 });
  voxelizeAxis(0); post({ type: 'progress', phase: 'voxelizing volume (X)', frac: 0.18 });
  voxelizeAxis(2); post({ type: 'progress', phase: 'voxelizing volume (Z)', frac: 0.26 });

  const inside = new Uint8Array(total);
  for (let p = 0; p < total; p++) if (votes[p] >= 2) inside[p] = 1;

  // ---------- 4. compact interior voxels ----------
  const vid = new Int32Array(total).fill(-1);
  let insideCount = 0;
  for (let p = 0; p < total; p++) if (inside[p]) vid[p] = insideCount++;
  if (insideCount === 0) {
    // mesh too thin to voxelize at this res → signal fallback
    post({ type: 'fallback', message: 'Volume came out empty (mesh too thin for this resolution). Using fast weights.' });
    return;
  }
  // store voxel grid coords + world centers for interior set
  const vI = new Int16Array(insideCount), vJ = new Int16Array(insideCount), vK = new Int16Array(insideCount);
  const wx = new Float32Array(insideCount), wy = new Float32Array(insideCount), wz = new Float32Array(insideCount);
  {
    let q = 0;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const p = i + j * nx + k * nxny;
      if (!inside[p]) continue;
      vI[q] = i; vJ[q] = j; vK[q] = k;
      wx[q] = cx(i); wy[q] = cy(j); wz[q] = cz(k);
      q++;
    }
  }
  post({ type: 'progress', phase: 'interior: ' + insideCount + ' voxels', frac: 0.32 });

  // 26-neighbour offsets + distances
  const NB = [], NBD = [];
  for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy && !dz) continue;
    NB.push([dx, dy, dz]); NBD.push(Math.sqrt(dx * dx + dy * dy + dz * dz) * vs);
  }

  // ---------- 5. per-bone geodesic distance fields ----------
  const fields = [];     // Float32Array(insideCount) per bone (geodesic dist)
  let cappedCount = 0;
  const heap = new MinHeap(insideCount);
  const settled = new Uint8Array(insideCount);
  for (let b = 0; b < B; b++) {
    const dist = new Float32Array(insideCount).fill(Infinity);
    // seed: every interior voxel whose center is near the bone segment gets
    // an initial distance = euclidean dist to the segment (so the field
    // starts smooth along the whole bone, then floods through the volume).
    const h = bones[b].head, ta = bones[b].tail;
    const seedR = vs * 2.0;
    heap.clear();
    settled.fill(0);
    for (let q = 0; q < insideCount; q++) {
      const dseg = distPtSeg(wx[q], wy[q], wz[q], h[0], h[1], h[2], ta[0], ta[1], ta[2]);
      if (dseg <= seedR) { dist[q] = dseg; heap.push(q, dseg); }
    }
    if (heap.size === 0) {
      // segment outside the volume — seed nearest single voxel
      let best = -1, bd = Infinity;
      for (let q = 0; q < insideCount; q++) {
        const dseg = distPtSeg(wx[q], wy[q], wz[q], h[0], h[1], h[2], ta[0], ta[1], ta[2]);
        if (dseg < bd) { bd = dseg; best = q; }
      }
      if (best >= 0) { dist[best] = bd; heap.push(best, bd); }
    }
    // Dijkstra — each voxel finalized once (skip stale heap entries)
    let pops = 0; const maxPops = insideCount * 64 + 1000;
    let capped = false;
    while (heap.size) {
      const u = heap.pop();
      if (settled[u]) continue;
      settled[u] = 1;
      if (++pops > maxPops) { capped = true; break; }
      const du = dist[u];
      const ui = vI[u], uj = vJ[u], uk = vK[u];
      for (let n = 0; n < NB.length; n++) {
        const ni = ui + NB[n][0], nj = uj + NB[n][1], nk = uk + NB[n][2];
        if (ni < 0 || nj < 0 || nk < 0 || ni >= nx || nj >= ny || nk >= nz) continue;
        const np = ni + nj * nx + nk * nxny;
        const v = vid[np];
        if (v < 0 || settled[v]) continue;
        const nd = du + NBD[n];
        if (nd < dist[v]) { dist[v] = nd; heap.push(v, nd); }
      }
    }
    fields.push(dist);
    if (capped) cappedCount++;
    post({ type: 'progress', phase: 'geodesic flood ' + (b + 1) + '/' + B, frac: 0.34 + 0.46 * ((b + 1) / B) });
  }

  // ---------- 5.5 per-bone thickness (radius) estimate ---------- mean geodesic distance over the voxels each bone OWNS ≈ local muscle radius; normalizing by it makes weights volume-aware so a bulky muscle isn't crushed by skinnier neighbouring bones stealing its surface verts.
  const rad = new Float32Array(B);
  {
    const cnt = new Uint32Array(B);
    for (let q = 0; q < insideCount; q++) {
      let bb = -1, bd = Infinity;
      for (let b = 0; b < B; b++) { const dq = fields[b][q]; if (dq < bd) { bd = dq; bb = b; } }
      if (bb >= 0 && bd !== Infinity) { rad[bb] += bd; cnt[bb]++; }
    }
    let avg = 0, nn = 0;
    for (let b = 0; b < B; b++) { if (cnt[b] > 3) { rad[b] /= cnt[b]; avg += rad[b]; nn++; } else rad[b] = 0; }
    avg = nn ? avg / nn : vs * 2;
    for (let b = 0; b < B; b++) { if (!(rad[b] > vs * 0.5)) rad[b] = Math.max(vs, avg); }
  }
  post({ type: 'progress', phase: 'bone thickness map', frac: 0.79 });
  // ---------- 6. assign weights per vertex ----------
  const exponent = 1.8 + falloff * 3.6;     // 1.8 .. 5.4 — crisper joint definition
  const invVs = 1 / vs;
  const outMeshes = [];
  let totalV = 0; for (const m of meshes) totalV += m.positions.length / 3;
  let doneV = 0;

  for (let mi = 0; mi < meshes.length; mi++) {
    const pos = meshes[mi].positions;
    const n = pos.length / 3;
    const skinIndex = new Uint16Array(n * 4);
    const skinWeight = new Float32Array(n * 4);

    for (let v = 0; v < n; v++) {
      const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
      // nearest interior voxel: snap to grid, search small neighbourhood
      const q = nearestInterior(x, y, z);
      // gather bone distances at that voxel
      // find smallest 4
      let i0 = -1, i1 = -1, i2 = -1, i3 = -1;
      let d0 = Infinity, d1 = Infinity, d2 = Infinity, d3 = Infinity;
      for (let b = 0; b < B; b++) {
        let db = fields[b][q] / rad[b];   // radius-normalized: thick muscle → wide influence
        if (db === Infinity) continue;
        if (db < d0) { d3 = d2; i3 = i2; d2 = d1; i2 = i1; d1 = d0; i1 = i0; d0 = db; i0 = b; }
        else if (db < d1) { d3 = d2; i3 = i2; d2 = d1; i2 = i1; d1 = db; i1 = b; }
        else if (db < d2) { d3 = d2; i3 = i2; d2 = db; i2 = b; }
        else if (db < d3) { d3 = db; i3 = b; }
      }
      if (i0 < 0) {
        // unreachable voxel (shouldn't happen) → fall back to euclidean nearest bone
        i0 = euclidNearestBone(x, y, z); d0 = 1;
      }
      // weights: (1/d)^p, normalized
      const idx = [i0, i1, i2, i3], dd = [d0, d1, d2, d3];
      let wsum = 0; const w = [0, 0, 0, 0];
      const dmin = d0;
      for (let s = 0; s < 4; s++) {
        if (idx[s] < 0 || dd[s] === Infinity) continue;
        // relative to nearest so the closest bone dominates cleanly
        const rel = (dd[s] + 0.15) / (dmin + 0.15);   // distances are in "radii" units now
        const ww = Math.pow(1 / rel, exponent);
        w[s] = ww; wsum += ww;
      }
      if (wsum <= 0) { w[0] = 1; wsum = 1; idx[0] = Math.max(0, i0); }
      for (let s = 0; s < 4; s++) {
        skinIndex[v * 4 + s] = idx[s] < 0 ? 0 : idx[s];
        skinWeight[v * 4 + s] = w[s] / wsum;
      }
      doneV++;
      if ((doneV & 4095) === 0) post({ type: 'progress', phase: 'painting weights', frac: 0.8 + 0.2 * (doneV / totalV) });
    }
    outMeshes.push({ skinIndex, skinWeight });
  }

  post({ type: 'done', meshes: outMeshes, diag: { insideCount, cappedBones: cappedCount, nx, ny, nz } }, outMeshes.flatMap(m => [m.skinIndex.buffer, m.skinWeight.buffer]));

  // ---- helpers bound to grid ----
  function nearestInterior(x, y, z) {
    let i = Math.floor((x - minX) * invVs);
    let j = Math.floor((y - minY) * invVs);
    let k = Math.floor((z - minZ) * invVs);
    if (i < 0) i = 0; if (j < 0) j = 0; if (k < 0) k = 0;
    if (i >= nx) i = nx - 1; if (j >= ny) j = ny - 1; if (k >= nz) k = nz - 1;
    const direct = vid[i + j * nx + k * nxny];
    if (direct >= 0) return direct;
    // spiral out
    for (let r = 1; r <= 6; r++) {
      let best = -1, bd = Infinity;
      for (let dk = -r; dk <= r; dk++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj), Math.abs(dk)) !== r) continue;
        const ni = i + di, nj = j + dj, nk = k + dk;
        if (ni < 0 || nj < 0 || nk < 0 || ni >= nx || nj >= ny || nk >= nz) continue;
        const q = vid[ni + nj * nx + nk * nxny];
        if (q < 0) continue;
        const ddx = cx(ni) - x, ddy = cy(nj) - y, ddz = cz(nk) - z;
        const d = ddx * ddx + ddy * ddy + ddz * ddz;
        if (d < bd) { bd = d; best = q; }
      }
      if (best >= 0) return best;
    }
    return 0;
  }
  function euclidNearestBone(x, y, z) {
    let best = 0, bd = Infinity;
    for (let b = 0; b < B; b++) {
      const h = bones[b].head, ta = bones[b].tail;
      const d = distPtSeg(x, y, z, h[0], h[1], h[2], ta[0], ta[1], ta[2]);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
}

// Ray along axis A through column at plane coords (pu, qv) on axes (P, Q).
// Returns the A-coordinate where the ray crosses the triangle at offset o, or null.
function rayAxis(pu, qv, T, o, P, Q, A) {
  const a_p = T[o + P], a_q = T[o + Q], a_a = T[o + A];
  const b_p = T[o + 3 + P], b_q = T[o + 3 + Q], b_a = T[o + 3 + A];
  const c_p = T[o + 6 + P], c_q = T[o + 6 + Q], c_a = T[o + 6 + A];
  const v0p = c_p - a_p, v0q = c_q - a_q;
  const v1p = b_p - a_p, v1q = b_q - a_q;
  const v2p = pu - a_p, v2q = qv - a_q;
  const dot00 = v0p * v0p + v0q * v0q;
  const dot01 = v0p * v1p + v0q * v1q;
  const dot02 = v0p * v2p + v0q * v2q;
  const dot11 = v1p * v1p + v1q * v1q;
  const dot12 = v1p * v2p + v1q * v2q;
  const den = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(den) < 1e-12) return null;
  const inv = 1 / den;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const w = (dot00 * dot12 - dot01 * dot02) * inv;
  if (u < 0 || w < 0 || u + w > 1) return null;
  return a_a + u * (c_a - a_a) + w * (b_a - a_a);
}

function distPtSeg(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  let t = (apx * abx + apy * aby + apz * abz) / (abx * abx + aby * aby + abz * abz || 1e-9);
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// binary min-heap keyed by float distance, payload = voxel index.
// Grows on demand (Dijkstra re-pushes relaxed nodes → can exceed node count).
function MinHeap(cap) {
  let idx = new Int32Array(Math.max(16, cap + 1));
  let key = new Float32Array(Math.max(16, cap + 1));
  this.size = 0;
  this.clear = function () { this.size = 0; };
  function grow() {
    const ni = new Int32Array(idx.length * 2); ni.set(idx); idx = ni;
    const nk = new Float32Array(key.length * 2); nk.set(key); key = nk;
  }
  this.push = function (i, k) {
    let n = ++this.size;
    if (n >= idx.length) grow();
    idx[n] = i; key[n] = k;
    while (n > 1) { const p = n >> 1; if (key[p] <= key[n]) break; swap(p, n); n = p; }
  };
  this.pop = function () {
    const top = idx[1];
    const n = this.size--;
    idx[1] = idx[n]; key[1] = key[n];
    let i = 1;
    while (true) {
      let l = i << 1, r = l + 1, s = i;
      if (l <= this.size && key[l] < key[s]) s = l;
      if (r <= this.size && key[r] < key[s]) s = r;
      if (s === i) break; swap(i, s); i = s;
    }
    return top;
  };
  function swap(a, b) { const ti = idx[a]; idx[a] = idx[b]; idx[b] = ti; const tk = key[a]; key[a] = key[b]; key[b] = tk; }
}
