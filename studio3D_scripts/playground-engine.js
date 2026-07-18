// ============================================================
// playground-engine.js — PGEngine: the persona playground.
// Extends SCEngine (loading, normalize, semantic retarget, IBL, XR) with a
// drivable third-person character controller: WASD / arrows / gamepad, jump
// physics over a little obstacle course, follow-cam or first-person POV,
// a real mirror (Reflector) for the persona check, and clip slots
// (idle / walk / run / jump) crossfaded by movement state.
// Loaded by dynamic import from Playground.dc.html.
// ============================================================
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { SCEngine } from './showcase-engine.js';

const WALK = 2.0, RUN = 4.5, ACCEL = 12, JUMP_V = 5.2, GRAV = 14, R = 0.3;
const dead = v => Math.abs(v || 0) < 0.16 ? 0 : v;
const clamp = THREE.MathUtils.clamp;
function dampAngle(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * k;
}

export class PGEngine extends SCEngine {
  constructor(canvas) {
    super(canvas);
    this.driving = false; this.povMode = false;
    this.slots = {};
    this.faceOffset = 0;
    this._keys = {};
    this._pos = new THREE.Vector3(); this._vel = new THREE.Vector3();
    this._yaw = 0; this._povPitch = 0;
    this._camYaw = Math.PI * 0.05; this._camPitch = 0.3; this._camDist = 4;
    this._onGround = true; this._padJump = false; this._jumpQueued = false;
    this._h = 1.7;
    this.onDrive = null;
    this._buildWorld();
    this._buildFun();
    this._installDriveInput(canvas);
    this._pgClock = new THREE.Clock();
    const tick = () => { try { this._pgTick(); } catch (e) {} requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }

  // ---------- the world ----------
  _buildWorld() {
    const W = new THREE.Group(); this.world = W; this.scene.add(W);
    this.solids = [];
    const mat = (c, r) => new THREE.MeshStandardMaterial({ color: c, roughness: r == null ? 0.85 : r });
    const box = (w, h, d, x, y, z, c) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
      m.position.set(x, y + h / 2, z); m.castShadow = m.receiveShadow = true; W.add(m);
      this.solids.push({ x, z, hw: w / 2, hd: d / 2, y0: y, y1: y + h });
      return m;
    };
    // ground disc + spawn ring (sits just under the shadow catcher)
    const g = new THREE.Mesh(new THREE.CircleGeometry(17, 72), mat(0x30362f, 0.96));
    g.rotation.x = -Math.PI / 2; g.position.y = -0.02; g.receiveShadow = true; W.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.45, 64), mat(0x6e9355, 0.9));
    ring.rotation.x = -Math.PI / 2; ring.position.y = -0.005; W.add(ring);
    // crates
    box(0.85, 0.85, 0.85, 2.6, 0, 1.6, 0x6b4a2b);
    box(0.7, 0.7, 0.7, 3.3, 0, 2.3, 0x7d5836);
    box(0.7, 0.7, 0.7, 2.9, 0.85, 1.8, 0x5d3f24);
    // stairs up to a lookout
    for (let i = 0; i < 4; i++) box(1.7, 0.34 * (i + 1), 0.72, 5.4, 0, -0.6 - i * 0.72, 0x4a4f58);
    box(2.4, 1.36, 2.4, 5.4, 0, -4.6, 0x565c66);
    // jump pads (each hop ≤ jump height)
    box(1.5, 0.28, 1.5, -3.2, 0.5, 3.2, 0x8a6a3b);
    box(1.4, 0.28, 1.4, -5.0, 1.15, 4.6, 0x8a6a3b);
    box(1.3, 0.28, 1.3, -6.8, 1.8, 6.0, 0x8a6a3b);
    // pillars
    box(0.6, 3.4, 0.6, -7, 0, -5, 0x4a4f58);
    box(0.6, 2.6, 0.6, 8, 0, 5, 0x4a4f58);
    // the mirror — the persona check
    const MG = new THREE.Group();
    const refl = new Reflector(new THREE.PlaneGeometry(1.9, 2.9), {
      clipBias: 0.003, textureWidth: 1024, textureHeight: 1024, color: 0x9aa4b0,
    });
    refl.position.y = 1.55; MG.add(refl);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.12), mat(0x6b4a2b, 0.6));
    frame.position.set(0, 1.55, -0.08); frame.castShadow = true; MG.add(frame);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 0.7), mat(0x5d3f24, 0.7));
    base.position.y = 0.06; MG.add(base);
    MG.position.set(-4.2, 0, -3.0);
    MG.rotation.y = Math.atan2(0 - MG.position.x, 0 - MG.position.z);
    W.add(MG); this.mirror = MG;
    this.solids.push({ x: -4.2, z: -3.0, hw: 1.1, hd: 0.35, y0: 0, y1: 3.1 });
  }
  toggleMirror(on) { if (this.mirror) this.mirror.visible = on; }

  // ---------- the fun layer: potions, ball, pads, particles ----------
  _buildFun() {
    const W = this.world;
    const mat = (c, opts) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6 }, opts || {}));
    this.fun = { got: 0, total: 0, time: 0, done: false, started: false, t0: 0 };
    // potion bottles to collect (ground + on top of the course)
    this._potions = [];
    const spots = [[0, 0, -3.2], [2.9, 1.55, 1.8], [5.4, 1.36, -4.6], [-3.2, 0.78, 3.2], [-6.8, 2.08, 6.0], [7.6, 0, 3.5], [-2, 0, -6.5], [6.5, 0, 7.5]];
    const glass = mat(0x9fd8c8, { transparent: true, opacity: 0.45, roughness: 0.15 });
    spots.forEach(([x, y, z]) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), glass); body.scale.y = 1.15; g.add(body);
      const liquid = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), mat(0x9a5cd0, { emissive: 0x6a3a99, emissiveIntensity: 0.9, roughness: 0.3 }));
      liquid.position.y = -0.02; g.add(liquid);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.13, 10), glass); neck.position.y = 0.2; g.add(neck);
      const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), mat(0x6b4a2b, { roughness: 0.9 })); cork.position.y = 0.29; g.add(cork);
      g.position.set(x, y + 0.42, z);
      W.add(g);
      this._potions.push({ g, x, z, y: y + 0.42, got: false });
    });
    this.fun.total = this._potions.length;
    try { this.fun.best = parseFloat(localStorage.getItem('pp.playgroundBest')) || 0; } catch (e) { this.fun.best = 0; }
    // trampoline (bouncy solid)
    const tramp = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.26, 1.7), mat(0x3f7d4f, { roughness: 0.5 }));
    tramp.position.set(7, 0.13, -1); tramp.castShadow = tramp.receiveShadow = true; W.add(tramp);
    const trampTop = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 1.5), mat(0x6e9355, { emissive: 0x2c4a22, emissiveIntensity: 0.6 }));
    trampTop.position.set(7, 0.28, -1); W.add(trampTop);
    this.solids.push({ x: 7, z: -1, hw: 0.85, hd: 0.85, y0: 0, y1: 0.26, bounce: 12.5 });
    // boost pad (flat, no collision)
    const boost = new THREE.Mesh(new THREE.CircleGeometry(0.95, 40), mat(0xd8622b, { emissive: 0x8a3a12, emissiveIntensity: 0.7, roughness: 0.4 }));
    boost.rotation.x = -Math.PI / 2; boost.position.set(0, 0.008, 6); W.add(boost);
    const chev = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.7, 3), mat(0xffd2a3, { emissive: 0xaa6a2a, emissiveIntensity: 0.8 }));
    chev.rotation.x = -Math.PI / 2; chev.position.set(0, 0.012, 6); W.add(chev);
    this._boost = { x: 0, z: 6, r: 0.95, cool: 0 };
    // the kickball
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 18), mat(0xd8622b, { roughness: 0.55 }));
    ball.castShadow = ball.receiveShadow = true; ball.position.set(1.5, 0.45, -2); W.add(ball);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.452, 0.02, 8, 40), mat(0xeef2fb, { roughness: 0.5 }));
    ball.add(stripe);
    this._ball = { m: ball, v: new THREE.Vector3(), r: 0.45 };
    // particle pool (confetti / dust / pickup sparkles)
    const N = 260;
    this._pool = [];
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3 + 1] = -99; this._pool.push({ p: new THREE.Vector3(0, -99, 0), v: new THREE.Vector3(), life: 0 }); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this._pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.075, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false }));
    this._pts.frustumCulled = false;
    W.add(this._pts);
    this._poolIdx = 0;
    this.onFun = null;
  }

  _burst(at, palette, n, speed) {
    const colAttr = this._pts.geometry.getAttribute('color');
    for (let i = 0; i < n; i++) {
      const s = this._pool[this._poolIdx];
      this._poolIdx = (this._poolIdx + 1) % this._pool.length;
      s.p.copy(at);
      s.v.set((Math.random() - 0.5) * 2, Math.random() * 1.2 + 0.3, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.8));
      s.life = 0.9 + Math.random() * 0.8;
      const c = new THREE.Color(palette[Math.floor(Math.random() * palette.length)]);
      const j = this._pool.indexOf(s);
      colAttr.setXYZ(j, c.r, c.g, c.b);
    }
    colAttr.needsUpdate = true;
  }

  funState() { return { got: this.fun.got, total: this.fun.total, time: this.fun.time, done: this.fun.done, best: this.fun.best || 0 }; }

  resetCourse() {
    this._potions.forEach(p => { p.got = false; p.g.visible = true; });
    this.fun.got = 0; this.fun.time = 0; this.fun.done = false; this.fun.started = false;
    this._ball.m.position.set(1.5, 0.45, -2); this._ball.v.set(0, 0, 0);
    if (this.onFun) this.onFun();
  }

  _funTick(dt, t) {
    const CONFETTI = [0xe0a93b, 0x6e9355, 0x9a5cd0, 0xd8622b, 0xeef2fb];
    // potions bob & spin; collect while driving
    for (let i = 0; i < this._potions.length; i++) {
      const p = this._potions[i];
      if (p.got) continue;
      p.g.rotation.y += dt * 1.7;
      p.g.position.y = p.y + Math.sin(t * 2 + p.x) * 0.055;
      if (this.driving && Math.hypot(this._pos.x - p.x, this._pos.z - p.z) < 0.6 && Math.abs(this._pos.y - (p.y - 0.42)) < 1.1) {
        p.got = true; p.g.visible = false; this.fun.got++;
        this._burst(p.g.position, [0x9a5cd0, 0xc9a3e8, 0xeef2fb], 22, 1.6);
        if (this.fun.got === this.fun.total) {
          this.fun.done = true;
          if (this.fun.started) this.fun.time = (performance.now() - this.fun.t0) / 1000;
          if (!this.fun.best || this.fun.time < this.fun.best) {
            this.fun.best = this.fun.time;
            try { localStorage.setItem('pp.playgroundBest', String(this.fun.time.toFixed(2))); } catch (e) {}
          }
          const c = this._pos.clone(); c.y += this._h + 0.5;
          this._burst(c, CONFETTI, 150, 3.6);
        }
        if (this.onFun) this.onFun();
      }
    }
    const hs = Math.hypot(this._vel.x, this._vel.z);
    if (this.driving && !this.fun.started && hs > 0.4) { this.fun.started = true; this.fun.t0 = performance.now(); }
    if (this.fun.started && !this.fun.done) this.fun.time = (performance.now() - this.fun.t0) / 1000;
    // boost pad
    if (this.driving) {
      const b = this._boost;
      b.cool -= dt;
      if (b.cool <= 0 && this._onGround && Math.hypot(this._pos.x - b.x, this._pos.z - b.z) < b.r && hs > 0.3) {
        const k = Math.min(3.2, 8.5 / (hs || 1));
        this._vel.x *= k; this._vel.z *= k;
        b.cool = 1.1;
        this._burst(this._pos.clone().setY(this._pos.y + 0.2), [0xd8622b, 0xffd2a3], 26, 2.2);
      }
    }
    // kickball
    const B = this._ball, bp = B.m.position;
    B.v.y -= 9.5 * dt;
    bp.addScaledVector(B.v, dt);
    if (bp.y < B.r) { bp.y = B.r; B.v.y = Math.abs(B.v.y) > 0.9 ? -B.v.y * 0.55 : 0; B.v.x *= 0.984; B.v.z *= 0.984; }
    if (Math.abs(bp.x) > 15) { bp.x = 15 * Math.sign(bp.x); B.v.x *= -0.6; }
    if (Math.abs(bp.z) > 15) { bp.z = 15 * Math.sign(bp.z); B.v.z *= -0.6; }
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      const dx = bp.x - s.x, dz = bp.z - s.z;
      const ox = s.hw + B.r - Math.abs(dx), oz = s.hd + B.r - Math.abs(dz);
      if (ox <= 0 || oz <= 0 || bp.y - B.r > s.y1 || bp.y + B.r < s.y0) continue;
      if (ox < oz) { bp.x += ox * Math.sign(dx || 1); B.v.x *= -0.55; }
      else { bp.z += oz * Math.sign(dz || 1); B.v.z *= -0.55; }
    }
    if (this.driving && Math.hypot(this._pos.x - bp.x, this._pos.z - bp.z) < R + B.r + 0.1 && bp.y < this._pos.y + 1.3) {
      const dx = bp.x - this._pos.x, dz = bp.z - this._pos.z, d = Math.hypot(dx, dz) || 1;
      const sp = 2 + hs * 1.5;
      B.v.x = (dx / d) * sp; B.v.z = (dz / d) * sp;
      B.v.y = Math.max(B.v.y, 1.8 + hs * 0.5);
    }
    B.m.rotation.x += B.v.z * dt * 1.8; B.m.rotation.z -= B.v.x * dt * 1.8;
    // landing dust
    if (this.driving) {
      if (this._wasAir && this._onGround && this._prevVy < -5) {
        this._burst(this._pos.clone().setY(this._pos.y + 0.08), [0x8a8578, 0x6e6a5e], 16, 1.1);
      }
      this._wasAir = !this._onGround; this._prevVy = this._vel.y;
    }
    // particles
    const posAttr = this._pts.geometry.getAttribute('position');
    for (let i = 0; i < this._pool.length; i++) {
      const s = this._pool[i];
      if (s.life <= 0) { if (posAttr.getY(i) > -90) posAttr.setY(i, -99); continue; }
      s.life -= dt;
      s.v.y -= 4.5 * dt;
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < 0.02) { s.p.y = 0.02; s.v.multiplyScalar(0.6); }
      posAttr.setXYZ(i, s.p.x, s.p.y, s.p.z);
    }
    posAttr.needsUpdate = true;
  }

  // ---------- clip slots ----------
  // Retarget a library clip via the inherited pipeline, then repurpose the
  // resulting action as a weighted, always-playing slot (root translation
  // stripped — the capsule owns travel, the clip owns the limbs).
  async assignSlot(slot, anim) {
    const r = await this.loadAnimUrl(anim.path, anim.ext, { chunked: anim.chunked, chunks: anim.chunks }, anim.label);
    const temp = this.activeAction, clip = temp.getClip();
    temp.stop();
    this.clips.pop(); this.actions.pop();
    this.activeAction = null; this._prevAction = null; this.playing = false;
    let tracks = clip.tracks.filter(t => !/\.position$/.test(t.name));
    if (!tracks.length) tracks = clip.tracks;
    const c2 = new THREE.AnimationClip(slot + ' · ' + clip.name, clip.duration, tracks);
    if (!this.mixer) { this.mixer = new THREE.AnimationMixer(this.model); this.mixer.timeScale = this.speed; }
    const a2 = this.mixer.clipAction(c2);
    if (slot === 'jump') { a2.setLoop(THREE.LoopOnce, 1); a2.clampWhenFinished = true; }
    else a2.setLoop(THREE.LoopRepeat, Infinity);
    a2.enabled = true; a2.setEffectiveWeight(0); a2.play();
    if (this.slots[slot]) { try { this.slots[slot].action.stop(); } catch (e) {} }
    this.slots[slot] = { action: a2, label: anim.label, matched: r.matched, w: 0 };
    return r;
  }
  clearSlots() {
    Object.values(this.slots).forEach(s => { try { s.action.stop(); } catch (e) {} });
    this.slots = {};
  }
  clearModel() {
    if (this.driving) this.stopDrive();
    if (this.slots) this.clearSlots();
    super.clearModel();
  }

  // ---------- expressions ----------
  listMorphs() {
    const names = [];
    if (this.model) this.model.traverse(o => {
      if (o.morphTargetDictionary) Object.keys(o.morphTargetDictionary).forEach(n => { if (names.indexOf(n) < 0) names.push(n); });
    });
    return names.slice(0, 24);
  }
  setMorph(name, v) {
    if (!this.model) return;
    this.model.traverse(o => {
      if (o.morphTargetDictionary && o.morphTargetDictionary[name] != null) o.morphTargetInfluences[o.morphTargetDictionary[name]] = v;
    });
  }
  getMorph(name) {
    let v = 0;
    if (this.model) this.model.traverse(o => {
      if (o.morphTargetDictionary && o.morphTargetDictionary[name] != null) v = o.morphTargetInfluences[o.morphTargetDictionary[name]] || 0;
    });
    return v;
  }

  // ---------- drive mode ----------
  startDrive() {
    if (!this.model) throw new Error('Load a character first');
    this.stopAnim();
    this.autoSpin = false;
    this.driving = true;
    this.wrap.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(this.wrap);
    this._h = Math.max(0.6, bb.max.y - Math.max(0, bb.min.y));
    this._pos.set(0, 0, 0); this._vel.set(0, 0, 0);
    this._yaw = 0; this._povPitch = 0; this._onGround = true; this._jumpQueued = false;
    this._camYaw = Math.PI * 0.05; this._camPitch = 0.3; this._camDist = Math.max(3, this._h * 2.3);
    this.controls.enabled = false;
    this._savedMinDist = this.controls.minDistance; this.controls.minDistance = 0.02;
    if (this.onDrive) this.onDrive();
  }
  stopDrive() {
    this.driving = false; this.povMode = false;
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    if (this.wrap) { this.wrap.position.set(0, 0, 0); this.wrap.rotation.y = 0; }
    Object.values(this.slots).forEach(s => s.action.setEffectiveWeight(0));
    if (this.slots.idle) this.slots.idle.action.setEffectiveWeight(1);
    this.controls.enabled = true;
    if (this._savedMinDist != null) this.controls.minDistance = this._savedMinDist;
    this.frame('persp');
    if (this.onDrive) this.onDrive();
  }
  setPOV(on) {
    this.povMode = !!on;
    if (on) this._yaw = this._camYaw; else this._camYaw = this._yaw;
    if (!on && document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} }
    if (this.onDrive) this.onDrive();
  }
  flipFacing() { this.faceOffset = this.faceOffset ? 0 : Math.PI; }

  _installDriveInput(canvas) {
    window.addEventListener('keydown', (e) => {
      if (!this.driving) return;
      const tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/i.test(tag)) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (key === ' ') { this._jumpQueued = true; e.preventDefault(); }
      if (key.indexOf('Arrow') === 0) e.preventDefault();
      if (key === 'v') this.setPOV(!this.povMode);
      this._keys[key] = true; this._keys.shift = e.shiftKey;
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this._keys[key] = false; this._keys.shift = e.shiftKey;
    });
    window.addEventListener('blur', () => { this._keys = {}; });
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.driving || this.povMode || e.button !== 0) return;
      this._drag = { x: e.clientX, y: e.clientY };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.driving && this.povMode && document.pointerLockElement === canvas) {
        this._yaw -= e.movementX * 0.0032;
        this._povPitch = clamp(this._povPitch - e.movementY * 0.0028, -1.2, 1.2);
        return;
      }
      if (!this._drag) return;
      this._camYaw -= (e.clientX - this._drag.x) * 0.008;
      this._camPitch = clamp(this._camPitch + (e.clientY - this._drag.y) * 0.006, -0.12, 1.25);
      this._drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointerup', () => { this._drag = null; });
    canvas.addEventListener('wheel', (e) => {
      if (!this.driving || this.povMode) return;
      e.preventDefault();
      this._camDist = clamp(this._camDist * (1 + Math.sign(e.deltaY) * 0.09), 1.4, 9);
    }, { passive: false });
    canvas.addEventListener('click', () => {
      if (this.driving && this.povMode && document.pointerLockElement !== canvas) {
        try { canvas.requestPointerLock(); } catch (e) {}
      }
    });
  }

  _pgTick() {
    const dt = Math.min(0.05, this._pgClock.getDelta());
    this._funTick(dt, this._pgClock.elapsedTime);
    if (!this.driving || !this.wrap) return;
    const k = this._keys;
    let ix = ((k.d || k.ArrowRight) ? 1 : 0) - ((k.a || k.ArrowLeft) ? 1 : 0);
    let iz = ((k.s || k.ArrowDown) ? 1 : 0) - ((k.w || k.ArrowUp) ? 1 : 0);
    let run = !!k.shift;
    // gamepad
    const pads = (navigator.getGamepads && navigator.getGamepads()) || [];
    let gp = null; for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    if (gp) {
      ix += dead(gp.axes[0]); iz += dead(gp.axes[1]);
      if (this.povMode) this._yaw -= dead(gp.axes[2]) * 2.6 * dt;
      else this._camYaw -= dead(gp.axes[2]) * 2.6 * dt;
      this._camPitch = clamp(this._camPitch + dead(gp.axes[3]) * 2 * dt, -0.12, 1.25);
      const j = gp.buttons[0] && gp.buttons[0].pressed;
      if (j && !this._padJump) this._jumpQueued = true;
      this._padJump = !!j;
      if ((gp.buttons[7] && gp.buttons[7].value > 0.5) || Math.hypot(dead(gp.axes[0]), dead(gp.axes[1])) > 0.95) run = true;
    }
    const mag = Math.min(1, Math.hypot(ix, iz));
    const yawRef = this.povMode ? this._yaw : this._camYaw;
    const fx = -Math.sin(yawRef), fz = -Math.cos(yawRef);
    let mx = 0, mz = 0;
    if (mag > 0.01) {
      const nx = ix / (Math.hypot(ix, iz) || 1), nz = iz / (Math.hypot(ix, iz) || 1);
      mx = fx * (-nz) + (-fz) * nx; mz = fz * (-nz) + (fx) * nx;
    }
    const spd = (run ? RUN : WALK) * mag;
    this._vel.x += (mx * spd - this._vel.x) * Math.min(1, ACCEL * dt);
    this._vel.z += (mz * spd - this._vel.z) * Math.min(1, ACCEL * dt);
    // jump + gravity
    if (this._jumpQueued && this._onGround) {
      this._vel.y = JUMP_V; this._onGround = false;
      if (this.slots.jump) { const a = this.slots.jump.action; a.reset(); a.play(); }
    }
    this._jumpQueued = false;
    this._vel.y -= GRAV * dt;
    this._pos.x += this._vel.x * dt; this._pos.z += this._vel.z * dt; this._pos.y += this._vel.y * dt;
    // collisions
    this._onGround = false;
    if (this._pos.y <= 0) { this._pos.y = 0; if (this._vel.y < 0) this._vel.y = 0; this._onGround = true; }
    for (let i = 0; i < this.solids.length; i++) {
      const s = this.solids[i];
      const dx = this._pos.x - s.x, dz = this._pos.z - s.z;
      const ox = s.hw + R - Math.abs(dx), oz = s.hd + R - Math.abs(dz);
      if (ox <= 0 || oz <= 0) continue;
      const feet = this._pos.y;
      if (feet <= s.y1 && feet > s.y1 - 0.5 && this._vel.y <= 0) {
        if (s.bounce) {
          this._pos.y = s.y1; this._vel.y = s.bounce;
          if (this.slots.jump) { const a = this.slots.jump.action; a.reset(); a.play(); }
        } else { this._pos.y = s.y1; this._vel.y = 0; this._onGround = true; }
      } else if (feet < s.y1 - 0.35 && feet + this._h * 0.85 > s.y0) {
        if (ox < oz) this._pos.x += ox * Math.sign(dx || 1);
        else this._pos.z += oz * Math.sign(dz || 1);
      }
    }
    this._pos.x = clamp(this._pos.x, -16, 16); this._pos.z = clamp(this._pos.z, -16, 16);
    // facing
    const hs = Math.hypot(this._vel.x, this._vel.z);
    if (this.povMode) this._yawShown = this._yaw;
    else if (hs > 0.25) this._yawShown = dampAngle(this._yawShown == null ? this._yaw : this._yawShown, Math.atan2(this._vel.x, this._vel.z), Math.min(1, dt * 11));
    if (this._yawShown == null) this._yawShown = 0;
    this.wrap.position.copy(this._pos);
    this.wrap.rotation.y = this._yawShown + this.faceOffset;
    // clip-slot state machine
    const S = this.slots;
    const air = !this._onGround && !!S.jump;
    const tgt = {
      jump: air ? 1 : 0,
      run: !air && hs > 2.7 ? 1 : 0,
      walk: !air && hs > 0.25 && hs <= 2.7 ? 1 : 0,
      idle: !air && hs <= 0.25 ? 1 : 0,
    };
    Object.keys(S).forEach(name => {
      const s = S[name];
      s.w = s.w + ((tgt[name] || 0) - s.w) * Math.min(1, dt * 9);
      s.action.setEffectiveWeight(s.w);
    });
    if (S.walk && tgt.walk) S.walk.action.setEffectiveTimeScale(clamp(hs / WALK, 0.55, 1.6));
    if (S.run && tgt.run) S.run.action.setEffectiveTimeScale(clamp(hs / RUN, 0.6, 1.5));
    // camera (controls.update() re-aims at controls.target next frame)
    if (this.povMode) {
      const eye = this._pos.clone(); eye.y += this._h * 0.87;
      const dir = new THREE.Vector3(
        -Math.sin(this._yaw) * Math.cos(this._povPitch),
        Math.sin(this._povPitch),
        -Math.cos(this._yaw) * Math.cos(this._povPitch));
      eye.addScaledVector(dir, this._h * 0.12);
      this.camera.position.copy(eye);
      this.controls.target.copy(eye.clone().addScaledVector(dir, 2));
    } else {
      const t = this._pos.clone(); t.y += this._h * 0.62;
      const cp = this._camPitch;
      const off = new THREE.Vector3(Math.sin(this._camYaw) * Math.cos(cp), Math.sin(cp), Math.cos(this._camYaw) * Math.cos(cp)).multiplyScalar(this._camDist);
      const want = t.clone().add(off);
      want.y = Math.max(want.y, 0.18);
      this.camera.position.lerp(want, 1 - Math.exp(-dt * 8));
      this.controls.target.lerp(t, 1 - Math.exp(-dt * 12));
    }
  }
}
