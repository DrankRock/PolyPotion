// ============================================================
// lod-runtime.js — glue between a viewer and the FPS LOD controller.
// (window.LODRuntime). Keeps viewers tiny: they hand over the rung list and a
// single load(rung) callback; this measures real frame cadence with its own
// rAF probe and swaps rungs when the viewport lags / has headroom.
//
//   this._lod = window.LODRuntime.attach({
//     lods,                       // [{pct,path,chunked,chunks}] (any order)
//     ext,                        // 'glb' etc — passed back on each rung
//     load: (rung, first) => {…}, // load/​swap to this rung; `first` = initial
//     onSwitch: (pct) => {…},     // optional: notify UI of an auto switch
//   });
//   … later, before loading something else: this._lod && this._lod.dispose();
//
// If there are fewer than 2 usable rungs it just loads the one (or the base)
// and never starts the probe — so a plain import with no LODs is untouched.
// ============================================================
(function () {
  function normalize(lods) {
    if (!Array.isArray(lods)) return [];
    return lods
      .map(l => ({ pct: +l.pct || 0, path: l.path, ext: l.ext, chunked: l.chunked, chunks: l.chunks, tris: l.tris }))
      .filter(l => l.pct > 0 && l.path)
      .sort((a, b) => b.pct - a.pct);
  }

  function attach(opts) {
    opts = opts || {};
    const rungs = normalize(opts.lods);
    const load = opts.load || function () {};
    const onSwitch = opts.onSwitch || function () {};
    const storageKey = opts.storageKey || null;
    const readSaved = () => { try { return storageKey ? localStorage.getItem(storageKey) : null; } catch (e) { return null; } };
    const writeSaved = (v) => { try { if (!storageKey) return; if (v == null) localStorage.removeItem(storageKey); else localStorage.setItem(storageKey, String(v)); } catch (e) {} };

    // Nothing to switch between → behave like a normal single load.
    if (rungs.length < 2) {
      if (rungs.length === 1) load(rungs[0], true);
      return { dispose() {}, single: true, rungs };
    }

    const LS = window.LODSwitch;
    if (!LS || !LS.createLODController) {   // controller missing → load finest, no auto
      load(rungs[0], true);
      return { dispose() {}, rungs };
    }

    let first = true;
    const ctl = LS.createLODController({
      rungs,
      targetFps: opts.targetFps || 45,
      onPick: (pct, rung) => {
        const wasFirst = first; first = false;
        load(rung, wasFirst);
        if (!wasFirst) onSwitch(pct, rung);
        if (typeof paint === 'function') paint();
      },
    });

    let raf = 0, last = 0, disposed = false;
    function frame(t) {
      if (disposed) return;
      if (last) ctl.tick(t - last);
      last = t;
      raf = requestAnimationFrame(frame);
    }

    // ---- optional in-viewport manual picker: Auto + one chip per rung ----
    let picker = null, chips = {};
    function buildPicker(mount) {
      const host = typeof mount === 'string' ? document.querySelector(mount) : mount;
      if (!host) return;
      picker = document.createElement('div');
      picker.setAttribute('data-lod-picker', '');
      picker.style.cssText = 'position:absolute;right:10px;bottom:10px;z-index:40;display:flex;align-items:center;gap:4px;padding:4px;border-radius:9px;background:rgba(15,15,15,.82);border:1px solid var(--edge,#333);box-shadow:0 4px 14px rgba(0,0,0,.4);font-family:var(--font-mono,monospace);font-size:10.5px;';
      const tag = document.createElement('span');
      tag.textContent = 'LOD';
      tag.style.cssText = 'padding:0 4px;color:var(--muted,#888);letter-spacing:.1em;';
      picker.appendChild(tag);
      const mk = (label, val, tip) => {
        const b = document.createElement('button');
        b.textContent = label; b.title = tip || '';
        b.style.cssText = 'padding:4px 8px;border-radius:6px;border:1px solid transparent;background:transparent;color:var(--text2,#cfcfcf);cursor:pointer;font:inherit;';
        b.addEventListener('click', () => { if (val === 'auto') { ctl.setAuto(true); ctl.setManual(null); writeSaved(null); } else { ctl.setAuto(false); ctl.setManual(val); writeSaved(val); } paint(); });
        chips[String(val)] = b; picker.appendChild(b); return b;
      };
      mk('AUTO', 'auto', 'Switch automatically when the viewport lags');
      rungs.forEach(r => mk(r.pct + '%', r.pct, r.tris ? (r.tris.toLocaleString() + ' tris') : ('LOD ' + r.pct + '%')));
      host.appendChild(picker);
      paint();
    }
    function paint() {
      if (!picker) return;
      const auto = ctl.isAuto();
      const cur = ctl.currentPct();
      Object.entries(chips).forEach(([k, b]) => {
        const on = k === 'auto' ? auto : (!auto && +k === cur);
        const live = k !== 'auto' && auto && +k === cur;   // auto's current pick
        b.style.background = on ? 'var(--accent,#c2562f)' : 'transparent';
        b.style.color = on ? 'var(--on-accent,#fff)' : 'var(--text2,#cfcfcf)';
        b.style.borderColor = live ? 'var(--accent,#c2562f)' : 'transparent';
      });
    }

    const saved = readSaved();
    if (saved && saved !== 'auto' && isFinite(+saved)) { ctl.setAuto(false); ctl.prime(+saved); ctl.setManual(+saved); }
    else ctl.prime(100);            // triggers the initial load via onPick (finest, or saved rung)
    if (opts.mount) buildPicker(opts.mount);
    raf = requestAnimationFrame(frame);

    return {
      rungs,
      controller: ctl,
      currentPct: () => ctl.currentPct(),
      setManual: (pct) => { ctl.setManual(pct); paint(); },
      setAuto: (on) => { ctl.setAuto(on); paint(); },
      refreshPicker: paint,
      dispose() { disposed = true; if (raf) cancelAnimationFrame(raf); if (picker && picker.parentNode) picker.parentNode.removeChild(picker); },
    };
  }

  window.LODRuntime = { attach, normalize };
})();
