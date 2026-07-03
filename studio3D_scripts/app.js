// ============================================================
// AUTORIG — APP / UI CONTROLLER
// Ties template.js + engine.js (window.RigEngine) + fbx-export.js to the DOM.
// ============================================================
import './engine.js';
import { fetchAssetBlob } from './chunk-loader.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const E = window.RigEngine;

let joints = [];                 // serialized joint list
let groupsOn = {};
let quality = 'fast', bound = false, loadedName = '';

// ---------- boot ----------
E.init($('#glcanvas'));
RigTemplate.GROUPS.forEach(g => groupsOn[g.id] = g.defaultOff ? false : true);

E.onSelect(j => syncSelection(j));

// ============================================================
// FILE LOADING
// ============================================================
const dz = $('#dz'), dzStage = $('#dzStage'), fileInput = $('#fileInput');
$('#dzBtn').addEventListener('click', e => { e.preventDefault(); fileInput.click(); });
fileInput.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
dz.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
// allow drop anywhere on viewport too
const vw = $('#viewportWrap');
['dragenter', 'dragover'].forEach(ev => vw.addEventListener(ev, e => e.preventDefault()));
vw.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); });

$('#sampleTag').addEventListener('click', async e => {
  e.preventDefault(); e.stopPropagation();
  try {
    showLoading('Loading sample', 'fetching humanoid.fbx');
    setProgress('downloading', 0.3);
    const res = await fetch('data/characters/humanoid_unrigged.fbx');
    const blob = await res.blob();
    await handleFile(new File([blob], 'humanoid.fbx'), true);
  } catch (err) { hideLoading(); toast('Sample failed: ' + err.message, 'error'); }
});

async function handleFile(file, keepLoading) {
  try {
    if (!keepLoading) showLoading('Loading mesh', 'parsing ' + file.name);
    setProgress('parsing geometry', 0.4);
    await new Promise(r => setTimeout(r, 30));
    const info = await E.loadFile(file);
    loadedName = info.name;
    // build joints from template
    joints = E.buildJoints(RigTemplate.build(), groupsOn);
    renderGroups();
    dzStage.classList.add('hide');
    $('#vpTools').classList.remove('hide');
    { const op = Math.round((E.getMeshOpacity ? E.getMeshOpacity() : 0.42) * 100); $('#meshOpacity').value = op; $('#meshOpacityVal').textContent = op + '%'; }
    $('#filechip').classList.add('loaded');
    $('#filechip .nm').textContent = `${info.name}  ·  ${info.verts.toLocaleString()} verts`;
    setStep(2);
    bound = false;
    $('#btnEditJoints').style.display = 'none';
    $('#animReport').innerHTML = '';
    $('#bindStat').textContent = '';
    $('#btnBind').disabled = !E.canBind();
    openSec('secBind', true);
    hideLoading();
    toast(`Loaded ${info.verts.toLocaleString()} verts / ${info.tris.toLocaleString()} tris. Place the joints, then bind.`, 'success');
  } catch (err) {
    hideLoading();
    console.error(err);
    toast('Load failed: ' + err.message, 'error');
  }
}

// ============================================================
// LEFT RAIL — group + joint outliner
// ============================================================
function renderGroups() {
  const host = $('#groupList'); host.innerHTML = '';
  RigTemplate.GROUPS.forEach(g => {
    const gj = joints.filter(j => j.group === g.id);
    if (!gj.length) return;
    const on = groupsOn[g.id] !== false;
    const grp = document.createElement('div');
    grp.className = 'grp' + (on ? '' : ' off');
    grp.innerHTML = `
      <div class="grp-head">
        <span class="gname">${g.label}</span>
        <span class="gcount mono">${gj.length}</span>
        <div class="sw ${on ? 'on' : ''} ${g.removable ? '' : 'locked'}" data-grp="${g.id}" title="${g.removable ? 'toggle group' : 'required'}"></div>
      </div>
      <div class="joint-list"></div>`;
    const list = grp.querySelector('.joint-list');
    gj.forEach(j => {
      const row = document.createElement('div');
      row.className = 'joint-row' + (j.placed ? ' placed' : '');
      row.dataset.id = j.id;
      row.innerHTML = `<span class="jd"></span><span class="jl">${j.label}</span>`;
      row.addEventListener('click', () => E.selectJoint(j.id));
      list.appendChild(row);
    });
    host.appendChild(grp);
  });
  // group toggles
  $$('#groupList .sw').forEach(sw => {
    if (sw.classList.contains('locked')) return;
    sw.addEventListener('click', () => {
      const id = sw.dataset.grp;
      const next = !(groupsOn[id] !== false);
      groupsOn[id] = next;
      E.setGroupEnabled(id, next);
      joints = joints.map(j => j.group === id ? { ...j, enabled: next } : j);
      renderGroups();
      updateBadge();
      $('#btnBind').disabled = !E.canBind();
    });
  });
  updateBadge();
}

