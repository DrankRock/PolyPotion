// category: "props"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("wine_bottle", function (o) {
    const g = new THREE.Group();
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const y = t * o.height;
      let r;
      if (t < 0.05) r = 0.035;
      else if (t < 0.55) r = 0.035 + (t - 0.05) / 0.5 * 0.005;
      else if (t < 0.65) r = 0.04 - (t - 0.55) / 0.1 * 0.02;
      else r = 0.02 - (t - 0.65) / 0.35 * 0.005;
      pts.push(new THREE.Vector2(Math.max(0.005, r * o.height / 0.32), y));
    }
    const geo = new THREE.LatheGeometry(pts, 16);
    g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: o.color, roughness: 0.3, metalness: 0.05, transparent: true, opacity: 0.85,
    })));
    return g;
  }, {
    icon: "🍷", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 0.20, max: 0.45, step: 0.02, default: 0.32 },
      { key: "color",  label: "Glass",  type: "color",  default: 0x1a3a18 },
    ],
  });

  register("cauldron", function (o) {
    const g = new THREE.Group();
    const m = M.metal(o.color);
    // bowl
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = t * o.height;
      const r = o.radius * (0.6 + Math.sin(t * Math.PI) * 0.4);
      pts.push(new THREE.Vector2(Math.max(0.01, r), y));
    }
    const geo = new THREE.LatheGeometry(pts, 16);
    g.add(new THREE.Mesh(geo, m));
    // legs (3)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.add(_cyl(0.025, 0.03, 0.12, m,
        [Math.sin(a) * o.radius * 0.5, -0.06, Math.cos(a) * o.radius * 0.5], 6));
    }
    // handles
    for (let side = -1; side <= 1; side += 2) {
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.06, 0.01, 6, 12, Math.PI),
        m
      );
      handle.position.set(side * o.radius, o.height * 0.85, 0);
      handle.rotation.z = side * Math.PI / 2;
      g.add(handle);
    }
    return g;
  }, {
    icon: "🫕", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.12, max: 0.5, step: 0.02, default: 0.25 },
      { key: "height", label: "Height", type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.30 },
      { key: "color",  label: "Color",  type: "color",  default: 0x2a2520 },
    ],
  });

  register("shield", function (o) {
    const g = new THREE.Group();
    const mat = M.metal(o.color);
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const r2 = o.radius * Math.sin(t * Math.PI) * 0.85 + o.radius * 0.15;
      pts.push(new THREE.Vector2(r2, (t - 0.5) * o.radius * 2));
    }
    const geo = new THREE.LatheGeometry(pts, 16);
    const shield = new THREE.Mesh(geo, mat);
    shield.rotation.x = Math.PI / 2;
    g.add(shield);
    // boss (center bump)
    g.add(_cyl(0.06, 0.08, 0.04, M.brass(), [0, 0, 0.05], 12));
    // rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(o.radius * 0.85, 0.015, 8, 24),
      M.brass()
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.z = 0.01;
    g.add(rim);
    return g;
  }, {
    icon: "🛡️", category: "decorative",
    params: [
      { key: "radius", label: "Size",  type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.3 },
      { key: "color",  label: "Metal", type: "color",  default: 0x4a4a4a },
    ],
  });

  register("sword_display", function (o) {
    const g = new THREE.Group();
    const blade = M.metal(0xc0c0c0);
    const grip = M.leather(o.gripColor);
    const guard = M.brass(o.guardColor);
    const l = o.length;
    // blade
    g.add(_box(0.03, l * 0.7, 0.005, blade, [0, l * 0.35 + 0.15, 0]));
    // fuller (groove)
    g.add(_box(0.01, l * 0.5, 0.002, M.metal(0x888888), [0, l * 0.35 + 0.15, 0.004]));
    // guard (cross)
    g.add(_box(0.16, 0.025, 0.025, guard, [0, 0.15, 0]));
    // grip
    g.add(_cyl(0.015, 0.015, 0.12, grip, [0, 0.08, 0], 8));
    // pommel
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), guard)).position.set(0, 0.01, 0);
    // tip
    const tipGeo = new THREE.ConeGeometry(0.015, 0.05, 6);
    const tip = new THREE.Mesh(tipGeo, blade);
    tip.position.set(0, 0.15 + l * 0.7 + 0.025, 0);
    g.add(tip);
    return g;
  }, {
    icon: "⚔️", category: "decorative",
    params: [
      { key: "length",     label: "Length", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 0.9 },
      { key: "gripColor",  label: "Grip",   type: "color",  default: 0x4a3020 },
      { key: "guardColor", label: "Guard",  type: "color",  default: 0xc8a050 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // NATURE — WAVE 2
  // ════════════════════════════════════════════════════════

  register("anvil", function (o) {
    const g = new THREE.Group();
    const mat = M.metal(o.color);
    // base
    g.add(_box(0.35, 0.12, 0.22, mat, [0, 0.06, 0]));
    // waist
    g.add(_box(0.22, 0.12, 0.16, mat, [0, 0.18, 0]));
    // face
    g.add(_box(0.4, 0.08, 0.2, mat, [0, 0.28, 0]));
    // horn (tapered box)
    const horn = _box(0.2, 0.06, 0.1, mat, [0.3, 0.27, 0]);
    horn.scale.set(1, 1, 0.5);
    g.add(horn);
    return g;
  }, {
    icon: "⚒️", category: "props",
    params: [
      { key: "color", label: "Metal", type: "color", default: 0x3a3a3a },
    ],
  });

  register("weapon_rack", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const w = o.width;
    // back board
    g.add(_box(w, 1.2, 0.04, mat, [0, 0.8, 0]));
    // pegs
    const pegMat = M.wood(o.color);
    for (let row = 0; row < 3; row++) {
      for (let col = -1; col <= 1; col += 2) {
        g.add(_cyl(0.015, 0.015, 0.1, pegMat,
          [col * (w/2 - 0.15), 0.4 + row * 0.35, 0.06], 6));
        g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      }
    }
    // decorative weapons on pegs (simple shapes)
    // sword
    g.add(_box(0.025, 0.8, 0.005, M.metal(0xb0b0b0), [0, 0.7, 0.08]));
    // axe head shape
    g.add(_box(0.15, 0.12, 0.01, M.metal(0x8a8a8a), [w/4, 1.05, 0.08]));
    g.add(_box(0.02, 0.6, 0.02, mat, [w/4, 0.7, 0.08]));
    return g;
  }, {
    icon: "⚔️", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.6, max: 2.0, step: 0.1, default: 1.0 },
      { key: "color", label: "Wood",  type: "color",  default: 0x5a3a20 },
    ],
  });

  register("treasure_pile", function (o) {
    const g = new THREE.Group();
    const gold = M.brass(o.color);
    const r = o.spread;
    // mound of coins (lots of tiny cylinders)
    for (let i = 0; i < o.density; i++) {
      const px = rand(-r, r) * 0.5;
      const pz = rand(-r, r) * 0.5;
      const dist = Math.sqrt(px*px + pz*pz);
      const py = Math.max(0.01, (1 - dist / r) * r * 0.5);
      const coin = _cyl(rand(0.015, 0.03), rand(0.015, 0.03), 0.005, gold, [px, py, pz], 8);
      coin.rotation.x = rand(-0.5, 0.5);
      coin.rotation.z = rand(-0.5, 0.5);
      g.add(coin);
    }
    // a few goblets
    for (let i = 0; i < 2; i++) {
      const gx = rand(-r * 0.3, r * 0.3);
      const gz = rand(-r * 0.3, r * 0.3);
      g.add(_cyl(0.025, 0.015, 0.06, gold, [gx, r * 0.3, gz], 8));
    }
    // gem (colored sphere)
    const gem = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 6),
      new THREE.MeshStandardMaterial({ color: o.gemColor, roughness: 0.1, metalness: 0.3 })
    );
    gem.position.set(rand(-0.05, 0.05), r * 0.35, rand(-0.05, 0.05));
    g.add(gem);
    return g;
  }, {
    icon: "💰", category: "props",
    params: [
      { key: "spread",   label: "Spread",  type: "number", min: 0.2, max: 1.0, step: 0.1, default: 0.4 },
      { key: "density",  label: "Coins",   type: "int",    min: 20,  max: 120, default: 60 },
      { key: "color",    label: "Gold",    type: "color",  default: 0xd4a030 },
      { key: "gemColor", label: "Gem",     type: "color",  default: 0xcc2244 },
    ],
  });

  register("cauldron_large", function (o) {
    const g = new THREE.Group();
    const mat = M.metal(o.color);
    const r = o.radius;
    // body (lathe)
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const rr = r * (0.3 + 0.7 * Math.sin(t * Math.PI * 0.85));
      pts.push(new THREE.Vector2(rr, t * r * 1.5));
    }
    const geo = new THREE.LatheGeometry(pts, 16);
    const body = new THREE.Mesh(geo, mat);
    g.add(body);
    // rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.025, 8, 20),
      mat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = r * 1.5;
    g.add(rim);
    // legs (3)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.add(_cyl(0.03, 0.04, 0.15, mat, [Math.sin(a) * r * 0.7, -0.075, Math.cos(a) * r * 0.7], 6));
    }
    // handle arch
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(r * 0.8, 0.015, 6, 12, Math.PI),
      mat
    );
    handle.position.y = r * 1.5 + r * 0.4;
    g.add(handle);
    // liquid surface
    if (o.hasLiquid) {
      const liquid = new THREE.Mesh(
        new THREE.CircleGeometry(r * 0.9, 16),
        new THREE.MeshStandardMaterial({ color: o.liquidColor, roughness: 0.2, metalness: 0.1 })
      );
      liquid.rotation.x = -Math.PI / 2;
      liquid.position.y = r * 1.3;
      g.add(liquid);
    }
    return g;
  }, {
    icon: "🫕", category: "props",
    params: [
      { key: "radius",      label: "Radius",  type: "number", min: 0.2, max: 0.8, step: 0.05, default: 0.4 },
      { key: "hasLiquid",   label: "Liquid",   type: "bool",   default: true },
      { key: "liquidColor", label: "Liquid col", type: "color", default: 0x44aa44 },
      { key: "color",       label: "Metal",    type: "color",  default: 0x2a2a2a },
    ],
  });

  register("spinning_wheel", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    // base
    g.add(_box(0.5, 0.04, 0.25, mat, [0, 0.02, 0]));
    // uprights
    g.add(_box(0.04, 0.6, 0.04, mat, [-0.05, 0.32, 0]));
    g.add(_box(0.04, 0.6, 0.04, mat, [ 0.05, 0.32, 0]));
    // wheel
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.015, 8, 24),
      mat
    );
    wheel.position.set(0, 0.55, 0);
    g.add(wheel);
    // spokes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = _box(0.45, 0.012, 0.012, mat, [0, 0.55, 0]);
      spoke.rotation.z = a;
      g.add(spoke);
    }
    // axle
    g.add(_cyl(0.015, 0.015, 0.08, mat, [0, 0.55, 0], 6));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // flyer / bobbin (decorative)
    g.add(_cyl(0.02, 0.02, 0.1, mat, [0.2, 0.4, -0.08], 6));
    // treadle
    g.add(_box(0.15, 0.02, 0.08, mat, [0, 0.06, 0.12]));
    return g;
  }, {
    icon: "🧶", category: "props",
    params: [
      { key: "color", label: "Wood", type: "color", default: 0x6b4a2b },
    ],
  });

  // ════════════════════════════════════════════════════════
  // KITCHEN & DINING
  // ════════════════════════════════════════════════════════

  register("plate_set", function (o) {
    const g = new THREE.Group();
    const mat = M.ceramic(o.color);
    const count = o.count;
    for (let i = 0; i < count; i++) {
      const plate = _cyl(o.radius, o.radius, 0.012, mat, [0, i * 0.014, 0], 16);
      g.add(plate);
    }
    return g;
  }, {
    icon: "🍽️", category: "props",
    params: [
      { key: "count",  label: "Plates", type: "int",    min: 1,    max: 8,   default: 4 },
      { key: "radius", label: "Size",   type: "number", min: 0.08, max: 0.2, step: 0.02, default: 0.12 },
      { key: "color",  label: "Color",  type: "color",  default: 0xf0e8d8 },
    ],
  });

  register("goblet", function (o) {
    const g = new THREE.Group();
    const mat = M.brass(o.color);
    // base
    g.add(_cyl(0.035, 0.04, 0.008, mat, [0, 0.004, 0], 12));
    // stem
    g.add(_cyl(0.008, 0.008, 0.06, mat, [0, 0.038, 0], 8));
    // cup (lathe)
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const r2 = 0.01 + 0.035 * Math.pow(t, 0.6);
      pts.push(new THREE.Vector2(r2, t * 0.06));
    }
    const cupGeo = new THREE.LatheGeometry(pts, 12);
    const cup = new THREE.Mesh(cupGeo, mat);
    cup.position.y = 0.068;
    g.add(cup);
    return g;
  }, {
    icon: "🍷", category: "props",
    params: [
      { key: "color", label: "Metal", type: "color", default: 0xc8a050 },
    ],
  });

  register("tankard", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const r = 0.04, h = 0.1;
    // body
    g.add(_cyl(r, r * 0.95, h, mat, [0, h/2, 0], 10));
    // handle
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.025, 0.006, 6, 8, Math.PI),
      mat
    );
    handle.rotation.y = Math.PI / 2;
    handle.position.set(r + 0.02, h * 0.55, 0);
    g.add(handle);
    // metal rim
    g.add(_cyl(r + 0.003, r + 0.003, 0.006, M.metal(0x888888), [0, h, 0], 10));
    return g;
  }, {
    icon: "🍺", category: "props",
    params: [
      { key: "color", label: "Wood", type: "color", default: 0x6b4a2b },
    ],
  });

  // ═══════════════════════════════════════════════════════
  // FURNITURE
  // ═══════════════════════════════════════════════════════

  register("monitor", (opts = {}) => {
    const g = new THREE.Group();
    const black = new THREE.MeshStandardMaterial({ color: _c(opts.frameColor, 0x1a1814), roughness: 0.6 });
    const screen = new THREE.MeshStandardMaterial({
      color: _c(opts.screenColor, 0x202a3a), roughness: 0.25,
      emissive: _c(opts.screenColor, 0x0a1424),
      emissiveIntensity: opts.brightness !== undefined ? opts.brightness : 0.6 });
    const W = opts.width || 0.6, H = opts.height || 0.36;
    g.add(_box(W, H, 0.03, black, [0, 0.55, 0]));
    g.add(_box(W-0.04, H-0.04, 0.005, screen, [0, 0.55, 0.018]));
    g.add(_cyl(0.04, 0.06, 0.16, black, [0, 0.30, 0], 12));
    g.add(_cyl(0.14, 0.18, 0.02, black, [0, 0.22, 0], 18));
    return g;
  }, { icon: "🖥", category: "tech", params: [
    { key: "width",       label: "Width",       type: "number", min: 0.3,  max: 1.4, step: 0.05, default: 0.6 },
    { key: "height",      label: "Height",      type: "number", min: 0.2,  max: 0.9, step: 0.02, default: 0.36 },
    { key: "brightness",  label: "Screen glow", type: "number", min: 0,    max: 2,   step: 0.05, default: 0.6 },
    { key: "screenColor", label: "Screen",      type: "color",  default: 0x202a3a },
    { key: "frameColor",  label: "Frame",       type: "color",  default: 0x1a1814 },
  ]});

  register("laptop", (opts = {}) => {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: _c(opts.bodyColor, 0x2a2a2c), roughness: 0.4, metalness: 0.6 });
    const screen = new THREE.MeshStandardMaterial({
      color: _c(opts.screenColor, 0x202a3a), roughness: 0.2,
      emissive: _c(opts.screenColor, 0x0a1424),
      emissiveIntensity: opts.brightness !== undefined ? opts.brightness : 0.5 });
    g.add(_box(0.36, 0.02, 0.26, body, [0, 0.01, 0]));
    const lid = new THREE.Group();
    lid.add(_box(0.36, 0.24, 0.02, body, [0, 0.12, 0]));
    lid.add(_box(0.33, 0.21, 0.005, screen, [0, 0.12, 0.012]));
    lid.position.z = -0.13;
    lid.rotation.x = (opts.openAngle !== undefined ? opts.openAngle : -0.25);
    g.add(lid);
    return g;
  }, { icon: "💻", category: "tech", params: [
    { key: "openAngle",   label: "Lid angle (rad)", type: "number", min: -1.5, max: 0, step: 0.05, default: -0.25 },
    { key: "brightness",  label: "Screen glow",     type: "number", min: 0,    max: 2, step: 0.05, default: 0.5 },
    { key: "screenColor", label: "Screen",          type: "color",  default: 0x202a3a },
    { key: "bodyColor",   label: "Body",            type: "color",  default: 0x2a2a2c },
  ]});

  register("keyboard", (opts = {}) => {
    return _box(opts.width || 0.40, 0.02, opts.depth || 0.14,
      new THREE.MeshStandardMaterial({ color: _c(opts.color, 0x1a1a1c), roughness: 0.6 }), [0, 0.01, 0]);
  }, { icon: "⌨", category: "tech", params: [
    { key: "width", label: "Width", type: "number", min: 0.25, max: 0.6, step: 0.02, default: 0.40 },
    { key: "depth", label: "Depth", type: "number", min: 0.10, max: 0.20, step: 0.01, default: 0.14 },
    { key: "color", label: "Body",  type: "color",  default: 0x1a1a1c },
  ]});

  register("speaker", (opts = {}) => {
    const g = new THREE.Group();
    const body = M.wood(_c(opts.color, 0x1a1a1c));
    const cone = new THREE.MeshStandardMaterial({ color: _c(opts.coneColor, 0x2c2c2e), roughness: 0.7 });
    g.add(_box(0.20, 0.32, 0.18, body, [0, 0.16, 0]));
    g.add(_cyl(0.06, 0.07, 0.01, cone, [0, 0.22, 0.10], 18));
    g.add(_cyl(0.03, 0.035, 0.01, cone, [0, 0.10, 0.10], 14));
    return g;
  }, { icon: "🔊", category: "tech", params: [
    { key: "color",     label: "Cabinet", type: "color", default: 0x1a1a1c },
    { key: "coneColor", label: "Cones",   type: "color", default: 0x2c2c2e },
  ]});

  register("guitar", (opts = {}) => {
    const g = new THREE.Group();
    const wood = M.wood(_c(opts.bodyColor, 0x6a3a18));
    const dark = M.wood(_c(opts.neckColor, 0x1a1410));
    g.add(_cyl(0.18, 0.22, 0.08, wood, [0, 0.6, 0], 24));
    g.add(_cyl(0.04, 0.04, 0.7, dark, [0, 1.05, 0], 12));
    g.add(_box(0.06, 0.12, 0.025, dark, [0, 1.42, 0]));
    return g;
  }, { icon: "🎸", category: "tech", params: [
    { key: "bodyColor", label: "Body",  type: "color", default: 0x6a3a18 },
    { key: "neckColor", label: "Neck",  type: "color", default: 0x1a1410 },
  ]});

  register("micStand", () => {
    const g = new THREE.Group();
    const m = M.metal(0x1a1410);
    g.add(_cyl(0.18, 0.20, 0.03, m, [0, 0.015, 0], 16));
    g.add(_cyl(0.012, 0.012, 1.25, m, [0, 0.64, 0]));
    g.add(_sph(0.05, M.metal(0x6a6a6a), [0, 1.30, 0], 12));
    return g;
  }, { icon: "🎤", category: "tech" });

  // ═══════════════════════════════════════════════════════
  // KITCHEN
  // ═══════════════════════════════════════════════════════

  register("mug", (opts = {}) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: _c(opts.color, 0xe6e0d4), roughness: 0.4 });
    g.add(_cyl(0.045, 0.045, 0.10, mat, [0, 0.05, 0], 18));
    g.add(_tor(0.035, 0.008, M.cloth(_c(opts.color, 0xe6e0d4)), [0.055, 0.05, 0], 6, 14));
    return g;
  }, { icon: "☕", category: "kitchen", params: [
    { key: "color", label: "Glaze", type: "color", default: 0xe6e0d4 },
  ]});

  register("plate", (opts = {}) => {
    return _cyl(0.13, 0.14, 0.012,
      new THREE.MeshStandardMaterial({ color: _c(opts.color, 0xf2ece0), roughness: 0.4 }),
      [0, 0.006, 0], 24);
  }, { icon: "🍽", category: "kitchen", params: [
    { key: "color", label: "Color", type: "color", default: 0xf2ece0 },
  ]});

  register("bottle", (opts = {}) => {
    const g = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({ color: _c(opts.color, 0x3a5a3a), roughness: 0.2, transparent: true, opacity: 0.7 });
    g.add(_cyl(0.04, 0.04, 0.22, glass, [0, 0.11, 0], 18));
    g.add(_cyl(0.018, 0.025, 0.08, glass, [0, 0.26, 0], 14));
    return g;
  }, { icon: "🍾", category: "kitchen", params: [
    { key: "color", label: "Glass tint", type: "color", default: 0x3a5a3a },
  ]});

  register("bowlFruit", () => {
    const g = new THREE.Group();
    const bowl = new THREE.MeshStandardMaterial({ color: 0x6a4a32, roughness: 0.6 });
    g.add(_cyl(0.16, 0.10, 0.06, bowl, [0, 0.03, 0], 20));
    g.add(_sph(0.04, new THREE.MeshStandardMaterial({ color: 0xd44a3a, roughness: 0.5 }), [0.04, 0.10, 0]));
    g.add(_sph(0.045, new THREE.MeshStandardMaterial({ color: 0xe2a836, roughness: 0.5 }), [-0.04, 0.10, 0.03]));
    g.add(_sph(0.05, new THREE.MeshStandardMaterial({ color: 0x6a3a2a, roughness: 0.5 }), [0, 0.10, -0.04]));
    return g;
  }, { icon: "🍎", category: "kitchen" });

  // ═══════════════════════════════════════════════════════
  // ARCHITECTURE
  // ═══════════════════════════════════════════════════════

  register("butter_churn", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // barrel body
    g.add(_cyl(o.radius, o.radius * 0.9, o.height, w, [0, o.height / 2, 0], 16));
    // metal bands
    const band = M.metal(0x3a3a3a);
    g.add(_cyl(o.radius + 0.005, o.radius + 0.005, 0.02, band, [0, o.height * 0.2, 0], 16));
    g.add(_cyl(o.radius + 0.005, o.radius * 0.9 + 0.005, 0.02, band, [0, o.height * 0.8, 0], 16));
    // lid
    g.add(_cyl(o.radius * 0.95, o.radius * 0.95, 0.03, w, [0, o.height + 0.015, 0], 16));
    // dasher handle
    g.add(_cyl(0.015, 0.015, o.height * 0.6, w, [0, o.height + 0.015 + o.height * 0.3, 0], 8));
    // handle knob
    g.add(_sph(0.025, w, [0, o.height + 0.015 + o.height * 0.6, 0], 8));
    return g;
  }, {
    icon: "🧈", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.1, max: 0.3, step: 0.02, default: 0.15 },
      { key: "height", label: "Height", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "color",  label: "Color",  type: "color",  default: 0x6b4a2b },
    ],
  });

  register("bellows", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const leath = M.leather(o.leatherColor);
    // two wooden paddles
    g.add(_box(o.width, 0.02, o.depth, w, [0, o.height, 0]));
    g.add(_box(o.width, 0.02, o.depth, w, [0, 0.02, 0]));
    // leather pleats between
    for (let i = 1; i <= 3; i++) {
      const y = 0.02 + (o.height - 0.02) * (i / 4);
      const scale = 1.0 - Math.abs(i - 2) * 0.08;
      g.add(_box(o.width * scale, 0.015, o.depth * scale, leath, [0, y, 0]));
    }
    // nozzle
    g.add(_cyl(0.025, 0.015, 0.12, w, [o.width / 2 + 0.06, o.height / 2, 0], 8));
    g.children[g.children.length - 1].rotation.z = -Math.PI / 2;
    // handles
    g.add(_cyl(0.015, 0.015, 0.18, w, [-o.width / 2 + 0.05, o.height + 0.09, 0], 6));
    g.add(_cyl(0.015, 0.015, 0.18, w, [-o.width / 2 + 0.05, -0.07, 0], 6));
    return g;
  }, {
    icon: "🔥", category: "props",
    params: [
      { key: "width",        label: "Width",   type: "number", min: 0.15, max: 0.4, step: 0.02, default: 0.25 },
      { key: "depth",        label: "Depth",   type: "number", min: 0.1,  max: 0.3, step: 0.02, default: 0.18 },
      { key: "height",       label: "Height",  type: "number", min: 0.06, max: 0.2, step: 0.02, default: 0.1 },
      { key: "color",        label: "Wood",    type: "color",  default: 0x5a3a1a },
      { key: "leatherColor", label: "Leather", type: "color",  default: 0x4a3020 },
    ],
  });

  register("loom", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // frame – four corner posts
    const hw = o.width / 2, hd = o.depth / 2;
    [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].forEach(([x, z]) => {
      g.add(_cyl(0.03, 0.035, o.height, w, [x, o.height / 2, z], 6));
    });
    // top beam
    g.add(_box(o.width, 0.05, 0.05, w, [0, o.height, 0]));
    // bottom beam
    g.add(_box(o.width, 0.05, 0.05, w, [0, o.height * 0.3, 0]));
    // warp threads (thin vertical lines)
    const threadMat = M.cloth(o.threadColor);
    const threadCount = Math.floor(o.width / 0.04);
    for (let i = 0; i < threadCount; i++) {
      const x = -hw + 0.02 + i * (o.width - 0.04) / (threadCount - 1);
      g.add(_cyl(0.003, 0.003, o.height * 0.65, threadMat, [x, o.height * 0.65, 0], 4));
    }
    // heddle bar
    g.add(_cyl(0.02, 0.02, o.width + 0.05, w, [0, o.height * 0.6, hd * 0.3], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // cross brace
    g.add(_box(0.03, 0.03, o.depth, w, [-hw + 0.04, o.height * 0.15, 0]));
    g.add(_box(0.03, 0.03, o.depth, w, [hw - 0.04, o.height * 0.15, 0]));
    return g;
  }, {
    icon: "🧵", category: "props",
    params: [
      { key: "width",       label: "Width",  type: "number", min: 0.5, max: 1.5, step: 0.1,  default: 0.9 },
      { key: "depth",       label: "Depth",  type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "height",      label: "Height", type: "number", min: 0.8, max: 2.0, step: 0.1,  default: 1.4 },
      { key: "color",       label: "Wood",   type: "color",  default: 0x6b4a2b },
      { key: "threadColor", label: "Thread", type: "color",  default: 0xc8b070 },
    ],
  });

  register("water_wheel", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // center hub
    g.add(_cyl(0.08, 0.08, o.thickness, w, [0, 0, 0], 12));
    // spokes
    const spokeCount = o.spokes;
    for (let i = 0; i < spokeCount; i++) {
      const a = (i / spokeCount) * Math.PI * 2;
      const spoke = _box(0.04, o.radius - 0.08, 0.04, w, [0, 0, 0]);
      spoke.position.x = Math.cos(a) * (o.radius / 2);
      spoke.position.y = Math.sin(a) * (o.radius / 2);
      spoke.rotation.z = a - Math.PI / 2;
      g.add(spoke);
    }
    // outer rim segments (approximated as torus)
    const rim = _tor(o.radius, 0.035, w, [0, 0, 0], 6, 32);
    g.add(rim);
    // paddles on the outer rim
    const paddleCount = spokeCount * 2;
    for (let i = 0; i < paddleCount; i++) {
      const a = (i / paddleCount) * Math.PI * 2;
      const paddle = _box(0.15, 0.06, o.thickness * 0.8, w, [0, 0, 0]);
      paddle.position.x = Math.cos(a) * (o.radius + 0.06);
      paddle.position.y = Math.sin(a) * (o.radius + 0.06);
      paddle.rotation.z = a;
      g.add(paddle);
    }
    // the whole wheel is in the XY plane; rotate to stand upright along Z
    g.rotation.x = 0;
    return g;
  }, {
    icon: "⚙️", category: "structure",
    params: [
      { key: "radius",    label: "Radius",    type: "number", min: 0.5, max: 2.5, step: 0.1,  default: 1.2 },
      { key: "thickness", label: "Thickness", type: "number", min: 0.1, max: 0.5, step: 0.05, default: 0.2 },
      { key: "spokes",    label: "Spokes",    type: "int",    min: 4,   max: 12,  default: 8 },
      { key: "color",     label: "Color",     type: "color",  default: 0x5a3a1a },
    ],
  });

  register("windmill", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.bodyColor);
    const w = M.wood(o.bladeColor);
    // tower (tapered cylinder)
    g.add(_cyl(o.radius * 0.6, o.radius, o.height, st, [0, o.height / 2, 0], 16));
    // cap (cone)
    g.add(_cone(o.radius * 0.7, o.radius * 0.8, M.wood(0x3a2a18),
      [0, o.height + o.radius * 0.4, 0], 12));
    // axle hub
    g.add(_cyl(0.08, 0.08, 0.15, M.metal(0x3a3a3a), [0, o.height * 0.85, o.radius * 0.6 + 0.07], 8));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // blades (4)
    const bladeLen = o.height * 0.45;
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Group();
      // spine
      blade.add(_box(0.04, bladeLen, 0.03, w, [0, bladeLen / 2, 0]));
      // sail
      blade.add(_box(0.25, bladeLen * 0.8, 0.01, M.cloth(0xd8d0c0), [0.12, bladeLen / 2, 0]));
      blade.position.set(0, o.height * 0.85, o.radius * 0.6 + 0.15);
      blade.rotation.z = (i / 4) * Math.PI * 2;
      g.add(blade);
    }
    // door
    g.add(_box(0.35, 0.65, 0.08, M.wood(0x3a2018), [0, 0.325, o.radius + 0.02]));
    return g;
  }, {
    icon: "🏗️", category: "structure",
    params: [
      { key: "radius",     label: "Radius",  type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.5 },
      { key: "height",     label: "Height",  type: "number", min: 4.0, max: 10.0, step: 0.5, default: 6.0 },
      { key: "bodyColor",  label: "Body",    type: "color",  default: 0xc8b89a },
      { key: "bladeColor", label: "Blades",  type: "color",  default: 0x5a4a30 },
    ],
  });

  register("anvil", function (o) {
    const g = new THREE.Group();
    const met = M.metal(o.color);
    // base
    g.add(_box(o.width * 0.7, o.height * 0.2, o.depth, met, [0, o.height * 0.1, 0]));
    // waist
    g.add(_box(o.width * 0.4, o.height * 0.3, o.depth * 0.7, met, [0, o.height * 0.35, 0]));
    // face (top)
    g.add(_box(o.width, o.height * 0.15, o.depth, met, [0, o.height * 0.575, 0]));
    // horn
    g.add(_cone(o.depth * 0.3, o.width * 0.5, met, [o.width * 0.65, o.height * 0.55, 0], 8));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // heel
    g.add(_box(o.width * 0.15, o.height * 0.15, o.depth * 0.6, met,
      [-o.width * 0.5, o.height * 0.575, 0]));
    return g;
  }, {
    icon: "🔨", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
      { key: "height", label: "Height", type: "number", min: 0.15, max: 0.4, step: 0.03, default: 0.25 },
      { key: "depth", label: "Depth", type: "number", min: 0.1, max: 0.25, step: 0.02, default: 0.15 },
      { key: "color", label: "Color", type: "color", default: 0x2a2a2a },
    ],
  });

  register("weapon_rack", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(0x5a5a5a);
    // frame
    g.add(_box(0.06, o.height, 0.06, w, [-o.width / 2, o.height / 2, 0]));
    g.add(_box(0.06, o.height, 0.06, w, [o.width / 2, o.height / 2, 0]));
    // horizontal bars
    g.add(_box(o.width, 0.04, 0.04, w, [0, o.height * 0.3, 0]));
    g.add(_box(o.width, 0.04, 0.04, w, [0, o.height * 0.7, 0]));
    // weapons leaning
    for (let i = 0; i < o.weapons; i++) {
      const x = -o.width / 2 + 0.1 + i * (o.width - 0.2) / (o.weapons - 1);
      // sword/spear
      g.add(_box(0.02, o.height * 0.9, 0.02, met, [x, o.height * 0.45, 0.04]));
      // handle
      g.add(_cyl(0.015, 0.015, 0.15, w, [x, 0.075, 0.04], 6));
      // guard
      g.add(_box(0.08, 0.015, 0.02, met, [x, 0.15, 0.04]));
    }
    return g;
  }, {
    icon: "⚔️", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.5, max: 2.0, step: 0.2, default: 1.0 },
      { key: "height", label: "Height", type: "number", min: 0.8, max: 2.0, step: 0.2, default: 1.2 },
      { key: "weapons", label: "Weapons", type: "int", min: 2, max: 5, default: 3 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });


  // ════════════════════════════════════════════════════════════════
  // NEW OBJECTS BATCH 2 — CONTINUATION
  // Starts from trebuchet, continues with more props, scenery, etc.
  // ════════════════════════════════════════════════════════════════

  register("wine_press", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // base tub
    g.add(_cyl(o.tubR, o.tubR * 1.05, o.tubH, w, [0, o.tubH / 2, 0], 14));
    // bands
    g.add(_tor(o.tubR + 0.01, 0.012, M.metal(0x3a3a3a), [0, o.tubH * 0.2, 0], 14, 5));
    g.add(_tor(o.tubR + 0.01, 0.012, M.metal(0x3a3a3a), [0, o.tubH * 0.8, 0], 14, 5));
    // screw press frame
    const frameH = o.tubH + 1.0;
    g.add(_box(0.06, frameH, 0.06, w, [-o.tubR * 0.8, frameH / 2, 0]));
    g.add(_box(0.06, frameH, 0.06, w, [o.tubR * 0.8, frameH / 2, 0]));
    g.add(_box(o.tubR * 1.7, 0.06, 0.06, w, [0, frameH, 0]));
    // screw (vertical cylinder)
    g.add(_cyl(0.03, 0.03, frameH * 0.5, M.metal(0x4a4a4a), [0, frameH * 0.75, 0], 8));
    // press plate
    g.add(_cyl(o.tubR * 0.8, o.tubR * 0.8, 0.06, w, [0, o.tubH + 0.1, 0], 12));
    // handle at top
    g.add(_cyl(0.02, 0.02, o.tubR * 1.2, w, [0, frameH - 0.05, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // spout
    g.add(_cyl(0.02, 0.015, 0.15, w, [o.tubR + 0.05, o.tubH * 0.15, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    return g;
  }, {
    icon: "🍷", category: "props",
    params: [
      { key: "tubR", label: "Tub R", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "tubH", label: "Tub H", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("loom", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // frame uprights
    const hw = o.width / 2;
    [[-hw, -0.15], [hw, -0.15], [-hw, 0.15], [hw, 0.15]].forEach(([x, z]) => {
      g.add(_box(0.04, o.height, 0.04, w, [x, o.height / 2, z]));
    });
    // top beam
    g.add(_box(o.width, 0.04, 0.35, w, [0, o.height, 0]));
    // bottom beam
    g.add(_box(o.width, 0.04, 0.35, w, [0, 0.15, 0]));
    // warp threads (vertical lines)
    for (let i = 0; i < 12; i++) {
      const x = -o.width / 2 + 0.06 + i * (o.width - 0.12) / 11;
      g.add(_cyl(0.002, 0.002, o.height - 0.2, M.cloth(0xd8d0c0),
        [x, o.height / 2, 0], 3));
    }
    // heddle frame
    g.add(_box(o.width - 0.06, 0.03, 0.03, w, [0, o.height * 0.6, 0.08]));
    // shuttle
    g.add(_box(0.2, 0.02, 0.03, w, [0, o.height * 0.45, 0]));
    // cloth beam (roller at bottom)
    g.add(_cyl(0.03, 0.03, o.width - 0.06, w, [0, 0.2, -0.12], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // woven cloth on roller
    g.add(_box(o.width - 0.1, 0.15, 0.01, M.cloth(0xb8a878), [0, 0.2, -0.14]));
    // seat
    g.add(_box(o.width * 0.6, 0.03, 0.2, w, [0, o.height * 0.3, 0.35]));
    return g;
  }, {
    icon: "🧵", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 0.9 },
      { key: "height", label: "Height", type: "number", min: 1.0, max: 2.0, step: 0.1, default: 1.4 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("spinning_wheel", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // base board
    g.add(_box(o.size * 1.2, 0.03, o.size * 0.4, w, [0, 0.015, 0]));
    // three legs
    g.add(_cyl(0.015, 0.02, 0.15, w, [-o.size * 0.4, 0.075, -o.size * 0.12], 5));
    g.add(_cyl(0.015, 0.02, 0.15, w, [o.size * 0.4, 0.075, -o.size * 0.12], 5));
    g.add(_cyl(0.015, 0.02, 0.15, w, [0, 0.075, o.size * 0.12], 5));
    // main wheel
    const wheelR = o.size * 0.4;
    g.add(_tor(wheelR, 0.012, w, [0, wheelR + 0.05, 0], 16, 5));
    // spokes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(_cyl(0.005, 0.005, wheelR * 0.9, w,
        [0, wheelR + 0.05, 0], 3));
      g.children[g.children.length - 1].rotation.z = a;
    }
    // spindle post
    g.add(_box(0.03, wheelR + 0.2, 0.03, w, [o.size * 0.45, (wheelR + 0.2) / 2, 0]));
    // flyer/bobbin
    g.add(_cyl(0.02, 0.02, 0.06, w, [o.size * 0.45, wheelR + 0.15, 0], 6));
    // distaff
    g.add(_cyl(0.01, 0.008, o.size * 0.5, w, [o.size * 0.5, wheelR + 0.1 + o.size * 0.25, -0.05], 4));
    // wool on distaff
    g.add(_sph(0.04, M.cloth(0xd8d0c0), [o.size * 0.5, wheelR + 0.35 + o.size * 0.15, -0.05], 6));
    // treadle
    g.add(_box(o.size * 0.2, 0.015, 0.08, w, [0, 0.04, o.size * 0.15]));
    return g;
  }, {
    icon: "🧶", category: "props",
    params: [
      { key: "size", label: "Size", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("butter_churn", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // barrel body
    g.add(_cyl(o.radius, o.radius * 0.9, o.height, w, [0, o.height / 2, 0], 12));
    // bands
    g.add(_tor(o.radius + 0.005, 0.008, M.metal(0x3a3a3a), [0, o.height * 0.2, 0], 12, 4));
    g.add(_tor(o.radius + 0.005, 0.008, M.metal(0x3a3a3a), [0, o.height * 0.8, 0], 12, 4));
    // lid
    g.add(_cyl(o.radius - 0.01, o.radius - 0.01, 0.02, w, [0, o.height + 0.01, 0], 12));
    // plunger handle sticking up
    g.add(_cyl(0.015, 0.012, o.height * 0.6, w, [0, o.height + 0.01 + o.height * 0.3, 0], 6));
    // handle grip
    g.add(_cyl(0.02, 0.02, 0.06, w, [0, o.height + 0.01 + o.height * 0.6, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    return g;
  }, {
    icon: "🧈", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.06, max: 0.2, step: 0.02, default: 0.1 },
      { key: "height", label: "Height", type: "number", min: 0.2, max: 0.5, step: 0.05, default: 0.35 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("water_wheel", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // main wheel
    g.add(_tor(o.wheelR, 0.05, w, [0, o.wheelR + 0.15, 0], 20, 8));
    // spokes
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = _cyl(0.03, 0.03, o.wheelR * 0.9, w, [0, o.wheelR + 0.15, 0], 5);
      spoke.rotation.z = a;
      g.add(spoke);
    }
    // paddles
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const px = Math.cos(a) * o.wheelR;
      const py = o.wheelR + 0.15 + Math.sin(a) * o.wheelR;
      const paddle = _box(0.04, 0.15, o.paddleW, w, [0, 0, 0]);
      paddle.position.set(0, py, 0);
      paddle.position.x = px;
      paddle.rotation.z = a;
      g.add(paddle);
    }
    // axle
    g.add(_cyl(0.04, 0.04, o.paddleW + 0.1, w, [0, o.wheelR + 0.15, 0], 6));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // support frame
    g.add(_box(0.08, o.wheelR * 2 + 0.4, 0.08, w, [0, (o.wheelR * 2 + 0.4) / 2, -o.paddleW / 2 - 0.05]));
    g.add(_box(0.08, o.wheelR * 2 + 0.4, 0.08, w, [0, (o.wheelR * 2 + 0.4) / 2, o.paddleW / 2 + 0.05]));
    return g;
  }, {
    icon: "⚙️", category: "structure",
    params: [
      { key: "wheelR", label: "Wheel R", type: "number", min: 0.5, max: 2.0, step: 0.2, default: 1.0 },
      { key: "paddleW", label: "Paddle W", type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.25 },
      { key: "color", label: "Color", type: "color", default: 0x4a3018 },
    ],
  });

  register("windmill", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.wallColor);
    const w = M.wood(o.woodColor);
    // tower (tapered cylinder)
    g.add(_cyl(o.baseR, o.baseR * 0.65, o.height, st, [0, o.height / 2, 0], 12));
    // cap (conical roof)
    g.add(_cone(o.baseR * 0.7, o.height * 0.2, w, [0, o.height + o.height * 0.1, 0], 12));
    // sails hub
    g.add(_cyl(0.06, 0.06, 0.1, w, [0, o.height * 0.85, o.baseR * 0.65 + 0.05], 8));
    // four sails
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const sailLen = o.height * 0.4;
      const sail = _box(0.03, sailLen, 0.2, M.cloth(0xd8d0c0), [0, 0, 0]);
      sail.position.set(0, o.height * 0.85 + Math.sin(a) * sailLen / 2, o.baseR * 0.65 + 0.08);
      sail.position.x = Math.cos(a) * sailLen / 2;
      sail.rotation.z = a;
      g.add(sail);
      // sail frame
      const frame = _cyl(0.015, 0.015, sailLen, w, [0, 0, 0], 4);
      frame.position.set(0, o.height * 0.85 + Math.sin(a) * sailLen / 2, o.baseR * 0.65 + 0.06);
      frame.position.x = Math.cos(a) * sailLen / 2;
      frame.rotation.z = a;
      g.add(frame);
    }
    // door
    g.add(_box(0.35, 0.7, 0.06, w, [0, 0.35, o.baseR + 0.03]));
    // small windows
    g.add(_box(0.15, 0.2, 0.06, M.glass(), [o.baseR * 0.7, o.height * 0.5, o.baseR * 0.4]));
    return g;
  }, {
    icon: "🌬️", category: "structure",
    params: [
      { key: "baseR", label: "Base R", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.2 },
      { key: "height", label: "Height", type: "number", min: 3.0, max: 8.0, step: 0.5, default: 5.0 },
      { key: "wallColor", label: "Walls", type: "color", default: 0x8a8070 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x4a3018 },
    ],
  });

  register("bellows", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const leather = M.cloth(0x4a3020);
    // bottom board
    g.add(_box(o.width, 0.02, o.depth, w, [0, 0.01, 0]));
    // top board (angled slightly)
    const top = _box(o.width, 0.02, o.depth, w, [0, o.height, 0]);
    top.rotation.x = -0.1;
    g.add(top);
    // leather sides (accordion)
    for (let i = 0; i < 4; i++) {
      const y = 0.02 + i * (o.height - 0.02) / 4;
      const taper = 1 - i * 0.05;
      g.add(_box(o.width * taper, 0.008, o.depth * taper, leather, [0, y, 0]));
    }
    // nozzle
    g.add(_cone(o.depth * 0.15, 0.12, M.metal(0x4a4a4a),
      [0, o.height * 0.3, o.depth / 2 + 0.06], 6));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // handles
    g.add(_box(0.04, 0.1, 0.04, w, [0, o.height + 0.05, -o.depth * 0.3]));
    g.add(_box(0.04, 0.1, 0.04, w, [0, -0.05, -o.depth * 0.3]));
    return g;
  }, {
    icon: "💨", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.15, max: 0.4, step: 0.03, default: 0.25 },
      { key: "depth", label: "Depth", type: "number", min: 0.1, max: 0.3, step: 0.03, default: 0.2 },
      { key: "height", label: "Height", type: "number", min: 0.06, max: 0.15, step: 0.02, default: 0.1 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("cauldron", function (o) {
    const g = new THREE.Group();
    const met = M.metal(o.color);
    // body (fat cylinder slightly wider at middle)
    g.add(_cyl(o.radius * 0.85, o.radius, o.height, met, [0, o.height / 2 + o.legH, 0], 14));
    // rim
    g.add(_tor(o.radius + 0.01, 0.015, met, [0, o.height + o.legH, 0], 14, 5));
    // three legs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.add(_cyl(0.02, 0.025, o.legH, met,
        [Math.cos(a) * o.radius * 0.7, o.legH / 2, Math.sin(a) * o.radius * 0.7], 5));
    }
    // handle (arch over top)
    g.add(_tor(o.radius * 0.8, 0.01, met, [0, o.height + o.legH + 0.02, 0], 10, 4));
    g.children[g.children.length - 1].scale.y = 0.5;
    g.children[g.children.length - 1].rotation.y = Math.PI / 2;
    // liquid inside
    g.add(_cyl(o.radius * 0.8, o.radius * 0.8, 0.03, M.leaf(o.liquidColor),
      [0, o.height + o.legH - 0.05, 0], 12));
    // steam
    g.add(_sph(0.04, M.glass(0xc8c8c8), [0.03, o.height + o.legH + 0.08, 0], 6));
    g.add(_sph(0.03, M.glass(0xd0d0d0), [-0.02, o.height + o.legH + 0.15, 0.02], 5));
    return g;
  }, {
    icon: "🫕", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.1, max: 0.4, step: 0.03, default: 0.2 },
      { key: "height", label: "Height", type: "number", min: 0.12, max: 0.4, step: 0.03, default: 0.2 },
      { key: "legH", label: "Leg H", type: "number", min: 0.05, max: 0.2, step: 0.02, default: 0.1 },
      { key: "color", label: "Color", type: "color", default: 0x1a1a1a },
      { key: "liquidColor", label: "Liquid", type: "color", default: 0x3a6a28 },
    ],
  });

})();