// ============================================================
// AUTORIG — ENGINE  (window.RigEngine)
// Quad-view three.js scene (Perspective / Front / Side / Top) on a single
// canvas via scissor. Loads a mesh, lets the user drag template joints into
// the volume across the ortho views, then builds a Skeleton + SkinnedMesh
// from scratch (no pre-existing rig required) and plays procedural test
// animations. GLB / glTF export built-in; FBX via fbx-export.js.
// ============================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const E = {};
let canvas, renderer, scene;
let modelGroup = null;          // the displayed (un-rigged) mesh, centered
let modelMeshes = [];           // Mesh refs inside modelGroup
let bbox = new THREE.Box3(), bsphere = new THREE.Sphere(), modelR = 1, modelC = new THREE.Vector3();

let joints = [];                // {id, base, label, group, parent, marker, enabled, side}
let jointMap = new Map();
let markerRoot, boneLines, selJoint = null, onSelectCb = null, onSoloCb = null;
let groupsOn = {};
let soloView = null;     // null = quad; else 'persp'|'front'|'side'|'top'
let focusMode = 'all';   // 'all'|'body'|'hands'|'face'
let meshOpacity = 0.42;  // x-ray default; user-adjustable so hands read solid
// ---- drag-zone isolate ----
let zoneMode = false, zoneActive = false;
let zoneBox = null, zoneAxes = null, savedFraming = null;
let onZoneRectCb = null, onZoneStateCb = null;

let rigGroup = null;            // holds skinned meshes + bone root after bind
let skeleton = null, skinnedMeshes = [], boneByJoint = new Map();
let skelHelper = null, restQuats = [], restPositions = [], rigData = null;
let animClip = 'tpose', animPlaying = false, animT = 0;
let extMixer = null, extAction = null, extActive = false, extState = null, extYaw = 0;
let extRootMotion = true;   // apply the source clip's hips translation (jumps, hops, travel)
let extComp = true;         // rest-pose compensation (A-pose → T-pose corrective rotations)
let extMirror = false;      // reflect the clip across X=0 (swap left ↔ right)
const AnimationMixerRef = THREE.AnimationMixer;

const clock = new THREE.Clock();

// ---------- cameras (4 panels) ----------
const persp = { cam: null, target: new THREE.Vector3(), pan: new THREE.Vector3(), az: 0.6, el: 0.25, radius: 4 };
function makeOrtho(dir, up) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 10000);
  return { cam, dir: dir.clone(), up: up.clone(), target: new THREE.Vector3(), zoom: 1, dist: 10, sign: 1 };
}
const orthos = {
  front: makeOrtho(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)),
  side:  makeOrtho(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)),
  top:   makeOrtho(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, -1)),
};
// panel layout: TL persp, TR front, BL side, BR top — or a single full panel when soloed
function panels() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (soloView) {
    const map = {
      persp: { cam: persp.cam, kind: 'persp' },
      front: { cam: orthos.front.cam, kind: 'ortho', o: orthos.front },
      side:  { cam: orthos.side.cam,  kind: 'ortho', o: orthos.side },
      top:   { cam: orthos.top.cam,   kind: 'ortho', o: orthos.top },
    };
    const m = map[soloView] || map.persp;
    return [{ name: soloView, x: 0, y: 0, w, h, cam: m.cam, kind: m.kind, o: m.o }];
  }
  const mw = Math.floor(w / 2), mh = Math.floor(h / 2);
  return [
    { name: 'persp', x: 0,  y: mh, w: mw,     h: h - mh, cam: persp.cam, kind: 'persp' },
    { name: 'front', x: mw, y: mh, w: w - mw, h: h - mh, cam: orthos.front.cam, kind: 'ortho', o: orthos.front },
    { name: 'side',  x: 0,  y: 0,  w: mw,     h: mh,     cam: orthos.side.cam,  kind: 'ortho', o: orthos.side },
    { name: 'top',   x: mw, y: 0,  w: w - mw, h: mh,     cam: orthos.top.cam,   kind: 'ortho', o: orthos.top },
  ];
}

// ============================================================
E.init = function (cv) {
  canvas = cv;
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setScissorTest(true);

  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x40464d, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(4, 7, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xcdd6e0, 0.5); fill.position.set(-5, 2, -4); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(0, 3, -6); scene.add(rim);

  persp.cam = new THREE.PerspectiveCamera(45, 1, 0.01, 100000);

  // ground grid
  const grid = new THREE.GridHelper(10, 20, 0x4d82d6, 0x2c2c2c);
  grid.material.opacity = 0.4; grid.material.transparent = true; grid.name = '__grid';
  scene.add(grid);

  markerRoot = new THREE.Group(); scene.add(markerRoot);
  const lineGeo = new THREE.BufferGeometry();
  boneLines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xe08534, transparent: true, opacity: 0.9, depthTest: false }));
  boneLines.renderOrder = 990; scene.add(boneLines);

  bindPointer();
  window.addEventListener('resize', resize);
  // A window 'resize' does NOT fire when the tool iframe itself is resized or
  // re-shown by the shell — which left the drawing buffer stale while the CSS
  // box changed, so the picture got stretched and clicks landed off-target.
  // Watch the canvas box directly and re-sync the buffer + cameras.
  if (window.ResizeObserver) { try { new ResizeObserver(() => resize()).observe(canvas); } catch (_) {} }
  resize();
  animate();
  return E;
};

let _lastW = 0, _lastH = 0;
function resize() {
  if (!renderer) return;
  const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
  _lastW = canvas.clientWidth; _lastH = canvas.clientHeight;
  renderer.setSize(w, h, false);
  updateCameras();
}

function updateCameras() {
  // perspective
  const r = modelR || 1;
  persp.target.copy(modelC).add(persp.pan);
  const pe = persp.el, pa = persp.az;
  persp.cam.position.set(
    persp.target.x + persp.radius * Math.cos(pe) * Math.sin(pa),
    persp.target.y + persp.radius * Math.sin(pe),
    persp.target.z + persp.radius * Math.cos(pe) * Math.cos(pa)
  );
  persp.cam.lookAt(persp.target);
  persp.cam.near = Math.max(0.001, persp.radius / 500); persp.cam.far = persp.radius * 500;
  const P = panels();
  persp.cam.aspect = P[0].w / P[0].h; persp.cam.updateProjectionMatrix();

  for (const p of P) {
    if (p.kind !== 'ortho') continue;
    const o = p.o, aspect = p.w / Math.max(1, p.h);
    const halfH = (r * 1.25) / o.zoom, halfW = halfH * aspect;
    o.dist = r * 8;
    o.cam.left = -halfW; o.cam.right = halfW; o.cam.top = halfH; o.cam.bottom = -halfH;
    o.cam.near = 0.001; o.cam.far = o.dist * 4;
    o.cam.position.copy(o.target).addScaledVector(o.dir, o.dist * (o.sign || 1));
    o.cam.up.copy(o.up);
    o.cam.lookAt(o.target);
    o.cam.updateProjectionMatrix();
    o.cam.updateMatrixWorld(true);
  }
  persp.cam.updateMatrixWorld(true);
}

function animate() {
  requestAnimationFrame(animate);
  // Keep the drawing buffer locked to the canvas box every frame. ResizeObserver
  // and window 'resize' both miss cases (frame re-shown after being hidden, and
  // some embedded/webview environments never fire RO at all) — a stale buffer is
  // what makes the picture stretch and clicks land in the wrong place.
  if (canvas.clientWidth !== _lastW || canvas.clientHeight !== _lastH) resize();
  const dt = clock.getDelta();
  if (extActive && extMixer) extMixer.update(dt);
  else if (animPlaying && skeleton) { animT += dt; poseSkeleton(animT); }
  if (markerRoot.visible) updateBoneLines();
  renderQuad();
}

function renderQuad() {
  const P = panels();
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const p of P) {
    // device pixels
    const dpr = renderer.getPixelRatio();
    renderer.setViewport(p.x, p.y, p.w, p.h);
    renderer.setScissor(p.x, p.y, p.w, p.h);
    renderer.setClearColor(p.kind === 'persp' ? 0x202225 : 0x1a1b1d, 1);
    renderer.clear();
    renderer.render(scene, p.cam);
  }
}

// ============================================================
// LOADING
// ============================================================
const loaders = { fbx: new FBXLoader(), gltf: new GLTFLoader(), glb: new GLTFLoader(), obj: new OBJLoader() };

