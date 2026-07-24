// category: "z_ai"
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

    register("vanity", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // table top
    g.add(_box(o.width, 0.04, o.depth, wd, [0, o.height - 0.4, 0]));
    // legs
    const lh = o.height - 0.4;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_box(0.04, lh, 0.04, wd, [sx*(o.width/2-0.04), lh/2, sz*(o.depth/2-0.04)]));
    });
    // drawer
    g.add(_box(o.width - 0.06, 0.12, o.depth - 0.04, M.wood(o.color + 0x0a0a0a), [0, o.height - 0.52, 0.01]));
    // mirror frame
    const mh = o.height * 0.7;
    g.add(_box(o.width * 0.8, mh, 0.03, wd, [0, o.height - 0.4 + mh/2 + 0.02, -o.depth/2 + 0.02]));
    // mirror glass
    const mirror = new THREE.Mesh(
        new THREE.PlaneGeometry(o.width * 0.7, mh * 0.88),
        M.glass(0xc8d0e0)
    );
    mirror.position.set(0, o.height - 0.4 + mh/2 + 0.02, -o.depth/2 + 0.04);
    g.add(mirror);
    // knob
    g.add(_sph(0.015, M.brass(), [0, o.height - 0.56, o.depth/2 - 0.02]));
    return g;
    }, {
    icon: "🪞", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.6, max: 1.2, step: 0.1, default: 0.9 },
        { key: "height", label: "Height", type: "number", min: 1.0, max: 1.8, step: 0.1, default: 1.4 },
        { key: "depth", label: "Depth", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.4 },
        { key: "color", label: "Color", type: "color", default: 0x5a3a20 },
    ],
    });

    register("chaise_lounge", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const cl = M.cloth(o.clothColor);
    // base frame
    g.add(_box(o.width, 0.12, o.length, wd, [0, 0.22, 0]));
    // legs (6)
    for (let i = 0; i < 6; i++) {
        const z = -o.length/2 + 0.1 + i * (o.length - 0.2) / 5;
        [-1,1].forEach(sx => {
        g.add(_box(0.04, 0.16, 0.04, wd, [sx*(o.width/2-0.06), 0.08, z]));
        });
    }
    // seat cushion
    g.add(_box(o.width - 0.08, 0.1, o.length * 0.6, cl, [0, 0.33, o.length * 0.1]));
    // back rest (angled)
    const back = _box(o.width - 0.08, 0.1, o.length * 0.35, cl);
    back.position.set(0, 0.55, -o.length * 0.28);
    back.rotation.x = 0.35;
    g.add(back);
    // back support
    g.add(_box(0.06, 0.35, 0.06, wd, [0, 0.42, -o.length/2 + 0.08]));
    // armrest
    g.add(_box(0.06, 0.06, 0.3, wd, [0, 0.42, o.length/2 - 0.2]));
    g.add(_box(0.04, 0.2, 0.04, wd, [0, 0.3, o.length/2 - 0.08]));
    return g;
    }, {
    icon: "🛋️", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.6, max: 1.0, step: 0.05, default: 0.75 },
        { key: "length", label: "Length", type: "number", min: 1.2, max: 2.0, step: 0.1, default: 1.6 },
        { key: "color", label: "Wood", type: "color", default: 0x4a2a14 },
        { key: "clothColor", label: "Cloth", type: "color", default: 0x8a4a30 },
    ],
    });

    register("coat_rack", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // center pole
    g.add(_cyl(0.025, 0.03, o.height, wd, [0, o.height/2, 0]));
    // base
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        g.add(_box(0.04, 0.03, 0.2, wd, [Math.sin(a)*0.1, 0.015, Math.cos(a)*0.1]));
        g.add(_sph(0.025, wd, [Math.sin(a)*0.2, 0.025, Math.cos(a)*0.2]));
    }
    // hooks
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const y = o.height - 0.08 - (i % 2) * 0.12;
        const hx = Math.sin(a) * 0.06;
        const hz = Math.cos(a) * 0.06;
        g.add(_cyl(0.01, 0.01, 0.08, wd, [hx, y, hz]));
        g.add(_sph(0.02, M.wood(o.color + 0x101010), [hx + Math.sin(a)*0.06, y + 0.04, hz + Math.cos(a)*0.06]));
    }
    // top finial
    g.add(_cone(0.035, 0.08, wd, [0, o.height + 0.04, 0]));
    return g;
    }, {
    icon: "🧥", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 1.4, max: 2.0, step: 0.1, default: 1.7 },
        { key: "color", label: "Color", type: "color", default: 0x3a2210 },
    ],
    });

    register("display_cabinet", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // body
    g.add(_box(o.width, o.height, o.depth, wd, [0, o.height/2, 0]));
    // glass front
    const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(o.width * 0.8, o.height * 0.75),
        M.glass(0xa8b8c8)
    );
    pane.position.set(0, o.height * 0.52, o.depth/2 + 0.005);
    g.add(pane);
    // glass sides
    [-1,1].forEach(s => {
        const sp = new THREE.Mesh(
        new THREE.PlaneGeometry(o.depth * 0.85, o.height * 0.75),
        M.glass(0xa8b8c8)
        );
        sp.position.set(s * (o.width/2 + 0.005), o.height * 0.52, 0);
        sp.rotation.y = Math.PI/2;
        g.add(sp);
    });
    // shelves inside
    for (let i = 1; i <= o.shelves; i++) {
        const sy = (i / (o.shelves + 1)) * o.height * 0.78 + o.height * 0.12;
        g.add(_box(o.width - 0.04, 0.015, o.depth - 0.04, M.wood(o.color + 0x080808), [0, sy, 0]));
    }
    // decorative top
    g.add(_box(o.width + 0.03, 0.03, o.depth + 0.03, M.wood(o.color + 0x101010), [0, o.height + 0.015, 0]));
    // knob
    g.add(_sph(0.018, M.brass(), [o.width/2 - 0.06, o.height * 0.55, o.depth/2 + 0.01]));
    return g;
    }, {
    icon: "🗄️", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.5, max: 1.2, step: 0.1, default: 0.8 },
        { key: "height", label: "Height", type: "number", min: 0.8, max: 2.0, step: 0.1, default: 1.5 },
        { key: "depth", label: "Depth", type: "number", min: 0.25, max: 0.5, step: 0.05, default: 0.35 },
        { key: "shelves", label: "Shelves", type: "int", min: 1, max: 5, default: 3 },
        { key: "color", label: "Color", type: "color", default: 0x3a1e0c },
    ],
    });

    register("writing_desk", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // top
    g.add(_box(o.width, 0.03, o.depth, wd, [0, o.height, 0]));
    // back panel (raised)
    g.add(_box(o.width, 0.25, 0.02, wd, [0, o.height + 0.125, -o.depth/2 + 0.01]));
    // small shelves on back
    g.add(_box(o.width * 0.3, 0.015, 0.15, wd, [-o.width*0.25, o.height + 0.18, -o.depth/2 + 0.08]));
    g.add(_box(o.width * 0.3, 0.015, 0.15, wd, [o.width*0.25, o.height + 0.18, -o.depth/2 + 0.08]));
    // legs
    const lh = o.height;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_box(0.04, lh, 0.04, wd, [sx*(o.width/2-0.04), lh/2, sz*(o.depth/2-0.04)]));
    });
    // drawer
    g.add(_box(o.width * 0.4, 0.08, o.depth - 0.02, M.wood(o.color + 0x060606),
        [0, o.height - 0.06, 0]));
    g.add(_sph(0.012, M.brass(), [0, o.height - 0.06, o.depth/2 - 0.01]));
    // inkwell on desk
    g.add(_cyl(0.025, 0.02, 0.04, M.ceramic(0x1a1a2a), [o.width*0.15, o.height + 0.035, -o.depth*0.2]));
    // quill
    const q = _cyl(0.003, 0.002, 0.18, M.cloth(0xf0e8d0), [o.width*0.15, o.height + 0.13, -o.depth*0.2]);
    q.rotation.z = 0.15;
    g.add(q);
    return g;
    }, {
    icon: "✒️", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.8, max: 1.5, step: 0.1, default: 1.1 },
        { key: "height", label: "Height", type: "number", min: 0.65, max: 0.85, step: 0.05, default: 0.75 },
        { key: "depth", label: "Depth", type: "number", min: 0.4, max: 0.7, step: 0.05, default: 0.55 },
        { key: "color", label: "Color", type: "color", default: 0x4a2c16 },
    ],
    });

    register("canopy_bed", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const cl = M.cloth(o.clothColor);
    // bed base
    g.add(_box(o.width, 0.25, o.length, wd, [0, 0.125, 0]));
    // mattress
    g.add(_box(o.width - 0.08, 0.15, o.length - 0.08, cl, [0, 0.325, 0]));
    // headboard
    g.add(_box(o.width, o.height * 0.65, 0.05, wd, [0, o.height * 0.325, -o.length/2 + 0.025]));
    // footboard
    g.add(_box(o.width, o.height * 0.35, 0.05, wd, [0, o.height * 0.175, o.length/2 - 0.025]));
    // 4 posts
    const ph = o.height;
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_box(0.06, ph, 0.06, wd,
        [sx*(o.width/2 - 0.03), ph/2, sz*(o.length/2 - 0.03)]));
        // post finials
        g.add(_cone(0.035, 0.06, wd, [sx*(o.width/2 - 0.03), ph + 0.03, sz*(o.length/2 - 0.03)]));
    });
    // top frame
    g.add(_box(o.width, 0.03, 0.03, wd, [0, ph, -o.length/2]));
    g.add(_box(o.width, 0.03, 0.03, wd, [0, ph, o.length/2]));
    g.add(_box(0.03, 0.03, o.length, wd, [-o.width/2, ph, 0]));
    g.add(_box(0.03, 0.03, o.length, wd, [o.width/2, ph, 0]));
    // canopy drape (back)
    const drape = new THREE.Mesh(new THREE.PlaneGeometry(o.width, ph * 0.6), cl);
    drape.position.set(0, ph * 0.65, -o.length/2 + 0.04);
    g.add(drape);
    // pillow
    g.add(_box(o.width * 0.35, 0.08, 0.2, M.fabric(0xf0e8d8), [0, 0.42, -o.length/2 + 0.2]));
    return g;
    }, {
    icon: "🛏️", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.9, max: 1.8, step: 0.1, default: 1.4 },
        { key: "length", label: "Length", type: "number", min: 1.8, max: 2.4, step: 0.1, default: 2.0 },
        { key: "height", label: "Canopy H", type: "number", min: 1.6, max: 2.4, step: 0.1, default: 2.0 },
        { key: "color", label: "Wood", type: "color", default: 0x3a1e0a },
        { key: "clothColor", label: "Cloth", type: "color", default: 0x8b2020 },
    ],
    });

    register("buffet", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // lower cabinet
    g.add(_box(o.width, o.height * 0.55, o.depth, wd, [0, o.height * 0.275, 0]));
    // doors
    g.add(_box(o.width/2 - 0.04, o.height * 0.45, 0.015, M.wood(o.color + 0x080808),
        [-o.width/4, o.height * 0.275, o.depth/2 + 0.005]));
    g.add(_box(o.width/2 - 0.04, o.height * 0.45, 0.015, M.wood(o.color + 0x080808),
        [o.width/4, o.height * 0.275, o.depth/2 + 0.005]));
    // door knobs
    g.add(_sph(0.015, M.brass(), [-0.02, o.height * 0.275, o.depth/2 + 0.015]));
    g.add(_sph(0.015, M.brass(), [0.02, o.height * 0.275, o.depth/2 + 0.015]));
    // legs
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_box(0.05, 0.12, 0.05, wd, [sx*(o.width/2-0.04), 0.06, sz*(o.depth/2-0.04)]));
    });
    // upper shelf
    g.add(_box(o.width, 0.03, o.depth, wd, [0, o.height * 0.55, 0]));
    // legs for upper
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_box(0.03, o.height * 0.42, 0.03, wd,
        [sx*(o.width/2-0.03), o.height * 0.55 + o.height*0.21, sz*(o.depth/2-0.03)]));
    });
    // top
    g.add(_box(o.width + 0.02, 0.025, o.depth + 0.02, wd, [0, o.height, 0]));
    return g;
    }, {
    icon: "🍽️", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 1.0, max: 2.0, step: 0.1, default: 1.5 },
        { key: "height", label: "Height", type: "number", min: 1.2, max: 1.8, step: 0.1, default: 1.5 },
        { key: "depth", label: "Depth", type: "number", min: 0.35, max: 0.55, step: 0.05, default: 0.45 },
        { key: "color", label: "Color", type: "color", default: 0x3a1e0c },
    ],
    });

    register("crib", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // base
    g.add(_box(o.width, 0.04, o.length, wd, [0, 0.25, 0]));
    // mattress
    g.add(_box(o.width - 0.04, 0.06, o.length - 0.04, M.cloth(0xf0e8d8), [0, 0.3, 0]));
    // side rails (slats)
    [-1,1].forEach(s => {
        g.add(_box(0.03, o.railH, 0.03, wd, [s*(o.width/2), o.railH/2 + 0.28, 0]));
        // slats
        for (let i = 0; i < 6; i++) {
        const z = -o.length/2 + 0.08 + i * (o.length - 0.16) / 5;
        g.add(_box(0.02, o.railH - 0.06, 0.02, wd, [s*(o.width/2), o.railH/2 + 0.28, z]));
        }
    });
    // end rails
    [-1,1].forEach(s => {
        g.add(_box(0.03, o.railH + 0.1, 0.03, wd, [0, (o.railH+0.1)/2 + 0.28, s*(o.length/2)]));
        for (let i = 0; i < 4; i++) {
        const x = -o.width/2 + 0.08 + i * (o.width - 0.16) / 3;
        g.add(_box(0.02, o.railH + 0.04, 0.02, wd, [x, (o.railH+0.04)/2 + 0.28, s*(o.length/2)]));
        }
    });
    // legs
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_box(0.04, 0.25, 0.04, wd, [sx*(o.width/2), 0.125, sz*(o.length/2)]));
    });
    return g;
    }, {
    icon: "👶", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.5, max: 0.8, step: 0.05, default: 0.65 },
        { key: "length", label: "Length", type: "number", min: 0.9, max: 1.4, step: 0.1, default: 1.2 },
        { key: "railH", label: "Rail H", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.45 },
        { key: "color", label: "Color", type: "color", default: 0x6a4a2a },
    ],
    });

    register("herb_rack", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // frame
    g.add(_box(0.03, o.height, 0.03, wd, [-o.width/2, o.height/2, 0]));
    g.add(_box(0.03, o.height, 0.03, wd, [o.width/2, o.height/2, 0]));
    // shelves
    for (let i = 0; i < o.shelves; i++) {
        const y = 0.05 + i * (o.height - 0.1) / (o.shelves - 1 || 1);
        g.add(_box(o.width, 0.015, 0.12, wd, [0, y, 0]));
        // herb bundles hanging
        for (let j = 0; j < 3; j++) {
        const x = -o.width/3 + j * o.width/3;
        g.add(_cyl(0.015, 0.008, 0.1, M.leaf(0x5a7a40 + j*0x0a0a00), [x, y - 0.06, 0.02]));
        }
    }
    // hanging rod at top
    g.add(_cyl(0.01, 0.01, o.width, M.wood(o.color + 0x101010), [0, o.height, 0.04], 8));
    return g;
    }, {
    icon: "🌿", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.4, max: 1.0, step: 0.1, default: 0.6 },
        { key: "height", label: "Height", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 1.0 },
        { key: "shelves", label: "Shelves", type: "int", min: 2, max: 5, default: 3 },
        { key: "color", label: "Color", type: "color", default: 0x5a4020 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  LIGHTING
    // ═══════════════════════════════════════════════════════════

    register("brazier", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const rst = M.rust(o.color + 0x1a0a00);
    // bowl
    g.add(_cyl(o.radius * 0.9, o.radius, o.radius * 0.5, mt, [0, o.height, 0], 10));
    // rim
    g.add(_tor(o.radius + 0.01, 0.015, mt, [0, o.height + o.radius*0.25, 0], 8, 16));
    // legs (3)
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const lx = Math.sin(a) * o.radius * 0.7;
        const lz = Math.cos(a) * o.radius * 0.7;
        g.add(_cyl(0.02, 0.03, o.height - 0.02, rst, [lx, (o.height-0.02)/2, lz]));
        // foot
        g.add(_sph(0.03, rst, [lx, 0.02, lz]));
    }
    // fire glow
    if (o.glow) {
        const fl = new THREE.PointLight(0xff6820, o.glow, 6, 1.5);
        fl.position.set(0, o.height + 0.3, 0);
        g.add(fl);
    }
    // fake embers
    g.add(_sph(o.radius * 0.3, M.wax(0xff4010), [0, o.height + 0.08, 0], 6));
    g.add(_sph(o.radius * 0.2, M.wax(0xff8030), [0.03, o.height + 0.12, 0.02], 5));
    return g;
    }, {
    icon: "🔥", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.5, step: 0.05, default: 0.25 },
        { key: "height", label: "Height", type: "number", min: 0.5, max: 1.2, step: 0.1, default: 0.8 },
        { key: "glow", label: "Light", type: "number", min: 0, max: 3, step: 0.5, default: 1.5 },
        { key: "color", label: "Metal", type: "color", default: 0x2a2018 },
    ],
    });

    register("oil_lamp", function (o) {
    const g = new THREE.Group();
    const mt = M.brass(o.color);
    const gl = M.glass(0xd8c888);
    // base
    g.add(_cyl(o.radius, o.radius * 0.8, 0.03, mt, [0, 0.015, 0], 12));
    // stem
    g.add(_cyl(0.012, 0.015, o.height * 0.5, mt, [0, o.height * 0.27, 0], 8));
    // reservoir
    g.add(_cyl(o.radius * 0.6, o.radius * 0.5, o.radius * 0.7, M.ceramic(0x2a3040), [0, o.height * 0.55, 0], 10));
    // glass chimney
    const chimney = new THREE.Mesh(
        new THREE.CylinderGeometry(o.radius * 0.2, o.radius * 0.35, o.height * 0.35, 10),
        gl
    );
    chimney.position.set(0, o.height * 0.78, 0);
    g.add(chimney);
    // flame
    g.add(_cone(0.012, 0.04, M.wax(0xffa020), [0, o.height * 0.96, 0], 6));
    if (o.glow > 0) {
        const l = new THREE.PointLight(0xffe8a0, o.glow, 5, 1.3);
        l.position.set(0, o.height, 0);
        g.add(l);
    }
    return g;
    }, {
    icon: "🪔", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 0.2, max: 0.5, step: 0.05, default: 0.35 },
        { key: "radius", label: "Radius", type: "number", min: 0.04, max: 0.1, step: 0.01, default: 0.06 },
        { key: "glow", label: "Light", type: "number", min: 0, max: 2, step: 0.3, default: 0.8 },
        { key: "color", label: "Brass", type: "color", default: 0xc8a050 },
    ],
    });

    register("paper_lantern", function (o) {
    const g = new THREE.Group();
    const cl = M.cloth(o.color);
    const mt = M.wood(0x3a2a18);
    // top cap
    g.add(_cyl(o.radius * 0.3, o.radius * 0.3, 0.01, mt, [0, o.height/2, 0], 8));
    // body (cylinder of cloth)
    g.add(_cyl(o.radius, o.radius * 0.9, o.height * 0.85, cl, [0, 0, 0], 12));
    // bottom ring
    g.add(_tor(o.radius * 0.15, 0.005, mt, [0, -o.height/2 + 0.01, 0], 6, 12));
    // tassel
    g.add(_cyl(0.005, 0.003, 0.1, M.rope(o.color + 0x201008), [0, -o.height/2 - 0.05, 0], 4));
    // light
    if (o.glow > 0) {
        const l = new THREE.PointLight(0xffe0a0, o.glow, 4, 1.5);
        l.position.set(0, 0, 0);
        g.add(l);
    }
    // hanging string
    g.add(_cyl(0.003, 0.003, 0.15, M.rope(), [0, o.height/2 + 0.075, 0], 4));
    return g;
    }, {
    icon: "🏮", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.12, max: 0.35, step: 0.03, default: 0.2 },
        { key: "height", label: "Height", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
        { key: "glow", label: "Light", type: "number", min: 0, max: 2, step: 0.3, default: 0.8 },
        { key: "color", label: "Color", type: "color", default: 0xcc2020 },
    ],
    });

    register("crystal_chandelier", function (o) {
    const g = new THREE.Group();
    const mt = M.brass(o.color);
    const cr = M.glass(0xd0e8f8);
    // central ring
    g.add(_tor(o.radius, 0.02, mt, [0, 0, 0], 8, 20));
    // top chain mount
    g.add(_cyl(0.015, 0.02, 0.06, mt, [0, 0.04, 0], 6));
    // hanging rod
    g.add(_cyl(0.008, 0.008, o.dropH, mt, [0, o.dropH/2, 0], 6));
    // ceiling plate
    g.add(_cyl(0.06, 0.06, 0.01, mt, [0, o.dropH + 0.005, 0], 10));
    // candles
    for (let i = 0; i < o.candles; i++) {
        const a = (i / o.candles) * Math.PI * 2;
        const cx = Math.sin(a) * o.radius;
        const cz = Math.cos(a) * o.radius;
        g.add(_cyl(0.015, 0.015, 0.1, M.wax(), [cx, 0.07, cz], 6));
        g.add(_cone(0.008, 0.025, M.wax(0xffa830), [cx, 0.13, cz], 5));
    }
    // crystal drops
    for (let i = 0; i < o.candles * 2; i++) {
        const a = (i / (o.candles * 2)) * Math.PI * 2;
        const dx = Math.sin(a) * o.radius * 0.85;
        const dz = Math.cos(a) * o.radius * 0.85;
        g.add(_cone(0.01, 0.05, cr, [dx, -0.04, dz], 4));
    }
    // light
    if (o.glow > 0) {
        const l = new THREE.PointLight(0xfff0c8, o.glow, 8, 1.2);
        l.position.set(0, 0.1, 0);
        g.add(l);
    }
    return g;
    }, {
    icon: "✨", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.2, max: 0.8, step: 0.05, default: 0.4 },
        { key: "candles", label: "Candles", type: "int", min: 4, max: 12, default: 6 },
        { key: "dropH", label: "Drop H", type: "number", min: 0.2, max: 1.5, step: 0.1, default: 0.5 },
        { key: "glow", label: "Light", type: "number", min: 0, max: 4, step: 0.5, default: 2.0 },
        { key: "color", label: "Brass", type: "color", default: 0xc8a050 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  NATURE / OUTDOOR
    // ═══════════════════════════════════════════════════════════

    register("palm_tree", function (o) {
    const g = new THREE.Group();
    const bk = M.wood(o.barkColor);
    const lf = M.leaf(o.leafColor);
    // trunk (curved segments)
    const segs = 8;
    const curve = o.lean || 0;
    for (let i = 0; i < segs; i++) {
        const t = i / segs;
        const y = t * o.height;
        const r = o.trunkR * (1 - t * 0.4);
        const xOff = Math.sin(t * Math.PI) * curve;
        g.add(_cyl(r * 0.95, r, o.height / segs, bk, [xOff, y + o.height/(segs*2), 0], 8));
        // ring texture
        if (i % 2 === 0) {
        g.add(_tor(r + 0.005, 0.005, bk, [xOff, y + o.height/segs, 0], 5, 10));
        }
    }
    // fronds
    const topY = o.height;
    const topX = Math.sin(Math.PI) * curve;
    for (let i = 0; i < o.fronds; i++) {
        const a = (i / o.fronds) * Math.PI * 2;
        const frondG = new THREE.Group();
        // main stem
        const stem = _cyl(0.008, 0.005, o.frondLen, M.wood(o.barkColor + 0x101010), [0, 0, 0], 4);
        stem.rotation.x = -0.6;
        stem.rotation.z = a;
        frondG.add(stem);
        // leaf shape
        const leaf = new THREE.Mesh(
        new THREE.PlaneGeometry(o.frondLen * 0.3, o.frondLen * 0.8),
        lf
        );
        leaf.rotation.x = -0.6;
        leaf.rotation.z = a;
        leaf.position.set(
        Math.sin(a) * o.frondLen * 0.3,
        -o.frondLen * 0.2,
        Math.cos(a) * o.frondLen * 0.3
        );
        frondG.add(leaf);
        frondG.position.set(topX, topY, 0);
        g.add(frondG);
    }
    // coconuts
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        g.add(_sph(0.04, M.leaf(0x5a4020), [topX + Math.sin(a)*0.06, topY - 0.08, Math.cos(a)*0.06], 6));
    }
    return g;
    }, {
    icon: "🌴", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 3, max: 10, step: 0.5, default: 6 },
        { key: "trunkR", label: "Trunk R", type: "number", min: 0.1, max: 0.3, step: 0.02, default: 0.18 },
        { key: "fronds", label: "Fronds", type: "int", min: 5, max: 12, default: 7 },
        { key: "frondLen", label: "Frond L", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 2.0 },
        { key: "lean", label: "Lean", type: "number", min: 0, max: 1.5, step: 0.1, default: 0.4 },
        { key: "barkColor", label: "Bark", type: "color", default: 0x6a5030 },
        { key: "leafColor", label: "Leaf", type: "color", default: 0x2a6a20 },
    ],
    });

    register("bamboo_cluster", function (o) {
    const g = new THREE.Group();
    const bk = M.wood(o.color);
    const lf = M.leaf(o.leafColor);
    for (let i = 0; i < o.stalks; i++) {
        const x = rand(-o.spread, o.spread);
        const z = rand(-o.spread, o.spread);
        const h = o.height * (0.7 + Math.random() * 0.3);
        const r = o.stalkR * (0.8 + Math.random() * 0.4);
        // segments
        const segs = Math.floor(h / 0.4);
        for (let s = 0; s < segs; s++) {
        const sy = s * 0.4;
        const sr = r * (1 - sy / h * 0.3);
        g.add(_cyl(sr, sr + 0.003, 0.38, bk, [x, sy + 0.19, z], 6));
        // node ring
        if (s > 0) {
            g.add(_tor(sr + 0.005, 0.004, M.wood(o.color + 0x0a0a00), [x, sy, z], 4, 8));
        }
        }
        // leaves at top
        if (Math.random() > 0.3) {
        for (let l = 0; l < 3; l++) {
            const la = Math.random() * Math.PI * 2;
            const leaf = new THREE.Mesh(
            new THREE.PlaneGeometry(0.06, 0.15),
            lf
            );
            leaf.position.set(x + Math.sin(la)*0.08, h - 0.1, z + Math.cos(la)*0.08);
            leaf.rotation.set(-0.4, la, 0.2);
            g.add(leaf);
        }
        }
    }
    return g;
    }, {
    icon: "🎋", category: "z_ai",
    params: [
        { key: "stalks", label: "Stalks", type: "int", min: 3, max: 12, default: 6 },
        { key: "height", label: "Height", type: "number", min: 2, max: 8, step: 0.5, default: 5 },
        { key: "stalkR", label: "Stalk R", type: "number", min: 0.02, max: 0.06, step: 0.005, default: 0.035 },
        { key: "spread", label: "Spread", type: "number", min: 0.2, max: 0.8, step: 0.1, default: 0.4 },
        { key: "color", label: "Stalk", type: "color", default: 0x4a6a28 },
        { key: "leafColor", label: "Leaf", type: "color", default: 0x3a5a20 },
    ],
    });

    register("sunflower", function (o) {
    const g = new THREE.Group();
    const st = M.wood(0x2a5a18);
    const lf = M.leaf(0x3a6a20);
    const petal = M.leaf(o.petalColor);
    const center = M.stone(0x3a2a10);
    // stem
    g.add(_cyl(0.015, 0.018, o.height, st, [0, o.height/2, 0], 6));
    // leaves
    for (let i = 0; i < 3; i++) {
        const ly = o.height * (0.2 + i * 0.25);
        const la = (i * 1.2) + 0.5;
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.2), lf);
        leaf.position.set(Math.sin(la)*0.06, ly, Math.cos(la)*0.06);
        leaf.rotation.set(-0.3, la, 0);
        g.add(leaf);
    }
    // flower head
    const headY = o.height + 0.03;
    // disc
    g.add(_cyl(o.headR, o.headR * 0.9, 0.02, center, [0, headY, 0], 12));
    // petals
    for (let i = 0; i < o.petals; i++) {
        const a = (i / o.petals) * Math.PI * 2;
        const px = Math.sin(a) * o.headR * 0.85;
        const pz = Math.cos(a) * o.headR * 0.85;
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.04, o.headR * 0.7), petal);
        p.position.set(px, headY + 0.01, pz);
        p.rotation.set(-Math.PI/2, 0, a);
        g.add(p);
    }
    return g;
    }, {
    icon: "🌻", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 0.6, max: 2.0, step: 0.1, default: 1.2 },
        { key: "headR", label: "Head R", type: "number", min: 0.06, max: 0.2, step: 0.02, default: 0.1 },
        { key: "petals", label: "Petals", type: "int", min: 8, max: 20, default: 14 },
        { key: "petalColor", label: "Petals", type: "color", default: 0xe8c820 },
    ],
    });

    register("moss_rock", function (o) {
    const g = new THREE.Group();
    const rk = M.stone(o.rockColor);
    const ms = M.leaf(o.mossColor);
    // main rock (deformed sphere approximation)
    for (let i = 0; i < o.rocks; i++) {
        const s = o.size * (0.5 + Math.random() * 0.5);
        const x = rand(-o.spread, o.spread);
        const z = rand(-o.spread, o.spread);
        g.add(_sph(s, rk, [x, s * 0.6, z], 6 + Math.floor(Math.random()*4)));
    }
    // moss patches
    for (let i = 0; i < 5; i++) {
        const x = rand(-o.spread * 0.8, o.spread * 0.8);
        const z = rand(-o.spread * 0.8, o.spread * 0.8);
        const ms2 = new THREE.Mesh(new THREE.PlaneGeometry(o.size * 0.5, o.size * 0.5), ms);
        ms2.position.set(x, o.size * 0.55, z);
        ms2.rotation.x = -Math.PI/2 + rand(-0.2, 0.2);
        g.add(ms2);
    }
    return g;
    }, {
    icon: "🪨", category: "z_ai",
    params: [
        { key: "size", label: "Rock Size", type: "number", min: 0.2, max: 1.0, step: 0.1, default: 0.5 },
        { key: "rocks", label: "Rocks", type: "int", min: 1, max: 5, default: 3 },
        { key: "spread", label: "Spread", type: "number", min: 0.2, max: 1.0, step: 0.1, default: 0.4 },
        { key: "rockColor", label: "Rock", type: "color", default: 0x5a5a50 },
        { key: "mossColor", label: "Moss", type: "color", default: 0x3a5a28 },
    ],
    });

    register("cherry_blossom", function (o) {
    const g = new THREE.Group();
    const bk = M.wood(o.barkColor);
    const fl = M.leaf(o.flowerColor);
    // trunk
    g.add(_cyl(o.trunkR, o.trunkR * 1.2, o.height * 0.5, bk, [0, o.height * 0.25, 0], 8));
    // branches (fork)
    const bh = o.height * 0.45;
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + rand(-0.3, 0.3);
        const blen = o.height * (0.25 + Math.random() * 0.15);
        const br = _cyl(0.02, o.trunkR * 0.5, blen, bk);
        br.position.set(Math.sin(a) * blen * 0.3, bh + blen * 0.3, Math.cos(a) * blen * 0.3);
        br.rotation.z = Math.sin(a) * 0.5;
        br.rotation.x = Math.cos(a) * 0.5;
        g.add(br);
    }
    // blossom canopy (clusters of small spheres)
    const canopyR = o.height * 0.45;
    for (let i = 0; i < o.blossoms; i++) {
        const phi = Math.random() * Math.PI * 0.6 + 0.4;
        const theta = Math.random() * Math.PI * 2;
        const r = canopyR * (0.3 + Math.random() * 0.7);
        const bx = Math.sin(phi) * Math.cos(theta) * r;
        const by = o.height * 0.55 + Math.cos(phi) * r * 0.6;
        const bz = Math.sin(phi) * Math.sin(theta) * r;
        g.add(_sph(0.12 + Math.random() * 0.08, fl, [bx, by, bz], 5));
    }
    return g;
    }, {
    icon: "🌸", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 2, max: 6, step: 0.5, default: 4 },
        { key: "trunkR", label: "Trunk R", type: "number", min: 0.08, max: 0.25, step: 0.02, default: 0.14 },
        { key: "blossoms", label: "Blossoms", type: "int", min: 15, max: 50, default: 30 },
        { key: "barkColor", label: "Bark", type: "color", default: 0x4a3028 },
        { key: "flowerColor", label: "Flower", type: "color", default: 0xf0a8b8 },
    ],
    });

    register("cactus", function (o) {
    const g = new THREE.Group();
    const ct = M.leaf(o.color);
    // main body
    g.add(_cyl(o.radius, o.radius * 1.05, o.height, ct, [0, o.height/2, 0], 8));
    // top dome
    g.add(_sph(o.radius, ct, [0, o.height, 0], 8));
    // arms
    for (let i = 0; i < o.arms; i++) {
        const a = (i / o.arms) * Math.PI * 2 + 0.5;
        const armH = o.height * (0.25 + Math.random() * 0.2);
        const armY = o.height * (0.35 + i * 0.2);
        // horizontal part
        const arm = _cyl(o.radius * 0.55, o.radius * 0.6, armH * 0.5, ct);
        arm.position.set(Math.sin(a) * armH * 0.25, armY, Math.cos(a) * armH * 0.25);
        arm.rotation.z = Math.sin(a) * 0.8;
        arm.rotation.x = Math.cos(a) * 0.8;
        g.add(arm);
        // vertical part
        g.add(_cyl(o.radius * 0.45, o.radius * 0.5, armH * 0.5, ct,
        [Math.sin(a) * armH * 0.4, armY + armH * 0.2, Math.cos(a) * armH * 0.4], 6));
    }
    return g;
    }, {
    icon: "🌵", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 0.5, max: 3.0, step: 0.2, default: 1.5 },
        { key: "radius", label: "Radius", type: "number", min: 0.08, max: 0.25, step: 0.02, default: 0.14 },
        { key: "arms", label: "Arms", type: "int", min: 0, max: 4, default: 2 },
        { key: "color", label: "Color", type: "color", default: 0x2a6a28 },
    ],
    });

    register("ivy_wall", function (o) {
    const g = new THREE.Group();
    const pl = M.plaster(o.wallColor);
    const iv = M.leaf(o.ivyColor);
    // wall
    g.add(_box(o.width, o.height, 0.12, pl, [0, o.height/2, 0]));
    // ivy patches
    for (let i = 0; i < o.patches; i++) {
        const px = rand(-o.width/2 * 0.85, o.width/2 * 0.85);
        const py = rand(o.height * 0.1, o.height * 0.95);
        const pw = rand(0.15, 0.4);
        const ph = rand(0.2, 0.6);
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), iv);
        patch.position.set(px, py, 0.065 + rand(0, 0.01));
        g.add(patch);
    }
    // vine lines
    for (let i = 0; i < 3; i++) {
        const vx = rand(-o.width/3, o.width/3);
        const vine = _cyl(0.005, 0.005, o.height * rand(0.4, 0.9), M.wood(0x2a4a18),
        [vx, o.height * 0.45, 0.07], 4);
        g.add(vine);
    }
    return g;
    }, {
    icon: "🌿", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 1, max: 6, step: 0.5, default: 3 },
        { key: "height", label: "Height", type: "number", min: 1.5, max: 5, step: 0.5, default: 3 },
        { key: "patches", label: "Ivy Density", type: "int", min: 5, max: 30, default: 15 },
        { key: "wallColor", label: "Wall", type: "color", default: 0x8a8070 },
        { key: "ivyColor", label: "Ivy", type: "color", default: 0x2a5a18 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  ARCHITECTURE — Outdoor / Structures
    // ═══════════════════════════════════════════════════════════

    register("gazebo", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const st = M.stone(o.color + 0x181818);
    // floor
    const floor = new THREE.Mesh(new THREE.CircleGeometry(o.radius, 8), M.wood(o.color + 0x080808));
    floor.rotation.x = -Math.PI/2;
    floor.position.y = 0.04;
    g.add(floor);
    // posts (8)
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.add(_box(0.08, o.height, 0.08, wd,
        [Math.sin(a) * (o.radius - 0.06), o.height/2 + 0.04, Math.cos(a) * (o.radius - 0.06)]));
    }
    // roof (cone)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(o.radius * 1.15, o.height * 0.4, 8), wd);
    roof.position.y = o.height + 0.04 + o.height * 0.2;
    g.add(roof);
    // roof peak
    g.add(_cone(0.03, 0.15, M.metal(0x2a2a28), [0, o.height + 0.04 + o.height * 0.4 + 0.075, 0]));
    // railing
    for (let i = 0; i < 8; i++) {
        const a1 = (i / 8) * Math.PI * 2;
        const a2 = ((i + 1) / 8) * Math.PI * 2;
        if (i === 0) continue; // opening
        const mx = (Math.sin(a1) + Math.sin(a2)) / 2 * (o.radius - 0.06);
        const mz = (Math.cos(a1) + Math.cos(a2)) / 2 * (o.radius - 0.06);
        const railLen = Math.sqrt(
        Math.pow(Math.sin(a2) - Math.sin(a1), 2) +
        Math.pow(Math.cos(a2) - Math.cos(a1), 2)
        ) * (o.radius - 0.06);
        const ra = Math.atan2(Math.cos(a1) - Math.cos(a2), Math.sin(a2) - Math.sin(a1));
        const rail = _box(0.03, 0.06, railLen, wd, [mx, 0.65, mz]);
        rail.rotation.y = ra;
        g.add(rail);
    }
    // top rail
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.add(_box(0.04, 0.04, 0.04, wd,
        [Math.sin(a) * (o.radius - 0.06), o.height - 0.02 + 0.04, Math.cos(a) * (o.radius - 0.06)]));
    }
    return g;
    }, {
    icon: "⛩️", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 1.5, max: 4.0, step: 0.25, default: 2.5 },
        { key: "height", label: "Height", type: "number", min: 2.0, max: 4.0, step: 0.25, default: 2.8 },
        { key: "color", label: "Color", type: "color", default: 0x6a4a2a },
    ],
    });

    register("colonnade", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    for (let i = 0; i < o.columns; i++) {
        const z = -o.length/2 + i * (o.length / (o.columns - 1));
        // column shaft
        g.add(_cyl(o.radius, o.radius * 1.08, o.height, st, [0, o.height/2, z], 10));
        // base
        g.add(_cyl(o.radius * 1.3, o.radius * 1.4, 0.08, st, [0, 0.04, z], 10));
        // capital
        g.add(_cyl(o.radius * 1.4, o.radius * 1.2, 0.1, st, [0, o.height - 0.05, z], 10));
        g.add(_box(o.radius * 2.8, 0.06, o.radius * 2.8, st, [0, o.height + 0.03, z]));
    }
    // lintel
    g.add(_box(o.radius * 3, 0.15, o.length, st, [0, o.height + 0.1, 0]));
    return g;
    }, {
    icon: "🏛️", category: "z_ai",
    params: [
        { key: "columns", label: "Columns", type: "int", min: 3, max: 10, default: 5 },
        { key: "height", label: "Height", type: "number", min: 2, max: 6, step: 0.5, default: 4 },
        { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.4, step: 0.05, default: 0.22 },
        { key: "length", label: "Length", type: "number", min: 3, max: 14, step: 1, default: 8 },
        { key: "color", label: "Color", type: "color", default: 0xc8c0b0 },
    ],
    });

    register("stone_bench", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // seat slab
    g.add(_box(o.width, 0.06, o.depth, st, [0, o.height - 0.03, 0]));
    // legs (two stone blocks)
    g.add(_box(o.depth * 0.9, o.height - 0.06, o.depth * 0.85, st,
        [-o.width/2 + o.depth/2, (o.height - 0.06)/2, 0]));
    g.add(_box(o.depth * 0.9, o.height - 0.06, o.depth * 0.85, st,
        [o.width/2 - o.depth/2, (o.height - 0.06)/2, 0]));
    // back rest
    g.add(_box(o.width, o.backH, 0.06, st, [0, o.height + o.backH/2, -o.depth/2 + 0.03]));
    return g;
    }, {
    icon: "🪨", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 1.0, max: 2.5, step: 0.2, default: 1.5 },
        { key: "height", label: "Seat H", type: "number", min: 0.35, max: 0.55, step: 0.05, default: 0.45 },
        { key: "depth", label: "Depth", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.4 },
        { key: "backH", label: "Back H", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.4 },
        { key: "color", label: "Color", type: "color", default: 0x6a6458 },
    ],
    });

    register("ornate_gate", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const st = M.stone(o.postColor);
    // left post
    g.add(_box(o.postW, o.height, o.postW, st, [-o.span/2 - o.postW/2, o.height/2, 0]));
    g.add(_cone(o.postW * 0.5, 0.15, st, [-o.span/2 - o.postW/2, o.height + 0.075, 0]));
    // right post
    g.add(_box(o.postW, o.height, o.postW, st, [o.span/2 + o.postW/2, o.height/2, 0]));
    g.add(_cone(o.postW * 0.5, 0.15, st, [o.span/2 + o.postW/2, o.height + 0.075, 0]));
    // gate bars
    const barCount = Math.max(3, Math.floor(o.span / 0.1));
    for (let i = 0; i < barCount; i++) {
        const x = -o.span/2 + (i + 0.5) * o.span / barCount;
        g.add(_cyl(0.012, 0.012, o.height * 0.85, mt, [x, o.height * 0.425, 0], 6));
    }
    // horizontal rails
    g.add(_cyl(0.015, 0.015, o.span, mt, [0, o.height * 0.8, 0], 6));
    g.add(_cyl(0.015, 0.015, o.span, mt, [0, o.height * 0.25, 0], 6));
    // arch top
    const arch = new THREE.Mesh(
        new THREE.TorusGeometry(o.span/2, 0.015, 6, 20, Math.PI),
        mt
    );
    arch.position.set(0, o.height * 0.85, 0);
    arch.rotation.z = -Math.PI/2;
    g.add(arch);
    // decorative finials on posts
    g.add(_sph(o.postW * 0.3, M.stone(o.postColor + 0x101010), [-o.span/2 - o.postW/2, o.height + 0.2, 0], 6));
    g.add(_sph(o.postW * 0.3, M.stone(o.postColor + 0x101010), [o.span/2 + o.postW/2, o.height + 0.2, 0], 6));
    return g;
    }, {
    icon: "🚪", category: "z_ai",
    params: [
        { key: "span", label: "Span", type: "number", min: 1.0, max: 4.0, step: 0.3, default: 2.0 },
        { key: "height", label: "Height", type: "number", min: 1.5, max: 4.0, step: 0.25, default: 2.5 },
        { key: "postW", label: "Post W", type: "number", min: 0.15, max: 0.4, step: 0.05, default: 0.22 },
        { key: "color", label: "Metal", type: "color", default: 0x2a2520 },
        { key: "postColor", label: "Stone", type: "color", default: 0x6a6050 },
    ],
    });

    register("birdbath", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // base
    g.add(_cyl(o.baseR, o.baseR * 1.1, 0.05, st, [0, 0.025, 0], 12));
    // pedestal
    g.add(_cyl(0.05, 0.06, o.height * 0.7, st, [0, o.height * 0.35 + 0.05, 0], 8));
    // mid section
    g.add(_cyl(0.08, 0.06, 0.06, st, [0, o.height * 0.7 + 0.08, 0], 10));
    // bowl
    g.add(_cyl(o.bowlR, o.bowlR * 0.6, 0.08, st, [0, o.height * 0.7 + 0.12, 0], 14));
    // water surface
    g.add(_cyl(o.bowlR * 0.85, o.bowlR * 0.85, 0.01, M.glass(0x6090c0),
        [0, o.height * 0.7 + 0.155, 0], 14));
    return g;
    }, {
    icon: "🕊️", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 0.5, max: 1.2, step: 0.1, default: 0.8 },
        { key: "bowlR", label: "Bowl R", type: "number", min: 0.15, max: 0.4, step: 0.03, default: 0.25 },
        { key: "baseR", label: "Base R", type: "number", min: 0.1, max: 0.25, step: 0.02, default: 0.15 },
        { key: "color", label: "Color", type: "color", default: 0xa8a098 },
    ],
    });

    register("trellis", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const iv = M.leaf(o.ivyColor);
    // vertical posts
    for (let i = 0; i <= 4; i++) {
        const x = -o.width/2 + i * o.width/4;
        g.add(_box(0.03, o.height, 0.03, wd, [x, o.height/2, 0]));
    }
    // horizontal rails
    for (let i = 0; i <= 5; i++) {
        const y = i * o.height / 5;
        g.add(_box(o.width, 0.025, 0.025, wd, [0, y, 0]));
    }
    // diagonal lattice
    for (let d = 0; d < 2; d++) {
        const step = o.width / 5;
        for (let i = -6; i < 12; i++) {
        const x1 = -o.width/2 + i * step;
        const x2 = x1 + step;
        const y1 = d === 0 ? 0 : o.height;
        const y2 = d === 0 ? o.height/5 : o.height - o.height/5;
        // simplified as small box at 45°
        if (x1 >= -o.width/2 - step && x1 <= o.width/2) {
            const diag = _box(0.015, 0.015, step * 1.5, wd);
            diag.position.set((x1+x2)/2, (y1+y2)/2, 0);
            diag.rotation.z = d === 0 ? 0.7 : -0.7;
            g.add(diag);
        }
        }
    }
    // ivy patches
    for (let i = 0; i < o.ivyDensity; i++) {
        const px = rand(-o.width/2, o.width/2);
        const py = rand(0, o.height);
        const patch = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.1, 0.25), rand(0.1, 0.2)), iv);
        patch.position.set(px, py, 0.02);
        g.add(patch);
    }
    return g;
    }, {
    icon: "🌱", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.8, max: 3.0, step: 0.2, default: 1.5 },
        { key: "height", label: "Height", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 2.0 },
        { key: "ivyDensity", label: "Ivy", type: "int", min: 0, max: 20, default: 8 },
        { key: "color", label: "Wood", type: "color", default: 0x4a3020 },
        { key: "ivyColor", label: "Ivy", type: "color", default: 0x2a5a18 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  DECOR / PROPS
    // ═══════════════════════════════════════════════════════════

    register("gramophone", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const mt = M.brass();
    // base cabinet
    g.add(_box(0.3, 0.2, 0.3, wd, [0, 0.1, 0]));
    // decorative feet
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_sph(0.02, wd, [sx*0.12, 0.02, sz*0.12]));
    });
    // turntable
    g.add(_cyl(0.1, 0.1, 0.01, M.felt(0x1a1a1a), [0, 0.21, 0], 16));
    // record
    g.add(_cyl(0.09, 0.09, 0.003, M.glass(0x0a0a0a), [0, 0.22, 0], 16));
    g.add(_cyl(0.01, 0.01, 0.005, M.wood(0x3a2a18), [0, 0.225, 0], 8));
    // horn arm
    g.add(_cyl(0.01, 0.015, 0.12, mt, [0.02, 0.28, -0.02], 6));
    // horn (cone)
    const horn = _cone(0.14, 0.2, mt, [0.05, 0.45, -0.05], 12);
    horn.rotation.x = 0.5;
    horn.rotation.z = -0.3;
    g.add(horn);
    // crank
    g.add(_cyl(0.005, 0.005, 0.06, mt, [0.16, 0.15, 0], 4));
    g.add(_cyl(0.008, 0.008, 0.03, mt, [0.16, 0.15, 0.02], 4));
    return g;
    }, {
    icon: "📻", category: "z_ai",
    params: [
        { key: "color", label: "Wood", type: "color", default: 0x4a2010 },
    ],
    });

    register("crystal_ball", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.standColor);
    // base
    g.add(_cyl(o.radius * 0.8, o.radius * 0.9, 0.04, mt, [0, 0.02, 0], 10));
    // claw feet (3)
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        g.add(_cyl(0.01, 0.015, 0.06, mt, [Math.sin(a)*o.radius*0.5, 0.06, Math.cos(a)*o.radius*0.5], 4));
        // claw curl up
        g.add(_sph(0.012, mt, [Math.sin(a)*o.radius*0.35, o.radius*0.7, Math.cos(a)*o.radius*0.35], 5));
    }
    // ball
    const ball = new THREE.Mesh(
        new THREE.SphereGeometry(o.radius, 16, 12),
        new THREE.MeshStandardMaterial({
        color: o.ballColor, roughness: 0.05, metalness: 0.1,
        transparent: true, opacity: 0.6
        })
    );
    ball.position.y = o.radius + 0.06;
    g.add(ball);
    // inner glow
    if (o.glow > 0) {
        const l = new THREE.PointLight(o.ballColor, o.glow, 3, 1.5);
        l.position.set(0, o.radius + 0.06, 0);
        g.add(l);
    }
    return g;
    }, {
    icon: "🔮", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.06, max: 0.2, step: 0.02, default: 0.1 },
        { key: "ballColor", label: "Ball", type: "color", default: 0x6040a0 },
        { key: "standColor", label: "Stand", type: "color", default: 0x2a2018 },
        { key: "glow", label: "Glow", type: "number", min: 0, max: 2, step: 0.3, default: 0.6 },
    ],
    });

    register("potion_shelf", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // back
    g.add(_box(o.width, o.height, 0.02, wd, [0, o.height/2, -o.depth/2 + 0.01]));
    // shelves
    for (let i = 0; i <= o.shelves; i++) {
        const y = i * o.height / o.shelves;
        g.add(_box(o.width, 0.015, o.depth, wd, [0, y, 0]));
    }
    // sides
    [-1,1].forEach(s => {
        g.add(_box(0.015, o.height, o.depth, wd, [s*(o.width/2 - 0.007), o.height/2, 0]));
    });
    // potions on each shelf
    const potionColors = [0x2a8a40, 0x8a2a40, 0x2a4a8a, 0x8a6a20, 0x6a2a8a, 0x8a4020];
    for (let s = 0; s < o.shelves; s++) {
        const sy = s * o.height / o.shelves + 0.03;
        const count = 3 + Math.floor(Math.random() * 3);
        for (let p = 0; p < count; p++) {
        const px = -o.width/2 + 0.06 + p * (o.width - 0.12) / count;
        const pc = pick(potionColors);
        // bottle body
        g.add(_cyl(0.018, 0.02, 0.06, M.glass(pc), [px, sy + 0.03, -o.depth*0.2], 6));
        // neck
        g.add(_cyl(0.008, 0.01, 0.03, M.glass(pc + 0x101010), [px, sy + 0.075, -o.depth*0.2], 5));
        // cork
        g.add(_cyl(0.009, 0.009, 0.01, M.wood(0x8a7050), [px, sy + 0.095, -o.depth*0.2], 5));
        }
    }
    return g;
    }, {
    icon: "🧪", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.7 },
        { key: "height", label: "Height", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.8 },
        { key: "depth", label: "Depth", type: "number", min: 0.1, max: 0.25, step: 0.02, default: 0.15 },
        { key: "shelves", label: "Shelves", type: "int", min: 2, max: 5, default: 3 },
        { key: "color", label: "Color", type: "color", default: 0x3a2010 },
    ],
    });

    register("runestone", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // main slab
    g.add(_box(o.width, o.height, o.thickness, st, [0, o.height/2, 0]));
    // base mound
    g.add(_box(o.width * 1.3, 0.12, o.thickness * 1.5, M.stone(o.color + 0x080808), [0, 0.06, 0]));
    // rune grooves (simplified as thin raised boxes)
    const rc = M.stone(o.runeColor);
    for (let i = 0; i < o.runes; i++) {
        const ry = o.height * (0.2 + (i / o.runes) * 0.6);
        const rx = rand(-o.width * 0.3, o.width * 0.3);
        const vertical = Math.random() > 0.4;
        if (vertical) {
        g.add(_box(0.015, rand(0.04, 0.1), 0.005, rc, [rx, ry, o.thickness/2 + 0.003]));
        } else {
        g.add(_box(rand(0.04, 0.08), 0.015, 0.005, rc, [rx, ry, o.thickness/2 + 0.003]));
        }
    }
    // glow
    if (o.glow > 0) {
        const l = new THREE.PointLight(o.runeColor, o.glow, 3, 1.5);
        l.position.set(0, o.height * 0.5, o.thickness);
        g.add(l);
    }
    return g;
    }, {
    icon: "🪨", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.4, max: 1.5, step: 0.1, default: 0.7 },
        { key: "height", label: "Height", type: "number", min: 0.6, max: 2.0, step: 0.1, default: 1.2 },
        { key: "thickness", label: "Depth", type: "number", min: 0.1, max: 0.3, step: 0.05, default: 0.15 },
        { key: "runes", label: "Runes", type: "int", min: 3, max: 15, default: 8 },
        { key: "color", label: "Stone", type: "color", default: 0x4a4a48 },
        { key: "runeColor", label: "Rune", type: "color", default: 0x40a0d0 },
        { key: "glow", label: "Glow", type: "number", min: 0, max: 2, step: 0.3, default: 0.5 },
    ],
    });

    register("suit_of_armor", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const rs = M.rust(o.color + 0x0a0a00);
    // helmet
    g.add(_sph(0.1, mt, [0, o.height - 0.1, 0], 8));
    g.add(_box(0.06, 0.03, 0.12, mt, [0, o.height - 0.14, 0.04])); // visor
    // plume
    g.add(_cyl(0.01, 0.005, 0.15, M.cloth(o.plumeColor), [0, o.height + 0.02, 0], 4));
    // gorget (neck guard)
    g.add(_cyl(0.07, 0.08, 0.04, mt, [0, o.height - 0.2, 0], 8));
    // breastplate
    g.add(_box(0.28, 0.3, 0.16, mt, [0, o.height - 0.38, 0]));
    // fauld (waist)
    g.add(_cyl(0.12, 0.14, 0.08, mt, [0, o.height - 0.56, 0], 8));
    // tassets (thigh guards)
    [-1,1].forEach(s => {
        g.add(_box(0.09, 0.15, 0.06, mt, [s * 0.08, o.height - 0.68, 0.02]));
    });
    // gauntlets
    [-1,1].forEach(s => {
        g.add(_box(0.06, 0.12, 0.05, mt, [s * 0.22, o.height - 0.48, 0]));
        // hand
        g.add(_box(0.04, 0.05, 0.04, mt, [s * 0.22, o.height - 0.55, 0]));
    });
    // greaves (shin guards)
    [-1,1].forEach(s => {
        g.add(_box(0.07, 0.3, 0.07, mt, [s * 0.07, 0.15, 0]));
    });
    // sabatons (feet)
    [-1,1].forEach(s => {
        g.add(_box(0.07, 0.04, 0.14, mt, [s * 0.07, 0.02, 0.03]));
    });
    // shield on back
    const shield = new THREE.Mesh(
        new THREE.CircleGeometry(0.15, 8),
        M.metal(o.shieldColor)
    );
    shield.position.set(0, o.height - 0.4, -0.1);
    g.add(shield);
    return g;
    }, {
    icon: "⚔️", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 1.5, max: 2.1, step: 0.1, default: 1.8 },
        { key: "color", label: "Metal", type: "color", default: 0x606060 },
        { key: "plumeColor", label: "Plume", type: "color", default: 0xcc2020 },
        { key: "shieldColor", label: "Shield", type: "color", default: 0x8a2020 },
    ],
    });

    register("pipe_organ", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const mt = M.metal(o.pipeColor);
    // cabinet
    g.add(_box(o.width, o.height * 0.45, o.depth, wd, [0, o.height * 0.225, 0]));
    // keyboard shelf
    g.add(_box(o.width * 0.8, 0.04, o.depth * 0.6, wd, [0, o.height * 0.28, o.depth * 0.3]));
    // keys (white)
    const keyCount = Math.floor(o.width * 8);
    for (let i = 0; i < keyCount; i++) {
        const kx = -o.width * 0.35 + i * (o.width * 0.7 / keyCount);
        g.add(_box(0.025, 0.01, 0.08, M.ceramic(0xf0f0e8), [kx, o.height * 0.29, o.depth * 0.35]));
    }
    // keys (black - every other pair)
    for (let i = 0; i < keyCount; i++) {
        if (i % 7 === 1 || i % 7 === 2 || i % 7 === 4 || i % 7 === 5 || i % 7 === 6) {
        const kx = -o.width * 0.35 + i * (o.width * 0.7 / keyCount) + 0.012;
        g.add(_box(0.015, 0.02, 0.05, M.wood(0x1a1a1a), [kx, o.height * 0.3, o.depth * 0.35]));
        }
    }
    // pipes
    const pipeCount = Math.floor(o.width / 0.06);
    for (let i = 0; i < pipeCount; i++) {
        const px = -o.width/2 + 0.05 + i * (o.width - 0.1) / pipeCount;
        const ph = o.height * (0.35 + 0.4 * (1 - Math.abs(i - pipeCount/2) / (pipeCount/2)));
        const pr = 0.015 + (1 - Math.abs(i - pipeCount/2) / (pipeCount/2)) * 0.015;
        g.add(_cyl(pr, pr + 0.005, ph, mt, [px, o.height * 0.45 + ph/2, -o.depth * 0.15], 6));
    }
    // decorative top
    g.add(_box(o.width + 0.04, 0.03, o.depth * 0.5, wd, [0, o.height * 0.45, -o.depth * 0.15]));
    return g;
    }, {
    icon: "🎵", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
        { key: "height", label: "Height", type: "number", min: 2.0, max: 5.0, step: 0.5, default: 3.5 },
        { key: "depth", label: "Depth", type: "number", min: 0.4, max: 0.8, step: 0.05, default: 0.6 },
        { key: "color", label: "Wood", type: "color", default: 0x2a1208 },
        { key: "pipeColor", label: "Pipes", type: "color", default: 0xa8a090 },
    ],
    });

    register("alchemy_table", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const mt = M.metal(0x2a2520);
    // table
    g.add(_box(o.width, 0.03, o.depth, wd, [0, o.height, 0]));
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_box(0.04, o.height, 0.04, wd, [sx*(o.width/2-0.04), o.height/2, sz*(o.depth/2-0.04)]));
    });
    // shelf below
    g.add(_box(o.width - 0.06, 0.015, o.depth - 0.06, wd, [0, o.height * 0.4, 0]));
    // mortar & pestle
    g.add(_cyl(0.04, 0.035, 0.05, M.stone(0x5a5a50), [o.width*0.2, o.height + 0.025, 0], 8));
    g.add(_cyl(0.01, 0.005, 0.08, M.stone(0x6a6a60), [o.width*0.2, o.height + 0.07, 0.01], 5));
    // retort flask
    g.add(_sph(0.05, M.glass(0x40a060), [-o.width*0.15, o.height + 0.06, -o.depth*0.1], 8));
    g.add(_cyl(0.012, 0.015, 0.06, M.glass(0x40a060), [-o.width*0.15, o.height + 0.11, -o.depth*0.1], 5));
    // burner
    g.add(_cyl(0.025, 0.03, 0.04, mt, [0, o.height + 0.02, o.depth*0.15], 6));
    // small flame
    g.add(_cone(0.008, 0.03, M.wax(0xff8020), [0, o.height + 0.055, o.depth*0.15], 5));
    // book open
    g.add(_box(0.12, 0.015, 0.08, M.book(0x2a1a30), [-o.width*0.25, o.height + 0.01, o.depth*0.1]));
    // scroll
    g.add(_cyl(0.012, 0.012, 0.15, M.wax(0xd8c8a0), [o.width*0.3, o.height + 0.012, 0], 6));
    // bottles on lower shelf
    const bottleColors = [0x8a2040, 0x20408a, 0x208a40];
    for (let i = 0; i < 3; i++) {
        const bx = -o.width*0.2 + i * 0.12;
        g.add(_cyl(0.02, 0.025, 0.06, M.glass(bottleColors[i]), [bx, o.height*0.4 + 0.03, 0], 6));
    }
    return g;
    }, {
    icon: "⚗️", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.7, max: 1.4, step: 0.1, default: 1.0 },
        { key: "height", label: "Height", type: "number", min: 0.65, max: 0.9, step: 0.05, default: 0.75 },
        { key: "depth", label: "Depth", type: "number", min: 0.35, max: 0.6, step: 0.05, default: 0.5 },
        { key: "color", label: "Color", type: "color", default: 0x3a2010 },
    ],
    });

    register("magic_circle", function (o) {
    const g = new THREE.Group();
    const mt = new THREE.MeshStandardMaterial({
        color: o.color, emissive: o.color, emissiveIntensity: o.intensity,
        roughness: 0.3, metalness: 0.5, side: THREE.DoubleSide,
    });
    // outer ring
    g.add(_tor(o.radius, 0.015, mt, [0, 0.01, 0], 6, 32));
    // inner ring
    g.add(_tor(o.radius * 0.7, 0.01, mt, [0, 0.01, 0], 6, 24));
    // inner ring 2
    g.add(_tor(o.radius * 0.4, 0.008, mt, [0, 0.01, 0], 5, 18));
    // cross lines
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const line = new THREE.Mesh(
        new THREE.PlaneGeometry(o.radius * 1.8, 0.008),
        mt
        );
        line.rotation.x = -Math.PI/2;
        line.rotation.z = a;
        line.position.y = 0.01;
        g.add(line);
    }
    // rune symbols (small boxes)
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const rx = Math.sin(a) * o.radius * 0.85;
        const rz = Math.cos(a) * o.radius * 0.85;
        const rune = _box(0.03, 0.005, 0.03, mt, [rx, 0.01, rz]);
        rune.rotation.y = a;
        g.add(rune);
    }
    // center symbol
    const center = new THREE.Mesh(
        new THREE.CircleGeometry(o.radius * 0.15, 6),
        mt
    );
    center.rotation.x = -Math.PI/2;
    center.position.y = 0.012;
    g.add(center);
    // glow light
    if (o.glow > 0) {
        const l = new THREE.PointLight(o.color, o.glow, o.radius * 4, 1.5);
        l.position.y = 0.3;
        g.add(l);
    }
    return g;
    }, {
    icon: "✨", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.5, max: 3.0, step: 0.25, default: 1.2 },
        { key: "color", label: "Color", type: "color", default: 0x6040ff },
        { key: "intensity", label: "Emissive", type: "number", min: 0.1, max: 1.0, step: 0.1, default: 0.4 },
        { key: "glow", label: "Light", type: "number", min: 0, max: 3, step: 0.5, default: 1.0 },
    ],
    });

    register("dragon_skull", function (o) {
    const g = new THREE.Group();
    const bk = M.stone(o.color);
    // cranium
    g.add(_sph(o.scale * 0.25, bk, [0, o.scale * 0.2, 0], 8));
    // snout
    g.add(_box(o.scale * 0.12, o.scale * 0.1, o.scale * 0.3, bk, [0, o.scale * 0.12, o.scale * 0.22]));
    // eye sockets
    [-1,1].forEach(s => {
        g.add(_sph(o.scale * 0.04, M.stone(0x0a0a0a), [s * o.scale * 0.1, o.scale * 0.2, o.scale * 0.08], 5));
    });
    // horns
    [-1,1].forEach(s => {
        const horn = _cone(o.scale * 0.04, o.scale * 0.2, M.bone(0xd8c8a0), [s * o.scale * 0.15, o.scale * 0.38, -o.scale * 0.05]);
        horn.rotation.z = s * 0.4;
        horn.rotation.x = -0.3;
        g.add(horn);
    });
    // teeth
    for (let i = 0; i < 6; i++) {
        const tx = -o.scale * 0.08 + i * o.scale * 0.03;
        // upper
        g.add(_cone(o.scale * 0.008, o.scale * 0.03, M.bone(0xe8dcc8), [tx, o.scale * 0.06, o.scale * 0.3 + i*0.01], 4));
        // lower
        g.add(_cone(o.scale * 0.008, o.scale * 0.025, M.bone(0xe8dcc8), [tx, o.scale * 0.06, o.scale * 0.3 + i*0.01], 4));
    }
    // jaw
    g.add(_box(o.scale * 0.14, o.scale * 0.03, o.scale * 0.25, bk, [0, o.scale * 0.03, o.scale * 0.2]));
    // neck vertebrae
    for (let i = 0; i < 4; i++) {
        g.add(_sph(o.scale * 0.06, bk, [0, o.scale * 0.15 - i * 0.04, -o.scale * 0.15 - i * 0.06], 5));
    }
    return g;
    }, {
    icon: "🐉", category: "z_ai",
    params: [
        { key: "scale", label: "Scale", type: "number", min: 0.3, max: 2.0, step: 0.1, default: 0.8 },
        { key: "color", label: "Bone", type: "color", default: 0x8a8070 },
    ],
    });

    register("hammock", function (o) {
    const g = new THREE.Group();
    const rp = M.rope(o.color);
    const cl = M.cloth(o.clothColor);
    // two posts
    [-1,1].forEach(s => {
        g.add(_cyl(0.04, 0.05, o.height, M.wood(0x4a3a20), [s * o.length/2, o.height/2, 0], 6));
        // rope attachment
        g.add(_cyl(0.008, 0.008, 0.04, rp, [s * o.length/2, o.height * 0.75, 0], 4));
    });
    // cloth body (sagging plane)
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(o.length * 0.85, o.width), cl);
    cloth.position.set(0, o.height * 0.55, 0);
    cloth.rotation.x = -0.15; // slight sag
    g.add(cloth);
    // ropes
    [-1,1].forEach(s => {
        const rope = _cyl(0.006, 0.006, o.height * 0.2, rp);
        rope.position.set(s * o.length/2, o.height * 0.65, 0);
        rope.rotation.z = s * 0.4;
        g.add(rope);
    });
    // side ropes (catenary hint)
    [-1,1].forEach(s => {
        g.add(_cyl(0.004, 0.004, o.length * 0.45, rp, [0, o.height * 0.55, s * o.width/2], 4));
    });
    return g;
    }, {
    icon: "🪢", category: "z_ai",
    params: [
        { key: "length", label: "Length", type: "number", min: 1.5, max: 3.5, step: 0.2, default: 2.5 },
        { key: "width", label: "Width", type: "number", min: 0.5, max: 1.2, step: 0.1, default: 0.8 },
        { key: "height", label: "Post H", type: "number", min: 1.2, max: 2.2, step: 0.1, default: 1.6 },
        { key: "color", label: "Rope", type: "color", default: 0x8a7a60 },
        { key: "clothColor", label: "Cloth", type: "color", default: 0xf0e8d0 },
    ],
    });

    register("spinning_wheel", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const mt = M.metal(0x3a3530);
    // base legs (A-frame)
    g.add(_box(0.5, 0.03, 0.04, wd, [0, 0.35, 0.15]));
    g.add(_box(0.5, 0.03, 0.04, wd, [0, 0.35, -0.15]));
    // legs
    [[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]].forEach(([x, z]) => {
        g.add(_box(0.03, 0.35, 0.03, wd, [x, 0.175, z]));
    });
    // seat
    g.add(_box(0.25, 0.03, 0.2, wd, [0.15, 0.37, 0]));
    // main wheel
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(o.wheelR, 0.012, 6, 24), wd);
    wheel.position.set(-0.15, 0.6, 0);
    g.add(wheel);
    // spokes
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spoke = _cyl(0.004, 0.004, o.wheelR * 1.9, wd, [-0.15, 0.6, 0], 4);
        spoke.rotation.x = Math.PI/2;
        spoke.rotation.z = a;
        g.add(spoke);
    }
    // axle
    g.add(_cyl(0.01, 0.01, 0.04, mt, [-0.15, 0.6, 0], 6));
    // drive wheel post
    g.add(_box(0.03, 0.5, 0.03, wd, [-0.15, 0.5, 0]));
    // flyer assembly
    g.add(_box(0.03, 0.2, 0.03, wd, [0.1, 0.55, 0]));
    // treadle
    g.add(_box(0.25, 0.02, 0.08, wd, [0.1, 0.05, 0]));
    // treadle rod
    g.add(_cyl(0.004, 0.004, 0.5, mt, [0.02, 0.3, 0], 4));
    // thread
    g.add(_cyl(0.002, 0.002, 0.3, M.cloth(0xf0e8d0), [0.0, 0.65, 0], 3));
    return g;
    }, {
    icon: "🧵", category: "z_ai",
    params: [
        { key: "wheelR", label: "Wheel R", type: "number", min: 0.12, max: 0.3, step: 0.02, default: 0.2 },
        { key: "color", label: "Color", type: "color", default: 0x5a3820 },
    ],
    });

    register("water_basin", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // pedestal
    g.add(_cyl(o.radius * 0.3, o.radius * 0.4, o.height * 0.6, st, [0, o.height * 0.3, 0], 8));
    // base
    g.add(_cyl(o.radius * 0.5, o.radius * 0.45, 0.05, st, [0, 0.025, 0], 10));
    // basin
    g.add(_cyl(o.radius, o.radius * 0.7, o.radius * 0.35, st, [0, o.height * 0.65, 0], 14));
    // inner basin (depression)
    g.add(_cyl(o.radius * 0.85, o.radius * 0.85, 0.01, M.glass(0x6088a8),
        [0, o.height * 0.65 + o.radius * 0.16, 0], 14));
    // rim detail
    g.add(_tor(o.radius + 0.005, 0.012, st, [0, o.height * 0.65 + o.radius * 0.3, 0], 6, 16));
    return g;
    }, {
    icon: "🫗", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.5, step: 0.03, default: 0.25 },
        { key: "height", label: "Height", type: "number", min: 0.4, max: 1.0, step: 0.05, default: 0.7 },
        { key: "color", label: "Color", type: "color", default: 0x8a8078 },
    ],
    });

    register("treasure_map", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const pm = M.wax(o.mapColor);
    // table surface
    g.add(_box(0.4, 0.03, 0.3, wd, [0, 0.35, 0]));
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_box(0.03, 0.35, 0.03, wd, [sx*0.17, 0.175, sz*0.12]));
    });
    // map scroll (unrolled)
    const map = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), pm);
    map.position.set(0, 0.37, 0);
    map.rotation.x = -Math.PI/2;
    g.add(map);
    // map markings (X marks the spot)
    g.add(_box(0.04, 0.002, 0.004, M.cloth(0x8a2020), [0.05, 0.372, -0.03]));
    g.add(_box(0.004, 0.002, 0.04, M.cloth(0x8a2020), [0.05, 0.372, -0.03]));
    // scroll roll at top
    g.add(_cyl(0.012, 0.012, 0.25, M.wax(0xc8b888), [0, 0.38, -0.11], 6));
    // compass rose
    g.add(_cone(0.01, 0.02, M.cloth(0x2a2a20), [-0.08, 0.372, 0.04], 4));
    // coin weights
    g.add(_cyl(0.015, 0.015, 0.005, M.brass(), [0.12, 0.375, 0.05], 8));
    g.add(_cyl(0.015, 0.015, 0.005, M.brass(), [-0.1, 0.375, -0.06], 8));
    return g;
    }, {
    icon: "🗺️", category: "z_ai",
    params: [
        { key: "color", label: "Wood", type: "color", default: 0x4a3020 },
        { key: "mapColor", label: "Parchment", type: "color", default: 0xd8c890 },
    ],
    });

    register("cemetery_gate", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const rs = M.rust(o.color + 0x1a0a00);
    // posts
    [-1,1].forEach(s => {
        g.add(_box(o.postW, o.height, o.postW, mt, [s * (o.span/2 + o.postW/2), o.height/2, 0]));
        // post top spike
        g.add(_cone(o.postW * 0.4, 0.1, mt, [s * (o.span/2 + o.postW/2), o.height + 0.05, 0]));
    });
    // gate bars
    const bars = Math.max(4, Math.floor(o.span / 0.08));
    for (let i = 0; i < bars; i++) {
        const x = -o.span/2 + (i + 0.5) * o.span / bars;
        g.add(_cyl(0.008, 0.008, o.height * 0.9, rs, [x, o.height * 0.45, 0], 4));
        // spear tip
        g.add(_cone(0.008, 0.025, rs, [x, o.height * 0.9 + 0.012, 0], 4));
    }
    // horizontal rails
    g.add(_cyl(0.01, 0.01, o.span, rs, [0, o.height * 0.85, 0], 4));
    g.add(_cyl(0.01, 0.01, o.span, rs, [0, o.height * 0.35, 0], 4));
    g.add(_cyl(0.01, 0.01, o.span, rs, [0, o.height * 0.15, 0], 4));
    // scrollwork (simplified torus at top)
    g.add(_tor(o.span * 0.15, 0.008, rs, [0, o.height * 0.78, 0.01], 5, 12));
    return g;
    }, {
    icon: "⚰️", category: "z_ai",
    params: [
        { key: "span", label: "Span", type: "number", min: 1.0, max: 3.5, step: 0.25, default: 2.0 },
        { key: "height", label: "Height", type: "number", min: 1.2, max: 3.0, step: 0.2, default: 2.0 },
        { key: "postW", label: "Post W", type: "number", min: 0.08, max: 0.2, step: 0.02, default: 0.1 },
        { key: "color", label: "Metal", type: "color", default: 0x1a1a18 },
    ],
    });

    register("market_awning", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.frameColor);
    const cl = M.cloth(o.clothColor);
    // posts
    for (let i = 0; i < 4; i++) {
        const x = -o.width/2 + i * o.width/3;
        g.add(_cyl(0.035, 0.04, o.height, wd, [x, o.height/2, 0], 6));
    }
    // cross beam
    g.add(_cyl(0.02, 0.02, o.width, wd, [0, o.height, 0], 6));
    // awning cloth (angled)
    const awning = new THREE.Mesh(new THREE.PlaneGeometry(o.width + 0.1, o.depth), cl);
    awning.position.set(0, o.height - 0.02, o.depth * 0.35);
    awning.rotation.x = -0.2;
    g.add(awning);
    // scalloped edge (small triangles)
    for (let i = 0; i < 8; i++) {
        const ex = -o.width/2 + i * o.width/7;
        g.add(_cone(0.04, 0.06, cl, [ex, o.height - 0.08, o.depth * 0.7], 3));
    }
    // front rail
    g.add(_cyl(0.01, 0.01, o.width, wd, [0, o.height - 0.1, o.depth * 0.7], 6));
    // counter/shelf
    g.add(_box(o.width, 0.03, 0.3, wd, [0, o.height * 0.55, o.depth * 0.2]));
    return g;
    }, {
    icon: "🏪", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 1.5, max: 4.0, step: 0.25, default: 2.5 },
        { key: "depth", label: "Depth", type: "number", min: 0.8, max: 2.0, step: 0.1, default: 1.2 },
        { key: "height", label: "Height", type: "number", min: 2.0, max: 3.5, step: 0.25, default: 2.5 },
        { key: "frameColor", label: "Frame", type: "color", default: 0x4a3020 },
        { key: "clothColor", label: "Cloth", type: "color", default: 0xc83030 },
    ],
    });

    register("obelisk", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    // base steps
    for (let i = 0; i < 3; i++) {
        const s = 1 - i * 0.12;
        const h = 0.06;
        g.add(_box(o.baseW * s, h, o.baseW * s, st, [0, i * h + h/2, 0]));
    }
    // shaft
    const baseY = 0.18;
    const shaftH = o.height - 0.18 - 0.15;
    g.add(_box(o.baseW * 0.5, shaftH, o.baseW * 0.5, st, [0, baseY + shaftH/2, 0]));
    // taper
    g.add(_box(o.baseW * 0.45, shaftH * 0.3, o.baseW * 0.45, st, [0, baseY + shaftH * 0.85, 0]));
    // pyramidion (top)
    g.add(_cone(o.baseW * 0.25, 0.15, M.stone(o.color + 0x101010), [0, o.height - 0.075, 0], 4));
    // hieroglyph marks
    const hc = M.stone(o.hieroglyphColor);
    for (let i = 0; i < o.symbols; i++) {
        const y = baseY + 0.2 + i * (shaftH - 0.4) / o.symbols;
        const face = i % 4;
        const rx = [0, 0, o.baseW*0.26, -o.baseW*0.26][face];
        const rz = [o.baseW*0.26, -o.baseW*0.26, 0, 0][face];
        g.add(_box(0.03, 0.04, 0.003, hc, [rx, y, rz]));
    }
    return g;
    }, {
    icon: "🏛️", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 1.5, max: 6.0, step: 0.5, default: 3.5 },
        { key: "baseW", label: "Base W", type: "number", min: 0.3, max: 1.0, step: 0.05, default: 0.5 },
        { key: "symbols", label: "Symbols", type: "int", min: 2, max: 12, default: 6 },
        { key: "color", label: "Stone", type: "color", default: 0x9a9080 },
        { key: "hieroglyphColor", label: "Glyphs", type: "color", default: 0x6a5a40 },
    ],
    });

    register("wine_press", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const mt = M.metal(0x2a2520);
    // base vat
    g.add(_cyl(o.radius, o.radius * 1.1, o.vatH, wd, [0, o.vatH/2, 0], 10));
    // base planks
    g.add(_box(o.radius * 2.4, 0.05, o.radius * 2.4, wd, [0, 0.025, 0]));
    // screw post
    g.add(_cyl(0.04, 0.04, o.height, mt, [0, o.height/2, 0], 6));
    // screw thread (simplified rings)
    for (let i = 0; i < 8; i++) {
        const y = 0.3 + i * (o.height - 0.5) / 8;
        g.add(_tor(0.055, 0.008, mt, [0, y, 0], 4, 10));
    }
    // cross handle
    g.add(_cyl(0.02, 0.02, o.radius * 1.8, wd, [0, o.height, 0], 6));
    // pressing plate
    g.add(_cyl(o.radius * 0.85, o.radius * 0.85, 0.04, wd, [0, o.vatH + 0.1, 0], 10));
    // juice spout
    g.add(_cyl(0.02, 0.025, 0.12, wd, [o.radius + 0.04, o.vatH * 0.3, 0], 5));
    // bucket
    g.add(_cyl(0.06, 0.05, 0.1, wd, [o.radius + 0.12, 0.05, 0], 8));
    // grape stains
    g.add(_sph(0.01, M.cloth(0x5a1030), [0.03, 0.01, o.radius * 0.5], 4));
    return g;
    }, {
    icon: "🍇", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
        { key: "vatH", label: "Vat H", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
        { key: "height", label: "Screw H", type: "number", min: 1.0, max: 2.5, step: 0.1, default: 1.6 },
        { key: "color", label: "Wood", type: "color", default: 0x5a3820 },
    ],
    });

    register("potion_bottle", function (o) {
    const g = new THREE.Group();
    const colors = [0x2a8a40, 0x8a2a40, 0x2a4a8a, 0x8a6a20, 0x6a2a8a, 0x40a0a0];
    const pc = o.color || pick(colors);
    const gl = M.glass(pc);
    // body
    g.add(_cyl(o.radius, o.radius * 0.8, o.height * 0.55, gl, [0, o.height * 0.275, 0], 8));
    // shoulder
    g.add(_cyl(o.radius * 0.4, o.radius, o.height * 0.1, gl, [0, o.height * 0.6, 0], 8));
    // neck
    g.add(_cyl(o.radius * 0.25, o.radius * 0.35, o.height * 0.2, gl, [0, o.height * 0.75, 0], 6));
    // cork
    g.add(_cyl(o.radius * 0.28, o.radius * 0.3, o.height * 0.06, M.wood(0x8a7050), [0, o.height * 0.88, 0], 6));
    // liquid inside glow
    if (o.glow > 0) {
        const l = new THREE.PointLight(pc, o.glow, 2, 1.8);
        l.position.set(0, o.height * 0.3, 0);
        g.add(l);
    }
    return g;
    }, {
    icon: "🧪", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 0.1, max: 0.35, step: 0.02, default: 0.18 },
        { key: "radius", label: "Radius", type: "number", min: 0.02, max: 0.06, step: 0.005, default: 0.035 },
        { key: "color", label: "Color", type: "color", default: 0x2a8a40 },
        { key: "glow", label: "Glow", type: "number", min: 0, max: 1, step: 0.2, default: 0.3 },
    ],
    });

    register("crystal_shard", function (o) {
    const g = new THREE.Group();
    const crMat = new THREE.MeshStandardMaterial({
        color: o.color, roughness: 0.08, metalness: 0.15,
        transparent: true, opacity: 0.7, side: THREE.DoubleSide,
    });
    // main crystal
    const main = new THREE.Mesh(new THREE.ConeGeometry(o.radius, o.height, 6), crMat);
    main.position.y = o.height / 2;
    g.add(main);
    // secondary crystals
    for (let i = 0; i < o.shards - 1; i++) {
        const a = (i / (o.shards - 1)) * Math.PI * 2;
        const sr = o.radius * (0.3 + Math.random() * 0.4);
        const sh = o.height * (0.3 + Math.random() * 0.5);
        const shard = new THREE.Mesh(new THREE.ConeGeometry(sr, sh, 5), crMat);
        shard.position.set(Math.sin(a) * o.radius * 0.8, sh * 0.3, Math.cos(a) * o.radius * 0.8);
        shard.rotation.z = Math.sin(a) * 0.3;
        shard.rotation.x = Math.cos(a) * 0.3;
        g.add(shard);
    }
    // base rock
    g.add(_sph(o.radius * 1.2, M.stone(0x3a3a38), [0, 0.05, 0], 5));
    // glow
    if (o.glow > 0) {
        const l = new THREE.PointLight(o.color, o.glow, 4, 1.5);
        l.position.set(0, o.height * 0.5, 0);
        g.add(l);
    }
    return g;
    }, {
    icon: "💎", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.7 },
        { key: "radius", label: "Radius", type: "number", min: 0.05, max: 0.25, step: 0.02, default: 0.1 },
        { key: "shards", label: "Shards", type: "int", min: 1, max: 6, default: 3 },
        { key: "color", label: "Color", type: "color", default: 0x4080ff },
        { key: "glow", label: "Glow", type: "number", min: 0, max: 2, step: 0.3, default: 0.6 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  KITCHEN / DINING
    // ═══════════════════════════════════════════════════════════

    register("cast_iron_stove", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const rst = M.rust(o.color + 0x0a0500);
    // body
    g.add(_box(o.width, o.height, o.depth, mt, [0, o.height/2, 0]));
    // top plate
    g.add(_box(o.width + 0.02, 0.03, o.depth + 0.02, mt, [0, o.height + 0.015, 0]));
    // burner rings
    for (let i = 0; i < 2; i++) {
        const rx = -o.width/4 + i * o.width/2;
        g.add(_tor(0.06, 0.008, mt, [rx, o.height + 0.035, 0], 6, 12));
    }
    // oven door
    g.add(_box(o.width * 0.6, o.height * 0.4, 0.015, rst, [0, o.height * 0.3, o.depth/2 + 0.005]));
    // door window
    const win = new THREE.Mesh(new THREE.PlaneGeometry(o.width*0.4, o.height*0.25), M.glass(0x1a1008));
    win.position.set(0, o.height * 0.3, o.depth/2 + 0.015);
    g.add(win);
    // chimney
    g.add(_cyl(0.06, 0.07, o.chimneyH, mt, [0, o.height + o.chimneyH/2, -o.depth/3], 8));
    // legs
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_box(0.04, 0.1, 0.04, mt, [sx*(o.width/2-0.04), 0.05, sz*(o.depth/2-0.04)]));
    });
    return g;
    }, {
    icon: "🔥", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.5, max: 1.2, step: 0.1, default: 0.7 },
        { key: "height", label: "Height", type: "number", min: 0.6, max: 1.0, step: 0.05, default: 0.8 },
        { key: "depth", label: "Depth", type: "number", min: 0.4, max: 0.8, step: 0.05, default: 0.6 },
        { key: "chimneyH", label: "Chimney", type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.8 },
        { key: "color", label: "Metal", type: "color", default: 0x1a1a18 },
    ],
    });

    register("pot_rack", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const wd = M.wood(o.color + 0x2a1a10);
    // frame
    g.add(_box(o.width, 0.03, o.depth, mt, [0, 0, 0]));
    // hanging chains
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_cyl(0.005, 0.005, o.hangH, mt, [sx*(o.width/2-0.05), o.hangH/2, sz*(o.depth/2-0.05)], 4));
    });
    // ceiling mount
    g.add(_box(o.width + 0.1, 0.02, o.depth + 0.1, mt, [0, o.hangH, 0]));
    // pots
    for (let i = 0; i < o.pots; i++) {
        const px = -o.width/2 + 0.15 + i * (o.width - 0.3) / (o.pots - 1 || 1);
        g.add(_cyl(0.06, 0.05, 0.08, mt, [px, -0.06, 0], 8));
        g.add(_cyl(0.065, 0.065, 0.01, mt, [px, -0.015, 0], 8)); // rim
        g.add(_cyl(0.005, 0.005, 0.12, wd, [px, -0.1, 0.06], 4)); // handle
    }
    return g;
    }, {
    icon: "🍳", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 1.0 },
        { key: "depth", label: "Depth", type: "number", min: 0.2, max: 0.5, step: 0.05, default: 0.3 },
        { key: "hangH", label: "Hang H", type: "number", min: 0.3, max: 1.0, step: 0.1, default: 0.6 },
        { key: "pots", label: "Pots", type: "int", min: 2, max: 6, default: 4 },
        { key: "color", label: "Metal", type: "color", default: 0x2a2520 },
    ],
    });

    register("wine_keg", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const mt = M.metal(o.bandColor);
    // body
    g.add(_cyl(o.radius, o.radius * 0.85, o.length, wd, [0, o.radius, 0], 12));
    // bands
    for (let i = 0; i < 4; i++) {
        const z = -o.length/2 + 0.1 + i * (o.length - 0.2) / 3;
        g.add(_tor(o.radius + 0.005, 0.008, mt, [0, o.radius, z], 6, 12));
    }
    // spigot
    g.add(_cyl(0.012, 0.015, 0.08, mt, [o.radius + 0.04, o.radius * 0.7, 0.1], 6));
    g.add(_cyl(0.01, 0.01, 0.04, mt, [o.radius + 0.04, o.radius * 0.7, 0.14], 4)); // handle
    // stand
    g.add(_box(o.length * 0.8, 0.04, o.radius, wd, [0, 0.02, 0]));
    g.add(_box(0.06, o.radius * 0.6, 0.06, wd, [-o.length*0.3, o.radius * 0.3, o.radius*0.35]));
    g.add(_box(0.06, o.radius * 0.6, 0.06, wd, [o.length*0.3, o.radius * 0.3, o.radius*0.35]));
    return g;
    }, {
    icon: "🍷", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
        { key: "length", label: "Length", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.9 },
        { key: "color", label: "Wood", type: "color", default: 0x5a3020 },
        { key: "bandColor", label: "Bands", type: "color", default: 0x4a4038 },
    ],
    });

    register("spice_rack", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // back
    g.add(_box(o.width, o.height, 0.015, wd, [0, o.height/2, 0]));
    // shelves
    for (let i = 0; i <= o.shelves; i++) {
        const y = i * o.height / o.shelves;
        g.add(_box(o.width, 0.012, o.depth, wd, [0, y, o.depth/2]));
    }
    // sides
    [-1,1].forEach(s => {
        g.add(_box(0.012, o.height, o.depth, wd, [s*(o.width/2), o.height/2, o.depth/2]));
    });
    // jars
    const spices = [0x8a4a20, 0x2a5a20, 0x8a2020, 0xc8a040, 0x6a3a10, 0xf0e0a0];
    for (let s = 0; s < o.shelves; s++) {
        const sy = s * o.height / o.shelves + 0.025;
        const jars = 3 + Math.floor(Math.random() * 2);
        for (let j = 0; j < jars; j++) {
        const jx = -o.width/2 + 0.04 + j * (o.width - 0.08) / jars;
        const sc = pick(spices);
        g.add(_cyl(0.015, 0.015, 0.04, M.glass(sc), [jx, sy + 0.02, o.depth * 0.4], 6));
        g.add(_cyl(0.012, 0.013, 0.015, M.wood(0x3a2a18), [jx, sy + 0.047, o.depth * 0.4], 5)); // lid
        }
    }
    return g;
    }, {
    icon: "🧂", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
        { key: "height", label: "Height", type: "number", min: 0.3, max: 1.0, step: 0.05, default: 0.6 },
        { key: "depth", label: "Depth", type: "number", min: 0.05, max: 0.15, step: 0.01, default: 0.08 },
        { key: "shelves", label: "Shelves", type: "int", min: 2, max: 5, default: 3 },
        { key: "color", label: "Wood", type: "color", default: 0x3a2010 },
    ],
    });

    register("ice_box", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const zn = M.metal(0xa0a098); // zinc lining
    // body
    g.add(_box(o.width, o.height, o.depth, wd, [0, o.height/2, 0]));
    // zinc top
    g.add(_box(o.width + 0.01, 0.02, o.depth + 0.01, zn, [0, o.height + 0.01, 0]));
    // door
    g.add(_box(o.width - 0.06, o.height * 0.7, 0.015, M.wood(o.color + 0x080808), 
        [0, o.height * 0.35, o.depth/2 + 0.005]));
    // handle
    g.add(_cyl(0.01, 0.01, o.width * 0.3, M.brass(), [0, o.height * 0.55, o.depth/2 + 0.02], 6));
    // legs
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        g.add(_box(0.04, 0.12, 0.04, wd, [sx*(o.width/2-0.04), 0.06, sz*(o.depth/2-0.04)]));
    });
    return g;
    }, {
    icon: "🧊", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.5, max: 1.0, step: 0.05, default: 0.7 },
        { key: "height", label: "Height", type: "number", min: 0.7, max: 1.1, step: 0.05, default: 0.9 },
        { key: "depth", label: "Depth", type: "number", min: 0.4, max: 0.7, step: 0.05, default: 0.55 },
        { key: "color", label: "Wood", type: "color", default: 0x5a4030 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  BATHROOM / UTILITY
    // ═══════════════════════════════════════════════════════════

    register("clawfoot_tub", function (o) {
    const g = new THREE.Group();
    const cr = M.ceramic(o.color);
    const mt = M.metal(o.footColor);
    // main body
    g.add(_box(o.width, o.height * 0.5, o.depth, cr, [0, o.height * 0.35, 0]));
    // curved ends (half cylinders)
    g.add(_cyl(o.depth/2, o.depth/2, o.height * 0.5, cr, [-o.width/2, o.height * 0.35, 0], 12));
    g.add(_cyl(o.depth/2, o.depth/2, o.height * 0.5, cr, [o.width/2, o.height * 0.35, 0], 12));
    // rim
    g.add(_box(o.width + o.depth, 0.03, o.depth + 0.02, cr, [0, o.height * 0.6, 0]));
    // inner hollow (darker)
    g.add(_box(o.width - 0.06, o.height * 0.42, o.depth - 0.06, M.ceramic(o.color + 0x0a0a0a), 
        [0, o.height * 0.36, 0]));
    // water surface
    g.add(_box(o.width - 0.08, 0.005, o.depth - 0.08, M.glass(0x6090c0), [0, o.height * 0.5, 0]));
    // feet (4 claw feet)
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
        const fx = sx * (o.width/2 - 0.05);
        const fz = sz * (o.depth/2 - 0.05);
        g.add(_cyl(0.025, 0.03, 0.12, mt, [fx, 0.06, fz], 6));
        g.add(_sph(0.02, mt, [fx, 0.01, fz], 5));
    });
    // faucet
    g.add(_cyl(0.015, 0.015, 0.1, M.brass(), [0, o.height * 0.6, o.depth/2 - 0.02], 6));
    const spout = _tor(0.04, 0.007, M.brass(), [0, o.height * 0.65, o.depth/2 - 0.02], 6, 8);
    spout.rotation.x = Math.PI/2;
    g.add(spout);
    return g;
    }, {
    icon: "🛁", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 1.0, max: 1.8, step: 0.1, default: 1.5 },
        { key: "height", label: "Height", type: "number", min: 0.5, max: 0.8, step: 0.05, default: 0.6 },
        { key: "depth", label: "Depth", type: "number", min: 0.5, max: 0.8, step: 0.05, default: 0.7 },
        { key: "color", label: "Tub", type: "color", default: 0xf0f0f0 },
        { key: "footColor", label: "Feet", type: "color", default: 0xd4af37 },
    ],
    });

    register("water_pump", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const rs = M.rust(o.color + 0x0a0800);
    // base
    g.add(_cyl(0.08, 0.1, 0.05, mt, [0, 0.025, 0], 8));
    // main cylinder
    g.add(_cyl(0.035, 0.04, o.height * 0.6, mt, [0, o.height * 0.3 + 0.05, 0], 8));
    // spout
    g.add(_cyl(0.02, 0.025, 0.12, mt, [0.08, o.height * 0.5, 0], 6));
    // handle pivot
    g.add(_cyl(0.01, 0.01, 0.04, mt, [0, o.height * 0.65, 0.02], 6));
    // handle
    const handle = _box(0.3, 0.02, 0.02, M.wood(0x4a3a20), [-0.1, o.height * 0.68, 0]);
    handle.rotation.z = -0.15;
    g.add(handle);
    // handle grip
    g.add(_cyl(0.015, 0.015, 0.06, M.wood(0x4a3a20), [-0.24, o.height * 0.7, 0], 6));
    // basin stone
    g.add(_box(0.25, 0.06, 0.2, M.stone(0x6a6a60), [0.12, 0.03, 0]));
    return g;
    }, {
    icon: "🚰", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 0.6, max: 1.2, step: 0.05, default: 0.8 },
        { key: "color", label: "Metal", type: "color", default: 0x1a1818 },
    ],
    });

    register("mannequin", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // stand base
    g.add(_cyl(0.2, 0.22, 0.03, wd, [0, 0.015, 0], 10));
    // stand pole
    g.add(_cyl(0.02, 0.02, o.height * 0.45, M.metal(), [0, o.height * 0.225, 0], 6));
    // torso
    g.add(_cyl(o.shoulderW, o.waistW, o.height * 0.3, wd, [0, o.height * 0.65, 0], 8));
    // neck
    g.add(_cyl(0.035, 0.035, 0.06, wd, [0, o.height * 0.82, 0], 6));
    // head pole
    g.add(_cyl(0.015, 0.015, 0.08, M.metal(), [0, o.height * 0.88, 0], 4));
    // hips
    g.add(_cyl(o.waistW * 1.1, o.shoulderW * 0.8, o.height * 0.08, wd, [0, o.height * 0.47, 0], 8));
    return g;
    }, {
    icon: "🧍", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 1.2, max: 1.8, step: 0.05, default: 1.5 },
        { key: "shoulderW", label: "Shoulder", type: "number", min: 0.12, max: 0.22, step: 0.01, default: 0.16 },
        { key: "waistW", label: "Waist", type: "number", min: 0.06, max: 0.14, step: 0.01, default: 0.1 },
        { key: "color", label: "Wood", type: "color", default: 0xc8b898 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  MUSIC / ENTERTAINMENT
    // ═══════════════════════════════════════════════════════════

    register("harp", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const mt = M.metal(0xc0c0b0); // strings
    // column (front pillar)
    g.add(_cyl(0.025, 0.03, o.height, wd, [0, o.height/2, 0], 6));
    // neck (curved top - simplified with angled cylinder)
    const neck = _cyl(0.02, 0.02, o.width * 1.1, wd, [o.width*0.45, o.height - 0.05, 0], 6);
    neck.rotation.z = 0.3;
    g.add(neck);
    // soundboard (back pillar/box)
    g.add(_box(0.04, o.height * 0.85, 0.08, wd, [o.width * 0.9, o.height * 0.42, 0]));
    // base
    g.add(_box(o.width + 0.1, 0.03, 0.15, wd, [o.width * 0.45, 0.015, 0]));
    // strings
    for (let i = 0; i < o.strings; i++) {
        const t = i / (o.strings - 1);
        const sx = t * o.width * 0.85;
        const sy = o.height * (0.85 - t * 0.4);
        g.add(_cyl(0.001, 0.001, sy, mt, [sx, sy/2, 0], 3));
    }
    // capital scroll
    g.add(_sph(0.035, wd, [0, o.height + 0.01, 0], 6));
    return g;
    }, {
    icon: "🪕", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 1.0, max: 1.8, step: 0.1, default: 1.4 },
        { key: "width", label: "Width", type: "number", min: 0.4, max: 0.8, step: 0.05, default: 0.6 },
        { key: "strings", label: "Strings", type: "int", min: 8, max: 30, default: 18 },
        { key: "color", label: "Wood", type: "color", default: 0xd4a030 },
    ],
    });

    register("chess_table", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const lt = M.wood(o.lightSq);
    const dk = M.wood(o.darkSq);
    // top
    g.add(_box(o.size, 0.04, o.size, wd, [0, o.height, 0]));
    // chessboard pattern
    const sqSize = (o.size - 0.02) / 8;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
        const mat = (r + c) % 2 === 0 ? lt : dk;
        g.add(_box(sqSize, 0.005, sqSize, mat, 
            [-o.size/2 + 0.01 + sqSize/2 + c*sqSize, o.height + 0.022, -o.size/2 + 0.01 + sqSize/2 + r*sqSize]));
        }
    }
    // central leg
    g.add(_cyl(0.05, 0.06, o.height - 0.1, wd, [0, (o.height - 0.1)/2, 0], 8));
    // base
    g.add(_cyl(0.25, 0.28, 0.04, wd, [0, 0.02, 0], 10));
    return g;
    }, {
    icon: "♟️", category: "z_ai",
    params: [
        { key: "size", label: "Size", type: "number", min: 0.5, max: 1.2, step: 0.1, default: 0.8 },
        { key: "height", label: "Height", type: "number", min: 0.6, max: 0.9, step: 0.05, default: 0.75 },
        { key: "color", label: "Frame", type: "color", default: 0x2a1a10 },
        { key: "lightSq", label: "Light Sq", type: "color", default: 0xd8c8a0 },
        { key: "darkSq", label: "Dark Sq", type: "color", default: 0x3a2a18 },
    ],
    });

    register("jukebox", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const wd = M.wood(o.color + 0x1a0a00);
    const gl = M.glass(0x80a0c0);
    // body
    g.add(_box(o.width, o.height * 0.7, o.depth, mt, [0, o.height * 0.35, 0]));
    // top dome
    g.add(_cyl(o.width/2, o.width/2, o.height * 0.15, mt, [0, o.height * 0.7, 0], 10));
    g.add(_sph(o.width/2, mt, [0, o.height * 0.85, 0], 10));
    // glass front
    const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(o.width * 0.7, o.height * 0.5), gl);
    glassPane.position.set(0, o.height * 0.35, o.depth/2 + 0.005);
    g.add(glassPane);
    // glowing tubes inside
    for (let i = 0; i < 4; i++) {
        g.add(_cyl(0.01, 0.01, o.height * 0.35, M.wax(o.tubeColor), 
        [-o.width*0.2 + i*0.1, o.height * 0.35, o.depth * 0.1], 5));
    }
    // base
    g.add(_box(o.width + 0.02, 0.06, o.depth + 0.02, wd, [0, 0.03, 0]));
    // light
    if (o.glow > 0) {
        const l = new THREE.PointLight(o.tubeColor, o.glow, 4, 1.5);
        l.position.set(0, o.height * 0.5, o.depth/2);
        g.add(l);
    }
    return g;
    }, {
    icon: "🎵", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.5, max: 0.9, step: 0.05, default: 0.7 },
        { key: "height", label: "Height", type: "number", min: 1.0, max: 1.6, step: 0.1, default: 1.3 },
        { key: "depth", label: "Depth", type: "number", min: 0.3, max: 0.5, step: 0.05, default: 0.4 },
        { key: "color", label: "Body", type: "color", default: 0x8a1a2a },
        { key: "tubeColor", label: "Glow", type: "color", default: 0xff4060 },
        { key: "glow", label: "Light", type: "number", min: 0, max: 2, step: 0.3, default: 0.8 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  NAUTICAL
    // ═══════════════════════════════════════════════════════════

    register("ship_wheel", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const mt = M.brass();
    // hub
    g.add(_cyl(0.04, 0.04, 0.05, wd, [0, 0, 0], 8));
    // spokes
    for (let i = 0; i < o.spokes; i++) {
        const a = (i / o.spokes) * Math.PI * 2;
        const spoke = _box(o.radius * 2, 0.025, 0.025, wd);
        spoke.rotation.y = a;
        g.add(spoke);
    }
    // outer rings
    g.add(_tor(o.radius, 0.02, wd, [0, 0, 0], 6, 20));
    g.add(_tor(o.radius * 0.85, 0.01, wd, [0, 0, 0], 5, 16));
    // handles (pegs)
    for (let i = 0; i < o.spokes; i++) {
        const a = (i / o.spokes) * Math.PI * 2;
        g.add(_cyl(0.015, 0.015, 0.05, wd, [Math.sin(a)*o.radius, 0, Math.cos(a)*o.radius], 5));
    }
    // center axle
    g.add(_cyl(0.015, 0.015, 0.12, mt, [0, 0, 0], 6));
    return g;
    }, {
    icon: "⚓", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
        { key: "spokes", label: "Spokes", type: "int", min: 6, max: 10, default: 8 },
        { key: "color", label: "Wood", type: "color", default: 0x5a3818 },
    ],
    });

    register("anchor", function (o) {
    const g = new THREE.Group();
    const mt = M.rust(o.color);
    // shank (vertical bar)
    g.add(_cyl(0.03, 0.03, o.height * 0.7, mt, [0, o.height * 0.35, 0], 6));
    // crown (bottom horizontal)
    g.add(_box(o.width, 0.04, 0.04, mt, [0, 0.04, 0]));
    // flukes (arms)
    [-1,1].forEach(s => {
        const fluke = _box(0.04, o.height * 0.2, 0.04, mt);
        fluke.position.set(s * o.width/2, o.height * 0.1, 0);
        fluke.rotation.z = s * 0.4;
        g.add(fluke);
        // fluke tip
        g.add(_cone(0.025, 0.08, mt, [s * (o.width/2 + 0.03), o.height * 0.2, 0], 4));
    });
    // ring at top
    g.add(_tor(0.05, 0.012, mt, [0, o.height * 0.7 + 0.05, 0], 6, 10));
    // stock (horizontal bar near top)
    g.add(_box(o.width * 0.8, 0.035, 0.035, mt, [0, o.height * 0.6, 0]));
    return g;
    }, {
    icon: "⚓", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 0.8, max: 2.5, step: 0.2, default: 1.4 },
        { key: "width", label: "Width", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.7 },
        { key: "color", label: "Metal", type: "color", default: 0x3a3a38 },
    ],
    });

    register("diving_helmet", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const gl = M.glass(0x80a8c0);
    // main body
    g.add(_sph(o.radius, mt, [0, o.radius + 0.05, 0], 10));
    // collar
    g.add(_cyl(o.radius * 1.05, o.radius * 0.9, 0.06, mt, [0, 0.05, 0], 10));
    // viewport
    g.add(_sph(o.radius * 0.45, gl, [0, o.radius * 1.05, o.radius * 0.6], 8));
    // viewport frame
    g.add(_tor(o.radius * 0.45, 0.015, mt, [0, o.radius * 1.05, o.radius * 0.6], 6, 12));
    // rivets
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.add(_sph(0.008, M.brass(), [Math.sin(a)*o.radius*1.0, o.radius + 0.05, Math.cos(a)*o.radius*1.0], 4));
    }
    // top valve
    g.add(_cyl(0.03, 0.03, 0.06, M.brass(), [0, o.radius * 2 + 0.05, 0], 6));
    g.add(_cyl(0.04, 0.04, 0.01, M.brass(), [0, o.radius * 2 + 0.1, 0], 6));
    return g;
    }, {
    icon: "🤿", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.12, max: 0.25, step: 0.01, default: 0.18 },
        { key: "color", label: "Metal", type: "color", default: 0x4a5050 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  GARDEN / OUTDOOR
    // ═══════════════════════════════════════════════════════════

    register("topiary", function (o) {
    const g = new THREE.Group();
    const lf = M.leaf(o.leafColor);
    const wd = M.wood(o.trunkColor);
    // trunk
    g.add(_cyl(0.03, 0.04, o.height * 0.5, wd, [0, o.height * 0.25, 0], 6));
    // pot
    g.add(_cyl(o.potR * 0.8, o.potR, o.potH, M.ceramic(o.potColor), [0, o.potH/2, 0], 8));
    g.add(_tor(o.potR + 0.005, 0.01, M.ceramic(o.potColor + 0x080808), [0, o.potH, 0], 6, 12));
    // soil
    g.add(_cyl(o.potR * 0.85, o.potR * 0.85, 0.01, M.stone(0x3a2a18), [0, o.potH - 0.005, 0], 8));
    // shape
    if (o.shape === "sphere") {
        g.add(_sph(o.shapeR, lf, [0, o.height * 0.5 + o.shapeR, 0], 10));
    } else if (o.shape === "cone") {
        g.add(_cone(o.shapeR, o.shapeR * 2.5, lf, [0, o.height * 0.5 + o.shapeR * 1.25, 0], 8));
    } else if (o.shape === "spiral") {
        // Base sphere with spiral wrap
        g.add(_sph(o.shapeR, lf, [0, o.height * 0.5 + o.shapeR, 0], 8));
        g.add(_tor(o.shapeR + 0.01, 0.02, lf, [0, o.height * 0.5 + o.shapeR, 0], 6, 20));
    } else { // cube
        g.add(_box(o.shapeR * 1.6, o.shapeR * 1.6, o.shapeR * 1.6, lf, [0, o.height * 0.5 + o.shapeR * 0.8, 0]));
    }
    return g;
    }, {
    icon: "🌳", category: "z_ai",
    params: [
        { key: "height", label: "Trunk H", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.7 },
        { key: "shapeR", label: "Crown R", type: "number", min: 0.15, max: 0.4, step: 0.03, default: 0.25 },
        { key: "potR", label: "Pot R", type: "number", min: 0.1, max: 0.2, step: 0.02, default: 0.14 },
        { key: "potH", label: "Pot H", type: "number", min: 0.1, max: 0.25, step: 0.02, default: 0.16 },
        { key: "shape", label: "Shape", type: "select", options: ["sphere", "cone", "cube", "spiral"], default: "sphere" },
        { key: "leafColor", label: "Leaf", type: "color", default: 0x2a6a20 },
        { key: "trunkColor", label: "Trunk", type: "color", default: 0x4a3020 },
        { key: "potColor", label: "Pot", type: "color", default: 0x8a4a30 },
    ],
    });

    register("sundial", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.color);
    const mt = M.brass();
    // pedestal
    g.add(_cyl(0.08, 0.12, o.height * 0.7, st, [0, o.height * 0.35, 0], 8));
    g.add(_cyl(0.14, 0.16, 0.04, st, [0, 0.02, 0], 10));
    // dial plate (angled)
    const plate = _cyl(o.radius, o.radius, 0.02, st, [0, o.height * 0.7, 0], 16);
    plate.rotation.x = -0.15; // tilt for latitude
    g.add(plate);
    // gnomon (shadow caster)
    const gnomon = _box(0.008, o.radius * 0.8, 0.008, mt);
    gnomon.position.set(0, o.height * 0.7 + o.radius * 0.35, 0);
    gnomon.rotation.x = -0.15;
    gnomon.rotation.z = 0.9; // angle to pole
    g.add(gnomon);
    // hour marks
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const mx = Math.sin(a) * o.radius * 0.8;
        const mz = Math.cos(a) * o.radius * 0.8;
        g.add(_box(0.015, 0.005, 0.005, mt, [mx, o.height * 0.71, mz]));
    }
    return g;
    }, {
    icon: "☀️", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 0.4, max: 1.0, step: 0.1, default: 0.6 },
        { key: "radius", label: "Dial R", type: "number", min: 0.12, max: 0.3, step: 0.02, default: 0.18 },
        { key: "color", label: "Stone", type: "color", default: 0x8a8070 },
    ],
    });

    register("birdhouse", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const rf = M.wood(o.roofColor);
    // body
    g.add(_box(o.width, o.height * 0.6, o.depth, wd, [0, o.height * 0.3, 0]));
    // roof
    const roofL = _box(o.width * 1.15, 0.02, o.depth * 0.65, rf, [0, o.height * 0.62, -o.depth * 0.1]);
    roofL.rotation.x = -0.3;
    g.add(roofL);
    const roofR = _box(o.width * 1.15, 0.02, o.depth * 0.65, rf, [0, o.height * 0.62, o.depth * 0.1]);
    roofR.rotation.x = 0.3;
    g.add(roofR);
    // hole
    g.add(_cyl(0.03, 0.03, 0.02, M.wood(o.color + 0x101010), [0, o.height * 0.4, o.depth/2 + 0.005], 8));
    // perch
    g.add(_cyl(0.008, 0.008, 0.06, wd, [0, o.height * 0.28, o.depth/2 + 0.03], 4));
    // pole
    g.add(_cyl(0.02, 0.025, o.poleH, wd, [0, -o.poleH/2, 0], 6));
    return g;
    }, {
    icon: "🐦", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.12, max: 0.3, step: 0.02, default: 0.18 },
        { key: "height", label: "House H", type: "number", min: 0.15, max: 0.35, step: 0.02, default: 0.22 },
        { key: "depth", label: "Depth", type: "number", min: 0.12, max: 0.25, step: 0.02, default: 0.16 },
        { key: "poleH", label: "Pole H", type: "number", min: 0.8, max: 2.0, step: 0.1, default: 1.4 },
        { key: "color", label: "Wood", type: "color", default: 0x6a4a2a },
        { key: "roofColor", label: "Roof", type: "color", default: 0x3a5a3a },
    ],
    });

    register("scarecrow", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(0x4a3a20);
    const cl = M.cloth(o.clothColor);
    // cross post
    g.add(_cyl(0.03, 0.03, o.height, wd, [0, o.height/2, 0], 6));
    g.add(_cyl(0.025, 0.025, o.width, wd, [0, o.height * 0.75, 0], 6));
    // head
    g.add(_sph(0.08, M.cloth(o.headColor), [0, o.height + 0.08, 0], 6));
    // hat
    g.add(_cyl(0.12, 0.12, 0.01, M.straw(0x8a7a50), [0, o.height + 0.16, 0], 8));
    g.add(_cyl(0.06, 0.07, 0.06, M.straw(0x8a7a50), [0, o.height + 0.19, 0], 8));
    // shirt
    g.add(_box(o.width * 0.9, o.height * 0.3, 0.06, cl, [0, o.height * 0.65, 0]));
    // arms (sleeves)
    [-1,1].forEach(s => {
        g.add(_box(o.width * 0.4, 0.06, 0.06, cl, [s * o.width * 0.5, o.height * 0.72, 0]));
    });
    // pants
    g.add(_box(0.12, o.height * 0.3, 0.06, M.cloth(o.pantsColor), [0, o.height * 0.35, 0]));
    return g;
    }, {
    icon: "🧑‍🌾", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 1.2, max: 2.2, step: 0.1, default: 1.6 },
        { key: "width", label: "Arm Span", type: "number", min: 0.8, max: 1.6, step: 0.1, default: 1.2 },
        { key: "clothColor", label: "Shirt", type: "color", default: 0x2a4a8a },
        { key: "pantsColor", label: "Pants", type: "color", default: 0x4a3a20 },
        { key: "headColor", label: "Head", type: "color", default: 0xd8c088 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  MILITARY / SIEGE
    // ═══════════════════════════════════════════════════════════

    register("cannon", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const wd = M.wood(o.carriageColor);
    // barrel
    g.add(_cyl(o.muzzleR, o.breechR, o.barrelL, mt, [0, o.height * 0.6, -o.barrelL * 0.3], 10));
    // muzzle flare
    g.add(_cyl(o.muzzleR + 0.02, o.muzzleR, 0.08, mt, [0, o.height * 0.6, -o.barrelL * 0.8], 10));
    // trunnions (side pivots)
    [-1,1].forEach(s => {
        g.add(_cyl(0.02, 0.02, 0.06, mt, [s * 0.06, o.height * 0.6, -o.barrelL * 0.1], 6));
    });
    // carriage
    g.add(_box(o.barrelL * 0.8, 0.06, 0.3, wd, [0, o.height * 0.35, -o.barrelL * 0.1]));
    // wheels
    [-1,1].forEach(s => {
        g.add(_tor(o.wheelR, 0.02, wd, [s * 0.2, o.wheelR, -o.barrelL * 0.1], 6, 14));
        // spokes
        for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const sp = _cyl(0.01, 0.01, o.wheelR * 1.8, wd, [s * 0.2, o.wheelR, -o.barrelL * 0.1], 4);
        sp.rotation.x = Math.PI/2;
        sp.rotation.z = a;
        g.add(sp);
        }
        g.add(_cyl(0.015, 0.015, 0.04, mt, [s * 0.2, o.wheelR, -o.barrelL * 0.1], 6)); // hub
    });
    return g;
    }, {
    icon: "💣", category: "z_ai",
    params: [
        { key: "barrelL", label: "Barrel L", type: "number", min: 0.8, max: 2.0, step: 0.1, default: 1.2 },
        { key: "breechR", label: "Breech R", type: "number", min: 0.06, max: 0.15, step: 0.01, default: 0.1 },
        { key: "muzzleR", label: "Muzzle R", type: "number", min: 0.04, max: 0.1, step: 0.01, default: 0.07 },
        { key: "wheelR", label: "Wheel R", type: "number", min: 0.2, max: 0.5, step: 0.05, default: 0.35 },
        { key: "height", label: "Height", type: "number", min: 0.5, max: 1.2, step: 0.1, default: 0.8 },
        { key: "color", label: "Metal", type: "color", default: 0x2a2828 },
        { key: "carriageColor", label: "Carriage", type: "color", default: 0x3a2818 },
    ],
    });

    register("palisade", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // horizontal rails
    g.add(_box(o.length, 0.08, 0.06, wd, [0, o.height * 0.7, 0]));
    g.add(_box(o.length, 0.08, 0.06, wd, [0, o.height * 0.3, 0]));
    // vertical logs
    const logs = Math.max(3, Math.floor(o.length / 0.2));
    for (let i = 0; i < logs; i++) {
        const x = -o.length/2 + 0.1 + i * (o.length - 0.2) / (logs - 1);
        const h = o.height + rand(-0.1, 0.1);
        g.add(_cyl(0.05, 0.06, h, wd, [x, h/2, 0], 6));
        // pointed top
        g.add(_cone(0.055, 0.12, wd, [x, h + 0.06, 0], 5));
    }
    return g;
    }, {
    icon: "🏗️", category: "z_ai",
    params: [
        { key: "length", label: "Length", type: "number", min: 1.0, max: 5.0, step: 0.5, default: 3.0 },
        { key: "height", label: "Height", type: "number", min: 1.5, max: 3.5, step: 0.25, default: 2.5 },
        { key: "color", label: "Wood", type: "color", default: 0x4a3820 },
    ],
    });

    register("weapon_rack", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const mt = M.metal(o.weaponColor);
    // frame
    g.add(_box(0.04, o.height, 0.04, wd, [-o.width/2, o.height/2, 0]));
    g.add(_box(0.04, o.height, 0.04, wd, [o.width/2, o.height/2, 0]));
    g.add(_box(o.width, 0.04, 0.04, wd, [0, o.height, 0]));
    g.add(_box(o.width, 0.04, 0.04, wd, [0, o.height * 0.5, 0]));
    // crossbars for hanging
    g.add(_cyl(0.01, 0.01, o.width * 0.9, mt, [0, o.height * 0.85, 0.03], 6));
    g.add(_cyl(0.01, 0.01, o.width * 0.9, mt, [0, o.height * 0.6, 0.03], 6));
    // swords
    for (let i = 0; i < o.weapons; i++) {
        const x = -o.width/2 + 0.15 + i * (o.width - 0.3) / (o.weapons - 1 || 1);
        // blade
        g.add(_box(0.015, o.height * 0.5, 0.005, mt, [x, o.height * 0.6, 0.04]));
        // guard
        g.add(_box(0.06, 0.01, 0.01, M.brass(), [x, o.height * 0.35, 0.04]));
        // handle
        g.add(_cyl(0.012, 0.012, 0.1, M.leather(), [x, o.height * 0.28, 0.04], 5));
    }
    return g;
    }, {
    icon: "⚔️", category: "z_ai",
    params: [
        { key: "width", label: "Width", type: "number", min: 0.6, max: 1.5, step: 0.1, default: 1.0 },
        { key: "height", label: "Height", type: "number", min: 1.0, max: 2.0, step: 0.1, default: 1.5 },
        { key: "weapons", label: "Weapons", type: "int", min: 2, max: 6, default: 4 },
        { key: "color", label: "Wood", type: "color", default: 0x3a2010 },
        { key: "weaponColor", label: "Metal", type: "color", default: 0x808890 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  MAGIC / FANTASY
    // ═══════════════════════════════════════════════════════════

    register("cauldron_large", function (o) {
    const g = new THREE.Group();
    const mt = M.metal(o.color);
    const lq = M.glass(o.liquidColor);
    // body
    g.add(_cyl(o.radius, o.radius * 0.8, o.radius * 1.2, mt, [0, o.radius * 0.6, 0], 12));
    // rim
    g.add(_tor(o.radius + 0.005, 0.015, mt, [0, o.radius * 1.2, 0], 8, 16));
    // liquid
    g.add(_cyl(o.radius * 0.9, o.radius * 0.9, 0.02, lq, [0, o.radius * 1.0, 0], 12));
    // bubbling spheres
    for (let i = 0; i < 5; i++) {
        const bx = rand(-o.radius*0.5, o.radius*0.5);
        const bz = rand(-o.radius*0.5, o.radius*0.5);
        g.add(_sph(rand(0.01, 0.025), lq, [bx, o.radius * 1.05, bz], 5));
    }
    // handles
    [-1,1].forEach(s => {
        g.add(_tor(o.radius * 0.25, 0.015, mt, [s * (o.radius + 0.08), o.radius * 1.0, 0], 6, 8));
    });
    // legs
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        g.add(_cyl(0.025, 0.03, o.radius * 0.4, mt, [Math.sin(a)*o.radius*0.6, o.radius*0.2, Math.cos(a)*o.radius*0.6], 5));
    }
    // fire under cauldron
    g.add(_cone(0.1, 0.15, M.wax(0xff4010), [0, 0.08, 0], 6));
    if (o.glow > 0) {
        g.add(new THREE.PointLight(0xff4010, o.glow, 3, 1.5).translateY(0.1));
        g.add(new THREE.PointLight(o.liquidColor, o.glow * 0.5, 4, 2).translateY(o.radius));
    }
    return g;
    }, {
    icon: "🧙", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.45 },
        { key: "color", label: "Metal", type: "color", default: 0x1a1a1a },
        { key: "liquidColor", label: "Liquid", type: "color", default: 0x20a040 },
        { key: "glow", label: "Glow", type: "number", min: 0, max: 3, step: 0.5, default: 1.0 },
    ],
    });

    register("elemental_rift", function (o) {
    const g = new THREE.Group();
    const mt = new THREE.MeshStandardMaterial({
        color: o.color, emissive: o.color, emissiveIntensity: 0.8,
        roughness: 0.2, metalness: 0.5, side: THREE.DoubleSide,
    });
    // base crack (plane)
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(o.radius * 2, o.radius * 0.3), mt);
    crack.rotation.x = -Math.PI/2;
    crack.position.y = 0.01;
    g.add(crack);
    // floating shards
    for (let i = 0; i < o.shards; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * o.radius;
        const h = 0.2 + Math.random() * o.height;
        const shard = _box(rand(0.05, 0.15), rand(0.05, 0.15), rand(0.02, 0.08), M.stone(o.color + 0x202020));
        shard.position.set(Math.sin(a)*r, h, Math.cos(a)*r);
        shard.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
        g.add(shard);
    }
    // central energy column
    g.add(_cyl(o.radius * 0.1, o.radius * 0.1, o.height * 1.5, mt, [0, o.height * 0.75, 0], 6));
    // glow
    const l = new THREE.PointLight(o.color, o.glow, o.radius * 6, 1.5);
    l.position.y = o.height * 0.5;
    g.add(l);
    return g;
    }, {
    icon: "🌀", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.5, max: 2.5, step: 0.25, default: 1.2 },
        { key: "height", label: "Height", type: "number", min: 1.0, max: 4.0, step: 0.5, default: 2.0 },
        { key: "shards", label: "Shards", type: "int", min: 5, max: 25, default: 12 },
        { key: "color", label: "Color", type: "color", default: 0x4080ff },
        { key: "glow", label: "Glow", type: "number", min: 1, max: 5, step: 0.5, default: 2.0 },
    ],
    });

    register("astrolabe", function (o) {
    const g = new THREE.Group();
    const mt = M.brass(o.color);
    // main body ring
    g.add(_tor(o.radius, 0.01, mt, [0, 0, 0], 6, 20));
    // inner rings (tilted)
    const r2 = _tor(o.radius * 0.8, 0.007, mt, [0, 0, 0], 5, 16);
    r2.rotation.x = 0.5;
    g.add(r2);
    const r3 = _tor(o.radius * 0.6, 0.005, mt, [0, 0, 0], 5, 14);
    r3.rotation.x = 1.2;
    r3.rotation.z = 0.8;
    g.add(r3);
    // center plate
    g.add(_cyl(o.radius * 0.4, o.radius * 0.4, 0.005, mt, [0, 0, 0], 10));
    // pointer (rule)
    const rule = _box(o.radius * 1.8, 0.008, 0.008, mt, [0, 0, 0]);
    rule.rotation.z = 0.3;
    g.add(rule);
    // hanging ring
    g.add(_tor(o.radius * 0.15, 0.008, mt, [0, o.radius + 0.08, 0], 5, 8));
    g.add(_cyl(0.005, 0.005, 0.1, mt, [0, o.radius + 0.02, 0], 4)); // connector
    return g;
    }, {
    icon: "🔭", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.1, max: 0.4, step: 0.02, default: 0.2 },
        { key: "color", label: "Brass", type: "color", default: 0xc8a040 },
    ],
    });

    register("spellbook_pedestal", function (o) {
    const g = new THREE.Group();
    const st = M.stone(o.pedestalColor);
    const bk = M.book(o.bookColor);
    // base
    g.add(_cyl(o.radius * 1.2, o.radius * 1.3, 0.06, st, [0, 0.03, 0], 10));
    // column
    g.add(_cyl(o.radius * 0.6, o.radius * 0.7, o.height - 0.1, st, [0, o.height/2, 0], 8));
    // capital
    g.add(_cyl(o.radius * 1.1, o.radius * 0.7, 0.06, st, [0, o.height - 0.03, 0], 10));
    // top slab
    g.add(_box(o.radius * 2.2, 0.04, o.radius * 2.2, st, [0, o.height + 0.02, 0]));
    // open book
    // left page
    const pgL = new THREE.Mesh(new THREE.PlaneGeometry(o.radius * 0.7, o.radius * 0.9), M.wax(0xf0e8d0));
    pgL.position.set(-o.radius * 0.35, o.height + 0.05, 0);
    pgL.rotation.x = -Math.PI/2;
    pgL.rotation.z = 0.05;
    g.add(pgL);
    // right page
    const pgR = new THREE.Mesh(new THREE.PlaneGeometry(o.radius * 0.7, o.radius * 0.9), M.wax(0xf0e8d0));
    pgR.position.set(o.radius * 0.35, o.height + 0.05, 0);
    pgR.rotation.x = -Math.PI/2;
    pgR.rotation.z = -0.05;
    g.add(pgR);
    // spine
    g.add(_box(0.02, 0.03, o.radius * 0.9, bk, [0, o.height + 0.04, 0]));
    // magic glow
    if (o.glow > 0) {
        const l = new THREE.PointLight(o.glowColor, o.glow, 3, 1.5);
        l.position.set(0, o.height + 0.3, 0);
        g.add(l);
    }
    return g;
    }, {
    icon: "📖", category: "z_ai",
    params: [
        { key: "height", label: "Height", type: "number", min: 0.6, max: 1.2, step: 0.05, default: 0.8 },
        { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.4, step: 0.03, default: 0.25 },
        { key: "bookColor", label: "Book", type: "color", default: 0x2a1a40 },
        { key: "pedestalColor", label: "Stone", type: "color", default: 0x4a4a48 },
        { key: "glow", label: "Glow", type: "number", min: 0, max: 2, step: 0.3, default: 0.6 },
        { key: "glowColor", label: "Glow Clr", type: "color", default: 0x8040ff },
    ],
    });

    // ═══════════════════════════════════════════════════════════
    //  TAVERN / PUB
    // ═══════════════════════════════════════════════════════════

    register("bar_counter", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    // main top
    g.add(_box(o.length, 0.05, o.depth, wd, [0, o.height, 0]));
    // front panel
    g.add(_box(o.length, o.height - 0.1, 0.03, M.wood(o.color + 0x080808), [0, (o.height-0.1)/2, o.depth/2 - 0.015]));
    // back shelf
    g.add(_box(o.length, 0.03, o.depth * 0.3, wd, [0, o.height * 0.7, -o.depth * 0.7]));
    // back mirror
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(o.length * 0.8, o.height * 0.5), M.glass(0xc0c8d0));
    mirror.position.set(0, o.height * 0.7, -o.depth * 0.85);
    g.add(mirror);
    // foot rail
    g.add(_cyl(0.01, 0.01, o.length, M.metal(), [0, 0.1, o.depth/2 + 0.05], 6));
    // rail brackets
    for (let i = 0; i < Math.ceil(o.length / 0.5); i++) {
        const x = -o.length/2 + 0.2 + i * 0.5;
        g.add(_cyl(0.005, 0.005, 0.1, M.metal(), [x, 0.05, o.depth/2 + 0.05], 4));
    }
    // bottles on back shelf
    for (let i = 0; i < 5; i++) {
        const bx = -o.length/3 + i * o.length/6;
        const bc = pick([0x2a6a20, 0x6a2a20, 0x202a6a, 0x8a7020]);
        g.add(_cyl(0.02, 0.018, 0.12, M.glass(bc), [bx, o.height * 0.7 + 0.07, -o.depth * 0.7], 6));
    }
    return g;
    }, {
    icon: "🍺", category: "z_ai",
    params: [
        { key: "length", label: "Length", type: "number", min: 1.5, max: 5.0, step: 0.25, default: 2.5 },
        { key: "height", label: "Height", type: "number", min: 0.9, max: 1.2, step: 0.05, default: 1.1 },
        { key: "depth", label: "Depth", type: "number", min: 0.4, max: 0.7, step: 0.05, default: 0.55 },
        { key: "color", label: "Wood", type: "color", default: 0x3a1e0a },
    ],
    });

    register("beer_keg", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(o.color);
    const mt = M.metal(o.bandColor);
    // body
    g.add(_cyl(o.radius, o.radius * 0.9, o.length, wd, [0, o.radius, 0], 10));
    // bands
    [0.1, 0.35, 0.65, 0.9].forEach(t => {
        g.add(_tor(o.radius + 0.005, 0.006, mt, [0, o.radius, -o.length/2 + t*o.length], 5, 10));
    });
    // tap
    g.add(_cyl(0.01, 0.012, 0.06, mt, [o.radius + 0.03, o.radius * 1.1, 0.1], 6));
    g.add(_cyl(0.008, 0.008, 0.04, mt, [o.radius + 0.03, o.radius * 1.15, 0.14], 4)); // handle
    return g;
    }, {
    icon: "🛢️", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.35, step: 0.02, default: 0.22 },
        { key: "length", label: "Length", type: "number", min: 0.4, max: 0.9, step: 0.05, default: 0.6 },
        { key: "color", label: "Wood", type: "color", default: 0x6a4a28 },
        { key: "bandColor", label: "Bands", type: "color", default: 0x3a3a38 },
    ],
    });

    register("dartboard", function (o) {
    const g = new THREE.Group();
    const wd = M.wood(0x2a1a10);
    const bk = M.cloth(0x1a1a1a);
    const rd = M.cloth(0x8a2020);
    const gn = M.cloth(0x208a20);
    // backing board
    g.add(_cyl(o.radius * 1.1, o.radius * 1.1, 0.02, wd, [0, 0, 0], 16));
    // dartboard rings
    g.add(_tor(o.radius, 0.04, bk, [0, 0, 0.015], 6, 24)); // outer double
    g.add(_tor(o.radius * 0.85, 0.03, rd, [0, 0, 0.015], 6, 20));
    g.add(_tor(o.radius * 0.7, 0.04, bk, [0, 0, 0.015], 6, 18));
    g.add(_tor(o.radius * 0.5, 0.03, gn, [0, 0, 0.015], 6, 14));
    g.add(_tor(o.radius * 0.35, 0.04, bk, [0, 0, 0.015], 6, 12));
    // bullseye
    g.add(_cyl(o.radius * 0.1, o.radius * 0.1, 0.02, rd, [0, 0, 0.02], 8));
    g.add(_cyl(o.radius * 0.04, o.radius * 0.04, 0.025, gn, [0, 0, 0.025], 6));
    // wire spider (simplified lines)
    for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const line = _box(0.003, o.radius * 1.8, 0.003, M.metal(0xa0a0a0));
        line.rotation.z = a;
        line.position.z = 0.02;
        g.add(line);
    }
    return g;
    }, {
    icon: "🎯", category: "z_ai",
    params: [
        { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.3, step: 0.02, default: 0.22 },
    ],
    });

    // ═══════════════════════════════════════════════════════════
