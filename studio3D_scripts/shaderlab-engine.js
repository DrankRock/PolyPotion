// ============================================================
// shaderlab-engine.js — SHADER LAB (LabEngine + graph→GLSL compiler)
// The node editor lives in ShaderLab.dc.html; this file owns:
//   · NODE_DEFS — the node library (ports, controls, GLSL emitters)
//   · compileGraph(nodes, wires, settings, mode) — graph → preset pieces
//       mode 'preview': every number/colour becomes a uniform (live tweak,
//                       no recompile);  mode 'export': literals baked in,
//                       only ◈-exposed Value/Colour nodes stay as params.
//   · LabEngine — preview viewport. Primitives or a delivered character;
//       materials built with the SAME buildShaderMaterial() Showcase uses,
//       so what you see here is exactly what the shelf will render.
// ============================================================
import * as THREE from 'three';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { buildShaderMaterial } from './shader-lib.js';
import { fetchAssetBuffer } from './chunk-loader.js';

// ---------------------------------------------------------- NODE LIBRARY
// Port types: f float · v2 vec2 · v3 vec3 · c colour (vec3)
// ins:  { k, label, t, def|defExpr, min, max, step }  (def → inline control)
// ctrls:{ k, type:'range'|'color'|'select'|'expose', ... }
const VORO_GLSL = `
vec3 vhash3(vec3 p){ p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6))); return fract(sin(p)*43758.5453123); }
float voro(vec3 p){ vec3 ip = floor(p); vec3 fp = fract(p); float d = 1.0;
  for(int k=-1;k<=1;k++) for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec3 b = vec3(float(i),float(j),float(k)); vec3 r = b + vhash3(ip+b) - fp; d = min(d, dot(r,r)); }
  return sqrt(d); }
`;

