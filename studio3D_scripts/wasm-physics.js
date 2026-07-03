// ============================================================
// wasm-physics.js — hand-authored WebAssembly XPBD soft-body / cloth solver
//
// There is NO compiler in this project. This module emits the raw WASM
// binary by hand (LEB128 + opcodes), then instantiates it. The exported
// `step` function runs the full Position-Based-Dynamics loop entirely in
// linear memory at native speed:
//
//   step(posPtr, prevPtr, consPtr, imPtr, nP, nC, iters, dt, gravity, damping, groundY)
//
//   • Verlet integration of every particle (gravity on Y, velocity damping)
//   • ground-plane collision  (y = max(y, groundY))
//   • mass-weighted distance-constraint projection, `iters` Gauss-Seidel passes
//   • inverse-mass 0  ==  pinned vertex (immovable) — used for cloth hooks
//
// Memory layout (caller-owned, all little-endian f32 unless noted):
//   pos[]  : x,y,z per particle           (3 * nP floats)
//   prev[] : x,y,z per particle           (3 * nP floats)
//   cons[] : i(i32), j(i32), rest(f32)    (3 words per constraint)
//   im[]   : inverse mass per particle    (nP floats)  0 => pinned
//
// Everything below is the assembler. Skip to createSolver() at the bottom
// for the friendly wrapper.
// ============================================================

// ---- LEB128 / float encoders -------------------------------------------------
const U = (n) => { n >>>= 0; const o = []; do { let b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n); return o; };
const S = (n) => { n |= 0; const o = []; while (true) { let b = n & 0x7f; n >>= 7; if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { o.push(b); break; } o.push(b | 0x80); } return o; };
const F = (x) => { const b = new Uint8Array(4); new DataView(b.buffer).setFloat32(0, x, true); return [...b]; };
const STR = (s) => { const a = [...s].map(c => c.charCodeAt(0)); return [...U(a.length), ...a]; };
const flat = (...xs) => xs.flat(Infinity);

// ---- opcode helpers ----------------------------------------------------------
const getL = i => [0x20, ...U(i)];
const setL = i => [0x21, ...U(i)];
const i32c = n => [0x41, ...S(n)];
const f32c = x => [0x43, ...F(x)];
const f32load = o => [0x2a, 2, ...U(o)];
const f32store = o => [0x38, 2, ...U(o)];
const i32load = o => [0x28, 2, ...U(o)];
const i_add = [0x6a], i_sub = [0x6b], i_mul = [0x6c], i_and = [0x71], i_ges = [0x4e];
const f_add = [0x92], f_sub = [0x93], f_mul = [0x94], f_div = [0x95], f_sqrt = [0x91], f_max = [0x97], f_gt = [0x5e], f_lt = [0x5d];
const BR = d => [0x0c, ...U(d)];
const BRIF = d => [0x0d, ...U(d)];
const BLOCK = body => [0x02, 0x40, ...body, 0x0b];
const LOOP = body => [0x03, 0x40, ...body, 0x0b];
const IF = body => [0x04, 0x40, ...body, 0x0b];

