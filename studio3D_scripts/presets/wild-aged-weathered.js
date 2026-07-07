// ============================================================
// presets/wild-aged-weathered.js — "Aged & weathered" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
import { AXIS } from '../shader-glue.js';

export const WILD_AGED_WEATHERED = [
  {
        id: 'patina',
        name: 'Oxidized Bronze',
        category: 'Aged & weathered',
        kind: 'shader',
        swatch: ['#3a8a6a', '#5a3a1a'],
        gravity: true,
        params: [{
                key: 'bronze',
                label: 'Bronze',
                type: 'color',
                default: '#8a5e3a'
            },
            {
                key: 'patinaClr',
                label: 'Patina',
                type: 'color',
                default: '#3a9a7a'
            },
            {
                key: 'age',
                label: 'Age',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.55
            },
            {
                key: 'pitting',
                label: 'Pitting',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.4
            },
            {
                key: 'scaleV',
                label: 'Verdigris Scale',
                type: 'range',
                min: 1,
                max: 10,
                step: 0.1,
                default: 3.5
            },
            {
                key: 'speed',
                label: 'Drip',
                type: 'range',
                min: 0,
                max: 2,
                step: 0.05,
                default: 0.3
            },
        ],
        fragUniforms: 'uniform vec3 u_bronze; uniform vec3 u_patinaClr; uniform float u_age; uniform float u_pitting; uniform float u_scaleV;',
        fragBody: AXIS + `
      float t = u_time * u_speed;
      // Streaky verdigris flowing down
      float streak = fbm(vObjPos * u_scaleV + upA * (t * 0.4));
      // Pitting via sharp voronoi-like noise
      float pit = pow(abs(snoise(vObjPos * 8.0)), 14.0);
      float pitMask = smoothstep(0.3, 0.95, pit) * u_pitting;
      // Height-based aging: patina accumulates in crevices (low hn) and drips down
      float crevice = 1.0 - smoothstep(0.2, 0.7, hn + streak * 0.25);
      float patina = clamp(crevice * u_age + pitMask * 0.25, 0.0, 1.0);
      // Make it granular / crusty
      float crust = fbm(vObjPos * 6.0 + vec3(streak * 2.0, 0.0, 0.0));
      patina *= 0.7 + 0.3 * crust;
      // Metallic bronze base
      float metalSpec = pow(max(dot(reflect(-V, N), KL), 0.0), 25.0);
      vec3 bronzeCol = u_bronze * (0.35 + diff * 0.55) + vec3(1.0, 0.78, 0.45) * metalSpec * 0.9;
      vec3 patCol = u_patinaClr * (0.4 + diff * 0.5) + vec3(0.7, 0.95, 0.8) * pow(fres, 2.5) * 0.5;
      col = mix(bronzeCol, patCol, patina);
      col += u_bronze * pow(fres, 4.0) * 0.3;
    `,
    },
  {
        id: 'corrosion',
        name: 'Rusted Iron',
        category: 'Aged & weathered',
        kind: 'shader',
        swatch: ['#8a3a1a', '#3a3a3a'],
        gravity: true,
        params: [{
                key: 'rust',
                label: 'Rust Color',
                type: 'color',
                default: '#b8451e'
            },
            {
                key: 'iron',
                label: 'Bare Iron',
                type: 'color',
                default: '#4a4a52'
            },
            {
                key: 'decay',
                label: 'Decay',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.65
            },
            {
                key: 'flakeSz',
                label: 'Flake Size',
                type: 'range',
                min: 1,
                max: 10,
                step: 0.5,
                default: 4
            },
            {
                key: 'rough',
                label: 'Roughness',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.6
            },
            {
                key: 'speed',
                label: 'Creep',
                type: 'range',
                min: 0,
                max: 2,
                step: 0.05,
                default: 0.2
            },
        ],
        fragUniforms: 'uniform vec3 u_rust; uniform vec3 u_iron; uniform float u_decay; uniform float u_flakeSz; uniform float u_rough;',
        fragBody: AXIS + `
      float t = u_time * u_speed;
      // Multi-octave rust map: large patches + fine granularity
      float rustLarge = fbm(vObjPos * u_flakeSz * 0.7 + vec3(t * 0.1, 0.0, 0.0));
      float rustFine  = fbm(vObjPos * u_flakeSz * 2.5 + vec3(0.0, t * 0.15, 0.0));
      float edgeRust  = pow(fres, 1.8); // rust starts at edges
      float rustMap   = clamp(rustLarge * 0.6 + rustFine * 0.3 + edgeRust * 0.2, 0.0, 1.0);
      float rustMask  = smoothstep(0.35, 0.55 + (1.0 - u_decay) * 0.3, rustMap);
      // Flaking: sharp cracks where rust meets iron
      float flakeCrack = pow(abs(snoise(vObjPos * u_flakeSz * 3.0)), 12.0);
      float flake = flakeCrack * rustMask * u_decay;
      // Iron has specular highlights; rust is matte
      float ironSpec = pow(max(dot(reflect(-V, N), KL), 0.0), 30.0) * (1.0 - u_rough);
      vec3 ironCol = u_iron * (0.3 + diff * 0.6) + vec3(1.0) * ironSpec * 0.7;
      vec3 rustCol = u_rust * (0.35 + diff * 0.45);
      // Rust gets darker / crustier in crevices
      rustCol *= 0.7 + 0.3 * (1.0 - rustFine);
      col = mix(ironCol, rustCol, rustMask);
      // Bright orange edge where fresh rust flakes are exposing
      col += u_rust * 1.3 * flake * 0.6;
      col += u_rust * pow(fres, 3.5) * 0.2;
    `,
    },
  {
        id: "cracked_earth",
        name: "Cracked Earth",
        category: "Aged & weathered",
        kind: "shader",
        swatch: ["#8b5a2b", "#3e2723"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "dryColor",
                label: "Dry Color",
                type: "color",
                default: "#c8a96e"
            },
            {
                key: "crackColor",
                label: "Crack Color",
                type: "color",
                default: "#2d1c15"
            },
            {
                key: "crackWidth",
                label: "Crack Width",
                type: "float",
                default: 0.3,
                min: 0.1,
                max: 1.0
            },
            {
                key: "crackDensity",
                label: "Crack Density",
                type: "float",
                default: 2.0,
                min: 0.5,
                max: 5.0
            },
            {
                key: "dustAmount",
                label: "Dust Amount",
                type: "float",
                default: 0.3,
                min: 0.0,
                max: 1.0
            },
            {
                key: "age",
                label: "Age",
                type: "float",
                default: 0.7,
                min: 0.0,
                max: 1.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_dryColor;
      uniform vec3 u_crackColor;
      uniform float u_crackWidth;
      uniform float u_crackDensity;
      uniform float u_dustAmount;
      uniform float u_age;
    `,
        fragBody: `
      vec3 pos = vWorldPos * u_crackDensity;
      float n = fbm(vec3(pos.xy * 1.8, 0.3));
      float ridge = fbm(vec3(pos.xy * 3.2, 1.7));
      float crackMask = smoothstep(u_crackWidth, u_crackWidth + 0.05, abs(ridge - 0.5) * 2.0);
      crackMask *= 1.0 - smoothstep(0.4, 0.6, n);
      float dustNoise = snoise(vec3(pos.xy * 8.0, u_time * 0.05)) * 0.5 + 0.5;
      float dust = dustNoise * u_dustAmount * (1.0 - crackMask);
      vec3 soil = mix(u_dryColor, u_crackColor, crackMask);
      soil = mix(soil, u_dryColor * 1.1, dust * u_age);
      vec3 finalCol = soil * (diff * 0.7 + 0.4);
      col = finalCol;
      alpha = 1.0;
    `
    },
  {
    id: 'cave_painting', name: 'Cave Painting', category: 'Aged & weathered', kind: 'shader', swatch: ['#A0522D', '#502916'],
    params: [
      { key: 'rockRoughness', label: 'Rock Roughness', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
      { key: 'pigmentDensity', label: 'Pigment Density', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'ochreHue', label: 'Ochre Hue', type: 'range', min: 0.0, max: 0.5, step: 0.01, default: 0.15 },
      { key: 'crackDepth', label: 'Crack Depth', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.4 },
      { key: 'age', label: 'Age', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
    ],
    fragUniforms: `
      uniform float u_rockRoughness;
      uniform float u_pigmentDensity;
      uniform float u_ochreHue;
      uniform float u_crackDepth;
      uniform float u_age;
    `,
    fragBody: `
      vec2 uv = vUv;
      float rock = snoise(vec3(uv * 10.0, 0.0)) * u_rockRoughness;
      rock += snoise(vec3(uv * 25.0, 1.0)) * 0.3;
      rock = rock * 0.5 + 0.5;

      float pigment = snoise(vec3(uv * 15.0 + 5.0, 2.0)) * u_pigmentDensity;
      pigment = smoothstep(0.2, 0.8, pigment);

      vec3 ochre = hsv2rgb(vec3(u_ochreHue, 0.7, 0.6));
      vec3 baseCol = mix(vec3(0.6, 0.55, 0.45), ochre, pigment);

      float crack = abs(snoise(vec3(uv * 25.0, 3.0)));
      crack = smoothstep(0.5 - u_crackDepth * 0.3, 0.5, crack);

      float age = snoise(vec3(uv * 5.0, 4.0)) * u_age;
      col = baseCol * (1.0 - crack * 0.7) * (1.0 - age * 0.5);
      col = clamp(col, 0.0, 1.0);
      
    `,
  },
];
