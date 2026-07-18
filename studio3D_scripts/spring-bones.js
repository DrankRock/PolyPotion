// ============================================================
// spring-bones.js — hair/tail/accessory sway (Brew 10)
// Three jobs:
//  1) detectChainsFromGLTF(json)  — find springy bone chains in raw GLB JSON
//     (name-based: hair/tail/skirt/ear/ribbon/cape…, linear descent).
//  2) buildVRMC / buildSecondary  — serialize those chains as VRM 1.0
//     VRMC_springBone / VRM 0.x secondaryAnimation for the exporter.
//  3) SpringSim                   — runtime verlet preview for a loaded
//     three.js model (Stream Stage / Showcase): stiffness pulls each joint
//     back to rest, gravity + drag make it swing.
// Pure JS + optional THREE passed in; no imports.
// ============================================================

export const SPRINGY_RX = /hair|bangs|ahoge|sideburn|twin|pony|braid|tail(?!or)|skirt|ribbon|cape|cloak|scarf|ear(?!th)|antenna|feeler|tassel|string|bell/i;
// bones that must NEVER sway even if the name matches (e.g. "EarL" on a head is fine, "Heel" is not caught anyway)
const EXCLUDE_RX = /head$|neck|spine|hips|chest|shoulder|arm|hand|finger|thumb|leg|knee|foot|toe|eye/i;

// ---- 1) chain detection on raw glTF JSON -------------------
// Returns [{name, nodes:[nodeIdx…]}] — each a root-to-tip linear chain.
export function detectChainsFromGLTF(json) {
  const nodes = json.nodes || [];
  const isSpringy = (i) => {
    const n = nodes[i] && nodes[i].name || '';
    return SPRINGY_RX.test(n) && !EXCLUDE_RX.test(n);
  };
  const parentOf = new Map();
  nodes.forEach((n, i) => (n.children || []).forEach(c => parentOf.set(c, i)));
  // chain roots: springy nodes whose parent is not springy
  const roots = [];
  nodes.forEach((n, i) => { if (isSpringy(i) && !isSpringy(parentOf.get(i) ?? -1)) roots.push(i); });
  const chains = [];
  for (const r of roots) {
    const chain = [r];
    let cur = r;
    while (true) {
      const kids = (nodes[cur].children || []).filter(isSpringy);
      if (!kids.length) break;
      // follow the longest descent if it branches
      cur = kids.length === 1 ? kids[0] : kids.map(k => [k, depthOf(k)]).sort((a, b) => b[1] - a[1])[0][0];
      chain.push(cur);
    }
    if (chain.length >= 2) chains.push({ name: nodes[r].name || ('spring ' + r), nodes: chain });
  }
  return chains;
  function depthOf(i) { let d = 0, kids = (nodes[i].children || []).filter(isSpringy); while (kids.length) { d++; i = kids[0]; kids = (nodes[i].children || []).filter(isSpringy); } return d; }
}

// ---- 2) serializers ----------------------------------------
const DEFAULTS = { hitRadius: 0.02, stiffness: 0.65, gravityPower: 0.05, dragForce: 0.4 };

export function buildVRMC(chains, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  return {
    specVersion: '1.0',
    colliders: [], colliderGroups: [],
    springs: chains.map(c => ({
      name: c.name,
      joints: c.nodes.map(n => ({ node: n, hitRadius: o.hitRadius, stiffness: o.stiffness, gravityPower: o.gravityPower, gravityDir: [0, -1, 0], dragForce: o.dragForce })),
      colliderGroups: [],
    })),
  };
}

export function buildSecondary(chains, opts) {
  const o = Object.assign({}, DEFAULTS, opts || {});
  return {
    boneGroups: chains.map(c => ({
      comment: c.name,
      stiffiness: o.stiffness * 4,          // 0.x scale ~0-4 (and yes, the spec misspells it)
      gravityPower: o.gravityPower,
      gravityDir: { x: 0, y: -1, z: 0 },
      dragForce: o.dragForce,
      center: -1,
      hitRadius: o.hitRadius,
      bones: [c.nodes[0]],                  // 0.x lists chain ROOTS; children follow implicitly
      colliderGroups: [],
    })),
    colliderGroups: [],
  };
}