//  SCIENCE / LABORATORY
// ═══════════════════════════════════════════════════════════

register("tesla_coil", function (o) {
  const g = new THREE.Group();
  const mt = M.metal(o.color);
  const wd = M.wood(0x3a2a18);
  // base
  g.add(_cyl(o.radius * 1.5, o.radius * 1.6, 0.1, wd, [0, 0.05, 0], 10));
  // primary coil form
  g.add(_cyl(o.radius * 1.2, o.radius * 1.2, 0.15, wd, [0, 0.175, 0], 10));
  // primary coil windings
  g.add(_tor(o.radius * 1.25, 0.01, M.copper(0xb87333), [0, 0.15, 0], 6, 20));
  g.add(_tor(o.radius * 1.15, 0.01, M.copper(0xb87333), [0, 0.2, 0], 6, 18));
  // secondary coil (tall cylinder)
  g.add(_cyl(o.radius * 0.3, o.radius * 0.3, o.height * 0.7, mt, [0, o.height * 0.35 + 0.25, 0], 8));
  // top terminal (toroid)
  g.add(_tor(o.radius * 0.7, o.radius * 0.2, mt, [0, o.height * 0.7 + 0.25, 0], 8, 20));
  // spark gap (aesthetic)
  g.add(_cyl(0.005, 0.005, 0.15, M.wax(0xaaccff), [0, o.height * 0.7 + 0.35, 0], 4));
  // light
  if (o.glow > 0) {
    const l = new THREE.PointLight(0x6080ff, o.glow, 5, 1.5);
    l.position.set(0, o.height * 0.8, 0);
    g.add(l);
  }
  return g;
}, {
  icon: "⚡", category: "z_ai",
  params: [
    { key: "height", label: "Height", type: "number", min: 1.0, max: 3.0, step: 0.2, default: 1.8 },
    { key: "radius", label: "Radius", type: "number", min: 0.2, max: 0.6, step: 0.05, default: 0.35 },
    { key: "glow", label: "Glow", type: "number", min: 0, max: 3, step: 0.5, default: 1.5 },
    { key: "color", label: "Metal", type: "color", default: 0x4a4a50 },
  ],
});

