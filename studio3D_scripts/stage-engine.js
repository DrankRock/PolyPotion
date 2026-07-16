// ============================================================
// stage-engine.js — STAGE  (StageEngine)
// Multi-character scene assembly. Drop several library characters and props
// onto one stage, place each on the ground, give each its OWN pose/clip, then
// export the whole composed scene as ONE glTF (with every actor's animation
// preserved). Turns a single-actor character suite into a diorama / cutscene
// maker; Director can then fly its camera through the finished set.
//
// Each actor is wrapped: holder (user transform) → norm (auto height/ground)
// → imported root. Selection + ground-drag move the holder; per-actor mixers
// play each clip at its own natural speed. Export clones every actor, prefixes
// its node names (a0_, a1_, …) so nothing collides, retargets that actor's
// clip tracks to the prefixed names, and packs one GLB.
//
// Loaded by dynamic import from Stage.dc.html, like the other engines.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';
import { clone as skeletonClone } from 'https://esm.sh/three@0.160.0/examples/jsm/utils/SkeletonUtils.js';
import { fetchAssetBuffer } from './chunk-loader.js';

const readVar = (n, fb) => { try { const v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return v || fb; } catch (e) { return fb; } };

export class StageEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(readVar('--viewport', '#16181c'));
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(readVar('--viewport', '#16181c')); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.03, 200);
    this.camera.position.set(4.5, 3.4, 6.5);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.9, 0);
    this.controls.minDistance = 0.6; this.controls.maxDistance = 60;

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x22262c, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.35); key.position.set(5, 9, 6);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 40;
    const R = 12; key.shadow.camera.left = -R; key.shadow.camera.right = R; key.shadow.camera.top = R; key.shadow.camera.bottom = -R;
    key.shadow.bias = -0.0008; this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x86a0d8, 0.45); fill.position.set(-6, 4, -5); this.scene.add(fill);

    this.grid = new THREE.GridHelper(40, 80, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.45; this.grid.material.transparent = true; this.scene.add(this.grid);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.26 }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.receiveShadow = true; this.scene.add(this.floor);
    this._groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    this.stageRoot = new THREE.Group(); this.scene.add(this.stageRoot);
    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.5, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(readVar('--accent', '#7c83ff')), transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthTest: false })
    );
    this.selRing.rotation.x = -Math.PI / 2; this.selRing.visible = false; this.selRing.renderOrder = 5; this.scene.add(this.selRing);

    this.actors = []; this._nextId = 0; this.selectedId = null;
    this.playing = true; this._addSlot = 0;

    this.onChange = null; this.onStatus = null;
    this._gltf = new GLTFLoader(); this._fbx = new FBXLoader();
    this._ray = new THREE.Raycaster(); this._ndc = new THREE.Vector2();
    this._drag = null;

    this._bindPointer();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._clock = new THREE.Clock();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__stageEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  count() { return this.actors.length; }

  // ---------------------------------------------------------- LOADING
  async addUrl(url, ext, opts, label) {
    const buf = await fetchAssetBuffer(url, opts);
    return this.addBuffer(buf, label || url.split('/').pop(), ext || (url.split('.').pop() || '').toLowerCase());
  }
  async addFile(file) { return this.addBuffer(await file.arrayBuffer(), file.name, (file.name.split('.').pop() || '').toLowerCase()); }

  async addBuffer(buf, name, ext) {
    ext = (ext || (name || '').split('.').pop() || 'glb').toLowerCase();
    this._status('Placing ' + (name || 'actor') + '…');
    let root, clips = [];
    try {
      if (ext === 'glb' || ext === 'gltf') { const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej)); root = g.scene || (g.scenes && g.scenes[0]); clips = g.animations || []; }
      else if (ext === 'fbx') { root = this._fbx.parse(buf, ''); clips = root.animations || []; }
      else throw new Error('Unsupported .' + ext);
    } catch (e) { this._status(''); throw e; }

    root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = true; } });
    root.updateMatrixWorld(true);

    // auto height + ground normalize into a `norm` group
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.7 / (size.y || 1);
    const norm = new THREE.Group();
    norm.scale.setScalar(s);
    norm.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
    norm.add(root);

    const holder = new THREE.Group();
    holder.name = 'actor_' + this._nextId;
    holder.add(norm);
    const p = this._slotPosition(this._addSlot++);
    holder.position.set(p.x, 0, p.z);
    this.stageRoot.add(holder);

    const mixer = clips.length ? new THREE.AnimationMixer(root) : null;
    let action = null;
    if (mixer && clips.length) { action = mixer.clipAction(clips[0]); action.play(); }

    const footR = Math.max(0.35, Math.max(size.x, size.z) * s * 0.55);
    const actor = {
      id: this._nextId++, name: (name || 'actor').replace(/\.(glb|gltf|fbx)$/i, ''),
      holder, norm, root, mixer, action, clips, clipIndex: clips.length ? 0 : -1,
      srcBuffer: buf.slice(0), ext, footR, rotY: 0, scale: 1,
    };
    this.actors.push(actor);
    this.select(actor.id);
    this._status(''); this._changed();
    return { id: actor.id, name: actor.name, clips: clips.length };
  }

  _slotPosition(i) {
    // widening rows of 4, centered, 1.5m spacing
    const perRow = 4, sp = 1.5;
    const col = i % perRow, row = Math.floor(i / perRow);
    return { x: (col - (perRow - 1) / 2) * sp, z: row * sp };
  }

  // ---------------------------------------------------------- SELECTION / TRANSFORM
  select(id) { this.selectedId = id; this._updateRing(); this._changed(); }
  _actor(id) { return this.actors.find(a => a.id === id); }
  selected() { return this._actor(this.selectedId); }

  _updateRing() {
    const a = this.selected();
    if (!a) { this.selRing.visible = false; return; }
    const wp = new THREE.Vector3(); a.holder.getWorldPosition(wp);
    this.selRing.position.set(wp.x, 0.012, wp.z);
    const r = a.footR * a.scale;
    this.selRing.scale.setScalar(r / 0.46);
    this.selRing.visible = true;
  }

  setPos(id, x, z) { const a = this._actor(id) || this.selected(); if (!a) return; if (x != null) a.holder.position.x = x; if (z != null) a.holder.position.z = z; this._updateRing(); this._changed(); }
  setRotY(id, deg) { const a = this._actor(id) || this.selected(); if (!a) return; a.rotY = deg; a.holder.rotation.y = deg * Math.PI / 180; this._changed(); }
  setScale(id, s) { const a = this._actor(id) || this.selected(); if (!a) return; a.scale = s; a.holder.scale.setScalar(s); this._updateRing(); this._changed(); }

  setActorClip(id, i) {
    const a = this._actor(id) || this.selected(); if (!a || !a.mixer) return;
    a.mixer.stopAllAction();
    if (i < 0) { a.clipIndex = -1; a.action = null; a.root.updateMatrixWorld(true); this._changed(); return; }
    a.action = a.mixer.clipAction(a.clips[i]); a.action.play(); a.clipIndex = i; this._changed();
  }

  duplicate(id) {
    const a = this._actor(id) || this.selected(); if (!a) return;
    this.addBuffer(a.srcBuffer.slice(0), a.name, a.ext).then((r) => {
      const nb = this._actor(r.id); if (!nb) return;
      nb.name = a.name; // keep base name; slot places it beside
      if (a.clipIndex >= 0 && nb.mixer) this.setActorClip(nb.id, a.clipIndex);
      nb.holder.rotation.y = a.holder.rotation.y; nb.rotY = a.rotY;
      nb.holder.scale.setScalar(a.scale); nb.scale = a.scale;
      this._changed();
    });
  }

  remove(id) {
    const idx = this.actors.findIndex(a => a.id === id); if (idx < 0) return;
    const a = this.actors[idx];
    if (a.mixer) { try { a.mixer.stopAllAction(); } catch (e) {} }
    this.stageRoot.remove(a.holder);
    a.holder.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this.actors.splice(idx, 1);
    if (this.selectedId === id) this.selectedId = this.actors.length ? this.actors[Math.max(0, idx - 1)].id : null;
    this._updateRing(); this._changed();
  }

  rename(id, name) { const a = this._actor(id); if (a) { a.name = name; this._changed(); } }

  // ---------------------------------------------------------- POINTER (select + ground-drag)
  _bindPointer() {
    const c = this.canvas;
    const toNdc = (e) => { const r = c.getBoundingClientRect(); this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    const hitActor = () => {
      this._ray.setFromCamera(this._ndc, this.camera);
      for (const a of this.actors) {
        const hits = this._ray.intersectObject(a.holder, true);
        if (hits.length) return { a, point: hits[0].point };
      }
      return null;
    };
    c.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;   // left only; right/middle = orbit/pan
      toNdc(e);
      const h = hitActor();
      if (h) {
        this.select(h.a.id);
        const gp = new THREE.Vector3(); this._ray.ray.intersectPlane(this._groundPlane, gp);
        this._drag = { a: h.a, offX: h.a.holder.position.x - gp.x, offZ: h.a.holder.position.z - gp.z };
        this.controls.enabled = false;
        c.setPointerCapture(e.pointerId);
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      toNdc(e); this._ray.setFromCamera(this._ndc, this.camera);
      const gp = new THREE.Vector3();
      if (this._ray.ray.intersectPlane(this._groundPlane, gp)) {
        this._drag.a.holder.position.x = gp.x + this._drag.offX;
        this._drag.a.holder.position.z = gp.z + this._drag.offZ;
        this._updateRing(); this._changed();
      }
    });
    const end = (e) => { if (this._drag) { this._drag = null; this.controls.enabled = true; try { c.releasePointerCapture(e.pointerId); } catch (_) {} } };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  }

  // ---------------------------------------------------------- TRANSPORT
  setPlaying(p) { this.playing = !!p; if (this.playing) this._clock.getDelta(); this._changed(); }
  resetTime() { this.actors.forEach(a => { if (a.mixer) a.mixer.setTime(0); }); }

  // ---------------------------------------------------------- VIEW
  frameAll() {
    if (!this.actors.length) { this.controls.target.set(0, 0.9, 0); this.camera.position.set(4.5, 3.4, 6.5); this.controls.update(); return; }
    const box = new THREE.Box3().setFromObject(this.stageRoot);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const r = Math.max(sz.x, sz.z, sz.y) * 0.5 || 2;
    this.controls.target.copy(c);
    this.camera.position.set(c.x + r * 1.4, c.y + r * 1.1 + 1, c.z + r * 2.2);
    this.controls.update();
  }
  setView(name) {
    const box = new THREE.Box3().setFromObject(this.stageRoot);
    const c = this.actors.length ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0.9, 0);
    const sz = this.actors.length ? box.getSize(new THREE.Vector3()) : new THREE.Vector3(3, 2, 3);
    const d = Math.max(sz.x, sz.z, 3) * 1.8;
    this.controls.target.copy(c);
    if (name === 'front') this.camera.position.set(c.x, c.y + 0.5, c.z + d);
    else if (name === 'side') this.camera.position.set(c.x + d, c.y + 0.5, c.z);
    else if (name === 'top') this.camera.position.set(c.x + 0.01, c.y + d, c.z + 0.01);
    else this.camera.position.set(c.x + d * 0.6, c.y + d * 0.45, c.z + d);
    this.controls.update();
  }

  // ---------------------------------------------------------- EXPORT ONE glTF
  // Clone every actor, prefix its node names (a{i}_) so nothing collides,
  // retarget that actor's clip tracks to the prefixed names, place the clone at
  // the actor's world transform, and pack the whole set + all clips into one GLB.
  async exportGLB() {
    if (!this.actors.length) throw new Error('Add at least one character first');
    this._status('Composing scene…');
    const out = new THREE.Group(); out.name = 'stage_scene';
    const allClips = [];
    for (let i = 0; i < this.actors.length; i++) {
      const a = this.actors[i];
      const prefix = 'a' + i + '_';
      const cl = skeletonClone(a.root);   // preserves skinning
      const map = {};
      cl.traverse(o => { const nn = prefix + (o.name || o.type); map[o.name] = nn; o.name = nn; });
      // wrap the clone so it carries the actor's world transform (holder * norm)
      const wrap = new THREE.Group();
      wrap.name = prefix + 'root';
      a.holder.updateWorldMatrix(true, false); a.norm.updateWorldMatrix(true, false);
      // holder transform
      wrap.position.copy(a.holder.position); wrap.quaternion.copy(a.holder.quaternion); wrap.scale.copy(a.holder.scale);
      const normWrap = new THREE.Group(); normWrap.name = prefix + 'norm';
      normWrap.position.copy(a.norm.position); normWrap.scale.copy(a.norm.scale);
      normWrap.add(cl); wrap.add(normWrap); out.add(wrap);
      // retarget this actor's active/assigned clip
      if (a.clipIndex >= 0 && a.clips[a.clipIndex]) {
        const src = a.clips[a.clipIndex];
        const tracks = src.tracks.map(t => {
          const dot = t.name.lastIndexOf('.');
          const node = t.name.slice(0, dot), prop = t.name.slice(dot);
          const nn = map[node] != null ? map[node] : prefix + node;
          const nt = t.clone(); nt.name = nn + prop; return nt;
        });
        allClips.push(new THREE.AnimationClip(prefix + (src.name || 'clip'), src.duration, tracks));
      }
    }
    this._status('Packing GLB…');
    const buf = await new Promise((res, rej) => new GLTFExporter().parse(out, res, rej, { binary: true, animations: allClips, onlyVisible: false, embedImages: true }));
    out.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    this._status('');
    return { buffer: buf, actors: this.actors.length, clips: allClips.length };
  }

  list() {
    return this.actors.map(a => ({
      id: a.id, name: a.name, selected: a.id === this.selectedId,
      clips: a.clips.map((c, i) => ({ i, name: c.name || ('Clip ' + (i + 1)) })),
      clipIndex: a.clipIndex, hasClips: a.clips.length > 0,
      posX: +a.holder.position.x.toFixed(2), posZ: +a.holder.position.z.toFixed(2),
      rotY: Math.round(a.rotY), scale: +a.scale.toFixed(2),
    }));
  }

  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return; requestAnimationFrame(this._loop);
    const dt = this._clock.getDelta();
    if (this.playing) { for (const a of this.actors) if (a.mixer) a.mixer.update(dt); }
    if (this.selRing.visible) { this.selRing.material.opacity = 0.6 + 0.35 * (0.5 + 0.5 * Math.sin(performance.now() / 320)); }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

export default StageEngine;