export const NODE_DEFS = {
  // ---- inputs
  time:    { title: 'Time', group: 'Input', outs: [{ k: 'out', label: 't', t: 'f' }], ins: [], ctrls: [],
             emit: (O) => `float ${O.out} = u_time * u_speed;` },
  pos:     { title: 'Position', group: 'Input', outs: [{ k: 'out', label: 'xyz', t: 'v3' }], ins: [], ctrls: [],
             emit: (O) => `vec3 ${O.out} = vObjPos;` },
  uv:      { title: 'UV', group: 'Input', outs: [{ k: 'out', label: 'uv', t: 'v2' }], ins: [], ctrls: [],
             emit: (O) => `vec2 ${O.out} = vUv;` },
  normal:  { title: 'Normal', group: 'Input', outs: [{ k: 'out', label: 'n', t: 'v3' }], ins: [], ctrls: [],
             emit: (O) => `vec3 ${O.out} = N;` },
  fresnel: { title: 'Fresnel', group: 'Input', outs: [{ k: 'out', label: 'f', t: 'f' }],
             ins: [{ k: 'power', label: 'power', t: 'f', def: 2.5, min: 0.5, max: 8, step: 0.1 }], ctrls: [],
             emit: (O, I) => `float ${O.out} = pow(fres, ${I.power});` },
  light:   { title: 'Key light', group: 'Input', outs: [{ k: 'out', label: 'f', t: 'f' }], ins: [], ctrls: [],
             emit: (O) => `float ${O.out} = clamp(diff, 0.0, 1.4);` },
  basetex: { title: 'Own texture', group: 'Input', outs: [{ k: 'out', label: 'rgb', t: 'c' }], ins: [], ctrls: [],
             emit: (O) => `vec3 ${O.out} = (u_hasBaseMap > 0.5) ? baseTex : vec3(0.62);` },

  // ---- patterns
  noise:   { title: 'Noise (fbm)', group: 'Pattern', outs: [{ k: 'out', label: 'f', t: 'f' }],
             ins: [{ k: 'pos', label: 'pos', t: 'v3', defExpr: 'vObjPos' },
                   { k: 'scale', label: 'scale', t: 'f', def: 3, min: 0.2, max: 14, step: 0.1 },
                   { k: 'speed', label: 'flow', t: 'f', def: 0.4, min: 0, max: 3, step: 0.05 }], ctrls: [],
             emit: (O, I) => `float ${O.out} = 0.5 + 0.5 * fbm(${I.pos} * ${I.scale} + vec3(0.0, u_time * u_speed * ${I.speed}, u_time * u_speed * ${I.speed} * 0.7));` },
  voronoi: { title: 'Voronoi', group: 'Pattern', needs: 'voro', outs: [{ k: 'out', label: 'f', t: 'f' }],
             ins: [{ k: 'pos', label: 'pos', t: 'v3', defExpr: 'vObjPos' },
                   { k: 'scale', label: 'scale', t: 'f', def: 5, min: 0.5, max: 24, step: 0.1 },
                   { k: 'speed', label: 'flow', t: 'f', def: 0.3, min: 0, max: 3, step: 0.05 }], ctrls: [],
             emit: (O, I) => `float ${O.out} = voro(${I.pos} * ${I.scale} + vec3(0.0, u_time * u_speed * ${I.speed}, u_time * u_speed * ${I.speed} * 0.5));` },
  stripes: { title: 'Stripes', group: 'Pattern', outs: [{ k: 'out', label: 'f', t: 'f' }],
             ins: [{ k: 'pos', label: 'pos', t: 'v3', defExpr: 'vObjPos' },
                   { k: 'freq', label: 'freq', t: 'f', def: 9, min: 1, max: 48, step: 0.5 },
                   { k: 'speed', label: 'scroll', t: 'f', def: 0, min: 0, max: 4, step: 0.05 }], ctrls: [],
             emit: (O, I) => `float ${O.out} = 0.5 + 0.5 * sin(dot(${I.pos}, vec3(1.0, 0.62, 0.35)) * ${I.freq} + u_time * u_speed * ${I.speed} * 4.0);` },

  // ---- math
  float:   { title: 'Value', group: 'Math', outs: [{ k: 'out', label: 'f', t: 'f' }], ins: [],
             ctrls: [{ k: 'val', type: 'range', def: 0.5, min: 0, max: 1, step: 0.01 }, { k: 'expose', type: 'expose' }],
             emit: (O, I, C) => `float ${O.out} = ${C.val};` },
  math:    { title: 'Math', group: 'Math', outs: [{ k: 'out', label: 'f', t: 'f' }],
             ins: [{ k: 'a', label: 'a', t: 'f', def: 0.5, min: 0, max: 2, step: 0.01 },
                   { k: 'b', label: 'b', t: 'f', def: 0.5, min: 0, max: 2, step: 0.01 }],
             ctrls: [{ k: 'op', type: 'select', def: 'multiply', options: ['add', 'subtract', 'multiply', 'divide', 'power', 'min', 'max', 'one minus a'] }],
             emit: (O, I, C, n) => {
               const op = (n.vals && n.vals.op) || 'multiply';
               const ex = { add: `${I.a} + ${I.b}`, subtract: `${I.a} - ${I.b}`, multiply: `${I.a} * ${I.b}`,
                 divide: `${I.a} / (${I.b} + 1e-5)`, power: `pow(max(${I.a}, 0.0), ${I.b})`,
                 min: `min(${I.a}, ${I.b})`, max: `max(${I.a}, ${I.b})`, 'one minus a': `1.0 - ${I.a}` }[op];
               return `float ${O.out} = ${ex};`;
             } },
  smooth:  { title: 'Smoothstep', group: 'Math', outs: [{ k: 'out', label: 'f', t: 'f' }],
             ins: [{ k: 't', label: 'in', t: 'f', def: 0.5, min: 0, max: 1, step: 0.01 },
                   { k: 'lo', label: 'low', t: 'f', def: 0.25, min: 0, max: 1, step: 0.01 },
                   { k: 'hi', label: 'high', t: 'f', def: 0.75, min: 0, max: 1, step: 0.01 }], ctrls: [],
             emit: (O, I) => `float ${O.out} = smoothstep(${I.lo}, ${I.hi}, ${I.t});` },
  posterize: { title: 'Posterize', group: 'Math', outs: [{ k: 'out', label: 'f', t: 'f' }],
             ins: [{ k: 'x', label: 'in', t: 'f', def: 0.5, min: 0, max: 1, step: 0.01 },
                   { k: 'steps', label: 'steps', t: 'f', def: 4, min: 1, max: 16, step: 1 }], ctrls: [],
             emit: (O, I) => `float ${O.out} = floor(${I.x} * ${I.steps} + 1e-4) / max(${I.steps}, 1.0);` },

  // ---- colour
  color:   { title: 'Colour', group: 'Colour', outs: [{ k: 'out', label: 'rgb', t: 'c' }], ins: [],
             ctrls: [{ k: 'val', type: 'color', def: '#4aa3ff' }, { k: 'expose', type: 'expose' }],
             emit: (O, I, C) => `vec3 ${O.out} = ${C.val};` },
  mix:     { title: 'Mix', group: 'Colour', outs: [{ k: 'out', label: 'rgb', t: 'c' }],
             ins: [{ k: 'a', label: 'a', t: 'c', def: '#141d38' },
                   { k: 'b', label: 'b', t: 'c', def: '#6fd7c0' },
                   { k: 't', label: 'blend', t: 'f', def: 0.5, min: 0, max: 1, step: 0.01 }], ctrls: [],
             emit: (O, I) => `vec3 ${O.out} = mix(${I.a}, ${I.b}, clamp(${I.t}, 0.0, 1.0));` },
  hsv:     { title: 'HSV', group: 'Colour', outs: [{ k: 'out', label: 'rgb', t: 'c' }],
             ins: [{ k: 'h', label: 'hue', t: 'f', def: 0.6, min: 0, max: 1, step: 0.01 },
                   { k: 's', label: 'sat', t: 'f', def: 0.8, min: 0, max: 1, step: 0.01 },
                   { k: 'v', label: 'val', t: 'f', def: 1, min: 0, max: 2, step: 0.01 }], ctrls: [],
             emit: (O, I) => `vec3 ${O.out} = hsv2rgb(vec3(fract(${I.h}), clamp(${I.s}, 0.0, 1.0), max(${I.v}, 0.0)));` },

  // ---- output
  output:  { title: 'Output', group: 'Output', outs: [],
             ins: [{ k: 'col', label: 'colour', t: 'c', def: '#8a8f98' },
                   { k: 'alpha', label: 'alpha', t: 'f', def: 1, min: 0, max: 1, step: 0.01 },
                   { k: 'glow', label: 'glow', t: 'f', def: 0, min: 0, max: 2, step: 0.01 }], ctrls: [],
             emit: null },
};

