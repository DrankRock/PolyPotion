// ─────────────────────────────────────────────────────────────────────────────
// human-body.js — PolyPotion · the BASIC HUMAN (procedural T-pose mannequin)
//
// This file owns the base human geometry. Improve the human HERE — the
// HumanGen tool only hosts a viewport + sliders around this module.
//
//   buildHumanGeometry(THREE, params, radial)
//       → merged, indexed BufferGeometry (T-pose, feet on y=0, +Z front,
//         arms along ±X, palms down; hands have 4 fingers + thumb, feet have
//         5 toes, knees have kneecaps). Fast — rebuilt live while sliding.
//   buildSmoothGeometry(THREE, MarchingCubesClass, params, opts)
//       → part-aware SDF union: HARD-union rings within a part (faithful, no
//         bulge), SMOOTH-union between parts so the concave crease at each real
//         joint (leg∩glute, arm∩torso…) fills with a fillet. opts.power sizes
//         the fillet. Marching-cubes'd, welded, lightly relaxed.
//   buildHuman(THREE, params, material) → THREE.Group("Human")
//   HUMAN_PARAMS / defaults() / randomParams() → the tweakable proportions
//
// How the mesh is made: every body part is a "loft" — a list of elliptical
// cross-sections {y, cx, cz, rx, rz} swept along an axis, Catmull-Rom
// smoothed, hemispherically capped, mirrored (limbs) and merged.
// To refine anatomy, edit the section tables in buildParts() below —
// each line is one cross-section (radii in metres at a 1.75 m base figure).
//
// SLIDER COUPLING — the sliders blend into each other (see the derived vars
// at the top of buildParts): `build` (body-fat) also grows the bust, glutes,
// hips, belly, love handles, face and neck, and BURIES muscle definition;
// `muscle` adds bulk (traps, lats, shoulders, limbs, glutes) plus definition
// (abs, pecs, quad cuts) that only shows on a lean-enough figure. Anatomy
// mounted on the torso surface (breasts, abs, pecs, navel) rides frontZ(),
// so it stays glued to the skin as the belly grows.
// ─────────────────────────────────────────────────────────────────────────────

export const HUMAN_PARAMS = [
  { key: 'height',    label: 'Height',      min: 1.45, max: 2.05, step: 0.01, def: 1.75, fmt: 'm'   },
  { key: 'build',     label: 'Build',       min: 0,    max: 1,    step: 0.01, def: 0.5,  fmt: 'pct' },
  { key: 'muscle',    label: 'Muscle',      min: 0,    max: 1,    step: 0.01, def: 0.5,  fmt: 'pct' },
  { key: 'bust',      label: 'Breast size', min: 0,    max: 1,    step: 0.01, def: 0.25, fmt: 'pct' },
  { key: 'shoulders', label: 'Shoulders',   min: 0.85, max: 1.2,  step: 0.01, def: 1,    fmt: 'x'   },
  { key: 'hips',      label: 'Hips',        min: 0.85, max: 1.2,  step: 0.01, def: 1,    fmt: 'x'   },
  { key: 'butt',      label: 'Butt size',   min: 0,    max: 1,    step: 0.01, def: 0.3,  fmt: 'pct' },
  { key: 'legs',      label: 'Leg length',  min: 0.9,  max: 1.1,  step: 0.01, def: 1,    fmt: 'x'   },
  { key: 'head',      label: 'Head size',   min: 0.88, max: 1.15, step: 0.01, def: 1,    fmt: 'x'   },
];

export function defaults() {
  const o = {};
  for (const p of HUMAN_PARAMS) o[p.key] = p.def;
  return o;
}

export function randomParams(rng = Math.random) {
  const o = {};
  for (const p of HUMAN_PARAMS) o[p.key] = +(p.min + (p.max - p.min) * rng()).toFixed(3);
  return o;
}

// ── math helpers ─────────────────────────────────────────────────────────────

const lerp = (a, b, t) => a + (b - a) * t;

function cr(p0, p1, p2, p3, t) { // Catmull-Rom scalar
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

const KEYS = ['y', 'cx', 'cz', 'rx', 'rz'];

function sampleSections(sections, over) {
  const out = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const s0 = sections[Math.max(0, i - 1)], s1 = sections[i];
    const s2 = sections[i + 1], s3 = sections[Math.min(sections.length - 1, i + 2)];
    const steps = (i === sections.length - 2) ? over + 1 : over;
    for (let k = 0; k < steps; k++) {
      const t = k / over, r = {};
      for (const key of KEYS) r[key] = cr(s0[key] || 0, s1[key] || 0, s2[key] || 0, s3[key] || 0, t);
      out.push(r);
    }
  }
  return out;
}

function addCap(rings, atEnd, capScale) {
  const n = rings.length;
  const s = atEnd ? rings[n - 1] : rings[0];
  const prev = atEnd ? rings[n - 2] : rings[1];
  const dy = Math.sign(s.y - prev.y) || (atEnd ? 1 : -1);
  const len = Math.min(s.rx, s.rz) * capScale;
  const steps = 3, extra = [];
  for (let k = 1; k <= steps; k++) {
    const a = (k / (steps + 0.35)) * Math.PI / 2;
    extra.push({
      y: s.y + dy * Math.sin(a) * len, cx: s.cx, cz: s.cz,
      rx: Math.max(0.004, s.rx * Math.cos(a)),
      rz: Math.max(0.004, s.rz * Math.cos(a)),
    });
  }
  if (atEnd) rings.push(...extra);
  else rings.unshift(...extra.reverse());
}

