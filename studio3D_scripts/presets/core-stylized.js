// ============================================================
// presets/core-stylized.js — "Stylized" core presets.
// Physical (MeshPhysicalMaterial) + hand-written shader looks.
// Merged into SHADER_PRESETS by ../shader-lib.js.
// ============================================================
export const CORE_STYLIZED = [
  {
    id: 'toon', name: 'Toon / cel', category: 'Stylized', kind: 'shader', swatch: ['#8ec7ff', '#2f6fb0'],
    params: [
      { key: 'color', label: 'Colour', type: 'color', default: '#4aa3ff' },
      { key: 'rim', label: 'Rim', type: 'range', min: 1, max: 6, step: 0.1, default: 3 },
      { key: 'rimColor', label: 'Rim tint', type: 'color', default: '#ffffff' },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_rim; uniform vec3 u_rimColor;',
    fragBody: `
      float l = dot(N, KL);
      float t = 0.35 + smoothstep(0.0,0.02,l)*0.2 + smoothstep(0.35,0.37,l)*0.2 + smoothstep(0.75,0.77,l)*0.25;
      col = u_color * t;
      float rim = pow(1.0 - max(dot(N,V),0.0), u_rim);
      col += rim * u_rimColor * 0.6;
    `,
  },
  {
    id: 'matcap', name: 'Sculpt matcap', category: 'Stylized', kind: 'shader', swatch: ['#b7bcc4', '#5c626b'],
    params: [
      { key: 'color', label: 'Body', type: 'color', default: '#8a8f98' },
      { key: 'spec', label: 'Highlight', type: 'color', default: '#ffffff' },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_spec;',
    fragBody: `
      vec3 vn = normalize(vViewNormal);
      vec2 muv = vn.xy*0.5 + 0.5;
      float d = distance(muv, vec2(0.68, 0.72));
      float spec = smoothstep(0.45, 0.0, d);
      float amb = 0.25 + 0.7*muv.y;
      col = u_color * amb + spec * u_spec * 1.2;
      col *= (0.6 + 0.4*(1.0 - pow(fres, 3.0)));
    `,
  },
  {
    id: 'iridescent', name: 'Iridescent', category: 'Stylized', kind: 'shader', swatch: ['#7affd0', '#b06be6'],
    params: [
      { key: 'color', label: 'Base', type: 'color', default: '#20232a' },
      { key: 'bands', label: 'Bands', type: 'range', min: 0.5, max: 4, step: 0.05, default: 1.6 },
      { key: 'intensity', label: 'Sheen', type: 'range', min: 0, max: 1.5, step: 0.02, default: 1 },
      { key: 'speed', label: 'Drift', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform float u_bands; uniform float u_intensity;',
    fragBody: `
      float fp = pow(fres, 1.4);
      float hue = fract(u_time*0.03*u_speed + fp*u_bands + N.y*0.25 + vWorldPos.y*0.1);
      vec3 rain = hsv2rgb(vec3(hue, 0.85, 1.0));
      col = mix(u_color*diff, rain, clamp(fp*u_intensity, 0.0, 1.0));
      col += pow(fp, 4.0)*0.5;
    `,
  },
  {
    id: 'normals', name: 'Normals', category: 'Stylized', kind: 'shader', swatch: ['#8a8fff', '#5affa0'],
    params: [],
    fragUniforms: '',
    fragBody: `
      col = normalize(vWorldNormal)*0.5 + 0.5;
    `,
  },
];