register("microscope", function (o) {
  const g = new THREE.Group();
  const mt = M.metal(o.color);
  const bk = M.metal(0x1a1a1a);
  // base
  g.add(_box(0.12, 0.02, 0.08, mt, [0, 0.01, 0]));
  // arm (C-shaped)
  g.add(_cyl(0.015, 0.015, o.height, mt, [-0.03, o.height/2, 0], 6));
  // eyepiece tube
  const tube = _cyl(0.018, 0.018, 0.12, mt, [-0.03, o.height, 0], 6);
  tube.rotation.x = 0.4;
  g.add(tube);
  g.add(_cyl(0.012, 0.015, 0.04, bk, [-0.03, o.height + 0.06, -0.03], 6)); // lens
  // stage (platform for slides)
  g.add(_box(0.08, 0.01, 0.08, mt, [0, o.height * 0.4, 0]));
  // objective lenses (rotating turret)
  g.add(_cyl(0.015, 0.015, 0.015, mt, [0, o.height * 0.55, 0], 6));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(_cyl(0.006, 0.006, 0.03, bk, [Math.sin(a)*0.012, o.height * 0.5, Math.cos(a)*0.012], 4));
  }
  // focus knobs
  g.add(_cyl(0.012, 0.012, 0.02, mt, [-0.045, o.height * 0.6, 0], 6));
  g.add(_cyl(0.012, 0.012, 0.02, mt, [-0.015, o.height * 0.6, 0], 6));
  return g;
}, {
  icon: "🔬", category: "z_ai",
  params: [
    { key: "height", label: "Height", type: "number", min: 0.25, max: 0.5, step: 0.05, default: 0.35 },
    { key: "color", label: "Metal", type: "color", default: 0x6a6a70 },
  ],
});

