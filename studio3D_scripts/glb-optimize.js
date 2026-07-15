// ============================================================
// glb-optimize.js — GLB compression on the way out (audit, interop §1)
// Draco (geometry) or meshopt (buffers) via glTF-Transform, plus prune +
// dedup + optional quantization. All KHR material extensions pass through
// (registered), so ShaderLab's transmission / clearcoat / sheen / iridescence
// survive. Everything runs on-device; encoders are WASM, lazy-loaded once
// and then held in the service worker's runtime cache.
//
//   optimizeGLB(buffer, { method: 'draco' | 'meshopt' | 'none' })
//     → { buffer, before, after, savedPct, method }
// ============================================================

const CDN = 'https://esm.sh/';

let libP = null;
function lib() {
  if (!libP) {
    libP = (async () => {
      const [core, ext, fns] = await Promise.all([
        import(CDN + '@gltf-transform/core@4.1.1'),
        import(CDN + '@gltf-transform/extensions@4.1.1'),
        import(CDN + '@gltf-transform/functions@4.1.1'),
      ]);
      return { core, ext, fns };
    })().catch(e => { libP = null; throw e; });
  }
  return libP;
}

let dracoEncP = null;
function withTimeout(p, ms, what) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' timed out — use meshopt instead')), ms))]);
}
function dracoEncoder() {
  if (!dracoEncP) {
    // draco3dgltf's npm build is node-only (fs.readFileSync). Use the plain-JS
    // encoder three.js ships (defines DracoEncoderModule), served raw by esm.sh.
    // Load + init are timeout-guarded so a CDN stall can't hang the dialog.
    dracoEncP = withTimeout(new Promise((res, rej) => {
      if (self.DracoEncoderModule) return res();
      const s = document.createElement('script');
      s.src = 'https://esm.sh/three@0.160.0/examples/jsm/libs/draco/draco_encoder.js?raw';
      s.onload = res; s.onerror = () => rej(new Error('Draco encoder failed to load'));
      document.head.appendChild(s);
    }), 20000, 'Draco encoder download').then(() => {
      // emscripten Modules are self-resolving thenables — awaiting one directly
      // spins the microtask queue forever. Resolve manually and strip .then.
      const m = self.DracoEncoderModule({});
      return withTimeout(new Promise((res) => {
        if (m && typeof m.then === 'function') m.then(() => { try { delete m.then; } catch (e) { m.then = undefined; } res(m); });
        else res(m);
      }), 15000, 'Draco encoder init');
    })
      .catch(e => { dracoEncP = null; throw e; });
  }
  return dracoEncP;
}

let meshoptP = null;
function meshoptEncoder() {
  if (!meshoptP) {
    meshoptP = import(CDN + 'meshoptimizer@0.21.0')
      .then(async m => { const enc = m.MeshoptEncoder; await enc.ready; return enc; })
      .catch(e => { meshoptP = null; throw e; });
  }
  return meshoptP;
}

export async function optimizeGLB(buffer, opts) {
  opts = opts || {};
  const method = opts.method || 'draco';
  const before = buffer.byteLength;
  if (method === 'none') return { buffer, before, after: before, savedPct: 0, method };

  const { core, ext, fns } = await lib();
  const io = new core.WebIO().registerExtensions(ext.ALL_EXTENSIONS);

  const deps = {};
  if (method === 'draco') deps['draco3d.encoder'] = await dracoEncoder();
  if (method === 'meshopt') deps['meshopt.encoder'] = await meshoptEncoder();
  io.registerDependencies(deps);

  const doc = await io.readBinary(new Uint8Array(buffer));

  // safe clean-up passes first (no visual change)
  await doc.transform(fns.dedup(), fns.prune());

  if (method === 'draco') {
    await doc.transform(fns.draco({ method: 'edgebreaker' }));
  } else {
    // meshopt: reorder + quantize, then EXT_meshopt_compression on write
    await doc.transform(fns.meshopt({ encoder: await meshoptEncoder(), level: 'medium' }));
  }

  const out = await io.writeBinary(doc);
  const ab = out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  const after = ab.byteLength;
  return { buffer: ab, before, after, savedPct: Math.max(0, Math.round((1 - after / before) * 100)), method };
}

window.PPOptimize = { optimizeGLB };
export default { optimizeGLB };
