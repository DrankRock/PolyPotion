// data/objects.js — Prefab registry for the Mat.ai Room Designer.
//
// Each prefab is registered with:
//   OBJECTS.register(name, factory, meta)
//
// factory(opts) → THREE.Object3D
// meta: { icon, category, params: [...] }
//
// params schema:
//   { key, label, type: "int"|"number"|"color"|"bool"|"select", min, max, step, default, options }

// 1. Initialize the global object immediately at the top level
window.OBJECTS = window.OBJECTS || {};

(function () {
  const THREE = window.THREE;
  if (!THREE) { console.error("objects.js: Three.js not loaded"); return; }

  // ── Registry core ────────────────────────────────────
  const registry = [];
  const byName = {};

  // 2. Attach functions directly to window.OBJECTS
  window.OBJECTS.register = function(name, factory, meta = {}) {
    const entry = { name, factory, ...meta };
    registry.push(entry);
    byName[name] = entry;
  };

  window.OBJECTS.create = function(name, opts = {}) {
    const entry = byName[name];
    if (!entry) { console.warn("OBJECTS: unknown prefab:", name); return null; }
    // Merge defaults
    const merged = {};
    if (entry.params) {
      entry.params.forEach((p) => {
        merged[p.key] = p.default !== undefined ? p.default : 0;
      });
    }
    Object.assign(merged, opts);
    const obj = entry.factory(merged);
    if (obj) obj.name = obj.name || name;
    return obj;
  };

  window.OBJECTS.list = function() { return registry; };

  // ── Shared materials (matches designer.html MAT + rooms.js M) ──────
  const _mc = new Map();
  function _mat(kind, color, opts = {}) {
    const k = `${kind}:${color.toString(16)}`;
    if (_mc.has(k)) return _mc.get(k);
    const m = new THREE.MeshStandardMaterial({ color, ...opts });
    _mc.set(k, m);
    return m;
  }
  
  window.OBJECTS.M = {
    wood:    (c = 0x6b4a2b) => _mat("wood",  c, { roughness: 0.85, metalness: 0.0 }),
    stone:   (c = 0x4a4338) => _mat("stone", c, { roughness: 0.95, metalness: 0.0 }),
    plaster: (c = 0xc8b89a) => _mat("plast", c, { roughness: 0.92, metalness: 0.0, side: THREE.DoubleSide }),
    leaf:    (c = 0x4a6840) => _mat("leaf",  c, { roughness: 0.9,  metalness: 0.0, side: THREE.DoubleSide }),
    metal:   (c = 0x2a2520) => _mat("metal", c, { roughness: 0.45, metalness: 0.7 }),
    cloth:   (c = 0x5a2a1a) => _mat("cloth", c, { roughness: 0.85, metalness: 0.0 }),
    book:    (c = 0x6b2a1a) => _mat("book",  c, { roughness: 0.8,  metalness: 0.0 }),
    glass:   (c = 0x88aac0) => new THREE.MeshStandardMaterial({
      color: c, roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.32,
    }),
    ceramic: (c = 0xe8dcc8) => _mat("ceram", c, { roughness: 0.35, metalness: 0.05 }),
    fabric:  (c = 0x8a6a50) => _mat("fabr",  c, { roughness: 0.92, metalness: 0.0 }),
    marble:  (c = 0xd8d0c8) => _mat("marbl", c, { roughness: 0.25, metalness: 0.08 }),
    rust:    (c = 0x6a3a22) => _mat("rust",  c, { roughness: 0.95, metalness: 0.35 }),
    brass:   (c = 0xc8a050) => _mat("brass", c, { roughness: 0.30, metalness: 0.85 }),
    leather: (c = 0x4a3020) => _mat("leath", c, { roughness: 0.75, metalness: 0.02 }),
    wax:     (c = 0xf0e8c8) => _mat("wax",   c, { roughness: 0.60, metalness: 0.0 }),
    rope:    (c = 0x8a7a60) => _mat("rope",  c, { roughness: 0.95, metalness: 0.0 }),
    felt:    (c = 0x2a4a6a) => _mat("felt",  c, { roughness: 0.95, metalness: 0.0 }),
    bone:    (c = 0xe8dcc0) => _mat("bone",  c, { roughness: 0.85, metalness: 0.02 }),
    copper:  (c = 0xb8794a) => _mat("copper",c, { roughness: 0.40, metalness: 0.80 }),
    straw:   (c = 0xc8a850) => _mat("straw", c, { roughness: 0.95, metalness: 0.0 }),
  };

  // Helpers
  window.OBJECTS.rand = (a, b) => a + Math.random() * (b - a);
  window.OBJECTS.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  
  window.OBJECTS._c = function(v, fallback) {
    if (v === undefined || v === null) return fallback;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      if (v.startsWith("#")) return parseInt(v.slice(1), 16);
      const n = parseInt(v); if (!isNaN(n)) return n;
    }
    return fallback;
  };

  window.OBJECTS._box = function(w, h, d, mat, pos) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    return m;
  };
  
  window.OBJECTS._cyl = function(rT, rB, h, mat, pos, seg = 12) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    return m;
  };
  
  window.OBJECTS._sph = function(r, mat, pos, seg = 14) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg / 2) | 0), mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    return m;
  };
  
  window.OBJECTS._cone = function(r, h, mat, pos, seg = 12) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    return m;
  };
  
  window.OBJECTS._tor = function(r, tube, mat, pos, seg = 10, seg2 = 24) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, seg, seg2), mat);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    return m;
  };
  
  // Notice: The previous EXPORT block at the bottom is entirely removed, 
  // as everything is now attached directly to window.OBJECTS as it gets created.
})();