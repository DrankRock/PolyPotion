// category: "nature"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  register("pine_tree", function (o) {
    const g = new THREE.Group();
    const trunkH = o.height * 0.35;
    g.add(_cyl(0.06, 0.10, trunkH, M.wood(0x3c2818), [0, trunkH / 2, 0], 8));
    // Layered cones
    const leaf = M.leaf(o.color);
    for (let i = 0; i < o.layers; i++) {
      const t = i / o.layers;
      const y = trunkH + t * o.height * 0.6;
      const r = (1 - t * 0.7) * o.height * 0.25;
      const h = o.height * 0.22;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), leaf);
      cone.position.y = y + h / 2;
      g.add(cone);
    }
    return g;
  }, {
    icon: "🌲", category: "nature",
    params: [
      { key: "height", label: "Height", type: "number", min: 1.5, max: 8.0, step: 0.5, default: 4.0 },
      { key: "layers", label: "Layers", type: "int",    min: 3,   max: 8,   default: 5 },
      { key: "color",  label: "Color",  type: "color",  default: 0x2a4a28 },
    ],
  });

  register("bush", function (o) {
    const g = new THREE.Group();
    const leaf = M.leaf(o.color);
    for (let i = 0; i < o.blobs; i++) {
      const r = rand(0.15, 0.35) * o.size;
      const f = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), leaf);
      f.position.set(rand(-0.3, 0.3) * o.size, r + rand(0, 0.15), rand(-0.3, 0.3) * o.size);
      g.add(f);
    }
    return g;
  }, {
    icon: "🌿", category: "nature",
    params: [
      { key: "size",  label: "Size",  type: "number", min: 0.3, max: 2.0, step: 0.1, default: 1.0 },
      { key: "blobs", label: "Blobs", type: "int",    min: 2,   max: 8,   default: 4 },
      { key: "color", label: "Color", type: "color",  default: 0x3a5230 },
    ],
  });

  register("pond", function (o) {
    const g = new THREE.Group();
    // water surface
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(o.radius, 48),
      new THREE.MeshStandardMaterial({
        color: o.color, roughness: 0.05, metalness: 0.1,
        transparent: true, opacity: 0.75,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.01;
    g.add(water);
    // stone border
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = o.radius + rand(-0.05, 0.05);
      const stone = new THREE.Mesh(
        new THREE.SphereGeometry(rand(0.08, 0.14), 6, 4),
        M.stone(0x6a6258)
      );
      stone.position.set(Math.sin(a) * r, 0.04, Math.cos(a) * r);
      stone.scale.y = 0.5;
      g.add(stone);
    }
    return g;
  }, {
    icon: "💧", category: "nature",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.5, max: 4.0, step: 0.25, default: 1.5 },
      { key: "color",  label: "Water",  type: "color",  default: 0x2a4a5a },
    ],
  });

  register("flower_cluster", function (o) {
    const g = new THREE.Group();
    const colors = [o.color, o.color2, 0xffffff];
    for (let i = 0; i < o.count; i++) {
      const x = rand(-o.spread, o.spread);
      const z = rand(-o.spread, o.spread);
      // stem
      const stemH = rand(0.10, 0.25);
      g.add(_cyl(0.006, 0.006, stemH, M.leaf(0x3a6a30), [x, stemH / 2, z], 4));
      // bloom
      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(rand(0.03, 0.06), 6, 4),
        new THREE.MeshStandardMaterial({
          color: pick(colors), roughness: 0.7,
          emissive: pick(colors), emissiveIntensity: 0.04,
        })
      );
      bloom.position.set(x, stemH + 0.02, z);
      g.add(bloom);
    }
    return g;
  }, {
    icon: "🌸", category: "nature",
    params: [
      { key: "count",  label: "Flowers", type: "int",    min: 5,    max: 40,  default: 15 },
      { key: "spread", label: "Spread",  type: "number", min: 0.2,  max: 2.0, step: 0.1, default: 0.6 },
      { key: "color",  label: "Color 1", type: "color",  default: 0xd86040 },
      { key: "color2", label: "Color 2", type: "color",  default: 0xe8c060 },
    ],
  });

  register("mushroom_ring", function (o) {
    const g = new THREE.Group();
    for (let i = 0; i < o.count; i++) {
      const a = (i / o.count) * Math.PI * 2 + rand(-0.15, 0.15);
      const r = o.radius + rand(-0.1, 0.1);
      const mush = new THREE.Group();
      const stemH = rand(0.06, 0.14);
      mush.add(_cyl(0.02, 0.025, stemH, M.wax(0xe8dcc0), [0, stemH / 2, 0], 6));
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(rand(0.04, 0.08), 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: o.capColor, roughness: 0.6 })
      );
      cap.position.y = stemH;
      mush.add(cap);
      mush.position.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      mush.rotation.y = rand(0, Math.PI * 2);
      g.add(mush);
    }
    return g;
  }, {
    icon: "🍄", category: "nature",
    params: [
      { key: "count",    label: "Count",  type: "int",    min: 4,   max: 16,  default: 8 },
      { key: "radius",   label: "Radius", type: "number", min: 0.3, max: 2.0, step: 0.1, default: 0.8 },
      { key: "capColor", label: "Cap",    type: "color",  default: 0xb83020 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // LIGHTING
  // ════════════════════════════════════════════════════════

  register("potted_plant", function (o) {
    const g = new THREE.Group();
    // pot
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(o.potRadius, o.potRadius * 0.75, o.potHeight, 16),
      M.ceramic(o.potColor)
    );
    pot.position.y = o.potHeight / 2;
    g.add(pot);
    // dirt
    g.add(_cyl(o.potRadius - 0.01, o.potRadius - 0.01, 0.02, M.wood(0x3a2818), [0, o.potHeight - 0.01, 0], 16));
    // plant foliage
    const leaf = M.leaf(o.leafColor);
    for (let i = 0; i < o.leaves; i++) {
      const a = (i / o.leaves) * Math.PI * 2 + rand(-0.3, 0.3);
      const r = rand(0.05, 0.15);
      const h = rand(0.08, 0.20);
      const f = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), leaf);
      f.position.set(Math.sin(a) * o.potRadius * 0.5, o.potHeight + h, Math.cos(a) * o.potRadius * 0.5);
      f.scale.y = 1.3;
      g.add(f);
    }
    return g;
  }, {
    icon: "🪴", category: "props",
    params: [
      { key: "potRadius", label: "Pot R",   type: "number", min: 0.06, max: 0.25, step: 0.02, default: 0.12 },
      { key: "potHeight", label: "Pot H",   type: "number", min: 0.08, max: 0.30, step: 0.02, default: 0.14 },
      { key: "leaves",    label: "Leaves",  type: "int",    min: 3,    max: 12,   default: 6 },
      { key: "potColor",  label: "Pot",     type: "color",  default: 0xb07850 },
      { key: "leafColor", label: "Leaves",  type: "color",  default: 0x3a6a30 },
    ],
  });

  register("willow_tree", function (o) {
    const g = new THREE.Group();
    const bark = M.wood(o.trunkColor);
    const leafMat = M.leaf(o.leafColor);
    const h = o.height;
    // trunk
    g.add(_cyl(0.12, 0.18, h * 0.5, bark, [0, h * 0.25, 0], 8));
    // canopy: drooping cylinders of foliage
    const branches = o.branches;
    for (let i = 0; i < branches; i++) {
      const angle = (i / branches) * Math.PI * 2 + rand(-0.2, 0.2);
      const br = o.spread;
      const bx = Math.sin(angle) * br * 0.4;
      const bz = Math.cos(angle) * br * 0.4;
      // hanging frond
      const frondH = h * rand(0.4, 0.7);
      const frond = _cyl(0.04, 0.01, frondH, leafMat, [bx, h * 0.5 - frondH * 0.3, bz], 6);
      g.add(frond);
      // top cluster
      g.add(new THREE.Mesh(
        new THREE.SphereGeometry(rand(0.15, 0.25), 8, 6),
        leafMat
      )).position.set(bx, h * 0.5 + rand(0, 0.1), bz);
    }
    // crown
    g.add(new THREE.Mesh(
      new THREE.SphereGeometry(o.spread * 0.35, 10, 8),
      leafMat
    )).position.set(0, h * 0.55, 0);
    return g;
  }, {
    icon: "🌳", category: "nature",
    params: [
      { key: "height",     label: "Height",    type: "number", min: 2.0, max: 6.0, step: 0.5, default: 3.5 },
      { key: "spread",     label: "Spread",    type: "number", min: 1.0, max: 4.0, step: 0.5, default: 2.0 },
      { key: "branches",   label: "Branches",  type: "int",    min: 6,   max: 20,  default: 10 },
      { key: "trunkColor", label: "Trunk",     type: "color",  default: 0x5a4a30 },
      { key: "leafColor",  label: "Leaves",    type: "color",  default: 0x5a8a40 },
    ],
  });

  register("fallen_log", function (o) {
    const g = new THREE.Group();
    const mat = M.wood(o.color);
    const l = o.length;
    // main log
    const log = _cyl(o.radius, o.radius * 0.9, l, mat, [0, o.radius, 0], 10);
    log.rotation.z = Math.PI / 2;
    g.add(log);
    // broken branch stubs
    for (let i = 0; i < 3; i++) {
      const bx = rand(-l * 0.3, l * 0.3);
      const stub = _cyl(0.02, 0.01, rand(0.1, 0.2), mat, [bx, o.radius + 0.08, rand(-0.03, 0.03)], 6);
      stub.rotation.z = rand(-0.5, 0.5);
      stub.rotation.x = rand(-0.5, 0.5);
      g.add(stub);
    }
    // moss patches
    if (o.mossy) {
      const mossMat = M.leaf(0x3a5a2a);
      for (let i = 0; i < 4; i++) {
        const mx = rand(-l * 0.35, l * 0.35);
        g.add(new THREE.Mesh(
          new THREE.SphereGeometry(rand(0.04, 0.08), 6, 4),
          mossMat
        )).position.set(mx, o.radius * 1.6, rand(-0.03, 0.03));
      }
    }
    return g;
  }, {
    icon: "🪵", category: "nature",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.0, max: 4.0, step: 0.25, default: 2.0 },
      { key: "radius", label: "Thick",  type: "number", min: 0.06, max: 0.25, step: 0.02, default: 0.12 },
      { key: "mossy",  label: "Moss",   type: "bool",   default: true },
      { key: "color",  label: "Wood",   type: "color",  default: 0x5a4a38 },
    ],
  });

  register("lily_pad_cluster", function (o) {
    const g = new THREE.Group();
    const mat = M.leaf(o.color);
    const count = o.count;
    for (let i = 0; i < count; i++) {
      const r2 = rand(0.06, 0.14);
      const px = rand(-o.spread/2, o.spread/2);
      const pz = rand(-o.spread/2, o.spread/2);
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(r2, 12, 0, Math.PI * 1.8),
        mat
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(px, 0.01, pz);
      pad.rotation.z = rand(0, Math.PI * 2);
      g.add(pad);
      // occasional flower
      if (Math.random() < 0.3) {
        const petal = new THREE.MeshStandardMaterial({ color: o.flowerColor, roughness: 0.7, side: THREE.DoubleSide });
        for (let p = 0; p < 5; p++) {
          const pa = (p / 5) * Math.PI * 2;
          const fl = new THREE.Mesh(new THREE.CircleGeometry(0.025, 6), petal);
          fl.rotation.x = -Math.PI / 2 + 0.5;
          fl.rotation.z = pa;
          fl.position.set(px + Math.sin(pa) * 0.03, 0.03, pz + Math.cos(pa) * 0.03);
          g.add(fl);
        }
      }
    }
    return g;
  }, {
    icon: "🪷", category: "nature",
    params: [
      { key: "count",       label: "Pads",    type: "int",    min: 3,   max: 15,  default: 7 },
      { key: "spread",      label: "Spread",  type: "number", min: 0.5, max: 3.0, step: 0.25, default: 1.2 },
      { key: "color",       label: "Leaf",    type: "color",  default: 0x3a6a30 },
      { key: "flowerColor", label: "Flower",  type: "color",  default: 0xf0a0b0 },
    ],
  });

  register("vine_wall", function (o) {
    const g = new THREE.Group();
    const mat = M.leaf(o.color);
    const w = o.width, h = o.height;
    // backing trellis
    const trellis = M.wood(0x5a4a38);
    g.add(_box(w, 0.02, h, trellis, [0, h/2, 0]));
    g.children[0].rotation.x = Math.PI / 2;
    // vines
    const vines = o.density;
    for (let v = 0; v < vines; v++) {
      const vx = rand(-w/2, w/2);
      let vy = h;
      while (vy > 0) {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(rand(0.04, 0.08), 6, 4),
          mat
        );
        leaf.position.set(vx + rand(-0.06, 0.06), vy, rand(-0.02, 0.06));
        g.add(leaf);
        vy -= rand(0.08, 0.16);
      }
    }
    return g;
  }, {
    icon: "🌿", category: "nature",
    params: [
      { key: "width",   label: "Width",   type: "number", min: 0.5, max: 4.0, step: 0.25, default: 1.5 },
      { key: "height",  label: "Height",  type: "number", min: 1.0, max: 4.0, step: 0.25, default: 2.5 },
      { key: "density", label: "Vines",   type: "int",    min: 3,   max: 15,  default: 8 },
      { key: "color",   label: "Leaf",    type: "color",  default: 0x3a6830 },
    ],
  });

  // ════════════════════════════════════════════════════════
  // LIGHTING — WAVE 2
  // ════════════════════════════════════════════════════════

  register("plantPot", (opts = {}) => {
    const g = new THREE.Group();
    const pot = new THREE.MeshStandardMaterial({ color: _c(opts.potColor, 0x6b3a22), roughness: 0.75 });
    const R = opts.radius || 0.20;
    g.add(_cyl(R, R*1.25, 0.28, pot, [0, 0.14, 0], 20));
    const leaf = M.leaf(_c(opts.leafColor, 0x4a6038));
    const blobs = opts.fullness || 8;
    for (let i = 0; i < blobs; i++) {
      const a = (i/blobs)*Math.PI*2;
      const r = 0.18 + Math.random()*0.10;
      const f = _sph(r, leaf, [Math.cos(a)*0.10, 0.42 + Math.random()*0.15, Math.sin(a)*0.10], 8);
      g.add(f);
    }
    return g;
  }, { icon: "🪴", category: "decor", params: [
    { key: "radius",    label: "Pot size",  type: "number", min: 0.12, max: 0.45, step: 0.02, default: 0.20 },
    { key: "fullness",  label: "Foliage",   type: "int",    min: 3,    max: 16,   default: 8 },
    { key: "leafColor", label: "Leaves",    type: "color",  default: 0x4a6038 },
    { key: "potColor",  label: "Pot",       type: "color",  default: 0x6b3a22 },
  ]});

  register("plantFern", (opts = {}) => {
    const g = new THREE.Group();
    const pot = new THREE.MeshStandardMaterial({ color: _c(opts.potColor, 0x4a3a2a), roughness: 0.8 });
    g.add(_cyl(0.18, 0.22, 0.22, pot, [0, 0.11, 0], 18));
    const leaf = M.leaf(_c(opts.leafColor, 0x3a5028));
    const n = opts.fronds || 12;
    for (let i = 0; i < n; i++) {
      const a = (i/n)*Math.PI*2;
      const arc = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.55), leaf);
      arc.position.set(Math.cos(a)*0.05, 0.30, Math.sin(a)*0.05);
      arc.rotation.set(-1.0 + Math.random()*0.5, -a, 0);
      g.add(arc);
    }
    return g;
  }, { icon: "🌿", category: "decor", params: [
    { key: "fronds",    label: "Fronds",  type: "int",   min: 4, max: 24, default: 12 },
    { key: "leafColor", label: "Leaves",  type: "color", default: 0x3a5028 },
    { key: "potColor",  label: "Pot",     type: "color", default: 0x4a3a2a },
  ]});

  register("rock", (opts = {}) => {
    const g = new THREE.Group();
    const s = opts.size || 0.5;
    const n = opts.lumps || 3;
    const mat = M.stone(_c(opts.color, 0x6a6258));
    for (let i = 0; i < n; i++) {
      const r = s * (0.5 + Math.random()*0.5);
      g.add(_sph(r, mat, [
        (Math.random()-0.5)*s*0.6,
        r*0.7,
        (Math.random()-0.5)*s*0.6,
      ], 8));
    }
    return g;
  }, { icon: "🪨", category: "outdoor", params: [
    { key: "size",  label: "Size",   type: "number", min: 0.2, max: 1.5, step: 0.05, default: 0.5 },
    { key: "lumps", label: "Lumps",  type: "int",    min: 1,   max: 6,   default: 3 },
    { key: "color", label: "Stone",  type: "color",  default: 0x6a6258 },
  ]});

  register("tree", (opts = {}) => {
    const H = opts.height || 3;
    const t = new THREE.Group();
    const trunkH = H * 0.5;
    t.add(_cyl(0.12, 0.18, trunkH, M.wood(_c(opts.trunkColor, 0x3c2818)), [0, trunkH / 2, 0], 8));
    const leafMat = M.leaf(_c(opts.leafColor, 0x4a6038));
    const blobs = opts.foliage || 6;
    for (let i = 0; i < blobs; i++) {
      const r = 0.5 + Math.random() * 0.35;
      const f = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), leafMat);
      f.position.set(
        (Math.random() - 0.5) * 0.8,
        trunkH + H * 0.25 + (Math.random() - 0.5) * 0.4,
        (Math.random() - 0.5) * 0.8
      );
      t.add(f);
    }
    return t;
  }, { icon: "🌳", category: "outdoor", params: [
    { key: "height",     label: "Height",   type: "number", min: 1.5, max: 8, step: 0.2, default: 3 },
    { key: "foliage",    label: "Foliage",  type: "int",    min: 3,   max: 14, default: 6 },
    { key: "leafColor",  label: "Leaves",   type: "color",  default: 0x4a6038 },
    { key: "trunkColor", label: "Trunk",    type: "color",  default: 0x3c2818 },
  ]});

  register("treeTall", (opts = {}) => {
    const t = new THREE.Group();
    const trunkH = opts.trunkHeight || 2.8;
    t.add(_cyl(0.18, 0.26, trunkH, M.wood(_c(opts.trunkColor, 0x3c2818)), [0, trunkH/2, 0], 10));
    const leafMat = M.leaf(_c(opts.leafColor, 0x3a5028));
    const blobs = opts.foliage || 8;
    for (let i = 0; i < blobs; i++) {
      const r = 0.7 + Math.random()*0.4;
      t.add(_sph(r, leafMat, [
        (Math.random()-0.5)*1.2,
        trunkH + 0.4 + (Math.random()-0.5)*0.6,
        (Math.random()-0.5)*1.2,
      ], 8));
    }
    return t;
  }, { icon: "🌲", category: "outdoor", params: [
    { key: "trunkHeight", label: "Trunk", type: "number", min: 1.5, max: 5, step: 0.1, default: 2.8 },
    { key: "foliage",     label: "Foliage", type: "int",  min: 4,   max: 16, default: 8 },
    { key: "leafColor",   label: "Leaves",  type: "color", default: 0x3a5028 },
    { key: "trunkColor",  label: "Trunk",   type: "color", default: 0x3c2818 },
  ]});

  // ════════════════════════════════════════════════════════
  // 20 NEW OBJECTS
  // ════════════════════════════════════════════════════════

  register("cliff_face", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // main rock mass (stacked irregular boxes)
    g.add(_box(o.width, o.height, o.depth, st, [0, o.height / 2, 0]));
    // ledges and outcrops
    for (let i = 0; i < 6; i++) {
      const y = rand(o.height * 0.1, o.height * 0.9);
      const w = rand(o.width * 0.2, o.width * 0.5);
      const x = rand(-o.width * 0.3, o.width * 0.3);
      g.add(_box(w, rand(0.15, 0.35), rand(0.2, o.depth * 0.5),
        M.stone(_c(o.color) + Math.floor(rand(-12, 12))),
        [x, y, o.depth / 2 + rand(0.05, 0.2)]));
    }
    // boulders at base
    for (let i = 0; i < 4; i++) {
      const x = rand(-o.width / 2, o.width / 2);
      g.add(_sph(rand(0.15, 0.35), M.stone(_c(o.color) - 0x080808),
        [x, rand(0.1, 0.25), o.depth / 2 + rand(0.2, 0.5)], 7));
    }
    return g;
  }, {
    icon: "🪨", category: "terrain",
    params: [
      { key: "width",  label: "Width",  type: "number", min: 2.0, max: 10.0, step: 0.5, default: 5.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 8.0,  step: 0.5, default: 4.0 },
      { key: "depth",  label: "Depth",  type: "number", min: 1.0, max: 4.0,  step: 0.3, default: 2.0 },
      { key: "color",  label: "Color",  type: "color",  default: 0x5a5248 },
    ],
  });

  register("hill", function (o) {
    const g = new THREE.Group();
    const grass = M.leaf(o.color);
    // main mound (flattened sphere)
    const mound = _sph(o.radius, grass, [0, 0, 0], 20);
    mound.scale.y = o.height / o.radius;
    mound.position.y = 0;
    g.add(mound);
    // smaller bumps
    for (let i = 0; i < 3; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(o.radius * 0.3, o.radius * 0.6);
      const bump = _sph(o.radius * 0.4, grass, [Math.cos(a) * d, 0, Math.sin(a) * d], 10);
      bump.scale.y = (o.height * 0.5) / (o.radius * 0.4);
      g.add(bump);
    }
    return g;
  }, {
    icon: "⛰️", category: "terrain",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 1.0, max: 8.0, step: 0.5, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 4.0, step: 0.3, default: 1.5 },
      { key: "color",  label: "Color",  type: "color",  default: 0x4a6840 },
    ],
  });

  register("river_section", function (o) {
    const g = new THREE.Group();
    const water = M.glass(o.color);
    // water surface
    const surface = _box(o.width, 0.04, o.length, water, [0, -0.02, 0]);
    g.add(surface);
    // riverbed
    g.add(_box(o.width + 0.2, 0.06, o.length, M.stone(0x4a4030), [0, -0.08, 0]));
    // banks (two earth ridges)
    const bank = M.stone(o.bankColor);
    g.add(_box(0.3, 0.15, o.length, bank, [-o.width / 2 - 0.1, 0.02, 0]));
    g.add(_box(0.3, 0.15, o.length, bank, [o.width / 2 + 0.1, 0.02, 0]));
    // pebbles along banks
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 8; i++) {
        const z = rand(-o.length / 2 + 0.2, o.length / 2 - 0.2);
        g.add(_sph(rand(0.02, 0.05), M.stone(0x6a6050),
          [side * (o.width / 2 + rand(-0.05, 0.15)), 0.06, z], 5));
      }
    }
    return g;
  }, {
    icon: "🌊", category: "terrain",
    params: [
      { key: "width",     label: "Width",  type: "number", min: 0.8, max: 5.0, step: 0.3, default: 2.0 },
      { key: "length",    label: "Length", type: "number", min: 2.0, max: 12.0, step: 1.0, default: 5.0 },
      { key: "color",     label: "Water",  type: "color",  default: 0x4a7a9a },
      { key: "bankColor", label: "Banks",  type: "color",  default: 0x5a4a30 },
    ],
  });

  register("stepping_stones", function (o) {
    const g = new THREE.Group();
    for (let i = 0; i < o.count; i++) {
      const z = -o.span / 2 + (o.span / (o.count - 1)) * i;
      const x = Math.sin(i * 0.8) * 0.1;
      const r = rand(0.12, 0.2);
      const stone = _cyl(r, r * 1.05, 0.06, M.stone(_c(o.color) + Math.floor(rand(-8, 8))),
        [x, 0.03, z], 8);
      stone.rotation.y = rand(0, Math.PI);
      g.add(stone);
    }
    return g;
  }, {
    icon: "🪨", category: "road",
    params: [
      { key: "count", label: "Count", type: "int",    min: 3,   max: 12,  default: 6 },
      { key: "span",  label: "Span",  type: "number", min: 1.0, max: 6.0, step: 0.5, default: 3.0 },
      { key: "color", label: "Color", type: "color",  default: 0x6a6258 },
    ],
  });

  register("oak_tree", function (o) {
    const g = new THREE.Group();
    const trunk = M.wood(o.trunkColor);
    const leaf = M.leaf(o.leafColor);
    // trunk
    g.add(_cyl(o.trunkR * 1.2, o.trunkR, o.trunkH, trunk, [0, o.trunkH / 2, 0], 10));
    // main branches (angled cylinders)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rand(-0.2, 0.2);
      const br = _cyl(o.trunkR * 0.4, o.trunkR * 0.2, o.trunkH * 0.5, trunk,
        [Math.cos(a) * 0.3, o.trunkH + 0.2, Math.sin(a) * 0.3], 6);
      br.rotation.z = Math.cos(a) * 0.6;
      br.rotation.x = Math.sin(a) * 0.6;
      g.add(br);
    }
    // canopy (clustered spheres)
    const cy = o.trunkH + o.canopyR * 0.6;
    g.add(_sph(o.canopyR, leaf, [0, cy, 0], 14));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const r = o.canopyR * 0.65;
      g.add(_sph(o.canopyR * 0.6, leaf,
        [Math.cos(a) * r, cy + rand(-0.3, 0.3), Math.sin(a) * r], 10));
    }
    return g;
  }, {
    icon: "🌳", category: "nature",
    params: [
      { key: "trunkR",     label: "Trunk R",  type: "number", min: 0.1, max: 0.5,  step: 0.05, default: 0.2 },
      { key: "trunkH",     label: "Trunk H",  type: "number", min: 1.0, max: 4.0,  step: 0.3,  default: 2.0 },
      { key: "canopyR",    label: "Canopy R", type: "number", min: 0.8, max: 3.0,  step: 0.2,  default: 1.5 },
      { key: "trunkColor", label: "Trunk",    type: "color",  default: 0x4a3018 },
      { key: "leafColor",  label: "Leaves",   type: "color",  default: 0x3a6830 },
    ],
  });

  register("dead_tree", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // trunk (gnarled – slightly bent)
    g.add(_cyl(o.trunkR * 1.3, o.trunkR * 0.8, o.height, w, [0, o.height / 2, 0], 8));
    // bare branches
    for (let i = 0; i < o.branches; i++) {
      const y = o.height * (0.4 + i * 0.12);
      const a = rand(0, Math.PI * 2);
      const len = rand(o.height * 0.25, o.height * 0.5);
      const branch = _cyl(o.trunkR * 0.25, o.trunkR * 0.05, len, w, [0, 0, 0], 5);
      branch.position.set(Math.cos(a) * 0.1, y, Math.sin(a) * 0.1);
      branch.rotation.z = Math.cos(a) * (0.6 + rand(0, 0.4));
      branch.rotation.x = Math.sin(a) * (0.6 + rand(0, 0.4));
      g.add(branch);
    }
    // exposed roots
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const root = _cyl(o.trunkR * 0.3, o.trunkR * 0.08, 0.5, w, [0, 0, 0], 5);
      root.position.set(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2);
      root.rotation.z = Math.cos(a) * 1.2;
      root.rotation.x = Math.sin(a) * 1.2;
      g.add(root);
    }
    return g;
  }, {
    icon: "🌲", category: "nature",
    params: [
      { key: "height",   label: "Height",   type: "number", min: 1.5, max: 5.0, step: 0.3,  default: 3.0 },
      { key: "trunkR",   label: "Trunk R",  type: "number", min: 0.08, max: 0.3, step: 0.02, default: 0.15 },
      { key: "branches", label: "Branches", type: "int",    min: 3,    max: 8,   default: 5 },
      { key: "color",    label: "Color",    type: "color",  default: 0x3a2a18 },
    ],
  });

  register("boulder_cluster", function (o) {
    const g = new THREE.Group();
    for (let i = 0; i < o.count; i++) {
      const r = rand(o.minR, o.maxR);
      const a = rand(0, Math.PI * 2);
      const d = rand(0, o.spread);
      const rock = _sph(r, M.stone(_c(o.color) + Math.floor(rand(-15, 15))),
        [Math.cos(a) * d, r * rand(0.5, 0.8), Math.sin(a) * d], 7);
      rock.scale.y = rand(0.6, 0.9);
      rock.scale.x = rand(0.8, 1.2);
      rock.rotation.y = rand(0, Math.PI);
      g.add(rock);
    }
    return g;
  }, {
    icon: "🪨", category: "terrain",
    params: [
      { key: "count",  label: "Count",   type: "int",    min: 2,    max: 10,  default: 5 },
      { key: "minR",   label: "Min R",   type: "number", min: 0.1,  max: 0.5, step: 0.05, default: 0.2 },
      { key: "maxR",   label: "Max R",   type: "number", min: 0.3,  max: 1.5, step: 0.1,  default: 0.6 },
      { key: "spread", label: "Spread",  type: "number", min: 0.5,  max: 3.0, step: 0.3,  default: 1.5 },
      { key: "color",  label: "Color",   type: "color",  default: 0x5a5248 },
    ],
  });

  register("hedge", function (o) {
    const g = new THREE.Group();
    const leaf = M.leaf(o.color);
    // main body (box with rounded-ish feel from overlapping spheres at ends)
    g.add(_box(o.length, o.height, o.width, leaf, [0, o.height / 2, 0]));
    // rounded ends
    g.add(_sph(o.height / 2, leaf, [-o.length / 2, o.height / 2, 0], 10));
    g.children[g.children.length - 1].scale.z = o.width / o.height;
    g.add(_sph(o.height / 2, leaf, [o.length / 2, o.height / 2, 0], 10));
    g.children[g.children.length - 1].scale.z = o.width / o.height;
    // top rounding
    g.add(_cyl(o.width / 2, o.width / 2, o.length, leaf, [0, o.height, 0], 10));
    g.children[g.children.length - 1].rotation.z = Math.PI / 2;
    return g;
  }, {
    icon: "🌿", category: "nature",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.0, max: 8.0, step: 0.5,  default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 2.0, step: 0.2,  default: 1.2 },
      { key: "width",  label: "Width",  type: "number", min: 0.3, max: 1.0, step: 0.1,  default: 0.5 },
      { key: "color",  label: "Color",  type: "color",  default: 0x2a5a28 },
    ],
  });

  register("flower_bed", function (o) {
    const g = new THREE.Group();
    const dirt = M.stone(o.soilColor);
    // soil mound
    const bed = _box(o.width, 0.08, o.depth, dirt, [0, 0.04, 0]);
    g.add(bed);
    // border stones
    for (let x = -o.width / 2; x <= o.width / 2; x += 0.18) {
      g.add(_sph(0.06, M.stone(0x6a6258), [x, 0.04, -o.depth / 2 - 0.03], 5));
      g.add(_sph(0.06, M.stone(0x6a6258), [x, 0.04, o.depth / 2 + 0.03], 5));
    }
    // flowers
    const colors = [0xc83030, 0xc8c030, 0x3060c8, 0xc060a0, 0xe8a030];
    for (let i = 0; i < o.flowerCount; i++) {
      const x = rand(-o.width / 2 + 0.08, o.width / 2 - 0.08);
      const z = rand(-o.depth / 2 + 0.08, o.depth / 2 - 0.08);
      const h = rand(0.15, 0.3);
      // stem
      g.add(_cyl(0.006, 0.006, h, M.leaf(0x3a6830), [x, 0.08 + h / 2, z], 4));
      // bloom
      g.add(_sph(rand(0.025, 0.04), M.ceramic(pick(colors)), [x, 0.08 + h + 0.02, z], 6));
    }
    return g;
  }, {
    icon: "🌷", category: "nature",
    params: [
      { key: "width",       label: "Width",   type: "number", min: 0.5, max: 3.0, step: 0.3, default: 1.5 },
      { key: "depth",       label: "Depth",   type: "number", min: 0.3, max: 1.5, step: 0.2, default: 0.6 },
      { key: "flowerCount", label: "Flowers", type: "int",    min: 3,   max: 20,  default: 8 },
      { key: "soilColor",   label: "Soil",    type: "color",  default: 0x3a2a18 },
    ],
  });

  register("plateau", function (o) {
    const g = new THREE.Group();
    const earth = M.stone(o.color);
    const grass = M.leaf(o.topColor);
    // cliff sides
    g.add(_box(o.width, o.height, o.depth, earth, [0, o.height / 2, 0]));
    // grassy top
    g.add(_box(o.width + 0.05, 0.06, o.depth + 0.05, grass, [0, o.height + 0.03, 0]));
    // rock texture on sides
    for (let i = 0; i < 8; i++) {
      const side = Math.floor(rand(0, 4));
      const y = rand(0.2, o.height - 0.2);
      let pos;
      if (side === 0) pos = [rand(-o.width / 2, o.width / 2), y, o.depth / 2 + 0.02];
      else if (side === 1) pos = [rand(-o.width / 2, o.width / 2), y, -o.depth / 2 - 0.02];
      else if (side === 2) pos = [o.width / 2 + 0.02, y, rand(-o.depth / 2, o.depth / 2)];
      else pos = [-o.width / 2 - 0.02, y, rand(-o.depth / 2, o.depth / 2)];
      g.add(_box(rand(0.15, 0.4), rand(0.1, 0.25), rand(0.05, 0.12),
        M.stone(_c(o.color) + Math.floor(rand(-10, 10))), pos));
    }
    return g;
  }, {
    icon: "🏔️", category: "terrain",
    params: [
      { key: "width", label: "Width", type: "number", min: 2.0, max: 10.0, step: 0.5, default: 5.0 },
      { key: "depth", label: "Depth", type: "number", min: 2.0, max: 10.0, step: 0.5, default: 5.0 },
      { key: "height", label: "Height", type: "number", min: 1.0, max: 6.0, step: 0.5, default: 3.0 },
      { key: "color", label: "Rock", type: "color", default: 0x5a4a38 },
      { key: "topColor", label: "Top", type: "color", default: 0x4a6840 },
    ],
  });

  register("canyon", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // left wall
    g.add(_box(o.wallThick, o.height, o.length, st, [-o.gapW / 2 - o.wallThick / 2, o.height / 2, 0]));
    // right wall
    g.add(_box(o.wallThick, o.height, o.length, st, [o.gapW / 2 + o.wallThick / 2, o.height / 2, 0]));
    // ledges on walls
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const y = rand(o.height * 0.2, o.height * 0.8);
      const z = rand(-o.length / 2 + 0.3, o.length / 2 - 0.3);
      g.add(_box(rand(0.2, 0.5), rand(0.1, 0.2), rand(0.3, 0.8),
        M.stone(_c(o.color) + Math.floor(rand(-10, 10))),
        [side * (o.gapW / 2 - 0.1), y, z]));
    }
    // ground
    g.add(_box(o.gapW, 0.05, o.length, M.stone(o.color - 0x0a0a0a), [0, 0.025, 0]));
    return g;
  }, {
    icon: "🏜️", category: "terrain",
    params: [
      { key: "gapW", label: "Gap W", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "length", label: "Length", type: "number", min: 3.0, max: 12.0, step: 1.0, default: 6.0 },
      { key: "wallThick", label: "Wall T", type: "number", min: 0.5, max: 2.0, step: 0.2, default: 1.0 },
      { key: "color", label: "Color", type: "color", default: 0x7a5a38 },
    ],
  });

  register("cave_entrance", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // rock face
    g.add(_box(o.width, o.height, o.depth, st, [0, o.height / 2, 0]));
    // carve out entrance (dark interior)
    g.add(_box(o.openW, o.openH, o.depth + 0.1, M.metal(0x0a0808),
      [0, o.openH / 2, 0]));
    // arch above entrance
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(o.openW / 2, 0.15, 6, 12, Math.PI),
      st
    );
    arch.position.set(0, o.openH, 0);
    arch.rotation.z = -Math.PI / 2;
    g.add(arch);
    // rubble at entrance
    for (let i = 0; i < 5; i++) {
      g.add(_sph(rand(0.08, 0.2), M.stone(_c(o.color) - 0x080808),
        [rand(-o.openW / 2, o.openW / 2), rand(0.05, 0.15), o.depth / 2 + rand(0.1, 0.4)], 6));
    }
    return g;
  }, {
    icon: "🕳️", category: "terrain",
    params: [
      { key: "width", label: "Width", type: "number", min: 3.0, max: 8.0, step: 0.5, default: 5.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 6.0, step: 0.5, default: 4.0 },
      { key: "depth", label: "Depth", type: "number", min: 1.0, max: 3.0, step: 0.3, default: 2.0 },
      { key: "openW", label: "Open W", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
      { key: "openH", label: "Open H", type: "number", min: 1.5, max: 3.5, step: 0.3, default: 2.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a5248 },
    ],
  });

  register("island", function (o) {
    const g = new THREE.Group();
    const earth = M.stone(o.earthColor);
    const grass = M.leaf(o.grassColor);
    const water = M.glass(o.waterColor);
    // water base
    const waterDisc = _cyl(o.radius * 1.5, o.radius * 1.5, 0.04, water, [0, -0.02, 0], 20);
    g.add(waterDisc);
    // island mound
    const mound = _sph(o.radius, earth, [0, 0, 0], 16);
    mound.scale.y = o.height / o.radius;
    g.add(mound);
    // grass cap
    const cap = _sph(o.radius * 0.95, grass, [0, o.height * 0.15, 0], 16);
    cap.scale.y = o.height * 0.6 / o.radius;
    g.add(cap);
    // small beach
    const beach = _cyl(o.radius * 0.9, o.radius * 1.1, 0.05, M.stone(0xc8b890), [0, 0, 0], 16);
    g.add(beach);
    return g;
  }, {
    icon: "🏝️", category: "terrain",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 1.0, max: 6.0, step: 0.5, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 3.0, step: 0.3, default: 1.2 },
      { key: "earthColor", label: "Earth", type: "color", default: 0x5a4a30 },
      { key: "grassColor", label: "Grass", type: "color", default: 0x4a7a40 },
      { key: "waterColor", label: "Water", type: "color", default: 0x3a6a9a },
    ],
  });

  register("crater", function (o) {
    const g = new THREE.Group();
    const earth = M.stone(o.color);
    // outer rim (torus)
    g.add(_tor(o.radius, o.rimW, earth, [0, o.rimW * 0.5, 0], 20, 8));
    // inner depression (dark disc)
    g.add(_cyl(o.radius - o.rimW * 0.5, o.radius - o.rimW * 0.5, 0.03,
      M.stone(o.color - 0x101010), [0, 0.015, 0], 20));
    // scattered rocks on rim
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      const d = o.radius + rand(-o.rimW * 0.3, o.rimW * 0.3);
      g.add(_sph(rand(0.05, 0.12), M.stone(_c(o.color) + Math.floor(rand(-8, 8))),
        [Math.cos(a) * d, rand(0.03, 0.15), Math.sin(a) * d], 5));
    }
    return g;
  }, {
    icon: "🌑", category: "terrain",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 1.0, max: 5.0, step: 0.5, default: 2.5 },
      { key: "rimW", label: "Rim W", type: "number", min: 0.2, max: 1.0, step: 0.1, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0x5a5040 },
    ],
  });

  register("marsh", function (o) {
    const g = new THREE.Group();
    const mud = M.stone(o.mudColor);
    const water = M.glass(o.waterColor);
    // mud base
    g.add(_box(o.width, 0.04, o.depth, mud, [0, 0.02, 0]));
    // water puddles
    for (let i = 0; i < 6; i++) {
      const x = rand(-o.width / 2 + 0.3, o.width / 2 - 0.3);
      const z = rand(-o.depth / 2 + 0.3, o.depth / 2 - 0.3);
      g.add(_cyl(rand(0.15, 0.4), rand(0.15, 0.4), 0.02, water, [x, 0.05, z], 10));
    }
    // reeds
    for (let i = 0; i < 15; i++) {
      const x = rand(-o.width / 2 + 0.1, o.width / 2 - 0.1);
      const z = rand(-o.depth / 2 + 0.1, o.depth / 2 - 0.1);
      const h = rand(0.3, 0.7);
      g.add(_cyl(0.008, 0.005, h, M.leaf(0x4a6830), [x, 0.04 + h / 2, z], 4));
    }
    // tufts of grass
    for (let i = 0; i < 8; i++) {
      const x = rand(-o.width / 2, o.width / 2);
      const z = rand(-o.depth / 2, o.depth / 2);
      g.add(_sph(rand(0.06, 0.12), M.leaf(0x3a5828), [x, 0.06, z], 6));
    }
    return g;
  }, {
    icon: "🌿", category: "terrain",
    params: [
      { key: "width", label: "Width", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "depth", label: "Depth", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "mudColor", label: "Mud", type: "color", default: 0x3a2a18 },
      { key: "waterColor", label: "Water", type: "color", default: 0x3a5a4a },
    ],
  });

  register("snow_patch", function (o) {
    const g = new THREE.Group();
    const snow = M.plaster(o.color);
    // main snow area (flattened sphere)
    const mound = _sph(o.radius, snow, [0, 0, 0], 16);
    mound.scale.y = o.height / o.radius;
    g.add(mound);
    // drifts
    for (let i = 0; i < 4; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(o.radius * 0.3, o.radius * 0.8);
      const dr = _sph(o.radius * rand(0.2, 0.4), snow,
        [Math.cos(a) * d, 0, Math.sin(a) * d], 8);
      dr.scale.y = rand(0.2, 0.5);
      g.add(dr);
    }
    return g;
  }, {
    icon: "❄️", category: "terrain",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.5, max: 5.0, step: 0.5, default: 2.0 },
      { key: "height", label: "Height", type: "number", min: 0.05, max: 0.5, step: 0.05, default: 0.15 },
      { key: "color", label: "Color", type: "color", default: 0xe8e8f0 },
    ],
  });

  register("lava_pool", function (o) {
    const g = new THREE.Group();
    const rock = M.stone(o.rockColor);
    const lava = M.ceramic(o.lavaColor);
    // rocky rim
    g.add(_tor(o.radius, o.rimW, rock, [0, o.rimW * 0.3, 0], 16, 8));
    // lava surface
    const lavaSurface = _cyl(o.radius - o.rimW * 0.3, o.radius - o.rimW * 0.3, 0.03, lava,
      [0, 0.02, 0], 16);
    g.add(lavaSurface);
    // bubbles
    for (let i = 0; i < 4; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0, o.radius * 0.5);
      g.add(_sph(rand(0.04, 0.08), M.ceramic(o.lavaColor + 0x101000),
        [Math.cos(a) * d, 0.04, Math.sin(a) * d], 6));
    }
    return g;
  }, {
    icon: "🌋", category: "terrain",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.5, max: 4.0, step: 0.3, default: 1.5 },
      { key: "rimW", label: "Rim W", type: "number", min: 0.15, max: 0.6, step: 0.05, default: 0.3 },
      { key: "rockColor", label: "Rock", type: "color", default: 0x2a2020 },
      { key: "lavaColor", label: "Lava", type: "color", default: 0xd83010 },
    ],
  });

  // ─── NATURE & VEGETATION ──────────────────────────────────────

  register("willow_tree", function (o) {
    const g = new THREE.Group();
    const trunk = M.wood(o.trunkColor);
    const leaf = M.leaf(o.leafColor);
    // trunk
    g.add(_cyl(o.trunkR * 1.2, o.trunkR, o.trunkH, trunk, [0, o.trunkH / 2, 0], 10));
    // crown sphere
    g.add(_sph(o.canopyR * 0.6, leaf, [0, o.trunkH + o.canopyR * 0.3, 0], 12));
    // drooping branches (cylinders hanging down)
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + rand(-0.1, 0.1);
      const d = o.canopyR * rand(0.5, 0.9);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const hangLen = rand(o.trunkH * 0.4, o.trunkH * 0.8);
      g.add(_cyl(0.008, 0.004, hangLen, leaf,
        [x, o.trunkH + o.canopyR * 0.2 - hangLen / 2, z], 4));
    }
    return g;
  }, {
    icon: "🌳", category: "nature",
    params: [
      { key: "trunkR", label: "Trunk R", type: "number", min: 0.1, max: 0.4, step: 0.05, default: 0.2 },
      { key: "trunkH", label: "Trunk H", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.5 },
      { key: "canopyR", label: "Canopy R", type: "number", min: 0.8, max: 3.0, step: 0.2, default: 1.8 },
      { key: "trunkColor", label: "Trunk", type: "color", default: 0x4a3818 },
      { key: "leafColor", label: "Leaves", type: "color", default: 0x5a8a40 },
    ],
  });

  register("pine_tree", function (o) {
    const g = new THREE.Group();
    const trunk = M.wood(o.trunkColor);
    const leaf = M.leaf(o.leafColor);
    g.add(_cyl(o.trunkR * 1.1, o.trunkR, o.height, trunk, [0, o.height / 2, 0], 8));
    // stacked cones for foliage
    const layers = o.layers;
    for (let i = 0; i < layers; i++) {
      const y = o.height * (0.3 + i * 0.18);
      const r = o.canopyR * (1 - i * 0.15);
      const h = o.canopyR * 0.7;
      g.add(_cone(r, h, leaf, [0, y + h / 2, 0], 12));
    }
    return g;
  }, {
    icon: "🌲", category: "nature",
    params: [
      { key: "height", label: "Height", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "trunkR", label: "Trunk R", type: "number", min: 0.06, max: 0.25, step: 0.02, default: 0.12 },
      { key: "canopyR", label: "Canopy R", type: "number", min: 0.5, max: 2.0, step: 0.2, default: 1.0 },
      { key: "layers", label: "Layers", type: "int", min: 2, max: 6, default: 4 },
      { key: "trunkColor", label: "Trunk", type: "color", default: 0x3a2818 },
      { key: "leafColor", label: "Leaves", type: "color", default: 0x2a4a20 },
    ],
  });

  register("cherry_blossom", function (o) {
    const g = new THREE.Group();
    const trunk = M.wood(o.trunkColor);
    const blossom = M.ceramic(o.blossomColor);
    g.add(_cyl(o.trunkR * 1.2, o.trunkR * 0.8, o.trunkH, trunk, [0, o.trunkH / 2, 0], 8));
    // forked branches
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand(-0.3, 0.3);
      const br = _cyl(o.trunkR * 0.35, o.trunkR * 0.15, o.trunkH * 0.5, trunk, [0, 0, 0], 6);
      br.position.set(Math.cos(a) * 0.15, o.trunkH * 0.8, Math.sin(a) * 0.15);
      br.rotation.z = Math.cos(a) * 0.7;
      br.rotation.x = Math.sin(a) * 0.7;
      g.add(br);
    }
    // blossom clusters (pink spheres)
    for (let i = 0; i < 10; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0.3, o.canopyR);
      const y = o.trunkH + rand(-0.2, 0.5);
      g.add(_sph(rand(0.15, 0.3), blossom,
        [Math.cos(a) * d, y, Math.sin(a) * d], 8));
    }
    // central canopy
    g.add(_sph(o.canopyR * 0.5, blossom, [0, o.trunkH + 0.3, 0], 12));
    return g;
  }, {
    icon: "🌸", category: "nature",
    params: [
      { key: "trunkR", label: "Trunk R", type: "number", min: 0.08, max: 0.3, step: 0.02, default: 0.15 },
      { key: "trunkH", label: "Trunk H", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.5 },
      { key: "canopyR", label: "Canopy R", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.5 },
      { key: "trunkColor", label: "Trunk", type: "color", default: 0x4a3020 },
      { key: "blossomColor", label: "Blossoms", type: "color", default: 0xe8a0b0 },
    ],
  });

  register("mushroom_cluster", function (o) {
    const g = new THREE.Group();
    for (let i = 0; i < o.count; i++) {
      const x = rand(-o.spread, o.spread);
      const z = rand(-o.spread, o.spread);
      const h = rand(0.08, 0.25);
      const capR = rand(0.06, 0.15);
      // stem
      g.add(_cyl(0.015, 0.02, h, M.plaster(o.stemColor), [x, h / 2, z], 6));
      // cap
      g.add(_sph(capR, M.ceramic(o.capColor), [x, h + capR * 0.3, z], 8));
      g.children[g.children.length - 1].scale.y = 0.5;
      // spots
      for (let s = 0; s < 3; s++) {
        const sa = rand(0, Math.PI * 2);
        const sd = capR * 0.6;
        g.add(_sph(0.012, M.plaster(0xe8e8e0),
          [x + Math.cos(sa) * sd, h + capR * 0.45, z + Math.sin(sa) * sd], 4));
      }
    }
    return g;
  }, {
    icon: "🍄", category: "nature",
    params: [
      { key: "count", label: "Count", type: "int", min: 2, max: 10, default: 5 },
      { key: "spread", label: "Spread", type: "number", min: 0.2, max: 1.5, step: 0.1, default: 0.5 },
      { key: "capColor", label: "Cap", type: "color", default: 0xb02020 },
      { key: "stemColor", label: "Stem", type: "color", default: 0xd8d0c0 },
    ],
  });

  register("tall_grass", function (o) {
    const g = new THREE.Group();
    const grass = M.leaf(o.color);
    for (let i = 0; i < o.blades; i++) {
      const x = rand(-o.spread, o.spread);
      const z = rand(-o.spread, o.spread);
      const h = rand(0.15, o.height);
      const blade = _box(0.01, h, 0.002, M.leaf(_c(o.color) + Math.floor(rand(-8, 8))),
        [x, h / 2, z]);
      blade.rotation.x = rand(-0.2, 0.2);
      blade.rotation.z = rand(-0.3, 0.3);
      g.add(blade);
    }
    return g;
  }, {
    icon: "🌾", category: "nature",
    params: [
      { key: "blades", label: "Blades", type: "int", min: 10, max: 60, default: 30 },
      { key: "height", label: "Height", type: "number", min: 0.2, max: 1.0, step: 0.1, default: 0.5 },
      { key: "spread", label: "Spread", type: "number", min: 0.2, max: 2.0, step: 0.2, default: 0.8 },
      { key: "color", label: "Color", type: "color", default: 0x5a8a30 },
    ],
  });

  register("vine_wall", function (o) {
    const g = new THREE.Group();
    const leaf = M.leaf(o.leafColor);
    const vine = M.wood(o.vineColor);
    // main vines (vertical)
    const vCount = Math.floor(o.width / 0.3);
    for (let v = 0; v < vCount; v++) {
      const x = -o.width / 2 + 0.15 + v * (o.width / vCount);
      g.add(_cyl(0.012, 0.01, o.height, vine, [x, o.height / 2, 0], 4));
      // leaves along vine
      for (let l = 0; l < Math.floor(o.height / 0.15); l++) {
        const y = 0.1 + l * 0.15;
        const side = (l % 2 === 0) ? 0.04 : -0.04;
        g.add(_sph(rand(0.025, 0.04), leaf, [x + side, y, rand(0.01, 0.03)], 5));
      }
    }
    return g;
  }, {
    icon: "🌿", category: "nature",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.5, max: 4.0, step: 0.3, default: 2.0 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 3.0, step: 0.3, default: 1.5 },
      { key: "leafColor", label: "Leaves", type: "color", default: 0x3a6828 },
      { key: "vineColor", label: "Vine", type: "color", default: 0x2a3a18 },
    ],
  });

  register("lily_pad_cluster", function (o) {
    const g = new THREE.Group();
    for (let i = 0; i < o.count; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0, o.spread);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const r = rand(0.06, 0.12);
      const pad = _cyl(r, r, 0.008, M.leaf(o.padColor), [x, 0.004, z], 12);
      g.add(pad);
      // flower on some
      if (rand(0, 1) > 0.6) {
        g.add(_sph(0.025, M.ceramic(o.flowerColor), [x, 0.025, z], 6));
      }
    }
    return g;
  }, {
    icon: "🪷", category: "nature",
    params: [
      { key: "count", label: "Count", type: "int", min: 3, max: 15, default: 7 },
      { key: "spread", label: "Spread", type: "number", min: 0.3, max: 2.0, step: 0.2, default: 0.8 },
      { key: "padColor", label: "Pad", type: "color", default: 0x2a6a28 },
      { key: "flowerColor", label: "Flower", type: "color", default: 0xe8a0c0 },
    ],
  });

  register("cactus", function (o) {
    const g = new THREE.Group();
    const body = M.leaf(o.color);
    // main column
    g.add(_cyl(o.radius, o.radius * 0.9, o.height, body, [0, o.height / 2, 0], 10));
    g.add(_sph(o.radius * 0.9, body, [0, o.height, 0], 8));
    // arms
    if (o.arms >= 1) {
      const arm1 = _cyl(o.radius * 0.5, o.radius * 0.45, o.height * 0.4, body, [0, 0, 0], 8);
      arm1.position.set(o.radius + 0.1, o.height * 0.5, 0);
      arm1.rotation.z = -0.8;
      g.add(arm1);
      g.add(_cyl(o.radius * 0.45, o.radius * 0.4, o.height * 0.3, body,
        [o.radius + 0.25, o.height * 0.65, 0], 8));
      g.add(_sph(o.radius * 0.4, body, [o.radius + 0.25, o.height * 0.65 + o.height * 0.15, 0], 6));
    }
    if (o.arms >= 2) {
      const arm2 = _cyl(o.radius * 0.45, o.radius * 0.4, o.height * 0.35, body, [0, 0, 0], 8);
      arm2.position.set(-o.radius - 0.08, o.height * 0.4, 0);
      arm2.rotation.z = 0.9;
      g.add(arm2);
      g.add(_cyl(o.radius * 0.4, o.radius * 0.35, o.height * 0.25, body,
        [-o.radius - 0.22, o.height * 0.55, 0], 8));
      g.add(_sph(o.radius * 0.35, body, [-o.radius - 0.22, o.height * 0.55 + o.height * 0.12, 0], 6));
    }
    return g;
  }, {
    icon: "🌵", category: "nature",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.06, max: 0.25, step: 0.02, default: 0.12 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 3.0, step: 0.3, default: 1.5 },
      { key: "arms", label: "Arms", type: "int", min: 0, max: 2, default: 2 },
      { key: "color", label: "Color", type: "color", default: 0x3a7a30 },
    ],
  });

  register("fallen_log", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    const log = _cyl(o.radius, o.radius * 0.9, o.length, w, [0, o.radius, 0], 12);
    log.rotation.z = Math.PI / 2;
    g.add(log);
    // bark texture bumps
    for (let i = 0; i < 6; i++) {
      const z = rand(-o.length / 2 + 0.1, o.length / 2 - 0.1);
      const a = rand(0, Math.PI);
      g.add(_box(rand(0.03, 0.08), rand(0.01, 0.02), rand(0.06, 0.15),
        M.wood(_c(o.color) - 0x080808),
        [z, o.radius + o.radius * Math.sin(a) * 0.1, Math.cos(a) * o.radius * 0.5]));
    }
    // moss patches
    for (let i = 0; i < 3; i++) {
      const z = rand(-o.length / 3, o.length / 3);
      g.add(_sph(rand(0.04, 0.08), M.leaf(0x3a6828), [z, o.radius * 1.8, 0], 5));
    }
    return g;
  }, {
    icon: "🪵", category: "nature",
    params: [
      { key: "length", label: "Length", type: "number", min: 0.5, max: 4.0, step: 0.3, default: 2.0 },
      { key: "radius", label: "Radius", type: "number", min: 0.06, max: 0.3, step: 0.03, default: 0.12 },
      { key: "color", label: "Color", type: "color", default: 0x4a3018 },
    ],
  });

  register("tree_stump", function (o) {
    const g = new THREE.Group();
    const w = M.wood(o.color);
    // main stump
    g.add(_cyl(o.radius, o.radius * 1.15, o.height, w, [0, o.height / 2, 0], 12));
    // top surface (lighter – exposed wood)
    g.add(_cyl(o.radius - 0.02, o.radius - 0.02, 0.02, M.wood(o.color + 0x181810),
      [0, o.height + 0.01, 0], 12));
    // ring detail on top
    g.add(_tor(o.radius * 0.4, 0.008, M.wood(o.color + 0x101008), [0, o.height + 0.02, 0], 12, 4));
    g.add(_tor(o.radius * 0.7, 0.006, M.wood(o.color + 0x101008), [0, o.height + 0.02, 0], 12, 4));
    // roots
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + rand(-0.3, 0.3);
      const root = _cyl(o.radius * 0.2, o.radius * 0.08, o.radius * 1.5, w, [0, 0, 0], 5);
      root.position.set(Math.cos(a) * o.radius * 0.6, 0.05, Math.sin(a) * o.radius * 0.6);
      root.rotation.z = Math.cos(a) * 1.2;
      root.rotation.x = Math.sin(a) * 1.2;
      g.add(root);
    }
    return g;
  }, {
    icon: "🪵", category: "nature",
    params: [
      { key: "radius", label: "Radius", type: "number", min: 0.1, max: 0.5, step: 0.05, default: 0.25 },
      { key: "height", label: "Height", type: "number", min: 0.1, max: 0.6, step: 0.05, default: 0.3 },
      { key: "color", label: "Color", type: "color", default: 0x4a3018 },
    ],
  });

  // ─── BUILDINGS & STRUCTURES ───────────────────────────────────

  register("waterfall_cliff", function (o) {
    const g = new THREE.Group();
    const rock = M.stone(o.rockColor);
    const water = M.glass(o.waterColor);
    // cliff face
    g.add(_box(o.width, o.height, o.depth, rock, [0, o.height / 2, 0]));
    // rock outcrops
    for (let i = 0; i < 5; i++) {
      const y = rand(o.height * 0.1, o.height * 0.9);
      g.add(_box(rand(0.2, 0.5), rand(0.1, 0.3), rand(0.1, 0.3),
        M.stone(_c(o.rockColor) + Math.floor(rand(-10, 10))),
        [rand(-o.width * 0.3, o.width * 0.3), y, o.depth / 2 + 0.1]));
    }
    // water stream (vertical sheet)
    g.add(_box(o.streamW, o.height, 0.04, water, [0, o.height / 2, o.depth / 2 + 0.05]));
    // splash pool at base
    g.add(_cyl(o.streamW, o.streamW, 0.05, water, [0, 0.025, o.depth / 2 + 0.3], 12));
    // mist (transparent spheres)
    for (let i = 0; i < 4; i++) {
      g.add(_sph(rand(0.15, 0.3), M.glass(0xc8d8e8),
        [rand(-o.streamW, o.streamW), rand(0.1, 0.5), o.depth / 2 + rand(0.2, 0.6)], 8));
    }
    return g;
  }, {
    icon: "🌊", category: "terrain",
    params: [
      { key: "width", label: "Width", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "depth", label: "Depth", type: "number", min: 1.0, max: 3.0, step: 0.3, default: 1.5 },
      { key: "streamW", label: "Stream W", type: "number", min: 0.3, max: 2.0, step: 0.2, default: 0.8 },
      { key: "rockColor", label: "Rock", type: "color", default: 0x5a5248 },
      { key: "waterColor", label: "Water", type: "color", default: 0x5a9ab0 },
    ],
  });

  register("volcano", function (o) {
    const g = new THREE.Group();
    const rock = M.stone(o.rockColor);
    // main cone
    g.add(_cone(o.baseR, o.height, rock, [0, o.height / 2, 0], 20));
    // crater (dark depression at top)
    g.add(_cyl(o.baseR * 0.2, o.baseR * 0.25, 0.1, M.stone(0x2a2020),
      [0, o.height - 0.05, 0], 16));
    // lava glow in crater
    g.add(_cyl(o.baseR * 0.15, o.baseR * 0.15, 0.04, M.ceramic(0xd83010),
      [0, o.height - 0.08, 0], 12));
    // lava streams down side
    for (let i = 0; i < 3; i++) {
      const a = rand(0, Math.PI * 2);
      for (let j = 0; j < 5; j++) {
        const t = 0.3 + j * 0.12;
        const r = o.baseR * t;
        const y = o.height * (1 - t);
        g.add(_sph(rand(0.05, 0.12), M.ceramic(0xc83010 + j * 0x080400),
          [Math.cos(a) * r * 0.9, y, Math.sin(a) * r * 0.9], 5));
      }
    }
    // smoke puffs
    for (let i = 0; i < 3; i++) {
      g.add(_sph(rand(0.15, 0.3), M.glass(0x8a8a8a),
        [rand(-0.2, 0.2), o.height + 0.2 + i * 0.3, rand(-0.2, 0.2)], 7));
    }
    return g;
  }, {
    icon: "🌋", category: "terrain",
    params: [
      { key: "baseR", label: "Base R", type: "number", min: 1.0, max: 6.0, step: 0.5, default: 3.0 },
      { key: "height", label: "Height", type: "number", min: 2.0, max: 8.0, step: 0.5, default: 4.0 },
      { key: "rockColor", label: "Rock", type: "color", default: 0x3a3028 },
    ],
  });

  register("hedge_maze_corner", function (o) {
    const g = new THREE.Group();
    const leaf = M.leaf(o.color);
    // L-shaped hedge
    g.add(_box(o.length, o.height, o.thickness, leaf, [0, o.height / 2, -o.length / 2 + o.thickness / 2]));
    g.add(_box(o.thickness, o.height, o.length, leaf, [-o.length / 2 + o.thickness / 2, o.height / 2, 0]));
    // rounded corner joint
    g.add(_cyl(o.thickness / 2, o.thickness / 2, o.height, leaf,
      [-o.length / 2 + o.thickness / 2, o.height / 2, -o.length / 2 + o.thickness / 2], 8));
    return g;
  }, {
    icon: "🌿", category: "nature",
    params: [
      { key: "length", label: "Length", type: "number", min: 1.0, max: 5.0, step: 0.5, default: 2.5 },
      { key: "height", label: "Height", type: "number", min: 0.5, max: 2.5, step: 0.2, default: 1.5 },
      { key: "thickness", label: "Thickness", type: "number", min: 0.3, max: 0.8, step: 0.1, default: 0.5 },
      { key: "color", label: "Color", type: "color", default: 0x2a5a28 },
    ],
  });

  register("ice_block", function (o) {
    const g = new THREE.Group();
    const ice = M.glass(o.color);
    g.add(_box(o.width, o.height, o.depth, ice, [0, o.height / 2, 0]));
    // cracks (thin dark lines)
    for (let i = 0; i < 4; i++) {
      g.add(_box(rand(0.02, o.width * 0.6), 0.005, 0.005,
        M.glass(0x6090b0),
        [rand(-o.width * 0.3, o.width * 0.3), rand(o.height * 0.2, o.height * 0.8),
        rand(-o.depth * 0.3, o.depth * 0.3)]));
    }
    return g;
  }, {
    icon: "🧊", category: "terrain",
    params: [
      { key: "width", label: "Width", type: "number", min: 0.3, max: 3.0, step: 0.3, default: 1.0 },
      { key: "height", label: "Height", type: "number", min: 0.3, max: 2.0, step: 0.2, default: 0.8 },
      { key: "depth", label: "Depth", type: "number", min: 0.3, max: 3.0, step: 0.3, default: 1.0 },
      { key: "color", label: "Color", type: "color", default: 0x90c0e0 },
    ],
  });

  register("crystal_cluster", function (o) {
    const g = new THREE.Group();
    for (let i = 0; i < o.count; i++) {
      const a = rand(0, Math.PI * 2);
      const d = rand(0, o.spread);
      const h = rand(o.minH, o.maxH);
      const r = rand(0.03, 0.08);
      const crystal = _cone(r, h, M.glass(_c(o.color) + Math.floor(rand(-15, 15))),
        [Math.cos(a) * d, h / 2, Math.sin(a) * d], 6);
      crystal.rotation.x = rand(-0.2, 0.2);
      crystal.rotation.z = rand(-0.2, 0.2);
      g.add(crystal);
    }
    // base rock
    g.add(_sph(o.spread * 0.6, M.stone(0x3a3a38), [0, 0, 0], 8));
    g.children[g.children.length - 1].scale.y = 0.3;
    return g;
  }, {
    icon: "💎", category: "nature",
    params: [
      { key: "count", label: "Count", type: "int", min: 3, max: 12, default: 6 },
      { key: "minH", label: "Min H", type: "number", min: 0.1, max: 0.3, step: 0.05, default: 0.15 },
      { key: "maxH", label: "Max H", type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.6 },
      { key: "spread", label: "Spread", type: "number", min: 0.1, max: 0.6, step: 0.05, default: 0.25 },
      { key: "color", label: "Color", type: "color", default: 0x60a0d0 },
    ],
  });

  register("tree", function ({ height = 3, leafColor } = {}) {
  const t = new THREE.Group();
  const trunkH = height * 0.5;
  t.add(_cyl(0.12, 0.18, trunkH, M.wood(0x3c2818), [0, trunkH / 2, 0], 8));
  const leaf = M.leaf(leafColor || pick([0x3a5230, 0x4a6038, 0x3a4a28, 0x2a4a30]));
  const cy = trunkH + height * 0.25;
  for (let i = 0; i < 6; i++) {
    const r = rand(0.5, 0.85);
    const f = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), leaf);
    f.position.set(rand(-0.4, 0.4), cy + rand(-0.2, 0.4), rand(-0.4, 0.4));
    t.add(f);
  }
  return t;
}, { category: "nature" });

  register("hedge", function ({ radius = 0.7, color = 0x3a5230 } = {}) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 6), M.leaf(color));
}, { category: "nature" });

  register("flower", function ({ color = 0xd86040, radius = 0.07 } = {}) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 6, 4),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, emissive: color, emissiveIntensity: 0.05 })
  );
}, { category: "nature" });

