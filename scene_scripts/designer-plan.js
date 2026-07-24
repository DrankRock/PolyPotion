// designer-plan.js — 2D top-down floor-plan editor.
//
// Activated by switching to the "Plan" tab. Lays a 2D canvas over the 3D
// viewport, lets the user draw walls as polylines (with snapping), place
// doors / windows / arcs, then materialize the plan into the 3D `shell`
// group via `_plan.buildToShell()`.
//
// Coordinate convention:
//   plan vertex {x, y}  →  world position {x: plan.x, z: plan.y}
//   plan +y on screen is into the room (world +Z).
//
// Public API on window._plan:
//   state           — full plan data (vertices, segments, arcs, settings)
//   buildToShell()  — write the plan into _D.shell (called by "Build 3D")
//   setTool(name)
//   clearPlan()

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;
    const $ = _D.$;

    // ── canvas + 2D context ────────────────────────────
    const canvas = document.getElementById("plan-canvas");
    const ctx = canvas.getContext("2d");
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    // ── view transform (zoom + pan in plan-space → screen pixels) ──
    // pixels-per-meter, then offset; (0,0) plan = (offX, offY) screen
    const view = { ppm: 60, offX: 0, offY: 0 };

    // ── plan state ─────────────────────────────────────
    const plan = {
      vertices: [],                 // [{x, y}]
      segments: [],                 // [{a, b, height, openings: [...]}]
      arcs: [],                     // [{cx, cy, radius, start, end, segments, height}]
      thickness: 0.18,
      defaultHeight: 5,
      defaultDoor: { width: 0.9, height: 2.1 },
      defaultWindow: { width: 1.4, height: 1.2, sill: 1.0 },
      snap: 0.25,
      angleLock: 45,
      tool: "pen",
      // transient editing state
      drawing: null,                // {fromIdx} while pen is mid-polyline
      arcDraw: null,                // {step, cx, cy, radius, start}
      roomDraw: null,               // {x0, y0} while dragging rectangle
      hoverV: null, hoverS: null,   // hovered vertex / segment indices
      hoverPos: null,               // current cursor in plan space (snapped)
      sel: null,                    // {kind: 'v'|'s'|'op', ...}
      dragV: null,                  // {idx, offX, offY} while dragging
    };
    window._plan = {
      state: plan,
      buildToShell, setTool, clearPlan, render,
    };

    // ── DOM: toolbar (tools + build buttons) ────────────
    const toolbar = document.getElementById("plan-toolbar");
    toolbar.innerHTML = "";
    const tools = [
      { id: "pen",    label: "Pen",    icon: "✎", key: "P" },
      { id: "room",   label: "Room",   icon: "▢", key: "R" },
      { id: "select", label: "Select", icon: "↖", key: "S" },
      { id: "door",   label: "Door",   icon: "▭", key: "D" },
      { id: "window", label: "Window", icon: "◫", key: "W" },
      { id: "arc",    label: "Arc",    icon: "◠", key: "C" },
      { id: "erase",  label: "Erase",  icon: "✕", key: "X" },
    ];
    tools.forEach((t) => {
      const b = document.createElement("button");
      b.className = "ptool" + (t.id === plan.tool ? " on" : "");
      b.dataset.tool = t.id;
      b.innerHTML = `<span>${t.icon}</span><span>${t.label}</span><span class="ki">${t.key}</span>`;
      b.onclick = () => setTool(t.id);
      toolbar.appendChild(b);
    });
    const sep = document.createElement("span");
    sep.className = "ptool-sep"; sep.style.minHeight = "20px";
    toolbar.appendChild(sep);
    const fitBtn = document.createElement("button");
    fitBtn.className = "ptool";
    fitBtn.innerHTML = `<span>⤢</span><span>Fit</span><span class="ki">F</span>`;
    fitBtn.onclick = fitView;
    toolbar.appendChild(fitBtn);

    // ── status bar ─────────────────────────────────────
    const status = document.getElementById("plan-status");
    function setStatus() {
      const t = plan.tool;
      const hint = {
        pen: "click to add a point · double-click or Enter to close · Shift = free angle",
        room: "click and drag to draw a rectangular room",
        select: "drag a point to move it · Del to remove · drag empty space to pan",
        door: "click on a wall to place a door",
        window: "click on a wall to place a window",
        arc: "click center, click radius, drag sweep",
        erase: "click a point or segment to delete",
      }[t] || "";
      const verts = plan.vertices.length;
      const segs = plan.segments.length;
      const cursor = plan.hoverPos
        ? `(${plan.hoverPos.x.toFixed(2)}, ${plan.hoverPos.y.toFixed(2)})`
        : "";
      status.innerHTML =
        `<span class="pst-val">${t.toUpperCase()}</span> ${verts} pt · ${segs} wall` +
        (plan.arcs.length ? ` · ${plan.arcs.length} arc` : "") +
        (cursor ? ` · ${cursor}` : "") +
        `<br><span class="pst-hint">${hint}</span>`;
    }

    // ── settings panel bindings ────────────────────────
    bindSettings();

    function bindSettings() {
      const h = $("planHeight"), th = $("planThickness");
      const sn = $("planSnap"), an = $("planAngle");
      const dw = $("planDoorW"), dh = $("planDoorH");
      const ww = $("planWinW"),  wh = $("planWinH"), wsill = $("planSill");
      if (h)  h.addEventListener("input",  () => { plan.defaultHeight = +h.value || 5; });
      if (th) th.addEventListener("input", () => { plan.thickness = +th.value || 0.18; });
      if (sn) sn.addEventListener("change", () => { plan.snap = +sn.value; });
      if (an) an.addEventListener("change", () => { plan.angleLock = +an.value; });
      if (dw) dw.addEventListener("input", () => { plan.defaultDoor.width = +dw.value || 0.9; });
      if (dh) dh.addEventListener("input", () => { plan.defaultDoor.height = +dh.value || 2.1; });
      if (ww) ww.addEventListener("input", () => { plan.defaultWindow.width = +ww.value || 1.4; });
      if (wh) wh.addEventListener("input", () => { plan.defaultWindow.height = +wh.value || 1.2; });
      if (wsill) wsill.addEventListener("input", () => { plan.defaultWindow.sill = +wsill.value || 1.0; });

      const buildBtn = $("planBuildBtn");
      if (buildBtn) buildBtn.onclick = () => {
        // Lock the shell's walls dropdown to "From plan" so future rebuilds
        // (color/height changes) keep using the plan instead of falling back
        // to the simple 4-walls construction.
        const wallsSelect = $("rWalls");
        if (wallsSelect && wallsSelect.value !== "plan") wallsSelect.value = "plan";
        buildToShell();
        _D.notify("planBuilt", { plan });
        if (window.D && window.D.switchMode) window.D.switchMode("room");
      };

      // Auto-build: debounced rebuild after any plan change
      let _autoBuildTimer = null;
      function autoBuild() {
        clearTimeout(_autoBuildTimer);
        _autoBuildTimer = setTimeout(() => {
          if (plan.segments.length === 0 && plan.arcs.length === 0) return;
          const wallsSelect = $("rWalls");
          if (wallsSelect && wallsSelect.value !== "plan") wallsSelect.value = "plan";
          buildToShell();
          _D.genCode();
        }, 150);
      }
      // Expose for use in pointer handlers
      plan._autoBuild = autoBuild;
      const clearBtn = $("planClearBtn");
      if (clearBtn) clearBtn.onclick = () => {
        if (!plan.vertices.length || confirm("Clear the entire plan?")) clearPlan();
      };
    }

    // ── pointer + tool plumbing ────────────────────────
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("dblclick", onDouble);
    canvas.addEventListener("contextmenu", (e) => { e.preventDefault(); finishPen(); });
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", resize);
    window.addEventListener("designer:modeChange", (e) => {
      if (e.detail.mode === "plan") { resize(); render(); }
    });

    // initial: wait until plan tab is visible, then size + render
    requestAnimationFrame(() => { resize(); render(); });

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      if (view.offX === 0 && view.offY === 0) fitView();
      render();
    }

    // ── view helpers ───────────────────────────────────
    function fitView() {
      const rect = canvas.getBoundingClientRect();
      if (!plan.vertices.length) {
        // Default: center the origin and use a comfortable ppm
        view.ppm = 60;
        view.offX = rect.width / 2;
        view.offY = rect.height / 2;
        render(); return;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      plan.vertices.forEach((v) => {
        minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
      });
      const w = Math.max(2, maxX - minX), h = Math.max(2, maxY - minY);
      const pad = 80;
      const ppmX = (rect.width - pad * 2) / w;
      const ppmY = (rect.height - pad * 2) / h;
      view.ppm = Math.max(20, Math.min(200, Math.min(ppmX, ppmY)));
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      view.offX = rect.width / 2 - cx * view.ppm;
      view.offY = rect.height / 2 - cy * view.ppm;
      render();
    }
    function planToScreen(p) {
      return { x: p.x * view.ppm + view.offX, y: p.y * view.ppm + view.offY };
    }
    function screenToPlan(s) {
      return { x: (s.x - view.offX) / view.ppm, y: (s.y - view.offY) / view.ppm };
    }
    function eventPlan(e) {
      const r = canvas.getBoundingClientRect();
      return screenToPlan({ x: e.clientX - r.left, y: e.clientY - r.top });
    }

    // ── snapping helpers ───────────────────────────────
    function snapToGrid(p) {
      if (!plan.snap) return { x: p.x, y: p.y };
      return {
        x: Math.round(p.x / plan.snap) * plan.snap,
        y: Math.round(p.y / plan.snap) * plan.snap,
      };
    }
    function snapToVertex(p) {
      const rPx = 12;
      let best = null, bestD = (rPx / view.ppm) ** 2;
      for (let i = 0; i < plan.vertices.length; i++) {
        const v = plan.vertices[i];
        const d = (v.x - p.x) ** 2 + (v.y - p.y) ** 2;
        if (d < bestD) { bestD = d; best = { idx: i, x: v.x, y: v.y }; }
      }
      return best;
    }
    function snapToAngle(from, to) {
      if (plan.angleLock <= 0) return to;
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return to;
      const inc = (plan.angleLock * Math.PI) / 180;
      const ang = Math.atan2(dy, dx);
      const snapped = Math.round(ang / inc) * inc;
      return { x: from.x + Math.cos(snapped) * len, y: from.y + Math.sin(snapped) * len };
    }
    function getPenTarget(rawPlanPt, e) {
      // Try snap-to-vertex first; that closes the polygon if it's the first vertex.
      const onV = snapToVertex(rawPlanPt);
      if (onV) return { x: onV.x, y: onV.y, vertexIdx: onV.idx };
      let p = rawPlanPt;
      if (plan.drawing != null) {
        const from = plan.vertices[plan.drawing.fromIdx];
        if (!e.shiftKey) p = snapToAngle(from, p);
      }
      p = snapToGrid(p);
      return { x: p.x, y: p.y, vertexIdx: -1 };
    }
    function findSegmentNear(p, maxPx = 8) {
      const maxD = maxPx / view.ppm;
      let best = null, bestD = maxD * maxD;
      for (let i = 0; i < plan.segments.length; i++) {
        const s = plan.segments[i];
        const a = plan.vertices[s.a], b = plan.vertices[s.b];
        const proj = projectOnSegment(p, a, b);
        if (proj.t < 0 || proj.t > 1) continue;
        const d2 = (proj.x - p.x) ** 2 + (proj.y - p.y) ** 2;
        if (d2 < bestD) { bestD = d2; best = { idx: i, t: proj.t, x: proj.x, y: proj.y }; }
      }
      return best;
    }
    function projectOnSegment(p, a, b) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return { x: a.x, y: a.y, t: 0 };
      const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
      return { x: a.x + dx * t, y: a.y + dy * t, t };
    }

    // ── pointer handlers ───────────────────────────────
    let isPanning = false, panLast = null;
    function onDown(e) {
      canvas.setPointerCapture(e.pointerId);
      const rawP = eventPlan(e);
      // Right-button or middle = pan; also Alt+left = pan
      if (e.button === 1 || e.button === 2 || e.altKey) {
        isPanning = true; panLast = { x: e.clientX, y: e.clientY };
        return;
      }
      if (plan.tool === "room") {
        const p = snapToGrid(rawP);
        plan.roomDraw = { x0: p.x, y0: p.y };
        render(); setStatus();
        return;
      }
      if (plan.tool === "pen") {
        const target = getPenTarget(rawP, e);
        if (plan.drawing && target.vertexIdx === plan.drawing.fromIdx && plan.vertices.length > 2) {
          // Clicked the start point but we just started — skip
        }
        if (plan.drawing) {
          // Continuing a polyline
          const fromIdx = plan.drawing.fromIdx;
          let toIdx = target.vertexIdx;
          if (toIdx < 0) {
            plan.vertices.push({ x: target.x, y: target.y });
            toIdx = plan.vertices.length - 1;
          }
          if (toIdx !== fromIdx) {
            plan.segments.push({ a: fromIdx, b: toIdx, openings: [] });
            plan._autoBuild && plan._autoBuild();
          }
          // If closed loop, stop drawing
          if (target.vertexIdx >= 0 && wouldCloseLoop(target.vertexIdx)) {
            plan.drawing = null;
          } else {
            plan.drawing.fromIdx = toIdx;
          }
        } else {
          // Start fresh
          let startIdx = target.vertexIdx;
          if (startIdx < 0) {
            plan.vertices.push({ x: target.x, y: target.y });
            startIdx = plan.vertices.length - 1;
          }
          plan.drawing = { fromIdx: startIdx };
        }
        render(); setStatus();
        return;
      }
      if (plan.tool === "select") {
        const v = snapToVertex(rawP);
        if (v) {
          plan.dragV = { idx: v.idx };
          plan.sel = { kind: "v", idx: v.idx };
          render(); return;
        }
        const seg = findSegmentNear(rawP);
        if (seg) {
          plan.sel = { kind: "s", idx: seg.idx };
          render(); return;
        }
        // Empty area: pan
        plan.sel = null;
        isPanning = true; panLast = { x: e.clientX, y: e.clientY };
        render();
        return;
      }
      if (plan.tool === "door" || plan.tool === "window") {
        const seg = findSegmentNear(rawP, 12);
        if (seg) {
          const s = plan.segments[seg.idx];
          const op = plan.tool === "door"
            ? { type: "door", t: seg.t, width: plan.defaultDoor.width, height: plan.defaultDoor.height }
            : { type: "window", t: seg.t, width: plan.defaultWindow.width, height: plan.defaultWindow.height, sill: plan.defaultWindow.sill };
          s.openings = s.openings || [];
          s.openings.push(op);
          plan.sel = { kind: "op", segIdx: seg.idx, opIdx: s.openings.length - 1 };
          plan._autoBuild && plan._autoBuild();
          render(); setStatus();
        }
        return;
      }
      if (plan.tool === "arc") {
        if (!plan.arcDraw) {
          const p = snapToGrid(rawP);
          plan.arcDraw = { step: 1, cx: p.x, cy: p.y, radius: 1, start: 0, end: Math.PI };
        } else if (plan.arcDraw.step === 1) {
          const dx = rawP.x - plan.arcDraw.cx, dy = rawP.y - plan.arcDraw.cy;
          plan.arcDraw.radius = Math.max(0.2, Math.hypot(dx, dy));
          plan.arcDraw.start = Math.atan2(dy, dx);
          plan.arcDraw.step = 2;
        } else {
          // commit
          const a = plan.arcDraw;
          plan.arcs.push({
            cx: a.cx, cy: a.cy, radius: a.radius,
            start: a.start, end: a.end, segments: 24,
          });
          plan.arcDraw = null;
          plan._autoBuild && plan._autoBuild();
        }
        render(); setStatus();
        return;
      }
      if (plan.tool === "erase") {
        const v = snapToVertex(rawP);
        if (v) { deleteVertex(v.idx); plan._autoBuild && plan._autoBuild(); render(); setStatus(); return; }
        const seg = findSegmentNear(rawP);
        if (seg) { deleteSegment(seg.idx); plan._autoBuild && plan._autoBuild(); render(); setStatus(); return; }
      }
    }
    function onMove(e) {
      if (isPanning && panLast) {
        view.offX += e.clientX - panLast.x;
        view.offY += e.clientY - panLast.y;
        panLast = { x: e.clientX, y: e.clientY };
        render(); return;
      }
      const rawP = eventPlan(e);
      plan.hoverPos = snapToGrid(rawP);
      plan.hoverV = null; plan.hoverS = null;
      if (plan.tool === "select" || plan.tool === "erase") {
        const v = snapToVertex(rawP); if (v) plan.hoverV = v.idx;
        const s = !v ? findSegmentNear(rawP) : null;
        if (s) plan.hoverS = s.idx;
      } else if (plan.tool === "door" || plan.tool === "window") {
        const s = findSegmentNear(rawP, 14); if (s) plan.hoverS = s.idx;
      }
      // Dragging a vertex
      if (plan.dragV) {
        let p = snapToGrid(rawP);
        plan.vertices[plan.dragV.idx].x = p.x;
        plan.vertices[plan.dragV.idx].y = p.y;
        render(); return;
      }
      // Mid-pen ghost
      if (plan.tool === "pen" && plan.drawing) {
        const target = getPenTarget(rawP, e);
        plan.hoverPos = { x: target.x, y: target.y };
      }
      // Arc preview
      if (plan.tool === "arc" && plan.arcDraw && plan.arcDraw.step === 2) {
        const dx = rawP.x - plan.arcDraw.cx, dy = rawP.y - plan.arcDraw.cy;
        let end = Math.atan2(dy, dx);
        plan.arcDraw.end = end;
      }
      // Room rectangle preview
      if (plan.tool === "room" && plan.roomDraw) {
        plan.hoverPos = snapToGrid(rawP);
      }
      render(); setStatus();
    }
    function onUp(e) {
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      isPanning = false; panLast = null;
      if (plan.dragV) { plan.dragV = null; plan._autoBuild && plan._autoBuild(); }
      // Complete room rectangle
      if (plan.tool === "room" && plan.roomDraw) {
        const rawP = eventPlan(e);
        const end = snapToGrid(rawP);
        const rd = plan.roomDraw;
        plan.roomDraw = null;
        const x0 = Math.min(rd.x0, end.x), y0 = Math.min(rd.y0, end.y);
        const x1 = Math.max(rd.x0, end.x), y1 = Math.max(rd.y0, end.y);
        // Minimum size check
        if (x1 - x0 < 0.5 || y1 - y0 < 0.5) { render(); return; }
        // Create 4 vertices and 4 segments forming a closed rectangle
        const base = plan.vertices.length;
        plan.vertices.push({ x: x0, y: y0 });
        plan.vertices.push({ x: x1, y: y0 });
        plan.vertices.push({ x: x1, y: y1 });
        plan.vertices.push({ x: x0, y: y1 });
        plan.segments.push({ a: base + 0, b: base + 1, openings: [] });
        plan.segments.push({ a: base + 1, b: base + 2, openings: [] });
        plan.segments.push({ a: base + 2, b: base + 3, openings: [] });
        plan.segments.push({ a: base + 3, b: base + 0, openings: [] });
        plan._autoBuild && plan._autoBuild();
        render(); setStatus();
      }
    }
    function onDouble(e) {
      if (plan.tool === "pen") finishPen();
      else if (plan.tool === "select") {
        // Double-click a segment to edit (not implemented yet; could open inspector)
      }
    }
    function onWheel(e) {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const before = screenToPlan({ x: sx, y: sy });
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      view.ppm = Math.max(8, Math.min(400, view.ppm * factor));
      const after = screenToPlan({ x: sx, y: sy });
      view.offX += (after.x - before.x) * view.ppm;
      view.offY += (after.y - before.y) * view.ppm;
      render();
    }
    function onKey(e) {
      // Only when plan mode visible
      if (_D.currentMode !== "plan") return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (k === "p") setTool("pen");
      else if (k === "r") setTool("room");
      else if (k === "s") setTool("select");
      else if (k === "d") setTool("door");
      else if (k === "w") setTool("window");
      else if (k === "c") setTool("arc");
      else if (k === "x") setTool("erase");
      else if (k === "f") fitView();
      else if (e.key === "Enter") finishPen();
      else if (e.key === "Escape") { plan.drawing = null; plan.arcDraw = null; plan.roomDraw = null; plan.sel = null; render(); setStatus(); }
      else if (e.key === "Delete" || e.key === "Backspace") {
        if (plan.sel) {
          if (plan.sel.kind === "v") deleteVertex(plan.sel.idx);
          else if (plan.sel.kind === "s") deleteSegment(plan.sel.idx);
          else if (plan.sel.kind === "op") {
            const s = plan.segments[plan.sel.segIdx];
            if (s && s.openings) s.openings.splice(plan.sel.opIdx, 1);
          }
          plan.sel = null;
          plan._autoBuild && plan._autoBuild();
          render(); setStatus();
        }
      }
    }
    function finishPen() {
      plan.drawing = null;
      render(); setStatus();
    }
    function wouldCloseLoop(vIdx) {
      // True if this vertex is already shared by ≥2 segments forming a closed loop
      const adj = plan.segments.filter((s) => s.a === vIdx || s.b === vIdx);
      return adj.length >= 2;
    }

    function deleteVertex(idx) {
      // Remove vertex + any segments using it; reindex others.
      plan.segments = plan.segments.filter((s) => s.a !== idx && s.b !== idx);
      plan.vertices.splice(idx, 1);
      plan.segments.forEach((s) => {
        if (s.a > idx) s.a--;
        if (s.b > idx) s.b--;
      });
    }
    function deleteSegment(idx) { plan.segments.splice(idx, 1); }

    function setTool(name) {
      plan.tool = name;
      plan.drawing = null; plan.arcDraw = null;
      [...toolbar.querySelectorAll(".ptool")].forEach((b) => {
        b.classList.toggle("on", b.dataset.tool === name);
      });
      canvas.className = "tool-" + name;
      setStatus(); render();
    }

    function clearPlan() {
      plan.vertices = []; plan.segments = []; plan.arcs = [];
      plan.drawing = null; plan.arcDraw = null; plan.sel = null;
      render(); setStatus();
    }

    // ── rendering ──────────────────────────────────────
    function render() {
      const W = canvas.width, H = canvas.height;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      drawGrid();
      drawGhostFloor();
      drawArcs();
      drawSegments();
      drawOpenings();
      drawVertices();
      drawPenGhost();
      drawArcGhost();
      drawRoomGhost();
      drawHud();
      ctx.restore();
    }

    // Draw lower floor(s) as a faint ghost so you can see the layout below
    function drawGhostFloor() {
      if (!window._sims) return;
      const sims = window._sims;
      const activeF = sims.floors.find((f) => f.id === sims.activeFloor);
      if (!activeF) return;
      // Find floors below the active one
      const belowFloors = sims.floors.filter((f) => f.id !== sims.activeFloor && f.yBase < activeF.yBase && f.plan);
      if (!belowFloors.length) return;
      // Also show same-level floors that aren't active (ground floor ghost when on floor 2, etc)
      // Draw each below floor at decreasing opacity
      belowFloors.forEach((f, idx) => {
        const alpha = Math.max(0.08, 0.25 - idx * 0.08);
        drawPlanGhost(f.plan, alpha);
      });
    }
    function drawPlanGhost(planData, alpha) {
      if (!planData || !planData.vertices.length) return;
      const ghostCol = `rgba(140, 120, 100, ${alpha})`;
      const ghostFill = `rgba(140, 120, 100, ${alpha * 0.3})`;
      const thicknessPx = Math.max(2, (plan.thickness || 0.18) * view.ppm);

      // Draw segments
      ctx.lineCap = "butt";
      ctx.strokeStyle = ghostCol;
      ctx.lineWidth = thicknessPx;
      planData.segments.forEach((s) => {
        const a = planData.vertices[s.a], b = planData.vertices[s.b];
        if (!a || !b) return;
        const sa = planToScreen(a), sb = planToScreen(b);
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y);
        ctx.stroke();

        // Draw openings as gaps
        if (s.openings) {
          const segLen = Math.hypot(b.x - a.x, b.y - a.y);
          const ux = (b.x - a.x) / segLen, uy = (b.y - a.y) / segLen;
          s.openings.forEach((op) => {
            const halfW = op.width / 2;
            const cx = a.x + ux * (op.t * segLen), cy = a.y + uy * (op.t * segLen);
            const p0 = planToScreen({ x: cx - ux * halfW, y: cy - uy * halfW });
            const p1 = planToScreen({ x: cx + ux * halfW, y: cy + uy * halfW });
            ctx.save();
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0,0,0,1)";
            ctx.lineWidth = thicknessPx + 2;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
            ctx.stroke();
            ctx.restore();
            // Redraw opening marker faintly
            if (op.type === "door") {
              ctx.strokeStyle = ghostCol;
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
              ctx.stroke();
              ctx.setLineDash([]);
            } else {
              ctx.strokeStyle = ghostCol;
              ctx.lineWidth = 1;
              ctx.setLineDash([2, 2]);
              ctx.beginPath();
              ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
              ctx.stroke();
              ctx.setLineDash([]);
            }
          });
        }
      });

      // Draw vertices as small dots
      ctx.fillStyle = ghostFill;
      planData.vertices.forEach((v) => {
        const s = planToScreen(v);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    function drawGrid() {
      const rect = { w: canvas.width / dpr, h: canvas.height / dpr };
      const major = 1;       // 1m
      const minor = plan.snap || 0.25;
      const styles = getComputedStyle(document.documentElement);
      const minorCol = styles.getPropertyValue("--border").trim() || "#3a3735";
      const majorCol = styles.getPropertyValue("--text2").trim() || "#9a9488";

      // Minor grid (snap)
      if (minor > 0 && view.ppm * minor > 6) {
        ctx.strokeStyle = withAlpha(minorCol, 0.25);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const x0 = screenToPlan({ x: 0, y: 0 });
        const x1 = screenToPlan({ x: rect.w, y: rect.h });
        for (let gx = Math.floor(x0.x / minor) * minor; gx <= x1.x; gx += minor) {
          const sx = gx * view.ppm + view.offX;
          ctx.moveTo(sx, 0); ctx.lineTo(sx, rect.h);
        }
        for (let gy = Math.floor(x0.y / minor) * minor; gy <= x1.y; gy += minor) {
          const sy = gy * view.ppm + view.offY;
          ctx.moveTo(0, sy); ctx.lineTo(rect.w, sy);
        }
        ctx.stroke();
      }
      // Major grid (1m)
      ctx.strokeStyle = withAlpha(majorCol, 0.32);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const x0 = screenToPlan({ x: 0, y: 0 });
      const x1 = screenToPlan({ x: rect.w, y: rect.h });
      for (let gx = Math.ceil(x0.x / major) * major; gx <= x1.x; gx += major) {
        const sx = gx * view.ppm + view.offX;
        ctx.moveTo(sx, 0); ctx.lineTo(sx, rect.h);
      }
      for (let gy = Math.ceil(x0.y / major) * major; gy <= x1.y; gy += major) {
        const sy = gy * view.ppm + view.offY;
        ctx.moveTo(0, sy); ctx.lineTo(rect.w, sy);
      }
      ctx.stroke();
      // Axes
      ctx.strokeStyle = withAlpha(majorCol, 0.65);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(view.offX, 0); ctx.lineTo(view.offX, rect.h);
      ctx.moveTo(0, view.offY); ctx.lineTo(rect.w, view.offY);
      ctx.stroke();
    }
    function withAlpha(hex, a) {
      hex = (hex || "#888").trim();
      if (hex.startsWith("rgb")) return hex;
      const m = /^#([0-9a-f]{6})$/i.exec(hex);
      if (!m) return `rgba(150,150,150,${a})`;
      const n = parseInt(m[1], 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    }

    function drawSegments() {
      const acc = getCSSVar("--accent", "#d4a373");
      const text = getCSSVar("--text", "#d8d0c4");
      const thicknessPx = Math.max(2, plan.thickness * view.ppm);
      ctx.lineCap = "butt";
      plan.segments.forEach((s, i) => {
        const a = plan.vertices[s.a], b = plan.vertices[s.b];
        if (!a || !b) return;
        const sa = planToScreen(a), sb = planToScreen(b);
        const isSel = plan.sel && plan.sel.kind === "s" && plan.sel.idx === i;
        const isHover = plan.hoverS === i;
        ctx.strokeStyle = isSel ? acc : isHover ? withAlpha(acc, 0.7) : text;
        ctx.lineWidth = thicknessPx;
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y);
        ctx.stroke();
        // length label
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const mx = (sa.x + sb.x) / 2, my = (sa.y + sb.y) / 2;
        const ang = Math.atan2(sb.y - sa.y, sb.x - sa.x);
        ctx.save();
        ctx.translate(mx, my); ctx.rotate(ang);
        ctx.fillStyle = withAlpha(text, 0.75);
        ctx.font = "10px ui-monospace, monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(len.toFixed(2) + " m", 0, -thicknessPx / 2 - 4);
        ctx.restore();
      });
    }

    function drawOpenings() {
      const acc = getCSSVar("--accent", "#d4a373");
      const accBg = getCSSVar("--viewport-bg", "#0e0d0c");
      const thicknessPx = Math.max(2, plan.thickness * view.ppm);
      plan.segments.forEach((s, si) => {
        if (!s.openings) return;
        const a = plan.vertices[s.a], b = plan.vertices[s.b];
        if (!a || !b) return;
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        if (segLen < 1e-6) return;
        const ux = (b.x - a.x) / segLen, uy = (b.y - a.y) / segLen;
        const nx = -uy, ny = ux;
        s.openings.forEach((op, oi) => {
          const halfW = op.width / 2;
          const cx = a.x + ux * (op.t * segLen);
          const cy = a.y + uy * (op.t * segLen);
          const sx0 = cx - ux * halfW, sy0 = cy - uy * halfW;
          const sx1 = cx + ux * halfW, sy1 = cy + uy * halfW;
          const ssA = planToScreen({ x: sx0, y: sy0 });
          const ssB = planToScreen({ x: sx1, y: sy1 });
          // Erase wall under opening
          ctx.strokeStyle = accBg;
          ctx.lineWidth = thicknessPx + 1;
          ctx.beginPath();
          ctx.moveTo(ssA.x, ssA.y); ctx.lineTo(ssB.x, ssB.y);
          ctx.stroke();
          // Door = two short ticks (jamb markers); Window = double parallel line
          ctx.strokeStyle = acc;
          ctx.lineWidth = 1.5;
          if (op.type === "door") {
            // Door swing arc (90°, on inner side)
            const ssC = planToScreen({ x: sx0, y: sy0 });
            const swingR = op.width * view.ppm;
            const angleAlong = Math.atan2(uy, ux);
            ctx.beginPath();
            ctx.moveTo(ssA.x, ssA.y);
            ctx.lineTo(ssA.x + Math.cos(angleAlong + Math.PI / 2) * 4 * (op.width * view.ppm) / op.width,
                      ssA.y + Math.sin(angleAlong + Math.PI / 2) * 4 * (op.width * view.ppm) / op.width);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(ssA.x, ssA.y, swingR, angleAlong, angleAlong + Math.PI / 2, false);
            ctx.stroke();
            // jamb ticks
            ctx.beginPath();
            ctx.moveTo(ssA.x, ssA.y); ctx.lineTo(ssA.x + nx * thicknessPx, ssA.y + ny * thicknessPx);
            ctx.moveTo(ssB.x, ssB.y); ctx.lineTo(ssB.x + nx * thicknessPx, ssB.y + ny * thicknessPx);
            ctx.stroke();
          } else {
            // Window: 3 parallel lines inside the gap
            const tHalfPx = thicknessPx / 2;
            for (let k = -1; k <= 1; k++) {
              const off = k * (tHalfPx * 0.5);
              ctx.beginPath();
              ctx.moveTo(ssA.x + nx * off, ssA.y + ny * off);
              ctx.lineTo(ssB.x + nx * off, ssB.y + ny * off);
              ctx.stroke();
            }
          }
        });
      });
    }

    function drawVertices() {
      const acc = getCSSVar("--accent", "#d4a373");
      const text = getCSSVar("--text", "#d8d0c4");
      plan.vertices.forEach((v, i) => {
        const s = planToScreen(v);
        const isSel = plan.sel && plan.sel.kind === "v" && plan.sel.idx === i;
        const isHover = plan.hoverV === i;
        const r = isSel || isHover ? 6 : 4;
        ctx.fillStyle = isSel ? acc : isHover ? withAlpha(acc, 0.7) : text;
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.stroke();
      });
    }

    function drawPenGhost() {
      if (plan.tool !== "pen" || !plan.drawing || !plan.hoverPos) return;
      const from = plan.vertices[plan.drawing.fromIdx];
      if (!from) return;
      const sa = planToScreen(from), sb = planToScreen(plan.hoverPos);
      const acc = getCSSVar("--accent", "#d4a373");
      ctx.save();
      ctx.strokeStyle = withAlpha(acc, 0.75);
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = Math.max(2, plan.thickness * view.ppm);
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(sa.x, sa.y); ctx.lineTo(sb.x, sb.y); ctx.stroke();
      ctx.restore();
      // length label near cursor
      const len = Math.hypot(plan.hoverPos.x - from.x, plan.hoverPos.y - from.y);
      ctx.fillStyle = acc;
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "left"; ctx.textBaseline = "bottom";
      ctx.fillText(len.toFixed(2) + " m", sb.x + 8, sb.y - 8);
    }

    function drawArcs() {
      const text = getCSSVar("--text", "#d8d0c4");
      const acc = getCSSVar("--accent", "#d4a373");
      const thicknessPx = Math.max(2, plan.thickness * view.ppm);
      plan.arcs.forEach((arc) => {
        const c = planToScreen({ x: arc.cx, y: arc.cy });
        ctx.strokeStyle = text;
        ctx.lineWidth = thicknessPx;
        ctx.beginPath();
        ctx.arc(c.x, c.y, arc.radius * view.ppm, arc.start, arc.end, arc.end < arc.start);
        ctx.stroke();
      });
    }

    function drawArcGhost() {
      if (plan.tool !== "arc" || !plan.arcDraw) return;
      const a = plan.arcDraw;
      const c = planToScreen({ x: a.cx, y: a.cy });
      const acc = getCSSVar("--accent", "#d4a373");
      ctx.save();
      ctx.strokeStyle = withAlpha(acc, 0.8);
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 1;
      if (a.step === 1 && plan.hoverPos) {
        const r = Math.hypot(plan.hoverPos.x - a.cx, plan.hoverPos.y - a.cy);
        ctx.beginPath();
        ctx.arc(c.x, c.y, r * view.ppm, 0, Math.PI * 2);
        ctx.stroke();
      } else if (a.step === 2) {
        ctx.lineWidth = Math.max(2, plan.thickness * view.ppm);
        ctx.beginPath();
        ctx.arc(c.x, c.y, a.radius * view.ppm, a.start, a.end, a.end < a.start);
        ctx.stroke();
      }
      // center cross
      ctx.setLineDash([]); ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(c.x - 5, c.y); ctx.lineTo(c.x + 5, c.y);
      ctx.moveTo(c.x, c.y - 5); ctx.lineTo(c.x, c.y + 5);
      ctx.stroke();
      ctx.restore();
    }

    function drawHud() {/* reserved for future overlays */}

    function drawRoomGhost() {
      if (plan.tool !== "room" || !plan.roomDraw || !plan.hoverPos) return;
      const rd = plan.roomDraw;
      const p0 = planToScreen({ x: rd.x0, y: rd.y0 });
      const p1 = planToScreen(plan.hoverPos);
      const acc = getCSSVar("--accent", "#d4a373");
      ctx.save();
      ctx.strokeStyle = acc;
      ctx.lineWidth = Math.max(2, plan.thickness * view.ppm);
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(
        Math.min(p0.x, p1.x), Math.min(p0.y, p1.y),
        Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)
      );
      ctx.setLineDash([]);
      // Dimensions label
      const w = Math.abs(plan.hoverPos.x - rd.x0);
      const h = Math.abs(plan.hoverPos.y - rd.y0);
      ctx.fillStyle = acc;
      ctx.font = "11px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        w.toFixed(1) + " × " + h.toFixed(1) + " m",
        (p0.x + p1.x) / 2, Math.min(p0.y, p1.y) - 8
      );
      // Area
      const area = w * h;
      if (area > 0.5) {
        ctx.font = "10px ui-monospace, monospace";
        ctx.fillStyle = withAlpha(acc, 0.7);
        ctx.fillText(area.toFixed(1) + " m²", (p0.x + p1.x) / 2, (p0.y + p1.y) / 2 + 4);
      }
      ctx.restore();
    }
    function getCSSVar(name, fallback) {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    }

    // ── BUILD: materialize plan into 3D shell ──────────
    function buildToShell() {
      const shell = _D.shell;
      // Clear shell except the floor / walls we manage. Easier: clear everything.
      while (shell.children.length) {
        const c = shell.children[0];
        shell.remove(c);
        _D.disposeObj(c);
      }
      const M = _D.OBJ.M;
      const fc = parseInt($("rFloorCol").value.slice(1), 16);
      const wc = parseInt($("rWallCol").value.slice(1), 16);
      const wallMat = new THREE.MeshStandardMaterial({color: wc, roughness: 0.92, metalness: 0, side: THREE.DoubleSide});
      const floorMat = new THREE.MeshStandardMaterial({color: fc, roughness: 0.85, metalness: 0, side: THREE.DoubleSide});

      // Floor: build a Shape from each *closed* polygon found in the segments.
      // Polygon is offset OUTWARD by half the wall thickness so the floor's
      // edge reaches the outer face of each wall (no visible gap or overhang).
      const loops = findClosedLoops();
      loops.forEach((loop) => {
        const baseVerts = loop.map((idx) => plan.vertices[idx]);
        const outerVerts = offsetPolygonOutward(baseVerts, plan.thickness / 2);
        const shape = new THREE.Shape();
        outerVerts.forEach((v, i) => {
          // Negate Y so that after rotation.x = -π/2 the floor normal faces UP
          if (i === 0) shape.moveTo(v.x, -v.y); else shape.lineTo(v.x, -v.y);
        });
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        const floor = new THREE.Mesh(geo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.name = "plan_floor";
        shell.add(floor);
      });
      // If no closed loop, lay a generous floor under the bounding box of segs.
      if (loops.length === 0 && plan.vertices.length) {
        const bb = bbox();
        const w = Math.max(2, bb.maxX - bb.minX + 4);
        const d = Math.max(2, bb.maxY - bb.minY + 4);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set((bb.minX + bb.maxX) / 2, 0, (bb.minY + bb.maxY) / 2);
        floor.name = "plan_floor_fallback";
        shell.add(floor);
      }

      // Walls: each segment → 1+ boxes around its openings.
      plan.segments.forEach((s) => {
        const a = plan.vertices[s.a], b = plan.vertices[s.b];
        if (!a || !b) return;
        buildSegmentMeshes(s, a, b, wallMat).forEach((m) => shell.add(m));
      });

      // Arcs: a thin curved wall — N small boxes around the arc.
      plan.arcs.forEach((arc) => {
        const segs = arc.segments || 24;
        const start = arc.start, end = arc.end;
        const sweep = endMinusStart(start, end);
        const H = arc.height || plan.defaultHeight;
        for (let i = 0; i < segs; i++) {
          const t0 = i / segs, t1 = (i + 1) / segs;
          const a0 = start + sweep * t0, a1 = start + sweep * t1;
          const p0 = { x: arc.cx + Math.cos(a0) * arc.radius, y: arc.cy + Math.sin(a0) * arc.radius };
          const p1 = { x: arc.cx + Math.cos(a1) * arc.radius, y: arc.cy + Math.sin(a1) * arc.radius };
          const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) * 1.01; // tiny overlap
          const box = new THREE.Mesh(
            new THREE.BoxGeometry(len, H, plan.thickness), wallMat
          );
          const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2;
          box.position.set(mx, H / 2, my);
          const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          box.rotation.y = -ang;
          shell.add(box);
        }
      });
    }
    // Offset a closed polygon outward by `distance`. Used to push the floor
    // outline to the outer face of the walls (which are centered on the
    // polyline). Robust for arbitrary convex/concave polygons; sharp inner
    // corners get clamped to avoid runaway miter spikes.
    function offsetPolygonOutward(verts, distance) {
      if (verts.length < 3 || distance === 0) return verts;
      // Signed area; positive area on a Y-down screen = visually CW = interior
      // on the right of each edge, so outward = edge direction rotated 90° CW.
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
        const prev = v[(i - 1 + n) % n];
        const cur = v[i];
        const next = v[(i + 1) % n];
        const e1x = cur.x - prev.x, e1y = cur.y - prev.y;
        const e2x = next.x - cur.x, e2y = next.y - cur.y;
        const l1 = Math.hypot(e1x, e1y) || 1;
        const l2 = Math.hypot(e2x, e2y) || 1;
        // Outward normals (rotate edge dir 90° CW for CW screen polygons).
        const n1x = e1y / l1, n1y = -e1x / l1;
        const n2x = e2y / l2, n2y = -e2x / l2;
        let mx = n1x + n2x, my = n1y + n2y;
        const ml = Math.hypot(mx, my);
        if (ml < 1e-6) { mx = n1x; my = n1y; }
        else { mx /= ml; my /= ml; }
        // Miter distance = distance / cos(half-angle) = distance / dot(n1, m).
        // Clamp to avoid spikes on near-180° reflex corners.
        const dot = n1x * mx + n1y * my;
        const miterLen = distance / Math.max(0.25, dot);
        out[i] = { x: cur.x + mx * miterLen, y: cur.y + my * miterLen };
      }
      if (reversed) out.reverse();
      return out;
    }

    function endMinusStart(start, end) {
      // Always sweep CCW (positive direction).
      let s = end - start;
      while (s < 0) s += Math.PI * 2;
      while (s > Math.PI * 2) s -= Math.PI * 2;
      return s;
    }

    function bbox() {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      plan.vertices.forEach((v) => {
        minX = Math.min(minX, v.x); minY = Math.min(minY, v.y);
        maxX = Math.max(maxX, v.x); maxY = Math.max(maxY, v.y);
      });
      return { minX, minY, maxX, maxY };
    }

    function buildSegmentMeshes(seg, vA, vB, wallMat) {
      const segLen = Math.hypot(vB.x - vA.x, vB.y - vA.y);
      if (segLen < 1e-4) return [];
      const angle = Math.atan2(vB.y - vA.y, vB.x - vA.x);
      const H = seg.height || plan.defaultHeight;
      const thick = plan.thickness;
      const meshes = [];

      const openings = (seg.openings || [])
        .slice()
        .sort((a, b) => a.t - b.t);

      // Build a list of solid pieces as (t0, t1, y0, y1) along the segment.
      const pieces = [];
      let cursor = 0;
      openings.forEach((op) => {
        const halfTW = (op.width / segLen) / 2;
        const opStart = Math.max(0, op.t - halfTW);
        const opEnd = Math.min(1, op.t + halfTW);
        if (opStart > cursor + 1e-4) {
          pieces.push({ t0: cursor, t1: opStart, y0: 0, y1: H });
        }
        if (op.type === "door") {
          if (op.height < H) pieces.push({ t0: opStart, t1: opEnd, y0: op.height, y1: H });
        } else if (op.type === "window") {
          const sill = op.sill ?? 1;
          const winH = op.height || 1.2;
          if (sill > 0)          pieces.push({ t0: opStart, t1: opEnd, y0: 0, y1: sill });
          if (sill + winH < H)   pieces.push({ t0: opStart, t1: opEnd, y0: sill + winH, y1: H });
        }
        cursor = opEnd;
      });
      if (cursor < 1 - 1e-4) {
        pieces.push({ t0: cursor, t1: 1, y0: 0, y1: H });
      }

      pieces.forEach((p) => {
        const pieceLen = (p.t1 - p.t0) * segLen;
        const pieceH = p.y1 - p.y0;
        if (pieceLen < 1e-3 || pieceH < 1e-3) return;
        const tMid = (p.t0 + p.t1) / 2;
        const mx = vA.x + (vB.x - vA.x) * tMid;
        const my = vA.y + (vB.y - vA.y) * tMid;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(pieceLen, pieceH, thick), wallMat
        );
        box.position.set(mx, p.y0 + pieceH / 2, my);
        box.rotation.y = -angle;
        meshes.push(box);
      });
      return meshes;
    }

    // Detect closed loops in the segment graph (greedy — returns the first
    // polygon found per connected start-vertex). Good enough for now.
    function findClosedLoops() {
      const adj = new Map(); // vIdx → [{to, segIdx}]
      plan.vertices.forEach((_, i) => adj.set(i, []));
      plan.segments.forEach((s, i) => {
        adj.get(s.a).push({ to: s.b, segIdx: i });
        adj.get(s.b).push({ to: s.a, segIdx: i });
      });
      const visitedSeg = new Set();
      const loops = [];
      // For each vertex with degree exactly 2, trace a loop.
      for (let start = 0; start < plan.vertices.length; start++) {
        if ((adj.get(start) || []).length < 2) continue;
        // Try tracing
        const result = traceLoop(start, adj, visitedSeg);
        if (result && result.length >= 3) loops.push(result);
      }
      return loops;
    }
    function traceLoop(start, adj, visitedSeg) {
      // Pick first unvisited edge, then keep turning consistently (e.g.
      // rightmost) until we get back to start. If we hit a dead end, abort.
      const startEdges = adj.get(start).filter((e) => !visitedSeg.has(e.segIdx));
      if (!startEdges.length) return null;
      const initial = startEdges[0];
      visitedSeg.add(initial.segIdx);
      const loop = [start, initial.to];
      let prev = start, cur = initial.to;
      const MAX = plan.vertices.length * 2;
      for (let i = 0; i < MAX; i++) {
        if (cur === start) return loop.slice(0, -1);
        // pick next edge that isn't the one we came from
        const choices = adj.get(cur).filter((e) => e.to !== prev && !visitedSeg.has(e.segIdx));
        if (!choices.length) {
          // Allow re-using a segment if it leads back to start (closed shape with shared start/end edge)
          const back = adj.get(cur).find((e) => e.to === start);
          if (back) return loop;
          return null;
        }
        // Turn the smallest left/CCW angle relative to incoming direction
        const inDx = plan.vertices[cur].x - plan.vertices[prev].x;
        const inDy = plan.vertices[cur].y - plan.vertices[prev].y;
        const inAng = Math.atan2(inDy, inDx);
        let bestE = null, bestTurn = -Infinity;
        choices.forEach((e) => {
          const dx = plan.vertices[e.to].x - plan.vertices[cur].x;
          const dy = plan.vertices[e.to].y - plan.vertices[cur].y;
          const ang = Math.atan2(dy, dx);
          let turn = ang - inAng; // CCW positive
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
  } // /init
})();
