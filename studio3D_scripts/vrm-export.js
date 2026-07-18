// ============================================================
// vrm-export.js — VRM 1.0 avatar export (client-side)
// ------------------------------------------------------------
// VRM 1.0 = a GLB with a VRMC_vrm extension: humanoid bone map,
// expression set, look-at + first-person config, licence meta.
// We already produce humanoid rigs and (ARKit-named) morph
// targets — this module re-labels that work into the dialect
// VRChat / VSeeFace / Warudo / Unity's UniVRM read.
//
// exportVRM(glbBuffer, opts) → ArrayBuffer (patched GLB)
//   opts: { name, author, commercial:boolean }
// Pure GLB JSON-chunk surgery — no three.js needed.
// ============================================================
import { buildBoneMap, validateForVRM } from './bone-map.js';
import { detectChainsFromGLTF, buildVRMC, buildSecondary } from './spring-bones.js';

// ---- GLB chunk plumbing ------------------------------------
function parseGLB(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('Not a GLB file');
  const chunks = [];
  let o = 12;
  while (o < dv.getUint32(8, true)) {
    const len = dv.getUint32(o, true), type = dv.getUint32(o + 4, true);
    chunks.push({ type, data: buf.slice(o + 8, o + 8 + len) });
    o += 8 + len + ((4 - (len % 4)) % 4 && 0); // chunk lengths are already 4-aligned per spec
    if (len % 4) o += 4 - (len % 4);
  }
  const jsonChunk = chunks.find(c => c.type === 0x4E4F534A);
  const binChunk = chunks.find(c => c.type === 0x004E4942);
  return { json: JSON.parse(new TextDecoder().decode(jsonChunk.data)), bin: binChunk ? binChunk.data : null };
}

function buildGLB(json, bin) {
  const enc = new TextEncoder();
  let jsonBytes = enc.encode(JSON.stringify(json));
  const jpad = (4 - (jsonBytes.length % 4)) % 4;
  if (jpad) { const p = new Uint8Array(jsonBytes.length + jpad); p.set(jsonBytes); p.fill(0x20, jsonBytes.length); jsonBytes = p; }
  const binLen = bin ? bin.byteLength : 0;
  const bpad = (4 - (binLen % 4)) % 4;
  const total = 12 + 8 + jsonBytes.length + (bin ? 8 + binLen + bpad : 0);
  const out = new ArrayBuffer(total);
  const dv = new DataView(out); const u8 = new Uint8Array(out);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true); dv.setUint32(16, 0x4E4F534A, true);
  u8.set(jsonBytes, 20);
  if (bin) {
    const bo = 20 + jsonBytes.length;
    dv.setUint32(bo, binLen + bpad, true); dv.setUint32(bo + 4, 0x004E4942, true);
    u8.set(new Uint8Array(bin), bo + 8);
  }
  return out;
}

// ---- ARKit morph names → VRM 1.0 preset expressions --------
// value: list of {rx, weight} — morph name regexes contributing to the preset
const EXPRESSION_MAP = {
  aa: [{ rx: /^jawOpen$/i, w: 0.7 }, { rx: /^mouthOpen$/i, w: 1 }],
  ih: [{ rx: /^mouthStretch(Left|Right)$/i, w: 0.6 }, { rx: /^jawOpen$/i, w: 0.2 }],
  ou: [{ rx: /^mouthFunnel$/i, w: 1 }],
  ee: [{ rx: /^mouthSmile(Left|Right)$/i, w: 0.5 }, { rx: /^jawOpen$/i, w: 0.25 }],
  oh: [{ rx: /^mouthPucker$/i, w: 1 }, { rx: /^jawOpen$/i, w: 0.3 }],
  blink: [{ rx: /^eyeBlink(Left|Right)$/i, w: 1 }],
  blinkLeft: [{ rx: /^eyeBlinkLeft$/i, w: 1 }],
  blinkRight: [{ rx: /^eyeBlinkRight$/i, w: 1 }],
  happy: [{ rx: /^mouthSmile(Left|Right)$/i, w: 1 }, { rx: /^cheekSquint(Left|Right)$/i, w: 0.4 }],
  angry: [{ rx: /^browDown(Left|Right)$/i, w: 1 }, { rx: /^mouthFrown(Left|Right)$/i, w: 0.5 }],
  sad: [{ rx: /^mouthFrown(Left|Right)$/i, w: 1 }, { rx: /^browInnerUp$/i, w: 0.6 }],
  surprised: [{ rx: /^eyeWide(Left|Right)$/i, w: 1 }, { rx: /^browInnerUp$/i, w: 0.8 }, { rx: /^jawOpen$/i, w: 0.4 }],
  lookUp: [{ rx: /^eyeLookUp(Left|Right)$/i, w: 1 }],
  lookDown: [{ rx: /^eyeLookDown(Left|Right)$/i, w: 1 }],
  lookLeft: [{ rx: /^eyeLookOutLeft$|^eyeLookInRight$/i, w: 1 }],
  lookRight: [{ rx: /^eyeLookOutRight$|^eyeLookInLeft$/i, w: 1 }],
};

