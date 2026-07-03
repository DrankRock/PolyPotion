// category: "furniture"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("table_round", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // top
    g.add(_cyl(o.radius, o.radius, 0.06, w, [0, o.height, 0], 32));
    // pedestal
    g.add(_cyl(0.06, 0.10, o.height - 0.06, w, [0, (o.height - 0.06) / 2, 0], 12));
    // base
    g.add(_cyl(o.radius * 0.6, o.radius * 0.65, 0.05, w, [0, 0.025, 0], 24));
    return g;
  }, {
    icon: "⊙", category: "furniture",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.3, max: 1.5, step: 0.05, default: 0.55 },
      { key: "height", label: "Height", type: "number", min: 0.4, max: 1.2, step: 0.05, default: 0.75 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a3a20 },
    ],
  });

  register("dining_table", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    g.add(_box(o.width, 0.07, o.depth, w, [0, o.height, 0]));
    // thick turned legs
    const lx = o.width / 2 - 0.12, lz = o.depth / 2 - 0.12;
    [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(([x, z]) => {
      g.add(_cyl(0.055, 0.07, o.height - 0.04, w, [x, (o.height - 0.04) / 2, z], 10));
      // decorative bulge
      g.add(_cyl(0.08, 0.08, 0.08, w, [x, o.height * 0.35, z], 10));
    });
    return g;
  }, {
    icon: "🍽️", category: "furniture",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 1.0, max: 3.0, step: 0.1,  default: 1.8 },
      { key: "depth",  label: "Depth",  type: "number", min: 0.6, max: 1.4, step: 0.1,  default: 0.9 },
      { key: "height", label: "Height", type: "number", min: 0.6, max: 1.0, step: 0.05, default: 0.78 },
      { key: "color",  label: "Color",  type: "color",  default: 0x4a3018 },
    ],
  });

  register("cabinet", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    g.add(_box(o.width, o.height, o.depth, w, [0, o.height / 2, 0]));
    // shelves
    const inner = o.height - 0.10;
    for (let i = 1; i < o.shelves; i++) {
      const sy = 0.05 + (inner / o.shelves) * i;
      g.add(_box(o.width - 0.06, 0.03, o.depth - 0.04, w, [0, sy, 0]));
    }
    // handle
    g.add(_box(0.06, 0.025, 0.02, M.brass(), [0, o.height * 0.5, o.depth / 2 + 0.01]));
    return g;
  }, {
    icon: "🗃️", category: "furniture",
    params: [
      { key: "width",   label: "Width",   type: "number", min: 0.4, max: 1.8, step: 0.1, default: 0.8 },
      { key: "height",  label: "Height",  type: "number", min: 0.4, max: 1.5, step: 0.1, default: 0.9 },
      { key: "depth",   label: "Depth",   type: "number", min: 0.3, max: 0.7, step: 0.05, default: 0.45 },
      { key: "shelves", label: "Shelves", type: "int",    min: 1,   max: 6,   default: 3 },
      { key: "color",   label: "Color",   type: "color",  default: 0x4a3220 },
    ],
  });

  register("shelf_wall", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    for (let i = 0; i < o.shelves; i++) {
      const sy = i * o.spacing;
      g.add(_box(o.width, 0.04, o.depth, w, [0, sy, 0]));
      // brackets
      g.add(_box(0.03, o.spacing * 0.6, 0.03, M.metal(0x3a3a3a), [-o.width / 2 + 0.08, sy - o.spacing * 0.3, -o.depth / 2 + 0.03]));
      g.add(_box(0.03, o.spacing * 0.6, 0.03, M.metal(0x3a3a3a), [ o.width / 2 - 0.08, sy - o.spacing * 0.3, -o.depth / 2 + 0.03]));
    }
    return g;
  }, {
    icon: "📏", category: "furniture",
    params: [
      { key: "width",   label: "Width",   type: "number", min: 0.5, max: 2.0, step: 0.1,  default: 1.0 },
      { key: "depth",   label: "Depth",   type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.25 },
      { key: "shelves", label: "Shelves", type: "int",    min: 1,   max: 6,   default: 3 },
      { key: "spacing", label: "Gap",     type: "number", min: 0.25, max: 0.6, step: 0.05, default: 0.40 },
      { key: "color",   label: "Color",   type: "color",  default: 0x5a3a20 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // ARCHITECTURE
  // ════════════════════════════════════════════════════════

  register("bookcase", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const bMat = M.book();
    const w = o.width, h = o.height, d = o.depth;
    // sides
    g.add(_box(0.04, h, d, mat, [-w/2, h/2, 0]));
    g.add(_box(0.04, h, d, mat, [ w/2, h/2, 0]));
    // back
    g.add(_box(w, h, 0.02, mat, [0, h/2, -d/2 + 0.01]));
    // shelves
    const shelves = o.shelves;
    for (let i = 0; i <= shelves; i++) {
      const sy = (i / shelves) * (h - 0.04) + 0.02;
      g.add(_box(w - 0.04, 0.03, d, mat, [0, sy, 0]));
      // books on each shelf except top
      if (i < shelves) {
        const shelfH = (h - 0.04) / shelves;
        const bookH = shelfH * 0.8;
        let bx = -w/2 + 0.08;
        while (bx < w/2 - 0.08) {
          const bw = rand(0.02, 0.06);
          const bh = bookH * rand(0.6, 1.0);
          const bc = pick([0x6b2a1a, 0x2a3a5a, 0x3a5a2a, 0x5a3a5a, 0x8a6a2a, 0x1a3a3a]);
          g.add(_box(bw, bh, d * 0.7, M.book(bc), [bx + bw/2, sy + 0.03 + bh/2, 0]));
          bx += bw + rand(0.005, 0.02);
        }
      }
    }
    return g;
  }, {
    icon: "📚", category: "furniture",
    params: [
      { key: "width",   label: "Width",   type: "number", min: 0.6, max: 3.0, step: 0.1,  default: 1.2 },
      { key: "height",  label: "Height",  type: "number", min: 0.8, max: 3.0, step: 0.1,  default: 2.0 },
      { key: "depth",   label: "Depth",   type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
      { key: "shelves", label: "Shelves",  type: "int",    min: 2,   max: 8,   default: 5 },
      { key: "color",   label: "Wood",    type: "color",  default: 0x5a3a20 },
    ],
  });

  register("dining_chair", function (o) {
    const g = new THREE.Group();
    const wMat = M.wood(o.woodColor);
    const cMat = M.cloth(o.seatColor);
    // legs
    for (let x = -1; x <= 1; x += 2) for (let z = -1; z <= 1; z += 2) {
      const lh = z < 0 ? 0.9 : 0.45;
      g.add(_box(0.035, lh, 0.035, wMat, [x * 0.18, lh/2, z * 0.18]));
    }
    // seat
    g.add(_box(0.42, 0.04, 0.42, cMat, [0, 0.45, 0]));
    // back rail
    g.add(_box(0.36, 0.04, 0.03, wMat, [0, 0.78, -0.18]));
    // back splat
    g.add(_box(0.02, 0.30, 0.02, wMat, [0, 0.63, -0.18]));
    return g;
  }, {
    icon: "🪑", category: "furniture",
    params: [
      { key: "woodColor", label: "Wood",  type: "color", default: 0x5a3a18 },
      { key: "seatColor", label: "Seat",  type: "color", default: 0x7a3a2a },
    ],
  });

  register("throne", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const vel = M.cloth(o.velvet);
    // seat
    g.add(_box(0.65, 0.08, 0.55, mat, [0, 0.48, 0]));
    g.add(_box(0.55, 0.06, 0.45, vel, [0, 0.53, 0]));
    // legs — thick ornate
    for (let x = -1; x <= 1; x += 2) for (let z = -1; z <= 1; z += 2) {
      g.add(_box(0.08, 0.44, 0.08, mat, [x * 0.26, 0.22, z * 0.2]));
    }
    // back — tall
    g.add(_box(0.65, o.backHeight, 0.06, mat, [0, 0.52 + o.backHeight/2, -0.24]));
    g.add(_box(0.50, o.backHeight * 0.85, 0.04, vel, [0, 0.54 + o.backHeight * 0.425, -0.22]));
    // armrests
    g.add(_box(0.06, 0.06, 0.4, mat, [-0.30, 0.65, 0.02]));
    g.add(_box(0.06, 0.06, 0.4, mat, [ 0.30, 0.65, 0.02]));
    // arm supports
    g.add(_box(0.06, 0.20, 0.06, mat, [-0.30, 0.56, 0.18]));
    g.add(_box(0.06, 0.20, 0.06, mat, [ 0.30, 0.56, 0.18]));
    // crown finial
    g.add(_cyl(0.04, 0.06, 0.1, M.brass(), [0, 0.52 + o.backHeight + 0.05, -0.24], 8));
    return g;
  }, {
    icon: "👑", category: "furniture",
    params: [
      { key: "backHeight", label: "Back H", type: "number", min: 0.6, max: 1.6, step: 0.1, default: 1.1 },
      { key: "color",      label: "Wood",   type: "color",  default: 0x4a2a10 },
      { key: "velvet",     label: "Velvet", type: "color",  default: 0x6a1a2a },
    ],
  });

  // ════════════════════════════════════════════════════════
  // ARCHITECTURE — WAVE 2
  // ════════════════════════════════════════════════════════

  register("map_table", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const w = o.width, d = o.depth;
    // table top
    g.add(_box(w, 0.05, d, mat, [0, 0.78, 0]));
    // legs
    for (let x = -1; x <= 1; x += 2) for (let z = -1; z <= 1; z += 2) {
      g.add(_box(0.06, 0.76, 0.06, mat, [x * (w/2 - 0.06), 0.38, z * (d/2 - 0.06)]));
    }
    // map (cream-colored plane on top)
    const mapMat = new THREE.MeshStandardMaterial({ color: 0xf0e8c8, roughness: 0.7, side: THREE.DoubleSide });
    const mapGeo = new THREE.PlaneGeometry(w * 0.85, d * 0.85);
    const map = new THREE.Mesh(mapGeo, mapMat);
    map.rotation.x = -Math.PI / 2;
    map.position.set(0, 0.81, 0);
    g.add(map);
    // scroll weight / compass rose (small brass disc)
    g.add(_cyl(0.04, 0.04, 0.01, M.brass(), [w * 0.3, 0.82, d * 0.2], 16));
    // quill
    const quill = _box(0.005, 0.005, 0.18, M.wax(0xf8f0e0), [-w * 0.25, 0.83, -d * 0.15]);
    quill.rotation.y = 0.4;
    g.add(quill);
    return g;
  }, {
    icon: "🗺️", category: "decorative",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.8, max: 2.5, step: 0.1, default: 1.4 },
      { key: "depth", label: "Depth", type: "number", min: 0.6, max: 1.8, step: 0.1, default: 1.0 },
      { key: "color", label: "Wood",  type: "color",  default: 0x5a3a20 },
    ],
  });

  register("chair", (opts = {}) => {
    const g = new THREE.Group();
    const cloth = M.cloth(_c(opts.color, 0x5a2a1a));
    const wood = M.wood(_c(opts.frameColor, 0x2c1f12));
    const W = opts.width || 0.7, D = opts.depth || 0.7;
    g.add(_box(W, 0.18, D, cloth, [0, 0.5, 0]));
    g.add(_box(W, 1.1,  0.18, cloth, [0, 1.05, -D/2+0.05]));
    g.add(_box(0.18, 0.55, D, cloth, [-W/2-0.01, 0.78, 0]));
    g.add(_box(0.18, 0.55, D, cloth, [ W/2+0.01, 0.78, 0]));
    [[-W*0.42, -D*0.42], [W*0.42, -D*0.42], [-W*0.42, D*0.42], [W*0.42, D*0.42]].forEach(([x, z]) => {
      g.add(_box(0.08, 0.5, 0.08, wood, [x, 0.25, z]));
    });
    return g;
  }, { icon: "🪑", category: "furniture", params: [
    { key: "width",      label: "Width",       type: "number", min: 0.4, max: 1.2, step: 0.05, default: 0.7 },
    { key: "depth",      label: "Depth",       type: "number", min: 0.4, max: 1.2, step: 0.05, default: 0.7 },
    { key: "color",      label: "Upholstery",  type: "color",  default: 0x5a2a1a },
    { key: "frameColor", label: "Frame",       type: "color",  default: 0x2c1f12 },
  ]});

  register("sideTable", (opts = {}) => {
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x4a3018));
    const H = opts.height || 0.6, R = opts.radius || 0.32;
    g.add(_cyl(R, R, 0.05, w, [0, H, 0], 24));
    g.add(_cyl(0.04, 0.06, H, w, [0, H/2, 0]));
    g.add(_cyl(R*0.55, R*0.7, 0.04, w, [0, 0.02, 0], 16));
    return g;
  }, { icon: "🛋", category: "furniture", params: [
    { key: "radius", label: "Top radius", type: "number", min: 0.15, max: 0.6,  step: 0.02, default: 0.32 },
    { key: "height", label: "Height",     type: "number", min: 0.3,  max: 1.0,  step: 0.05, default: 0.6  },
    { key: "color",  label: "Wood",       type: "color",  default: 0x4a3018 },
  ]});

  register("bed", (opts = {}) => {
    const W = opts.width || 1.6, L = opts.length || 2.0;
    const g = new THREE.Group();
    const frame = M.wood(_c(opts.frameColor, 0x3a2818));
    const sheet = M.cloth(_c(opts.sheetColor, 0xece4d4));
    const pillow = M.cloth(_c(opts.pillowColor, 0xf5f0e2));
    const blanket = M.cloth(_c(opts.blanketColor, 0x6a3a2a));
    g.add(_box(W+0.12, 0.32, L+0.12, frame, [0, 0.16, 0]));
    g.add(_box(W, 0.18, L, sheet, [0, 0.42, 0]));
    g.add(_box(W, 0.06, L*0.6, blanket, [0, 0.52, L*0.18]));
    g.add(_box(W*0.42, 0.10, 0.30, pillow, [-W*0.22, 0.57, -L*0.34]));
    g.add(_box(W*0.42, 0.10, 0.30, pillow, [ W*0.22, 0.57, -L*0.34]));
    g.add(_box(W+0.16, 0.9, 0.12, frame, [0, 0.55, -L/2-0.04]));
    return g;
  }, { icon: "🛏", category: "furniture", params: [
    { key: "width",        label: "Width",    type: "number", min: 0.8, max: 2.2, step: 0.05, default: 1.6 },
    { key: "length",       label: "Length",   type: "number", min: 1.6, max: 2.4, step: 0.05, default: 2.0 },
    { key: "frameColor",   label: "Frame",    type: "color",  default: 0x3a2818 },
    { key: "sheetColor",   label: "Sheets",   type: "color",  default: 0xece4d4 },
    { key: "blanketColor", label: "Blanket",  type: "color",  default: 0x6a3a2a },
    { key: "pillowColor",  label: "Pillows",  type: "color",  default: 0xf5f0e2 },
  ]});

  register("sofa", (opts = {}) => {
    const W = opts.width || 2.2, D = opts.depth || 0.95;
    const g = new THREE.Group();
    const cloth = M.cloth(_c(opts.color, 0x4a4438));
    const wood = M.wood(_c(opts.legColor, 0x2a1f12));
    g.add(_box(W, 0.30, D, cloth, [0, 0.30, 0]));
    g.add(_box(W, 0.55, D*0.45, cloth, [0, 0.72, -D*0.27]));
    g.add(_box(0.18, 0.6, D, cloth, [-W/2+0.09, 0.55, 0]));
    g.add(_box(0.18, 0.6, D, cloth, [ W/2-0.09, 0.55, 0]));
    const cushions = Math.max(1, Math.min(5, opts.cushions || 3));
    for (let i = 0; i < cushions; i++) {
      const t = cushions === 1 ? 0 : i / (cushions - 1) - 0.5;
      g.add(_box(W*(0.95/cushions), 0.16, D*0.85, cloth, [t * W * 0.9, 0.50, 0]));
    }
    [[-W*0.42,-D*0.42],[W*0.42,-D*0.42],[-W*0.42,D*0.42],[W*0.42,D*0.42]].forEach(([x,z])=>{
      g.add(_box(0.10,0.12,0.10, wood, [x, 0.06, z]));
    });
    return g;
  }, { icon: "🛋", category: "furniture", params: [
    { key: "width",    label: "Width",    type: "number", min: 1.4, max: 3.5, step: 0.1,  default: 2.2 },
    { key: "depth",    label: "Depth",    type: "number", min: 0.7, max: 1.2, step: 0.05, default: 0.95 },
    { key: "cushions", label: "Cushions", type: "int",    min: 1,   max: 5,   step: 1,    default: 3 },
    { key: "color",    label: "Upholstery", type: "color", default: 0x4a4438 },
    { key: "legColor", label: "Legs",     type: "color",  default: 0x2a1f12 },
  ]});

  register("armchair", (opts = {}) => {
    const g = new THREE.Group();
    const cloth = M.cloth(_c(opts.color, 0x5a4632));
    const wood = M.wood(_c(opts.legColor, 0x2a1f12));
    g.add(_box(0.85, 0.28, 0.85, cloth, [0, 0.32, 0]));
    g.add(_box(0.85, 0.55, 0.20, cloth, [0, 0.74, -0.32]));
    g.add(_box(0.20, 0.55, 0.85, cloth, [-0.32, 0.62, 0]));
    g.add(_box(0.20, 0.55, 0.85, cloth, [ 0.32, 0.62, 0]));
    g.add(_box(0.85, 0.18, 0.85, cloth, [0, 0.55, 0]));
    [[-0.35,-0.35],[0.35,-0.35],[-0.35,0.35],[0.35,0.35]].forEach(([x,z])=>
      g.add(_box(0.08,0.18,0.08, wood, [x, 0.09, z])));
    return g;
  }, { icon: "🪑", category: "furniture", params: [
    { key: "color",    label: "Upholstery", type: "color", default: 0x5a4632 },
    { key: "legColor", label: "Legs",       type: "color", default: 0x2a1f12 },
  ]});

  register("desk", (opts = {}) => {
    const W = opts.width || 1.6, D = opts.depth || 0.7, H = opts.height || 0.78;
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x4a3018));
    g.add(_box(W, 0.06, D, w, [0, H, 0]));
    g.add(_box(0.08, H, D, w, [-W/2+0.06, H/2, 0]));
    g.add(_box(0.08, H, D, w, [ W/2-0.06, H/2, 0]));
    if (opts.drawers !== false) {
      g.add(_box(W*0.4, 0.32, D*0.7, w, [W/2-W*0.22, H*0.7, 0]));
    }
    return g;
  }, { icon: "🪟", category: "furniture", params: [
    { key: "width",   label: "Width",   type: "number", min: 0.9, max: 2.4, step: 0.1,  default: 1.6 },
    { key: "depth",   label: "Depth",   type: "number", min: 0.5, max: 1.0, step: 0.05, default: 0.7 },
    { key: "height",  label: "Height",  type: "number", min: 0.6, max: 0.95, step: 0.02, default: 0.78 },
    { key: "drawers", label: "Drawer block", type: "bool", default: true },
    { key: "color",   label: "Wood",    type: "color",  default: 0x4a3018 },
  ]});

  register("nightstand", (opts = {}) => {
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x3a2818));
    const k = M.metal(_c(opts.knobColor, 0xbfa37a));
    g.add(_box(0.45, 0.50, 0.40, w, [0, 0.25, 0]));
    g.add(_box(0.40, 0.14, 0.36, M.wood(_c(opts.drawerColor, 0x4a3422)), [0, 0.36, 0.02]));
    g.add(_box(0.40, 0.14, 0.36, M.wood(_c(opts.drawerColor, 0x4a3422)), [0, 0.16, 0.02]));
    g.add(_sph(0.02, k, [0, 0.36, 0.21], 8));
    g.add(_sph(0.02, k, [0, 0.16, 0.21], 8));
    return g;
  }, { icon: "🗄", category: "furniture", params: [
    { key: "color",       label: "Wood",       type: "color", default: 0x3a2818 },
    { key: "drawerColor", label: "Drawer face", type: "color", default: 0x4a3422 },
    { key: "knobColor",   label: "Knobs",      type: "color", default: 0xbfa37a },
  ]});

  register("dresser", (opts = {}) => {
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x3a2818));
    const wL = M.wood(_c(opts.drawerColor, 0x4a3422));
    const k = M.metal(_c(opts.knobColor, 0xbfa37a));
    const W = opts.width || 1.4, H = opts.height || 1.0, drawers = opts.drawers || 3;
    g.add(_box(W, H, 0.5, w, [0, H/2, 0]));
    for (let r = 0; r < drawers; r++) {
      const dy = (H * 0.22) / drawers * 3;
      const y = (H * 0.22) + r * dy;
      g.add(_box(W*0.94, dy*0.85, 0.46, wL, [0, y, 0.02]));
      g.add(_sph(0.025, k, [-W*0.18, y, 0.26], 8));
      g.add(_sph(0.025, k, [ W*0.18, y, 0.26], 8));
    }
    return g;
  }, { icon: "🗃", category: "furniture", params: [
    { key: "width",       label: "Width",       type: "number", min: 0.8, max: 2.4, step: 0.1, default: 1.4 },
    { key: "height",      label: "Height",      type: "number", min: 0.7, max: 1.6, step: 0.05, default: 1.0 },
    { key: "drawers",     label: "Drawers",     type: "int",    min: 2,   max: 6,   default: 3 },
    { key: "color",       label: "Wood",        type: "color",  default: 0x3a2818 },
    { key: "drawerColor", label: "Drawer face", type: "color",  default: 0x4a3422 },
    { key: "knobColor",   label: "Knobs",      type: "color",  default: 0xbfa37a },
  ]});

  register("diningTable", (opts = {}) => {
    const W = opts.width || 2.0, D = opts.depth || 0.9;
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x3a2418));
    g.add(_box(W, 0.06, D, w, [0, 0.74, 0]));
    [[-W/2+0.1,-D/2+0.1],[W/2-0.1,-D/2+0.1],[-W/2+0.1,D/2-0.1],[W/2-0.1,D/2-0.1]]
      .forEach(([x,z]) => g.add(_box(0.08, 0.72, 0.08, w, [x, 0.36, z])));
    return g;
  }, { icon: "🍽", category: "furniture", params: [
    { key: "width", label: "Width", type: "number", min: 1.2, max: 4.0, step: 0.1, default: 2.0 },
    { key: "depth", label: "Depth", type: "number", min: 0.7, max: 1.4, step: 0.05, default: 0.9 },
    { key: "color", label: "Wood",  type: "color",  default: 0x3a2418 },
  ]});

  register("coffeeTable", (opts = {}) => {
    const W = opts.width || 1.1, D = opts.depth || 0.55;
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x2c1c10));
    g.add(_box(W, 0.05, D, w, [0, 0.4, 0]));
    g.add(_box(0.05, 0.4, D, w, [-W/2+0.025, 0.2, 0]));
    g.add(_box(0.05, 0.4, D, w, [ W/2-0.025, 0.2, 0]));
    return g;
  }, { icon: "▭", category: "furniture", params: [
    { key: "width", label: "Width", type: "number", min: 0.6, max: 1.8, step: 0.05, default: 1.1 },
    { key: "depth", label: "Depth", type: "number", min: 0.4, max: 1.0, step: 0.05, default: 0.55 },
    { key: "color", label: "Wood",  type: "color",  default: 0x2c1c10 },
  ]});

  register("stool", (opts = {}) => {
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x3a2818));
    const H = opts.height || 0.55, R = opts.radius || 0.22;
    g.add(_cyl(R, R, 0.05, w, [0, H-0.03, 0], 16));
    g.add(_cyl(0.04, 0.04, H-0.05, w, [-R*0.7, (H-0.05)/2, -R*0.4]));
    g.add(_cyl(0.04, 0.04, H-0.05, w, [ R*0.7, (H-0.05)/2, -R*0.4]));
    g.add(_cyl(0.04, 0.04, H-0.05, w, [-R*0.7, (H-0.05)/2,  R*0.4]));
    g.add(_cyl(0.04, 0.04, H-0.05, w, [ R*0.7, (H-0.05)/2,  R*0.4]));
    return g;
  }, { icon: "🪑", category: "furniture", params: [
    { key: "radius", label: "Seat radius", type: "number", min: 0.15, max: 0.35, step: 0.02, default: 0.22 },
    { key: "height", label: "Height",      type: "number", min: 0.30, max: 0.90, step: 0.02, default: 0.55 },
    { key: "color",  label: "Wood",        type: "color",  default: 0x3a2818 },
  ]});

  register("wardrobe", (opts = {}) => {
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x3a2818));
    const wD = M.wood(_c(opts.doorColor, 0x4a3422));
    const k = M.metal(_c(opts.knobColor, 0xbfa37a));
    const W = opts.width || 1.2, H = opts.height || 2.1;
    g.add(_box(W, H, 0.55, w, [0, H/2, 0]));
    g.add(_box(W/2-0.04, H-0.05, 0.02, wD, [-W/4, H/2, 0.28]));
    g.add(_box(W/2-0.04, H-0.05, 0.02, wD, [ W/4, H/2, 0.28]));
    g.add(_cyl(0.018, 0.018, 0.10, k, [-0.05, H/2, 0.30], 8));
    g.add(_cyl(0.018, 0.018, 0.10, k, [ 0.05, H/2, 0.30], 8));
    return g;
  }, { icon: "🚪", category: "furniture", params: [
    { key: "width",     label: "Width",  type: "number", min: 0.8, max: 2.0, step: 0.05, default: 1.2 },
    { key: "height",    label: "Height", type: "number", min: 1.6, max: 2.6, step: 0.05, default: 2.1 },
    { key: "color",     label: "Body",   type: "color",  default: 0x3a2818 },
    { key: "doorColor", label: "Doors",  type: "color",  default: 0x4a3422 },
    { key: "knobColor", label: "Knobs",  type: "color",  default: 0xbfa37a },
  ]});

  register("bookshelf", (opts = {}) => {
    const W = opts.width || 2.4, H = opts.height || 4.0, rows = Math.max(2, opts.rows || 5);
    const g = new THREE.Group();
    const wm = M.wood(_c(opts.color, 0x2c1f12));
    g.add(_box(W, H, 0.08, wm, [0, H / 2, 0]));
    const rowH = (H - 0.6) / rows;
    for (let r = 0; r < rows; r++) {
      g.add(_box(W, 0.05, 0.4, wm, [0, 0.5 + r * rowH, 0.18]));
    }
    return g;
  }, { icon: "📚", category: "furniture", params: [
    { key: "width",  label: "Width",  type: "number", min: 1.0, max: 4.0, step: 0.1,  default: 2.4 },
    { key: "height", label: "Height", type: "number", min: 1.5, max: 5.0, step: 0.1,  default: 4.0 },
    { key: "rows",   label: "Shelves", type: "int",   min: 2,   max: 10,  default: 5 },
    { key: "color",  label: "Wood",   type: "color",  default: 0x2c1f12 },
  ]});

  register("bench", (opts = {}) => {
    const W = opts.width || 1.6, D = opts.depth || 0.36;
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x5a3a22));
    const m = M.metal(_c(opts.legColor, 0x1a1410));
    g.add(_box(W, 0.06, D, w, [0, 0.48, 0]));
    g.add(_box(W, 0.36, 0.06, w, [0, 0.72, -D/2+0.03]));
    g.add(_box(0.06, 0.48, D, m, [-W/2+0.05, 0.24, 0]));
    g.add(_box(0.06, 0.48, D, m, [ W/2-0.05, 0.24, 0]));
    return g;
  }, { icon: "🪑", category: "outdoor", params: [
    { key: "width",    label: "Width", type: "number", min: 0.8, max: 3.0, step: 0.1, default: 1.6 },
    { key: "depth",    label: "Depth", type: "number", min: 0.3, max: 0.6, step: 0.02, default: 0.36 },
    { key: "color",    label: "Wood",  type: "color",  default: 0x5a3a22 },
    { key: "legColor", label: "Legs",  type: "color",  default: 0x1a1410 },
  ]});

  // ═══════════════════════════════════════════════════════
  // LIGHTING (visible lamp body + dynamic light)
  // ═══════════════════════════════════════════════════════

  register("throne", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const cl = M.cloth(o.cushionColor);
    const met = M.metal(0x8a7a30);
    // seat
    g.add(_box(o.seatW, 0.06, o.seatD, w, [0, o.seatH, 0]));
    // cushion
    g.add(_box(o.seatW - 0.04, 0.04, o.seatD - 0.04, cl, [0, o.seatH + 0.05, 0]));
    // legs (front)
    g.add(_box(0.06, o.seatH, 0.06, w, [-o.seatW / 2 + 0.03, o.seatH / 2, o.seatD / 2 - 0.03]));
    g.add(_box(0.06, o.seatH, 0.06, w, [o.seatW / 2 - 0.03, o.seatH / 2, o.seatD / 2 - 0.03]));
    // back legs extend to back height
    g.add(_box(0.06, o.backH, 0.06, w, [-o.seatW / 2 + 0.03, o.backH / 2, -o.seatD / 2 + 0.03]));
    g.add(_box(0.06, o.backH, 0.06, w, [o.seatW / 2 - 0.03, o.backH / 2, -o.seatD / 2 + 0.03]));
    // back panel
    g.add(_box(o.seatW, o.backH - o.seatH - 0.06, 0.04, w,
      [0, o.seatH + (o.backH - o.seatH) / 2, -o.seatD / 2 + 0.03]));
    // back cushion
    g.add(_box(o.seatW - 0.06, (o.backH - o.seatH) * 0.6, 0.03, cl,
      [0, o.seatH + (o.backH - o.seatH) * 0.35, -o.seatD / 2 + 0.06]));
    // finials on top
    g.add(_sph(0.03, met, [-o.seatW / 2 + 0.03, o.backH + 0.03, -o.seatD / 2 + 0.03], 6));
    g.add(_sph(0.03, met, [o.seatW / 2 - 0.03, o.backH + 0.03, -o.seatD / 2 + 0.03], 6));
    // arm rests
    g.add(_box(0.04, 0.04, o.seatD, w, [-o.seatW / 2 + 0.03, o.seatH + 0.25, 0]));
    g.add(_box(0.04, 0.04, o.seatD, w, [o.seatW / 2 - 0.03, o.seatH + 0.25, 0]));
    // arm rest supports
    g.add(_box(0.04, 0.25, 0.04, w, [-o.seatW / 2 + 0.03, o.seatH + 0.125, o.seatD / 2 - 0.03]));
    g.add(_box(0.04, 0.25, 0.04, w, [o.seatW / 2 - 0.03, o.seatH + 0.125, o.seatD / 2 - 0.03]));
    return g;
  }, {
    icon: "👑", category: "props",
    params: [
      { key: "seatW", label: "Seat W", type: "number", min: 0.4, max: 0.8, step: 0.05, default: 0.55 },
      { key: "seatD", label: "Seat D", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.45 },
      { key: "seatH", label: "Seat H", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.45 },
      { key: "backH", label: "Back H", type: "number", min: 0.8, max: 1.6, step: 0.1, default: 1.2 },
      { key: "color", label: "Wood", type: "color", default: 0x3a2010 },
      { key: "cushionColor", label: "Cushion", type: "color", default: 0x8a1020 },
    ],
  });

  register("bookshelf_tall", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // frame
    g.add(_box(0.03, o.height, o.depth, w, [-o.width / 2, o.height / 2, 0]));
    g.add(_box(0.03, o.height, o.depth, w, [o.width / 2, o.height / 2, 0]));
    g.add(_box(o.width, 0.03, o.depth, w, [0, o.height, 0]));
    g.add(_box(o.width, 0.03, o.depth, w, [0, 0.02, 0]));
    // back panel
    g.add(_box(o.width, o.height, 0.01, w, [0, o.height / 2, -o.depth / 2 + 0.005]));
    // shelves
    const shelves = Math.floor(o.height / 0.3);
    for (let s = 1; s < shelves; s++) {
      g.add(_box(o.width - 0.04, 0.02, o.depth, w, [0, s * 0.3, 0]));
    }
    // books on shelves
    for (let s = 0; s < shelves; s++) {
      const y = 0.04 + s * 0.3;
      const bookCount = Math.floor(rand(3, o.width / 0.035));
      let xPos = -o.width / 2 + 0.04;
      for (let b = 0; b < bookCount && xPos < o.width / 2 - 0.04; b++) {
        const bookW = rand(0.02, 0.04);
        const bookH = rand(0.18, 0.26);
        g.add(_box(bookW, bookH, o.depth * 0.7,
          M.cloth(pick([0x8a2020, 0x2a3a6a, 0x3a5a2a, 0x6a4a20, 0x4a2050, 0x1a4a4a])),
          [xPos + bookW / 2, y + bookH / 2, 0.02]));
        xPos += bookW + 0.003;
      }
    }
    return g;
  }, {
    icon: "📚", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.8 },
      { key: "height", label: "Height", type: "number", min: 1.0, max: 2.5, step: 0.2, default: 1.8 },
      { key: "depth", label: "Depth", type: "number", min: 0.15, max: 0.35, step: 0.03, default: 0.22 },
      { key: "color", label: "Color", type: "color", default: 0x4a2818 },
    ],
  });

  register("chair", function ({ color = 0x5a2a1a } = {}) {
  const g = new THREE.Group();
  const cloth = M.cloth(color);
  const wood = M.wood(0x2c1f12);
  g.add(_box(0.7, 0.18, 0.7, cloth, [0, 0.5, 0]));
  g.add(_box(0.7, 1.1,  0.18, cloth, [0, 1.05, -0.35]));
  g.add(_box(0.18, 0.55, 0.7, cloth, [-0.36, 0.78, 0]));
  g.add(_box(0.18, 0.55, 0.7, cloth, [ 0.36, 0.78, 0]));
  [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(([x, z]) => {
    g.add(_box(0.08, 0.5, 0.08, wood, [x, 0.25, z]));
  });
  return g;
}, { category: "furniture" });

  register("sideTable", function ({ height = 0.6, radius = 0.32 } = {}) {
  const g = new THREE.Group();
  const w = M.wood(0x4a3018);
  g.add(_cyl(radius, radius, 0.05, w, [0, height, 0], 24));
  g.add(_cyl(0.04, 0.06, height, w, [0, height / 2, 0]));
  g.add(_cyl(0.18, 0.22, 0.04, w, [0, 0.02, 0], 16));
  return g;
}, { category: "furniture" });

  register("bench", function ({ length = 1.6, color = 0x4a3220 } = {}) {
  const g = new THREE.Group();
  const wm = M.wood(color);
  g.add(_box(length, 0.08, 0.4, wm, [0, 0.45, 0]));
  g.add(_box(length, 0.5,  0.06, wm, [0, 0.74, -0.17]));
  g.add(_box(0.06, 0.45, 0.4, wm, [-length / 2 + 0.05, 0.225, 0]));
  g.add(_box(0.06, 0.45, 0.4, wm, [ length / 2 - 0.05, 0.225, 0]));
  return g;
}, { category: "furniture" });

  register("bookshelf", function ({ width = 2.4, height = 4.0, rows = 5, palette } = {}) {
  const g = new THREE.Group();
  const wm = M.wood(0x2c1f12);
  g.add(_box(width, height, 0.08, wm, [0, height / 2, 0]));
  const rowH = (height - 0.6) / rows;
  for (let r = 0; r < rows; r++) {
    g.add(_box(width, 0.05, 0.4, wm, [0, 0.5 + r * rowH, 0.18]));
  }
  const wall = OBJECTS.create("bookwall", { width, height: rowH * rows, rows, palette });
  wall.position.set(0, 0.55, 0.22);
  g.add(wall);
  return g;
}, { category: "furniture" });

})();
