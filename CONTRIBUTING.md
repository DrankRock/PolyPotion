# Contributing to PolyPotion

Thanks for helping brew. PolyPotion is **free, open, client-side, and offline
-first** — every contribution should keep it that way.

## Ground rules (the non-negotiables)

1. **Stays on the device.** No servers, no analytics, no accounts. Anything that
   touches the network must be **opt-in and clearly labelled** (see how
   Text-to-Pose in `Pose.dc.html` badges itself `◉ NETWORKED`).
2. **No build step.** Files are served as-is. No bundler, no transpile, no npm
   runtime deps. ES modules + dynamic `import()` only.
3. **Offline must keep working.** If you add a tool or a dependency, add its
   filename to the `CORE` precache list in `sw.js`.
4. **Follow the theme.** Load `theme.js` and use its CSS variables so your UI
   restyles with the rest of the suite.

## Running it

It's static. Serve the folder with any static server so the service worker and
module imports work over `http(s)://` (opening `file://` won't register the SW):

```
# pick one
python3 -m http.server 8080
npx serve .
```

Then open `http://localhost:8080/`. For the WASM-threaded solvers (physics,
decimate, bake, UV) to use multiple threads, the host must send
`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: credentialless` (NOT require-corp — that breaks
the CDN loads). The ready-made `_headers` file at the repo root does this for
Netlify / Cloudflare Pages; `SECURITY_HEADERS.md` has the Cloudflare-in-front
recipe for GitHub Pages. The status bar shows `⚡ threads` when isolation is
active and `◷ 1-thread` when not.

## Adding a tool

Full details (message list, lifecycle, Hello-Tool template, the four shell
edits) live in **`ToolContract.dc.html`** — open it in the running app. In
short:

1. Create `YourTool.dc.html`. Load `theme.js`, detect embedding, and post
   `studio:ready` when your engine can accept a mesh.
2. Put the 3D work in `studio3D_scripts/yourtool-engine.js` and import it
   dynamically from the page.
3. Register it in `index.html`: the `TOOLS` map, a dock button, a stage pane,
   and (if it edits characters) the `CHAR_TOOLS` list.
4. Add both files to the `CORE` list in `sw.js`.

## Conventions

- **Speak GLB.** Accept and emit `.glb` as `ArrayBuffer`; parse with three's
  `GLTFLoader`.
- **Transfer, don't copy.** Pass big buffers in the `postMessage` transfer list.
- **Report errors** with `studio:error` so the shell can toast them.
- **Idempotent loads.** The shell may deliver the same character more than once
  (first visit, or after a frame was evicted) — clear your scene first.
- **Long operations** get a progress bar *and* a cancel button.
- **Undo.** Honour `Ctrl/Cmd-Z` inside your tool; keep a local history stack.
- **Inputs.** Support stylus pressure (`PointerEvent.pressure`, `pointerType`)
  on any brush; keep hit targets ≥ 44px.
- **Accessibility.** `aria-label` every icon-only control; keep visible focus.

## PR checklist

- [ ] No network calls added (or the new one is opt-in + labelled).
- [ ] No new npm runtime dependency; no build step introduced.
- [ ] New tool/engine files added to `sw.js` `CORE`.
- [ ] Works offline after one load (test with DevTools → Offline).
- [ ] Uses `theme.js` variables; looks right in all five themes.
- [ ] Loads a real `.glb` end-to-end without console errors.

## Licence

By contributing you agree your work ships under the project's licence
(`LICENCE`). Keep third-party assets you add to permissive/CC terms and note
their source.
