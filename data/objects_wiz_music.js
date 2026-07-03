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

  register("ghost_piano", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x2a1a14)); const W = 1.2, H = 1.0, D = 0.45;
    g.add(_box(W, H, D, wd, [0, H / 2, 0]));
    g.add(_box(W, 0.35, D * 0.6, wd, [0, H * 0.55, D * 0.2]));
    g.add(_box(W * 0.9, 0.04, 0.18, M.plaster(0xf0ece0), [0, H * 0.55, D * 0.4]));
    for (let i = 0; i < 14; i++) { const x = -W * 0.42 + i * (W * 0.84 / 13); g.add(_box(0.025, 0.05, 0.1, M.metal(0x222018), [x, H * 0.57, D * 0.4])); }
    for (const sx of [-1, 1]) { g.add(_cyl(0.02, 0.02, 0.12, M.brass(), [sx * 0.4, H + 0.06, 0], 6)); g.add(_cone(0.025, 0.06, glow(_c(o.glow, 0x8ad6ff), 1.8), [sx * 0.4, H + 0.15, 0], 6)); }
    for (const sx of [-1, 1]) g.add(_box(0.08, 0.2, D, wd, [sx * (W / 2 - 0.06), 0.1, 0]));
    return g;
  }, { icon: "🎹", category: "wizard music", params: [
    { key: "color", label: "Wood", type: "color", default: 0x2a1a14 },
    { key: "glow", label: "Spirit", type: "color", default: 0x8ad6ff }] });

  register("harpsichord", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)), ivory = M.bone(0xf0e8d8), ebony = M.metal(0x1a1410);
    g.add(_box(0.6, 0.12, 1.6, wd, [0, 0.78, 0]));        // case (wing shape approx)
    g.add(_box(0.4, 0.12, 0.9, wd, [0.25, 0.78, 0.3]));
    g.add(_box(0.56, 0.04, 0.18, ivory, [0, 0.86, -0.6])); // keyboard
    for (let i = 0; i < 12; i++) g.add(_box(0.02, 0.05, 0.1, ebony, [-0.24 + i * 0.045, 0.89, -0.62]));
    const lid = _box(0.6, 0.03, 1.5, wd, [0, 0.86, 0.05]); lid.rotation.z = -0.5; lid.position.set(-0.3, 1.1, 0.05); g.add(lid);
    for (const [x, z] of [[-0.25, 0.7], [0.25, 0.7], [-0.25, -0.7], [0.25, -0.7]]) g.add(_cyl(0.04, 0.05, 0.72, wd, [x, 0.36, z], 6));
    return g;
  }, { icon: "🎹", category: "wizard music", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("self_playing_violin", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x7a3a1a)), m = M.metal(0x2a2520);
    g.add(_cyl(0.04, 0.05, 0.9, m, [0, 0.45, 0], 8));     // floating stand
    g.add(_cyl(0.14, 0.16, 0.03, m, [0, 0.015, 0], 12));
    const vio = new THREE.Group();
    vio.add(_sph(0.1, wd, [0, 0, 0], 12)); vio.children[0].scale.set(0.8, 1.4, 0.4);
    vio.add(_box(0.04, 0.4, 0.03, wd, [0, 0.28, 0]));     // neck
    vio.add(_box(0.06, 0.06, 0.04, M.metal(0x1a1410), [0, 0.5, 0])); // scroll
    vio.position.set(0, 1.1, 0); vio.rotation.z = 0.5; g.add(vio);
    const bow = new THREE.Group();
    bow.add(_box(0.4, 0.01, 0.01, M.wood(0x2a1a10), [0, 0, 0]));
    bow.add(_box(0.4, 0.005, 0.02, M.bone(0xeee0c0), [0, -0.012, 0]));
    bow.position.set(0, 1.12, 0.1); g.add(bow);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; bow.position.x = Math.sin(t * 4) * 0.12; bow.rotation.z = 0.4 + Math.sin(t * 4) * 0.06; vio.rotation.y = Math.sin(t * 0.8) * 0.1; };
    return g;
  }, { icon: "🎻", category: "wizard music", params: [
    { key: "color", label: "Wood", type: "color", default: 0x7a3a1a }] });

  register("chime_set", function (o) {
    const g = new THREE.Group(); const fr = M.wood(_c(o.color, 0x4a3018)), br = M.brass(0xc8a050);
    g.add(_box(0.04, 0.6, 0.04, fr, [-0.3, 0.3, 0])); g.add(_box(0.04, 0.6, 0.04, fr, [0.3, 0.3, 0]));
    g.add(_box(0.68, 0.04, 0.04, fr, [0, 0.62, 0]));
    const chimes = [];
    for (let i = 0; i < 5; i++) { const x = -0.24 + i * 0.12; const len = 0.4 - i * 0.05; const c = new THREE.Group(); c.add(_cyl(0.012, 0.012, len, br, [0, -len / 2, 0], 8)); c.position.set(x, 0.6, 0); g.add(c); chimes.push({ c, ph: i * 0.7 }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; chimes.forEach((ch) => { ch.c.rotation.z = Math.sin(t * 1.5 + ch.ph) * 0.08; }); };
    return g;
  }, { icon: "🎐", category: "wizard music", params: [
    { key: "color", label: "Frame", type: "color", default: 0x4a3018 }] });

  register("wheezy_organ", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)), br = M.brass(0xc8a050);
    g.add(_box(1.2, 0.6, 0.5, wd, [0, 0.3, 0]));          // base console
    g.add(_box(1.1, 0.06, 0.22, M.bone(0xf0e8d8), [0, 0.62, 0.18])); // keys
    const pipes = [];
    for (let i = 0; i < 11; i++) { const h = 0.4 + Math.abs(5 - i) * 0.12; const x = -0.5 + i * 0.1; const p = _cyl(0.035, 0.035, h, br, [x, 0.6 + h / 2 + 0.1, -0.15], 10); g.add(p); g.add(_cone(0.035, 0.05, br, [x, 0.6 + h + 0.13, -0.15], 8)); pipes.push({ p, base: 0.6 + h / 2 + 0.1, h }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; pipes.forEach((pp, i) => { const w = 1 + Math.sin(t * 3 + i) * 0.02; pp.p.scale.y = w; }); };
    return g;
  }, { icon: "🎵", category: "wizard music", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  // ════════════════════════════════════════════════════════════
  //  SURFACE VARIANTS  (geometry only — NOT image textures)
  // ════════════════════════════════════════════════════════════
})();
