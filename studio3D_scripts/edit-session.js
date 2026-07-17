// ============================================================
// edit-session.js — MESHEDIT · Blender-style EDIT MODE
// Turns one element's raw triangles into an editable topology:
//   · welds the non-indexed position buffer into unique VERTICES
//   · derives EDGES and FACES (triangles) over those welded verts
//   · vertex / edge / face selection (click, shift-add, box-select)
//   · modal transforms — Grab (G) / Rotate (R) / Scale (S) with X/Y/Z
//     axis lock, driven by the mouse exactly like Blender; on-screen
//     axis buttons do the same for discoverability
//   · topology ops — Extrude, Subdivide, Delete/Dissolve, Merge-by-distance
// The session owns three overlay objects (points, wire, selection) that
// live in engine.root so they align 1:1 with the element mesh at origin.
// On commit it writes welded positions back to every triangle corner.
// ============================================================
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const QUANT = 2000; // weld precision — matches the engine's island/adjacency weld

const COL = {
  vert: 0x6b7480, vertSel: 0xff7a2f,
  edge: 0x3a424d, edgeSel: 0xff7a2f,
  faceSel: 0xff7a2f,
  axisX: 0xe0564f, axisY: 0x5fb85f, axisZ: 0x4d82d6,
};

export class EditSession {
  constructor(engine, element) {
    this.engine = engine;
    this.el = element;
    this.mesh = element.mesh;
    this.scene = engine.scene;
    this.camera = engine.camera;
    this.renderer = engine.renderer;
    this.ray = new THREE.Raycaster();

    // snap the element home so geometry-local == world (overlays sit in engine.root)
    element.detached = false; element.offset.set(0, 0, 0);
    this.mesh.position.set(0, 0, 0);

    this.selMode = 'vert';           // vert | edge | face
    this.sel = new Set();            // selected welded-vertex indices
    this.transform = null;           // active modal transform
    this.axis = null;                // 'x'|'y'|'z' lock during transform
    this.onChange = null;            // UI callback (counts, mode)
    this._undo = [];

    this._build();
    this._buildOverlays();
    this._refreshOverlays();
  }

  // ---------------------------------------------------------- TOPOLOGY
  _build() {
    const pos = this.mesh.geometry.attributes.position;
    const nCorners = pos.count;
    const q = v => Math.round(v * QUANT);
    const map = new Map();
    this.verts = [];                 // {p:Vector3, corners:[cornerIdx]}
    this.corner2vert = new Int32Array(nCorners);
    for (let i = 0; i < nCorners; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = q(x) + ',' + q(y) + ',' + q(z);
      let vi = map.get(k);
      if (vi == null) { vi = this.verts.length; this.verts.push({ p: V(x, y, z), corners: [] }); map.set(k, vi); }
      this.verts[vi].corners.push(i);
      this.corner2vert[i] = vi;
    }
    // faces (triangles) as welded-vert triplets
    this.faces = [];                 // {v:[a,b,c], corner:firstCornerIdx}
    for (let f = 0; f < nCorners / 3; f++) {
      const a = this.corner2vert[f * 3], b = this.corner2vert[f * 3 + 1], c = this.corner2vert[f * 3 + 2];
      this.faces.push({ v: [a, b, c], corner: f * 3 });
    }
    // edges (unique) with incident faces
    this.edges = [];
    const ekey = (a, b) => a < b ? a + '|' + b : b + '|' + a;
    const emap = new Map();
    const addEdge = (a, b, fi) => {
      if (a === b) return; const k = ekey(a, b);
      let ei = emap.get(k);
      if (ei == null) { ei = this.edges.length; this.edges.push({ a: Math.min(a, b), b: Math.max(a, b), faces: [] }); emap.set(k, ei); }
      this.edges[ei].faces.push(fi);
    };
    this.faces.forEach((f, fi) => { addEdge(f.v[0], f.v[1], fi); addEdge(f.v[1], f.v[2], fi); addEdge(f.v[2], f.v[0], fi); });
    this._emap = emap; this._ekey = ekey;
    // vertex → incident faces (for extrude / normals)
    this.vert2faces = this.verts.map(() => []);
    this.faces.forEach((f, fi) => f.v.forEach(vi => this.vert2faces[vi].push(fi)));
  }

