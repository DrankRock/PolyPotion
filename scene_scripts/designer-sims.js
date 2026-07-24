// designer-sims.js — Sims-like building UX enhancements.
//
// Features:
//   1. Wall transparency modes: solid / translucent / wireframe / hidden
//      + auto-cutaway when camera tilts downward (like The Sims)
//   2. Multi-floor system integrated with the plan editor
//   3. Smart duplicate with direction chaining
//   4. Multi-select alignment & distribution tools
//   5. Repeat placement in a line
//   6. Eyedropper: pick material/color from one object and paint onto another
//   7. Ruler grid overlay
//   8. Quick-rotate buttons
//   9. Bottom toolbar with most-used actions

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;
    const $ = _D.$;

    // ═══════════════════════════════════════════════════════
    //  STATE
    // ═══════════════════════════════════════════════════════
    const sims = window._sims = {
      wallMode: "solid",
      autoCutaway: true,
      cutawayAngle: 55,
      // Multi-floor: each floor stores its own plan data
      floors: [{
        id: 0, name: "Ground floor", yBase: 0, height: 2.8, visible: true,
        plan: null // will be set to window._plan.state after plan init
      }],
      activeFloor: 0,
      gridVisible: false,
      gridSpacing: 1.0,
      repeatDir: "x+",
      repeatSpacing: 0,
      repeatCount: 1,
      lastDupOffset: null,
      eyedropperActive: false,
      _storedMat: null,
      _storedColor: null,
    };

    injectStyles();
    addWallModeControls();
    addFloorPanel();
    addSimsToolbar();
    addAlignmentPanel();
    setupAutoCutaway();
    setupSmartDuplicate();
    setupEyedropper();
    setupQuickRotate();
    setupRulerGrid();
    setupRepeatPlacement();
    setupFloorPlanIntegration();

    // ═══════════════════════════════════════════════════════
    //  STYLES
    // ═══════════════════════════════════════════════════════
    function injectStyles() {
      const s = document.createElement("style");
      s.textContent = `
        #sims-toolbar{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);z-index:8;
          display:flex;gap:2px;background:rgba(0,0,0,.72);padding:5px 8px;border-radius:10px;
          backdrop-filter:blur(8px);border:1px solid rgba(212,163,115,.15)}
        #sims-toolbar button{padding:6px 10px;background:transparent;border:1px solid transparent;
          color:var(--text2);font:inherit;font-size:10px;cursor:pointer;border-radius:6px;
          display:flex;flex-direction:column;align-items:center;gap:2px;min-width:48px;
          transition:all .12s;letter-spacing:.03em}
        #sims-toolbar button:hover{color:var(--accent);background:rgba(212,163,115,.08);border-color:rgba(212,163,115,.2)}
        #sims-toolbar button.on{color:var(--accent);border-color:var(--accent);background:rgba(212,163,115,.12)}
        #sims-toolbar .st-icon{font-size:16px;line-height:1}
        #sims-toolbar .st-sep{width:1px;background:var(--border);margin:4px 3px;flex-shrink:0}

        #wall-mode-bar{display:flex;gap:3px;margin-top:8px}
        #wall-mode-bar button{flex:1;padding:5px 4px;font-size:10px;border:1px solid var(--border);
          background:var(--surface2);color:var(--text2);font:inherit;cursor:pointer;border-radius:4px;
          transition:all .12s;text-align:center}
        #wall-mode-bar button:hover{border-color:var(--accent);color:var(--accent)}
        #wall-mode-bar button.on{border-color:var(--accent);color:var(--accent);background:var(--surface3)}

        #sec-floors .floor-row{display:flex;align-items:center;gap:6px;padding:5px 0;font-size:11px;color:var(--text2);cursor:pointer;border-radius:3px;padding:4px 6px}
        #sec-floors .floor-row:hover{background:var(--surface2)}
        #sec-floors .floor-row.active{color:var(--accent);background:var(--surface3)}
        #sec-floors .floor-row .fl-name{flex:1}
        #sec-floors .floor-row button{background:none;border:none;color:var(--text2);cursor:pointer;font-size:12px;padding:2px 4px}
        #sec-floors .floor-row button:hover{color:var(--accent)}
        .floor-add-btn{width:100%;padding:5px;font-size:11px;border:1px dashed var(--border);
          background:transparent;color:var(--text2);font:inherit;border-radius:3px;cursor:pointer;margin-top:6px}
        .floor-add-btn:hover{color:var(--accent);border-color:var(--accent)}
        #floor-height-row{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:10px;color:var(--text2)}
        #floor-height-row input{width:60px;padding:3px 5px;background:var(--surface3);border:1px solid var(--border);color:var(--text);font:inherit;font-size:11px;border-radius:3px}

        #align-panel{position:absolute;top:50px;right:10px;z-index:8;display:none;
          background:rgba(0,0,0,.75);backdrop-filter:blur(8px);padding:8px;border-radius:8px;
          border:1px solid rgba(212,163,115,.15)}
        #align-panel.show{display:flex;flex-direction:column;gap:4px}
        #align-panel h4{font-size:9px;color:var(--text2);text-transform:uppercase;letter-spacing:.1em;
          font-weight:400;margin-bottom:2px;font-family:var(--mono)}
        .align-row{display:flex;gap:2px}
        .align-row button{width:28px;height:28px;background:rgba(255,255,255,.04);border:1px solid var(--border);
          color:var(--text2);cursor:pointer;border-radius:4px;font-size:13px;display:flex;
          align-items:center;justify-content:center;transition:all .1s;padding:0}
        .align-row button:hover{color:var(--accent);border-color:var(--accent);background:rgba(212,163,115,.08)}

        #quick-rot{position:absolute;top:50px;left:10px;z-index:7;display:none;flex-direction:column;gap:2px}
        #quick-rot.show{display:flex}
        #quick-rot button{width:32px;height:32px;background:rgba(0,0,0,.55);border:1px solid var(--border);
          color:var(--text2);cursor:pointer;border-radius:4px;font-size:11px;font-family:var(--mono);
          transition:all .1s;display:flex;align-items:center;justify-content:center;padding:0}
        #quick-rot button:hover{color:var(--accent);border-color:var(--accent)}

        #repeat-popup{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);z-index:9;
          display:none;background:rgba(0,0,0,.82);backdrop-filter:blur(10px);padding:12px 16px;
          border-radius:10px;border:1px solid rgba(212,163,115,.2);min-width:280px}
        #repeat-popup.show{display:block}
        #repeat-popup h4{font-size:10px;color:var(--accent);text-transform:uppercase;letter-spacing:.1em;
          margin-bottom:8px;font-weight:400;font-family:var(--mono)}
        #repeat-popup .rp-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
        #repeat-popup .rp-row label{font-size:10px;color:var(--text2);min-width:60px;text-transform:uppercase;letter-spacing:.06em}
        #repeat-popup .rp-row input,#repeat-popup .rp-row select{padding:4px 6px;background:var(--surface3);
          border:1px solid var(--border);color:var(--text);font:inherit;font-size:11px;border-radius:3px;outline:none;flex:1}
        #repeat-popup .rp-actions{display:flex;gap:4px;margin-top:8px}
        #repeat-popup .rp-actions button{flex:1;padding:6px;font-size:11px;border-radius:4px;cursor:pointer;font:inherit}

        #cutaway-badge{position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:7;
          background:rgba(212,163,115,0.88);color:#1a1815;font-family:var(--mono);font-size:10px;
          padding:3px 10px;border-radius:12px;pointer-events:none;display:none;letter-spacing:.05em}
        #cutaway-badge.show{display:block}

        body.eyedropper-mode #viewport-area canvas{cursor:crosshair !important}
        body.eyedropper-mode #viewport-area{cursor:crosshair !important}
      `;
      document.head.appendChild(s);
    }

    // ═══════════════════════════════════════════════════════
    //  WALL TRANSPARENCY MODES
    // ═══════════════════════════════════════════════════════
    function addWallModeControls() {
      const roomCfg = document.getElementById("room-cfg");
      if (!roomCfg) return;
      const bar = document.createElement("div");
      bar.id = "wall-mode-bar";
      bar.innerHTML = `
        <button data-wm="solid" class="on">Solid</button>
        <button data-wm="translucent">Trans</button>
        <button data-wm="wireframe">Wire</button>
        <button data-wm="hidden">Hidden</button>
      `;
      roomCfg.appendChild(bar);
      bar.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-wm]");
        if (!b) return;
        sims.wallMode = b.dataset.wm;
        [...bar.querySelectorAll("button")].forEach((x) => x.classList.toggle("on", x === b));
        applyWallMode();
      });

      const acRow = document.createElement("div");
      acRow.style.cssText = "display:flex;align-items:center;gap:6px;margin-top:6px;font-size:10px;color:var(--text2)";
      acRow.innerHTML = `
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
          <input type="checkbox" id="auto-cutaway-cb" ${sims.autoCutaway ? "checked" : ""}>
          Auto-cutaway (Sims mode)
        </label>
      `;
      roomCfg.appendChild(acRow);
      document.getElementById("auto-cutaway-cb").addEventListener("change", (e) => {
        sims.autoCutaway = e.target.checked;
      });
    }

    function applyWallMode() {
      _D.shell.traverse((c) => {
        if (!c.isMesh) return;
        const isFloor = Math.abs(c.rotation.x + Math.PI / 2) < 0.1 ||
                        (c.geometry && c.geometry.type === "CircleGeometry") ||
                        (c.geometry && c.geometry.type === "ShapeGeometry");
        if (isFloor) return;

        switch (sims.wallMode) {
          case "solid":
            c.visible = true;
            c.material.transparent = false;
            c.material.opacity = 1;
            c.material.wireframe = false;
            c.material.depthWrite = true;
            c.material.side = THREE.DoubleSide;
            break;
          case "translucent":
            c.visible = true;
            c.material.transparent = true;
            c.material.opacity = 0.18;
            c.material.wireframe = false;
            c.material.depthWrite = false;
            c.material.side = THREE.DoubleSide;
            break;
          case "wireframe":
            c.visible = true;
            c.material.transparent = false;
            c.material.opacity = 1;
            c.material.wireframe = true;
            c.material.depthWrite = true;
            c.material.side = THREE.DoubleSide;
            break;
          case "hidden":
            c.visible = false;
            break;
        }
        c.material.needsUpdate = true;
      });
    }

    const origRebuildShell = _D.rebuildShell;
    _D.rebuildShell = function () {
      origRebuildShell();
      if (sims.wallMode !== "solid") setTimeout(applyWallMode, 20);
    };
    if (window.D && window.D.rebuildShell) {
      const origDRebuild = window.D.rebuildShell;
      window.D.rebuildShell = function () {
        origDRebuild.apply(this, arguments);
        if (sims.wallMode !== "solid") setTimeout(applyWallMode, 20);
      };
    }

    // ═══════════════════════════════════════════════════════
    //  AUTO-CUTAWAY
    // ═══════════════════════════════════════════════════════
    function setupAutoCutaway() {
      const vp = document.getElementById("viewport-area");
      const badge = document.createElement("div");
      badge.id = "cutaway-badge";
      badge.textContent = "CUTAWAY";
      vp.appendChild(badge);
      let wasCutaway = false;

      function checkCutaway() {
        requestAnimationFrame(checkCutaway);
        if (!sims.autoCutaway) {
          if (wasCutaway) {
            wasCutaway = false;
            badge.classList.remove("show");
            applyWallMode();
          }
          return;
        }
        const cam = _D.camera;
        const dir = new THREE.Vector3();
        cam.getWorldDirection(dir);
        const elevDeg = Math.asin(-dir.y) * (180 / Math.PI);

        if (elevDeg > sims.cutawayAngle && !wasCutaway) {
          wasCutaway = true;
          badge.classList.add("show");
          _D.shell.traverse((c) => {
            if (!c.isMesh) return;
            const isFloor = Math.abs(c.rotation.x + Math.PI / 2) < 0.1 ||
                            (c.geometry && c.geometry.type === "CircleGeometry") ||
                            (c.geometry && c.geometry.type === "ShapeGeometry");
            if (isFloor) return;
            c.visible = true;
            c.material.transparent = true;
            c.material.opacity = 0.08;
            c.material.wireframe = false;
            c.material.depthWrite = false;
            c.material.needsUpdate = true;
          });
        } else if (elevDeg <= sims.cutawayAngle - 5 && wasCutaway) {
          wasCutaway = false;
          badge.classList.remove("show");
          applyWallMode();
        }
      }
      checkCutaway();
    }

    // ═══════════════════════════════════════════════════════
    //  FLOOR SYSTEM (integrated with plan)
    // ═══════════════════════════════════════════════════════
    function addFloorPanel() {
      const roomCfg = document.getElementById("room-cfg");
      if (!roomCfg) return;
      const sec = document.createElement("div");
      sec.className = "psec";
      sec.id = "sec-floors";
      sec.innerHTML = `<h3>Floors</h3><div id="floor-list"></div>
        <div id="floor-height-row"><label>Floor height:</label><input type="number" id="floor-h-input" value="2.8" step="0.1" min="1.5"></div>
        <button class="floor-add-btn" id="floor-add-btn">+ Add floor above</button>`;
      roomCfg.parentNode.insertBefore(sec, roomCfg.nextSibling);

      renderFloors();

      document.getElementById("floor-add-btn").addEventListener("click", () => {
        const H = parseFloat(document.getElementById("floor-h-input").value) || 5;
        const topFloor = sims.floors[sims.floors.length - 1];
        const newId = (sims.floors.reduce((m, f) => Math.max(m, f.id), 0)) + 1;
        sims.floors.push({
          id: newId,
          name: "Floor " + (sims.floors.length + 1),
          yBase: topFloor.yBase + topFloor.height,
          height: H,
          visible: true,
          plan: { vertices: [], segments: [], arcs: [] },
        });
        switchToFloor(newId);
      });
    }

    function renderFloors() {
      const list = document.getElementById("floor-list");
      if (!list) return;
      list.innerHTML = "";
      sims.floors.forEach((f) => {
        const row = document.createElement("div");
        row.className = "floor-row" + (f.id === sims.activeFloor ? " active" : "");
        const wallCount = f.plan ? f.plan.segments.length : "—";
        row.innerHTML = `
          <span class="fl-name" data-fid="${f.id}">${f.name} <span style="font-size:9px;color:var(--text2)">(${wallCount} walls)</span></span>
          <button data-fid="${f.id}" data-act="vis" title="Toggle visibility">${f.visible ? "👁" : "—"}</button>
          ${sims.floors.length > 1 ? `<button data-fid="${f.id}" data-act="del" title="Remove floor">×</button>` : ""}
        `;
        row.addEventListener("click", (e) => {
          const b = e.target.closest("[data-act]");
          if (b) {
            const fid = parseInt(b.dataset.fid);
            if (b.dataset.act === "vis") {
              const fl = sims.floors.find((x) => x.id === fid);
              if (fl) { fl.visible = !fl.visible; renderFloors(); rebuildAllFloors(); }
            } else if (b.dataset.act === "del") {
              sims.floors = sims.floors.filter((x) => x.id !== fid);
              if (sims.activeFloor === fid) switchToFloor(sims.floors[0].id);
              else { renderFloors(); rebuildAllFloors(); }
            }
          } else {
            switchToFloor(f.id);
          }
        });
        list.appendChild(row);
      });
    }

    function switchToFloor(floorId) {
      // Save current plan state to current floor
      saveCurrentPlanToFloor();
      sims.activeFloor = floorId;
      // Load the target floor's plan into the editor
      loadFloorIntoPlan(floorId);
      renderFloors();
      rebuildAllFloors();
    }

    function saveCurrentPlanToFloor() {
      if (!window._plan) return;
      const f = sims.floors.find((x) => x.id === sims.activeFloor);
      if (!f) return;
      const ps = window._plan.state;
      f.plan = {
        vertices: JSON.parse(JSON.stringify(ps.vertices)),
        segments: JSON.parse(JSON.stringify(ps.segments)),
        arcs: JSON.parse(JSON.stringify(ps.arcs)),
      };
    }

    function loadFloorIntoPlan(floorId) {
      if (!window._plan) return;
      const f = sims.floors.find((x) => x.id === floorId);
      if (!f || !f.plan) return;
      const ps = window._plan.state;
      ps.vertices = JSON.parse(JSON.stringify(f.plan.vertices));
      ps.segments = JSON.parse(JSON.stringify(f.plan.segments));
      ps.arcs = JSON.parse(JSON.stringify(f.plan.arcs));
      ps.drawing = null;
      ps.arcDraw = null;
      ps.sel = null;
      if (window._plan.render) window._plan.render();
      // Update the room height input to this floor's height
      const rH = document.getElementById("rH");
      if (rH) rH.value = f.height;
    }

    // Rebuild all floors into the 3D shell
    function rebuildAllFloors() {
      // Save current plan to its floor first
      saveCurrentPlanToFloor();
      if (!window._plan) return;
      const shell = _D.shell;
      // Clear shell
      while (shell.children.length) {
        const c = shell.children[0];
        shell.remove(c);
        _D.disposeObj(c);
      }
      const fc = parseInt(document.getElementById("rFloorCol").value.slice(1), 16);
      const wc = parseInt(document.getElementById("rWallCol").value.slice(1), 16);

      sims.floors.forEach((f) => {
        if (!f.plan) return;
        const yBase = f.yBase;
        const H = f.height;
        const isActive = f.id === sims.activeFloor;
        const wallMat = new THREE.MeshStandardMaterial({
          color: wc, roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
          transparent: !f.visible, opacity: f.visible ? 1 : 0,
        });
        const floorMat = new THREE.MeshStandardMaterial({
          color: fc, roughness: 0.85, metalness: 0, side: THREE.DoubleSide,
          transparent: !f.visible, opacity: f.visible ? 1 : 0,
        });
        // Ghost material for non-active floors when in plan mode
        if (!isActive && _D.currentMode === "plan") {
          wallMat.transparent = true;
          wallMat.opacity = 0.3;
          wallMat.depthWrite = false;
          floorMat.transparent = true;
          floorMat.opacity = 0.3;
          floorMat.depthWrite = false;
        }
        if (!f.visible) return; // skip invisible floors entirely

        // Build floor shape
        const loops = findClosedLoopsFromPlan(f.plan);
        loops.forEach((loop) => {
          const baseVerts = loop.map((idx) => f.plan.vertices[idx]);
          const outerVerts = offsetPolygonOutward(baseVerts, (window._plan.state.thickness || 0.18) / 2);
          const shape = new THREE.Shape();
          outerVerts.forEach((v, i) => {
            // Negate y so the floor normal faces UP after rotation
            if (i === 0) shape.moveTo(v.x, -v.y); else shape.lineTo(v.x, -v.y);
          });
          shape.closePath();
          const geo = new THREE.ShapeGeometry(shape);
          const floor = new THREE.Mesh(geo, floorMat);
          floor.rotation.x = -Math.PI / 2;
          floor.position.y = yBase;
          floor.name = "floor_" + f.id;
          shell.add(floor);
          // Auto-ceiling: clone the floor shape at yBase + height, normal facing DOWN
          const ceilGeo = new THREE.ShapeGeometry(shape);
          const ceilMat = new THREE.MeshStandardMaterial({
            color: wc, roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
            transparent: wallMat.transparent, opacity: wallMat.opacity,
          });
          if (!isActive && _D.currentMode === "plan") {
            ceilMat.transparent = true; ceilMat.opacity = 0.3; ceilMat.depthWrite = false;
          }
          const ceil = new THREE.Mesh(ceilGeo, ceilMat);
          ceil.rotation.x = Math.PI / 2; // flip normal down
          ceil.position.y = yBase + H;
          ceil.name = "ceiling_" + f.id;
          shell.add(ceil);
        });
        // Fallback floor if no closed loop
        if (loops.length === 0 && f.plan.vertices.length) {
          const bb = bboxFromPlan(f.plan);
          const w = Math.max(2, bb.maxX - bb.minX + 4);
          const d = Math.max(2, bb.maxY - bb.minY + 4);
          const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
          floor.rotation.x = -Math.PI / 2;
          floor.position.set((bb.minX + bb.maxX) / 2, yBase, (bb.minY + bb.maxY) / 2);
          floor.name = "floor_fallback_" + f.id;
          shell.add(floor);
        }

        // Build walls
        f.plan.segments.forEach((s) => {
          const a = f.plan.vertices[s.a], b = f.plan.vertices[s.b];
          if (!a || !b) return;
          buildSegmentMeshes(s, a, b, wallMat, H, window._plan.state.thickness || 0.18).forEach((m) => {
            m.position.y += yBase;
            shell.add(m);
          });
        });

        // Build arcs
        (f.plan.arcs || []).forEach((arc) => {
          const segs = arc.segments || 24;
          const start = arc.start, end = arc.end;
          let sweep = end - start;
          while (sweep < 0) sweep += Math.PI * 2;
          while (sweep > Math.PI * 2) sweep -= Math.PI * 2;
          const arcH = arc.height || H;
          const thick = window._plan.state.thickness || 0.18;
          for (let i = 0; i < segs; i++) {
            const t0 = i / segs, t1 = (i + 1) / segs;
            const a0 = start + sweep * t0, a1 = start + sweep * t1;
            const p0 = { x: arc.cx + Math.cos(a0) * arc.radius, y: arc.cy + Math.sin(a0) * arc.radius };
            const p1 = { x: arc.cx + Math.cos(a1) * arc.radius, y: arc.cy + Math.sin(a1) * arc.radius };
            const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) * 1.01;
            const box = new THREE.Mesh(new THREE.BoxGeometry(len, arcH, thick), wallMat);
            const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
            box.position.set(mx, yBase + arcH / 2, my);
            box.rotation.y = -Math.atan2(p1.y - p0.y, p1.x - p0.x);
            shell.add(box);
          }
        });
      });

      _D.genCode();
      if (sims.wallMode !== "solid") setTimeout(applyWallMode, 20);
    }

    // Duplicated helpers from plan module to work on arbitrary plan data
    function buildSegmentMeshes(seg, vA, vB, wallMat, H, thick) {
      const segLen = Math.hypot(vB.x - vA.x, vB.y - vA.y);
      if (segLen < 1e-4) return [];
      const angle = Math.atan2(vB.y - vA.y, vB.x - vA.x);
      const meshes = [];
      const openings = (seg.openings || []).slice().sort((a, b) => a.t - b.t);
      const pieces = [];
      let cursor = 0;
      openings.forEach((op) => {
        const halfTW = (op.width / segLen) / 2;
        const opStart = Math.max(0, op.t - halfTW);
        const opEnd = Math.min(1, op.t + halfTW);
        if (opStart > cursor + 1e-4) pieces.push({ t0: cursor, t1: opStart, y0: 0, y1: H });
        if (op.type === "door") {
          if (op.height < H) pieces.push({ t0: opStart, t1: opEnd, y0: op.height, y1: H });
        } else if (op.type === "window") {
          const sill = op.sill ?? 1;
          const winH = op.height || 1.2;
          if (sill > 0) pieces.push({ t0: opStart, t1: opEnd, y0: 0, y1: sill });
          if (sill + winH < H) pieces.push({ t0: opStart, t1: opEnd, y0: sill + winH, y1: H });
        }
        cursor = opEnd;
      });
      if (cursor < 1 - 1e-4) pieces.push({ t0: cursor, t1: 1, y0: 0, y1: H });

      pieces.forEach((p) => {
        const pieceLen = (p.t1 - p.t0) * segLen;
        const pieceH = p.y1 - p.y0;
        if (pieceLen < 1e-3 || pieceH < 1e-3) return;
        const tMid = (p.t0 + p.t1) / 2;
        const mx = vA.x + (vB.x - vA.x) * tMid;
        const my = vA.y + (vB.y - vA.y) * tMid;
        const box = new THREE.Mesh(new THREE.BoxGeometry(pieceLen, pieceH, thick), wallMat);
        box.position.set(mx, p.y0 + pieceH / 2, my);
        box.rotation.y = -angle;
        meshes.push(box);
      });
      return meshes;
    }

    function findClosedLoopsFromPlan(planData) {
      const adj = new Map();
      planData.vertices.forEach((_, i) => adj.set(i, []));
      planData.segments.forEach((s, i) => {
        adj.get(s.a).push({ to: s.b, segIdx: i });
        adj.get(s.b).push({ to: s.a, segIdx: i });
      });
      const visitedSeg = new Set();
      const loops = [];
      for (let start = 0; start < planData.vertices.length; start++) {
        if ((adj.get(start) || []).length < 2) continue;
        const result = traceLoop(start, adj, visitedSeg, planData);
        if (result && result.length >= 3) loops.push(result);
      }
      return loops;
    }

    function traceLoop(start, adj, visitedSeg, planData) {
      const startEdges = adj.get(start).filter((e) => !visitedSeg.has(e.segIdx));
      if (!startEdges.length) return null;
      const initial = startEdges[0];
      visitedSeg.add(initial.segIdx);
      const loop = [start, initial.to];
      let prev = start, cur = initial.to;
      const MAX = planData.vertices.length * 2;
      for (let i = 0; i < MAX; i++) {
        if (cur === start) return loop.slice(0, -1);
        const choices = adj.get(cur).filter((e) => e.to !== prev && !visitedSeg.has(e.segIdx));
        if (!choices.length) {
          const back = adj.get(cur).find((e) => e.to === start);
          if (back) return loop;
          return null;
        }
        const inDx = planData.vertices[cur].x - planData.vertices[prev].x;
        const inDy = planData.vertices[cur].y - planData.vertices[prev].y;
        const inAng = Math.atan2(inDy, inDx);
        let bestE = null, bestTurn = -Infinity;
        choices.forEach((e) => {
          const dx = planData.vertices[e.to].x - planData.vertices[cur].x;
          const dy = planData.vertices[e.to].y - planData.vertices[cur].y;
          const ang = Math.atan2(dy, dx);
          let turn = ang - inAng;
          while (turn > Math.PI) turn -= 2 * Math.PI;
          while (turn < -Math.PI) turn += 2 * Math.PI;
          if (turn > bestTurn) { bestTurn = turn; bestE = e; }
        });
        if (!bestE) return null;
        visitedSeg.add(bestE.segIdx);
        prev = cur;
        cur = bestE.to;
        loop.push(cur);
      }
      return null;
    }

    function offsetPolygonOutward(verts, distance) {
      if (verts.length < 3 || distance === 0) return verts;
      let area = 0;
      for (let i = 0; i < verts.length; i++) {
        const a = verts[i], b = verts[(i + 1) % verts.length];
        area += a.x * b.y - b.x * a.y;
      }
      let v = verts;
      const reversed = area < 0;
      if (reversed) v = v.slice().reverse();
      const n = v.length;
      const out = new Array(n);
      for (let i = 0; i < n; i++) {
        const prev = v[(i - 1 + n) % n], cur = v[i], next = v[(i + 1) % n];
        const e1x = cur.x - prev.x, e1y = cur.y - prev.y;
        const e2x = next.x - cur.x, e2y = next.y - cur.y;
        const l1 = Math.hypot(e1x, e1y) || 1, l2 = Math.hypot(e2x, e2y) || 1;
        const n1x = e1y / l1, n1y = -e1x / l1;
        const n2x = e2y / l2, n2y = -e2x / l2;
        let mx = n1x + n2x, my = n1y + n2y;
        const ml = Math.hypot(mx, my);
        if (ml < 1e-6) { mx = n1x; my = n1y; }
        else { mx /= ml; my /= ml; }
        const dot = n1x * mx + n1y * my;
        const miterLen = distance / Math.max(0.25, dot);
        out[i] = { x: cur.x + mx * miterLen, y: cur.y + my * miterLen };
      }
      if (reversed) out.reverse();
      return out;
    }

    function bboxFromPlan(planData) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      planData.vertices.forEach((v) => {
        minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
      });
      return { minX, minY, maxX, maxY };
    }

    // ═══════════════════════════════════════════════════════
    //  FLOOR-PLAN INTEGRATION
    // ═══════════════════════════════════════════════════════
    function setupFloorPlanIntegration() {
      // Hook into the plan's auto-build so it goes through our multi-floor builder
      // Wait for plan module to be ready
      function hookPlan() {
        if (!window._plan) { setTimeout(hookPlan, 100); return; }
        const ps = window._plan.state;
        // Ground floor gets the plan's initial state
        sims.floors[0].plan = {
          vertices: ps.vertices,
          segments: ps.segments,
          arcs: ps.arcs,
        };
        // Override the plan's autoBuild to use our multi-floor builder
        const origAutoBuild = ps._autoBuild;
        ps._autoBuild = function () {
          // Set walls dropdown to plan
          const wallsSelect = document.getElementById("rWalls");
          if (wallsSelect && wallsSelect.value !== "plan") wallsSelect.value = "plan";
          // Save & rebuild all floors
          rebuildAllFloors();
        };
        // Also override the plan's buildToShell so it uses multi-floor
        const origBuildToShell = window._plan.buildToShell;
        window._plan.buildToShell = function () {
          rebuildAllFloors();
        };
      }
      hookPlan();
    }

    // ═══════════════════════════════════════════════════════
    //  SIMS TOOLBAR
    // ═══════════════════════════════════════════════════════
    function addSimsToolbar() {
      const vp = document.getElementById("viewport-area");
      const tb = document.createElement("div");
      tb.id = "sims-toolbar";
      tb.innerHTML = `
        <button id="st-move" title="Move (G)"><span class="st-icon">✥</span>Move</button>
        <button id="st-rot" title="Rotate (R)"><span class="st-icon">↻</span>Rotate</button>
        <button id="st-scale" title="Scale (S)"><span class="st-icon">⤡</span>Scale</button>
        <div class="st-sep"></div>
        <button id="st-dup" title="Smart Duplicate (Ctrl+D)"><span class="st-icon">⧉</span>Duplicate</button>
        <button id="st-repeat" title="Repeat placement"><span class="st-icon">⋯</span>Repeat</button>
        <div class="st-sep"></div>
        <button id="st-floor" title="Snap to floor"><span class="st-icon">⏚</span>Floor</button>
        <button id="st-wall" title="Snap to wall"><span class="st-icon">⏐</span>Wall</button>
        <div class="st-sep"></div>
        <button id="st-eyedrop" title="Eyedropper (I)"><span class="st-icon">💧</span>Pick</button>
        <button id="st-ruler" title="Toggle ruler grid"><span class="st-icon">📏</span>Ruler</button>
        <div class="st-sep"></div>
        <button id="st-del" title="Delete (Del)"><span class="st-icon">🗑</span>Delete</button>
      `;
      vp.appendChild(tb);
      document.getElementById("st-move").onclick = () => { window.D.gizmoMode("translate"); updateToolbarActive("translate"); };
      document.getElementById("st-rot").onclick = () => { window.D.gizmoMode("rotate"); updateToolbarActive("rotate"); };
      document.getElementById("st-scale").onclick = () => { window.D.gizmoMode("scale"); updateToolbarActive("scale"); };
      document.getElementById("st-dup").onclick = () => smartDuplicate();
      document.getElementById("st-repeat").onclick = () => toggleRepeatPopup();
      document.getElementById("st-floor").onclick = () => { if (window._snap) window._snap.snapToFloor(); if (window._history) window._history.push("snapFloor"); };
      document.getElementById("st-wall").onclick = () => { if (window._snap) window._snap.snapToWall(); if (window._history) window._history.push("snapWall"); };
      document.getElementById("st-eyedrop").onclick = () => toggleEyedropper();
      document.getElementById("st-ruler").onclick = () => toggleRulerGrid();
      document.getElementById("st-del").onclick = () => window.D.deleteSel();
      updateToolbarActive("translate");
    }
    function updateToolbarActive(mode) {
      const map = { translate: "st-move", rotate: "st-rot", scale: "st-scale" };
      ["st-move", "st-rot", "st-scale"].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("on", id === map[mode]);
      });
    }

    // ═══════════════════════════════════════════════════════
    //  SMART DUPLICATE
    // ═══════════════════════════════════════════════════════
    function setupSmartDuplicate() {
      window.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
          e.preventDefault(); e.stopPropagation(); smartDuplicate();
        }
      }, true);
    }
    function smartDuplicate() {
      const multiSel = window._extras && window._extras.multiSel ? window._extras.multiSel() : [];
      if (multiSel.length > 1) { duplicateMulti(multiSel); return; }
      if (!_D.sel) return;
      const sel = _D.sel, o = sel.obj3d;
      const box = new THREE.Box3().setFromObject(o);
      const size = new THREE.Vector3(); box.getSize(size);
      let offset;
      if (sims.lastDupOffset) { offset = sims.lastDupOffset.clone(); }
      else { offset = size.x >= size.z ? new THREE.Vector3(size.x + 0.1, 0, 0) : new THREE.Vector3(0, 0, size.z + 0.1); }
      const clone = o.clone();
      clone.position.add(offset);
      clone.name = sel.name.replace(/_cp\d*$/, "") + "_cp" + _D.idN;
      _D.scene.add(clone);
      const entry = { id: _D.idN++, name: clone.name, type: sel.type, obj3d: clone, topic: "", intLabel: "",
        opts: JSON.parse(JSON.stringify(sel.opts || {})), isPrimitive: sel.isPrimitive,
        geomParams: sel.geomParams ? JSON.parse(JSON.stringify(sel.geomParams)) : null,
        matType: sel.matType, color: sel.color,
        children: sel.children ? JSON.parse(JSON.stringify(sel.children)) : null,
        groupMeta: sel.groupMeta ? JSON.parse(JSON.stringify(sel.groupMeta)) : null };
      _D.items.push(entry);
      sims.lastDupOffset = offset.clone();
      _D.selectItem(entry); _D.refreshTree(); _D.genCode();
      if (window._history) window._history.push("smartDuplicate");
    }
    function duplicateMulti(entries) {
      const box = new THREE.Box3();
      entries.forEach((e) => box.expandByObject(e.obj3d));
      const size = new THREE.Vector3(); box.getSize(size);
      const offset = size.x >= size.z ? new THREE.Vector3(size.x + 0.2, 0, 0) : new THREE.Vector3(0, 0, size.z + 0.2);
      if (window._extras && window._extras.unmakeHelper) window._extras.unmakeHelper();
      entries.forEach((e) => {
        const clone = e.obj3d.clone(); clone.position.add(offset);
        clone.name = e.name.replace(/_cp\d*$/, "") + "_cp" + _D.idN;
        _D.scene.add(clone);
        _D.items.push({ id: _D.idN++, name: clone.name, type: e.type, obj3d: clone, topic: "", intLabel: "",
          opts: JSON.parse(JSON.stringify(e.opts || {})), isPrimitive: e.isPrimitive,
          geomParams: e.geomParams ? JSON.parse(JSON.stringify(e.geomParams)) : null,
          matType: e.matType, color: e.color, children: e.children ? JSON.parse(JSON.stringify(e.children)) : null,
          groupMeta: e.groupMeta ? JSON.parse(JSON.stringify(e.groupMeta)) : null });
      });
      _D.refreshTree(); _D.genCode();
      if (window._history) window._history.push("duplicateMulti");
    }
    window.addEventListener("designer:select", (e) => { if (!e.detail.entry) sims.lastDupOffset = null; });

    // ═══════════════════════════════════════════════════════
    //  ALIGNMENT & DISTRIBUTION
    // ═══════════════════════════════════════════════════════
    function addAlignmentPanel() {
      const vp = document.getElementById("viewport-area");
      const panel = document.createElement("div");
      panel.id = "align-panel";
      panel.innerHTML = `
        <h4>Align</h4>
        <div class="align-row">
          <button data-align="left" title="Align left">⇤</button>
          <button data-align="centerX" title="Center X">⧫</button>
          <button data-align="right" title="Align right">⇥</button>
          <button data-align="top" title="Align top">⤒</button>
          <button data-align="centerY" title="Center Y">⬔</button>
          <button data-align="bottom" title="Align bottom">⤓</button>
        </div>
        <h4 style="margin-top:6px">Distribute</h4>
        <div class="align-row">
          <button data-dist="x" title="Distribute X">⇔X</button>
          <button data-dist="z" title="Distribute Z">⇔Z</button>
        </div>`;
      vp.appendChild(panel);
      panel.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        const multiSel = window._extras && window._extras.multiSel ? window._extras.multiSel() : [];
        const items = multiSel.length > 1 ? multiSel : []; if (items.length < 2) return;
        if (b.dataset.align) doAlign(items, b.dataset.align);
        else if (b.dataset.dist) doDistribute(items, b.dataset.dist);
        _D.syncFromObj(); _D.genCode(); if (window._history) window._history.push("align");
      });
      setInterval(() => {
        const multiSel = window._extras && window._extras.multiSel ? window._extras.multiSel() : [];
        panel.classList.toggle("show", multiSel.length > 1);
      }, 300);
    }
    function doAlign(items, mode) {
      const boxes = items.map((e) => ({ entry: e, box: new THREE.Box3().setFromObject(e.obj3d) }));
      switch (mode) {
        case "left": { const v = Math.min(...boxes.map(b=>b.box.min.x)); boxes.forEach(b => b.entry.obj3d.position.x += v - b.box.min.x); break; }
        case "right": { const v = Math.max(...boxes.map(b=>b.box.max.x)); boxes.forEach(b => b.entry.obj3d.position.x += v - b.box.max.x); break; }
        case "centerX": { const v = boxes.reduce((s,b)=>s+(b.box.min.x+b.box.max.x)/2,0)/boxes.length; boxes.forEach(b => b.entry.obj3d.position.x += v-(b.box.min.x+b.box.max.x)/2); break; }
        case "top": { const v = Math.max(...boxes.map(b=>b.box.max.y)); boxes.forEach(b => b.entry.obj3d.position.y += v - b.box.max.y); break; }
        case "bottom": { boxes.forEach(b => b.entry.obj3d.position.y -= b.box.min.y); break; }
        case "centerY": { const v = boxes.reduce((s,b)=>s+(b.box.min.y+b.box.max.y)/2,0)/boxes.length; boxes.forEach(b => b.entry.obj3d.position.y += v-(b.box.min.y+b.box.max.y)/2); break; }
      }
    }
    function doDistribute(items, axis) {
      if (items.length < 3) return;
      const key = axis === "x" ? "x" : "z";
      const sorted = items.slice().sort((a,b) => a.obj3d.position[key] - b.obj3d.position[key]);
      const first = sorted[0].obj3d.position[key], last = sorted[sorted.length-1].obj3d.position[key];
      const step = (last - first) / (sorted.length - 1);
      sorted.forEach((e, i) => { e.obj3d.position[key] = first + step * i; });
    }

    // ═══════════════════════════════════════════════════════
    //  EYEDROPPER
    // ═══════════════════════════════════════════════════════
    function setupEyedropper() {
      window.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
        if (e.key.toLowerCase() === "i") toggleEyedropper();
      });
    }
    function toggleEyedropper() {
      sims.eyedropperActive = !sims.eyedropperActive;
      document.body.classList.toggle("eyedropper-mode", sims.eyedropperActive);
      const btn = document.getElementById("st-eyedrop");
      if (btn) btn.classList.toggle("on", sims.eyedropperActive);
      if (sims.eyedropperActive) {
        const handler = (e) => {
          if (!sims.eyedropperActive) return;
          const canvas = _D.renderer.domElement;
          const r = canvas.getBoundingClientRect();
          const ndc = new THREE.Vector2(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1);
          const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, _D.camera);
          const meshes = []; _D.items.forEach(it => it.obj3d.traverse(c => { if(c.isMesh) meshes.push(c); }));
          const hits = ray.intersectObjects(meshes, false);
          if (hits.length) {
            const mat = hits[0].object.material;
            sims._storedColor = mat.color ? "#" + mat.color.getHexString() : null;
            let found = null, h = hits[0].object;
            while (h && !found) { found = _D.items.find(i => i.obj3d === h); h = h.parent; }
            sims._storedMat = found && found.matType ? found.matType : null;
            if (_D.sel && sims._storedColor) {
              if (sims._storedMat && _D.sel.isPrimitive) window.D.setMaterial(sims._storedMat);
              window.D.setColor(sims._storedColor);
            }
          }
          sims.eyedropperActive = false;
          document.body.classList.remove("eyedropper-mode");
          if (btn) btn.classList.remove("on");
          canvas.removeEventListener("pointerup", handler);
        };
        _D.renderer.domElement.addEventListener("pointerup", handler);
      }
    }

    // ═══════════════════════════════════════════════════════
    //  QUICK-ROTATE
    // ═══════════════════════════════════════════════════════
    function setupQuickRotate() {
      const vp = document.getElementById("viewport-area");
      const qr = document.createElement("div"); qr.id = "quick-rot";
      qr.innerHTML = `<button data-qr="-90">↶90</button><button data-qr="-45">↶45</button><button data-qr="45">↷45</button><button data-qr="90">↷90</button>`;
      vp.appendChild(qr);
      qr.addEventListener("click", (e) => {
        const b = e.target.closest("button[data-qr]"); if (!b || !_D.sel) return;
        _D.sel.obj3d.rotation.y += parseInt(b.dataset.qr) * (Math.PI / 180);
        _D.syncFromObj(); _D.genCode(); if (window._history) window._history.push("quickRotate");
      });
      window.addEventListener("designer:select", (e) => { qr.classList.toggle("show", !!e.detail.entry); });
    }

    // ═══════════════════════════════════════════════════════
    //  RULER GRID
    // ═══════════════════════════════════════════════════════
    function setupRulerGrid() { sims._rulerGrid = null; }
    function toggleRulerGrid() {
      sims.gridVisible = !sims.gridVisible;
      const btn = document.getElementById("st-ruler"); if (btn) btn.classList.toggle("on", sims.gridVisible);
      if (sims.gridVisible && !sims._rulerGrid) {
        const W = parseFloat($("rW").value) || 14, D = parseFloat($("rD").value) || 12;
        const gridSize = Math.max(W, D) + 4;
        const divisions = Math.round(gridSize / sims.gridSpacing);
        const grid = new THREE.GridHelper(gridSize, divisions, 0xd4a373, 0x4a4038);
        grid.position.y = 0.005; grid.material.transparent = true; grid.material.opacity = 0.35;
        grid.name = "__rulerGrid__"; _D.scene.add(grid); sims._rulerGrid = grid;
      } else if (!sims.gridVisible && sims._rulerGrid) {
        _D.scene.remove(sims._rulerGrid); sims._rulerGrid = null;
      }
    }

    // ═══════════════════════════════════════════════════════
    //  REPEAT PLACEMENT
    // ═══════════════════════════════════════════════════════
    function setupRepeatPlacement() {
      const vp = document.getElementById("viewport-area");
      const popup = document.createElement("div"); popup.id = "repeat-popup";
      popup.innerHTML = `<h4>Repeat Placement</h4>
        <div class="rp-row"><label>Count</label><input type="number" id="rp-count" min="1" max="50" value="3"></div>
        <div class="rp-row"><label>Direction</label><select id="rp-dir"><option value="x+">→ X+</option><option value="x-">← X-</option><option value="z+">↓ Z+</option><option value="z-">↑ Z-</option></select></div>
        <div class="rp-row"><label>Spacing</label><input type="number" id="rp-spacing" min="0" max="20" step="0.1" value="0" placeholder="0 = auto"></div>
        <div class="rp-actions"><button class="btn sm primary" id="rp-go">Place</button><button class="btn sm" id="rp-close">Cancel</button></div>`;
      vp.appendChild(popup);
      document.getElementById("rp-go").addEventListener("click", doRepeatPlace);
      document.getElementById("rp-close").addEventListener("click", () => popup.classList.remove("show"));
    }
    function toggleRepeatPopup() { if (!_D.sel) return; document.getElementById("repeat-popup").classList.toggle("show"); }
    function doRepeatPlace() {
      if (!_D.sel) return;
      const count = parseInt(document.getElementById("rp-count").value) || 3;
      const dir = document.getElementById("rp-dir").value;
      const sp = parseFloat(document.getElementById("rp-spacing").value) || 0;
      const sel = _D.sel, box = new THREE.Box3().setFromObject(sel.obj3d), size = new THREE.Vector3(); box.getSize(size);
      let ov;
      switch(dir){case"x+":ov=new THREE.Vector3(sp||(size.x+.05),0,0);break;case"x-":ov=new THREE.Vector3(-(sp||(size.x+.05)),0,0);break;
        case"z+":ov=new THREE.Vector3(0,0,sp||(size.z+.05));break;case"z-":ov=new THREE.Vector3(0,0,-(sp||(size.z+.05)));break;}
      for (let i=1;i<=count;i++){
        const clone=sel.obj3d.clone();clone.position.add(ov.clone().multiplyScalar(i));clone.name=sel.name.replace(/_cp\d*$/,"")+"_r"+i;
        _D.scene.add(clone);_D.items.push({id:_D.idN++,name:clone.name,type:sel.type,obj3d:clone,topic:"",intLabel:"",
          opts:JSON.parse(JSON.stringify(sel.opts||{})),isPrimitive:sel.isPrimitive,
          geomParams:sel.geomParams?JSON.parse(JSON.stringify(sel.geomParams)):null,matType:sel.matType,color:sel.color,
          children:sel.children?JSON.parse(JSON.stringify(sel.children)):null,groupMeta:sel.groupMeta?JSON.parse(JSON.stringify(sel.groupMeta)):null});
      }
      _D.refreshTree();_D.genCode();if(window._history)window._history.push("repeatPlace");
      document.getElementById("repeat-popup").classList.remove("show");
    }

    // ═══════════════════════════════════════════════════════
    //  KEYBOARD
    // ═══════════════════════════════════════════════════════
    window.addEventListener("keydown", (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if (e.key.toLowerCase() === "q" && _D.sel) {
        _D.sel.obj3d.rotation.y += Math.PI / 2;
        _D.syncFromObj(); _D.genCode(); if (window._history) window._history.push("quickRot90");
      }
    });

    // ═══════════════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════════════
    sims.applyWallMode = applyWallMode;
    sims.smartDuplicate = smartDuplicate;
    sims.toggleRulerGrid = toggleRulerGrid;
    sims.toggleEyedropper = toggleEyedropper;
    sims.rebuildAllFloors = rebuildAllFloors;
    sims.switchToFloor = switchToFloor;
  }
})();
