// ============================================================
// chunk-loader.js — load Cloudflare-split assets and reassemble them
// on the fly, transparently, in the browser.
//
// Cloudflare Pages refuses files over 25 MiB. The data/chunker.py script
// splits an oversized .glb/.fbx into `<file>.part000`, `<file>.part001`, …
// (24 MiB each) and writes a tiny sidecar `<file>.chunks.json`:
//     { "chunks": 3, "size": 66611912 }
// The original .glb is then deleted from the deploy.
//
// fetchAssetBuffer(url) returns the full ArrayBuffer for `url` whether the
// whole file is present OR only its chunks are. Strategy:
//   1. if told it's chunked (opts.chunked / opts.chunks) → load chunks
//   2. otherwise try the whole file first (one request, no fuss)
//   3. if that 404s / errors → fall back to the chunk set
// So a normal file costs exactly one request; a chunked file costs one
// (failed) probe + its parts. No manifest threading needed anywhere — the
// sidecar is the source of truth for the chunk count.
// ============================================================

const PAD = 3;
const pad = (i) => String(i).padStart(PAD, '0');

async function loadChunked(url, count) {
  let n = count | 0;
  if (!n) {
    const sidecar = url + '.chunks.json';
    const m = await fetch(sidecar, { cache: 'force-cache' });
    if (!m.ok) throw new Error('Asset missing (no whole file, no chunks): ' + url);
    // A static host may answer a missing sidecar with a 200-status HTML
    // fallback (SPA/404 page). That parses as JSON at line 1 col 1 and throws
    // a cryptic error — so read text and validate it's really JSON first.
    const text = (await m.text()).trim();
    if (text[0] !== '{') {
      throw new Error(
        'Chunk manifest for ' + url + ' is not JSON — the host returned ' +
        (text.slice(0, 1) === '<' ? 'an HTML page (likely a 404/SPA fallback). ' : 'unexpected content. ') +
        'Check that ' + sidecar + ' is actually deployed.'
      );
    }
    let meta;
    try { meta = JSON.parse(text); }
    catch (e) { throw new Error('Chunk manifest for ' + url + ' is malformed JSON: ' + e.message); }
    n = meta.chunks | 0;
    if (!n) throw new Error('Bad chunk manifest for ' + url);
  }
  const parts = new Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    const r = await fetch(url + '.part' + pad(i), { cache: 'force-cache' });
    if (!r.ok) throw new Error('Missing chunk ' + (i + 1) + '/' + n + ' for ' + url + ' (' + r.status + ')');
    // A 200 SPA/404 fallback would hand us index.html here too — detect it so we
    // don't silently concatenate HTML into the binary and hand the loader garbage.
    if (/text\/html/i.test(r.headers.get('content-type') || '')) {
      throw new Error('Chunk ' + (i + 1) + '/' + n + ' for ' + url + ' returned an HTML page (likely a 404/SPA fallback) — the part is not deployed.');
    }
    const b = new Uint8Array(await r.arrayBuffer());
    parts[i] = b; total += b.length;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const b of parts) { out.set(b, o); o += b.length; }
  return out.buffer;
}

// url: e.g. "data/characters/Tamamo.glb"
// opts: { chunked?:bool, chunks?:number }  (both optional)
async function fetchWhole(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('Whole-file fetch failed for ' + url + ' (' + r.status + ')');
  if (/text\/html/i.test(r.headers.get('content-type') || '')) {
    throw new Error('Whole-file fetch for ' + url + ' returned an HTML page (likely a 404/SPA fallback).');
  }
  return await r.arrayBuffer();
}

export async function fetchAssetBuffer(url, opts) {
  opts = opts || {};
  if (opts.chunked || opts.chunks) {
    // Chunked is the source of truth, but if the parts/sidecar aren't actually
    // deployed (the common prod failure), fall back to the whole file before
    // giving up — that self-heals any entry flagged chunked whose original is
    // still present (e.g. a file under the host's size limit).
    try {
      return await loadChunked(url, opts.chunks);
    } catch (chunkErr) {
      try {
        return await fetchWhole(url);
      } catch (wholeErr) {
        throw new Error(chunkErr.message + ' — and the whole file is not available either (' + wholeErr.message + ').');
      }
    }
  }
  try {
    return await fetchWhole(url);
  } catch (e) { /* missing/HTML/network → try chunks below */ }
  return loadChunked(url, opts.chunks);
}

// ============================================================
// LOD support. A character manifest entry may carry an optional `lods` array:
//   "lods": [ { "pct":100, "path":"…_100.glb", "chunked?":…, "chunks?":… },
//             { "pct":50,  "path":"…_50.glb" }, { "pct":10, "path":"…_10.glb" } ]
// pct = percent of the ORIGINAL triangle count. Sorted high→low here.
// The runtime picks a rung by a desired pct (see lod-switch.js) and fetches
// it through the same chunk-aware path as any other asset.
// ============================================================
export function lodRungs(entry) {
  if (!entry || !Array.isArray(entry.lods) || !entry.lods.length) return null;
  return entry.lods
    .map(l => ({ pct: +l.pct || 0, path: l.path, chunked: l.chunked, chunks: l.chunks, tris: l.tris }))
    .filter(l => l.pct > 0 && l.path)
    .sort((a, b) => b.pct - a.pct);
}
// Pick the rung whose pct is the smallest one >= wanted (so we never render
// coarser than asked); fall back to the coarsest available.
export function pickRung(rungs, wantedPct) {
  if (!rungs || !rungs.length) return null;
  const w = Math.max(0, Math.min(100, +wantedPct || 0));
  let chosen = null;
  for (const r of rungs) { if (r.pct >= w) chosen = r; }   // rungs are high→low
  return chosen || rungs[rungs.length - 1];
}
export async function fetchLODBuffer(rung) {
  if (!rung || !rung.path) throw new Error('No LOD rung');
  return fetchAssetBuffer(rung.path, { chunked: rung.chunked, chunks: rung.chunks });
}

// Convenience for the AutoRig app, which wants a Blob/File.
export async function fetchAssetBlob(url, opts) {
  const buf = await fetchAssetBuffer(url, opts);
  return new Blob([buf]);
}

if (typeof window !== 'undefined') {
  window.StudioAssets = Object.assign(window.StudioAssets || {}, { fetchAssetBuffer, fetchAssetBlob, lodRungs, pickRung, fetchLODBuffer });
}

export default fetchAssetBuffer;
