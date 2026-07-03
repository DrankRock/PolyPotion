// category: "decor_exterior"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("signpost", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // post
    g.add(_cyl(0.035, 0.04, o.height, w, [0, o.height / 2, 0], 6));
    // signs (2 pointing different ways)
    const sign1 = _box(0.6, 0.14, 0.03, w, [0.25, o.height - 0.10, 0]);
    g.add(sign1);
    const sign2 = _box(0.5, 0.14, 0.03, w, [-0.20, o.height - 0.28, 0]);
    sign2.rotation.y = 0.4;
    g.add(sign2);
    return g;
  }, {
    icon: "🪧", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 1.0, max: 2.5, step: 0.1, default: 1.8 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a4030 },
    ],
  });

  register("pedestal", function (o) {
    const g = new THREE.Group();
    const mat = M.marble(o.color);
    // base
    g.add(_box(o.width * 1.2, 0.08, o.width * 1.2, mat, [0, 0.04, 0]));
    // column
    g.add(_cyl(o.width / 2, o.width / 2 + 0.02, o.height - 0.16, mat, [0, o.height / 2, 0], 20));
    // top plate
    g.add(_box(o.width * 1.1, 0.08, o.width * 1.1, mat, [0, o.height - 0.04, 0]));
    return g;
  }, {
    icon: "🏛️", category: "props",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.2, max: 0.8, step: 0.05, default: 0.35 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 1.8, step: 0.1,  default: 1.0 },
      { key: "color",  label: "Color",  type: "color",  default: 0xd8d0c8 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // FURNITURE — WAVE 2
  // ════════════════════════════════════════════════════════

  register("hay_bale", function (o) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.95, metalness: 0.0 });
    if (o.round) {
      g.add(_cyl(o.radius, o.radius, o.radius * 1.2, mat, [0, o.radius * 0.6, 0], 16));
    } else {
      g.add(_box(0.9, 0.45, 0.45, mat, [0, 0.225, 0]));
      // twine
      const twine = M.rope();
      g.add(_box(0.92, 0.02, 0.02, twine, [0, 0.35, 0.15]));
      g.add(_box(0.92, 0.02, 0.02, twine, [0, 0.35, -0.15]));
    }
    return g;
  }, {
    icon: "🌾", category: "nature",
    params: [
      { key: "round",  label: "Round",  type: "bool",   default: false },
      { key: "radius", label: "Radius", type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.5 },
      { key: "color",  label: "Color",  type: "color",  default: 0xc8a860 },
    ],
  });

  register("tombstone", function (o) {
    const g = new THREE.Group();
    const mat = M.stone(o.color);
    // base
    g.add(_box(0.5, 0.06, 0.3, mat, [0, 0.03, 0]));
    // slab
    const slabW = 0.4, slabH = o.height;
    g.add(_box(slabW, slabH, 0.08, mat, [0, slabH/2 + 0.06, 0]));
    // rounded top
    g.add(_cyl(slabW/2, slabW/2, 0.08, mat, [0, slabH + 0.06, 0], 12));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // cross (optional)
    if (o.hasCross) {
      const crossMat = M.stone(o.color);
      g.add(_box(0.04, 0.25, 0.03, crossMat, [0, slabH + 0.25, 0.05]));
      g.add(_box(0.16, 0.04, 0.03, crossMat, [0, slabH + 0.28, 0.05]));
    }
    return g;
  }, {
    icon: "🪦", category: "props",
    params: [
      { key: "height",   label: "Height", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.7 },
      { key: "hasCross", label: "Cross",  type: "bool",   default: false },
      { key: "color",    label: "Stone",  type: "color",  default: 0x6a6a60 },
    ],
  });

  register("wagon_wheel", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const r = o.radius;
    // rim
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.03, 8, 20),
      mat
    );
    g.add(rim);
    // hub
    g.add(_cyl(0.06, 0.06, 0.06, mat, [0, 0, 0], 10));
    // spokes
    const spokes = o.spokes;
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      const spoke = _box(r - 0.08, 0.025, 0.025, mat, [0, 0, 0]);
      spoke.rotation.z = a;
      spoke.position.set(Math.cos(a) * r/2, Math.sin(a) * r/2, 0);
      g.add(spoke);
    }
    // iron band
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(r + 0.01, 0.012, 6, 20),
      M.metal(0x3a3a3a)
    );
    g.add(band);
    return g;
  }, {
    icon: "☸️", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.2, max: 0.8, step: 0.05, default: 0.45 },
      { key: "spokes", label: "Spokes", type: "int",    min: 6,   max: 16,  default: 10 },
      { key: "color",  label: "Wood",   type: "color",  default: 0x5a4028 },
    ],
  });

  register("market_stall", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.woodColor);
    const canopyMat = M.cloth(o.canopyColor);
    const w = o.width, d = 1.0;
    // counter
    g.add(_box(w, 0.05, d, mat, [0, 1.0, 0]));
    // legs
    for (let x = -1; x <= 1; x += 2) {
      g.add(_box(0.06, 1.0, 0.06, mat, [x * (w/2 - 0.06), 0.5, -d/2 + 0.06]));
      g.add(_box(0.06, 1.0, 0.06, mat, [x * (w/2 - 0.06), 0.5, d/2 - 0.06]));
    }
    // tall poles for canopy
    for (let x = -1; x <= 1; x += 2) {
      g.add(_box(0.05, 2.2, 0.05, mat, [x * (w/2 - 0.06), 1.1, -d/2 + 0.06]));
    }
    // canopy (angled plane)
    const canopyGeo = new THREE.PlaneGeometry(w + 0.2, d + 0.4);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.rotation.x = -Math.PI / 2 + 0.15;
    canopy.position.set(0, 2.15, 0.05);
    g.add(canopy);
    // goods on counter (randomized small boxes)
    for (let i = 0; i < 5; i++) {
      const gx = rand(-w/2 + 0.15, w/2 - 0.15);
      const gs = rand(0.06, 0.12);
      const gc = pick([0xcc4422, 0x44aa44, 0xddaa22, 0x6644aa, 0x2288cc]);
      g.add(_box(gs, gs, gs, M.cloth(gc), [gx, 1.05 + gs/2, rand(-0.2, 0.2)]));
    }
    return g;
  }, {
    icon: "🏪", category: "props",
    params: [
      { key: "width",       label: "Width",  type: "number", min: 1.0, max: 3.0, step: 0.25, default: 1.8 },
      { key: "woodColor",   label: "Wood",   type: "color",  default: 0x6b4a2b },
      { key: "canopyColor", label: "Canopy", type: "color",  default: 0x8a2a1a },
    ],
  });

  register("hanging_sign", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const br = M.metal(o.metalColor);
    // horizontal bracket arm
    g.add(_box(o.width * 0.6, 0.025, 0.025, br, [o.width * 0.3, 0, 0]));
    // two chains
    const chainX1 = o.width * 0.12, chainX2 = o.width * 0.48;
    for (const cx of [chainX1, chainX2]) {
      g.add(_cyl(0.006, 0.006, o.chainLen, br, [cx, -o.chainLen / 2, 0], 6));
    }
    // sign board
    g.add(_box(o.width, o.height, 0.03, w, [o.width * 0.3, -o.chainLen - o.height / 2, 0]));
    // bracket plate (wall mount)
    g.add(_box(0.06, 0.12, 0.03, br, [0, 0, 0]));
    return g;
  }, {
    icon: "🪧", category: "decorative",
    params: [
      { key: "width",      label: "Width",  type: "number", min: 0.3, max: 1.0, step: 0.05, default: 0.5 },
      { key: "height",     label: "Height", type: "number", min: 0.2, max: 0.5, step: 0.05, default: 0.3 },
      { key: "chainLen",   label: "Chain",  type: "number", min: 0.05, max: 0.3, step: 0.02, default: 0.12 },
      { key: "color",      label: "Wood",   type: "color",  default: 0x5a3a1a },
      { key: "metalColor", label: "Metal",  type: "color",  default: 0x2a2520 },
    ],
  });

  register("sundial", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.baseColor);
    const br = M.brass(o.gnomon);
    // circular base / dial face
    g.add(_cyl(o.radius, o.radius * 1.05, 0.06, st, [0, 0.03, 0], 32));
    // raised rim
    g.add(_tor(o.radius, 0.015, st, [0, 0.06, 0], 8, 32));
    // gnomon (triangular fin approximated with thin box)
    const fin = _box(0.008, o.radius * 0.7, o.radius * 0.8, br, [0, o.radius * 0.35 + 0.06, 0]);
    fin.rotation.x = -0.6;
    g.add(fin);
    return g;
  }, {
    icon: "☀️", category: "decorative",
    params: [
      { key: "radius",    label: "Radius",  type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.25 },
      { key: "baseColor", label: "Base",    type: "color",  default: 0x8a8070 },
      { key: "gnomon",    label: "Gnomon",  type: "color",  default: 0xc8a050 },
    ],
  });

  register("market_awning", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.poleColor);
    const cl = M.cloth(o.color);
    // four poles
    const hw = o.width / 2, hd = o.depth / 2;
    [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].forEach(([x, z]) => {
      g.add(_cyl(0.04, 0.04, o.height, w, [x, o.height / 2, z], 6));
    });
    // canopy (slightly angled – front higher)
    const canopy = _box(o.width, 0.03, o.depth, cl, [0, o.height, 0]);
    canopy.rotation.x = 0.08;
    g.add(canopy);
    // front valance (decorative hanging strip)
    g.add(_box(o.width, 0.12, 0.02, cl, [0, o.height - 0.06, hd]));
    // scalloped edge (small triangles)
    const scallops = Math.floor(o.width / 0.2);
    for (let i = 0; i < scallops; i++) {
      const x = -o.width / 2 + 0.1 + i * (o.width / scallops);
      g.add(_cone(0.06, 0.1, cl, [x, o.height - 0.17, hd], 3));
    }
    return g;
  }, {
    icon: "⛺", category: "structure",
    params: [
      { key: "width",     label: "Width",  type: "number", min: 1.5, max: 5.0, step: 0.3,  default: 2.5 },
      { key: "depth",     label: "Depth",  type: "number", min: 1.0, max: 3.0, step: 0.2,  default: 1.8 },
      { key: "height",    label: "Height", type: "number", min: 2.0, max: 4.0, step: 0.3,  default: 2.8 },
      { key: "color",     label: "Fabric", type: "color",  default: 0x8a3020 },
      { key: "poleColor", label: "Poles",  type: "color",  default: 0x5a3a1a },
    ],
  });

  register("log_pile", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    let logIndex = 0;
    for (let row = 0; row < o.rows; row++) {
      const logsInRow = o.logsPerRow - row;
      for (let i = 0; i < logsInRow; i++) {
        const r = rand(o.logR * 0.85, o.logR * 1.15);
        const x = -((logsInRow - 1) * o.logR * 2) / 2 + i * o.logR * 2;
        const y = row * o.logR * 1.8 + r;
        const log = _cyl(r, r, o.logLen, M.wood(_c(o.color) + Math.floor(rand(-8, 8))),
          [x, y, 0], 8);
        log.rotation.x = Math.PI / 2;
        g.add(log);
        logIndex++;
      }
    }
    return g;
  }, {
    icon: "🪵", category: "props",
    params: [
      { key: "logR",       label: "Log R",   type: "number", min: 0.05, max: 0.2, step: 0.02, default: 0.08 },
      { key: "logLen",     label: "Log Len", type: "number", min: 0.5, max: 2.0, step: 0.2,  default: 1.0 },
      { key: "logsPerRow", label: "Per Row", type: "int",    min: 2,   max: 8,   default: 4 },
      { key: "rows",       label: "Rows",    type: "int",    min: 1,   max: 5,   default: 3 },
      { key: "color",      label: "Color",   type: "color",  default: 0x5a3a1a },
    ],
  });

  register("horse_trough", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const band = M.metal(0x3a3a3a);
    // trough body (open top box)
    // bottom
    g.add(_box(o.length, 0.04, o.width, w, [0, o.height, 0]));
    // sides
    g.add(_box(o.length, 0.25, 0.04, w, [0, o.height + 0.125, -o.width / 2]));
    g.add(_box(o.length, 0.25, 0.04, w, [0, o.height + 0.125, o.width / 2]));
    // ends
    g.add(_box(0.04, 0.25, o.width, w, [-o.length / 2, o.height + 0.125, 0]));
    g.add(_box(0.04, 0.25, o.width, w, [o.length / 2, o.height + 0.125, 0]));
    // metal bands
    g.add(_box(0.02, 0.28, o.width + 0.04, band, [-o.length * 0.3, o.height + 0.14, 0]));
    g.add(_box(0.02, 0.28, o.width + 0.04, band, [o.length * 0.3, o.height + 0.14, 0]));
    // legs
    const lx = o.length / 2 - 0.08, lz = o.width / 2 - 0.04;
    [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(([x, z]) => {
      g.add(_box(0.06, o.height, 0.06, w, [x, o.height / 2, z]));
    });
    // water surface
    g.add(_box(o.length - 0.08, 0.02, o.width - 0.08, M.glass(0x4a7a9a), [0, o.height + 0.2, 0]));
    return g;
  }, {
    icon: "🐴", category: "props",
    params: [
      { key: "length", label: "Length", type: "number", min: 0.8, max: 2.5, step: 0.2,  default: 1.4 },
      { key: "width",  label: "Width",  type: "number", min: 0.3, max: 0.8, step: 0.1,  default: 0.5 },
      { key: "height", label: "Height", type: "number", min: 0.4, max: 1.0, step: 0.1,  default: 0.6 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a3a1a },
    ],
  });

  register("ruins_column", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // broken column shaft
    g.add(_cyl(o.radius, o.radius * 1.05, o.height, st, [0, o.height / 2, 0], 14));
    // base plinth
    g.add(_box(o.radius * 2.4, 0.12, o.radius * 2.4, st, [0, 0.06, 0]));
    // broken top (irregular – a tilted cylinder chunk)
    const cap = _cyl(o.radius * 1.1, o.radius * 0.8, 0.15, st, [0, o.height + 0.05, 0], 14);
    cap.rotation.x = rand(-0.2, 0.2);
    cap.rotation.z = rand(-0.2, 0.2);
    g.add(cap);
    // fallen chunk nearby
    const chunk = _cyl(o.radius * 0.9, o.radius * 0.9, 0.25, st,
      [o.radius * 2, 0.12, rand(-0.3, 0.3)], 14);
    chunk.rotation.x = Math.PI / 2;
    chunk.rotation.y = rand(0, Math.PI);
    g.add(chunk);
    return g;
  }, {
    icon: "🏛️", category: "structure",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.25 },
      { key: "height", label: "Height", type: "number", min: 1.0, max: 4.0, step: 0.3,   default: 2.0 },
      { key: "color",  label: "Color",  type: "color",  default: 0x8a8070 },
    ],
  });

  register("campsite", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.tentPoleColor);
    const cl = M.cloth(o.tentColor);
    // tent (A-frame: two sloped panels)
    const halfW = o.tentW / 2;
    const slopeLen = Math.sqrt(halfW * halfW + o.tentH * o.tentH);
    const angle = Math.atan2(o.tentH, halfW);
    const leftPanel = _box(slopeLen, 0.02, o.tentD, cl, [-halfW / 2, o.tentH / 2, 0]);
    leftPanel.rotation.z = angle;
    g.add(leftPanel);
    const rightPanel = _box(slopeLen, 0.02, o.tentD, cl, [halfW / 2, o.tentH / 2, 0]);
    rightPanel.rotation.z = -angle;
    g.add(rightPanel);
    // ridge pole
    g.add(_cyl(0.02, 0.02, o.tentD + 0.1, w, [0, o.tentH, 0], 6));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    // fire ring (offset)
    const fireX = o.tentW * 0.8;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      g.add(_sph(0.06, M.stone(0x5a5248), [fireX + Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3], 5));
    }
    // logs in fire
    for (let i = 0; i < 3; i++) {
      const la = (i / 3) * Math.PI;
      const log = _cyl(0.025, 0.02, 0.3, M.wood(0x2a1a08), [fireX, 0.06, 0], 5);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = la;
      g.add(log);
    }
    // sitting log (larger log nearby)
    const sitLog = _cyl(0.08, 0.08, 0.6, M.wood(0x4a3018), [fireX + 0.6, 0.08, 0], 8);
    sitLog.rotation.x = Math.PI / 2;
    g.add(sitLog);
    return g;
  }, {
    icon: "🏕️", category: "structure",
    params: [
      { key: "tentW",        label: "Tent W",  type: "number", min: 1.0, max: 3.0, step: 0.2,  default: 1.8 },
      { key: "tentD",        label: "Tent D",  type: "number", min: 1.5, max: 3.0, step: 0.3,  default: 2.2 },
      { key: "tentH",        label: "Tent H",  type: "number", min: 0.8, max: 2.0, step: 0.2,  default: 1.2 },
      { key: "tentColor",    label: "Canvas",  type: "color",  default: 0x8a7a50 },
      { key: "tentPoleColor", label: "Poles",  type: "color",  default: 0x5a3a1a },
    ],
  });

    // ════════════════════════════════════════════════════════════════
  // NEW OBJECTS BATCH — MASSIVE EXPANSION
  // Roads, Terrain, Buildings, Scenery, Props, Nature, Medieval
  // ════════════════════════════════════════════════════════════════

  // ─── ROADS & PATHS ─────────────────────────────────────────────

  register("market_stall", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.woodColor);
    const cl = M.cloth(o.canvasColor);
    // counter
    g.add(_box(o.width, 0.04, o.depth * 0.6, w, [0, o.counterH, o.depth * 0.15]));
    // back wall
    g.add(_box(o.width, o.height, 0.04, w, [0, o.height / 2, -o.depth / 2]));
    // shelves on back wall
    g.add(_box(o.width - 0.1, 0.03, 0.15, w, [0, o.height * 0.4, -o.depth / 2 + 0.08]));
    g.add(_box(o.width - 0.1, 0.03, 0.15, w, [0, o.height * 0.65, -o.depth / 2 + 0.08]));
    // four posts
    const hw = o.width / 2, hd = o.depth / 2;
    [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]].forEach(([x, z]) => {
      g.add(_cyl(0.03, 0.03, o.height + 0.5, w, [x, (o.height + 0.5) / 2, z], 6));
    });
    // canopy
    g.add(_box(o.width + 0.2, 0.02, o.depth + 0.15, cl, [0, o.height + 0.5, 0]));
    // front valance
    g.add(_box(o.width + 0.2, 0.1, 0.015, cl, [0, o.height + 0.45, hd + 0.07]));
    // wares on counter
    for (let i = 0; i < 4; i++) {
      const x = rand(-o.width / 2 + 0.15, o.width / 2 - 0.15);
      g.add(_box(rand(0.06, 0.12), rand(0.06, 0.12), rand(0.06, 0.1), M.ceramic(pick([0xc8a040, 0x8a4020, 0x4a6830, 0xc06020])),
        [x, o.counterH + 0.06, o.depth * 0.15]));
    }
    return g;
  }, {
    icon: "🏪", category: "structure",
    params: [
      { key: "width", label: "Width", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "depth", label: "Depth", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.5 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 4.0, step: 0.3, default: 2.5 },
      { key: "counterH", label: "Counter H", type: "number", min: 0.6, max: 1.2, step: 0.1, default: 0.9 },
      { key: "woodColor", label: "Wood", type: "color", default: 0x5a3a1a },
      { key: "canvasColor", label: "Canvas", type: "color", default: 0x8a3a20 },
    ],
  });

  register("signpost", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // pole
    g.add(_cyl(0.03, 0.035, o.height, w, [0, o.height / 2, 0], 6));
    // signs (directional arrows)
    for (let i = 0; i < o.signs; i++) {
      const y = o.height - 0.1 - i * 0.2;
      const dir = i % 2 === 0 ? 1 : -1;
      g.add(_box(0.5, 0.1, 0.02, M.wood(_c(o.color) + Math.floor(rand(-8, 8))),
        [dir * 0.28, y, 0]));
      // arrow point
      g.add(_cone(0.06, 0.08, M.wood(_c(o.color) + Math.floor(rand(-5, 5))),
        [dir * 0.55, y, 0], 3));
      g.children[g.children.length - 1].rotation.z = dir * Math.PI / 2;
    }
    return g;
  }, {
    icon: "🪧", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
      { key: "signs", label: "Signs", type: "int", min: 1, max: 4, default: 3 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("hay_bale", function (o) {
    const g = new THREE.Group();
    const hay = M.rope(o.color);
    // cylindrical bale
    const bale = _cyl(o.radius, o.radius, o.height, hay, [0, o.radius, 0], 16);
    bale.rotation.z = Math.PI / 2;
    g.add(bale);
    // end caps (slightly different color)
    g.add(_cyl(o.radius, o.radius, 0.02, M.rope(o.color + 0x080808),
      [-o.height / 2, o.radius, 0], 16));
    g.add(_cyl(o.radius, o.radius, 0.02, M.rope(o.color + 0x080808),
      [o.height / 2, o.radius, 0], 16));
    // twine bands
    g.add(_tor(o.radius + 0.005, 0.008, M.rope(0x6a5a30), [-o.height * 0.25, o.radius, 0], 12, 4));
    g.children[g.children.length - 1].rotation.y = Math.PI / 2;
    g.add(_tor(o.radius + 0.005, 0.008, M.rope(0x6a5a30), [o.height * 0.25, o.radius, 0], 12, 4));
    g.children[g.children.length - 1].rotation.y = Math.PI / 2;
    return g;
  }, {
    icon: "🌾", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
      { key: "height", label: "Height", type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0xa89a50 },
    ],
  });

  register("stone_fountain", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    const water = M.glass(o.waterColor);
    // base pool
    g.add(_cyl(o.baseR, o.baseR * 1.05, 0.1, st, [0, 0.05, 0], 20));
    g.add(_tor(o.baseR, 0.08, st, [0, 0.12, 0], 20, 8));
    // water in pool
    g.add(_cyl(o.baseR - 0.1, o.baseR - 0.1, 0.04, water, [0, 0.08, 0], 20));
    // central pillar
    g.add(_cyl(o.baseR * 0.15, o.baseR * 0.12, o.height, st, [0, o.height / 2, 0], 12));
    // upper bowl
    g.add(_cyl(o.baseR * 0.4, o.baseR * 0.35, 0.06, st, [0, o.height, 0], 14));
    g.add(_tor(o.baseR * 0.4, 0.04, st, [0, o.height + 0.02, 0], 14, 6));
    // water in upper bowl
    g.add(_cyl(o.baseR * 0.35, o.baseR * 0.35, 0.02, water, [0, o.height + 0.01, 0], 14));
    // top finial
    g.add(_sph(o.baseR * 0.08, st, [0, o.height + 0.1, 0], 8));
    return g;
  }, {
    icon: "⛲", category: "structure",
    params: [
      { key: "baseR", label: "Base R", type: "number", min: 0.5, max: 2.5, step: 0.2, default: 1.2 },
      { key: "height", label: "Height", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.5 },
      { key: "color", label: "Stone", type: "color", default: 0x8a8070 },
      { key: "waterColor", label: "Water", type: "color", default: 0x4a7a9a },
    ],
  });

  register("tombstone", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // base
    g.add(_box(o.width + 0.1, 0.06, o.depth + 0.08, st, [0, 0.03, 0]));
    // main slab
    g.add(_box(o.width, o.height, o.depth, st, [0, 0.06 + o.height / 2, 0]));
    // rounded top
    g.add(_cyl(o.width / 2, o.width / 2, o.depth, st, [0, 0.06 + o.height, 0], 12));
    g.children[g.children.length - 1].rotation.x = Math.PI / 2;
    g.children[g.children.length - 1].scale.y = 0.5;
    return g;
  }, {
    icon: "🪦", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
      { key: "height", label: "Height", type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.6 },
      { key: "depth", label: "Depth", type: "number", min: 0.05, max: 0.15, step: 0.02, default: 0.08 },
      { key: "color", label: "Color", type: "color", default: 0x6a6a68 },
    ],
  });

  register("cross_grave", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // base mound
    g.add(_box(0.6, 0.08, 1.0, M.stone(0x4a3a28), [0, 0.04, 0]));
    // cross vertical
    g.add(_box(0.06, o.height, 0.06, st, [0, o.height / 2 + 0.08, -0.4]));
    // cross horizontal
    g.add(_box(o.height * 0.5, 0.06, 0.06, st, [0, o.height * 0.7, -0.4]));
    return g;
  }, {
    icon: "✝️", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.8 },
      { key: "color", label: "Color", type: "color", default: 0x7a7a78 },
    ],
  });

  register("flag_pole", function (o) {
    const g = new THREE.Group();
    const met = M.metal(o.poleColor);
    const cl = M.cloth(o.flagColor);
    // pole
    g.add(_cyl(0.025, 0.02, o.height, met, [0, o.height / 2, 0], 8));
    // base
    g.add(_cyl(0.08, 0.1, 0.08, met, [0, 0.04, 0], 8));
    // finial
    g.add(_sph(0.035, M.metal(0x9a8a40), [0, o.height + 0.02, 0], 6));
    // flag
    g.add(_box(o.flagW, o.flagH, 0.008, cl, [o.flagW / 2 + 0.02, o.height - o.flagH / 2 - 0.05, 0]));
    return g;
  }, {
    icon: "🚩", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 2.0, max: 6.0, step: 0.3, default: 3.5 },
      { key: "flagW", label: "Flag W", type: "number", min: 0.3, max: 1.2, step: 0.1, default: 0.7 },
      { key: "flagH", label: "Flag H", type: "number", min: 0.2, max: 0.8, step: 0.1, default: 0.45 },
      { key: "poleColor", label: "Pole", type: "color", default: 0x4a4a4a },
      { key: "flagColor", label: "Flag", type: "color", default: 0xa02020 },
    ],
  });

  register("stone_statue", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // pedestal
    g.add(_box(o.baseW, 0.15, o.baseW, st, [0, 0.075, 0]));
    g.add(_box(o.baseW * 0.85, 0.08, o.baseW * 0.85, st, [0, 0.19, 0]));
    // body (simplified human form)
    const baseY = 0.23;
    // legs
    g.add(_cyl(0.06, 0.05, 0.4, st, [-0.05, baseY + 0.2, 0], 6));
    g.add(_cyl(0.06, 0.05, 0.4, st, [0.05, baseY + 0.2, 0], 6));
    // torso
    g.add(_box(0.2, 0.3, 0.12, st, [0, baseY + 0.55, 0]));
    // arms
    const lArm = _cyl(0.04, 0.035, 0.3, st, [0, 0, 0], 6);
    lArm.position.set(-0.14, baseY + 0.55, 0);
    lArm.rotation.z = 0.2;
    g.add(lArm);
    const rArm = _cyl(0.04, 0.035, 0.3, st, [0, 0, 0], 6);
    rArm.position.set(0.14, baseY + 0.55, 0);
    rArm.rotation.z = -0.2;
    g.add(rArm);
    // head
    g.add(_sph(0.08, st, [0, baseY + 0.78, 0], 8));
    return g;
  }, {
    icon: "🗿", category: "props",
    params: [
      { key: "baseW", label: "Base W", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0x7a7a78 },
    ],
  });

  register("obelisk", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // base
    g.add(_box(o.baseW * 1.3, 0.1, o.baseW * 1.3, st, [0, 0.05, 0]));
    // shaft (tapered)
    g.add(_box(o.baseW, o.height, o.baseW, st, [0, 0.1 + o.height / 2, 0]));
    g.children[g.children.length - 1].scale.set(1, 1, 1);
    // pyramidion top
    g.add(_cone(o.baseW * 0.55, o.height * 0.12, M.metal(0x9a8a40),
      [0, 0.1 + o.height + o.height * 0.06, 0], 4));
    return g;
  }, {
    icon: "🗼", category: "structure",
    params: [
      { key: "baseW", label: "Base W", type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.5 },
      { key: "height", label: "Height", type: "number", min: 1.0, max: 6.0, step: 0.5, default: 3.0 },
      { key: "color", label: "Color", type: "color", default: 0x8a8078 },
    ],
  });

  register("stone_circle", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    for (let i = 0; i < o.stones; i++) {
      const a = (i / o.stones) * Math.PI * 2;
      const x = Math.cos(a) * o.radius;
      const z = Math.sin(a) * o.radius;
      const h = rand(o.stoneH * 0.7, o.stoneH);
      const w = rand(0.2, 0.4);
      const stone = _box(w, h, 0.15, M.stone(_c(o.color) + Math.floor(rand(-10, 10))),
        [x, h / 2, z]);
      stone.rotation.y = -a + rand(-0.15, 0.15);
      stone.rotation.z = rand(-0.05, 0.05);
      g.add(stone);
    }
    // lintel stones on top (connecting pairs)
    for (let i = 0; i < Math.floor(o.stones / 2); i++) {
      const a1 = (i * 2 / o.stones) * Math.PI * 2;
      const a2 = ((i * 2 + 1) / o.stones) * Math.PI * 2;
      const x1 = Math.cos(a1) * o.radius, z1 = Math.sin(a1) * o.radius;
      const x2 = Math.cos(a2) * o.radius, z2 = Math.sin(a2) * o.radius;
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      const dist = Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
      const lintel = _box(dist + 0.1, 0.12, 0.25, st, [mx, o.stoneH * 0.8, mz]);
      lintel.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
      g.add(lintel);
    }
    return g;
  }, {
    icon: "🪨", category: "structure",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 1.5, max: 6.0, step: 0.5, default: 3.0 },
      { key: "stones", label: "Stones", type: "int", min: 4, max: 12, default: 8 },
      { key: "stoneH", label: "Stone H", type: "number", min: 1.0, max: 3.0, step: 0.3, default: 2.0 },
      { key: "color", label: "Color", type: "color", default: 0x6a6a68 },
    ],
  });

  register("dung_pile", function (o) {
    const g = new THREE.Group();
    const dung = M.stone(o.color);
    const main = _sph(o.radius, dung, [0, 0, 0], 10);
    main.scale.y = o.height / o.radius;
    g.add(main);
    for (let i = 0; i < 3; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(o.radius * 0.3, o.radius * 0.7);
      const bump = _sph(o.radius * rand(0.3, 0.5), dung,
        [Math.cos(a) * d, 0, Math.sin(a) * d], 7);
      bump.scale.y = rand(0.3, 0.6);
      g.add(bump);
    }
    // flies (tiny dark spheres above)
    for (let i = 0; i < 4; i++) {
      g.add(_sph(0.008, M.metal(0x1a1a1a),
        [rand(-0.15, 0.15), o.height + rand(0.1, 0.3), rand(-0.15, 0.15)], 4));
    }
    return g;
  }, {
    icon: "💩", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.8, step: 0.05, default: 0.3 },
      { key: "height", label: "Height", type: "number", min: 0.1, max: 0.5, step: 0.05, default: 0.2 },
      { key: "color", label: "Color", type: "color", default: 0x4a3818 },
    ],
  });

  register("hay_wagon", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const hay = M.rope(0xa89a50);
    // wagon bed
    g.add(_box(o.length, 0.05, o.width, w, [0, o.wheelR + 0.15, 0]));
    // side rails
    for (let side = -1; side <= 1; side += 2) {
      g.add(_box(o.length, 0.5, 0.04, w, [0, o.wheelR + 0.4, side * o.width / 2]));
      // vertical slats
      for (let i = 0; i < 5; i++) {
        const x = -o.length / 2 + 0.15 + i * (o.length - 0.3) / 4;
        g.add(_box(0.03, 0.5, 0.03, w, [x, o.wheelR + 0.4, side * o.width / 2]));
      }
    }
    // hay pile
    const hayMound = _sph(o.width * 0.7, hay, [0, o.wheelR + 0.5, 0], 10);
    hayMound.scale.y = 0.5;
    hayMound.scale.x = o.length / o.width * 0.5;
    g.add(hayMound);
    // axles & wheels
    for (let xi = -1; xi <= 1; xi += 2) {
      g.add(_cyl(0.02, 0.02, o.width + 0.15, M.metal(0x3a3a3a),
        [xi * o.length * 0.35, o.wheelR, 0], 6));
      g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      for (let zi = -1; zi <= 1; zi += 2) {
        g.add(_tor(o.wheelR, 0.025, w,
          [xi * o.length * 0.35, o.wheelR, zi * (o.width / 2 + 0.06)], 12, 5));
        g.children[g.children.length - 1].rotation.x = Math.PI / 2;
        for (let s = 0; s < 6; s++) {
          const sa = (s / 6) * Math.PI * 2;
          g.add(_cyl(0.008, 0.008, o.wheelR * 0.85, w,
            [xi * o.length * 0.35, o.wheelR, zi * (o.width / 2 + 0.06)], 3));
          g.children[g.children.length - 1].rotation.x = Math.PI / 2;
          g.children[g.children.length - 1].rotation.z = sa;
        }
      }
    }
    // tongue
    g.add(_box(0.04, 0.04, o.length * 0.4, w, [o.length / 2 + o.length * 0.2, o.wheelR, 0]));
    return g;
  }, {
    icon: "🛒", category: "props",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.5, max: 4.0, step: 0.3, default: 2.5 },
      { key: "width", label: "Width", type: "number", min: 0.8, max: 2.0, step: 0.2, default: 1.2 },
      { key: "wheelR", label: "Wheel R", type: "number", min: 0.2, max: 0.5, step: 0.05, default: 0.35 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("sundial", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // pedestal
    g.add(_cyl(o.baseR * 0.4, o.baseR * 0.5, o.pedH, st, [0, o.pedH / 2, 0], 10));
    // dial face
    g.add(_cyl(o.baseR, o.baseR, 0.04, st, [0, o.pedH + 0.02, 0], 16));
    // hour lines (radial)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const line = _box(o.baseR * 0.8, 0.005, 0.008, M.metal(0x3a3a3a),
        [Math.cos(a) * o.baseR * 0.35, o.pedH + 0.045, Math.sin(a) * o.baseR * 0.35]);
      line.rotation.y = -a;
      g.add(line);
    }
    // gnomon (triangular shadow caster)
    g.add(_box(0.008, o.baseR * 0.6, o.baseR * 0.5, M.metal(0x4a4a4a),
      [0, o.pedH + 0.04 + o.baseR * 0.3, 0]));
    g.children[g.children.length - 1].rotation.x = 0.4;
    return g;
  }, {
    icon: "☀️", category: "props",
    params: [
      { key: "baseR", label: "Base R", type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.25 },
      { key: "pedH", label: "Pedestal H", type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.6 },
      { key: "color", label: "Color", type: "color", default: 0x8a8078 },
    ],
  });

  register("hanging_sign", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(0x3a3a3a);
    // wall bracket
    g.add(_box(0.04, 0.04, o.armLen, met, [0, o.height, o.armLen / 2]));
    // bracket decoration (scroll)
    g.add(_tor(0.04, 0.008, met, [0, o.height - 0.04, o.armLen * 0.2], 8, 4));
    // chains
    g.add(_cyl(0.005, 0.005, 0.15, met, [-o.signW * 0.3, o.height - 0.075, o.armLen]));
    g.add(_cyl(0.005, 0.005, 0.15, met, [o.signW * 0.3, o.height - 0.075, o.armLen]));
    // sign board
    g.add(_box(o.signW, o.signH, 0.02, w, [0, o.height - 0.15 - o.signH / 2, o.armLen]));
    // sign border
    g.add(_box(o.signW + 0.02, 0.015, 0.025, M.wood(o.color - 0x080808),
      [0, o.height - 0.15, o.armLen]));
    g.add(_box(o.signW + 0.02, 0.015, 0.025, M.wood(o.color - 0x080808),
      [0, o.height - 0.15 - o.signH, o.armLen]));
    return g;
  }, {
    icon: "🪧", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 1.5, max: 3.5, step: 0.2, default: 2.5 },
      { key: "armLen", label: "Arm Len", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
      { key: "signW", label: "Sign W", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.4 },
      { key: "signH", label: "Sign H", type: "number", min: 0.15, max: 0.4, step: 0.05, default: 0.25 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

})();
