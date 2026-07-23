// ============================================================
// rig-cut.js — CUT LINKS analysis  (window.RigCut)
// Pure geometry analysis for the Rig tool. Two jobs, both on the raw mesh:
//   1. Weld every mesh vertex by position and find CONNECTED COMPONENTS
//      ("islands") — a floating accessory (a leaf sitting on a leg) is its own
//      island; the body is the largest.
//   2. Detect THIN BRIDGES ("strings") — narrow tubes of triangles that glue
//      one region to another. When such a string spans from, say, a leaf to the
//      arm, auto-skin bleeds arm-bone weight across it and the leaf stretches
//      when the arm moves. We find the narrow band and mark its faces so the
//      engine can physically remove them, splitting the string into two islands.
//
// After a cut the mesh is genuinely separated, so binding (nearest-bone or
// geodesic) can no longer drag the freed part — no post-bind weight hacks.
//
// analyze(meshes, opts) -> {
//   nWeld, comp:Int32Array(nWeld), compSizes, order(comp ids big->small),
//   triComp: per-mesh Int32Array(triCount) = component id of each triangle,
//   triThin: per-mesh Uint8Array(triCount) = 1 if triangle is in a thin band,
//   islands: [{comp, tris, verts, center:[x,y,z]}] big->small,
//   bridgesFound: total thin triangles,
// }
//   meshes: [{ position:Float32Array, index:(Uint32Array|Uint16Array|null) }]
//   opts:   { radius=4, sensitivity=0.35 }  sensitivity 0..1 (higher = cut more)
// ============================================================
(function () {
  const Q = 1e4;   // position quantization for welding

  function analyze(meshes, opts) {
    opts = opts || {};
    const R = Math.max(2, opts.radius || 4);
    const sens = Math.max(0.02, Math.min(0.95, opts.sensitivity == null ? 0.35 : opts.sensitivity));

    // ---- 1. weld all corners across all meshes by position ----
    const map = new Map();
    const wx = [], wy = [], wz = [];
    const triCornersPerMesh = [];   // per mesh: Int32Array(triCount*3) of welded ids
    const key = (x, y, z) => Math.round(x * Q) + '_' + Math.round(y * Q) + '_' + Math.round(z * Q);
    for (const m of meshes) {
      const pos = m.position, idx = m.index;
      const triCount = idx ? idx.length / 3 : pos.length / 9;
      const corners = new Int32Array(triCount * 3);
      const vid = (i) => idx ? idx[i] : i;
      for (let t = 0; t < triCount; t++) {
        for (let c = 0; c < 3; c++) {
          const i = vid(t * 3 + c);
          const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
          const k = key(x, y, z);
          let id = map.get(k);
          if (id === undefined) { id = wx.length; wx.push(x); wy.push(y); wz.push(z); map.set(k, id); }
          corners[t * 3 + c] = id;
        }
      }
      triCornersPerMesh.push(corners);
    }
    const nWeld = wx.length;

    // ---- 2. adjacency (welded vertex graph via triangle edges) ----
    const adjSet = Array.from({ length: nWeld }, () => null);
    const link = (a, b) => {
      if (a === b) return;
      let s = adjSet[a]; if (!s) { s = adjSet[a] = new Set(); } s.add(b);
      let s2 = adjSet[b]; if (!s2) { s2 = adjSet[b] = new Set(); } s2.add(a);
    };
    for (const corners of triCornersPerMesh) {
      for (let t = 0; t < corners.length; t += 3) {
        const a = corners[t], b = corners[t + 1], c = corners[t + 2];
        link(a, b); link(b, c); link(c, a);
      }
    }
    // flatten adjacency to CSR for fast BFS
    const deg = new Int32Array(nWeld);
    for (let v = 0; v < nWeld; v++) deg[v] = adjSet[v] ? adjSet[v].size : 0;
    const off = new Int32Array(nWeld + 1);
    for (let v = 0; v < nWeld; v++) off[v + 1] = off[v] + deg[v];
    const nbr = new Int32Array(off[nWeld]);
    { const cur = off.slice(); for (let v = 0; v < nWeld; v++) if (adjSet[v]) for (const w of adjSet[v]) nbr[cur[v]++] = w; }

    // ---- 3a. preliminary FULL components (no cut) to find the main body ----
    // Bridges only make sense INSIDE the body; a small SEPARATE island reads as
    // all-thin (it never grows a big ball) but isn't a bridge — so restrict thin
    // detection to the largest component and leave separate islands whole.
    const p0 = new Int32Array(nWeld); for (let v = 0; v < nWeld; v++) p0[v] = v;
    const find0 = (a) => { while (p0[a] !== a) { p0[a] = p0[p0[a]]; a = p0[a]; } return a; };
    const uni0 = (a, b) => { const ra = find0(a), rb = find0(b); if (ra !== rb) p0[ra] = rb; };
    for (const corners of triCornersPerMesh) {
      for (let t = 0; t < corners.length; t += 3) { const a = corners[t], b = corners[t + 1], c = corners[t + 2]; uni0(a, b); uni0(b, c); uni0(c, a); }
    }
    let mainRoot = -1, mainSz = -1; const sz0 = new Map();
    for (let v = 0; v < nWeld; v++) { const r = find0(v); const c = (sz0.get(r) || 0) + 1; sz0.set(r, c); if (c > mainSz) { mainSz = c; mainRoot = r; } }

    // ---- 3. thinness metric: BFS-ball size at radius R per vertex ----
    // On a broad sheet/limb the ball is large; on a thin string tube it's small.
    const ball = new Int32Array(nWeld);
    const seen = new Int32Array(nWeld).fill(-1);
    const queue = new Int32Array(nWeld);
    for (let v = 0; v < nWeld; v++) {
      let head = 0, tail = 0, count = 0;
      queue[tail++] = v; seen[v] = v; const depthOf = new Map(); depthOf.set(v, 0);
      while (head < tail) {
        const u = queue[head++]; count++;
        const d = depthOf.get(u);
        if (d >= R) continue;
        for (let e = off[u]; e < off[u + 1]; e++) {
          const w = nbr[e];
          if (seen[w] !== v) { seen[w] = v; depthOf.set(w, d + 1); queue[tail++] = w; }
        }
      }
      ball[v] = count;
    }
    // median ball → thin threshold
    const sorted = Array.from(ball).sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1] || 1;
    // map slider (0..1) so a moderate default catches genuine thin strings
    // (ball far below the mesh median) while leaving limbs/torso intact
    const thinThresh = median * (0.25 + sens * 0.75);
    const thinV = new Uint8Array(nWeld);
    for (let v = 0; v < nWeld; v++) if (ball[v] <= thinThresh && find0(v) === mainRoot) thinV[v] = 1;

    // ---- 4. connected components AFTER cutting thin bands ----
    // Union everything, but do NOT union across edges where BOTH ends are thin
    // (that severs the narrow neck so the two sides become separate islands).
    const parent = new Int32Array(nWeld); for (let v = 0; v < nWeld; v++) parent[v] = v;
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const uni = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
    for (const corners of triCornersPerMesh) {
      for (let t = 0; t < corners.length; t += 3) {
        const a = corners[t], b = corners[t + 1], c = corners[t + 2];
        const ea = !(thinV[a] && thinV[b]), eb = !(thinV[b] && thinV[c]), ec = !(thinV[c] && thinV[a]);
        if (ea) uni(a, b); if (eb) uni(b, c); if (ec) uni(c, a);
      }
    }
    const comp = new Int32Array(nWeld);
    const compIndex = new Map(); let nComp = 0;
    for (let v = 0; v < nWeld; v++) { const r = find(v); let ci = compIndex.get(r); if (ci === undefined) { ci = nComp++; compIndex.set(r, ci); } comp[v] = ci; }
    const compSizes = new Int32Array(nComp);
    for (let v = 0; v < nWeld; v++) compSizes[comp[v]]++;

    // ---- 5. per-triangle labels + island stats ----
    const triComp = [], triThin = [];
    const cx = new Float64Array(nComp), cy = new Float64Array(nComp), cz = new Float64Array(nComp), cn = new Int32Array(nComp);
    let bridgesFound = 0;
    for (const corners of triCornersPerMesh) {
      const tc = corners.length / 3;
      const tCompArr = new Int32Array(tc), tThinArr = new Uint8Array(tc);
      for (let t = 0; t < tc; t++) {
        const a = corners[t * 3], b = corners[t * 3 + 1], c = corners[t * 3 + 2];
        // triangle belongs to the component its (majority) verts land in
        const ci = comp[a];
        tCompArr[t] = ci;
        cx[ci] += wx[a] + wx[b] + wx[c]; cy[ci] += wy[a] + wy[b] + wy[c]; cz[ci] += wz[a] + wz[b] + wz[c]; cn[ci] += 3;
        if (thinV[a] && thinV[b] && thinV[c]) { tThinArr[t] = 1; bridgesFound++; }
      }
      triComp.push(tCompArr); triThin.push(tThinArr);
    }

    const islands = [];
    for (let ci = 0; ci < nComp; ci++) {
      islands.push({ comp: ci, verts: compSizes[ci], tris: 0, center: cn[ci] ? [cx[ci] / cn[ci], cy[ci] / cn[ci], cz[ci] / cn[ci]] : [0, 0, 0] });
    }
    for (const tCompArr of triComp) for (let t = 0; t < tCompArr.length; t++) islands[tCompArr[t]].tris++;
    islands.sort((a, b) => b.tris - a.tris);
    const order = islands.map(i => i.comp);

    return { nWeld, nComp, comp, compSizes, triComp, triThin, islands, order, bridgesFound, thinThresh, median };
  }

  window.RigCut = { analyze };
})();
