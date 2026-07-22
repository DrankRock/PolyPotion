# PROGRESS.md — audit implementation tracker

## MULTI RIG — audit (2026-07-22, user ask: full audit + what to add)

New tool `multirig` (MultiRig.dc.html): a batch wrapper that HOSTS AutoRig.html in
an iframe and carries the joint placement from one character to the next. Rig ·
test · save (download) · next. Entry points: dock (rig group, "Multi"), palette,
and Library "⛓ Rig selection" (multi-pick cards → pre-filled batch). Files:
MultiRig.dc.html (new), rig_scripts/engine.js (+getJointLayout/applyJointLayout/
serializeAll), rig_scripts/app.js (AutoRigEmbed +loadFromBuffer/loadFromFile/
captureRig/applyRig), index.html (registry/dock/pane/library feed/mrFetch/
mrPreload/Rig-selection picker), sw.js → pp-v81.

### Shipped this pass (correctness fixes)
- [x] Carry as **per-axis bbox fractions** (feet-center origin), not absolute
      world coords — robust to modest width/height/depth differences, not just
      height. (engine _bboxFrame + frac capture/apply; absolute still read for
      back-compat.)
- [x] **Re-entrancy lock** (`_busy`) around start/save/next/saveNext/jumpTo so
      rapid clicks can’t interleave two loads/exports.
- [x] **removeFromQueue idx fix** — removing an item before the current one now
      shifts idx so the header/current pointer stays on the loaded mesh; the
      active item’s ✕ is blocked (Save/next or jump first) to avoid mesh/label
      desync.
- [x] captureCurrent **always** stores the last placement (apply still gated by
      the carry toggle).
- [x] Completion toast summarises saved/total.

### OPEN — recommended next (in value order)
- [ ] **Persist the batch** (queue + idx + captured layout + carry) to
      localStorage/OPFS. The frame is WebGL-heavy; the shell evicts idle frames,
      which today wipes an in-progress batch. Biggest robustness gap.
- [ ] **Stale `bound` badge**: AutoRig emits studio:bound on bind but nothing on
      "Back to placing joints" (unbind). Add a studio:unbound emit in AutoRig
      editJoints() → clear it.
- [ ] **Batch settings lock** in MultiRig (skinning Fast/HQ + res, preset,
      A-pose, facing, test clip): set once, applied to every character. Today
      they persist in the iframe by luck (module vars); the HQ modal also
      re-appears each bind.
- [ ] **Auto-test clip**: on each load auto-play a chosen clip so "test" is one
      glance (new embed hook driving AutoRig’s clip buttons).
- [ ] **Finish screen**: completion panel + "re-download all as .zip" + "add all
      to Library" (→ MoCap/Showcase/Stage).
- [ ] **Save options**: format choice (GLB/FBX/glTF) and "also add to Library /
      send to MoCap"; optional **auto-save** (bind → download → next) for
      near-identical bodies.
- [ ] **Skip** action (distinct from remove); **reorder** (drag) + clear-all;
      multi-select add.
- [ ] **Keyboard**: N = save & next, S = save, [ ] = prev/next.
- [ ] **Carry confidence**: per-joint delta vs auto-fit after applyRig, so
      outliers are obvious; offer per-character "auto-fit instead".
- [ ] **Buffer cache** by id so jumping back doesn’t re-fetch/re-chunk.
- [ ] **Load-fail UX**: inline retry/skip instead of AutoRig’s dropzone showing
      through.
- [ ] **Deep integrations**: batch → Retarget / Decimate-LOD / VRM export.


## NEXT SESSION — the "Model" workspace: merge Sculpt + Edit (user ask 2026-07-20)

**Why:** they're split because their data models genuinely conflict — Sculpt
welds all verts into one continuous clay surface and treats topology as
disposable (constant re-weld/rebuild, per-corner identity destroyed); Edit
keeps discrete triangles/edges/verts as selectable elements (selection sets,
tris/quads pairing, UVs all depend on that identity Sculpt throws away). Same
boundary Blender draws between Sculpt Mode and Edit Mode. The real defect isn't
the split — it's that switching tools makes you re-pick the character. Fix =
one workspace, two modes, ONE shared mesh, live handoff.

### Target design
- **New tool `model` (Model.dc.html)** replacing the separate Sculpt + Edit dock
  entries with a single entry that hosts both as tabs. Keep `sculpt`/`edit`
  registry rows working as deep-links (open Model on that tab) for back-comEdit,
  palette, and existing studio:gotoTool routes.
- **Shared mesh owner.** Model.dc.html owns the loaded GLB + THREE scene/camera
  once. Sculpt and Edit become *interaction controllers* over the same mesh,
  not two engines that each load their own copy. Refactor sculpt-engine.js and
  mesh-engine.js/edit-session.js to accept an injected {scene, camera, renderer,
  mesh} instead of building their own (both already take an engine/element ref —
  formalize a SharedMesh handle).
- **The hard part — representation bridge (this is the whole job):**
  - Sculpt→Edit: when entering Edit, (re)derive the element graph
    (edit-session._build) from the current sculpted positions. Cheap; already
    exists — just point it at the shared buffer.
  - Edit→Sculpt: when entering Sculpt, re-weld the (possibly retopo'd/extruded)
    mesh into sculpt's unique-vert + corner arrays (sculpt _ingest/_build).
    Also cheap; already exists.
  - **Dirty-tracking + one undo stack.** Today each tool has its own undo. Unify
    into a single history on the SharedMesh: snapshot {positions, corner/index,
    (UV, mask)} at each op regardless of which mode made it. Topology changes
    invalidate the other mode's caches (Edit's _vertNbr/_quadDiag, Sculpt's
    adjacency/mirror) — wire cache-bust on the shared "topologyChanged" signal.
  - **UV/material preservation across the bridge.** Sculpt's weld drops UV seams
    (Audit VI CRIT, mitigated at export pp-v77). In a live Sculpt⇄Edit loop this
    bites harder — moving to Edit after a sculpt topology change and back must
    not silently regrade UVs. Carry the source material + a "UVs valid?" flag on
    SharedMesh; warn once when a topology op invalidates them.
- **UI:** Model workspace = shared viewport + a mode switch (Sculpt | Edit) in
  the header; each mode swaps its own side panel (the current Sculpt brush panel
  / Edit select+topology panel, lifted mostly as-is). Turntable/wire/matcap view
  chrome is shared. Persona map: `sculpt` persona → Model on Sculpt tab.
- **Registry/Handbook/sw:** one `model` entry (+ deep-link aliases), Handbook
  entry documenting the two modes, sw CORE keeps both engines.

### Sequencing (own session)
1. SharedMesh handle + refactor both engines to accept injected scene/mesh
   (no behaviour change; Sculpt.dc.html + MeshEdit.dc.html still work).
2. Model.dc.html shell: shared viewport, mode tabs, panel swap, deep-links.
3. The bridge: enter-Edit derive graph, enter-Sculpt re-weld, unified undo,
   cache-bust signal, UV-valid flag + one-time warn.
4. Retire Sculpt/Edit dock entries → aliases; persona + Handbook + registry.
5. Verify the full loop: sculpt → Edit (extrude/clean) → sculpt (detail) →
   export still textured. This is the acceptance test.

**Risk:** the bridge's re-weld/derive round-trip must be lossless enough that
repeated mode-switching doesn't drift positions or explode tri count. Prototype
that round-trip FIRST (step 3 before polishing 2's UI).

---

## EARLIER QUEUE — Chapter V repairs, in order (see `PolyPotion Audit V.dc.html`)

### QUEUED FIRST: Sculpt "new Blender" pass (user ask 2026-07-20) — full spec in todos
Engine (sculpt-engine.js): crease/clay-strips/scrape/snake-hook/layer brushes;
REDO stack; falloff curves; pressure→radius. Local detail: dyntopo-lite
(edge-split under brush), mask blur/grow/shrink, Y/Z symmetry. UI: brush
hotkeys, matcaps, reference-image overlay, before/after. Then a sculpt-focused
audit chapter — known finds already: undo history WIPED on subdivide
(_rebuildFromUnique does _undo=[]), export drops UVs/materials (texture loss on
roundtrip!), O(n) dab gather needs spatial hash past ~200k tris, remesh.js
exists but unwired, displacement→normal-map bake via BakeMaps is the killer
missing feature.

Chapter V (2026-07-19) is a fresh full-solution sweep: shell, sw, manifest,
docs, seams. Engines are healthy; the breaks are all at the shell/PWA layer.
Fix in this order — items 1–3 are the CRIT/BUG tier, all in index.html/sw.js:

- [x] **1. Un-nail the doors (CRIT, S)** — **SHIPPED pp-v66** — `setTool()`'s pane array in
      index.html (~line 1054) omits `playground` and `live`: BOTH flagship
      tools are unreachable (pane never shows, frame never mounts). Replace the
      literal array with `Object.keys(TOOLS)`.
- [x] **2. Fix offline (CRIT, S)** — **SHIPPED pp-v66 (CDN_HOSTS)** — sw.js `CDN_HOSTS` still lists esm.sh only;
      the pp-v42 import-map migration moved three.js/manifold/MediaPipe to
      cdn.jsdelivr.net, which the sw passes through UNCACHED → every 3D tool
      dies offline. Add `cdn.jsdelivr.net` + `storage.googleapis.com`, bump
      version. Durable fix: run vendor/fetch-vendor.py (step 2/2, needs network).
- [x] **3. Shell undo ReferenceError (BUG, S)** — **SHIPPED pp-v66** — palette IIFE's Ctrl+Z/Y
      handler references `activeTool`/`TOOLS` that live in the other IIFE;
      throws on every press. Expose `Studio.activeTool` getter, use `S.TOOLS`.
- [x] **4. Bugs (S each)** — **SHIPPED pp-v66 (all three)** — Animations-tab Import button does nothing (no
      else-branch in #libFile handler; route clips → Retarget); library cards
      inject `it.label`/tags via innerHTML (self-XSS — escape at card boundary);
      Stream Stage popout handshake dangles (`stage:popout-ready` has no
      listener — rebroadcast studio:loadCharBuffer from the embedded frame).
- [ ] **5. Tool registry (M)** — one TOOL_REGISTRY generates dock/palette/
      TOOLS/CHAR_TOOLS/panes/stHint (+ stamps sw CORE). Do BEFORE GUI phase 2.
- [x] **6. PWA honesty (S–M)** — **SHIPPED pp-v70–71 (icons SVG, What's New
      unfrozen, tour step 4, full engine+docs precache; PNG icons/social card
      still owed — canvas sandbox down)** — real icons (manifest 404s block the install
      prompt entirely; render the boot-splash flask to 192/512/maskable);
      precache the missing ~28 engines + rig_scripts/* + exporter/chunk-loader/
      pack/thumbnailer + legal/docs pages; PP_VERSION frozen at 0.9 → derive
      from CACHE_VERSION so What's New fires again.
- **USER tests owed (one live session)**: deploy `_headers` → Draco export →
  OPFS persist → VSeeFace 0.x round-trip → popout+OBS → Playground pad feel.

## PREVIOUS SESSION — the face plan (Chapter IV). SHIPPED in full (Brews 6–10).

Plain-English context: “VTubing” = streaming as an animated character; the
webcam moves the character’s face. Our characters export as .vrm avatars, but
four small exporter bugs make them look lifeless in the apps VTubers use
(VSeeFace etc.), and we have no “go live” screen. Full detail per item lives
in `PolyPotion Audit IV — Face.dc.html`.

- **Brew 6 — exporter fixes** (all in studio3D_scripts/vrm-export.js):
  a) look* + surprised presets from eyeLook*/eyeWide morphs (fixes dead eyes);
  b) PerfectSync: expressions.custom — one clip per ARKit morph (~15 lines);
  c) VRM 0.x serializer + 1.0/0.x choice in the export dialog;
  d) firstPerson.meshAnnotations (face-morph mesh = thirdPersonOnly), reuse to
     hide head in Playground POV.