  stats() { return { verts: this.verts.length, edges: this.edges.length, faces: this.faces.length, sel: this.selCount() }; }
  selCount() {
    if (this.selMode === 'face') return this._selectedFaces().length;
    if (this.selMode === 'edge') return this._selectedEdges().length;
    return this.sel.size;
  }

  // ---------------------------------------------------------- OVERLAYS
  _buildOverlays() {
    this.group = new THREE.Group();
    this.engine.root.add(this.group);
    // points
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.verts.length * 3), 3));
    pg.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.verts.length * 3), 3));
    this.points = new THREE.Points(pg, new THREE.PointsMaterial({ size: 7, sizeAttenuation: false, vertexColors: true, depthTest: false }));
    this.points.renderOrder = 10; this.group.add(this.points);
    // wire (all edges)
    const wg = new THREE.BufferGeometry();
    const wpos = new Float32Array(this.edges.length * 6);
    this.wire = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: COL.edge, transparent: true, opacity: 0.55, depthTest: true }));
    wg.setAttribute('position', new THREE.Float32BufferAttribute(wpos, 3));
    this.wire.renderOrder = 8; this.group.add(this.wire);
    // selected-edge wire (drawn brighter, on top)
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(0), 3));
    this.selWire = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: COL.edgeSel, depthTest: false, linewidth: 2 }));
    this.selWire.renderOrder = 11; this.group.add(this.selWire);
    // selected-face overlay
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(0), 3));
    this.selFaceMesh = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: COL.faceSel, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.selFaceMesh.renderOrder = 9; this.group.add(this.selFaceMesh);
  }

  _selectedFaces() {
    // a face counts as selected when all 3 verts are selected
    const out = [];
    for (let i = 0; i < this.faces.length; i++) { const v = this.faces[i].v; if (this.sel.has(v[0]) && this.sel.has(v[1]) && this.sel.has(v[2])) out.push(i); }
    return out;
  }
  _selectedEdges() {
    const out = [];
    for (let i = 0; i < this.edges.length; i++) { const e = this.edges[i]; if (this.sel.has(e.a) && this.sel.has(e.b)) out.push(i); }
    return out;
  }

  _refreshOverlays() {
    // points
    const pp = this.points.geometry.attributes.position, pc = this.points.geometry.attributes.color;
    const cSel = new THREE.Color(COL.vertSel), cBase = new THREE.Color(COL.vert);
    for (let i = 0; i < this.verts.length; i++) {
      const p = this.verts[i].p; pp.setXYZ(i, p.x, p.y, p.z);
      const c = this.sel.has(i) ? cSel : cBase; pc.setXYZ(i, c.r, c.g, c.b);
    }
    pp.needsUpdate = true; pc.needsUpdate = true;
    this.points.visible = this.selMode === 'vert' || this.selMode === 'edge';
    // wire
    const wp = this.wire.geometry.attributes.position;
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i], a = this.verts[e.a].p, b = this.verts[e.b].p;
      wp.setXYZ(i * 2, a.x, a.y, a.z); wp.setXYZ(i * 2 + 1, b.x, b.y, b.z);
    }
    wp.needsUpdate = true;
    // selected edges
    const se = this._selectedEdges();
    const sarr = new Float32Array(se.length * 6);
    se.forEach((ei, k) => { const e = this.edges[ei], a = this.verts[e.a].p, b = this.verts[e.b].p; sarr.set([a.x, a.y, a.z, b.x, b.y, b.z], k * 6); });
    this.selWire.geometry.setAttribute('position', new THREE.Float32BufferAttribute(sarr, 3));
    this.selWire.visible = this.selMode === 'edge';
    // selected faces
    const sf = this._selectedFaces();
    const farr = new Float32Array(sf.length * 9);
    sf.forEach((fi, k) => { const v = this.faces[fi].v; for (let j = 0; j < 3; j++) { const p = this.verts[v[j]].p; farr.set([p.x, p.y, p.z], k * 9 + j * 3); } });
    this.selFaceMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(farr, 3));
    this.selFaceMesh.visible = this.selMode === 'face';
    if (this.onChange) this.onChange(this.stats());
  }

  // push welded positions back into the non-indexed corner buffer
  _applyToMesh() {
    const pos = this.mesh.geometry.attributes.position;
    for (let vi = 0; vi < this.verts.length; vi++) {
      const p = this.verts[vi].p, corners = this.verts[vi].corners;
      for (let c = 0; c < corners.length; c++) pos.setXYZ(corners[c], p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.mesh.geometry.computeBoundingBox();
  }

  // ---------------------------------------------------------- SELECTION
  setSelMode(m) {
    // convert current selection sensibly when switching
    this.selMode = m; this._refreshOverlays();
  }
  selectAll() { for (let i = 0; i < this.verts.length; i++) this.sel.add(i); this._refreshOverlays(); }
  selectNone() { this.sel.clear(); this._refreshOverlays(); }
  invert() { const n = new Set(); for (let i = 0; i < this.verts.length; i++) if (!this.sel.has(i)) n.add(i); this.sel = n; this._refreshOverlays(); }
  grow() {
    const add = new Set(this.sel);
    this.sel.forEach(vi => this.vert2faces[vi].forEach(fi => this.faces[fi].v.forEach(x => add.add(x))));
    this.sel = add; this._refreshOverlays();
  }

  _project(p) {
    const v = p.clone().project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: (v.x * 0.5 + 0.5) * r.width, y: (-v.y * 0.5 + 0.5) * r.height, z: v.z, behind: v.z > 1 };
  }
  // click select. sx,sy are canvas-local pixels
  pick(sx, sy, additive) {
    if (this.selMode === 'face') return this._pickFace(sx, sy, additive);
    if (this.selMode === 'edge') return this._pickEdge(sx, sy, additive);
    return this._pickVert(sx, sy, additive);
  }
  _pickVert(sx, sy, additive) {
    let best = -1, bestD = 12 * 12;
    for (let i = 0; i < this.verts.length; i++) {
      const s = this._project(this.verts[i].p); if (s.behind) continue;
      const d = (s.x - sx) ** 2 + (s.y - sy) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) { if (!additive) this.selNone_(); this._refreshOverlays(); return; }
    if (!additive) this.sel.clear();
    if (additive && this.sel.has(best)) this.sel.delete(best); else this.sel.add(best);
    this._refreshOverlays();
  }
  selNone_() { this.sel.clear(); }
  _pickEdge(sx, sy, additive) {
    let best = -1, bestD = 10 * 10;
    for (let i = 0; i < this.edges.length; i++) {
      const e = this.edges[i]; const a = this._project(this.verts[e.a].p), b = this._project(this.verts[e.b].p);
      if (a.behind || b.behind) continue;
      const d = distToSeg(sx, sy, a.x, a.y, b.x, b.y);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0) { if (!additive) this.sel.clear(); this._refreshOverlays(); return; }
    const e = this.edges[best];
    if (!additive) this.sel.clear();
    const on = this.sel.has(e.a) && this.sel.has(e.b);
    if (additive && on) { this.sel.delete(e.a); this.sel.delete(e.b); } else { this.sel.add(e.a); this.sel.add(e.b); }
    this._refreshOverlays();
  }
  _pickFace(sx, sy, additive) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2((sx / r.width) * 2 - 1, -(sy / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hit = this.ray.intersectObject(this.mesh, false)[0];
    if (!hit || hit.faceIndex == null) { if (!additive) this.sel.clear(); this._refreshOverlays(); return; }
    const f = this.faces[hit.faceIndex]; if (!f) return;
    if (!additive) this.sel.clear();
    const on = f.v.every(vi => this.sel.has(vi));
    if (additive && on) f.v.forEach(vi => this.sel.delete(vi)); else f.v.forEach(vi => this.sel.add(vi));
    this._refreshOverlays();
  }
  // rectangular box select (canvas-local pixel rect)
  boxSelect(x0, y0, x1, y1, additive) {
    const lo = { x: Math.min(x0, x1), y: Math.min(y0, y1) }, hi = { x: Math.max(x0, x1), y: Math.max(y0, y1) };
    if (!additive) this.sel.clear();
    for (let i = 0; i < this.verts.length; i++) {
      const s = this._project(this.verts[i].p); if (s.behind) continue;
      if (s.x >= lo.x && s.x <= hi.x && s.y >= lo.y && s.y <= hi.y) this.sel.add(i);
    }
    this._refreshOverlays();
  }

  // ---------------------------------------------------------- TRANSFORMS (modal)
  _pivot() {
    const c = V(0, 0, 0); let n = 0;
    this.sel.forEach(vi => { c.add(this.verts[vi].p); n++; });
    if (n) c.multiplyScalar(1 / n); return c;
  }
  _viewPlane(pivot) { const n = this.camera.getWorldDirection(new THREE.Vector3()); return new THREE.Plane().setFromNormalAndCoplanarPoint(n, pivot); }
  _rayPoint(sx, sy, plane) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2((sx / r.width) * 2 - 1, -(sy / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const hp = new THREE.Vector3();
    return this.ray.ray.intersectPlane(plane, hp) ? hp : null;
  }
  beginTransform(kind, sx, sy) {
    if (!this.sel.size) return false;
    this._pushUndo();
    const pivot = this._pivot();
    const start = new Map(); this.sel.forEach(vi => start.set(vi, this.verts[vi].p.clone()));
    const plane = this._viewPlane(pivot);
    const startHit = (sx != null) ? this._rayPoint(sx, sy, plane) : pivot.clone();
    const startScreen = this._project(pivot);
    this.transform = { kind, pivot, start, plane, startHit: startHit || pivot.clone(), startScreen, sx, sy, factor: 1, angle: 0 };
    this.axis = null;
    this.engine.controls.enableRotate = false;
    return true;
  }
  setAxis(a) { if (this.transform) { this.axis = (this.axis === a ? null : a); this.updateTransform(this._lastSx, this._lastSy); } }
  updateTransform(sx, sy) {
    const t = this.transform; if (!t) return;
    this._lastSx = sx; this._lastSy = sy;
    if (t.kind === 'grab') {
      const hp = this._rayPoint(sx, sy, t.plane); if (!hp) return;
      let d = hp.clone().sub(t.startHit);
      if (this.axis) { const ax = axisVec(this.axis); d = ax.clone().multiplyScalar(d.dot(ax)); }
      t.start.forEach((p0, vi) => this.verts[vi].p.copy(p0).add(d));
    } else if (t.kind === 'scale') {
      const d0 = Math.hypot(t.sx - t.startScreen.x, t.sy - t.startScreen.y) || 1;
      const d1 = Math.hypot(sx - t.startScreen.x, sy - t.startScreen.y);
      let f = d1 / d0; if (!isFinite(f)) f = 1;
      const sv = this.axis ? scaleVec(this.axis, f) : V(f, f, f);
      t.start.forEach((p0, vi) => { const p = p0.clone().sub(t.pivot); p.multiply(sv); this.verts[vi].p.copy(p.add(t.pivot)); });
    } else if (t.kind === 'rotate') {
      const a0 = Math.atan2(t.sy - t.startScreen.y, t.sx - t.startScreen.x);
      const a1 = Math.atan2(sy - t.startScreen.y, sx - t.startScreen.x);
      let ang = a1 - a0;
      const axv = this.axis ? axisVec(this.axis) : this.camera.getWorldDirection(new THREE.Vector3()).negate();
      const m = new THREE.Matrix4().makeRotationAxis(axv.normalize(), ang);
      t.start.forEach((p0, vi) => { const p = p0.clone().sub(t.pivot).applyMatrix4(m).add(t.pivot); this.verts[vi].p.copy(p); });
    }
    this._applyToMesh(); this._refreshOverlays();
  }
  commitTransform() { if (this.transform) { this.transform = null; this.axis = null; this.engine.controls.enableRotate = true; this._applyToMesh(); this._refreshOverlays(); this.engine._changed(); } }
  cancelTransform() {
    const t = this.transform; if (!t) return;
    t.start.forEach((p0, vi) => this.verts[vi].p.copy(p0));
    this.transform = null; this.axis = null; this.engine.controls.enableRotate = true;
    this._applyToMesh(); this._refreshOverlays();
  }
  // button-driven nudge / rotate / scale (no mouse modal)
  nudge(axis, amt) { if (!this.sel.size) return; this._pushUndo(); const d = axisVec(axis).multiplyScalar(amt); this.sel.forEach(vi => this.verts[vi].p.add(d)); this._applyToMesh(); this._refreshOverlays(); this.engine._changed(); }
  rotateStep(axis, deg) { if (!this.sel.size) return; this._pushUndo(); const piv = this._pivot(); const m = new THREE.Matrix4().makeRotationAxis(axisVec(axis), deg * Math.PI / 180); this.sel.forEach(vi => { const p = this.verts[vi].p.clone().sub(piv).applyMatrix4(m).add(piv); this.verts[vi].p.copy(p); }); this._applyToMesh(); this._refreshOverlays(); this.engine._changed(); }
  scaleStep(f) { if (!this.sel.size) return; this._pushUndo(); const piv = this._pivot(); this.sel.forEach(vi => { const p = this.verts[vi].p.clone().sub(piv).multiplyScalar(f).add(piv); this.verts[vi].p.copy(p); }); this._applyToMesh(); this._refreshOverlays(); this.engine._changed(); }

  // ---------------------------------------------------------- TOPOLOGY OPS
  // rebuild the whole geometry from an explicit triangle list of welded verts.
  _rebuildFromTris(tris, vertPos) {
    const arr = new Float32Array(tris.length * 9);
    for (let t = 0; t < tris.length; t++) for (let k = 0; k < 3; k++) { const p = vertPos[tris[t][k]]; arr.set([p.x, p.y, p.z], t * 9 + k * 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    g.computeVertexNormals(); g.computeBoundingBox();
    this.mesh.geometry.dispose(); this.mesh.geometry = g;
    this.el.faceCount = tris.length; this.el._adj = null;
    this._build(); // re-derive topology from the fresh corner buffer
    // rebuild overlay buffers to the new vert/edge counts
    this.group.remove(this.points, this.wire, this.selWire, this.selFaceMesh);
    this.points.geometry.dispose(); this.wire.geometry.dispose();
    this._buildOverlays();
  }
  _currentTris() { return this.faces.map(f => f.v.slice()); }
  _vertPositions() { return this.verts.map(v => v.p.clone()); }

  // EXTRUDE selected faces along their averaged normal; new verts are duplicated,
  // side walls added, selection moves to the new cap.
  extrudeFaces(dist) {
    const sf = this._selectedFaces(); if (!sf.length) return 0;
    this._pushUndo();
    const vpos = this._vertPositions();
    const tris = this._currentTris();
    // normal of selection
    const nrm = V(0, 0, 0); const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
    sf.forEach(fi => { const v = this.faces[fi].v; tmpA.subVectors(vpos[v[1]], vpos[v[0]]); tmpB.subVectors(vpos[v[2]], vpos[v[0]]); nrm.add(tmpA.cross(tmpB).normalize()); });
    nrm.normalize().multiplyScalar((dist == null ? 0.08 : dist));
    // which verts belong to the extruded region
    const selVerts = new Set(); sf.forEach(fi => this.faces[fi].v.forEach(vi => selVerts.add(vi)));
    // duplicate them (raised)
    const dup = new Map();
    selVerts.forEach(vi => { const ni = vpos.length; vpos.push(vpos[vi].clone().add(nrm)); dup.set(vi, ni); });
    const sfSet = new Set(sf);
    const newTris = [];
    // re-point selected faces to the duplicated (cap) verts
    for (let fi = 0; fi < tris.length; fi++) {
      if (sfSet.has(fi)) newTris.push(tris[fi].map(vi => dup.get(vi)));
      else newTris.push(tris[fi]);
    }
    // side walls on boundary edges of the selection (edges used by exactly one selected face)
    const edgeCount = new Map();
    const ek = (a, b) => a < b ? a + '|' + b : b + '|' + a;
    sf.forEach(fi => { const v = this.faces[fi].v; for (let k = 0; k < 3; k++) { const a = v[k], b = v[(k + 1) % 3]; const key = ek(a, b); edgeCount.set(key, (edgeCount.get(key) || 0) + 1); } });
    sf.forEach(fi => {
      const v = this.faces[fi].v;
      for (let k = 0; k < 3; k++) {
        const a = v[k], b = v[(k + 1) % 3];
        if (edgeCount.get(ek(a, b)) === 1) { // boundary edge → wall quad (2 tris)
          const a2 = dup.get(a), b2 = dup.get(b);
          newTris.push([a, b, b2]); newTris.push([a, b2, a2]);
        }
      }
    });
    this._rebuildFromTris(newTris, vpos);
    // reselect the cap
    this.sel = new Set([...dup.values()]);
    this._refreshOverlays(); this.engine._changed();
    return sf.length;
  }

  // SUBDIVIDE selected faces (1→4 via midpoints). If nothing selected, subdivide all.
  subdivide() {
    this._pushUndo();
    const vpos = this._vertPositions();
    const tris = this._currentTris();
    let target = new Set(this._selectedFaces());
    if (!target.size) for (let i = 0; i < tris.length; i++) target.add(i);
    const midCache = new Map();
    const mid = (a, b) => { const k = a < b ? a + '|' + b : b + '|' + a; let m = midCache.get(k); if (m == null) { m = vpos.length; vpos.push(vpos[a].clone().add(vpos[b]).multiplyScalar(0.5)); midCache.set(k, m); } return m; };
    const out = [];
    for (let fi = 0; fi < tris.length; fi++) {
      const [a, b, c] = tris[fi];
      if (!target.has(fi)) { out.push([a, b, c]); continue; }
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      out.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
    }
    this._rebuildFromTris(out, vpos);
    this.sel.clear(); this._refreshOverlays(); this.engine._changed();
    return out.length;
  }

  // DELETE — remove faces touching the selection (Blender's "Delete Faces").
  deleteSelection() {
    const selV = this.sel; if (!selV.size) return 0;
    this._pushUndo();
    const vpos = this._vertPositions();
    const tris = this._currentTris();
    let removeFaces;
    if (this.selMode === 'vert') removeFaces = fi => this.faces[fi].v.some(vi => selV.has(vi));
    else if (this.selMode === 'edge') removeFaces = fi => { const v = this.faces[fi].v; let c = 0; for (const x of v) if (selV.has(x)) c++; return c >= 2; };
    else removeFaces = fi => this.faces[fi].v.every(vi => selV.has(vi));
    const kept = []; let removed = 0;
    for (let fi = 0; fi < tris.length; fi++) { if (removeFaces(fi)) removed++; else kept.push(tris[fi]); }
    if (!kept.length) { this.engine._removeElement(this.el); return -1; } // whole thing gone → signal caller
    this._rebuildFromTris(kept, vpos);
    this.sel.clear(); this._refreshOverlays(); this.engine._changed();
    return removed;
  }

  // MERGE selected verts to their center (Blender "Merge → At Center").
  mergeAtCenter() {
    if (this.sel.size < 2) return 0;
    this._pushUndo();
    const c = this._pivot();
    this.sel.forEach(vi => this.verts[vi].p.copy(c));
    this._applyToMesh();
    // rebuild to collapse the now-coincident verts & drop degenerate tris
    const vpos = this._vertPositions();
    const tris = this._currentTris().filter(t => { const [a, b, c2] = t; return !(vpos[a].distanceToSquared(vpos[b]) < 1e-10 || vpos[b].distanceToSquared(vpos[c2]) < 1e-10 || vpos[c2].distanceToSquared(vpos[a]) < 1e-10); });
    this._rebuildFromTris(tris, vpos);
    this.sel.clear(); this._refreshOverlays(); this.engine._changed();
    return 1;
  }

  // ---------------------------------------------------------- UNDO (session-local)
  _pushUndo() {
    const pos = this.mesh.geometry.attributes.position;
    this._undo.push(new Float32Array(pos.array));
    if (this._undo.length > 30) this._undo.shift();
  }
  undo() {
    if (!this._undo.length) return false;
    const buf = this._undo.pop();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buf.slice(), 3));
    g.computeVertexNormals(); g.computeBoundingBox();
    this.mesh.geometry.dispose(); this.mesh.geometry = g;
    this.el.faceCount = buf.length / 9; this.el._adj = null;
    this._build();
    this.group.remove(this.points, this.wire, this.selWire, this.selFaceMesh);
    this._buildOverlays();
    this.sel.clear(); this._refreshOverlays(); this.engine._changed();
    return true;
  }

  // ---------------------------------------------------------- TEARDOWN
  destroy() {
    if (this.transform) this.cancelTransform();
    this.engine.controls.enableRotate = true;
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.engine.root.remove(this.group);
  }
}

// ---- helpers ----
function axisVec(a) { return a === 'x' ? V(1, 0, 0) : a === 'y' ? V(0, 1, 0) : V(0, 0, 1); }
function scaleVec(a, f) { return a === 'x' ? V(f, 1, 1) : a === 'y' ? V(1, f, 1) : V(1, 1, f); }
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy; return (px - cx) ** 2 + (py - cy) ** 2;
}

export default EditSession;