// ---- main --------------------------------------------------
export function exportVRM(glbBuffer, opts) {
  opts = opts || {};
  const { json, bin } = parseGLB(glbBuffer);
  const nodes = json.nodes || [];

  // 1. humanoid: map node names → VRM humanoid slots
  const names = nodes.map(n => n.name || '');
  const { map, convention } = buildBoneMap(names);
  const check = validateForVRM(map);
  if (!check.ok) {
    const err = new Error('Rig is missing required humanoid bones: ' + check.missing.join(', '));
    err.missing = check.missing; err.convention = convention;
    throw err;
  }
  const humanBones = {};
  for (const [slot, boneName] of Object.entries(map)) {
    const idx = names.indexOf(boneName);
    if (idx >= 0) humanBones[slot] = { node: idx };
  }

  // 2. expressions: bind morph targets (ARKit names) to VRM presets
  const meshMorphs = [];   // { nodeIndex, names: [] }
  nodes.forEach((n, ni) => {
    if (n.mesh === undefined) return;
    const mesh = json.meshes[n.mesh];
    const tn = (mesh.extras && mesh.extras.targetNames) ||
               (mesh.primitives && mesh.primitives[0] && mesh.primitives[0].extras && mesh.primitives[0].extras.targetNames) || [];
    if (tn.length) meshMorphs.push({ nodeIndex: ni, names: tn });
  });
  const preset = {};
  let boundCount = 0;
  for (const [expr, rules] of Object.entries(EXPRESSION_MAP)) {
    const binds = [];
    for (const mm of meshMorphs) {
      mm.names.forEach((nm, mi) => {
        for (const r of rules) if (r.rx.test(nm)) { binds.push({ node: mm.nodeIndex, index: mi, weight: r.w }); break; }
      });
    }
    if (binds.length) {
      preset[expr] = { morphTargetBinds: binds, isBinary: false, overrideBlink: 'none', overrideLookAt: 'none', overrideMouth: 'none' };
      boundCount++;
    }
  }
  preset.neutral = { isBinary: false, overrideBlink: 'none', overrideLookAt: 'none', overrideMouth: 'none' };

  // 2b. PerfectSync: expose every ARKit morph as a custom expression so
  // iPhone trackers (VSeeFace / VTube Studio / Warudo) can drive the full 52.
  const custom = {};
  for (const mm of meshMorphs) {
    mm.names.forEach((nm, mi) => {
      if (custom[nm]) { custom[nm].morphTargetBinds.push({ node: mm.nodeIndex, index: mi, weight: 1 }); return; }
      custom[nm] = { morphTargetBinds: [{ node: mm.nodeIndex, index: mi, weight: 1 }], isBinary: false, overrideBlink: 'none', overrideLookAt: 'none', overrideMouth: 'none' };
    });
  }

  // 2c. firstPerson annotations: the mesh carrying face morphs is the head —
  // thirdPersonOnly so POV/VR cameras don't sit inside it; all others 'both'.
  const faceNodes = new Set(meshMorphs.map(m => m.nodeIndex));
  const meshAnnotations = nodes.map((n, ni) => n.mesh === undefined ? null :
    { node: ni, type: faceNodes.has(ni) ? 'thirdPersonOnly' : 'both' }).filter(Boolean);

  // 2d. spring bones: auto-detect hair/tail/accessory chains by name —
  // hair that sways is the single biggest "looks alive" multiplier.
  const springChains = detectChainsFromGLTF(json);

  // 3. assemble VRMC_vrm
  const vrm = {
    specVersion: '1.0',
    meta: {
      name: opts.name || 'PolyPotion character',
      version: '1.0',
      authors: [opts.author || 'PolyPotion user'],
      licenseUrl: 'https://vrm.dev/licenses/1.0/',
      avatarPermission: 'onlyAuthor',
      allowExcessivelyViolentUsage: false,
      allowExcessivelySexualUsage: false,
      commercialUsage: opts.commercial ? 'personalProfit' : 'personalNonProfit',
      allowRedistribution: false,
      modification: 'prohibited',
    },
    humanoid: { humanBones },
    firstPerson: { meshAnnotations },
    lookAt: {
      type: (preset.lookUp || preset.lookLeft) ? 'expression' : 'bone',
      offsetFromHeadBone: [0, 0.06, 0],
      rangeMapHorizontalInner: { inputMaxValue: 90, outputScale: 10 },
      rangeMapHorizontalOuter: { inputMaxValue: 90, outputScale: 10 },
      rangeMapVerticalDown: { inputMaxValue: 90, outputScale: 10 },
      rangeMapVerticalUp: { inputMaxValue: 90, outputScale: 10 },
    },
    expressions: { preset, custom },
  };

  json.extensions = json.extensions || {};
  json.asset = json.asset || {};
  json.asset.generator = ((json.asset.generator || '') + ' + PolyPotion VRM export').trim();

  // 4. serialize as 1.0 (VRMC_vrm) or legacy 0.x (extension "VRM") —
  // VSeeFace and many Unity pipelines still read 0.x most reliably.
  if (opts.version === '0.x') {
    json.extensions.VRM = buildVRM0(vrm, preset, custom, nodes, names, map);
    if (springChains.length) json.extensions.VRM.secondaryAnimation = buildSecondary(springChains);
    json.extensionsUsed = Array.from(new Set([...(json.extensionsUsed || []), 'VRM']));
  } else {
    json.extensions.VRMC_vrm = vrm;
    if (springChains.length) json.extensions.VRMC_springBone = buildVRMC(springChains);
    json.extensionsUsed = Array.from(new Set([...(json.extensionsUsed || []), 'VRMC_vrm', ...(springChains.length ? ['VRMC_springBone'] : [])]));
  }

  return {
    buffer: buildGLB(json, bin),
    report: { convention, bones: Object.keys(humanBones).length, expressions: boundCount, customExpressions: Object.keys(custom).length, morphMeshes: meshMorphs.length, springs: springChains.length, version: opts.version === '0.x' ? '0.x' : '1.0' },
  };
}

