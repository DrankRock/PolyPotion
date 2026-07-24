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

  register("bubbling_cauldron", function (o) {
    const g = new THREE.Group();
    const ir = M.metal(0x2a2520), R = o.radius;
    for (let i = 0; i < 3; i++) {                       // three splayed legs
      const a = i * Math.PI * 2 / 3;
      const leg = _cyl(0.025, 0.03, 0.22, ir, [Math.cos(a) * R * 0.6, 0.11, Math.sin(a) * R * 0.6], 6);
      leg.rotation.x =  Math.sin(a) * 0.2;
      leg.rotation.z = -Math.cos(a) * 0.2;
      g.add(leg);
    }
    const bodyH = R * 1.1, bodyY = 0.22 + bodyH / 2, topY = 0.22 + bodyH;
    g.add(_cyl(R, R * 0.65, bodyH, ir, [0, bodyY, 0], 22));  // bowl
    g.add(_sph(R * 0.65, ir, [0, 0.22, 0], 16));             // rounded bottom
    const rim = _tor(R * 0.96, 0.04, ir, [0, topY, 0], 8, 22); rim.rotation.x = Math.PI / 2; g.add(rim);
    const lm = glow(_c(o.brew, 0x6ad64a), 1.6);
    g.add(_cyl(R * 0.9, R * 0.9, 0.02, lm, [0, topY - 0.03, 0], 22));  // brew surface
    for (let i = 0; i < 5; i++) {                                       // bubbles
      g.add(_sph(rand(0.02, 0.05), lm, [rand(-R * 0.5, R * 0.5), topY + rand(0, 0.18), rand(-R * 0.5, R * 0.5)], 6));
    }
    return g;
  }, {
    icon: "⚱", category: "wizard food",
    params: [
      { key: "radius", label: "Size", type: "number", min: 0.25, max: 0.7, step: 0.05, default: 0.4 },
      { key: "brew",   label: "Brew", type: "color",  default: 0x6ad64a },
    ],
  });

  // ── Scrying orb ──────────────────────────────────────────────
  // Glowing crystal sphere held in a clawed brass tripod.

  register("feast_platter", function (o) {
    const g = new THREE.Group(); const pl = M.brass(0xb8945a);
    g.add(_cyl(0.3, 0.34, 0.03, pl, [0, 0.015, 0], 20));
    const roast = _sph(0.14, M.wood(0x6a3a1a), [0, 0.12, 0], 12); roast.scale.set(1.3, 0.7, 1); g.add(roast);
    for (const sx of [-1, 1]) { const lg = _cone(0.03, 0.1, M.wood(0x5a2a12), [sx * 0.12, 0.14, 0.06], 5); lg.rotation.z = sx * 0.5; g.add(lg); }
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; g.add(_sph(rand(0.03, 0.05), M.cloth(pick([0xd6402a, 0xd6a020, 0x6aa030, 0x8a2a6a])), [Math.cos(a) * 0.22, 0.05, Math.sin(a) * 0.22], 8)); }
    return g;
  }, { icon: "◖", category: "wizard food", params: [] });

  register("chalice", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xc8a050));
    g.add(_cyl(0.06, 0.09, 0.02, br, [0, 0.01, 0], 16));
    g.add(_cyl(0.015, 0.02, 0.1, br, [0, 0.06, 0], 8));
    g.add(_sph(0.04, br, [0, 0.11, 0], 10));
    g.add(_cyl(0.08, 0.05, 0.12, br, [0, 0.18, 0], 16));
    g.add(_cyl(0.07, 0.07, 0.02, glow(_c(o.drink, 0x8a2020), 0.5), [0, 0.23, 0], 16));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.add(_sph(0.015, glow(pick([0xd62a2a, 0x2a6ad6, 0x2ad66a]), 1.0), [Math.cos(a) * 0.06, 0.18, Math.sin(a) * 0.06], 6)); }
    return g;
  }, { icon: "♟", category: "wizard food", params: [
    { key: "color", label: "Metal", type: "color", default: 0xc8a050 },
    { key: "drink", label: "Drink", type: "color", default: 0x8a2020 }] });

  register("tripod_cauldron", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520), cm = M.metal(0x222018);
    for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; const leg = _cyl(0.02, 0.025, 0.7, ir, [Math.cos(a) * 0.2, 0.35, Math.sin(a) * 0.2], 5); leg.rotation.x = Math.sin(a) * 0.4; leg.rotation.z = -Math.cos(a) * 0.4; g.add(leg); }
    g.add(_tor(0.08, 0.012, ir, [0, 0.72, 0], 6, 14));
    const body = _sph(0.22, cm, [0, 0.5, 0], 14); body.scale.y = 0.8; g.add(body);
    g.add(_cyl(0.18, 0.2, 0.04, cm, [0, 0.62, 0], 14));
    g.add(_cyl(0.16, 0.16, 0.02, glow(_c(o.brew, 0x4ad67a), 0.8), [0, 0.6, 0], 14));
    const fm = glow(_c(o.flame, 0xff8a3a), 2.0);
    for (let i = 0; i < 4; i++) g.add(_cone(rand(0.05, 0.09), rand(0.15, 0.3), fm, [rand(-0.08, 0.08), 0.12, rand(-0.08, 0.08)], 6));
    return g;
  }, { icon: "♺", category: "wizard food", params: [
    { key: "brew", label: "Brew", type: "color", default: 0x4ad67a },
    { key: "flame", label: "Flame", type: "color", default: 0xff8a3a }] });

  register("grinding_bowl", function (o) {
    const g = new THREE.Group(); const cer = M.ceramic(_c(o.color, 0xc8b8a0));
    g.add(_cyl(0.1, 0.07, 0.1, cer, [0, 0.05, 0], 14));
    g.add(_cyl(0.06, 0.06, 0.02, M.stone(0x8a7a6a), [0, 0.09, 0], 12));
    const pestle = _cyl(0.018, 0.03, 0.18, cer, [0.04, 0.13, 0], 8); pestle.rotation.z = 0.5; g.add(pestle);
    g.add(_sph(0.03, cer, [0.11, 0.2, 0], 8));
    return g;
  }, { icon: "🥣", category: "wizard food", params: [
    { key: "color", label: "Stone", type: "color", default: 0xc8b8a0 }] });

  register("feast_goblet_tower", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xc8a050));
    const n = o.cups; const base = 0.34;
    for (let row = 0; row < n; row++) {
      const cups = n - row; const span = base * (cups - 1);
      for (let i = 0; i < cups; i++) {
        const x = -span / 2 + i * base, y = row * 0.18 + 0.09;
        g.add(_cyl(0.07, 0.045, 0.12, br, [x, y, 0], 12));
        g.add(_cyl(0.05, 0.05, 0.015, br, [x, y - 0.065, 0], 12));
      }
    }
    return g;
  }, { icon: "🥂", category: "wizard food", params: [
    { key: "cups", label: "Rows", type: "int", min: 2, max: 5, default: 3 },
    { key: "color", label: "Metal", type: "color", default: 0xc8a050 }] });

  register("roast_platter", function (o) {
    const g = new THREE.Group(); const pl = M.metal(_c(o.tray, 0x9a9088)), me = M.wax(_c(o.color, 0x8a4a2a));
    g.add(_cyl(0.34, 0.36, 0.04, pl, [0, 0.02, 0], 20));
    g.add(_sph(0.22, me, [0, 0.18, 0], 16)); const b = g.children[g.children.length - 1]; b.scale.set(1.3, 0.8, 1.0);
    g.add(_cyl(0.03, 0.05, 0.16, M.bone(0xe8dcc0), [0.26, 0.16, 0], 8));
    g.add(_cyl(0.03, 0.05, 0.16, M.bone(0xe8dcc0), [-0.26, 0.16, 0], 8));
    return g;
  }, { icon: "🍖", category: "wizard food", params: [
    { key: "color", label: "Roast", type: "color", default: 0x8a4a2a },
    { key: "tray", label: "Tray", type: "color", default: 0x9a9088 }] });

  register("pudding_stand", function (o) {
    const g = new THREE.Group(); const cer = M.ceramic(_c(o.plate, 0xe8dcc8)), pd = M.wax(_c(o.color, 0xd8a060));
    g.add(_cyl(0.04, 0.06, 0.22, cer, [0, 0.11, 0], 10));
    g.add(_cyl(0.2, 0.22, 0.025, cer, [0, 0.235, 0], 18));
    g.add(_cone(0.16, 0.2, pd, [0, 0.35, 0], 18));
    g.add(_sph(0.025, glow(0xffe066, 0.8), [0, 0.45, 0], 8));
    return g;
  }, { icon: "🍮", category: "wizard food", params: [
    { key: "color", label: "Pudding", type: "color", default: 0xd8a060 },
    { key: "plate", label: "Plate", type: "color", default: 0xe8dcc8 }] });

  register("sweets_jar", function (o) {
    const g = new THREE.Group(); const gl = M.glass(0xcfe3ee), lid = M.brass(0xc8a050);
    g.add(_cyl(0.13, 0.15, 0.34, gl, [0, 0.17, 0], 16));
    const candy = _c(o.color, 0xd23a5a);
    for (let i = 0; i < 14; i++) g.add(_sph(rand(0.03, 0.05), M.ceramic(i % 2 ? candy : 0xf0e060), [rand(-0.07, 0.07), rand(0.04, 0.28), rand(-0.07, 0.07)], 8));
    g.add(_cyl(0.16, 0.14, 0.05, lid, [0, 0.36, 0], 16));
    g.add(_sph(0.03, lid, [0, 0.4, 0], 8));
    return g;
  }, { icon: "🍬", category: "wizard food", params: [
    { key: "color", label: "Sweets", type: "color", default: 0xd23a5a }] });

  register("soup_tureen", function (o) {
    const g = new THREE.Group(); const c = M.ceramic(_c(o.color, 0xdcd0bc)), m = M.metal(0x6a6358);
    g.add(_cyl(0.24, 0.2, 0.2, c, [0, 0.12, 0], 18));
    g.add(_tor(0.24, 0.02, m, [0, 0.22, 0], 8, 20));
    g.add(_cyl(0.2, 0.22, 0.05, c, [0, 0.25, 0], 18));
    g.add(_sph(0.04, c, [0, 0.3, 0], 8));
    for (const sx of [-1, 1]) g.add(_tor(0.04, 0.012, m, [sx * 0.24, 0.13, 0], 6, 12));
    return g;
  }, { icon: "🍲", category: "wizard food", params: [
    { key: "color", label: "Ceramic", type: "color", default: 0xdcd0bc }] });

  register("frothing_keg", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x6a4326)), ir = M.metal(0x3a342c);
    g.add(_cyl(0.26, 0.3, 0.5, wd, [0, 0.3, 0], 16)); const body = g.children[0]; body.scale.x = 0.7;
    for (const yy of [0.12, 0.3, 0.48]) { const r = _tor(0.205, 0.02, ir, [0, yy, 0], 8, 20); r.scale.x = 0.72; r.rotation.x = Math.PI / 2; g.add(r); }
    g.add(_cyl(0.025, 0.025, 0.1, M.brass(0xc8a050), [0, 0.18, 0.2], 8)); g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // floating froth bubbles (animated)
    const froth = new THREE.Group();
    const bub = []; for (let i = 0; i < 5; i++) { const b = _sph(rand(0.015, 0.03), tglow(0xfff4e0, 0.5, 0.8), [rand(-0.12, 0.12), 0, rand(-0.08, 0.08)], 6); froth.add(b); bub.push({ m: b, ph: rand(0, 6), sp: rand(0.4, 0.9) }); }
    froth.position.set(0, 0.56, 0.05); g.add(froth);
    g.userData.tick = (dt) => { bub.forEach((b) => { b.m.position.y = (b.m.position.y + dt * b.sp * 0.3) % 0.18; b.m.material.opacity = 0.8 * (1 - b.m.position.y / 0.18); }); };
    return g;
  }, { icon: "🍺", category: "wizard food", params: [
    { key: "color", label: "Wood", type: "color", default: 0x6a4326 }] });

  register("floating_dessert", function (o) {
    const g = new THREE.Group();
    const bob = new THREE.Group();
    bob.add(_cyl(0.16, 0.17, 0.02, M.ceramic(_c(o.plate, 0xe8dcc8)), [0, 0, 0], 16));
    bob.add(_cyl(0.11, 0.13, 0.09, M.wax(_c(o.color, 0xc89a5a)), [0, 0.055, 0], 16));
    bob.add(_cyl(0.08, 0.1, 0.06, M.ceramic(0xf2e6d2), [0, 0.13, 0], 16));
    bob.add(_sph(0.028, glow(0xff5a4a, 1.1), [0, 0.18, 0], 8));
    bob.position.y = o.height; g.add(bob);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; bob.position.y = o.height + Math.sin(t * 1.6) * 0.05; bob.rotation.y += dt * 0.5; };
    return g;
  }, { icon: "🍰", category: "wizard food", params: [
    { key: "height", label: "Float Height", type: "number", min: 0.3, max: 1.6, step: 0.1, default: 0.9 },
    { key: "color", label: "Cake", type: "color", default: 0xc89a5a },
    { key: "plate", label: "Plate", type: "color", default: 0xe8dcc8 }] });

  // ════════════════════════════════════════════════════════════
  //  COMMON-ROOM CLUTTER
  // ════════════════════════════════════════════════════════════

  register("sweets_counter", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3420)), gl = M.glass(0xcfe3ee);
    g.add(_box(1.4, 0.9, 0.6, wd, [0, 0.45, 0]));
    g.add(_box(1.44, 0.06, 0.64, wd, [0, 0.92, 0]));
    g.add(_box(1.3, 0.4, 0.5, gl, [0, 1.18, 0]));         // glass display top
    const cols = [0xd23a5a, 0xf0c040, 0x4aaa6a, 0x9a4ac0];
    for (let i = 0; i < 4; i++) { const x = -0.5 + i * 0.33; for (let j = 0; j < 6; j++) g.add(_sph(0.04, M.ceramic(cols[i]), [x + rand(-0.06, 0.06), 1.02 + rand(0, 0.04), rand(-0.15, 0.15)], 8)); }
    return g;
  }, { icon: "🍭", category: "wizard food", params: [
    { key: "color", label: "Wood", type: "color", default: 0x5a3420 }] });

  register("toffee_cauldron", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520), tf = glow(_c(o.color, 0xc87a2a), 0.5);
    g.add(_sph(0.22, ir, [0, 0.22, 0], 14)); g.children[0].scale.y = 0.85;
    g.add(_cyl(0.22, 0.22, 0.04, tf, [0, 0.3, 0], 16));   // molten toffee surface
    for (const sx of [-1, 1]) g.add(_cyl(0.02, 0.02, 0.2, ir, [sx * 0.18, 0.05, 0], 6));
    const drip = _cyl(0.012, 0.02, 0.3, tf, [0.18, 0.45, 0], 6); g.add(drip); // ladle drip
    g.add(_cyl(0.012, 0.012, 0.3, M.wood(0x4a3018), [0.18, 0.6, 0], 6));
    g.add(_sph(0.04, tf, [0.18, 0.46, 0], 8));
    return g;
  }, { icon: "🍯", category: "wizard food", params: [
    { key: "color", label: "Toffee", type: "color", default: 0xc87a2a }] });

  register("lollipop_display", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x5a3a22);
    g.add(_cyl(0.16, 0.18, 0.1, wd, [0, 0.05, 0], 12));
    const cols = [_c(o.color, 0xe04a8a), 0x4ac0e0, 0xf0c040, 0x8a4ac0, 0x4aaa6a];
    for (let i = 0; i < o.count; i++) { const a = i / o.count * Math.PI * 2, r = 0.1; const stick = _cyl(0.006, 0.006, 0.4, M.bone(0xf0e8d8), [Math.cos(a) * r, 0.3, Math.sin(a) * r], 5); stick.rotation.z = Math.cos(a) * 0.25; stick.rotation.x = -Math.sin(a) * 0.25; g.add(stick); g.add(_cyl(0.05, 0.05, 0.015, M.ceramic(pick(cols)), [Math.cos(a) * (r + 0.06), 0.48, Math.sin(a) * (r + 0.06)], 12)); g.children[g.children.length - 1].rotation.x = Math.PI / 2; }
    return g;
  }, { icon: "🍭", category: "wizard food", params: [
    { key: "count", label: "Lollipops", type: "int", min: 4, max: 12, default: 7 },
    { key: "color", label: "First Color", type: "color", default: 0xe04a8a }] });

  register("confectionery_cart", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x6a4326)), m = M.metal(0x3a342c);
    g.add(_box(0.9, 0.5, 0.5, wd, [0, 0.6, 0]));
    g.add(_box(0.94, 0.05, 0.54, wd, [0, 0.86, 0]));
    const canopy = _box(1.0, 0.04, 0.6, M.cloth(_c(o.canopy, 0x7a1a2a)), [0, 1.5, 0]); g.add(canopy);
    for (const [x, z] of [[-0.42, 0.24], [0.42, 0.24], [-0.42, -0.24], [0.42, -0.24]]) g.add(_cyl(0.012, 0.012, 0.62, m, [x, 1.18, z], 6));
    for (const sx of [-1, 1]) { g.add(_cyl(0.18, 0.18, 0.04, m, [sx * 0.5, 0.18, 0.28], 12)); g.children[g.children.length - 1].rotation.z = Math.PI / 2; }
    g.add(_box(0.04, 0.04, 0.4, wd, [0.5, 0.5, 0])); // handle
    // jars on top
    for (let i = 0; i < 4; i++) g.add(_cyl(0.06, 0.07, 0.14, M.glass(0xcfe3ee), [-0.3 + i * 0.2, 0.96, 0], 10));
    return g;
  }, { icon: "🛒", category: "wizard food", params: [
    { key: "color", label: "Wood", type: "color", default: 0x6a4326 },
    { key: "canopy", label: "Canopy", type: "color", default: 0x7a1a2a }] });

  // ════════════════════════════════════════════════════════════
  //  BROOM-SPORT GEAR  (generic)
  // ════════════════════════════════════════════════════════════

  register("bubbling_brew_cauldron", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520);
    g.add(_sph(0.32, ir, [0, 0.3, 0], 16)); g.children[0].scale.y = 0.8;
    g.add(_cyl(0.32, 0.28, 0.06, ir, [0, 0.42, 0], 18));
    for (const sx of [-1, 1]) { const leg = _cyl(0.025, 0.03, 0.18, ir, [sx * 0.2, 0.08, 0], 6); leg.rotation.z = sx * 0.3; g.add(leg); }
    const brew = glow(_c(o.color, 0x4ad06a), 0.6);
    const surf = _cyl(0.28, 0.28, 0.02, brew, [0, 0.42, 0], 18); g.add(surf);
    const bubbles = []; for (let i = 0; i < 7; i++) { const b = _sph(rand(0.02, 0.05), brew, [rand(-0.2, 0.2), 0.42, rand(-0.2, 0.2)], 6); g.add(b); bubbles.push({ m: b, ph: rand(0, 6), sp: rand(0.5, 1.2), bx: b.position.x, bz: b.position.z }); }
    // steam wisps
    const steam = []; for (let i = 0; i < 4; i++) { const s = _sph(0.03, tglow(0xeafff0, 0.4, 0.4), [rand(-0.15, 0.15), 0.5, rand(-0.15, 0.15)], 6); g.add(s); steam.push({ m: s, base: s.position.y, sp: rand(0.2, 0.5), ph: rand(0, 6) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; surf.material.emissiveIntensity = 0.5 + Math.sin(t * 2) * 0.2; bubbles.forEach((b) => { const y = 0.42 + ((t * b.sp + b.ph) % 1) * 0.06; b.m.position.set(b.bx, y, b.bz); const s = Math.sin((t * b.sp + b.ph) % 1 * Math.PI); b.m.scale.setScalar(0.4 + s); }); steam.forEach((s) => { s.m.position.y = s.base + ((t * s.sp + s.ph) % 1) * 0.4; s.m.material.opacity = 0.4 * (1 - ((t * s.sp + s.ph) % 1)); }); };
    return g;
  }, { icon: "⚗", category: "wizard food", params: [
    { key: "color", label: "Brew", type: "color", default: 0x4ad06a }] });

  register("refilling_goblet", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xc8a050));
    g.add(_cyl(0.05, 0.03, 0.04, br, [0, 0.02, 0], 12));         // foot
    g.add(_cyl(0.015, 0.02, 0.1, br, [0, 0.09, 0], 8));          // stem
    g.add(_cyl(0.07, 0.04, 0.14, br, [0, 0.21, 0], 14));         // bowl
    const wine = tglow(_c(o.drink, 0x6a1020), 0.3, 0.85);
    const liquid = _cyl(0.062, 0.035, 0.1, wine, [0, 0.2, 0], 14); g.add(liquid);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const lvl = 0.06 + (Math.sin(t * 0.6) * 0.5 + 0.5) * 0.06; liquid.scale.y = lvl / 0.1; liquid.position.y = 0.16 + lvl / 2; };
    return g;
  }, { icon: "🍷", category: "wizard food", params: [
    { key: "color", label: "Goblet", type: "color", default: 0xc8a050 },
    { key: "drink", label: "Drink", type: "color", default: 0x6a1020 }] });
})();
