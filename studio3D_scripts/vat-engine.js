// ============================================================
// vat-engine.js — VAT BAKE  (VATEngine)
// Vertex Animation Textures: bake an animation CLIP into a texture and let a
// two-line vertex shader replay it with ZERO skeleton cost — the trick behind
// huge crowds, destructible props and cheap facial playback on the GPU.
//
// It is a pure texture bake, no runtime: sample the skinned / morphed / rigid
// mesh at N frames, write each vertex's WORLD position (and normal) into one
// texel of a texture (column = vertex id via gl_VertexID, row = frame), and
// hand back a position PNG + normal PNG + a static mesh + the shader that
// reads them. The viewport plays the baked VAT mesh — no AnimationMixer, no
// bones — so you can see the trick working before you export it.
//
// Loaded by dynamic import from VAT.dc.html, like the other engines.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { fetchAssetBuffer } from './chunk-loader.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const readVar = (name, fb) => { try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fb; } catch (e) { return fb; } };

// The two-line replay, documented for export. Kept in one place so the
// shader the viewport runs and the shader the user downloads never drift.
const VAT_VERT = `// VAT replay — no skeleton, no mixer. Feed uTime in [0,1].
uniform sampler2D posTex;      // baked position map
uniform sampler2D nrmTex;      // baked normal map (optional)
uniform vec3  posMin, posMax;  // decode bounds from the bake report
uniform float uFrames, uVerts; // texture height / width
uniform float uTime;           // 0..1 playhead
uniform bool  uUseNrm;
out vec3 vN; out vec3 vWorld;
void main() {
  float col = (float(gl_VertexID) + 0.5) / uVerts;   // ← this vertex's column
  float f   = uTime * (uFrames - 1.0);
  float r0  = (floor(f)      + 0.5) / uFrames;
  float r1  = (min(floor(f) + 1.0, uFrames - 1.0) + 0.5) / uFrames;
  float t   = fract(f);
  vec3 pn   = mix(texture(posTex, vec2(col, r0)).rgb,
                  texture(posTex, vec2(col, r1)).rgb, t);
  vec3 pos  = mix(posMin, posMax, pn);               // ← decode → world position
  vec3 nrm  = normal;
  if (uUseNrm) nrm = normalize(mix(texture(nrmTex, vec2(col, r0)).rgb,
                                   texture(nrmTex, vec2(col, r1)).rgb, t) * 2.0 - 1.0);
  vN = normalize(mat3(modelMatrix) * nrm);
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const VAT_FRAG = `precision highp float;
in vec3 vN; in vec3 vWorld;
out vec4 outColor;
uniform vec3 uColor;
void main() {
  vec3 N = normalize(vN);
  if (!gl_FrontFacing) N = -N;
  vec3 L = normalize(vec3(2.4, 4.2, 3.0));
  float key = max(0.0, dot(N, L));
  float rim = pow(1.0 - max(0.0, dot(N, normalize(vec3(0.0, 0.4, 1.0)))), 2.5) * 0.25;
  float amb = 0.28 + 0.14 * (0.5 + 0.5 * N.y);
  vec3 c = uColor * (amb + 0.85 * key) + rim * vec3(0.5, 0.62, 0.85);
  outColor = vec4(c, 1.0);
}`;

export class VATEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(readVar('--viewport', '#16181c'));
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(readVar('--viewport', '#16181c')); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 100);
    this.camera.position.set(1.6, 1.3, 3.2);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.95, 0);
    this.controls.minDistance = 0.3; this.controls.maxDistance = 16;

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.0));
    const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(2.4, 4.2, 3.0);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 16;
    key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0009; this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.5); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.28 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; this.scene.add(floor);

    this.root = new THREE.Group(); this.scene.add(this.root);   // holds the SOURCE (skinned) model
    this.vatRoot = new THREE.Group(); this.scene.add(this.vatRoot); // holds the baked VAT mesh

    this.model = null; this.mixer = null; this.clips = [];
    this.srcMesh = null;                 // primary mesh we bake (largest vertex count)
    this.activeClip = 0;
    this.modelName = ''; this.modelRadius = 1; this.modelCenter = V(0, 0.95, 0);

    this.baked = null;                   // { frames, verts, posMin, posMax, posTex, nrmTex, geo, dur, clipName, includeNrm }
    this.vatMesh = null;
    this.showSource = true;              // preview toggle: source skinned vs baked VAT
    this.playing = true; this.time = 0;  // preview playhead 0..1
    this.speed = 1;

    this.onStatus = null; this.onChange = null;
    this._gltf = new GLTFLoader(); this._fbx = new FBXLoader();

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._clock = new THREE.Clock();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__vatEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  hasModel() { return !!this.model; }
  hasBake() { return !!this.baked; }

  // ---------------------------------------------------------- LOADING
  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts);
    return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop());
  }
  async loadFile(file) { return this._ingest(await file.arrayBuffer(), (file.name.split('.').pop() || '').toLowerCase(), file.name); }
  async loadBuffer(buf, name, ext) { return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name); }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || ext) + '…');
    let root, clips = [];
    if (ext === 'glb' || ext === 'gltf') {
      const g = await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej));
      root = g.scene || (g.scenes && g.scenes[0]); clips = g.animations || [];
    } else if (ext === 'fbx') {
      root = this._fbx.parse(buf, ''); clips = root.animations || [];
    } else throw new Error('VAT needs an animated .glb / .gltf / .fbx — got .' + ext);

    this._disposeModel();
    root.updateMatrixWorld(true);

    // normalize into a ~1.8m-tall, floor-planted model (same convention as the other tools)
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const s = 1.8 / (size.y || 1);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2, minY = box.min.y;
    root.scale.setScalar(s);
    root.position.set(-cx * s, -minY * s, -cz * s);

    this.root.add(root); this.model = root; this.clips = clips;
    root.updateMatrixWorld(true);

    // pick the primary mesh to bake: the one with the most vertices
    let best = null, bestN = 0;
    root.traverse(o => {
      if ((o.isSkinnedMesh || o.isMesh) && o.geometry && o.geometry.attributes.position) {
        const n = o.geometry.attributes.position.count;
        if (n > bestN) { bestN = n; best = o; }
      }
    });
    if (!best) throw new Error('No mesh found in file');
    this.srcMesh = best;

    this.mixer = clips.length ? new THREE.AnimationMixer(root) : null;
    this.activeClip = 0;
    if (this.mixer && clips.length) { const a = this.mixer.clipAction(clips[0]); a.play(); }

    this.modelName = (name || 'model').replace(/\.(glb|gltf|fbx)$/i, '');
    const b2 = new THREE.Box3().setFromObject(root);
    this.modelCenter = b2.getCenter(new THREE.Vector3());
    this.modelRadius = b2.getBoundingSphere(new THREE.Sphere()).radius || 1;

    this.baked = null; this._disposeVat();
    this.showSource = true; this._applyVisibility();
    this._frame(); this._status(''); this._changed();
    return this.stats();
  }

  stats() {
    const m = this.srcMesh;
    return {
      name: this.modelName,
      verts: m ? m.geometry.attributes.position.count : 0,
      tris: m ? (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3 : 0,
      hasSkin: !!(m && m.isSkinnedMesh && m.skeleton),
      hasMorph: !!(m && m.geometry.morphAttributes && m.geometry.morphAttributes.position),
      meshType: !m ? '—' : (m.isSkinnedMesh && m.skeleton ? 'skinned' : (m.geometry.morphAttributes && m.geometry.morphAttributes.position ? 'morph' : 'rigid')),
      clips: this.clips.map((c, i) => ({ i, name: c.name || ('Clip ' + (i + 1)), duration: +(c.duration || 0).toFixed(2) })),
      activeClip: this.activeClip,
      bake: this.baked ? { frames: this.baked.frames, verts: this.baked.verts, includeNrm: this.baked.includeNrm, clipName: this.baked.clipName, kb: this.baked.kb } : null,
    };
  }

  setClip(i) {
    if (!this.mixer || !this.clips[i]) return;
    this.mixer.stopAllAction();
    this.mixer.clipAction(this.clips[i]).play();
    this.activeClip = i; this._changed();
  }

  // ---------------------------------------------------------- BAKE
  // Sample the active clip at `frames` steps; write each vertex's WORLD
  // position + normal into row=frame, col=vertexId. Positions are normalized
  // into the global bake bbox so 8-bit RGB carries them; bounds go in the report.
  async bake(opts) {
    opts = opts || {};
    const frames = Math.max(2, Math.min(256, opts.frames || 64));
    const includeNrm = opts.includeNormals !== false;
    const mesh = this.srcMesh;
    if (!mesh) throw new Error('Load an animated model first');
    if (!this.clips.length) throw new Error('This file has no animation clips to bake');

    const geo = mesh.geometry;
    const verts = geo.attributes.position.count;
    if (verts > 16384) throw new Error('Mesh has ' + verts.toLocaleString() + ' verts — over the 16,384 VAT texture width. Decimate it first.');

    const clip = this.clips[this.activeClip];
    const dur = clip.duration || 1;
    const useBone = !!(mesh.isSkinnedMesh && mesh.skeleton);
    const morphAttr = geo.morphAttributes && geo.morphAttributes.position;
    const useMorph = !useBone && !!morphAttr;
    const boneFn = mesh.applyBoneTransform ? 'applyBoneTransform' : 'boneTransform';

    // dedicated mixer so we don't disturb the live preview mixer
    const bakeMixer = new THREE.AnimationMixer(this.model);
    bakeMixer.stopAllAction();
    const action = bakeMixer.clipAction(clip); action.play();

    const basePos = geo.attributes.position;
    const idx = geo.index ? geo.index.array : null;
    const posAll = new Float32Array(verts * frames * 3);   // world positions, row-major by frame
    const nrmAll = includeNrm ? new Float32Array(verts * frames * 3) : null;
    const tmp = new THREE.Vector3();
    const min = V(Infinity, Infinity, Infinity), max = V(-Infinity, -Infinity, -Infinity);

    for (let f = 0; f < frames; f++) {
      if (f % 8 === 0) { this._status('Baking frame ' + (f + 1) + ' / ' + frames + '…'); await new Promise(r => setTimeout(r, 0)); }
      const t = frames === 1 ? 0 : (f / (frames - 1)) * dur;
      bakeMixer.setTime(t);
      this.model.updateMatrixWorld(true);
      if (useBone) mesh.skeleton.update();
      const mw = mesh.matrixWorld;
      const rowBase = f * verts * 3;

      for (let i = 0; i < verts; i++) {
        tmp.fromBufferAttribute(basePos, i);
        if (useBone) { mesh[boneFn](i, tmp); }
        else if (useMorph) {
          const infl = mesh.morphTargetInfluences || [];
          const rel = geo.morphTargetsRelative;
          for (let m = 0; m < morphAttr.length; m++) {
            const w = infl[m] || 0; if (!w) continue;
            const mx = morphAttr[m].getX(i), my = morphAttr[m].getY(i), mz = morphAttr[m].getZ(i);
            if (rel) { tmp.x += w * mx; tmp.y += w * my; tmp.z += w * mz; }
            else { tmp.x += w * (mx - basePos.getX(i)); tmp.y += w * (my - basePos.getY(i)); tmp.z += w * (mz - basePos.getZ(i)); }
          }
        }
        tmp.applyMatrix4(mw);
        const o = rowBase + i * 3;
        posAll[o] = tmp.x; posAll[o + 1] = tmp.y; posAll[o + 2] = tmp.z;
        if (tmp.x < min.x) min.x = tmp.x; if (tmp.y < min.y) min.y = tmp.y; if (tmp.z < min.z) min.z = tmp.z;
        if (tmp.x > max.x) max.x = tmp.x; if (tmp.y > max.y) max.y = tmp.y; if (tmp.z > max.z) max.z = tmp.z;
      }

      if (includeNrm) this._frameNormals(posAll, rowBase, verts, idx, nrmAll);
    }
    bakeMixer.stopAllAction(); bakeMixer.uncacheClip(clip);

    // guard against a zero-extent axis (planar / static)
    const span = V(max.x - min.x || 1e-4, max.y - min.y || 1e-4, max.z - min.z || 1e-4);

    // encode to Uint8 — width = verts, height = frames
    const posU8 = new Uint8Array(verts * frames * 4);
    const nrmU8 = includeNrm ? new Uint8Array(verts * frames * 4) : null;
    for (let f = 0; f < frames; f++) {
      for (let i = 0; i < verts; i++) {
        const s = (f * verts + i) * 3, d = (f * verts + i) * 4;
        posU8[d] = this._enc((posAll[s] - min.x) / span.x);
        posU8[d + 1] = this._enc((posAll[s + 1] - min.y) / span.y);
        posU8[d + 2] = this._enc((posAll[s + 2] - min.z) / span.z);
        posU8[d + 3] = 255;
        if (includeNrm) {
          nrmU8[d] = this._enc(nrmAll[s] * 0.5 + 0.5);
          nrmU8[d + 1] = this._enc(nrmAll[s + 1] * 0.5 + 0.5);
          nrmU8[d + 2] = this._enc(nrmAll[s + 2] * 0.5 + 0.5);
          nrmU8[d + 3] = 255;
        }
      }
    }

    const posTex = this._dataTex(posU8, verts, frames, true);
    const nrmTex = includeNrm ? this._dataTex(nrmU8, verts, frames, false) : null;

    const kb = Math.round((posU8.length + (nrmU8 ? nrmU8.length : 0)) / 1024);
    this.baked = {
      frames, verts, includeNrm, clipName: clip.name || ('Clip ' + (this.activeClip + 1)), dur,
      posMin: min.clone(), posMax: max.clone(), posTex, nrmTex, posU8, nrmU8, kb,
      meshType: useBone ? 'skinned' : (useMorph ? 'morph' : 'rigid'),
    };
    this._buildVatMesh();
    this.showSource = false; this._applyVisibility();
    this._status(''); this._changed();
    return { frames, verts, kb, includeNrm, meshType: this.baked.meshType, dims: verts + '×' + frames };
  }

  _enc(v) { return Math.max(0, Math.min(255, Math.round(v * 255))); }

  // per-frame smooth normals recomputed from the freshly-skinned world positions
  _frameNormals(posAll, rowBase, verts, idx, out) {
    const n = new Float32Array(verts * 3);
    const ax = new THREE.Vector3(), bx = new THREE.Vector3(), cx = new THREE.Vector3(), cb = new THREE.Vector3(), abv = new THREE.Vector3();
    const face = (a, b, c) => {
      ax.set(posAll[rowBase + a * 3], posAll[rowBase + a * 3 + 1], posAll[rowBase + a * 3 + 2]);
      bx.set(posAll[rowBase + b * 3], posAll[rowBase + b * 3 + 1], posAll[rowBase + b * 3 + 2]);
      cx.set(posAll[rowBase + c * 3], posAll[rowBase + c * 3 + 1], posAll[rowBase + c * 3 + 2]);
      cb.subVectors(cx, bx); abv.subVectors(ax, bx); cb.cross(abv);
      n[a * 3] += cb.x; n[a * 3 + 1] += cb.y; n[a * 3 + 2] += cb.z;
      n[b * 3] += cb.x; n[b * 3 + 1] += cb.y; n[b * 3 + 2] += cb.z;
      n[c * 3] += cb.x; n[c * 3 + 1] += cb.y; n[c * 3 + 2] += cb.z;
    };
    if (idx) { for (let i = 0; i < idx.length; i += 3) face(idx[i], idx[i + 1], idx[i + 2]); }
    else { for (let i = 0; i < verts; i += 3) face(i, i + 1, i + 2); }
    for (let i = 0; i < verts; i++) {
      const o = i * 3; let x = n[o], y = n[o + 1], z = n[o + 2];
      const l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
      out[rowBase + o] = x; out[rowBase + o + 1] = y; out[rowBase + o + 2] = z;
    }
  }

  _dataTex(u8, w, h, srgb) {
    const t = new THREE.DataTexture(u8, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
    t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
    t.generateMipmaps = false; t.flipY = false;
    t.colorSpace = THREE.NoColorSpace;   // positions/normals are DATA, never sRGB
    t.needsUpdate = true;
    return t;
  }

  // static preview mesh driven only by the VAT shader (no skeleton in the graph)
  _buildVatMesh() {
    this._disposeVat();
    const src = this.srcMesh.geometry;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', src.attributes.position.clone()); // used only for gl_VertexID count + fallback normal
    if (src.attributes.normal) geo.setAttribute('normal', src.attributes.normal.clone());
    if (src.index) geo.setIndex(src.index.clone());
    geo.computeBoundingBox(); geo.computeBoundingSphere();

    const b = this.baked;
    const accent = new THREE.Color(readVar('--accent', '#7c83ff'));
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      uniforms: {
        posTex: { value: b.posTex }, nrmTex: { value: b.nrmTex || b.posTex },
        posMin: { value: b.posMin.clone() }, posMax: { value: b.posMax.clone() },
        uFrames: { value: b.frames }, uVerts: { value: b.verts },
        uTime: { value: this.time }, uUseNrm: { value: !!b.includeNrm },
        uColor: { value: new THREE.Vector3(accent.r, accent.g, accent.b) },
      },
      vertexShader: VAT_VERT, fragmentShader: VAT_FRAG, side: THREE.DoubleSide,
    });
    this.vatMesh = new THREE.Mesh(geo, mat);
    this.vatMesh.frustumCulled = false;   // real bbox lives in the texture, not the base positions
    this.vatRoot.add(this.vatMesh);
  }

  setColor(hex) {
    if (!this.vatMesh) return;
    const c = new THREE.Color(hex);
    this.vatMesh.material.uniforms.uColor.value.set(c.r, c.g, c.b);
  }

  // ---------------------------------------------------------- PREVIEW CONTROL
  showBaked(on) {  // true → show VAT mesh, false → show source skinned model
    this.showSource = !on;
    this._applyVisibility(); this._changed();
  }
  _applyVisibility() {
    this.root.visible = this.showSource || !this.baked;
    this.vatRoot.visible = !!this.baked && !this.showSource;
  }
  setPlaying(p) { this.playing = !!p; if (this.playing) this._clock.getDelta(); this._changed(); }
  setSpeed(s) { this.speed = s; }
  seek(t) { this.time = Math.max(0, Math.min(1, t)); this._applyTime(); this._changed(); }

  _applyTime() {
    if (this.vatMesh) this.vatMesh.material.uniforms.uTime.value = this.time;
    if (this.mixer) {
      const dur = (this.clips[this.activeClip] && this.clips[this.activeClip].duration) || 1;
      this.mixer.setTime(this.time * dur);
    }
  }

  // ---------------------------------------------------------- EXPORT
  async exportPack() {
    const b = this.baked;
    if (!b) throw new Error('Bake first');
    this._status('Packing VAT export…');
    const base = (this.modelName || 'mesh') + '_' + this._safe(b.clipName);
    const posPNG = await this._u8ToPNG(b.posU8, b.verts, b.frames);
    const nrmPNG = b.includeNrm ? await this._u8ToPNG(b.nrmU8, b.verts, b.frames) : null;
    const glb = await this._exportStaticGLB();
    const report = this.report();
    const readme = this._readme(base, report);
    this._status('');
    return { base, posPNG, nrmPNG, glb, readme, report, shader: VAT_VERT + '\n\n/* --- fragment --- */\n' + VAT_FRAG };
  }

  report() {
    const b = this.baked; if (!b) return null;
    const r3 = v => [+v.x.toFixed(5), +v.y.toFixed(5), +v.z.toFixed(5)];
    return {
      format: 'PolyPotion-VAT/1',
      mesh: this.modelName, clip: b.clipName, meshType: b.meshType,
      frames: b.frames, verts: b.verts, fps: +((b.frames - 1) / (b.dur || 1)).toFixed(3),
      duration: +(b.dur || 0).toFixed(3),
      textureSize: { width: b.verts, height: b.frames },
      encoding: '8-bit RGB, bounds-normalized; decode = mix(posMin, posMax, rgb)',
      posMin: r3(b.posMin), posMax: r3(b.posMax),
      normalMap: !!b.includeNrm, normalEncoding: b.includeNrm ? 'rgb*2-1' : null,
      lookup: 'col = (gl_VertexID+0.5)/verts ; row = (frame+0.5)/frames',
    };
  }

  async _u8ToPNG(u8, w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(w, h);
    img.data.set(u8);
    ctx.putImageData(img, 0, 0);
    return await new Promise(res => cv.toBlob(res, 'image/png'));
  }

  // static mesh, skinning stripped — this is what the VAT shader displaces.
  async _exportStaticGLB() {
    const { GLTFExporter } = await import('https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js');
    const src = this.srcMesh.geometry;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', src.attributes.position.clone());
    if (src.attributes.normal) geo.setAttribute('normal', src.attributes.normal.clone());
    if (src.attributes.uv) geo.setAttribute('uv', src.attributes.uv.clone());
    if (src.index) geo.setIndex(src.index.clone());
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ name: 'vat_target' }));
    mesh.name = (this.modelName || 'mesh') + '_VATmesh';
    const buf = await new Promise((res, rej) => new GLTFExporter().parse(mesh, res, rej, { binary: true }));
    geo.dispose();
    return buf;
  }

  _readme(base, r) {
    return [
      'PolyPotion — Vertex Animation Texture pack',
      '=========================================',
      '',
      'Files:',
      '  ' + base + '_pos.png    position map  (' + r.textureSize.width + '\u00d7' + r.textureSize.height + ', 8-bit RGB, bounds-normalized)',
      (r.normalMap ? '  ' + base + '_nrm.png    normal map    (same size, rgb = normal*0.5+0.5)\n' : '') +
      '  ' + base + '_VATmesh.glb static mesh    (skinning stripped — the shader displaces this)',
      '  ' + base + '_vat.json    bake report   (bounds, frames, fps — the decode constants)',
      '',
      'Bake: clip "' + r.clip + '", ' + r.frames + ' frames, ' + r.verts + ' verts, ' + r.fps + ' fps, type ' + r.meshType + '.',
      '',
      'Decode bounds (feed these to the shader):',
      '  posMin = [' + r.posMin.join(', ') + ']',
      '  posMax = [' + r.posMax.join(', ') + ']',
      '',
      'Playback: one texture read per vertex, no skeleton. Drive uTime in [0,1].',
      'Column selects the vertex: col = (gl_VertexID + 0.5) / verts.',
      'Row selects the frame:     row = (uTime*(frames-1) + 0.5) / frames.',
      'Import the mesh and the position map into any engine, set the texture',
      'filter to POINT/Nearest with no mips, and paste the shader below.',
      '',
      '--- shader (GLSL3 vertex) ---',
      VAT_VERT,
      '',
      'Unity/Unreal: the same lookup works in HLSL — sample the position map by',
      'UV (vertexID/width, time), lerp(posMin,posMax,rgb), write to the vertex.',
    ].join('\n');
  }

  _safe(s) { return String(s || 'clip').replace(/[^a-z0-9._-]+/gi, '_').slice(0, 40); }

  // ---------------------------------------------------------- VIEW
  setView(name) {
    const c = this.modelCenter, r = this.modelRadius, d = r * 2.6;
    this.controls.target.copy(c);
    const set = (x, y, z) => this.camera.position.set(x, y, z);
    if (name === 'front') set(c.x, c.y, c.z + d);
    else if (name === 'side') set(c.x + d, c.y, c.z);
    else if (name === 'top') set(c.x + 0.001, c.y + d, c.z + 0.001);
    else if (name === 'back') set(c.x, c.y, c.z - d);
    else set(c.x + r * 0.6, c.y + r * 0.2, c.z + d);
    this.controls.update();
  }
  _frame() {
    const c = this.modelCenter, r = this.modelRadius;
    this.controls.target.copy(c);
    this.camera.position.set(c.x + r * 0.7, c.y + r * 0.15, c.z + r * 2.7);
    this.controls.update();
  }
  frameModel() { this._frame(); }

  _disposeVat() {
    if (this.vatMesh) { this.vatRoot.remove(this.vatMesh); this.vatMesh.geometry.dispose(); this.vatMesh.material.dispose(); this.vatMesh = null; }
    if (this.baked) { try { this.baked.posTex && this.baked.posTex.dispose(); this.baked.nrmTex && this.baked.nrmTex.dispose(); } catch (e) {} }
  }
  _disposeModel() {
    if (this.model) { this.root.remove(this.model); this.model.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.geometry && o.geometry.dispose(); } }); this.model = null; }
    if (this.mixer) { try { this.mixer.stopAllAction(); } catch (e) {} this.mixer = null; }
    this.srcMesh = null; this.clips = [];
  }
  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return; requestAnimationFrame(this._loop);
    const dt = this._clock.getDelta();
    if (this.playing) {
      const dur = (this.clips[this.activeClip] && this.clips[this.activeClip].duration) || 1;
      this.time = (this.time + (dt * this.speed) / dur) % 1;
      if (this.time < 0) this.time += 1;
      this._applyTime();
      if (this._onTick) this._onTick(this.time);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} this._disposeVat(); this.renderer.dispose(); }
}

export default VATEngine;
