/* ============================================================
   sw.js — PolyPotion service worker
   Makes the suite installable and fully usable OFFLINE after the first visit.
   Strategy:
     • Core shell (index, theme, support, every tool HTML) is PRECACHED on
       install, so the app opens with no network at all.
     • Same-origin assets (engines, rig scripts, data, icons) are cached
       cache-first and added to a runtime cache the first time they're used.
     • Cross-origin deps (three.js from esm.sh, Google Fonts) use
       stale-while-revalidate — served instantly from cache, refreshed in the
       background. This is what lets the CDN-loaded three.js keep working on a
       plane. (True vendoring is still better; this is the client-side half.)
   Bump CACHE_VERSION whenever shell files change so clients pick them up.
   ============================================================ */
const CACHE_VERSION = 'pp-v4';
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
  // tools
  'AutoRig.html',
  'Showcase.dc.html',
  'MoCap.dc.html',
  'MeshEdit.dc.html',
  'Motion.dc.html',
  'Sculpt.dc.html',
  'Pose.dc.html',
  'Physics.dc.html',
  'Bake.dc.html',
  'Decimate.dc.html',
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
];

const CDN_HOSTS = ['esm.sh', 'fonts.googleapis.com', 'fonts.gstatic.com'];

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
      try { res = await fetch(new Request(req.url, { cache: 'reload' })); }
      catch (_) { res = await fetch(req); }
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
  const network = fetch(req).then(res => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
  return cached || (await network) || Response.error();
}
