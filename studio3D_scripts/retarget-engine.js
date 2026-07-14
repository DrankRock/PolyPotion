// ============================================================
// retarget-engine.js — cross-skeleton animation retargeting
// ------------------------------------------------------------
// The Frontier Audit keystone: map source→target humanoid bones,
// transfer rotations (SkeletonUtils.retargetClip), rescale root
// motion, preview, export GLB. Loaded by dynamic import from
// Retarget.dc.html, like the other engines.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';
import * as SkeletonUtils from 'https://esm.sh/three@0.160.0/examples/jsm/utils/SkeletonUtils.js';
import { fetchAssetBuffer } from './chunk-loader.js';
import { buildBoneMap, detectConvention } from './bone-map.js';

export class RetargetEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = null;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    this.camera.position.set(2.6, 1.6, 3.4);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.set(0, 0.95, 0);
    this.controls.enableDamping = true;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1.15);
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(3, 6, 4);
    this.scene.add(hemi, key);
    const grid = new THREE.GridHelper(10, 20, 0x666a75, 0x3a3d45);
    grid.material.transparent = true; grid.material.opacity = 0.35;
    this.scene.add(grid);

    this.source = null;   // { root, clip, bones, map, convention, name, helper }
    this.target = null;   // { root, bones, map, convention, name, skinnedRoot }
    this.result = null;   // retargeted THREE.AnimationClip
    this.mixer = null; this.action = null;
    this.playing = true;
    this.showSource = true;

    this.onChange = null; this.onStatus = null;
    this._clock = new THREE.Clock();
    this._resize(); addEventListener('resize', () => this._resize());
    this.renderer.setAnimationLoop(() => this._tick());
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }
  _changed() { if (this.onChange) this.onChange(); }
  _resize() { const c = this.canvas, w = c.clientWidth || 2, h = c.clientHeight || 2; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  _tick() {
    this._resize(); this.controls.update();
    if (this.mixer && this.playing) this.mixer.update(this._clock.getDelta()); else this._clock.getDelta();
    this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------ loading
  async _parse(buf, ext, name) {
    ext = (ext || 'glb').toLowerCase();
    if (ext === 'fbx') {
      const obj = new FBXLoader().parse(buf, '');
      return { root: obj, clips: obj.animations || [] };
    }
    const gltf = await new GLTFLoader().parseAsync(buf, '');
    return { root: gltf.scene, clips: gltf.animations || [] };
  }

  _bonesOf(root) {
    const bones = [];
    root.traverse(o => { if (o.isBone) bones.push(o); });
    if (!bones.length) root.traverse(o => { if (o.isSkinnedMesh && o.skeleton) o.skeleton.bones.forEach(b => { if (!bones.includes(b)) bones.push(b); }); });
    return bones;
  }

  _normalize(root, x) {
    const box = new THREE.Box3().setFromObject(root);
    const h = Math.max(1e-6, box.max.y - box.min.y);
    const s = 1.7 / h;                    // stand everyone ~1.7 m tall for preview
    root.scale.multiplyScalar(s);
    root.position.y -= box.min.y * s;
    root.position.x = x;
    return s;
  }

  async loadSide(which, buf, name, ext) {
    this._status('Parsing ' + name + '…');
    const { root, clips } = await this._parse(buf, ext, name);
    const bones = this._bonesOf(root);
    if (!bones.length) { this._status(''); throw new Error(name + ' has no skeleton — rig it first (Rig tool)'); }
    const names = bones.map(b => b.name);
    const det = buildBoneMap(names);

    const old = this[which];
    if (old) { this.scene.remove(old.root); if (old.helper) this.scene.remove(old.helper); }

    this._normalize(root, which === 'source' ? -0.9 : 0.9);
    root.traverse(o => { if (o.isMesh) { o.frustumCulled = false; } });
    this.scene.add(root);
    const helper = new THREE.SkeletonHelper(root);
    helper.material.linewidth = 2;
    this.scene.add(helper);

    this[which] = {
      root, helper, bones, name,
      map: det.map, convention: det.convention,
      clip: which === 'source' ? (clips[0] || null) : null,
      clips: clips,
    };
    if (which === 'source' && !clips.length) { this._status(''); throw new Error(name + ' has no animation clips'); }
    this.result = null; this._stopPreview();
    this._status('');
    this._changed();
    return { name, bones: bones.length, clips: clips.length, convention: det.convention, mapped: Object.keys(det.map).length };
  }

  async loadUrl(which, url, ext, opts) { const buf = await fetchAssetBuffer(url, opts); return this.loadSide(which, buf, url.split('/').pop(), ext || url.split('.').pop()); }
  async loadFile(which, file) { return this.loadSide(which, await file.arrayBuffer(), file.name, file.name.split('.').pop()); }
  async loadBuffer(which, buf, name, ext) { return this.loadSide(which, buf, name, ext || (name || '').split('.').pop()); }

  setSourceClip(i) { if (this.source && this.source.clips[i]) { this.source.clip = this.source.clips[i]; this.result = null; this._stopPreview(); this._changed(); } }
  setShowSource(v) { this.showSource = v; if (this.source) { this.source.root.visible = v; this.source.helper.visible = v; } }

  // pair the two maps into SkeletonUtils `names` (targetBone → sourceBone)
  pairing() {
    if (!this.source || !this.target) return [];
    const rows = [];
    for (const [slot, tgt] of Object.entries(this.target.map)) {
      const src = this.source.map[slot];
      if (src) rows.push({ slot, source: src, target: tgt });
    }
    return rows;
  }

  // ------------------------------------------------ retarget
  retarget(opts) {
    opts = opts || {};
    if (!this.source || !this.source.clip) throw new Error('Load a source clip first');
    if (!this.target) throw new Error('Load a target character first');

    const rows = this.pairing();
    if (rows.length < 8) throw new Error('Only ' + rows.length + ' bones auto-mapped — skeletons too dissimilar');

    const names = {};                         // target bone name → source bone name
    rows.forEach(r => { names[r.target] = r.source; });

    // SkeletonUtils.retargetClip wants skinned meshes / bone containers
    const srcSkin = this._skinOrRoot(this.source.root);
    const tgtSkin = this._skinOrRoot(this.target.root);

    // hip height ratio → scales root translation so strides match leg length
    const hipS = this._boneY(this.source, 'hips'), hipT = this._boneY(this.target, 'hips');
    const hipRatio = (hipS > 1e-4 && hipT > 1e-4) ? (hipT / hipS) : 1;

    this._status('Retargeting ' + this.source.clip.name + '…');
    const clip = SkeletonUtils.retargetClip(tgtSkin, srcSkin, this.source.clip, {
      names,
      preserveHipPosition: !!opts.preserveHips,
      useFirstFramePosition: true,
      hip: this.target.map.hips || 'hips',
      scale: hipRatio,
    });
    clip.name = (this.source.clip.name || 'clip') + ' → ' + (this.target.name || 'target').replace(/\.[a-z0-9]+$/i, '');
    this.result = clip;
    this._status('');
    this._preview();
    this._changed();
    return { name: clip.name, tracks: clip.tracks.length, duration: clip.duration, bones: rows.length, hipRatio };
  }

  _skinOrRoot(root) {
    let skin = null;
    root.traverse(o => { if (!skin && o.isSkinnedMesh) skin = o; });
    return skin || root;
  }
  _boneY(side, slot) {
    const nm = side.map[slot]; if (!nm) return 0;
    const b = side.bones.find(x => x.name === nm); if (!b) return 0;
    const p = new THREE.Vector3(); b.getWorldPosition(p); return p.y;
  }

  _preview() {
    this._stopPreview();
    if (!this.result || !this.target) return;
    this.mixer = new THREE.AnimationMixer(this.target.root);
    this.action = this.mixer.clipAction(this.result);
    this.action.play();
    // play the source side in sync for comparison
    if (this.source && this.source.clip) {
      this._srcMixer = new THREE.AnimationMixer(this.source.root);
      this._srcAction = this._srcMixer.clipAction(this.source.clip);
      this._srcAction.play();
      const tick = this.mixer.update.bind(this.mixer);
      this.mixer.update = dt => { tick(dt); this._srcMixer.update(dt); };
    }
  }
  _stopPreview() { if (this.mixer) { this.mixer.stopAllAction(); this.mixer = null; } if (this._srcMixer) { this._srcMixer.stopAllAction(); this._srcMixer = null; } }
  setPlaying(v) { this.playing = v; }

  // ------------------------------------------------ export
  async exportGLB() {
    if (!this.result || !this.target) throw new Error('Retarget first');
    this._status('Packing GLB…');
    const root = this.target.root;
    const savedPos = root.position.clone(), savedScale = root.scale.clone();
    root.position.set(0, 0, 0);               // export clean, un-staged transform
    const buf = await new Promise((res, rej) => {
      new GLTFExporter().parse(root, res, rej, { binary: true, animations: [this.result] });
    });
    root.position.copy(savedPos); root.scale.copy(savedScale);
    this._status('');
    return buf;   // ArrayBuffer
  }

  stats() {
    return {
      source: this.source ? { name: this.source.name, convention: this.source.convention, bones: this.source.bones.length, clips: this.source.clips.map(c => c.name), clip: this.source.clip && this.source.clip.name } : null,
      target: this.target ? { name: this.target.name, convention: this.target.convention, bones: this.target.bones.length } : null,
      pairs: this.pairing(),
      result: this.result ? { name: this.result.name, duration: this.result.duration, tracks: this.result.tracks.length } : null,
    };
  }
}
