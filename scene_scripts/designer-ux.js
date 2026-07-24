// designer-ux.js — Sims-like UX polish and quality of life.
//
// Features:
//   • Room templates (quick-start common shapes)
//   • Dollhouse / isometric camera views (Sims-style angles)
//   • Copy / Paste (Ctrl+C / Ctrl+V) with clipboard
//   • Objects auto-snap to floor when placed
//   • Viewport HUD: object count, selected info, floor indicator
//   • Selection outline glow
//   • Double-click object in palette to place at room center
//   • Arrow keys nudge selected object
//   • Mousewheel on selected object = rotate (with Alt held)
//   • Right-click context menu on objects
//   • Room size presets (bedroom, living room, bathroom, etc.)

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;
    const $ = _D.$;

    injectStyles();
    addRoomPresets();
    addDollhouseView();
    setupCopyPaste();
    setupAutoFloorSnap();
    addViewportHud();
    setupSelectionOutline();
    setupArrowNudge();
    setupAltScrollRotate();
    setupContextMenu();
    setupBracketScale();
    setupWallSnap();

    // ═══════════════════════════════════════════════════════
    //  STYLES
    // ═══════════════════════════════════════════════════════
    function injectStyles() {
      const s = document.createElement("style");
      s.textContent = `
        /* Room presets */
        #room-presets{display:flex;flex-wrap:wrap;gap:3px;margin-top:8px}
        #room-presets button{padding:4px 8px;font-size:10px;background:var(--surface2);border:1px solid var(--border);
          color:var(--text2);font:inherit;cursor:pointer;border-radius:3px;transition:all .12s}
        #room-presets button:hover{color:var(--accent);border-color:var(--accent)}

        /* Dollhouse button */
        #dollhouse-btn{position:absolute;top:10px;right:10px;z-index:7;padding:6px 12px;
          background:rgba(0,0,0,.6);backdrop-filter:blur(6px);border:1px solid var(--border);
          color:var(--text2);font:inherit;font-size:11px;cursor:pointer;border-radius:6px;transition:all .12s}
        #dollhouse-btn:hover{color:var(--accent);border-color:var(--accent)}
        #dollhouse-btn.on{color:var(--accent);border-color:var(--accent);background:rgba(212,163,115,.12)}

        /* Viewport HUD */
        #vp-hud{position:absolute;bottom:50px;left:10px;z-index:6;pointer-events:none;
          font-family:var(--mono);font-size:10px;color:var(--text2);line-height:1.5;
          background:rgba(0,0,0,.35);padding:5px 8px;border-radius:4px;backdrop-filter:blur(4px)}
        #vp-hud .hud-accent{color:var(--accent)}

        /* Selection outline */
        .sel-outline{position:absolute;inset:0;pointer-events:none;z-index:3}

        /* Context menu */
        #ctx-menu{position:absolute;z-index:20;display:none;background:var(--surface);
          border:1px solid var(--border);border-radius:6px;padding:4px 0;min-width:160px;
          box-shadow:0 8px 24px rgba(0,0,0,.4);backdrop-filter:blur(12px)}
        #ctx-menu.show{display:block}
        #ctx-menu .ctx-item{padding:6px 14px;font-size:11px;color:var(--text);cursor:pointer;
          display:flex;align-items:center;gap:8px;transition:background .08s}
        #ctx-menu .ctx-item:hover{background:var(--surface2);color:var(--accent)}
        #ctx-menu .ctx-item .ctx-key{margin-left:auto;font-size:9px;color:var(--text2);font-family:var(--mono)}
        #ctx-menu .ctx-sep{height:1px;background:var(--border);margin:3px 8px}

        /* Nudge indicator */
        #nudge-toast{position:absolute;bottom:50px;right:10px;z-index:7;
          background:rgba(0,0,0,.6);color:var(--text2);font-family:var(--mono);font-size:10px;
          padding:3px 8px;border-radius:4px;pointer-events:none;opacity:0;transition:opacity .15s}
        #nudge-toast.show{opacity:1}
      `;
      document.head.appendChild(s);
    }

    // ═══════════════════════════════════════════════════════
    //  ROOM SIZE PRESETS
    // ═══════════════════════════════════════════════════════
    function addRoomPresets() {
      const roomCfg = document.getElementById("room-cfg");
      if (!roomCfg) return;
      const wrap = document.createElement("div");
      wrap.id = "room-presets";
      const presets = [
        { name: "Bedroom",      w: 4,   d: 3.5, h: 2.8 },
        { name: "Living room",  w: 6,   d: 5,   h: 2.8 },
        { name: "Kitchen",      w: 4.5, d: 3,   h: 2.8 },
        { name: "Bathroom",     w: 2.5, d: 2.5, h: 2.8 },
        { name: "Studio",       w: 8,   d: 6,   h: 2.8 },
        { name: "Office",       w: 3.5, d: 3,   h: 2.8 },
        { name: "Garage",       w: 6,   d: 3,   h: 3.0 },
        { name: "Loft",         w: 10,  d: 8,   h: 4.0 },
      ];
      presets.forEach((p) => {
        const b = document.createElement("button");
        b.textContent = p.name;
        b.title = `${p.w}×${p.d}m, ${p.h}m ceiling`;
        b.onclick = () => {
          $("rW").value = p.w;
          $("rD").value = p.d;
          $("rH").value = p.h;
          window.D.rebuildShell();
          // Update sims floor height if available
          if (window._sims && window._sims.floors) {
            window._sims.floors[0].height = p.h;
            const fhi = document.getElementById("floor-h-input");
            if (fhi) fhi.value = p.h;
          }
        };
        wrap.appendChild(b);
      });
      // Insert after the wall preset row
      const psecBody = roomCfg.querySelector(".psec-body");
      if (psecBody) psecBody.appendChild(wrap);
    }

    // ═══════════════════════════════════════════════════════
    //  DOLLHOUSE / ISOMETRIC VIEW
    // ═══════════════════════════════════════════════════════
    function addDollhouseView() {
      const vp = document.getElementById("viewport-area");
      const btn = document.createElement("button");
      btn.id = "dollhouse-btn";
      btn.textContent = "🏠 Dollhouse";
      btn.title = "Toggle Sims-style isometric view";
      let isDollhouse = false;
      let savedCam = null;

      btn.onclick = () => {
        isDollhouse = !isDollhouse;
        btn.classList.toggle("on", isDollhouse);
        const cam = _D.camera, orb = _D.orbit;

        if (isDollhouse) {
          // Save current camera
          savedCam = { pos: cam.position.clone(), target: orb.target.clone() };
          // Sims-style isometric: 45° azimuth, ~55° elevation
          const W = parseFloat($("rW").value) || 14;
          const D = parseFloat($("rD").value) || 12;
          const dist = Math.max(W, D) * 1.2;
          const target = new THREE.Vector3(0, 0, 0);
          // Elevation: ~55° from horizontal for that Sims look
          const elev = 55 * Math.PI / 180;
          const azim = -45 * Math.PI / 180;
          const pos = new THREE.Vector3(
            target.x + Math.cos(elev) * Math.sin(azim) * dist,
            target.y + Math.sin(elev) * dist,
            target.z + Math.cos(elev) * Math.cos(azim) * dist
          );
          animateCamera(cam.position.clone(), pos, orb.target.clone(), target, 400);
          // Set auto-cutaway to make walls transparent
          if (window._sims) window._sims.autoCutaway = true;
          const cb = document.getElementById("auto-cutaway-cb");
          if (cb) cb.checked = true;
        } else {
          // Restore saved camera
          if (savedCam) {
            animateCamera(cam.position.clone(), savedCam.pos, orb.target.clone(), savedCam.target, 400);
          }
        }
      };
      vp.appendChild(btn);
    }

    function animateCamera(p0, p1, t0, t1, dur) {
      const cam = _D.camera, orb = _D.orbit;
      const start = performance.now();
      dur = dur || 350;
      function step(now) {
        const k = Math.min(1, (now - start) / dur);
        const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        cam.position.lerpVectors(p0, p1, ease);
        orb.target.lerpVectors(t0, t1, ease);
        orb.update();
        if (k < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    // ═══════════════════════════════════════════════════════
    //  COPY / PASTE
    // ═══════════════════════════════════════════════════════
    let clipboard = null;
    function setupCopyPaste() {
      window.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && _D.sel) {
          e.preventDefault();
          clipboard = serializeEntry(_D.sel);
          showToast("Copied: " + _D.sel.name);
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && clipboard) {
          e.preventDefault();
          pasteFromClipboard();
        }
      });
    }

    function serializeEntry(e) {
      const o = e.obj3d;
      return {
        type: e.type, name: e.name, opts: JSON.parse(JSON.stringify(e.opts || {})),
        isPrimitive: e.isPrimitive, geomParams: e.geomParams ? JSON.parse(JSON.stringify(e.geomParams)) : null,
        matType: e.matType, color: e.color,
        children: e.children ? JSON.parse(JSON.stringify(e.children)) : null,
        groupMeta: e.groupMeta ? JSON.parse(JSON.stringify(e.groupMeta)) : null,
        px: o.position.x, py: o.position.y, pz: o.position.z,
        rx: o.rotation.x, ry: o.rotation.y, rz: o.rotation.z,
        sx: o.scale.x, sy: o.scale.y, sz: o.scale.z,
      };
    }

    function pasteFromClipboard() {
      if (!clipboard) return;
      const d = clipboard;
      let obj3d = null;
      if (d.isPrimitive) {
        const geo = _D.makePrimGeo(d.type, d.geomParams);
        const col = parseInt((d.color || "#aaaaaa").replace("#", ""), 16);
        const mat = _D.MAT[d.matType || "standard"](col);
        obj3d = new THREE.Mesh(geo, mat);
      } else if (d.type === "group") {
        obj3d = new THREE.Group();
        (d.children || []).forEach((c) => {
          const geo = _D.makePrimGeo(c.type, c.geomParams);
          const col = parseInt((c.color || "#aaaaaa").replace("#", ""), 16);
          const mat = _D.MAT[c.matType || "standard"](col);
          const m = new THREE.Mesh(geo, mat);
          m.position.set(c.px, c.py, c.pz);
          m.rotation.set(c.rx, c.ry, c.rz);
          m.scale.set(c.sx, c.sy, c.sz);
          obj3d.add(m);
        });
      } else {
        obj3d = _D.OBJ.create(d.type, d.opts);
      }
      if (!obj3d) return;
      // Offset slightly from original position
      obj3d.position.set(d.px + 0.5, d.py, d.pz + 0.5);
      obj3d.rotation.set(d.rx, d.ry, d.rz);
      obj3d.scale.set(d.sx, d.sy, d.sz);
      obj3d.name = d.name.replace(/_cp\d*$/, "") + "_cp" + _D.idN;
      _D.scene.add(obj3d);
      const entry = {
        id: _D.idN++, name: obj3d.name, type: d.type, obj3d,
        topic: "", intLabel: "", opts: d.opts, isPrimitive: d.isPrimitive,
        geomParams: d.geomParams, matType: d.matType, color: d.color,
        children: d.children, groupMeta: d.groupMeta,
      };
      _D.items.push(entry);
      _D.selectItem(entry);
      _D.refreshTree();
      _D.genCode();
      if (window._history) window._history.push("paste");
      showToast("Pasted: " + obj3d.name);
    }

    // ═══════════════════════════════════════════════════════
    //  AUTO-FLOOR-SNAP ON PLACEMENT
    // ═══════════════════════════════════════════════════════
    function setupAutoFloorSnap() {
      // After any object is added, snap it to the floor
      const origAddPrim = window.D.addPrimitive;
      if (origAddPrim) {
        window.D.addPrimitive = function () {
          origAddPrim.apply(this, arguments);
          snapLastToFloor();
        };
      }
      const origAddObj = window.D.addObject;
      if (origAddObj) {
        window.D.addObject = function () {
          origAddObj.apply(this, arguments);
          snapLastToFloor();
        };
      }
    }
    function snapLastToFloor() {
      const last = _D.items[_D.items.length - 1];
      if (!last) return;
      const o = last.obj3d;
      const box = new THREE.Box3().setFromObject(o);
      if (box.min.y < -0.01 || box.min.y > 0.5) {
        // Snap so bottom sits on Y=0 (or current floor's yBase)
        let yBase = 0;
        if (window._sims) {
          const af = window._sims.floors.find((f) => f.id === window._sims.activeFloor);
          if (af) yBase = af.yBase;
        }
        o.position.y += yBase - box.min.y;
        _D.syncFromObj();
      }
    }

    // ═══════════════════════════════════════════════════════
    //  VIEWPORT HUD
    // ═══════════════════════════════════════════════════════
    function addViewportHud() {
      const vp = document.getElementById("viewport-area");
      const hud = document.createElement("div");
      hud.id = "vp-hud";
      vp.appendChild(hud);

      function update() {
        requestAnimationFrame(update);
        if (_D.currentMode === "plan") { hud.style.display = "none"; return; }
        hud.style.display = "";
        const objCount = _D.items.length;
        const sel = _D.sel;
        let floorName = "";
        if (window._sims && window._sims.floors.length > 1) {
          const af = window._sims.floors.find((f) => f.id === window._sims.activeFloor);
          floorName = af ? af.name : "";
        }
        let html = `<span class="hud-accent">${objCount}</span> objects`;
        if (floorName) html += ` · <span class="hud-accent">${floorName}</span>`;
        if (sel) {
          const p = sel.obj3d.position;
          html += `<br>${sel.name} <span class="hud-accent">(${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)})</span>`;
        }
        hud.innerHTML = html;
      }
      update();
    }

    // ═══════════════════════════════════════════════════════
    //  SELECTION OUTLINE
    // ═══════════════════════════════════════════════════════
    function setupSelectionOutline() {
      // Use an outline pass or a simple box helper for selected objects
      let boxHelper = null;
      function updateOutline() {
        requestAnimationFrame(updateOutline);
        if (boxHelper) {
          _D.scene.remove(boxHelper);
          boxHelper.geometry.dispose();
          boxHelper = null;
        }
        if (!_D.sel) return;
        boxHelper = new THREE.BoxHelper(_D.sel.obj3d, 0xd4a373);
        boxHelper.name = "__selOutline__";
        _D.scene.add(boxHelper);
      }
      updateOutline();
    }

    // ═══════════════════════════════════════════════════════
    //  ARROW KEY NUDGE
    // ═══════════════════════════════════════════════════════
    function setupArrowNudge() {
      const vp = document.getElementById("viewport-area");
      const toast = document.createElement("div");
      toast.id = "nudge-toast";
      vp.appendChild(toast);
      let toastTimer = null;

      window.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
        if (_D.currentMode === "plan") return;
        if (!_D.sel) return;
        const step = e.shiftKey ? 0.5 : 0.1;
        const o = _D.sel.obj3d;
        let moved = false;
        switch (e.key) {
          case "ArrowLeft":  o.position.x -= step; moved = true; e.preventDefault(); break;
          case "ArrowRight": o.position.x += step; moved = true; e.preventDefault(); break;
          case "ArrowUp":    o.position.z -= step; moved = true; e.preventDefault(); break;
          case "ArrowDown":  o.position.z += step; moved = true; e.preventDefault(); break;
        }
        if (moved) {
          _D.syncFromObj();
          _D.genCode();
          showNudgeToast(toast, o.position, step);
        }
      });
    }
    function showNudgeToast(toast, pos, step) {
      toast.textContent = `(${pos.x.toFixed(2)}, ${pos.z.toFixed(2)}) step: ${step}m`;
      toast.classList.add("show");
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => toast.classList.remove("show"), 800);
    }

    // ═══════════════════════════════════════════════════════
    //  ALT+SCROLL = ROTATE SELECTED
    // ═══════════════════════════════════════════════════════
    function setupAltScrollRotate() {
      const canvas = _D.renderer.domElement;
      canvas.addEventListener("wheel", (e) => {
        if (!e.altKey || !_D.sel) return;
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey ? Math.PI / 12 : Math.PI / 4; // 15° or 45°
        _D.sel.obj3d.rotation.y += e.deltaY > 0 ? step : -step;
        _D.syncFromObj();
        _D.genCode();
      }, { passive: false });
    }

    // ═══════════════════════════════════════════════════════
    //  CONTEXT MENU
    // ═══════════════════════════════════════════════════════
    function setupContextMenu() {
      const vp = document.getElementById("viewport-area");
      const menu = document.createElement("div");
      menu.id = "ctx-menu";
      document.body.appendChild(menu);

      // Hide on any click
      document.addEventListener("pointerdown", (e) => {
        if (!menu.contains(e.target)) menu.classList.remove("show");
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") menu.classList.remove("show");
      });

      _D.renderer.domElement.addEventListener("contextmenu", (e) => {
        if (_D.currentMode === "plan") return;
        e.preventDefault();
        // Raycast to find clicked object
        const r = _D.renderer.domElement.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          -((e.clientY - r.top) / r.height) * 2 + 1
        );
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, _D.camera);
        const meshes = [];
        _D.items.forEach((it) => it.obj3d.traverse((c) => { if (c.isMesh) meshes.push(c); }));
        const hits = ray.intersectObjects(meshes, false);
        let entry = null;
        if (hits.length) {
          let h = hits[0].object;
          while (h && !entry) { entry = _D.items.find((i) => i.obj3d === h); h = h.parent; }
        }
        if (entry) _D.selectItem(entry);

        // Build menu
        const items = [];
        if (_D.sel) {
          items.push({ label: "Duplicate", key: "Ctrl+D", action: () => { if (window._sims) window._sims.smartDuplicate(); } });
          items.push({ label: "Copy", key: "Ctrl+C", action: () => { clipboard = serializeEntry(_D.sel); showToast("Copied"); } });
          items.push({ label: "Snap to floor", key: "", action: () => { if (window._snap) window._snap.snapToFloor(); } });
          items.push({ label: "Snap to wall", key: "", action: () => { if (window._snap) window._snap.snapToWall(); } });
          items.push("sep");
          items.push({ label: "Rotate 90°", key: "Q", action: () => { _D.sel.obj3d.rotation.y += Math.PI/2; _D.syncFromObj(); _D.genCode(); } });
          items.push({ label: "Rotate 45°", key: "", action: () => { _D.sel.obj3d.rotation.y += Math.PI/4; _D.syncFromObj(); _D.genCode(); } });
          items.push("sep");
          items.push({ label: "Delete", key: "Del", action: () => window.D.deleteSel(), cls: "danger" });
        } else {
          if (clipboard) {
            items.push({ label: "Paste", key: "Ctrl+V", action: () => pasteFromClipboard() });
          }
          items.push({ label: "Add box", action: () => window.D.addPrimitive("box") });
          items.push({ label: "Add cylinder", action: () => window.D.addPrimitive("cylinder") });
        }

        menu.innerHTML = items.map((it) => {
          if (it === "sep") return '<div class="ctx-sep"></div>';
          return `<div class="ctx-item ${it.cls||""}" data-idx="${items.indexOf(it)}">
            ${it.label}${it.key ? `<span class="ctx-key">${it.key}</span>` : ""}
          </div>`;
        }).join("");

        menu.querySelectorAll(".ctx-item").forEach((el) => {
          const idx = parseInt(el.dataset.idx);
          const it = items[idx];
          if (it && it.action) el.onclick = () => { it.action(); menu.classList.remove("show"); };
        });

        // Position
        menu.style.left = e.clientX + "px";
        menu.style.top = e.clientY + "px";
        menu.classList.add("show");

        // Keep menu in viewport
        requestAnimationFrame(() => {
          const mr = menu.getBoundingClientRect();
          if (mr.right > window.innerWidth) menu.style.left = (window.innerWidth - mr.width - 4) + "px";
          if (mr.bottom > window.innerHeight) menu.style.top = (window.innerHeight - mr.height - 4) + "px";
        });
      });
    }

    // ═══════════════════════════════════════════════════════
    //  BRACKET SCALE [ ] KEYS
    // ═══════════════════════════════════════════════════════
    function setupBracketScale() {
      window.addEventListener("keydown", (e) => {
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
        if (_D.currentMode === "plan") return;
        if (!_D.sel) return;
        const step = e.shiftKey ? 0.5 : 0.1;
        if (e.key === "[") {
          const s = _D.sel.obj3d.scale;
          const ns = Math.max(0.05, s.x - step);
          s.set(ns, ns, ns);
          _D.syncFromObj(); _D.genCode();
          showToast("Scale: " + ns.toFixed(2));
        } else if (e.key === "]") {
          const s = _D.sel.obj3d.scale;
          const ns = s.x + step;
          s.set(ns, ns, ns);
          _D.syncFromObj(); _D.genCode();
          showToast("Scale: " + ns.toFixed(2));
        }
      });
    }

    // ═══════════════════════════════════════════════════════
    //  WALL-SNAP FOR OBJECTS
    // ═══════════════════════════════════════════════════════
    // When dragging an object near a wall, snap it flush against the wall
    // and rotate it to face outward. Works with both plan walls and simple walls.
    function setupWallSnap() {
      const SNAP_DIST = 0.5; // meters — how close to trigger wall snap
      let wasSnapping = false;

      _D.gizmo.addEventListener("objectChange", () => {
        if (!_D.sel) return;
        if (_D.gizmo.getMode() !== "translate") return;

        const o = _D.sel.obj3d;
        const pos = o.position;
        const box = new THREE.Box3().setFromObject(o);
        const size = new THREE.Vector3();
        box.getSize(size);
        const halfDepth = Math.min(size.x, size.z) / 2;

        // Collect all wall segments (from plan floors or simple shell)
        const walls = getWallSegments();
        if (!walls.length) return;

        let bestWall = null, bestDist = SNAP_DIST;

        walls.forEach((w) => {
          // Wall segment from (ax, az) to (bx, bz) in world coords
          const dx = w.bx - w.ax, dz = w.bz - w.az;
          const len = Math.hypot(dx, dz);
          if (len < 0.1) return;
          const ux = dx / len, uz = dz / len;
          const nx = -uz, nz = ux; // wall normal

          // Project object position onto wall line
          const t = ((pos.x - w.ax) * ux + (pos.z - w.az) * uz) / len;
          if (t < -0.1 || t > 1.1) return;

          // Perpendicular distance
          const dist = (pos.x - w.ax) * nx + (pos.z - w.az) * nz;
          const absDist = Math.abs(dist);

          if (absDist < bestDist) {
            bestDist = absDist;
            const clampT = Math.max(0, Math.min(1, t));
            bestWall = {
              // Snap position: on wall + offset by half object depth
              snapX: w.ax + ux * clampT * len + nx * (halfDepth + w.thick / 2) * Math.sign(dist),
              snapZ: w.az + uz * clampT * len + nz * (halfDepth + w.thick / 2) * Math.sign(dist),
              // Rotation: face outward from wall
              rotY: -Math.atan2(uz, ux) + (dist < 0 ? Math.PI : 0),
              dist: absDist,
            };
          }
        });

        if (bestWall && bestWall.dist < SNAP_DIST) {
          pos.x = bestWall.snapX;
          pos.z = bestWall.snapZ;
          // Only auto-rotate if the user hasn't manually rotated
          // (simple heuristic: if object rotation is near 0/90/180/270, it was manual)
          wasSnapping = true;
        } else {
          wasSnapping = false;
        }
      });
    }

    function getWallSegments() {
      const walls = [];
      const thick = 0.18;

      // From plan floors
      if (window._sims && window._sims.floors) {
        window._sims.floors.forEach((f) => {
          if (!f.plan || !f.plan.vertices || !f.plan.segments) return;
          f.plan.segments.forEach((seg) => {
            const a = f.plan.vertices[seg.a], b = f.plan.vertices[seg.b];
            if (!a || !b) return;
            walls.push({ ax: a.x, az: a.y, bx: b.x, bz: b.y, yBase: f.yBase, height: f.height, thick });
          });
        });
      }

      // From simple shell walls
      const rWalls = document.getElementById("rWalls");
      if (rWalls && rWalls.value !== "plan" && rWalls.value !== "0") {
        const W = parseFloat(document.getElementById("rW").value) || 6;
        const D = parseFloat(document.getElementById("rD").value) || 5;
        const hW = W / 2, hD = D / 2;
        const wm = rWalls.value;
        if (wm === "4" || wm === "3" || wm === "back")
          walls.push({ ax: -hW, az: -hD, bx: hW, bz: -hD, yBase: 0, height: 2.8, thick: 0.08 }); // back
        if (wm === "4" || wm === "3") {
          walls.push({ ax: -hW, az: -hD, bx: -hW, bz: hD, yBase: 0, height: 2.8, thick: 0.08 }); // left
          walls.push({ ax: hW, az: -hD, bx: hW, bz: hD, yBase: 0, height: 2.8, thick: 0.08 }); // right
        }
        if (wm === "4")
          walls.push({ ax: -hW, az: hD, bx: hW, bz: hD, yBase: 0, height: 2.8, thick: 0.08 }); // front
      }

      return walls;
    }

    // ═══════════════════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════════════════
    function showToast(msg) {
      const toast = document.getElementById("nudge-toast");
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.add("show");
      clearTimeout(toast._timer);
      toast._timer = setTimeout(() => toast.classList.remove("show"), 1200);
    }
  }
})();
