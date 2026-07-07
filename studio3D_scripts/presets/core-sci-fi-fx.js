// ============================================================
// presets/core-sci-fi-fx.js — "Sci-fi FX" core presets.
// Physical (MeshPhysicalMaterial) + hand-written shader looks.
// Merged into SHADER_PRESETS by ../shader-lib.js.
// ============================================================
export const CORE_SCI_FI_FX = [
  {
    id: 'hologram', name: 'Hologram', category: 'Sci-fi FX', kind: 'shader', swatch: ['#38f0ff', '#1360a0'],
    transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'color', label: 'Colour', type: 'color', default: '#38f0ff' },
      { key: 'density', label: 'Scanlines', type: 'range', min: 10, max: 120, step: 1, default: 45 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.9 },
      { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_density; uniform float u_opacity;',
    fragBody: `
      float scan = 0.5 + 0.5*sin(vWorldPos.y*u_density - u_time*4.0*u_speed);
      float fp = pow(fres, 2.0);
      float flick = 0.85 + 0.15*sin(u_time*30.0);
      col = u_color * (0.4 + 1.2*fp) + vec3(0.08)*scan;
      alpha = clamp((0.12 + pow(fp,1.5)*0.9) * (0.55 + 0.45*scan) * flick, 0.0, 1.0) * u_opacity;
    `,
  },
  {
    id: 'shield', name: 'Energy shield', category: 'Sci-fi FX', kind: 'shader', swatch: ['#5effc8', '#1c9a70'],
    transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'color', label: 'Colour', type: 'color', default: '#5effc8' },
      { key: 'power', label: 'Edge', type: 'range', min: 0.8, max: 4, step: 0.05, default: 2 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.8 },
      { key: 'speed', label: 'Pulse', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_power; uniform float u_opacity;',
    fragBody: `
      float fp = pow(fres, u_power);
      float bands = 0.5 + 0.5*sin(vWorldPos.y*20.0 - u_time*3.0*u_speed);
      float pulse = 0.6 + 0.4*sin(u_time*2.0*u_speed);
      col = u_color * (fp*1.5 + 0.15) + u_color*bands*fp*0.4;
      alpha = clamp(fp*pulse, 0.0, 1.0) * u_opacity + 0.04;
    `,
  },
  {
    id: 'plasma', name: 'Plasma / electric', category: 'Sci-fi FX', kind: 'shader', swatch: ['#c08bff', '#2a1258'],
    params: [
      { key: 'color', label: 'Core', type: 'color', default: '#2a1258' },
      { key: 'color2', label: 'Arc', type: 'color', default: '#c08bff' },
      { key: 'scale', label: 'Scale', type: 'range', min: 1, max: 8, step: 0.1, default: 3 },
      { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_color2; uniform float u_scale;',
    fragBody: `
      vec3 q = vObjPos*u_scale;
      float n = fbm(q*2.0 + u_time*u_speed*0.6);
      float v = abs(sin(n*6.2831 + u_time*u_speed*3.0));
      float bolt = pow(1.0 - v, 8.0);
      col = mix(u_color*0.15, u_color2*2.2, bolt) + bolt*0.6;
    `,
  },
  {
    id: 'xray', name: 'X-ray', category: 'Sci-fi FX', kind: 'shader', swatch: ['#9adfff', '#155a80'],
    transparent: true, additive: true, depthWrite: false,
    params: [
      { key: 'color', label: 'Colour', type: 'color', default: '#7ad0ff' },
      { key: 'power', label: 'Falloff', type: 'range', min: 0.5, max: 3, step: 0.05, default: 1.4 },
      { key: 'opacity', label: 'Opacity', type: 'range', min: 0, max: 1, step: 0.01, default: 0.7 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_power; uniform float u_opacity;',
    fragBody: `
      float fp = pow(fres, u_power);
      col = u_color * fp * 2.2;
      alpha = clamp(fp, 0.0, 1.0) * u_opacity;
    `,
  },
  {
    id: 'neonwire', name: 'Neon wireframe', category: 'Sci-fi FX', kind: 'shader', swatch: ['#5effd0', '#12403a'],
    transparent: true, additive: true, depthWrite: false, wireframe: true,
    params: [
      { key: 'color', label: 'Wire', type: 'color', default: '#5effd0' },
    ],
    fragUniforms: 'uniform vec3 u_color;',
    fragBody: `
      col = u_color * (1.2 + fres);
    `,
  },
  {
    id: 'dissolve', name: 'Dissolve burn', category: 'Sci-fi FX', kind: 'shader', swatch: ['#ff6a2a', '#cfcfcf'],
    params: [
      { key: 'color', label: 'Surface', type: 'color', default: '#c9c9c9' },
      { key: 'glow', label: 'Ember', type: 'color', default: '#ff6a2a' },
      { key: 'scale', label: 'Grain', type: 'range', min: 1, max: 12, step: 0.1, default: 4 },
      { key: 'edge', label: 'Reveal', type: 'range', min: 0, max: 1, step: 0.01, default: 0.35 },
      { key: 'width', label: 'Ember width', type: 'range', min: 0.01, max: 0.3, step: 0.005, default: 0.08 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_glow; uniform float u_scale; uniform float u_edge; uniform float u_width;',
    fragBody: `
      float n = fbm(vObjPos*u_scale)*0.5 + 0.5;
      if (n < u_edge) discard;
      float e = smoothstep(u_edge, u_edge + u_width, n);
      col = mix(u_glow*2.6, u_color*diff, e);
    `,
  },
];
