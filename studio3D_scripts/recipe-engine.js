// ============================================================
// recipe-engine.js — RECIPE  (RecipeEngine + headless step runners)
// The non-destructive pipeline: a recipe is a graph of processing steps
// wired together, and every wire carries a GLB ArrayBuffer. Each step
// implements the headless contract documented in RECIPES.md:
//
//     run(glbBuffer, params, ctx) → Promise<{ buffer, stats }>
//
// — GLB in, GLB out, no DOM, no renderer, deterministic. Steps reuse the
// suite's pure kernels: qem.js (decimate), remesh.js (voxel remesh) and
// ao-engine.js's exported BVH + occlusion test (vertex AO). The class at
// the bottom (RecipeEngine) is the thin viewport that previews whichever
// node the user selects — the runners never touch it.
// Loaded by dynamic import from Recipe.dc.html, like the other engines.
// ============================================================
import * as THREE from 'three';
import { applyOrbitScheme } from './nav-scheme.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { decimateMesh } from './qem.js';
import { voxelRemesh } from './remesh.js';
import { buildBVH, rayOccluded } from './ao-engine.js';
import { fetchAssetBuffer } from './chunk-loader.js';

// ---------------------------------------------------------- GLB helpers
const _gltf = new GLTFLoader();
const _fbx = new FBXLoader();
const _obj = new OBJLoader();

async function parseGLB(buffer) {
  const g = await new Promise((res, rej) => _gltf.parse(buffer.slice(0), '', res, rej));
  return g.scene;
}

async function exportGLB(root) {
  const exporter = new GLTFExporter();
  return await new Promise((res, rej) => exporter.parse(root, res, rej, { binary: true }));
}

function eachMesh(root, fn) {
  const out = [];
  root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) out.push(o); });
  out.forEach(fn);
  return out.length;
}

function statsOf(root) {
  let tris = 0, verts = 0, meshes = 0;
  root.traverse(o => {
    if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
      meshes++;
      const g = o.geometry;
      verts += g.attributes.position.count;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    }
  });
  return { tris: Math.round(tris), verts, meshes };
}

function bboxOf(root) { const b = new THREE.Box3().setFromObject(root); return b; }

// non-indexed world-space triangle soup of the whole model (9 floats/tri)
function soupOf(root) {
  const parts = [];
  let total = 0;
  root.updateWorldMatrix(true, true);
  eachMesh(root, m => {
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const src = g.attributes.position;
    const arr = new Float32Array(src.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < src.count; i++) { v.fromBufferAttribute(src, i).applyMatrix4(m.matrixWorld); arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z; }
    parts.push(arr); total += arr.length;
  });
  const out = new Float32Array(total);
  let o = 0; parts.forEach(p => { out.set(p, o); o += p.length; });
  return out;
}

function grayMat() { return new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.85 }); }

// ---------------------------------------------------------- SOURCE NORMALIZE
// One-time conversion at the source node: any format → flattened static GLB.
// World transforms are baked into the geometry, skinning/animation dropped
// (recipes v1 are static-geometry pipelines — see RECIPES.md), materials
// carried as color + map.
export async function normalize(buffer, ext, ctx) {
  const status = (ctx && ctx.onStatus) || (() => {});
  status('Parsing…');
  let obj = null;
  ext = (ext || 'glb').toLowerCase();
  if (ext === 'glb' || ext === 'gltf') obj = await parseGLB(buffer);
  else if (ext === 'fbx') obj = _fbx.parse(buffer, '');
  else if (ext === 'obj') obj = _obj.parse(new TextDecoder().decode(buffer));
  else throw new Error('Unsupported format .' + ext);

  status('Flattening…');
  obj.updateWorldMatrix(true, true);
  const scene = new THREE.Scene();
  eachMesh(obj, m => {
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    // strip rig attributes — static pipeline
    ['skinIndex', 'skinWeight'].forEach(a => { if (g.attributes[a]) g.deleteAttribute(a); });
    g.morphAttributes = {};
    const src = Array.isArray(m.material) ? m.material[0] : m.material;
    const mat = grayMat();
    if (src) {
      if (src.color) mat.color.copy(src.color);
      if (src.map) mat.map = src.map;
      if (src.vertexColors) mat.vertexColors = true;
    }
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = m.name || 'mesh';
    scene.add(mesh);
  });
  if (!scene.children.length) throw new Error('No triangle meshes found in file');
  status('Packing GLB…');
  const out = await exportGLB(scene);
  return { buffer: out, stats: statsOf(scene) };
}