// ---------------------------------------------------------- COMPILER
const fmt = (v) => { const n = +v; return Number.isFinite(n) ? (Number.isInteger(n) ? n + '.0' : String(n)) : '0.0'; };
const hex2vec = (h) => {
  const c = new THREE.Color(h || '#888888');
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};
function coerce(expr, from, to) {
  const F = from === 'c' ? 'v3' : from, T = to === 'c' ? 'v3' : to;
  if (F === T) return expr;
  if (F === 'f' && T === 'v3') return `vec3(${expr})`;
  if (F === 'f' && T === 'v2') return `vec2(${expr})`;
  if (F === 'v2' && T === 'v3') return `vec3(${expr}, 0.0)`;
  if (F === 'v3' && T === 'f') return `dot(${expr}, vec3(0.299, 0.587, 0.114))`;
  if (F === 'v3' && T === 'v2') return `(${expr}).xy`;
  if (F === 'v2' && T === 'f') return `(${expr}).x`;
  return expr;
}

// nodes: [{id, type, x, y, vals:{}, expose:{}, labels:{}}]  wires: [{from:[id,key], to:[id,key]}]
export function compileGraph(nodes, wires, settings, mode) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const wireTo = new Map(wires.map(w => [w.to[0] + '¦' + w.to[1], w]));
  const out = nodes.find(n => n.type === 'output');
  if (!out) return { error: 'No Output node' };

  const lines = [], decls = [], params = [], values = {}, helpers = new Set();
  const emitted = new Map(), visiting = new Set();
  let err = null;

  const uni = (node, key, type, val, label, meta) => {
    const k = 'n' + node.id + '_' + key;
    decls.push('uniform ' + (type === 'color' ? 'vec3' : 'float') + ' u_' + k + ';');
    params.push(Object.assign({ key: k, label: label || key, type: type === 'color' ? 'color' : 'range', default: val }, meta || {}));
    values[k] = val;
    return 'u_' + k;
  };

  const ctrlExpr = (node, c) => {
    const v = node.vals && node.vals[c.k] !== undefined ? node.vals[c.k] : c.def;
    const exposed = node.expose && node.expose[c.k.replace(/^val$/, 'val')];
    const label = (node.labels && node.labels.val) || (c.type === 'color' ? 'Colour' : 'Value');
    if (mode === 'preview') return uni(node, c.k, c.type === 'color' ? 'color' : 'range', v, label, c.type === 'color' ? null : { min: c.min, max: c.max, step: c.step });
    if (exposed) return uni(node, c.k, c.type === 'color' ? 'color' : 'range', v, label, c.type === 'color' ? null : { min: c.min, max: c.max, step: c.step });
    return c.type === 'color' ? hex2vec(v) : fmt(v);
  };

  const inExpr = (node, d) => {
    const w = wireTo.get(node.id + '¦' + d.k);
    if (w) {
      const src = byId.get(w.from[0]);
      if (!src) return d.defExpr || (d.t === 'c' ? hex2vec(d.def) : fmt(d.def || 0));
      const O = emitNode(src);
      if (!O) return d.t === 'c' || d.t === 'v3' ? 'vec3(0.0)' : '0.0';
      const port = (NODE_DEFS[src.type].outs || []).find(o => o.k === w.from[1]) || NODE_DEFS[src.type].outs[0];
      return coerce(O[port.k], port.t, d.t);
    }
    if (d.defExpr) return d.defExpr;
    const v = node.vals && node.vals[d.k] !== undefined ? node.vals[d.k] : d.def;
    if (d.t === 'c') return mode === 'preview' ? uni(node, d.k, 'color', v, d.label) : hex2vec(v);
    return mode === 'preview' ? uni(node, d.k, 'range', v, d.label, { min: d.min, max: d.max, step: d.step }) : fmt(v);
  };

  function emitNode(n) {
    if (emitted.has(n.id)) return emitted.get(n.id);
    if (visiting.has(n.id)) { err = 'Cycle in graph at ' + NODE_DEFS[n.type].title; return null; }
    visiting.add(n.id);
    const def = NODE_DEFS[n.type];
    if (def.needs) helpers.add(def.needs);
    const O = {}; (def.outs || []).forEach(o => { O[o.k] = 'n' + n.id + '_' + o.k; });
    const I = {}; (def.ins || []).forEach(d => { I[d.k] = inExpr(n, d); });
    const C = {}; (def.ctrls || []).forEach(c => { if (c.type === 'range' || c.type === 'color') C[c.k] = ctrlExpr(n, c); });
    visiting.delete(n.id);
    if (def.emit) lines.push('  ' + def.emit(O, I, C, n));
    emitted.set(n.id, O);
    return O;
  }

  // output node: resolve its inputs directly
  const def = NODE_DEFS.output;
  const I = {}; def.ins.forEach(d => { I[d.k] = inExpr(out, d); });
  if (err) return { error: err };

  lines.push('  vec3 _fin = ' + I.col + ';');
  if (settings && settings.lit) lines.push('  col = _fin * (0.30 + 0.85 * diff) + _fin * 0.20 * pow(fres, 3.0);');
  else lines.push('  col = _fin;');
  lines.push('  col += _fin * ' + I.glow + ';');
  lines.push('  alpha = ' + I.alpha + ';');

  let helperSrc = '';
  if (helpers.has('voro')) helperSrc += VORO_GLSL;

  return {
    fragUniforms: decls.join('\n') + (helperSrc ? '\n' + helperSrc : ''),
    fragBody: lines.join('\n'),
    params, values, error: null,
  };
}

