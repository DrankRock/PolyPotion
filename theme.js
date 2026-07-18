/* ============================================================
   theme.js — shared PolyPotion theme engine
   Owns the full CSS-variable palette + fonts for every tool and the shell.
   Reads/writes one localStorage key so all same-origin tool iframes start in
   sync; the shell broadcasts live switches over postMessage. apply() also
   fires a 'studiothemechange' window event.

   Add a theme in three steps:
     1. write its full variable map below (copy an existing one as a base)
     2. add it to THEMES
     3. add a META entry (label + dark flag + 3-colour swatch) and list it
        in ORDER — that's all the shell's picker needs.
   ============================================================ */
(function () {
  var FONTS = "https://fonts.googleapis.com/css2?" +
    "family=Pixelify+Sans:wght@400;500;600;700&" +
    "family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,600&" +
    "family=Archivo:wght@400;500;600;700&" +
    "family=Spline+Sans+Mono:wght@400;500&display=swap";

  function injectFonts() {
    if (document.getElementById('studio-fonts')) return;
    var l = document.createElement('link');
    l.id = 'studio-fonts'; l.rel = 'stylesheet'; l.href = FONTS;
    (document.head || document.documentElement).appendChild(l);
  }

  // cozy pixel personality, shared by the light + warm themes
  var COZY = { '--font-ui': "'Nunito', system-ui, sans-serif", '--font-mono': "'Pixelify Sans', monospace" };
  var SLEEK = { '--font-ui': "'Archivo', system-ui, sans-serif", '--font-mono': "'Spline Sans Mono', monospace" };

  // ---------- CUTE LIGHT (the original — untouched) ----------
  var CUTE = {
    '--bg': '#f6e7c9', '--gutter': '#ecd9b3',
    '--panel': '#fbf1d9', '--panel-2': '#fff7e3', '--panel2': '#fff7e3',
    '--panel-3': '#f3e3c0', '--panel3': '#f3e3c0',
    '--header': '#f3e6c8', '--row': '#fbf1d9', '--row-hover': '#fff7e3',
    '--seam': '#6b4a2b', '--edge': '#6b4a2b', '--edge-2': '#9c6b3f', '--edge2': '#9c6b3f',
    '--muted': '#a98a63', '--muted2': '#bfa279', '--muted-2': '#bfa279',
    '--text': '#5a3e28', '--text-2': '#8a6a4a', '--text2': '#8a6a4a',
    '--accent': '#c8743c', '--accent-dim': 'rgba(200,116,60,.16)', '--accentDim': 'rgba(200,116,60,.16)',
    '--active': '#c8743c', '--active-dim': 'rgba(200,116,60,.16)', '--activeDim': 'rgba(200,116,60,.16)',
    '--on-accent': '#fff6e0', '--onAccent': '#fff6e0',
    '--viewport': '#cdba90',
    '--good': '#6e9355', '--warn': '#e0a93b', '--danger': '#c2562f', '--new': '#5a76b8',
    '--ink': '#5a3e28', '--ink-soft': '#8a6a4a', '--cream': '#fbf1d9', '--cream-2': '#fff7e3',
    '--parchment': '#f6e7c9', '--wood': '#9c6b3f', '--wood-dark': '#6b4a2b',
    '--clay': '#c8743c', '--sage': '#6e9355', '--sage-deep': '#527040', '--honey': '#e0a93b',
    '--font-ui': COZY['--font-ui'], '--font-mono': COZY['--font-mono'],
  };

  // ---------- MEADOW (a cooler, mossy light) ----------
  var MEADOW = {
    '--bg': '#eef3e2', '--gutter': '#dce7c8',
    '--panel': '#f5f9ec', '--panel-2': '#fbfdf5', '--panel2': '#fbfdf5',
    '--panel-3': '#e7efd6', '--panel3': '#e7efd6',
    '--header': '#e9f0da', '--row': '#f5f9ec', '--row-hover': '#fbfdf5',
    '--seam': '#3f5a34', '--edge': '#3f5a34', '--edge-2': '#5f7a44', '--edge2': '#5f7a44',
    '--muted': '#7f9668', '--muted2': '#98ab80', '--muted-2': '#98ab80',
    '--text': '#31462a', '--text-2': '#587046', '--text2': '#587046',
    '--accent': '#4e8f4a', '--accent-dim': 'rgba(78,143,74,.15)', '--accentDim': 'rgba(78,143,74,.15)',
    '--active': '#4e8f4a', '--active-dim': 'rgba(78,143,74,.15)', '--activeDim': 'rgba(78,143,74,.15)',
    '--on-accent': '#f2f8ea', '--onAccent': '#f2f8ea',
    '--viewport': '#c3d3a6',
    '--good': '#4e8f4a', '--warn': '#d9a53b', '--danger': '#c2562f', '--new': '#4a86b8',
    '--ink': '#31462a', '--ink-soft': '#587046', '--cream': '#f5f9ec', '--cream-2': '#fbfdf5',
    '--parchment': '#eef3e2', '--wood': '#6f8a4a', '--wood-dark': '#3f5a34',
    '--clay': '#4e8f4a', '--sage': '#6ea84e', '--sage-deep': '#4e7a3a', '--honey': '#d9a53b',
    '--font-ui': COZY['--font-ui'], '--font-mono': COZY['--font-mono'],
  };

  // ---------- CUTE DARK (cozy espresso night) ----------
  var CUTE_DARK = {
    '--bg': '#241a12', '--gutter': '#180f09',
    '--panel': '#2e2118', '--panel-2': '#382a1e', '--panel2': '#382a1e',
    '--panel-3': '#42301f', '--panel3': '#42301f',
    '--header': '#2a1d14', '--row': '#382a1e', '--row-hover': '#42301f',
    '--seam': '#0e0805', '--edge': '#4d3826', '--edge-2': '#634a30', '--edge2': '#634a30',
    '--muted': '#b0906a', '--muted2': '#8f7052', '--muted-2': '#8f7052',
    '--text': '#f6ead6', '--text-2': '#cbb08c', '--text2': '#cbb08c',
    '--accent': '#e6934f', '--accent-dim': 'rgba(230,147,79,.18)', '--accentDim': 'rgba(230,147,79,.18)',
    '--active': '#e6934f', '--active-dim': 'rgba(230,147,79,.18)', '--activeDim': 'rgba(230,147,79,.18)',
    '--on-accent': '#2a1408', '--onAccent': '#2a1408',
    '--viewport': '#1c140d',
    '--good': '#86bd68', '--warn': '#e6b455', '--danger': '#e0745a', '--new': '#86a6e0',
    '--ink': '#f6ead6', '--ink-soft': '#cbb08c', '--cream': '#2e2118', '--cream-2': '#382a1e',
    '--parchment': '#241a12', '--wood': '#7a5230', '--wood-dark': '#4a3018',
    '--clay': '#e6934f', '--sage': '#86bd68', '--sage-deep': '#669a4c', '--honey': '#e6b455',
    '--font-ui': COZY['--font-ui'], '--font-mono': COZY['--font-mono'],
  };

  // ---------- WITCHY (aubergine · amethyst · elixir green) ----------
  var WITCHY = {
    '--bg': '#191225', '--gutter': '#100b1a',
    '--panel': '#221934', '--panel-2': '#2a1f40', '--panel2': '#2a1f40',
    '--panel-3': '#33264d', '--panel3': '#33264d',
    '--header': '#1f1730', '--row': '#2a1f40', '--row-hover': '#33264d',
    '--seam': '#0c0817', '--edge': '#453463', '--edge-2': '#59457f', '--edge2': '#59457f',
    '--muted': '#a08cc4', '--muted2': '#7e6aa6', '--muted-2': '#7e6aa6',
    '--text': '#eee6fc', '--text-2': '#bcaae0', '--text2': '#bcaae0',
    '--accent': '#b06be6', '--accent-dim': 'rgba(176,107,230,.20)', '--accentDim': 'rgba(176,107,230,.20)',
    '--active': '#b06be6', '--active-dim': 'rgba(176,107,230,.20)', '--activeDim': 'rgba(176,107,230,.20)',
    '--on-accent': '#1a0f2a', '--onAccent': '#1a0f2a',
    '--viewport': '#120c1f',
    '--good': '#4fd19a', '--warn': '#e6c14f', '--danger': '#e0607f', '--new': '#6bc0e6',
    '--ink': '#eee6fc', '--ink-soft': '#bcaae0', '--cream': '#221934', '--cream-2': '#2a1f40',
    '--parchment': '#191225', '--wood': '#4c3a6e', '--wood-dark': '#2b2044',
    '--clay': '#b06be6', '--sage': '#4fd19a', '--sage-deep': '#37a074', '--honey': '#e6c14f',
    '--font-ui': COZY['--font-ui'], '--font-mono': COZY['--font-mono'],
  };

  // ---------- MIDNIGHT (sleek neutral — the classic dark) ----------
  var MIDNIGHT = {
    '--bg': '#141312', '--gutter': '#0b0b0a',
    '--panel': '#1c1b19', '--panel-2': '#211f1c', '--panel2': '#211f1c',
    '--panel-3': '#2a2823', '--panel3': '#2a2823',
    '--header': '#201e1b', '--row': '#211f1c', '--row-hover': '#2a2823',
    '--seam': '#070706', '--edge': '#34322d', '--edge-2': '#423f39', '--edge2': '#423f39',
    '--muted': '#6e6a60', '--muted2': '#4a4841', '--muted-2': '#4a4841',
    '--text': '#e9e6dd', '--text-2': '#9b958a', '--text2': '#9b958a',
    '--accent': '#ff4f00', '--accent-dim': 'rgba(255,79,0,.16)', '--accentDim': 'rgba(255,79,0,.16)',
    '--active': '#ff4f00', '--active-dim': 'rgba(255,79,0,.16)', '--activeDim': 'rgba(255,79,0,.16)',
    '--on-accent': '#2a1000', '--onAccent': '#2a1000',
    '--viewport': '#16181c',
    '--good': '#6fae5b', '--warn': '#e0a93b', '--danger': '#d65a4a', '--new': '#5bb8c4',
    '--ink': '#e9e6dd', '--ink-soft': '#9b958a', '--cream': '#1c1b19', '--cream-2': '#211f1c',
    '--parchment': '#141312', '--wood': '#2a2823', '--wood-dark': '#34322d',
    '--clay': '#ff4f00', '--sage': '#6fae5b', '--sage-deep': '#5a924c', '--honey': '#e0a93b',
    '--font-ui': SLEEK['--font-ui'], '--font-mono': SLEEK['--font-mono'],
  };

  var THEMES = { cute: CUTE, meadow: MEADOW, cuteDark: CUTE_DARK, witchy: WITCHY, midnight: MIDNIGHT };

  // display order + picker metadata (label, dark flag, 3-colour swatch)
  var ORDER = ['cute', 'meadow', 'cuteDark', 'witchy', 'midnight'];
  var META = {
    cute:     { label: 'Cute Light', dark: false, swatch: ['#c8743c', '#6e9355', '#e0a93b'] },
    meadow:   { label: 'Meadow',     dark: false, swatch: ['#4e8f4a', '#6f8a4a', '#d9a53b'] },
    cuteDark: { label: 'Cute Dark',  dark: true,  swatch: ['#e6934f', '#86bd68', '#2e2118'] },
    witchy:   { label: 'Witchy',     dark: true,  swatch: ['#b06be6', '#4fd19a', '#221934'] },
    midnight: { label: 'Midnight',   dark: true,  swatch: ['#ff4f00', '#5bb8c4', '#1c1b19'] },
  };

  // old key aliases so saved sessions don't break
  var ALIAS = { dark: 'midnight', light: 'cute' };
  var KEY = 'studio.theme';

  function normalize(name) { if (THEMES[name]) return name; if (ALIAS[name] && THEMES[ALIAS[name]]) return ALIAS[name]; return 'cute'; }
  function read() { try { return normalize(localStorage.getItem(KEY)); } catch (e) { return 'cute'; } }

  function apply(name) {
    var t = normalize(name);
    var vars = THEMES[t], r = document.documentElement;
    for (var k in vars) r.style.setProperty(k, vars[k]);
    r.setAttribute('data-studio-theme', t);
    r.setAttribute('data-theme-dark', META[t] && META[t].dark ? '1' : '0');
    window.__studioTheme = t;
    try { localStorage.setItem(KEY, t); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('studiothemechange', { detail: t })); } catch (e) {}
  }

  function broadcast() {
    var n = window.__studioTheme;
    var fr = document.querySelectorAll('iframe');
    for (var i = 0; i < fr.length; i++) {
      try { fr[i].contentWindow.postMessage({ __studioTheme: true, name: n }, '*'); } catch (e) {}
    }
  }

  function set(name) { apply(name); broadcast(); }
  function next() { var i = ORDER.indexOf(window.__studioTheme); return ORDER[(i + 1) % ORDER.length]; }
  function toggle() { set(next()); }               // cycles through every theme
  function list() { return ORDER.map(function (n) { return { name: n, label: META[n].label, dark: META[n].dark, swatch: META[n].swatch.slice() }; }); }

  // receive live switches from the shell
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.__studioTheme && d.name) apply(d.name);
  });

  // ---- global error pulse ----
  // Every tool loads theme.js, so this is the ONE place a crashed engine can
  // wave at the shell: uncaught errors/rejections inside a tool iframe post
  // studio:toolError to the parent, which shows a toast + "Reload tool".
  // Throttled hard so an error loop can't flood the bridge.
  if (window !== window.top) {
    var _errN = 0, _errT0 = 0;
    var reportErr = function (msg) {
      var now = Date.now();
      if (now - _errT0 > 60000) { _errN = 0; _errT0 = now; }
      if (++_errN > 3) return;
      try { window.parent.postMessage({ __studio: true, type: 'studio:toolError', message: String(msg || 'Script error').slice(0, 300) }, '*'); } catch (e) {}
    };
    window.addEventListener('error', function (e) { reportErr(e && e.message); });
    window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; reportErr((r && r.message) || r); });
  }

  injectFonts();
  apply(read());

  window.StudioTheme = {
    apply: set, set: set, toggle: toggle, next: next, broadcast: broadcast,
    get: function () { return window.__studioTheme; },
    list: list, THEMES: THEMES, META: META, ORDER: ORDER,
  };
})();
