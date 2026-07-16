// ============================================================
// decimate-engine.js — DECIMATE  (DEEngine)
// Loads a model (GLB/FBX/OBJ), bakes + normalizes it into one surface,
// and reduces its triangle count with quadric error-metric edge collapse
// (qem.js) — non-destructively, re-running from the original each time so
// the target slider is always predictable. Wireframe overlay shows the new
// topology; OBJ export hands the lightened mesh back to you.
// Loaded by dynamic import from Decimate.dc.html, like the other engines.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
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

    this.mesh = null; this._wire = null;
    this.origPos = null;            // Float32Array non-indexed (the source of truth)
    this.origTris = 0; this.curTris = 0;
    this.modelName = ''; this.modelRadius = 1; this.modelCenter = V(0, 0.95, 0);
    this.wire = false;

    this.onStatus = null; this.onChange = null;
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__deEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return !!this.mesh; }

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

    this._status('Baking surface…');
    const chunks = []; const gbox = new THREE.Box3();
    for (const m of srcs) {
      let g = m.geometry; if (g.index) g = g.toNonIndexed(); g = g.clone();
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', g.attributes.position.clone());
      pg.applyMatrix4(m.matrixWorld); pg.computeBoundingBox(); gbox.union(pg.boundingBox);
      chunks.push(pg);
    }
    const size = gbox.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1);
    const cx = (gbox.min.x + gbox.max.x) / 2, cz = (gbox.min.z + gbox.max.z) / 2, minY = gbox.min.y;
    const normM = new THREE.Matrix4().makeTranslation(-cx * s, -minY * s, -cz * s).multiply(new THREE.Matrix4().makeScale(s, s, s));

    let total = 0; chunks.forEach(c => total += c.attributes.position.count);
    const flat = new Float32Array(total * 3); let o = 0;
    for (const c of chunks) { c.applyMatrix4(normM); const p = c.attributes.position; flat.set(p.array.subarray(0, p.count * 3), o); o += p.count * 3; c.dispose(); }

    this.origPos = flat;
    this.origTris = total / 3;
    this.modelName = (name || 'model').replace(/\.(glb|gltf|fbx|obj)$/i, '');
    this._setGeometry(flat, null);
    this.curTris = this.origTris;
    this._frame();
    this._status('');
    this._changed();
    return this.stats();
  }

  _setGeometry(position, normal) {
    this._disposeMesh();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(position.slice(0), 3));
    if (normal) geo.setAttribute('normal', new THREE.BufferAttribute(normal.slice(0), 3));
    else geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    const mat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.66, metalness: 0.03, side: THREE.DoubleSide, flatShading: false });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; mesh.receiveShadow = true;
    this.mesh = mesh; this.root.add(mesh);
    const box = geo.boundingBox; this.modelCenter = box.getCenter(new THREE.Vector3());
    this.modelRadius = box.getBoundingSphere(new THREE.Sphere()).radius || 1;
    if (this.wire) this._refreshWire();
  }

  // ---------------------------------------------------------- DECIMATE
  async decimateTo(ratio) {
    if (!this.origPos) return null;
    this._status('Decimating…');
    await new Promise(r => setTimeout(r, 20));
    const out = decimateMesh(this.origPos, ratio, { onStatus: m => this._status(m) });
    if (!out) { this._status(''); return null; }
    this._setGeometry(out.position, out.normal);
    this.curTris = out.stats.outTris;
    this._status(''); this._changed();
    return this.stats();
  }
  // ---------------------------------------------------------- LOD CHAIN
  // "Make LODs" (Frontier Audit): decimate the ORIGINAL at set ratios and
  // export one GLB whose meshes are named <name>_LOD0..N — the naming Unity
  // (LOD Group) and Unreal auto-recognise. Ratios default to 100/60/30/12%.
  async makeLODs(ratios) {
    if (!this.origPos) throw new Error('Load a model first');
    ratios = (ratios && ratios.length ? ratios : [1, 0.6, 0.3, 0.12]);
    const { GLTFExporter } = await import('https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js');
    const group = new THREE.Group();
    group.name = (this.modelName || 'character') + '_LODs';
    const rungs = [];
    for (let i = 0; i < ratios.length; i++) {
      this._status('LOD' + i + ' — ' + Math.round(ratios[i] * 100) + '%…');
      await new Promise(r => setTimeout(r, 20));
      let position, normal, tris;
      if (ratios[i] >= 0.999) { position = this.origPos; normal = null; tris = this.origTris; }
      else {
        const out = decimateMesh(this.origPos, ratios[i], { onStatus: m => this._status(m) });
        if (!out) continue;
        position = out.position; normal = out.normal; tris = out.stats.outTris;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(position.slice(0), 3));
      if (normal) geo.setAttribute('normal', new THREE.BufferAttribute(normal.slice(0), 3)); else geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: 'lod_mat' }));
      mesh.name = (this.modelName || 'character') + '_LOD' + i;
      group.add(mesh);
      rungs.push({ lod: i, ratio: ratios[i], tris });
    }
    this._status('Packing GLB…');
    const buf = await new Promise((res, rej) => new GLTFExporter().parse(group, res, rej, { binary: true }));
    group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    this._status('');
    return { buffer: buf, rungs };
  }

  resetMesh() {
    if (!this.origPos) return null;
    this._setGeometry(this.origPos, null);
    this.curTris = this.origTris; this._changed();
    return this.stats();
  }

  // ---------------------------------------------------------- OBJ EXPORT
  exportOBJ() {
    if (!this.mesh) return '';
    const pos = this.mesh.geometry.attributes.position;
    // weld for a compact OBJ
    const map = new Map(); const verts = []; const idx = new Int32Array(pos.count);
    const q = 1e5;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = Math.round(x * q) + '_' + Math.round(y * q) + '_' + Math.round(z * q);
      let id = map.get(k); if (id == null) { id = verts.length / 3; verts.push(x, y, z); map.set(k, id); } idx[i] = id;
    }
    let s = '# ' + (this.modelName || 'mesh') + ' — decimated to ' + this.curTris + ' tris (Studio · Decimate)\n';
    for (let i = 0; i < verts.length; i += 3) s += 'v ' + verts[i].toFixed(6) + ' ' + verts[i + 1].toFixed(6) + ' ' + verts[i + 2].toFixed(6) + '\n';
    for (let f = 0; f < pos.count; f += 3) s += 'f ' + (idx[f] + 1) + ' ' + (idx[f + 1] + 1) + ' ' + (idx[f + 2] + 1) + '\n';
    return s;
  }

  // ---------------------------------------------------------- VIEW / DISPLAY
  setWire(on) {
    this.wire = !!on;
    if (on) this._refreshWire(); else if (this._wire) { this._wire.visible = false; }
    if (this._wire) this._wire.visible = on;
  }
  _refreshWire() {
    if (this._wire) { this.root.remove(this._wire); this._wire.geometry.dispose(); this._wire = null; }
    if (!this.mesh) return;
    const wg = new THREE.WireframeGeometry(this.mesh.geometry);
    this._wire = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: 0x0e1014, transparent: true, opacity: 0.22 }));
    this._wire.visible = this.wire; this.root.add(this._wire);
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

  stats() { return { name: this.modelName, origTris: this.origTris, tris: this.curTris }; }

  _disposeMesh() {
    if (this.mesh) { this.root.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh = null; }
    if (this._wire) { this.root.remove(this._wire); this._wire.geometry.dispose(); this._wire = null; }
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
