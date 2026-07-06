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
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.2;
    this.controls.maxDistance = 60;

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
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
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
    this.camera.near = Math.max(0.01, r / 100); this.camera.far = r * 100;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  setView(v) { this.frame(v); }

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
      let material, uniforms = null;
      if (preset.kind === 'physical') {
        material = preset.make();
        for (const p of preset.params) p.apply(material, (values && values[p.key] != null) ? values[p.key] : p.default);
        material.side = THREE.DoubleSide;
        if ('envMapIntensity' in material) material.envMapIntensity = this.envIntensity;
      } else {
        const built = buildShaderMaterial(preset, values);
        material = built.material; uniforms = built.uniforms;
      }
      material.wireframe = preset.wireframe || this.wire;
      mesh.material = material;
      this._shaderEntries.push({ mesh, material, uniforms, presetId: id, kind: preset.kind });
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
      for (const e of this._shaderEntries) { if (e.uniforms && e.uniforms.u_time) e.uniforms.u_time.value = t; }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.onTime && this.activeAction && this.playing) {
      const info = this.clipInfo(); if (info) this.onTime(info);
    }
  }

  dispose() { this._ro && this._ro.disconnect(); }
}
