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

  register("magic_mirror", function (o) {
    const g = new THREE.Group();
    const W = o.width, H = o.height;
    const fr = M.brass(_c(o.frame, 0xb8945a));
    g.add(_box(W * 0.7, 0.06, 0.3, fr, [0, 0.03, 0]));            // foot
    g.add(_box(0.08, H, 0.06, fr, [-W / 2, H / 2 + 0.06, 0]));    // left frame
    g.add(_box(0.08, H, 0.06, fr, [ W / 2, H / 2 + 0.06, 0]));    // right frame
    g.add(_box(W + 0.16, 0.08, 0.06, fr, [0, H + 0.06, 0]));      // top bar
    g.add(_box(W + 0.16, 0.08, 0.06, fr, [0, 0.06, 0]));          // bottom bar
    g.add(_sph(0.06, fr, [0, H + 0.16, 0]));                      // finial
    const tint = _c(o.tint, 0x223344);
    const ms = new THREE.MeshStandardMaterial({
      color: tint, emissive: tint, emissiveIntensity: 0.4,
      roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85,
    });
    g.add(_box(W - 0.04, H - 0.04, 0.02, ms, [0, H / 2 + 0.06, 0.02]));  // shimmering surface
    return g;
  }, {
    icon: "▢", category: "wizard decor",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.8 },
      { key: "height", label: "Height", type: "number", min: 1,   max: 2.6, step: 0.1, default: 1.8 },
      { key: "frame",  label: "Frame",  type: "color",  default: 0xb8945a },
      { key: "tint",   label: "Glass",  type: "color",  default: 0x223344 },
    ],
  });

  // ── Enchanted chest ──────────────────────────────────────────

  register("wizard_hat", function (o) {
    const g = new THREE.Group();
    const cl = M.cloth(_c(o.color, 0x2a2a5a));
    g.add(_cyl(0.35, 0.38, 0.03, cl, [0, 0.015, 0], 24));        // brim
    g.add(_cone(0.22, 0.7, cl, [0, 0.38, 0], 16));               // cone
    g.add(_cyl(0.225, 0.225, 0.06, M.leather(0x2a1a10), [0, 0.1, 0], 20));  // band
    g.add(_box(0.08, 0.06, 0.02, M.brass(), [0, 0.1, 0.22]));    // buckle
    if (o.stars) {
      const sg = glow(_c(o.glow, 0xffe08a), 1.5);
      for (let i = 0; i < 5; i++) {
        const a = rand(0, Math.PI * 2), hh = rand(0.2, 0.55), rr = 0.15 * (1 - hh / 0.7);
        g.add(_sph(0.02, sg, [Math.cos(a) * rr, 0.12 + hh, Math.sin(a) * rr], 6));
      }
    }
    return g;
  }, {
    icon: "▲", category: "wizard decor",
    params: [
      { key: "color", label: "Cloth", type: "color", default: 0x2a2a5a },
      { key: "stars", label: "Stars", type: "bool",  default: true },
      { key: "glow",  label: "Stars", type: "color", default: 0xffe08a },
    ],
  });

  // ── Flying broom ─────────────────────────────────────────────
  // Broomstick hovering horizontally; bristle bundle at the -X end.

  register("house_banner", function (o) {
    const g = new THREE.Group();
    const cloth = M.cloth(_c(o.color, 0x6a1a1a));
    const H = o.height, W = o.width;
    const rod = _cyl(0.03, 0.03, W + 0.2, M.brass(), [0, H + 0.02, 0], 8); rod.rotation.z = Math.PI / 2; g.add(rod);
    g.add(_box(W, H, 0.02, cloth, [0, H / 2, 0]));                      // cloth
    for (let i = 0; i < 4; i++) g.add(_box(W / 5 - 0.02, 0.12, 0.02, cloth, [-W / 2 + (i + 0.5) * W / 4, -0.06, 0])); // fringe
    const em = M.brass(_c(o.emblem, 0xd6b84a));
    g.add(_box(W * 0.4, W * 0.4, 0.02, em, [0, H * 0.55, 0.02]));       // emblem field
    const d = _box(W * 0.22, W * 0.22, 0.03, cloth, [0, H * 0.55, 0.04]); d.rotation.z = Math.PI / 4; g.add(d); // diamond
    return g;
  }, {
    icon: "⚑", category: "wizard decor",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.4, max: 1.4, step: 0.1, default: 0.7 },
      { key: "height", label: "Height", type: "number", min: 1,   max: 3,   step: 0.1, default: 1.8 },
      { key: "color",  label: "Cloth",  type: "color",  default: 0x6a1a1a },
      { key: "emblem", label: "Emblem", type: "color",  default: 0xd6b84a },
    ],
  });

  // ── Owlery roost ─────────────────────────────────────────────
  // Tall post with cross-perches and a few resting owls.

  register("guardian_gargoyle", function (o) {
    const g = new THREE.Group();
    const st = M.stone(_c(o.color, 0x4a4640));
    g.add(_box(0.5, 0.3, 0.5, st, [0, 0.15, 0]));                       // plinth
    g.add(_box(0.4, 0.05, 0.4, st, [0, 0.32, 0]));
    const b = 0.35;
    g.add(_sph(0.18, st, [0, b + 0.18, 0], 12));                        // body
    for (const sx of [-1, 1]) g.add(_box(0.12, 0.18, 0.16, st, [sx * 0.14, b + 0.09, 0.05]));   // haunches
    for (const sx of [-1, 1]) g.add(_cyl(0.05, 0.06, 0.22, st, [sx * 0.16, b + 0.12, 0.16], 6)); // arms
    g.add(_sph(0.13, st, [0, b + 0.42, 0.04], 12));                    // head
    for (const sx of [-1, 1]) { const hn = _cone(0.03, 0.12, st, [sx * 0.06, b + 0.54, 0.02], 5); hn.rotation.x = -0.3; g.add(hn); } // horns
    for (const sx of [-1, 1]) g.add(_sph(0.022, glow(_c(o.eyes, 0xd64a2a), 1.4), [sx * 0.05, b + 0.45, 0.14], 6)); // eyes
    for (const sx of [-1, 1]) { const wg = _box(0.04, 0.32, 0.22, st, [sx * 0.2, b + 0.28, -0.06]); wg.rotation.z = sx * 0.3; g.add(wg); } // wings
    const snout = _cone(0.06, 0.14, st, [0, b + 0.4, 0.16], 6); snout.rotation.x = Math.PI / 2; g.add(snout);
    return g;
  }, {
    icon: "ψ", category: "wizard decor",
    params: [
      { key: "color", label: "Stone", type: "color", default: 0x4a4640 },
      { key: "eyes",  label: "Eyes",  type: "color", default: 0xd64a2a },
    ],
  });

  // ── Wisp lantern ─────────────────────────────────────────────
  // Tall iron post topped by a free-floating wisp of light in a cage.

  register("gargoyle_spout", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a5348)); const y = o.height;
    g.add(_box(0.3, 0.3, 0.2, st, [0, y, 0]));
    g.add(_sph(0.16, st, [0, y, 0.2], 10));
    const sn = _cone(0.08, 0.22, st, [0, y - 0.03, 0.36], 6); sn.rotation.x = Math.PI / 2; g.add(sn);
    for (const sx of [-1, 1]) g.add(_cone(0.04, 0.1, st, [sx * 0.08, y + 0.14, 0.16], 5));
    for (const sx of [-1, 1]) g.add(_sph(0.02, glow(_c(o.eyes, 0xffcf4a), 1.2), [sx * 0.06, y + 0.04, 0.32], 6));
    return g;
  }, { icon: "ʚ", category: "wizard decor", params: [
    { key: "height", label: "Mount Y", type: "number", min: 1.5, max: 3.5, step: 0.1, default: 2.2 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5348 },
    { key: "eyes", label: "Eyes", type: "color", default: 0xffcf4a }] });

  register("great_hourglass", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x4a3018)); const gl = M.glass(0xc8e0e0); const H = o.height;
    g.add(_cyl(0.3, 0.3, 0.06, wd, [0, 0.03, 0], 16));
    g.add(_cyl(0.3, 0.3, 0.06, wd, [0, H, 0], 16));
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; g.add(_cyl(0.03, 0.03, H, wd, [Math.cos(a) * 0.26, H / 2, Math.sin(a) * 0.26], 6)); }
    const mid = H / 2, ch = mid - 0.06;
    g.add(_cone(0.22, ch, gl, [0, 0.06 + ch / 2, 0], 14));
    const top = _cone(0.22, ch, gl, [0, H - 0.06 - ch / 2, 0], 14); top.rotation.x = Math.PI; g.add(top);
    const sand = M.straw(0xe8c878);
    g.add(_cone(0.18, ch * 0.5, sand, [0, 0.06 + ch * 0.25, 0], 12));
    g.add(_cyl(0.01, 0.01, 0.2, sand, [0, mid, 0], 4));
    return g;
  }, { icon: "⧖", category: "wizard decor", params: [
    { key: "height", label: "Height", type: "number", min: 0.8, max: 2, step: 0.1, default: 1.4 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3018 }] });

  register("school_trunk", function (o) {
    const g = new THREE.Group(); const lt = M.leather(_c(o.color, 0x5a3a22)); const br = M.brass();
    const W = 0.8, H = 0.45, D = 0.45;
    g.add(_box(W, H, D, lt, [0, H / 2, 0]));
    g.add(_box(W + 0.02, 0.06, D + 0.02, lt, [0, H - 0.05, 0]));
    for (const sx of [-W * 0.3, W * 0.3]) g.add(_box(0.08, H + 0.02, D + 0.02, M.leather(0x3a2414), [sx, H / 2, 0]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.06, 0.06, 0.06, br, [sx * (W / 2 - 0.03), H - 0.06, sz * (D / 2 - 0.03)]));
    g.add(_box(0.1, 0.08, 0.04, br, [0, H - 0.08, D / 2]));
    g.add(_box(0.16, 0.06, 0.02, br, [0, H * 0.5, D / 2]));
    return g;
  }, { icon: "⊡", category: "wizard decor", params: [
    { key: "color", label: "Leather", type: "color", default: 0x5a3a22 }] });

  register("star_chart", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2a1a));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(_box(0.05, 0.8, 0.05, wd, [sx * 0.4, 0.4, sz * 0.25]));
    g.add(_box(0.9, 0.05, 0.55, wd, [0, 0.78, 0]));
    const top = _box(0.85, 0.04, 0.5, wd, [0, 0.95, -0.05]); top.rotation.x = -0.4; g.add(top);
    const map = _box(0.78, 0.02, 0.44, M.felt(0x12162a), [0, 0.97, -0.05]); map.rotation.x = -0.4; g.add(map);
    const star = glow(_c(o.glow, 0xc8d8ff), 1.4);
    for (let i = 0; i < 14; i++) { const lx = rand(-0.35, 0.35), lz = rand(-0.2, 0.2); g.add(_sph(rand(0.006, 0.014), star, [lx, 0.99 - lz * Math.sin(-0.4), -0.05 + lz * Math.cos(0.4)], 5)); }
    return g;
  }, { icon: "✶", category: "wizard decor", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2a1a },
    { key: "glow", label: "Stars", type: "color", default: 0xc8d8ff }] });

  // ═══ CREATURE STATUES ════════════════════════════════════════

  register("giant_cobweb", function (o) {
    const g = new THREE.Group(); const w = M.cloth(_c(o.color, 0xcfcfc8)); const R = o.radius, y = o.height, n = 7;
    for (let i = 0; i < n; i++) { const a = Math.PI * 0.5 * (i / (n - 1)); const th = _box(0.01, R, 0.01, w, [Math.cos(a) * R / 2, y - Math.sin(a) * R / 2, 0]); th.rotation.z = a; g.add(th); }
    for (let r = 1; r <= 3; r++) { const rr = R * r / 3.5; for (let i = 0; i < n - 1; i++) { const a = Math.PI * 0.5 * ((i + 0.5) / (n - 1)); g.add(_box(0.008, rr * 0.4, 0.008, w, [Math.cos(a) * rr, y - Math.sin(a) * rr, 0])); } }
    return g;
  }, { icon: "✶", category: "wizard decor", params: [
    { key: "radius", label: "Size", type: "number", min: 0.4, max: 1.5, step: 0.1, default: 0.8 },
    { key: "height", label: "Top", type: "number", min: 1, max: 3, step: 0.1, default: 2.0 },
    { key: "color", label: "Web", type: "color", default: 0xcfcfc8 }] });

  register("enchanted_clock", function (o) {
    const g = new THREE.Group(); const br = M.brass();
    const R = o.radius;
    const face = _cyl(R, R, 0.06, M.plaster(0xe8e0c8), [0, 0, 0], 24); face.rotation.x = Math.PI / 2; g.add(face);
    g.add(_tor(R, 0.04, br, [0, 0, 0.02], 6, 28));
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.add(_box(0.02, 0.06, 0.02, M.metal(0x222222), [Math.cos(a) * R * 0.85, Math.sin(a) * R * 0.85, 0.05])); }
    for (let h = 0; h < o.hands; h++) { const a = h * 1.7; const len = R * (0.5 + 0.4 * ((h % 3) / 2)); const hand = _box(0.02, len, 0.02, glow(pick([0xd64a4a, 0x4a8ad6, 0x4ad68a, 0xd6c04a]), 0.8), [0, len / 2, 0]); const hg = new THREE.Group(); hg.add(hand); hg.rotation.z = a; hg.position.z = 0.06; g.add(hg); }
    g.add(_sph(0.04, br, [0, 0, 0.07], 10));
    return g;
  }, { icon: "🕰", category: "wizard decor", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.25, max: 0.8, step: 0.05, default: 0.4 },
    { key: "hands", label: "Hands", type: "int", min: 2, max: 12, step: 1, default: 5 }] });

  register("blackboard", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.frame, 0x3a2414));
    const slate = new THREE.MeshStandardMaterial({ color: _c(o.color, 0x1a2420), roughness: 0.9 });
    const W = o.width, H = o.height, base = 0.6;
    for (const sx of [-1, 1]) g.add(_box(0.06, base + H + 0.1, 0.06, wd, [sx * (W / 2 + 0.04), (base + H + 0.1) / 2, 0]));
    g.add(_box(W, H, 0.04, slate, [0, base + H / 2, 0]));
    g.add(_box(W + 0.12, 0.06, 0.06, wd, [0, base + H + 0.05, 0]));
    g.add(_box(W, 0.04, 0.1, wd, [0, base, 0.06]));                            // chalk tray
    for (let i = 0; i < 3; i++) { const ch = _cyl(0.01, 0.01, 0.05, M.plaster(0xf0ece0), [-0.1 + i * 0.1, base + 0.04, 0.07], 6); ch.rotation.z = Math.PI / 2; g.add(ch); }
    const brace = _box(0.05, base + H, 0.05, wd, [0, (base + H) / 2, -0.25]); brace.rotation.x = 0.3; g.add(brace);
    for (const sx of [-1, 1]) g.add(_box(0.3, 0.05, 0.1, wd, [sx * (W / 2), 0.025, 0]));
    return g;
  }, { icon: "▦", category: "wizard decor", params: [
    { key: "width", label: "Width", type: "number", min: 0.8, max: 2.5, step: 0.1, default: 1.4 },
    { key: "height", label: "Height", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.9 },
    { key: "color", label: "Slate", type: "color", default: 0x1a2420 },
    { key: "frame", label: "Frame", type: "color", default: 0x3a2414 }] });

  register("classroom_globe", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x4a3018), br = M.brass();
    g.add(_cyl(0.12, 0.16, 0.04, wd, [0, 0.02, 0], 14));
    g.add(_cyl(0.02, 0.02, 0.3, wd, [0, 0.19, 0], 8));
    g.add(_sph(0.18, M.ceramic(_c(o.color, 0x3a6a8a)), [0, 0.5, 0], 16));
    for (let i = 0; i < 5; i++) { const a = rand(0, 6.28), b = rand(-1, 1), r = 0.18; g.add(_sph(rand(0.04, 0.07), M.leaf(0x4a7a3a), [Math.cos(a) * r * Math.cos(b), 0.5 + r * Math.sin(b), Math.sin(a) * r * Math.cos(b)], 8)); }
    g.add(_tor(0.21, 0.012, br, [0, 0.5, 0], 6, 28));
    return g;
  }, { icon: "🌐", category: "wizard decor", params: [
    { key: "color", label: "Ocean", type: "color", default: 0x3a6a8a }] });

  register("woven_tapestry", function (o) {
    const g = new THREE.Group(); const W = o.width, H = o.height;
    const c1 = M.cloth(_c(o.color, 0x4a2a1a)), c2 = M.cloth(_c(o.accent, 0x8a6a3a)), c3 = M.cloth(0x6a1a2a);
    const rod = _cyl(0.03, 0.03, W + 0.2, M.wood(0x3a2414), [0, H + 0.05, 0], 8); rod.rotation.z = Math.PI / 2; g.add(rod);
    g.add(_box(W, H, 0.02, c1, [0, H / 2, 0]));
    for (let j = 0; j < 5; j++) g.add(_box(W * 0.92, 0.04, 0.025, c2, [0, H * (0.15 + j * 0.17), 0.01]));
    const dia = _box(W * 0.3, W * 0.3, 0.03, c3, [0, H * 0.55, 0.015]); dia.rotation.z = Math.PI / 4; g.add(dia);
    const inner = _box(W * 0.18, W * 0.18, 0.035, c2, [0, H * 0.55, 0.02]); inner.rotation.z = Math.PI / 4; g.add(inner);
    for (let i = 0; i < 10; i++) g.add(_cyl(0.008, 0.008, 0.08, c2, [-W / 2 + (i + 0.5) * W / 10, -0.04, 0], 4));
    return g;
  }, { icon: "🧶", category: "wizard decor", params: [
    { key: "width", label: "Width", type: "number", min: 0.6, max: 2.5, step: 0.1, default: 1.2 },
    { key: "height", label: "Height", type: "number", min: 1, max: 3, step: 0.1, default: 1.8 },
    { key: "color", label: "Ground", type: "color", default: 0x4a2a1a },
    { key: "accent", label: "Weave", type: "color", default: 0x8a6a3a }] });

  register("wall_pegs", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)); const W = o.width, y = o.height;
    g.add(_box(W, 0.12, 0.04, wd, [0, y, -0.02]));
    const n = Math.max(2, Math.round(W / 0.25));
    for (let i = 0; i < n; i++) { const x = -W / 2 + (i + 0.5) * W / n; const peg = _cyl(0.015, 0.02, 0.1, wd, [x, y, 0.05], 6); peg.rotation.x = Math.PI / 2 - 0.5; g.add(peg); g.add(_sph(0.022, wd, [x, y + 0.03, 0.1], 8)); }
    return g;
  }, { icon: "🪝", category: "wizard decor", params: [
    { key: "width", label: "Width", type: "number", min: 0.5, max: 2, step: 0.1, default: 1.0 },
    { key: "height", label: "Mount", type: "number", min: 1, max: 2, step: 0.1, default: 1.6 },
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("notice_board", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.frame, 0x3a2414)); const cork = M.cloth(_c(o.color, 0x8a6a3a));
    const W = o.width, H = o.height;
    g.add(_box(W, H, 0.03, cork, [0, H / 2 + 0.4, 0]));
    g.add(_box(W + 0.08, 0.06, 0.05, wd, [0, H + 0.4, 0])); g.add(_box(W + 0.08, 0.06, 0.05, wd, [0, 0.4, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.06, H + 0.1, 0.05, wd, [sx * (W / 2 + 0.03), H / 2 + 0.4, 0]));
    for (let i = 0; i < 6; i++) { const note = _box(rand(0.12, 0.2), rand(0.12, 0.18), 0.005, M.plaster(pick([0xe8dcc0, 0xf0e8d0, 0xe0d8c0])), [rand(-W / 2 + 0.15, W / 2 - 0.15), 0.5 + rand(0.1, H - 0.2), 0.02]); note.rotation.z = rand(-0.1, 0.1); g.add(note); g.add(_sph(0.012, M.metal(0xd62a2a), [note.position.x, note.position.y + 0.05, 0.03], 6)); }
    return g;
  }, { icon: "📌", category: "wizard decor", params: [
    { key: "width", label: "Width", type: "number", min: 0.6, max: 2, step: 0.1, default: 1.0 },
    { key: "height", label: "Height", type: "number", min: 0.6, max: 1.6, step: 0.1, default: 1.0 },
    { key: "color", label: "Cork", type: "color", default: 0x8a6a3a },
    { key: "frame", label: "Frame", type: "color", default: 0x3a2414 }] });

  register("window_drapes", function (o) {
    const g = new THREE.Group(); const cl = M.cloth(_c(o.color, 0x5a1a2a)); const W = o.width, H = o.height;
    const rod = _cyl(0.025, 0.025, W + 0.2, M.brass(), [0, H + 0.05, 0], 8); rod.rotation.z = Math.PI / 2; g.add(rod);
    for (const sx of [-1, 1]) { for (let i = 0; i < 5; i++) g.add(_cyl(0.05, 0.06, H, cl, [sx * (W / 2 - 0.04 - i * 0.05), H / 2, 0], 6));
      g.add(_box(0.14, 0.06, 0.12, M.brass(), [sx * (W / 2 - 0.12), H * 0.45, 0])); }
    g.add(_box(W + 0.1, 0.18, 0.06, cl, [0, H - 0.02, 0]));
    return g;
  }, { icon: "🎏", category: "wizard decor", params: [
    { key: "width", label: "Width", type: "number", min: 0.6, max: 2.5, step: 0.1, default: 1.0 },
    { key: "height", label: "Height", type: "number", min: 1, max: 3.5, step: 0.1, default: 2.0 },
    { key: "color", label: "Cloth", type: "color", default: 0x5a1a2a }] });

  register("floor_rug", function (o) {
    const g = new THREE.Group(); const c1 = M.cloth(_c(o.color, 0x6a1a2a)), c2 = M.cloth(_c(o.accent, 0xd6b84a)), c3 = M.cloth(0x3a1a4a);
    const W = o.width, D = o.depth;
    g.add(_box(W, 0.02, D, c1, [0, 0.01, 0]));
    g.add(_box(W - 0.1, 0.025, D - 0.1, c3, [0, 0.013, 0]));
    g.add(_box(W, 0.028, 0.06, c2, [0, 0.015, -D / 2 + 0.04])); g.add(_box(W, 0.028, 0.06, c2, [0, 0.015, D / 2 - 0.04]));
    g.add(_box(0.06, 0.028, D, c2, [-W / 2 + 0.04, 0.015, 0])); g.add(_box(0.06, 0.028, D, c2, [W / 2 - 0.04, 0.015, 0]));
    const med = _box(W * 0.25, 0.03, D * 0.25, c2, [0, 0.018, 0]); med.rotation.y = Math.PI / 4; g.add(med);
    for (const xx of [-W / 2, W / 2]) for (let i = 0; i < 8; i++) g.add(_box(0.015, 0.01, 0.06, c1, [xx + Math.sign(xx) * 0.03, 0.005, -D / 2 + (i + 0.5) * D / 8]));
    return g;
  }, { icon: "🟥", category: "wizard decor", params: [
    { key: "width", label: "Width", type: "number", min: 0.8, max: 4, step: 0.1, default: 1.6 },
    { key: "depth", label: "Depth", type: "number", min: 0.6, max: 3, step: 0.1, default: 1.0 },
    { key: "color", label: "Field", type: "color", default: 0x6a1a2a },
    { key: "accent", label: "Border", type: "color", default: 0xd6b84a }] });

  register("round_rug", function (o) {
    const g = new THREE.Group(); const cols = [_c(o.color, 0x6a1a2a), _c(o.accent, 0xd6b84a), 0x3a1a4a]; const R = o.radius;
    for (let i = 0; i < 3; i++) { const r = R * (1 - i * 0.3); g.add(_cyl(r, r, 0.015 + i * 0.004, M.cloth(cols[i % 3]), [0, 0.008 + i * 0.003, 0], 24)); }
    return g;
  }, { icon: "🔴", category: "wizard decor", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.4, max: 1.5, step: 0.1, default: 0.7 },
    { key: "color", label: "Field", type: "color", default: 0x6a1a2a },
    { key: "accent", label: "Ring", type: "color", default: 0xd6b84a }] });

  register("ceiling_stars", function (o) {
    const g = new THREE.Group(); const y = o.height;
    const sky = new THREE.MeshStandardMaterial({ color: _c(o.color, 0x0a1430), roughness: 1.0 });
    g.add(_box(o.width, 0.06, o.depth, sky, [0, y, 0]));
    for (let i = 0; i < o.stars; i++) g.add(_sph(rand(0.01, 0.025), glow(0xfff0c0, 2.4), [rand(-o.width / 2 + 0.1, o.width / 2 - 0.1), y - 0.04, rand(-o.depth / 2 + 0.1, o.depth / 2 - 0.1)], 6));
    for (let i = 0; i < 3; i++) g.add(_sph(0.04, glow(0xbfe0ff, 2.2), [rand(-o.width / 2, o.width / 2), y - 0.05, rand(-o.depth / 2, o.depth / 2)], 8));
    return g;
  }, { icon: "🌌", category: "wizard decor", params: [
    { key: "width", label: "Width", type: "number", min: 1, max: 6, step: 0.1, default: 3.0 },
    { key: "depth", label: "Depth", type: "number", min: 1, max: 6, step: 0.1, default: 3.0 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 5, step: 0.1, default: 3.0 },
    { key: "stars", label: "Stars", type: "int", min: 10, max: 120, step: 5, default: 40 },
    { key: "color", label: "Sky", type: "color", default: 0x0a1430 }] });

  // ════════════════════════════════════════════════════════════
  //  POTION-CLASS TOOLS
  // ════════════════════════════════════════════════════════════

  register("balance_scale", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xd6b84a));
    g.add(_cyl(0.12, 0.16, 0.04, br, [0, 0.02, 0], 14));
    g.add(_cyl(0.02, 0.02, 0.5, br, [0, 0.27, 0], 8));
    const beam = _cyl(0.012, 0.012, 0.5, br, [0, 0.52, 0], 6); beam.rotation.z = Math.PI / 2; g.add(beam);
    g.add(_cone(0.03, 0.06, br, [0, 0.55, 0], 6));
    for (const sx of [-1, 1]) { const px = sx * 0.24;
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; g.add(_cyl(0.003, 0.003, 0.16, br, [px + Math.cos(a) * 0.04, 0.44, Math.sin(a) * 0.04], 3)); }
      g.add(_cyl(0.07, 0.05, 0.02, br, [px, 0.36, 0], 14)); }
    return g;
  }, { icon: "⚖", category: "wizard decor", params: [
    { key: "color", label: "Brass", type: "color", default: 0xd6b84a }] });

  register("wall_crest", function (o) {
    const g = new THREE.Group(); const base = M.metal(_c(o.color, 0x6a1a2a)); const y = o.height;
    g.add(_box(0.32, 0.34, 0.05, base, [0, y, 0]));
    const point = _cone(0.22, 0.26, base, [0, y - 0.28, 0], 3); point.rotation.x = Math.PI; point.rotation.y = Math.PI / 2; g.add(point);
    g.add(_box(0.14, 0.14, 0.04, M.brass(_c(o.emblem, 0xd6b84a)), [0, y + 0.02, 0.04]));
    const d = _box(0.1, 0.1, 0.05, base, [0, y + 0.02, 0.06]); d.rotation.z = Math.PI / 4; g.add(d);
    for (const sx of [-1, 1]) { const sw = _cyl(0.01, 0.01, 0.4, M.metal(0x9a9aa0), [0, y, -0.02], 4); sw.rotation.z = sx * 0.6; g.add(sw); }
    return g;
  }, { icon: "🛡", category: "wizard decor", params: [
    { key: "height", label: "Mount", type: "number", min: 1, max: 2.5, step: 0.1, default: 1.7 },
    { key: "color", label: "Shield", type: "color", default: 0x6a1a2a },
    { key: "emblem", label: "Emblem", type: "color", default: 0xd6b84a }] });

  register("brass_bell", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xd6b84a)), wd = M.wood(0x3a2414); const y = o.height;
    g.add(_box(0.08, 0.08, 0.06, wd, [0, y, -0.04]));
    const arm = _cyl(0.02, 0.02, 0.18, wd, [0, y, 0.06], 6); arm.rotation.x = Math.PI / 2; g.add(arm);
    g.add(_cone(0.12, 0.2, br, [0, y - 0.12, 0.14], 14));
    const shoulder = _sph(0.12, br, [0, y - 0.02, 0.14], 14); shoulder.scale.y = 0.5; g.add(shoulder);
    g.add(_sph(0.025, br, [0, y - 0.2, 0.14], 8));
    g.add(_tor(0.03, 0.008, br, [0, y + 0.04, 0.14], 6, 12));
    return g;
  }, { icon: "🔔", category: "wizard decor", params: [
    { key: "height", label: "Mount", type: "number", min: 1, max: 2.5, step: 0.1, default: 1.8 },
    { key: "color", label: "Brass", type: "color", default: 0xd6b84a }] });

  register("ceremonial_gong", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.frame, 0x3a2414)), br = M.brass(_c(o.color, 0xd6a840)); const R = o.radius, H = R * 2.4;
    for (const sx of [-1, 1]) g.add(_cyl(0.04, 0.05, H, wd, [sx * (R + 0.15), H / 2, 0], 8));
    g.add(_box(R * 2 + 0.5, 0.06, 0.06, wd, [0, H, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.3, 0.06, 0.3, wd, [sx * (R + 0.15), 0.03, 0]));
    const disc = _cyl(R, R, 0.04, br, [0, R + 0.1, 0], 28); disc.rotation.x = Math.PI / 2; g.add(disc);
    g.add(_tor(R * 0.5, 0.02, M.brass(0xb88820), [0, R + 0.1, 0.03], 6, 24));
    g.add(_sph(0.06, M.brass(0xb88820), [0, R + 0.1, 0.04], 10));
    g.add(_cyl(0.012, 0.012, 0.3, wd, [R * 0.6, R * 0.5, 0.1], 6));
    g.add(_sph(0.04, M.cloth(0x8a2a2a), [R * 0.6, R * 0.5 + 0.15, 0.1], 8));
    return g;
  }, { icon: "🥁", category: "wizard decor", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.25, max: 0.8, step: 0.05, default: 0.4 },
    { key: "color", label: "Bronze", type: "color", default: 0xd6a840 },
    { key: "frame", label: "Frame", type: "color", default: 0x3a2414 }] });

  register("pinned_notices", function (o) {
    const g = new THREE.Group(); const ck = M.cloth(_c(o.color, 0x5a2a1a)), wd = M.wood(0x3a281a);
    g.add(_box(0.7, 0.9, 0.04, ck, [0, 0.45, 0]));
    g.add(_box(0.76, 0.96, 0.03, wd, [0, 0.45, -0.01]));
    const pap = M.plaster(0xf0e8d8);
    for (let i = 0; i < 7; i++) { const w = rand(0.12, 0.2), h = rand(0.14, 0.22); const n = _box(w, h, 0.005, pap, [rand(-0.24, 0.24), rand(0.2, 0.7), 0.025]); n.rotation.z = rand(-0.2, 0.2); g.add(n); g.add(_sph(0.012, glow(0xd23a3a, 0.5), [n.position.x, n.position.y + h / 2 - 0.02, 0.03], 6)); }
    return g;
  }, { icon: "📌", category: "wizard decor", params: [
    { key: "color", label: "Board", type: "color", default: 0x5a2a1a }] });

  register("merperson_statue", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x5a6a6a));
    g.add(_cyl(0.22, 0.26, 0.12, st, [0, 0.06, 0], 12)); // plinth
    g.add(_cyl(0.05, 0.08, 0.45, st, [0, 0.34, 0], 10)); // tail base
    const tail = _cone(0.04, 0.3, st, [0, 0.62, 0.06], 8); tail.rotation.x = -0.5; g.add(tail);
    g.add(_cone(0.16, 0.12, st, [0, 0.78, 0.12], 8)); g.children[g.children.length - 1].rotation.x = Math.PI; // fluke
    g.add(_cyl(0.07, 0.06, 0.22, st, [0, 0.6, -0.02], 8));  // torso
    g.add(_sph(0.07, st, [0, 0.76, -0.02], 10));            // head
    for (const sx of [-1, 1]) { const arm = _cyl(0.02, 0.025, 0.18, st, [sx * 0.07, 0.62, 0], 6); arm.rotation.z = sx * 0.7; g.add(arm); }
    g.add(_tor(0.1, 0.012, M.brass(0xc8a050), [0, 0.7, -0.02], 6, 14)); // trident hint behind
    return g;
  }, { icon: "🧜", category: "wizard decor", params: [
    { key: "color", label: "Stone", type: "color", default: 0x5a6a6a }] });

  register("earmuff_pegs", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x5a4028)), pad = M.fabric(0x3a2a4a), band = M.metal(0x6a6358);
    g.add(_box(0.7, 0.1, 0.04, wd, [0, 0.7, 0]));
    for (let i = 0; i < 3; i++) { const x = -0.22 + i * 0.22; g.add(_cyl(0.012, 0.012, 0.05, wd, [x, 0.7, 0.04], 6)); g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      const e = _tor(0.05, 0.012, band, [x, 0.6, 0.05], 6, 14); g.add(e);
      for (const sx of [-1, 1]) g.add(_sph(0.04, pad, [x + sx * 0.05, 0.55, 0.05], 8)); }
    return g;
  }, { icon: "🎧", category: "wizard decor", params: [
    { key: "color", label: "Wood", type: "color", default: 0x5a4028 }] });

  // ════════════════════════════════════════════════════════════
  //  DUELING CLUB
  // ════════════════════════════════════════════════════════════

  register("heraldic_banner", function (o) {
    const g = new THREE.Group(); const cl = M.cloth(_c(o.color, 0x6a1a2a)), tr = M.brass(0xc8a050);
    g.add(_cyl(0.025, 0.025, 0.4, tr, [0, 2.3, 0], 8)); g.add(_box(0.8, 0.04, 0.04, M.wood(0x3a2818), [0, 2.48, 0]));
    const cloth = _box(0.7, 1.8, 0.02, cl, [0, 1.5, 0]); g.add(cloth);
    g.add(_cone(0.05, 0.16, tr, [-0.2, 0.55, 0.02], 4)); g.add(_cone(0.05, 0.16, tr, [0.2, 0.55, 0.02], 4)); // tassel points
    g.add(_box(0.3, 0.4, 0.025, M.cloth(_c(o.crest, 0xc8a050)), [0, 1.6, 0.02])); // crest field
    g.add(_sph(0.08, M.brass(0xe8c060), [0, 1.6, 0.04], 10)); g.children[g.children.length - 1].scale.z = 0.3;
    return g;
  }, { icon: "🚩", category: "wizard decor", params: [
    { key: "color", label: "Banner", type: "color", default: 0x6a1a2a },
    { key: "crest", label: "Crest", type: "color", default: 0xc8a050 }] });

  register("rippling_standard", function (o) {
    const g = new THREE.Group(); const pole = M.wood(0x3a2818), tr = M.brass(0xc8a050);
    g.add(_cyl(0.04, 0.05, 2.6, pole, [0, 1.3, 0], 8));
    g.add(_sph(0.08, tr, [0, 2.65, 0], 10));
    const flag = new THREE.Group(); const cl = M.cloth(_c(o.color, 0x2a4a8a));
    const segs = []; const segW = 0.16, n = 6;
    for (let i = 0; i < n; i++) { const s = new THREE.Group(); s.add(_box(segW, 1.0, 0.015, cl, [segW / 2, 0, 0])); s.position.x = 0.06 + i * segW; flag.add(s); segs.push(s); }
    flag.position.set(0, 2.0, 0); g.add(flag);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; segs.forEach((s, i) => { s.rotation.y = Math.sin(t * 3 - i * 0.7) * 0.25 * (i / n + 0.3); }); };
    return g;
  }, { icon: "🏴", category: "wizard decor", params: [
    { key: "color", label: "Flag", type: "color", default: 0x2a4a8a }] });

  register("crossed_banners", function (o) {
    const g = new THREE.Group(); const c1 = M.cloth(_c(o.color, 0x7a1a2a)), c2 = M.cloth(_c(o.color2, 0x1a3a6a)), w = M.wood(0x3a2818);
    for (const [sx, cl] of [[-1, c1], [1, c2]]) { const grp = new THREE.Group(); grp.add(_cyl(0.025, 0.025, 1.8, w, [0, 0.9, 0], 6)); grp.add(_box(0.5, 1.0, 0.02, cl, [0, 1.2, 0.02])); grp.add(_cone(0.04, 0.12, M.brass(0xc8a050), [0, 1.82, 0], 4)); grp.position.x = sx * 0.18; grp.rotation.z = sx * 0.35; g.add(grp); }
    g.add(_box(0.3, 0.3, 0.03, M.brass(0xc8a050), [0, 1.0, 0.06])); // central boss
    return g;
  }, { icon: "🎌", category: "wizard decor", params: [
    { key: "color", label: "Left", type: "color", default: 0x7a1a2a },
    { key: "color2", label: "Right", type: "color", default: 0x1a3a6a }] });

  register("crest_shield_wall", function (o) {
    const g = new THREE.Group(); const wd = M.wood(0x3a2818), met = M.metal(_c(o.color, 0x8a8278));
    g.add(_box(0.5, 0.04, 0.5, wd, [0, 0.5, -0.02])); g.children[0].rotation.z = Math.PI / 4;
    const sh = new THREE.Group();
    sh.add(_box(0.36, 0.4, 0.05, met, [0, 0.04, 0]));
    sh.add(_cone(0.22, 0.2, met, [0, -0.24, 0], 3)); sh.children[1].rotation.x = Math.PI; sh.children[1].rotation.y = Math.PI / 6;
    sh.add(_box(0.1, 0.5, 0.06, M.brass(0xc8a050), [0, -0.04, 0.01]));
    sh.add(_box(0.4, 0.1, 0.06, M.brass(0xc8a050), [0, 0.1, 0.01]));
    sh.position.y = 0.5; g.add(sh);
    return g;
  }, { icon: "🛡", category: "wizard decor", params: [
    { key: "color", label: "Metal", type: "color", default: 0x8a8278 }] });

  // ════════════════════════════════════════════════════════════
  //  BATH / DORM FITTINGS
  // ════════════════════════════════════════════════════════════

  register("weather_vane", function (o) {
    const g = new THREE.Group(); const m = M.metal(_c(o.color, 0x3a342c)), br = M.brass(0xc8a050);
    g.add(_cyl(0.03, 0.05, 1.2, m, [0, 0.6, 0], 8));
    // fixed N/S/E/W markers
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; g.add(_box(0.02, 0.02, 0.18, m, [Math.cos(a) * 0.12, 1.2, Math.sin(a) * 0.12])); g.children[g.children.length - 1].rotation.y = -a; }
    const vane = new THREE.Group();
    vane.add(_cyl(0.015, 0.015, 0.5, m, [0, 1.35, 0], 6)).rotation.z = Math.PI / 2;
    vane.add(_cone(0.06, 0.16, br, [0.28, 1.35, 0], 4)); vane.children[1].rotation.z = -Math.PI / 2; // arrow head
    vane.add(_box(0.16, 0.12, 0.01, m, [-0.24, 1.35, 0])); // tail fin
    g.add(vane);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; vane.rotation.y = Math.sin(t * 0.4) * 0.8 + Math.sin(t * 1.3) * 0.15; };
    return g;
  }, { icon: "🌬", category: "wizard decor", params: [
    { key: "color", label: "Metal", type: "color", default: 0x3a342c }] });

  register("enchanted_longcase_clock", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)), br = M.brass(0xc8a050), gl = M.glass(0xcfe3ee);
    g.add(_box(0.5, 1.9, 0.32, wd, [0, 0.95, 0]));               // body
    g.add(_box(0.56, 0.3, 0.38, wd, [0, 1.92, 0]));              // bonnet
    g.add(_cone(0.18, 0.22, wd, [0, 2.18, 0], 4));               // crown
    g.add(_sph(0.04, br, [0, 2.34, 0], 8));
    g.add(_box(0.34, 0.34, 0.02, M.bone(0xf0e8d8), [0, 1.55, 0.17])); // face
    g.add(_tor(0.17, 0.015, br, [0, 1.55, 0.18], 8, 24));
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.add(_box(0.012, 0.03, 0.005, M.metal(0x2a2520), [Math.cos(a) * 0.13, 1.55 + Math.sin(a) * 0.13, 0.185])); }
    // hands (rotate about clock center 0,1.55,0.19)
    const hands = new THREE.Group(); hands.position.set(0, 1.55, 0.19);
    const hourH = _box(0.018, 0.09, 0.004, M.metal(0x1a1410), [0, 0.045, 0]); hands.add(hourH);
    const minH = _box(0.012, 0.14, 0.004, M.metal(0x1a1410), [0, 0.07, 0]); hands.add(minH);
    const hg = new THREE.Group(); hg.add(hourH); const mg = new THREE.Group(); mg.add(minH);
    hands.clear(); hands.add(hg); hands.add(mg); g.add(hands);
    // pendulum
    g.add(_box(0.28, 0.7, 0.02, gl, [0, 0.7, 0.16]));            // window
    const pend = new THREE.Group(); const rod = _cyl(0.008, 0.008, 0.6, br, [0, -0.3, 0], 6); pend.add(rod);
    const bob = _cyl(0.07, 0.07, 0.015, br, [0, -0.6, 0], 16); bob.rotation.x = Math.PI / 2; pend.add(bob);
    pend.position.set(0, 1.0, 0.14); g.add(pend);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; pend.rotation.z = Math.sin(t * 2.0) * 0.22; mg.rotation.z -= dt * 0.6; hg.rotation.z -= dt * 0.05; };
    return g;
  }, { icon: "🕰", category: "wizard decor", params: [
    { key: "color", label: "Wood", type: "color", default: 0x3a2414 }] });

  register("blinking_portrait", function (o) {
    const g = new THREE.Group(); const fr = M.brass(_c(o.frame, 0xb8923a)), canvas = M.fabric(_c(o.color, 0x3a4a5a));
    const W = o.width, H = o.height;
    g.add(_box(W, H, 0.04, canvas, [0, H / 2, 0]));
    // ornate frame
    g.add(_box(W + 0.12, 0.1, 0.1, fr, [0, H + 0.05, 0])); g.add(_box(W + 0.12, 0.1, 0.1, fr, [0, -0.05, 0]));
    g.add(_box(0.1, H + 0.2, 0.1, fr, [-(W / 2 + 0.05), H / 2, 0])); g.add(_box(0.1, H + 0.2, 0.1, fr, [W / 2 + 0.05, H / 2, 0]));
    for (const sx of [-1, 1]) for (const sy of [0, 1]) g.add(_sph(0.06, fr, [sx * (W / 2 + 0.05), sy * H + (sy ? 0.05 : -0.05), 0.05], 8));
    // a vague painted figure
    g.add(_sph(0.1, M.fabric(0xd8c0a0), [0, H * 0.62, 0.03], 10));   // face
    g.add(_cone(0.16, 0.3, M.cloth(0x4a2a3a), [0, H * 0.32, 0.03], 8)); // robes
    const eyeL = _sph(0.018, M.metal(0x1a1410), [-0.04, H * 0.63, 0.09], 6);
    const eyeR = _sph(0.018, M.metal(0x1a1410), [0.04, H * 0.63, 0.09], 6);
    g.add(eyeL); g.add(eyeR);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; const blink = (Math.sin(t * 1.2) > 0.97) ? 0.1 : 1; eyeL.scale.y = blink; eyeR.scale.y = blink; const look = Math.sin(t * 0.5) * 0.02; eyeL.position.x = -0.04 + look; eyeR.position.x = 0.04 + look; };
    return g;
  }, { icon: "🖼", category: "wizard decor", params: [
    { key: "width", label: "Width", type: "number", min: 0.4, max: 1.5, step: 0.1, default: 0.7 },
    { key: "height", label: "Height", type: "number", min: 0.5, max: 1.8, step: 0.1, default: 0.9 },
    { key: "color", label: "Backdrop", type: "color", default: 0x3a4a5a },
    { key: "frame", label: "Frame", type: "color", default: 0xb8923a }] });

  register("turning_time_piece", function (o) {
    const g = new THREE.Group(); const br = M.brass(_c(o.color, 0xc8a050)), gl = M.glass(0xddeeff);
    const rings = new THREE.Group();
    const outer = _tor(0.16, 0.012, br, [0, 0, 0], 8, 28); rings.add(outer);
    const mid = _tor(0.12, 0.01, br, [0, 0, 0], 8, 24); mid.rotation.x = Math.PI / 2; rings.add(mid);
    const inner = _tor(0.08, 0.008, br, [0, 0, 0], 8, 20); inner.rotation.y = Math.PI / 2; rings.add(inner);
    // tiny hourglass at center
    const hg = new THREE.Group();
    hg.add(_cone(0.04, 0.06, gl, [0, 0.03, 0], 10));
    const lower = _cone(0.04, 0.06, gl, [0, -0.03, 0], 10); lower.rotation.x = Math.PI; hg.add(lower);
    hg.add(_sph(0.012, glow(0xffe066, 0.8), [0, 0, 0], 6));
    rings.add(hg); rings.position.set(0, o.height, 0); g.add(rings);
    g.add(_cyl(0.004, 0.004, o.height, br, [0, o.height / 2, 0], 4)); // chain hint
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; outer.rotation.z += dt * 0.8; mid.rotation.x += dt * 1.2; inner.rotation.y += dt * 1.6; hg.rotation.y += dt * 0.5; };
    return g;
  }, { icon: "⏳", category: "wizard decor", params: [
    { key: "height", label: "Hang Height", type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.6 },
    { key: "color", label: "Brass", type: "color", default: 0xc8a050 }] });

  register("twinkling_ceiling_panel", function (o) {
    const g = new THREE.Group(); const night = M.fabric(_c(o.color, 0x0a0a22));
    const W = o.size;
    g.add(_box(W, 0.04, W, night, [0, 0, 0]));
    const stars = [];
    for (let i = 0; i < 40; i++) { const s = _sph(rand(0.006, 0.014), glow(0xfff4d0, 1.2), [rand(-W / 2 + 0.1, W / 2 - 0.1), -0.025, rand(-W / 2 + 0.1, W / 2 - 0.1)], 5); g.add(s); stars.push({ m: s, ph: rand(0, 6), sp: rand(0.8, 2.5) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; stars.forEach((s) => { s.m.material.emissiveIntensity = 0.6 + (Math.sin(t * s.sp + s.ph) * 0.5 + 0.5) * 1.2; }); };
    return g;
  }, { icon: "🌌", category: "wizard decor", params: [
    { key: "size", label: "Size", type: "number", min: 1, max: 5, step: 0.5, default: 3 },
    { key: "color", label: "Sky", type: "color", default: 0x0a0a22 }] });

  register("proud_hippogriff_statue", function (o) {
    const g = new THREE.Group(); const st = M.stone(_c(o.color, 0x6a6358));
    g.add(_box(0.7, 0.12, 0.5, st, [0, 0.06, 0]));               // plinth
    g.add(_cyl(0.16, 0.14, 0.5, st, [0, 0.37, -0.05], 10)); g.children[g.children.length - 1].scale.z = 1.6; // body
    // forelegs (rearing)
    for (const sx of [-1, 1]) { const fl = _cyl(0.04, 0.03, 0.4, st, [sx * 0.1, 0.55, 0.18], 6); fl.rotation.x = 0.6; g.add(fl); }
    for (const sx of [-1, 1]) g.add(_cyl(0.05, 0.04, 0.3, st, [sx * 0.1, 0.2, -0.2], 6));
    // neck + eagle head
    const neck = _cyl(0.08, 0.06, 0.3, st, [0, 0.62, 0.1], 8); neck.rotation.x = -0.5; g.add(neck);
    g.add(_sph(0.09, st, [0, 0.78, 0.22], 10));
    const beak = _cone(0.04, 0.1, M.brass(0xc8a050), [0, 0.76, 0.32], 6); beak.rotation.x = Math.PI / 2 + 0.3; g.add(beak);
    // wings
    for (const sx of [-1, 1]) { const w = _box(0.06, 0.5, 0.3, st, [sx * 0.18, 0.55, -0.05]); w.rotation.z = sx * 0.5; w.rotation.y = sx * 0.3; g.add(w); }
    g.add(_cone(0.05, 0.3, st, [0, 0.4, -0.3], 6)); g.children[g.children.length - 1].rotation.x = 1.2;
    return g;
  }, { icon: "🦅", category: "wizard decor", params: [
    { key: "color", label: "Stone", type: "color", default: 0x6a6358 }] });

  register("foe_glass_mirror", function (o) {
    const g = new THREE.Group(); const fr = M.brass(_c(o.frame, 0xb8923a));
    const W = 0.7, H = 1.4;
    g.add(_box(W, H, 0.04, M.metal(0x1a2028), [0, H / 2, 0]));   // dark glass
    g.add(_box(W + 0.12, 0.1, 0.08, fr, [0, H + 0.05, 0])); g.add(_box(W + 0.12, 0.1, 0.08, fr, [0, -0.05, 0]));
    g.add(_box(0.1, H + 0.2, 0.08, fr, [-(W / 2 + 0.05), H / 2, 0])); g.add(_box(0.1, H + 0.2, 0.08, fr, [W / 2 + 0.05, H / 2, 0]));
    // shadowy approaching shapes
    const shapes = [];
    for (let i = 0; i < 3; i++) { const sh = tglow(_c(o.color, 0x2a3a4a), 0.2, 0.5); const s = _sph(rand(0.08, 0.14), sh, [rand(-0.2, 0.2), H * 0.5, 0.03], 8); s.scale.y = 1.6; g.add(s); shapes.push({ m: s, mat: sh, ph: rand(0, 6), sp: rand(0.2, 0.5) }); }
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; shapes.forEach((s) => { const approach = (Math.sin(t * s.sp + s.ph) * 0.5 + 0.5); s.m.scale.setScalar(0.6 + approach * 1.2); s.m.scale.y *= 1.6; s.mat.opacity = 0.2 + approach * 0.45; s.m.position.x = Math.sin(t * s.sp * 0.7 + s.ph) * 0.18; }); };
    return g;
  }, { icon: "🪞", category: "wizard decor", params: [
    { key: "color", label: "Foe Shade", type: "color", default: 0x2a3a4a },
    { key: "frame", label: "Frame", type: "color", default: 0xb8923a }] });

  register("swinging_pendulum_blade", function (o) {
    const g = new THREE.Group(); const ir = M.metal(0x3a342c), edge = M.metal(0xa8a098);
    g.add(_box(1.2, 0.16, 0.16, M.wood(0x3a2414), [0, o.height, 0])); // ceiling beam
    const pend = new THREE.Group();
    pend.add(_cyl(0.012, 0.012, o.length, ir, [0, -o.length / 2, 0], 6));
    const blade = new THREE.Group();
    blade.add(_cyl(0.3, 0.02, 0.04, edge, [0, 0, 0], 16)); blade.children[0].rotation.x = Math.PI / 2; blade.children[0].scale.z = 0.2;
    blade.add(_box(0.06, 0.1, 0.06, ir, [0, 0.06, 0]));
    blade.position.y = -o.length; pend.add(blade);
    pend.position.set(0, o.height, 0); g.add(pend);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; pend.rotation.z = Math.sin(t * 1.4) * 0.7; blade.rotation.y += dt * 4; };
    return g;
  }, { icon: "⚙", category: "wizard decor", params: [
    { key: "height", label: "Mount Height", type: "number", min: 1.5, max: 3.5, step: 0.1, default: 2.6 },
    { key: "length", label: "Arm Length", type: "number", min: 0.8, max: 2.2, step: 0.1, default: 1.6 }] });

  register("oval_portrait", function (o) {
    const g = new THREE.Group(); const fr = M.brass(_c(o.frame, 0xc8a050)), cv = M.fabric(_c(o.color, 0x3a2a4a));
    const W = o.width, H = W * 1.3;
    const canvas = _cyl(W / 2, W / 2, 0.04, cv, [0, 0, 0], 24); canvas.scale.set(1, H / W, 1); canvas.rotation.x = Math.PI / 2; g.add(canvas);
    const ring = _tor(W / 2, 0.05, fr, [0, 0, 0.02], 8, 32); ring.scale.set(1, H / W, 1); g.add(ring);
    const head = _sph(0.08, M.fabric(0xe8c8a0), [0, 0.05, 0.03], 10); head.scale.set(0.7, 0.9, 0.4); g.add(head);
    return g;
  }, { icon: "🖼", category: "wizard decor", params: [
    { key: "width", label: "Width", type: "number", min: 0.3, max: 1.0, step: 0.05, default: 0.5 },
    { key: "color", label: "Canvas", type: "color", default: 0x3a2a4a },
    { key: "frame", label: "Frame", type: "color", default: 0xc8a050 }] });

  register("portrait_row", function (o) {
    const g = new THREE.Group(); const fr = M.wood(_c(o.frame, 0x3a2414));
    const cols = [0x4a3a5a, 0x3a4a3a, 0x5a3a2a, 0x2a3a4a];
    for (let i = 0; i < o.count; i++) { const x = (i - (o.count - 1) / 2) * 0.6; const w = rand(0.34, 0.46), h = rand(0.4, 0.56);
      g.add(_box(w + 0.06, h + 0.06, 0.05, fr, [x, 1.4, 0]));
      g.add(_box(w, h, 0.02, M.fabric(pick(cols)), [x, 1.4, 0.03]));
      const head = _sph(0.06, M.fabric(0xe8c8a0), [x, 1.45, 0.04], 8); head.scale.set(0.7, 0.9, 0.4); g.add(head); }
    return g;
  }, { icon: "🖼", category: "wizard decor", params: [
    { key: "count", label: "Portraits", type: "int", min: 2, max: 6, default: 4 },
    { key: "frame", label: "Frame", type: "color", default: 0x3a2414 }] });

  register("gilded_mirror", function (o) {
    const g = new THREE.Group(); const fr = M.brass(_c(o.frame, 0xc8a050)), gl = M.glass(0xbfd0d8);
    const W = o.width, H = W * 1.6;
    g.add(_box(W, H, 0.03, gl, [0, H / 2, 0]));
    g.add(_box(W + 0.12, 0.1, 0.06, fr, [0, H, 0])); g.add(_box(W + 0.12, 0.1, 0.06, fr, [0, 0, 0]));
    for (const sx of [-1, 1]) g.add(_box(0.1, H + 0.1, 0.06, fr, [sx * (W / 2 + 0.05), H / 2, 0]));
    for (let i = 0; i < 5; i++) { const a = Math.PI * i / 4; g.add(_sph(0.04, fr, [Math.cos(a) * (W / 2 + 0.05), H + Math.sin(a) * 0.12, 0.02], 8)); }
    return g;
  }, { icon: "🪞", category: "wizard decor", params: [
    { key: "width", label: "Width", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.7 },
    { key: "frame", label: "Frame", type: "color", default: 0xc8a050 }] });

  // ════════════════════════════════════════════════════════════
  //  HEARTH / FIRE  (animated flames)
  // ════════════════════════════════════════════════════════════

  register("standing_globe", function (o) {
    const g = new THREE.Group(); const wd = M.wood(_c(o.color, 0x3a2414)), br = M.brass(0xc8a050);
    g.add(_cyl(0.18, 0.22, 0.05, wd, [0, 0.025, 0], 12));
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; const leg = _cyl(0.02, 0.025, 0.7, wd, [Math.cos(a) * 0.12, 0.38, Math.sin(a) * 0.12], 6); leg.rotation.x = Math.sin(a) * 0.1; leg.rotation.z = -Math.cos(a) * 0.1; g.add(leg); }
    const globe = new THREE.Group();
    globe.add(_sph(0.2, M.fabric(_c(o.sphere, 0x3a6a8a)), [0, 0, 0], 16));
    for (let i = 0; i < 6; i++) globe.add(_box(rand(0.06, 0.12), rand(0.05, 0.1), 0.005, M.leaf(0x4a7a3a), [rand(-0.12, 0.12), rand(-0.1, 0.1), 0.19]));
    const ring = _tor(0.22, 0.012, br, [0, 0, 0], 6, 24); globe.add(ring); globe.rotation.z = 0.4;
    globe.position.y = 0.85; g.add(globe);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; globe.rotation.y += dt * 0.2; };
    return g;
  }, { icon: "🌐", category: "wizard decor", params: [
    { key: "color", label: "Stand", type: "color", default: 0x3a2414 },
    { key: "sphere", label: "Globe", type: "color", default: 0x3a6a8a }] });
})();
