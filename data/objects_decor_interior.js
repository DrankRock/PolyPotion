// category: "decor_interior"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("mirror", function (o) {
    const g = new THREE.Group();
    // Frame
    g.add(_box(o.width + 0.10, o.height + 0.10, 0.04, M.wood(o.frameColor)));
    // Reflective surface
    g.add(_box(o.width, o.height, 0.01,
      new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.02, metalness: 0.95 }),
      [0, 0, 0.025]));
    return g;
  }, {
    icon: "🪞", category: "decorative",
    params: [
      { key: "width",      label: "Width",  type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.7 },
      { key: "height",     label: "Height", type: "number", min: 0.4, max: 2.0, step: 0.1, default: 1.0 },
      { key: "frameColor", label: "Frame",  type: "color",  default: 0xc8a050 },
    ],
  });

  register("clock", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    // case
    g.add(_cyl(o.radius, o.radius, 0.06, mat, [0, 0, 0], 32));
    // face
    g.add(_cyl(o.radius * 0.90, o.radius * 0.90, 0.01,
      new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.5 }),
      [0, 0, 0.035], 32));
    // hour marks
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const mx = Math.sin(a) * o.radius * 0.75;
      const my = Math.cos(a) * o.radius * 0.75;
      const mark = _box(0.01, 0.03, 0.005, M.metal(0x1a1a1a), [mx, my, 0.04]);
      mark.rotation.z = -a;
      g.add(mark);
    }
    // hands
    g.add(_box(0.008, o.radius * 0.55, 0.005, M.metal(0x1a1a1a), [0, o.radius * 0.25, 0.045]));
    const min = _box(0.006, o.radius * 0.70, 0.005, M.metal(0x1a1a1a), [0, o.radius * 0.3, 0.048]);
    min.rotation.z = -Math.PI / 3;
    g.add(min);
    return g;
  }, {
    icon: "🕰️", category: "decorative",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.10, max: 0.5, step: 0.05, default: 0.22 },
      { key: "color",  label: "Color",  type: "color",  default: 0x3a2818 },
    ],
  });

  register("curtain", function (o) {
    const g = new THREE.Group();
    const c = M.cloth(o.color);
    // rod
    g.add(_cyl(0.015, 0.015, o.width + 0.20, M.brass(o.rodColor), [0, 0, 0], 8));
    // rod rotated horizontal
    g.children[0].rotation.z = Math.PI / 2;
    // two panels with slight wave
    for (let side = -1; side <= 1; side += 2) {
      const pw = o.width * 0.35;
      for (let i = 0; i < 4; i++) {
        const x = side * (o.width / 2 - pw / 2) + side * i * 0.03;
        const fold = _box(pw / 4, o.height, 0.04, c,
          [x + (i - 1.5) * pw / 4, -o.height / 2, Math.sin(i) * 0.03]);
        g.add(fold);
      }
    }
    return g;
  }, {
    icon: "🪟", category: "decorative",
    params: [
      { key: "width",    label: "Width",  type: "number", min: 0.8, max: 3.0, step: 0.1,  default: 1.6 },
      { key: "height",   label: "Height", type: "number", min: 1.0, max: 4.0, step: 0.2,  default: 2.4 },
      { key: "color",    label: "Fabric", type: "color",  default: 0x4a2a28 },
      { key: "rodColor", label: "Rod",    type: "color",  default: 0xc8a050 },
    ],
  });

  register("globe", function (o) {
    const g = new THREE.Group();
    // stand
    g.add(_cyl(0.08, 0.10, 0.04, M.brass(o.standColor), [0, 0.02, 0], 16));
    g.add(_cyl(0.02, 0.02, o.height - 0.04, M.brass(o.standColor), [0, o.height / 2, 0], 8));
    // meridian ring
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(o.radius + 0.01, 0.008, 8, 48),
      M.brass(o.standColor)
    );
    ring.position.y = o.height;
    g.add(ring);
    // globe sphere
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(o.radius, 32, 24),
      new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.4, metalness: 0.1 })
    );
    globe.position.y = o.height;
    // tilt
    globe.rotation.z = 0.4;
    g.add(globe);
    return g;
  }, {
    icon: "🌍", category: "decorative",
    params: [
      { key: "radius",     label: "Radius", type: "number", min: 0.10, max: 0.4, step: 0.02, default: 0.20 },
      { key: "height",     label: "Stand H", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
      { key: "color",      label: "Globe",  type: "color",  default: 0x3a5a6a },
      { key: "standColor", label: "Stand",  type: "color",  default: 0xc8a050 },
    ],
  });

  register("telescope", function (o) {
    const g = new THREE.Group();
    const m = M.brass(o.color);
    // tripod legs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const leg = _cyl(0.018, 0.022, o.height, M.wood(0x3a2818),
        [Math.sin(a) * 0.22, o.height / 2, Math.cos(a) * 0.22], 6);
      leg.rotation.z = -Math.sin(a) * 0.15;
      leg.rotation.x = Math.cos(a) * 0.15;
      g.add(leg);
    }
    // tube
    const tube = _cyl(0.04, 0.06, o.tubeLength, m, [0, o.height * 0.85, 0], 12);
    tube.rotation.x = o.tilt;
    g.add(tube);
    // eyepiece
    const ep = _cyl(0.05, 0.035, 0.08, m, [0, -o.tubeLength / 2 - 0.04, 0], 12);
    tube.add(ep);
    return g;
  }, {
    icon: "🔭", category: "decorative",
    params: [
      { key: "height",     label: "Stand H",  type: "number", min: 0.6, max: 1.4, step: 0.1, default: 1.0 },
      { key: "tubeLength", label: "Tube",     type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.6 },
      { key: "tilt",       label: "Tilt",     type: "number", min: -0.8, max: 0.8, step: 0.1, default: -0.4 },
      { key: "color",      label: "Color",    type: "color",  default: 0xc8a050 },
    ],
  });

  register("hourglass", function (o) {
    const g = new THREE.Group();
    const mat = M.glass(0xc8d8e0);
    // Top and bottom bulbs via lathe
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const y = t * o.height;
      const mid = o.height / 2;
      const dist = Math.abs(y - mid) / mid;
      const r = o.radius * (0.15 + dist * dist * 0.85);
      pts.push(new THREE.Vector2(Math.max(0.008, r), y));
    }
    const geo = new THREE.LatheGeometry(pts, 16);
    g.add(new THREE.Mesh(geo, mat));
    // frame posts
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.add(_cyl(0.012, 0.012, o.height, M.brass(o.frameColor),
        [Math.sin(a) * (o.radius + 0.02), o.height / 2, Math.cos(a) * (o.radius + 0.02)], 6));
    }
    // top/bottom plates
    g.add(_cyl(o.radius + 0.03, o.radius + 0.03, 0.02, M.brass(o.frameColor), [0, 0.01, 0], 16));
    g.add(_cyl(o.radius + 0.03, o.radius + 0.03, 0.02, M.brass(o.frameColor), [0, o.height - 0.01, 0], 16));
    return g;
  }, {
    icon: "⏳", category: "decorative",
    params: [
      { key: "radius",     label: "Radius", type: "number", min: 0.04, max: 0.15, step: 0.01, default: 0.08 },
      { key: "height",     label: "Height", type: "number", min: 0.15, max: 0.4,  step: 0.02, default: 0.25 },
      { key: "frameColor", label: "Frame",  type: "color",  default: 0xc8a050 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // NATURE
  // ════════════════════════════════════════════════════════

  register("book_stack", function (o) {
    const g = new THREE.Group();
    const palette = [o.color1, o.color2, 0x6b4f1f, 0x222a3c, 0x4a2a52];
    let y = 0;
    for (let i = 0; i < o.count; i++) {
      const bw = rand(0.18, 0.28), bh = rand(0.02, 0.04), bd = rand(0.12, 0.20);
      const book = _box(bw, bh, bd, M.book(pick(palette)), [rand(-0.02, 0.02), y + bh / 2, rand(-0.02, 0.02)]);
      book.rotation.y = rand(-0.2, 0.2);
      g.add(book);
      y += bh;
    }
    return g;
  }, {
    icon: "📚", category: "props",
    params: [
      { key: "count",  label: "Books",   type: "int",   min: 2, max: 10, default: 5 },
      { key: "color1", label: "Color 1", type: "color", default: 0x6b2a1a },
      { key: "color2", label: "Color 2", type: "color", default: 0x2a4830 },
    ],
  });

  register("skull", function (o) {
    const g = new THREE.Group();
    const mat = M.ceramic(o.color);
    // cranium
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), mat);
    head.scale.set(1, 1.1, 1.15);
    head.position.y = 0.08;
    g.add(head);
    // jaw
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), mat);
    jaw.scale.set(1.1, 0.6, 1.0);
    jaw.position.set(0, 0.02, 0.02);
    g.add(jaw);
    // eye sockets (dark)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0808, roughness: 1 });
    [-0.025, 0.025].forEach((x) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), eyeMat);
      eye.position.set(x, 0.09, 0.065);
      g.add(eye);
    });
    return g;
  }, {
    icon: "💀", category: "props",
    params: [
      { key: "color", label: "Color", type: "color", default: 0xe0d8c0 },
    ],
  });

  register("scroll", function (o) {
    const g = new THREE.Group();
    const paper = M.wax(0xf0e8d0);
    // rolled part
    g.add(_cyl(0.02, 0.02, o.width, paper, [0, 0.02, -0.08], 12));
    g.children[0].rotation.z = Math.PI / 2;
    // unrolled sheet
    g.add(_box(o.width, 0.003, o.length, paper, [0, 0.005, o.length / 2 - 0.08]));
    // rod ends
    g.add(_cyl(0.008, 0.008, o.width + 0.04, M.wood(0x3a2818), [0, 0.02, -0.08], 6));
    g.children[2].rotation.z = Math.PI / 2;
    return g;
  }, {
    icon: "📜", category: "props",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.10, max: 0.40, step: 0.02, default: 0.22 },
      { key: "length", label: "Length", type: "number", min: 0.15, max: 0.60, step: 0.05, default: 0.30 },
    ],
  });

  register("grandfather_clock", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const h = o.height;
    // base
    g.add(_box(0.45, h * 0.35, 0.3, mat, [0, h * 0.175, 0]));
    // trunk
    g.add(_box(0.35, h * 0.4, 0.22, mat, [0, h * 0.35 + h * 0.2, 0]));
    // head
    g.add(_box(0.42, h * 0.25, 0.26, mat, [0, h * 0.75 + h * 0.125, 0]));
    // crown
    g.add(_cyl(0.08, 0.22, 0.08, mat, [0, h, 0], 6));
    // clock face
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.14, 24),
      new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.5 })
    );
    face.position.set(0, h * 0.85, 0.131);
    g.add(face);
    // hands
    const handMat = M.metal(0x1a1a1a);
    const minute = _box(0.008, 0.11, 0.005, handMat, [0, h * 0.85 + 0.03, 0.135]);
    minute.rotation.z = rand(0, Math.PI * 2);
    g.add(minute);
    const hour = _box(0.008, 0.07, 0.005, handMat, [0, h * 0.85 + 0.01, 0.137]);
    hour.rotation.z = rand(0, Math.PI * 2);
    g.add(hour);
    // pendulum visible through trunk (decorative)
    const pend = _cyl(0.03, 0.03, 0.005, M.brass(), [0, h * 0.42, 0.12], 16);
    g.add(pend);
    const rod = _box(0.005, 0.18, 0.005, M.metal(), [0, h * 0.52, 0.12]);
    g.add(rod);
    return g;
  }, {
    icon: "🕰️", category: "furniture",
    params: [
      { key: "height", label: "Height", type: "number", min: 1.6, max: 2.6, step: 0.1, default: 2.1 },
      { key: "color",  label: "Wood",   type: "color",  default: 0x4a2a15 },
    ],
  });

  register("trophy", function (o) {
    const g = new THREE.Group();
    const mat = M.brass(o.color);
    // base
    g.add(_box(0.16, 0.04, 0.16, M.marble(), [0, 0.02, 0]));
    g.add(_cyl(0.06, 0.08, 0.06, mat, [0, 0.07, 0], 12));
    // stem
    g.add(_cyl(0.02, 0.02, o.height * 0.3, mat, [0, 0.1 + o.height * 0.15, 0], 8));
    // cup (lathe)
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const r2 = 0.04 + 0.1 * Math.pow(t, 0.5);
      pts.push(new THREE.Vector2(r2, t * o.height * 0.5));
    }
    const cupGeo = new THREE.LatheGeometry(pts, 16);
    const cup = new THREE.Mesh(cupGeo, mat);
    cup.position.y = 0.1 + o.height * 0.3;
    g.add(cup);
    // handles
    for (let s = -1; s <= 1; s += 2) {
      const handle = _cyl(0.008, 0.008, 0.08, mat, [s * 0.13, 0.1 + o.height * 0.5, 0], 6);
      handle.rotation.z = s * 0.6;
      g.add(handle);
    }
    return g;
  }, {
    icon: "🏆", category: "decorative",
    params: [
      { key: "height", label: "Height", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
      { key: "color",  label: "Metal",  type: "color",  default: 0xd4a030 },
    ],
  });

  register("statue", function (o) {
    const g = new THREE.Group();
    const mat = M.marble(o.color);
    // pedestal
    g.add(_box(0.5, 0.3, 0.5, mat, [0, 0.15, 0]));
    g.add(_box(0.4, 0.04, 0.4, mat, [0, 0.32, 0]));
    // body (simple abstract figure)
    g.add(_cyl(0.12, 0.14, o.height * 0.4, mat, [0, 0.34 + o.height * 0.2, 0], 10));
    // torso
    g.add(_cyl(0.10, 0.12, o.height * 0.3, mat, [0, 0.34 + o.height * 0.55, 0], 10));
    // head
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 12, 10),
      mat
    )).position.set(0, 0.34 + o.height * 0.78, 0);
    // arms (simple cylinders)
    for (let s = -1; s <= 1; s += 2) {
      const arm = _cyl(0.03, 0.025, o.height * 0.3, mat, [s * 0.16, 0.34 + o.height * 0.5, 0], 8);
      arm.rotation.z = s * 0.3;
      g.add(arm);
    }
    return g;
  }, {
    icon: "🗿", category: "decorative",
    params: [
      { key: "height", label: "Height", type: "number", min: 0.6, max: 2.5, step: 0.1, default: 1.2 },
      { key: "color",  label: "Stone",  type: "color",  default: 0xd8d0c8 },
    ],
  });

  register("banner", function (o) {
    const g = new THREE.Group();
    const pole = M.wood(0x4a3a28);
    const cloth = M.cloth(o.color);
    // horizontal pole
    g.add(_cyl(0.02, 0.02, o.width + 0.1, pole, [0, 0, 0], 8));
    // Rotate pole to horizontal
    g.children[0].rotation.z = Math.PI / 2;
    // cloth (flat plane, double-sided)
    const clothGeo = new THREE.PlaneGeometry(o.width, o.height);
    const banner = new THREE.Mesh(clothGeo, cloth);
    banner.position.set(0, -o.height / 2, 0);
    g.add(banner);
    // end caps
    g.add(_cyl(0.03, 0.03, 0.04, pole, [-o.width/2 - 0.02, 0, 0], 8));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    g.add(_cyl(0.03, 0.03, 0.04, pole, [ o.width/2 + 0.02, 0, 0], 8));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    return g;
  }, {
    icon: "🚩", category: "decorative",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.4, max: 2.0, step: 0.1, default: 0.8 },
      { key: "height", label: "Height", type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.6 },
      { key: "color",  label: "Cloth",  type: "color",  default: 0x8a1a2a },
    ],
  });

  register("tapestry", function (o) {
    const g = new THREE.Group();
    const mat = M.cloth(o.color);
    const rodMat = M.brass(0x8a7040);
    // cloth body
    const geo = new THREE.PlaneGeometry(o.width, o.height);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -o.height / 2, 0);
    g.add(mesh);
    // top rod
    g.add(_cyl(0.015, 0.015, o.width + 0.08, rodMat, [0, 0, 0], 8));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // bottom rod
    g.add(_cyl(0.012, 0.012, o.width * 0.9, rodMat, [0, -o.height, 0], 8));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    // fringe at bottom
    for (let i = 0; i < 8; i++) {
      const fx = -o.width * 0.4 + i * (o.width * 0.8 / 7);
      g.add(_cyl(0.003, 0.003, 0.06, rodMat, [fx, -o.height - 0.03, 0], 4));
    }
    return g;
  }, {
    icon: "🎨", category: "decorative",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.0 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 3.0, step: 0.1, default: 1.5 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a2a3a },
    ],
  });

  register("telescope_floor", function (o) {
    const g = new THREE.Group();
    const mat = M.brass(o.color);
    const h = o.height;
    // tripod legs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = _cyl(0.015, 0.015, h, mat, [0, 0, 0], 6);
      leg.position.set(Math.sin(a) * 0.25, h/2, Math.cos(a) * 0.25);
      leg.rotation.x = Math.sin(a) * 0.15;
      leg.rotation.z = -Math.cos(a) * 0.15;
      g.add(leg);
    }
    // tube
    g.add(_cyl(0.05, 0.04, h * 0.6, mat, [0, h * 0.85, 0], 12));
    g.children[g.children.length - 1].rotation.x = -0.5;
    // eyepiece
    g.add(_cyl(0.03, 0.03, 0.06, mat, [0, h * 0.7, h * 0.15], 8));
    // lens cap
    g.add(_cyl(0.055, 0.055, 0.01, M.glass(0x88aacc), [0, h * 1.0, -h * 0.18], 12));
    return g;
  }, {
    icon: "🔭", category: "props",
    params: [
      { key: "height", label: "Height", type: "number", min: 1.0, max: 2.0, step: 0.1, default: 1.4 },
      { key: "color",  label: "Brass",  type: "color",  default: 0xc8a050 },
    ],
  });

  register("book", (opts = {}) => {
    return new THREE.Mesh(
      new THREE.BoxGeometry(opts.width || 0.10, opts.height || 0.40, opts.depth || 0.18),
      M.book(_c(opts.color, 0x6b2a1a))
    );
  }, { icon: "📕", category: "props", params: [
    { key: "width",  label: "Spine",  type: "number", min: 0.03, max: 0.30, step: 0.01, default: 0.10 },
    { key: "height", label: "Height", type: "number", min: 0.15, max: 0.50, step: 0.02, default: 0.40 },
    { key: "depth",  label: "Depth",  type: "number", min: 0.10, max: 0.30, step: 0.01, default: 0.18 },
    { key: "color",  label: "Cover",  type: "color",  default: 0x6b2a1a },
  ]});

  register("rug", (opts = {}) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(opts.width || 4.4, opts.depth || 6),
      M.cloth(_c(opts.color, 0x4a2a22))
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.005;
    return m;
  }, { icon: "🟫", category: "furniture", params: [
    { key: "width", label: "Width", type: "number", min: 1.0, max: 8.0, step: 0.2, default: 4.4 },
    { key: "depth", label: "Depth", type: "number", min: 1.0, max: 8.0, step: 0.2, default: 6.0 },
    { key: "color", label: "Color", type: "color",  default: 0x4a2a22 },
  ]});

  register("rugRound", (opts = {}) => {
    const r = opts.radius || 1.4;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 36), M.cloth(_c(opts.color, 0x4a2a22)));
    m.rotation.x = -Math.PI/2; m.position.y = 0.005; return m;
  }, { icon: "⬤", category: "furniture", params: [
    { key: "radius", label: "Radius", type: "number", min: 0.5, max: 4.0, step: 0.1, default: 1.4 },
    { key: "color",  label: "Color",  type: "color",  default: 0x4a2a22 },
  ]});

  register("painting", (opts = {}) => {
    const W = opts.width || 0.8, H = opts.height || 0.6;
    const g = new THREE.Group();
    const frame = M.wood(_c(opts.frameColor, 0x2a1810));
    g.add(_box(W+0.06, H+0.06, 0.04, frame, [0, 0, 0]));
    const cMat = new THREE.MeshStandardMaterial({ color: _c(opts.color, 0x6a4a32), roughness: 0.8 });
    g.add(_box(W, H, 0.02, cMat, [0, 0, 0.022]));
    return g;
  }, { icon: "🖼", category: "decor", params: [
    { key: "width",      label: "Width",   type: "number", min: 0.3, max: 2.0, step: 0.05, default: 0.8 },
    { key: "height",     label: "Height",  type: "number", min: 0.2, max: 1.6, step: 0.05, default: 0.6 },
    { key: "color",      label: "Canvas",  type: "color",  default: 0x6a4a32 },
    { key: "frameColor", label: "Frame",   type: "color",  default: 0x2a1810 },
  ]});

  register("mirrorWall", (opts = {}) => {
    const W = opts.width || 0.7, H = opts.height || 1.4;
    const g = new THREE.Group();
    g.add(_box(W, H, 0.05, M.wood(_c(opts.frameColor, 0x2a1810)), [0, 0, 0]));
    g.add(_box(W-0.08, H-0.08, 0.02, new THREE.MeshStandardMaterial({
      color: 0xcfd6dc, roughness: 0.05, metalness: 0.9,
    }), [0, 0, 0.022]));
    return g;
  }, { icon: "🪞", category: "decor", params: [
    { key: "width",      label: "Width",  type: "number", min: 0.3, max: 1.8, step: 0.05, default: 0.7 },
    { key: "height",     label: "Height", type: "number", min: 0.4, max: 2.4, step: 0.05, default: 1.4 },
    { key: "frameColor", label: "Frame",  type: "color",  default: 0x2a1810 },
  ]});

  register("vase", (opts = {}) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: _c(opts.color, 0xc8a47a), roughness: 0.4 });
    const H = opts.height || 0.30;
    g.add(_cyl(0.10, 0.16, H, mat, [0, H/2, 0], 20));
    g.add(_cyl(0.08, 0.10, 0.06, mat, [0, H+0.03, 0], 20));
    return g;
  }, { icon: "🏺", category: "decor", params: [
    { key: "height", label: "Height", type: "number", min: 0.15, max: 0.7, step: 0.02, default: 0.30 },
    { key: "color",  label: "Glaze",  type: "color",  default: 0xc8a47a },
  ]});

  register("vaseTall", (opts = {}) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: _c(opts.color, 0x3a3a3a), roughness: 0.3 });
    const H = opts.height || 0.65;
    g.add(_cyl(0.14, 0.10, H, mat, [0, H/2, 0], 24));
    g.add(_cyl(0.12, 0.14, 0.05, mat, [0, H+0.025, 0], 24));
    return g;
  }, { icon: "🏺", category: "decor", params: [
    { key: "height", label: "Height", type: "number", min: 0.4, max: 1.3, step: 0.05, default: 0.65 },
    { key: "color",  label: "Glaze",  type: "color",  default: 0x3a3a3a },
  ]});

  register("clockWall", (opts = {}) => {
    const g = new THREE.Group();
    const frame = M.wood(_c(opts.frameColor, 0x2a1810));
    const face  = new THREE.MeshStandardMaterial({ color: _c(opts.faceColor, 0xece2c8), roughness: 0.5 });
    const R = opts.radius || 0.22;
    g.add(_cyl(R, R, 0.04, frame, [0, 0, -0.02], 32));
    g.add(_cyl(R-0.02, R-0.02, 0.01, face, [0, 0, 0.005], 32));
    const hand = new THREE.MeshStandardMaterial({ color: _c(opts.handColor, 0x1a1410) });
    g.add(_box(0.012, R*0.7, 0.005, hand, [0, R*0.27, 0.012]));
    g.add(_box(0.014, R*0.5, 0.005, hand, [R*0.18, R*0.09, 0.012]));
    return g;
  }, { icon: "🕰", category: "decor", params: [
    { key: "radius",     label: "Size",   type: "number", min: 0.12, max: 0.5, step: 0.02, default: 0.22 },
    { key: "faceColor",  label: "Face",   type: "color",  default: 0xece2c8 },
    { key: "frameColor", label: "Frame",  type: "color",  default: 0x2a1810 },
    { key: "handColor",  label: "Hands",  type: "color",  default: 0x1a1410 },
  ]});

  register("sculpture", (opts = {}) => {
    const g = new THREE.Group();
    const stone = M.stone(_c(opts.color, 0xcfc4ae));
    g.add(_box(0.5, 0.3, 0.5, stone, [0, 0.15, 0]));
    g.add(_sph(0.22, stone, [0, 0.52, 0], 14));
    g.add(_cone(0.12, 0.5, stone, [0, 0.85, 0], 8));
    return g;
  }, { icon: "🗿", category: "decor", params: [
    { key: "color", label: "Stone", type: "color", default: 0xcfc4ae },
  ]});

  register("pillow", (opts = {}) => {
    return _box(opts.width || 0.42, 0.12, opts.depth || 0.30, M.cloth(_c(opts.color, 0xc8a47a)), [0, 0.06, 0]);
  }, { icon: "🛌", category: "decor", params: [
    { key: "width", label: "Width", type: "number", min: 0.25, max: 0.7, step: 0.02, default: 0.42 },
    { key: "depth", label: "Depth", type: "number", min: 0.2,  max: 0.6, step: 0.02, default: 0.30 },
    { key: "color", label: "Fabric", type: "color", default: 0xc8a47a },
  ]});

  // ═══════════════════════════════════════════════════════
  // TECH
  // ═══════════════════════════════════════════════════════

  register("washbasin", function (o) {
    const g = new THREE.Group();
    const cer = M.ceramic(o.color);
    const w = M.wood(o.standColor);
    // stand – four legs
    const lx = o.radius * 0.6, lz = o.radius * 0.6;
    [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]].forEach(([x, z]) => {
      g.add(_cyl(0.02, 0.025, o.height - 0.06, w, [x, (o.height - 0.06) / 2, z], 6));
    });
    // cross braces
    g.add(_box(lx * 2, 0.02, 0.02, w, [0, o.height * 0.3, 0]));
    g.add(_box(0.02, 0.02, lz * 2, w, [0, o.height * 0.3, 0]));
    // bowl (flattened sphere, top half only)
    const bowl = new THREE.Mesh(
      new THREE.SphereGeometry(o.radius, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      cer
    );
    bowl.rotation.x = Math.PI;
    bowl.position.y = o.height;
    g.add(bowl);
    // rim
    g.add(_tor(o.radius, 0.012, cer, [0, o.height, 0], 8, 24));
    return g;
  }, {
    icon: "🚿", category: "props",
    params: [
      { key: "radius",     label: "Radius", type: "number", min: 0.12, max: 0.35, step: 0.02, default: 0.2 },
      { key: "height",     label: "Height", type: "number", min: 0.5,  max: 1.0,  step: 0.05, default: 0.75 },
      { key: "color",      label: "Basin",  type: "color",  default: 0xe8dcc8 },
      { key: "standColor", label: "Stand",  type: "color",  default: 0x5a3a1a },
    ],
  });

  register("ink_well", function (o) {
    const g = new THREE.Group();
    const gl = M.glass(o.color);
    const br = M.brass(o.trimColor);
    // glass bottle body
    g.add(_cyl(o.radius, o.radius * 1.1, o.height, gl, [0, o.height / 2, 0], 8));
    // brass rim
    g.add(_cyl(o.radius + 0.005, o.radius + 0.005, 0.015, br, [0, o.height, 0], 8));
    // small brass base
    g.add(_cyl(o.radius * 1.15, o.radius * 1.15, 0.01, br, [0, 0.005, 0], 8));
    // quill pen resting diagonally
    const quill = _cyl(0.004, 0.002, o.height * 1.5, M.wax(0xf5f0e0), [0, o.height * 0.8, 0], 4);
    quill.rotation.z = 0.5;
    quill.rotation.x = 0.2;
    g.add(quill);
    return g;
  }, {
    icon: "🖋️", category: "props",
    params: [
      { key: "radius",    label: "Radius", type: "number", min: 0.02, max: 0.08, step: 0.01, default: 0.04 },
      { key: "height",    label: "Height", type: "number", min: 0.04, max: 0.12, step: 0.01, default: 0.06 },
      { key: "color",     label: "Glass",  type: "color",  default: 0x2a3a4a },
      { key: "trimColor", label: "Trim",   type: "color",  default: 0xc8a050 },
    ],
  });

  register("wine_rack", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // frame sides
    g.add(_box(0.03, o.height, o.depth, w, [-o.width / 2, o.height / 2, 0]));
    g.add(_box(0.03, o.height, o.depth, w, [o.width / 2, o.height / 2, 0]));
    // cross supports forming diamond slots
    const rows = o.rows;
    const cols = o.cols;
    const cellH = (o.height - 0.04) / rows;
    const cellW = (o.width - 0.06) / cols;
    for (let r = 0; r <= rows; r++) {
      const y = 0.02 + r * cellH;
      g.add(_box(o.width - 0.04, 0.02, o.depth, w, [0, y, 0]));
    }
    for (let c = 1; c < cols; c++) {
      const x = -o.width / 2 + 0.03 + c * cellW;
      g.add(_box(0.02, o.height - 0.02, o.depth, w, [x, o.height / 2, 0]));
    }
    return g;
  }, {
    icon: "🍷", category: "furniture",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 0.3, max: 1.2, step: 0.1,  default: 0.6 },
      { key: "height", label: "Height", type: "number", min: 0.4, max: 1.5, step: 0.1,  default: 0.8 },
      { key: "depth",  label: "Depth",  type: "number", min: 0.2, max: 0.4, step: 0.05, default: 0.3 },
      { key: "rows",   label: "Rows",   type: "int",    min: 2,   max: 6,   default: 3 },
      { key: "cols",   label: "Cols",   type: "int",    min: 2,   max: 5,   default: 3 },
      { key: "color",  label: "Color",  type: "color",  default: 0x4a3018 },
    ],
  });

  register("ink_well", function (o) {
    const g = new THREE.Group();
    // bottle body
    g.add(_cyl(o.radius, o.radius * 0.85, o.height, M.glass(o.glassColor),
      [0, o.height / 2, 0], 10));
    // ink inside
    g.add(_cyl(o.radius * 0.8, o.radius * 0.75, o.height * 0.6, M.metal(o.inkColor),
      [0, o.height * 0.3, 0], 10));
    // neck
    g.add(_cyl(o.radius * 0.5, o.radius * 0.4, o.height * 0.15, M.glass(o.glassColor),
      [0, o.height + o.height * 0.075, 0], 8));
    // quill resting against it
    const quillLen = o.height * 2;
    const quill = _cyl(0.004, 0.002, quillLen, M.plaster(0xd8d0c0), [0, 0, 0], 4);
    quill.position.set(o.radius + 0.02, o.height * 0.6, 0);
    quill.rotation.z = 0.3;
    g.add(quill);
    // feather at top of quill
    g.add(_sph(0.015, M.cloth(0x3a3a5a), [o.radius + 0.02 + Math.sin(0.3) * quillLen * 0.4,
      o.height * 0.6 + Math.cos(0.3) * quillLen * 0.4, 0], 5));
    return g;
  }, {
    icon: "✒️", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.02, max: 0.06, step: 0.005, default: 0.03 },
      { key: "height", label: "Height", type: "number", min: 0.04, max: 0.1, step: 0.01, default: 0.06 },
      { key: "glassColor", label: "Glass", type: "color", default: 0x506058 },
      { key: "inkColor", label: "Ink", type: "color", default: 0x0a0a1a },
    ],
  });

  register("wine_rack", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // frame
    g.add(_box(0.04, o.height, 0.04, w, [-o.width / 2, o.height / 2, -o.depth / 2]));
    g.add(_box(0.04, o.height, 0.04, w, [o.width / 2, o.height / 2, -o.depth / 2]));
    g.add(_box(0.04, o.height, 0.04, w, [-o.width / 2, o.height / 2, o.depth / 2]));
    g.add(_box(0.04, o.height, 0.04, w, [o.width / 2, o.height / 2, o.depth / 2]));
    // shelves with bottle cradles
    const shelves = Math.floor(o.height / 0.15);
    for (let s = 0; s < shelves; s++) {
      const y = 0.08 + s * 0.15;
      // cross supports
      g.add(_box(o.width, 0.015, 0.015, w, [0, y, -o.depth / 2 + 0.01]));
      g.add(_box(o.width, 0.015, 0.015, w, [0, y, o.depth / 2 - 0.01]));
      // bottles
      const bottleCount = Math.floor(o.width / 0.07);
      for (let b = 0; b < bottleCount; b++) {
        if (rand(0, 1) > 0.7) continue; // some empty slots
        const x = -o.width / 2 + 0.04 + b * 0.07;
        g.add(_cyl(0.015, 0.015, o.depth - 0.04,
          M.glass(pick([0x2a4a20, 0x3a2a18, 0x1a3a2a])),
          [x, y + 0.02, 0], 6));
        g.children[g.children.length - 1].rotation.x = Math.PI / 2;
      }
    }
    return g;
  }, {
    icon: "🍷", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.5 },
      { key: "height", label: "Height", type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.6 },
      { key: "depth", label: "Depth", type: "number", min: 0.15, max: 0.4, step: 0.05, default: 0.25 },
      { key: "color", label: "Color", type: "color", default: 0x5a3a1a },
    ],
  });

  register("washbasin", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const cer = M.ceramic(o.basinColor);
    // stand (3 legs)
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      g.add(_cyl(0.015, 0.02, o.height, w,
        [Math.cos(a) * o.radius * 0.7, o.height / 2, Math.sin(a) * o.radius * 0.7], 5));
    }
    // ring support
    g.add(_tor(o.radius * 0.75, 0.01, w, [0, o.height - 0.05, 0], 10, 4));
    // basin bowl
    g.add(_cyl(o.radius * 0.85, o.radius, 0.06, cer, [0, o.height, 0], 12));
    // water inside
    g.add(_cyl(o.radius * 0.8, o.radius * 0.8, 0.02, M.glass(0x6a9ab0), [0, o.height + 0.03, 0], 12));
    return g;
  }, {
    icon: "🪣", category: "props",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.1, max: 0.3, step: 0.02, default: 0.18 },
      { key: "height", label: "Height", type: "number", min: 0.4, max: 1.0, step: 0.1, default: 0.7 },
      { key: "color", label: "Stand", type: "color", default: 0x5a3a1a },
      { key: "basinColor", label: "Basin", type: "color", default: 0xc8c0b0 },
    ],
  });

  register("treasure_chest", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const met = M.metal(o.metalColor);
    // base box
    g.add(_box(o.width, o.height * 0.6, o.depth, w, [0, o.height * 0.3, 0]));
    // lid (rounded top)
    const lidR = o.width / 2;
    const lid = _cyl(lidR, lidR, o.depth, w, [0, o.height * 0.6, 0], 8);
    lid.rotation.x = Math.PI / 2;
    lid.scale.y = 0.4;
    g.add(lid);
    // metal bands
    g.add(_box(o.width + 0.01, 0.02, o.depth + 0.01, met, [0, o.height * 0.15, 0]));
    g.add(_box(o.width + 0.01, 0.02, o.depth + 0.01, met, [0, o.height * 0.45, 0]));
    // lock plate
    g.add(_box(0.06, 0.06, 0.01, met, [0, o.height * 0.5, o.depth / 2 + 0.005]));
    g.add(_cyl(0.008, 0.008, 0.02, met, [0, o.height * 0.48, o.depth / 2 + 0.01], 6));
    // corner reinforcements
    const corners = [[-o.width / 2, -o.depth / 2], [o.width / 2, -o.depth / 2],
                      [-o.width / 2, o.depth / 2], [o.width / 2, o.depth / 2]];
    corners.forEach(([x, z]) => {
      g.add(_box(0.03, o.height * 0.6, 0.03, met, [x, o.height * 0.3, z]));
    });
    // handle on side
    g.add(_tor(0.025, 0.005, met, [o.width / 2 + 0.005, o.height * 0.35, 0], 8, 4));
    g.children[g.children.length - 1].rotation.y = Math.PI / 2;
    return g;
  }, {
    icon: "💰", category: "props",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
      { key: "height", label: "Height", type: "number", min: 0.15, max: 0.4, step: 0.03, default: 0.25 },
      { key: "depth", label: "Depth", type: "number", min: 0.12, max: 0.35, step: 0.03, default: 0.2 },
      { key: "color", label: "Wood", type: "color", default: 0x4a2818 },
      { key: "metalColor", label: "Metal", type: "color", default: 0x8a7a30 },
    ],
  });

  register("rug", function ({ width = 4.4, depth = 6, color = 0x4a2a22 } = {}) {
  const r = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), M.cloth(color));
  r.rotation.x = -Math.PI / 2;
  r.position.y = 0.005;
  return r;
}, { category: "furniture" });

  register("orb", function ({ radius = 0.3, color = 0xd4a373 } = {}) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 16),
    new THREE.MeshStandardMaterial({
      color, roughness: 0.3, metalness: 0.6,
      emissive: color, emissiveIntensity: 0.2,
    })
  );
}, { category: "decor" });

  register("book", function ({ width = 0.10, height = 0.40, depth = 0.18, color = 0x6b2a1a, title = "" } = {}) {
  if (!title) return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), M.book(color));
  const spineTex = _spineTexture({ width, height, color, title });
  const mats = [
    M.book(color), M.book(color), M.book(color), M.book(color),
    new THREE.MeshStandardMaterial({ map: spineTex, roughness: 0.8 }),
    M.book(color),
  ];
  return new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mats);
}, { category: "decor" });

  register("bookwall", function ({ width = 2.4, height = 3.6, rows = 5, palette = [0x6b2a1a, 0x2a4830, 0x4a2a52, 0x6b4f1f, 0x222a3c, 0x8a5a2a] } = {}) {
  const group = new THREE.Group();
  const rowH = height / rows;
  const buckets = palette.map(() => []);
  for (let r = 0; r < rows; r++) {
    let x = -width / 2 + 0.04;
    while (x < width / 2 - 0.04) {
      const w = rand(0.06, 0.12);
      const h = rand(rowH * 0.55, rowH * 0.85);
      const idx = Math.floor(Math.random() * palette.length);
      buckets[idx].push({ x: x + w / 2, y: r * rowH + h / 2 + 0.03, w, h, d: 0.20 });
      x += w + 0.004;
    }
  }
  const baseGeo = new THREE.BoxGeometry(1, 1, 1);
  const mat4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();
  buckets.forEach((bucket, i) => {
    if (!bucket.length) return;
    const inst = new THREE.InstancedMesh(baseGeo, M.book(palette[i]), bucket.length);
    inst.userData.noCollide = true;
    bucket.forEach((b, j) => {
      pos.set(b.x, b.y, 0);
      scale.set(b.w, b.h, b.d);
      mat4.compose(pos, quat, scale);
      inst.setMatrixAt(j, mat4);
    });
    inst.instanceMatrix.needsUpdate = true;
    group.add(inst);
  });
  return group;
}, { category: "decor" });

})();
