// ============================================================
// exporter.js — PolyPotion universal export  (window.PPExport / ES module)
// One exit door for a finished character. Takes a GLB ArrayBuffer (the format
// every tool hands back / stores), applies an up-axis + unit-scale transform,
// and writes it out in the format the target app wants:
//   • GLB / glTF  — Godot, Blender, three.js, anything modern (default)
//   • OBJ         — universal static mesh
//   • STL         — 3D printing
//   • USDZ        — Apple Quick Look / AR
//   • FBX         — Unity / Maya (skeleton + skin via the AutoRig FBX writer;
//                   cleanest for characters rigged in PolyPotion)
// Everything runs on-device. No upload, no server.
// Up-axis: glTF is Y-up; choosing Z-up bakes a −90°X rotation so the asset
// lands upright in Blender/Unreal. Unit scale multiplies the whole rig
// (target-app presets set sensible defaults).
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/STLExporter.js';
import { USDZExporter } from 'https://esm.sh/three@0.160.0/examples/jsm/exporters/USDZExporter.js';

export const FORMATS = [
  { id: 'glb', label: 'glTF Binary', ext: 'glb', note: 'Godot · Blender · three.js', rig: true, anim: true, compress: true },
  { id: 'gltf', label: 'glTF (text + .bin)', ext: 'gltf', note: 'editable JSON', rig: true, anim: true },
  { id: 'fbx', label: 'FBX', ext: 'fbx', note: 'Unity · Maya (skeleton)', rig: true, anim: false },
  { id: 'obj', label: 'OBJ', ext: 'obj', note: 'universal static mesh', rig: false, anim: false },
  { id: 'stl', label: 'STL', ext: 'stl', note: '3D printing', rig: false, anim: false },
  { id: 'usdz', label: 'USDZ', ext: 'usdz', note: 'Apple AR / Quick Look', rig: false, anim: false },
  { id: 'vrm', label: 'VRM 1.0 avatar', ext: 'vrm', note: 'VRChat · VSeeFace · Warudo', rig: true, anim: false },
  { id: 'passport', label: 'Passport (.html)', ext: 'html', note: 'shareable one-file viewer', rig: false, anim: false },
];

// ---- compression choices (audit: "Draco / meshopt on the way out") ----
export const COMPRESSION = [
  { id: 'none', label: 'None' },
  { id: 'meshopt', label: 'meshopt', note: 'EXT_meshopt_compression — fast, wide support' },
  { id: 'draco', label: 'Draco', note: 'KHR_draco_mesh_compression — smallest files' },
];

export const PRESETS = {
  gltf:    { label: 'glTF / Godot', up: 'y', scale: 1 },
  blender: { label: 'Blender',      up: 'z', scale: 1 },
  unity:   { label: 'Unity',        up: 'y', scale: 1 },
  unreal:  { label: 'Unreal',       up: 'z', scale: 1 },
  print:   { label: '3D print (mm)', up: 'z', scale: 100 },
};

// ---- skeleton naming targets (audit: "bone-name maps on export") ----
// 'keep' leaves names alone; others rename via bone-map.js dictionaries so
// the rig lands as a first-class humanoid in the target app.
export const SKELETON_TARGETS = [
  { id: 'keep',   label: 'Keep names' },
  { id: 'vrm',    label: 'VRM / Unity Humanoid' },
  { id: 'mixamo', label: 'Mixamo' },
  { id: 'ue5',    label: 'UE5 Mannequin' },
  { id: 'rigify', label: 'Blender Rigify' },
];

async function renameSkeleton(scene, targetId) {
  if (!targetId || targetId === 'keep') return null;
  const { buildBoneMap, renameForTarget } = await import('./bone-map.js');
  const names = [];
  scene.traverse(o => { if (o.isBone) names.push(o.name); });
  if (!names.length) return { renamed: 0, detected: 'none' };
  const { map, convention } = buildBoneMap(names);
  const renames = renameForTarget(map, targetId);
  let renamed = 0;
  scene.traverse(o => {
    if (o.isBone && renames[o.name]) { o.name = renames[o.name]; renamed++; }
  });
  // keep animation track bindings in sync
  (scene.animations || []).forEach(clip => clip.tracks.forEach(tr => {
    const m = tr.name.match(/^([^.]+)\.(.+)$/);
    if (m && renames[m[1]]) tr.name = renames[m[1]] + '.' + m[2];
  }));
  return { renamed, detected: convention, mapped: Object.keys(map).length };
}

