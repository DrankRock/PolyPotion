// ============================================================
// MOTION — ENGINE  (MotionEngine)
// A non-linear motion editor core. Renders a 3D skeleton (+ light mannequin)
// in three.js, composited every frame from a multi-lane TIMELINE:
//   • Body lane    — full-body clips placed/merged in sequence
//   • L/R hand lane — independent hand clips OR static HOLD poses over a span
//   • Face lane    — head/face clips
// Hands can auto-follow the forearm axis (so the wrist orientation tracks the
// arm), or be posed by hand: presets (rest/fist/open/point/pinch) + per-finger
// curl, applied as a hold over any time span. Everything procedural & local.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const lerpV = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// ---- canonical rest skeleton (character-local, Y up, ~1.7 tall, hips at y=0.92) ----
const REST = {
  hips: [0, 0.92, 0], spine: [0, 1.06, 0], chest: [0, 1.22, 0], neck: [0, 1.40, 0], head: [0, 1.56, 0.02],
  shoulderL: [-0.18, 1.40, 0], shoulderR: [0.18, 1.40, 0],
  elbowL: [-0.45, 1.40, 0.02], elbowR: [0.45, 1.40, 0.02],
  wristL: [-0.72, 1.40, 0.03], wristR: [0.72, 1.40, 0.03],
  hipL: [-0.10, 0.90, 0], hipR: [0.10, 0.90, 0],
  kneeL: [-0.12, 0.50, 0.02], kneeR: [0.12, 0.50, 0.02],
  ankleL: [-0.13, 0.08, -0.02], ankleR: [0.13, 0.08, -0.02],
  footL: [-0.13, 0.03, 0.10], footR: [0.13, 0.03, 0.10],
};
const BONES = [
  ['hips', 'spine'], ['spine', 'chest'], ['chest', 'neck'], ['neck', 'head'],
  ['chest', 'shoulderL'], ['shoulderL', 'elbowL'], ['elbowL', 'wristL'],
  ['chest', 'shoulderR'], ['shoulderR', 'elbowR'], ['elbowR', 'wristR'],
  ['hips', 'hipL'], ['hipL', 'kneeL'], ['kneeL', 'ankleL'], ['ankleL', 'footL'],
  ['hips', 'hipR'], ['hipR', 'kneeR'], ['kneeR', 'ankleR'], ['ankleR', 'footR'],
];
const JOINTS = Object.keys(REST);

// finger geometry: 4 fingers + thumb, each 3 phalanx lengths, base offset from wrist (local hand frame)
const FINGERS = [
  { name: 'thumb', base: [0.018, -0.004, 0.012], seg: [0.030, 0.026, 0.022], splay: 0.6 },
  { name: 'index', base: [0.020, 0.0, 0.028], seg: [0.034, 0.024, 0.020], splay: 0.18 },
  { name: 'middle', base: [0.006, 0.0, 0.030], seg: [0.038, 0.026, 0.022], splay: 0.0 },
  { name: 'ring', base: [-0.010, 0.0, 0.028], seg: [0.034, 0.024, 0.020], splay: -0.18 },
  { name: 'pinky', base: [-0.024, 0.0, 0.024], seg: [0.026, 0.018, 0.016], splay: -0.4 },
];
// preset hand poses: curl per finger 0..1 (thumb,index,middle,ring,pinky), spread -1..1
export const HAND_PRESETS = {
  rest: { label: 'Relaxed', curl: [0.35, 0.45, 0.5, 0.55, 0.6], spread: 0.15 },
  open: { label: 'Open', curl: [0.05, 0.05, 0.05, 0.05, 0.05], spread: 0.5 },
  fist: { label: 'Fist', curl: [0.85, 1.0, 1.0, 1.0, 1.0], spread: -0.1 },
  point: { label: 'Point', curl: [0.7, 0.0, 1.0, 1.0, 1.0], spread: 0.0 },
  pinch: { label: 'Pinch', curl: [0.6, 0.55, 0.2, 0.2, 0.2], spread: 0.1 },
  thumbsup: { label: 'Thumbs up', curl: [0.0, 1.0, 1.0, 1.0, 1.0], spread: 0.0 },
};

