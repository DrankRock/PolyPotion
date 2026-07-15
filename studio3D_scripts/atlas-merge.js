// ============================================================
// atlas-merge.js — texture atlas + material merge (audit, interop §2)
// A draw-call reducer that runs on a parsed three.js scene right before export:
//   • packs every material's baseColor / metalRough / normal / emissive maps
//     (or solid factors) into shared grid atlases,
//   • rewrites each mesh's UVs into its atlas cell,
//   • merges all geometries that share a skeleton (or none) into ONE mesh with
//     ONE material.
// A 6-material character becomes 1 draw call. Runs fully on-device (canvas +
// three's BufferGeometryUtils). Skinned meshes are supported when they share a
// single skeleton (AutoRig rigs always do); mixed skeletons are left untouched.
//
//   mergeToAtlas(scene, { size, onStatus }) → { report }  (mutates scene)
//     report = { before:{draws,materials,textures}, after:{...}, atlas:size }
// ============================================================

import * as THREE from 'https://esm.sh/three@0.160.0';
import { mergeGeometries } from 'https://esm.sh/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js';

// Draw a source texture (or a solid colour) into one atlas cell.
function paintCell(ctx, tex, color, cx, cy, cell, fallbackWhite) {
  ctx.save();
  if (tex && tex.image && (tex.image.width || tex.image.naturalWidth)) {
    // tint the map by the factor colour (glTF multiplies map × factor)
    ctx.drawImage(tex.image, cx, cy, cell, cell);
    if (color && !(color.r === 1 && color.g === 1 && color.b === 1)) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgb(' + (color.r * 255 | 0) + ',' + (color.g * 255 | 0) + ',' + (color.b * 255 | 0) + ')';
      ctx.fillRect(cx, cy, cell, cell);
      ctx.globalCompositeOperation = 'source-over';
    }
  } else {
    const c = color || (fallbackWhite ? { r: 1, g: 1, b: 1 } : { r: 0.5, g: 0.5, b: 0.5 });
    ctx.fillStyle = 'rgb(' + (c.r * 255 | 0) + ',' + (c.g * 255 | 0) + ',' + (c.b * 255 | 0) + ')';
    ctx.fillRect(cx, cy, cell, cell);
  }
  ctx.restore();
}

function makeCanvas(px) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  return cv;
}

function texFromCanvas(cv, srgb) {
  const t = new THREE.CanvasTexture(cv);
  t.flipY = false;                 // glTF convention
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  return t;
}