// ---- pre-export sanity check (audit: "unit & scale validator") ----
// Catches the 300× character and the millimetre scan BEFORE they leave.
// Returns { ok, height, issues:[{code,message,fix}] } — fix is a suggested
// scale multiplier where one exists.
export function validateScale(scene, opts) {
  opts = opts || {};
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const height = size.y;
  const issues = [];
  if (!isFinite(height) || height <= 0) {
    issues.push({ code: 'empty', message: 'No measurable geometry.' });
    return { ok: false, height: 0, issues };
  }
  if (height > 100) issues.push({ code: 'huge', message: 'Character is ' + height.toFixed(0) + ' m tall — looks like centimetres or millimetres pretending to be metres.', fix: height > 500 ? 0.001 : 0.01 });
  else if (height > 4 && !opts.allowLarge) issues.push({ code: 'large', message: 'Character is ' + height.toFixed(1) + ' m tall — taller than any human. Intentional (creature/building) or a scale slip?', fix: 1.75 / height });
  else if (height < 0.02) issues.push({ code: 'tiny', message: 'Character is ' + (height * 1000).toFixed(1) + ' mm tall — looks like metres exported as millimetres.', fix: 1000 * (1.75 / (height * 1000)) });
  else if (height < 0.5 && !opts.allowSmall) issues.push({ code: 'small', message: 'Character is ' + (height * 100).toFixed(0) + ' cm tall — pocket-sized. Intentional?', fix: 1.75 / height });
  let nonUniform = false;
  scene.traverse(o => { const s = o.scale; if (Math.abs(s.x - s.y) > 1e-3 || Math.abs(s.y - s.z) > 1e-3) nonUniform = true; });
  if (nonUniform) issues.push({ code: 'nonuniform', message: 'A node has non-uniform scale — skinned meshes will shear in most engines.' });
  return { ok: !issues.length, height, issues };
}

async function parseGLB(buffer) {
  const loader = new GLTFLoader();
  const g = await new Promise((res, rej) => loader.parse(buffer, '', res, rej));
  const scene = g.scene || (g.scenes && g.scenes[0]);
  scene.animations = g.animations || scene.animations || [];
  return scene;
}

// Wrap in a container that carries the up-axis + scale, so node-aware
// exporters (glTF/USDZ) keep the rig and matrix-aware ones (OBJ/STL) bake it.
function transformed(scene, upAxis, scale) {
  const container = new THREE.Group();
  container.add(scene);
  if (scale && scale !== 1) container.scale.setScalar(scale);
  if (upAxis === 'z') container.rotation.x = -Math.PI / 2;
  container.updateMatrixWorld(true);
  return container;
}

function download(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 600);
}

