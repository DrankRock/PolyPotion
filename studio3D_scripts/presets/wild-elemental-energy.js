// ============================================================
// presets/wild-elemental-energy.js — "Elemental & energy" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
export const WILD_ELEMENTAL_ENERGY = [
  {
        id: "molten",
        name: "Molten",
        category: "Elemental & energy",
        kind: "shader",
        swatch: ["#ff4500", "#ffd700"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "hotColor",
                label: "Hot Color",
                type: "color",
                default: "#ff6600"
            },
            {
                key: "coolColor",
                label: "Cool Color",
                type: "color",
                default: "#330000"
            },
            {
                key: "temperature",
                label: "Temperature",
                type: "float",
                default: 0.8,
                min: 0.0,
                max: 1.5
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
                key: "bumpStrength",
                label: "Bump Strength",
                type: "float",
                default: 0.5,
                min: 0.0,
                max: 1.0
            },
            {
                key: "glowFalloff",
                label: "Glow Falloff",
                type: "float",
                default: 0.6,
                min: 0.1,
                max: 2.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_hotColor;
      uniform vec3 u_coolColor;
      uniform float u_temperature;
      uniform float u_flowSpeed;
      uniform float u_bumpStrength;
      uniform float u_glowFalloff;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * 2.5;
      float t = u_time * u_flowSpeed;
      float displ = fbm(vec3(uv + vec2(0.0, t * 0.7), 0.5)) * u_bumpStrength;
      displ += snoise(vec3(uv * 3.0 + vec2(0.0, t * 1.2), 0.9)) * u_bumpStrength * 0.4;
      float tempMap = u_temperature * (0.6 + 0.4 * displ);
      tempMap = clamp(tempMap, 0.0, 1.0);
      vec3 blackbody = mix(vec3(0.6, 0.2, 0.05), vec3(1.0, 0.85, 0.1), tempMap);
      if (tempMap > 0.7) blackbody = mix(blackbody, vec3(1.0, 0.95, 0.6), (tempMap - 0.7) * 5.0);
      vec3 lava = mix(u_coolColor, u_hotColor * blackbody, tempMap);
      float spec = pow(max(0.0, dot(N, normalize(V + KL))), 30.0);
      spec *= smoothstep(0.3, 0.7, tempMap);
      vec3 glow = u_hotColor * displ * u_glowFalloff;
      col = lava * (diff * 0.6 + 0.5) + spec * 0.8 + glow * 0.3;
      alpha = 1.0;
    `
    },
  {
        id: "flame",
        name: "Flame",
        category: "Elemental & energy",
        kind: "shader",
        swatch: ["#ff4500", "#ffd700"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "baseColor",
                label: "Base Color",
                type: "color",
                default: "#ff8c00"
            },
            {
                key: "tipColor",
                label: "Tip Color",
                type: "color",
                default: "#ffff00"
            },
            {
                key: "turbulence",
                label: "Turbulence",
                type: "float",
                default: 1.0,
                min: 0.2,
                max: 2.0
            },
            {
                key: "speed",
                label: "Speed",
                type: "float",
                default: 1.0,
                min: 0.1,
                max: 4.0
            },
            {
                key: "soot",
                label: "Soot",
                type: "float",
                default: 0.15,
                min: 0.0,
                max: 0.5
            },
            {
                key: "brightness",
                label: "Brightness",
                type: "float",
                default: 1.2,
                min: 0.5,
                max: 2.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_baseColor;
      uniform vec3 u_tipColor;
      uniform float u_turbulence;
      uniform float u_speed;
      uniform float u_soot;
      uniform float u_brightness;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * 2.0;
      float t = u_time * u_speed;
      float y = vWorldPos.y * 0.8 + 0.5;
      float noise = fbm(vec3(uv * 1.5 + vec2(0.0, t * 0.8), 0.5)) * u_turbulence;
      noise += snoise(vec3(uv * 3.0 + vec2(0.0, t * 1.3), 0.9)) * u_turbulence * 0.5;
      float shape = (1.0 - y) * (1.0 + noise * 0.5);
      shape = clamp(shape, 0.0, 1.0);
      vec3 flameCol = mix(u_baseColor, u_tipColor, y * shape);
      float sootLayer = smoothstep(0.1, 0.3, noise) * u_soot * (1.0 - y);
      flameCol = mix(flameCol, vec3(0.02, 0.02, 0.02), sootLayer);
      float intensity = shape * u_brightness;
      col = flameCol * intensity * (diff * 0.5 + 0.6);
      alpha = 1.0;
    `
    },
  {
    id: 'plasma_globe', name: 'Plasma Globe', category: 'Elemental & energy', kind: 'shader', swatch: ['#9400D3', '#4a0069'],
    transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'speed', label: 'Speed', type: 'range', min: 0.0, max: 3.0, step: 0.01, default: 1.0 },
      { key: 'intensity', label: 'Intensity', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
      { key: 'rayCount', label: 'Ray Count', type: 'range', min: 1, max: 8, step: 1, default: 3 },
      { key: 'colorScheme', label: 'Color Scheme', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'distortion', label: 'Distortion', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.4 },
    ],
    fragUniforms: `
      uniform float u_speed;
      uniform float u_intensity;
      uniform int u_rayCount;
      uniform float u_colorScheme;
      uniform float u_distortion;
    `,
    fragBody: `
      vec2 uv = vUv - 0.5;
      float r = length(uv);
      float a = atan(uv.y, uv.x);
      float angleShift = a + u_time * u_speed * 0.2;
      float rayCount = float(u_rayCount);
      float ray = sin(angleShift * rayCount) * 0.5 + 0.5;
      ray = smoothstep(0.2, 0.8, ray);

      float dist = 1.0 - r;
      float arc = sin((r * 10.0 - u_time * u_speed) * 2.0) * 0.5 + 0.5;
      arc = smoothstep(0.4, 0.6, arc);

      float centerGlow = exp(-r * 5.0) * 0.8;
      float plasma = (ray * arc * u_intensity + centerGlow) * step(0.0, dist);

      col = mix(
        hsv2rgb(vec3(fract(a / 6.28318 + u_colorScheme * 0.7), 0.9, 1.0)),
        vec3(0.8, 0.6, 1.0),
        0.5
      );
      col *= plasma;
      alpha = plasma;
    `,
  },
  {
    id: 'electric_arc', name: 'Electric Arc', category: 'Elemental & energy', kind: 'shader', swatch: ['#00FFFF', '#007f7f'],
    transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'arcDensity', label: 'Arc Density', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
      { key: 'branching', label: 'Branching', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'glow', label: 'Glow', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.8 },
      { key: 'color', label: 'Color', type: 'color', default: '#00FFFF' },
      { key: 'flicker', label: 'Flicker', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.3 },
    ],
    fragUniforms: `
      uniform float u_arcDensity;
      uniform float u_branching;
      uniform float u_glow;
      uniform float u_color;
      uniform float u_flicker;
    `,
    fragBody: `
      vec2 uv = vUv;
      float t = u_time * (1.0 + sin(u_time * 10.0) * u_flicker);
      float arc = 0.0;
      vec2 p = uv * 2.0 - 1.0;
      for (int i = 0; i < 5; i++) {
        float offset = float(i) * 0.3;
        float x = p.x;
        float y = p.y + sin(x * 8.0 + t + offset) * 0.2;
        float d = abs(y) - 0.02 * u_branching;
        d = 1.0 - smoothstep(0.0, 0.02, d);
        arc += d * u_arcDensity * 0.2;

        y = p.y + cos(x * 15.0 + t * 1.3) * 0.15;
        d = abs(y) - 0.01;
        arc += (1.0 - smoothstep(0.0, 0.02, d)) * 0.1 * u_branching;
      }
      arc = clamp(arc, 0.0, 1.0);

      float glow = exp(-length(p) * 3.0) * u_glow;
      col = hsv2rgb(vec3(u_color, 0.9, 1.0)) * (arc + glow);
      alpha = (arc + glow > 0.0 ? 1.0 : 0.0);
    `,
  },
];
