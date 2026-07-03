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

  register("animated_armor", function (o) {
    const g = new THREE.Group(); const mt = M.metal(_c(o.color, 0x8a8a92));
    for (const sx of [-1, 1]) { g.add(_box(0.14, 0.5, 0.16, mt, [sx * 0.12, 0.25, 0])); g.add(_box(0.16, 0.1, 0.22, mt, [sx * 0.12, 0.05, 0.03])); }
    g.add(_box(0.4, 0.18, 0.22, mt, [0, 0.55, 0]));
    g.add(_cyl(0.22, 0.26, 0.5, mt, [0, 0.85, 0], 10));
    g.add(_box(0.46, 0.16, 0.28, mt, [0, 1.0, 0]));
    for (const sx of [-1, 1]) { g.add(_cyl(0.06, 0.07, 0.5, mt, [sx * 0.26, 0.8, 0], 8)); g.add(_box(0.1, 0.12, 0.1, mt, [sx * 0.26, 0.52, 0.02])); }
    g.add(_cyl(0.06, 0.07, 0.08, mt, [0, 1.12, 0], 8));
    g.add(_box(0.18, 0.22, 0.2, mt, [0, 1.25, 0]));
    g.add(_box(0.16, 0.04, 0.04, glow(_c(o.glow, 0x6ad6ff), 1.0), [0, 1.25, 0.1]));
    g.add(_cone(0.04, 0.16, M.cloth(0x6a1a1a), [0, 1.42, 0], 6));
    g.add(_cyl(0.02, 0.02, 1.6, M.wood(0x3a2414), [0.34, 0.85, 0], 6));
    g.add(_cone(0.04, 0.18, mt, [0.34, 1.7, 0], 6));
    return g;
  }, { icon: "♞", category: "wizard creatures", params: [
    { key: "color", label: "Metal", type: "color", default: 0x8a8a92 },
    { key: "glow", label: "Visor", type: "color", default: 0x6ad6ff }] });

  register("stone_dragon", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x4a5048)); const b = 0.15;
    g.add(_box(0.6, 0.15, 0.6, st, [0, 0.075, 0]));
    const body = _tor(0.22, 0.1, st, [0, b + 0.18, 0], 6, 16); body.rotation.x = Math.PI / 2; g.add(body);
    const neck = _cyl(0.07, 0.1, 0.4, st, [0.1, b + 0.4, 0.1], 8); neck.rotation.x = -0.4; g.add(neck);
    g.add(_sph(0.1, st, [0.18, b + 0.6, 0.2], 10));
    const snout = _cone(0.06, 0.16, st, [0.18, b + 0.58, 0.32], 6); snout.rotation.x = Math.PI / 2; g.add(snout);
    for (const sx of [-1, 1]) { const hn = _cone(0.025, 0.1, st, [0.18 + sx * 0.05, b + 0.7, 0.16], 5); hn.rotation.x = -0.5; g.add(hn); }
    for (const sx of [-1, 1]) { const wg = _box(0.04, 0.35, 0.25, st, [sx * 0.15, b + 0.4, -0.1]); wg.rotation.z = sx * 0.4; wg.rotation.x = 0.3; g.add(wg); }
    const tail = _cone(0.08, 0.4, st, [-0.2, b + 0.15, -0.2], 6); tail.rotation.z = Math.PI / 2; tail.rotation.y = 0.6; g.add(tail);
    for (const sx of [-1, 1]) g.add(_sph(0.018, glow(_c(o.eyes, 0xff6a2a), 1.4), [0.18 + sx * 0.04, b + 0.62, 0.28], 6));
    return g;
  }, { icon: "ᘐ", category: "wizard creatures", params: [
    { key: "color", label: "Stone", type: "color", default: 0x4a5048 },
    { key: "eyes", label: "Eyes", type: "color", default: 0xff6a2a }] });

  register("stone_griffin", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6258)); const b = 0.15;
    g.add(_box(0.55, 0.15, 0.6, st, [0, 0.075, 0]));
    g.add(_sph(0.2, st, [0, b + 0.22, -0.05], 12));
    for (const sx of [-1, 1]) g.add(_cyl(0.06, 0.07, 0.3, st, [sx * 0.12, b + 0.15, 0.18], 6));
    g.add(_box(0.3, 0.06, 0.1, st, [0, b + 0.02, 0.22]));
    for (const sx of [-1, 1]) g.add(_sph(0.12, st, [sx * 0.15, b + 0.12, -0.18], 10));
    g.add(_cyl(0.12, 0.16, 0.3, st, [0, b + 0.42, 0.05], 8));
    g.add(_sph(0.1, st, [0, b + 0.62, 0.12], 10));
    const beak = _cone(0.05, 0.14, M.brass(0xc8a050), [0, b + 0.6, 0.24], 6); beak.rotation.x = Math.PI / 2; g.add(beak);
    for (const sx of [-1, 1]) g.add(_cone(0.02, 0.08, st, [sx * 0.05, b + 0.72, 0.1], 5));
    for (const sx of [-1, 1]) { const wg = _box(0.05, 0.4, 0.22, st, [sx * 0.16, b + 0.45, -0.05]); wg.rotation.z = sx * 0.5; g.add(wg); }
    for (const sx of [-1, 1]) g.add(_sph(0.015, glow(_c(o.eyes, 0xffd24a), 1.2), [sx * 0.04, b + 0.64, 0.2], 6));
    return g;
  }, { icon: "ᘀ", category: "wizard creatures", params: [
    { key: "color", label: "Stone", type: "color", default: 0x6a6258 },
    { key: "eyes", label: "Eyes", type: "color", default: 0xffd24a }] });

  register("serpent_pillar", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x4a5a48)); const h = o.height;
    g.add(_box(0.4, 0.15, 0.4, st, [0, 0.075, 0]));
    g.add(_cyl(0.1, 0.12, h, st, [0, h / 2 + 0.15, 0], 10));
    const coils = Math.floor(h / 0.35);
    for (let i = 0; i < coils; i++) { const y = 0.3 + i * 0.35; const t = _tor(0.16, 0.05, M.stone(0x5a6a52), [0, y, 0], 6, 16); t.rotation.x = Math.PI / 2.2; t.rotation.z = i * 0.4; g.add(t); }
    g.add(_sph(0.1, st, [0.12, h + 0.05, 0.05], 10));
    const sn = _cone(0.05, 0.14, st, [0.2, h + 0.02, 0.12], 6); sn.rotation.z = -Math.PI / 2.5; g.add(sn);
    for (const sx of [-1, 1]) g.add(_sph(0.018, glow(_c(o.eyes, 0x6ad62a), 1.2), [0.14, h + 0.08, 0.02 + sx * 0.04], 6));
    return g;
  }, { icon: "ᔓ", category: "wizard creatures", params: [
    { key: "color", label: "Stone", type: "color", default: 0x4a5a48 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 3.5, step: 0.1, default: 2.2 },
    { key: "eyes", label: "Eyes", type: "color", default: 0x6ad62a }] });

  register("stone_owl", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6660)); const b = 0.3;
    g.add(_cyl(0.18, 0.22, 0.3, st, [0, 0.15, 0], 10));
    const body = _sph(0.16, st, [0, b + 0.16, 0], 12); body.scale.y = 1.2; g.add(body);
    g.add(_sph(0.13, st, [0, b + 0.36, 0], 12));
    for (const sx of [-1, 1]) g.add(_cone(0.03, 0.1, st, [sx * 0.07, b + 0.46, 0], 5));
    for (const sx of [-1, 1]) { const e = _cyl(0.04, 0.04, 0.02, M.bone(), [sx * 0.05, b + 0.37, 0.1], 10); e.rotation.x = Math.PI / 2; g.add(e); g.add(_sph(0.02, glow(_c(o.eyes, 0xffc83a), 1.0), [sx * 0.05, b + 0.37, 0.12], 8)); }
    g.add(_cone(0.025, 0.06, M.brass(0xc8a050), [0, b + 0.33, 0.12], 5));
    for (const sx of [-1, 1]) g.add(_box(0.04, 0.22, 0.12, st, [sx * 0.13, b + 0.14, 0]));
    return g;
  }, { icon: "ᙾ", category: "wizard creatures", params: [
    { key: "color", label: "Stone", type: "color", default: 0x6a6660 },
    { key: "eyes", label: "Eyes", type: "color", default: 0xffc83a }] });

  register("familiar_toad", function (o) {
    const g = new THREE.Group(); const b = 0.09;
    g.add(_box(0.3, 0.06, 0.22, M.book(0x3a2a5a), [0, 0.03, 0]));
    g.add(_box(0.28, 0.04, 0.2, M.plaster(0xe8dcc0), [0, 0.065, 0]));
    const sk = M.leaf(_c(o.color, 0x5a7a3a));
    const body = _sph(0.14, sk, [0, b + 0.1, 0], 12); body.scale.set(1.2, 0.8, 1.1); g.add(body);
    g.add(_sph(0.08, sk, [0, b + 0.14, 0.1], 10));
    for (const sx of [-1, 1]) { g.add(_sph(0.04, sk, [sx * 0.06, b + 0.2, 0.06], 8)); g.add(_sph(0.025, glow(_c(o.eyes, 0xd6b020), 0.8), [sx * 0.06, b + 0.21, 0.09], 6)); }
    for (const sx of [-1, 1]) g.add(_sph(0.05, sk, [sx * 0.13, b + 0.04, 0.06], 8));
    return g;
  }, { icon: "ᕗ", category: "wizard creatures", params: [
    { key: "color", label: "Skin", type: "color", default: 0x5a7a3a },
    { key: "eyes", label: "Eyes", type: "color", default: 0xd6b020 }] });

  // ═══ ODDS & ENDS ═════════════════════════════════════════════

  register("stone_phoenix", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x7a6a5a)); const b = 0.2;
    g.add(_box(0.4, 0.2, 0.4, st, [0, 0.1, 0]));
    const body = _sph(0.14, st, [0, b + 0.25, 0], 12); body.scale.y = 1.3; g.add(body);
    g.add(_sph(0.09, st, [0, b + 0.5, 0.04], 10));
    const beak = _cone(0.03, 0.1, M.brass(0xd6a040), [0, b + 0.5, 0.14], 6); beak.rotation.x = Math.PI / 2; g.add(beak);
    for (const sx of [-1, 1]) { const wing = _box(0.05, 0.5, 0.22, st, [sx * 0.22, b + 0.4, -0.02]); wing.rotation.z = sx * 0.7; wing.rotation.y = sx * 0.3; g.add(wing); }
    const fm = glow(_c(o.flame, 0xff7a2a), 1.2);
    for (let i = 0; i < 3; i++) { const c = _cone(0.04, 0.3, fm, [0, b + 0.15, -0.18 - i * 0.02], 6); c.rotation.x = -2.2; g.add(c); }
    return g;
  }, { icon: "🔥", category: "wizard creatures", params: [
    { key: "color", label: "Stone", type: "color", default: 0x7a6a5a },
    { key: "flame", label: "Tail", type: "color", default: 0xff7a2a }] });

  register("coiled_serpent", function (o) {
    const g = new THREE.Group(); const sk = M.leaf(_c(o.color, 0x2a5a3a));
    // coil body as stacked tori shrinking upward
    for (let i = 0; i < 4; i++) { const r = 0.32 - i * 0.06; const coil = _tor(r, 0.06 - i * 0.008, sk, [0, 0.07 + i * 0.1, 0], 8, 20); coil.rotation.x = Math.PI / 2; g.add(coil); }
    const neck = new THREE.Group();
    let y = 0; for (let i = 0; i < 4; i++) { const s = _sph(0.06 - i * 0.008, sk, [0, y, 0], 8); neck.add(s); y += 0.07; }
    const head = new THREE.Group();
    head.add(_sph(0.07, sk, [0, 0, 0], 10)); head.children[0].scale.set(1, 0.8, 1.4);
    head.add(_sph(0.012, glow(0xffcc33, 0.8), [-0.03, 0.02, 0.05], 6)); head.add(_sph(0.012, glow(0xffcc33, 0.8), [0.03, 0.02, 0.05], 6));
    const tongue = _box(0.004, 0.004, 0.08, glow(0xd23a5a, 0.6), [0, -0.01, 0.1]); head.add(tongue);
    head.position.set(0, y, 0); neck.add(head);
    neck.position.set(0, 0.4, 0); g.add(neck);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; neck.rotation.y = Math.sin(t * 0.8) * 0.5; neck.rotation.x = Math.sin(t * 0.6) * 0.15; head.rotation.y = Math.sin(t * 1.4) * 0.3; tongue.scale.z = 1 + Math.sin(t * 10) * 0.6; };
    return g;
  }, { icon: "🐍", category: "wizard creatures", params: [
    { key: "color", label: "Scales", type: "color", default: 0x2a5a3a }] });

  register("familiar_cat", function (o) {
    const g = new THREE.Group(); const fur = M.cloth(_c(o.color, 0x2a2a2e));
    const body = _sph(0.13, fur, [0, 0.13, 0], 12); body.scale.set(1, 1.1, 1.2); g.add(body);
    g.add(_sph(0.09, fur, [0, 0.32, 0.04], 12));
    for (const sx of [-1, 1]) g.add(_cone(0.03, 0.07, fur, [sx * 0.05, 0.42, 0.04], 4));
    for (const sx of [-1, 1]) g.add(_sph(0.018, glow(_c(o.eyes, 0x6ad67a), 1.2), [sx * 0.035, 0.33, 0.12], 6));
    const tail = _cyl(0.03, 0.02, 0.3, fur, [0, 0.12, -0.12], 6); tail.rotation.x = -0.8; g.add(tail);
    for (const sx of [-1, 1]) g.add(_cyl(0.03, 0.03, 0.12, fur, [sx * 0.06, 0.06, 0.12], 6));
    return g;
  }, { icon: "🐈", category: "wizard creatures", params: [
    { key: "color", label: "Fur", type: "color", default: 0x2a2a2e },
    { key: "eyes", label: "Eyes", type: "color", default: 0x6ad67a }] });

  register("familiar_raven", function (o) {
    const g = new THREE.Group(); const ft = M.cloth(_c(o.color, 0x18181c)), wd = M.wood(0x3a2414);
    g.add(_cyl(0.15, 0.18, 0.04, wd, [0, 0.02, 0], 12));
    g.add(_cyl(0.025, 0.025, 0.5, wd, [0, 0.27, 0], 8));
    const body = _sph(0.1, ft, [0, 0.58, 0], 12); body.scale.set(1, 1.1, 1.4); g.add(body);
    g.add(_sph(0.07, ft, [0, 0.7, 0.06], 10));
    const beak = _cone(0.025, 0.08, M.metal(0x3a352e), [0, 0.7, 0.16], 5); beak.rotation.x = Math.PI / 2; g.add(beak);
    for (const sx of [-1, 1]) g.add(_sph(0.015, glow(_c(o.eyes, 0x8ad6ff), 1.2), [sx * 0.03, 0.72, 0.12], 6));
    for (const sx of [-1, 1]) g.add(_box(0.03, 0.16, 0.1, ft, [sx * 0.09, 0.55, -0.02]));
    g.add(_box(0.1, 0.04, 0.18, ft, [0, 0.52, -0.14]));
    return g;
  }, { icon: "🐦", category: "wizard creatures", params: [
    { key: "color", label: "Feathers", type: "color", default: 0x18181c },
    { key: "eyes", label: "Eyes", type: "color", default: 0x8ad6ff }] });

  register("stone_basilisk", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x4a5a4a));
    g.add(_box(0.5, 0.18, 0.5, st, [0, 0.09, 0]));
    let y = 0.18, z = 0; const x = 0;
    for (let i = 0; i < 7; i++) { const r = 0.16 - i * 0.012; g.add(_sph(r, st, [x, y + r, z], 10)); y += r * 1.4; z += 0.04; }
    g.add(_box(0.22, 0.16, 0.3, st, [x, y + 0.05, z + 0.08]));
    const snout = _cone(0.08, 0.18, st, [x, y + 0.02, z + 0.28], 6); snout.rotation.x = Math.PI / 2; g.add(snout);
    for (const sx of [-1, 1]) g.add(_sph(0.03, glow(_c(o.eyes, 0xffd24a), 1.6), [x + sx * 0.07, y + 0.08, z + 0.18], 6));
    for (const sx of [-1, 1]) { const f = _cone(0.02, 0.08, M.bone(0xe8e0d0), [x + sx * 0.05, y - 0.03, z + 0.2], 4); f.rotation.x = Math.PI; g.add(f); }
    return g;
  }, { icon: "🐲", category: "wizard creatures", params: [
    { key: "color", label: "Stone", type: "color", default: 0x4a5a4a },
    { key: "eyes", label: "Eyes", type: "color", default: 0xffd24a }] });

  register("stone_wyvern", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a4a5a)); const b = 0.18;
    g.add(_box(0.5, 0.18, 0.5, st, [0, 0.09, 0]));
    for (const sx of [-1, 1]) g.add(_cyl(0.05, 0.06, 0.3, st, [sx * 0.1, b + 0.15, 0], 6));
    const body = _sph(0.2, st, [0, b + 0.4, 0], 12); body.scale.set(1, 0.9, 1.3); g.add(body);
    const neck = _cyl(0.06, 0.08, 0.3, st, [0, b + 0.6, 0.12], 8); neck.rotation.x = 0.6; g.add(neck);
    g.add(_box(0.12, 0.12, 0.22, st, [0, b + 0.78, 0.26]));
    const snout = _cone(0.06, 0.16, st, [0, b + 0.76, 0.4], 6); snout.rotation.x = Math.PI / 2; g.add(snout);
    for (const sx of [-1, 1]) g.add(_sph(0.025, glow(_c(o.eyes, 0xff5a2a), 1.6), [sx * 0.05, b + 0.82, 0.34], 6));
    for (const sx of [-1, 1]) { const w = _box(0.04, 0.5, 0.3, st, [sx * 0.24, b + 0.5, -0.05]); w.rotation.z = sx * 0.6; w.rotation.y = -sx * 0.4; g.add(w); }
    const tail = _cyl(0.06, 0.02, 0.5, st, [0, b + 0.3, -0.3], 6); tail.rotation.x = 1.2; g.add(tail);
    return g;
  }, { icon: "🐉", category: "wizard creatures", params: [
    { key: "color", label: "Stone", type: "color", default: 0x5a4a5a },
    { key: "eyes", label: "Eyes", type: "color", default: 0xff5a2a }] });

  register("stone_cerberus", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5550)); const b = 0.16;
    g.add(_box(0.7, 0.16, 0.5, st, [0, 0.08, 0]));
    g.add(_box(0.4, 0.3, 0.6, st, [0, b + 0.25, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_cyl(0.06, 0.07, 0.25, st, [sx * 0.15, b + 0.12, sz * 0.2], 6));
    for (const dx of [-0.16, 0, 0.16]) { g.add(_sph(0.11, st, [dx, b + 0.5, 0.28], 10)); g.add(_box(0.1, 0.08, 0.12, st, [dx, b + 0.46, 0.4]));
      for (const sx of [-1, 1]) g.add(_sph(0.02, glow(_c(o.eyes, 0xff3a2a), 1.6), [dx + sx * 0.04, b + 0.52, 0.36], 6));
      for (const sx of [-1, 1]) g.add(_cone(0.03, 0.08, st, [dx + sx * 0.06, b + 0.6, 0.24], 4)); }
    const tail = _cyl(0.05, 0.02, 0.4, st, [0, b + 0.3, -0.32], 6); tail.rotation.x = 1.0; g.add(tail);
    return g;
  }, { icon: "🐕", category: "wizard creatures", params: [
    { key: "color", label: "Stone", type: "color", default: 0x5a5550 },
    { key: "eyes", label: "Eyes", type: "color", default: 0xff3a2a }] });

  register("perched_owl", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x3a2414); const ft = M.cloth(_c(o.color, 0xe8e4dc));
    g.add(_cyl(0.12, 0.15, 0.04, wd, [0, 0.02, 0], 12));
    g.add(_cyl(0.02, 0.02, 0.45, wd, [0, 0.24, 0], 8));
    const perch = _cyl(0.02, 0.02, 0.2, wd, [0, 0.46, 0], 6); perch.rotation.z = Math.PI / 2; g.add(perch);
    const body = _sph(0.13, ft, [0, 0.6, 0], 14); body.scale.set(1, 1.25, 1); g.add(body);
    g.add(_sph(0.1, ft, [0, 0.78, 0.02], 12));
    for (const sx of [-1, 1]) { g.add(_sph(0.04, M.cloth(0xd8d0c4), [sx * 0.04, 0.79, 0.09], 8)); g.add(_sph(0.025, glow(_c(o.eyes, 0xffb000), 1.2), [sx * 0.04, 0.79, 0.11], 6)); g.add(_sph(0.01, M.metal(0x111111), [sx * 0.04, 0.79, 0.13], 6)); }
    const beak = _cone(0.02, 0.05, M.brass(0xd6a040), [0, 0.75, 0.12], 5); beak.rotation.x = Math.PI / 2; g.add(beak);
    for (const sx of [-1, 1]) { const t = _cone(0.025, 0.07, ft, [sx * 0.06, 0.87, 0.02], 4); t.rotation.z = sx * 0.2; g.add(t); }
    for (const sx of [-1, 1]) g.add(_box(0.04, 0.18, 0.12, M.cloth(0xd0c8bc), [sx * 0.11, 0.58, -0.02]));
    for (let i = 0; i < 10; i++) g.add(_sph(0.012, M.cloth(0x8a8278), [rand(-0.1, 0.1), 0.5 + rand(0, 0.2), 0.1 + rand(-0.02, 0.02)], 6));
    return g;
  }, { icon: "🦉", category: "wizard creatures", params: [
    { key: "color", label: "Feathers", type: "color", default: 0xe8e4dc },
    { key: "eyes", label: "Eyes", type: "color", default: 0xffb000 }] });

  register("flying_owl", function (o) {
    const g = new THREE.Group(); const ft = M.cloth(_c(o.color, 0x8a6a4a)); const y = o.height;
    const body = _sph(0.12, ft, [0, y, 0], 14); body.scale.set(1, 1, 1.4); g.add(body);
    g.add(_sph(0.09, ft, [0, y + 0.06, 0.14], 12));
    const beak = _cone(0.02, 0.05, M.brass(0xd6a040), [0, y + 0.04, 0.24], 5); beak.rotation.x = Math.PI / 2; g.add(beak);
    for (const sx of [-1, 1]) g.add(_sph(0.022, glow(_c(o.eyes, 0xffb000), 1.2), [sx * 0.04, y + 0.08, 0.21], 6));
    for (const sx of [-1, 1]) { const w = _box(0.45, 0.04, 0.2, ft, [sx * 0.3, y + 0.02, 0]); w.rotation.z = sx * 0.15; w.rotation.y = sx * 0.2; g.add(w);
      const wt = _box(0.25, 0.03, 0.14, ft, [sx * 0.55, y + 0.04, -0.04]); wt.rotation.z = sx * 0.3; g.add(wt); }
    g.add(_box(0.14, 0.03, 0.2, ft, [0, y, -0.16]));
    for (const sx of [-1, 1]) g.add(_cyl(0.01, 0.01, 0.08, M.brass(0xd6a040), [sx * 0.04, y - 0.1, 0.05], 4));
    return g;
  }, { icon: "🕊", category: "wizard creatures", params: [
    { key: "height", label: "Hover", type: "number", min: 0.8, max: 2.5, step: 0.1, default: 1.5 },
    { key: "color", label: "Feathers", type: "color", default: 0x8a6a4a },
    { key: "eyes", label: "Eyes", type: "color", default: 0xffb000 }] });

  register("owl_cage", function (o) {
    const g = new THREE.Group(); const ir = M.metal(_c(o.color, 0x3a352e)); const R = 0.28, H = 0.55;
    g.add(_cyl(R + 0.04, R + 0.06, 0.05, ir, [0, 0.025, 0], 16));
    for (let i = 0; i < 12; i++) { const a = i * Math.PI * 2 / 12; g.add(_cyl(0.01, 0.01, H, ir, [Math.cos(a) * R, H / 2 + 0.05, Math.sin(a) * R], 4)); }
    const ring = _tor(R, 0.012, ir, [0, H + 0.05, 0], 6, 18); ring.rotation.x = Math.PI / 2; g.add(ring);
    for (let i = 0; i < 6; i++) { const rib = _tor(R, 0.01, ir, [0, H + 0.05, 0], 4, 12); rib.rotation.y = i * Math.PI / 3; g.add(rib); }
    g.add(_sph(0.04, ir, [0, H + 0.18, 0], 8));
    const handle = _tor(0.04, 0.01, ir, [0, H + 0.24, 0], 6, 12); handle.rotation.x = Math.PI / 2; g.add(handle);
    const ft = M.cloth(0xe8e4dc);
    g.add(_sph(0.1, ft, [0, 0.2, 0], 12)); g.add(_sph(0.07, ft, [0, 0.33, 0.02], 10));
    for (const sx of [-1, 1]) g.add(_sph(0.018, glow(0xffb000, 1.2), [sx * 0.03, 0.34, 0.07], 6));
    return g;
  }, { icon: "🦤", category: "wizard creatures", params: [
    { key: "color", label: "Iron", type: "color", default: 0x3a352e }] });

  register("sleeping_cat", function (o) {
    const g = new THREE.Group(); const fur = M.cloth(_c(o.color, 0x6a5038));
    const body = _sph(0.16, fur, [0, 0.1, 0], 14); body.scale.set(1.4, 0.7, 1.1); g.add(body);
    g.add(_sph(0.08, fur, [0.12, 0.1, 0.06], 12));
    for (const sx of [-1, 1]) g.add(_cone(0.025, 0.05, fur, [0.12 + sx * 0.04, 0.17, 0.06], 4));
    const tail = _tor(0.13, 0.025, fur, [0, 0.07, 0], 6, 16); tail.rotation.x = Math.PI / 2; g.add(tail);
    return g;
  }, { icon: "🐱", category: "wizard creatures", params: [
    { key: "color", label: "Fur", type: "color", default: 0x6a5038 }] });

  register("hanging_bat", function (o) {
    const g = new THREE.Group(); const bd = M.cloth(_c(o.color, 0x2a2226)); const y = o.height;
    g.add(_box(0.1, 0.03, 0.05, M.wood(0x3a2414), [0, y, 0]));
    g.add(_sph(0.05, bd, [0, y - 0.08, 0], 10)); g.add(_sph(0.04, bd, [0, y - 0.15, 0], 10));
    for (const sx of [-1, 1]) g.add(_cone(0.015, 0.04, bd, [sx * 0.02, y - 0.19, 0], 4));
    for (const sx of [-1, 1]) { const w = _box(0.03, 0.16, 0.08, bd, [sx * 0.05, y - 0.1, 0]); w.rotation.z = sx * 0.2; g.add(w); }
    for (const sx of [-1, 1]) g.add(_cyl(0.006, 0.006, 0.04, M.metal(0x2a2520), [sx * 0.02, y - 0.02, 0], 4));
    return g;
  }, { icon: "🦇", category: "wizard creatures", params: [
    { key: "height", label: "Hang at", type: "number", min: 1, max: 2.5, step: 0.1, default: 1.8 },
    { key: "color", label: "Body", type: "color", default: 0x2a2226 }] });

  register("scurrying_rat", function (o) {
    const g = new THREE.Group(); const fur = M.cloth(_c(o.color, 0x4a4038));
    const body = _sph(0.06, fur, [0, 0.06, 0], 10); body.scale.set(1, 0.9, 1.7); g.add(body);
    g.add(_sph(0.04, fur, [0, 0.06, 0.12], 10));
    const nose = _cone(0.015, 0.04, M.cloth(0x8a6a6a), [0, 0.05, 0.18], 4); nose.rotation.x = Math.PI / 2; g.add(nose);
    for (const sx of [-1, 1]) g.add(_sph(0.022, fur, [sx * 0.03, 0.1, 0.08], 8));
    for (const sx of [-1, 1]) g.add(_sph(0.008, glow(_c(o.eyes, 0xd62a2a), 1.0), [sx * 0.02, 0.07, 0.15], 6));
    const tail = _cyl(0.008, 0.004, 0.18, M.cloth(0x8a6a6a), [0, 0.05, -0.14], 4); tail.rotation.x = 1.4; g.add(tail);
    for (let i = 0; i < 4; i++) g.add(_cyl(0.005, 0.005, 0.03, fur, [(i < 2 ? -1 : 1) * 0.03, 0.015, (i % 2 ? -1 : 1) * 0.05], 4));
    return g;
  }, { icon: "🐀", category: "wizard creatures", params: [
    { key: "color", label: "Fur", type: "color", default: 0x4a4038 },
    { key: "eyes", label: "Eyes", type: "color", default: 0xd62a2a }] });

  register("giant_spider", function (o) {
    const g = new THREE.Group(); const bd = M.cloth(_c(o.color, 0x1a1418)); const sz = o.size;
    const ab = _sph(0.2 * sz, bd, [0, 0.2 * sz, -0.12 * sz], 12); ab.scale.set(1, 0.8, 1.1); g.add(ab);
    g.add(_sph(0.12 * sz, bd, [0, 0.18 * sz, 0.1 * sz], 12));
    for (let i = 0; i < 4; i++) g.add(_sph(0.015 * sz, glow(_c(o.eyes, 0xd62a2a), 1.2), [(-0.04 + 0.027 * i) * sz, 0.22 * sz, 0.2 * sz], 6));
    for (const sx of [-1, 1]) for (let i = 0; i < 4; i++) { const ang = (-0.5 + i * 0.35), baseY = 0.18 * sz, x0 = sx * 0.1 * sz, z0 = (0.05 - i * 0.06) * sz;
      const up = _cyl(0.015 * sz, 0.015 * sz, 0.22 * sz, bd, [x0 + sx * 0.12 * sz, baseY + 0.06 * sz, z0], 5); up.rotation.z = sx * 0.9; up.rotation.y = ang; g.add(up);
      const lo = _cyl(0.012 * sz, 0.012 * sz, 0.24 * sz, bd, [x0 + sx * 0.24 * sz, baseY - 0.04 * sz, z0], 5); lo.rotation.z = sx * 0.4; lo.rotation.y = ang; g.add(lo); }
    return g;
  }, { icon: "🕷", category: "wizard creatures", params: [
    { key: "size", label: "Size", type: "number", min: 0.5, max: 2, step: 0.1, default: 1.0 },
    { key: "color", label: "Body", type: "color", default: 0x1a1418 },
    { key: "eyes", label: "Eyes", type: "color", default: 0xd62a2a }] });

  register("hearth_brownie", function (o) {
    const g = new THREE.Group(); const skin = M.cloth(_c(o.color, 0xc8a878)), rag = M.cloth(_c(o.cloth, 0x6a5a3a));
    g.add(_cyl(0.1, 0.14, 0.28, rag, [0, 0.2, 0], 10));
    g.add(_sph(0.13, skin, [0, 0.46, 0], 14));
    for (const sx of [-1, 1]) { const ear = _box(0.04, 0.16, 0.1, skin, [sx * 0.13, 0.46, 0]); ear.rotation.z = sx * 0.5; g.add(ear); }
    for (const sx of [-1, 1]) { g.add(_sph(0.04, M.plaster(0xf0ece0), [sx * 0.05, 0.47, 0.1], 8)); g.add(_sph(0.022, glow(_c(o.eyes, 0x4a8a4a), 0.8), [sx * 0.05, 0.47, 0.13], 6)); }
    const nose = _cone(0.02, 0.07, skin, [0, 0.43, 0.13], 5); nose.rotation.x = Math.PI / 2; g.add(nose);
    for (const sx of [-1, 1]) { g.add(_cyl(0.02, 0.02, 0.22, skin, [sx * 0.1, 0.18, 0], 5)); g.add(_cyl(0.025, 0.025, 0.16, skin, [sx * 0.05, 0.08, 0], 5)); }
    for (const sx of [-1, 1]) g.add(_box(0.06, 0.04, 0.1, skin, [sx * 0.05, 0.02, 0.03]));
    return g;
  }, { icon: "🧝", category: "wizard creatures", params: [
    { key: "color", label: "Skin", type: "color", default: 0xc8a878 },
    { key: "cloth", label: "Rag", type: "color", default: 0x6a5a3a },
    { key: "eyes", label: "Eyes", type: "color", default: 0x4a8a4a }] });

  // ════════════════════════════════════════════════════════════
  //  FEATHERS & SMALL DETAILS
  // ════════════════════════════════════════════════════════════

  register("caged_phoenix", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x2a2520);
    g.add(_cyl(0.26, 0.28, 0.04, ir, [0, 0.02, 0], 16));
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const bar = _cyl(0.008, 0.008, 0.7, ir, [Math.cos(a) * 0.25, 0.39, Math.sin(a) * 0.25], 5); g.add(bar); }
    g.add(_tor(0.25, 0.012, ir, [0, 0.74, 0], 6, 16));
    g.add(_cone(0.12, 0.16, ir, [0, 0.82, 0], 12));
    g.add(_cyl(0.006, 0.006, 0.2, ir, [0, 0.95, 0], 6));
    g.add(_tor(0.03, 0.006, ir, [0, 1.06, 0], 4, 10));
    // the phoenix
    const bird = new THREE.Group(); const fb = glow(_c(o.color, 0xff7a1a), 1.3), fb2 = glow(0xffd24a, 1.1);
    bird.add(_sph(0.07, fb, [0, 0, 0], 10));
    bird.add(_sph(0.045, fb, [0, 0.07, 0.02], 8));
    bird.add(_cone(0.02, 0.05, fb2, [0, 0.07, 0.06], 6)); bird.children[2].rotation.x = Math.PI / 2;
    const wL = new THREE.Group(), wR = new THREE.Group();
    wL.add(_box(0.14, 0.02, 0.08, fb2, [-0.07, 0, 0])); wR.add(_box(0.14, 0.02, 0.08, fb2, [0.07, 0, 0]));
    wL.position.set(-0.04, 0.01, 0); wR.position.set(0.04, 0.01, 0); bird.add(wL); bird.add(wR);
    bird.add(_cone(0.04, 0.18, fb, [0, -0.04, -0.08], 6)); bird.children[bird.children.length - 1].rotation.x = -0.6; // tail
    bird.position.set(0, 0.34, 0); g.add(bird);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const f = Math.sin(t * 6); wL.rotation.z = -0.5 - f * 0.5; wR.rotation.z = 0.5 + f * 0.5; bird.position.y = 0.34 + Math.sin(t * 2) * 0.02; fb.emissiveIntensity = 1.3 + Math.sin(t * 4) * 0.3; };
    return g;
  }, { icon: "🔥", category: "wizard creatures", params: [
    { key: "color", label: "Plumage", type: "color", default: 0xff7a1a }] });

  register("small_dragon", function (o) {
    const g = new THREE.Group(); const sk = M.leaf(_c(o.color, 0x2a6a3a)), bel = M.wax(0xd8c060);
    const body = new THREE.Group();
    body.add(_sph(0.16, sk, [0, 0, 0], 12)); body.children[0].scale.set(1.4, 0.9, 1);
    const neck = _cyl(0.06, 0.09, 0.22, sk, [0, 0.06, 0.18], 8); neck.rotation.x = -0.7; body.add(neck);
    const head = new THREE.Group();
    head.add(_sph(0.08, sk, [0, 0, 0], 10)); head.children[0].scale.set(1, 0.8, 1.3);
    head.add(_cone(0.03, 0.06, bel, [0, -0.02, 0.1], 6)); head.children[1].rotation.x = Math.PI / 2;
    head.add(_cone(0.02, 0.06, sk, [-0.04, 0.07, -0.03], 5)); head.add(_cone(0.02, 0.06, sk, [0.04, 0.07, -0.03], 5));
    head.position.set(0, 0.18, 0.32); body.add(head);
    const tail = _cone(0.07, 0.5, sk, [0, 0.02, -0.3], 8); tail.rotation.x = 1.5; body.add(tail);
    for (const sx of [-1, 1]) { const w = new THREE.Group(); w.add(_cone(0.02, 0.26, sk, [0, 0.13, 0], 4)); w.add(_box(0.14, 0.18, 0.01, M.leaf(0x1a4a2a), [sx * 0.08, 0.1, 0])); w.position.set(sx * 0.12, 0.1, -0.02); w.rotation.z = sx * 0.4; body.add(w); }
    for (const [x, z] of [[-0.1, 0.08], [0.1, 0.08], [-0.1, -0.1], [0.1, -0.1]]) g.add(_cyl(0.025, 0.03, 0.1, sk, [x, 0.13, z], 6));
    body.position.y = 0.2; g.add(body);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; head.rotation.y = Math.sin(t * 0.9) * 0.4; head.rotation.x = Math.sin(t * 1.3) * 0.15; tail.rotation.z = Math.sin(t * 1.1) * 0.3; };
    return g;
  }, { icon: "🐉", category: "wizard creatures", params: [
    { key: "color", label: "Scales", type: "color", default: 0x2a6a3a }] });

  register("fluff_puff", function (o) {
    const g = new THREE.Group(); const fur = M.fabric(_c(o.color, 0xe88ab0));
    const body = new THREE.Group();
    body.add(_sph(0.12, fur, [0, 0, 0], 12));
    for (let i = 0; i < 30; i++) { const a = rand(0, Math.PI * 2), b = rand(-1, 1); const r = 0.12; body.add(_box(0.015, 0.05, 0.015, fur, [Math.cos(a) * Math.sqrt(1 - b * b) * r, b * r, Math.sin(a) * Math.sqrt(1 - b * b) * r])); }
    body.add(_sph(0.02, glow(0x000000, 0), [-0.04, 0.03, 0.1], 6)); body.children[body.children.length - 1].material = M.metal(0x1a1a1a);
    body.add(_sph(0.02, M.metal(0x1a1a1a), [0.04, 0.03, 0.1], 6));
    body.position.y = 0.12; g.add(body);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; body.position.y = 0.12 + Math.abs(Math.sin(t * 3)) * 0.05; body.scale.y = 1 - Math.abs(Math.sin(t * 3)) * 0.08; };
    return g;
  }, { icon: "🩷", category: "wizard creatures", params: [
    { key: "color", label: "Fluff", type: "color", default: 0xe88ab0 }] });

  register("shell_critter", function (o) {
    const g = new THREE.Group(); const sh = M.ceramic(_c(o.color, 0xc85a2a)), leg = M.metal(0x6a4a2a);
    g.add(_sph(0.16, sh, [0, 0.12, 0], 12)); g.children[0].scale.set(1.3, 0.7, 1);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.add(_cone(0.025, 0.06, sh, [Math.cos(a) * 0.1, 0.2, Math.sin(a) * 0.08], 5)); }
    for (const sx of [-1, 1]) for (const z of [0.06, 0, -0.06]) { const l = _cyl(0.01, 0.012, 0.1, leg, [sx * 0.18, 0.06, z], 5); l.rotation.z = sx * 0.7; g.add(l); }
    for (const sx of [-1, 1]) g.add(_sph(0.018, glow(0xffaa33, 0.6), [sx * 0.06, 0.16, 0.18], 6));
    return g;
  }, { icon: "🦀", category: "wizard creatures", params: [
    { key: "color", label: "Shell", type: "color", default: 0xc85a2a }] });

  register("tube_worm", function (o) {
    const g = new THREE.Group(); const m = M.wax(_c(o.color, 0x8a9a4a));
    const segs = []; const seg = new THREE.Group();
    let x = -0.25; for (let i = 0; i < 8; i++) { const s = _sph(0.05 - i * 0.003, m, [x, 0.05, 0], 8); seg.add(s); segs.push({ m: s, ph: i * 0.6 }); x += 0.06; }
    g.add(seg); let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; segs.forEach((s, i) => { s.m.position.y = 0.05 + Math.sin(t * 3 - s.ph) * 0.025; }); };
    return g;
  }, { icon: "🐛", category: "wizard creatures", params: [
    { key: "color", label: "Body", type: "color", default: 0x8a9a4a }] });

  register("jarred_specimen", function (o) {
    const g = new THREE.Group(); const gl = M.glass(0xcfe3d8), lid = M.metal(0x3a342c);
    g.add(_cyl(0.13, 0.14, 0.36, gl, [0, 0.2, 0], 16));
    g.add(_cyl(0.13, 0.13, 0.34, tglow(_c(o.color, 0x4aaa6a), 0.4, 0.25), [0, 0.2, 0], 16)); // fluid
    const cr = glow(_c(o.color, 0x4aaa6a), 0.6);
    g.add(_sph(0.06, cr, [0, 0.18, 0], 10)); g.children[2].scale.set(1, 1.4, 1);
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const t = _cyl(0.008, 0.004, 0.12, cr, [0, 0.1, 0], 5); t.position.set(Math.cos(a) * 0.04, 0.1, Math.sin(a) * 0.04); t.rotation.z = Math.cos(a) * 0.6; t.rotation.x = Math.sin(a) * 0.6; g.add(t); }
    g.add(_cyl(0.14, 0.14, 0.04, lid, [0, 0.4, 0], 16));
    return g;
  }, { icon: "🧪", category: "wizard creatures", params: [
    { key: "color", label: "Specimen", type: "color", default: 0x4aaa6a }] });

  register("burrow_creature", function (o) {
    const g = new THREE.Group(); const fur = M.leather(_c(o.color, 0x2a2a2a)), dirt = M.stone(0x4a3a2a);
    g.add(_cyl(0.26, 0.3, 0.06, dirt, [0, 0.03, 0], 14)); // dirt mound base
    const body = new THREE.Group();
    body.add(_sph(0.12, fur, [0, 0, 0], 10)); body.children[0].scale.set(1.2, 0.9, 1.4);
    body.add(_cone(0.05, 0.1, M.brass(0xc8a050), [0, 0.02, 0.15], 6)); body.children[1].rotation.x = Math.PI / 2; // snout
    body.add(_sph(0.015, M.metal(0x111111), [-0.04, 0.06, 0.1], 6)); body.add(_sph(0.015, M.metal(0x111111), [0.04, 0.06, 0.1], 6));
    body.position.y = 0.16; g.add(body);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; body.position.z = Math.sin(t * 2) * 0.04; body.rotation.y = Math.sin(t * 1.3) * 0.3; };
    return g;
  }, { icon: "🦫", category: "wizard creatures", params: [
    { key: "color", label: "Fur", type: "color", default: 0x2a2a2a }] });

  // ════════════════════════════════════════════════════════════
  //  GREENHOUSE
  // ════════════════════════════════════════════════════════════

  register("darting_snitch", function (o) {
    const g = new THREE.Group(); const gold = glow(_c(o.color, 0xe8c24a), 1.0);
    const flyer = new THREE.Group();
    flyer.add(_sph(0.05, gold, [0, 0, 0], 12));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const seam = _box(0.001, 0.04, 0.1, M.brass(0xb8923a), [0, 0, 0]); seam.position.set(Math.cos(a) * 0.025, 0, Math.sin(a) * 0.025); seam.rotation.y = -a; flyer.add(seam); }
    const wL = new THREE.Group(), wR = new THREE.Group();
    const wlm = _box(0.12, 0.005, 0.07, tglow(0xf0f4ff, 0.4, 0.7), [-0.06, 0, 0]); wL.add(wlm);
    const wrm = _box(0.12, 0.005, 0.07, tglow(0xf0f4ff, 0.4, 0.7), [0.06, 0, 0]); wR.add(wrm);
    wL.position.set(-0.04, 0.02, 0); wR.position.set(0.04, 0.02, 0); flyer.add(wL); flyer.add(wR);
    flyer.position.y = o.height; g.add(flyer);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const f = Math.sin(t * 22); wL.rotation.z = -0.6 - f * 0.7; wR.rotation.z = 0.6 + f * 0.7;
      flyer.position.set(Math.sin(t * 1.3) * o.range + Math.sin(t * 3.1) * 0.08, o.height + Math.sin(t * 1.7) * 0.18, Math.cos(t * 0.9) * o.range + Math.cos(t * 2.3) * 0.08);
      flyer.rotation.y = Math.atan2(Math.cos(t * 1.3), -Math.sin(t * 0.9)); };
    return g;
  }, { icon: "🟡", category: "wizard creatures", params: [
    { key: "height", label: "Hover Height", type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.4 },
    { key: "range", label: "Dart Range", type: "number", min: 0.1, max: 1.0, step: 0.05, default: 0.4 },
    { key: "color", label: "Gold", type: "color", default: 0xe8c24a }] });

  register("rogue_bludger", function (o) {
    const g = new THREE.Group(); const ir = M.metal(_c(o.color, 0x3a3a40));
    const ball = new THREE.Group();
    ball.add(_sph(0.13, ir, [0, 0, 0], 14));
    for (let i = 0; i < 5; i++) ball.add(_sph(rand(0.02, 0.035), M.metal(0x2a2a30), [rand(-0.1, 0.1), rand(-0.1, 0.1), rand(-0.1, 0.1)], 6)); // dents
    ball.position.y = o.height; g.add(ball);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; ball.position.set(Math.sin(t * 4.3) * 0.12, o.height + Math.abs(Math.sin(t * 5)) * 0.1, Math.cos(t * 3.7) * 0.12); ball.rotation.x += dt * 3; ball.rotation.z += dt * 2.4; };
    return g;
  }, { icon: "⚫", category: "wizard creatures", params: [
    { key: "height", label: "Hover Height", type: "number", min: 0.3, max: 2, step: 0.1, default: 1.2 },
    { key: "color", label: "Iron", type: "color", default: 0x3a3a40 }] });

  register("mechanical_owl", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x4a3018), feather = M.fabric(_c(o.color, 0x8a7050));
    g.add(_cyl(0.04, 0.05, 0.6, wd, [0, 0.3, 0], 8));             // perch post
    const perch = _cyl(0.015, 0.015, 0.3, wd, [0, 0.6, 0], 6); perch.rotation.z = Math.PI / 2; g.add(perch);
    const owl = new THREE.Group();
    owl.add(_sph(0.14, feather, [0, 0, 0], 12)); owl.children[0].scale.set(1, 1.2, 0.9); // body
    const head = new THREE.Group();
    head.add(_sph(0.1, feather, [0, 0, 0], 12));
    head.add(_cone(0.03, 0.05, feather, [-0.05, 0.08, 0], 5)); head.add(_cone(0.03, 0.05, feather, [0.05, 0.08, 0], 5)); // tufts
    const eyeL = _sph(0.03, glow(0xffcc33, 0.7), [-0.04, 0.02, 0.08], 8); const eyeR = _sph(0.03, glow(0xffcc33, 0.7), [0.04, 0.02, 0.08], 8);
    head.add(eyeL); head.add(eyeR);
    const beak = _cone(0.02, 0.04, M.brass(0xc8a050), [0, -0.02, 0.09], 5); beak.rotation.x = Math.PI / 2; head.add(beak);
    head.position.set(0, 0.16, 0); owl.add(head);
    const wL = new THREE.Group(), wR = new THREE.Group();
    wL.add(_box(0.04, 0.18, 0.1, feather, [-0.02, -0.05, 0])); wR.add(_box(0.04, 0.18, 0.1, feather, [0.02, -0.05, 0]));
    wL.position.set(-0.12, 0.02, 0); wR.position.set(0.12, 0.02, 0); owl.add(wL); owl.add(wR);
    owl.position.set(0, 0.74, 0); g.add(owl);
    let t = rand(0, 6), nextTurn = 2;
    g.userData.tick = (dt) => { t += dt; if (t > nextTurn) { head.rotation.y = (Math.random() - 0.5) * 2.4; nextTurn = t + rand(1.5, 4); } const f = Math.sin(t * 5); if (Math.sin(t * 0.6) > 0.9) { wL.rotation.z = -0.4 - f * 0.5; wR.rotation.z = 0.4 + f * 0.5; } else { wL.rotation.z += (-0.1 - wL.rotation.z) * dt * 4; wR.rotation.z += (0.1 - wR.rotation.z) * dt * 4; } };
    return g;
  }, { icon: "🦉", category: "wizard creatures", params: [
    { key: "color", label: "Feathers", type: "color", default: 0x8a7050 }] });

  register("thestral_silhouette", function (o) {
    const g = new THREE.Group(); const sk = tglow(_c(o.color, 0x1a1a22), 0.15, 0.85);
    const body = new THREE.Group();
    body.add(_cyl(0.1, 0.07, 0.5, sk, [0, 0, 0], 8)); body.children[0].rotation.z = Math.PI / 2; body.children[0].scale.set(1, 1, 0.7); // ribby body
    for (let i = 0; i < 5; i++) { const rib = _tor(0.08, 0.008, sk, [-0.18 + i * 0.09, 0, 0], 4, 12); rib.rotation.y = Math.PI / 2; body.add(rib); } // visible ribs
    // neck + head
    const neck = _cyl(0.04, 0.03, 0.34, sk, [0.26, 0.14, 0], 6); neck.rotation.z = -0.7; body.add(neck);
    body.add(_box(0.06, 0.05, 0.14, sk, [0.42, 0.26, 0]));
    // legs
    for (const [x, z] of [[-0.18, 0.06], [0.18, 0.06], [-0.18, -0.06], [0.18, -0.06]]) { const l = _cyl(0.02, 0.012, 0.5, sk, [x, -0.32, z], 5); body.add(l); }
    // leathery wings
    const wL = new THREE.Group(), wR = new THREE.Group();
    wL.add(_box(0.5, 0.01, 0.34, sk, [-0.25, 0, 0])); wR.add(_box(0.5, 0.01, 0.34, sk, [0.25, 0, 0]));
    wL.position.set(-0.05, 0.16, 0); wR.position.set(0.05, 0.16, 0); body.add(wL); body.add(wR);
    body.position.set(0, 0.7, 0); g.add(body);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const f = Math.sin(t * 1.5); wL.rotation.z = -0.2 - f * 0.4; wR.rotation.z = 0.2 + f * 0.4; body.position.y = 0.7 + Math.sin(t * 1.5) * 0.03; };
    return g;
  }, { icon: "🐴", category: "wizard creatures", params: [
    { key: "color", label: "Hide", type: "color", default: 0x1a1a22 }] });

  register("grindylow_tank", function (o) {
    const g = new THREE.Group(); const gl = M.glass(0xbfe0e8), fr = M.metal(0x3a342c), water = tglow(0x2a6a7a, 0.2, 0.4);
    g.add(_box(0.6, 0.5, 0.4, gl, [0, 0.45, 0]));
    g.add(_box(0.62, 0.04, 0.42, fr, [0, 0.2, 0])); g.add(_box(0.62, 0.04, 0.42, fr, [0, 0.7, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_cyl(0.015, 0.015, 0.5, fr, [sx * 0.3, 0.45, sz * 0.2], 4));
    g.add(_box(0.56, 0.46, 0.36, water, [0, 0.45, 0]));
    // gravel + weeds
    g.add(_box(0.54, 0.06, 0.34, M.stone(0x4a4a3a), [0, 0.24, 0]));
    const creature = new THREE.Group(); const sk = M.leaf(_c(o.color, 0x3a7a6a));
    creature.add(_sph(0.08, sk, [0, 0, 0], 10));
    creature.add(_sph(0.012, glow(0xeaff66, 0.6), [-0.03, 0.02, 0.06], 6)); creature.add(_sph(0.012, glow(0xeaff66, 0.6), [0.03, 0.02, 0.06], 6));
    const tentacles = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const tn = _cyl(0.012, 0.004, 0.16, sk, [Math.cos(a) * 0.06, -0.08, Math.sin(a) * 0.06], 4); creature.add(tn); tentacles.push({ m: tn, ph: i, bx: Math.cos(a), bz: Math.sin(a) }); }
    creature.position.set(0, 0.42, 0); g.add(creature);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; creature.position.set(Math.sin(t * 0.6) * 0.15, 0.42 + Math.sin(t * 0.8) * 0.08, Math.cos(t * 0.5) * 0.1); tentacles.forEach((tn) => { tn.m.rotation.x = Math.sin(t * 3 + tn.ph) * 0.5 * tn.bz; tn.m.rotation.z = Math.sin(t * 3 + tn.ph) * 0.5 * tn.bx; }); };
    return g;
  }, { icon: "🦑", category: "wizard creatures", params: [
    { key: "color", label: "Creature", type: "color", default: 0x3a7a6a }] });

  register("flitting_doxy_jar", function (o) {
    const g = new THREE.Group(); const gl = M.glass(0xcfe3d8), lid = M.metal(0x3a342c);
    g.add(_cyl(0.12, 0.13, 0.32, gl, [0, 0.18, 0], 16));
    g.add(_cyl(0.13, 0.13, 0.04, lid, [0, 0.36, 0], 16));
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(_box(0.002, 0.04, 0.002, lid, [Math.cos(a) * 0.05, 0.37, Math.sin(a) * 0.05])); } // air holes ring
    const doxy = new THREE.Group(); const bd = glow(_c(o.color, 0x3a6a8a), 0.5);
    doxy.add(_sph(0.025, bd, [0, 0, 0], 8));
    const wL = _box(0.04, 0.005, 0.03, tglow(0x8af0ff, 0.6, 0.6), [-0.03, 0.01, 0]); const wR = _box(0.04, 0.005, 0.03, tglow(0x8af0ff, 0.6, 0.6), [0.03, 0.01, 0]);
    doxy.add(wL); doxy.add(wR); g.add(doxy);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; doxy.position.set(Math.sin(t * 5) * 0.06, 0.18 + Math.sin(t * 6.3) * 0.1, Math.cos(t * 4.4) * 0.06); const f = Math.sin(t * 30); wL.rotation.y = f * 0.6; wR.rotation.y = -f * 0.6; };
    return g;
  }, { icon: "🪲", category: "wizard creatures", params: [
    { key: "color", label: "Doxy", type: "color", default: 0x3a6a8a }] });

  // ════════════════════════════════════════════════════════════
  //  GRAND ARCHITECTURE  (mostly static, big pieces)
  // ════════════════════════════════════════════════════════════

  register("owl_post_perch", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)), feather = M.fabric(0x6a5038);
    g.add(_cyl(0.1, 0.14, 0.08, wd, [0, 0.04, 0], 12));
    g.add(_cyl(0.04, 0.05, 1.0, wd, [0, 0.5, 0], 8));
    const bar = _cyl(0.02, 0.02, 0.6, wd, [0, 0.95, 0], 6); bar.rotation.z = Math.PI / 2; g.add(bar);
    // letters tucked on the base
    for (let i = 0; i < 4; i++) { const e = _box(0.14, 0.01, 0.1, M.plaster(0xeee4d0), [rand(-0.06, 0.06), 0.09 + i * 0.012, rand(-0.04, 0.04)]); e.rotation.y = rand(-0.4, 0.4); g.add(e); }
    const owl = new THREE.Group();
    owl.add(_sph(0.11, feather, [0, 0, 0], 12)); owl.children[0].scale.set(1, 1.2, 0.9);
    const head = new THREE.Group(); head.add(_sph(0.08, feather, [0, 0, 0], 10));
    head.add(_sph(0.025, glow(0xffaa33, 0.6), [-0.03, 0.01, 0.06], 6)); head.add(_sph(0.025, glow(0xffaa33, 0.6), [0.03, 0.01, 0.06], 6));
    head.position.set(0, 0.13, 0); owl.add(head);
    owl.position.set(0.18, 1.06, 0); g.add(owl);
    let t = rand(0, 6), nextTurn = 1.5;
    g.userData.tick = (dt) => { t += dt; if (t > nextTurn) { head.rotation.y = (Math.random() - 0.5) * 2; nextTurn = t + rand(1.2, 3.5); } owl.position.y = 1.06 + Math.sin(t * 1.5) * 0.01; };
    return g;
  }, { icon: "🦉", category: "wizard creatures", params: [
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  // ════════════════════════════════════════════════════════════
  //  POTIONS / DARK ARTS DETAIL
  // ════════════════════════════════════════════════════════════

  register("swiveling_owl", function (o) {
    const g = new THREE.Group(); const f = M.fabric(_c(o.color, 0x8a6a4a)), wd = M.wood(0x3a2414);
    g.add(_cyl(0.04, 0.05, 0.9, wd, [0, 0.45, 0], 8));
    const bar = _cyl(0.16, 0.16, 0.04, wd, [0, 0.91, 0], 10); bar.rotation.z = Math.PI / 2; g.add(bar);
    const owl = new THREE.Group();
    const bodyM = _sph(0.13, f, [0, 0, 0], 12); bodyM.scale.set(1, 1.3, 1); owl.add(bodyM);
    const headM = _sph(0.1, f, [0, 0.16, 0], 12); owl.add(headM);
    for (const sx of [-1, 1]) owl.add(_cone(0.03, 0.06, M.fabric(0x6a4a2a), [sx * 0.05, 0.26, 0], 4));
    for (const sx of [-1, 1]) { owl.add(_sph(0.035, M.bone(0xf0e060), [sx * 0.04, 0.18, 0.08], 8)); owl.add(_sph(0.018, M.metal(0x111111), [sx * 0.04, 0.18, 0.1], 6)); }
    const beak = _cone(0.02, 0.05, M.brass(0xc8a050), [0, 0.15, 0.1], 5); beak.rotation.x = Math.PI / 2; owl.add(beak);
    for (const sx of [-1, 1]) owl.add(_box(0.06, 0.2, 0.02, M.fabric(0x6a4a2a), [sx * 0.12, -0.02, 0]));
    owl.position.set(0, 1.05, 0); g.add(owl);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; headM.rotation.y = Math.sin(t * 0.4) * 0.6; };
    return g;
  }, { icon: "🦉", category: "wizard creatures", params: [
    { key: "color", label: "Feathers", type: "color", default: 0x8a6a4a }] });

  register("toad_on_lily", function (o) {
    const g = new THREE.Group(); const lily = M.leaf(0x3a6a3a), skin = M.leaf(_c(o.color, 0x5a7a3a));
    g.add(_cyl(0.22, 0.22, 0.02, lily, [0, 0.01, 0], 16));
    g.add(_box(0.04, 0.005, 0.18, lily, [0, 0.015, 0]));
    const toad = new THREE.Group();
    const tb = _sph(0.1, skin, [0, 0, 0], 10); tb.scale.set(1.3, 0.8, 1.1); toad.add(tb);
    for (const sx of [-1, 1]) { toad.add(_sph(0.03, M.bone(0xf0e060), [sx * 0.05, 0.06, 0.06], 8)); toad.add(_sph(0.015, M.metal(0x111111), [sx * 0.05, 0.06, 0.08], 6)); }
    for (const sx of [-1, 1]) toad.add(_sph(0.03, skin, [sx * 0.1, -0.04, 0.04], 6));
    toad.position.set(0, 0.08, 0); g.add(toad);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const breathe = 1 + Math.sin(t * 2) * 0.06; toad.scale.set(breathe, 1, breathe); };
    return g;
  }, { icon: "🐸", category: "wizard creatures", params: [
    { key: "color", label: "Skin", type: "color", default: 0x5a7a3a }] });

  register("rat_familiar", function (o) {
    const g = new THREE.Group(); const fur = M.leather(_c(o.color, 0x7a6a5a));
    const body = new THREE.Group();
    const rb = _sph(0.08, fur, [0, 0, 0], 10); rb.scale.set(1.5, 0.9, 1); body.add(rb);
    const headM = _sph(0.05, fur, [0.11, 0.01, 0], 8); body.add(headM);
    for (const sx of [-1, 1]) body.add(_sph(0.025, fur, [0.1, 0.05, sx * 0.03], 6));
    body.add(_sph(0.01, M.metal(0x111111), [0.16, 0.01, 0], 6));
    const tail = _cyl(0.012, 0.004, 0.2, M.fabric(0xc8a0a0), [-0.18, 0.01, 0], 5); tail.rotation.z = 0.3; body.add(tail);
    body.position.y = 0.06; g.add(body);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; tail.rotation.x = Math.sin(t * 4) * 0.3; headM.rotation.z = Math.sin(t * 3) * 0.1; };
    return g;
  }, { icon: "🐀", category: "wizard creatures", params: [
    { key: "color", label: "Fur", type: "color", default: 0x7a6a5a }] });

  register("snake_in_basket", function (o) {
    const g = new THREE.Group(); const bk = M.straw(0xc8a850), sn = M.leaf(_c(o.color, 0x3a7a4a));
    g.add(_cyl(0.18, 0.14, 0.26, bk, [0, 0.13, 0], 14));
    g.add(_tor(0.18, 0.02, bk, [0, 0.26, 0], 6, 18));
    const snake = new THREE.Group();
    const segs = []; let y = 0;
    for (let i = 0; i < 6; i++) { const s = _sph(0.05 - i * 0.004, sn, [0, y, 0], 8); snake.add(s); segs.push({ m: s, ph: i * 0.5 }); y += 0.07; }
    snake.add(_sph(0.012, M.bone(0xf0e060), [0.02, y, 0.02], 6));
    snake.position.set(0, 0.26, 0); g.add(snake);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; segs.forEach((s) => { s.m.position.x = Math.sin(t * 2 - s.ph) * 0.04; }); };
    return g;
  }, { icon: "🐍", category: "wizard creatures", params: [
    { key: "color", label: "Scales", type: "color", default: 0x3a7a4a }] });

  // ════════════════════════════════════════════════════════════
  //  MISC ROOM PROPS
  // ════════════════════════════════════════════════════════════
})();