export async function mergeToAtlas(scene, opts) {
  opts = opts || {};
  const status = opts.onStatus || function () {};
  const CAP = Math.min(Math.max(opts.size || 2048, 512), 4096);
  scene.updateMatrixWorld(true);

  // ---- collect meshes, split by skeleton identity ----
  const meshes = [];
  scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes.position) meshes.push(o); });
  if (meshes.length < 2) return { report: { skipped: true, reason: meshes.length + ' mesh — nothing to merge' } };

  const groups = new Map();   // skeleton (or null) → [meshes]
  meshes.forEach(m => {
    const key = m.isSkinnedMesh && m.skeleton ? m.skeleton : null;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });

  const beforeDraws = meshes.length;
  const beforeMats = new Set(); const beforeTex = new Set();
  meshes.forEach(m => (Array.isArray(m.material) ? m.material : [m.material]).forEach(mat => {
    if (!mat) return; beforeMats.add(mat);
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'].forEach(k => { if (mat[k]) beforeTex.add(mat[k]); });
  }));

  let groupIdx = 0;
  for (const [skeleton, list] of groups) {
    groupIdx++;
    if (list.length < 2) continue;    // a lone mesh in its group — leave it
    status('Atlasing group ' + groupIdx + ' (' + list.length + ' meshes)…');

    // unique materials in draw order; multi-material meshes expand by group
    const mats = [];
    const matIndex = new Map();
    const perMeshMat = list.map(m => {
      const arr = Array.isArray(m.material) ? m.material : [m.material];
      return arr.map(mat => {
        if (!matIndex.has(mat)) { matIndex.set(mat, mats.length); mats.push(mat); }
        return matIndex.get(mat);
      });
    });

    const N = mats.length;
    const cols = Math.ceil(Math.sqrt(N));
    const rows = Math.ceil(N / cols);
    const cell = Math.max(64, Math.floor(CAP / cols));
    const W = cell * cols, H = cell * rows;

    // which secondary maps exist anywhere in this group?
    const anyNormal = mats.some(m => m && m.normalMap);
    const anyMR = mats.some(m => m && (m.roughnessMap || m.metalnessMap));
    const anyEmis = mats.some(m => m && (m.emissiveMap || (m.emissive && (m.emissive.r || m.emissive.g || m.emissive.b))));

    const baseCv = makeCanvas(1); baseCv.width = W; baseCv.height = H;
    const baseCtx = baseCv.getContext('2d');
    let nrmCtx, mrCtx, emCtx, nrmCv, mrCv, emCv;
    if (anyNormal) { nrmCv = makeCanvas(1); nrmCv.width = W; nrmCv.height = H; nrmCtx = nrmCv.getContext('2d'); nrmCtx.fillStyle = '#8080ff'; nrmCtx.fillRect(0, 0, W, H); }
    if (anyMR) { mrCv = makeCanvas(1); mrCv.width = W; mrCv.height = H; mrCtx = mrCv.getContext('2d'); mrCtx.fillStyle = '#00ff00'; mrCtx.fillRect(0, 0, W, H); }
    if (anyEmis) { emCv = makeCanvas(1); emCv.width = W; emCv.height = H; emCtx = emCv.getContext('2d'); emCtx.fillStyle = '#000000'; emCtx.fillRect(0, 0, W, H); }

    const cellRect = i => ({ cx: (i % cols) * cell, cy: Math.floor(i / cols) * cell });

    mats.forEach((mat, i) => {
      const { cx, cy } = cellRect(i);
      const col = mat && mat.color ? mat.color : { r: 1, g: 1, b: 1 };
      paintCell(baseCtx, mat && mat.map, col, cx, cy, cell, true);
      if (nrmCtx) paintCell(nrmCtx, mat && mat.normalMap, null, cx, cy, cell, false);
      if (mrCtx) {
        // MR atlas: green = roughness, blue = metalness (glTF packing)
        const r = mat && mat.roughness != null ? mat.roughness : 1;
        const me = mat && mat.metalness != null ? mat.metalness : 0;
        if (mat && (mat.roughnessMap || mat.metalnessMap)) {
          paintCell(mrCtx, mat.roughnessMap || mat.metalnessMap, null, cx, cy, cell, false);
        } else {
          mrCtx.fillStyle = 'rgb(0,' + (r * 255 | 0) + ',' + (me * 255 | 0) + ')';
          mrCtx.fillRect(cx, cy, cell, cell);
        }
      }
      if (emCtx) {
        const e = mat && mat.emissive ? mat.emissive : { r: 0, g: 0, b: 0 };
        paintCell(emCtx, mat && mat.emissiveMap, mat && mat.emissiveMap ? null : e, cx, cy, cell, false);
      }
    });

    // ---- remap UVs + collect geometries ----
    const scaleU = cell / W, scaleV = cell / H;
    const geos = [];
    list.forEach((m, mi) => {
      let geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      // bake the mesh's world transform into the geometry so merged parts keep
      // their relative placement (skinned meshes stay in bind space → identity)
      if (!m.isSkinnedMesh) { m.updateWorldMatrix(true, false); geo.applyMatrix4(m.matrixWorld); }
      const uv = geo.attributes.uv;
      const count = geo.attributes.position.count;
      const nu = new Float32Array(count * 2);
      // figure this mesh's material cell(s). Multi-material via groups:
      const groupsG = geo.groups && geo.groups.length ? geo.groups : [{ start: 0, count: count, materialIndex: 0 }];
      for (const g of groupsG) {
        const localMat = perMeshMat[mi][g.materialIndex || 0] != null ? perMeshMat[mi][g.materialIndex || 0] : perMeshMat[mi][0];
        const { cx, cy } = cellRect(localMat);
        const offU = cx / W, offV = cy / H;
        const end = g.start + g.count;
        for (let vi = g.start; vi < end; vi++) {
          // toNonIndexed keeps vertices per-corner, so per-group ranges are exact
          const iu = uv ? (uv.getX(vi) % 1 + 1) % 1 : 0;
          const iv = uv ? (uv.getY(vi) % 1 + 1) % 1 : 0;
          nu[vi * 2] = offU + iu * scaleU;
          nu[vi * 2 + 1] = offV + iv * scaleV;
        }
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(nu, 2));
      geo.clearGroups();
      // keep only attributes that merge cleanly across the group
      const keep = ['position', 'normal', 'uv'];
      if (skeleton) { keep.push('skinIndex', 'skinWeight'); }
      Object.keys(geo.attributes).forEach(a => { if (!keep.includes(a)) geo.deleteAttribute(a); });
      geos.push(geo);
    });

    let merged;
    try { merged = mergeGeometries(geos, false); }
    catch (e) { status('Group ' + groupIdx + ' has incompatible geometry — left unmerged'); geos.forEach(g => g.dispose()); continue; }
    if (!merged) { geos.forEach(g => g.dispose()); continue; }

    const atlasMat = new THREE.MeshStandardMaterial({
      map: texFromCanvas(baseCv, true),
      metalness: anyMR ? 1 : 0,
      roughness: 1,
    });
    if (nrmCv) atlasMat.normalMap = texFromCanvas(nrmCv, false);
    if (mrCv) { atlasMat.roughnessMap = texFromCanvas(mrCv, false); atlasMat.metalnessMap = atlasMat.roughnessMap; }
    if (emCv) { atlasMat.emissiveMap = texFromCanvas(emCv, true); atlasMat.emissive = new THREE.Color(0xffffff); }
    atlasMat.name = 'atlas_' + groupIdx;

    let outMesh;
    if (skeleton) {
      outMesh = new THREE.SkinnedMesh(merged, atlasMat);
      outMesh.bind(skeleton, new THREE.Matrix4());
      // attach so the skeleton's bones resolve; mirror first mesh's parent
      (list[0].parent || scene).add(outMesh);
      if (list[0].skeleton && list[0].skeleton.boneInverses) outMesh.bindMatrixInverse.copy(list[0].bindMatrixInverse);
    } else {
      outMesh = new THREE.Mesh(merged, atlasMat);
      scene.add(outMesh);   // geometry already in world space
    }
    outMesh.name = 'merged_' + groupIdx;

    // remove the originals
    list.forEach(m => { if (m.parent) m.parent.remove(m); m.geometry.dispose && m.geometry.dispose(); });
    geos.forEach(g => g.dispose());
  }

  scene.updateMatrixWorld(true);

  // recount
  const afterMeshes = [];
  scene.traverse(o => { if (o.isMesh) afterMeshes.push(o); });
  const afterMats = new Set(); const afterTex = new Set();
  afterMeshes.forEach(m => (Array.isArray(m.material) ? m.material : [m.material]).forEach(mat => {
    if (!mat) return; afterMats.add(mat);
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'].forEach(k => { if (mat[k]) afterTex.add(mat[k]); });
  }));

  return {
    report: {
      before: { draws: beforeDraws, materials: beforeMats.size, textures: beforeTex.size },
      after: { draws: afterMeshes.length, materials: afterMats.size, textures: afterTex.size },
      atlas: CAP,
    },
  };
}

window.PPAtlas = { mergeToAtlas };
export default { mergeToAtlas };
