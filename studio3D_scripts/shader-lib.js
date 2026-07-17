// ============================================================
// shader-lib.js — SHOWCASE shader library (entry point).
//
// This is the "engine" half of the library: the shared GLSL (noise/fbm, the one
// vertex shader, the fragment prelude + main wrapper), the normalize/dedupe pass
// for the wild shelf, buildShaderMaterial(), presetDescriptors(), and the final
// SHADER_PRESETS assembly. It imports the presets themselves from per-category
// files under ./presets/ (one file per category), plus the shared GLSL glue
// (AXIS/LIQ/GLASS_ABOVE) from ./shader-glue.js.
//
// Presets are plain data. buildShaderMaterial() turns a shader preset into a
// live THREE.ShaderMaterial; physical presets carry their own make()/params.
// Imported by showcase-engine.js. Same THREE singleton (esm.sh dedupes URLs).
// ============================================================
import * as THREE from 'three';
import { AXIS, LIQ, GLASS_ABOVE } from './shader-glue.js';

// ---- core presets (curated set), one file per category ----
import { CORE_REALISTIC } from './presets/core-realistic.js';
import { CORE_LIQUID_ORGANIC } from './presets/core-liquid-organic.js';
import { CORE_STYLIZED } from './presets/core-stylized.js';
import { CORE_SCI_FI_FX } from './presets/core-sci-fi-fx.js';

// ---- wild shelf, one file per category (normalized/deduped below) ----
import { WILD_POTIONS_LIQUIDS } from './presets/wild-potions-liquids.js';
import { WILD_RADIANT_COSMIC } from './presets/wild-radiant-cosmic.js';
import { WILD_CANDY_CRYSTAL } from './presets/wild-candy-crystal.js';
import { WILD_SPOOKY_GLITCH } from './presets/wild-spooky-glitch.js';
import { WILD_MIND_BENDING } from './presets/wild-mind-bending.js';
import { WILD_BIOMIMETIC_ORGANIC } from './presets/wild-biomimetic-organic.js';
import { WILD_AGED_WEATHERED } from './presets/wild-aged-weathered.js';
import { WILD_STRUCTURAL_COLOR } from './presets/wild-structural-color.js';
import { WILD_CYBERPUNK_NEON } from './presets/wild-cyberpunk-neon.js';
import { WILD_ELEMENTAL_ENERGY } from './presets/wild-elemental-energy.js';
import { WILD_MATERIALS_SURFACES } from './presets/wild-materials-surfaces.js';
import { WILD_GLASS_TRANSMISSION } from './presets/wild-glass-transmission.js';

// ---------- shared GLSL: simplex noise + fbm + helpers ----------
const NOISE = `
vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x - floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 p){
  float f = 0.0, a = 0.5;
  for(int i=0;i<5;i++){ f += a*snoise(p); p *= 2.02; a *= 0.5; }
  return f;
}
vec3 hsv2rgb(vec3 c){
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz)*6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 toSRGB(vec3 c){ return pow(clamp(c, 0.0, 1.0), vec3(0.4545)); }
`;

