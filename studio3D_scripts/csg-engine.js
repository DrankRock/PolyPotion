// ============================================================
// csg-engine.js — Boolean (CSG) tool engine, powered by Manifold WASM.
// Loads a mesh, shows a translucent cutter primitive, and runs
// union / subtract / intersect through manifold-3d — fully on-device.
// Loaded by dynamic import from Boolean.dc.html, like the other engines.
// ============================================================
import * as THREE from 'three';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { fetchAssetBuffer } from './chunk-loader.js';

export class CSGEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x16171b);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 500);
    this.camera.position.set(2.4, 1.6, 3);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.HemisphereLight(0xdfe6f0, 0x3a3630, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(3, 6, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9db4d0, 0.5); rim.position.set(-4, 2, -3); this.scene.add(rim);
    this.grid = new THREE.GridHelper(10, 20, 0x4b566a, 0x2c313b);
    this.grid.material.transparent = true; this.grid.material.opacity = 0.5;
    this.scene.add(this.grid);

    this.mesh = null; this.name = ''; this._undo = [];
    this.cutter = { shape: 'box', pos: new THREE.Vector3(), size: 0.45, rotY: 0 };
    this._cutterMesh = null; this._bbox = null;

    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();
    this._manifoldP = null;
    this.onChange = null; this.onStatus = null;

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    const loop = () => { this.controls.update(); this.renderer.render(this.scene, this.camera); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    if (typeof window !== 'undefined') window.__csgEngine = this;
  }

  _changed() { if (this.onChange) this.onChange(); }
  _status(m) { if (this.onStatus) this.onStatus(m); }
  hasModel() { return !!this.mesh; }
  stats() {
    const g = this.mesh && this.mesh.geometry;
    return { name: this.name, tris: g ? (g.index ? g.index.count / 3 : g.attributes.position.count / 3) | 0 : 0, canUndo: this._undo.length > 0 };
  }

  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  _manifold() {
    if (!this._manifoldP) {
      this._status('Loading Manifold WASM…');
      this._manifoldP = import('manifold-3d').then(async (m) => {
        const wasm = await m.default(); wasm.setup(); return wasm;
      });
    }
    return this._manifoldP;
  }

  // ---------- loading ----------
  async loadUrl(url, ext, opts, label) {
    const buf = await fetchAssetBuffer(url, opts || {});
    return this.loadBuffer(buf, label || url.split('/').pop(), ext || url.split('.').pop());
  }

  async loadBuffer(buffer, name, ext) {
    ext = (ext || 'glb').toLowerCase();
    let root;
    if (ext === 'fbx') root = this._fbx.parse(buffer, '');
    else if (ext === 'glb' || ext === 'gltf') {
      const g = await new Promise((res, rej) => this._gltf.parse(buffer, '', res, rej));
      root = g.scene || g.scenes[0];
    } else if (ext === 'obj') root = this._obj.parse(new TextDecoder().decode(buffer));
    else throw new Error('Unsupported .' + ext);

    // merge every mesh into one indexed soup in world space
    root.updateMatrixWorld(true);
    const verts = [], tris = [];
    const v = new THREE.Vector3();
    root.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
      const base = verts.length / 3;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); verts.push(v.x, v.y, v.z); }
      const idx = o.geometry.index;
      if (idx) for (let i = 0; i < idx.count; i++) tris.push(base + idx.getX(i));
      else for (let i = 0; i < pos.count; i++) tris.push(base + i);
    });
    if (!tris.length) throw new Error('No mesh geometry found in ' + name);

    this._setGeometry(new Float32Array(verts), new Uint32Array(tris));
    this.name = name.replace(/\.(glb|gltf|fbx|obj)$/i, '');
    this._undo = [];
    this._frame();
    this._makeCutter();
    this._changed();
    return { name: this.name, tris: tris.length / 3 };
  }

  _setGeometry(vertProperties, triVerts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(vertProperties, 3));
    g.setIndex(new THREE.BufferAttribute(triVerts, 1));
    g.computeVertexNormals();
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.geometry = g; }
    else {
      this.mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xb9bec8, roughness: 0.82, metalness: 0.05 }));
      this.scene.add(this.mesh);
    }
    this._bbox = new THREE.Box3().setFromObject(this.mesh);
  }

  _frame() {
    const b = this._bbox; if (!b) return;
    const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3()).length();
    this.controls.target.copy(c);
    this.camera.position.copy(c).add(new THREE.Vector3(0.7, 0.45, 1).normalize().multiplyScalar(s * 1.4));
    this.camera.near = s / 500; this.camera.far = s * 20; this.camera.updateProjectionMatrix();
    this.grid.position.y = b.min.y;
  }

  // ---------- cutter ----------
  setCutter(shape) { this.cutter.shape = shape; this._makeCutter(); }
  setCutterPos(axis, frac) { this.cutter.pos[axis] = frac; this._placeCutter(); }
  setCutterSize(frac) { this.cutter.size = frac; this._makeCutter(); }
  setCutterRot(deg) { this.cutter.rotY = deg; this._placeCutter(); }

  _cutterDim() { return (this._bbox ? this._bbox.getSize(new THREE.Vector3()).length() : 2) * 0.5 * this.cutter.size; }

  _makeCutter() {
    if (!this.mesh) return;
    if (this._cutterMesh) { this.scene.remove(this._cutterMesh); this._cutterMesh.geometry.dispose(); }
    const d = this._cutterDim();
    let g;
    if (this.cutter.shape === 'sphere') g = new THREE.SphereGeometry(d / 2, 32, 24);
    else if (this.cutter.shape === 'cylinder') g = new THREE.CylinderGeometry(d / 2, d / 2, d, 48);
    else g = new THREE.BoxGeometry(d, d, d);
    this._cutterMesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      color: 0xc98a5a, transparent: true, opacity: 0.32, depthWrite: false, roughness: 0.6,
    }));
    this._cutterMesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(g, 30), new THREE.LineBasicMaterial({ color: 0xc98a5a, transparent: true, opacity: 0.8 })));
    this.scene.add(this._cutterMesh);
    this._placeCutter();
  }

  _placeCutter() {
    if (!this._cutterMesh || !this._bbox) return;
    const c = this._bbox.getCenter(new THREE.Vector3()), s = this._bbox.getSize(new THREE.Vector3());
    this._cutterMesh.position.set(
      c.x + this.cutter.pos.x * s.x * 0.5,
      c.y + this.cutter.pos.y * s.y * 0.5,
      c.z + this.cutter.pos.z * s.z * 0.5,
    );
    this._cutterMesh.rotation.y = this.cutter.rotY * Math.PI / 180;
  }

  // ---------- boolean ops ----------
  async apply(op) {
    if (!this.mesh) throw new Error('Load a mesh first');
    const wasm = await this._manifold();
    const { Manifold, Mesh } = wasm;
    this._status('Building manifold…');

    const g = this.mesh.geometry;
    const srcMesh = new Mesh({
      numProp: 3,
      vertProperties: g.attributes.position.array instanceof Float32Array ? g.attributes.position.array : new Float32Array(g.attributes.position.array),
      triVerts: g.index.array instanceof Uint32Array ? g.index.array : new Uint32Array(g.index.array),
    });
    srcMesh.merge();                       // weld duplicate verts → watertight if possible
    let a;
    try { a = new Manifold(srcMesh); }
    catch (e) { throw new Error('This mesh isn\u2019t watertight, so exact booleans can\u2019t run on it. Weld / repair it first (Sculpt or Decimate re-weld on load).'); }

    const d = this._cutterDim();
    let b;
    if (this.cutter.shape === 'sphere') b = Manifold.sphere(d / 2, 48);
    else if (this.cutter.shape === 'cylinder') b = Manifold.cylinder(d, d / 2, d / 2, 64, true).rotate([-90, 0, 0]);  // manifold cylinders are z-up
    else b = Manifold.cube([d, d, d], true);
    b = b.rotate([0, this.cutter.rotY, 0]).translate([this._cutterMesh.position.x, this._cutterMesh.position.y, this._cutterMesh.position.z]);

    this._status('Running ' + op + '…');
    let r;
    if (op === 'union') r = a.add(b);
    else if (op === 'intersect') r = a.intersect(b);
    else r = a.subtract(b);
    const out = r.getMesh();
    const nTris = out.triVerts.length / 3;
    if (!nTris) { a.delete(); b.delete(); r.delete(); throw new Error('Result is empty — the cutter doesn\u2019t overlap the mesh that way.'); }

    // undo snapshot (cap 10)
    this._undo.push({ v: g.attributes.position.array.slice(0), t: g.index.array.slice(0) });
    if (this._undo.length > 10) this._undo.shift();

    this._setGeometry(new Float32Array(out.vertProperties), new Uint32Array(out.triVerts));
    a.delete(); b.delete(); r.delete();
    this._status('');
    this._changed();
    return { tris: nTris };
  }

  undo() {
    const s = this._undo.pop(); if (!s) return false;
    this._setGeometry(s.v, s.t);
    this._changed();
    return true;
  }

  // ---------- export ----------
  async exportGLB() {
    if (!this.mesh) return;
    const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
    const bin = await new Promise((res, rej) => new GLTFExporter().parse(this.mesh, res, rej, { binary: true }));
    const blob = new Blob([bin], { type: 'model/gltf-binary' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = (this.name || 'boolean') + '.glb';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
}
