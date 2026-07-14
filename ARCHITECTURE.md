# PolyPotion — Architecture

PolyPotion is a **client-side, offline-first** 3D character pipeline. There is
no backend, no build step, and no bundler. Every file is served statically and
runs in the browser. This document maps how the pieces fit together so you can
find your way around — or add a tool — without reading everything.

---

## The big picture

```
index.html  ── the SHELL ─────────────────────────────────────────────┐
  • dock, command palette (⌘K), status bar, toasts                     │
  • Library (IndexedDB-backed) + the "active character" that follows   │
    you between tools                                                   │
  • hosts each tool in a lazily-created <iframe>                        │
  • WebGL context budget (evicts idle tool frames)                     │
  • service worker registration + install + backup/restore + export    │
                                                                        │
  ├── <iframe> Rig.dc.html ── AutoRig.html ── rig_scripts/*             │
  ├── <iframe> MoCap.dc.html ─────────────┐                            │
  ├── <iframe> Pose.dc.html               │  each tool is a standalone  │
  ├── <iframe> Sculpt / Edit / Physics    │  page that imports its      │
  ├── <iframe> Decimate / Bake / Boolean  │  engine from                │
  ├── <iframe> UV / TexturePaint / Hair   │  studio3D_scripts/*.js      │
  ├── <iframe> WeightPaint / Morph        │                            │
  ├── <iframe> BakeMaps / Curves          │                            │
  └── <iframe> HumanGen / HairStudio ─────┘                            │
                                                                        │
theme.js ── shared 5-theme engine, synced across every iframe ─────────┘
sw.js ── precache + runtime-cache service worker (offline)
manifest.webmanifest ── installable PWA metadata
```

## Folder map

| Path | What it is |
|---|---|
| `index.html` | The shell. Owns the Library, the active-character bridge, the dock, export, backup, and the service worker. |
| `theme.js` | The theme engine. Defines the CSS-variable palettes and syncs the choice across every iframe via `localStorage` + `postMessage`. Load it in every tool's `<helmet>`. |
| `*.dc.html` | One file per tool. Its markup + a small logic class; imports its engine dynamically. |
| `studio3D_scripts/*.js` | The engines — the actual 3D work (three.js). One `*-engine.js` per tool, plus shared helpers. |
| `studio3D_scripts/chunk-loader.js` | Fetches library assets, transparently reassembling chunked (Cloudflare-split) files. |
| `studio3D_scripts/exporter.js` | Universal export: GLB/glTF/OBJ/STL/USDZ/FBX/VRM + up-axis & unit-scale. |
| `studio3D_scripts/bone-map.js` | Humanoid bone dictionaries (Mixamo / UE5 / Rigify / VRM) + auto-detect. Shared by Retarget and VRM export. |
| `studio3D_scripts/vrm-export.js` | VRM 1.0 packager: humanoid map + ARKit-driven expressions into VRMC_vrm. |
| `studio3D_scripts/thumbnailer.js` | Renders a character GLB to a small PNG for Library cards. |
| `rig_scripts/` | The AutoRig solver used by `Rig`. |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA / offline. |
| `data/` | Bundled + user library (characters, animations, manifests). |
| `Handbook.dc.html`, `ToolContract.dc.html`, `Audit.dc.html` | In-app docs. |

## The three layers of a tool

1. **The `.dc.html` page** — UI + a logic class. Detects embedding, wires the
   message bridge, and drives the engine. Never does 3D math itself.
2. **The `*-engine.js` module** — a class that owns a three.js scene, renderer,
   and the actual algorithm. Imported dynamically so the tool paints before the
   engine (and three.js) finish loading.
3. **The shell bridge** — a handful of `postMessage` events, all tagged
   `{ __studio: true }`. This is the *entire* coupling between shell and tool.

## The active character

Whatever character you last opened becomes the **active character**. The shell
delivers it into each tool the first time you visit that tool (`deliveredTo`
tracks who already has it), so you never re-import. Tools hand results back
(`studio:saveChar`, `studio:routeBuffer`, `studio:riggedGLB`) and the shell
threads the new mesh through the same flow.

The lingua franca is **binary glTF (`.glb`) as an `ArrayBuffer`**, moved between
frames with transferables (not copied).

## Persistence & safety

- Characters live in **IndexedDB** (`_buffer` = the GLB).
- `navigator.storage.persist()` opts into durable storage; a quota meter and
  one-click backup/restore (`.polypotion` zip) guard against eviction.
- A `beforeunload` guard warns if in-memory work never reached IndexedDB.

## Performance notes

- Every tool iframe holds its **own WebGL context**. Browsers cap these, so the
  shell keeps an MRU budget of live frames and evicts idle, off-screen ones
  (re-delivering the active character on reopen). A lost context rebuilds that
  one workspace instead of going black.
- Heavy solves should run off the main thread where practical and always show a
  progress bar + cancel.

## What to read next

- **`ToolContract.dc.html`** — the message protocol in full, plus a copy-paste
  "Hello Tool" template. Start here to add a tool.
- **`CONTRIBUTING.md`** — how to run it, conventions, and the PR checklist.