register("abacus", function (o) {
  const g = new THREE.Group();
  const wd = M.wood(o.color);
  const bk = M.wood(0x1a1a1a);
  // frame
  g.add(_box(o.width, 0.025, 0.025, wd, [0, o.height, 0]));
  g.add(_box(o.width, 0.025, 0.025, wd, [0, 0, 0]));
  g.add(_box(0.025, o.height, 0.025, wd, [-o.width/2, o.height/2, 0]));
  g.add(_box(0.025, o.height, 0.025, wd, [o.width/2, o.height/2, 0]));
  // rods and beads
  const rodCount = Math.max(3, o.rods);
  for (let i = 0; i < rodCount; i++) {
    const x = -o.width/2 + 0.05 + i * (o.width - 0.1) / (rodCount - 1);
    g.add(_cyl(0.004, 0.004, o.height, M.metal(0x8a7a60), [x, o.height/2, 0], 4));
    // upper beads (2)
    for (let b = 0; b < 2; b++) {
      g.add(_sph(0.012, M.wood(o.beadColor), [x, o.height * 0.75 + b * 0.03, 0], 6));
    }
    // lower beads (5)
    for (let b = 0; b < 5; b++) {
      g.add(_sph(0.012, M.wood(o.beadColor), [x, o.height * 0.1 + b * 0.03, 0], 6));
    }
  }
  return g;
}, {
  icon: "🧮", category: "z_ai",
  params: [
    { key: "width", label: "Width", type: "number", min: 0.2, max: 0.5, step: 0.05, default: 0.3 },
    { key: "height", label: "Height", type: "number", min: 0.2, max: 0.4, step: 0.05, default: 0.3 },
    { key: "rods", label: "Rods", type: "int", min: 5, max: 15, default: 9 },
    { key: "color", label: "Frame", type: "color", default: 0x5a3a20 },
    { key: "beadColor", label: "Beads", type: "color", default: 0x8a2020 },
  ],
});

