// ============================================================
// uv-worker.js — LSCM CONFORMAL PARAMETERIZATION (module worker)
//
// Solves each chart's UVs with Least-Squares Conformal Maps:
// one complex linear equation per triangle, two pinned vertices,
// normal equations AᵀA x = b solved by Jacobi-preconditioned
// conjugate gradient. The hot loop — the sparse matrix-vector
// product — runs in the project's hand-authored WASM gather
// kernel (wasm-mesh.js), the same one that powers subdivision:
// a CSR weighted-gather is exactly a sparse matvec. CSR data is
// staged into WASM linear memory ONCE per chart; each CG
// iteration only re-writes the solution vector.
// ============================================================
import { buildModule } from './wasm-mesh.js';

let wasmK = null;         // { memory, gather } | false (failed → JS fallback)
async function getWasm() {
  if (wasmK !== null) return wasmK;
  try {
    const memory = new WebAssembly.Memory({ initial: 32 });
    const { instance } = await WebAssembly.instantiate(buildModule(), { env: { mem: memory } });
    wasmK = { memory, gather: instance.exports.gather };
  } catch (e) { wasmK = false; }
  return wasmK;
}

const post = (m) => self.postMessage(m);

// ---- persistent-layout matvec (CSR staged once, src rewritten per call) ----
function makeMatvec(k, rowStart, idx, w, n) {
  if (!k) {
    return (x, out) => {
      for (let r = 0; r < n; r++) {
        let s = 0;
        for (let q = rowStart[r]; q < rowStart[r + 1]; q++) s += w[q] * x[idx[q]];
        out[r] = s;
      }
    };
  }
  const al = (x) => (x + 15) & ~15;
  const srcB = al(n * 12), dstB = al(n * 12), rowB = al((n + 1) * 4), idxB = al(idx.length * 4), wB = al(w.length * 4);
  const need = srcB + dstB + rowB + idxB + wB + 64;
  if (k.memory.buffer.byteLength < need) k.memory.grow(Math.ceil((need - k.memory.buffer.byteLength) / 65536));
  let p = 16;
  const srcPtr = p; p += srcB;
  const dstPtr = p; p += dstB;
  const rowPtr = p; p += rowB;
  const idxPtr = p; p += idxB;
  const wPtr = p;
  new Int32Array(k.memory.buffer, rowPtr, n + 1).set(rowStart);
  new Int32Array(k.memory.buffer, idxPtr, idx.length).set(idx);
  new Float32Array(k.memory.buffer, wPtr, w.length).set(w);
  new Float32Array(k.memory.buffer, srcPtr, n * 3).fill(0);   // y,z lanes stay 0
  return (x, out) => {
    const s = new Float32Array(k.memory.buffer, srcPtr, n * 3);
    for (let i = 0; i < n; i++) s[i * 3] = x[i];
    k.gather(srcPtr, dstPtr, rowPtr, idxPtr, wPtr, n);
    const d = new Float32Array(k.memory.buffer, dstPtr, n * 3);
    for (let i = 0; i < n; i++) out[i] = d[i * 3];
  };
}

// ---- preconditioned CG ----
function cg(matvec, rhs, diag, n, maxIt, tol) {
  const x = new Float64Array(n), r = Float64Array.from(rhs), z = new Float64Array(n), p = new Float64Array(n), Ap = new Float64Array(n);
  const inv = new Float64Array(n);
  for (let i = 0; i < n; i++) inv[i] = Math.abs(diag[i]) > 1e-12 ? 1 / diag[i] : 1;
  let rz = 0, b2 = 0;
  for (let i = 0; i < n; i++) { z[i] = r[i] * inv[i]; p[i] = z[i]; rz += r[i] * z[i]; b2 += rhs[i] * rhs[i]; }
  b2 = Math.sqrt(b2) || 1;
  for (let it = 0; it < maxIt; it++) {
    matvec(p, Ap);
    let pAp = 0; for (let i = 0; i < n; i++) pAp += p[i] * Ap[i];
    if (!(pAp > 1e-30)) break;
    const alpha = rz / pAp;
    let r2 = 0;
    for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Ap[i]; r2 += r[i] * r[i]; }
    if (Math.sqrt(r2) / b2 < tol) break;
    let rz2 = 0;
    for (let i = 0; i < n; i++) { z[i] = r[i] * inv[i]; rz2 += r[i] * z[i]; }
    const beta = rz2 / rz; rz = rz2;
    for (let i = 0; i < n; i++) p[i] = z[i] + beta * p[i];
  }
  return x;
}

