// ============================================================
// shader-lib.js — SHOWCASE shader presets
// A curated library of "looks" you can drop onto any mesh: real physically
// based materials (glass, chrome, gold, velvet…) built on MeshPhysicalMaterial
// so they pick up the scene IBL, plus hand-written GLSL ShaderMaterials for the
// stylised / sci-fi / liquid effects (hologram, lava, mercury, dissolve…).
//
// Every ShaderMaterial shares ONE vertex shader that goes through three's
// skinning + morph chunks, so these looks survive on rigged, animated
// characters — the deformation still happens, we only repaint the surface.
//
// Presets are plain data. buildShaderMaterial() turns a shader preset into a
// live THREE.ShaderMaterial; physical presets carry their own make()/params.
// Imported by showcase-engine.js. Same THREE singleton (esm.sh dedupes URLs).
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { WILD_PRESETS, AXIS, LIQ, GLASS_ABOVE } from './shader-lib-wild.js';

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
//  PRESETS (core set — the wild set lives in shader-lib-wild.js)
// ============================================================
const CORE_PRESETS = [

  // ---------------- REALISTIC (physical materials) ----------------
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

  // ---------------- LIQUID & ORGANIC (shaders) ----------------
  {
    id: 'water', name: 'Water', category: 'Liquid & organic', kind: 'shader', swatch: ['#8fe0ff', '#0e6fa8'],
    transparent: true, depthWrite: false,
    params: [
      { key: 'color', label: 'Water', type: 'color', default: '#2aa8d8' },
      { key: 'speed', label: 'Flow', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color;',
    fragBody: `
      float w1 = snoise(vObjPos*4.0 + vec3(0.0, u_time*u_speed*0.6, u_time*u_speed*0.4));
      float w2 = snoise(vObjPos*9.0 - vec3(u_time*u_speed*0.5, 0.0, u_time*u_speed*0.3));
      vec3 nn = normalize(N + 0.32*vec3(w1, (w1+w2)*0.5, w2));
      vec3 r = reflect(-V, nn);
      float up = clamp(r.y*0.5+0.5, 0.0, 1.0);
      vec3 sky = mix(u_color*0.55, vec3(0.86,0.93,1.0), up);
      float f = pow(1.0 - max(dot(nn, V), 0.0), 3.0);
      col = mix(u_color*0.4, sky, clamp(f*1.5, 0.0, 1.0));
      float spark = pow(max(snoise(vObjPos*14.0 + u_time*u_speed), 0.0), 6.0);
      col += spark*0.6;
      alpha = clamp(0.72 + f*0.28, 0.0, 1.0);
    `,
  },
  {
    id: 'mercury', name: 'Liquid metal', category: 'Liquid & organic', kind: 'shader', swatch: ['#eef2f8', '#5a636e'],
    params: [
      { key: 'tint', label: 'Tint', type: 'color', default: '#cdd4de' },
      { key: 'ripple', label: 'Ripple', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.25 },
      { key: 'speed', label: 'Flow', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_tint; uniform float u_ripple;',
    fragBody: `
      float w = fbm(vObjPos*8.0 + u_time*u_speed*0.5);
      float w2 = fbm(vObjPos*8.0 + 30.0 - u_time*u_speed*0.4);
      vec3 nn = normalize(N + u_ripple*vec3(w, (w+w2)*0.5, w2));
      vec3 r = reflect(-V, nn);
      float up = clamp(r.y*0.5+0.5, 0.0, 1.0);
      vec3 sky = mix(vec3(0.05,0.06,0.08), vec3(0.92,0.95,1.0), pow(up,1.5));
      float spec = pow(up, 8.0);
      col = sky * u_tint + spec*0.6;
      col += pow(1.0 - max(dot(nn,V),0.0), 3.0) * 0.2;
    `,
  },
  {
    id: 'jelly', name: 'Jelly / goo', category: 'Liquid & organic', kind: 'shader', swatch: ['#ff8fc4', '#a83e78'],
    transparent: false, displaceParam: true,
    params: [
      { key: 'color', label: 'Jelly', type: 'color', default: '#ff7ab8' },
      { key: 'color2', label: 'Rim', type: 'color', default: '#fff3a0' },
      { key: 'displace', label: 'Wobble', type: 'range', min: 0, max: 0.3, step: 0.005, default: 0.12 },
      { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_color2;',
    fragBody: `
      vec3 sss = u_color * (0.55 + 0.6*diff);
      float rim = pow(1.0 - max(dot(N,V),0.0), 2.0);
      col = mix(sss, u_color2, rim*0.7);
      col += rim*0.3;
    `,
  },
  {
    id: 'lava', name: 'Lava / magma', category: 'Liquid & organic', kind: 'shader', swatch: ['#ffd24a', '#8a1c05'],
    params: [
      { key: 'intensity', label: 'Heat', type: 'range', min: 0.5, max: 2.2, step: 0.05, default: 1.2 },
      { key: 'scale', label: 'Scale', type: 'range', min: 1, max: 8, step: 0.1, default: 3 },
      { key: 'speed', label: 'Flow', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform float u_intensity; uniform float u_scale;',
    fragBody: `
      vec3 q = vObjPos*u_scale;
      float n = fbm(q + vec3(0.0, -u_time*u_speed*0.4, 0.0));
      float n2 = fbm(q*2.0 + vec3(u_time*u_speed*0.3, 0.0, 0.0));
      float h = (n*0.65 + n2*0.35)*0.5 + 0.5;
      vec3 cool = vec3(0.11,0.02,0.01);
      vec3 mid  = vec3(0.85,0.18,0.03);
      vec3 hot  = vec3(1.0,0.85,0.35);
      col = mix(cool, mid, smoothstep(0.35,0.6,h));
      col = mix(col, hot, smoothstep(0.62,0.86,h));
      col *= u_intensity;
    `,
  },

  // ---------------- STYLIZED (shaders) ----------------
  {
    id: 'toon', name: 'Toon / cel', category: 'Stylized', kind: 'shader', swatch: ['#8ec7ff', '#2f6fb0'],
    params: [
      { key: 'color', label: 'Colour', type: 'color', default: '#4aa3ff' },
      { key: 'rim', label: 'Rim', type: 'range', min: 1, max: 6, step: 0.1, default: 3 },
      { key: 'rimColor', label: 'Rim tint', type: 'color', default: '#ffffff' },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_rim; uniform vec3 u_rimColor;',
    fragBody: `
      float l = dot(N, KL);
      float t = 0.35 + smoothstep(0.0,0.02,l)*0.2 + smoothstep(0.35,0.37,l)*0.2 + smoothstep(0.75,0.77,l)*0.25;
      col = u_color * t;
      float rim = pow(1.0 - max(dot(N,V),0.0), u_rim);
      col += rim * u_rimColor * 0.6;
    `,
  },
  {
    id: 'matcap', name: 'Sculpt matcap', category: 'Stylized', kind: 'shader', swatch: ['#b7bcc4', '#5c626b'],
    params: [
      { key: 'color', label: 'Body', type: 'color', default: '#8a8f98' },
      { key: 'spec', label: 'Highlight', type: 'color', default: '#ffffff' },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_spec;',
    fragBody: `
      vec3 vn = normalize(vViewNormal);
      vec2 muv = vn.xy*0.5 + 0.5;
      float d = distance(muv, vec2(0.68, 0.72));
      float spec = smoothstep(0.45, 0.0, d);
      float amb = 0.25 + 0.7*muv.y;
      col = u_color * amb + spec * u_spec * 1.2;
      col *= (0.6 + 0.4*(1.0 - pow(fres, 3.0)));
    `,
  },
  {
    id: 'iridescent', name: 'Iridescent', category: 'Stylized', kind: 'shader', swatch: ['#7affd0', '#b06be6'],
    params: [
      { key: 'color', label: 'Base', type: 'color', default: '#20232a' },
      { key: 'bands', label: 'Bands', type: 'range', min: 0.5, max: 4, step: 0.05, default: 1.6 },
      { key: 'intensity', label: 'Sheen', type: 'range', min: 0, max: 1.5, step: 0.02, default: 1 },
      { key: 'speed', label: 'Drift', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_bands; uniform float u_intensity;',
    fragBody: `
      float fp = pow(fres, 1.4);
      float hue = fract(u_time*0.03*u_speed + fp*u_bands + N.y*0.25 + vWorldPos.y*0.1);
      vec3 rain = hsv2rgb(vec3(hue, 0.85, 1.0));
      col = mix(u_color*diff, rain, clamp(fp*u_intensity, 0.0, 1.0));
      col += pow(fp, 4.0)*0.5;
    `,
  },
  {
    id: 'normals', name: 'Normals', category: 'Stylized', kind: 'shader', swatch: ['#8a8fff', '#5affa0'],
    params: [],
    fragUniforms: '',
    fragBody: `
      col = normalize(vWorldNormal)*0.5 + 0.5;
    `,
  },

  // ---------------- SCI-FI FX (shaders) ----------------
  {
    id: 'hologram', name: 'Hologram', category: 'Sci-fi FX', kind: 'shader', swatch: ['#38f0ff', '#1360a0'],
    transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'color', label: 'Colour', type: 'color', default: '#38f0ff' },
      { key: 'density', label: 'Scanlines', type: 'range', min: 10, max: 120, step: 1, default: 45 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9 },
      { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_density; uniform float u_opacity;',
    fragBody: `
      float scan = 0.5 + 0.5*sin(vWorldPos.y*u_density - u_time*4.0*u_speed);
      float fp = pow(fres, 2.0);
      float flick = 0.85 + 0.15*sin(u_time*30.0);
      col = u_color * (0.4 + 1.2*fp) + vec3(0.08)*scan;
      alpha = clamp((0.12 + pow(fp,1.5)*0.9) * (0.55 + 0.45*scan) * flick, 0.0, 1.0) * u_opacity;
    `,
  },
  {
    id: 'shield', name: 'Energy shield', category: 'Sci-fi FX', kind: 'shader', swatch: ['#5effc8', '#1c9a70'],
    transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'color', label: 'Colour', type: 'color', default: '#5effc8' },
      { key: 'power', label: 'Edge', type: 'range', min: 0.8, max: 4, step: 0.05, default: 2 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.8 },
      { key: 'speed', label: 'Pulse', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_power; uniform float u_opacity;',
    fragBody: `
      float fp = pow(fres, u_power);
      float bands = 0.5 + 0.5*sin(vWorldPos.y*20.0 - u_time*3.0*u_speed);
      float pulse = 0.6 + 0.4*sin(u_time*2.0*u_speed);
      col = u_color * (fp*1.5 + 0.15) + u_color*bands*fp*0.4;
      alpha = clamp(fp*pulse, 0.0, 1.0) * u_opacity + 0.04;
    `,
  },
  {
    id: 'plasma', name: 'Plasma / electric', category: 'Sci-fi FX', kind: 'shader', swatch: ['#c08bff', '#2a1258'],
    params: [
      { key: 'color', label: 'Core', type: 'color', default: '#2a1258' },
      { key: 'color2', label: 'Arc', type: 'color', default: '#c08bff' },
      { key: 'scale', label: 'Scale', type: 'range', min: 1, max: 8, step: 0.1, default: 3 },
      { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_color2; uniform float u_scale;',
    fragBody: `
      vec3 q = vObjPos*u_scale;
      float n = fbm(q*2.0 + u_time*u_speed*0.6);
      float v = abs(sin(n*6.2831 + u_time*u_speed*3.0));
      float bolt = pow(1.0 - v, 8.0);
      col = mix(u_color*0.15, u_color2*2.2, bolt) + bolt*0.6;
    `,
  },
  {
    id: 'xray', name: 'X-ray', category: 'Sci-fi FX', kind: 'shader', swatch: ['#9adfff', '#155a80'],
    transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'color', label: 'Colour', type: 'color', default: '#7ad0ff' },
      { key: 'power', label: 'Falloff', type: 'range', min: 0.5, max: 3, step: 0.05, default: 1.4 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.7 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_power; uniform float u_opacity;',
    fragBody: `
      float fp = pow(fres, u_power);
      col = u_color * fp * 2.2;
      alpha = clamp(fp, 0.0, 1.0) * u_opacity;
    `,
  },
  {
    id: 'neonwire', name: 'Neon wireframe', category: 'Sci-fi FX', kind: 'shader', swatch: ['#5effd0', '#12403a'],
    transparent: true, additive: true, depthWrite: false, wireframe: true,
    params: [
      { key: 'color', label: 'Wire', type: 'color', default: '#5effd0' },
    ],
    fragUniforms: 'uniform vec3 u_color;',
    fragBody: `
      col = u_color * (1.2 + fres);
    `,
  },
  {
    id: 'dissolve', name: 'Dissolve burn', category: 'Sci-fi FX', kind: 'shader', swatch: ['#ff6a2a', '#cfcfcf'],
    params: [
      { key: 'color', label: 'Surface', type: 'color', default: '#c9c9c9' },
      { key: 'glow', label: 'Ember', type: 'color', default: '#ff6a2a' },
      { key: 'scale', label: 'Grain', type: 'range', min: 1, max: 12, step: 0.1, default: 4 },
      { key: 'edge', label: 'Reveal', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
      { key: 'width', label: 'Ember width', type: 'range', min: 0.01, max: 0.3, step: 0.005, default: 0.08 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_glow; uniform float u_scale; uniform float u_edge; uniform float u_width;',
    fragBody: `
      float n = fbm(vObjPos*u_scale)*0.5 + 0.5;
      if (n < u_edge) discard;
      float e = smoothstep(u_edge, u_edge + u_width, n);
      col = mix(u_glow*2.6, u_color*diff, e);
    `,
  },
];

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

// Full library: core looks + the (normalized) wild shelf.
export const SHADER_PRESETS = [...CORE_PRESETS, ...normalizeWild(WILD_PRESETS)];

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
  return SHADER_PRESETS.map(p => ({
    id: p.id, name: p.name, category: p.category, swatch: p.swatch,
    params: (p.params || []).map(x => ({
      key: x.key, label: x.label, type: x.type,
      min: x.min, max: x.max, step: x.step != null ? x.step : 0.01, default: x.default,
    })),
  }));
}
