// scene_scripts/scene-io.js — Scene JSON v1 save / open.
//
// Replaces the dropped designer-cloud.js (PocketBase). Serializes the whole
// editor state to a compact "recipe" file (.ppscene.json) and restores it.
// Objects are parametric prefabs, so we store name + opts + transform, never
// geometry — a full scene is a few KB.
//
// Adds two topbar buttons (Save .ppscene / Open) and exposes:
//   window._sceneIO = { capture, restore, toJSON, fromJSON, download, openFile }
//
// Schema: see PolyPotion/SCENE_TOOL_PLAN.md §3. Version 1.
//
// NOT round-tripped in v1 (mirrors the designer's own save limits):
//   • imported / shell-delivered character meshes (no embedded GLB) — stored
//     as an "import" stub with transform + name so the slot is remembered.
//   • lights added via the Lights palette — stored as a "light" stub.
// Prefabs, primitives, and groups round-trip fully.

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const $ = _D.$;
    const FORMAT = "polypotion.scene";
    const VERSION = 1;

    addButtons();

    // ── capture ────────────────────────────────────────
    function capture(name) {
      const s = { format: FORMAT, version: VERSION,
        meta: { name: name || "Untitled", modified: Date.now(), generator: "scene/1" } };

      s.shell = {
        W: $("rW").value, D: $("rD").value, H: $("rH").value,
        floor: $("rFloorCol").value, wall: $("rWallCol").value,
        walls: $("rWalls").value, shape: $("rShape").value,
      };

      if (window._sims && window._sims.floors) {
        if (window._plan) { // fold live plan into the active floor first
          const af = window._sims.floors.find((f) => f.id === window._sims.activeFloor);
          if (af) af.plan = clonePlan(window._plan.state);
        }
        s.floors = window._sims.floors.map((f) => ({
          id: f.id, name: f.name, yBase: f.yBase, height: f.height, visible: f.visible,
          plan: f.plan ? JSON.parse(JSON.stringify(f.plan)) : null,
        }));
        s.activeFloor = window._sims.activeFloor;
        s.wallMode = window._sims.wallMode;
      }
      if (window._plan) {
        const ps = window._plan.state;
        s.planSettings = {
          thickness: ps.thickness, snap: ps.snap, angleLock: ps.angleLock,
          defaultHeight: ps.defaultHeight,
          defaultDoor: ps.defaultDoor ? { ...ps.defaultDoor } : null,
          defaultWindow: ps.defaultWindow ? { ...ps.defaultWindow } : null,
        };
      }
      if (window._atmos) {
        s.atmosphere = JSON.parse(JSON.stringify(window._atmos));
        delete s.atmosphere.applyAll;
      }

      s.items = _D.items.map(serializeItem).filter(Boolean);
      s.idN = _D.idN;
      return s;
    }

    function serializeItem(e) {
      const o = e.obj3d;
      const base = {
        name: e.name, topic: e.topic || "", intLabel: e.intLabel || "",
        t: xyz(o.position), r: xyz(o.rotation), s: xyz(o.scale),
        locked: !!e._locked, hidden: !!e._hidden,
      };
      if (e._isLight)         return { kind: "light", light: (e.type || "light_point").replace("light_", ""), opts: e.opts || {}, ...base };
      if (e.type === "imported") return { kind: "import", src: e.importData && e.importData.modelPath, ...base };
      if (e.isPrimitive)      return { kind: "prim", prim: e.type, geomParams: e.geomParams, matType: e.matType, color: e.color, ...base };
      if (e.type === "group") return { kind: "group", children: e.children, groupMeta: e.groupMeta, ...base };
      return { kind: "prefab", type: e.type, opts: e.opts || {}, ...base };
    }

    // ── restore ────────────────────────────────────────
    function restore(s) {
      if (!s || s.format !== FORMAT) { alert("Not a PolyPotion scene file."); return; }

      if (s.shell) {
        $("rW").value = s.shell.W; $("rD").value = s.shell.D; $("rH").value = s.shell.H;
        $("rFloorCol").value = s.shell.floor; $("rWallCol").value = s.shell.wall;
        $("rWalls").value = s.shell.walls; $("rShape").value = s.shell.shape;
        setSwatch("sw-floor", s.shell.floor); setSwatch("sw-wall", s.shell.wall);
      }
      if (s.planSettings && window._plan) {
        const ps = window._plan.state, p = s.planSettings;
        if (p.thickness) ps.thickness = p.thickness;
        if (p.snap !== undefined) ps.snap = p.snap;
        if (p.angleLock !== undefined) ps.angleLock = p.angleLock;
        if (p.defaultHeight) ps.defaultHeight = p.defaultHeight;
        if (p.defaultDoor) ps.defaultDoor = p.defaultDoor;
        if (p.defaultWindow) ps.defaultWindow = p.defaultWindow;
      }
      if (s.floors && window._sims) {
        window._sims.floors = s.floors.map((f) => ({
          id: f.id, name: f.name, yBase: f.yBase, height: f.height, visible: f.visible,
          plan: f.plan ? JSON.parse(JSON.stringify(f.plan)) : { vertices: [], segments: [], arcs: [] },
        }));
        window._sims.activeFloor = s.activeFloor || 0;
        if (window._plan) {
          const af = window._sims.floors.find((x) => x.id === window._sims.activeFloor);
          if (af && af.plan) Object.assign(window._plan.state, clonePlan(af.plan));
        }
      }

      // wipe current items
      _D.gizmo.detach();
      _D.items.forEach((e) => { _D.scene.remove(e.obj3d); _D.disposeObj(e.obj3d); });
      _D.items = []; _D.sel = null;

      let skipped = 0;
      (s.items || []).forEach((d) => {
        const e = deserialize(d);
        if (!e) { skipped++; return; }
        _D.scene.add(e.obj3d);
        _D.items.push(e);
      });
      _D.idN = s.idN || (_D.items.length ? Math.max(..._D.items.map((i) => i.id)) + 1 : 0);

      if (s.atmosphere && window._atmos) {
        Object.keys(s.atmosphere).forEach((k) => {
          if (typeof s.atmosphere[k] !== "function") window._atmos[k] = s.atmosphere[k];
        });
        if (window._atmos.applyAll) window._atmos.applyAll();
      }
      if (s.wallMode && window._sims) {
        window._sims.wallMode = s.wallMode;
        if (window._sims.applyWallMode) setTimeout(window._sims.applyWallMode, 50);
      }

      _D.rebuildShell();
      if (window._sims && window._sims.rebuildAllFloors && s.floors) window._sims.rebuildAllFloors();
      _D.showForm(false); _D.refreshTree(); _D.genCode();
      if (window._plan && window._plan.render) window._plan.render();
      if (window._history) window._history.clear();
      if (skipped) console.info("scene-io: " + skipped + " item(s) not round-tripped (import/light stubs).");
    }

    function deserialize(d) {
      const THREE = _D.THREE;
      let obj3d = null, id = _D.idN;
      if (d.kind === "prim") {
        const geo = _D.makePrimGeo(d.prim, d.geomParams);
        const col = parseInt((d.color || "#aaaaaa").replace("#", ""), 16);
        obj3d = new THREE.Mesh(geo, _D.MAT[d.matType || "standard"](col));
      } else if (d.kind === "group") {
        obj3d = new THREE.Group();
        (d.children || []).forEach((c) => {
          const geo = _D.makePrimGeo(c.type, c.geomParams);
          const col = parseInt((c.color || "#aaaaaa").replace("#", ""), 16);
          const m = new THREE.Mesh(geo, _D.MAT[c.matType || "standard"](col));
          m.position.set(c.px, c.py, c.pz); m.rotation.set(c.rx, c.ry, c.rz); m.scale.set(c.sx, c.sy, c.sz);
          obj3d.add(m);
        });
      } else if (d.kind === "prefab") {
        obj3d = _D.OBJ.create(d.type, d.opts || {});
      } else {
        return null; // light / import stubs — not rebuilt in v1
      }
      if (!obj3d) return null;
      _D.idN = id + 1;
      obj3d.name = d.name;
      apply(obj3d, d);
      const entry = {
        id: id, name: d.name, type: d.kind === "prim" ? d.prim : d.type, obj3d: obj3d,
        topic: d.topic || "", intLabel: d.intLabel || "",
        opts: d.opts || {}, isPrimitive: d.kind === "prim",
        geomParams: d.geomParams, matType: d.matType, color: d.color,
        children: d.children, groupMeta: d.groupMeta,
        _locked: d.locked, _hidden: d.hidden,
      };
      obj3d.visible = !d.hidden;
      return entry;
    }

    // ── files ──────────────────────────────────────────
    function toJSON(name) { return JSON.stringify(capture(name), null, 2); }
    function fromJSON(text) { restore(JSON.parse(text)); }

    function download(name) {
      const nm = (name || prompt("Scene name:", "untitled") || "untitled").trim();
      const blob = new Blob([toJSON(nm)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nm.replace(/[^a-z0-9_-]+/gi, "_") + ".ppscene.json";
      a.click(); URL.revokeObjectURL(a.href);
    }
    function openFile() {
      const f = document.createElement("input");
      f.type = "file"; f.accept = ".json,application/json";
      f.onchange = () => {
        const file = f.files[0]; if (!file) return;
        const r = new FileReader();
        r.onload = () => { try { fromJSON(r.result); } catch (e) { alert("Invalid scene file: " + e.message); } };
        r.readAsText(file);
      };
      f.click();
    }

    // ── UI ─────────────────────────────────────────────
    function addButtons() {
      const bar = document.getElementById("topbar");
      if (!bar) return;
      const ref = [...bar.querySelectorAll("button")].find((b) => /Download JS/i.test(b.textContent));
      const save = mkBtn("Save .ppscene", download);
      const open = mkBtn("Open", openFile);
      if (ref) { bar.insertBefore(open, ref); bar.insertBefore(save, ref); }
      else { bar.appendChild(save); bar.appendChild(open); }
    }
    function mkBtn(label, fn) {
      const b = document.createElement("button");
      b.className = "btn"; b.textContent = label; b.onclick = () => fn();
      return b;
    }

    // ── helpers ────────────────────────────────────────
    function xyz(v) { return [round(v.x), round(v.y), round(v.z)]; }
    function round(n) { return Math.round(n * 1e4) / 1e4; }
    function apply(o, d) {
      if (d.t) o.position.set(d.t[0], d.t[1], d.t[2]);
      if (d.r) o.rotation.set(d.r[0], d.r[1], d.r[2]);
      if (d.s) o.scale.set(d.s[0], d.s[1], d.s[2]);
    }
    function clonePlan(ps) {
      return {
        vertices: JSON.parse(JSON.stringify(ps.vertices)),
        segments: JSON.parse(JSON.stringify(ps.segments)),
        arcs: JSON.parse(JSON.stringify(ps.arcs)),
      };
    }
    function setSwatch(id, color) { const el = document.getElementById(id); if (el) el.style.background = color; }

    window._sceneIO = { capture, restore, toJSON, fromJSON, download, openFile };
  }
})();
