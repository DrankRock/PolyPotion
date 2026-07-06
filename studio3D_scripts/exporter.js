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
  { id: 'glb', label: 'glTF Binary', ext: 'glb', note: 'Godot · Blender · three.js', rig: true, anim: true },
  { id: 'gltf', label: 'glTF (text + .bin)', ext: 'gltf', note: 'editable JSON', rig: true, anim: true },
  { id: 'fbx', label: 'FBX', ext: 'fbx', note: 'Unity · Maya (skeleton)', rig: true, anim: false },
  { id: 'obj', label: 'OBJ', ext: 'obj', note: 'universal static mesh', rig: false, anim: false },
  { id: 'stl', label: 'STL', ext: 'stl', note: '3D printing', rig: false, anim: false },
  { id: 'usdz', label: 'USDZ', ext: 'usdz', note: 'Apple AR / Quick Look', rig: false, anim: false },
];

export const PRESETS = {
  gltf:    { label: 'glTF / Godot', up: 'y', scale: 1 },
  blender: { label: 'Blender',      up: 'z', scale: 1 },
  unity:   { label: 'Unity',        up: 'y', scale: 1 },
  unreal:  { label: 'Unreal',       up: 'z', scale: 1 },
  print:   { label: '3D print (mm)', up: 'z', scale: 100 },
};

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
export async function exportCharacter(buffer, opts) {
  opts = opts || {};
  const fmt = opts.format || 'glb';
  const upAxis = opts.upAxis || 'y';
  const scale = opts.scale || 1;
  const base = (opts.name || 'character').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_\-]+/g, '_') || 'character';

  const scene = await parseGLB(buffer.slice(0));
  const anims = scene.animations || [];
  const container = transformed(scene, upAxis, scale);

  if (fmt === 'glb' || fmt === 'gltf') {
    const binary = fmt === 'glb';
    const exporter = new GLTFExporter();
    const out = await new Promise((res, rej) => exporter.parse(container, res, rej, { binary, animations: anims, onlyVisible: false, embedImages: true }));
    if (binary) { download(new Blob([out], { type: 'model/gltf-binary' }), base + '.glb'); }
    else { download(new Blob([JSON.stringify(out, null, 2)], { type: 'model/gltf+json' }), base + '.gltf'); }
    return { format: fmt, file: base + '.' + fmt };
  }

  if (fmt === 'obj') {
    const text = new OBJExporter().parse(container);
    download(new Blob([text], { type: 'text/plain' }), base + '.obj');
    return { format: fmt, file: base + '.obj' };
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
    return { format: fmt, file: base + '.usdz' };
  }

  if (fmt === 'fbx') {
    const Fbx = await ensureFbx();
    const rigData = buildRigData(container, scale);
    const blob = Fbx.export(rigData);
    download(blob, base + '.fbx');
    return { format: fmt, file: base + '.fbx', rigged: rigData.bones.length > 0 };
  }

  throw new Error('Unknown format: ' + fmt);
}

// convenience global (the shell isn't a module)
window.PPExport = { exportCharacter, FORMATS, PRESETS };
export default { exportCharacter, FORMATS, PRESETS };
