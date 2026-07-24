// category: "military"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("rowboat", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const l = o.length, w = 0.6;
    // hull (lathe profile)
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const r2 = w * 0.5 * Math.sin(t * Math.PI);
      pts.push(new THREE.Vector2(r2, (t - 0.5) * l));
    }
    const hullGeo = new THREE.LatheGeometry(pts, 12);
    const hull = new THREE.Mesh(hullGeo, mat);
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.15;
    g.add(hull);
    // bench seats
    for (let i = -1; i <= 1; i++) {
      g.add(_box(w * 0.7, 0.03, 0.12, mat, [0, 0.22, i * l * 0.25]));
    }
    // oars
    if (o.hasOars) {
      const oarMat = M.wood(0x5a4a38);
      for (let s = -1; s <= 1; s += 2) {
        const oar = _box(0.03, 0.03, 1.2, oarMat, [s * 0.5, 0.3, 0]);
        oar.rotation.y = s * 0.2;
        oar.rotation.z = s * -0.15;
        g.add(oar);
        // blade
        g.add(_box(0.12, 0.02, 0.2, oarMat, [s * 0.95, 0.15, 0]));
      }
    }
    return g;
  }, {
    icon: "🚣", category: "props",
    params: [
      { key: "length",  label: "Length",  type: "number", min: 1.5, max: 4.0, step: 0.25, default: 2.5 },
      { key: "hasOars", label: "Oars",    type: "bool",   default: true },
      { key: "color",   label: "Wood",    type: "color",  default: 0x6b4a2b },
    ],
  });

  register("gallows", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // vertical post
    g.add(_box(0.12, o.height, 0.12, w, [0, o.height / 2, 0]));
    // horizontal beam
    g.add(_box(o.armLen, 0.1, 0.1, w, [o.armLen / 2, o.height - 0.05, 0]));
    // diagonal brace
    const braceLen = Math.sqrt(o.armLen * o.armLen * 0.25 + o.height * o.height * 0.04);
    const brace = _box(0.06, braceLen, 0.06, w, [o.armLen * 0.25, o.height * 0.85, 0]);
    brace.rotation.z = Math.atan2(o.armLen * 0.5, o.height * 0.2);
    g.add(brace);
    // rope
    const ropeLen = o.height * 0.35;
    g.add(_cyl(0.01, 0.01, ropeLen, M.rope(), [o.armLen, o.height - 0.1 - ropeLen / 2, 0], 6));
    // noose loop
    g.add(_tor(0.06, 0.01, M.rope(), [o.armLen, o.height - 0.1 - ropeLen, 0], 6, 12));
    // base platform
    g.add(_box(0.6, 0.08, 0.5, w, [0.15, 0.04, 0]));
    return g;
  }, {
    icon: "⚰️", category: "structure",
    params: [
      { key: "height", label: "Height", type: "number", min: 2.0, max: 4.0, step: 0.2, default: 3.0 },
      { key: "armLen", label: "Arm",    type: "number", min: 0.6, max: 1.5, step: 0.1, default: 1.0 },
      { key: "color",  label: "Color",  type: "color",  default: 0x3a2a18 },
    ],
  });

  register("stocks", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // two vertical posts
    g.add(_box(0.1, o.height, 0.1, w, [-o.width / 2, o.height / 2, 0]));
    g.add(_box(0.1, o.height, 0.1, w, [o.width / 2, o.height / 2, 0]));
    // lower plank (fixed)
    g.add(_box(o.width, 0.06, 0.18, w, [0, o.height * 0.65, 0]));
    // upper plank (the locking one)
    g.add(_box(o.width, 0.06, 0.18, w, [0, o.height * 0.65 + 0.06, 0]));
    // head hole (implied by notch – two small boxes framing it)
    const holeR = 0.08;
    g.add(_box(o.width / 2 - holeR - 0.05, 0.12, 0.04, w, [-o.width / 4 - holeR / 2, o.height * 0.65 + 0.03, 0.08]));
    g.add(_box(o.width / 2 - holeR - 0.05, 0.12, 0.04, w, [o.width / 4 + holeR / 2, o.height * 0.65 + 0.03, 0.08]));
    // base
    g.add(_box(o.width + 0.2, 0.05, 0.3, w, [0, 0.025, 0]));
    return g;
  }, {
    icon: "⛓️", category: "structure",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.6, max: 1.5, step: 0.1, default: 1.0 },
      { key: "height", label: "Height", type: "number", min: 0.8, max: 1.6, step: 0.1, default: 1.2 },
      { key: "color",  label: "Color",  type: "color",  default: 0x4a3220 },
    ],
  });

  register("iron_maiden", function (o) {
    const g = new THREE.Group();
    const met = M.metal(o.color);
    // body (tall box, slightly tapered feel via two boxes)
    g.add(_box(o.width, o.height, o.depth, met, [0, o.height / 2, 0]));
    // front door (slightly offset)
    g.add(_box(o.width * 0.95, o.height * 0.95, 0.03, met, [0, o.height / 2, o.depth / 2 + 0.015]));
    // face outline on door (crude: small sphere for face area)
    g.add(_sph(0.08, M.metal(0x1a1a1a), [0, o.height * 0.8, o.depth / 2 + 0.04], 8));
    // spikes (small cones on the inside door face, pointing inward)
    const spikePositions = [
      [0, o.height * 0.6], [0.06, o.height * 0.5], [-0.06, o.height * 0.5],
      [0.04, o.height * 0.35], [-0.04, o.height * 0.35], [0, o.height * 0.25],
    ];
    spikePositions.forEach(([x, y]) => {
      const spike = _cone(0.01, 0.06, M.metal(0x1a1510), [x, y, o.depth / 2 - 0.03], 4);
      spike.rotation.x = Math.PI;
      g.add(spike);
    });
    // hinges
    g.add(_box(0.03, 0.06, 0.04, M.rust(), [-o.width / 2, o.height * 0.75, o.depth / 2]));
    g.add(_box(0.03, 0.06, 0.04, M.rust(), [-o.width / 2, o.height * 0.3, o.depth / 2]));
    return g;
  }, {
    icon: "⚔️", category: "props",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.4, max: 0.8, step: 0.05, default: 0.55 },
      { key: "height", label: "Height", type: "number", min: 1.4, max: 2.2, step: 0.1,  default: 1.8 },
      { key: "depth",  label: "Depth",  type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.4 },
      { key: "color",  label: "Color",  type: "color",  default: 0x2a2520 },
    ],
  });

  register("trebuchet", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(0x3a3a3a);
    // base frame
    g.add(_box(o.baseW, 0.08, o.baseD, w, [0, 0.04, 0]));
    // A-frame supports
    for (let side = -1; side <= 1; side += 2) {
      g.add(_box(0.08, o.frameH, 0.08, w, [side * o.baseW * 0.35, o.frameH / 2, 0]));
      const brace = _box(0.06, o.frameH * 0.8, 0.06, w, [0, 0, 0]);
      brace.position.set(side * o.baseW * 0.35, o.frameH * 0.35, o.baseD * 0.25);
      brace.rotation.x = side > 0 ? 0.4 : -0.4;
      g.add(brace);
    }
    // axle
    g.add(_cyl(0.04, 0.04, o.baseW * 0.8, met, [0, o.frameH, 0], 8));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // beam (long arm + short counterweight arm)
    const beamLen = o.baseW * 1.2;
    const beam = _box(beamLen, 0.06, 0.08, w, [beamLen * 0.15, o.frameH + 0.03, 0]);
    beam.rotation.z = 0.2;
    g.add(beam);
    // counterweight box
    g.add(_box(0.25, 0.3, 0.25, met, [-beamLen * 0.35, o.frameH - 0.2, 0]));
    // sling bucket
    g.add(_cyl(0.06, 0.08, 0.05, w, [beamLen * 0.6, o.frameH - 0.1, 0], 8));
    // wheels
    for (let zi = -1; zi <= 1; zi += 2) {
      g.add(_tor(0.15, 0.025, w, [-o.baseW * 0.4, 0.15, zi * o.baseD * 0.4], 10, 5));
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    }
    return g;
  }, {
    icon: "⚔️", category: "props",
    params: [
      { key: "baseW", label: "Base W", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "baseD", label: "Base D", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.5 },
      { key: "frameH", label: "Frame H", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("siege_tower", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(0x3a3a3a);
    // corner posts
    const hw = o.size / 2;
    [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw]].forEach(([x, z]) => {
      g.add(_cyl(0.06, 0.06, o.height, w, [x, o.height / 2, z], 6));
    });
    // floor platforms every 1.5m
    const floors = Math.floor(o.height / 1.5);
    for (let f = 0; f <= floors; f++) {
      g.add(_box(o.size, 0.04, o.size, w, [0, f * 1.5 + 0.02, 0]));
    }
    // cross bracing on sides
    for (let f = 0; f < floors; f++) {
      const y = f * 1.5 + 0.75;
      g.add(_box(0.03, o.size * 1.8, 0.03, w, [hw, y, 0]));
      g.children[g.children.length - 1].rotation.z = 0.5;
      g.add(_box(0.03, o.size * 1.8, 0.03, w, [-hw, y, 0]));
      g.children[g.children.length - 1].rotation.z = -0.5;
    }
    // crenellations on top
    for (let i = -2; i <= 2; i++) {
      g.add(_box(0.15, 0.25, 0.1, w, [i * 0.2, o.height + 0.125, hw]));
      g.add(_box(0.15, 0.25, 0.1, w, [i * 0.2, o.height + 0.125, -hw]));
    }
    // drawbridge at top (front)
    g.add(_box(o.size * 0.7, 0.03, 0.5, w, [0, o.height - 0.3, hw + 0.25]));
    g.children[g.children.length - 1].rotation.x = 0.3;
    // wheels
    for (let x = -1; x <= 1; x += 2) {
      for (let z = -1; z <= 1; z += 2) {
        g.add(_tor(0.2, 0.03, w, [x * hw, 0.2, z * hw], 10, 5));
        g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      }
    }
    return g;
  }, {
    icon: "🏰", category: "props",
    params: [
      { key: "size", label: "Size", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "height", label: "Height", type: "number", min: 4.0, max: 10.0, step: 0.5, default: 6.0 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("catapult", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(0x3a3a3a);
    // base platform
    g.add(_box(o.length, 0.06, o.width, w, [0, 0.03, 0]));
    // side frames
    for (let z = -1; z <= 1; z += 2) {
      g.add(_box(0.06, o.frameH, 0.06, w, [0, o.frameH / 2, z * o.width * 0.4]));
      g.add(_box(0.06, o.frameH * 0.7, 0.06, w, [-o.length * 0.2, o.frameH * 0.35, z * o.width * 0.4]));
    }
    // throwing arm
    const arm = _box(o.length * 0.9, 0.05, 0.05, w, [o.length * 0.1, o.frameH, 0]);
    arm.rotation.z = -0.3;
    g.add(arm);
    // bucket
    g.add(_box(0.2, 0.08, 0.2, w, [o.length * 0.45, o.frameH + 0.3, 0]));
    // rope bundle (torsion)
    g.add(_cyl(0.06, 0.06, o.width * 0.6, M.rope(0x8a7a60), [0, o.frameH * 0.7, 0], 8));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // wheels
    for (let x = -1; x <= 1; x += 2) {
      g.add(_tor(0.12, 0.02, w, [x * o.length * 0.35, 0.12, o.width * 0.45], 10, 5));
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      g.add(_tor(0.12, 0.02, w, [x * o.length * 0.35, 0.12, -o.width * 0.45], 10, 5));
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    }
    return g;
  }, {
    icon: "🏹", category: "props",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "width", label: "Width", type: "number", min: 0.8, max: 2.0, step: 0.2, default: 1.2 },
      { key: "frameH", label: "Frame H", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("battering_ram", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(0x3a3a3a);
    // overhead frame
    const hw = o.width / 2;
    [[-hw, -o.length / 2], [hw, -o.length / 2], [-hw, o.length / 2], [hw, o.length / 2]].forEach(([x, z]) => {
      g.add(_cyl(0.06, 0.06, o.frameH, w, [x, o.frameH / 2, z], 6));
    });
    // top beams
    g.add(_box(o.width, 0.06, 0.06, w, [0, o.frameH, -o.length / 2]));
    g.add(_box(o.width, 0.06, 0.06, w, [0, o.frameH, o.length / 2]));
    g.add(_box(0.06, 0.06, o.length, w, [-hw, o.frameH, 0]));
    g.add(_box(0.06, 0.06, o.length, w, [hw, o.frameH, 0]));
    // ram log (suspended)
    g.add(_cyl(0.1, 0.08, o.length * 0.8, w, [0, o.frameH * 0.6, 0], 10));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // iron head
    g.add(_cone(0.12, 0.2, met, [0, o.frameH * 0.6, o.length * 0.4 + 0.1], 8));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // chains suspending ram
    for (let i = -1; i <= 1; i += 2) {
      g.add(_cyl(0.01, 0.01, o.frameH * 0.35, met,
        [0, o.frameH * 0.8, i * o.length * 0.2], 4));
    }
    // roof covering
    g.add(_box(o.width + 0.2, 0.04, o.length + 0.2, M.rope(0x6a5a40), [0, o.frameH + 0.05, 0]));
    // wheels
    for (let x = -1; x <= 1; x += 2) {
      for (let z = -1; z <= 1; z += 2) {
        g.add(_tor(0.15, 0.025, w, [x * hw, 0.15, z * o.length * 0.35], 10, 5));
        g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      }
    }
    return g;
  }, {
    icon: "🔨", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.0, max: 2.5, step: 0.2, default: 1.5 },
      { key: "length", label: "Length", type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.0 },
      { key: "frameH", label: "Frame H", type: "number", min: 1.5, max: 3.5, step: 0.3, default: 2.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("palisade", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const logR = 0.06;
    const count = Math.floor(o.length / (logR * 2.2));
    for (let i = 0; i < count; i++) {
      const x = -o.length / 2 + logR + i * (o.length / count);
      const h = o.height + rand(-0.1, 0.1);
      g.add(_cyl(logR, logR * 0.8, h, M.wood(_c(o.color) + Math.floor(rand(-6, 6))),
        [x, h / 2, 0], 6));
      // sharpened top
      g.add(_cone(logR * 0.8, 0.1, w, [x, h + 0.05, 0], 6));
    }
    // horizontal brace
    g.add(_cyl(0.04, 0.04, o.length, w, [0, o.height * 0.4, -logR - 0.02], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    g.add(_cyl(0.04, 0.04, o.length, w, [0, o.height * 0.75, -logR - 0.02], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    return g;
  }, {
    icon: "🪵", category: "structure",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.0, max: 10.0, step: 0.5, default: 4.0 },
      { key: "height", label: "Height", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 2.0 },
      { key: "color", label: "Color", type: "color", default: 0x4a3018 },
    ],
  });

  register("archery_target", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.frameColor);
    // stand legs (A-frame)
    for (let side = -1; side <= 1; side += 2) {
      const leg = _box(0.04, o.height * 1.2, 0.04, w, [side * 0.3, o.height * 0.55, 0.15]);
      leg.rotation.x = 0.15;
      g.add(leg);
    }
    // crossbar
    g.add(_box(0.7, 0.04, 0.04, w, [0, o.height * 0.85, 0]));
    // target face
    const rings = [
      { r: o.targetR, c: 0xf0f0f0 },
      { r: o.targetR * 0.8, c: 0x2020a0 },
      { r: o.targetR * 0.6, c: 0xa02020 },
      { r: o.targetR * 0.4, c: 0xa02020 },
      { r: o.targetR * 0.2, c: 0xf0e020 },
    ];
    rings.forEach((ring, i) => {
      g.add(_cyl(ring.r, ring.r, 0.02 + i * 0.002, M.ceramic(ring.c),
        [0, o.height * 0.55, -0.01 - i * 0.002], 20));
    });
    // hay bale behind
    g.add(_cyl(o.targetR + 0.05, o.targetR + 0.05, 0.15, M.rope(0x9a8a50),
      [0, o.height * 0.55, -0.08], 16));
    return g;
  }, {
    icon: "🎯", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 1.0, max: 2.5, step: 0.2, default: 1.5 },
      { key: "targetR", label: "Target R", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
      { key: "frameColor", label: "Frame", type: "color", default: 0x5a3a1a },
    ],
  });

  register("training_dummy", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const cl = M.cloth(0x8a7a60);
    // post
    g.add(_cyl(0.04, 0.05, o.height, w, [0, o.height / 2, 0], 6));
    // body (stuffed sack)
    g.add(_cyl(0.15, 0.12, 0.5, cl, [0, o.height * 0.55, 0], 10));
    // head
    g.add(_sph(0.1, cl, [0, o.height * 0.8, 0], 8));
    // arms (horizontal bar)
    g.add(_cyl(0.03, 0.03, 0.6, w, [0, o.height * 0.6, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // shield target on arm
    g.add(_cyl(0.12, 0.12, 0.02, M.wood(0x4a3018), [0.35, o.height * 0.6, 0], 8));
    // base crossbar
    g.add(_box(0.5, 0.06, 0.06, w, [0, 0.03, 0]));
    g.add(_box(0.06, 0.06, 0.5, w, [0, 0.03, 0]));
    return g;
  }, {
    icon: "🎯", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 1.0, max: 2.5, step: 0.2, default: 1.8 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("ship_hull", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // hull (elongated box, tapered at ends via stacking)
    for (let i = 0; i < 5; i++) {
      const y = i * 0.15;
      const taper = 1 - Math.abs(i - 2) * 0.05;
      const lengthTaper = o.length * (0.7 + i * 0.06);
      g.add(_box(lengthTaper, 0.15, o.beam * taper, w,
        [0, y + 0.075, 0]));
    }
    // keel
    g.add(_box(o.length * 0.8, 0.04, 0.06, M.wood(o.color - 0x080808), [0, -0.02, 0]));
    // deck
    g.add(_box(o.length * 0.85, 0.04, o.beam * 0.85, w, [0, 0.77, 0]));
    // bow and stern posts
    g.add(_box(0.06, 0.6, 0.06, w, [o.length * 0.42, 0.6, 0]));
    g.add(_box(0.06, 0.5, 0.06, w, [-o.length * 0.42, 0.55, 0]));
    // railing
    for (let side = -1; side <= 1; side += 2) {
      g.add(_box(o.length * 0.7, 0.03, 0.03, w, [0, 0.95, side * o.beam * 0.4]));
      // stanchions
      for (let i = 0; i < 6; i++) {
        const x = -o.length * 0.3 + i * o.length * 0.12;
        g.add(_cyl(0.015, 0.015, 0.2, w, [x, 0.87, side * o.beam * 0.4], 4));
      }
    }
    // mast
    g.add(_cyl(0.05, 0.04, o.length * 0.5, w, [0, 0.77 + o.length * 0.25, 0], 8));
    // yard arm
    g.add(_cyl(0.025, 0.025, o.beam * 1.2, w, [0, 0.77 + o.length * 0.4, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // sail
    g.add(_box(o.beam * 1.0, o.length * 0.25, 0.01, M.cloth(0xd8d0c0),
      [0, 0.77 + o.length * 0.28, 0]));
    return g;
  }, {
    icon: "⛵", category: "structure",
    params: [
      { key: "length", label: "Length", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "beam", label: "Beam", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.2 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("rowboat", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // hull bottom
    g.add(_box(o.length, 0.04, o.beam * 0.5, w, [0, 0.02, 0]));
    // sides (flared outward)
    for (let side = -1; side <= 1; side += 2) {
      const sidePanel = _box(o.length * 0.9, 0.25, 0.03, w,
        [0, 0.14, side * o.beam * 0.3]);
      sidePanel.rotation.x = side * -0.15;
      g.add(sidePanel);
    }
    // transom (stern)
    g.add(_box(0.03, 0.2, o.beam * 0.55, w, [-o.length * 0.45, 0.12, 0]));
    // bow
    g.add(_box(0.03, 0.25, o.beam * 0.3, w, [o.length * 0.45, 0.14, 0]));
    // seats
    g.add(_box(0.04, 0.15, o.beam * 0.5, w, [-o.length * 0.15, 0.075, 0]));
    g.add(_box(0.04, 0.15, o.beam * 0.5, w, [o.length * 0.15, 0.075, 0]));
    // oars
    for (let side = -1; side <= 1; side += 2) {
      const oar = _cyl(0.012, 0.01, o.length * 0.6, w, [0, 0.2, side * o.beam * 0.35], 4);
      oar.rotation.x = side * 0.3;
      oar.rotation.z = Math.PI / 2;
      g.add(oar);
      // oar blade
      g.add(_box(0.08, 0.02, 0.15, w, [-o.length * 0.3, 0.15, side * (o.beam * 0.5 + 0.1)]));
    }
    return g;
  }, {
    icon: "🚣", category: "props",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
      { key: "beam", label: "Beam", type: "number", min: 0.4, max: 1.0, step: 0.1, default: 0.6 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("pillory", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // post
    g.add(_cyl(0.05, 0.05, o.height, w, [0, o.height / 2, 0], 6));
    // base
    g.add(_box(0.4, 0.06, 0.4, w, [0, 0.03, 0]));
    // crossbar with holes
    g.add(_box(0.7, 0.04, 0.15, w, [0, o.height, 0]));
    // upper half (hinged – slightly offset)
    g.add(_box(0.7, 0.04, 0.15, w, [0, o.height + 0.045, 0]));
    // hole indicators (dark circles)
    const holeMat = M.metal(0x1a1a1a);
    g.add(_cyl(0.06, 0.06, 0.16, holeMat, [0, o.height + 0.02, 0], 10));
    g.add(_cyl(0.04, 0.04, 0.16, holeMat, [-0.2, o.height + 0.02, 0], 8));
    g.add(_cyl(0.04, 0.04, 0.16, holeMat, [0.2, o.height + 0.02, 0], 8));
    // step
    g.add(_box(0.5, 0.08, 0.3, w, [0, 0.04, 0.25]));
    return g;
  }, {
    icon: "⛓️", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 0.8, max: 2.0, step: 0.2, default: 1.3 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("gibbet", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(0x3a3a3a);
    // vertical post
    g.add(_cyl(0.06, 0.06, o.height, w, [0, o.height / 2, 0], 6));
    // horizontal arm
    g.add(_box(o.armLen, 0.06, 0.06, w, [o.armLen / 2 + 0.03, o.height - 0.03, 0]));
    // brace
    g.add(_box(0.04, o.armLen * 0.8, 0.04, w, [o.armLen * 0.3, o.height - o.armLen * 0.3, 0]));
    g.children[g.children.length - 1].rotation.z = 0.7;
    // cage (iron bands forming oval)
    const cageY = o.height - 0.5;
    const cageR = 0.15;
    g.add(_tor(cageR, 0.008, met, [o.armLen, cageY, 0], 10, 4));
    g.add(_tor(cageR, 0.008, met, [o.armLen, cageY, 0], 10, 4));
    g.children[g.children.length - 1].rotation.y = Math.PI / 2;
    // vertical cage bars
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      g.add(_cyl(0.006, 0.006, cageR * 2.5, met,
        [o.armLen + Math.cos(a) * cageR * 0.7, cageY, Math.sin(a) * cageR * 0.7], 4));
    }
    // chain
    g.add(_cyl(0.008, 0.008, 0.3, met, [o.armLen, o.height - 0.15, 0], 4));
    return g;
  }, {
    icon: "⛓️", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.5 },
      { key: "armLen", label: "Arm Len", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.8 },
      { key: "color", label: "Color", type: "color", default: 0x3a2818 },
    ],
  });

  register("crow_nest", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // tall mast
    g.add(_cyl(0.05, 0.04, o.height, w, [0, o.height / 2, 0], 8));
    // platform at top
    g.add(_cyl(o.platformR, o.platformR, 0.04, w, [0, o.height, 0], 10));
    // railing
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(_cyl(0.02, 0.02, 0.5, w,
        [Math.cos(a) * o.platformR, o.height + 0.25, Math.sin(a) * o.platformR], 4));
    }
    g.add(_tor(o.platformR, 0.015, w, [0, o.height + 0.5, 0], 10, 4));
    // ladder rungs
    for (let y = 0.3; y < o.height - 0.3; y += 0.25) {
      g.add(_cyl(0.01, 0.01, 0.2, w, [0.05, y, 0.05], 4));
      g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    }
    return g;
  }, {
    icon: "🔭", category: "structure",
    params: [
      { key: "height", label: "Height", type: "number", min: 3.0, max: 10.0, step: 0.5, default: 6.0 },
      { key: "platformR", label: "Platform R", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("scaffold", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const floors = Math.floor(o.height / 1.2);
    const hw = o.width / 2, hd = o.depth / 2;
    // corner poles
    [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].forEach(([x, z]) => {
      g.add(_cyl(0.03, 0.03, o.height, w, [x, o.height / 2, z], 6));
    });
    // platforms and cross braces
    for (let f = 0; f <= floors; f++) {
      const y = f * 1.2;
      // platform
      g.add(_box(o.width, 0.03, o.depth, w, [0, y, 0]));
      // cross braces (X on front)
      if (f < floors) {
        g.add(_box(0.02, 1.7, 0.02, w, [0, y + 0.6, hd]));
        g.children[g.children.length - 1].rotation.z = 0.5;
        g.add(_box(0.02, 1.7, 0.02, w, [0, y + 0.6, hd]));
        g.children[g.children.length - 1].rotation.z = -0.5;
      }
      // horizontal braces
      g.add(_box(o.width, 0.02, 0.02, w, [0, y + 0.6, -hd]));
      g.add(_box(o.width, 0.02, 0.02, w, [0, y + 0.6, hd]));
    }
    return g;
  }, {
    icon: "🏗️", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.0 },
      { key: "depth", label: "Depth", type: "number", min: 0.5, max: 2.0, step: 0.2, default: 1.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("executioner_block", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // platform
    g.add(_box(o.size, 0.15, o.size, w, [0, 0.075, 0]));
    // steps
    g.add(_box(o.size * 0.4, 0.08, 0.2, w, [0, 0.04, o.size / 2 + 0.1]));
    // chopping block
    g.add(_cyl(0.15, 0.18, 0.2, M.wood(o.color - 0x080808), [0, 0.25, 0], 10));
    // axe marks (dark grooves)
    g.add(_box(0.2, 0.005, 0.005, M.metal(0x1a1a1a), [0, 0.36, 0]));
    return g;
  }, {
    icon: "⚔️", category: "props",
    params: [
      { key: "size", label: "Size", type: "number", min: 0.8, max: 2.0, step: 0.2, default: 1.2 },
      { key: "color", label: "Color", type: "color", default: 0x4a3018 },
    ],
  });

  register("viking_longship", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // hull
    for (let i = 0; i < 4; i++) {
      const y = i * 0.12;
      const taper = 0.7 + i * 0.08;
      g.add(_box(o.length * taper, 0.12, o.beam * (0.6 + i * 0.1), w, [0, y + 0.06, 0]));
    }
    // keel
    g.add(_box(o.length * 0.6, 0.04, 0.05, w, [0, -0.02, 0]));
    // bow dragon head
    g.add(_sph(0.12, w, [o.length * 0.48, 0.5, 0], 8));
    g.add(_cone(0.06, 0.15, w, [o.length * 0.52, 0.55, 0], 5));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // stern post
    g.add(_box(0.04, 0.5, 0.04, w, [-o.length * 0.45, 0.35, 0]));
    g.children[g.children.length - 1].rotation.z = -0.2;
    // mast
    g.add(_cyl(0.04, 0.035, o.length * 0.4, w, [0, o.length * 0.2 + 0.48, 0], 8));
    // yard
    g.add(_cyl(0.025, 0.025, o.beam * 2, w, [0, o.length * 0.35, 0], 6));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // sail (striped)
    g.add(_box(o.beam * 1.5, o.length * 0.2, 0.01, M.cloth(0xc83020), [0, o.length * 0.25, 0]));
    // shields along sides
    for (let i = 0; i < 5; i++) {
      const x = -o.length * 0.25 + i * o.length * 0.12;
      for (let side = -1; side <= 1; side += 2) {
        g.add(_cyl(0.06, 0.06, 0.01, M.ceramic(pick([0xc83020, 0x2040a0, 0xc8a040])),
          [x, 0.4, side * o.beam * 0.42], 8));
      }
    }
    // oar ports
    for (let i = 0; i < 4; i++) {
      const x = -o.length * 0.2 + i * o.length * 0.12;
      for (let side = -1; side <= 1; side += 2) {
        const oar = _cyl(0.008, 0.008, o.beam * 0.8, w, [x, 0.25, side * o.beam * 0.5], 4);
        oar.rotation.x = side * 0.4;
        g.add(oar);
      }
    }
    return g;
  }, {
    icon: "⛵", category: "structure",
    params: [
      { key: "length", label: "Length", type: "number", min: 2.0, max: 6.0, step: 0.5, default: 3.5 },
      { key: "beam", label: "Beam", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.8 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("round_tower_ruin", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // partial cylinder (use multiple boxes to approximate broken wall)
    const segs = 16;
    const breakStart = Math.floor(rand(4, 8));
    const breakEnd = breakStart + Math.floor(rand(2, 5));
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const na = ((i + 1) / segs) * Math.PI * 2;
      const midA = (a + na) / 2;
      const segW = 2 * o.radius * Math.sin(Math.PI / segs);
      let h = o.height;
      if (i >= breakStart && i <= breakEnd) {
        h = o.height * rand(0.2, 0.5);
      }
      const seg = _box(segW, h, o.thickness, st,
        [Math.cos(midA) * o.radius, h / 2, Math.sin(midA) * o.radius]);
      seg.rotation.y = -midA;
      g.add(seg);
    }
    // rubble inside
    for (let i = 0; i < 6; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0, o.radius * 0.7);
      g.add(_sph(rand(0.08, 0.2), M.stone(_c(o.color) - 0x080808),
        [Math.cos(a) * d, rand(0.05, 0.15), Math.sin(a) * d], 5));
    }
    // ivy patches
    for (let i = 0; i < 4; i++) {
      const a = rand(0, Math.PI * 2);
      g.add(_sph(rand(0.1, 0.25), M.leaf(0x3a6828),
        [Math.cos(a) * (o.radius + 0.05), rand(o.height * 0.2, o.height * 0.7),
        Math.sin(a) * (o.radius + 0.05)], 6));
    }
    return g;
  }, {
    icon: "🏚️", category: "structure",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.5 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 6.0, step: 0.5, default: 4.0 },
      { key: "thickness", label: "Thickness", type: "number", min: 0.15, max: 0.4, step: 0.05, default: 0.25 },
      { key: "color", label: "Color", type: "color", default: 0x6a6258 },
    ],
  });

  register("gallows", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // platform
    g.add(_box(o.platformW, 0.12, o.platformW, w, [0, 0.06, 0]));
    // steps
    for (let i = 0; i < 3; i++) {
      g.add(_box(o.platformW * 0.4, 0.08, 0.2, w,
        [0, 0.04 + i * 0.005, o.platformW / 2 + 0.1 + i * 0.2]));
    }
    // vertical post
    g.add(_box(0.1, o.height, 0.1, w, [-o.platformW * 0.3, 0.12 + o.height / 2, 0]));
    // horizontal beam
    g.add(_box(o.beamLen, 0.08, 0.08, w,
      [-o.platformW * 0.3 + o.beamLen / 2, 0.12 + o.height, 0]));
    // brace
    g.add(_box(0.06, o.height * 0.5, 0.06, w,
      [-o.platformW * 0.3 + 0.15, 0.12 + o.height * 0.75, 0]));
    g.children[g.children.length - 1].rotation.z = 0.6;
    // rope/noose
    g.add(_cyl(0.008, 0.008, o.height * 0.3, M.rope(0x8a7a60),
      [-o.platformW * 0.3 + o.beamLen * 0.7, 0.12 + o.height - o.height * 0.15, 0], 4));
    // noose loop
    g.add(_tor(0.04, 0.006, M.rope(0x8a7a60),
      [-o.platformW * 0.3 + o.beamLen * 0.7, 0.12 + o.height * 0.65, 0], 8, 4));
    // trapdoor line
    g.add(_box(o.platformW * 0.3, 0.005, o.platformW * 0.35, M.metal(0x1a1a1a),
      [o.platformW * 0.1, 0.125, 0]));
    return g;
  }, {
    icon: "⚖️", category: "structure",
    params: [
      { key: "platformW", label: "Platform W", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 5.0, step: 0.3, default: 3.0 },
      { key: "beamLen", label: "Beam Len", type: "number", min: 0.8, max: 2.0, step: 0.2, default: 1.2 },
      { key: "color", label: "Color", type: "color", default: 0x3a2818 },
    ],
  });

  register("stocks", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // two posts
    g.add(_box(0.08, o.height, 0.08, w, [-o.width / 2, o.height / 2, 0]));
    g.add(_box(0.08, o.height, 0.08, w, [o.width / 2, o.height / 2, 0]));
    // lower board (fixed)
    g.add(_box(o.width, 0.05, 0.2, w, [0, o.height * 0.6, 0]));
    // upper board (hinged)
    g.add(_box(o.width, 0.05, 0.2, w, [0, o.height * 0.6 + 0.06, 0]));
    // holes (3)
    const holeMat = M.metal(0x1a1a1a);
    g.add(_cyl(0.05, 0.05, 0.21, holeMat, [0, o.height * 0.6 + 0.03, 0], 8));
    g.add(_cyl(0.04, 0.04, 0.21, holeMat, [-o.width * 0.25, o.height * 0.6 + 0.03, 0], 8));
    g.add(_cyl(0.04, 0.04, 0.21, holeMat, [o.width * 0.25, o.height * 0.6 + 0.03, 0], 8));
    // base platform
    g.add(_box(o.width + 0.2, 0.06, 0.4, w, [0, 0.03, 0]));
    return g;
  }, {
    icon: "⛓️", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.8 },
      { key: "height", label: "Height", type: "number", min: 0.8, max: 1.8, step: 0.1, default: 1.2 },
      { key: "color", label: "Color", type: "color", default: 0x4a3018 },
    ],
  });

  register("prison_cell", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    const met = M.metal(0x3a3a3a);
    // back wall
    g.add(_box(o.width, o.height, 0.2, st, [0, o.height / 2, -o.depth / 2]));
    // side walls
    g.add(_box(0.2, o.height, o.depth, st, [-o.width / 2, o.height / 2, 0]));
    g.add(_box(0.2, o.height, o.depth, st, [o.width / 2, o.height / 2, 0]));
    // floor
    g.add(_box(o.width, 0.1, o.depth, st, [0, 0.05, 0]));
    // ceiling
    g.add(_box(o.width, 0.1, o.depth, st, [0, o.height - 0.05, 0]));
    // bars (front wall)
    for (let i = 0; i < Math.floor(o.width / 0.1); i++) {
      const x = -o.width / 2 + 0.05 + i * 0.1;
      g.add(_cyl(0.015, 0.015, o.height, met, [x, o.height / 2, o.depth / 2], 5));
    }
    // horizontal bar
    g.add(_cyl(0.012, 0.012, o.width, met, [0, o.height * 0.5, o.depth / 2], 5));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // straw on floor
    for (let i = 0; i < 8; i++) {
      g.add(_box(rand(0.05, 0.15), 0.005, rand(0.02, 0.04), M.rope(0x9a8a50),
        [rand(-o.width / 2 + 0.2, o.width / 2 - 0.2), 0.11,
        rand(-o.depth / 2 + 0.2, o.depth / 2 - 0.1)]));
    }
    // shackles on back wall
    g.add(_tor(0.025, 0.005, met, [0, o.height * 0.6, -o.depth / 2 + 0.11], 8, 4));
    g.add(_cyl(0.008, 0.008, 0.15, met, [0, o.height * 0.53, -o.depth / 2 + 0.11], 4));
    return g;
  }, {
    icon: "🔒", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.5, max: 3.5, step: 0.3, default: 2.0 },
      { key: "depth", label: "Depth", type: "number", min: 1.5, max: 3.5, step: 0.3, default: 2.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 3.5, step: 0.3, default: 2.5 },
      { key: "color", label: "Color", type: "color", default: 0x3a3830 },
    ],
  });

})();
