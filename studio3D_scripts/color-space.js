// ============================================================
// color-space.js — the ONE colour-management contract (audit, correctness §1)
// Two halves of the same policy, shared by every tool:
//
//   1. IMPORT TAGGING — tagObject(root, THREE): walk a loaded model and set the
//      right colorSpace on every material map. Colour data (baseColor, emissive,
//      sheen, specular tint) is sRGB; measurement data (normal, roughness,
//      metalness, AO, displacement, clearcoat) is linear/NoColorSpace. glTF
//      already tags correctly per spec, but FBX/OBJ and hand-built canvas
//      textures don't — this makes "washed-out normals in Unity" impossible.
//
//   2. VIEW TRANSFORM — applyViewTransform(renderer, THREE, id, exposure): one
//      named tone-mapping curve applied at display time. The working/linear
//      space is untouched; only how it's shown changes. 'srgb' is the identity
//      (what every tool renders today), so it stays the default and nothing
//      shifts until the user opts into AgX / Neutral / ACES in Showcase.
// ============================================================

// map slot → is it colour (sRGB) or data (linear)?
const COLOR_SLOTS = ['map', 'emissiveMap', 'sheenColorMap', 'specularColorMap'];
const DATA_SLOTS = ['normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'displacementMap',
  'bumpMap', 'clearcoatMap', 'clearcoatRoughnessMap', 'clearcoatNormalMap',
  'transmissionMap', 'thicknessMap', 'alphaMap', 'lightMap', 'iridescenceMap', 'iridescenceThicknessMap'];

export function tagObject(root, THREE) {
  if (!root) return { tagged: 0 };
  let tagged = 0;
  const seen = new Set();
  root.traverse(o => {
    if (!o.material) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      if (!m || seen.has(m)) return; seen.add(m);
      COLOR_SLOTS.forEach(s => { if (m[s] && m[s].isTexture && m[s].colorSpace !== THREE.SRGBColorSpace) { m[s].colorSpace = THREE.SRGBColorSpace; m[s].needsUpdate = true; tagged++; } });
      DATA_SLOTS.forEach(s => { if (m[s] && m[s].isTexture && m[s].colorSpace !== THREE.NoColorSpace) { m[s].colorSpace = THREE.NoColorSpace; m[s].needsUpdate = true; tagged++; } });
      if (m.needsUpdate !== undefined) m.needsUpdate = true;
    });
  });
  return { tagged };
}

// the view-transform menu. `tone` is resolved against THREE at apply time so we
// never touch a constant that a given three build might not ship.
export const VIEW_TRANSFORMS = [
  { id: 'srgb', label: 'sRGB', tone: 'NoToneMapping', note: 'Identity — raw linear-to-sRGB, the classic look.' },
  { id: 'neutral', label: 'Neutral', tone: 'NeutralToneMapping', note: 'Khronos PBR neutral — gentle highlight roll-off, hue-preserving.' },
  { id: 'agx', label: 'AgX', tone: 'AgXToneMapping', note: 'Filmic, desaturates bright highlights gracefully — the modern default.' },
  { id: 'aces', label: 'ACES', tone: 'ACESFilmicToneMapping', note: 'Punchy cinematic contrast; can shift hue in saturated reds.' },
];

export function applyViewTransform(renderer, THREE, id, exposure) {
  const def = VIEW_TRANSFORMS.find(v => v.id === id) || VIEW_TRANSFORMS[0];
  const tone = THREE[def.tone];
  renderer.toneMapping = tone != null ? tone : THREE.NoToneMapping;
  renderer.toneMappingExposure = exposure == null ? 1 : exposure;
  return def;
}

window.PPColor = { tagObject, applyViewTransform, VIEW_TRANSFORMS };
export default { tagObject, applyViewTransform, VIEW_TRANSFORMS };