function updateBadge() {
  const total = joints.length;
  const on = joints.filter(j => groupsOn[j.group] !== false).length;
  $('#jointBadge').textContent = `${on} / ${total}`;
}

$('#btnAutoFit').addEventListener('click', () => { E.autoFit(); markPlacedReset(); toast('Joints fit to mesh bounds', 'success'); });
$('#btnReset').addEventListener('click', () => { E.resetPoses(); markPlacedReset(); });
function markPlacedReset() { joints = joints.map(j => ({ ...j, placed: false })); renderGroups(); }

// ============================================================
// SELECTION
// ============================================================
function syncSelection(j) {
  $$('#groupList .joint-row').forEach(r => r.classList.toggle('sel', r.dataset.id === (j && j.id)));
  if (!j) { $('#selEmpty').classList.remove('hide'); $('#selInfo').classList.add('hide'); return; }
  $('#selEmpty').classList.add('hide'); $('#selInfo').classList.remove('hide');
  $('#selName').textContent = j.label;
  $('#selParent').textContent = j.parent || '— root —';
  $('#selPos').textContent = j.pos.map(v => v.toFixed(2)).join(', ');
  const dv = $('#depthSlide');
  dv.value = Math.round(j.pos[2] * 100);
  $('#depthVal').textContent = j.pos[2].toFixed(2);
  // mark placed in list
  const row = $(`#groupList .joint-row[data-id="${j.id}"]`);
  if (row && j.placed) row.classList.add('placed');
}
$('#depthSlide').addEventListener('input', e => {
  const z = (+e.target.value) / 100;
  $('#depthVal').textContent = z.toFixed(2);
  E.nudgeDepth(z);
});
$('#btnMirror').addEventListener('click', () => {
  const twin = E.mirrorSelected();
  if (twin) { toast('Mirrored to ' + twin, 'success'); markPlacedFor(twin); }
});
$('#btnCenterSel').addEventListener('click', () => {
  const ok = E.centerSelected();
  toast(ok ? 'Snapped to the middle of the surrounding volume' : 'No enclosing volume found here — drag the joint closer to the mesh first', ok ? 'success' : 'warn');
});
$('#btnMirrorRL').addEventListener('click', () => {
  const c = E.mirrorSide('R');
  toast(c ? `Mirrored ${c} joints R → L` : 'No side joints to mirror', c ? 'success' : 'warn');
});
$('#btnMirrorLR').addEventListener('click', () => {
  const c = E.mirrorSide('L');
  toast(c ? `Mirrored ${c} joints L → R` : 'No side joints to mirror', c ? 'success' : 'warn');
});
$('#btnCenterAll').addEventListener('click', () => {
  const c = E.centerAll();
  toast(c ? `Auto-centered ${c} joint(s) inside the mesh` : 'Nothing moved — joints may already be centered or too far outside the mesh', c ? 'success' : 'warn');
});
function markPlacedFor(id) { const r = $(`#groupList .joint-row[data-id="${id}"]`); if (r) r.classList.add('placed'); }

// ============================================================
// BIND
// ============================================================
$('#qualitySeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  quality = b.dataset.q;
  $$('#qualitySeg button').forEach(x => x.classList.toggle('on', x === b));
  $('#hqOpts').style.display = quality === 'hq' ? '' : 'none';
  $('#qualityNote').innerHTML = quality === 'hq'
    ? '<b style="color:var(--text)">High quality</b> — voxel-geodesic weights. Clean at joints, no cross-limb bleed. Heavy.'
    : '<b style="color:var(--text)">Fast</b> — bone-distance weights. Instant, good for blocking out the rig.';
});
$('#resSlide').addEventListener('input', e => $('#resVal').textContent = e.target.value + '³');
$('#falloffSlide').addEventListener('input', e => $('#falloffVal').textContent = ((+e.target.value) / 100).toFixed(2));

