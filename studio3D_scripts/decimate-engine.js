// ============================================================
// decimate-engine.js — DECIMATE  (DEEngine)
// Loads a model (GLB/FBX/OBJ), groups it into per-material SURFACES (position
// + UV + the original material/texture), normalizes them into one space, and
// reduces triangle count with UV-aware quadric error-metric edge collapse
// (qem.js) — non-destructively, re-running from the originals each time.
// Textures are preserved: they show in the viewport (toggleable) and survive
// export (GLB embeds them; OBJ is geometry-only). Wireframe overlays topology.
// Loaded by dynamic import from Decimate.dc.html, like the other engines.
// ============================================================
import * as THREE from 'three';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { fetchAssetBuffer } from './chunk-loader.js';
import { decimateMesh } from './qem.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class DEEngine {
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
    this.camera.position.set(1.4, 1.2, 3.0);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.3; this.controls.maxDistance = 14;

    const hemi = new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0); this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.45); key.position.set(2.4, 4.2, 3.0);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 16;
    key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0009; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.5); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe9cf, 0.32); fill.position.set(0.5, 1.0, -3.0); this.scene.add(fill);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);

    this.root = new THREE.Group(); this.scene.add(this.root);

    // per-material surfaces (source of truth); current display state per surface
    this.surfaces = [];        // [{ position, uv, material, origTris }]
    this._cur = [];            // [{ position, normal, uv, tris }]
    this._meshes = [];         // display meshes (one per surface)
    this._wire = null;         // wireframe Group
    this.origTris = 0; this.curTris = 0;
    this.showTex = true;
    this.modelName = ''; this.modelRadius = 1; this.modelCenter = V(0, 0.95, 0);
    this.wire = false;

    this._gray = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.66, metalness: 0.03, side: THREE.DoubleSide, flatShading: false });

    this.onStatus = null; this.onChange = null;
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__deEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return this.surfaces.length > 0; }
  hasTexture() { return this.surfaces.some(s => s.material && (s.material.map || s.material.emissiveMap)); }

  // ---------------------------------------------------------- LOADING
  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts);
    return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop());
  }
  async loadFile(file) { return this._ingest(await file.arrayBuffer(), (file.name.split('.').pop() || '').toLowerCase(), file.name); }
  async loadBuffer(buf, name, ext) { return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name); }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || ext) + '…');
    let obj;
    if (ext === 'fbx') obj = this._fbx.parse(buf, '');
    else if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); obj = g.scene || (g.scenes && g.scenes[0]); }
    else if (ext === 'obj') obj = this._obj.parse(new TextDecoder().decode(buf));
    else throw new Error('Unsupported .' + ext);

    obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
    obj.updateMatrixWorld(true);

    const srcs = [];
    obj.traverse(o => { if ((o.isMesh || o.isSkinnedMesh) && o.geometry) srcs.push(o); });
    if (!srcs.length) throw new Error('No mesh found in file');

    this._status('Baking surfaces…');
    // First pass: global bbox from world-space positions → shared normalization.
    const gbox = new THREE.Box3();
    for (const m of srcs) { const g = m.geometry.clone(); g.applyMatrix4(m.matrixWorld); g.computeBoundingBox(); if (g.boundingBox) gbox.union(g.boundingBox); g.dispose(); }
    const size = gbox.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1);
    const cx = (gbox.min.x + gbox.max.x) / 2, cz = (gbox.min.z + gbox.max.z) / 2, minY = gbox.min.y;
    const normM = new THREE.Matrix4().makeTranslation(-cx * s, -minY * s, -cz * s).multiply(new THREE.Matrix4().makeScale(s, s, s));

    // Second pass: group corners by material (uuid), collecting position + uv.
    const groups = new Map();   // key -> { material, pos:[], uv:[]|null }
    for (const m of srcs) {
      const mat = Array.isArray(m.material) ? (m.material[0] || null) : m.material;
      const key = (mat && mat.uuid) || 'default';
      let g = m.geometry; if (g.index) g = g.toNonIndexed(); g = g.clone();
      g.applyMatrix4(m.matrixWorld); g.applyMatrix4(normM);
      const pos = g.attributes.position;
      const uvAttr = g.attributes.uv || g.attributes.uv2 || null;
      let grp = groups.get(key);
      if (!grp) { grp = { material: mat, pos: [], uv: (uvAttr ? [] : null) }; groups.set(key, grp); }
      for (let i = 0; i < pos.count * 3; i++) grp.pos.push(pos.array[i]);
      if (grp.uv) {
        if (uvAttr) for (let i = 0; i < pos.count * 2; i++) grp.uv.push(uvAttr.array[i]);
        else for (let i = 0; i < pos.count * 2; i++) grp.uv.push(0);   // keep alignment if only some meshes have uv
      }
      g.dispose();
    }

    this._reset();
    let origTris = 0;
    for (const grp of groups.values()) {
      const position = Float32Array.from(grp.pos);
      const uv = grp.uv ? Float32Array.from(grp.uv) : null;
      const tris = position.length / 9;
      origTris += tris;
      this.surfaces.push({ position, uv, material: this._prepMaterial(grp.material), origTris: tris });
    }
    this.origTris = origTris;
    this.modelName = (name || 'model').replace(/\.(glb|gltf|fbx|obj)$/i, '');

    // display starts at 100%
    this._apply(this.surfaces.map(sf => ({ position: sf.position, normal: null, uv: sf.uv, tris: sf.origTris })));
    this._frame();
    this._status('');
    this._changed();
    return this.stats();
  }

  // clone the source material so decimation/rebuild never mutates the loaded
  // asset, and make sure it renders double-sided; textures/maps are retained.
  _prepMaterial(mat) {
    let out;
    try { out = mat ? mat.clone() : null; } catch (e) { out = null; }
    if (!out) out = new THREE.MeshStandardMaterial({ color: 0xbfc4cb, roughness: 0.7, metalness: 0.03 });
    out.side = THREE.DoubleSide;
    if (out.map) { out.map.colorSpace = THREE.SRGBColorSpace; out.map.needsUpdate = true; }
    out.needsUpdate = true;
    return out;
  }

  _dispMat(i) { return this.showTex ? (this.surfaces[i] && this.surfaces[i].material) || this._gray : this._gray; }

  // build display meshes from a set of per-surface states
  _apply(states) {
    this._disposeMeshes();
    this._cur = states;
    this._meshes = [];
    const union = new THREE.Box3();
    let curTris = 0;
    states.forEach((st, i) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(st.position.slice(0), 3));
      if (st.normal) geo.setAttribute('normal', new THREE.BufferAttribute(st.normal.slice(0), 3)); else geo.computeVertexNormals();
      if (st.uv) geo.setAttribute('uv', new THREE.BufferAttribute(st.uv.slice(0), 2));
      geo.computeBoundingBox(); geo.computeBoundingSphere();
      if (geo.boundingBox) union.union(geo.boundingBox);
      const mesh = new THREE.Mesh(geo, this._dispMat(i));
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.root.add(mesh); this._meshes.push(mesh);
      curTris += st.tris;
    });
    this.curTris = curTris;
    if (!union.isEmpty()) { this.modelCenter = union.getCenter(new THREE.Vector3()); this.modelRadius = union.getBoundingSphere(new THREE.Sphere()).radius || 1; }
    if (this.wire) this._refreshWire();
  }

  // ---------------------------------------------------------- DECIMATE
  async _decimateSurface(sf, ratio, job) {
    if (ratio >= 0.999) return { position: sf.position, normal: null, uv: sf.uv, tris: sf.origTris };
    const out = await decimateMesh(sf.position, ratio, { uv: sf.uv || undefined, onStatus: m => this._status(m), job });
    if (!out) return { position: sf.position, normal: null, uv: sf.uv, tris: sf.origTris };
    return { position: out.position, normal: out.normal, uv: out.uv || sf.uv, tris: out.stats.outTris };
  }
  async _statesFor(ratio, job) {
    const states = [];
    for (const sf of this.surfaces) { if (job) job.checkpoint(); states.push(await this._decimateSurface(sf, ratio, job)); await new Promise(r => setTimeout(r, 0)); }
    return states;
  }
  async decimateTo(ratio, job) {
    if (!this.surfaces.length) return null;
    this._status('Decimating…');
    await new Promise(r => setTimeout(r, 20));
    const states = await this._statesFor(ratio, job);
    this._apply(states);
    this._status(''); this._changed();
    return this.stats();
  }

  resetMesh() {
    if (!this.surfaces.length) return null;
    this._apply(this.surfaces.map(sf => ({ position: sf.position, normal: null, uv: sf.uv, tris: sf.origTris })));
    this._changed();
    return this.stats();
  }

  // ---------------------------------------------------------- GROUP / EXPORT
  // Build a THREE.Group from per-surface states, each mesh carrying its real
  // (textured) material — so GLTFExporter embeds the textures into the GLB.
  _buildGroup(states, name, nameFn) {
    const group = new THREE.Group(); group.name = name || (this.modelName || 'character');
    states.forEach((st, i) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(st.position.slice(0), 3));
      if (st.normal) geo.setAttribute('normal', new THREE.BufferAttribute(st.normal.slice(0), 3)); else geo.computeVertexNormals();
      if (st.uv) geo.setAttribute('uv', new THREE.BufferAttribute(st.uv.slice(0), 2));
      const mat = (this.surfaces[i] && this.surfaces[i].material) || this._gray;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = nameFn ? nameFn(i) : ((this.modelName || 'mesh') + (states.length > 1 ? '_' + i : ''));
      group.add(mesh);
    });
    return group;
  }
  async _exportGroup(group) {
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const buf = await new Promise((res, rej) => new GLTFExporter().parse(group, res, rej, { binary: true }));
    group.traverse(o => { if (o.isMesh && o.geometry) o.geometry.dispose(); });   // materials belong to surfaces — keep
    return buf;
  }

  // Export the CURRENT (on-screen) decimation as a textured GLB.
  async exportGLB() {
    if (!this.surfaces.length) throw new Error('Load a model first');
    this._status('Packing GLB…');
    const buf = await this._exportGroup(this._buildGroup(this._cur, this.modelName));
    this._status('');
    return buf;
  }

  // "Make LODs": decimate the ORIGINAL at set ratios and pack ONE GLB whose
  // meshes are named <name>_LOD0..N — the naming Unity/Unreal auto-recognise.
  async makeLODs(ratios, job) {
    if (!this.surfaces.length) throw new Error('Load a model first');
    ratios = (ratios && ratios.length ? ratios : [1, 0.6, 0.3, 0.12]);
    const group = new THREE.Group(); group.name = (this.modelName || 'character') + '_LODs';
    const rungs = [];
    for (let i = 0; i < ratios.length; i++) {
      if (job) job.checkpoint();
      this._status('LOD' + i + ' — ' + Math.round(ratios[i] * 100) + '%…');
      await new Promise(r => setTimeout(r, 20));
      const states = await this._statesFor(ratios[i], job);
      const sub = this._buildGroup(states, (this.modelName || 'character') + '_LOD' + i, () => (this.modelName || 'character') + '_LOD' + i);
      group.add(sub);
      rungs.push({ lod: i, ratio: ratios[i], tris: states.reduce((a, b) => a + b.tris, 0) });
    }
    this._status('Packing GLB…');
    const buf = await this._exportGroup(group);
    this._status('');
    return { buffer: buf, rungs };
  }

  // Separate textured LOD files for the Library: one GLB per rung named
  // <name>_<pct>.glb. pcts: percentages (e.g. [100,60,30,12]); 100 forced in.
  async makeLODFiles(pcts, job) {
    if (!this.surfaces.length) throw new Error('Load a model first');
    let list = (pcts && pcts.length ? pcts.slice() : [100, 60, 30, 12]).map(p => Math.max(1, Math.min(100, Math.round(p))));
    if (!list.includes(100)) list.unshift(100);
    list = [...new Set(list)].sort((a, b) => b - a);
    const baseName = (this.modelName || 'character');
    const files = [];
    for (const pct of list) {
      if (job) job.checkpoint();
      this._status('LOD ' + pct + '%…');
      await new Promise(r => setTimeout(r, 20));
      const states = await this._statesFor(pct / 100, job);
      const buf = await this._exportGroup(this._buildGroup(states, baseName));
      files.push({ pct, name: baseName + '_' + pct + '.glb', buffer: buf, tris: states.reduce((a, b) => a + b.tris, 0) });
    }
    this._status('');
    return { baseName, files };
  }

  // ---------------------------------------------------------- OBJ (geometry only)
  exportOBJ() {
    if (!this._meshes.length) return '';
    const map = new Map(); const verts = []; const faces = [];
    const q = 1e5;
    for (const mesh of this._meshes) {
      const pos = mesh.geometry.attributes.position; if (!pos) continue;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const k = Math.round(x * q) + '_' + Math.round(y * q) + '_' + Math.round(z * q);
        let id = map.get(k); if (id == null) { id = verts.length / 3; verts.push(x, y, z); map.set(k, id); }
        faces.push(id);
      }
    }
    let s = '# ' + (this.modelName || 'mesh') + ' — decimated to ' + this.curTris + ' tris (Studio · Decimate). Geometry only — use GLB for textures.\n';
    for (let i = 0; i < verts.length; i += 3) s += 'v ' + verts[i].toFixed(6) + ' ' + verts[i + 1].toFixed(6) + ' ' + verts[i + 2].toFixed(6) + '\n';
    for (let f = 0; f < faces.length; f += 3) s += 'f ' + (faces[f] + 1) + ' ' + (faces[f + 1] + 1) + ' ' + (faces[f + 2] + 1) + '\n';
    return s;
  }

  // ---------------------------------------------------------- VIEW / DISPLAY
  setTexture(on) {
    this.showTex = !!on;
    this._meshes.forEach((m, i) => { m.material = this._dispMat(i); });
  }
  setWire(on) {
    this.wire = !!on;
    if (on) this._refreshWire(); else if (this._wire) this._wire.visible = false;
    if (this._wire) this._wire.visible = on;
  }
  _refreshWire() {
    if (this._wire) { this.root.remove(this._wire); this._wire.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this._wire = null; }
    if (!this._meshes.length) return;
    const g = new THREE.Group();
    const mat = new THREE.LineBasicMaterial({ color: 0x0e1014, transparent: true, opacity: 0.22 });
    for (const mesh of this._meshes) { const wg = new THREE.WireframeGeometry(mesh.geometry); g.add(new THREE.LineSegments(wg, mat)); }
    g.visible = this.wire; this._wire = g; this.root.add(g);
  }
  setView(name) {
    const c = this.modelCenter, r = this.modelRadius, d = r * 2.6;
    this.controls.target.copy(c);
    const set = (x, y, z) => this.camera.position.set(x, y, z);
    if (name === 'front') set(c.x, c.y, c.z + d);
    else if (name === 'side') set(c.x + d, c.y, c.z);
    else if (name === 'top') set(c.x + 0.001, c.y + d, c.z + 0.001);
    else if (name === 'back') set(c.x, c.y, c.z - d);
    else set(c.x + r * 0.6, c.y + r * 0.2, c.z + d);
    this.controls.update();
  }
  _frame() {
    const c = this.modelCenter, r = this.modelRadius;
    this.controls.target.copy(c);
    this.camera.position.set(c.x + r * 0.6, c.y + r * 0.2, c.z + r * 2.6);
    this.controls.update();
  }
  frameModel() { this._frame(); }

  stats() { return { name: this.modelName, origTris: this.origTris, tris: this.curTris, textured: this.hasTexture() }; }

  _disposeMeshes() {
    for (const m of this._meshes) { this.root.remove(m); if (m.geometry) m.geometry.dispose(); }
    this._meshes = [];
    if (this._wire) { this.root.remove(this._wire); this._wire.traverse(o => { if (o.geometry) o.geometry.dispose(); }); this._wire = null; }
  }
  _reset() {
    this._disposeMeshes();
    for (const sf of this.surfaces) { try { sf.material && sf.material.dispose && sf.material.dispose(); } catch (e) {} }
    this.surfaces = []; this._cur = []; this.origTris = this.curTris = 0;
  }
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return; requestAnimationFrame(this._loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

export default DEEngine;
