// ============================================================
// texture-engine.js — PolyPotion PAINT  (TexEngine)
// A texture painter: loads a mesh, adopts (or creates) its colour map into an
// editable 2048-max canvas, and paints it from BOTH sides —
//   · paint on the 3D model  → raycast → UV → stamp into the map
//   · paint on the flat 2D map → UV → surface → a live ring shows where it
//     lands on the model
// Tools: brush, eraser, clone-stamp, bucket fill, colour pick, and a cheap
// diffusion-based content-aware heal. Undo history on the pixel buffer.
// Loaded by dynamic import from TexturePaint.dc.html, like the other engines.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';
import { fetchAssetBuffer } from './chunk-loader.js';

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export class TexEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 500);
    this.camera.position.set(1.6, 1.4, 3.2);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.9, 0);

    const hemi = new THREE.HemisphereLight(0xeef2fb, 0x2b2f36, 1.0); this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(3, 6, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x9fb6e8, 0.5); rim.position.set(-4, 3, -4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe9cf, 0.35); fill.position.set(1, 1.2, -4); this.scene.add(fill);

    this.wrap = new THREE.Group(); this.scene.add(this.wrap);
    this.model = null; this.paintMesh = null;
    this.modelName = ''; this.tris = 0; this.hasUVs = false; this.hadTexture = false;
    this.modelCenter = new THREE.Vector3(0, 0.9, 0); this.modelRadius = 1;

    // brush state
    this.tool = 'brush';
    this.color = '#c8743c';
    this.size = 64;          // diameter in texture pixels
    this.opacity = 1;
    this.hardness = 0.6;
    this.cloneSrc = null;    // {u,v} normalized, set with alt/right on clone tool
    this.cloneAnchor = null; // where the current clone stroke started (dst)

    // texture buffer
    this.texW = 1024; this.texH = 1024;
    this.texCanvas = document.createElement('canvas');
    this.texCtx = this.texCanvas.getContext('2d', { willReadFrequently: true });
    this.texture = null;
    this.uvGrid = null;      // acceleration for UV → surface
    this.history = []; this.histMax = 14; this.redoStack = [];

    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();
    this.onStatus = null; this.onChange = null; this.onPickColor = null;

    // 3D marker ring — shows where the brush lands on the surface
    const ringGeo = new THREE.RingGeometry(0.02, 0.028, 40);
    this.marker = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthTest: false }));
    this.marker.renderOrder = 999; this.marker.visible = false; this.scene.add(this.marker);

    this.ray = new THREE.Raycaster();
    this.setBackground('#cdba90');

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    this._setup3DPaint();
    if (typeof window !== 'undefined') window.__texEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  setBackground(css) {
    const c = document.createElement('canvas'); c.width = 8; c.height = 256;
    const g = c.getContext('2d'); const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, this._lighten(css, 12)); grad.addColorStop(1, css);
    g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; this.scene.background = t;
  }
  _lighten(hex, amt) {
    try { const n = parseInt(hex.slice(1), 16); let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
      r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); } catch (e) { return hex; }
  }

  // ---------- setters from the UI ----------
  setTool(t) { this.tool = t; if (t !== 'clone') { this.cloneSrc = null; this.cloneAnchor = null; } this._changed(); }
  setColor(c) { this.color = c; this._changed(); }
  setSize(px) { this.size = clamp(px, 2, 800); }
  setOpacity(o) { this.opacity = clamp(o, 0, 1); }
  setHardness(h) { this.hardness = clamp(h, 0, 1); }
  setCloneSource(u, v) { this.cloneSrc = { u, v }; this.cloneAnchor = null; this._status('Clone source set — now paint'); }

  // ---------- loading ----------
  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts || {});
    const name = url.split('/').pop() || 'model';
    return this.loadBuffer(buf, name, (ext || name.split('.').pop() || 'glb'));
  }
  async loadFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const buf = ext === 'obj' ? await file.text() : await file.arrayBuffer();
    return this.loadBuffer(buf, file.name, ext);
  }
  async loadBuffer(buffer, name, ext) {
    ext = (ext || 'glb').toLowerCase();
    this._clear();
    this._status('Parsing ' + name + '…');
    let root = null;
    if (ext === 'fbx') root = this._fbx.parse(buffer, '');
    else if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buffer, '', res, rej)); root = g.scene || (g.scenes && g.scenes[0]); }
    else if (ext === 'obj') root = this._obj.parse(typeof buffer === 'string' ? buffer : new TextDecoder().decode(buffer));
    else throw new Error('Unsupported format: .' + ext);
    if (!root) throw new Error('No scene in ' + name);

    // choose the meatiest mesh that has UVs (fallback: meatiest mesh)
    let best = null, bestUV = null, tris = 0;
    root.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      const pos = o.geometry.getAttribute('position'); if (!pos) return;
      const t = o.geometry.index ? o.geometry.index.count / 3 : pos.count / 3;
      tris += t;
      const hasUV = !!o.geometry.getAttribute('uv');
      if (hasUV && (!bestUV || t > bestUV._t)) { bestUV = o; bestUV._t = t; }
      if (!best || t > best._t) { best = o; best._t = t; }
    });
    const target = bestUV || best;
    if (!target) throw new Error('No mesh found in ' + name);

    this.wrap.add(root); this.model = root; this.paintMesh = target;
    this.tris = Math.round(tris);
    this.modelName = name.replace(/\.(glb|gltf|fbx|obj)$/i, '');
    this.hasUVs = !!target.geometry.getAttribute('uv');

    // material tidy — give every mesh a paintable standard material, dim the non-target ones
    root.traverse(o => { if (o.isMesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => { if (m) m.side = THREE.DoubleSide; });
    }});

    this._adoptTexture(target);
    this._normalize();
    if (this.hasUVs) this._buildUVGrid(target);
    this.frame();
    this._changed(); this._status('');
    return { name: this.modelName, tris: this.tris, hasUVs: this.hasUVs, hadTexture: this.hadTexture };
  }

  _clear() {
    if (this.model) { this.wrap.remove(this.model); this.model.traverse(o => { if (o.isMesh) o.geometry && o.geometry.dispose(); }); }
    this.model = null; this.paintMesh = null; this.uvGrid = null; this.history = []; this.redoStack = [];
    this.cloneSrc = null; this.cloneAnchor = null; this.marker.visible = false;
    this.wrap.position.set(0, 0, 0); this.wrap.scale.setScalar(1);
  }

  // pull the mesh's existing map into our editable canvas, or make a fresh one
  _adoptTexture(mesh) {
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const src = mat && mat.map && mat.map.image;
    if (src && src.width) {
      this.texW = Math.min(2048, src.width); this.texH = Math.min(2048, src.height);
      this.texCanvas.width = this.texW; this.texCanvas.height = this.texH;
      try { this.texCtx.drawImage(src, 0, 0, this.texW, this.texH); this.hadTexture = true; }
      catch (e) { this._fillBlank(); this.hadTexture = false; }
    } else {
      this.texW = this.texH = 1024;
      this.texCanvas.width = this.texW; this.texCanvas.height = this.texH;
      this._fillBlank(); this.hadTexture = false;
    }
    // build/replace the live texture and bind it to a fresh standard material
    this.texture = new THREE.CanvasTexture(this.texCanvas);
    this.texture.colorSpace = THREE.SRGBColorSpace; this.texture.flipY = true;
    this.texture.anisotropy = 4; this.texture.needsUpdate = true;
    const newMat = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.85, metalness: 0.0, side: THREE.DoubleSide });
    mesh.material = newMat;
    this._pushHistory();
  }
  _fillBlank() {
    const g = this.texCtx; g.fillStyle = '#d7cdbb'; g.fillRect(0, 0, this.texW, this.texH);
    // faint UV-friendly grid so the surface reads while empty
    g.strokeStyle = 'rgba(120,100,72,.18)'; g.lineWidth = 1;
    const step = this.texW / 16;
    for (let i = 1; i < 16; i++) { g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, this.texH); g.moveTo(0, i * step); g.lineTo(this.texW, i * step); g.stroke(); }
  }

  _normalize() {
    this.wrap.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(this.model); if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1); this.wrap.scale.setScalar(s);
    this.wrap.position.set(0, 0, 0); this.wrap.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(this.model); const c2 = b2.getCenter(new THREE.Vector3());
    this.wrap.position.set(-c2.x, -b2.min.y, -c2.z); this.wrap.updateMatrixWorld(true);
    const b3 = new THREE.Box3().setFromObject(this.model);
    const sph = b3.getBoundingSphere(new THREE.Sphere()); this.modelCenter.copy(sph.center); this.modelRadius = sph.radius || 1;
  }
  frame(view) {
    const c = this.modelCenter, r = this.modelRadius || 1; this.controls.target.copy(c);
    const dirs = { persp: new THREE.Vector3(0.5, 0.28, 1).normalize(), front: new THREE.Vector3(0, 0, 1), back: new THREE.Vector3(0, 0, -1), side: new THREE.Vector3(1, 0, 0), top: new THREE.Vector3(0, 1, 0.001) };
    const d = dirs[view] || dirs.persp;
    this.camera.position.copy(c).addScaledVector(d, r * 2.6);
    this.camera.near = Math.max(0.01, r / 100); this.camera.far = r * 100; this.camera.updateProjectionMatrix(); this.controls.update();
  }
  setView(v) { this.frame(v); }

  // ---------- UV → surface acceleration grid ----------
  // Bucket every triangle by its UV bounding box into a coarse grid so we can
  // find, for any UV point, the world-space surface position + normal fast.
  _buildUVGrid(mesh) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position'), uv = geo.getAttribute('uv');
    if (!uv) { this.uvGrid = null; return; }
    const idx = geo.index ? geo.index.array : null;
    const triCount = idx ? idx.length / 3 : pos.count / 3;
    const N = 48; const grid = Array.from({ length: N * N }, () => []);
    mesh.updateMatrixWorld(true); const mw = mesh.matrixWorld;
    const nm = new THREE.Matrix3().getNormalMatrix(mw);
    const faces = new Array(triCount);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let f = 0; f < triCount; f++) {
      const i0 = idx ? idx[f * 3] : f * 3, i1 = idx ? idx[f * 3 + 1] : f * 3 + 1, i2 = idx ? idx[f * 3 + 2] : f * 3 + 2;
      const u0 = uv.getX(i0), v0 = uv.getY(i0), u1 = uv.getX(i1), v1 = uv.getY(i1), u2 = uv.getX(i2), v2 = uv.getY(i2);
      a.fromBufferAttribute(pos, i0).applyMatrix4(mw); b.fromBufferAttribute(pos, i1).applyMatrix4(mw); c.fromBufferAttribute(pos, i2).applyMatrix4(mw);
      const nrm = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).applyMatrix3(nm).normalize();
      faces[f] = { u0, v0, u1, v1, u2, v2, p0: a.clone(), p1: b.clone(), p2: c.clone(), n: nrm };
      const minu = Math.min(u0, u1, u2), maxu = Math.max(u0, u1, u2), minv = Math.min(v0, v1, v2), maxv = Math.max(v0, v1, v2);
      const gx0 = clamp(Math.floor(minu * N), 0, N - 1), gx1 = clamp(Math.floor(maxu * N), 0, N - 1);
      const gy0 = clamp(Math.floor(minv * N), 0, N - 1), gy1 = clamp(Math.floor(maxv * N), 0, N - 1);
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) grid[gy * N + gx].push(f);
    }
    this.uvGrid = { N, grid, faces };
  }

  // UV point → {point, normal} on the surface (or null)
  uvToSurface(u, v) {
    const G = this.uvGrid; if (!G) return null;
    u = u - Math.floor(u); v = v - Math.floor(v);
    const gx = clamp(Math.floor(u * G.N), 0, G.N - 1), gy = clamp(Math.floor(v * G.N), 0, G.N - 1);
    const cell = G.grid[gy * G.N + gx]; if (!cell || !cell.length) return null;
    for (const f of cell) {
      const t = G.faces[f];
      const bc = this._bary(u, v, t.u0, t.v0, t.u1, t.v1, t.u2, t.v2);
      if (bc && bc.w0 >= -0.001 && bc.w1 >= -0.001 && bc.w2 >= -0.001) {
        const p = new THREE.Vector3()
          .addScaledVector(t.p0, bc.w0).addScaledVector(t.p1, bc.w1).addScaledVector(t.p2, bc.w2);
        return { point: p, normal: t.n };
      }
    }
    return null;
  }
  _bary(px, py, ax, ay, bx, by, cx, cy) {
    const v0x = bx - ax, v0y = by - ay, v1x = cx - ax, v1y = cy - ay, v2x = px - ax, v2y = py - ay;
    const den = v0x * v1y - v1x * v0y; if (Math.abs(den) < 1e-12) return null;
    const w1 = (v2x * v1y - v1x * v2y) / den, w2 = (v0x * v2y - v2x * v0y) / den, w0 = 1 - w1 - w2;
    return { w0, w1, w2 };
  }

  // ---------- 3D painting (raycast the model) ----------
  _setup3DPaint() {
    const el = this.canvas; let down = false;
    const uvAt = (ev) => {
      if (!this.paintMesh || !this.hasUVs) return null;
      const r = el.getBoundingClientRect();
      const nx = ((ev.clientX - r.left) / r.width) * 2 - 1, ny = -((ev.clientY - r.top) / r.height) * 2 + 1;
      this.ray.setFromCamera({ x: nx, y: ny }, this.camera);
      const hit = this.ray.intersectObject(this.paintMesh, true)[0];
      if (!hit || !hit.uv) { this.marker.visible = false; return null; }
      this._placeMarkerAt(hit.point, hit.face ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld) : null);
      return { u: hit.uv.x, v: hit.uv.y };
    };
    el.addEventListener('pointermove', (ev) => {
      if (!down) { uvAt(ev); return; }
      const uv = uvAt(ev); if (uv) this._applyAt(uv.u, uv.v, ev);
    });
    el.addEventListener('pointerdown', (ev) => {
      if (this._paintDisabled()) return;
      const uv = uvAt(ev); if (!uv) return;
      // painting on the model should not orbit
      if (this.tool !== 'orbit') { this.controls.enabled = false; down = true; this._strokeStart(); this._applyAt(uv.u, uv.v, ev); }
    });
    const up = () => { if (down) { down = false; this.controls.enabled = true; this._strokeEnd(); } };
    el.addEventListener('pointerup', up); el.addEventListener('pointerleave', () => { this.marker.visible = false; up(); });
  }
  _paintDisabled() { return !this.paintMesh || !this.hasUVs || this.tool === 'orbit'; }
  _placeMarkerAt(point, normal) {
    const rWorld = (this.size / this.texW) * this.modelRadius * 1.4;
    this.marker.position.copy(point);
    if (normal) { const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal); this.marker.quaternion.copy(q); }
    this.marker.scale.setScalar(Math.max(0.2, rWorld / 0.028));
    this.marker.material.color.set(this.tool === 'erase' ? 0xff6b6b : this.tool === 'clone' ? 0x6bb6ff : 0xffffff);
    this.marker.visible = true;
  }
  // show the surface point for a UV (used while hovering the flat 2D map)
  showUVOnMesh(u, v) {
    const s = this.uvToSurface(u, v);
    if (s) this._placeMarkerAt(s.point, s.normal); else this.marker.visible = false;
    return !!s;
  }
  hideMarker() { this.marker.visible = false; }

  // ---------- 2D painting (called by the DC with normalized coords) ----------
  paint2D(u, v, phase, ev) {
    if (this._paintDisabled()) return;
    if (phase === 'down') { this._strokeStart(); this._applyAt(u, v, ev); }
    else if (phase === 'move') this._applyAt(u, v, ev);
    else if (phase === 'up') this._strokeEnd();
  }

  _strokeStart() {
    this._pushHistory();
    this._last = null;
    this._strokeSnap = null;
    if (this.tool === 'clone') {
      if (!this.cloneSrc) { this._status('Alt-click / right-click to set a clone source first'); return; }
      // snapshot the map so the stroke copies from a stable source
      this._strokeSnap = document.createElement('canvas'); this._strokeSnap.width = this.texW; this._strokeSnap.height = this.texH;
      this._strokeSnap.getContext('2d').drawImage(this.texCanvas, 0, 0);
      this.cloneAnchor = null;
    }
  }
  _strokeEnd() { this._last = null; this._strokeSnap = null; this.cloneAnchor = null; this._pushRedoClear(); }

  _applyAt(u, v, ev) {
    // stylus pressure scales brush opacity for pen input; mouse/touch stays full
    this._penFactor = (ev && ev.pointerType === 'pen' && ev.pressure > 0) ? Math.max(0.05, ev.pressure) : 1;
    const px = u * this.texW, py = (1 - v) * this.texH;   // flipY texture
    if (this.tool === 'pick') { this._pick(px, py); return; }
    if (this.tool === 'fill') { this._bucket(px, py); this.texture.needsUpdate = true; return; }
    if (this.tool === 'heal') { this._heal(px, py); this.texture.needsUpdate = true; this._last = { px, py }; return; }
    if (this.tool === 'clone') {
      if (!this.cloneSrc) return;
      if (!this.cloneAnchor) this.cloneAnchor = { px, py };
      this._stampClone(px, py); this.texture.needsUpdate = true; this._last = { px, py }; return;
    }
    // brush / erase — interpolate along the drag so fast moves stay continuous
    if (this._last) { const dx = px - this._last.px, dy = py - this._last.py; const dist = Math.hypot(dx, dy);
      const step = Math.max(1, this.size * 0.18); const n = Math.ceil(dist / step);
      for (let i = 1; i <= n; i++) this._dab(this._last.px + dx * (i / n), this._last.py + dy * (i / n));
    } else this._dab(px, py);
    this._last = { px, py }; this.texture.needsUpdate = true;
  }

  _dab(px, py) {
    const g = this.texCtx; const r = this.size / 2;
    g.save();
    if (this.tool === 'erase') g.globalCompositeOperation = 'destination-out';
    const grad = g.createRadialGradient(px, py, r * this.hardness, px, py, r);
    const col = this.tool === 'erase' ? '0,0,0' : this._rgb(this.color);
    const op = this.opacity * (this._penFactor || 1);
    grad.addColorStop(0, 'rgba(' + col + ',' + op + ')');
    grad.addColorStop(1, 'rgba(' + col + ',0)');
    g.fillStyle = grad; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  _stampClone(px, py) {
    const snap = this._strokeSnap || this.texCanvas;
    const srcX = this.cloneSrc.u * this.texW, srcY = (1 - this.cloneSrc.v) * this.texH;
    const ox = srcX - this.cloneAnchor.px, oy = srcY - this.cloneAnchor.py;   // fixed offset src↔dst
    const r = this.size / 2; const g = this.texCtx;
    g.save(); g.globalAlpha = this.opacity;
    g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.clip();
    g.drawImage(snap, px + ox - r, py + oy - r, this.size, this.size, px - r, py - r, this.size, this.size);
    g.restore();
  }

  _rgb(hex) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255); }
  _pick(px, py) {
    const d = this.texCtx.getImageData(clamp(px | 0, 0, this.texW - 1), clamp(py | 0, 0, this.texH - 1), 1, 1).data;
    const hex = '#' + [d[0], d[1], d[2]].map(x => x.toString(16).padStart(2, '0')).join('');
    this.color = hex; if (this.onPickColor) this.onPickColor(hex); this._changed();
  }

  // flood fill by colour similarity (bounded scanline)
  _bucket(px, py) {
    px = clamp(px | 0, 0, this.texW - 1); py = clamp(py | 0, 0, this.texH - 1);
    const W = this.texW, H = this.texH; const img = this.texCtx.getImageData(0, 0, W, H); const d = img.data;
    const at = (x, y) => (y * W + x) * 4;
    const s = at(px, py); const sr = d[s], sg = d[s + 1], sb = d[s + 2];
    const fill = this.color; const n = parseInt(fill.slice(1), 16); const fr = (n >> 16) & 255, fg = (n >> 8) & 255, fb = n & 255;
    const tol = 42 * 42 * 3; const A = Math.round(this.opacity * 255);
    const near = (i) => { const dr = d[i] - sr, dg = d[i + 1] - sg, db = d[i + 2] - sb; return dr * dr + dg * dg + db * db <= tol; };
    if (!near(s) && sr === fr && sg === fg && sb === fb) return;
    const stack = [[px, py]]; const seen = new Uint8Array(W * H);
    while (stack.length) {
      const [x, y] = stack.pop(); let nx = x;
      while (nx >= 0 && near(at(nx, y))) nx--; nx++;
      let up = false, dn = false;
      while (nx < W && near(at(nx, y))) {
        const i = at(nx, y); const k = y * W + nx; if (seen[k]) { nx++; continue; } seen[k] = 1;
        d[i] = (fr * A + d[i] * (255 - A)) / 255; d[i + 1] = (fg * A + d[i + 1] * (255 - A)) / 255; d[i + 2] = (fb * A + d[i + 2] * (255 - A)) / 255; d[i + 3] = Math.max(d[i + 3], A);
        if (y > 0 && near(at(nx, y - 1))) { if (!up) { stack.push([nx, y - 1]); up = true; } } else up = false;
        if (y < H - 1 && near(at(nx, y + 1))) { if (!dn) { stack.push([nx, y + 1]); dn = true; } } else dn = false;
        nx++;
      }
    }
    this.texCtx.putImageData(img, 0, 0);
  }

  // cheap content-aware heal: replace a disc with a blur of the pixels around
  // its rim, diffused inward — hides seams/blemishes without heavy inpainting
  _heal(px, py) {
    const r = Math.round(this.size / 2); const x0 = clamp(px - r | 0, 0, this.texW - 1), y0 = clamp(py - r | 0, 0, this.texH - 1);
    const w = clamp(2 * r, 1, this.texW - x0), h = clamp(2 * r, 1, this.texH - y0);
    const img = this.texCtx.getImageData(x0, y0, w, h); const d = img.data; const cx = px - x0, cy = py - y0;
    const inside = (x, y) => { const dx = x - cx, dy = y - cy; return dx * dx + dy * dy <= r * r; };
    // seed from the rim, then relax interior toward neighbour average a few passes
    for (let pass = 0; pass < 10; pass++) {
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (!inside(x, y)) continue; const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) d[i + c] = (d[i - 4 + c] + d[i + 4 + c] + d[i - w * 4 + c] + d[i + w * 4 + c]) / 4;
        d[i + 3] = 255;
      }
    }
    this.texCtx.putImageData(img, x0, y0);
  }

  // ---------- undo ----------
  _pushHistory() {
    try { this.history.push(this.texCtx.getImageData(0, 0, this.texW, this.texH)); if (this.history.length > this.histMax) this.history.shift(); } catch (e) {}
  }
  _pushRedoClear() { this.redoStack = []; }
  undo() {
    if (this.history.length < 2) return false;   // keep the initial state
    this.redoStack.push(this.history.pop());
    const prev = this.history[this.history.length - 1];
    this.texCtx.putImageData(prev, 0, 0); this.texture.needsUpdate = true; this._changed(); return true;
  }
  redo() {
    if (!this.redoStack.length) return false;
    const img = this.redoStack.pop(); this.history.push(img);
    this.texCtx.putImageData(img, 0, 0); this.texture.needsUpdate = true; this._changed(); return true;
  }
  clearTexture(css) { this._pushHistory(); const g = this.texCtx; g.globalCompositeOperation = 'source-over'; g.fillStyle = css || '#d7cdbb'; g.fillRect(0, 0, this.texW, this.texH); this.texture.needsUpdate = true; this._changed(); }

  // ---------- export ----------
  exportPNG() { return new Promise(res => this.texCanvas.toBlob(b => res(b), 'image/png')); }
  async exportGLB() {
    const exp = new GLTFExporter();
    return await new Promise((res, rej) => exp.parse(this.model, (r) => res(r), (e) => rej(e), { binary: true }));
  }
  snapshot() { try { return this.canvas.toDataURL('image/png'); } catch (e) { return null; } }

  stats() { return { name: this.modelName, tris: this.tris, hasUVs: this.hasUVs, hadTexture: this.hadTexture, w: this.texW, h: this.texH }; }
  hasModel() { return !!this.model; }

  _loop() { requestAnimationFrame(this._loop); this.controls.update(); this.renderer.render(this.scene, this.camera); }
  dispose() { this._ro && this._ro.disconnect(); }
}
