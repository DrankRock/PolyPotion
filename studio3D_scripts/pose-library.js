// ============================================================
// pose-library.js — window.PPPoseLib  (on-device Text-to-Pose fallback)
// A curated library of ~24 humanoid poses, each expressed in the SAME
// [parent, child, [x,y,z]] "aim" format the AI path already applies via
// PEngine.applyAimList(). A tiny keyword scorer matches the user's text to the
// best pose (and can blend simple arm/leg modifiers) with NO network and NO API
// key — so the privacy-strict user keeps Text-to-Pose entirely offline.
//   PPPoseLib.match("kneeling, arms raised")  ->  { pose, aim, score, note }
//   PPPoseLib.list()  ->  [{id,label,tags}]  (for a browsable picker)
// This is deterministic pattern-matching, not a model — it won't invent novel
// poses, but it covers the common asks and never leaves the device.
// ============================================================
(function () {
  // helper: normalize a direction literal is unnecessary — the engine normalizes.
  const P = (label, tags, aim, note) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, tags, aim, note: note || label });

  // Reference: character faces +Z, +Y up, LEFT on -X, RIGHT on +X.
  const REST_ARMS = [
    ['leftarm', 'leftforearm', [-0.3, -0.95, 0.08]], ['leftforearm', 'lefthand', [-0.28, -0.95, 0.1]],
    ['rightarm', 'rightforearm', [0.3, -0.95, 0.08]], ['rightforearm', 'righthand', [0.28, -0.95, 0.1]],
  ];
  const STAND_LEGS = [
    ['leftupleg', 'leftleg', [-0.05, -1, 0.02]], ['leftleg', 'leftfoot', [-0.03, -0.98, 0.16]],
    ['rightupleg', 'rightleg', [0.05, -1, 0.02]], ['rightleg', 'rightfoot', [0.03, -0.98, 0.16]],
  ];
  const SIT_LEGS = [
    ['leftupleg', 'leftleg', [-0.18, -0.32, 0.93]], ['leftleg', 'leftfoot', [-0.05, -0.97, 0.18]],
    ['rightupleg', 'rightleg', [0.18, -0.32, 0.93]], ['rightleg', 'rightfoot', [0.05, -0.97, 0.18]],
  ];

  const POSES = [
    P('T-pose', ['t-pose', 't pose', 'tpose', 'rest', 'default', 'bind'],
      [['leftarm', 'leftforearm', [-1, 0, 0]], ['leftforearm', 'lefthand', [-1, 0, 0]], ['rightarm', 'rightforearm', [1, 0, 0]], ['rightforearm', 'righthand', [1, 0, 0]], ...STAND_LEGS], 'neutral T-pose'),
    P('A-pose', ['a-pose', 'a pose', 'apose', 'relaxed stand', 'idle'],
      [...REST_ARMS.map(a => a), ...STAND_LEGS], 'relaxed A-pose'),
    P('Standing idle', ['stand', 'standing', 'idle', 'still', 'neutral'],
      [...REST_ARMS, ...STAND_LEGS, ['spine', 'chest', [0, 1, 0.02]]], 'standing at ease'),
    P('Waving hello', ['wave', 'waving', 'hello', 'hi', 'greet', 'greeting'],
      [['rightarm', 'rightforearm', [0.74, 0.66, 0.1]], ['rightforearm', 'righthand', [0.42, 0.9, 0.1]], ['leftarm', 'leftforearm', [-0.42, -0.9, 0.08]], ['leftforearm', 'lefthand', [-0.42, -0.9, 0.08]], ['neck', 'head', [0.16, 0.97, 0.05]], ...STAND_LEGS], 'cheery wave'),
    P('Arms raised', ['arms raised', 'arms up', 'hands up', 'reach up', 'raise', 'celebrate', 'victory', 'cheer', 'hooray'],
      [['leftarm', 'leftforearm', [-0.35, 0.92, 0.08]], ['leftforearm', 'lefthand', [-0.2, 0.97, 0.05]], ['rightarm', 'rightforearm', [0.35, 0.92, 0.08]], ['rightforearm', 'righthand', [0.2, 0.97, 0.05]], ...STAND_LEGS, ['spine', 'chest', [0, 0.99, 0.08]]], 'arms to the sky'),
    P('Cheering', ['cheer', 'celebrate', 'yay', 'excited', 'win', 'triumph'],
      [['leftarm', 'leftforearm', [-0.5, 0.84, 0.12]], ['leftforearm', 'lefthand', [-0.35, 0.93, 0.1]], ['rightarm', 'rightforearm', [0.5, 0.84, 0.12]], ['rightforearm', 'righthand', [0.35, 0.93, 0.1]], ['leftupleg', 'leftleg', [-0.1, -0.98, 0.1]], ['leftleg', 'leftfoot', [-0.05, -0.9, 0.35]], ...STAND_LEGS.slice(2), ['spine', 'chest', [0, 0.98, 0.14]]], 'triumphant cheer'),
    P('Kneeling', ['kneel', 'kneeling', 'propose', 'proposal', 'knee'],
      [['leftupleg', 'leftleg', [-0.12, -0.35, 0.9]], ['leftleg', 'leftfoot', [-0.05, -0.95, -0.2]], ['rightupleg', 'rightleg', [0.16, -0.5, 0.8]], ['rightleg', 'rightfoot', [0.06, -0.97, 0.16]], ...REST_ARMS, ['spine', 'chest', [0, 0.99, 0.06]]], 'kneeling on one knee'),
    P('Sitting', ['sit', 'sitting', 'seated', 'chair', 'sit down'],
      [...SIT_LEGS, ['leftarm', 'leftforearm', [-0.42, -0.86, 0.28]], ['leftforearm', 'lefthand', [-0.2, -0.6, 0.77]], ['rightarm', 'rightforearm', [0.42, -0.86, 0.28]], ['rightforearm', 'righthand', [0.2, -0.6, 0.77]], ['spine', 'chest', [0, 0.99, -0.05]]], 'seated, hands on thighs'),
    P('Crouching', ['crouch', 'crouching', 'squat', 'squatting', 'duck', 'low'],
      [['leftupleg', 'leftleg', [-0.2, -0.3, 0.93]], ['leftleg', 'leftfoot', [-0.1, -0.95, -0.25]], ['rightupleg', 'rightleg', [0.2, -0.3, 0.93]], ['rightleg', 'rightfoot', [0.1, -0.95, -0.25]], ...REST_ARMS.map(a => [a[0], a[1], [a[2][0], -0.4, 0.85]]), ['spine', 'chest', [0, 0.9, 0.4]]], 'low crouch'),
    P('Running', ['run', 'running', 'sprint', 'jog', 'dash'],
      [['leftupleg', 'leftleg', [-0.06, -0.5, 0.86]], ['leftleg', 'leftfoot', [-0.04, -0.7, -0.5]], ['rightupleg', 'rightleg', [0.06, -0.7, -0.55]], ['rightleg', 'rightfoot', [0.03, -0.92, 0.1]], ['leftarm', 'leftforearm', [-0.3, -0.3, -0.85]], ['leftforearm', 'lefthand', [-0.25, 0.2, -0.9]], ['rightarm', 'rightforearm', [0.3, -0.3, 0.85]], ['rightforearm', 'righthand', [0.25, 0.2, 0.9]], ['spine', 'chest', [0, 0.95, 0.28]]], 'mid-run stride'),
    P('Walking', ['walk', 'walking', 'stroll', 'step'],
      [['leftupleg', 'leftleg', [-0.06, -0.72, 0.65]], ['leftleg', 'leftfoot', [-0.04, -0.95, -0.1]], ['rightupleg', 'rightleg', [0.06, -0.85, -0.4]], ['rightleg', 'rightfoot', [0.03, -0.96, 0.16]], ['leftarm', 'leftforearm', [-0.28, -0.86, -0.4]], ['leftforearm', 'lefthand', [-0.26, -0.9, -0.3]], ['rightarm', 'rightforearm', [0.28, -0.86, 0.4]], ['rightforearm', 'righthand', [0.26, -0.9, 0.3]]], 'mid-walk step'),
    P('Jumping', ['jump', 'jumping', 'leap', 'hop', 'bound'],
      [['leftarm', 'leftforearm', [-0.4, 0.88, 0.1]], ['leftforearm', 'lefthand', [-0.25, 0.96, 0.05]], ['rightarm', 'rightforearm', [0.4, 0.88, 0.1]], ['rightforearm', 'righthand', [0.25, 0.96, 0.05]], ['leftupleg', 'leftleg', [-0.12, -0.5, 0.82]], ['leftleg', 'leftfoot', [-0.05, -0.85, -0.4]], ['rightupleg', 'rightleg', [0.12, -0.6, 0.75]], ['rightleg', 'rightfoot', [0.05, -0.9, -0.3]], ['spine', 'chest', [0, 0.98, 0.1]]], 'airborne leap'),
    P('Fighting stance', ['fight', 'fighting', 'combat', 'boxing', 'punch', 'guard', 'martial', 'ready'],
      [['leftarm', 'leftforearm', [-0.5, -0.2, 0.84]], ['leftforearm', 'lefthand', [-0.25, 0.3, 0.92]], ['rightarm', 'rightforearm', [0.55, -0.35, 0.75]], ['rightforearm', 'righthand', [0.3, 0.1, 0.95]], ['leftupleg', 'leftleg', [-0.14, -0.94, 0.3]], ['leftleg', 'leftfoot', [-0.08, -0.96, 0.05]], ['rightupleg', 'rightleg', [0.16, -0.9, -0.35]], ['rightleg', 'rightfoot', [0.06, -0.95, 0.1]], ['spine', 'chest', [0.08, 0.96, 0.24]]], 'guarded fighting stance'),
    P('Thinking', ['think', 'thinking', 'ponder', 'wonder', 'hmm', 'idea'],
      [['rightarm', 'rightforearm', [0.5, -0.2, 0.84]], ['rightforearm', 'righthand', [0.05, 0.7, 0.7]], ['leftarm', 'leftforearm', [-0.4, -0.8, 0.3]], ['leftforearm', 'lefthand', [0.1, -0.4, 0.5]], ['neck', 'head', [0.05, 0.96, 0.25]], ...STAND_LEGS, ['spine', 'chest', [0.02, 0.99, 0.05]]], 'hand to chin'),
    P('Bowing', ['bow', 'bowing', 'respect', 'greet formal', 'thank you'],
      [['spine', 'chest', [0, 0.5, 0.86]], ['neck', 'head', [0, 0.4, 0.9]], ...REST_ARMS, ...STAND_LEGS], 'respectful bow'),
    P('Pointing', ['point', 'pointing', 'that way', 'over there', 'indicate'],
      [['rightarm', 'rightforearm', [0.9, 0.1, 0.4]], ['rightforearm', 'righthand', [0.95, 0.05, 0.3]], ['leftarm', 'leftforearm', [-0.35, -0.9, 0.1]], ['leftforearm', 'lefthand', [-0.3, -0.92, 0.1]], ['neck', 'head', [0.3, 0.9, 0.2]], ...STAND_LEGS], 'pointing ahead'),
    P('Hands on hips', ['hands on hips', 'hips', 'akimbo', 'confident', 'proud', 'superhero'],
      [['leftarm', 'leftforearm', [-0.75, -0.5, 0.2]], ['leftforearm', 'lefthand', [-0.2, -0.55, 0.4]], ['rightarm', 'rightforearm', [0.75, -0.5, 0.2]], ['rightforearm', 'righthand', [0.2, -0.55, 0.4]], ...STAND_LEGS, ['spine', 'chest', [0, 1, 0]]], 'confident, hands on hips'),
    P('Crossed arms', ['cross', 'crossed arms', 'arms crossed', 'folded', 'skeptical', 'wait'],
      [['leftarm', 'leftforearm', [-0.55, -0.6, 0.55]], ['leftforearm', 'lefthand', [0.5, -0.4, 0.6]], ['rightarm', 'rightforearm', [0.55, -0.6, 0.55]], ['rightforearm', 'righthand', [-0.5, -0.4, 0.6]], ...STAND_LEGS], 'arms folded'),
    P('Reaching forward', ['reach', 'reaching', 'grab', 'forward', 'take', 'give'],
      [['leftarm', 'leftforearm', [-0.35, -0.2, 0.92]], ['leftforearm', 'lefthand', [-0.25, -0.05, 0.97]], ['rightarm', 'rightforearm', [0.35, -0.2, 0.92]], ['rightforearm', 'righthand', [0.25, -0.05, 0.97]], ...STAND_LEGS, ['spine', 'chest', [0, 0.97, 0.22]]], 'reaching out'),
    P('Falling', ['fall', 'falling', 'tumble', 'flail'],
      [['leftarm', 'leftforearm', [-0.7, 0.6, -0.3]], ['leftforearm', 'lefthand', [-0.55, 0.8, -0.2]], ['rightarm', 'rightforearm', [0.7, 0.55, 0.3]], ['rightforearm', 'righthand', [0.6, 0.75, 0.2]], ['leftupleg', 'leftleg', [-0.2, -0.6, 0.75]], ['leftleg', 'leftfoot', [-0.1, -0.9, 0.3]], ['rightupleg', 'rightleg', [0.25, -0.7, -0.6]], ['rightleg', 'rightfoot', [0.1, -0.92, 0.1]], ['spine', 'chest', [0.1, 0.9, -0.3]]], 'off-balance flail'),
    P('Sleeping', ['sleep', 'sleeping', 'lie down', 'lying', 'rest flat'],
      [['spine', 'chest', [0, 0.2, 0.97]], ['neck', 'head', [0, 0.3, 0.95]], ['leftarm', 'leftforearm', [-0.85, -0.1, 0.4]], ['leftforearm', 'lefthand', [-0.9, 0.0, 0.3]], ['rightarm', 'rightforearm', [0.85, -0.1, 0.4]], ['rightforearm', 'righthand', [0.9, 0.0, 0.3]], ['leftupleg', 'leftleg', [-0.1, -0.2, 0.95]], ['leftleg', 'leftfoot', [-0.05, -0.3, 0.92]], ['rightupleg', 'rightleg', [0.1, -0.2, 0.95]], ['rightleg', 'rightfoot', [0.05, -0.3, 0.92]]], 'lying at rest'),
    P('Dancing', ['dance', 'dancing', 'groove', 'party', 'boogie'],
      [['leftarm', 'leftforearm', [-0.5, 0.7, 0.5]], ['leftforearm', 'lefthand', [-0.3, 0.9, 0.3]], ['rightarm', 'rightforearm', [0.7, -0.5, 0.5]], ['rightforearm', 'righthand', [0.5, 0.0, 0.86]], ['leftupleg', 'leftleg', [-0.2, -0.95, 0.2]], ['leftleg', 'leftfoot', [-0.1, -0.96, 0.1]], ['rightupleg', 'rightleg', [0.25, -0.85, 0.4]], ['rightleg', 'rightfoot', [0.1, -0.9, -0.3]], ['spine', 'chest', [0.15, 0.96, 0.1]]], 'mid-dance'),
    P('Shooting bow', ['bow and arrow', 'archer', 'archery', 'shoot', 'aim bow', 'draw bow'],
      [['leftarm', 'leftforearm', [-0.92, 0.05, 0.36]], ['leftforearm', 'lefthand', [-0.96, 0.0, 0.25]], ['rightarm', 'rightforearm', [0.5, -0.1, -0.86]], ['rightforearm', 'righthand', [0.2, 0.1, -0.6]], ['leftupleg', 'leftleg', [-0.16, -0.94, 0.28]], ['leftleg', 'leftfoot', [-0.08, -0.96, 0.05]], ['rightupleg', 'rightleg', [0.18, -0.9, -0.36]], ['rightleg', 'rightfoot', [0.06, -0.95, 0.1]], ['spine', 'chest', [-0.1, 0.96, 0.05]], ['neck', 'head', [-0.4, 0.85, 0.3]]], 'drawing a bow'),
    P('Flying', ['fly', 'flying', 'superhero fly', 'soar', 'super'],
      [['leftarm', 'leftforearm', [-0.4, 0.5, 0.77]], ['leftforearm', 'lefthand', [-0.25, 0.4, 0.88]], ['rightarm', 'rightforearm', [0.3, 0.7, 0.65]], ['rightforearm', 'righthand', [0.2, 0.85, 0.5]], ['leftupleg', 'leftleg', [-0.06, -0.98, -0.1]], ['leftleg', 'leftfoot', [-0.03, -0.9, -0.4]], ['rightupleg', 'rightleg', [0.08, -0.9, -0.3]], ['rightleg', 'rightfoot', [0.04, -0.85, -0.5]], ['spine', 'chest', [0, 0.94, 0.34]], ['neck', 'head', [0, 0.8, 0.6]]], 'soaring forward'),
  ];

  const STOP = new Set(['a', 'an', 'the', 'is', 'with', 'and', 'to', 'of', 'in', 'on', 'his', 'her', 'their', 'pose', 'posed', 'posing', 'character', 'person', 'figure', 'body', 'both', 'up', 'down', 'like', 'as', 'while', 'doing', 'make', 'making']);
  function tokenize(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !STOP.has(w));
  }

  function score(query, pose) {
    const q = ' ' + query.toLowerCase() + ' ';
    const toks = tokenize(query);
    let s = 0;
    for (const tag of pose.tags) {
      if (q.includes(' ' + tag + ' ')) s += tag.includes(' ') ? 6 : 4;   // whole-phrase / word hit
      else { for (const t of toks) { if (t === tag) s += 4; else if (tag.includes(t) && t.length > 3) s += 1.5; else if (t.includes(tag) && tag.length > 3) s += 1.5; } }
    }
    // small bonus if the label words appear
    for (const t of toks) if (pose.label.toLowerCase().includes(t)) s += 1;
    return s;
  }

  const PPPoseLib = {
    list() { return POSES.map(p => ({ id: p.id, label: p.label, tags: p.tags.slice(0, 4) })); },
    get(id) { const p = POSES.find(x => x.id === id); return p ? { pose: p.label, aim: p.aim, note: p.note, score: 99 } : null; },
    match(text) {
      let best = null, bestScore = 0;
      for (const p of POSES) { const s = score(text, p); if (s > bestScore) { bestScore = s; best = p; } }
      if (!best || bestScore < 3) return null;   // too weak — let the caller offer the picker
      return { pose: best.label, aim: best.aim, note: best.note, score: bestScore };
    },
  };
  try { window.PPPoseLib = PPPoseLib; } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) module.exports = { PPPoseLib };
})();
