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

  register("scrying_orb", function (o) {
    const g = new THREE.Group();
    const br = M.brass(_c(o.color, 0xc8a050));
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3;
      const leg = _cyl(0.02, 0.03, 0.7, br, [Math.cos(a) * 0.18, 0.35, Math.sin(a) * 0.18], 6);
      leg.rotation.x =  Math.sin(a) * 0.25;
      leg.rotation.z = -Math.cos(a) * 0.25;
      g.add(leg);
      g.add(_box(0.03, 0.08, 0.03, br, [Math.cos(a) * 0.13, 0.7, Math.sin(a) * 0.13]));  // claw
    }
    const ring = _tor(0.14, 0.02, br, [0, 0.66, 0], 8, 18); ring.rotation.x = Math.PI / 2; g.add(ring);
    const orbCol = _c(o.glow, 0x9ad6ff);
    g.add(_sph(0.16, M.glass(orbCol), [0, 0.82, 0], 20));       // crystal shell
    g.add(_sph(0.08, glow(orbCol, 1.5), [0, 0.82, 0], 14));     // inner glow
    return g;
  }, {
    icon: "◉", category: "wizard artifacts",
    params: [
      { key: "color", label: "Stand", type: "color", default: 0xc8a050 },
      { key: "glow",  label: "Orb",   type: "color", default: 0x9ad6ff },
    ],
  });

  // ── Magic mirror ─────────────────────────────────────────────

  register("levitating_books", function (o) {
    const g = new THREE.Group();
    const cols = [0x6b2a1a, 0x2a4a6a, 0x3a5a30, 0x5a2a6a, 0x6a5a2a];
    for (let i = 0; i < o.count; i++) {
      const y = o.height + i * 0.12 + rand(-0.02, 0.02);
      const bk = _box(rand(0.18, 0.26), 0.05, rand(0.24, 0.3), M.book(pick(cols)),
        [rand(-0.15, 0.15), y, rand(-0.15, 0.15)]);
      bk.rotation.y = rand(-0.6, 0.6);
      bk.rotation.z = rand(-0.15, 0.15);
      g.add(bk);
    }
    g.add(_sph(0.1, glow(_c(o.glow, 0x6ad6ff), 0.8), [0, o.height - 0.05, 0], 10));  // base glow
    return g;
  }, {
    icon: "≣", category: "wizard artifacts",
    params: [
      { key: "count",  label: "Books",  type: "int",    min: 2, max: 12, step: 1,   default: 5 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.0 },
      { key: "glow",   label: "Glow",   type: "color",  default: 0x6ad6ff },
    ],
  });

  // ── Summoning circle ─────────────────────────────────────────
  // Flat glowing floor sigil: concentric rings, radial marks, rune ticks.

  register("alembic_set", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(0x3a2a1a), gl = M.glass(_c(o.tint, 0x9ad6c0)), br = M.brass();
    g.add(_box(0.7, 0.04, 0.4, wd, [0, 0.5, 0]));                       // bench top
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.04, 0.5, 0.04, wd, [sx * 0.3, 0.25, sz * 0.16]));
    g.add(_sph(0.12, gl, [-0.2, 0.64, 0], 14));                        // boiling flask
    g.add(_cyl(0.03, 0.04, 0.1, gl, [-0.2, 0.78, 0], 8));              // neck
    g.add(_cyl(0.06, 0.08, 0.05, br, [-0.2, 0.525, 0], 10));           // burner
    g.add(_cone(0.04, 0.1, glow(0xffb24a, 2.0), [-0.2, 0.57, 0], 6));  // flame
    for (let i = 0; i < 3; i++) { const t = _tor(0.05, 0.012, gl, [0.02, 0.74 - i * 0.06, 0], 6, 16); t.rotation.x = Math.PI / 2; g.add(t); } // coil
    g.add(_cyl(0.06, 0.08, 0.14, gl, [0.22, 0.61, 0], 10));            // collection flask
    g.add(_sph(0.05, glow(_c(o.tint, 0x9ad6c0), 0.8), [0.22, 0.59, 0], 8)); // distillate
    const tube = _cyl(0.01, 0.01, 0.24, gl, [-0.09, 0.82, 0], 6); tube.rotation.z = Math.PI / 2.5; g.add(tube);
    return g;
  }, {
    icon: "⚗", category: "wizard artifacts",
    params: [
      { key: "tint", label: "Liquid", type: "color", default: 0x9ad6c0 },
    ],
  });

  // ── Arched window ────────────────────────────────────────────
  // Tall gothic window: stone tracery, glowing stained panes, rose.

  register("enchanted_quill", function (o) {
    const g = new THREE.Group();
    const y = o.height;
    g.add(_box(0.3, 0.01, 0.4, M.plaster(0xe8dcc0), [0, y, 0]));        // parchment
    g.add(_cyl(0.05, 0.06, 0.08, M.glass(0x223344), [0.16, y + 0.04, 0.14], 10)); // inkpot
    g.add(_sph(0.03, glow(_c(o.glow, 0x6a4ad6), 1.0), [0.16, y + 0.05, 0.14], 8));
    const shaft = _cyl(0.006, 0.01, 0.4, M.bone(0xf0e8d0), [0, y + 0.2, -0.02], 6); shaft.rotation.z = 0.4; g.add(shaft);
    const vane = _cone(0.05, 0.3, M.cloth(_c(o.color, 0xd64a6a)), [0.1, y + 0.34, -0.02], 4); vane.rotation.z = 0.4; vane.scale.z = 0.3; g.add(vane);
    const nib = _cyl(0.003, 0.012, 0.05, M.metal(), [-0.07, y + 0.02, -0.02], 4); nib.rotation.z = 0.4; g.add(nib);
    return g;
  }, {
    icon: "✎", category: "wizard artifacts",
    params: [
      { key: "color",  label: "Feather", type: "color",  default: 0xd64a6a },
      { key: "glow",   label: "Ink",     type: "color",  default: 0x6a4ad6 },
      { key: "height", label: "Hover",   type: "number", min: 0, max: 1.5, step: 0.1, default: 0.0 },
    ],
  });

  // ── Portal gate ──────────────────────────────────────────────
  // Heavy stone arch filled with a swirling, rippling glow.

  register("wizard_staff", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018));
    g.add(_cyl(0.12, 0.15, 0.04, M.stone(), [0, 0.02, 0], 12));
    g.add(_cyl(0.025, 0.035, o.height, wd, [0, o.height / 2 + 0.04, 0], 8));
    const ty = o.height + 0.04;
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; const cl = _box(0.02, 0.12, 0.02, wd, [Math.cos(a) * 0.05, ty, Math.sin(a) * 0.05]); cl.rotation.x = Math.sin(a) * 0.4; cl.rotation.z = -Math.cos(a) * 0.4; g.add(cl); }
    const cc = _c(o.glow, 0x8ad6ff);
    g.add(_cone(0.07, 0.18, glow(cc, 1.6), [0, ty + 0.12, 0], 6));
    const cr2 = _cone(0.07, 0.12, glow(cc, 1.6), [0, ty, 0], 6); cr2.rotation.x = Math.PI; g.add(cr2);
    return g;
  }, { icon: "ʈ", category: "wizard artifacts", params: [
    { key: "height", label: "Height", type: "number", min: 1.2, max: 2.2, step: 0.1, default: 1.7 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 },
    { key: "glow", label: "Crystal", type: "color", default: 0x8ad6ff }] });

  register("arcane_orb", function (o) {
    const g = new THREE.Group(); const cc = _c(o.glow, 0x9a6aff); const y = o.height;
    g.add(_sph(0.18, glow(cc, 1.8), [0, y, 0], 16));
    g.add(_sph(0.26, new THREE.MeshStandardMaterial({ color: cc, emissive: cc, emissiveIntensity: 0.8, transparent: true, opacity: 0.2 }), [0, y, 0], 16));
    const gm = glow(cc, 1.4);
    const r1 = _tor(0.32, 0.012, gm, [0, y, 0], 6, 30); r1.rotation.x = Math.PI / 2.3; g.add(r1);
    const r2 = _tor(0.36, 0.01, gm, [0, y, 0], 6, 30); r2.rotation.x = Math.PI / 1.7; r2.rotation.z = 0.5; g.add(r2);
    return g;
  }, { icon: "◑", category: "wizard artifacts", params: [
    { key: "height", label: "Hover", type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.3 },
    { key: "glow", label: "Glow", type: "color", default: 0x9a6aff }] });

  register("rune_tablet", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5348)); const H = o.height, W = o.width;
    g.add(_box(W + 0.2, 0.15, 0.4, st, [0, 0.075, 0]));
    g.add(_box(W, H, 0.2, st, [0, H / 2 + 0.15, 0]));
    const cap = _cyl(W / 2, W / 2, 0.2, st, [0, H + 0.15, 0], 14); cap.rotation.x = Math.PI / 2; g.add(cap);
    const gm = glow(_c(o.glow, 0x6aff9a), 1.2);
    for (let j = 0; j < 4; j++) { const y = H * 0.2 + j * H * 0.18 + 0.15; g.add(_box(W * 0.6, 0.03, 0.02, gm, [0, y, 0.1])); g.add(_box(0.03, 0.1, 0.02, gm, [rand(-W * 0.2, W * 0.2), y, 0.1])); }
    return g;
  }, { icon: "ᚱ", category: "wizard artifacts", params: [
    { key: "width", label: "Width", type: "number", min: 0.4, max: 1, step: 0.05, default: 0.6 },
    { key: "height", label: "Height", type: "number", min: 1, max: 2.5, step: 0.1, default: 1.6 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5348 },
    { key: "glow", label: "Runes", type: "color", default: 0x6aff9a }] });

  register("memory_basin", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6862));
    g.add(_cyl(0.3, 0.36, 0.08, st, [0, 0.04, 0], 16));
    g.add(_cyl(0.12, 0.14, 0.7, st, [0, 0.43, 0], 10));
    g.add(_cyl(0.45, 0.3, 0.18, st, [0, 0.87, 0], 20));
    const rim = _tor(0.45, 0.03, st, [0, 0.96, 0], 8, 24); rim.rotation.x = Math.PI / 2; g.add(rim);
    const lc = _c(o.glow, 0xc8e0ff);
    g.add(_cyl(0.42, 0.42, 0.02, glow(lc, 1.4), [0, 0.93, 0], 24));
    for (let i = 0; i < 3; i++) { const a = rand(0, Math.PI * 2), r = rand(0, 0.3); g.add(_sph(rand(0.02, 0.04), glow(lc, 1.2), [Math.cos(a) * r, 0.95 + rand(0, 0.3), Math.sin(a) * r], 6)); }
    return g;
  }, { icon: "◎", category: "wizard artifacts", params: [
    { key: "color", label: "Stone", type: "color", default: 0x6a6862 },
    { key: "glow", label: "Liquid", type: "color", default: 0xc8e0ff }] });

  register("levitating_crystal", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x6ad0ff);
    const base = M.stone(0x3a3640);
    g.add(_cyl(0.2, 0.26, 0.08, base, [0, 0.04, 0], 8));
    g.add(_cyl(0.16, 0.2, 0.04, M.brass(0xc8a050), [0, 0.1, 0], 8));
    const cryGrp = new THREE.Group(); const cm = tglow(c, 1.4, 0.7);
    const top = _cone(o.size, o.size * 2.2, cm, [0, o.size * 1.1, 0], 6); cryGrp.add(top);
    const bot = _cone(o.size, o.size * 1.4, cm, [0, -o.size * 0.7, 0], 6); bot.rotation.x = Math.PI; cryGrp.add(bot);
    const coreM = glow(c, 1.6); cryGrp.add(_sph(o.size * 0.4, coreM, [0, o.size * 0.2, 0], 8));
    cryGrp.position.y = o.height; g.add(cryGrp);
    // glow ring on the ground beneath
    const gring = _tor(o.size * 1.5, 0.015, tglow(c, 1.2, 0.5), [0, 0.12, 0], 5, 24); gring.rotation.x = Math.PI / 2; gring.userData._o0 = 0.5; g.add(gring);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; cryGrp.position.y = o.height + Math.sin(t * 1.2) * 0.06; cryGrp.rotation.y += dt * 0.6; coreM.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.5; cm.opacity = 0.55 + (Math.sin(t * 2) + 1) / 2 * 0.25; gring.material.opacity = 0.3 + (Math.sin(t * 2) + 1) / 2 * 0.3; };
    return g;
  }, { icon: "💎", category: "wizard artifacts", params: [
    { key: "color", label: "Crystal", type: "color", default: 0x6ad0ff },
    { key: "size", label: "Size", type: "number", min: 0.08, max: 0.4, step: 0.02, default: 0.16 },
    { key: "height", label: "Hover Height", type: "number", min: 0.4, max: 2, step: 0.1, default: 0.9 }] });

  register("orrery", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xc8a050)), wd = M.wood(0x3a2414);
    g.add(_cyl(0.18, 0.22, 0.5, wd, [0, 0.25, 0], 12));
    g.add(_sph(0.07, glow(0xffcc44, 1.4), [0, 0.6, 0], 12));
    const arms = new THREE.Group(); const planets = [];
    for (let i = 0; i < 4; i++) { const r = 0.15 + i * 0.1; const arm = new THREE.Group();
      const spoke = _cyl(0.006, 0.006, r, br, [r / 2, 0, 0], 4); spoke.rotation.z = Math.PI / 2; arm.add(spoke);
      const p = _sph(0.025 + i * 0.005, M.metal(pick([0x8a6a4a, 0x4a6a8a, 0xc89a5a, 0x6a8a6a])), [r, 0, 0], 8); arm.add(p);
      arm.position.y = 0.6; arms.add(arm); planets.push({ arm, sp: 0.8 - i * 0.15 }); }
    g.add(arms);
    const ring = _tor(0.4, 0.008, br, [0, 0.6, 0], 6, 32); ring.rotation.x = Math.PI / 2; g.add(ring);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; planets.forEach((pl) => { pl.arm.rotation.y += dt * pl.sp; }); };
    return g;
  }, { icon: "🪐", category: "wizard artifacts", params: [
    { key: "color", label: "Brass", type: "color", default: 0xc8a050 }] });

  register("celestial_sphere", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xc8a050));
    g.add(_cyl(0.16, 0.2, 0.05, br, [0, 0.025, 0], 16)); g.add(_cyl(0.03, 0.04, 0.4, br, [0, 0.23, 0], 8));
    const cy = 0.55, R = 0.22;
    g.add(_sph(0.06, glow(_c(o.glow, 0x6a8aff), 0.8), [0, cy, 0], 12));
    const r1 = _tor(R, 0.012, br, [0, cy, 0], 6, 30); r1.rotation.x = Math.PI / 2; g.add(r1);
    g.add(_tor(R, 0.012, br, [0, cy, 0], 6, 30));
    const r3 = _tor(R, 0.012, br, [0, cy, 0], 6, 30); r3.rotation.y = Math.PI / 2; g.add(r3);
    const r4 = _tor(R * 1.02, 0.02, br, [0, cy, 0], 6, 30); r4.rotation.x = Math.PI / 2.6; g.add(r4);
    return g;
  }, { icon: "✷", category: "wizard artifacts", params: [
    { key: "color", label: "Brass", type: "color", default: 0xc8a050 },
    { key: "glow", label: "Core", type: "color", default: 0x6a8aff }] });

  register("winged_orb", function (o) {
    const g = new THREE.Group(); const y = o.height; const gold = M.brass(_c(o.color, 0xd6b84a));
    g.add(_sph(0.06, gold, [0, y, 0], 12));
    g.add(_tor(0.06, 0.008, M.brass(0xa88838), [0, y, 0], 4, 16));
    const wing = new THREE.MeshStandardMaterial({ color: 0xf0ead8, emissive: 0xf0ead8, emissiveIntensity: 0.3, transparent: true, opacity: 0.7, roughness: 0.4 });
    for (const sx of [-1, 1]) { const w = _box(0.02, 0.1, 0.18, wing, [sx * 0.08, y + 0.02, 0]); w.rotation.z = sx * 0.6; w.rotation.y = sx * 0.4; g.add(w); }
    return g;
  }, { icon: "❦", category: "wizard artifacts", params: [
    { key: "color", label: "Gold", type: "color", default: 0xd6b84a },
    { key: "height", label: "Hover", type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.4 }] });

  register("specimen_jars", function (o) {
    const g = new THREE.Group(); const gl = M.glass(0xcfe0e8); const n = o.count; const cols = [0x6a9a4a, 0xd6c04a, 0xb55a3a, 0x4a8ad6, 0x8a4ad6];
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 0.18; const h = rand(0.18, 0.3);
      g.add(_cyl(0.06, 0.06, h, gl, [x, h / 2, 0], 10)); g.add(_cyl(0.05, 0.05, 0.04, M.cloth(0x3a2a1a), [x, h + 0.02, 0], 10)); g.add(_sph(0.04, glow(pick(cols), 0.4), [x, h * 0.4, 0], 10)); }
    return g;
  }, { icon: "⚇", category: "wizard artifacts", params: [
    { key: "count", label: "Jars", type: "int", min: 2, max: 7, step: 1, default: 4 }] });

  register("open_grimoire", function (o) {
    const g = new THREE.Group(); const y = o.height; const cover = M.book(_c(o.color, 0x3a1a4a));
    for (const sx of [-1, 1]) { const pg = _box(0.22, 0.01, 0.3, M.plaster(0xe8dcc0), [sx * 0.11, y, 0]); pg.rotation.z = sx * 0.12; g.add(pg);
      const cv = _box(0.24, 0.015, 0.32, cover, [sx * 0.115, y - 0.02, 0]); cv.rotation.z = sx * 0.12; g.add(cv); }
    g.add(_box(0.03, 0.04, 0.32, cover, [0, y, 0]));
    const gm = glow(_c(o.glow, 0x8a4ad6), 1.4);
    for (let i = 0; i < 5; i++) g.add(_box(0.03, 0.03, 0.03, gm, [rand(-0.1, 0.1), y + 0.1 + rand(0, 0.15), rand(-0.12, 0.12)]));
    return g;
  }, { icon: "📖", category: "wizard artifacts", params: [
    { key: "height", label: "Hover", type: "number", min: 0, max: 1.5, step: 0.1, default: 0.0 },
    { key: "color", label: "Cover", type: "color", default: 0x3a1a4a },
    { key: "glow", label: "Magic", type: "color", default: 0x8a4ad6 }] });

  register("oracle_skull", function (o) {
    const g = new THREE.Group(); const bn = M.bone(_c(o.color, 0xe8e0d0));
    g.add(_cyl(0.12, 0.15, 0.1, M.stone(0x4a463e), [0, 0.05, 0], 10));
    g.add(_sph(0.12, bn, [0, 0.22, 0], 14));
    g.add(_box(0.14, 0.06, 0.12, bn, [0, 0.13, 0.03]));
    for (const sx of [-1, 1]) g.add(_sph(0.03, glow(_c(o.eyes, 0x6ad6ff), 1.6), [sx * 0.05, 0.23, 0.1], 8));
    const nose = _cone(0.02, 0.05, M.stone(0x222018), [0, 0.18, 0.11], 4); nose.rotation.x = Math.PI / 2; g.add(nose);
    return g;
  }, { icon: "☠", category: "wizard artifacts", params: [
    { key: "color", label: "Bone", type: "color", default: 0xe8e0d0 },
    { key: "eyes", label: "Eyes", type: "color", default: 0x6ad6ff }] });

  register("brass_telescope", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xd6b84a)), wd = M.wood(0x3a2414);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; const leg = _cyl(0.02, 0.025, 1.0, wd, [Math.cos(a) * 0.22, 0.5, Math.sin(a) * 0.22], 5); leg.rotation.x = Math.sin(a) * 0.3; leg.rotation.z = -Math.cos(a) * 0.3; g.add(leg); }
    g.add(_sph(0.05, br, [0, 1.0, 0], 10));
    const tube = _cyl(0.06, 0.08, 0.7, br, [0.05, 1.15, 0], 12); tube.rotation.z = -0.5; g.add(tube);
    g.add(_cyl(0.03, 0.04, 0.12, br, [-0.16, 0.98, 0], 10));
    return g;
  }, { icon: "🔭", category: "wizard artifacts", params: [
    { key: "color", label: "Brass", type: "color", default: 0xd6b84a }] });

  register("crystal_geode", function (o) {
    const g = new THREE.Group(); const rock = M.stone(_c(o.color, 0x4a463e)); const cm = glow(_c(o.glow, 0x8a4ad6), 1.4);
    for (const sx of [-1, 1]) { const half = _sph(0.26, rock, [sx * 0.26, 0.24, 0], 14); half.scale.x = 0.55; g.add(half);
      for (let i = 0; i < 9; i++) { const yy = 0.24 + rand(-0.12, 0.12), zz = rand(-0.12, 0.12); const cone = _cone(rand(0.02, 0.05), rand(0.08, 0.16), cm, [sx * 0.12, yy, zz], 5); cone.rotation.z = -sx * Math.PI / 2; g.add(cone); } }
    return g;
  }, { icon: "◈", category: "wizard artifacts", params: [
    { key: "color", label: "Rock", type: "color", default: 0x4a463e },
    { key: "glow", label: "Crystal", type: "color", default: 0x8a4ad6 }] });

  register("potion_trolley", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)), m = M.metal(0x2a2520); const W = 0.7, D = 0.45;
    g.add(_box(W, 0.04, D, wd, [0, 0.7, 0])); g.add(_box(W, 0.04, D, wd, [0, 0.4, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_cyl(0.02, 0.02, 0.6, m, [sx * (W / 2 - 0.04), 0.4, sz * (D / 2 - 0.04)], 6));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const wl = _cyl(0.06, 0.06, 0.03, m, [sx * (W / 2 - 0.04), 0.08, sz * (D / 2 - 0.04)], 12); wl.rotation.x = Math.PI / 2; g.add(wl); }
    const cols = [0x4ad6a0, 0xd64a6a, 0x4a8ad6, 0xd6c04a, 0x8a4ad6];
    for (const sy of [0.74, 0.44]) for (let i = 0; i < 4; i++) { const x = -W / 2 + 0.12 + i * 0.16; const h = rand(0.1, 0.18); g.add(_cyl(0.04, 0.05, h, M.glass(pick(cols)), [x, sy + h / 2, rand(-0.1, 0.1)], 8)); }
    return g;
  }, { icon: "🛒", category: "wizard artifacts", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("inkwell", function (o) {
    const g = new THREE.Group();
    g.add(_cyl(0.05, 0.07, 0.08, M.glass(0x1a1a22), [0, 0.04, 0], 12));
    g.add(_cyl(0.06, 0.06, 0.02, M.metal(0x2a2520), [0, 0.085, 0], 12));
    g.add(_sph(0.04, glow(_c(o.ink, 0x2a2a5a), 0.4), [0, 0.05, 0], 8));
    const shaft = _cyl(0.006, 0.01, 0.3, M.bone(0xf0e8d0), [0.02, 0.2, 0], 6); shaft.rotation.z = -0.3; g.add(shaft);
    const vane = _cone(0.04, 0.22, M.cloth(_c(o.color, 0x6a2a4a)), [0.08, 0.3, 0], 4); vane.rotation.z = -0.3; vane.scale.z = 0.3; g.add(vane);
    return g;
  }, { icon: "🖋", category: "wizard artifacts", params: [
    { key: "color", label: "Feather", type: "color", default: 0x6a2a4a },
    { key: "ink", label: "Ink", type: "color", default: 0x2a2a5a }] });

  register("quill_pot", function (o) {
    const g = new THREE.Group(); const pot = M.ceramic(_c(o.color, 0x4a5a6a)); const cols = [0x6a2a4a, 0x2a4a6a, 0x4a6a2a, 0x6a5a2a, 0x3a2a5a];
    g.add(_cyl(0.07, 0.06, 0.14, pot, [0, 0.07, 0], 12));
    for (let i = 0; i < 5; i++) { const a = i * 1.3, lean = 0.2 + rand(0, 0.15);
      const shaft = _cyl(0.005, 0.008, 0.32, M.bone(0xf0e8d0), [Math.cos(a) * 0.03, 0.2, Math.sin(a) * 0.03], 6); shaft.rotation.z = Math.cos(a) * lean; shaft.rotation.x = Math.sin(a) * lean; g.add(shaft);
      const vane = _cone(0.03, 0.18, M.cloth(pick(cols)), [Math.cos(a) * 0.08, 0.32, Math.sin(a) * 0.08], 4); vane.rotation.z = Math.cos(a) * lean; vane.rotation.x = Math.sin(a) * lean; vane.scale.z = 0.3; g.add(vane); }
    return g;
  }, { icon: "🪶", category: "wizard artifacts", params: [
    { key: "color", label: "Pot", type: "color", default: 0x4a5a6a }] });

  register("stacked_books", function (o) {
    const g = new THREE.Group(); const cols = [0x6a1a2a, 0x1a3a6a, 0x2a5a2a, 0x5a4a1a, 0x3a1a5a, 0x6a4a1a]; let y = 0;
    for (let i = 0; i < o.count; i++) { const w = rand(0.18, 0.26), d = rand(0.14, 0.2), h = rand(0.035, 0.06);
      const b = _box(w, h, d, M.book(pick(cols)), [rand(-0.03, 0.03), y + h / 2, rand(-0.03, 0.03)]); b.rotation.y = rand(-0.25, 0.25); g.add(b); y += h + 0.002; }
    return g;
  }, { icon: "📚", category: "wizard artifacts", params: [
    { key: "count", label: "Books", type: "int", min: 2, max: 10, step: 1, default: 5 }] });

  register("parchment_stack", function (o) {
    const g = new THREE.Group(); const par = M.plaster(_c(o.color, 0xe8dcc0));
    for (let i = 0; i < 4; i++) { const s = _box(0.26, 0.006, 0.34, par, [rand(-0.02, 0.02), 0.003 + i * 0.007, rand(-0.02, 0.02)]); s.rotation.y = rand(-0.15, 0.15); g.add(s); }
    for (let i = 0; i < 2; i++) { const sc = _cyl(0.025, 0.025, 0.3, par, [0.05 - i * 0.1, 0.05, 0.05], 8); sc.rotation.x = Math.PI / 2; sc.rotation.y = rand(-0.2, 0.2); g.add(sc); }
    return g;
  }, { icon: "📜", category: "wizard artifacts", params: [
    { key: "color", label: "Paper", type: "color", default: 0xe8dcc0 }] });

  register("counting_frame", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3a1a)); const W = 0.4, H = 0.3;
    g.add(_box(W + 0.06, 0.04, 0.05, wd, [0, H, 0])); g.add(_box(W + 0.06, 0.04, 0.05, wd, [0, 0.02, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.04, H, 0.05, wd, [sx * (W / 2 + 0.02), H / 2, 0]));
    const cols = [0xd64a4a, 0x4a8ad6, 0x4ad68a, 0xd6c04a, 0x8a4ad6];
    for (let r = 0; r < 5; r++) { const y = 0.06 + r * ((H - 0.08) / 4);
      const rod = _cyl(0.006, 0.006, W, M.metal(0x888888), [0, y, 0], 4); rod.rotation.z = Math.PI / 2; g.add(rod);
      const bm = M.ceramic(cols[r % cols.length]);
      for (let i = 0; i < 7; i++) g.add(_sph(0.022, bm, [-W / 2 + 0.04 + i * ((W - 0.08) / 6), y, 0], 8)); }
    return g;
  }, { icon: "🧮", category: "wizard artifacts", params: [
    { key: "color", label: "Frame", type: "color", default: 0x5a3a1a }] });

  // ════════════════════════════════════════════════════════════
  //  OWLS & ANIMALS
  // ════════════════════════════════════════════════════════════

  register("feather", function (o) {
    const g = new THREE.Group(); const c = M.cloth(_c(o.color, 0xf0ece0)); const y = o.height;
    const shaft = _cyl(0.006, 0.012, 0.5, M.bone(0xe8e0d0), [0, y, 0], 6); shaft.rotation.z = Math.PI / 2; g.add(shaft);
    const vane = _sph(0.18, c, [0, y + 0.02, 0], 12); vane.scale.set(1.4, 0.9, 0.06); g.add(vane);
    const tip = _sph(0.08, c, [-0.22, y + 0.02, 0], 10); tip.scale.set(1.4, 0.7, 0.06); g.add(tip);
    return g;
  }, { icon: "🪶", category: "wizard artifacts", params: [
    { key: "height", label: "Height", type: "number", min: 0, max: 1.5, step: 0.05, default: 0.05 },
    { key: "color", label: "Feather", type: "color", default: 0xf0ece0 }] });

  register("ink_bottle", function (o) {
    const g = new THREE.Group(); const gl = M.glass(0x223344);
    g.add(_box(0.1, 0.13, 0.1, gl, [0, 0.065, 0]));
    g.add(_sph(0.05, glow(_c(o.ink, 0x2a2a5a), 0.4), [0, 0.06, 0], 8));
    g.add(_cyl(0.025, 0.03, 0.05, M.cloth(0x2a1a10), [0, 0.155, 0], 10));
    g.add(_cyl(0.03, 0.03, 0.015, M.wax(0x8a2a2a), [0, 0.18, 0], 10));
    g.add(_box(0.06, 0.06, 0.005, M.plaster(0xe8dcc0), [0, 0.06, 0.051]));
    return g;
  }, { icon: "🫙", category: "wizard artifacts", params: [
    { key: "ink", label: "Ink", type: "color", default: 0x2a2a5a }] });

  // ════════════════════════════════════════════════════════════
  //  SURFACES — walls, floors, glass (geometry "texture" panels)
  // ════════════════════════════════════════════════════════════

  register("potion_flask", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x4ad6a0);
    g.add(_sph(0.07, M.glass(0xcfe0e8), [0, 0.07, 0], 12));
    g.add(_cyl(0.025, 0.035, 0.1, M.glass(0xcfe0e8), [0, 0.17, 0], 8));
    g.add(_sph(0.05, glow(c, 0.7), [0, 0.06, 0], 10));
    g.add(_cyl(0.02, 0.025, 0.03, M.cloth(0x3a2a1a), [0, 0.23, 0], 8));
    g.add(_sph(0.015, glow(c, 1.0), [0, 0.14, 0], 6));
    return g;
  }, { icon: "🧪", category: "wizard artifacts", params: [
    { key: "color", label: "Potion", type: "color", default: 0x4ad6a0 }] });

  register("single_scroll", function (o) {
    const g = new THREE.Group(); const par = M.plaster(_c(o.color, 0xe8dcc0));
    g.add(_box(0.3, 0.01, 0.22, par, [0, 0.015, 0]));
    const roll = _cyl(0.04, 0.04, 0.24, par, [-0.15, 0.04, 0], 10); roll.rotation.x = Math.PI / 2; g.add(roll);
    for (let i = 0; i < 3; i++) g.add(_box(0.18, 0.012, 0.012, M.cloth(0x4a3a2a), [0.02, 0.022, -0.06 + i * 0.06]));
    g.add(_cyl(0.025, 0.025, 0.012, M.wax(0x8a2a2a), [0.1, 0.025, 0.07], 10));
    return g;
  }, { icon: "📃", category: "wizard artifacts", params: [
    { key: "color", label: "Paper", type: "color", default: 0xe8dcc0 }] });

  // ════════════════════════════════════════════════════════════
  //  LIGHTING & DECOR
  // ════════════════════════════════════════════════════════════

  register("enchanted_snow_globe", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x3a2414), gl = M.glass(0xdfeef5);
    g.add(_cyl(0.13, 0.16, 0.08, wd, [0, 0.04, 0], 14));
    g.add(_sph(0.14, gl, [0, 0.2, 0], 16));
    g.add(_cone(0.05, 0.16, M.plaster(0xe8e0d0), [0, 0.16, 0], 8)); // tiny tower inside
    g.add(_box(0.1, 0.04, 0.1, M.stone(0x6a6358), [0, 0.1, 0]));
    const flakes = new THREE.Group(); const fk = [];
    for (let i = 0; i < 16; i++) { const f = _sph(0.006, glow(0xffffff, 0.6), [rand(-0.1, 0.1), rand(0.1, 0.3), rand(-0.1, 0.1)], 5); flakes.add(f); fk.push({ m: f, sp: rand(0.02, 0.05) }); }
    g.add(flakes); let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; fk.forEach((f) => { f.m.position.y -= f.sp * dt * 6; f.m.position.x += Math.sin(t * 2 + f.m.position.y * 10) * dt * 0.02; if (f.m.position.y < 0.1) f.m.position.y = 0.3; }); };
    return g;
  }, { icon: "🔮", category: "wizard artifacts", params: [
    { key: "color", label: "Glass", type: "color", default: 0xdfeef5 }] });

  register("mini_sun_orb", function (o) {
    const g = new THREE.Group(); const m = M.metal(0x3a342c);
    g.add(_cyl(0.1, 0.13, 0.04, m, [0, 0.02, 0], 12));
    g.add(_cyl(0.012, 0.012, 0.6, m, [0, 0.3, 0], 6));
    const sun = new THREE.Group(); const core = glow(_c(o.color, 0xffaa22), 1.8);
    sun.add(_sph(0.12, core, [0, 0, 0], 14));
    const rays = new THREE.Group();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const r = _cone(0.02, 0.1, glow(0xffd24a, 1.4), [Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18], 4); r.rotation.z = -a + Math.PI / 2; r.rotation.x = Math.PI / 2; rays.add(r); }
    sun.add(rays); sun.position.set(0, 0.66, 0); g.add(sun);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; rays.rotation.y += dt * 0.6; core.emissiveIntensity = 1.8 + Math.sin(t * 3) * 0.3; sun.scale.setScalar(1 + Math.sin(t * 2) * 0.03); };
    return g;
  }, { icon: "☀", category: "wizard artifacts", params: [
    { key: "color", label: "Sun", type: "color", default: 0xffaa22 }] });

  // ════════════════════════════════════════════════════════════
  //  GHOSTS  (animated, translucent)
  // ════════════════════════════════════════════════════════════

  register("swirling_pensieve", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.basin, 0x6a6358)), runes = glow(0xbfe0ff, 0.6);
    g.add(_cyl(0.14, 0.18, 0.5, st, [0, 0.25, 0], 16));          // pedestal
    g.add(_cyl(0.42, 0.34, 0.16, st, [0, 0.56, 0], 24));         // basin bowl
    g.add(_cyl(0.4, 0.4, 0.02, st, [0, 0.5, 0], 24));            // bowl floor
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const r = _box(0.03, 0.08, 0.01, runes, [Math.cos(a) * 0.39, 0.58, Math.sin(a) * 0.39]); r.rotation.y = -a; g.add(r); }
    const memory = new THREE.Group(); const surf = tglow(_c(o.color, 0xcfe8ff), 0.9, 0.7);
    for (let ring = 0; ring < 3; ring++) { const m = _cyl(0.36 - ring * 0.1, 0.36 - ring * 0.1, 0.012, surf, [0, ring * 0.008, 0], 28); memory.add(m); }
    memory.position.y = 0.6; g.add(memory);
    const wisps = []; for (let i = 0; i < 6; i++) { const w = _sph(rand(0.02, 0.04), tglow(0xeaf6ff, 1.0, 0.55), [0, 0.62, 0], 6); g.add(w); wisps.push({ m: w, a: rand(0, 6.28), r: rand(0.1, 0.32), sp: rand(0.6, 1.4) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; memory.children.forEach((m, i) => { m.rotation.y += dt * (0.6 + i * 0.4) * (i % 2 ? 1 : -1); }); memory.children[0].material.emissiveIntensity = 0.7 + Math.sin(t * 1.5) * 0.3; wisps.forEach((w) => { w.a += dt * w.sp; w.m.position.set(Math.cos(w.a) * w.r, 0.62 + Math.sin(t * 2 + w.a) * 0.03, Math.sin(w.a) * w.r); }); };
    return g;
  }, { icon: "🪄", category: "wizard artifacts", params: [
    { key: "color", label: "Memory", type: "color", default: 0xcfe8ff },
    { key: "basin", label: "Basin", type: "color", default: 0x6a6358 }] });

  register("celestial_orrery", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xc8a050));
    g.add(_cyl(0.2, 0.24, 0.1, M.wood(0x3a2414), [0, 0.05, 0], 16));
    g.add(_cyl(0.03, 0.03, 0.4, br, [0, 0.3, 0], 8));
    const sun = glow(0xffaa22, 1.6); g.add(_sph(0.08, sun, [0, 0.52, 0], 12));
    const arms = new THREE.Group(); arms.position.set(0, 0.52, 0);
    const planets = [];
    const defs = [[0.18, 0xb0703a, 0.018, 1.6], [0.28, 0x4a90c0, 0.026, 1.1], [0.4, 0xc04a3a, 0.022, 0.7], [0.52, 0xd8b060, 0.04, 0.45]];
    defs.forEach((d, i) => { const orbit = new THREE.Group(); const arm = _cyl(0.004, 0.004, d[0], br, [d[0] / 2, 0, 0], 4); arm.rotation.z = Math.PI / 2; orbit.add(arm);
      const ring = _tor(d[0], 0.003, M.brass(0xa88838), [0, 0, 0], 4, 36); ring.rotation.x = Math.PI / 2; g.add(ring); ring.position.y = 0.52;
      const p = _sph(d[2], M.ceramic(d[1]), [d[0], 0, 0], 10); orbit.add(p); orbit.rotation.y = rand(0, 6.28); arms.add(orbit); planets.push({ o: orbit, sp: d[3] }); });
    g.add(arms);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; sun.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.25; planets.forEach((p) => p.o.rotation.y += dt * p.sp); };
    return g;
  }, { icon: "🪐", category: "wizard artifacts", params: [
    { key: "color", label: "Brass", type: "color", default: 0xc8a050 }] });

  register("spinning_sneakoscope", function (o) {
    const g = new THREE.Group(); const gl = M.glass(0xcfe3d8), br = M.brass(0xc8a050);
    g.add(_cyl(0.06, 0.09, 0.05, br, [0, 0.025, 0], 12));         // base
    const top = new THREE.Group();
    const core = glow(_c(o.color, 0x4ad0a0), 0.7);
    top.add(_sph(0.07, gl, [0, 0, 0], 14));
    top.add(_sph(0.045, core, [0, 0, 0], 10));
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const fin = _box(0.01, 0.04, 0.06, br, [Math.cos(a) * 0.07, 0, Math.sin(a) * 0.07]); fin.rotation.y = -a; top.add(fin); }
    top.add(_cone(0.02, 0.05, br, [0, -0.08, 0], 6));             // spinning tip
    top.position.set(0, 0.13, 0); g.add(top);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const agitate = (Math.sin(t * 0.3) + 1) / 2; top.rotation.y += dt * (3 + agitate * 14); top.rotation.z = Math.sin(t * 8) * agitate * 0.15; core.emissiveIntensity = 0.5 + agitate * 1.2; };
    return g;
  }, { icon: "🌀", category: "wizard artifacts", params: [
    { key: "color", label: "Glow", type: "color", default: 0x4ad0a0 }] });

  register("glowing_remembrall", function (o) {
    const g = new THREE.Group(); const br = M.brass(0xc8a050), gl = M.glass(0xeae0d0);
    g.add(_cyl(0.05, 0.07, 0.04, br, [0, 0.02, 0], 12));
    g.add(_tor(0.04, 0.01, br, [0, 0.05, 0], 6, 14));
    g.add(_sph(0.09, gl, [0, 0.14, 0], 16));
    const smoke = glow(_c(o.color, 0xffffff), 0.5);
    g.add(_sph(0.06, smoke, [0, 0.14, 0], 12));
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const fog = (Math.sin(t * 0.5) + 1) / 2; smoke.color.setRGB(0.4 + fog * 0.6, 0.5 - fog * 0.4, 0.5 - fog * 0.4); smoke.emissive.copy(smoke.color); smoke.emissiveIntensity = 0.3 + fog * 0.9; };
    return g;
  }, { icon: "🔴", category: "wizard artifacts", params: [
    { key: "color", label: "Base Hue", type: "color", default: 0xffffff }] });

  register("page_flipping_book", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x4a3018), pap = M.plaster(0xf0e8d8), cv = M.leather(_c(o.color, 0x5a2a2a));
    const stand = _box(0.5, 0.04, 0.4, wd, [0, 0.9, 0]); stand.rotation.x = -0.4; g.add(stand);
    g.add(_cyl(0.04, 0.05, 0.9, wd, [0, 0.45, 0], 6));
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const leg = _cyl(0.012, 0.012, 0.3, wd, [Math.cos(a) * 0.1, 0.15, Math.sin(a) * 0.1], 5); leg.rotation.x = Math.sin(a) * 0.4; leg.rotation.z = -Math.cos(a) * 0.4; g.add(leg); }
    const book = new THREE.Group(); book.rotation.x = -0.4; book.position.set(0, 0.92, 0.02);
    book.add(_box(0.46, 0.03, 0.34, cv, [0, -0.02, 0]));          // cover
    book.add(_box(0.21, 0.02, 0.32, pap, [-0.11, 0, 0])); book.add(_box(0.21, 0.02, 0.32, pap, [0.11, 0, 0])); // two page-blocks
    const flip = new THREE.Group(); const page = _box(0.21, 0.004, 0.32, pap, [0.105, 0, 0]); flip.add(page); flip.position.set(0, 0.012, 0); book.add(flip);
    g.add(book);
    let t = rand(0, 6), phase = 0;
    g.userData.tick = (dt) => { t += dt; phase += dt * 0.7; const p = phase % (Math.PI * 2); if (p < Math.PI) flip.rotation.z = -p; else flip.rotation.z = 0; };
    return g;
  }, { icon: "📖", category: "wizard artifacts", params: [
    { key: "color", label: "Cover", type: "color", default: 0x5a2a2a }] });

  register("misty_crystal_orb", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x3a2414), gl = M.glass(0xdfeef8);
    g.add(_cyl(0.16, 0.2, 0.08, wd, [0, 0.04, 0], 16));
    g.add(_tor(0.13, 0.02, M.brass(0xc8a050), [0, 0.09, 0], 8, 20));
    g.add(_sph(0.18, gl, [0, 0.28, 0], 18));
    const mist = new THREE.Group();
    for (let i = 0; i < 3; i++) { const m = _sph(0.13 - i * 0.03, tglow(_c(o.color, 0xc8b0e8), 0.6, 0.4), [0, 0, 0], 12); mist.add(m); }
    mist.position.set(0, 0.28, 0); g.add(mist);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; mist.children.forEach((m, i) => { m.rotation.y += dt * (0.5 + i * 0.6) * (i % 2 ? -1 : 1); m.rotation.x += dt * 0.3 * (i % 2 ? 1 : -1); m.material.emissiveIntensity = 0.4 + Math.sin(t * 1.5 + i) * 0.25; }); };
    return g;
  }, { icon: "🔮", category: "wizard artifacts", params: [
    { key: "color", label: "Mist", type: "color", default: 0xc8b0e8 }] });

  register("falling_sand_glass", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), gl = M.glass(0xeae0c8), sand = glow(0xe8c878, 0.3);
    g.add(_cyl(0.18, 0.2, 0.04, wd, [0, 0.02, 0], 14)); g.add(_cyl(0.18, 0.2, 0.04, wd, [0, 0.66, 0], 14));
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; g.add(_cyl(0.015, 0.015, 0.66, wd, [Math.cos(a) * 0.16, 0.34, Math.sin(a) * 0.16], 5)); }
    const upper = _cone(0.15, 0.28, gl, [0, 0.46, 0], 14); g.add(upper);
    const lower = _cone(0.15, 0.28, gl, [0, 0.2, 0], 14); lower.rotation.x = Math.PI; g.add(lower);
    const topSand = _cone(0.13, 0.2, sand, [0, 0.45, 0], 12); g.add(topSand);
    const botSand = _cone(0.13, 0.05, sand, [0, 0.11, 0], 12); botSand.rotation.x = Math.PI; g.add(botSand);
    const stream = _cyl(0.006, 0.006, 0.2, sand, [0, 0.33, 0], 5); g.add(stream);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const p = (t * 0.1) % 1; topSand.scale.y = 1 - p; topSand.position.y = 0.45 - (1 - (1 - p)) * 0.0; botSand.scale.y = 0.25 + p * 3; stream.material.emissiveIntensity = 0.3 + Math.sin(t * 20) * 0.1; if (p > 0.98) { /* loops naturally */ } };
    return g;
  }, { icon: "⏳", category: "wizard artifacts", params: [
    { key: "color", label: "Frame", type: "color", default: 0x4a3018 }] });

  register("levitating_feather", function (o) {
    const g = new THREE.Group(); const bk = M.leather(0x4a2a1a);
    g.add(_box(0.3, 0.05, 0.22, bk, [0, 0.025, 0]));             // closed book beneath
    g.add(_box(0.28, 0.03, 0.2, M.plaster(0xeee4d0), [0, 0.05, 0]));
    const feather = new THREE.Group();
    const quill = M.fabric(_c(o.color, 0xf0f0f0));
    feather.add(_cyl(0.004, 0.006, 0.34, M.bone(0xe8dcc0), [0, 0, 0], 5)); // shaft
    for (let i = 0; i < 14; i++) { const y = -0.12 + i * 0.018; const len = 0.06 * Math.sin((i / 14) * Math.PI) + 0.02; const bl = _box(len, 0.002, 0.012, quill, [-len / 2, y, 0]); bl.rotation.z = 0.5; feather.add(bl); const br = _box(len, 0.002, 0.012, quill, [len / 2, y, 0]); br.rotation.z = -0.5; feather.add(br); }
    feather.position.set(0, o.height, 0); g.add(feather);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; feather.position.y = o.height + Math.sin(t * 1.3) * 0.06; feather.rotation.y += dt * 0.6; feather.rotation.z = Math.sin(t * 0.9) * 0.2; };
    return g;
  }, { icon: "🪶", category: "wizard artifacts", params: [
    { key: "height", label: "Hover Height", type: "number", min: 0.2, max: 1.2, step: 0.1, default: 0.4 },
    { key: "color", label: "Feather", type: "color", default: 0xf0f0f0 }] });

  register("self_writing_scroll", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x4a3018), pap = M.plaster(_c(o.color, 0xeee2c8));
    g.add(_box(0.7, 0.04, 0.4, wd, [0, 0.78, 0]));
    for (const [x, z] of [[-0.3, 0.16], [0.3, 0.16], [-0.3, -0.16], [0.3, -0.16]]) g.add(_cyl(0.025, 0.025, 0.78, wd, [x, 0.39, z], 6));
    g.add(_box(0.5, 0.01, 0.3, pap, [0, 0.81, 0]));              // unrolled scroll
    g.add(_cyl(0.025, 0.025, 0.32, pap, [-0.26, 0.81, 0], 8)).rotation && (g.children[g.children.length - 1].rotation.x = Math.PI / 2);
    const rollR = _cyl(0.025, 0.025, 0.32, pap, [0.26, 0.81, 0], 8); rollR.rotation.x = Math.PI / 2; g.add(rollR);
    // ink lines appearing (we just animate quill; lines are static marks)
    for (let i = 0; i < 3; i++) g.add(_box(0.3, 0.002, 0.004, M.metal(0x1a1410), [-0.05, 0.816, -0.08 + i * 0.06]));
    const quill = new THREE.Group();
    quill.add(_cyl(0.003, 0.005, 0.24, M.bone(0xe8dcc0), [0, 0.12, 0], 5));
    for (let i = 0; i < 8; i++) { const len = 0.04 * Math.sin(i / 8 * Math.PI) + 0.01; const bl = _box(len, 0.0015, 0.01, M.fabric(0xf0f0f0), [-len / 2, 0.06 + i * 0.012, 0]); bl.rotation.z = 0.5; quill.add(bl); }
    quill.position.set(0, 0.82, 0); quill.rotation.z = 0.3; g.add(quill);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; quill.position.x = Math.sin(t * 3) * 0.18; quill.position.z = Math.sin(t * 0.7) * 0.08; quill.position.y = 0.82 + Math.abs(Math.sin(t * 3)) * 0.01; };
    return g;
  }, { icon: "📜", category: "wizard artifacts", params: [
    { key: "color", label: "Parchment", type: "color", default: 0xeee2c8 }] });

  register("house_points_glass", function (o) {
    const g = new THREE.Group(); const fr = M.brass(0xc8a050), gl = M.glass(0xeae0d0);
    g.add(_box(0.3, 0.04, 0.3, M.stone(0x4a4338), [0, 0.02, 0]));
    g.add(_cyl(0.08, 0.1, 1.2, gl, [0, 0.64, 0], 16));           // tall tube
    g.add(_cyl(0.1, 0.12, 0.06, fr, [0, 0.06, 0], 16)); g.add(_cyl(0.1, 0.12, 0.06, fr, [0, 1.22, 0], 16));
    const gems = glow(_c(o.color, 0xd23a4a), 0.5);
    const fill = _cyl(0.075, 0.075, o.level, gems, [0, 0.08 + o.level / 2, 0], 16); g.add(fill);
    // a few loose gems at the meniscus
    for (let i = 0; i < 6; i++) g.add(_sph(rand(0.015, 0.025), gems, [rand(-0.05, 0.05), 0.08 + o.level + rand(0, 0.04), rand(-0.05, 0.05)], 6));
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; gems.emissiveIntensity = 0.4 + Math.sin(t * 1.5) * 0.25; };
    return g;
  }, { icon: "💎", category: "wizard artifacts", params: [
    { key: "level", label: "Fill Level", type: "number", min: 0.1, max: 1.1, step: 0.05, default: 0.6 },
    { key: "color", label: "House Gem", type: "color", default: 0xd23a4a }] });

  register("dark_detector_top", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xc8a050)), gl = M.glass(0xddeeff);
    g.add(_cyl(0.12, 0.16, 0.06, br, [0, 0.03, 0], 14));
    g.add(_cyl(0.02, 0.02, 0.1, br, [0, 0.1, 0], 8));
    const top = new THREE.Group();
    top.add(_cone(0.12, 0.1, br, [0, 0.06, 0], 12));
    top.add(_cone(0.12, 0.16, br, [0, -0.02, 0], 12)); top.children[1].rotation.x = Math.PI;
    top.add(_sph(0.05, gl, [0, 0.04, 0], 10));
    const core = glow(_c(o.glow, 0x6affc0), 0.6); top.add(_sph(0.03, core, [0, 0.04, 0], 8));
    top.position.set(0, 0.2, 0); g.add(top);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const wob = (Math.sin(t * 0.4) + 1) / 2; top.rotation.y += dt * (2 + wob * 10); top.rotation.x = Math.sin(t * 6) * wob * 0.2; core.emissiveIntensity = 0.5 + wob; };
    return g;
  }, { icon: "🎲", category: "wizard artifacts", params: [
    { key: "color", label: "Brass", type: "color", default: 0xc8a050 },
    { key: "glow", label: "Core", type: "color", default: 0x6affc0 }] });

  register("hovering_spellbook_stack", function (o) {
    const g = new THREE.Group();
    const books = []; const cols = [0x5a2a1a, 0x2a4a3a, 0x3a2a5a, 0x5a4a1a, 0x1a3a4a];
    for (let i = 0; i < o.count; i++) { const bk = new THREE.Group(); const w = rand(0.22, 0.3), d = rand(0.16, 0.22);
      bk.add(_box(w, 0.05, d, M.leather(cols[i % cols.length]), [0, 0, 0]));
      bk.add(_box(w - 0.02, 0.03, d - 0.02, M.plaster(0xeee4d0), [0, 0, 0]));
      bk.position.set(rand(-0.04, 0.04), o.height + i * 0.12, rand(-0.04, 0.04)); g.add(bk); books.push({ b: bk, ph: rand(0, 6), baseY: o.height + i * 0.12 }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; books.forEach((bk) => { bk.b.position.y = bk.baseY + Math.sin(t * 1.0 + bk.ph) * 0.04; bk.b.rotation.y += dt * 0.3; }); };
    return g;
  }, { icon: "📕", category: "wizard artifacts", params: [
    { key: "count", label: "Books", type: "int", min: 2, max: 6, default: 3 },
    { key: "height", label: "Hover Height", type: "number", min: 0.4, max: 2, step: 0.1, default: 1.0 }] });

  // ════════════════════════════════════════════════════════════
  //  DUNGEON / DARK
  // ════════════════════════════════════════════════════════════

  register("floating_book_stack", function (o) {
    const g = new THREE.Group();
    const books = []; const cols = [_c(o.color, 0x6a2a1a), 0x2a4a6a, 0x3a5a2a, 0x5a3a6a, 0x6a5a1a];
    for (let i = 0; i < o.count; i++) { const b = _box(rand(0.18, 0.26), 0.05, rand(0.14, 0.2), M.book(pick(cols)), [rand(-0.05, 0.05), 0, rand(-0.05, 0.05)]); b.rotation.y = rand(-0.4, 0.4); b.position.y = o.height + i * 0.09; g.add(b); books.push({ b, base: b.position.y, ph: i * 0.8 }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; books.forEach((bk, i) => { bk.b.position.y = bk.base + Math.sin(t * 1.2 + bk.ph) * 0.03; bk.b.rotation.y += dt * 0.2 * (i % 2 ? 1 : -1); }); };
    return g;
  }, { icon: "📚", category: "wizard artifacts", params: [
    { key: "count", label: "Books", type: "int", min: 2, max: 8, default: 4 },
    { key: "height", label: "Float Height", type: "number", min: 0.5, max: 2, step: 0.1, default: 1.1 },
    { key: "color", label: "Base Book", type: "color", default: 0x6a2a1a }] });

  register("quill_and_inkwell", function (o) {
    const g = new THREE.Group(); const ink = M.glass(0x2a2a3a), br = M.brass(0xc8a050);
    g.add(_cyl(0.06, 0.08, 0.1, ink, [0, 0.05, 0], 12));
    g.add(_cyl(0.05, 0.06, 0.02, br, [0, 0.1, 0], 12));
    const quill = _cone(0.012, 0.34, M.fabric(_c(o.color, 0xe8e0d0)), [0.03, 0.28, 0], 6); quill.rotation.z = -0.4; g.add(quill);
    const nib = _cyl(0.004, 0.006, 0.12, M.bone(0xeee0c0), [0.0, 0.16, 0], 5); nib.rotation.z = -0.4; g.add(nib);
    return g;
  }, { icon: "🪶", category: "wizard artifacts", params: [
    { key: "color", label: "Feather", type: "color", default: 0xe8e0d0 }] });

  register("levitating_teacup", function (o) {
    const g = new THREE.Group(); const c = M.ceramic(_c(o.color, 0xe8dcc8));
    const set = new THREE.Group();
    set.add(_cyl(0.1, 0.11, 0.012, c, [0, 0, 0], 14));
    set.add(_cyl(0.06, 0.045, 0.07, c, [0, 0.05, 0], 12));
    set.add(_tor(0.03, 0.008, c, [0.08, 0.05, 0], 6, 12));
    set.add(_cyl(0.052, 0.052, 0.005, tglow(0x6a3a1a, 0.3, 0.9), [0, 0.082, 0], 12));
    set.position.y = o.height; g.add(set);
    const steam = []; for (let i = 0; i < 3; i++) { const s = _sph(0.012, tglow(0xffffff, 0.3, 0.4), [rand(-0.02, 0.02), 0, 0], 5); set.add(s); steam.push({ m: s, ph: rand(0, 6) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; set.position.y = o.height + Math.sin(t * 1.5) * 0.04; set.rotation.y += dt * 0.4; steam.forEach((s) => { s.m.position.y = 0.1 + ((t * 0.15 + s.ph) % 0.2); s.m.material.opacity = 0.4 * (1 - (s.m.position.y - 0.1) / 0.2); }); };
    return g;
  }, { icon: "🍵", category: "wizard artifacts", params: [
    { key: "height", label: "Float Height", type: "number", min: 0.4, max: 1.6, step: 0.1, default: 0.9 },
    { key: "color", label: "China", type: "color", default: 0xe8dcc8 }] });

  register("crystal_decanter", function (o) {
    const g = new THREE.Group(); const gl = M.glass(_c(o.color, 0xbfd8e0)), liq = tglow(_c(o.liquid, 0x8a3a5a), 0.4, 0.6);
    g.add(_cyl(0.1, 0.13, 0.18, gl, [0, 0.09, 0], 12));
    g.add(_cyl(0.1, 0.12, 0.1, liq, [0, 0.06, 0], 12));
    g.add(_cyl(0.05, 0.08, 0.1, gl, [0, 0.23, 0], 10));
    g.add(_sph(0.05, gl, [0, 0.32, 0], 10));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const facet = _box(0.01, 0.16, 0.02, gl, [Math.cos(a) * 0.11, 0.09, Math.sin(a) * 0.11]); facet.rotation.y = -a; g.add(facet); }
    return g;
  }, { icon: "🍷", category: "wizard artifacts", params: [
    { key: "color", label: "Crystal", type: "color", default: 0xbfd8e0 },
    { key: "liquid", label: "Liquid", type: "color", default: 0x8a3a5a }] });

  register("soul_gem_stand", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x3a2414), c = _c(o.color, 0x9a4aff);
    g.add(_cyl(0.14, 0.18, 0.06, wd, [0, 0.03, 0], 10));
    g.add(_cyl(0.04, 0.06, 0.3, wd, [0, 0.2, 0], 8));
    g.add(_cyl(0.1, 0.08, 0.05, M.brass(0xc8a050), [0, 0.37, 0], 8));
    const gem = new THREE.Group(); const gm = glow(c, 1.6);
    const top = _cone(0.08, 0.16, gm, [0, 0.06, 0], 6); gem.add(top);
    const bot = _cone(0.08, 0.12, gm, [0, -0.04, 0], 6); bot.rotation.x = Math.PI; gem.add(bot);
    gem.position.y = 0.5; g.add(gem);
    const wisps = []; for (let i = 0; i < 4; i++) { const w = _sph(0.02, tglow(c, 1.4, 0.6), [0, 0.5, 0], 6); g.add(w); wisps.push({ m: w, a: rand(0, 6.28), ph: rand(0, 6) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; gem.rotation.y += dt * 0.8; gm.emissiveIntensity = 1.3 + Math.sin(t * 3) * 0.5; wisps.forEach((w) => { w.a += dt * 1.5; const r = 0.12 + Math.sin(t + w.ph) * 0.03; w.m.position.set(Math.cos(w.a) * r, 0.5 + Math.sin(t * 2 + w.ph) * 0.08, Math.sin(w.a) * r); }); };
    return g;
  }, { icon: "💎", category: "wizard artifacts", params: [
    { key: "color", label: "Soul", type: "color", default: 0x9a4aff }] });

  register("enchanting_font", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x3a3640)), c = _c(o.glow, 0x6a4aff);
    g.add(_cyl(0.4, 0.46, 0.16, st, [0, 0.08, 0], 16));
    g.add(_cyl(0.1, 0.14, 0.8, st, [0, 0.5, 0], 10));
    g.add(_cyl(0.36, 0.3, 0.1, st, [0, 0.95, 0], 16));
    const pool = _cyl(0.32, 0.32, 0.02, tglow(c, 1.3, 0.7), [0, 1.0, 0], 16); g.add(pool);
    const runes = new THREE.Group();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const r = _box(0.05, 0.05, 0.01, glow(c, 1.4), [Math.cos(a) * 0.45, 1.2, Math.sin(a) * 0.45]); r.rotation.y = -a; runes.add(r); }
    g.add(runes);
    const beam = _cyl(0.04, 0.04, 0.6, tglow(c, 1.5, 0.3), [0, 1.3, 0], 8); g.add(beam);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; runes.rotation.y += dt * 0.4; pool.material.emissiveIntensity = 1.1 + (Math.sin(t * 2) + 1) / 2 * 0.5; beam.material.opacity = 0.2 + (Math.sin(t * 3) + 1) / 2 * 0.25; beam.scale.x = beam.scale.z = 0.8 + Math.sin(t * 4) * 0.2; };
    return g;
  }, { icon: "🔮", category: "wizard artifacts", params: [
    { key: "color", label: "Stone", type: "color", default: 0x3a3640 },
    { key: "glow", label: "Magic", type: "color", default: 0x6a4aff }] });

  register("floating_spell_tome", function (o) {
    const g = new THREE.Group(); const cov = M.book(_c(o.color, 0x3a1a4a)), c = _c(o.glow, 0x9a6aff);
    const book = new THREE.Group();
    const spineAngle = 0.3;
    const left = _box(0.3, 0.03, 0.4, cov, [-0.16, 0, 0]); left.rotation.z = spineAngle; book.add(left);
    const right = _box(0.3, 0.03, 0.4, cov, [0.16, 0, 0]); right.rotation.z = -spineAngle; book.add(right);
    const pL = _box(0.27, 0.01, 0.37, M.plaster(0xf0e8d8), [-0.15, 0.02, 0]); pL.rotation.z = spineAngle; book.add(pL);
    const pR = _box(0.27, 0.01, 0.37, M.plaster(0xf0e8d8), [0.15, 0.02, 0]); pR.rotation.z = -spineAngle; book.add(pR);
    const gm = glow(c, 1.5);
    const glyph = _box(0.12, 0.01, 0.12, gm, [0, 0.16, 0]); book.add(glyph);
    book.position.y = o.height; g.add(book);
    const motes = []; for (let i = 0; i < 5; i++) { const m = _sph(0.015, tglow(c, 1.4, 0.7), [0, o.height, 0], 6); g.add(m); motes.push({ m, a: rand(0, 6.28), ph: rand(0, 6) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; book.position.y = o.height + Math.sin(t * 1.3) * 0.05; book.rotation.y += dt * 0.4; gm.emissiveIntensity = 1.2 + Math.sin(t * 2.5) * 0.5; glyph.position.y = 0.16 + Math.sin(t * 2) * 0.04; motes.forEach((mo) => { mo.a += dt * 1.2; const r = 0.25 + Math.sin(t + mo.ph) * 0.05; mo.m.position.set(Math.cos(mo.a) * r, o.height + 0.1 + Math.sin(t * 1.5 + mo.ph) * 0.1, Math.sin(mo.a) * r); }); };
    return g;
  }, { icon: "📖", category: "wizard artifacts", params: [
    { key: "height", label: "Hover Height", type: "number", min: 0.5, max: 2, step: 0.1, default: 1.1 },
    { key: "color", label: "Cover", type: "color", default: 0x3a1a4a },
    { key: "glow", label: "Magic", type: "color", default: 0x9a6aff }] });
})();