- **Brew 7 — capture** (face-capture.js + its tool UI):
  a) enable head-pose matrices → drive neck/head bones (+ amplitude/smoothing);
  b) Calibrate-neutral + per-group gain; c) Record-to-clip → animation library
  (copy lipsync bake pattern); d) Auto-life layer (blink/eye-drift/breathing).
- **Brew 8 — Stream Stage “Go Live” tool** (the flagship): Showcase renderer +
  capture + mic fallback + auto-life, chroma backdrop, pop-out window for OBS,
  hide-UI hotkey, framing presets; wire into shell like Playground was.
- **Brew 9** — a) VRM import (round-trip); b) VTuber preflight pass/fail card.
- **Brew 10 (own brew)** — spring bones (hair sway): tag chains, verlet
  preview, export VRMC_springBone / secondaryAnimation.
- **USER tests owed**: Draco export, OPFS persist, Playground feel (pp-v57).

Companion to `PolyPotion Audit.dc.html` (the consolidated audit — the two
earlier chapter documents are retired). **This file is the source
of truth for what's shipped vs. pending.** If you (a future Claude or human)
implement a finding: update the checkbox here, add a line to the log, flip the
`done: true` flag on the finding in the audit's logic class, and pick the next
five in "UP NEXT". Chapter I is fully done except the items the consolidated
audit lists under Platform hardening / Audience — don't reopen the rest.

## How things are wired (read before implementing)

- Tools are `*.dc.html` files (custom DC runtime via `studio3D_scripts/support.js` —
  older than the current spec, deliberately kept) + a lazy-imported engine in
  `studio3D_scripts/*-engine.js`.
- The shell `index.html` registers each tool 5×: pane div, TOOLDEFS (command
  palette), FRAMES (iframe src), CHAR_TOOLS (receives active character), the
  postMessage wiring list, plus a dock item. Grep for `retarget` to see all spots.
- Active character travels as GLB over postMessage (`studio:loadCharUrl` /
  `studio:loadCharBuffer`).
- `sw.js`: add new files to PRECACHE and **bump CACHE_VERSION**.
- Shared humanoid logic lives in `studio3D_scripts/bone-map.js` (slots,
  dictionaries, auto-detect, VRM validation) — reuse it, don't fork it.

## DONE (shipped July 2026)

- [x] **Animation retargeting** — new Retarget tool (`Retarget.dc.html` +
      `retarget-engine.js`). Auto bone-map (Mixamo/UE5/Rigify/VRM + fuzzy),
      SkeletonUtils.retargetClip, hip-height root scaling, side-by-side sync
      preview, GLB export. Registered in dock/palette/frames/sw.
- [x] **ARKit 52 blendshapes** — `MorphEngine.addARKitSet()` in
      `morph-engine.js` + "⚗ ARKit 52 set" button in `Morph.dc.html`. Creates
      all 52 named targets at 0, seeds 6 big shapes via region heuristics +
      side masking.
- [x] **Landmark-guided ARKit ("Guided ARKit…")** — user clicks 5 points
      (chin, mouth corner, nose, eye, brow); `_generateARKitFromLandmarks()`
      synthesizes all 52 shapes anchored to them (gaussian regions scaled by
      eye distance, jaw as real rotation about an inferred hinge, auto side
      masking). Never overwrites shapes the user already sculpted. Flow:
      `startLandmarks()` → clicks land in the pointerdown handler →
      `onLandmarksDone` callback; prompt banner in `Morph.dc.html`.
- [x] **VRM 1.0 export** — `vrm-export.js` (GLB JSON-chunk surgery: VRMC_vrm
      humanoid + expressions mapped from ARKit morph names + meta/lookAt).
      Wired as a `vrm` format in `exporter.js` FORMATS. Validates required
      bones, reports missing.
- [x] **ORM pack + normal convention** — `BMEngine.packORM()` and
      `setNormalConvention('opengl'|'directx')` in `bakemaps-engine.js`
      (green-channel flip applied at bake time); "Game-ready" panel in
      `BakeMaps.dc.html` with convention segmented control + rough/metal
      sliders; ORM appears in map previews.
- [x] **WebXR view-in-your-room** — `xrSupport()` / `startXR(mode)` in
      `showcase-engine.js` (AR hit-test reticle + tap-to-place at 1:1,
      VR fallback, stage strip/restore on session end); button in
      `Showcase.dc.html`; iframe `allow` gained `xr-spatial-tracking`.

## UP NEXT (the second brew — five recommendations)

- [x] **1. Skeleton presets & bone-name maps on export** — `SKELETON_TARGETS`
      + `renameSkeleton()` in `exporter.js` (renames bones AND animation track
      bindings via `bone-map.js#renameForTarget`); "Bone naming" chip row in
      the Export dialog (hidden for geometry-only formats and VRM, which
      renames itself). Export toast reports renamed count.
- [x] **2. LOD chain generation** — `DEEngine.makeLODs(ratios)` in
      `decimate-engine.js`: decimates the ORIGINAL at 100/60/30/12%, packs one
      GLB with meshes named `<name>_LOD0..3` (Unity LOD Group / Unreal
      convention). "▣ Make LODs (.glb)" button in `Decimate.dc.html`.
- [x] **3. Expression & emotion library** — expression store in
      `morph-engine.js` (`loadExpressions` / `saveExpression` /
      `deleteExpression` / `applyExpression` / `captureExpression`),
      localStorage key **`pp-expressions`** (shared contract — Lipsync/Pose
      should read the same key), 10 starter presets (blink, 4 emotions,
      4 visemes, neutral). Chip board at the top of Morph's right panel:
      click applies, right-click deletes saved ones, ⊕ Save captures the
      current slider mix.
- [x] **4. Unit & scale validator** — `validateScale()` + `checkGLB()` in
      `exporter.js` (bbox height vs human range, mm/cm/×100 detection with
      suggested fix multiplier, non-uniform scale warning); pre-flight panel
      in the Export dialog with a one-click "Fix: scale ×N" button.
- [x] **5. Character passport** — `passport-export.js`: one self-contained
      .html (embedded base64 GLB + a hand-written zero-dependency WebGL viewer
      — no CDN three.js, so it truly opens offline anywhere — + stats grid +
      credits/licence footer). The ⤓ button inside re-downloads the embedded
      GLB, so the passport doubles as the asset carrier. Wired as a `passport`
      format in the Export dialog (author input + licence chips appear for it;
      scale slider/validator fix honoured via re-pack, always Y-up). Stats
      (tris/verts/bones/morphs/materials/anims/size) come from the GLB JSON
      chunk; height is measured live by the viewer. Deviation from the plan:
      lives in Export (the one exit door), not Showcase.

## SHARED CONTRACTS (cross-tool consistency)

- **`nav-scheme.js`** — the ONE camera-navigation map for every tool. Each
  engine built its own OrbitControls, so the mouse map had drifted: most tools
  inherited the three.js default (LEFT=orbit, RIGHT=**pan**) while retopo had
  remapped RIGHT=orbit — so right-drag meant "pan" in one tool and "orbit" in
  the next. `applyOrbitScheme(controls, THREE, {leftDisabled})` now sets
  **RIGHT=orbit, MIDDLE=pan, wheel=zoom** everywhere; LEFT=orbit in viewer
  tools and the tool action (pen/brush) in edit tools. Wired into all 24
  `*-engine.js` OrbitControls; retopo calls it per-mode; texture paint gated to
  the left button so right-drag orbits even in a brush mode. sw.js → pp-v35.
  When adding a tool: call `applyOrbitScheme` right after `new OrbitControls`.

- **`symmetry-map.js`** — the ONE symmetry contract. Morph, Sculpt and Weight
  Paint each built their own X-mirror vertex map at a different hard-coded
  quantisation (220 / 4000 / 250), so "mirror X" welded at a different real
  tolerance in each. `buildMirrorMap(positions)` returns a vert→mirror
  Int32Array + onAxis flags at a **scale-relative** tolerance (1/2000 of the
  bbox diagonal), identical everywhere; `mirrorBonePartners(names)` resolves
  L/R bone twins. Wired into morph `_buildMirror`, sculpt `mirrorIdx`,
  weightpaint `mirror()` / `_mirrorBoneMap`.

- **`color-space.js`** — the ONE colour-management contract (see 2026-07-16 log).

## UP NEXT (the third brew — five recommendations)

- [x] **1. GLB compression + material extensions on export** —
      `glb-optimize.js`: Draco or meshopt via glTF-Transform (esm.sh), with
      dedup + prune passes; "Compression" chip row (None / meshopt / Draco) in
      the Export dialog for GLB; toast reports before → after MB. KHR material
      extensions were already written by three's GLTFExporter from ShaderLab's
      MeshPhysicalMaterials (transmission/volume/clearcoat/sheen/iridescence —
      verified round-tripping through compression). **meshopt is verified**
      (29% on the test mesh). **Draco is wired but UNVERIFIED**: the encoder
      is three's plain-JS build via `esm.sh/...draco_encoder.js?raw` (the
      draco3dgltf npm build is node-only — fs.readFileSync; jsdelivr is
      unreachable from the sandbox). Load + init are timeout-guarded (20s/15s,
      clear error suggesting meshopt) after an emscripten-thenable hang froze
      the preview during testing. TEST DRACO FIRST on a live session before
      trusting it.
- [x] **2. Texture atlas + material merge** — `atlas-merge.js`: an Export
      toggle ("Atlas & merge materials", GLB/glTF/FBX/USDZ) that packs every
      material's baseColor / normalMap / roughness-metalness / emissive into
      shared grid atlases, rewrites each mesh's UVs into its atlas cell
      (per-group, world-baked for static; bind-space for skinned), and merges
      geometries sharing a skeleton (or none) into ONE mesh + ONE material via
      three's mergeGeometries. Toast reports draw/material counts before→after.
      Groups by skeleton identity so mixed-skeleton scenes stay safe.
      **Verified**: 5 meshes/5 materials/5 textures → 1/1/1, round-trips
      through GLB, each mesh keeps its correct cell + PBR values.
- [x] **3. Webcam face capture → ARKit shapes** — `face-capture.js` wraps
      MediaPipe Tasks-Vision FaceLandmarker (CDN, cached by the sw runtime
      cache; camera processed fully on-device). Its blendshape names are the
      ARKit 52, so scores stream straight into `applyExpression()`. ◉ Capture
      button + mirrored preview in Morph's right panel; requires the ARKit set
      first; stop = freeze → ⊕ Save as expression. Panel re-renders throttled
      while live. Follow-up: record takes to an animation clip.
- [x] **4. Pose mirror + pose library** — mirror already existed in Pose;
      added the saved-pose shelf: `capturePose()`/`applyPoseData()` in
      `pose-engine.js` (canon-key → local quaternion snapshots), localStorage
      **`pp-poses`** (shared contract), shelf UI in `Pose.dc.html` (click
      apply / right-click delete / ⊕ Save), and the local Text-to-pose matcher
      checks saved names first.