// ---------------------------------------------------------- STEP REGISTRY
// Every entry: { name, icon, tint, desc, params:[{k,label,min,max,step,def,unit}], run }
export const STEPS = {

  weld: {
    name: 'Weld verts', icon: '⌒', tint: '#5cc0cc',
    desc: 'Merge duplicate vertices within a tolerance — seams close, normals smooth across them.',
    params: [{ k: 'tol', label: 'Tolerance', min: 1, max: 40, step: 1, def: 4, unit: '×10⁻⁴ of size' }],
    async run(buffer, p, ctx) {
      const root = await parseGLB(buffer);
      const size = bboxOf(root).getSize(new THREE.Vector3()).length() || 1;
      const tol = (p.tol == null ? 4 : p.tol) * 1e-4 * size;
      ctx.onStatus('Welding…');
      eachMesh(root, m => {
        let g = m.geometry.index ? m.geometry : m.geometry.toNonIndexed();
        g = mergeVertices(g, tol);
        g.computeVertexNormals();
        m.geometry = g;
      });
      return { buffer: await exportGLB(root), stats: statsOf(root) };
    },
  },

  decimate: {
    name: 'Decimate', icon: '◇', tint: '#c88be0',
    desc: 'Quadric edge-collapse — keep a fraction of the triangles, keep the silhouette. Rebuilds the surface (UVs are lost).',
    params: [{ k: 'keep', label: 'Keep', min: 3, max: 95, step: 1, def: 40, unit: '% of triangles' }],
    async run(buffer, p, ctx) {
      const root = await parseGLB(buffer);
      const ratio = Math.max(0.03, Math.min(0.95, (p.keep == null ? 40 : p.keep) / 100));
      const meshes = [];
      root.traverse(o => { if (o.isMesh && o.geometry && o.geometry.attributes && o.geometry.attributes.position) meshes.push(o); });
      for (const m of meshes) {
        const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
        const pos = g.attributes.position.array;
        ctx.onStatus('Decimating ' + (pos.length / 9 | 0).toLocaleString() + ' tris…');
        const r = await decimateMesh(pos instanceof Float32Array ? pos : new Float32Array(pos), ratio, { onStatus: ctx.onStatus, job: ctx.job });
        if (!r) continue;
        const ng = new THREE.BufferGeometry();
        ng.setAttribute('position', new THREE.BufferAttribute(r.position, 3));
        ng.setAttribute('normal', new THREE.BufferAttribute(r.normal, 3));
        const mat = Array.isArray(m.material) ? m.material[0] : m.material;
        if (mat) { mat.map = null; mat.vertexColors = false; mat.needsUpdate = true; }
        m.geometry = ng;
      }
      return { buffer: await exportGLB(root), stats: statsOf(root) };
    },
  },

  remesh: {
    name: 'Voxel remesh', icon: '⊞', tint: '#e0a93b',
    desc: 'Rebuild the whole model as one watertight surface — the fix for scans full of holes and shells. Everything becomes one gray mesh.',
    params: [
      { k: 'res', label: 'Resolution', min: 32, max: 200, step: 4, def: 96, unit: 'voxels / longest axis' },
      { k: 'smooth', label: 'Smoothing', min: 0, max: 8, step: 1, def: 3, unit: 'Taubin passes' },
    ],
    async run(buffer, p, ctx) {
      const root = await parseGLB(buffer);
      const soup = soupOf(root);
      const r = voxelRemesh(soup, { res: p.res == null ? 96 : p.res, smooth: p.smooth == null ? 3 : p.smooth, onStatus: ctx.onStatus });
      if (!r) throw new Error('Remesh produced nothing — mesh too small?');
      if (r.tooBig) throw new Error('Grid too big (' + r.grid.join('×') + ') — lower the resolution');
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(r.position, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(r.normal, 3));
      const scene = new THREE.Scene();
      const mesh = new THREE.Mesh(g, grayMat()); mesh.name = 'remeshed'; scene.add(mesh);
      return { buffer: await exportGLB(scene), stats: statsOf(scene) };
    },
  },

  normals: {
    name: 'Rebuild normals', icon: '⊥', tint: '#7fd7b8',
    desc: 'Throw away the shading normals and recompute them smooth from the geometry.',
    params: [],
    async run(buffer, p, ctx) {
      const root = await parseGLB(buffer);
      ctx.onStatus('Recomputing normals…');
      eachMesh(root, m => { m.geometry.deleteAttribute('normal'); m.geometry.computeVertexNormals(); });
      return { buffer: await exportGLB(root), stats: statsOf(root) };
    },
  },

  ground: {
    name: 'Ground & centre', icon: '⏚', tint: '#8fb2e0',
    desc: 'Feet on the floor, model centred on the origin — where every other tool expects it.',
    params: [],
    async run(buffer, p, ctx) {
      const root = await parseGLB(buffer);
      const b = bboxOf(root);
      const c = b.getCenter(new THREE.Vector3());
      const dx = -c.x, dy = -b.min.y, dz = -c.z;
      eachMesh(root, m => { m.geometry.translate(dx, dy, dz); });
      return { buffer: await exportGLB(root), stats: statsOf(root) };
    },
  },

  scale: {
    name: 'Scale to height', icon: '⇕', tint: '#d8935a',
    desc: 'Uniform-scale the model so it stands exactly this tall — fixes cm/m/inch mixups from other software.',
    params: [{ k: 'height', label: 'Height', min: 0.2, max: 4, step: 0.05, def: 1.7, unit: 'meters' }],
    async run(buffer, p, ctx) {
      const root = await parseGLB(buffer);
      const b = bboxOf(root);
      const h = b.max.y - b.min.y;
      if (h <= 0) throw new Error('Model has no height');
      const s = (p.height == null ? 1.7 : p.height) / h;
      eachMesh(root, m => { m.geometry.scale(s, s, s); });
      return { buffer: await exportGLB(root), stats: Object.assign(statsOf(root), { scale: +s.toFixed(4) }) };
    },
  },

  ao: {
    name: 'Bake vertex AO', icon: '☀', tint: '#d87ba3',
    desc: 'Raytraced ambient occlusion into the vertex colors — flat scans read as rendered. (BVH + hemisphere rays, seeded, on-device.)',
    params: [
      { k: 'samples', label: 'Rays / vertex', min: 8, max: 96, step: 4, def: 32, unit: '' },
      { k: 'intensity', label: 'Intensity', min: 10, max: 100, step: 5, def: 65, unit: '%' },
    ],
    async run(buffer, p, ctx) {
      const root = await parseGLB(buffer);
      const soup = soupOf(root);
      ctx.onStatus('Building BVH over ' + (soup.length / 9 | 0).toLocaleString() + ' tris…');
      const bvh = buildBVH(soup);
      const reach = bboxOf(root).getSize(new THREE.Vector3()).length() * 0.5 || 1;
      const nSamp = p.samples == null ? 32 : p.samples;
      const inten = (p.intensity == null ? 65 : p.intensity) / 100;
      // deterministic golden-spiral hemisphere directions (contract rule 3)
      const dirs = [];
      for (let i = 0; i < nSamp; i++) {
        const t = (i + 0.5) / nSamp;
        const cosT = Math.sqrt(1 - t);              // cosine-weighted
        const sinT = Math.sqrt(t);
        const phi = i * 2.399963229728653;           // golden angle
        dirs.push([Math.cos(phi) * sinT, Math.sin(phi) * sinT, cosT]);
      }
      const T = new THREE.Vector3(), Bt = new THREE.Vector3(), N = new THREE.Vector3();
      let done = 0, total = 0;
      eachMesh(root, m => { total += m.geometry.attributes.position.count; });
      eachMesh(root, m => {
        const g = m.geometry;
        if (!g.attributes.normal) g.computeVertexNormals();
        const pos = g.attributes.position, nrm = g.attributes.normal;
        const col = new Float32Array(pos.count * 3);
        const old = g.attributes.color || null;
        for (let i = 0; i < pos.count; i++) {
          N.fromBufferAttribute(nrm, i).normalize();
          // tangent frame
          T.set(1, 0, 0); if (Math.abs(N.x) > 0.9) T.set(0, 1, 0);
          Bt.crossVectors(N, T).normalize(); T.crossVectors(Bt, N);
          const ox = pos.getX(i) + N.x * reach * 2e-4, oy = pos.getY(i) + N.y * reach * 2e-4, oz = pos.getZ(i) + N.z * reach * 2e-4;
          let occ = 0;
          for (const d of dirs) {
            const dx = T.x * d[0] + Bt.x * d[1] + N.x * d[2];
            const dy = T.y * d[0] + Bt.y * d[1] + N.y * d[2];
            const dz = T.z * d[0] + Bt.z * d[1] + N.z * d[2];
            if (rayOccluded(bvh, ox, oy, oz, dx, dy, dz, reach)) occ++;
          }
          const shade = 1 - inten * (occ / nSamp);
          const r0 = old ? old.getX(i) : 1, g0 = old ? old.getY(i) : 1, b0 = old ? old.getZ(i) : 1;
          col[i * 3] = r0 * shade; col[i * 3 + 1] = g0 * shade; col[i * 3 + 2] = b0 * shade;
          if ((++done & 1023) === 0) ctx.onStatus('AO ' + Math.round(done / total * 100) + '%…');
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mat = Array.isArray(m.material) ? m.material[0] : m.material;
        if (mat) { mat.vertexColors = true; mat.needsUpdate = true; }
      });
      return { buffer: await exportGLB(root), stats: statsOf(root) };
    },
  },
};

// UI-safe metadata (no functions) for the palette / inspector
export function stepMeta() {
  const out = {};
  Object.keys(STEPS).forEach(k => {
    const s = STEPS[k];
    out[k] = { kind: k, name: s.name, icon: s.icon, tint: s.tint, desc: s.desc, params: s.params };
  });
  return out;
}

// run one step by kind — the graph evaluator's only entry point
export async function runStep(kind, buffer, params, onStatus) {
  const s = STEPS[kind];
  if (!s) throw new Error('Unknown step "' + kind + '"');
  const t0 = performance.now();
  const r = await s.run(buffer, params || {}, { onStatus: onStatus || (() => {}) });
  r.stats = Object.assign({}, r.stats, { ms: Math.round(performance.now() - t0), kb: Math.round(r.buffer.byteLength / 1024) });
  return r;
}

export { fetchAssetBuffer };

// ============================================================
// RecipeEngine — the preview viewport (selected node's output)
// ============================================================
export class RecipeEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    const vpBg = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--viewport').trim(); return v || '#16181c'; };
    this.scene.background = new THREE.Color(vpBg());
    window.addEventListener('studiothemechange', () => { try { this.scene.background = new THREE.Color(vpBg()); } catch (e) {} });

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 100);
    this.camera.position.set(1.4, 1.2, 3.0);
    this.controls = new OrbitControls(this.camera, canvas);
    applyOrbitScheme(this.controls, THREE);
    this.controls.enableDamping = true; this.controls.dampingFactor = 0.09;
    this.controls.target.set(0, 0.9, 0);

    this.scene.add(new THREE.HemisphereLight(0xe6ecf5, 0x21242a, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.25); key.position.set(2.4, 4.2, 3.0); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x86a0d8, 0.5); rim.position.set(-3, 2.2, -2.4); this.scene.add(rim);

    this.grid = new THREE.GridHelper(10, 24, 0x39414f, 0x23272e);
    this.grid.material.opacity = 0.5; this.grid.material.transparent = true; this.scene.add(this.grid);

    this.modelRoot = new THREE.Group(); this.scene.add(this.modelRoot);
    this._shownFor = null;

    this._ro = new ResizeObserver(() => this.resize()); this._ro.observe(canvas.parentElement || canvas);
    this.resize();
    this._run = true; this._loop = this._loop.bind(this); requestAnimationFrame(this._loop);
    if (typeof window !== 'undefined') window.__rcEngine = this;
  }

  async show(buffer, tag) {
    if (tag != null && tag === this._shownFor) return;
    this._shownFor = tag == null ? null : tag;
    while (this.modelRoot.children.length) { const c = this.modelRoot.children.pop(); this.modelRoot.remove(c); }
    if (!buffer) return;
    const root = await parseGLB(buffer);
    this.modelRoot.add(root);
    const b = new THREE.Box3().setFromObject(root);
    if (!b.isEmpty()) {
      const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
      const rad = Math.max(s.x, s.y, s.z) * 0.5 || 1;
      this.controls.target.copy(c);
      const d = rad * 2.8;
      this.camera.position.set(c.x + d * 0.5, c.y + d * 0.35, c.z + d);
      this.camera.near = Math.max(0.001, rad / 200); this.camera.far = rad * 60;
      this.camera.updateProjectionMatrix();
    }
  }

  setWire(on) {
    this.modelRoot.traverse(o => { if (o.isMesh && o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.wireframe = !!on; }); } });
    this._wireOn = !!on;
  }

  resize() {
    const el = this.canvas.parentElement || this.canvas;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  _loop() {
    if (!this._run) return;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
  dispose() { this._run = false; try { this._ro.disconnect(); } catch (e) {} try { this.renderer.dispose(); } catch (e) {} }
}
