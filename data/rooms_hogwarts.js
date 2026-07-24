// rooms_hogwarts.js — Hogwarts room builders, movie-flavoured.
//
//   Loads AFTER rooms.js (needs window.ROOM_PARTS) and AFTER all objects_*.js.
//   Appends builders to window.ROOMS without touching the originals.
//
//   Coordinate notes: y = 0 is the floor, +y up. The character spawns at
//   (0,0,0) and walks, so every room keeps a clear central aisle there.
//   Heights/lengths of prefabs aren't known to this file, so a few spacing
//   and on-surface-Y values are marked TUNE: adjust once you see it render.

(function () {
  const THREE = window.THREE;
  if (!THREE) return;
  const P = window.ROOM_PARTS;
  if (!P) { console.error("rooms_hogwarts.js: ROOM_PARTS missing — load after rooms.js"); return; }
  const { O, M, rand, pick, Room, scatter, bookPile } = P;

  // Local shell (rooms.js's buildShell is private). Uses only floor/wall/beam,
  // whose params (width/height/depth/color/length) are known-safe.
  function shell(r, {
    W = 14, D = 12, H = 5,
    floorColor = 0x6b6258, wallColor = 0x4a4640,
    ceilColor = 0x1a1610, beamColor = 0x2a1f15,
    ceiling = true, beams = false,
  } = {}) {
    const halfW = W / 2, halfD = D / 2;
    r.setFloor(O("floor", { width: W, depth: D, color: floorColor }));

    const back = O("wall", { width: W, height: H, color: wallColor });
    back.position.set(0, H / 2, -halfD); r.add(back);
    const front = O("wall", { width: W, height: H, color: wallColor });
    front.position.set(0, H / 2, halfD); front.rotation.y = Math.PI; r.add(front);
    const left = O("wall", { width: D, height: H, color: wallColor });
    left.position.set(-halfW, H / 2, 0); left.rotation.y = Math.PI / 2; r.add(left);
    const right = O("wall", { width: D, height: H, color: wallColor });
    right.position.set(halfW, H / 2, 0); right.rotation.y = -Math.PI / 2; r.add(right);

    if (ceiling) {
      const c = O("wall", { width: W, height: D, color: ceilColor });
      c.position.set(0, H, 0); c.rotation.x = Math.PI / 2;
      c.userData.noCollide = true; r.add(c);
    }
    if (beams) {
      const n = Math.max(2, Math.round(W / 1.8));
      for (let i = 0; i <= n; i++) {
        const b = O("beam", { length: W, color: beamColor });
        b.position.set(0, H - 0.18, -halfD + (i / n) * D);
        b.userData.noCollide = true; r.add(b);
      }
    }
    return { halfW, halfD, H };
  }

  // Warm flickering point light (matches Room.add's flicker collector).
  function fireLight(r, x, y, z, color = 0xff8a40, base = 1.0, jitter = 0.35, dist = 7) {
    const l = new THREE.PointLight(color, base, dist, 1.8);
    l.position.set(x, y, z);
    l.userData.flicker = { base, jitter };
    r.add(l);
    return l;
  }
  function softLight(r, x, y, z, color = 0xbfd0e0, intensity = 0.7, dist = 12) {
    const l = new THREE.PointLight(color, intensity, dist, 1.4);
    l.position.set(x, y, z);
    r.add(l);
    return l;
  }

  // ════════════════════════════════════════════════════════
  // THE GREAT HALL — four long house tables, floating candles,
  // enchanted night ceiling, staff dais, sorting hat & stool.
  // ════════════════════════════════════════════════════════
  function buildGreatHall() {
    const r = new Room("great_hall");
    const W = 16, D = 30, H = 12;
    const { halfW, halfD } = shell(r, {
      W, D, H,
      floorColor: 0x5a564e, wallColor: 0x46423a,
      ceiling: false, beams: false,
    });

    // Enchanted night "ceiling": a dark panel + twinkling star panels.
    const sky = O("wall", { width: W, height: D, color: 0x070712 });
    sky.position.set(0, H, 0); sky.rotation.x = Math.PI / 2;
    sky.userData.noCollide = true; r.add(sky);
    for (let xi = -2; xi <= 2; xi++) {
      for (let zi = -4; zi <= 4; zi += 2) {
        const panel = O(pick(["twinkling_ceiling_panel", "ceiling_stars"]), {});
        panel.position.set(xi * 3.0, H - 0.15, zi * 3.0);
        panel.userData.noCollide = true;
        panel.scale.setScalar(1.4);
        r.add(panel);
      }
    }

    // Four long house tables, lengthwise, central aisle at x≈0.
    const TABLE_X = [-6.0, -2.4, 2.4, 6.0];   // TUNE: table half-width spacing
    const SEG = 3.0;                          // TUNE: long-table segment length
    const TABLE_Y = 0.0;                      // tables stand on the floor
    const SURF_Y = 0.95;                      // TUNE: table-top height for feast props
    TABLE_X.forEach((tx) => {
      for (let z = -10; z <= 10; z += SEG) {
        r.place("great_hall_long_table", tx, TABLE_Y, z);
        // benches either side
        r.place("school_bench", tx - 0.95, 0, z, { rotY: Math.PI / 2 });
        r.place("school_bench", tx + 0.95, 0, z, { rotY: -Math.PI / 2 });
      }
      // a little feast clutter along each table
      [-8, -3, 2, 7].forEach((z, i) => {
        const item = ["feast_platter", "roast_platter", "feast_goblet_tower", "refilling_goblet"][i % 4];
        r.place(item, tx, SURF_Y, z, { scale: 0.9 });
      });
    });

    // Staff high table on a raised dais at the far (back) end.
    const DZ = -halfD + 2.2;
    r.place("dais_throne_platform", 0, 0, DZ, { scale: 1.0 });
    const DAIS_Y = 0.4;                       // TUNE: dais top height
    for (let z = DZ - 1; z <= DZ + 1; z += SEG) {
      r.place("great_hall_long_table", 0, DAIS_Y, z, { rotY: Math.PI / 2 });
    }
    r.place("ornate_throne", 0, DAIS_Y, DZ + 0.6);                 // headmaster's chair
    [-2.6, -1.4, 1.4, 2.6].forEach((x) =>
      r.place("wingback_chair", x, DAIS_Y, DZ + 0.6, { scale: 0.9 }));
    r.place("spellbook_lectern", 0, 0, DZ + 2.4);                 // eagle podium

    // Sorting hat on its stool, out in front of the staff table.
    r.place("wood_stool", 0, 0, DZ + 4.0);
    r.place("sorting_hat", 0, 0.5, DZ + 4.0, { scale: 0.9 });     // TUNE: stool height

    // Tall windows down both long walls.
    for (let z = -9; z <= 9; z += 4.5) {
      const wl = r.place("arched_window", -halfW + 0.12, 5.0, z, { rotY: Math.PI / 2 });
      wl.scale.setScalar(1.6);
      const wr = r.place("arched_window", halfW - 0.12, 5.0, z, { rotY: -Math.PI / 2 });
      wr.scale.setScalar(1.6);
    }
    // Rose window high on the back wall, over the staff table.
    r.place("rose_window", 0, 9.0, -halfD + 0.12, { scale: 1.8 });

    // House banners high on the side walls.
    [-7, 0, 7].forEach((z) => {
      r.place("heraldic_banner", -halfW + 0.2, 7.2, z, { rotY: Math.PI / 2, scale: 1.4 });
      r.place("heraldic_banner", halfW - 0.2, 7.2, z, { rotY: -Math.PI / 2, scale: 1.4 });
    });

    // House-points hourglasses along the entrance (front) wall.
    [-5, -1.7, 1.7, 5].forEach((x) =>
      r.place("house_points_glass", x, 0, halfD - 0.7, { rotY: Math.PI }));

    // Grand hearth on the left wall.
    r.place("grand_hearth", -halfW + 0.5, 0, 0, { rotY: Math.PI / 2 });
    fireLight(r, -halfW + 1.2, 1.1, 0, 0xff7a30, 1.6, 0.5, 9);

    // Floating candles drifting over the hall, with a few real lights among them.
    let litBudget = 7;
    for (let i = 0; i < 22; i++) {
      const x = rand(-7, 7), z = rand(-12, 12), y = rand(6.5, 9.0);
      const cl = O("floating_candles", {});
      cl.position.set(x, y, z);
      cl.userData.noCollide = true;
      r.add(cl);
      if (litBudget-- > 0) fireLight(r, x, y - 0.2, z, 0xffd28a, 0.6, 0.18, 6);
    }

    return r;
  }

  // ════════════════════════════════════════════════════════
  // POTIONS DUNGEON (Snape) — dim stone, rows of cauldron desks,
  // shelves of jarred specimens, blackboard, wall braziers.
  // ════════════════════════════════════════════════════════
  function buildPotions() {
    const r = new Room("potions");
    const W = 12, D = 16, H = 4.4;
    const { halfW, halfD } = shell(r, {
      W, D, H,
      floorColor: 0x39342b, wallColor: 0x2b2922,
      ceilColor: 0x16140f, beamColor: 0x201813,
      ceiling: true, beams: true,
    });

    // Student desks: two blocks flanking a clear central aisle.
    const COLS = [-3.6, -2.0, 2.0, 3.6];
    const ROWS = [-3, -1, 1, 3];
    const DESK_Y = 0.0, CAULDRON_Y = 0.82; // TUNE: desk-top height
    COLS.forEach((x) => ROWS.forEach((z) => {
      r.place("student_desk", x, DESK_Y, z);
      r.place(pick(["tripod_cauldron", "bubbling_cauldron"]), x, CAULDRON_Y, z, { scale: 0.8 });
      r.place("wood_stool", x, 0, z + 0.75);
    }));

    // Front of room: Snape's desk, blackboard, a big cauldron.
    const FZ = -halfD + 0.8;
    r.place("lecture_desk", 0, 0, FZ + 0.9);
    r.place("blackboard", 0, 2.1, -halfD + 0.1);
    r.place("cauldron_large", 1.8, 0, FZ + 0.6, { scale: 0.9 });

    // Side walls: apothecary storage and specimen jars.
    [-4.5, -1.5, 1.5, 4.5].forEach((z, i) => {
      const leftName = ["apothecary_shelf", "specimen_cabinet", "potion_cabinet", "vial_rack"][i];
      r.place(leftName, -halfW + 0.35, 0, z, { rotY: Math.PI / 2 });
      r.place(pick(["jarred_specimen", "specimen_jars"]), -halfW + 0.7, 1.25, z,
              { rotY: Math.PI / 2, scale: 0.7 });
      const rightName = ["vial_rack", "potion_cabinet", "apothecary_shelf", "specimen_cabinet"][i];
      r.place(rightName, halfW - 0.35, 0, z, { rotY: -Math.PI / 2 });
    });

    // A brewing bench with scales and a grinding bowl, right side near front.
    r.place("brewing_bench", halfW - 0.9, 0, FZ + 1.2, { rotY: -Math.PI / 2 });
    r.place("balance_scale", halfW - 1.0, 0.85, FZ + 0.7, { rotY: -Math.PI / 2, scale: 0.8 });
    r.place("grinding_bowl", halfW - 1.0, 0.85, FZ + 1.7, { rotY: -Math.PI / 2, scale: 0.8 });

    // Drying herbs strung high along the back-left, barrels in corners.
    [-3, -1, 1].forEach((x) => r.place("drying_herbs", x, 3.1, -halfD + 0.3, { scale: 0.8 }));
    r.place("storage_barrel", -halfW + 0.7, 0, halfD - 0.8);
    r.place("wooden_crate", halfW - 0.7, 0, halfD - 0.8, { rotY: 0.4 });

    // Dim wall braziers — the dungeon's only real light.
    const brazierZ = [-4, 0, 4];
    brazierZ.forEach((z) => {
      r.place("dripping_dungeon_sconce", -halfW + 0.18, 2.7, z, { rotY: Math.PI / 2 });
      fireLight(r, -halfW + 0.6, 2.6, z, 0x8aff9a, 0.5, 0.22, 5);  // sickly greenish dungeon glow
      r.place("wall_brazier", halfW - 0.18, 2.7, z, { rotY: -Math.PI / 2 });
      fireLight(r, halfW - 0.6, 2.6, z, 0xff7a30, 0.5, 0.25, 5);
    });

    return r;
  }

  // ════════════════════════════════════════════════════════
  // CHARMS CLASSROOM (Flitwick) — bright, tall windows, desks,
  // his book pile to stand on, feathers floating overhead.
  // ════════════════════════════════════════════════════════
  function buildCharms() {
    const r = new Room("charms");
    const W = 14, D = 12, H = 6;
    const { halfW, halfD } = shell(r, {
      W, D, H,
      floorColor: 0x6b4a2b, wallColor: 0x8a8478,
      ceilColor: 0x9a948a, beamColor: 0x5a3a22,
      ceiling: true, beams: true,
    });

    // Tall windows along the back wall + daylight fill.
    [-4, 0, 4].forEach((x) => {
      const win = O("window", { width: 1.8, height: 3.4, light: 3.2 });
      win.position.set(x, 3.0, -halfD + 0.06);
      r.add(win);
      softLight(r, x, 3.0, -halfD + 0.8, 0xcfe0f0, 0.6, 9);
    });

    // Student desks: two blocks around the central aisle, facing the front.
    const COLS = [-3.2, -1.6, 1.6, 3.2];
    const ROWS = [0.5, 2.5];
    COLS.forEach((x) => ROWS.forEach((z) => {
      r.place("student_desk", x, 0, z, { rotY: Math.PI });   // face front (-z)
      r.place("feather", x - 0.15, 0.82, z, { scale: 0.9 }); // TUNE: desk-top height
      r.place("single_scroll", x + 0.18, 0.82, z, { scale: 0.8 });
      r.place("wood_stool", x, 0, z + 0.7);
    }));

    // Flitwick's front desk with his standing stack of books on top.
    const FZ = -halfD + 1.0;
    r.place("teacher_desk", 0, 0, FZ);
    r.place("stacked_books", 0, 0.8, FZ, { scale: 1.1 });   // the pile he stands on
    r.place("blackboard", 0, 2.4, -halfD + 0.1);

    // Feathers floating over the desks (Wingardium Leviosa).
    COLS.forEach((x) => ROWS.forEach((z) => {
      const f = O("levitating_feather", {});
      f.position.set(x + rand(-0.3, 0.3), rand(1.5, 2.0), z + rand(-0.3, 0.3));
      f.userData.noCollide = true;
      r.add(f);
    }));

    // A chandelier and a couple of floating candles up top.
    r.place("hanging_chandelier", 0, H - 0.5, 0, { scale: 0.9 });
    r.place("floating_candles", -3.5, H - 1.2, 3.0);
    r.place("floating_candles", 3.5, H - 1.2, 3.0);

    // Cushions for practice + a bookshelf along the right wall.
    r.place("floor_pouffe", halfW - 1.2, 0, halfD - 1.5);
    r.place("cushion_pile", halfW - 1.8, 0, halfD - 2.4, { scale: 0.9 });
    r.place("tome_shelf", halfW - 0.35, 0, -2.0, { rotY: -Math.PI / 2 });
    r.place("bookshelf", halfW - 0.35, 0, 0.5, { rotY: -Math.PI / 2 });

    // Gentle warm fill so the room reads bright, not dim.
    softLight(r, 0, H - 1.0, 0, 0xfff0d8, 0.5, 12);

    return r;
  }

  // ── Register without clobbering rooms.js's existing rooms ──
  window.ROOMS = window.ROOMS || {};
  Object.assign(window.ROOMS, {
    great_hall: buildGreatHall,
    potions:    buildPotions,
    charms:     buildCharms,
  });

  // ── Advertise these rooms to the settings dropdown ──
  // app.jsx builds the environment <select> from window.ENVIRONMENTS, where
  // each entry is { id, name, accent?, ambient? }. setRoom(id) and
  // setAmbient(meta) both consume it. dialogue.js defines this array before
  // this file runs, so we append (idempotently). Alternative: add the same
  // three objects directly in data/dialogue.js and delete this block.
  if (Array.isArray(window.ENVIRONMENTS)) {
    [
      { id: "great_hall", name: "The Great Hall",    accent: "#ffd9a0", ambient: "#1c1830" },
      { id: "potions",    name: "Potions Dungeon",   accent: "#8aff9a", ambient: "#10130f" },
      { id: "charms",     name: "Charms Classroom",  accent: "#cfe0f0", ambient: "#2a2c2a" },
    ].forEach((e) => {
      if (!window.ENVIRONMENTS.some((x) => x.id === e.id)) window.ENVIRONMENTS.push(e);
    });
  } else {
    console.warn("rooms_hogwarts.js: window.ENVIRONMENTS not found — " +
                 "rooms work via SCENE.setRoom() but won't appear in the dropdown.");
  }
})();