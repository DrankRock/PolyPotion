// ============================================================
// presets/wild-biomimetic-organic.js — "Biomimetic & organic" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
import { AXIS } from '../shader-glue.js';

export const WILD_BIOMIMETIC_ORGANIC = [
  {
        id: 'dragonscales',
        name: 'Dragon Scales',
        category: 'Biomimetic & organic',
        kind: 'shader',
        swatch: ['#1a8a3a', '#ffd700'],
        gravity: true,
        params: [{
                key: 'color',
                label: 'Scale A',
                type: 'color',
                default: '#0f6b2e'
            },
            {
                key: 'color2',
                label: 'Scale B',
                type: 'color',
                default: '#ffcc33'
            },
            {
                key: 'irid',
                label: 'Iridescence',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.7
            },
            {
                key: 'scaleSz',
                label: 'Scale Size',
                type: 'range',
                min: 0.5,
                max: 6,
                step: 0.1,
                default: 2.5
            },
            {
                key: 'ridges',
                label: 'Ridge Sharpness',
                type: 'range',
                min: 1,
                max: 20,
                step: 0.5,
                default: 8
            },
            {
                key: 'speed',
                label: 'Shimmer',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 0.8
            },
        ],
        fragUniforms: 'uniform vec3 u_color; uniform vec3 u_color2; uniform float u_irid; uniform float u_scaleSz; uniform float u_ridges;',
        fragBody: AXIS + `
      // Hexagonal-ish scale tiling via angle + height warping
      float t = u_time * u_speed;
      float aWrap = ang * 3.0 / 3.14159;      // 3-fold symmetry
      float hWrap = hn * u_scaleSz * 2.5;
      float hex = sin(aWrap * 3.0) * sin(hWrap * 1.732); // approx hex lattice
      float ring = fract(aWrap + hWrap * 0.577);           // per-scale coord
      float ridge = pow(abs(sin(ring * 3.14159 * 2.0)), u_ridges);
      // Subsurface-like color blending
      float subSurf = fbm(vObjPos * u_scaleSz * 2.0 + vec3(t * 0.15, 0.0, t * 0.08));
      vec3 baseCol = mix(u_color, u_color2, ridge);
      // Iridescent shift based on view angle + surface normal
      float iridShift = fres * u_irid;
      vec3 iriCol = hsv2rgb(vec3(fract(0.12 + fres * 0.45 + subSurf * 0.1), 0.85, 0.5 + fres * 0.5));
      col = mix(baseCol, iriCol, iridShift) * (0.35 + diff * 0.7 + subSurf * 0.1);
      // Specular glint on ridge peaks
      float spec = pow(max(dot(reflect(-V, N), KL), 0.0), 40.0);
      col += vec3(1.0, 0.92, 0.55) * spec * ridge * 1.6;
      col += u_color2 * pow(fres, 3.0) * 0.4;
    `,
    },
  {
        id: 'turing',
        name: 'Turing Patterns',
        category: 'Biomimetic & organic',
        kind: 'shader',
        swatch: ['#ff6a9a', '#1a0a3a'],
        gravity: true,
        params: [{
                key: 'feed',
                label: 'Feed Rate',
                type: 'range',
                min: 0.01,
                max: 0.12,
                step: 0.001,
                default: 0.055
            },
            {
                key: 'kill',
                label: 'Kill Rate',
                type: 'range',
                min: 0.03,
                max: 0.18,
                step: 0.001,
                default: 0.062
            },
            {
                key: 'iter',
                label: 'Iterations',
                type: 'range',
                min: 1,
                max: 6,
                step: 1,
                default: 4
            },
            {
                key: 'scaleRd',
                label: 'Detail',
                type: 'range',
                min: 2,
                max: 15,
                step: 0.5,
                default: 6
            },
            {
                key: 'speed',
                label: 'Morph',
                type: 'range',
                min: 0,
                max: 2,
                step: 0.05,
                default: 0.5
            },
        ],
        fragUniforms: 'uniform float u_feed; uniform float u_kill; uniform float u_iter; uniform float u_scaleRd;',
        fragBody: AXIS + `
      // Reaction-diffusion (Gray-Scott style) approximated via iterative fbm
      // u_feed = F, u_kill = K — the classic Turing parameter space
      float t = u_time * u_speed;
      vec3 q = vObjPos * u_scaleRd;
      float u = fbm(q + vec3(t * 0.1, 0.0, 0.0));
      float v = fbm(q + vec3(0.0, 0.0, t * 0.1) + 3.7);
      // Crude iterative Laplacian-like blending
      for (int i = 0; i < 6; i++) {
        if (float(i) >= u_iter) break;
        float fi = float(i) * 0.15;
        float lapU = fbm(q * (1.0 + fi * 0.5) + vec3(t * 0.08 * fi, 0.0, 0.0));
        float lapV = fbm(q * (1.0 + fi * 0.5) + vec3(0.0, 0.0, t * 0.08 * fi) + 5.1);
        float uvv = u * v * v;
        u += (u_feed * (1.0 - u) - uvv + 0.012 * lapU) * 0.3;
        v += (uvv - (u_feed + u_kill) * v + 0.012 * lapV) * 0.3;
      }
      float spot = clamp(u * 0.7 + v * 0.3, 0.0, 1.0);
      float stripe = clamp(abs(u - v), 0.0, 1.0);
      float pattern = mix(spot, stripe, 0.45);
      // Map to rich organic palette
      vec3 lo = vec3(0.06, 0.01, 0.08);
      vec3 hiA = hsv2rgb(vec3(0.92, 0.9, 1.0));  // hot pink
      vec3 hiB = hsv2rgb(vec3(0.15, 0.9, 1.0));  // gold
      vec3 hi = mix(hiA, hiB, smoothstep(0.3, 0.7, pattern));
      col = mix(lo, hi, pattern) * (0.55 + diff * 0.6);
      col += hi * pow(fres, 2.5) * 0.9;
    `,
    },
  {
        id: 'bioluminescent',
        name: 'Bioluminescent Abyss',
        category: 'Biomimetic & organic',
        kind: 'shader',
        swatch: ['#001a2a', '#3affd8'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        params: [{
                key: 'baseDark',
                label: 'Abyss',
                type: 'color',
                default: '#00101e'
            },
            {
                key: 'glowA',
                label: 'Glow A',
                type: 'color',
                default: '#2effc8'
            },
            {
                key: 'glowB',
                label: 'Glow B',
                type: 'color',
                default: '#ff3a8a'
            },
            {
                key: 'density',
                label: 'Spot Density',
                type: 'range',
                min: 2,
                max: 18,
                step: 0.5,
                default: 7
            },
            {
                key: 'pulseSpd',
                label: 'Pulse Speed',
                type: 'range',
                min: 0,
                max: 4,
                step: 0.05,
                default: 1.5
            },
            {
                key: 'flicker',
                label: 'Flicker',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.6
            },
        ],
        fragUniforms: 'uniform vec3 u_baseDark; uniform vec3 u_glowA; uniform vec3 u_glowB; uniform float u_density; uniform float u_pulseSpd; uniform float u_flicker;',
        fragBody: AXIS + `
      float t = u_time * u_pulseSpd;
      // Organic spot field — scattered bioluminescent colonies
      float n1 = snoise(vObjPos * u_density + vec3(0.0, t * 0.3, 0.0));
      float n2 = snoise(vObjPos * u_density * 1.7 + vec3(t * 0.2, 0.0, 0.0) + 3.7);
      float n3 = snoise(vObjPos * u_density * 2.3 + vec3(0.0, 0.0, t * 0.25) + 7.1);
      // Multi-scale spot detection
      float spot = max(max(
        smoothstep(0.72, 0.88, n1),
        smoothstep(0.75, 0.90, n2)),
        smoothstep(0.78, 0.92, n3)
      );
      // Each spot pulses independently via secondary noise
      float pulsePhase = snoise(vObjPos * 3.0 + vec3(t * 0.7));
      float pulse = 0.55 + 0.45 * sin(t * 2.5 + pulsePhase * 8.0);
      // Flicker: random dropouts
      float flick = 1.0 - u_flicker * step(0.88, snoise(vObjPos * 45.0 + t * 30.0));
      float glow = spot * pulse * flick;
      // Depth haze: spots fade in the depths
      float depthAtten = 1.0 - pow(clamp(-dSurf / E, 0.0, 1.0) * 0.6, 1.5);
      // Blend between two bioluminescent colors
      float colorMix = snoise(vObjPos * 2.0 + vec3(0.0, 0.0, t * 0.1));
      vec3 glowCol = mix(u_glowA, u_glowB, smoothstep(-0.3, 0.3, colorMix));
      // Compose: dark base + glowing spots
      col = u_baseDark * (0.15 + diff * 0.3);
      col += glowCol * glow * depthAtten * 3.5;
      col += glowCol * pow(fres, 3.5) * 0.6;
      alpha = clamp(0.15 + glow * depthAtten * 0.85, 0.0, 1.0);
    `,
    },
  {
        id: "subsurface_scatter",
        name: "Subsurface Scatter",
        category: "Biomimetic & organic",
        kind: "shader",
        swatch: ["#ffccaa", "#ff8866"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "surfaceColor",
                label: "Surface Color",
                type: "color",
                default: "#f4a460"
            },
            {
                key: "subsurfaceColor",
                label: "Subsurface Color",
                type: "color",
                default: "#ff4500"
            },
            {
                key: "scatterDepth",
                label: "Scatter Depth",
                type: "float",
                default: 0.6,
                min: 0.1,
                max: 1.5
            },
            {
                key: "fuzziness",
                label: "Fuzziness",
                type: "float",
                default: 0.4,
                min: 0.0,
                max: 1.0
            },
            {
                key: "backlightStr",
                label: "Backlight Strength",
                type: "float",
                default: 0.7,
                min: 0.0,
                max: 2.0
            },
            {
                key: "radius",
                label: "Radius",
                type: "float",
                default: 0.5,
                min: 0.1,
                max: 1.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_surfaceColor;
      uniform vec3 u_subsurfaceColor;
      uniform float u_scatterDepth;
      uniform float u_fuzziness;
      uniform float u_backlightStr;
      uniform float u_radius;
    `,
        fragBody: `
      float NoL = max(0.0, dot(N, KL));
      float backLight = max(0.0, dot(N, -KL));
      float thickness = fbm(vec3(vWorldPos * 3.0, 0.2)) * u_radius;
      thickness += snoise(vec3(vWorldPos * 8.0, 0.7)) * u_fuzziness * 0.3;
      float scatter = exp(-thickness * u_scatterDepth);
      vec3 sssCol = u_subsurfaceColor * scatter * backLight * u_backlightStr;
      vec3 surface = u_surfaceColor * (NoL * 0.7 + 0.3);
      vec3 spec = pow(max(0.0, dot(N, normalize(V + KL))), 20.0) * 0.25;
      col = surface + sssCol + spec;
      col = mix(col, u_surfaceColor, 0.1 * u_fuzziness);
      alpha = 1.0;
    `
    },
  {
        id: "moss",
        name: "Moss",
        category: "Biomimetic & organic",
        kind: "shader",
        swatch: ["#2e4a22", "#1b2e0e"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "mossColor",
                label: "Moss Color",
                type: "color",
                default: "#3a5f2d"
            },
            {
                key: "baseColor",
                label: "Base Color",
                type: "color",
                default: "#4a3b32"
            },
            {
                key: "density",
                label: "Density",
                type: "float",
                default: 0.7,
                min: 0.0,
                max: 1.0
            },
            {
                key: "clumpSize",
                label: "Clump Size",
                type: "float",
                default: 3.0,
                min: 1.0,
                max: 8.0
            },
            {
                key: "humidity",
                label: "Humidity Sheen",
                type: "float",
                default: 0.4,
                min: 0.0,
                max: 1.0
            },
            {
                key: "coverage",
                label: "Coverage",
                type: "float",
                default: 0.6,
                min: 0.0,
                max: 1.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_mossColor;
      uniform vec3 u_baseColor;
      uniform float u_density;
      uniform float u_clumpSize;
      uniform float u_humidity;
      uniform float u_coverage;
    `,
        fragBody: `
      vec3 pos = vWorldPos * u_clumpSize;
      float n = fbm(vec3(pos.xy, 0.2)) * 0.6 + fbm(vec3(pos.xy * 2.0, 0.8)) * 0.4;
      float mossMask = smoothstep(0.4, 0.6, n) * u_coverage;
      mossMask *= smoothstep(0.2, 0.4, vWorldPos.y + 0.5) * u_density;
      vec3 mossCol = u_mossColor * (0.8 + 0.2 * fbm(vec3(pos.xy * 3.0, u_time * 0.02)));
      float mossSpec = pow(max(0.0, dot(N, normalize(V + KL))), 10.0) * u_humidity;
      col = mix(u_baseColor, mossCol, mossMask) * (diff * 0.7 + 0.4);
      col += mossSpec * u_mossColor * 0.3 * mossMask;
      alpha = 1.0;
    `
    },
  {
    id: 'snake_skin', name: 'Snake Skin', category: 'Biomimetic & organic', kind: 'shader', swatch: ['#556B2F', '#2a3517'],
    params: [
      { key: 'scaleSize', label: 'Scale Size', type: 'range', min: 0.5, max: 3.0, step: 0.01, default: 1.5 },
      { key: 'iridescence', label: 'Iridescence', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
      { key: 'patternComplexity', label: 'Pattern Complexity', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
      { key: 'colorShift', label: 'Color Shift', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.4 },
      { key: 'contrast', label: 'Contrast', type: 'range', min: 0.5, max: 2.0, step: 0.01, default: 1.0 },
    ],
    fragUniforms: `
      uniform float u_scaleSize;
      uniform float u_iridescence;
      uniform float u_patternComplexity;
      uniform float u_colorShift;
      uniform float u_contrast;
    `,
    fragBody: `
      vec2 uv = vUv * u_scaleSize;
      vec2 id = floor(uv);
      vec2 gv = fract(uv) - 0.5;
      float shape = length(gv) * 2.0;
      float hex = abs(gv.x) + abs(gv.y) * 0.7;
      float scale = mix(hex, shape, u_patternComplexity);

      float edge = 1.0 - smoothstep(0.35, 0.5, scale);
      float inner = smoothstep(0.15, 0.3, scale) * 0.6;
      float pattern = edge + inner;

      float hue = fract((id.x * 0.3 + id.y * 0.5) * 0.7 + u_time * 0.05 * u_colorShift);
      vec3 baseColor = hsv2rgb(vec3(hue, 0.6, 0.7));
      vec3 iri = hsv2rgb(vec3(fract(hue + 0.5), 0.8, 0.9));
      col = mix(baseColor, iri, u_iridescence * pattern);
      col = mix(vec3(0.5), col, u_contrast);
      
    `,
  },
  {
    id: 'sand_dollar', name: 'Sand Dollar', category: 'Biomimetic & organic', kind: 'shader', swatch: ['#F5DEB3', '#7a6f59'],
    params: [
      { key: 'size', label: 'Size', type: 'range', min: 0.5, max: 2.0, step: 0.01, default: 1.0 },
      { key: 'petalCount', label: 'Petal Count', type: 'range', min: 3, max: 8, step: 1, default: 5 },
      { key: 'ridgeDepth', label: 'Ridge Depth', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
      { key: 'textureNoise', label: 'Texture Noise', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.4 },
      { key: 'colorWarmth', label: 'Color Warmth', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
    ],
    fragUniforms: `
      uniform float u_size;
      uniform int u_petalCount;
      uniform float u_ridgeDepth;
      uniform float u_textureNoise;
      uniform float u_colorWarmth;
    `,
    fragBody: `
      vec2 uv = vUv - 0.5;
      float r = length(uv) * u_size;
      float a = atan(uv.y, uv.x);
      float petalCount = float(u_petalCount);
      float petal = sin(a * petalCount) * 0.5 + 0.5;
      float ridge = sin(r * 15.0) * 0.5 + 0.5;
      float shape = petal * ridge;
      shape = smoothstep(0.3, 0.7, shape) * u_ridgeDepth + (1.0 - u_ridgeDepth);
      float noise = snoise(vec3(uv * 5.0, 0.0)) * u_textureNoise;
      float pattern = min(1.0, shape + noise);
      col = mix(vec3(0.96, 0.87, 0.70), vec3(0.94, 0.81, 0.65), u_colorWarmth) * pattern;
      float edge = 1.0 - smoothstep(0.45, 0.5, r);
      col *= edge;
      
    `,
  },
  {
    id: 'jellyfish', name: 'Jellyfish', category: 'Biomimetic & organic', kind: 'shader', swatch: ['#E6E6FA', '#73737d'],
    transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'tentacleCount', label: 'Tentacle Count', type: 'range', min: 4, max: 16, step: 1, default: 8 },
      { key: 'waviness', label: 'Waviness', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
      { key: 'translucency', label: 'Translucency', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
      { key: 'colorCycle', label: 'Color Cycle', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.4 },
    ],
    fragUniforms: `
      uniform int u_tentacleCount;
      uniform float u_waviness;
      uniform float u_translucency;
      uniform float u_colorCycle;
      uniform float u_glow;
    `,
    fragBody: `
      vec2 uv = vUv - 0.5;
      float r = length(uv);
      float a = atan(uv.y, uv.x);
      float tentacleCount = float(u_tentacleCount);
      float tentacle = 1.0 - abs(sin(a * tentacleCount + u_time * 0.5) * 0.5 + 0.5);
      tentacle = smoothstep(0.0, 0.1, tentacle);
      float wave = sin(a * 4.0 + r * 20.0 - u_time * 3.0 * u_waviness) * 0.5 + 0.5;
      float opacity = tentacle * wave * u_translucency;
      float bell = smoothstep(0.5, 0.4, r) * 0.6;
      float edge = smoothstep(0.0, 0.1, r) * smoothstep(0.45, 0.5, r);
      float jelly = mix(opacity, bell, 0.6) * edge;
      jelly += u_glow * exp(-r * 5.0);
      col = hsv2rgb(vec3(fract(a / 6.28318 + u_time * 0.1 * u_colorCycle), 0.6, 1.0));
      col *= jelly;
      alpha = jelly;
    `,
  },
];
