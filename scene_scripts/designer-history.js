// designer-history.js — Undo / Redo via state snapshots.
//
// Strategy:
//   • A snapshot serializes the editor's `items` array (params only, no
//     three.js refs) plus shell config and plan state.
//   • Mutating actions (add, delete, transform end, prop change…) push a
//     snapshot AFTER the change. Undo restores the previous one.
//   • The gizmo only pushes a snapshot when a drag ENDS (dragging-changed),
//     so a drag = one history step, not 100.
//
// Public API:
//   window._history = { push, undo, redo, canUndo, canRedo }

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;
    const undoStack = [];
    const redoStack = [];
    const LIMIT = 80;

    // Push the initial state so the first undo restores the empty start.
    push("initial");

    window._history = { push, undo, redo, canUndo, canRedo, clear };

    // Patch mutating actions on window.D so they snapshot automatically.
    patchMutations();

    // Gizmo drag end → snapshot
    _D.gizmo.addEventListener("dragging-changed", (e) => {
      if (!e.value) push("transform");
    });

    // Keyboard
    window.addEventListener("keydown", (e) => {
      // Skip when typing
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault(); undo();
      } else if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") ||
                 ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault(); redo();
      }
    });

    // Indicator buttons in the topbar — added by extras module if present;
    // otherwise this is no-op.

    // ── core ───────────────────────────────────────────
    function push(reason) {
      const snap = capture(reason);
      undoStack.push(snap);
      if (undoStack.length > LIMIT) undoStack.shift();
      redoStack.length = 0;
      _D.notify("historyChange", { canUndo: undoStack.length > 1, canRedo: false, reason });
    }
    function canUndo() { return undoStack.length > 1; }
    function canRedo() { return redoStack.length > 0; }
    function clear() { undoStack.length = 0; redoStack.length = 0; push("clear"); }

    function undo() {
      if (undoStack.length < 2) return;
      redoStack.push(undoStack.pop());
      apply(undoStack[undoStack.length - 1]);
      _D.notify("historyChange", { canUndo: canUndo(), canRedo: canRedo() });
    }
    function redo() {
      if (!redoStack.length) return;
      const s = redoStack.pop();
      undoStack.push(s);
      apply(s);
      _D.notify("historyChange", { canUndo: canUndo(), canRedo: canRedo() });
    }

    // ── capture state ──────────────────────────────────
    function capture(reason) {
      return {
        reason,
        idN: _D.idN,
        selId: _D.sel ? _D.sel.id : null,
        shell: captureShell(),
        plan: window._plan ? deepClone(window._plan.state) : null,
        items: _D.items.map(serializeItem).filter(Boolean),
      };
    }
    function captureShell() {
      const $ = _D.$;
      return {
        W: $("rW").value, D: $("rD").value, H: $("rH").value,
        floor: $("rFloorCol").value, wall: $("rWallCol").value,
        walls: $("rWalls").value, shape: $("rShape").value,
      };
    }
    function serializeItem(e) {
      const o = e.obj3d;
      const base = {
        id: e.id, name: e.name, type: e.type,
        topic: e.topic || "", intLabel: e.intLabel || "",
        opts: deepClone(e.opts || {}),
        isPrimitive: !!e.isPrimitive,
        geomParams: deepClone(e.geomParams),
        matType: e.matType, color: e.color,
        children: deepClone(e.children),
        groupMeta: deepClone(e.groupMeta),
        // Imported items: stash transform but we can't restore the geometry,
        // so they'll be skipped on undo (with a console warning).
        importedSkip: e.type === "imported",
        px: o.position.x, py: o.position.y, pz: o.position.z,
        rx: o.rotation.x, ry: o.rotation.y, rz: o.rotation.z,
        sx: o.scale.x,    sy: o.scale.y,    sz: o.scale.z,
      };
      return base;
    }

    // ── apply state ────────────────────────────────────
    function apply(snap) {
      // 1. Wipe current items
      _D.gizmo.detach();
      _D.items.forEach((e) => { _D.scene.remove(e.obj3d); _D.disposeObj(e.obj3d); });
      _D.items = [];
      _D.sel = null;

      // 2. Restore shell config + rebuild shell
      const $ = _D.$;
      if (snap.shell) {
        $("rW").value = snap.shell.W; $("rD").value = snap.shell.D; $("rH").value = snap.shell.H;
        $("rFloorCol").value = snap.shell.floor;
        $("rWallCol").value = snap.shell.wall;
        $("rWalls").value = snap.shell.walls;
        $("rShape").value = snap.shell.shape;
        // swatch backgrounds
        const swF = document.getElementById("sw-floor");
        const swW = document.getElementById("sw-wall");
        if (swF) swF.style.background = snap.shell.floor;
        if (swW) swW.style.background = snap.shell.wall;
        _D.rebuildShell();
      }

      // 3. Restore plan
      if (snap.plan && window._plan) {
        Object.assign(window._plan.state, deepClone(snap.plan));
        window._plan.render && window._plan.render();
      }

      // 4. Restore items
      snap.items.forEach((d) => {
        if (d.importedSkip) return; // can't round-trip imported meshes
        const e = deserialize(d);
        if (!e) return;
        _D.scene.add(e.obj3d);
        _D.items.push(e);
      });
      _D.idN = snap.idN || (snap.items[snap.items.length - 1]?.id + 1) || 0;

      // 5. Restore selection
      if (snap.selId != null) {
        const f = _D.items.find((i) => i.id === snap.selId);
        if (f) _D.selectItem(f);
        else _D.showForm(false);
      } else {
        _D.showForm(false);
      }
      _D.refreshTree();
      _D.genCode();
    }
    function deserialize(d) {
      const OBJ = _D.OBJ;
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
        obj3d = OBJ.create(d.type, d.opts);
      }
      if (!obj3d) return null;
      obj3d.name = d.name;
      obj3d.position.set(d.px, d.py, d.pz);
      obj3d.rotation.set(d.rx, d.ry, d.rz);
      obj3d.scale.set(d.sx, d.sy, d.sz);
      return {
        id: d.id, name: d.name, type: d.type,
        obj3d,
        topic: d.topic, intLabel: d.intLabel,
        opts: d.opts, isPrimitive: d.isPrimitive,
        geomParams: d.geomParams,
        matType: d.matType, color: d.color,
        children: d.children, groupMeta: d.groupMeta,
      };
    }
    function deepClone(o) {
      if (o == null) return o;
      return JSON.parse(JSON.stringify(o));
    }

    // ── patch D.* mutations to auto-snapshot ───────────
    function patchMutations() {
      const names = [
        "addPrimitive", "addObject", "rebuildShell",
        "duplicate", "deleteSel", "deleteById",
        "setMaterial", "setColor", "updateGeom", "setProp",
        "groupAll", "ungroupSel", "decimateSel", "clearAll",
        "handleFile",
      ];
      names.forEach((n) => {
        const orig = window.D && window.D[n];
        if (typeof orig !== "function") return;
        window.D[n] = function (...args) {
          const r = orig.apply(this, args);
          // Some take a confirm dialog (clearAll) — only snapshot if user actually cleared.
          // We can't tell directly; snapshot anyway. Harmless if no change.
          try { push(n); } catch (err) { console.warn("history snapshot failed:", err); }
          return r;
        };
      });
    }
  }
})();
