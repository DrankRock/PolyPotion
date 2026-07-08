// ============================================================
// showcase-engine.js — SHOWCASE  (SCEngine)
// A turntable viewer for finished characters. Loads a model (GLB/FBX/OBJ)
// WITHOUT flattening it — the skeleton, skinned meshes and any embedded
// animation clips are kept intact so mocap'd characters just play. You can
// also drop in a clip from the animation library and it is retargeted onto
// the character's skeleton semantically, in world space — Mixamo, AutoRig and
// generic humanoid bone names all work, and hips travel is rescaled to fit.
// Loaded by dynamic import from Showcase.dc.html, like the other engines.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/OBJLoader.js';
import { RoomEnvironment } from 'https://esm.sh/three@0.160.0/examples/jsm/environments/RoomEnvironment.js';
import { fetchAssetBuffer } from './chunk-loader.js';
import { SHADER_PRESETS, buildShaderMaterial, presetDescriptors } from './shader-lib.js';

// simple wine/water-bottle silhouette for the demo-shape playground
function latheBottle() {
  const pts = [
    [0.0, 0.0], [0.42, 0.0], [0.44, 0.05], [0.44, 0.9], [0.30, 1.05],
    [0.16, 1.15], [0.14, 1.5], [0.17, 1.55], [0.17, 1.62], [0.0, 1.62],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 96);
}

// round-bottom alchemist flask — bulb + narrow neck + lip. Built for the
// gravity-liquid shaders (potion, lava lamp…): lots of volume to fill.
function latheFlask() {
  const pts = [new THREE.Vector2(0, 0.02)];
  for (let i = 0; i <= 22; i++) {
    const a = -Math.PI * 0.42 + (i / 22) * Math.PI * 0.86;
    pts.push(new THREE.Vector2(Math.cos(a) * 0.5, 0.52 + Math.sin(a) * 0.5));
  }
  pts.push(
    new THREE.Vector2(0.13, 1.12), new THREE.Vector2(0.12, 1.38),
    new THREE.Vector2(0.18, 1.42), new THREE.Vector2(0.18, 1.52),
    new THREE.Vector2(0.12, 1.54), new THREE.Vector2(0.0, 1.54));
  return new THREE.LatheGeometry(pts, 96);
}

// scratch objects for the per-frame gravity/slosh update (no allocs in loop)
const _gM3 = new THREE.Matrix3();
const _gDown = new THREE.Vector3();
const _gTmp = new THREE.Vector3();
const _gCamR = new THREE.Vector3();

const readVar = (name, fb) => {
  try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; }
  catch (e) { return fb; }
};

// ---------- canonical humanoid bone keys ----------
// Folds Mixamo (mixamorig:LeftForeArm, mixamorigLeftForeArm, mixamorig1:…),
// AutoRig (Elbow_L, Knee_R, Thumb1_L) and generic conventions (lowerarm_l,
// calf_r, thigh.L) onto one key space so skeletons can be matched semantically.
const CANON_CORE = {
  hips: 'hips', pelvis: 'hips',
  spine: 'spine', spine1: 'chest', spine01: 'chest', spine2: 'chest', spine02: 'chest', spine3: 'chest', chest: 'chest', upperchest: 'chest',
  neck: 'neck', neck1: 'neck', head: 'head',
  shoulder: 'SHOULDER?',                 // clavicle in Mixamo, upper arm in AutoRig — resolved per skeleton
  clavicle: 'clav', collar: 'clav',
  arm: 'uparm', upperarm: 'uparm',
  forearm: 'loarm', lowerarm: 'loarm', elbow: 'loarm',
  hand: 'hand', wrist: 'hand',
  upleg: 'upleg', upperleg: 'upleg', thigh: 'upleg',
  leg: 'loleg', lowerleg: 'loleg', calf: 'loleg', shin: 'loleg', knee: 'loleg',
  foot: 'foot', ankle: 'foot',
  toebase: 'toe', toe: 'toe', ball: 'toe',
};
['thumb', 'index', 'middle', 'ring', 'pinky'].forEach(f => {
  for (let i = 1; i <= 3; i++) { CANON_CORE['hand' + f + i] = f + i; CANON_CORE[f + i] = f + i; CANON_CORE[f + '0' + i] = f + i; }
});

function canonSide(raw) {
  let n = String(raw).replace(/^.*[|]/, '').replace(/^mixamorig\d*[:_]?/i, '').replace(/[\s:.]/g, '');
  let side = '', m;
  if (/^left[_\-]?/i.test(n)) { side = 'L'; n = n.replace(/^left[_\-]?/i, ''); }
  else if (/^right[_\-]?/i.test(n)) { side = 'R'; n = n.replace(/^right[_\-]?/i, ''); }
  else if ((m = n.match(/[_\-](l|r|left|right)$/i))) { side = m[1].charAt(0).toUpperCase(); n = n.slice(0, -m[0].length); }
  return { core: n.replace(/[_\-]/g, '').toLowerCase(), side };
}

// names[] → Map<canonicalKey, name>. 'shoulder' is clavicle when the skeleton
// also has a distinct upper-arm bone, otherwise it IS the upper arm (AutoRig).
function canonKeys(names) {
  const pending = [];
  let hasUparm = false;
  for (const nm of names) {
    const { core, side } = canonSide(nm);
    const c = CANON_CORE[core];
    if (!c) continue;
    if (c === 'uparm') hasUparm = true;
    pending.push([c, side, nm]);
  }
  const out = new Map();
  for (const [c, side, nm] of pending) {
    const key = (c === 'SHOULDER?' ? (hasUparm ? 'clav' : 'uparm') : c) + side;
    if (!out.has(key)) out.set(key, nm);
  }
  return out;
}

const BACKGROUNDS = {
  studio:  { top: '#2a2d33', bot: '#141518', grid: true },
  slate:   { top: '#3a4048', bot: '#1b1e22', grid: true },
  void:    { top: '#0c0c0e', bot: '#0c0c0e', grid: false },
  paper:   { top: '#e9e4d8', bot: '#cfc7b4', grid: true },
  dusk:    { top: '#3b2f4a', bot: '#171320', grid: true },
};

