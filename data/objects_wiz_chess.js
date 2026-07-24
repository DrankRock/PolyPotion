// AUTO-SPLIT — shared helpers injected so each file is self-contained.
// Wizard chess: a coherent, lathe-turned set (pawn / rook / knight / bishop /
// queen / king) plus a board. Every piece shares one base + scale + material
// system so the set reads as a matched set. Detail comes from stacked turned
// discs, torus collars, knops and distinct heads — not bare cylinders.
//
// NOTE ON `select` PARAMS: the handoff didn't include a select example, so this
// file assumes `options` is a plain array of strings. If the real core expects
// `{value,label}` objects, change the STYLE_OPTS lines below — nothing else.
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  function glow(color, intensity = 1.4) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.0 });
  }
  function tglow(color, intensity, opacity) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.0, transparent: true, opacity });
  }

  // round-ness of lathe-turned parts
  const SEG = 22;
  const STYLE_OPTS = ["marble", "stone", "wood", "brass", "bone", "crystal"];

  // ── material resolution ──────────────────────────────────────
  // body material from the chosen style, tinted by `color`. crystal is a
  // translucent emissive material; when enchanted it is registered to pulse.
  function bodyMat(o, pulse) {
    const col = _c(o.color, 0xece4d4);
    switch (o.style || "marble") {
      case "wood": return M.wood(col);
      case "stone": return M.stone(col);
      case "brass": return M.brass(col);
      case "bone": return M.bone(col);
      case "crystal": {
        const m = tglow(col, o.wizard ? 0.7 : 0.4, 0.62);
        if (o.wizard) pulse.push({ m, base: 0.7, amp: 0.3 });
        return m;
      }
      case "marble": default: return M.marble(col);
    }
  }
  // trim/finial material. enchanted → fresh glow() that pulses; else gilded brass.
  function trimMat(o, pulse) {
    const col = _c(o.accent, 0xc8a050);
    if (o.wizard) { const m = glow(col, 1.4); pulse.push({ m, base: 1.4, amp: 0.6 }); return m; }
    return M.brass(col);
  }
  function eyeMat(o, pulse) {
    if (o.wizard) { const m = glow(_c(o.accent, 0xffd24a), 1.8); pulse.push({ m, base: 1.8, amp: 0.7 }); return m; }
    return M.metal(0x141008);
  }

  // shared lathe-turned foot. returns the Y where the stem should start.
  function turnedBase(parent, baseR, mB, mT) {
    parent.add(_cyl(baseR, baseR * 1.05, 0.10, mB, [0, 0.05, 0], SEG));        // wide foot
    parent.add(_cyl(baseR * 0.84, baseR * 0.92, 0.05, mB, [0, 0.125, 0], SEG)); // step
    const collar = _tor(baseR * 0.66, 0.022, mT, [0, 0.16, 0], 8, SEG); collar.rotation.x = Math.PI / 2; parent.add(collar);
    parent.add(_cyl(baseR * 0.5, baseR * 0.66, 0.05, mB, [0, 0.195, 0], SEG));  // neck of base
    return 0.22;
  }

  // attach an idle enchant animation to a piece's inner group.
  function enchant(g, body, pulse) {
    let t = rand(0, 6);
    g.userData.tick = (dt) => {
      t += dt;
      body.position.y = Math.sin(t * 1.5) * 0.03;   // gentle hover, oscillated around 0
      body.rotation.y = Math.sin(t * 0.6) * 0.06;    // slow sway (set, never accumulated)
      for (const p of pulse) p.m.emissiveIntensity = Math.max(0, p.base + Math.sin(t * 3) * p.amp);
    };
  }

  function finish(g, body, o, pulse) {
    body.scale.setScalar(o.scale || 1);
    g.add(body);
    if (o.wizard) enchant(g, body, pulse);
    return g;
  }

  function P(defColor, defAccent, extra) {
    const base = [
      { key: "style",  label: "Material", type: "select", options: STYLE_OPTS, default: "marble" },
      { key: "color",  label: "Color",    type: "color",  default: defColor },
      { key: "accent", label: "Trim",     type: "color",  default: defAccent },
      { key: "scale",  label: "Scale",    type: "number", min: 0.5, max: 2, step: 0.05, default: 1 },
      { key: "wizard", label: "Enchanted", type: "bool",  default: false },
    ];
    return extra ? base.concat(extra) : base;
  }

  const IVORY = 0xece4d4, GOLD = 0xc8a050;

  // ── PAWN ─────────────────────────────────────────────────────
  register("chess_pawn", function (o) {
    const g = new THREE.Group(), body = new THREE.Group(), pulse = [];
    const mB = bodyMat(o, pulse), mT = trimMat(o, pulse);
    const r = 0.17;
    const y0 = turnedBase(body, r, mB, mT);
    body.add(_cyl(0.075, 0.105, 0.17, mB, [0, y0 + 0.085, 0], SEG));     // tapered stem
    const collar = _tor(0.092, 0.02, mT, [0, y0 + 0.18, 0], 8, SEG); collar.rotation.x = Math.PI / 2; body.add(collar);
    body.add(_cyl(0.082, 0.068, 0.04, mB, [0, y0 + 0.21, 0], SEG));      // saucer under head
    body.add(_sph(0.115, mB, [0, y0 + 0.33, 0], SEG));                   // round head
    return finish(g, body, o, pulse);
  }, { icon: "♟", category: "wizard chess", params: P(IVORY, GOLD) });

  // ── ROOK ─────────────────────────────────────────────────────
  register("chess_rook", function (o) {
    const g = new THREE.Group(), body = new THREE.Group(), pulse = [];
    const mB = bodyMat(o, pulse), mT = trimMat(o, pulse);
    const r = 0.19, merlons = Math.max(4, Math.round(o.merlons || 6));
    const y0 = turnedBase(body, r, mB, mT);
    body.add(_cyl(0.125, 0.15, 0.30, mB, [0, y0 + 0.15, 0], SEG));       // tower shaft
    const ring = _tor(0.14, 0.018, mT, [0, y0 + 0.30, 0], 8, SEG); ring.rotation.x = Math.PI / 2; body.add(ring);
    const topY = y0 + 0.36;
    body.add(_cyl(0.16, 0.145, 0.09, mB, [0, topY, 0], SEG));            // crown ring (battlement base)
    // crenellations: merlons around the rim with gaps between them
    const cr = 0.135;
    for (let i = 0; i < merlons; i++) {
      const a = i / merlons * Math.PI * 2;
      const mr = _box(0.06, 0.08, 0.05, mB, [Math.cos(a) * cr, topY + 0.085, Math.sin(a) * cr]);
      mr.rotation.y = -a; body.add(mr);
    }
    body.add(_cyl(0.10, 0.10, 0.03, M.stone ? mB : mB, [0, topY + 0.05, 0], SEG)); // recessed centre floor
    return finish(g, body, o, pulse);
  }, { icon: "♜", category: "wizard chess", params: P(IVORY, GOLD, [
    { key: "merlons", label: "Battlements", type: "int", min: 4, max: 10, step: 1, default: 6 }]) });

  // ── KNIGHT ───────────────────────────────────────────────────
  // a real sculpted horse head: leaning neck, elongated head, muzzle, jaw,
  // ears, a crest mane of stepped wedges, eyes and nostrils.
  register("chess_knight", function (o) {
    const g = new THREE.Group(), body = new THREE.Group(), pulse = [];
    const mB = bodyMat(o, pulse), mT = trimMat(o, pulse), mE = eyeMat(o, pulse);
    const r = 0.19;
    const y0 = turnedBase(body, r, mB, mT);
    body.add(_cyl(0.12, 0.145, 0.12, mB, [0, y0 + 0.06, 0], SEG));       // short stem the horse rises from

    const horse = new THREE.Group();
    horse.position.y = y0 + 0.12;

    const neck = _box(0.17, 0.42, 0.15, mB, [0, 0.18, 0.04]); neck.rotation.x = -0.28; horse.add(neck);
    const jaw = _box(0.155, 0.15, 0.20, mB, [0, 0.40, 0.17]); jaw.rotation.x = -0.08; horse.add(jaw);
    const head = _box(0.155, 0.17, 0.30, mB, [0, 0.47, 0.21]); head.rotation.x = -0.12; horse.add(head);
    const muzzle = _box(0.12, 0.12, 0.16, mB, [0, 0.40, 0.37]); muzzle.rotation.x = 0.18; horse.add(muzzle);
    // ears
    for (const sx of [-1, 1]) { const ear = _cone(0.038, 0.13, mB, [sx * 0.05, 0.61, 0.06], 6); ear.rotation.z = sx * 0.22; ear.rotation.x = -0.12; horse.add(ear); }
    // forelock between the ears
    const fl = _cone(0.03, 0.10, mT, [0, 0.61, 0.13], 5); fl.rotation.x = 0.5; horse.add(fl);
    // mane crest: stepped wedges down the back of the neck
    const maneN = Math.max(4, Math.round(o.mane || 7));
    for (let i = 0; i < maneN; i++) {
      const t = i / (maneN - 1);
      const w = _box(0.055, 0.11 - t * 0.03, 0.07, mT, [0, 0.60 - t * 0.40, 0.0 - t * 0.10]);
      w.rotation.x = -0.3; horse.add(w);
    }
    // eyes + nostrils
    for (const sx of [-1, 1]) horse.add(_sph(0.028, mE, [sx * 0.078, 0.50, 0.27], 8));
    for (const sx of [-1, 1]) horse.add(_sph(0.016, M.metal(0x140d06), [sx * 0.032, 0.36, 0.44], 6));
    body.add(horse);
    return finish(g, body, o, pulse);
  }, { icon: "♞", category: "wizard chess", params: P(IVORY, GOLD, [
    { key: "mane", label: "Mane Tufts", type: "int", min: 4, max: 10, step: 1, default: 7 }]) });

  // ── BISHOP ───────────────────────────────────────────────────
  register("chess_bishop", function (o) {
    const g = new THREE.Group(), body = new THREE.Group(), pulse = [];
    const mB = bodyMat(o, pulse), mT = trimMat(o, pulse);
    const r = 0.19;
    const y0 = turnedBase(body, r, mB, mT);
    body.add(_cyl(0.066, 0.135, 0.34, mB, [0, y0 + 0.17, 0], SEG));      // long tapered body
    const collar = _tor(0.10, 0.02, mT, [0, y0 + 0.35, 0], 8, SEG); collar.rotation.x = Math.PI / 2; body.add(collar);
    body.add(_cyl(0.085, 0.065, 0.05, mB, [0, y0 + 0.385, 0], SEG));     // shoulder
    const mitre = _sph(0.115, mB, [0, y0 + 0.54, 0], SEG); mitre.scale.set(1, 1.45, 1); body.add(mitre); // egg-shaped mitre
    const slit = _box(0.022, 0.16, 0.10, M.metal(0x140d06), [0, y0 + 0.585, 0.0]); slit.rotation.x = 0.5; body.add(slit); // the cut
    body.add(_sph(0.045, mT, [0, y0 + 0.70, 0], 12));                    // finial ball
    return finish(g, body, o, pulse);
  }, { icon: "♝", category: "wizard chess", params: P(IVORY, GOLD) });

  // ── QUEEN ────────────────────────────────────────────────────
  register("chess_queen", function (o) {
    const g = new THREE.Group(), body = new THREE.Group(), pulse = [];
    const mB = bodyMat(o, pulse), mT = trimMat(o, pulse);
    const r = 0.21, points = Math.max(5, Math.round(o.points || 8));
    const y0 = turnedBase(body, r, mB, mT);
    body.add(_cyl(0.085, 0.15, 0.30, mB, [0, y0 + 0.15, 0], SEG));       // gowned lower body
    const k1 = _tor(0.11, 0.022, mT, [0, y0 + 0.30, 0], 8, SEG); k1.rotation.x = Math.PI / 2; body.add(k1);
    body.add(_cyl(0.08, 0.095, 0.16, mB, [0, y0 + 0.40, 0], SEG));       // waist
    body.add(_cyl(0.135, 0.08, 0.10, mB, [0, y0 + 0.53, 0], SEG));       // flared collar to crown
    const band = _tor(0.12, 0.02, mT, [0, y0 + 0.58, 0], 8, SEG); band.rotation.x = Math.PI / 2; body.add(band); // coronet band
    // ring of points (pearls) around the coronet
    for (let i = 0; i < points; i++) {
      const a = i / points * Math.PI * 2;
      body.add(_sph(0.026, mT, [Math.cos(a) * 0.11, y0 + 0.63, Math.sin(a) * 0.11], 8));
    }
    body.add(_sph(0.05, mT, [0, y0 + 0.70, 0], 12));                     // central orb finial
    return finish(g, body, o, pulse);
  }, { icon: "♛", category: "wizard chess", params: P(IVORY, GOLD, [
    { key: "points", label: "Coronet Points", type: "int", min: 5, max: 12, step: 1, default: 8 }]) });

  // ── KING ─────────────────────────────────────────────────────
  register("chess_king", function (o) {
    const g = new THREE.Group(), body = new THREE.Group(), pulse = [];
    const mB = bodyMat(o, pulse), mT = trimMat(o, pulse);
    const r = 0.23, pts = Math.max(4, Math.round(o.points || 6));
    const y0 = turnedBase(body, r, mB, mT);
    body.add(_cyl(0.095, 0.16, 0.34, mB, [0, y0 + 0.17, 0], SEG));       // robed lower body
    const k1 = _tor(0.12, 0.024, mT, [0, y0 + 0.34, 0], 8, SEG); k1.rotation.x = Math.PI / 2; body.add(k1);
    body.add(_cyl(0.088, 0.105, 0.18, mB, [0, y0 + 0.45, 0], SEG));      // upper body
    body.add(_cyl(0.145, 0.088, 0.10, mB, [0, y0 + 0.59, 0], SEG));      // flare to crown
    const band = _tor(0.13, 0.022, mT, [0, y0 + 0.64, 0], 8, SEG); band.rotation.x = Math.PI / 2; body.add(band);
    body.add(_cyl(0.115, 0.115, 0.08, mB, [0, y0 + 0.69, 0], SEG));      // crown drum
    // crown points
    for (let i = 0; i < pts; i++) {
      const a = i / pts * Math.PI * 2;
      const sp = _box(0.04, 0.07, 0.04, mT, [Math.cos(a) * 0.105, y0 + 0.74, Math.sin(a) * 0.105]);
      sp.rotation.y = -a; body.add(sp);
    }
    // cross finial
    body.add(_box(0.032, 0.17, 0.032, mT, [0, y0 + 0.86, 0]));           // vertical
    body.add(_box(0.11, 0.032, 0.032, mT, [0, y0 + 0.88, 0]));           // horizontal
    return finish(g, body, o, pulse);
  }, { icon: "♚", category: "wizard chess", params: P(IVORY, GOLD, [
    { key: "points", label: "Crown Points", type: "int", min: 4, max: 10, step: 1, default: 6 }]) });

  // ── BOARD ────────────────────────────────────────────────────
  // 8x8 alternating tiles on a framed plinth. tileSize scales the whole board.
  register("chess_board", function (o) {
    const g = new THREE.Group(), body = new THREE.Group(), pulse = [];
    const ts = o.tileSize, half = 4 * ts;
    const wizard = o.wizard;
    const light = M.marble(_c(o.light, 0xe8e0cc));
    const dark = wizard ? tglow(_c(o.dark, 0x2a2030), 0.5, 1) : M.marble(_c(o.dark, 0x2a2330));
    if (wizard) pulse.push({ m: dark, base: 0.5, amp: 0.25 });
    const frameM = o.frame ? (wizard ? trimMat(o, pulse) : M.wood(_c(o.frameColor, 0x3a2414))) : null;
    const th = 0.06;
    // plinth
    body.add(_box(8 * ts + (o.frame ? 0.4 * ts : 0.04), th, 8 * ts + (o.frame ? 0.4 * ts : 0.04), o.frame && frameM ? frameM : M.stone(0x4a4640), [0, th / 2, 0]));
    // tiles
    for (let rx = 0; rx < 8; rx++) for (let rz = 0; rz < 8; rz++) {
      const x = -half + ts / 2 + rx * ts;
      const z = -half + ts / 2 + rz * ts;
      const isLight = (rx + rz) % 2 === 0;
      body.add(_box(ts * 0.97, 0.03, ts * 0.97, isLight ? light : dark, [x, th + 0.015, z]));
    }
    // frame walls
    if (o.frame && frameM) {
      const fw = 0.2 * ts, fy = th + 0.04, fl = 8 * ts + fw;
      for (const sz of [-1, 1]) body.add(_box(fl, 0.08, fw, frameM, [0, fy, sz * (half + fw / 2)]));
      for (const sx of [-1, 1]) body.add(_box(fw, 0.08, fl, frameM, [sx * (half + fw / 2), fy, 0]));
    }
    g.add(body);
    if (wizard) { let t = rand(0, 6); g.userData.tick = (dt) => { t += dt; for (const p of pulse) p.m.emissiveIntensity = Math.max(0, p.base + Math.sin(t * 2) * p.amp); }; }
    return g;
  }, { icon: "▦", category: "wizard chess", params: [
    { key: "tileSize",   label: "Tile Size",  type: "number", min: 0.25, max: 1.2, step: 0.05, default: 0.5 },
    { key: "light",      label: "Light Tiles", type: "color", default: 0xe8e0cc },
    { key: "dark",       label: "Dark Tiles",  type: "color", default: 0x2a2330 },
    { key: "frame",      label: "Frame",       type: "bool",  default: true },
    { key: "frameColor", label: "Frame Color", type: "color", default: 0x3a2414 },
    { key: "accent",     label: "Trim",        type: "color", default: 0xc8a050 },
    { key: "wizard",     label: "Enchanted",   type: "bool",  default: false },
  ] });
})();
