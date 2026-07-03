// ============================================================
// remesh.js — VOXEL REMESHER  (DynaMesh-style, pure JS, no deps)
//
// Turns an arbitrary triangle soup (multiple shells, holes, self-
// intersections, the welded merge of cut-up pieces…) into ONE clean,
// watertight, evenly-tessellated surface — entirely in the browser.
//
// Pipeline:
//   1. rasterize every triangle into a narrow band of a 3D grid and
//      record the unsigned distance to the nearest triangle (point–tri).
//   2. flood-fill "outside" from the grid boundary; cells the flood
//      can't reach (blocked by the surface band) are "inside". This is
//      what fuses nearby shells and seals gaps up to one voxel.
//   3. build a signed-distance field  f = ±min(dist, band).
//   4. extract the f = 0 iso-surface with naive Surface Nets (a dual
//      method → smooth, manifold quads, no 256-case table).
//   5. Taubin-smooth the result so the voxel stair-steps melt away.
//
// voxelRemesh(positions, opts) -> { position:Float32Array,
//   normal:Float32Array, stats:{grid,tris,verts} } | null
//   positions : non-indexed triangle verts (length = 9 * triCount)
//   opts.res  : voxels along the longest axis (default 96)
//   opts.smooth : Taubin passes (default 3)
//   opts.onStatus : progress callback(msg)
// ============================================================

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// squared distance from point p to triangle (a,b,c)
function distPointTri2(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const acx = cx - ax, acy = cy - ay, acz = cz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return apx * apx + apy * apy + apz * apz;
  const bpx = px - bx, bpy = py - by, bpz = pz - bz;
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return bpx * bpx + bpy * bpy + bpz * bpz;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    const ex = apx - v * abx, ey = apy - v * aby, ez = apz - v * abz;
    return ex * ex + ey * ey + ez * ez;
  }
  const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
  const d5 = abx * cpx + aby * cpy + abz * cpz;
  const d6 = acx * cpx + acy * cpy + acz * cpz;
  if (d6 >= 0 && d5 <= d6) return cpx * cpx + cpy * cpy + cpz * cpz;
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    const w = d2 / (d2 - d6);
    const ex = apx - w * acx, ey = apy - w * acy, ez = apz - w * acz;
    return ex * ex + ey * ey + ez * ez;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
    const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
    const ex = bpx + w * (cx - bx), ey = bpy + w * (cy - by), ez = bpz + w * (cz - bz);
    return ex * ex + ey * ey + ez * ez;
  }
  const denom = 1 / (va + vb + vc);
  const v = vb * denom, w = vc * denom;
  const ex = apx - (v * abx + w * acx), ey = apy - (v * aby + w * acy), ez = apz - (v * abz + w * acz);
  return ex * ex + ey * ey + ez * ez;
}

