# vendor/ — local dependency drop-in

The whole app now imports 3D deps through **bare specifiers** (`three`,
`three/addons/...`, `manifold-3d`) resolved by ONE `<script type="importmap">`
block that is identical in every tool document (`index.html`, `AutoRig.html`,
and every `*.dc.html`). Today that map points at jsDelivr:

```json
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/",
    "manifold-3d": "https://cdn.jsdelivr.net/npm/manifold-3d@3.2.1/manifold.js"
  }
}
```

## To go fully offline / local

**The easy way:** run `python fetch-vendor.py` from this folder (Windows-friendly,
stdlib only). It downloads the pinned three + manifold into the layout below,
flips the import map in every `*.html` doc from jsDelivr to `./vendor/...`, adds
the core files to `sw.js` CORE, and bumps `CACHE_VERSION` — all idempotent, and
the map only flips after the files are on disk. Then just tighten the CSP
(below) when you deploy. The manual steps that script automates are kept here
for reference:

1. Drop the real files in here so the tree looks like:
   ```
   vendor/three/build/three.module.js
   vendor/three/examples/jsm/**        (controls, loaders, exporters, utils,
                                        environments — the whole jsm folder;
                                        the addons import bare "three" + siblings)
   vendor/manifold-3d/manifold.js
   vendor/manifold-3d/manifold.wasm
   ```
   Get them from the npm packages `three@0.160.0` and `manifold-3d@3.2.1`
   (unpkg/jsDelivr tarball, or `npm pack`), preserving the folder layout above.

2. Flip the import map in every document to point here (paths are relative to
   each doc, which all live in the app root, so `./vendor/...`):
   ```json
   {
     "imports": {
       "three": "./vendor/three/build/three.module.js",
       "three/addons/": "./vendor/three/examples/jsm/",
       "manifold-3d": "./vendor/manifold-3d/manifold.js"
     }
   }
   ```
   One find-and-replace of the three URL lines across the HTML docs does it —
   no engine/JS file changes, because they only use bare specifiers.

3. Add the vendored files to `sw.js` `CORE` (or let the runtime cache pick them
   up) and bump `CACHE_VERSION`. Once local, drop the jsDelivr entries from the
   CSP `connect-src`/`script-src` in `SECURITY_HEADERS.md`.

## Still CDN-loaded (out of scope for this pass, both non-three)
- `mp4-muxer@5.0.1` (esm.sh) — Physics offline MP4 export.
- MediaPipe Tasks-Vision (storage.googleapis.com) — webcam face/pose capture.
  Both can be vendored the same way (add a map entry + drop the file) when needed.