// ---------- one vertex shader for all shader presets ----------
// Runs through three's skin/morph chunks so it deforms with the character,
// then optionally pushes verts along their normal for gooey / liquid looks.
const VERT = `
#include <common>
#include <skinning_pars_vertex>
#include <morphtarget_pars_vertex>
uniform float u_time;
uniform float u_speed;
uniform float u_displace;
uniform vec3 u_gravity;   // world "down" in OBJECT space (engine-updated for gravity presets)
uniform float u_sag;      // gravity droop amount (melting looks)
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying vec3 vViewNormal;
varying vec2 vUv;
varying vec3 vObjPos;
${NOISE}
void main(){
  vUv = uv;
  vObjPos = position;

  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>

  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>

  if (u_displace > 0.0001) {
    float d = fbm(position * 3.0 + vec3(0.0, u_time * u_speed * 0.6, u_time * u_speed * 0.3));
    transformed += normalize(objectNormal) * u_displace * d;
  }

  if (u_sag > 0.0001) {
    // droop verts along gravity — downward-facing surfaces sag most, with a
    // slow noise crawl so drips creep. u_gravity is object-space world-down.
    vec3 gd = normalize(u_gravity + vec3(0.0, -0.0001, 0.0));
    float droop = pow(clamp(0.5 - 0.5 * dot(normalize(objectNormal), -gd), 0.0, 1.0), 1.5);
    float sn = fbm(position * 2.2 + u_time * u_speed * 0.22);
    transformed += gd * u_sag * (0.3 + 0.7 * droop) * (0.55 + 0.45 * sn);
  }

  vec4 wp = modelMatrix * vec4(transformed, 1.0);
  vWorldPos = wp.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
  vViewNormal = normalize(transformedNormal);
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG_PRELUDE = `
precision highp float;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying vec3 vViewNormal;
varying vec2 vUv;
varying vec3 vObjPos;
uniform float u_time;
uniform float u_speed;
uniform float u_displace;
// gravity set — engine-updated per frame on presets flagged gravity:true;
// harmless defaults otherwise. See shader-lib-wild.js for how they're used.
uniform vec3 u_gravity;    // world down, object space, normalized
uniform vec3 u_slosh;      // damped-spring surface tilt vector
uniform float u_sloshMag;  // 0..1 agitation
uniform float u_levMin;    // bbox projected onto current up axis
uniform float u_levMax;
uniform float u_fill;      // fill fraction 0..1
// base texture: the mesh's OWN albedo map (if any). Shaders paint OVER it
// rather than replacing it, so a textured character keeps its texture and the
// shader modulates it. u_hasBaseMap gates it; u_texMix (0..1) fades it in.
uniform sampler2D u_baseMap;
uniform float u_hasBaseMap;
uniform float u_texMix;
${NOISE}
`;

const MAIN_OPEN = `
void main(){
  vec3 N = normalize(vWorldNormal);
  vec3 V = normalize(vViewDir);
  vec3 KL = normalize(vec3(0.5, 0.9, 0.55));
  float ndl = max(dot(N, KL), 0.0);
  float fillL = max(dot(N, normalize(vec3(-0.55, 0.25, -0.5))), 0.0);
  float diff = 0.26 + 0.78 * ndl + 0.22 * fillL;
  float fres = 1.0 - max(dot(N, V), 0.0);
  vec3 col = vec3(0.0);
  float alpha = 1.0;
  // sample the mesh's own texture (sRGB -> linear working space). Presets may
  // read baseTex/baseAlpha directly; otherwise it's composited at the end.
  vec3 baseTex = vec3(1.0);
  float baseAlpha = 1.0;
  if (u_hasBaseMap > 0.5) { vec4 _bt = texture2D(u_baseMap, vUv); baseTex = pow(_bt.rgb, vec3(2.2)); baseAlpha = _bt.a; }
`;
const MAIN_CLOSE = `
  // composite the shader OVER the mesh's own texture (multiply), faded by u_texMix.
  if (u_hasBaseMap > 0.5) col = mix(col, col * baseTex, clamp(u_texMix, 0.0, 1.0));
  gl_FragColor = vec4(toSRGB(col), clamp(alpha, 0.0, 1.0));
}
`;

// ============================================================
//  PRESET ASSEMBLY
// ============================================================
// Core looks (curated). Order preserved from the original library.
const CORE_PRESETS = [...CORE_REALISTIC, ...CORE_LIQUID_ORGANIC, ...CORE_STYLIZED, ...CORE_SCI_FI_FX];

// The wild shelf is hand-edited and accumulates cruft: duplicate ids (the same
// look pasted 2-3 times) and a few presets whose fragBody got saved as the
// literal STRING "AXIS + `...`" (or "LIQ + ...") instead of a real concatenated
// expression, so it never compiled. Normalize before use:
//   (1) repair string-form fragBodies by splicing in the real GLSL glue, and
//   (2) dedupe by id keeping the LAST definition (the newest, usually-fixed copy).
// Nothing unique is dropped — only redundant/older copies of the same id.
const _GLUE = { AXIS, LIQ, GLASS_ABOVE };
function normalizeWild(list) {
  const seen = new Map();
  for (const p of (list || [])) {
    let fb = p.fragBody;
    if (typeof fb === 'string') {
      const m = fb.match(/^\s*(AXIS|LIQ|GLASS_ABOVE)\s*\+\s*`([\s\S]*)`\s*$/);
      if (m) fb = (_GLUE[m[1]] || '') + m[2];
    }
    seen.set(p.id, fb === p.fragBody ? p : Object.assign({}, p, { fragBody: fb }));
  }
  return [...seen.values()];
}

// Raw wild shelf, concatenated from the per-category files (order preserved so
// that dedupe-by-last keeps the same winners as the original single file).
const WILD_PRESETS = [...WILD_POTIONS_LIQUIDS, ...WILD_RADIANT_COSMIC, ...WILD_CANDY_CRYSTAL, ...WILD_SPOOKY_GLITCH, ...WILD_MIND_BENDING, ...WILD_BIOMIMETIC_ORGANIC, ...WILD_AGED_WEATHERED, ...WILD_STRUCTURAL_COLOR, ...WILD_CYBERPUNK_NEON, ...WILD_ELEMENTAL_ENERGY, ...WILD_MATERIALS_SURFACES, ...WILD_GLASS_TRANSMISSION];

// Full library: core looks + the (normalized) wild shelf + anything the user
// brewed in Shader Lab (stored as plain preset objects in localStorage).
function customPresets() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem('pp_custom_shaders');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(p => p && p.id && p.name && typeof p.fragBody === 'string')
      .map(p => Object.assign({ category: 'Shader Lab', kind: 'shader' }, p));
  } catch (e) { return []; }
}
// Built-ins are static; Shader Lab customs are re-read from localStorage on
// every call, so a look published while Showcase is open appears as soon as
// the shelf re-renders — no reload needed.
const BUILTIN_PRESETS = [...CORE_PRESETS, ...normalizeWild(WILD_PRESETS)];
export function getShaderPresets() { return [...BUILTIN_PRESETS, ...customPresets()]; }
// Legacy alias — frozen at import time; prefer getShaderPresets().
export const SHADER_PRESETS = getShaderPresets();

// Build a live ShaderMaterial from a shader preset + a values map (param key -> value).
// baseMap (optional): the mesh's own albedo texture, so the shader paints OVER it.
export function buildShaderMaterial(preset, values, baseMap, texMix) {
  values = values || {};
  const uniforms = { u_time: { value: 0 } };
  for (const p of (preset.params || [])) {
    if (p.type === 'color') uniforms['u_' + p.key] = { value: new THREE.Color(values[p.key] != null ? values[p.key] : p.default) };
    else uniforms['u_' + p.key] = { value: (values[p.key] != null ? values[p.key] : p.default) };
  }
  if (!uniforms.u_speed) uniforms.u_speed = { value: 1.0 };
  if (!uniforms.u_displace) uniforms.u_displace = { value: 0.0 };
  if (!uniforms.u_sag) uniforms.u_sag = { value: 0.0 };
  if (!uniforms.u_fill) uniforms.u_fill = { value: 0.6 };
  if (!uniforms.u_gravity) uniforms.u_gravity = { value: new THREE.Vector3(0, -1, 0) };
  if (!uniforms.u_slosh) uniforms.u_slosh = { value: new THREE.Vector3() };
  if (!uniforms.u_sloshMag) uniforms.u_sloshMag = { value: 0.0 };
  if (!uniforms.u_levMin) uniforms.u_levMin = { value: -0.5 };
  if (!uniforms.u_levMax) uniforms.u_levMax = { value: 0.5 };
  uniforms.u_baseMap = { value: baseMap || null };
  uniforms.u_hasBaseMap = { value: baseMap ? 1.0 : 0.0 };
  uniforms.u_texMix = { value: baseMap ? (texMix != null ? texMix : 1.0) : 0.0 };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG_PRELUDE + (preset.fragUniforms || '') + MAIN_OPEN + (preset.fragBody || '') + MAIN_CLOSE,
    transparent: !!preset.transparent,
    depthWrite: preset.depthWrite !== undefined ? preset.depthWrite : !preset.transparent,
    side: THREE.DoubleSide,
    blending: preset.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    wireframe: !!preset.wireframe,
  });
  return { material: mat, uniforms };
}

// Lightweight, serialisable descriptors for the UI (no GLSL / functions).
export function presetDescriptors() {
  return getShaderPresets().map(p => ({
    id: p.id, name: p.name, category: p.category, swatch: p.swatch,
    params: (p.params || []).map(x => ({
      key: x.key, label: x.label, type: x.type,
      min: x.min, max: x.max, step: x.step != null ? x.step : 0.01, default: x.default,
    })),
  }));
}
