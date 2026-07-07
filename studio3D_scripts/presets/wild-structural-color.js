// ============================================================
// presets/wild-structural-color.js — "Structural color" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
import { AXIS } from '../shader-glue.js';

export const WILD_STRUCTURAL_COLOR = [
  {
        id: 'morpho',
        name: 'Morpho Butterfly',
        category: 'Structural color',
        kind: 'shader',
        swatch: ['#0044ff', '#00aaff'],
        gravity: true,
        params: [{
                key: 'hueBase',
                label: 'Base Hue',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.58
            },
            {
                key: 'shift',
                label: 'Angle Shift',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.7
            },
            {
                key: 'ridge',
                label: 'Ridge Count',
                type: 'range',
                min: 3,
                max: 18,
                step: 1,
                default: 8
            },
            {
                key: 'sparkle',
                label: 'Sparkle',
                type: 'range',
                min: 0,
                max: 1.5,
                step: 0.02,
                default: 0.9
            },
            {
                key: 'speed',
                label: 'Drift',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 0.6
            },
        ],
        fragUniforms: 'uniform float u_hueBase; uniform float u_shift; uniform float u_ridge; uniform float u_sparkle;',
        fragBody: AXIS + `
      // Morpho butterfly: structural blue from nano-ridge interference
      // Model: parallel ridges diffract light; color depends on view angle
      float t = u_time * u_speed;
      float ridgePhase = ang * u_ridge + hn * 4.0;
      float ridge = pow(0.5 + 0.5 * sin(ridgePhase * 3.14159), 3.0);
      // View-angle-dependent hue shift (mimics thin-film interference)
      float viewAngle = fres; // already 0..1, grazing = 1
      float hue = u_hueBase + viewAngle * u_shift * 0.18;
      float sat = 0.7 + viewAngle * 0.3;
      float val = 0.25 + ridge * 0.65 + viewAngle * 0.2;
      vec3 structCol = hsv2rgb(vec3(fract(hue), sat, clamp(val, 0.0, 1.0)));
      // Micro-sparkle from individual scale facets
      float microFacet = pow(abs(snoise(vObjPos * 35.0 + vec3(t * 0.1, 0.0, t * 0.05))), 7.0);
      float spark = microFacet * ridge * u_sparkle;
      // Dark underlayer for contrast
      vec3 darkBase = vec3(0.02, 0.01, 0.04);
      col = darkBase * (1.0 - ridge) + structCol * ridge;
      col += vec3(1.0, 0.95, 0.7) * spark * 2.0;
      col += structCol * pow(fres, 3.0) * 0.55;
      // Subtle iridescent edge glow
      col += hsv2rgb(vec3(fract(hue + 0.15), 0.9, 0.7)) * pow(fres, 4.5) * 0.9;
    `,
    },
  {
        id: 'pearlescent',
        name: 'Nacre / Pearl',
        category: 'Structural color',
        kind: 'shader',
        swatch: ['#ffe8f0', '#c8a0d0'],
        gravity: true,
        params: [{
                key: 'baseTone',
                label: 'Base Tone',
                type: 'color',
                default: '#fae8f0'
            },
            {
                key: 'iridStr',
                label: 'Iridescence',
                type: 'range',
                min: 0,
                max: 1.5,
                step: 0.02,
                default: 1.0
            },
            {
                key: 'layers',
                label: 'Layer Count',
                type: 'range',
                min: 2,
                max: 10,
                step: 1,
                default: 5
            },
            {
                key: 'gloss',
                label: 'Gloss',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.7
            },
            {
                key: 'speed',
                label: 'Shimmer',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 0.5
            },
        ],
        fragUniforms: 'uniform vec3 u_baseTone; uniform float u_iridStr; uniform float u_layers; uniform float u_gloss;',
        fragBody: AXIS + `
      // Nacre: layered aragonite plates cause thin-film interference
      // Layer count controls how many "virtual layers" contribute
      float t = u_time * u_speed;
      vec3 iriAccum = vec3(0.0);
      float weightSum = 0.0;
      for (int i = 0; i < 10; i++) {
        if (float(i) >= u_layers) break;
        float fi = float(i);
        float depth = fi * 0.12;
        float phase = fres * 12.0 + depth * 8.0 + fi * 1.8;
        float w = exp(-fi * 0.35);
        vec3 layerCol = hsv2rgb(vec3(
          fract(0.08 + fres * 0.22 + fi * 0.03 + t * 0.02),
          0.45,
          0.55 + 0.45 * (0.5 + 0.5 * sin(phase))
        ));
        iriAccum += layerCol * w;
        weightSum += w;
      }
      vec3 iriCol = iriAccum / weightSum;
      // Soft diffuse base with pearlescent sheen
      vec3 base = u_baseTone * (0.4 + diff * 0.55);
      col = mix(base, iriCol, u_iridStr * 0.7);
      // High-gloss specular
      float spec = pow(max(dot(reflect(-V, N), KL), 0.0), 60.0);
      col += vec3(1.0) * spec * u_gloss * 1.8;
      col += iriCol * pow(fres, 2.5) * u_iridStr * 0.7;
    `,
    },
  {
        id: "oil_spill",
        name: "Oil Spill",
        category: "Structural color",
        kind: "shader",
        swatch: ["#0a0a0a", "#ff00cc"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "hueShift",
                label: "Hue Shift",
                type: "float",
                default: 0.0,
                min: 0.0,
                max: 1.0
            },
            {
                key: "iridescence",
                label: "Iridescence",
                type: "float",
                default: 1.0,
                min: 0.0,
                max: 2.0
            },
            {
                key: "noiseScale",
                label: "Noise Scale",
                type: "float",
                default: 3.0,
                min: 1.0,
                max: 10.0
            },
            {
                key: "flowSpeed",
                label: "Flow Speed",
                type: "float",
                default: 1.0,
                min: 0.1,
                max: 5.0
            },
            {
                key: "gloss",
                label: "Gloss",
                type: "float",
                default: 0.8,
                min: 0.0,
                max: 2.0
            }
        ],
        fragUniforms: `
      uniform float u_hueShift;
      uniform float u_iridescence;
      uniform float u_noiseScale;
      uniform float u_flowSpeed;
      uniform float u_gloss;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * u_noiseScale;
      uv.y += u_time * u_flowSpeed;
      float n = fbm(vec3(uv, 0.5));
      n = n * 0.5 + 0.5;
      float thickness = pow(n, 0.8) * u_iridescence;
      float hue = fract(thickness + u_hueShift + length(vObjPos) * 0.2);
      vec3 oilCol = hsv2rgb(vec3(hue, 0.9, 0.7));
      float spec = pow(max(0.0, dot(N, normalize(V + KL))), 60.0);
      spec *= u_gloss;
      vec3 base = vec3(0.02, 0.01, 0.04);
      col = mix(base, oilCol, thickness * 0.8 + 0.2) + spec * oilCol * 0.7;
      alpha = 1.0;
    `
    },
];
