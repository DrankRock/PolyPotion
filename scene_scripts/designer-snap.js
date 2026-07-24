// designer-snap.js — Snapping for the 3D gizmo.
//
// While the gizmo is dragging:
//   • Hold ⌘ / Ctrl → snap translation to a grid (default 0.25 m)
//   • Rotation snaps to a configured increment (15° by default)
//   • Scale snaps to 0.1 increments
//   • "Snap to floor"  (button) drops selected to Y = halfHeight
//   • "Snap to wall"   (button) aligns to nearest wall & rotates flush
//
// Public state: window._snap = { gridSize, rotStep, scaleStep, holdToSnap }

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;

    const snap = {
      gridSize: 0.25,
      rotStep: 15 * Math.PI / 180,
      scaleStep: 0.1,
      // If true, snap is ALWAYS on. If false, snap only when ⌘/Ctrl held.
      alwaysOn: false,
      // Last keyboard modifier state for the gizmo handler
      _modifier: false,
    };
    window._snap = snap;

    // Track modifier keys globally
    window.addEventListener("keydown",   (e) => { snap._modifier = e.ctrlKey || e.metaKey; });
    window.addEventListener("keyup",     (e) => { snap._modifier = e.ctrlKey || e.metaKey; });
    window.addEventListener("pointermove", (e) => { snap._modifier = e.ctrlKey || e.metaKey; });

    // Translation/rotation snap on every gizmo change
    _D.gizmo.addEventListener("objectChange", () => {
      if (!_D.sel) return;
      const on = snap.alwaysOn || snap._modifier;
      if (!on) return;
      const o = _D.sel.obj3d;
      const mode = _D.gizmo.getMode();
      if (mode === "translate") {
        o.position.x = Math.round(o.position.x / snap.gridSize) * snap.gridSize;
        o.position.y = Math.round(o.position.y / snap.gridSize) * snap.gridSize;
        o.position.z = Math.round(o.position.z / snap.gridSize) * snap.gridSize;
      } else if (mode === "rotate") {
        o.rotation.x = Math.round(o.rotation.x / snap.rotStep) * snap.rotStep;
        o.rotation.y = Math.round(o.rotation.y / snap.rotStep) * snap.rotStep;
        o.rotation.z = Math.round(o.rotation.z / snap.rotStep) * snap.rotStep;
      } else if (mode === "scale") {
        o.scale.x = Math.max(0.01, Math.round(o.scale.x / snap.scaleStep) * snap.scaleStep);
        o.scale.y = Math.max(0.01, Math.round(o.scale.y / snap.scaleStep) * snap.scaleStep);
        o.scale.z = Math.max(0.01, Math.round(o.scale.z / snap.scaleStep) * snap.scaleStep);
      }
    });

    // Expose helpers for the extras module to wire into buttons
    snap.snapToFloor = function () {
      if (!_D.sel) return;
      const o = _D.sel.obj3d;
      const box = new THREE.Box3().setFromObject(o);
      const minY = box.min.y;
      o.position.y -= minY; // sit on Y=0
      _D.gizmo.updateMatrixWorld();
      _D.syncFromObj(); _D.genCode();
    };

    snap.snapToWall = function () {
      if (!_D.sel) return;
      const o = _D.sel.obj3d;
      // Use room shell width/depth as wall positions
      const W = parseFloat(_D.$("rW").value) || 14;
      const D = parseFloat(_D.$("rD").value) || 12;
      const hW = W / 2, hD = D / 2;
      // Bounding box of selected object
      const box = new THREE.Box3().setFromObject(o);
      const size = new THREE.Vector3(); box.getSize(size);
      // Distances to each wall (back: -Z, front: +Z, left: -X, right: +X)
      const cx = (box.min.x + box.max.x) / 2;
      const cz = (box.min.z + box.max.z) / 2;
      const dists = [
        { wall: "back",  d: Math.abs(cz - (-hD)), tx: 0,    tz: 1,  rotY: 0 },
        { wall: "front", d: Math.abs(cz - ( hD)), tx: 0,    tz: -1, rotY: Math.PI },
        { wall: "left",  d: Math.abs(cx - (-hW)), tx: 1,    tz: 0,  rotY: Math.PI / 2 },
        { wall: "right", d: Math.abs(cx - ( hW)), tx: -1,   tz: 0,  rotY: -Math.PI / 2 },
      ];
      dists.sort((a, b) => a.d - b.d);
      const w = dists[0];
      // Compute target position: object's back face flush with the wall.
      // Use the object's current size after applying our target rotation.
      // Simpler approximation: rotate first, then push.
      o.rotation.y = w.rotY;
      _D.gizmo.updateMatrixWorld();
      const box2 = new THREE.Box3().setFromObject(o);
      const newSize = new THREE.Vector3(); box2.getSize(newSize);
      if (w.wall === "back")  o.position.z = -hD + newSize.z / 2;
      if (w.wall === "front") o.position.z =  hD - newSize.z / 2;
      if (w.wall === "left")  o.position.x = -hW + newSize.x / 2;
      if (w.wall === "right") o.position.x =  hW - newSize.x / 2;
      _D.syncFromObj(); _D.genCode();
    };
  }
})();