// ═══════════════════════════════════════════════════════════
//  ART / STUDIO
// ═══════════════════════════════════════════════════════════

register("easel", function (o) {
  const g = new THREE.Group();
  const wd = M.wood(o.color);
  // back leg
  const backLeg = _cyl(0.015, 0.015, o.height, wd, [0, o.height/2, -0.3], 6);
  backLeg.rotation.x = 0.15;
  g.add(backLeg);
  // front legs
  [-1, 1].forEach(s => {
    const leg = _cyl(0.015, 0.015, o.height, wd, [s * 0.15, o.height/2, 0.1], 6);
    leg.rotation.x = -0.05;
    g.add(leg);
  });
  // canvas holder (ledge)
  g.add(_box(o.width * 0.8, 0.02, 0.04, wd, [0, o.height * 0.5, 0.05]));
  // top clamp
  g.add(_box(o.width * 0.4, 0.02, 0.02, wd, [0, o.height * 0.9, 0.02]));
  // canvas
  g.add(_box(o.width, o.height * 0.75, 0.02, M.cloth(o.canvasColor), [0, o.height * 0.65, 0.04]));
  // palette on ledge
  g.add(_box(0.12, 0.005, 0.08, M.wood(0x4a3a28), [-o.width * 0.2, o.height * 0.51, 0.06]));
  return g;
}, {
  icon: "🎨", category: "z_ai",
  params: [
    { key: "height", label: "Height", type: "number", min: 1.2, max: 2.2, step: 0.1, default: 1.7 },
    { key: "width", label: "Canvas W", type: "number", min: 0.4, max: 1.2, step: 0.1, default: 0.7 },
    { key: "color", label: "Wood", type: "color", default: 0x6a4a2a },
    { key: "canvasColor", label: "Canvas", type: "color", default: 0xf0e8d8 },
  ],
});

