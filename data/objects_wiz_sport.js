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

  register("flying_broom", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(_c(o.color, 0x5a3a1a)), straw = M.straw(), y = o.height;
    const handle = _cyl(0.02, 0.03, 1.2, wd, [0, y, 0], 8); handle.rotation.z = Math.PI / 2; g.add(handle);
    for (let i = 0; i < 14; i++) {                              // bristles
      const a = rand(0, Math.PI * 2), rr = rand(0, 0.06);
      const br = _cyl(0.004, 0.006, 0.4, straw, [-0.75, y + Math.cos(a) * rr, Math.sin(a) * rr], 4);
      br.rotation.z = Math.PI / 2 + rand(-0.15, 0.15);
      br.rotation.y = rand(-0.15, 0.15);
      g.add(br);
    }
    const bind = _cyl(0.045, 0.045, 0.06, M.leather(), [-0.55, y, 0], 8); bind.rotation.z = Math.PI / 2; g.add(bind);
    return g;
  }, {
    icon: "⌁", category: "wizard sport",
    params: [
      { key: "color",  label: "Wood",  type: "color",  default: 0x5a3a1a },
      { key: "height", label: "Hover", type: "number", min: 0.1, max: 2, step: 0.1, default: 0.6 },
    ],
  });

  // ── Arcane brazier ───────────────────────────────────────────
  // Tripod bowl with cold magical flame and floating embers.

  register("flying_carpet", function (o) {
    const g = new THREE.Group(); const c1 = M.cloth(_c(o.color, 0x7a1a2a)), c2 = M.cloth(_c(o.accent, 0xd6b84a));
    const W = 1.0, L = 1.6, y = o.height, nx = 5, nz = 8;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) { const x = -W / 2 + (i + 0.5) * W / nx, z = -L / 2 + (j + 0.5) * L / nz; const wave = 0.08 * Math.sin(j * 0.9) + 0.04 * Math.cos(i * 1.2); const tile = _box(W / nx + 0.005, 0.03, L / nz + 0.005, ((i + j) % 2 ? c2 : c1), [x, y + wave, z]); tile.rotation.x = 0.12 * Math.cos(j * 0.9); g.add(tile); }
    for (const zz of [-L / 2, L / 2]) for (let i = 0; i < 6; i++) { const x = -W / 2 + (i + 0.5) * W / 6; g.add(_cyl(0.01, 0.01, 0.08, c2, [x, y - 0.04, zz + Math.sign(zz) * 0.04], 4)); }
    return g;
  }, { icon: "⌑", category: "wizard sport", params: [
    { key: "height", label: "Hover", type: "number", min: 0.2, max: 1.5, step: 0.1, default: 0.6 },
    { key: "color", label: "Carpet", type: "color", default: 0x7a1a2a },
    { key: "accent", label: "Accent", type: "color", default: 0xd6b84a }] });

  register("wizard_chess", function (o) {
    const g = new THREE.Group(); const lite = M.stone(_c(o.light, 0xc8b89a)), dark = M.stone(_c(o.dark, 0x3a3530)); const S = o.size, sq = S / 8;
    g.add(_box(S + 0.1, 0.06, S + 0.1, M.wood(0x2a1a10), [0, 0.43, 0]));
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) g.add(_box(sq, 0.02, sq, ((i + j) % 2 ? lite : dark), [-S / 2 + (i + 0.5) * sq, 0.47, -S / 2 + (j + 0.5) * sq]));
    const pm = M.marble(0xe8e0d0), dm = M.stone(0x222018);
    function pawn(x, z, mat) { g.add(_cyl(sq * 0.18, sq * 0.22, sq * 0.3, mat, [x, 0.48 + sq * 0.15, z], 8)); g.add(_sph(sq * 0.16, mat, [x, 0.48 + sq * 0.32, z], 8)); }
    function king(x, z, mat) { g.add(_cyl(sq * 0.2, sq * 0.26, sq * 0.5, mat, [x, 0.48 + sq * 0.25, z], 8)); g.add(_sph(sq * 0.18, mat, [x, 0.48 + sq * 0.55, z], 8)); g.add(_box(sq * 0.06, sq * 0.18, sq * 0.06, mat, [x, 0.48 + sq * 0.7, z])); }
    for (let i = 0; i < 4; i++) { pawn(-S / 2 + (i + 0.5) * sq, -S / 2 + 1.5 * sq, pm); pawn(-S / 2 + (i + 2) * sq, S / 2 - 1.5 * sq, dm); }
    king(0, -S / 2 + 0.5 * sq, pm); king(0, S / 2 - 0.5 * sq, dm);
    return g;
  }, { icon: "♟", category: "wizard sport", params: [
    { key: "size", label: "Board", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.8 },
    { key: "light", label: "Light sq", type: "color", default: 0xc8b89a },
    { key: "dark", label: "Dark sq", type: "color", default: 0x3a3530 }] });

  register("goal_hoop", function (o) {
    const g = new THREE.Group(); const m = M.brass(_c(o.color, 0xc8a050)), wd = M.wood(0x4a3018);
    g.add(_cyl(0.14, 0.18, 0.1, wd, [0, 0.05, 0], 12));
    g.add(_cyl(0.04, 0.05, o.height, m, [0, o.height / 2, 0], 10));
    const ring = _tor(o.ring, 0.03, m, [0, o.height + o.ring, 0], 10, 28); g.add(ring);
    return g;
  }, { icon: "⭕", category: "wizard sport", params: [
    { key: "height", label: "Post Height", type: "number", min: 1.5, max: 5, step: 0.5, default: 3 },
    { key: "ring", label: "Ring Radius", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
    { key: "color", label: "Metal", type: "color", default: 0xc8a050 }] });

  register("pitch_pennant", function (o) {
    const g = new THREE.Group(); const m = M.metal(0x3a342c), cl = M.cloth(_c(o.color, 0xc8a020));
    g.add(_cyl(0.025, 0.03, 1.4, m, [0, 0.7, 0], 8));
    const flag = new THREE.Group(); const segs = [];
    for (let i = 0; i < 4; i++) { const s = new THREE.Group(); s.add(_box(0.12, 0.3, 0.01, cl, [0.06, 0, 0])); s.position.x = 0.04 + i * 0.12; flag.add(s); segs.push(s); }
    flag.position.set(0, 1.25, 0); g.add(flag);
    let t = rand(0, 6);
    g.userData.tick = (dt) => { t += dt; segs.forEach((s, i) => { s.rotation.y = Math.sin(t * 4 - i * 0.8) * 0.3 * (i / 4 + 0.3); }); };
    return g;
  }, { icon: "🚩", category: "wizard sport", params: [
    { key: "color", label: "Flag", type: "color", default: 0xc8a020 }] });
})();
