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

  register("floating_candles", function (o) {
    const g = new THREE.Group();
    const wax = M.wax(), flame = glow(0xffb24a, 2.0);
    for (let i = 0; i < o.count; i++) {
      const x = rand(-o.spread, o.spread), z = rand(-o.spread, o.spread);
      const y = o.height + rand(-0.4, 0.4), ch = rand(0.18, 0.34);
      g.add(_cyl(0.035, 0.04, ch, wax, [x, y, z], 8));
      g.add(_cone(0.04, 0.12, flame, [x, y + ch / 2 + 0.08, z], 6));
    }
    return g;
  }, {
    icon: "✦", category: "wizard lighting",
    params: [
      { key: "count",  label: "Count",  type: "int",    min: 3, max: 40, step: 1,    default: 9 },
      { key: "height", label: "Height", type: "number", min: 1, max: 4,  step: 0.1,  default: 2.2 },
      { key: "spread", label: "Spread", type: "number", min: 0.5, max: 4, step: 0.1, default: 1.5 },
    ],
  });

  // ── Wand stand ───────────────────────────────────────────────

  register("arcane_brazier", function (o) {
    const g = new THREE.Group();
    const ir = M.metal(0x2a2520);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const leg = _cyl(0.025, 0.03, 0.7, ir, [Math.cos(a) * 0.2, 0.35, Math.sin(a) * 0.2], 6);
      leg.rotation.x =  Math.sin(a) * 0.28;
      leg.rotation.z = -Math.cos(a) * 0.28;
      g.add(leg);
    }
    g.add(_cyl(0.3, 0.18, 0.22, ir, [0, 0.78, 0], 18));         // bowl
    const rim = _tor(0.3, 0.03, ir, [0, 0.89, 0], 8, 20); rim.rotation.x = Math.PI / 2; g.add(rim);
    const fm = glow(_c(o.color, 0x6a4ad6), 2.0);
    for (let i = 0; i < 6; i++) {                                // flames
      const a = rand(0, Math.PI * 2), rr = rand(0, 0.15);
      g.add(_cone(rand(0.05, 0.1), rand(0.2, 0.45), fm, [Math.cos(a) * rr, 0.95 + rand(0, 0.1), Math.sin(a) * rr], 6));
    }
    for (let i = 0; i < 5; i++) {                                // embers
      g.add(_sph(0.015, fm, [rand(-0.2, 0.2), 1.1 + rand(0, 0.4), rand(-0.2, 0.2)], 5));
    }
    return g;
  }, {
    icon: "✸", category: "wizard lighting",
    params: [
      { key: "color", label: "Flame", type: "color", default: 0x6a4ad6 },
    ],
  });

  // ── Great hall table ─────────────────────────────────────────
  // Long banquet table with a bench on each side.

  register("grand_hearth", function (o) {
    const g = new THREE.Group();
    const st = M.stone(_c(o.color, 0x5a5045));
    const W = o.width, H = o.height, D = 0.5;
    g.add(_box(0.3, H, D, st, [-(W / 2 - 0.15), H / 2, 0]));            // left pier
    g.add(_box(0.3, H, D, st, [ (W / 2 - 0.15), H / 2, 0]));            // right pier
    g.add(_box(W, 0.3, D, st, [0, H - 0.15, 0]));                       // lintel
    g.add(_box(W + 0.3, 0.12, D + 0.15, st, [0, H + 0.05, 0.05]));      // mantel
    g.add(_box(W - 0.6, H - 0.3, 0.06, st, [0, (H - 0.3) / 2, -D / 2 + 0.05])); // back
    g.add(_box(W - 0.6, 0.06, D, M.stone(0x3a352e), [0, 0.03, 0]));     // hearth floor
    for (let i = 0; i < 3; i++) {                                       // logs
      const lg = _cyl(0.05, 0.05, W * 0.4, M.wood(0x3a2414), [-0.15 + i * 0.15, 0.1, 0], 8);
      lg.rotation.z = Math.PI / 2; lg.rotation.y = i * 0.4; g.add(lg);
    }
    const fm = glow(_c(o.flame, 0x3ad65a), 2.0);                        // magical flame
    for (let i = 0; i < 5; i++) {
      g.add(_cone(rand(0.06, 0.12), rand(0.2, 0.5), fm, [rand(-(W - 0.8) / 2, (W - 0.8) / 2), 0.25 + rand(0, 0.1), rand(-0.1, 0.1)], 6));
    }
    return g;
  }, {
    icon: "⌂", category: "wizard lighting",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 1,   max: 3,   step: 0.1, default: 1.8 },
      { key: "height", label: "Height", type: "number", min: 1.5, max: 3,   step: 0.1, default: 2.2 },
      { key: "color",  label: "Stone",  type: "color",  default: 0x5a5045 },
      { key: "flame",  label: "Flame",  type: "color",  default: 0x3ad65a },
    ],
  });

  // ── Alembic set ──────────────────────────────────────────────
  // Alchemical distillation glassware on a small bench.

  register("wisp_lantern", function (o) {
    const g = new THREE.Group();
    const ir = M.metal(0x2a2520);
    g.add(_cyl(0.12, 0.16, 0.08, M.stone(), [0, 0.04, 0], 12));         // base
    g.add(_cyl(0.04, 0.05, 2.0, ir, [0, 1.0, 0], 8));                   // post
    const arm = _cyl(0.03, 0.03, 0.4, ir, [0.1, 2.0, 0], 6); arm.rotation.z = Math.PI / 2.5; g.add(arm);
    const cy = 2.05;
    for (let i = 0; i < 2; i++) { const r = _tor(0.1, 0.012, ir, [0.25, cy, 0], 5, 12); r.rotation.x = i ? 0 : Math.PI / 2; g.add(r); } // cage
    const wc = _c(o.glow, 0x6ad6ff);
    g.add(_sph(0.06, glow(wc, 2.2), [0.25, cy, 0], 10));                // wisp
    g.add(_sph(0.1, new THREE.MeshStandardMaterial({ color: wc, emissive: wc, emissiveIntensity: 1.0, transparent: true, opacity: 0.3 }), [0.25, cy, 0], 10)); // halo
    return g;
  }, {
    icon: "❂", category: "wizard lighting",
    params: [
      { key: "glow", label: "Wisp", type: "color", default: 0x6ad6ff },
    ],
  });

  // ═══ CASTLE & DUNGEON ARCHITECTURE ═══════════════════════════

  register("wall_brazier", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520); const y = o.height;
    g.add(_box(0.16, 0.3, 0.04, ir, [0, y, 0]));
    g.add(_box(0.04, 0.04, 0.2, ir, [0, y - 0.05, 0.12]));
    g.add(_cyl(0.14, 0.08, 0.16, ir, [0, y, 0.22], 10));
    const fm = glow(_c(o.flame, 0xffb24a), 2.0);
    for (let i = 0; i < 4; i++) g.add(_cone(rand(0.04, 0.08), rand(0.15, 0.3), fm, [rand(-0.08, 0.08), y + 0.12 + rand(0, 0.06), 0.22 + rand(-0.05, 0.05)], 6));
    return g;
  }, { icon: "♨", category: "wizard lighting", params: [
    { key: "height", label: "Mount Y", type: "number", min: 1, max: 3, step: 0.1, default: 1.8 },
    { key: "flame", label: "Flame", type: "color", default: 0xffb24a }] });

  register("iron_torch_bracket", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520); const y = o.height;
    g.add(_box(0.1, 0.2, 0.04, ir, [0, y, 0]));
    const arm = _cyl(0.02, 0.02, 0.25, ir, [0, y, 0.12], 6); arm.rotation.x = -0.6; g.add(arm);
    const tx = 0, ty = y + 0.12, tz = 0.24;
    g.add(_cyl(0.02, 0.025, 0.3, M.wood(0x3a2414), [tx, ty, tz], 6));
    const fm = glow(_c(o.flame, 0xffa030), 2.2);
    for (let i = 0; i < 3; i++) g.add(_cone(rand(0.04, 0.07), rand(0.12, 0.25), fm, [tx + rand(-0.03, 0.03), ty + 0.18 + rand(0, 0.05), tz], 6));
    return g;
  }, { icon: "ϯ", category: "wizard lighting", params: [
    { key: "height", label: "Mount Y", type: "number", min: 1.2, max: 3, step: 0.1, default: 1.9 },
    { key: "flame", label: "Flame", type: "color", default: 0xffa030 }] });

  register("candle_ring", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520); const R = o.radius, y = o.height;
    const ring = _tor(R, 0.03, ir, [0, y, 0], 6, 28); ring.rotation.x = Math.PI / 2; g.add(ring);
    const wax = M.wax(); const fm = glow(0xffb24a, 2.0); const n = o.count;
    for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n, x = Math.cos(a) * R, z = Math.sin(a) * R;
      g.add(_cyl(0.04, 0.03, 0.03, ir, [x, y + 0.01, z], 6));
      g.add(_cyl(0.025, 0.03, 0.18, wax, [x, y + 0.09, z], 6));
      g.add(_cone(0.03, 0.1, fm, [x, y + 0.23, z], 6)); }
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; g.add(_cyl(0.006, 0.006, 0.5, ir, [Math.cos(a) * R * 0.6, y + 0.3, Math.sin(a) * R * 0.6], 4)); }
    g.add(_cyl(0.02, 0.02, 0.06, ir, [0, y + 0.55, 0], 6));
    return g;
  }, { icon: "✲", category: "wizard lighting", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.3, max: 1, step: 0.05, default: 0.5 },
    { key: "count", label: "Candles", type: "int", min: 4, max: 16, step: 1, default: 8 },
    { key: "height", label: "Hang Y", type: "number", min: 1.5, max: 3.5, step: 0.1, default: 2.4 }] });

  register("eternal_candle", function (o) {
    const g = new THREE.Group(); const wax = M.wax(_c(o.color, 0xf0e8c8));
    g.add(_cyl(0.12, 0.14, 0.04, M.brass(), [0, 0.02, 0], 14));
    g.add(_cyl(0.08, 0.1, o.height, wax, [0, o.height / 2 + 0.04, 0], 14));
    for (let i = 0; i < 5; i++) { const a = rand(0, Math.PI * 2); g.add(_cyl(0.012, 0.012, rand(0.05, 0.15), wax, [Math.cos(a) * 0.09, o.height * rand(0.5, 0.9), Math.sin(a) * 0.09], 4)); }
    g.add(_cone(0.04, 0.14, glow(0xffd060, 2.4), [0, o.height + 0.12, 0], 6));
    return g;
  }, { icon: "♪", category: "wizard lighting", params: [
    { key: "height", label: "Height", type: "number", min: 0.2, max: 1, step: 0.05, default: 0.4 },
    { key: "color", label: "Wax", type: "color", default: 0xf0e8c8 }] });

  register("enchanted_fountain", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x8a8278)); const wc = _c(o.water, 0x6ad6ff); const wm = glow(wc, 0.8); const R = o.radius;
    g.add(_cyl(R, R * 1.05, 0.2, st, [0, 0.1, 0], 24));
    g.add(_cyl(R * 0.92, R * 0.92, 0.02, wm, [0, 0.2, 0], 24));
    g.add(_cyl(0.12, 0.16, 0.5, st, [0, 0.45, 0], 12));
    g.add(_cyl(R * 0.5, R * 0.4, 0.1, st, [0, 0.72, 0], 18));
    g.add(_cyl(R * 0.44, R * 0.44, 0.02, wm, [0, 0.77, 0], 18));
    g.add(_cyl(0.05, 0.08, 0.2, st, [0, 0.9, 0], 10));
    g.add(_sph(0.06, wm, [0, 1.0, 0], 10));
    for (let i = 0; i < 6; i++) { const a = i * Math.PI * 2 / 6; g.add(_cyl(0.01, 0.01, 0.35, wm, [Math.cos(a) * R * 0.45, 0.55, Math.sin(a) * R * 0.45], 4)); }
    return g;
  }, { icon: "⛲", category: "wizard lighting", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.6 },
    { key: "color", label: "Stone", type: "color", default: 0x8a8278 },
    { key: "water", label: "Water", type: "color", default: 0x6ad6ff }] });

  // ════════════════════════════════════════════════════════════
  //  WAVE 4 — towers, ghost-light, lab, study, statues, garden
  // ════════════════════════════════════════════════════════════

  register("floating_chandelier", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520); const R = o.radius, y = o.height, n = o.candles;
    const ring = _tor(R, 0.02, ir, [0, y, 0], 6, 24); ring.rotation.x = Math.PI / 2; g.add(ring);
    const ring2 = _tor(R * 0.6, 0.018, ir, [0, y + 0.05, 0], 6, 20); ring2.rotation.x = Math.PI / 2; g.add(ring2);
    for (let i = 0; i < 4; i++) { const sp = _cyl(0.012, 0.012, R * 2, ir, [0, y + 0.025, 0], 4); sp.rotation.z = Math.PI / 2; sp.rotation.y = i * Math.PI / 2; g.add(sp); }
    for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n, x = Math.cos(a) * R, z = Math.sin(a) * R; g.add(_cyl(0.025, 0.03, 0.14, M.wax(0xe8dcc0), [x, y + 0.07, z], 6)); g.add(_cone(0.02, 0.05, glow(0xffcf6a, 2.2), [x, y + 0.16, z], 6)); }
    return g;
  }, { icon: "✦", category: "wizard lighting", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.3, max: 1.2, step: 0.1, default: 0.5 },
    { key: "height", label: "Hover", type: "number", min: 1, max: 3, step: 0.1, default: 1.9 },
    { key: "candles", label: "Candles", type: "int", min: 3, max: 16, step: 1, default: 8 }] });

  register("marsh_lantern", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x2a2418), ir = M.metal(0x2a2520); const ly = 1.0;
    g.add(_cyl(0.04, 0.06, 1.0, wd, [0, 0.5, 0], 6));
    const post2 = _cyl(0.035, 0.04, 0.3, wd, [0.05, 1.05, 0], 6); post2.rotation.z = 0.3; g.add(post2);
    g.add(_box(0.14, 0.02, 0.14, ir, [0.12, ly - 0.08, 0])); g.add(_box(0.14, 0.02, 0.14, ir, [0.12, ly + 0.08, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_cyl(0.008, 0.008, 0.16, ir, [0.12 + sx * 0.06, ly, sz * 0.06], 4));
    g.add(_sph(0.05, glow(_c(o.flame, 0x6ad67a), 2.4), [0.12, ly, 0], 10));
    return g;
  }, { icon: "ϟ", category: "wizard lighting", params: [
    { key: "flame", label: "Wisp", type: "color", default: 0x6ad67a }] });

  register("spirit_brazier", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; const leg = _cyl(0.025, 0.03, 0.6, ir, [Math.cos(a) * 0.18, 0.3, Math.sin(a) * 0.18], 5); leg.rotation.x = Math.sin(a) * 0.3; leg.rotation.z = -Math.cos(a) * 0.3; g.add(leg); }
    g.add(_cyl(0.26, 0.16, 0.14, ir, [0, 0.62, 0], 16));
    const fm = glow(_c(o.flame, 0x6a8aff), 2.2);
    for (let i = 0; i < 6; i++) g.add(_cone(rand(0.05, 0.1), rand(0.2, 0.45), fm, [rand(-0.12, 0.12), 0.72 + rand(0, 0.1), rand(-0.12, 0.12)], 6));
    return g;
  }, { icon: "♨", category: "wizard lighting", params: [
    { key: "flame", label: "Flame", type: "color", default: 0x6a8aff }] });

  register("star_lantern", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xffd24a); const m = glow(c, 1.6); const y = o.height;
    g.add(_sph(0.12, m, [0, y, 0], 12));
    const dirs = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    dirs.forEach(d => { const cone = _cone(0.06, 0.18, m, [d[0] * 0.18, y + d[1] * 0.18, d[2] * 0.18], 5);
      if (d[1] === -1) cone.rotation.x = Math.PI; else if (d[0] !== 0) cone.rotation.z = -Math.sign(d[0]) * Math.PI / 2; else if (d[2] !== 0) cone.rotation.x = Math.sign(d[2]) * Math.PI / 2; g.add(cone); });
    g.add(_cyl(0.004, 0.004, 0.4, M.cloth(0x3a2a1a), [0, y + 0.4, 0], 4));
    return g;
  }, { icon: "★", category: "wizard lighting", params: [
    { key: "height", label: "Hover", type: "number", min: 0.8, max: 2.5, step: 0.1, default: 1.6 },
    { key: "color", label: "Glow", type: "color", default: 0xffd24a }] });

  register("floating_torches", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x3a2414); const n = o.count, R = o.radius, y = o.height;
    for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n, x = Math.cos(a) * R, z = Math.sin(a) * R;
      g.add(_cyl(0.025, 0.03, 0.4, wd, [x, y, z], 6)); g.add(_cyl(0.06, 0.03, 0.06, M.cloth(0x2a2418), [x, y + 0.22, z], 8)); g.add(_cone(0.05, 0.16, glow(_c(o.flame, 0xff9a3a), 2.4), [x, y + 0.34, z], 6)); }
    return g;
  }, { icon: "✷", category: "wizard lighting", params: [
    { key: "count", label: "Torches", type: "int", min: 3, max: 16, step: 1, default: 6 },
    { key: "radius", label: "Radius", type: "number", min: 0.4, max: 2, step: 0.1, default: 0.8 },
    { key: "height", label: "Hover", type: "number", min: 1, max: 2.5, step: 0.1, default: 1.6 },
    { key: "flame", label: "Flame", type: "color", default: 0xff9a3a }] });

  register("lantern_string", function (o) {
    const g = new THREE.Group(); const n = o.count, W = o.width, y = o.height; const cols = [0xff9a3a, 0x6ad6ff, 0xff5a8a, 0x8aff6a, 0xffd24a];
    for (let i = 0; i < n; i++) { const t = i / (n - 1); const x = -W / 2 + t * W; const ly = y - 0.3 * Math.sin(t * Math.PI); g.add(_sph(0.06, glow(pick(cols), 1.6), [x, ly, 0], 10)); g.add(_cyl(0.04, 0.05, 0.02, M.metal(0x2a2520), [x, ly + 0.08, 0], 8)); }
    for (let i = 0; i < n - 1; i++) { const t0 = i / (n - 1), t1 = (i + 1) / (n - 1); const x0 = -W / 2 + t0 * W, x1 = -W / 2 + t1 * W; const y0 = y - 0.3 * Math.sin(t0 * Math.PI) + 0.1, y1 = y - 0.3 * Math.sin(t1 * Math.PI) + 0.1; const seg = _cyl(0.004, 0.004, Math.hypot(x1 - x0, y1 - y0), M.metal(0x222018), [(x0 + x1) / 2, (y0 + y1) / 2, 0], 4); seg.rotation.z = Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2; g.add(seg); }
    return g;
  }, { icon: "⋰", category: "wizard lighting", params: [
    { key: "count", label: "Lanterns", type: "int", min: 3, max: 12, step: 1, default: 6 },
    { key: "width", label: "Span", type: "number", min: 1, max: 4, step: 0.1, default: 2.0 },
    { key: "height", label: "Hang", type: "number", min: 1.5, max: 3, step: 0.1, default: 2.2 }] });

  register("candle_stub", function (o) {
    const g = new THREE.Group(); const wax = M.wax(_c(o.color, 0xe8e0c8));
    g.add(_cyl(0.06, 0.07, 0.015, M.metal(0x6a5a3a), [0, 0.008, 0], 12));
    g.add(_cyl(0.035, 0.04, 0.08, wax, [0, 0.05, 0], 10));
    for (let i = 0; i < 4; i++) { const a = i * 1.5; g.add(_cyl(0.012, 0.015, rand(0.03, 0.06), wax, [Math.cos(a) * 0.035, 0.06, Math.sin(a) * 0.035], 5)); }
    g.add(_cone(0.02, 0.06, glow(0xffcf6a, 2.2), [0, 0.12, 0], 6));
    g.add(_sph(0.012, glow(0xfff2c0, 2.6), [0, 0.1, 0], 6));
    return g;
  }, { icon: "🕯", category: "wizard lighting", params: [
    { key: "color", label: "Wax", type: "color", default: 0xe8e0c8 }] });

  register("candle_sconce", function (o) {
    const g = new THREE.Group(); const m = M.metal(_c(o.color, 0x2a2520)); const y = o.height;
    g.add(_box(0.06, 0.2, 0.04, m, [0, y, -0.02]));
    const arm = _cyl(0.015, 0.015, 0.16, m, [0, y - 0.02, 0.08], 5); arm.rotation.x = Math.PI / 2 - 0.4; g.add(arm);
    g.add(_cyl(0.05, 0.06, 0.03, m, [0, y + 0.02, 0.15], 10));
    g.add(_cyl(0.03, 0.035, 0.1, M.wax(0xe8dcc0), [0, y + 0.08, 0.15], 8));
    g.add(_cone(0.02, 0.05, glow(0xffcf6a, 2.2), [0, y + 0.16, 0.15], 6));
    g.add(_sph(0.012, glow(0xfff2c0, 2.6), [0, y + 0.14, 0.15], 6));
    return g;
  }, { icon: "🔥", category: "wizard lighting", params: [
    { key: "height", label: "Mount", type: "number", min: 1, max: 2.5, step: 0.1, default: 1.6 },
    { key: "color", label: "Iron", type: "color", default: 0x2a2520 }] });

  register("hanging_chandelier", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520); const R = o.radius, topY = o.height, ringY = topY - 0.6;
    for (let i = 0; i < 5; i++) { const lk = _tor(0.03, 0.008, ir, [0, topY - 0.05 - i * 0.1, 0], 6, 10); lk.rotation.x = i % 2 ? Math.PI / 2 : 0; g.add(lk); }
    g.add(_sph(0.04, ir, [0, ringY + 0.05, 0], 8));
    const ring = _tor(R, 0.02, ir, [0, ringY, 0], 6, 24); ring.rotation.x = Math.PI / 2; g.add(ring);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const arm = _cyl(0.01, 0.01, R, ir, [Math.cos(a) * R / 2, ringY + 0.03, Math.sin(a) * R / 2], 4); arm.rotation.z = Math.PI / 2; arm.rotation.y = a; g.add(arm); }
    for (let i = 0; i < o.candles; i++) { const a = i * Math.PI * 2 / o.candles, x = Math.cos(a) * R, z = Math.sin(a) * R; g.add(_cyl(0.025, 0.03, 0.14, M.wax(0xe8dcc0), [x, ringY + 0.07, z], 6)); g.add(_cone(0.02, 0.05, glow(0xffcf6a, 2.2), [x, ringY + 0.16, z], 6)); }
    return g;
  }, { icon: "🕎", category: "wizard lighting", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.3, max: 1.2, step: 0.1, default: 0.5 },
    { key: "height", label: "Ceiling", type: "number", min: 2, max: 5, step: 0.1, default: 3.0 },
    { key: "candles", label: "Candles", type: "int", min: 3, max: 16, step: 1, default: 8 }] });

  register("floor_candelabra", function (o) {
    const g = new THREE.Group(); const m = M.metal(_c(o.color, 0x2a2520)); const H = o.height;
    g.add(_cyl(0.18, 0.22, 0.06, m, [0, 0.03, 0], 12));
    g.add(_cyl(0.025, 0.03, H, m, [0, H / 2, 0], 8));
    g.add(_sph(0.05, m, [0, H * 0.55, 0], 8));
    for (let i = 0; i < o.arms; i++) { const a = i * Math.PI * 2 / o.arms;
      const arm = _cyl(0.012, 0.012, 0.3, m, [Math.cos(a) * 0.14, H - 0.05, Math.sin(a) * 0.14], 5); arm.rotation.z = Math.PI / 2; arm.rotation.y = a; arm.rotation.x = -0.3; g.add(arm);
      const cx = Math.cos(a) * 0.28, cz = Math.sin(a) * 0.28;
      g.add(_cyl(0.025, 0.03, 0.1, M.wax(0xe8dcc0), [cx, H + 0.05, cz], 6)); g.add(_cone(0.018, 0.045, glow(0xffcf6a, 2.2), [cx, H + 0.13, cz], 6)); }
    g.add(_cyl(0.025, 0.03, 0.1, M.wax(0xe8dcc0), [0, H + 0.1, 0], 6)); g.add(_cone(0.018, 0.045, glow(0xffcf6a, 2.2), [0, H + 0.18, 0], 6));
    return g;
  }, { icon: "🕯", category: "wizard lighting", params: [
    { key: "height", label: "Height", type: "number", min: 0.8, max: 2, step: 0.1, default: 1.3 },
    { key: "arms", label: "Arms", type: "int", min: 2, max: 6, step: 1, default: 4 },
    { key: "color", label: "Iron", type: "color", default: 0x2a2520 }] });

  register("flickering_hearth", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5248)), ir = M.metal(0x2a2520);
    const W = o.width;
    g.add(_box(W, 1.4, 0.4, st, [0, 0.7, 0]));                   // surround
    g.add(_box(W - 0.5, 1.0, 0.5, M.stone(0x1a1612), [0, 0.5, 0.06])); // firebox cavity
    g.add(_box(W + 0.2, 0.2, 0.5, st, [0, 1.5, 0]));            // mantel
    for (let i = 0; i < 4; i++) { const lw = W - 0.6; g.add(_cyl(0.05, 0.06, lw, M.wood(0x3a2414), [0, 0.12 + i * 0.04, 0.12], 6)); g.children[g.children.length - 1].rotation.z = Math.PI / 2; } // logs
    const flames = [];
    for (let i = 0; i < 6; i++) { const fx = (i - 2.5) * (W - 0.7) / 6; const fm = glow(i % 2 ? 0xff6a1a : 0xffb24a, 1.4); const fl = _cone(rand(0.05, 0.09), rand(0.2, 0.4), fm, [fx, 0.3, 0.12], 6); g.add(fl); flames.push({ m: fl, base: 0.3, h: fl.geometry.parameters.height, ph: rand(0, 6) }); }
    const ember = glow(0xff4a1a, 1.0); g.add(_box(W - 0.6, 0.06, 0.3, ember, [0, 0.14, 0.12]));
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; flames.forEach((f) => { const fl = 0.7 + Math.sin(t * 9 + f.ph) * 0.2 + Math.sin(t * 17 + f.ph * 2) * 0.1; f.m.scale.y = fl; f.m.material.emissiveIntensity = 1.2 + fl * 0.6; f.m.position.x += Math.sin(t * 6 + f.ph) * 0.0008; }); ember.emissiveIntensity = 0.8 + Math.sin(t * 4) * 0.3; };
    return g;
  }, { icon: "🔥", category: "wizard lighting", params: [
    { key: "width", label: "Width", type: "number", min: 1.2, max: 3, step: 0.2, default: 1.8 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5248 }] });

  register("hovering_candle_chandelier", function (o) {
    const g = new THREE.Group();
    const candles = []; const n = o.count;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const r = 0.35; const c = new THREE.Group();
      c.add(_cyl(0.02, 0.022, 0.14, M.wax(0xf0e8c8), [0, 0, 0], 8));
      const fm = glow(0xffcc55, 1.5); const fl = _cone(0.014, 0.05, fm, [0, 0.09, 0], 6); c.add(fl);
      c.position.set(Math.cos(a) * r, o.height, Math.sin(a) * r); g.add(c); candles.push({ c, fm, fl, ph: rand(0, 6), baseY: o.height }); }
    // center cluster
    for (let i = 0; i < 3; i++) { const c = new THREE.Group(); c.add(_cyl(0.022, 0.024, 0.16, M.wax(0xf0e8c8), [0, 0, 0], 8)); const fm = glow(0xffcc55, 1.5); const fl = _cone(0.015, 0.05, fm, [0, 0.1, 0], 6); c.add(fl); c.position.set(rand(-0.06, 0.06), o.height + 0.05, rand(-0.06, 0.06)); g.add(c); candles.push({ c, fm, fl, ph: rand(0, 6), baseY: o.height + 0.05 }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; candles.forEach((c) => { c.c.position.y = c.baseY + Math.sin(t * 1.0 + c.ph) * 0.04; c.fm.emissiveIntensity = 1.2 + Math.sin(t * 8 + c.ph) * 0.4; c.fl.scale.y = 0.85 + Math.sin(t * 10 + c.ph) * 0.2; }); };
    return g;
  }, { icon: "🕯", category: "wizard lighting", params: [
    { key: "count", label: "Outer Candles", type: "int", min: 4, max: 12, default: 8 },
    { key: "height", label: "Hover Height", type: "number", min: 1.5, max: 3, step: 0.1, default: 2.2 }] });

  register("study_orb_lamp", function (o) {
    const g = new THREE.Group(); const br = M.brass(0xc8a050);
    g.add(_cyl(0.1, 0.13, 0.04, br, [0, 0.02, 0], 12));
    g.add(_cyl(0.015, 0.015, 0.4, br, [0, 0.22, 0], 6));
    const claw = new THREE.Group();
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const c = _cyl(0.008, 0.004, 0.14, br, [Math.cos(a) * 0.06, 0.45, Math.sin(a) * 0.06], 5); c.rotation.x = Math.sin(a) * 0.6; c.rotation.z = -Math.cos(a) * 0.6; g.add(c); }
    const orbMat = glow(_c(o.color, 0xffd98a), 1.3);
    const orb = _sph(0.1, orbMat, [0, 0.52, 0], 14); g.add(orb);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; orbMat.emissiveIntensity = 1.1 + Math.sin(t * 1.2) * 0.3 + Math.sin(t * 0.4) * 0.15; };
    return g;
  }, { icon: "💡", category: "wizard lighting", params: [
    { key: "color", label: "Glow", type: "color", default: 0xffd98a }] });

  // ════════════════════════════════════════════════════════════
  //  CREATURES, ROUND 2
  // ════════════════════════════════════════════════════════════

  register("pixie_lantern", function (o) {
    const g = new THREE.Group(); const br = M.brass(0xc8a050), gl = M.glass(0xcfe3ee);
    g.add(_box(0.16, 0.02, 0.16, br, [0, 0.01, 0]));
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + Math.PI / 4; g.add(_cyl(0.008, 0.008, 0.26, br, [Math.cos(a) * 0.08, 0.14, Math.sin(a) * 0.08], 4)); }
    g.add(_box(0.16, 0.02, 0.16, br, [0, 0.27, 0]));
    g.add(_cone(0.13, 0.1, br, [0, 0.33, 0], 4));
    g.add(_tor(0.025, 0.006, br, [0, 0.4, 0], 4, 10));
    g.add(_box(0.15, 0.24, 0.15, gl, [0, 0.14, 0]));
    const pixie = glow(_c(o.color, 0x4ad0ff), 1.6);
    const p = _sph(0.025, pixie, [0, 0.14, 0], 8); g.add(p);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; p.position.set(Math.sin(t * 3) * 0.05, 0.14 + Math.sin(t * 4.3) * 0.06, Math.cos(t * 2.6) * 0.05); pixie.emissiveIntensity = 1.2 + Math.sin(t * 9) * 0.6; };
    return g;
  }, { icon: "🧚", category: "wizard lighting", params: [
    { key: "color", label: "Pixie", type: "color", default: 0x4ad0ff }] });

  register("flaming_brazier_column", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5248)), ir = M.metal(0x2a2520);
    const H = o.height;
    g.add(_cyl(0.24, 0.3, 0.16, st, [0, 0.08, 0], 12));          // base
    g.add(_cyl(0.16, 0.18, H, st, [0, H / 2 + 0.1, 0], 14));     // column shaft
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(_box(0.02, H * 0.9, 0.03, M.stone(0x4a4338), [Math.cos(a) * 0.17, H / 2 + 0.1, Math.sin(a) * 0.17])); g.children[g.children.length - 1].rotation.y = -a; } // fluting
    g.add(_cyl(0.26, 0.2, 0.12, ir, [0, H + 0.2, 0], 14));       // brazier bowl
    g.add(_cyl(0.24, 0.24, 0.04, M.metal(0x3a342c), [0, H + 0.16, 0], 14));
    const flames = [];
    for (let i = 0; i < 7; i++) { const a = rand(0, Math.PI * 2), r = rand(0, 0.16); const fm = glow(pick([0xff6a1a, 0xffaa33, 0xffd24a]), 1.5); const fl = _cone(rand(0.04, 0.08), rand(0.2, 0.4), fm, [Math.cos(a) * r, H + 0.3, Math.sin(a) * r], 6); g.add(fl); flames.push({ m: fl, base: H + 0.3, ph: rand(0, 6), bx: Math.cos(a) * r, bz: Math.sin(a) * r }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; flames.forEach((f) => { const fl = 0.7 + Math.sin(t * 10 + f.ph) * 0.25 + Math.sin(t * 19 + f.ph) * 0.1; f.m.scale.y = fl; f.m.material.emissiveIntensity = 1.3 + fl * 0.5; f.m.position.x = f.bx + Math.sin(t * 7 + f.ph) * 0.01; f.m.position.z = f.bz + Math.cos(t * 6 + f.ph) * 0.01; }); };
    return g;
  }, { icon: "🔥", category: "wizard lighting", params: [
    { key: "height", label: "Column Height", type: "number", min: 1, max: 3, step: 0.2, default: 1.8 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5248 }] });

  // ════════════════════════════════════════════════════════════
  //  GREAT HALL / FEAST ENCHANTMENTS
  // ════════════════════════════════════════════════════════════

  register("dripping_dungeon_sconce", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520);
    g.add(_box(0.16, 0.3, 0.06, ir, [0, 1.4, 0]));               // wall plate
    const arm = _cyl(0.02, 0.025, 0.24, ir, [0, 1.45, 0.12], 6); arm.rotation.x = 1.0; g.add(arm);
    g.add(_cyl(0.06, 0.04, 0.1, ir, [0, 1.5, 0.24], 8));         // cup
    const fm = glow(_c(o.color, 0xffaa33), 1.4);
    const fl = _cone(0.05, 0.18, fm, [0, 1.62, 0.24], 6); g.add(fl);
    const drips = []; for (let i = 0; i < 2; i++) { const d = _sph(0.015, glow(0xff6a1a, 1.0), [0, 1.5, 0.24], 5); g.add(d); drips.push({ m: d, ph: rand(0, 2) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const f = 0.8 + Math.sin(t * 11) * 0.15 + Math.sin(t * 23) * 0.08; fl.scale.y = f; fm.emissiveIntensity = 1.2 + f * 0.5; drips.forEach((d) => { const p = ((t * 0.5 + d.ph) % 2) / 2; d.m.position.y = 1.5 - p * 0.4; d.m.material.opacity = 1; d.m.visible = p < 0.95; }); };
    return g;
  }, { icon: "🔥", category: "wizard lighting", params: [
    { key: "color", label: "Flame", type: "color", default: 0xffaa33 }] });

  register("great_hearth", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6358)), drk = M.stone(0x1a1612);
    const W = o.width;
    g.add(_box(W, 1.8, 0.6, st, [0, 0.9, -0.2]));
    g.add(_box(W - 0.5, 1.1, 0.5, drk, [0, 0.55, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.3, 1.2, 0.6, st, [sx * (W / 2 - 0.15), 0.6, 0]));
    g.add(_box(W, 0.25, 0.7, st, [0, 1.25, 0]));
    g.add(_box(W + 0.2, 0.12, 0.8, st, [0, 1.42, 0]));
    for (let i = 0; i < 3; i++) { const log = _cyl(0.06, 0.06, W - 0.7, M.wood(0x3a2414), [0, 0.12 + i * 0.05, rand(-0.1, 0.1)], 8); log.rotation.z = Math.PI / 2; g.add(log); }
    const fire = new THREE.Group(); const flames = [];
    for (let i = 0; i < 7; i++) { const fl = _cone(rand(0.05, 0.09), rand(0.2, 0.4), glow(pick([0xff7a1a, 0xffa030, 0xffd24a]), 1.5), [rand(-W / 4, W / 4), 0.15, rand(-0.1, 0.1)], 6); fire.add(fl); flames.push({ m: fl, ph: rand(0, 6) }); }
    g.add(fire);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; flames.forEach((f) => { f.m.scale.y = 1 + Math.sin(t * 8 + f.ph) * 0.3; f.m.material.emissiveIntensity = 1.3 + Math.sin(t * 10 + f.ph) * 0.5; f.m.position.x += Math.sin(t * 5 + f.ph) * dt * 0.05; }); };
    return g;
  }, { icon: "🔥", category: "wizard lighting", params: [
    { key: "width", label: "Width", type: "number", min: 1.5, max: 4, step: 0.5, default: 2.5 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6358 }] });

  register("brazier_flame", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520);
    g.add(_cyl(0.18, 0.22, 0.12, ir, [0, 0.5, 0], 12));
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const leg = _cyl(0.02, 0.02, 0.5, ir, [Math.cos(a) * 0.14, 0.25, Math.sin(a) * 0.14], 5); leg.rotation.x = Math.sin(a) * 0.2; leg.rotation.z = -Math.cos(a) * 0.2; g.add(leg); }
    const fire = new THREE.Group(); const flames = [];
    for (let i = 0; i < 5; i++) { const fl = _cone(rand(0.04, 0.07), rand(0.16, 0.3), glow(_c(o.color, 0xff8a1a), 1.6), [rand(-0.08, 0.08), 0.58, rand(-0.08, 0.08)], 6); fire.add(fl); flames.push({ m: fl, ph: rand(0, 6) }); }
    g.add(fire); let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; flames.forEach((f) => { f.m.scale.y = 1 + Math.sin(t * 9 + f.ph) * 0.35; f.m.material.emissiveIntensity = 1.4 + Math.sin(t * 11 + f.ph) * 0.4; }); };
    return g;
  }, { icon: "🔥", category: "wizard lighting", params: [
    { key: "color", label: "Flame", type: "color", default: 0xff8a1a }] });

  // ════════════════════════════════════════════════════════════
  //  CANDLE SWARM  (floating, animated)
  // ════════════════════════════════════════════════════════════

  register("candle_swarm", function (o) {
    const g = new THREE.Group(); const wax = M.wax(0xf0e8c8);
    const cands = [];
    for (let i = 0; i < o.count; i++) {
      const c = new THREE.Group();
      c.add(_cyl(0.02, 0.024, rand(0.1, 0.2), wax, [0, 0, 0], 8));
      const flame = _cone(0.012, 0.05, glow(0xffcc55, 1.6), [0, 0.1, 0], 6); c.add(flame);
      c.position.set(rand(-o.spread, o.spread), o.height + rand(-0.3, 0.3), rand(-o.spread, o.spread));
      g.add(c); cands.push({ c, flame, ph: rand(0, 6), bx: c.position.x, by: c.position.y });
    }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; cands.forEach((cd) => { cd.c.position.y = cd.by + Math.sin(t * 0.8 + cd.ph) * 0.08; cd.c.position.x = cd.bx + Math.sin(t * 0.5 + cd.ph) * 0.04; cd.flame.material.emissiveIntensity = 1.4 + Math.sin(t * 12 + cd.ph) * 0.4; cd.flame.scale.y = 1 + Math.sin(t * 14 + cd.ph) * 0.2; }); };
    return g;
  }, { icon: "🕯", category: "wizard lighting", params: [
    { key: "count", label: "Candles", type: "int", min: 4, max: 24, default: 12 },
    { key: "spread", label: "Spread", type: "number", min: 0.5, max: 3, step: 0.1, default: 1.5 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 4, step: 0.1, default: 2.6 }] });

  // ════════════════════════════════════════════════════════════
  //  CLASSROOM
  // ════════════════════════════════════════════════════════════

  register("hovering_lantern_cluster", function (o) {
    const g = new THREE.Group(); const m = M.metal(0x2a2520);
    const lanterns = [];
    for (let i = 0; i < o.count; i++) {
      const L = new THREE.Group();
      L.add(_box(0.1, 0.14, 0.1, m, [0, 0, 0]));
      L.add(_box(0.07, 0.1, 0.07, glow(_c(o.color, 0xffcc55), 1.4), [0, 0, 0]));
      L.add(_cone(0.08, 0.05, m, [0, 0.09, 0], 4));
      L.add(_tor(0.02, 0.005, m, [0, 0.13, 0], 4, 10));
      L.position.set(rand(-o.spread, o.spread), o.height + rand(-0.3, 0.3), rand(-o.spread, o.spread));
      g.add(L); lanterns.push({ L, glow: L.children[1], base: L.position.y, ph: rand(0, 6) });
    }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; lanterns.forEach((ln) => { ln.L.position.y = ln.base + Math.sin(t * 0.7 + ln.ph) * 0.1; ln.L.rotation.y += dt * 0.3; ln.glow.material.emissiveIntensity = 1.2 + Math.sin(t * 3 + ln.ph) * 0.3; }); };
    return g;
  }, { icon: "🏮", category: "wizard lighting", params: [
    { key: "count", label: "Lanterns", type: "int", min: 3, max: 12, default: 6 },
    { key: "spread", label: "Spread", type: "number", min: 0.5, max: 3, step: 0.1, default: 1.4 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 4, step: 0.1, default: 2.4 },
    { key: "color", label: "Glow", type: "color", default: 0xffcc55 }] });
})();
