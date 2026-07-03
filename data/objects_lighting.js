// category: "lighting"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("candelabra", function (o) {
    const g = new THREE.Group();
    const m = M.brass(o.color);
    // base
    g.add(_cyl(0.10, 0.12, 0.04, m, [0, 0.02, 0], 16));
    // stem
    g.add(_cyl(0.025, 0.03, o.height - 0.15, m, [0, o.height / 2, 0], 8));
    // arms + candles
    for (let i = 0; i < o.candles; i++) {
      const a = (i / o.candles) * Math.PI * 2;
      const ax = Math.sin(a) * o.spread;
      const az = Math.cos(a) * o.spread;
      // arm
      const arm = _cyl(0.015, 0.015, o.spread * 1.2, m, [ax / 2, o.height - 0.08, az / 2], 6);
      arm.rotation.z = Math.sin(a) * Math.PI / 4;
      arm.rotation.x = -Math.cos(a) * Math.PI / 4;
      g.add(arm);
      // candle
      g.add(_cyl(0.025, 0.025, 0.14, M.wax(), [ax, o.height + 0.02, az], 8));
      // flame light
      const flame = new THREE.PointLight(0xffaa55, 0.6, 3, 2);
      flame.position.set(ax, o.height + 0.12, az);
      flame.userData.flicker = { base: 0.5, jitter: 0.2 };
      g.add(flame);
    }
    return g;
  }, {
    icon: "🕯️", category: "decorative",
    params: [
      { key: "candles", label: "Candles", type: "int",    min: 3,   max: 7,   default: 5 },
      { key: "height",  label: "Height",  type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.50 },
      { key: "spread",  label: "Spread",  type: "number", min: 0.10, max: 0.30, step: 0.02, default: 0.18 },
      { key: "color",   label: "Metal",   type: "color",  default: 0xc8a050 },
    ],
  });

  register("chandelier", function (o) {
    const g = new THREE.Group();
    const m = M.brass(o.color);
    // center post
    g.add(_cyl(0.03, 0.03, 0.20, m, [0, 0, 0], 8));
    // ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(o.radius, 0.015, 8, 24),
      m
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.10;
    g.add(ring);
    // arms + candles
    for (let i = 0; i < o.arms; i++) {
      const a = (i / o.arms) * Math.PI * 2;
      const ax = Math.sin(a) * o.radius;
      const az = Math.cos(a) * o.radius;
      // arm
      g.add(_cyl(0.012, 0.012, o.radius, m, [ax / 2, -0.10, az / 2], 6));
      g.children[g.children.length - 1].rotation.z = Math.sin(a) * Math.PI / 2;
      g.children[g.children.length - 1].rotation.x = -Math.cos(a) * Math.PI / 2;
      // candle
      g.add(_cyl(0.02, 0.02, 0.12, M.wax(), [ax, -0.04, az], 8));
      // light
      const light = new THREE.PointLight(0xffaa55, o.intensity / o.arms, 6, 1.5);
      light.position.set(ax, 0.05, az);
      light.userData.flicker = { base: o.intensity / o.arms * 0.8, jitter: 0.15 };
      g.add(light);
    }
    return g;
  }, {
    icon: "💡", category: "lighting",
    params: [
      { key: "arms",      label: "Arms",      type: "int",    min: 3,   max: 12,  default: 6 },
      { key: "radius",    label: "Radius",    type: "number", min: 0.2, max: 0.8, step: 0.05, default: 0.45 },
      { key: "intensity", label: "Intensity", type: "number", min: 0.5, max: 4.0, step: 0.25, default: 2.0 },
      { key: "color",     label: "Metal",     type: "color",  default: 0xc8a050 },
    ],
  });

  register("floor_lamp", function (o) {
    const g = new THREE.Group();
    // base
    g.add(_cyl(0.14, 0.16, 0.03, M.metal(o.baseColor), [0, 0.015, 0], 20));
    // pole
    g.add(_cyl(0.02, 0.02, o.height - 0.30, M.metal(o.baseColor), [0, o.height / 2, 0], 8));
    // shade
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(o.shadeRadius, o.shadeRadius * 1.2, 16, 1, true),
      M.fabric(o.shadeColor)
    );
    shade.position.y = o.height - 0.15;
    g.add(shade);
    // bulb
    const bulb = new THREE.PointLight(o.lightColor, o.intensity, 8, 1.2);
    bulb.position.y = o.height - 0.25;
    g.add(bulb);
    return g;
  }, {
    icon: "🪔", category: "lighting",
    params: [
      { key: "height",      label: "Height",    type: "number", min: 1.0, max: 2.2, step: 0.1,  default: 1.6 },
      { key: "shadeRadius", label: "Shade R",   type: "number", min: 0.12, max: 0.4, step: 0.02, default: 0.22 },
      { key: "intensity",   label: "Intensity", type: "number", min: 0.3, max: 3.0, step: 0.1,  default: 1.2 },
      { key: "shadeColor",  label: "Shade",     type: "color",  default: 0xe8d8b8 },
      { key: "baseColor",   label: "Base",      type: "color",  default: 0x2a2520 },
      { key: "lightColor",  label: "Light",     type: "color",  default: 0xffc080 },
    ],
  });

  register("lantern", function (o) {
    const g = new THREE.Group();
    const m = M.metal(o.color);
    // base plate
    g.add(_cyl(0.06, 0.06, 0.02, m, [0, 0.01, 0], 8));
    // cage pillars
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.add(_cyl(0.008, 0.008, o.height, m,
        [Math.sin(a) * 0.05, o.height / 2, Math.cos(a) * 0.05], 4));
    }
    // top cap
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.06, 4), m);
    cap.position.y = o.height + 0.03;
    cap.rotation.y = Math.PI / 4;
    g.add(cap);
    // glass panes (transparent)
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const pane = _box(0.09, o.height * 0.7, 0.003, M.glass(0xfff0c8),
        [Math.sin(a) * 0.05, o.height * 0.45, Math.cos(a) * 0.05]);
      pane.rotation.y = -a;
      g.add(pane);
    }
    // candle flame
    const flame = new THREE.PointLight(0xffaa55, o.intensity, 4, 2);
    flame.position.y = o.height * 0.45;
    flame.userData.flicker = { base: o.intensity * 0.8, jitter: 0.3 };
    g.add(flame);
    return g;
  }, {
    icon: "🏮", category: "lighting",
    params: [
      { key: "height",    label: "Height",    type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.28 },
      { key: "intensity", label: "Intensity", type: "number", min: 0.3, max: 2.0, step: 0.1,  default: 0.9 },
      { key: "color",     label: "Metal",     type: "color",  default: 0x2a2520 },
    ],
  });

  register("torch", function (o) {
    const g = new THREE.Group();
    const w = M.wood(0x3a2010);
    // pole
    g.add(_cyl(0.025, 0.035, o.height, w, [0, o.height / 2, 0], 6));
    // bracket (for wall mounting)
    g.add(_box(0.08, 0.04, 0.12, M.metal(0x3a3a3a), [0, o.height * 0.3, -0.06]));
    // flame bowl
    const bowl = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.08, 8, 1, true),
      M.metal(0x3a3a3a)
    );
    bowl.position.y = o.height + 0.02;
    g.add(bowl);
    // fire light
    const fire = new THREE.PointLight(0xff6620, o.intensity, 6, 1.5);
    fire.position.y = o.height + 0.10;
    fire.userData.flicker = { base: o.intensity * 0.7, jitter: 0.4 };
    g.add(fire);
    return g;
  }, {
    icon: "🔥", category: "lighting",
    params: [
      { key: "height",    label: "Height",    type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.8 },
      { key: "intensity", label: "Intensity", type: "number", min: 0.5, max: 3.0, step: 0.25, default: 1.5 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // MISCELLANEOUS / PROPS
  // ════════════════════════════════════════════════════════

  register("candle_set", function (o) {
    const g = new THREE.Group();
    for (let i = 0; i < o.count; i++) {
      const x = (i - (o.count - 1) / 2) * 0.08;
      const h = rand(0.10, 0.25);
      g.add(_cyl(0.025, 0.025, h, M.wax(o.color), [x, h / 2, 0], 8));
      const flame = new THREE.PointLight(0xffaa55, 0.5, 2.5, 2);
      flame.position.set(x, h + 0.04, 0);
      flame.userData.flicker = { base: 0.4, jitter: 0.2 };
      g.add(flame);
    }
    return g;
  }, {
    icon: "🕯️", category: "props",
    params: [
      { key: "count", label: "Count", type: "int",   min: 1, max: 7, default: 3 },
      { key: "color", label: "Wax",   type: "color", default: 0xf0e8c8 },
    ],
  });

  register("campfire", function (o) {
    const g = new THREE.Group();
    // stone ring
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const stone = new THREE.Mesh(
        new THREE.SphereGeometry(rand(0.06, 0.10), 6, 4),
        M.stone(0x5a5248)
      );
      stone.position.set(Math.sin(a) * o.radius, 0.04, Math.cos(a) * o.radius);
      stone.scale.y = 0.6;
      g.add(stone);
    }
    // logs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const log = _cyl(0.035, 0.03, o.radius * 1.2, M.wood(0x3a2010), [0, 0.05, 0], 6);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = a;
      log.position.set(Math.sin(a) * 0.02, 0.05, Math.cos(a) * 0.02);
      g.add(log);
    }
    // fire light
    const fire = new THREE.PointLight(0xff5500, o.intensity, 8, 1.5);
    fire.position.y = 0.20;
    fire.userData.flicker = { base: o.intensity * 0.7, jitter: 0.5 };
    g.add(fire);
    return g;
  }, {
    icon: "🔥", category: "props",
    params: [
      { key: "radius",    label: "Radius",    type: "number", min: 0.2, max: 0.8, step: 0.05, default: 0.35 },
      { key: "intensity", label: "Intensity", type: "number", min: 0.5, max: 4.0, step: 0.25, default: 2.0 },
    ],
  });

  register("chandelier_ornate", function (o) {
    const g = new THREE.Group();
    const mat = M.brass(o.color);
    const arms = o.arms;
    const r = o.radius;
    // central hub
    g.add(_cyl(0.04, 0.06, 0.12, mat, [0, 0, 0], 12));
    // chain to ceiling
    for (let c = 0; c < 5; c++) {
      g.add(_cyl(0.008, 0.008, 0.06, mat, [0, 0.06 + c * 0.065, 0], 6));
    }
    // arms
    for (let i = 0; i < arms; i++) {
      const angle = (i / arms) * Math.PI * 2;
      const ax = Math.sin(angle) * r;
      const az = Math.cos(angle) * r;
      // arm bar
      const arm = _box(r, 0.02, 0.02, mat, [ax/2, 0, az/2]);
      arm.rotation.y = -angle;
      g.add(arm);
      // cup at end
      g.add(_cyl(0.03, 0.02, 0.03, mat, [ax, -0.015, az], 8));
      // candle
      g.add(_cyl(0.012, 0.012, 0.08, M.wax(), [ax, 0.04, az], 8));
      // flame
      const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 1.5 })
      );
      flame.position.set(ax, 0.09, az);
      flame.scale.set(1, 1.8, 1);
      g.add(flame);
    }
    // crystal drops
    if (o.crystals) {
      const crMat = M.glass(0xd8e8f8);
      for (let i = 0; i < arms * 2; i++) {
        const angle = (i / (arms * 2)) * Math.PI * 2;
        const cr = r * 0.6;
        g.add(_cyl(0.005, 0.002, 0.06, crMat, [Math.sin(angle) * cr, -0.06, Math.cos(angle) * cr], 5));
      }
    }
    return g;
  }, {
    icon: "✨", category: "decorative",
    params: [
      { key: "arms",     label: "Arms",     type: "int",    min: 4,   max: 12,  default: 6 },
      { key: "radius",   label: "Radius",   type: "number", min: 0.3, max: 1.0, step: 0.05, default: 0.5 },
      { key: "crystals", label: "Crystals", type: "bool",   default: true },
      { key: "color",    label: "Metal",    type: "color",  default: 0xc8a050 },
    ],
  });

  register("sconce", function (o) {
    const g = new THREE.Group();
    const mat = M.metal(o.color);
    // wall plate
    g.add(_box(0.08, 0.12, 0.02, mat, [0, 0, -0.01]));
    // arm
    g.add(_box(0.03, 0.03, 0.12, mat, [0, 0, 0.05]));
    // cup
    g.add(_cyl(0.04, 0.03, 0.03, mat, [0, -0.015, 0.12], 8));
    // candle
    g.add(_cyl(0.012, 0.012, 0.06, M.wax(), [0, 0.03, 0.12], 8));
    // flame
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 6, 4),
      new THREE.MeshStandardMaterial({ color: 0xffaa44, emissive: 0xffaa44, emissiveIntensity: 2.0 })
    );
    flame.position.set(0, 0.065, 0.12);
    flame.scale.set(1, 1.6, 1);
    g.add(flame);
    // optional point light
    if (o.emitLight) {
      const pl = new THREE.PointLight(0xffcc88, 0.6, 4, 1.5);
      pl.position.set(0, 0.07, 0.12);
      g.add(pl);
      g.userData.flicker = pl;
    }
    return g;
  }, {
    icon: "🕯️", category: "lighting",
    params: [
      { key: "emitLight", label: "Emit light", type: "bool", default: true },
      { key: "color",     label: "Metal",      type: "color", default: 0x4a3a2a },
    ],
  });

  register("fire_pit", function (o) {
    const g = new THREE.Group();
    const stone = M.stone(o.color);
    const r = o.radius;
    // ring of stones
    const count = Math.floor(r * 30);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const st = _box(0.12, rand(0.12, 0.2), 0.1, stone,
        [Math.sin(a) * r, 0.08, Math.cos(a) * r]);
      st.rotation.y = a + rand(-0.2, 0.2);
      g.add(st);
    }
    // logs inside
    for (let i = 0; i < 3; i++) {
      const la = rand(0, Math.PI * 2);
      const log = _cyl(0.03, 0.025, 0.4, M.wood(0x3a2a1a), [0, 0.05, 0], 6);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = la;
      log.position.set(Math.sin(la) * 0.05, 0.06, Math.cos(la) * 0.05);
      g.add(log);
    }
    // fire emissive cones
    const fireMat = new THREE.MeshStandardMaterial({ color: 0xff6622, emissive: 0xff4400, emissiveIntensity: 2.0, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 5; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(rand(0.03, 0.06), rand(0.15, 0.3), 5), fireMat);
      f.position.set(rand(-0.06, 0.06), rand(0.1, 0.2), rand(-0.06, 0.06));
      g.add(f);
    }
    // point light
    const pl = new THREE.PointLight(0xff6622, 1.0, 6, 1.5);
    pl.position.set(0, 0.25, 0);
    g.add(pl);
    g.userData.flicker = pl;
    return g;
  }, {
    icon: "🔥", category: "lighting",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.3, max: 1.2, step: 0.1, default: 0.5 },
      { key: "color",  label: "Stone",  type: "color",  default: 0x5a5048 },
    ],
  });

  register("street_lamp", function (o) {
    const g = new THREE.Group();
    const mat = M.metal(o.color);
    const h = o.height;
    // pole
    g.add(_cyl(0.04, 0.06, h, mat, [0, h/2, 0], 8));
    // base
    g.add(_cyl(0.12, 0.15, 0.08, mat, [0, 0.04, 0], 8));
    // arm
    g.add(_box(0.03, 0.03, 0.3, mat, [0, h - 0.1, 0.15]));
    // lamp housing (box shape)
    g.add(_box(0.14, 0.2, 0.14, mat, [0, h - 0.05, 0.3]));
    // glass panels
    const gl = M.glass(0xffeedd);
    g.add(_box(0.001, 0.14, 0.12, gl, [-0.07, h - 0.05, 0.3]));
    g.add(_box(0.001, 0.14, 0.12, gl, [ 0.07, h - 0.05, 0.3]));
    g.add(_box(0.12, 0.14, 0.001, gl, [0, h - 0.05, 0.37]));
    g.add(_box(0.12, 0.14, 0.001, gl, [0, h - 0.05, 0.23]));
    // emissive bulb
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffcc88, emissive: 0xffcc88, emissiveIntensity: 2.0 })
    );
    bulb.position.set(0, h - 0.05, 0.3);
    g.add(bulb);
    if (o.emitLight) {
      const pl = new THREE.PointLight(0xffcc88, 0.8, 8, 1.5);
      pl.position.set(0, h - 0.1, 0.3);
      g.add(pl);
    }
    return g;
  }, {
    icon: "🏮", category: "lighting",
    params: [
      { key: "height",    label: "Height",     type: "number", min: 2.0, max: 5.0, step: 0.25, default: 3.0 },
      { key: "emitLight", label: "Emit light", type: "bool",   default: true },
      { key: "color",     label: "Metal",      type: "color",  default: 0x2a2a2a },
    ],
  });

  // ════════════════════════════════════════════════════════
  // PROPS — WAVE 2
  // ════════════════════════════════════════════════════════

  register("candle", (opts = {}) => {
    const g = new THREE.Group();
    g.add(_cyl(0.04, 0.04, 0.18,
      new THREE.MeshStandardMaterial({ color: _c(opts.waxColor, 0xf0e8c8), roughness: 0.6 }),
      [0, 0.09, 0]));
    const intensity = opts.intensity !== undefined ? opts.intensity : 1.1;
    const dist = opts.distance !== undefined ? opts.distance : 3;
    const flame = new THREE.PointLight(_c(opts.color, 0xffaa55), intensity, dist, 2);
    flame.position.y = 0.22;
    g.add(flame);
    return g;
  }, { icon: "🕯", category: "lighting", params: [
    { key: "intensity", label: "Intensity",  type: "number", min: 0, max: 3, step: 0.1, default: 1.1 },
    { key: "distance",  label: "Range (m)",  type: "number", min: 0, max: 10, step: 0.5, default: 3 },
    { key: "color",     label: "Flame",      type: "color",  default: 0xffaa55 },
    { key: "waxColor",  label: "Wax",        type: "color",  default: 0xf0e8c8 },
  ]});

  register("floorLamp", (opts = {}) => {
    const g = new THREE.Group();
    const m = M.metal(_c(opts.poleColor, 0x2a2018));
    const sh = M.cloth(_c(opts.shadeColor, 0xe8d6a4));
    const H = opts.height || 1.8;
    g.add(_cyl(0.25, 0.30, 0.05, m, [0, 0.025, 0], 16));
    g.add(_cyl(0.025, 0.025, H-0.15, m, [0, (H-0.15)/2 + 0.05, 0]));
    g.add(_cyl(0.20, 0.30, 0.30, sh, [0, H, 0], 18));
    const bulb = new THREE.PointLight(_c(opts.color, 0xffd9a0),
      opts.intensity !== undefined ? opts.intensity : 1.0,
      opts.distance !== undefined ? opts.distance : 6, 1.5);
    bulb.position.y = H - 0.05; g.add(bulb);
    return g;
  }, { icon: "💡", category: "lighting", params: [
    { key: "height",     label: "Height",    type: "number", min: 1.2, max: 2.5, step: 0.05, default: 1.8 },
    { key: "intensity",  label: "Intensity", type: "number", min: 0,   max: 4,   step: 0.05, default: 1.0 },
    { key: "distance",   label: "Range (m)", type: "number", min: 0,   max: 20,  step: 0.5,  default: 6 },
    { key: "color",      label: "Bulb",      type: "color",  default: 0xffd9a0 },
    { key: "shadeColor", label: "Shade",     type: "color",  default: 0xe8d6a4 },
    { key: "poleColor",  label: "Pole",      type: "color",  default: 0x2a2018 },
  ]});

  register("tableLamp", (opts = {}) => {
    const g = new THREE.Group();
    const m = M.metal(_c(opts.baseColor, 0x2a2018));
    const sh = M.cloth(_c(opts.shadeColor, 0xece2b8));
    g.add(_cyl(0.12, 0.14, 0.04, m, [0, 0.02, 0], 14));
    g.add(_cyl(0.02, 0.02, 0.30, m, [0, 0.17, 0]));
    g.add(_cyl(0.13, 0.18, 0.20, sh, [0, 0.40, 0], 16));
    const bulb = new THREE.PointLight(_c(opts.color, 0xffd9a0),
      opts.intensity !== undefined ? opts.intensity : 0.8,
      opts.distance !== undefined ? opts.distance : 4, 1.5);
    bulb.position.y = 0.38; g.add(bulb);
    return g;
  }, { icon: "🕯", category: "lighting", params: [
    { key: "intensity",  label: "Intensity", type: "number", min: 0, max: 3,  step: 0.05, default: 0.8 },
    { key: "distance",   label: "Range (m)", type: "number", min: 0, max: 15, step: 0.5,  default: 4 },
    { key: "color",      label: "Bulb",      type: "color",  default: 0xffd9a0 },
    { key: "shadeColor", label: "Shade",     type: "color",  default: 0xece2b8 },
    { key: "baseColor",  label: "Base",      type: "color",  default: 0x2a2018 },
  ]});

  register("pendantLamp", (opts = {}) => {
    const g = new THREE.Group();
    const m = M.metal(_c(opts.shadeColor, 0x1a1410));
    const cordL = opts.cordLength || 1.2;
    g.add(_cyl(0.005, 0.005, cordL, m, [0, cordL/2, 0]));
    g.add(_cone(0.22, 0.18, m, [0, 0.10, 0], 18));
    const bulb = new THREE.PointLight(_c(opts.color, 0xffd9a0),
      opts.intensity !== undefined ? opts.intensity : 1.2,
      opts.distance !== undefined ? opts.distance : 5, 1.5);
    bulb.position.y = 0.05; g.add(bulb);
    return g;
  }, { icon: "💡", category: "lighting", params: [
    { key: "cordLength", label: "Cord length", type: "number", min: 0.3, max: 3.0, step: 0.1, default: 1.2 },
    { key: "intensity",  label: "Intensity",   type: "number", min: 0,   max: 5,   step: 0.05, default: 1.2 },
    { key: "distance",   label: "Range (m)",   type: "number", min: 0,   max: 20,  step: 0.5, default: 5 },
    { key: "color",      label: "Bulb",        type: "color",  default: 0xffd9a0 },
    { key: "shadeColor", label: "Shade",       type: "color",  default: 0x1a1410 },
  ]});

  register("wallSconce", (opts = {}) => {
    const g = new THREE.Group();
    const m = M.metal(_c(opts.baseColor, 0x2a2018));
    const sh = M.cloth(_c(opts.shadeColor, 0xece2b8));
    g.add(_box(0.10, 0.20, 0.04, m, [0, 0, 0]));
    g.add(_cyl(0.08, 0.12, 0.14, sh, [0, 0, 0.12], 14));
    const bulb = new THREE.PointLight(_c(opts.color, 0xffd9a0),
      opts.intensity !== undefined ? opts.intensity : 0.6,
      opts.distance !== undefined ? opts.distance : 3, 1.5);
    bulb.position.set(0, 0, 0.12); g.add(bulb);
    return g;
  }, { icon: "🪔", category: "lighting", params: [
    { key: "intensity",  label: "Intensity", type: "number", min: 0, max: 3,  step: 0.05, default: 0.6 },
    { key: "distance",   label: "Range (m)", type: "number", min: 0, max: 10, step: 0.5,  default: 3 },
    { key: "color",      label: "Bulb",      type: "color",  default: 0xffd9a0 },
    { key: "shadeColor", label: "Shade",     type: "color",  default: 0xece2b8 },
    { key: "baseColor",  label: "Base",      type: "color",  default: 0x2a2018 },
  ]});

  register("torchWall", (opts = {}) => {
    const g = new THREE.Group();
    const m = M.metal(_c(opts.bracketColor, 0x1a1410));
    g.add(_box(0.08, 0.10, 0.04, m, [0, 0, 0]));
    g.add(_cyl(0.022, 0.022, 0.30, m, [0, 0.10, 0.04]));
    const flameCol = _c(opts.color, 0xff8a3a);
    g.add(_sph(0.06, new THREE.MeshStandardMaterial({
      color: flameCol, emissive: flameCol, emissiveIntensity: 1.0, roughness: 0.4,
    }), [0, 0.30, 0.04], 10));
    const f = new THREE.PointLight(flameCol,
      opts.intensity !== undefined ? opts.intensity : 1.4,
      opts.distance !== undefined ? opts.distance : 4, 1.6);
    f.position.set(0, 0.30, 0.04); g.add(f);
    return g;
  }, { icon: "🔥", category: "lighting", params: [
    { key: "intensity",    label: "Flame",       type: "number", min: 0, max: 5,  step: 0.05, default: 1.4 },
    { key: "distance",     label: "Range (m)",   type: "number", min: 0, max: 15, step: 0.5,  default: 4 },
    { key: "color",        label: "Flame color", type: "color",  default: 0xff8a3a },
    { key: "bracketColor", label: "Bracket",     type: "color",  default: 0x1a1410 },
  ]});

  register("lamppost", (opts = {}) => {
    const g = new THREE.Group();
    const m = M.metal(_c(opts.color, 0x1a1410));
    const H = opts.height || 3.0;
    g.add(_cyl(0.10, 0.12, 0.10, m, [0, 0.05, 0], 12));
    g.add(_cyl(0.04, 0.04, H-0.15, m, [0, (H-0.15)/2 + 0.05, 0]));
    g.add(_box(0.20, 0.20, 0.20, m, [0, H-0.05, 0]));
    const light = new THREE.PointLight(_c(opts.lightColor, 0xffd9a0),
      opts.intensity !== undefined ? opts.intensity : 1.4,
      opts.distance !== undefined ? opts.distance : 8, 1.8);
    light.position.y = H-0.05; g.add(light);
    return g;
  }, { icon: "💡", category: "outdoor", params: [
    { key: "height",     label: "Height",    type: "number", min: 1.5, max: 5.0, step: 0.1, default: 3.0 },
    { key: "intensity",  label: "Intensity", type: "number", min: 0,   max: 5,   step: 0.05, default: 1.4 },
    { key: "distance",   label: "Range (m)", type: "number", min: 0,   max: 25,  step: 1,    default: 8 },
    { key: "lightColor", label: "Bulb",      type: "color",  default: 0xffd9a0 },
    { key: "color",      label: "Post",      type: "color",  default: 0x1a1410 },
  ]});

  // ═══════════════════════════════════════════════════════
  // PROPS / DECOR
  // ═══════════════════════════════════════════════════════

  register("lamp_post_double", function (o) {
    const g = new THREE.Group();
    const met = M.metal(o.color);
    // main pole
    g.add(_cyl(0.05, 0.06, o.height, met, [0, o.height / 2, 0], 10));
    // decorative base
    g.add(_cyl(0.12, 0.15, 0.08, met, [0, 0.04, 0], 10));
    g.add(_cyl(0.08, 0.12, 0.06, met, [0, 0.11, 0], 10));
    // two arms curving outward
    for (let side = -1; side <= 1; side += 2) {
      // arm
      g.add(_cyl(0.025, 0.025, o.armLen, met, [side * o.armLen / 2, o.height - 0.05, 0], 6));
      g.children[g.children.length - 1].rotation.z = side * 0.3;
      // lantern housing
      const lx = side * o.armLen * 0.85;
      const ly = o.height + 0.1;
      g.add(_box(0.12, 0.18, 0.12, met, [lx, ly, 0]));
      // glass panes
      g.add(_box(0.08, 0.12, 0.08, M.glass(o.glassColor), [lx, ly, 0]));
      // cap
      g.add(_cone(0.09, 0.08, met, [lx, ly + 0.13, 0], 4));
    }
    return g;
  }, {
    icon: "💡", category: "road",
    params: [
      { key: "height",     label: "Height", type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.0 },
      { key: "armLen",     label: "Arm Len", type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.6 },
      { key: "color",      label: "Metal",  type: "color",  default: 0x1a1a1a },
      { key: "glassColor", label: "Glass",  type: "color",  default: 0xf0e8a0 },
    ],
  });

  register("torch_stand", function (o) {
    const g = new THREE.Group();
    const met = M.metal(o.color);
    // base plate
    g.add(_cyl(0.12, 0.15, 0.03, met, [0, 0.015, 0], 8));
    // pole
    g.add(_cyl(0.025, 0.02, o.height, met, [0, o.height / 2, 0], 6));
    // brazier bowl at top
    g.add(_cyl(0.06, 0.1, 0.08, met, [0, o.height, 0], 8));
    // fire (orange/yellow spheres)
    g.add(_sph(0.06, M.ceramic(0xe86010), [0, o.height + 0.08, 0], 6));
    g.add(_sph(0.04, M.ceramic(0xf0a020), [0, o.height + 0.12, 0], 5));
    g.add(_sph(0.025, M.ceramic(0xf0e040), [0, o.height + 0.15, 0], 4));
    return g;
  }, {
    icon: "🔥", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.5 },
      { key: "color", label: "Color", type: "color", default: 0x2a2a28 },
    ],
  });

  register("hanging_lantern", function (o) {
    const g = new THREE.Group();
    const met = M.metal(o.metalColor);
    // chain from hook
    g.add(_cyl(0.008, 0.008, o.chainLen, met, [0, -o.chainLen / 2, 0], 4));
    // hook at top
    g.add(_tor(0.025, 0.006, met, [0, 0.02, 0], 8, 4));
    // lantern body
    const ly = -o.chainLen;
    g.add(_box(o.size, o.size * 1.3, o.size, met, [0, ly, 0]));
    // glass panes
    const gls = M.glass(o.glassColor);
    g.add(_box(o.size - 0.02, o.size * 1.0, 0.005, gls, [0, ly, o.size / 2]));
    g.add(_box(o.size - 0.02, o.size * 1.0, 0.005, gls, [0, ly, -o.size / 2]));
    g.add(_box(0.005, o.size * 1.0, o.size - 0.02, gls, [o.size / 2, ly, 0]));
    g.add(_box(0.005, o.size * 1.0, o.size - 0.02, gls, [-o.size / 2, ly, 0]));
    // candle inside
    g.add(_cyl(0.01, 0.01, o.size * 0.4, M.plaster(0xe8e0c8), [0, ly - o.size * 0.3, 0], 6));
    g.add(_sph(0.012, M.ceramic(0xf0c020), [0, ly - o.size * 0.08, 0], 4));
    // cap
    g.add(_cone(o.size * 0.6, o.size * 0.4, met, [0, ly + o.size * 0.85, 0], 4));
    return g;
  }, {
    icon: "🏮", category: "props",
    params: [
      { key: "size", label: "Size", type: "number", min: 0.06, max: 0.2, step: 0.02, default: 0.1 },
      { key: "chainLen", label: "Chain", type: "number", min: 0.1, max: 0.6, step: 0.05, default: 0.25 },
      { key: "metalColor", label: "Metal", type: "color", default: 0x2a2a28 },
      { key: "glassColor", label: "Glass", type: "color", default: 0xf0d870 },
    ],
  });

  register("campfire", function (o) {
    const g = new THREE.Group();
    // stone ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(_sph(0.06, M.stone(0x5a5248),
        [Math.cos(a) * o.radius, 0.04, Math.sin(a) * o.radius], 5));
    }
    // logs
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      const log = _cyl(0.03, 0.025, o.radius * 1.2,
        M.wood(o.logColor), [0, 0.04, 0], 5);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = a;
      g.add(log);
    }
    // embers
    g.add(_cyl(o.radius * 0.5, o.radius * 0.5, 0.02, M.ceramic(0xa03010), [0, 0.04, 0], 10));
    // flames
    g.add(_cone(0.06, o.flameH, M.ceramic(0xe86010), [0, 0.04 + o.flameH / 2, 0], 6));
    g.add(_cone(0.04, o.flameH * 0.8, M.ceramic(0xf0a020), [0.03, 0.06 + o.flameH * 0.4, 0.02], 5));
    g.add(_cone(0.03, o.flameH * 0.6, M.ceramic(0xf0e040), [-0.02, 0.05 + o.flameH * 0.3, -0.01], 5));
    return g;
  }, {
    icon: "🔥", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.6, step: 0.05, default: 0.3 },
      { key: "flameH", label: "Flame H", type: "number", min: 0.1, max: 0.5, step: 0.05, default: 0.25 },
      { key: "logColor", label: "Logs", type: "color", default: 0x3a2010 },
    ],
  });

  register("chandelier", function (o) {
    const g = new THREE.Group();
    const met = M.metal(o.color);
    // central chain
    g.add(_cyl(0.008, 0.008, o.chainLen, met, [0, -o.chainLen / 2, 0], 4));
    // hook
    g.add(_tor(0.025, 0.005, met, [0, 0.02, 0], 8, 4));
    // main ring
    const ringY = -o.chainLen;
    g.add(_tor(o.radius, 0.015, met, [0, ringY, 0], 16, 5));
    // support spokes to center
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      g.add(_cyl(0.008, 0.008, o.radius, met,
        [Math.cos(a) * o.radius / 2, ringY, Math.sin(a) * o.radius / 2], 4));
      g.children[g.children.length - 1].rotation.z = Math.PI / 2;
      g.children[g.children.length - 1].rotation.y = a;
    }
    // candle holders
    for (let i = 0; i < o.candles; i++) {
      const a = (i / o.candles) * Math.PI * 2;
      const cx = Math.cos(a) * o.radius;
      const cz = Math.sin(a) * o.radius;
      // cup
      g.add(_cyl(0.015, 0.02, 0.015, met, [cx, ringY + 0.007, cz], 6));
      // candle
      g.add(_cyl(0.008, 0.008, 0.06, M.plaster(0xe8e0c8), [cx, ringY + 0.045, cz], 6));
      // flame
      g.add(_sph(0.008, M.ceramic(0xf0c020), [cx, ringY + 0.08, cz], 4));
    }
    return g;
  }, {
    icon: "🕯️", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.3 },
      { key: "chainLen", label: "Chain", type: "number", min: 0.2, max: 1.0, step: 0.1, default: 0.5 },
      { key: "candles", label: "Candles", type: "int", min: 4, max: 12, default: 6 },
      { key: "color", label: "Color", type: "color", default: 0x2a2a28 },
    ],
  });

  register("candle", function () {
  const g = new THREE.Group();
  g.add(_cyl(0.04, 0.04, 0.18, new THREE.MeshStandardMaterial({ color: 0xf0e8c8, roughness: 0.6 }), [0, 0.09, 0]));
  const flame = new THREE.PointLight(0xffaa55, 1.1, 3, 2);
  flame.position.y = 0.22;
  flame.userData.flicker = { base: 0.9, jitter: 0.3 };
  g.add(flame);
  g.userData.flame = flame;
  return g;
}, { category: "decor" });

  register("lamp", function ({ bulbColor = 0xffc080, cordLength = 2 } = {}) {
  const g = new THREE.Group();
  g.add(_cyl(0.005, 0.005, cordLength, M.metal(0x1a1410), [0, cordLength / 2, 0], 6));
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 12), M.metal(0x6a4a20));
  shade.position.y = -0.2; shade.rotation.x = Math.PI;
  g.add(shade);
  const bulb = new THREE.PointLight(bulbColor, 1.6, 6, 1.2);
  bulb.position.y = -0.5;
  g.add(bulb);
  return g;
}, { category: "lighting" });

})();