// ---- the step() function body ------------------------------------------------
// params  0 posPtr 1 prevPtr 2 consPtr 3 imPtr 4 nP 5 nC 6 iters (i32)
//         7 dt 8 gravity 9 damping 10 groundY (f32)
// locals  i32: 11 base 12 i 13 it 14 c 15 ci 16 ai 17 bi
//         f32: 18 dt2 19 cx 20 cy 21 cz 22 px 23 py 24 pz 25 w
//              26 dx 27 dy 28 dz 29 dist 30 s 31 rest 32 wi 33 wj 34 wsum
function buildModule() {
  const dt2 = flat(getL(7), getL(7), f_mul, setL(18));

  const integrate = flat(
    i32c(0), setL(12),
    BLOCK(flat(LOOP(flat(
      getL(12), getL(4), i_ges, BRIF(1),
      getL(12), i32c(12), i_mul, setL(11),
      // current
      getL(0), getL(11), i_add, f32load(0), setL(19),
      getL(0), getL(11), i_add, f32load(4), setL(20),
      getL(0), getL(11), i_add, f32load(8), setL(21),
      // previous
      getL(1), getL(11), i_add, f32load(0), setL(22),
      getL(1), getL(11), i_add, f32load(4), setL(23),
      getL(1), getL(11), i_add, f32load(8), setL(24),
      // inverse mass
      getL(3), getL(12), i32c(4), i_mul, i_add, f32load(0), setL(25),
      // prev = current
      getL(1), getL(11), i_add, getL(19), f32store(0),
      getL(1), getL(11), i_add, getL(20), f32store(4),
      getL(1), getL(11), i_add, getL(21), f32store(8),
      // if (w > 0) integrate
      getL(25), f32c(0), f_gt,
      IF(flat(
        // x = cx + (cx-px)*damping
        getL(0), getL(11), i_add, getL(19), getL(19), getL(22), f_sub, getL(9), f_mul, f_add, f32store(0),
        // y = max( cy + (cy-py)*damping + gravity*dt2 , groundY )
        getL(20), getL(20), getL(23), f_sub, getL(9), f_mul, f_add, getL(8), getL(18), f_mul, f_add, getL(10), f_max, setL(20),
        getL(0), getL(11), i_add, getL(20), f32store(4),
        // z = cz + (cz-pz)*damping
        getL(0), getL(11), i_add, getL(21), getL(21), getL(24), f_sub, getL(9), f_mul, f_add, f32store(8)
      )),
      getL(12), i32c(1), i_add, setL(12),
      BR(0)
    ))))
  );

  const solve = flat(
    i32c(0), setL(13),
    BLOCK(flat(LOOP(flat(
      getL(13), getL(6), i_ges, BRIF(1),         // it >= iters
      i32c(0), setL(14),
      BLOCK(flat(LOOP(flat(
        getL(14), getL(5), i_ges, BRIF(1),       // c >= nC
        getL(2), getL(14), i32c(12), i_mul, i_add, setL(15),                 // ci = cons + c*12
        getL(0), getL(15), i32load(0), i32c(12), i_mul, i_add, setL(16),     // ai = pos + i*12
        getL(0), getL(15), i32load(4), i32c(12), i_mul, i_add, setL(17),     // bi = pos + j*12
        getL(15), f32load(8), setL(31),                                       // rest
        getL(3), getL(15), i32load(0), i32c(4), i_mul, i_add, f32load(0), setL(32), // wi
        getL(3), getL(15), i32load(4), i32c(4), i_mul, i_add, f32load(0), setL(33), // wj
        getL(32), getL(33), f_add, setL(34),                                  // wsum
        // delta = b - a
        getL(17), f32load(0), getL(16), f32load(0), f_sub, setL(26),
        getL(17), f32load(4), getL(16), f32load(4), f_sub, setL(27),
        getL(17), f32load(8), getL(16), f32load(8), f_sub, setL(28),
        // dist = |delta|
        getL(26), getL(26), f_mul, getL(27), getL(27), f_mul, f_add, getL(28), getL(28), f_mul, f_add, f_sqrt, setL(29),
        // if (dist > 1e-6 && wsum > 0)
        getL(29), f32c(1e-6), f_gt, getL(34), f32c(0), f_gt, i_and,
        IF(flat(
          // s = (dist - rest) / dist / wsum
          getL(29), getL(31), f_sub, getL(29), f_div, getL(34), f_div, setL(30),
          // a += delta * s * wi
          getL(16), getL(16), f32load(0), getL(26), getL(30), f_mul, getL(32), f_mul, f_add, f32store(0),
          getL(16), getL(16), f32load(4), getL(27), getL(30), f_mul, getL(32), f_mul, f_add, f32store(4),
          getL(16), getL(16), f32load(8), getL(28), getL(30), f_mul, getL(32), f_mul, f_add, f32store(8),
          // b -= delta * s * wj
          getL(17), getL(17), f32load(0), getL(26), getL(30), f_mul, getL(33), f_mul, f_sub, f32store(0),
          getL(17), getL(17), f32load(4), getL(27), getL(30), f_mul, getL(33), f_mul, f_sub, f32store(4),
          getL(17), getL(17), f32load(8), getL(28), getL(30), f_mul, getL(33), f_mul, f_sub, f32store(8)
        )),
        getL(14), i32c(1), i_add, setL(14),
        BR(0)
      )))),
      getL(13), i32c(1), i_add, setL(13),
      BR(0)
    ))))
  );

  const body = flat(dt2, integrate, solve, [0x0b]);
  const locals = flat(U(2), U(7), [0x7f], U(17), [0x7d]);
  const code = flat(U(locals.length + body.length), locals, body);

  // ---- collideSpheres(posPtr, imPtr, nP, sphPtr, nS) ----
  // spheres laid out cx,cy,cz,r (4 f32 = 16 bytes). Pushes each free particle
  // out to the surface of any sphere it has penetrated (composes across spheres).
  // params 0 posPtr 1 imPtr 2 nP 3 sphPtr 4 nS (i32)
  // locals i32: 5 i 6 s 7 pb 8 sb   f32: 9 px 10 py 11 pz 12 cx 13 cy 14 cz 15 r
  //             16 dx 17 dy 18 dz 19 dist 20 sc
  const collide = flat(
    i32c(0), setL(5),
    BLOCK(flat(LOOP(flat(
      getL(5), getL(2), i_ges, BRIF(1),
      getL(0), getL(5), i32c(12), i_mul, i_add, setL(7),          // pb = pos + i*12
      getL(1), getL(5), i32c(4), i_mul, i_add, f32load(0), f32c(0), f_gt,  // invMass[i] > 0
      IF(flat(
        getL(7), f32load(0), setL(9), getL(7), f32load(4), setL(10), getL(7), f32load(8), setL(11),
        i32c(0), setL(6),
        BLOCK(flat(LOOP(flat(
          getL(6), getL(4), i_ges, BRIF(1),
          getL(3), getL(6), i32c(16), i_mul, i_add, setL(8),       // sb = sph + s*16
          getL(8), f32load(0), setL(12), getL(8), f32load(4), setL(13), getL(8), f32load(8), setL(14), getL(8), f32load(12), setL(15),
          getL(9), getL(12), f_sub, setL(16),
          getL(10), getL(13), f_sub, setL(17),
          getL(11), getL(14), f_sub, setL(18),
          getL(16), getL(16), f_mul, getL(17), getL(17), f_mul, f_add, getL(18), getL(18), f_mul, f_add, f_sqrt, setL(19),
          getL(19), getL(15), f_lt, getL(19), f32c(1e-5), f_gt, i_and,
          IF(flat(
            getL(15), getL(19), f_div, setL(20),                   // sc = r / dist
            getL(12), getL(16), getL(20), f_mul, f_add, setL(9),
            getL(13), getL(17), getL(20), f_mul, f_add, setL(10),
            getL(14), getL(18), getL(20), f_mul, f_add, setL(11)
          )),
          getL(6), i32c(1), i_add, setL(6),
          BR(0)
        )))),
        getL(7), getL(9), f32store(0), getL(7), getL(10), f32store(4), getL(7), getL(11), f32store(8)
      )),
      getL(5), i32c(1), i_add, setL(5),
      BR(0)
    ))))
  );
  const bodyB = flat(collide, [0x0b]);
  const localsB = flat(U(2), U(4), [0x7f], U(12), [0x7d]);
  const codeB = flat(U(localsB.length + bodyB.length), localsB, bodyB);

  const fnType = flat([0x60], U(11),
    [0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7f, 0x7d, 0x7d, 0x7d, 0x7d], U(0));
  const fnTypeB = flat([0x60], U(5), [0x7f, 0x7f, 0x7f, 0x7f, 0x7f], U(0));

  const sec = (id, payload) => flat([id], U(payload.length), payload);
  const typeSec = sec(1, flat(U(2), fnType, fnTypeB));
  const importSec = sec(2, flat(U(1), STR('env'), STR('mem'), [0x02, 0x00], U(1)));
  const funcSec = sec(3, flat(U(2), U(0), U(1)));
  const exportSec = sec(7, flat(U(2), STR('step'), [0x00], U(0), STR('collide'), [0x00], U(1)));
  const codeSec = sec(10, flat(U(2), code, codeB));

  return new Uint8Array(flat(
    [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00],
    typeSec, importSec, funcSec, exportSec, codeSec
  ));
}

