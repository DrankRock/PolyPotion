// designer-params.js — Per-prefab parametric controls.
//
// A prefab can declare a `params` schema in its meta:
//   register("staircase", factory, {
//     icon: "📐", category: "architecture",
//     params: [
//       { key: "steps",      label: "Steps",     type: "int",    min: 2,  max: 30, default: 6 },
//       { key: "stepWidth",  label: "Width",     type: "number", min: .4, max: 4,  step: .1, default: 1.2 },
//       { key: "color",      label: "Color",     type: "color",  default: "#4a3018" },
//     ],
//   });
//
// When a prefab item is selected, those params render as sliders / colour
// pickers inside the Properties panel. Tweaking a value rebuilds the prefab
// in-place (position / rotation / scale are preserved) and updates the
// generated code so it gets emitted with `OBJECTS.create(name, opts)`.
//
// Lights added through extras2 (Point/Spot/Sun) get their own auto-built
// schema — intensity, colour, distance, cone angle, etc.

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;

    injectStyles();
    mountContainer();
    patchSync();

    function injectStyles() {
      const s = document.createElement("style");
      s.textContent = `
        #prefab-params{padding-top:4px}
        #prefab-params h4{font-family:var(--serif);font-size:13px;font-weight:400;color:var(--accent);margin-bottom:8px;letter-spacing:.02em}
        #prefab-params .pp-field{margin-bottom:8px}
        #prefab-params .pp-field label{display:block;font-size:10px;color:var(--text2);margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em}
        #prefab-params .pp-row{display:flex;gap:6px;align-items:center}
        #prefab-params input[type=range]{flex:1;accent-color:var(--accent)}
        #prefab-params .pp-val{font-size:11px;color:var(--text);font-family:var(--mono);min-width:46px;text-align:right;font-variant-numeric:tabular-nums}
        #prefab-params select,#prefab-params input[type=number]{padding:4px 6px;background:var(--surface3);border:1px solid var(--border);color:var(--text);font:inherit;font-size:11px;border-radius:3px;outline:none;width:100%}
        #prefab-params .cswatch{width:28px;height:28px;border-radius:3px;border:1px solid var(--border);cursor:pointer;display:inline-block;position:relative;overflow:hidden;flex:0 0 28px}
        #prefab-params .cswatch input[type=color]{position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer}
        #prefab-params .pp-reset{width:100%;margin-top:4px;padding:5px;font-size:11px;border:1px dashed var(--border);background:transparent;color:var(--text2);font:inherit;border-radius:3px;cursor:pointer}
        #prefab-params .pp-reset:hover{color:var(--accent);border-color:var(--accent)}
        #prefab-params .pp-bool{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text)}
      `;
      document.head.appendChild(s);
    }

    function mountContainer() {
      const pForm = document.getElementById("p-form");
      const primFields = document.getElementById("prim-fields");
      if (!pForm || !primFields) return;
      const sep = document.createElement("hr");
      sep.id = "prefab-params-sep";
      sep.style.cssText = "border:none;border-top:1px solid var(--border);margin:10px 0;display:none";
      const wrap = document.createElement("div");
      wrap.id = "prefab-params";
      wrap.style.display = "none";
      pForm.insertBefore(sep, primFields);
      pForm.insertBefore(wrap, primFields);
    }

    function patchSync() {
      const orig = _D.syncFromObj;
      _D.syncFromObj = function () {
        orig();
        renderParams();
      };
      // designer.html's selectItem() calls the IIFE-local syncFromObj
      // (not _D.syncFromObj), so patching the export above doesn't catch
      // selection changes. Listen for the event the core dispatches instead.
      window.addEventListener("designer:select", renderParams);
    }

    function renderParams() {
      const wrap = document.getElementById("prefab-params");
      const sep = document.getElementById("prefab-params-sep");
      if (!wrap) return;
      const e = _D.sel;
      const hide = () => { wrap.style.display = "none"; sep.style.display = "none"; };
      if (!e) return hide();
      if (e.isPrimitive || e.type === "group" || e.type === "imported") return hide();

      if (e._isLight) {
        renderLightParams(wrap);
        wrap.style.display = ""; sep.style.display = "";
        return;
      }

      const meta = _D.OBJ.list().find((o) => o.name === e.type);
      if (!meta || !Array.isArray(meta.params) || !meta.params.length) return hide();

      wrap.style.display = ""; sep.style.display = "";
      wrap.innerHTML = "";
      const title = document.createElement("h4");
      title.innerHTML = (meta.icon || "◆") + "  " + e.type;
      wrap.appendChild(title);

      const opts = (e.opts && typeof e.opts === "object") ? e.opts : (e.opts = {});

      meta.params.forEach((p) => {
        const cur = (opts[p.key] !== undefined) ? opts[p.key] : p.default;
        wrap.appendChild(buildField(p, cur, (newVal) => {
          opts[p.key] = newVal;
          rebuildPrefab(e, opts);
        }));
      });

      const reset = document.createElement("button");
      reset.className = "pp-reset";
      reset.textContent = "↺ reset to defaults";
      reset.onclick = () => {
        const fresh = {};
        meta.params.forEach((p) => { if (p.default !== undefined) fresh[p.key] = p.default; });
        e.opts = fresh;
        rebuildPrefab(e, fresh);
        renderParams();
      };
      wrap.appendChild(reset);
    }

    function buildField(p, cur, onChange) {
      const field = document.createElement("div");
      field.className = "pp-field";
      const labelText = p.label || p.key;
      const fid = "pp_" + p.key + "_" + Math.random().toString(36).slice(2,7);

      if (p.type === "color") {
        const swatch = (typeof cur === "number")
          ? "#" + cur.toString(16).padStart(6, "0")
          : (cur || "#aaaaaa");
        field.innerHTML = `
          <label>${labelText}</label>
          <div class="pp-row">
            <div class="cswatch" style="background:${swatch}">
              <input type="color" id="${fid}" value="${swatch}">
            </div>
            <span class="pp-val">${swatch}</span>
          </div>
        `;
        const inp = field.querySelector("input");
        const val = field.querySelector(".pp-val");
        const cs  = field.querySelector(".cswatch");
        inp.addEventListener("input", () => {
          cs.style.background = inp.value;
          val.textContent = inp.value;
          // Pass numeric hex (factories accept either, but numbers are conventional)
          onChange(parseInt(inp.value.slice(1), 16));
        });
        return field;
      }

      if (p.type === "bool") {
        field.innerHTML = `
          <label>${labelText}</label>
          <div class="pp-bool"><input type="checkbox" id="${fid}" ${cur ? "checked" : ""}><span>${cur ? "on" : "off"}</span></div>
        `;
        const inp = field.querySelector("input");
        const lbl = field.querySelector("span");
        inp.addEventListener("change", () => {
          lbl.textContent = inp.checked ? "on" : "off";
          onChange(inp.checked);
        });
        return field;
      }

      if (p.type === "select") {
        const optsHtml = (p.options || []).map((o) =>
          `<option value="${o}" ${o === cur ? "selected" : ""}>${o}</option>`).join("");
        field.innerHTML = `<label>${labelText}</label><select id="${fid}">${optsHtml}</select>`;
        const inp = field.querySelector("select");
        inp.addEventListener("change", () => onChange(inp.value));
        return field;
      }

      // number / int
      const step = p.step || (p.type === "int" ? 1 : 0.1);
      const min  = (p.min !== undefined) ? p.min : 0;
      const max  = (p.max !== undefined) ? p.max : 10;
      const fmt  = (v) => p.type === "int" ? Math.round(v) : (Math.round(v*100)/100).toFixed(2);
      field.innerHTML = `
        <label>${labelText}</label>
        <div class="pp-row">
          <input type="range" id="${fid}" min="${min}" max="${max}" step="${step}" value="${cur}">
          <span class="pp-val" id="${fid}_val">${fmt(cur)}</span>
        </div>
      `;
      const inp = field.querySelector("input");
      const val = field.querySelector(".pp-val");
      inp.addEventListener("input", () => {
        const v = p.type === "int" ? parseInt(inp.value) : parseFloat(inp.value);
        val.textContent = fmt(v);
        onChange(v);
      });
      return field;
    }

    // ── Rebuild a prefab in place when its params change ──
    let _rebuildTimer = null;
    function rebuildPrefab(entry, opts) {
      // Debounce so dragging a slider doesn't thrash GC
      clearTimeout(_rebuildTimer);
      _rebuildTimer = setTimeout(() => doRebuild(entry, opts), 30);
    }
    function doRebuild(entry, opts) {
      const old = entry.obj3d;
      const newObj = _D.OBJ.create(entry.type, opts);
      if (!newObj) return;
      newObj.name = entry.name;
      newObj.position.copy(old.position);
      newObj.rotation.copy(old.rotation);
      newObj.scale.copy(old.scale);
      newObj.visible = old.visible;
      _D.scene.remove(old);
      _D.disposeObj(old);
      _D.scene.add(newObj);
      entry.obj3d = newObj;
      entry.opts  = opts;
      if (_D.sel === entry) _D.gizmo.attach(newObj);
      _D.genCode();
    }

    // ── Light params (for entries added by extras2) ────
    function renderLightParams(wrap) {
      const e = _D.sel;
      const light = e._lightRef;
      if (!light) { wrap.innerHTML = ""; return; }
      wrap.innerHTML = "";
      const h = document.createElement("h4");
      h.textContent = "💡  " + (e.type || "light");
      wrap.appendChild(h);

      const params = [
        { key: "color", type: "color",
          get: () => "#" + light.color.getHexString(),
          set: (v) => light.color.set(v) },
        { key: "intensity", label: "Intensity", type: "number", min: 0, max: 5, step: 0.05,
          get: () => light.intensity,
          set: (v) => { light.intensity = v; } },
      ];
      if (light.distance !== undefined && light.isPointLight || light.isSpotLight) {
        params.push({ key: "distance", label: "Range (m)", type: "number", min: 0, max: 30, step: 0.5,
          get: () => light.distance, set: (v) => { light.distance = v; } });
      }
      if (light.decay !== undefined) {
        params.push({ key: "decay", label: "Decay", type: "number", min: 0, max: 3, step: 0.1,
          get: () => light.decay, set: (v) => { light.decay = v; } });
      }
      if (light.angle !== undefined) {
        params.push({ key: "angle", label: "Cone angle (rad)", type: "number", min: 0.05, max: Math.PI/2 - 0.05, step: 0.05,
          get: () => light.angle, set: (v) => { light.angle = v; } });
      }
      if (light.penumbra !== undefined) {
        params.push({ key: "penumbra", label: "Soft edge", type: "number", min: 0, max: 1, step: 0.02,
          get: () => light.penumbra, set: (v) => { light.penumbra = v; } });
      }

      const opts = e.opts || (e.opts = {});

      params.forEach((p) => {
        const cur = p.get();
        wrap.appendChild(buildField(
          { ...p, label: p.label || p.key, default: cur },
          cur,
          (v) => {
            if (p.type === "color") {
              // buildField gives us a number for color; light.color.set accepts hex strings or numbers
              p.set(v);
              opts[p.key] = "#" + v.toString(16).padStart(6, "0");
            } else {
              p.set(v);
              opts[p.key] = v;
            }
            if (e._lightHelper && e._lightHelper.update) e._lightHelper.update();
            _D.genCode();
          }
        ));
      });
    }
  }
})();
