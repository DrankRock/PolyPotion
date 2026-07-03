/* ============================================================
   theme.js — shared Studio theme engine (cute / dark)
   Owns the full CSS-variable palette + fonts for every tool and the
   shell. Reads/writes one localStorage key so all same-origin tool
   iframes start in sync; the shell broadcasts live switches over
   postMessage. Apply also fires a 'studiothemechange' window event.
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

  var CUTE = {
    // base surfaces
    '--bg': '#f6e7c9', '--gutter': '#ecd9b3',
    '--panel': '#fbf1d9', '--panel-2': '#fff7e3', '--panel2': '#fff7e3',
    '--panel-3': '#f3e3c0', '--panel3': '#f3e3c0',
    '--header': '#f3e6c8', '--row': '#fbf1d9', '--row-hover': '#fff7e3',
    // lines / muted
    '--seam': '#6b4a2b', '--edge': '#6b4a2b', '--edge-2': '#9c6b3f', '--edge2': '#9c6b3f',
    '--muted': '#a98a63', '--muted2': '#bfa279', '--muted-2': '#bfa279',
    // text
    '--text': '#5a3e28', '--text-2': '#8a6a4a', '--text2': '#8a6a4a',
    // accent
    '--accent': '#c8743c', '--accent-dim': 'rgba(200,116,60,.16)', '--accentDim': 'rgba(200,116,60,.16)',
    '--active': '#c8743c', '--active-dim': 'rgba(200,116,60,.16)', '--activeDim': 'rgba(200,116,60,.16)',
    '--on-accent': '#fff6e0', '--onAccent': '#fff6e0',
    '--viewport': '#cdba90',
    // semantic
    '--good': '#6e9355', '--warn': '#e0a93b', '--danger': '#c2562f', '--new': '#5a76b8',
    // shell-specific (cozy)
    '--ink': '#5a3e28', '--ink-soft': '#8a6a4a', '--cream': '#fbf1d9', '--cream-2': '#fff7e3',
    '--parchment': '#f6e7c9', '--wood': '#9c6b3f', '--wood-dark': '#6b4a2b',
    '--clay': '#c8743c', '--sage': '#6e9355', '--sage-deep': '#527040', '--honey': '#e0a93b',
    // fonts
    '--font-ui': "'Nunito', system-ui, sans-serif",
    '--font-mono': "'Pixelify Sans', monospace",
  };

  var DARK = {
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
    '--font-ui': "'Archivo', system-ui, sans-serif",
    '--font-mono': "'Spline Sans Mono', monospace",
  };

  var THEMES = { cute: CUTE, dark: DARK };
  var KEY = 'studio.theme';

  function read() { try { return localStorage.getItem(KEY) || 'cute'; } catch (e) { return 'cute'; } }

  function apply(name) {
    var t = THEMES[name] ? name : 'cute';
    var vars = THEMES[t], r = document.documentElement;
    for (var k in vars) r.style.setProperty(k, vars[k]);
    r.setAttribute('data-studio-theme', t);
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
  function toggle() { set(window.__studioTheme === 'dark' ? 'cute' : 'dark'); }

  // receive live switches from the shell
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (d && d.__studioTheme && d.name) apply(d.name);
  });

  injectFonts();
  apply(read());

  window.StudioTheme = {
    apply: set, set: set, toggle: toggle, broadcast: broadcast,
    get: function () { return window.__studioTheme; }, THEMES: THEMES,
  };
})();
