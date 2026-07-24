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

  register("rune_pillar", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5650));
    g.add(_box(0.4, 0.16, 0.4, st, [0, 0.08, 0]));
    g.add(_box(0.3, o.height, 0.3, st, [0, o.height / 2 + 0.16, 0]));
    g.add(_box(0.42, 0.16, 0.42, st, [0, o.height + 0.24, 0]));
    const rune = glow(_c(o.glow, 0x4ac0e0), 1.2);
    for (const face of [[0, 0.16, 1], [0, 0.16, -1], [0.16, 0, 1], [-0.16, 0, 1]]) {
      for (let i = 0; i < 3; i++) { const y = 0.4 + i * (o.height / 3.5); g.add(_box(0.06, 0.06, 0.01, rune, [face[0], y, face[1] * 0.155])); }
    }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; rune.emissiveIntensity = 0.8 + (Math.sin(t * 1.5) + 1) / 2 * 0.8; };
    return g;
  }, { icon: "🪨", category: "wizard magic", params: [
    { key: "height", label: "Height", type: "number", min: 0.8, max: 2.5, step: 0.1, default: 1.6 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5650 },
    { key: "glow", label: "Runes", type: "color", default: 0x4ac0e0 }] });

  register("summoning_circle", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x9a4aff);
    const ringM = glow(c, 1.3);
    const outer = _tor(o.size, 0.025, ringM, [0, 0.02, 0], 6, 40); outer.rotation.x = Math.PI / 2; g.add(outer);
    const ringA = new THREE.Group(), ringB = new THREE.Group();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const gl = _box(0.05, 0.006, 0.14, glow(c, 1.2), [Math.cos(a) * o.size * 0.78, 0.02, Math.sin(a) * o.size * 0.78]); gl.rotation.y = -a; ringA.add(gl); }
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const gl = _box(0.06, 0.006, o.size * 0.7, glow(c, 1.0), [0, 0.02, 0]); gl.position.set(Math.cos(a) * o.size * 0.3, 0.02, Math.sin(a) * o.size * 0.3); gl.rotation.y = -a; ringB.add(gl); } // pentagram-ish spokes
    g.add(ringA); g.add(ringB);
    const pillars = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const p = _cyl(0.03, 0.03, 0.6, tglow(c, 1.2, 0.4), [Math.cos(a) * o.size * 0.9, 0.32, Math.sin(a) * o.size * 0.9], 6); g.add(p); pillars.push({ m: p, ph: i * 1.2 }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; ringA.rotation.y += dt * 0.4; ringB.rotation.y -= dt * 0.25; ringM.emissiveIntensity = 1.0 + (Math.sin(t * 1.8) + 1) / 2 * 0.6; pillars.forEach((p) => { p.m.material.opacity = 0.25 + (Math.sin(t * 2 + p.ph) + 1) / 2 * 0.3; p.m.scale.y = 0.85 + Math.sin(t * 2.5 + p.ph) * 0.15; }); };
    return g;
  }, { icon: "🪄", category: "wizard magic", params: [
    { key: "size", label: "Radius", type: "number", min: 0.5, max: 1.6, step: 0.1, default: 0.9 },
    { key: "color", label: "Arcane", type: "color", default: 0x9a4aff }] });

  register("wisp_cluster", function (o) {
    const g = new THREE.Group(); const wc = _c(o.glow, 0x8ad6ff); const gm = glow(wc, 2.2);
    const halo = new THREE.MeshStandardMaterial({ color: wc, emissive: wc, emissiveIntensity: 1.0, transparent: true, opacity: 0.25 });
    for (let i = 0; i < o.count; i++) { const x = rand(-o.spread, o.spread), z = rand(-o.spread, o.spread), y = o.height + rand(-0.3, 0.3);
      g.add(_sph(rand(0.03, 0.06), gm, [x, y, z], 8)); g.add(_sph(0.1, halo, [x, y, z], 8)); }
    return g;
  }, { icon: "❉", category: "wizard magic", params: [
    { key: "count", label: "Wisps", type: "int", min: 3, max: 20, step: 1, default: 7 },
    { key: "spread", label: "Spread", type: "number", min: 0.3, max: 2, step: 0.1, default: 0.8 },
    { key: "height", label: "Height", type: "number", min: 0.5, max: 3, step: 0.1, default: 1.5 },
    { key: "glow", label: "Glow", type: "color", default: 0x8ad6ff }] });

  register("floating_runes", function (o) {
    const g = new THREE.Group(); const gm = glow(_c(o.glow, 0x6a8aff), 1.6); const y = o.height, R = o.radius, n = o.count;
    for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n, x = Math.cos(a) * R, z = Math.sin(a) * R, ry = y + Math.sin(i * 1.3) * 0.2;
      g.add(_box(0.02, 0.16, 0.02, gm, [x, ry, z])); g.add(_box(0.1, 0.02, 0.02, gm, [x, ry + rand(-0.04, 0.04), z])); }
    return g;
  }, { icon: "⍟", category: "wizard magic", params: [
    { key: "count", label: "Glyphs", type: "int", min: 4, max: 16, step: 1, default: 8 },
    { key: "radius", label: "Radius", type: "number", min: 0.3, max: 1.2, step: 0.05, default: 0.5 },
    { key: "height", label: "Height", type: "number", min: 0.5, max: 3, step: 0.1, default: 1.5 },
    { key: "glow", label: "Glow", type: "color", default: 0x6a8aff }] });

  // ═══ FURNITURE & STORAGE ═════════════════════════════════════

  register("standing_stones", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6358)); const n = o.count, R = o.radius;
    for (let i = 0; i < n; i++) { const a = i * Math.PI * 2 / n, x = Math.cos(a) * R, z = Math.sin(a) * R; const h = rand(0.8, 1.5); const s = _box(rand(0.25, 0.4), h, rand(0.2, 0.3), st, [x, h / 2, z]); s.rotation.y = rand(-0.3, 0.3); s.rotation.z = rand(-0.08, 0.08); g.add(s); }
    g.add(_cyl(R * 0.3, R * 0.3, 0.02, glow(_c(o.glow, 0x4ad6c0), 0.6), [0, 0.02, 0], 20));
    return g;
  }, { icon: "☉", category: "wizard magic", params: [
    { key: "count", label: "Stones", type: "int", min: 4, max: 12, step: 1, default: 7 },
    { key: "radius", label: "Radius", type: "number", min: 0.5, max: 2, step: 0.1, default: 0.9 },
    { key: "color", label: "Stone", type: "color", default: 0x6a6358 },
    { key: "glow", label: "Ley glow", type: "color", default: 0x4ad6c0 }] });

  register("spirit_harp", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3a1a));
    g.add(_box(0.08, 1.3, 0.1, wd, [0.4, 0.65, 0]));
    const base = _box(0.7, 0.1, 0.12, wd, [0.1, 0.06, 0]); base.rotation.z = -0.25; g.add(base);
    const neck = _box(0.08, 0.8, 0.1, wd, [0.05, 1.1, 0]); neck.rotation.z = 0.8; g.add(neck);
    const sm = glow(_c(o.glow, 0x8ad6ff), 1.0);
    for (let i = 0; i < 11; i++) { const t = i / 10; const x = 0.36 - 0.32 * t; const len = 0.4 + 0.7 * (1 - t); g.add(_cyl(0.004, 0.004, len, sm, [x, 0.2 + len / 2 + t * 0.15, 0], 4)); }
    return g;
  }, { icon: "🎵", category: "wizard magic", params: [
    { key: "color", label: "Wood", type: "color", default: 0x5a3a1a },
    { key: "glow", label: "Strings", type: "color", default: 0x8ad6ff }] });

  register("fairy_sparkles", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xfff0a0);
    for (let i = 0; i < o.count; i++) g.add(_sph(rand(0.012, 0.025), glow(c, 2.6), [rand(-o.spread, o.spread), rand(0.3, o.spread + 0.6), rand(-o.spread, o.spread)], 6));
    return g;
  }, { icon: "✨", category: "wizard magic", params: [
    { key: "count", label: "Motes", type: "int", min: 5, max: 50, step: 1, default: 20 },
    { key: "spread", label: "Spread", type: "number", min: 0.2, max: 1.5, step: 0.1, default: 0.6 },
    { key: "color", label: "Colour", type: "color", default: 0xfff0a0 }] });

  register("ward_shield_stand", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x4a3018), sh = tglow(_c(o.color, 0x4aa0ff), 0.7, 0.4);
    g.add(_cyl(0.14, 0.18, 0.05, wd, [0, 0.025, 0], 10));
    g.add(_cyl(0.025, 0.025, 0.9, wd, [0, 0.5, 0], 8));
    const shield = new THREE.Group();
    shield.add(_cyl(0.3, 0.3, 0.02, sh, [0, 0, 0], 24));
    shield.add(_tor(0.3, 0.015, glow(_c(o.color, 0x4aa0ff), 1.2), [0, 0, 0], 8, 28));
    shield.rotation.x = Math.PI / 2; shield.position.y = 1.0; g.add(shield);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; sh.opacity = 0.3 + (Math.sin(t * 2) + 1) / 2 * 0.25; shield.rotation.z += dt * 0.5; };
    return g;
  }, { icon: "🛡", category: "wizard magic", params: [
    { key: "color", label: "Ward", type: "color", default: 0x4aa0ff }] });

  // ════════════════════════════════════════════════════════════
  //  MUSIC ROOM  (some animated)
  // ════════════════════════════════════════════════════════════

  register("storm_cloud", function (o) {
    const g = new THREE.Group(); const cl = M.fabric(_c(o.color, 0x3a3a44));
    const cloud = new THREE.Group();
    for (let i = 0; i < 7; i++) cloud.add(_sph(rand(0.18, 0.3), cl, [rand(-0.4, 0.4), rand(-0.05, 0.05), rand(-0.2, 0.2)], 10));
    const bolt = _cone(0.04, 0.3, glow(0xffe066, 1.6), [0.1, -0.3, 0], 4); bolt.rotation.x = Math.PI; bolt.visible = false; cloud.add(bolt);
    cloud.position.set(0, o.height, 0); g.add(cloud);
    let t = rand(0, 6), flash = 0;
    g.userData.tick = (dt) => { t += dt; cloud.position.x = Math.sin(t * 0.3) * 0.2; if (flash > 0) { flash -= dt; bolt.visible = flash > 0; bolt.material.emissiveIntensity = flash * 6; } else if (Math.random() < 0.004) { flash = 0.25; } };
    return g;
  }, { icon: "⛈", category: "wizard magic", params: [
    { key: "height", label: "Height", type: "number", min: 1.5, max: 3.5, step: 0.1, default: 2.4 },
    { key: "color", label: "Cloud", type: "color", default: 0x3a3a44 }] });

  register("will_o_wisp_cluster", function (o) {
    const g = new THREE.Group();
    const wisps = []; const n = o.count;
    for (let i = 0; i < n; i++) { const c = glow(_c(o.color, 0x8af0d0), 1.4); const w = _sph(rand(0.03, 0.06), c, [0, 0, 0], 8); g.add(w); wisps.push({ m: w, mat: c, ax: rand(0.1, 0.4), az: rand(0.1, 0.4), ay: rand(0.3, 1.0), sp: rand(0.4, 1.0), ph: rand(0, 6) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; wisps.forEach((w) => { w.m.position.set(Math.sin(t * w.sp + w.ph) * w.ax, w.ay + Math.sin(t * w.sp * 1.3 + w.ph) * 0.15, Math.cos(t * w.sp * 0.8 + w.ph) * w.az); w.mat.emissiveIntensity = 1.0 + Math.sin(t * 3 + w.ph) * 0.6; }); };
    return g;
  }, { icon: "✨", category: "wizard magic", params: [
    { key: "count", label: "Wisps", type: "int", min: 2, max: 8, default: 4 },
    { key: "color", label: "Glow", type: "color", default: 0x8af0d0 }] });

  register("protego_dome", function (o) {
    const g = new THREE.Group();
    const sh = tglow(_c(o.color, 0x5ab0ff), 0.6, 0.22);
    const dome = _sph(o.radius, sh, [0, 0, 0], 20); dome.scale.y = 0.6; g.add(dome);
    const ribs = new THREE.Group();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI; const rib = _tor(o.radius, 0.008, glow(_c(o.color, 0x5ab0ff), 1.0), [0, 0, 0], 6, 24); rib.rotation.y = a; rib.scale.y = 0.6; ribs.add(rib); }
    g.add(ribs);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const pulse = 0.18 + (Math.sin(t * 2) + 1) / 2 * 0.18; dome.material.opacity = pulse; ribs.rotation.y += dt * 0.15; ribs.children.forEach((r, i) => { r.material.emissiveIntensity = 0.7 + Math.sin(t * 3 + i) * 0.4; }); };
    return g;
  }, { icon: "🛡", category: "wizard magic", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.6, max: 2.5, step: 0.1, default: 1.2 },
    { key: "color", label: "Ward", type: "color", default: 0x5ab0ff }] });

  register("scrying_pool", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x4a4640));
    g.add(_cyl(0.6, 0.66, 0.2, st, [0, 0.1, 0], 24));
    g.add(_cyl(0.52, 0.52, 0.16, M.stone(0x2a2620), [0, 0.13, 0], 24));
    const water = _cyl(0.5, 0.5, 0.02, tglow(_c(o.water, 0x2a5a8a), 0.5, 0.7), [0, 0.2, 0], 24); g.add(water);
    const mist = []; for (let i = 0; i < 4; i++) { const m = _sph(rand(0.04, 0.08), tglow(0xaad0e0, 0.3, 0.3), [rand(-0.3, 0.3), 0.25, rand(-0.3, 0.3)], 8); g.add(m); mist.push({ m, ph: rand(0, 6) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; water.material.emissiveIntensity = 0.4 + (Math.sin(t * 1.2) + 1) / 2 * 0.3; mist.forEach((mm) => { mm.m.position.y = 0.25 + Math.sin(t * 0.7 + mm.ph) * 0.04; mm.m.material.opacity = 0.2 + (Math.sin(t + mm.ph) + 1) / 2 * 0.2; }); };
    return g;
  }, { icon: "🔮", category: "wizard magic", params: [
    { key: "color", label: "Stone", type: "color", default: 0x4a4640 },
    { key: "water", label: "Water", type: "color", default: 0x2a5a8a }] });

  register("fire_rune", function (o) { return makeRune(o, 0xff5a1a); }, { icon: "🔥", category: "wizard magic", params: [
    { key: "size", label: "Radius", type: "number", min: 0.3, max: 1.2, step: 0.05, default: 0.6 },
    { key: "color", label: "Glow", type: "color", default: 0xff5a1a }] });

  register("frost_rune", function (o) { return makeRune(o, 0x6ac0ff); }, { icon: "❄", category: "wizard magic", params: [
    { key: "size", label: "Radius", type: "number", min: 0.3, max: 1.2, step: 0.05, default: 0.6 },
    { key: "color", label: "Glow", type: "color", default: 0x6ac0ff }] });

  register("shock_rune", function (o) { return makeRune(o, 0xffe24a); }, { icon: "⚡", category: "wizard magic", params: [
    { key: "size", label: "Radius", type: "number", min: 0.3, max: 1.2, step: 0.05, default: 0.6 },
    { key: "color", label: "Glow", type: "color", default: 0xffe24a }] });

  register("glyph_obelisk", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x3a3640)), c = _c(o.glow, 0x4ac0e0);
    g.add(_box(0.4, 0.12, 0.4, st, [0, 0.06, 0]));
    const shaft = _box(0.26, o.height, 0.26, st, [0, o.height / 2 + 0.12, 0]); g.add(shaft);
    const cap = _cone(0.2, 0.3, st, [0, o.height + 0.27, 0], 4); g.add(cap);
    const glyphs = []; const gm = glow(c, 1.4);
    for (let i = 0; i < 5; i++) { const a = rand(0, 6.28), y = rand(0.4, o.height); const gl = _box(0.05, 0.05, 0.01, gm, [Math.cos(a) * 0.32, y, Math.sin(a) * 0.32]); gl.rotation.y = -a + Math.PI / 2; g.add(gl); glyphs.push({ m: gl, ph: rand(0, 6), a, y }); }
    const orbit = new THREE.Group();
    const ring = _tor(0.42, 0.015, gm, [0, o.height * 0.6, 0], 6, 28); ring.rotation.x = Math.PI / 2.4; orbit.add(ring); g.add(orbit);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; gm.emissiveIntensity = 1.0 + (Math.sin(t * 1.6) + 1) / 2 * 0.7; orbit.rotation.y += dt * 0.5; glyphs.forEach((gl) => { gl.m.visible = (Math.sin(t * 1.2 + gl.ph)) > -0.5; }); };
    return g;
  }, { icon: "🪨", category: "wizard magic", params: [
    { key: "height", label: "Height", type: "number", min: 0.8, max: 2.6, step: 0.1, default: 1.7 },
    { key: "color", label: "Stone", type: "color", default: 0x3a3640 },
    { key: "glow", label: "Glyphs", type: "color", default: 0x4ac0e0 }] });

  // ════════════════════════════════════════════════════════════
  //  ERUPTIONS / NOVAS  (cyclic: charge -> burst -> reset)
  // ════════════════════════════════════════════════════════════

  register("frost_spike_burst", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x8ad0ff);
    g.add(_cyl(o.size * 0.9, o.size, 0.04, M.stone(0x5a6a72), [0, 0.02, 0], 18)); // frosted ground
    const spikes = [];
    const n = Math.round(o.count);
    for (let i = 0; i < n; i++) { const a = rand(0, 6.28), r = rand(0, o.size * 0.8); const h = rand(0.3, 0.7); const sp = _cone(rand(0.05, 0.1), h, tglow(c, 1.1, 0.85), [Math.cos(a) * r, 0, Math.sin(a) * r], 5); sp.scale.y = 0.01; g.add(sp); spikes.push({ m: sp, h, ph: rand(0, 1), tilt: rand(-0.2, 0.2) }); }
    let phase = rand(0, 1);
    g.userData.tick = (dt) => { phase += dt * o.speed; if (phase > 1) phase -= 1; spikes.forEach((s) => { let p = (phase + s.ph) % 1; let grow = p < 0.25 ? p / 0.25 : (p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3)); s.m.scale.y = Math.max(0.01, grow); s.m.position.y = (s.h * grow) / 2; s.m.material.opacity = 0.85 * (grow > 0.05 ? 1 : grow * 20); s.m.rotation.z = s.tilt * grow; }); };
    return g;
  }, { icon: "❄", category: "wizard magic", params: [
    { key: "size", label: "Radius", type: "number", min: 0.4, max: 1.5, step: 0.1, default: 0.8 },
    { key: "count", label: "Spikes", type: "int", min: 5, max: 24, default: 12 },
    { key: "speed", label: "Cycle Speed", type: "number", min: 0.1, max: 1.5, step: 0.05, default: 0.5 },
    { key: "color", label: "Ice", type: "color", default: 0x8ad0ff }] });

  register("ice_explosion", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xaae0ff);
    const flash = glow(0xeaffff, 0); g.add(_sph(0.12, flash, [0, o.height, 0], 10));
    const shards = []; const n = Math.round(o.count);
    for (let i = 0; i < n; i++) { const a = rand(0, 6.28), b = rand(-0.3, 1); const dx = Math.cos(a) * Math.sqrt(Math.max(0, 1 - b * b)), dy = Math.abs(b), dz = Math.sin(a) * Math.sqrt(Math.max(0, 1 - b * b)); const sh = _cone(rand(0.025, 0.05), rand(0.12, 0.22), tglow(c, 1.2, 0.9), [0, o.height, 0], 4); g.add(sh); shards.push({ m: sh, dx, dy, dz, spin: rand(-4, 4) }); }
    let phase = rand(0, 1);
    g.userData.tick = (dt) => { phase += dt * o.speed; if (phase > 1) phase -= 1; const burst = phase < 0.12 ? phase / 0.12 : Math.max(0, 1 - (phase - 0.12) / 0.88); flash.emissiveIntensity = phase < 0.12 ? 2.5 * (phase / 0.12) : Math.max(0, 2.5 - (phase - 0.12) * 6); const reach = phase * o.radius; shards.forEach((s) => { s.m.position.set(s.dx * reach, o.height + s.dy * reach - phase * phase * 0.4, s.dz * reach); s.m.material.opacity = 0.9 * (1 - phase); s.m.rotation.x = phase * s.spin; s.m.rotation.z = phase * s.spin; }); };
    return g;
  }, { icon: "💥", category: "wizard magic", params: [
    { key: "height", label: "Origin Height", type: "number", min: 0.2, max: 2, step: 0.1, default: 0.8 },
    { key: "radius", label: "Blast Radius", type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.2 },
    { key: "count", label: "Shards", type: "int", min: 8, max: 40, default: 20 },
    { key: "speed", label: "Cycle Speed", type: "number", min: 0.1, max: 1.2, step: 0.05, default: 0.45 },
    { key: "color", label: "Ice", type: "color", default: 0xaae0ff }] });

  register("arcane_nova", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xc04aff);
    const rings = [];
    for (let i = 0; i < 3; i++) { const rg = _tor(0.1, 0.03, tglow(c, 1.5, 0.8), [0, 0.05, 0], 6, 36); rg.rotation.x = Math.PI / 2; g.add(rg); rings.push({ m: rg, off: i / 3 }); }
    const flash = glow(0xf0d0ff, 0); g.add(_sph(0.14, flash, [0, 0.1, 0], 10));
    let phase = rand(0, 1);
    g.userData.tick = (dt) => { phase += dt * o.speed; if (phase > 1) phase -= 1; flash.emissiveIntensity = Math.max(0, 2.2 - phase * 5); rings.forEach((r) => { let p = (phase + r.off) % 1; const sc = 0.1 + p * o.radius; r.m.scale.set(sc / 0.1, sc / 0.1, 1); r.m.material.opacity = 0.8 * (1 - p); }); };
    return g;
  }, { icon: "💫", category: "wizard magic", params: [
    { key: "radius", label: "Max Radius", type: "number", min: 0.5, max: 3, step: 0.1, default: 1.4 },
    { key: "speed", label: "Cycle Speed", type: "number", min: 0.1, max: 1.5, step: 0.05, default: 0.6 },
    { key: "color", label: "Arcane", type: "color", default: 0xc04aff }] });

  register("meteor_descent", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xff6a2a);
    const rock = new THREE.Group();
    rock.add(_sph(0.18, M.stone(0x2a2018), [0, 0, 0], 10));
    const heat = glow(c, 1.6); for (let i = 0; i < 5; i++) rock.add(_sph(rand(0.05, 0.09), heat, [rand(-0.14, 0.14), rand(-0.14, 0.14), rand(-0.14, 0.14)], 6));
    const trail = []; for (let i = 0; i < 6; i++) { const tr = _sph(0.12 - i * 0.015, tglow(c, 1.4, 0.6), [0, 0, 0], 8); rock.add(tr); trail.push({ m: tr, i }); }
    g.add(rock);
    const impact = _tor(0.2, 0.04, tglow(c, 1.6, 0), [0, 0.04, 0], 6, 28); impact.rotation.x = Math.PI / 2; g.add(impact);
    let phase = rand(0, 1);
    g.userData.tick = (dt) => { phase += dt * o.speed; if (phase > 1) phase -= 1; if (phase < 0.7) { const y = o.height * (1 - phase / 0.7); rock.visible = true; rock.position.set(0, y, 0); trail.forEach((tr) => { tr.m.position.y = (tr.i + 1) * 0.13; tr.m.material.opacity = 0.6 * (1 - tr.i / 6) * (1 - phase / 0.7 + 0.3); }); impact.material.opacity = 0; } else { rock.visible = false; const p = (phase - 0.7) / 0.3; impact.scale.setScalar(0.5 + p * (o.radius / 0.2)); impact.material.opacity = 0.8 * (1 - p); } heat.emissiveIntensity = 1.4 + Math.random() * 0.6; };
    return g;
  }, { icon: "☄", category: "wizard magic", params: [
    { key: "height", label: "Fall Height", type: "number", min: 1.5, max: 5, step: 0.1, default: 3 },
    { key: "radius", label: "Impact Radius", type: "number", min: 0.4, max: 2, step: 0.1, default: 1 },
    { key: "speed", label: "Cycle Speed", type: "number", min: 0.1, max: 1, step: 0.05, default: 0.4 },
    { key: "color", label: "Fire", type: "color", default: 0xff6a2a }] });

  // ════════════════════════════════════════════════════════════
  //  WALLS & BARRIERS
  // ════════════════════════════════════════════════════════════

  register("fire_wall", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xff6a1a);
    g.add(_box(o.width, 0.04, 0.3, M.stone(0x2a2018), [0, 0.02, 0])); // scorched base
    const flames = []; const n = Math.round(o.width / 0.18);
    for (let i = 0; i < n; i++) { const x = -o.width / 2 + (i + 0.5) * (o.width / n); const fl = _cone(rand(0.07, 0.12), rand(0.4, 0.8), glow(pick([0xff5a1a, 0xff8a2a, 0xffc24a]), 1.5), [x, 0.3, rand(-0.06, 0.06)], 6); g.add(fl); flames.push({ m: fl, ph: rand(0, 6), h0: fl.scale.y }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; flames.forEach((f) => { f.m.scale.y = 1 + Math.sin(t * 7 + f.ph) * 0.35; f.m.material.emissiveIntensity = 1.3 + Math.sin(t * 9 + f.ph) * 0.5; f.m.position.x += Math.sin(t * 4 + f.ph) * dt * 0.03; }); };
    return g;
  }, { icon: "🔥", category: "wizard magic", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 5, step: 0.5, default: 2.5 },
    { key: "color", label: "Flame", type: "color", default: 0xff6a1a }] });

  register("frost_wall", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x9ad8ff);
    g.add(_box(o.width, 0.04, 0.3, M.stone(0x6a7a82), [0, 0.02, 0]));
    const mat = tglow(c, 0.8, 0.6);
    const n = Math.round(o.width / 0.22);
    for (let i = 0; i < n; i++) { const x = -o.width / 2 + (i + 0.5) * (o.width / n); const h = rand(0.5, 1.0); const sp = _cone(rand(0.08, 0.14), h, mat, [x, h / 2 + 0.02, rand(-0.05, 0.05)], 5); sp.rotation.z = rand(-0.12, 0.12); g.add(sp); const sp2 = _cone(rand(0.05, 0.09), h * 0.6, mat, [x + rand(-0.08, 0.08), h * 0.3, rand(-0.08, 0.08)], 5); g.add(sp2); }
    const sheen = []; g.children.forEach((ch) => { if (ch.geometry && ch.geometry.type === 'ConeGeometry') sheen.push(ch); });
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; mat.emissiveIntensity = 0.6 + (Math.sin(t * 1.5) + 1) / 2 * 0.4; };
    return g;
  }, { icon: "❄", category: "wizard magic", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 5, step: 0.5, default: 2.5 },
    { key: "color", label: "Ice", type: "color", default: 0x9ad8ff }] });

  register("ward_sphere", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x4aa0ff);
    const shellM = tglow(c, 0.7, 0.22);
    const dome = _sph(o.radius, shellM, [0, o.radius * 0.1, 0], 20); g.add(dome);
    const latM = glow(c, 1.0);
    for (let i = 0; i < 6; i++) { const ring = _tor(o.radius * 0.99, 0.01, latM, [0, o.radius * 0.1, 0], 5, 30); ring.rotation.y = i / 6 * Math.PI; ring.rotation.x = Math.PI / 2; g.add(ring); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const pulse = (Math.sin(t * 1.6) + 1) / 2; shellM.opacity = 0.14 + pulse * 0.16; latM.emissiveIntensity = 0.7 + pulse * 0.6; dome.scale.setScalar(1 + Math.sin(t * 2) * 0.015); };
    return g;
  }, { icon: "🛡", category: "wizard magic", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.5, max: 2, step: 0.1, default: 1.1 },
    { key: "color", label: "Ward", type: "color", default: 0x4aa0ff }] });

  // ════════════════════════════════════════════════════════════
  //  ELEMENTAL SUMMONS  (generic atronach-style)
  // ════════════════════════════════════════════════════════════

  function elementalBody(mat) {
    const e = new THREE.Group();
    const torso = _sph(0.22, mat, [0, 0.9, 0], 10); torso.scale.set(1, 1.3, 0.8); e.add(torso);
    e.add(_sph(0.13, mat, [0, 1.3, 0], 10));                       // head
    for (const sx of [-1, 1]) { const arm = _cyl(0.07, 0.04, 0.5, mat, [sx * 0.26, 0.9, 0], 6); arm.rotation.z = sx * 0.4; e.add(arm); }
    for (const sx of [-1, 1]) { const leg = _cyl(0.08, 0.05, 0.5, mat, [sx * 0.12, 0.32, 0], 6); e.add(leg); }
    return e;
  }

  register("flame_elemental", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xff5a1a);
    const m = glow(c, 1.5); const e = elementalBody(m); g.add(e);
    const fl = []; for (let i = 0; i < 8; i++) { const f = _cone(rand(0.04, 0.08), rand(0.15, 0.3), glow(pick([0xff7a1a, 0xffb030]), 1.6), [rand(-0.2, 0.2), rand(0.5, 1.4), rand(-0.15, 0.15)], 5); g.add(f); fl.push({ m: f, ph: rand(0, 6) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; m.emissiveIntensity = 1.3 + Math.sin(t * 6) * 0.4; e.position.y = Math.sin(t * 1.4) * 0.03; fl.forEach((f) => { f.m.scale.y = 1 + Math.sin(t * 8 + f.ph) * 0.4; f.m.material.emissiveIntensity = 1.4 + Math.sin(t * 10 + f.ph) * 0.5; }); };
    return g;
  }, { icon: "🔥", category: "wizard magic", params: [{ key: "color", label: "Flame", type: "color", default: 0xff5a1a }] });

  register("frost_elemental", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x8ad0ff);
    const m = tglow(c, 1.0, 0.85); const e = elementalBody(m); g.add(e);
    const sh = []; for (let i = 0; i < 7; i++) { const a = rand(0, 6.28); const s = _cone(0.03, rand(0.12, 0.22), tglow(c, 1.1, 0.8), [Math.cos(a) * 0.24, rand(0.6, 1.3), Math.sin(a) * 0.18], 4); s.rotation.z = Math.cos(a) * 0.8; s.rotation.x = Math.sin(a) * 0.8; g.add(s); sh.push({ m: s, ph: rand(0, 6) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; m.emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.3; e.position.y = Math.sin(t * 1.1) * 0.02; sh.forEach((s) => { s.m.material.emissiveIntensity = 0.9 + Math.sin(t * 4 + s.ph) * 0.4; }); };
    return g;
  }, { icon: "❄", category: "wizard magic", params: [{ key: "color", label: "Ice", type: "color", default: 0x8ad0ff }] });

  register("storm_elemental", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xffe24a);
    const m = tglow(c, 1.2, 0.7); const e = elementalBody(m); g.add(e);
    const arcs = []; for (let i = 0; i < 8; i++) { const a = _box(0.012, rand(0.2, 0.35), 0.012, glow(c, 1.7), [rand(-0.25, 0.25), rand(0.5, 1.4), rand(-0.15, 0.15)]); a.rotation.z = rand(-1, 1); g.add(a); arcs.push(a); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; m.emissiveIntensity = 1.0 + Math.random() * 0.5; e.position.y = Math.sin(t * 1.6) * 0.03; arcs.forEach((a) => { a.visible = Math.random() > 0.4; a.rotation.z = rand(-1.2, 1.2); }); };
    return g;
  }, { icon: "⚡", category: "wizard magic", params: [{ key: "color", label: "Spark", type: "color", default: 0xffe24a }] });

  // ════════════════════════════════════════════════════════════
  //  CASTING ARTIFACTS
  // ════════════════════════════════════════════════════════════

  register("shout_wave", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x4a4640)), c = _c(o.glow, 0x6ad0ff);
    const words = [];
    for (let i = 0; i < 3; i++) { const z = (i - 1) * 0.5; const w = new THREE.Group(); for (let j = 0; j < 4; j++) { const mark = _box(rand(0.04, 0.1), 0.04, 0.02, glow(c, 1.2), [rand(-0.18, 0.18), 0.02, rand(-0.1, 0.1)]); mark.rotation.y = rand(0, 3); w.add(mark); } w.add(_box(0.5, 0.03, 0.02, st, [0, 0.01, 0])); w.position.set(0.6, 0.02, z); g.add(w); words.push(w); }
    const rings = []; for (let i = 0; i < 3; i++) { const rg = _tor(0.1, 0.025, tglow(c, 1.4, 0.7), [0.3, 0.3, 0], 5, 24); rg.rotation.y = Math.PI / 2; g.add(rg); rings.push({ m: rg, off: i / 3 }); }
    let t = rand(0, 6), phase = rand(0, 1);
    g.userData.tick = (dt) => { t += dt; phase += dt * o.speed; if (phase > 1) phase -= 1; words.forEach((w, i) => { w.children.forEach((ch) => { if (ch.material && ch.material.emissive) ch.material.emissiveIntensity = 1.0 + (Math.sin(t * 3 - i) + 1) / 2 * 0.8; }); }); rings.forEach((r) => { let p = (phase + r.off) % 1; const sc = 0.1 + p * o.reach; r.m.scale.set(sc / 0.1, sc / 0.1, 1); r.m.position.x = 0.3 - p * o.reach * 0.6; r.m.material.opacity = 0.7 * (1 - p); }); };
    return g;
  }, { icon: "🗯", category: "wizard magic", params: [
    { key: "reach", label: "Wave Reach", type: "number", min: 0.5, max: 3, step: 0.1, default: 1.6 },
    { key: "speed", label: "Cycle Speed", type: "number", min: 0.1, max: 1.2, step: 0.05, default: 0.5 },
    { key: "color", label: "Stone", type: "color", default: 0x4a4640 },
    { key: "glow", label: "Thu'um", type: "color", default: 0x6ad0ff }] });

  register("spell_charge_circle", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x6a8aff);
    const ringM = glow(c, 1.3);
    const r1 = _tor(o.size, 0.02, ringM, [0, 0.02, 0], 6, 36); r1.rotation.x = Math.PI / 2; g.add(r1);
    const spokes = new THREE.Group();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; const sp = _box(0.03, 0.006, o.size, glow(c, 1.2), [0, 0.02, 0]); sp.position.set(Math.cos(a) * o.size * 0.5, 0.02, Math.sin(a) * o.size * 0.5); sp.rotation.y = -a; spokes.add(sp); }
    g.add(spokes);
    // particles spiraling inward toward center then resetting (a "charge")
    const parts = []; for (let i = 0; i < Math.round(o.count); i++) { const p = _sph(0.025, tglow(c, 1.5, 0.8), [0, 0.05, 0], 6); p.userData._o0 = 0.8; g.add(p); parts.push({ m: p, a: rand(0, 6.28), ph: rand(0, 1) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; spokes.rotation.y += dt * 0.5; ringM.emissiveIntensity = 1.0 + (Math.sin(t * 2) + 1) / 2 * 0.6; parts.forEach((p) => { p.ph += dt * o.speed; if (p.ph > 1) { p.ph = 0; p.a = rand(0, 6.28); } const r = (1 - p.ph) * o.size; const spiral = p.a + p.ph * 6; p.m.position.set(Math.cos(spiral) * r, 0.05 + p.ph * 0.3, Math.sin(spiral) * r); p.m.material.opacity = 0.8 * p.ph; }); };
    return g;
  }, { icon: "🌀", category: "wizard magic", params: [
    { key: "color", label: "Color", type: "color", default: 0x6a8aff },
    { key: "size", label: "Radius", type: "number", min: 0.3, max: 1.5, step: 0.05, default: 0.7 },
    { key: "count", label: "Particles", type: "int", min: 4, max: 24, default: 12 },
    { key: "speed", label: "Charge Speed", type: "number", min: 0.2, max: 2, step: 0.05, default: 0.8 }] });

  register("will_o_wisp", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x6affc0);
    const wispGrp = new THREE.Group();
    const coreM = glow(c, 1.8); const core = _sph(o.size, coreM, [0, 0, 0], 10); wispGrp.add(core);
    const halo = _sph(o.size * 2.2, tglow(c, 1.0, 0.3), [0, 0, 0], 10); halo.userData._o0 = 0.3; wispGrp.add(halo);
    const tails = []; for (let k = 0; k < 5; k++) { const tr = _sph(o.size * (0.7 - k * 0.12), tglow(c, 1.3, 0.5 - k * 0.08), [0, 0, 0], 6); wispGrp.add(tr); tails.push(tr); }
    wispGrp.position.y = o.height; g.add(wispGrp);
    const path = []; let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const x = Math.sin(t * 0.7) * o.radius + Math.sin(t * 1.9) * o.radius * 0.3; const z = Math.cos(t * 0.5) * o.radius + Math.cos(t * 1.3) * o.radius * 0.3; const y = o.height + Math.sin(t * 1.1) * 0.2; path.unshift([x, y, z]); if (path.length > 30) path.pop(); core.position.set(x, y, z); halo.position.set(x, y, z); coreM.emissiveIntensity = 1.5 + Math.sin(t * 5) * 0.4; tails.forEach((tr, k) => { const p = path[(k + 1) * 5] || path[path.length - 1]; if (p) tr.position.set(p[0], p[1], p[2]); }); };
    return g;
  }, { icon: "🟢", category: "wizard magic", params: [
    { key: "color", label: "Color", type: "color", default: 0x6affc0 },
    { key: "size", label: "Size", type: "number", min: 0.03, max: 0.16, step: 0.01, default: 0.06 },
    { key: "radius", label: "Wander Radius", type: "number", min: 0.3, max: 2, step: 0.1, default: 0.8 },
    { key: "height", label: "Height", type: "number", min: 0.3, max: 2.5, step: 0.1, default: 1.3 }] });

  // ════════════════════════════════════════════════════════════
  //  RAINING / FIELD EFFECTS
  // ════════════════════════════════════════════════════════════

  register("meteor_rain", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xff6a2a);
    const drops = []; const n = Math.round(o.count);
    for (let i = 0; i < n; i++) {
      const d = new THREE.Group();
      const rock = _sph(o.size, glow(c, 1.6), [0, 0, 0], 8); d.add(rock);
      const trail = _cone(o.size * 0.8, o.size * 5, tglow(c, 1.4, 0.5), [0, o.size * 3, 0], 6); trail.userData._o0 = 0.5; d.add(trail);
      d.position.set(rand(-o.spread, o.spread), 0, rand(-o.spread, o.spread));
      g.add(d); drops.push({ d, ph: rand(0, 1), x: d.position.x, z: d.position.z });
    }
    g.userData.tick = (dt) => { drops.forEach((dr) => { dr.ph += dt * o.speed; if (dr.ph > 1) { dr.ph = 0; dr.x = rand(-o.spread, o.spread); dr.z = rand(-o.spread, o.spread); dr.d.position.x = dr.x; dr.d.position.z = dr.z; } dr.d.position.y = o.height * (1 - dr.ph); }); };
    return g;
  }, { icon: "☄", category: "wizard magic", params: [
    { key: "color", label: "Color", type: "color", default: 0xff6a2a },
    { key: "size", label: "Size", type: "number", min: 0.03, max: 0.18, step: 0.01, default: 0.07 },
    { key: "spread", label: "Spread", type: "number", min: 0.5, max: 3, step: 0.1, default: 1.5 },
    { key: "height", label: "Fall Height", type: "number", min: 1, max: 4, step: 0.1, default: 2.5 },
    { key: "count", label: "Count", type: "int", min: 3, max: 20, default: 8 },
    { key: "speed", label: "Speed", type: "number", min: 0.2, max: 2, step: 0.05, default: 0.7 }] });

  register("rising_embers", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xff8a2a);
    const embers = []; const n = Math.round(o.count);
    for (let i = 0; i < n; i++) { const e = _sph(o.size, tglow(c, 1.5, 0.8), [rand(-o.spread, o.spread), 0, rand(-o.spread, o.spread)], 6); e.userData._o0 = 0.8; g.add(e); embers.push({ m: e, ph: rand(0, 1), x: e.position.x, z: e.position.z, drift: rand(-0.2, 0.2) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; embers.forEach((em) => { em.ph += dt * o.speed; if (em.ph > 1) { em.ph = 0; em.x = rand(-o.spread, o.spread); em.z = rand(-o.spread, o.spread); } em.m.position.set(em.x + Math.sin(t + em.ph * 6) * em.drift, em.ph * o.height, em.z); em.m.material.opacity = 0.8 * (1 - em.ph); em.m.scale.setScalar(1 - em.ph * 0.5); }); };
    return g;
  }, { icon: "✨", category: "wizard magic", params: [
    { key: "color", label: "Color", type: "color", default: 0xff8a2a },
    { key: "size", label: "Size", type: "number", min: 0.01, max: 0.08, step: 0.005, default: 0.03 },
    { key: "spread", label: "Spread", type: "number", min: 0.3, max: 2.5, step: 0.1, default: 1 },
    { key: "height", label: "Rise Height", type: "number", min: 0.5, max: 3, step: 0.1, default: 1.8 },
    { key: "count", label: "Count", type: "int", min: 5, max: 40, default: 18 },
    { key: "speed", label: "Speed", type: "number", min: 0.1, max: 1.2, step: 0.05, default: 0.4 }] });
})();
