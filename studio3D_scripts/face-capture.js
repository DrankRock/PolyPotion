// ============================================================
// face-capture.js — webcam → ARKit 52 blendshape weights (audit, face §3)
// Wraps MediaPipe Tasks-Vision FaceLandmarker, which outputs the SAME 52
// blendshape names the Morph ARKit set creates (jawOpen, eyeBlinkLeft…), so
// its scores map straight onto MorphEngine.applyExpression().
// Privacy: the camera feed is processed entirely ON THIS DEVICE — nothing is
// uploaded. The tracking model (~3 MB) downloads once from a CDN and is then
// held in the service worker's runtime cache for offline use.
// ============================================================

const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise = null;
function getLandmarker(onStatus) {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      if (onStatus) onStatus('Loading the face model\u2026 (~3 MB, one-time)');
      const vision = await import(CDN + '/vision_bundle.mjs');
      const fileset = await vision.FilesetResolver.forVisionTasks(CDN + '/wasm');
      return await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    })().catch(e => { landmarkerPromise = null; throw e; });
  }
  return landmarkerPromise;
}

export class FaceCapture {
  constructor() {
    this.onWeights = null;   // (map: arkitName -> 0..1, headPose) per processed frame
    this.onStatus = null;    // progress strings while loading
    this.running = false;
    // calibration + gain (applied to raw scores before onWeights)
    this.neutral = {};        // per-shape resting offsets (subtracted)
    this.gain = { brows: 1, eyes: 1, mouth: 1, master: 1 };
    this.smoothing = 0.45;    // 0 = raw, 0.9 = syrup
    this.headAmplitude = 1;   // 0 disables head pose
    this._smoothed = {}; this._smoothPose = null;
    // recording
    this.recording = false; this._frames = [];
  }
  _status(m) { if (this.onStatus) this.onStatus(m); }
  _group(n) { return /^brow/.test(n) ? 'brows' : /^eye|^cheekSquint/.test(n) ? 'eyes' : 'mouth'; }

  // Hold a neutral face ~1s: averages raw frames into per-shape offsets.
  calibrate(ms) {
    return new Promise((resolve) => {
      const acc = {}; let n = 0;
      this._calSink = (raw) => { for (const k in raw) acc[k] = (acc[k] || 0) + raw[k]; n++; };
      setTimeout(() => {
        this._calSink = null;
        if (n) { this.neutral = {}; for (const k in acc) this.neutral[k] = acc[k] / n; }
        resolve(n);
      }, ms || 1000);
    });
  }
  clearCalibration() { this.neutral = {}; }

  _process(raw, pose, ts) {
    if (this._calSink) this._calSink(raw);
    const out = {}; const a = this.smoothing;
    for (const k in raw) {
      let v = raw[k] - (this.neutral[k] || 0);
      v *= this.gain[this._group(k)] * this.gain.master;
      v = v < 0 ? 0 : v > 1 ? 1 : v;
      const p = this._smoothed[k];
      out[k] = this._smoothed[k] = p == null ? v : p * a + v * (1 - a);
    }
    let hp = null;
    if (pose && this.headAmplitude > 0) {
      // decompose column-major 4x4 → yaw/pitch/roll (mirror yaw/roll for selfie view)
      const m = pose.data || pose;
      const yaw = Math.atan2(-m[8], Math.hypot(m[0], m[4]));
      const pitch = Math.atan2(m[9], m[10]);
      const roll = Math.atan2(m[4], m[0]);
      hp = { yaw: -yaw * this.headAmplitude, pitch: pitch * this.headAmplitude, roll: -roll * this.headAmplitude };
      const pp = this._smoothPose;
      if (pp) { hp.yaw = pp.yaw * a + hp.yaw * (1 - a); hp.pitch = pp.pitch * a + hp.pitch * (1 - a); hp.roll = pp.roll * a + hp.roll * (1 - a); }
      this._smoothPose = hp;
    }
    if (this.recording) this._frames.push({ t: ts, w: out, hp });
    if (this.onWeights) this.onWeights(out, hp);
  }

