# Authoring objects for the Scene tool

Objects in the Scene tool are **parametric three.js prefabs** registered into a
global `window.OBJECTS` registry. Each is a JS factory that builds a
`THREE.Object3D` from a small `opts` bag. The Scene composes them; `rooms.js`
arranges them into environments; a save file stores only the **recipe**
(`name` + `opts` + transform), never geometry.

Until the server (PocketBase) returns, **users cannot add objects from the
website.** New objects are authored *by hand or by AI* into new
`data/objects_<group>.js` files that ship with the app. This guide is the
contract; the last section is a copy-paste prompt to hand an AI.

---

## The registry API

Every `data/objects_*.js` file is a self-contained IIFE that pulls its tools off
`window.OBJECTS` (defined by `data/objects_core.js`, which must load first):

```js
// data/objects_myset.js
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("name", function (o) {
    const g = new THREE.Group();
    // …build meshes, add to g…
    return g;                       // any THREE.Object3D (usually a Group)
  }, {
    icon: "🪑",                     // shown in the palette
    category: "furniture",          // groups the palette + Showcase
    params: [ /* see below */ ],
  });
})();
```

### `register(name, factory, meta)`
- **name** — unique registry key (snake_case). This is what a save file stores.
- **factory(o)** — receives merged `opts` (param defaults already applied) and
  returns a `THREE.Object3D`. Build at the origin; the Scene sets position /
  rotation / scale. `y = 0` is the floor, `+y` up. Keep real-world metres
  (a mug ≈ 0.1 m tall, a chair ≈ 0.9 m).
- **meta** — `{ icon, category, params, wallCut? }`.

### `meta.params` — the tweakable schema
Each entry renders a control in the Properties panel and is the *only* state
saved for the object. Editing a param rebuilds the prefab in place.

```js
{ key: "height", label: "Height", type: "number", min: 0.2, max: 0.45, step: 0.02, default: 0.32 }
```

| `type` | control | `default` example |
|---|---|---|
| `number` | slider (float) | `0.32` |
| `int` | slider (whole) | `6` |
| `color` | swatch → hex **number** | `0x1a3a18` |
| `bool` | checkbox | `true` |
| `select` | dropdown (needs `options:[…]`) | `"round"` |

Read every param off `o` with a fallback: `o.height` (guaranteed present since
defaults are applied) or `_c(o.color, 0x8a6a40)` for colors that may be a hex
string or number.

### `meta.wallCut` (optional)
Marks a door/window-like object so nearby walls auto-open around it:
`{ width, height, sill, widthKey?, heightKey?, sillKey? }`. Name containing
`door`/`window`/`arch`/`gate`/`portal` auto-detects without this.

---

## Helpers (off `window.OBJECTS`)

**Geometry** — each makes a `THREE.Mesh`, positions it, returns it:
```js
_box(w, h, d, mat, [x,y,z])                 // BoxGeometry
_cyl(rTop, rBot, h, mat, [x,y,z], seg)      // CylinderGeometry
_sph(r, mat, [x,y,z], wseg)                 // SphereGeometry
_cone(r, h, mat, [x,y,z], seg)              // ConeGeometry
_tor(r, tube, mat, [x,y,z], radSeg, tubeSeg)// TorusGeometry
```
For anything else, use raw three.js (`THREE.LatheGeometry`, `ShapeGeometry`,
etc.) with a `new THREE.MeshStandardMaterial({ color, roughness, metalness })`.

**Materials** — `M.<name>(color)` returns a tuned `MeshStandardMaterial`:
`M.wood`, `M.stone`, `M.metal`, `M.brass`, `M.leather`, `M.ceramic`,
`M.cloth`, `M.leaf`, `M.glass`. Use these so objects sit consistently in every
room's lighting; only hand-roll a material for glow/emissive/transparency.

**Utility** — `rand(a, b)` (float in range), `pick(arr)` (random element),
`_c(value, default)` (coerce a color opt, hex string *or* number, with fallback).