// ---- FBX: build the AutoRig FBX writer's rigData from a loaded scene ----
async function ensureFbx() {
  if (window.FbxExport) return window.FbxExport;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = './studio3D_scripts/fbx-export.js'; s.onload = res; s.onerror = () => rej(new Error('FBX writer failed to load')); document.head.appendChild(s); });
  if (!window.FbxExport) throw new Error('FBX writer unavailable');
  return window.FbxExport;
}
function buildRigData(container, scale) {
  container.updateMatrixWorld(true);
  const skinned = []; const staticMeshes = [];
  container.traverse(o => { if (o.isSkinnedMesh && o.skeleton) skinned.push(o); else if (o.isMesh) staticMeshes.push(o); });

  const meshesSrc = skinned.length ? skinned : staticMeshes;
  if (!meshesSrc.length) throw new Error('No mesh to export');

  // shared skeleton from the first skinned mesh (AutoRig rigs are single-skeleton)
  let bones = [], boneIndex = new Map();
  if (skinned.length) {
    const skel = skinned[0].skeleton;
    skel.bones.forEach((b, i) => boneIndex.set(b, i));
    bones = skel.bones.map((b, i) => {
      const parent = boneIndex.has(b.parent) ? boneIndex.get(b.parent) : -1;
      const wm = b.matrixWorld.clone();
      return { name: (b.name || ('bone' + i)).replace(/[^A-Za-z0-9_]/g, '_'), parent, worldMatrix: wm.elements.slice(), localPos: [b.position.x, b.position.y, b.position.z] };
    });
  }

  const meshes = meshesSrc.map((m, mi) => {
    let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    const pos = geo.attributes.position; const nrm = geo.attributes.normal; const uv = geo.attributes.uv;
    const vc = pos.count;
    const positions = new Float32Array(vc * 3), normals = new Float32Array(vc * 3), uvs = new Float32Array(vc * 2);
    const si = new Uint16Array(vc * 4), sw = new Float32Array(vc * 4);
    const gsi = geo.attributes.skinIndex, gsw = geo.attributes.skinWeight;
    for (let i = 0; i < vc; i++) {
      positions[i * 3] = pos.getX(i); positions[i * 3 + 1] = pos.getY(i); positions[i * 3 + 2] = pos.getZ(i);
      if (nrm) { normals[i * 3] = nrm.getX(i); normals[i * 3 + 1] = nrm.getY(i); normals[i * 3 + 2] = nrm.getZ(i); }
      if (uv) { uvs[i * 2] = uv.getX(i); uvs[i * 2 + 1] = uv.getY(i); }
      for (let k = 0; k < 4; k++) { si[i * 4 + k] = gsi ? gsi.getComponent(i, k) : 0; sw[i * 4 + k] = gsw ? gsw.getComponent(i, k) : 0; }
    }
    const index = new Uint32Array(vc); for (let i = 0; i < vc; i++) index[i] = i;
    geo.dispose();
    return { name: (m.name || ('mesh' + mi)).replace(/[^A-Za-z0-9_]/g, '_'), positions, normals, uvs, index, skinIndex: si, skinWeight: sw, vertexCount: vc };
  });

  return { bones, meshes };
}

// ---- main entry ----
// checkGLB(buffer) → validateScale result for a raw GLB (pre-flight UI helper)
export async function checkGLB(buffer) {
  const scene = await parseGLB(buffer.slice(0));
  return validateScale(scene);
}