E.loadFile = async function (file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  clearModel(); clearRig();
  let obj = null;
  if (ext === 'fbx') {
    obj = loaders.fbx.parse(await file.arrayBuffer(), '');
  } else if (ext === 'glb' || ext === 'gltf') {
    const data = ext === 'gltf' ? await file.text() : await file.arrayBuffer();
    const g = await new Promise((res, rej) => loaders.gltf.parse(data, '', res, rej));
    obj = g.scene || g.scenes[0];
  } else if (ext === 'obj') {
    obj = loaders.obj.parse(await file.text());
  } else throw new Error('Unsupported: .' + ext);

  // collect meshes; flatten skinned → plain (we re-rig from scratch)
  const found = [];
  obj.updateMatrixWorld(true);
  obj.traverse(o => { if (o.isMesh && o.geometry && o.geometry.getAttribute('position')) found.push(o); });
  if (!found.length) throw new Error('No mesh geometry found in file');

  modelGroup = new THREE.Group();
  modelMeshes = [];
  let tris = 0, verts = 0;
  for (const m of found) {
    m.updateWorldMatrix(true, false);
    const geo = m.geometry.clone();
    geo.applyMatrix4(m.matrixWorld);                 // bake world transform
    // strip any inherited skin attributes
    geo.deleteAttribute('skinIndex'); geo.deleteAttribute('skinWeight');
    if (!geo.getAttribute('normal')) geo.computeVertexNormals();
    let mat = m.material;
    if (Array.isArray(mat)) mat = mat[0];
    mat = (mat && mat.clone) ? mat.clone() : new THREE.MeshStandardMaterial({ color: 0xb9bec6 });
    mat.side = THREE.DoubleSide; mat.skinning = true;
    mat.transparent = false; mat.opacity = 1;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.matName = (m.material && m.material.name) || 'lambert';
    modelGroup.add(mesh); modelMeshes.push(mesh);
    const pos = geo.getAttribute('position'); verts += pos.count;
    tris += geo.index ? geo.index.count / 3 : pos.count / 3;
  }

  // center at origin, rescale to a friendly height (~1.8 world units)
  const box = new THREE.Box3().setFromObject(modelGroup);
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const targetH = 1.8, s = targetH / (size.y || 1);
  for (const mesh of modelMeshes) {
    const g = mesh.geometry;
    g.translate(-c.x, -c.y, -c.z);
    g.scale(s, s, s);
    g.computeBoundingBox(); g.computeVertexNormals();
  }
  scene.add(modelGroup);
  recomputeBounds();
  frameAll();
  applyEffectiveOpacity();                              // x-ray so joints read inside (solid if focused on hands/face)
  return { name: file.name, tris: Math.round(tris), verts, meshes: modelMeshes.length, ext };
};

function recomputeBounds() {
  bbox.setFromObject(modelGroup.visible ? modelGroup : rigGroup || modelGroup);
  if (bbox.isEmpty() && rigGroup) bbox.setFromObject(rigGroup);
  bbox.getBoundingSphere(bsphere);
  modelR = bsphere.radius || 1; modelC.copy(bsphere.center);
}

let onOpacityCb = null;
function setMeshOpacity(op) {
  modelMeshes.forEach(m => { m.material.transparent = op < 0.999; m.material.opacity = op; m.material.depthWrite = op >= 0.999; m.material.needsUpdate = true; });
}
// the opacity actually shown right now: solid when fine-rigging hands/face, else the user's x-ray value
function effectiveOpacity() { return (focusMode === 'hands' || focusMode === 'face') ? 1 : meshOpacity; }
function applyEffectiveOpacity() { const op = effectiveOpacity(); setMeshOpacity(op); if (onOpacityCb) onOpacityCb(Math.round(op * 100), op >= 0.999, focusMode); }
// user-facing opacity control — persists across load / edit-joints
E.setMeshOpacity = function (op) { meshOpacity = Math.max(0.05, Math.min(1, op)); setMeshOpacity(meshOpacity); if (onOpacityCb) onOpacityCb(Math.round(meshOpacity * 100), meshOpacity >= 0.999, focusMode); return meshOpacity; };
E.getMeshOpacity = () => meshOpacity;
E.onMeshOpacity = cb => onOpacityCb = cb;

// ============================================================
// DRAG-ZONE ISOLATE — marquee a region in an ortho view; clip the mesh + hide
// joints outside it and zoom every view in, so fiddly areas (hands!) are alone.
// ============================================================
E.setZoneMode = function (on) { zoneMode = !!on; return zoneMode; };
E.getZoneMode = () => zoneMode;
E.isZoneActive = () => zoneActive;
E.onZoneRect = cb => onZoneRectCb = cb;
E.onZoneState = cb => onZoneStateCb = cb;

function emitZoneRect(x0, y0, x1, y1) {
  if (onZoneRectCb) onZoneRectCb({ x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) });
}
function finishZone(d) {
  if (onZoneRectCb) onZoneRectCb(null);
  zoneMode = false;
  const w = Math.abs(d.cx - d.x0), h = Math.abs(d.cy - d.y0);
  if (w < 8 || h < 8) { if (onZoneStateCb) onZoneStateCb(zoneActive); return; }
  applyZone(d.panel, d.x0, d.y0, d.cx, d.cy);
}
function applyZone(p, x0, y0, x1, y1) {
  const o = p.o; if (!o) return;
  const nd0 = panelNDC(p, x0, y0), nd1 = panelNDC(p, x1, y1);
  const right = new THREE.Vector3().setFromMatrixColumn(o.cam.matrixWorld, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(o.cam.matrixWorld, 1);
  const c0 = o.target.clone().addScaledVector(right, nd0.x * o.cam.right).addScaledVector(up, nd0.y * o.cam.top);
  const c1 = o.target.clone().addScaledVector(right, nd1.x * o.cam.right).addScaledVector(up, nd1.y * o.cam.top);
  const r0 = right.dot(c0), r1 = right.dot(c1), u0 = up.dot(c0), u1 = up.dot(c1);
  zoneAxes = { right: right.clone(), up: up.clone() };
  zoneBox = { minR: Math.min(r0, r1), maxR: Math.max(r0, r1), minU: Math.min(u0, u1), maxU: Math.max(u0, u1) };
  // clip the mesh to the box (depth axis stays open so full thickness shows)
  const planes = [
    new THREE.Plane(right.clone(), -zoneBox.minR),
    new THREE.Plane(right.clone().negate(), zoneBox.maxR),
    new THREE.Plane(up.clone(), -zoneBox.minU),
    new THREE.Plane(up.clone().negate(), zoneBox.maxU),
  ];
  renderer.localClippingEnabled = true;
  modelMeshes.forEach(m => { m.material.clippingPlanes = planes; m.material.needsUpdate = true; });
  skinnedMeshes.forEach(m => { m.material.clippingPlanes = planes; m.material.needsUpdate = true; });
  if (!zoneActive) {
    savedFraming = { radius: persp.radius, az: persp.az, el: persp.el, ptar: persp.target.clone(), orth: {} };
    for (const k in orthos) savedFraming.orth[k] = { target: orthos[k].target.clone(), zoom: orthos[k].zoom };
  }
  zoneActive = true;
  const center = c0.clone().add(c1).multiplyScalar(0.5);
  const boxR = Math.max(zoneBox.maxR - zoneBox.minR, zoneBox.maxU - zoneBox.minU) * 0.5 || modelR * 0.2;
  for (const k in orthos) { orthos[k].target.copy(center); orthos[k].zoom = Math.max(0.15, Math.min(12, (modelR * 1.25) / (boxR * 1.35))); }
  persp.target.copy(center); persp.radius = Math.max(modelR * 0.25, boxR * 4);
  applyGroupVisibility(); updateBoneLines(); updateCameras();
  if (onZoneStateCb) onZoneStateCb(true);
}
E.clearZone = function () {
  zoneActive = false; zoneBox = null; zoneAxes = null;
  modelMeshes.forEach(m => { m.material.clippingPlanes = null; m.material.needsUpdate = true; });
  skinnedMeshes.forEach(m => { m.material.clippingPlanes = null; m.material.needsUpdate = true; });
  renderer.localClippingEnabled = false;
  if (savedFraming) {
    persp.radius = savedFraming.radius; persp.az = savedFraming.az; persp.el = savedFraming.el; persp.target.copy(savedFraming.ptar);
    for (const k in orthos) if (savedFraming.orth[k]) { orthos[k].target.copy(savedFraming.orth[k].target); orthos[k].zoom = savedFraming.orth[k].zoom; }
    savedFraming = null;
  }
  applyGroupVisibility(); updateBoneLines(); updateCameras();
  if (onZoneStateCb) onZoneStateCb(false);
};
function inZone(v) {
  if (!zoneActive || !zoneBox) return true;
  const r = zoneAxes.right.dot(v), u = zoneAxes.up.dot(v);
  return r >= zoneBox.minR && r <= zoneBox.maxR && u >= zoneBox.minU && u <= zoneBox.maxU;
}

function clearModel() {
  if (modelGroup) { scene.remove(modelGroup); modelGroup.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } }); }
  modelGroup = null; modelMeshes = [];
  // drop any active isolate zone so a fresh mesh isn't clipped
  zoneActive = false; zoneMode = false; zoneBox = null; zoneAxes = null; savedFraming = null;
  if (renderer) renderer.localClippingEnabled = false;
  if (onZoneStateCb) onZoneStateCb(false);
}

