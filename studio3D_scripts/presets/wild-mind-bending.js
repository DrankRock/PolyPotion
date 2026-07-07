// ============================================================
// presets/wild-mind-bending.js — "Mind-bending" shader presets.
// Part of the Showcase shader library; merged into SHADER_PRESETS by
// ../shader-lib.js (via normalizeWild). See ../shader-lib.js for the
// shared GLSL scope available inside each fragBody.
// ============================================================
import { AXIS } from '../shader-glue.js';

export const WILD_MIND_BENDING = [
  {
        id: 'hypnosis',
        name: 'Hypnotic swirl',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffaa00', '#0000ff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        params: [{
            key: 'speed',
            label: 'Spiral',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }, ],
        fragBody: AXIS + `
      float r = length(pPerp) / E;
      float a = ang + u_time * u_speed * 2.0 + r * 12.0;
      float spiral = abs(sin(a * 4.0));
      float pupil = smoothstep(0.05, 0.0, r);
      vec3 c1 = hsv2rgb(vec3(0.05 + r * 0.1, 1.0, 1.0));
      vec3 c2 = hsv2rgb(vec3(0.6 + r * 0.2, 1.0, 1.0));
      col = mix(c1 * 0.2, c2, smoothstep(0.0, 0.2, spiral));
      col += vec3(1.0) * pupil * 4.0;
      col += vec3(1.0) * pow(fres, 4.0) * 2.0;
      alpha = clamp(0.3 + spiral + pupil, 0.0, 1.0);
    `,
    },
  {
        id: 'overload',
        name: 'Sensory overload',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff00ff', '#00ffff'],
        params: [{
            key: 'speed',
            label: 'Trip',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }, ],
        fragBody: `
      float t = u_time * u_speed;
      float n1 = fbm(vObjPos * 4.0 + t * 0.5);
      float n2 = fbm(vObjPos * 6.0 - t * 0.8);
      float n3 = fbm(vObjPos * 3.0 + vec3(t * 1.2, -t * 0.5, 0.0));
      vec3 c1 = hsv2rgb(vec3(n1 * 0.5 + t * 0.1, 1.0, 1.0));
      vec3 c2 = hsv2rgb(vec3(n2 * 0.5 + 0.5, 1.0, 1.0));
      col = mix(c1, c2, n3) * (0.5 + diff * 0.8);
      col += vec3(1.0) * pow(fres, 4.0) * 3.0;
    `,
    },
  {
        id: 'nanoswarm',
        name: 'Nano-swarm',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff5500', '#111111'],
        params: [{
            key: 'speed',
            label: 'Move',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2
        }, ],
        fragBody: `
      float t = u_time * u_speed;
      float s1 = step(0.85, snoise(vObjPos * 10.0 + vec3(t, 0.0, 0.0)));
      float s2 = step(0.85, snoise(vObjPos * 12.0 - vec3(0.0, t, 0.0)));
      float s3 = step(0.85, snoise(vObjPos * 14.0 + vec3(0.0, 0.0, t)));
      col = vec3(0.1) * diff;
      col += vec3(1.0, 0.3, 0.0) * (s1 + s2 + s3);
      col += vec3(1.0, 0.5, 0.0) * pow(fres, 3.0) * 1.5;
    `,
    },
  {
        id: 'moireheadache',
        name: 'Moiré Madness',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#000000', '#ffffff'],
        params: [{
            key: 'speed',
            label: 'Spin',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }],
        fragBody: `
      float t = u_time * u_speed;
      float x = vObjPos.x * 20.0;
      float y = vObjPos.y * 20.0;
      float m1 = sin(x * 2.0 + t) * sin(y * 2.0 - t);
      float m2 = sin(x * 1.5 - t * 1.3) * sin(y * 1.5 + t * 1.3);
      float m = abs(m1 - m2);
      col = vec3(m) * diff * 2.0;
      col += vec3(1.0) * pow(fres, 5.0) * 1.0;
    `
    },
  {
        id: 'brainmelting',
        name: 'Brain Melting',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffaa00', '#aa00ff'],
        params: [{
            key: 'speed',
            label: 'Trip',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.0
        }],
        fragBody: `
      float t = u_time * u_speed;
      float n1 = fbm(vObjPos * 4.0 + t * 0.7);
      float n2 = fbm(vObjPos * 5.0 - t * 0.9);
      float n3 = fbm(vObjPos * 3.0 + vec3(t * 1.1, -t * 0.6, 0.0));
      float melt = sin(vObjPos.y * 10.0 + n1 * 8.0 + t) * 0.5 + 0.5;
      vec3 hot = vec3(1.0, 0.6, 0.1) * (1.0 - melt) * 2.0;
      vec3 cold = vec3(0.2, 0.1, 1.0) * melt * 2.0;
      col = mix(hot, cold, n3) * diff;
      col += vec3(1.0) * pow(fres, 4.0) * 1.8;
    `
    },
  {
        id: 'voxelize',
        name: 'Voxelizer',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff5500', '#0000ff'],
        gravity: true,
        fragBody: AXIS + `
      float voxelSize = 0.1;
      vec3 voxel = floor(vObjPos / voxelSize) * voxelSize;
      float noise = snoise(voxel * 3.0 + u_time * u_speed);
      float edge = step(0.5, fbm(voxel * 10.0));
      vec3 c1 = hsv2rgb(vec3(noise * 0.5 + 0.2, 1.0, 1.0));
      vec3 c2 = hsv2rgb(vec3(noise * 0.5 + 0.7, 1.0, 1.0));
      col = mix(c1, c2, edge) * (0.5 + diff * 0.5);
      col += vec3(1.0) * pow(fres, 5.0) * 1.5;
    `
    },
  {
        id: 'cellularnoise',
        name: 'Cellular Chaos',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff0088', '#00ff88'],
        gravity: true,
        fragBody: AXIS + `
      float t = u_time * u_speed;
      vec3 p = vObjPos * 4.0;
      vec3 cell = floor(p) + 0.5;
      vec3 subs = p - cell;
      float dist = length(subs) * 0.8;
      float n = snoise(cell + t * 0.2);
      float brightness = 1.0 - smoothstep(0.0, 0.5, dist);
      vec3 c1 = hsv2rgb(vec3(n * 0.8, 1.0, 1.0));
      vec3 c2 = vec3(1.0);
      col = mix(vec3(0.05), c1, brightness * 0.8) * diff;
      col += c2 * pow(fres, 4.0) * 1.5;
    `
    },
  {
        id: 'timeslicer',
        name: 'Time Slicer',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff0000', '#00ff00'],
        gravity: true,
        fragBody: AXIS + `
      float t = u_time * u_speed;
      float slice = sin(h * 15.0 - t * 5.0) * 0.5 + 0.5;
      float thickness = abs(fract(h * 15.0 - t * 5.0) - 0.5) * 2.0;
      float sliceEdge = smoothstep(0.8, 0.9, thickness) * smoothstep(0.95, 0.9, thickness);
      float glow = exp(-thickness * 10.0);
      vec3 c1 = vec3(1.0, 0.2, 0.1) * glow;
      vec3 c2 = vec3(0.1, 1.0, 0.2) * sliceEdge;
      col = (c1 + c2) * 1.5 * (0.5 + diff * 0.5);
      col += vec3(1.0) * pow(fres, 3.0) * 1.2;
    `
    },
  {
        "id": "neonwireframe",
        "name": "Neon Wireframe",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#000000", "#ff0055"],
        "gravity": false,
        "fragBody": "float t = u_time * u_speed; float edge = abs(1.0 - 2.0 * fbm(vObjPos * 20.0 + t * 0.5)); edge = smoothstep(0.7,0.9,edge); vec3 wire = vec3(1.0, 0.0, 0.5) * edge * 3.0; col = wire * diff; col += vec3(1.0) * pow(fres,5.0)*0.5;",
        "params": [{
            "key": "speed",
            "label": "Wire",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.0
        }]
    },
  {
        "id": "psychedelicfractal",
        "name": "Psychedelic Fractal",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff00ff", "#ffff00"],
        "gravity": false,
        "params": [{
            "key": "speed",
            "label": "Trip",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 2.5
        }],
        "fragBody": "float t = u_time * u_speed; float z = 1.0; for(int i=0; i<3; i++){ z = fbm(vObjPos * z * 2.0 + t * 0.2) * 2.0; } vec3 c = hsv2rgb(vec3(z*0.8+t*0.1, 1.0, 1.0)); col = c * diff; col += vec3(1.0)*pow(fres,4.0)*2.0;"
    },
  {
        id: 'cyberglitch',
        name: 'Cyber Glitch',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff00ff', '#00ffff'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; float block = floor(h*15.0+t*2.0)*0.0667; float glitch = step(0.88, snoise(vec3(block*1.3, t*5.0, 0.3))); float g2 = step(0.94, fbm(vObjPos*30.0+t*10.0)); float bright = max(glitch, g2); vec3 colBase = hsv2rgb(vec3(fract(h*2.0+t*0.1), 1.0, 1.0)); col = mix(colBase*0.2, colBase, bright) * diff; col += vec3(1.0,0.3,0.5)*pow(fres,4.0)*1.2;\n`,
        params: [{
            key: 'speed',
            label: 'Jitter',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }, ],
    },
  {
        id: 'gelatinouscube',
        name: 'Gelatinous Cube',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#8affb0', '#0a4a2a'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `\n float t = u_time * u_speed; float wobble = sin(pPerp * 4.0 + t * 2.0) * 0.2; float gel = fbm(vObjPos * 3.0 + t * 0.3 + wobble); float opacity = smoothstep(0.3, 0.7, gel) * 0.9; col = hsv2rgb(vec3(0.3 + gel * 0.2, 0.8, 1.0)) * opacity * 1.5; alpha = opacity;\n`,
        params: [{
            key: 'speed',
            label: 'Wiggle',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1.2
        }, ],
    },
  {
        id: 'sandstorm',
        name: 'Sandstorm',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#d4a036', '#3a2a0a'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `\n float t = u_time * u_speed; float grains = 0.0; for(int i=0; i<4; i++){ float fi = float(i); grains += step(0.82, snoise(vObjPos * (8.0+fi*3.0) + vec3(fi*t*1.7, -fi*t*0.9, fi))); } col = vec3(0.8,0.5,0.2) * grains * 2.0; alpha = grains * 0.85;\n`,
        params: [{
            key: 'speed',
            label: 'Wind',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.2
        }, ],
    },
  {
        id: 'nebulaecho',
        name: 'Nebula Echo',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff80c0', '#200840'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; float cloud = fbm(vObjPos*2.5 + t*0.15); float echo = sin(cloud*12.0)*0.5+0.5; vec3 col1 = hsv2rgb(vec3(0.8+cloud*0.2, 0.7, 0.5)); vec3 col2 = hsv2rgb(vec3(0.6+cloud*0.3, 0.8, 0.8)); col = mix(col1, col2, echo) * diff; col += vec3(1.0,0.7,1.0)*pow(fres,3.0)*0.9;\n`,
        params: [{
            key: 'speed',
            label: 'Drift',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1.0
        }, ],
    },
  {
        id: 'electricarc',
        name: 'Electric Arc',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffffff', '#0022ff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `\n float t = u_time * u_speed; float arc = 0.0; for(int i=0; i<3; i++){ float fi = float(i); arc += pow(max(0.0, 1.0 - abs(sin(pPerp*(7.0+fi*3.0)+t*2.0 + fi*1.2)*0.5+0.5 - 0.7)*15.0), 3.0); } arc = clamp(arc,0.0,1.0); col = vec3(0.8,0.9,1.0) * arc * 4.0; col += vec3(1.0)*pow(fres,5.0)*0.8; alpha = arc*0.95;\n`,
        params: [{
            key: 'speed',
            label: 'Zap',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.5
        }, ],
    },
  {
        id: 'flowymercury',
        name: 'Flow Mercury',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#c0c0d0', '#3a3a4a'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; float flow = fbm(vObjPos*3.0 + t*0.4); float streak = abs(sin(ang*4.0 + flow*7.0 + t)*0.5+0.5); col = mix(vec3(0.2,0.22,0.3), vec3(0.8,0.82,0.9), streak) * diff; col += vec3(1.0)*pow(fres,3.0)*0.7;\n`,
        params: [{
            key: 'speed',
            label: 'Flow',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1.3
        }, ],
    },
  {
        id: 'candyfloss',
        name: 'Candy Floss',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffaacc', '#ffffff'],
        gravity: false,
        fragBody: `float t = u_time * u_speed; float fluff = fbm(vObjPos*5.0 + t*0.6); float thickness = smoothstep(0.3, 0.8, fluff); vec3 cotton = mix(vec3(1.0,0.7,0.8), vec3(1.0,0.9,0.95), thickness); col = cotton * diff; col += vec3(1.0)*pow(fres,2.0)*1.2;`,
        params: [{
            key: 'speed',
            label: 'Spin',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 0.8
        }, ],
    },
  {
        id: 'glitchgrid',
        name: 'Glitch Grid',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff00ff', '#000000'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `\n float t = u_time * u_speed; vec3 grid = fract(vObjPos*6.0); float gx = smoothstep(0.08,0.1,grid.x); float gy = smoothstep(0.08,0.1,grid.y); float gz = smoothstep(0.08,0.1,grid.z); float g = max(max(gx,gy),gz); float glitch = step(0.92, snoise(vObjPos*3.0 + t*10.0)); g = max(g, glitch); col = vec3(1.0,0.2,1.0) * g * 3.0; alpha = g*0.9;\n`,
        params: [{
            key: 'speed',
            label: 'Scan',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.8
        }, ],
    },
  {
        id: 'sparkleswirl',
        name: 'Sparkle Swirl',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffdd55', '#550066'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; float a = ang + t*2.0 + rad*8.0; float spark = pow(max(sin(a*6.0)*0.5+0.5, 0.0), 20.0); vec3 base = hsv2rgb(vec3(0.15+rad*0.2, 0.9, 0.7)); col = base * diff + vec3(1.0,0.9,0.3)*spark*5.0; col += vec3(1.0)*pow(fres,4.0)*0.5;\n`,
        params: [{
            key: 'speed',
            label: 'Spin',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }, ],
    },
  {
        id: 'bubblecolumn',
        name: 'Bubble Column',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#80d0ff', '#0a2a4a'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `\n float t = u_time * u_speed; float rise = fract(h*4.0 - t*0.9); float bubble = step(0.85, snoise(vObjPos*10.0 + vec3(0.0,t*2.5,0.0))); bubble *= smoothstep(0.0, 0.2, rise)*smoothstep(0.8,0.6,rise); col = vec3(0.3,0.8,1.0) * bubble * 2.5; col += vec3(1.0)*pow(fres,3.0)*0.4; alpha = bubble*0.9;\n`,
        params: [{
            key: 'speed',
            label: 'Speed',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.6
        }, ],
    },
  {
        id: 'hologlitch',
        name: 'Holo-Glitch',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffaa00', '#0055ff'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; float holo = fbm(vObjPos*4.0 + t*0.5); float g = step(0.65, holo) * smoothstep(0.3,0.8,holo); vec3 c1 = hsv2rgb(vec3(0.6+holo*0.2,1.0,1.0)); vec3 c2 = vec3(0.9); col = mix(c1*0.3, c2, g) * diff; col += vec3(1.0)*pow(fres,4.0)*0.8;\n`,
        params: [{
            key: 'speed',
            label: 'Shift',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.0
        }, ],
    },
  {
        id: 'rainbowwave',
        name: 'Rainbow Wave',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff0066', '#00ffcc'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; float wave = sin(pPerp*6.0 + h*8.0 - t*4.0)*0.5+0.5; col = hsv2rgb(vec3(fract(h*2.0+t*0.1), 1.0, 1.0)) * wave * 2.0 * diff; col += vec3(1.0)*pow(fres,3.0)*1.2;\n`,
        params: [{
            key: 'speed',
            label: 'Speed',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.0
        }, ],
    },
  {
        id: 'octarine',
        name: 'Octarine',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#7a00ff', '#ff0088'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; float n = fbm(vObjPos*5.0 + t*0.4); float magic = sin(n*12.0)*0.5+0.5; vec3 c = hsv2rgb(vec3(0.8+n*0.2, 0.9, 1.0)); col = c * magic * 2.0 * diff; col += vec3(0.8,0.2,1.0)*pow(fres,4.0)*0.6;\n`,
        params: [],
    },
  {
        id: 'shatteredglass',
        name: 'Shattered Glass',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#88ccff', '#1a2a3a'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; vec3 p = vObjPos*12.0; vec3 f1 = floor(p); float crack = abs(snoise(f1 + t*0.1)); float shard = step(0.7, crack); col = mix(vec3(0.1,0.2,0.3), vec3(0.6,0.8,1.0), shard) * diff; col += vec3(1.0)*pow(fres,5.0)*0.9;\n`,
        params: [{
            key: 'speed',
            label: 'Stress',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1.0
        }, ],
    },
  {
        id: 'phaseghost',
        name: 'Phase Ghost',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#d0f0ff', '#4a6a8a'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `\n float t = u_time * u_speed; float phase = sin(t*3.0 + pPerp*10.0)*0.5+0.5; float v = fbm(vObjPos*2.0 + t*0.7); col = vec3(0.8,0.9,1.0) * v * phase * 2.0; alpha = v*phase*0.85;\n`,
        params: [{
            key: 'speed',
            label: 'Phase',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }, ],
    },
  {
        id: 'liquidmetal',
        name: 'Liquid Metal',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#b0b0c0', '#1a1a2a'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; float flow = fbm(vObjPos*2.5 + t*0.3); float spec = pow(max(dot(reflect(-V, N), KL), 0.0), 30.0); col = mix(vec3(0.1,0.12,0.18), vec3(0.8,0.82,0.9), flow) * diff; col += vec3(1.0)*spec*1.8;\n`,
        params: [{
            key: 'speed',
            label: 'Flow',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1.0
        }, ],
    },
  {
        id: 'inkdrop',
        name: 'Ink Drop',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#000000', '#ffffff'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; float n = fbm(vObjPos*3.0 + t*0.2); float ink = smoothstep(0.4, 0.7, n); col = vec3(1.0-ink) * diff; col += vec3(0.1)*pow(fres,2.0);\n`,
        params: [],
    },
  {
        id: 'shockwave',
        name: 'Shockwave',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffaa00', '#550000'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `\n float t = u_time * u_speed; float wave = sin(rad*15.0 - t*6.0)*0.5+0.5; wave = smoothstep(0.2,0.6,wave) * exp(-rad*2.0); col = vec3(1.0,0.6,0.1) * wave * 3.0; alpha = wave*0.9;\n`,
        params: [{
            key: 'speed',
            label: 'Boom',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.0
        }, ],
    },
  {
        id: 'tvstatic',
        name: 'TV Static',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#888888', '#000000'],
        gravity: false,
        fragBody: 'float t = u_time * u_speed; float noise = snoise(vObjPos*30.0 + t*50.0); float mono = noise*0.5+0.5; col = vec3(mono) * diff; col += vec3(1.0)*pow(fres,2.0)*0.2;',
        params: [{
            key: 'speed',
            label: 'Noise',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.0
        }, ],
    },
  {
        id: 'motherofflowers',
        name: 'Mother of Flowers',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff88bb', '#2288ff'],
        gravity: true,
        fragBody: AXIS + `\n float t = u_time * u_speed; float petal = sin(ang*5.0 + rad*12.0 + t)*0.5+0.5; petal = pow(petal, 3.0); vec3 c = hsv2rgb(vec3(0.8+petal*0.2, 0.8, 0.9)); col = c * petal * 2.0 * diff; col += vec3(1.0,0.6,0.8)*pow(fres,3.0)*0.7;\n`,
        params: [{
            key: 'speed',
            label: 'Bloom',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1.0
        }, ],
    },
  {
        id: 'wormhole',
        name: 'Wormhole',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#4400ff', '#ff00aa'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `
        float r = pPerp / E;
        float a = ang + u_time * u_speed * 3.0 + r * 20.0;
        float tunnel = sin(a * 5.0) * 0.5 + 0.5;
        float rim = smoothstep(0.8, 1.0, r);
        vec3 col1 = hsv2rgb(vec3(0.7 + r * 0.2, 1.0, 1.0));
        vec3 col2 = hsv2rgb(vec3(0.9 + r * 0.3, 1.0, 0.8));
        col = mix(col1, col2, tunnel);
        col += vec3(1.0, 0.2, 0.5) * pow(rim, 2.0) * 2.0;
        alpha = clamp(tunnel * 0.8 + rim, 0.0, 1.0);
      `
    },
  {
        id: 'fiberoptic',
        name: 'Fiber Optic',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#00ffcc', '#ff00ff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `
        float t = u_time * u_speed;
        float hNorm = (h - u_levMin) / (u_levMax - u_levMin);
        float s = sin(h * 30.0 + t * 5.0 + pPerp * 10.0) * 0.5 + 0.5;
        float bright = smoothstep(0.85, 1.0, s);
        vec3 c1 = hsv2rgb(vec3(hNorm * 0.8, 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(hNorm * 0.8 + 0.5, 1.0, 1.0));
        col = mix(c1, c2, bright) * bright * 3.0;
        col += vec3(1.0) * pow(fres, 3.0) * 1.5;
        alpha = bright * 0.9;
      `
    },
  {
        id: 'moireheadache',
        name: 'Moiré Madness',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#000000', '#ffffff'],
        params: [{
            key: 'speed',
            label: 'Spin',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }],
        fragBody: `
        float t = u_time * u_speed;
        float x = vObjPos.x * 20.0;
        float y = vObjPos.y * 20.0;
        float m1 = sin(x * 2.0 + t) * sin(y * 2.0 - t);
        float m2 = sin(x * 1.5 - t * 1.3) * sin(y * 1.5 + t * 1.3);
        float m = abs(m1 - m2);
        col = vec3(m) * diff * 2.0;
        col += vec3(1.0) * pow(fres, 5.0) * 1.0;
      `
    },
  {
        id: 'neonpulse',
        name: 'Neon Pulse',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff00ff', '#00ffff'],
        gravity: true,
        fragBody: AXIS + `
        float t = u_time * u_speed;
        float pulse = sin(pPerp * 8.0 - t * 4.0) * 0.5 + 0.5;
        float ring = smoothstep(0.3, 0.4, pulse) * smoothstep(0.6, 0.5, pulse);
        vec3 c1 = hsv2rgb(vec3(fract(h * 1.5 + t * 0.1), 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(fract(h * 1.5 + 0.5 + t * 0.1), 1.0, 1.0));
        col = mix(c1, c2, ring) * (0.5 + diff * 0.5);
        col += vec3(1.0) * pow(fres, 3.0) * 2.0;
      `
    },
  {
        id: 'echolocation',
        name: 'Echolocation',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#00ff00', '#000000'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `
        float t = u_time * u_speed;
        float dist = pPerp / E;
        float wave = sin(dist * 30.0 - t * 8.0) * 0.5 + 0.5;
        float ring = smoothstep(0.45, 0.6, wave) * smoothstep(0.9, 0.8, dist);
        col = vec3(0.2, 1.0, 0.2) * ring * 2.0;
        col += vec3(0.8) * pow(fres, 4.0) * 0.5;
        alpha = ring * 0.8;
      `
    },
  {
        id: 'liquidcrystal',
        name: 'Liquid Crystal',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff80c0', '#80ff80'],
        gravity: true,
        transparent: true,
        depthWrite: false,
        fragBody: AXIS + `
        float t = u_time * u_speed;
        float hNorm = (h - u_levMin) / (u_levMax - u_levMin);
        float n = fbm(vObjPos * 3.0 + t * 0.5);
        float swirl = sin(pPerp * 5.0 + h * 10.0 + t * 2.0 + n * 5.0) * 0.5 + 0.5;
        vec3 c1 = hsv2rgb(vec3(hNorm * 0.7 + n * 0.2, 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(hNorm * 0.7 + 0.5 + n * 0.2, 1.0, 1.0));
        col = mix(c1, c2, swirl) * (0.4 + diff * 0.6);
        col += vec3(1.0) * pow(fres, 3.0) * 1.2;
        alpha = 0.7 + swirl * 0.3;
      `
    },
  {
        id: 'brainmelting',
        name: 'Brain Melting',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffaa00', '#aa00ff'],
        params: [{
            key: 'speed',
            label: 'Trip',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.0
        }],
        fragBody: `
        float t = u_time * u_speed;
        float n1 = fbm(vObjPos * 4.0 + t * 0.7);
        float n2 = fbm(vObjPos * 5.0 - t * 0.9);
        float n3 = fbm(vObjPos * 3.0 + vec3(t * 1.1, -t * 0.6, 0.0));
        float melt = sin(vObjPos.y * 10.0 + n1 * 8.0 + t) * 0.5 + 0.5;
        vec3 hot = vec3(1.0, 0.6, 0.1) * (1.0 - melt) * 2.0;
        vec3 cold = vec3(0.2, 0.1, 1.0) * melt * 2.0;
        col = mix(hot, cold, n3) * diff;
        col += vec3(1.0) * pow(fres, 4.0) * 1.8;
      `
    },
  {
        id: 'voxelize',
        name: 'Voxelizer',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff5500', '#0000ff'],
        gravity: true,
        fragBody: AXIS + `
        float voxelSize = 0.1;
        vec3 voxel = floor(vObjPos / voxelSize) * voxelSize;
        float noise = snoise(voxel * 3.0 + u_time * u_speed);
        float edge = step(0.5, fbm(voxel * 10.0));
        vec3 c1 = hsv2rgb(vec3(noise * 0.5 + 0.2, 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(noise * 0.5 + 0.7, 1.0, 1.0));
        col = mix(c1, c2, edge) * (0.5 + diff * 0.5);
        col += vec3(1.0) * pow(fres, 5.0) * 1.5;
      `
    },
  {
        id: 'cellularnoise',
        name: 'Cellular Chaos',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff0088', '#00ff88'],
        gravity: true,
        fragBody: AXIS + `
        float t = u_time * u_speed;
        vec3 p = vObjPos * 4.0;
        vec3 cell = floor(p) + 0.5;
        vec3 subs = p - cell;
        float dist = length(subs) * 0.8;
        float n = snoise(cell + t * 0.2);
        float brightness = 1.0 - smoothstep(0.0, 0.5, dist);
        vec3 c1 = hsv2rgb(vec3(n * 0.8, 1.0, 1.0));
        vec3 c2 = vec3(1.0);
        col = mix(vec3(0.05), c1, brightness * 0.8) * diff;
        col += c2 * pow(fres, 4.0) * 1.5;
      `
    },
  {
        id: 'timeslicer',
        name: 'Time Slicer',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff0000', '#00ff00'],
        gravity: true,
        fragBody: AXIS + `
        float t = u_time * u_speed;
        float slice = sin(h * 15.0 - t * 5.0) * 0.5 + 0.5;
        float thickness = abs(fract(h * 15.0 - t * 5.0) - 0.5) * 2.0;
        float sliceEdge = smoothstep(0.8, 0.9, thickness) * smoothstep(0.95, 0.9, thickness);
        float glow = exp(-thickness * 10.0);
        vec3 c1 = vec3(1.0, 0.2, 0.1) * glow;
        vec3 c2 = vec3(0.1, 1.0, 0.2) * sliceEdge;
        col = (c1 + c2) * 1.5 * (0.5 + diff * 0.5);
        col += vec3(1.0) * pow(fres, 3.0) * 1.2;
      `
    },
  {
        "id": "quantumfoam",
        "name": "Quantum Foam",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#00ffff", "#ff00ff"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float n = fbm(vObjPos * 8.0 + t * 0.3); float bubbles = step(0.6, n) * n; vec3 c1 = hsv2rgb(vec3(fract(h*2.0 + t*0.2), 1.0, 1.0)); vec3 c2 = vec3(1.0); col = mix(c1*0.3, c2, bubbles) * diff; col += vec3(1.0,0.7,1.0) * pow(fres,4.0)*1.5; alpha = bubbles*0.9; `",
        "params": [{
            "key": "speed",
            "label": "Brew",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.2
        }]
    },
  {
        "id": "plasmavortex",
        "name": "Plasma Vortex",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ffaa00", "#00ffff"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float r = pPerp/E; float a = ang + t*4.0 + r*15.0; float vortex = sin(a*5.0)*0.5+0.5; float rim = smoothstep(0.7,1.0,r); vec3 c = hsv2rgb(vec3(0.1+r*0.2+t*0.1,1.0,1.0)) * vortex; col = c * (0.3+diff*0.7); col += vec3(1.0,0.5,0.2)*pow(rim,2.0)*2.0; alpha = vortex*0.8+rim; `",
        "params": [{
            "key": "speed",
            "label": "Spin",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 2.0
        }]
    },
  {
        "id": "neonwireframe",
        "name": "Neon Wireframe",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#000000", "#ff0055"],
        "gravity": false,
        "fragBody": "float t = u_time * u_speed; float edge = abs(1.0 - 2.0 * fbm(vObjPos * 20.0 + t * 0.5)); edge = smoothstep(0.7,0.9,edge); vec3 wire = vec3(1.0, 0.0, 0.5) * edge * 3.0; col = wire * diff; col += vec3(1.0) * pow(fres,5.0)*0.5;",
        "params": [{
            "key": "speed",
            "label": "Wire",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.0
        }]
    },
  {
        "id": "datacorruption",
        "name": "Data Corruption",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#00ff00", "#000000"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float block = floor(h*20.0+t*2.0)*0.05; float glitch = step(0.9, snoise(vec2(block, t*5.0))); float g2 = step(0.95, fbm(vObjPos*30.0+t*10.0)); float bright = max(glitch,g2); col = vec3(0.2,1.0,0.2) * bright * 2.0; alpha = bright*0.9; `",
        "params": []
    },
  {
        "id": "oilslick",
        "name": "Oil Slick",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff00ff", "#00ff88"],
        "gravity": true,
        "transparent": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float film = fbm(vObjPos*2.0 + t*0.3)*0.7; vec3 iri = hsv2rgb(vec3(fract(h*5.0+film), 1.0, 1.0)); col = iri * (0.5+diff*0.5); col += vec3(1.0)*pow(fres,3.0)*1.2; alpha = 0.7+film*0.3; `",
        "params": [{
            "key": "speed",
            "label": "Flow",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.0
        }]
    },
  {
        "id": "cellularautomata",
        "name": "Cellular Automata",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff8800", "#ff0088"],
        "gravity": true,
        "fragBody": "AXIS + ` float t = u_time * u_speed; vec3 cell = floor(vObjPos*5.0) / 5.0; float n = snoise(cell + t*0.2); float state = step(0.3, n) * step(0.7, n); vec3 c1 = hsv2rgb(vec3(0.05, 1.0, 1.0)); vec3 c2 = hsv2rgb(vec3(0.8, 1.0, 1.0)); col = mix(c1, c2, state) * diff; col += vec3(1.0)*pow(fres,4.0)*0.8; `",
        "params": [{
            "key": "speed",
            "label": "Evolve",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.8
        }]
    },
  {
        "id": "psychedelicfractal",
        "name": "Psychedelic Fractal",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff00ff", "#ffff00"],
        "gravity": false,
        "params": [{
            "key": "speed",
            "label": "Trip",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 2.5
        }],
        "fragBody": "float t = u_time * u_speed; float z = 1.0; for(int i=0; i<3; i++){ z = fbm(vObjPos * z * 2.0 + t * 0.2) * 2.0; } vec3 c = hsv2rgb(vec3(z*0.8+t*0.1, 1.0, 1.0)); col = c * diff; col += vec3(1.0)*pow(fres,4.0)*2.0;"
    },
  {
        "id": "magneticflux",
        "name": "Magnetic Flux",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#00ff00", "#0000ff"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float field = sin(pPerp*10.0 - t*3.0 + h*5.0)*0.5+0.5; float lines = abs(field - round(field*5.0)/5.0)*10.0; lines = smoothstep(0.8,1.0,lines); col = vec3(0.2,1.0,0.2) * lines * 2.0; col += vec3(0.2,0.5,1.0) * pow(fres,4.0)*1.5; alpha = lines*0.9; `",
        "params": [{
            "key": "speed",
            "label": "Flux",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.5
        }]
    },
  {
        "id": "spectralmelt",
        "name": "Spectral Melt",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff0000", "#0000ff"],
        "gravity": true,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float melt = sin(vObjPos.y*10.0 + t*2.0 + fbm(vObjPos*2.0)*5.0)*0.5+0.5; vec3 hot = vec3(1.0,0.3,0.1) * (1.0-melt) * 2.0; vec3 cold = vec3(0.1,0.2,1.0) * melt * 2.0; col = mix(hot, cold, melt) * diff; col += vec3(1.0)*pow(fres,3.0)*1.5; `",
        "params": []
    },
  {
        "id": "timedilated",
        "name": "Time Dilated",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#00ffff", "#ff00ff"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float distort = sin(t*2.0)*0.5+0.5; float hh = h + distort*0.2*sin(pPerp*10.0); float stripe = sin(hh*20.0 - t*8.0)*0.5+0.5; stripe = smoothstep(0.3,0.7,stripe); vec3 c1 = hsv2rgb(vec3(0.6+distort*0.3,1.0,1.0)); vec3 c2 = vec3(1.0); col = mix(c1, c2, stripe) * diff; col += vec3(1.0)*pow(fres,4.0)*1.2; alpha = stripe*0.9; `",
        "params": [{
            "key": "speed",
            "label": "Warp",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 2.0
        }]
    },
  {
        "id": "holographicnoise",
        "name": "Holographic Noise",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff8800", "#00ff88"],
        "gravity": true,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float n = fbm(vObjPos*6.0 + t*0.5); float hologram = sin(n*15.0)*0.5+0.5; vec3 c = hsv2rgb(vec3(fract(h*2.0+t*0.1), 1.0, 1.0)); col = c * hologram * 2.0 * diff; col += vec3(1.0)*pow(fres,4.0)*0.8; `",
        "params": [{
            "key": "speed",
            "label": "Shift",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.3
        }]
    },
  {
        "id": "crackedenergy",
        "name": "Cracked Energy",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#4400ff", "#ffaa00"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float crack = max(0.0, 1.0 - abs(sin(pPerp*10.0 + t*2.0)*0.5+0.5 - 0.8)*10.0); crack += max(0.0, 1.0 - abs(sin(pPerp*7.0 - t*1.5 + h*3.0)*0.5+0.5 - 0.8)*10.0); crack = clamp(crack, 0.0, 1.0); col = vec3(0.6,0.2,1.0) * crack * 2.0; col += vec3(1.0,0.5,0.2)*pow(fres,3.0)*1.5; alpha = crack*0.9; `",
        "params": [{
            "key": "speed",
            "label": "Charge",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 2.2
        }]
    },
  {
        "id": "warpcore",
        "name": "Warp Core",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#00ffff", "#ffffff"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float pulse = sin(pPerp*5.0 - t*3.0)*0.5+0.5; float intensity = pow(pulse, 4.0) * 3.0; col = vec3(0.2,1.0,1.0) * intensity; col += vec3(1.0)*pow(fres,4.0)*1.5; alpha = intensity*0.8; `",
        "params": [{
            "key": "speed",
            "label": "Throttle",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 2.5
        }]
    },
  {
        "id": "chromaticaberration",
        "name": "Chromatic Aberration",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff0000", "#00ff00"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float hNorm = (h - u_levMin)/(u_levMax - u_levMin); vec3 colR = vec3(1.0,0.2,0.2) * step(0.7, fbm(vObjPos*10.0 + hNorm*0.1 + t*0.1)); vec3 colG = vec3(0.2,1.0,0.2) * step(0.7, fbm(vObjPos*10.0 - hNorm*0.1 + t*0.1)); vec3 colB = vec3(0.2,0.2,1.0) * step(0.7, fbm(vObjPos*10.0 + t*0.1)); col = (colR+colG+colB)*1.5; alpha = max(max(colR.r,colG.g),colB.b)*0.9; `",
        "params": [{
            "key": "speed",
            "label": "Fringe",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.0
        }]
    },
  {
        "id": "particlestorm",
        "name": "Particle Storm",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff5500", "#111111"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float p = 0.0; for(int i=0; i<5; i++){ float fi = float(i); p += step(0.85, snoise(vObjPos* (10.0+fi*2.0) + vec3(fi*t*1.5, -fi*t*0.8, 0.0))); } col = vec3(1.0,0.4,0.1) * p * 2.0; alpha = p*0.8; `",
        "params": [{
            "key": "speed",
            "label": "Storm",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 2.3
        }]
    },
  {
        "id": "bubbleuniverse",
        "name": "Bubble Universe",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff00cc", "#00ffcc"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float bubbles = step(0.5, snoise(vObjPos*5.0 + t*0.3)); bubbles *= smoothstep(0.3, 0.5, fbm(vObjPos*3.0)); col = hsv2rgb(vec3(fract(pPerp*2.0 + t*0.1), 1.0, 1.0)) * bubbles * 2.0; col += vec3(1.0)*pow(fres,4.0)*0.5; alpha = bubbles*0.9; `",
        "params": [{
            "key": "speed",
            "label": "Fizz",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.0
        }]
    },
  {
        "id": "mandala",
        "name": "Mandala",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ffaa00", "#aa00ff"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float r = pPerp/E; float a = ang + t; float symmetry = 6.0; float pattern = sin(a*symmetry + r*10.0)*0.5+0.5; pattern = smoothstep(0.5,0.7,pattern); vec3 c1 = hsv2rgb(vec3(0.1+r*0.2+t*0.05,1.0,1.0)); col = c1 * pattern * 2.0 * diff; col += vec3(1.0)*pow(fres,3.0)*0.6; alpha = pattern*0.9; `",
        "params": [{
            "key": "speed",
            "label": "Rotate",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.0
        }]
    },
  {
        "id": "vaporwave",
        "name": "Vaporwave",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff80c0", "#80ff80"],
        "gravity": true,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float wave = sin(pPerp*3.0 - t*2.0 + h*5.0)*0.5+0.5; vec3 pastel1 = vec3(1.0, 0.5, 0.7); vec3 pastel2 = vec3(0.5, 1.0, 0.7); col = mix(pastel1, pastel2, wave) * diff; col += vec3(1.0)*pow(fres,2.0)*1.0; `",
        "params": [{
            "key": "speed",
            "label": "Chill",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 0.8
        }]
    },
  {
        "id": "cyberpunkgrid",
        "name": "Cyberpunk Grid",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#ff00ff", "#00ffff"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; vec3 g = fract(vObjPos * 4.0); float grid = min(min(step(0.9,g.x), step(0.9,g.y)), step(0.9,g.z)); grid = smoothstep(0.0,0.1,grid); col = vec3(1.0,0.2,1.0) * grid * 2.0; col += vec3(0.2,1.0,1.0)*pow(fres,5.0)*1.2; alpha = grid*0.9; `",
        "params": [{
            "key": "speed",
            "label": "Scan",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.5
        }]
    },
  {
        "id": "radiatedglow",
        "name": "Radiated Glow",
        "category": "Mind-bending",
        "kind": "shader",
        "swatch": ["#00ff44", "#000000"],
        "gravity": true,
        "transparent": true,
        "additive": true,
        "depthWrite": false,
        "fragBody": "AXIS + ` float t = u_time * u_speed; float glow = exp(-pPerp * 5.0) * sin(t * 2.0 + h*10.0) * 0.5 + 0.5; glow *= smoothstep(0.0,0.2,glow); col = vec3(0.2,1.0,0.4) * glow * 2.0; alpha = glow*0.8; `",
        "params": [{
            "key": "speed",
            "label": "Pulse",
            "type": "range",
            "min": 0,
            "max": 4,
            "step": 0.05,
            "default": 1.7
        }]
    },
  {
        id: 'quantumfoam',
        name: 'Quantum Foam',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#00ffff', '#ff00ff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float n = fbm(vObjPos * 8.0 + t * 0.3); float bubbles = step(0.6, n) * n; vec3 c1 = hsv2rgb(vec3(fract(h*2.0 + t*0.2), 1.0, 1.0)); vec3 c2 = vec3(1.0); col = mix(c1*0.3, c2, bubbles) * diff; col += vec3(1.0,0.7,1.0) * pow(fres,4.0)*1.5; alpha = bubbles*0.9; `,
        params: [{
            key: 'speed',
            label: 'Brew',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.2
        }],
    },
  {
        id: 'plasmavortex',
        name: 'Plasma Vortex',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffaa00', '#00ffff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float r = rad; float a = ang + t*4.0 + r*15.0; float vortex = sin(a*5.0)*0.5+0.5; float rim = smoothstep(0.7,1.0,r); vec3 c = hsv2rgb(vec3(0.1+r*0.2+t*0.1,1.0,1.0)) * vortex; col = c * (0.3+diff*0.7); col += vec3(1.0,0.5,0.2)*pow(rim,2.0)*2.0; alpha = vortex*0.8+rim; `,
        params: [{
            key: 'speed',
            label: 'Spin',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.0
        }],
    },
  {
        id: 'datacorruption',
        name: 'Data Corruption',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#00ff00', '#000000'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float block = floor(h*20.0+t*2.0)*0.05; float glitch = step(0.9, snoise(vec3(block, t*5.0, 0.0))); float g2 = step(0.95, fbm(vObjPos*30.0+t*10.0)); float bright = max(glitch,g2); col = vec3(0.2,1.0,0.2) * bright * 2.0; alpha = bright*0.9; `,
        params: [],
    },
  {
        id: 'oilslick',
        name: 'Oil Slick',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff00ff', '#00ff88'],
        gravity: true,
        transparent: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float film = fbm(vObjPos*2.0 + t*0.3)*0.7; vec3 iri = hsv2rgb(vec3(fract(h*5.0+film), 1.0, 1.0)); col = iri * (0.5+diff*0.5); col += vec3(1.0)*pow(fres,3.0)*1.2; alpha = 0.7+film*0.3; `,
        params: [{
            key: 'speed',
            label: 'Flow',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.0
        }],
    },
  {
        id: 'cellularautomata',
        name: 'Cellular Automata',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff8800', '#ff0088'],
        gravity: true,
        fragBody: AXIS + ` float t = u_time * u_speed; vec3 cell = floor(vObjPos*5.0) / 5.0; float n = snoise(cell + t*0.2); float state = step(0.3, n) * step(0.7, n); vec3 c1 = hsv2rgb(vec3(0.05, 1.0, 1.0)); vec3 c2 = hsv2rgb(vec3(0.8, 1.0, 1.0)); col = mix(c1, c2, state) * diff; col += vec3(1.0)*pow(fres,4.0)*0.8; `,
        params: [{
            key: 'speed',
            label: 'Evolve',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.8
        }],
    },
  {
        id: 'magneticflux',
        name: 'Magnetic Flux',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#00ff00', '#0000ff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float field = sin(rad*10.0 - t*3.0 + h*5.0)*0.5+0.5; float lines = abs(field - floor(field*5.0 + 0.5)/5.0)*10.0; lines = smoothstep(0.8,1.0,lines); col = vec3(0.2,1.0,0.2) * lines * 2.0; col += vec3(0.2,0.5,1.0) * pow(fres,4.0)*1.5; alpha = lines*0.9; `,
        params: [{
            key: 'speed',
            label: 'Flux',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }],
    },
  {
        id: 'spectralmelt',
        name: 'Spectral Melt',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff0000', '#0000ff'],
        gravity: true,
        fragBody: AXIS + ` float t = u_time * u_speed; float melt = sin(vObjPos.y*10.0 + t*2.0 + fbm(vObjPos*2.0)*5.0)*0.5+0.5; vec3 hot = vec3(1.0,0.3,0.1) * (1.0-melt) * 2.0; vec3 cold = vec3(0.1,0.2,1.0) * melt * 2.0; col = mix(hot, cold, melt) * diff; col += vec3(1.0)*pow(fres,3.0)*1.5; `,
        params: [],
    },
  {
        id: 'timedilated',
        name: 'Time Dilated',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#00ffff', '#ff00ff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float distort = sin(t*2.0)*0.5+0.5; float hh = h + distort*0.2*sin(rad*10.0); float stripe = sin(hh*20.0 - t*8.0)*0.5+0.5; stripe = smoothstep(0.3,0.7,stripe); vec3 c1 = hsv2rgb(vec3(0.6+distort*0.3,1.0,1.0)); vec3 c2 = vec3(1.0); col = mix(c1, c2, stripe) * diff; col += vec3(1.0)*pow(fres,4.0)*1.2; alpha = stripe*0.9; `,
        params: [{
            key: 'speed',
            label: 'Warp',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.0
        }],
    },
  {
        id: 'holographicnoise',
        name: 'Holographic Noise',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff8800', '#00ff88'],
        gravity: true,
        fragBody: AXIS + ` float t = u_time * u_speed; float n = fbm(vObjPos*6.0 + t*0.5); float hologram = sin(n*15.0)*0.5+0.5; vec3 c = hsv2rgb(vec3(fract(h*2.0+t*0.1), 1.0, 1.0)); col = c * hologram * 2.0 * diff; col += vec3(1.0)*pow(fres,4.0)*0.8; `,
        params: [{
            key: 'speed',
            label: 'Shift',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.3
        }],
    },
  {
        id: 'crackedenergy',
        name: 'Cracked Energy',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#4400ff', '#ffaa00'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float crack = max(0.0, 1.0 - abs(sin(rad*10.0 + t*2.0)*0.5+0.5 - 0.8)*10.0); crack += max(0.0, 1.0 - abs(sin(rad*7.0 - t*1.5 + h*3.0)*0.5+0.5 - 0.8)*10.0); crack = clamp(crack, 0.0, 1.0); col = vec3(0.6,0.2,1.0) * crack * 2.0; col += vec3(1.0,0.5,0.2)*pow(fres,3.0)*1.5; alpha = crack*0.9; `,
        params: [{
            key: 'speed',
            label: 'Charge',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.2
        }],
    },
  {
        id: 'warpcore',
        name: 'Warp Core',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#00ffff', '#ffffff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float pulse = sin(rad*5.0 - t*3.0)*0.5+0.5; float intensity = pow(pulse, 4.0) * 3.0; col = vec3(0.2,1.0,1.0) * intensity; col += vec3(1.0)*pow(fres,4.0)*1.5; alpha = intensity*0.8; `,
        params: [{
            key: 'speed',
            label: 'Throttle',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.5
        }],
    },
  {
        id: 'chromaticaberration',
        name: 'Chromatic Aberration',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff0000', '#00ff00'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float hNorm = (h - u_levMin)/(u_levMax - u_levMin); vec3 colR = vec3(1.0,0.2,0.2) * step(0.7, fbm(vObjPos*10.0 + hNorm*0.1 + t*0.1)); vec3 colG = vec3(0.2,1.0,0.2) * step(0.7, fbm(vObjPos*10.0 - hNorm*0.1 + t*0.1)); vec3 colB = vec3(0.2,0.2,1.0) * step(0.7, fbm(vObjPos*10.0 + t*0.1)); col = (colR+colG+colB)*1.5; alpha = max(max(colR.r,colG.g),colB.b)*0.9; `,
        params: [{
            key: 'speed',
            label: 'Fringe',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.0
        }],
    },
  {
        id: 'particlestorm',
        name: 'Particle Storm',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff5500', '#111111'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float p = 0.0; for(int i=0; i<5; i++){ float fi = float(i); p += step(0.85, snoise(vObjPos* (10.0+fi*2.0) + vec3(fi*t*1.5, -fi*t*0.8, 0.0))); } col = vec3(1.0,0.4,0.1) * p * 2.0; alpha = p*0.8; `,
        params: [{
            key: 'speed',
            label: 'Storm',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.3
        }],
    },
  {
        id: 'bubbleuniverse',
        name: 'Bubble Universe',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff00cc', '#00ffcc'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float bubbles = step(0.5, snoise(vObjPos*5.0 + t*0.3)); bubbles *= smoothstep(0.3, 0.5, fbm(vObjPos*3.0)); col = hsv2rgb(vec3(fract(rad*2.0 + t*0.1), 1.0, 1.0)) * bubbles * 2.0; col += vec3(1.0)*pow(fres,4.0)*0.5; alpha = bubbles*0.9; `,
        params: [{
            key: 'speed',
            label: 'Fizz',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.0
        }],
    },
  {
        id: 'mandala',
        name: 'Mandala',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffaa00', '#aa00ff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float r = rad; float a = ang + t; float symmetry = 6.0; float pattern = sin(a*symmetry + r*10.0)*0.5+0.5; pattern = smoothstep(0.5,0.7,pattern); vec3 c1 = hsv2rgb(vec3(0.1+r*0.2+t*0.05,1.0,1.0)); col = c1 * pattern * 2.0 * diff; col += vec3(1.0)*pow(fres,3.0)*0.6; alpha = pattern*0.9; `,
        params: [{
            key: 'speed',
            label: 'Rotate',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.0
        }],
    },
  {
        id: 'vaporwave',
        name: 'Vaporwave',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff80c0', '#80ff80'],
        gravity: true,
        fragBody: AXIS + ` float t = u_time * u_speed; float wave = sin(rad*3.0 - t*2.0 + h*5.0)*0.5+0.5; vec3 pastel1 = vec3(1.0, 0.5, 0.7); vec3 pastel2 = vec3(0.5, 1.0, 0.7); col = mix(pastel1, pastel2, wave) * diff; col += vec3(1.0)*pow(fres,2.0)*1.0; `,
        params: [{
            key: 'speed',
            label: 'Chill',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 0.8
        }],
    },
  {
        id: 'cyberpunkgrid',
        name: 'Cyberpunk Grid',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff00ff', '#00ffff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; vec3 g = fract(vObjPos * 4.0); float grid = min(min(step(0.9,g.x), step(0.9,g.y)), step(0.9,g.z)); grid = smoothstep(0.0,0.1,grid); col = vec3(1.0,0.2,1.0) * grid * 2.0; col += vec3(0.2,1.0,1.0)*pow(fres,5.0)*1.2; alpha = grid*0.9; `,
        params: [{
            key: 'speed',
            label: 'Scan',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }],
    },
  {
        id: 'radiatedglow',
        name: 'Radiated Glow',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#00ff44', '#000000'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + ` float t = u_time * u_speed; float glow = exp(-rad * 5.0) * sin(t * 2.0 + h*10.0) * 0.5 + 0.5; glow *= smoothstep(0.0,0.2,glow); col = vec3(0.2,1.0,0.4) * glow * 2.0; alpha = glow*0.8; `,
        params: [{
            key: 'speed',
            label: 'Pulse',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.7
        }],
    },
  {
        id: 'gelatinouscube',
        name: 'Gelatinous Cube',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#8affb0', '#0a4a2a'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `
        float t = u_time * u_speed; float wobble = sin(rad * 4.0 + t * 2.0) * 0.2; float gel = fbm(vObjPos * 3.0 + t * 0.3 + wobble); float opacity = smoothstep(0.3, 0.7, gel) * 0.9; col = hsv2rgb(vec3(0.3 + gel * 0.2, 0.8, 1.0)) * opacity * 1.5; alpha = opacity;
      `,
        params: [{
            key: 'speed',
            label: 'Wiggle',
            type: 'range',
            min: 0,
            max: 3,
            step: 0.05,
            default: 1.2
        }],
    },
  {
        id: 'electricarc',
        name: 'Electric Arc',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ffffff', '#0022ff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `
        float t = u_time * u_speed; float arc = 0.0; for(int i=0; i<3; i++){ float fi = float(i); arc += pow(max(0.0, 1.0 - abs(sin(rad*(7.0+fi*3.0)+t*2.0 + fi*1.2)*0.5+0.5 - 0.7)*15.0), 3.0); } arc = clamp(arc,0.0,1.0); col = vec3(0.8,0.9,1.0) * arc * 4.0; col += vec3(1.0)*pow(fres,5.0)*0.8; alpha = arc*0.95;
      `,
        params: [{
            key: 'speed',
            label: 'Zap',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.5
        }],
    },
  {
        id: 'rainbowwave',
        name: 'Rainbow Wave',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff0066', '#00ffcc'],
        gravity: true,
        fragBody: AXIS + `
        float t = u_time * u_speed; float wave = sin(rad*6.0 + h*8.0 - t*4.0)*0.5+0.5; col = hsv2rgb(vec3(fract(h*2.0+t*0.1), 1.0, 1.0)) * wave * 2.0 * diff; col += vec3(1.0)*pow(fres,3.0)*1.2;
      `,
        params: [{
            key: 'speed',
            label: 'Speed',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 2.0
        }],
    },
  {
        id: 'phaseghost',
        name: 'Phase Ghost',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#d0f0ff', '#4a6a8a'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `
        float t = u_time * u_speed; float phase = sin(t*3.0 + rad*10.0)*0.5+0.5; float v = fbm(vObjPos*2.0 + t*0.7); col = vec3(0.8,0.9,1.0) * v * phase * 2.0; alpha = v*phase*0.85;
      `,
        params: [{
            key: 'speed',
            label: 'Phase',
            type: 'range',
            min: 0,
            max: 4,
            step: 0.05,
            default: 1.5
        }],
    },
  {
        id: 'wormhole',
        name: 'Wormhole',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#4400ff', '#ff00aa'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `
        float r = rad;
        float a = ang + u_time * u_speed * 3.0 + r * 20.0;
        float tunnel = sin(a * 5.0) * 0.5 + 0.5;
        float rim = smoothstep(0.8, 1.0, r);
        vec3 col1 = hsv2rgb(vec3(0.7 + r * 0.2, 1.0, 1.0));
        vec3 col2 = hsv2rgb(vec3(0.9 + r * 0.3, 1.0, 0.8));
        col = mix(col1, col2, tunnel);
        col += vec3(1.0, 0.2, 0.5) * pow(rim, 2.0) * 2.0;
        alpha = clamp(tunnel * 0.8 + rim, 0.0, 1.0);
      `,
    },
  {
        id: 'fiberoptic',
        name: 'Fiber Optic',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#00ffcc', '#ff00ff'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `
        float t = u_time * u_speed;
        float hNorm = (h - u_levMin) / (u_levMax - u_levMin);
        float s = sin(h * 30.0 + t * 5.0 + rad * 10.0) * 0.5 + 0.5;
        float bright = smoothstep(0.85, 1.0, s);
        vec3 c1 = hsv2rgb(vec3(hNorm * 0.8, 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(hNorm * 0.8 + 0.5, 1.0, 1.0));
        col = mix(c1, c2, bright) * bright * 3.0;
        col += vec3(1.0) * pow(fres, 3.0) * 1.5;
        alpha = bright * 0.9;
      `,
    },
  {
        id: 'neonpulse',
        name: 'Neon Pulse',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff00ff', '#00ffff'],
        gravity: true,
        fragBody: AXIS + `
        float t = u_time * u_speed;
        float pulse = sin(rad * 8.0 - t * 4.0) * 0.5 + 0.5;
        float ring = smoothstep(0.3, 0.4, pulse) * smoothstep(0.6, 0.5, pulse);
        vec3 c1 = hsv2rgb(vec3(fract(h * 1.5 + t * 0.1), 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(fract(h * 1.5 + 0.5 + t * 0.1), 1.0, 1.0));
        col = mix(c1, c2, ring) * (0.5 + diff * 0.5);
        col += vec3(1.0) * pow(fres, 3.0) * 2.0;
      `,
    },
  {
        id: 'echolocation',
        name: 'Echolocation',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#00ff00', '#000000'],
        gravity: true,
        transparent: true,
        additive: true,
        depthWrite: false,
        fragBody: AXIS + `
        float t = u_time * u_speed;
        float dist = rad;
        float wave = sin(dist * 30.0 - t * 8.0) * 0.5 + 0.5;
        float ring = smoothstep(0.45, 0.6, wave) * smoothstep(0.9, 0.8, dist);
        col = vec3(0.2, 1.0, 0.2) * ring * 2.0;
        col += vec3(0.8) * pow(fres, 4.0) * 0.5;
        alpha = ring * 0.8;
      `,
    },
  {
        id: 'liquidcrystal',
        name: 'Liquid Crystal',
        category: 'Mind-bending',
        kind: 'shader',
        swatch: ['#ff80c0', '#80ff80'],
        gravity: true,
        transparent: true,
        depthWrite: false,
        fragBody: AXIS + `
        float t = u_time * u_speed;
        float hNorm = (h - u_levMin) / (u_levMax - u_levMin);
        float n = fbm(vObjPos * 3.0 + t * 0.5);
        float swirl = sin(rad * 5.0 + h * 10.0 + t * 2.0 + n * 5.0) * 0.5 + 0.5;
        vec3 c1 = hsv2rgb(vec3(hNorm * 0.7 + n * 0.2, 1.0, 1.0));
        vec3 c2 = hsv2rgb(vec3(hNorm * 0.7 + 0.5 + n * 0.2, 1.0, 1.0));
        col = mix(c1, c2, swirl) * (0.4 + diff * 0.6);
        col += vec3(1.0) * pow(fres, 3.0) * 1.2;
        alpha = 0.7 + swirl * 0.3;
      `,
    },
  {
    id: 'moire_pattern', name: 'Moiré Interference', category: 'Mind-bending', kind: 'shader', swatch: ['#000000', '#000000'],
    params: [
      { key: 'scaleA', label: 'Scale A', type: 'range', min: 0.5, max: 3.0, step: 0.01, default: 1.5 },
      { key: 'scaleB', label: 'Scale B', type: 'range', min: 0.5, max: 3.0, step: 0.01, default: 1.0 },
      { key: 'angleOffset', label: 'Angle Offset', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'contrast', label: 'Contrast', type: 'range', min: 0.5, max: 2.0, step: 0.01, default: 1.0 },
      { key: 'colorShift', label: 'Color Shift', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 0.5 },
    ],
    fragUniforms: `
      uniform float u_scaleA;
      uniform float u_scaleB;
      uniform float u_angleOffset;
      uniform float u_contrast;
      uniform float u_colorShift;
    `,
    fragBody: `
      vec2 uv = vUv;
      float angle = u_angleOffset * 3.14159;
      vec2 uv1 = vec2(uv.x * cos(angle) - uv.y * sin(angle), uv.x * sin(angle) + uv.y * cos(angle)) * 10.0 * u_scaleA;
      vec2 uv2 = uv * 10.0 * u_scaleB;
      float pattern1 = sin(uv1.x) * sin(uv1.y);
      float pattern2 = sin(uv2.x) * sin(uv2.y);
      float moire = abs(pattern1 - pattern2);
      moire = pow(moire, u_contrast);
      col = hsv2rgb(vec3(moire * 0.5 + u_colorShift * 0.7, 0.8, 0.9));
      
    `,
  },
  {
    id: 'distorted_grid', name: 'Distorted Grid', category: 'Mind-bending', kind: 'shader', swatch: ['#FFFFFF', '#7f7f7f'],
    params: [
      { key: 'frequency', label: 'Frequency', type: 'range', min: 0.5, max: 4.0, step: 0.01, default: 1.0 },
      { key: 'distortionAmount', label: 'Distortion Amount', type: 'range', min: 0.0, max: 2.0, step: 0.01, default: 0.8 },
      { key: 'lineThickness', label: 'Line Thickness', type: 'range', min: 0.1, max: 1.0, step: 0.01, default: 0.5 },
      { key: 'color1', label: 'Color1', type: 'color', default: '#FFFFFF' },
      { key: 'color2', label: 'Color2', type: 'color', default: '#FFFFFF' },
    ],
    fragUniforms: `
      uniform float u_frequency;
      uniform float u_distortionAmount;
      uniform float u_lineThickness;
      uniform vec3 u_color1;
      uniform vec3 u_color2;
    `,
    fragBody: `
      vec2 uv = vUv * u_frequency;
      float distort = snoise(vec3(uv * 1.5 + u_time * 0.2, 0.5)) * u_distortionAmount;
      float gridX = abs(sin(uv.x * 3.14159 * 2.0 + distort)) > (1.0 - u_lineThickness) ? 0.0 : 1.0;
      float gridY = abs(sin(uv.y * 3.14159 * 2.0 + distort)) > (1.0 - u_lineThickness) ? 0.0 : 1.0;
      float grid = 1.0 - gridX * gridY;
      col = mix(u_color1, u_color2, grid);
      
    `,
  },
];
