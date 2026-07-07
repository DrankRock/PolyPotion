// ============================================================
// presets/wild-cyberpunk-neon.js — "Cyberpunk & neon" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
import { AXIS } from '../shader-glue.js';

export const WILD_CYBERPUNK_NEON = [
  {
        id: 'synthwave',
        name: 'Synthwave Sunset',
        category: 'Cyberpunk & neon',
        kind: 'shader',
        swatch: ['#ff0088', '#4400ff'],
        gravity: true,
        params: [{
                key: 'sunColor',
                label: 'Sun',
                type: 'color',
                default: '#ffaa00'
            },
            {
                key: 'skyHi',
                label: 'Sky Top',
                type: 'color',
                default: '#1a0044'
            },
            {
                key: 'skyLo',
                label: 'Sky Bot',
                type: 'color',
                default: '#ff0066'
            },
            {
                key: 'gridInt',
                label: 'Grid Intensity',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.7
            },
            {
                key: 'lines',
                label: 'Horizon Lines',
                type: 'range',
                min: 0,
                max: 8,
                step: 1,
                default: 4
            },
            {
                key: 'speed',
                label: 'Scroll',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 0.6
            },
        ],
        fragUniforms: 'uniform vec3 u_sunColor; uniform vec3 u_skyHi; uniform vec3 u_skyLo; uniform float u_gridInt; uniform float u_lines;',
        fragBody: AXIS + `
      float t = u_time * u_speed;
      // Synthwave: gradient sky with horizon, grid, and sun
      float horiz = smoothstep(0.35, 0.55, hn);
      vec3 sky = mix(u_skyLo, u_skyHi, horiz);
      // Sun disc near horizon
      float sunDist = length(pPerp - upA * (E * 0.4)) / E;
      float sun = exp(-sunDist * 4.5);
      float sunGlow = exp(-sunDist * 1.2) * 0.35;
      // Persistent perspective grid on the ground half
      float gridH = smoothstep(0.0, 0.5, hn);
      float gridLine = abs(fract(rad * 6.0) - 0.5) * 2.0;
      float gridHori = abs(fract(hn * 20.0 - t * 0.4) - 0.5) * 2.0;
      float grid = (1.0 - smoothstep(0.04, 0.0, gridLine)) * gridH;
      grid += (1.0 - smoothstep(0.03, 0.0, gridHori)) * gridH;
      grid = clamp(grid, 0.0, 1.0) * u_gridInt;
      // Horizon cut lines
      float cutLine = 0.0;
      for (int i = 0; i < 8; i++) {
        if (float(i) >= u_lines) break;
        float fi = float(i);
        cutLine += 1.0 - smoothstep(0.005, 0.0, abs(hn - (0.5 + fi * 0.05)));
      }
      cutLine = clamp(cutLine, 0.0, 1.0);
      // Compose
      col = sky;
      col += u_sunColor * sun * 2.5;
      col += u_sunColor * sunGlow * 0.8;
      col += u_skyLo * grid * 0.9;
      col += vec3(1.0, 0.2, 0.5) * cutLine * 1.5;
      col *= 0.4 + diff * 0.6;
      col += u_sunColor * pow(fres, 3.0) * 0.5;
    `,
    },
  {
        id: 'vhsglitch',
        name: 'VHS Tracking',
        category: 'Cyberpunk & neon',
        kind: 'shader',
        swatch: ['#ff55aa', '#111111'],
        gravity: true,
        params: [{
                key: 'trackErr',
                label: 'Tracking Error',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.5
            },
            {
                key: 'staticA',
                label: 'Static Amount',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.35
            },
            {
                key: 'colorBleed',
                label: 'Color Bleed',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.6
            },
            {
                key: 'scanlines',
                label: 'Scanlines',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.8
            },
            {
                key: 'speed',
                label: 'Jitter',
                type: 'range',
                min: 0,
                max: 4,
                step: 0.05,
                default: 1.8
            },
        ],
        fragUniforms: 'uniform float u_trackErr; uniform float u_staticA; uniform float u_colorBleed; uniform float u_scanlines;',
        fragBody: AXIS + `
      float t = u_time * u_speed;
      // VHS: scanlines, tracking tearing, chroma bleed, static
      float scanline = sin(hn * 400.0) * 0.5 + 0.5;
      float scanMask = 0.75 + 0.25 * scanline * u_scanlines;
      // Tracking: horizontal bands of corruption
      float track = snoise(vec3(0.0, hn * 8.0 + t * 0.9, t * 4.0));
      float tear = smoothstep(0.82, 0.95, track) * u_trackErr;
      // Color channel displacement (chroma bleed)
      float rOff = u_colorBleed * 0.025 * snoise(vec3(hn * 30.0, t * 12.0, 0.0));
      float bOff = u_colorBleed * 0.025 * snoise(vec3(hn * 30.0, t * 12.0, 3.3));
      // Sample "image" via fbm (simulates recorded content)
      vec3 pR = vObjPos + upA * rOff;
      vec3 pB = vObjPos + upA * bOff;
      float imgR = fbm(pR * 3.0 + vec3(t * 0.15, 0.0, 0.0));
      float imgG = fbm(vObjPos * 3.0 + vec3(0.0, t * 0.15, 0.0));
      float imgB = fbm(pB * 3.0 + vec3(0.0, 0.0, t * 0.15));
      vec3 img = vec3(imgR, imgG, imgB) * 0.5 + 0.5;
      // Static snow
      float snow = snoise(vObjPos * 60.0 + t * 55.0) * 0.5 + 0.5;
      snow = smoothstep(0.65, 0.8, snow) * u_staticA;
      // Color-shifted fringe on tears
      vec3 tearCol = vec3(1.0, 0.1, 0.3) * tear;
      // Compose
      col = img * scanMask * (0.5 + diff * 0.5);
      col += vec3(snow);
      col += tearCol;
      col += vec3(0.8, 0.2, 0.6) * pow(fres, 4.0) * 0.4;
    `,
    },
  {
        id: "neon_circuits",
        name: "Neon Circuits",
        category: "Cyberpunk & neon",
        kind: "shader",
        swatch: ["#0d0221", "#00ffff"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "circuitColor",
                label: "Circuit Color",
                type: "color",
                default: "#00ffff"
            },
            {
                key: "baseDark",
                label: "Dark Base",
                type: "color",
                default: "#050510"
            },
            {
                key: "density",
                label: "Density",
                type: "float",
                default: 0.5,
                min: 0.1,
                max: 2.0
            },
            {
                key: "pulseSpeed",
                label: "Pulse Speed",
                type: "float",
                default: 1.0,
                min: 0.1,
                max: 5.0
            },
            {
                key: "glowFalloff",
                label: "Glow Falloff",
                type: "float",
                default: 1.0,
                min: 0.5,
                max: 3.0
            },
            {
                key: "sparkle",
                label: "Sparkle",
                type: "float",
                default: 0.5,
                min: 0.0,
                max: 1.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_circuitColor;
      uniform vec3 u_baseDark;
      uniform float u_density;
      uniform float u_pulseSpeed;
      uniform float u_glowFalloff;
      uniform float u_sparkle;
    `,
        fragBody: `
      vec3 pos = vWorldPos * 0.5;
      vec2 uv = pos.xy * u_density;

      float trace = 0.0;
      float node = 0.0;
      float t = u_time * u_pulseSpeed;

      for (int i = 0; i < 4; i++) {
        float fi = float(i) + 1.0;
        vec2 offset = vec2(snoise(vec3(fi * 13.7, 0.0, 0.0)), snoise(vec3(fi * 17.3, 0.0, 0.0))) * 2.0;
        vec2 p = uv + offset + vec2(snoise(vec3(uv, fi * 23.1 + t * 0.1)), snoise(vec3(uv, fi * 29.7 + t * 0.13)));
        float d = abs(sin(p.x * 3.14159) * cos(p.y * 3.14159));
        d = 1.0 - smoothstep(0.0, 0.05, d) * smoothstep(0.15, 0.12, d);
        trace += d * 0.25;
        float nd = length(fract(p * 2.0) - 0.5);
        node += (1.0 - smoothstep(0.05, 0.15, nd)) * (0.5 + 0.5 * sin(t * 5.0 + fi));
      }
      trace = clamp(trace, 0.0, 1.0);
      node = clamp(node, 0.0, 1.0) * u_sparkle;

      vec3 glow = u_circuitColor * (trace * 1.5 + node * 2.0) * u_glowFalloff;
      float diffuseLit = diff * 0.2 + 0.8;
      col = mix(u_baseDark, glow, trace + node) * diffuseLit;
      col += glow * 0.2;
      alpha = 1.0;
    `
    },
  {
        id: "hologram",
        name: "Hologram",
        category: "Cyberpunk & neon",
        kind: "shader",
        swatch: ["#00ffff", "#ff00ff"],
        transparent: true,
        additive: true,
        depthWrite: false,
        params: [{
                key: "baseTint",
                label: "Base Tint",
                type: "color",
                default: "#88ccff"
            },
            {
                key: "shimmerColor",
                label: "Shimmer Color",
                type: "color",
                default: "#ffffff"
            },
            {
                key: "scanlineCnt",
                label: "Scanline Count",
                type: "float",
                default: 30.0,
                min: 5.0,
                max: 80.0
            },
            {
                key: "interferenceScale",
                label: "Interference Scale",
                type: "float",
                default: 10.0,
                min: 1.0,
                max: 30.0
            },
            {
                key: "opacity",
                label: "Opacity",
                type: "float",
                default: 0.6,
                min: 0.1,
                max: 1.0
            },
            {
                key: "flickerSpd",
                label: "Flicker Speed",
                type: "float",
                default: 1.0,
                min: 0.1,
                max: 5.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_baseTint;
      uniform vec3 u_shimmerColor;
      uniform float u_scanlineCnt;
      uniform float u_interferenceScale;
      uniform float u_opacity;
      uniform float u_flickerSpd;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * u_interferenceScale;
      float t = u_time * u_flickerSpd;
      float scanline = sin(vWorldPos.y * u_scanlineCnt * 3.14159) * 0.5 + 0.5;
      scanline = scanline * 0.7 + 0.3;
      float interference = sin(uv.x * 8.0 + t) * cos(uv.y * 6.0 - t * 0.7);
      vec3 holoCol = u_baseTint * scanline;
      holoCol += u_shimmerColor * interference * 0.3;
      float rOffset = snoise(vec3(vWorldPos.xy, t)) * 0.02;
      col = holoCol * 0.8;
      col += holoCol * 0.2 * snoise(vec3(vWorldPos.xy * 4.0, t * 0.5));
      alpha = u_opacity * (0.6 + 0.4 * scanline) * clamp(interference + 0.5, 0.0, 1.0);
    `
    },
  {
    id: 'neon_lights', name: 'Neon Lights', category: 'Cyberpunk & neon', kind: 'shader', swatch: ['#FF1493', '#7f0a49'],
    transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'tubeSpacing', label: 'Tube Spacing', type: 'range', min: 0.5, max: 3.0, step: 0.01, default: 1.0 },
      { key: 'glowIntensity', label: 'Glow Intensity', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.8 },
      { key: 'speed', label: 'Speed', type: 'range', min: 0.0, max: 2.0, step: 0.01, default: 1.0 },
      { key: 'colorVariation', label: 'Color Variation', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
      { key: 'blurWidth', label: 'Blur Width', type: 'range', min: 0.05, max: 0.8, step: 0.01, default: 0.3 },
    ],
    fragUniforms: `
      uniform float u_tubeSpacing;
      uniform float u_glowIntensity;
      uniform float u_speed;
      uniform float u_colorVariation;
      uniform float u_blurWidth;
    `,
    fragBody: `
      vec2 uv = vUv;
      float y = uv.y;
      float tube = abs(sin(y * 15.0 * u_tubeSpacing + u_time * u_speed)) < u_blurWidth ? 1.0 : 0.0;
      float glow = exp(-abs(sin(y * 15.0 * u_tubeSpacing + u_time * u_speed)) * 5.0 / u_blurWidth) * u_glowIntensity;
      float hue = fract(y * u_colorVariation + u_time * 0.1);
      col = hsv2rgb(vec3(hue, 1.0, 1.0)) * (tube + glow);
      alpha = (col.r + col.g + col.b > 0.0 ? 1.0 : 0.0);
    `,
  },
];