function frameAll() {
  persp.radius = modelR * 3.2; persp.az = 0.6; persp.el = 0.22; persp.pan.set(0, 0, 0);
  for (const k in orthos) { orthos[k].target.copy(modelC); orthos[k].zoom = 1; }
  const grid = scene.getObjectByName('__grid');
  if (grid) { grid.position.set(modelC.x, bbox.min.y, modelC.z); grid.scale.setScalar(Math.max(modelR * 2.4, 1) / 10); }
  updateCameras();
}
E.frame = frameAll;

// flip an ortho view to its opposite (front↔back, side R↔L, top↔bottom)
E.flipView = function (name) {
  const o = orthos[name]; if (!o) return 1;
  o.sign = (o.sign || 1) * -1;
  updateCameras();
  return o.sign;
};
E.getViewSign = name => (orthos[name] ? (orthos[name].sign || 1) : 1);

// ---- maximize one panel to fill the viewport (or null = restore quad) ----
E.setSoloView = function (name) {
  soloView = (name === 'persp' || name === 'front' || name === 'side' || name === 'top') ? name : null;
  if (soloView && soloView !== 'persp') lastOrthoView = soloView;
  resize();
  if (onSoloCb) onSoloCb(soloView);
  return soloView;
};
E.getSoloView = () => soloView;
E.toggleSolo = function (name) { return E.setSoloView(soloView === name ? null : name); };
E.onSolo = cb => onSoloCb = cb;

// ---- focus mode: hide+lock joint groups you're not working on ----
E.setFocus = function (mode) {
  focusMode = ['all', 'body', 'hands', 'face'].includes(mode) ? mode : 'all';
  applyGroupVisibility(); refreshMarkerColors(); updateBoneLines();
  applyEffectiveOpacity();   // hands/face → solid mesh (markers still draw on top); body/all → x-ray
  if (selJoint && !focusAllows(selJoint)) E.selectJoint(null);
  return focusMode;
};
E.getFocus = () => focusMode;

// ============================================================
// JOINTS
// ============================================================
E.buildJoints = function (list, groupState) {
  // dispose old
  [...markerRoot.children].forEach(c => { markerRoot.remove(c); c.geometry && c.geometry.dispose(); c.material && c.material.dispose(); });
  joints = []; jointMap.clear(); selJoint = null;
  // normalize group flags to real booleans (accept true/false/1/0)
  groupsOn = {}; for (const k in groupState) groupsOn[k] = !!groupState[k];

  const mGeo = new THREE.SphereGeometry(modelR * 0.022, 16, 16);
  list.forEach(j => {
    const mat = new THREE.MeshBasicMaterial({ depthTest: false, transparent: true });
    const marker = new THREE.Mesh(mGeo, mat);
    marker.renderOrder = 999;
    // place by normalized home → world (feet at bbox.min.y, height = bbox height)
    marker.position.copy(home2world(j.home));
    markerRoot.add(marker);
    const jj = { ...j, marker, enabled: groupsOn[j.group] === true };
    joints.push(jj); jointMap.set(j.id, jj);
  });
  applyGroupVisibility();
  refreshMarkerColors();
  markerRoot.visible = true;
  updateBoneLines();
  return joints.map(serializeJoint);
};

function home2world(home) {
  const H = (bbox.max.y - bbox.min.y) || (modelR * 2);
  return new THREE.Vector3(
    modelC.x + home[0] * H,
    bbox.min.y + home[1] * H,
    modelC.z + home[2] * H
  );
}

function serializeJoint(j) {
  return { id: j.id, label: j.label, group: j.group, parent: j.parent, enabled: j.enabled,
    pos: [j.marker.position.x, j.marker.position.y, j.marker.position.z], placed: j._moved || false };
}

E.autoFit = function () { joints.forEach(j => j.marker.position.copy(home2world(j.home))); updateBoneLines(); };
E.resetPoses = E.autoFit;

E.setGroupEnabled = function (groupId, on) {
  groupsOn[groupId] = on;
  joints.forEach(j => { if (j.group === groupId) j.enabled = on; });
  applyGroupVisibility(); updateBoneLines();
};
function applyGroupVisibility() { joints.forEach(j => { j.marker.visible = j.enabled && focusAllows(j) && inZone(j.marker.position); }); }

// which joints are interactive/visible under the current focus mode
function focusAllows(j) {
  if (focusMode === 'all') return true;
  if (focusMode === 'body') return j.group !== 'fingers' && j.group !== 'face';
  if (focusMode === 'hands') return j.group === 'fingers' || j.base === 'Wrist';
  if (focusMode === 'face') return j.group === 'face' || j.base === 'Head' || j.base === 'HeadTop' || j.base === 'Neck';
  return true;
}

function enabledJoints() { return joints.filter(j => j.enabled); }
// joints that are both enabled and visible under focus (for picking + bone lines)
function activeJoints() { return joints.filter(j => j.enabled && j.marker.visible); }

// resolve nearest enabled ancestor for hierarchy when a group is off
function enabledParent(j) {
  let p = j.parent ? jointMap.get(j.parent) : null;
  while (p && !p.enabled) p = p.parent ? jointMap.get(p.parent) : null;
  return p || null;
}
// nearest ancestor that is enabled AND visible under the current focus
function activeParent(j) {
  let p = j.parent ? jointMap.get(j.parent) : null;
  while (p && !(p.enabled && p.marker.visible)) p = p.parent ? jointMap.get(p.parent) : null;
  return p || null;
}

function updateBoneLines() {
  const pts = [];
  const useFocus = focusMode !== 'all' || zoneActive;
  (useFocus ? activeJoints() : enabledJoints()).forEach(j => {
    const p = useFocus ? activeParent(j) : enabledParent(j);
    if (p) { pts.push(j.marker.position, p.marker.position); }
  });
  const pos = new Float32Array(pts.length * 3);
  pts.forEach((v, i) => { pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z; });
  boneLines.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  boneLines.geometry.computeBoundingSphere();
}

function refreshMarkerColors() {
  joints.forEach(j => {
    const sel = j === selJoint;
    let c = 0xc8ccd2;
    if (j.group === 'fingers') c = 0x43b6c4;
    else if (j.group === 'face') c = 0xd6a743;
    if (sel) c = 0xe08534;
    j.marker.material.color.setHex(c);
    j.marker.material.opacity = sel ? 1 : 0.92;
    const small = (j.group === 'fingers' || j.group === 'face') ? 0.66 : 1;
    j.marker.scale.setScalar(sel ? 1.7 : small);
  });
}

E.selectJoint = function (id) {
  selJoint = id ? jointMap.get(id) : null;
  refreshMarkerColors();
  if (onSelectCb) onSelectCb(selJoint ? serializeJoint(selJoint) : null);
};
E.onSelect = cb => onSelectCb = cb;

E.nudgeDepth = function (z) {                       // absolute Z for selected
  if (!selJoint) return;
  selJoint.marker.position.z = z; selJoint._moved = true; updateBoneLines();
  if (onSelectCb) onSelectCb(serializeJoint(selJoint));
};

E.mirrorSelected = function () {
  if (!selJoint) return null;
  // find opposite-side twin by id swap _R<->_L
  const id = selJoint.id;
  let twinId = id.endsWith('_R') ? id.slice(0, -2) + '_L' : id.endsWith('_L') ? id.slice(0, -2) + '_R' : null;
  const twin = twinId ? jointMap.get(twinId) : null;
  const p = selJoint.marker.position;
  if (twin) { twin.marker.position.set(modelC.x * 2 - p.x, p.y, p.z); twin._moved = true; }
  else { p.x = modelC.x * 2 - p.x; selJoint._moved = true; }   // center joint: mirror itself
  updateBoneLines();
  return twin ? twin.id : id;
};

// ---- mirror a whole side: copy every _R joint onto its _L twin (or vice versa) ----
// Lets you carefully place ONE half of the rig, then stamp it across.
E.mirrorSide = function (from) {
  const suffix = '_' + (from === 'L' ? 'L' : 'R');
  const toSuffix = suffix === '_R' ? '_L' : '_R';
  let count = 0;
  joints.forEach(j => {
    if (!j.id.endsWith(suffix)) return;
    const twin = jointMap.get(j.id.slice(0, -2) + toSuffix);
    if (!twin) return;
    const p = j.marker.position;
    twin.marker.position.set(modelC.x * 2 - p.x, p.y, p.z);
    twin._moved = true; count++;
  });
  updateBoneLines();
  if (onSelectCb && selJoint) onSelectCb(serializeJoint(selJoint));
  return count;
};