$('#btnBind').addEventListener('click', () => {
  if (!E.canBind()) { toast('Enable at least the spine + legs first', 'warn'); return; }
  if (quality === 'hq') showModal('#hqModal');
  else runBind('fast');
});
$('#hqCancel').addEventListener('click', () => { hideModal('#hqModal'); runBind('fast'); });
$('#hqProceed').addEventListener('click', () => { hideModal('#hqModal'); runBind('hq'); });

// ---- back to placing joints ----
$('#btnEditJoints').addEventListener('click', () => {
  E.editJoints();
  bound = false;
  $('#btnEditJoints').style.display = 'none';
  $('#bindStat').textContent = '';
  $('#animReport').innerHTML = '';
  openSec('secAnim', false); openSec('secExport', false);
  setStep(2);
  $('#btnBind').disabled = !E.canBind();
  toast('Back to placement — adjust joints, then re-bind.', 'success');
});

// ---- skeleton presets ----
const PRESETS = {};
(window.RigPresets || []).forEach(p => PRESETS[p.id] = p.groups);
// build the dropdown from the modular preset list
(function buildPresetUI() {
  const sel = $('#presetSel'); if (!sel) return;
  sel.innerHTML = '';
  (window.RigPresets || []).forEach(p => {
    const o = document.createElement('option'); o.value = p.id; o.textContent = p.label; sel.appendChild(o);
  });
  // seed app default group state from the first preset
  const first = (window.RigPresets || [])[0];
  if (first) Object.keys(first.groups).forEach(g => { groupsOn[g] = !!first.groups[g]; });
})();
$('#presetSel').addEventListener('change', e => {
  const p = PRESETS[e.target.value] || {};
  Object.keys(p).forEach(g => { groupsOn[g] = !!p[g]; });
  if (joints.length) {
    Object.keys(p).forEach(g => E.setGroupEnabled(g, !!p[g]));
    joints = joints.map(j => ({ ...j, enabled: groupsOn[j.group] !== false }));
    renderGroups();
    $('#btnBind').disabled = !E.canBind();
  }
});

async function runBind(q) {
  const res = +$('#resSlide').value;
  const falloff = (+$('#falloffSlide').value) / 100;
  setStep(3);
  showLoading(q === 'hq' ? 'Computing high-quality skin' : 'Binding skeleton',
    q === 'hq' ? 'voxel-geodesic — heavy crunch' : 'distance weights');
  $('#loadSub').textContent = q === 'hq'
    ? 'Solid-voxelizing the mesh and flooding geodesic distance from every bone. This is the heavy one — hang tight.'
    : 'Computing bone-distance weights for every vertex.';
  try {
    const t0 = performance.now();
    const stat = await E.bind({
      quality: q, res, falloff,
      onProgress: (phase, frac) => setProgress(phase, frac),
    });
    const secs = ((performance.now() - t0) / 1000).toFixed(1);
    hideLoading();
    bound = true;
    $('#bindStat').textContent = `${stat.bones} bones · ${stat.verts.toLocaleString()} verts · ${q === 'hq' ? 'voxel-geodesic' : 'fast'} · ${secs}s`;
    openSec('secAnim', true); openSec('secExport', true);
    populateAnimList();
    $('#btnEditJoints').style.display = '';
    $('#secAnim').scrollIntoView && 0;
    setStep(4);
    E.setClip('idle'); setClipUI('idle');
    if (window.__studioEmit) window.__studioEmit('studio:bound', { bones: stat.bones });
    toast(`Rigged! ${stat.bones} bones bound in ${secs}s. Play a test clip below.`, 'success');
  } catch (err) {
    hideLoading();
    console.error(err);
    toast('Bind failed: ' + err.message, 'error');
    setStep(2);
  }
}

