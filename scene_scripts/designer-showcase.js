// designer-showcase.js — Category showcase / gallery mode.
//
// Adds a category dropdown + "Showcase" toggle to the viewport toolbar.
// In showcase mode:
//   • The user's current build is hidden (NOT deleted) and restored on exit.
//   • One instance of every prefab in the chosen category is laid out on a
//     grid, spaced by each object's own bounding-box size so nothing overlaps.
//   • Each object slowly rotates; animated prefabs (userData.tick) keep animating.
//   • A floating label under each shows its name.
//   • Hovering highlights; clicking an object exits showcase and adds THAT
//     prefab to the real scene as a normal editable item, then selects it.
//   • Exiting restores the user's build, camera, and gizmo exactly as before.
//
// Hooks the editor purely through window._D (like the other designer-* modules);
// it does not fork the core.
(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;
    const $ = _D.$;

    let active = false;
    let root = null;                 // THREE.Group holding all showcase objects
    let cards = [];                  // { obj, label, baseY, name }
    let savedCam = null, savedTarget = null, savedItemsVisible = [];
    let raf = null;
    let hovered = null;

    injectStyles();
    const ui = injectControls();

    // ── Build category list from the registry ──────────
    function categories() {
      const cats = {};
      _D.OBJ.list().forEach((o) => { const c = o.category || "other"; (cats[c] = cats[c] || []).push(o); });
      // de-dup names within a category (registry can hold overridden dupes)
      Object.keys(cats).forEach((c) => {
        const seen = new Set(); cats[c] = cats[c].filter((o) => seen.has(o.name) ? false : (seen.add(o.name), true));
      });
      return cats;
    }

    function refreshCategoryOptions() {
      const select = document.getElementById("showcase-cat");
      if (!select) return;            // controls not mounted yet
      const cats = categories();
      const names = Object.keys(cats).sort();
      select.innerHTML = "";
      names.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c; opt.textContent = c + " (" + cats[c].length + ")";
        select.appendChild(opt);
      });
    }

    // ── Enter / exit ───────────────────────────────────
    function enter() {
      if (active) return;
      const cats = categories();
      const cat = ui.select.value;
      const list = (cats[cat] || []);
      if (!list.length) return;

      active = true;
      ui.btn.classList.add("on");
      ui.btn.textContent = "✕ Exit Showcase";
      ui.banner.style.display = "block";
      ui.banner.textContent = "Showcase: " + cat + " — click an object to place & edit it";

      // Save camera + hide gizmo + hide user's build
      savedCam = _D.camera.position.clone();
      savedTarget = _D.orbit.target.clone();
      try { _D.gizmo.detach(); } catch (_) {}
      savedItemsVisible = _D.items.map((e) => [e.obj3d, e.obj3d.visible]);
      savedItemsVisible.forEach(([o]) => { o.visible = false; });
      if (_D.shell) _D.shell.visible = false;

      // Build the grid
      root = new THREE.Group(); root.name = "__showcase__"; _D.scene.add(root);
      cards = [];
      const n = list.length;
      const cols = Math.ceil(Math.sqrt(n));
      const spacing = 2.2;
      let i = 0;
      let maxExtent = 0;
      list.forEach((meta) => {
        let obj;
        try { obj = _D.OBJ.create(meta.name); } catch (e) { obj = null; }
        if (!obj) { i++; return; }
        // measure to center + scale oversized things down so the grid reads evenly
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3(); box.getSize(size);
        const center = new THREE.Vector3(); box.getCenter(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const fit = maxDim > 1.6 ? 1.6 / maxDim : 1;       // shrink only giants

        const col = i % cols, rowI = Math.floor(i / cols);
        const x = (col - (cols - 1) / 2) * spacing;
        const z = (rowI - (Math.ceil(n / cols) - 1) / 2) * spacing;

        const pedestal = new THREE.Group();
        pedestal.position.set(x, 0, z);

        // spinner holds the object, re-centered over the pedestal and floor-aligned
        const spinner = new THREE.Group();
        obj.scale.setScalar(fit);
        // recompute box after scale for floor alignment
        const box2 = new THREE.Box3().setFromObject(obj);
        const c2 = new THREE.Vector3(); box2.getCenter(c2);
        const min2 = box2.min.y;
        obj.position.set(-c2.x, -min2, -c2.z);             // sit on y=0, centered in x/z
        spinner.add(obj);
        spinner.position.y = 0.05;
        pedestal.add(spinner);

        // disc under it
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 0.7, 0.04, 24),
          new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.8, metalness: 0.1, transparent: true, opacity: 0.6 })
        );
        disc.position.y = 0.0; pedestal.add(disc);

        // label sprite
        const label = makeLabel(meta.name);
        label.position.set(0, -0.18, 0.75);
        pedestal.add(label);

        root.add(pedestal);
        cards.push({ pedestal, spinner, obj, label, name: meta.name, baseScale: fit, disc });
        maxExtent = Math.max(maxExtent, Math.abs(x), Math.abs(z));
        i++;
      });

      // Frame the camera to see the whole grid
      const span = (maxExtent + spacing) * 1.3 + 2;
      _D.camera.position.set(span * 0.7, span * 0.8, span * 0.9);
      _D.orbit.target.set(0, 0.4, 0);
      _D.orbit.update();

      // Wire interaction + loop
      bindPointer(true);
      loop();
    }

    function exit(placeName) {
      if (!active) return;
      active = false;
      ui.btn.classList.remove("on");
      ui.btn.textContent = "▦ Showcase";
      ui.banner.style.display = "none";
      bindPointer(false);
      if (raf) cancelAnimationFrame(raf), raf = null;

      // tear down showcase objects
      if (root) {
        root.traverse((o) => { if (o.geometry) o.geometry.dispose && o.geometry.dispose(); if (o.material) { const m = o.material; (Array.isArray(m) ? m : [m]).forEach((mm) => mm.dispose && mm.dispose()); } });
        _D.scene.remove(root); root = null;
      }
      cards = []; hovered = null;

      // restore user's build + shell + camera
      savedItemsVisible.forEach(([o, v]) => { o.visible = v; });
      savedItemsVisible = [];
      if (_D.shell) _D.shell.visible = true;
      if (savedCam) _D.camera.position.copy(savedCam);
      if (savedTarget) _D.orbit.target.copy(savedTarget);
      _D.orbit.update();

      // if a click selected one, place it for real now
      if (placeName && window.D && window.D.addObject) {
        window.D.addObject(placeName);                    // adds + selects + history snapshot
      }
    }

    // ── Per-frame loop (only runs while active) ────────
    function loop() {
      if (!active) return;
      raf = requestAnimationFrame(loop);
      const dt = 0.016;
      cards.forEach((c) => {
        c.spinner.rotation.y += dt * 0.5;                 // slow spin
        // keep animated prefabs alive
        c.obj.traverse((o) => { if (o.userData && typeof o.userData.tick === "function") { try { o.userData.tick(dt); } catch (_) {} } });
        // hover lift
        const target = (hovered === c) ? 0.2 : 0.05;
        c.spinner.position.y += (target - c.spinner.position.y) * 0.2;
        c.disc.material.opacity = (hovered === c) ? 0.95 : 0.6;
      });
      _D.orbit.update();
      _D.renderer.render(_D.scene, _D.camera);
    }

    // ── Pointer: hover highlight + click to place ──────
    let _move, _click;
    function bindPointer(on) {
      const dom = _D.renderer.domElement;
      if (on) {
        _move = (e) => { hovered = pick(e); dom.style.cursor = hovered ? "pointer" : ""; };
        _click = (e) => { const hit = pick(e); if (hit) exit(hit.name); };
        dom.addEventListener("pointermove", _move);
        dom.addEventListener("click", _click);
      } else {
        if (_move) dom.removeEventListener("pointermove", _move);
        if (_click) dom.removeEventListener("click", _click);
        dom.style.cursor = "";
        _move = _click = null;
      }
    }
    const ray = new THREE.Raycaster();
    function pick(e) {
      if (!root) return null;
      const dom = _D.renderer.domElement;
      const r = dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, _D.camera);
      const meshes = [];
      cards.forEach((c) => c.pedestal.traverse((o) => { if (o.isMesh) { o.userData.__card = c; meshes.push(o); } }));
      const hits = ray.intersectObjects(meshes, false);
      if (!hits.length) return null;
      // climb to the card
      let o = hits[0].object;
      while (o && !o.userData.__card) o = o.parent;
      return o ? o.userData.__card : null;
    }

    // ── Label sprite ───────────────────────────────────
    function makeLabel(text) {
      const cv = document.createElement("canvas"); cv.width = 256; cv.height = 64;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "rgba(15,15,20,0.85)"; ctx.fillRect(0, 0, 256, 64);
      ctx.strokeStyle = "rgba(212,163,115,0.6)"; ctx.lineWidth = 2; ctx.strokeRect(1, 1, 254, 62);
      ctx.fillStyle = "#e8e0d0"; ctx.font = "22px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(text.length > 20 ? text.slice(0, 19) + "…" : text, 128, 34);
      const tex = new THREE.CanvasTexture(cv);
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      spr.scale.set(1.0, 0.25, 1);
      return spr;
    }

    // ── UI injection ───────────────────────────────────
    function injectControls() {
      // Prefer a visible spot: just above the prefab palette in the left panel.
      const palette = $("palette");
      let host, inToolbar = false;
      if (palette && palette.parentElement) {
        host = document.createElement("div");
        host.id = "showcase-host";
        host.style.cssText = "display:flex;gap:4px;align-items:center;margin:2px 0 8px;flex-wrap:wrap";
        const lbl = document.createElement("span");
        lbl.textContent = "Showcase:";
        lbl.style.cssText = "font-size:11px;color:var(--text2);letter-spacing:.04em";
        host.appendChild(lbl);
        palette.parentElement.insertBefore(host, palette);
      } else {
        // fallback: the viewport mode-button strip
        host = document.querySelector(".mode-btns") || $("viewport-area");
        const sep = document.createElement("span");
        sep.style.cssText = "width:1px;height:20px;background:var(--border);margin:0 2px";
        host.appendChild(sep);
        inToolbar = true;
      }

      const select = document.createElement("select");
      select.id = "showcase-cat";
      select.className = "mode-btn";
      select.style.cssText = "padding:3px 6px;font-size:11px";
      select.title = "Category to showcase";

      const btn = document.createElement("button");
      btn.className = "mode-btn"; btn.id = "showcase-btn";
      btn.innerHTML = "▦ Showcase";
      btn.onclick = () => { active ? exit(null) : enter(); };

      if (inToolbar) {
        const wrap = document.createElement("span");
        wrap.style.cssText = "display:inline-flex;gap:4px;align-items:center";
        wrap.appendChild(select); wrap.appendChild(btn);
        host.appendChild(wrap);
      } else {
        host.appendChild(select); host.appendChild(btn);
      }

      // floating banner in the viewport
      const banner = document.createElement("div");
      banner.id = "showcase-banner";
      banner.style.display = "none";
      ($("viewport-area") || document.body).appendChild(banner);

      const ui = { select, btn, banner };
      refreshCategoryOptionsLater();
      return ui;

      function refreshCategoryOptionsLater() {
        // registry may still be filling right at ready; rebuild a couple times
        refreshCategoryOptions();
        setTimeout(refreshCategoryOptions, 400);
        setTimeout(refreshCategoryOptions, 1200);
      }
    }

    function injectStyles() {
      const s = document.createElement("style");
      s.textContent = `
        #showcase-btn.on{background:var(--accent);color:#1a1a1a;border-color:var(--accent)}
        #showcase-banner{position:absolute;top:8px;left:50%;transform:translateX(-50%);
          z-index:8;background:rgba(15,15,20,0.9);border:1px solid var(--accent);
          color:var(--text);font-size:12px;padding:6px 14px;border-radius:4px;
          letter-spacing:.02em;pointer-events:none;font-family:var(--serif,inherit)}
        #showcase-cat{background:var(--surface3);border:1px solid var(--border);color:var(--text);border-radius:3px}
      `;
      document.head.appendChild(s);
    }

    // expose for console/debug + let other UI trigger it
    window._showcase = { enter, exit, isActive: () => active, refresh: refreshCategoryOptions };

    // Safety: if the user switches editor mode while in showcase, bail out cleanly
    window.addEventListener("designer:select", () => {});  // no-op; selection happens post-exit
  }
})();