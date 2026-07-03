// ============================================================
// wasm-mesh.js — hand-authored WebAssembly sparse-gather kernel.
//
// One tiny exported function powers both smooth (Loop) subdivision and
// Taubin mesh relaxation. Any operation of the form
//
//     dst[o] = Σ_k  w[k] · src[ idx[k] ]        (for x, y, z)
//
// is a sparse matrix × vertex-vector product. We store the operator in CSR:
//
//   rowStart : i32[nOut + 1]   index into idx/w where each output row begins
//   idx      : i32[nnz]        which source vertex each term reads
//   w        : f32[nnz]        the weight of that term
//
// The WASM kernel walks every output vertex, sums its weighted source
// terms across all three coordinates, and writes the result. Building the
// CSR operator (the topology + Loop / Taubin weights) is graph work and
// stays in JS; the per-vertex arithmetic — the part that explodes when you
// subdivide a mesh to hundreds of thousands of vertices — runs in WASM.
//
//   gather(srcPtr, dstPtr, rowPtr, idxPtr, wPtr, nOut)
//
// The whole module is emitted below by hand (LEB128 + opcodes); there is no
// compiler in this project. createMeshKernel() is the friendly wrapper.
// ============================================================

const U = (n) => { n >>>= 0; const o = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
const S = (n) => { n |= 0; const o = []; while (true) { let b = n & 0x7f; n >>= 7; if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { o.push(b); break; } o.push(b | 0x80); } return o; };
const STR = (s) => { const a = [...s].map(c => c.charCodeAt(0)); return [...U(a.length), ...a]; };
const flat = (...xs) => xs.flat(Infinity);

const getL = i => [0x20, ...U(i)];
const setL = i => [0x21, ...U(i)];
const i32c = n => [0x41, ...S(n)];
const f32load = o => [0x2a, 2, ...U(o)];
const f32store = o => [0x38, 2, ...U(o)];
const i32load = o => [0x28, 2, ...U(o)];
const i_add = [0x6a], i_mul = [0x6c], i_ges = [0x4e];
const f_add = [0x92], f_mul = [0x94];
const BRIF = d => [0x0d, ...U(d)];
const BLOCK = body => [0x02, 0x40, ...body, 0x0b];
const LOOP = body => [0x03, 0x40, ...body, 0x0b];

function buildModule() {
  // params  0 srcPtr 1 dstPtr 2 rowPtr 3 idxPtr 4 wPtr 5 nOut   (all i32)
  // locals  i32: 6 o 7 start 8 end 9 k 10 jb 11 ob
  //         f32: 12 sx 13 sy 14 sz 15 wk
  const body = flat(
    i32c(0), setL(6),
    BLOCK(flat(LOOP(flat(
      getL(6), getL(5), i_ges, BRIF(1),                                  // o >= nOut -> break
      getL(2), getL(6), i32c(4), i_mul, i_add, i32load(0), setL(7),       // start = rowStart[o]
      getL(2), getL(6), i32c(1), i_add, i32c(4), i_mul, i_add, i32load(0), setL(8), // end = rowStart[o+1]
      getL(6), i32c(12), i_mul, setL(11),                                // ob = o*12
      // zero accumulators
      [0x43, 0, 0, 0, 0], setL(12),
      [0x43, 0, 0, 0, 0], setL(13),
      [0x43, 0, 0, 0, 0], setL(14),
      getL(7), setL(9),                                                  // k = start
      BLOCK(flat(LOOP(flat(
        getL(9), getL(8), i_ges, BRIF(1),                                // k >= end -> break inner
        getL(3), getL(9), i32c(4), i_mul, i_add, i32load(0), i32c(12), i_mul, setL(10), // jb = idx[k]*12
        getL(4), getL(9), i32c(4), i_mul, i_add, f32load(0), setL(15),   // wk = w[k]
        getL(12), getL(15), getL(0), getL(10), i_add, f32load(0), f_mul, f_add, setL(12), // sx += wk*src.x
        getL(13), getL(15), getL(0), getL(10), i_add, f32load(4), f_mul, f_add, setL(13), // sy += wk*src.y
        getL(14), getL(15), getL(0), getL(10), i_add, f32load(8), f_mul, f_add, setL(14), // sz += wk*src.z
        getL(9), i32c(1), i_add, setL(9),
        [0x0c, 0]
      )))),
      getL(1), getL(11), i_add, getL(12), f32store(0),                   // dst.x
      getL(1), getL(11), i_add, getL(13), f32store(4),                   // dst.y
      getL(1), getL(11), i_add, getL(14), f32store(8),                   // dst.z
      getL(6), i32c(1), i_add, setL(6),
      [0x0c, 0]
    )))),
    [0x0b]
  );
  const locals = flat(U(2), U(6), [0x7f], U(4), [0x7d]);
  const code = flat(U(locals.length + body.length), locals, body);

  const fnType = flat([0x60], U(6), [0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f], U(0));
  const sec = (id, p) => flat([id], U(p.length), p);
  return new Uint8Array(flat(
    [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00],
    sec(1, flat(U(1), fnType)),
    sec(2, flat(U(1), STR('env'), STR('mem'), [0x02, 0x00], U(2))),
    sec(3, flat(U(1), U(0))),
    sec(7, flat(U(1), STR('gather'), [0x00], U(0))),
    sec(10, flat(U(1), code))
  ));
}

export async function createMeshKernel() {
  const memory = new WebAssembly.Memory({ initial: 4 });
  const { instance } = await WebAssembly.instantiate(buildModule(), { env: { mem: memory } });
  const gather = instance.exports.gather;

  // bump allocator inside linear memory
  let top = 0;
  const ensure = (bytes) => { const need = top + bytes; const have = memory.buffer.byteLength; if (need > have) memory.grow(Math.ceil((need - have) / 65536)); };
  const alloc = (bytes) => { ensure(bytes); const p = top; top += (bytes + 15) & ~15; return p; };

  return {
    memory,
    /**
     * Apply a CSR weighted-gather operator to a source vertex array.
     * @param {Float32Array} src     length nSrc*3  (xyz interleaved)
     * @param {Int32Array}   rowStart length nOut+1
     * @param {Int32Array}   idx      length nnz
     * @param {Float32Array} w        length nnz
     * @param {number}       nOut
     * @returns {Float32Array}  new vertex array length nOut*3
     */
    apply(src, rowStart, idx, w, nOut) {
      top = 0;
      const nSrc = src.length / 3, nnz = idx.length;
      const srcPtr = alloc(src.length * 4);
      const dstPtr = alloc(nOut * 3 * 4);
      const rowPtr = alloc(rowStart.length * 4);
      const idxPtr = alloc(nnz * 4);
      const wPtr = alloc(nnz * 4);
      const buf = memory.buffer;
      new Float32Array(buf, srcPtr, src.length).set(src);
      new Int32Array(buf, rowPtr, rowStart.length).set(rowStart);
      new Int32Array(buf, idxPtr, nnz).set(idx);
      new Float32Array(buf, wPtr, nnz).set(w);
      gather(srcPtr, dstPtr, rowPtr, idxPtr, wPtr, nOut);
      return new Float32Array(buf, dstPtr, nOut * 3).slice(0);
    },
  };
}

export { buildModule };