  // ---- record a take ----
  startRecording() { this._frames = []; this._rec0 = performance.now(); this.recording = true; }
  // Returns {name, duration, tracks:[{name,times,values}]} ready for
  // AnimationClip assembly (same shape lipsync-engine bakes).
  stopRecording(name) {
    this.recording = false;
    const F = this._frames; this._frames = [];
    if (F.length < 2) return null;
    const t0 = F[0].t;
    const times = F.map(f => (f.t - t0) / 1000);
    const shapes = {};
    F.forEach(f => { for (const k in f.w) shapes[k] = true; });
    const tracks = Object.keys(shapes).map(k => ({ name: k, times, values: F.map(f => f.w[k] || 0) }));
    const pose = F.some(f => f.hp) ? { times, yaw: F.map(f => f.hp ? f.hp.yaw : 0), pitch: F.map(f => f.hp ? f.hp.pitch : 0), roll: F.map(f => f.hp ? f.hp.roll : 0) } : null;
    return { name: name || 'face take', duration: times[times.length - 1], fps: F.length / (times[times.length - 1] || 1), tracks, pose };
  }


  // start(videoEl): loads the model, opens the camera, streams weights.
  async start(video) {
    const lm = await getLandmarker(m => this._status(m));
    this._status('Asking for camera access\u2026');
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = this.stream;
    await video.play();
    this.video = video;
    this.running = true;
    this._status('');

    let lastTs = -1;
    const loop = () => {
      if (!this.running) return;
      const ts = performance.now();
      if (video.readyState >= 2 && ts - lastTs > 45) {   // ~22 fps is plenty
        lastTs = ts;
        try {
          const res = lm.detectForVideo(video, ts);
          const cats = res && res.faceBlendshapes && res.faceBlendshapes[0] && res.faceBlendshapes[0].categories;
          if (cats) {
            const weights = {};
            for (const c of cats) {
              if (c.categoryName === '_neutral') continue;
              weights[c.categoryName] = +c.score.toFixed(3);
            }
            const mtx = res.facialTransformationMatrixes && res.facialTransformationMatrixes[0];
            this._process(weights, mtx || null, ts);
          }
        } catch (e) { /* skip bad frames */ }
      }
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false; this.recording = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.video) { this.video.srcObject = null; this.video = null; }
    this._smoothed = {}; this._smoothPose = null;
  }
}

// ============================================================
// AutoLife — procedural idle: periodic blinks, gaze drift, breathing.
// A fallback layer so a face is never frozen: call sample(dt) every frame,
// mix its weights UNDER live capture (capture wins when tracking).
// ============================================================
export class AutoLife {
  constructor() {
    this.enabled = true;
    this._t = 0; this._nextBlink = 2 + Math.random() * 4; this._blinkT = -1;
    this._gaze = { x: 0, y: 0 }; this._gazeTgt = { x: 0, y: 0 }; this._nextGaze = 1.5;
  }
  sample(dt) {
    if (!this.enabled) return {};
    this._t += dt;
    const w = {};
    // blink: 0.12s down-up envelope every 3-7s
    this._nextBlink -= dt;
    if (this._nextBlink <= 0) { this._blinkT = 0; this._nextBlink = 3 + Math.random() * 4 + (Math.random() < 0.15 ? -2.6 : 0); }
    if (this._blinkT >= 0) {
      this._blinkT += dt;
      const p = this._blinkT / 0.12;
      const v = p >= 2 ? 0 : p <= 1 ? p : 2 - p;
      w.eyeBlinkLeft = w.eyeBlinkRight = Math.max(0, Math.min(1, v));
      if (p >= 2) this._blinkT = -1;
    }
    // gaze drift: new micro-target every 1.5-4s, eased
    this._nextGaze -= dt;
    if (this._nextGaze <= 0) { this._gazeTgt = { x: (Math.random() - 0.5) * 0.5, y: (Math.random() - 0.5) * 0.3 }; this._nextGaze = 1.5 + Math.random() * 2.5; }
    const g = this._gaze, k = Math.min(1, dt * 4);
    g.x += (this._gazeTgt.x - g.x) * k; g.y += (this._gazeTgt.y - g.y) * k;
    if (g.x > 0) { w.eyeLookOutRight = w.eyeLookInLeft = g.x; } else { w.eyeLookOutLeft = w.eyeLookInRight = -g.x; }
    if (g.y > 0) { w.eyeLookUpLeft = w.eyeLookUpRight = g.y; } else { w.eyeLookDownLeft = w.eyeLookDownRight = -g.y; }
    // breathing: subtle brow/jaw sine
    w.browInnerUp = 0.03 + 0.03 * Math.sin(this._t * 1.1);
    w.jawOpen = Math.max(0, 0.015 * Math.sin(this._t * 1.1 + 1));
    return w;
  }
}

try { window.PPFaceCapture = FaceCapture; window.PPAutoLife = AutoLife; } catch (e) {}
export default { FaceCapture, AutoLife };
