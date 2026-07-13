# Recipes — non-destructive pipelines in PolyPotion

Status: **v1 shipped** (Recipe tool + headless runners). This document is the
contract new steps and engines must follow.

## The idea

Every PolyPotion tool today is destructive: you load a mesh, push buttons,
export. A **Recipe** is the same work as a *graph you can re-run*: nodes are
processing steps, wires carry mesh buffers, and changing any upstream node
(or dropping in a new source mesh) reflows everything downstream. "Scan →
weld → decimate to 40% → ground → bake AO" becomes an asset you keep, not a
checklist you repeat.

## The headless run contract

A recipe step is a **pure async function over GLB buffers**:

```js
run(glbBuffer /* ArrayBuffer */, params /* plain object */, ctx)
  → Promise<{ buffer: ArrayBuffer /* GLB */, stats: object }>
```

Rules:

1. **GLB in, GLB out.** The interchange format on every wire is a binary
   glTF ArrayBuffer. Conversion from FBX/OBJ happens once, in the source
   node (`normalize()`), never inside steps.
2. **No DOM, no viewport, no user gesture.** A runner may not touch a
   canvas, a renderer, or `document`. CPU-side three.js objects are fine.
   (This is what "headless" means — the step can run in a worker later.)
3. **Deterministic** for a given (buffer, params). Random sampling must use
   a fixed seed (the AO step does).
4. **Never mutate the input buffer.** Parse it, build new geometry, export.
5. **Report through `ctx.onStatus(msg)`**, throw a plain `Error` with a
   human message on failure. The graph marks the node red and skips its
   descendants — never leaves half-written output on the wire.
6. **Declare params** in the step's registry entry (`key, label, min, max,
   step, def, unit`) — the Recipe tool builds its inspector from that
   metadata, no per-step UI code.

### v1 limitations (by design)

Recipes operate on **static geometry**. Skinning, animation clips and morph
targets are dropped at the source node; textures survive only through steps
that keep UVs (weld/ground/scale/normals — decimate and remesh rebuild the
surface and lose them). Rig-aware recipes are a v2 concern and need the same
contract implemented *inside* AutoRig's engine.

## Shipped steps (studio3D_scripts/recipe-engine.js)

| step | reuses | params |
|---|---|---|
| `weld` | BufferGeometryUtils.mergeVertices | tolerance |
| `decimate` | qem.js `decimateMesh` | keep % |
| `remesh` | remesh.js `voxelRemesh` | resolution, smooth passes |
| `normals` | computeVertexNormals | — |
| `ground` | — | — (feet to floor, centre XZ) |
| `scale` | — | target height (m) |
| `ao` | ao-engine.js `buildBVH` + `rayOccluded` (exported for this) | samples, intensity |

## Adopting the contract in existing engines (the v2 path)

Each interactive engine keeps its class, and additionally exports a headless
entry point:

```js
// e.g. doctor-engine.js, some day:
export async function runDoctor(buffer, { fixes: ['weld','winding',…] }, ctx) → { buffer, stats }
```

Priority order, by value ÷ effort: doctor (fix-all), uv (LSCM unwrap),
bakemaps (needs render targets → must grow an OffscreenCanvas mode),
autorig (skeleton+skin, the big one). A tool that has a headless entry gets
its node registered in the Recipe palette with `engine:` metadata instead of
an inline runner.

## Graph semantics (Recipe.dc.html)

- DAG, single input port per step node, output fans out freely.
- Evaluation is topological; a node runs when it is *dirty* (its params
  changed, its input edge changed, or anything upstream re-ran) **and** its
  input buffer exists. Everything else is served from cache.
- The graph (nodes, positions, params, wires) persists in
  `localStorage['pp.recipe.graph']`. Buffers do not — re-drop the source
  mesh and the recipe re-runs.
- Any node's cached output can be previewed in the 3D pane, downloaded as
  .glb, or saved to the Library (`studio:saveChar`, same as every tool).
