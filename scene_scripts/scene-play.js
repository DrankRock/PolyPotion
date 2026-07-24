// scene_scripts/scene-play.js — Play mode for the Scene tool.
//
// Turns the authoring viewport into a walkable scene: the active character
// (the shell-delivered actor, or a placeholder) walks the room on ctrl/cmd-
// click, collides with walls, and can interact with any object that carries a
// topic/label (set in Properties, or inherited from a loaded room). Uses the
// same OBJECTS registry + rooms — nothing is duplicated.
//
// Toggle: a "▶ Play" button in the topbar. Edit mode restores gizmos.
//
// Interaction engine: window.InteractionManager (scene_scripts/interaction.js).

(function () {
  if (window._D) init();
  else window.addEventListener("designer:ready", init, { once: true });

  function init() {
    const _D = window._D;
    const THREE = _D.THREE;

    let playing = false;
    let im = null;                 // InteractionManager
    let character = null;          // THREE.Object3D that walks
    let placeholder = null;        // spawned only if no actor exists
    let ground = null;             // invisible floor for ctrl-click movement
    let raf = null, lastT = 0;
    let room = null;               // adapter consumed by InteractionManager

    injectStyles();
    const btn = addToggle();
    const banner = addBanner();

    // ── enter / exit ───────────────────────────────────
    function play() {
      if (playing) return;
      playing = true;
      btn.classList.add("on"); btn.innerHTML = "■ Edit";
      document.body.classList.add("scene-playing");

      _D.gizmo.detach();
      character = pickCharacter();
      room = buildRoom();
      ensureGround();

      im = new window.InteractionManager({
        canvas: _D.renderer.domElement,
        camera: _D.camera,
        getRoom: () => room,
        getCharacter: () => character,
        onTopic: (topic, label) => showBanner((label || topic) + (topic ? "  ·  " + topic : "")),
        onMoveTo: (p) => { if (character) character.userData.moveTarget = { x: p.x, z: p.z }; },
      });

      // Neutralize editor selection while playing (core still fires it).
      window.addEventListener("designer:select", killGizmo);
      showBanner("Play — ctrl/⌘-click the floor to walk · click a glowing object to interact");
      lastT = performance.now();
      loop();
    }

    function exit() {
      if (!playing) return;
      playing = false;
      btn.classList.remove("on"); btn.innerHTML = "▶ Play";
      document.body.classList.remove("scene-playing");
      window.removeEventListener("designer:select", killGizmo);
      if (raf) cancelAnimationFrame(raf), raf = null;
      if (im) { im.dispose(); im = null; }
      if (ground) { _D.shell.remove(ground); ground.geometry.dispose(); ground.material.dispose(); ground = null; }
      if (placeholder) { _D.scene.remove(placeholder); disposeTree(placeholder); placeholder = null; }
      if (character) character.userData.moveTarget = null;
      character = null; room = null;
      hideBanner();
    }

    function killGizmo() { if (playing) _D.gizmo.detach(); }

    // ── character ──────────────────────────────────────
    function pickCharacter() {
      // Prefer a shell-delivered / imported actor; else spawn a placeholder.
      const actor = [..._D.items].reverse().find((e) => e.type === "imported");
      if (actor) return actor.obj3d;
      placeholder = makePlaceholder();
      _D.scene.add(placeholder);
      return placeholder;
    }

    function makePlaceholder() {
      const g = new THREE.Group();
      g.name = "__playCharacter__";
      const skin = new THREE.MeshStandardMaterial({ color: 0xc8a989, roughness: 0.8 });
      const cloth = new THREE.MeshStandardMaterial({ color: 0x3a342a, roughness: 0.92 });
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.1, 20), cloth);
      body.position.y = 0.72; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 18), skin);
      head.position.y = 1.5; g.add(head);
      return g;
    }

    // ── room adapter (interactives + floor) ────────────
    function buildRoom() {
      const interactives = [];
      _D.items.forEach((e) => {
        if (!e.topic) return;
        if (character && e.obj3d === character) return;
        const meshes = [];
        e.obj3d.traverse((o) => { if (o.isMesh) meshes.push(o); });
        if (!meshes.length) return;
        prepInteractive(meshes, e.obj3d);
        interactives.push({ root: e.obj3d, meshes, topic: e.topic, label: e.intLabel || e.name, hoverColor: 0xffc88a });
      });
      return {
        interactives,
        get floor() { return ground; },
        group: _D.shell,
        findInteractiveFromHit(mesh) {
          let c = mesh;
          while (c) { const en = interactives.find((i) => i.root === c); if (en) return en; c = c.parent; }
          return null;
        },
      };
    }

    // Clone materials once so hover-glow doesn't bleed into other instances,
    // and record originals for InteractionManager's _unhover.
    function prepInteractive(meshes, root) {
      meshes.forEach((m) => {
        m.userData.interactiveRoot = root;
        if (!m.userData._playPrepped) {
          if (Array.isArray(m.material)) m.material = m.material.map((x) => x.clone());
          else if (m.material) m.material = m.material.clone();
          const ms = Array.isArray(m.material) ? m.material : [m.material];
          m.userData._origEmissive = ms.map((mat) => (mat.emissive ? mat.emissive.clone() : null));
          m.userData._origEmissiveIntensity = ms.map((mat) => mat.emissiveIntensity || 0);
          m.userData._playPrepped = true;
        }
      });
    }

    function ensureGround() {
      const g = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 200),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      g.rotation.x = -Math.PI / 2; g.position.y = 0.002; g.visible = false;
      g.name = "__playGround__"; g.userData.noCollide = true;
      _D.shell.add(g); ground = g;
    }

    // ── per-frame: walk + collide + camera follow ──────
    const _from = new THREE.Vector3(), _dir = new THREE.Vector3(), _ray = new THREE.Raycaster();
    function loop() {
      if (!playing) return;
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
      const ch = character; if (!ch) return;

      const tgt = ch.userData.moveTarget;
      if (tgt) {
        const dx = tgt.x - ch.position.x, dz = tgt.z - ch.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.06) {
          ch.userData.moveTarget = null;
        } else {
          const step = Math.min(d, 2.2 * dt);
          const ux = dx / d, uz = dz / d;
          if (!blocked(ch, ux, uz, step + 0.25)) {
            ch.position.x += ux * step;
            ch.position.z += uz * step;
          } else {
            ch.userData.moveTarget = null; // bumped a wall — stop
          }
          const yaw = Math.atan2(ux, uz);
          let diff = yaw - ch.rotation.y;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          ch.rotation.y += diff * Math.min(1, dt * 10);
        }
      }
      // gentle camera follow (orbit look/zoom stay in the user's hands)
      _D.orbit.target.lerp(_from.set(ch.position.x, 1.1, ch.position.z), 0.08);
    }

    // Ray from chest height along move dir vs. solid shell meshes.
    function blocked(ch, ux, uz, dist) {
      _from.set(ch.position.x, 0.9, ch.position.z);
      _dir.set(ux, 0, uz);
      _ray.set(_from, _dir); _ray.far = dist;
      const solids = [];
      _D.shell.traverse((c) => {
        if (!c.isMesh || c.userData.noCollide) return;
        const isFloor = Math.abs(c.rotation.x + Math.PI / 2) < 0.1;
        if (isFloor) return;
        solids.push(c);
      });
      return _ray.intersectObjects(solids, false).length > 0;
    }

    // ── UI ─────────────────────────────────────────────
    function addToggle() {
      const bar = document.getElementById("topbar");
      const b = document.createElement("button");
      b.className = "btn primary"; b.id = "scene-play-btn"; b.innerHTML = "▶ Play";
      b.onclick = () => (playing ? exit() : play());
      // place right after the Room/Plan tab group
      const tabs = bar.querySelector(".tab-group");
      if (tabs && tabs.parentNode) tabs.parentNode.insertBefore(b, tabs.nextSibling);
      else bar.appendChild(b);
      return b;
    }
    function addBanner() {
      const vp = document.getElementById("viewport-area");
      const el = document.createElement("div");
      el.id = "scene-play-banner";
      vp.appendChild(el);
      return el;
    }
    let _bannerTimer = null;
    function showBanner(txt) {
      banner.textContent = txt; banner.classList.add("show");
      clearTimeout(_bannerTimer);
      _bannerTimer = setTimeout(() => banner.classList.remove("show"), 3200);
    }
    function hideBanner() { banner.classList.remove("show"); }

    function disposeTree(root) {
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose && m.dispose());
      });
    }

    function injectStyles() {
      const s = document.createElement("style");
      s.textContent = `
        .interactive-label{position:fixed;z-index:50;pointer-events:none;
          background:var(--panel);border:1px solid var(--edge);color:var(--text);
          font-family:var(--font-ui);font-size:12px;padding:4px 9px;border-radius:7px;
          box-shadow:0 4px 14px rgba(0,0,0,.25)}
        #scene-play-banner{position:absolute;top:10px;left:50%;transform:translateX(-50%);
          z-index:9;pointer-events:none;background:var(--accent);color:var(--on-accent);
          font-family:var(--font-mono);font-size:12px;letter-spacing:.02em;padding:5px 14px;
          border-radius:14px;opacity:0;transition:opacity .2s;max-width:80%;white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis}
        #scene-play-banner.show{opacity:1}
        /* In play mode, hide the editor's transform chrome. */
        body.scene-playing .mode-btns,
        body.scene-playing #view-bar,
        body.scene-playing #sims-toolbar,
        body.scene-playing #quick-rot{display:none !important}
        #scene-play-btn.on{background:var(--danger);border-color:var(--danger);color:#fff}
      `;
      document.head.appendChild(s);
    }

    window._scenePlay = { play, exit, isPlaying: () => playing };
  }
})();