// ---- friendly wrapper --------------------------------------------------------
// A SoftSolver owns its WASM memory and lays particle data out for you.
export async function createSolver(maxParticles = 200000, maxConstraints = 1200000) {
  const need = (maxParticles * 3 * 4) * 2 + maxConstraints * 12 + maxParticles * 4 + 1024;
  const pages = Math.max(2, Math.ceil(need / 65536));
  const memory = new WebAssembly.Memory({ initial: pages });
  const bytes = buildModule();
  const { instance } = await WebAssembly.instantiate(bytes, { env: { mem: memory } });
  const step = instance.exports.step;
  const collideFn = instance.exports.collide;
  const MAXS = 64;

  // byte offsets inside linear memory
  let posPtr = 0, prevPtr = 0, consPtr = 0, imPtr = 0, sphPtr = 0, nP = 0, nC = 0, nS = 0;

  const api = {
    memory,
    raw: bytes,
    /** allocate buffers for a given particle / constraint count */
    alloc(particleCount, constraintCount) {
      nP = particleCount; nC = constraintCount;
      posPtr = 0;
      prevPtr = posPtr + nP * 3 * 4;
      imPtr = prevPtr + nP * 3 * 4;
      consPtr = imPtr + nP * 4;
      sphPtr = consPtr + nC * 12;
      const end = sphPtr + MAXS * 16;
      const have = memory.buffer.byteLength;
      if (end > have) memory.grow(Math.ceil((end - have) / 65536));
      return api.views();
    },
    views() {
      const buf = memory.buffer;
      return {
        pos: new Float32Array(buf, posPtr, nP * 3),
        prev: new Float32Array(buf, prevPtr, nP * 3),
        invMass: new Float32Array(buf, imPtr, nP),
        consI: new Int32Array(buf, consPtr, nC * 3),     // [i,j,restBits] interleaved
        consF: new Float32Array(buf, consPtr, nC * 3),
      };
    },
    /** write one constraint record (rest length as f32) */
    setConstraint(k, i, j, rest) {
      const buf = memory.buffer;
      const i32 = new Int32Array(buf, consPtr + k * 12, 2);
      const f32 = new Float32Array(buf, consPtr + k * 12 + 8, 1);
      i32[0] = i; i32[1] = j; f32[0] = rest;
    },
    /** run one simulation step */
    step(iters, dt, gravity, damping, groundY) {
      step(posPtr, prevPtr, consPtr, imPtr, nP, nC, iters | 0, dt, gravity, damping, groundY);
    },
    /** set the active sphere colliders: array of {x,y,z,r} (capped at 64) */
    setSpheres(spheres) {
      nS = Math.min(MAXS, spheres.length);
      const f = new Float32Array(memory.buffer, sphPtr, nS * 4);
      for (let k = 0; k < nS; k++) { const s = spheres[k]; f[k * 4] = s.x; f[k * 4 + 1] = s.y; f[k * 4 + 2] = s.z; f[k * 4 + 3] = s.r; }
    },
    /** push every free particle out of any penetrated sphere */
    collide() { if (nS > 0) collideFn(posPtr, imPtr, nP, sphPtr, nS); },
    get counts() { return { nP, nC, nS }; },
  };
  return api;
}

export { buildModule };
