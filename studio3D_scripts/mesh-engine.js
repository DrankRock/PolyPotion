// ============================================================
// MESHEDIT — ENGINE  (MEEngine)
// Loads a REAL imported model (GLB / FBX / OBJ), bakes it into editable
// geometry, and splits it into its actual pieces: every authored sub-mesh
// AND every disconnected island within a mesh becomes a selectable element.
// Tools operate on the real triangles:
//   • click-select whole elements; explode / separate / move / reattach
//   • PAINT faces (brush grows along the mesh's own edges) -> separate or delete
//   • PLANE CUT an element along a loop -> two elements (real geometry split)
//   • CLOTH-ify a selected element into a live on-device Verlet sim
// Loaded by dynamic import from MeshEdit.dc.html, same as mc-engine.js.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { applyOrbitScheme } from './nav-scheme.js';
import { fetchAssetBuffer } from './chunk-loader.js';
import { voxelRemesh } from './remesh.js';
import { EditSession } from './edit-session.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const COL = {
  base: 0x9aa3ad, sel: 0xe08534, hov: 0x4d82d6, face: 0xe08534, cut: 0x43b6c4, newE: 0x43b6c4,
};
const PALETTE = [0x8a929c, 0x7f8a99, 0x96887e, 0x808d83, 0x8d8194, 0x7e8d96, 0x948a80, 0x86918a];

