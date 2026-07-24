// AUTO-SPLIT — shared helpers injected so each file is self-contained.
// Automaton limbs for the chess board: a plain mechanical ARM (shoulder → elbow
// → wrist → 3-jointed articulated fingers) and a standalone HAND. Built as a
// nested group chain so each joint rotates everything downstream (forward
// kinematics). Utilitarian look — plain tubes and simple hubs, no flourishes.
//
// ─────────────────────────────────────────────────────────────────────────
//  CONTROL API  (the part your game wires into)
// ─────────────────────────────────────────────────────────────────────────
//   obj.userData.grip                  // THREE.Group at the fingertips.
//                                      //   pick up: grip.attach(pieceObj)
//                                      //   set down: scene.attach(pieceObj)
//   obj.userData.playMove({            // queue one pick-and-place. Coords are in
//     from:{x,y,z}, to:{x,y,z},        // the ARM's LOCAL space (use
//     onGrab,onRelease,onDone })       // obj.worldToLocal(v) to convert a square).
//                                      //   .y is the grab height (≈ piece mid),
//                                      //   reparent the piece in onGrab/onRelease.
//   obj.userData.idle()                // queue a retract to the rest pose.
//   obj.userData.busy()                // true while animating / queued.
//
// `demo` just loops playMove so the arm is alive out of the box (empty-handed;
// the preview shows it carrying a real piece). Turn it off to drive from a game.
// ─────────────────────────────────────────────────────────────────────────
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  function glow(color, intensity = 1.4) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.0 });
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);

  // plain limb segment along local +X, hinge at the near end.
  function segment(parent, L, met, hubMat) {
    const main = _cyl(0.048, 0.058, L, met, [L / 2, 0, 0], 10); main.rotation.z = Math.PI / 2; parent.add(main);
    parent.add(_sph(0.06, hubMat, [0, 0, 0], 12));
  }
  // one phalanx along +X, with a small knuckle bead at its hinge.
  function phalanx(parent, L, met) {
    parent.add(_box(0.044, 0.044, 0.05, met, [L / 2, 0, 0]));
    parent.add(_sph(0.026, met, [0, 0, 0], 8));
  }

  // 3-jointed fingers + opposed 2-joint thumb. refs gets {j1,j2,j3}; refs.thumb {j1,j2}.
  function buildHand(parent, o, met, tipMat, refs) {
    parent.add(_box(0.15, 0.05, 0.18, met, [0.07, 0, 0]));            // palm plate
    const n = clamp(Math.round(o.fingers || 4), 3, 5);
    const span = 0.16, x0 = 0.15;
    for (let i = 0; i < n; i++) {
      const z = -span / 2 + (n === 1 ? span / 2 : i * span / (n - 1));
      const j1 = new THREE.Group(); j1.position.set(x0, 0, z); parent.add(j1); phalanx(j1, 0.07, met);
      const j2 = new THREE.Group(); j2.position.set(0.07, 0, 0); j1.add(j2); phalanx(j2, 0.06, met);
      const j3 = new THREE.Group(); j3.position.set(0.06, 0, 0); j2.add(j3); phalanx(j3, 0.05, met);
      j3.add(_sph(0.022, tipMat, [0.05, 0, 0], 8));
      refs.push({ j1, j2, j3 });
    }
    const t1 = new THREE.Group(); t1.position.set(0.03, 0, -span / 2 - 0.045); t1.rotation.y = 1.0; parent.add(t1); phalanx(t1, 0.065, met);
    const t2 = new THREE.Group(); t2.position.set(0.065, 0, 0); t1.add(t2); phalanx(t2, 0.055, met);
    t2.add(_sph(0.022, tipMat, [0.055, 0, 0], 8));
    refs.thumb = { j1: t1, j2: t2 };
  }
  function applyCurl(refs, grip) {
    for (const f of refs) { f.j1.rotation.z = -grip * 0.8; f.j2.rotation.z = -grip * 1.0; f.j3.rotation.z = -grip * 0.9; }
    if (refs.thumb) { refs.thumb.j1.rotation.z = -grip * 0.7; refs.thumb.j2.rotation.z = -grip * 0.9; }
  }

  // ── ARM ──────────────────────────────────────────────────────
  register("automaton_arm", function (o) {
    const g = new THREE.Group(), pulse = [];
    const met = M.metal(_c(o.metal, 0x8a8f98));
    const hubMat = o.glow ? glow(_c(o.accent, 0x4ad6ff), 1.3) : M.metal(0x55585e);
    const tipMat = o.glow ? glow(_c(o.accent, 0x4ad6ff), 1.6) : M.metal(0x6a6e74);
    if (o.glow) { pulse.push({ m: hubMat, base: 1.3, amp: 0.5 }); pulse.push({ m: tipMat, base: 1.6, amp: 0.6 }); }

    const k = o.reach, L1 = 0.85 * k, L2 = 0.75 * k, shoulderY = o.mountHeight;

    g.add(_cyl(0.36, 0.44, 0.06, M.stone(0x16151c), [0, 0.03, 0], 20));      // plain dark base (the "shadow")

    const shoulder = new THREE.Group(); shoulder.position.set(0, shoulderY, 0); g.add(shoulder);
    shoulder.add(_cyl(0.1, 0.14, shoulderY, met, [0, -shoulderY / 2, 0], 12)); // pillar
    shoulder.add(_sph(0.15, hubMat, [0, 0, 0], 14));
    const yaw = new THREE.Group(); shoulder.add(yaw);
    const upper = new THREE.Group(); yaw.add(upper); segment(upper, L1, met, hubMat);
    const fore = new THREE.Group(); fore.position.set(L1, 0, 0); upper.add(fore); segment(fore, L2, met, hubMat);
    const wrist = new THREE.Group(); wrist.position.set(L2, 0, 0); fore.add(wrist);
    wrist.add(_sph(0.06, hubMat, [0, 0, 0], 12));
    const grip = new THREE.Group(); wrist.add(grip);
    const refs = []; buildHand(grip, o, met, tipMat, refs);

    // local target → joint angles. clamped 2-link IK; fingers point straight DOWN.
    function reachPose(tx, ty, tz) {
      const yawA = Math.atan2(tz, tx);
      const r = Math.hypot(tx, tz);
      const dx = r, dy = ty - shoulderY;
      let cE = (dx * dx + dy * dy - L1 * L1 - L2 * L2) / (2 * L1 * L2);
      cE = clamp(cE, -1, 1);
      const elbow = -Math.acos(cE);
      const k1 = L1 + L2 * Math.cos(elbow), k2 = L2 * Math.sin(elbow);
      const shoulderA = Math.atan2(dy, dx) - Math.atan2(k2, k1);
      // total z-rotation of the chain is shoulderA+elbow+wrist; set it to -PI/2 so
      // the hand's +X (finger direction) points down -Y onto the piece.
      const wristA = -Math.PI / 2 - (shoulderA + elbow) + (o.palmTilt || 0);
      return { yaw: yawA, shoulder: shoulderA, elbow: elbow, wrist: wristA };
    }
    const IDLE = { yaw: 0, shoulder: 0.5, elbow: -2.4, wrist: 0, grip: 0 };

    const cur = { yaw: IDLE.yaw, shoulder: IDLE.shoulder, elbow: IDLE.elbow, wrist: IDLE.wrist, grip: 0 };
    const queue = []; let frame = null, from = null, ft = 0;
    function push(pose, grip, dur, atEnd) { queue.push({ pose, grip, dur, atEnd }); }
    function moveFrames(S, T, h) {
      h = h || {}; const clr = o.clearance;
      push(reachPose(S.x, S.y + clr, S.z), 0, 0.7);
      push(reachPose(S.x, S.y, S.z), 0, 0.35);
      push(reachPose(S.x, S.y, S.z), 1, 0.30, h.onGrab);
      push(reachPose(S.x, S.y + clr, S.z), 1, 0.35);
      push(reachPose(T.x, T.y + clr, T.z), 1, 0.80);
      push(reachPose(T.x, T.y, T.z), 1, 0.35);
      push(reachPose(T.x, T.y, T.z), 0, 0.30, h.onRelease);
      push(IDLE, 0, 0.70, h.onDone);
    }

    g.userData.grip = grip;
    g.userData.busy = () => !!frame || queue.length > 0;
    g.userData.idle = () => push(IDLE, 0, 0.6);
    g.userData.playMove = (opts) => moveFrames(opts.from, opts.to, opts);

    let demoFlip = false;
    function demoLoop() {
      const A = { x: -1.2, y: 0.4, z: -0.6 }, B = { x: 1.2, y: 0.4, z: 0.6 };
      const S = demoFlip ? B : A, T = demoFlip ? A : B; demoFlip = !demoFlip;
      moveFrames(S, T, { onDone: () => { if (o.demo) demoLoop(); } });
    }
    if (o.demo) demoLoop();

    let gt = 0;
    g.userData.tick = (dt) => {
      gt += dt; const sp = o.speed || 1;
      if (!frame && queue.length) { frame = queue.shift(); from = { yaw: cur.yaw, shoulder: cur.shoulder, elbow: cur.elbow, wrist: cur.wrist, grip: cur.grip }; ft = 0; }
      if (frame) {
        ft += dt * sp; const u = clamp(ft / frame.dur, 0, 1), e = easeIO(u);
        cur.yaw = lerp(from.yaw, frame.pose.yaw, e);
        cur.shoulder = lerp(from.shoulder, frame.pose.shoulder, e);
        cur.elbow = lerp(from.elbow, frame.pose.elbow, e);
        cur.wrist = lerp(from.wrist, frame.pose.wrist, e);
        cur.grip = lerp(from.grip, frame.grip, e);
        if (u >= 1) { const f = frame; frame = null; if (f.atEnd) f.atEnd(); }
      }
      yaw.rotation.y = cur.yaw; upper.rotation.z = cur.shoulder; fore.rotation.z = cur.elbow; wrist.rotation.z = cur.wrist;
      applyCurl(refs, cur.grip);
      for (const p of pulse) p.m.emissiveIntensity = Math.max(0, p.base + Math.sin(gt * 3) * p.amp);
    };
    return g;
  }, {
    icon: "🦾", category: "wizard chess", params: [
      { key: "fingers",     label: "Fingers",      type: "int",    min: 3, max: 5, step: 1, default: 4 },
      { key: "reach",       label: "Reach",        type: "number", min: 0.7, max: 2.2, step: 0.1, default: 1.4 },
      { key: "mountHeight", label: "Mount Height", type: "number", min: 1.0, max: 4.0, step: 0.1, default: 2.4 },
      { key: "clearance",   label: "Lift Clear",   type: "number", min: 0.2, max: 1.2, step: 0.05, default: 0.55 },
      { key: "speed",       label: "Speed",        type: "number", min: 0.3, max: 2.5, step: 0.1, default: 1.0 },
      { key: "palmTilt",    label: "Palm Tilt",    type: "number", min: -1, max: 1, step: 0.05, default: 0 },
      { key: "metal",       label: "Metal",        type: "color",  default: 0x8a8f98 },
      { key: "accent",      label: "Glow",         type: "color",  default: 0x4ad6ff },
      { key: "glow",        label: "Lit Joints",   type: "bool",   default: false },
      { key: "demo",        label: "Demo Loop",    type: "bool",   default: true },
    ],
  });

  // ── HAND (standalone) ────────────────────────────────────────
  register("automaton_hand", function (o) {
    const g = new THREE.Group(), body = new THREE.Group(), pulse = [];
    const met = M.metal(_c(o.metal, 0x8a8f98));
    const tipMat = o.glow ? glow(_c(o.accent, 0x4ad6ff), 1.6) : M.metal(0x6a6e74);
    if (o.glow) pulse.push({ m: tipMat, base: 1.6, amp: 0.6 });
    body.add(_cyl(0.085, 0.1, 0.18, met, [0, 0.09, 0], 12));
    const hub = o.glow ? glow(_c(o.accent, 0x4ad6ff), 1.3) : M.metal(0x55585e);
    if (o.glow) pulse.push({ m: hub, base: 1.3, amp: 0.5 });
    body.add(_sph(0.07, hub, [0, 0.19, 0], 12));
    const grip = new THREE.Group(); grip.position.set(0, 0.2, 0); grip.rotation.z = Math.PI / 2; body.add(grip);
    const refs = []; buildHand(grip, o, met, tipMat, refs);
    g.add(body); body.scale.setScalar(o.scale || 1);

    let manual = null;
    g.userData.grip = grip;
    g.userData.setCurl = (v) => { manual = clamp(v, 0, 1); };
    let t = rand(0, 6);
    g.userData.tick = (dt) => {
      t += dt;
      const grip01 = manual != null ? manual : (Math.sin(t * (o.speed || 1)) * 0.5 + 0.5) * 0.9;
      applyCurl(refs, grip01);
      for (const p of pulse) p.m.emissiveIntensity = Math.max(0, p.base + Math.sin(t * 3) * p.amp);
    };
    return g;
  }, {
    icon: "🖐", category: "wizard chess", params: [
      { key: "fingers", label: "Fingers", type: "int",    min: 3, max: 5, step: 1, default: 4 },
      { key: "scale",   label: "Scale",   type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.4 },
      { key: "speed",   label: "Clench Speed", type: "number", min: 0.2, max: 2.5, step: 0.1, default: 0.8 },
      { key: "metal",   label: "Metal",   type: "color",  default: 0x8a8f98 },
      { key: "accent",  label: "Glow",    type: "color",  default: 0x4ad6ff },
      { key: "glow",    label: "Lit",     type: "bool",   default: false },
    ],
  });
})();
