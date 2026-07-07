// ============================================================
// presets/wild-spooky-glitch.js — "Spooky & glitch" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
import { AXIS } from '../shader-glue.js';

export const WILD_SPOOKY_GLITCH = [
  {
        id: 'ghost',
        name: 'Ghost',
        category: 'Spooky & glitch',
        kind: 'shader',
        swatch: ['#aef4e8', '#1a3a4a'],
        transparent: true,
        additive: true,
        depthWrite: false,
        gravity: true,
        displaceParam: true,
        params: [{
                key: 'color',
                label: 'Ecto',
                type: 'color',
                default: '#8ae8d8'
            },
            {
                key: 'opacity',
                label: 'Presence',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.8
            },
            {
                key: 'displace',
                label: 'Waver',
                type: 'range',
                min: 0,
                max: 0.2,
                step: 0.005,
                default: 0.05
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
        fragUniforms: 'uniform vec3 u_color; uniform float u_opacity;',
        fragBody: AXIS + `
      float wisp = fbm(vObjPos * 2.2 + upA * (u_time * u_speed * 0.6));
      float fp = pow(fres, 1.6);
      col = u_color * (fp * 1.8 + (wisp * 0.5 + 0.5) * 0.35 * fp);
      alpha = clamp(fp * (0.65 + 0.35 * wisp), 0.0, 1.0) * u_opacity;
    `,
    },
  {
        id: 'glitch',
        name: 'Glitch / corrupt',
        category: 'Spooky & glitch',
        kind: 'shader',
        swatch: ['#ff2a6a', '#0a2a3a'],
        gravity: true,
        params: [{
                key: 'color',
                label: 'Base',
                type: 'color',
                default: '#1a7a8a'
            },
            {
                key: 'rows',
                label: 'Rows',
                type: 'range',
                min: 8,
                max: 80,
                step: 1,
                default: 32
            },
            {
                key: 'speed',
                label: 'Corrupt',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'coderain',
        name: 'Code rain',
        category: 'Spooky & glitch',
        kind: 'shader',
        swatch: ['#3aff6a', '#020a04'],
        gravity: true,
        params: [{
                key: 'color',
                label: 'Glyphs',
                type: 'color',
                default: '#2aff5e'
            },
            {
                key: 'cols',
                label: 'Columns',
                type: 'range',
                min: 8,
                max: 80,
                step: 1,
                default: 36
            },
            {
                key: 'speed',
                label: 'Rain',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'topo',
        name: 'Topographic',
        category: 'Spooky & glitch',
        kind: 'shader',
        swatch: ['#e8dcc4', '#5a4a2a'],
        params: [{
                key: 'base',
                label: 'Paper',
                type: 'color',
                default: '#efe6d2'
            },
            {
                key: 'color',
                label: 'Ink',
                type: 'color',
                default: '#4a3a20'
            },
            {
                key: 'scale',
                label: 'Terrain',
                type: 'range',
                min: 0.5,
                max: 8,
                step: 0.1,
                default: 2.5
            },
            {
                key: 'bands',
                label: 'Contours',
                type: 'range',
                min: 3,
                max: 30,
                step: 1,
                default: 12
            },
            {
                key: 'speed',
                label: 'Shift',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 0.5
            },
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
        id: 'magmacore',
        name: 'Magma core',
        category: 'Spooky & glitch',
        kind: 'shader',
        swatch: ['#ff6a1e', '#141012'],
        params: [{
                key: 'scale',
                label: 'Cracks',
                type: 'range',
                min: 1,
                max: 12,
                step: 0.1,
                default: 4
            },
            {
                key: 'speed',
                label: 'Pulse',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'voidrift',
        name: 'Void rift',
        category: 'Spooky & glitch',
        kind: 'shader',
        swatch: ['#ff00ff', '#000000'],
        params: [{
            key: 'speed',
            label: 'Tear',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1
        }, ],
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
        id: 'missingtex',
        name: 'Error 404',
        category: 'Spooky & glitch',
        kind: 'shader',
        swatch: ['#ff00ff', '#000000'],
        params: [{
            key: 'speed',
            label: 'Glitch',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }, ],
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
  {
        id: 'eldritch',
        name: 'Eldritch flesh',
        category: 'Spooky & glitch',
        kind: 'shader',
        swatch: ['#6a0a3a', '#1a0a0a'],
        displaceParam: true,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Vein',
                type: 'color',
                default: '#ff004a'
            },
            {
                key: 'scale',
                label: 'Pulse',
                type: 'range',
                min: 2,
                max: 12,
                step: 0.1,
                default: 5
            },
            {
                key: 'displace',
                label: 'Morph',
                type: 'range',
                min: 0,
                max: 0.3,
                step: 0.005,
                default: 0.1
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
        id: 'meatgrinder',
        name: 'Raw meat',
        category: 'Spooky & glitch',
        kind: 'shader',
        swatch: ['#aa0000', '#330000'],
        params: [{
            key: 'speed',
            label: 'Pulse',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1
        }, ],
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
  {
    id: 'glitch_art', name: 'Glitch Art', category: 'Spooky & glitch', kind: 'shader', swatch: ['#FF00FF', '#7f007f'],
    params: [
      { key: 'blockSize', label: 'Block Size', type: 'range', min: 0.01, max: 0.2, step: 0.01, default: 0.05 },
      { key: 'shiftAmount', label: 'Shift Amount', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'tearing', label: 'Tearing', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.3 },
      { key: 'colorSplit', label: 'Color Split', type: 'range', min: 0.0, max: 2.0, step: 0.01, default: 1.0 },
      { key: 'noiseLevel', label: 'Noise Level', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.2 },
    ],
    fragUniforms: `
      uniform float u_blockSize;
      uniform float u_shiftAmount;
      uniform float u_tearing;
      uniform float u_colorSplit;
      uniform float u_noiseLevel;
    `,
    fragBody: `
      vec2 uv = vUv;
      float blockY = floor(uv.y / u_blockSize) * u_blockSize;
      float rand = hash(blockY);
      float shift = (rand - 0.5) * u_shiftAmount * step(u_tearing, hash(blockY + 0.1));
      float colorShift = (rand - 0.5) * u_colorSplit * step(u_noiseLevel, hash(blockY + 0.2));
      vec2 glitchUV = uv;
      glitchUV.x += shift;
      float r = sin(glitchUV.x * 50.0) * 0.5 + 0.5;
      float g = sin((glitchUV.x + colorShift) * 50.0) * 0.5 + 0.5;
      float b = sin((glitchUV.x - colorShift) * 50.0) * 0.5 + 0.5;
      float noise = hash(vec2(floor(uv.y * 40.0), floor(uv.x * 40.0))) * u_noiseLevel;
      col = vec3(r, g, b) + noise;
      col = clamp(col, 0.0, 1.0);
      
    `,
  },
];