export async function exportCharacter(buffer, opts) {
  opts = opts || {};
  const fmt = opts.format || 'glb';
  const upAxis = opts.upAxis || 'y';
  const scale = opts.scale || 1;
  const base = (opts.name || 'character').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_\-]+/g, '_') || 'character';

  const scene = await parseGLB(buffer.slice(0));
  const anims = scene.animations || [];
  let skeletonReport = null;
  if (opts.skeleton && opts.skeleton !== 'keep' && fmt !== 'vrm') {
    scene.animations = anims;                       // renameSkeleton reads them
    skeletonReport = await renameSkeleton(scene, opts.skeleton);
  }
  if (fmt === 'passport') {
    // One self-contained .html: embedded GLB + zero-dependency viewer + stats/
    // credits/licence footer. Always Y-up (the viewer orbits it); the unit-scale
    // slider (and the validator's one-click fix) IS honoured by re-packing.
    const { exportPassport } = await import('./passport-export.js');
    let pbuf = buffer;
    if (scale && scale !== 1) {
      const exporter = new GLTFExporter();
      pbuf = await new Promise((res, rej) => exporter.parse(transformed(scene, 'y', scale), res, rej, { binary: true, animations: anims, onlyVisible: false, embedImages: true }));
    }
    const r = exportPassport(pbuf, { name: base, title: opts.name || base, author: opts.author, licence: opts.licence });
    return { format: fmt, file: r.file, passport: r.stats };
  }

  let atlasReport = null;
  if (opts.atlas && (fmt === 'glb' || fmt === 'gltf' || fmt === 'fbx' || fmt === 'usdz')) {
    // Texture atlas + material merge (draw-call reducer). Runs before the
    // up-axis/scale wrap so world-baking stays correct.
    const { mergeToAtlas } = await import('./atlas-merge.js');
    const a = await mergeToAtlas(scene, { size: opts.atlasSize || 2048, onStatus: opts.onStatus });
    atlasReport = a.report;
  }

  const container = transformed(scene, upAxis, scale);

  if (fmt === 'glb' || fmt === 'gltf') {
    const binary = fmt === 'glb';
    const exporter = new GLTFExporter();
    const out = await new Promise((res, rej) => exporter.parse(container, res, rej, { binary, animations: anims, onlyVisible: false, embedImages: true }));
    if (binary && opts.compress && opts.compress !== 'none') {
      // Draco (geometry) or meshopt (buffers) via glTF-Transform; KHR material
      // extensions (transmission/clearcoat/sheen/iridescence) pass through.
      const { optimizeGLB } = await import('./glb-optimize.js');
      const r = await optimizeGLB(out, { method: opts.compress });
      download(new Blob([r.buffer], { type: 'model/gltf-binary' }), base + '.glb');
      return { format: fmt, file: base + '.glb', skeleton: skeletonReport, compression: r, atlas: atlasReport };
    }
    if (binary) { download(new Blob([out], { type: 'model/gltf-binary' }), base + '.glb'); }
    else { download(new Blob([JSON.stringify(out, null, 2)], { type: 'model/gltf+json' }), base + '.gltf'); }
    return { format: fmt, file: base + '.' + fmt, skeleton: skeletonReport, atlas: atlasReport };
  }

  if (fmt === 'obj') {
    const text = new OBJExporter().parse(container);
    download(new Blob([text], { type: 'text/plain' }), base + '.obj');
    return { format: fmt, file: base + '.obj', skeleton: skeletonReport };
  }

  if (fmt === 'stl') {
    const text = new STLExporter().parse(container, { binary: true });
    const blob = text instanceof DataView ? new Blob([text], { type: 'model/stl' }) : new Blob([text], { type: 'model/stl' });
    download(blob, base + '.stl');
    return { format: fmt, file: base + '.stl' };
  }

  if (fmt === 'usdz') {
    const exporter = new USDZExporter();
    const arr = await exporter.parse(container);
    download(new Blob([arr], { type: 'model/vnd.usdz+zip' }), base + '.usdz');
    return { format: fmt, file: base + '.usdz', skeleton: skeletonReport };
  }

  if (fmt === 'vrm') {
    // VRM is always Y-up, metres — ignore up-axis/scale presets on purpose
    const { exportVRM } = await import('./vrm-export.js');
    const exporter = new GLTFExporter();
    const glb = await new Promise((res, rej) => exporter.parse(scene, res, rej, { binary: true, animations: [], onlyVisible: false, embedImages: true }));
    const { buffer: vrmBuf, report } = exportVRM(glb, { name: base });
    download(new Blob([vrmBuf], { type: 'model/gltf-binary' }), base + '.vrm');
    return { format: fmt, file: base + '.vrm', vrm: report };
  }

  if (fmt === 'fbx') {
    const Fbx = await ensureFbx();
    const rigData = buildRigData(container, scale);
    const blob = Fbx.export(rigData);
    download(blob, base + '.fbx');
    return { format: fmt, file: base + '.fbx', rigged: rigData.bones.length > 0, skeleton: skeletonReport };
  }

  throw new Error('Unknown format: ' + fmt);
}

// convenience global (the shell isn't a module)
window.PPExport = { exportCharacter, checkGLB, validateScale, FORMATS, PRESETS, SKELETON_TARGETS, COMPRESSION };
export default { exportCharacter, checkGLB, validateScale, FORMATS, PRESETS, SKELETON_TARGETS, COMPRESSION };