// ============================================================
// ANIMATION
// ============================================================
$('#clipSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const clip = b.dataset.clip;
  setClipUI(clip);
  clearExtSel();
  E.setClip(clip);
  if (clip !== 'tpose') { E.play(); $('#btnPlay').innerHTML = '❚❚ Pause'; }
  else $('#btnPlay').innerHTML = '▶ Play';
});
function setClipUI(clip) { $$('#clipSeg button').forEach(x => x.classList.toggle('on', x.dataset.clip === clip)); }
$('#btnPlay').addEventListener('click', () => {
  if ($('#extClips button.on')) {
    if (E.isExtPlaying()) { E.pauseExternal(); $('#btnPlay').innerHTML = '▶ Play'; }
    else { E.resumeExternal(); $('#btnPlay').innerHTML = '❚❚ Pause'; }
    return;
  }
  if (E.isPlaying()) { E.pause(); $('#btnPlay').innerHTML = '▶ Play'; }
  else { const p = E.play(); $('#btnPlay').innerHTML = p ? '❚❚ Pause' : '▶ Play'; }
});
$('#btnRebindPose').addEventListener('click', () => { E.restPose(); setClipUI('tpose'); clearExtSel(); $('#btnPlay').innerHTML = '▶ Play'; });

// ---- facing ----
$('#faceSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#faceSeg button').forEach(x => x.classList.toggle('on', x === b));
  E.setFacing(+b.dataset.yaw);
});
// ---- mirror L/R ----
$('#mirrorSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#mirrorSeg button').forEach(x => x.classList.toggle('on', x === b));
  E.setMirror(+b.dataset.mir === 1);
});
// ---- rest-pose compensation ----
$('#compSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#compSeg button').forEach(x => x.classList.toggle('on', x === b));
  E.setPoseComp(+b.dataset.comp === 1);
});

// ---- root motion (hips travel) ----
$('#rootSeg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  $$('#rootSeg button').forEach(x => x.classList.toggle('on', x === b));
  E.setRootMotion(b.dataset.rm === '1');
});

// ---- undo joint placement (Ctrl+Z) ----
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    if (/input|textarea|select/i.test((document.activeElement || {}).tagName || '')) return;
    e.preventDefault();
    E.undoJoint && E.undoJoint();
  }
});

// ---- external animation clips ----
const loadedAnims = {};   // name → File/blob
function clearExtSel() { $$('#extClips button').forEach(x => x.classList.remove('on')); }

async function populateAnimList() {
  const host = $('#extClips'); host.innerHTML = '';
  let data = null;
  try { data = await (await fetch('data/animations/manifest.json')).json(); } catch (_) {}
  let clips = [];
  if (Array.isArray(data)) {
    clips = data.map(x => typeof x === 'string'
      ? { label: x.replace(/\.fbx$/i, ''), path: 'data/animations/' + x } : x);
  } else if (data && Array.isArray(data.clips)) {
    clips = data.clips;
  } else if (data && Array.isArray(data.animations)) {
    clips = data.animations;
  }
  if (!clips.length) {
    host.innerHTML = '<div class="note" style="color:var(--muted-2);">None bundled. Import one →</div>';
    return;
  }
  clips.forEach(c => addAnimButton(c.label || c.path, c.path, c));
}
function addAnimButton(name, url, meta) {
  const host = $('#extClips');
  if (host.querySelector(`[data-anim="${name}"]`)) return host.querySelector(`[data-anim="${name}"]`);
  const empty = host.querySelector('.note'); if (empty) empty.remove();
  const b = document.createElement('button');
  b.className = 'btn ghost sm'; b.style.width = '100%'; b.style.justifyContent = 'flex-start';
  b.dataset.anim = name; b.dataset.url = url || '';
  b.innerHTML = `▶ ${name}`;
  b.addEventListener('click', () => playAnim(name, url, b, meta));
  host.appendChild(b);
  return b;
}
async function playAnim(name, url, btn, meta) {
  if (!bound) { toast('Bind the rig first', 'warn'); return; }
  try {
    showLoading('Retargeting clip', name);
    setProgress('sampling + solving bones', 0.4);
    await new Promise(r => setTimeout(r, 30));
    let file = loadedAnims[name];
    if (!file && url) {
      // chunk-aware fetch — clips over the Cloudflare limit are deployed as
      // .partNNN pieces; chunk-loader reassembles them transparently
      const loader = await import('./chunk-loader.js');
      const blob = await loader.fetchAssetBlob(url, meta ? { chunked: meta.chunked, chunks: meta.chunks } : {});
      file = new File([blob], name + '.fbx'); loadedAnims[name] = file;
    }
    const info = await E.loadExternalClip(file);
    E.playExternal();
    hideLoading();
    clearExtSel(); btn && btn.classList.add('on'); setClipUI(null);
    $('#btnPlay').innerHTML = '❚❚ Pause';
    renderAnimReport(info.report);
    const miss = info.report && info.report.missing.length;
    const apose = info.aposeDeg >= 8 ? ` Rest-pose offset detected (~${info.aposeDeg}° at shoulders) — auto-compensated.` : '';
    toast(miss
      ? `Playing “${info.name}” — ⚠ clip needs ${miss} joint(s) you don't have (see report).${apose}`
      : `Playing “${info.name}” (${info.duration}s).${apose} Wrong way? Use Facing.`, miss ? 'warn' : 'success');
  } catch (err) { hideLoading(); console.error(err); toast('Clip failed: ' + err.message, 'error'); }
}

