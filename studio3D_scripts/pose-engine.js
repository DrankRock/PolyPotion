// ============================================================
// POSE — ENGINE  (PEngine)
// Hand-pose a rigged character (GLB / FBX) with real inverse kinematics.
// Loads the skeleton (Mixamo + AutoRig naming, same resolver as mc-engine),
// drops draggable handles on every major joint and:
//   • IK   drag a wrist/ankle and a CCD solver bends the elbow/knee + shoulder
//          to follow it (with optional X-symmetry — mirror the drag to the
//          other side of the body)
//   • FK   drag head / chest / spine / hips / elbows / knees to rotate that
//          bone directly (camera-relative trackball)
//   • PRESETS  snap to T-pose, A-pose, relaxed, sit, wave, run, fight…
//   • MIRROR / RESET to the bind pose
// The skinned mesh deforms live as you pose. Loaded by dynamic import from
// Pose.dc.html, same pattern as the other engines.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { applyOrbitScheme } from './nav-scheme.js';
import { fetchAssetBuffer } from './chunk-loader.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const norm = (n) => (n || '').toLowerCase().replace(/mixamorig\d*/g, '').replace(/[\s_:.\-]/g, '');
const DEG = Math.PI / 180;
const COL = { ik: 0xe08534, fk: 0x4d82d6, sel: 0xffffff, hov: 0x43b6c4, root: 0x5aa86b, pole: 0x8a6bd8, pin: 0xe0d24f };

