// ============================================================
// shader-lib-wild.js — the WILD shelf of the Showcase shader lab.
// 37 extra presets merged into SHADER_PRESETS by shader-lib.js.
//
// What's special here: the GRAVITY-AWARE presets (gravity: true).
// For those, showcase-engine.js updates per frame:
//   u_gravity   world "down" transformed into the mesh's object space
//   u_levMin/Max  the mesh bbox projected onto the current up axis
//   u_slosh     a damped-spring tilt vector (rotation + camera-orbit impulses)
//   u_sloshMag  0..1 agitation amount
//   u_fill      fill fraction (also a live slider param)
// So a bottle's liquid stays level in the WORLD no matter how the model is
// rotated, and sloshes + settles when you swing the view. The same uniforms
// give other presets a stable "up" axis, height coordinate and object size.
//
// GLSL scope available in fragBody (see shader-lib.js): N, V, KL, diff, fres,
// col, alpha, varyings, snoise/fbm/hsv2rgb, and the uniforms above.
// Never redeclare u_time/u_speed/u_displace/u_fill/u_gravity/u_slosh/
// u_sloshMag/u_levMin/u_levMax/u_sag — they're in the shared prelude.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';

// Shared axis frame: up vector, height h + normalized height hn, radial coords.
const AXIS = `
  vec3 upA = normalize(-u_gravity);
  float E = max(u_levMax - u_levMin, 0.0001);
  float h = dot(vObjPos, upA);
  float hn = clamp((h - u_levMin) / E, 0.0, 1.0);
  vec3 pPerp = vObjPos - upA * h;
  vec3 bA = normalize(cross(upA, vec3(0.93, 0.31, 0.19)));
  vec3 bB = cross(upA, bA);
  float ang = atan(dot(pPerp, bB), dot(pPerp, bA));
  float rad = length(pPerp) / E;
`;

// Liquid surface: world-level fill plane + slosh tilt + agitation ripple.
const LIQ = AXIS + `
  float lev = mix(u_levMin, u_levMax, clamp(u_fill, 0.0, 1.0));
  float tiltW = dot(pPerp, u_slosh) * 1.35;
  float ripple = snoise(pPerp * (13.0 / E) + u_time * u_speed * vec3(1.3, 0.0, 1.1)) * E * (0.006 + 0.055 * u_sloshMag);
  float surfH = lev + tiltW + ripple;
  float dSurf = h - surfH;
  float depth = clamp(-dSurf / E, 0.0, 1.0);
  float menis = 1.0 - smoothstep(0.0, E * 0.045, abs(dSurf));
`;

// Empty glass above the fill line (uses u_color as tint).
const GLASS_ABOVE = `
  float fg = pow(fres, 2.0);
  col = u_color * 0.06 + vec3(0.9, 0.95, 1.0) * fg * 0.55;
  alpha = 0.10 + fg * 0.5;
`;

