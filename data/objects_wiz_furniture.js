// AUTO-SPLIT — shared helpers injected so each file is self-contained.
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  function glow(color, intensity = 1.4) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.0 });
  }
  function tglow(color, intensity, opacity) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.0, transparent: true, opacity });
  }
  function jit(hex, a = 0.85, b = 1.12) {
    const r = (hex >> 16) & 255, gg = (hex >> 8) & 255, bl = hex & 255;
    const f = a + Math.random() * (b - a);
    const c = v => Math.max(0, Math.min(255, Math.round(v * f)));
    return (c(r) << 16) | (c(gg) << 8) | c(bl);
  }
  function ghostMat(c, op = 0.5, ei = 0.5) {
    return new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: ei, transparent: true, opacity: op, roughness: 0.4, metalness: 0.0 });
  }
  function makeRune(o, def) {
    const c = _c(o.color, def);
    const g = new THREE.Group();
    const ring = glow(c, 1.3);
    const r1 = _tor(o.size, 0.02, ring, [0, 0.02, 0], 6, 36); r1.rotation.x = Math.PI / 2; g.add(r1);
    const r2 = _tor(o.size * 0.7, 0.015, ring, [0, 0.02, 0], 6, 30); r2.rotation.x = Math.PI / 2; g.add(r2);
    const inner = new THREE.Group();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const mark = _box(0.04, 0.005, o.size * 0.5, glow(c, 1.3), [0, 0.02, 0]); mark.position.set(Math.cos(a) * o.size * 0.35, 0.02, Math.sin(a) * o.size * 0.35); mark.rotation.y = -a; inner.add(mark); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; inner.add(_box(0.03, 0.005, 0.1, glow(c, 1.3), [Math.cos(a) * o.size * 0.85, 0.02, Math.sin(a) * o.size * 0.85])); }
    g.add(inner);
    let t = rand(0, 6), flare = 0;
    g.userData.tick = (dt) => { t += dt; inner.rotation.y += dt * 0.3; const base = 1.0 + (Math.sin(t * 2) + 1) / 2 * 0.6; if (flare > 0) flare -= dt; else if (Math.random() < 0.006) flare = 0.4; ring.emissiveIntensity = flare > 0 ? 2.6 : base; };
    return g;
  }
  function elementalBody(mat) {
    const e = new THREE.Group();
    const torso = _sph(0.22, mat, [0, 0.9, 0], 10); torso.scale.set(1, 1.3, 0.8); e.add(torso);
    e.add(_sph(0.13, mat, [0, 1.3, 0], 10));
    for (const sx of [-1, 1]) { const arm = _cyl(0.07, 0.04, 0.5, mat, [sx * 0.26, 0.9, 0], 6); arm.rotation.z = sx * 0.4; e.add(arm); }
    for (const sx of [-1, 1]) { const leg = _cyl(0.08, 0.05, 0.5, mat, [sx * 0.12, 0.32, 0], 6); e.add(leg); }
    return e;
  }
  function missileStream(o, headFactory) {
    const g = new THREE.Group();
    const range = o.range, size = o.size, speed = o.speed, n = Math.round(o.count);
    const missiles = [];
    for (let i = 0; i < n; i++) { const m = headFactory(o, size); m.position.set(0, o.height, 0); g.add(m); missiles.push({ m, off: i / n }); }
    let phase = rand(0, 1);
    g.userData.tick = (dt) => {
      phase += dt * speed; if (phase >= 1) phase -= 1;
      missiles.forEach((ms) => {
        let p = (phase + ms.off) % 1;
        ms.m.position.x = p * range;
        const fade = p < 0.1 ? p / 0.1 : (p > 0.85 ? (1 - p) / 0.15 : 1);
        ms.m.traverse((c) => { if (c.material && c.material.transparent) c.material.opacity = c.userData._o0 * fade; });
        ms.m.userData.spin && ms.m.userData.spin(dt, p);
      });
    };
    return g;
  }
  function tagOpacity(group) { group.traverse((c) => { if (c.material && c.material.transparent) c.userData._o0 = c.material.opacity; }); return group; }

  register("wand_stand", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(_c(o.color, 0x3a2a1a));
    g.add(_cyl(0.18, 0.2, 0.05, M.stone(), [0, 0.025, 0], 16));   // base
    g.add(_box(0.04, 0.4, 0.04, wd, [-0.08, 0.25, 0]));          // front post
    g.add(_box(0.04, 0.55, 0.04, wd, [0.08, 0.32, 0]));          // back post
    const wand = _cyl(0.012, 0.02, 0.7, wd, [0, 0.42, 0], 8);    // wand
    wand.rotation.z = 0.5;
    g.add(wand);
    g.add(_sph(0.03, glow(_c(o.glow, 0xffe08a), 2.0), [-0.17, 0.73, 0]));  // glowing tip
    return g;
  }, {
    icon: "✶", category: "wizard furniture",
    params: [
      { key: "color", label: "Wood", type: "color", default: 0x3a2a1a },
      { key: "glow",  label: "Tip",  type: "color", default: 0xffe08a },
    ],
  });

  // ── Spellbook lectern ────────────────────────────────────────

  register("spellbook_lectern", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(_c(o.color, 0x4a3420));
    g.add(_cyl(0.22, 0.26, 0.06, wd, [0, 0.03, 0], 16));   // base
    g.add(_cyl(0.05, 0.07, 1.0, wd, [0, 0.5, 0], 8));      // post
    g.add(_box(0.46, 0.05, 0.34, wd, [0, 1.0, 0]));        // flat top
    const pg = M.plaster(0xeae0c8), cov = M.book(_c(o.cover, 0x5a2a6a));
    g.add(_box(0.22, 0.02, 0.3, cov, [-0.115, 1.035, 0])); // left cover
    g.add(_box(0.22, 0.02, 0.3, cov, [ 0.115, 1.035, 0])); // right cover
    const lp = _box(0.2, 0.015, 0.28, pg, [-0.11, 1.05, 0]); lp.rotation.z =  0.08; g.add(lp);
    const rp = _box(0.2, 0.015, 0.28, pg, [ 0.11, 1.05, 0]); rp.rotation.z = -0.08; g.add(rp);
    g.add(_sph(0.08, glow(_c(o.glow, 0x6ad6ff), 1.8), [0, 1.18, 0]));  // rising glow
    return g;
  }, {
    icon: "▤", category: "wizard furniture",
    params: [
      { key: "color", label: "Wood",  type: "color", default: 0x4a3420 },
      { key: "cover", label: "Cover", type: "color", default: 0x5a2a6a },
      { key: "glow",  label: "Glow",  type: "color", default: 0x6ad6ff },
    ],
  });

  // ── Potion cabinet ───────────────────────────────────────────
  // Shelved cabinet filled with faintly glowing potion bottles.

  register("potion_cabinet", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(_c(o.color, 0x3a2a1a));
    const W = o.width, H = o.height, D = 0.3;
    g.add(_box(W, 0.05, D, wd, [0, 0.025, 0]));           // bottom
    g.add(_box(W, 0.05, D, wd, [0, H, 0]));               // top
    g.add(_box(0.05, H, D, wd, [-W / 2, H / 2, 0]));      // left
    g.add(_box(0.05, H, D, wd, [ W / 2, H / 2, 0]));      // right
    g.add(_box(W, H, 0.04, M.wood(0x2a1f14), [0, H / 2, -D / 2]));  // back
    const shelves = Math.max(2, o.shelves);
    const palette = [0x4ad6c0, 0xd64a8a, 0x8a4ad6, 0x4a9ad6, 0xd6c04a, 0x6ad64a, 0xd6804a];
    for (let s = 0; s < shelves; s++) {
      const sy = 0.1 + s * (H - 0.2) / (shelves - 1);
      g.add(_box(W - 0.06, 0.03, D - 0.04, wd, [0, sy, 0]));  // shelf board
      const cols = Math.floor((W - 0.1) / 0.16);
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.2) continue;                    // some gaps
        const bx = -W / 2 + 0.1 + c * 0.16 + rand(-0.01, 0.01);
        const bz = rand(-0.05, 0.05);
        const col = pick(palette), bh = rand(0.12, 0.2);
        g.add(_cyl(0.05, 0.055, bh, M.glass(col), [bx, sy + 0.015 + bh / 2, bz], 8));      // body
        g.add(_cyl(0.018, 0.03, 0.05, M.glass(col), [bx, sy + 0.015 + bh + 0.025, bz], 6)); // neck
        g.add(_sph(0.035, glow(col, 0.5), [bx, sy + 0.015 + bh * 0.4, bz], 8));             // glow
      }
    }
    return g;
  }, {
    icon: "⚗", category: "wizard furniture",
    params: [
      { key: "width",   label: "Width",   type: "number", min: 0.6, max: 2,   step: 0.1, default: 1.0 },
      { key: "height",  label: "Height",  type: "number", min: 1,   max: 2.4, step: 0.1, default: 1.6 },
      { key: "shelves", label: "Shelves", type: "int",    min: 2,   max: 6,   step: 1,   default: 4 },
      { key: "color",   label: "Wood",    type: "color",  default: 0x3a2a1a },
    ],
  });

  // ── Bubbling cauldron ────────────────────────────────────────

  register("owl_perch", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(0x4a3420);
    g.add(_cyl(0.16, 0.2, 0.05, M.stone(), [0, 0.025, 0], 14));  // base
    g.add(_cyl(0.04, 0.05, 1.2, wd, [0, 0.6, 0], 8));            // post
    const cross = _cyl(0.03, 0.03, 0.5, wd, [0, 1.2, 0], 8);     // perch bar
    cross.rotation.z = Math.PI / 2; g.add(cross);
    if (o.owl) {
      const fe = M.cloth(_c(o.color, 0x8a6a4a)), by = 1.34;
      g.add(_sph(0.13, fe, [0, by, 0], 14));                     // body
      g.add(_sph(0.1, fe, [0, by + 0.13, 0], 14));               // head
      g.add(_sph(0.03, glow(0xffd24a, 1.2), [-0.04, by + 0.15, 0.08], 8));  // eyes
      g.add(_sph(0.03, glow(0xffd24a, 1.2), [ 0.04, by + 0.15, 0.08], 8));
      g.add(_cone(0.02, 0.05, M.brass(0xd6a040), [0, by + 0.12, 0.1], 6));  // beak
      g.add(_box(0.1, 0.04, 0.12, fe, [0, by - 0.1, -0.05]));    // tail
    }
    return g;
  }, {
    icon: "◓", category: "wizard furniture",
    params: [
      { key: "owl",   label: "Owl",      type: "bool",  default: true },
      { key: "color", label: "Feathers", type: "color", default: 0x8a6a4a },
    ],
  });

  // ── Levitating books ─────────────────────────────────────────

  register("great_hall_table", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(_c(o.color, 0x5a3a20)), bw = M.wood(0x4a3018);
    const L = o.length, W = 0.9, topY = 0.78;
    g.add(_box(L, 0.06, W, wd, [0, topY, 0]));                          // top
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {              // legs
      g.add(_box(0.1, topY - 0.06, 0.1, wd, [sx * (L / 2 - 0.2), (topY - 0.06) / 2, sz * (W / 2 - 0.15)]));
    }
    for (const sz of [-1, 1]) {                                        // benches
      g.add(_box(L * 0.96, 0.05, 0.28, bw, [0, 0.45, sz * (W / 2 + 0.2)]));
      for (const sx of [-1, 1]) g.add(_box(0.08, 0.45, 0.24, bw, [sx * (L / 2 - 0.4), 0.225, sz * (W / 2 + 0.2)]));
    }
    return g;
  }, {
    icon: "▬", category: "wizard furniture",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.5, max: 6, step: 0.1, default: 3.0 },
      { key: "color",  label: "Wood",   type: "color",  default: 0x5a3a20 },
    ],
  });

  // ── Floating staircase ───────────────────────────────────────
  // A flight of stone steps hovering and gently canting, mid-move.

  register("owlery_roost", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(0x4a3420);
    g.add(_cyl(0.2, 0.26, 0.08, M.stone(), [0, 0.04, 0], 16));          // base
    g.add(_cyl(0.06, 0.08, 2.2, wd, [0, 1.1, 0], 8));                   // post
    const fe = M.cloth(_c(o.color, 0x8a6a4a));
    function owl(x, y, z) {
      g.add(_sph(0.1, fe, [x, y, z], 12));                             // body
      g.add(_sph(0.08, fe, [x, y + 0.1, z], 12));                      // head
      g.add(_sph(0.022, glow(0xffd24a, 1.2), [x - 0.03, y + 0.11, z + 0.06], 6));
      g.add(_sph(0.022, glow(0xffd24a, 1.2), [x + 0.03, y + 0.11, z + 0.06], 6));
      g.add(_cone(0.015, 0.04, M.brass(0xd6a040), [x, y + 0.09, z + 0.08], 6));
    }
    [0.6, 1.1, 1.6].forEach((hy, i) => {
      const a = i * 2.1;
      const perch = _cyl(0.025, 0.025, 0.6, wd, [0, hy, 0], 6);
      perch.rotation.z = Math.PI / 2; perch.rotation.y = a; g.add(perch);
      if (o.owls > i) owl(Math.cos(a) * 0.22, hy + 0.12, Math.sin(a) * 0.22);
    });
    return g;
  }, {
    icon: "♆", category: "wizard furniture",
    params: [
      { key: "owls",  label: "Owls",     type: "int",   min: 0, max: 3, step: 1, default: 3 },
      { key: "color", label: "Feathers", type: "color", default: 0x8a6a4a },
    ],
  });

  // ── Grand hearth ─────────────────────────────────────────────
  // Big stone fireplace with logs and coloured magical flames.

  register("robe_rack", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(0x3a2a1a), cl = M.cloth(_c(o.color, 0x2a2a5a));
    g.add(_cyl(0.22, 0.26, 0.05, M.stone(), [0, 0.025, 0], 14));        // base
    g.add(_cyl(0.04, 0.05, 1.7, wd, [0, 0.85, 0], 8));                  // post
    const bar = _cyl(0.02, 0.02, 0.6, wd, [0, 1.5, 0], 6); bar.rotation.z = Math.PI / 2; g.add(bar);
    g.add(_cyl(0.18, 0.34, 1.0, cl, [0, 0.95, 0.02], 12));              // robe body
    g.add(_sph(0.16, cl, [0, 1.42, 0.02], 12));                        // shoulders
    for (const sx of [-1, 1]) { const sl = _cyl(0.06, 0.05, 0.5, cl, [sx * 0.22, 1.3, 0.02], 8); sl.rotation.z = sx * 0.4; g.add(sl); }
    g.add(_cyl(0.3, 0.32, 0.025, cl, [0, 1.6, 0], 18));                // hat brim
    g.add(_cone(0.2, 0.55, cl, [0, 1.85, 0], 14));                     // hat cone
    return g;
  }, {
    icon: "⍦", category: "wizard furniture",
    params: [
      { key: "color", label: "Robe", type: "color", default: 0x2a2a5a },
    ],
  });

  // ── Enchanted quill ──────────────────────────────────────────
  // A quill writing by itself on parchment, beside an inkpot.

  register("four_poster_bed", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)); const cl = M.cloth(_c(o.fabric, 0x5a2a3a));
    const W = o.width, L = 2.0, ph = 2.0;
    g.add(_box(W, 0.2, L, M.fabric(0xe0d8c0), [0, 0.45, 0]));
    g.add(_box(W + 0.04, 0.15, L + 0.04, wd, [0, 0.3, 0]));
    g.add(_box(W * 0.8, 0.12, 0.3, M.fabric(0xf0e8d8), [0, 0.58, -L / 2 + 0.25]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_cyl(0.05, 0.06, ph, wd, [sx * W / 2, ph / 2, sz * L / 2], 8));
    g.add(_box(W + 0.1, 0.06, 0.06, wd, [0, ph, -L / 2])); g.add(_box(W + 0.1, 0.06, 0.06, wd, [0, ph, L / 2]));
    g.add(_box(0.06, 0.06, L, wd, [-W / 2, ph, 0])); g.add(_box(0.06, 0.06, L, wd, [W / 2, ph, 0]));
    g.add(_box(W + 0.1, 0.04, L, cl, [0, ph + 0.05, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.04, ph - 0.5, 0.5, cl, [sx * W / 2, ph / 2, -L / 2 + 0.25]));
    return g;
  }, { icon: "⊟", category: "wizard furniture", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 1.8, step: 0.1, default: 1.2 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 },
    { key: "fabric", label: "Curtains", type: "color", default: 0x5a2a3a }] });

  register("wingback_chair", function (o) {
    const g = new THREE.Group(); const cl = M.fabric(_c(o.color, 0x6a1a1a)); const wd = M.wood(0x3a2414);
    g.add(_box(0.55, 0.12, 0.55, cl, [0, 0.45, 0]));
    g.add(_box(0.5, 0.12, 0.5, cl, [0, 0.55, 0]));
    g.add(_box(0.55, 0.9, 0.12, cl, [0, 0.95, -0.22]));
    for (const sx of [-1, 1]) g.add(_box(0.12, 0.6, 0.3, cl, [sx * 0.28, 0.85, -0.05]));
    for (const sx of [-1, 1]) g.add(_box(0.12, 0.18, 0.5, cl, [sx * 0.28, 0.6, 0.02]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.06, 0.4, 0.06, wd, [sx * 0.22, 0.2, sz * 0.22]));
    return g;
  }, { icon: "⑁", category: "wizard furniture", params: [
    { key: "color", label: "Fabric", type: "color", default: 0x6a1a1a }] });

  register("apothecary_shelf", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2a1a)); const W = o.width, H = o.height, D = 0.25;
    g.add(_box(0.04, H, D, wd, [-W / 2, H / 2, 0])); g.add(_box(0.04, H, D, wd, [W / 2, H / 2, 0]));
    g.add(_box(W, 0.04, D, wd, [0, H, 0])); g.add(_box(W, H, 0.03, M.wood(0x2a1f14), [0, H / 2, -D / 2]));
    const shelves = Math.max(3, o.shelves); const jarcol = [0xc8b890, 0x8a6a4a, 0x6a8a5a, 0xd6c8a0, 0x9a7a5a, 0xb8a878];
    for (let s = 0; s < shelves; s++) { const sy = 0.1 + s * (H - 0.15) / (shelves - 1); g.add(_box(W - 0.04, 0.025, D - 0.03, wd, [0, sy, 0]));
      const cols = Math.floor((W - 0.06) / 0.14);
      for (let c = 0; c < cols; c++) { if (Math.random() < 0.15) continue; const x = -W / 2 + 0.05 + c * 0.14 + 0.07, jh = rand(0.1, 0.16);
        g.add(_cyl(0.05, 0.05, jh, M.glass(0xc8d8d0), [x, sy + 0.012 + jh / 2, 0], 8));
        g.add(_cyl(0.05, 0.05, 0.03, M.wood(0x5a3a1a), [x, sy + 0.012 + jh, 0], 8));
        g.add(_box(0.06, jh * 0.5, 0.04, M.plaster(0xe8dcc0), [x, sy + 0.012 + jh * 0.45, 0.04]));
        g.add(_cyl(0.04, 0.04, jh * 0.6, M.cloth(pick(jarcol)), [x, sy + 0.012 + jh * 0.35, 0], 8)); } }
    return g;
  }, { icon: "⊪", category: "wizard furniture", params: [
    { key: "width", label: "Width", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.8 },
    { key: "height", label: "Height", type: "number", min: 1.2, max: 2.4, step: 0.1, default: 1.8 },
    { key: "shelves", label: "Shelves", type: "int", min: 3, max: 7, step: 1, default: 5 },
    { key: "color", label: "Wood", type: "color", default: 0x3a2a1a }] });

  register("wand_case", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)); const W = 0.9, D = 0.4;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.05, 0.5, 0.05, wd, [sx * (W / 2 - 0.05), 0.25, sz * (D / 2 - 0.05)]));
    g.add(_box(W, 0.12, D, wd, [0, 0.56, 0]));
    g.add(_box(W - 0.06, 0.02, D - 0.06, M.felt(0x3a1a2a), [0, 0.63, 0]));
    for (let i = 0; i < 5; i++) { const z = -D / 2 + 0.08 + i * (D - 0.16) / 4; const wand = _cyl(0.01, 0.016, 0.6, M.wood(pick([0x3a2414, 0x5a3a1a, 0x2a1a10, 0x6a4a2a])), [0, 0.66, z], 6); wand.rotation.z = Math.PI / 2; g.add(wand); }
    g.add(_box(W, 0.4, D, M.glass(0xbcd0d8), [0, 0.86, 0]));
    return g;
  }, { icon: "⊏", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("scroll_rack", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3420)); const W = o.width, H = o.height, D = 0.35;
    g.add(_box(0.04, H, D, wd, [-W / 2, H / 2, 0])); g.add(_box(0.04, H, D, wd, [W / 2, H / 2, 0]));
    g.add(_box(W, 0.04, D, wd, [0, H, 0])); g.add(_box(W, 0.04, D, wd, [0, 0, 0]));
    g.add(_box(W, H, 0.03, M.wood(0x2a1f14), [0, H / 2, -D / 2]));
    const rows = Math.max(2, o.rows), cols = Math.max(2, o.cols);
    for (let r = 1; r < rows; r++) g.add(_box(W, 0.03, D, wd, [0, r * H / rows, 0]));
    for (let c = 1; c < cols; c++) g.add(_box(0.03, H, D, wd, [-W / 2 + c * W / cols, H / 2, 0]));
    const pap = M.plaster(0xe8dcc0);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (Math.random() < 0.3) continue; const cx = -W / 2 + (c + 0.5) * W / cols, cy = (r + 0.5) * H / rows, k = 1 + Math.floor(Math.random() * 2);
      for (let s = 0; s < k; s++) { const sc = _cyl(0.03, 0.03, D * 0.7, pap, [cx + rand(-0.03, 0.03), cy + rand(-0.02, 0.02), 0.02], 8); sc.rotation.x = Math.PI / 2; g.add(sc); } }
    return g;
  }, { icon: "⊟", category: "wizard furniture", params: [
    { key: "width", label: "Width", type: "number", min: 0.6, max: 1.6, step: 0.1, default: 1.0 },
    { key: "height", label: "Height", type: "number", min: 1, max: 2.2, step: 0.1, default: 1.4 },
    { key: "rows", label: "Rows", type: "int", min: 2, max: 6, step: 1, default: 3 },
    { key: "cols", label: "Cols", type: "int", min: 2, max: 6, step: 1, default: 4 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3420 }] });

  // ═══ FEAST & KITCHEN ═════════════════════════════════════════

  register("cauldron_shelf", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x3a2a1a); const ir = M.metal(0x2a2520); const W = o.width, H = 1.0, D = 0.4;
    g.add(_box(0.05, H, D, wd, [-W / 2, H / 2, 0])); g.add(_box(0.05, H, D, wd, [W / 2, H / 2, 0]));
    g.add(_box(W, 0.04, D, wd, [0, H, 0])); g.add(_box(W, 0.04, D, wd, [0, H / 2, 0])); g.add(_box(W, 0.04, D, wd, [0, 0.02, 0]));
    function caul(x, y, r) { g.add(_cyl(r, r * 0.55, r, ir, [x, y + r * 0.5, 0], 14)); g.add(_sph(r * 0.55, ir, [x, y, 0], 10)); }
    caul(-W / 2 + 0.25, 0.06, 0.18); caul(0, 0.06, 0.22); caul(W / 2 - 0.22, 0.06, 0.16);
    caul(-W / 2 + 0.22, H / 2 + 0.04, 0.14); caul(0.1, H / 2 + 0.04, 0.18);
    return g;
  }, { icon: "⊍", category: "wizard furniture", params: [
    { key: "width", label: "Width", type: "number", min: 0.8, max: 2, step: 0.1, default: 1.2 }] });

  // ═══ HERBOLOGY & GREENHOUSE ══════════════════════════════════

  register("planting_bench", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a4028)); const W = o.width, D = 0.5, topY = 0.85;
    g.add(_box(W, 0.05, D, wd, [0, topY, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.06, topY, 0.06, wd, [sx * (W / 2 - 0.05), topY / 2, sz * (D / 2 - 0.05)]));
    g.add(_box(W, 0.4, 0.04, wd, [0, topY + 0.25, -D / 2]));
    g.add(_box(W, 0.04, 0.15, wd, [0, topY + 0.45, -D / 2 + 0.08]));
    g.add(_box(0.4, 0.1, 0.3, M.wood(0x2a1a0e), [-W * 0.2, topY + 0.07, 0]));
    for (let i = 0; i < 3; i++) g.add(_cyl(0.07, 0.05, 0.12, M.ceramic(0x9a5a3a), [W * 0.1 + i * 0.16, topY + 0.09, 0.1], 10));
    g.add(_cone(0.04, 0.16, M.leaf(0x4a8a30), [W * 0.1, topY + 0.2, 0.1], 4));
    g.add(_box(0.02, 0.02, 0.18, M.metal(), [-W * 0.35, topY + 0.04, 0.15]));
    return g;
  }, { icon: "⊻", category: "wizard furniture", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 2.4, step: 0.1, default: 1.4 },
    { key: "color", label: "Wood", type: "color", default: 0x5a4028 }] });

  // ═══ ASTRONOMY ═══════════════════════════════════════════════

  register("broomstick_rack", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3420)); const W = o.width;
    g.add(_box(W, 0.06, 0.3, wd, [0, 0.03, 0]));
    g.add(_box(W, 0.06, 0.06, wd, [0, 1.4, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.05, 1.4, 0.05, wd, [sx * (W / 2 - 0.03), 0.7, -0.1]));
    const n = Math.max(2, o.count), straw = M.straw();
    for (let i = 0; i < n; i++) { const x = -W / 2 + 0.15 + i * (W - 0.3) / (n - 1);
      g.add(_cyl(0.02, 0.025, 1.3, M.wood(0x5a3a1a), [x, 0.7, 0], 6));
      for (let b = 0; b < 8; b++) { const a = rand(0, Math.PI * 2), rr = rand(0, 0.04); const br = _cyl(0.005, 0.007, 0.25, straw, [x + Math.cos(a) * rr, 0.18, Math.sin(a) * rr], 4); br.rotation.x = rand(-0.1, 0.1); br.rotation.z = rand(-0.1, 0.1); g.add(br); }
      g.add(_cyl(0.035, 0.035, 0.05, M.leather(), [x, 0.32, 0], 6)); }
    return g;
  }, { icon: "♣", category: "wizard furniture", params: [
    { key: "width", label: "Width", type: "number", min: 0.6, max: 2, step: 0.1, default: 1.2 },
    { key: "count", label: "Brooms", type: "int", min: 2, max: 6, step: 1, default: 3 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3420 }] });

  register("trophy_case", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)), gl = M.glass(0xcfe0e8), br = M.brass();
    const W = 1.0, H = 1.8, D = 0.4;
    g.add(_box(W, 0.1, D, wd, [0, 0.05, 0])); g.add(_box(W, 0.08, D, wd, [0, H, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_cyl(0.03, 0.03, H, wd, [sx * (W / 2 - 0.04), H / 2, sz * (D / 2 - 0.04)], 6));
    g.add(_box(W - 0.08, H - 0.15, 0.02, gl, [0, H / 2, D / 2 - 0.03]));
    for (let s = 0; s < 3; s++) { const sy = 0.25 + s * ((H - 0.4) / 3); g.add(_box(W - 0.1, 0.03, D - 0.05, wd, [0, sy, 0]));
      const tx = rand(-0.25, 0.25); g.add(_cyl(0.06, 0.09, 0.04, br, [tx, sy + 0.04, 0], 12)); g.add(_cyl(0.015, 0.015, 0.12, br, [tx, sy + 0.12, 0], 8)); g.add(_sph(0.07, br, [tx, sy + 0.22, 0], 12)); }
    return g;
  }, { icon: "🏆", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("brewing_bench", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), cm = M.metal(0x222018); const L = 1.2;
    g.add(_box(L, 0.06, 0.5, wd, [0, 0.78, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.06, 0.78, 0.06, wd, [sx * (L / 2 - 0.06), 0.39, sz * 0.2]));
    for (const x of [-0.3, 0.3]) { const c = _sph(0.12, cm, [x, 0.9, 0], 12); c.scale.y = 0.8; g.add(c); g.add(_cyl(0.1, 0.1, 0.02, glow(pick([0x4ad67a, 0x8a4ad6, 0xd64a6a]), 0.7), [x, 0.98, 0], 12)); }
    for (let i = 0; i < 3; i++) g.add(_cyl(0.03, 0.04, rand(0.1, 0.16), M.glass(pick([0x4a8ad6, 0xd64a6a, 0x4ad6a0])), [(i - 1) * 0.12, 0.86, 0.18], 8));
    g.add(_box(0.2, 0.03, 0.16, M.book(0x8a3020), [0, 0.81, -0.16]));
    return g;
  }, { icon: "⚱", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  register("vial_rack", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)); const n = o.count, W = n * 0.1 + 0.1;
    g.add(_box(W, 0.04, 0.12, wd, [0, 0.3, 0])); g.add(_box(W, 0.04, 0.12, wd, [0, 0.05, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.04, 0.3, 0.12, wd, [sx * (W / 2 - 0.02), 0.15, 0]));
    const cols = [0x4ad6a0, 0xd64a6a, 0x4a8ad6, 0xd6c04a, 0x8a4ad6];
    for (let i = 0; i < n; i++) { const x = -W / 2 + 0.1 + i * 0.1; g.add(_cyl(0.03, 0.03, 0.22, M.glass(0xcfe0e8), [x, 0.18, 0], 8)); g.add(_cyl(0.025, 0.025, 0.1, glow(pick(cols), 0.5), [x, 0.12, 0], 8)); }
    return g;
  }, { icon: "⚗", category: "wizard furniture", params: [
    { key: "count", label: "Vials", type: "int", min: 3, max: 10, step: 1, default: 6 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  register("tome_shelf", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)); const W = o.width, H = 1.9, D = 0.32;
    g.add(_box(0.06, H, D, wd, [-W / 2, H / 2, 0])); g.add(_box(0.06, H, D, wd, [W / 2, H / 2, 0]));
    g.add(_box(W, 0.06, D, wd, [0, H, 0])); g.add(_box(W, 0.06, D, wd, [0, 0.03, 0])); g.add(_box(W, 0.05, D, wd, [0, H / 2, -D / 2 + 0.02]));
    const cols = [0x6a1a2a, 0x1a3a6a, 0x2a5a2a, 0x5a4a1a, 0x3a1a5a];
    for (let s = 0; s < 5; s++) { const sy = 0.1 + s * ((H - 0.2) / 5); g.add(_box(W - 0.12, 0.04, D, wd, [0, sy, 0]));
      let x = -W / 2 + 0.1; while (x < W / 2 - 0.1) { const bw = rand(0.04, 0.08), bh = rand(0.18, 0.26); const bm = (rand(0, 1) < 0.25) ? glow(pick(cols), 0.5) : M.book(pick(cols)); g.add(_box(bw, bh, D - 0.06, bm, [x + bw / 2, sy + bh / 2 + 0.04, 0])); x += bw + 0.005; } }
    return g;
  }, { icon: "▦", category: "wizard furniture", params: [
    { key: "width", label: "Width", type: "number", min: 0.8, max: 3, step: 0.1, default: 1.4 },
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("divination_table", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)), cloth = M.cloth(_c(o.cloth, 0x4a1a4a));
    g.add(_cyl(0.5, 0.5, 0.05, cloth, [0, 0.75, 0], 20));
    g.add(_cyl(0.06, 0.08, 0.75, wd, [0, 0.375, 0], 10));
    g.add(_cyl(0.35, 0.4, 0.04, wd, [0, 0.02, 0], 16));
    g.add(_cyl(0.08, 0.1, 0.06, M.brass(), [0, 0.8, 0], 12));
    g.add(_sph(0.1, glow(_c(o.glow, 0x8a8aff), 1.2), [0, 0.92, 0], 14));
    for (let i = 0; i < 4; i++) { const cd = _box(0.08, 0.005, 0.13, M.plaster(0xe8dcc0), [0.25 + i * 0.02, 0.78, 0.1]); cd.rotation.y = i * 0.2; g.add(cd); }
    g.add(_cyl(0.025, 0.03, 0.1, M.wax(0xe8dcc0), [-0.28, 0.83, -0.1], 6)); g.add(_cone(0.018, 0.04, glow(0xffcf6a, 2.0), [-0.28, 0.9, -0.1], 6));
    return g;
  }, { icon: "🔮", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 },
    { key: "cloth", label: "Cloth", type: "color", default: 0x4a1a4a },
    { key: "glow", label: "Orb", type: "color", default: 0x8a8aff }] });

  register("creature_cage", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520); const R = 0.3, H = 0.6;
    g.add(_cyl(R + 0.04, R + 0.06, 0.05, M.wood(0x3a2414), [0, 0.025, 0], 16));
    for (let i = 0; i < 10; i++) { const a = i * Math.PI * 2 / 10; g.add(_cyl(0.012, 0.012, H, ir, [Math.cos(a) * R, H / 2 + 0.05, Math.sin(a) * R], 4)); }
    const ring = _tor(R, 0.015, ir, [0, H + 0.05, 0], 6, 18); ring.rotation.x = Math.PI / 2; g.add(ring);
    for (let i = 0; i < 6; i++) { const rib = _tor(R, 0.012, ir, [0, H + 0.05, 0], 4, 12); rib.rotation.y = i * Math.PI / 3; g.add(rib); }
    g.add(_sph(0.04, ir, [0, H + 0.2, 0], 8));
    g.add(_sph(0.1, glow(_c(o.glow, 0x8aff6a), 1.4), [0, 0.2, 0], 10));
    return g;
  }, { icon: "⌬", category: "wizard furniture", params: [
    { key: "glow", label: "Creature", type: "color", default: 0x8aff6a }] });

  register("school_desk", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x6a4a28)), m = M.metal(0x2a2520);
    const W = 0.7, D = 0.5, topY = 0.72;
    const lid = _box(W, 0.04, D, wd, [0, topY, 0]); lid.rotation.x = -0.18; g.add(lid);
    g.add(_box(W, 0.04, 0.06, wd, [0, topY + 0.08, -D / 2 + 0.03]));            // pen ledge
    g.add(_cyl(0.03, 0.03, 0.04, M.glass(0x223344), [W / 2 - 0.12, topY + 0.1, -D / 2 + 0.06], 8)); // inkwell
    g.add(_box(W, 0.18, D, wd, [0, topY - 0.13, 0]));                           // box
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_cyl(0.02, 0.02, topY - 0.22, m, [sx * (W / 2 - 0.05), (topY - 0.22) / 2, sz * (D / 2 - 0.05)], 6));
    return g;
  }, { icon: "🎒", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x6a4a28 }] });

  register("school_bench", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3a20)); const L = o.length;
    g.add(_box(L, 0.05, 0.28, wd, [0, 0.45, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.06, 0.45, 0.24, wd, [sx * (L / 2 - 0.1), 0.225, 0]));
    g.add(_box(L - 0.3, 0.04, 0.04, wd, [0, 0.2, 0]));                          // stretcher
    return g;
  }, { icon: "▭", category: "wizard furniture", params: [
    { key: "length", label: "Length", type: "number", min: 0.6, max: 2.5, step: 0.1, default: 1.2 },
    { key: "color", label: "Wood", type: "color", default: 0x5a3a20 }] });

  register("teacher_desk", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), br = M.brass();
    const W = 1.4, D = 0.7, topY = 0.78;
    g.add(_box(W, 0.05, D, wd, [0, topY, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.05, topY - 0.05, D, wd, [sx * (W / 2 - 0.03), (topY - 0.05) / 2, 0]));
    g.add(_box(W - 0.1, topY - 0.2, 0.04, wd, [0, (topY - 0.2) / 2 + 0.1, D / 2 - 0.03]));
    for (const sx of [-1, 1]) { g.add(_box(0.4, 0.16, 0.04, wd, [sx * 0.4, topY - 0.15, D / 2 - 0.01])); g.add(_sph(0.02, br, [sx * 0.4, topY - 0.15, D / 2 + 0.01], 8)); }
    return g;
  }, { icon: "🗄", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  register("wood_stool", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3a1a)); const H = o.height;
    g.add(_cyl(0.16, 0.16, 0.05, wd, [0, H, 0], 14));
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; const leg = _cyl(0.022, 0.028, H, wd, [Math.cos(a) * 0.12, H / 2, Math.sin(a) * 0.12], 6); leg.rotation.x = Math.sin(a) * 0.18; leg.rotation.z = -Math.cos(a) * 0.18; g.add(leg); }
    return g;
  }, { icon: "🪑", category: "wizard furniture", params: [
    { key: "height", label: "Height", type: "number", min: 0.3, max: 0.7, step: 0.05, default: 0.45 },
    { key: "color", label: "Wood", type: "color", default: 0x5a3a1a }] });

  register("wooden_chair", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3a1a));
    g.add(_box(0.4, 0.05, 0.4, wd, [0, 0.45, 0]));
    g.add(_box(0.4, 0.5, 0.05, wd, [0, 0.7, -0.18]));
    for (let i = 0; i < 2; i++) g.add(_box(0.34, 0.04, 0.04, wd, [0, 0.62 + i * 0.16, -0.16]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_cyl(0.025, 0.025, 0.45, wd, [sx * 0.16, 0.225, sz * 0.16], 6));
    return g;
  }, { icon: "🪑", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x5a3a1a }] });

  register("wooden_pew", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)); const L = o.length;
    g.add(_box(L, 0.06, 0.4, wd, [0, 0.45, 0]));
    g.add(_box(L, 0.55, 0.05, wd, [0, 0.72, -0.18]));
    for (let i = 0; i < 3; i++) g.add(_box(0.08, 0.45, 0.4, wd, [(i - 1) * (L / 2 - 0.2), 0.225, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.08, 0.1, 0.4, wd, [sx * (L / 2 - 0.04), 0.55, 0]));
    return g;
  }, { icon: "🛋", category: "wizard furniture", params: [
    { key: "length", label: "Length", type: "number", min: 1, max: 3.5, step: 0.1, default: 1.6 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  register("tall_armoire", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)), br = M.brass();
    const W = 1.0, H = 2.0, D = 0.55;
    g.add(_box(W, H, D, wd, [0, H / 2, 0]));
    for (const sx of [-1, 1]) { g.add(_box(W / 2 - 0.06, H - 0.2, 0.04, M.wood(0x4a3018), [sx * W / 4, H / 2, D / 2 - 0.01]));
      for (let r = 0; r < 2; r++) g.add(_box(W / 2 * 0.55, H * 0.32, 0.02, M.wood(0x2a1a10), [sx * W / 4, H * (0.32 + r * 0.36), D / 2 + 0.01]));
      g.add(_sph(0.025, br, [sx * 0.06, H * 0.5, D / 2 + 0.03], 8)); }
    g.add(_box(W + 0.1, 0.12, D + 0.08, wd, [0, H + 0.02, 0]));
    g.add(_box(W + 0.05, 0.12, D + 0.04, wd, [0, 0.06, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.08, 0.1, 0.08, wd, [sx * (W / 2 - 0.06), 0.05, sz * (D / 2 - 0.06)]));
    return g;
  }, { icon: "🗄", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("ornate_throne", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)), cl = M.fabric(_c(o.cloth, 0x6a1a2a)), br = M.brass();
    g.add(_box(0.6, 0.1, 0.55, wd, [0, 0.5, 0]));
    g.add(_box(0.55, 0.06, 0.5, cl, [0, 0.56, 0]));
    g.add(_box(0.6, 1.3, 0.08, wd, [0, 1.1, -0.24]));
    g.add(_box(0.5, 1.0, 0.04, cl, [0, 1.05, -0.2]));
    for (const sx of [-1, 1]) g.add(_sph(0.06, br, [sx * 0.28, 1.78, -0.24], 10));
    for (const sx of [-1, 1]) { g.add(_box(0.1, 0.1, 0.5, wd, [sx * 0.3, 0.75, 0])); g.add(_sph(0.06, br, [sx * 0.3, 0.82, 0.24], 10)); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.08, 0.5, 0.08, wd, [sx * 0.25, 0.25, sz * 0.22]));
    return g;
  }, { icon: "👑", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 },
    { key: "cloth", label: "Cushion", type: "color", default: 0x6a1a2a }] });

  register("side_table", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)); const R = o.radius, H = o.height;
    g.add(_cyl(R, R, 0.04, wd, [0, H, 0], 16));
    g.add(_cyl(0.04, 0.05, H - 0.04, wd, [0, (H - 0.04) / 2, 0], 8));
    g.add(_cyl(R * 0.6, R * 0.7, 0.04, wd, [0, 0.02, 0], 16));
    return g;
  }, { icon: "🛟", category: "wizard furniture", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.3 },
    { key: "height", label: "Height", type: "number", min: 0.4, max: 0.9, step: 0.05, default: 0.6 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  register("washstand", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), cer = M.ceramic(_c(o.basin, 0xe8e8ec));
    g.add(_box(0.5, 0.04, 0.4, wd, [0, 0.78, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.04, 0.78, 0.04, wd, [sx * 0.22, 0.39, sz * 0.17]));
    g.add(_box(0.5, 0.04, 0.4, wd, [0, 0.4, 0]));
    g.add(_cyl(0.18, 0.14, 0.08, cer, [0, 0.84, 0], 16));
    g.add(_cyl(0.15, 0.15, 0.02, glow(0x6a8ad6, 0.3), [0, 0.86, 0], 16));
    g.add(_cyl(0.06, 0.08, 0.16, cer, [0.12, 0.5, 0.05], 12));
    g.add(_tor(0.04, 0.012, cer, [0.18, 0.54, 0.05], 6, 12));
    return g;
  }, { icon: "🚿", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 },
    { key: "basin", label: "Basin", type: "color", default: 0xe8e8ec }] });

  // ════════════════════════════════════════════════════════════
  //  COLUMNS, STRUCTURE & CEILING
  // ════════════════════════════════════════════════════════════

  register("cartography_table", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)); const W = 1.2, D = 0.8, H = 0.78;
    g.add(_box(W, 0.05, D, wd, [0, H, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.06, H, 0.06, wd, [sx * (W / 2 - 0.08), H / 2, sz * (D / 2 - 0.08)]));
    for (const sx of [-1, 1]) g.add(_box(0.04, 0.04, D, wd, [sx * W / 2, H + 0.02, 0]));
    for (const sz of [-1, 1]) g.add(_box(W, 0.04, 0.04, wd, [0, H + 0.02, sz * D / 2]));
    g.add(_box(W - 0.1, 0.01, D - 0.1, M.plaster(0xd8c89a), [0, H + 0.03, 0]));
    const gm = glow(_c(o.glow, 0x6a8a5a), 0.5);
    for (let i = 0; i < 6; i++) { const seg = _box(rand(0.1, 0.4), 0.012, 0.02, gm, [rand(-W / 2 + 0.1, W / 2 - 0.1), H + 0.04, rand(-D / 2 + 0.1, D / 2 - 0.1)]); seg.rotation.y = rand(0, Math.PI); g.add(seg); }
    for (let i = 0; i < 3; i++) g.add(_cyl(0.008, 0.008, 0.06, M.metal(0xd62a2a), [rand(-0.4, 0.4), H + 0.06, rand(-0.3, 0.3)], 4));
    return g;
  }, { icon: "🗺", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 },
    { key: "glow", label: "Map ink", type: "color", default: 0x6a8a5a }] });

  register("squashy_armchair", function (o) {
    const g = new THREE.Group(); const f = M.fabric(_c(o.color, 0x7a2a2a)), w = M.wood(0x3a281a);
    g.add(_box(0.7, 0.28, 0.7, f, [0, 0.34, 0])); g.children[0].scale.set(1, 1, 1);
    g.add(_box(0.74, 0.16, 0.66, f, [0, 0.5, 0]));      // seat cushion
    g.add(_box(0.74, 0.5, 0.16, f, [0, 0.7, -0.27]));   // back
    for (const sx of [-1, 1]) g.add(_box(0.16, 0.42, 0.66, f, [sx * 0.29, 0.62, 0])); // arms
    for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) g.add(_cyl(0.04, 0.04, 0.2, w, [x, 0.1, z], 8));
    return g;
  }, { icon: "🛋", category: "wizard furniture", params: [
    { key: "color", label: "Fabric", type: "color", default: 0x7a2a2a }] });

  register("floor_pouffe", function (o) {
    const g = new THREE.Group(); const f = M.fabric(_c(o.color, 0x3a5a3a));
    g.add(_cyl(0.3, 0.32, 0.26, f, [0, 0.13, 0], 16));
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(_box(0.02, 0.26, 0.04, M.cloth(0x2a3a2a), [Math.cos(a) * 0.31, 0.13, Math.sin(a) * 0.31])); g.children[g.children.length - 1].rotation.y = -a; }
    g.add(_cyl(0.06, 0.06, 0.03, M.cloth(0x2a3a2a), [0, 0.26, 0], 10));
    return g;
  }, { icon: "🟢", category: "wizard furniture", params: [
    { key: "color", label: "Fabric", type: "color", default: 0x3a5a3a }] });

  register("potting_table", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a4028)), soil = M.stone(0x3a2a1a), pot = M.ceramic(0xa05a3a);
    g.add(_box(1.1, 0.05, 0.5, wd, [0, 0.78, 0]));
    g.add(_box(1.1, 0.12, 0.5, wd, [0, 0.05, 0]));        // lower shelf with soil heap
    g.add(_box(0.3, 0.1, 0.3, soil, [-0.3, 0.16, 0]));
    for (const [x, z] of [[-0.05, 0.5], [0.05, 0.5], [-0.05, -0.5], [0.05, -0.5]]) g.add(_cyl(0.03, 0.03, 0.78, wd, [x * 9, 0.39, z * 0.42], 6));
    for (const x of [0.2, 0.35]) { g.add(_cyl(0.07, 0.05, 0.12, pot, [x, 0.87, 0.1], 10)); g.add(_cyl(0.06, 0.06, 0.04, soil, [x, 0.93, 0.1], 10)); }
    g.add(_box(0.18, 0.08, 0.12, soil, [-0.2, 0.84, -0.1])); // soil pile on top
    return g;
  }, { icon: "🪴", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x5a4028 }] });

  register("practice_effigy", function (o) {
    const g = new THREE.Group(); const burl = M.straw(_c(o.color, 0xb89048)), wd = M.wood(0x4a3018);
    g.add(_cyl(0.2, 0.24, 0.06, wd, [0, 0.03, 0], 12));
    g.add(_cyl(0.04, 0.05, 1.0, wd, [0, 0.5, 0], 8));
    g.add(_sph(0.14, burl, [0, 1.05, 0], 10));            // head
    g.add(_cyl(0.16, 0.14, 0.4, burl, [0, 0.75, 0], 10)); // body
    g.add(_box(0.5, 0.08, 0.08, burl, [0, 0.85, 0]));     // arms
    const targ = _tor(0.1, 0.02, glow(0xd23a3a, 0.8), [0, 0.75, 0.14], 6, 18); g.add(targ);
    g.add(_cyl(0.04, 0.04, 0.01, glow(0xffd24a, 0.8), [0, 0.75, 0.15], 12));
    return g;
  }, { icon: "🎯", category: "wizard furniture", params: [
    { key: "color", label: "Straw", type: "color", default: 0xb89048 }] });

  register("music_stand", function (o) {
    const g = new THREE.Group(); const m = M.metal(_c(o.color, 0x2a2520)), pap = M.plaster(0xf0e8d8);
    g.add(_cyl(0.16, 0.18, 0.02, m, [0, 0.01, 0], 12));
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const leg = _cyl(0.01, 0.012, 0.3, m, [Math.cos(a) * 0.1, 0.15, Math.sin(a) * 0.1], 5); leg.rotation.x = Math.sin(a) * 0.4; leg.rotation.z = -Math.cos(a) * 0.4; g.add(leg); }
    g.add(_cyl(0.012, 0.012, 0.9, m, [0, 0.6, 0], 6));
    const tray = new THREE.Group(); tray.add(_box(0.4, 0.3, 0.015, pap, [0, 0, 0])); tray.add(_box(0.42, 0.03, 0.03, m, [0, -0.15, 0.01]));
    tray.position.set(0, 1.05, 0.03); tray.rotation.x = -0.4; g.add(tray);
    return g;
  }, { icon: "🎼", category: "wizard furniture", params: [
    { key: "color", label: "Metal", type: "color", default: 0x2a2520 }] });

  register("stone_bathtub", function (o) {
    const g = new THREE.Group(); const st = M.marble(_c(o.color, 0xd0c8bc)), w = tglow(0x4a90c0, 0.2, 0.5);
    g.add(_cyl(0.5, 0.46, 0.5, st, [0, 0.25, 0], 18)); g.children[0].scale.x = 1.6;
    g.add(_cyl(0.44, 0.42, 0.46, M.stone(0x2a2620), [0, 0.27, 0], 18)); g.children[1].scale.x = 1.55; // inner cavity (dark)
    g.add(_cyl(0.42, 0.42, 0.02, w, [0, 0.46, 0], 18)); g.children[2].scale.x = 1.5; // water surface
    for (const sx of [-1, 1]) g.add(_tor(0.05, 0.012, M.brass(0xc8a050), [sx * 0.7, 0.4, 0], 6, 14));
    g.add(_cyl(0.025, 0.03, 0.12, M.brass(0xc8a050), [0, 0.5, 0.18], 8)); // tap
    return g;
  }, { icon: "🛁", category: "wizard furniture", params: [
    { key: "color", label: "Marble", type: "color", default: 0xd0c8bc }] });

  register("linen_rail", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a4028)), cl = M.fabric(_c(o.linen, 0xe8e0d0));
    for (const sx of [-1, 1]) { g.add(_cyl(0.025, 0.03, 0.9, wd, [sx * 0.35, 0.45, 0], 8)); g.add(_box(0.15, 0.04, 0.15, wd, [sx * 0.35, 0.02, 0])); }
    for (const yy of [0.85, 0.55]) g.add(_cyl(0.015, 0.015, 0.7, wd, [0, yy, 0], 8)).rotation.z = Math.PI / 2;
    for (let i = 0; i < 3; i++) { const x = -0.2 + i * 0.2; g.add(_box(0.14, 0.4, 0.02, cl, [x, 0.65, 0.02])); g.children[g.children.length - 1].rotation.z = rand(-0.05, 0.05); }
    return g;
  }, { icon: "🧺", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x5a4028 },
    { key: "linen", label: "Linen", type: "color", default: 0xe8e0d0 }] });

  register("privacy_screen", function (o) {
    const g = new THREE.Group(); const fr = M.wood(_c(o.color, 0x3a2818)), pn = M.fabric(_c(o.panel, 0x4a3a5a));
    const panels = 3, pw = 0.5;
    for (let i = 0; i < panels; i++) { const grp = new THREE.Group(); grp.add(_box(0.04, 1.6, 0.04, fr, [-pw / 2, 0.8, 0])); grp.add(_box(0.04, 1.6, 0.04, fr, [pw / 2, 0.8, 0])); grp.add(_box(pw, 0.04, 0.04, fr, [0, 1.58, 0])); grp.add(_box(pw, 0.04, 0.04, fr, [0, 0.04, 0])); grp.add(_box(pw - 0.08, 1.4, 0.02, pn, [0, 0.82, 0]));
      grp.position.x = (i - 1) * pw * 0.92; grp.position.z = (i % 2 ? 1 : -1) * 0.12; grp.rotation.y = (i % 2 ? 1 : -1) * 0.3; g.add(grp); }
    return g;
  }, { icon: "🚪", category: "wizard furniture", params: [
    { key: "color", label: "Frame", type: "color", default: 0x3a2818 },
    { key: "panel", label: "Panel", type: "color", default: 0x4a3a5a }] });

  register("bedside_cabinet", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), br = M.brass(0xc8a050);
    g.add(_box(0.4, 0.5, 0.4, wd, [0, 0.3, 0]));
    g.add(_box(0.42, 0.04, 0.42, wd, [0, 0.57, 0]));
    g.add(_box(0.36, 0.18, 0.02, M.wood(0x3a2414), [0, 0.42, 0.2])); g.add(_sph(0.02, br, [0, 0.42, 0.22], 8)); // drawer
    g.add(_box(0.36, 0.22, 0.02, M.wood(0x3a2414), [0, 0.18, 0.2])); g.add(_sph(0.02, br, [0, 0.18, 0.22], 8));
    for (const [x, z] of [[-0.16, 0.16], [0.16, 0.16], [-0.16, -0.16], [0.16, -0.16]]) g.add(_cyl(0.025, 0.025, 0.1, wd, [x, 0.05, z], 6));
    g.add(_cyl(0.05, 0.06, 0.04, M.ceramic(0xe0d4c0), [0, 0.61, 0], 10)); // little candle holder on top
    g.add(_cyl(0.02, 0.02, 0.08, M.wax(0xf0e8c8), [0, 0.66, 0], 8));
    g.add(_cone(0.012, 0.04, glow(0xffcc55, 1.4), [0, 0.72, 0], 6));
    return g;
  }, { icon: "🗄", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  // ════════════════════════════════════════════════════════════
  //  WEATHER / SKY PROPS  (animated)
  // ════════════════════════════════════════════════════════════

  register("restricted_section_shelf", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x2a1a10)), ch = M.metal(0x3a342c);
    const H = o.height;
    g.add(_box(1.0, H, 0.34, wd, [0, H / 2, 0]));
    g.add(_box(1.04, 0.06, 0.38, wd, [0, H, 0]));
    const shelves = Math.floor(H / 0.4);
    for (let s = 1; s < shelves; s++) { const y = s * (H / shelves); g.add(_box(0.96, 0.03, 0.32, wd, [0, y, 0]));
      let x = -0.44; while (x < 0.42) { const bw = rand(0.04, 0.08), bh = rand(0.22, 0.34); const glows = Math.random() < 0.15; const bk = glows ? glow(pick([0x5a90ff, 0xff5a5a, 0x9a5aff]), 0.8) : M.book(pick([0x6a2a1a, 0x2a4a3a, 0x3a2a5a, 0x5a4a1a]));
        const b = _box(bw, bh, 0.28, bk, [x + bw / 2, y + bh / 2 + 0.02, 0]); b.rotation.z = rand(-0.04, 0.04); g.add(b); x += bw + 0.005; } }
    // chains
    for (const x of [-0.3, 0, 0.3]) { for (let i = 0; i < 5; i++) { const link = _tor(0.012, 0.004, ch, [x, 0.1 + i * 0.06, 0.18], 4, 8); link.rotation.x = i % 2 ? 0 : Math.PI / 2; g.add(link); } }
    return g;
  }, { icon: "📚", category: "wizard furniture", params: [
    { key: "height", label: "Height", type: "number", min: 1.2, max: 3, step: 0.2, default: 2.2 },
    { key: "color", label: "Wood", type: "color", default: 0x2a1a10 }] });

  register("great_hall_long_table", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), bench = M.wood(0x3a2414);
    const L = o.length;
    g.add(_box(L, 0.08, 0.7, wd, [0, 0.78, 0]));                 // top
    for (const x of [-L / 2 + 0.3, 0, L / 2 - 0.3]) { g.add(_box(0.12, 0.74, 0.6, wd, [x, 0.37, 0])); }
    g.add(_box(L - 0.4, 0.1, 0.1, wd, [0, 0.2, 0]));             // stretcher
    for (const sz of [-1, 1]) g.add(_box(L - 0.2, 0.08, 0.28, bench, [0, 0.32, sz * 0.55])); // benches
    for (const sz of [-1, 1]) for (const x of [-L / 2 + 0.4, 0, L / 2 - 0.4]) g.add(_box(0.1, 0.3, 0.24, bench, [x, 0.15, sz * 0.55]));
    return g;
  }, { icon: "🍽", category: "wizard furniture", params: [
    { key: "length", label: "Length", type: "number", min: 2, max: 8, step: 0.5, default: 5 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  register("student_desk", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x6a4a2a)), ir = M.metal(0x3a342c);
    g.add(_box(0.6, 0.04, 0.4, wd, [0, 0.72, 0]));
    g.add(_box(0.6, 0.12, 0.08, wd, [0, 0.78, -0.16]));
    for (const [x, z] of [[-0.25, 0.16], [0.25, 0.16], [-0.25, -0.16], [0.25, -0.16]]) g.add(_cyl(0.02, 0.02, 0.72, ir, [x, 0.36, z], 6));
    g.add(_box(0.55, 0.3, 0.02, wd, [0, 0.5, 0.2]));
    return g;
  }, { icon: "🪑", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x6a4a2a }] });

  register("lecture_desk", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414));
    g.add(_box(1.2, 0.9, 0.6, wd, [0, 0.45, 0]));
    g.add(_box(1.3, 0.06, 0.7, wd, [0, 0.92, 0]));
    g.add(_box(1.0, 0.5, 0.04, M.wood(0x2a1a10), [0, 0.4, 0.28]));
    g.add(_cyl(0.05, 0.06, 0.04, M.brass(0xc8a050), [0.4, 0.96, 0], 10));
    g.add(_box(0.3, 0.02, 0.2, M.plaster(0xf0e8d8), [-0.3, 0.94, 0]));
    return g;
  }, { icon: "🏫", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("specimen_cabinet", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), gl = M.glass(0xcfe3ee);
    g.add(_box(0.9, 1.8, 0.4, wd, [0, 0.9, 0]));
    g.add(_box(0.78, 1.6, 0.36, M.wood(0x2a1a10), [0, 0.9, 0.02]));
    g.add(_box(0.8, 1.6, 0.03, gl, [0, 0.9, 0.2]));
    for (let s = 0; s < 4; s++) { const y = 0.3 + s * 0.45; g.add(_box(0.76, 0.03, 0.34, wd, [0, y, 0.02]));
      for (let i = 0; i < 3; i++) g.add(_cyl(0.05, 0.06, 0.12, gl, [-0.24 + i * 0.24, y + 0.08, 0.05], 8)); }
    return g;
  }, { icon: "🗄", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  // ════════════════════════════════════════════════════════════
  //  MORE CREATURES  (animated)
  // ════════════════════════════════════════════════════════════

  register("hat_stand", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)), felt = M.felt(_c(o.hat, 0x2a2a3a));
    g.add(_cyl(0.18, 0.22, 0.04, wd, [0, 0.02, 0], 12));
    g.add(_cyl(0.025, 0.03, 1.5, wd, [0, 0.77, 0], 8));
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const peg = _cyl(0.012, 0.012, 0.14, wd, [0, 1.4, 0], 5); peg.position.set(Math.cos(a) * 0.06, 1.4 - i * 0.04, Math.sin(a) * 0.06); peg.rotation.z = Math.cos(a) * 0.8; peg.rotation.x = -Math.sin(a) * 0.8; g.add(peg); }
    const hat = new THREE.Group();
    hat.add(_cyl(0.16, 0.18, 0.02, felt, [0, 0, 0], 14));
    const cone = _cone(0.13, 0.4, felt, [0, 0.2, 0], 14); cone.rotation.x = 0.2; hat.add(cone);
    hat.position.set(0.04, 1.5, 0.02); hat.rotation.z = -0.2; g.add(hat);
    return g;
  }, { icon: "🎩", category: "wizard furniture", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 },
    { key: "hat", label: "Hat", type: "color", default: 0x2a2a3a }] });
})();
