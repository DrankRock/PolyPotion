// ============================================================
// presets/core-liquid-organic.js — "Liquid & organic" core presets.
// Physical (MeshPhysicalMaterial) + hand-written shader looks.
// Merged into SHADER_PRESETS by ../shader-lib.js.
// ============================================================
export const CORE_LIQUID_ORGANIC = [
  {
    id: 'water', name: 'Water', category: 'Liquid & organic', kind: 'shader', swatch: ['#8fe0ff', '#0e6fa8'],
    transparent: true, depthWrite: false,
    params: [
      { key: 'color', label: 'Water', type: 'color', default: '#2aa8d8' },
      { key: 'speed', label: 'Flow', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color;',
    fragBody: `
      float w1 = snoise(vObjPos*4.0 + vec3(0.0, u_time*u_speed*0.6, u_time*u_speed*0.4));
      float w2 = snoise(vObjPos*9.0 - vec3(u_time*u_speed*0.5, 0.0, u_time*u_speed*0.3));
      vec3 nn = normalize(N + 0.32*vec3(w1, (w1+w2)*0.5, w2));
      vec3 r = reflect(-V, nn);
      float up = clamp(r.y*0.5+0.5, 0.0, 1.0);
      vec3 sky = mix(u_color*0.55, vec3(0.86,0.93,1.0), up);
      float f = pow(1.0 - max(dot(nn, V), 0.0), 3.0);
      col = mix(u_color*0.4, sky, clamp(f*1.5, 0.0, 1.0));
      float spark = pow(max(snoise(vObjPos*14.0 + u_time*u_speed), 0.0), 6.0);
      col += spark*0.6;
      alpha = clamp(0.72 + f*0.28, 0.0, 1.0);
    `,
  },
  {
    id: 'mercury', name: 'Liquid metal', category: 'Liquid & organic', kind: 'shader', swatch: ['#eef2f8', '#5a636e'],
    params: [
      { key: 'tint', label: 'Tint', type: 'color', default: '#cdd4de' },
      { key: 'ripple', label: 'Ripple', type: 'range', min: 0, max: 0.6, step: 0.01, default: 0.25 },
      { key: 'speed', label: 'Flow', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_tint; uniform float u_ripple;',
    fragBody: `
      float w = fbm(vObjPos*8.0 + u_time*u_speed*0.5);
      float w2 = fbm(vObjPos*8.0 + 30.0 - u_time*u_speed*0.4);
      vec3 nn = normalize(N + u_ripple*vec3(w, (w+w2)*0.5, w2));
      vec3 r = reflect(-V, nn);
      float up = clamp(r.y*0.5+0.5, 0.0, 1.0);
      vec3 sky = mix(vec3(0.05,0.06,0.08), vec3(0.92,0.95,1.0), pow(up,1.5));
      float spec = pow(up, 8.0);
      col = sky * u_tint + spec*0.6;
      col += pow(1.0 - max(dot(nn,V),0.0), 3.0) * 0.2;
    `,
  },
  {
    id: 'jelly', name: 'Jelly / goo', category: 'Liquid & organic', kind: 'shader', swatch: ['#ff8fc4', '#a83e78'],
    transparent: false, displaceParam: true,
    params: [
      { key: 'color', label: 'Jelly', type: 'color', default: '#ff7ab8' },
      { key: 'color2', label: 'Rim', type: 'color', default: '#fff3a0' },
      { key: 'displace', label: 'Wobble', type: 'range', min: 0, max: 0.3, step: 0.005, default: 0.12 },
      { key: 'speed', label: 'Speed', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform vec3 u_color; uniform vec3 u_color2;',
    fragBody: `
      vec3 sss = u_color * (0.55 + 0.6*diff);
      float rim = pow(1.0 - max(dot(N,V),0.0), 2.0);
      col = mix(sss, u_color2, rim*0.7);
      col += rim*0.3;
    `,
  },
  {
    id: 'lava', name: 'Lava / magma', category: 'Liquid & organic', kind: 'shader', swatch: ['#ffd24a', '#8a1c05'],
    params: [
      { key: 'intensity', label: 'Heat', type: 'range', min: 0.5, max: 2.2, step: 0.05, default: 1.2 },
      { key: 'scale', label: 'Scale', type: 'range', min: 1, max: 8, step: 0.1, default: 3 },
      { key: 'speed', label: 'Flow', type: 'range', min: 0, max: 3, step: 0.05, default: 1 },
    ],
    fragUniforms: 'uniform float u_intensity; uniform float u_scale;',
    fragBody: `
      vec3 q = vObjPos*u_scale;
      float n = fbm(q + vec3(0.0, -u_time*u_speed*0.4, 0.0));
      float n2 = fbm(q*2.0 + vec3(u_time*u_speed*0.3, 0.0, 0.0));
      float h = (n*0.65 + n2*0.35)*0.5 + 0.5;
      vec3 cool = vec3(0.11,0.02,0.01);
      vec3 mid  = vec3(0.85,0.18,0.03);
      vec3 hot  = vec3(1.0,0.85,0.35);
      col = mix(cool, mid, smoothstep(0.35,0.6,h));
      col = mix(col, hot, smoothstep(0.62,0.86,h));
      col *= u_intensity;
    `,
  },
];