export class SCEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.01, 500);
    this.camera.position.set(1.8, 1.5, 3.4);
    this.perspCamera = this.camera;
    // orthographic twin for Blender's numpad-5 toggle (frustum synced on use)
    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 500);
    this.orthoCamera.position.copy(this.camera.position);
    this.isOrtho = false;
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.95, 0);
    // gentler, cursor-anchored zoom so a wheel notch can't fling the camera
    // super-far or clip inside the mesh (bounds are re-derived per model in frame())
    this.controls.zoomSpeed = 0.6;
    this.controls.zoomToCursor = true;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 20;
    this._installNavKeys(canvas);

    // lighting — warm key / cool rim, gentle fill
    const hemi = new THREE.HemisphereLight(0xeef2fb, 0x2b2f36, 0.95); this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(3, 6, 4);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 30;
    key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 5; key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.0008; this.scene.add(key); this.keyLight = key;
    const rim = new THREE.DirectionalLight(0x9fb6e8, 0.6); rim.position.set(-4, 3, -4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffe9cf, 0.4); fill.position.set(1, 1.2, -4); this.scene.add(fill);

    // ground + shadow catcher
    this.grid = new THREE.GridHelper(16, 32, 0x4b566a, 0x2a2f38);
    this.grid.material.opacity = 0.55; this.grid.material.transparent = true; this.scene.add(this.grid);
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.34 }));
    this.floor.rotation.x = -Math.PI / 2; this.floor.receiveShadow = true; this.scene.add(this.floor);

    this.wrap = new THREE.Group(); this.scene.add(this.wrap);   // holds the loaded model, scaled+centered
    this.model = null;
    this.mixer = null;
    this.clips = [];             // embedded AnimationClips
    this.actions = [];           // matching AnimationActions
    this.activeAction = null;
    this.skeleton = null;
    this.hasSkeleton = false;
    this.modelName = '';
    this.tris = 0; this.boneCount = 0;
    this.modelCenter = new THREE.Vector3(0, 0.95, 0);
    this.modelRadius = 1;

    this._shaderEntries = [];    // { mesh, material, uniforms, presetId, kind } — live shaders on meshes
    this._texMix = 1.0;          // how strongly a live shader is modulated by the mesh's own texture

    this.autoSpin = false;
    this.spinSpeed = 0.35;       // rad/s
    this.speed = 1.0;
    this.wire = false;
    this.playing = false;

    this._fbx = new FBXLoader();
    this._gltf = new GLTFLoader();
    this._obj = new OBJLoader();
    this.clock = new THREE.Clock();

    this.onStatus = null; this.onChange = null; this.onTime = null;

    this.setBackground('studio');

    // ---------- image-based lighting (IBL) ----------
    // Procedural HDRI-style environments, generated on-device (no external
    // files → stays offline). Feeds scene.environment so PBR materials pick up
    // real reflections + soft ambient — painted skin and bakes finally read as
    // lit, not flat. 'studio' uses three's RoomEnvironment (a softbox room).
    this._pmrem = new THREE.PMREMGenerator(this.renderer);
    this._pmrem.compileEquirectangularShader();
    this.envName = 'studio'; this.envIntensity = 0.75; this._envAsBg = false; this._envRT = null;
    this._shadowStrength = 0.34;
    this.setEnvironment('studio');

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__scEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }

  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.perspCamera.aspect = w / h; this.perspCamera.updateProjectionMatrix();
    this._updateOrthoFrustum();
  }

  // size the ortho frustum so it matches what the perspective camera frames at
  // the current orbit distance (keeps the toggle visually seamless)
  _updateOrthoFrustum() {
    const el = this.canvas.parentElement || this.canvas;
    const aspect = (el.clientWidth || 1) / (el.clientHeight || 1);
    const dist = this.camera.position.distanceTo(this.controls.target) || 1;
    const halfH = dist * Math.tan((this.perspCamera.fov * Math.PI / 180) / 2);
    const halfW = halfH * aspect;
    const o = this.orthoCamera;
    o.left = -halfW; o.right = halfW; o.top = halfH; o.bottom = -halfH;
    o.near = this.perspCamera.near; o.far = this.perspCamera.far;
    o.updateProjectionMatrix();
  }

  setBackground(name) {
    const b = BACKGROUNDS[name] || BACKGROUNDS.studio;
    this.bgName = name;
    // vertical gradient via a canvas texture
    const c = document.createElement('canvas'); c.width = 8; c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, b.top); grad.addColorStop(1, b.bot);
    g.fillStyle = grad; g.fillRect(0, 0, 8, 256);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = tex;
    const dark = name !== 'paper';
    this.grid.visible = b.grid && this._groundOn !== false;
    this.floor.visible = this._groundOn !== false;
    this.grid.material.color.set(dark ? 0x4b566a : 0x9a927e);
    this.grid.material.opacity = dark ? 0.55 : 0.4;
  }

  setGround(on) {
    this._groundOn = on;
    this.floor.visible = on;
    this.grid.visible = on && (BACKGROUNDS[this.bgName] || {}).grid !== false;
  }

  setWire(on) {
    this.wire = on;
    this.wrap.traverse(o => { if (o.isMesh && o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.wireframe = on; });
    }});
  }

  setAutoSpin(on) { this.autoSpin = on; }
  setSpinSpeed(v) { this.spinSpeed = v; }

  // ---------- capture ----------
  // A still PNG or a full 360° turntable WebM, rendered straight off the live
  // canvas (preserveDrawingBuffer is on). No upload, no watermark.
  snapshotPNG() {
    this.renderer.render(this.scene, this.camera);
    return new Promise(res => this.canvas.toBlob(b => res(b), 'image/png'));
  }
  async recordTurntable(opts) {
    opts = opts || {};
    if (!this.wrap) throw new Error('Load a character first');
    if (typeof MediaRecorder === 'undefined' || !this.canvas.captureStream) throw new Error('Video capture unsupported in this browser');
    const seconds = opts.seconds || 6;
    const fps = opts.fps || 30;
    const stream = this.canvas.captureStream(fps);
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : (MediaRecorder.isTypeSupported('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm');
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12000000 });
    const chunks = []; rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise(res => { rec.onstop = res; });
    const prevSpin = this.autoSpin; const startRot = this.wrap.rotation.y; this.autoSpin = false;
    this._capturing = true; rec.start();
    const t0 = performance.now();
    await new Promise(resolve => {
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0) / 1000 / seconds);
        this.wrap.rotation.y = startRot + p * Math.PI * 2;
        if (opts.onProgress) opts.onProgress(p);
        if (p >= 1) return resolve();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    this.wrap.rotation.y = startRot; this.autoSpin = prevSpin; this._capturing = false;
    rec.stop(); await stopped;
    return new Blob(chunks, { type: 'video/webm' });
  }
  setSpeed(v) { this.speed = v; if (this.mixer) this.mixer.timeScale = v; }

  // ---------- loading ----------
  clearModel() {
    if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; }
    if (this._shaderEntries && this._shaderEntries.length) {
      this._shaderEntries.forEach(e => { try { e.material && e.material.dispose && e.material.dispose(); } catch (_) {} });
    }
    this._shaderEntries = [];
    this._hasBaked = false; this._bakedMaps = [];
    if (this.model) { this.wrap.remove(this.model); this.model.traverse(o => { if (o.isMesh) { o.geometry && o.geometry.dispose(); } }); }
    this.model = null; this.clips = []; this.actions = []; this.activeAction = null;
    this.skeleton = null; this.hasSkeleton = false; this.boneCount = 0; this.tris = 0;
    this.wrap.position.set(0, 0, 0); this.wrap.scale.setScalar(1); this.wrap.rotation.set(0, 0, 0);
    this.playing = false;
  }

  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts || {});
    const name = (url.split('/').pop() || 'model');
    return this.loadBuffer(buf, name, (ext || name.split('.').pop() || 'glb'));
  }

  async loadFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const buf = ext === 'obj' || ext === 'gltf' ? await file.text() : await file.arrayBuffer();
    return this.loadBuffer(buf, file.name, ext);
  }

  async loadBuffer(buffer, name, ext) {
    ext = (ext || 'glb').toLowerCase();
    this.clearModel();
    this._status('Parsing ' + name + '…');
    let root = null, clips = [];
    if (ext === 'fbx') {
      root = this._fbx.parse(buffer, '');
      clips = root.animations || [];
    } else if (ext === 'glb' || ext === 'gltf') {
      const g = await new Promise((res, rej) => this._gltf.parse(buffer, '', res, rej));
      root = g.scene || (g.scenes && g.scenes[0]);
      clips = g.animations || [];
    } else if (ext === 'obj') {
      root = this._obj.parse(typeof buffer === 'string' ? buffer : new TextDecoder().decode(buffer));
    } else {
      throw new Error('Unsupported format: .' + ext);
    }
    if (!root) throw new Error('No scene found in ' + name);

    // stats + material tidy
    let tris = 0, bones = 0; let skeleton = null;
    root.traverse(o => {
      if (o.isMesh && o.geometry) {
        o.castShadow = true; o.receiveShadow = true;
        const pos = o.geometry.getAttribute('position');
        if (pos) tris += o.geometry.index ? o.geometry.index.count / 3 : pos.count / 3;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(m => { if (m) { m.side = THREE.DoubleSide; if ('wireframe' in m) m.wireframe = this.wire; if ('envMapIntensity' in m) m.envMapIntensity = this.envIntensity; } });
        o.userData._origMat = o.material;   // kept so a shader can be removed and the model restored
      }
      if (o.isBone) bones++;
      if (o.isSkinnedMesh && o.skeleton && !skeleton) skeleton = o.skeleton;
    });

    this.wrap.add(root);
    this.model = root;
    this.clips = clips;
    this.skeleton = skeleton;
    this.hasSkeleton = bones > 0 || !!skeleton;
    this.boneCount = bones;
    this.tris = Math.round(tris);
    this.modelName = name.replace(/\.(glb|gltf|fbx|obj)$/i, '');

    this._normalize();

    // mixer + embedded clips
    if (clips.length) {
      this.mixer = new THREE.AnimationMixer(root);
      this.mixer.timeScale = this.speed;
      this.actions = clips.map(c => this.mixer.clipAction(c));
    }

    this.frame();
    this._changed();
    this._status('');

    // auto-play the first embedded clip so mocap'd characters move on open
    if (this.actions.length) this.playClip(0);

    return {
      name: this.modelName, tris: this.tris, bones: this.boneCount,
      hasSkeleton: this.hasSkeleton,
      clips: this.clips.map((c, i) => ({ i, name: c.name || ('Clip ' + (i + 1)), duration: +(c.duration || 0).toFixed(2) })),
    };
  }

  // center on origin, scale to a friendly height, drop feet to the floor
  _normalize() {
    this.wrap.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.model);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const targetH = 1.8;
    const s = targetH / (size.y || 1);
    this.wrap.scale.setScalar(s);
    // recompute in scaled space, then recenter x/z and put min.y on ground
    this.wrap.position.set(0, 0, 0);
    this.wrap.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(this.model);
    const c2 = box2.getCenter(new THREE.Vector3());
    this.wrap.position.set(-c2.x, -box2.min.y, -c2.z);
    this.wrap.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(this.model);
    box3.getBoundingSphere(new THREE.Sphere(this.modelCenter, 1));
    const sph = box3.getBoundingSphere(new THREE.Sphere());
    this.modelCenter.copy(sph.center); this.modelRadius = sph.radius || 1;
    // ground follows
    this.grid.position.y = 0.001; this.floor.position.y = 0;
  }

  frame(view) {
    const c = this.modelCenter, r = this.modelRadius || 1;
    this.controls.target.copy(c);
    const dist = r * 2.7;
    const dirs = {
      persp: new THREE.Vector3(0.6, 0.32, 1).normalize(),
      front: new THREE.Vector3(0, 0, 1),
      back:  new THREE.Vector3(0, 0, -1),
      side:  new THREE.Vector3(1, 0, 0),
      top:   new THREE.Vector3(0, 1, 0.001),
    };
    const d = dirs[view] || dirs.persp;
    this.camera.position.copy(c).addScaledVector(d, dist);
    this.perspCamera.near = Math.max(0.01, r / 100); this.perspCamera.far = r * 100;
    this.controls.minDistance = r * 0.45;
    this.controls.maxDistance = r * 14;
    this.perspCamera.updateProjectionMatrix();
    this._updateOrthoFrustum();
    this.controls.update();
  }

  setView(v) { this.frame(v); }

  // ---------- Blender-style viewport navigation ----------
  toggleOrtho(force) {
    const want = force != null ? force : !this.isOrtho;
    if (want === this.isOrtho) return this.isOrtho;
    const from = this.camera, to = want ? this.orthoCamera : this.perspCamera;
    to.position.copy(from.position); to.quaternion.copy(from.quaternion);
    this.camera = to; this.controls.object = to;
    this.isOrtho = want;
    this._updateOrthoFrustum(); this.perspCamera.updateProjectionMatrix();
    this.controls.update(); this._changed();
    this._status(want ? 'Orthographic' : 'Perspective');
    return this.isOrtho;
  }
  // step-orbit the camera around the target (numpad 4/6/8/2), degrees
  orbitStep(azDeg, elDeg) {
    const c = this.controls.target;
    const off = this.camera.position.clone().sub(c);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.theta -= (azDeg || 0) * Math.PI / 180;
    sph.phi = Math.max(0.001, Math.min(Math.PI - 0.001, sph.phi - (elDeg || 0) * Math.PI / 180));
    off.setFromSpherical(sph);
    this.camera.position.copy(c).add(off);
    this.controls.update();
  }
  zoomStep(factor) {
    const c = this.controls.target;
    const off = this.camera.position.clone().sub(c);
    let len = off.length() * factor;
    len = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, len));
    off.setLength(len); this.camera.position.copy(c).add(off);
    this._updateOrthoFrustum(); this.controls.update();
  }
  _installNavKeys(canvas) {
    const typing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    this._navKeyHandler = (e) => {
      if (typing(e.target) || !this.model) return;
      const k = e.key, ctrl = e.ctrlKey || e.metaKey;
      const map = {
        '1': () => this.setView(ctrl ? 'back' : 'front'),
        '3': () => { this.frame(); this.camera.position.copy(this.modelCenter).addScaledVector(new THREE.Vector3(ctrl ? -1 : 1, 0, 0), this.modelRadius * 2.7); this.controls.update(); },
        '7': () => { this.frame(); this.camera.position.copy(this.modelCenter).addScaledVector(new THREE.Vector3(0, ctrl ? -1 : 1, 0.001), this.modelRadius * 2.7); this.controls.update(); },
        '5': () => this.toggleOrtho(),
        '4': () => this.orbitStep(-15, 0),
        '6': () => this.orbitStep(15, 0),
        '8': () => this.orbitStep(0, 15),
        '2': () => this.orbitStep(0, -15),
        '.': () => this.frame(),
        '+': () => this.zoomStep(1 / 1.15),
        '=': () => this.zoomStep(1 / 1.15),
        '-': () => this.zoomStep(1.15),
      };
      // accept both numpad (event.code NumpadN) and top-row digits
      const code = e.code || '';
      const numpad = code.startsWith('Numpad') ? code.slice(6) : null;
      const fn = map[numpad] || map[k];
      if (fn) { e.preventDefault(); fn(); }
    };
    window.addEventListener('keydown', this._navKeyHandler);
  }

  // ---------- embedded clip playback ----------
  playClip(i) {
    if (!this.mixer || !this.actions[i]) return;
    if (this.activeAction && this.activeAction !== this.actions[i]) { this._prevAction = this.activeAction; this.activeAction.fadeOut(0.25); }
    const a = this.actions[i];
    a.reset(); a.enabled = true; a.setEffectiveWeight(1); a.fadeIn(0.25); a.paused = false; a.play();
    this.activeAction = a; this.playing = true; this._changed();
  }

  togglePlay() {
    if (!this.activeAction) return;
    this.playing = !this.playing;
    this.activeAction.paused = !this.playing;
    this._changed();
  }

  pause() { if (this.activeAction) { this.activeAction.paused = true; } this.playing = false; this._changed(); }

  // crossfade weight between the previous clip and the current one (0 = all
  // previous, 1 = all current) — both actions keep playing, weights split
  setBlend(w) {
    const cur = this.activeAction, prev = this._prevAction;
    if (!cur || !prev || prev === cur) return;
    prev.stopFading(); cur.stopFading();
    prev.enabled = true; if (!prev.isRunning()) prev.play();
    prev.paused = false; cur.paused = false;
    prev.setEffectiveWeight(1 - w);
    cur.setEffectiveWeight(w);
    this.playing = true;
  }
  canBlend() { return !!(this.activeAction && this._prevAction && this._prevAction !== this.activeAction); }
  blendNames() {
    return {
      prev: this._prevAction ? (this._prevAction.getClip().name || 'previous') : '',
      cur: this.activeAction ? (this.activeAction.getClip().name || 'current') : '',
    };
  }

  stopAnim() {
    if (this.mixer) this.mixer.stopAllAction();
    this.activeAction = null; this._prevAction = null; this.playing = false;
    // reset to bind pose
    if (this.skeleton) this.skeleton.pose();
    this._changed();
  }

  seek(t) {
    if (this.activeAction) {
      const clip = this.activeAction.getClip();
      this.activeAction.time = Math.max(0, Math.min(clip.duration, t));
      this.mixer.update(0);
    }
  }

  clipInfo() {
    if (!this.activeAction) return null;
    const clip = this.activeAction.getClip();
    return { time: this.activeAction.time, duration: clip.duration, name: clip.name };
  }

  // ---------- external animation retargeting ----------
  // World-space delta retarget: bones are matched SEMANTICALLY (Mixamo names,
  // AutoRig names like Shoulder_R/Knee_L, and other humanoid conventions all
  // fold to the same canonical keys), rest orientations cancel out via
  //   worldDelta = srcAnim · srcRest⁻¹ ;  tgtWorld = worldDelta · tgtRest
  // and the hips position track is rescaled to the character's proportions so
  // jumps and travelling clips move it through space. Falls back to a direct
  // name-matched quaternion copy when the clip isn't a recognizable humanoid.
  async loadAnimUrl(url, ext, opts, label) {
    const buf = await fetchAssetBuffer(url, opts || {});
    return this.loadAnimBuffer(buf, label || url.split('/').pop(), (ext || url.split('.').pop() || 'fbx'));
  }

  async loadAnimBuffer(buffer, name, ext) {
    if (!this.hasSkeleton) throw new Error('This character has no skeleton to animate.');
    ext = (ext || 'fbx').toLowerCase();
    let srcRoot = null, clips = [];
    if (ext === 'fbx') {
      srcRoot = this._fbx.parse(buffer, '');
      clips = srcRoot.animations || [];
    } else if (ext === 'glb' || ext === 'gltf') {
      const g = await new Promise((res, rej) => this._gltf.parse(buffer, '', res, rej));
      srcRoot = g.scene || (g.scenes && g.scenes[0]) || null;
      clips = g.animations || [];
    } else {
      throw new Error('Animation must be .fbx / .glb / .gltf');
    }
    if (!clips.length) throw new Error('No animation clip found in ' + name);
    const clip = clips[0];
    const clipName = name.replace(/\.(fbx|glb|gltf)$/i, '');

    let result = srcRoot ? this._retargetWorldDelta(srcRoot, clip, clipName) : null;
    if (!result) result = this._retargetByName(clip, clipName);
    if (!result) throw new Error('No bones in common — this clip does not fit this character\u2019s skeleton.');
    const { retargeted, matched } = result;

    if (!this.mixer) { this.mixer = new THREE.AnimationMixer(this.model); this.mixer.timeScale = this.speed; }
    if (this.activeAction) { this._prevAction = this.activeAction; this.activeAction.fadeOut(0.25); }
    const action = this.mixer.clipAction(retargeted);
    action.reset(); action.fadeIn(0.25); action.play();
    // register so it shows up as the active clip
    this.clips.push(retargeted); this.actions.push(action);
    this.activeAction = action; this.playing = true;
    this._changed();
    return { name: retargeted.name, duration: +clip.duration.toFixed(2), matched, tracks: clip.tracks.length };
  }

  // semantic world-space retarget (handles differing bone names AND rest poses)
  _retargetWorldDelta(srcRoot, clip, clipName) {
    const tgtBones = [];                       // parent-first (traverse is DFS pre-order)
    this.model.traverse(o => { if (o.isBone) tgtBones.push(o); });
    if (!tgtBones.length) return null;

    // put the character in its bind pose and capture its rest transforms
    if (this.skeleton) this.skeleton.pose();
    this.model.updateMatrixWorld(true);
    const tgt = tgtBones.map(b => ({
      bone: b,
      restWorld: b.getWorldQuaternion(new THREE.Quaternion()),
      restLocal: b.quaternion.clone(),
    }));

    // source rest = the file's unanimated node pose (Mixamo ships a T-pose)
    srcRoot.updateMatrixWorld(true);
    const srcByName = new Map();
    srcRoot.traverse(o => { if (o.name && !srcByName.has(o.name)) srcByName.set(o.name, o); });

    const srcKeys = canonKeys([...srcByName.keys()]);
    const tgtKeys = canonKeys(tgtBones.map(b => b.name));

    const pairByTgt = new Map();               // tgt bone uuid -> { src, srcRest }
    let hipsPair = null;
    for (const [key, srcName] of srcKeys) {
      const tgtName = tgtKeys.get(key); if (!tgtName) continue;
      const s = srcByName.get(srcName);
      const t = tgtBones.find(b => b.name === tgtName);
      if (!s || !t) continue;
      const pair = { src: s, tgt: t, srcRest: s.getWorldQuaternion(new THREE.Quaternion()) };
      pairByTgt.set(t.uuid, pair);
      if (key === 'hips') hipsPair = pair;
    }
    if (pairByTgt.size < 3) return null;       // not a humanoid match → let name-copy try

    // ---- A/T-pose calibration ----
    // If the rigs rest in different poses (source T-pose vs target A-pose), a
    // raw delta transfer bakes that offset into every frame (sagging / lifted
    // arms). Correct each pair with C = quat(tgtRestDir → srcRestDir), so the
    // target adopts the clip's ABSOLUTE pose: world = delta · C · tgtRest.
    const boneChild = (b) => b.children.find(ch => ch.isBone) || b.children[0] || null;
    const dirOf = (b) => {
      const ch = boneChild(b); if (!ch) return null;
      const d = ch.getWorldPosition(new THREE.Vector3()).sub(b.getWorldPosition(new THREE.Vector3()));
      return d.lengthSq() > 1e-10 ? d.normalize() : null;
    };
    for (const pair of pairByTgt.values()) {
      const sd = dirOf(pair.src), td = dirOf(pair.tgt);
      const corr = new THREE.Quaternion();
      if (sd && td && sd.angleTo(td) > 0.03) corr.setFromUnitVectors(td, sd);
      pair.calRest = corr.multiply(pair.tgt.getWorldQuaternion(new THREE.Quaternion()));
    }

    // hips travel: world-space delta from the source rest, rescaled to the character
    let hipsData = null;
    if (hipsPair) {
      const srcRestPos = hipsPair.src.getWorldPosition(new THREE.Vector3());
      const tgtRestPos = hipsPair.tgt.getWorldPosition(new THREE.Vector3());
      const parent = hipsPair.tgt.parent;
      hipsData = {
        srcRestPos, tgtRestPos,
        scale: Math.abs(srcRestPos.y) > 1e-6 ? tgtRestPos.y / srcRestPos.y : 1,
        parentInv: parent ? new THREE.Matrix4().copy(parent.matrixWorld).invert() : new THREE.Matrix4(),
      };
    }

    // sample the source clip and re-solve our bones' local rotations per frame
    const mixer = new THREE.AnimationMixer(srcRoot);
    const action = mixer.clipAction(clip); action.play();
    const fps = 30, dur = clip.duration || 1;
    const frames = Math.max(2, Math.round(dur * fps));
    const times = new Float32Array(frames);
    const qbuf = tgt.map(() => new Float32Array(frames * 4));
    const pbuf = hipsData ? new Float32Array(frames * 3) : null;
    const worldQ = new Map();
    const wq = new THREE.Quaternion(), inv = new THREE.Quaternion(), v1 = new THREE.Vector3();
    for (let f = 0; f < frames; f++) {
      times[f] = f / fps;
      mixer.setTime(Math.min(dur, f / fps));
      srcRoot.updateMatrixWorld(true);
      worldQ.clear();
      for (let i = 0; i < tgt.length; i++) {
        const T = tgt[i], bone = T.bone, parent = bone.parent;
        const pWorld = (parent && worldQ.has(parent.uuid))
          ? worldQ.get(parent.uuid)
          : (parent ? parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion());
        const pair = pairByTgt.get(bone.uuid);
        let myWorld;
        if (pair) {
          pair.src.getWorldQuaternion(wq);
          inv.copy(pair.srcRest).invert();
          myWorld = new THREE.Quaternion().copy(wq).multiply(inv).multiply(pair.calRest || T.restWorld);   // delta · C · rest (pose-calibrated)
        } else {
          myWorld = new THREE.Quaternion().copy(pWorld).multiply(T.restLocal);             // hold rest locally
        }
        worldQ.set(bone.uuid, myWorld);
        const lq = new THREE.Quaternion().copy(pWorld).invert().multiply(myWorld);
        qbuf[i][f * 4] = lq.x; qbuf[i][f * 4 + 1] = lq.y; qbuf[i][f * 4 + 2] = lq.z; qbuf[i][f * 4 + 3] = lq.w;
      }
      if (pbuf) {
        hipsPair.src.getWorldPosition(v1).sub(hipsData.srcRestPos).multiplyScalar(hipsData.scale).add(hipsData.tgtRestPos);
        v1.applyMatrix4(hipsData.parentInv);
        pbuf[f * 3] = v1.x; pbuf[f * 3 + 1] = v1.y; pbuf[f * 3 + 2] = v1.z;
      }
    }
    action.stop(); mixer.uncacheClip(clip);

    const tracks = tgt.map((T, i) => new THREE.QuaternionKeyframeTrack(T.bone.name + '.quaternion', times, qbuf[i]));
    if (pbuf) tracks.push(new THREE.VectorKeyframeTrack(hipsPair.tgt.name + '.position', times, pbuf));
    return { retargeted: new THREE.AnimationClip(clipName, times[frames - 1], tracks), matched: pairByTgt.size };
  }

  // fallback: direct name-matched quaternion copy (identical skeletons only)
  _retargetByName(clip, clipName) {
    const norm = s => String(s).replace(/^mixamorig\d*[:_]?/i, '').replace(/[\s_:.-]/g, '').toLowerCase();
    const boneByNorm = new Map();
    this.model.traverse(o => { if (o.isBone) boneByNorm.set(norm(o.name), o.name); });
    const tracks = [];
    let matched = 0;
    for (const tr of clip.tracks) {
      const dot = tr.name.lastIndexOf('.');
      const node = tr.name.slice(0, dot), prop = tr.name.slice(dot + 1);
      if (prop !== 'quaternion') continue;
      const target = boneByNorm.get(norm(node));
      if (!target) continue;
      const nt = tr.clone(); nt.name = target + '.quaternion';
      tracks.push(nt); matched++;
    }
    if (!matched) return null;
    return { retargeted: new THREE.AnimationClip(clipName, clip.duration, tracks), matched };
  }

  // ---------- environment / IBL ----------
  ENV_LIST = ['studio', 'sunset', 'overcast', 'night', 'rim', 'none'];
  setEnvironment(name) {
    this.envName = name;
    if (this._envRT) { try { this._envRT.dispose(); } catch (e) {} this._envRT = null; }
    if (name === 'none') { this.scene.environment = null; if (this._envAsBg) this.setBackground(this.bgName); this._applyEnvIntensity(); this._changed && this._changed(); return; }
    let rt;
    try {
      if (name === 'studio') { rt = this._pmrem.fromScene(new RoomEnvironment(), 0.04); }
      else { const tex = this._equirect(name); rt = this._pmrem.fromEquirectangular(tex); tex.dispose(); }
    } catch (e) { this.scene.environment = null; return; }
    this._envRT = rt; this.scene.environment = rt.texture;
    if (this._envAsBg) this.scene.background = rt.texture;
    this._applyEnvIntensity();
    this._changed && this._changed();
  }
  // build a small equirectangular sky (gradient + sun/moon disc) for PMREM
  _equirect(name) {
    const W = 512, H = 256; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const P = {
      sunset:   { top: '#2a1e40', mid: '#c8532a', bot: '#f0a24a', horizon: '#ffb057', sun: '#fff2c8', sunX: 0.28, sunY: 0.62, sunR: 26, ground: '#241a12' },
      overcast: { top: '#c8ced6', mid: '#d9dee4', bot: '#e6e9ee', horizon: '#eef1f5', sun: '#ffffff', sunX: 0.7, sunY: 0.4, sunR: 60, ground: '#9aa0a6' },
      night:    { top: '#070b18', mid: '#0e1630', bot: '#1a2340', horizon: '#243056', sun: '#dfe6ff', sunX: 0.66, sunY: 0.3, sunR: 16, ground: '#0a0e18' },
      rim:      { top: '#0c0e12', mid: '#14171d', bot: '#191d24', horizon: '#2a3038', sun: '#bcd0ff', sunX: 0.9, sunY: 0.5, sunR: 40, ground: '#0a0c10' },
    }[name] || { top: '#334', mid: '#556', bot: '#778', horizon: '#99a', sun: '#fff', sunX: 0.5, sunY: 0.4, sunR: 40, ground: '#223' };
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, P.top); grad.addColorStop(0.42, P.mid); grad.addColorStop(0.5, P.horizon); grad.addColorStop(0.52, P.ground); grad.addColorStop(1, P.ground);
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    // sun/moon glow
    const sx = P.sunX * W, sy = P.sunY * H;
    const rg = g.createRadialGradient(sx, sy, 0, sx, sy, P.sunR * 3);
    rg.addColorStop(0, P.sun); rg.addColorStop(0.25, P.sun); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = rg; g.beginPath(); g.arc(sx, sy, P.sunR * 3, 0, 7); g.fill();
    if (name === 'rim') { const rg2 = g.createRadialGradient(0.08 * W, sy, 0, 0.08 * W, sy, P.sunR * 3); rg2.addColorStop(0, '#ffd2a8'); rg2.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg2; g.beginPath(); g.arc(0.08 * W, sy, P.sunR * 3, 0, 7); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(c); tex.mapping = THREE.EquirectangularReflectionMapping; tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
    return tex;
  }
  setEnvIntensity(v) { this.envIntensity = v; this._applyEnvIntensity(); }
  _applyEnvIntensity() { if (!this.wrap) return; this.wrap.traverse(o => { if (o.isMesh && o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if ('envMapIntensity' in m) { m.envMapIntensity = this.envIntensity; m.needsUpdate = true; } }); } }); }
  setEnvBackground(on) { this._envAsBg = !!on; if (on && this._envRT) this.scene.background = this._envRT.texture; else this.setBackground(this.bgName); }
  setShadowStrength(v) { this._shadowStrength = v; if (this.floor && this.floor.material) this.floor.material.opacity = v; }

  // ---------- demo shapes ----------
  // A quick primitive to play with when no model is loaded — a torus knot,
  // sphere, bottle (lathe), etc. Behaves like a loaded model so every shader
  // and capture tool works on it.
  loadDemo(kind) {
    this.clearModel();
    let geo;
    if (kind === 'sphere') geo = new THREE.SphereGeometry(0.72, 96, 64);
    else if (kind === 'torus') geo = new THREE.TorusGeometry(0.6, 0.26, 64, 128);
    else if (kind === 'bottle') geo = latheBottle();
    else if (kind === 'flask') geo = latheFlask();
    else if (kind === 'gem') { geo = new THREE.IcosahedronGeometry(0.72, 1).toNonIndexed(); geo.scale(1, 1.35, 1); }
    else if (kind === 'cube') geo = new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
    else if (kind === 'suzanne' || kind === 'blob') geo = new THREE.IcosahedronGeometry(0.75, 24);
    else { kind = 'knot'; geo = new THREE.TorusKnotGeometry(0.55, 0.2, 256, 40); }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.1, roughness: 0.55, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.name = kind; mesh.userData._origMat = mat;
    const root = new THREE.Group(); root.add(mesh);
    this.wrap.add(root);
    this.model = root;
    const pos = geo.getAttribute('position');
    this.tris = Math.round((geo.index ? geo.index.count : pos.count) / 3);
    this.modelName = 'Demo · ' + kind;
    this.skeleton = null; this.hasSkeleton = false; this.boneCount = 0;
    this.clips = []; this.actions = []; this.activeAction = null;
    this._normalize(); this.frame(); this._changed(); this._status('');
    return { name: this.modelName, tris: this.tris, bones: 0, hasSkeleton: false, clips: [] };
  }

  // ---------- shaders ----------
  shaderPresets() { return presetDescriptors(); }

  listMeshes() {
    const out = [];
    if (!this.model) return out;
    this.model.traverse(o => {
      if (o.isMesh && o.geometry) {
        const pos = o.geometry.getAttribute('position');
        const t = o.geometry.index ? o.geometry.index.count / 3 : (pos ? pos.count / 3 : 0);
        out.push({ uuid: o.uuid, name: o.name || 'mesh', tris: Math.round(t) });
      }
    });
    return out;
  }

  _targetMeshes(uuid) {
    const out = [];
    if (!this.model) return out;
    this.model.traverse(o => { if (o.isMesh && o.geometry) { if (!uuid || uuid === 'all' || o.uuid === uuid) out.push(o); } });
    return out;
  }

  _removeEntry(mesh) {
    const i = this._shaderEntries.findIndex(e => e.mesh === mesh);
    if (i >= 0) { const e = this._shaderEntries[i]; try { e.material && e.material.dispose && e.material.dispose(); } catch (_) {} this._shaderEntries.splice(i, 1); }
  }

  applyShader(id, values, targetUuid) {
    const preset = SHADER_PRESETS.find(p => p.id === id);
    if (!preset) return;
    const targets = this._targetMeshes(targetUuid);
    for (const mesh of targets) {
      this._removeEntry(mesh);
      // the mesh's OWN texture — shaders paint over it instead of replacing it.
      const om0 = Array.isArray(mesh.userData._origMat) ? mesh.userData._origMat[0] : mesh.userData._origMat;
      const baseMap = (om0 && om0.map) ? om0.map : null;
      let material, uniforms = null;
      if (preset.kind === 'physical') {
        material = preset.make();
        for (const p of preset.params) p.apply(material, (values && values[p.key] != null) ? values[p.key] : p.default);
        material.side = THREE.DoubleSide;
        if (baseMap) { material.map = baseMap; }   // keep the character's texture as albedo
        if ('envMapIntensity' in material) material.envMapIntensity = this.envIntensity;
      } else {
        const built = buildShaderMaterial(preset, values, baseMap, this._texMix);
        material = built.material; uniforms = built.uniforms;
      }
      material.wireframe = preset.wireframe || this.wire;
      mesh.material = material;
      const entry = { mesh, material, uniforms, presetId: id, kind: preset.kind, baseMap };
      // gravity presets: cache the local bbox corners + init the slosh spring
      if (preset.gravity && uniforms) {
        const g = mesh.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        const b = g.boundingBox;
        entry._corners = [];
        for (let i = 0; i < 8; i++) entry._corners.push(new THREE.Vector3(
          (i & 1) ? b.max.x : b.min.x, (i & 2) ? b.max.y : b.min.y, (i & 4) ? b.max.z : b.min.z));
        entry._g = { prev: new THREE.Vector3(0, -1, 0), p: new THREE.Vector3(), v: new THREE.Vector3() };
        entry.gravity = true;
      }
      this._shaderEntries.push(entry);
    }
    this._changed && this._changed();
  }

  setShaderParam(key, value) {
    for (const e of this._shaderEntries) {
      const preset = SHADER_PRESETS.find(p => p.id === e.presetId);
      const param = preset && (preset.params || []).find(p => p.key === key);
      if (!param) continue;
      if (e.kind === 'physical') { param.apply(e.material, value); e.material.needsUpdate = true; }
      else if (e.uniforms) {
        const u = e.uniforms['u_' + key];
        if (u) { if (param.type === 'color') u.value.set(value); else u.value = value; }
      }
    }
  }

  clearShader(targetUuid) {
    const targets = this._targetMeshes(targetUuid);
    for (const mesh of targets) {
      this._removeEntry(mesh);
      const orig = mesh.userData._origMat;
      if (orig) mesh.material = orig;
    }
    this.setWire(this.wire);
    this._applyEnvIntensity();
    this._changed && this._changed();
  }

  activeShaderFor(uuid) {
    if (uuid && uuid !== 'all') { const e = this._shaderEntries.find(x => x.mesh.uuid === uuid); return e ? e.presetId : null; }
    return this._shaderEntries.length ? this._shaderEntries[0].presetId : null;
  }

  // Does the target mesh(es) carry its own albedo texture? (drives the panel's
  // "blend over texture" control — a shader can only sit ON a texture if one exists.)
  targetHasTexture(uuid) {
    return this._targetMeshes(uuid).some(m => {
      const om = Array.isArray(m.userData._origMat) ? m.userData._origMat[0] : m.userData._origMat;
      return !!(om && om.map);
    });
  }

  // 0 = pure shader look, 1 = shader fully modulated by the mesh's own texture.
  setTextureBlend(v) {
    this._texMix = v;
    for (const e of this._shaderEntries) {
      if (e.kind === 'physical') {
        if (e.baseMap) { e.material.map = v > 0.02 ? e.baseMap : null; e.material.needsUpdate = true; }
      } else if (e.uniforms && e.uniforms.u_texMix) {
        e.uniforms.u_texMix.value = v;
      }
    }
    this._changed && this._changed();
  }

  // ---------- bake shader → texture ----------
  // Freeze the CURRENT look of a live shader (this exact frame — same u_time,
  // params, pose and viewing angle) into a UV-space texture, then swap the mesh
  // to an UNLIT material carrying that texture. The result exports as a plain
  // glTF that renders identically in any engine — no custom GLSL required.
  //
  // How: we reuse the shader's OWN vertex+fragment source and shared uniforms,
  // but rewrite the vertex shader's final line so gl_Position lands each vertex
  // at its UV coordinate (clip space). The fragment shader is untouched, so every
  // texel receives the shader's real output for that surface point. A second
  // 1.0-everywhere pass gives a coverage mask we dilate to kill UV seams.
  _dilateBuf(buf, mask, res, passes) {
    for (let pass = 0; pass < (passes || 4); pass++) {
      const add = [];
      for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
        const idx = y * res + x; if (mask[idx]) continue;
        let r = 0, g = 0, b = 0, a = 0, c = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= res || ny >= res) continue;
          const ni = ny * res + nx; if (mask[ni] === 1) { r += buf[ni * 4]; g += buf[ni * 4 + 1]; b += buf[ni * 4 + 2]; a += buf[ni * 4 + 3]; c++; }
        }
        if (c) add.push([idx, r / c, g / c, b / c, a / c]);
      }
      for (const [idx, r, g, b, a] of add) { buf[idx * 4] = r; buf[idx * 4 + 1] = g; buf[idx * 4 + 2] = b; buf[idx * 4 + 3] = a; mask[idx] = 1; }
      if (!add.length) break;
    }
  }

  _bakeOneEntry(entry, res) {
    const mesh = entry.mesh;
    if (!mesh.geometry.getAttribute('uv')) throw new Error((mesh.name || 'A mesh') + ' has no UVs — unwrap it in the UV tool first.');
    const src = entry.material;
    const patchedVert = src.vertexShader.replace(
      'gl_Position = projectionMatrix * viewMatrix * wp;',
      'gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);');
    const common = { uniforms: src.uniforms, vertexShader: patchedVert, side: THREE.DoubleSide, transparent: false, blending: THREE.NoBlending, depthTest: false, depthWrite: false };
    const bakeMat = new THREE.ShaderMaterial(Object.assign({}, common, { fragmentShader: src.fragmentShader }));
    const maskMat = new THREE.ShaderMaterial(Object.assign({}, common, { fragmentShader: 'void main(){ gl_FragColor = vec4(1.0); }' }));

    const rt = new THREE.WebGLRenderTarget(res, res, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, type: THREE.UnsignedByteType });
    const renderer = this.renderer;
    const prevRT = renderer.getRenderTarget();
    const prevBg = this.scene.background;
    const prevClear = renderer.getClearColor(new THREE.Color()); const prevClearA = renderer.getClearAlpha();
    const prevMat = mesh.material, prevCull = mesh.frustumCulled;

    // isolate: hide everything except this mesh, keep it in-place so its world
    // matrix, skinning and pose are exactly what the viewport shows
    const hidden = [];
    this.scene.traverse(o => { if (o !== mesh && o.visible && (o.isMesh || o.isLine || o.isPoints || o.isSprite)) { o.visible = false; hidden.push(o); } });
    this.scene.background = null;
    mesh.frustumCulled = false;
    renderer.setClearColor(0x000000, 0);

    const color = new Uint8Array(res * res * 4);
    const maskPx = new Uint8Array(res * res * 4);
    try {
      mesh.material = bakeMat;
      renderer.setRenderTarget(rt); renderer.clear(); renderer.render(this.scene, this.camera);
      renderer.readRenderTargetPixels(rt, 0, 0, res, res, color);
      mesh.material = maskMat;
      renderer.clear(); renderer.render(this.scene, this.camera);
      renderer.readRenderTargetPixels(rt, 0, 0, res, res, maskPx);
    } finally {
      mesh.material = prevMat; mesh.frustumCulled = prevCull;
      hidden.forEach(o => o.visible = true);
      this.scene.background = prevBg;
      renderer.setRenderTarget(prevRT);
      renderer.setClearColor(prevClear, prevClearA);
      rt.dispose(); bakeMat.dispose(); maskMat.dispose();
    }

    const N = res * res;
    const mask = new Uint8Array(N);
    for (let i = 0; i < N; i++) mask[i] = maskPx[i * 4] > 8 ? 1 : 0;
    this._dilateBuf(color, mask, res, 8);
    // GL reads bottom-up; write top-down so CanvasTexture's default flipY samples correctly
    const flipped = new Uint8ClampedArray(N * 4);
    const row = res * 4;
    for (let y = 0; y < res; y++) { const s = (res - 1 - y) * row; flipped.set(color.subarray(s, s + row), y * row); }
    const cv = document.createElement('canvas'); cv.width = cv.height = res;
    cv.getContext('2d').putImageData(new ImageData(flipped, res, res), 0, 0);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; tex.needsUpdate = true;
    return { tex, canvas: cv, transparent: !!src.transparent };
  }

  // Bake the active shader(s) into texture(s) and freeze the mesh to an unlit look.
  bakeShaderToTexture(opts) {
    opts = opts || {};
    const res = opts.res || 1024;
    const target = opts.target || 'all';
    const entries = this._shaderEntries.filter(e => e.kind !== 'physical' && (target === 'all' || e.mesh.uuid === target));
    if (!entries.length) throw new Error('Apply a shader first, then bake its current look.');
    const baked = [];
    for (const e of entries) {
      const out = this._bakeOneEntry(e, res);
      const mat = new THREE.MeshBasicMaterial({ map: out.tex, side: THREE.DoubleSide, transparent: out.transparent, alphaTest: out.transparent ? 0.02 : 0 });
      mat.toneMapped = false;
      e.mesh.userData._bakedMat = mat;
      e.mesh.userData._bakedCanvas = out.canvas;
      e.mesh.material = mat;
      baked.push({ uuid: e.mesh.uuid, name: e.mesh.name || 'shader', canvas: out.canvas });
    }
    // drop the live entries — the look is now frozen in the texture
    for (const e of entries.slice()) this._removeEntry(e.mesh);
    this._bakedMaps = baked;
    this._hasBaked = true;
    this._changed && this._changed();
    return { count: baked.length, res };
  }

  hasBakedShader() { return !!this._hasBaked; }
  bakedMaps() { return this._bakedMaps || []; }

  revertBaked() {
    if (!this.model) return;
    this.model.traverse(o => {
      if (o.userData && o.userData._bakedMat) {
        if (o.userData._origMat) o.material = o.userData._origMat;
        try { o.userData._bakedMat.map && o.userData._bakedMat.map.dispose(); o.userData._bakedMat.dispose(); } catch (_) {}
        delete o.userData._bakedMat; delete o.userData._bakedCanvas;
      }
    });
    this._hasBaked = false; this._bakedMaps = [];
    this.setWire(this.wire); this._applyEnvIntensity();
    this._changed && this._changed();
  }

  // Export the model (with baked unlit textures) as a .glb — loads in any engine.
  async exportBakedGLB() {
    if (!this._hasBaked || !this.model) throw new Error('Bake a shader first.');
    const { GLTFExporter } = await import('https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js');
    const exporter = new GLTFExporter();
    const out = await new Promise((res, rej) => exporter.parse(this.model, res, rej, {
      binary: true, onlyVisible: false, embedImages: true, animations: this.clips || [],
    }));
    return new Blob([out], { type: 'model/gltf-binary' });
  }

  // ---------- gravity liquids ----------
  // Per frame, per gravity-shader entry: transform world "down" into the mesh's
  // object space (so the liquid plane stays WORLD-level however the model is
  // rotated — turntable, mocap root motion, anything), project the cached bbox
  // corners onto the up axis for the fill range, and run a damped spring whose
  // impulses come from (a) rotation of the mesh and (b) camera-orbit speed.
  // Result lands in u_gravity / u_levMin / u_levMax / u_slosh / u_sloshMag.
  _updateGravity(e, dt) {
    const u = e.uniforms;
    if (!u.u_gravity || !e._corners) return;
    e.mesh.updateWorldMatrix(true, false);
    _gM3.setFromMatrix4(e.mesh.matrixWorld).invert();
    _gDown.set(0, -1, 0).applyMatrix3(_gM3).normalize();
    // fill range along current up axis (up·c == -down·c)
    let hMin = Infinity, hMax = -Infinity;
    for (const c of e._corners) { const h = -c.dot(_gDown); if (h < hMin) hMin = h; if (h > hMax) hMax = h; }
    // slosh spring
    const g = e._g;
    _gTmp.copy(_gDown).sub(g.prev); g.prev.copy(_gDown);
    g.v.addScaledVector(_gTmp, 14);                               // model-rotation impulse
    g.v.addScaledVector(_gTmp.copy(_gCamR).applyMatrix3(_gM3), 1); // camera-orbit impulse
    g.v.addScaledVector(g.p, -34 * dt);                           // spring toward flat
    g.v.multiplyScalar(Math.max(0, 1 - 2.4 * dt));                // damping
    g.p.addScaledVector(g.v, dt);
    g.p.addScaledVector(_gDown, -g.p.dot(_gDown));                // keep tilt ⟂ to down
    if (g.p.lengthSq() > 0.16) g.p.setLength(0.4);
    u.u_gravity.value.copy(_gDown);
    u.u_levMin.value = hMin; u.u_levMax.value = hMax;
    u.u_slosh.value.copy(g.p);
    u.u_sloshMag.value = Math.min(1, g.p.length() * 4 + g.v.length() * 0.15);
  }

  stats() {
    return { name: this.modelName, tris: this.tris, bones: this.boneCount, hasSkeleton: this.hasSkeleton, env: this.envName, envIntensity: this.envIntensity, envBg: this._envAsBg, shadow: this._shadowStrength };
  }
  hasModel() { return !!this.model; }

  snapshot() {
    try { return this.canvas.toDataURL('image/png'); } catch (e) { return null; }
  }

  _loop() {
    requestAnimationFrame(this._loop);
    const dt = this.clock.getDelta();
    if (this.autoSpin && this.wrap) this.wrap.rotation.y += this.spinSpeed * dt;
    if (this.mixer && this.playing) this.mixer.update(dt);
    if (this._shaderEntries.length) {
      const t = this.clock.elapsedTime;
      // camera-orbit impulse: swinging the view "swirls the room", so agitate
      // gravity liquids proportionally to azimuth speed — reads as sloshing.
      let az = 0, dAz = 0;
      try { az = this.controls.getAzimuthalAngle(); } catch (_) {}
      if (this._prevAz !== undefined) {
        dAz = az - this._prevAz;
        if (dAz > Math.PI) dAz -= Math.PI * 2; else if (dAz < -Math.PI) dAz += Math.PI * 2;
      }
      this._prevAz = az;
      _gCamR.setFromMatrixColumn(this.camera.matrixWorld, 0).multiplyScalar(dAz * 0.8);
      for (const e of this._shaderEntries) {
        if (e.uniforms && e.uniforms.u_time) e.uniforms.u_time.value = t;
        if (e.gravity && e.uniforms) this._updateGravity(e, Math.min(dt, 0.05));
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.onTime && this.activeAction && this.playing) {
      const info = this.clipInfo(); if (info) this.onTime(info);
    }
  }

  dispose() { this._ro && this._ro.disconnect(); if (this._navKeyHandler) window.removeEventListener('keydown', this._navKeyHandler); }
}