// ---- auto-center: push a joint to the middle of the mesh volume ALONG THE
// DEPTH AXIS OF THE VIEW YOU'RE WORKING IN ----
// Where you drop a joint in an ortho view (its two on-screen axes) is exactly
// where you meant it to be — auto-center must NOT slide it around that plane.
// It only nudges the ONE axis you can't see (the view's depth). Front view →
// depth is Z, Side → X, Top → Y. `lastOrthoView` tracks the view last touched.
const _centerRay = new THREE.Raycaster();
const VIEW_DEPTH = {
  front: new THREE.Vector3(0, 0, 1),   // looking down Z → depth is Z
  side:  new THREE.Vector3(1, 0, 0),   // looking down X → depth is X
  top:   new THREE.Vector3(0, 1, 0),   // looking down Y → depth is Y
};
function centerJointInMesh(j) {
  if (!modelMeshes.length) return false;
  const pos = j.marker.position;
  const axis = VIEW_DEPTH[lastOrthoView] || VIEW_DEPTH.front;   // the unseen axis
  const L = modelR * 4;
  const start = pos.clone().addScaledVector(axis, -L);
  _centerRay.set(start, axis);
  _centerRay.near = 0; _centerRay.far = L * 2;
  const raw = _centerRay.intersectObjects(modelMeshes, false).map(h => h.distance).sort((a, b) => a - b);
  // dedupe near-coincident hits (shared edges / double-sided duplicates)
  const hits = [];
  for (const d of raw) { if (!hits.length || d - hits[hits.length - 1] > modelR * 5e-4) hits.push(d); }
  if (hits.length < 2) return false;
  const jd = L;                             // joint's coordinate along the ray
  let best = null, bestScore = Infinity;
  for (let i = 0; i + 1 < hits.length; i += 2) {
    const a = hits[i], b = hits[i + 1];
    const score = (jd >= a && jd <= b) ? 0 : Math.min(Math.abs(jd - a), Math.abs(jd - b));
    if (score < bestScore) { bestScore = score; best = (a + b) / 2; }
  }
  // accept only the enclosing interval (or one close by) — never teleport across
  // the body because a stray ray found the other limb
  if (best === null || bestScore > modelR * 0.25) return false;
  if (Math.abs(best - jd) < modelR * 1e-5) return false;
  pos.addScaledVector(axis, best - jd);     // moves ONLY along the depth axis
  j._moved = true;
  return true;
}
E.centerSelected = function () {
  if (!selJoint) return false;
  const m = centerJointInMesh(selJoint);
  updateBoneLines();
  if (onSelectCb && selJoint) onSelectCb(serializeJoint(selJoint));
  return m;
};
E.centerAll = function () {
  let c = 0;
  enabledJoints().forEach(j => { if (centerJointInMesh(j)) c++; });
  updateBoneLines();
  if (onSelectCb && selJoint) onSelectCb(serializeJoint(selJoint));
  return c;
};

// ============================================================
// POINTER  (orbit persp · pan ortho · drag joints)
// ============================================================
const ray = new THREE.Raycaster();
let drag = null;
let lastOrthoView = 'front';   // which ortho view the user last worked in → drives auto-center's depth axis

function panelAt(px, py) {
  const h = canvas.clientHeight;
  for (const p of panels()) {
    // panel rect is in GL coords (y up). Convert pointer (y down) to GL y.
    const gy = h - py;
    if (px >= p.x && px < p.x + p.w && gy >= p.y && gy < p.y + p.h) return p;
  }
  return null;
}
function panelNDC(p, px, py) {
  const h = canvas.clientHeight;
  const gy = h - py;
  return { x: ((px - p.x) / p.w) * 2 - 1, y: ((gy - p.y) / p.h) * 2 - 1 };
}
function pickJoint(p, px, py, thresh) {
  let best = null, bd = thresh;
  const h = canvas.clientHeight;
  for (const j of activeJoints()) {
    const v = j.marker.position.clone().project(p.cam);
    if (v.z > 1 || v.z < -1) continue;
    const sx = p.x + (v.x * 0.5 + 0.5) * p.w;
    const syGL = p.y + (v.y * 0.5 + 0.5) * p.h;
    const sy = h - syGL;
    const d = Math.hypot(sx - px, sy - py);
    if (d < bd) { bd = d; best = j; }
  }
  return best;
}

function bindPointer() {
  let downXY = null, moved = false;
  const jointUndo = [];   // {joint, pos} snapshots — Ctrl+Z via E.undoJoint()
  E.undoJoint = function () {
    const u = jointUndo.pop(); if (!u) return false;
    u.joint.marker.position.copy(u.pos); u.joint._moved = true;
    updateBoneLines();
    E.selectJoint(u.joint.id);
    if (onSelectCb && selJoint) onSelectCb(serializeJoint(selJoint));
    return true;
  };
  canvas.addEventListener('pointerdown', e => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    const p = panelAt(px, py); if (!p) return;
    if (p.kind === 'ortho') lastOrthoView = p.name;   // remember the view being worked in
    downXY = [px, py]; moved = false;
    canvas.setPointerCapture(e.pointerId);
    if (zoneMode && p.kind === 'ortho') { drag = { mode: 'zone', panel: p, x0: px, y0: py, cx: px, cy: py }; emitZoneRect(px, py, px, py); return; }
    const hit = markerRoot.visible ? pickJoint(p, px, py, 16) : null;
    if (hit) {
      E.selectJoint(hit.id);
      const nd = panelNDC(p, px, py);
      ray.setFromCamera(new THREE.Vector2(nd.x, nd.y), p.cam);
      const normal = new THREE.Vector3(); p.cam.getWorldDirection(normal);
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hit.marker.position);
      drag = { mode: 'joint', joint: hit, panel: p, plane, startPos: hit.marker.position.clone() };
    } else if (p.kind === 'persp') {
      // shift-drag or middle-mouse pans the perspective view; plain drag orbits
      const wantPan = e.button === 1 || e.shiftKey;
      if (e.button === 1) e.preventDefault();
      drag = { mode: wantPan ? 'panPersp' : 'orbit', panel: p, lx: px, ly: py };
    } else {
      drag = { mode: 'pan', panel: p, lx: px, ly: py };
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    if (downXY && Math.hypot(px - downXY[0], py - downXY[1]) > 3) moved = true;
    if (drag.mode === 'joint') {
      const p = drag.panel, nd = panelNDC(p, px, py);
      ray.setFromCamera(new THREE.Vector2(nd.x, nd.y), p.cam);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(drag.plane, hit)) {
        drag.joint.marker.position.copy(hit); drag.joint._moved = true;
        updateBoneLines();
        if (onSelectCb && drag.joint === selJoint) onSelectCb(serializeJoint(selJoint));
      }
    } else if (drag.mode === 'orbit') {
      persp.az -= (px - drag.lx) * 0.01; persp.el += (py - drag.ly) * 0.01;
      persp.el = Math.max(-1.4, Math.min(1.4, persp.el));
      drag.lx = px; drag.ly = py; updateCameras();
    } else if (drag.mode === 'pan') {
      const o = drag.panel.o;
      const halfH = (o.cam.top - o.cam.bottom) / 2, wppY = (2 * halfH) / drag.panel.h;
      const halfW = (o.cam.right - o.cam.left) / 2, wppX = (2 * halfW) / drag.panel.w;
      const right = new THREE.Vector3().setFromMatrixColumn(o.cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(o.cam.matrixWorld, 1);
      const dx = px - drag.lx, dy = py - drag.ly;
      o.target.addScaledVector(right, -dx * wppX).addScaledVector(up, dy * wppY);
      drag.lx = px; drag.ly = py; updateCameras();
    } else if (drag.mode === 'panPersp') {
      const cam = persp.cam;
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      const k = persp.radius * 0.0022;
      const dx = px - drag.lx, dy = py - drag.ly;
      persp.pan.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
      drag.lx = px; drag.ly = py; updateCameras();
    } else if (drag.mode === 'zone') {
      drag.cx = px; drag.cy = py; emitZoneRect(drag.x0, drag.y0, px, py);
    }
  });
  const up = e => {
    if (drag && drag.mode === 'zone') { finishZone(drag); }
    if (drag && drag.mode === 'joint' && moved && drag.startPos) {
      jointUndo.push({ joint: drag.joint, pos: drag.startPos });
      if (jointUndo.length > 50) jointUndo.shift();
    }
    drag = null; downXY = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // double-click a panel to maximize it (or restore the quad)
  canvas.addEventListener('dblclick', e => {
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    if (soloView) { E.setSoloView(null); return; }
    const p = panelAt(px, py); if (!p) return;
    E.setSoloView(p.name);
  });

  canvas.addEventListener('wheel', e => {
    const rect = canvas.getBoundingClientRect();
    const p = panelAt(e.clientX - rect.left, e.clientY - rect.top); if (!p) return;
    e.preventDefault();
    const f = Math.pow(1.0015, e.deltaY);
    if (p.kind === 'persp') { persp.radius = Math.max(modelR * 0.4, Math.min(modelR * 40, persp.radius * f)); }
    else { p.o.zoom = Math.max(0.15, Math.min(12, p.o.zoom / f)); }
    updateCameras();
  }, { passive: false });
}

