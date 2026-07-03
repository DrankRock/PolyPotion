// MoCap 3D engine — loads rigged FBX/GLB characters (keeping their skeleton)
// and retargets MediaPipe pose world-landmarks onto Mixamo-named bones.
import * as THREE from 'https://esm.sh/three@0.160.0';
import { fetchAssetBuffer } from './chunk-loader.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const norm = (n) => (n || '').toLowerCase().replace(/mixamorig\d*/g, '').replace(/[\s_:.\-]/g, '');

// canonical key -> [parentLandmarkIdx, childLandmarkIdx] for aim retarget
const SEG = {
  leftarm: [11, 13], leftforearm: [13, 15],
  rightarm: [12, 14], rightforearm: [14, 16],
  leftupleg: [23, 25], leftleg: [25, 27],
  rightupleg: [24, 26], rightleg: [26, 28],
};
const PROC_ORDER = ['leftarm', 'rightarm', 'leftupleg', 'rightupleg', 'leftforearm', 'rightforearm', 'leftleg', 'rightleg'];

export class MCEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})());
    window.addEventListener("studiothemechange", () => { try { this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})()); } catch(e){} });
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    this.camera.position.set(0, 1.1, 3.4);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 1.2; this.controls.maxDistance = 8;

    const hemi = new THREE.HemisphereLight(0xdfe7f2, 0x2a2d33, 1.05);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(2.5, 4, 3); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6f8fd0, 0.7); rim.position.set(-3, 2, -2); this.scene.add(rim);

    const grid = new THREE.GridHelper(8, 16, 0x3a4150, 0x23272e);
    grid.material.opacity = 0.5; grid.material.transparent = true;
    this.scene.add(grid); this.grid = grid;

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.boneByKey = {}; this.driven = []; this.hips = null; this.spineBones = []; this.headBone = null; this.neckBone = null;
    this.skelHelper = null; this.meshes = [];
    this.retarget = true; this.smooth = 0.6; this.showMesh = true; this.showSkel = false;
    this.mirror = true; this.hipYaw = true;
    this.visThresh = 0.5; this.footLock = true; this.facingDeg = 0;
    this.handBones = { left: null, right: null };
    this._prev = new Map();
    this._tmpA = new THREE.Vector3(); this._tmpB = new THREE.Vector3();
    this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion();
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader();

    this._ro = new ResizeObserver(() => this.resize());
    this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true;
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = el.clientWidth || 400, h = el.clientHeight || 400;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts);
    return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase());
  }
  async loadFile(file) {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const buf = await file.arrayBuffer();
    return this._ingest(buf, ext);
  }

  async _ingest(buf, ext) {
    let obj;
    if (ext === 'fbx') obj = this._fbx.parse(buf, '');
    else if (ext === 'glb' || ext === 'gltf') {
      const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej));
      obj = g.scene || (g.scenes && g.scenes[0]);
    } else throw new Error('Unsupported .' + ext);
    this._clear();

    // reset any embedded pose to bind
    obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
    obj.updateMatrixWorld(true);

    // collect meshes + bones
    this.meshes = []; const boneSet = new Set();
    obj.traverse(o => {
      if (o.isMesh || o.isSkinnedMesh) { o.frustumCulled = false; this.meshes.push(o); }
      if (o.isBone) boneSet.add(o);
    });

    // normalize & scale to ~1.8 units tall, feet on ground
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1);
    obj.scale.setScalar(s);
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = box2.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= box2.min.y;
    obj.updateMatrixWorld(true);

    this.root.add(obj); this.model = obj;

    // map bones by raw normalized name
    this.boneByKey = {};
    boneSet.forEach(b => { const k = norm(b.name); if (k && !this.boneByKey[k]) this.boneByKey[k] = b; });

    // resolve a canonical slot from a priority list of normalized aliases (exact, then suffix/contains).
    // Mixamo names listed FIRST so they win; AutoRig (Shoulder/Elbow/Wrist/UpperLeg/Knee/Ankle) names second.
    const resolve = (aliases) => {
      for (const a of aliases) { if (this.boneByKey[a]) return this.boneByKey[a]; }
      for (const a of aliases) {
        for (const k in this.boneByKey) { if (k === a || k.endsWith(a)) return this.boneByKey[k]; }
      }
      return null;
    };
    // canonical limb/spine map covering Mixamo + AutoRig conventions
    const C = {
      hips:        resolve(['hips', 'pelvis', 'root']),
      spine:       resolve(['spine', 'spine1']),
      chest:       resolve(['spine2', 'chest', 'upperchest', 'spine1']),
      neck:        resolve(['neck', 'neck1']),
      head:        resolve(['head']),
      leftarm:     resolve(['leftarm', 'leftupperarm', 'shoulderl', 'leftshoulderupper']),
      rightarm:    resolve(['rightarm', 'rightupperarm', 'shoulderr']),
      leftforearm: resolve(['leftforearm', 'leftlowerarm', 'elbowl']),
      rightforearm:resolve(['rightforearm', 'rightlowerarm', 'elbowr']),
      lefthand:    resolve(['lefthand', 'wristl']),
      righthand:   resolve(['righthand', 'wristr']),
      leftupleg:   resolve(['leftupleg', 'leftupperleg', 'leftthigh', 'upperlegl']),
      rightupleg:  resolve(['rightupleg', 'rightupperleg', 'rightthigh', 'upperlegr']),
      leftleg:     resolve(['leftleg', 'leftlowerleg', 'leftshin', 'leftcalf', 'kneel']),
      rightleg:    resolve(['rightleg', 'rightlowerleg', 'rightshin', 'rightcalf', 'kneer']),
      leftfoot:    resolve(['leftfoot', 'anklel']),
      rightfoot:   resolve(['rightfoot', 'ankler']),
    };
    this.canon = C;
    this.hips = C.hips; this.headBone = C.head; this.neckBone = C.neck;
    this._rigKind = (this.boneByKey['shoulderl'] || this.boneByKey['upperlegl']) && !this.boneByKey['leftarm'] ? 'autorig' : 'mixamo';
    // AutoRig exports face away from camera by default; flip to face the user
    this.facingDeg = this._rigKind === 'autorig' ? 180 : 0;

    // build driven segment list with rest data, using canonical slots
    this.driven = [];
    for (const key of PROC_ORDER) {
      const bone = C[key]; if (!bone) continue;
      const child = bone.children.find(c => c.isBone);
      if (!child) continue;
      this.driven.push({ key, bone, child, seg: SEG[key], rest: bone.quaternion.clone() });
    }
    this._prev = new Map();
    this.driven.forEach(d => this._prev.set(d.bone, d.bone.quaternion.clone()));
    if (this.hips) this._hipsRest = this.hips.quaternion.clone();

    // ---- foot-lock reference data (captured in bind pose, feet on ground) ----
    this._flBase = obj.position.clone();          // normalized resting position
    this._flExtra = new THREE.Vector3();          // our grounding correction
    this._flAnchor = null; this._flFootKey = null;
    this._flFeet = [];
    [['left', C.leftfoot], ['right', C.rightfoot]].forEach(([side, b]) => {
      if (!b) return;
      const toe = b.children.find(ch => ch.isBone) || null;   // toe sits closer to the sole
      const restY = (toe || b).getWorldPosition(new THREE.Vector3()).y;
      this._flFeet.push({ side, bone: b, toe, restY });
    });

    // finger bone chains — Mixamo (3 phalanges) OR AutoRig (1 bone per finger)
    const fingerNames = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    const buildHand = (side) => {
      const root = C[side + 'hand'];
      if (!root) return null;
      const sideLetter = side === 'left' ? 'l' : 'r';
      const fingers = {};
      let any = false, single = false;
      for (const fn of fingerNames) {
        const chain = [];
        // Mixamo: LeftHandIndex1..3
        for (let i = 1; i <= 4; i++) {
          const b = this.boneByKey[side + 'hand' + fn + i];
          if (b) chain.push({ bone: b, rest: b.quaternion.clone() });
        }
        // AutoRig multi-bone: Index1_L..Index3_L  (norm => "index1l","index2l","index3l")
        if (!chain.length) {
          for (let i = 1; i <= 4; i++) {
            const b = this.boneByKey[fn + i + sideLetter];
            if (b) chain.push({ bone: b, rest: b.quaternion.clone() });
          }
        }
        // AutoRig single bone: Index_L (norm => "indexl")
        if (!chain.length) {
          const b = this.boneByKey[fn + sideLetter];
          if (b) { chain.push({ bone: b, rest: b.quaternion.clone() }); single = true; }
        }
        if (chain.length) { fingers[fn] = chain; any = true; }
      }
      return { root, rootRest: root.quaternion.clone(), fingers, hasFingers: any, single };
    };
    this.handBones = { left: buildHand('left'), right: buildHand('right') };
    if (this.handBones.left && this.handBones.left.root) this._prev.set(this.handBones.left.root, this.handBones.left.root.quaternion.clone());
    if (this.handBones.right && this.handBones.right.root) this._prev.set(this.handBones.right.root, this.handBones.right.root.quaternion.clone());

    // skeleton helper
    const sk = this.meshes.find(m => m.isSkinnedMesh);
    this.skelHelper = new THREE.SkeletonHelper(this.model);
    this.skelHelper.material.linewidth = 2;
    this.skelHelper.visible = this.showSkel;
    this.scene.add(this.skelHelper);

    this.applyLayers();
    this.setFacing(this.facingDeg);
    this.frame(box2.getSize(new THREE.Vector3()));
    return {
      bones: boneSet.size,
      mapped: Object.keys(this.boneByKey).length,
      driven: this.driven.length,
      meshes: this.meshes.length,
      hasSkeleton: !!sk,
      hasFingers: !!((this.handBones.left && this.handBones.left.hasFingers) || (this.handBones.right && this.handBones.right.hasFingers)),
      rigKind: this._rigKind,
    };
  }

  frame() {
    const box = new THREE.Box3().setFromObject(this.model);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    this.controls.target.set(c.x, c.y, c.z);
    const dist = Math.max(sz.y, sz.x) * 1.9;
    this.camera.position.set(c.x + dist * 0.25, c.y + sz.y * 0.12, c.z + dist);
    this.controls.update();
  }

  // frame the camera on a body region: 'body' (whole figure) | 'hands' | 'face'
  focusOn(mode) {
    this._focus = mode;
    if (!this.model) return;
    const box = new THREE.Box3().setFromObject(this.model);
    const c = box.getCenter(new THREE.Vector3());
    const sz = box.getSize(new THREE.Vector3());
    const wp = b => b ? b.getWorldPosition(new THREE.Vector3()) : null;
    let target = c, dist = Math.max(sz.y, sz.x) * 1.9;
    if (mode === 'face') {
      const h = wp(this.canon && this.canon.head) || wp(this.neckBone);
      if (h) { target = h; dist = sz.y * 0.5; }
    } else if (mode === 'hands') {
      const a = wp(this.canon && this.canon.lefthand), b = wp(this.canon && this.canon.righthand);
      if (a && b) { target = a.clone().add(b).multiplyScalar(0.5); dist = Math.max(0.45, a.distanceTo(b) * 1.7); }
      else { target = new THREE.Vector3(c.x, c.y + sz.y * 0.08, c.z); dist = sz.y * 0.85; }
    }
    this.controls.target.copy(target);
    this.camera.position.set(target.x + dist * 0.22, target.y + dist * 0.10, target.z + dist);
    this.controls.update();
  }

  applyLayers() {
    this.meshes.forEach(m => { m.visible = this.showMesh; });
    if (this.skelHelper) this.skelHelper.visible = this.showSkel || !this.showMesh;
  }
  setLayers(mesh, skel) { this.showMesh = mesh; this.showSkel = skel; this.applyLayers(); }
  setRetarget(on) { this.retarget = on; if (!on) this._resetPose(); }
  setSmooth(v) { this.smooth = v; }
  setMirror(on) { this.mirror = !!on; }
  setFootLock(on) { this.footLock = !!on; if (!on) this._applyFootLock(); }
  setFacing(deg) { this.facingDeg = deg; if (this.model) this.model.rotation.y = THREE.MathUtils.degToRad(deg); }
  // effective mirror: flipping the model 180° to face the camera also flips screen left/right,
  // so XOR the user's mirror choice with that flip to keep handedness consistent.
  _eff() { return this.mirror !== (this.facingDeg === 180); }

  _resetPose() {
    this.driven.forEach(d => { d.bone.quaternion.copy(d.rest); });
    if (this.hips && this._hipsRest) this.hips.quaternion.copy(this._hipsRest);
    if (this.model && this._flBase) { this.model.position.copy(this._flBase); if (this._flExtra) this._flExtra.set(0, 0, 0); this._flAnchor = null; this._flFootKey = null; }
    ['left', 'right'].forEach(s => { const h = this.handBones[s]; if (!h) return;
      if (h.root) h.root.quaternion.copy(h.rootRest);
      Object.values(h.fingers).forEach(chain => chain.forEach(p => p.bone.quaternion.copy(p.rest)));
    });
    this.driven.forEach(d => this._prev.set(d.bone, d.bone.quaternion.clone()));
  }

  // index swap for mirrored (reflected) pose so the avatar mirrors the user, uncrossed
  static get SWAP() {
    return { 11:12,12:11,13:14,14:13,15:16,16:15,23:24,24:23,25:26,26:25,27:28,28:27,29:30,30:29,31:32,32:31,1:4,4:1,2:5,5:2,3:6,6:3,7:8,8:7,9:10,10:9 };
  }

  // pose world landmark -> THREE world vector (Y up, Z into screen), with optional mirror+swap
  _pv(L, i) {
    const m = this._eff();
    const j = m ? (MCEngine.SWAP[i] ?? i) : i;
    const p = L[j]; if (!p) return null;
    const sx = m ? -1 : 1;
    return new THREE.Vector3(p.x * sx, -p.y, -p.z);
  }
  // hand world landmark -> THREE world vector (reflect x only when mirrored; finger indices unchanged)
  _hv(H, i) {
    const p = H[i]; if (!p) return null;
    const sx = this._eff() ? -1 : 1;
    return new THREE.Vector3(p.x * sx, -p.y, -p.z);
  }

  // aim `bone` so its child points along world dir u1; slerp from rest toward result by alpha
  _aim(bone, child, u1, alpha) {
    if (!bone || !child || !u1) return;
    bone.updateWorldMatrix(true, true);            // refresh subtree so child world pos is current
    const bw = bone.getWorldPosition(this._tmpA);
    const cw = child.getWorldPosition(this._tmpB);
    const u0 = cw.clone().sub(bw);
    this._aimDir(bone, u0, u1, alpha);
  }

  // aim using an explicit current world direction u0 (for leaf bones with no child)
  _aimDir(bone, u0, u1, alpha) {
    if (!bone || !u0 || !u1 || u0.lengthSq() < 1e-8) return;
    u0 = u0.clone().normalize();
    const qd = this._q.setFromUnitVectors(u0, u1);
    const restWorld = bone.getWorldQuaternion(this._q2.clone());
    const qWorldNew = qd.multiply(restWorld);
    const parentWQ = bone.parent ? bone.parent.getWorldQuaternion(new THREE.Quaternion()) : new THREE.Quaternion();
    const qLocal = parentWQ.invert().multiply(qWorldNew);
    const prev = this._prev.get(bone) || bone.quaternion.clone();
    prev.slerp(qLocal, alpha);
    bone.quaternion.copy(prev); this._prev.set(bone, prev.clone());
    bone.updateWorldMatrix(true, true);
  }

  // L = pose worldLandmarks; vis = per-index visibility from the normalized landmarks (0..1)
  applyPose(L, vis) {
    if (!this.retarget || !this.model || !L) return;
    const v = (i) => this._pv(L, i);
    const alpha = 1 - Math.min(0.92, this.smooth * 0.9);
    // visibility lookup honours the mirror swap so it matches the data we read
    const vok = (i) => {
      if (!vis) return true;
      const j = this._eff() ? (MCEngine.SWAP[i] ?? i) : i;
      return (vis[j] ?? 1) >= this.visThresh;
    };
    const ease = (bone, rest) => { const prev = this._prev.get(bone) || bone.quaternion.clone(); prev.slerp(rest, alpha * 0.35); bone.quaternion.copy(prev); this._prev.set(bone, prev.clone()); bone.updateWorldMatrix(true, true); };

    // hips: yaw only (turn left/right). No full basis — avoids the face-backwards / arm-cross flip.
    if (this.hips && this.hipYaw && vok(23) && vok(24)) {
      const hipL = v(23), hipR = v(24);
      if (hipL && hipR) {
        const right = hipR.clone().sub(hipL); right.y = 0;
        if (right.lengthSq() > 1e-6) {
          right.normalize();
          // model's rest "right" is +X; yaw is angle between +X and the projected hip line
          const yaw = Math.atan2(-right.z, right.x);
          const qWorld = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
          const base = this._hipsRest || new THREE.Quaternion();
          const target = base.clone().premultiply(qWorld);
          const prev = this._prev.get(this.hips) || this.hips.quaternion.clone();
          prev.slerp(target, alpha * 0.5);
          this.hips.quaternion.copy(prev); this._prev.set(this.hips, prev.clone());
          this.hips.updateWorldMatrix(true, true);
        }
      }
    }

    // limbs — gate by landmark visibility so off-camera limbs don't curl into garbage
    for (const d of this.driven) {
      const isLeg = d.key.indexOf('leg') !== -1 || d.key.indexOf('upleg') !== -1;
      if (!vok(d.seg[0]) || !vok(d.seg[1])) {
        // not visible: ease back toward rest (stand straight) instead of holding a bad pose
        if (isLeg ? this.footLock : true) ease(d.bone, d.rest);
        continue;
      }
      const a = v(d.seg[0]), b = v(d.seg[1]);
      if (!a || !b) continue;
      const u1 = b.clone().sub(a); if (u1.lengthSq() < 1e-8) continue;
      d.bone.quaternion.copy(d.rest);
      this._aim(d.bone, d.child, u1.normalize(), alpha);
    }

    // head
    if (this.headBone && vok(0) && vok(11) && vok(12)) {
      const shL = v(11), shR = v(12), nose = v(0);
      const child = this.headBone.children.find(c => c.isBone);
      if (shL && shR && nose && child) {
        const neck = shL.clone().add(shR).multiplyScalar(0.5);
        const u1 = nose.clone().sub(neck);
        if (u1.lengthSq() > 1e-8) { this.headBone.quaternion.identity(); this._aim(this.headBone, child, u1.normalize(), alpha); }
      }
    }

    this._applyFootLock();
  }

  // ---- FOOT LOCK ----
  // Real grounding, not just "ease legs to rest": every frame we measure each
  // foot's sole height against its bind-pose height, then
  //   · push the whole body UP when a foot would sink through the floor,
  //   · pull it DOWN when both feet hover just above the ground (kills float),
  //   · leave real jumps alone (both soles clearly airborne),
  //   · pin the stance foot's XZ while it's planted so it can't skate.
  _applyFootLock() {
    if (!this.model || !this._flFeet || !this._flFeet.length) return;
    const base = this._flBase, extra = this._flExtra;
    if (!this.footLock) {
      // toggled off → gently release any correction we applied
      if (extra.lengthSq() > 1e-8) { extra.multiplyScalar(0.85); this.model.position.copy(base).add(extra); }
      this._flAnchor = null; this._flFootKey = null;
      return;
    }
    this.model.updateMatrixWorld(true);
    const v = this._tmpA;
    let minSole = Infinity, low = null;
    for (const f of this._flFeet) {
      (f.toe || f.bone).getWorldPosition(v);
      const rawSole = (v.y - extra.y) - f.restY;      // sole height, ignoring our own offset
      const entry = { f, rawSole, wx: v.x, wz: v.z };
      if (rawSole < minSole) { minSole = rawSole; low = entry; }
    }
    // vertical correction
    let targetY;
    if (minSole < 0) targetY = -minSole;              // penetration → lift out, fast
    else if (minSole < 0.12) targetY = -minSole;      // hovering → settle down onto the floor
    else targetY = 0;                                 // airborne (jump) → hands off
    extra.y += (targetY - extra.y) * (minSole < 0 ? 0.6 : 0.25);
    // stance-foot pinning (XZ)
    const planted = low && (low.rawSole + extra.y) < 0.06;
    if (planted) {
      if (this._flFootKey !== low.f.side || !this._flAnchor) {
        this._flFootKey = low.f.side;
        this._flAnchor = { x: low.wx, z: low.wz };    // world position at plant time
      }
      extra.x += (this._flAnchor.x - low.wx) * 0.5;
      extra.z += (this._flAnchor.z - low.wz) * 0.5;
      // never let pinning drag the character out of frame
      const m = Math.hypot(extra.x, extra.z);
      if (m > 0.5) { const k = 0.5 / m; extra.x *= k; extra.z *= k; this._flAnchor = null; }
    } else {
      this._flFootKey = null; this._flAnchor = null;
      extra.x *= 0.9; extra.z *= 0.9;                 // swing phase → recentre softly
    }
    this.model.position.copy(base).add(extra);
  }

  // hands = [{ world: [21 pts], side: 'left'|'right' }]; drives wrist + finger curl
  applyHands(hands) {
    if (!this.retarget || !this.model || !hands || !hands.length) return;
    const alpha = 1 - Math.min(0.9, this.smooth * 0.85);
    // MediaPipe hand landmark indices per finger phalanx -> [parent, child]
    const FLM = {
      thumb: [[1,2],[2,3],[3,4]], index: [[5,6],[6,7],[7,8]], middle: [[9,10],[10,11],[11,12]],
      ring: [[13,14],[14,15],[15,16]], pinky: [[17,18],[18,19],[19,20]],
    };
    // whole-finger direction (wrist -> tip) for single-bone rigs: closing the hand swings tip toward palm
    const FWHOLE = { thumb: [0,4], index: [0,8], middle: [0,12], ring: [0,16], pinky: [0,20] };
    for (const hand of hands) {
      // when mirrored, the user's anatomical side drives the OPPOSITE model hand (matches limb swap)
      const modelSide = this._eff() ? (hand.side === 'left' ? 'right' : 'left') : hand.side;
      const HB = this.handBones[modelSide];
      const H = hand.world;
      if (!HB || !H) continue;
      const hv = (i) => this._hv(H, i);
      // wrist/palm orientation: aim hand root toward middle-finger base
      if (HB.root) {
        const child = HB.root.children.find(c => c.isBone);
        const u1 = hv(9) && hv(0) ? hv(9).clone().sub(hv(0)) : null;
        if (child && u1 && u1.lengthSq() > 1e-8) { HB.root.quaternion.copy(HB.rootRest); this._aim(HB.root, child, u1.normalize(), alpha); }
      }
      // fingers
      const rootPos = HB.root ? HB.root.getWorldPosition(new THREE.Vector3()) : null;
      for (const fn in HB.fingers) {
        const chain = HB.fingers[fn];
        const isSingle = chain.length === 1;
        for (let k = 0; k < chain.length; k++) {
          const bone = chain[k].bone;
          const child = bone.children.find(c => c.isBone);
          if (isSingle) {
            // single-bone finger (AutoRig 1-bone): aim whole bone wrist->tip
            const seg = FWHOLE[fn]; if (!seg) continue;
            const a = hv(seg[0]), b = hv(seg[1]);
            if (!a || !b) continue;
            const u1 = b.clone().sub(a); if (u1.lengthSq() < 1e-8) continue;
            bone.quaternion.copy(chain[k].rest);
            bone.updateWorldMatrix(true, true);
            const bw = bone.getWorldPosition(this._tmpA);
            const pw = bone.parent ? bone.parent.getWorldPosition(this._tmpB) : rootPos;
            if (!pw) continue;
            this._aimDir(bone, bw.clone().sub(pw), u1.normalize(), alpha);
          } else {
            // multi-phalanx chain (Mixamo or AutoRig 3-bone): aim each phalanx at its landmark segment
            const seg = FLM[fn][k]; if (!seg) continue;
            const a = hv(seg[0]), b = hv(seg[1]);
            if (!a || !b) continue;
            const u1 = b.clone().sub(a); if (u1.lengthSq() < 1e-8) continue;
            bone.quaternion.copy(chain[k].rest);
            if (child) {
              this._aim(bone, child, u1.normalize(), alpha);
            } else {
              // distal/leaf phalanx: derive current direction from parent->bone
              bone.updateWorldMatrix(true, true);
              const bw = bone.getWorldPosition(this._tmpA);
              const pw = bone.parent ? bone.parent.getWorldPosition(this._tmpB) : rootPos;
              if (!pw) continue;
              this._aimDir(bone, bw.clone().sub(pw), u1.normalize(), alpha);
            }
          }
        }
      }
    }
  }

  _clear() {
    if (this.model) { this.root.remove(this.model); }
    if (this.skelHelper) { this.scene.remove(this.skelHelper); this.skelHelper = null; }
    this.model = null; this.meshes = []; this.driven = []; this.boneByKey = {}; this.hips = null;
  }

  _loop() {
    if (!this._run) return;
    requestAnimationFrame(this._loop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} }
}

export default MCEngine;
