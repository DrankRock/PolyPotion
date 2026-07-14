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
        outputFacialTransformationMatrixes: false,
        runningMode: 'VIDEO',
        numFaces: 1,
      });
    })().catch(e => { landmarkerPromise = null; throw e; });
  }
  return landmarkerPromise;
}

export class FaceCapture {
  constructor() {
    this.onWeights = null;   // (map: arkitName -> 0..1) per processed frame
    this.onStatus = null;    // progress strings while loading
    this.running = false;
  }
  _status(m) { if (this.onStatus) this.onStatus(m); }

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
          if (cats && this.onWeights) {
            const weights = {};
            for (const c of cats) {
              if (c.categoryName === '_neutral') continue;
              weights[c.categoryName] = +c.score.toFixed(3);
            }
            this.onWeights(weights);
          }
        } catch (e) { /* skip bad frames */ }
      }
      this._raf = requestAnimationFrame(loop);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.video) { this.video.srcObject = null; this.video = null; }
  }
}

try { window.PPFaceCapture = FaceCapture; } catch (e) {}
export default { FaceCapture };
