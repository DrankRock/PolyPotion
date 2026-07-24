// category: "wizard chess"
// A free-floating GHOSTLY HAND — the unseen opponent's spectral hand. It rests
// at the far edge of the board (the opponent's side) in a relaxed human pose:
// palm down, fingers slightly curled, hovering just above the table. When the
// opponent moves, it reaches over, PINCHES the top of a piece between thumb and
// middle finger, lifts it, carries it to the target square, sets it down,
// releases, and retreats to its resting pose. The player's own moves slide the
// piece themselves; the hand stays at rest.
//
// ─────────────────────────────────────────────────────────────────────────
//  CONTROL API
// ─────────────────────────────────────────────────────────────────────────
//   obj.userData.grip                 // THREE.Group between thumb+middle tips.
//                                     //   pinch up: grip.attach(pieceObj)
//                                     //   set down: scene.attach(pieceObj)
//   obj.userData.playMove({           // queue one pinch-and-place. WORLD coords
//     from:{x,y,z}, to:{x,y,z},       // (hand sits at scene root). .y is the
//     grabTopY, onGrab,onRelease,onDone })  // height of the piece's TOP (pinch
//                                     //   point). Reparent in onGrab/onRelease.
//   obj.userData.setRest({x,y,z})     // move the resting spot (opponent's edge).
//   obj.userData.idle()               // queue a retreat to the rest pose.
//   obj.userData.busy()               // true while animating / queued.
//
// Mount at scene root. Default rest is the FAR (-z) edge; the app flips it to
// the opponent's side relative to the player.
// ─────────────────────────────────────────────────────────────────────────
(function () {
  const { register, M, _box, _cyl, _sph, _cone, _tor, rand, pick, _c } = window.OBJECTS;

  function glow(color, intensity = 1.4) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.0 });
  }
  function tglow(color, intensity, opacity) {
    return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.0, transparent: true, opacity });
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeIO = (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2);
  function _c2(v, fb) { const n = parseFloat(v); return Number.isFinite(n) ? n : fb; }

  // one phalanx along +X with a knuckle bead at its hinge
  function phalanx(parent, L, mat, bead) {
    const seg = _cyl(0.026, 0.03, L, mat, [L / 2, 0, 0], 8); seg.rotation.z = Math.PI / 2; parent.add(seg);
    parent.add(_sph(0.03, bead, [0, 0, 0], 8));
  }

  // palm + 4 fingers (index/middle/ring/pinky) + opposed thumb.
  // refs[] = fingers in order; we tag refs.middle and refs.thumb for the pinch.
  function buildHand(parent, o, mat, bead, tipMat, refs) {
    const palm = _sph(0.13, mat, [0.05, 0, 0], 14); palm.scale.set(1.1, 0.55, 1.0); parent.add(palm);
    parent.add(_box(0.16, 0.05, 0.2, mat, [0.06, 0, 0]));            // palm pad
    const n = clamp(Math.round(o.fingers || 4), 3, 5);
    const span = 0.18, x0 = 0.17;
    const lenScale = [0.92, 1.04, 1.0, 0.9, 0.8];                    // middle longest
    const tipRefs = [];
    for (let i = 0; i < n; i++) {
      const z = -span / 2 + (n === 1 ? span / 2 : i * span / (n - 1));
      const ls = lenScale[i] || 0.9;
      const j1 = new THREE.Group(); j1.position.set(x0, 0, z); parent.add(j1); phalanx(j1, 0.08 * ls, mat, bead);
      const j2 = new THREE.Group(); j2.position.set(0.08 * ls, 0, 0); j1.add(j2); phalanx(j2, 0.07 * ls, mat, bead);
      const j3 = new THREE.Group(); j3.position.set(0.07 * ls, 0, 0); j2.add(j3); phalanx(j3, 0.055 * ls, mat, bead);
      const tip = _sph(0.026, tipMat, [0.055 * ls, 0, 0], 8); j3.add(tip);
      refs.push({ j1, j2, j3, tip, ls });
    }
    // middle finger = index 1 (or the middle of however many)
    refs.middle = refs[Math.min(1, refs.length - 1)] || refs[0];
    // opposed thumb on the near (-z) side, angled toward the fingers
    const t1 = new THREE.Group(); t1.position.set(0.05, 0, -span / 2 - 0.05); t1.rotation.y = 1.05; parent.add(t1); phalanx(t1, 0.075, mat, bead);
    const t2 = new THREE.Group(); t2.position.set(0.075, 0, 0); t1.add(t2); phalanx(t2, 0.06, mat, bead);
    const ttip = _sph(0.026, tipMat, [0.06, 0, 0], 8); t2.add(ttip);
    refs.thumb = { j1: t1, j2: t2, tip: ttip };
  }

  // RELAXED resting curl: a gentle, even fold across all fingers (palm-down rest).
  // grip = 0 → fully relaxed-open; we drive a small baseline so it looks alive.
  function applyRest(refs, amt) {
    for (const f of refs) {
      f.j1.rotation.z = -amt * 0.6;
      f.j2.rotation.z = -amt * 0.9;
      f.j3.rotation.z = -amt * 0.8;
    }
    if (refs.thumb) { refs.thumb.j1.rotation.z = -amt * 0.4; refs.thumb.j2.rotation.z = -amt * 0.6; }
  }

  // PINCH: only thumb + middle finger close to meet; the other fingers stay
  // softly extended (a light resting curl). pinch 0..1.
  function applyPinch(refs, pinch, restAmt) {
    for (const f of refs) {
      if (f === refs.middle) {
        f.j1.rotation.z = -lerp(restAmt * 0.6, 1.15, pinch);
        f.j2.rotation.z = -lerp(restAmt * 0.9, 1.25, pinch);
        f.j3.rotation.z = -lerp(restAmt * 0.8, 0.9, pinch);
      } else {
        // non-pinching fingers: stay gently extended, drift only slightly
        f.j1.rotation.z = -restAmt * 0.5;
        f.j2.rotation.z = -restAmt * 0.7;
        f.j3.rotation.z = -restAmt * 0.6;
      }
    }
    if (refs.thumb) {
      refs.thumb.j1.rotation.z = -lerp(restAmt * 0.4, 1.0, pinch);
      refs.thumb.j2.rotation.z = -lerp(restAmt * 0.6, 1.1, pinch);
    }
  }

  register("magic_hand", function (o) {
    const g = new THREE.Group();
    const c = _c(o.color, 0xbfd0ff);
    const handMat = tglow(c, 0.5, _c2(o.opacity, 0.5));
    const bead    = glow(c, 1.1);
    const tipMat  = glow(_c(o.accent, 0xeaf4ff), 1.6);
    const wispMat = tglow(c, 0.8, 0.3);

    // Visual hand. Local build convention (before orientation):
    //   fingers extend along +X, palm pad in the XZ plane, back of hand +Y.
    // We want a resting hand: palm DOWN (parallel to table), fingers reaching
    // FORWARD across the board (+Z toward the player) and tipping slightly down.
    const hand = new THREE.Group();
    const orient = new THREE.Group();
    // base scale bumped so the app's scale≈1.1 reads ~3× the old size
    orient.scale.setScalar((o.scale || 1) * 1.4);
    hand.add(orient);

    // wrist: rotate the +X finger axis to point +Z (forward, onto the board),
    // then tip the fingertips slightly downward via palmTilt.
    const wrist = new THREE.Group();
    wrist.rotation.y = -Math.PI / 2;                       // +X fingers → +Z forward
    wrist.rotation.x = (o.palmTilt || 0);                 // tip fingers down a touch
    orient.add(wrist);
    const refs = [];
    buildHand(wrist, o, handMat, bead, tipMat, refs);

    // grip anchor: near where thumb+middle tips meet (out along the fingers,
    // a bit below the palm plane) so a pinched piece hangs from the fingertips.
    const grip = new THREE.Group();
    const reach = (0.17 + 0.08 + 0.07 + 0.055) * (o.scale || 1) * 1.4;
    const gripOff = { x: 0, y: -0.04 * (o.scale || 1) * 1.4, z: reach * 0.62 };
    grip.position.set(gripOff.x, gripOff.y, gripOff.z);  // forward + slightly down
    hand.add(grip);

    // ethereal wrist wisp trailing UP and BACK from the wrist (away from board)
    const wisps = [];
    for (let i = 0; i < 6; i++) {
      const w = _sph((0.06 - i * 0.008) * (o.scale || 1) * 1.4, wispMat, [0, 0, 0], 8);
      const f = i / 5;
      w.position.set(0, (0.06 + f * 0.16) * (o.scale || 1) * 1.4, -(0.03 + f * 0.1) * (o.scale || 1) * 1.4);
      orient.add(w); wisps.push({ m: w, i, ph: rand(0, 6) });
    }
    const motes = [];
    for (let i = 0; i < 7; i++) {
      const m = _sph(0.02 * (o.scale || 1) * 1.4, tglow(_c(o.accent, 0xeaf4ff), 1.4, 0.6), [0, 0, 0], 6);
      orient.add(m); motes.push({ m, a: rand(0, 6.28), r: rand(0.12, 0.24) * (o.scale || 1) * 1.4, yo: rand(-0.05, 0.2) * (o.scale || 1) * 1.4, sp: rand(0.6, 1.3) });
    }

    g.add(hand);

    // rest pose lives on the opponent's far edge; app overrides via setRest()
    let rest = { x: _c2(o.restX, 0), y: _c2(o.restHeight, 0.55), z: _c2(o.restZ, -2.6) };
    const restCurl = _c2(o.restCurl, 0.32);       // relaxed-hand baseline curl
    hand.position.set(rest.x, rest.y, rest.z);

    // motion queue. each frame: {pos, pinch, dur, atEnd}. pinch 0..1.
    const cur = { x: rest.x, y: rest.y, z: rest.z, pinch: 0 };
    const queue = []; let frame = null, from = null, ft = 0;
    function push(pos, pinch, dur, atEnd) { queue.push({ pos, pinch, dur, atEnd }); }

    function moveFrames(S, T, h) {
      h = h || {};
      const clr = _c2(o.clearance, 0.45), carry = _c2(o.hoverHeight, 0.55);
      const sTop = (h.grabTopY != null ? h.grabTopY : S.y);   // pinch the piece's TOP
      const tTop = (h.grabTopY != null ? h.grabTopY : T.y);
      // come in over the source
      push({ x: S.x, y: sTop + clr + carry, z: S.z }, 0, 0.55);
      // descend to just above the finial, fingers still open
      push({ x: S.x, y: sTop + 0.04, z: S.z }, 0, 0.32);
      // close the pinch on the top of the piece
      push({ x: S.x, y: sTop, z: S.z }, 1, 0.26, h.onGrab);
      // lift
      push({ x: S.x, y: sTop + clr + carry, z: S.z }, 1, 0.40);
      // carry across (high)
      push({ x: T.x, y: tTop + clr + carry, z: T.z }, 1, 0.78);
      // descend onto the target
      push({ x: T.x, y: tTop, z: T.z }, 1, 0.34);
      // release
      push({ x: T.x, y: tTop + 0.04, z: T.z }, 0, 0.24, h.onRelease);
      // rise, then retreat to rest
      push({ x: T.x, y: tTop + clr + carry, z: T.z }, 0, 0.36);
      push({ x: rest.x, y: rest.y, z: rest.z }, 0, 0.85, h.onDone);
    }

    g.userData.grip = grip;
    g.userData.busy = () => !!frame || queue.length > 0;
    g.userData.idle = () => push({ x: rest.x, y: rest.y, z: rest.z }, 0, 0.7);
    g.userData.setRest = (p) => {
      rest = { x: _c2(p.x, rest.x), y: _c2(p.y, rest.y), z: _c2(p.z, rest.z) };
      if (!g.userData.busy()) { cur.x = rest.x; cur.y = rest.y; cur.z = rest.z; }
    };
    g.userData.playMove = (opts) => moveFrames(opts.from, opts.to, opts);

    // optional demo for the showcase only
    let demoFlip = false;
    function demoLoop() {
      const A = { x: -1, y: 0.5, z: -0.5 }, B = { x: 1, y: 0.5, z: 0.5 };
      const S = demoFlip ? B : A, T = demoFlip ? A : B; demoFlip = !demoFlip;
      moveFrames(S, T, { grabTopY: 0.7, onDone: () => { if (o.demo) demoLoop(); } });
    }
    if (o.demo) demoLoop();

    let gt = 0;
    g.userData.tick = (dt) => {
      gt += dt; const sp = o.speed || 1;
      if (!frame && queue.length) { frame = queue.shift(); from = { x: cur.x, y: cur.y, z: cur.z, pinch: cur.pinch }; ft = 0; }
      if (frame) {
        ft += dt * sp; const u = clamp(ft / frame.dur, 0, 1), e = easeIO(u);
        cur.x = lerp(from.x, frame.pos.x, e);
        cur.y = lerp(from.y, frame.pos.y, e);
        cur.z = lerp(from.z, frame.pos.z, e);
        cur.pinch = lerp(from.pinch, frame.pinch, e);
        if (u >= 1) { const f = frame; frame = null; if (f.atEnd) f.atEnd(); }
      }
      // gentle idle float so the resting hand looks alive (oscillated, not accumulated)
      const bobY = Math.sin(gt * 1.4) * 0.018;
      const swayX = Math.sin(gt * 0.8) * 0.01;
      // target coords refer to where the GRIP (fingertips) should land, so offset
      // the hand origin back by the grip's local offset.
      hand.position.set(cur.x + swayX - gripOff.x, cur.y + bobY - gripOff.y, cur.z - gripOff.z);
      hand.rotation.y = Math.sin(gt * 0.5) * 0.06;

      // finger pose: blend resting curl ↔ pinch by cur.pinch
      if (cur.pinch > 0.001) applyPinch(refs, cur.pinch, restCurl);
      else applyRest(refs, restCurl + Math.sin(gt * 1.1) * 0.02);   // tiny breathing at rest

      // shimmer
      wisps.forEach((w) => { w.m.material.emissiveIntensity = 0.55 + Math.sin(gt * 3 + w.ph) * 0.25; });
      motes.forEach((mo) => { mo.a += dt * mo.sp; mo.m.position.set(Math.cos(mo.a) * mo.r, mo.yo + Math.sin(gt * 1.5 + mo.a) * 0.07, Math.sin(mo.a) * mo.r); });
      const lit = 1.3 + cur.pinch * 0.7;
      tipMat.emissiveIntensity = lit + Math.sin(gt * 4) * 0.18;
      handMat.opacity = _c2(o.opacity, 0.5) + cur.pinch * 0.12;
    };
    return g;
  }, {
    icon: "🖐", category: "wizard chess", params: [
      { key: "fingers",     label: "Fingers",      type: "int",    min: 3, max: 5, step: 1, default: 4 },
      { key: "scale",       label: "Scale",        type: "number", min: 0.5, max: 2.5, step: 0.1, default: 1.1 },
      { key: "restHeight",  label: "Rest Height",  type: "number", min: 0.2, max: 2.0, step: 0.05, default: 0.55 },
      { key: "restZ",       label: "Rest Z (edge)",type: "number", min: -4, max: 4, step: 0.1, default: -2.6 },
      { key: "restX",       label: "Rest X",       type: "number", min: -4, max: 4, step: 0.1, default: 0 },
      { key: "restCurl",    label: "Rest Curl",    type: "number", min: 0, max: 0.6, step: 0.02, default: 0.32 },
      { key: "hoverHeight", label: "Carry Height", type: "number", min: 0.2, max: 1.5, step: 0.05, default: 0.55 },
      { key: "clearance",   label: "Lift Clear",   type: "number", min: 0.1, max: 1.0, step: 0.05, default: 0.45 },
      { key: "speed",       label: "Speed",        type: "number", min: 0.3, max: 2.5, step: 0.1, default: 1.0 },
      { key: "palmTilt",    label: "Palm Tilt",    type: "number", min: -1, max: 1, step: 0.05, default: 0 },
      { key: "color",       label: "Spectral",     type: "color",  default: 0xbfd0ff },
      { key: "accent",      label: "Glow",         type: "color",  default: 0xeaf4ff },
      { key: "opacity",     label: "Opacity",      type: "number", min: 0.2, max: 0.9, step: 0.05, default: 0.5 },
      { key: "demo",        label: "Demo Loop",    type: "bool",   default: false },
    ],
  });
})();
