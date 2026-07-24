// rooms.js — Rooms, parts, and the Room class.
//
//   Each room composes prefabs from window.OBJECTS (data/objects_*.js)
//   via the O(name, opts) helper. The Room class owns the group, the
//   floor, interactives, flicker lights, and tickers. scene.js calls
//   ROOMS[envId]() to build a room and adds room.group to the scene.

(function () {
  const THREE = window.THREE;
  if (!THREE) return;

  // ════════════════════════════════════════════════════════
  // Registry helpers
  // ════════════════════════════════════════════════════════
  const OBJ = window.OBJECTS || {};
  const M = OBJ.M || {};
  const rand = OBJ.rand || ((a, b) => a + Math.random() * (b - a));
  const pick = OBJ.pick || ((arr) => arr[Math.floor(Math.random() * arr.length)]);

  // O(name, opts) — prefab → THREE.Object3D, with magenta-wireframe fallback
  // so a typo never silently drops a piece. The result is tagged with its
  // origin (prefabName + prefabOpts) so the designer can recover the call
  // when round-tripping a room.
  function O(name, opts = {}) {
    const result = OBJ.create ? OBJ.create(name, opts) : null;
    if (result) {
      result.userData.prefabName = name;
      result.userData.prefabOpts = { ...opts };
      return result;
    }
    console.warn("rooms.js: prefab not found:", name);
    const ph = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff00ff, wireframe: true }),
    );
    ph.name = "missing_" + name;
    ph.userData.prefabName = name;
    ph.userData.prefabOpts = { ...opts };
    return ph;
  }

  // ════════════════════════════════════════════════════════
  // Room class
  // ════════════════════════════════════════════════════════
  class Room {
    constructor(id) {
      this.id = id;
      this.group = new THREE.Group();
      this.group.name = id;
      this.floor = null;
      this.interactives = [];
      this.flickerLights = [];
      this.tickers = [];
    }

    add(obj) {
      if (!obj) return obj;
      this.group.add(obj);
      const collect = (o) => {
        if (o.isLight && o.userData && o.userData.flicker) {
          this.flickerLights.push({ light: o, ...o.userData.flicker, seed: Math.random() * 10 });
        }
      };
      if (obj.traverse) obj.traverse(collect); else collect(obj);
      return obj;
    }

    // Sugar: place(name|obj, x, y, z, { rotY, rotX, rotZ, scale })
    place(name, x, y, z, opts = {}) {
      const o = typeof name === "string" ? O(name, opts) : name;
      o.position.set(x, y, z);
      if (opts.rotY !== undefined) o.rotation.y = opts.rotY;
      if (opts.rotX !== undefined) o.rotation.x = opts.rotX;
      if (opts.rotZ !== undefined) o.rotation.z = opts.rotZ;
      if (opts.scale !== undefined) o.scale.setScalar(opts.scale);
      this.add(o);
      return o;
    }

    setFloor(mesh) {
      this.floor = mesh;
      this.group.add(mesh);
      return mesh;
    }

    addInteractive(obj, { topic, label, hoverColor = 0xffc88a } = {}) {
      const meshes = [];
      obj.traverse((o) => { if (o.isMesh) meshes.push(o); });
      meshes.forEach((m) => {
        m.userData.interactiveRoot = obj;
        if (Array.isArray(m.material)) {
          m.material = m.material.map((mat) => mat.clone());
        } else if (m.material) {
          m.material = m.material.clone();
        }
        const ms = Array.isArray(m.material) ? m.material : [m.material];
        m.userData._origEmissive = ms.map((mat) => mat.emissive ? mat.emissive.clone() : null);
        m.userData._origEmissiveIntensity = ms.map((mat) => mat.emissiveIntensity || 0);
      });
      this.interactives.push({ root: obj, meshes, topic, label, hoverColor });
      // Stash on userData so the room can be round-tripped through the designer.
      obj.userData.interactive = { topic, label };
      this.add(obj);
      return obj;
    }

    addTicker(fn) { this.tickers.push(fn); }

    update(t, dt) {
      this.flickerLights.forEach(({ light, base, jitter, seed }) => {
        light.intensity = base
          + Math.sin(t * 11 + seed) * jitter * 0.6
          + Math.sin(t * 23 + seed * 2) * jitter * 0.4;
      });
      this.tickers.forEach((fn) => fn(t, dt));
    }

    findInteractiveFromHit(mesh) {
      let cur = mesh;
      while (cur) {
        const entry = this.interactives.find((i) => i.root === cur);
        if (entry) return entry;
        cur = cur.parent;
      }
      return null;
    }
  }

  // ════════════════════════════════════════════════════════
  // Scatter helpers — distribute many small items in a region.
  // ════════════════════════════════════════════════════════

  // Scatter `count` instances of `names[]` inside a rect.
  // opts: { yJitter, scaleMin, scaleMax, rotMin, rotMax, avoid: [{x,z,r}] }
  function scatter(r, names, count, x0, z0, x1, z1, opts = {}) {
    const scaleMin = opts.scaleMin ?? 0.7;
    const scaleMax = opts.scaleMax ?? 1.1;
    const yBase = opts.y ?? 0;
    const avoid = opts.avoid || [];
    let placed = 0, attempts = 0;
    while (placed < count && attempts < count * 6) {
      attempts++;
      const x = rand(x0, x1), z = rand(z0, z1);
      let blocked = false;
      for (const a of avoid) {
        if ((x - a.x) ** 2 + (z - a.z) ** 2 < a.r * a.r) { blocked = true; break; }
      }
      if (blocked) continue;
      const o = O(pick(names), {});
      o.position.set(x, yBase, z);
      o.rotation.y = Math.random() * Math.PI * 2;
      o.scale.setScalar(rand(scaleMin, scaleMax));
      r.add(o);
      placed++;
    }
  }

  // Drop a tiny pile of book-like objects on a flat surface at (x,y,z).
  function bookPile(r, x, y, z, count = 3, colors = [0x6b2a1a, 0x2a4830, 0x4a2a52, 0x6b4f1f, 0x222a3c]) {
    let yy = y;
    for (let i = 0; i < count; i++) {
      const b = O("book", {
        width: rand(0.10, 0.16), height: 0.04 + Math.random() * 0.03,
        depth: rand(0.18, 0.24), color: pick(colors), title: "",
      });
      b.position.set(x + rand(-0.04, 0.04), yy + 0.02, z + rand(-0.04, 0.04));
      b.rotation.y = (Math.random() - 0.5) * 0.4;
      r.add(b);
      yy += 0.05;
    }
  }

  // Build the standard 4-wall + ceiling shell around a room.
  function buildShell(r, { W = 14, D = 12, H = 5,
                          floorColor = 0x4a3220, wallColor = 0x2a2018,
                          ceilColor = 0x1a1208, beamColor = 0x2a1810,
                          ceiling = true, beams = true } = {}) {
    const halfW = W / 2, halfD = D / 2;

    r.setFloor(O("floor", { width: W, depth: D, color: floorColor }));

    const w1 = O("wall", { width: W, height: H, color: wallColor });
    w1.position.set(0, H / 2, -halfD); r.add(w1);
    const w2 = O("wall", { width: W, height: H, color: wallColor });
    w2.position.set(0, H / 2, halfD); w2.rotation.y = Math.PI; r.add(w2);
    const w3 = O("wall", { width: D, height: H, color: wallColor });
    w3.position.set(-halfW, H / 2, 0); w3.rotation.y = Math.PI / 2; r.add(w3);
    const w4 = O("wall", { width: D, height: H, color: wallColor });
    w4.position.set(halfW, H / 2, 0); w4.rotation.y = -Math.PI / 2; r.add(w4);

    if (ceiling) {
      const c = O("wall", { width: W, height: D, color: ceilColor });
      c.position.set(0, H, 0); c.rotation.x = Math.PI / 2;
      c.userData.noCollide = true; r.add(c);
    }
    if (beams) {
      for (let i = -2; i <= 2; i++) {
        const b = O("beam", { length: W, color: beamColor });
        b.position.set(i * 1.8, H - 0.18, 0);
        b.rotation.y = Math.PI / 2;
        b.userData.noCollide = true;
        r.add(b);
      }
    }
    return { halfW, halfD, H };
  }

  // ════════════════════════════════════════════════════════
  // BUILDER: THE STUDY — cluttered, lived-in workroom
  // ════════════════════════════════════════════════════════
  function buildStudy() {
    const r = new Room("room");
    const W = 14, D = 12, H = 5;
    const { halfW, halfD } = buildShell(r, { W, D, H });

    // ── BACK WALL: window + hanging stuff ──
    const win = O("window", { width: 1.6, height: 2.8, light: 2.8 });
    win.position.set(3.2, 2.8, -halfD + 0.05);
    r.add(win);

    // Two paintings flanking the window
    r.place("painting", -3.5, 3.0, -halfD + 0.06);
    r.place("painting", 0.4, 3.0, -halfD + 0.06, { scale: 0.85 });
    r.place("tapestry", -1.6, 2.9, -halfD + 0.06, { scale: 0.85 });

    // Wall sconces on back wall, glowing
    [-5.5, -2.5, 0.4, 4.8].forEach((x) => {
      const s = r.place("wallSconce", x, 3.2, -halfD + 0.08);
      s.scale.setScalar(0.9);
      const g = new THREE.PointLight(0xffb060, 0.5, 3.5, 2);
      g.position.set(x, 3.0, -halfD + 0.4);
      g.userData.flicker = { base: 0.5, jitter: 0.15 };
      r.add(g);
    });

    // Below the window — a low cabinet + clutter
    r.place("cabinet", 3.2, 0, -halfD + 0.55, { rotY: 0 });
    r.place("vaseTall", 2.5, 0.85, -halfD + 0.5, { scale: 0.9 });
    r.place("vase", 3.7, 0.85, -halfD + 0.5, { scale: 0.85 });
    r.place("hourglass", 3.2, 0.85, -halfD + 0.45, { scale: 0.8 });

    // ── LEFT WALL: fireplace + bench + tapestries ──
    const fp = O("fireplace_3", {});
    fp.position.set(-halfW + 0.5, 0, -1.4);
    fp.rotation.y = Math.PI / 2;
    r.add(fp);
    const fireGlow = new THREE.PointLight(0xff7030, 1.4, 7, 1.6);
    fireGlow.position.set(-halfW + 1.0, 0.7, -1.4);
    fireGlow.userData.flicker = { base: 1.4, jitter: 0.5 };
    r.add(fireGlow);

    // Mantle clutter
    const mantleY = 1.55;
    r.place("clock", -halfW + 0.55, mantleY, -2.2, { rotY: Math.PI / 2, scale: 0.85 });
    r.place("candelabra", -halfW + 0.55, mantleY, -0.55, { rotY: Math.PI / 2, scale: 0.9 });
    r.place("hourglass", -halfW + 0.55, mantleY, -1.4, { rotY: Math.PI / 2, scale: 0.85 });

    // Logs / firewood next to fireplace
    r.place("crate", -halfW + 0.6, 0, 0.8, { scale: 0.8, rotY: 0.3 });
    bookPile(r, -halfW + 0.5, 0.65, 0.8, 2);

    // Tapestry above fireplace
    r.place("tapestry", -halfW + 0.07, 3.4, -1.4, { rotY: Math.PI / 2, scale: 0.95 });

    // Painting further down the left wall
    r.place("painting", -halfW + 0.08, 3.0, 2.5, { rotY: Math.PI / 2 });

    // Wall sconces on left wall
    [-3.0, 0.5, 3.8].forEach((z) => {
      const s = r.place("wallSconce", -halfW + 0.1, 3.0, z, { rotY: Math.PI / 2, scale: 0.85 });
      const g = new THREE.PointLight(0xffb060, 0.45, 3.5, 2);
      g.position.set(-halfW + 0.5, 2.9, z);
      g.userData.flicker = { base: 0.45, jitter: 0.13 };
      r.add(g);
    });

    // ── RIGHT WALL: tall bookcases + clutter ──
    const shelf1 = O("bookcase", {});
    shelf1.position.set(halfW - 0.2, 0, -1.8);
    shelf1.rotation.y = -Math.PI / 2;
    r.add(shelf1);
    const shelf2 = O("bookcase", {});
    shelf2.position.set(halfW - 0.2, 0, 0.8);
    shelf2.rotation.y = -Math.PI / 2;
    r.add(shelf2);
    const shelf3 = O("bookshelf_tall", {});
    shelf3.position.set(halfW - 0.15, 0, 3.4);
    shelf3.rotation.y = -Math.PI / 2;
    r.add(shelf3);

    // A grandfather clock between bookcases
    r.place("grandfather_clock", halfW - 0.4, 0, -3.8);

    // Stack of books on the floor by the shelf
    bookPile(r, halfW - 0.9, 0, -3.0, 4);
    bookPile(r, halfW - 0.6, 0, 2.2, 3);

    // Wall sconces on right wall
    [-3.2, 0.0, 3.5].forEach((z) => {
      r.place("wallSconce", halfW - 0.1, 3.0, z, { rotY: -Math.PI / 2, scale: 0.85 });
      const g = new THREE.PointLight(0xffb060, 0.45, 3.5, 2);
      g.position.set(halfW - 0.5, 2.9, z);
      g.userData.flicker = { base: 0.45, jitter: 0.13 };
      r.add(g);
    });

    // ── FRONT-ish: rug, seating, coffee table, character spot ──
    const rug = O("rug", { width: 5, depth: 6, color: 0x4a2a22 });
    rug.position.set(0, 0.005, -0.4);
    r.add(rug);

    // Armchairs + pillows
    const chair = O("armchair", { color: 0x6a2a22 });
    chair.position.set(-2.6, 0, -1.0);
    chair.rotation.y = 0.55;
    r.add(chair);
    r.place("pillow", -2.6, 0.55, -1.0, { rotY: 0.55, scale: 0.9 });

    const chair2 = O("armchair", { color: 0x3a2a4a });
    chair2.position.set(2.6, 0, -1.0);
    chair2.rotation.y = -0.55;
    r.add(chair2);
    r.place("pillow", 2.6, 0.55, -1.0, { rotY: -0.55, scale: 0.9 });

    // Side tables flanking
    r.place("sideTable", -3.6, 0, -2.4);
    r.place("oil_lamp", -3.6, 0.62, -2.4);
    r.place("mug", -3.6 + 0.18, 0.66, -2.2, { scale: 1 });
    r.place("hourglass", -3.6 - 0.15, 0.65, -2.4, { scale: 0.7 });

    r.place("sideTable", 3.6, 0, -2.4);
    r.place("oil_lamp", 3.6, 0.62, -2.4);
    r.place("crystal_ball", 3.4, 0.66, -2.4, { scale: 0.85 });
    r.place("bottle", 3.8, 0.66, -2.4);

    // Coffee table in front of character
    const coffee = O("coffeeTable", {});
    coffee.position.set(0, 0, 1.0);
    r.add(coffee);
    // Coffee table clutter
    r.place("hourglass", -0.45, 0.45, 1.05, { scale: 0.85 });
    r.place("globe", 0.4, 0.45, 1.0, { scale: 0.9 });
    r.place("mug", -0.2, 0.45, 1.25, { scale: 1.0 });
    r.place("plate", -0.15, 0.44, 1.25, { scale: 0.9 });

    // ── Interactive topic books on the coffee table ──
    [
      { title: "On Tools",          topic: "work_tool", color: 0x6b2a1a, x: -0.30 },
      { title: "What Was Left Out", topic: "lessons",   color: 0x2a4830, x:  0.00 },
      { title: "What's Ahead",      topic: "ahead",     color: 0x4a2a52, x:  0.30 },
    ].forEach((b) => {
      const book = O("book", {
        width: 0.13, height: 0.32, depth: 0.22,
        color: b.color, title: b.title,
      });
      book.position.set(b.x, 0.60, 0.80);
      book.rotation.y = (b.x) * 4.0;
      r.addInteractive(book, { topic: b.topic, label: b.title });
    });

    // "Care" — on the mantle
    const careBook = O("book", {
      width: 0.13, height: 0.36, depth: 0.22,
      color: 0x222a3c, title: "Care",
    });
    careBook.position.set(-halfW + 0.55, mantleY + 0.04, -1.4);
    careBook.rotation.y = Math.PI / 2;
    r.addInteractive(careBook, { topic: "care", label: "Care" });

    // "Who I Am" — open on the armchair
    const meBook = O("book", {
      width: 0.30, height: 0.04, depth: 0.22,
      color: 0x6b4f1f, title: "Who I Am",
    });
    meBook.position.set(-2.6, 0.55, -1.0);
    meBook.rotation.y = 0.55;
    r.addInteractive(meBook, { topic: "who", label: "Who I Am" });

    // ── DESK in the back-left, set against the wall ──
    r.place("writing_desk", -4.8, 0, -halfD + 1.0, { rotY: 0.1 }) || r.place("desk", -4.8, 0, -halfD + 1.0, { rotY: 0.1 });
    r.place("oil_lamp", -5.3, 0.82, -halfD + 1.0, { scale: 0.9 });
    r.place("hourglass", -4.5, 0.82, -halfD + 1.0, { scale: 0.85 });
    bookPile(r, -4.8, 0.82, -halfD + 0.85, 3);
    r.place("mug", -4.4, 0.85, -halfD + 1.2);

    // ── Decorative corners ──
    r.place("potted_plant", -halfW + 0.6, 0, halfD - 0.8, { scale: 1.05 });
    r.place("plantFern", halfW - 0.6, 0, halfD - 0.8, { scale: 1.05 });
    r.place("potted_plant", -halfW + 0.6, 0, -halfD + 0.7, { scale: 0.9 });
    r.place("plantFern", halfW - 0.6, 0, -halfD + 0.7, { scale: 0.9 });

    // Floor candle clusters
    [[-1.8, 0, 2.3], [1.8, 0, 2.3], [-4.2, 0, -3.5]].forEach(([x, y, z]) => {
      for (let i = 0; i < 3; i++) {
        const c = O("candle", {});
        c.position.set(x + rand(-0.15, 0.15), y, z + rand(-0.15, 0.15));
        c.scale.setScalar(rand(0.9, 1.3));
        r.add(c);
      }
      const g = new THREE.PointLight(0xffb060, 0.3, 1.8, 2);
      g.position.set(x, 0.4, z);
      g.userData.flicker = { base: 0.3, jitter: 0.18 };
      r.add(g);
    });

    // Loose books scattered around the floor near shelves
    bookPile(r, halfW - 1.4, 0, -1.0, 2);
    bookPile(r, -3.0, 0, -3.5, 2);

    // Small scatter of crystal balls / hourglasses on shelves (visual flair)
    [[halfW - 0.25, 1.5, -1.8], [halfW - 0.25, 2.0, 0.8], [halfW - 0.25, 2.5, 3.4]].forEach(([x, y, z]) => {
      r.place(pick(["crystal_ball", "hourglass", "vase"]), x, y, z, { rotY: -Math.PI / 2, scale: 0.7 });
    });

    // ── Hanging chandelier overhead ──
    const chand = O("chandelier_ornate", {});
    chand.position.set(0, H - 1.0, -0.5);
    chand.userData.noCollide = true;
    r.add(chand);
    const chandLight = new THREE.PointLight(0xffd49a, 0.8, 7, 1.6);
    chandLight.position.set(0, H - 1.6, -0.5);
    chandLight.userData.flicker = { base: 0.8, jitter: 0.1 };
    r.add(chandLight);

    // ── Ambient ──
    r.add(new THREE.HemisphereLight(0x6a5a48, 0x080604, 0.35));

    return r;
  }

  // ════════════════════════════════════════════════════════
  // BUILDER: THE GARDEN — overgrown, full of small things
  // ════════════════════════════════════════════════════════
  function buildGarden() {
    const r = new Room("garden");

    const floor = O("floor", { size: 28, color: 0x2a3a26, shape: "circle" });
    r.setFloor(floor);

    r.add(O("skyDome", { top: "#8ab0c8", bottom: "#3a4030" }));
    const sun = new THREE.DirectionalLight(0xfff4d8, 1.7);
    sun.position.set(8, 12, 6); r.add(sun);
    r.add(new THREE.HemisphereLight(0x88a8c8, 0x2a3a26, 0.55));

    // Stone paving ring under the speaking spot
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const stone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.05, 8),
        (M.stone || ((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })))(0x6a5e52),
      );
      stone.position.set(Math.sin(a) * 1.8, 0.025, Math.cos(a) * 1.8);
      stone.rotation.y = Math.random() * Math.PI;
      r.add(stone);
    }
    const dais = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.0, 0.04, 32),
      (M.stone || ((c) => new THREE.MeshStandardMaterial({ color: c })))(0x7a6e62),
    );
    dais.position.y = 0.02; r.add(dais);

    // ── Trees ring 1: large canopy (perimeter) ──
    const bigTrees = [
      ["oak_tree", -7, -4], ["willow_tree", -10, 0], ["cherry_blossom", -8, 5],
      ["oak_tree", 8, -5], ["willow_tree", 11, 2], ["cherry_blossom", 9, 7],
      ["pine_tree", -4, -9], ["pine_tree", 4, -8], ["dead_tree", -11, -3],
      ["pine_tree", 12, -1], ["oak_tree", 0, -12], ["cherry_blossom", -3, 10],
      ["willow_tree", 5, 11], ["pine_tree", -8, 8], ["oak_tree", 9, 9],
    ];
    bigTrees.forEach(([type, x, z]) => {
      const t = O(type, {});
      t.position.set(x, 0, z);
      t.rotation.y = Math.random() * Math.PI * 2;
      t.scale.setScalar(rand(0.75, 1.0)); // smaller scale = denser feel
      r.add(t);
    });

    // ── Trees ring 2: medium / saplings, packed inward ──
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rand(-0.15, 0.15);
      const rad = rand(5, 9);
      const t = O(pick(["bush", "cherry_blossom", "pine_tree", "bush", "bush"]), {});
      t.position.set(Math.sin(a) * rad, 0, Math.cos(a) * rad);
      t.rotation.y = Math.random() * Math.PI * 2;
      t.scale.setScalar(rand(0.45, 0.75));
      r.add(t);
    }

    // ── Hedge ring on the perimeter ──
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const rad = 12.5 + Math.random() * 0.8;
      const h = O(pick(["bush", "hedge", "bush"]), {});
      h.position.set(Math.sin(a) * rad, 0, Math.cos(a) * rad);
      h.scale.setScalar(rand(0.8, 1.2));
      r.add(h);
    }

    // ── Carpet of small flora ──
    const center = [{ x: 0, z: 0, r: 2.6 }, { x: -5, z: 5, r: 3.5 }];  // avoid speaking spot + pond
    scatter(r, ["flower_cluster", "flower_bed", "tall_grass", "sunflower", "flower"], 60,
      -11, -11, 11, 11, { scaleMin: 0.55, scaleMax: 1.0, avoid: center });

    // ── Mushrooms in shaded patches ──
    scatter(r, ["mushroom_cluster", "mushroom_ring"], 12,
      -10, -10, 10, 10, { scaleMin: 0.5, scaleMax: 0.9, avoid: center });

    // ── Rocks / mossy stones around the edges ──
    scatter(r, ["rock", "moss_rock"], 14,
      -11, -11, 11, 11, { scaleMin: 0.4, scaleMax: 0.8, avoid: center });

    // ── Pond + lily pads ──
    r.place("pond", -5, 0, 5);
    r.place("lily_pad_cluster", -5.2, 0.06, 5.1);
    r.place("lily_pad_cluster", -4.5, 0.06, 4.5, { rotY: 1.0 });
    r.place("flower_cluster", -3.6, 0, 5.4, { scale: 0.7 });
    r.place("tall_grass", -6.0, 0, 6.2, { scale: 0.85 });
    r.place("fallen_log", -3.8, 0, 4.2, { rotY: 0.5, scale: 0.85 });

    // ── Stone bench — interactive ──
    const bench = O("stone_bench", {});
    bench.position.set(2.6, 0, -2.2);
    bench.rotation.y = -0.6;
    r.addInteractive(bench, { topic: "care", label: "The bench" });

    // ── Birdbath, sundial, statue — atmosphere details ──
    r.place("birdbath", 1.4, 0, -3.0);
    r.place("sundial", 3.6, 0, -3.4);
    r.place("statue", -3.5, 0, -4.0, { scale: 0.95, rotY: 0.3 });

    // ── Crystal clusters tucked between roots ──
    scatter(r, ["crystal_cluster"], 8, -10, -10, 10, 10, {
      scaleMin: 0.6, scaleMax: 1.0, avoid: center,
    });

    // ── Lampposts + hanging lanterns for evening warmth ──
    r.place("lamppost", -3.5, 0, 3.0);
    r.place("lamppost",  3.5, 0, 3.0);
    r.place("lamppost", -3.5, 0, -3.0);
    r.place("lamppost",  3.5, 0, -3.0);
    [[-3.5, 3.0], [3.5, 3.0], [-3.5, -3.0], [3.5, -3.0]].forEach(([x, z]) => {
      const g = new THREE.PointLight(0xffb070, 0.35, 4.5, 2);
      g.position.set(x, 2.6, z);
      g.userData.flicker = { base: 0.35, jitter: 0.08 };
      r.add(g);
    });

    // Hanging lanterns from a few trees
    [[6, 0, 4], [-7, 0, -3], [2, 0, 6]].forEach(([x, y, z]) => {
      r.place("paper_lantern", x, 2.6, z, { scale: 0.8 });
    });

    // ── Dust motes drifting ──
    const dust = new THREE.Group();
    for (let i = 0; i < 60; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xfff0c8 }),
      );
      m.position.set(rand(-8, 8), rand(0.5, 4.5), rand(-8, 8));
      m.userData.phase = Math.random() * Math.PI * 2;
      m.userData.basey = m.position.y;
      dust.add(m);
    }
    r.add(dust);
    r.addTicker((t) => {
      dust.children.forEach((d) => {
        d.position.y = d.userData.basey + Math.sin(t * 0.8 + d.userData.phase) * 0.15;
      });
    });

    return r;
  }

  // ════════════════════════════════════════════════════════
  // BUILDER: THE LIBRARY — long hall, every surface covered
  // ════════════════════════════════════════════════════════
  function buildLibrary() {
    const r = new Room("library");
    const W = 18, D = 26, H = 7;
    const halfW = W / 2, halfD = D / 2;

    r.setFloor(O("floor", { width: W, depth: D, color: 0x2a1f14 }));

    // Walls
    const back = O("wall", { width: W, height: H, color: 0x1a1208 });
    back.position.set(0, H / 2, -halfD); r.add(back);
    const front = O("wall", { width: W, height: H, color: 0x1a1208 });
    front.position.set(0, H / 2, halfD); front.rotation.y = Math.PI; r.add(front);
    const lw = O("wall", { width: D, height: H, color: 0x2a2018 });
    lw.position.set(-halfW, H / 2, 0); lw.rotation.y = Math.PI / 2; r.add(lw);
    const rw = O("wall", { width: D, height: H, color: 0x2a2018 });
    rw.position.set(halfW, H / 2, 0); rw.rotation.y = -Math.PI / 2; r.add(rw);
    const ceil = O("wall", { width: W, height: D, color: 0x100806 });
    ceil.position.set(0, H, 0); ceil.rotation.x = Math.PI / 2;
    ceil.userData.noCollide = true; r.add(ceil);

    // ── 7 bookcases per side along the side walls ──
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 7; i++) {
        const z = -i * 3.4 + 9;
        if (Math.abs(z) > halfD - 1) continue;
        const sh = O(i % 2 === 0 ? "bookcase" : "bookshelf_tall", {});
        sh.position.set(side * (halfW - 0.2), 0, z);
        sh.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2;
        r.add(sh);
      }
    }

    // Central red runner
    const runner = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, D - 2),
      (M.cloth || ((c) => new THREE.MeshStandardMaterial({ color: c })))(0x6a2a22),
    );
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(0, 0.005, 0);
    r.add(runner);

    // ── Four chandeliers down the spine ──
    for (let i = 0; i < 4; i++) {
      const c = O("chandelier_ornate", {});
      c.position.set(0, H - 0.7, i * 5.5 - 8);
      c.userData.noCollide = true;
      r.add(c);
      const glow = new THREE.PointLight(0xffd49a, 0.9, 9, 1.6);
      glow.position.set(0, H - 1.4, i * 5.5 - 8);
      glow.userData.flicker = { base: 0.9, jitter: 0.12 };
      r.add(glow);
    }

    // ── Writing desk at the far end with map_table & clutter ──
    r.place("writing_desk", -2.4, 0, -halfD + 2.2, { rotY: Math.PI });
    r.place("globe", -2.9, 0.85, -halfD + 2.2, { scale: 0.9 });
    r.place("hourglass", -2.0, 0.85, -halfD + 2.2, { scale: 0.9 });
    r.place("oil_lamp", -2.4, 0.85, -halfD + 2.55, { scale: 1 });
    bookPile(r, -2.4, 0.85, -halfD + 1.9, 4);

    r.place("map_table", 2.4, 0, -halfD + 2.5);
    r.place("candelabra", 2.4, 0.85, -halfD + 2.5, { scale: 0.85 });
    r.place("hourglass", 2.0, 0.85, -halfD + 2.5, { scale: 0.8 });
    r.place("crystal_ball", 2.8, 0.85, -halfD + 2.5, { scale: 0.85 });
    bookPile(r, 2.4, 0.85, -halfD + 2.1, 3);

    // ── Reading ladders against shelves ──
    r.place("ladder", -halfW + 1.4, 0, -3.5, { rotY: 0.3 });
    r.place("ladder", halfW - 1.4, 0, 5.0, { rotY: -0.3 });

    // ── Reading chairs scattered along the hall ──
    [[-2.0, 4.0, 0.4], [2.0, 0.0, -0.4], [-1.8, -5.0, 0.5]].forEach(([x, z, rot]) => {
      r.place("armchair", x, 0, z, { rotY: rot, scale: 0.95 });
      r.place("sideTable", x + 1.2, 0, z, { scale: 0.85 });
      r.place("oil_lamp", x + 1.2, 0.62, z, { scale: 0.85 });
      bookPile(r, x + 1.2, 0.62, z - 0.15, 2);
    });

    // ── Loose book piles all the way along the runner ──
    [[-0.8, -7], [0.7, -4.5], [-0.6, 6], [0.6, 8]].forEach(([x, z]) => {
      bookPile(r, x, 0, z, 4);
    });

    // ── Chests + crates against the back wall ──
    r.place("chest_2", -halfW + 1.2, 0, -halfD + 0.6, { scale: 0.9 });
    r.place("chest_2", halfW - 1.2, 0, -halfD + 0.6, { scale: 0.9, rotY: 0.2 });
    r.place("crate", -halfW + 2.4, 0, -halfD + 0.6, { scale: 0.85 });
    r.place("barrel", halfW - 2.4, 0, -halfD + 0.6, { scale: 0.8 });

    // ── Three interactive standing books on the runner (entry points) ──
    [
      { title: "The Slow Autumn", topic: "work_object", color: 0x4a2a52, x: -0.4, z: -1.0 },
      { title: "What's Ahead",    topic: "ahead",       color: 0x6b4f1f, x:  0.3, z: -2.5 },
      { title: "Care",            topic: "care",        color: 0x222a3c, x: -0.2, z: -4.0 },
    ].forEach((b) => {
      const book = O("book", {
        width: 0.14, height: 0.42, depth: 0.22,
        color: b.color, title: b.title,
      });
      book.position.set(b.x, 0.21, b.z);
      book.rotation.y = (Math.random() - 0.5) * 0.6;
      r.addInteractive(book, { topic: b.topic, label: b.title });
    });

    // ── Plants, sculptures, hanging things ──
    r.place("potted_plant", -halfW + 0.7, 0, halfD - 1.5, { scale: 1.1 });
    r.place("plantFern", halfW - 0.7, 0, halfD - 1.5, { scale: 1.1 });
    r.place("sculpture", -halfW + 0.8, 0, 1.4, { scale: 0.95 });
    r.place("statue", halfW - 0.8, 0, -1.4, { scale: 0.95 });

    // ── Wall sconces between bookcases ──
    for (let side = -1; side <= 1; side += 2) {
      for (let z = -10; z <= 10; z += 3.4) {
        if (Math.random() > 0.6) continue;
        r.place("wallSconce", side * (halfW - 0.1), 4.5, z, { rotY: side === -1 ? Math.PI / 2 : -Math.PI / 2, scale: 0.9 });
      }
    }

    // ── Ambient ──
    r.add(new THREE.HemisphereLight(0x4a3a28, 0x100806, 0.35));

    return r;
  }

  // ════════════════════════════════════════════════════════
  // BUILDER: THE OBSERVATORY — open mirror floor with ritual objects
  // ════════════════════════════════════════════════════════
  function buildObservatory() {
    const r = new Room("observatory");

    // Black-mirror floor
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(10, 64),
      new THREE.MeshStandardMaterial({ color: 0x080608, roughness: 0.2, metalness: 0.5 }),
    );
    floor.rotation.x = -Math.PI / 2;
    r.setFloor(floor);

    // Inscribed rings
    for (let rad = 1.4; rad < 9; rad += 0.9) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(rad - 0.006, rad + 0.006, 96),
        new THREE.MeshBasicMaterial({ color: 0xd4a373, transparent: true, opacity: 0.22 }),
      );
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.001;
      r.add(ring);
    }

    // Sky
    const stars = O("starDome", {});
    r.add(stars);

    // ── Telescope at the speaking spot ──
    r.place("telescope", 0, 0, -1.0, { rotY: Math.PI });

    // ── 12 standing stones / obelisks / runestones around the perimeter ──
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const name = ["obelisk", "runestone", "statue"][i % 3];
      const o = O(name, {});
      o.position.set(Math.sin(a) * 7.5, 0, Math.cos(a) * 7.5);
      o.rotation.y = -a;
      o.scale.setScalar(rand(0.8, 1.0));
      r.add(o);
    }

    // ── Crystal clusters scattered, catching reflections ──
    for (let i = 0; i < 28; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = rand(2.0, 6.5);
      const c = O("crystal_cluster", {});
      c.position.set(Math.sin(a) * rad, 0, Math.cos(a) * rad);
      c.rotation.y = Math.random() * Math.PI * 2;
      c.scale.setScalar(rand(0.5, 1.2));
      r.add(c);
    }

    // ── Braziers at the inner ring ──
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.sin(a) * 3.5, z = Math.cos(a) * 3.5;
      r.place("brazier", x, 0, z, { scale: 0.95 });
      const g = new THREE.PointLight(0xff7030, 1.0, 5.0, 1.8);
      g.position.set(x, 1.2, z);
      g.userData.flicker = { base: 1.0, jitter: 0.4 };
      r.add(g);
    }

    // ── Candles in clusters between the rings ──
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const rad = rand(1.5, 7.0);
      const c = O("candle", {});
      c.position.set(Math.sin(a) * rad, 0, Math.cos(a) * rad);
      c.scale.setScalar(rand(0.8, 1.4));
      r.add(c);
    }
    // A few warm pools of light over the candles
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.2;
      const rad = rand(2.5, 5.5);
      const g = new THREE.PointLight(0xffb070, 0.25, 2.5, 2);
      g.position.set(Math.sin(a) * rad, 0.4, Math.cos(a) * rad);
      g.userData.flicker = { base: 0.25, jitter: 0.12 };
      r.add(g);
    }

    // ── Floating orbs (interactive — each jumps to a topic) ──
    const orbTopics = [
      { topic: "now",     label: "Now"     },
      { topic: "ahead",   label: "Ahead"   },
      { topic: "lessons", label: "Lessons" },
      { topic: "asks",    label: "Asks"    },
      { topic: "who",     label: "Who"     },
    ];
    const orbs = [];
    orbTopics.forEach((o, i) => {
      const orb = O("orb", { radius: rand(0.20, 0.32) });
      const a = (i / orbTopics.length) * Math.PI * 2;
      orb.position.set(Math.sin(a) * 4, rand(1.6, 2.8), Math.cos(a) * 4);
      orb.userData.basePos = orb.position.clone();
      orb.userData.phase = Math.random() * Math.PI * 2;
      r.addInteractive(orb, { topic: o.topic, label: o.label });
      orbs.push(orb);
    });

    r.add(new THREE.HemisphereLight(0x4a4a6a, 0x080610, 0.45));
    r.add(new THREE.AmbientLight(0x6a6a8a, 0.18));

    r.addTicker((t) => {
      stars.rotation.y = t * 0.01;
      orbs.forEach((o) => {
        o.position.y = o.userData.basePos.y + Math.sin(t * 0.6 + o.userData.phase) * 0.3;
        o.rotation.y = t * 0.2;
      });
    });

    return r;
  }

  // ════════════════════════════════════════════════════════
  // BUILDER: THE WORKSHOP — sooty, productive, crowded with tools
  // ════════════════════════════════════════════════════════
  function buildWorkshop() {
    const r = new Room("workshop");
    const W = 14, D = 12, H = 4.6;
    const { halfW, halfD } = buildShell(r, {
      W, D, H,
      floorColor: 0x2a1f15, wallColor: 0x261c14,
      ceilColor: 0x100a05, beamColor: 0x3a2810,
    });

    // ── Forge against the back-left, glowing hot ──
    r.place("forge", -halfW + 1.2, 0, -halfD + 1.0, { rotY: 0.0 });
    const forgeGlow = new THREE.PointLight(0xff5020, 1.8, 7, 1.4);
    forgeGlow.position.set(-halfW + 1.2, 0.8, -halfD + 1.0);
    forgeGlow.userData.flicker = { base: 1.8, jitter: 0.6 };
    r.add(forgeGlow);

    // ── Anvil + hammer stand in front of the forge ──
    r.place("anvil", -halfW + 2.8, 0, -halfD + 2.2);
    r.place("anvil", -halfW + 2.0, 0, 1.0, { rotY: 0.4, scale: 0.9 });

    // ── Workbenches along the walls (stand-in: writing_desk + dining_table) ──
    r.place("writing_desk", halfW - 1.2, 0, -3.0, { rotY: -Math.PI / 2 });
    r.place("dining_table", halfW - 1.4, 0, 0.5, { rotY: -Math.PI / 2, scale: 0.9 });
    // Workbench clutter
    r.place("hourglass", halfW - 1.5, 0.85, -3.2, { scale: 0.7 });
    r.place("oil_lamp", halfW - 1.5, 0.85, -2.6, { scale: 0.9 });
    r.place("mortar_pestle", halfW - 1.4, 0.85, -3.5, { scale: 1.1 });
    r.place("mortar_pestle", halfW - 1.4, 0.85, 0.3, { scale: 1.1 });
    r.place("bottle", halfW - 1.7, 0.85, 0.7, { scale: 1.0 });
    r.place("bottle", halfW - 1.3, 0.85, 0.9, { scale: 1.0 });
    bookPile(r, halfW - 1.4, 0.85, -2.8, 2);

    // ── Crate / barrel stacks around the perimeter ──
    r.place("crate_stack", -halfW + 0.9, 0, halfD - 1.5, { rotY: 0.2 });
    r.place("barrel_stack", -halfW + 0.9, 0, halfD - 3.2, { rotY: -0.2 });
    r.place("crate_stack", halfW - 1.0, 0, halfD - 1.5, { rotY: -0.2 });
    r.place("crate", -3.5, 0, halfD - 0.6, { scale: 1.0 });
    r.place("crate", -2.4, 0, halfD - 0.6, { scale: 0.9, rotY: 0.3 });
    r.place("barrel", 2.6, 0, halfD - 0.7, { scale: 1.0 });
    r.place("barrel", 3.4, 0, halfD - 0.7, { scale: 0.9, rotY: 0.3 });

    // ── Spinning wheel + pottery wheel ──
    r.place("spinning_wheel", -3.6, 0, 2.4, { rotY: 0.6 });
    r.place("pottery_wheel", 0.5, 0, 2.6, { rotY: -0.2 });

    // ── A wagon wheel leaning against the wall ──
    r.place("wagon_wheel", -halfW + 0.3, 0.4, 3.5, { rotZ: Math.PI / 2, rotY: Math.PI / 2 });

    // ── Tool racks on the walls (weapon_rack stands in for a tool rack) ──
    r.place("weapon_rack", -halfW + 0.15, 0, -3.4, { rotY: Math.PI / 2, scale: 0.9 });
    r.place("herb_rack", halfW - 0.1, 2.0, 2.4, { rotY: -Math.PI / 2 });
    r.place("pot_rack", -3.0, 3.6, 0, { scale: 1.0 });

    // ── A hanging sign over the door ──
    r.place("hanging_sign", 0, 3.4, halfD - 0.2);

    // ── Forge clutter: hammers (using mortar_pestle as proxy), wine bottles for oil ──
    bookPile(r, -halfW + 4.0, 0, -halfD + 1.5, 2, [0x4a2a1a, 0x6a4a30, 0x2a4830]);
    r.place("rope_coil", -halfW + 4.0, 0, halfD - 4.0, { scale: 0.95 });
    r.place("rope_coil", 3.6, 0, halfD - 3.5, { scale: 0.95, rotY: 0.4 });

    // ── A stool by the anvil ──
    r.place("stool", -halfW + 2.0, 0, 0.0, { scale: 1 });
    r.place("stool", -3.6, 0, 1.4, { scale: 1, rotY: 0.4 });

    // ── Water basin in the corner ──
    r.place("water_basin", halfW - 1.0, 0, halfD - 0.9, { scale: 0.9 });
    r.place("water_pump", halfW - 2.6, 0, halfD - 0.9, { scale: 0.85 });

    // ── Floor candles + brazier for light ──
    [[-3.4, -3.2], [2.2, -3.5], [3.0, 2.5]].forEach(([x, z]) => {
      r.place("brazier", x, 0, z, { scale: 0.85 });
      const g = new THREE.PointLight(0xff8040, 0.7, 4, 1.8);
      g.position.set(x, 1.2, z);
      g.userData.flicker = { base: 0.7, jitter: 0.25 };
      r.add(g);
    });

    // ── A character-side coffee table with three interactive "project" items ──
    r.place("coffeeTable", 0, 0, 1.4);
    [
      { topic: "work_tool",   label: "The hammer",  name: "anvil",        x: -0.35, scl: 0.5 },
      { topic: "work_object", label: "The pot",     name: "vase",         x:  0.00, scl: 0.95 },
      { topic: "lessons",     label: "The scrap",   name: "crystal_cluster", x: 0.35, scl: 0.85 },
    ].forEach((b) => {
      const obj = O(b.name, {});
      obj.position.set(b.x, 0.45, 1.25);
      obj.scale.setScalar(b.scl);
      r.addInteractive(obj, { topic: b.topic, label: b.label });
    });

    // ── Hanging lanterns + ambient ──
    [[-2.5, -1, 3.4], [2.5, -1, 3.4]].forEach(([x, _, z]) => {
      r.place("paper_lantern", x, 3.4, z, { scale: 0.8 });
    });
    r.add(new THREE.HemisphereLight(0x6a4a28, 0x100806, 0.35));
    return r;
  }

  // ════════════════════════════════════════════════════════
  // BUILDER: THE HEARTH (TAVERN) — warm, social, music & ale
  // ════════════════════════════════════════════════════════
  function buildTavern() {
    const r = new Room("tavern");
    const W = 16, D = 14, H = 5.2;
    const { halfW, halfD } = buildShell(r, {
      W, D, H,
      floorColor: 0x3a261a, wallColor: 0x2a1d12,
      ceilColor: 0x150a05, beamColor: 0x1a0e05,
    });

    // ── Fireplace at the far end with glow ──
    const fp = O("fireplace_3", {});
    fp.position.set(0, 0, -halfD + 0.3);
    r.add(fp);
    const fireGlow = new THREE.PointLight(0xff6020, 1.6, 8, 1.5);
    fireGlow.position.set(0, 0.7, -halfD + 0.8);
    fireGlow.userData.flicker = { base: 1.6, jitter: 0.5 };
    r.add(fireGlow);
    // Fireplace mantle
    r.place("clock", 0, 1.55, -halfD + 0.05, { scale: 0.85 });
    r.place("candelabra", -0.7, 1.55, -halfD + 0.1, { scale: 0.9 });
    r.place("candelabra",  0.7, 1.55, -halfD + 0.1, { scale: 0.9 });

    // ── Long dining table in the middle ──
    r.place("dining_table", 0, 0, -1.0, { scale: 1.15 });
    [-2.5, -1.0, 0.5, 2.0].forEach((x) => {
      r.place("dining_chair", x, 0, -2.2, { rotY: 0 });
      r.place("dining_chair", x, 0, 0.2, { rotY: Math.PI });
    });

    // Table top clutter — feast for the eye
    [-2.4, -1.4, -0.4, 0.6, 1.6, 2.6].forEach((x) => {
      r.place("tankard", x, 0.86, -1.0 + rand(-0.3, 0.3), { scale: 1.1, rotY: Math.random() * Math.PI });
    });
    [-2.0, -0.5, 1.0, 2.2].forEach((x) => {
      r.place("plate", x, 0.86, -1.0 + rand(-0.3, 0.3), { scale: 1.0 });
    });
    r.place("wine_bottle", -1.8, 0.92, -1.0, { scale: 1.4 });
    r.place("wine_bottle",  1.4, 0.92, -1.0, { scale: 1.4 });
    r.place("candelabra", 0, 0.86, -1.0, { scale: 0.9 });
    r.place("bowlFruit", -0.6, 0.86, -1.0, { scale: 1.1 });
    r.place("bowlFruit",  1.0, 0.86, -1.2, { scale: 1.0 });

    // ── Bar counter against the right wall ──
    r.place("bar_counter", halfW - 0.9, 0, 1.0, { rotY: -Math.PI / 2 });
    // Stools at the bar
    [-1.0, 0.2, 1.4].forEach((z) => {
      r.place("stool", halfW - 2.3, 0, z, { scale: 1.0 });
    });
    // Bottles behind the bar
    r.place("wine_rack", halfW - 0.4, 0, 0.5, { rotY: -Math.PI / 2 });
    r.place("wine_rack", halfW - 0.4, 0, 2.4, { rotY: -Math.PI / 2 });
    [-0.6, 0.0, 0.6, 1.2, 1.8, 2.4, 3.0].forEach((z) => {
      r.place("wine_bottle", halfW - 0.5, 0.8 + Math.random() * 0.05, z, { scale: 1.2 });
    });

    // ── Piano + guitar on the left ──
    r.place("piano_2", -halfW + 1.4, 0, 1.8, { rotY: Math.PI / 2 });
    r.place("piano_stool", -halfW + 2.6, 0, 1.8, { rotY: Math.PI / 2 });
    r.place("guitar", -halfW + 0.4, 0, 3.2, { rotY: 0.2 });
    r.place("gramophone", -halfW + 0.9, 0.85, -2.5, { rotY: Math.PI / 4 });
    r.place("sideTable", -halfW + 0.9, 0, -2.5, { rotY: 0 });

    // ── Hay bales as bench seating along the wall ──
    r.place("hay_bale", -halfW + 0.7, 0, -0.5, { rotY: Math.PI / 2 });
    r.place("hay_bale", -halfW + 0.7, 0, 0.5, { rotY: Math.PI / 2 });

    // ── Hanging chandelier + paper lanterns around ──
    const chand = O("chandelier_ornate", {});
    chand.position.set(0, H - 1.0, -1.0);
    chand.userData.noCollide = true; r.add(chand);
    const chandLight = new THREE.PointLight(0xffd49a, 0.9, 8, 1.6);
    chandLight.position.set(0, H - 1.6, -1.0);
    chandLight.userData.flicker = { base: 0.9, jitter: 0.12 };
    r.add(chandLight);

    [[-4, 4], [4, 4], [-4, -4], [4, -4]].forEach(([x, z]) => {
      r.place("paper_lantern", x, H - 1.2, z, { scale: 0.85 });
      const g = new THREE.PointLight(0xff9050, 0.4, 4, 1.8);
      g.position.set(x, H - 1.7, z);
      g.userData.flicker = { base: 0.4, jitter: 0.15 };
      r.add(g);
    });

    // ── Hanging sign + tapestry decor ──
    r.place("hanging_sign", 0, 3.4, halfD - 0.3);
    r.place("tapestry", -halfW + 0.07, 3.0, -2.0, { rotY: Math.PI / 2 });
    r.place("tapestry", halfW - 0.07, 3.0, -2.0, { rotY: -Math.PI / 2 });
    r.place("banner", -2.5, 3.6, -halfD + 0.05);
    r.place("banner",  2.5, 3.6, -halfD + 0.05);

    // ── A few barrels in the corners ──
    r.place("barrel_stack", -halfW + 1.0, 0, halfD - 1.0, { rotY: 0.3 });
    r.place("barrel_stack", halfW - 1.0, 0, halfD - 1.0, { rotY: -0.3 });

    // ── Interactive: the tankard, the guitar, the seat at the bar ──
    const tankard = O("tankard", {});
    tankard.position.set(2.6, 0.86, -1.0);
    tankard.scale.setScalar(1.2);
    r.addInteractive(tankard, { topic: "care", label: "A drink with you" });

    const guitar = O("guitar", {});
    guitar.position.set(-halfW + 0.4, 0, 3.2);
    guitar.rotation.y = 0.2;
    r.addInteractive(guitar, { topic: "work_object", label: "Play something" });

    const seat = O("stool", {});
    seat.position.set(halfW - 2.3, 0, 0.2);
    r.addInteractive(seat, { topic: "now", label: "Sit at the bar" });

    // ── Floor candle clusters ──
    [[-2.8, 3.0], [3.0, 3.0], [-3.2, -0.5]].forEach(([x, z]) => {
      for (let i = 0; i < 3; i++) {
        r.place("candle", x + rand(-0.15, 0.15), 0, z + rand(-0.15, 0.15), { scale: rand(0.9, 1.3) });
      }
      const g = new THREE.PointLight(0xffb060, 0.3, 2, 2);
      g.position.set(x, 0.4, z);
      g.userData.flicker = { base: 0.3, jitter: 0.15 };
      r.add(g);
    });

    // ── Ambient ──
    r.add(new THREE.HemisphereLight(0x8a5a30, 0x100806, 0.4));
    return r;
  }

  // ════════════════════════════════════════════════════════
  // BUILDER: THE SHORE — sand & water, quiet, big sky
  // ════════════════════════════════════════════════════════
  function buildShore() {
    const r = new Room("shore");

    // Sand-colored disc with a "water" ring around the back half
    const sand = O("floor", { size: 26, color: 0xc4a878, shape: "circle" });
    r.setFloor(sand);

    // Water ring behind the sand
    const water = new THREE.Mesh(
      new THREE.RingGeometry(13, 24, 64, 1, 0, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0x4a6680, roughness: 0.25, metalness: 0.45,
        transparent: true, opacity: 0.92, side: THREE.DoubleSide,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.02;
    water.rotation.z = -Math.PI / 2;
    r.add(water);

    // Sky
    r.add(O("skyDome", { top: "#88a8c8", bottom: "#3a4a5a" }));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.4);
    sun.position.set(-8, 12, 6); r.add(sun);
    r.add(new THREE.HemisphereLight(0x9ab0c8, 0x4a3828, 0.55));

    // ── Cliff face behind, framing the scene ──
    r.place("cliff_face", -10, 0, -12, { rotY: 0.4, scale: 1.0 });
    r.place("cliff_face", 11, 0, -12, { rotY: -0.4, scale: 1.0 });

    // ── Dock stretching into the water ──
    r.place("dock", 0, 0, -8, { rotY: 0 });

    // ── Rowboat tied at the end of the dock ──
    r.place("rowboat", 2.2, 0.1, -10.5, { rotY: 0.6, scale: 1.0 });

    // ── Driftwood / fallen logs scattered on the sand ──
    r.place("fallen_log", -4.5, 0, 4, { rotY: 0.5 });
    r.place("fallen_log", 4.0, 0, 5, { rotY: -0.6 });
    r.place("fallen_log", -2.5, 0, -3.5, { rotY: 1.2, scale: 0.85 });

    // ── Rocks / moss rocks tumbling along the waterline ──
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + (i / 22) * Math.PI; // along the back semicircle
      const rad = rand(10.5, 12.5);
      const x = Math.sin(a) * rad, z = Math.cos(a) * rad - 1;
      const rock = O(pick(["rock", "moss_rock", "rock"]), {});
      rock.position.set(x, 0, z);
      rock.rotation.y = Math.random() * Math.PI * 2;
      rock.scale.setScalar(rand(0.45, 0.95));
      r.add(rock);
    }

    // ── A few palm-like / dead trees up by the cliff ──
    r.place("palm_tree", -7, 0, -7, { scale: 0.95 });
    r.place("palm_tree", 7, 0, -6, { scale: 0.9 });
    r.place("dead_tree", -4, 0, -9, { scale: 0.7 });

    // ── Campfire ringed with stones for the speaking spot ──
    r.place("campfire", 0, 0, 2.5, { scale: 1.0 });
    const fireGlow = new THREE.PointLight(0xff7030, 1.2, 5, 1.6);
    fireGlow.position.set(0, 0.5, 2.5);
    fireGlow.userData.flicker = { base: 1.2, jitter: 0.4 };
    r.add(fireGlow);

    // ── Two stone benches by the fire ──
    r.place("stone_bench", -1.8, 0, 2.0, { rotY: 0.7 });
    r.place("stone_bench",  1.8, 0, 2.0, { rotY: -0.7 });

    // ── Fishing net hung on a stand ──
    r.place("fishing_net", -3.2, 0, -2.0, { rotY: 0.4 });

    // ── Lanterns on tall sticks (torches) ──
    [[-3, 4, -5], [3, 4, -5], [-5, 4, 0], [5, 4, 0]].forEach(([x, _, z]) => {
      r.place("torch_stand", x, 0, z, { scale: 0.95 });
      const g = new THREE.PointLight(0xff9050, 0.5, 4, 2);
      g.position.set(x, 1.4, z);
      g.userData.flicker = { base: 0.5, jitter: 0.18 };
      r.add(g);
    });

    // ── Scatter of small flora at the sand edges ──
    scatter(r, ["tall_grass", "bush", "tall_grass"], 16,
      -10, 5, 10, 11, { scaleMin: 0.5, scaleMax: 0.9 });

    // ── Footprints? Just some tiny rocks scattered everywhere ──
    scatter(r, ["rock", "moss_rock"], 14,
      -8, -4, 8, 6, { scaleMin: 0.25, scaleMax: 0.5,
        avoid: [{ x: 0, z: 2.5, r: 2.5 }, { x: 0, z: -8, r: 3 }] });

    // ── Interactive: the rowboat (ahead), the bench (care), the campfire (now) ──
    const boat = O("rowboat", {});
    boat.position.set(2.2, 0.1, -10.5);
    boat.rotation.y = 0.6;
    r.addInteractive(boat, { topic: "ahead", label: "Push off" });

    const bench = O("stone_bench", {});
    bench.position.set(-1.8, 0, 2.0);
    bench.rotation.y = 0.7;
    r.addInteractive(bench, { topic: "care", label: "Sit a while" });

    const fire = O("campfire", {});
    fire.position.set(0, 0, 2.5);
    r.addInteractive(fire, { topic: "now", label: "The fire" });

    // ── Drifting "wave" highlights (animated rings on the water) ──
    const waveRings = [];
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 0.12, 48),
        new THREE.MeshBasicMaterial({ color: 0xc8e0f0, transparent: true, opacity: 0.4 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(rand(-6, 6), 0.04, rand(-11, -8));
      ring.userData.startR = 0.1;
      ring.userData.phase = Math.random() * Math.PI * 2;
      r.add(ring);
      waveRings.push(ring);
    }
    r.addTicker((t) => {
      waveRings.forEach((rg) => {
        const v = ((t * 0.4 + rg.userData.phase) % 3.0);
        rg.scale.setScalar(0.5 + v * 4);
        rg.material.opacity = Math.max(0, 0.4 - v * 0.13);
      });
    });

    // ── Gentle gull dots far away ──
    const gulls = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 4, 3),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      g.position.set(rand(-12, 12), rand(4, 7), rand(-12, -6));
      g.userData.phase = Math.random() * Math.PI * 2;
      g.userData.basex = g.position.x;
      gulls.add(g);
    }
    r.add(gulls);
    r.addTicker((t) => {
      gulls.children.forEach((g) => {
        g.position.x = g.userData.basex + Math.sin(t * 0.3 + g.userData.phase) * 1.2;
      });
    });

    return r;
  }

  // ════════════════════════════════════════════════════════
  // EXPORTS
  // ════════════════════════════════════════════════════════
  window.ROOMS = {
    room:        buildStudy,
    garden:      buildGarden,
    library:     buildLibrary,
    observatory: buildObservatory,
    workshop:    buildWorkshop,
    tavern:      buildTavern,
    shore:       buildShore,
  };
  window.ROOM_PARTS = { O, M, rand, pick, Room, scatter, bookPile };
})();
