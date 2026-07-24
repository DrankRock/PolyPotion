// category: "utility"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("railing", function (o) {
    const g = new THREE.Group();
    const w = M.metal(o.color);
    // top rail
    g.add(_box(o.length, 0.04, 0.04, w, [0, o.height, 0]));
    // bottom rail
    g.add(_box(o.length, 0.04, 0.04, w, [0, 0.10, 0]));
    // balusters
    const count = Math.max(2, Math.floor(o.length / o.spacing));
    for (let i = 0; i <= count; i++) {
      const x = -o.length / 2 + (o.length / count) * i;
      g.add(_cyl(0.012, 0.012, o.height - 0.10, w, [x, (o.height + 0.10) / 2, 0], 6));
    }
    return g;
  }, {
    icon: "▥", category: "architecture",
    params: [
      { key: "length",  label: "Length",  type: "number", min: 0.5, max: 6.0, step: 0.25, default: 2.0 },
      { key: "height",  label: "Height",  type: "number", min: 0.6, max: 1.4, step: 0.1,  default: 1.0 },
      { key: "spacing", label: "Spacing", type: "number", min: 0.05, max: 0.3, step: 0.02, default: 0.12 },
      { key: "color",   label: "Color",   type: "color",  default: 0x2a2520 },
    ],
  });

  register("fountain", function (o) {
    const g = new THREE.Group();
    const s = M.stone(o.color);
    // base pool
    g.add(_cyl(o.radius, o.radius * 1.1, 0.15, s, [0, 0.075, 0], 24));
    // inner pool (water)
    g.add(_cyl(o.radius - 0.08, o.radius - 0.08, 0.02,
      new THREE.MeshStandardMaterial({ color: 0x3a6a8a, roughness: 0.05, transparent: true, opacity: 0.7 }),
      [0, 0.14, 0], 24));
    // center column
    g.add(_cyl(0.08, 0.10, o.height - 0.15, s, [0, (o.height - 0.15) / 2 + 0.15, 0], 12));
    // top basin
    g.add(_cyl(o.radius * 0.45, o.radius * 0.4, 0.10, s, [0, o.height - 0.05, 0], 16));
    // finial
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), s));
    g.children[g.children.length - 1].position.y = o.height + 0.06;
    return g;
  }, {
    icon: "⛲", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.4, max: 2.0, step: 0.1,  default: 0.8 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 2.0, step: 0.1,  default: 1.2 },
      { key: "color",  label: "Stone",  type: "color",  default: 0x7a7268 },
    ],
  });

  register("well", function (o) {
    const g = new THREE.Group();
    const s = M.stone(o.color);
    const w = M.wood(0x3a2818);
    // stone ring
    g.add(_cyl(o.radius + 0.08, o.radius + 0.12, o.wallHeight, s, [0, o.wallHeight / 2, 0], 24));
    // hollow inside
    g.add(_cyl(o.radius, o.radius, o.wallHeight + 0.02,
      new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1 }),
      [0, o.wallHeight / 2, 0], 24));
    // posts
    g.add(_cyl(0.04, 0.04, o.roofHeight, w, [-o.radius - 0.04, o.wallHeight + o.roofHeight / 2, 0], 6));
    g.add(_cyl(0.04, 0.04, o.roofHeight, w, [ o.radius + 0.04, o.wallHeight + o.roofHeight / 2, 0], 6));
    // roof beam
    g.add(_box(o.radius * 2 + 0.16, 0.06, 0.06, w, [0, o.wallHeight + o.roofHeight, 0]));
    // mini roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(o.radius + 0.15, 0.30, 4), w);
    roof.position.y = o.wallHeight + o.roofHeight + 0.18;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    return g;
  }, {
    icon: "🪣", category: "props",
    params: [
      { key: "radius",     label: "Radius",   type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.5 },
      { key: "wallHeight", label: "Wall H",   type: "number", min: 0.4, max: 1.0, step: 0.1, default: 0.7 },
      { key: "roofHeight", label: "Roof H",   type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.9 },
      { key: "color",      label: "Stone",    type: "color",  default: 0x6a6258 },
    ],
  });

  register("fence", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const count = Math.max(2, Math.round(o.length / o.spacing));
    // posts
    for (let i = 0; i <= count; i++) {
      const x = -o.length / 2 + (o.length / count) * i;
      g.add(_cyl(0.035, 0.04, o.height, w, [x, o.height / 2, 0], 6));
      // pointed top
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 6), w);
      cap.position.set(x, o.height + 0.03, 0);
      g.add(cap);
    }
    // horizontal rails
    g.add(_box(o.length, 0.04, 0.04, w, [0, o.height * 0.75, 0]));
    g.add(_box(o.length, 0.04, 0.04, w, [0, o.height * 0.35, 0]));
    return g;
  }, {
    icon: "🧱", category: "props",
    params: [
      { key: "length",  label: "Length",  type: "number", min: 1.0, max: 8.0, step: 0.5,  default: 3.0 },
      { key: "height",  label: "Height",  type: "number", min: 0.5, max: 1.8, step: 0.1,  default: 1.0 },
      { key: "spacing", label: "Spacing", type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.25 },
      { key: "color",   label: "Color",   type: "color",  default: 0x5a4030 },
    ],
  });

  register("cart", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const w = 0.8, l = 1.4;
    // bed
    g.add(_box(w, 0.04, l, mat, [0, 0.4, 0]));
    // sides
    g.add(_box(0.04, 0.25, l, mat, [-w/2, 0.54, 0]));
    g.add(_box(0.04, 0.25, l, mat, [ w/2, 0.54, 0]));
    g.add(_box(w, 0.25, 0.04, mat, [0, 0.54, -l/2]));
    g.add(_box(w, 0.25, 0.04, mat, [0, 0.54, l/2]));
    // wheels
    const wheelMat = M.wood(0x4a3a28);
    for (let x = -1; x <= 1; x += 2) for (let z = -1; z <= 1; z += 2) {
      const wheel = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.03, 8, 12),
        wheelMat
      );
      wheel.position.set(x * (w/2 + 0.05), 0.2, z * 0.45);
      wheel.rotation.y = Math.PI / 2;
      g.add(wheel);
      // spokes
      for (let s = 0; s < 4; s++) {
        const sa = (s / 4) * Math.PI * 2;
        const spoke = _box(0.01, 0.35, 0.01, wheelMat, [0, 0, 0]);
        spoke.rotation.z = sa;
        spoke.position.set(x * (w/2 + 0.05), 0.2, z * 0.45);
        spoke.rotation.y = Math.PI / 2;
        g.add(spoke);
      }
    }
    // handle (front tongue)
    g.add(_box(0.04, 0.04, 0.6, mat, [0, 0.38, l/2 + 0.3]));
    return g;
  }, {
    icon: "🛒", category: "props",
    params: [
      { key: "color", label: "Wood", type: "color", default: 0x6b4a2b },
    ],
  });

  register("cage", function (o) {
    const g = new THREE.Group();
    const mat = M.metal(o.color);
    const r = o.radius, h = o.height;
    // bars
    const bars = o.bars;
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * Math.PI * 2;
      const bx = Math.sin(a) * r;
      const bz = Math.cos(a) * r;
      g.add(_cyl(0.01, 0.01, h, mat, [bx, h/2, bz], 6));
    }
    // top ring
    const topRing = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.015, 6, bars),
      mat
    );
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = h;
    g.add(topRing);
    // bottom ring
    const botRing = topRing.clone();
    botRing.position.y = 0;
    g.add(botRing);
    // mid ring
    const midRing = topRing.clone();
    midRing.position.y = h / 2;
    g.add(midRing);
    // hanging chain
    g.add(_cyl(0.008, 0.008, 0.3, mat, [0, h + 0.15, 0], 6));
    // hook
    const hook = new THREE.Mesh(
      new THREE.TorusGeometry(0.03, 0.008, 6, 8, Math.PI),
      mat
    );
    hook.position.set(0, h + 0.33, 0);
    g.add(hook);
    return g;
  }, {
    icon: "🗝️", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.3 },
      { key: "height", label: "Height", type: "number", min: 0.3, max: 1.0, step: 0.1,  default: 0.6 },
      { key: "bars",   label: "Bars",   type: "int",    min: 8,   max: 20,  default: 12 },
      { key: "color",  label: "Metal",  type: "color",  default: 0x3a3a3a },
    ],
  });

  register("rope_coil", function (o) {
    const g = new THREE.Group();
    const mat = M.rope(o.color);
    const coils = o.coils;
    for (let i = 0; i < coils; i++) {
      const r2 = o.radius - i * 0.015;
      const y = i * 0.022;
      const coil = new THREE.Mesh(
        new THREE.TorusGeometry(r2, 0.012, 6, 20),
        mat
      );
      coil.rotation.x = Math.PI / 2;
      coil.position.y = y;
      g.add(coil);
    }
    // loose end
    g.add(_cyl(0.012, 0.012, 0.3, mat, [o.radius, coils * 0.011, 0.15], 6));
    g.children[g.children.length - 1].rotation.x = Math.PI / 4;
    return g;
  }, {
    icon: "🪢", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.1,  max: 0.4, step: 0.05, default: 0.2 },
      { key: "coils",  label: "Coils",  type: "int",    min: 3,    max: 15,  default: 8 },
      { key: "color",  label: "Color",  type: "color",  default: 0x8a7a60 },
    ],
  });

  register("crate", (opts = {}) => {
    const s = opts.size || 0.6;
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x6a4a2a));
    const wd = M.wood(_c(opts.bandColor, 0x4a3018));
    g.add(_box(s, s, s, w, [0, s/2, 0]));
    g.add(_box(s+0.01, 0.04, 0.04, wd, [0, s*0.85, s/2]));
    g.add(_box(s+0.01, 0.04, 0.04, wd, [0, s*0.15, s/2]));
    g.add(_box(0.04, s+0.01, 0.04, wd, [s/2, s/2, s/2]));
    return g;
  }, { icon: "📦", category: "storage", params: [
    { key: "size",      label: "Size",   type: "number", min: 0.25, max: 1.5, step: 0.05, default: 0.6 },
    { key: "color",     label: "Wood",   type: "color",  default: 0x6a4a2a },
    { key: "bandColor", label: "Bands",  type: "color",  default: 0x4a3018 },
  ]});

  register("barrel", (opts = {}) => {
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x6a3a18));
    const m = M.metal(_c(opts.bandColor, 0x2a2018));
    const H = opts.height || 0.8;
    g.add(_cyl(0.30, 0.32, H, w, [0, H/2, 0], 18));
    const upper = _tor(0.32, 0.018, m, [0, H*0.81, 0], 6, 24); upper.rotation.x = Math.PI/2; g.add(upper);
    const lower = _tor(0.32, 0.018, m, [0, H*0.19, 0], 6, 24); lower.rotation.x = Math.PI/2; g.add(lower);
    return g;
  }, { icon: "🛢", category: "storage", params: [
    { key: "height",    label: "Height", type: "number", min: 0.4, max: 1.4, step: 0.05, default: 0.8 },
    { key: "color",     label: "Wood",   type: "color",  default: 0x6a3a18 },
    { key: "bandColor", label: "Bands",  type: "color",  default: 0x2a2018 },
  ]});

  register("ladder", (opts = {}) => {
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x6a4a2a));
    const H = opts.height || 2.8, rungs = Math.max(2, opts.rungs || 7);
    g.add(_box(0.05, H, 0.04, w, [-0.22, H/2, 0]));
    g.add(_box(0.05, H, 0.04, w, [ 0.22, H/2, 0]));
    const step = (H - 0.4) / (rungs - 1);
    for (let i = 0; i < rungs; i++) {
      g.add(_box(0.50, 0.04, 0.04, w, [0, 0.2 + i*step, 0]));
    }
    return g;
  }, { icon: "🪜", category: "storage", params: [
    { key: "height", label: "Height", type: "number", min: 1.2, max: 4.0, step: 0.1, default: 2.8 },
    { key: "rungs",  label: "Rungs",  type: "int",    min: 3,   max: 14,  default: 7 },
    { key: "color",  label: "Wood",   type: "color",  default: 0x6a4a2a },
  ]});

  register("well_bucket", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const band = M.metal(0x4a4a4a);
    // bucket body (tapered cylinder)
    g.add(_cyl(o.radius * 0.85, o.radius, o.height, w, [0, o.height / 2, 0], 12));
    // bands
    g.add(_cyl(o.radius * 0.86, o.radius * 0.86, 0.015, band, [0, o.height * 0.25, 0], 12));
    g.add(_cyl(o.radius + 0.005, o.radius + 0.005, 0.015, band, [0, o.height * 0.75, 0], 12));
    // handle arch
    const handle = _tor(o.radius * 0.6, 0.008, band, [0, o.height + o.radius * 0.35, 0], 8, 16);
    handle.rotation.x = Math.PI / 2;
    g.add(handle);
    return g;
  }, {
    icon: "🪣", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.08, max: 0.25, step: 0.02, default: 0.13 },
      { key: "height", label: "Height", type: "number", min: 0.15, max: 0.4, step: 0.05, default: 0.25 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a3a1a },
    ],
  });

  register("broom", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.handleColor);
    const straw = M.rope(o.bristleColor);
    // handle
    g.add(_cyl(0.015, 0.012, o.height, w, [0, o.height / 2, 0], 6));
    // bristle bundle (cone)
    g.add(_cone(o.bristleWidth / 2, o.bristleLen, straw, [0, -o.bristleLen / 2 + 0.02, 0], 10));
    // binding wrap
    g.add(_cyl(0.022, 0.022, 0.04, M.rope(0x5a4a30), [0, 0.02, 0], 8));
    return g;
  }, {
    icon: "🧹", category: "props",
    params: [
      { key: "height",       label: "Handle H",    type: "number", min: 0.8, max: 1.8, step: 0.1, default: 1.2 },
      { key: "bristleLen",   label: "Bristle Len", type: "number", min: 0.15, max: 0.4, step: 0.05, default: 0.25 },
      { key: "bristleWidth", label: "Bristle W",   type: "number", min: 0.08, max: 0.2, step: 0.02, default: 0.12 },
      { key: "handleColor",  label: "Handle",      type: "color",  default: 0x6b4a2b },
      { key: "bristleColor", label: "Bristle",     type: "color",  default: 0x8a7a60 },
    ],
  });

  register("picnic_basket", function (o) {
    const g = new THREE.Group();
    const w = M.rope(o.color);
    // basket body (tapered box)
    g.add(_box(o.width, o.height, o.depth, w, [0, o.height / 2, 0]));
    // slight rim
    g.add(_box(o.width + 0.02, 0.02, o.depth + 0.02, M.wood(o.color), [0, o.height, 0]));
    // lid (half-height box on top)
    g.add(_box(o.width, o.height * 0.3, o.depth, w, [0, o.height + o.height * 0.15, 0]));
    // handle arch
    const handle = _tor(o.width * 0.35, 0.012, M.wood(o.color), [0, o.height + o.height * 0.3 + o.width * 0.2, 0], 8, 16);
    handle.rotation.y = Math.PI / 2;
    handle.rotation.x = Math.PI / 2;
    g.add(handle);
    return g;
  }, {
    icon: "🧺", category: "props",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.2, max: 0.5, step: 0.02, default: 0.35 },
      { key: "depth",  label: "Depth",  type: "number", min: 0.15, max: 0.35, step: 0.02, default: 0.22 },
      { key: "height", label: "Height", type: "number", min: 0.12, max: 0.3, step: 0.02, default: 0.18 },
      { key: "color",  label: "Color",  type: "color",  default: 0x8a7a60 },
    ],
  });

  register("bird_cage", function (o) {
    const g = new THREE.Group();
    const br = M.brass(o.color);
    // base tray
    g.add(_cyl(o.radius, o.radius, 0.03, br, [0, 0.015, 0], 20));
    // vertical bars
    const barCount = 16;
    for (let i = 0; i < barCount; i++) {
      const a = (i / barCount) * Math.PI * 2;
      const x = Math.cos(a) * o.radius * 0.95;
      const z = Math.sin(a) * o.radius * 0.95;
      g.add(_cyl(0.004, 0.004, o.height, br, [x, o.height / 2 + 0.03, z], 4));
    }
    // top ring
    g.add(_tor(o.radius * 0.95, 0.008, br, [0, o.height + 0.03, 0], 6, 20));
    // dome top
    g.add(_sph(o.radius * 0.5, br, [0, o.height + 0.03 + o.radius * 0.35, 0], 12));
    // hanging hook
    g.add(_cyl(0.006, 0.006, 0.08, br, [0, o.height + 0.03 + o.radius * 0.5 + 0.04, 0], 4));
    return g;
  }, {
    icon: "🐦", category: "decorative",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.1, max: 0.3, step: 0.02, default: 0.15 },
      { key: "height", label: "Height", type: "number", min: 0.25, max: 0.6, step: 0.05, default: 0.4 },
      { key: "color",  label: "Metal",  type: "color",  default: 0xc8a050 },
    ],
  });

  register("mortar_pestle", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // mortar bowl (lathe-like: cylinder with scooped interior illusion)
    g.add(_cyl(o.radius, o.radius * 0.85, o.height, st, [0, o.height / 2, 0], 20));
    // rim ring
    g.add(_tor(o.radius, 0.012, st, [0, o.height, 0], 6, 20));
    // pestle
    const pestle = _cyl(0.025, 0.035, o.height * 1.2, st, [0, o.height + 0.05, 0], 8);
    pestle.rotation.z = 0.4;
    pestle.rotation.x = 0.2;
    g.add(pestle);
    return g;
  }, {
    icon: "⚗️", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.05, max: 0.15, step: 0.01, default: 0.08 },
      { key: "height", label: "Height", type: "number", min: 0.06, max: 0.15, step: 0.01, default: 0.09 },
      { key: "color",  label: "Color",  type: "color",  default: 0x6a6a60 },
    ],
  });

  register("graveyard_fence", function (o) {
    const g = new THREE.Group();
    const met = M.metal(o.color);
    // bottom rail
    g.add(_box(o.length, 0.025, 0.025, met, [0, 0.15, 0]));
    // top rail
    g.add(_box(o.length, 0.025, 0.025, met, [0, o.height - 0.05, 0]));
    // pickets with pointed tops
    const spacing = 0.12;
    const count = Math.floor(o.length / spacing);
    for (let i = 0; i <= count; i++) {
      const x = -o.length / 2 + i * spacing;
      g.add(_box(0.015, o.height, 0.015, met, [x, o.height / 2, 0]));
      // spear tip
      g.add(_cone(0.018, 0.04, met, [x, o.height + 0.02, 0], 4));
    }
    // posts every ~1m
    const postSpacing = 1.0;
    const posts = Math.floor(o.length / postSpacing);
    for (let i = 0; i <= posts; i++) {
      const x = -o.length / 2 + i * postSpacing;
      g.add(_box(0.04, o.height + 0.05, 0.04, met, [x, (o.height + 0.05) / 2, 0]));
      g.add(_sph(0.03, met, [x, o.height + 0.05, 0], 6));
    }
    return g;
  }, {
    icon: "⚰️", category: "structure",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.0, max: 10.0, step: 0.5, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 1.5,  step: 0.1, default: 0.9 },
      { key: "color",  label: "Color",  type: "color",  default: 0x1a1a1a },
    ],
  });

  register("wooden_fence", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // posts
    const posts = Math.max(2, Math.floor(o.length / o.spacing) + 1);
    for (let i = 0; i < posts; i++) {
      const x = -o.length / 2 + i * (o.length / (posts - 1));
      g.add(_box(0.06, o.height + 0.05, 0.06, w, [x, (o.height + 0.05) / 2, 0]));
      // pointed top
      g.add(_cone(0.05, 0.08, w, [x, o.height + 0.08, 0], 4));
    }
    // horizontal rails
    g.add(_box(o.length, 0.04, 0.04, w, [0, o.height * 0.3, 0]));
    g.add(_box(o.length, 0.04, 0.04, w, [0, o.height * 0.7, 0]));
    return g;
  }, {
    icon: "🏗️", category: "structure",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.0, max: 10.0, step: 0.5, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.8 },
      { key: "spacing", label: "Spacing", type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.6 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("picket_fence", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const pickets = Math.floor(o.length / 0.08);
    for (let i = 0; i < pickets; i++) {
      const x = -o.length / 2 + 0.04 + i * 0.08;
      g.add(_box(0.02, o.height, 0.015, w, [x, o.height / 2, 0]));
      g.add(_cone(0.015, 0.03, w, [x, o.height + 0.015, 0], 3));
    }
    g.add(_box(o.length, 0.03, 0.02, w, [0, o.height * 0.25, 0]));
    g.add(_box(o.length, 0.03, 0.02, w, [0, o.height * 0.75, 0]));
    return g;
  }, {
    icon: "🏡", category: "structure",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.0, max: 8.0, step: 0.5, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.7 },
      { key: "color", label: "Color", type: "color", default: 0xd8d0c0 },
    ],
  });

  register("barrel_stack", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.woodColor);
    const band = M.metal(o.bandColor);
    let idx = 0;
    for (let row = 0; row < o.rows; row++) {
      const count = o.perRow - row;
      for (let i = 0; i < count; i++) {
        const x = -((count - 1) * o.barrelR * 2) / 2 + i * o.barrelR * 2;
        const y = row * o.barrelR * 1.8 + o.barrelR;
        // barrel body
        g.add(_cyl(o.barrelR, o.barrelR, o.barrelH, w, [x, y, 0], 12));
        // bands
        g.add(_tor(o.barrelR + 0.005, 0.008, band, [x, y - o.barrelH * 0.3, 0], 12, 4));
        g.add(_tor(o.barrelR + 0.005, 0.008, band, [x, y + o.barrelH * 0.3, 0], 12, 4));
        idx++;
      }
    }
    return g;
  }, {
    icon: "🛢️", category: "props",
    params: [
      { key: "barrelR", label: "Barrel R", type: "number", min: 0.12, max: 0.35, step: 0.03, default: 0.2 },
      { key: "barrelH", label: "Barrel H", type: "number", min: 0.25, max: 0.6, step: 0.05, default: 0.35 },
      { key: "perRow", label: "Per Row", type: "int", min: 2, max: 6, default: 3 },
      { key: "rows", label: "Rows", type: "int", min: 1, max: 4, default: 2 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x5a3a1a },
      { key: "bandColor", label: "Bands", type: "color", default: 0x3a3a3a },
    ],
  });

  register("crate_stack", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    for (let i = 0; i < o.count; i++) {
      const s = rand(o.minSize, o.maxSize);
      const x = rand(-o.spread, o.spread);
      const z = rand(-o.spread, o.spread);
      let y = s / 2;
      // stack on top of others roughly
      if (i > 2) y += rand(o.minSize, o.maxSize);
      const crate = _box(s, s, s, M.wood(_c(o.color) + Math.floor(rand(-8, 8))), [x, y, z]);
      crate.rotation.y = rand(0, 0.5);
      g.add(crate);
      // edge braces
      const bs = s / 2;
      g.add(_box(s + 0.01, 0.015, 0.015, M.wood(o.color - 0x080808), [x, y + bs, z]));
      g.add(_box(s + 0.01, 0.015, 0.015, M.wood(o.color - 0x080808), [x, y - bs, z]));
    }
    return g;
  }, {
    icon: "📦", category: "props",
    params: [
      { key: "count", label: "Count", type: "int", min: 2, max: 8, default: 4 },
      { key: "minSize", label: "Min Size", type: "number", min: 0.15, max: 0.3, step: 0.05, default: 0.2 },
      { key: "maxSize", label: "Max Size", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.4 },
      { key: "spread", label: "Spread", type: "number", min: 0.2, max: 1.0, step: 0.1, default: 0.4 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("well_with_roof", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.stoneColor);
    const w = M.wood(o.woodColor);
    // stone well ring
    g.add(_tor(o.wellR, o.wellR * 0.25, st, [0, o.wellR * 0.25, 0], 16, 8));
    g.add(_cyl(o.wellR - o.wellR * 0.2, o.wellR - o.wellR * 0.2, 0.03, M.metal(0x1a2a3a),
      [0, 0.02, 0], 16));
    // two posts
    g.add(_cyl(0.04, 0.04, o.roofH, w, [-o.wellR - 0.05, o.roofH / 2, 0], 6));
    g.add(_cyl(0.04, 0.04, o.roofH, w, [o.wellR + 0.05, o.roofH / 2, 0], 6));
    // crossbeam
    g.add(_cyl(0.035, 0.035, o.wellR * 2 + 0.2, w, [0, o.roofH, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // little roof
    const roofW = o.wellR + 0.4;
    const roofH = 0.4;
    const slopeLen = Math.sqrt((roofW / 2) * (roofW / 2) + roofH * roofH);
    const ang = Math.atan2(roofH, roofW / 2);
    g.add(_box(slopeLen, 0.03, o.wellR + 0.3, w, [-roofW / 4, o.roofH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = ang;
    g.add(_box(slopeLen, 0.03, o.wellR + 0.3, w, [roofW / 4, o.roofH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = -ang;
    // bucket
    g.add(_cyl(0.05, 0.04, 0.07, w, [0, o.roofH - 0.4, 0], 8));
    // rope
    g.add(_cyl(0.005, 0.005, 0.4, M.rope(0x8a7a60), [0, o.roofH - 0.2, 0], 4));
    return g;
  }, {
    icon: "⛲", category: "structure",
    params: [
      { key: "wellR", label: "Well R", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "roofH", label: "Roof H", type: "number", min: 1.5, max: 3.0, step: 0.2, default: 2.0 },
      { key: "stoneColor", label: "Stone", type: "color", default: 0x6a6258 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x5a3a1a },
    ],
  });

  register("cart", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(0x3a3a3a);
    // bed
    g.add(_box(o.length, 0.04, o.width, w, [0, o.wheelR + 0.1, 0]));
    // sides
    g.add(_box(o.length, 0.2, 0.03, w, [0, o.wheelR + 0.2, -o.width / 2]));
    g.add(_box(o.length, 0.2, 0.03, w, [0, o.wheelR + 0.2, o.width / 2]));
    // back
    g.add(_box(0.03, 0.2, o.width, w, [-o.length / 2, o.wheelR + 0.2, 0]));
    // axles
    g.add(_cyl(0.02, 0.02, o.width + 0.1, met, [-o.length * 0.3, o.wheelR, 0], 6));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    g.add(_cyl(0.02, 0.02, o.width + 0.1, met, [o.length * 0.3, o.wheelR, 0], 6));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // wheels
    for (let xi = -1; xi <= 1; xi += 2) {
      for (let zi = -1; zi <= 1; zi += 2) {
        const wheel = _tor(o.wheelR, 0.02, w,
          [xi * o.length * 0.3, o.wheelR, zi * (o.width / 2 + 0.04)], 12, 6);
        wheel.rotation.x = Math.PI / 2;
        g.add(wheel);
        // spokes
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2;
          const spoke = _cyl(0.008, 0.008, o.wheelR * 0.9, w,
            [xi * o.length * 0.3, o.wheelR, zi * (o.width / 2 + 0.04)], 4);
          spoke.rotation.x = Math.PI / 2;
          spoke.rotation.z = a;
          g.add(spoke);
        }
      }
    }
    // handle / tongue
    g.add(_box(0.04, 0.04, o.length * 0.4, w, [o.length / 2 + o.length * 0.2, o.wheelR, 0]));
    return g;
  }, {
    icon: "🛒", category: "props",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
      { key: "width", label: "Width", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 0.9 },
      { key: "wheelR", label: "Wheel R", type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.3 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("rain_barrel", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const band = M.metal(0x3a3a3a);
    // barrel body (slightly wider in middle)
    g.add(_cyl(o.radius, o.radius * 0.9, o.height, w, [0, o.height / 2, 0], 14));
    // bands
    g.add(_tor(o.radius + 0.005, 0.01, band, [0, o.height * 0.15, 0], 14, 5));
    g.add(_tor(o.radius + 0.005, 0.01, band, [0, o.height * 0.5, 0], 14, 5));
    g.add(_tor(o.radius + 0.005, 0.01, band, [0, o.height * 0.85, 0], 14, 5));
    // lid (partial – slightly open)
    g.add(_cyl(o.radius - 0.02, o.radius - 0.02, 0.02, w, [0, o.height + 0.01, 0], 14));
    // water visible
    g.add(_cyl(o.radius - 0.04, o.radius - 0.04, 0.01, M.glass(0x4a7a9a),
      [0, o.height - 0.05, 0], 14));
    // spigot
    g.add(_cyl(0.015, 0.015, 0.08, band, [o.radius + 0.04, o.height * 0.2, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    return g;
  }, {
    icon: "🛢️", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.12, max: 0.4, step: 0.03, default: 0.22 },
      { key: "height", label: "Height", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0x4a3018 },
    ],
  });

  register("fishing_net", function (o) {
    const g = new THREE.Group();
    const rope = M.rope(o.color);
    // supporting poles
    g.add(_cyl(0.03, 0.03, o.height, M.wood(0x5a3a1a), [-o.width / 2, o.height / 2, 0], 6));
    g.add(_cyl(0.03, 0.03, o.height, M.wood(0x5a3a1a), [o.width / 2, o.height / 2, 0], 6));
    // top rope
    g.add(_cyl(0.01, 0.01, o.width, rope, [0, o.height, 0], 4));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // net strings (vertical)
    const vCount = Math.floor(o.width / 0.1);
    for (let i = 0; i <= vCount; i++) {
      const x = -o.width / 2 + i * (o.width / vCount);
      g.add(_cyl(0.004, 0.004, o.height * 0.8, rope, [x, o.height * 0.6, 0], 3));
    }
    // net strings (horizontal)
    const hCount = Math.floor(o.height * 0.8 / 0.1);
    for (let i = 0; i <= hCount; i++) {
      const y = o.height * 0.2 + i * (o.height * 0.8 / hCount);
      g.add(_cyl(0.004, 0.004, o.width, rope, [0, y, 0], 3));
      g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    }
    return g;
  }, {
    icon: "🎣", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.5, max: 3.0, step: 0.3, default: 1.5 },
      { key: "height", label: "Height", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.5 },
      { key: "color", label: "Color", type: "color", default: 0x8a7a60 },
    ],
  });

  register("well_pulley", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.stoneColor);
    const w = M.wood(o.woodColor);
    // circular stone wall
    g.add(_tor(o.wellR, o.wellR * 0.3, st, [0, o.wellR * 0.3, 0], 16, 8));
    // dark water inside
    g.add(_cyl(o.wellR - o.wellR * 0.25, o.wellR - o.wellR * 0.25, 0.02,
      M.metal(0x0a1a2a), [0, 0.01, 0], 16));
    // two uprights
    g.add(_box(0.06, o.postH, 0.06, w, [-o.wellR - 0.05, o.postH / 2, 0]));
    g.add(_box(0.06, o.postH, 0.06, w, [o.wellR + 0.05, o.postH / 2, 0]));
    // axle with winch
    g.add(_cyl(0.03, 0.03, o.wellR * 2 + 0.2, w, [0, o.postH - 0.1, 0], 8));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // handle
    g.add(_box(0.04, 0.15, 0.04, w, [o.wellR + 0.2, o.postH - 0.1, 0]));
    // rope
    g.add(_cyl(0.005, 0.005, o.postH * 0.6, M.rope(0x8a7a60), [0, o.postH * 0.5, 0], 4));
    // bucket at bottom
    g.add(_cyl(0.05, 0.04, 0.06, w, [0, o.postH * 0.2, 0], 8));
    return g;
  }, {
    icon: "⛲", category: "structure",
    params: [
      { key: "wellR", label: "Well R", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "postH", label: "Post H", type: "number", min: 1.0, max: 2.5, step: 0.2, default: 1.5 },
      { key: "stoneColor", label: "Stone", type: "color", default: 0x6a6258 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x5a3a1a },
    ],
  });

  register("crane_medieval", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(0x3a3a3a);
    const rope = M.rope(0x8a7a60);
    // base frame
    g.add(_box(o.baseW, 0.1, o.baseW, w, [0, 0.05, 0]));
    // vertical mast
    g.add(_cyl(0.08, 0.06, o.height, w, [0, o.height / 2, 0], 8));
    // boom arm (angled)
    const boomLen = o.height * 0.7;
    const boom = _cyl(0.05, 0.04, boomLen, w, [0, 0, 0], 6);
    boom.position.set(boomLen * 0.2, o.height * 0.85, 0);
    boom.rotation.z = 0.5;
    g.add(boom);
    // back stay
    const stay = _cyl(0.03, 0.03, o.height * 0.6, w, [0, 0, 0], 6);
    stay.position.set(-o.baseW * 0.3, o.height * 0.55, 0);
    stay.rotation.z = -0.6;
    g.add(stay);
    // treadwheel (drum)
    g.add(_tor(o.baseW * 0.3, 0.06, w, [-o.baseW * 0.3, o.baseW * 0.3 + 0.1, 0], 12, 6));
    g.children[g.children.length - 1].rotation.y = Math.PI / 2;
    // rope from boom tip
    g.add(_cyl(0.008, 0.008, o.height * 0.5, rope,
      [boomLen * 0.5, o.height * 0.7, 0], 4));
    // hook
    g.add(_tor(0.04, 0.008, met, [boomLen * 0.5, o.height * 0.45, 0], 8, 4));
    return g;
  }, {
    icon: "🏗️", category: "structure",
    params: [
      { key: "baseW", label: "Base W", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.5 },
      { key: "height", label: "Height", type: "number", min: 3.0, max: 8.0, step: 0.5, default: 5.0 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("wooden_crane", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // A-frame base
    const hw = o.baseW / 2;
    for (let side = -1; side <= 1; side += 2) {
      g.add(_box(0.08, o.height, 0.08, w, [side * hw, o.height / 2, 0]));
      // diagonal brace
      const brace = _box(0.06, o.height * 0.7, 0.06, w, [0, 0, 0]);
      brace.position.set(side * hw, o.height * 0.35, hw * 0.6);
      brace.rotation.x = -0.4;
      g.add(brace);
    }
    // cross beam at top
    g.add(_cyl(0.04, 0.04, o.baseW, w, [0, o.height, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // boom extending forward
    g.add(_box(0.06, 0.06, o.boomLen, w, [0, o.height - 0.1, o.boomLen / 2]));
    // rope
    g.add(_cyl(0.008, 0.008, o.height * 0.7, M.rope(0x8a7a60),
      [0, o.height * 0.65, o.boomLen - 0.1], 4));
    // pulley
    g.add(_cyl(0.04, 0.04, 0.03, w, [0, o.height - 0.12, o.boomLen], 8));
    return g;
  }, {
    icon: "🏗️", category: "structure",
    params: [
      { key: "baseW", label: "Base W", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.5 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 6.0, step: 0.5, default: 3.5 },
      { key: "boomLen", label: "Boom L", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.0 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  // ════════════════════════════════════════════════════════════════
  // BATCH 3 — INTERIORS, FOOD, ANIMALS, TOOLS, MISC
  // ════════════════════════════════════════════════════════════════

  register("chicken_coop", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // raised floor
    const legH = 0.3;
    const hw = o.width / 2 - 0.05, hd = o.depth / 2 - 0.05;
    [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].forEach(([x, z]) => {
      g.add(_cyl(0.03, 0.04, legH, w, [x, legH / 2, z], 6));
    });
    g.add(_box(o.width, 0.04, o.depth, w, [0, legH + 0.02, 0]));
    // walls
    g.add(_box(o.width, o.wallH, o.depth, w, [0, legH + 0.04 + o.wallH / 2, 0]));
    // wire mesh front (represented by thin lines)
    for (let i = 0; i < 6; i++) {
      g.add(_cyl(0.003, 0.003, o.wallH, M.metal(0x6a6a6a),
        [-o.width / 2 + 0.08 + i * (o.width - 0.16) / 5, legH + 0.04 + o.wallH / 2, o.depth / 2 + 0.01], 3));
    }
    // roof (slanted)
    const roofPanel = _box(o.width + 0.1, 0.03, o.depth + 0.15, w,
      [0, legH + 0.04 + o.wallH + 0.1, 0]);
    roofPanel.rotation.x = -0.1;
    g.add(roofPanel);
    // small door
    g.add(_box(0.2, 0.25, 0.03, M.wood(o.color - 0x080808),
      [0, legH + 0.04 + 0.125, o.depth / 2 + 0.015]));
    // ramp
    const rampLen = 0.4;
    const ramp = _box(0.15, 0.02, rampLen, w, [0, legH / 2, o.depth / 2 + rampLen / 2 + 0.02]);
    ramp.rotation.x = 0.5;
    g.add(ramp);
    // nesting boxes (side)
    g.add(_box(0.25, 0.2, 0.2, w, [o.width / 2 + 0.1, legH + 0.04 + 0.1, 0]));
    return g;
  }, {
    icon: "🐔", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.2 },
      { key: "depth", label: "Depth", type: "number", min: 0.6, max: 2.0, step: 0.2, default: 1.0 },
      { key: "wallH", label: "Wall H", type: "number", min: 0.5, max: 1.2, step: 0.1, default: 0.7 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("pig_pen", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // mud floor
    g.add(_box(o.width, 0.04, o.depth, M.stone(0x3a2a18), [0, 0.02, 0]));
    // fence posts and rails
    const perimeter = [
      [-o.width / 2, -o.depth / 2, o.width, 0, 'x'],
      [o.width / 2, -o.depth / 2, 0, o.depth, 'z'],
      [-o.width / 2, o.depth / 2, o.width, 0, 'x'],
      [-o.width / 2, -o.depth / 2, 0, o.depth * 0.5, 'z'], // partial for gate
    ];
    // simple fence
    const postSpacing = 0.6;
    for (let xi = 0; xi <= Math.floor(o.width / postSpacing); xi++) {
      const x = -o.width / 2 + xi * postSpacing;
      g.add(_cyl(0.03, 0.03, o.fenceH, w, [x, o.fenceH / 2, -o.depth / 2], 5));
      g.add(_cyl(0.03, 0.03, o.fenceH, w, [x, o.fenceH / 2, o.depth / 2], 5));
    }
    for (let zi = 0; zi <= Math.floor(o.depth / postSpacing); zi++) {
      const z = -o.depth / 2 + zi * postSpacing;
      g.add(_cyl(0.03, 0.03, o.fenceH, w, [-o.width / 2, o.fenceH / 2, z], 5));
      g.add(_cyl(0.03, 0.03, o.fenceH, w, [o.width / 2, o.fenceH / 2, z], 5));
    }
    // horizontal rails
    g.add(_box(o.width, 0.03, 0.03, w, [0, o.fenceH * 0.4, -o.depth / 2]));
    g.add(_box(o.width, 0.03, 0.03, w, [0, o.fenceH * 0.8, -o.depth / 2]));
    g.add(_box(o.width, 0.03, 0.03, w, [0, o.fenceH * 0.4, o.depth / 2]));
    g.add(_box(o.width, 0.03, 0.03, w, [0, o.fenceH * 0.8, o.depth / 2]));
    g.add(_box(0.03, 0.03, o.depth, w, [-o.width / 2, o.fenceH * 0.4, 0]));
    g.add(_box(0.03, 0.03, o.depth, w, [-o.width / 2, o.fenceH * 0.8, 0]));
    g.add(_box(0.03, 0.03, o.depth, w, [o.width / 2, o.fenceH * 0.4, 0]));
    g.add(_box(0.03, 0.03, o.depth, w, [o.width / 2, o.fenceH * 0.8, 0]));
    // trough
    g.add(_box(0.5, 0.1, 0.15, w, [-o.width / 2 + 0.3, 0.08, 0]));
    // mud puddle
    g.add(_cyl(0.25, 0.25, 0.01, M.stone(0x2a1a08), [o.width * 0.15, 0.045, o.depth * 0.15], 10));
    return g;
  }, {
    icon: "🐷", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 2.0, max: 5.0, step: 0.5, default: 3.0 },
      { key: "depth", label: "Depth", type: "number", min: 2.0, max: 5.0, step: 0.5, default: 3.0 },
      { key: "fenceH", label: "Fence H", type: "number", min: 0.5, max: 1.2, step: 0.1, default: 0.7 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("dog_house", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // base
    g.add(_box(o.size, 0.04, o.size * 1.2, w, [0, 0.02, 0]));
    // walls
    g.add(_box(o.size, o.wallH, 0.04, w, [0, o.wallH / 2, -o.size * 0.6]));
    g.add(_box(0.04, o.wallH, o.size * 1.2, w, [-o.size / 2, o.wallH / 2, 0]));
    g.add(_box(0.04, o.wallH, o.size * 1.2, w, [o.size / 2, o.wallH / 2, 0]));
    // front wall with opening
    g.add(_box(o.size * 0.25, o.wallH, 0.04, w, [-o.size * 0.375, o.wallH / 2, o.size * 0.6]));
    g.add(_box(o.size * 0.25, o.wallH, 0.04, w, [o.size * 0.375, o.wallH / 2, o.size * 0.6]));
    g.add(_box(o.size * 0.5, o.wallH * 0.35, 0.04, w, [0, o.wallH * 0.825, o.size * 0.6]));
    // roof (A-frame)
    const halfW = o.size / 2 + 0.05;
    const roofH = 0.3;
    const slopeLen = Math.sqrt(halfW * halfW + roofH * roofH);
    const ang = Math.atan2(roofH, halfW);
    g.add(_box(slopeLen, 0.03, o.size * 1.3, w, [-halfW / 2, o.wallH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = ang;
    g.add(_box(slopeLen, 0.03, o.size * 1.3, w, [halfW / 2, o.wallH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = -ang;
    return g;
  }, {
    icon: "🐕", category: "structure",
    params: [
      { key: "size", label: "Size", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.6 },
      { key: "wallH", label: "Wall H", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.4 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("bee_hive", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // stacked boxes (supers)
    for (let i = 0; i < o.supers; i++) {
      const size = o.baseW - i * 0.02;
      g.add(_box(size, 0.12, size, w, [0, 0.06 + i * 0.13, 0]));
    }
    // landing board at bottom
    g.add(_box(o.baseW * 0.4, 0.015, 0.08, w,
      [0, 0.01, o.baseW / 2 + 0.04]));
    // entrance slit
    g.add(_box(o.baseW * 0.3, 0.015, 0.02, M.metal(0x1a1a1a),
      [0, 0.06, o.baseW / 2 + 0.01]));
    // roof (peaked)
    const topY = 0.06 + o.supers * 0.13;
    g.add(_box(o.baseW + 0.06, 0.02, o.baseW + 0.06, w, [0, topY + 0.01, 0]));
    g.add(_cone(o.baseW * 0.45, 0.06, w, [0, topY + 0.05, 0], 4));
    return g;
  }, {
    icon: "🐝", category: "props",
    params: [
      { key: "baseW", label: "Base W", type: "number", min: 0.2, max: 0.5, step: 0.05, default: 0.3 },
      { key: "supers", label: "Supers", type: "int", min: 2, max: 5, default: 3 },
      { key: "color", label: "Color", type: "color", default: 0xc8b060 },
    ],
  });

  register("well_bucket", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const band = M.metal(0x3a3a3a);
    // bucket body
    g.add(_cyl(o.radius * 0.85, o.radius, o.height, w, [0, o.height / 2, 0], 10));
    // bands
    g.add(_tor(o.radius + 0.005, 0.006, band, [0, o.height * 0.15, 0], 10, 4));
    g.add(_tor(o.radius * 0.88 + 0.005, 0.006, band, [0, o.height * 0.85, 0], 10, 4));
    // handle attachment points
    g.add(_box(0.008, 0.03, 0.02, band, [-o.radius, o.height, 0]));
    g.add(_box(0.008, 0.03, 0.02, band, [o.radius, o.height, 0]));
    // handle (arc)
    g.add(_tor(o.radius, 0.005, band, [0, o.height + 0.01, 0], 8, 4));
    g.children[g.children.length - 1].scale.y = 0.6;
    return g;
  }, {
    icon: "🪣", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.04, max: 0.15, step: 0.01, default: 0.08 },
      { key: "height", label: "Height", type: "number", min: 0.08, max: 0.25, step: 0.02, default: 0.12 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("mortar_pestle", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // mortar bowl
    g.add(_cyl(o.bowlR * 0.8, o.bowlR, o.bowlH, st, [0, o.bowlH / 2, 0], 12));
    // hollow inside (darker)
    g.add(_cyl(o.bowlR * 0.65, o.bowlR * 0.85, o.bowlH * 0.7, M.stone(o.color - 0x101010),
      [0, o.bowlH * 0.35 + o.bowlH * 0.15, 0], 12));
    // pestle (resting at angle)
    const pestle = _cyl(0.02, 0.03, o.bowlH * 1.5, st, [0, 0, 0], 8);
    pestle.position.set(o.bowlR * 0.3, o.bowlH + o.bowlH * 0.3, 0);
    pestle.rotation.z = 0.5;
    g.add(pestle);
    return g;
  }, {
    icon: "⚗️", category: "props",
    params: [
      { key: "bowlR", label: "Bowl R", type: "number", min: 0.05, max: 0.2, step: 0.02, default: 0.1 },
      { key: "bowlH", label: "Bowl H", type: "number", min: 0.05, max: 0.15, step: 0.02, default: 0.08 },
      { key: "color", label: "Color", type: "color", default: 0x6a6a68 },
    ],
  });

  register("bird_cage", function (o) {
    const g = new THREE.Group();
    const met = M.metal(o.color);
    // base disc
    g.add(_cyl(o.radius, o.radius, 0.02, met, [0, 0.01, 0], 14));
    // vertical bars
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.add(_cyl(0.004, 0.004, o.height, met,
        [Math.cos(a) * o.radius * 0.95, o.height / 2, Math.sin(a) * o.radius * 0.95], 3));
    }
    // horizontal rings
    g.add(_tor(o.radius * 0.95, 0.004, met, [0, o.height * 0.3, 0], 14, 3));
    g.add(_tor(o.radius * 0.95, 0.004, met, [0, o.height * 0.6, 0], 14, 3));
    // dome top
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const bar = _cyl(0.004, 0.003, o.radius * 1.2, met, [0, 0, 0], 3);
      bar.position.set(Math.cos(a) * o.radius * 0.45, o.height + o.radius * 0.3, Math.sin(a) * o.radius * 0.45);
      bar.rotation.z = a;
      bar.rotation.x = 0.6;
      g.add(bar);
    }
    // hook at top
    g.add(_tor(0.015, 0.003, met, [0, o.height + o.radius * 0.55, 0], 8, 3));
    // perch inside
    g.add(_cyl(0.006, 0.006, o.radius * 1.5, M.wood(0x5a3a1a),
      [0, o.height * 0.35, 0], 4));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    return g;
  }, {
    icon: "🐦", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.06, max: 0.2, step: 0.02, default: 0.1 },
      { key: "height", label: "Height", type: "number", min: 0.15, max: 0.4, step: 0.03, default: 0.25 },
      { key: "color", label: "Color", type: "color", default: 0x8a7a40 },
    ],
  });

  register("picnic_basket", function (o) {
    const g = new THREE.Group();
    const weave = M.rope(o.color);
    // basket body
    g.add(_box(o.width * 0.8, o.height, o.depth * 0.8, weave, [0, o.height / 2, 0]));
    g.add(_box(o.width, o.height * 0.15, o.depth, weave, [0, o.height * 0.075, 0]));
    // lid (half open)
    const lid = _box(o.width, 0.03, o.depth, weave, [0, o.height, -o.depth * 0.15]);
    lid.rotation.x = 0.4;
    g.add(lid);
    // handle
    g.add(_tor(o.width * 0.35, 0.01, weave, [0, o.height + o.width * 0.15, 0], 10, 4));
    g.children[g.children.length - 1].scale.y = 0.5;
    return g;
  }, {
    icon: "🧺", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.15, max: 0.4, step: 0.03, default: 0.25 },
      { key: "depth", label: "Depth", type: "number", min: 0.1, max: 0.3, step: 0.03, default: 0.18 },
      { key: "height", label: "Height", type: "number", min: 0.08, max: 0.2, step: 0.02, default: 0.12 },
      { key: "color", label: "Color", type: "color", default: 0x9a7a40 },
    ],
  });
  
  // ════════════════════════════════════════════════════════════════
  // BATCH 4 — DUNGEON, INTERIOR, MISC
  // ════════════════════════════════════════════════════════════════

  register("ladder", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // side rails
    g.add(_box(0.03, o.height, 0.03, w, [-o.width / 2, o.height / 2, 0]));
    g.add(_box(0.03, o.height, 0.03, w, [o.width / 2, o.height / 2, 0]));
    // rungs
    const rungCount = Math.floor(o.height / 0.2);
    for (let i = 0; i < rungCount; i++) {
      const y = 0.1 + i * 0.2;
      g.add(_cyl(0.012, 0.012, o.width - 0.03, w, [0, y, 0], 5));
      g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    }
    return g;
  }, {
    icon: "🪜", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.4 },
      { key: "height", label: "Height", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("wooden_barrel", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const band = M.metal(0x3a3a3a);
    // main body (wider in middle using stacked cylinders)
    g.add(_cyl(o.radius * 0.9, o.radius, o.height * 0.3, w, [0, o.height * 0.15, 0], 14));
    g.add(_cyl(o.radius, o.radius, o.height * 0.4, w, [0, o.height * 0.5, 0], 14));
    g.add(_cyl(o.radius, o.radius * 0.9, o.height * 0.3, w, [0, o.height * 0.85, 0], 14));
    // bands
    g.add(_tor(o.radius * 0.92 + 0.005, 0.01, band, [0, o.height * 0.15, 0], 14, 5));
    g.add(_tor(o.radius + 0.005, 0.01, band, [0, o.height * 0.4, 0], 14, 5));
    g.add(_tor(o.radius + 0.005, 0.01, band, [0, o.height * 0.6, 0], 14, 5));
    g.add(_tor(o.radius * 0.92 + 0.005, 0.01, band, [0, o.height * 0.85, 0], 14, 5));
    // top lid
    g.add(_cyl(o.radius * 0.88, o.radius * 0.88, 0.02, w, [0, o.height + 0.01, 0], 14));
    // bung hole
    g.add(_cyl(0.02, 0.02, 0.02, M.wood(o.color - 0x080808),
      [o.radius + 0.005, o.height * 0.5, 0], 6));
    return g;
  }, {
    icon: "🛢️", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.12, max: 0.4, step: 0.03, default: 0.22 },
      { key: "height", label: "Height", type: "number", min: 0.25, max: 0.7, step: 0.05, default: 0.4 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

})();
