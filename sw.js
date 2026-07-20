/* ============================================================
   sw.js — PolyPotion service worker
   Makes the suite installable and fully usable OFFLINE after the first visit.
   Strategy:
     • Core shell (index, theme, support, every tool HTML) is PRECACHED on
       install, so the app opens with no network at all.
     • Same-origin assets (engines, rig scripts, data, icons) are cached
       cache-first and added to a runtime cache the first time they're used.
     • Cross-origin deps (three.js/manifold/MediaPipe from cdn.jsdelivr.net,
       glTF-Transform from esm.sh, Google Fonts) use
       stale-while-revalidate — served instantly from cache, refreshed in the
       background. This is what lets the CDN-loaded three.js keep working on a
       plane. (True vendoring is still better; this is the client-side half.)
   Bump CACHE_VERSION whenever shell files change so clients pick them up.
   ============================================================ */
const CACHE_VERSION = 'pp-v79';
const CORE_CACHE = CACHE_VERSION + '-core';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';
const CDN_CACHE = CACHE_VERSION + '-cdn';

// App shell — everything needed to boot and open any tool with zero network.
const CORE = [
  './',
  'index.html',
  'theme.js',
  'support.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-maskable.svg',
  // tools
  'AutoRig.html',
  'Showcase.dc.html',
  'Playground.dc.html',
  'StreamStage.dc.html',
  'studio3D_scripts/playground-engine.js',
  'studio3D_scripts/showcase-engine.js',
  'MoCap.dc.html',
  'MeshEdit.dc.html',
  'Motion.dc.html',
  'Sculpt.dc.html',
  'Pose.dc.html',
  'Physics.dc.html',
  'Bake.dc.html',
  'Decimate.dc.html',
  'VAT.dc.html',
  'studio3D_scripts/vat-engine.js',
  'Stage.dc.html',
  'studio3D_scripts/stage-engine.js',
  'MeshDoctor.dc.html',
  'ShaderLab.dc.html',
  'Director.dc.html',
  'Lipsync.dc.html',
  'Timeline.dc.html',
  'Retarget.dc.html',
  'studio3D_scripts/retarget-engine.js',
  'studio3D_scripts/bone-map.js',
  'studio3D_scripts/vrm-export.js',
  'studio3D_scripts/spring-bones.js',
  'studio3D_scripts/passport-export.js',
  'studio3D_scripts/face-capture.js',
  'studio3D_scripts/wing-flap.js',
  'studio3D_scripts/glb-optimize.js',
  'studio3D_scripts/atlas-merge.js',
  'studio3D_scripts/nav-scheme.js',
  'studio3D_scripts/job.js',
  'studio3D_scripts/color-space.js',
  'studio3D_scripts/symmetry-map.js',
  'studio3D_scripts/sample-shapes.js',
  'Retopo.dc.html',
  'Recipe.dc.html',
  'Boolean.dc.html',
  'HairExtract.dc.html',
  'HairStudio.dc.html',
  'HumanGen.dc.html',
  'UVUnwrap.dc.html',
  'TexturePaint.dc.html',
  'WeightPaint.dc.html',
  'Morph.dc.html',
  'BakeMaps.dc.html',
  'Curves.dc.html',
  'Handbook.dc.html',
  'ToolContract.dc.html',
  'LibraryEdit.dc.html',
  'Privacy.html',
  'Terms.html',
  'Notices.html',
  'RigGuide.html',
  'PolyPotion Audit V.dc.html',
  'PolyPotion Audit VI - Sculpt.dc.html',
  // every remaining same-origin engine/worker/helper — “open any tool with
  // zero network” now actually holds (Audit V: CORE covered ~1/3 of engines)
  'studio3D_scripts/ao-engine.js',
  'studio3D_scripts/app.js',
  'studio3D_scripts/bakemaps-engine.js',
  'studio3D_scripts/chunk-loader.js',
  'studio3D_scripts/csg-engine.js',
  'studio3D_scripts/curve-engine.js',
  'studio3D_scripts/decimate-engine.js',
  'studio3D_scripts/director-engine.js',
  'studio3D_scripts/doctor-engine.js',
  'studio3D_scripts/edit-session.js',
  'studio3D_scripts/engine.js',
  'studio3D_scripts/exporter.js',
  'studio3D_scripts/fbx-export.js',
  'studio3D_scripts/human-body.js',
  'studio3D_scripts/lipsync-engine.js',
  'studio3D_scripts/mc-engine.js',
  'studio3D_scripts/mesh-engine.js',
  'studio3D_scripts/morph-engine.js',
  'studio3D_scripts/motion-engine.js',
  'studio3D_scripts/pack.js',
  'studio3D_scripts/physics-engine.js',
  'studio3D_scripts/pose-engine.js',
  'studio3D_scripts/pose-library.js',
  'studio3D_scripts/presets.js',
  'studio3D_scripts/qem.js',
  'studio3D_scripts/recipe-engine.js',
  'studio3D_scripts/remesh.js',
  'studio3D_scripts/retopo-engine.js',
  'studio3D_scripts/sculpt-engine.js',
  'studio3D_scripts/shader-glue.js',
  'studio3D_scripts/shader-lib.js',
  'studio3D_scripts/shaderlab-engine.js',
  'studio3D_scripts/skin-worker.js',
  'studio3D_scripts/support.js',
  'studio3D_scripts/template.js',
  'studio3D_scripts/texture-engine.js',
  'studio3D_scripts/thumbnailer.js',
  'studio3D_scripts/timeline-engine.js',
  'studio3D_scripts/uv-engine.js',
  'studio3D_scripts/uv-worker.js',
  'studio3D_scripts/wasm-mesh.js',
  'studio3D_scripts/wasm-physics.js',
  'studio3D_scripts/weightpaint-engine.js',
  // AutoRig's own module set (AutoRig.html was precached; its code was not)
  'rig_scripts/app.js',
  'rig_scripts/engine.js',
  'rig_scripts/fbx-export.js',
  'rig_scripts/presets.js',
  'rig_scripts/skin-worker.js',
  'rig_scripts/template.js',
];