register("sculpture_bust", function (o) {
  const g = new THREE.Group();
  const mt = M.marble(o.color);
  // pedestal
  g.add(_box(o.baseW, o.baseH, o.baseW, M.stone(o.baseColor), [0, o.baseH/2, 0]));
  g.add(_box(o.baseW * 1.1, 0.04, o.baseW * 1.1, M.stone(o.baseColor), [0, o.baseH + 0.02, 0]));
  // neck
  g.add(_cyl(0.06, 0.07, 0.1, mt, [0, o.baseH + 0.1, 0], 8));
  // head
  g.add(_sph(0.12, mt, [0, o.baseH + 0.3, 0], 10));
  // nose
  g.add(_cone(0.015, 0.05, mt, [0, o.baseH + 0.3, 0.12], 4));
  // hair/top
  g.add(_sph(0.1, mt, [0, o.baseH + 0.42, -0.02], 8));
  // shoulders
  g.add(_box(0.35, 0.1, 0.2, mt, [0, o.baseH + 0.05, 0]));
  return g;
}, {
  icon: "🏛️", category: "z_ai",
  params: [
    { key: "baseW", label: "Pedestal W", type: "number", min: 0.25, max: 0.5, step: 0.025, default: 0.35 },
    { key: "baseH", label: "Pedestal H", type: "number", min: 0.6, max: 1.2, step: 0.1, default: 0.9 },
    { key: "color", label: "Marble", type: "color", default: 0xe8e0d8 },
    { key: "baseColor", label: "Pedestal", type: "color", default: 0x4a4a48 },
  ],
});

