// ============================================================
// presets/wild-radiant-cosmic.js — "Radiant & cosmic" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
import { AXIS } from '../shader-glue.js';

export const WILD_RADIANT_COSMIC = [
  {
        id: 'aura',
        name: 'Radiant pulse',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#5affd8', '#0a4a5e'],
        transparent: true,
        additive: true,
        depthWrite: false,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Aura',
                type: 'color',
                default: '#4affd0'
            },
            {
                key: 'rings',
                label: 'Rings',
                type: 'range',
                min: 1,
                max: 12,
                step: 0.5,
                default: 5
            },
            {
                key: 'opacity',
                label: 'Opacity',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.9
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
        fragUniforms: 'uniform vec3 u_color; uniform float u_rings; uniform float u_opacity;',
        fragBody: AXIS + `
      float r = length(vObjPos) / E;
      float ring = pow(0.5 + 0.5 * sin((r * u_rings - u_time * u_speed * 1.4) * 6.2831), 8.0);
      col = u_color * (ring * 2.2 + pow(fres, 1.8) * 0.8);
      alpha = clamp(ring * 0.9 + pow(fres, 1.8) * 0.5, 0.0, 1.0) * u_opacity;
    `,
    },
  {
        id: 'heartbeat',
        name: 'Heartbeat',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#ff4a5e', '#3a0510'],
        params: [{
                key: 'base',
                label: 'Flesh',
                type: 'color',
                default: '#40141c'
            },
            {
                key: 'color',
                label: 'Pulse',
                type: 'color',
                default: '#ff3a52'
            },
            {
                key: 'scale',
                label: 'Veins',
                type: 'range',
                min: 1,
                max: 10,
                step: 0.1,
                default: 4
            },
            {
                key: 'speed',
                label: 'BPM',
                type: 'range',
                min: 0.2,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'sonar',
        name: 'Sonar ping',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#3aff8a', '#03251a'],
        transparent: true,
        additive: true,
        depthWrite: false,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Ping',
                type: 'color',
                default: '#3aff8a'
            },
            {
                key: 'speed',
                label: 'Sweep',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'radioactive',
        name: 'Radioactive',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#b6ff2a', '#1a2a05'],
        params: [{
                key: 'base',
                label: 'Sludge',
                type: 'color',
                default: '#1e2a10'
            },
            {
                key: 'color',
                label: 'Isotope',
                type: 'color',
                default: '#a8ff1e'
            },
            {
                key: 'scale',
                label: 'Cracks',
                type: 'range',
                min: 1,
                max: 12,
                step: 0.1,
                default: 5
            },
            {
                key: 'speed',
                label: 'Decay',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'portal',
        name: 'Portal vortex',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#8a3aff', '#ff8a3a'],
        gravity: true,
        params: [{
                key: 'color',
                label: 'Void',
                type: 'color',
                default: '#180830'
            },
            {
                key: 'hue',
                label: 'Hue',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.75
            },
            {
                key: 'arms',
                label: 'Arms',
                type: 'range',
                min: 1,
                max: 8,
                step: 1,
                default: 3
            },
            {
                key: 'speed',
                label: 'Spin',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'soulfire',
        name: 'Soul fire',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#5ad2ff', '#0a1a4a'],
        transparent: true,
        additive: true,
        depthWrite: false,
        gravity: true,
        params: [{
                key: 'color',
                label: 'Flame',
                type: 'color',
                default: '#3ab8ff'
            },
            {
                key: 'scale',
                label: 'Licks',
                type: 'range',
                min: 1,
                max: 10,
                step: 0.1,
                default: 4
            },
            {
                key: 'speed',
                label: 'Burn',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'star',
        name: 'Living star',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#ffdf6a', '#c83205'],
        displaceParam: true,
        params: [{
                key: 'heat',
                label: 'Heat',
                type: 'range',
                min: 0.5,
                max: 2.5,
                step: 0.05,
                default: 1.2
            },
            {
                key: 'scale',
                label: 'Granules',
                type: 'range',
                min: 1,
                max: 8,
                step: 0.1,
                default: 3
            },
            {
                key: 'displace',
                label: 'Boil',
                type: 'range',
                min: 0,
                max: 0.2,
                step: 0.005,
                default: 0.04
            },
            {
                key: 'speed',
                label: 'Churn',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'blackhole',
        name: 'Black hole',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#ff8a3a', '#000008'],
        gravity: true,
        params: [{
                key: 'core',
                label: 'Horizon',
                type: 'range',
                min: 0,
                max: 0.8,
                step: 0.01,
                default: 0.35
            },
            {
                key: 'heat',
                label: 'Accretion',
                type: 'range',
                min: 0.3,
                max: 2.5,
                step: 0.05,
                default: 1.2
            },
            {
                key: 'speed',
                label: 'Spin',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 1
            },
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
        id: 'aurora',
        name: 'Aurora veil',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#5aff9a', '#3a2a8a'],
        transparent: true,
        additive: true,
        depthWrite: false,
        gravity: true,
        params: [{
            key: 'speed',
            label: 'Flow',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1
        }, ],
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
        id: 'magnetar',
        name: 'Magnetar core',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#0055ff', '#000022'],
        transparent: true,
        additive: true,
        depthWrite: false,
        displaceParam: true,
        params: [{
                key: 'speed',
                label: 'Pulse',
                type: 'range',
                min: 0,
                max: 4,
                step: 0.05,
                default: 1.5
            },
            {
                key: 'displace',
                label: 'Distort',
                type: 'range',
                min: 0,
                max: 0.2,
                step: 0.005,
                default: 0.08
            },
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
  {
        id: 'lensing',
        name: 'Gravitational Lensing',
        category: 'Radiant & cosmic',
        kind: 'shader',
        swatch: ['#ffd700', '#000011'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        params: [{
                key: 'ringColor',
                label: 'Ring Color',
                type: 'color',
                default: '#ffcc44'
            },
            {
                key: 'voidColor',
                label: 'Void',
                type: 'color',
                default: '#000018'
            },
            {
                key: 'rings',
                label: 'Ring Count',
                type: 'range',
                min: 1,
                max: 8,
                step: 1,
                default: 3
            },
            {
                key: 'distort',
                label: 'Distortion',
                type: 'range',
                min: 0.2,
                max: 3,
                step: 0.05,
                default: 1.2
            },
            {
                key: 'caustic',
                label: 'Caustics',
                type: 'range',
                min: 0,
                max: 1,
                step: 0.01,
                default: 0.55
            },
            {
                key: 'speed',
                label: 'Orbit',
                type: 'range',
                min: 0,
                max: 3,
                step: 0.05,
                default: 0.8
            },
        ],
        fragUniforms: 'uniform vec3 u_ringColor; uniform vec3 u_voidColor; uniform float u_rings; uniform float u_distort; uniform float u_caustic;',
        fragBody: AXIS + `
      // Einstein ring / gravitational lensing effect
      float t = u_time * u_speed;
      // Radial coordinate with distortion (simulates light bending)
      float r = rad;
      // Multi-ring Einstein pattern
      float ring = 0.0;
      for (int i = 0; i < 8; i++) {
        if (float(i) >= u_rings) break;
        float fi = float(i);
        float ringR = 0.15 + fi * 0.22;
        float width = 0.03 + fi * 0.008;
        ring += exp(-pow((r - ringR) / width, 2.0) * 0.5);
      }
      ring = clamp(ring, 0.0, 1.0);
      // Gravitationally-lensed caustic patterns (arc-like)
      float caustic = fbm(vObjPos * u_distort * 2.0 + vec3(0.0, t * 0.3, 0.0));
      float arc = pow(0.5 + 0.5 * sin(ang * 5.0 + caustic * 8.0 + t * 1.5), 6.0);
      float arcMask = smoothstep(0.08, 0.35, r) * (1.0 - smoothstep(0.7, 1.0, r));
      float arcs = arc * arcMask * u_caustic;
      // Photon sphere glow at inner edge
      float photonRing = exp(-abs(r - 0.12) * 30.0) * 1.6;
      // Compose
      col = u_voidColor * 0.3;
      col += u_ringColor * ring * 3.5;
      col += u_ringColor * arcs * 2.0;
      col += vec3(1.0, 0.95, 0.7) * photonRing * 2.0;
      col += u_ringColor * pow(fres, 4.0) * 1.2;
      alpha = clamp(ring * 0.85 + arcs * 0.5 + photonRing * 0.7, 0.0, 1.0);
    `,
    },
  {
        id: "aurora",
        name: "Aurora",
        category: "Radiant & cosmic",
        kind: "shader",
        swatch: ["#0b0b2b", "#00ff88"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "auroraColor1",
                label: "Aurora Color 1",
                type: "color",
                default: "#00ff88"
            },
            {
                key: "auroraColor2",
                label: "Aurora Color 2",
                type: "color",
                default: "#0044ff"
            },
            {
                key: "waveScale",
                label: "Wave Scale",
                type: "float",
                default: 0.8,
                min: 0.1,
                max: 2.0
            },
            {
                key: "speed",
                label: "Speed",
                type: "float",
                default: 1.0,
                min: 0.1,
                max: 3.0
            },
            {
                key: "altitude",
                label: "Altitude",
                type: "float",
                default: 0.5,
                min: 0.0,
                max: 1.0
            },
            {
                key: "rayCount",
                label: "Ray Count",
                type: "float",
                default: 10.0,
                min: 2.0,
                max: 30.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_auroraColor1;
      uniform vec3 u_auroraColor2;
      uniform float u_waveScale;
      uniform float u_speed;
      uniform float u_altitude;
      uniform float u_rayCount;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * u_waveScale;
      float t = u_time * u_speed;
      float y = vWorldPos.y;
      float altMask = smoothstep(u_altitude - 0.3, u_altitude, y) * (1.0 - smoothstep(u_altitude + 0.3, u_altitude + 0.5, y));
      float wave = sin(uv.x * 2.0 + t * 0.5 + snoise(vec3(uv * 0.3, t * 0.2)) * 5.0) * 0.5 + 0.5;
      wave += sin(uv.x * 3.5 - t * 0.7 + snoise(vec3(uv * 0.25, t * 0.7)) * 3.0) * 0.3;
      float rays = 0.0;
      for (int i = 0; i < int(u_rayCount); i++) {
        float fi = float(i);
        float phase = fi * 0.73 + t * 0.13;
        float rx = sin(phase + y * 8.0) * 0.5 + 0.5;
        rays += 1.0 - smoothstep(0.0, 0.03, abs(uv.x - rx));
      }
      rays = clamp(rays / u_rayCount * 5.0, 0.0, 1.0);
      float intensity = wave * rays * altMask;
      vec3 auroraCol = mix(u_auroraColor1, u_auroraColor2, wave) * intensity;
      vec3 base = vec3(0.01, 0.01, 0.08);
      col = base + auroraCol * 1.5;
      alpha = 1.0;
    `
    },
  {
        id: "galaxy",
        name: "Galaxy",
        category: "Radiant & cosmic",
        kind: "shader",
        swatch: ["#110022", "#ff88cc"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "coreColor",
                label: "Core Color",
                type: "color",
                default: "#ffffff"
            },
            {
                key: "dustColor",
                label: "Dust Color",
                type: "color",
                default: "#2a0a4a"
            },
            {
                key: "armCount",
                label: "Arm Count",
                type: "float",
                default: 3.0,
                min: 1.0,
                max: 6.0
            },
            {
                key: "tightness",
                label: "Spiral Tightness",
                type: "float",
                default: 1.5,
                min: 0.5,
                max: 3.0
            },
            {
                key: "starDensity",
                label: "Star Density",
                type: "float",
                default: 0.6,
                min: 0.1,
                max: 1.0
            },
            {
                key: "rotSpeed",
                label: "Rotation Speed",
                type: "float",
                default: 0.2,
                min: 0.0,
                max: 1.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_coreColor;
      uniform vec3 u_dustColor;
      uniform float u_armCount;
      uniform float u_tightness;
      uniform float u_starDensity;
      uniform float u_rotSpeed;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * 0.8;
      float r = length(uv);
      float a = atan(uv.y, uv.x);
      float t = u_time * u_rotSpeed;
      float spiral = sin(a * u_armCount - r * u_tightness * 6.0 + t);
      spiral = smoothstep(-0.1, 0.3, spiral);
      float arms = spiral * (1.0 - r * 0.8);
      float dust = fbm(vec3(uv * 2.0, t * 0.1)) * 0.7;
      dust *= arms;
      float core = 1.0 - smoothstep(0.0, 0.25, r);
      core = pow(core, 1.5);
      vec3 colArm = mix(u_dustColor, u_coreColor, arms);
      col = colArm * (diff * 0.5 + 0.5);
      col += u_coreColor * core * 0.9;
      float stars = snoise(vec3(uv * 20.0, 1.0)) * 0.5 + 0.5;
      stars = smoothstep(0.97, 1.0, stars) * u_starDensity;
      col += stars * u_coreColor * 0.8;
      alpha = 1.0;
    `
    },
  {
        id: "vortex",
        name: "Vortex",
        category: "Radiant & cosmic",
        kind: "shader",
        swatch: ["#0b0b2b", "#ff5500"],
        transparent: false,
        additive: false,
        depthWrite: true,
        params: [{
                key: "vortexColor",
                label: "Vortex Color",
                type: "color",
                default: "#ff5500"
            },
            {
                key: "coreGlow",
                label: "Core Glow",
                type: "float",
                default: 0.8,
                min: 0.1,
                max: 2.0
            },
            {
                key: "armCount",
                label: "Arm Count",
                type: "float",
                default: 4.0,
                min: 1.0,
                max: 8.0
            },
            {
                key: "twistSpd",
                label: "Twist Speed",
                type: "float",
                default: 1.0,
                min: 0.1,
                max: 3.0
            },
            {
                key: "streakLen",
                label: "Streak Length",
                type: "float",
                default: 0.5,
                min: 0.1,
                max: 1.0
            },
            {
                key: "backgroundDark",
                label: "Background Darkness",
                type: "float",
                default: 0.9,
                min: 0.5,
                max: 1.0
            }
        ],
        fragUniforms: `
      uniform vec3 u_vortexColor;
      uniform float u_coreGlow;
      uniform float u_armCount;
      uniform float u_twistSpd;
      uniform float u_streakLen;
      uniform float u_backgroundDark;
    `,
        fragBody: `
      vec2 uv = vWorldPos.xy * 1.2;
      float r = length(uv);
      float a = atan(uv.y, uv.x);
      float t = u_time * u_twistSpd;
      float angleShift = a + log(r + 0.01) * 3.0 * u_armCount + t;
      float arms = sin(angleShift) * 0.5 + 0.5;
      arms *= smoothstep(0.8, 0.0, r);
      float streaks = 0.0;
      for (int i = 0; i < 4; i++) {
        float seed = float(i) * 1.7;
        vec2 dir = vec2(cos(seed), sin(seed));
        float proj = dot(uv, dir) * 3.0 + t;
        streaks += 1.0 - smoothstep(0.0, u_streakLen, abs(fract(proj) - 0.5));
      }
      streaks = clamp(streaks * 0.5, 0.0, 1.0);
      float core = exp(-r * 5.0) * u_coreGlow;
      vec3 colVortex = u_vortexColor * (arms * 0.7 + streaks * 0.3 + core);
      vec3 bg = vec3(0.0, 0.0, 0.02) * u_backgroundDark;
      col = bg + colVortex;
      alpha = 1.0;
    `
    },
  {
    id: 'asteroid', name: 'Asteroid Surface', category: 'Radiant & cosmic', kind: 'shader', swatch: ['#696969', '#343434'],
    params: [
      { key: 'rockDensity', label: 'Rock Density', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.8 },
      { key: 'craterSize', label: 'Crater Size', type: 'range', min: 0.5, max: 2.0, step: 0.01, default: 1.0 },
      { key: 'regolithNoise', label: 'Regolith Noise', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.6 },
      { key: 'grayTint', label: 'Gray Tint', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'roughness', label: 'Roughness', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.7 },
    ],
    fragUniforms: `
      uniform float u_rockDensity;
      uniform float u_craterSize;
      uniform float u_regolithNoise;
      uniform float u_grayTint;
      uniform float u_roughness;
    `,
    fragBody: `
      vec2 uv = vUv;
      float rock = snoise(vec3(uv * 10.0, 0.0)) * u_rockDensity;
      rock += snoise(vec3(uv * 25.0, 1.0)) * 0.3;
      rock = rock * 0.5 + 0.5;

      float crater = 1.0;
      for (int i = 0; i < 4; i++) {
        vec2 center = vec2(
          hash(vec2(uv.x + float(i) * 0.4, float(i))),
          hash(vec2(uv.y - float(i), float(i) * 2.0))
        ) * 0.8 + 0.1;
        float dist = length(uv - center) * u_craterSize;
        float ring = abs(dist - 0.15) < 0.02 ? 0.2 : 0.0;
        crater = min(crater, 1.0 - ring);
      }

      float regolith = snoise(vec3(uv * 40.0, 2.0)) * u_regolithNoise;
      regolith = regolith * 0.5 + 0.5;
      float surface = (rock * 0.6 + regolith * 0.4) * crater;
      surface = mix(surface, surface * 0.8 + 0.2, u_roughness);
      col = mix(vec3(0.5, 0.5, 0.5), vec3(0.7, 0.7, 0.7), u_grayTint) * surface;
      col += regolith * 0.1;
      
    `,
  },
];
