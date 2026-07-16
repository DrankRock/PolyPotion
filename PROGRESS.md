# PROGRESS.md — audit implementation tracker

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

## Log

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
