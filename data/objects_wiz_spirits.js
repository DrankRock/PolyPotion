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

  register("spectral_horse", function (o) {
    const g = new THREE.Group();
    const col = _c(o.color, 0x9ab0c8);
    const m = tglow(col, 0.5, 0.42);
    const bright = glow(0xbfe0ff, 1.4);
    const horse = new THREE.Group();

    const body = _sph(0.26, m, [0, 0, 0], 14); body.scale.set(1.7, 1.0, 0.85); horse.add(body);
    const chest = _sph(0.2, m, [0.34, 0.02, 0], 12); chest.scale.set(1.1, 1.1, 0.9); horse.add(chest);
    const haunch = _sph(0.22, m, [-0.34, 0.03, 0], 12); haunch.scale.set(1.1, 1.15, 0.95); horse.add(haunch);

    const neck = _cyl(0.1, 0.16, 0.42, m, [0.46, 0.22, 0], 10); neck.rotation.z = -0.7; horse.add(neck);

    const head = new THREE.Group();
    const skull = _sph(0.11, m, [0, 0, 0], 12); skull.scale.set(1.2, 1.0, 0.85); head.add(skull);
    const muzzle = _cyl(0.06, 0.085, 0.2, m, [0.13, -0.05, 0], 8); muzzle.rotation.z = -1.2; head.add(muzzle);
    head.add(_sph(0.04, m, [0.22, -0.12, 0], 8));
    for (const sz of [-1, 1]) { const ear = _cone(0.03, 0.1, m, [-0.05, 0.12, sz * 0.05], 6); ear.rotation.z = 0.2; head.add(ear); }
    for (const sz of [-1, 1]) head.add(_sph(0.022, bright, [0.06, 0.02, sz * 0.07], 6));
    head.position.set(0.66, 0.42, 0); horse.add(head);

    for (let i = 0; i < 6; i++) { const tt = i / 6; const mane = _cone(0.018, 0.12, m, [0.46 + tt * 0.18, 0.4 - tt * 0.18, 0], 4); mane.rotation.z = 0.4; horse.add(mane); }

    const legGroups = [];
    for (const sx of [0.32, -0.3]) for (const sz of [-1, 1]) {
      const leg = new THREE.Group();
      leg.add(_cyl(0.045, 0.035, 0.34, m, [0, -0.17, 0], 6));
      leg.add(_cyl(0.03, 0.008, 0.22, m, [0, -0.42, 0], 6));
      leg.position.set(sx, -0.02, sz * 0.13);
      horse.add(leg); legGroups.push({ leg, ph: (sx > 0 ? 0 : Math.PI) + (sz > 0 ? 0 : Math.PI / 2) });
    }

    const tail = new THREE.Group();
    for (let i = 0; i < 5; i++) { const strand = _cyl(0.03, 0.005, 0.5, m, [0, -0.22, 0], 5); strand.position.x = rand(-0.04, 0.04); strand.rotation.z = 0.5 + rand(-0.15, 0.15); strand.rotation.x = rand(-0.2, 0.2); tail.add(strand); }
    tail.position.set(-0.56, 0.12, 0); horse.add(tail);

    const wings = [];
    for (const sz of [-1, 1]) {
      const wing = new THREE.Group();
      for (let i = 0; i < 5; i++) { const f = _cone(0.03, 0.34 - i * 0.04, m, [i * 0.09, i * 0.03, 0], 5); f.rotation.z = Math.PI / 2 + 0.2; wing.add(f); }
      wing.position.set(-0.02, 0.18, sz * 0.18); wing.rotation.x = sz * 0.3;
      horse.add(wing); wings.push({ wing, sz });
    }

    horse.position.y = 0.95; g.add(horse);

    let t = rand(0, 6);
    g.userData.tick = (dt) => {
      t += dt;
      horse.position.y = 0.95 + Math.sin(t * 1.1) * 0.05;
      head.rotation.z = Math.sin(t * 0.7) * 0.12;
      tail.rotation.x = Math.sin(t * 1.4) * 0.25;
      wings.forEach((w) => { w.wing.rotation.x = w.sz * (0.3 + Math.sin(t * 2.2) * 0.4); });
      legGroups.forEach((lg) => { lg.leg.rotation.x = Math.sin(t * 1.6 + lg.ph) * 0.12; });
      m.opacity = 0.36 + (Math.sin(t * 1.5) + 1) / 2 * 0.16;
    };
    return g;
  }, { icon: "🐴", category: "wizard spirits", params: [
    { key: "color", label: "Spirit", type: "color", default: 0x9ab0c8 }] });

  // ════════════════════════════════════════════════════════════
  //  PORTRAITS / FRAMES
  // ════════════════════════════════════════════════════════════

  register("floating_ghost", function (o) {
    const g = new THREE.Group(); const m = ghostMat(_c(o.color, 0xbfe0ff), 0.45, 0.5); const y = o.height;
    g.add(_sph(0.18, m, [0, y + 0.6, 0], 14));
    g.add(_cyl(0.18, 0.28, 0.5, m, [0, y + 0.28, 0], 14));
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; g.add(_sph(0.08, m, [Math.cos(a) * 0.16, y + 0.02, Math.sin(a) * 0.16], 8)); }
    for (const sx of [-1, 1]) { const arm = _cyl(0.05, 0.04, 0.3, m, [sx * 0.22, y + 0.4, 0], 8); arm.rotation.z = sx * 0.6; g.add(arm); g.add(_sph(0.06, m, [sx * 0.32, y + 0.52, 0], 8)); }
    const dk = new THREE.MeshStandardMaterial({ color: 0x0a1420 });
    for (const sx of [-1, 1]) g.add(_sph(0.035, dk, [sx * 0.06, y + 0.62, 0.14], 8));
    g.add(_sph(0.04, dk, [0, y + 0.52, 0.15], 8));
    return g;
  }, { icon: "👻", category: "wizard spirits", params: [
    { key: "height", label: "Hover", type: "number", min: 0.3, max: 2, step: 0.1, default: 0.8 },
    { key: "color", label: "Spirit", type: "color", default: 0xbfe0ff }] });

  register("poltergeist", function (o) {
    const g = new THREE.Group(); const m = ghostMat(_c(o.color, 0xc8ff9a), 0.5, 0.6); const y = o.height;
    const body = _sph(0.18, m, [0, y, 0], 14); body.scale.set(1, 1.2, 1); g.add(body);
    g.add(_sph(0.13, m, [0, y + 0.22, 0.02], 12));
    const dk = new THREE.MeshStandardMaterial({ color: 0x142010 });
    for (const sx of [-1, 1]) g.add(_sph(0.03, dk, [sx * 0.05, y + 0.25, 0.11], 8));
    g.add(_box(0.12, 0.04, 0.03, dk, [0, y + 0.18, 0.12]));
    for (const sx of [-1, 1]) { const arm = _cyl(0.04, 0.03, 0.28, m, [sx * 0.16, y + 0.12, 0], 8); arm.rotation.z = sx * 1.2; g.add(arm); g.add(_sph(0.05, m, [sx * 0.3, y + 0.28, 0], 8)); }
    for (let i = 0; i < 3; i++) g.add(_sph(0.05, m, [rand(-0.1, 0.1), y - 0.2 - i * 0.04, rand(-0.05, 0.05)], 8));
    g.add(_sph(0.05, M.ceramic(0xd64a4a), [0.4, y + 0.1, 0], 10));
    return g;
  }, { icon: "💀", category: "wizard spirits", params: [
    { key: "height", label: "Hover", type: "number", min: 0.5, max: 2, step: 0.1, default: 1.0 },
    { key: "color", label: "Spirit", type: "color", default: 0xc8ff9a }] });

  register("weeping_specter", function (o) {
    const g = new THREE.Group(); const sp = tglow(_c(o.color, 0x9ad0e0), 0.5, 0.4);
    const gh = new THREE.Group();
    gh.add(_sph(0.13, sp, [0, 0.4, 0], 12));            // head
    gh.add(_cyl(0.16, 0.05, 0.6, sp, [0, 0.05, 0], 12)); // body tapering to wisp
    for (const sx of [-1, 1]) { const arm = _cyl(0.04, 0.02, 0.3, sp, [sx * 0.14, 0.2, 0.05], 6); arm.rotation.z = sx * 0.3; arm.rotation.x = -0.8; gh.add(arm); } // hands to face
    gh.position.set(0, o.height, 0); g.add(gh);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; gh.position.y = o.height + Math.sin(t * 1.1) * 0.06; gh.rotation.y = Math.sin(t * 0.5) * 0.2; sp.opacity = 0.3 + (Math.sin(t * 1.7) + 1) / 2 * 0.2; };
    return g;
  }, { icon: "👻", category: "wizard spirits", params: [
    { key: "height", label: "Float Height", type: "number", min: 0.6, max: 2, step: 0.1, default: 1.1 },
    { key: "color", label: "Spirit", type: "color", default: 0x9ad0e0 }] });

  register("spectral_knight", function (o) {
    const g = new THREE.Group(); const sp = tglow(_c(o.color, 0xaad0b0), 0.5, 0.38);
    const gh = new THREE.Group();
    gh.add(_cyl(0.12, 0.1, 0.18, sp, [0, 0.7, 0], 8));   // helm
    gh.add(_box(0.06, 0.12, 0.02, sp, [0, 0.7, 0.1]));   // visor
    gh.add(_cyl(0.18, 0.12, 0.45, sp, [0, 0.4, 0], 8));  // breastplate to wisp
    for (const sx of [-1, 1]) gh.add(_cyl(0.04, 0.03, 0.3, sp, [sx * 0.16, 0.45, 0], 6));
    const sword = _box(0.04, 0.5, 0.02, tglow(0xccf0d0, 0.7, 0.5), [0.2, 0.55, 0.1]); gh.add(sword);
    gh.add(_box(0.16, 0.04, 0.04, sp, [0.2, 0.32, 0.1])); // cross guard
    gh.position.set(0, o.height, 0); g.add(gh);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; gh.position.y = o.height + Math.sin(t * 0.9) * 0.05; sword.rotation.z = Math.sin(t * 0.7) * 0.15; sp.opacity = 0.3 + (Math.sin(t * 1.4) + 1) / 2 * 0.18; };
    return g;
  }, { icon: "⚔", category: "wizard spirits", params: [
    { key: "height", label: "Float Height", type: "number", min: 0.4, max: 1.6, step: 0.1, default: 0.8 },
    { key: "color", label: "Spirit", type: "color", default: 0xaad0b0 }] });

  register("phantom_lady", function (o) {
    const g = new THREE.Group(); const sp = tglow(_c(o.color, 0xc0b0e0), 0.5, 0.36);
    const gh = new THREE.Group();
    gh.add(_sph(0.1, sp, [0, 0.7, 0], 12));
    gh.add(_cone(0.04, 0.18, sp, [0, 0.78, 0], 8));      // hair/veil
    gh.add(_cone(0.26, 0.8, sp, [0, 0.25, 0], 12)); gh.children[2].rotation.x = Math.PI; // flowing gown
    for (const sx of [-1, 1]) { const arm = _cyl(0.03, 0.02, 0.3, sp, [sx * 0.12, 0.5, 0], 6); arm.rotation.z = sx * 0.5; gh.add(arm); }
    gh.position.set(0, o.height, 0); g.add(gh);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; gh.position.y = o.height + Math.sin(t * 0.8) * 0.07; gh.rotation.y += dt * 0.2; gh.children[2].scale.x = 1 + Math.sin(t * 1.5) * 0.06; sp.opacity = 0.28 + (Math.sin(t * 1.6) + 1) / 2 * 0.2; };
    return g;
  }, { icon: "👰", category: "wizard spirits", params: [
    { key: "height", label: "Float Height", type: "number", min: 0.5, max: 1.8, step: 0.1, default: 0.9 },
    { key: "color", label: "Spirit", type: "color", default: 0xc0b0e0 }] });

  register("wraith_hound", function (o) {
    const g = new THREE.Group(); const sp = tglow(_c(o.color, 0x8ac0d0), 0.5, 0.36);
    const gh = new THREE.Group();
    gh.add(_sph(0.12, sp, [0, 0.34, 0.2], 10)); gh.children[0].scale.set(1, 0.9, 1.3); // head
    for (const sx of [-1, 1]) gh.add(_cone(0.04, 0.1, sp, [sx * 0.05, 0.44, 0.2], 5));  // ears
    gh.add(_cyl(0.14, 0.1, 0.4, sp, [0, 0.32, -0.05], 8)); gh.children[gh.children.length - 1].rotation.z = Math.PI / 2; // body
    for (const [x, z] of [[-0.08, 0.12], [0.08, 0.12], [-0.08, -0.2], [0.08, -0.2]]) gh.add(_cyl(0.03, 0.02, 0.25, sp, [x, 0.12, z], 5));
    gh.add(_cone(0.04, 0.3, sp, [0, 0.34, -0.3], 6)); gh.children[gh.children.length - 1].rotation.x = -0.8; // tail
    gh.position.set(0, o.height, 0); g.add(gh);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; gh.position.y = o.height + Math.sin(t * 1.3) * 0.04; sp.opacity = 0.28 + (Math.sin(t * 2) + 1) / 2 * 0.18; };
    return g;
  }, { icon: "🐺", category: "wizard spirits", params: [
    { key: "height", label: "Float Height", type: "number", min: 0.0, max: 1.0, step: 0.1, default: 0.2 },
    { key: "color", label: "Spirit", type: "color", default: 0x8ac0d0 }] });

  // ════════════════════════════════════════════════════════════
  //  SWEETS / SHOP PROPS
  // ════════════════════════════════════════════════════════════

  register("patronus_wisp", function (o) {
    const g = new THREE.Group();
    const body = new THREE.Group(); const sp = tglow(_c(o.color, 0xcfeaff), 1.2, 0.4);
    body.add(_sph(0.1, sp, [0, 0.1, 0.1], 10)); body.children[0].scale.set(1, 0.8, 1.4); // body
    body.add(_sph(0.06, sp, [0, 0.22, 0.26], 8));                // head
    for (const sx of [-1, 1]) { const leg = _cyl(0.02, 0.01, 0.16, sp, [sx * 0.05, 0.0, 0.08], 5); body.add(leg); const leg2 = _cyl(0.02, 0.01, 0.16, sp, [sx * 0.05, 0.0, -0.12], 5); body.add(leg2); }
    const tail = _cone(0.04, 0.22, sp, [0, 0.12, -0.16], 6); tail.rotation.x = -0.8; body.add(tail);
    body.position.set(0, o.height, 0); g.add(body);
    const trail = []; for (let i = 0; i < 5; i++) { const w = _sph(rand(0.02, 0.04), tglow(0xeaf6ff, 1.0, 0.5), [0, o.height, 0], 6); g.add(w); trail.push({ m: w, ph: i * 0.5 }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const x = Math.sin(t * 0.8) * o.range, z = Math.cos(t * 0.6) * o.range; body.position.set(x, o.height + Math.sin(t * 1.5) * 0.1, z); body.rotation.y = Math.atan2(Math.cos(t * 0.8), -Math.sin(t * 0.6)); sp.opacity = 0.3 + (Math.sin(t * 2) + 1) / 2 * 0.2; trail.forEach((w) => { const tt = t - w.ph * 0.3; w.m.position.set(Math.sin(tt * 0.8) * o.range, o.height + Math.sin(tt * 1.5) * 0.1, Math.cos(tt * 0.6) * o.range); w.m.material.opacity = 0.5 * (1 - w.ph / 3); }); };
    return g;
  }, { icon: "🦌", category: "wizard spirits", params: [
    { key: "height", label: "Hover Height", type: "number", min: 0.4, max: 2, step: 0.1, default: 1.0 },
    { key: "range", label: "Drift Range", type: "number", min: 0.1, max: 1, step: 0.05, default: 0.4 },
    { key: "color", label: "Glow", type: "color", default: 0xcfeaff }] });

  // ════════════════════════════════════════════════════════════
  //  LIBRARY / STUDY
  // ════════════════════════════════════════════════════════════

  register("ice_wraith", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xaae4ff);
    const m = tglow(c, 1.0, 0.7);
    const body = new THREE.Group();
    const segs = []; let z = 0;
    for (let i = 0; i < 7; i++) { const s = _cone(0.1 - i * 0.012, 0.18, m, [0, 0, z], 5); s.rotation.x = Math.PI / 2; body.add(s); segs.push({ m: s, ph: i * 0.5 }); z -= 0.13; }
    const head = _cone(0.12, 0.28, m, [0, 0, 0.18], 5); head.rotation.x = -Math.PI / 2; body.add(head);
    for (const sx of [-1, 1]) { const eye = _sph(0.02, glow(0xdff4ff, 1.6), [sx * 0.04, 0.03, 0.22], 6); body.add(eye); }
    body.position.y = o.height; g.add(body);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; body.position.y = o.height + Math.sin(t * 1.5) * 0.08; body.rotation.y = Math.sin(t * 0.6) * 0.5; segs.forEach((s) => { s.m.position.x = Math.sin(t * 2.5 - s.ph) * 0.05; s.m.material.emissiveIntensity = 0.8 + Math.sin(t * 3 + s.ph) * 0.3; }); };
    return g;
  }, { icon: "🐍", category: "wizard spirits", params: [
    { key: "height", label: "Hover Height", type: "number", min: 0.4, max: 2, step: 0.1, default: 0.8 },
    { key: "color", label: "Ice", type: "color", default: 0xaae4ff }] });
})();