function renderAnimReport(r) {
  if (!r) { $('#animReport').innerHTML = ''; return; }
  let html = '';
  if (r.missing.length) {
    html += `<div class="callout" style="margin-top:8px;background:rgba(207,92,92,.1);border-color:rgba(207,92,92,.35);color:#e7a3a3;">
      <span class="ic">⚠</span><span><b>Animation requires joints you don't have:</b> ${r.missing.join(', ')}.<br>Add them (preset / groups above) and re-bind for full motion.</span></div>`;
  }
  if (r.unused.length) {
    html += `<div class="note" style="margin-top:6px;color:var(--muted);"><b>Not driven by this clip:</b> ${r.unused.join(', ')} — they'll hold their pose.</div>`;
  }
  if (!r.missing.length && !r.unused.length) {
    html += `<div class="note" style="margin-top:6px;color:var(--good);">✓ Clip and rig match — every joint is driven.</div>`;
  }
  $('#animReport').innerHTML = html;
}

$('#btnImportAnim').addEventListener('click', () => $('#animInput').click());
$('#animInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const name = f.name.replace(/\.fbx$/i, '');
  loadedAnims[name] = f;
  const btn = addAnimButton(name, '');
  playAnim(name, '', btn);
  e.target.value = '';
});

// ============================================================
// EXPORT
// ============================================================
$('#btnExpGlb').addEventListener('click', () => exportRun('glb'));
$('#btnExpGltf').addEventListener('click', () => exportRun('gltf'));
$('#btnExpFbx').addEventListener('click', () => exportRun('fbx'));

async function exportRun(fmt) {
  if (!bound) { toast('Bind first', 'warn'); return; }
  try {
    showLoading('Exporting ' + fmt.toUpperCase(), 'serializing rig');
    setProgress('writing ' + fmt, 0.5);
    await new Promise(r => setTimeout(r, 40));
    let blob, ext;
    if (fmt === 'fbx') { blob = window.FbxExport.export(E.getRigData()); ext = 'fbx'; }
    else { const r = await E.exportGLTF(fmt === 'glb'); blob = r.blob; ext = r.ext; }
    hideLoading();
    const base = (loadedName.replace(/\.[^.]+$/, '') || 'rigged') + '_rigged';
    download(blob, base + '.' + ext);
    toast(`Exported ${base}.${ext} (${(blob.size / 1048576).toFixed(1)} MB)`, 'success');
  } catch (err) { hideLoading(); console.error(err); toast('Export failed: ' + err.message, 'error'); }
}
function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ============================================================
// UI HELPERS — stepper, sections, loading, modal, toast
// ============================================================
function setStep(n) {
  $$('#stepper .step').forEach(s => {
    const i = +s.dataset.step;
    s.classList.toggle('active', i === n);
    s.classList.toggle('done', i < n);
  });
}
$$('.sec-head').forEach(h => h.addEventListener('click', () => {
  document.getElementById(h.dataset.sec).classList.toggle('collapsed');
}));
function openSec(id, open) { const s = document.getElementById(id); if (s) s.classList.toggle('collapsed', !open); }

const loading = $('#loading');
function showLoading(title, phase) {
  $('#loadTitle').textContent = title; $('#loadPhase').textContent = phase || '';
  $('#loadBar').style.width = '0%'; $('#loadPct').textContent = '0%'; $('#loadSub').textContent = '';
  loading.classList.add('show');
}
function setProgress(phase, frac) {
  if (phase != null) $('#loadPhase').textContent = phase;
  if (frac != null) { const p = Math.round(Math.max(0, Math.min(1, frac)) * 100); $('#loadBar').style.width = p + '%'; $('#loadPct').textContent = p + '%'; }
}
function hideLoading() { loading.classList.remove('show'); }