function _spineTexture({ width, height, color, title }) {
  const W = 128;
  const H = Math.max(32, Math.round(W * (height / width)));
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#" + color.toString(16).padStart(6, "0");
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(218, 180, 110, 0.55)";
  ctx.fillRect(0, Math.round(H * 0.18), W, 1);
  ctx.fillRect(0, Math.round(H * 0.82), W, 1);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(232, 220, 190, 0.95)";
  const fontPx = Math.max(10, Math.round(W * 0.50));
  ctx.font = `italic ${fontPx}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let f = fontPx;
  while (f > 10 && ctx.measureText(title).width > H * 0.86) {
    f -= 2;
    ctx.font = `italic ${f}px Georgia, serif`;
  }
  ctx.fillText(title, 0, 2);
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

  register("skyDome", function ({ top = "#88a8c8", bottom = "#1a1a22" } = {}) {
  const c = document.createElement("canvas");
  c.width = 16; c.height = 256;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.SphereGeometry(40, 32, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
}, { category: "environment" });

  register("starDome", function () {
  const c = document.createElement("canvas");
  c.width = 2048; c.height = 1024;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, "#0a0a1a");
  g.addColorStop(0.5, "#040408");
  g.addColorStop(1, "#020204");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 2048, 1024);
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * 2048, y = Math.random() * 1024;
    const r = Math.random() * 1.4 + 0.2;
    const a = Math.random() * 0.7 + 0.3;
    ctx.fillStyle = `rgba(255,${230 + Math.random() * 25},${210 + Math.random() * 35},${a})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.SphereGeometry(40, 32, 16),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
}, { category: "environment" });

// Expose helper to window.OBJECTS so other data files can destructure it.
if (window.OBJECTS) window.OBJECTS._spineTexture = _spineTexture;
// Also expose as a true global; some data files reference _spineTexture directly.
window._spineTexture = _spineTexture;

})();