// NOTE: keep in sync with the import maps + engine imports. cdn.jsdelivr.net
// carries three.js/addons/manifold/MediaPipe since the pp-v42 migration (its
// absence here broke offline — Audit V); storage.googleapis.com serves the
// MediaPipe model files.
const CDN_HOSTS = ['cdn.jsdelivr.net', 'esm.sh', 'fonts.googleapis.com', 'fonts.gstatic.com', 'storage.googleapis.com'];

// fetch that gives up after `ms` instead of hanging a tool forever on a
// stalled connection — callers fall back to cache (or error) on abort.
function fetchWithTimeout(req, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 15000);
  return fetch(req, { signal: ctl.signal }).finally(() => clearTimeout(t));
}

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CORE_CACHE);
    // add individually so one missing file can't abort the whole precache
    await Promise.all(CORE.map(u => cache.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => !k.startsWith(CACHE_VERSION)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.req || e.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  // cross-origin deps → stale-while-revalidate
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req, CDN_CACHE));
    return;
  }
  // only handle our own origin otherwise
  if (url.origin !== self.location.origin) return;

  // the user's asset library (characters/animations/pfp thumbnails, often chunked
  // and 60 MB+) lives under /data/ — never route it through the versioned runtime
  // cache: it bloats the cache and the reload+timeout dance turns a slow/absent
  // asset into a hard "ServiceWorker encountered an unexpected error". Let the
  // browser fetch these natively (the chunk-loader owns their ret/assembly).
  if (url.pathname.startsWith('/data/') || url.pathname.includes('/data/')) return;

  // the basic-human module is under active iteration → network-first so edits
  // show up on plain reload (cache only as offline fallback)
  if (url.pathname.endsWith('/studio3D_scripts/human-body.js')) {
    e.respondWith((async () => {
      try {
        const res = await fetchWithTimeout(new Request(req.url, { cache: 'reload' }), 10000);
        if (res && res.ok) { const c = await caches.open(RUNTIME_CACHE); c.put(req, res.clone()); }
        return res;
      } catch (err) { return (await caches.match(req)) || Response.error(); }
    })());
    return;
  }

  // navigations → cache-first on index, network fallback
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try { return await fetch(req); } catch (err) { return (await caches.match('index.html')) || Response.error(); }
    })());
    return;
  }

  // same-origin assets → cache-first, populate runtime cache
  e.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      // Populate the (versioned) runtime cache from the NETWORK, bypassing the
      // browser HTTP cache — otherwise a stale disk-cached copy of an engine/
      // script survives a CACHE_VERSION bump and clients never see the update.
      let res;
      try { res = await fetchWithTimeout(new Request(req.url, { cache: 'reload' }), 12000); }
      catch (_) { res = await fetchWithTimeout(req, 12000); }
      if (res && res.ok && res.type === 'basic') { const c = await caches.open(RUNTIME_CACHE); c.put(req, res.clone()); }
      return res;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetchWithTimeout(req, cached ? 8000 : 25000)
    .then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; })
    .catch(() => null);
  return cached || (await network) || Response.error();
}
