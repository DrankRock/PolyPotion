// ============================================================
// retarget-core.js — standalone semantic clip retargeting.
// Extracted from the Showcase engine so Stage (and any other multi-actor
// viewer) can put a library motion clip onto ANY humanoid skeleton without
// pulling in the whole single-character engine.
//
//   import { retargetClip, findSkeleton } from './retarget-core.js';
//   const sk = findSkeleton(actor.root);
//   const r  = retargetClip(actor.root, sk, srcRoot, clip, 'Walk');
//   // r = { retargeted: THREE.AnimationClip, matched: N }  |  null
//
// Bones are matched SEMANTICALLY (Mixamo, AutoRig, generic humanoid names all
// fold to canonical keys); rest orientations cancel via a world-delta transfer
// with A/T-pose calibration, and the hips travel is rescaled to the target's
// proportions. Falls back to a direct name-matched quaternion copy.
// ============================================================
import * as THREE from 'three';

const CANON_CORE = {
  hips: 'hips', pelvis: 'hips',
  spine: 'spine', spine1: 'chest', spine01: 'chest', spine2: 'chest', spine02: 'chest', spine3: 'chest', chest: 'chest', upperchest: 'chest',
  neck: 'neck', neck1: 'neck', head: 'head',
  shoulder: 'SHOULDER?',
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

export function findSkeleton(root) {
  let sk = null;
  root.traverse(o => { if (!sk && o.isSkinnedMesh && o.skeleton) sk = o.skeleton; });
  return sk;
}

// world-space delta retarget (handles differing bone names AND rest poses)
function retargetWorldDelta(targetRoot, skeleton, srcRoot, clip, clipName) {
  const tgtBones = [];
  targetRoot.traverse(o => { if (o.isBone) tgtBones.push(o); });
  if (!tgtBones.length) return null;

  if (skeleton) skeleton.pose();
  targetRoot.updateMatrixWorld(true);
  const tgt = tgtBones.map(b => ({
    bone: b,
    restWorld: b.getWorldQuaternion(new THREE.Quaternion()),
    restLocal: b.quaternion.clone(),
  }));

  srcRoot.updateMatrixWorld(true);
  const srcByName = new Map();
  srcRoot.traverse(o => { if (o.name && !srcByName.has(o.name)) srcByName.set(o.name, o); });

  const srcKeys = canonKeys([...srcByName.keys()]);
  const tgtKeys = canonKeys(tgtBones.map(b => b.name));

  const pairByTgt = new Map();
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
  if (pairByTgt.size < 3) return null;

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
        myWorld = new THREE.Quaternion().copy(wq).multiply(inv).multiply(pair.calRest || T.restWorld);
      } else {
        myWorld = new THREE.Quaternion().copy(pWorld).multiply(T.restLocal);
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
function retargetByName(targetRoot, clip, clipName) {
  const norm = s => String(s).replace(/^mixamorig\d*[:_]?/i, '').replace(/[\s_:.-]/g, '').toLowerCase();
  const boneByNorm = new Map();
  targetRoot.traverse(o => { if (o.isBone) boneByNorm.set(norm(o.name), o.name); });
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

export function retargetClip(targetRoot, skeleton, srcRoot, clip, clipName) {
  let result = srcRoot ? retargetWorldDelta(targetRoot, skeleton, srcRoot, clip, clipName) : null;
  if (!result) result = retargetByName(targetRoot, clip, clipName);
  return result;
}

export default { retargetClip, findSkeleton };