// ============================================================
// SKELETON BUILD + BIND
// ============================================================
function clearRig() {
  if (rigGroup) { scene.remove(rigGroup); rigGroup.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
  if (skelHelper) { scene.remove(skelHelper); skelHelper = null; }
  rigGroup = null; skeleton = null; skinnedMeshes = []; boneByJoint.clear();
  restQuats = []; restPositions = []; rigData = null; animPlaying = false;
  extActive = false; if (extMixer) { extMixer.stopAllAction(); extMixer = null; } extAction = null; extState = null;
}

// build THREE.Bone hierarchy from enabled joints, return {bones, order}
function buildSkeletonBones() {
  const ej = enabledJoints();
  // topological order: parents before children
  const ordered = [];
  const placed = new Set();
  const tryAdd = () => {
    let progress = true;
    while (progress) {
      progress = false;
      for (const j of ej) {
        if (placed.has(j.id)) continue;
        const p = enabledParent(j);
        if (!p || placed.has(p.id)) { ordered.push(j); placed.add(j.id); progress = true; }
      }
    }
  };
  tryAdd();
  const boneRoot = new THREE.Group(); boneRoot.name = '__boneRoot';
  const bones = [];
  boneByJoint.clear();
  ordered.forEach(j => {
    const bone = new THREE.Bone(); bone.name = j.id;
    const p = enabledParent(j);
    const parentBone = p ? boneByJoint.get(p.id) : null;
    (parentBone || boneRoot).add(bone);
    boneByJoint.set(j.id, bone);
    bones.push(bone);
  });
  // set world positions
  boneRoot.updateMatrixWorld(true);
  ordered.forEach(j => {
    const bone = boneByJoint.get(j.id);
    const wp = j.marker.position.clone();
    const parent = bone.parent;
    parent.updateMatrixWorld(true);
    bone.position.copy(parent.worldToLocal(wp));
    bone.updateMatrixWorld(true);
  });
  boneRoot.updateMatrixWorld(true);
  return { boneRoot, bones, order: ordered };
}

// per-bone segment (head=joint, tail=mean child or stub) in WORLD space
function boneSegments(bones, order) {
  return bones.map((bone, i) => {
    const head = new THREE.Vector3(); bone.getWorldPosition(head);
    const children = bone.children.filter(c => c.isBone);
    let tail = new THREE.Vector3();
    if (children.length) {
      children.forEach(c => { const t = new THREE.Vector3(); c.getWorldPosition(t); tail.add(t); });
      tail.multiplyScalar(1 / children.length);
    } else {
      // stub along (head - parentHead)
      const ph = new THREE.Vector3();
      if (bone.parent && bone.parent.isBone) bone.parent.getWorldPosition(ph);
      else ph.copy(head).add(new THREE.Vector3(0, -modelR * 0.1, 0));
      const dir = head.clone().sub(ph); if (dir.lengthSq() < 1e-9) dir.set(0, 1, 0);
      tail = head.clone().addScaledVector(dir.normalize(), modelR * 0.08);
    }
    return { head: [head.x, head.y, head.z], tail: [tail.x, tail.y, tail.z], index: i };
  });
}

E.canBind = function () { return enabledJoints().length >= 2 && modelMeshes.length > 0; };

E.bind = async function (opts) {
  opts = opts || {};
  const job = opts.job || null;
  // Progress goes through the job if one was supplied, else the legacy callback.
  const onP = opts.onProgress || (job ? (ph, fr) => job.progress(ph, fr) : (() => {}));
  const ckpt = () => { if (job && job.cancelled) throw new Error('cancelled'); };
  clearRig();
  ckpt();
  onP('building skeleton', 0.02);
  const { boneRoot, bones, order } = buildSkeletonBones();
  const segs = boneSegments(bones, order);

  // gather per-mesh world positions (geometry already baked into world space)
  const meshData = modelMeshes.map(m => {
    const g = m.geometry;
    const pos = g.getAttribute('position');
    return { positions: pos.array.slice ? pos.array.slice() : new Float32Array(pos.array), count: pos.count, mesh: m, geo: g };
  });

  let weights;
  if (opts.quality === 'hq') {
    weights = await bindHQ(meshData, segs, opts, onP);
    if (!weights) { // worker fell back
      onP('fast fallback', 0.9);
      weights = meshData.map(md => fastWeights(md.positions, segs, opts.falloff));
    }
  } else {
    onP('computing distance weights', 0.3);
    await new Promise(r => setTimeout(r, 30));
    weights = meshData.map(md => fastWeights(md.positions, segs, opts.falloff));
    onP('binding', 0.85);
  }
  ckpt();   // a cancel during the solve abandons the result before we build the rig

  // build skeleton + skinned meshes
  const skel = new THREE.Skeleton(bones);
  rigGroup = new THREE.Group(); rigGroup.name = '__rig';
  rigGroup.add(boneRoot);
  skinnedMeshes = [];
  meshData.forEach((md, i) => {
    const g = md.geo;                                  // world-baked geometry
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(weights[i].skinIndex, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights[i].skinWeight, 4));
    const sm = new THREE.SkinnedMesh(g, md.mesh.material);
    sm.name = md.mesh.userData.matName + '_skinned_' + i;
    sm.normalizeSkinWeights();
    sm.bind(skel, new THREE.Matrix4());
    rigGroup.add(sm);
    skinnedMeshes.push(sm);
  });
  skeleton = skel;
  scene.add(rigGroup);

  // hide raw mesh + markers, show rig solid
  modelGroup.visible = false;
  skinnedMeshes.forEach(m => { m.material.transparent = false; m.material.opacity = 1; m.material.depthWrite = true; });
  markerRoot.visible = false; boneLines.visible = false;

  // skeleton helper
  skelHelper = new THREE.SkeletonHelper(boneRoot);
  skelHelper.material.color = new THREE.Color(0x4d82d6);
  skelHelper.material.depthTest = false; skelHelper.renderOrder = 991; skelHelper.visible = true;
  scene.add(skelHelper);

  // store rest pose
  restQuats = bones.map(b => b.quaternion.clone());
  restPositions = bones.map(b => b.position.clone());
  buildRigData(bones, order, segs);

  onP('done', 1);
  return { bones: bones.length, meshes: skinnedMeshes.length,
    verts: meshData.reduce((s, m) => s + m.count, 0), quality: opts.quality };
};

E.setRigVisible = v => { if (skelHelper) skelHelper.visible = v; };
E.showMarkers = v => { markerRoot.visible = v; boneLines.visible = v; if (modelGroup) modelGroup.visible = v; };

// Return to joint-placement: tear down the rig but KEEP joints/markers where the
// user put them, so they can fix placement and re-bind.
E.editJoints = function () {
  clearRig();                       // removes skinned meshes + helper, stops anim
  if (modelGroup) { modelGroup.visible = true; applyEffectiveOpacity(); }
  markerRoot.visible = true; boneLines.visible = true;
  refreshMarkerColors(); updateBoneLines();
};
E.isBound = () => !!rigGroup;

// ---- FAST weights (bone-segment distance, radius-aware, cross-limb cutoff) ----
// Two passes. Pass 1 estimates each bone's THICKNESS (mean distance of the
// vertices it owns) so a bulky muscle isn't penalized for being far from its
// own bone axis. Pass 2 ranks bones by distance NORMALIZED by that radius —
// a bicep vert 8cm from a thick upper-arm bone stays owned by it instead of
// being grabbed (and crushed) by a skinny neighbouring bone.
function fastWeights(positions, segs, falloff) {
  const n = positions.length / 3;
  const skinIndex = new Uint16Array(n * 4);
  const skinWeight = new Float32Array(n * 4);
  const exponent = 2.6 + (falloff || 0.5) * 4.0;   // sharper → less bleed
  const cutoffK = 1.65;                             // ignore bones much farther than the nearest
  const B = segs.length;

  // ---- pass 1: per-bone radius estimate ----
  const rSum = new Float64Array(B), rCnt = new Uint32Array(B);
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    let b0 = 0, d0 = Infinity;
    for (let b = 0; b < B; b++) {
      const s = segs[b], h = s.head, t = s.tail;
      const d = distPtSeg(x, y, z, h[0], h[1], h[2], t[0], t[1], t[2]);
      if (d < d0) { d0 = d; b0 = b; }
    }
    rSum[b0] += d0; rCnt[b0]++;
  }
  const rad = new Float32Array(B);
  let rAvg = 0, rN = 0;
  for (let b = 0; b < B; b++) { if (rCnt[b] > 3) { rad[b] = rSum[b] / rCnt[b]; rAvg += rad[b]; rN++; } }
  rAvg = rN ? rAvg / rN : 0.05;
  for (let b = 0; b < B; b++) { if (!(rad[b] > 1e-6)) rad[b] = rAvg; }

  // ---- pass 2: weights on radius-normalized distances ----
  for (let v = 0; v < n; v++) {
    const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
    let i0 = 0, i1 = 0, i2 = 0, i3 = 0, d0 = Infinity, d1 = Infinity, d2 = Infinity, d3 = Infinity;
    for (let b = 0; b < B; b++) {
      const s = segs[b], h = s.head, t = s.tail;
      const d = distPtSeg(x, y, z, h[0], h[1], h[2], t[0], t[1], t[2]) / rad[b];
      if (d < d0) { d3 = d2; i3 = i2; d2 = d1; i2 = i1; d1 = d0; i1 = i0; d0 = d; i0 = b; }
      else if (d < d1) { d3 = d2; i3 = i2; d2 = d1; i2 = i1; d1 = d; i1 = b; }
      else if (d < d2) { d3 = d2; i3 = i2; d2 = d; i2 = b; }
      else if (d < d3) { d3 = d; i3 = b; }
    }
    const idx = [i0, i1, i2, i3], dd = [d0, d1, d2, d3];
    const dmin = d0 + 1e-5;
    const cutoff = dmin * cutoffK;
    let wsum = 0; const w = [0, 0, 0, 0];
    for (let s = 0; s < 4; s++) {
      if (s > 0 && dd[s] > cutoff) continue;         // far bone → no influence (kills cross-limb pull)
      const rel = (dd[s] + 1e-5) / dmin;
      const ww = Math.pow(1 / rel, exponent); w[s] = ww; wsum += ww;
    }
    for (let s = 0; s < 4; s++) { skinIndex[v * 4 + s] = idx[s]; skinWeight[v * 4 + s] = w[s] / wsum; }
  }
  return { skinIndex, skinWeight };
}