export function voxelRemesh(positions, opts) {
  opts = opts || {};
  const res = clamp(opts.res | 0 || 96, 16, 256);
  const smoothPasses = opts.smooth == null ? 3 : (opts.smooth | 0);
  const status = opts.onStatus || function () {};
  const triCount = (positions.length / 9) | 0;
  if (triCount < 1) return null;

  // ---- bounds ----
  let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minx) minx = x; if (y < miny) miny = y; if (z < minz) minz = z;
    if (x > maxx) maxx = x; if (y > maxy) maxy = y; if (z > maxz) maxz = z;
  }
  const ex = maxx - minx, ey = maxy - miny, ez = maxz - minz;
  const longest = Math.max(ex, ey, ez) || 1;
  const cell = longest / res;
  const pad = 3;                                   // cells of air around the model
  // sample-grid dimensions (sample points, not cells)
  const nx = Math.max(4, Math.ceil(ex / cell) + 1 + pad * 2);
  const ny = Math.max(4, Math.ceil(ey / cell) + 1 + pad * 2);
  const nz = Math.max(4, Math.ceil(ez / cell) + 1 + pad * 2);
  const ox = minx - pad * cell, oy = miny - pad * cell, oz = minz - pad * cell;
  const nyz = ny * nz;
  const total = nx * nyz;
  if (total > 26000000) return { tooBig: true, grid: [nx, ny, nz] };

  const idx = (x, y, z) => x * nyz + y * nz + z;
  const sx = i => ox + i * cell;                   // sample world coords
  const sy = i => oy + i * cell;
  const sz = i => oz + i * cell;

  // ---- 1+3. unsigned distance in a narrow band ----
  status('Voxelizing ' + triCount.toLocaleString() + ' tris…');
  const BIG = 1e9;
  const dist = new Float32Array(total).fill(BIG);
  const band = 2.2 * cell;
  const bandCells = Math.ceil(band / cell) + 1;
  for (let t = 0; t < triCount; t++) {
    const o = t * 9;
    const ax = positions[o], ay = positions[o + 1], az = positions[o + 2];
    const bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5];
    const cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8];
    let lx = Math.min(ax, bx, cx), ly = Math.min(ay, by, cy), lz = Math.min(az, bz, cz);
    let hx = Math.max(ax, bx, cx), hy = Math.max(ay, by, cy), hz = Math.max(az, bz, cz);
    let i0 = Math.floor((lx - ox) / cell) - bandCells, i1 = Math.ceil((hx - ox) / cell) + bandCells;
    let j0 = Math.floor((ly - oy) / cell) - bandCells, j1 = Math.ceil((hy - oy) / cell) + bandCells;
    let k0 = Math.floor((lz - oz) / cell) - bandCells, k1 = Math.ceil((hz - oz) / cell) + bandCells;
    i0 = clamp(i0, 0, nx - 1); i1 = clamp(i1, 0, nx - 1);
    j0 = clamp(j0, 0, ny - 1); j1 = clamp(j1, 0, ny - 1);
    k0 = clamp(k0, 0, nz - 1); k1 = clamp(k1, 0, nz - 1);
    for (let i = i0; i <= i1; i++) {
      const px = sx(i);
      for (let j = j0; j <= j1; j++) {
        const py = sy(j);
        let base = i * nyz + j * nz;
        for (let k = k0; k <= k1; k++) {
          const pz = sz(k);
          const d2 = distPointTri2(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz);
          if (d2 < dist[base + k] * dist[base + k]) {
            const d = Math.sqrt(d2);
            if (d < dist[base + k]) dist[base + k] = d;
          }
        }
      }
    }
  }

  // ---- 2. flood-fill outside (walls = samples within ~0.6 cell of surface) ----
  status('Sealing & flood-filling…');
  const wallT = 0.6 * cell;
  const state = new Uint8Array(total);             // 0 unknown, 1 outside, 2 wall
  for (let s = 0; s < total; s++) if (dist[s] < wallT) state[s] = 2;
  const stack = [];
  const pushIf = s => { if (state[s] === 0) { state[s] = 1; stack.push(s); } };
  // seed from all 6 faces of the grid
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { pushIf(idx(i, j, 0)); pushIf(idx(i, j, nz - 1)); }
  for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) { pushIf(idx(i, 0, k)); pushIf(idx(i, ny - 1, k)); }
  for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) { pushIf(idx(0, j, k)); pushIf(idx(nx - 1, j, k)); }
  while (stack.length) {
    const s = stack.pop();
    const z = s % nz, y = ((s / nz) | 0) % ny, x = (s / nyz) | 0;
    if (x > 0) pushIf(s - nyz); if (x < nx - 1) pushIf(s + nyz);
    if (y > 0) pushIf(s - nz); if (y < ny - 1) pushIf(s + nz);
    if (z > 0) pushIf(s - 1); if (z < nz - 1) pushIf(s + 1);
  }
  // signed field: outside negative, inside positive, magnitude = capped distance
  const field = new Float32Array(total);
  for (let s = 0; s < total; s++) {
    const d = dist[s] > band ? band : dist[s];
    field[s] = (state[s] === 1) ? -d : d;          // unknown (enclosed) + wall -> inside(+)
  }

  // ---- 4. Surface Nets (dual contour, iso = 0) ----
  status('Extracting iso-surface…');
  const cnx = nx - 1, cny = ny - 1, cnz = nz - 1;
  const cellVert = new Int32Array(cnx * cny * cnz).fill(-1);
  const cIdx = (x, y, z) => (x * cny + y) * cnz + z;
  const verts = [];                                // flat x,y,z
  // 12 cube edges as corner-index pairs; corner c = (cx,cy,cz) bits
  const CORN = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const EDGES = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
  const g = new Float32Array(8);
  for (let x = 0; x < cnx; x++) for (let y = 0; y < cny; y++) for (let z = 0; z < cnz; z++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = field[idx(x + CORN[c][0], y + CORN[c][1], z + CORN[c][2])];
      g[c] = v; if (v < 0) mask |= (1 << c);
    }
    if (mask === 0 || mask === 0xff) continue;     // no crossing
    let vxl = 0, vyl = 0, vzl = 0, cnt = 0;
    for (let e = 0; e < 12; e++) {
      const a = EDGES[e][0], b = EDGES[e][1];
      const ga = g[a], gb = g[b];
      if ((ga < 0) === (gb < 0)) continue;
      const t = ga / (ga - gb);                    // iso = 0
      vxl += (CORN[a][0] + t * (CORN[b][0] - CORN[a][0]));
      vyl += (CORN[a][1] + t * (CORN[b][1] - CORN[a][1]));
      vzl += (CORN[a][2] + t * (CORN[b][2] - CORN[a][2]));
      cnt++;
    }
    const vid = verts.length / 3;
    verts.push(ox + (x + vxl / cnt) * cell, oy + (y + vyl / cnt) * cell, oz + (z + vzl / cnt) * cell);
    cellVert[cIdx(x, y, z)] = vid;
  }
  if (!verts.length) return null;

  // quads dual to sign-changing sample edges; 4 incident cells per edge
  const tris = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { tris.push(a, b, c, a, c, d); }
    else { tris.push(a, d, c, a, c, b); }
  };
  for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) {
    const f0 = field[idx(x, y, z)];
    // +x edge -> cells vary in y,z (need y>=1,z>=1)
    if (x < nx - 1 && y >= 1 && z >= 1) {
      const f1 = field[idx(x + 1, y, z)];
      if ((f0 < 0) !== (f1 < 0)) {
        quad(cellVert[cIdx(x, y - 1, z - 1)], cellVert[cIdx(x, y, z - 1)], cellVert[cIdx(x, y, z)], cellVert[cIdx(x, y - 1, z)], f0 < 0);
      }
    }
    // +y edge -> cells vary in x,z
    if (y < ny - 1 && x >= 1 && z >= 1) {
      const f1 = field[idx(x, y + 1, z)];
      if ((f0 < 0) !== (f1 < 0)) {
        quad(cellVert[cIdx(x - 1, y, z - 1)], cellVert[cIdx(x, y, z - 1)], cellVert[cIdx(x, y, z)], cellVert[cIdx(x - 1, y, z)], f0 >= 0);
      }
    }
    // +z edge -> cells vary in x,y
    if (z < nz - 1 && x >= 1 && y >= 1) {
      const f1 = field[idx(x, y, z + 1)];
      if ((f0 < 0) !== (f1 < 0)) {
        quad(cellVert[cIdx(x - 1, y - 1, z)], cellVert[cIdx(x, y - 1, z)], cellVert[cIdx(x, y, z)], cellVert[cIdx(x - 1, y, z)], f0 < 0);
      }
    }
  }
  if (!tris.length) return null;

  // ---- 5. Taubin smoothing (λ|μ) on the welded verts ----
  const nVerts = verts.length / 3;
  const P = Float32Array.from(verts);
  if (smoothPasses > 0) {
    status('Smoothing…');
    // build vertex adjacency from triangles
    const nbset = Array.from({ length: nVerts }, () => new Set());
    for (let i = 0; i < tris.length; i += 3) {
      const a = tris[i], b = tris[i + 1], c = tris[i + 2];
      nbset[a].add(b); nbset[a].add(c); nbset[b].add(a); nbset[b].add(c); nbset[c].add(a); nbset[c].add(b);
    }
    const adj = nbset.map(s => Int32Array.from(s));
    const tmp = new Float32Array(P.length);
    const step = (lambda) => {
      for (let v = 0; v < nVerts; v++) {
        const nb = adj[v], k = nb.length; const o = v * 3;
        if (!k) { tmp[o] = P[o]; tmp[o + 1] = P[o + 1]; tmp[o + 2] = P[o + 2]; continue; }
        let axx = 0, ayy = 0, azz = 0;
        for (let m = 0; m < k; m++) { const p = nb[m] * 3; axx += P[p]; ayy += P[p + 1]; azz += P[p + 2]; }
        axx /= k; ayy /= k; azz /= k;
        tmp[o] = P[o] + lambda * (axx - P[o]);
        tmp[o + 1] = P[o + 1] + lambda * (ayy - P[o + 1]);
        tmp[o + 2] = P[o + 2] + lambda * (azz - P[o + 2]);
      }
      P.set(tmp);
    };
    for (let s = 0; s < smoothPasses; s++) { step(0.55); step(-0.58); }
  }

  // ---- vertex normals (area-weighted) ----
  const N = new Float32Array(P.length);
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i] * 3, b = tris[i + 1] * 3, c = tris[i + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const nxv = uy * vz - uz * vy, nyv = uz * vx - ux * vz, nzv = ux * vy - uy * vx;
    N[a] += nxv; N[a + 1] += nyv; N[a + 2] += nzv;
    N[b] += nxv; N[b + 1] += nyv; N[b + 2] += nzv;
    N[c] += nxv; N[c + 1] += nyv; N[c + 2] += nzv;
  }
  for (let v = 0; v < nVerts; v++) {
    const o = v * 3; const l = Math.hypot(N[o], N[o + 1], N[o + 2]) || 1;
    N[o] /= l; N[o + 1] /= l; N[o + 2] /= l;
  }

  // ---- expand to non-indexed position+normal ----
  const nTri = tris.length / 3;
  const position = new Float32Array(nTri * 9);
  const normal = new Float32Array(nTri * 9);
  for (let i = 0; i < tris.length; i++) {
    const vi = tris[i] * 3, o = i * 3;
    position[o] = P[vi]; position[o + 1] = P[vi + 1]; position[o + 2] = P[vi + 2];
    normal[o] = N[vi]; normal[o + 1] = N[vi + 1]; normal[o + 2] = N[vi + 2];
  }
  status('');
  return { position, normal, stats: { grid: [nx, ny, nz], tris: nTri, verts: nVerts } };
}

if (typeof window !== 'undefined') window.voxelRemesh = voxelRemesh;
export default voxelRemesh;