register("pottery_wheel", function (o) {
  const g = new THREE.Group();
  const wd = M.wood(o.color);
  const mt = M.metal(0x3a3530);
  // base frame
  g.add(_box(0.4, 0.04, 0.35, wd, [0, 0.25, 0]));
  // legs
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
    g.add(_box(0.03, 0.25, 0.03, wd, [sx*0.15, 0.125, sz*0.13]));
  });
  // wheel
  g.add(_cyl(0.18, 0.18, 0.02, wd, [0, 0.27, 0], 16));
  // flywheel underneath
  g.add(_cyl(0.15, 0.15, 0.015, mt, [0, 0.15, 0], 12));
  // seat
  g.add(_box(0.2, 0.03, 0.2, wd, [0.3, 0.3, 0]));
  g.add(_box(0.03, 0.3, 0.03, wd, [0.3, 0.15, 0.08]));
  g.add(_box(0.03, 0.3, 0.03, wd, [0.3, 0.15, -0.08]));
  // clay lump on wheel
  g.add(_cyl(0.06, 0.07, 0.08, M.ceramic(0x8a4a28), [0, 0.33, 0], 8));
  return g;
}, {
  icon: "🫖", category: "z_ai",
  params: [
    { key: "color", label: "Wood", type: "color", default: 0x4a3a20 },
  ],
});

// ═══════════════════════════════════════════════════════════
//  FARM / AGRICULTURE
// ═══════════════════════════════════════════════════════════

register("windmill", function (o) {
  const g = new THREE.Group();
  const st = M.stone(o.towerColor);
  const wd = M.wood(o.bladeColor);
  // tower (tapered cylinder)
  g.add(_cyl(o.radius * 0.6, o.radius, o.height * 0.75, st, [0, o.height * 0.375, 0], 10));
  // cap (cone)
  g.add(_cone(o.radius * 0.7, o.height * 0.2, wd, [0, o.height * 0.85, 0], 8));
  // hub
  g.add(_cyl(0.06, 0.06, 0.08, wd, [0, o.height * 0.75, o.radius * 0.6], 8));
  // blades
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const bladeGrp = new THREE.Group();
    // frame
    bladeGrp.add(_box(o.bladeW, 0.02, o.bladeL, wd, [0, 0, o.bladeL/2]));
    // sail cloth
    bladeGrp.add(_box(o.bladeW * 0.8, 0.005, o.bladeL * 0.8, M.cloth(0xf0e8d0), [0, 0.015, o.bladeL * 0.4]));
    bladeGrp.position.set(0, o.height * 0.75, o.radius * 0.6 + 0.04);
    bladeGrp.rotation.x = a;
    g.add(bladeGrp);
  }
  // door
  g.add(_box(0.3, 0.6, 0.02, M.wood(0x3a2a18), [0, 0.3, o.radius * 0.95]));
  return g;
}, {
  icon: "🌬️", category: "z_ai",
  params: [
    { key: "height", label: "Height", type: "number", min: 4, max: 10, step: 0.5, default: 6 },
    { key: "radius", label: "Radius", type: "number", min: 1.0, max: 2.5, step: 0.25, default: 1.5 },
    { key: "bladeL", label: "Blade L", type: "number", min: 1.5, max: 4.0, step: 0.25, default: 2.5 },
    { key: "bladeW", label: "Blade W", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
    { key: "towerColor", label: "Stone", type: "color", default: 0x8a8070 },
    { key: "bladeColor", label: "Wood", type: "color", default: 0x4a3a20 },
  ],
});

register("trough", function (o) {
  const g = new THREE.Group();
  const wd = M.wood(o.color);
  // body (hollowed box)
  g.add(_box(o.length, o.height, o.depth, wd, [0, o.height/2, 0]));
  g.add(_box(o.length - 0.04, o.height - 0.04, o.depth - 0.04, M.wood(o.color + 0x080808), [0, o.height/2 + 0.02, 0]));
  // water
  g.add(_box(o.length - 0.06, 0.02, o.depth - 0.06, M.glass(0x5080a0), [0, o.height * 0.7, 0]));
  // legs
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
    g.add(_box(0.05, 0.15, 0.05, wd, [sx*(o.length/2-0.04), 0.075, sz*(o.depth/2-0.04)]));
  });
  return g;
}, {
  icon: "🪣", category: "z_ai",
  params: [
    { key: "length", label: "Length", type: "number", min: 0.6, max: 2.0, step: 0.2, default: 1.2 },
    { key: "height", label: "Height", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.4 },
    { key: "depth", label: "Depth", type: "number", min: 0.25, max: 0.5, step: 0.05, default: 0.35 },
    { key: "color", label: "Wood", type: "color", default: 0x4a3820 },
  ],
});

register("hayfork", function (o) {
  const g = new THREE.Group();
  const wd = M.wood(o.color);
  const mt = M.metal(0x6a6a60);
  // handle
  g.add(_cyl(0.02, 0.02, o.height, wd, [0, o.height/2, 0], 6));
  // head base
  g.add(_box(0.02, 0.03, 0.2, mt, [0, o.height + 0.015, 0]));
  // tines
  for (let i = 0; i < 3; i++) {
    const z = -0.08 + i * 0.08;
    g.add(_cyl(0.006, 0.004, 0.15, mt, [0, o.height + 0.1, z], 4));
  }
  return g;
}, {
  icon: "🔱", category: "z_ai",
  params: [
    { key: "height", label: "Length", type: "number", min: 1.0, max: 2.0, step: 0.1, default: 1.5 },
    { key: "color", label: "Wood", type: "color", default: 0x6a4a28 },
  ],
});

// ═══════════════════════════════════════════════════════════
//  DUNGEON / PRISON
// ═══════════════════════════════════════════════════════════

