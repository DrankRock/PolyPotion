// ============================================================
// bone-map.js — humanoid skeleton dictionaries + auto-detect
// ------------------------------------------------------------
// The shared "translation layer" the Frontier Audit calls for:
// one canonical humanoid slot list (a superset of VRM 1.0 /
// Unity Humanoid), name dictionaries for the rigs seen in the
// wild, auto-detection, and slot→bone resolution.
//
// Used by: retarget-engine.js (clip retargeting), vrm-export.js
// (VRMC_vrm humanoid block), and the exporter's bone-rename maps.
// Pure JS — no three.js import; callers pass bone name lists or
// {name, parentName} records.
// ============================================================

// Canonical humanoid slots (VRM 1.0 naming).
export const HUMANOID_SLOTS = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  'leftEye', 'rightEye', 'jaw',
  'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
  'leftThumbMetacarpal', 'leftThumbProximal', 'leftThumbDistal',
  'leftIndexProximal', 'leftIndexIntermediate', 'leftIndexDistal',
  'leftMiddleProximal', 'leftMiddleIntermediate', 'leftMiddleDistal',
  'leftRingProximal', 'leftRingIntermediate', 'leftRingDistal',
  'leftLittleProximal', 'leftLittleIntermediate', 'leftLittleDistal',
  'rightThumbMetacarpal', 'rightThumbProximal', 'rightThumbDistal',
  'rightIndexProximal', 'rightIndexIntermediate', 'rightIndexDistal',
  'rightMiddleProximal', 'rightMiddleIntermediate', 'rightMiddleDistal',
  'rightRingProximal', 'rightRingIntermediate', 'rightRingDistal',
  'rightLittleProximal', 'rightLittleIntermediate', 'rightLittleDistal',
];

// Slots VRM 1.0 requires — used to validate a map before VRM export.
export const VRM_REQUIRED = [
  'hips', 'spine', 'head',
  'leftUpperArm', 'leftLowerArm', 'leftHand',
  'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg', 'leftLowerLeg', 'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
];

// ---- per-convention dictionaries: slot → exact bone name -------------
const MIXAMO = {
  hips: 'mixamorig:Hips', spine: 'mixamorig:Spine', chest: 'mixamorig:Spine1', upperChest: 'mixamorig:Spine2',
  neck: 'mixamorig:Neck', head: 'mixamorig:Head',
  leftShoulder: 'mixamorig:LeftShoulder', leftUpperArm: 'mixamorig:LeftArm', leftLowerArm: 'mixamorig:LeftForeArm', leftHand: 'mixamorig:LeftHand',
  rightShoulder: 'mixamorig:RightShoulder', rightUpperArm: 'mixamorig:RightArm', rightLowerArm: 'mixamorig:RightForeArm', rightHand: 'mixamorig:RightHand',
  leftUpperLeg: 'mixamorig:LeftUpLeg', leftLowerLeg: 'mixamorig:LeftLeg', leftFoot: 'mixamorig:LeftFoot', leftToes: 'mixamorig:LeftToeBase',
  rightUpperLeg: 'mixamorig:RightUpLeg', rightLowerLeg: 'mixamorig:RightLeg', rightFoot: 'mixamorig:RightFoot', rightToes: 'mixamorig:RightToeBase',
  leftThumbProximal: 'mixamorig:LeftHandThumb1', leftThumbDistal: 'mixamorig:LeftHandThumb3',
  leftIndexProximal: 'mixamorig:LeftHandIndex1', leftIndexIntermediate: 'mixamorig:LeftHandIndex2', leftIndexDistal: 'mixamorig:LeftHandIndex3',
  leftMiddleProximal: 'mixamorig:LeftHandMiddle1', leftMiddleIntermediate: 'mixamorig:LeftHandMiddle2', leftMiddleDistal: 'mixamorig:LeftHandMiddle3',
  leftRingProximal: 'mixamorig:LeftHandRing1', leftRingIntermediate: 'mixamorig:LeftHandRing2', leftRingDistal: 'mixamorig:LeftHandRing3',
  leftLittleProximal: 'mixamorig:LeftHandPinky1', leftLittleIntermediate: 'mixamorig:LeftHandPinky2', leftLittleDistal: 'mixamorig:LeftHandPinky3',
  rightThumbProximal: 'mixamorig:RightHandThumb1', rightThumbDistal: 'mixamorig:RightHandThumb3',
  rightIndexProximal: 'mixamorig:RightHandIndex1', rightIndexIntermediate: 'mixamorig:RightHandIndex2', rightIndexDistal: 'mixamorig:RightHandIndex3',
  rightMiddleProximal: 'mixamorig:RightHandMiddle1', rightMiddleIntermediate: 'mixamorig:RightHandMiddle2', rightMiddleDistal: 'mixamorig:RightHandMiddle3',
  rightRingProximal: 'mixamorig:RightHandRing1', rightRingIntermediate: 'mixamorig:RightHandRing2', rightRingDistal: 'mixamorig:RightHandRing3',
  rightLittleProximal: 'mixamorig:RightHandPinky1', rightLittleIntermediate: 'mixamorig:RightHandPinky2', rightLittleDistal: 'mixamorig:RightHandPinky3',
};

