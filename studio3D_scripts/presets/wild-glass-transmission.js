// ============================================================
// presets/wild-glass-transmission.js — "Glass & transmission" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
export const WILD_GLASS_TRANSMISSION = [
  {
        id: "stained_glass",
        name: "Stained Glass",
        category: "Glass & transmission",
        kind: "shader",
        swatch: ["#000000", "#ffcc00"],
        transparent: true,
        additive: false,
        depthWrite: false,
        params: [{
                key: "leadColor",
                label: "Lead Color",
                type: "color",
                default: "#222222"
            },
            {
                key: "glassOpacity",
                label: "Glass Opacity",
                type: "float",
                default: 0.85,
                min: 0.2,
                max: 1.0
            },
            {
                key: "panelScale",
                label: "Panel Scale",
                type: "float",
                default: 4.0,
                min: 1.0,
                max: 10.0
            },
            {
                key: "hueVar",
                label: "Hue Variation",
                type: "float",
                default: 0.6,
                min: 0.0,
                max: 1.0
            },
            {
                key: "brightness",
                label: "Brightness",
                type: "float",
                default: 1.2,
                min: 0.5,
                max: 2.0
            },
            {
                key: "specular",
                label: "Specular",
                type: "float",
                default: 0.5,
                min: 0.0,
                max: 1.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_leadColor;
      uniform float u_glassOpacity;
      uniform float u_panelScale;
      uniform float u_hueVar;
      uniform float u_brightness;
      uniform float u_specular;
    `,
        fragBody: `
      vec2 st = vWorldPos.xy * u_panelScale;
      vec2 i_st = floor(st);
      vec2 f_st = fract(st);
      float minDist = 1.0;
      for (int m = -1; m <= 1; m++) {
        for (int n = -1; n <= 1; n++) {
          vec2 neighbor = vec2(float(m), float(n));
          vec2 point = vec2(
            snoise(vec3(i_st + neighbor, 0.0)),
            snoise(vec3(i_st + neighbor, 1.0))
          ) * 0.5 + 0.5;
          vec2 diff = neighbor + point - f_st;
          float d = dot(diff, diff);
          minDist = min(minDist, d);
        }
      }
      float cellIndex = snoise(vec3(i_st, 2.0)) * 0.5 + 0.5;
      float hue = fract(cellIndex * u_hueVar + u_time * 0.01);
      vec3 glassCol = hsv2rgb(vec3(hue, 0.6, 0.7 * u_brightness));
      float border = 1.0 - smoothstep(0.0, 0.08, sqrt(minDist));
      vec3 baseCol = mix(glassCol, u_leadColor, border);
      float spec = pow(max(0.0, dot(N, normalize(V + KL))), 40.0) * u_specular;
      col = baseCol * (diff * 0.7 + 0.4) + spec * glassCol * 0.4;
      alpha = mix(u_glassOpacity, 1.0, border);
    `
    },
  {
        id: "caustics",
        name: "Caustics",
        category: "Glass & transmission",
        kind: "shader",
        swatch: ["#003344", "#88ccff"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "depth",
                label: "Depth",
                type: "float",
                default: 1.0,
                min: 0.1,
                max: 3.0
            },
            {
                key: "intensity",
                label: "Intensity",
                type: "float",
                default: 1.0,
                min: 0.0,
                max: 2.0
            },
            {
                key: "waveFreq",
                label: "Wave Frequency",
                type: "float",
                default: 2.0,
                min: 0.5,
                max: 8.0
            },
            {
                key: "sharpness",
                label: "Caustic Sharpness",
                type: "float",
                default: 0.7,
                min: 0.1,
                max: 1.5
            },
            {
                key: "dispersion",
                label: "Color Dispersion",
                type: "float",
                default: 0.3,
                min: 0.0,
                max: 1.0
            }
        ],
        fragUniforms: `
      uniform float u_depth;
      uniform float u_intensity;
      uniform float u_waveFreq;
      uniform float u_sharpness;
      uniform float u_dispersion;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * u_waveFreq;
      float t = u_time;
      float n1 = snoise(vec3(uv + vec2(0.0, t * 0.3), 0.5));
      float n2 = snoise(vec3(uv * 1.7 - vec2(t * 0.2, 0.0), 0.9));
      float ddx = n1 - snoise(vec3(uv + vec2(0.01, 0.0), 0.5));
      float ddy = n1 - snoise(vec3(uv + vec2(0.0, 0.01), 0.5));
      float curvature = abs(ddx) + abs(ddy);
      float disp = u_dispersion * 0.01;
      float causticR = 1.0 - smoothstep(0.0, u_sharpness, abs(snoise(vec3(uv + disp, 0.5)) - curvature));
      float causticG = 1.0 - smoothstep(0.0, u_sharpness, abs(snoise(vec3(uv, 0.6)) - curvature));
      float causticB = 1.0 - smoothstep(0.0, u_sharpness, abs(snoise(vec3(uv - disp, 0.7)) - curvature));
      float mask = (causticR + causticG + causticB) * 0.33;
      vec3 causticCol = vec3(causticR, causticG, causticB) * u_intensity;
      vec3 waterCol = vec3(0.0, 0.1, 0.2) * u_depth;
      col = waterCol + causticCol * 1.5;
      alpha = 1.0;
    `
    },
  {
        id: "cracked_glass",
        name: "Cracked Glass",
        category: "Glass & transmission",
        kind: "shader",
        swatch: ["#aaddff", "#ffffff"],
        transparent: true,
        additive: false,
        depthWrite: false,
        params: [{
                key: "glassTint",
                label: "Glass Tint",
                type: "color",
                default: "#cceeff"
            },
            {
                key: "crackDensity",
                label: "Crack Density",
                type: "float",
                default: 1.5,
                min: 0.5,
                max: 4.0
            },
            {
                key: "crackWidth",
                label: "Crack Width",
                type: "float",
                default: 0.03,
                min: 0.01,
                max: 0.1
            },
            {
                key: "refractionStr",
                label: "Refraction Strength",
                type: "float",
                default: 0.15,
                min: 0.0,
                max: 0.4
            },
            {
                key: "stressIntensity",
                label: "Stress Intensity",
                type: "float",
                default: 0.5,
                min: 0.0,
                max: 1.0
            },
            {
                key: "shine",
                label: "Shine",
                type: "float",
                default: 1.0,
                min: 0.0,
                max: 2.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_glassTint;
      uniform float u_crackDensity;
      uniform float u_crackWidth;
      uniform float u_refractionStr;
      uniform float u_stressIntensity;
      uniform float u_shine;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * u_crackDensity;
      float t = u_time * 0.05;
      float crack = 0.0;
      vec2 seed = vec2(snoise(vec3(floor(uv), 0.0)), snoise(vec3(floor(uv), 1.0)));
      vec2 f = fract(uv) - 0.5;
      float dist = length(f - seed * 0.5);
      crack = 1.0 - smoothstep(u_crackWidth, u_crackWidth + 0.02, dist);
      float stress = snoise(vec3(uv * 0.5, t)) * u_stressIntensity;
      crack += stress * 0.3;
      vec3 refractN = N + vec3(snoise(vec3(vWorldPos.xy * 10.0, t)), snoise(vec3(vWorldPos.xy * 10.0, t + 1.0)), 0.0) * u_refractionStr;
      refractN = normalize(refractN);
      float spec = pow(max(0.0, dot(refractN, normalize(V + KL))), 100.0) * u_shine;
      vec3 glassCol = u_glassTint * (0.7 + 0.3 * fres);
      float alphaCrack = clamp(crack, 0.0, 1.0);
      col = mix(glassCol, vec3(1.0), spec);
      alpha = mix(0.15, 0.95, alphaCrack);
    `
    },
  {
    id: 'frosted_glass', name: 'Frosted Glass', category: 'Glass & transmission', kind: 'shader', swatch: ['#E0FFFF', '#707f7f'],
    transparent: true,
    params: [
      { key: 'frostRoughness', label: 'Frost Roughness', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
      { key: 'scatterStrength', label: 'Scatter Strength', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'tint', label: 'Tint', type: 'color', default: '#E0FFFF' },
      { key: 'speckleSize', label: 'Speckle Size', type: 'range', min: 0.1, max: 1.0, step: 0.01, default: 0.3 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
    ],
    fragUniforms: `
      uniform float u_frostRoughness;
      uniform float u_scatterStrength;
      uniform vec3 u_tint;
      uniform float u_speckleSize;
      uniform float u_opacity;
    `,
    fragBody: `
      vec2 uv = vUv;
      float noise = snoise(vec3(uv * 50.0 * u_speckleSize, 0.0)) * u_frostRoughness;
      noise += snoise(vec3(uv * 30.0, 1.0)) * 0.3;
      float scatter = snoise(vec3(uv * 20.0, 2.0)) * u_scatterStrength;
      alpha = mix(0.3, 0.9, u_opacity) * (noise * 0.7 + 0.3);
      col = mix(vec3(0.9, 0.95, 1.0), u_tint, 0.3) + scatter * 0.2;
      
    `,
  },
];
