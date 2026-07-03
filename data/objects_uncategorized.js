// category: "uncategorized"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("chest_2", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // box
    g.add(_box(o.width, o.height * 0.65, o.depth, w, [0, o.height * 0.325, 0]));
    // lid (half-cylinder)
    const lidGeo = new THREE.CylinderGeometry(o.depth / 2, o.depth / 2, o.width, 16, 1, false, 0, Math.PI);
    const lid = new THREE.Mesh(lidGeo, w);
    lid.rotation.z = Math.PI / 2;
    lid.position.y = o.height * 0.65;
    g.add(lid);
    // iron straps
    for (let i = -1; i <= 1; i++) {
      g.add(_box(o.width + 0.02, 0.04, o.depth + 0.02, M.metal(0x3a3a3a),
        [0, o.height * 0.15 + i * o.height * 0.2, 0]));
    }
    // lock
    g.add(_box(0.06, 0.06, 0.02, M.brass(), [0, o.height * 0.35, o.depth / 2 + 0.01]));
    return g;
  }, {
    icon: "📦", category: "decorative",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.4, max: 1.5, step: 0.1, default: 0.8 },
      { key: "height", label: "Height", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.50 },
      { key: "depth",  label: "Depth",  type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.45 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a3a1a },
    ],
  });

  register("piano_2", function (o) {
    const g = new THREE.Group();
    const bMat = M.wood(o.color);
    const wMat = new THREE.MeshStandardMaterial({ color: 0xf0eee8, roughness: 0.3, metalness: 0.0 });
    const kMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.0 });
    const w = o.width;
    // body
    g.add(_box(w, 0.12, 0.6, bMat, [0, 0.72, 0]));
    // lid (angled)
    const lid = _box(w, 0.03, 0.58, bMat, [0, 0.88, -0.02]);
    lid.rotation.x = -0.15;
    g.add(lid);
    // legs
    g.add(_box(0.06, 0.66, 0.06, bMat, [-w/2 + 0.06, 0.33, -0.24]));
    g.add(_box(0.06, 0.66, 0.06, bMat, [ w/2 - 0.06, 0.33, -0.24]));
    g.add(_box(0.06, 0.66, 0.06, bMat, [0, 0.33, 0.24]));
    // white keys
    const keyW = w / 52;
    for (let i = 0; i < 52; i++) {
      const kx = -w/2 + keyW/2 + i * keyW;
      g.add(_box(keyW * 0.9, 0.02, 0.14, wMat, [kx, 0.73, 0.22]));
    }
    // black keys (pentatonic pattern)
    const blackPattern = [1,1,0,1,1,1,0]; // relative to octave
    let ki = 0;
    for (let i = 0; i < 52; i++) {
      if (blackPattern[ki % 7]) {
        const kx = -w/2 + keyW * (i + 0.65);
        g.add(_box(keyW * 0.55, 0.025, 0.08, kMat, [kx, 0.745, 0.18]));
      }
      ki++;
    }
    // pedals
    for (let p = -1; p <= 1; p++) {
      g.add(_box(0.04, 0.01, 0.08, M.brass(), [p * 0.08, 0.04, 0.2]));
    }
    return g;
  }, {
    icon: "🎹", category: "furniture",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.0, max: 1.8, step: 0.1, default: 1.4 },
      { key: "color", label: "Body",  type: "color",  default: 0x1a1210 },
    ],
  });

  register("fireplace_2", (opts = {}) => {
    const W = opts.width || 2.0, H = opts.height || 1.6;
    const g = new THREE.Group();
    const stone = M.stone(_c(opts.color, 0x5a4a3a));
    const wood = M.wood(_c(opts.mantelColor, 0x2a1810));
    g.add(_box(W, H, 0.4, stone, [0, H/2, 0]));
    g.add(_box(W*0.45, H*0.44, 0.42, new THREE.MeshStandardMaterial({ color: 0x1a0c08, roughness: 0.95 }), [0, H*0.31, 0.01]));
    g.add(_box(W+0.2, 0.15, 0.55, wood, [0, H+0.075, 0]));
    if (opts.fire !== false) {
      const fire = new THREE.PointLight(_c(opts.fireColor, 0xff8a3a),
        opts.intensity !== undefined ? opts.intensity : 1.2,
        opts.distance !== undefined ? opts.distance : 4, 1.6);
      fire.position.set(0, H*0.25, 0.25); g.add(fire);
    }
    return g;
  }, { icon: "🔥", category: "architecture", params: [
    { key: "width",       label: "Width",       type: "number", min: 1.2, max: 3.5, step: 0.1, default: 2.0 },
    { key: "height",      label: "Height",      type: "number", min: 1.0, max: 2.4, step: 0.05, default: 1.6 },
    { key: "fire",        label: "Fire lit",    type: "bool",   default: true },
    { key: "intensity",   label: "Fire glow",   type: "number", min: 0,   max: 4,   step: 0.05, default: 1.2 },
    { key: "distance",    label: "Glow range",  type: "number", min: 0,   max: 12,  step: 0.5, default: 4 },
    { key: "fireColor",   label: "Flame",       type: "color",  default: 0xff8a3a },
    { key: "color",       label: "Stone",       type: "color",  default: 0x5a4a3a },
    { key: "mantelColor", label: "Mantel",      type: "color",  default: 0x2a1810 },
  ]});

  register("scarecrow_2", function (o) {
    const g = new THREE.Group();
    const w = M.wood(0x5a4a30);
    const cl = M.cloth(o.color);
    // vertical pole
    g.add(_cyl(0.03, 0.035, o.height, w, [0, o.height / 2, 0], 6));
    // horizontal arm pole
    g.add(_cyl(0.025, 0.025, o.armSpan, w, [0, o.height * 0.7, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // head (burlap sack)
    g.add(_sph(0.12, M.rope(0x8a7a50), [0, o.height + 0.12, 0], 10));
    // shirt body
    g.add(_box(0.25, 0.35, 0.15, cl, [0, o.height * 0.6, 0]));
    // sleeves
    g.add(_box(o.armSpan * 0.3, 0.12, 0.1, cl, [-o.armSpan * 0.35, o.height * 0.7, 0]));
    g.add(_box(o.armSpan * 0.3, 0.12, 0.1, cl, [o.armSpan * 0.35, o.height * 0.7, 0]));
    // hat (cone)
    g.add(_cone(0.15, 0.2, M.cloth(0x3a2a18), [0, o.height + 0.32, 0], 8));
    // hat brim
    g.add(_cyl(0.18, 0.18, 0.015, M.cloth(0x3a2a18), [0, o.height + 0.24, 0], 12));
    return g;
  }, {
    icon: "🌾", category: "decorative",
    params: [
      { key: "height",  label: "Height",   type: "number", min: 1.2, max: 2.5, step: 0.1, default: 1.8 },
      { key: "armSpan", label: "Arm Span", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 1.0 },
      { key: "color",   label: "Shirt",    type: "color",  default: 0x6a4a2a },
    ],
  });

  register("stone_wall_2", function (o) {
    const g = new THREE.Group();
    // stacked stones
    const rows = Math.floor(o.height / 0.15);
    const cols = Math.floor(o.length / 0.25);
    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * 0.12;
      for (let c = 0; c < cols; c++) {
        const sw = rand(0.18, 0.28), sh = rand(0.10, 0.15);
        const x = -o.length / 2 + 0.14 + c * 0.25 + offset;
        if (x > o.length / 2 - 0.1) continue;
        const variation = Math.floor(rand(-10, 10));
        g.add(_box(sw, sh, o.thickness, M.stone(_c(o.color) + variation),
          [x, r * 0.14 + sh / 2, 0]));
      }
    }
    return g;
  }, {
    icon: "🧱", category: "structure",
    params: [
      { key: "length",    label: "Length",    type: "number", min: 1.0, max: 10.0, step: 0.5, default: 3.0 },
      { key: "height",    label: "Height",    type: "number", min: 0.4, max: 2.0,  step: 0.2, default: 1.0 },
      { key: "thickness", label: "Thickness", type: "number", min: 0.2, max: 0.6,  step: 0.05, default: 0.35 },
      { key: "color",     label: "Color",     type: "color",  default: 0x5a5248 },
    ],
  });

  register("wooden_bridge_2", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const rope = M.rope(o.ropeColor);
    // deck planks
    const plankCount = Math.floor(o.length / 0.12);
    for (let i = 0; i < plankCount; i++) {
      const z = -o.length / 2 + 0.06 + i * 0.12;
      g.add(_box(o.width, 0.04, 0.10, w, [0, 0, z]));
    }
    // side beams
    g.add(_box(0.06, 0.06, o.length, w, [-o.width / 2, -0.02, 0]));
    g.add(_box(0.06, 0.06, o.length, w, [o.width / 2, -0.02, 0]));
    // rope railings
    for (let side = -1; side <= 1; side += 2) {
      // posts
      for (let i = 0; i < 5; i++) {
        const z = -o.length / 2 + 0.1 + i * (o.length - 0.2) / 4;
        g.add(_cyl(0.02, 0.02, o.railH, w, [side * o.width / 2, o.railH / 2, z], 6));
      }
      // rope lines
      g.add(_cyl(0.01, 0.01, o.length, rope, [side * o.width / 2, o.railH * 0.9, 0], 6));
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      g.add(_cyl(0.01, 0.01, o.length, rope, [side * o.width / 2, o.railH * 0.5, 0], 6));
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    }
    return g;
  }, {
    icon: "🌉", category: "structure",
    params: [
      { key: "width",     label: "Width",  type: "number", min: 0.8, max: 3.0, step: 0.2,  default: 1.4 },
      { key: "length",    label: "Length", type: "number", min: 2.0, max: 8.0, step: 0.5,  default: 4.0 },
      { key: "railH",     label: "Rail H", type: "number", min: 0.5, max: 1.2, step: 0.1,  default: 0.8 },
      { key: "color",     label: "Wood",   type: "color",  default: 0x5a3a1a },
      { key: "ropeColor", label: "Rope",   type: "color",  default: 0x8a7a60 },
    ],
  });

  register("thatched_roof_2", function (o) {
    const g = new THREE.Group();
    const thatch = M.rope(o.color);
    // main roof volume (two sloped planes)
    const halfW = o.width / 2;
    const slopeLen = Math.sqrt(halfW * halfW + o.peakH * o.peakH);
    const angle = Math.atan2(o.peakH, halfW);
    // left slope
    const left = _box(slopeLen, 0.15, o.depth, thatch, [-halfW / 2, o.peakH / 2, 0]);
    left.rotation.z = angle;
    g.add(left);
    // right slope
    const right = _box(slopeLen, 0.15, o.depth, thatch, [halfW / 2, o.peakH / 2, 0]);
    right.rotation.z = -angle;
    g.add(right);
    // ridge beam
    g.add(_cyl(0.04, 0.04, o.depth + 0.1, M.wood(0x4a3018), [0, o.peakH, 0], 6));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // overhang layers (thatch thickness)
    for (let i = 0; i < 3; i++) {
      const ly = -0.05 - i * 0.04;
      const lLeft = _box(slopeLen, 0.04, o.depth + 0.05,
        M.rope(_c(o.color) + i * 0x040404), [-halfW / 2, o.peakH / 2 + ly, 0]);
      lLeft.rotation.z = angle;
      g.add(lLeft);
      const lRight = _box(slopeLen, 0.04, o.depth + 0.05,
        M.rope(_c(o.color) + i * 0x040404), [halfW / 2, o.peakH / 2 + ly, 0]);
      lRight.rotation.z = -angle;
      g.add(lRight);
    }
    return g;
  }, {
    icon: "🏠", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "depth", label: "Depth", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "peakH", label: "Peak H", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.0 },
      { key: "color", label: "Color",  type: "color",  default: 0x8a7a50 },
    ],
  });

  register("stone_platform_2", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // main platform
    g.add(_box(o.width, o.height, o.depth, st, [0, o.height / 2, 0]));
    // edge trim (slightly wider base course)
    g.add(_box(o.width + 0.08, 0.06, o.depth + 0.08, st, [0, 0.03, 0]));
    // top edge molding
    g.add(_box(o.width + 0.04, 0.04, o.depth + 0.04,
      M.stone(_c(o.color) + 0x080808), [0, o.height + 0.02, 0]));
    return g;
  }, {
    icon: "🟫", category: "terrain",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 1.0, max: 8.0, step: 0.5, default: 3.0 },
      { key: "depth",  label: "Depth",  type: "number", min: 1.0, max: 8.0, step: 0.5, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 0.1, max: 1.5, step: 0.1, default: 0.3 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a5248 },
    ],
  });

  register("scarecrow_3", function (o) {
    const g = new THREE.Group();
    const w = M.wood(0x4a3018);
    const cl = M.cloth(o.color);
    // post
    g.add(_cyl(0.025, 0.03, o.height, w, [0, o.height / 2, 0], 5));
    // crossbar (arms)
    g.add(_cyl(0.02, 0.02, o.armSpan, w, [0, o.height * 0.65, 0], 5));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // head (sack)
    g.add(_sph(0.08, M.rope(0x9a8a60), [0, o.height * 0.85, 0], 8));
    // hat
    g.add(_cyl(0.1, 0.1, 0.01, cl, [0, o.height * 0.92, 0], 8));
    g.add(_cyl(0.06, 0.06, 0.08, cl, [0, o.height * 0.96, 0], 8));
    // shirt body
    g.add(_box(0.18, 0.25, 0.1, cl, [0, o.height * 0.55, 0]));
    // sleeves
    g.add(_box(o.armSpan * 0.3, 0.08, 0.08, cl, [-o.armSpan * 0.3, o.height * 0.65, 0]));
    g.add(_box(o.armSpan * 0.3, 0.08, 0.08, cl, [o.armSpan * 0.3, o.height * 0.65, 0]));
    // pants
    g.add(_box(0.08, 0.2, 0.08, M.cloth(0x3a3a5a), [-0.05, o.height * 0.3, 0]));
    g.add(_box(0.08, 0.2, 0.08, M.cloth(0x3a3a5a), [0.05, o.height * 0.3, 0]));
    // straw sticking out
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2);
      const from = pick(['sleeve', 'pants', 'neck']);
      let pos;
      if (from === 'sleeve') pos = [rand(-1, 1) * o.armSpan * 0.45, o.height * 0.65, 0];
      else if (from === 'pants') pos = [rand(-0.08, 0.08), o.height * 0.2, 0];
      else pos = [rand(-0.05, 0.05), o.height * 0.72, 0];
      const straw = _cyl(0.004, 0.003, 0.08, M.rope(0xb8a840), pos, 3);
      straw.rotation.z = rand(-0.5, 0.5);
      straw.rotation.x = rand(-0.3, 0.3);
      g.add(straw);
    }
    return g;
  }, {
    icon: "🌾", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 1.0, max: 2.5, step: 0.2, default: 1.8 },
      { key: "armSpan", label: "Arm Span", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.9 },
      { key: "color", label: "Shirt", type: "color", default: 0x8a4020 },
    ],
  });

  register("fireplace_3", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    const w = M.wood(0x3a2010);
    // back wall
    g.add(_box(o.width, o.height, 0.15, st, [0, o.height / 2, -o.depth / 2]));
    // side walls
    g.add(_box(0.12, o.height, o.depth, st, [-o.width / 2, o.height / 2, 0]));
    g.add(_box(0.12, o.height, o.depth, st, [o.width / 2, o.height / 2, 0]));
    // firebox (dark interior)
    g.add(_box(o.width - 0.28, o.openH, o.depth - 0.15, M.metal(0x0a0808),
      [0, o.openH / 2, 0.075]));
    // hearth floor
    g.add(_box(o.width + 0.2, 0.06, o.depth + 0.3, st, [0, 0.03, 0.15]));
    // mantle
    g.add(_box(o.width + 0.15, 0.08, o.depth * 0.5, w, [0, o.openH + 0.04, o.depth * 0.15]));
    // lintel
    g.add(_box(o.width - 0.2, 0.1, 0.12, st, [0, o.openH, o.depth / 2]));
    // chimney (above)
    g.add(_box(o.width * 0.5, o.height * 0.5, 0.3, st,
      [0, o.height + o.height * 0.25, -o.depth / 2 + 0.15]));
    // logs
    for (let i = 0; i < 3; i++) {
      const log = _cyl(0.03, 0.025, o.width * 0.4, w, [0, 0.09 + i * 0.015, i * 0.04 - 0.05], 5);
      log.rotation.z = Math.PI / 2;
      g.add(log);
    }
    // fire
    g.add(_cone(0.08, 0.2, M.ceramic(0xe86010), [0, 0.15, -0.02], 6));
    g.add(_cone(0.05, 0.15, M.ceramic(0xf0a020), [0.04, 0.13, 0.02], 5));
    return g;
  }, {
    icon: "🔥", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.8, max: 2.0, step: 0.2, default: 1.2 },
      { key: "height", label: "Height", type: "number", min: 1.0, max: 2.0, step: 0.2, default: 1.4 },
      { key: "depth", label: "Depth", type: "number", min: 0.3, max: 0.8, step: 0.1, default: 0.5 },
      { key: "openH", label: "Open H", type: "number", min: 0.5, max: 1.2, step: 0.1, default: 0.8 },
      { key: "color", label: "Color", type: "color", default: 0x5a5248 },
    ],
  });

  register("fireplace_4", function ({ width = 1.6, height = 2.6 } = {}) {
  const g = new THREE.Group();
  g.add(_box(0.3, height, width, M.stone(0x3a3028), [0, height / 2, 0]));
  g.add(_box(0.32, height * 0.4, width * 0.55, _mat("void", 0x0c0805, { roughness: 1 }), [0.05, height * 0.22, 0]));
  g.add(_box(0.5, 0.12, width * 1.15, M.wood(0x3a2818), [0, height * 0.6, 0]));
  const fire = new THREE.PointLight(0xff7a2a, 2.4, 6, 1.6);
  fire.position.set(0.35, 0.6, 0);
  fire.userData.flicker = { base: 2.0, jitter: 0.45 };
  g.add(fire);
  g.userData.fire = fire;
  return g;
}, { category: "architecture" });
})();
