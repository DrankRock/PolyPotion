# Scene tool — integration plan

Bring the standalone **Room Designer** (`designer.html` + 14 `designer-*.js` +
`data/objects_*.js` + `rooms.js`) into PolyPotion as a new tool: **Scene**. It
composes an environment — room shell, plan-drawn walls, atmosphere — dressed
with prefab objects from the `OBJECTS` registry, primitives, lights, and
(new) characters delivered by the shell. It saves/imports as a compact JSON
"recipe" and can bake to GLB for handoff.

> PocketBase is out (`designer-cloud.js` dropped — server down). Save/load moves
> to local files + IndexedDB, matching the rest of PolyPotion.

---

## 1. The one hard constraint: two three.js worlds

| | Room Designer | PolyPotion tools |
|---|---|---|
| three.js | **0.137**, global `window.THREE` via `<script>` | **0.160**, ES modules via importmap |
| controls/loaders | `examples/js/*` (attach to `THREE.*`) | `three/addons/*` (ESM) |
| module style | IIFEs on `window._D` / `window.OBJECTS` | `*-engine.js` ES modules |

Porting the 14 designer modules **and** every `objects_*.js` factory to 0.160
ESM is large, risky surgery (`sRGBEncoding`→`SRGBColorSpace`,
`outputEncoding`→`outputColorSpace`, examples/js removed, etc.) for no user-facing gain.

**Decision: keep the Scene tool's 0.137 global world intact inside its iframe.**
The shell hosts each tool in its own iframe/realm, so a 0.137 global and the
0.160 modules never meet. The *only* thing crossing the boundary is a GLB
`ArrayBuffer`, which is version-agnostic data. This is Phase 0's spike.

---

## 2. How Scene fits the "active character" model

PolyPotion flows a **single active character** (GLB) between tools. Scene is
different — it's a **set-dresser** that holds *many* objects. So it's a
consumer/terminal, not a pass-through:

- **Characters → Scene.** On `studio:loadCharBuffer` / `studio:loadCharUrl`,
  drop the active character into the scene as a movable **actor** item. The
  designer already imports GLB via its own `GLTFLoader` (`finishImport`) — route
  the shell's buffer into that same path. This is the "use objects/characters in
  the scene" requirement.
- **Scene → pipeline.** Two exits:
  - `studio:saveChar` with a **baked GLB** of the whole scene (merged) → back to
    the Library / other tools. Loses editability; good for render/handoff.
  - The **`.ppscene.json` recipe** (below) as the editable save format.
- Overlap to resolve later: **Stage** animates a cast; **Scene** dresses the
  environment. Long-term, Stage could load a `.ppscene.json` as its set.

---

## 3. Save / import format

The designer already has three serializers of the *same* shape —
`captureSnap`/`loadFromSnap` (extras), history `capture`/`apply`, and the fullest
one, cloud `captureProject`/`restoreProject`. **Standardize on the cloud shape
(minus PocketBase) as canonical Scene JSON v1.**

Why this is already "the optimized format": objects are **parametric prefabs** —
a registered factory keyed by `type` + `opts`. We store the **recipe** (prefab
name + params + transform), never geometry. A 200-object scene is a few KB and
re-runs the factories on load. Only *arbitrary imported* meshes can't be
recipe-encoded.

```jsonc
{
  "format": "polypotion.scene",
  "version": 1,
  "meta": { "name": "…", "created": 0, "modified": 0, "generator": "scene/1" },
  "shell": { "W":6,"D":5,"H":2.8,"floor":"#4a3220","wall":"#2a2018","walls":"0","shape":"rect" },
  "floors": [ { "id":0,"name":"Ground","yBase":0,"height":2.8,"visible":true,
                "plan": { "vertices":[…], "segments":[…], "arcs":[…] } } ],
  "planSettings": { "thickness":0.18, "snap":0.25, "angleLock":45, … },
  "atmosphere": { "hour":14, "fog":{…}, "vignette":0, "grain":0 },
  "wallMode": "solid",
  "items": [
    { "kind":"prefab", "type":"cauldron", "opts":{"radius":0.25},
      "name":"cauldron_3","topic":"","t":[1,0,2],"r":[0,0.78,0],"s":[1,1,1] },
    { "kind":"prim","prim":"box","geomParams":{"w":1,"h":1,"d":1},
      "matType":"wood","color":"#8a6a40","t":[…],"r":[…],"s":[…] },
    { "kind":"group","children":[…],"groupMeta":{…},"t":[…] },
    { "kind":"light","light":"point","opts":{"color":"#ffd9a0","intensity":1,"distance":8},"t":[…] },
    { "kind":"char","ref":{"libId":"abc123"},"name":"Hero","t":[…] },  // Library actor by id
    { "kind":"import","glb":"<base64|omitted>","src":"models/foo.glb","t":[…] }
  ]
}
```