export const WILD_PRESETS = [

  // ================= POTIONS & LIQUIDS (gravity!) =================
  {
    id: 'potion', name: 'Potion (gravity)', category: 'Potions & liquids', kind: 'shader', swatch: ['#c46bff', '#3a0e6e'],
    transparent: true, depthWrite: false, gravity: true,
    params: [
      { key: 'color', label: 'Liquid', type: 'color', default: '#a53aff' },
      { key: 'glow', label: 'Glow', type: 'color', default: '#ff8ae0' },
      { key: 'fill', label: 'Fill', type: 'range', min: 0.02, max: 0.98, step: 0.01, default: 0.62 },
      { key: 'bubbles', label: 'Bubbles', type: 'range', min: 2, max: 20, step: 0.5, default: 9 },
      { key: 'speed', label: 'Fizz', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_glow; uniform float u_bubbles;',
    fragBody: LIQ + `
      if (dSurf > 0.0) {` + GLASS_ABOVE + `} else {
        vec3 body = mix(u_color * 1.15, u_color * 0.22, pow(depth, 0.8));
        float bub = snoise(vObjPos * u_bubbles - upA * (u_time * u_speed * 1.6) + pPerp * 2.0);
        float dots = smoothstep(0.62, 0.8, bub) * (1.0 - depth * 0.55);
        col = body * (0.7 + 0.45 * diff);
        col += u_glow * dots * 1.5;
        col += u_glow * menis * 2.2;
        col += u_glow * pow(fres, 3.0) * 0.55;
        alpha = 0.93;
      }
    `,
  },
  {
    id: 'poison', name: 'Poison vial', category: 'Potions & liquids', kind: 'shader', swatch: ['#7dff3a', '#123c05'],
    transparent: true, depthWrite: false, gravity: true,
    params: [
      { key: 'color', label: 'Venom', type: 'color', default: '#4fdc1e' },
      { key: 'glow', label: 'Fume', type: 'color', default: '#c8ff5a' },
      { key: 'fill', label: 'Fill', type: 'range', min: 0.02, max: 0.98, step: 0.01, default: 0.55 },
      { key: 'speed', label: 'Boil', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_glow;',
    fragBody: LIQ + `
      if (dSurf > 0.0) {` + GLASS_ABOVE + `} else {
        float murk = fbm(vObjPos * 3.0 - upA * (u_time * u_speed * 0.4));
        vec3 body = mix(u_color * 0.14, u_color, clamp(0.35 + murk * 0.5, 0.0, 1.0));
        float bub = snoise(vObjPos * 7.0 - upA * (u_time * u_speed * 1.1));
        float dots = smoothstep(0.55, 0.72, bub);
        col = body * (0.6 + 0.5 * diff);
        col += u_glow * dots * 1.1;
        col += u_glow * menis * 1.8;
        col += u_glow * pow(fres, 2.5) * 0.6;
        alpha = 0.94;
      }
    `,
  },
  {
    id: 'lovepotion', name: 'Love potion', category: 'Potions & liquids', kind: 'shader', swatch: ['#ff9ad2', '#b0125f'],
    transparent: true, depthWrite: false, gravity: true,
    params: [
      { key: 'color', label: 'Blush', type: 'color', default: '#ff5aa8' },
      { key: 'color2', label: 'Swirl', type: 'color', default: '#ffc4e8' },
      { key: 'fill', label: 'Fill', type: 'range', min: 0.02, max: 0.98, step: 0.01, default: 0.7 },
      { key: 'speed', label: 'Swirl', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_color2;',
    fragBody: LIQ + `
      if (dSurf > 0.0) {` + GLASS_ABOVE + `} else {
        float swirl = fbm(vObjPos * 2.5 + vec3(u_time * u_speed * 0.22));
        vec3 body = mix(u_color, u_color2, 0.5 + 0.5 * swirl) * (0.85 - depth * 0.45);
        float gl = pow(max(snoise(vObjPos * 26.0 + upA * (u_time * u_speed)), 0.0), 10.0);
        col = body * (0.7 + 0.4 * diff);
        col += vec3(1.0, 0.92, 0.97) * gl * 2.2;
        col += u_color2 * menis * 2.0;
        col += u_color2 * pow(fres, 3.0) * 0.5;
        alpha = 0.92;
      }
    `,
  },
  {
    id: 'galaxyjar', name: 'Bottled galaxy', category: 'Potions & liquids', kind: 'shader', swatch: ['#7a8dff', '#12083a'],
    transparent: true, depthWrite: false, gravity: true,
    params: [
      { key: 'color', label: 'Glass', type: 'color', default: '#8a9aff' },
      { key: 'fill', label: 'Fill', type: 'range', min: 0.02, max: 0.98, step: 0.01, default: 0.8 },
      { key: 'scale', label: 'Nebula', type: 'range', min: 1, max: 8, step: 0.1, default: 3 },
      { key: 'speed', label: 'Drift', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_scale;',
    fragBody: LIQ + `
      if (dSurf > 0.0) {` + GLASS_ABOVE + `} else {
        float neb = fbm(vObjPos * u_scale + vec3(0.0, u_time * u_speed * 0.06, 0.0));
        vec3 nebc = hsv2rgb(vec3(fract(0.68 + neb * 0.22), 0.75, clamp(0.22 + neb * 0.6, 0.0, 1.0)));
        float star = pow(max(snoise(vObjPos * 40.0), 0.0), 14.0);
        col = nebc + vec3(star) * 2.2;
        col += nebc * menis * 2.5;
        col += vec3(0.6, 0.7, 1.0) * pow(fres, 3.0) * 0.4;
        alpha = 0.96;
      }
    `,
  },
  {
    id: 'lavalamp', name: 'Lava lamp', category: 'Potions & liquids', kind: 'shader', swatch: ['#ff7a3a', '#4a0a5e'],
    transparent: true, depthWrite: false, gravity: true,
    params: [
      { key: 'color', label: 'Fluid', type: 'color', default: '#5a1470' },
      { key: 'color2', label: 'Blob', type: 'color', default: '#ff6a2a' },
      { key: 'fill', label: 'Fill', type: 'range', min: 0.02, max: 0.98, step: 0.01, default: 0.9 },
      { key: 'speed', label: 'Rise', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_color2;',
    fragBody: LIQ + `
      if (dSurf > 0.0) {` + GLASS_ABOVE + `} else {
        vec3 q = pPerp * (2.6 / E) + upA * (h * 1.6 / E - u_time * u_speed * 0.5);
        float blob = snoise(q + vec3(7.7)) * 0.6 + snoise(q * 2.1 - vec3(3.1)) * 0.4;
        float bm = smoothstep(0.16, 0.42, blob);
        vec3 body = mix(u_color * 0.6, u_color2 * 1.5, bm);
        col = body * (0.55 + 0.5 * diff);
        col += u_color2 * pow(depth, 1.7) * 0.8;
        col += u_color2 * menis * 1.4;
        col += u_color2 * pow(fres, 3.0) * 0.4;
        alpha = 0.95;
      }
    `,
  },
  {
    id: 'melting', name: 'Melting / drip', category: 'Potions & liquids', kind: 'shader', swatch: ['#ffd9a0', '#a85a1e'],
    gravity: true,
    params: [
      { key: 'color', label: 'Wax', type: 'color', default: '#f2b56a' },
      { key: 'sag', label: 'Melt', type: 'range', min: 0, max: 0.45, step: 0.005, default: 0.2 },
      { key: 'speed', label: 'Ooze', type: 'range', min: 0, max: 3, step: 0.05, default: 0.6 },
    ],
    fragUniforms: 'uniform vec3 u_color;',
    fragBody: AXIS + `
      float streak = fbm(pPerp * (6.0 / E) + upA * (h * 3.0 / E));
      vec3 base = u_color * (0.35 + 0.65 * diff);
      col = mix(base, u_color * 1.25, smoothstep(0.2, 0.8, streak) * 0.35);
      col += vec3(1.0) * pow(max(dot(reflect(-V, N), KL), 0.0), 24.0) * 0.7;
      col += u_color * pow(fres, 3.0) * 0.4;
    `,
  },
  {
    id: 'acidbath', name: 'Acid bath', category: 'Potions & liquids', kind: 'shader', swatch: ['#ccff00', '#1a2200'],
    transparent: true, depthWrite: false, gravity: true,
    params: [
      { key: 'color', label: 'Acid', type: 'color', default: '#a5ff00' },
      { key: 'fill', label: 'Fill', type: 'range', min: 0.02, max: 0.98, step: 0.01, default: 0.6 },
      { key: 'speed', label: 'Boil', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 },
    ],
    fragUniforms: 'uniform vec3 u_color;',
    fragBody: LIQ + `
      if (dSurf > 0.0) {` + GLASS_ABOVE + `} else {
        float t = u_time * u_speed;
        float boil = fbm(vObjPos * 10.0 + upA * (t * 3.0));
        vec3 body = mix(vec3(0.2, 0.4, 0.0), u_color, boil);
        col = body * (0.5 + diff * 0.8);
        col += vec3(1.0, 1.0, 0.5) * pow(boil, 6.0) * 5.0; // Blinding boiling glints
        col += u_color * menis * 4.0;
        col += u_color * pow(fres, 2.0) * 1.5;
        alpha = 0.92;
      }
    `,
  },
  {
    id: 'cthulhublood', name: 'Cthulhu blood', category: 'Potions & liquids', kind: 'shader', swatch: ['#6a00b0', '#1a0022'],
    transparent: true, depthWrite: false, gravity: true,
    params: [
      { key: 'color', label: 'Ichor', type: 'color', default: '#8000ff' },
      { key: 'fill', label: 'Fill', type: 'range', min: 0.02, max: 0.98, step: 0.01, default: 0.7 },
      { key: 'speed', label: 'Throb', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color;',
    fragBody: LIQ + `
      if (dSurf > 0.0) {` + GLASS_ABOVE + `} else {
        float t = u_time * u_speed;
        float ripple = fbm(vObjPos * 15.0 + upA * (t * 1.5));
        vec3 body = mix(vec3(0.1, 0.0, 0.1), u_color, clamp(0.5 + ripple, 0.0, 1.0));
        col = body * (0.4 + diff * 0.6);
        col += vec3(1.0, 0.2, 0.8) * pow(fres, 3.0) * 1.2;
        col += u_color * menis * 3.0;
        alpha = 1.0;
      }
    `,
  },

  // ================= RADIANT & COSMIC =================
  {
    id: 'aura', name: 'Radiant pulse', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#5affd8', '#0a4a5e'],
    transparent: true, additive: true, depthWrite: false, gravity: true,
    params: [
      { key: 'color', label: 'Aura', type: 'color', default: '#4affd0' },
      { key: 'rings', label: 'Rings', type: 'range', min: 1, max: 12, step: 0.5, default: 5 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9 },
      { key: 'speed', label: 'Pulse', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_rings; uniform float u_opacity;',
    fragBody: AXIS + `
      float r = length(vObjPos) / E;
      float ring = pow(0.5 + 0.5 * sin((r * u_rings - u_time * u_speed * 1.4) * 6.2831), 8.0);
      col = u_color * (ring * 2.2 + pow(fres, 1.8) * 0.8);
      alpha = clamp(ring * 0.9 + pow(fres, 1.8) * 0.5, 0.0, 1.0) * u_opacity;
    `,
  },
  {
    id: 'heartbeat', name: 'Heartbeat', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#ff4a5e', '#3a0510'],
    params: [
      { key: 'base', label: 'Flesh', type: 'color', default: '#40141c' },
      { key: 'color', label: 'Pulse', type: 'color', default: '#ff3a52' },
      { key: 'scale', label: 'Veins', type: 'range', min: 1, max: 10, step: 0.1, default: 4 },
      { key: 'speed', label: 'BPM', type: 'range', min: 0.2, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_base; uniform vec3 u_color; uniform float u_scale;',
    fragBody: `
      float tb = fract(u_time * u_speed * 0.85);
      float beat = exp(-pow((tb - 0.10) * 14.0, 2.0)) + 0.55 * exp(-pow((tb - 0.32) * 14.0, 2.0));
      float vein = pow(1.0 - abs(snoise(vObjPos * u_scale)), 7.0);
      col = u_base * (0.25 + 0.4 * diff);
      col += u_color * vein * (0.4 + beat * 2.2);
      col += u_color * pow(fres, 2.2) * (0.3 + beat * 1.4);
    `,
  },
  {
    id: 'sonar', name: 'Sonar ping', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#3aff8a', '#03251a'],
    transparent: true, additive: true, depthWrite: false, gravity: true,
    params: [
      { key: 'color', label: 'Ping', type: 'color', default: '#3aff8a' },
      { key: 'speed', label: 'Sweep', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color;',
    fragBody: AXIS + `
      float ping = fract(length(vObjPos) / E * 0.85 - u_time * u_speed * 0.45);
      float ring = pow(1.0 - ping, 9.0);
      float grid = pow(0.5 + 0.5 * sin(hn * 60.0), 12.0) * 0.15 + pow(0.5 + 0.5 * sin(ang * 24.0), 12.0) * 0.12;
      col = u_color * (0.04 + ring * 1.8) + u_color * grid + u_color * pow(fres, 2.0) * 0.35;
      alpha = clamp(0.22 + ring * 0.78, 0.0, 1.0);
    `,
  },
  {
    id: 'radioactive', name: 'Radioactive', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#b6ff2a', '#1a2a05'],
    params: [
      { key: 'base', label: 'Sludge', type: 'color', default: '#1e2a10' },
      { key: 'color', label: 'Isotope', type: 'color', default: '#a8ff1e' },
      { key: 'scale', label: 'Cracks', type: 'range', min: 1, max: 12, step: 0.1, default: 5 },
      { key: 'speed', label: 'Decay', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_base; uniform vec3 u_color; uniform float u_scale;',
    fragBody: `
      float crack = pow(1.0 - abs(snoise(vObjPos * u_scale)), 9.0);
      float flick = 0.75 + 0.25 * sin(u_time * 13.0 * u_speed + snoise(vObjPos * 2.0 + u_time * 0.5) * 4.0);
      col = u_base * (0.3 + 0.5 * diff);
      col += u_color * crack * flick * 2.4;
      col += u_color * pow(fres, 2.5) * flick * 0.9;
    `,
  },
  {
    id: 'portal', name: 'Portal vortex', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#8a3aff', '#ff8a3a'],
    gravity: true,
    params: [
      { key: 'color', label: 'Void', type: 'color', default: '#180830' },
      { key: 'hue', label: 'Hue', type: 'range', min: 0, max: 1, step: 0.01, default: 0.75 },
      { key: 'arms', label: 'Arms', type: 'range', min: 1, max: 8, step: 1, default: 3 },
      { key: 'speed', label: 'Spin', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_hue; uniform float u_arms;',
    fragBody: AXIS + `
      float sw = sin(ang * u_arms + rad * 16.0 - u_time * u_speed * 3.2 + fbm(vObjPos * 2.0) * 3.0);
      float sp = pow(0.5 + 0.5 * sw, 3.0);
      vec3 rain = hsv2rgb(vec3(fract(u_hue + rad * 0.35 - u_time * u_speed * 0.05), 0.85, 1.0));
      col = mix(u_color, rain * 2.0, sp);
      col += rain * pow(fres, 2.0) * 0.8;
    `,
  },
  {
    id: 'soulfire', name: 'Soul fire', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#5ad2ff', '#0a1a4a'],
    transparent: true, additive: true, depthWrite: false, gravity: true,
    params: [
      { key: 'color', label: 'Flame', type: 'color', default: '#3ab8ff' },
      { key: 'scale', label: 'Licks', type: 'range', min: 1, max: 10, step: 0.1, default: 4 },
      { key: 'speed', label: 'Burn', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_scale;',
    fragBody: AXIS + `
      float n = fbm(vObjPos * u_scale - upA * (u_time * u_speed * 1.8));
      float flame = pow(clamp(n * 0.5 + 0.5, 0.0, 1.0), 2.2) * (0.35 + 0.85 * hn);
      vec3 fc = mix(u_color * 0.4, mix(u_color, vec3(1.0), 0.75), flame);
      col = fc * (flame * 2.4 + pow(fres, 1.6) * 1.2);
      alpha = clamp(flame * 1.3 + pow(fres, 1.8) * 0.7, 0.0, 1.0);
    `,
  },
  {
    id: 'star', name: 'Living star', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#ffdf6a', '#c83205'],
    displaceParam: true,
    params: [
      { key: 'heat', label: 'Heat', type: 'range', min: 0.5, max: 2.5, step: 0.05, default: 1.2 },
      { key: 'scale', label: 'Granules', type: 'range', min: 1, max: 8, step: 0.1, default: 3 },
      { key: 'displace', label: 'Boil', type: 'range', min: 0, max: 0.2, step: 0.005, default: 0.04 },
      { key: 'speed', label: 'Churn', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform float u_heat; uniform float u_scale;',
    fragBody: `
      float g1 = fbm(vObjPos * u_scale + vec3(u_time * u_speed * 0.10));
      float g2 = fbm(vObjPos * u_scale * 2.7 - vec3(u_time * u_speed * 0.07));
      float gr = clamp(0.5 + 0.5 * (g1 * 0.65 + g2 * 0.35), 0.0, 1.0);
      col = mix(vec3(0.45, 0.05, 0.0), vec3(0.98, 0.45, 0.05), smoothstep(0.15, 0.55, gr));
      col = mix(col, vec3(1.0, 0.96, 0.82) * u_heat, smoothstep(0.55, 0.9, gr));
      col += vec3(1.0, 0.55, 0.1) * pow(fres, 2.0) * 1.6;
    `,
  },
  {
    id: 'blackhole', name: 'Black hole', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#ff8a3a', '#000008'],
    gravity: true,
    params: [
      { key: 'core', label: 'Horizon', type: 'range', min: 0, max: 0.8, step: 0.01, default: 0.35 },
      { key: 'heat', label: 'Accretion', type: 'range', min: 0.3, max: 2.5, step: 0.05, default: 1.2 },
      { key: 'speed', label: 'Spin', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform float u_core; uniform float u_heat;',
    fragBody: AXIS + `
      float disc = smoothstep(u_core, u_core + 0.18, fres);
      float swirl = sin(ang * 3.0 - pow(fres, 2.0) * 14.0 - u_time * u_speed * 2.6 + fbm(vObjPos * 3.0) * 2.0);
      vec3 hot = mix(vec3(1.0, 0.55, 0.1), vec3(0.4, 0.6, 1.0), 0.5 + 0.5 * swirl);
      col = hot * pow(fres, 3.5) * (1.6 + swirl * 0.4) * u_heat * disc;
    `,
  },
  {
    id: 'aurora', name: 'Aurora veil', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#5aff9a', '#3a2a8a'],
    transparent: true, additive: true, depthWrite: false, gravity: true,
    params: [
      { key: 'speed', label: 'Flow', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: '',
    fragBody: AXIS + `
      float wob = fbm(vObjPos * 1.6 + vec3(0.0, u_time * u_speed * 0.25, 0.0));
      float band = sin(ang * 2.0 + wob * 5.0 + hn * 4.0);
      float s = pow(0.5 + 0.5 * band, 2.0);
      vec3 cc = hsv2rgb(vec3(fract(0.36 + 0.22 * band + wob * 0.1), 0.8, 1.0));
      col = cc * s * (0.6 + 1.6 * pow(fres, 1.4));
      alpha = clamp(s * 0.75 + pow(fres, 2.0) * 0.4, 0.0, 1.0);
    `,
  },
  {
    id: 'magnetar', name: 'Magnetar core', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#0055ff', '#000022'],
    transparent: true, additive: true, depthWrite: false, displaceParam: true,
    params: [
      { key: 'speed', label: 'Pulse', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 },
      { key: 'displace', label: 'Distort', type: 'range', min: 0, max: 0.2, step: 0.005, default: 0.08 },
    ],
    fragBody: `
      float t = u_time * u_speed;
      float field = sin(vObjPos.x * 6.0 + t) + cos(vObjPos.y * 6.0 - t) + sin(vObjPos.z * 6.0 + t * 0.5);
      field = abs(field);
      float core = smoothstep(1.2, 2.5, field);
      vec3 c1 = vec3(0.0, 0.1, 0.5);
      vec3 c2 = vec3(0.5, 0.8, 1.0);
      col = mix(c1, c2, pow(field, 3.0)) * diff;
      col += vec3(1.0) * core * 4.0; // Blinding magnetic arcs
      col += vec3(0.2, 0.6, 1.0) * pow(fres, 2.0) * 2.5;
      alpha = clamp(0.4 + core, 0.0, 1.0);
    `,
  },

  // ================= CANDY & CRYSTAL =================
  {
    id: 'candy', name: 'Candy shell', category: 'Candy & crystal', kind: 'physical', swatch: ['#ff5abb', '#8a1250'],
    params: [
      { key: 'color', label: 'Candy', type: 'color', default: '#ff2f9e', apply: (m, v) => m.color.set(v) },
      { key: 'roughness', label: 'Gloss', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.12, apply: (m, v) => { m.roughness = v; } },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ color: 0xff2f9e, metalness: 0, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2, side: THREE.DoubleSide }),
  },
  {
    id: 'soapbubble', name: 'Soap bubble', category: 'Candy & crystal', kind: 'physical', swatch: ['#d0f0ff', '#c39ae0'],
    params: [
      { key: 'iridescence', label: 'Film', type: 'range', min: 0, max: 1, step: 0.01, default: 1, apply: (m, v) => { m.iridescence = v; } },
      { key: 'ior', label: 'Thin-ness', type: 'range', min: 1, max: 1.6, step: 0.01, default: 1.1, apply: (m, v) => { m.ior = v; } },
    ],
    make: () => new THREE.MeshPhysicalMaterial({ transmission: 1, thickness: 0.05, roughness: 0.02, metalness: 0, ior: 1.1, iridescence: 1, iridescenceIOR: 1.3, transparent: true, side: THREE.DoubleSide, envMapIntensity: 1.3 }),
  },
  {
    id: 'lollipop', name: 'Lollipop swirl', category: 'Candy & crystal', kind: 'shader', swatch: ['#ff4a4a', '#fff3e0'],
    gravity: true,
    params: [
      { key: 'color', label: 'Stripe A', type: 'color', default: '#ff3a3a' },
      { key: 'color2', label: 'Stripe B', type: 'color', default: '#fff2e2' },
      { key: 'arms', label: 'Stripes', type: 'range', min: 2, max: 12, step: 1, default: 4 },
      { key: 'twist', label: 'Twist', type: 'range', min: 0, max: 4, step: 0.1, default: 1.4 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_color2; uniform float u_arms; uniform float u_twist;',
    fragBody: AXIS + `
      float band = sin(ang * u_arms + hn * u_twist * 6.2831);
      vec3 base = mix(u_color, u_color2, smoothstep(-0.2, 0.2, band));
      col = base * (0.35 + 0.75 * diff);
      col += vec3(1.0) * pow(max(dot(reflect(-V, N), KL), 0.0), 60.0) * 1.2;
      col += base * pow(fres, 3.0) * 0.5;
    `,
  },
  {
    id: 'disco', name: 'Disco ball', category: 'Candy & crystal', kind: 'shader', swatch: ['#f0f4ff', '#5a5e8a'],
    params: [
      { key: 'facets', label: 'Facets', type: 'range', min: 4, max: 24, step: 1, default: 10 },
      { key: 'speed', label: 'Party', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform float u_facets;',
    fragBody: `
      vec3 qn = normalize((floor(N * u_facets) + 0.5) / u_facets);
      float gap = smoothstep(0.25, 0.55, length(N - qn) * u_facets * 0.5);
      vec3 r = reflect(-V, qn);
      float up = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 sky = mix(vec3(0.06, 0.07, 0.1), vec3(1.0), pow(up, 3.0));
      float spark = pow(max(dot(r, KL), 0.0), 90.0) * 4.0;
      float hueSpark = pow(max(dot(r, normalize(vec3(-0.4, 0.7, 0.3))), 0.0), 80.0);
      col = sky * 0.8 + vec3(spark) + hsv2rgb(vec3(fract(u_time * 0.15 * u_speed), 0.7, 1.0)) * hueSpark * 2.0;
      col *= 1.0 - gap * 0.6;
    `,
  },
  {
    id: 'ice', name: 'Glacier ice', category: 'Candy & crystal', kind: 'shader', swatch: ['#d8f4ff', '#1a5e8a'],
    params: [
      { key: 'scale', label: 'Cracks', type: 'range', min: 1, max: 12, step: 0.1, default: 5 },
    ],
    fragUniforms: 'uniform float u_scale;',
    fragBody: `
      float crack = pow(1.0 - abs(snoise(vObjPos * u_scale)), 11.0);
      float glint = pow(max(snoise(vObjPos * 30.0), 0.0), 9.0);
      col = mix(vec3(0.10, 0.28, 0.42), vec3(0.85, 0.95, 1.0), clamp(0.35 + 0.35 * diff + pow(fres, 2.0) * 0.6, 0.0, 1.0));
      col += vec3(1.0) * crack * 0.5 + vec3(1.0) * glint * 1.4;
    `,
  },
  {
    id: 'gemstone', name: 'Faceted gem', category: 'Candy & crystal', kind: 'shader', swatch: ['#4affd2', '#0a4a6e'],
    params: [
      { key: 'color', label: 'Stone', type: 'color', default: '#18c8a8' },
      { key: 'fire', label: 'Fire', type: 'range', min: 0, max: 1.5, step: 0.02, default: 0.8 },
      { key: 'speed', label: 'Shimmer', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_fire;',
    fragBody: `
      vec3 fN = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));
      if (dot(fN, V) < 0.0) fN = -fN;
      float fd = max(dot(fN, KL), 0.0);
      float fr = pow(1.0 - max(dot(fN, V), 0.0), 2.0);
      vec3 disp = hsv2rgb(vec3(fract(snoise(fN * 2.7) * 0.5 + u_time * u_speed * 0.02), 0.7, 1.0));
      float spec = pow(max(dot(reflect(-V, fN), KL), 0.0), 50.0);
      col = u_color * (0.25 + 0.75 * fd) + disp * fr * u_fire + vec3(spec) * 1.6;
    `,
  },
  {
    id: 'tesseract', name: 'Quantum tesseract', category: 'Candy & crystal', kind: 'shader', swatch: ['#00ffff', '#000033'],
    transparent: true, depthWrite: false, additive: true,
    params: [
      { key: 'speed', label: 'Shift', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragBody: `
      float t = u_time * u_speed;
      vec3 fN = normalize(floor(N * 4.0) / 4.0);
      float fd = max(dot(fN, KL), 0.0);
      float fr = pow(1.0 - max(dot(fN, V), 0.0), 3.0);
      float grid = smoothstep(0.9, 1.0, sin(vObjPos.x * 15.0 + t) * sin(vObjPos.y * 15.0 + t) * sin(vObjPos.z * 15.0 + t));
      vec3 base = hsv2rgb(vec3(fract(t * 0.05), 0.8, 0.1 + fd * 0.2));
      col = base + vec3(fr) * 0.8;
      col += vec3(1.0, 0.5, 1.0) * grid * 3.0; // Pulsing hyper-dimensional intersections
      alpha = clamp(0.2 + fr + grid, 0.0, 1.0);
    `,
  },

  // ================= SPOOKY & GLITCH =================
  {
    id: 'ghost', name: 'Ghost', category: 'Spooky & glitch', kind: 'shader', swatch: ['#aef4e8', '#1a3a4a'],
    transparent: true, additive: true, depthWrite: false, gravity: true, displaceParam: true,
    params: [
      { key: 'color', label: 'Ecto', type: 'color', default: '#8ae8d8' },
      { key: 'opacity', label: 'Presence', type: 'range', min: 0, max: 1, step: 0.01, default: 0.8 },
      { key: 'displace', label: 'Waver', type: 'range', min: 0, max: 0.2, step: 0.005, default: 0.05 },
      { key: 'speed', label: 'Drift', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_opacity;',
    fragBody: AXIS + `
      float wisp = fbm(vObjPos * 2.2 + upA * (u_time * u_speed * 0.6));
      float fp = pow(fres, 1.6);
      col = u_color * (fp * 1.8 + (wisp * 0.5 + 0.5) * 0.35 * fp);
      alpha = clamp(fp * (0.65 + 0.35 * wisp), 0.0, 1.0) * u_opacity;
    `,
  },
  {
    id: 'glitch', name: 'Glitch / corrupt', category: 'Spooky & glitch', kind: 'shader', swatch: ['#ff2a6a', '#0a2a3a'],
    gravity: true,
    params: [
      { key: 'color', label: 'Base', type: 'color', default: '#1a7a8a' },
      { key: 'rows', label: 'Rows', type: 'range', min: 8, max: 80, step: 1, default: 32 },
      { key: 'speed', label: 'Corrupt', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_rows;\nfloat hashf(float x){ return fract(sin(x * 127.1) * 43758.5453); }',
    fragBody: AXIS + `
      float tq = floor(u_time * u_speed * 9.0);
      float row = floor(hn * u_rows);
      float rr = hashf(row * 1.37 + tq);
      vec3 base = u_color * (0.35 + 0.6 * diff);
      float rim = pow(fres, 2.0);
      base += vec3(rim * 0.8, 0.0, 0.0) * hashf(tq + 3.0) + vec3(0.0, 0.0, rim * 0.8) * hashf(tq + 7.0);
      if (rr > 0.86) base = vec3(1.0) - base;
      if (hashf(row + tq + 11.0) > 0.93) base *= 0.15;
      col = base * (0.85 + 0.15 * sin(hn * 500.0 + u_time * 20.0));
    `,
  },
  {
    id: 'coderain', name: 'Code rain', category: 'Spooky & glitch', kind: 'shader', swatch: ['#3aff6a', '#020a04'],
    gravity: true,
    params: [
      { key: 'color', label: 'Glyphs', type: 'color', default: '#2aff5e' },
      { key: 'cols', label: 'Columns', type: 'range', min: 8, max: 80, step: 1, default: 36 },
      { key: 'speed', label: 'Rain', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_cols;\nfloat hashf(float x){ return fract(sin(x * 127.1) * 43758.5453); }',
    fragBody: AXIS + `
      float colId = floor((ang / 6.2831 + 0.5) * u_cols);
      float sp = 0.35 + hashf(colId) * 1.1;
      float v = fract(hn * (0.8 + hashf(colId + 5.0) * 0.6) + u_time * u_speed * sp * 0.35);
      float trail = pow(v, 5.0);
      float cell = floor(hn * 30.0);
      float glyph = 0.35 + 0.65 * step(0.3, hashf(colId * 7.3 + cell * 1.7 + floor(u_time * u_speed * 6.0) * step(0.93, hashf(cell + colId))));
      col = vec3(0.01, 0.03, 0.015);
      col += u_color * trail * glyph * 1.8 + vec3(0.85, 1.0, 0.9) * smoothstep(0.97, 1.0, v) * glyph;
      col += u_color * pow(fres, 2.5) * 0.25;
    `,
  },
  {
    id: 'topo', name: 'Topographic', category: 'Spooky & glitch', kind: 'shader', swatch: ['#e8dcc4', '#5a4a2a'],
    params: [
      { key: 'base', label: 'Paper', type: 'color', default: '#efe6d2' },
      { key: 'color', label: 'Ink', type: 'color', default: '#4a3a20' },
      { key: 'scale', label: 'Terrain', type: 'range', min: 0.5, max: 8, step: 0.1, default: 2.5 },
      { key: 'bands', label: 'Contours', type: 'range', min: 3, max: 30, step: 1, default: 12 },
      { key: 'speed', label: 'Shift', type: 'range', min: 0, max: 3, step: 0.05, default: 0.5 },
    ],
    fragUniforms: 'uniform vec3 u_base; uniform vec3 u_color; uniform float u_scale; uniform float u_bands;',
    fragBody: `
      float f = fbm(vObjPos * u_scale + vec3(0.0, u_time * u_speed * 0.06, 0.0));
      float c = fract(f * u_bands);
      float line = smoothstep(0.10, 0.02, min(c, 1.0 - c));
      col = mix(u_base * (0.55 + 0.45 * diff), u_color, line);
      col += u_color * pow(fres, 3.0) * 0.15;
    `,
  },
  {
    id: 'magmacore', name: 'Magma core', category: 'Spooky & glitch', kind: 'shader', swatch: ['#ff6a1e', '#141012'],
    params: [
      { key: 'scale', label: 'Cracks', type: 'range', min: 1, max: 12, step: 0.1, default: 4 },
      { key: 'speed', label: 'Pulse', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform float u_scale;',
    fragBody: `
      float crack = pow(1.0 - abs(snoise(vObjPos * u_scale)), 12.0);
      float pulse = 0.55 + 0.45 * sin(u_time * u_speed * 2.2 + snoise(vObjPos) * 3.0);
      col = vec3(0.06, 0.05, 0.055) * (0.6 + 0.8 * diff);
      col += mix(vec3(1.0, 0.25, 0.02), vec3(1.0, 0.8, 0.3), crack) * crack * pulse * 2.6;
    `,
  },
  {
    id: 'voidrift', name: 'Void rift', category: 'Spooky & glitch', kind: 'shader', swatch: ['#ff00ff', '#000000'],
    params: [
      { key: 'speed', label: 'Tear', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragBody: AXIS + `
      float t = u_time * u_speed;
      float rift = abs(sin(ang * 2.0 + hn * 5.0 + t * 2.0));
      float edge = smoothstep(0.0, 0.05, rift);
      vec3 worldCol = normalize(vWorldPos) * 0.5 + 0.5;
      vec3 voidCol = vec3(0.0);
      col = mix(worldCol * diff, voidCol, edge);
      col += vec3(1.0, 0.0, 1.0) * smoothstep(0.05, 0.0, rift) * 6.0; // Blinding neon rift edges
      col += vec3(0.0, 1.0, 1.0) * smoothstep(0.02, 0.0, rift) * 4.0;
    `,
  },
  {
    id: 'missingtex', name: 'Error 404', category: 'Spooky & glitch', kind: 'shader', swatch: ['#ff00ff', '#000000'],
    params: [
      { key: 'speed', label: 'Glitch', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 },
    ],
    fragBody: AXIS + `
      float t = u_time * u_speed;
      vec3 p = vObjPos * 5.0;
      p += vec3(fbm(p + t), fbm(p - t), fbm(p + t * 0.5)) * 2.0;
      float checker = mod(floor(p.x) + floor(p.y) + floor(p.z), 2.0);
      vec3 c1 = vec3(0.0, 0.0, 0.0);
      vec3 c2 = vec3(1.0, 0.0, 1.0);
      col = mix(c1, c2, checker) * (0.5 + diff * 0.5);
      col += vec3(1.0) * pow(fres, 4.0) * 2.0;
    `,
  },

  // ================= CHAOS & ELDRITCH =================
  {
    id: 'eldritch', name: 'Eldritch flesh', category: 'Chaos & Eldritch', kind: 'shader', swatch: ['#6a0a3a', '#1a0a0a'],
    displaceParam: true, gravity: true,
    params: [
      { key: 'color', label: 'Vein', type: 'color', default: '#ff004a' },
      { key: 'scale', label: 'Pulse', type: 'range', min: 2, max: 12, step: 0.1, default: 5 },
      { key: 'displace', label: 'Morph', type: 'range', min: 0, max: 0.3, step: 0.005, default: 0.1 },
      { key: 'speed', label: 'Throb', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_scale;',
    fragBody: `
      float t = u_time * u_speed;
      float veins = abs(snoise(vObjPos * u_scale + vec3(t * 0.2, 0.0, t * 0.1)));
      float pulse = 0.5 + 0.5 * sin(t * 3.0 + veins * 12.0);
      vec3 flesh = mix(vec3(0.1, 0.01, 0.02), vec3(0.3, 0.05, 0.1), diff);
      col = flesh * (0.3 + diff * 0.6);
      col += u_color * pow(veins, 5.0) * pulse * 4.0;
      col += u_color * pow(fres, 2.0) * pulse * 0.8;
    `,
  },
  {
    id: 'meatgrinder', name: 'Raw meat', category: 'Chaos & Eldritch', kind: 'shader', swatch: ['#aa0000', '#330000'],
    params: [
      { key: 'speed', label: 'Pulse', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragBody: `
      float t = u_time * u_speed;
      float sinew = fbm(vObjPos * 8.0 + t * 0.2);
      float grain = abs(snoise(vObjPos * 20.0));
      vec3 flesh = mix(vec3(0.3, 0.0, 0.0), vec3(0.8, 0.2, 0.2), sinew);
      col = flesh * (0.3 + diff * 0.7);
      col += vec3(1.0, 0.8, 0.8) * pow(grain, 8.0) * (0.5 + 0.5 * sin(t * 5.0)); // Pulsing fibers
      col += vec3(0.5, 0.0, 0.0) * pow(fres, 2.0) * 0.8;
    `,
  },
  
  // ================= MIND-BENDING =================
  {
    id: 'hypnosis', name: 'Hypnotic swirl', category: 'Mind-bending', kind: 'shader', swatch: ['#ffaa00', '#0000ff'],
    gravity: true, transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'speed', label: 'Spiral', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 },
    ],
    fragBody: AXIS + `
      float r = length(pPerp) / E;
      float a = ang + u_time * u_speed * 2.0 + r * 12.0;
      float spiral = abs(sin(a * 4.0));
      float pupil = smoothstep(0.05, 0.0, r);
      vec3 c1 = hsv2rgb(vec3(0.05 + r * 0.1, 1.0, 1.0));
      vec3 c2 = hsv2rgb(vec3(0.6 + r * 0.2, 1.0, 1.0));
      col = mix(c1 * 0.2, c2, smoothstep(0.0, 0.2, spiral));
      col += vec3(1.0) * pupil * 4.0;
      col += vec3(1.0) * pow(fres, 4.0) * 2.0;
      alpha = clamp(0.3 + spiral + pupil, 0.0, 1.0);
    `,
  },
  {
    id: 'overload', name: 'Sensory overload', category: 'Mind-bending', kind: 'shader', swatch: ['#ff00ff', '#00ffff'],
    params: [
      { key: 'speed', label: 'Trip', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 },
    ],
    fragBody: `
      float t = u_time * u_speed;
      float n1 = fbm(vObjPos * 4.0 + t * 0.5);
      float n2 = fbm(vObjPos * 6.0 - t * 0.8);
      float n3 = fbm(vObjPos * 3.0 + vec3(t * 1.2, -t * 0.5, 0.0));
      vec3 c1 = hsv2rgb(vec3(n1 * 0.5 + t * 0.1, 1.0, 1.0));
      vec3 c2 = hsv2rgb(vec3(n2 * 0.5 + 0.5, 1.0, 1.0));
      col = mix(c1, c2, n3) * (0.5 + diff * 0.8);
      col += vec3(1.0) * pow(fres, 4.0) * 3.0;
    `,
  },
  {
    id: 'nanoswarm', name: 'Nano-swarm', category: 'Mind-bending', kind: 'shader', swatch: ['#ff5500', '#111111'],
    params: [
      { key: 'speed', label: 'Move', type: 'range', min: 0, max: 4, step: 0.05, default: 2 },
    ],
    fragBody: `
      float t = u_time * u_speed;
      float s1 = step(0.85, snoise(vObjPos * 10.0 + vec3(t, 0.0, 0.0)));
      float s2 = step(0.85, snoise(vObjPos * 12.0 - vec3(0.0, t, 0.0)));
      float s3 = step(0.85, snoise(vObjPos * 14.0 + vec3(0.0, 0.0, t)));
      col = vec3(0.1) * diff;
      col += vec3(1.0, 0.3, 0.0) * (s1 + s2 + s3);
      col += vec3(1.0, 0.5, 0.0) * pow(fres, 3.0) * 1.5;
    `,
  },
  {
    id: 'moireheadache',
    name: 'Moiré Madness',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#000000', '#ffffff'],
    params: [
      { key: 'speed', label: 'Spin', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 }
    ],
    fragBody: `
      float t = u_time * u_speed;
      float x = vObjPos.x * 20.0;
      float y = vObjPos.y * 20.0;
      float m1 = sin(x * 2.0 + t) * sin(y * 2.0 - t);
      float m2 = sin(x * 1.5 - t * 1.3) * sin(y * 1.5 + t * 1.3);
      float m = abs(m1 - m2);
      col = vec3(m) * diff * 2.0;
      col += vec3(1.0) * pow(fres, 5.0) * 1.0;
    `
  },
  {
    id: 'brainmelting',
    name: 'Brain Melting',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ffaa00', '#aa00ff'],
    params: [
      { key: 'speed', label: 'Trip', type: 'range', min: 0, max: 4, step: 0.05, default: 2.0 }
    ],
    fragBody: `
      float t = u_time * u_speed;
      float n1 = fbm(vObjPos * 4.0 + t * 0.7);
      float n2 = fbm(vObjPos * 5.0 - t * 0.9);
      float n3 = fbm(vObjPos * 3.0 + vec3(t * 1.1, -t * 0.6, 0.0));
      float melt = sin(vObjPos.y * 10.0 + n1 * 8.0 + t) * 0.5 + 0.5;
      vec3 hot = vec3(1.0, 0.6, 0.1) * (1.0 - melt) * 2.0;
      vec3 cold = vec3(0.2, 0.1, 1.0) * melt * 2.0;
      col = mix(hot, cold, n3) * diff;
      col += vec3(1.0) * pow(fres, 4.0) * 1.8;
    `
  },
  {
    id: 'voxelize',
    name: 'Voxelizer',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ff5500', '#0000ff'],
    gravity: true,
    fragBody: AXIS + `
      float voxelSize = 0.1;
      vec3 voxel = floor(vObjPos / voxelSize) * voxelSize;
      float noise = snoise(voxel * 3.0 + u_time * u_speed);
      float edge = step(0.5, fbm(voxel * 10.0));
      vec3 c1 = hsv2rgb(vec3(noise * 0.5 + 0.2, 1.0, 1.0));
      vec3 c2 = hsv2rgb(vec3(noise * 0.5 + 0.7, 1.0, 1.0));
      col = mix(c1, c2, edge) * (0.5 + diff * 0.5);
      col += vec3(1.0) * pow(fres, 5.0) * 1.5;
    `
  },
  {
    id: 'cellularnoise',
    name: 'Cellular Chaos',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ff0088', '#00ff88'],
    gravity: true,
    fragBody: AXIS + `
      float t = u_time * u_speed;
      vec3 p = vObjPos * 4.0;
      vec3 cell = floor(p) + 0.5;
      vec3 subs = p - cell;
      float dist = length(subs) * 0.8;
      float n = snoise(cell + t * 0.2);
      float brightness = 1.0 - smoothstep(0.0, 0.5, dist);
      vec3 c1 = hsv2rgb(vec3(n * 0.8, 1.0, 1.0));
      vec3 c2 = vec3(1.0);
      col = mix(vec3(0.05), c1, brightness * 0.8) * diff;
      col += c2 * pow(fres, 4.0) * 1.5;
    `
  },
  {
    id: 'timeslicer',
    name: 'Time Slicer',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ff0000', '#00ff00'],
    gravity: true,
    fragBody: AXIS + `
      float t = u_time * u_speed;
      float slice = sin(h * 15.0 - t * 5.0) * 0.5 + 0.5;
      float thickness = abs(fract(h * 15.0 - t * 5.0) - 0.5) * 2.0;
      float sliceEdge = smoothstep(0.8, 0.9, thickness) * smoothstep(0.95, 0.9, thickness);
      float glow = exp(-thickness * 10.0);
      vec3 c1 = vec3(1.0, 0.2, 0.1) * glow;
      vec3 c2 = vec3(0.1, 1.0, 0.2) * sliceEdge;
      col = (c1 + c2) * 1.5 * (0.5 + diff * 0.5);
      col += vec3(1.0) * pow(fres, 3.0) * 1.2;
    `
  },
  {
    "id": "neonwireframe",
    "name": "Neon Wireframe",
    "category": "Mind-bending",
    "kind": "shader",
    "swatch": ["#000000", "#ff0055"],
    "gravity": false,
    "fragBody": "float t = u_time * u_speed; float edge = abs(1.0 - 2.0 * fbm(vObjPos * 20.0 + t * 0.5)); edge = smoothstep(0.7,0.9,edge); vec3 wire = vec3(1.0, 0.0, 0.5) * edge * 3.0; col = wire * diff; col += vec3(1.0) * pow(fres,5.0)*0.5;",
    "params": [
      { "key": "speed", "label": "Wire", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.0 }
    ]
  },
  {
    "id": "psychedelicfractal",
    "name": "Psychedelic Fractal",
    "category": "Mind-bending",
    "kind": "shader",
    "swatch": ["#ff00ff", "#ffff00"],
    "gravity": false,
    "params": [
      { "key": "speed", "label": "Trip", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 2.5 }
    ],
    "fragBody": "float t = u_time * u_speed; float z = 1.0; for(int i=0; i<3; i++){ z = fbm(vObjPos * z * 2.0 + t * 0.2) * 2.0; } vec3 c = hsv2rgb(vec3(z*0.8+t*0.1, 1.0, 1.0)); col = c * diff; col += vec3(1.0)*pow(fres,4.0)*2.0;"
  },  // =========== after the existing presets, replace from cyberglitch onward ===========
  {
    id: 'cyberglitch',
    name: 'Cyber Glitch',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ff00ff', '#00ffff'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; float block = floor(h*15.0+t*2.0)*0.0667; float glitch = step(0.88, snoise(vec3(block*1.3, t*5.0, 0.3))); float g2 = step(0.94, fbm(vObjPos*30.0+t*10.0)); float bright = max(glitch, g2); vec3 colBase = hsv2rgb(vec3(fract(h*2.0+t*0.1), 1.0, 1.0)); col = mix(colBase*0.2, colBase, bright) * diff; col += vec3(1.0,0.3,0.5)*pow(fres,4.0)*1.2;\n`,
    params: [
      { key: 'speed', label: 'Jitter', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 },
    ],
  },
  {
    id: 'gelatinouscube',
    name: 'Gelatinous Cube',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#8affb0', '#0a4a2a'],
    gravity: true,
    transparent: true,
    additive: true,
    depthWrite: false,
    fragBody: AXIS + `\n float t = u_time * u_speed; float wobble = sin(pPerp * 4.0 + t * 2.0) * 0.2; float gel = fbm(vObjPos * 3.0 + t * 0.3 + wobble); float opacity = smoothstep(0.3, 0.7, gel) * 0.9; col = hsv2rgb(vec3(0.3 + gel * 0.2, 0.8, 1.0)) * opacity * 1.5; alpha = opacity;\n`,
    params: [
      { key: 'speed', label: 'Wiggle', type: 'range', min: 0, max: 3, step: 0.05, default: 1.2 },
    ],
  },
  {
    id: 'sandstorm',
    name: 'Sandstorm',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#d4a036', '#3a2a0a'],
    gravity: true,
    transparent: true,
    additive: true,
    depthWrite: false,
    fragBody: AXIS + `\n float t = u_time * u_speed; float grains = 0.0; for(int i=0; i<4; i++){ float fi = float(i); grains += step(0.82, snoise(vObjPos * (8.0+fi*3.0) + vec3(fi*t*1.7, -fi*t*0.9, fi))); } col = vec3(0.8,0.5,0.2) * grains * 2.0; alpha = grains * 0.85;\n`,
    params: [
      { key: 'speed', label: 'Wind', type: 'range', min: 0, max: 4, step: 0.05, default: 2.2 },
    ],
  },
  {
    id: 'nebulaecho',
    name: 'Nebula Echo',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ff80c0', '#200840'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; float cloud = fbm(vObjPos*2.5 + t*0.15); float echo = sin(cloud*12.0)*0.5+0.5; vec3 col1 = hsv2rgb(vec3(0.8+cloud*0.2, 0.7, 0.5)); vec3 col2 = hsv2rgb(vec3(0.6+cloud*0.3, 0.8, 0.8)); col = mix(col1, col2, echo) * diff; col += vec3(1.0,0.7,1.0)*pow(fres,3.0)*0.9;\n`,
    params: [
      { key: 'speed', label: 'Drift', type: 'range', min: 0, max: 3, step: 0.05, default: 1.0 },
    ],
  },
  {
    id: 'electricarc',
    name: 'Electric Arc',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ffffff', '#0022ff'],
    gravity: true,
    transparent: true,
    additive: true,
    depthWrite: false,
    fragBody: AXIS + `\n float t = u_time * u_speed; float arc = 0.0; for(int i=0; i<3; i++){ float fi = float(i); arc += pow(max(0.0, 1.0 - abs(sin(pPerp*(7.0+fi*3.0)+t*2.0 + fi*1.2)*0.5+0.5 - 0.7)*15.0), 3.0); } arc = clamp(arc,0.0,1.0); col = vec3(0.8,0.9,1.0) * arc * 4.0; col += vec3(1.0)*pow(fres,5.0)*0.8; alpha = arc*0.95;\n`,
    params: [
      { key: 'speed', label: 'Zap', type: 'range', min: 0, max: 4, step: 0.05, default: 2.5 },
    ],
  },
  {
    id: 'flowymercury',
    name: 'Flow Mercury',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#c0c0d0', '#3a3a4a'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; float flow = fbm(vObjPos*3.0 + t*0.4); float streak = abs(sin(ang*4.0 + flow*7.0 + t)*0.5+0.5); col = mix(vec3(0.2,0.22,0.3), vec3(0.8,0.82,0.9), streak) * diff; col += vec3(1.0)*pow(fres,3.0)*0.7;\n`,
    params: [
      { key: 'speed', label: 'Flow', type: 'range', min: 0, max: 3, step: 0.05, default: 1.3 },
    ],
  },
  {
    id: 'candyfloss',
    name: 'Candy Floss',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ffaacc', '#ffffff'],
    gravity: false,
    fragBody: `float t = u_time * u_speed; float fluff = fbm(vObjPos*5.0 + t*0.6); float thickness = smoothstep(0.3, 0.8, fluff); vec3 cotton = mix(vec3(1.0,0.7,0.8), vec3(1.0,0.9,0.95), thickness); col = cotton * diff; col += vec3(1.0)*pow(fres,2.0)*1.2;`,
    params: [
      { key: 'speed', label: 'Spin', type: 'range', min: 0, max: 3, step: 0.05, default: 0.8 },
    ],
  },
  {
    id: 'glitchgrid',
    name: 'Glitch Grid',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ff00ff', '#000000'],
    gravity: true,
    transparent: true,
    additive: true,
    depthWrite: false,
    fragBody: AXIS + `\n float t = u_time * u_speed; vec3 grid = fract(vObjPos*6.0); float gx = smoothstep(0.08,0.1,grid.x); float gy = smoothstep(0.08,0.1,grid.y); float gz = smoothstep(0.08,0.1,grid.z); float g = max(max(gx,gy),gz); float glitch = step(0.92, snoise(vObjPos*3.0 + t*10.0)); g = max(g, glitch); col = vec3(1.0,0.2,1.0) * g * 3.0; alpha = g*0.9;\n`,
    params: [
      { key: 'speed', label: 'Scan', type: 'range', min: 0, max: 4, step: 0.05, default: 1.8 },
    ],
  },
  {
    id: 'sparkleswirl',
    name: 'Sparkle Swirl',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ffdd55', '#550066'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; float a = ang + t*2.0 + rad*8.0; float spark = pow(max(sin(a*6.0)*0.5+0.5, 0.0), 20.0); vec3 base = hsv2rgb(vec3(0.15+rad*0.2, 0.9, 0.7)); col = base * diff + vec3(1.0,0.9,0.3)*spark*5.0; col += vec3(1.0)*pow(fres,4.0)*0.5;\n`,
    params: [
      { key: 'speed', label: 'Spin', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 },
    ],
  },
  {
    id: 'bubblecolumn',
    name: 'Bubble Column',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#80d0ff', '#0a2a4a'],
    gravity: true,
    transparent: true,
    additive: true,
    depthWrite: false,
    fragBody: AXIS + `\n float t = u_time * u_speed; float rise = fract(h*4.0 - t*0.9); float bubble = step(0.85, snoise(vObjPos*10.0 + vec3(0.0,t*2.5,0.0))); bubble *= smoothstep(0.0, 0.2, rise)*smoothstep(0.8,0.6,rise); col = vec3(0.3,0.8,1.0) * bubble * 2.5; col += vec3(1.0)*pow(fres,3.0)*0.4; alpha = bubble*0.9;\n`,
    params: [
      { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 4, step: 0.05, default: 1.6 },
    ],
  },
  {
    id: 'hologlitch',
    name: 'Holo-Glitch',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ffaa00', '#0055ff'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; float holo = fbm(vObjPos*4.0 + t*0.5); float g = step(0.65, holo) * smoothstep(0.3,0.8,holo); vec3 c1 = hsv2rgb(vec3(0.6+holo*0.2,1.0,1.0)); vec3 c2 = vec3(0.9); col = mix(c1*0.3, c2, g) * diff; col += vec3(1.0)*pow(fres,4.0)*0.8;\n`,
    params: [
      { key: 'speed', label: 'Shift', type: 'range', min: 0, max: 4, step: 0.05, default: 1.0 },
    ],
  },
  {
    id: 'rainbowwave',
    name: 'Rainbow Wave',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ff0066', '#00ffcc'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; float wave = sin(pPerp*6.0 + h*8.0 - t*4.0)*0.5+0.5; col = hsv2rgb(vec3(fract(h*2.0+t*0.1), 1.0, 1.0)) * wave * 2.0 * diff; col += vec3(1.0)*pow(fres,3.0)*1.2;\n`,
    params: [
      { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 4, step: 0.05, default: 2.0 },
    ],
  },
  {
    id: 'octarine',
    name: 'Octarine',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#7a00ff', '#ff0088'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; float n = fbm(vObjPos*5.0 + t*0.4); float magic = sin(n*12.0)*0.5+0.5; vec3 c = hsv2rgb(vec3(0.8+n*0.2, 0.9, 1.0)); col = c * magic * 2.0 * diff; col += vec3(0.8,0.2,1.0)*pow(fres,4.0)*0.6;\n`,
    params: [],
  },
  {
    id: 'shatteredglass',
    name: 'Shattered Glass',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#88ccff', '#1a2a3a'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; vec3 p = vObjPos*12.0; vec3 f1 = floor(p); float crack = abs(snoise(f1 + t*0.1)); float shard = step(0.7, crack); col = mix(vec3(0.1,0.2,0.3), vec3(0.6,0.8,1.0), shard) * diff; col += vec3(1.0)*pow(fres,5.0)*0.9;\n`,
    params: [
      { key: 'speed', label: 'Stress', type: 'range', min: 0, max: 3, step: 0.05, default: 1.0 },
    ],
  },
  {
    id: 'phaseghost',
    name: 'Phase Ghost',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#d0f0ff', '#4a6a8a'],
    gravity: true,
    transparent: true,
    additive: true,
    depthWrite: false,
    fragBody: AXIS + `\n float t = u_time * u_speed; float phase = sin(t*3.0 + pPerp*10.0)*0.5+0.5; float v = fbm(vObjPos*2.0 + t*0.7); col = vec3(0.8,0.9,1.0) * v * phase * 2.0; alpha = v*phase*0.85;\n`,
    params: [
      { key: 'speed', label: 'Phase', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 },
    ],
  },
  {
    id: 'liquidmetal',
    name: 'Liquid Metal',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#b0b0c0', '#1a1a2a'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; float flow = fbm(vObjPos*2.5 + t*0.3); float spec = pow(max(dot(reflect(-V, N), KL), 0.0), 30.0); col = mix(vec3(0.1,0.12,0.18), vec3(0.8,0.82,0.9), flow) * diff; col += vec3(1.0)*spec*1.8;\n`,
    params: [
      { key: 'speed', label: 'Flow', type: 'range', min: 0, max: 3, step: 0.05, default: 1.0 },
    ],
  },
  {
    id: 'inkdrop',
    name: 'Ink Drop',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#000000', '#ffffff'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; float n = fbm(vObjPos*3.0 + t*0.2); float ink = smoothstep(0.4, 0.7, n); col = vec3(1.0-ink) * diff; col += vec3(0.1)*pow(fres,2.0);\n`,
    params: [],
  },
  {
    id: 'shockwave',
    name: 'Shockwave',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ffaa00', '#550000'],
    gravity: true,
    transparent: true,
    additive: true,
    depthWrite: false,
    fragBody: AXIS + `\n float t = u_time * u_speed; float wave = sin(rad*15.0 - t*6.0)*0.5+0.5; wave = smoothstep(0.2,0.6,wave) * exp(-rad*2.0); col = vec3(1.0,0.6,0.1) * wave * 3.0; alpha = wave*0.9;\n`,
    params: [
      { key: 'speed', label: 'Boom', type: 'range', min: 0, max: 4, step: 0.05, default: 2.0 },
    ],
  },
  {
    id: 'tvstatic',
    name: 'TV Static',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#888888', '#000000'],
    gravity: false,
    fragBody: 'float t = u_time * u_speed; float noise = snoise(vObjPos*30.0 + t*50.0); float mono = noise*0.5+0.5; col = vec3(mono) * diff; col += vec3(1.0)*pow(fres,2.0)*0.2;',
    params: [
      { key: 'speed', label: 'Noise', type: 'range', min: 0, max: 4, step: 0.05, default: 1.0 },
    ],
  },
  {
    id: 'motherofflowers',
    name: 'Mother of Flowers',
    category: 'Mind-bending',
    kind: 'shader',
    swatch: ['#ff88bb', '#2288ff'],
    gravity: true,
    fragBody: AXIS + `\n float t = u_time * u_speed; float petal = sin(ang*5.0 + rad*12.0 + t)*0.5+0.5; petal = pow(petal, 3.0); vec3 c = hsv2rgb(vec3(0.8+petal*0.2, 0.8, 0.9)); col = c * petal * 2.0 * diff; col += vec3(1.0,0.6,0.8)*pow(fres,3.0)*0.7;\n`,
    params: [
      { key: 'speed', label: 'Bloom', type: 'range', min: 0, max: 3, step: 0.05, default: 1.0 },
    ],
  },
    // ================= MIND-BENDING =================
    {
      id: 'wormhole',
      name: 'Wormhole',
      category: 'Mind-bending',
      kind: 'shader',
      swatch: ['#4400ff', '#ff00aa'],
      gravity: true,
      transparent: true,
      additive: true,
      depthWrite: false,
      fragBody: AXIS + `
        float r = pPerp / E;
        float a = ang + u_time * u_speed * 3.0 + r * 20.0;
        float tunnel = sin(a * 5.0) * 0.5 + 0.5;
        float rim = smoothstep(0.8, 1.0, r);
        vec3 col1 = hsv2rgb(vec3(0.7 + r * 0.2, 1.0, 1.0));
        vec3 col2 = hsv2rgb(vec3(0.9 + r * 0.3, 1.0, 0.8));
        col = mix(col1, col2, tunnel);
        col += vec3(1.0, 0.2, 0.5) * pow(rim, 2.0) * 2.0;
        alpha = clamp(tunnel * 0.8 + rim, 0.0, 1.0);
      `
    },
    {
      id: 'fiberoptic',
      name: 'Fiber Optic',
      category: 'Mind-bending',
      kind: 'shader',
      swatch: ['#00ffcc', '#ff00ff'],
      gravity: true,
      transparent: true,
      additive: true,
      depthWrite: false,
      fragBody: AXIS + `
        float t = u_time * u_speed;
        float hNorm = (h - u_levMin) / (u_levMax - u_levMin);
        float s = sin(h * 30.0 + t * 5.0 + pPerp * 10.0) * 0.5 + 0.5;
        float bright = smoothstep(0.85, 1.0, s);
        vec3 c1 = hsv2rgb(vec3(hNorm * 0.8, 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(hNorm * 0.8 + 0.5, 1.0, 1.0));
        col = mix(c1, c2, bright) * bright * 3.0;
        col += vec3(1.0) * pow(fres, 3.0) * 1.5;
        alpha = bright * 0.9;
      `
    },
    {
      id: 'moireheadache',
      name: 'Moiré Madness',
      category: 'Mind-bending',
      kind: 'shader',
      swatch: ['#000000', '#ffffff'],
      params: [
        { key: 'speed', label: 'Spin', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 }
      ],
      fragBody: `
        float t = u_time * u_speed;
        float x = vObjPos.x * 20.0;
        float y = vObjPos.y * 20.0;
        float m1 = sin(x * 2.0 + t) * sin(y * 2.0 - t);
        float m2 = sin(x * 1.5 - t * 1.3) * sin(y * 1.5 + t * 1.3);
        float m = abs(m1 - m2);
        col = vec3(m) * diff * 2.0;
        col += vec3(1.0) * pow(fres, 5.0) * 1.0;
      `
    },
    {
      id: 'neonpulse',
      name: 'Neon Pulse',
      category: 'Mind-bending',
      kind: 'shader',
      swatch: ['#ff00ff', '#00ffff'],
      gravity: true,
      fragBody: AXIS + `
        float t = u_time * u_speed;
        float pulse = sin(pPerp * 8.0 - t * 4.0) * 0.5 + 0.5;
        float ring = smoothstep(0.3, 0.4, pulse) * smoothstep(0.6, 0.5, pulse);
        vec3 c1 = hsv2rgb(vec3(fract(h * 1.5 + t * 0.1), 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(fract(h * 1.5 + 0.5 + t * 0.1), 1.0, 1.0));
        col = mix(c1, c2, ring) * (0.5 + diff * 0.5);
        col += vec3(1.0) * pow(fres, 3.0) * 2.0;
      `
    },
    {
      id: 'echolocation',
      name: 'Echolocation',
      category: 'Mind-bending',
      kind: 'shader',
      swatch: ['#00ff00', '#000000'],
      gravity: true,
      transparent: true,
      additive: true,
      depthWrite: false,
      fragBody: AXIS + `
        float t = u_time * u_speed;
        float dist = pPerp / E;
        float wave = sin(dist * 30.0 - t * 8.0) * 0.5 + 0.5;
        float ring = smoothstep(0.45, 0.6, wave) * smoothstep(0.9, 0.8, dist);
        col = vec3(0.2, 1.0, 0.2) * ring * 2.0;
        col += vec3(0.8) * pow(fres, 4.0) * 0.5;
        alpha = ring * 0.8;
      `
    },
    {
      id: 'liquidcrystal',
      name: 'Liquid Crystal',
      category: 'Mind-bending',
      kind: 'shader',
      swatch: ['#ff80c0', '#80ff80'],
      gravity: true,
      transparent: true,
      depthWrite: false,
      fragBody: AXIS + `
        float t = u_time * u_speed;
        float hNorm = (h - u_levMin) / (u_levMax - u_levMin);
        float n = fbm(vObjPos * 3.0 + t * 0.5);
        float swirl = sin(pPerp * 5.0 + h * 10.0 + t * 2.0 + n * 5.0) * 0.5 + 0.5;
        vec3 c1 = hsv2rgb(vec3(hNorm * 0.7 + n * 0.2, 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(hNorm * 0.7 + 0.5 + n * 0.2, 1.0, 1.0));
        col = mix(c1, c2, swirl) * (0.4 + diff * 0.6);
        col += vec3(1.0) * pow(fres, 3.0) * 1.2;
        alpha = 0.7 + swirl * 0.3;
      `
    },
    {
      id: 'brainmelting',
      name: 'Brain Melting',
      category: 'Mind-bending',
      kind: 'shader',
      swatch: ['#ffaa00', '#aa00ff'],
      params: [
        { key: 'speed', label: 'Trip', type: 'range', min: 0, max: 4, step: 0.05, default: 2.0 }
      ],
      fragBody: `
        float t = u_time * u_speed;
        float n1 = fbm(vObjPos * 4.0 + t * 0.7);
        float n2 = fbm(vObjPos * 5.0 - t * 0.9);
        float n3 = fbm(vObjPos * 3.0 + vec3(t * 1.1, -t * 0.6, 0.0));
        float melt = sin(vObjPos.y * 10.0 + n1 * 8.0 + t) * 0.5 + 0.5;
        vec3 hot = vec3(1.0, 0.6, 0.1) * (1.0 - melt) * 2.0;
        vec3 cold = vec3(0.2, 0.1, 1.0) * melt * 2.0;
        col = mix(hot, cold, n3) * diff;
        col += vec3(1.0) * pow(fres, 4.0) * 1.8;
      `
    },
    {
      id: 'voxelize',
      name: 'Voxelizer',
      category: 'Mind-bending',
      kind: 'shader',
      swatch: ['#ff5500', '#0000ff'],
      gravity: true,
      fragBody: AXIS + `
        float voxelSize = 0.1;
        vec3 voxel = floor(vObjPos / voxelSize) * voxelSize;
        float noise = snoise(voxel * 3.0 + u_time * u_speed);
        float edge = step(0.5, fbm(voxel * 10.0));
        vec3 c1 = hsv2rgb(vec3(noise * 0.5 + 0.2, 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(noise * 0.5 + 0.7, 1.0, 1.0));
        col = mix(c1, c2, edge) * (0.5 + diff * 0.5);
        col += vec3(1.0) * pow(fres, 5.0) * 1.5;
      `
    },
    {
      id: 'cellularnoise',
      name: 'Cellular Chaos',
      category: 'Mind-bending',
      kind: 'shader',
      swatch: ['#ff0088', '#00ff88'],
      gravity: true,
      fragBody: AXIS + `
        float t = u_time * u_speed;
        vec3 p = vObjPos * 4.0;
        vec3 cell = floor(p) + 0.5;
        vec3 subs = p - cell;
        float dist = length(subs) * 0.8;
        float n = snoise(cell + t * 0.2);
        float brightness = 1.0 - smoothstep(0.0, 0.5, dist);
        vec3 c1 = hsv2rgb(vec3(n * 0.8, 1.0, 1.0));
        vec3 c2 = vec3(1.0);
        col = mix(vec3(0.05), c1, brightness * 0.8) * diff;
        col += c2 * pow(fres, 4.0) * 1.5;
      `
    },
    {
      id: 'timeslicer',
      name: 'Time Slicer',
      category: 'Mind-bending',
      kind: 'shader',
      swatch: ['#ff0000', '#00ff00'],
      gravity: true,
      fragBody: AXIS + `
        float t = u_time * u_speed;
        float slice = sin(h * 15.0 - t * 5.0) * 0.5 + 0.5;
        float thickness = abs(fract(h * 15.0 - t * 5.0) - 0.5) * 2.0;
        float sliceEdge = smoothstep(0.8, 0.9, thickness) * smoothstep(0.95, 0.9, thickness);
        float glow = exp(-thickness * 10.0);
        vec3 c1 = vec3(1.0, 0.2, 0.1) * glow;
        vec3 c2 = vec3(0.1, 1.0, 0.2) * sliceEdge;
        col = (c1 + c2) * 1.5 * (0.5 + diff * 0.5);
        col += vec3(1.0) * pow(fres, 3.0) * 1.2;
      `
    },
    {
      "id": "quantumfoam",
      "name": "Quantum Foam",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#00ffff", "#ff00ff"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float n = fbm(vObjPos * 8.0 + t * 0.3); float bubbles = step(0.6, n) * n; vec3 c1 = hsv2rgb(vec3(fract(h*2.0 + t*0.2), 1.0, 1.0)); vec3 c2 = vec3(1.0); col = mix(c1*0.3, c2, bubbles) * diff; col += vec3(1.0,0.7,1.0) * pow(fres,4.0)*1.5; alpha = bubbles*0.9; `",
      "params": [
        { "key": "speed", "label": "Brew", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.2 }
      ]
    },
    {
      "id": "plasmavortex",
      "name": "Plasma Vortex",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ffaa00", "#00ffff"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float r = pPerp/E; float a = ang + t*4.0 + r*15.0; float vortex = sin(a*5.0)*0.5+0.5; float rim = smoothstep(0.7,1.0,r); vec3 c = hsv2rgb(vec3(0.1+r*0.2+t*0.1,1.0,1.0)) * vortex; col = c * (0.3+diff*0.7); col += vec3(1.0,0.5,0.2)*pow(rim,2.0)*2.0; alpha = vortex*0.8+rim; `",
      "params": [
        { "key": "speed", "label": "Spin", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 2.0 }
      ]
    },
    {
      "id": "neonwireframe",
      "name": "Neon Wireframe",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#000000", "#ff0055"],
      "gravity": false,
      "fragBody": "float t = u_time * u_speed; float edge = abs(1.0 - 2.0 * fbm(vObjPos * 20.0 + t * 0.5)); edge = smoothstep(0.7,0.9,edge); vec3 wire = vec3(1.0, 0.0, 0.5) * edge * 3.0; col = wire * diff; col += vec3(1.0) * pow(fres,5.0)*0.5;",
      "params": [
        { "key": "speed", "label": "Wire", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.0 }
      ]
    },
    {
      "id": "datacorruption",
      "name": "Data Corruption",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#00ff00", "#000000"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float block = floor(h*20.0+t*2.0)*0.05; float glitch = step(0.9, snoise(vec2(block, t*5.0))); float g2 = step(0.95, fbm(vObjPos*30.0+t*10.0)); float bright = max(glitch,g2); col = vec3(0.2,1.0,0.2) * bright * 2.0; alpha = bright*0.9; `",
      "params": []
    },
    {
      "id": "oilslick",
      "name": "Oil Slick",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ff00ff", "#00ff88"],
      "gravity": true,
      "transparent": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float film = fbm(vObjPos*2.0 + t*0.3)*0.7; vec3 iri = hsv2rgb(vec3(fract(h*5.0+film), 1.0, 1.0)); col = iri * (0.5+diff*0.5); col += vec3(1.0)*pow(fres,3.0)*1.2; alpha = 0.7+film*0.3; `",
      "params": [
        { "key": "speed", "label": "Flow", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.0 }
      ]
    },
    {
      "id": "cellularautomata",
      "name": "Cellular Automata",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ff8800", "#ff0088"],
      "gravity": true,
      "fragBody": "AXIS + ` float t = u_time * u_speed; vec3 cell = floor(vObjPos*5.0) / 5.0; float n = snoise(cell + t*0.2); float state = step(0.3, n) * step(0.7, n); vec3 c1 = hsv2rgb(vec3(0.05, 1.0, 1.0)); vec3 c2 = hsv2rgb(vec3(0.8, 1.0, 1.0)); col = mix(c1, c2, state) * diff; col += vec3(1.0)*pow(fres,4.0)*0.8; `",
      "params": [
        { "key": "speed", "label": "Evolve", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.8 }
      ]
    },
    {
      "id": "psychedelicfractal",
      "name": "Psychedelic Fractal",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ff00ff", "#ffff00"],
      "gravity": false,
      "params": [
        { "key": "speed", "label": "Trip", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 2.5 }
      ],
      "fragBody": "float t = u_time * u_speed; float z = 1.0; for(int i=0; i<3; i++){ z = fbm(vObjPos * z * 2.0 + t * 0.2) * 2.0; } vec3 c = hsv2rgb(vec3(z*0.8+t*0.1, 1.0, 1.0)); col = c * diff; col += vec3(1.0)*pow(fres,4.0)*2.0;"
    },
    {
      "id": "magneticflux",
      "name": "Magnetic Flux",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#00ff00", "#0000ff"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float field = sin(pPerp*10.0 - t*3.0 + h*5.0)*0.5+0.5; float lines = abs(field - round(field*5.0)/5.0)*10.0; lines = smoothstep(0.8,1.0,lines); col = vec3(0.2,1.0,0.2) * lines * 2.0; col += vec3(0.2,0.5,1.0) * pow(fres,4.0)*1.5; alpha = lines*0.9; `",
      "params": [
        { "key": "speed", "label": "Flux", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.5 }
      ]
    },
    {
      "id": "spectralmelt",
      "name": "Spectral Melt",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ff0000", "#0000ff"],
      "gravity": true,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float melt = sin(vObjPos.y*10.0 + t*2.0 + fbm(vObjPos*2.0)*5.0)*0.5+0.5; vec3 hot = vec3(1.0,0.3,0.1) * (1.0-melt) * 2.0; vec3 cold = vec3(0.1,0.2,1.0) * melt * 2.0; col = mix(hot, cold, melt) * diff; col += vec3(1.0)*pow(fres,3.0)*1.5; `",
      "params": []
    },
    {
      "id": "timedilated",
      "name": "Time Dilated",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#00ffff", "#ff00ff"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float distort = sin(t*2.0)*0.5+0.5; float hh = h + distort*0.2*sin(pPerp*10.0); float stripe = sin(hh*20.0 - t*8.0)*0.5+0.5; stripe = smoothstep(0.3,0.7,stripe); vec3 c1 = hsv2rgb(vec3(0.6+distort*0.3,1.0,1.0)); vec3 c2 = vec3(1.0); col = mix(c1, c2, stripe) * diff; col += vec3(1.0)*pow(fres,4.0)*1.2; alpha = stripe*0.9; `",
      "params": [
        { "key": "speed", "label": "Warp", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 2.0 }
      ]
    },
    {
      "id": "holographicnoise",
      "name": "Holographic Noise",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ff8800", "#00ff88"],
      "gravity": true,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float n = fbm(vObjPos*6.0 + t*0.5); float hologram = sin(n*15.0)*0.5+0.5; vec3 c = hsv2rgb(vec3(fract(h*2.0+t*0.1), 1.0, 1.0)); col = c * hologram * 2.0 * diff; col += vec3(1.0)*pow(fres,4.0)*0.8; `",
      "params": [
        { "key": "speed", "label": "Shift", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.3 }
      ]
    },
    {
      "id": "crackedenergy",
      "name": "Cracked Energy",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#4400ff", "#ffaa00"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float crack = max(0.0, 1.0 - abs(sin(pPerp*10.0 + t*2.0)*0.5+0.5 - 0.8)*10.0); crack += max(0.0, 1.0 - abs(sin(pPerp*7.0 - t*1.5 + h*3.0)*0.5+0.5 - 0.8)*10.0); crack = clamp(crack, 0.0, 1.0); col = vec3(0.6,0.2,1.0) * crack * 2.0; col += vec3(1.0,0.5,0.2)*pow(fres,3.0)*1.5; alpha = crack*0.9; `",
      "params": [
        { "key": "speed", "label": "Charge", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 2.2 }
      ]
    },
    {
      "id": "warpcore",
      "name": "Warp Core",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#00ffff", "#ffffff"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float pulse = sin(pPerp*5.0 - t*3.0)*0.5+0.5; float intensity = pow(pulse, 4.0) * 3.0; col = vec3(0.2,1.0,1.0) * intensity; col += vec3(1.0)*pow(fres,4.0)*1.5; alpha = intensity*0.8; `",
      "params": [
        { "key": "speed", "label": "Throttle", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 2.5 }
      ]
    },
    {
      "id": "chromaticaberration",
      "name": "Chromatic Aberration",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ff0000", "#00ff00"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float hNorm = (h - u_levMin)/(u_levMax - u_levMin); vec3 colR = vec3(1.0,0.2,0.2) * step(0.7, fbm(vObjPos*10.0 + hNorm*0.1 + t*0.1)); vec3 colG = vec3(0.2,1.0,0.2) * step(0.7, fbm(vObjPos*10.0 - hNorm*0.1 + t*0.1)); vec3 colB = vec3(0.2,0.2,1.0) * step(0.7, fbm(vObjPos*10.0 + t*0.1)); col = (colR+colG+colB)*1.5; alpha = max(max(colR.r,colG.g),colB.b)*0.9; `",
      "params": [
        { "key": "speed", "label": "Fringe", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.0 }
      ]
    },
    {
      "id": "particlestorm",
      "name": "Particle Storm",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ff5500", "#111111"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float p = 0.0; for(int i=0; i<5; i++){ float fi = float(i); p += step(0.85, snoise(vObjPos* (10.0+fi*2.0) + vec3(fi*t*1.5, -fi*t*0.8, 0.0))); } col = vec3(1.0,0.4,0.1) * p * 2.0; alpha = p*0.8; `",
      "params": [
        { "key": "speed", "label": "Storm", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 2.3 }
      ]
    },
    {
      "id": "bubbleuniverse",
      "name": "Bubble Universe",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ff00cc", "#00ffcc"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float bubbles = step(0.5, snoise(vObjPos*5.0 + t*0.3)); bubbles *= smoothstep(0.3, 0.5, fbm(vObjPos*3.0)); col = hsv2rgb(vec3(fract(pPerp*2.0 + t*0.1), 1.0, 1.0)) * bubbles * 2.0; col += vec3(1.0)*pow(fres,4.0)*0.5; alpha = bubbles*0.9; `",
      "params": [
        { "key": "speed", "label": "Fizz", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.0 }
      ]
    },
    {
      "id": "mandala",
      "name": "Mandala",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ffaa00", "#aa00ff"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float r = pPerp/E; float a = ang + t; float symmetry = 6.0; float pattern = sin(a*symmetry + r*10.0)*0.5+0.5; pattern = smoothstep(0.5,0.7,pattern); vec3 c1 = hsv2rgb(vec3(0.1+r*0.2+t*0.05,1.0,1.0)); col = c1 * pattern * 2.0 * diff; col += vec3(1.0)*pow(fres,3.0)*0.6; alpha = pattern*0.9; `",
      "params": [
        { "key": "speed", "label": "Rotate", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.0 }
      ]
    },
    {
      "id": "vaporwave",
      "name": "Vaporwave",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ff80c0", "#80ff80"],
      "gravity": true,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float wave = sin(pPerp*3.0 - t*2.0 + h*5.0)*0.5+0.5; vec3 pastel1 = vec3(1.0, 0.5, 0.7); vec3 pastel2 = vec3(0.5, 1.0, 0.7); col = mix(pastel1, pastel2, wave) * diff; col += vec3(1.0)*pow(fres,2.0)*1.0; `",
      "params": [
        { "key": "speed", "label": "Chill", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 0.8 }
      ]
    },
    {
      "id": "cyberpunkgrid",
      "name": "Cyberpunk Grid",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#ff00ff", "#00ffff"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; vec3 g = fract(vObjPos * 4.0); float grid = min(min(step(0.9,g.x), step(0.9,g.y)), step(0.9,g.z)); grid = smoothstep(0.0,0.1,grid); col = vec3(1.0,0.2,1.0) * grid * 2.0; col += vec3(0.2,1.0,1.0)*pow(fres,5.0)*1.2; alpha = grid*0.9; `",
      "params": [
        { "key": "speed", "label": "Scan", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.5 }
      ]
    },
    {
      "id": "radiatedglow",
      "name": "Radiated Glow",
      "category": "Mind-bending",
      "kind": "shader",
      "swatch": ["#00ff44", "#000000"],
      "gravity": true,
      "transparent": true,
      "additive": true,
      "depthWrite": false,
      "fragBody": "AXIS + ` float t = u_time * u_speed; float glow = exp(-pPerp * 5.0) * sin(t * 2.0 + h*10.0) * 0.5 + 0.5; glow *= smoothstep(0.0,0.2,glow); col = vec3(0.2,1.0,0.4) * glow * 2.0; alpha = glow*0.8; `",
      "params": [
        { "key": "speed", "label": "Pulse", "type": "range", "min": 0, "max": 4, "step": 0.05, "default": 1.7 }
      ]
    },
    {
      id: 'quantumfoam', name: 'Quantum Foam', category: 'Mind-bending', kind: 'shader',
      swatch: ['#00ffff', '#ff00ff'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float n = fbm(vObjPos * 8.0 + t * 0.3); float bubbles = step(0.6, n) * n; vec3 c1 = hsv2rgb(vec3(fract(h*2.0 + t*0.2), 1.0, 1.0)); vec3 c2 = vec3(1.0); col = mix(c1*0.3, c2, bubbles) * diff; col += vec3(1.0,0.7,1.0) * pow(fres,4.0)*1.5; alpha = bubbles*0.9; `,
      params: [ { key: 'speed', label: 'Brew', type: 'range', min: 0, max: 4, step: 0.05, default: 1.2 } ],
    },
    {
      id: 'plasmavortex', name: 'Plasma Vortex', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ffaa00', '#00ffff'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float r = rad; float a = ang + t*4.0 + r*15.0; float vortex = sin(a*5.0)*0.5+0.5; float rim = smoothstep(0.7,1.0,r); vec3 c = hsv2rgb(vec3(0.1+r*0.2+t*0.1,1.0,1.0)) * vortex; col = c * (0.3+diff*0.7); col += vec3(1.0,0.5,0.2)*pow(rim,2.0)*2.0; alpha = vortex*0.8+rim; `,
      params: [ { key: 'speed', label: 'Spin', type: 'range', min: 0, max: 4, step: 0.05, default: 2.0 } ],
    },
    {
      id: 'datacorruption', name: 'Data Corruption', category: 'Mind-bending', kind: 'shader',
      swatch: ['#00ff00', '#000000'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float block = floor(h*20.0+t*2.0)*0.05; float glitch = step(0.9, snoise(vec3(block, t*5.0, 0.0))); float g2 = step(0.95, fbm(vObjPos*30.0+t*10.0)); float bright = max(glitch,g2); col = vec3(0.2,1.0,0.2) * bright * 2.0; alpha = bright*0.9; `,
      params: [],
    },
    {
      id: 'oilslick', name: 'Oil Slick', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff00ff', '#00ff88'], gravity: true, transparent: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float film = fbm(vObjPos*2.0 + t*0.3)*0.7; vec3 iri = hsv2rgb(vec3(fract(h*5.0+film), 1.0, 1.0)); col = iri * (0.5+diff*0.5); col += vec3(1.0)*pow(fres,3.0)*1.2; alpha = 0.7+film*0.3; `,
      params: [ { key: 'speed', label: 'Flow', type: 'range', min: 0, max: 4, step: 0.05, default: 1.0 } ],
    },
    {
      id: 'cellularautomata', name: 'Cellular Automata', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff8800', '#ff0088'], gravity: true,
      fragBody: AXIS + ` float t = u_time * u_speed; vec3 cell = floor(vObjPos*5.0) / 5.0; float n = snoise(cell + t*0.2); float state = step(0.3, n) * step(0.7, n); vec3 c1 = hsv2rgb(vec3(0.05, 1.0, 1.0)); vec3 c2 = hsv2rgb(vec3(0.8, 1.0, 1.0)); col = mix(c1, c2, state) * diff; col += vec3(1.0)*pow(fres,4.0)*0.8; `,
      params: [ { key: 'speed', label: 'Evolve', type: 'range', min: 0, max: 4, step: 0.05, default: 1.8 } ],
    },
    {
      id: 'magneticflux', name: 'Magnetic Flux', category: 'Mind-bending', kind: 'shader',
      swatch: ['#00ff00', '#0000ff'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float field = sin(rad*10.0 - t*3.0 + h*5.0)*0.5+0.5; float lines = abs(field - floor(field*5.0 + 0.5)/5.0)*10.0; lines = smoothstep(0.8,1.0,lines); col = vec3(0.2,1.0,0.2) * lines * 2.0; col += vec3(0.2,0.5,1.0) * pow(fres,4.0)*1.5; alpha = lines*0.9; `,
      params: [ { key: 'speed', label: 'Flux', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 } ],
    },
    {
      id: 'spectralmelt', name: 'Spectral Melt', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff0000', '#0000ff'], gravity: true,
      fragBody: AXIS + ` float t = u_time * u_speed; float melt = sin(vObjPos.y*10.0 + t*2.0 + fbm(vObjPos*2.0)*5.0)*0.5+0.5; vec3 hot = vec3(1.0,0.3,0.1) * (1.0-melt) * 2.0; vec3 cold = vec3(0.1,0.2,1.0) * melt * 2.0; col = mix(hot, cold, melt) * diff; col += vec3(1.0)*pow(fres,3.0)*1.5; `,
      params: [],
    },
    {
      id: 'timedilated', name: 'Time Dilated', category: 'Mind-bending', kind: 'shader',
      swatch: ['#00ffff', '#ff00ff'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float distort = sin(t*2.0)*0.5+0.5; float hh = h + distort*0.2*sin(rad*10.0); float stripe = sin(hh*20.0 - t*8.0)*0.5+0.5; stripe = smoothstep(0.3,0.7,stripe); vec3 c1 = hsv2rgb(vec3(0.6+distort*0.3,1.0,1.0)); vec3 c2 = vec3(1.0); col = mix(c1, c2, stripe) * diff; col += vec3(1.0)*pow(fres,4.0)*1.2; alpha = stripe*0.9; `,
      params: [ { key: 'speed', label: 'Warp', type: 'range', min: 0, max: 4, step: 0.05, default: 2.0 } ],
    },
    {
      id: 'holographicnoise', name: 'Holographic Noise', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff8800', '#00ff88'], gravity: true,
      fragBody: AXIS + ` float t = u_time * u_speed; float n = fbm(vObjPos*6.0 + t*0.5); float hologram = sin(n*15.0)*0.5+0.5; vec3 c = hsv2rgb(vec3(fract(h*2.0+t*0.1), 1.0, 1.0)); col = c * hologram * 2.0 * diff; col += vec3(1.0)*pow(fres,4.0)*0.8; `,
      params: [ { key: 'speed', label: 'Shift', type: 'range', min: 0, max: 4, step: 0.05, default: 1.3 } ],
    },
    {
      id: 'crackedenergy', name: 'Cracked Energy', category: 'Mind-bending', kind: 'shader',
      swatch: ['#4400ff', '#ffaa00'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float crack = max(0.0, 1.0 - abs(sin(rad*10.0 + t*2.0)*0.5+0.5 - 0.8)*10.0); crack += max(0.0, 1.0 - abs(sin(rad*7.0 - t*1.5 + h*3.0)*0.5+0.5 - 0.8)*10.0); crack = clamp(crack, 0.0, 1.0); col = vec3(0.6,0.2,1.0) * crack * 2.0; col += vec3(1.0,0.5,0.2)*pow(fres,3.0)*1.5; alpha = crack*0.9; `,
      params: [ { key: 'speed', label: 'Charge', type: 'range', min: 0, max: 4, step: 0.05, default: 2.2 } ],
    },
    {
      id: 'warpcore', name: 'Warp Core', category: 'Mind-bending', kind: 'shader',
      swatch: ['#00ffff', '#ffffff'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float pulse = sin(rad*5.0 - t*3.0)*0.5+0.5; float intensity = pow(pulse, 4.0) * 3.0; col = vec3(0.2,1.0,1.0) * intensity; col += vec3(1.0)*pow(fres,4.0)*1.5; alpha = intensity*0.8; `,
      params: [ { key: 'speed', label: 'Throttle', type: 'range', min: 0, max: 4, step: 0.05, default: 2.5 } ],
    },
    {
      id: 'chromaticaberration', name: 'Chromatic Aberration', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff0000', '#00ff00'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float hNorm = (h - u_levMin)/(u_levMax - u_levMin); vec3 colR = vec3(1.0,0.2,0.2) * step(0.7, fbm(vObjPos*10.0 + hNorm*0.1 + t*0.1)); vec3 colG = vec3(0.2,1.0,0.2) * step(0.7, fbm(vObjPos*10.0 - hNorm*0.1 + t*0.1)); vec3 colB = vec3(0.2,0.2,1.0) * step(0.7, fbm(vObjPos*10.0 + t*0.1)); col = (colR+colG+colB)*1.5; alpha = max(max(colR.r,colG.g),colB.b)*0.9; `,
      params: [ { key: 'speed', label: 'Fringe', type: 'range', min: 0, max: 4, step: 0.05, default: 1.0 } ],
    },
    {
      id: 'particlestorm', name: 'Particle Storm', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff5500', '#111111'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float p = 0.0; for(int i=0; i<5; i++){ float fi = float(i); p += step(0.85, snoise(vObjPos* (10.0+fi*2.0) + vec3(fi*t*1.5, -fi*t*0.8, 0.0))); } col = vec3(1.0,0.4,0.1) * p * 2.0; alpha = p*0.8; `,
      params: [ { key: 'speed', label: 'Storm', type: 'range', min: 0, max: 4, step: 0.05, default: 2.3 } ],
    },
    {
      id: 'bubbleuniverse', name: 'Bubble Universe', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff00cc', '#00ffcc'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float bubbles = step(0.5, snoise(vObjPos*5.0 + t*0.3)); bubbles *= smoothstep(0.3, 0.5, fbm(vObjPos*3.0)); col = hsv2rgb(vec3(fract(rad*2.0 + t*0.1), 1.0, 1.0)) * bubbles * 2.0; col += vec3(1.0)*pow(fres,4.0)*0.5; alpha = bubbles*0.9; `,
      params: [ { key: 'speed', label: 'Fizz', type: 'range', min: 0, max: 4, step: 0.05, default: 1.0 } ],
    },
    {
      id: 'mandala', name: 'Mandala', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ffaa00', '#aa00ff'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float r = rad; float a = ang + t; float symmetry = 6.0; float pattern = sin(a*symmetry + r*10.0)*0.5+0.5; pattern = smoothstep(0.5,0.7,pattern); vec3 c1 = hsv2rgb(vec3(0.1+r*0.2+t*0.05,1.0,1.0)); col = c1 * pattern * 2.0 * diff; col += vec3(1.0)*pow(fres,3.0)*0.6; alpha = pattern*0.9; `,
      params: [ { key: 'speed', label: 'Rotate', type: 'range', min: 0, max: 4, step: 0.05, default: 1.0 } ],
    },
    {
      id: 'vaporwave', name: 'Vaporwave', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff80c0', '#80ff80'], gravity: true,
      fragBody: AXIS + ` float t = u_time * u_speed; float wave = sin(rad*3.0 - t*2.0 + h*5.0)*0.5+0.5; vec3 pastel1 = vec3(1.0, 0.5, 0.7); vec3 pastel2 = vec3(0.5, 1.0, 0.7); col = mix(pastel1, pastel2, wave) * diff; col += vec3(1.0)*pow(fres,2.0)*1.0; `,
      params: [ { key: 'speed', label: 'Chill', type: 'range', min: 0, max: 4, step: 0.05, default: 0.8 } ],
    },
    {
      id: 'cyberpunkgrid', name: 'Cyberpunk Grid', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff00ff', '#00ffff'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; vec3 g = fract(vObjPos * 4.0); float grid = min(min(step(0.9,g.x), step(0.9,g.y)), step(0.9,g.z)); grid = smoothstep(0.0,0.1,grid); col = vec3(1.0,0.2,1.0) * grid * 2.0; col += vec3(0.2,1.0,1.0)*pow(fres,5.0)*1.2; alpha = grid*0.9; `,
      params: [ { key: 'speed', label: 'Scan', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 } ],
    },
    {
      id: 'radiatedglow', name: 'Radiated Glow', category: 'Mind-bending', kind: 'shader',
      swatch: ['#00ff44', '#000000'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + ` float t = u_time * u_speed; float glow = exp(-rad * 5.0) * sin(t * 2.0 + h*10.0) * 0.5 + 0.5; glow *= smoothstep(0.0,0.2,glow); col = vec3(0.2,1.0,0.4) * glow * 2.0; alpha = glow*0.8; `,
      params: [ { key: 'speed', label: 'Pulse', type: 'range', min: 0, max: 4, step: 0.05, default: 1.7 } ],
    },
    {
      id: 'gelatinouscube', name: 'Gelatinous Cube', category: 'Mind-bending', kind: 'shader',
      swatch: ['#8affb0', '#0a4a2a'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + `
        float t = u_time * u_speed; float wobble = sin(rad * 4.0 + t * 2.0) * 0.2; float gel = fbm(vObjPos * 3.0 + t * 0.3 + wobble); float opacity = smoothstep(0.3, 0.7, gel) * 0.9; col = hsv2rgb(vec3(0.3 + gel * 0.2, 0.8, 1.0)) * opacity * 1.5; alpha = opacity;
      `,
      params: [ { key: 'speed', label: 'Wiggle', type: 'range', min: 0, max: 3, step: 0.05, default: 1.2 } ],
    },
    {
      id: 'electricarc', name: 'Electric Arc', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ffffff', '#0022ff'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + `
        float t = u_time * u_speed; float arc = 0.0; for(int i=0; i<3; i++){ float fi = float(i); arc += pow(max(0.0, 1.0 - abs(sin(rad*(7.0+fi*3.0)+t*2.0 + fi*1.2)*0.5+0.5 - 0.7)*15.0), 3.0); } arc = clamp(arc,0.0,1.0); col = vec3(0.8,0.9,1.0) * arc * 4.0; col += vec3(1.0)*pow(fres,5.0)*0.8; alpha = arc*0.95;
      `,
      params: [ { key: 'speed', label: 'Zap', type: 'range', min: 0, max: 4, step: 0.05, default: 2.5 } ],
    },
    {
      id: 'rainbowwave', name: 'Rainbow Wave', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff0066', '#00ffcc'], gravity: true,
      fragBody: AXIS + `
        float t = u_time * u_speed; float wave = sin(rad*6.0 + h*8.0 - t*4.0)*0.5+0.5; col = hsv2rgb(vec3(fract(h*2.0+t*0.1), 1.0, 1.0)) * wave * 2.0 * diff; col += vec3(1.0)*pow(fres,3.0)*1.2;
      `,
      params: [ { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 4, step: 0.05, default: 2.0 } ],
    },
    {
      id: 'phaseghost', name: 'Phase Ghost', category: 'Mind-bending', kind: 'shader',
      swatch: ['#d0f0ff', '#4a6a8a'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + `
        float t = u_time * u_speed; float phase = sin(t*3.0 + rad*10.0)*0.5+0.5; float v = fbm(vObjPos*2.0 + t*0.7); col = vec3(0.8,0.9,1.0) * v * phase * 2.0; alpha = v*phase*0.85;
      `,
      params: [ { key: 'speed', label: 'Phase', type: 'range', min: 0, max: 4, step: 0.05, default: 1.5 } ],
    },
    {
      id: 'wormhole', name: 'Wormhole', category: 'Mind-bending', kind: 'shader',
      swatch: ['#4400ff', '#ff00aa'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + `
        float r = rad;
        float a = ang + u_time * u_speed * 3.0 + r * 20.0;
        float tunnel = sin(a * 5.0) * 0.5 + 0.5;
        float rim = smoothstep(0.8, 1.0, r);
        vec3 col1 = hsv2rgb(vec3(0.7 + r * 0.2, 1.0, 1.0));
        vec3 col2 = hsv2rgb(vec3(0.9 + r * 0.3, 1.0, 0.8));
        col = mix(col1, col2, tunnel);
        col += vec3(1.0, 0.2, 0.5) * pow(rim, 2.0) * 2.0;
        alpha = clamp(tunnel * 0.8 + rim, 0.0, 1.0);
      `,
    },
    {
      id: 'fiberoptic', name: 'Fiber Optic', category: 'Mind-bending', kind: 'shader',
      swatch: ['#00ffcc', '#ff00ff'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + `
        float t = u_time * u_speed;
        float hNorm = (h - u_levMin) / (u_levMax - u_levMin);
        float s = sin(h * 30.0 + t * 5.0 + rad * 10.0) * 0.5 + 0.5;
        float bright = smoothstep(0.85, 1.0, s);
        vec3 c1 = hsv2rgb(vec3(hNorm * 0.8, 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(hNorm * 0.8 + 0.5, 1.0, 1.0));
        col = mix(c1, c2, bright) * bright * 3.0;
        col += vec3(1.0) * pow(fres, 3.0) * 1.5;
        alpha = bright * 0.9;
      `,
    },
    {
      id: 'neonpulse', name: 'Neon Pulse', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff00ff', '#00ffff'], gravity: true,
      fragBody: AXIS + `
        float t = u_time * u_speed;
        float pulse = sin(rad * 8.0 - t * 4.0) * 0.5 + 0.5;
        float ring = smoothstep(0.3, 0.4, pulse) * smoothstep(0.6, 0.5, pulse);
        vec3 c1 = hsv2rgb(vec3(fract(h * 1.5 + t * 0.1), 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(fract(h * 1.5 + 0.5 + t * 0.1), 1.0, 1.0));
        col = mix(c1, c2, ring) * (0.5 + diff * 0.5);
        col += vec3(1.0) * pow(fres, 3.0) * 2.0;
      `,
    },
    {
      id: 'echolocation', name: 'Echolocation', category: 'Mind-bending', kind: 'shader',
      swatch: ['#00ff00', '#000000'], gravity: true, transparent: true, additive: true, depthWrite: false,
      fragBody: AXIS + `
        float t = u_time * u_speed;
        float dist = rad;
        float wave = sin(dist * 30.0 - t * 8.0) * 0.5 + 0.5;
        float ring = smoothstep(0.45, 0.6, wave) * smoothstep(0.9, 0.8, dist);
        col = vec3(0.2, 1.0, 0.2) * ring * 2.0;
        col += vec3(0.8) * pow(fres, 4.0) * 0.5;
        alpha = ring * 0.8;
      `,
    },
    {
      id: 'liquidcrystal', name: 'Liquid Crystal', category: 'Mind-bending', kind: 'shader',
      swatch: ['#ff80c0', '#80ff80'], gravity: true, transparent: true, depthWrite: false,
      fragBody: AXIS + `
        float t = u_time * u_speed;
        float hNorm = (h - u_levMin) / (u_levMax - u_levMin);
        float n = fbm(vObjPos * 3.0 + t * 0.5);
        float swirl = sin(rad * 5.0 + h * 10.0 + t * 2.0 + n * 5.0) * 0.5 + 0.5;
        vec3 c1 = hsv2rgb(vec3(hNorm * 0.7 + n * 0.2, 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(hNorm * 0.7 + 0.5 + n * 0.2, 1.0, 1.0));
        col = mix(c1, c2, swirl) * (0.4 + diff * 0.6);
        col += vec3(1.0) * pow(fres, 3.0) * 1.2;
        alpha = 0.7 + swirl * 0.3;
      `,
    },
];