const UE5 = {
  hips: 'pelvis', spine: 'spine_01', chest: 'spine_02', upperChest: 'spine_03',
  neck: 'neck_01', head: 'head',
  leftShoulder: 'clavicle_l', leftUpperArm: 'upperarm_l', leftLowerArm: 'lowerarm_l', leftHand: 'hand_l',
  rightShoulder: 'clavicle_r', rightUpperArm: 'upperarm_r', rightLowerArm: 'lowerarm_r', rightHand: 'hand_r',
  leftUpperLeg: 'thigh_l', leftLowerLeg: 'calf_l', leftFoot: 'foot_l', leftToes: 'ball_l',
  rightUpperLeg: 'thigh_r', rightLowerLeg: 'calf_r', rightFoot: 'foot_r', rightToes: 'ball_r',
  leftThumbProximal: 'thumb_01_l', leftThumbDistal: 'thumb_03_l',
  leftIndexProximal: 'index_01_l', leftIndexIntermediate: 'index_02_l', leftIndexDistal: 'index_03_l',
  leftMiddleProximal: 'middle_01_l', leftMiddleIntermediate: 'middle_02_l', leftMiddleDistal: 'middle_03_l',
  leftRingProximal: 'ring_01_l', leftRingIntermediate: 'ring_02_l', leftRingDistal: 'ring_03_l',
  leftLittleProximal: 'pinky_01_l', leftLittleIntermediate: 'pinky_02_l', leftLittleDistal: 'pinky_03_l',
  rightThumbProximal: 'thumb_01_r', rightThumbDistal: 'thumb_03_r',
  rightIndexProximal: 'index_01_r', rightIndexIntermediate: 'index_02_r', rightIndexDistal: 'index_03_r',
  rightMiddleProximal: 'middle_01_r', rightMiddleIntermediate: 'middle_02_r', rightMiddleDistal: 'middle_03_r',
  rightRingProximal: 'ring_01_r', rightRingIntermediate: 'ring_02_r', rightRingDistal: 'ring_03_r',
  rightLittleProximal: 'pinky_01_r', rightLittleIntermediate: 'pinky_02_r', rightLittleDistal: 'pinky_03_r',
};

const RIGIFY = {
  hips: 'spine', spine: 'spine.001', chest: 'spine.002', upperChest: 'spine.003',
  neck: 'spine.004', head: 'spine.006',
  leftShoulder: 'shoulder.L', leftUpperArm: 'upper_arm.L', leftLowerArm: 'forearm.L', leftHand: 'hand.L',
  rightShoulder: 'shoulder.R', rightUpperArm: 'upper_arm.R', rightLowerArm: 'forearm.R', rightHand: 'hand.R',
  leftUpperLeg: 'thigh.L', leftLowerLeg: 'shin.L', leftFoot: 'foot.L', leftToes: 'toe.L',
  rightUpperLeg: 'thigh.R', rightLowerLeg: 'shin.R', rightFoot: 'foot.R', rightToes: 'toe.R',
};

export const CONVENTIONS = [
  { id: 'mixamo', label: 'Mixamo', dict: MIXAMO, probe: n => /^mixamorig[:_]?/i.test(n) },
  { id: 'ue5', label: 'UE5 Mannequin', dict: UE5, probe: n => /^(pelvis|spine_0\d|clavicle_[lr]|upperarm_[lr])$/i.test(n) },
  { id: 'rigify', label: 'Blender Rigify', dict: RIGIFY, probe: n => /^(spine\.\d{3}|upper_arm\.[LR]|thigh\.[LR])$/.test(n) },
  { id: 'vrm', label: 'VRM / Unity Humanoid', dict: null, probe: n => /^(hips|spine|chest|head|left(Upper|Lower)(Arm|Leg)|J_Bip_)/i.test(n) },
];

