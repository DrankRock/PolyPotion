// category: "arch"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("door_frame", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const hw = o.width / 2;
    // jambs
    g.add(_box(0.10, o.height, 0.14, w, [-hw, o.height / 2, 0]));
    g.add(_box(0.10, o.height, 0.14, w, [ hw, o.height / 2, 0]));
    // lintel
    g.add(_box(o.width + 0.20, 0.14, 0.14, w, [0, o.height + 0.07, 0]));
    // door panel (slightly ajar)
    if (o.hasDoor) {
      const door = _box(o.width - 0.04, o.height - 0.06, 0.05, M.wood(o.doorColor));
      door.position.set(-hw + 0.02, o.height / 2, 0);
      // pivot from left edge
      door.geometry.translate(o.width / 2 - 0.02, 0, 0);
      door.rotation.y = o.openAngle;
      g.add(door);
      // handle
      const handle = _cyl(0.015, 0.015, 0.08, M.brass(), [0, 0, 0], 8);
      handle.rotation.x = Math.PI / 2;
      handle.position.set(o.width - 0.18, o.height * 0.48, 0.06);
      door.add(handle);
    }
    return g;
  }, {
    icon: "🚪", category: "architecture",
    params: [
      { key: "width",     label: "Width",  type: "number", min: 0.6, max: 1.8, step: 0.1,  default: 0.95 },
      { key: "height",    label: "Height", type: "number", min: 1.8, max: 3.0, step: 0.1,  default: 2.2 },
      { key: "hasDoor",   label: "Door",   type: "bool",   default: true },
      { key: "openAngle", label: "Open",   type: "number", min: 0,   max: 1.5, step: 0.1,  default: 0.5 },
      { key: "color",     label: "Frame",  type: "color",  default: 0x3a2818 },
      { key: "doorColor", label: "Door",   type: "color",  default: 0x4a3220 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // DECORATIVE
  // ════════════════════════════════════════════════════════

  register("window_frame", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const w = o.width, h = o.height;
    // frame
    g.add(_box(w, 0.06, 0.06, mat, [0, h/2 + h/2, 0]));  // top
    g.add(_box(w, 0.06, 0.06, mat, [0, h/2 - h/2, 0]));  // bottom (sill)
    g.add(_box(0.06, h, 0.06, mat, [-w/2, h/2, 0]));
    g.add(_box(0.06, h, 0.06, mat, [ w/2, h/2, 0]));
    // cross bar
    g.add(_box(w - 0.06, 0.04, 0.04, mat, [0, h/2, 0]));
    g.add(_box(0.04, h - 0.06, 0.04, mat, [0, h/2, 0]));
    // glass panes
    const gl = M.glass(o.glassColor);
    g.add(_box(w/2 - 0.05, h/2 - 0.05, 0.01, gl, [-w/4, h * 0.75, 0]));
    g.add(_box(w/2 - 0.05, h/2 - 0.05, 0.01, gl, [ w/4, h * 0.75, 0]));
    g.add(_box(w/2 - 0.05, h/2 - 0.05, 0.01, gl, [-w/4, h * 0.25, 0]));
    g.add(_box(w/2 - 0.05, h/2 - 0.05, 0.01, gl, [ w/4, h * 0.25, 0]));
    return g;
  }, {
    icon: "🪟", category: "architecture",
    params: [
      { key: "width",      label: "Width",  type: "number", min: 0.5, max: 2.0, step: 0.1, default: 0.9 },
      { key: "height",     label: "Height", type: "number", min: 0.6, max: 2.5, step: 0.1, default: 1.4 },
      { key: "color",      label: "Frame",  type: "color",  default: 0x6b4a2b },
      { key: "glassColor", label: "Glass",  type: "color",  default: 0x88aac0 },
    ],
  });

  register("spiral_stair", function (o) {
    const g = new THREE.Group();
    const mat = M.metal(o.color);
    const wMat = M.wood(o.stepColor);
    const steps = o.steps;
    const h = o.height;
    const r = o.radius;
    // central pole
    g.add(_cyl(0.04, 0.04, h, mat, [0, h/2, 0], 12));
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2 * o.turns;
      const y = (i / steps) * h;
      const step = _box(r, 0.04, 0.28, wMat, [r/2, 0, 0]);
      const pivot = new THREE.Group();
      pivot.add(step);
      pivot.position.set(0, y, 0);
      pivot.rotation.y = angle;
      g.add(pivot);
      // railing post
      const post = _cyl(0.015, 0.015, 0.6, mat, [r, 0.3, 0], 6);
      pivot.add(post);
    }
    return g;
  }, {
    icon: "🌀", category: "architecture",
    params: [
      { key: "steps",     label: "Steps",    type: "int",    min: 6,   max: 30,  default: 14 },
      { key: "height",    label: "Height",   type: "number", min: 1.5, max: 5.0, step: 0.25, default: 3.0 },
      { key: "radius",    label: "Radius",   type: "number", min: 0.4, max: 1.5, step: 0.1,  default: 0.7 },
      { key: "turns",     label: "Turns",    type: "number", min: 0.5, max: 3.0, step: 0.25, default: 1.0 },
      { key: "color",     label: "Rail",     type: "color",  default: 0x2a2520 },
      { key: "stepColor", label: "Steps",    type: "color",  default: 0x6b4a2b },
    ],
  });

  register("wall_segment", function (o) {
    const g = new THREE.Group();
    const mat = M.stone(o.color);
    g.add(_box(o.width, o.height, o.thickness, mat, [0, o.height/2, 0]));
    // crenellations
    if (o.crenellated) {
      const count = Math.floor(o.width / 0.3);
      for (let i = 0; i < count; i += 2) {
        const x = -o.width/2 + 0.15 + i * (o.width / count);
        g.add(_box(o.width / count * 0.8, 0.25, o.thickness, mat, [x, o.height + 0.125, 0]));
      }
    }
    return g;
  }, {
    icon: "🧱", category: "architecture",
    params: [
      { key: "width",       label: "Width",    type: "number", min: 1.0, max: 6.0, step: 0.5,  default: 3.0 },
      { key: "height",      label: "Height",   type: "number", min: 1.0, max: 5.0, step: 0.25, default: 2.5 },
      { key: "thickness",   label: "Thick",    type: "number", min: 0.1, max: 0.8, step: 0.05, default: 0.3 },
      { key: "crenellated", label: "Crenellated", type: "bool", default: true },
      { key: "color",       label: "Stone",    type: "color",  default: 0x5a5048 },
    ],
  });

  register("staircase", (opts = {}) => {
    const g = new THREE.Group();
    const steps     = Math.max(2, opts.steps || 6);
    const stepW     = opts.stepWidth || 1.2;
    const stepH     = opts.stepHeight || 0.16;
    const stepD     = opts.stepDepth || 0.4;
    const w = M.wood(_c(opts.color, 0x4a3018));
    for (let i = 0; i < steps; i++) {
      g.add(_box(stepW, stepH, stepD, w, [0, stepH/2 + i*stepH, i*stepD]));
    }
    if (opts.railing) {
      const r = M.metal(_c(opts.railingColor, 0x2a2018));
      const totalRise = steps * stepH;
      const totalRun  = steps * stepD;
      [[-stepW/2, 0], [stepW/2, 0]].forEach(([x, _z]) => {
        for (let i = 0; i < steps; i += 1) {
          g.add(_cyl(0.015, 0.015, 0.6, r, [x, stepH*i + 0.3 + stepH/2, i*stepD], 8));
        }
        const handrail = _box(0.025, 0.025, Math.hypot(totalRun, totalRise) + 0.1, r,
          [x, totalRise/2 + 0.5, totalRun/2 - stepD/2]);
        handrail.rotation.x = -Math.atan2(totalRise, totalRun);
        g.add(handrail);
      });
    }
    return g;
  }, { icon: "📐", category: "architecture", params: [
    { key: "steps",        label: "Steps",       type: "int",    min: 2,    max: 30,  default: 6 },
    { key: "stepWidth",    label: "Step width",  type: "number", min: 0.4,  max: 4.0, step: 0.1,  default: 1.2 },
    { key: "stepHeight",   label: "Step rise",   type: "number", min: 0.08, max: 0.25, step: 0.01, default: 0.16 },
    { key: "stepDepth",    label: "Step run",    type: "number", min: 0.2,  max: 0.6,  step: 0.02, default: 0.4 },
    { key: "railing",      label: "Railing",     type: "bool",   default: false },
    { key: "color",        label: "Wood",        type: "color",  default: 0x4a3018 },
    { key: "railingColor", label: "Railing color", type: "color", default: 0x2a2018 },
  ]});

  register("column", (opts = {}) => {
    const H = opts.height || 3.0;
    const R = opts.radius || 0.22;
    const cap = opts.capSize || 0.55;
    const g = new THREE.Group();
    const stone = M.stone(_c(opts.color, 0xc4b9a2));
    g.add(_box(cap, 0.10, cap, stone, [0, 0.05, 0]));
    g.add(_cyl(R, R, H-0.30, stone, [0, H/2, 0], 24));
    g.add(_box(cap, 0.12, cap, stone, [0, H-0.06, 0]));
    return g;
  }, { icon: "🏛", category: "architecture", params: [
    { key: "height",  label: "Height",   type: "number", min: 1.5, max: 6.0, step: 0.1, default: 3.0 },
    { key: "radius",  label: "Radius",   type: "number", min: 0.12, max: 0.5, step: 0.02, default: 0.22 },
    { key: "capSize", label: "Cap size", type: "number", min: 0.3,  max: 0.9, step: 0.05, default: 0.55 },
    { key: "color",   label: "Stone",    type: "color",  default: 0xc4b9a2 },
  ]});

  register("archway", (opts = {}) => {
    const W = opts.width || 1.7, H = opts.height || 2.55, thick = opts.thickness || 0.30;
    const g = new THREE.Group();
    const stone = M.stone(_c(opts.color, 0xc4b9a2));
    g.add(_box(thick, H, 0.40, stone, [-W/2-thick/2, H/2, 0]));
    g.add(_box(thick, H, 0.40, stone, [ W/2+thick/2, H/2, 0]));
    g.add(_box(W+thick*2, thick, 0.40, stone, [0, H+thick/2, 0]));
    g.add(_tor(W/2, 0.15, stone, [0, H, 0], 12, 24));
    return g;
  }, { icon: "🏛", category: "architecture", params: [
    { key: "width",     label: "Opening",  type: "number", min: 0.8, max: 3.5, step: 0.1, default: 1.7 },
    { key: "height",    label: "Height",   type: "number", min: 1.8, max: 4.0, step: 0.1, default: 2.55 },
    { key: "thickness", label: "Pillar",   type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.30 },
    { key: "color",     label: "Stone",    type: "color",  default: 0xc4b9a2 },
  ]});

  register("doorFrame", (opts = {}) => {
    const W = opts.width || 1.0, H = opts.height || 2.2;
    const g = new THREE.Group();
    const w = M.wood(_c(opts.color, 0x2a1810));
    g.add(_box(0.10, H, 0.12, w, [-W/2, H/2, 0]));
    g.add(_box(0.10, H, 0.12, w, [ W/2, H/2, 0]));
    g.add(_box(W+0.10, 0.12, 0.12, w, [0, H-0.06, 0]));
    return g;
  }, { icon: "🚪", category: "architecture", params: [
    { key: "width",  label: "Width",  type: "number", min: 0.6, max: 1.8, step: 0.05, default: 1.0 },
    { key: "height", label: "Height", type: "number", min: 1.8, max: 2.6, step: 0.05, default: 2.2 },
    { key: "color",  label: "Wood",   type: "color",  default: 0x2a1810 },
  ]});

  register("beam", (opts = {}) => {
    const L = opts.length || 4.0, S = opts.size || 0.18;
    return _box(S, S, L, M.wood(_c(opts.color, 0x2a1810)), [0, 0, 0]);
  }, { icon: "▬", category: "architecture", params: [
    { key: "length", label: "Length",    type: "number", min: 1, max: 10, step: 0.1, default: 4.0 },
    { key: "size",   label: "Thickness", type: "number", min: 0.08, max: 0.4, step: 0.02, default: 0.18 },
    { key: "color",  label: "Wood",      type: "color",  default: 0x2a1810 },
  ]});

  register("pillar", (opts = {}) => {
    return _cyl(opts.radius || 0.18, opts.radius || 0.18, opts.height || 3.0,
      M.wood(_c(opts.color, 0x2a1810)), [0, (opts.height||3.0)/2, 0], 10);
  }, { icon: "│", category: "architecture", params: [
    { key: "height", label: "Height", type: "number", min: 1.0, max: 6.0, step: 0.1, default: 3.0 },
    { key: "radius", label: "Radius", type: "number", min: 0.08, max: 0.4, step: 0.02, default: 0.18 },
    { key: "color",  label: "Wood",   type: "color",  default: 0x2a1810 },
  ]});

  // ═══════════════════════════════════════════════════════
  // STORAGE / OUTDOOR
  // ═══════════════════════════════════════════════════════

  register("cobblestone_path", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // base slab
    g.add(_box(o.width, 0.04, o.length, st, [0, 0.02, 0]));
    // cobble rows
    const rows = Math.floor(o.length / 0.18);
    const cols = Math.floor(o.width / 0.16);
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * 0.08;
      for (let c = 0; c < cols; c++) {
        const x = -o.width / 2 + 0.08 + c * 0.16 + offset;
        const z = -o.length / 2 + 0.09 + r * 0.18;
        if (x > o.width / 2 - 0.05) continue;
        const sw = rand(0.08, 0.12), sd = rand(0.1, 0.14);
        g.add(_box(sw, 0.025, sd, M.stone(_c(o.color) + Math.floor(rand(-8, 8))),
          [x, 0.055, z]));
      }
    }
    return g;
  }, {
    icon: "🛤️", category: "road",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.8, max: 4.0, step: 0.2, default: 1.5 },
      { key: "length", label: "Length", type: "number", min: 1.0, max: 8.0, step: 0.5, default: 3.0 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a5248 },
    ],
  });

  register("dirt_road", function (o) {
    const g = new THREE.Group();
    const dirt = M.stone(o.color);
    // main road surface
    g.add(_box(o.width, 0.05, o.length, dirt, [0, 0.025, 0]));
    // ruts (two shallow grooves)
    const rutMat = M.stone(o.color - 0x0a0a0a);
    g.add(_box(0.12, 0.02, o.length, rutMat, [-o.width * 0.25, 0.06, 0]));
    g.add(_box(0.12, 0.02, o.length, rutMat, [o.width * 0.25, 0.06, 0]));
    // scattered pebbles
    for (let i = 0; i < 12; i++) {
      const x = rand(-o.width / 2 + 0.1, o.width / 2 - 0.1);
      const z = rand(-o.length / 2 + 0.1, o.length / 2 - 0.1);
      g.add(_sph(rand(0.015, 0.03), M.stone(0x6a6258), [x, 0.06, z], 5));
    }
    return g;
  }, {
    icon: "🛣️", category: "road",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 1.0, max: 5.0, step: 0.3, default: 2.0 },
      { key: "length", label: "Length", type: "number", min: 2.0, max: 10.0, step: 0.5, default: 4.0 },
      { key: "color",  label: "Color",  type: "color",  default: 0x6a5a40 },
    ],
  });

  register("wooden_gate", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(o.metalColor);
    // two posts
    g.add(_box(0.15, o.height, 0.15, w, [-o.width / 2, o.height / 2, 0]));
    g.add(_box(0.15, o.height, 0.15, w, [o.width / 2, o.height / 2, 0]));
    // post caps
    g.add(_cone(0.12, 0.15, w, [-o.width / 2, o.height + 0.075, 0], 4));
    g.add(_cone(0.12, 0.15, w, [o.width / 2, o.height + 0.075, 0], 4));
    // gate planks
    const planks = 6;
    const pw = (o.width - 0.2) / planks;
    for (let i = 0; i < planks; i++) {
      const x = -o.width / 2 + 0.1 + pw / 2 + i * pw;
      const h = o.height * 0.7 + Math.sin((i / planks) * Math.PI) * 0.15;
      g.add(_box(pw - 0.01, h, 0.04, w, [x, h / 2, 0]));
    }
    // horizontal braces
    g.add(_box(o.width - 0.2, 0.06, 0.05, w, [0, o.height * 0.2, 0]));
    g.add(_box(o.width - 0.2, 0.06, 0.05, w, [0, o.height * 0.55, 0]));
    // hinges
    g.add(_box(0.08, 0.04, 0.06, met, [-o.width / 2 + 0.12, o.height * 0.2, 0.03]));
    g.add(_box(0.08, 0.04, 0.06, met, [-o.width / 2 + 0.12, o.height * 0.55, 0.03]));
    return g;
  }, {
    icon: "🚪", category: "structure",
    params: [
      { key: "width",      label: "Width",  type: "number", min: 1.0, max: 3.0, step: 0.2,  default: 1.8 },
      { key: "height",     label: "Height", type: "number", min: 1.5, max: 3.5, step: 0.2,  default: 2.2 },
      { key: "color",      label: "Wood",   type: "color",  default: 0x4a3018 },
      { key: "metalColor", label: "Metal",  type: "color",  default: 0x2a2520 },
    ],
  });

  register("stone_arch", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // two pillars
    g.add(_box(o.thickness, o.height, o.depth, st, [-o.width / 2, o.height / 2, 0]));
    g.add(_box(o.thickness, o.height, o.depth, st, [o.width / 2, o.height / 2, 0]));
    // arch (half torus)
    const archR = o.width / 2;
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(archR, o.thickness / 2, 8, 24, Math.PI),
      st
    );
    arch.position.y = o.height;
    arch.rotation.z = -Math.PI / 2;
    arch.scale.z = o.depth / o.thickness;
    g.add(arch);
    // keystone
    g.add(_box(o.thickness * 1.2, o.thickness * 1.3, o.depth, st, [0, o.height + archR, 0]));
    return g;
  }, {
    icon: "🏛️", category: "structure",
    params: [
      { key: "width",     label: "Width",     type: "number", min: 1.0, max: 4.0, step: 0.2,  default: 2.0 },
      { key: "height",    label: "Height",    type: "number", min: 1.5, max: 4.0, step: 0.3,  default: 2.5 },
      { key: "thickness", label: "Thickness", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
      { key: "depth",     label: "Depth",     type: "number", min: 0.3, max: 1.0, step: 0.1,  default: 0.5 },
      { key: "color",     label: "Color",     type: "color",  default: 0x6a6258 },
    ],
  });

  register("wooden_stairs_ext", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const stepH = o.height / o.steps;
    const stepD = o.depth / o.steps;
    for (let i = 0; i < o.steps; i++) {
      // tread
      g.add(_box(o.width, 0.04, stepD, w, [0, stepH * (i + 0.5), stepD * i + stepD / 2]));
      // riser
      g.add(_box(o.width, stepH, 0.03, w, [0, stepH * i + stepH / 2, stepD * i]));
    }
    // side stringers
    const totalLen = Math.sqrt(o.height * o.height + o.depth * o.depth);
    const angle = Math.atan2(o.height, o.depth);
    for (let side = -1; side <= 1; side += 2) {
      const stringer = _box(0.06, totalLen, 0.04, w, [side * o.width / 2, o.height / 2, o.depth / 2]);
      stringer.rotation.x = -angle;
      g.add(stringer);
    }
    return g;
  }, {
    icon: "🪜", category: "structure",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.6, max: 2.0, step: 0.2,  default: 1.0 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 3.0, step: 0.3,  default: 1.5 },
      { key: "depth",  label: "Depth",  type: "number", min: 0.8, max: 3.0, step: 0.3,  default: 1.8 },
      { key: "steps",  label: "Steps",  type: "int",    min: 3,   max: 12,  default: 6 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a3a1a },
    ],
  });

  register("brick_road", function (o) {
    const g = new THREE.Group();
    const base = M.stone(o.color);
    g.add(_box(o.width, 0.03, o.length, base, [0, 0.015, 0]));
    const rows = Math.floor(o.length / 0.12);
    const cols = Math.floor(o.width / 0.22);
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 0.11;
      for (let c = 0; c < cols; c++) {
        const x = -o.width / 2 + 0.11 + c * 0.22 + off;
        if (x > o.width / 2 - 0.05) continue;
        const v = Math.floor(rand(-6, 6));
        g.add(_box(0.2, 0.02, 0.1, M.stone(_c(o.color) + v), [x, 0.04, -o.length / 2 + 0.06 + r * 0.12]));
      }
    }
    return g;
  }, {
    icon: "🧱", category: "road",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.0, max: 5.0, step: 0.3, default: 2.0 },
      { key: "length", label: "Length", type: "number", min: 1.0, max: 10.0, step: 0.5, default: 4.0 },
      { key: "color", label: "Color", type: "color", default: 0x8a4028 },
    ],
  });

  register("gravel_path", function (o) {
    const g = new THREE.Group();
    g.add(_box(o.width, 0.03, o.length, M.stone(o.color), [0, 0.015, 0]));
    for (let i = 0; i < 60; i++) {
      const x = rand(-o.width / 2 + 0.05, o.width / 2 - 0.05);
      const z = rand(-o.length / 2 + 0.05, o.length / 2 - 0.05);
      g.add(_sph(rand(0.01, 0.025), M.stone(_c(o.color) + Math.floor(rand(-10, 10))),
        [x, 0.035, z], 4));
    }
    // edge stones
    for (let z = -o.length / 2; z < o.length / 2; z += 0.2) {
      g.add(_sph(rand(0.03, 0.05), M.stone(0x5a5248), [-o.width / 2 - 0.02, 0.03, z], 5));
      g.add(_sph(rand(0.03, 0.05), M.stone(0x5a5248), [o.width / 2 + 0.02, 0.03, z], 5));
    }
    return g;
  }, {
    icon: "🛤️", category: "road",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.6, max: 3.0, step: 0.2, default: 1.2 },
      { key: "length", label: "Length", type: "number", min: 1.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "color", label: "Color", type: "color", default: 0x7a6a50 },
    ],
  });

  register("road_crossroads", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // + shape
    g.add(_box(o.size, 0.04, o.roadW, st, [0, 0.02, 0]));
    g.add(_box(o.roadW, 0.04, o.size, st, [0, 0.02, 0]));
    // center cobbles
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0, o.roadW / 3);
      g.add(_box(rand(0.08, 0.14), 0.025, rand(0.08, 0.14),
        M.stone(_c(o.color) + Math.floor(rand(-8, 8))),
        [Math.cos(a) * d, 0.055, Math.sin(a) * d]));
    }
    return g;
  }, {
    icon: "✚", category: "road",
    params: [
      { key: "size", label: "Size", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "roadW", label: "Road W", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
      { key: "color", label: "Color", type: "color", default: 0x5a5248 },
    ],
  });

  register("road_curve", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    const segs = 12;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI / 2;
      const x = Math.cos(a) * o.radius;
      const z = Math.sin(a) * o.radius;
      const piece = _box(o.roadW, 0.04, o.radius * Math.PI / 2 / segs + 0.02, st, [x, 0.02, z]);
      piece.rotation.y = -a;
      g.add(piece);
    }
    return g;
  }, {
    icon: "↩️", category: "road",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 1.0, max: 6.0, step: 0.5, default: 3.0 },
      { key: "roadW", label: "Road W", type: "number", min: 0.8, max: 3.0, step: 0.2, default: 1.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a5248 },
    ],
  });

  register("wooden_walkway", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const planks = Math.floor(o.length / 0.14);
    for (let i = 0; i < planks; i++) {
      const z = -o.length / 2 + 0.07 + i * 0.14;
      g.add(_box(o.width, 0.035, 0.12, w, [0, o.height, z]));
    }
    g.add(_box(0.06, 0.04, o.length, w, [-o.width / 2 + 0.03, o.height - 0.02, 0]));
    g.add(_box(0.06, 0.04, o.length, w, [o.width / 2 - 0.03, o.height - 0.02, 0]));
    // supports every 1m
    const sups = Math.max(2, Math.floor(o.length / 1.0));
    for (let i = 0; i < sups; i++) {
      const z = -o.length / 2 + 0.3 + i * (o.length - 0.6) / (sups - 1);
      g.add(_cyl(0.03, 0.04, o.height, w, [-o.width / 2 + 0.03, o.height / 2, z], 6));
      g.add(_cyl(0.03, 0.04, o.height, w, [o.width / 2 - 0.03, o.height / 2, z], 6));
    }
    return g;
  }, {
    icon: "🪵", category: "road",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.6, max: 2.5, step: 0.2, default: 1.2 },
      { key: "length", label: "Length", type: "number", min: 1.0, max: 8.0, step: 0.5, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 0.1, max: 1.0, step: 0.1, default: 0.3 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("stone_steps", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    const stepH = o.height / o.steps;
    const stepD = o.depth / o.steps;
    for (let i = 0; i < o.steps; i++) {
      g.add(_box(o.width, stepH * (i + 1), stepD, st,
        [0, stepH * (i + 1) / 2, -o.depth / 2 + stepD / 2 + i * stepD]));
    }
    return g;
  }, {
    icon: "🪜", category: "road",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.0 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 3.0, step: 0.3, default: 1.5 },
      { key: "depth", label: "Depth", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.0 },
      { key: "steps", label: "Steps", type: "int", min: 3, max: 12, default: 5 },
      { key: "color", label: "Color", type: "color", default: 0x6a6258 },
    ],
  });

  // ─── TERRAIN & LANDSCAPE ──────────────────────────────────────

  register("garden_path_curved", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    const segs = 20;
    for (let i = 0; i < segs; i++) {
      const t = i / segs;
      const x = t * o.length - o.length / 2;
      const z = Math.sin(t * Math.PI * o.curves) * o.amplitude;
      g.add(_cyl(o.pathW / 2, o.pathW / 2, 0.03, st, [x, 0.015, z], 8));
      // pebbles along
      for (let p = 0; p < 2; p++) {
        g.add(_sph(rand(0.015, 0.025), M.stone(_c(o.color) + Math.floor(rand(-8, 8))),
          [x + rand(-o.pathW / 3, o.pathW / 3), 0.03, z + rand(-o.pathW / 3, o.pathW / 3)], 4));
      }
    }
    return g;
  }, {
    icon: "🛤️", category: "road",
    params: [
      { key: "length", label: "Length", type: "number", min: 2.0, max: 10.0, step: 0.5, default: 5.0 },
      { key: "pathW", label: "Path W", type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.6 },
      { key: "curves", label: "Curves", type: "int", min: 1, max: 4, default: 2 },
      { key: "amplitude", label: "Amplitude", type: "number", min: 0.3, max: 2.0, step: 0.2, default: 0.8 },
      { key: "color", label: "Color", type: "color", default: 0x6a6258 },
    ],
  });

  register("dungeon_door", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.stoneColor);
    const w = M.wood(o.woodColor);
    const met = M.metal(0x3a3a3a);
    // stone frame
    g.add(_box(o.frameW, o.height, o.thickness, st, [-o.doorW / 2 - o.frameW / 2, o.height / 2, 0]));
    g.add(_box(o.frameW, o.height, o.thickness, st, [o.doorW / 2 + o.frameW / 2, o.height / 2, 0]));
    g.add(_box(o.doorW + o.frameW * 2, o.frameW, o.thickness, st, [0, o.height - o.frameW / 2, 0]));
    // wooden door
    g.add(_box(o.doorW, o.height - o.frameW, 0.04, w, [0, (o.height - o.frameW) / 2, 0]));
    // iron bands
    for (let i = 0; i < 3; i++) {
      g.add(_box(o.doorW + 0.02, 0.03, 0.045, met,
        [0, o.height * (0.2 + i * 0.25), 0]));
    }
    // ring handle
    g.add(_tor(0.04, 0.006, met, [0, o.height * 0.45, 0.03], 8, 4));
    // studs
    for (let r = 0; r < 3; r++) {
      for (let c = -1; c <= 1; c += 2) {
        g.add(_sph(0.012, met, [c * o.doorW * 0.3, o.height * (0.2 + r * 0.25), 0.025], 4));
      }
    }
    // lock plate
    g.add(_box(0.04, 0.06, 0.01, met, [o.doorW * 0.35, o.height * 0.45, 0.025]));
    g.add(_cyl(0.008, 0.008, 0.02, met, [o.doorW * 0.35, o.height * 0.43, 0.03], 6));
    return g;
  }, {
    icon: "🚪", category: "structure",
    params: [
      { key: "doorW", label: "Door W", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 0.9 },
      { key: "height", label: "Height", type: "number", min: 1.5, max: 3.0, step: 0.2, default: 2.0 },
      { key: "frameW", label: "Frame W", type: "number", min: 0.1, max: 0.3, step: 0.05, default: 0.15 },
      { key: "thickness", label: "Thickness", type: "number", min: 0.08, max: 0.2, step: 0.03, default: 0.12 },
      { key: "stoneColor", label: "Stone", type: "color", default: 0x4a4038 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x3a2818 },
    ],
  });

  register("spiral_staircase", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // central pillar
    g.add(_cyl(o.pillarR, o.pillarR, o.height, st, [0, o.height / 2, 0], 10));
    // steps spiraling around
    const steps = o.steps;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2 * o.turns;
      const y = (i / steps) * o.height;
      const stepW = o.stepW;
      const step = _box(stepW, 0.08, 0.25, st,
        [Math.cos(a) * (o.pillarR + stepW / 2), y, Math.sin(a) * (o.pillarR + stepW / 2)]);
      step.rotation.y = -a;
      g.add(step);
    }
    return g;
  }, {
    icon: "🪜", category: "structure",
    params: [
      { key: "height", label: "Height", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "pillarR", label: "Pillar R", type: "number", min: 0.1, max: 0.3, step: 0.03, default: 0.15 },
      { key: "stepW", label: "Step W", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "steps", label: "Steps", type: "int", min: 8, max: 30, default: 16 },
      { key: "turns", label: "Turns", type: "number", min: 0.5, max: 3.0, step: 0.25, default: 1.5 },
      { key: "color", label: "Color", type: "color", default: 0x6a6258 },
    ],
  });

  register("archway", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // pillars
    g.add(_box(o.pillarW, o.height, o.pillarW, st, [-o.span / 2 - o.pillarW / 2, o.height / 2, 0]));
    g.add(_box(o.pillarW, o.height, o.pillarW, st, [o.span / 2 + o.pillarW / 2, o.height / 2, 0]));
    // arch
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(o.span / 2, o.pillarW / 2, 6, 16, Math.PI), st);
    arch.position.set(0, o.height, 0);
    arch.rotation.z = -Math.PI / 2;
    g.add(arch);
    // keystone
    g.add(_box(o.pillarW * 1.3, o.pillarW * 1.3, o.pillarW, M.stone(o.color + 0x080808),
      [0, o.height + o.span / 2, 0]));
    // bases
    g.add(_box(o.pillarW + 0.06, 0.08, o.pillarW + 0.06, st,
      [-o.span / 2 - o.pillarW / 2, 0.04, 0]));
    g.add(_box(o.pillarW + 0.06, 0.08, o.pillarW + 0.06, st,
      [o.span / 2 + o.pillarW / 2, 0.04, 0]));
    // capitals
    g.add(_box(o.pillarW + 0.04, 0.06, o.pillarW + 0.04, st,
      [-o.span / 2 - o.pillarW / 2, o.height - 0.03, 0]));
    g.add(_box(o.pillarW + 0.04, 0.06, o.pillarW + 0.04, st,
      [o.span / 2 + o.pillarW / 2, o.height - 0.03, 0]));
    return g;
  }, {
    icon: "🏛️", category: "structure",
    params: [
      { key: "span", label: "Span", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.0 },
      { key: "pillarW", label: "Pillar W", type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.25 },
      { key: "color", label: "Color", type: "color", default: 0x8a8070 },
    ],
  });

  register("floor", function ({ size = 14, width, depth, color = 0x4a3220, shape = "square" } = {}) {
  const w = width || size;
  const d = depth || size;
  const geo = shape === "circle" ? new THREE.CircleGeometry(w, 64) : new THREE.PlaneGeometry(w, d);
  const f = new THREE.Mesh(geo, M.wood(color));
  f.rotation.x = -Math.PI / 2;
  f.name = "floor";
  return f;
}, { category: "architecture" });

  register("wall", function ({ width = 14, height = 5.5, color = 0x2a2018 } = {}) {
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), M.plaster(color));
}, { category: "architecture" });

  register("beam", function ({ length = 14, color = 0x3a2a1a } = {}) {
  return new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, length), M.wood(color));
}, { category: "architecture" });

  register("window", function ({ width = 1.4, height = 2.6, light = 1.5 } = {}) {
  const g = new THREE.Group();
  g.add(_box(width, height, 0.1, M.wood(0x2c1f12)));
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 0.85, height * 0.92),
    M.glass(0xd8c08a)
  );
  pane.position.z = 0.06; g.add(pane);
  g.add(_box(0.04, height * 0.92, 0.12, M.wood(0x2c1f12), [0, 0, 0.06]));
  g.add(_box(width * 0.85, 0.04, 0.12, M.wood(0x2c1f12), [0, 0, 0.06]));
  if (light > 0) {
    const l = new THREE.PointLight(0xfff0c8, light, 8, 1.2);
    l.position.set(0, 0, 0.5);
    g.add(l);
  }
  return g;
}, { category: "architecture" });


})();