// ---- fallback: project chart onto its average-normal plane ----
function planarProject(pos, tri) {
  const nL = pos.length / 3;
  let nx = 0, ny = 0, nz = 0;
  for (let f = 0; f < tri.length; f += 3) {
    const a = tri[f] * 3, b = tri[f + 1] * 3, c = tri[f + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    nx += uy * vz - uz * vy; ny += uz * vx - ux * vz; nz += ux * vy - uy * vx;
  }
  let l = Math.hypot(nx, ny, nz); if (l < 1e-12) { nx = 0; ny = 0; nz = 1; l = 1; }
  nx /= l; ny /= l; nz /= l;
  // frame
  let tx = 1, ty = 0, tz = 0;
  if (Math.abs(nx) > 0.9) { tx = 0; ty = 1; tz = 0; }
  let bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
  l = Math.hypot(bx, by, bz) || 1; bx /= l; by /= l; bz /= l;
  const cx = ny * bz - nz * by, cy = nz * bx - nx * bz, cz = nx * by - ny * bx;
  const uv = new Float32Array(nL * 2);
  for (let i = 0; i < nL; i++) {
    uv[i * 2] = pos[i * 3] * bx + pos[i * 3 + 1] * by + pos[i * 3 + 2] * bz;
    uv[i * 2 + 1] = pos[i * 3] * cx + pos[i * 3 + 1] * cy + pos[i * 3 + 2] * cz;
  }
  return uv;
}

// ---- LSCM for one chart ----
function lscm(pos, tri, k) {
  const nL = pos.length / 3, nT = tri.length / 3;
  if (nT === 0 || nL < 3) return new Float32Array(nL * 2);

  // per-triangle local complex weights  w_m / sqrt(2A)
  const wa = new Float64Array(nT * 3), wb = new Float64Array(nT * 3);   // real, imag per corner
  for (let f = 0; f < nT; f++) {
    const i0 = tri[f * 3] * 3, i1 = tri[f * 3 + 1] * 3, i2 = tri[f * 3 + 2] * 3;
    const e1x = pos[i1] - pos[i0], e1y = pos[i1 + 1] - pos[i0 + 1], e1z = pos[i1 + 2] - pos[i0 + 2];
    const e2x = pos[i2] - pos[i0], e2y = pos[i2 + 1] - pos[i0 + 1], e2z = pos[i2 + 2] - pos[i0 + 2];
    const x1 = Math.hypot(e1x, e1y, e1z);
    const cxn = e1y * e2z - e1z * e2y, cyn = e1z * e2x - e1x * e2z, czn = e1x * e2y - e1y * e2x;
    const A2 = Math.hypot(cxn, cyn, czn);
    if (x1 < 1e-12 || A2 < 1e-14) continue;                 // degenerate — contributes nothing
    const x2 = (e1x * e2x + e1y * e2y + e1z * e2z) / x1;
    const y2 = A2 / x1;
    const s = 1 / Math.sqrt(A2);
    // P0=(0,0) P1=(x1,0) P2=(x2,y2) ;  w0=P2-P1  w1=P0-P2  w2=P1-P0
    wa[f * 3] = (x2 - x1) * s; wb[f * 3] = y2 * s;
    wa[f * 3 + 1] = -x2 * s;   wb[f * 3 + 1] = -y2 * s;
    wa[f * 3 + 2] = x1 * s;    wb[f * 3 + 2] = 0;
  }

  // boundary vertices (edges used once)
  const eCount = new Map();
  const ek = (a, b) => a < b ? a * nL + b : b * nL + a;
  for (let f = 0; f < nT; f++) {
    for (let e = 0; e < 3; e++) {
      const key = ek(tri[f * 3 + e], tri[f * 3 + (e + 1) % 3]);
      eCount.set(key, (eCount.get(key) || 0) + 1);
    }
  }
  const onB = new Uint8Array(nL);
  for (const [key, c] of eCount) if (c === 1) { onB[key % nL] = 1; onB[(key / nL) | 0] = 1; }
  let bset = [];
  for (let i = 0; i < nL; i++) if (onB[i]) bset.push(i);
  if (bset.length < 2) bset = [...Array(nL).keys()];        // closed chart — pin any two far verts
  const d2 = (i, j) => {
    const dx = pos[i * 3] - pos[j * 3], dy = pos[i * 3 + 1] - pos[j * 3 + 1], dz = pos[i * 3 + 2] - pos[j * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  };
  let pin0 = bset[0];
  for (const v of bset) if (pos[v * 3 + 1] < pos[pin0 * 3 + 1]) pin0 = v;
  let pin1 = bset[0] === pin0 ? bset[bset.length - 1] : bset[0], best = -1;
  for (const v of bset) { const d = d2(pin0, v); if (d > best) { best = d; pin1 = v; } }
  if (pin1 === pin0) return planarProject(pos, tri);
  const pinU = new Float64Array([0, 1]), pinV = new Float64Array([0, 0]);

  // free-vertex indexing
  const freeOf = new Int32Array(nL).fill(-1);
  let nFree = 0;
  for (let i = 0; i < nL; i++) if (i !== pin0 && i !== pin1) freeOf[i] = nFree++;
  const n = nFree * 2;
  if (n === 0) { // one-triangle chart
    const uv = planarProject(pos, tri);
    return uv;
  }

  // assemble AᵀA (rows of Maps) + rhs
  const rows = new Array(n);
  for (let i = 0; i < n; i++) rows[i] = new Map();
  const rhs = new Float64Array(n);
  const add = (r, c, v) => { if (v !== 0) rows[r].set(c, (rows[r].get(c) || 0) + v); };
  for (let f = 0; f < nT; f++) {
    for (let m = 0; m < 3; m++) {
      const vm = tri[f * 3 + m], fm = freeOf[vm];
      if (fm < 0) continue;
      const am = wa[f * 3 + m], bm = wb[f * 3 + m];
      for (let q = 0; q < 3; q++) {
        const vn = tri[f * 3 + q], fn = freeOf[vn];
        const an = wa[f * 3 + q], bn = wb[f * 3 + q];
        const cuu = am * an + bm * bn;          // = cvv
        const cuv = bm * an - am * bn;          // M[u][v] ;  M[v][u] = -cuv... see below
        if (fn >= 0) {
          add(2 * fm, 2 * fn, cuu);
          add(2 * fm, 2 * fn + 1, cuv);
          add(2 * fm + 1, 2 * fn, -cuv);
          add(2 * fm + 1, 2 * fn + 1, cuu);
        } else {
          const pi = vn === pin0 ? 0 : 1;
          rhs[2 * fm] -= cuu * pinU[pi] + cuv * pinV[pi];
          rhs[2 * fm + 1] -= (-cuv) * pinU[pi] + cuu * pinV[pi];
        }
      }
    }
  }
  // NOTE on symmetry: M[um][vn] = bm·an − am·bn and M[vm][un] = am·bn − bm·an,
  // so M[um][vn] = M[vn][um] — the assembled matrix IS symmetric. ✓

  // to CSR
  let nnz = 0; for (let i = 0; i < n; i++) nnz += rows[i].size;
  const rowStart = new Int32Array(n + 1), idx = new Int32Array(nnz), w = new Float32Array(nnz);
  const diag = new Float64Array(n);
  let o = 0;
  for (let i = 0; i < n; i++) {
    rowStart[i] = o;
    for (const [c, v] of rows[i]) { idx[o] = c; w[o] = v; o++; if (c === i) diag[i] = v; }
    rows[i] = null;
  }
  rowStart[n] = o;

  const matvec = makeMatvec(k, rowStart, idx, w, n);
  const iters = Math.min(2400, Math.max(220, Math.round(Math.sqrt(n) * 22)));
  const x = cg(matvec, rhs, diag, n, iters, 2e-7);

  const uv = new Float32Array(nL * 2);
  uv[pin0 * 2] = pinU[0]; uv[pin0 * 2 + 1] = pinV[0];
  uv[pin1 * 2] = pinU[1]; uv[pin1 * 2 + 1] = pinV[1];
  for (let i = 0; i < nL; i++) {
    const fi = freeOf[i];
    if (fi >= 0) { uv[i * 2] = x[2 * fi]; uv[i * 2 + 1] = x[2 * fi + 1]; }
  }
  // NaN guard → fallback
  for (let i = 0; i < uv.length; i++) if (!isFinite(uv[i])) return planarProject(pos, tri);
  return uv;
}

self.onmessage = async (e) => {
  const d = e.data;
  if (!d || d.type !== 'solve') return;
  const k = await getWasm();
  const out = [];
  const total = d.charts.length;
  for (let ci = 0; ci < total; ci++) {
    post({ type: 'progress', phase: `conformal solve — chart ${ci + 1}/${total}${k ? ' · wasm' : ''}`, frac: ci / total });
    const ch = d.charts[ci];
    let uv;
    try { uv = lscm(ch.pos, ch.tri, k); }
    catch (err) { uv = planarProject(ch.pos, ch.tri); }
    out.push(uv);
  }
  post({ type: 'progress', phase: 'packing charts', frac: 0.98 });
  self.postMessage({ type: 'done', uvs: out }, out.map(u => u.buffer));
};