function distPtSeg(px, py, pz, ax, ay, az, bx, by, bz) {
  const abx = bx - ax, aby = by - ay, abz = bz - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  let t = (apx * abx + apy * aby + apz * abz) / (abx * abx + aby * aby + abz * abz || 1e-9);
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const dx = apx - abx * t, dy = apy - aby * t, dz = apz - abz * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// ---- HQ weights (voxel geodesic, worker) ----
function bindHQ(meshData, segs, opts, onP) {
  return new Promise((resolve, reject) => {
    // build a combined triangle soup (world space) for voxelization
    let triFloats = 0;
    const tArrays = [];
    modelMeshes.forEach(m => {
      const g = m.geometry, pos = g.getAttribute('position'), idx = g.index;
      const arr = pos.array;
      if (idx) {
        const ia = idx.array, t = new Float32Array(ia.length * 3);
        for (let i = 0; i < ia.length; i++) { const a = ia[i] * 3; t[i * 3] = arr[a]; t[i * 3 + 1] = arr[a + 1]; t[i * 3 + 2] = arr[a + 2]; }
        tArrays.push(t); triFloats += t.length;
      } else { const t = new Float32Array(arr); tArrays.push(t); triFloats += t.length; }
    });
    const tris = new Float32Array(triFloats); let off = 0;
    tArrays.forEach(t => { tris.set(t, off); off += t.length; });

    const worker = new Worker('studio3D_scripts/skin-worker.js?v=' + Date.now());
    const job = opts.job || null;
    // Cancel = terminate the worker (its result only ever returns via postMessage,
    // so a hard kill mid-flood corrupts nothing) and reject as cancelled.
    if (job) {
      if (job.cancelled) { worker.terminate(); reject(new Error('cancelled')); return; }
      job.attachWorker(worker);
      job.signal.addEventListener('abort', () => { reject(new Error('cancelled')); }, { once: true });
    }
    const meshes = meshData.map(md => ({ positions: md.positions }));
    worker.onmessage = ev => {
      const m = ev.data;
      if (m.type === 'progress') onP(m.phase, m.frac);
      else if (m.type === 'fallback') { worker.terminate(); resolve(null); }
      else if (m.type === 'error') { worker.terminate(); reject(new Error(m.message)); }
      else if (m.type === 'done') { worker.terminate(); E.lastDiag = m.diag || null; resolve(m.meshes); }
    };
    worker.onerror = err => { worker.terminate(); reject(new Error(err.message || 'worker failed')); };
    const transfer = [tris.buffer, ...meshes.map(m => m.positions.buffer)];
    worker.postMessage({ type: 'bind', tris, meshes, bones: segs, res: opts.res || 56, falloff: opts.falloff }, transfer);
  });
}

// ============================================================
// PROCEDURAL TEST ANIMATION
// ============================================================
E.setClip = c => { stopExternal(); animClip = c; animT = 0; if (c === 'tpose') restPose(); };
E.play = () => { if (!skeleton) return false; if (animClip === 'tpose') { restPose(); return false; } animPlaying = true; clock.getDelta(); return true; };
E.pause = () => { animPlaying = false; };
E.isPlaying = () => animPlaying;
E.restPose = restPose;
function restPose() {
  animPlaying = false; animT = 0;
  stopExternal();
  if (skeleton) skeleton.bones.forEach((b, i) => { if (restQuats[i]) b.quaternion.copy(restQuats[i]); if (restPositions[i]) b.position.copy(restPositions[i]); });
}
function stopExternal() {
  extActive = false; if (extAction) { extAction.stop(); }
  // clear any root-motion translation the external clip left on the hips
  if (skeleton) skeleton.bones.forEach((b, i) => { if (restPositions[i]) b.position.copy(restPositions[i]); });
}

// rotate a bone (by joint base name + optional side) about a LOCAL axis
function rot(base, side, axis, ang) {
  const id = side ? base + '_' + side : base;
  const b = boneByJoint.get(id); if (!b) return;
  const i = skeleton.bones.indexOf(b); if (i < 0) return;
  const q = restQuats[i] ? restQuats[i].clone() : new THREE.Quaternion();
  q.multiply(new THREE.Quaternion().setFromAxisAngle(axis, ang));
  b.quaternion.copy(q);
}
const AX = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

function poseSkeleton(t) {
  if (!skeleton) return;
  // reset to rest each frame, then layer animated deltas on top
  skeleton.bones.forEach((b, i) => { if (restQuats[i]) b.quaternion.copy(restQuats[i]); if (restPositions[i]) b.position.copy(restPositions[i]); });
  const s = Math.sin, c = Math.cos;
  if (animClip === 'wave') {
    rot('Shoulder', 'R', AX.z, -1.15);
    rot('Elbow', 'R', AX.x, -0.5 + 0.5 * s(t * 6));
    rot('Wrist', 'R', AX.z, 0.3 * s(t * 6));
    rot('Spine', null, AX.y, 0.05 * s(t * 2));
    rot('Head', null, AX.y, 0.15 * s(t * 3));
  } else if (animClip === 'idle') {
    const b = s(t * 1.6);
    rot('Spine', null, AX.x, 0.04 * b);
    rot('Chest', null, AX.x, 0.03 * b);
    rot('Head', null, AX.x, -0.04 * b);
    rot('Shoulder', 'R', AX.z, 0.06 + 0.03 * b); rot('Shoulder', 'L', AX.z, -0.06 - 0.03 * b);
    rot('Elbow', 'R', AX.x, 0.18 + 0.05 * b); rot('Elbow', 'L', AX.x, 0.18 + 0.05 * b);
    rot('Hips', null, AX.y, 0.03 * s(t * 0.8));
  } else if (animClip === 'walk') {
    const w = t * 5;
    const fs = Math.cos(extYaw * Math.PI / 180) >= 0 ? 1 : -1;   // Facing flips stride direction
    rot('UpperLeg', 'R', AX.x, fs * 0.6 * s(w)); rot('UpperLeg', 'L', AX.x, fs * 0.6 * s(w + Math.PI));
    rot('Knee', 'R', AX.x, -0.7 * Math.max(0, s(w + 0.6)) - 0.1); rot('Knee', 'L', AX.x, -0.7 * Math.max(0, s(w + Math.PI + 0.6)) - 0.1);
    rot('Shoulder', 'R', AX.x, fs * 0.5 * s(w + Math.PI)); rot('Shoulder', 'L', AX.x, fs * 0.5 * s(w));
    rot('Elbow', 'R', AX.x, 0.3 + 0.2 * s(w)); rot('Elbow', 'L', AX.x, 0.3 + 0.2 * s(w + Math.PI));
    rot('Spine', null, AX.y, 0.12 * s(w)); rot('Hips', null, AX.x, 0.06 + 0.05 * s(w * 2));
    rot('Chest', null, AX.y, -0.1 * s(w));
  }
  skeleton.bones[0].updateMatrixWorld(true);
}

// ============================================================
// EXTERNAL ANIMATION RETARGETING
// Load a clip from another FBX (e.g. Mixamo) and drive THIS rig with it.
// Our bones have identity rest orientation, so we retarget in WORLD space:
//   delta = sourceBoneWorldAnim · sourceBoneWorldRest⁻¹
// then re-solve each of our bones' LOCAL rotation from those world deltas.
// A yaw offset (facing) re-orients the whole motion — also fixes front/back.
// ============================================================
const fbxAnimLoader = new FBXLoader();

// map a source bone name (Mixamo / generic) → our rig joint id, or null to skip.
// Handles every Mixamo prefix flavour: "mixamorig:Hips", "mixamorigHips",
// "mixamorig1:Hips" (numbered re-uploads), "mixamorig_Hips".
function mapSrcToRig(name) {
  let n = String(name).replace(/^.*[|]/, '').replace(/^mixamorig\d*[:_]?/i, '');
  let side = null;
  if (/^left/i.test(n)) side = 'L'; else if (/^right/i.test(n)) side = 'R';
  const core = n.replace(/^(left|right)/i, '').replace(/[\s:.\-]/g, '').toLowerCase();
  const M = {
    hips: 'Hips', pelvis: 'Hips', spine: 'Spine', spine1: 'Chest', spine01: 'Chest',
    spine2: 'Chest', spine02: 'Chest', spine3: 'Chest', chest: 'Chest', upperchest: 'Chest',
    neck: 'Neck', neck1: 'Neck',
    head: 'Head',
    arm: 'Shoulder', upperarm: 'Shoulder', forearm: 'Elbow', lowerarm: 'Elbow', hand: 'Wrist',
    upleg: 'UpperLeg', upperleg: 'UpperLeg', thigh: 'UpperLeg', leg: 'Knee', calf: 'Knee', shin: 'Knee',
    foot: 'Ankle', toebase: 'Toe', toe: 'Toe', ball: 'Toe',
    eye: 'Eye', jaw: 'Jaw',
  };
  // fingers — all three phalanges, Mixamo (LeftHandThumb1) and generic (thumb_01) styles
  ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach(f => {
    const rigBase = f.charAt(0).toUpperCase() + f.slice(1);
    for (let i = 1; i <= 3; i++) {
      M['hand' + f + i] = rigBase + i;
      M[f + i] = rigBase + i;
      M[f + '0' + i] = rigBase + i;
    }
  });
  const base = M[core];
  if (!base) return null;
  const CENTER = ['Hips', 'Spine', 'Chest', 'Neck', 'Head', 'Jaw'];
  if (CENTER.includes(base)) return base;
  return side ? base + '_' + side : base;
}

// Parse a source FBX, sample its first clip, store per-frame world deltas keyed
// by OUR rig bone id. Does not yet build the playable clip (facing chosen later).
E.loadExternalClip = async function (file) {
  if (!skeleton) throw new Error('Bind the rig first, then load an animation.');
  const buf = await file.arrayBuffer();
  const src = fbxAnimLoader.parse(buf, '');
  const clips = src.animations || [];
  if (!clips.length) throw new Error('No animation clip found in that FBX.');
  const clip = clips[0];

  // gather source bones
  src.updateMatrixWorld(true);
  const srcBones = {};
  src.traverse(o => { if (o.isBone || o.isObject3D) { if (o.name) srcBones[o.name] = o; } });

  // Reference pose = the source skeleton's BIND POSE — the un-animated node
  // hierarchy, which for Mixamo FBX is the true T-pose. (Previously this used
  // the clip's FIRST FRAME, which is garbage for clips that start mid-action:
  // a stab or a jump begins twisted, so every delta was wrong and some clips
  // played back-to-front while others looked fine.)
  // NOTE: srcBones was captured from the hierarchy BEFORE any mixer ran, so
  // world quaternions right now ARE the bind pose.
  const restWorld = {};
  for (const name in srcBones) {
    const rig = mapSrcToRig(name);
    if (rig && boneByJoint.has(rig)) restWorld[name] = srcBones[name].getWorldQuaternion(new THREE.Quaternion());
  }

  // hips root motion: sample the source hips' world translation, rescaled to
  // this rig's proportions, so jumps / hops / travel actually move the character
  let srcHips = null;
  for (const name in srcBones) {
    if (mapSrcToRig(name) === 'Hips' && (srcBones[name].isBone || !srcHips)) srcHips = srcBones[name];
  }
  const ourHipsBone = boneByJoint.get('Hips');
  const hipsIdx = ourHipsBone ? skeleton.bones.indexOf(ourHipsBone) : -1;
  const ourHipsRest = hipsIdx >= 0 && restPositions[hipsIdx] ? restPositions[hipsIdx].clone() : (ourHipsBone ? ourHipsBone.position.clone() : null);
  let srcHipsRest = null, hipScale = 1;
  if (srcHips && ourHipsRest) {
    srcHipsRest = srcHips.getWorldPosition(new THREE.Vector3());
    hipScale = Math.abs(srcHipsRest.y) > 1e-6 ? ourHipsRest.y / srcHipsRest.y : 1;
  }

  const mixer = new THREE.AnimationMixer(src);
  const action = mixer.clipAction(clip); action.play();

  // ---- REST-POSE COMPENSATION (fixes A-pose meshes) ----
  // Mixamo clips assume a T-pose rest. If OUR mesh was bound in A-pose (or any
  // other rest), every retargeted arm rotation lands offset by that difference.
  // Fix: per chain bone, compare OUR bind-pose limb direction with the SOURCE
  // skeleton's bind direction and store the shortest-arc rotation between them.
  // Applying it as a pre-rotation (world = delta · C) makes our limb line up
  // with wherever the source limb points, whatever pose we were bound in.
  const srcByRig = {};
  for (const name in srcBones) { const rig = mapSrcToRig(name); if (rig && (srcBones[name].isBone || !srcByRig[rig])) srcByRig[rig] = srcBones[name]; }
  const CHAIN = { Hips: 'Spine', Spine: 'Chest', Chest: 'Neck', Neck: 'Head',
    Shoulder_R: 'Elbow_R', Elbow_R: 'Wrist_R', UpperLeg_R: 'Knee_R', Knee_R: 'Ankle_R', Ankle_R: 'Toe_R',
    Shoulder_L: 'Elbow_L', Elbow_L: 'Wrist_L', UpperLeg_L: 'Knee_L', Knee_L: 'Ankle_L', Ankle_L: 'Toe_L' };
  const bindWorldPos = id => {
    const b = boneByJoint.get(id); if (!b) return null;
    const i = skeleton.bones.indexOf(b); if (i < 0 || !skeleton.boneInverses[i]) return null;
    const m = new THREE.Matrix4().copy(skeleton.boneInverses[i]).invert();   // bind world matrix
    return new THREE.Vector3().setFromMatrixPosition(m);
  };
  const corr = {}; let aposeDeg = 0;
  for (const a in CHAIN) {
    const sa = srcByRig[a], sb = srcByRig[CHAIN[a]]; if (!sa || !sb) continue;
    const oa = bindWorldPos(a), ob = bindWorldPos(CHAIN[a]); if (!oa || !ob) continue;
    const vOur = ob.sub(oa), vSrc = sb.getWorldPosition(new THREE.Vector3()).sub(sa.getWorldPosition(new THREE.Vector3()));
    if (vOur.lengthSq() < 1e-10 || vSrc.lengthSq() < 1e-10) continue;
    vOur.normalize(); vSrc.normalize();
    if (vOur.dot(vSrc) > 0.9998) continue;                    // <~1° — already aligned
    corr[a] = new THREE.Quaternion().setFromUnitVectors(vOur, vSrc);
    const ang = 2 * Math.acos(Math.min(1, Math.abs(corr[a].w))) * 180 / Math.PI;
    if (a.startsWith('Shoulder')) aposeDeg = Math.max(aposeDeg, ang);
  }

  // sample the clip
  const fps = 30, dur = clip.duration || 1;
  const frames = Math.max(2, Math.round(dur * fps));
  const times = new Float32Array(frames);
  const deltas = [];                       // per frame: { rigId: Quaternion(worldDelta) }
  const hipsDelta = (srcHips && srcHipsRest) ? new Float32Array(frames * 3) : null;   // rescaled hips travel
  const tmpInv = new THREE.Quaternion(), tmpV = new THREE.Vector3();
  for (let f = 0; f < frames; f++) {
    const t = Math.min(dur, f / fps);
    times[f] = f / fps;
    mixer.setTime(t);
    src.updateMatrixWorld(true);
    const frame = {};
    for (const name in restWorld) {
      const rig = mapSrcToRig(name);
      const wq = srcBones[name].getWorldQuaternion(new THREE.Quaternion());
      tmpInv.copy(restWorld[name]).invert();
      frame[rig] = wq.multiply(tmpInv);     // worldDelta = anim · rest⁻¹
    }
    deltas.push(frame);
    if (hipsDelta) {
      srcHips.getWorldPosition(tmpV).sub(srcHipsRest).multiplyScalar(hipScale);
      hipsDelta[f * 3] = tmpV.x; hipsDelta[f * 3 + 1] = tmpV.y; hipsDelta[f * 3 + 2] = tmpV.z;
    }
  }
  action.stop(); mixer.uncacheClip(clip);
  extState = { name: file.name.replace(/\.fbx$/i, ''), times, deltas, duration: times[frames - 1], hipsDelta, hipsRest: ourHipsRest, corr };
  buildExternalClip(extYaw);

  // ---- compatibility report: what the clip drives vs what this rig has ----
  const rigIds = new Set(skeleton.bones.map(b => b.name));
  const friendly = id => id.replace(/_R$/, ' R').replace(/_L$/, ' L');
  const clipWants = new Set();          // rig joints the clip would drive
  for (const name in srcBones) { const r = mapSrcToRig(name); if (r) clipWants.add(r); }
  const driven = [...clipWants].filter(r => rigIds.has(r));
  const missingInRig = [...clipWants].filter(r => !rigIds.has(r));   // clip needs, you don't have
  const unusedInClip = [...rigIds].filter(r => !clipWants.has(r));   // you placed, clip ignores
  const report = {
    driven: driven.map(friendly).sort(),
    missing: missingInRig.map(friendly).sort(),   // animation requires, rig lacks
    unused: unusedInClip.map(friendly).sort(),    // rig has, animation doesn't use
  };
  return { name: extState.name, duration: +extState.duration.toFixed(2), frames, report, aposeDeg: Math.round(aposeDeg) };
};

// Build a playable AnimationClip on OUR bones from stored world deltas + yaw.
// If extMirror is on, the whole motion is reflected across the X=0 plane:
// each world delta gets its L/R source swapped and is conjugated by the
// reflection (qx, -qy, -qz, qw stays a rotation because we ALSO swap sides),
// and hips travel negates X.
const MIRROR_SWAP = id => id.endsWith('_R') ? id.slice(0, -2) + '_L' : id.endsWith('_L') ? id.slice(0, -2) + '_R' : id;
function mirrorQuat(q) { return new THREE.Quaternion(q.x, -q.y, -q.z, q.w); }
function buildExternalClip(yawDeg) {
  if (!extState || !skeleton) return;
  extYaw = yawDeg || 0;
  const yawQ = new THREE.Quaternion().setFromAxisAngle(AX.y, extYaw * Math.PI / 180);
  const yawInv = yawQ.clone().invert();
  const bones = skeleton.bones;
  const { times, deltas } = extState;
  const frames = times.length;

  // per-bone local-quat sample buffers
  const buf = bones.map(() => new Float32Array(frames * 4));
  const worldQ = new Map();                 // bone.uuid → world quat this frame
  const tmp = new THREE.Quaternion(), parentInv = new THREE.Quaternion();

  for (let f = 0; f < frames; f++) {
    const frame = deltas[f];
    worldQ.clear();
    for (let bi = 0; bi < bones.length; bi++) {
      const bone = bones[bi];
      const parent = bone.parent;
      const pWorld = (parent && worldQ.has(parent.uuid)) ? worldQ.get(parent.uuid) : new THREE.Quaternion();
      let myWorld;
      let d = frame[bone.name];
      if (extMirror) { const md = frame[MIRROR_SWAP(bone.name)]; d = md ? mirrorQuat(md) : (d ? mirrorQuat(d) : d); }
      if (d) {
        // world = yaw · delta · (rest-pose correction) · yaw⁻¹
        const C = extComp && extState.corr ? extState.corr[bone.name] : null;
        myWorld = yawQ.clone().multiply(d);
        if (C) myWorld.multiply(C);
        myWorld.multiply(yawInv);
      } else {
        myWorld = pWorld.clone();             // unmapped → inherit parent (local identity)
      }
      worldQ.set(bone.uuid, myWorld.clone());
      // local = parentWorld⁻¹ · myWorld
      parentInv.copy(pWorld).invert();
      tmp.copy(parentInv).multiply(myWorld);
      buf[bi][f * 4] = tmp.x; buf[bi][f * 4 + 1] = tmp.y; buf[bi][f * 4 + 2] = tmp.z; buf[bi][f * 4 + 3] = tmp.w;
    }
  }

  const tracks = [];
  for (let bi = 0; bi < bones.length; bi++) {
    tracks.push(new THREE.QuaternionKeyframeTrack(bones[bi].name + '.quaternion', times, buf[bi]));
  }
  // hips root motion — translate the root through space (yaw re-oriented) so
  // jumps and travelling moves actually displace the character
  const hipsBone = boneByJoint.get('Hips');
  if (hipsBone) {
    if (extState.hipsDelta && extState.hipsRest && extRootMotion) {
      const hd = extState.hipsDelta, hr = extState.hipsRest;
      const pv = new Float32Array(frames * 3);
      const dv = new THREE.Vector3();
      for (let f = 0; f < frames; f++) {
        dv.set(extMirror ? -hd[f * 3] : hd[f * 3], hd[f * 3 + 1], hd[f * 3 + 2]).applyQuaternion(yawQ);
        pv[f * 3] = hr.x + dv.x; pv[f * 3 + 1] = hr.y + dv.y; pv[f * 3 + 2] = hr.z + dv.z;
      }
      tracks.push(new THREE.VectorKeyframeTrack(hipsBone.name + '.position', times, pv));
    } else if (extState.hipsRest) {
      hipsBone.position.copy(extState.hipsRest);   // root motion off → pin hips at rest
    }
  }
  const clip = new THREE.AnimationClip(extState.name, extState.duration, tracks);
  if (extMixer) extMixer.stopAllAction();
  extMixer = new THREE.AnimationMixer(rigGroup);
  extAction = extMixer.clipAction(clip);
  extAction.play();
}

E.playExternal = function () {
  if (!extState) return false;
  buildExternalClip(extYaw);
  extActive = true; animPlaying = false; clock.getDelta();
  return true;
};
E.pauseExternal = function () { extActive = false; };
E.resumeExternal = function () { if (extState) { extActive = true; clock.getDelta(); } };
E.isExtPlaying = () => extActive;
E.setFacing = function (deg) {
  extYaw = deg;
  if (extState) { const wasActive = extActive; buildExternalClip(deg); if (wasActive) { extActive = true; } }
};
E.getFacing = () => extYaw;
E.setMirror = function (on) {
  extMirror = !!on;
  if (extState) { const wasActive = extActive; buildExternalClip(extYaw); if (wasActive) { extActive = true; } }
};
E.getMirror = () => extMirror;
E.setPoseComp = function (on) {
  extComp = !!on;
  if (extState) { const wasActive = extActive; buildExternalClip(extYaw); if (wasActive) { extActive = true; } }
};
E.getPoseComp = () => extComp;
E.setRootMotion = function (on) {
  extRootMotion = !!on;
  if (extState) { const wasActive = extActive; buildExternalClip(extYaw); if (wasActive) { extActive = true; } }
};
E.getRootMotion = () => extRootMotion;
E.hasExternal = () => !!extState;

// ============================================================
// EXPORT DATA + GLB / glTF
// ============================================================
function buildRigData(bones, order, segs) {
  // capture everything fbx-export.js needs (world-bind space, identity transforms)
  const boneInfo = bones.map((b, i) => {
    const wm = b.matrixWorld.clone();
    return {
      name: b.name, parent: b.parent && b.parent.isBone ? bones.indexOf(b.parent) : -1,
      worldMatrix: wm.elements.slice(),
      localPos: [b.position.x, b.position.y, b.position.z],
      localQuat: [b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w],
    };
  });
  const meshes = skinnedMeshes.map(sm => {
    const g = sm.geometry;
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), uv = g.getAttribute('uv');
    return {
      name: sm.name,
      positions: pos.array, normals: nor ? nor.array : null, uvs: uv ? uv.array : null,
      index: g.index ? g.index.array : null,
      skinIndex: g.getAttribute('skinIndex').array, skinWeight: g.getAttribute('skinWeight').array,
      vertexCount: pos.count,
    };
  });
  rigData = { bones: boneInfo, meshes };
}
E.getRigData = () => rigData;