function showModal(sel) { $(sel).classList.add('show'); }
function hideModal(sel) { $(sel).classList.remove('show'); }
$('#hqModal').addEventListener('click', e => { if (e.target.id === 'hqModal') hideModal('#hqModal'); });

let toastT = null;
function toast(msg, kind) {
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.animation = 'tin .2s reverse'; setTimeout(() => el.remove(), 200); }, 4200);
}

// keyboard: F frame, Esc deselect
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'f' || e.key === 'F') E.frame();
  if (e.key === 'Escape') E.selectJoint(null);
});

// ---------- view flip buttons (front/back · side R/L · top/bottom) ----------
const VIEW_LABELS = {
  front: { '1': '⇆ FRONT', '-1': '⇆ BACK' },
  side:  { '1': '⇆ SIDE R', '-1': '⇆ SIDE L' },
  top:   { '1': '⇆ TOP', '-1': '⇆ BOTTOM' },
};
const VIEW_SUB = { front: '· drag X/Y', side: '· drag Z/Y', top: '· drag X/Z' };
[['vpFront', 'front'], ['vpSide', 'side'], ['vpTop', 'top']].forEach(([id, name]) => {
  const el = $('#' + id); if (!el) return;
  el.addEventListener('click', () => {
    const sign = E.flipView(name);
    el.innerHTML = `${VIEW_LABELS[name][String(sign)]} <span class="sub">${VIEW_SUB[name]}</span>`;
  });
});

// ---------- focus mode (isolate body / hands / face) ----------
const FOCUS_NOTE = {
  all:  'Showing every joint. Switch to <b>Hands</b> or <b>Face</b> to hide the rest <i>and snap the mesh solid</i> so fiddly joints read clearly.',
  body: 'Body only — fingers and face joints are hidden and locked so you can\'t nudge them by accident.',
  hands:'Hands only — finger joints + wrists, and the <b>mesh goes solid</b> so you\'re not fighting the x-ray. Handles still draw on top, so grab away.',
  face: 'Face only — eyes, jaw and head, with the <b>mesh solid</b> for a clean read. Everything else is hidden and locked.',
};
$$('#focusSeg button').forEach(b => b.addEventListener('click', () => {
  $$('#focusSeg button').forEach(x => x.classList.toggle('on', x === b));
  const mode = b.dataset.focus;
  E.setFocus(mode);
  $('#focusNote').innerHTML = FOCUS_NOTE[mode] || FOCUS_NOTE.all;
}));

// ---------- maximize / solo a single view ----------
const SOLO_NAMES = { persp: 'PERSPECTIVE', front: 'FRONT', side: 'SIDE', top: 'TOP' };
function syncSoloUI(name) {
  const solo = $('#vpSolo'), labels = $('#vpLabels');
  if (name) {
    $('#vpSoloName').textContent = SOLO_NAMES[name] || name.toUpperCase();
    solo.style.display = 'flex';
    labels.style.display = 'none';
  } else {
    solo.style.display = 'none';
    labels.style.display = '';
  }
}
$$('.vp-max').forEach(b => b.addEventListener('click', e => {
  e.preventDefault(); e.stopPropagation();
  syncSoloUI(E.toggleSolo(b.dataset.view));
}));
$('#vpRestore').addEventListener('click', () => syncSoloUI(E.setSoloView(null)));
if (E.onSolo) E.onSolo(name => syncSoloUI(name));

// ---------- mesh opacity (solid for hands, x-ray for placing) ----------
$('#meshOpacity').addEventListener('input', e => {
  const v = +e.target.value;
  $('#meshOpacityVal').textContent = v + '%';
  E.setMeshOpacity(v / 100);
});
// reflect engine-driven opacity changes (e.g. auto-solid when focusing Hands/Face)
if (E.onMeshOpacity) E.onMeshOpacity((pct, solid, focus) => {
  const sl = $('#meshOpacity'), lab = $('#meshOpacityVal');
  if (sl) sl.value = pct;
  if (lab) lab.textContent = (solid && (focus === 'hands' || focus === 'face')) ? 'SOLID' : pct + '%';
  if (sl) sl.disabled = (focus === 'hands' || focus === 'face');
  if (sl) sl.style.opacity = (focus === 'hands' || focus === 'face') ? '0.4' : '1';
});