**Animation** — set `g.userData.tick = (dt) => { … }`. A global ticker calls it
each frame (also during Showcase and cinema recording). Keep it cheap; mutate
`position` / `rotation` / `material.emissiveIntensity`, don't allocate.

```js
let t = rand(0, 6);
g.userData.tick = (dt) => { t += dt; orb.position.y = base + Math.sin(t * 1.6) * 0.05; };
```

---

## Rules & gotchas

1. **Origin-built, floor at y=0.** Most factories build upward from `y=0`. The
   room/Scene applies the transform.
2. **Return one Object3D.** A `Group` for anything multi-mesh.
3. **Metres, roughly real.** Rooms place by real dimensions; a 5-m chair breaks
   layouts.
4. **Colors in params are hex *numbers*** (`0x6b4a2b`), read safely with `_c`.
5. **No external assets / no network.** Pure geometry + the shared materials —
   this is what keeps the app offline-first.
6. **`name` is forever.** It's the save-file key; renaming orphans saved scenes.
7. **`category`** groups the palette and Showcase — reuse existing ones
   (`furniture`, `props`, `kitchen`, `tech`, `structure`, `decorative`,
   `nature`, `wizard projectiles`, …) unless a new set is warranted.
8. **Shell prefabs** `floor` / `wall` / `beam` / `window` are what `rooms.js`
   `buildShell` depends on — don't remove or change their opts
   (`width`/`depth`/`height`/`color`/`length`/`size`/`shape`).

---

## The AI prompt (copy-paste)

> You are authoring low-poly 3D objects for a browser scene builder that uses
> **three.js (global `window.THREE`, r0.137)**. Output **one self-contained JS
> file** — an IIFE — registering one or more parametric prefabs. Do not import
> anything; use only the helpers destructured from `window.OBJECTS`.
>
> **File skeleton:**
> ```js
> // data/objects_<group>.js  — category: "<category>"
> (function () {
>   const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;
>   register("<snake_name>", function (o) {
>     const g = new THREE.Group();
>     // build meshes at the origin, sitting on y=0, in real metres
>     return g;
>   }, {
>     icon: "<emoji>", category: "<category>",
>     params: [
>       { key: "height", label: "Height", type: "number", min: 0.2, max: 0.6, step: 0.02, default: 0.35 },
>       { key: "color",  label: "Color",  type: "color",  default: 0x6b4a2b }
>     ],
>   });
> })();
> ```
>
> **Helpers:** `_box(w,h,d,mat,[x,y,z])`, `_cyl(rTop,rBot,h,mat,[x,y,z],seg)`,
> `_sph(r,mat,[x,y,z],wseg)`, `_cone(r,h,mat,[x,y,z],seg)`,
> `_tor(r,tube,mat,[x,y,z],radSeg,tubeSeg)`. Materials: `M.wood/stone/metal/
> brass/leather/ceramic/cloth/leaf/glass(color)`. Utils: `rand(a,b)`,
> `pick(arr)`, `_c(val,default)` for color opts.
>
> **Rules:** build at the origin sitting on `y=0`, `+y` up, real-world metres.
> Return exactly one `THREE.Object3D` (a `Group` if multi-mesh). Read every
> param off `o` (defaults are pre-applied); color params are hex **numbers** —
> read with `_c(o.color, 0x…)`. Prefer `M.*` materials; only hand-roll a
> `MeshStandardMaterial` for emissive/transparent effects. For motion, set
> `g.userData.tick = (dt) => {…}` (called every frame — cheap, no allocations).
> No imports, no network, no textures — geometry only. Keep polycount modest.
>
> Now build: **<describe the object(s), their look, and which params should be
> tweakable>**.

Save the result as `data/objects_<group>.js` and add its `<script>` tag to
`Scene.html` (after `objects_core.js`) and to the `sw.js` CORE list.
