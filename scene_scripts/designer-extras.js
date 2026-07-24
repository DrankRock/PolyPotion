// designer-extras.js — Phase 4 features for the room designer.
//
// Bundles these into one module (keeps designer.html script-tag list short):
//   • Multi-select (shift-click; gizmo on a helper group)
//   • Numbered camera views + frame-selected (1=Top, 3=Front, 5=Persp, F)
//   • First-person walkthrough preview
//   • Dimension HUD during gizmo drag + measure tool (M)
//   • Mirror selection across X / Z
//   • Lock / hide flags in the scene tree
//   • Snap-mode toggle button + history undo/redo buttons in the topbar
//   • Save / Load whole scene as JSON; autosave to localStorage
//
// Palette, topic dropdown, and lights live in designer-extras2.js.

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;
    const $ = _D.$;

    injectStyles();
    addTopbarChrome();
    setupViewportChrome();
    // ── Walkthrough state (declared before setup so tick() can read it) ──
    let walking = false;
    const walk = { yaw: 0, pitch: 0, keys: {}, prevCam: null, prevTarget: null };
    // ── Save / autosave key (declared before setupAutosave reads it) ──
    const AUTOSAVE_KEY = "designer:autosave:v1";
    setupMultiSelect();
    setupCameraViews();
    setupWalkthrough();
    setupDimensionHud();
    setupMeasureTool();
    setupMirror();
    setupLockHide();
    setupAutosave();
    setupSaveLoad();

    // ── styles for everything we inject ────────────────
    function injectStyles() {
      const s = document.createElement("style");
      s.textContent = `
        .topbar-mini-group{display:flex;gap:2px;align-items:center}
        .topbar-mini-group button{padding:4px 8px;font-size:11px;background:transparent;border:1px solid var(--border);color:var(--text2);font:inherit;cursor:pointer;border-radius:4px;transition:all .12s}
        .topbar-mini-group button:hover{color:var(--accent);border-color:var(--accent)}
        .topbar-mini-group button.on{color:var(--accent);border-color:var(--accent);background:var(--surface3)}
        .topbar-mini-group button[disabled]{opacity:.35;cursor:not-allowed}
        .topbar-mini-group button[disabled]:hover{color:var(--text2);border-color:var(--border)}
        .topbar-mini-group .lbl{font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.08em;padding:0 4px}
        #view-bar{position:absolute;bottom:10px;right:10px;z-index:6;display:flex;gap:3px;background:rgba(0,0,0,.5);padding:4px;border-radius:6px}
        #view-bar button{padding:4px 9px;background:transparent;border:1px solid transparent;color:var(--text2);font:inherit;font-size:10px;cursor:pointer;border-radius:3px;letter-spacing:.06em;text-transform:uppercase}
        #view-bar button:hover{color:var(--text);background:var(--surface3)}
        #view-bar button.on{color:var(--accent);border-color:var(--accent)}
        #walk-banner{position:absolute;top:10px;left:50%;transform:translateX(-50%);background:rgba(212,163,115,0.9);color:#1a1815;font-family:var(--mono);font-size:11px;padding:6px 14px;border-radius:18px;z-index:11;pointer-events:none;display:none;letter-spacing:.06em}
        #walk-banner.on{display:block}
        #dim-hud{position:absolute;z-index:9;pointer-events:none;background:rgba(212,163,115,0.92);color:#1a1815;font-family:var(--mono);font-size:11px;padding:3px 8px;border-radius:3px;white-space:nowrap;display:none;line-height:1.4}
        #measure-hud{position:absolute;z-index:9;pointer-events:none;background:rgba(0,0,0,.85);color:#fff;font-family:var(--mono);font-size:11px;padding:4px 10px;border-radius:4px;white-space:nowrap;display:none;line-height:1.5;border:1px solid var(--accent)}
        .tree-item .lock,.tree-item .hide{opacity:0;background:none;border:none;color:var(--text2);cursor:pointer;font-size:11px;padding:0 4px;line-height:1}
        .tree-item:hover .lock,.tree-item:hover .hide{opacity:.6}
        .tree-item .lock:hover,.tree-item .hide:hover,.tree-item .lock.on,.tree-item .hide.on{opacity:1;color:var(--accent)}
        .tree-item.locked .nm{opacity:.5}
        .tree-item.hidden-row .nm{opacity:.5;text-decoration:line-through}
        .multi-badge{font-size:9px;color:var(--accent);margin-left:4px}
      `;
      document.head.appendChild(s);
    }

    // ── topbar chrome: undo/redo, snap toggle, save/load, walk ──
    function addTopbarChrome() {
      const tb = document.getElementById("topbar");
      const spacer = tb.querySelector(".spacer");
      // History group (left of theme toggle)
      const histGroup = document.createElement("div");
      histGroup.className = "topbar-mini-group";
      histGroup.innerHTML = `
        <span class="lbl">Edit</span>
        <button id="btn-undo" title="Undo (⌘Z)" disabled>↶</button>
        <button id="btn-redo" title="Redo (⌘⇧Z)" disabled>↷</button>
      `;
      tb.insertBefore(histGroup, spacer);
      const snapGroup = document.createElement("div");
      snapGroup.className = "topbar-mini-group";
      snapGroup.innerHTML = `
        <span class="lbl">Snap</span>
        <button id="btn-snap" title="Toggle snap (hold ⌘ for momentary)">Off</button>
        <button id="btn-walk" title="Walkthrough preview (V)">Walk</button>
      `;
      tb.insertBefore(snapGroup, spacer);

      const ioGroup = document.createElement("div");
      ioGroup.className = "topbar-mini-group";
      ioGroup.style.marginLeft = "8px";
      ioGroup.innerHTML = `
        <span class="lbl">Scene</span>
        <button id="btn-save" title="Save scene JSON">Save</button>
        <button id="btn-load" title="Load scene JSON">Load</button>
      `;
      // Insert next to the existing Download/Copy/Clear cluster (after spacer)
      const clearBtn = tb.querySelector(".btn.danger");
      if (clearBtn) tb.insertBefore(ioGroup, clearBtn);
      else tb.appendChild(ioGroup);

      // Wire history buttons
      const undoBtn = document.getElementById("btn-undo");
      const redoBtn = document.getElementById("btn-redo");
      undoBtn.onclick = () => window._history && window._history.undo();
      redoBtn.onclick = () => window._history && window._history.redo();
      window.addEventListener("designer:historyChange", (e) => {
        undoBtn.disabled = !e.detail.canUndo;
        redoBtn.disabled = !e.detail.canRedo;
      });

      // Snap toggle
      const snapBtn = document.getElementById("btn-snap");
      snapBtn.onclick = () => {
        if (!window._snap) return;
        window._snap.alwaysOn = !window._snap.alwaysOn;
        snapBtn.textContent = window._snap.alwaysOn ? "On" : "Off";
        snapBtn.classList.toggle("on", window._snap.alwaysOn);
      };

      // Save / Load wiring set up in setupSaveLoad()
    }

    // ── extra viewport chrome: view bar, walk banner, dim/measure HUDs ──
    function setupViewportChrome() {
      const vp = document.getElementById("viewport-area");
      const vbar = document.createElement("div");
      vbar.id = "view-bar";
      vbar.innerHTML = `
        <button data-v="top">Top</button>
        <button data-v="front">Front</button>
        <button data-v="right">Right</button>
        <button data-v="persp" class="on">Persp</button>
        <button data-v="frame" title="Frame selected (F)">⤢</button>
      `;
      vp.appendChild(vbar);

      const banner = document.createElement("div");
      banner.id = "walk-banner";
      banner.textContent = "WALKTHROUGH — WASD to move · Mouse to look · ESC or V to exit";
      vp.appendChild(banner);

      const dim = document.createElement("div");
      dim.id = "dim-hud";
      vp.appendChild(dim);

      const meas = document.createElement("div");
      meas.id = "measure-hud";
      vp.appendChild(meas);
    }

    // ── Multi-select via a temporary group helper ──────
    let multiSel = [];
    let groupHelper = null;
    function setupMultiSelect() {
      // Capture-phase pointerup on canvas: if shift, take over
      const canvas = _D.renderer.domElement;
      canvas.addEventListener("pointerup", (e) => {
        if (e.button !== 0) return;
        if (!e.shiftKey) return;
        if (_D.gizmo.dragging) return;
        const r = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, _D.camera);
        const meshes = [];
        _D.items.forEach((it) => it.obj3d.traverse((c) => { if (c.isMesh) meshes.push(c); }));
        const hits = ray.intersectObjects(meshes, false);
        if (!hits.length) return;
        let h = hits[0].object, found = null;
        while (h && !found) { found = _D.items.find((i) => i.obj3d === h); h = h.parent; }
        if (found) {
          toggleMulti(found);
          e.stopImmediatePropagation();
        }
      }, true); // capture
    }
    function toggleMulti(entry) {
      // Start with single sel if nothing yet
      if (!multiSel.length && _D.sel && _D.sel !== entry) {
        multiSel = [_D.sel];
      }
      // Toggle
      const idx = multiSel.indexOf(entry);
      if (idx >= 0) multiSel.splice(idx, 1);
      else multiSel.push(entry);

      if (multiSel.length <= 1) {
        unmakeHelper();
        if (multiSel.length === 1) _D.selectItem(multiSel[0]);
        else _D.deselect();
        multiSel = [];
      } else {
        makeHelper();
        renderTreeBadges();
      }
    }
    function makeHelper() {
      // Tear down existing
      unmakeHelper(false);
      // Compute center
      const center = new THREE.Vector3();
      const worldPos = new THREE.Vector3();
      multiSel.forEach((e) => {
        e.obj3d.getWorldPosition(worldPos);
        center.add(worldPos);
      });
      center.divideScalar(multiSel.length);
      groupHelper = new THREE.Group();
      groupHelper.name = "__multiHelper__";
      groupHelper.position.copy(center);
      _D.scene.add(groupHelper);
      // Re-parent
      const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
      multiSel.forEach((e) => {
        e.obj3d.getWorldPosition(wp);
        e.obj3d.getWorldQuaternion(wq);
        e.obj3d.getWorldScale(ws);
        _D.scene.remove(e.obj3d);
        groupHelper.add(e.obj3d);
        // After parenting, set local = world - center (rotation/scale stay world)
        e.obj3d.position.copy(wp).sub(center);
        e.obj3d.quaternion.copy(wq);
        e.obj3d.scale.copy(ws);
      });
      _D.gizmo.attach(groupHelper);
      _D.showForm(false);
      renderTreeBadges();
    }
    function unmakeHelper(restore = true) {
      if (!groupHelper) return;
      if (restore) {
        const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
        groupHelper.children.slice().forEach((child) => {
          child.getWorldPosition(wp);
          child.getWorldQuaternion(wq);
          child.getWorldScale(ws);
          groupHelper.remove(child);
          _D.scene.add(child);
          child.position.copy(wp);
          child.quaternion.copy(wq);
          child.scale.copy(ws);
        });
      }
      _D.scene.remove(groupHelper);
      groupHelper = null;
      _D.gizmo.detach();
    }
    function renderTreeBadges() {
      // Add a small "+N" badge on the first selected tree item to indicate multi
      const tree = document.getElementById("tree");
      if (!tree) return;
      [...tree.querySelectorAll(".tree-item")].forEach((row) => row.classList.remove("multi"));
      // Indicate multi-selected items with a CSS class (handled in updateRow below)
    }
    // Expose for save/serialization to be aware
    window._extras = window._extras || {};
    window._extras.multiSel = () => multiSel;
    window._extras.unmakeHelper = () => unmakeHelper(true);

    // Keyboard: delete clears multi-selection too
    window.addEventListener("keydown", (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && multiSel.length > 1) {
        unmakeHelper(true);
        multiSel.slice().forEach((entry) => {
          _D.scene.remove(entry.obj3d); _D.disposeObj(entry.obj3d);
        });
        _D.items = _D.items.filter((i) => !multiSel.includes(i));
        multiSel = [];
        _D.showForm(false); _D.refreshTree(); _D.genCode();
        e.preventDefault();
      }
    });

    // ── Camera views ───────────────────────────────────
    let originalCam = { pos: null, target: null };
    function setupCameraViews() {
      const vbar = document.getElementById("view-bar");
      vbar.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-v]"); if (!b) return;
        const v = b.dataset.v;
        if (v === "frame") return frameSelected();
        setView(v);
        [...vbar.querySelectorAll("button")].forEach((x) => x.classList.remove("on"));
        b.classList.add("on");
      });

      window.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
        if (_D.currentMode === "plan") return; // plan tab owns its own hotkeys
        if (e.key === "1") setView("front");
        else if (e.key === "3") setView("right");
        else if (e.key === "7") setView("top");
        else if (e.key === "0" || e.key === "5") setView("persp");
        else if (e.key.toLowerCase() === "f") frameSelected();
      });
    }
    function setView(v) {
      const cam = _D.camera, orb = _D.orbit;
      const tgt = orb.target.clone();
      const dist = Math.max(8, cam.position.distanceTo(tgt));
      let p;
      if (v === "top")    p = new THREE.Vector3(tgt.x, tgt.y + dist, tgt.z + 0.001);
      else if (v === "front") p = new THREE.Vector3(tgt.x, tgt.y, tgt.z + dist);
      else if (v === "right") p = new THREE.Vector3(tgt.x + dist, tgt.y, tgt.z);
      else                p = new THREE.Vector3(tgt.x + dist * 0.7, tgt.y + dist * 0.65, tgt.z + dist * 0.85);
      animateCamera(cam.position.clone(), p, tgt, tgt);
    }
    function frameSelected() {
      const target = multiSel.length ? multiSel.map((e) => e.obj3d)
                  : _D.sel ? [_D.sel.obj3d] : _D.items.map((e) => e.obj3d);
      if (!target.length) return;
      const box = new THREE.Box3();
      target.forEach((o) => box.expandByObject(o));
      if (box.isEmpty()) return;
      const center = new THREE.Vector3(); box.getCenter(center);
      const size = new THREE.Vector3(); box.getSize(size);
      const r = Math.max(size.x, size.y, size.z);
      const dist = Math.max(2, r * 1.8);
      const cam = _D.camera, orb = _D.orbit;
      const dir = cam.position.clone().sub(orb.target).normalize();
      const newPos = center.clone().add(dir.multiplyScalar(dist));
      animateCamera(cam.position.clone(), newPos, orb.target.clone(), center);
    }
    function animateCamera(p0, p1, t0, t1) {
      const cam = _D.camera, orb = _D.orbit;
      const start = performance.now();
      const dur = 350;
      function step(now) {
        const k = Math.min(1, (now - start) / dur);
        const e = 1 - Math.pow(1 - k, 3); // ease-out
        cam.position.lerpVectors(p0, p1, e);
        orb.target.lerpVectors(t0, t1, e);
        orb.update();
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    // ── Walkthrough mode (manual pointer-lock + WASD) ──
    function setupWalkthrough() {
      const btn = document.getElementById("btn-walk");
      btn.onclick = toggleWalk;
      window.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
        if (e.key.toLowerCase() === "v") toggleWalk();
        if (walking) walk.keys[e.key.toLowerCase()] = true;
        if (e.key === "Escape" && walking) toggleWalk();
      });
      window.addEventListener("keyup", (e) => { walk.keys[e.key.toLowerCase()] = false; });
      // mouse look while pointer-locked
      document.addEventListener("mousemove", (e) => {
        if (!walking || document.pointerLockElement !== _D.renderer.domElement) return;
        walk.yaw   -= e.movementX * 0.0025;
        walk.pitch -= e.movementY * 0.0025;
        walk.pitch = Math.max(-1.4, Math.min(1.4, walk.pitch));
      });
      // walk update loop — hook into the existing animate loop
      const origAnimate = window.requestAnimationFrame; // not needed; we use our own RAF
      function tick() {
        requestAnimationFrame(tick);
        if (!walking) return;
        const cam = _D.camera;
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
        const speed = (walk.keys["shift"] ? 0.18 : 0.08);
        if (walk.keys["w"] || walk.keys["arrowup"])    cam.position.addScaledVector(dir, speed);
        if (walk.keys["s"] || walk.keys["arrowdown"])  cam.position.addScaledVector(dir, -speed);
        if (walk.keys["a"] || walk.keys["arrowleft"])  cam.position.addScaledVector(right, -speed);
        if (walk.keys["d"] || walk.keys["arrowright"]) cam.position.addScaledVector(right, speed);
        // Lock to eye height
        cam.position.y = Math.max(0.3, Math.min(2.5, cam.position.y));
        // Apply yaw/pitch to look target
        const lookTarget = new THREE.Vector3(
          cam.position.x + Math.sin(walk.yaw) * Math.cos(walk.pitch),
          cam.position.y + Math.sin(walk.pitch),
          cam.position.z + Math.cos(walk.yaw) * Math.cos(walk.pitch)
        );
        cam.lookAt(lookTarget);
      }
      tick();
    }
    function toggleWalk() {
      walking = !walking;
      const banner = document.getElementById("walk-banner");
      const btn = document.getElementById("btn-walk");
      banner.classList.toggle("on", walking);
      btn.classList.toggle("on", walking);
      if (walking) {
        walk.prevCam = _D.camera.position.clone();
        walk.prevTarget = _D.orbit.target.clone();
        _D.orbit.enabled = false;
        _D.gizmo.detach();
        // Drop camera to eye height at center of scene
        _D.camera.position.set(_D.orbit.target.x, 1.7, _D.orbit.target.z + 3);
        walk.yaw = 0; walk.pitch = 0;
        // Request pointer lock
        _D.renderer.domElement.requestPointerLock();
      } else {
        document.exitPointerLock && document.exitPointerLock();
        _D.orbit.enabled = true;
        if (walk.prevCam) {
          _D.camera.position.copy(walk.prevCam);
          _D.orbit.target.copy(walk.prevTarget);
          _D.orbit.update();
        }
      }
    }

    // ── Dimension HUD during gizmo drag ───────────────
    function setupDimensionHud() {
      const hud = document.getElementById("dim-hud");
      let active = false, startPos = null, startRot = null, startScale = null;
      _D.gizmo.addEventListener("dragging-changed", (e) => {
        if (e.value) {
          active = true;
          if (_D.sel || groupHelper) {
            const o = groupHelper || _D.sel?.obj3d;
            if (o) {
              startPos = o.position.clone();
              startRot = o.rotation.clone();
              startScale = o.scale.clone();
            }
          }
        } else {
          active = false;
          hud.style.display = "none";
        }
      });
      _D.gizmo.addEventListener("objectChange", () => {
        if (!active) return;
        const o = groupHelper || _D.sel?.obj3d;
        if (!o) return;
        const mode = _D.gizmo.getMode();
        let text = "";
        if (mode === "translate" && startPos) {
          const dx = o.position.x - startPos.x;
          const dy = o.position.y - startPos.y;
          const dz = o.position.z - startPos.z;
          text = `Δ ${dx.toFixed(2)}, ${dy.toFixed(2)}, ${dz.toFixed(2)} m`;
        } else if (mode === "rotate" && startRot) {
          const r2d = (r) => (r * 180 / Math.PI).toFixed(1);
          text = `${r2d(o.rotation.x)}°, ${r2d(o.rotation.y)}°, ${r2d(o.rotation.z)}°`;
        } else if (mode === "scale" && startScale) {
          text = `× ${o.scale.x.toFixed(2)}, ${o.scale.y.toFixed(2)}, ${o.scale.z.toFixed(2)}`;
        }
        // Position HUD at obj's screen coords
        const wp = o.getWorldPosition(new THREE.Vector3());
        const screen = wp.project(_D.camera);
        const rect = _D.renderer.domElement.getBoundingClientRect();
        const x = (screen.x * 0.5 + 0.5) * rect.width;
        const y = (-screen.y * 0.5 + 0.5) * rect.height;
        hud.textContent = text;
        hud.style.left = (x + 14) + "px";
        hud.style.top = (y + 14) + "px";
        hud.style.display = "block";
      });
    }

    // ── Measure tool (press M, click 2 points) ────────
    let measuring = false;
    let measureLine = null, measureLabel = null;
    function setupMeasureTool() {
      const hud = document.getElementById("measure-hud");
      let firstPoint = null;
      window.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
        if (e.key.toLowerCase() === "m" && _D.currentMode !== "plan") {
          measuring = !measuring;
          if (measuring) {
            _D.renderer.domElement.style.cursor = "crosshair";
            hud.textContent = "MEASURE — click a point";
            hud.style.left = "50%"; hud.style.top = "20px"; hud.style.transform = "translateX(-50%)";
            hud.style.display = "block";
            firstPoint = null;
          } else {
            _D.renderer.domElement.style.cursor = "";
            hud.style.display = "none";
            clearMeasure();
          }
        } else if (e.key === "Escape" && measuring) {
          measuring = false;
          _D.renderer.domElement.style.cursor = "";
          hud.style.display = "none";
          clearMeasure();
        }
      });
      _D.renderer.domElement.addEventListener("pointerdown", (e) => {
        if (!measuring || e.button !== 0) return;
        e.stopImmediatePropagation();
        const p = pickWorld(e);
        if (!p) return;
        if (!firstPoint) {
          firstPoint = p;
          hud.textContent = "MEASURE — click a second point";
        } else {
          drawMeasure(firstPoint, p);
          const d = firstPoint.distanceTo(p);
          hud.textContent = `${d.toFixed(3)} m — press M or Esc to clear`;
          firstPoint = null;
        }
      }, true);
    }
    function pickWorld(e) {
      const canvas = _D.renderer.domElement;
      const r = canvas.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1
      );
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, _D.camera);
      const meshes = [];
      _D.items.forEach((it) => it.obj3d.traverse((c) => { if (c.isMesh) meshes.push(c); }));
      _D.shell.traverse((c) => { if (c.isMesh) meshes.push(c); });
      const hits = ray.intersectObjects(meshes, false);
      if (hits.length) return hits[0].point.clone();
      // fall back to Y=0 plane
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pt = new THREE.Vector3();
      ray.ray.intersectPlane(plane, pt);
      return pt;
    }
    function drawMeasure(a, b) {
      clearMeasure();
      const mat = new THREE.LineBasicMaterial({ color: 0xd4a373 });
      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      measureLine = new THREE.Line(geo, mat);
      measureLine.userData.noCollide = true;
      _D.scene.add(measureLine);
      // endpoint markers
      const ptMat = new THREE.MeshBasicMaterial({ color: 0xd4a373 });
      [a, b].forEach((p) => {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), ptMat);
        dot.position.copy(p);
        _D.scene.add(dot);
        measureLine.userData.dots = measureLine.userData.dots || [];
        measureLine.userData.dots.push(dot);
      });
    }
    function clearMeasure() {
      if (!measureLine) return;
      (measureLine.userData.dots || []).forEach((d) => {
        _D.scene.remove(d); d.geometry.dispose(); d.material.dispose();
      });
      _D.scene.remove(measureLine);
      measureLine.geometry.dispose(); measureLine.material.dispose();
      measureLine = null;
    }

    // ── Mirror (clone selected, flip across X or Z) ────
    function setupMirror() {
      // Inject Mirror buttons into the Properties section just above the Duplicate/Delete
      window.addEventListener("designer:ready", () => {});
      const pForm = document.getElementById("p-form");
      if (!pForm) return;
      const dupBtn = [...pForm.querySelectorAll("button")].find((b) => /Duplicate/i.test(b.textContent));
      if (!dupBtn) return;
      const mWrap = document.createElement("div");
      mWrap.className = "frow";
      mWrap.style.marginBottom = "6px";
      mWrap.innerHTML = `
        <button class="btn" id="btn-mirror-x" style="flex:1">Mirror X</button>
        <button class="btn" id="btn-mirror-z" style="flex:1">Mirror Z</button>
      `;
      dupBtn.parentNode.insertBefore(mWrap, dupBtn);
      document.getElementById("btn-mirror-x").onclick = () => mirror("x");
      document.getElementById("btn-mirror-z").onclick = () => mirror("z");
    }
    function mirror(axis) {
      if (!_D.sel) return;
      // Use D.duplicate (already history-aware) then mirror the clone
      _D.gizmo.detach();
      // Create the clone manually to flip in place
      const src = _D.sel.obj3d;
      const clone = src.clone();
      clone.name = _D.sel.name + "_mir";
      if (axis === "x") {
        clone.position.x = -src.position.x;
        clone.rotation.y = Math.PI - src.rotation.y;
      } else {
        clone.position.z = -src.position.z;
        clone.rotation.y = -src.rotation.y;
      }
      _D.scene.add(clone);
      const e = {
        id: _D.idN, name: clone.name, type: _D.sel.type, obj3d: clone,
        topic: "", intLabel: "",
        opts: JSON.parse(JSON.stringify(_D.sel.opts || {})),
        isPrimitive: _D.sel.isPrimitive,
        geomParams: JSON.parse(JSON.stringify(_D.sel.geomParams || null)),
        matType: _D.sel.matType, color: _D.sel.color,
      };
      _D.idN = _D.idN + 1;
      _D.items.push(e);
      _D.selectItem(e);
      _D.refreshTree(); _D.genCode();
      if (window._history) window._history.push("mirror");
    }

    // ── Lock + hide flags in the scene tree ────────────
    function setupLockHide() {
      // Patch refreshTree to add icons. Wrap original.
      const orig = _D.refreshTree;
      window._D.refreshTree = function () {
        orig();
        const tree = document.getElementById("tree");
        if (!tree) return;
        [...tree.querySelectorAll(".tree-item")].forEach((row, i) => {
          const e = _D.items[i];
          if (!e) return;
          row.classList.toggle("locked", !!e._locked);
          row.classList.toggle("hidden-row", !!e._hidden);
          if (multiSel.includes(e)) {
            const dot = row.querySelector(".dot");
            if (dot) dot.style.outline = "2px solid var(--accent)";
          }
          // Inject buttons before the "x"
          const x = row.querySelector(".x");
          if (!x) return;
          const lock = document.createElement("button");
          lock.className = "lock" + (e._locked ? " on" : "");
          lock.title = e._locked ? "Unlock" : "Lock";
          lock.textContent = e._locked ? "🔒" : "🔓";
          lock.onclick = (ev) => {
            ev.stopPropagation();
            e._locked = !e._locked;
            // Reflect lock by disabling pointerEvents on the obj3d's interactive raycast
            e.obj3d.userData._locked = e._locked;
            _D.refreshTree();
          };
          const hide = document.createElement("button");
          hide.className = "hide" + (e._hidden ? " on" : "");
          hide.title = e._hidden ? "Show" : "Hide";
          hide.textContent = e._hidden ? "🙈" : "👁";
          hide.onclick = (ev) => {
            ev.stopPropagation();
            e._hidden = !e._hidden;
            e.obj3d.visible = !e._hidden;
            _D.refreshTree();
          };
          row.insertBefore(lock, x);
          row.insertBefore(hide, x);
        });
      };

      // Block selection of locked items: wrap selectItem to ignore _locked.
      const origSelect = _D.selectItem;
      _D.selectItem = function (entry) {
        if (entry && entry._locked) return;
        origSelect(entry);
      };
    }

    // ── Save / Load whole scene as JSON + localStorage autosave ──
    function setupAutosave() {
      // Autosave on any history change (debounced)
      let timer = null;
      window.addEventListener("designer:historyChange", () => {
        clearTimeout(timer);
        timer = setTimeout(autosave, 600);
      });
      // Try to restore on boot — but only after the user confirms.
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (!raw) return;
      try {
        const snap = JSON.parse(raw);
        const age = snap._ts ? ((Date.now() - snap._ts) / 60000).toFixed(1) : "?";
        // Tiny prompt at the bottom of the left panel
        const left = document.getElementById("left-panel");
        if (!left) return;
        const banner = document.createElement("div");
        banner.style.cssText = "padding:10px 12px;background:var(--surface3);border-bottom:1px solid var(--border);font-size:11px;color:var(--text2)";
        banner.innerHTML = `
          <div style="margin-bottom:6px;color:var(--accent)">Autosave from ${age}m ago</div>
          <button class="btn sm" id="btn-restore">Restore</button>
          <button class="btn sm" id="btn-discard" style="margin-left:6px">Discard</button>
        `;
        left.insertBefore(banner, left.firstChild);
        document.getElementById("btn-restore").onclick = () => { loadFromSnap(snap); banner.remove(); };
        document.getElementById("btn-discard").onclick = () => { localStorage.removeItem(AUTOSAVE_KEY); banner.remove(); };
      } catch (_) {}
    }
    function autosave() {
      try {
        const snap = captureSnap();
        snap._ts = Date.now();
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snap));
      } catch (e) {
        // Could fail on large imported models — silently drop.
      }
    }
    function setupSaveLoad() {
      document.getElementById("btn-save").onclick = () => {
        const snap = captureSnap();
        const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "scene.designer.json";
        a.click();
        URL.revokeObjectURL(a.href);
      };
      document.getElementById("btn-load").onclick = () => {
        const f = document.createElement("input");
        f.type = "file"; f.accept = "application/json,.json";
        f.onchange = () => {
          const file = f.files[0]; if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try { loadFromSnap(JSON.parse(reader.result)); }
            catch (e) { alert("Invalid scene file: " + e.message); }
          };
          reader.readAsText(file);
        };
        f.click();
      };
    }
    function captureSnap() {
      // Use the history module's capture if available
      if (window._history) {
        // Synthesize one without pushing
        // History doesn't expose capture directly; we duplicate the shape here.
      }
      const $ = _D.$;
      return {
        version: 1,
        shell: {
          W: $("rW").value, D: $("rD").value, H: $("rH").value,
          floor: $("rFloorCol").value, wall: $("rWallCol").value,
          walls: $("rWalls").value, shape: $("rShape").value,
        },
        plan: window._plan ? JSON.parse(JSON.stringify(window._plan.state)) : null,
        items: _D.items.map((e) => ({
          name: e.name, type: e.type,
          topic: e.topic || "", intLabel: e.intLabel || "",
          opts: e.opts || {},
          isPrimitive: e.isPrimitive,
          geomParams: e.geomParams || null,
          matType: e.matType, color: e.color,
          children: e.children || null,
          groupMeta: e.groupMeta || null,
          locked: !!e._locked, hidden: !!e._hidden,
          px: e.obj3d.position.x, py: e.obj3d.position.y, pz: e.obj3d.position.z,
          rx: e.obj3d.rotation.x, ry: e.obj3d.rotation.y, rz: e.obj3d.rotation.z,
          sx: e.obj3d.scale.x,    sy: e.obj3d.scale.y,    sz: e.obj3d.scale.z,
        })),
      };
    }
    function loadFromSnap(snap) {
      // Mirror what history.apply does
      _D.gizmo.detach();
      _D.items.forEach((e) => { _D.scene.remove(e.obj3d); _D.disposeObj(e.obj3d); });
      _D.items = [];
      _D.sel = null;
      const $ = _D.$;
      if (snap.shell) {
        $("rW").value = snap.shell.W; $("rD").value = snap.shell.D; $("rH").value = snap.shell.H;
        $("rFloorCol").value = snap.shell.floor; $("rWallCol").value = snap.shell.wall;
        $("rWalls").value = snap.shell.walls; $("rShape").value = snap.shell.shape;
        const swF = document.getElementById("sw-floor");
        const swW = document.getElementById("sw-wall");
        if (swF) swF.style.background = snap.shell.floor;
        if (swW) swW.style.background = snap.shell.wall;
        _D.rebuildShell();
      }
      if (snap.plan && window._plan) {
        Object.assign(window._plan.state, JSON.parse(JSON.stringify(snap.plan)));
        window._plan.render && window._plan.render();
      }
      let maxId = 0;
      (snap.items || []).forEach((d) => {
        let obj3d;
        if (d.isPrimitive) {
          const geo = _D.makePrimGeo(d.type, d.geomParams);
          const col = parseInt((d.color || "#aaaaaa").replace("#", ""), 16);
          obj3d = new THREE.Mesh(geo, _D.MAT[d.matType || "standard"](col));
        } else if (d.type === "group") {
          obj3d = new THREE.Group();
          (d.children || []).forEach((c) => {
            const cg = _D.makePrimGeo(c.type, c.geomParams);
            const col = parseInt((c.color || "#aaaaaa").replace("#", ""), 16);
            const m = new THREE.Mesh(cg, _D.MAT[c.matType || "standard"](col));
            m.position.set(c.px, c.py, c.pz);
            m.rotation.set(c.rx, c.ry, c.rz);
            m.scale.set(c.sx, c.sy, c.sz);
            obj3d.add(m);
          });
        } else {
          obj3d = _D.OBJ.create(d.type, d.opts);
        }
        if (!obj3d) return;
        obj3d.name = d.name;
        obj3d.position.set(d.px, d.py, d.pz);
        obj3d.rotation.set(d.rx, d.ry, d.rz);
        obj3d.scale.set(d.sx, d.sy, d.sz);
        obj3d.visible = !d.hidden;
        _D.scene.add(obj3d);
        const id = _D.idN; _D.idN = id + 1;
        maxId = Math.max(maxId, id);
        _D.items.push({
          id, name: d.name, type: d.type, obj3d,
          topic: d.topic, intLabel: d.intLabel,
          opts: d.opts, isPrimitive: d.isPrimitive,
          geomParams: d.geomParams, matType: d.matType, color: d.color,
          children: d.children, groupMeta: d.groupMeta,
          _locked: d.locked, _hidden: d.hidden,
        });
      });
      _D.idN = maxId + 1;
      _D.showForm(false);
      _D.refreshTree();
      _D.genCode();
      if (window._history) window._history.push("load");
    }
  }
})();