// ---------------------------------------------------------- PREVIEW ENGINE
export class LabEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    const vpBg = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };
    this.scene.background = new THREE.Color(vpBg());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(vpBg()); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.02, 60);
    this.camera.position.set(0.9, 1.35, 2.4);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.9, 0);
    this.controls.autoRotate = true; this.controls.autoRotateSpeed = 1.1;

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(2.4, 4.2, 3.0); this.scene.add(key);

    const grid = new THREE.GridHelper(8, 20, 0x39414f, 0x23272e);
    grid.material.opacity = 0.45; grid.material.transparent = true; this.scene.add(grid);

    this.holder = new THREE.Group(); this.scene.add(this.holder);
    this.meshes = []; this._built = []; this._current = null;
    this.modelName = ''; this.kind = '';
    this.onStatus = null;
    this._fbx = new FBXLoader(); this._gltf = new GLTFLoader(); this._obj = new OBJLoader();
    this._clock = new THREE.Clock();

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    this.setPrimitive('sphere');
    if (typeof window !== 'undefined') window.__labEngine = this;
  }

  _status(m) { if (this.onStatus) this.onStatus(m); }

  _clear() {
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    this.meshes = [];
  }

  setPrimitive(kind) {
    this._clear();
    let geo;
    if (kind === 'knot') geo = new THREE.TorusKnotGeometry(0.42, 0.15, 220, 36);
    else if (kind === 'torus') geo = new THREE.TorusGeometry(0.52, 0.2, 40, 90);
    else if (kind === 'cube') geo = new THREE.BoxGeometry(0.85, 0.85, 0.85, 24, 24, 24);
    else geo = new THREE.SphereGeometry(0.58, 96, 64);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x8a8f98 }));
    m.position.y = 0.95; m.frustumCulled = false;
    this.holder.add(m); this.meshes = [{ mesh: m, baseMap: null }];
    this.kind = kind; this.modelName = kind;
    this._fit(0.75);
    this._reapply();
  }

  async loadUrl(url, ext, opts) {
    const buf = await fetchAssetBuffer(url, opts);
    return this._ingest(buf, ext || (url.split('.').pop() || '').toLowerCase(), url.split('/').pop());
  }
  async loadBuffer(buf, name, ext) { return this._ingest(buf, (ext || (name || '').split('.').pop() || 'glb').toLowerCase(), name); }
  async loadFile(file) { return this._ingest(await file.arrayBuffer(), (file.name.split('.').pop() || '').toLowerCase(), file.name); }

  async _ingest(buf, ext, name) {
    this._status('Parsing ' + (name || 'model') + '…');
    let obj;
    if (ext === 'glb' || ext === 'gltf') obj = (await new Promise((res, rej) => this._gltf.parse(buf, '', res, rej))).scene;
    else if (ext === 'fbx') obj = this._fbx.parse(buf, '');
    else if (ext === 'obj') obj = this._obj.parse(new TextDecoder().decode(buf));
    else throw new Error('Unsupported format .' + ext);
    this._clear();
    this.holder.add(obj);
    obj.traverse(o => {
      if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
        o.frustumCulled = false;
        const mt = Array.isArray(o.material) ? o.material[0] : o.material;
        this.meshes.push({ mesh: o, baseMap: (mt && mt.map) || null });
      }
    });
    if (!this.meshes.length) throw new Error('No meshes in file');
    this.kind = 'char'; this.modelName = name || 'character';
    this._fit(1.0);
    this._reapply();
    this._status('');
    return { name: this.modelName };
  }

  _fit(pad) {
    const box = new THREE.Box3().setFromObject(this.holder);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3());
    const r = Math.max(s.x, s.y, s.z) * 0.5 || 1;
    this.camera.near = Math.max(r / 200, 1e-4); this.camera.far = r * 50; this.camera.updateProjectionMatrix();
    this.controls.target.copy(c);
    this.controls.minDistance = r * 0.3; this.controls.maxDistance = r * 10;
    this.camera.position.set(c.x + r * 0.7, c.y + r * 0.55, c.z + r * 2.6 * (pad || 1));
  }

  // Build + apply a compiled preset. One material per distinct base map so a
  // textured character keeps its own albedo under the shader.
  apply(preset, values) {
    this._current = { preset, values };
    this._built.forEach(b => { try { b.material.dispose(); } catch (e) {} });
    this._built = [];
    const cache = new Map();
    this.meshes.forEach(({ mesh, baseMap }) => {
      const k = baseMap ? baseMap.uuid : '∅';
      let built = cache.get(k);
      if (!built) { built = buildShaderMaterial(preset, values, baseMap, 1.0); cache.set(k, built); this._built.push(built); }
      mesh.material = built.material;
    });
  }
  _reapply() { if (this._current) this.apply(this._current.preset, this._current.values); }

  setUniform(key, val) {
    this._built.forEach(b => {
      const u = b.uniforms['u_' + key];
      if (!u) return;
      if (u.value && u.value.isColor) u.value.set(val); else u.value = val;
    });
  }
  setAutoRotate(on) { this.controls.autoRotate = on; }

  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = Math.max(2, el.clientWidth), h = Math.max(2, el.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return;
    const t = this._clock.getElapsedTime();
    this._built.forEach(b => { if (b.uniforms.u_time) b.uniforms.u_time.value = t; });
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
  dispose() { this._run = false; this._ro.disconnect(); this.renderer.dispose(); }
}