// ---- 3) runtime preview sim --------------------------------
// VRM-style per-joint verlet: each bone's TAIL is a particle. Per step:
// inertia (prev velocity × (1-drag)) + gravity + stiffness toward the bone's
// rest direction in parent space; bone then rotates to aim at the particle.
export class SpringSim {
  // root: THREE.Object3D to scan; THREE: the three.js module
  constructor(root, THREE) {
    this.THREE = THREE;
    this.enabled = true;
    this.params = Object.assign({}, DEFAULTS);
    this.joints = [];
    const springy = [];
    root.traverse(o => { if (o.isBone && SPRINGY_RX.test(o.name) && !EXCLUDE_RX.test(o.name)) springy.push(o); });
    root.updateMatrixWorld(true);
    for (const b of springy) {
      const child = b.children.find(c => c.isBone) || b.children[0];
      if (!child) continue;
      const tailWorld = child.getWorldPosition(new THREE.Vector3());
      this.joints.push({
        bone: b, child,
        restLocalRot: b.quaternion.clone(),
        restDirLocal: child.position.clone().normalize(),   // tail dir in bone space at rest
        boneLen: child.position.length(),
        pos: tailWorld.clone(), prev: tailWorld.clone(),
      });
    }
    this._tmp = { v: new THREE.Vector3(), v2: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4() };
  }
  get count() { return this.joints.length; }

  reset() {
    for (const j of this.joints) {
      j.bone.quaternion.copy(j.restLocalRot);
      j.bone.updateMatrixWorld(true);
      j.child.getWorldPosition(j.pos); j.prev.copy(j.pos);
    }
  }

  step(dt) {
    if (!this.enabled || !this.joints.length) return;
    dt = Math.min(dt, 0.033);
    const { v, v2, q } = this._tmp;
    const P = this.params;
    for (const j of this.joints) {
      const bone = j.bone;
      bone.updateMatrixWorld(true);
      const parent = bone.parent;
      // rest tail position in world (bone at rest rotation)
      const saved = bone.quaternion.clone();
      bone.quaternion.copy(j.restLocalRot);
      bone.updateMatrixWorld(true);
      const restTail = j.child.getWorldPosition(new this.THREE.Vector3());
      bone.quaternion.copy(saved);
      bone.updateMatrixWorld(true);
      const head = bone.getWorldPosition(v2.clone());
      // verlet integrate
      const vel = v.copy(j.pos).sub(j.prev).multiplyScalar(1 - P.dragForce);
      j.prev.copy(j.pos);
      j.pos.add(vel)
        .add(new this.THREE.Vector3(0, -P.gravityPower * dt * 60 * 0.01, 0))
        .add(restTail.sub(j.pos).multiplyScalar(P.stiffness * dt * 60 * 0.05));
      // constrain to bone length
      j.pos.sub(head).setLength(j.boneLen * bone.getWorldScale(v2.set(1,1,1)).y || j.boneLen).add(head);
      // rotate bone so its rest tail dir aims at the particle
      const parentWorldQ = parent ? parent.getWorldQuaternion(q.clone()) : new this.THREE.Quaternion();
      const dirLocal = j.pos.clone().sub(head).applyQuaternion(parentWorldQ.clone().invert()).normalize();
      const restDirParent = j.restDirLocal.clone().applyQuaternion(j.restLocalRot).normalize();
      const rot = new this.THREE.Quaternion().setFromUnitVectors(restDirParent, dirLocal);
      bone.quaternion.copy(rot.multiply(j.restLocalRot));
    }
  }
}

try { window.PPSprings = { detectChainsFromGLTF, buildVRMC, buildSecondary, SpringSim, SPRINGY_RX }; } catch (e) {}
export default { detectChainsFromGLTF, buildVRMC, buildSecondary, SpringSim, SPRINGY_RX };
