/* ============================================================
   suggested_actions.js — tiny heuristic "what next?" engine
   Given a loaded model's stats, returns a ranked list of suggestions the
   Showcase surfaces in its top "Next:" bar. Pure, dependency-free, global.
   Each suggestion: { level: 'warn'|'info'|'ok', label, reason, tool }.
   ============================================================ */
(function () {
  function suggest(m) {
    m = m || {};
    var out = [];
    var tris = m.tris || 0;

    if (tris > 150000) {
      out.push({ level: 'warn', label: 'Decimate', tool: 'decimate',
        reason: tris.toLocaleString() + ' triangles is heavy for real-time — reduce it before rigging or export.' });
    }
    if (!m.hasSkeleton) {
      out.push({ level: 'info', label: 'Rig it', tool: 'autorig',
        reason: 'No skeleton yet — rig the character to drive it with motion clips.' });
    }
    if (!m.hasUVs) {
      out.push({ level: 'warn', label: 'Unwrap UVs', tool: 'uvunwrap',
        reason: 'No UVs found — unwrap it so textures and bakes have somewhere to land.' });
    } else if (!m.hasTexture) {
      out.push({ level: 'info', label: 'Paint', tool: 'texturepaint',
        reason: 'UVs are ready but there is no texture — paint or bake one on.' });
    }

    if (!out.length) {
      out.push({ level: 'ok', label: 'Capture', tool: 'showcase',
        reason: 'Looking good — spin the turntable and grab a snapshot or WebM.' });
    }
    return out;
  }

  window.SuggestedActions = { suggest: suggest };
})();
