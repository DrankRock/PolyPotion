// ============================================================
// presets/wild-candy-crystal.js — "Candy & crystal" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { AXIS } from '../shader-glue.js';

export const WILD_CANDY_CRYSTAL = [
  {
        id: 'candy',
        name: 'Candy shell',
        category: 'Candy & crystal',
        kind: 'physical',
        swatch: ['#ff5abb', '#8a1250'],
        params: [{
                key: 'color',
                label: 'Candy',
                type: 'color',
                default: '#ff2f9e',
                apply: (m, v) => m.color.set(v)
            },
            {
                key: 'roughness',
                label: 'Gloss',
                type: 'range',
                min: 0,
                max: 0.6,
                step: 0.01,
                default: 0.12,
                apply: (m, v) => {
                    m.roughness = v;
                }
            },
        ],
        make: () => new THREE.MeshPhysicalMaterial({
            color: 0xff2f9e,
            metalness: 0,
            roughness: 0.12,
            clearcoat: 1,
            clearcoatRoughness: 0.03,
            envMapIntensity: 1.2,
            side: THREE.DoubleSide
        }),
    },
  {
        id: 'soapbubble',
        name: 'Soap bubble',
        category: 'Candy & crystal',
        kind: 'physical',
        swatch: ['#d0f0ff', '#c39ae0'],
        params: [{
                key: 'iridescence',
                label: 'Film',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 1,
                apply: (m, v) => {
                    m.iridescence = v;
                }
            },
            {
                key: 'ior',
                label: 'Thin-ness',
                type: 'range',
                min: 1,
                max: 1.6,
                step: 0.01,
                default: 1.1,
                apply: (m, v) => {
                    m.ior = v;
                }
            },
        ],
        make: () => new THREE.MeshPhysicalMaterial({
            transmission: 1,
            thickness: 0.05,
            roughness: 0.02,
            metalness: 0,
            ior: 1.1,
            iridescence: 1,
            iridescenceIOR: 1.3,
            transparent: true,
            side: THREE.DoubleSide,
            envMapIntensity: 1.3
        }),
    },
  {
        id: 'lollipop',
        name: 'Lollipop swirl',
        category: 'Candy & crystal',
        kind: 'shader',
        swatch: ['#ff4a4a', '#fff3e0'],
        gravity: true,
        params: [{
                key: 'color',
                label: 'Stripe A',
                type: 'color',
                default: '#ff3a3a'
            },
            {
                key: 'color2',
                label: 'Stripe B',
                type: 'color',
                default: '#fff2e2'
            },
            {
                key: 'arms',
                label: 'Stripes',
                type: 'range',
                min: 2,
                max: 12,
                step: 1,
                default: 4
            },
            {
                key: 'twist',
                label: 'Twist',
                type: 'range',
                min: 0,
                max: 4,
                step: 0.1,
                default: 1.4
            },
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
        id: 'disco',
        name: 'Disco ball',
        category: 'Candy & crystal',
        kind: 'shader',
        swatch: ['#f0f4ff', '#5a5e8a'],
        params: [{
                key: 'facets',
                label: 'Facets',
                type: 'range',
                min: 4,
                max: 24,
                step: 1,
                default: 10
            },
            {
                key: 'speed',
                label: 'Party',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'ice',
        name: 'Glacier ice',
        category: 'Candy & crystal',
        kind: 'shader',
        swatch: ['#d8f4ff', '#1a5e8a'],
        params: [{
            key: 'scale',
            label: 'Cracks',
            type: 'range',
            min: 1,
            max: 12,
            step: 0.1,
            default: 5
        }, ],
        fragUniforms: 'uniform float u_scale;',
        fragBody: `
      float crack = pow(1.0 - abs(snoise(vObjPos * u_scale)), 11.0);
      float glint = pow(max(snoise(vObjPos * 30.0), 0.0), 9.0);
      col = mix(vec3(0.10, 0.28, 0.42), vec3(0.85, 0.95, 1.0), clamp(0.35 + 0.35 * diff + pow(fres, 2.0) * 0.6, 0.0, 1.0));
      col += vec3(1.0) * crack * 0.5 + vec3(1.0) * glint * 1.4;
    `,
    },
  {
        id: 'gemstone',
        name: 'Faceted gem',
        category: 'Candy & crystal',
        kind: 'shader',
        swatch: ['#4affd2', '#0a4a6e'],
        params: [{
                key: 'color',
                label: 'Stone',
                type: 'color',
                default: '#18c8a8'
            },
            {
                key: 'fire',
                label: 'Fire',
                type: 'range',
                min: 0,
                max: 1.5,
                step: 0.02,
                default: 0.8
            },
            {
                key: 'speed',
                label: 'Shimmer',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'tesseract',
        name: 'Quantum tesseract',
        category: 'Candy & crystal',
        kind: 'shader',
        swatch: ['#00ffff', '#000033'],
        transparent: true,
        depthWrite: false,
        additive: true,
        params: [{
            key: 'speed',
            label: 'Shift',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1
        }, ],
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
  {
        id: "crystal_lattice",
        name: "Crystal Lattice",
        category: "Candy & crystal",
        kind: "shader",
        swatch: ["#ee82ee", "#ffffff"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "baseHue",
                label: "Base Hue",
                type: "float",
                default: 0.8,
                min: 0.0,
                max: 1.0
            },
            {
                key: "facetScale",
                label: "Facet Scale",
                type: "float",
                default: 6.0,
                min: 2.0,
                max: 20.0
            },
            {
                key: "impurity",
                label: "Impurity",
                type: "float",
                default: 0.2,
                min: 0.0,
                max: 1.0
            },
            {
                key: "growthRings",
                label: "Growth Rings",
                type: "float",
                default: 0.4,
                min: 0.0,
                max: 1.0
            },
            {
                key: "specHard",
                label: "Specular Hardness",
                type: "float",
                default: 80.0,
                min: 10.0,
                max: 200.0
            },
            {
                key: "internalGlow",
                label: "Internal Glow",
                type: "float",
                default: 0.15,
                min: 0.0,
                max: 0.5
            }
        ],
        fragUniforms: `
      uniform float u_baseHue;
      uniform float u_facetScale;
      uniform float u_impurity;
      uniform float u_growthRings;
      uniform float u_specHard;
      uniform float u_internalGlow;
    `,
        fragBody: `
      vec3 p = vWorldPos * u_facetScale;
      vec3 p_fract = fract(p) - 0.5;
      vec3 p_floor = floor(p);
      float seed = snoise(vec3(p_floor, 0.3));
      float impurityNoise = snoise(vec3(p_floor * 2.0, 0.9)) * u_impurity;
      float hue = fract(u_baseHue + impurityNoise * 0.4);
      vec3 crystalCol = hsv2rgb(vec3(hue, 0.5, 0.9));
      float ring = 1.0 - abs(snoise(vec3(p * 0.3, u_time * 0.05)) * u_growthRings);
      crystalCol = mix(crystalCol, crystalCol * 0.8, ring);
      float facet = max(max(abs(p_fract.x), abs(p_fract.y)), abs(p_fract.z));
      float facetMask = 1.0 - smoothstep(0.4, 0.45, facet);
      vec3 facetN = faceforward(vec3(1.0, 0.0, 0.0), V, N);
      float spec = pow(max(0.0, dot(N, normalize(V + KL))), u_specHard);
      spec *= facetMask * 0.8;
      vec3 glow = crystalCol * u_internalGlow;
      col = crystalCol * (diff * 0.5 + 0.5) + spec * 1.2 + glow;
      alpha = 1.0;
    `
    },
  {
        id: "marble",
        name: "Marble",
        category: "Candy & crystal",
        kind: "shader",
        swatch: ["#f5f5dc", "#2f4f4f"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "stoneColor",
                label: "Stone Color",
                type: "color",
                default: "#f0ead6"
            },
            {
                key: "veinColor",
                label: "Vein Color",
                type: "color",
                default: "#3b3b3b"
            },
            {
                key: "veinScale",
                label: "Vein Scale",
                type: "float",
                default: 2.0,
                min: 0.5,
                max: 5.0
            },
            {
                key: "sharpness",
                label: "Vein Sharpness",
                type: "float",
                default: 0.5,
                min: 0.1,
                max: 1.0
            },
            {
                key: "polish",
                label: "Polish",
                type: "float",
                default: 0.8,
                min: 0.0,
                max: 1.5
            },
            {
                key: "turbulence",
                label: "Turbulence",
                type: "float",
                default: 0.6,
                min: 0.0,
                max: 1.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_stoneColor;
      uniform vec3 u_veinColor;
      uniform float u_veinScale;
      uniform float u_sharpness;
      uniform float u_polish;
      uniform float u_turbulence;
    `,
        fragBody: `
      vec3 p = vWorldPos * u_veinScale;
      float n = fbm(vec3(p.xy, 0.3) + vec3(snoise(vec3(p.xy * u_turbulence, 0.7)), 0.0, 0.0));
      n = abs(n * 2.0 - 1.0);
      n = 1.0 - pow(n, u_sharpness * 3.0);
      vec3 marbleCol = mix(u_stoneColor, u_veinColor, n);
      float spec = pow(max(0.0, dot(N, normalize(V + KL))), 60.0) * u_polish;
      col = marbleCol * (diff * 0.6 + 0.5) + spec * 0.7;
      alpha = 1.0;
    `
    },
  {
    id: 'geode', name: 'Geode Crystal', category: 'Candy & crystal', kind: 'shader', swatch: ['#DA70D6', '#6d386b'],
    params: [
      { key: 'crystalDensity', label: 'Crystal Density', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.8 },
      { key: 'facetSharpness', label: 'Facet Sharpness', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
      { key: 'colorShift', label: 'Color Shift', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'cavityDepth', label: 'Cavity Depth', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0.0, max: 0.5, step: 0.01, default: 0.2 },
    ],
    fragUniforms: `
      uniform float u_crystalDensity;
      uniform float u_facetSharpness;
      uniform float u_colorShift;
      uniform float u_cavityDepth;
      uniform float u_glow;
    `,
    fragBody: `
      vec2 uv = vUv;
      vec2 center = vec2(0.5, 0.5);
      float dist = length(uv - center) * 2.0;
      float cavity = smoothstep(0.2, 0.5, dist) * u_cavityDepth;
      float angle = atan(uv.y - center.y, uv.x - center.x);
      float crystals = abs(sin(angle * 8.0)) * u_crystalDensity;
      crystals += abs(sin(dist * 15.0)) * 0.3;
      crystals = pow(crystals, u_facetSharpness * 3.0);
      float pattern = crystals * (1.0 - cavity * 0.7);
      col = hsv2rgb(vec3(fract(angle / 6.28318 * u_colorShift), 0.8, 0.9));
      col *= pattern;
      col += u_glow * vec3(0.7, 0.2, 0.7) * (1.0 - dist);
      
    `,
  },
];