export class MEEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})());
    window.addEventListener("studiothemechange", () => { try { this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})()); } catch(e){} });
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 100);
    this.camera.position.set(1.6, 1.2, 3.0);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.9, 0);
    this.controls.minDistance = 0.3; this.controls.maxDistance = 14;

    const hemi = new THREE.HemisphereLight(0xdfe7f2, 0x23262c, 1.0); this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(2.6, 4.2, 3.0);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 16;
    key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0009; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x7f9ad6, 0.55); rim.position.set(-3, 2.4, -2.2); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.helpers = new THREE.Group(); this.scene.add(this.helpers);

    // editable state
    this.elements = [];           // {id,label,mesh,home,offset,baseColor,detached,source,faceCount,_cloth}
    this.byId = new Map();
    this.selected = new Set();     // element ids (object mode)
    this.selFaces = new Map();     // elemId -> Set(faceIdx)  (paint mode)
    this.hovered = null;
    this.mode = 'select';          // select | paint | cut
    this.explodeAmt = 0; this.xray = false;
    this.brush = 2;                // paint brush rings
    this.cut = null;
    this.edit = null;              // active EditSession (verts mode)
    this.onEdit = null;            // UI callback for edit-mode stats
    this.cloths = [];
    this.modelName = '';
    this.onSelect = null; this.onChange = null; this.onCut = null; this.onStatus = null;

    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();
    this._ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2();
    this._overlay = null;          // selected-face highlight mesh
    this._painting = false;

    this._bindPointer();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._clock = new THREE.Clock(); this._run = true;
    this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
  }

  _status(msg) { if (this.onStatus) this.onStatus(msg); }

  // ---------------------------------------------------------- LOADING
  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts);
    return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop());
  }
  async loadFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const buf = await file.arrayBuffer();
    return this._ingest(buf, ext, file.name);
  }
  async loadBuffer(buf, name, ext) {
    return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name);
  }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || ext) + '…');
    let obj;
    if (ext === 'fbx') obj = this._fbx.parse(buf, '');
    else if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); obj = g.scene || (g.scenes && g.scenes[0]); }
    else if (ext === 'obj') obj = this._obj.parse(new TextDecoder().decode(buf));
    else throw new Error('Unsupported .' + ext);

    obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
    obj.updateMatrixWorld(true);

    // collect source meshes with world matrices
    const srcs = [];
    obj.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry) srcs.push(o); });
    if (!srcs.length) throw new Error('No mesh found in file');

    this._clear();
    this.modelName = (name || 'model').replace(/\.(glb|gltf|fbx|obj)$/i, '');

    // 1. bake every source mesh into world-space geometry (handles skinned meshes,
    //    nested armatures, arbitrary node transforms — we read each mesh's own matrixWorld)
    const baked = [];
    for (const m of srcs) {
      let g = m.geometry; if (g.index) g = g.toNonIndexed(); g = g.clone();
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', g.attributes.position.clone());  // position only -> clean weld/split
      pg.applyMatrix4(m.matrixWorld);
      pg.computeBoundingBox();
      baked.push({ g: pg, name: (m.name || 'mesh').replace(/[_:]/g, ' ').trim() || 'mesh', src: m.name || 'mesh' });
    }
    // 2. normalize the BAKED geometry to ~1.8 tall, centered, feet on floor
    const gbox = new THREE.Box3();
    baked.forEach(b => gbox.union(b.g.boundingBox));
    const size = gbox.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1);
    const cx = (gbox.min.x + gbox.max.x) / 2, cz = (gbox.min.z + gbox.max.z) / 2, minY = gbox.min.y;
    const normM = new THREE.Matrix4().makeTranslation(-cx * s, -minY * s, -cz * s)
      .multiply(new THREE.Matrix4().makeScale(s, s, s));

    // 3. split each baked mesh into connected islands -> elements
    let totalTris = 0, ci = 0;
    this._status('Splitting into elements…');
    for (const b of baked) {
      b.g.applyMatrix4(normM);
      const pos = b.g.attributes.position;
      const islands = splitIslands(pos);
      islands.forEach((faces, k) => {
        const sub = buildFromFaces(pos, faces);
        const label = islands.length > 1 ? b.name + ' · ' + (k + 1) : b.name;
        this._addElement(sub, label, PALETTE[ci % PALETTE.length], b.src);
        ci++; totalTris += faces.length;
      });
      b.g.dispose();
    }

    this._frame();
    this._rebuildOverlay();
    this._emitSelect(); this._changed();
    this._status('');
    return { name: this.modelName, elements: this.elements.length, tris: totalTris };
  }

  _addElement(geo, label, color, source) {
    geo.computeVertexNormals(); geo.computeBoundingBox();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.74, metalness: 0.04, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    const id = 'e' + (this._eid = (this._eid || 0) + 1);
    mesh.userData.elemId = id;
    const center = geo.boundingBox.getCenter(new THREE.Vector3());
    const el = {
      id, label, mesh, baseColor: color, source,
      home: V(0, 0, 0), offset: V(0, 0, 0), center,
      explodeDir: center.clone().sub(V(0, 0.9, 0)).normalize(),
      detached: false, faceCount: geo.attributes.position.count / 3,
    };
    this.elements.push(el); this.byId.set(id, el); this.root.add(mesh);
    return el;
  }

  _frame() {
    const box = new THREE.Box3();
    this.elements.forEach(e => box.expandByObject(e.mesh));
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    this.controls.target.copy(c);
    const d = Math.max(sz.x, sz.y) * 1.9;
    this.camera.position.set(c.x + d * 0.25, c.y + sz.y * 0.1, c.z + d);
    this.controls.update();
  }

  // ---------------------------------------------------------- TREE
  getTree() {
    const groups = {};
    for (const e of this.elements) {
      const g = e._cloth ? 'Cloth' : (e.detached ? 'Separated' : (e.source || 'Mesh'));
      (groups[g] = groups[g] || []).push({ id: e.id, label: e.label, detached: e.detached, isCloth: !!e._cloth, tris: e.faceCount });
    }
    const order = [...Object.keys(groups).filter(g => g !== 'Separated' && g !== 'Cloth'), 'Separated', 'Cloth'];
    return order.filter(g => groups[g]).map(g => ({ group: g, parts: groups[g] }));
  }
  partInfo(id) {
    const e = this.byId.get(id); if (!e) return null;
    return { id: e.id, label: e.label, tris: Math.round(e.faceCount), detached: e.detached, isCloth: !!e._cloth };
  }
  stats() {
    let tris = 0; this.elements.forEach(e => tris += e.faceCount);
    let selFaces = 0; this.selFaces.forEach(set => selFaces += set.size);
    return { elements: this.elements.length, tris: Math.round(tris), name: this.modelName, selFaces };
  }
  hasModel() { return this.elements.length > 0; }

  // ---------------------------------------------------------- COLORS / HIGHLIGHT
  _applyColors() {
    for (const e of this.elements) {
      const m = e.mesh.material;
      const seld = this.selected.has(e.id), hov = this.hovered === e.id;
      m.emissive.setHex(seld ? COL.sel : (hov ? COL.hov : 0x000000));
      m.emissiveIntensity = seld ? 0.5 : (hov ? 0.25 : 0);
      m.color.setHex(e._cloth ? 0xb06a4f : e.baseColor);
      m.transparent = this.xray; m.opacity = this.xray ? (seld ? 0.85 : 0.3) : 1; m.depthWrite = !this.xray;
    }
  }

  _rebuildOverlay() {
    if (this._overlay) { this.helpers.remove(this._overlay); this._overlay.geometry.dispose(); this._overlay = null; }
    const arr = [];
    this.selFaces.forEach((set, eid) => {
      const e = this.byId.get(eid); if (!e) return;
      const pos = e.mesh.geometry.attributes.position;
      const off = e.mesh.position;
      set.forEach(f => {
        for (let k = 0; k < 3; k++) {
          const i = f * 3 + k;
          arr.push(pos.getX(i) + off.x, pos.getY(i) + off.y, pos.getZ(i) + off.z);
        }
      });
    });
    if (!arr.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    const mat = new THREE.MeshBasicMaterial({ color: COL.face, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthTest: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this._overlay = new THREE.Mesh(g, mat); this.helpers.add(this._overlay);
  }

  // ---------------------------------------------------------- SELECTION (object)
  select(ids, additive) {
    if (!additive) this.selected.clear();
    (Array.isArray(ids) ? ids : [ids]).forEach(id => {
      if (!id) return;
      if (additive && this.selected.has(id)) this.selected.delete(id); else this.selected.add(id);
    });
    this._applyColors(); this._emitSelect();
  }
  clearSelection() { this.selected.clear(); this._applyColors(); this._emitSelect(); }
  selectAll() { this.select(this.elements.map(e => e.id), false); }
  _emitSelect() { if (this.onSelect) this.onSelect([...this.selected].map(id => this.partInfo(id)).filter(Boolean)); }

  // ---------------------------------------------------------- POINTER
  _bindPointer() {
    const c = this.canvas;
    const rectXY = e => { const r = c.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const toNdc = e => { const r = c.getBoundingClientRect(); this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    c.addEventListener('pointermove', e => {
      const xy = rectXY(e); this._lastPx = xy.x; this._lastPy = xy.y;
      toNdc(e);
      if (this.mode === 'verts' && this.edit) {
        if (this._modalActive) { this.edit.updateTransform(xy.x, xy.y); return; }
        if (this._boxSel) { this._boxSel.x1 = xy.x; this._boxSel.y1 = xy.y; this._drawBox(); return; }
        return;
      }
      if (this.mode === 'move' && this._moveDrag) { this._doMove(); return; }
      if (this.mode === 'paint' && this._painting) { this._paintAt(); return; }
      const hit = this._pick();
      const id = hit ? hit.object.userData.elemId : null;
      if (id !== this.hovered) { this.hovered = id; this._applyColors(); c.style.cursor = id ? (this.mode === 'paint' ? 'crosshair' : (this.mode === 'move' ? 'move' : 'pointer')) : 'default'; }
    });
    let down = null;
    c.addEventListener('pointerdown', e => {
      down = [e.clientX, e.clientY];
      const xy = rectXY(e);
      if (this.mode === 'verts' && this.edit) {
        if (this._modalActive) { if (e.button === 2) this.edit.cancelTransform(); else this.edit.commitTransform(); this._modalActive = false; e.preventDefault(); return; }
        if (e.button === 0) { this._boxSel = { x0: xy.x, y0: xy.y, x1: xy.x, y1: xy.y, add: e.shiftKey }; this.controls.enableRotate = false; }
        return;
      }
      if (this.mode === 'paint') { toNdc(e); const hit = this._pick(); if (hit) { this._painting = true; this.controls.enableRotate = false; this._paintAt(e.altKey); } }
      else if (this.mode === 'move') { toNdc(e); const hit = this._pick(); if (hit) { const id = hit.object.userData.elemId; if (!this.selected.has(id)) this.select(id, e.shiftKey || e.metaKey || e.ctrlKey); this._beginMove(hit.point); e.preventDefault(); } }
    });
    window.addEventListener('pointerup', e => {
      if (this.mode === 'verts' && this.edit && this._boxSel) {
        const b = this._boxSel; this._boxSel = null; this._clearBox(); this.controls.enableRotate = true;
        const dx = Math.abs(b.x1 - b.x0), dy = Math.abs(b.y1 - b.y0);
        if (dx > 4 || dy > 4) this.edit.boxSelect(b.x0, b.y0, b.x1, b.y1, b.add);
        else this.edit.pick(b.x0, b.y0, b.add || e.shiftKey);
        down = null; return;
      }
      if (this._moveDrag) { this._endMove(); down = null; return; }
      if (this._painting) { this._painting = false; this.controls.enableRotate = true; this._changed(); }
      if (!down) return;
      const moved = Math.hypot(e.clientX - down[0], e.clientY - down[1]); down = null;
      if (moved > 4) return;
      toNdc(e); const hit = this._pick();
      if (this.mode === 'cut') { if (hit) this.beginCut(hit.object.userData.elemId); return; }
      if (this.mode === 'paint') return;
      if (hit) this.select(hit.object.userData.elemId, e.shiftKey || e.metaKey || e.ctrlKey);
      else if (!e.shiftKey) this.clearSelection();
    });
    c.addEventListener('contextmenu', e => { if (this.mode === 'verts') e.preventDefault(); });
    this._installEditKeys();
  }
  _installEditKeys() {
    const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    this._editKeyHandler = (e) => {
      if (this.mode !== 'verts' || !this.edit || typing(e.target)) return;
      const k = e.key.toLowerCase();
      if (this._modalActive) {
        if (k === 'x' || k === 'y' || k === 'z') { this.edit.setAxis(k); e.preventDefault(); return; }
        if (e.key === 'Enter') { this.edit.commitTransform(); this._modalActive = false; e.preventDefault(); return; }
        if (e.key === 'Escape') { this.edit.cancelTransform(); this._modalActive = false; e.preventDefault(); return; }
        return;
      }
      if (k === 'g') { this._modalActive = this.edit.beginTransform('grab', this._lastPx, this._lastPy); e.preventDefault(); }
      else if (k === 'r') { this._modalActive = this.edit.beginTransform('rotate', this._lastPx, this._lastPy); e.preventDefault(); }
      else if (k === 's') { this._modalActive = this.edit.beginTransform('scale', this._lastPx, this._lastPy); e.preventDefault(); }
      else if (k === 'e') { this.edit.extrudeFaces(); e.preventDefault(); }
      else if (k === 'a') { this.edit.selectAll(); e.preventDefault(); }
      else if (e.key === 'Delete') { this.editDelete(); e.preventDefault(); }
      else if (k === '1') { this.edit.setSelMode('vert'); this._emitEdit(this.edit.stats()); e.preventDefault(); }
      else if (k === '2') { this.edit.setSelMode('edge'); this._emitEdit(this.edit.stats()); e.preventDefault(); }
      else if (k === '3') { this.edit.setSelMode('face'); this._emitEdit(this.edit.stats()); e.preventDefault(); }
      else if ((e.ctrlKey || e.metaKey) && k === 'z') { this.edit.undo(); e.preventDefault(); }
    };
    window.addEventListener('keydown', this._editKeyHandler);
  }
  _drawBox() {
    const b = this._boxSel; if (!b) return;
    let d = this._boxEl;
    if (!d) { d = this._boxEl = document.createElement('div'); d.style.cssText = 'position:absolute;border:1px solid #ff7a2f;background:rgba(255,122,47,.12);pointer-events:none;z-index:20;'; (this.canvas.parentElement || document.body).appendChild(d); }
    const x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1), w = Math.abs(b.x1 - b.x0), h = Math.abs(b.y1 - b.y0);
    d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.width = w + 'px'; d.style.height = h + 'px'; d.style.display = 'block';
  }
  _clearBox() { if (this._boxEl) this._boxEl.style.display = 'none'; }
  _pick() {
    this._ray.setFromCamera(this._ndc, this.camera);
    const hits = this._ray.intersectObjects(this.elements.map(e => e.mesh), false);
    return hits.length ? hits[0] : null;
  }

  // ---------------------------------------------------------- PAINT (face select)
  setBrush(n) { this.brush = Math.max(0, Math.min(6, n | 0)); }
  _paintAt(erase) {
    const hit = this._pick(); if (!hit) return;
    const e = this.byId.get(hit.object.userData.elemId); if (!e) return;
    const f0 = hit.faceIndex;
    if (f0 == null) return;
    // when starting on a new element, keep selection scoped to faces; allow multi-element
    const set = this.selFaces.get(e.id) || new Set();
    const adj = this._adjacency(e);
    // BFS grow from f0 by brush rings
    let frontier = new Set([f0]); const touched = new Set([f0]);
    for (let r = 0; r < this.brush; r++) {
      const next = new Set();
      frontier.forEach(f => (adj[f] || []).forEach(nf => { if (!touched.has(nf)) { touched.add(nf); next.add(nf); } }));
      frontier = next;
    }
    touched.forEach(f => { if (erase) set.delete(f); else set.add(f); });
    if (set.size) this.selFaces.set(e.id, set); else this.selFaces.delete(e.id);
    this._rebuildOverlay();
    if (this.onSelect) this.onSelect([...this.selected].map(id => this.partInfo(id)).filter(Boolean));
  }
  // face adjacency via shared welded edges (cached per element geometry)
  _adjacency(e) {
    if (e._adj && e._adjFor === e.mesh.geometry) return e._adj;
    const pos = e.mesh.geometry.attributes.position;
    const n = pos.count / 3;
    const q = v => Math.round(v * 2000);
    const vid = i => q(pos.getX(i)) + ',' + q(pos.getY(i)) + ',' + q(pos.getZ(i));
    const edgeMap = new Map();
    const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
    const ids = new Array(n * 3);
    for (let f = 0; f < n; f++) for (let k = 0; k < 3; k++) ids[f * 3 + k] = vid(f * 3 + k);
    for (let f = 0; f < n; f++) {
      for (let k = 0; k < 3; k++) {
        const ek = key(ids[f * 3 + k], ids[f * 3 + (k + 1) % 3]);
        (edgeMap.get(ek) || edgeMap.set(ek, []).get(ek)).push(f);
      }
    }
    const adj = new Array(n);
    edgeMap.forEach(faces => {
      for (let a = 0; a < faces.length; a++) for (let b = a + 1; b < faces.length; b++) {
        (adj[faces[a]] || (adj[faces[a]] = [])).push(faces[b]);
        (adj[faces[b]] || (adj[faces[b]] = [])).push(faces[a]);
      }
    });
    e._adj = adj; e._adjFor = e.mesh.geometry; return adj;
  }
  growFaces() { this._growShrink(true); }
  shrinkFaces() { this._growShrink(false); }
  _growShrink(grow) {
    this.selFaces.forEach((set, eid) => {
      const e = this.byId.get(eid); if (!e) return;
      const adj = this._adjacency(e);
      if (grow) {
        const add = new Set();
        set.forEach(f => (adj[f] || []).forEach(nf => { if (!set.has(nf)) add.add(nf); }));
        add.forEach(f => set.add(f));
      } else {
        const rem = new Set();
        set.forEach(f => { const nb = adj[f] || []; if (nb.some(nf => !set.has(nf))) rem.add(f); });
        rem.forEach(f => set.delete(f));
        if (!set.size) this.selFaces.delete(eid);
      }
    });
    this._rebuildOverlay();
  }
  clearFaces() { this.selFaces.clear(); this._rebuildOverlay(); }
  faceCount() { let n = 0; this.selFaces.forEach(s => n += s.size); return n; }

  // extract painted faces into a new element (and remove from source)
  separateFaces() {
    let made = 0;
    const entries = [...this.selFaces.entries()];
    for (const [eid, set] of entries) {
      const e = this.byId.get(eid); if (!e || !set.size) continue;
      const pos = e.mesh.geometry.attributes.position;
      const total = pos.count / 3;
      if (set.size >= total) { // whole element -> just detach
        e.detached = true; e.offset.add(e.explodeDir.clone().multiplyScalar(0.1)); made++; continue;
      }
      const keep = [], take = [];
      for (let f = 0; f < total; f++) (set.has(f) ? take : keep).push(f);
      const takeGeo = buildFromFaces(pos, take);
      const keepGeo = buildFromFaces(pos, keep);
      // shift element geometry to keep
      this._replaceGeo(e, keepGeo);
      const ctr = takeGeo.boundingBox ? takeGeo.boundingBox.getCenter(new THREE.Vector3()) : (takeGeo.computeBoundingBox(), takeGeo.boundingBox.getCenter(new THREE.Vector3()));
      const ne = this._addElement(takeGeo, e.label + ' · piece', COL.newE, 'Separated');
      ne.detached = true;
      ne.explodeDir.copy(ctr.clone().sub(V(0, 0.9, 0)).normalize());
      ne.offset.copy(ne.explodeDir.clone().multiplyScalar(0.12));
      made++;
    }
    this.selFaces.clear(); this._rebuildOverlay();
    this._applyColors(); this._changed();
    return made;
  }
  deleteFaces() {
    let removed = 0;
    const entries = [...this.selFaces.entries()];
    for (const [eid, set] of entries) {
      const e = this.byId.get(eid); if (!e || !set.size) continue;
      const pos = e.mesh.geometry.attributes.position; const total = pos.count / 3;
      const keep = []; for (let f = 0; f < total; f++) if (!set.has(f)) keep.push(f);
      removed += set.size;
      if (!keep.length) { this._removeElement(e); continue; }
      this._replaceGeo(e, buildFromFaces(pos, keep));
    }
    this.selFaces.clear(); this._rebuildOverlay(); this._changed();
    return removed;
  }
  _replaceGeo(e, geo) {
    geo.computeVertexNormals(); geo.computeBoundingBox();
    e.mesh.geometry.dispose(); e.mesh.geometry = geo;
    e.faceCount = geo.attributes.position.count / 3;
    e.center = geo.boundingBox.getCenter(new THREE.Vector3());
    e._adj = null;
  }

  // ---------------------------------------------------------- OBJECT OPS
  setExplode(v) { this.explodeAmt = v; }
  setXray(on) { this.xray = on; this._applyColors(); }
  separateSelected() {
    let n = 0;
    for (const id of this.selected) { const e = this.byId.get(id); if (!e || e.detached) continue; e.detached = true; e.offset.add(e.explodeDir.clone().multiplyScalar(0.12)); n++; }
    this._applyColors(); this._changed(); return n;
  }
  reattachSelected() {
    for (const id of this.selected) { const e = this.byId.get(id); if (!e) continue; e.detached = false; e.offset.set(0, 0, 0); }
    this._applyColors(); this._changed();
  }
  // ---------------------------------------------------------- FREE MOVE (drag) + ROTATE + MERGE
  _beginMove(point) {
    const planeN = this.camera.getWorldDirection(new THREE.Vector3());
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeN, point);
    const offs = new Map();
    this.selected.forEach(id => { const e = this.byId.get(id); if (e) offs.set(id, e.offset.clone()); });
    this._moveDrag = { plane, start: point.clone(), offs };
    this.controls.enableRotate = false;
  }
  _doMove() {
    const mv = this._moveDrag; if (!mv) return;
    this._ray.setFromCamera(this._ndc, this.camera);
    const hp = new THREE.Vector3();
    if (!this._ray.ray.intersectPlane(mv.plane, hp)) return;
    const d = hp.sub(mv.start);
    mv.offs.forEach((o, id) => {
      const e = this.byId.get(id); if (!e) return;
      e.offset.copy(o).add(d); e.detached = true;
      e.mesh.position.copy(e.explodeDir.clone().multiplyScalar(this.explodeAmt * 0.55).add(e.offset));
    });
  }
  _endMove() { if (this._moveDrag) { this._moveDrag = null; this.controls.enableRotate = true; this._changed(); } }

  // rotate every selected piece about its own centroid (baked into geometry)
  rotateSelected(axis, deg) {
    const rad = deg * Math.PI / 180;
    const ax = axis === 'x' ? V(1, 0, 0) : axis === 'y' ? V(0, 1, 0) : V(0, 0, 1);
    let n = 0;
    for (const id of this.selected) {
      const e = this.byId.get(id); if (!e || e._cloth) continue;
      const c = e.center;
      const m = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z)
        .multiply(new THREE.Matrix4().makeRotationAxis(ax, rad))
        .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
      e.mesh.geometry.applyMatrix4(m);
      e.mesh.geometry.computeVertexNormals(); e.mesh.geometry.computeBoundingBox();
      e._adj = null; if (!e.detached) e.detached = true; n++;
    }
    if (n) this._changed();
    return n;
  }

  // weld the selected elements back into ONE editable object: bake each
  // piece's current world transform, then concatenate all their triangles.
  mergeSelected() {
    const els = [...this.selected].map(id => this.byId.get(id)).filter(e => e && !e._cloth);
    if (els.length < 2) return 0;
    const arr = [];
    const v = new THREE.Vector3();
    for (const e of els) {
      e.mesh.updateMatrix();
      const m = e.mesh.matrix;
      const pos = e.mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(m); arr.push(v.x, v.y, v.z); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo.computeVertexNormals(); geo.computeBoundingBox();
    let big = els[0]; for (const e of els) if (e.faceCount > big.faceCount) big = e;
    const label = (els.length === this.elements.length) ? (this.modelName || big.label) : big.label;
    const ne = this._addElement(geo, label, big.baseColor, big.source || 'Mesh');
    ne.detached = false; ne.offset.set(0, 0, 0);
    els.forEach(e => this._removeElement(e));
    this.selected.clear(); this.select(ne.id, false);
    this._changed();
    return els.length;
  }
  mergeAll() { this.selectAll(); return this.mergeSelected(); }

  // ---------------------------------------------------------- VOXEL REMESH (fuse)
  _addRemeshed(position, normal, label, color, source) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
    geo.computeBoundingBox();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.04, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    const id = 'e' + (this._eid = (this._eid || 0) + 1); mesh.userData.elemId = id;
    const center = geo.boundingBox.getCenter(new THREE.Vector3());
    const el = { id, label, mesh, baseColor: color, source, home: V(0, 0, 0), offset: V(0, 0, 0), center,
      explodeDir: center.clone().sub(V(0, 0.9, 0)).normalize(), detached: false, faceCount: position.length / 9 };
    this.elements.push(el); this.byId.set(id, el); this.root.add(mesh);
    return el;
  }
  async remeshElements(opts) {
    opts = opts || {};
    const useSel = opts.selectedOnly && this.selected.size > 0;
    const els = (useSel ? [...this.selected].map(id => this.byId.get(id)) : this.elements.slice()).filter(e => e && !e._cloth);
    if (!els.length) return null;
    let total = 0; els.forEach(e => total += e.mesh.geometry.attributes.position.count);
    const pos = new Float32Array(total * 3); let w = 0; const v = new THREE.Vector3();
    for (const e of els) {
      e.mesh.updateMatrix(); const m = e.mesh.matrix; const p = e.mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(m); pos[w++] = v.x; pos[w++] = v.y; pos[w++] = v.z; }
    }
    this._status('Remeshing…');
    await new Promise(r => setTimeout(r, 20));
    const out = voxelRemesh(pos, { res: opts.res || 96, smooth: opts.smooth == null ? 3 : opts.smooth, onStatus: m => this._status(m) });
    if (!out || out.tooBig) { this._status(''); return out && out.tooBig ? { tooBig: true } : null; }
    let big = els[0]; for (const e of els) if (e.faceCount > big.faceCount) big = e;
    const base = (els.length === this.elements.length) ? (this.modelName || big.label) : big.label;
    els.forEach(e => this._removeElement(e));
    const ne = this._addRemeshed(out.position, out.normal, base + ' · remesh', big.baseColor, 'Mesh');
    this.selected.clear(); this.select(ne.id, false);
    this._status(''); this._changed();
    return out.stats;
  }

  nudgeSelected(axis, d) {
    for (const id of this.selected) { const e = this.byId.get(id); if (!e) continue; e.offset[axis] += d; if (!e.detached) e.detached = true; }
    this._changed();
  }
  deleteSelected() {
    let n = 0; for (const id of [...this.selected]) { const e = this.byId.get(id); if (e) { this._removeElement(e); n++; } }
    this._emitSelect(); this._changed(); return n;
  }
  _removeElement(e) {
    this.root.remove(e.mesh); e.mesh.geometry.dispose();
    this.elements = this.elements.filter(x => x !== e); this.byId.delete(e.id);
    this.selected.delete(e.id); this.selFaces.delete(e.id);
    if (e._cloth) this.cloths = this.cloths.filter(c => c.el !== e);
  }

  // ---------------------------------------------------------- PLANE CUT
  setMode(m) {
    if (this.mode === 'verts' && m !== 'verts') this._exitEdit();
    this.mode = m;
    if (m !== 'cut') this.cancelCut();
    if (m !== 'move') { this._moveDrag = null; this.controls.enableRotate = true; }
    if (m === 'verts') this._enterEdit();
    this.canvas.style.cursor = m === 'cut' ? 'crosshair' : 'default';
  }

  // ---------------------------------------------------------- EDIT MODE (verts)
  _enterEdit() {
    // edit the single selected element (or the biggest, so there's always a target)
    let el = [...this.selected].map(id => this.byId.get(id)).find(e => e && !e._cloth);
    if (!el) { let big = null; for (const e of this.elements) if (!e._cloth && (!big || e.faceCount > big.faceCount)) big = e; el = big; }
    if (!el) { this._emitEdit(null); return; }
    this.selected.clear(); this.selected.add(el.id); this._applyColors();
    // dim the other elements so the edit target reads clearly
    this._editHidden = [];
    for (const e of this.elements) { if (e !== el) { e.mesh.material.transparent = true; e.mesh.material.opacity = 0.12; e.mesh.material.depthWrite = false; this._editHidden.push(e); } }
    el.mesh.material.transparent = false; el.mesh.material.opacity = 1; el.mesh.material.depthWrite = true;
    el.mesh.material.emissive.setHex(0x000000);
    this.edit = new EditSession(this, el);
    this.edit.onChange = (st) => this._emitEdit(st);
    this._emitEdit(this.edit.stats());
  }
  _exitEdit() {
    if (this.edit) { this.edit.destroy(); this.edit = null; }
    if (this._editHidden) { this._editHidden.forEach(e => { e.mesh.material.transparent = this.xray; e.mesh.material.opacity = 1; e.mesh.material.depthWrite = true; }); this._editHidden = null; }
    this._applyColors(); this._emitEdit(null);
  }
  _emitEdit(st) { if (this.onEdit) this.onEdit(st); }
  // thin pass-throughs the UI calls
  editSetSelMode(m) { if (this.edit) this.edit.setSelMode(m); }
  editSelectAll() { if (this.edit) this.edit.selectAll(); }
  editSelectNone() { if (this.edit) this.edit.selectNone(); }
  editInvert() { if (this.edit) this.edit.invert(); }
  editGrow() { if (this.edit) this.edit.grow(); }
  editNudge(axis, amt) { if (this.edit) this.edit.nudge(axis, amt); }
  editRotate(axis, deg) { if (this.edit) this.edit.rotateStep(axis, deg); }
  editScale(f) { if (this.edit) this.edit.scaleStep(f); }
  editExtrude(d) { if (this.edit) this.edit.extrudeFaces(d); }
  editSubdivide() { if (this.edit) this.edit.subdivide(); }
  editDelete() { if (this.edit) { const r = this.edit.deleteSelection(); if (r === -1) { this.edit = null; this.setMode('select'); } } }
  editMerge() { if (this.edit) this.edit.mergeAtCenter(); }
  editUndo() { if (this.edit) this.edit.undo(); }
  editBeginTransform(kind) { if (this.edit) { this._beginModal = kind; this._modalActive = this.edit.beginTransform(kind, this._lastPx, this._lastPy); } }
  beginCut(elemId) {
    this.cancelCut();
    const e = this.byId.get(elemId || [...this.selected][0]); if (!e) return null;
    this.select(e.id, false);
    e.mesh.geometry.computeBoundingBox();
    const bb = e.mesh.geometry.boundingBox.clone();
    const sz = bb.getSize(new THREE.Vector3());
    const axis = sz.y >= sz.x && sz.y >= sz.z ? 'y' : (sz.x >= sz.z ? 'x' : 'z');
    const r = 0.62 * Math.max(sz.x, sz.y, sz.z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, Math.max(0.004, r * 0.04), 8, 48), new THREE.MeshBasicMaterial({ color: COL.cut }));
    this.helpers.add(ring);
    this.cut = { el: e, axis, t: 0.5, ring, bb };
    this._updateCutRing();
    const info = this.partInfo(e.id); if (this.onCut) this.onCut(info); return info;
  }
  setCutAxis(axis) { if (this.cut) { this.cut.axis = axis; this._updateCutRing(); } }
  setCutT(t) { if (this.cut) { this.cut.t = Math.max(0.04, Math.min(0.96, t)); this._updateCutRing(); } }
  _updateCutRing() {
    const c = this.cut; if (!c) return;
    const lo = c.bb.min[c.axis], hi = c.bb.max[c.axis];
    const lp = new THREE.Vector3(); lp[c.axis] = lo + (hi - lo) * c.t;
    const other = { x: ['y', 'z'], y: ['x', 'z'], z: ['x', 'y'] }[c.axis];
    lp[other[0]] = (c.bb.min[other[0]] + c.bb.max[other[0]]) / 2;
    lp[other[1]] = (c.bb.min[other[1]] + c.bb.max[other[1]]) / 2;
    c.ring.position.copy(lp.add(c.el.mesh.position));
    c.ring.quaternion.setFromUnitVectors(V(0, 0, 1), V(c.axis === 'x' ? 1 : 0, c.axis === 'y' ? 1 : 0, c.axis === 'z' ? 1 : 0));
  }
  cancelCut() { if (this.cut) { this.helpers.remove(this.cut.ring); this.cut.ring.geometry.dispose(); this.cut = null; if (this.onCut) this.onCut(null); } }
  applyCut() {
    const c = this.cut; if (!c) return null;
    const e = c.el;
    const lo = c.bb.min[c.axis], hi = c.bb.max[c.axis];
    const planeVal = lo + (hi - lo) * c.t;
    const n = V(c.axis === 'x' ? 1 : 0, c.axis === 'y' ? 1 : 0, c.axis === 'z' ? 1 : 0);
    const { posGeo, negGeo } = splitGeometryByPlane(e.mesh.geometry, n, planeVal);
    if (!posGeo || !negGeo) { this.cancelCut(); return null; }
    const mk = (geo, suffix, dir) => {
      const ne = this._addElement(geo, e.label + ' ' + suffix, dir > 0 ? COL.newE : e.baseColor, 'Separated');
      ne.detached = true; ne.offset.copy(n.clone().multiplyScalar(0.018 * dir)); return ne;
    };
    const a = mk(posGeo, '◤', 1), b = mk(negGeo, '◢', -1);
    this._removeElement(e); this.cancelCut();
    if (this.onCut) this.onCut(null);
    this.select([a.id, b.id], false); this._changed();
    return [a.id, b.id];
  }

  // ---------------------------------------------------------- CLOTH
  convertSelectedToCloth() {
    let made = 0;
    for (const id of [...this.selected]) { const e = this.byId.get(id); if (!e || e._cloth) continue; this._makeCloth(e); made++; }
    this._applyColors(); this._changed(); return made;
  }
  _makeCloth(e) {
    const geo = e.mesh.geometry; // already world-space (+ mesh.position offset)
    const off = e.mesh.position.clone();
    e.mesh.position.set(0, 0, 0); e.offset.set(0, 0, 0); e.detached = true; e._cloth = true;
    e.mesh.material.side = THREE.DoubleSide; e.mesh.material.roughness = 0.95;
    const pos = geo.attributes.position;
    // bake any prior offset into the geometry so sim is in world space
    if (off.lengthSq() > 0) { for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) + off.x, pos.getY(i) + off.y, pos.getZ(i) + off.z); pos.needsUpdate = true; geo.computeBoundingBox(); }
    const n = pos.count;
    const map = new Map(); const particles = []; const corner = new Int32Array(n);
    const q = v => Math.round(v * 1000);
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = q(x) + ',' + q(y) + ',' + q(z);
      let idx = map.get(k);
      if (idx == null) { idx = particles.length; particles.push({ p: V(x, y, z), prev: V(x, y, z), pinned: false }); map.set(k, idx); }
      corner[i] = idx;
    }
    geo.computeBoundingBox();
    const bb = geo.boundingBox, top = bb.max.y, ctrX = (bb.min.x + bb.max.x) / 2, ctrZ = (bb.min.z + bb.max.z) / 2;
    const colR = 0.35 * Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
    particles.forEach(pt => { if (pt.p.y > top - 0.05) pt.pinned = true; });
    const sset = new Set(); const springs = [];
    const add = (a, b) => { if (a === b) return; const k = a < b ? a + '_' + b : b + '_' + a; if (sset.has(k)) return; sset.add(k); springs.push({ a, b, rest: particles[a].p.distanceTo(particles[b].p) }); };
    for (let i = 0; i < n; i += 3) { const a = corner[i], b = corner[i + 1], cc = corner[i + 2]; add(a, b); add(b, cc); add(cc, a); }
    const cloth = { el: e, geo, particles, springs, corner, colY: [bb.min.y, top], colR, colX: ctrX, colZ: ctrZ, floorY: bb.min.y - 0.02, wind: 0.4, gravity: 1.0, stiff: 0.85 };
    e._cloth = cloth; this.cloths.push(cloth);
  }
  setClothParams(o) { for (const c of this.cloths) { if (o.wind != null) c.wind = o.wind; if (o.gravity != null) c.gravity = o.gravity; if (o.stiff != null) c.stiff = o.stiff; } }
  resetCloths() { for (const c of this.cloths) c.particles.forEach(pt => pt.prev.copy(pt.p)); }
  _stepCloth(c) {
    const t = performance.now() / 1000, dt = 0.016;
    const g = -2.6 * c.gravity * dt * dt;
    const gust = 0.6 + 0.4 * Math.sin(t * 0.5);
    const wx = Math.sin(t * 1.6) * 0.0009 * c.wind * 60 * dt, wz = Math.cos(t * 1.1) * 0.0011 * c.wind * 60 * dt;
    for (const pt of c.particles) {
      if (pt.pinned) continue;
      const px = pt.p.x, py = pt.p.y, pz = pt.p.z;
      pt.p.x += (px - pt.prev.x) * 0.98 + wx * gust;
      pt.p.y += (py - pt.prev.y) * 0.98 + g;
      pt.p.z += (pz - pt.prev.z) * 0.98 + wz * gust;
      pt.prev.set(px, py, pz);
    }
    const s = 0.5 + c.stiff * 0.5;
    for (let k = 0; k < 3; k++) {
      for (const sp of c.springs) {
        const a = c.particles[sp.a], b = c.particles[sp.b];
        const dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, dz = b.p.z - a.p.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const diff = ((d - sp.rest) / d) * 0.5 * s;
        const ox = dx * diff, oy = dy * diff, oz = dz * diff;
        if (!a.pinned) { a.p.x += ox; a.p.y += oy; a.p.z += oz; }
        if (!b.pinned) { b.p.x -= ox; b.p.y -= oy; b.p.z -= oz; }
      }
      for (const pt of c.particles) {
        if (pt.pinned) continue;
        if (pt.p.y >= c.colY[0] && pt.p.y <= c.colY[1]) {
          const dx = pt.p.x - c.colX, dz = pt.p.z - c.colZ, rr = Math.sqrt(dx * dx + dz * dz), minR = c.colR + 0.01;
          if (rr < minR && rr > 1e-5) { const f = minR / rr; pt.p.x = c.colX + dx * f; pt.p.z = c.colZ + dz * f; }
        }
        if (pt.p.y < c.floorY) pt.p.y = c.floorY;
      }
    }
    const pos = c.geo.attributes.position;
    for (let i = 0; i < c.corner.length; i++) { const pp = c.particles[c.corner[i]].p; pos.setXYZ(i, pp.x, pp.y, pp.z); }
    pos.needsUpdate = true; c.geo.computeVertexNormals();
  }

  // ---------------------------------------------------------- VIEW
  setView(name) {
    const box = new THREE.Box3(); this.elements.forEach(e => box.expandByObject(e.mesh));
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const d = Math.max(sz.x, sz.y) * 1.9;
    this.controls.target.copy(c);
    const set = (x, y, z) => this.camera.position.set(x, y, z);
    if (name === 'front') set(c.x, c.y, c.z + d);
    else if (name === 'side') set(c.x + d, c.y, c.z);
    else if (name === 'top') set(c.x + 0.001, c.y + d, c.z + 0.001);
    else if (name === 'back') set(c.x, c.y, c.z - d);
    else set(c.x + d * 0.25, c.y + sz.y * 0.1, c.z + d);
    this.controls.update();
  }
  frameSelected() {
    if (!this.selected.size) { this._frame(); return; }
    const box = new THREE.Box3();
    this.selected.forEach(id => { const e = this.byId.get(id); if (e) box.expandByObject(e.mesh); });
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    this.controls.target.copy(c);
    const d = Math.max(sz.x, sz.y, sz.z) * 2.4 + 0.2;
    this.camera.position.set(c.x + d * 0.3, c.y + sz.y * 0.1, c.z + d); this.controls.update();
  }

  _changed() { if (this.onChange) this.onChange(); }
  _clear() {
    if (this.edit) { this.edit.destroy(); this.edit = null; }
    this.elements.forEach(e => { this.root.remove(e.mesh); e.mesh.geometry.dispose(); });
    this.elements = []; this.byId.clear(); this.selected.clear(); this.selFaces.clear();
    this.cloths = []; this._rebuildOverlay();
  }
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return; requestAnimationFrame(this._loop);
    for (const e of this.elements) {
      if (e._cloth) continue;
      const target = e.explodeDir.clone().multiplyScalar(this.explodeAmt * 0.55).add(e.offset);
      e.mesh.position.lerp(target, 0.2);
    }
    if (this.explodeAmt > 0 || this._overlay) this._rebuildOverlay && this._maybeOverlay();
    for (const c of this.cloths) this._stepCloth(c);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  _maybeOverlay() { /* overlay follows mesh.position via rebuild only on demand to save cost */ }
  dispose() { this._run = false; if (this._editKeyHandler) window.removeEventListener('keydown', this._editKeyHandler); try { this._ro.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

// ============================================================
// Geometry helpers
// ============================================================
// connected-component split over welded vertices; returns array of face-index arrays
function splitIslands(pos) {
  const n = pos.count / 3;
  const q = v => Math.round(v * 2000);
  const key = i => q(pos.getX(i)) + ',' + q(pos.getY(i)) + ',' + q(pos.getZ(i));
  const vmap = new Map(); let vc = 0;
  const wv = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) { const k = key(i); let id = vmap.get(k); if (id == null) { id = vc++; vmap.set(k, id); } wv[i] = id; }
  // union-find on welded verts
  const parent = new Int32Array(vc); for (let i = 0; i < vc; i++) parent[i] = i;
  const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
  for (let f = 0; f < n; f++) { const a = wv[f * 3], b = wv[f * 3 + 1], c = wv[f * 3 + 2]; uni(a, b); uni(b, c); }
  const groups = new Map();
  for (let f = 0; f < n; f++) { const r = find(wv[f * 3]); (groups.get(r) || groups.set(r, []).get(r)).push(f); }
  // sort by size desc so first island is the biggest (usually the body)
  return [...groups.values()].sort((a, b) => b.length - a.length);
}

// build a non-indexed BufferGeometry from a subset of triangle indices of pos
function buildFromFaces(pos, faces) {
  const arr = new Float32Array(faces.length * 9);
  for (let t = 0; t < faces.length; t++) {
    const f = faces[t];
    for (let k = 0; k < 3; k++) { const i = f * 3 + k; const o = t * 9 + k * 3; arr[o] = pos.getX(i); arr[o + 1] = pos.getY(i); arr[o + 2] = pos.getZ(i); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals(); g.computeBoundingBox();
  return g;
}

// split geometry by an axis-aligned plane (component along axisVec == planeVal)
function splitGeometryByPlane(geom, axisVec, planeVal) {
  const pos = geom.attributes.position;
  const comp = axisVec.x ? 0 : (axisVec.y ? 1 : 2);
  const A = [], B = [];
  const get = i => new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
  const dist = v => v.getComponent(comp) - planeVal;
  const push = (arr, a, b, c) => { arr.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); };
  const clip = (p0, p1, p2) => {
    const pts = [p0, p1, p2], ds = pts.map(dist), posS = [], negS = [];
    for (let i = 0; i < 3; i++) {
      const cur = pts[i], dc = ds[i], nxt = pts[(i + 1) % 3], dn = ds[(i + 1) % 3];
      if (dc >= 0) posS.push(cur); else negS.push(cur);
      if ((dc >= 0) !== (dn >= 0)) { const tt = dc / (dc - dn); const ip = cur.clone().lerp(nxt, tt); posS.push(ip); negS.push(ip.clone()); }
    }
    for (let i = 1; i < posS.length - 1; i++) push(A, posS[0], posS[i], posS[i + 1]);
    for (let i = 1; i < negS.length - 1; i++) push(B, negS[0], negS[i], negS[i + 1]);
  };
  for (let i = 0; i < pos.count; i += 3) {
    const a = get(i), b = get(i + 1), c = get(i + 2);
    const d0 = dist(a), d1 = dist(b), d2 = dist(c);
    if (d0 >= 0 && d1 >= 0 && d2 >= 0) push(A, a, b, c);
    else if (d0 < 0 && d1 < 0 && d2 < 0) push(B, a, b, c);
    else clip(a, b, c);
  }
  if (!A.length || !B.length) return { posGeo: null, negGeo: null };
  const mk = arr => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals(); g.computeBoundingBox(); return g; };
  return { posGeo: mk(A), negGeo: mk(B) };
}

export default MEEngine;