export class MotionEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})());
    window.addEventListener("studiothemechange", () => { try { this.scene.background = new THREE.Color((function(){var v=getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim();return v||'#16181c';})()); } catch(e){} });
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 100);
    this.camera.position.set(1.4, 1.4, 3.0);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 1.0, 0); this.controls.minDistance = 0.4; this.controls.maxDistance = 12;

    this.scene.add(new THREE.HemisphereLight(0xdfe7f2, 0x23262c, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(2.5, 5, 3);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 18;
    key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0008; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x6f8fd0, 0.6); rim.position.set(-3, 2, -2); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.28 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);

    this.root = new THREE.Group(); this.scene.add(this.root);

    // visual state
    this.showMannequin = true; this.showSkeleton = true;
    this.followAxis = { left: true, right: true };
    this.selectedHand = null;     // 'left' | 'right' for poser preview
    this._handPreview = { left: null, right: null }; // live preview pose override

    // ---- timeline model ----
    this.fps = 30;
    this.lanes = [
      { id: 'body', label: 'Body', kind: 'body', segments: [] },
      { id: 'handL', label: 'Left hand', kind: 'hand', side: 'left', segments: [] },
      { id: 'handR', label: 'Right hand', kind: 'hand', side: 'right', segments: [] },
      { id: 'face', label: 'Face', kind: 'face', segments: [] },
    ];
    this.laneById = {}; this.lanes.forEach(l => this.laneById[l.id] = l);
    this.playhead = 0; this.playing = false; this._segId = 0;
    this.onFrame = null; this.onChange = null;

    this.clips = this._buildClips();
    this.clipById = {}; this.clips.forEach(c => this.clipById[c.id] = c);

    this._buildSceneObjects();

    // seed a starter timeline so the editor isn't empty
    this.appendClip('body', 'idle');
    this.appendClip('body', 'wave');

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._clock = new THREE.Clock(); this._run = true; this._acc = 0;
    this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    this._evalAndDraw();
  }

  // ---------------------------------------------------------- CLIP LIBRARY
  _buildClips() {
    // each clip: pose(frame) -> { joints:{}, handL:{curl,spread}, handR:{...}, head:{...} } in LOCAL space
    const F = this.fps;
    const baseJ = () => { const o = {}; for (const k of JOINTS) o[k] = REST[k].slice(); return o; };
    const restHand = HAND_PRESETS.rest;
    const openHand = HAND_PRESETS.open;
    const mk = (id, label, kind, frames, color, fn, opts) => ({ id, label, kind, frames, color, pose: fn, ...(opts || {}) });

    const idle = (f) => {
      const J = baseJ(); const t = f / F;
      const br = Math.sin(t * 1.5) * 0.006, sway = Math.sin(t * 0.6) * 0.012;
      ['chest', 'neck', 'head', 'shoulderL', 'shoulderR'].forEach(k => J[k][1] += br);
      ['hips', 'hipL', 'hipR', 'spine'].forEach(k => J[k][0] += sway * 0.4);
      J.head[0] += sway * 0.5; J.head[2] += Math.sin(t * 0.9) * 0.01;
      // relaxed arms down
      J.elbowL = [-0.22, 1.15, 0.04]; J.wristL = [-0.24, 0.92, 0.07];
      J.elbowR = [0.22, 1.15, 0.04]; J.wristR = [0.24, 0.92, 0.07];
      J.elbowL[0] += sway * 0.2; J.elbowR[0] += sway * 0.2;
      return { joints: J, handL: restHand, handR: restHand };
    };
    const wave = (f) => {
      const t = f / F; const base = idle(f); const J = base.joints;
      const w = Math.sin(t * 1.7) * 0.5 + 0.5;
      J.elbowR = [0.40, 1.45, 0.06]; J.wristR = [0.50, 1.78 + Math.sin(t * 4) * 0.02, 0.10];
      J.wristR[0] += Math.sin(t * 6) * 0.06 * w;
      return { joints: J, handL: restHand, handR: openHand };
    };
    const point = (f) => {
      const t = f / F; const base = idle(f); const J = base.joints;
      J.elbowR = [0.40, 1.34, 0.18]; J.wristR = [0.66, 1.30, 0.42 + Math.sin(t * 1.2) * 0.02];
      return { joints: J, handL: restHand, handR: HAND_PRESETS.point };
    };
    const reach = (f) => {
      const t = f / F; const p = Math.sin(t * 0.9) * 0.5 + 0.5; const base = idle(f); const J = base.joints;
      J.elbowR = lerpV([0.22, 1.15, 0.04], [0.42, 1.42, 0.20], p);
      J.wristR = lerpV([0.24, 0.92, 0.07], [0.62, 1.5, 0.45], p);
      J.elbowL = lerpV([-0.22, 1.15, 0.04], [-0.40, 1.40, 0.18], p * 0.6);
      J.wristL = lerpV([-0.24, 0.92, 0.07], [-0.55, 1.45, 0.40], p * 0.6);
      return { joints: J, handL: { curl: [0.1, 0.1, 0.1, 0.1, 0.1], spread: 0.3 }, handR: openHand };
    };
    const walk = (f) => {
      const t = f / F; const J = baseJ(); const ph = t * 3.4;
      const sw = Math.sin(ph), co = Math.cos(ph);
      J.hips[1] += Math.abs(Math.sin(ph)) * 0.02; J.hips[0] += Math.sin(ph) * 0.01;
      // legs
      J.kneeL = [-0.12, 0.50, 0.02 + sw * 0.12]; J.ankleL = [-0.13, 0.08, -0.02 + sw * 0.20];
      J.kneeR = [0.12, 0.50, 0.02 - sw * 0.12]; J.ankleR = [0.13, 0.08, -0.02 - sw * 0.20];
      J.footL = [-0.13, 0.03 + Math.max(0, sw) * 0.06, 0.10 + sw * 0.20];
      J.footR = [0.13, 0.03 + Math.max(0, -sw) * 0.06, 0.10 - sw * 0.20];
      // arms counter-swing, bent
      J.elbowL = [-0.26, 1.18, 0.04 - sw * 0.16]; J.wristL = [-0.30, 0.98, 0.10 - sw * 0.26];
      J.elbowR = [0.26, 1.18, 0.04 + sw * 0.16]; J.wristR = [0.30, 0.98, 0.10 + sw * 0.26];
      J.chest[2] += co * 0.01; J.head[1] += Math.abs(sw) * 0.01;
      return { joints: J, handL: restHand, handR: restHand };
    };
    const bow = (f) => {
      const t = f / F; const p = Math.sin(t * 0.8) * 0.5 + 0.5; const J = baseJ();
      const lean = p * 0.28;
      ['chest', 'neck', 'head', 'shoulderL', 'shoulderR'].forEach(k => { J[k][2] += lean * (J[k][1] - 0.9); J[k][1] -= lean * 0.12 * (J[k][1] - 0.9); });
      J.elbowL = [-0.24, 1.05, 0.10]; J.wristL = [-0.20, 0.85, 0.20];
      J.elbowR = [0.24, 1.05, 0.10]; J.wristR = [0.20, 0.85, 0.20];
      return { joints: J, handL: restHand, handR: restHand };
    };
    const talk = (f) => {
      const t = f / F; const base = idle(f); const J = base.joints;
      const g = Math.sin(t * 2.6), g2 = Math.sin(t * 1.7 + 1);
      J.elbowL = [-0.30, 1.20 + g * 0.04, 0.16]; J.wristL = [-0.34, 1.10 + g * 0.10, 0.30 + g * 0.05];
      J.elbowR = [0.30, 1.20 + g2 * 0.04, 0.16]; J.wristR = [0.34, 1.10 + g2 * 0.10, 0.30 + g2 * 0.05];
      return { joints: J, handL: { curl: [0.2, 0.2, 0.25, 0.3, 0.35], spread: 0.3 }, handR: { curl: [0.2, 0.2, 0.25, 0.3, 0.35], spread: 0.3 } };
    };

    // hand-only clips (for layering onto hand lanes)
    const handWaveClip = (f) => { const t = f / F; const c = Math.sin(t * 5) * 0.5 + 0.5; return { curl: [0.1, 0.05 + c * 0.1, 0.05 + c * 0.1, 0.05 + c * 0.1, 0.05 + c * 0.1], spread: 0.4 }; };
    const handGraspClip = (f) => { const t = f / F; const c = Math.sin(t * 1.4) * 0.5 + 0.5; const k = c; return { curl: [0.3 + k * 0.55, 0.2 + k * 0.8, 0.2 + k * 0.8, 0.2 + k * 0.8, 0.2 + k * 0.8], spread: 0.1 - k * 0.2 }; };
    const handCountClip = (f) => { const t = (f / F) % 5; const n = Math.floor(t); const curl = [1, 1, 1, 1, 1].map((_, i) => i <= n ? 0.05 : 1.0); return { curl, spread: 0.3 }; };

    // face clips
    const faceNod = (f) => { const t = f / F; return { type: 'face', pitch: Math.sin(t * 2) * 0.18, yaw: 0, mouth: 0 }; };
    const faceTalk = (f) => { const t = f / F; return { type: 'face', pitch: Math.sin(t * 1.3) * 0.05, yaw: Math.sin(t * 0.8) * 0.1, mouth: Math.abs(Math.sin(t * 7)) * 0.8 }; };
    const faceLook = (f) => { const t = f / F; return { type: 'face', pitch: 0, yaw: Math.sin(t * 0.6) * 0.4, mouth: 0 }; };

    return [
      mk('idle', 'Idle', 'body', 90, '#5aa86b', idle),
      mk('wave', 'Wave', 'body', 72, '#4d82d6', wave),
      mk('walk', 'Walk', 'body', 60, '#e08534', walk),
      mk('point', 'Point', 'body', 60, '#43b6c4', point),
      mk('reach', 'Reach', 'body', 80, '#b07ad6', reach),
      mk('bow', 'Bow', 'body', 70, '#d6a743', bow),
      mk('talk', 'Talk gesture', 'body', 96, '#d67aa0', talk),
      mk('hand_wave', 'Hand · wave', 'hand', 48, '#4d82d6', handWaveClip),
      mk('hand_grasp', 'Hand · grasp', 'hand', 60, '#e08534', handGraspClip),
      mk('hand_count', 'Hand · count 1-5', 'hand', 150, '#43b6c4', handCountClip),
      mk('face_nod', 'Face · nod', 'face', 60, '#b07ad6', faceNod),
      mk('face_talk', 'Face · talk', 'face', 90, '#d67aa0', faceTalk),
      mk('face_look', 'Face · look around', 'face', 80, '#5aa86b', faceLook),
    ];
  }
  getClips() { return this.clips.map(c => ({ id: c.id, label: c.label, kind: c.kind, frames: c.frames, color: c.color })); }

  // ---------------------------------------------------------- TIMELINE OPS
  _newSeg(clipId, start, opts) {
    const c = this.clipById[clipId];
    return Object.assign({ id: 's' + (++this._segId), clipId, label: c ? c.label : 'seg', start, len: c ? c.frames : 60, inFrame: 0, blend: 6 }, opts || {});
  }
  laneEnd(laneId) { const l = this.laneById[laneId]; let e = 0; l.segments.forEach(s => e = Math.max(e, s.start + s.len)); return e; }
  duration() { let d = 1; this.lanes.forEach(l => l.segments.forEach(s => d = Math.max(d, s.start + s.len))); return d; }
  appendClip(laneId, clipId) {
    const l = this.laneById[laneId]; if (!l) return null;
    const seg = this._newSeg(clipId, this.laneEnd(laneId));
    l.segments.push(seg); this._sort(l); this._changed(); return seg.id;
  }
  placeClip(laneId, clipId, startFrame) {
    const l = this.laneById[laneId]; if (!l) return null;
    const seg = this._newSeg(clipId, Math.max(0, Math.round(startFrame)));
    l.segments.push(seg); this._sort(l); this._changed(); return seg.id;
  }
  _findSeg(segId) { for (const l of this.lanes) { const s = l.segments.find(x => x.id === segId); if (s) return { lane: l, seg: s }; } return null; }
  moveSegment(segId, startFrame) { const r = this._findSeg(segId); if (!r) return; r.seg.start = Math.max(0, Math.round(startFrame)); this._sort(r.lane); this._changed(); }
  trimSegment(segId, o) {
    const r = this._findSeg(segId); if (!r) return; const s = r.seg; const c = this.clipById[s.clipId];
    if (o.start != null) { const ns = Math.max(0, Math.round(o.start)); const delta = ns - s.start; s.start = ns; s.inFrame = Math.max(0, s.inFrame + delta); s.len = Math.max(4, s.len - delta); }
    if (o.len != null) s.len = Math.max(4, Math.round(o.len));
    if (o.inFrame != null) s.inFrame = Math.max(0, Math.round(o.inFrame));
    if (o.blend != null) s.blend = Math.max(0, Math.round(o.blend));
    this._sort(r.lane); this._changed();
  }
  splitAt(segId, frame) {
    const r = this._findSeg(segId); if (!r) return null; const s = r.seg;
    frame = Math.round(frame);
    if (frame <= s.start + 2 || frame >= s.start + s.len - 2) return null;
    const left = frame - s.start;
    const right = this._newSeg(s.clipId, frame, { inFrame: s.inFrame + left, len: s.len - left, blend: s.blend, hold: s.hold, pose: s.pose });
    s.len = left;
    r.lane.segments.push(right); this._sort(r.lane); this._changed(); return right.id;
  }
  deleteSegment(segId) { const r = this._findSeg(segId); if (!r) return; r.lane.segments = r.lane.segments.filter(x => x !== r.seg); this._changed(); }
  clearLane(laneId) { const l = this.laneById[laneId]; if (l) { l.segments = []; this._changed(); } }
  _sort(l) { l.segments.sort((a, b) => a.start - b.start); }

  // place a static HOLD pose (hand) over a span on a hand lane
  setHandHold(laneId, start, len, pose) {
    const l = this.laneById[laneId]; if (!l || l.kind !== 'hand') return null;
    start = Math.max(0, Math.round(start)); len = Math.max(4, Math.round(len));
    const seg = { id: 's' + (++this._segId), clipId: null, label: (pose.name || 'Hold'), start, len, inFrame: 0, blend: 6, hold: true, pose: { curl: pose.curl.slice(), spread: pose.spread } };
    l.segments.push(seg); this._sort(l); this._changed(); return seg.id;
  }

  setFollowAxis(side, on) { this.followAxis[side] = !!on; this._evalAndDraw(); }
  getTimeline() {
    return {
      fps: this.fps, duration: this.duration(), playhead: this.playhead, playing: this.playing,
      lanes: this.lanes.map(l => ({
        id: l.id, label: l.label, kind: l.kind, side: l.side,
        segments: l.segments.map(s => ({ id: s.id, clipId: s.clipId, label: s.label, start: s.start, len: s.len, inFrame: s.inFrame, blend: s.blend, hold: !!s.hold, color: s.hold ? '#9a8' : (this.clipById[s.clipId] ? this.clipById[s.clipId].color : '#888') })),
      })),
    };
  }
  segInfo(segId) { const r = this._findSeg(segId); if (!r) return null; const s = r.seg; return { id: s.id, label: s.label, laneId: r.lane.id, laneKind: r.lane.kind, start: s.start, len: s.len, inFrame: s.inFrame, blend: s.blend, hold: !!s.hold, clipId: s.clipId, end: s.start + s.len }; }

  // ---------------------------------------------------------- PLAYBACK
  play() { this.playing = true; if (this.playhead >= this.duration() - 1) this.playhead = 0; }
  pause() { this.playing = false; }
  toggle() { this.playing ? this.pause() : this.play(); this._emitFrame(); }
  setFrame(f) { this.playhead = Math.max(0, Math.min(this.duration() - 1, Math.round(f))); this._evalAndDraw(); this._emitFrame(); }
  stepFrame(d) { this.setFrame(this.playhead + d); }
  _emitFrame() { if (this.onFrame) this.onFrame(this.playhead, this.playing); }
  _changed() { if (this.onChange) this.onChange(); this._evalAndDraw(); }

  // ---------------------------------------------------------- COMPOSITOR
  _activeSeg(lane, f) {
    // last segment whose [start, start+len) contains f
    let best = null;
    for (const s of lane.segments) { if (f >= s.start && f < s.start + s.len) best = s; }
    return best;
  }
  _evalBodyAt(f) {
    const lane = this.laneById.body;
    const seg = this._activeSeg(lane, f);
    if (!seg) { const c = this.clipById.idle; return c.pose(f % c.frames); }
    const c = this.clipById[seg.clipId]; const local = seg.inFrame + (f - seg.start);
    let pose = c.pose(((local % c.frames) + c.frames) % c.frames);
    // crossfade with a previous overlapping/preceding segment at the seam
    if (seg.blend > 0 && f < seg.start + seg.blend) {
      const prev = lane.segments.filter(s => s !== seg && s.start + s.len <= seg.start + seg.blend && s.start < seg.start).sort((a, b) => (b.start + b.len) - (a.start + a.len))[0];
      if (prev) {
        const pc = this.clipById[prev.clipId]; const pl = prev.inFrame + (f - prev.start);
        const ppose = pc.pose(((pl % pc.frames) + pc.frames) % pc.frames);
        const t = (f - seg.start) / seg.blend;
        pose = this._blendPose(ppose, pose, t);
      }
    }
    return pose;
  }
  _blendPose(a, b, t) {
    const J = {}; for (const k of JOINTS) J[k] = lerpV(a.joints[k] || REST[k], b.joints[k] || REST[k], t);
    const bl = (x, y) => x && y ? { curl: x.curl.map((c, i) => lerp(c, y.curl[i], t)), spread: lerp(x.spread, y.spread, t) } : (y || x);
    return { joints: J, handL: bl(a.handL, b.handL), handR: bl(a.handR, b.handR) };
  }
  _evalHandAt(laneId, f, fallback) {
    const lane = this.laneById[laneId]; const seg = this._activeSeg(lane, f);
    if (!seg) return fallback;
    if (seg.hold) return seg.pose;
    const c = this.clipById[seg.clipId]; if (!c) return fallback;
    const local = seg.inFrame + (f - seg.start);
    return c.pose(((local % c.frames) + c.frames) % c.frames);
  }
  _evalFaceAt(f) {
    const lane = this.laneById.face; const seg = this._activeSeg(lane, f);
    if (!seg) return null;
    const c = this.clipById[seg.clipId]; if (!c) return null;
    const local = seg.inFrame + (f - seg.start);
    return c.pose(((local % c.frames) + c.frames) % c.frames);
  }
  composite(f) {
    const body = this._evalBodyAt(f);
    const J = body.joints;
    let handL = this._evalHandAt('handL', f, body.handL);
    let handR = this._evalHandAt('handR', f, body.handR);
    if (this._handPreview.left) handL = this._handPreview.left;
    if (this._handPreview.right) handR = this._handPreview.right;
    const face = this._evalFaceAt(f);
    if (face) { // apply head look/nod on top
      J.head = J.head.slice();
      J.head[2] += face.pitch * 0.12; J.head[0] += face.yaw * 0.10; J.neck = J.neck.slice(); J.neck[0] += face.yaw * 0.04;
    }
    return { joints: J, handL, handR, face };
  }

  // ---------------------------------------------------------- SCENE OBJECTS
  _buildSceneObjects() {
    this.jMeshes = {}; this.bMeshes = []; this.limbMeshes = [];
    const jmat = new THREE.MeshStandardMaterial({ color: 0x43b6c4, roughness: 0.5, emissive: 0x0a3b40, emissiveIntensity: 0.5 });
    for (const k of JOINTS) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(k === 'head' ? 0.07 : 0.028, 16, 12), jmat.clone());
      m.castShadow = true; this.root.add(m); this.jMeshes[k] = m;
    }
    const bmat = new THREE.MeshStandardMaterial({ color: 0xe08534, roughness: 0.5, emissive: 0x3a1c06, emissiveIntensity: 0.4 });
    for (let i = 0; i < BONES.length; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 8), bmat.clone());
      m.castShadow = true; this.root.add(m); this.bMeshes.push(m);
    }
    // mannequin limbs (thicker capsules over the same bones)
    const lmat = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.85, metalness: 0.02 });
    const limbDefs = [['shoulderL', 'elbowL', 0.05], ['elbowL', 'wristL', 0.04], ['shoulderR', 'elbowR', 0.05], ['elbowR', 'wristR', 0.04], ['hipL', 'kneeL', 0.06], ['kneeL', 'ankleL', 0.045], ['hipR', 'kneeR', 0.06], ['kneeR', 'ankleR', 0.045], ['chest', 'hips', 0.10], ['neck', 'chest', 0.07]];
    this.limbDefs = limbDefs;
    for (const d of limbDefs) { const m = new THREE.Mesh(new THREE.CylinderGeometry(d[2], d[2] * 0.85, 1, 14), lmat.clone()); m.castShadow = true; this.root.add(m); this.limbMeshes.push(m); }
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), lmat.clone()); this.headMesh.castShadow = true; this.root.add(this.headMesh);
    // hands: groups of small lines (21 pts -> bones)
    this.handGroups = { left: new THREE.Group(), right: new THREE.Group() };
    this.handLineMats = {
      left: new THREE.LineBasicMaterial({ color: 0xe0a050 }), right: new THREE.LineBasicMaterial({ color: 0xe0a050 }),
    };
    this.root.add(this.handGroups.left); this.root.add(this.handGroups.right);
    this._handLines = { left: null, right: null };
  }

  // build 21 hand landmark positions from a curl pose, in world space, anchored at wrist
  _handPoints(side, wrist, elbow, pose) {
    // local frame: forward = wrist->fingers, derived from forearm axis (follow) or default down-out
    const W = new THREE.Vector3(...wrist), E = new THREE.Vector3(...elbow);
    let fwd;
    if (this.followAxis[side]) { fwd = W.clone().sub(E).normalize(); }   // hand follows the arm axis
    else { fwd = new THREE.Vector3(side === 'left' ? -0.2 : 0.2, -1, 0.2).normalize(); }
    const up = new THREE.Vector3(0, 0, 1);
    let rightV = new THREE.Vector3().crossVectors(fwd, up).normalize();
    if (rightV.lengthSq() < 1e-4) rightV.set(1, 0, 0);
    const upV = new THREE.Vector3().crossVectors(rightV, fwd).normalize();
    const sgn = side === 'left' ? -1 : 1;
    const toWorld = (lx, ly, lz) => W.clone().addScaledVector(rightV, lx * sgn).addScaledVector(upV, ly).addScaledVector(fwd, lz);
    const pts = [];
    pts.push(W.clone()); // 0 wrist
    const curl = pose.curl, spread = pose.spread;
    for (let fi = 0; fi < FINGERS.length; fi++) {
      const F = FINGERS[fi]; const c = curl[fi];
      const splay = F.splay * (0.5 + spread * 0.5);
      let px = F.base[0] + splay * 0.02, py = F.base[1], pz = F.base[2];
      let dirF = fwd.clone().applyAxisAngle(rightV, 0); // start pointing forward
      // accumulate phalanges with progressive curl (toward palm = -up)
      let cur = toWorld(px, py, pz);
      const knuckle = cur.clone();
      let ang = 0;
      const chain = [cur];
      let localDir = new THREE.Vector3(splay * sgn, 0, 1).normalize();
      for (let s = 0; s < 3; s++) {
        ang += c * (s === 0 ? 0.5 : 0.9); // more curl distally
        const segLen = F.seg[s];
        const d = new THREE.Vector3().addScaledVector(rightV, localDir.x * sgn).addScaledVector(fwd, Math.cos(ang) * localDir.z).addScaledVector(upV, -Math.sin(ang));
        d.normalize();
        cur = cur.clone().addScaledVector(d, segLen);
        chain.push(cur);
      }
      // push the 3 joint points after the knuckle (we approximate MediaPipe's 4 pts/finger: knuckle + 3)
      pts.push(knuckle, chain[1], chain[2], chain[3]);
    }
    return pts;
  }
  _handConnections() {
    // wrist(0) + 5 fingers each 4 pts at offsets 1..20
    const C = [];
    for (let fi = 0; fi < 5; fi++) { const b = 1 + fi * 4; C.push([0, b], [b, b + 1], [b + 1, b + 2], [b + 2, b + 3]); }
    return C;
  }
  _drawHand(side, wrist, elbow, pose) {
    const grp = this.handGroups[side];
    const pts = this._handPoints(side, wrist, elbow, pose);
    const C = this._handConnections();
    const verts = [];
    C.forEach(([a, b]) => { verts.push(pts[a].x, pts[a].y, pts[a].z, pts[b].x, pts[b].y, pts[b].z); });
    if (!this._handLines[side]) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      const ln = new THREE.LineSegments(g, this.handLineMats[side]); grp.add(ln); this._handLines[side] = ln;
      // joint dots
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xf0c070 });
      this._handDots = this._handDots || {};
      const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.008, 8, 6), dotMat, 21);
      grp.add(dots); this._handDots[side] = dots;
    } else {
      const attr = this._handLines[side].geometry.attributes.position;
      for (let i = 0; i < verts.length; i++) attr.array[i] = verts[i];
      attr.needsUpdate = true;
    }
    const dots = this._handDots[side]; const m = new THREE.Matrix4();
    for (let i = 0; i < 21; i++) { m.makeTranslation(pts[i].x, pts[i].y, pts[i].z); dots.setMatrixAt(i, m); }
    dots.instanceMatrix.needsUpdate = true;
    const hl = side === this.selectedHand;
    this.handLineMats[side].color.setHex(hl ? 0xffcf86 : 0xe0a050);
  }

  _evalAndDraw() {
    const pose = this.composite(this.playhead);
    const J = pose.joints;
    // joints
    for (const k of JOINTS) { const p = J[k]; const m = this.jMeshes[k]; m.position.set(p[0], p[1], p[2]); m.visible = this.showSkeleton && k !== 'head'; }
    // skeleton bones
    for (let i = 0; i < BONES.length; i++) { const [a, b] = BONES[i]; this._orient(this.bMeshes[i], J[a], J[b], 1); this.bMeshes[i].visible = this.showSkeleton; }
    // mannequin
    for (let i = 0; i < this.limbDefs.length; i++) { const d = this.limbDefs[i]; this._orient(this.limbMeshes[i], J[d[0]], J[d[1]], 1); this.limbMeshes[i].visible = this.showMannequin; }
    this.headMesh.position.set(J.head[0], J.head[1], J.head[2]); this.headMesh.visible = this.showMannequin;
    if (!this.showMannequin) { this.jMeshes.head.visible = this.showSkeleton; }
    // hands
    this._drawHand('left', J.wristL, J.elbowL, pose.handL);
    this._drawHand('right', J.wristR, J.elbowR, pose.handR);
  }
  _orient(mesh, a, b, rad) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const dir = B.clone().sub(A); const len = dir.length() || 1e-4;
    mesh.position.copy(A.clone().add(B).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
    mesh.scale.set(1, len, 1);
  }

  // ---------------------------------------------------------- POSER PREVIEW
  selectHand(side) { this.selectedHand = side; this._evalAndDraw(); }
  previewHand(side, pose) { this._handPreview[side] = pose ? { curl: pose.curl.slice(), spread: pose.spread } : null; this._evalAndDraw(); }
  clearPreview() { this._handPreview = { left: null, right: null }; this._evalAndDraw(); }
  setLayers(mannequin, skel) { this.showMannequin = mannequin; this.showSkeleton = skel; this._evalAndDraw(); }
  setView(name) {
    const t = this.controls.target;
    if (name === 'front') { t.set(0, 1.0, 0); this.camera.position.set(0, 1.1, 3.2); }
    else if (name === 'side') { t.set(0, 1.0, 0); this.camera.position.set(3.2, 1.1, 0); }
    else if (name === 'hands') { t.set(0, 1.25, 0.2); this.camera.position.set(0.5, 1.3, 1.4); }
    else if (name === 'top') { t.set(0, 1.0, 0); this.camera.position.set(0.001, 4, 0.001); }
    else { t.set(0, 1.0, 0); this.camera.position.set(1.4, 1.4, 3.0); }
    this.controls.update();
  }

  // ---------------------------------------------------------- LOOP
  resize() { const el = this.canvas.parentElement || this.canvas; const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  _loop() {
    if (!this._run) return; requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this._clock.getDelta());
    if (this.playing) {
      this._acc += dt * this.fps;
      if (this._acc >= 1) {
        const adv = Math.floor(this._acc); this._acc -= adv;
        let nf = this.playhead + adv; const dur = this.duration();
        if (nf >= dur) nf = 0;
        this.playhead = nf; this._evalAndDraw(); this._emitFrame();
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} this.renderer.dispose(); }
}

export default MotionEngine;
