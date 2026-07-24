// interaction.js — Hover-glow + click handling for rooms.
//
// USAGE
//   const im = new InteractionManager({
//     canvas, camera,
//     getRoom: () => currentRoom,           // returns the active Room or null
//     getCharacter: () => characterGroup,   // returns the character
//     onTopic: (topicId, label) => { ... }, // clicked an interactive
//     onMoveTo: (point) => { ... },         // ctrl/cmd-clicked the floor
//   });
//
//   On every room change: im.refresh();    (resets hover state)
//   On teardown:           im.dispose();
//
// The label tooltip is created/managed automatically.

(function () {
  const THREE = window.THREE;
  if (!THREE) return;

  class InteractionManager {
    constructor({ canvas, camera, getRoom, getCharacter, onTopic, onMoveTo }) {
      this.canvas = canvas;
      this.camera = camera;
      this.getRoom = getRoom;
      this.getCharacter = getCharacter;
      this.onTopic = onTopic;
      this.onMoveTo = onMoveTo;

      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      this.lastClient = { x: 0, y: 0 };
      this.hoveredEntry = null;   // { root, meshes, topic, label } | null
      this.suppressMove = false;  // true while dragging the camera

      this.label = this._makeLabel();

      this._onMove   = this._onMove.bind(this);
      this._onDown   = this._onDown.bind(this);
      this._onUp     = this._onUp.bind(this);
      this._onLeave  = this._onLeave.bind(this);

      // Pointer events cover mouse + touch + pen with one set of handlers.
      this.canvas.addEventListener("pointermove", this._onMove);
      this.canvas.addEventListener("pointerdown", this._onDown);
      // Listen on window for up so a drag that ends off-canvas still resolves.
      window.addEventListener("pointerup",   this._onUp);
      this.canvas.addEventListener("pointerleave", this._onLeave);
    }

    dispose() {
      this.canvas.removeEventListener("pointermove", this._onMove);
      this.canvas.removeEventListener("pointerdown", this._onDown);
      window.removeEventListener("pointerup",   this._onUp);
      this.canvas.removeEventListener("pointerleave", this._onLeave);
      this.label.remove();
    }

    // Call after the room changes — clears any stale hover state.
    refresh() {
      this._unhover();
    }

    // ── label tooltip ───────────────────────────────────
    _makeLabel() {
      const el = document.createElement("div");
      el.className = "interactive-label";
      el.style.display = "none";
      document.body.appendChild(el);
      return el;
    }
    _showLabel(text) {
      this.label.textContent = text || "";
      this.label.style.display = text ? "block" : "none";
      this._positionLabel();
    }
    _positionLabel() {
      const { x, y } = this.lastClient;
      this.label.style.left = (x + 16) + "px";
      this.label.style.top  = (y + 16) + "px";
    }

    // ── hover ───────────────────────────────────────────
    _setNDC(e) {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      this.lastClient = { x: e.clientX, y: e.clientY };
    }

    _onMove(e) {
      this._setNDC(e);
      this._positionLabel();

      const room = this.getRoom && this.getRoom();
      if (!room || !room.interactives.length) {
        this._unhover();
        return;
      }
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const meshes = room.interactives.flatMap((i) => i.meshes);
      const hits = this.raycaster.intersectObjects(meshes, false);
      const hit = hits[0]?.object || null;
      const entry = hit ? room.findInteractiveFromHit(hit) : null;
      if (entry !== this.hoveredEntry) {
        this._unhover();
        if (entry) this._hover(entry);
      }
    }

    _onLeave() { this._unhover(); }

    _hover(entry) {
      this.hoveredEntry = entry;
      this.canvas.style.cursor = "pointer";
      entry.meshes.forEach((m) => {
        const ms = Array.isArray(m.material) ? m.material : [m.material];
        ms.forEach((mat, i) => {
          if (!mat.emissive) return;
          mat.emissive.setHex(entry.hoverColor);
          mat.emissiveIntensity = 0.75;
          mat.needsUpdate = true;
        });
      });
      this._showLabel(entry.label || "");
    }

    _unhover() {
      if (!this.hoveredEntry) return;
      this.hoveredEntry.meshes.forEach((m) => {
        const ms = Array.isArray(m.material) ? m.material : [m.material];
        ms.forEach((mat, i) => {
          if (!mat.emissive) return;
          const orig = m.userData._origEmissive?.[i];
          if (orig) mat.emissive.copy(orig); else mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = m.userData._origEmissiveIntensity?.[i] || 0;
          mat.needsUpdate = true;
        });
      });
      this.hoveredEntry = null;
      this.canvas.style.cursor = "default";
      this._showLabel("");
    }

    // ── click ───────────────────────────────────────────
    // We track mousedown/mouseup so a camera drag doesn't accidentally
    // trigger a click.
    _onDown(e) {
      this._downAt = { x: e.clientX, y: e.clientY, ctrl: e.ctrlKey || e.metaKey };
    }
    _onUp(e) {
      if (!this._downAt) return;
      const dx = e.clientX - this._downAt.x;
      const dy = e.clientY - this._downAt.y;
      const moved = Math.hypot(dx, dy) > 5;
      const ctrl = this._downAt.ctrl;
      this._downAt = null;
      if (moved) return;  // it was a drag, not a click

      this._setNDC(e);
      const room = this.getRoom && this.getRoom();
      if (!room) return;

      // Ctrl/cmd + click → move character to floor point
      if (ctrl && room.floor) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const hits = this.raycaster.intersectObject(room.floor, false);
        if (hits[0] && this.onMoveTo) this.onMoveTo(hits[0].point);
        return;
      }

      // Regular click → interactive?
      if (this.hoveredEntry && this.onTopic) {
        this.onTopic(this.hoveredEntry.topic, this.hoveredEntry.label);
      }
    }
  }

  window.InteractionManager = InteractionManager;
})();