// ---------- drag-zone isolate ----------
const btnZone = $('#btnZone'), btnZoneClear = $('#btnZoneClear'), zoneMarquee = $('#zoneMarquee'), vpWrap2 = $('#viewportWrap');
function setZoneArmed(on) {
  btnZone.classList.toggle('on', on);
  btnZone.textContent = on ? '▣ Drag a box…' : '▣ Isolate zone';
  vpWrap2.style.cursor = on ? 'crosshair' : '';
}
btnZone.addEventListener('click', () => { setZoneArmed(E.setZoneMode(!E.getZoneMode())); });
btnZoneClear.addEventListener('click', () => E.clearZone());
if (E.onZoneRect) E.onZoneRect(rect => {
  if (!rect) { zoneMarquee.classList.add('hide'); return; }
  zoneMarquee.classList.remove('hide');
  zoneMarquee.style.left = rect.x + 'px'; zoneMarquee.style.top = rect.y + 'px';
  zoneMarquee.style.width = rect.w + 'px'; zoneMarquee.style.height = rect.h + 'px';
});
if (E.onZoneState) E.onZoneState(active => {
  setZoneArmed(false);
  btnZoneClear.classList.toggle('hide', !active);
});

// ---------- demo hook (for quick verification / first-run preview) ----------
window.RigDemo = async function (clip, q) {
  const res = await fetch('data/characters/humanoid_unrigged.fbx');
  await handleFile(new File([await res.blob()], 'humanoid.fbx'), false);
  await new Promise(r => setTimeout(r, 50));
  await runBind(q || 'fast');
  E.setClip(clip || 'walk'); setClipUI(clip || 'walk'); E.play();
  $('#btnPlay').innerHTML = '❚❚ Pause';
  return 'demo ready';
};

// ============================================================
// STUDIO EMBED BRIDGE
// When AutoRig runs inside the Studio shell (?embed=1) it hides its own
// top bar and talks to the parent via postMessage. Standalone use is
// unaffected (the bridge only acts on messages / when embedded).
// ============================================================
(function () {
  const params = new URLSearchParams(location.search);
  const embedded = params.get('embed') === '1' || window.parent !== window;
  const post = (type, payload, transfer) => {
    try { window.parent && window.parent.postMessage(Object.assign({ __studio: true, type }, payload || {}), '*', transfer || []); } catch (e) {}
  };

  if (embedded) {
    const st = document.createElement('style');
    st.textContent = '.topbar{display:none !important;} .body{height:100vh !important;}';
    document.head.appendChild(st);
    document.body.classList.add('studio-embed');
  }

  async function loadFromUrl(url, name, opts) {
    const blob = await fetchAssetBlob(url, opts);
    await handleFile(new File([blob], name || (url.split('/').pop() || 'model.fbx')), false);
  }

  async function getRiggedGLB(name) {
    if (!E.isBound || !E.isBound()) throw new Error('Rig not bound yet');
    const r = await E.exportGLTF(true);              // binary GLB
    const buf = await r.blob.arrayBuffer();
    return { buffer: buf, name: (name || (loadedName.replace(/\.[^.]+$/, '') || 'rigged')) + '_rigged.glb' };
  }

  window.AutoRigEmbed = {
    loadFromUrl,
    getRiggedGLB,
    isBound: () => !!(E.isBound && E.isBound()),
  };
  window.__studioEmit = post;

  window.addEventListener('message', async (e) => {
    const d = e.data; if (!d || !d.__studio) return;
    try {
      if (d.type === 'studio:loadUrl') { await loadFromUrl(d.url, d.name, { chunked: d.chunked, chunks: d.chunks }); post('studio:loaded', { name: d.name }); }
      else if (d.type === 'studio:getRiggedGLB') {
        const out = await getRiggedGLB(d.name);
        post('studio:riggedGLB', { buffer: out.buffer, name: out.name }, [out.buffer]);
      }
    } catch (err) { post('studio:error', { tool: 'rig', message: String(err && err.message || err) }); }
  });

  // announce readiness so the shell can enable handoff, then mirror key state changes
  setTimeout(() => post('studio:ready', { tool: 'rig' }), 0);
})();