E.exportGLTF = async function (binary) {
  if (!rigGroup) throw new Error('Bind first');
  restPose();
  const exp = new GLTFExporter();
  const result = await new Promise((res, rej) => exp.parse(rigGroup, res, rej, { binary, embedImages: true, onlyVisible: false }));
  if (binary) return { blob: new Blob([result], { type: 'model/gltf-binary' }), ext: 'glb' };
  return { blob: new Blob([JSON.stringify(result)], { type: 'model/gltf+json' }), ext: 'gltf' };
};

window.RigEngine = E;
window.THREE_R = THREE;
E.debug = () => ({
  modelVisible: modelGroup ? modelGroup.visible : null,
  markersVisible: markerRoot ? markerRoot.visible : null,
  hasRig: !!rigGroup,
  rigChildren: rigGroup ? rigGroup.children.length : 0,
  skinned: skinnedMeshes.length,
  helperVisible: skelHelper ? skelHelper.visible : null,
  sceneChildren: scene ? scene.children.map(c => c.name || c.type) : [],
  focus: focusMode, solo: soloView,
  jointsTotal: joints.length,
  markersVisibleCount: joints.filter(j => j.marker && j.marker.visible).length,
  boneVerts: boneLines && boneLines.geometry.getAttribute('position') ? boneLines.geometry.getAttribute('position').count : 0,
  panelCount: panels().length,
});
