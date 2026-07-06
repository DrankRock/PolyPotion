// ============================================================
// thumbnailer.js — window.PPThumb.render(buffer, ext) → PNG data URL
// Renders a character GLB/GLTF/FBX offscreen to a small framed PNG so Library
// cards show the actual mesh instead of a glyph. Runs on-device, disposes its
// WebGL context immediately (no context leak), and never touches the network.
// ============================================================
import * as THREE from 'https://esm.sh/three@0.160.0';
import { GLTFLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'https://esm.sh/three@0.160.0/examples/jsm/loaders/FBXLoader.js';

async function render(buffer, ext, size) {
  size = size || 256;
  ext = (ext || 'glb').toLowerCase();
  let obj;
  if (ext === 'fbx') obj = new FBXLoader().parse(buffer.slice(0), '');
  else { const g = await new Promise((res, rej) => new GLTFLoader().parse(buffer.slice(0), '', res, rej)); obj = g.scene || (g.scenes && g.scenes[0]); }
  if (!obj) throw new Error('no scene');
  obj.traverse(o => { if (o.isSkinnedMesh && o.skeleton) { try { o.skeleton.pose(); } catch (e) {} } });
  obj.updateMatrixWorld(true);

  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(size, size, false); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x33373d, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(2, 3, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb4de, 0.4); rim.position.set(-2, 1.5, -2); scene.add(rim);
  scene.add(obj);

  // normalize and frame on the upper body (portrait feel)
  const box = new THREE.Box3().setFromObject(obj); const s = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
  const scl = 1.8 / (s.y || 1); obj.scale.setScalar(scl); obj.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(obj); const sz = b2.getSize(new THREE.Vector3()); const ctr = b2.getCenter(new THREE.Vector3());
  const tall = sz.y > sz.x * 1.5;
  const focusY = tall ? b2.max.y - sz.y * 0.22 : ctr.y;
  const dist = tall ? sz.y * 0.7 : Math.max(sz.x, sz.y) * 1.5;
  const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  cam.position.set(ctr.x + dist * 0.25, focusY + sz.y * 0.02, ctr.z + dist); cam.lookAt(ctr.x, focusY, ctr.z);

  renderer.render(scene, cam);
  const url = canvas.toDataURL('image/png');
  renderer.dispose(); const gl = renderer.getContext(); const ext2 = gl && gl.getExtension('WEBGL_lose_context'); if (ext2) ext2.loseContext();
  return url;
}

window.PPThumb = { render };
export default { render };