- [x] **5. In-viewport IK handles in Pose** — `pose-engine.js` + `Pose.dc.html`.
      First fixed a syntax break (`_buildPoles` had been nested inside
      `_buildHandles` — Pose wouldn't load). Then built the real feature on top
      of the existing CCD IK: **pole targets** (violet octahedron per limb;
      drag to steer elbow/knee bend — rotates the chain root about the
      root→effector axis, so the effector never moves) and **pin-to-world**
      (⊕ Pin on a selected IK effector locks that foot/hand; `_holdPins`
      re-solves pinned chains after any pose change so a planted foot stays put
      while you move the hips). Yellow ring marks a pin; "Show bend poles"
      toggle; pins clear on reset / preset / saved-pose / new model. **Verified**
      in a harness: engine loads, 14 handles + 4 poles, IK reaches, pole swings
      the knee 0.056 with the foot fixed, pin holds a reachable move (drift
      0.137 → 0.026). Residual on over-extension is physically correct (a
      straight leg can't reach a foot planted beyond its length).

## THIRD BREW COMPLETE — fourth brew picked (see PolyPotion Audit · "Now")

- [ ] **1. Colour-management contract** (M) — FIX — **SHIPPED** (see log)
- [ ] **2. Symmetry as a shared contract** (M) — FIX — **SHIPPED** (`symmetry-map.js`)
- [ ] **3. Vendor three.js + loaders + WASM locally** (M) — also fixes the Draco/esm.sh fragility
- [ ] **4. COOP/COEP headers on the host** (S) — **SHIPPED** (`_headers` + docs)
- [ ] **5. Bundle 2–3 CC sample characters** (S)

## BIG BETS (new machinery — pick at most one per brew)

- [x] **Vertex Animation Textures (VAT) bake** — new **VAT** tool (`VAT.dc.html`
      + `vat-engine.js`). Samples the active clip at N frames and writes each
      vertex's WORLD position (+ optional normal) into one texel — column =
      `gl_VertexID`, row = frame — bounds-normalized so 8-bit RGB carries it.
      Handles **skinned** (`applyBoneTransform`), **morph** (weighted target
      blend) and **rigid** (matrixWorld) meshes; per-frame normals recomputed
      from the skinned positions. The viewport plays the bake through a GLSL3
      `ShaderMaterial` (`gl_VertexID` lookup, no `AnimationMixer`, no skeleton
      in the graph) with a Source↔Baked toggle to compare against the real
      rig. Export pack = position PNG (+ normal PNG) + static mesh GLB + JSON
      report (decode bounds/fps) + README carrying the ready-to-paste shader.
      Registered in dock (animate group) / palette / frames / CHAR_TOOLS /
      sw. **Verified in a harness**: 115×32 bake of a 2-bone bend, decode vs
      independent skinning within 0.004 (< 1 quantization step), smooth arc
      captured (tip travels 1.01 across the clip), shader compiles glError-free,
      pack emits all files. sw.js → pp-v38.
- [x] Multi-character scene assembly (stage) — **SHIPPED** (`Stage.dc.html` + `stage-engine.js`)
- [ ] Local-network live co-op (WebRTC) — last of the four big bets

## REMAINING (backlog, from the audit — pick into UP NEXT as slots free up)

- [x] Vertex Animation Textures (VAT) bake — **SHIPPED** (see BIG BETS)
- [ ] Colour-management contract (linear working space, sRGB/data tagging, view transform)
- [ ] Symmetry as a shared contract (one symmetry map for all brush tools)
- [ ] Multi-character scene assembly (stage)
- [ ] Local-network live co-op (WebRTC)

## CHAPTER III (July 18 full-solution sweep — see `PolyPotion Audit III.dc.html`)

New audit document written from a fresh code sweep (shell, sw, engines, docs).
19 findings + 11 small follow-ups, four stories:

- **Reach (fix the door):** touch/tablet support (nav contract is mouse-only,
  shell has no breakpoints); self-host the Google Fonts (~30 files, offline +
  no-tracking integrity); sw CORE precache holes (engines, suggested_actions.js,
  docs, LibraryEdit); a11y pass (carried).
- **Plumbing (found in the sweep):** one tool registry instead of 6 hand-edited
  lists (LibraryEdit already fell out of the app entirely — orphaned, referenced
  nowhere); frame eviction can silently discard unsaved tool state (needs a
  studio:suspend dirty-check); Library UI won't scale to the user's hundreds of
  characters (virtualize + tags/recents); no global error surface (toolError →
  toast + reload); Draco + OPFS still owe live-origin verification.
- **Dialects (import parity):** VRM import, BVH mocap import → Retarget,
  STL/PLY in the drop zone, KTX2 texture compression on export.
- **Toy box (the fun bet):** Playground WASD test-drive (flagship — proposed as
  the next big bet), Sprite Studio (spritesheets/GIF for 2D devs), bone-socket
  dress-up, ragdoll in Physics, Photo Booth, library "Surprise me" roulette.

Suggested fifth-brew shape: reach items first (small, compound), then registry +
library-at-scale, then the Playground as the big bet.

## NEXT SESSION — GUI separation, phase 2 (planned 2026-07-19)

Phase 1 (SHIPPED, pp-v65): dock regrouped — loose pile gone. Top: Library,
Show (universal). Groups: create / shape / surface / rig / animate (+ Director
moved here from perform) / **vtube** (MoCap, Lipsync, Live) / **play**
(Playground). Scene stays pinned bottom. Collapse persistence + auto-open are
generic (data-cat), so no JS changes were needed.

Phase 2 ideas, in order of value:
1. **Workspace presets** — a row of persona chips above the dock: Sculptor /
   Rigger / Animator / VTuber / Player. Clicking one collapses every group
   except its own (pp.dockcat.* cookies already exist — a preset is just a
   batch of those), highlights its primary tool, and sets the Library's
   default open-target (e.g. VTuber → double-click a character opens Live,
   not Showcase). ~1h, zero new architecture.
2. **Onboarding fork** — first-run dialog “What are you here for?” (sculpt /
   rig / animate / vtube / play) → applies the matching preset so newcomers
   see 5 tools, not 30.
3. **Per-group accent tints** — subtle hue per category on dock items (the
   audit's “one registry” refactor is the right moment; don't hand-paint 30
   items before then).
4. Do this ON TOP of the tool-registry consolidation (still open) — the
   registry should carry {group, personaPresets} per tool so dock, palette
   AND presets generate from one list.

## Log

- 2026-07-22 — **Stage per-actor live LOD swap + theme contrast fix (pp-v86)**.
  STAGE LIVE LOD: engine.swapActorLOD already shipped; wired the DC driver.
  addUrl now captures the actor id and, when the char carried ≥2 rungs, registers
  _lodMeta[id]={rungs,curPct}. One scene-wide FPS controller (synthetic ladder
  100/70/45/25, targetFps 42, own rAF dt loop) primes to the device tier; on each
  target change _applyStageTarget(pct) swaps every LOD-capable actor to ITS nearest
  rung ≤target via fetchLODBuffer + swapActorLOD (preserves holder transform/
  selection/clip), guarded by _applying. Actors without LODs untouched; meta is
  dropped on remove. stage-engine import bumped v40→v41. Verified: engine has
  swapActorLOD, all DC hooks present, Stage loads clean.
  THEME FIX: light-purple text (#c9cdf6, a leftover from the old dark palette) sat
  on --accentDim info boxes/buttons — unreadable on the light themes (Cute Light,
  Meadow). Replaced #c9cdf6→var(--text) and dark accent ink #0d0f1f→var(--on-
  accent) across 8 DCs (30 literals): BakeMaps, Curves, Decimate, Morph, Retarget,
  Stage, VAT, WeightPaint. Now readable in every theme. Files: Stage.dc.html,
  + the 8 DCs, sw.js. Remaining LOD backlog: none critical.


- 2026-07-22 — **Decimate: textures + LOD-set export fix (pp-v85)**. Two user bugs.
  (A) LOD SET EXPORTED ONLY ONE FILE: makeLODFiles clicked N anchors staggered,
      but browsers block multiple programmatic downloads — only one landed.
      FIX: bundle every rung GLB + manifest snippet into ONE .zip (store-only
      writer with CRC32 in the DC, _zipStore) → single download name_LODset.zip.
      Verified: 3 rungs → 3 distinct files 80k/50k/27k + valid zip (EOCD/central
      /local sigs, 2+ entries round-trip).
  (B) NO TEXTURE in view or output: the whole decimate pipeline was position-
      only (baked to one gray blob, dropped UVs + materials). REWRITE:
      • qem.js: UV-aware — decimateMesh(pos,target,{uv}) welds by pos+uv (seam-
        aware), lerps UV along each edge collapse, returns a uv array. No uv arg
        = old behaviour. Verified uv length matches out tris.
      • decimate-engine.js: rewritten around per-MATERIAL surfaces {position,uv,
        material}. Keeps each source material/texture (cloned, double-sided),
        decimates each surface with UV, rebuilds a mesh per surface. Textures
        show in the viewport and survive export.
      • New "Texture" toggle (viewport show/hide; output always keeps it) beside
        Wireframe.
      • New "Download .glb (keeps texture)" primary export (exportGLB embeds
        maps via GLTFExporter). OBJ kept as geometry-only secondary.
      • makeLODs (packed) + makeLODFiles now build groups with the REAL textured
        materials, so every LOD carries its texture. Verified: load textured GLB
        → surfaces w/ uv, textured=true; after decimate mesh keeps uv + map;
        exportGLB + LOD files all produced.
  Note: textured GLBs are naturally larger (texture embedded per file); expected,
  user accepts. Files: qem.js, decimate-engine.js (rewrite), Decimate.dc.html, sw.js.
  RESOLVED priority-1 (LOD set export). Still open elsewhere: Stage per-actor live
  LOD swap (engine.swapActorLOD shipped, DC driver spec’d in todos, deferred).


- 2026-07-22 — **LOD polish (pp-v84)**: 3 asks.
  1. Persist manual LOD choice: lod-runtime takes storageKey ('pp-lod:'+path);
     picker writes the pinned pct / clears on AUTO. On reload it restores the
     saved rung as the INITIAL load (no 100→saved flash) and stays manual.
     Verified: pin 50 → saved "50" → next attach loads 50 first, auto off.
  2. Library card LOD badge: shows "LOD N" (blue) with a tooltip listing the rung
     %s, when a manifest entry has lods.
  3. Decimate rung chips show an estimated file size (~56 B/tri of origTris×pct)
     next to each %, so you see roughly what will chunk before exporting.
  Files: lod-runtime.js, index.html, Decimate.dc.html, Showcase/Playground, sw.js.
  (Skipped #4 lodgroup --report per user.) Remaining: Stage live per-actor swap.


- 2026-07-22 — **Manual LOD picker (pp-v83 cont.)**. lod-runtime.attach now takes
  an optional mount (selector/el) and builds a floating in-viewport picker: AUTO +
  one chip per rung (shows tris in the tooltip). AUTO = fps-driven; clicking a rung
  pins it (setAuto(false)+setManual); the auto-picked rung is outlined while in
  AUTO. Mounted in Showcase (#sc-root) and Playground (#pg-root); disposed with the
  controller on the next load. Verified: picker builds, manual pin → 10%, AUTO
  restores auto, initial load finest. Files: lod-runtime.js, Showcase/Playground.
  STILL OPEN: Stage live per-actor LOD swap (static device-tier pick per actor
    still stands) — deferred as reloading one actor among many needs careful
    engine work; the safe static path ships.


- 2026-07-22 — **LOD runtime auto-switch wired (pp-v83)**. Stage / Playground /
  Showcase now consume the LOD schema; plain imports with no lods are untouched.
  • lod-runtime.js (NEW, window.LODRuntime.attach): hands a viewer’s rung list +
    a load(rung,first) cb to the FPS controller, runs its own rAF dt-probe, swaps
    rungs on sustained lag / headroom. <2 usable rungs → plain single load, no
    probe (so drag-drop / imports behave exactly as before).
  • Showcase + Playground: studio:loadCharUrl → _loadUrlLOD(d). If d.lods has
    ≥2 rungs it lazy-imports lod-switch+lod-runtime, loads finest first, then
    auto-reloads a coarser rung via eng.loadUrl when the viewport lags (toasts the
    switch). loadVia() disposes any controller so a new user load cancels auto-LOD.
  • Stage (multi-actor): _lodPick(d) chooses a STATIC device-tier rung per added
    actor (≤4 cores/≤4GB→40%, ≤8→70%, else 100%) via pickRung — no live per-actor
    swap (reloading one actor among many is ambiguous; deferred).
  • Shell: lods passed on studio:loadCharUrl (sendActiveChar); stageFetch routes a
    lods item through loadCharUrl (Stage picks the rung) instead of pre-fetching the
    full _100 buffer.
  Verified: single-rung→plain load; 3-rung→finest-first then 100→50→10 under
    simulated 25fps lag; manual override. Files: lod-runtime.js (new), Showcase/
    Playground/Stage.dc.html, index.html, sw.js.
  OPEN: Stage live per-actor swap; an optional manual LOD picker in the viewer UI
    (controller already supports setManual/setAuto).


- 2026-07-22 — **LOD system (foundation + authoring + ingestion)**. Convention:
  <base>_<pct>.glb where pct = % of ORIGINAL triangles, base is forced _100.
  DONE this pass:
  • Manifest schema: optional "lods":[{pct,path,chunked?,chunks?,tris?}]
    (high→low); top-level path/chunk flags mirror the _100 rung for old readers.
  • chunk-loader.js: lodRungs(entry), pickRung(rungs,wantedPct), fetchLODBuffer
    (each rung chunked independently — big _100 splits, small _10 stays whole).
  • lod-switch.js (NEW): createLODController — FPS/EMA watcher, drops a rung on
    sustained lag, climbs back on headroom; manual override + auto flag. Advisory:
    the viewer owns the swap. window.LODSwitch.
  • Decimate: rung list is now EDITABLE (chips, add %, reset; 100% pinned).
    New "Export LOD set for Library" → one GLB per rung named _<pct> + a
    manifest snippet with the lods array (downloads staggered via the shell
    download bridge). Kept the packed single-GLB _LOD0..N mode for Unity/Unreal.
    engine.makeLODFiles(pcts,job) added (uses decimateMesh per rung).
  • scripts/chunker.py: UPDATED — groups <base>_<pct> files (needs a _100) into
    one entry with lods[], per-rung chunk flags; preserves labels/ids/tags.
  • scripts/lodgroup.py: NEW one-shot migration for existing libraries (dry-run
    then --apply); reads .chunks.json sidecars to set per-rung flags; no split.
  STILL OPEN (next): runtime auto-switch WIRING in Stage / Playground / Showcase.
    Needs the shell to pass an entry’s lods to the viewer + a rung-fetch message
    (studio:mrFetch-style), the viewer to feed frame dt into the controller and
    hot-swap the mesh on onPick. Foundation (loader+controller) is ready; this is
    the remaining integration. Files: chunk-loader.js, lod-switch.js (new),
    Decimate.dc.html, decimate-engine.js, scripts/chunker.py+lodgroup.py (new).


- 2026-07-22 — **EXPORT/DOWNLOAD BUGFIX (pp-v82)**. User: "none of the download
  works … says exported X.glb but doesn’t" across Decimate/LOD/OBJ, Boolean,
  MeshDoctor, HumanGen, etc. Root cause: every tool builds a blob and clicks an
  <a download> INSIDE its own iframe; browsers block subframe-initiated downloads,
  so the file never lands though the toast fires. FIX: shell installs a capturing
  download bridge on each tool iframe (installDownloadBridge in index.html) that
  intercepts blob:/data: <a download> clicks and re-issues them from the TOP
  document (shellDownload). Verified end-to-end (synthetic iframe: in-frame click
  → top-frame download). Also fixed 3 tools whose anchor was never attached to
  the DOM (click didn’t bubble to the bridge) + revoked synchronously: HumanGen,
  HairStudio, HairExtract — now appendChild + delayed revoke.
  Also this pass:
  • MeshDoctor exported a see-through model — the X-ray VIEW mode (opacity 0.3,
    depthWrite off) was baked into the GLB. exportGLB() now disables x-ray and
    restores each material’s original transparent/opacity/depthWrite first.
  • MeshEdit had NO export at all — added engine.exportGLB() (bakes every element
    + explode offset into one group, drops selection-highlight emissive) and an
    “⬆ Export .glb” button in the header.
  Files: index.html, HumanGen/HairStudio/HairExtract.dc.html, MeshEdit.dc.html,
  studio3D_scripts/mesh-engine.js, studio3D_scripts/doctor-engine.js, sw.js.
  STILL OPEN (reported, not yet done): plane CUT in MeshEdit leaves open holes —
  no cap/fill of the new boundary (user wants edges added where it cut). Needs a
  boundary-loop triangulation (fan/earcut) after applyCut; sizeable, deferred.


- 2026-07-22 — **Multi Rig audit + hardening** (pp-v81 tool). Full audit at the
  top of this file. Shipped fixes: fraction-based (per-axis bbox) rig carry so it
  survives width/height/depth differences; re-entrancy lock on all async actions;
  removeFromQueue idx shift + active-item delete guard; capture-always; completion
  summary toast. Open backlog recorded up top — headline items: persist batch
  across frame eviction, unbind event for the bound badge, batch-settings lock,
  auto-test clip, finish screen (re-download-all / add-to-Library), save-format +
  auto-save, skip/reorder, batch→Retarget/Decimate/VRM. Files: MultiRig.dc.html,
  rig_scripts/engine.js, rig_scripts/app.js.

- 2026-07-20 — **MeshEdit Blender parity** (pp-v78, user ask). edit-session.js
  + mesh-engine.js + MeshEdit.dc.html. Adds the "see/grow/apply like Blender"
  loop the user wanted on top of the existing vert/edge/face + grow/extrude:
  • **Tris/Quads view toggle** — greedily pairs coplanar triangles (within ~20°)
    across their shared edge and hides that diagonal, so flat regions read as
    quads; shows live quad+tri counts. Display-only (geometry stays triangles).
  • **Shrink** selection (inverse of Grow — drops verts touching any unselected
    neighbour) and **Select Linked** (flood-fill the whole connected island;
    empty selection → select all). Both on the select row + hotkeys L / ⇧G / ⇧H
    (guarded the plain-G grab so ⇧G no longer triggers a move).
  Engine passthroughs editShrink/editSelectLinked/editSetWireMode/editQuadStats.
  Vert-neighbour + quad-pairing caches invalidate on any topology rebuild.
  Files: edit-session.js, mesh-engine.js, MeshEdit.dc.html, sw.js → pp-v78.
  Follow-ups: true edge-loop select (needs the quad pairing → walk opposite
  edges), tris→quads as a real geometry op (not just view), bevel/inset.

- 2026-07-20 — **Sculpt export keeps textures** (pp-v77, Audit VI CRIT fix).
  _ingest now captures per-corner UVs + the source material; exportGLB, when
  topology is unchanged, exports non-indexed with those UVs + a clone of the
  original material (maps intact), so generate→texture→sculpt→save no longer
  guts the character. If a subdivide/dyntopo/relax changed topology the UVs
  can't align — it falls back to grey AND toasts loudly ('re-bake/re-texture'),
  plus a multi-material warning. _topoChanged flag drives it. Remaining Audit VI:
  normal-map bake, remesh wiring, spatial hash, pressure→radius, checkpoints.
  Files: sculpt-engine.js, Sculpt.dc.html, sw.js → pp-v77.

- 2026-07-20 — **Sculpt audit written** (`PolyPotion Audit VI - Sculpt.dc.html`,
  pp-v76). Post-pass sweep of sculpt-engine.js + Sculpt.dc.html. 3 GOOD (redo +
  topology-undo fix + brush/mask/symmetry set — all shipped this session), then
  the open finds: CRIT — export drops UVs/materials/textures (exportGLB builds a
  bare grey material, weld discards UV seams → save silently guts a textured
  character; the headline generate→texture→sculpt→export flow loses work); weld
  tolerance fixed q=4000 not scale-relative; export normals always smoothed.
  Horizon: normal-map bake of sculpt detail → low-poly via BakeMaps (the killer
  feature; before/after snapshot already IS the low-poly), remesh.js wired as
  dyntopo's clean-density partner, spatial hash for the O(n) dab loop,
  pressure→radius + falloff curves, OPFS checkpoints. VR + layers parked. Repair
  order: fix export first, then bake. Added to sw CORE. Files: Audit VI, sw.js v76.

- 2026-07-20 — **Sculpt "new Blender" pass A+B+C** (pp-v73/74). Engine
  (sculpt-engine.js) + Sculpt.dc.html. A: +4 brushes (crease, clay strips,
  scrape, snake hook with per-step re-anchor), full REDO stack (Ctrl+Shift+Z /
  Ctrl+Y), Blender-style brush hotkeys (D/I/S/G/P/F/M/C/L/V/K via onBrushKey),
  studio:redo wired, and rebuild no longer silently wipes history — keeps one
  restorePreRebuild() point. B: mask blur/grow/shrink over the adjacency graph,
  multi-axis symmetry (X/Y/Z picker, _mirror() generalizes the old -P.x).
  C: material presets (clay/wax/shiny/matte via setShading), before/after
  toggle (captures _origPos at load), tri-budget warning + "Send to Decimate"
  handoff over 150k tris. Fixed a header-overflow regression (brush toolbar
  now flex-shrinks + scrolls; status chip stays on-canvas). Both files
  normalized CRLF→LF (they were mixed — caused several failed edits).
  STILL OPEN: dyntopo-lite (auto edge-split under brush — todo 19) and the
  Sculpt audit chapter (todo 15: export drops UVs/materials, O(n) dab gather
  perf cliff ~200k, no displacement→normal-map bake, remesh.js unwired).

- 2026-07-20 — **TOOL_REGISTRY** (pp-v72, Audit V item 5). One source of truth:
  window.TOOL_REGISTRY [{k, file, label, icon, key, char, pal}] in index.html
  (above TOOLS). Derived from it: TOOLS (forEach → src/frame/ready/label),
  CHAR_TOOLS (filter t.char), TOOLDEFS + COMMANDS in the palette IIFE (lazy
  getters — registry lives in the later script block, so both resolve
  window.TOOL_REGISTRY at call time, not parse time; number-key handler uses
  TOOLDEFS.list). setTool's pane loop was already Object.keys(TOOLS) (pp-v66).
  Old TOOLDEFS array left as dead __unusedOldDefs (palette block; harmless,
  remove next pass). Palette gained Decimate/Boolean/Hair entries for free.
  Adding a tool now = 1 registry row + dock item + pane div + sw CORE.
  NOT yet registry-driven: dock DOM (static HTML), stHint chain, sw CORE,
  Handbook, PERSONAS cats. Files: index.html, sw.js → pp-v72.

- 2026-07-20 — **PWA honesty, part 2: full precache** (pp-v71). CORE now
  lists ALL same-origin code: +43 studio3D_scripts engines/workers/helpers
  (exporter, pack, chunk-loader, thumbnailer, every *-engine.js, both
  workers, wasm shims), all 6 rig_scripts modules (AutoRig.html was cached
  but its code wasn't), LibraryEdit.dc.html, legal/docs pages (Privacy,
  Terms, Notices, RigGuide) and Audit V. “Fresh offline visit to any tool”
  now holds; /data/ stays runtime-cached only. Presets folder
  (studio3D_scripts/presets/) intentionally excluded — lazy data.
  Files: sw.js → pp-v71, PROGRESS.md. Audit V item 6: done except PNG
  icon/social-card renders (canvas sandbox outage 2026-07-20).

- 2026-07-20 — **PWA honesty, part 1** (pp-v70). Audit V item 6, partial:
  • **Icons exist now** — icons/icon.svg (rounded flask on wood gradient,
    potion fill + bubbles + sparkle) and icon-maskable.svg (safe-zone padded).
    Manifest rewritten to SVG icons (Chrome accepts SVG for install prompt);
    favicon + apple-touch-icon links point at icon.svg. PNG renders still
    owed (run_script canvas sandbox timed out 3×, even on a 64px probe —
    retry another session; social-card.png og:image also still missing).
  • **What's New unfrozen** — PP_VERSION now derived from sw.js's
    CACHE_VERSION at runtime (fetch + regex, falls back to 0.9); the brand
    badge shows the live version; auto-open once per new version works again.
    Bullets rewritten for the current suite (Go live, wing life, VTuber
    pipeline, personas, Playground/Stage). Old duplicated-array remnant
    removed (was a syntax hazard from a partial edit — file is clean).
  • **Tour step 4 "Or become it"** — Morph → Live → Go live → OBS, so the
    tour finally knows the suite is a VTuber studio.
  • icons + manifest added to sw CORE.
  Files: index.html, manifest.webmanifest, icons/*.svg (new), sw.js → pp-v70.
  Remaining from item 6: engine precache enumeration (~28 files), legal/docs
  pages in CORE, PNG icon renders.

- 2026-07-19 — **Import-base sweep** (pp-v69). The StreamStage crash class
  (dynamic import() resolving against the runtime script's base instead of
  the document, doubling `studio3D_scripts/`) audited across all DCs:
  • Broken (single path, no fallback): StreamStage (fixed pp-v68 hotfix via
    _mod() helper), Retarget.dc.html, Playground.dc.html — both now anchor
    with `new URL(p, location.href).href`.
  • Safe by accident: most tools use try/catch double-path fallback; Morph
    uses bare `./morph-engine.js` which resolves correctly against the
    script base. Left as-is.
  • Also pp-v68 hotfix: chip(true) text color #e6c3a3 → var(--accent)
    (legibility on parchment themes).
  Rule for new DCs: always anchor dynamic imports to location.href.
  Files: Retarget.dc.html, Playground.dc.html, sw.js → pp-v69.

- 2026-07-19 — **VTube "just works" + wing life** (pp-v68). Two brews for the
  zero-knowledge streamer:
  • **⚡ Go live — one click** (StreamStage): new primary button (shown when a
    character is on stage and capture is off) chains camera → auto-calibrate
    (1.2s neutral hold, toast-narrated) → mic lipsync → auto-life → hair sway
    → wing life, with per-step failure tolerance (camera denial aborts with
    the existing toast; mic denial is non-fatal). Empty state rewritten to a
    two-step story with an "Open the Library →" button (studio:gotoLibrary,
    handler already existed in the shell). The no-ARKit hint now has an
    "Open Morph →" button (studio:gotoTool).
  • **🪽 Wing life** (new studio3D_scripts/wing-flap.js + StreamStage toggle,
    auto-detected when bones match /wing|pinion|feather/): procedural idle —
    two slow sines with per-depth lag (tip trails shoulder) — plus a ~1.1s
    burst envelope of 2–3 real flaps every 6–14s. Flap axis = character
    forward converted to each bone's local space at rest, mirrored by root
    world-X side; additive on rest pose so it composes with springs/capture.
    reset() on toggle-off. Answers "my characters have wings, give them an
    idle/flap loop" without touching the rig.
  Files: StreamStage.dc.html, studio3D_scripts/wing-flap.js (new), sw.js →
  pp-v68 (wing-flap.js added to CORE). Follow-ups: wing toggle in Showcase;
  bake wing/idle loops to AnimationClips (ring 1 keyframe authoring); wing
  BONE authoring for rigs without wing bones (needs Rig-side chain builder).

- 2026-07-19 — **GUI phase 2, part 1: personas** (pp-v67). Intent-based
  navigation without hiding anything:
  • Dock "i'm here to…" strip (5 chips: sculpt ✺ / rig ⦿ / animate ⌗ /
    vtube 🎥 / play ⛹) between Show and the groups. Clicking a persona folds
    every group except its own (sculpt→create+shape+surface; vtube→rig+vtube,
    Morph lives in rig; etc), tints its group headers (.persona-hot), persists
    (cookie pp.persona, restored quiet on boot). Re-click = unfold everything.
    Folded groups keep their visible headers — one click away, never hidden.
  • Library "What are you brewing today?" card row (5 .pcard buttons above
    the drop zone): sets the persona AND jumps to its primary tool (sculpt/
    rig/timeline/live/playground).
  • applyPersona() reuses the existing pp.dockcat.* cookies via
    setGroupClosed(); revealDockTool still unfolds on demand for palette/
    library routes into folded groups.
  Files: index.html, sw.js → pp-v67. Remaining phase-2: registry-driven dock
  ({group, personaPresets} per tool), first-run fork can now just call
  applyPersona from the tour.

- 2026-07-19 — **GUI phase 2, part 1 context** — see NEXT SESSION item 5
  (registry) which should absorb PERSONAS when built.

- 2026-07-19 — **Chapter V expanded: “the circus”** (three new sections in
  `PolyPotion Audit V.dc.html`) — what “the tool everyone needs” still lacks,
  all static-site compatible. Ring 1 (authorship): keyframe animation authoring
  (Pose+Timeline+Curves composition — the biggest unlock), bundled CC0 motion
  library, dress-up/bone sockets, face-from-photo → HumanGen, Sprite Studio.
  Ring 2 (VTuber lane): hands/upper-body tracking in Stream Stage, transparent
  OBS Browser-Source backdrop, Japanese i18n, per-platform preflight budgets
  (VRChat/cluster/VSeeFace). Ring 3 (tool → place): per-character version
  checkpoints in OPFS (brew history), batch recipes over the library,
  shareable .potion JSON atoms, PR-driven static community shelf, quest-based
  onboarding, a real landing page at polypotion.com. 15 findings.

- 2026-07-19 — **Chapter V bug-fix pass** (pp-v66). All CRIT/BUG findings fixed:
  • setTool() pane loop now derives from Object.keys(TOOLS) — Playground and
    Stream Stage reachable again (the panes exist for every TOOLS key).
  • sw.js CDN_HOSTS += cdn.jsdelivr.net + storage.googleapis.com (three.js/
    manifold/MediaPipe now cached for offline); header comment corrected.
    Vendoring step 2/2 remains the durable fix.
  • Shell Ctrl+Z/Y: palette IIFE now uses S.activeTool()/S.TOOLS (new
    Studio.activeTool getter) — no more ReferenceError.
  • Animations-tab Import: else-branch routes .bvh/.fbx/.glb clips → Retarget
    via studio:loadClipBuffer; .vrm/.bvh on the characters tab route through
    openDroppedMesh; #libFile accept aligned with the drop zone.
  • Library-card self-XSS: esc() helper; label/subtitle/tags/ext escaped in
    charCard + animCard (ext also stripped to [a-z0-9] since it doubles as a
    class name).
  • Stream Stage popout: embedded frame stores the last character source and
    answers stage:popout-ready by rebroadcasting studio:loadCharBuffer/Url —
    the OBS pop-out now inherits the character; toast updated.
  Registry consolidation (item 5) + PWA honesty (item 6) still open.
  Files: index.html, StreamStage.dc.html, sw.js, PolyPotion Audit V.dc.html.

- 2026-07-19 — **Chapter V audit written** (`PolyPotion Audit V.dc.html`).
  Full-solution sweep of the seams (shell, sw, manifest, Handbook, contracts).
  19 findings + a debt ledger. Headlines: setTool() pane list omits
  playground/live (both flagships UNREACHABLE — CRIT); sw CDN_HOSTS never
  updated for the pp-v42 jsDelivr migration (offline three.js broken — CRIT);
  shell Ctrl+Z ReferenceError; Animations-tab import dead; innerHTML self-XSS
  in library cards; Stream Stage popout handshake half-built; What's New frozen
  at v0.9; Handbook covers 17/31 tools; manifest icons don't exist (install
  prompt can never fire); CORE precache still misses most engines + all
  rig_scripts. Horizon: GUI phase 2 presets (on the registry), face-takes →
  Timeline, spring colliders, VRM-import expression board, KTX2, WebRTC co-op.
  Repair order written into NEXT SESSION above. Doc not yet in sw CORE (itself
  a finding).

- 2026-07-19 — **GUI separation phase 1** (pp-v65). Dock regrouped: perform →
  vtube (MoCap, Lipsync, Live — Stream Stage moved in from the loose top);
  new play group (Playground moved in); Director → animate; top now only
  Library + Show. No JS changes (group collapse/auto-open is data-cat-generic).
  Phase 2 (workspace presets / onboarding fork / registry-driven dock) planned
  above. Files: index.html, sw.js.

- 2026-07-19 — **Brew 10: SPRING BONES** (pp-v64). New
  `studio3D_scripts/spring-bones.js`:
  • detectChainsFromGLTF(json) — name-based chain detection on raw GLB JSON
    (SPRINGY_RX hair/bangs/ahoge/twin/pony/braid/tail/skirt/ribbon/cape/scarf/
    ear/antenna/tassel/bell, EXCLUDE_RX guards humanoid bones); roots = springy
    node with non-springy parent; follows longest springy descent; chains ≥2.
  • buildVRMC (1.0 VRMC_springBone: springs/joints, hitRadius .02, stiffness
    .65, gravityPower .05, dragForce .4) + buildSecondary (0.x
    secondaryAnimation: boneGroups with chain ROOTS, 'stiffiness' spelling,
    ×4 scale).
  • SpringSim — runtime verlet preview: per bone-tail particle, inertia×(1-drag)
    + gravity + stiffness toward rest tail, length constraint, bone re-aimed
    via setFromUnitVectors in parent space. reset() restores rest.
  Wiring: vrm-export.js auto-detects + writes springs in BOTH dialects (report
  gains .springs; export toast shows chain count). Stream Stage: 🍃 Hair sway
  preview toggle (SpringSim stepped in the rAF tick, resets on off). Preflight
  card: springs row now real (green if >0) with a rename hint instead of
  "coming feature". sw CORE += spring-bones.js → pp-v64.
  Follow-ups: sway preview in Showcase/Playground; per-chain stiffness UI;
  colliders (chest/head spheres) so long hair doesn't clip the body.
  THE FACE PLAN (Brews 6-10) IS NOW FULLY SHIPPED.

- 2026-07-19 — **VTuber-brews audit pass** (pp-v63). Re-read every file touched
  by Brews 6-9. Found & fixed:
  • CRITICAL — Brew 7's edit deleted FaceCapture._status() while inserting
    calibrate/record; start() calls it → face capture crashed on start in
    Morph AND Stream Stage. Restored.
  • VRM 0.x: 'surprised' is not a legal 0.x presetName → group kept, presetName
    'unknown' (apps read it as a custom clip).
  • Export dialog: #exVrmBlock label used a nonexistent .exLabel class → inline
    style matching the Bone-naming label.
  Verified clean: GLB chunk math (parse/build), PerfectSync custom binds merge
  across meshes, 0.x bind weights 0-100 + mesh indices, meshAnnotations both
  dialects, head-pose decompose + selfie mirroring, calibrate/gain pipeline
  order (offset→gain→clamp→smooth), AutoLife envelopes, StreamStage merge
  order (life < mic < camera), key rename stage→live (pp-v62), peekVRM offsets,
  checkGLB vtuber stats. Both --accent-dim and --accentDim exist in theme.js —
  mixed usage in Playground/StreamStage is harmless.
  Files: face-capture.js, vrm-export.js, index.html, sw.js.

- 2026-07-18 — **Fix: Stream Stage key collision** (pp-v62). Brew 8 registered
  Stream Stage under key `stage`, which ALREADY belonged to the scene-assembly
  Stage tool — duplicate data-tool buttons, duplicate #pane-stage ids, later
  TOOLS key silently shadowed. Renamed Stream Stage’s key to `live` everywhere
  (dock data-tool, pane-live/load-live, TOOLDEFS, TOOLS, CHAR_TOOLS, stHint,
  and studio:ready/toolError posts in StreamStage.dc.html). Original Stage
  untouched.

- 2026-07-18 — **Brew 9: VRM import + VTuber preflight** (pp-v61).
  • 9a VRM import — drop zone accepts .vrm (a .vrm IS a GLB, so GLTFLoader
    reads it; item stored with ext:'glb', rig:'vrm', rigged:true).
    peekVRM() in the shell parses the GLB JSON chunk headerlessly and reads
    VRMC_vrm (1.0) or VRM (0.x): spec, name, humanoid bone count, expression
    count — reported in the drop toast ("edit in Morph/Pose, re-export as
    VRM"). Round-trip: import → edit → Export→VRM (Brew 6). NOTE: VRM
    expressions are not yet surfaced as named entries on Morph's expression
    board — morphs themselves appear as sliders since they're standard glTF
    targets; board mapping is a follow-up.
  • 9b VTuber preflight — checkGLB() now returns r.vtuber {arkit count, blink
    pair, eyeLook presence, viseme count/5, head bone, tris, materials};
    export dialog shows a ✅/🟡/🔴 row card when format=vrm, with a hint that
    red face rows are fixed by Morph's ⚗ ARKit 52 and that spring bones are
    a coming feature. Thresholds: arkit≥45 green/≥20 amber; tris ≤70k/≤150k;
    materials ≤8/≤16.
  Files: index.html, exporter.js, sw.js. Remaining: Brew 10 (spring bones,
  own session) + KTX2 + tool-registry consolidation.

- 2026-07-18 — **Brew 8: STREAM STAGE “Go Live”** (pp-v60). New tool (dock
  “Live” 🎥, after Playground): `StreamStage.dc.html` on SCEngine directly —
  no new engine file.
  • Face drive: FaceCapture → morphTargetInfluences on every morph mesh;
    head pose → head bone (65%) + neck (35%) via rest-relative rotate
    (regex bone find: /head/ not /headtop|end/, /neck/). Calibrate + Head
    amplitude (0-200%) + Gain (50-250%) sliders. TRACKING badge + selfie
    preview (mirrored, bottom-right).
  • Mic lipsync fallback: getUserMedia audio → AnalyserNode RMS → jawOpen/
    mouthFunnel envelope — works with no camera.
  • Auto-life: AutoLife layer merged UNDER capture weights (capture wins per
    shape), toggle. Runs in the shared rAF tick with the mic envelope.
  • Stage: backdrop chips — chroma green 0x00b140 / magenta / dark studio
    (floor visible) / sky, via renderer clear color (background nulled, grid
    hidden). Framing presets bust/half/full from modelCenter/modelRadius.
  • Go live: ⧉ pop-out window (?popout=1, header hidden), 👁 hide-UI + H
    hotkey — OBS window-captures the popout; chroma key removes green.
    V1 caveat: popout doesn't inherit the character (no cross-window buffer
    hand-off yet) — toast tells the user; FOLLOW-UP: opener rebroadcast.
  • Shell wiring: dock/TOOLDEFS/TOOLS/pane/CHAR_TOOLS/stHint; sw CORE +=
    StreamStage.dc.html → pp-v60. No-ARKit models get a hint pointing at
    Morph's ARKit 52; mic + auto-life still work on any mouth/blink morphs.
  Files: StreamStage.dc.html, index.html, sw.js.

- 2026-07-18 — **Brew 7: capture upgrades** (pp-v59).
  • 7a Head pose — face-capture.js now requests facialTransformationMatrixes,
    decomposes to yaw/pitch/roll (selfie-mirrored, smoothed, headAmplitude
    knob), passes as 2nd arg to onWeights. Bone driving lands with Stream
    Stage (Brew 8) — Morph has no bone access.
  • 7b Calibrate + gain — cap.calibrate(ms) averages neutral offsets
    (subtracted per frame), per-group gain (brows/eyes/mouth) + master +
    smoothing built into FaceCapture._process. Morph UI: ⊕ Calibrate button +
    master Gain slider (50-250%).
  • 7c Record-to-clip — start/stopRecording buffers {t, weights, headPose};
    stopRecording returns lipsync-bake-shaped {tracks, pose, duration, fps}.
    Morph UI: ⏺ Record take → saved to localStorage `pp-face-takes` (max 12).
    FOLLOW-UP: Timeline/Showcase consume takes as AnimationClips.
  • 7d AutoLife — new class in face-capture.js: sample(dt) → blink envelope
    (3-7s), eased gaze drift, breathing sine. window.PPAutoLife. Wire-up into
    Showcase/Playground/Stream Stage is Brew 8's first move.
  Files: face-capture.js, Morph.dc.html, sw.js.

- 2026-07-18 — **Brew 6: VRM exporter fixes** (pp-v58). NOTE: 6a (look*/
  surprised presets) was ALREADY in vrm-export.js — audit finding was stale;
  lookAt already flips to 'expression' when look* bind. Shipped:
  • 6b PerfectSync — expressions.custom: one clip per ARKit morph present
    (weight-1 binds, merged across meshes). Report gains customExpressions.
  • 6c VRM 0.x — buildVRM0() serializer (extension "VRM": humanBones array,
    blendShapeMaster groups w/ 0-100 weights + PRESET_0X name map, firstPerson
    flags + lookAt curves, meta in 0.x dialect, empty secondaryAnimation).
    exportCharacter passes opts.vrmVersion; export dialog shows VRM version
    chips (1.0 modern / 0.x VSeeFace) when format=vrm (#exVrmBlock, injected
    next to #exSkelBlock in renderExport). Toast reports version + PerfectSync
    shape count.
  • 6d firstPerson.meshAnnotations — meshes carrying face morphs →
    thirdPersonOnly, others → both (both 1.0 and 0.x paths). Playground POV
    head-hide skipped: Playground drives GLBs, not VRMs — no annotation to read.
  Files: vrm-export.js, exporter.js, index.html, sw.js. Next: Brew 7 (capture).

- 2026-07-18 — **Chapter IV audit written** (`PolyPotion Audit IV — Face.dc.html`).
  Focused sweep of the face stack (morph-engine, face-capture, lipsync-engine,
  vrm-export) against the VTuber test. Foundation judged right (ARKit-52
  everywhere, on-device capture). 12 findings:
  • Exporter (all in vrm-export.js): no look*/surprised presets + no eye bones
    → dead eyes (S); no PerfectSync custom expressions despite authoring the 52
    set (M); VRM 1.0 only, ecosystem needs 0.x (M); firstPerson.meshAnnotations
    empty (S); no VRMC_springBone → frozen hair (L, own brew).
  • Capture: head-pose flag disabled (outputFacialTransformationMatrixes:false)
    — flip + drive neck (S); no record-to-clip (M, carried); no calibration/
    gain (S); auto-life blink+idle layer (S, SPARK).
  • Missing tool: **Stream Stage / “Go Live”** — capture + avatar + chroma
    backdrop + pop-out window for OBS capture (L, the face-stack flagship);
    VRM import (carried, now face-motivated); VTuber preflight report (S).
  Out of scope: Live2D, VMC/OSC (no UDP in browsers).

- 2026-07-18 — **Fifth brew, part 5: Playground fun layer** (pp-v57). On top of
  part 4's controller: • **Potion hunt** — 8 glowing potion bottles (glass +
  emissive liquid) scattered over ground and course tops, bob/spin, collected on
  touch with a sparkle burst; timer starts on first movement, stops at 8/8 with
  a confetti burst; best run persists (localStorage `pp.playgroundBest`).
  • **Kickball** — physics ball (gravity, bounce, wall/solid reflection, rolls
  with spin) kicked by running into it, kick speed scales with your speed.
  • **Trampoline** — bouncy green pad (solid with `bounce` launch velocity, also
  fires the jump clip). • **Boost pad** — orange floor ring that slingshots your
  horizontal velocity (cooldown + particle trail). • **Particles** — pooled
  Points system (260) for confetti / pickup sparkles / boost trail / landing
  dust (fall speed threshold). • **HUD** — 🧪 n/8 + ⏱ timer chips while driving
  (accent-lit when done), 📸 snapshot (inherited snapshotPNG → PNG download),
  🧪 Reset course; best-run line in the World panel. Fun layer ticks even when
  not driving (potions bob, ball settles) but only collects/kicks while driving.
  Files: playground-engine.js, Playground.dc.html, sw.js.

- 2026-07-18 — **Fifth brew, part 4: THE PLAYGROUND** (pp-v56) — the flagship toy,
  oriented for the persona angle. New tool (dock “Play”, after Showcase):
  `Playground.dc.html` + `studio3D_scripts/playground-engine.js`
  (**PGEngine extends SCEngine** — loading, normalize, semantic retarget, IBL
  and XR inherited; ~330 new lines).
  • Drive: WASD/arrows/gamepad (stick + A jump + RT run), capsule physics
    (gravity, jump, AABB course collision — crates, stairs, jump pads, pillars),
    camera-relative movement, damped facing.
  • Cameras: follow-cam (drag orbit + wheel zoom) and first-person POV (V key,
    pointer lock); controls.target-sync so OrbitControls.update() cooperates
    instead of fighting the follow cam.
  • Persona: real mirror (Reflector) in the world; expression chips from morph
    targets (listMorphs/setMorph); WebXR “step in” via inherited startXR.
  • Moves: idle/walk/run/jump slots — auto-matched by name from the animation
    library on first drive, or hand-picked per slot; retargeted via the
    inherited pipeline then root-position tracks stripped (capsule owns
    travel); crossfaded by speed state, walk/run timeScale synced to velocity;
    jump is LoopOnce triggered on takeoff. Unrigged characters still drive
    (slide) with a toast hint. “Flip facing” chip for -Z-facing models.
  • Shell wiring: dock item, TOOLDEFS (palette), TOOLS, pane, CHAR_TOOLS (active
    character follows in), stHint. sw CORE += Playground.dc.html,
    playground-engine.js, showcase-engine.js (same-origin only — NOT the
    vendoring path that broke the site before) → pp-v56.
  NOT yet: props from library in the world, co-op. Audit III marked shipped.

- 2026-07-18 — **Fifth brew, part 3: import parity** (pp-v55).
  (1) **BVH mocap import**: retarget-engine._parse handles .bvh (BVHLoader →
  skeleton+clip wrapped in a Group); Retarget source picker accepts .bvh; new
  `studio:loadClipBuffer` message loads a clip buffer into the source slot;
  shell drop zone routes .bvh → Retarget (openDroppedClip, pending-safe).
  (2) **STL/PLY import**: accepted by drop zone + libFile/dropFile pickers;
  parsed in showcase-engine.loadBuffer and rig engine E.loadFile (geometry →
  Mesh + MeshStandardMaterial, computeVertexNormals if missing). Drop-zone
  copy updated. NOTE: rig_scripts/engine.js has CRLF line endings —
  str_replace fails there; edit via script.
  Still open in Dialects: VRM import, KTX2 texture compression.
  Files: index.html, sw.js, Retarget.dc.html, studio3D_scripts/retarget-engine.js,
  studio3D_scripts/showcase-engine.js, rig_scripts/engine.js, Audit III.

- 2026-07-18 — **Fifth brew, part 2: library at scale** (pp-v54). renderLib now
  virtualises past 60 items (24 eager cards, IntersectionObserver placeholders
  with 900px lookahead — thumbnails decode lazily as cards materialise);
  "⌛ Recently opened" shelf (top 6) on the default browse view; new sorts
  "Recently opened" / "Never opened first". Last-opened tracked per character
  in localStorage `pp.opened` (capped at 800 entries), stamped in
  setActiveChar so every open route counts. Audit III finding marked shipped.
  Files: index.html, sw.js, PolyPotion Audit III.dc.html.

- 2026-07-18 — **Fifth brew, part 1 shipped** (scoped per author feedback on the
  Chapter III audit: touch/tablet DESCOPED — desktop-first by design; aggressive
  precache/vendoring OFF THE TABLE — a past attempt broke the site; LibraryEdit
  is the author's intentional private admin tool, leave unwired). Shipped:
  (1) **Global error pulse** — theme.js (loaded by every tool) now posts
  uncaught errors/rejections from tool iframes as `studio:toolError` (throttled
  3/min per frame); the shell shows an error toast naming the tool with a
  one-click "↻ Reload tool" (reviveFrame). One toast per tool per 20s.
  (2) **Eviction is never a mystery** — idle-reap now toasts which tool was put
  to sleep + warns unsaved work there is gone. The studio:suspend dirty-check
  remains open (needs per-tool cooperation).
  (3) **🎲 Surprise me roulette** — Library toolbar button + command-palette
  entry: random character weighted toward never-rolled (localStorage
  `pp.rouletteSeen`), random clip retargeted on if rigged, lands in Showcase;
  respects NSFW gate + hidden items.
  (4) **A11y slice** — global :focus-visible ring on all interactive chrome;
  aria-labels on card rename/duplicate/remove buttons.
  Audit III updated (descopes recorded, shipped badges). sw.js → pp-v53.
  Files: theme.js, index.html, sw.js, PolyPotion Audit III.dc.html.

- 2026-07-18 — **Chapter III audit written** (`PolyPotion Audit III.dc.html`).
  Full-solution sweep; no engine rot found — findings are at the seams (see
  section above). Consolidated I+II audit left as the shipped scoreboard.
  Doc not yet added to sw CORE (itself one of the findings).

- 2026-07-17 — **Fourth-brew item 3 shipped: mesh blobs moved to OPFS**
  (`index.html`). Heavy GLB payloads now live as files in the Origin Private
  File System (`meshes/<id>.glb`); IndexedDB keeps only a light manifest
  (metadata + `opfs:true`). Added `opfsDir/Write/Read/Delete/Clear` helpers;
  `idbSaveChar` writes the buffer to OPFS + a bufferless manifest record
  (`metaOnly` skips re-serializing the GLB on a thumbnail-only save);
  `idbDeleteChar`/`idbNuke`/`clearSavedSession` clear OPFS too; `idbRestore`
  and `backupAll` read payloads back from OPFS. **Backward compatible**: legacy
  buffer-in-IDB records still restore/back-up and migrate to OPFS on next save.
  **Graceful fallback**: if OPFS is unavailable (older Safari) every call is
  try/caught and it reverts to buffer-in-IDB. Avoids the structured-clone cost
  of big ArrayBuffers through IDB and stops the library bloating IndexedDB.
  Verified the OPFS API sequence in a harness (sandbox blocks OPFS by origin, so
  final confirm needs a real origin/localhost). sw.js → pp-v52.
  Fourth-brew status: item 1 (vendor three.js locally) **abandoned — bug-inducing,
  already tried**; item 2 (sample characters) **not needed — the user already
  ships a heavy chunked library**; item 3 (OPFS) done. Fourth brew closed; next
  up per the audit is the Audience section (community index, a11y pass) or a big
  bet (local-network co-op).


- 2026-07-17 — **Theme pass, round 3: accents unified.** Converted every tool's
  bespoke primary-accent colour to `var(--accent)` / `var(--on-accent)` /
  `var(--accent-dim)`: Director (#d8935a), Lipsync (#d87ba3), MeshDoctor
  (#2fa07c), Recipe (#b8a3e8), Retopo (#e0894f), ShaderLab (#7b6fd8), Timeline
  (#5a8fd8), TexturePaint (#c8743c), Showcase (#c98a5a). Their remaining
  hardcoded hex are genuinely semantic and kept as content: danger/warn shades,
  per-clip/track lane palettes (Director/Timeline), node-type colours
  (Recipe/ShaderLab), and retopo quad-validity greens. Also tokenised residual
  CSS-chrome text in TexturePaint/Showcase/MoCap (cream/tan text → var(--text-2)/
  var(--on-accent), success green → var(--good)); left canvas draw colours
  (skeleton gizmos, brush cursors, graph fills — fillStyle/strokeStyle) hardcoded
  on purpose, since those are viewport content, not app chrome. sw.js → pp-v51.
  Net: all app chrome across the shell + 38 tools now reads from theme.js.


- 2026-07-17 — **Theme pass, round 2 (full audit).** Swept every doc, not just
  the ones the user named. Found + fixed: (1) **Boolean.dc.html** — the last
  tool with no `theme.js` and a wholly hardcoded dark palette/'Sora' font; fully
  converted to tokens + loads theme.js now. (2) **index.html dark-on-dark** —
  the shell's `.tbtn` top buttons, `.dock-cat` labels and `.fchip` filter chips
  set `color:var(--wood-dark)`, but `--wood-dark` is a dark shadow colour in
  *every* theme, so in the dark themes it was dark-grey text on a dark panel
  (exactly the reported bug). Switched those to `color:var(--text)`. (3)
  Tokenised dark button inks (`#0d0f1f`/`#04201f`/…) that sit on
  `background:var(--accent)` → `var(--on-accent)` across 13 tools, so accent-
  button contrast is guaranteed in any theme. Audited all remaining hardcoded
  dark `color:#…`: the rest are dark ink on bright accent buttons or on semantic
  per-clip/lane/data colours (Director/Timeline clips, HairExtract stat numbers)
  — correct dark-on-bright, left as content. sw.js → pp-v50. (Still bespoke, not
  a contrast bug: a few tools use a per-tool bright button colour, e.g.
  Director/Lipsync/Retopo/ShaderLab/Timeline, instead of var(--accent) — readable
  everywhere, optional future uniformity tweak.)


- 2026-07-17 — **GUI theme-consistency pass.** Several tools ignored the shared
  `theme.js` CSS-variable palette. Fixed: (1) **HumanGen** and **HairStudio**
  were built on their own hardcoded palettes/fonts (Space Grotesk + mint;
  Archivo + editorial tan/orange) and did not respond to theme switching at all
  — both fully converted to `var(--bg/panel/text/accent/on-accent/muted/edge/
  accent-dim)` + `var(--font-ui/mono)`, keeping only genuine content colours
  (clay swatches, hair-colour swatches, canvas hair textures, 3D light colours).
  (2) **Sculpt** used `var(--new)` (a blue) for its brush chips/pills — the
  "light blue" the user spotted; swapped to `var(--accent)`, and did the same
  across the other tools that used `var(--new)` for interactive chrome
  (Physics/Motion/MeshEdit/MoCap/TexturePaint) for one uniform accent. (3)
  Global `IBM Plex Mono` → `var(--font-mono)` (9 files); stray `#7c83ff` blue
  (Decimate/Retarget) and `#4fb6a2` teal (UVUnwrap) → `var(--accent)`.
  HairExtract was already fully themed (not an offender). sw.js → pp-v48.
  Remaining polish (not yet done): tokenize the hardcoded `rgba(15,15,15)` chip
  backgrounds + `rgba(255,255,255,.0x)` hairline borders still scattered across
  most tools (they look right on dark themes but wash out on the light ones).


- 2026-07-17 — **Two load-time breakages fixed** (`_headers`,
  `SECURITY_HEADERS.md`, `sw.js`). (1) The enforced CSP `script-src` was missing
  `'unsafe-eval'`, so the DC runtime's `Function()`-compiled logic class was
  blocked for EVERY `*.dc.html` tool — they rendered template-only with all
  `{{ }}` holes blank (HumanGen etc.). Added `'unsafe-eval'` to `_headers` +
  the SECURITY_HEADERS.md reference, with a note on why the DC runtime needs it.
  **Requires a redeploy of `_headers` to take effect** (it's a response header,
  not in the HTML). (2) The service worker routed the user's `/data/` asset
  library (pfp thumbnails + chunked 60 MB+ meshes) through the versioned runtime
  cache; the reload+timeout path turned any slow/absent asset into a hard
  "ServiceWorker encountered an unexpected error" (sw.js:148/139), spamming the
  console with dozens of failed pfp PNGs. Now `/data/` is bypassed entirely and
  fetched natively (the chunk-loader owns those). sw.js → pp-v47.


- 2026-07-17 — **Job contract rollout complete: animation retarget**
  (`retarget-engine.js`, `Retarget.dc.html`). The last long op. `exportGLB(job)`
  now `guard()`s its GLTFExporter.parse so a cancel abandons the pack before the
  download; `Retarget.dc.html` loads `job.js`, shows a **Cancel** button in the
  export overlay, and treats cancel as a clean no-op. `retarget()` itself is a
  single atomic `SkeletonUtils.retargetClip` call that can't be interrupted
  mid-call, so `runRetarget()` was made async only to paint the busy overlay
  before blocking (honest: no Cancel offered on the atomic step, only on the
  guardable export). **Every long op in the suite now shares the JobController
  contract** — rig bind, decimate/LOD, the whole export pipeline, retarget.
  The "progress + cancel on every long op" follow-up is closed. sw.js → pp-v46.


- 2026-07-17 — **Job contract rolled through the whole Export pipeline**
  (`exporter.js`, `atlas-merge.js`, `glb-optimize.js`, `index.html`). The
  Export dialog ran three back-to-back heavy stages (texture atlas → GLTF
  serialize → Draco/meshopt compress) with only a disabled "⏳ Preparing…"
  button and no way out. Threaded a `JobController` through
  `exportCharacter(buffer, {…, job, onStatus})`: it checkpoints between every
  stage, `guard()`s the opaque GLTFExporter.parse + optimize promises (so a
  cancel abandons the result before the download fires), and reports the live
  phase back to the button. `mergeToAtlas` checkpoints per group + per mesh;
  `optimizeGLB` checkpoints between its (black-box) glTF-Transform passes. In
  the shell, the modal's existing **Cancel** button doubles as a job-cancel
  while an export is running (falls back to closing the dialog otherwise), and
  the Go button streams the phase text ("Atlasing textures…", "Compressing
  (meshopt)…"). Cancel is treated as a clean info toast, not a failure.
  sw.js → pp-v45. Last long op left on the contract: animation retarget.


- 2026-07-17 — **Job contract rolled to Decimate + LOD** (`qem.js`,
  `decimate-engine.js`, `Decimate.dc.html`, `recipe-engine.js`). The quadric
  collapse loop was synchronous and blocked the main thread, so its overlay
  spinner could never be cancelled \u2014 a heavy LOD chain (3 decimations back to
  back) meant a multi-second freeze. Made `decimateMesh` **async + cooperative**:
  at the existing 8191-tri checkpoint it now yields (`await job.tick()`) so a
  Cancel click is processed, reports a progress fraction, and throws
  `JobCancelled` when cancelled. `decimateTo(ratio, job)` / `makeLODs(ratios, job)`
  thread the job through; `Decimate.dc.html` loads `job.js`, shows a **Cancel**
  button in the busy overlay, and treats cancel as a clean no-op (mesh
  unchanged). Also fixed the other `decimateMesh` caller (`recipe-engine.js`
  decimate step) to `await` the now-async function (was relying on a sync
  return). sw.js \u2192 pp-v44. Remaining long ops on the contract: atlas-merge,
  glb-optimize, retarget, export.


- 2026-07-17 — **Floor: the compute-job contract** (`studio3D_scripts/job.js`).
  Long ops improvised cancellation five different ways (Bake Maps `_cancel`
  flag, Director `cancelRecord`, SW AbortController) and the flagship — the HQ
  rig bind, which runs in `skin-worker.js` — had NO cancel at all: start a
  voxel-geodesic solve on a heavy mesh and you waited it out. New `JobController`
  wraps one AbortController and carries `progress(phase,frac)`, `checkpoint()` /
  `await tick()` cooperative cancel points for main-thread loops,
  `attachWorker()` (cancel → `worker.terminate()`), `guard(promise)`, and a
  `JobController.isCancel(err)` classifier (cancellation rejects as a
  `JobCancelled` / message `'cancelled'`, treated as a clean user action, not a
  failure). Wired into `E.bind` (engine.js) + `bindHQ` (terminates the worker
  and rejects cancelled on abort) + `runBind` (app.js): the loading overlay now
  shows a **Cancel** button during a bind; cancelling drops you back to joint
  placement with joints untouched. This is the Phase-1 seed — decimate,
  atlas-merge, glb-optimize, retarget and export roll onto the same shape next.
  job.js added to sw.js CORE precache; sw.js \u2192 pp-v43.


- 2026-07-16 — **Floor: dependency imports unified (vendoring step 1/2)**.
  The suite had TWO CDNs and TWO mechanisms: AutoRig + `rig_scripts/engine.js`
  used an import map (jsDelivr) with bare `three`/`three/addons/` specifiers,
  while all 14 `studio3D_scripts` engines hard-coded ~40 `esm.sh/three@0.160.0`
  URLs directly. Unified everything onto the import-map + bare-specifier
  convention: swapped every esm.sh three URL → bare `three`/`three/addons/`
  across 35 JS files + inline imports in 4 HTML files; injected the canonical
  map (three + three/addons + manifold-3d, jsDelivr) into index.html + all 32
  tool `*.dc.html` docs (AutoRig already had it). manifold-3d centralized too.
  Runtime bytes identical (same version), so no behaviour change — now the
  CDN/version lives in ONE map block per doc. Actual offline drop-in (files into
  `vendor/` + one find-replace of the map URLs) is documented in `vendor/README.md`;
  that is step 2/2 and needs the binaries on a networked machine. Remaining CDN
  deps (non-three): mp4-muxer, MediaPipe. sw.js → pp-v42.


- 2026-07-16 — **Floor: A-pose fit in Rig** (`rig_scripts/engine.js` `setArmPose` +
  `chkApose` in `AutoRig.html`/`app.js`). Most meshy.ai catalog meshes rest in
  A-pose, so the T-pose joint template dropped arm/finger joints in empty space
  on "Fit to mesh". New "Arms hang in A-pose" checkbox rotates the arm + finger
  joint homes ~41° down about each side’s shoulder (mirrored per side) so auto-fit
  lands them on the angled arms; re-applied on fresh mesh load while checked
  (batch rigging), toggle off restores the T-pose template. Roadmap doc
  (`uploads/Audit.html`) marked shipped. sw.js → pp-v41.


- 2026-07-16 — **Big bet #2 shipped: multi-character stage** (`Stage.dc.html`
  + `stage-engine.js`; took over the disabled "Scene" dock slot). Drop several
  library characters/props onto one ground; each actor is wrapped
  holder(user transform) → norm(auto height/ground) → imported root. Click-select
  + left-drag on the ground moves an actor (OrbitControls disabled mid-drag so
  right-drag still orbits); per-actor turn/scale; each actor keeps its OWN
  AnimationMixer + clip pick and plays at its own speed. Export composes ONE
  glTF: every actor is SkeletonUtils-cloned, its nodes prefixed `a{i}_`, its
  clip tracks retargeted to the prefixed names (so GLTFExporter resolves them
  and nothing collides on reimport), placed at the actor's world transform;
  all clips packed as separate animations. Send-to-Showcase routes the same
  buffer. Shell wiring: on `stage` ready the shell posts `studio:library`
  (the character index); the stage requests a pick via `studio:stageFetch`
  and the shell fetches + returns the GLB via `studio:stageAdd`. Registered in
  dock/palette/frames/CHAR_TOOLS/toggle-list/sw. **Harness-verified**: 2 actors
  placed + transformed, duplicate/remove work, export → 2 skinned meshes + 2
  animations (`a0_waveA`/`a1_waveB`, no name collision), all tracks rebind on
  reimport. sw.js → pp-v40 (v39 re-bumped: the version-query import fix landed after v39 precached the stale HTML).

- 2026-07-16 — **Big-bets tier opened: Vertex Animation Textures (VAT) bake
  shipped** (`VAT.dc.html` + `vat-engine.js`). First genuinely-new-machinery
  item, not a translation layer. Bakes a clip → position/normal texture pair
  (col=gl_VertexID, row=frame, bounds-normalized 8-bit); a two-line GLSL3
  vertex shader replays it with zero skeleton cost. Skinned / morph / rigid
  paths; live Source↔Baked compare in the viewport; export pack (PNGs + static
  GLB + JSON report + README+shader). Wired into dock (animate) / palette /
  frames / CHAR_TOOLS. Harness-verified: decode matches independent skinning
  to 0.004, motion arc captured, shader compiles clean, pack complete.
  sw.js → pp-v38.

- 2026-07-14 — Chapter II audit written (`Frontier Audit.dc.html`, 18 findings).
- 2026-07-14 — First brew shipped: retarget, ARKit 52, VRM, ORM/normal, WebXR.
  Audit updated with ✓ SHIPPED badges + revision note. sw.js → pp-v25.
- 2026-07-14 — This tracker created; audit "brew five" replaced with second brew.
- 2026-07-14 — Landmark-guided ARKit added to Morph (user request: place face
  contour points → auto-fit the 52 shapes).
- 2026-07-14 — Second brew items 1–4 shipped: bone-name maps on export, LOD
  chains in Decimate, expression library in Morph (pp-expressions), unit/scale
  validator in Export. sw.js → pp-v27. Passport (item 5) still open.
- 2026-07-15 — Second brew complete: character passport shipped
  (`passport-export.js`, `passport` format in Export dialog). sw.js → pp-v28.
  Audit updated (10/18 shipped). Third brew picked into UP NEXT.
- 2026-07-15 — Third brew items 3–4 shipped: webcam face capture in Morph
  (`face-capture.js`), saved-pose shelf in Pose (`pp-poses`). sw.js → pp-v29.
  Note: Pose files use mixed \r\n / \n line endings — match per-region when
  string-editing.
- 2026-07-15 — Audits consolidated: `Audit.dc.html` + `Frontier Audit.dc.html`
  replaced by `PolyPotion Audit.dc.html` (verified scoreboard: 20 findings
  closed, 15 open + 8 small follow-ups). Toolbar overlap in Pose fixed
  (wrapping flex row). sw.js → pp-v30.
- 2026-07-15 — Third brew item 2 shipped: texture atlas + material merge
  (`atlas-merge.js`, "Atlas & merge materials" toggle in Export). Verified
  5→1 draw call in a harness. sw.js → pp-v33. Only IK handles (item 5) left
  in the brew.
- 2026-07-15 — sw.js hardened with fetch timeouts (a stalled CDN was hanging
  loads); → pp-v32. Then atlas → pp-v33.
- 2026-07-16 — Fourth brew item 4 shipped: **cross-origin isolation**. Added a
  deployable `_headers` (Netlify / Cloudflare Pages) with COOP same-origin +
  COEP **credentialless** (grants SharedArrayBuffer / the ⚡ threads badge
  without require-corp breaking esm.sh/fonts/MediaPipe). Reconciled the
  contradiction between CONTRIBUTING.md (said require-corp) and
  SECURITY_HEADERS.md (said don't set COEP) — both now say credentialless.
  Docs/config only, no app-file change. Remaining fourth-brew: vendor three.js,
  sample chars, OPFS.
- 2026-07-16 — Fourth brew item 2 shipped: **shared symmetry contract**
  (`symmetry-map.js`). Replaced three per-tool mirror maps (morph/sculpt/
  weightpaint) with one scale-relative `buildMirrorMap` + `mirrorBonePartners`.
  Verified in a harness (41/41 verts paired, bone twins resolve). sw.js →
  pp-v37. Remaining fourth-brew: vendor three.js, COOP/COEP, sample chars, OPFS.
- 2026-07-16 — Fourth brew item 1 shipped: **colour-management contract**
  (`color-space.js`). `tagObject()` fixes mis-tagged maps on import (sRGB for
  colour slots, NoColorSpace for normal/roughness/metalness/ao/etc — matters
  for FBX/OBJ, wired into Showcase's load path). `applyViewTransform()` + a
  Showcase "View transform" panel: sRGB / Neutral / AgX / ACES + exposure
  slider; default sRGB is the identity so the look is unchanged until chosen.
  Also fixed Showcase's stale "right-drag pans" viewport hint. sw.js → pp-v36.
  Audit updated. Remaining fourth-brew: shared symmetry, vendor three.js,
  COOP/COEP, sample chars, OPFS. right-drag
  orbited in some tools and panned in others. Added `nav-scheme.js` (shared
  OrbitControls contract: RIGHT=orbit, MIDDLE=pan, wheel=zoom) and wired it
  into all 24 engines; retopo aligned (MIDDLE was dolly), texture paint gated
  to left button. All 24 engines verified parsing + mapping in a harness.
  sw.js → pp-v35. in-viewport IK handles shipped (pole
  targets + pin-to-world in `pose-engine.js` / `Pose.dc.html`; fixed a
  pre-existing syntax break in `_buildHandles` along the way). Verified in a
  harness. sw.js → pp-v34. Audit updated: IK → shipped, fourth brew picked
  (colour mgmt, shared symmetry, vendor three.js, COOP/COEP, sample chars);
  correctness section folded into the fourth brew.
  chips in Export via `glb-optimize.js`; meshopt verified, Draco wired but
  untested (preview sandbox froze mid-test — emscripten thenable loop, then a
  wedged webview). sw.js → pp-v31.