// ---- VRM 0.x (legacy) serializer ---------------------------
// Same data, older dialect: humanBones as an array, expressions as
// blendShapeMaster groups with weights 0-100, firstPerson flags by name.
const PRESET_0X = { aa: 'A', ih: 'I', ou: 'U', ee: 'E', oh: 'O', blink: 'Blink', blinkLeft: 'Blink_L', blinkRight: 'Blink_R', happy: 'Joy', angry: 'Angry', sad: 'Sorrow', surprised: 'Surprised', lookUp: 'LookUp', lookDown: 'LookDown', lookLeft: 'LookLeft', lookRight: 'LookRight', neutral: 'Neutral' };
function buildVRM0(vrm, preset, custom, nodes, names, map) {
  const humanBones = Object.entries(map).map(([slot, boneName]) => ({
    bone: slot, node: names.indexOf(boneName), useDefaultValues: true,
  })).filter(b => b.node >= 0);
  const groups = [];
  const toGroup = (name, presetName, def) => ({
    name, presetName,
    binds: (def.morphTargetBinds || []).map(b => {
      const node = nodes[b.node];
      return { mesh: node ? node.mesh : 0, index: b.index, weight: Math.round((b.weight || 1) * 100) };
    }),
    materialValues: [], isBinary: false,
  });
  for (const [k, def] of Object.entries(preset)) {
    // 0.x has no 'surprised' preset — keep the group but mark presetName unknown
    const pn = k === 'surprised' ? 'unknown' : (PRESET_0X[k] || 'unknown').toLowerCase();
    groups.push(toGroup(PRESET_0X[k] || k, pn, def));
  }
  for (const [k, def] of Object.entries(custom)) groups.push(toGroup(k, 'unknown', def));
  const m = vrm.meta;
  return {
    exporterVersion: 'PolyPotion',
    specVersion: '0.0',
    meta: {
      title: m.name, version: m.version, author: m.authors[0],
      allowedUserName: 'OnlyAuthor', violentUssageName: 'Disallow', sexualUssageName: 'Disallow',
      commercialUssageName: m.commercialUsage === 'personalNonProfit' ? 'Disallow' : 'Allow',
      licenseName: 'Other', otherLicenseUrl: m.licenseUrl,
    },
    humanoid: { humanBones, armStretch: 0.05, legStretch: 0.05, upperArmTwist: 0.5, lowerArmTwist: 0.5, upperLegTwist: 0.5, lowerLegTwist: 0.5, feetSpacing: 0, hasTranslationDoF: false },
    firstPerson: {
      firstPersonBone: humanBones.find(b => b.bone === 'head') ? humanBones.find(b => b.bone === 'head').node : -1,
      firstPersonBoneOffset: { x: 0, y: 0.06, z: 0 },
      meshAnnotations: (vrm.firstPerson.meshAnnotations || []).map(a => ({ mesh: nodes[a.node] ? nodes[a.node].mesh : 0, firstPersonFlag: a.type === 'thirdPersonOnly' ? 'ThirdPersonOnly' : 'Both' })),
      lookAtTypeName: vrm.lookAt.type === 'expression' ? 'BlendShape' : 'Bone',
      lookAtHorizontalInner: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
      lookAtHorizontalOuter: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
      lookAtVerticalDown: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
      lookAtVerticalUp: { curve: [0, 0, 0, 1, 1, 1, 1, 0], xRange: 90, yRange: 10 },
    },
    blendShapeMaster: { blendShapeGroups: groups },
    secondaryAnimation: { boneGroups: [], colliderGroups: [] },
    materialProperties: [],
  };
}

export default { exportVRM };
