// ============================================================
// nav-scheme.js — the ONE camera-navigation contract for every tool.
// (Audit "symmetry as a shared contract", applied to viewport navigation.)
//
// The problem it fixes: each tool built its own OrbitControls, so the mouse
// map drifted — most tools inherited the three.js default (LEFT=orbit,
// RIGHT=pan) while draw tools (retopo) had remapped RIGHT=orbit because their
// LEFT is the pen. Result: right-drag meant "pan" in one tool and "orbit" in
// the next.
//
// The contract, identical everywhere:
//   • RIGHT-drag  → ORBIT   (the universal orbit — the only button that is
//                            free in every tool, including pen/brush tools)
//   • MIDDLE-drag → PAN
//   • wheel       → ZOOM (dolly)
//   • LEFT-drag   → ORBIT in viewer tools; the tool's action (paint / select /
//                   draw) in edit tools — pass { leftDisabled:true } for tools
//                   whose left button is always the pen (e.g. retopo).
//   • touch       → one finger orbit, two fingers pinch-zoom + pan.
//
// Call once, right after `new OrbitControls(...)`, and again whenever a tool
// flips its left button between "orbit" and "tool" mode.
// ============================================================

export function applyOrbitScheme(controls, THREE, opts) {
  opts = opts || {};
  const ROTATE = THREE.MOUSE.ROTATE, PAN = THREE.MOUSE.PAN;
  controls.mouseButtons = {
    LEFT: opts.leftDisabled ? -1 : ROTATE,
    MIDDLE: PAN,
    RIGHT: ROTATE,
  };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.enablePan = true;
  return controls;
}

export default { applyOrbitScheme };