// Sweep sampled rings into a closed, smooth tube geometry.
function ringsToGeometry(THREE, rings, radial) {
  const pos = [], idx = [];
  for (const r of rings) {
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      pos.push((r.cx || 0) + Math.cos(a) * Math.max(0.004, r.rx), r.y, (r.cz || 0) + Math.sin(a) * Math.max(0.004, r.rz));
    }
  }
  for (let i = 0; i < rings.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + (j + 1) % radial;
      const c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
      idx.push(a, c, b, b, c, d);
    }
  }
  const first = rings[0], last = rings[rings.length - 1];
  const p0 = pos.length / 3; pos.push(first.cx || 0, first.y, first.cz || 0);
  for (let j = 0; j < radial; j++) idx.push(p0, j, (j + 1) % radial);
  const p1 = pos.length / 3; pos.push(last.cx || 0, last.y, last.cz || 0);
  const base = (rings.length - 1) * radial;
  for (let j = 0; j < radial; j++) idx.push(p1, base + (j + 1) % radial, base + j);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function mirrorX(THREE, g) {
  const m = g.clone();
  m.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  const idx = m.getIndex().array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  m.getIndex().needsUpdate = true;
  return m;
}

function mergeGeos(THREE, list) {
  let vc = 0, ic = 0;
  for (const g of list) { vc += g.attributes.position.count; ic += g.getIndex().count; }
  const pos = new Float32Array(vc * 3);
  const idx = new Uint32Array(ic);
  let vo = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, vo * 3);
    const gi = g.getIndex().array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count; io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeVertexNormals();
  return out;
}

// ── the figure: part descriptors ─────────────────────────────────────────────
// Base figure is laid out at 1.75 m, then uniformly scaled to params.height.
// Each part = sampled rings + optional rigid transform + mirror flag.

