// ============================================================
// sample-shapes.js — working "Load sample" for every tool
// Two exports:
//   sampleGLB(kind)  → Promise<{ buffer:ArrayBuffer, name:string }>
//       procedural geometry (figure / sphere / cube / cylinder / knot)
//       packed as a GLB entirely on-device — no data/ folder needed.
//   pickSample(opts) → Promise<pick | null>
//       a small chooser popover: the basic shapes, plus (when the tool is
//       embedded in the studio) "pick from Library" and "generate a human".
//       pick = { kind:'shape', buffer, name } | { kind:'library' } | { kind:'humangen' }
// Used by every tool's empty-state "Load sample" button.
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// ---------------------------------------------------------- geometry
function g(geo, x, y, z, rx, rz) {
  if (rx) geo.rotateX(rx);
  if (rz) geo.rotateZ(rz);
  geo.translate(x || 0, y || 0, z || 0);
  return geo;
}

// a simple mannequin — capsule limbs, sphere head, ~1.7 m tall, feet at y=0.
// intentionally a merged soup of parts: plenty of surface for sculpt/retopo/
// decimate/AO, and Mesh Doctor gets something real to complain about.
function figureGeo() {
  const parts = [
    g(new THREE.SphereGeometry(0.115, 28, 22), 0, 1.575),                              // head
    g(new THREE.CapsuleGeometry(0.052, 0.055, 6, 16), 0, 1.44),                        // neck
    g(new THREE.CapsuleGeometry(0.16, 0.34, 8, 22), 0, 1.19),                          // chest
    g(new THREE.CapsuleGeometry(0.14, 0.13, 8, 20), 0, 0.905),                         // pelvis
    g(new THREE.CapsuleGeometry(0.052, 0.26, 6, 16), -0.245, 1.245, 0, 0, 0.28),       // L upper arm
    g(new THREE.CapsuleGeometry(0.052, 0.26, 6, 16), 0.245, 1.245, 0, 0, -0.28),       // R upper arm
    g(new THREE.CapsuleGeometry(0.044, 0.24, 6, 16), -0.315, 0.985, 0, 0, 0.12),       // L forearm
    g(new THREE.CapsuleGeometry(0.044, 0.24, 6, 16), 0.315, 0.985, 0, 0, -0.12),       // R forearm
    g(new THREE.SphereGeometry(0.055, 16, 12), -0.345, 0.83),                          // L hand
    g(new THREE.SphereGeometry(0.055, 16, 12), 0.345, 0.83),                           // R hand
    g(new THREE.CapsuleGeometry(0.075, 0.34, 8, 18), -0.095, 0.62),                    // L thigh
    g(new THREE.CapsuleGeometry(0.075, 0.34, 8, 18), 0.095, 0.62),                     // R thigh
    g(new THREE.CapsuleGeometry(0.058, 0.32, 8, 18), -0.095, 0.255),                   // L shin
    g(new THREE.CapsuleGeometry(0.058, 0.32, 8, 18), 0.095, 0.255),                    // R shin
    g(new THREE.BoxGeometry(0.105, 0.07, 0.24, 3, 2, 4), -0.095, 0.035, 0.045),        // L foot
    g(new THREE.BoxGeometry(0.105, 0.07, 0.24, 3, 2, 4), 0.095, 0.035, 0.045),         // R foot
  ].map(p => { if (p.index) return p.toNonIndexed(); return p; });
  const merged = mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  return merged;
}

const SHAPES = {
  figure: { label: 'Figure', icon: '☺', hint: 'mannequin · 1.7 m', make: figureGeo },
  sphere: { label: 'Sphere', icon: '●', hint: '64 × 44 segments', make: () => g(new THREE.SphereGeometry(0.55, 64, 44), 0, 0.55) },
  cube: { label: 'Cube', icon: '◼', hint: 'subdivided 12³', make: () => g(new THREE.BoxGeometry(0.85, 0.85, 0.85, 12, 12, 12), 0, 0.425) },
  cylinder: { label: 'Cylinder', icon: '⬮', hint: '48 sides', make: () => g(new THREE.CylinderGeometry(0.4, 0.4, 1.1, 48, 12), 0, 0.55) },
  knot: { label: 'Torus knot', icon: '✾', hint: 'curvature playground', make: () => g(new THREE.TorusKnotGeometry(0.42, 0.13, 160, 24), 0, 0.72) },
};