Rules:
- **Prefabs / prims / groups / lights** → recipe only (tiny, editable, diffable).
- **Library-character actors** → store by **`libId` reference**; the mesh stays
  in IndexedDB, the scene file stays small. Re-resolve on load.
- **Arbitrary imports** → reference a path, or embed the GLB only when the user
  explicitly wants a self-contained file.

Two save flavors:
- `.ppscene.json` — the recipe. **Default.**
- `.glb` — baked/flattened whole scene via `studio3D_scripts/exporter.js`, for
  handoff. Optional.

Optional later optimization: collapse repeated prefabs to
`{ type, opts, transforms:[…] }` (instance lists) → smaller files + a path to
GPU instancing.

Storage: a new **`scenes` IndexedDB store** (mirrors how characters live in
`_buffer`); extend the shell's `.polypotion` backup zip to include it. MVP can
ship with just file download/upload (the designer already does blob-download +
file-input) and add the store in Phase 2.

---

## 4. Files to bring in

| From (uploads/) | To (PolyPotion/) | Notes |
|---|---|---|
| `designer.html` | `Scene.html` | hide chrome when embedded; add bridge; drop cloud script tag |
| `designer-*.js` (13, **not** cloud) | `scene_scripts/` | verbatim; they attach to `window._D`/`window.OBJECTS` |
| `data/objects_*.js`, `rooms.js`, `dialogue.js` | `data/` | registry + prefab library |
| — | update `sw.js` CORE | precache Scene.html + scene_scripts/* + data/* for offline |

Registry dependency: `data/objects_core.js` **must load first** — it defines
`window.OBJECTS` with `register` + material helpers `M.*` + `_box/_cyl/_sph/_cone/_tor` +
`rand/pick/_c`. Every other `objects_*.js` is a self-contained IIFE that
destructures those. Verify `objects_core.js` before wiring (not in the sample set).

Modules dropped/replaced:
- `designer-cloud.js` — **removed** (PocketBase). Its `captureProject`/
  `restoreProject` logic moves into a small `scene_scripts/scene-io.js`
  (canonical schema + file + IndexedDB), reused by the topbar and the bridge.

---

## 5. Registering the tool (per ToolContract)

1. **`index.html` TOOLS map**
   `scene: { src: 'Scene.html?embed=1', frame:null, ready:false, label:'Scene' }`
2. **Dock button** `<div class="dock-item" data-tool="scene">…Scene</div>`
3. **Stage pane** `<div class="tool-pane" id="pane-scene"><div class="tool-loading" id="load-scene">…</div></div>`
4. **`CHAR_TOOLS`** — add `'scene'` so the active character auto-follows in.
5. **`sw.js` CORE** — add Scene.html + `scene_scripts/*` + `data/*`.

Bridge added to Scene.html (`window.parent !== window` or `?embed=1`):
- post `studio:ready {tool:'scene'}` once the engine + registry are up;
- on `studio:loadCharBuffer`/`loadCharUrl` → `finishImport` as a `char` actor
  (idempotent; survives re-delivery — clear the specific actor first);
- topbar gains **Save .ppscene.json / Open**, **Send scene to Library (GLB)**;
- `studio:error` on import/parse failures.

---

## 6. Phasing

- **Phase 0 — spike (½ day).** Iframe `designer.html` as-is inside the shell,
  chrome hidden, three 0.137 global running beside 0.160 tools. Confirm no
  realm conflict and that a delivered character imports and places.
- **Phase 1 — bridge + format.** `studio:ready`, `loadChar*` → actor,
  `scene-io.js` with canonical schema v1, topbar Save/Open `.ppscene.json`
  (port `captureProject`/`restoreProject`, strip PocketBase).
- **Phase 2 — registry + offline + storage.** Ship `data/`; SW precache;
  `scenes` IndexedDB store; extend backup zip.
- **Phase 3 — handoff + optimize.** Bake scene → GLB via `exporter.js` →
  `studio:saveChar`; Library-actor-by-id resolution; theme.js adoption
  (map designer `--accent/--bg/…` to PolyPotion vars); dedupe with Stage
  (Stage loads a Scene as its set).

---

## 7. Open questions for you

1. **Tool name** — "Scene", "Set", "Room", "Diorama"?
2. **Default save target** — local `.ppscene.json` file, or IndexedDB scenes
   store from day one?
3. **Characters in a scene** — reference by Library id (small file, needs the
   library present) vs embed GLB (portable, large)? Default id-reference.
4. **Scene ↔ Stage** — keep separate now, or make Stage able to load a Scene as
   its environment in Phase 3?
5. **Theme** — keep the designer's own dark/light palette for MVP, or map to
   theme.js immediately?