function buildParts(THREE, p) {
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  // ── derived body composition — the sliders BLEND into each other here ──
  // `build` is body-fat: it feeds overall girth, belly, love handles, bust,
  //   glutes, hips, face and neck.
  // `muscle` feeds bulk (shoulders, traps, lats, limbs, glutes) and
  //   *definition* — but fat buries definition, so abs / pecs / quad cuts
  //   fade out as build rises.
  const mus   = p.muscle;                            // 0..1
  const fat   = clamp01((p.build - 0.5) / 0.5);      // 0 average → 1 heavy
  const lean  = clamp01((0.5 - p.build) / 0.5);      // 0 average → 1 skinny
  const g     = lerp(0.86, 1.18, p.build) * (1 + 0.035 * mus); // overall girth
  const belly = Math.max(0, p.build - 0.55) * 2;     // extra midsection past "solid"
  const def   = clamp01(mus * (1 - 1.05 * fat) - 0.35 * belly); // visible cuts
  const bu    = clamp01(p.bust + 0.22 * fat - 0.05 * lean * mus); // fat grows the bust
  const bt    = clamp01(p.butt + 0.16 * fat + 0.12 * mus);        // fat + glute muscle

  // landmarks (base H = 1.75)
  const crown     = 1.75;
  const hs        = p.head;
  const chin      = crown - 0.235 * hs;
  const shoulderY = chin - 0.085;
  const crotch    = 0.82 + (p.legs - 1) * 0.38;
  const ankleY    = 0.07;
  const kneeY     = ankleY + (crotch - ankleY) * 0.53;
  const hipX      = 0.094 * p.hips * (1 + 0.05 * fat);
  const shX       = 0.158 * p.shoulders * (1 + 0.045 * mus);

  const parts = [];
  const part = (sections, opts, matrix, mirror) => {
    const rings = sampleSections(sections, opts.over || 4);
    if (opts.capStart) addCap(rings, false, opts.capStart);
    if (opts.capEnd) addCap(rings, true, opts.capEnd);
    parts.push({ rings, matrix: matrix || null, mirror: !!mirror });
  };

  // — torso: crotch → traps — (definition pinches the waist; fat adds love handles)
  part([
    { y: crotch + 0.015,    rx: 0.112 * g * p.hips,                    rz: 0.094 * g },
    { y: crotch + 0.06,     rx: 0.132 * g * p.hips,                    rz: 0.104 * g,                        cz: -0.006 },
    { y: crotch + 0.155,    rx: (0.118 + 0.010 * mus) * g + belly * 0.010 + 0.010 * fat, rz: 0.090 * g + belly * 0.034, cz: 0.004 + belly * 0.014 },
    { y: crotch + 0.27,     rx: (0.136 + 0.010 * mus - 0.013 * def) * g + 0.014 * fat, rz: (0.100 + 0.006 * mus) * g, cz: 0.004 },
    { y: shoulderY - 0.075, rx: (0.152 + 0.016 * mus) * g * p.shoulders, rz: (0.106 + 0.010 * mus) * g,      cz: 0.006 },
    { y: shoulderY - 0.01,  rx: (0.146 + 0.014 * mus) * g * p.shoulders, rz: 0.094 * g,                      cz: 0.002 },
    { y: shoulderY + 0.035, rx: 0.100 * g * p.shoulders,               rz: 0.078 * g },
  ], { capStart: 0.5, capEnd: 0.55 });

  // front-of-torso z on the midline at height yy — mirrors the torso table
  // above (keep in sync if you edit it). Surface-mounted anatomy (abs, pecs,
  // breasts, navel) rides on this so it stays glued to the skin when build /
  // muscle / belly change.
  const FZ = [
    [crotch + 0.015,     0.094 * g],
    [crotch + 0.06,     -0.006 + 0.104 * g],
    [crotch + 0.155,     0.004 + belly * 0.014 + 0.090 * g + belly * 0.034],
    [crotch + 0.27,      0.004 + (0.100 + 0.006 * mus) * g],
    [shoulderY - 0.075,  0.006 + (0.106 + 0.010 * mus) * g],
    [shoulderY - 0.01,   0.002 + 0.094 * g],
  ];
  const frontZ = (yy) => {
    if (yy <= FZ[0][0]) return FZ[0][1];
    for (let i = 0; i < FZ.length - 1; i++) {
      if (yy <= FZ[i + 1][0]) {
        const t = (yy - FZ[i][0]) / (FZ[i + 1][0] - FZ[i][0]);
        return lerp(FZ[i][1], FZ[i + 1][1], t);
      }
    }
    return FZ[FZ.length - 1][1];
  };

  // — glutes (sized by `butt`; tucked into the pelvis when small) —
  part([
    { y: crotch + 0.005, cx: 0.058, rx: 0.040 + 0.016 * bt, rz: 0.022 + 0.030 * bt, cz: -(0.062 + 0.042 * bt) },
    { y: crotch + 0.058, cx: 0.060, rx: 0.048 + 0.020 * bt, rz: 0.032 + 0.045 * bt, cz: -(0.065 + 0.045 * bt) },
    { y: crotch + 0.112, cx: 0.055, rx: 0.038 + 0.014 * bt, rz: 0.020 + 0.026 * bt, cz: -(0.058 + 0.034 * bt) },
  ], { capStart: 0.6, capEnd: 0.6 }, null, true);

  // — breasts (sized by effective `bu` = bust + fat) — NATURAL PTOSIS profile:
  //   the gland descends from a long, gently-sloped upper pole (melts into the
  //   chest high, near the 2nd rib) into a FULL ROUND LOWER POLE hanging above
  //   a tucked inframammary fold. Max projection (the nipple) sits LOW on the
  //   mound — just above the under-curve — splayed slightly outward and tilted
  //   slightly UP. Round from the front (wide rx at the apex), teardrop from
  //   the side (the cz+rz envelope). Muscle lifts the whole gland a touch
  //   (pec support); size drops the fold, the apex and thins the upper pole.
  //   NOTE: like every other part, sections run bottom→up (y increasing) so
  //   the face winding stays outward. Reading top-to-bottom renders inside-out.
  {
    const chestRx = (0.150 + 0.015 * mus) * g * p.shoulders;    // ribcage half-width
    const rootTop = shoulderY - 0.042 + 0.012 * mus;            // upper pole melts in here
    const foldY   = shoulderY - (0.148 + 0.052 * bu) + 0.010 * mus; // inframammary fold (drops as it grows)
    const span    = rootTop - foldY;                            // gland height on the chest
    const tApex   = 0.40 - 0.07 * bu;                           // nipple height fraction — LOW on the mound
    const cy      = foldY + span * tApex;
    const cxc     = 0.068;                                      // root axis sideways offset
    const cxa     = cxc + 0.006 + 0.010 * bu;                   // apex splays slightly outward
    const lat     = Math.sqrt(Math.max(0.15, 1 - (cxc / chestRx) ** 2));
    const z0      = frontZ(cy) * lat - 0.002;                   // chest skin under the gland
    const rr      = 0.040 + 0.042 * bu;                         // half-width at the apex
    const P       = 0.016 + 0.058 * bu;                         // max projection past the skin
    // Each ring is defined by its FRONT surface (fraction f of P) and width;
    // depth (rz, cz) is then derived so the ring's BACK sits ~1.4 cm inside
    // the ribcage — the gland is always welded into the torso, never a
    // stuck-on cone floating proud of the chest.
    const ring = (t, f, w, x) => {
      const front = z0 + P * f;
      const rz = Math.max(0.006, (P * f + 0.014) / 2);
      return { y: foldY + span * t, cx: x, rx: rr * w, rz, cz: front - rz };
    };
    part([
      ring(0.00, 0.12, 0.42, cxc * 0.94),   // inframammary fold
      ring(0.16, 0.82, 0.86, cxc),          // full round lower pole — the hang
      ring(tApex, 1.00, 1.00, cxa),         // apex: widest AND most forward
      ring(0.62, 0.60, 0.86, cxc + 0.004),  // upper slope, long and shallow
      ring(0.84, 0.24, 0.55, cxc),
      ring(1.00, 0.04, 0.24, cxc * 0.94),   // feathers flat near the 2nd rib
    ], { capStart: 0.45, capEnd: 0.4 }, null, true);

    // nipple + areola — SUBTLE: ~5 mm proud of the apex, tip a touch above and
    // outside the base so the axis tilts gently up-and-out.
    const nr = 0.006 + 0.0035 * bu;
    const F  = z0 + P;
    part([
      { y: cy - nr * 1.5, cx: cxa,             rx: nr * 2.0,  rz: nr * 0.6,  cz: F - nr * 0.55 }, // areola
      { y: cy + nr * 0.2, cx: cxa + nr * 0.15, rx: nr,        rz: nr * 0.55, cz: F - nr * 0.05 },
      { y: cy + nr * 1.1, cx: cxa + nr * 0.25, rx: nr * 0.55, rz: nr * 0.4,  cz: F + nr * 0.30 }, // tip
    ], { capStart: 0.5, capEnd: 0.9 }, null, true);
  }

  // — pectorals — soft broad mound (no hard shelf); fades as the bust grows.
  const pec = def * clamp01(1 - 1.8 * bu);
  if (pec > 0.03) {
    const P2 = 0.003 + 0.010 * pec;
    const pr = (yy, f, w, x) => {
      const front = frontZ(yy) * 0.93 + P2 * f;
      const rz = Math.max(0.005, (P2 * f + 0.016) / 2);
      return { y: yy, cx: x, rx: w, rz, cz: front - rz };
    };
    part([
      pr(shoulderY - 0.138, 0.05, 0.044, 0.058),
      pr(shoulderY - 0.110, 1.00, 0.062, 0.064),
      pr(shoulderY - 0.066, 0.75, 0.056, 0.060),
      pr(shoulderY - 0.026, 0.10, 0.038, 0.046),
    ], { capStart: 0.5, capEnd: 0.5 }, null, true);
  }

  // — rectus abdominis — ONE wavy loft per side (bump/groove/bump along y):
  //   rings inside a part HARD-union, so the pack keeps its cuts instead of
  //   being filleted away; the linea alba groove appears between the mirrored
  //   columns. 3 rows above the navel line + 1 below. Fat buries it (`def`).
  if (def > 0.05) {
    const A   = 0.0025 + 0.0045 * def; // wave amplitude (bump vs valley)
    const B   = 0.0035 + 0.0065 * def; // plate protrusion — B > A, so valleys
    const ax  = 0.026;                 //   never cut below the skin (no slashes)
    const fzA = (yy) => frontZ(yy) * 0.985;
    const row = (yy, w) => ({ y: yy, cx: ax, rx: 0.021, rz: 0.012, cz: fzA(yy) - 0.012 + B + w * A });
    part([
      { y: crotch + 0.135, cx: ax, rx: 0.018, rz: 0.008, cz: fzA(crotch + 0.135) - 0.010 },
      row(crotch + 0.170, +1),    // pack below the navel
      row(crotch + 0.205, -0.6),  // navel line
      row(crotch + 0.240, +1),
      row(crotch + 0.272, -1),
      row(crotch + 0.305, +1),
      row(crotch + 0.335, -1),
      row(crotch + 0.365, +0.9),  // top pack, tucking under the ribs
      { y: crotch + 0.395, cx: ax, rx: 0.018, rz: 0.007, cz: fzA(crotch + 0.395) - 0.010 },
    ], { capStart: 0.4, capEnd: 0.4, over: 3 }, null, true);
  }

  // — trapezius — the neck→shoulder slope; grows with muscle.
  if (mus > 0.02) {
    const T = 0.014 + 0.030 * mus;
    part([
      { y: shoulderY - 0.012, cx: shX * 0.72, cz: -0.012, rx: 0.042, rz: 0.020 + T * 0.5 },
      { y: shoulderY + 0.028, cx: shX * 0.45, cz: -0.010, rx: 0.040, rz: 0.018 + T * 0.6 },
      { y: shoulderY + 0.058, cx: shX * 0.22, cz: -0.006, rx: 0.026, rz: 0.014 + T * 0.4 },
    ], { capStart: 0.5, capEnd: 0.5 }, null, true);
  }

  // — lats — back/armpit wings for the V-taper; grow with muscle.
  if (mus > 0.05) {
    const L = 0.006 + 0.020 * mus;
    part([
      { y: shoulderY - 0.205, cx: 0.090,              cz: -(0.052 * g), rx: 0.026, rz: 0.010 + L * 0.4 },
      { y: shoulderY - 0.150, cx: 0.110 * p.shoulders, cz: -(0.056 * g), rx: 0.036, rz: 0.012 + L },
      { y: shoulderY - 0.095, cx: 0.118 * p.shoulders, cz: -(0.050 * g), rx: 0.034, rz: 0.010 + L * 0.8 },
    ], { capStart: 0.5, capEnd: 0.5 }, null, true);
  }

  // — navel: a small dimple set into the belly front —
  {
    const ny = crotch + 0.20;
    const nz = frontZ(ny) - 0.004;            // ride the belly surface
    part([
      { y: ny + 0.018, cx: 0, rx: 0.014, rz: 0.006, cz: nz + 0.004 },
      { y: ny,         cx: 0, rx: 0.011, rz: 0.010, cz: nz - 0.010 },  // recessed centre
      { y: ny - 0.016, cx: 0, rx: 0.012, rz: 0.006, cz: nz + 0.002 },
    ], { capStart: 0.4, capEnd: 0.4 });
  }

  // — neck —
  part([
    { y: shoulderY - 0.02, rx: (0.056 + 0.008 * mus + 0.008 * fat) * g, rz: (0.052 + 0.006 * fat) * g, cz: 0.004 },
    { y: chin + 0.005,     rx: (0.044 + 0.006 * mus + 0.005 * fat) * g, rz: (0.043 + 0.004 * fat) * g, cz: 0.008 },
  ], { capStart: 0.4, capEnd: 0.4 });

  // — head (chin → crown; cz shapes the face front / skull back) —
  part([
    { y: chin,              rx: 0.030 * hs * (1 + 0.08 * fat), rz: 0.034 * hs * (1 + 0.05 * fat), cz: 0.040 * hs },
    { y: chin + 0.030 * hs, rx: 0.058 * hs * (1 + 0.06 * fat), rz: 0.070 * hs * (1 + 0.03 * fat), cz: 0.012 * hs },
    { y: chin + 0.072 * hs, rx: 0.072 * hs * (1 + 0.04 * fat), rz: 0.090 * hs, cz: 0.004 * hs },
    { y: chin + 0.115 * hs, rx: 0.078 * hs, rz: 0.099 * hs, cz: 0 },
    { y: chin + 0.163 * hs, rx: 0.077 * hs, rz: 0.095 * hs, cz: -0.005 * hs },
    { y: chin + 0.200 * hs, rx: 0.061 * hs, rz: 0.076 * hs, cz: -0.008 * hs },
  ], { capStart: 0.5, capEnd: 0.7 });

  // — right arm (built along +Y, rotated onto +X: T-pose, palm facing down) —
  // In arm-local space +Y = out along the arm; after armXf, local +Y→world +X,
  // local +X→world −Y (up/down = palm thickness), local +Z→world +Z (front/back
  // = the plane the fingers fan across).
  const armXf = new THREE.Matrix4()
    .makeTranslation(shX - 0.008, shoulderY - 0.012, 0)
    .multiply(new THREE.Matrix4().makeRotationZ(-Math.PI / 2));

  part([
    { y: -0.025, rx: 0.050 * g,                  rz: 0.050 * g },
    { y: 0.03,   rx: (0.060 + 0.022 * mus) * g,  rz: (0.058 + 0.020 * mus) * g },  // deltoid
    { y: 0.115,  rx: (0.046 + 0.016 * mus) * g,  rz: (0.044 + 0.014 * mus) * g, cz: 0.006 * mus }, // biceps (peak rolls forward)
    { y: 0.215,  rx: 0.036 * g,                  rz: 0.035 * g },                  // elbow
    { y: 0.30,   rx: (0.041 + 0.012 * mus) * g,  rz: (0.038 + 0.010 * mus) * g },  // forearm
    { y: 0.42,   rx: 0.026 * g,                  rz: 0.024 * g },
    { y: 0.455,  rx: 0.020 * g,                  rz: 0.027 * g },                  // wrist
    { y: 0.505,  rx: 0.016 * g,                  rz: 0.044 },                      // palm
    { y: 0.55,   rx: 0.015 * g,                  rz: 0.047 },                      // knuckles
  ], { capStart: 0.6, capEnd: 0.35 }, armXf, true);

  // — four fingers: tubes continuing along +X, fanned across the palm (local Z) —
  const fingerZ   = [-0.030, -0.010, 0.010, 0.030];
  const fingerLen = [0.070, 0.082, 0.078, 0.062];
  for (let i = 0; i < 4; i++) {
    const zo = fingerZ[i], L = fingerLen[i];
    part([
      { y: 0.548,          cx: 0, cz: zo, rx: 0.0092, rz: 0.0094 },
      { y: 0.548 + L * 0.5, cx: 0, cz: zo, rx: 0.0086, rz: 0.0088 },
      { y: 0.548 + L,      cx: 0, cz: zo, rx: 0.0068, rz: 0.0070 },
    ], { capStart: 0.4, capEnd: 1.0 }, armXf, true);
  }

  // — thumb: off the front edge of the palm, angled forward/down —
  const thumbXf = new THREE.Matrix4().copy(armXf)
    .multiply(new THREE.Matrix4().makeTranslation(0, 0.482, 0.034))
    .multiply(new THREE.Matrix4().makeRotationX(1.05));
  part([
    { y: 0,     rx: 0.0125, rz: 0.011 },
    { y: 0.03,  rx: 0.0115, rz: 0.010 },
    { y: 0.058, rx: 0.0095, rz: 0.0085 },
  ], { capStart: 0.6, capEnd: 1.0 }, thumbXf, true);

  // — right leg (world-space, along Y). NOTE: sections MUST run bottom→up
  //   (ankle→hip) like every other part, or the face winding inverts and the
  //   surface renders inside-out.
  part([
    { y: ankleY,                      cx: hipX - 0.012, rx: 0.030 * g,                 rz: 0.034 * g },
    { y: (kneeY - 0.07 + ankleY) / 2, cx: hipX - 0.010, rx: 0.040 * g,                 rz: 0.045 * g, cz: -0.002 },
    { y: kneeY - 0.07,                cx: hipX - 0.008, rx: (0.056 + 0.014 * mus) * g, rz: (0.061 + 0.016 * mus) * g, cz: -0.007 - 0.007 * mus },  // calf (gastroc rolls back)
    { y: kneeY + 0.02,                cx: hipX - 0.007, rx: 0.054 * g,                 rz: 0.058 * g, cz: 0.003 },
    { y: (crotch + kneeY) / 2,        cx: hipX - 0.004, rx: 0.074 * g,                 rz: 0.080 * g },
    { y: crotch - 0.005,              cx: hipX,         rx: (0.090 + 0.008 * mus) * g, rz: (0.096 + 0.008 * mus) * g, cz: -0.004 },
    { y: crotch + 0.13,               cx: hipX,         rx: 0.086 * g,                 rz: 0.094 * g },
  ], { capStart: 0.5, capEnd: 0.6 }, null, true);

  // — kneecap: a small convex patch proud of the knee front —
  part([
    { y: kneeY - 0.035, cx: hipX - 0.007, cz: 0.050 * g, rx: 0.026 * g, rz: 0.015 * g },
    { y: kneeY + 0.005, cx: hipX - 0.007, cz: 0.060 * g, rx: 0.032 * g, rz: 0.020 * g },
    { y: kneeY + 0.04,  cx: hipX - 0.007, cz: 0.050 * g, rx: 0.024 * g, rz: 0.014 * g },
  ], { capStart: 0.6, capEnd: 0.6 }, null, true);

  // — quads (only when defined): vastus medialis teardrop on the inner-front
  //   just above the knee, and a rectus femoris ridge up the thigh front.
  if (def > 0.08) {
    part([
      { y: kneeY + 0.020, cx: hipX - 0.034, cz: 0.044 * g,               rx: 0.017, rz: 0.008 },
      { y: kneeY + 0.065, cx: hipX - 0.030, cz: 0.050 * g + 0.010 * def, rx: 0.024, rz: 0.010 + 0.008 * def },
      { y: kneeY + 0.110, cx: hipX - 0.024, cz: 0.046 * g,               rx: 0.018, rz: 0.007 },
    ], { capStart: 0.5, capEnd: 0.5 }, null, true);
    part([
      { y: kneeY + 0.10,                cx: hipX - 0.006, cz: 0.052 * g,               rx: 0.024, rz: 0.008 },
      { y: (crotch + kneeY) / 2 + 0.02, cx: hipX - 0.004, cz: 0.070 * g + 0.008 * def, rx: 0.030, rz: 0.009 + 0.007 * def },
      { y: crotch - 0.03,               cx: hipX - 0.002, cz: 0.074 * g,               rx: 0.026, rz: 0.007 },
    ], { capStart: 0.5, capEnd: 0.5 }, null, true);
  }

  // — right foot (built along +Y = heel→toe, rotated onto +Z; flat sole on y=0).
  //   In foot-local space +Y→world +Z (foot length), local +X→world +X (toe
  //   splay), local +Z→world −Y (foot thickness/sole). —
  const ty = 0.052;
  const footXf = new THREE.Matrix4()
    .makeTranslation(hipX - 0.012, ty, -0.068)
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  part([
    { y: 0,     rx: 0.030 * g, rz: 0.030, cz: ty - 0.030 },
    { y: 0.05,  rx: 0.040 * g, rz: 0.038, cz: ty - 0.038 },
    { y: 0.10,  rx: 0.042 * g, rz: 0.032, cz: ty - 0.032 },
    { y: 0.16,  rx: 0.045 * g, rz: 0.024, cz: ty - 0.024 },
    { y: 0.205, rx: 0.047 * g, rz: 0.018, cz: ty - 0.018 },
    { y: 0.235, rx: 0.043 * g, rz: 0.015, cz: ty - 0.015 },
  ], { capStart: 0.8, capEnd: 0.4 }, footXf, true);

  // — five toes: short tubes off the front of the foot, splayed across local X —
  const toeX   = [-0.030, -0.015, 0.000, 0.014, 0.026];   // big (inner) → little
  const toeLen = [0.050, 0.050, 0.045, 0.038, 0.030];
  const toeR   = [0.014, 0.012, 0.0115, 0.010, 0.0085];
  for (let i = 0; i < 5; i++) {
    part([
      { y: 0.232,             cx: toeX[i], cz: ty - 0.014, rx: toeR[i],        rz: toeR[i] },
      { y: 0.232 + toeLen[i], cx: toeX[i], cz: ty - 0.012, rx: toeR[i] * 0.78, rz: toeR[i] * 0.78 },
    ], { capStart: 0.4, capEnd: 1.0 }, footXf, true);
  }

  return parts;
}

