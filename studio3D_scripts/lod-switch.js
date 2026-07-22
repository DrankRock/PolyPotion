// ============================================================
// lod-switch.js — runtime, FPS-driven LOD picker (window.LODSwitch)
// Heavy viewers (Stage, Playground, Showcase) feed it frame times; it decides
// when to drop to a coarser rung (lag) or climb back (headroom), and calls
// onPick(pct, rung) so the viewer can hot-swap the mesh. Purely advisory — the
// viewer owns the actual swap. Manual override + an auto on/off flag included.
//
//   const ctl = createLODController({
//     rungs,                 // from lodRungs(entry): [{pct,path,…}] high→low
//     targetFps: 45,         // drop below this for a while → go coarser
//     onPick: (pct, rung) => { … load & swap … },
//   });
//   ctl.tick(dtMs)  // call every rendered frame with the frame delta
//   ctl.setAuto(bool); ctl.setManual(pct|null); ctl.current()
// ============================================================
export function createLODController(opts) {
  opts = opts || {};
  const rungs = (opts.rungs || []).slice().sort((a, b) => b.pct - a.pct);
  const onPick = opts.onPick || function () {};
  const targetFps = opts.targetFps || 45;
  const goodFps = opts.goodFps || (targetFps + 12);   // climb-back threshold
  const lowMs = 1000 / targetFps;
  const goodMs = 1000 / goodFps;
  const holdFrames = opts.holdFrames || 45;            // ~0.75s of evidence before moving

  let auto = opts.auto !== false;
  let idx = 0;                                         // index into rungs (0 = finest)
  let manual = null;                                   // manual pct override
  let badRun = 0, goodRun = 0;
  let ema = 1000 / 60;                                 // smoothed frame time

  function pctFor(i) { return rungs.length ? rungs[Math.max(0, Math.min(rungs.length - 1, i))].pct : 100; }
  function emit() { const r = rungs[idx]; if (r) onPick(r.pct, r); }

  function setIndex(i) {
    i = Math.max(0, Math.min(rungs.length - 1, i));
    if (i === idx) return false;
    idx = i; badRun = goodRun = 0; emit(); return true;
  }

  return {
    rungs,
    current() { return rungs[idx] || null; },
    currentPct() { return manual != null ? manual : pctFor(idx); },
    isAuto() { return auto && manual == null; },
    setAuto(on) { auto = !!on; badRun = goodRun = 0; },
    // manual: pass a pct (snaps to nearest rung) or null to return to auto
    setManual(pct) {
      if (pct == null) { manual = null; return; }
      let best = 0, bd = Infinity;
      rungs.forEach((r, i) => { const d = Math.abs(r.pct - pct); if (d < bd) { bd = d; best = i; } });
      manual = rungs[best] ? rungs[best].pct : pct;
      setIndex(best);
    },
    // start on the finest (or a given pct)
    prime(pct) { if (pct != null) { let b = 0, bd = Infinity; rungs.forEach((r, i) => { const d = Math.abs(r.pct - pct); if (d < bd) { bd = d; b = i; } }); idx = b; } emit(); },
    tick(dtMs) {
      if (!rungs.length || !auto || manual != null) return;
      if (!(dtMs > 0) || dtMs > 500) return;            // ignore stalls/tab-outs
      ema = ema * 0.9 + dtMs * 0.1;
      if (ema > lowMs) { badRun++; goodRun = 0; if (badRun >= holdFrames && idx < rungs.length - 1) setIndex(idx + 1); }
      else if (ema < goodMs) { goodRun++; badRun = 0; if (goodRun >= holdFrames * 2 && idx > 0) setIndex(idx - 1); }
      else { badRun = 0; goodRun = 0; }
    },
  };
}
if (typeof window !== 'undefined') window.LODSwitch = { createLODController };
