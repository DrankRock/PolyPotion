// ============================================================
// symmetry-map.js — the ONE symmetry contract (audit, correctness §2)
// Every brush tool used to build its own X-mirror vertex map at its own
// hard-coded quantisation (morph 220, weightpaint 250, sculpt 4000), so "mirror
// X" welded at a different real-world tolerance in each tool and topological
// symmetry was ad-hoc. This centralises it:
//
//   buildMirrorMap(positions, opts) → {
//     mirror,        // Int32Array: vert i → its mirror across X=0 (-1 = none;
//                    //             i itself if it sits on the centreline)
//     onAxis,        // Uint8Array: 1 if the vert is on the centreline
//     tol,           // the world-space weld tolerance actually used
//     matched,       // how many verts found a mirror partner
//   }
//
// The tolerance is SCALE-RELATIVE: a fraction of the mesh's bounding-box
// diagonal (default 1/2000), so the same fraction welds in every tool no
// matter the model's units. Pass {tol} to override with an absolute value.
//
//   mirrorBonePartners(names) → Int32Array mapping each bone index to its
//   left/right twin's index (own index when centre / no twin). Shared by
//   weight-paint mirror and anything that remaps L/R skin indices.
// ============================================================

export function buildMirrorMap(positions, opts) {
  opts = opts || {};
  const p = positions;
  const n = (p.length / 3) | 0;
  const mirror = new Int32Array(n).fill(-1);
  const onAxis = new Uint8Array(n);
  if (!n) return { mirror, onAxis, tol: 0, matched: 0 };

  // bbox diagonal → scale-relative tolerance
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const diag = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const tol = opts.tol != null ? opts.tol : diag * (opts.frac || (1 / 2000));
  const cell = tol > 0 ? tol : diag / 2000;
  const key = (x, y, z) => Math.round(x / cell) + '_' + Math.round(y / cell) + '_' + Math.round(z / cell);

  const byKey = new Map();
  for (let i = 0; i < n; i++) {
    byKey.set(key(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]), i);
    if (Math.abs(p[i * 3]) <= tol) onAxis[i] = 1;
  }
  let matched = 0;
  for (let i = 0; i < n; i++) {
    if (onAxis[i]) { mirror[i] = i; matched++; continue; }
    const j = byKey.get(key(-p[i * 3], p[i * 3 + 1], p[i * 3 + 2]));
    if (j != null && j !== i) { mirror[i] = j; matched++; }
  }
  return { mirror, onAxis, tol, matched };
}

// left/right bone twin resolver, name-based (mixamo / AutoRig / generic).
export function mirrorBonePartners(names) {
  const lc = names.map(s => (s || '').toLowerCase());
  const twin = (name) => {
    // token-boundary L/R swaps, longest patterns first
    const pairs = [
      ['left', 'right'], ['_l_', '_r_'], ['.l', '.r'], ['-l-', '-r-'],
      ['lft', 'rgt'], ['lf', 'rt'],
    ];
    for (const [a, b] of pairs) {
      if (name.includes(a)) return name.split(a).join(b);
      if (name.includes(b)) return name.split(b).join(a);
    }
    // trailing/leading single L or R token (e.g. "ArmL", "L_Hand")
    let m = name.replace(/(^|[^a-z])l([^a-z]|$)/, (s, a, b) => a + 'r' + b);
    if (m !== name) return m;
    m = name.replace(/(^|[^a-z])r([^a-z]|$)/, (s, a, b) => a + 'l' + b);
    return m;
  };
  const out = new Int32Array(names.length);
  for (let i = 0; i < lc.length; i++) {
    const t = twin(lc[i]);
    const j = t === lc[i] ? i : lc.indexOf(t);
    out[i] = j >= 0 ? j : i;
  }
  return out;
}

window.PPSymmetry = { buildMirrorMap, mirrorBonePartners };
export default { buildMirrorMap, mirrorBonePartners };
