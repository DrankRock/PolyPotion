// objects_wiz_hogwarts.js — props specific to Hogwarts rooms that were
// missing from the existing categories. Same convention as objects_wiz_*.js:
// register(name, factory, meta) into window.OBJECTS, bare global THREE.
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  // ── Sorting Hat ───────────────────────────────────────────────
  // A battered, patched, slumped wizard's hat. Built as: a drooped brim,
  // a tapering trunk, and a flopped-over tip on a pivot, plus crease folds
  // and patches so it reads as the talking hat rather than a generic cone.
  register("sorting_hat", function (o) {
    const c   = _c(o.color, 0x6b5436);          // worn tan-brown
    const hat = M.leather(c);
    // a slightly darker tone for creases/patches
    const dark = M.leather((((c >> 16 & 255) * 0.7 | 0) << 16) |
                           (((c >> 8 & 255) * 0.7 | 0) << 8)  |
                           ((c & 255) * 0.7 | 0));

    const g = new THREE.Group();

    // Brim — wide, slightly conical disk that droops at the edge.
    const brim = _cyl(0.30, 0.42, 0.06, hat, [0, 0.03, 0], 22);
    g.add(brim);

    // Trunk — truncated cone from brim up to the flop point.
    const trunk = _cyl(0.12, 0.27, 0.50, hat, [0, 0.31, 0], 18);
    g.add(trunk);

    // Flop — a cone that leans over on its own pivot at the trunk top.
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.55, 0);
    const tip = _cone(0.12, 0.46, hat, [0, 0.20, 0], 16); // base sits at pivot
    pivot.add(tip);
    pivot.rotation.z = 0.95;   // lean sideways
    pivot.rotation.x = -0.25;  // and slightly forward
    g.add(pivot);

    // Face creases on the front of the trunk: a wide mouth fold and two brows.
    const mouth = _box(0.20, 0.035, 0.02, dark, [0, 0.30, 0.205]);
    mouth.rotation.x = 0.15;
    g.add(mouth);
    const browL = _box(0.10, 0.03, 0.02, dark, [-0.07, 0.40, 0.165]);
    browL.rotation.z = 0.5; g.add(browL);
    const browR = _box(0.10, 0.03, 0.02, dark, [0.07, 0.40, 0.165]);
    browR.rotation.z = -0.5; g.add(browR);

    // A couple of patches for the stitched-together look.
    const p1 = _box(0.10, 0.10, 0.015, dark, [0.14, 0.34, 0.16]);
    p1.rotation.set(0.1, 0.3, 0.2); g.add(p1);
    const p2 = _box(0.08, 0.12, 0.015, dark, [-0.13, 0.22, 0.15]);
    p2.rotation.set(0, -0.4, -0.15); g.add(p2);

    return g;
  }, {
    icon: "🎩",
    category: "wizard decor",
    params: [
      { key: "color", label: "Felt color", type: "color", default: 0x6b5436 },
    ],
  });
})();
