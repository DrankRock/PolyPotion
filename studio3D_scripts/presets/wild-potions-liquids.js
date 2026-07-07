// ============================================================
// presets/wild-potions-liquids.js — "Potions & liquids" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
import { AXIS, LIQ, GLASS_ABOVE } from '../shader-glue.js';

export const WILD_POTIONS_LIQUIDS = [
  {
        id: 'potion',
        name: 'Potion (gravity)',
        category: 'Potions & liquids',
        kind: 'shader',
        swatch: ['#c46bff', '#3a0e6e'],
        transparent: true,
        depthWrite: false,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Liquid',
                type: 'color',
                default: '#a53aff'
            },
            {
                key: 'glow',
                label: 'Glow',
                type: 'color',
                default: '#ff8ae0'
            },
            {
                key: 'fill',
                label: 'Fill',
                type: 'range',
                min: 0.02,
                max: 0.98,
                step: 0.01,
                default: 0.62
            },
            {
                key: 'bubbles',
                label: 'Bubbles',
                type: 'range',
                min: 2,
                max: 20,
                step: 0.5,
                default: 9
            },
            {
                key: 'speed',
                label: 'Fizz',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'poison',
        name: 'Poison vial',
        category: 'Potions & liquids',
        kind: 'shader',
        swatch: ['#7dff3a', '#123c05'],
        transparent: true,
        depthWrite: false,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Venom',
                type: 'color',
                default: '#4fdc1e'
            },
            {
                key: 'glow',
                label: 'Fume',
                type: 'color',
                default: '#c8ff5a'
            },
            {
                key: 'fill',
                label: 'Fill',
                type: 'range',
                min: 0.02,
                max: 0.98,
                step: 0.01,
                default: 0.55
            },
            {
                key: 'speed',
                label: 'Boil',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'lovepotion',
        name: 'Love potion',
        category: 'Potions & liquids',
        kind: 'shader',
        swatch: ['#ff9ad2', '#b0125f'],
        transparent: true,
        depthWrite: false,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Blush',
                type: 'color',
                default: '#ff5aa8'
            },
            {
                key: 'color2',
                label: 'Swirl',
                type: 'color',
                default: '#ffc4e8'
            },
            {
                key: 'fill',
                label: 'Fill',
                type: 'range',
                min: 0.02,
                max: 0.98,
                step: 0.01,
                default: 0.7
            },
            {
                key: 'speed',
                label: 'Swirl',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'galaxyjar',
        name: 'Bottled galaxy',
        category: 'Potions & liquids',
        kind: 'shader',
        swatch: ['#7a8dff', '#12083a'],
        transparent: true,
        depthWrite: false,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Glass',
                type: 'color',
                default: '#8a9aff'
            },
            {
                key: 'fill',
                label: 'Fill',
                type: 'range',
                min: 0.02,
                max: 0.98,
                step: 0.01,
                default: 0.8
            },
            {
                key: 'scale',
                label: 'Nebula',
                type: 'range',
                min: 1,
                max: 8,
                step: 0.1,
                default: 3
            },
            {
                key: 'speed',
                label: 'Drift',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'lavalamp',
        name: 'Lava lamp',
        category: 'Potions & liquids',
        kind: 'shader',
        swatch: ['#ff7a3a', '#4a0a5e'],
        transparent: true,
        depthWrite: false,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Fluid',
                type: 'color',
                default: '#5a1470'
            },
            {
                key: 'color2',
                label: 'Blob',
                type: 'color',
                default: '#ff6a2a'
            },
            {
                key: 'fill',
                label: 'Fill',
                type: 'range',
                min: 0.02,
                max: 0.98,
                step: 0.01,
                default: 0.9
            },
            {
                key: 'speed',
                label: 'Rise',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'melting',
        name: 'Melting / drip',
        category: 'Potions & liquids',
        kind: 'shader',
        swatch: ['#ffd9a0', '#a85a1e'],
        gravity: true,
        params: [{
                key: 'color',
                label: 'Wax',
                type: 'color',
                default: '#f2b56a'
            },
            {
                key: 'sag',
                label: 'Melt',
                type: 'range',
                min: 0,
                max: 0.45,
                step: 0.005,
                default: 0.2
            },
            {
                key: 'speed',
                label: 'Ooze',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 0.6
            },
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
        id: 'acidbath',
        name: 'Acid bath',
        category: 'Potions & liquids',
        kind: 'shader',
        swatch: ['#ccff00', '#1a2200'],
        transparent: true,
        depthWrite: false,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Acid',
                type: 'color',
                default: '#a5ff00'
            },
            {
                key: 'fill',
                label: 'Fill',
                type: 'range',
                min: 0.02,
                max: 0.98,
                step: 0.01,
                default: 0.6
            },
            {
                key: 'speed',
                label: 'Boil',
                type: 'range',
                min: 0,
                max: 4,
                step: 0.05,
                default: 1.5
            },
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
        id: 'cthulhublood',
        name: 'Cthulhu blood',
        category: 'Potions & liquids',
        kind: 'shader',
        swatch: ['#6a00b0', '#1a0022'],
        transparent: true,
        depthWrite: false,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Ichor',
                type: 'color',
                default: '#8000ff'
            },
            {
                key: 'fill',
                label: 'Fill',
                type: 'range',
                min: 0.02,
                max: 0.98,
                step: 0.01,
                default: 0.7
            },
            {
                key: 'speed',
                label: 'Throb',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
];