// ── fast lofted body (live preview while sliding) ────────────────────────────

export function buildHumanGeometry(THREE, params, radial = 26) {
  const p = Object.assign(defaults(), params || {});
  const parts = buildParts(THREE, p);
  const geoms = [];
  for (const pt of parts) {
    const g = ringsToGeometry(THREE, pt.rings, radial);
    if (pt.matrix) g.applyMatrix4(pt.matrix);
    geoms.push(g);
    if (pt.mirror) geoms.push(mirrorX(THREE, g));
  }
  const merged = mergeGeos(THREE, geoms);
  const s = p.height / 1.75;
  merged.applyMatrix4(new THREE.Matrix4().makeScale(s, s, s));
  return merged;
}

// ── welded body: part-aware SDF union → marching cubes → light relax ─────────
// Each part is a chain of ELLIPTICAL CONES between consecutive rings — one
// smooth tube, no per-ring bulges (no "Michelin man"). Rings inside one part
// hard-union (faithful tube); different parts soft-union so the concave crease
// at each real joint (leg∩glute, arm∩torso…) fills with a clay fillet.
//
// opts.power       fillet size, 0..1 (blend radius between parts). default 0.4
// opts.resolution  marching-cubes grid. default 144
// Pass the three.js MarchingCubes class (examples/jsm/objects).

