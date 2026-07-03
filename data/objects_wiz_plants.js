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

  register("carved_pumpkin", function (o) {
    const g = new THREE.Group(); const pk = M.cloth(_c(o.color, 0xd6791a));
    const body = _sph(0.22, pk, [0, 0.2, 0], 14); body.scale.y = 0.8; g.add(body);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.add(_cyl(0.02, 0.02, 0.34, pk, [Math.cos(a) * 0.18, 0.2, Math.sin(a) * 0.18], 5)); }
    g.add(_cyl(0.03, 0.04, 0.1, M.wood(0x3a5a30), [0, 0.4, 0], 6));
    const fm = glow(_c(o.glow, 0xffa020), 2.0);
    for (const sx of [-1, 1]) { const e = _cone(0.04, 0.06, fm, [sx * 0.08, 0.24, 0.2], 3); e.rotation.x = Math.PI / 2; g.add(e); }
    g.add(_box(0.18, 0.05, 0.04, fm, [0, 0.12, 0.2]));
    return g;
  }, { icon: "◔", category: "wizard plants", params: [
    { key: "color", label: "Skin", type: "color", default: 0xd6791a },
    { key: "glow", label: "Glow", type: "color", default: 0xffa020 }] });

  // ═══ ARCANE OBJECTS ══════════════════════════════════════════

  register("screaming_plant", function (o) {
    const g = new THREE.Group(); const pot = M.ceramic(_c(o.pot, 0x9a5a3a));
    g.add(_cyl(0.16, 0.12, 0.22, pot, [0, 0.11, 0], 14));
    g.add(_cyl(0.18, 0.16, 0.04, pot, [0, 0.22, 0], 14));
    g.add(_cyl(0.15, 0.15, 0.03, M.wood(0x2a1a0e), [0, 0.23, 0], 12));
    const lf = M.leaf(_c(o.color, 0x4a7a30));
    for (let i = 0; i < 7; i++) { const a = i * Math.PI * 2 / 7; const l = _cone(0.05, 0.3, lf, [Math.cos(a) * 0.08, 0.4, Math.sin(a) * 0.08], 4); l.rotation.x = Math.cos(a) * 0.5; l.rotation.z = Math.sin(a) * 0.5; g.add(l); }
    const root = M.fabric(0xc8a878);
    g.add(_sph(0.06, root, [0, 0.3, 0], 10));
    for (const sx of [-1, 1]) g.add(_cyl(0.012, 0.012, 0.08, root, [sx * 0.04, 0.26, 0.02], 4));
    for (const sx of [-1, 1]) g.add(_sph(0.01, M.metal(0x111111), [sx * 0.02, 0.31, 0.05], 5));
    return g;
  }, { icon: "⚘", category: "wizard plants", params: [
    { key: "pot", label: "Pot", type: "color", default: 0x9a5a3a },
    { key: "color", label: "Leaves", type: "color", default: 0x4a7a30 }] });

  register("glowcap_mushroom", function (o) {
    const g = new THREE.Group(); const stem = M.plaster(0xe8e0d0); const cap = glow(_c(o.glow, 0x6ad6c0), 1.0);
    for (let i = 0; i < o.count; i++) { const x = rand(-0.3, 0.3), z = rand(-0.3, 0.3), h = rand(0.12, 0.3), r = rand(0.06, 0.12);
      g.add(_cyl(0.025, 0.035, h, stem, [x, h / 2, z], 6)); const c = _sph(r, cap, [x, h, z], 10); c.scale.y = 0.6; g.add(c); }
    return g;
  }, { icon: "⊕", category: "wizard plants", params: [
    { key: "count", label: "Caps", type: "int", min: 2, max: 12, step: 1, default: 5 },
    { key: "glow", label: "Glow", type: "color", default: 0x6ad6c0 }] });

  register("snapping_flower", function (o) {
    const g = new THREE.Group(); const pot = M.ceramic(0x6a4a3a);
    g.add(_cyl(0.14, 0.1, 0.18, pot, [0, 0.09, 0], 12)); g.add(_cyl(0.15, 0.14, 0.03, pot, [0, 0.18, 0], 12));
    const stem = M.leaf(0x3a6a30); const st = _cyl(0.025, 0.035, 0.5, stem, [0, 0.43, 0], 6); st.rotation.z = 0.2; g.add(st);
    const head = M.cloth(_c(o.color, 0xd62a6a));
    const lower = _sph(0.1, head, [0.08, 0.66, 0], 10); lower.scale.y = 0.6; g.add(lower);
    const upper = _sph(0.1, head, [0.08, 0.74, 0], 10); upper.scale.y = 0.6; g.add(upper);
    for (let i = 0; i < 6; i++) { const a = -0.6 + i * 0.24; g.add(_cone(0.012, 0.04, M.bone(), [0.08 + Math.cos(a) * 0.08, 0.7, Math.sin(a) * 0.08 + 0.06], 4)); }
    g.add(_sph(0.03, glow(0xd6c020, 0.8), [0.08, 0.7, 0.04], 6));
    for (const sx of [-1, 1]) { const lf = _cone(0.04, 0.2, stem, [sx * 0.1, 0.35, 0], 4); lf.rotation.z = sx * 0.8; g.add(lf); }
    return g;
  }, { icon: "❧", category: "wizard plants", params: [
    { key: "color", label: "Flower", type: "color", default: 0xd62a6a }] });

  register("drying_herbs", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x3a2414); const W = o.width, y = o.height;
    const rod = _cyl(0.02, 0.02, W, wd, [0, y, 0], 6); rod.rotation.z = Math.PI / 2; g.add(rod);
    const cols = [0x4a7a2a, 0x6a8a3a, 0x7a6a2a, 0x5a7a4a]; const n = Math.max(3, Math.round(W / 0.18));
    for (let i = 0; i < n; i++) { const x = -W / 2 + 0.1 + i * ((W - 0.2) / (n - 1)); const bun = _cone(0.05, 0.3, M.leaf(pick(cols)), [x, y - 0.16, 0], 6); bun.rotation.x = Math.PI; g.add(bun); g.add(_cyl(0.008, 0.008, 0.06, M.cloth(0x6a5a3a), [x, y - 0.02, 0], 4)); }
    return g;
  }, { icon: "🌿", category: "wizard plants", params: [
    { key: "width", label: "Span", type: "number", min: 0.6, max: 3, step: 0.1, default: 1.2 },
    { key: "height", label: "Hang", type: "number", min: 1, max: 2.5, step: 0.1, default: 1.8 }] });

  register("glowing_vine", function (o) {
    const g = new THREE.Group(); const pot = M.ceramic(_c(o.pot, 0x8a4a2a)), lf = M.leaf(0x3a6a2a);
    g.add(_cyl(0.16, 0.12, 0.22, pot, [0, 0.11, 0], 14)); g.add(_cyl(0.17, 0.17, 0.03, pot, [0, 0.22, 0], 14)); g.add(_cyl(0.14, 0.14, 0.02, M.stone(0x3a2a1a), [0, 0.21, 0], 12));
    g.add(_cyl(0.015, 0.015, 0.9, M.wood(0x4a3018), [0, 0.65, 0], 6));
    const gm = glow(_c(o.glow, 0x8aff6a), 1.4);
    for (let i = 0; i < 16; i++) { const t = i / 15; const a = i * 0.9; const x = Math.cos(a) * 0.06, z = Math.sin(a) * 0.06, yy = 0.25 + t * 0.8; g.add(_sph(0.025, lf, [x, yy, z], 6)); if (i % 3 === 0) g.add(_sph(0.03, gm, [x * 1.4, yy, z * 1.4], 8)); }
    return g;
  }, { icon: "🌱", category: "wizard plants", params: [
    { key: "pot", label: "Pot", type: "color", default: 0x8a4a2a },
    { key: "glow", label: "Buds", type: "color", default: 0x8aff6a }] });

  register("giant_toadstool", function (o) {
    const g = new THREE.Group(); const stem = M.ceramic(0xe8e0d0); const cap = M.ceramic(_c(o.color, 0xd63a3a)); const H = o.height;
    g.add(_cyl(0.1, 0.14, H, stem, [0, H / 2, 0], 12));
    const dome = _sph(0.4, cap, [0, H + 0.1, 0], 16); dome.scale.y = 0.6; g.add(dome);
    g.add(_cyl(0.36, 0.1, 0.06, M.cloth(0xe8d0b0), [0, H + 0.02, 0], 16));
    for (let i = 0; i < 8; i++) { const a = rand(0, Math.PI * 2), r = rand(0.1, 0.32); g.add(_sph(0.05, M.plaster(0xf0ece0), [Math.cos(a) * r, H + 0.18, Math.sin(a) * r], 8)); }
    g.add(_cyl(0.3, 0.3, 0.02, glow(_c(o.glow, 0x8aff6a), 0.8), [0, H, 0], 16));
    return g;
  }, { icon: "🍄", category: "wizard plants", params: [
    { key: "height", label: "Stem", type: "number", min: 0.3, max: 1.2, step: 0.1, default: 0.6 },
    { key: "color", label: "Cap", type: "color", default: 0xd63a3a },
    { key: "glow", label: "Glow", type: "color", default: 0x8aff6a }] });

  register("herb_planter", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a3a1a)), soil = M.stone(0x2a1a10); const W = o.width;
    g.add(_box(W, 0.16, 0.18, wd, [0, 0.08, 0]));
    g.add(_box(W - 0.04, 0.04, 0.14, soil, [0, 0.15, 0]));
    const cols = [0x3a7a2a, 0x4a8a3a, 0x5a7a2a, 0x6a8a4a]; const n = Math.max(3, Math.round(W / 0.14));
    for (let i = 0; i < n; i++) { const x = -W / 2 + 0.08 + i * ((W - 0.16) / (n - 1)); const lf = M.leaf(pick(cols));
      g.add(_sph(0.06, lf, [x, 0.22, rand(-0.03, 0.03)], 8)); g.add(_cyl(0.01, 0.01, 0.1, lf, [x, 0.2, 0], 5));
      if (i % 2) g.add(_sph(0.03, glow(pick([0xff8a6a, 0x8aff6a, 0xffd24a]), 0.5), [x, 0.27, 0], 6)); }
    return g;
  }, { icon: "🪴", category: "wizard plants", params: [
    { key: "width", label: "Width", type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.6 },
    { key: "color", label: "Box", type: "color", default: 0x5a3a1a }] });

  register("plain_pumpkin", function (o) {
    const g = new THREE.Group(); const pk = M.ceramic(_c(o.color, 0xd6791a));
    const body = _sph(0.22, pk, [0, 0.2, 0], 16); body.scale.y = 0.8; g.add(body);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; g.add(_sph(0.04, M.ceramic(0xc06914), [Math.cos(a) * 0.2, 0.2, Math.sin(a) * 0.2], 8)); }
    g.add(_cyl(0.03, 0.045, 0.1, M.wood(0x4a5a2a), [0, 0.4, 0], 6));
    return g;
  }, { icon: "🎃", category: "wizard plants", params: [
    { key: "color", label: "Rind", type: "color", default: 0xd6791a }] });

  register("potted_fern", function (o) {
    const g = new THREE.Group(); const pot = M.ceramic(_c(o.pot, 0x8a4a2a)), lf = M.leaf(_c(o.color, 0x3a7a2a));
    g.add(_cyl(0.14, 0.1, 0.2, pot, [0, 0.1, 0], 14));
    g.add(_cyl(0.15, 0.15, 0.03, pot, [0, 0.2, 0], 14));
    for (let i = 0; i < o.fronds; i++) { const a = i * Math.PI * 2 / o.fronds + rand(-0.2, 0.2), tilt = 0.5 + rand(0, 0.3);
      for (let k = 0; k < 4; k++) { const r = 0.05 + k * 0.08, h = 0.25 + k * 0.1; const leaf = _box(0.12, 0.02, 0.05, lf, [Math.cos(a) * r, h, Math.sin(a) * r]); leaf.rotation.y = -a; leaf.rotation.z = tilt - k * 0.15; g.add(leaf); } }
    return g;
  }, { icon: "🌿", category: "wizard plants", params: [
    { key: "fronds", label: "Fronds", type: "int", min: 3, max: 10, step: 1, default: 6 },
    { key: "color", label: "Leaves", type: "color", default: 0x3a7a2a },
    { key: "pot", label: "Pot", type: "color", default: 0x8a4a2a }] });

  register("hanging_planter", function (o) {
    const g = new THREE.Group(); const pot = M.ceramic(_c(o.color, 0x8a6a4a)), rope = M.rope(0x8a7a60), lf = M.leaf(_c(o.leaf, 0x3a7a3a));
    const swing = new THREE.Group();
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const r = _cyl(0.004, 0.004, 0.5, rope, [Math.cos(a) * 0.12, -0.25, Math.sin(a) * 0.12], 4); r.rotation.z = -Math.cos(a) * 0.2; r.rotation.x = Math.sin(a) * 0.2; swing.add(r); }
    swing.add(_cyl(0.13, 0.1, 0.14, pot, [0, -0.5, 0], 14));
    for (let i = 0; i < 10; i++) { const a = rand(0, Math.PI * 2); const vine = _cyl(0.01, 0.005, rand(0.2, 0.5), lf, [Math.cos(a) * 0.1, -0.7, Math.sin(a) * 0.1], 4); swing.add(vine); }
    swing.position.y = 1.4; g.add(swing);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; swing.rotation.z = Math.sin(t * 0.8) * 0.06; swing.rotation.x = Math.sin(t * 0.6) * 0.05; };
    return g;
  }, { icon: "🌿", category: "wizard plants", params: [
    { key: "color", label: "Pot", type: "color", default: 0x8a6a4a },
    { key: "leaf", label: "Vines", type: "color", default: 0x3a7a3a }] });

  register("writhing_vine", function (o) {
    const g = new THREE.Group(); const pot = M.ceramic(0x6a4a2a), st = M.leaf(_c(o.color, 0x2a5a2a));
    g.add(_cyl(0.16, 0.13, 0.2, pot, [0, 0.1, 0], 14));
    g.add(_cyl(0.15, 0.15, 0.04, M.stone(0x3a2a1a), [0, 0.18, 0], 14));
    const tendrils = [];
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const tnd = new THREE.Group(); let y = 0;
      for (let s = 0; s < 5; s++) { tnd.add(_cyl(0.02 - s * 0.003, 0.018 - s * 0.003, 0.1, st, [0, y + 0.05, 0], 5)); y += 0.09; }
      tnd.position.set(Math.cos(a) * 0.06, 0.2, Math.sin(a) * 0.06); g.add(tnd); tendrils.push({ t: tnd, ph: i * 1.2 }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; tendrils.forEach((td) => { td.t.rotation.x = Math.sin(t * 1.4 + td.ph) * 0.4; td.t.rotation.z = Math.cos(t * 1.1 + td.ph) * 0.4; }); };
    return g;
  }, { icon: "🌱", category: "wizard plants", params: [
    { key: "color", label: "Vine", type: "color", default: 0x2a5a2a }] });

  register("gulping_blossom", function (o) {
    const g = new THREE.Group(); const st = M.leaf(0x3a6a3a), pet = M.leaf(_c(o.color, 0xc83a6a));
    g.add(_cyl(0.13, 0.16, 0.16, M.ceramic(0x7a5a3a), [0, 0.08, 0], 12));
    const stem = _cyl(0.03, 0.04, 0.5, st, [0, 0.4, 0], 6); stem.rotation.z = 0.1; g.add(stem);
    const head = new THREE.Group();
    const lower = new THREE.Group(), upper = new THREE.Group();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; lower.add(_cone(0.04, 0.16, pet, [Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06], 5)); lower.children[i].rotation.x = Math.PI - 0.6; lower.children[i].rotation.y = -a; }
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; upper.add(_cone(0.04, 0.16, pet, [Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06], 5)); upper.children[i].rotation.x = 0.6; upper.children[i].rotation.y = -a; }
    head.add(lower); head.add(upper); head.position.set(0.06, 0.66, 0); g.add(head);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const open = (Math.sin(t * 1.5) + 1) / 2 * 0.5; upper.rotation.x = -open; lower.rotation.x = open; };
    return g;
  }, { icon: "🌸", category: "wizard plants", params: [
    { key: "color", label: "Petals", type: "color", default: 0xc83a6a }] });

  register("watering_can", function (o) {
    const g = new THREE.Group(); const m = M.metal(_c(o.color, 0x4a6a5a));
    g.add(_cyl(0.14, 0.16, 0.22, m, [0, 0.11, 0], 14));
    const spout = _cyl(0.025, 0.04, 0.34, m, [0.22, 0.16, 0], 8); spout.rotation.z = -0.7; g.add(spout);
    g.add(_cyl(0.05, 0.05, 0.02, m, [0.36, 0.27, 0], 10)); g.children[g.children.length - 1].rotation.z = -0.7;
    g.add(_tor(0.07, 0.012, m, [0, 0.26, 0], 6, 14));     // top rim
    const h = _tor(0.08, 0.012, m, [-0.04, 0.2, 0], 6, 14); h.rotation.y = Math.PI / 2; g.add(h); // handle
    return g;
  }, { icon: "🚿", category: "wizard plants", params: [
    { key: "color", label: "Metal", type: "color", default: 0x4a6a5a }] });
})();
