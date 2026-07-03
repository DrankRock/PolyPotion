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

  register("fireball_orb", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xff5a1a);
    const orb = new THREE.Group();
    const core = glow(0xffd24a, 1.9); orb.add(_sph(0.16, core, [0, 0, 0], 14));
    const shellM = tglow(c, 1.4, 0.55); orb.add(_sph(0.24, shellM, [0, 0, 0], 14));
    const embers = [];
    for (let i = 0; i < 8; i++) { const e = _sph(rand(0.02, 0.04), glow(pick([0xff7a1a, 0xffa030]), 1.6), [0, 0, 0], 6); orb.add(e); embers.push({ m: e, a: rand(0, 6.28), r: rand(0.26, 0.36), sp: rand(1.5, 3), yo: rand(-0.2, 0.2) }); }
    orb.position.y = o.height; g.add(orb);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; orb.position.y = o.height + Math.sin(t * 1.6) * 0.05; core.emissiveIntensity = 1.7 + Math.sin(t * 8) * 0.4; const s = 1 + Math.sin(t * 6) * 0.05; orb.scale.setScalar(s); embers.forEach((e) => { e.a += dt * e.sp; e.m.position.set(Math.cos(e.a) * e.r, e.yo + Math.sin(e.a * 1.3) * 0.08, Math.sin(e.a) * e.r); }); };
    return g;
  }, { icon: "🔥", category: "wizard projectiles", params: [
    { key: "height", label: "Hover Height", type: "number", min: 0.4, max: 2.2, step: 0.1, default: 1.2 },
    { key: "color", label: "Flame", type: "color", default: 0xff5a1a }] });

  register("frost_orb", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x6ac0ff);
    const orb = new THREE.Group();
    const core = glow(0xdff4ff, 1.6); orb.add(_sph(0.14, core, [0, 0, 0], 14));
    const shards = [];
    for (let i = 0; i < 10; i++) { const sh = _cone(0.03, rand(0.14, 0.24), tglow(c, 1.2, 0.7), [0, 0, 0], 5); const a = rand(0, 6.28), b = rand(-1, 1); const dx = Math.cos(a) * Math.sqrt(1 - b * b), dy = b, dz = Math.sin(a) * Math.sqrt(1 - b * b); sh.position.set(dx * 0.16, dy * 0.16, dz * 0.16); sh.lookAt && sh.lookAt(dx, dy, dz); orb.add(sh); shards.push({ m: sh, ph: rand(0, 6) }); }
    orb.position.y = o.height; g.add(orb);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; orb.position.y = o.height + Math.sin(t * 1.3) * 0.05; orb.rotation.y += dt * 0.6; core.emissiveIntensity = 1.4 + Math.sin(t * 5) * 0.3; shards.forEach((s) => { s.m.material.emissiveIntensity = 1.0 + Math.sin(t * 4 + s.ph) * 0.4; }); };
    return g;
  }, { icon: "❄", category: "wizard projectiles", params: [
    { key: "height", label: "Hover Height", type: "number", min: 0.4, max: 2.2, step: 0.1, default: 1.2 },
    { key: "color", label: "Frost", type: "color", default: 0x6ac0ff }] });

  register("lightning_orb", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xffe24a);
    const orb = new THREE.Group();
    const core = glow(0xffffcc, 1.9); orb.add(_sph(0.12, core, [0, 0, 0], 12));
    orb.add(_sph(0.2, tglow(c, 1.0, 0.3), [0, 0, 0], 12));
    const arcs = [];
    for (let i = 0; i < 6; i++) { const a = _box(0.015, rand(0.18, 0.3), 0.015, glow(c, 1.8), [0, 0, 0]); const ang = rand(0, 6.28); a.position.set(Math.cos(ang) * 0.12, 0, Math.sin(ang) * 0.12); a.rotation.z = rand(-1, 1); a.rotation.x = rand(-1, 1); orb.add(a); arcs.push({ m: a, ph: rand(0, 6) }); }
    orb.position.y = o.height; g.add(orb);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; orb.position.y = o.height + Math.sin(t * 1.8) * 0.04; core.emissiveIntensity = 1.5 + Math.random() * 0.8; arcs.forEach((ar) => { ar.m.visible = Math.random() > 0.35; ar.m.rotation.z = rand(-1.2, 1.2); ar.m.rotation.x = rand(-1.2, 1.2); }); };
    return g;
  }, { icon: "⚡", category: "wizard projectiles", params: [
    { key: "height", label: "Hover Height", type: "number", min: 0.4, max: 2.2, step: 0.1, default: 1.2 },
    { key: "color", label: "Spark", type: "color", default: 0xffe24a }] });

  register("conjured_sword", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x7a5aff);
    const sw = new THREE.Group(); const m = tglow(c, 1.3, 0.55), edge = glow(c, 1.7);
    const blade = _box(0.06, 0.8, 0.02, m, [0, 0.4, 0]); sw.add(blade);
    sw.add(_cone(0.06, 0.14, m, [0, 0.87, 0], 4));
    sw.add(_box(0.26, 0.05, 0.05, edge, [0, -0.02, 0]));       // crossguard
    sw.add(_cyl(0.025, 0.025, 0.16, m, [0, -0.11, 0], 6));     // grip
    sw.add(_sph(0.04, edge, [0, -0.21, 0], 8));                // pommel
    sw.position.y = o.height; g.add(sw);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; sw.position.y = o.height + Math.sin(t * 1.2) * 0.06; sw.rotation.y += dt * 0.7; m.opacity = 0.45 + (Math.sin(t * 2) + 1) / 2 * 0.25; edge.emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.4; };
    return g;
  }, { icon: "🗡", category: "wizard projectiles", params: [
    { key: "height", label: "Hover Height", type: "number", min: 0.4, max: 2, step: 0.1, default: 1.0 },
    { key: "color", label: "Bound", type: "color", default: 0x7a5aff }] });

  // ════════════════════════════════════════════════════════════
  //  FLOOR RUNES & GLYPHS  (Skyrim ward / rune-spell style)
  // ════════════════════════════════════════════════════════════

  function makeRune(o, def) {
    const g = new THREE.Group(); const c = _c(o.color, def);
    const ring = glow(c, 1.3);
    const r1 = _tor(o.size, 0.02, ring, [0, 0.02, 0], 6, 36); r1.rotation.x = Math.PI / 2; g.add(r1);
    const r2 = _tor(o.size * 0.7, 0.015, ring, [0, 0.02, 0], 6, 30); r2.rotation.x = Math.PI / 2; g.add(r2);
    const inner = new THREE.Group();
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const mark = _box(0.04, 0.005, o.size * 0.5, glow(c, 1.3), [0, 0.02, 0]); mark.position.set(Math.cos(a) * o.size * 0.35, 0.02, Math.sin(a) * o.size * 0.35); mark.rotation.y = -a; inner.add(mark); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; inner.add(_box(0.03, 0.005, 0.1, glow(c, 1.3), [Math.cos(a) * o.size * 0.85, 0.02, Math.sin(a) * o.size * 0.85])); }
    g.add(inner);
    let t = rand(0, 6), flare = 0;
    g.userData.tick = (dt) => { t += dt; inner.rotation.y += dt * 0.3; const base = 1.0 + (Math.sin(t * 2) + 1) / 2 * 0.6; if (flare > 0) flare -= dt; else if (Math.random() < 0.006) flare = 0.4; const ei = flare > 0 ? 2.6 : base; ring.emissiveIntensity = ei; };
    return g;
  }

  register("chain_lightning", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xffe24a);
    const nodes = []; const nodeM = glow(0xffffcc, 1.8);
    const n = Math.round(o.nodes);
    const xs = [];
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * (o.span / (n - 1)); const y = o.height + rand(-0.15, 0.15); xs.push([x, y]); const node = _sph(0.05, nodeM, [x, y, rand(-0.1, 0.1)], 8); g.add(node); nodes.push(node); }
    const bolts = [];
    for (let i = 0; i < n - 1; i++) { const seg = new THREE.Group(); const steps = 4; for (let s = 0; s < steps; s++) { const b = _box(0.02, 0.02, 0.02, glow(c, 1.7), [0, 0, 0]); seg.add(b); } g.add(seg); bolts.push({ seg, a: xs[i], b: xs[i + 1] }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; nodes.forEach((nd) => { nd.material.emissiveIntensity = 1.4 + Math.random() * 0.8; }); bolts.forEach((bo) => { const [ax, ay] = bo.a, [bx, by] = bo.b; const steps = bo.seg.children.length; bo.seg.children.forEach((seg, s) => { const f = (s + 0.5) / steps; const x = ax + (bx - ax) * f + rand(-0.05, 0.05); const y = ay + (by - ay) * f + rand(-0.08, 0.08); seg.position.set(x, y, rand(-0.05, 0.05)); const len = (o.span / (steps * (xs.length - 1))) * 1.2; seg.scale.y = 1; seg.scale.x = len / 0.02; seg.visible = Math.random() > 0.2; seg.material.emissiveIntensity = 1.4 + Math.random(); }); }); };
    return g;
  }, { icon: "⚡", category: "wizard projectiles", params: [
    { key: "nodes", label: "Arc Points", type: "int", min: 2, max: 6, default: 4 },
    { key: "span", label: "Span", type: "number", min: 1, max: 4, step: 0.1, default: 2 },
    { key: "height", label: "Height", type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.2 },
    { key: "color", label: "Spark", type: "color", default: 0xffe24a }] });

  register("magic_missile", function (o) {
    return missileStream(o, (oo, size) => {
      const m = new THREE.Group(); const c = _c(oo.color, 0x6a8aff);
      const head = _sph(size, glow(c, 1.8), [0, 0, 0], 10); m.add(head);
      const halo = _sph(size * 1.7, tglow(c, 1.2, 0.4), [0, 0, 0], 10); m.add(halo);
      // tapered comet tail behind (-X)
      for (let k = 0; k < 5; k++) { const t = _sph(size * (0.8 - k * 0.13), tglow(c, 1.4, 0.5 - k * 0.08), [-size * (k + 1) * 1.3, 0, 0], 8); m.add(t); }
      tagOpacity(m);
      m.userData.spin = () => {};
      return m;
    });
  }, { icon: "🔵", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0x6a8aff },
    { key: "size", label: "Size", type: "number", min: 0.03, max: 0.25, step: 0.01, default: 0.08 },
    { key: "range", label: "Range", type: "number", min: 1, max: 8, step: 0.5, default: 4 },
    { key: "speed", label: "Speed", type: "number", min: 0.1, max: 2, step: 0.05, default: 0.7 },
    { key: "count", label: "Count", type: "int", min: 1, max: 8, default: 3 },
    { key: "height", label: "Height", type: "number", min: 0.2, max: 2.5, step: 0.1, default: 1.2 }] });

  register("fire_bolt", function (o) {
    return missileStream(o, (oo, size) => {
      const m = new THREE.Group(); const c = _c(oo.color, 0xff5a1a);
      const head = _sph(size, glow(0xffd24a, 1.9), [0, 0, 0], 10); m.add(head);
      const flame = _cone(size * 1.4, size * 4, tglow(c, 1.5, 0.6), [-size * 2, 0, 0], 6); flame.rotation.z = Math.PI / 2; m.add(flame);
      for (let k = 0; k < 4; k++) { const e = _sph(size * 0.4, tglow(pick([0xff7a1a, 0xffb030]), 1.5, 0.6), [-size * (k + 1) * 1.6, rand(-size, size) * 0.6, 0], 6); m.add(e); }
      tagOpacity(m);
      let ft = rand(0, 6);
      m.userData.spin = (dt) => { ft += dt; flame.scale.x = 1 + Math.sin(ft * 12) * 0.15; };
      return m;
    });
  }, { icon: "🔥", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0xff5a1a },
    { key: "size", label: "Size", type: "number", min: 0.03, max: 0.25, step: 0.01, default: 0.09 },
    { key: "range", label: "Range", type: "number", min: 1, max: 8, step: 0.5, default: 4 },
    { key: "speed", label: "Speed", type: "number", min: 0.1, max: 2, step: 0.05, default: 0.8 },
    { key: "count", label: "Count", type: "int", min: 1, max: 8, default: 2 },
    { key: "height", label: "Height", type: "number", min: 0.2, max: 2.5, step: 0.1, default: 1.2 }] });

  register("ice_lance", function (o) {
    return missileStream(o, (oo, size) => {
      const m = new THREE.Group(); const c = _c(oo.color, 0x8ad0ff);
      const shaft = _cone(size, size * 6, tglow(c, 1.4, 0.75), [0, 0, 0], 6); shaft.rotation.z = -Math.PI / 2; m.add(shaft);
      const tip = _sph(size * 0.5, glow(0xdff4ff, 1.7), [size * 3, 0, 0], 8); m.add(tip);
      for (let k = 0; k < 3; k++) { const fr = _cone(size * 0.4, size * 1.5, tglow(c, 1.2, 0.6), [-size * (k + 1) * 1.5, 0, 0], 5); fr.rotation.z = -Math.PI / 2; m.add(fr); }
      tagOpacity(m);
      m.userData.spin = () => { m.rotation.x += 0.05; };
      return m;
    });
  }, { icon: "❄", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0x8ad0ff },
    { key: "size", label: "Size", type: "number", min: 0.03, max: 0.2, step: 0.01, default: 0.07 },
    { key: "range", label: "Range", type: "number", min: 1, max: 8, step: 0.5, default: 4.5 },
    { key: "speed", label: "Speed", type: "number", min: 0.1, max: 2.5, step: 0.05, default: 1.0 },
    { key: "count", label: "Count", type: "int", min: 1, max: 6, default: 2 },
    { key: "height", label: "Height", type: "number", min: 0.2, max: 2.5, step: 0.1, default: 1.2 }] });

  register("spark_bolt", function (o) {
    return missileStream(o, (oo, size) => {
      const m = new THREE.Group(); const c = _c(oo.color, 0xffe24a);
      const head = _sph(size, glow(0xffffcc, 1.9), [0, 0, 0], 10); m.add(head);
      const halo = _sph(size * 1.8, tglow(c, 1.0, 0.3), [0, 0, 0], 10); m.add(halo);
      const arcs = [];
      for (let k = 0; k < 4; k++) { const a = _box(size * 0.3, size * 2.5, size * 0.3, glow(c, 1.7), [-size * (k + 0.5) * 1.4, 0, 0]); a.rotation.z = rand(-1, 1); m.add(a); arcs.push(a); }
      tagOpacity(m);
      m.userData.spin = () => { arcs.forEach((a) => { a.visible = Math.random() > 0.3; a.rotation.z = rand(-1.2, 1.2); }); };
      return m;
    });
  }, { icon: "⚡", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0xffe24a },
    { key: "size", label: "Size", type: "number", min: 0.03, max: 0.2, step: 0.01, default: 0.07 },
    { key: "range", label: "Range", type: "number", min: 1, max: 8, step: 0.5, default: 5 },
    { key: "speed", label: "Speed", type: "number", min: 0.1, max: 3, step: 0.05, default: 1.4 },
    { key: "count", label: "Count", type: "int", min: 1, max: 8, default: 3 },
    { key: "height", label: "Height", type: "number", min: 0.2, max: 2.5, step: 0.1, default: 1.2 }] });

  register("poison_glob", function (o) {
    return missileStream(o, (oo, size) => {
      const m = new THREE.Group(); const c = _c(oo.color, 0x6ac02a);
      const head = _sph(size, tglow(c, 1.3, 0.75), [0, 0, 0], 10); head.scale.set(1.2, 0.9, 0.9); m.add(head);
      const core = _sph(size * 0.5, glow(0xcaff6a, 1.5), [0, 0, 0], 8); m.add(core);
      const drips = [];
      for (let k = 0; k < 4; k++) { const d = _sph(size * rand(0.2, 0.4), tglow(c, 1.1, 0.6), [-size * (k + 1) * 1.2, rand(-size, 0), rand(-size, size) * 0.5], 6); m.add(d); drips.push({ m: d, ph: rand(0, 6) }); }
      tagOpacity(m);
      drips.forEach((d) => { d.y0 = d.m.position.y; });
      let pt = rand(0, 6);
      m.userData.spin = (dt) => { pt += dt; drips.forEach((d) => { d.m.position.y = d.y0 + Math.sin(pt * 5 + d.ph) * 0.01; }); };
      return m;
    });
  }, { icon: "🧪", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0x6ac02a },
    { key: "size", label: "Size", type: "number", min: 0.04, max: 0.25, step: 0.01, default: 0.1 },
    { key: "range", label: "Range", type: "number", min: 1, max: 8, step: 0.5, default: 3.5 },
    { key: "speed", label: "Speed", type: "number", min: 0.1, max: 1.5, step: 0.05, default: 0.55 },
    { key: "count", label: "Count", type: "int", min: 1, max: 6, default: 2 },
    { key: "height", label: "Height", type: "number", min: 0.2, max: 2.5, step: 0.1, default: 1.2 }] });

  register("shadow_bolt", function (o) {
    return missileStream(o, (oo, size) => {
      const m = new THREE.Group(); const c = _c(oo.color, 0x6a2a9a);
      const head = _sph(size, tglow(c, 1.0, 0.8), [0, 0, 0], 10); m.add(head);
      const core = _sph(size * 0.55, _c(oo.core, 0x1a0a2a) === undefined ? glow(0x1a0a2a, 0.6) : glow(_c(oo.core, 0x1a0a2a), 0.6), [0, 0, 0], 8); m.add(core);
      const rim = _tor(size * 1.4, size * 0.18, glow(_c(oo.edge, 0xc04aff), 1.4), [0, 0, 0], 6, 18); m.add(rim);
      for (let k = 0; k < 5; k++) { const t = _sph(size * (0.7 - k * 0.1), tglow(c, 0.9, 0.5 - k * 0.08), [-size * (k + 1) * 1.4, rand(-size, size) * 0.4, 0], 8); m.add(t); }
      tagOpacity(m);
      m.userData.spin = () => { rim.rotation.x += 0.08; rim.rotation.y += 0.05; };
      return m;
    });
  }, { icon: "🟣", category: "wizard projectiles", params: [
    { key: "color", label: "Shadow", type: "color", default: 0x6a2a9a },
    { key: "edge", label: "Edge", type: "color", default: 0xc04aff },
    { key: "size", label: "Size", type: "number", min: 0.04, max: 0.25, step: 0.01, default: 0.1 },
    { key: "range", label: "Range", type: "number", min: 1, max: 8, step: 0.5, default: 4 },
    { key: "speed", label: "Speed", type: "number", min: 0.1, max: 2, step: 0.05, default: 0.7 },
    { key: "count", label: "Count", type: "int", min: 1, max: 6, default: 2 },
    { key: "height", label: "Height", type: "number", min: 0.2, max: 2.5, step: 0.1, default: 1.2 }] });

  register("holy_lance", function (o) {
    return missileStream(o, (oo, size) => {
      const m = new THREE.Group(); const c = _c(oo.color, 0xfff0c0);
      const beam = _cyl(size * 0.5, size * 0.3, size * 8, tglow(c, 1.6, 0.55), [0, 0, 0], 8); beam.rotation.z = Math.PI / 2; m.add(beam);
      const head = _sph(size, glow(0xffffff, 1.9), [size * 3.5, 0, 0], 10); m.add(head);
      // small radiant cross at the tip
      const cv = _box(size * 0.4, size * 1.6, size * 0.4, glow(c, 1.6), [size * 3.5, 0, 0]); m.add(cv);
      const ch = _box(size * 1.4, size * 0.4, size * 0.4, glow(c, 1.6), [size * 3.5, 0, 0]); m.add(ch);
      tagOpacity(m);
      m.userData.spin = () => {};
      return m;
    });
  }, { icon: "✨", category: "wizard projectiles", params: [
    { key: "color", label: "Light", type: "color", default: 0xfff0c0 },
    { key: "size", label: "Size", type: "number", min: 0.03, max: 0.18, step: 0.01, default: 0.06 },
    { key: "range", label: "Range", type: "number", min: 1, max: 9, step: 0.5, default: 5.5 },
    { key: "speed", label: "Speed", type: "number", min: 0.1, max: 3, step: 0.05, default: 1.6 },
    { key: "count", label: "Count", type: "int", min: 1, max: 5, default: 1 },
    { key: "height", label: "Height", type: "number", min: 0.2, max: 2.5, step: 0.1, default: 1.3 }] });

  // ════════════════════════════════════════════════════════════
  //  HOMING / ORBITING PROJECTILE SWARMS
  // ════════════════════════════════════════════════════════════

  register("seeker_swarm", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x6a8aff);
    const orbit = new THREE.Group(); orbit.position.y = o.height; g.add(orbit);
    const seekers = []; const n = Math.round(o.count);
    for (let i = 0; i < n; i++) {
      const s = new THREE.Group();
      const head = _sph(o.size, glow(c, 1.8), [0, 0, 0], 8); s.add(head);
      const tail = _sph(o.size * 0.6, tglow(c, 1.4, 0.5), [0, 0, 0], 6); tail.userData._o0 = 0.5; s.add(tail);
      orbit.add(s);
      seekers.push({ s, tail, a: i / n * Math.PI * 2, r: o.radius * rand(0.8, 1.1), yo: rand(-0.2, 0.2), sp: rand(0.8, 1.3) });
    }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; seekers.forEach((sk) => { sk.a += dt * sk.sp; const px = Math.cos(sk.a) * sk.r, pz = Math.sin(sk.a) * sk.r, py = sk.yo + Math.sin(t * 2 + sk.a) * 0.15; sk.tail.position.set(sk.s.position.x - (px - sk.s.position.x), 0, 0); sk.s.position.set(px, py, pz); }); };
    return g;
  }, { icon: "🔵", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0x6a8aff },
    { key: "size", label: "Size", type: "number", min: 0.03, max: 0.2, step: 0.01, default: 0.07 },
    { key: "radius", label: "Orbit Radius", type: "number", min: 0.3, max: 2, step: 0.1, default: 0.8 },
    { key: "count", label: "Count", type: "int", min: 2, max: 12, default: 5 },
    { key: "height", label: "Height", type: "number", min: 0.3, max: 2.5, step: 0.1, default: 1.3 }] });

  register("orbiting_wisps", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0x9a6aff);
    const orbit = new THREE.Group(); orbit.position.y = o.height; g.add(orbit);
    const wisps = []; const n = Math.round(o.count);
    for (let i = 0; i < n; i++) { const w = _sph(o.size, glow(c, 1.6), [0, 0, 0], 8); orbit.add(w); const trail = []; for (let k = 0; k < 4; k++) { const tr = _sph(o.size * (0.7 - k * 0.13), tglow(c, 1.3, 0.5 - k * 0.1), [0, 0, 0], 6); orbit.add(tr); trail.push(tr); } wisps.push({ w, trail, a: i / n * Math.PI * 2, tilt: rand(-0.5, 0.5) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; wisps.forEach((wi) => { wi.a += dt * o.speed; const r = o.radius; const x = Math.cos(wi.a) * r, z = Math.sin(wi.a) * r, y = Math.sin(wi.a) * wi.tilt * r; wi.w.position.set(x, y, z); wi.trail.forEach((tr, k) => { const la = wi.a - (k + 1) * 0.18; tr.position.set(Math.cos(la) * r, Math.sin(la) * wi.tilt * r, Math.sin(la) * r); }); }); };
    return g;
  }, { icon: "💫", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0x9a6aff },
    { key: "size", label: "Size", type: "number", min: 0.03, max: 0.18, step: 0.01, default: 0.06 },
    { key: "radius", label: "Orbit Radius", type: "number", min: 0.3, max: 1.8, step: 0.1, default: 0.7 },
    { key: "speed", label: "Speed", type: "number", min: 0.2, max: 3, step: 0.1, default: 1.2 },
    { key: "count", label: "Count", type: "int", min: 1, max: 8, default: 3 },
    { key: "height", label: "Height", type: "number", min: 0.3, max: 2.5, step: 0.1, default: 1.3 }] });

  // ════════════════════════════════════════════════════════════
  //  LAUNCHERS / TURRETS  (static caster that emits the bolt)
  // ════════════════════════════════════════════════════════════

  register("arcane_turret", function (o) {
    const g = new THREE.Group(); const st = M.stone(0x3a3640), c = _c(o.color, 0x6a8aff);
    g.add(_cyl(0.26, 0.32, 0.5, st, [0, 0.25, 0], 10));
    g.add(_cyl(0.2, 0.24, 0.1, M.brass(0xc8a050), [0, 0.55, 0], 10));
    // floating crystal emitter
    const emitter = new THREE.Group();
    const cry = _cone(0.1, 0.26, glow(c, 1.6), [0, 0, 0], 6); emitter.add(cry);
    const cry2 = _cone(0.1, 0.18, glow(c, 1.6), [0, -0.06, 0], 6); cry2.rotation.x = Math.PI; emitter.add(cry2);
    emitter.position.y = 0.85; g.add(emitter);
    // a stream of bolts firing out +X over range
    const range = o.range, bolts = []; const n = 4;
    for (let i = 0; i < n; i++) { const b = _sph(o.size, glow(c, 1.8), [0, 0.85, 0], 8); const halo = _sph(o.size * 1.6, tglow(c, 1.1, 0.4), [0, 0.85, 0], 8); halo.userData._o0 = 0.4; g.add(b); g.add(halo); bolts.push({ b, halo, off: i / n }); }
    let t = rand(0, 6), phase = rand(0, 1);
    g.userData.tick = (dt) => { t += dt; phase += dt * o.speed; if (phase >= 1) phase -= 1; emitter.rotation.y += dt * 1.0; cry.material.emissiveIntensity = 1.4 + Math.sin(t * 4) * 0.4; bolts.forEach((bo) => { let p = (phase + bo.off) % 1; bo.b.position.x = p * range; bo.halo.position.x = p * range; const fade = p < 0.08 ? p / 0.08 : (p > 0.85 ? (1 - p) / 0.15 : 1); bo.halo.material.opacity = 0.4 * fade; bo.b.scale.setScalar(fade); }); };
    return g;
  }, { icon: "🔮", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0x6a8aff },
    { key: "size", label: "Bolt Size", type: "number", min: 0.04, max: 0.2, step: 0.01, default: 0.08 },
    { key: "range", label: "Range", type: "number", min: 1, max: 8, step: 0.5, default: 4 },
    { key: "speed", label: "Fire Rate", type: "number", min: 0.2, max: 2.5, step: 0.05, default: 1.0 }] });

  register("rune_cannon", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x3a2414), m = M.metal(0x2a2520), c = _c(o.color, 0xff6a1a);
    g.add(_box(0.4, 0.16, 0.5, wd, [0, 0.08, 0]));
    for (const [x, z] of [[-0.16, 0.2], [0.16, 0.2], [-0.16, -0.2], [0.16, -0.2]]) g.add(_cyl(0.03, 0.03, 0.16, wd, [x, 0.0, z], 6));
    const barrel = _cyl(0.12, 0.14, 0.7, m, [0.1, 0.3, 0], 12); barrel.rotation.z = -Math.PI / 2 - 0.1; g.add(barrel);
    const ring = _tor(0.1, 0.02, glow(c, 1.4), [0.42, 0.34, 0], 6, 18); ring.rotation.y = Math.PI / 2; g.add(ring);
    const range = o.range; const balls = []; const n = 3;
    for (let i = 0; i < n; i++) { const b = _sph(o.size, glow(c, 1.8), [0.42, 0.34, 0], 8); const fl = _cone(o.size * 1.3, o.size * 3.5, tglow(c, 1.4, 0.6), [0.42, 0.34, 0], 6); fl.rotation.z = Math.PI / 2; fl.userData._o0 = 0.6; g.add(b); g.add(fl); balls.push({ b, fl, off: i / n }); }
    let t = rand(0, 6), phase = rand(0, 1);
    g.userData.tick = (dt) => { t += dt; phase += dt * o.speed; if (phase >= 1) phase -= 1; ring.material.emissiveIntensity = 1.2 + Math.sin(t * 5) * 0.4; balls.forEach((ba) => { let p = (phase + ba.off) % 1; const x = 0.42 + p * range; ba.b.position.x = x; ba.fl.position.x = x - o.size * 2; const fade = p < 0.08 ? p / 0.08 : (p > 0.85 ? (1 - p) / 0.15 : 1); ba.fl.material.opacity = 0.6 * fade; ba.b.scale.setScalar(fade); }); };
    return g;
  }, { icon: "🔥", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0xff6a1a },
    { key: "size", label: "Shot Size", type: "number", min: 0.04, max: 0.22, step: 0.01, default: 0.1 },
    { key: "range", label: "Range", type: "number", min: 1, max: 8, step: 0.5, default: 4.5 },
    { key: "speed", label: "Fire Rate", type: "number", min: 0.2, max: 2, step: 0.05, default: 0.8 }] });

  register("staff_emitter", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.wood, 0x3a2414)), c = _c(o.color, 0x9a6aff);
    g.add(_cyl(0.025, 0.03, 1.6, wd, [0, 0.8, 0], 8));
    g.add(_cyl(0.08, 0.1, 0.08, M.brass(0xc8a050), [0, 1.6, 0], 8));
    const headGrp = new THREE.Group();
    const orb = _sph(0.1, glow(c, 1.7), [0, 0, 0], 12); headGrp.add(orb);
    const cage = []; for (let i = 0; i < 3; i++) { const ring = _tor(0.14, 0.012, M.brass(0xc8a050), [0, 0, 0], 5, 18); ring.rotation.x = i * Math.PI / 3; headGrp.add(ring); cage.push(ring); }
    headGrp.position.y = 1.7; g.add(headGrp);
    // sparks spitting upward from the orb
    const sparks = []; for (let i = 0; i < 6; i++) { const s = _sph(0.02, tglow(c, 1.5, 0.7), [0, 1.7, 0], 6); s.userData._o0 = 0.7; g.add(s); sparks.push({ m: s, ph: rand(0, 1), a: rand(0, 6.28) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; orb.material.emissiveIntensity = 1.4 + Math.sin(t * 4) * 0.5; cage.forEach((r, i) => { r.rotation.y += dt * (0.6 + i * 0.2); }); sparks.forEach((s) => { s.ph += dt * 0.8; if (s.ph > 1) { s.ph = 0; s.a = rand(0, 6.28); } const r = s.ph * 0.3; s.m.position.set(Math.cos(s.a) * r, 1.7 + s.ph * 0.4, Math.sin(s.a) * r); s.m.material.opacity = 0.7 * (1 - s.ph); }); };
    return g;
  }, { icon: "🪄", category: "wizard projectiles", params: [
    { key: "color", label: "Magic", type: "color", default: 0x9a6aff },
    { key: "wood", label: "Staff", type: "color", default: 0x3a2414 }] });

  // ════════════════════════════════════════════════════════════
  //  IMPACTS & BEAMS
  // ════════════════════════════════════════════════════════════

  register("beam_ray", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xff3a3a);
    const len = o.range;
    const beam = _cyl(o.size, o.size, len, tglow(c, 1.7, 0.6), [len / 2, o.height, 0], 10); beam.rotation.z = Math.PI / 2; g.add(beam);
    const coreM = glow(0xffffff, 1.9);
    const core = _cyl(o.size * 0.4, o.size * 0.4, len, coreM, [len / 2, o.height, 0], 8); core.rotation.z = Math.PI / 2; g.add(core);
    const muzzle = _sph(o.size * 2, glow(c, 1.8), [0, o.height, 0], 10); g.add(muzzle);
    const impact = _sph(o.size * 1.5, glow(c, 1.7), [len, o.height, 0], 10); g.add(impact);
    const sparks = []; for (let i = 0; i < 6; i++) { const s = _sph(o.size * 0.5, tglow(c, 1.5, 0.7), [len, o.height, 0], 6); s.userData._o0 = 0.7; g.add(s); sparks.push({ m: s, a: rand(0, 6.28), ph: rand(0, 1) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const flick = 0.5 + Math.abs(Math.sin(t * 12)) * 0.3; beam.material.opacity = flick; coreM.emissiveIntensity = 1.6 + Math.sin(t * 20) * 0.3; const sc = 1 + Math.sin(t * 14) * 0.15; muzzle.scale.setScalar(sc); impact.scale.setScalar(1 + Math.sin(t * 10) * 0.2); sparks.forEach((s) => { s.ph += dt * 1.5; if (s.ph > 1) { s.ph = 0; s.a = rand(0, 6.28); } const r = s.ph * 0.3; s.m.position.set(len + Math.cos(s.a) * r, o.height + Math.sin(s.a) * r, rand(-0.1, 0.1)); s.m.material.opacity = 0.7 * (1 - s.ph); }); };
    return g;
  }, { icon: "🔆", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0xff3a3a },
    { key: "size", label: "Thickness", type: "number", min: 0.02, max: 0.16, step: 0.01, default: 0.05 },
    { key: "range", label: "Length", type: "number", min: 1, max: 8, step: 0.5, default: 4 },
    { key: "height", label: "Height", type: "number", min: 0.3, max: 2.5, step: 0.1, default: 1.2 }] });

  register("impact_burst", function (o) {
    const g = new THREE.Group(); const c = _c(o.color, 0xffa030);
    const flash = glow(0xffffff, 0); g.add(_sph(o.size, flash, [0, o.height, 0], 10));
    const shards = []; const n = Math.round(o.count);
    for (let i = 0; i < n; i++) { const a = rand(0, 6.28), b = rand(-1, 1); const dx = Math.cos(a) * Math.sqrt(Math.max(0, 1 - b * b)), dy = b, dz = Math.sin(a) * Math.sqrt(Math.max(0, 1 - b * b)); const sh = _box(o.size * 0.3, o.size * 0.3, o.size * 1.2, tglow(c, 1.5, 0.9), [0, o.height, 0]); g.add(sh); shards.push({ m: sh, dx, dy, dz }); }
    const ring = _tor(0.05, o.size * 0.4, tglow(c, 1.6, 0), [0, o.height, 0], 5, 24); ring.rotation.x = Math.PI / 2; g.add(ring);
    let phase = rand(0, 1);
    g.userData.tick = (dt) => { phase += dt * o.speed; if (phase >= 1) phase -= 1; flash.emissiveIntensity = phase < 0.1 ? 2.5 * (phase / 0.1) : Math.max(0, 2.5 - (phase - 0.1) * 6); const reach = phase * o.radius; shards.forEach((s) => { s.m.position.set(s.dx * reach, o.height + s.dy * reach, s.dz * reach); s.m.material.opacity = 0.9 * (1 - phase); s.m.lookAt && s.m.lookAt(s.dx * reach * 2, o.height + s.dy * reach * 2, s.dz * reach * 2); }); const rs = 0.05 + phase * o.radius; ring.scale.set(rs / 0.05, rs / 0.05, 1); ring.material.opacity = 0.7 * (1 - phase); };
    return g;
  }, { icon: "💥", category: "wizard projectiles", params: [
    { key: "color", label: "Color", type: "color", default: 0xffa030 },
    { key: "size", label: "Core Size", type: "number", min: 0.05, max: 0.3, step: 0.01, default: 0.12 },
    { key: "radius", label: "Blast Radius", type: "number", min: 0.4, max: 2.5, step: 0.1, default: 1.1 },
    { key: "count", label: "Shards", type: "int", min: 6, max: 36, default: 16 },
    { key: "speed", label: "Cycle Speed", type: "number", min: 0.1, max: 1.5, step: 0.05, default: 0.5 },
    { key: "height", label: "Height", type: "number", min: 0.1, max: 2.5, step: 0.1, default: 0.8 }] });
})();
