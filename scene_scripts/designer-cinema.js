// designer-cinema.js — 360° environments + cinematic recorder + object keyframes.
//
//   • 360° skybox: drop an equirectangular PNG/JPG and the scene wraps in it.
//   • Cinema: capture camera waypoints, play them back as a smooth path,
//     record the viewport as a WebM video.
//   • Per-object keyframes: pick an object, scrub the timeline, add poses.
//     They tween together with the camera during cinema playback.
//
// All UI is injected; no edits required to designer.html beyond the script tag.

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;
    const $ = _D.$;

    // ── module state ───────────────────────────────────
    const state = {
      // Cinema
      waypoints: [],          // [{pos:Vec3, target:Vec3, fov:N, dur:N, ease:'in-out'}]
      playing: false,
      recording: false,
      loop: false,
      currentTime: 0,
      totalDur: 0,
      playFromCam: null,      // saved camera state for restoration
      playFromTarget: null,
      playFromFov: null,
      recorder: null,
      recChunks: [],
      // Environment
      skyTexture: null,
      skyIntensity: 1.0,
      // Animation tracks per item id
      // { itemId: [{t:seconds, px,py,pz, rx,ry,rz, sx,sy,sz}] }
      tracks: {},
      // Original poses (so we restore after playback)
      origPoses: {},
    };
    window._cinema = state;

    injectStyles();
    addEnvironmentPanel();
    addCinemaPanel();
    addObjectKeyframeRow();
    hookRenderLoop();

    // ── styles ─────────────────────────────────────────
    function injectStyles() {
      const s = document.createElement("style");
      s.textContent = `
        #sec-env .drop-zone, #sec-cine .drop-zone{padding:14px 10px}
        #sec-env .row, #sec-cine .row{display:flex;gap:6px;align-items:center;margin-top:6px}
        #wp-list{max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;margin-top:6px;background:var(--surface3)}
        #wp-list:empty::before{content:"no waypoints yet — add one to start";font-size:10px;color:var(--text2);padding:10px;display:block;text-align:center}
        .wp-row{display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--border);font-size:11px;color:var(--text)}
        .wp-row:last-child{border-bottom:none}
        .wp-row.active{background:rgba(212,163,115,0.18)}
        .wp-row .wpi{font-family:var(--mono);color:var(--accent);width:18px;text-align:center;font-size:10px}
        .wp-row .wp-dur{width:50px;padding:1px 4px;background:var(--surface);border:1px solid var(--border);color:var(--text);font:inherit;font-size:11px;border-radius:2px;text-align:right}
        .wp-row .wp-ease{flex:1;min-width:0;padding:1px 2px;background:var(--surface);border:1px solid var(--border);color:var(--text);font:inherit;font-size:10px;border-radius:2px}
        .wp-row .wp-x{background:none;border:none;color:var(--danger);cursor:pointer;font-size:14px;padding:0 2px;line-height:1;opacity:.5}
        .wp-row .wp-x:hover{opacity:1}
        .wp-row .wp-go{background:none;border:1px solid var(--border);color:var(--text2);cursor:pointer;font-size:10px;padding:0 5px;border-radius:2px}
        .wp-row .wp-go:hover{color:var(--accent);border-color:var(--accent)}
        #cine-timeline{margin-top:8px;height:8px;background:var(--surface3);border-radius:4px;position:relative;cursor:pointer;overflow:hidden}
        #cine-timeline .fill{position:absolute;left:0;top:0;bottom:0;background:var(--accent);transition:none;border-radius:4px}
        #cine-timeline .marks{position:absolute;inset:0;pointer-events:none}
        #cine-timeline .mk{position:absolute;top:0;bottom:0;width:1px;background:var(--text2);opacity:.6}
        #cine-time-lbl{font-size:10px;color:var(--text2);margin-top:4px;font-family:var(--mono);display:flex;justify-content:space-between}
        .cine-btn{flex:1;padding:6px 8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font:inherit;font-size:11px;cursor:pointer;border-radius:4px;transition:all .12s;text-align:center}
        .cine-btn:hover{border-color:var(--accent);color:var(--accent)}
        .cine-btn.on,.cine-btn.primary{border-color:var(--accent);color:var(--bg);background:var(--accent)}
        .cine-btn.danger.on{background:var(--danger);border-color:var(--danger);color:#fff;animation:rec-pulse 1.2s ease-in-out infinite}
        @keyframes rec-pulse { 50%{opacity:.55} }
        .cine-btn.sm{padding:3px 8px;font-size:10px;flex:0 0 auto}
        #rec-banner{position:absolute;top:50px;left:50%;transform:translateX(-50%);background:var(--danger);color:#fff;font:inherit;font-size:11px;padding:5px 14px;border-radius:14px;z-index:12;display:none;letter-spacing:.06em;animation:rec-pulse 1.2s ease-in-out infinite}
        #rec-banner.on{display:block}
        #rec-banner::before{content:"● ";color:#fff}
        #sky-preview{display:none;width:100%;height:60px;background-size:cover;background-position:center;border-radius:4px;margin-top:6px;border:1px solid var(--border);position:relative}
        #sky-preview.on{display:block}
        #sky-preview .clr{position:absolute;top:4px;right:4px;background:rgba(0,0,0,.6);border:none;color:#fff;cursor:pointer;font-size:10px;padding:2px 6px;border-radius:2px}
        #sky-preview .clr:hover{background:var(--danger)}
        .kf-pill{display:inline-block;background:var(--surface3);color:var(--accent);font-size:10px;padding:1px 6px;border-radius:8px;margin-right:4px;font-family:var(--mono);cursor:pointer;border:1px solid transparent}
        .kf-pill:hover{border-color:var(--accent)}
        .kf-pill.active{background:var(--accent);color:var(--bg)}
        #obj-kf-row{padding:8px 12px;border-top:1px dashed var(--border);font-size:11px}
        #obj-kf-row .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);margin-bottom:4px;display:block}
        #obj-kf-row .row{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-top:4px}
        #obj-kf-row .row button{padding:3px 8px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);font:inherit;font-size:10px;cursor:pointer;border-radius:3px}
        #obj-kf-row .row button:hover{color:var(--accent);border-color:var(--accent)}
        .util-row{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:6px}
        .util-row.three{grid-template-columns:1fr 1fr 1fr}
        .util-btn{padding:5px 6px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font:inherit;font-size:10px;cursor:pointer;border-radius:3px;transition:all .12s}
        .util-btn:hover{border-color:var(--accent);color:var(--accent)}
        .util-cap{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--text2);margin-top:8px;display:block}
        .num-mini{width:46px;padding:3px 5px;background:var(--surface3);border:1px solid var(--border);color:var(--text);font:inherit;font-size:11px;border-radius:3px;text-align:right}
      `;
      document.head.appendChild(s);
    }

    // ─────────────────────────────────────────────────
    // 360° ENVIRONMENT
    // ─────────────────────────────────────────────────
    function addEnvironmentPanel() {
      const left = document.getElementById("left-panel");
      // Place after Room Shell config — find the room-cfg section and insert after.
      const anchor = document.getElementById("room-cfg");
      const sec = document.createElement("div");
      sec.className = "psec";
      sec.id = "sec-env";
      sec.innerHTML = `
        <h3>360° Environment</h3>
        <div class="drop-zone" id="sky-drop">
          <input type="file" id="sky-input" accept="image/png,image/jpeg,image/jpg,image/webp">
          <span class="dz-icon">🌅</span>
          Drop a 360° panorama (PNG/JPG)
          <span class="dz-hint">equirectangular · 2:1 ratio</span>
        </div>
        <div id="sky-preview"><button class="clr" id="sky-clear">✕ clear</button></div>
        <div class="row">
          <label style="flex:0 0 auto;font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Brightness</label>
          <input type="range" id="sky-intensity" min="0" max="2" step="0.05" value="1" style="flex:1">
          <span id="sky-int-val" style="font-size:10px;color:var(--text2);min-width:30px;text-align:right">1.0×</span>
        </div>
        <div class="row">
          <button class="cine-btn sm" id="sky-hide-walls" title="Hide walls so the 360° is visible">Hide walls</button>
          <button class="cine-btn sm" id="sky-show-walls" title="Restore walls">Show walls</button>
        </div>
      `;
      anchor.parentNode.insertBefore(sec, anchor.nextSibling);

      const drop = document.getElementById("sky-drop");
      const input = document.getElementById("sky-input");
      ["dragenter","dragover"].forEach(ev => drop.addEventListener(ev, e => {
        e.preventDefault(); e.stopPropagation(); drop.classList.add("over");
      }));
      ["dragleave","drop"].forEach(ev => drop.addEventListener(ev, e => {
        e.preventDefault(); e.stopPropagation(); drop.classList.remove("over");
      }));
      drop.addEventListener("drop", e => {
        const f = e.dataTransfer.files[0]; if (f) loadSky(f);
      });
      input.addEventListener("change", () => { if (input.files[0]) loadSky(input.files[0]); input.value=""; });

      document.getElementById("sky-clear").onclick = clearSky;
      const intRange = document.getElementById("sky-intensity");
      intRange.addEventListener("input", () => {
        state.skyIntensity = parseFloat(intRange.value);
        document.getElementById("sky-int-val").textContent = state.skyIntensity.toFixed(2)+"×";
        _D.renderer.toneMappingExposure = 0.9 * state.skyIntensity;
      });

      document.getElementById("sky-hide-walls").onclick = () => { _D.shell.visible = false; };
      document.getElementById("sky-show-walls").onclick = () => { _D.shell.visible = true; };
    }

    function loadSky(file) {
      const url = URL.createObjectURL(file);
      const loader = new THREE.TextureLoader();
      loader.load(url, (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.encoding = THREE.sRGBEncoding;
        // Dispose previous
        if (state.skyTexture) state.skyTexture.dispose();
        state.skyTexture = tex;
        _D.scene.background = tex;
        _D.scene.environment = tex;
        document.getElementById("sky-preview").classList.add("on");
        document.getElementById("sky-preview").style.backgroundImage = `url(${url})`;
      }, undefined, () => {
        alert("Could not load that image as a 360° texture.");
        URL.revokeObjectURL(url);
      });
    }
    function clearSky() {
      if (state.skyTexture) { state.skyTexture.dispose(); state.skyTexture = null; }
      _D.scene.background = new THREE.Color(0x0e0d0c);
      _D.scene.environment = null;
      document.getElementById("sky-preview").classList.remove("on");
      document.getElementById("sky-preview").style.backgroundImage = "";
    }

    // ─────────────────────────────────────────────────
    // CINEMA PANEL (waypoints + playback + recording)
    // ─────────────────────────────────────────────────
    function addCinemaPanel() {
      const left = document.getElementById("left-panel");
      const anchor = document.getElementById("sec-env");
      const sec = document.createElement("div");
      sec.className = "psec";
      sec.id = "sec-cine";
      sec.innerHTML = `
        <h3>Cinema</h3>
        <p style="font-size:10px;color:var(--text2);line-height:1.4;margin-bottom:6px">
          Frame a shot in the viewport, then "Add waypoint". Repeat for each beat.
          Play tweens between them. Record exports a WebM you can drop into anything.
        </p>
        <div class="row">
          <button class="cine-btn" id="cine-add">＋ Add waypoint</button>
        </div>
        <div id="wp-list"></div>
        <div id="cine-timeline"><div class="fill"></div><div class="marks"></div></div>
        <div id="cine-time-lbl"><span id="cine-t">0.0s</span><span id="cine-tot">0.0s</span></div>
        <div class="row">
          <button class="cine-btn primary" id="cine-play">▶ Play</button>
          <button class="cine-btn" id="cine-loop">↺</button>
        </div>
        <div class="row">
          <button class="cine-btn danger" id="cine-rec">● Record WebM</button>
          <select id="cine-res" style="padding:5px;background:var(--surface3);border:1px solid var(--border);color:var(--text);font:inherit;font-size:11px;border-radius:3px">
            <option value="0">native</option>
            <option value="1280x720">720p</option>
            <option value="1920x1080" selected>1080p</option>
            <option value="2560x1440">1440p</option>
          </select>
        </div>
        <div class="row">
          <button class="cine-btn sm" id="cine-clear">Clear all</button>
          <button class="cine-btn sm" id="cine-export">Export JSON</button>
          <button class="cine-btn sm" id="cine-import">Import JSON</button>
        </div>
      `;
      anchor.parentNode.insertBefore(sec, anchor.nextSibling);

      document.getElementById("cine-add").onclick = addWaypoint;
      document.getElementById("cine-play").onclick = togglePlay;
      document.getElementById("cine-loop").onclick = () => {
        state.loop = !state.loop;
        document.getElementById("cine-loop").classList.toggle("on", state.loop);
      };
      document.getElementById("cine-rec").onclick = toggleRecord;
      document.getElementById("cine-clear").onclick = () => {
        if (!state.waypoints.length) return;
        if (!confirm("Clear all waypoints?")) return;
        state.waypoints = []; state.tracks = {}; renderWaypoints();
      };
      document.getElementById("cine-export").onclick = exportTrack;
      document.getElementById("cine-import").onclick = importTrack;

      // Timeline click → scrub
      const tl = document.getElementById("cine-timeline");
      tl.addEventListener("click", (e) => {
        if (!state.totalDur) return;
        const r = tl.getBoundingClientRect();
        const k = (e.clientX - r.left) / r.width;
        state.currentTime = k * state.totalDur;
        applyTime(state.currentTime, true);
        renderTimeline();
      });

      // Red banner during recording
      const vp = document.getElementById("viewport-area");
      const banner = document.createElement("div");
      banner.id = "rec-banner";
      banner.textContent = "REC — cinema is recording";
      vp.appendChild(banner);

      renderWaypoints();
      renderTimeline();
    }

    function addWaypoint() {
      const cam = _D.camera, orb = _D.orbit;
      const wp = {
        pos: cam.position.clone(),
        target: orb.target.clone(),
        fov: cam.fov,
        dur: state.waypoints.length === 0 ? 0 : 2.5, // first is start
        ease: "in-out",
      };
      state.waypoints.push(wp);
      renderWaypoints();
    }

    function renderWaypoints() {
      const ul = document.getElementById("wp-list");
      ul.innerHTML = "";
      state.totalDur = 0;
      state.waypoints.forEach((wp, i) => {
        state.totalDur += (i === 0 ? 0 : (wp.dur || 0));
        const row = document.createElement("div");
        row.className = "wp-row";
        row.innerHTML = `
          <span class="wpi">${String(i+1).padStart(2,"0")}</span>
          ${i === 0 ? '<span style="font-size:9px;color:var(--text2)">start</span>' :
          `<input class="wp-dur" type="number" min="0.1" step="0.1" value="${wp.dur}">s
          <select class="wp-ease">
            <option value="linear">linear</option>
            <option value="in-out" ${wp.ease==='in-out'?'selected':''}>in-out</option>
            <option value="in">in</option>
            <option value="out">out</option>
          </select>`}
          <button class="wp-go" title="Jump to this view">↗</button>
          <button class="wp-x">✕</button>
        `;
        const durInp = row.querySelector(".wp-dur");
        if (durInp) durInp.onchange = () => { wp.dur = parseFloat(durInp.value)||0; renderWaypoints(); };
        const easeSel = row.querySelector(".wp-ease");
        if (easeSel) easeSel.onchange = () => { wp.ease = easeSel.value; };
        row.querySelector(".wp-go").onclick = () => jumpTo(i);
        row.querySelector(".wp-x").onclick = () => {
          state.waypoints.splice(i,1); renderWaypoints();
        };
        ul.appendChild(row);
      });
      document.getElementById("cine-tot").textContent = state.totalDur.toFixed(1)+"s";
      renderTimeline();
    }

    function renderTimeline() {
      const fill = document.querySelector("#cine-timeline .fill");
      const marks = document.querySelector("#cine-timeline .marks");
      const t = state.totalDur > 0 ? Math.min(1, state.currentTime/state.totalDur) : 0;
      fill.style.width = (t*100)+"%";
      marks.innerHTML = "";
      let acc = 0;
      state.waypoints.forEach((wp, i) => {
        if (i > 0) acc += wp.dur||0;
        if (state.totalDur > 0) {
          const m = document.createElement("div");
          m.className = "mk";
          m.style.left = (acc/state.totalDur*100)+"%";
          marks.appendChild(m);
        }
      });
      document.getElementById("cine-t").textContent = state.currentTime.toFixed(1)+"s";
      // Active row highlighting
      const idx = currentSegmentIndex(state.currentTime);
      [...document.querySelectorAll("#wp-list .wp-row")].forEach((r, i) => {
        r.classList.toggle("active", i === idx);
      });
    }

    function jumpTo(i) {
      const wp = state.waypoints[i]; if (!wp) return;
      _D.camera.position.copy(wp.pos);
      _D.orbit.target.copy(wp.target);
      _D.camera.fov = wp.fov || 45;
      _D.camera.updateProjectionMatrix();
      _D.orbit.update();
    }

    function ease(t, kind) {
      if (kind === "linear") return t;
      if (kind === "in") return t*t*t;
      if (kind === "out") return 1-Math.pow(1-t, 3);
      // in-out (smoothstep cubic)
      return t<.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3)/2;
    }

    // Find which segment a time falls in. Returns 0..waypoints.length-2 or the last index.
    function currentSegmentIndex(t) {
      if (state.waypoints.length < 2) return 0;
      let acc = 0;
      for (let i = 1; i < state.waypoints.length; i++) {
        acc += state.waypoints[i].dur || 0;
        if (t <= acc + 1e-6) return i-1;
      }
      return state.waypoints.length - 2;
    }

    function applyTime(t, scrubOnly) {
      if (state.waypoints.length < 2) {
        if (state.waypoints.length === 1) jumpTo(0);
        return;
      }
      let acc = 0;
      for (let i = 1; i < state.waypoints.length; i++) {
        const segDur = state.waypoints[i].dur || 0;
        if (segDur <= 0) continue;
        if (t <= acc + segDur + 1e-6) {
          const a = state.waypoints[i-1], b = state.waypoints[i];
          const k = ease(Math.max(0,Math.min(1, (t-acc)/segDur)), b.ease||"in-out");
          _D.camera.position.lerpVectors(a.pos, b.pos, k);
          _D.orbit.target.lerpVectors(a.target, b.target, k);
          _D.camera.fov = a.fov + (b.fov - a.fov) * k;
          _D.camera.updateProjectionMatrix();
          _D.orbit.update();
          break;
        }
        acc += segDur;
      }
      // Apply object animation tracks too
      applyTracksAt(t);
    }

    function togglePlay() {
      if (state.playing) {
        stopPlayback();
      } else {
        if (state.waypoints.length < 2) {
          alert("Need at least 2 waypoints to play.");
          return;
        }
        startPlayback();
      }
    }

    function startPlayback() {
      // Snapshot current camera so we can restore
      state.playFromCam = _D.camera.position.clone();
      state.playFromTarget = _D.orbit.target.clone();
      state.playFromFov = _D.camera.fov;
      // Snapshot object poses for restoration
      state.origPoses = {};
      _D.items.forEach((it) => {
        state.origPoses[it.id] = {
          px: it.obj3d.position.x, py: it.obj3d.position.y, pz: it.obj3d.position.z,
          rx: it.obj3d.rotation.x, ry: it.obj3d.rotation.y, rz: it.obj3d.rotation.z,
          sx: it.obj3d.scale.x, sy: it.obj3d.scale.y, sz: it.obj3d.scale.z,
        };
      });
      state.currentTime = 0;
      state.playing = true;
      state.lastTick = performance.now();
      _D.orbit.enabled = false;
      _D.gizmo.detach();
      document.getElementById("cine-play").innerHTML = "■ Stop";
    }

    function stopPlayback() {
      state.playing = false;
      _D.orbit.enabled = true;
      document.getElementById("cine-play").innerHTML = "▶ Play";
      // Restore camera + object poses
      if (state.playFromCam) {
        _D.camera.position.copy(state.playFromCam);
        _D.orbit.target.copy(state.playFromTarget);
        _D.camera.fov = state.playFromFov || 45;
        _D.camera.updateProjectionMatrix();
        _D.orbit.update();
      }
      _D.items.forEach((it) => {
        const p = state.origPoses[it.id]; if (!p) return;
        it.obj3d.position.set(p.px, p.py, p.pz);
        it.obj3d.rotation.set(p.rx, p.ry, p.rz);
        it.obj3d.scale.set(p.sx, p.sy, p.sz);
      });
      if (state.recording) stopRecording();
    }

    function hookRenderLoop() {
      // Piggyback on requestAnimationFrame
      function tick(now) {
        requestAnimationFrame(tick);
        if (!state.playing) return;
        const dt = (now - (state.lastTick||now)) / 1000;
        state.lastTick = now;
        state.currentTime += dt;
        if (state.currentTime >= state.totalDur) {
          if (state.loop) {
            state.currentTime = 0;
          } else {
            state.currentTime = state.totalDur;
            applyTime(state.currentTime);
            renderTimeline();
            stopPlayback();
            return;
          }
        }
        applyTime(state.currentTime);
        renderTimeline();
      }
      requestAnimationFrame(tick);
    }

    // ─────────────────────────────────────────────────
    // RECORDING (canvas → WebM via MediaRecorder)
    // ─────────────────────────────────────────────────
    function toggleRecord() {
      if (state.recording) stopRecording();
      else startRecording();
    }

    function startRecording() {
      if (state.waypoints.length < 2) {
        alert("Add at least 2 waypoints first."); return;
      }
      const canvas = _D.renderer.domElement;
      let stream;
      try { stream = canvas.captureStream(60); }
      catch (e) { alert("Recording not supported in this browser."); return; }

      // Pick the best codec we can
      const candidates = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      let mimeType = candidates.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
      if (!mimeType) { alert("This browser can't record WebM."); return; }

      // Optionally resize canvas for higher-res capture
      const resSel = document.getElementById("cine-res").value;
      let origW, origH;
      if (resSel !== "0") {
        const [w,h] = resSel.split("x").map(Number);
        origW = canvas.width; origH = canvas.height;
        _D.renderer.setSize(w, h, false);
        _D.camera.aspect = w/h;
        _D.camera.updateProjectionMatrix();
      }
      state._restoreSize = origW ? { w: origW, h: origH } : null;

      state.recChunks = [];
      state.recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
      state.recorder.ondataavailable = (e) => { if (e.data.size) state.recChunks.push(e.data); };
      state.recorder.onstop = finalizeRecording;
      state.recorder.start(100); // collect chunks every 100ms
      state.recording = true;
      document.getElementById("cine-rec").classList.add("on");
      document.getElementById("cine-rec").innerHTML = "■ Stop rec";
      document.getElementById("rec-banner").classList.add("on");
      // Start playback automatically
      if (!state.playing) startPlayback();
    }

    function stopRecording() {
      if (!state.recorder) return;
      try { state.recorder.stop(); } catch (_) {}
      state.recording = false;
      document.getElementById("cine-rec").classList.remove("on");
      document.getElementById("cine-rec").innerHTML = "● Record WebM";
      document.getElementById("rec-banner").classList.remove("on");
      // Restore canvas size
      if (state._restoreSize) {
        _D.renderer.setSize(state._restoreSize.w, state._restoreSize.h, false);
        window.dispatchEvent(new Event("resize"));
        state._restoreSize = null;
      } else {
        window.dispatchEvent(new Event("resize"));
      }
    }

    function finalizeRecording() {
      const blob = new Blob(state.recChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
      a.download = `cinema_${ts}.webm`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 5000);
      state.recChunks = [];
      state.recorder = null;
    }

    function exportTrack() {
      const data = {
        waypoints: state.waypoints.map(w => ({
          pos: [w.pos.x, w.pos.y, w.pos.z],
          target: [w.target.x, w.target.y, w.target.z],
          fov: w.fov, dur: w.dur, ease: w.ease,
        })),
        tracks: state.tracks,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cinema.json";
      a.click();
      URL.revokeObjectURL(a.href);
    }
    function importTrack() {
      const f = document.createElement("input");
      f.type = "file"; f.accept = "application/json,.json";
      f.onchange = () => {
        const file = f.files[0]; if (!file) return;
        const r = new FileReader();
        r.onload = () => {
          try {
            const d = JSON.parse(r.result);
            state.waypoints = (d.waypoints||[]).map(w => ({
              pos: new THREE.Vector3(...w.pos),
              target: new THREE.Vector3(...w.target),
              fov: w.fov || 45, dur: w.dur || 2, ease: w.ease || "in-out",
            }));
            state.tracks = d.tracks || {};
            renderWaypoints();
          } catch (e) { alert("Invalid cinema file: "+e.message); }
        };
        r.readAsText(file);
      };
      f.click();
    }

    // ─────────────────────────────────────────────────
    // PER-OBJECT KEYFRAMES
    // ─────────────────────────────────────────────────
    function addObjectKeyframeRow() {
      const pForm = document.getElementById("p-form");
      if (!pForm) return;
      const row = document.createElement("div");
      row.id = "obj-kf-row";
      row.innerHTML = `
        <span class="lbl">Cinema keyframes</span>
        <div id="kf-pills" style="font-size:10px;color:var(--text2);min-height:18px">no keyframes</div>
        <div class="row">
          <button id="kf-add" title="Capture this object's pose at current cinema time">＋ at t=<span id="kf-t">0.0</span>s</button>
          <button id="kf-clear">Clear all</button>
        </div>

        <span class="util-cap">Utilities</span>
        <div class="util-row">
          <button class="util-btn" id="ut-floor" title="Drop to Y=0">Snap to floor</button>
          <button class="util-btn" id="ut-center" title="Center at origin (XZ)">Center XZ</button>
        </div>
        <div class="util-row three">
          <button class="util-btn" id="ut-along-x" title="Align to X axis">Face X</button>
          <button class="util-btn" id="ut-along-z" title="Align to Z axis">Face Z</button>
          <button class="util-btn" id="ut-rot90" title="Rotate 90° Y">Rot 90°</button>
        </div>

        <span class="util-cap">Array</span>
        <div class="row" style="gap:4px;margin-top:4px">
          <span style="font-size:10px;color:var(--text2)">count</span>
          <input class="num-mini" id="arr-count" type="number" min="2" step="1" value="4" style="width:50px">
          <span style="font-size:10px;color:var(--text2)">gap</span>
          <input class="num-mini" id="arr-gap" type="number" step="0.1" value="1" style="width:50px">
        </div>
        <div class="util-row three">
          <button class="util-btn" id="ut-arr-x">Array X</button>
          <button class="util-btn" id="ut-arr-y">Array Y</button>
          <button class="util-btn" id="ut-arr-z">Array Z</button>
        </div>
        <div class="row" style="gap:4px;margin-top:4px">
          <span style="font-size:10px;color:var(--text2)">radius</span>
          <input class="num-mini" id="pol-r" type="number" step="0.1" value="2" style="width:50px">
          <button class="util-btn" id="ut-pol" style="flex:1">Polar array (Y)</button>
        </div>
      `;
      pForm.appendChild(row);

      document.getElementById("kf-add").onclick = addObjectKeyframe;
      document.getElementById("kf-clear").onclick = clearObjectKeyframes;
      document.getElementById("ut-floor").onclick = snapToFloor;
      document.getElementById("ut-center").onclick = centerXZ;
      document.getElementById("ut-along-x").onclick = () => { if(_D.sel){_D.sel.obj3d.rotation.y = Math.PI/2;_D.syncFromObj();_D.genCode();}};
      document.getElementById("ut-along-z").onclick = () => { if(_D.sel){_D.sel.obj3d.rotation.y = 0;_D.syncFromObj();_D.genCode();}};
      document.getElementById("ut-rot90").onclick = () => { if(_D.sel){_D.sel.obj3d.rotation.y += Math.PI/2;_D.syncFromObj();_D.genCode();}};
      document.getElementById("ut-arr-x").onclick = () => doArray("x");
      document.getElementById("ut-arr-y").onclick = () => doArray("y");
      document.getElementById("ut-arr-z").onclick = () => doArray("z");
      document.getElementById("ut-pol").onclick   = doPolarArray;

      // Update keyframe row whenever selection changes
      const origSync = _D.syncFromObj;
      _D.syncFromObj = function () {
        origSync();
        refreshKfRow();
      };
      // designer.html's selectItem() calls the IIFE-local syncFromObj
      // — listen for the event it dispatches so we refresh on selection too.
      window.addEventListener("designer:select", refreshKfRow);
      // Update t label as cinema time moves
      setInterval(() => {
        const el = document.getElementById("kf-t");
        if (el) el.textContent = state.currentTime.toFixed(1);
      }, 100);
    }

    function refreshKfRow() {
      const pills = document.getElementById("kf-pills");
      if (!pills || !_D.sel) return;
      const tr = state.tracks[_D.sel.id] || [];
      if (!tr.length) { pills.textContent = "no keyframes"; return; }
      pills.innerHTML = "";
      tr.sort((a,b)=>a.t-b.t).forEach((kf, i) => {
        const p = document.createElement("span");
        p.className = "kf-pill";
        p.textContent = kf.t.toFixed(1)+"s";
        p.title = "Click to scrub here · double-click to delete";
        p.onclick = () => {
          state.currentTime = kf.t;
          applyTime(state.currentTime, true);
          renderTimeline();
        };
        p.ondblclick = () => {
          tr.splice(i,1);
          if (!tr.length) delete state.tracks[_D.sel.id];
          refreshKfRow();
        };
        pills.appendChild(p);
      });
    }

    function addObjectKeyframe() {
      if (!_D.sel) return;
      const o = _D.sel.obj3d;
      const t = state.currentTime;
      const id = _D.sel.id;
      const tr = state.tracks[id] = state.tracks[id] || [];
      // Remove any keyframe at same t (within tol) and replace
      const TOL = 0.05;
      const existing = tr.findIndex(k => Math.abs(k.t - t) < TOL);
      const kf = {
        t,
        px: o.position.x, py: o.position.y, pz: o.position.z,
        rx: o.rotation.x, ry: o.rotation.y, rz: o.rotation.z,
        sx: o.scale.x, sy: o.scale.y, sz: o.scale.z,
      };
      if (existing >= 0) tr[existing] = kf;
      else tr.push(kf);
      tr.sort((a,b)=>a.t-b.t);
      refreshKfRow();
    }

    function clearObjectKeyframes() {
      if (!_D.sel) return;
      delete state.tracks[_D.sel.id];
      refreshKfRow();
    }

    function applyTracksAt(t) {
      Object.keys(state.tracks).forEach((idStr) => {
        const id = +idStr;
        const it = _D.items.find(i => i.id === id);
        if (!it) return;
        const tr = state.tracks[id]; if (!tr.length) return;
        // Find segment
        if (t <= tr[0].t) { applyKf(it.obj3d, tr[0]); return; }
        if (t >= tr[tr.length-1].t) { applyKf(it.obj3d, tr[tr.length-1]); return; }
        for (let i = 1; i < tr.length; i++) {
          if (t <= tr[i].t) {
            const a = tr[i-1], b = tr[i];
            const k = ease((t-a.t)/(b.t-a.t), "in-out");
            it.obj3d.position.set(
              a.px+(b.px-a.px)*k, a.py+(b.py-a.py)*k, a.pz+(b.pz-a.pz)*k
            );
            it.obj3d.rotation.set(
              a.rx+(b.rx-a.rx)*k, a.ry+(b.ry-a.ry)*k, a.rz+(b.rz-a.rz)*k
            );
            it.obj3d.scale.set(
              a.sx+(b.sx-a.sx)*k, a.sy+(b.sy-a.sy)*k, a.sz+(b.sz-a.sz)*k
            );
            break;
          }
        }
      });
    }
    function applyKf(o, kf) {
      o.position.set(kf.px, kf.py, kf.pz);
      o.rotation.set(kf.rx, kf.ry, kf.rz);
      o.scale.set(kf.sx, kf.sy, kf.sz);
    }

    // ─────────────────────────────────────────────────
    // UTILITIES
    // ─────────────────────────────────────────────────
    function snapToFloor() {
      if (!_D.sel) return;
      const o = _D.sel.obj3d;
      const box = new THREE.Box3().setFromObject(o);
      const dy = box.min.y;
      o.position.y -= dy;
      _D.syncFromObj(); _D.genCode();
      if (window._history) window._history.push("snap-to-floor");
    }
    function centerXZ() {
      if (!_D.sel) return;
      _D.sel.obj3d.position.x = 0;
      _D.sel.obj3d.position.z = 0;
      _D.syncFromObj(); _D.genCode();
      if (window._history) window._history.push("center-xz");
    }
    function doArray(axis) {
      if (!_D.sel) return;
      const count = Math.max(2, parseInt(document.getElementById("arr-count").value)||4);
      const gap   = parseFloat(document.getElementById("arr-gap").value)||1;
      const src = _D.sel;
      for (let i = 1; i < count; i++) {
        const clone = src.obj3d.clone();
        clone.name = src.name + "_a" + i;
        clone.position[axis] += gap * i;
        _D.scene.add(clone);
        _D.items.push({
          id: _D.idN++, name: clone.name, type: src.type, obj3d: clone,
          topic: "", intLabel: "",
          opts: JSON.parse(JSON.stringify(src.opts||{})),
          isPrimitive: src.isPrimitive,
          geomParams: src.geomParams ? JSON.parse(JSON.stringify(src.geomParams)) : null,
          matType: src.matType, color: src.color, children: src.children||null,
        });
      }
      _D.refreshTree(); _D.genCode();
      if (window._history) window._history.push("array");
    }
    function doPolarArray() {
      if (!_D.sel) return;
      const count = Math.max(2, parseInt(document.getElementById("arr-count").value)||4);
      const radius = parseFloat(document.getElementById("pol-r").value)||2;
      const src = _D.sel;
      // Anchor source at radius along +X first
      const cx = src.obj3d.position.x;
      const cz = src.obj3d.position.z;
      src.obj3d.position.x = cx + radius;
      for (let i = 1; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const clone = src.obj3d.clone();
        clone.name = src.name + "_p" + i;
        clone.position.x = cx + Math.cos(angle) * radius;
        clone.position.z = cz + Math.sin(angle) * radius;
        clone.rotation.y = src.obj3d.rotation.y - angle;
        _D.scene.add(clone);
        _D.items.push({
          id: _D.idN++, name: clone.name, type: src.type, obj3d: clone,
          topic: "", intLabel: "",
          opts: JSON.parse(JSON.stringify(src.opts||{})),
          isPrimitive: src.isPrimitive,
          geomParams: src.geomParams ? JSON.parse(JSON.stringify(src.geomParams)) : null,
          matType: src.matType, color: src.color, children: src.children||null,
        });
      }
      _D.syncFromObj(); _D.refreshTree(); _D.genCode();
      if (window._history) window._history.push("polar-array");
    }
  }
})();
