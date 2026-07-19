// ============================================================
// wing-flap.js — procedural wing life for Stream Stage / Showcase.
// Finds bone chains named wing/pinion/feather, then drives them with a
// gentle idle sway plus periodic flap bursts. Purely additive on top of the
// rest pose: quaternions are rest * axisRotation, so it composes with
// whatever else (springs, capture head pose) touches OTHER bones.
// Flap axis = character forward (world +Z at init) converted into each
// bone's local space, so "flap" sweeps the wing up/down regardless of how
// the rig authored its bone orientations. Left/right mirrored by the chain
// root's world X sign.
// ============================================================

const WING_RE = /wing|pinion|feather/i;

export class WingFlap {
  constructor(root, THREE) {
    this.THREE = THREE;
    this.intensity = 1;
    this.chains = [];
    root.updateMatrixWorld(true);
    const roots = [];
    root.traverse(o => {
      if (o.isBone && WING_RE.test(o.name) && !(o.parent && o.parent.isBone && WING_RE.test(o.parent.name))) roots.push(o);
    });
    const fwd = new THREE.Vector3(0, 0, 1);
    const wq = new THREE.Quaternion(); const wp = new THREE.Vector3();
    for (const r of roots) {
      r.getWorldPosition(wp);
      const side = wp.x >= 0 ? 1 : -1;
      const bones = [];
      const walk = (b, depth) => {
        b.getWorldQuaternion(wq);
        const axis = fwd.clone().applyQuaternion(wq.clone().invert()).normalize();
        bones.push({ bone: b, rest: b.quaternion.clone(), axis, depth });
        b.children.forEach(c => { if (c.isBone) walk(c, depth + 1); });
      };
      walk(r, 0);
      this.chains.push({ bones, side, phase: Math.random() * Math.PI * 2 });
    }
    this.count = this.chains.reduce((n, c) => n + c.bones.length, 0);
    this._t = 0; this._burst = -1; this._nextBurst = 3 + Math.random() * 4;
    this._q = new THREE.Quaternion();
  }

  // step(dt): call once per frame. Idle = two slow sines; every 6–14s a
  // ~1.1s burst envelope of 2–3 proper flaps rides on top.
  step(dt) {
    this._t += dt;
    this._nextBurst -= dt;
    if (this._burst < 0 && this._nextBurst <= 0) { this._burst = 0; this._nextBurst = 6 + Math.random() * 8; }
    let burst = 0;
    if (this._burst >= 0) {
      this._burst += dt;
      const T = 1.1;
      if (this._burst >= T) this._burst = -1;
      else burst = Math.sin(Math.PI * this._burst / T) * Math.sin(this._burst * Math.PI * 4.8) * 0.45;
    }
    for (const ch of this.chains) {
      for (const b of ch.bones) {
        const lag = b.depth * 0.16;                                   // tip trails the shoulder
        const idle = Math.sin((this._t - lag) * 1.5 + ch.phase) * 0.055
                   + Math.sin((this._t - lag) * 0.8 + ch.phase + 1.3) * 0.03;
        const a = (idle + burst * (1 + b.depth * 0.3)) * ch.side * this.intensity;
        b.bone.quaternion.copy(b.rest).multiply(this._q.setFromAxisAngle(b.axis, a));
      }
    }
  }

  reset() {
    for (const ch of this.chains) for (const b of ch.bones) b.bone.quaternion.copy(b.rest);
  }
}

try { window.PPWingFlap = WingFlap; } catch (e) {}
export default { WingFlap };
