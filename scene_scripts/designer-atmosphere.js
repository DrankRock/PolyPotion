// designer-atmosphere.js — Time-of-day, fog, post-processing overlays,
// and a scene-wide ticker so particle prefabs can animate.
//
// Adds an "Atmosphere" panel to the left sidebar with:
//   • Time of day slider (drives sun direction, color, intensity)
//   • Sun + ambient intensity multipliers
//   • Fog (off / linear / exponential), colour, density / distance
//   • Vignette intensity (CSS overlay)
//   • Grain intensity (animated CSS noise overlay)
//
// Also starts a global rAF loop that walks the scene each frame and calls
// `object.userData.tick(dt)` if present. Particle prefabs (registered in
// data/objects.js) use this so they animate continuously, including during
// cinema playback / WebM recording.

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;

    // Find the existing default lights (created in designer.html). The sun
    // is the first DirectionalLight; ambient is the AmbientLight.
    let sunLight = null, ambientLight = null;
    _D.scene.traverse((o) => {
      if (o.isDirectionalLight && !sunLight) sunLight = o;
      if (o.isAmbientLight && !ambientLight) ambientLight = o;
    });
    // Remember the original "neutral" settings so the UI can show defaults.
    const baseSunIntensity = sunLight ? sunLight.intensity : 1.2;
    const baseAmbIntensity = ambientLight ? ambientLight.intensity : 0.4;

    const state = window._atmos = {
      hour: 14,          // 0..24
      sunMul: 1.0,
      ambMul: 1.0,
      fog: { type: "off", color: "#1a1612", near: 5, far: 40, density: 0.04 },
      vignette: 0,       // 0..1
      grain: 0,
    };

    injectStyles();
    addPanel();
    addOverlays();
    startTicker();
    applyAll();          // initial paint

    // ── styles ─────────────────────────────────────────
    function injectStyles() {
      const s = document.createElement("style");
      s.textContent = `
        #fx-vignette,#fx-grain{position:absolute;inset:0;pointer-events:none;z-index:4}
        #fx-vignette{background:radial-gradient(ellipse at center, transparent 35%, #000 110%);mix-blend-mode:multiply;opacity:0;transition:opacity .15s}
        #fx-grain{
          background-image:
            url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.95' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1   0 0 0 0 1   0 0 0 0 1   0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
          mix-blend-mode:overlay;opacity:0;animation:grainShift 0.25s steps(3) infinite;
        }
        @keyframes grainShift{
          0%{transform:translate(0,0)}
          33%{transform:translate(-1.5%,1.5%)}
          66%{transform:translate(2%,-1%)}
        }
        #sec-atmos h3{margin-bottom:8px}
        #sec-atmos .atm-row{display:flex;gap:6px;align-items:center;margin-top:6px}
        #sec-atmos .atm-row label{font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;min-width:64px}
        #sec-atmos .atm-row input[type=range]{flex:1;accent-color:var(--accent)}
        #sec-atmos .atm-row .atm-val{font-family:var(--mono);font-size:11px;color:var(--text);min-width:48px;text-align:right;font-variant-numeric:tabular-nums}
        #sec-atmos select,#sec-atmos input[type=number]{padding:4px 6px;background:var(--surface3);border:1px solid var(--border);color:var(--text);font:inherit;font-size:11px;border-radius:3px;outline:none}
        #sec-atmos .atm-tod{height:6px;margin-top:4px;border-radius:3px;background:linear-gradient(to right,
          #0a1428 0%, #1a2238 20%, #f29050 28%, #f6c25a 38%, #e8e0c4 50%, #f6c25a 62%, #f29050 72%, #2a1a30 80%, #0a1428 100%);}
        #sec-atmos .atm-presets{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}
        #sec-atmos .atm-presets button{padding:3px 8px;font-size:10px;background:var(--surface2);border:1px solid var(--border);color:var(--text2);font:inherit;cursor:pointer;border-radius:3px}
        #sec-atmos .atm-presets button:hover{color:var(--accent);border-color:var(--accent)}
      `;
      document.head.appendChild(s);
    }

    function addOverlays() {
      const vp = document.getElementById("viewport-area");
      const vig = document.createElement("div"); vig.id = "fx-vignette"; vp.appendChild(vig);
      const grain = document.createElement("div"); grain.id = "fx-grain"; vp.appendChild(grain);
    }

    // ── panel ──────────────────────────────────────────
    function addPanel() {
      const anchor = document.getElementById("sec-floors") || document.getElementById("room-cfg");
      const sec = document.createElement("div");
      sec.className = "psec";
      sec.id = "sec-atmos";
      sec.innerHTML = `
        <h3>Atmosphere</h3>
        <div class="atm-row">
          <label>Hour</label>
          <input type="range" id="atm-hour" min="0" max="23.99" step="0.25" value="${state.hour}">
          <span class="atm-val" id="atm-hour-val">${fmtHour(state.hour)}</span>
        </div>
        <div class="atm-tod"></div>

        <div class="atm-presets">
          <button data-h="7">Sunrise</button>
          <button data-h="13">Noon</button>
          <button data-h="18.5">Sunset</button>
          <button data-h="21">Dusk</button>
          <button data-h="2">Night</button>
        </div>

        <div class="atm-row">
          <label>Sun ×</label>
          <input type="range" id="atm-sun" min="0" max="3" step="0.05" value="${state.sunMul}">
          <span class="atm-val" id="atm-sun-val">${state.sunMul.toFixed(2)}</span>
        </div>
        <div class="atm-row">
          <label>Ambient ×</label>
          <input type="range" id="atm-amb" min="0" max="3" step="0.05" value="${state.ambMul}">
          <span class="atm-val" id="atm-amb-val">${state.ambMul.toFixed(2)}</span>
        </div>

        <div class="atm-row">
          <label>Fog</label>
          <select id="atm-fog-type">
            <option value="off">off</option>
            <option value="linear">linear</option>
            <option value="exp">exponential</option>
          </select>
          <div class="cswatch" style="background:${state.fog.color};flex:0 0 24px;height:24px;border-radius:3px;border:1px solid var(--border);position:relative;overflow:hidden">
            <input type="color" id="atm-fog-col" value="${state.fog.color}" style="position:absolute;inset:0;opacity:0;cursor:pointer">
          </div>
        </div>
        <div class="atm-row" id="atm-fog-linear" style="display:none">
          <label>Near / Far</label>
          <input type="number" id="atm-fog-near" min="0" max="100" step="0.5" value="${state.fog.near}" style="width:60px">
          <input type="number" id="atm-fog-far"  min="1" max="200" step="1"   value="${state.fog.far}"  style="width:60px">
        </div>
        <div class="atm-row" id="atm-fog-exp" style="display:none">
          <label>Density</label>
          <input type="range" id="atm-fog-density" min="0" max="0.2" step="0.005" value="${state.fog.density}">
          <span class="atm-val" id="atm-fog-density-val">${state.fog.density.toFixed(3)}</span>
        </div>

        <div class="atm-row">
          <label>Vignette</label>
          <input type="range" id="atm-vig" min="0" max="1" step="0.02" value="${state.vignette}">
          <span class="atm-val" id="atm-vig-val">${state.vignette.toFixed(2)}</span>
        </div>
        <div class="atm-row">
          <label>Grain</label>
          <input type="range" id="atm-grain" min="0" max="1" step="0.02" value="${state.grain}">
          <span class="atm-val" id="atm-grain-val">${state.grain.toFixed(2)}</span>
        </div>
      `;
      // Insert after the cinema panel if found, otherwise after env, otherwise after room
      anchor.parentNode.insertBefore(sec, anchor.nextSibling);

      const $ = (id) => document.getElementById(id);
      const bind = (id, key, parse=parseFloat, lblId=id+"-val", fmt=(v)=>v.toFixed(2)) => {
        $(id).addEventListener("input", () => {
          const v = parse($(id).value);
          if (key.includes(".")) {
            const [a,b] = key.split(".");
            state[a][b] = v;
          } else state[key] = v;
          if (lblId && $(lblId)) $(lblId).textContent = fmt(v);
          applyAll();
        });
      };
      bind("atm-hour", "hour", parseFloat, "atm-hour-val", fmtHour);
      bind("atm-sun", "sunMul");
      bind("atm-amb", "ambMul");
      bind("atm-vig", "vignette");
      bind("atm-grain", "grain");

      $("atm-fog-type").addEventListener("change", () => {
        state.fog.type = $("atm-fog-type").value;
        $("atm-fog-linear").style.display = state.fog.type === "linear" ? "flex" : "none";
        $("atm-fog-exp").style.display    = state.fog.type === "exp" ? "flex" : "none";
        applyAll();
      });
      $("atm-fog-col").addEventListener("input", () => {
        state.fog.color = $("atm-fog-col").value;
        $("atm-fog-col").parentElement.style.background = state.fog.color;
        applyAll();
      });
      $("atm-fog-near").addEventListener("input", () => {
        state.fog.near = parseFloat($("atm-fog-near").value); applyAll();
      });
      $("atm-fog-far").addEventListener("input", () => {
        state.fog.far = parseFloat($("atm-fog-far").value); applyAll();
      });
      $("atm-fog-density").addEventListener("input", () => {
        state.fog.density = parseFloat($("atm-fog-density").value);
        $("atm-fog-density-val").textContent = state.fog.density.toFixed(3);
        applyAll();
      });

      sec.querySelectorAll(".atm-presets button").forEach((b) => {
        b.addEventListener("click", () => {
          state.hour = parseFloat(b.dataset.h);
          $("atm-hour").value = state.hour;
          $("atm-hour-val").textContent = fmtHour(state.hour);
          applyAll();
        });
      });
    }

    function fmtHour(h) {
      const hh = Math.floor(h);
      const mm = Math.round((h - hh) * 60);
      return String(hh).padStart(2,"0") + ":" + String(mm).padStart(2,"0");
    }

    // ── apply state to scene + DOM ─────────────────────
    function applyAll() {
      applySunAndAmbient();
      applyFog();
      applyOverlays();
    }

    function applySunAndAmbient() {
      // Map hour 0..24 to an angle: 6 = sunrise (east, low), 12 = noon (overhead),
      // 18 = sunset (west, low), 0 = midnight (below).
      const h = state.hour;
      // angle in radians along east-west arc
      const phase = ((h - 6) / 12) * Math.PI; // 6 -> 0, 12 -> π/2, 18 -> π, 0/24 -> -π/2 or 3π/2
      const elev = Math.sin(phase); // 1 at noon, 0 at sunrise/set, -1 at midnight
      const azim = -Math.cos(phase); // -1 at sunrise (east), 0 at noon, +1 at sunset (west)

      const distance = 25;
      const sunY = Math.max(-distance*0.4, elev * distance);
      const sunX = azim * distance * 0.6;
      const sunZ = 6; // slight south to give nicer shadows

      // Colour: warm at horizon, cool white at noon, deep blue at night
      let cR, cG, cB, intensityScale;
      if (elev > 0.4) {
        // High sun: clean daylight
        cR = 1.00; cG = 0.97; cB = 0.92;
        intensityScale = 1.0;
      } else if (elev > 0.05) {
        // Golden hour: warm
        const t = (elev - 0.05) / 0.35; // 0 at horizon, 1 at high
        cR = 1.00;
        cG = 0.70 + 0.27 * t;
        cB = 0.40 + 0.52 * t;
        intensityScale = 0.55 + 0.45 * t;
      } else if (elev > -0.1) {
        // Twilight: pinks and purples
        const t = (elev + 0.1) / 0.15; // 0 at low twilight, 1 approaching horizon
        cR = 0.50 + 0.50 * t;
        cG = 0.30 + 0.40 * t;
        cB = 0.45 + 0.05 * t;
        intensityScale = 0.10 + 0.30 * t;
      } else {
        // Night: cool, very dim
        cR = 0.18; cG = 0.25; cB = 0.45;
        intensityScale = 0.05;
      }

      if (sunLight) {
        sunLight.position.set(sunX, sunY, sunZ);
        sunLight.color.setRGB(cR, cG, cB);
        sunLight.intensity = baseSunIntensity * intensityScale * state.sunMul;
      }
      if (ambientLight) {
        // Ambient warms toward sunset, cools to deep blue at night, neutral noon
        if (elev > 0.4) {
          ambientLight.color.setRGB(1, 0.98, 0.95);
          ambientLight.intensity = baseAmbIntensity * 1.0 * state.ambMul;
        } else if (elev > 0.05) {
          ambientLight.color.setRGB(0.95, 0.78, 0.62);
          ambientLight.intensity = baseAmbIntensity * 0.8 * state.ambMul;
        } else if (elev > -0.1) {
          ambientLight.color.setRGB(0.45, 0.35, 0.55);
          ambientLight.intensity = baseAmbIntensity * 0.5 * state.ambMul;
        } else {
          ambientLight.color.setRGB(0.20, 0.25, 0.45);
          ambientLight.intensity = baseAmbIntensity * 0.35 * state.ambMul;
        }
      }

      // Scene background — if no sky texture is loaded, tint the bg too
      if (!(_D.scene.background && _D.scene.background.isTexture)) {
        const skyR = clamp(cR * 0.25 + 0.04);
        const skyG = clamp(cG * 0.25 + 0.04);
        const skyB = clamp(cB * 0.30 + 0.05);
        if (_D.scene.background && _D.scene.background.isColor) {
          _D.scene.background.setRGB(skyR, skyG, skyB);
        } else {
          _D.scene.background = new THREE.Color(skyR, skyG, skyB);
        }
      }
    }

    function clamp(v) { return Math.max(0, Math.min(1, v)); }

    function applyFog() {
      const col = parseInt(state.fog.color.replace("#",""), 16);
      if (state.fog.type === "linear") {
        _D.scene.fog = new THREE.Fog(col, state.fog.near, state.fog.far);
      } else if (state.fog.type === "exp") {
        _D.scene.fog = new THREE.FogExp2(col, state.fog.density);
      } else {
        _D.scene.fog = null;
      }
    }

    function applyOverlays() {
      const vig = document.getElementById("fx-vignette");
      const grain = document.getElementById("fx-grain");
      if (vig)   vig.style.opacity   = state.vignette;
      if (grain) grain.style.opacity = state.grain;
    }

    // ── global ticker for particle prefabs and animated userData ──
    function startTicker() {
      let last = performance.now();
      function tick() {
        requestAnimationFrame(tick);
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        if (dt <= 0) return;
        _D.scene.traverse((o) => {
          if (o.userData && typeof o.userData.tick === "function") o.userData.tick(dt);
        });
      }
      tick();
    }

    // Public helpers (for save/load to read & restore atmosphere)
    window._atmos.applyAll = applyAll;
  }
})();