// ---- fuzzy fallback: tokenize a bone name and score it against a slot
const SIDE_L = /(^|[^a-z])(l|left)([^a-z]|$)|\.l$|_l$|^l_/i;
const SIDE_R = /(^|[^a-z])(r|right)([^a-z]|$)|\.r$|_r$|^r_/i;
const FUZZY = {
  hips: /hip|pelvis|root.?bone/i, spine: /spine|torso|abdomen/i, chest: /chest|ribcage|spine.?1/i,
  upperChest: /upper.?chest|spine.?2/i, neck: /neck/i, head: /head(?!.*(top|end))/i, jaw: /jaw/i,
  leftEye: /eye/i, rightEye: /eye/i,
  leftShoulder: /shoulder|clavicle|collar/i, rightShoulder: /shoulder|clavicle|collar/i,
  leftUpperArm: /upper.?arm|arm(?!.*(fore|lower|hand))|bicep/i, rightUpperArm: /upper.?arm|arm(?!.*(fore|lower|hand))|bicep/i,
  leftLowerArm: /fore.?arm|lower.?arm|elbow/i, rightLowerArm: /fore.?arm|lower.?arm|elbow/i,
  leftHand: /hand(?!.*(thumb|index|mid|ring|pink|finger))/i, rightHand: /hand(?!.*(thumb|index|mid|ring|pink|finger))/i,
  leftUpperLeg: /up.?leg|upper.?leg|thigh/i, rightUpperLeg: /up.?leg|upper.?leg|thigh/i,
  leftLowerLeg: /lower.?leg|shin|calf|knee|(?:^|[^p])leg/i, rightLowerLeg: /lower.?leg|shin|calf|knee|(?:^|[^p])leg/i,
  leftFoot: /foot|ankle/i, rightFoot: /foot|ankle/i,
  leftToes: /toe/i, rightToes: /toe/i,
};

function sideOf(name) { if (SIDE_L.test(name) && !SIDE_R.test(name)) return 'left'; if (SIDE_R.test(name) && !SIDE_L.test(name)) return 'right'; return ''; }

// detectConvention(names) → convention id ('mixamo' | 'ue5' | 'rigify' | 'vrm' | 'unknown')
export function detectConvention(names) {
  let best = { id: 'unknown', hits: 0 };
  for (const c of CONVENTIONS) {
    const hits = names.reduce((a, n) => a + (c.probe(n) ? 1 : 0), 0);
    if (hits > best.hits) best = { id: c.id, hits };
  }
  return best.hits >= 2 ? best.id : 'unknown';
}

// buildBoneMap(names) → { slot: boneName } using exact dicts first, fuzzy after.
export function buildBoneMap(names) {
  const map = {};
  const taken = new Set();
  const conv = detectConvention(names);
  const def = CONVENTIONS.find(c => c.id === conv);
  const set = new Set(names);

  // 1. exact dictionary hits
  if (def && def.dict) {
    for (const [slot, bone] of Object.entries(def.dict)) {
      if (set.has(bone)) { map[slot] = bone; taken.add(bone); }
    }
  }
  // 1b. VRM-style: slot name IS the bone name (any case), incl. VRoid J_Bip_C_Hips
  for (const slot of HUMANOID_SLOTS) {
    if (map[slot]) continue;
    const found = names.find(n => !taken.has(n) && (
      n.toLowerCase() === slot.toLowerCase() ||
      n.toLowerCase().endsWith('_' + slot.toLowerCase()) ||
      n.replace(/^J_Bip_[CLR]_/, '').toLowerCase() === slot.replace(/^left|^right/, '').toLowerCase() &&
        ((slot.startsWith('left') && /_L_/.test(n)) || (slot.startsWith('right') && /_R_/.test(n)) || (!/^left|^right/.test(slot) && /_C_/.test(n)))
    ));
    if (found) { map[slot] = found; taken.add(found); }
  }
  // 2. fuzzy fallback for core body slots
  for (const [slot, rx] of Object.entries(FUZZY)) {
    if (map[slot]) continue;
    const wantSide = slot.startsWith('left') ? 'left' : slot.startsWith('right') ? 'right' : '';
    const found = names.find(n => !taken.has(n) && rx.test(n) && sideOf(n) === wantSide);
    if (found) { map[slot] = found; taken.add(found); }
  }
  return { convention: conv, map };
}

// renameForTarget(names, targetConv) → { oldName: newName } for export rename maps
export function renameForTarget(map, targetConvId) {
  const def = CONVENTIONS.find(c => c.id === targetConvId);
  const out = {};
  for (const [slot, bone] of Object.entries(map)) {
    const to = def && def.dict ? def.dict[slot] : slot;   // vrm target = slot names themselves
    if (to) out[bone] = to;
  }
  return out;
}

export function validateForVRM(map) {
  const missing = VRM_REQUIRED.filter(s => !map[s]);
  return { ok: missing.length === 0, missing };
}

export default { HUMANOID_SLOTS, VRM_REQUIRED, CONVENTIONS, detectConvention, buildBoneMap, renameForTarget, validateForVRM };