export function buildSmoothGeometry(THREE, MarchingCubes, params, opts = {}) {
  const p = Object.assign(defaults(), params || {});
  const res = opts.resolution || 144;
  const power = opts.power != null ? opts.power : 0.4;
  const blend = 0.006 + power * 0.05;               // clay-fillet radius (m)
  const parts = buildParts(THREE, p);

  // 1. each part → chain of elliptical-cone segments in the part's LOCAL space,
  //    plus the world→local inverse (rigid, so it preserves distances).
  const SEGN = 12;   // partId, ax,ay,az, bx,by,bz, rxA,rzA,rxB,rzB, ry
  const seg = [], box = [];    // box: parallel world-AABB, stride 6
  const invEls = [];
  const Reflect = new THREE.Matrix4().makeScale(-1, 1, 1);
  let nParts = 0;
  const wp = new THREE.Vector3();

  const addPart = (rings, fwd) => {
    const id = nParts++;
    const inv = new THREE.Matrix4();
    if (fwd) inv.copy(fwd).invert(); else inv.identity();
    invEls[id] = inv.elements.slice();
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i], b = rings[i + 1];
      const ax = a.cx || 0, ay = a.y, az = a.cz || 0;
      const bx = b.cx || 0, by = b.y, bz = b.cz || 0;
      const segLen = Math.hypot(bx - ax, by - ay, bz - az);
      const ry = segLen * 0.5 + 0.004;
      seg.push(id, ax, ay, az, bx, by, bz, a.rx, a.rz, b.rx, b.rz, ry);
      // world-space AABB for binning
      let wax = ax, way = ay, waz = az, wbx = bx, wby = by, wbz = bz;
      if (fwd) { wp.set(ax, ay, az).applyMatrix4(fwd); wax = wp.x; way = wp.y; waz = wp.z; wp.set(bx, by, bz).applyMatrix4(fwd); wbx = wp.x; wby = wp.y; wbz = wp.z; }
      const rm = Math.max(a.rx, a.rz, b.rx, b.rz);
      box.push(Math.min(wax, wbx) - rm, Math.min(way, wby) - rm, Math.min(waz, wbz) - rm,
               Math.max(wax, wbx) + rm, Math.max(way, wby) + rm, Math.max(waz, wbz) + rm);
    }
  };
  for (const pt of parts) {
    addPart(pt.rings, pt.matrix || null);
    if (pt.mirror) {
      const fm = new THREE.Matrix4();
      if (pt.matrix) fm.multiplyMatrices(Reflect, pt.matrix); else fm.copy(Reflect);
      addPart(pt.rings, fm);
    }
  }
  const SEG = new Float64Array(seg), BOX = new Float64Array(box);
  const nSeg = SEG.length / SEGN;

  // 2. bounds → cubic sampling box
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < nSeg; i++) {
    const o = i * 6;
    minX = Math.min(minX, BOX[o]); maxX = Math.max(maxX, BOX[o + 3]);
    minY = Math.min(minY, BOX[o + 1]); maxY = Math.max(maxY, BOX[o + 4]);
    minZ = Math.min(minZ, BOX[o + 2]); maxZ = Math.max(maxZ, BOX[o + 5]);
  }
  const cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2, cz0 = (minZ + maxZ) / 2;
  const S = Math.max(maxX - minX, maxY - minY, maxZ - minZ) / 2 + blend + 0.05;

  // 3. spatial bins of segments
  const B = 24, bins = new Array(B * B * B);
  const margin = blend * 3 + (2 * S) / B + 0.01;
  const toBin = (w, c0) => Math.max(0, Math.min(B - 1, Math.floor(((w - (c0 - S)) / (2 * S)) * B)));
  for (let i = 0; i < nSeg; i++) {
    const o = i * 6;
    const x0 = toBin(BOX[o] - margin, cx0), x1 = toBin(BOX[o + 3] + margin, cx0);
    const y0 = toBin(BOX[o + 1] - margin, cy0), y1 = toBin(BOX[o + 4] + margin, cy0);
    const z0 = toBin(BOX[o + 2] - margin, cz0), z1 = toBin(BOX[o + 5] + margin, cz0);
    for (let bz = z0; bz <= z1; bz++) for (let by = y0; by <= y1; by++) for (let bx = x0; bx <= x1; bx++) {
      const bi = bx + by * B + bz * B * B;
      (bins[bi] || (bins[bi] = [])).push(i);
    }
  }

  // distance to one elliptical cone segment (local space)
  const segDist = (px, py, pz, o) => {
    const ax = SEG[o + 1], ay = SEG[o + 2], az = SEG[o + 3];
    const bax = SEG[o + 4] - ax, bay = SEG[o + 5] - ay, baz = SEG[o + 6] - az;
    const pax = px - ax, pay = py - ay, paz = pz - az;
    const bb = bax * bax + bay * bay + baz * baz || 1e-9;
    let h = (pax * bax + pay * bay + paz * baz) / bb;
    h = h < 0 ? 0 : h > 1 ? 1 : h;
    const cx = ax + bax * h, cy = ay + bay * h, cz = az + baz * h;
    const rx = SEG[o + 7] + (SEG[o + 9] - SEG[o + 7]) * h;
    const rz = SEG[o + 8] + (SEG[o + 10] - SEG[o + 8]) * h;
    const ry = SEG[o + 11];
    const dx = (px - cx) / rx, dy = (py - cy) / ry, dz = (pz - cz) / rz;
    const e = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return (e - 1) * Math.min(rx, rz);
  };

  const pL = new Float64Array(nParts * 3);
  const partMin = new Float64Array(nParts);
  const seen = new Int32Array(nParts);
  const active = new Int32Array(nParts);
  let epoch = 0;

  const sdf = (px, py, pz) => {
    const list = bins[toBin(px, cx0) + toBin(py, cy0) * B + toBin(pz, cz0) * B * B];
    if (!list) return 0.4;
    epoch++; let nA = 0;
    for (let li = 0; li < list.length; li++) {
      const si = list[li], o = si * SEGN, id = SEG[o];
      if (seen[id] !== epoch) {
        seen[id] = epoch;
        const e = invEls[id];
        pL[id * 3]     = e[0] * px + e[4] * py + e[8] * pz + e[12];
        pL[id * 3 + 1] = e[1] * px + e[5] * py + e[9] * pz + e[13];
        pL[id * 3 + 2] = e[2] * px + e[6] * py + e[10] * pz + e[14];
        partMin[id] = 1e9; active[nA++] = id;
      }
      const d = segDist(pL[id * 3], pL[id * 3 + 1], pL[id * 3 + 2], o);
      if (d < partMin[id]) partMin[id] = d;
    }
    // soft-union across parts → fillet at the real seams
    let d = 1e9;
    for (let a = 0; a < nA; a++) {
      const de = partMin[active[a]];
      const h = Math.max(blend - Math.abs(de - d), 0) / blend;
      d = Math.min(de, d) - h * h * blend * 0.25;
    }
    return d;
  };

  // 4. fill the field (positive inside; iso 0 at surface)
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, opts.maxPoly || 900000);
  mc.isolation = 0;
  if (typeof mc.reset === 'function') mc.reset();
  const field = mc.field, res2 = res * res;
  for (let k = 0; k < res; k++) {
    const wz = cz0 + (((k + 0.5) / res) * 2 - 1) * S;
    for (let j = 0; j < res; j++) {
      const wy = cy0 + (((j + 0.5) / res) * 2 - 1) * S;
      const row = j * res + k * res2;
      for (let i = 0; i < res; i++) {
        const wx = cx0 + (((i + 0.5) / res) * 2 - 1) * S;
        field[row + i] = -sdf(wx, wy, wz);
      }
    }
  }
  if (typeof mc.update === 'function') mc.update();
  else if (typeof mc.onBeforeRender === 'function') mc.onBeforeRender();

  // 5. extract + weld
  const posAttr = mc.geometry.getAttribute('position');
  let count = posAttr.count;
  const dr = mc.geometry.drawRange;
  if (dr && isFinite(dr.count) && dr.count > 0) count = Math.min(count, dr.count);
  count -= count % 3;
  const src = posAttr.array;
  if (mc.material) mc.material.dispose();

  const map = new Map(), outPos = [];
  const index = new Uint32Array(count);
  for (let i = 0; i < count; i++) {
    const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2];
    const key = Math.round(x * 1e5) + ',' + Math.round(y * 1e5) + ',' + Math.round(z * 1e5);
    let id = map.get(key);
    if (id === undefined) { id = outPos.length / 3; map.set(key, id); outPos.push(x, y, z); }
    index[i] = id;
  }
  const nV = outPos.length / 3;
  let positions = new Float32Array(outPos);

  // 6. light Taubin — knock the voxel stair-step off, keep the shape
  const adj = new Array(nV);
  for (let i = 0; i < count; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    (adj[a] || (adj[a] = new Set())).add(b).add(c);
    (adj[b] || (adj[b] = new Set())).add(a).add(c);
    (adj[c] || (adj[c] = new Set())).add(a).add(b);
  }
  const tmp = new Float32Array(nV * 3);
  const pass = (lambda) => {
    for (let i = 0; i < nV; i++) {
      const nb = adj[i];
      if (!nb || nb.size === 0) { tmp[i*3]=positions[i*3]; tmp[i*3+1]=positions[i*3+1]; tmp[i*3+2]=positions[i*3+2]; continue; }
      let ax = 0, ay = 0, az = 0;
      for (const n of nb) { ax += positions[n*3]; ay += positions[n*3+1]; az += positions[n*3+2]; }
      const inv = 1 / nb.size;
      tmp[i*3]   = positions[i*3]   + lambda * (ax*inv - positions[i*3]);
      tmp[i*3+1] = positions[i*3+1] + lambda * (ay*inv - positions[i*3+1]);
      tmp[i*3+2] = positions[i*3+2] + lambda * (az*inv - positions[i*3+2]);
    }
    positions.set(tmp);
  };
  for (let it = 0; it < 2; it++) { pass(0.5); pass(-0.53); }

  // 7. world scale + drop feet to the floor
  const sc = p.height / 1.75;
  let minWY = 1e9;
  for (let i = 0; i < nV; i++) {
    positions[i*3]   = (positions[i*3]   * S + cx0) * sc;
    positions[i*3+1] = (positions[i*3+1] * S + cy0) * sc;
    positions[i*3+2] = (positions[i*3+2] * S + cz0) * sc;
    minWY = Math.min(minWY, positions[i*3+1]);
  }
  const lift = -minWY;
  for (let i = 0; i < nV; i++) positions[i*3+1] += lift;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeVertexNormals();
  return geo;
}

export function buildHuman(THREE, params, material) {
  const mat = material || new THREE.MeshStandardMaterial({ color: '#bfc5cf', roughness: 0.55, metalness: 0.05 });
  const mesh = new THREE.Mesh(buildHumanGeometry(THREE, params), mat);
  mesh.name = 'Body';
  mesh.castShadow = mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.name = 'Human';
  group.add(mesh);
  return group;
}