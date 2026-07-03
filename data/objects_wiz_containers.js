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

  register("enchanted_chest", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(_c(o.color, 0x4a3018)), ir = M.metal(0x2a2520);
    const W = o.width, Hh = 0.4, D = 0.45;
    g.add(_box(W, Hh, D, wd, [0, Hh / 2, 0]));                 // body
    const lid = _cyl(D / 2, D / 2, W, wd, [0, Hh, 0], 14);     // rounded lid
    lid.rotation.z = Math.PI / 2; g.add(lid);
    for (const bx of [-W * 0.3, W * 0.3]) {                    // iron straps
      g.add(_box(0.05, Hh, D + 0.04, ir, [bx, Hh / 2, 0]));
    }
    g.add(_box(0.1, 0.12, 0.04, M.brass(), [0, Hh * 0.9, D / 2]));  // lock plate
    g.add(_box(W, 0.03, 0.03, glow(_c(o.glow, 0xffcf4a), 1.5), [0, Hh + 0.01, D / 2 - 0.02])); // glowing seam
    return g;
  }, {
    icon: "▣", category: "wizard containers",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.5, max: 1.4, step: 0.05, default: 0.7 },
      { key: "color", label: "Wood",  type: "color",  default: 0x4a3018 },
      { key: "glow",  label: "Seal",  type: "color",  default: 0xffcf4a },
    ],
  });

  // ── Owl perch ────────────────────────────────────────────────

  register("wall_shackles", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x3a352e); const y = o.height;
    g.add(_box(0.4, 0.5, 0.05, M.stone(0x5a5348), [0, y, -0.03]));
    for (const sx of [-1, 1]) { g.add(_tor(0.05, 0.012, ir, [sx * 0.13, y + 0.15, 0.02], 6, 14));
      for (let i = 0; i < 4; i++) { const lk = _tor(0.035, 0.01, ir, [sx * 0.13, y + 0.08 - i * 0.08, 0.02], 6, 12); lk.rotation.x = i % 2 ? Math.PI / 2 : 0; g.add(lk); }
      g.add(_tor(0.05, 0.018, ir, [sx * 0.13, y - 0.28, 0.02], 6, 16)); }
    return g;
  }, { icon: "⛓", category: "wizard containers", params: [
    { key: "height", label: "Mount", type: "number", min: 0.8, max: 2, step: 0.1, default: 1.4 }] });

  register("storage_barrel", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3a1a)), ir = M.metal(0x3a352e); const H = o.height, R = H * 0.42;
    g.add(_cyl(R * 0.85, R * 0.85, H, wd, [0, H / 2, 0], 16));
    g.add(_cyl(R, R, H * 0.4, wd, [0, H / 2, 0], 16));
    for (const yy of [H * 0.15, H * 0.5, H * 0.85]) { const hp = _tor(R * 0.92, 0.015, ir, [0, yy, 0], 6, 20); hp.rotation.x = Math.PI / 2; g.add(hp); }
    g.add(_cyl(R * 0.82, R * 0.82, 0.03, M.wood(0x4a3018), [0, H, 0], 16));
    return g;
  }, { icon: "🛢", category: "wizard containers", params: [
    { key: "height", label: "Height", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.7 },
    { key: "color", label: "Wood", type: "color", default: 0x5a3a1a }] });

  register("wooden_crate", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x6a4a28)); const S = o.size;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.05, S, 0.05, wd, [sx * (S / 2 - 0.025), S / 2, sz * (S / 2 - 0.025)]));
    for (const face of [0, 1, 2, 3]) for (let k = 0; k < 3; k++) { const y = 0.1 + k * (S - 0.2) / 2;
      if (face < 2) { const z = (face ? 1 : -1) * (S / 2 - 0.02); g.add(_box(S - 0.06, 0.06, 0.03, wd, [0, y, z])); }
      else { const x = (face - 2 ? 1 : -1) * (S / 2 - 0.02); g.add(_box(0.03, 0.06, S - 0.06, wd, [x, y, 0])); } }
    for (const yy of [0.02, S - 0.02]) for (let k = -1; k <= 1; k++) g.add(_box(S - 0.06, 0.03, 0.1, wd, [0, yy, k * (S / 2 - 0.08)]));
    return g;
  }, { icon: "📦", category: "wizard containers", params: [
    { key: "size", label: "Size", type: "number", min: 0.3, max: 1, step: 0.05, default: 0.5 },
    { key: "color", label: "Wood", type: "color", default: 0x6a4a28 }] });

  register("standing_broom", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3a1a)); const head = M.straw(_c(o.bristles, 0xb89048));
    const handle = _cyl(0.018, 0.022, 1.4, wd, [0.1, 0.7, 0], 8); handle.rotation.z = 0.18; g.add(handle);
    g.add(_cyl(0.04, 0.09, 0.3, head, [-0.02, 0.15, 0], 10));
    g.add(_cyl(0.05, 0.05, 0.04, M.leather(), [0, 0.3, 0], 10));
    for (let i = 0; i < 6; i++) { const a = i * Math.PI * 2 / 6; g.add(_cyl(0.005, 0.005, 0.28, head, [Math.cos(a) * 0.05, 0.13, Math.sin(a) * 0.05], 4)); }
    return g;
  }, { icon: "🧹", category: "wizard containers", params: [
    { key: "color", label: "Handle", type: "color", default: 0x5a3a1a },
    { key: "bristles", label: "Bristles", type: "color", default: 0xb89048 }] });

  register("firewood_stack", function (o) {
    const g = new THREE.Group(); const L = o.length; const cols = [0x5a3a1a, 0x4a3018, 0x6a4a28, 0x5a4028];
    const base = Math.max(2, Math.round(o.width / 0.12)), rows = 3;
    for (let r = 0; r < rows; r++) { const nr = Math.max(1, base - r), y = 0.06 + r * 0.11;
      for (let i = 0; i < nr; i++) { const x = -((nr - 1) * 0.12) / 2 + i * 0.12;
        const log = _cyl(0.055, 0.055, L, M.wood(pick(cols)), [x, y, 0], 8); log.rotation.x = Math.PI / 2; g.add(log);
        const face = _cyl(0.05, 0.05, 0.012, M.wood(0xc8a878), [x, y, L / 2], 8); face.rotation.x = Math.PI / 2; g.add(face); } }
    return g;
  }, { icon: "🪵", category: "wizard containers", params: [
    { key: "width", label: "Width", type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.7 },
    { key: "length", label: "Log length", type: "number", min: 0.3, max: 1, step: 0.1, default: 0.5 }] });

  register("cushion_pile", function (o) {
    const g = new THREE.Group(); const cols = [_c(o.color, 0x8a2a4a), 0x2a4a6a, 0xc8a050, 0x3a6a4a];
    let y = 0; for (let i = 0; i < o.count; i++) { const s = rand(0.28, 0.4); const c = _box(s, 0.12, s, M.fabric(pick(cols)), [rand(-0.05, 0.05), y + 0.06, rand(-0.05, 0.05)]); c.rotation.y = rand(-0.5, 0.5); g.add(c); y += 0.1; }
    return g;
  }, { icon: "🛏", category: "wizard containers", params: [
    { key: "count", label: "Cushions", type: "int", min: 2, max: 6, default: 4 },
    { key: "color", label: "Top Cushion", type: "color", default: 0x8a2a4a }] });

  register("knitted_throw", function (o) {
    const g = new THREE.Group(); const f = M.fabric(_c(o.color, 0x6a3a6a));
    for (let i = 0; i < 6; i++) g.add(_box(0.5, 0.03, 0.12, f, [0, 0.3 - i * 0.05, 0.18 - i * 0.06])); // draped folds down a chair back
    for (let i = 0; i < 5; i++) g.add(_box(0.5, 0.03, 0.1, f, [0, 0.02, -0.05 - i * 0.09]));            // pooled on seat
    return g;
  }, { icon: "🧶", category: "wizard containers", params: [
    { key: "color", label: "Wool", type: "color", default: 0x6a3a6a }] });

  register("letter_pile", function (o) {
    const g = new THREE.Group(); const pap = M.plaster(_c(o.color, 0xeee4d0));
    let y = 0; for (let i = 0; i < o.count; i++) { const e = _box(0.22, 0.012, 0.15, pap, [rand(-0.03, 0.03), y + 0.006, rand(-0.03, 0.03)]); e.rotation.y = rand(-0.4, 0.4); g.add(e); g.add(_sph(0.018, M.wax(0xb02a2a), [e.position.x, y + 0.018, e.position.z], 6)); y += 0.014; }
    return g;
  }, { icon: "✉", category: "wizard containers", params: [
    { key: "count", label: "Letters", type: "int", min: 2, max: 10, default: 5 },
    { key: "color", label: "Parchment", type: "color", default: 0xeee4d0 }] });

  // ════════════════════════════════════════════════════════════
  //  CREATURES  (several animated)
  // ════════════════════════════════════════════════════════════

  register("spare_wand_barrel", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3a22)), ir = M.metal(0x3a342c);
    g.add(_cyl(0.18, 0.2, 0.5, wd, [0, 0.25, 0], 14));
    for (const yy of [0.1, 0.4]) { const r = _tor(0.19, 0.015, ir, [0, yy, 0], 8, 18); r.rotation.x = Math.PI / 2; g.add(r); }
    for (let i = 0; i < 9; i++) { const a = rand(0, Math.PI * 2), r = rand(0, 0.13); const w = _cyl(0.006, 0.009, rand(0.32, 0.42), M.wood(pick([0x3a2414, 0x6a4a2a, 0x2a1a10])), [Math.cos(a) * r, 0.6, Math.sin(a) * r], 5); w.rotation.x = rand(-0.15, 0.15); w.rotation.z = rand(-0.15, 0.15); g.add(w); }
    return g;
  }, { icon: "🪄", category: "wizard containers", params: [
    { key: "color", label: "Barrel", type: "color", default: 0x5a3a22 }] });

  register("ewer_and_basin", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x4a3018), cer = M.ceramic(_c(o.color, 0xe0d4c0));
    g.add(_box(0.5, 0.04, 0.4, wd, [0, 0.85, 0]));
    for (const [x, z] of [[-0.2, 0.15], [0.2, 0.15], [-0.2, -0.15], [0.2, -0.15]]) g.add(_cyl(0.03, 0.03, 0.85, wd, [x, 0.42, z], 6));
    g.add(_cyl(0.2, 0.16, 0.1, cer, [-0.08, 0.92, 0], 16));
    g.add(_cyl(0.1, 0.13, 0.22, cer, [0.16, 0.98, 0], 12));     // ewer body
    g.add(_cyl(0.06, 0.1, 0.1, cer, [0.16, 1.13, 0], 12));      // ewer neck
    g.add(_cone(0.04, 0.06, cer, [0.24, 1.16, 0], 6)); g.children[g.children.length - 1].rotation.z = -1; // spout
    g.add(_tor(0.05, 0.012, cer, [0.06, 1.0, 0], 6, 12));       // handle
    return g;
  }, { icon: "🏺", category: "wizard containers", params: [
    { key: "color", label: "Ceramic", type: "color", default: 0xe0d4c0 }] });

  register("ball_chest", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), ir = M.metal(0x3a342c), br = M.brass(0xc8a050);
    g.add(_box(0.7, 0.4, 0.4, wd, [0, 0.2, 0]));
    const lid = _box(0.72, 0.16, 0.42, wd, [0, 0.46, -0.18]); lid.rotation.x = -0.5; g.add(lid);
    for (const x of [-0.3, 0.3]) { g.add(_box(0.04, 0.42, 0.42, ir, [x, 0.2, 0])); }
    g.add(_box(0.1, 0.1, 0.04, br, [0, 0.2, 0.2]));       // lock
    // balls inside
    g.add(_sph(0.08, M.metal(0xb02a2a), [-0.15, 0.32, 0.05], 10));
    g.add(_sph(0.06, M.metal(0x8a8278), [0.1, 0.3, 0.08], 10));
    g.add(_sph(0.05, glow(0xd4af37, 0.6), [0.22, 0.28, -0.05], 8));
    return g;
  }, { icon: "📦", category: "wizard containers", params: [
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  register("broom_service_kit", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3a22)), str = M.straw(0xc8a850), m = M.metal(0x3a342c);
    g.add(_box(0.5, 0.12, 0.34, wd, [0, 0.06, 0]));       // open case base
    g.add(_box(0.5, 0.3, 0.04, wd, [0, 0.2, -0.17]));     // raised lid back
    // a broom laid across
    const broom = new THREE.Group();
    broom.add(_cyl(0.018, 0.022, 0.6, M.wood(0x3a2414), [0, 0, 0], 8)).rotation.z = Math.PI / 2;
    broom.add(_cone(0.05, 0.18, str, [-0.34, 0, 0], 8)); broom.children[1].rotation.z = Math.PI / 2;
    broom.position.set(0.05, 0.16, 0.05); broom.rotation.y = 0.2; g.add(broom);
    // tools
    g.add(_box(0.04, 0.02, 0.1, m, [-0.15, 0.13, -0.08]));
    g.add(_cyl(0.02, 0.025, 0.08, M.ceramic(0xc8a060), [0.15, 0.14, -0.08], 8)); // polish tin
    g.add(_box(0.08, 0.01, 0.06, M.fabric(0xd0c0a0), [0.0, 0.13, -0.1]));        // cloth
    return g;
  }, { icon: "🧹", category: "wizard containers", params: [
    { key: "color", label: "Case", type: "color", default: 0x5a3a22 }] });

  register("chained_manacle_set", function (o) {
    const g = new THREE.Group(); const ir = M.metal(_c(o.color, 0x3a342c));
    g.add(_box(0.5, 0.3, 0.1, M.stone(0x4a4338), [0, 1.0, 0]));  // wall block
    for (const sx of [-1, 1]) { let y = 1.0; for (let i = 0; i < 6; i++) { const link = _tor(0.025, 0.008, ir, [sx * 0.16, y, 0.06], 4, 10); link.rotation.x = i % 2 ? 0 : Math.PI / 2; g.add(link); y -= 0.05; }
      g.add(_tor(0.05, 0.012, ir, [sx * 0.16, y - 0.02, 0.06], 6, 14)); // cuff
      g.add(_tor(0.05, 0.012, ir, [sx * 0.16, y - 0.02, 0.06], 6, 14)); }
    return g;
  }, { icon: "⛓", category: "wizard containers", params: [
    { key: "color", label: "Iron", type: "color", default: 0x3a342c }] });
})();
