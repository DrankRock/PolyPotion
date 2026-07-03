// ============================================================
// AUTORIG — FBX EXPORTER  (window.FbxExport)
// Writes an ASCII FBX 7.4 with a skinned mesh: Geometry + LimbNode bones +
// BindPose + Skin/Cluster deformers + Connections. three.js ships no FBX
// exporter, so this is hand-rolled.
//
// Bind simplification: the rig's bones have identity local rotation (only
// translation), so each bone's world bind matrix is rotation-free. That kills
// all Euler-order ambiguity — Lcl Rotation is 0 for every bone and the bind
// lives entirely in the cluster TransformLink matrices.
//
// rigData = {
//   bones: [{name, parent(index|-1), worldMatrix[16] col-major, localPos[3]}],
//   meshes:[{name, positions, normals, uvs, index, skinIndex, skinWeight, vertexCount}]
// }
// ============================================================
window.FbxExport = (function () {

  const SCALE = 100;   // world units → cm, so a ~1.8u figure imports at ~180cm

  let _id = 1000000;
  const nextId = () => ++_id;

  function fmt(n) {
    if (!isFinite(n)) n = 0;
    if (Math.abs(n) < 1e-12) return '0';
    return (+n.toFixed(6)).toString();
  }
  // write a big numeric array as comma-joined, line-wrapped
  function arr(nums, perLine) {
    perLine = perLine || 30;
    let out = '', line = '';
    for (let i = 0; i < nums.length; i++) {
      line += fmt(nums[i]) + (i < nums.length - 1 ? ',' : '');
      if ((i + 1) % perLine === 0) { out += line + '\n'; line = ''; }
    }
    if (line) out += line + '\n';
    return out.replace(/\n$/, '');
  }

  function header() {
    const now = new Date();
    // NOTE: the first ~200 bytes must match the canonical Autodesk comment block.
    // three.js's isFbxFormatASCII() samples characters at triangular offsets
    // (0,1,3,6,10,15,21,28,36,45,55,66,78,91,105,120,136,153,171,190); a
    // non-standard header can coincidentally hit a "binary magic" char there and
    // be rejected as "Unknown format". This canonical block is known-safe.
    return `; FBX 7.4.0 project file
; Copyright (C) 1997-2010 Autodesk, Inc. and/or its licensors.
; All rights reserved.
; ----------------------------------------------------

FBXHeaderExtension:  {
\tFBXHeaderVersion: 1003
\tFBXVersion: 7400
\tCreationTimeStamp:  {
\t\tVersion: 1000
\t\tYear: ${now.getFullYear()}
\t\tMonth: ${now.getMonth() + 1}
\t\tDay: ${now.getDate()}
\t\tHour: ${now.getHours()}
\t\tMinute: ${now.getMinutes()}
\t\tSecond: ${now.getSeconds()}
\t\tMillisecond: 0
\t}
\tCreator: "AUTORIG - in-browser auto-rigger"
}
GlobalSettings:  {
\tVersion: 1000
\tProperties70:  {
\t\tP: "UpAxis", "int", "Integer", "",1
\t\tP: "UpAxisSign", "int", "Integer", "",1
\t\tP: "FrontAxis", "int", "Integer", "",2
\t\tP: "FrontAxisSign", "int", "Integer", "",1
\t\tP: "CoordAxis", "int", "Integer", "",0
\t\tP: "CoordAxisSign", "int", "Integer", "",1
\t\tP: "UnitScaleFactor", "double", "Number", "",1
\t}
}
`;
  }

  function definitions(counts) {
    let s = `Definitions:  {
\tVersion: 100
\tCount: ${counts.total}
\tObjectType: "GlobalSettings" {
\t\tCount: 1
\t}
\tObjectType: "Model" {
\t\tCount: ${counts.model}
\t}
\tObjectType: "Geometry" {
\t\tCount: ${counts.geometry}
\t}
\tObjectType: "Material" {
\t\tCount: ${counts.material}
\t}
\tObjectType: "Deformer" {
\t\tCount: ${counts.deformer}
\t}
\tObjectType: "Pose" {
\t\tCount: 1
\t}
\tObjectType: "NodeAttribute" {
\t\tCount: ${counts.attr}
\t}
}
`;
    return s;
  }

  function geometryObj(id, m) {
    const pos = m.positions;
    // control points
    const verts = new Array(pos.length);
    for (let i = 0; i < pos.length; i++) verts[i] = pos[i] * SCALE;

    // polygon vertex index
    let idx = m.index;
    if (!idx) { idx = new Uint32Array(m.vertexCount); for (let i = 0; i < idx.length; i++) idx[i] = i; }
    const triCount = idx.length / 3;
    const pvi = new Array(idx.length);
    for (let t = 0; t < triCount; t++) {
      pvi[t * 3] = idx[t * 3];
      pvi[t * 3 + 1] = idx[t * 3 + 1];
      pvi[t * 3 + 2] = -(idx[t * 3 + 2] + 1);  // last vertex of polygon: XOR -1
    }

    // ByPolygonVertex Direct normals + uvs
    const nrm = [], uvs = [];
    const N = m.normals, U = m.uvs;
    for (let i = 0; i < idx.length; i++) {
      const v = idx[i];
      if (N) { nrm.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); }
      if (U) { uvs.push(U[v * 2], U[v * 2 + 1]); }
    }

    let s = `\tGeometry: ${id}, "Geometry::${m.name}", "Mesh" {\n`;
    s += `\t\tVertices: *${verts.length} {\n\t\t\ta: ${arr(verts)}\n\t\t}\n`;
    s += `\t\tPolygonVertexIndex: *${pvi.length} {\n\t\t\ta: ${arr(pvi)}\n\t\t}\n`;
    s += `\t\tGeometryVersion: 124\n`;
    if (N) {
      s += `\t\tLayerElementNormal: 0 {\n\t\t\tVersion: 101\n\t\t\tName: ""\n`;
      s += `\t\t\tMappingInformationType: "ByPolygonVertex"\n\t\t\tReferenceInformationType: "Direct"\n`;
      s += `\t\t\tNormals: *${nrm.length} {\n\t\t\t\ta: ${arr(nrm)}\n\t\t\t}\n\t\t}\n`;
    }
    if (U) {
      s += `\t\tLayerElementUV: 0 {\n\t\t\tVersion: 101\n\t\t\tName: "map1"\n`;
      s += `\t\t\tMappingInformationType: "ByPolygonVertex"\n\t\t\tReferenceInformationType: "Direct"\n`;
      s += `\t\t\tUV: *${uvs.length} {\n\t\t\t\ta: ${arr(uvs)}\n\t\t\t}\n\t\t}\n`;
    }
    s += `\t\tLayerElementMaterial: 0 {\n\t\t\tVersion: 101\n\t\t\tName: ""\n`;
    s += `\t\t\tMappingInformationType: "AllSame"\n\t\t\tReferenceInformationType: "IndexToDirect"\n`;
    s += `\t\t\tMaterials: *1 {\n\t\t\t\ta: 0\n\t\t\t}\n\t\t}\n`;
    s += `\t\tLayer: 0 {\n\t\t\tVersion: 100\n`;
    if (N) s += `\t\t\tLayerElement:  {\n\t\t\t\tType: "LayerElementNormal"\n\t\t\t\tTypedIndex: 0\n\t\t\t}\n`;
    if (U) s += `\t\t\tLayerElement:  {\n\t\t\t\tType: "LayerElementUV"\n\t\t\t\tTypedIndex: 0\n\t\t\t}\n`;
    s += `\t\t\tLayerElement:  {\n\t\t\t\tType: "LayerElementMaterial"\n\t\t\t\tTypedIndex: 0\n\t\t\t}\n\t\t}\n`;
    s += `\t}\n`;
    return s;
  }

  function meshModel(id, name) {
    return `\tModel: ${id}, "Model::${name}", "Mesh" {
\t\tVersion: 232
\t\tProperties70:  {
\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",0,0,0
\t\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0
\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
\t\t\tP: "DefaultAttributeIndex", "int", "Integer", "",0
\t\t}
\t\tShading: T
\t\tCulling: "CullingOff"
\t}
`;
  }

  function limbModel(id, name, localPos) {
    const t = [localPos[0] * SCALE, localPos[1] * SCALE, localPos[2] * SCALE];
    return `\tModel: ${id}, "Model::${name}", "LimbNode" {
\t\tVersion: 232
\t\tProperties70:  {
\t\t\tP: "Lcl Translation", "Lcl Translation", "", "A",${fmt(t[0])},${fmt(t[1])},${fmt(t[2])}
\t\t\tP: "Lcl Rotation", "Lcl Rotation", "", "A",0,0,0
\t\t\tP: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
\t\t\tP: "DefaultAttributeIndex", "int", "Integer", "",0
\t\t}
\t\tShading: Y
\t\tCulling: "CullingOff"
\t}
`;
  }

  function limbAttr(id, name) {
    return `\tNodeAttribute: ${id}, "NodeAttribute::${name}", "LimbNode" {
\t\tProperties70:  {
\t\t\tP: "Size", "double", "Number", "",1
\t\t}
\t\tTypeFlags: "Skeleton"
\t}
`;
  }

  function materialObj(id, name) {
    return `\tMaterial: ${id}, "Material::${name}", "" {
\t\tVersion: 102
\t\tShadingModel: "phong"
\t\tMultiLayer: 0
\t\tProperties70:  {
\t\t\tP: "DiffuseColor", "Color", "", "A",0.72,0.745,0.78
\t\t\tP: "SpecularColor", "Color", "", "A",0.1,0.1,0.1
\t\t\tP: "Shininess", "double", "Number", "",20
\t\t}
\t}
`;
  }

  // matrix passed col-major (three .elements). FBX wants col-major too.
  function matWithScaledTranslation(e) {
    const m = e.slice();
    m[12] *= SCALE; m[13] *= SCALE; m[14] *= SCALE;     // translation column
    return m;
  }

  function skinDeformer(id, name) {
    return `\tDeformer: ${id}, "Deformer::${name}", "Skin" {
\t\tVersion: 101
\t\tLink_DeformAcuracy: 50
\t}
`;
  }

  function clusterDeformer(id, boneName, indexes, weights, linkMatrix) {
    const tl = matWithScaledTranslation(linkMatrix);
    const transform = identity16();           // mesh baked to world → identity
    let s = `\tDeformer: ${id}, "SubDeformer::${boneName}", "Cluster" {\n`;
    s += `\t\tVersion: 100\n`;
    s += `\t\tUserData: "", ""\n`;
    if (indexes.length) {
      s += `\t\tIndexes: *${indexes.length} {\n\t\t\ta: ${arr(indexes)}\n\t\t}\n`;
      s += `\t\tWeights: *${weights.length} {\n\t\t\ta: ${arr(weights)}\n\t\t}\n`;
    }
    s += `\t\tTransform: *16 {\n\t\t\ta: ${arr(transform, 16)}\n\t\t}\n`;
    s += `\t\tTransformLink: *16 {\n\t\t\ta: ${arr(tl, 16)}\n\t\t}\n`;
    s += `\t}\n`;
    return s;
  }

  function identity16() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }

  function export_(rigData) {
    if (!rigData || !rigData.meshes || !rigData.meshes.length) throw new Error('Nothing to export — bind first');
    _id = 1000000;
    const bones = rigData.bones;
    const meshes = rigData.meshes;

    // allocate ids
    const boneModelId = bones.map(() => nextId());
    const boneAttrId = bones.map(() => nextId());
    const meshModelId = meshes.map(() => nextId());
    const geoId = meshes.map(() => nextId());
    const matId = meshes.map(() => nextId());

    // per mesh: skin id + cluster ids per bone
    const skinId = meshes.map(() => nextId());
    const clusterId = meshes.map(() => bones.map(() => nextId()));
    const poseId = nextId();

    // ----- build cluster index/weight lists per mesh per bone -----
    const clusterData = meshes.map((m, mi) => {
      const lists = bones.map(() => ({ idx: [], w: [] }));
      const si = m.skinIndex, sw = m.skinWeight;
      const vc = m.vertexCount;
      for (let v = 0; v < vc; v++) {
        for (let k = 0; k < 4; k++) {
          const w = sw[v * 4 + k];
          if (w > 1e-5) { const b = si[v * 4 + k]; if (b < bones.length) { lists[b].idx.push(v); lists[b].w.push(w); } }
        }
      }
      return lists;
    });

    // ----- counts for Definitions -----
    const counts = {
      model: bones.length + meshes.length,
      geometry: meshes.length,
      material: meshes.length,
      deformer: meshes.length + meshes.length * bones.length,
      attr: bones.length,
    };
    counts.total = 1 + counts.model + counts.geometry + counts.material + counts.deformer + 1 + counts.attr;

    // ----- objects -----
    let O = 'Objects:  {\n';
    meshes.forEach((m, mi) => {
      O += geometryObj(geoId[mi], m);
      O += meshModel(meshModelId[mi], m.name);
      O += materialObj(matId[mi], m.name + '_mat');
    });
    bones.forEach((b, bi) => {
      O += limbModel(boneModelId[bi], b.name, b.localPos);
      O += limbAttr(boneAttrId[bi], b.name);
    });
    meshes.forEach((m, mi) => {
      O += skinDeformer(skinId[mi], m.name + '_skin');
      bones.forEach((b, bi) => {
        O += clusterDeformer(clusterId[mi][bi], b.name, clusterData[mi][bi].idx, clusterData[mi][bi].w, b.worldMatrix);
      });
    });

    // ----- bind pose -----
    let poseNodes = bones.length + meshes.length;
    O += `\tPose: ${poseId}, "Pose::BIND_POSES", "BindPose" {\n\t\tType: "BindPose"\n\t\tVersion: 100\n\t\tNbPoseNodes: ${poseNodes}\n`;
    meshes.forEach((m, mi) => {
      O += `\t\tPoseNode:  {\n\t\t\tNode: ${meshModelId[mi]}\n\t\t\tMatrix: *16 {\n\t\t\t\ta: ${arr(identity16(), 16)}\n\t\t\t}\n\t\t}\n`;
    });
    bones.forEach((b, bi) => {
      O += `\t\tPoseNode:  {\n\t\t\tNode: ${boneModelId[bi]}\n\t\t\tMatrix: *16 {\n\t\t\t\ta: ${arr(matWithScaledTranslation(b.worldMatrix), 16)}\n\t\t\t}\n\t\t}\n`;
    });
    O += `\t}\n`;
    O += '}\n';

    // ----- connections -----
    let C = 'Connections:  {\n';
    const oo = (a, b, comment) => { C += `\t;${comment}\n\tC: "OO",${a},${b}\n\n`; };
    meshes.forEach((m, mi) => {
      oo(meshModelId[mi], 0, `Model::${m.name} -> RootNode`);
      oo(geoId[mi], meshModelId[mi], `Geometry::${m.name} -> Model::${m.name}`);
      oo(matId[mi], meshModelId[mi], `Material -> Model::${m.name}`);
    });
    bones.forEach((b, bi) => {
      const parentModel = b.parent >= 0 ? boneModelId[b.parent] : 0;
      oo(boneModelId[bi], parentModel, `Bone ${b.name} -> ${b.parent >= 0 ? bones[b.parent].name : 'RootNode'}`);
      oo(boneAttrId[bi], boneModelId[bi], `NodeAttribute -> ${b.name}`);
    });
    meshes.forEach((m, mi) => {
      oo(skinId[mi], geoId[mi], `Skin -> Geometry::${m.name}`);
      bones.forEach((b, bi) => {
        oo(clusterId[mi][bi], skinId[mi], `Cluster ${b.name} -> Skin`);
        oo(boneModelId[bi], clusterId[mi][bi], `Bone ${b.name} -> Cluster`);
      });
    });
    C += '}\n';

    const text = header() + definitions(counts) + O + C;
    return new Blob([text], { type: 'application/octet-stream' });
  }

  return { export: export_ };
})();
