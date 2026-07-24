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

  register("dungeon_wall", function (o) {
    const g = new THREE.Group();
    const w = Math.max(0.6, o.width), h = Math.max(0.6, o.height), t = 0.22;
    const shades = [_c(o.color, 0x4a4338), 0x423b32, 0x534a3e];
    // mortar backing
    g.add(_box(w, h, t * 0.6, M.stone(0x322c25), [0, h / 2, -t * 0.25]));
    const gap = 0.04, bw = 0.5;
    const rows = Math.max(1, Math.round(h / 0.34));
    const rowH = h / rows;
    for (let r = 0; r < rows; r++) {
      const y = (r + 0.5) * rowH;
      let x = -w / 2;
      let first = true;
      while (x < w / 2 - 0.02) {
        let seg = (r % 2 === 1 && first) ? bw / 2 : bw;  // stagger every other row
        seg = Math.min(seg, w / 2 - x);
        const blockW = seg - gap;
        if (blockW > 0.05) {
          g.add(_box(blockW, rowH - gap, t, M.stone(pick(shades)), [x + seg / 2, y, 0]));
        }
        x += seg;
        first = false;
      }
    }
    if (o.moss) {
      for (let i = 0; i < 6; i++) {
        g.add(_box(rand(0.1, 0.3), rand(0.04, 0.14), 0.03, M.leaf(0x3a5a30),
          [rand(-w / 2 + 0.2, w / 2 - 0.2), rand(0.1, h * 0.5), t / 2]));
      }
    }
    return g;
  }, {
    icon: "▦", category: "wizard arch",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.8, max: 5,  step: 0.1,  default: 2.2 },
      { key: "height", label: "Height", type: "number", min: 1,   max: 4,  step: 0.1,  default: 2.6 },
      { key: "color",  label: "Stone",  type: "color",  default: 0x4a4338 },
      { key: "moss",   label: "Moss",   type: "bool",   default: true },
    ],
  });

  // ── Dungeon archway ──────────────────────────────────────────
  // Two stone jambs + a semicircular arch of voussoir blocks.

  register("dungeon_archway", function (o) {
    const g = new THREE.Group();
    const W = o.width, H = o.height, t = o.depth, jw = 0.3;
    const st = M.stone(_c(o.color, 0x4a4338));
    const pierH = Math.max(0.3, H - W / 2);
    g.add(_box(jw, pierH, t, st, [-(W / 2 + jw / 2), pierH / 2, 0]));  // left jamb
    g.add(_box(jw, pierH, t, st, [ (W / 2 + jw / 2), pierH / 2, 0]));  // right jamb
    const R = W / 2 + jw / 2, n = 9;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (i + 0.5) / n;                // 0..PI across the top
      const vb = _box(jw, 0.34, t, st, [-Math.cos(a) * R, pierH + Math.sin(a) * R, 0]);
      vb.rotation.z = a - Math.PI / 2;                  // orient radially
      g.add(vb);
    }
    return g;
  }, {
    icon: "∩", category: "wizard arch",
    params: [
      { key: "width",  label: "Opening", type: "number", min: 0.6, max: 2.5, step: 0.1,  default: 1.1 },
      { key: "height", label: "Height",  type: "number", min: 1.5, max: 3.5, step: 0.1,  default: 2.4 },
      { key: "depth",  label: "Depth",   type: "number", min: 0.2, max: 0.8, step: 0.05, default: 0.4 },
      { key: "color",  label: "Stone",   type: "color",  default: 0x4a4338 },
    ],
  });

  // ── Rune pillar ──────────────────────────────────────────────
  // Square stone pillar with glowing rune bands on each face.

  register("floating_staircase", function (o) {
    const g = new THREE.Group();
    const n = o.steps, st = M.stone(_c(o.color, 0x6a6358));
    const rise = 0.22, run = 0.3, w = o.width;
    for (let i = 0; i < n; i++) {
      const step = _box(w, 0.12, run * 0.9, st, [i * 0.04, o.height + i * rise, i * run]);
      step.rotation.y = i * 0.03;
      g.add(step);
    }
    return g;
  }, {
    icon: "◿", category: "wizard arch",
    params: [
      { key: "steps",  label: "Steps",  type: "int",    min: 3, max: 16, step: 1, default: 8 },
      { key: "width",  label: "Width",  type: "number", min: 0.6, max: 2, step: 0.1, default: 1.2 },
      { key: "height", label: "Start",  type: "number", min: 0, max: 2, step: 0.1, default: 0.0 },
      { key: "color",  label: "Stone",  type: "color",  default: 0x6a6358 },
    ],
  });

  // ── House banner ─────────────────────────────────────────────
  // Tall hanging heraldic banner on a rod, with a generic emblem.

  register("arched_window", function (o) {
    const g = new THREE.Group();
    const st = M.stone(_c(o.color, 0x5a5348));
    const W = o.width, H = o.height, t = 0.2, pierH = H - W / 2;
    g.add(_box(0.12, pierH, t, st, [-(W / 2 + 0.06), pierH / 2, 0]));   // jambs
    g.add(_box(0.12, pierH, t, st, [ (W / 2 + 0.06), pierH / 2, 0]));
    g.add(_box(W + 0.24, 0.12, t, st, [0, 0.06, 0]));                   // sill
    const R = W / 2 + 0.06;
    for (let i = 0; i < 9; i++) { const a = Math.PI * (i + 0.5) / 9; const vb = _box(0.12, 0.22, t, st, [-Math.cos(a) * R, pierH + Math.sin(a) * R, 0]); vb.rotation.z = a - Math.PI / 2; g.add(vb); } // arch
    const cols = [0x4a8ad6, 0xd64a6a, 0x4ad68a, 0xd6c04a];
    const gw = W / 2, gh = (pierH - 0.2) / 3;
    for (let cx = 0; cx < 2; cx++) for (let ry = 0; ry < 3; ry++) {     // panes
      g.add(_box(gw - 0.05, gh - 0.05, 0.03, glow(pick(cols), 0.7), [-W / 2 + gw / 2 + cx * gw, 0.2 + gh / 2 + ry * gh, 0]));
    }
    g.add(_box(0.05, pierH - 0.2, 0.05, st, [0, 0.2 + (pierH - 0.2) / 2, 0]));  // mullion
    for (let ry = 1; ry < 3; ry++) g.add(_box(W, 0.05, 0.05, st, [0, 0.2 + ry * gh, 0]));
    g.add(_tor(W * 0.18, 0.03, st, [0, pierH + W * 0.12, 0], 6, 18));   // rose ring (faces +Z)
    g.add(_cyl(W * 0.16, W * 0.16, 0.03, glow(pick(cols), 0.8), [0, pierH + W * 0.12, 0], 14));
    return g;
  }, {
    icon: "⌧", category: "wizard arch",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.6, max: 1.6, step: 0.1, default: 0.9 },
      { key: "height", label: "Height", type: "number", min: 1.8, max: 4,   step: 0.1, default: 2.6 },
      { key: "color",  label: "Stone",  type: "color",  default: 0x5a5348 },
    ],
  });

  // ── Robe rack ────────────────────────────────────────────────
  // Stand draped with a wizard's robe and a pointed hat.

  register("portal_gate", function (o) {
    const g = new THREE.Group();
    const st = M.stone(_c(o.color, 0x3a3530));
    const W = o.width, H = o.height, t = 0.4, jw = 0.35, pierH = H - W / 2;
    g.add(_box(jw, pierH, t, st, [-(W / 2 + jw / 2), pierH / 2, 0]));
    g.add(_box(jw, pierH, t, st, [ (W / 2 + jw / 2), pierH / 2, 0]));
    const R = W / 2 + jw / 2;
    for (let i = 0; i < 9; i++) { const a = Math.PI * (i + 0.5) / 9; const vb = _box(jw, 0.36, t, st, [-Math.cos(a) * R, pierH + Math.sin(a) * R, 0]); vb.rotation.z = a - Math.PI / 2; g.add(vb); }
    g.add(_box(0.2, 0.3, t + 0.05, st, [0, H, 0]));                     // keystone
    const pc = _c(o.glow, 0x8a4ad6), pm = glow(pc, 1.4);
    g.add(_box(W, pierH, 0.04, new THREE.MeshStandardMaterial({ color: pc, emissive: pc, emissiveIntensity: 0.9, transparent: true, opacity: 0.5, roughness: 0.2 }), [0, pierH / 2, 0]));
    for (let i = 0; i < 4; i++) g.add(_tor(W * 0.4 * (i + 1) / 4, 0.02, pm, [0, pierH * 0.55, 0.03], 6, 24));  // ripples (face +Z)
    return g;
  }, {
    icon: "◎", category: "wizard arch",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.8, max: 2,   step: 0.1, default: 1.2 },
      { key: "height", label: "Height", type: "number", min: 1.8, max: 3.5, step: 0.1, default: 2.6 },
      { key: "color",  label: "Stone",  type: "color",  default: 0x3a3530 },
      { key: "glow",   label: "Portal", type: "color",  default: 0x8a4ad6 },
    ],
  });

  // ── Guardian gargoyle ────────────────────────────────────────
  // Crouching stone gargoyle on a plinth, with glowing eyes.

  register("dungeon_column", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5348)); const h = o.height, r = o.radius;
    g.add(_box(r * 2.6, 0.2, r * 2.6, st, [0, 0.1, 0]));
    g.add(_box(r * 2.3, 0.15, r * 2.3, st, [0, 0.27, 0]));
    g.add(_cyl(r, r * 1.05, h - 0.7, st, [0, (h - 0.7) / 2 + 0.35, 0], 8));
    g.add(_box(r * 2.3, 0.2, r * 2.3, st, [0, h - 0.25, 0]));
    g.add(_box(r * 2.6, 0.15, r * 2.6, st, [0, h - 0.07, 0]));
    return g;
  }, { icon: "⌶", category: "wizard arch", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 5, step: 0.1, default: 3.0 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5348 }] });

  register("portcullis", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x3a352e); const st = M.stone(_c(o.color, 0x4a4338));
    const W = o.width, H = o.height;
    g.add(_box(0.25, H + 0.3, 0.3, st, [-(W / 2 + 0.12), (H + 0.3) / 2, 0]));
    g.add(_box(0.25, H + 0.3, 0.3, st, [ (W / 2 + 0.12), (H + 0.3) / 2, 0]));
    g.add(_box(W + 0.5, 0.3, 0.3, st, [0, H + 0.15, 0]));
    const n = Math.max(3, Math.round(W / 0.25));
    for (let i = 0; i <= n; i++) { const x = -W / 2 + i * (W / n); g.add(_cyl(0.025, 0.025, H, ir, [x, H / 2, 0], 6)); const sp = _cone(0.04, 0.12, ir, [x, -0.06, 0], 4); sp.rotation.x = Math.PI; g.add(sp); }
    for (let j = 0; j < 4; j++) g.add(_box(W, 0.04, 0.04, ir, [0, H * (j + 0.5) / 4, 0]));
    return g;
  }, { icon: "▥", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 0.8, max: 3, step: 0.1, default: 1.4 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 3.5, step: 0.1, default: 2.4 },
    { key: "color", label: "Stone", type: "color", default: 0x4a4338 }] });

  register("dungeon_cell", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520);
    const W = o.width, H = o.height;
    g.add(_box(W, 0.08, 0.08, ir, [0, H, 0])); g.add(_box(W, 0.08, 0.08, ir, [0, 0.04, 0]));
    const n = Math.max(4, Math.round(W / 0.18));
    for (let i = 0; i <= n; i++) g.add(_cyl(0.022, 0.022, H, ir, [-W / 2 + i * (W / n), H / 2, 0], 6));
    g.add(_cyl(0.04, 0.04, H, ir, [W * 0.05, H / 2, 0], 6));
    g.add(_cyl(0.04, 0.04, H, ir, [W * 0.35, H / 2, 0], 6));
    g.add(_box(0.1, 0.16, 0.05, M.rust(), [W * 0.2, H * 0.45, 0.04]));
    for (let i = 0; i < 6; i++) g.add(_box(rand(0.1, 0.25), 0.03, rand(0.1, 0.2), M.straw(), [rand(-W / 2, W / 2), 0.02, rand(-0.1, 0.2)]));
    return g;
  }, { icon: "⊞", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 3, step: 0.1, default: 1.6 },
    { key: "height", label: "Height", type: "number", min: 1.8, max: 3, step: 0.1, default: 2.4 }] });

  register("iron_studded_door", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)); const ir = M.metal(0x2a2520); const st = M.stone(0x4a4338);
    const W = o.width, H = o.height;
    g.add(_box(0.2, H + 0.2, 0.3, st, [-(W / 2 + 0.1), (H + 0.2) / 2, 0]));
    g.add(_box(0.2, H + 0.2, 0.3, st, [ (W / 2 + 0.1), (H + 0.2) / 2, 0]));
    g.add(_box(W + 0.4, 0.2, 0.3, st, [0, H + 0.1, 0]));
    g.add(_box(W, H, 0.12, wd, [0, H / 2, 0.05]));
    for (const by of [H * 0.2, H * 0.5, H * 0.8]) { g.add(_box(W, 0.08, 0.04, ir, [0, by, 0.12])); for (let i = 0; i < 5; i++) g.add(_sph(0.025, ir, [-W / 2 + 0.1 + i * (W - 0.2) / 4, by, 0.14], 6)); }
    g.add(_tor(0.06, 0.012, ir, [W * 0.3, H * 0.45, 0.16], 6, 14));
    return g;
  }, { icon: "▯", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 0.8, max: 1.6, step: 0.1, default: 1.0 },
    { key: "height", label: "Height", type: "number", min: 1.8, max: 3, step: 0.1, default: 2.2 },
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("arrow_slit", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x4a4338));
    const W = 1.2, H = o.height, t = 0.3, sw = 0.12, sh = H * 0.5;
    g.add(_box((W - sw) / 2, H, t, st, [-(sw / 2 + (W - sw) / 4), H / 2, 0]));
    g.add(_box((W - sw) / 2, H, t, st, [ (sw / 2 + (W - sw) / 4), H / 2, 0]));
    g.add(_box(sw, (H - sh) / 2, t, st, [0, (H - sh) / 4, 0]));
    g.add(_box(sw, (H - sh) / 2, t, st, [0, H - (H - sh) / 4, 0]));
    g.add(_box(sw, sh, 0.05, M.stone(0x14110c), [0, H * 0.5, t / 2 - 0.02]));
    return g;
  }, { icon: "▏", category: "wizard arch", params: [
    { key: "height", label: "Height", type: "number", min: 1.5, max: 3.5, step: 0.1, default: 2.5 },
    { key: "color", label: "Stone", type: "color", default: 0x4a4338 }] });

  register("ruined_arch", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6055));
    const W = o.width, H = o.height, t = 0.4, jw = 0.35, pierH = H - W / 2;
    g.add(_box(jw, pierH, t, st, [-(W / 2 + jw / 2), pierH / 2, 0]));
    g.add(_box(jw, pierH * 0.6, t, st, [ (W / 2 + jw / 2), pierH * 0.3, 0]));
    g.add(_box(jw * 0.7, 0.2, t, st, [ (W / 2 + jw / 2) - 0.05, pierH * 0.6 + 0.1, 0]));
    const R = W / 2 + jw / 2;
    for (let i = 0; i < 5; i++) { const a = Math.PI * (i + 0.5) / 9; const vb = _box(jw, 0.34, t, st, [-Math.cos(a) * R, pierH + Math.sin(a) * R, 0]); vb.rotation.z = a - Math.PI / 2; g.add(vb); }
    for (let i = 0; i < 5; i++) g.add(_box(rand(0.15, 0.3), rand(0.1, 0.2), rand(0.15, 0.3), st, [rand(-W / 2, W / 2), 0.08, rand(-0.2, 0.2)]));
    return g;
  }, { icon: "◠", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 0.8, max: 2.5, step: 0.1, default: 1.4 },
    { key: "height", label: "Height", type: "number", min: 1.8, max: 3.5, step: 0.1, default: 2.6 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6055 }] });

  register("runic_wall", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x3a3a42)); const W = o.width, H = o.height, t = 0.2;
    g.add(_box(W, H, t, st, [0, H / 2, 0]));
    const gm = glow(_c(o.glow, 0x6a8aff), 1.2);
    const cols = Math.floor(W / 0.3), rows = Math.floor(H / 0.3);
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (Math.random() < 0.4) continue; const x = -W / 2 + 0.2 + i * 0.3, y = 0.2 + j * 0.3;
      g.add(_box(0.02, rand(0.08, 0.16), 0.02, gm, [x, y, t / 2]));
      if (Math.random() < 0.6) g.add(_box(rand(0.06, 0.12), 0.02, 0.02, gm, [x, y + rand(-0.05, 0.05), t / 2]));
    }
    return g;
  }, { icon: "᎒", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 4, step: 0.1, default: 2.0 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 3.5, step: 0.1, default: 2.5 },
    { key: "color", label: "Stone", type: "color", default: 0x3a3a42 },
    { key: "glow", label: "Runes", type: "color", default: 0x6a8aff }] });

  register("spiral_dungeon_stair", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5348)); const n = o.steps, r = o.radius;
    g.add(_cyl(0.12, 0.12, n * 0.2 + 0.3, st, [0, (n * 0.2) / 2, 0], 10));
    for (let i = 0; i < n; i++) { const a = i * 0.5, y = i * 0.2 + 0.1; const step = _box(r, 0.1, 0.35, st, [Math.cos(a) * r * 0.5, y, Math.sin(a) * r * 0.5]); step.rotation.y = -a; g.add(step); }
    return g;
  }, { icon: "◴", category: "wizard arch", params: [
    { key: "steps", label: "Steps", type: "int", min: 4, max: 24, step: 1, default: 14 },
    { key: "radius", label: "Radius", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 0.9 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5348 }] });

  // ═══ LIGHT & FIRE ════════════════════════════════════════════

  register("flying_buttress", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x7a7468)); const H = o.height;
    g.add(_box(0.4, H, 0.4, st, [0.9, H / 2, 0]));
    g.add(_box(0.3, 0.3, 0.4, st, [0.9, H + 0.15, 0]));
    g.add(_cone(0.18, 0.5, st, [0.9, H + 0.4, 0], 6));
    g.add(_box(0.4, H * 0.9, 0.3, st, [-0.6, H * 0.45, 0]));
    for (let i = 0; i < 4; i++) { const t = i / 3; const b = _box(0.5, 0.22, 0.3, st, [0.9 - 1.5 * t, H * 0.7 + 0.5 * Math.sin(t * Math.PI / 2), 0]); b.rotation.z = -0.5 - t * 0.4; g.add(b); }
    return g;
  }, { icon: "⟋", category: "wizard arch", params: [
    { key: "height", label: "Height", type: "number", min: 1.5, max: 4, step: 0.1, default: 2.6 },
    { key: "color", label: "Stone", type: "color", default: 0x7a7468 }] });

  register("castle_turret", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6358)); const rf = M.cloth(_c(o.roof, 0x3a4a6a)); const R = o.radius, H = o.height;
    g.add(_cyl(R, R * 1.05, H, st, [0, H / 2, 0], 16));
    for (let i = 0; i < 10; i++) { const a = i * Math.PI * 2 / 10; g.add(_box(0.12, 0.2, 0.12, st, [Math.cos(a) * R, H + 0.1, Math.sin(a) * R])); }
    g.add(_cone(R * 1.1, H * 0.5, rf, [0, H + 0.1 + H * 0.25, 0], 16));
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; g.add(_box(0.12, 0.3, 0.05, M.stone(0x2a2418), [Math.cos(a) * R * 1.02, H * 0.6, Math.sin(a) * R * 1.02])); }
    return g;
  }, { icon: "♜", category: "wizard arch", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.6 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 5, step: 0.1, default: 2.6 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6358 },
    { key: "roof", label: "Roof", type: "color", default: 0x3a4a6a }] });

  register("battlement_wall", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6358)); const W = o.width, H = o.height;
    g.add(_box(W, H, 0.4, st, [0, H / 2, 0]));
    const n = Math.max(3, Math.round(W / 0.4));
    for (let i = 0; i < n; i++) { if (i % 2) continue; g.add(_box(W / n * 0.9, 0.3, 0.4, st, [-W / 2 + (i + 0.5) * W / n, H + 0.15, 0])); }
    g.add(_box(W, 0.08, 0.15, st, [0, H, 0.2]));
    return g;
  }, { icon: "⊥", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 5, step: 0.1, default: 2.4 },
    { key: "height", label: "Height", type: "number", min: 1.2, max: 3, step: 0.1, default: 2.0 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6358 }] });

  register("clock_tower", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6055)); const H = o.height, W = 0.9;
    g.add(_box(W, H, W, st, [0, H / 2, 0]));
    const face = _cyl(0.3, 0.3, 0.06, M.plaster(0xe8e0c8), [0, H * 0.82, W / 2 - 0.01], 16); face.rotation.x = Math.PI / 2; g.add(face);
    g.add(_tor(0.3, 0.04, M.brass(), [0, H * 0.82, W / 2 + 0.01], 6, 20));
    g.add(_box(0.02, 0.2, 0.02, M.metal(0x222222), [0, H * 0.82, W / 2 + 0.04]));
    g.add(_box(0.16, 0.02, 0.02, M.metal(0x222222), [0, H * 0.82, W / 2 + 0.04]));
    for (let i = 0; i < 4; i++) { const sx = i < 2 ? -1 : 1, sz = (i % 2) ? -1 : 1; g.add(_box(0.18, 0.2, 0.18, st, [sx * (W / 2 - 0.09), H + 0.1, sz * (W / 2 - 0.09)])); }
    g.add(_cone(0.5, 0.8, M.cloth(_c(o.roof, 0x3a4a6a)), [0, H + 0.5, 0], 4));
    return g;
  }, { icon: "🕓", category: "wizard arch", params: [
    { key: "height", label: "Height", type: "number", min: 2, max: 6, step: 0.1, default: 3.5 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6055 },
    { key: "roof", label: "Roof", type: "color", default: 0x3a4a6a }] });

  register("moat_bridge", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x7a7468)); const L = o.length, W = o.width, n = 9;
    for (let i = 0; i < n; i++) { const t = i / (n - 1); const z = -L / 2 + t * L; const y = 0.3 + 0.3 * Math.sin(t * Math.PI); g.add(_box(W, 0.12, L / n + 0.02, st, [0, y, z])); }
    for (const sx of [-1, 1]) for (let i = 0; i < n; i++) { const t = i / (n - 1); const z = -L / 2 + t * L; const y = 0.3 + 0.3 * Math.sin(t * Math.PI); g.add(_box(0.08, 0.25, L / n + 0.02, st, [sx * (W / 2 - 0.04), y + 0.18, z])); }
    return g;
  }, { icon: "⌣", category: "wizard arch", params: [
    { key: "length", label: "Length", type: "number", min: 1.5, max: 5, step: 0.1, default: 2.4 },
    { key: "width", label: "Width", type: "number", min: 0.6, max: 2, step: 0.1, default: 1.0 },
    { key: "color", label: "Stone", type: "color", default: 0x7a7468 }] });

  register("grand_staircase", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x8a8278)); const carpet = M.cloth(_c(o.carpet, 0x6a1a2a));
    const n = o.steps, rise = 0.18, run = 0.3, w = o.width;
    for (let i = 0; i < n; i++) { g.add(_box(w, rise, run, st, [0, rise / 2 + i * rise, i * run])); g.add(_box(w * 0.5, 0.02, run, carpet, [0, rise + i * rise + 0.002, i * run])); }
    for (const sx of [-1, 1]) { for (let i = 0; i < n; i += 2) g.add(_cyl(0.03, 0.03, 0.4, st, [sx * (w / 2 - 0.05), rise + i * rise + 0.2, i * run], 6));
      const rail = _box(0.06, 0.06, n * run, st, [sx * (w / 2 - 0.05), rise * n + 0.35, n * run / 2 - run / 2]); rail.rotation.x = -Math.atan2(rise, run); g.add(rail); }
    return g;
  }, { icon: "◿", category: "wizard arch", params: [
    { key: "steps", label: "Steps", type: "int", min: 3, max: 16, step: 1, default: 8 },
    { key: "width", label: "Width", type: "number", min: 0.8, max: 3, step: 0.1, default: 1.4 },
    { key: "color", label: "Stone", type: "color", default: 0x8a8278 },
    { key: "carpet", label: "Runner", type: "color", default: 0x6a1a2a }] });

  register("courtyard_well", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x7a7468)), wd = M.wood(0x4a3018);
    g.add(_cyl(0.5, 0.55, 0.6, st, [0, 0.3, 0], 16));
    g.add(_cyl(0.5, 0.5, 0.02, M.metal(0x14202a), [0, 0.55, 0], 16));
    for (const sx of [-1, 1]) g.add(_cyl(0.05, 0.05, 1.0, wd, [sx * 0.45, 1.1, 0], 6));
    g.add(_box(1.3, 0.05, 0.7, wd, [0, 1.62, 0]));
    const bar = _cyl(0.02, 0.02, 0.9, wd, [0, 1.0, 0], 6); bar.rotation.z = Math.PI / 2; g.add(bar);
    g.add(_cyl(0.08, 0.08, 0.12, wd, [0, 0.75, 0], 10));
    g.add(_cyl(0.005, 0.005, 0.25, M.rope(), [0, 0.9, 0], 4));
    return g;
  }, { icon: "⊚", category: "wizard arch", params: [
    { key: "color", label: "Stone", type: "color", default: 0x7a7468 }] });

  register("block_wall", function (o) {
    const g = new THREE.Group(); const W = o.width, H = o.height, t = 0.3; const base = _c(o.color, 0x5a5348);
    g.add(_box(W, H, t * 0.6, M.stone(0x4a443c), [0, H / 2, -0.05]));        // mortar
    const bw = 0.45, bh = 0.28, rows = Math.round(H / bh), cols = Math.round(W / bw) + 1;
    for (let r = 0; r < rows; r++) { const off = (r % 2) * (bw / 2), y = bh / 2 + r * bh;
      for (let c = -1; c < cols; c++) { const x = -W / 2 + c * bw + off + bw / 2;
        if (x < -W / 2 + 0.02 || x > W / 2 - 0.02 || y > H - 0.02) continue;
        g.add(_box(bw - 0.04, bh - 0.04, t, M.stone(jit(base)), [x, y, 0])); } }
    return g;
  }, { icon: "🧱", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 5, step: 0.1, default: 2.0 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 4, step: 0.1, default: 2.6 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5348 }] });

  register("brick_wall", function (o) {
    const g = new THREE.Group(); const W = o.width, H = o.height, t = 0.2; const base = _c(o.color, 0x8a4030);
    g.add(_box(W, H, t * 0.6, M.plaster(0x3a2a24), [0, H / 2, -0.04]));
    const bw = 0.24, bh = 0.1, rows = Math.round(H / bh), cols = Math.round(W / bw) + 1;
    for (let r = 0; r < rows; r++) { const off = (r % 2) * (bw / 2), y = bh / 2 + r * bh;
      for (let c = -1; c < cols; c++) { const x = -W / 2 + c * bw + off + bw / 2;
        if (x < -W / 2 + 0.01 || x > W / 2 - 0.01 || y > H - 0.01) continue;
        g.add(_box(bw - 0.02, bh - 0.02, t, M.ceramic(jit(base)), [x, y, 0])); } }
    return g;
  }, { icon: "🟧", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 5, step: 0.1, default: 2.0 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 4, step: 0.1, default: 2.6 },
    { key: "color", label: "Brick", type: "color", default: 0x8a4030 }] });

  register("plank_wall", function (o) {
    const g = new THREE.Group(); const W = o.width, H = o.height, t = 0.12; const base = _c(o.color, 0x5a3a1a);
    const n = Math.round(W / 0.22);
    for (let i = 0; i < n; i++) { const x = -W / 2 + (i + 0.5) * W / n; g.add(_box(W / n - 0.01, H, t, M.wood(jit(base, 0.9, 1.08)), [x, H / 2, 0])); }
    for (const yy of [H * 0.2, H * 0.8]) g.add(_box(W, 0.08, t + 0.03, M.wood(0x3a2414), [0, yy, 0.02]));
    return g;
  }, { icon: "🟫", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 5, step: 0.1, default: 2.0 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 4, step: 0.1, default: 2.6 },
    { key: "color", label: "Wood", type: "color", default: 0x5a3a1a }] });

  register("flagstone_floor", function (o) {
    const g = new THREE.Group(); const W = o.width, D = o.depth; const base = _c(o.color, 0x6a6358);
    g.add(_box(W, 0.04, D, M.stone(0x3a352e), [0, 0.01, 0]));
    const nx = Math.round(W / 0.5), nz = Math.round(D / 0.5);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = -W / 2 + (i + 0.5) * W / nx, z = -D / 2 + (j + 0.5) * D / nz;
      g.add(_box(W / nx - 0.05 + rand(-0.02, 0.02), 0.05, D / nz - 0.05 + rand(-0.02, 0.02), M.stone(jit(base)), [x + rand(-0.02, 0.02), 0.03, z + rand(-0.02, 0.02)])); }
    return g;
  }, { icon: "⬜", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 6, step: 0.1, default: 2.0 },
    { key: "depth", label: "Depth", type: "number", min: 1, max: 6, step: 0.1, default: 2.0 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6358 }] });

  register("cobble_floor", function (o) {
    const g = new THREE.Group(); const W = o.width, D = o.depth; const base = _c(o.color, 0x5a5550);
    g.add(_box(W, 0.03, D, M.stone(0x2a2620), [0, 0.005, 0]));
    const nx = Math.round(W / 0.22), nz = Math.round(D / 0.22);
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = -W / 2 + (i + 0.5) * W / nx + rand(-0.02, 0.02), z = -D / 2 + (j + 0.5) * D / nz + rand(-0.02, 0.02);
      const s = _sph(0.11, M.stone(jit(base)), [x, 0.04, z], 8); s.scale.set(1, 0.5, 1); g.add(s); }
    return g;
  }, { icon: "🔘", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 6, step: 0.1, default: 2.0 },
    { key: "depth", label: "Depth", type: "number", min: 1, max: 6, step: 0.1, default: 2.0 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5550 }] });

  register("wood_floor", function (o) {
    const g = new THREE.Group(); const W = o.width, D = o.depth; const base = _c(o.color, 0x6a4a28);
    const n = Math.round(D / 0.2);
    for (let j = 0; j < n; j++) { const z = -D / 2 + (j + 0.5) * D / n; g.add(_box(W - 0.01, 0.04, D / n - 0.01, M.wood(jit(base, 0.9, 1.08)), [0, 0.02, z])); }
    return g;
  }, { icon: "🟤", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 6, step: 0.1, default: 2.0 },
    { key: "depth", label: "Depth", type: "number", min: 1, max: 6, step: 0.1, default: 2.0 },
    { key: "color", label: "Wood", type: "color", default: 0x6a4a28 }] });

  register("stained_glass", function (o) {
    const g = new THREE.Group(); const W = o.width, H = o.height; const lead = M.metal(0x2a2620);
    const cols = [0x4a8ad6, 0xd64a6a, 0x4ad68a, 0xd6c04a, 0x8a4ad6, 0xff8a3a];
    const nx = o.cols, ny = o.rows, cw = W / nx, ch = H / ny;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x = -W / 2 + (i + 0.5) * cw, y = (j + 0.5) * ch; g.add(_box(cw - 0.03, ch - 0.03, 0.02, glow(pick(cols), 0.7), [x, y, 0])); }
    for (let i = 0; i <= nx; i++) g.add(_box(0.02, H, 0.03, lead, [-W / 2 + i * cw, H / 2, 0.005]));
    for (let j = 0; j <= ny; j++) g.add(_box(W, 0.02, 0.03, lead, [0, j * ch, 0.005]));
    return g;
  }, { icon: "🪟", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.0 },
    { key: "height", label: "Height", type: "number", min: 0.8, max: 3, step: 0.1, default: 1.6 },
    { key: "cols", label: "Columns", type: "int", min: 2, max: 6, step: 1, default: 3 },
    { key: "rows", label: "Rows", type: "int", min: 2, max: 8, step: 1, default: 4 }] });

  register("ceiling_beam", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)); const L = o.length;
    g.add(_box(0.16, 0.18, L, wd, [0, o.height, 0]));
    for (const t of [-0.3, 0.3]) { g.add(_box(0.18, 0.2, 0.04, M.metal(0x2a2520), [0, o.height, t * L])); g.add(_cyl(0.015, 0.015, 0.2, M.metal(0x2a2520), [0, o.height, t * L], 6)); }
    return g;
  }, { icon: "▬", category: "wizard arch", params: [
    { key: "length", label: "Length", type: "number", min: 1, max: 5, step: 0.1, default: 2.5 },
    { key: "height", label: "Mount", type: "number", min: 0, max: 3.5, step: 0.1, default: 2.4 },
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  // ════════════════════════════════════════════════════════════
  //  ROOM FURNITURE & FITTINGS
  // ════════════════════════════════════════════════════════════

  register("wooden_door", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), st = M.stone(_c(o.frame, 0x6a6358)), ir = M.metal(0x2a2520);
    const W = o.width, H = o.height, fw = 0.18;
    g.add(_box(fw, H + fw, 0.3, st, [-(W / 2 + fw / 2), (H + fw) / 2, 0]));
    g.add(_box(fw, H + fw, 0.3, st, [ (W / 2 + fw / 2), (H + fw) / 2, 0]));
    g.add(_box(W + fw * 2, fw, 0.3, st, [0, H + fw / 2, 0]));
    const np = Math.max(3, Math.round(W / 0.2));
    for (let i = 0; i < np; i++) g.add(_box(W / np - 0.008, H, 0.06, wd, [-W / 2 + (i + 0.5) * W / np, H / 2, 0.02]));
    for (const yy of [H * 0.25, H * 0.75]) g.add(_box(W, 0.05, 0.08, ir, [0, yy, 0.05]));
    g.add(_tor(0.06, 0.012, ir, [W * 0.32, H * 0.5, 0.06], 6, 16));
    return g;
  }, { icon: "🚪", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 0.9 },
    { key: "height", label: "Height", type: "number", min: 1.8, max: 3, step: 0.1, default: 2.1 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 },
    { key: "frame", label: "Frame", type: "color", default: 0x6a6358 }] });

  register("double_doors", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a2e18)), ir = M.metal(0x2a2520), st = M.stone(_c(o.frame, 0x6a6358));
    const W = o.width, H = o.height, fw = 0.22;
    g.add(_box(fw, H + fw, 0.35, st, [-(W / 2 + fw / 2), (H + fw) / 2, 0]));
    g.add(_box(fw, H + fw, 0.35, st, [ (W / 2 + fw / 2), (H + fw) / 2, 0]));
    g.add(_box(W + fw * 2, fw, 0.35, st, [0, H + fw / 2, 0]));
    for (const sx of [-1, 1]) { const cx = sx * W / 4;
      g.add(_box(W / 2 - 0.02, H, 0.07, wd, [cx, H / 2, 0.02]));
      for (let r = 0; r < 3; r++) g.add(_box(W / 2 * 0.6, H * 0.22, 0.03, M.wood(0x3a2414), [cx, H * (0.18 + r * 0.3), 0.06]));
      g.add(_tor(0.06, 0.012, ir, [sx * 0.08, H * 0.5, 0.06], 6, 16));
      for (const yy of [H * 0.2, H * 0.8]) g.add(_box(0.12, 0.05, 0.08, ir, [cx + sx * (W / 4 - 0.05), yy, 0.05])); }
    return g;
  }, { icon: "🏛", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 3, step: 0.1, default: 1.6 },
    { key: "height", label: "Height", type: "number", min: 2, max: 4, step: 0.1, default: 2.6 },
    { key: "color", label: "Wood", type: "color", default: 0x4a2e18 },
    { key: "frame", label: "Frame", type: "color", default: 0x6a6358 }] });

  register("trapdoor", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), ir = M.metal(0x2a2520); const S = o.size;
    g.add(_box(S + 0.1, 0.04, S + 0.1, M.stone(0x4a463e), [0, 0.02, 0]));
    const np = Math.max(3, Math.round(S / 0.18));
    for (let i = 0; i < np; i++) g.add(_box(S / np - 0.01, 0.05, S, wd, [-S / 2 + (i + 0.5) * S / np, 0.05, 0]));
    for (const z of [-S * 0.3, S * 0.3]) g.add(_box(S, 0.06, 0.06, ir, [0, 0.08, z]));
    const ring = _tor(0.06, 0.014, ir, [S * 0.3, 0.1, 0], 6, 16); ring.rotation.x = Math.PI / 2; g.add(ring);
    return g;
  }, { icon: "⬛", category: "wizard arch", params: [
    { key: "size", label: "Size", type: "number", min: 0.6, max: 1.6, step: 0.1, default: 0.9 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  register("round_window", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6358)); const R = o.radius, y = o.height;
    g.add(_tor(R, 0.08, st, [0, y, 0], 8, 28));
    const glass = _cyl(R, R, 0.03, glow(_c(o.glow, 0x6a8ad6), 0.6), [0, y, 0], 24); glass.rotation.x = Math.PI / 2; g.add(glass);
    for (let i = 0; i < 3; i++) { const m = _box(R * 1.96, 0.04, 0.05, st, [0, y, 0.01]); m.rotation.z = i * Math.PI / 3; g.add(m); }
    return g;
  }, { icon: "🪟", category: "wizard arch", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.3, max: 1.2, step: 0.1, default: 0.5 },
    { key: "height", label: "Mount", type: "number", min: 1, max: 3.5, step: 0.1, default: 2.0 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6358 },
    { key: "glow", label: "Glass", type: "color", default: 0x6a8ad6 }] });

  // ════════════════════════════════════════════════════════════
  //  SEATING & STORAGE
  // ════════════════════════════════════════════════════════════

  register("fluted_column", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0xc8bca8)); const H = o.height, R = o.radius;
    g.add(_box(R * 2.4, 0.18, R * 2.4, st, [0, 0.09, 0]));
    g.add(_cyl(R, R * 1.05, H - 0.36, st, [0, (H - 0.36) / 2 + 0.18, 0], 8));
    for (let i = 0; i < 12; i++) { const a = i * Math.PI * 2 / 12; g.add(_cyl(0.02, 0.02, H - 0.4, M.stone(0xb8ac98), [Math.cos(a) * R, (H - 0.4) / 2 + 0.2, Math.sin(a) * R], 4)); }
    g.add(_cyl(R * 1.1, R, 0.12, st, [0, H - 0.26, 0], 16));
    g.add(_box(R * 2.4, 0.2, R * 2.4, st, [0, H - 0.1, 0]));
    return g;
  }, { icon: "🏛", category: "wizard arch", params: [
    { key: "height", label: "Height", type: "number", min: 1.5, max: 5, step: 0.1, default: 3.0 },
    { key: "radius", label: "Radius", type: "number", min: 0.12, max: 0.4, step: 0.02, default: 0.22 },
    { key: "color", label: "Stone", type: "color", default: 0xc8bca8 }] });

  register("twisted_column", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0xc8bca8)); const H = o.height, R = o.radius;
    g.add(_box(R * 2.6, 0.16, R * 2.6, st, [0, 0.08, 0]));
    g.add(_cyl(R * 0.7, R * 0.7, H - 0.3, st, [0, (H - 0.3) / 2 + 0.16, 0], 12));
    const n = Math.round(H * 10); for (let i = 0; i < n; i++) { const t = i / n, a = t * Math.PI * 2 * 4, y = 0.2 + t * (H - 0.4); g.add(_sph(R * 0.45, st, [Math.cos(a) * R * 0.6, y, Math.sin(a) * R * 0.6], 8)); }
    g.add(_box(R * 2.6, 0.18, R * 2.6, st, [0, H - 0.09, 0]));
    return g;
  }, { icon: "🌀", category: "wizard arch", params: [
    { key: "height", label: "Height", type: "number", min: 1.5, max: 5, step: 0.1, default: 3.0 },
    { key: "radius", label: "Radius", type: "number", min: 0.12, max: 0.4, step: 0.02, default: 0.22 },
    { key: "color", label: "Stone", type: "color", default: 0xc8bca8 }] });

  register("stair_railing", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)); const L = o.length, H = o.height;
    const n = Math.max(3, Math.round(L / 0.2));
    g.add(_box(0.06, 0.06, L, wd, [0, H, 0]));
    g.add(_box(0.05, 0.05, L, wd, [0, 0.05, 0]));
    for (let i = 0; i < n; i++) { const z = -L / 2 + (i + 0.5) * L / n; g.add(_cyl(0.018, 0.018, H - 0.1, wd, [0, (H - 0.1) / 2 + 0.05, z], 6)); g.add(_sph(0.03, wd, [0, H * 0.5, z], 8)); }
    for (const sz of [-1, 1]) g.add(_box(0.08, H + 0.12, 0.08, wd, [0, (H + 0.12) / 2, sz * L / 2]));
    return g;
  }, { icon: "▤", category: "wizard arch", params: [
    { key: "length", label: "Length", type: "number", min: 0.8, max: 3, step: 0.1, default: 1.5 },
    { key: "height", label: "Height", type: "number", min: 0.6, max: 1.2, step: 0.1, default: 0.9 },
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("dueling_platform", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3424)), cl = M.cloth(_c(o.runner, 0x6a1a1a));
    const L = o.length, W = 1.2;
    g.add(_box(L, 0.2, W, wd, [0, 0.1, 0]));
    g.add(_box(L - 0.1, 0.02, 0.5, cl, [0, 0.21, 0]));    // runner carpet
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_cyl(0.06, 0.07, 0.2, wd, [sx * (L / 2 - 0.1), 0.1, sz * (W / 2 - 0.1)], 8));
    for (const sx of [-1, 1]) { g.add(_cyl(0.03, 0.03, 0.5, M.brass(0xc8a050), [sx * (L / 2 - 0.15), 0.45, 0], 8)); g.add(_sph(0.05, M.brass(0xc8a050), [sx * (L / 2 - 0.15), 0.72, 0], 8)); }
    return g;
  }, { icon: "⚔", category: "wizard arch", params: [
    { key: "length", label: "Length", type: "number", min: 2, max: 6, step: 0.5, default: 4 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3424 },
    { key: "runner", label: "Runner", type: "color", default: 0x6a1a1a }] });

  register("mossy_flagstones", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6358)), moss = M.leaf(0x4a6a3a);
    const S = o.size, n = 4, c = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const h = rand(0.04, 0.07); g.add(_box(c - 0.03, h, c - 0.03, st, [-S / 2 + (i + 0.5) * c, h / 2, -S / 2 + (j + 0.5) * c])); if (Math.random() < 0.4) g.add(_box(c * 0.5, 0.01, c * 0.5, moss, [-S / 2 + (i + 0.5) * c + rand(-0.1, 0.1), h + 0.005, -S / 2 + (j + 0.5) * c + rand(-0.1, 0.1)])); }
    return g;
  }, { icon: "🟫", category: "wizard arch", params: [
    { key: "size", label: "Tile Size", type: "number", min: 1, max: 4, step: 0.5, default: 2 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6358 }] });

  register("cracked_stone_floor", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x585048));
    const S = o.size; g.add(_box(S, 0.06, S, st, [0, 0.03, 0]));
    const dk = M.stone(0x2a2620);
    for (let i = 0; i < 9; i++) { const x = rand(-S / 2, S / 2), z = rand(-S / 2, S / 2); const c = _box(rand(0.3, 0.8), 0.062, 0.02, dk, [x, 0.032, z]); c.rotation.y = rand(0, Math.PI); g.add(c); }
    return g;
  }, { icon: "⬜", category: "wizard arch", params: [
    { key: "size", label: "Size", type: "number", min: 1, max: 5, step: 0.5, default: 3 },
    { key: "color", label: "Stone", type: "color", default: 0x585048 }] });

  register("herringbone_floor", function (o) {
    const g = new THREE.Group(); const w1 = M.wood(_c(o.color, 0x6a4326)), w2 = M.wood(0x5a3820);
    const S = o.size, pl = 0.35, pw = 0.1; let k = 0;
    for (let x = -S / 2; x < S / 2; x += pw * 2) for (let z = -S / 2; z < S / 2; z += pw * 2) { const a = _box(pl, 0.04, pw, k % 2 ? w1 : w2, [x, 0.02, z]); a.rotation.y = Math.PI / 4; g.add(a); const b = _box(pl, 0.04, pw, k % 2 ? w2 : w1, [x + pw, 0.02, z + pw]); b.rotation.y = -Math.PI / 4; g.add(b); k++; }
    return g;
  }, { icon: "🪵", category: "wizard arch", params: [
    { key: "size", label: "Size", type: "number", min: 1, max: 4, step: 0.5, default: 2.5 },
    { key: "color", label: "Wood", type: "color", default: 0x6a4326 }] });

  register("vaulted_wall_panel", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6358));
    const W = o.width, H = o.height;
    g.add(_box(W, H, 0.2, st, [0, H / 2, 0]));
    // blind arcade: shallow arches
    const arches = 3, aw = W / arches;
    for (let i = 0; i < arches; i++) { const cx = -W / 2 + (i + 0.5) * aw; for (let a = 0; a <= 8; a++) { const ang = Math.PI * a / 8; g.add(_box(0.06, 0.06, 0.06, M.stone(0x4a4338), [cx + Math.cos(ang) * (aw / 2 - 0.1), H * 0.55 + Math.sin(ang) * (H * 0.3), 0.12])); } g.add(_cyl(0.05, 0.05, H * 0.55, st, [cx - aw / 2 + 0.1, H * 0.27, 0.12], 8)); g.add(_cyl(0.05, 0.05, H * 0.55, st, [cx + aw / 2 - 0.1, H * 0.27, 0.12], 8)); }
    return g;
  }, { icon: "🧱", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 2, max: 6, step: 0.5, default: 3 },
    { key: "height", label: "Height", type: "number", min: 2, max: 4, step: 0.5, default: 3 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6358 }] });

  register("timber_frame_wall", function (o) {
    const g = new THREE.Group(); const beam = M.wood(_c(o.color, 0x3a2818)), pl = M.plaster(_c(o.fill, 0xd8ccb0));
    const W = o.width, H = o.height;
    g.add(_box(W, H, 0.12, pl, [0, H / 2, 0]));
    g.add(_box(W, 0.15, 0.16, beam, [0, 0.075, 0])); g.add(_box(W, 0.15, 0.16, beam, [0, H - 0.075, 0]));
    g.add(_box(W, 0.15, 0.16, beam, [0, H / 2, 0]));
    for (const x of [-W / 2 + 0.1, 0, W / 2 - 0.1]) g.add(_box(0.13, H, 0.16, beam, [x, H / 2, 0]));
    for (const sx of [-1, 1]) { const d = _box(0.1, H * 0.7, 0.16, beam, [sx * W * 0.25, H * 0.5, 0]); d.rotation.z = sx * 0.5; g.add(d); }
    return g;
  }, { icon: "🪟", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 2, max: 6, step: 0.5, default: 3 },
    { key: "height", label: "Height", type: "number", min: 2, max: 4, step: 0.5, default: 2.6 },
    { key: "color", label: "Timber", type: "color", default: 0x3a2818 },
    { key: "fill", label: "Plaster", type: "color", default: 0xd8ccb0 }] });

  // ════════════════════════════════════════════════════════════
  //  HERALDRY / BANNERS  (some animated)
  // ════════════════════════════════════════════════════════════

  register("moving_staircase", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5248));
    g.add(_cyl(0.16, 0.2, 0.3, st, [0, 0.15, 0], 12));            // pivot newel
    const flight = new THREE.Group();
    const steps = o.steps;
    for (let i = 0; i < steps; i++) { const w = 1.0 - i * 0.02; const s = _box(w, 0.12, 0.34, st, [0, 0.18 + i * 0.18, -0.3 - i * 0.32]); flight.add(s);
      const rail = _cyl(0.02, 0.02, 0.5, M.metal(0x3a342c), [w / 2 - 0.05, 0.4 + i * 0.18, -0.3 - i * 0.32], 6); flight.add(rail); }
    flight.position.y = 0; g.add(flight);
    let t = rand(0, 6), target = 0, cur = 0;
    g.userData.tick = (dt) => { t += dt; if (Math.sin(t * 0.4) > 0.99 || Math.abs(cur - target) < 0.01) { target = Math.round(rand(-2, 2)) * Math.PI / 4; } cur += (target - cur) * Math.min(1, dt * 1.5); flight.rotation.y = cur; };
    return g;
  }, { icon: "🪜", category: "wizard arch", params: [
    { key: "steps", label: "Steps", type: "int", min: 4, max: 12, default: 7 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5248 }] });

  register("grand_spiral_stair", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5248)), br = M.brass(0xc8a050);
    g.add(_cyl(0.12, 0.14, o.steps * 0.2 + 0.3, st, [0, (o.steps * 0.2 + 0.3) / 2, 0], 12)); // central column
    for (let i = 0; i < o.steps; i++) { const a = i * 0.5; const y = 0.1 + i * 0.2; const step = _box(0.7, 0.1, 0.3, st, [Math.cos(a) * 0.45, y, Math.sin(a) * 0.45]); step.rotation.y = -a; g.add(step);
      const post = _cyl(0.02, 0.02, 0.5, br, [Math.cos(a) * 0.72, y + 0.25, Math.sin(a) * 0.72], 6); g.add(post);
      const rail = _sph(0.04, br, [Math.cos(a) * 0.72, y + 0.5, Math.sin(a) * 0.72], 8); g.add(rail); }
    return g;
  }, { icon: "🌀", category: "wizard arch", params: [
    { key: "steps", label: "Steps", type: "int", min: 6, max: 24, default: 14 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5248 }] });

  register("floating_stair_step", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5248));
    const step = new THREE.Group();
    step.add(_box(o.width, 0.14, 0.4, st, [0, 0, 0]));
    step.add(_box(o.width - 0.06, 0.02, 0.36, M.stone(0x6a6358), [0, 0.08, 0]));
    for (const sx of [-1, 1]) step.add(_sph(0.03, glow(0x6ab0ff, 0.5), [sx * (o.width / 2 - 0.05), 0.06, 0.16], 6)); // rune glow corners
    step.position.y = o.height; g.add(step);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; step.position.y = o.height + Math.sin(t * 0.8) * 0.03; step.rotation.y = Math.sin(t * 0.5) * 0.02; };
    return g;
  }, { icon: "⬛", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 0.6, max: 1.6, step: 0.1, default: 1.0 },
    { key: "height", label: "Float Height", type: "number", min: 0.2, max: 2.5, step: 0.1, default: 1.0 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5248 }] });

  register("gothic_cloister_bay", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6358));
    const H = o.height, W = o.width;
    for (const sx of [-1, 1]) { g.add(_box(0.22, H, 0.22, st, [sx * W / 2, H / 2, 0])); // piers
      g.add(_cyl(0.13, 0.15, H * 0.7, st, [sx * W / 2, H * 0.35, 0.18], 8)); } // engaged colonnette
    // pointed arch from voussoirs
    const apex = H, springY = H * 0.6, half = W / 2;
    for (let s = -1; s <= 1; s += 2) { for (let k = 0; k <= 6; k++) { const f = k / 6; const x = s * half * (1 - f); const y = springY + (apex - springY) * f; const v = _box(0.2, 0.16, 0.24, st, [x, y, 0]); v.rotation.z = s * (0.2 + f * 0.5); g.add(v); } }
    g.add(_box(0.3, 0.2, 0.3, st, [0, apex, 0])); // keystone
    g.add(_box(W + 0.4, 0.2, 0.3, st, [0, H + 0.1, 0])); // cornice
    return g;
  }, { icon: "⛪", category: "wizard arch", params: [
    { key: "width", label: "Width", type: "number", min: 1.5, max: 4, step: 0.5, default: 2.4 },
    { key: "height", label: "Height", type: "number", min: 2.5, max: 5, step: 0.5, default: 3.5 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6358 }] });

  register("rose_window", function (o) {
    const g = new THREE.Group(); const st = M.stone(0x5a5248);
    const R = o.radius;
    g.add(_tor(R, 0.06, st, [0, R, 0], 8, 32));                  // outer ring
    g.add(_tor(R * 0.45, 0.04, st, [0, R, 0], 8, 24));           // inner ring
    g.add(_sph(0.08, st, [0, R, 0], 10));                        // hub
    const cols = [_c(o.color, 0xd23a4a), 0x2a6ad0, 0xd8b020, 0x3a9a4a, 0x9a4ad0, 0xd86a20];
    // radial mullions + petal panes
    for (let i = 0; i < o.petals; i++) { const a = i / o.petals * Math.PI * 2; const mx = Math.cos(a), my = Math.sin(a);
      const mull = _box(0.04, R, 0.05, st, [mx * R / 2, R + my * R / 2, 0]); mull.rotation.z = a - Math.PI / 2; g.add(mull);
      const pane = _box(R * 0.5, R * 0.5, 0.02, tglow(cols[i % cols.length], 0.5, 0.6), [Math.cos(a + Math.PI / o.petals) * R * 0.68, R + Math.sin(a + Math.PI / o.petals) * R * 0.68, 0]); g.add(pane);
      const inPane = _cone(R * 0.22, R * 0.3, tglow(cols[(i + 3) % cols.length], 0.5, 0.6), [Math.cos(a) * R * 0.28, R + Math.sin(a) * R * 0.28, 0], 3); inPane.rotation.z = a; g.add(inPane); }
    return g;
  }, { icon: "🪟", category: "wizard arch", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.6, max: 2, step: 0.1, default: 1.0 },
    { key: "petals", label: "Petals", type: "int", min: 6, max: 16, default: 8 },
    { key: "color", label: "Glass", type: "color", default: 0xd23a4a }] });

  register("dais_throne_platform", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5248)), carpet = M.cloth(_c(o.carpet, 0x6a1a2a)), wd = M.wood(0x3a2414), gold = M.brass(0xc8a050);
    for (let i = 0; i < 3; i++) { const s = 2.0 - i * 0.4; g.add(_box(s, 0.18, s, st, [0, 0.09 + i * 0.18, 0])); }
    g.add(_box(0.6, 0.02, 1.4, carpet, [0, 0.55, 0.5]));         // runner down the steps
    // throne
    const th = new THREE.Group();
    th.add(_box(0.6, 0.1, 0.55, wd, [0, 0.3, 0]));
    th.add(_box(0.6, 0.7, 0.1, wd, [0, 0.65, -0.22]));
    for (const sx of [-1, 1]) th.add(_box(0.1, 0.4, 0.5, wd, [sx * 0.25, 0.5, 0]));
    th.add(_box(0.5, 0.08, 0.5, carpet, [0, 0.39, 0]));
    for (const sx of [-1, 1]) th.add(_sph(0.06, gold, [sx * 0.25, 0.95, -0.22], 8));
    th.position.y = 0.54; g.add(th);
    return g;
  }, { icon: "👑", category: "wizard arch", params: [
    { key: "color", label: "Stone", type: "color", default: 0x5a5248 },
    { key: "carpet", label: "Carpet", type: "color", default: 0x6a1a2a }] });

  register("corbel_gargoyle", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5a52));
    // corbel bracket
    g.add(_box(0.4, 0.16, 0.3, st, [0, 0.6, 0]));
    const c1 = _box(0.34, 0.12, 0.26, st, [0, 0.5, 0.02]); g.add(c1);
    const c2 = _box(0.26, 0.12, 0.22, st, [0, 0.4, 0.04]); g.add(c2);
    // crouching gargoyle on top
    const gy = new THREE.Group();
    gy.add(_sph(0.13, st, [0, 0, 0], 10)); gy.children[0].scale.set(1.1, 0.9, 1.2); // body
    gy.add(_sph(0.1, st, [0, 0.1, 0.12], 10));                  // head
    gy.add(_cone(0.03, 0.07, st, [-0.05, 0.2, 0.12], 5)); gy.add(_cone(0.03, 0.07, st, [0.05, 0.2, 0.12], 5)); // horns
    gy.add(_cone(0.04, 0.1, M.stone(0x3a3a32), [0, 0.06, 0.22], 5)); gy.children[gy.children.length - 1].rotation.x = Math.PI / 2; // snout
    for (const sx of [-1, 1]) { const w = _box(0.04, 0.26, 0.16, st, [sx * 0.14, 0.04, -0.04]); w.rotation.z = sx * 0.8; g.add(w); }
    for (const sx of [-1, 1]) gy.add(_cyl(0.03, 0.025, 0.16, st, [sx * 0.08, -0.12, 0.06], 5));
    gy.position.set(0, 0.74, 0); g.add(gy);
    return g;
  }, { icon: "🗿", category: "wizard arch", params: [
    { key: "color", label: "Stone", type: "color", default: 0x5a5a52 }] });
})();
