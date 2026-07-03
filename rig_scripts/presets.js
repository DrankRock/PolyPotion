// ============================================================
// AUTORIG — SKELETON PRESETS  (window.RigPresets)
// Add a preset by appending an object here. `groups` toggles which joint
// groups start enabled. Group ids come from rig_scripts/template.js GROUPS:
//   core · arms · legs · head · feet · fingers
// The first entry is the default selection.
// ============================================================
window.RigPresets = [
  {
    id: 'mixamo',
    label: 'Mixamo / Rokoko — humanoid (no fingers)',
    groups: { core: true, arms: true, legs: true, head: true, feet: true, fingers: false, face: false },
  },
  {
    id: 'mixamo_fingers',
    label: 'Mixamo / Rokoko — humanoid + fingers',
    groups: { core: true, arms: true, legs: true, head: true, feet: true, fingers: true, face: false },
  },
  {
    id: 'full',
    label: 'Full — body + fingers + toes + face',
    groups: { core: true, arms: true, legs: true, head: true, feet: true, fingers: true, face: true },
  },
  {
    id: 'basic',
    label: 'Basic — body only (no hands/feet/head)',
    groups: { core: true, arms: true, legs: true, head: false, feet: false, fingers: false, face: false },
  },
];
