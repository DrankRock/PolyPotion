// category: "buildings"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("bridge", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const w = o.width, l = o.length;
    // planks
    const plankCount = Math.floor(l / 0.12);
    for (let i = 0; i < plankCount; i++) {
      const z = -l/2 + 0.06 + i * (l / plankCount);
      g.add(_box(w, 0.04, 0.1, mat, [0, 0, z]));
    }
    // side beams
    g.add(_box(0.06, 0.06, l, mat, [-w/2, 0, 0]));
    g.add(_box(0.06, 0.06, l, mat, [ w/2, 0, 0]));
    // railing posts
    const railMat = M.wood(o.color);
    for (let i = 0; i <= 6; i++) {
      const z = -l/2 + i * (l/6);
      g.add(_box(0.04, 0.7, 0.04, railMat, [-w/2, 0.35, z]));
      g.add(_box(0.04, 0.7, 0.04, railMat, [ w/2, 0.35, z]));
    }
    // top rails
    g.add(_box(0.04, 0.04, l, railMat, [-w/2, 0.7, 0]));
    g.add(_box(0.04, 0.04, l, railMat, [ w/2, 0.7, 0]));
    // arch supports underneath
    g.add(_box(0.08, 0.08, l * 0.5, mat, [-w/3, -0.15, 0]));
    g.add(_box(0.08, 0.08, l * 0.5, mat, [ w/3, -0.15, 0]));
    return g;
  }, {
    icon: "🌉", category: "architecture",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.8, max: 3.0, step: 0.1,  default: 1.4 },
      { key: "length", label: "Length", type: "number", min: 2.0, max: 8.0, step: 0.5,  default: 4.0 },
      { key: "color",  label: "Wood",   type: "color",  default: 0x6b4a2b },
    ],
  });

  register("tower", function (o) {
    const g = new THREE.Group();
    const mat = M.stone(o.color);
    const r = o.radius, h = o.height;
    // cylindrical body
    g.add(_cyl(r, r * 1.05, h, mat, [0, h/2, 0], o.sides));
    // conical roof
    if (o.hasRoof) {
      const roofMat = M.wood(0x4a2a18);
      g.add(_cyl(0, r * 1.3, h * 0.35, roofMat, [0, h + h * 0.175, 0], o.sides));
    }
    // door
    g.add(_box(0.5, 0.8, 0.15, M.wood(0x3a2a18), [0, 0.4, r + 0.02]));
    // window slits
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const wx = Math.sin(angle) * (r + 0.01);
      const wz = Math.cos(angle) * (r + 0.01);
      const slit = _box(0.08, 0.3, 0.08, M.metal(0x1a1a1a), [wx, h * 0.6, wz]);
      slit.rotation.y = -angle;
      g.add(slit);
    }
    return g;
  }, {
    icon: "🏰", category: "architecture",
    params: [
      { key: "radius",  label: "Radius",  type: "number", min: 0.8, max: 3.0, step: 0.1, default: 1.2 },
      { key: "height",  label: "Height",  type: "number", min: 3.0, max: 10,  step: 0.5, default: 5.0 },
      { key: "sides",   label: "Sides",   type: "int",    min: 6,   max: 24,  default: 12 },
      { key: "hasRoof", label: "Roof",    type: "bool",   default: true },
      { key: "color",   label: "Stone",   type: "color",  default: 0x6a6058 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // DECORATIVE — WAVE 2
  // ════════════════════════════════════════════════════════

  register("tent", function (o) {
    const g = new THREE.Group();
    const mat = M.cloth(o.color);
    const poleMat = M.wood(0x5a4a38);
    const w = o.width, h = o.height;
    // center pole
    g.add(_cyl(0.03, 0.03, h, poleMat, [0, h/2, 0], 6));
    // ridge pole (if A-frame)
    g.add(_cyl(0.02, 0.02, w, poleMat, [0, h, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // fabric sides (two angled planes)
    const sideGeo = new THREE.PlaneGeometry(w, Math.sqrt(h * h + (w/2) * (w/2)));
    const side1 = new THREE.Mesh(sideGeo, mat);
    side1.rotation.x = -Math.atan2(h, w/2);
    side1.position.set(0, h * 0.5, w * 0.22);
    g.add(side1);
    const side2 = new THREE.Mesh(sideGeo, mat);
    side2.rotation.x = Math.atan2(h, w/2);
    side2.position.set(0, h * 0.5, -w * 0.22);
    g.add(side2);
    // end wall triangles (approximated with scaled planes)
    const endGeo = new THREE.PlaneGeometry(w, h);
    const end1 = new THREE.Mesh(endGeo, mat);
    end1.position.set(-w/2, h/2, 0);
    end1.rotation.y = Math.PI / 2;
    end1.scale.set(0.5, 1, 1);
    g.add(end1);
    return g;
  }, {
    icon: "⛺", category: "props",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 1.5, max: 4.0, step: 0.25, default: 2.5 },
      { key: "height", label: "Height", type: "number", min: 1.5, max: 3.5, step: 0.25, default: 2.2 },
      { key: "color",  label: "Fabric", type: "color",  default: 0x8a7a60 },
    ],
  });

  register("drawbridge", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const st = M.stone(o.stoneColor);
    // two stone pillars
    g.add(_box(0.4, o.pillarH, 0.5, st, [-o.width / 2 - 0.2, o.pillarH / 2, 0]));
    g.add(_box(0.4, o.pillarH, 0.5, st, [o.width / 2 + 0.2, o.pillarH / 2, 0]));
    // bridge deck (planks)
    g.add(_box(o.width, 0.08, o.length, w, [0, 0.04, o.length / 2]));
    // plank lines
    for (let i = 0; i < 5; i++) {
      const z = o.length * (i / 4);
      g.add(_box(o.width, 0.005, 0.02, M.metal(0x2a2a2a), [0, 0.085, z]));
    }
    // chains (two)
    const chainMat = M.metal(0x4a4a4a);
    g.add(_cyl(0.015, 0.015, o.pillarH * 0.6, chainMat, [-o.width / 2 + 0.05, o.pillarH * 0.7, o.length * 0.8], 4));
    g.children[g.children.length - 1].rotation.x = 0.5;
    g.add(_cyl(0.015, 0.015, o.pillarH * 0.6, chainMat, [o.width / 2 - 0.05, o.pillarH * 0.7, o.length * 0.8], 4));
    g.children[g.children.length - 1].rotation.x = 0.5;
    return g;
  }, {
    icon: "🏰", category: "structure",
    params: [
      { key: "width",      label: "Width",    type: "number", min: 1.5, max: 4.0, step: 0.2,  default: 2.5 },
      { key: "length",     label: "Length",   type: "number", min: 2.0, max: 5.0, step: 0.3,  default: 3.0 },
      { key: "pillarH",    label: "Pillar H", type: "number", min: 2.0, max: 5.0, step: 0.3,  default: 3.5 },
      { key: "color",      label: "Wood",     type: "color",  default: 0x4a3018 },
      { key: "stoneColor", label: "Stone",    type: "color",  default: 0x4a4338 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // ROADS, EXTERIOR & SCENERY
  // ════════════════════════════════════════════════════════

  register("dock", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // deck planks
    g.add(_box(o.width, 0.06, o.length, w, [0, o.height, 0]));
    // plank lines
    for (let i = 0; i <= Math.floor(o.length / 0.3); i++) {
      const z = -o.length / 2 + i * 0.3;
      g.add(_box(o.width, 0.005, 0.015, M.metal(0x3a3a3a), [0, o.height + 0.032, z]));
    }
    // support piles
    const piles = Math.max(2, Math.floor(o.length / 1.2));
    for (let i = 0; i < piles; i++) {
      const z = -o.length / 2 + 0.3 + i * (o.length - 0.6) / (piles - 1);
      g.add(_cyl(0.06, 0.07, o.height + 0.3, w, [-o.width / 2 + 0.1, o.height / 2 - 0.15, z], 8));
      g.add(_cyl(0.06, 0.07, o.height + 0.3, w, [o.width / 2 - 0.1, o.height / 2 - 0.15, z], 8));
    }
    // mooring posts at end
    g.add(_cyl(0.05, 0.05, 0.3, w, [-o.width / 2 + 0.15, o.height + 0.15, o.length / 2 - 0.15], 6));
    g.add(_cyl(0.05, 0.05, 0.3, w, [o.width / 2 - 0.15, o.height + 0.15, o.length / 2 - 0.15], 6));
    return g;
  }, {
    icon: "🚢", category: "structure",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 1.0, max: 3.0, step: 0.2,  default: 1.8 },
      { key: "length", label: "Length", type: "number", min: 2.0, max: 8.0, step: 0.5,  default: 4.0 },
      { key: "height", label: "Height", type: "number", min: 0.4, max: 1.5, step: 0.1,  default: 0.8 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a4a30 },
    ],
  });

  register("watchtower", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // four corner posts
    const hw = o.baseSize / 2;
    [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]].forEach(([x, z]) => {
      g.add(_cyl(0.08, 0.09, o.height, w, [x, o.height / 2, z], 8));
    });
    // cross braces (X pattern on each side)
    for (let i = 0; i < 2; i++) {
      const y = o.height * 0.25 + i * o.height * 0.35;
      g.add(_box(o.baseSize, 0.04, 0.04, w, [0, y, -hw]));
      g.add(_box(o.baseSize, 0.04, 0.04, w, [0, y, hw]));
      g.add(_box(0.04, 0.04, o.baseSize, w, [-hw, y, 0]));
      g.add(_box(0.04, 0.04, o.baseSize, w, [hw, y, 0]));
    }
    // platform
    const ps = o.baseSize + 0.4;
    g.add(_box(ps, 0.06, ps, w, [0, o.height, 0]));
    // railing on platform
    const rh = 0.6;
    const ph = ps / 2;
    [[-ph, -ph], [ph, -ph], [-ph, ph], [ph, ph]].forEach(([x, z]) => {
      g.add(_cyl(0.03, 0.03, rh, w, [x, o.height + rh / 2, z], 6));
    });
    g.add(_box(ps, 0.04, 0.04, w, [0, o.height + rh, -ph]));
    g.add(_box(ps, 0.04, 0.04, w, [0, o.height + rh, ph]));
    g.add(_box(0.04, 0.04, ps, w, [-ph, o.height + rh, 0]));
    g.add(_box(0.04, 0.04, ps, w, [ph, o.height + rh, 0]));
    // roof (pyramid)
    g.add(_cone(ps * 0.75, 1.0, w, [0, o.height + rh + 0.5, 0], 4));
    return g;
  }, {
    icon: "🗼", category: "structure",
    params: [
      { key: "baseSize", label: "Base",   type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
      { key: "height",   label: "Height", type: "number", min: 3.0, max: 8.0, step: 0.5, default: 5.0 },
      { key: "color",    label: "Color",  type: "color",  default: 0x5a3a1a },
    ],
  });

  register("castle_wall", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // main wall body
    g.add(_box(o.length, o.height, o.thickness, st, [0, o.height / 2, 0]));
    // crenellations (merlons)
    const merlonW = 0.3, gapW = 0.25;
    const step = merlonW + gapW;
    const count = Math.floor(o.length / step);
    for (let i = 0; i < count; i++) {
      const x = -o.length / 2 + merlonW / 2 + i * step;
      g.add(_box(merlonW, 0.35, o.thickness, st, [x, o.height + 0.175, 0]));
    }
    // wall walk (thin ledge on inner side)
    g.add(_box(o.length, 0.05, 0.4, st, [0, o.height - 0.5, -o.thickness / 2 - 0.2]));
    return g;
  }, {
    icon: "🏰", category: "structure",
    params: [
      { key: "length",    label: "Length",    type: "number", min: 2.0, max: 15.0, step: 1.0, default: 6.0 },
      { key: "height",    label: "Height",    type: "number", min: 2.0, max: 6.0,  step: 0.5, default: 3.5 },
      { key: "thickness", label: "Thickness", type: "number", min: 0.3, max: 1.0,  step: 0.1, default: 0.5 },
      { key: "color",     label: "Color",     type: "color",  default: 0x5a5248 },
    ],
  });

  register("castle_tower_round", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // main cylinder
    g.add(_cyl(o.radius, o.radius * 1.02, o.height, st, [0, o.height / 2, 0], 24));
    // crenellation ring
    const merlonCount = 12;
    for (let i = 0; i < merlonCount; i++) {
      const a = (i / merlonCount) * Math.PI * 2;
      if (i % 2 === 0) {
        const x = Math.cos(a) * (o.radius - 0.05);
        const z = Math.sin(a) * (o.radius - 0.05);
        const merlon = _box(0.25, 0.3, 0.2, st, [x, o.height + 0.15, z]);
        merlon.rotation.y = -a;
        g.add(merlon);
      }
    }
    // conical roof
    if (o.roof) {
      g.add(_cone(o.radius + 0.15, o.radius * 1.2, M.wood(0x3a2820),
        [0, o.height + 0.3 + o.radius * 0.6, 0], 16));
    }
    // door
    g.add(_box(0.4, 0.7, 0.1, M.wood(0x3a2018), [0, 0.35, o.radius + 0.02]));
    // arrow slit
    g.add(_box(0.06, 0.4, 0.15, M.metal(0x1a1a1a), [0, o.height * 0.6, o.radius + 0.01]));
    return g;
  }, {
    icon: "🏰", category: "structure",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.8, max: 3.0, step: 0.2, default: 1.5 },
      { key: "height", label: "Height", type: "number", min: 3.0, max: 10.0, step: 0.5, default: 6.0 },
      { key: "roof",   label: "Roof",   type: "int",    min: 0,   max: 1,   default: 1 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a5248 },
    ],
  });

  register("cottage", function (o) {
    const g = new THREE.Group();
    const wallMat = M.plaster(o.wallColor);
    const w = M.wood(o.trimColor);
    const thatch = M.rope(o.roofColor);
    // walls
    g.add(_box(o.width, o.wallH, o.depth, wallMat, [0, o.wallH / 2, 0]));
    // timber frame lines (decorative)
    // horizontal
    g.add(_box(o.width + 0.02, 0.04, 0.06, w, [0, o.wallH, o.depth / 2]));
    g.add(_box(o.width + 0.02, 0.04, 0.06, w, [0, 0.02, o.depth / 2]));
    g.add(_box(o.width + 0.02, 0.04, 0.06, w, [0, o.wallH / 2, o.depth / 2]));
    // vertical
    g.add(_box(0.04, o.wallH, 0.06, w, [-o.width / 2, o.wallH / 2, o.depth / 2]));
    g.add(_box(0.04, o.wallH, 0.06, w, [o.width / 2, o.wallH / 2, o.depth / 2]));
    g.add(_box(0.04, o.wallH, 0.06, w, [0, o.wallH / 2, o.depth / 2]));
    // roof (two slopes)
    const halfW = o.width / 2 + 0.2;
    const roofH = o.roofH;
    const slopeLen = Math.sqrt(halfW * halfW + roofH * roofH);
    const angle = Math.atan2(roofH, halfW);
    const left = _box(slopeLen, 0.12, o.depth + 0.3, thatch, [-halfW / 2, o.wallH + roofH / 2, 0]);
    left.rotation.z = angle;
    g.add(left);
    const right = _box(slopeLen, 0.12, o.depth + 0.3, thatch, [halfW / 2, o.wallH + roofH / 2, 0]);
    right.rotation.z = -angle;
    g.add(right);
    // door
    g.add(_box(0.4, 0.7, 0.06, M.wood(0x3a2018), [0, 0.35, o.depth / 2 + 0.03]));
    // windows
    g.add(_box(0.3, 0.3, 0.06, M.glass(), [-o.width * 0.3, o.wallH * 0.6, o.depth / 2 + 0.03]));
    g.add(_box(0.3, 0.3, 0.06, M.glass(), [o.width * 0.3, o.wallH * 0.6, o.depth / 2 + 0.03]));
    // chimney
    g.add(_box(0.3, roofH + 0.5, 0.3, M.stone(0x5a5248),
      [o.width * 0.35, o.wallH + roofH * 0.5 + 0.25, -o.depth * 0.3]));
    return g;
  }, {
    icon: "🏡", category: "structure",
    params: [
      { key: "width",     label: "Width",  type: "number", min: 2.0, max: 6.0, step: 0.3, default: 3.5 },
      { key: "depth",     label: "Depth",  type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.0 },
      { key: "wallH",     label: "Wall H", type: "number", min: 1.5, max: 3.5, step: 0.2, default: 2.2 },
      { key: "roofH",     label: "Roof H", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.5 },
      { key: "wallColor", label: "Walls",  type: "color",  default: 0xc8b89a },
      { key: "trimColor", label: "Timber", type: "color",  default: 0x3a2818 },
      { key: "roofColor", label: "Roof",   type: "color",  default: 0x7a6a40 },
    ],
  });

  register("mill_house", function (o) {
    const g = new THREE.Group();
    const wallMat = M.stone(o.wallColor);
    const w = M.wood(o.woodColor);
    const roofMat = M.wood(o.roofColor);
    // main building
    g.add(_box(o.width, o.wallH, o.depth, wallMat, [0, o.wallH / 2, 0]));
    // roof
    const halfW = o.width / 2 + 0.15;
    const roofH = o.wallH * 0.5;
    const slopeLen = Math.sqrt(halfW * halfW + roofH * roofH);
    const angle = Math.atan2(roofH, halfW);
    g.add(_box(slopeLen, 0.08, o.depth + 0.2, roofMat, [-halfW / 2, o.wallH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = angle;
    g.add(_box(slopeLen, 0.08, o.depth + 0.2, roofMat, [halfW / 2, o.wallH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = -angle;
    // door
    g.add(_box(0.4, 0.75, 0.06, w, [0, 0.375, o.depth / 2 + 0.03]));
    // windows
    g.add(_box(0.25, 0.25, 0.06, M.glass(), [-o.width * 0.3, o.wallH * 0.6, o.depth / 2 + 0.03]));
    g.add(_box(0.25, 0.25, 0.06, M.glass(), [o.width * 0.3, o.wallH * 0.6, o.depth / 2 + 0.03]));
    // water wheel on side
    const wheelR = o.wallH * 0.4;
    const wheel = _tor(wheelR, 0.06, w, [o.width / 2 + 0.1, wheelR, 0], 16, 6);
    wheel.rotation.y = Math.PI / 2;
    g.add(wheel);
    // wheel paddles
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const paddle = _box(0.04, 0.15, 0.12, w,
        [o.width / 2 + 0.1, wheelR + Math.sin(a) * wheelR, Math.cos(a) * wheelR]);
      paddle.rotation.x = a;
      g.add(paddle);
    }
    return g;
  }, {
    icon: "🏭", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.5 },
      { key: "depth", label: "Depth", type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.0 },
      { key: "wallH", label: "Wall H", type: "number", min: 1.5, max: 3.5, step: 0.2, default: 2.5 },
      { key: "wallColor", label: "Walls", type: "color", default: 0x7a7068 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x4a3018 },
      { key: "roofColor", label: "Roof", type: "color", default: 0x3a2818 },
    ],
  });

  register("manor_house", function (o) {
    const g = new THREE.Group();
    const wall = M.stone(o.wallColor);
    const roof = M.stone(o.roofColor);
    const w = M.wood(0x3a2818);
    // main block
    g.add(_box(o.width, o.wallH, o.depth, wall, [0, o.wallH / 2, 0]));
    // roof
    const halfW = o.width / 2 + 0.2;
    const roofH = o.wallH * 0.4;
    const slopeLen = Math.sqrt(halfW * halfW + roofH * roofH);
    const ang = Math.atan2(roofH, halfW);
    g.add(_box(slopeLen, 0.08, o.depth + 0.3, roof, [-halfW / 2, o.wallH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = ang;
    g.add(_box(slopeLen, 0.08, o.depth + 0.3, roof, [halfW / 2, o.wallH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = -ang;
    // chimneys
    g.add(_box(0.25, roofH + 0.5, 0.25, wall, [-o.width * 0.35, o.wallH + roofH * 0.5 + 0.25, 0]));
    g.add(_box(0.25, roofH + 0.5, 0.25, wall, [o.width * 0.35, o.wallH + roofH * 0.5 + 0.25, 0]));
    // front door (grand)
    g.add(_box(0.5, 0.9, 0.06, w, [0, 0.45, o.depth / 2 + 0.03]));
    // door arch
    const dArch = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.04, 6, 10, Math.PI), wall);
    dArch.position.set(0, 0.9, o.depth / 2 + 0.03);
    dArch.rotation.z = -Math.PI / 2;
    g.add(dArch);
    // windows (3 per floor, 2 floors)
    for (let floor = 0; floor < 2; floor++) {
      for (let w_i = -1; w_i <= 1; w_i++) {
        if (floor === 0 && w_i === 0) continue; // door is there
        const y = 0.5 + floor * o.wallH * 0.4;
        g.add(_box(0.3, 0.35, 0.06, M.glass(), [w_i * o.width * 0.3, y, o.depth / 2 + 0.03]));
      }
    }
    // front steps
    for (let s = 0; s < 3; s++) {
      g.add(_box(1.0, 0.06, 0.2, wall, [0, 0.03 + s * 0.01, o.depth / 2 + 0.15 + s * 0.2]));
    }
    return g;
  }, {
    icon: "🏠", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 4.0, max: 10.0, step: 0.5, default: 6.0 },
      { key: "depth", label: "Depth", type: "number", min: 3.0, max: 7.0, step: 0.5, default: 4.5 },
      { key: "wallH", label: "Wall H", type: "number", min: 2.5, max: 5.0, step: 0.3, default: 3.5 },
      { key: "wallColor", label: "Walls", type: "color", default: 0x9a8a78 },
      { key: "roofColor", label: "Roof", type: "color", default: 0x4a3a30 },
    ],
  });

  register("tower_house", function (o) {
    const g = new THREE.Group();
    const wall = M.stone(o.wallColor);
    const w = M.wood(0x3a2818);
    // main tower
    g.add(_box(o.size, o.height, o.size, wall, [0, o.height / 2, 0]));
    // floor divisions (wooden beams visible)
    const floors = Math.floor(o.height / 1.5);
    for (let f = 1; f < floors; f++) {
      g.add(_box(o.size + 0.04, 0.06, o.size + 0.04, w, [0, f * 1.5, 0]));
    }
    // crenellations
    const merlonW = 0.25, gapW = 0.2;
    const step = merlonW + gapW;
    const perSide = Math.floor(o.size / step);
    for (let i = 0; i < perSide; i++) {
      const pos = -o.size / 2 + merlonW / 2 + i * step;
      g.add(_box(merlonW, 0.3, 0.15, wall, [pos, o.height + 0.15, o.size / 2]));
      g.add(_box(merlonW, 0.3, 0.15, wall, [pos, o.height + 0.15, -o.size / 2]));
      g.add(_box(0.15, 0.3, merlonW, wall, [o.size / 2, o.height + 0.15, pos]));
      g.add(_box(0.15, 0.3, merlonW, wall, [-o.size / 2, o.height + 0.15, pos]));
    }
    // door
    g.add(_box(0.35, 0.7, 0.08, w, [0, 0.35, o.size / 2 + 0.04]));
    // arrow slits
    for (let f = 0; f < floors; f++) {
      g.add(_box(0.05, 0.3, 0.12, M.metal(0x1a1a1a), [0, 0.8 + f * 1.5, o.size / 2 + 0.01]));
    }
    return g;
  }, {
    icon: "🏰", category: "structure",
    params: [
      { key: "size", label: "Size", type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 4.0, max: 12.0, step: 0.5, default: 7.0 },
      { key: "wallColor", label: "Walls", type: "color", default: 0x6a6258 },
    ],
  });

  register("gatehouse", function (o) {
    const g = new THREE.Group();
    const wall = M.stone(o.color);
    const w = M.wood(0x3a2818);
    // two towers
    for (let side = -1; side <= 1; side += 2) {
      const tx = side * (o.gateW / 2 + o.towerR);
      g.add(_cyl(o.towerR, o.towerR * 1.02, o.height, wall, [tx, o.height / 2, 0], 16));
      // tower crenellations
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        if (i % 2 === 0) {
          g.add(_box(0.2, 0.25, 0.15, wall,
            [tx + Math.cos(a) * (o.towerR - 0.05), o.height + 0.12, Math.sin(a) * (o.towerR - 0.05)]));
        }
      }
      // conical roof
      g.add(_cone(o.towerR + 0.1, o.towerR * 0.8, M.wood(0x3a2820),
        [tx, o.height + 0.25 + o.towerR * 0.4, 0], 12));
    }
    // connecting wall above gate
    g.add(_box(o.gateW, o.height * 0.3, o.towerR * 2, wall,
      [0, o.height - o.height * 0.15, 0]));
    // gate arch
    const archR = o.gateW / 2;
    const arch = new THREE.Mesh(new THREE.TorusGeometry(archR, 0.12, 6, 16, Math.PI), wall);
    arch.position.set(0, o.gateH, o.towerR + 0.01);
    arch.rotation.z = -Math.PI / 2;
    g.add(arch);
    // gate door
    g.add(_box(o.gateW - 0.1, o.gateH, 0.06, w, [0, o.gateH / 2, o.towerR + 0.01]));
    // portcullis grooves
    g.add(_box(0.04, o.gateH + archR, 0.08, M.metal(0x2a2a28),
      [-o.gateW / 2 + 0.02, (o.gateH + archR) / 2, o.towerR + 0.01]));
    g.add(_box(0.04, o.gateH + archR, 0.08, M.metal(0x2a2a28),
      [o.gateW / 2 - 0.02, (o.gateH + archR) / 2, o.towerR + 0.01]));
    return g;
  }, {
    icon: "🏰", category: "structure",
    params: [
      { key: "gateW", label: "Gate W", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "gateH", label: "Gate H", type: "number", min: 2.0, max: 4.0, step: 0.3, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 4.0, max: 10.0, step: 0.5, default: 6.0 },
      { key: "towerR", label: "Tower R", type: "number", min: 0.8, max: 2.0, step: 0.2, default: 1.2 },
      { key: "color", label: "Color", type: "color", default: 0x5a5248 },
    ],
  });

  register("chapel", function (o) {
    const g = new THREE.Group();
    const wall = M.stone(o.wallColor);
    const roof = M.wood(o.roofColor);
    const w = M.wood(0x3a2818);
    // nave
    g.add(_box(o.width, o.wallH, o.depth, wall, [0, o.wallH / 2, 0]));
    // roof
    const halfW = o.width / 2 + 0.1;
    const roofH = o.wallH * 0.45;
    const slopeLen = Math.sqrt(halfW * halfW + roofH * roofH);
    const ang = Math.atan2(roofH, halfW);
    g.add(_box(slopeLen, 0.06, o.depth + 0.15, roof, [-halfW / 2, o.wallH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = ang;
    g.add(_box(slopeLen, 0.06, o.depth + 0.15, roof, [halfW / 2, o.wallH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = -ang;
    // bell tower at front
    const tw = o.width * 0.3;
    g.add(_box(tw, o.wallH + roofH + 1.0, tw, wall,
      [0, (o.wallH + roofH + 1.0) / 2, o.depth / 2 + tw / 2]));
    // bell opening
    g.add(_box(tw * 0.5, 0.4, tw + 0.02, M.metal(0x1a1a1a),
      [0, o.wallH + roofH + 0.5, o.depth / 2 + tw / 2]));
    // spire
    g.add(_cone(tw * 0.5, tw * 1.5, roof,
      [0, o.wallH + roofH + 1.0 + tw * 0.75, o.depth / 2 + tw / 2], 4));
    // cross on top
    g.add(_box(0.03, 0.25, 0.03, M.metal(0x8a7a40),
      [0, o.wallH + roofH + 1.0 + tw * 1.5 + 0.12, o.depth / 2 + tw / 2]));
    g.add(_box(0.15, 0.03, 0.03, M.metal(0x8a7a40),
      [0, o.wallH + roofH + 1.0 + tw * 1.5 + 0.15, o.depth / 2 + tw / 2]));
    // door
    g.add(_box(0.4, 0.75, 0.06, w, [0, 0.375, o.depth / 2 + tw + 0.03]));
    // stained glass window
    g.add(_box(0.5, 0.6, 0.06, M.glass(0x4060a0), [0, o.wallH * 0.6, -o.depth / 2 - 0.03]));
    return g;
  }, {
    icon: "⛪", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 2.5, max: 6.0, step: 0.3, default: 3.5 },
      { key: "depth", label: "Depth", type: "number", min: 3.0, max: 8.0, step: 0.5, default: 5.0 },
      { key: "wallH", label: "Wall H", type: "number", min: 2.0, max: 4.0, step: 0.3, default: 2.8 },
      { key: "wallColor", label: "Walls", type: "color", default: 0x8a8070 },
      { key: "roofColor", label: "Roof", type: "color", default: 0x3a2820 },
    ],
  });

  register("stable", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.woodColor);
    const wall = M.wood(o.wallColor);
    // main structure
    g.add(_box(o.width, o.wallH, o.depth, wall, [0, o.wallH / 2, 0]));
    // roof
    const halfW = o.width / 2 + 0.2;
    const roofH = o.wallH * 0.35;
    const slopeLen = Math.sqrt(halfW * halfW + roofH * roofH);
    const ang = Math.atan2(roofH, halfW);
    g.add(_box(slopeLen, 0.06, o.depth + 0.25, M.rope(0x7a6a40), [-halfW / 2, o.wallH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = ang;
    g.add(_box(slopeLen, 0.06, o.depth + 0.25, M.rope(0x7a6a40), [halfW / 2, o.wallH + roofH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = -ang;
    // stall dividers
    const stalls = o.stalls;
    const stallW = o.width / stalls;
    for (let i = 1; i < stalls; i++) {
      const x = -o.width / 2 + i * stallW;
      g.add(_box(0.04, o.wallH * 0.6, o.depth - 0.1, w, [x, o.wallH * 0.3, 0]));
    }
    // stall doors (half-height)
    for (let i = 0; i < stalls; i++) {
      const x = -o.width / 2 + stallW / 2 + i * stallW;
      g.add(_box(stallW - 0.08, o.wallH * 0.4, 0.04, w, [x, o.wallH * 0.2, o.depth / 2 + 0.02]));
    }
    // hay in stalls
    for (let i = 0; i < stalls; i++) {
      const x = -o.width / 2 + stallW / 2 + i * stallW;
      g.add(_box(stallW * 0.5, 0.15, o.depth * 0.3, M.rope(0x9a8a40),
        [x, 0.075, -o.depth * 0.3]));
    }
    return g;
  }, {
    icon: "🐴", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 3.0, max: 8.0, step: 0.5, default: 5.0 },
      { key: "depth", label: "Depth", type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.0 },
      { key: "wallH", label: "Wall H", type: "number", min: 2.0, max: 3.5, step: 0.2, default: 2.5 },
      { key: "stalls", label: "Stalls", type: "int", min: 2, max: 6, default: 3 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x5a3a1a },
      { key: "wallColor", label: "Walls", type: "color", default: 0x6a4a28 },
    ],
  });

  register("granary", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // elevated platform on stilts
    const stilts = 4;
    const hw = o.width / 2 - 0.15, hd = o.depth / 2 - 0.15;
    [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].forEach(([x, z]) => {
      g.add(_cyl(0.06, 0.08, o.legH, w, [x, o.legH / 2, z], 6));
      // mushroom caps (rodent guards)
      g.add(_cyl(0.15, 0.15, 0.03, w, [x, o.legH, z], 10));
    });
    // floor
    g.add(_box(o.width, 0.05, o.depth, w, [0, o.legH + 0.025, 0]));
    // walls
    g.add(_box(o.width, o.wallH, o.depth, w, [0, o.legH + 0.05 + o.wallH / 2, 0]));
    // roof
    const roofY = o.legH + 0.05 + o.wallH;
    g.add(_cone(Math.max(o.width, o.depth) * 0.6, o.wallH * 0.5, w, [0, roofY + o.wallH * 0.25, 0], 4));
    // small door
    g.add(_box(0.3, 0.5, 0.05, M.wood(o.color - 0x080808),
      [0, o.legH + 0.05 + 0.25, o.depth / 2 + 0.025]));
    return g;
  }, {
    icon: "🌾", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "depth", label: "Depth", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "wallH", label: "Wall H", type: "number", min: 1.0, max: 2.5, step: 0.2, default: 1.5 },
      { key: "legH", label: "Leg H", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.8 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("warehouse", function (o) {
    const g = new THREE.Group();
    const wall = M.stone(o.wallColor);
    const w = M.wood(o.woodColor);
    // main building
    g.add(_box(o.width, o.wallH, o.depth, wall, [0, o.wallH / 2, 0]));
    // large barn-style doors
    const dw = o.width * 0.35;
    g.add(_box(dw, o.wallH * 0.7, 0.06, w, [-dw / 2, o.wallH * 0.35, o.depth / 2 + 0.03]));
    g.add(_box(dw, o.wallH * 0.7, 0.06, w, [dw / 2, o.wallH * 0.35, o.depth / 2 + 0.03]));
    // door braces (X pattern)
    for (let side = -1; side <= 1; side += 2) {
      g.add(_box(0.03, dw * 1.3, 0.07, w, [side * dw / 2, o.wallH * 0.35, o.depth / 2 + 0.035]));
      g.children[g.children.length - 1].rotation.z = side * 0.4;
    }
    // roof (barrel vault approximation)
    const roofSegs = 8;
    for (let i = 0; i < roofSegs; i++) {
      const a = (i / roofSegs) * Math.PI;
      const na = ((i + 1) / roofSegs) * Math.PI;
      const midA = (a + na) / 2;
      const halfW = o.width / 2 + 0.1;
      const x = Math.cos(midA) * halfW;
      const y = o.wallH + Math.sin(midA) * halfW * 0.3;
      const segW = 2 * halfW * Math.sin(Math.PI / roofSegs / 2) * 1.1;
      const panel = _box(segW, 0.04, o.depth + 0.15, M.wood(o.woodColor - 0x080808), [x, y, 0]);
      panel.rotation.z = Math.PI / 2 - midA;
      g.add(panel);
    }
    // loading platform
    g.add(_box(o.width * 0.6, 0.15, 0.5, wall, [0, 0.075, o.depth / 2 + 0.25]));
    return g;
  }, {
    icon: "🏗️", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 3.0, max: 8.0, step: 0.5, default: 5.0 },
      { key: "depth", label: "Depth", type: "number", min: 3.0, max: 8.0, step: 0.5, default: 5.0 },
      { key: "wallH", label: "Wall H", type: "number", min: 2.0, max: 4.0, step: 0.3, default: 3.0 },
      { key: "wallColor", label: "Walls", type: "color", default: 0x6a5a48 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x4a3018 },
    ],
  });

  // ─── PROPS & DETAILS ──────────────────────────────────────────

  register("guard_tent", function (o) {
    const g = new THREE.Group();
    const cl = M.cloth(o.color);
    const w = M.wood(o.poleColor);
    // center pole
    g.add(_cyl(0.03, 0.03, o.height, w, [0, o.height / 2, 0], 6));
    // conical canvas
    g.add(_cone(o.radius, o.height * 0.9, cl, [0, o.height * 0.45, 0], 16));
    // entrance flap (slightly open)
    const flapW = o.radius * 0.4;
    const flap = _box(flapW, o.height * 0.5, 0.01, cl, [flapW / 2 + 0.05, o.height * 0.2, o.radius * 0.85]);
    flap.rotation.y = 0.3;
    g.add(flap);
    // ground cloth
    g.add(_cyl(o.radius + 0.05, o.radius + 0.05, 0.01, cl, [0, 0.005, 0], 16));
    // flag at top
    g.add(_box(0.2, 0.1, 0.005, M.cloth(o.flagColor), [0.1, o.height + 0.05, 0]));
    return g;
  }, {
    icon: "⛺", category: "structure",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.8, max: 3.0, step: 0.2, default: 1.5 },
      { key: "height", label: "Height", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "color", label: "Canvas", type: "color", default: 0xc8b890 },
      { key: "poleColor", label: "Pole", type: "color", default: 0x5a3a1a },
      { key: "flagColor", label: "Flag", type: "color", default: 0xa02020 },
    ],
  });

  register("pavilion", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.poleColor);
    const cl = M.cloth(o.color);
    // 6 or 8 poles in circle
    const poles = 6;
    for (let i = 0; i < poles; i++) {
      const a = (i / poles) * Math.PI * 2;
      g.add(_cyl(0.04, 0.04, o.height, w,
        [Math.cos(a) * o.radius, o.height / 2, Math.sin(a) * o.radius], 6));
    }
    // conical roof
    g.add(_cone(o.radius + 0.3, o.height * 0.4, cl, [0, o.height + o.height * 0.2, 0], poles));
    // finial
    g.add(_sph(0.04, M.metal(0x9a8a40), [0, o.height + o.height * 0.4 + 0.04, 0], 6));
    // valance around rim
    for (let i = 0; i < poles; i++) {
      const a = (i / poles) * Math.PI * 2;
      const na = ((i + 1) / poles) * Math.PI * 2;
      const midA = (a + na) / 2;
      g.add(_cone(0.08, 0.15, cl,
        [Math.cos(midA) * (o.radius + 0.2), o.height - 0.1, Math.sin(midA) * (o.radius + 0.2)], 3));
    }
    // floor platform
    g.add(_cyl(o.radius + 0.1, o.radius + 0.1, 0.05, M.stone(0x6a6258), [0, 0.025, 0], poles * 2));
    return g;
  }, {
    icon: "🎪", category: "structure",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.0 },
      { key: "color", label: "Canvas", type: "color", default: 0xc8a840 },
      { key: "poleColor", label: "Poles", type: "color", default: 0x5a3a1a },
    ],
  });

  register("covered_bridge", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const roof = M.wood(o.roofColor);
    // deck
    const planks = Math.floor(o.length / 0.12);
    for (let i = 0; i < planks; i++) {
      g.add(_box(o.width, 0.04, 0.1, w, [0, 0, -o.length / 2 + 0.05 + i * 0.12]));
    }
    // side beams
    g.add(_box(0.06, 0.06, o.length, w, [-o.width / 2, -0.02, 0]));
    g.add(_box(0.06, 0.06, o.length, w, [o.width / 2, -0.02, 0]));
    // walls (partial - lower half)
    g.add(_box(0.04, o.wallH, o.length, w, [-o.width / 2, o.wallH / 2, 0]));
    g.add(_box(0.04, o.wallH, o.length, w, [o.width / 2, o.wallH / 2, 0]));
    // upper wall (slatted)
    for (let i = 0; i < Math.floor(o.length / 0.2); i++) {
      const z = -o.length / 2 + 0.1 + i * 0.2;
      g.add(_box(0.03, o.roofH - o.wallH, 0.04, w, [-o.width / 2, o.wallH + (o.roofH - o.wallH) / 2, z]));
      g.add(_box(0.03, o.roofH - o.wallH, 0.04, w, [o.width / 2, o.wallH + (o.roofH - o.wallH) / 2, z]));
    }
    // roof
    const halfW = o.width / 2 + 0.15;
    const peakH = 0.6;
    const slopeLen = Math.sqrt(halfW * halfW + peakH * peakH);
    const ang = Math.atan2(peakH, halfW);
    g.add(_box(slopeLen, 0.05, o.length + 0.3, roof,
      [-halfW / 2, o.roofH + peakH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = ang;
    g.add(_box(slopeLen, 0.05, o.length + 0.3, roof,
      [halfW / 2, o.roofH + peakH / 2, 0]));
    g.children[g.children.length - 1].rotation.z = -ang;
    return g;
  }, {
    icon: "🌉", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "length", label: "Length", type: "number", min: 3.0, max: 10.0, step: 0.5, default: 5.0 },
      { key: "wallH", label: "Wall H", type: "number", min: 0.5, max: 1.5, step: 0.2, default: 1.0 },
      { key: "roofH", label: "Roof H", type: "number", min: 2.0, max: 3.5, step: 0.2, default: 2.5 },
      { key: "color", label: "Wood", type: "color", default: 0x5a3a1a },
      { key: "roofColor", label: "Roof", type: "color", default: 0x3a2818 },
    ],
  });

  register("suspension_bridge", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const rope = M.rope(o.ropeColor);
    // deck planks
    const plankCount = Math.floor(o.length / 0.12);
    for (let i = 0; i < plankCount; i++) {
      const z = -o.length / 2 + 0.06 + i * 0.12;
      const sag = Math.sin((i / plankCount) * Math.PI) * o.sag;
      g.add(_box(o.width, 0.035, 0.1, w, [0, -sag, z]));
    }
    // main cables
    for (let side = -1; side <= 1; side += 2) {
      // towers at ends
      g.add(_cyl(0.06, 0.06, o.towerH, w,
        [side * o.width / 2, o.towerH / 2, -o.length / 2], 6));
      g.add(_cyl(0.06, 0.06, o.towerH, w,
        [side * o.width / 2, o.towerH / 2, o.length / 2], 6));
      // cable approximation (segmented)
      for (let i = 0; i < 10; i++) {
        const t = i / 10;
        const z1 = -o.length / 2 + t * o.length;
        const z2 = z1 + o.length / 10;
        const sag1 = Math.sin(t * Math.PI) * o.sag * 0.5;
        const sag2 = Math.sin((t + 0.1) * Math.PI) * o.sag * 0.5;
        const seg = _cyl(0.01, 0.01, o.length / 10, rope,
          [side * o.width / 2, o.towerH - sag1 - (sag2 - sag1) / 2, (z1 + z2) / 2], 4);
        seg.rotation.x = Math.PI / 2;
        g.add(seg);
      }
      // vertical suspenders
      for (let i = 1; i < 8; i++) {
        const t = i / 8;
        const z = -o.length / 2 + t * o.length;
        const sag_deck = Math.sin(t * Math.PI) * o.sag;
        const sag_cable = Math.sin(t * Math.PI) * o.sag * 0.5;
        const suspH = (o.towerH - sag_cable) - (-sag_deck);
        g.add(_cyl(0.005, 0.005, suspH, rope,
          [side * o.width / 2, -sag_deck + suspH / 2, z], 3));
      }
    }
    return g;
  }, {
    icon: "🌉", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.5 },
      { key: "length", label: "Length", type: "number", min: 4.0, max: 15.0, step: 1.0, default: 8.0 },
      { key: "towerH", label: "Tower H", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "sag", label: "Sag", type: "number", min: 0.2, max: 1.5, step: 0.1, default: 0.6 },
      { key: "color", label: "Wood", type: "color", default: 0x5a3a1a },
      { key: "ropeColor", label: "Rope", type: "color", default: 0x8a7a60 },
    ],
  });

  register("rope_bridge", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const rope = M.rope(o.ropeColor);
    // anchor posts at each end
    for (let end = -1; end <= 1; end += 2) {
      for (let side = -1; side <= 1; side += 2) {
        g.add(_cyl(0.04, 0.04, o.postH, w,
          [side * o.width / 2, o.postH / 2, end * o.length / 2], 6));
      }
    }
    // planks with sag
    const plankCount = Math.floor(o.length / 0.15);
    for (let i = 0; i < plankCount; i++) {
      const t = i / plankCount;
      const z = -o.length / 2 + 0.075 + i * 0.15;
      const sag = Math.sin(t * Math.PI) * o.sag;
      g.add(_box(o.width, 0.03, 0.12, w, [0, -sag, z]));
    }
    // rope railings
    for (let side = -1; side <= 1; side += 2) {
      for (let level = 0; level < 2; level++) {
        const y = o.postH * (0.5 + level * 0.35);
        // segmented rope following sag
        for (let i = 0; i < 10; i++) {
          const t = i / 10;
          const z1 = -o.length / 2 + t * o.length;
          const sag1 = Math.sin(t * Math.PI) * o.sag * 0.3;
          const seg = _cyl(0.008, 0.008, o.length / 10, rope,
            [side * o.width / 2, y - sag1, z1 + o.length / 20], 3);
          seg.rotation.x = Math.PI / 2;
          g.add(seg);
        }
      }
    }
    return g;
  }, {
    icon: "🌉", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.6, max: 2.0, step: 0.2, default: 1.0 },
      { key: "length", label: "Length", type: "number", min: 2.0, max: 10.0, step: 0.5, default: 5.0 },
      { key: "postH", label: "Post H", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 0.9 },
      { key: "sag", label: "Sag", type: "number", min: 0.1, max: 1.0, step: 0.1, default: 0.4 },
      { key: "color", label: "Wood", type: "color", default: 0x5a3a1a },
      { key: "ropeColor", label: "Rope", type: "color", default: 0x8a7a60 },
    ],
  });
  // ════════════════════════════════════════════════════════════════
  // BATCH 2 CONTINUED — MORE BUILDINGS, SCENERY, MEDIEVAL
  // ════════════════════════════════════════════════════════════════

  register("town_square", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // cobbled ground
    g.add(_box(o.size, 0.04, o.size, st, [0, 0.02, 0]));
    // paving pattern
    for (let r = 0; r < Math.floor(o.size / 0.25); r++) {
      for (let c = 0; c < Math.floor(o.size / 0.25); c++) {
        if (rand(0, 1) > 0.6) continue;
        const x = -o.size / 2 + 0.125 + c * 0.25;
        const z = -o.size / 2 + 0.125 + r * 0.25;
        g.add(_box(rand(0.18, 0.23), 0.015, rand(0.18, 0.23),
          M.stone(_c(o.color) + Math.floor(rand(-8, 8))), [x, 0.047, z]));
      }
    }
    // central feature (small pedestal)
    g.add(_cyl(0.3, 0.35, 0.15, st, [0, 0.075, 0], 10));
    g.add(_cyl(0.25, 0.25, 0.08, st, [0, 0.19, 0], 10));
    return g;
  }, {
    icon: "🏛️", category: "road",
    params: [
      { key: "size", label: "Size", type: "number", min: 3.0, max: 12.0, step: 1.0, default: 6.0 },
      { key: "color", label: "Color", type: "color", default: 0x6a6258 },
    ],
  });

  register("moat", function (o) {
    const g = new THREE.Group();
    const water = M.glass(o.waterColor);
    const earth = M.stone(o.bankColor);
    // water channel
    g.add(_box(o.width, 0.06, o.length, water, [0, -0.03, 0]));
    // banks
    g.add(_box(0.3, 0.2, o.length, earth, [-o.width / 2 - 0.15, 0.1, 0]));
    g.add(_box(0.3, 0.2, o.length, earth, [o.width / 2 + 0.15, 0.1, 0]));
    // muddy bottom
    g.add(_box(o.width, 0.03, o.length, M.stone(0x3a2a18), [0, -0.06, 0]));
    return g;
  }, {
    icon: "🌊", category: "terrain",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.0, max: 5.0, step: 0.3, default: 2.5 },
      { key: "length", label: "Length", type: "number", min: 3.0, max: 15.0, step: 1.0, default: 8.0 },
      { key: "waterColor", label: "Water", type: "color", default: 0x3a5a4a },
      { key: "bankColor", label: "Banks", type: "color", default: 0x4a3a28 },
    ],
  });

  register("drawbridge_gate", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.stoneColor);
    const w = M.wood(o.woodColor);
    // two towers flanking
    for (let side = -1; side <= 1; side += 2) {
      const tx = side * (o.gateW / 2 + 0.4);
      g.add(_box(0.8, o.height, 0.8, st, [tx, o.height / 2, 0]));
      // crenellations
      for (let i = -1; i <= 1; i++) {
        g.add(_box(0.2, 0.25, 0.15, st, [tx + i * 0.25, o.height + 0.12, 0.35]));
      }
    }
    // wall connecting above gate
    g.add(_box(o.gateW, o.height * 0.25, 0.6, st, [0, o.height - o.height * 0.125, 0]));
    // gate opening
    g.add(_box(o.gateW, o.gateH, 0.7, M.metal(0x0a0a0a), [0, o.gateH / 2, 0]));
    // drawbridge (lowered plank)
    g.add(_box(o.gateW - 0.1, 0.06, o.bridgeLen, w, [0, 0.03, o.bridgeLen / 2 + 0.35]));
    // chains
    for (let side = -1; side <= 1; side += 2) {
      g.add(_cyl(0.01, 0.01, o.bridgeLen * 0.8, M.metal(0x4a4a4a),
        [side * o.gateW * 0.4, o.gateH * 0.8, o.bridgeLen * 0.3], 4));
      g.children[g.children.length - 1].rotation.x = 0.6;
    }
    // portcullis (grid pattern)
    for (let x = -3; x <= 3; x++) {
      g.add(_cyl(0.012, 0.012, o.gateH, M.metal(0x3a3a3a),
        [x * o.gateW / 8, o.gateH / 2, 0.2], 4));
    }
    for (let y = 0; y < 4; y++) {
      g.add(_cyl(0.01, 0.01, o.gateW, M.metal(0x3a3a3a),
        [0, 0.2 + y * o.gateH / 4, 0.2], 4));
      g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    }
    return g;
  }, {
    icon: "🏰", category: "structure",
    params: [
      { key: "gateW", label: "Gate W", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "gateH", label: "Gate H", type: "number", min: 2.0, max: 4.0, step: 0.3, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 4.0, max: 8.0, step: 0.5, default: 5.0 },
      { key: "bridgeLen", label: "Bridge L", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.5 },
      { key: "stoneColor", label: "Stone", type: "color", default: 0x5a5248 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x4a3018 },
    ],
  });

  register("siege_wall_section", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // damaged wall (main body with chunks missing)
    g.add(_box(o.length, o.height * 0.7, o.thickness, st, [0, o.height * 0.35, 0]));
    // partial upper section (damaged)
    g.add(_box(o.length * 0.4, o.height * 0.3, o.thickness, st,
      [-o.length * 0.25, o.height * 0.85, 0]));
    g.add(_box(o.length * 0.25, o.height * 0.2, o.thickness, st,
      [o.length * 0.3, o.height * 0.8, 0]));
    // rubble at base
    for (let i = 0; i < 8; i++) {
      const x = rand(-o.length / 2, o.length / 2);
      g.add(_sph(rand(0.08, 0.2), M.stone(_c(o.color) + Math.floor(rand(-8, 8))),
        [x, rand(0.05, 0.15), o.thickness / 2 + rand(0.1, 0.5)], 5));
    }
    // fallen blocks
    for (let i = 0; i < 3; i++) {
      const s = rand(0.15, 0.3);
      g.add(_box(s, s, s, M.stone(_c(o.color) + Math.floor(rand(-6, 6))),
        [rand(-o.length * 0.3, o.length * 0.3), s / 2, o.thickness / 2 + rand(0.3, 0.8)]));
    }
    return g;
  }, {
    icon: "🧱", category: "structure",
    params: [
      { key: "length", label: "Length", type: "number", min: 2.0, max: 10.0, step: 0.5, default: 5.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 5.0, step: 0.5, default: 3.0 },
      { key: "thickness", label: "Thickness", type: "number", min: 0.3, max: 0.8, step: 0.1, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a5248 },
    ],
  });

  register("forge", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.stoneColor);
    const w = M.wood(o.woodColor);
    // stone base
    g.add(_box(o.width, o.baseH, o.depth, st, [0, o.baseH / 2, 0]));
    // chimney
    g.add(_box(o.width * 0.4, o.chimneyH, o.depth * 0.5, st,
      [-o.width * 0.2, o.baseH + o.chimneyH / 2, -o.depth * 0.15]));
    // fire pit (opening)
    g.add(_box(o.width * 0.5, o.baseH * 0.5, 0.1, M.metal(0x0a0808),
      [0, o.baseH * 0.5, o.depth / 2 + 0.01]));
    // embers
    g.add(_box(o.width * 0.4, 0.04, o.depth * 0.3, M.ceramic(0xc83010),
      [0, o.baseH * 0.25, 0]));
    // bellows (side)
    g.add(_box(0.2, 0.15, 0.3, M.wood(0x4a3018), [o.width / 2 + 0.12, o.baseH * 0.7, 0]));
    // anvil nearby
    g.add(_box(0.2, 0.12, 0.12, M.metal(0x2a2a2a), [o.width * 0.6, 0.06, o.depth * 0.3]));
    g.add(_box(0.25, 0.04, 0.12, M.metal(0x2a2a2a), [o.width * 0.6, 0.14, o.depth * 0.3]));
    // water trough
    g.add(_box(0.3, 0.1, 0.15, w, [o.width * 0.6, 0.05, -o.depth * 0.3]));
    g.add(_box(0.26, 0.02, 0.11, M.glass(0x4a6a7a), [o.width * 0.6, 0.09, -o.depth * 0.3]));
    // roof (lean-to)
    const roofLen = Math.sqrt(o.depth * o.depth + 0.5 * 0.5);
    const roofPanel = _box(o.width + 0.3, 0.04, roofLen, w,
      [0, o.baseH + o.chimneyH * 0.4, o.depth * 0.15]);
    roofPanel.rotation.x = -0.15;
    g.add(roofPanel);
    return g;
  }, {
    icon: "🔥", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
      { key: "depth", label: "Depth", type: "number", min: 1.0, max: 2.5, step: 0.2, default: 1.5 },
      { key: "baseH", label: "Base H", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.9 },
      { key: "chimneyH", label: "Chimney H", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
      { key: "stoneColor", label: "Stone", type: "color", default: 0x4a4038 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x5a3a1a },
    ],
  });

  register("town_gate", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    const w = M.wood(0x3a2818);
    // wall sections on each side
    g.add(_box(o.wallLen, o.height, o.thickness, st,
      [-o.gateW / 2 - o.wallLen / 2, o.height / 2, 0]));
    g.add(_box(o.wallLen, o.height, o.thickness, st,
      [o.gateW / 2 + o.wallLen / 2, o.height / 2, 0]));
    // gate arch
    g.add(_box(o.gateW + o.thickness, o.height * 0.25, o.thickness, st,
      [0, o.height - o.height * 0.125, 0]));
    // arch curve
    const archMesh = new THREE.Mesh(
      new THREE.TorusGeometry(o.gateW / 2, o.thickness / 2, 6, 12, Math.PI), st);
    archMesh.position.set(0, o.height * 0.75, 0);
    archMesh.rotation.z = -Math.PI / 2;
    g.add(archMesh);
    // gate doors
    g.add(_box(o.gateW / 2 - 0.05, o.height * 0.7, 0.05, w,
      [-o.gateW / 4, o.height * 0.35, o.thickness / 2 + 0.025]));
    g.add(_box(o.gateW / 2 - 0.05, o.height * 0.7, 0.05, w,
      [o.gateW / 4, o.height * 0.35, o.thickness / 2 + 0.025]));
    // crenellations along top
    for (let i = -4; i <= 4; i++) {
      const x = i * 0.35;
      if (Math.abs(x) < o.gateW / 2 + 0.2 && Math.abs(x) > o.gateW / 2 - 0.2) continue;
      if (i % 2 === 0) {
        g.add(_box(0.2, 0.25, o.thickness, st, [x < 0 ? x - o.wallLen / 2 + o.gateW / 2 : x + o.wallLen / 2 - o.gateW / 2, o.height + 0.12, 0]));
      }
    }
    return g;
  }, {
    icon: "🏰", category: "structure",
    params: [
      { key: "gateW", label: "Gate W", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "height", label: "Height", type: "number", min: 3.0, max: 6.0, step: 0.5, default: 4.0 },
      { key: "wallLen", label: "Wall Len", type: "number", min: 1.0, max: 5.0, step: 0.5, default: 3.0 },
      { key: "thickness", label: "Thickness", type: "number", min: 0.3, max: 0.8, step: 0.1, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a5248 },
    ],
  });

  register("aqueduct", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    const arches = o.arches;
    const spanW = o.length / arches;
    // pillars
    for (let i = 0; i <= arches; i++) {
      const x = -o.length / 2 + i * spanW;
      g.add(_box(o.pillarW, o.height, o.depth, st, [x, o.height / 2, 0]));
    }
    // arches
    for (let i = 0; i < arches; i++) {
      const cx = -o.length / 2 + spanW / 2 + i * spanW;
      const archR = (spanW - o.pillarW) / 2;
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(archR, o.depth / 2, 6, 12, Math.PI), st);
      arch.position.set(cx, o.height * 0.6, 0);
      arch.rotation.z = -Math.PI / 2;
      g.add(arch);
    }
    // top channel
    g.add(_box(o.length + o.pillarW, 0.15, o.depth + 0.1, st,
      [0, o.height + 0.075, 0]));
    // water channel on top
    g.add(_box(o.length, 0.04, o.depth * 0.5, M.glass(0x4a7a9a),
      [0, o.height + 0.17, 0]));
    return g;
  }, {
    icon: "🏛️", category: "structure",
    params: [
      { key: "length", label: "Length", type: "number", min: 4.0, max: 20.0, step: 1.0, default: 10.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 6.0, step: 0.5, default: 4.0 },
      { key: "arches", label: "Arches", type: "int", min: 2, max: 8, default: 4 },
      { key: "pillarW", label: "Pillar W", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
      { key: "depth", label: "Depth", type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0x8a8070 },
    ],
  });
})();
