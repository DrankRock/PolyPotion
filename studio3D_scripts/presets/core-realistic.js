// ============================================================
// presets/core-realistic.js — "Realistic" core presets.
// Physical (MeshPhysicalMaterial) + hand-written shader looks.
// Merged into SHADER_PRESETS by ../shader-lib.js.
// ============================================================
import * as THREE from 'three';

export const CORE_REALISTIC = [
  {
    id: 'glass', name: 'Clear glass', category: 'Realistic', kind: 'physical', swatch: ['#cfeeff', '#8fbfe0'],
    params: [
      { key: 'color', label: 'Tint', type: 'color', default: '#dff2ff', apply: (m, v) => m.color.set(v) },
      { key: 'roughness', label: 'Frost', type: 'range', min: 0, max: 1, step: 0.01, default: 0.02, apply: (m, v) => { m.roughness = v; } },
      { key: 'ior', label: 'Density', type: 'range', min: 1, max: 2.3, step: 0.01, default: 1.5, apply: (m, v) => { m.ior = v; } },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ transmission: 1, thickness: 0.6, roughness: 0.02, metalness: 0, ior: 1.5, transparent: true, side: THREE.DoubleSide, envMapIntensity: 1 }),
  },
  {
    id: 'frosted', name: 'Frosted glass', category: 'Realistic', kind: 'physical', swatch: ['#eaf4f7', '#b9cdd4'],
    params: [
      { key: 'color', label: 'Tint', type: 'color', default: '#eef6f8', apply: (m, v) => m.color.set(v) },
      { key: 'roughness', label: 'Frost', type: 'range', min: 0.1, max: 1, step: 0.01, default: 0.55, apply: (m, v) => { m.roughness = v; } },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ transmission: 1, thickness: 0.9, roughness: 0.55, metalness: 0, ior: 1.4, transparent: true, side: THREE.DoubleSide, envMapIntensity: 1 }),
  },
  {
    id: 'chrome', name: 'Chrome', category: 'Realistic', kind: 'physical', swatch: ['#f4f6fa', '#9aa2ad'],
    params: [
      { key: 'color', label: 'Tint', type: 'color', default: '#f4f6fa', apply: (m, v) => m.color.set(v) },
      { key: 'roughness', label: 'Polish', type: 'range', min: 0, max: 0.5, step: 0.01, default: 0.03, apply: (m, v) => { m.roughness = v; } },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.03, color: 0xf4f6fa, envMapIntensity: 1.2, side: THREE.DoubleSide }),
  },
  {
    id: 'brushed', name: 'Brushed steel', category: 'Realistic', kind: 'physical', swatch: ['#c6cad0', '#7f858d'],
    params: [
      { key: 'color', label: 'Tint', type: 'color', default: '#b8bcc4', apply: (m, v) => m.color.set(v) },
      { key: 'roughness', label: 'Grain', type: 'range', min: 0.1, max: 0.8, step: 0.01, default: 0.38, apply: (m, v) => { m.roughness = v; } },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.38, color: 0xb8bcc4, envMapIntensity: 1, side: THREE.DoubleSide }),
  },
  {
    id: 'gold', name: 'Gold', category: 'Realistic', kind: 'physical', swatch: ['#ffe08a', '#c8912f'],
    params: [
      { key: 'color', label: 'Metal', type: 'color', default: '#ffce5a', apply: (m, v) => m.color.set(v) },
      { key: 'roughness', label: 'Polish', type: 'range', min: 0, max: 0.7, step: 0.01, default: 0.18, apply: (m, v) => { m.roughness = v; } },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.18, color: 0xffce5a, envMapIntensity: 1.2, side: THREE.DoubleSide }),
  },
  {
    id: 'copper', name: 'Copper', category: 'Realistic', kind: 'physical', swatch: ['#f0a878', '#a8582e'],
    params: [
      { key: 'color', label: 'Metal', type: 'color', default: '#d98b5a', apply: (m, v) => m.color.set(v) },
      { key: 'roughness', label: 'Polish', type: 'range', min: 0, max: 0.7, step: 0.01, default: 0.28, apply: (m, v) => { m.roughness = v; } },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ metalness: 1, roughness: 0.28, color: 0xd98b5a, envMapIntensity: 1.1, side: THREE.DoubleSide }),
  },
  {
    id: 'ceramic', name: 'Glazed ceramic', category: 'Realistic', kind: 'physical', swatch: ['#f2f4f7', '#c3ccd4'],
    params: [
      { key: 'color', label: 'Glaze', type: 'color', default: '#eef1f4', apply: (m, v) => m.color.set(v) },
      { key: 'roughness', label: 'Matte', type: 'range', min: 0.05, max: 0.9, step: 0.01, default: 0.28, apply: (m, v) => { m.roughness = v; } },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, color: 0xeef1f4, envMapIntensity: 1, side: THREE.DoubleSide }),
  },
  {
    id: 'pearl', name: 'Pearl / car paint', category: 'Realistic', kind: 'physical', swatch: ['#f7d7ee', '#8fb6e0'],
    params: [
      { key: 'color', label: 'Base', type: 'color', default: '#c05a9a', apply: (m, v) => m.color.set(v) },
      { key: 'iridescence', label: 'Shift', type: 'range', min: 0, max: 1, step: 0.01, default: 1, apply: (m, v) => { m.iridescence = v; } },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.6, color: 0xc05a9a, envMapIntensity: 1.1, side: THREE.DoubleSide }),
  },
  {
    id: 'velvet', name: 'Velvet', category: 'Realistic', kind: 'physical', swatch: ['#7a2740', '#3a1020'],
    params: [
      { key: 'color', label: 'Cloth', type: 'color', default: '#5a1f2a', apply: (m, v) => m.color.set(v) },
      { key: 'sheen', label: 'Sheen', type: 'color', default: '#d98a9a', apply: (m, v) => m.sheenColor.set(v) },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.9, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xd98a9a), color: 0x5a1f2a, envMapIntensity: 0.6, side: THREE.DoubleSide }),
  },
  {
    id: 'clay', name: 'Matte clay', category: 'Realistic', kind: 'physical', swatch: ['#d1a184', '#8a5a3e'],
    params: [
      { key: 'color', label: 'Clay', type: 'color', default: '#c88f6a', apply: (m, v) => m.color.set(v) },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 1, color: 0xc88f6a, envMapIntensity: 0.5, side: THREE.DoubleSide }),
  },
];
