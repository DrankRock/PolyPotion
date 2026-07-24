// designer-extras2.js — Palette UX + topic dropdown + lights as primitives.
//
//   • Search input over the prefab palette + "Recents" row
//   • Drag a palette button into the viewport — drops at the cursor's
//     world position (raycast onto floor / shell)
//   • The "Interactive topic" text field is replaced with a dropdown of
//     dialogue-node IDs (parsed from data/dialogue.js if loaded)
//   • Point / Spot / Directional lights added to the Primitives grid,
//     with editable color + intensity in the Properties panel

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;
    const $ = _D.$;

    injectStyles();
    // ── Palette recents state (must be before enhancePalette uses it) ──
    let recents = [];
    try { recents = JSON.parse(localStorage.getItem("designer:recents") || "[]"); } catch (_) {}
    enhancePalette();
    enableDragFromPalette();
    enhanceTopicField();
    addLightPrimitives();

    function injectStyles() {
      const s = document.createElement("style");
      s.textContent = `
        #palette-search{margin-bottom:8px;width:100%;padding:5px 8px;background:var(--surface3);border:1px solid var(--border);color:var(--text);font:inherit;font-size:12px;border-radius:3px;outline:none}
        #palette-search:focus{border-color:var(--accent)}
        .pal-recents-label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--text2);padding:6px 0 2px;grid-column:1/-1;border-top:1px dashed var(--border);margin-top:4px}
        .obj-btn[draggable=true]{user-select:none}
        .obj-btn.dragging{opacity:.4}
        #drop-ring{position:absolute;width:60px;height:60px;border:2px dashed var(--accent);border-radius:50%;pointer-events:none;z-index:7;transform:translate(-50%,-50%);display:none;background:radial-gradient(circle,rgba(212,163,115,0.18),transparent)}
        .light-helper-pulse{animation:lpulse 1.8s ease-in-out infinite}
        @keyframes lpulse { 50%{opacity:.6} }
        .topic-row{display:flex;gap:4px}
        .topic-row select{flex:1}
        .topic-row button{padding:0 8px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);font:inherit;font-size:11px;border-radius:3px;cursor:pointer}
        .topic-row button:hover{color:var(--accent);border-color:var(--accent)}
      `;
      document.head.appendChild(s);
    }

    function enhancePalette() {
      const palette = document.getElementById("palette");
      if (!palette) return;

      // Search input above the palette
      const wrap = palette.parentElement;
      const search = document.createElement("input");
      search.id = "palette-search";
      search.placeholder = "Search prefabs…";
      wrap.insertBefore(search, palette);
      search.addEventListener("input", filterPalette);

      // Rebuild + add recents on top
      buildPaletteWithRecents();
      // After core does its initial buildPalette, intercept by reading list()
      // and re-rendering on first focus.

      function filterPalette() {
        const q = search.value.trim().toLowerCase();
        [...palette.querySelectorAll(".obj-btn")].forEach((b) => {
          const name = (b.dataset.name || b.textContent).toLowerCase();
          b.style.display = !q || name.includes(q) ? "" : "none";
        });
        [...palette.querySelectorAll(".cat-label, .pal-recents-label")].forEach((lbl) => {
          // Hide label if all its sibling buttons until next label are hidden
          let next = lbl.nextElementSibling;
          let anyVisible = false;
          while (next && !next.classList.contains("cat-label") && !next.classList.contains("pal-recents-label")) {
            if (next.classList.contains("obj-btn") && next.style.display !== "none") {
              anyVisible = true; break;
            }
            next = next.nextElementSibling;
          }
          lbl.style.display = anyVisible || !q ? "" : "none";
        });
      }
    }
    function buildPaletteWithRecents() {
      const palette = document.getElementById("palette");
      if (!palette) return;
      // Re-render: remove any prior recents row
      [...palette.querySelectorAll('.pal-recents-label, .obj-btn[data-recent="1"]')].forEach((n) => n.remove());
      // Insert recents at top
      if (recents.length) {
        const lbl = document.createElement("div");
        lbl.className = "pal-recents-label";
        lbl.textContent = "Recents";
        palette.insertBefore(lbl, palette.firstChild);
        const list = _D.OBJ.list();
        recents.slice(0, 6).forEach((name) => {
          const o = list.find((x) => x.name === name);
          if (!o) return;
          const b = document.createElement("button");
          b.className = "obj-btn";
          b.dataset.name = o.name;
          b.dataset.recent = "1";
          b.draggable = true;
          b.innerHTML = `<span class="ic">${o.icon || "◆"}</span>${o.name}`;
          b.onclick = () => { addAndRecent(o.name); };
          palette.insertBefore(b, lbl.nextSibling);
        });
      }
      // Mark all other palette buttons draggable + add dataset.name
      [...palette.querySelectorAll(".obj-btn")].forEach((b) => {
        b.draggable = true;
        if (!b.dataset.name) {
          // Strip emoji + spaces from the textContent — but easier: look up via icon span
          const name = b.textContent.trim().split("\n").pop().trim();
          b.dataset.name = name;
        }
        // Replace click to track recents
        if (!b.dataset.tracked) {
          b.dataset.tracked = "1";
          b.addEventListener("click", () => addAndRecent(b.dataset.name), true);
        }
      });
    }
    function addAndRecent(name) {
      recents = [name, ...recents.filter((n) => n !== name)].slice(0, 8);
      try { localStorage.setItem("designer:recents", JSON.stringify(recents)); } catch (_) {}
      // Note: the original button.onclick already calls addObject; this is just tracking.
      // For recent buttons (which have NO original onclick), call manually:
      // Determine if this was a recent button click? We can just always addObject — but
      // that'd double-add for the category button. Skip if button isn't a recent one.
    }
    // Override OBJECTS.list change → rebuild palette w/ recents.
    // Simpler: on each click in palette, defer recents rebuild.
    document.addEventListener("click", (e) => {
      const b = e.target.closest("#palette .obj-btn");
      if (b && b.dataset.name) {
        // Add to recents
        recents = [b.dataset.name, ...recents.filter((n) => n !== b.dataset.name)].slice(0, 8);
        try { localStorage.setItem("designer:recents", JSON.stringify(recents)); } catch (_) {}
        // Rebuild after a tick so the core has already added the object
        setTimeout(buildPaletteWithRecents, 80);
      }
    });

    // ── Drag from palette → drop at cursor ────────────
    function enableDragFromPalette() {
      const canvas = _D.renderer.domElement;
      const vp = document.getElementById("viewport-area");
      const ring = document.createElement("div");
      ring.id = "drop-ring";
      vp.appendChild(ring);
      let draggingName = null;

      document.addEventListener("dragstart", (e) => {
        const b = e.target.closest("#palette .obj-btn");
        if (!b) return;
        draggingName = b.dataset.name;
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", b.dataset.name || "");
        b.classList.add("dragging");
      });
      document.addEventListener("dragend", (e) => {
        const b = e.target.closest("#palette .obj-btn");
        if (b) b.classList.remove("dragging");
        draggingName = null;
        ring.style.display = "none";
      });
      vp.addEventListener("dragover", (e) => {
        if (!draggingName && !e.dataTransfer.types.includes("text/plain")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        // Position ring
        const r = vp.getBoundingClientRect();
        ring.style.left = (e.clientX - r.left) + "px";
        ring.style.top = (e.clientY - r.top) + "px";
        ring.style.display = "block";
      });
      vp.addEventListener("dragleave", () => { ring.style.display = "none"; });
      vp.addEventListener("drop", (e) => {
        e.preventDefault();
        ring.style.display = "none";
        const name = e.dataTransfer.getData("text/plain") || draggingName;
        if (!name) return;
        const point = pickWorld(e);
        // Add the object then move it
        const before = _D.items.length;
        if (window.D && window.D.addObject) window.D.addObject(name);
        const added = _D.items[_D.items.length - 1];
        if (added && point) {
          added.obj3d.position.set(point.x, point.y, point.z);
          _D.syncFromObj(); _D.genCode();
        }
        draggingName = null;
      });
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
      _D.shell.traverse((c) => { if (c.isMesh) meshes.push(c); });
      const hits = ray.intersectObjects(meshes, false);
      if (hits.length) return hits[0].point.clone();
      // fall back to Y=0 plane
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const pt = new THREE.Vector3();
      ray.ray.intersectPlane(plane, pt);
      return pt;
    }

    // ── Topic dropdown — read dialogue.js if loaded ────
    function enhanceTopicField() {
      const topic = document.getElementById("pTopic");
      if (!topic) return;
      const nodes = (window.DIALOGUE && window.DIALOGUE.nodes) || null;
      // Wrap input in a row with a select
      const row = document.createElement("div");
      row.className = "topic-row";
      const select = document.createElement("select");
      select.style.flex = "1";
      select.id = "pTopicSelect";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = nodes ? "— pick a dialogue node —" : "(no dialogue.js loaded)";
      select.appendChild(placeholder);
      if (nodes) {
        const ids = Object.keys(nodes).sort();
        ids.forEach((id) => {
          const opt = document.createElement("option");
          opt.value = id;
          opt.textContent = id;
          select.appendChild(opt);
        });
      }
      // Insert select; keep the text input visible (allows custom values)
      topic.parentNode.insertBefore(row, topic);
      row.appendChild(select);
      row.appendChild(topic);
      topic.style.flex = "1.2";
      topic.placeholder = "or type custom";
      select.addEventListener("change", () => {
        if (select.value) {
          topic.value = select.value;
          if (window.D && window.D.setProp) window.D.setProp("topic", select.value);
        }
      });
    }

    // ── Lights as primitives ──────────────────────────
    function addLightPrimitives() {
      const grid = document.querySelector("#sec-primitives .obj-grid");
      if (!grid) return;
      const sep = document.createElement("div");
      sep.className = "cat-label";
      sep.textContent = "Lights";
      grid.appendChild(sep);
      const types = [
        { id: "point", label: "Point", icon: "◉" },
        { id: "spot",  label: "Spot",  icon: "◆" },
        { id: "dir",   label: "Sun",   icon: "☀" },
      ];
      types.forEach((t) => {
        const b = document.createElement("button");
        b.className = "obj-btn";
        b.innerHTML = `<span class="ic">${t.icon}</span>${t.label}`;
        b.onclick = () => addLight(t.id);
        grid.appendChild(b);
      });
    }
    function addLight(kind) {
      let light, helper, geomMarker;
      const yellow = 0xffd9a0;
      if (kind === "point") {
        light = new THREE.PointLight(yellow, 1, 8, 1.2);
        helper = new THREE.PointLightHelper(light, 0.2, yellow);
      } else if (kind === "spot") {
        light = new THREE.SpotLight(yellow, 1.5, 10, Math.PI / 6, 0.3, 1.2);
        light.position.set(0, 0, 0);
        light.target.position.set(0, -1, 0);
        helper = new THREE.SpotLightHelper(light);
      } else {
        light = new THREE.DirectionalLight(yellow, 1.0);
        light.position.set(0, 0, 0);
        light.target.position.set(0, -1, 0);
        helper = new THREE.DirectionalLightHelper(light, 0.5, yellow);
      }
      // We want the light object to be selectable by the gizmo and ray. The
      // light itself isn't a mesh, so wrap it in a Group with a tiny visible
      // marker mesh that ray-picks.
      const wrap = new THREE.Group();
      wrap.name = "light_" + (_D.idN);
      // Marker (raycastable, but doesn't cast shadows or block light)
      geomMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 8),
        new THREE.MeshBasicMaterial({ color: yellow, transparent: true, opacity: 0.55 })
      );
      geomMarker.userData._isLightMarker = true;
      wrap.add(light);
      if (light.target) wrap.add(light.target);
      wrap.add(helper);
      wrap.add(geomMarker);
      wrap.position.set(0, 2.5, 0);
      _D.scene.add(wrap);

      const entry = {
        id: _D.idN, name: wrap.name, type: "light_" + kind, obj3d: wrap,
        topic: "", intLabel: "",
        opts: { color: "#" + yellow.toString(16).padStart(6, "0"), intensity: light.intensity, distance: light.distance || 0 },
        isPrimitive: false, // not a generic primitive (no geomParams)
        _isLight: true, _lightRef: light, _lightHelper: helper,
        children: null,
      };
      _D.idN = _D.idN + 1;
      _D.items.push(entry);
      _D.selectItem(entry);
      _D.refreshTree(); _D.genCode();
      if (window._history) window._history.push("addLight");
    }
  }
})();