export class PEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})());
    window.addEventListener("studiothemechange", () => { try { this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})()); } catch(e){} });
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    this.camera.position.set(0.2, 1.1, 3.4);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.6; this.controls.maxDistance = 10;

    const hemi = new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0); this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.45); key.position.set(2.4, 4.2, 3.0);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 16;
    key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0009; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.5); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.3 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.gizmos = new THREE.Group(); this.scene.add(this.gizmos);

    this.model = null; this.meshes = []; this.skelHelper = null;
    this.boneByKey = {}; this.canon = {}; this.restQ = new Map();
    this.handles = [];           // {key,bone,type,chain,effector,mesh,label,side}
    this.pins = new Map();       // effector bone → pinned world Vector3 (foot-plant / hand-lock)
    this.poles = new Map();      // ik handle key → { pole:Vector3, mesh } (elbow/knee bend dir)
    this.selected = null; this.hovered = null;
    this.symmetry = true; this.showMesh = true; this.showSkel = true; this.xray = false;
    this.showPoles = true;       // pole markers visible + active
    this._pinRings = new Map();  // handle key → ring mesh marking a world-pinned effector
    this.modelName = ''; this.modelRadius = 1;

    this.onStatus = null; this.onChange = null; this.onLoaded = null;

    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader();
    this._ray = new THREE.Raycaster(); this._ray.params.Points = { threshold: 0.05 };
    this._ndc = new THREE.Vector2();
    this._drag = null;

    this._bindPointer();
    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return !!this.model; }

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
    else throw new Error('Unsupported .' + ext);
    this._clear();

    obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
    obj.updateMatrixWorld(true);

    this.meshes = []; const boneSet = new Set();
    obj.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.frustumCulled = false; this.meshes.push(o); } if (o.isBone) boneSet.add(o); });
    if (!boneSet.size) throw new Error('No skeleton in this file — Pose needs a rigged character');

    // normalize to ~1.8 tall, feet on ground
    const box = new THREE.Box3().setFromObject(obj); const size = box.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1); obj.scale.setScalar(s); obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj); const c = box2.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y; obj.updateMatrixWorld(true);
    this.root.add(obj); this.model = obj;
    this.modelName = (name || 'character').replace(/\.(glb|gltf|fbx)$/i, '');
    this.modelRadius = box2.getSize(new THREE.Vector3()).y || 1.8;

    // bone map + canonical resolve (Mixamo first, AutoRig second)
    this.boneByKey = {}; boneSet.forEach(b => { const k = norm(b.name); if (k && !this.boneByKey[k]) this.boneByKey[k] = b; });
    const resolve = (al) => { for (const a of al) if (this.boneByKey[a]) return this.boneByKey[a]; for (const a of al) for (const k in this.boneByKey) if (k === a || k.endsWith(a)) return this.boneByKey[k]; return null; };
    const C = {
      hips: resolve(['hips', 'pelvis', 'root']), spine: resolve(['spine', 'spine1']),
      chest: resolve(['spine2', 'chest', 'upperchest', 'spine1']), neck: resolve(['neck', 'neck1']), head: resolve(['head']),
      leftarm: resolve(['leftarm', 'leftupperarm', 'shoulderl']), rightarm: resolve(['rightarm', 'rightupperarm', 'shoulderr']),
      leftforearm: resolve(['leftforearm', 'leftlowerarm', 'elbowl']), rightforearm: resolve(['rightforearm', 'rightlowerarm', 'elbowr']),
      lefthand: resolve(['lefthand', 'wristl']), righthand: resolve(['righthand', 'wristr']),
      leftupleg: resolve(['leftupleg', 'leftupperleg', 'leftthigh', 'upperlegl']), rightupleg: resolve(['rightupleg', 'rightupperleg', 'rightthigh', 'upperlegr']),
      leftleg: resolve(['leftleg', 'leftlowerleg', 'leftshin', 'kneel']), rightleg: resolve(['rightleg', 'rightlowerleg', 'rightshin', 'kneer']),
      leftfoot: resolve(['leftfoot', 'anklel']), rightfoot: resolve(['rightfoot', 'ankler']),
    };
    this.canon = C;
    this._rigKind = (this.boneByKey['shoulderl'] || this.boneByKey['upperlegl']) && !this.boneByKey['leftarm'] ? 'autorig' : 'mixamo';
    // capture bind/rest local quaternions
    this.restQ = new Map(); Object.values(C).forEach(b => { if (b && !this.restQ.has(b)) this.restQ.set(b, b.quaternion.clone()); });
    if (C.hips) { this._hipsRestPos = C.hips.position.clone(); }
    // AutoRig faces away by default — spin to face camera
    if (this._rigKind === 'autorig') { this.root.rotation.y = Math.PI; }

    // skeleton helper
    this.skelHelper = new THREE.SkeletonHelper(this.model);
    this.skelHelper.material.linewidth = 2; this.skelHelper.material.transparent = true; this.skelHelper.material.opacity = 0.6;
    this.skelHelper.visible = this.showSkel; this.scene.add(this.skelHelper);

    this._buildHandles();
    this._applyLayers();
    this._frame();
    this._changed();
    this._status('');
    if (this.onLoaded) this.onLoaded();
    return this.stats();
  }

  _buildHandles() {
    this.handles.forEach(h => { this.gizmos.remove(h.mesh); h.mesh.geometry.dispose(); h.mesh.material.dispose(); });
    this.handles = [];
    const r = this.modelRadius * 0.026;
    const C = this.canon;
    const add = (key, bone, type, opts) => {
      if (!bone) return;
      opts = opts || {};
      const geo = new THREE.SphereGeometry(opts.big ? r * 1.35 : r, 16, 12);
      const mat = new THREE.MeshBasicMaterial({ color: type === 'ik' ? COL.ik : (opts.root ? COL.root : COL.fk), depthTest: false, transparent: true, opacity: 0.95 });
      const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 998;
      this.gizmos.add(mesh);
      this.handles.push({ key, bone, type, chain: opts.chain || null, effector: opts.effector || bone, mesh, label: opts.label || key, side: opts.side || null });
    };
    // IK effectors
    add('lwrist', C.lefthand, 'ik', { chain: [C.leftarm, C.leftforearm].filter(Boolean), effector: C.lefthand, label: 'Left wrist', side: 'left', big: true });
    add('rwrist', C.righthand, 'ik', { chain: [C.rightarm, C.rightforearm].filter(Boolean), effector: C.righthand, label: 'Right wrist', side: 'right', big: true });
    add('lankle', C.leftfoot, 'ik', { chain: [C.leftupleg, C.leftleg].filter(Boolean), effector: C.leftfoot, label: 'Left ankle', side: 'left', big: true });
    add('rankle', C.rightfoot, 'ik', { chain: [C.rightupleg, C.rightleg].filter(Boolean), effector: C.rightfoot, label: 'Right ankle', side: 'right', big: true });

    // FK joints
    add('hips', C.hips, 'fk', { root: true, big: true, label: 'Hips' });
    add('spine', C.spine, 'fk', { label: 'Spine' });
    add('chest', C.chest, 'fk', { label: 'Chest' });
    add('head', C.head, 'fk', { label: 'Head', big: true });
    add('lelbow', C.leftforearm, 'fk', { label: 'Left elbow', side: 'left' });
    add('relbow', C.rightforearm, 'fk', { label: 'Right elbow', side: 'right' });
    add('lshoulder', C.leftarm, 'fk', { label: 'Left shoulder', side: 'left' });
    add('rshoulder', C.rightarm, 'fk', { label: 'Right shoulder', side: 'right' });
    add('lknee', C.leftleg, 'fk', { label: 'Left knee', side: 'left' });
    add('rknee', C.rightleg, 'fk', { label: 'Right knee', side: 'right' });

    // pole targets for the two-bone limbs — a draggable marker that steers
    // which way the elbow / knee bends.
    this._buildPoles();
  }

  // one draggable pole per IK chain, seeded in front of / behind the mid joint
  // so the default bend is natural (elbows back, knees forward). Kept in world
  // space once built (like a Blender pole empty); the user drags it to adjust.
  _buildPoles() {
    (this.poles ? [...this.poles.values()] : []).forEach(p => { this.gizmos.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
    this.poles = new Map();
    const r = this.modelRadius * 0.02;
    const C = this.canon;
    const defs = [
      { key: 'lwrist', mid: C.leftforearm, root: C.leftarm, eff: C.lefthand, fwd: -1 },
      { key: 'rwrist', mid: C.rightforearm, root: C.rightarm, eff: C.righthand, fwd: -1 },
      { key: 'lankle', mid: C.leftleg, root: C.leftupleg, eff: C.leftfoot, fwd: 1 },
      { key: 'rankle', mid: C.rightleg, root: C.rightupleg, eff: C.rightfoot, fwd: 1 },
    ];
    defs.forEach(d => {
      if (!d.mid || !d.root || !d.eff) return;
      const midP = d.mid.getWorldPosition(new THREE.Vector3());
      const rootP = d.root.getWorldPosition(new THREE.Vector3());
      const effP = d.eff.getWorldPosition(new THREE.Vector3());
      // offset the pole away from the limb line, toward front (+Z) or back (−Z)
      const axis = effP.clone().sub(rootP).normalize();
      const zoff = new THREE.Vector3(0, 0, d.fwd).projectOnPlane(axis).normalize();
      if (!isFinite(zoff.x)) zoff.set(0, d.fwd, 0);
      const pole = midP.clone().addScaledVector(zoff, this.modelRadius * 0.22);
      const geo = new THREE.OctahedronGeometry(r * 1.5);
      const mat = new THREE.MeshBasicMaterial({ color: COL.pole, depthTest: false, transparent: true, opacity: 0.9 });
      const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 997; mesh.position.copy(pole); mesh.visible = this.showPoles;
      this.gizmos.add(mesh);
      this.poles.set(d.key, { key: d.key, pos: pole, mesh, chain: [d.root, d.mid], effector: d.eff, side: d.key[0] === 'l' ? 'left' : 'right', label: (d.key.includes('wrist') ? 'Elbow' : 'Knee') + ' pole' });
    });
  }

  // ---- pole constraint: rotate the chain root about the (root→effector) axis
  // so the mid joint swings toward the pole. The effector sits ON that axis, so
  // this never disturbs the reach it already has. ----
  _applyPole(chain, effector, poleP) {
    if (!chain || chain.length < 2 || !effector || !poleP) return;
    const root = chain[0], mid = chain[1];
    const rootP = root.getWorldPosition(new THREE.Vector3());
    const effP = effector.getWorldPosition(new THREE.Vector3());
    const midP = mid.getWorldPosition(new THREE.Vector3());
    const axis = effP.clone().sub(rootP);
    if (axis.lengthSq() < 1e-9) return; axis.normalize();
    const cur = midP.clone().sub(rootP); cur.addScaledVector(axis, -cur.dot(axis));
    const want = poleP.clone().sub(rootP); want.addScaledVector(axis, -want.dot(axis));
    if (cur.lengthSq() < 1e-8 || want.lengthSq() < 1e-8) return;
    cur.normalize(); want.normalize();
    const angle = Math.atan2(cur.clone().cross(want).dot(axis), cur.dot(want));
    if (Math.abs(angle) < 1e-4) return;
    this._applyWorldDelta(root, new THREE.Quaternion().setFromAxisAngle(axis, angle));
  }

  _frame() {
    const box = new THREE.Box3().setFromObject(this.model);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    this.controls.target.copy(c);
    const d = Math.max(sz.y, sz.x) * 1.9;
    this.camera.position.set(c.x + d * 0.25, c.y + sz.y * 0.12, c.z + d);
    this.controls.update();
  }

  // ---------------------------------------------------------- POINTER
  _bindPointer() {
    const c = this.canvas;
    const toNdc = e => { const r = c.getBoundingClientRect(); this._ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    c.addEventListener('pointermove', e => {
      toNdc(e);
      if (this._drag) { this._dragMove(e); return; }
      const h = this._pickHandle();
      const pole = h ? null : this._pickPole();
      const id = h ? h.key : (pole ? 'pole:' + pole.key : null);
      if (id !== this.hovered) { this.hovered = id; this._paintHandles(); c.style.cursor = id ? 'grab' : 'default'; }
    });
    c.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !this.model) return;
      toNdc(e);
      const h = this._pickHandle();
      if (!h) {
        const pole = this._pickPole();
        if (pole) {
          e.preventDefault();
          this.controls.enableRotate = false; c.style.cursor = 'grabbing';
          this.pushUndo();
          this._beginPole(pole);
          return;
        }
        return;
      }
      e.preventDefault();
      this.selected = h.key; this.controls.enableRotate = false; c.style.cursor = 'grabbing';
      this._paintHandles(); this._changed();
      if (h.type === 'ik') this._beginIK(h, e); else this._beginFK(h, e);
      this.pushUndo();
    });
    window.addEventListener('pointerup', () => { if (this._drag) { this._drag = null; this.controls.enableRotate = true; this.canvas.style.cursor = 'default'; this._changed(); } });
  }
  _pickHandle() {
    this._ray.setFromCamera(this._ndc, this.camera);
    const hits = this._ray.intersectObjects(this.handles.map(h => h.mesh), false);
    if (!hits.length) return null;
    return this.handles.find(h => h.mesh === hits[0].object) || null;
  }
  _pickPole() {
    if (!this.showPoles || !this.poles || !this.poles.size) return null;
    this._ray.setFromCamera(this._ndc, this.camera);
    const arr = [...this.poles.values()];
    const hits = this._ray.intersectObjects(arr.map(p => p.mesh), false);
    if (!hits.length) return null;
    return arr.find(p => p.mesh === hits[0].object) || null;
  }
  _paintHandles() {
    this.handles.forEach(h => {
      const base = h.type === 'ik' ? COL.ik : (h.key === 'hips' ? COL.root : COL.fk);
      const col = this.selected === h.key ? COL.sel : (this.hovered === h.key ? COL.hov : base);
      h.mesh.material.color.setHex(col);
      h.mesh.scale.setScalar(this.selected === h.key || this.hovered === h.key ? 1.25 : 1);
    });
  }

  // ---- IK drag : project pointer to a camera-parallel plane, CCD solve ----
  _beginIK(h, e) {
    const eff = h.effector.getWorldPosition(new THREE.Vector3());
    const n = this.camera.getWorldDirection(new THREE.Vector3());
    this._drag = { type: 'ik', h, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, eff), target: eff.clone() };
  }
  _dragMove(e) {
    const d = this._drag; if (!d) return;
    this._ray.setFromCamera(this._ndc, this.camera);
    if (d.type === 'ik') {
      const p = new THREE.Vector3();
      if (!this._ray.ray.intersectPlane(d.plane, p)) return;
      this._solveIK(d.h.chain, d.h.effector, p, 10, d.h.key);
      if (this.pins && this.pins.has(d.h.key)) this.pins.get(d.h.key).pos.copy(p);
      if (this.symmetry && d.h.side) {
        const mh = this._mirrorHandle(d.h);
        if (mh) {
          const mp = V(-p.x, p.y, p.z);
          this._solveIK(mh.chain, mh.effector, mp, 10, mh.key);
          if (this.pins && this.pins.has(mh.key)) this.pins.get(mh.key).pos.copy(mp);
        }
      }
      this._holdPins(d.h.key);
    } else if (d.type === 'pole') {
      const p = new THREE.Vector3();
      if (!this._ray.ray.intersectPlane(d.plane, p)) return;
      d.pl.pos.copy(p); d.pl.mesh.position.copy(p);
      this._applyPole(d.pl.chain, d.pl.effector, p);
      this._holdPins(null);
    } else if (d.type === 'fk') {
      const dx = (this._ndc.x - d.lastNdc.x), dy = (this._ndc.y - d.lastNdc.y);
      d.lastNdc.copy(this._ndc);
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const up = V(0, 1, 0);
      const q = new THREE.Quaternion()
        .setFromAxisAngle(up, dx * 3.0)
        .multiply(new THREE.Quaternion().setFromAxisAngle(right, -dy * 3.0));
      this._applyWorldDelta(d.h.bone, q);
      if (this.symmetry && d.h.side) {
        const mh = this._mirrorHandle(d.h);
        if (mh) { const qm = new THREE.Quaternion().setFromAxisAngle(up, -dx * 3.0).multiply(new THREE.Quaternion().setFromAxisAngle(right, -dy * 3.0)); this._applyWorldDelta(mh.bone, qm); }
      }
      this._holdPins(null);
    }
    this._changed();
  }
  _beginFK(h, e) { this._drag = { type: 'fk', h, lastNdc: this._ndc.clone() }; }
  _beginPole(pl) {
    const n = this.camera.getWorldDirection(new THREE.Vector3());
    this._drag = { type: 'pole', pl, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, pl.pos.clone()) };
  }
  _mirrorHandle(h) {
    if (!h.side) return null;
    const swap = h.key.replace(/^l/, '\u0000').replace(/^r/, 'l').replace(/^\u0000/, 'r');
    return this.handles.find(x => x.key === swap) || null;
  }

  // rotate a bone in WORLD space by qDelta (about the bone's own pivot)
  _applyWorldDelta(bone, qDelta) {
    const pw = new THREE.Quaternion(); (bone.parent || this.scene).getWorldQuaternion(pw);
    const bw = new THREE.Quaternion(); bone.getWorldQuaternion(bw);
    const newWorld = qDelta.clone().multiply(bw);
    bone.quaternion.copy(pw.invert().multiply(newWorld));
    bone.updateMatrixWorld(true);
  }

  // CCD inverse kinematics: rotate each bone in chain so `effector` reaches
  // `target`, then apply the pole constraint so the mid joint bends toward its
  // pole marker. `poleKey` (optional) names the pole to use.
  _solveIK(chain, effector, target, iterations, poleKey) {
    if (!chain || !chain.length || !effector) return;
    iterations = iterations || 10;
    const bonePos = new THREE.Vector3(), effPos = new THREE.Vector3();
    const toEff = new THREE.Vector3(), toTar = new THREE.Vector3();
    const q = new THREE.Quaternion();
    for (let it = 0; it < iterations; it++) {
      for (let i = chain.length - 1; i >= 0; i--) {
        const bone = chain[i]; if (!bone) continue;
        bone.getWorldPosition(bonePos);
        effector.getWorldPosition(effPos);
        toEff.subVectors(effPos, bonePos);
        toTar.subVectors(target, bonePos);
        if (toEff.lengthSq() < 1e-9 || toTar.lengthSq() < 1e-9) continue;
        toEff.normalize(); toTar.normalize();
        let dot = Math.max(-1, Math.min(1, toEff.dot(toTar)));
        if (dot > 0.99999) continue;
        q.setFromUnitVectors(toEff, toTar);
        // damp rotation per step for stability
        const ang = Math.acos(dot);
        const damp = Math.min(1, (0.5 + it * 0.06));
        if (damp < 1) q.slerp(new THREE.Quaternion(), 1 - damp);
        this._applyWorldDelta(bone, q);
        void ang;
      }
      effector.getWorldPosition(effPos);
      if (effPos.distanceToSquared(target) < 1e-6) break;
    }
    // pole pass — swing the bend toward the pole without moving the effector
    if (this.showPoles && poleKey && this.poles && this.poles.has(poleKey)) {
      const pl = this.poles.get(poleKey);
      this._applyPole(chain, effector, pl.pos);
    }
  }

  // hold every world-pinned effector at its pinned position. Called after any
  // pose change so a planted foot / locked hand stays put while you move the
  // hips or torso. Skips the handle currently being dragged.
  _holdPins(exceptKey) {
    if (!this.pins || !this.pins.size) return;
    this.pins.forEach((pin, key) => {
      if (key === exceptKey) return;
      this._solveIK(pin.chain, pin.effector, pin.pos, 8, key);
    });
  }
  // toggle a world pin on the selected IK effector
  togglePin(key) {
    key = key || this.selected;
    const h = this.handles.find(x => x.key === key);
    if (!h || h.type !== 'ik') return { pinned: false, ok: false };
    this.pins = this.pins || new Map();
    if (this.pins.has(key)) {
      this.pins.delete(key);
      const ring = this._pinRings.get(key);
      if (ring) { this.gizmos.remove(ring); ring.geometry.dispose(); ring.material.dispose(); this._pinRings.delete(key); }
      return { pinned: false, ok: true, label: h.label };
    }
    const pos = h.effector.getWorldPosition(new THREE.Vector3());
    this.pins.set(key, { pos, chain: h.chain, effector: h.effector });
    const r = this.modelRadius * 0.045;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.16, 8, 24), new THREE.MeshBasicMaterial({ color: COL.pin, depthTest: false, transparent: true, opacity: 0.95 }));
    ring.renderOrder = 999; this.gizmos.add(ring); this._pinRings.set(key, ring);
    return { pinned: true, ok: true, label: h.label };
  }
  isPinned(key) { return !!(this.pins && this.pins.has(key || this.selected)); }
  clearPins() {
    if (this.pins) this.pins.clear();
    this._pinRings.forEach(ring => { this.gizmos.remove(ring); ring.geometry.dispose(); ring.material.dispose(); });
    this._pinRings.clear();
  }
  setPolesVisible(on) {
    this.showPoles = !!on;
    if (this.poles) this.poles.forEach(p => { p.mesh.visible = this.showPoles; });
  }

  // ---------------------------------------------------------- POSE OPS
  // snapshot-based undo: capture every posed bone's local quaternion
  _snapshot() { const m = new Map(); this.restQ.forEach((q, bone) => m.set(bone, bone.quaternion.clone())); return m; }
  _applySnap(m) { if (!m) return; m.forEach((q, bone) => bone.quaternion.copy(q)); if (this.model) this.model.updateMatrixWorld(true); this.selected = null; this._paintHandles(); this._changed(); }
  pushUndo() { if (!this.model) return; this._undo = this._undo || []; this._undo.push(this._snapshot()); if (this._undo.length > 40) this._undo.shift(); this._redo = []; }
  undo() { if (!this._undo || !this._undo.length) return false; this._redo = this._redo || []; this._redo.push(this._snapshot()); this._applySnap(this._undo.pop()); return true; }
  redo() { if (!this._redo || !this._redo.length) return false; this._undo = this._undo || []; this._undo.push(this._snapshot()); this._applySnap(this._redo.pop()); return true; }

  resetPose() {
    this.restQ.forEach((q, bone) => bone.quaternion.copy(q));
    if (this.model) this.model.updateMatrixWorld(true);
    this.clearPins();
    this.selected = null; this._paintHandles(); this._changed();
  }
  // reflect right-side local rotations onto the left and vice-versa (approximate)
  mirrorPose() {
    const C = this.canon;
    const pairs = [['leftarm', 'rightarm'], ['leftforearm', 'rightforearm'], ['lefthand', 'righthand'], ['leftupleg', 'rightupleg'], ['leftleg', 'rightleg'], ['leftfoot', 'rightfoot']];
    const refl = q => new THREE.Quaternion(q.x, -q.y, -q.z, q.w);
    pairs.forEach(([l, r]) => {
      const bl = C[l], br = C[r]; if (!bl || !br) return;
      const ql = bl.quaternion.clone(), qr = br.quaternion.clone();
      bl.quaternion.copy(refl(qr)); br.quaternion.copy(refl(ql));
    });
    // spine/head: zero out yaw asymmetry by reflecting onto themselves
    ['spine', 'chest', 'neck', 'head', 'hips'].forEach(k => { const b = C[k]; if (b) { const q = b.quaternion; b.quaternion.set(q.x, -q.y, -q.z, q.w); } });
    if (this.model) this.model.updateMatrixWorld(true);
    this._changed();
  }

  // ---- saved poses (audit: "pose mirror + pose library") ----
  // capturePose(): canonical-key → local-quaternion snapshot. Portable across
  // rigs that share the canon map (mixamo/autorig), best within one rig family
  // since bind orientations differ. Joints still at rest are omitted.
  capturePose() {
    if (!this.model) return null;
    const out = {};
    Object.entries(this.canon).forEach(([key, bone]) => {
      if (!bone) return;
      const rest = this.restQ.get(bone), q = bone.quaternion;
      if (rest && Math.abs(q.x - rest.x) + Math.abs(q.y - rest.y) + Math.abs(q.z - rest.z) + Math.abs(q.w - rest.w) < 1e-4) return;
      out[key] = [+q.x.toFixed(5), +q.y.toFixed(5), +q.z.toFixed(5), +q.w.toFixed(5)];
    });
    return out;
  }
  // applyPoseData(data): bind pose + the saved local quaternions, undoable.
  applyPoseData(data) {
    if (!this.model || !data) return { applied: 0 };
    this.pushUndo();
    this.clearPins();
    this.restQ.forEach((q, bone) => bone.quaternion.copy(q));
    let applied = 0;
    Object.entries(data).forEach(([key, q]) => {
      const bone = this.canon[key];
      if (bone && Array.isArray(q) && q.length === 4) { bone.quaternion.set(q[0], q[1], q[2], q[3]).normalize(); applied++; }
    });
    this.model.updateMatrixWorld(true);
    this.selected = null; this._paintHandles(); this._changed();
    return { applied };
  }

  // aim a bone so the vector to its child points along a world-space direction
  _aim(parentKey, childKey, dir) {
    const C = this.canon;
    const bone = C[parentKey], child = C[childKey];
    if (!bone || !child) return;
    bone.updateWorldMatrix(true, false);
    const bp = bone.getWorldPosition(new THREE.Vector3());
    const cp = child.getWorldPosition(new THREE.Vector3());
    const cur = cp.sub(bp); if (cur.lengthSq() < 1e-9) return; cur.normalize();
    const want = new THREE.Vector3(dir[0], dir[1], dir[2]).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(cur, want);
    this._applyWorldDelta(bone, q);
  }
  applyPreset(name) {
    const P = POSES[name]; if (!P) return;
    this.pushUndo();
    this.clearPins();
    // start from bind, then aim each limb segment in order (parent before child)
    this.restQ.forEach((q, bone) => bone.quaternion.copy(q));
    if (this.model) this.model.updateMatrixWorld(true);
    (P.aim || []).forEach(([pk, ck, dir]) => this._aim(pk, ck, this._sideDir(dir)));
    if (this.model) this.model.updateMatrixWorld(true);
    this._changed();
  }
  // mixamo faces +Z with character-left on world -X; AutoRig is spun 180 via root.
  _sideDir(dir) { return dir; }

  // apply an arbitrary aim list (same shape as POSES[].aim) — used by text-to-pose.
  // Returns { applied } so callers can tell how much of the spec matched this rig.
  applyAimList(aim) {
    if (!this.model) return { applied: 0 };
    this.pushUndo();
    this.clearPins();
    this.restQ.forEach((q, bone) => bone.quaternion.copy(q));
    this.model.updateMatrixWorld(true);
    let applied = 0;
    (Array.isArray(aim) ? aim : []).forEach(a => {
      if (!Array.isArray(a) || a.length < 3) return;
      const pk = String(a[0]).toLowerCase().replace(/[^a-z]/g, '');
      const ck = String(a[1]).toLowerCase().replace(/[^a-z]/g, '');
      const dir = a[2];
      if (!this.canon[pk] || !this.canon[ck]) return;
      if (!Array.isArray(dir) || dir.length < 3 || dir.some(v => !isFinite(+v))) return;
      this._aim(pk, ck, [+dir[0], +dir[1], +dir[2]]);
      applied++;
    });
    this.model.updateMatrixWorld(true);
    this._changed();
    return { applied };
  }

  // ---------------------------------------------------------- VIEW / LAYERS
  setSymmetry(on) { this.symmetry = !!on; }
  setLayers(mesh, skel) { this.showMesh = mesh; this.showSkel = skel; this._applyLayers(); }
  setXray(on) { this.xray = !!on; this._applyLayers(); }
  _applyLayers() {
    this.meshes.forEach(m => {
      m.visible = this.showMesh;
      m.traverse && m.traverse(() => {});
      if (m.material) { const mm = Array.isArray(m.material) ? m.material : [m.material]; mm.forEach(x => { x.transparent = this.xray; x.opacity = this.xray ? 0.32 : 1; x.depthWrite = !this.xray; }); }
    });
    if (this.skelHelper) this.skelHelper.visible = this.showSkel || !this.showMesh;
    this.gizmos.visible = true;
  }
  setHandlesVisible(on) { this.gizmos.visible = !!on; }
  setView(name) {
    const box = new THREE.Box3().setFromObject(this.model);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    this.controls.target.copy(c); const d = Math.max(sz.y, sz.x) * 1.9;
    const set = (x, y, z) => this.camera.position.set(x, y, z);
    if (name === 'front') set(c.x, c.y, c.z + d);
    else if (name === 'side') set(c.x + d, c.y, c.z);
    else if (name === 'top') set(c.x + 0.001, c.y + d, c.z + 0.001);
    else if (name === 'back') set(c.x, c.y, c.z - d);
    else set(c.x + d * 0.25, c.y + sz.y * 0.12, c.z + d);
    this.controls.update();
  }
  frameModel() { this._frame(); }

  selInfo() {
    if (!this.selected) return null;
    const h = this.handles.find(x => x.key === this.selected); if (!h) return null;
    return { key: h.key, label: h.label, type: h.type, pinned: this.isPinned(h.key) };
  }
  stats() {
    return { name: this.modelName, bones: Object.keys(this.boneByKey).length, handles: this.handles.length, rig: this._rigKind || 'mixamo' };
  }

  _clear() {
    if (this.model) { this.root.remove(this.model); this.model = null; }
    if (this.skelHelper) { this.scene.remove(this.skelHelper); this.skelHelper = null; }
    this.handles.forEach(h => { this.gizmos.remove(h.mesh); h.mesh.geometry.dispose(); });
    if (this.poles) this.poles.forEach(p => { this.gizmos.remove(p.mesh); p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
    this.poles = new Map();
    if (this.clearPins) this.clearPins();
    this.handles = []; this.meshes = []; this.selected = null; this.hovered = null;
    this.root.rotation.set(0, 0, 0);
  }
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return; requestAnimationFrame(this._loop);
    // keep handles glued to their joints
    if (this.handles.length) { const p = new THREE.Vector3(); for (const h of this.handles) { h.bone.getWorldPosition(p); h.mesh.position.copy(p); } }
    // keep pin rings on their effectors, facing the camera
    if (this._pinRings && this._pinRings.size) {
      const p = new THREE.Vector3();
      this._pinRings.forEach((ring, key) => {
        const pin = this.pins && this.pins.get(key);
        if (pin && pin.effector) { pin.effector.getWorldPosition(p); ring.position.copy(p); ring.quaternion.copy(this.camera.quaternion); }
      });
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

// preset poses — rig-agnostic: aim each limb segment along a WORLD direction.
// L = character-left (≈ world −X facing +Z), R = +X. up=+Y, fwd=+Z.
const POSES = {
  reach: { aim: [
    ['leftarm', 'leftforearm', [-0.22, -0.12, 0.97]], ['leftforearm', 'lefthand', [-0.1, 0.0, 0.99]],
    ['rightarm', 'rightforearm', [0.22, -0.12, 0.97]], ['rightforearm', 'righthand', [0.1, 0.0, 0.99]],
  ] },
  relaxed: { aim: [
    ['leftarm', 'leftforearm', [-0.32, -0.93, 0.12]], ['leftforearm', 'lefthand', [-0.18, -0.86, 0.48]],
    ['rightarm', 'rightforearm', [0.32, -0.93, 0.12]], ['rightforearm', 'righthand', [0.18, -0.86, 0.48]],
  ] },
  sit: { aim: [
    ['leftupleg', 'leftleg', [-0.18, -0.32, 0.93]], ['leftleg', 'leftfoot', [-0.05, -0.97, 0.18]],
    ['rightupleg', 'rightleg', [0.18, -0.32, 0.93]], ['rightleg', 'rightfoot', [0.05, -0.97, 0.18]],
    ['leftarm', 'leftforearm', [-0.42, -0.86, 0.28]], ['leftforearm', 'lefthand', [-0.2, -0.6, 0.77]],
    ['rightarm', 'rightforearm', [0.42, -0.86, 0.28]], ['rightforearm', 'righthand', [0.2, -0.6, 0.77]],
    ['spine', 'chest', [0, 0.99, -0.12]],
  ] },
  wave: { aim: [
    ['rightarm', 'rightforearm', [0.74, 0.66, 0.1]], ['rightforearm', 'righthand', [0.42, 0.9, 0.1]],
    ['leftarm', 'leftforearm', [-0.42, -0.9, 0.08]], ['leftforearm', 'lefthand', [-0.42, -0.9, 0.08]],
    ['neck', 'head', [0.16, 0.97, 0.05]],
  ] },
  run: { aim: [
    ['leftupleg', 'leftleg', [-0.05, -0.55, 0.83]], ['leftleg', 'leftfoot', [-0.05, -0.78, 0.0]],
    ['rightupleg', 'rightleg', [0.05, -0.78, -0.6]], ['rightleg', 'rightfoot', [0.05, -0.55, 0.2]],
    ['leftarm', 'leftforearm', [-0.34, -0.5, -0.5]], ['leftforearm', 'lefthand', [-0.2, 0.2, 0.95]],
    ['rightarm', 'rightforearm', [0.34, -0.5, 0.6]], ['rightforearm', 'righthand', [0.2, 0.3, 0.9]],
    ['spine', 'chest', [0, 0.96, 0.26]],
  ] },
  fight: { aim: [
    ['leftarm', 'leftforearm', [-0.4, -0.62, 0.55]], ['leftforearm', 'lefthand', [-0.16, 0.42, 0.9]],
    ['rightarm', 'rightforearm', [0.34, -0.66, 0.5]], ['rightforearm', 'righthand', [0.1, 0.5, 0.86]],
    ['leftupleg', 'leftleg', [-0.2, -0.95, 0.2]], ['rightupleg', 'rightleg', [0.2, -0.95, -0.2]],
    ['spine', 'chest', [0.12, 0.97, 0.06]],
  ] },
  cheer: { aim: [
    ['leftarm', 'leftforearm', [-0.5, 0.86, 0.05]], ['leftforearm', 'lefthand', [-0.5, 0.86, 0.05]],
    ['rightarm', 'rightforearm', [0.5, 0.86, 0.05]], ['rightforearm', 'righthand', [0.5, 0.86, 0.05]],
    ['neck', 'head', [0, 0.99, 0.1]],
  ] },
};

export default PEngine;