export async function sampleGLB(kind) {
  const def = SHAPES[kind] || SHAPES.figure;
  const geo = def.make();
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xb8bcc4, roughness: 0.88, metalness: 0 }));
  mesh.name = 'Sample ' + def.label;
  const scene = new THREE.Scene(); scene.add(mesh);
  const buffer = await new Promise((res, rej) => new GLTFExporter().parse(scene, res, rej, { binary: true }));
  geo.dispose();
  return { buffer, name: 'Sample ' + def.label + '.glb' };
}

// ---------------------------------------------------------- chooser popover
const css = (v, fb) => 'var(' + v + ',' + fb + ')';

export function pickSample(opts) {
  opts = opts || {};
  const embedded = opts.embedded != null ? !!opts.embedded : (window.parent !== window);
  return new Promise((resolve) => {
    const old = document.getElementById('pp-sample-pop'); if (old) old.remove();

    const wrap = document.createElement('div');
    wrap.id = 'pp-sample-pop';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;background:rgba(10,10,12,.55);';
    const done = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v || null); };
    const onKey = (e) => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) done(null); });

    const card = document.createElement('div');
    card.style.cssText = 'width:380px;max-width:92vw;border-radius:12px;padding:16px;background:' + css('--panel', '#1c1f24') + ';border:1px solid ' + css('--edge', '#3a4048') + ';box-shadow:0 24px 60px rgba(0,0,0,.55);color:' + css('--text', '#e8eaee') + ';font-family:' + css('--font-ui', 'Archivo,sans-serif') + ';';
    card.innerHTML = '<div style="font-size:13.5px;font-weight:700;margin-bottom:2px;">Load a sample</div>'
      + '<div style="font-size:11px;color:' + css('--muted', '#9aa1ab') + ';margin-bottom:12px;">Basic shapes, brewed on the spot — nothing to download.</div>';

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:6px;';
    Object.keys(SHAPES).forEach(k => {
      const d = SHAPES[k];
      const b = document.createElement('button');
      b.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 4px 8px;border-radius:8px;cursor:pointer;background:' + css('--panel3', '#262a31') + ';border:1px solid ' + css('--edge', '#3a4048') + ';color:' + css('--text', '#e8eaee') + ';';
      b.title = d.hint;
      b.innerHTML = '<span style="font-size:19px;line-height:1;">' + d.icon + '</span><span style="font-size:10px;font-weight:600;">' + d.label + '</span>';
      b.addEventListener('mouseenter', () => { b.style.borderColor = css('--accent', '#e0894f'); });
      b.addEventListener('mouseleave', () => { b.style.borderColor = css('--edge', '#3a4048'); });
      b.addEventListener('click', async () => {
        b.firstElementChild.textContent = '⏳';
        try { const r = await sampleGLB(k); done({ kind: 'shape', buffer: r.buffer, name: r.name }); }
        catch (e) { done(null); }
      });
      grid.appendChild(b);
    });
    card.appendChild(grid);

    if (opts.needsRig) {
      const warn = document.createElement('div');
      warn.style.cssText = 'font-size:10.5px;line-height:1.5;color:' + css('--muted', '#9aa1ab') + ';padding:7px 9px;border-radius:6px;background:rgba(224,169,59,.1);border:1px solid rgba(224,169,59,.35);margin:6px 0 2px;';
      warn.textContent = '⚠ This tool wants a rigged character — plain shapes will load, but there is nothing to animate. Grab one from the Library, or generate a human and rig it first.';
      card.appendChild(warn);
    }

    if (embedded) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:7px;margin-top:9px;';
      const mk = (label, kind) => {
        const b = document.createElement('button');
        b.style.cssText = 'flex:1;padding:9px 6px;border-radius:7px;font-size:11.5px;font-weight:600;cursor:pointer;background:' + css('--panel3', '#262a31') + ';border:1px solid ' + css('--edge', '#3a4048') + ';color:' + css('--text', '#e8eaee') + ';';
        b.textContent = label;
        b.addEventListener('mouseenter', () => { b.style.borderColor = css('--accent', '#e0894f'); });
        b.addEventListener('mouseleave', () => { b.style.borderColor = css('--edge', '#3a4048'); });
        b.addEventListener('click', () => done({ kind }));
        return b;
      };
      row.appendChild(mk('▤ Pick from Library…', 'library'));
      row.appendChild(mk('☺ Generate a human', 'humangen'));
      card.appendChild(row);
    }

    wrap.appendChild(card);
    document.body.appendChild(wrap);
  });
}