register("iron_maiden", function (o) {
  const g = new THREE.Group();
  const mt = M.metal(o.color);
  const wd = M.wood(0x2a1a10);
  // body (tall box)
  g.add(_box(o.width, o.height, o.depth, wd, [0, o.height/2, 0]));
  // front door (slightly open)
  const door = _box(o.width * 0.48, o.height * 0.95, 0.04, wd, [-o.width * 0.02, o.height/2, o.depth/2]);
  door.rotation.y = 0.25;
  door.position.x -= 0.05;
  g.add(door);
  // metal bands
  [0.2, 0.5, 0.8].forEach(t => {
    g.add(_box(o.width + 0.02, 0.04, o.depth + 0.02, mt, [0, o.height * t, 0]));
  });
  // face plate
  g.add(_sph(0.08, mt, [0, o.height * 0.7, o.depth/2 + 0.02], 6));
  // spikes inside (visible from gap)
  for (let i = 0; i < 4; i++) {
    g.add(_cone(0.005, 0.06, mt, [rand(-0.1, 0.1), o.height * 0.5 + i * 0.1, 0.02], 4));
  }
  return g;
}, {
  icon: "⛓️", category: "z_ai",
  params: [
    { key: "width", label: "Width", type: "number", min: 0.5, max: 0.9, step: 0.05, default: 0.7 },
    { key: "height", label: "Height", type: "number", min: 1.4, max: 2.2, step: 0.1, default: 1.8 },
    { key: "depth", label: "Depth", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.45 },
    { key: "color", label: "Metal", type: "color", default: 0x2a2a2a },
  ],
});

register("stocks", function (o) {
  const g = new THREE.Group();
  const wd = M.wood(o.color);
  const mt = M.metal(0x3a3a38);
  // base posts
  g.add(_box(0.08, o.height, 0.08, wd, [-o.width/2, o.height/2, 0]));
  g.add(_box(0.08, o.height, 0.08, wd, [o.width/2, o.height/2, 0]));
  // bottom board with holes
  g.add(_box(o.width + 0.1, 0.08, 0.15, wd, [0, o.height * 0.7, 0]));
  // top board (locked position)
  g.add(_box(o.width + 0.1, 0.08, 0.15, wd, [0, o.height * 0.8, 0]));
  // locks
  g.add(_box(0.04, 0.1, 0.04, mt, [-o.width/2 - 0.04, o.height * 0.75, 0.08]));
  g.add(_box(0.04, 0.1, 0.04, mt, [o.width/2 + 0.04, o.height * 0.75, 0.08]));
  return g;
}, {
  icon: "🔒", category: "z_ai",
  params: [
    { key: "width", label: "Width", type: "number", min: 0.6, max: 1.2, step: 0.1, default: 0.8 },
    { key: "height", label: "Height", type: "number", min: 0.7, max: 1.2, step: 0.05, default: 0.9 },
    { key: "color", label: "Wood", type: "color", default: 0x3a2a18 },
  ],
});

register("chain_gibbet", function (o) {
  const g = new THREE.Group();
  const mt = M.rust(o.color);
  const rp = M.rope(0x4a4a40);
  // chain from top
  for (let i = 0; i < 5; i++) {
    g.add(_tor(0.03, 0.006, mt, [0, o.height - i * 0.05, 0], 5, 6));
  }
  // cage body (wireframe bars)
  const cR = o.radius;
  const cH = o.height * 0.6;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(_cyl(0.008, 0.008, cH, mt, [Math.sin(a)*cR, cH/2 + 0.15, Math.cos(a)*cR], 4));
  }
  // rings
  g.add(_tor(cR, 0.01, mt, [0, 0.15, 0], 6, 12));
  g.add(_tor(cR, 0.01, mt, [0, cH + 0.15, 0], 6, 12));
  // top cone
  g.add(_cone(cR, 0.15, mt, [0, cH + 0.3, 0], 8));
  return g;
}, {
  icon: "🪤", category: "z_ai",
  params: [
    { key: "height", label: "Height", type: "number", min: 1.0, max: 2.5, step: 0.1, default: 1.6 },
    { key: "radius", label: "Radius", type: "number", min: 0.25, max: 0.6, step: 0.05, default: 0.4 },
    { key: "color", label: "Rust", type: "color", default: 0x4a3020 },
  ],
});

// ═══════════════════════════════════════════════════════════
//  BATHROOM / WASH
// ═══════════════════════════════════════════════════════════

register("pedestal_sink", function (o) {
  const g = new THREE.Group();
  const cr = M.ceramic(o.color);
  const mt = M.metal(o.faucetColor);
  // pedestal
  g.add(_cyl(0.05, 0.08, o.height * 0.7, cr, [0, o.height * 0.35, 0], 8));
  // basin
  g.add(_cyl(o.width/2, o.width/2 * 0.8, 0.1, cr, [0, o.height * 0.7, 0], 12));
  g.add(_cyl(o.width/2 * 0.85, o.width/2 * 0.85, 0.02, M.glass(0xa0b8c8), [0, o.height * 0.74, 0], 12)); // water surface/drainer
  // back splash
  g.add(_box(o.width * 0.9, 0.15, 0.03, cr, [0, o.height * 0.82, -o.width/4]));
  // faucet
  g.add(_cyl(0.012, 0.012, 0.12, mt, [0, o.height * 0.85, -o.width/6], 6));
  const spout = _tor(0.03, 0.006, mt, [0, o.height * 0.9, -o.width/6], 6, 8);
  spout.rotation.y = Math.PI/2;
  g.add(spout);
  return g;
}, {
  icon: "🚿", category: "z_ai",
  params: [
    { key: "width", label: "Width", type: "number", min: 0.4, max: 0.8, step: 0.05, default: 0.55 },
    { key: "height", label: "Height", type: "number", min: 0.7, max: 1.0, step: 0.05, default: 0.85 },
    { key: "color", label: "Ceramic", type: "color", default: 0xf0f0f0 },
    { key: "faucetColor", label: "Faucet", type: "color", default: 0xc0c0b0 },
  ],
});

register("towel_rack", function (o) {
  const g = new THREE.Group();
  const mt = M.metal(o.color);
  const cl = M.cloth(o.towelColor);
  // wall mount
  g.add(_box(o.width + 0.04, 0.03, 0.02, mt, [0, 0, 0]));
  // bars
  for (let i = 0; i < o.bars; i++) {
    const y = -0.05 - i * 0.12;
    g.add(_cyl(0.008, 0.008, o.width, mt, [0, y, 0.03], 6));
    // brackets
    g.add(_box(0.02, 0.02, 0.04, mt, [-o.width/2, y, 0.02]));
    g.add(_box(0.02, 0.02, 0.04, mt, [o.width/2, y, 0.02]));
    // towel on bar
    if (i < o.towels) {
      g.add(_box(o.width * 0.8, 0.3, 0.04, cl, [0, y - 0.17, 0.03]));
    }
  }
  return g;
}, {
  icon: "🧻", category: "z_ai",
  params: [
    { key: "width", label: "Width", type: "number", min: 0.3, max: 0.8, step: 0.05, default: 0.5 },
    { key: "bars", label: "Bars", type: "int", min: 1, max: 3, default: 2 },
    { key: "towels", label: "Towels", type: "int", min: 0, max: 3, default: 1 },
    { key: "color", label: "Metal", type: "color", default: 0xc0c0b0 },
    { key: "towelColor", label: "Towel", type: "color", default: 0xf0e8e0 },
  ],
});

// ═══════════════════════════════════════════════════════════
//  TAVERN / PUB EXTRAS
// ═══════════════════════════════════════════════════════════

register("piano_stool", function (o) {
  const g = new THREE.Group();
  const wd = M.wood(o.color);
  const mt = M.metal(0x2a2a28);
  // round seat
  g.add(_cyl(o.radius, o.radius, 0.04, wd, [0, o.height, 0], 12));
  // cushion
  g.add(_cyl(o.radius * 0.9, o.radius * 0.9, 0.03, M.cloth(o.cushionColor), [0, o.height + 0.03, 0], 12));
  // central screw pole
  g.add(_cyl(0.025, 0.025, o.height - 0.1, mt, [0, (o.height - 0.1)/2, 0], 6));
  // base feet (3)
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(_cyl(0.02, 0.02, 0.25, mt, [Math.sin(a)*0.15, 0.125, Math.cos(a)*0.15], 4));
    g.add(_cyl(0.02, 0.025, 0.015, mt, [Math.sin(a)*0.27, 0.007, Math.cos(a)*0.27], 4));
  }
  return g;
}, {
  icon: "🪑", category: "z_ai",
  params: [
    { key: "radius", label: "Radius", type: "number", min: 0.15, max: 0.25, step: 0.01, default: 0.2 },
    { key: "height", label: "Height", type: "number", min: 0.4, max: 0.65, step: 0.05, default: 0.5 },
    { key: "color", label: "Wood", type: "color", default: 0x1a0e06 },
    { key: "cushionColor", label: "Cushion", type: "color", default: 0x2a1a10 },
  ],
});

register("chalkboard", function (o) {
  const g = new THREE.Group();
  const wd = M.wood(o.frameColor);
  const bk = M.stone(0x1a2a20); // slate
  // frame
  g.add(_box(o.width + 0.04, 0.04, 0.04, wd, [0, o.height/2, 0]));
  g.add(_box(o.width + 0.04, 0.04, 0.04, wd, [0, -o.height/2, 0]));
  g.add(_box(0.04, o.height + 0.04, 0.04, wd, [-o.width/2, 0, 0]));
  g.add(_box(0.04, o.height + 0.04, 0.04, wd, [o.width/2, 0, 0]));
  // board
  g.add(_box(o.width, o.height, 0.02, bk, [0, 0, -0.01]));
  // chalk ledge
  g.add(_box(o.width + 0.06, 0.02, 0.06, wd, [0, -o.height/2 - 0.02, 0.02]));
  // chalk pieces
  g.add(_box(0.02, 0.02, 0.02, M.wax(0xf0f0e0), [-o.width * 0.3, -o.height/2 + 0.01, 0.04]));
  g.add(_box(0.02, 0.02, 0.02, M.wax(0xe0d080), [o.width * 0.1, -o.height/2 + 0.01, 0.04]));
  return g;
}, {
  icon: "📋", category: "z_ai",
  params: [
    { key: "width", label: "Width", type: "number", min: 0.6, max: 2.0, step: 0.1, default: 1.2 },
    { key: "height", label: "Height", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 0.9 },
    { key: "frameColor", label: "Frame", type: "color", default: 0x3a2a18 },
  ],
});

register("cuckoo_clock", function (o) {
  const g = new THREE.Group();
  const wd = M.wood(o.color);
  // body (house shape)
  g.add(_box(o.width, o.height * 0.6, o.depth, wd, [0, o.height * 0.3, 0]));
  // roof
  g.add(_cone(o.width * 0.8, o.height * 0.3, wd, [0, o.height * 0.75, 0], 4));
  // clock face
  g.add(_cyl(o.width * 0.3, o.width * 0.3, 0.01, M.ceramic(0xf0f0e0), [0, o.height * 0.35, o.depth/2 + 0.005], 16));
  // hands
  g.add(_box(0.005, o.width * 0.2, 0.005, M.metal(), [0, o.height * 0.4, o.depth/2 + 0.015]));
  g.add(_box(o.width * 0.15, 0.005, 0.005, M.metal(), [0.05, o.height * 0.35, o.depth/2 + 0.015]));
  // pendulum
  g.add(_cyl(0.003, 0.003, o.height * 0.25, M.brass(), [0, o.height * 0.05, o.depth/2 + 0.02], 4));
  g.add(_sph(0.02, M.brass(), [0, -0.05, o.depth/2 + 0.02], 6));
  // pine cone weights
  [-1, 1].forEach(s => {
    g.add(_cyl(0.003, 0.003, 0.15, M.brass(), [s * o.width * 0.3, -0.05, 0], 4));
    g.add(_cone(0.02, 0.05, M.wood(0x3a2a10), [s * o.width * 0.3, -0.12, 0], 6));
  });
  return g;
}, {
  icon: "🕰️", category: "z_ai",
  params: [
    { key: "width", label: "Width", type: "number", min: 0.2, max: 0.4, step: 0.02, default: 0.3 },
    { key: "height", label: "Height", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.4 },
    { key: "depth", label: "Depth", type: "number", min: 0.08, max: 0.15, step: 0.01, default: 0.1 },
    { key: "color", label: "Wood", type: "color", default: 0x4a2a12 },
  ],
});

// ═══════════════════════════════════════════════════════════
//  MISC / UTILITY
// ═══════════════════════════════════════════════════════════

register("safe", function (o) {
  const g = new THREE.Group();
  const mt = M.metal(o.color);
  // body
  g.add(_box(o.width, o.height, o.depth, mt, [0, o.height/2, 0]));
  // door frame
  g.add(_box(o.width * 0.9, o.height * 0.9, 0.02, M.metal(o.color + 0x101010), [0, o.height/2, o.depth/2 + 0.005]));
  // wheel handle
  g.add(_tor(0.06, 0.008, M.brass(), [0, o.height/2, o.depth/2 + 0.04], 6, 12));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    g.add(_cyl(0.005, 0.005, 0.1, M.brass(), [Math.sin(a)*0.06, o.height/2 + Math.cos(a)*0.06, o.depth/2 + 0.04], 4));
  }
  // hinges
  g.add(_cyl(0.015, 0.015, 0.08, mt, [-o.width/2 + 0.03, o.height * 0.8, o.depth/2 + 0.01], 6));
  g.add(_cyl(0.015, 0.015, 0.08, mt, [-o.width/2 + 0.03, o.height * 0.2, o.depth/2 + 0.01], 6));
  return g;
}, {
  icon: "🗄️", category: "z_ai",
  params: [
    { key: "width", label: "Width", type: "number", min: 0.4, max: 0.8, step: 0.05, default: 0.55 },
    { key: "height", label: "Height", type: "number", min: 0.4, max: 0.9, step: 0.05, default: 0.65 },
    { key: "depth", label: "Depth", type: "number", min: 0.35, max: 0.7, step: 0.05, default: 0.5 },
    { key: "color", label: "Metal", type: "color", default: 0x2a3a30 },
  ],
});

register("travel_trunk", function (o) {
  const g = new THREE.Group();
  const wd = M.wood(o.color);
  const cl = M.cloth(o.clothColor);
  const mt = M.metal(o.trimColor);
  // body
  g.add(_box(o.width, o.height, o.depth, wd, [0, o.height/2, 0]));
  // cloth wrapping
  g.add(_box(o.width + 0.01, o.height * 0.7, o.depth + 0.01, cl, [0, o.height * 0.35, 0]));
  // metal corners
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => {
    g.add(_box(0.08, 0.08, 0.015, mt, [sx*(o.width/2-0.04), 0.04, sz*(o.depth/2+0.005)]));
    g.add(_box(0.08, 0.08, 0.015, mt, [sx*(o.width/2-0.04), o.height - 0.04, sz*(o.depth/2+0.005)]));
  });
  // straps
  g.add(_box(o.width + 0.02, 0.04, 0.02, M.leather(), [0, o.height * 0.6, o.depth/2 + 0.01]));
  g.add(_box(o.width + 0.02, 0.04, 0.02, M.leather(), [0, o.height * 0.3, o.depth/2 + 0.01]));
  // lock
  g.add(_box(0.05, 0.06, 0.02, mt, [0, o.height * 0.5, o.depth/2 + 0.015]));
  return g;
}, {
  icon: "🧳", category: "z_ai",
  params: [
    { key: "width", label: "Width", type: "number", min: 0.4, max: 1.0, step: 0.05, default: 0.7 },
    { key: "height", label: "Height", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.45 },
    { key: "depth", label: "Depth", type: "number", min: 0.25, max: 0.5, step: 0.05, default: 0.35 },
    { key: "color", label: "Wood", type: "color", default: 0x3a2010 },
    { key: "clothColor", label: "Cloth", type: "color", default: 0x2a3a5a },
    { key: "trimColor", label: "Trim", type: "color", default: 0x8a7a50 },
  ],
});

register("mop_bucket", function (o) {
  const g = new THREE.Group();
  const mt = M.metal(o.color);
  const wd = M.wood(0x4a3a20);
  // bucket
  g.add(_cyl(o.radius * 0.9, o.radius, o.height * 0.7, mt, [0, o.height * 0.35, 0], 10));
  // rim
  g.add(_tor(o.radius + 0.005, 0.008, mt, [0, o.height * 0.7, 0], 6, 12));
  // water
  g.add(_cyl(o.radius * 0.85, o.radius * 0.85, 0.02, M.glass(0x6090b0), [0, o.height * 0.5, 0], 10));
  // wringer attachment
  g.add(_box(o.radius * 0.6, o.height * 0.4, o.radius * 0.6, mt, [o.radius * 0.5, o.height * 0.5, 0]));
  g.add(_cyl(0.015, 0.015, o.radius * 0.5, mt, [o.radius * 0.5, o.height * 0.7, 0], 6)); // wringer handle
  // wheels
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    g.add(_cyl(0.03, 0.03, 0.02, M.rust(), [Math.sin(a)*o.radius*0.6, 0.03, Math.cos(a)*o.radius*0.6], 8));
  }
  // mop handle sticking out
  const mop = _cyl(0.012, 0.012, 1.2, wd, [0, o.height * 0.9, 0], 4);
  mop.rotation.z = 0.2;
  g.add(mop);
  // mop head
  g.add(_cyl(0.04, 0.04, 0.1, M.cloth(0xd0d0c0), [0.12, o.height * 0.35, 0], 6));
  return g;
}, {
  icon: "🧹", category: "z_ai",
  params: [
    { key: "radius", label: "Radius", type: "number", min: 0.12, max: 0.25, step: 0.01, default: 0.18 },
    { key: "height", label: "Height", type: "number", min: 0.25, max: 0.45, step: 0.05, default: 0.35 },
    { key: "color", label: "Metal", type: "color", default: 0x3a5a6a },
  ],
});

register("filing_cabinet", function (o) {
  const g = new THREE.Group();
  const mt = M.metal(o.color);
  // body
  g.add(_box(o.width, o.height, o.depth, mt, [0, o.height/2, 0]));
  // drawers
  const drawerH = o.height / o.drawers - 0.02;
  for (let i = 0; i < o.drawers; i++) {
    const y = i * (o.height / o.drawers) + drawerH/2 + 0.01;
    g.add(_box(o.width - 0.04, drawerH, 0.015, M.metal(o.color + 0x080808), [0, y, o.depth/2 + 0.005]));
    // handle
    g.add(_cyl(0.005, 0.005, o.width * 0.3, M.brass(), [0, y, o.depth/2 + 0.015], 6));
    // label holder
    g.add(_box(o.width * 0.3, 0.01, 0.005, M.brass(), [0, y + drawerH * 0.3, o.depth/2 + 0.015]));
  }
  // base feet
  g.add(_box(o.width * 0.8, 0.02, o.depth * 0.8, mt, [0, 0.01, 0]));
  return g;
}, {
  icon: "🗄️", category: "z_ai",
  params: [
    { key: "width", label: "Width", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.45 },
    { key: "height", label: "Height", type: "number", min: 0.5, max: 1.5, step: 0.1, default: 1.3 },
    { key: "depth", label: "Depth", type: "number", min: 0.3, max: 0.6, step: 0.05, default: 0.5 },
    { key: "drawers", label: "Drawers", type: "int", min: 2, max: 5, default: 4 },
    { key: "color", label: "Metal", type: "color", default: 0x4a5a5a },
  ],
});

register("gargoyle", function (o) {
  const g = new THREE.Group();
  const st = M.stone(o.color);
  // pedestal
  g.add(_box(o.baseW, o.baseH, o.baseW, st, [0, o.baseH/2, 0]));
  // body
  g.add(_box(o.scale * 0.4, o.scale * 0.3, o.scale * 0.6, st, [0, o.baseH + o.scale * 0.15, -o.scale * 0.1]));
  // head
  g.add(_sph(o.scale * 0.15, st, [0, o.baseH + o.scale * 0.35, o.scale * 0.2], 6));
  // jaw
  g.add(_box(o.scale * 0.18, o.scale * 0.06, o.scale * 0.12, st, [0, o.baseH + o.scale * 0.27, o.scale * 0.3]));
  // horns
  [-1, 1].forEach(s => {
    const horn = _cone(o.scale * 0.03, o.scale * 0.12, st, [s * o.scale * 0.08, o.baseH + o.scale * 0.45, o.scale * 0.15]);
    horn.rotation.z = s * 0.3;
    horn.rotation.x = -0.2;
    g.add(horn);
  });
  // wings
  [-1, 1].forEach(s => {
    const wing = _box(o.scale * 0.4, o.scale * 0.3, o.scale * 0.03, st);
    wing.position.set(s * o.scale * 0.3, o.baseH + o.scale * 0.3, -o.scale * 0.2);
    wing.rotation.z = s * 0.8;
    g.add(wing);
  });
  return g;
}, {
  icon: "🦇", category: "z_ai",
  params: [
    { key: "scale", label: "Scale", type: "number", min: 0.3, max: 1.5, step: 0.1, default: 0.7 },
    { key: "baseW", label: "Base W", type: "number", min: 0.25, max: 0.6, step: 0.05, default: 0.35 },
    { key: "baseH", label: "Base H", type: "number", min: 0.3, max: 0.8, step: 0.1, default: 0.5 },
    { key: "color", label: "Stone", type: "color", default: 0x5a5a58 },
  ],
});

})();
