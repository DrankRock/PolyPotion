// ============================================================
// passport-export.js — the character "passport" (audit, mind-blowers §3)
// Exports ONE self-contained .html file: the GLB embedded as base64, a tiny
// hand-written WebGL viewer (zero dependencies — no CDN, no three.js, so the
// file opens OFFLINE in any browser), and a stats / credits / licence footer.
// The ⤓ button inside the passport re-downloads the embedded GLB, so the
// passport doubles as the asset carrier: view it, then extract the model.
// Everything runs on-device. No upload, no server.
// ============================================================

// ---- GLB JSON chunk (stats need no geometry decode) ----
function readJSONChunk(buffer) {
  const dv = new DataView(buffer);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('Not a GLB file');
  const len = dv.getUint32(8, true);
  let off = 12;
  while (off < len) {
    const clen = dv.getUint32(off, true), ctype = dv.getUint32(off + 4, true);
    if (ctype === 0x4E4F534A) return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, off + 8, clen)));
    off += 8 + clen; off = (off + 3) & ~3;
  }
  throw new Error('GLB has no JSON chunk');
}

function kfmt(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k';
  return String(n);
}
function sizeFmt(b) {
  if (b >= 1 << 20) return (b / (1 << 20)).toFixed(1) + ' MB';
  if (b >= 1 << 10) return (b / (1 << 10)).toFixed(0) + ' KB';
  return b + ' B';
}

export function glbStats(buffer) {
  const json = readJSONChunk(buffer);
  let tris = 0, verts = 0, morphs = 0;
  (json.meshes || []).forEach(m => {
    (m.primitives || []).forEach(p => {
      const attrs = p.attributes || {};
      if (attrs.POSITION != null) verts += json.accessors[attrs.POSITION].count;
      const mode = p.mode == null ? 4 : p.mode;
      if (mode === 4) {
        const n = p.indices != null ? json.accessors[p.indices].count
          : (attrs.POSITION != null ? json.accessors[attrs.POSITION].count : 0);
        tris += Math.floor(n / 3);
      }
    });
    const t = m.primitives && m.primitives[0] && m.primitives[0].targets;
    if (t) morphs += t.length;
  });
  const joints = new Set();
  (json.skins || []).forEach(s => (s.joints || []).forEach(j => joints.add(j)));
  const anims = (json.animations || []).map((a, i) => a.name || ('clip ' + (i + 1)));
  return {
    tris, verts, morphs, bones: joints.size,
    materials: (json.materials || []).length,
    textures: (json.images || []).length,
    anims, size: buffer.byteLength,
    trisLabel: kfmt(tris), vertsLabel: kfmt(verts), sizeLabel: sizeFmt(buffer.byteLength),
  };
}

function toB64(buffer) {
  const u = new Uint8Array(buffer);
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < u.length; i += CH) s += String.fromCharCode.apply(null, u.subarray(i, i + CH));
  return btoa(s);
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// The embedded viewer. Plain WebGL1, ~zero deps: parses the GLB itself,
// draws every triangle primitive with baseColor factor/texture + vertex
// colours, orbit/zoom controls, gentle auto-turntable. Skinned meshes render
// at bind pose (node transform ignored per glTF spec). Morphs render at base.
// NOTE: no backticks / ${ } in this string — it is injected via split/join.
// ============================================================
const VIEWER_SRC = String.raw`
(function () {
'use strict';
var hint = document.getElementById('vhint');
function fail(msg) { hint.textContent = '\u26a0 ' + msg; hint.style.opacity = '1'; }
try {
  // ---- decode the embedded GLB ----
  var b64 = document.getElementById('glb-data').textContent.replace(/\s+/g, '');
  var bstr = atob(b64), N = bstr.length, u8 = new Uint8Array(N);
  for (var bi = 0; bi < N; bi++) u8[bi] = bstr.charCodeAt(bi);
  var buf = u8.buffer;

  document.getElementById('dl').addEventListener('click', function () {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
    a.download = '__FILE__.glb';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 600);
  });

  // ---- parse GLB chunks ----
  var dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) { fail('Damaged file — not a GLB.'); return; }
  var total = dv.getUint32(8, true), off = 12, json = null, bin = null;
  while (off < total) {
    var clen = dv.getUint32(off, true), ctype = dv.getUint32(off + 4, true);
    if (ctype === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, off + 8, clen)));
    else if (ctype === 0x004E4942) bin = buf.slice(off + 8, off + 8 + clen);
    off += 8 + clen; off = (off + 3) & ~3;
  }
  if (!json) { fail('Damaged file — no scene data.'); return; }

  // ---- accessors ----
  var CTYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  var NORMS = { 5120: 1 / 127, 5121: 1 / 255, 5122: 1 / 32767, 5123: 1 / 65535 };
  var NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  function accData(i) {
    var a = json.accessors[i], bv = json.bufferViews[a.bufferView || 0];
    var CT = CTYPES[a.componentType], nc = NCOMP[a.type], cs = CT.BYTES_PER_ELEMENT;
    var stride = bv.byteStride || nc * cs;
    var base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    var out = new Float32Array(a.count * nc);
    var sc = a.normalized ? (NORMS[a.componentType] || 1) : 1;
    for (var e = 0; e < a.count; e++) {
      var src = new CT(bin, base + e * stride, nc);
      for (var k = 0; k < nc; k++) out[e * nc + k] = src[k] * sc;
    }
    return out;
  }
  function accIdx(i) {
    var a = json.accessors[i], bv = json.bufferViews[a.bufferView || 0];
    var CT = CTYPES[a.componentType];
    var src = new CT(bin, (bv.byteOffset || 0) + (a.byteOffset || 0), a.count);
    var out = new Uint32Array(a.count); out.set(src);
    return out;
  }

  // ---- mat4 (column-major, like WebGL) ----
  function mI() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; }
  function mMul(a, b) {
    var o = new Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
      o[c * 4 + r] = s;
    }
    return o;
  }
  function mTRS(t, q, s) {
    var x = q[0], y = q[1], z = q[2], w = q[3];
    var x2 = x + x, y2 = y + y, z2 = z + z;
    var xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2;
    return [
      (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
      (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
      (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
      t[0], t[1], t[2], 1];
  }
  function mPersp(fov, asp, n, f) {
    var t = 1 / Math.tan(fov / 2);
    return [t / asp,0,0,0, 0,t,0,0, 0,0,(f + n) / (n - f),-1, 0,0,2 * f * n / (n - f),0];
  }
  function v3sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function v3cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function v3dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function v3norm(a) { var l = Math.sqrt(v3dot(a, a)) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mLook(e, c, up) {
    var z = v3norm(v3sub(e, c)), x = v3norm(v3cross(up, z)), y = v3cross(z, x);
    return [x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -v3dot(x, e),-v3dot(y, e),-v3dot(z, e),1];
  }
  function mPoint(m, p) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
            m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
            m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  }

  // ---- node world transforms ----
  var worlds = {};
  function local(n) {
    if (n.matrix) return n.matrix.slice();
    return mTRS(n.translation || [0, 0, 0], n.rotation || [0, 0, 0, 1], n.scale || [1, 1, 1]);
  }
  function walk(idx, pm) {
    var n = json.nodes[idx], w = mMul(pm, local(n));
    worlds[idx] = w;
    (n.children || []).forEach(function (c) { walk(c, w); });
  }
  var sceneDef = (json.scenes || [{ nodes: [] }])[json.scene || 0];
  (sceneDef.nodes || []).forEach(function (r) { walk(r, mI()); });

  // ---- WebGL ----
  var canvas = document.getElementById('cv');
  var gl = canvas.getContext('webgl', { antialias: true, alpha: true });
  if (!gl) { fail('WebGL is unavailable in this browser.'); return; }
  gl.getExtension('OES_element_index_uint');

  var VS = 'attribute vec3 aP; attribute vec3 aN; attribute vec2 aT; attribute vec4 aC;'
    + 'uniform mat4 uMVP; uniform mat4 uM;'
    + 'varying vec3 vN; varying vec2 vT; varying vec4 vC; varying vec3 vW;'
    + 'void main(){ gl_Position = uMVP * vec4(aP, 1.0);'
    + ' vN = normalize((uM * vec4(aN, 0.0)).xyz); vT = aT; vC = aC;'
    + ' vW = (uM * vec4(aP, 1.0)).xyz; }';
  var FS = 'precision mediump float;'
    + 'varying vec3 vN; varying vec2 vT; varying vec4 vC; varying vec3 vW;'
    + 'uniform vec4 uColor; uniform sampler2D uTex; uniform float uHasTex; uniform vec3 uEye;'
    + 'void main(){'
    + ' vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;'
    + ' vec3 base = uColor.rgb * vC.rgb; if (uHasTex > 0.5) base *= texture2D(uTex, vT).rgb;'
    + ' vec3 L1 = normalize(vec3(0.5, 0.8, 0.6)); vec3 L2 = normalize(vec3(-0.6, 0.15, -0.5));'
    + ' float d = max(dot(N, L1), 0.0) * 0.75 + max(dot(N, L2), 0.0) * 0.28;'
    + ' vec3 amb = mix(vec3(0.30, 0.26, 0.24), vec3(0.40, 0.42, 0.48), N.y * 0.5 + 0.5);'
    + ' vec3 V = normalize(uEye - vW);'
    + ' float rim = pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.18;'
    + ' vec3 c = base * (amb + d * vec3(1.0, 0.97, 0.92)) + rim * vec3(1.0, 0.9, 0.75);'
    + ' gl_FragColor = vec4(c, 1.0); }';
  function shader(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  var prog = gl.createProgram();
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { fail('Shader failed: ' + gl.getProgramInfoLog(prog)); return; }
  gl.useProgram(prog);
  var loc = {
    aP: gl.getAttribLocation(prog, 'aP'), aN: gl.getAttribLocation(prog, 'aN'),
    aT: gl.getAttribLocation(prog, 'aT'), aC: gl.getAttribLocation(prog, 'aC'),
    uMVP: gl.getUniformLocation(prog, 'uMVP'), uM: gl.getUniformLocation(prog, 'uM'),
    uColor: gl.getUniformLocation(prog, 'uColor'), uTex: gl.getUniformLocation(prog, 'uTex'),
    uHasTex: gl.getUniformLocation(prog, 'uHasTex'), uEye: gl.getUniformLocation(prog, 'uEye'),
  };

  // 1px white fallback texture
  var whiteTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, whiteTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));

  var texCache = {};
  function isPOT(v) { return (v & (v - 1)) === 0; }
  function getTex(ti) {
    if (texCache[ti]) return texCache[ti];
    var entry = { tex: whiteTex };
    texCache[ti] = entry;
    try {
      var t = json.textures[ti];
      var img = json.images[t.source];
      if (!img || img.bufferView == null) return entry;
      var bv = json.bufferViews[img.bufferView];
      var blob = new Blob([new Uint8Array(bin, bv.byteOffset || 0, bv.byteLength)], { type: img.mimeType || 'image/png' });
      var url = URL.createObjectURL(blob);
      var im = new Image();
      im.onload = function () {
        var g = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, g);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
        if (isPOT(im.width) && isPOT(im.height)) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        entry.tex = g;
        URL.revokeObjectURL(url);
      };
      im.src = url;
    } catch (e) { /* keep white */ }
    return entry;
  }

  function computeNormals(pos, idx) {
    var nrm = new Float32Array(pos.length);
    for (var i = 0; i < idx.length; i += 3) {
      var a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
      var e1 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
      var e2 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
      var n = v3cross(e1, e2);
      for (var k = 0; k < 3; k++) { nrm[a + k] += n[k]; nrm[b + k] += n[k]; nrm[c + k] += n[k]; }
    }
    for (var v = 0; v < nrm.length; v += 3) {
      var l = Math.sqrt(nrm[v] * nrm[v] + nrm[v + 1] * nrm[v + 1] + nrm[v + 2] * nrm[v + 2]) || 1;
      nrm[v] /= l; nrm[v + 1] /= l; nrm[v + 2] /= l;
    }
    return nrm;
  }

  function glBuf(target, data) {
    var b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW);
    return b;
  }

  // ---- build draw list + world bbox ----
  var prims = [];
  var bbMin = [Infinity, Infinity, Infinity], bbMax = [-Infinity, -Infinity, -Infinity];
  Object.keys(worlds).forEach(function (idx) {
    var n = json.nodes[idx];
    if (n.mesh == null) return;
    var world = (n.skin != null) ? mI() : worlds[idx]; // skinned: bind pose, node xform ignored
    (json.meshes[n.mesh].primitives || []).forEach(function (p) {
      if ((p.mode != null && p.mode !== 4) || !p.attributes || p.attributes.POSITION == null) return;
      var pos = accData(p.attributes.POSITION);
      var idxArr = p.indices != null ? accIdx(p.indices) : (function () {
        var s = new Uint32Array(pos.length / 3); for (var i = 0; i < s.length; i++) s[i] = i; return s;
      })();
      var nrm = p.attributes.NORMAL != null ? accData(p.attributes.NORMAL) : computeNormals(pos, idxArr);
      var uv = p.attributes.TEXCOORD_0 != null ? accData(p.attributes.TEXCOORD_0) : null;
      var colRaw = p.attributes.COLOR_0 != null ? accData(p.attributes.COLOR_0) : null;
      var colSize = colRaw ? (json.accessors[p.attributes.COLOR_0].type === 'VEC4' ? 4 : 3) : 0;
      var mat = p.material != null ? (json.materials[p.material] || {}) : {};
      var pbr = mat.pbrMetallicRoughness || {};
      var color = pbr.baseColorFactor || [1, 1, 1, 1];
      var texIdx = pbr.baseColorTexture ? pbr.baseColorTexture.index : null;
      // local bbox corners -> world bbox
      var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (var v = 0; v < pos.length; v += 3) for (var k = 0; k < 3; k++) {
        if (pos[v + k] < mn[k]) mn[k] = pos[v + k];
        if (pos[v + k] > mx[k]) mx[k] = pos[v + k];
      }
      for (var cx = 0; cx < 2; cx++) for (var cy = 0; cy < 2; cy++) for (var cz = 0; cz < 2; cz++) {
        var w = mPoint(world, [cx ? mx[0] : mn[0], cy ? mx[1] : mn[1], cz ? mx[2] : mn[2]]);
        for (var k2 = 0; k2 < 3; k2++) {
          if (w[k2] < bbMin[k2]) bbMin[k2] = w[k2];
          if (w[k2] > bbMax[k2]) bbMax[k2] = w[k2];
        }
      }
      prims.push({
        world: world, count: idxArr.length, color: color,
        doubleSided: !!mat.doubleSided,
        tex: texIdx != null ? getTex(texIdx) : null,
        vboP: glBuf(gl.ARRAY_BUFFER, pos),
        vboN: glBuf(gl.ARRAY_BUFFER, nrm),
        vboT: uv ? glBuf(gl.ARRAY_BUFFER, uv) : null,
        vboC: colRaw ? glBuf(gl.ARRAY_BUFFER, colRaw) : null,
        colSize: colSize,
        ibo: glBuf(gl.ELEMENT_ARRAY_BUFFER, idxArr),
      });
    });
  });
  if (!prims.length) { fail('No drawable geometry in this file.'); return; }

  var center = [(bbMin[0] + bbMax[0]) / 2, (bbMin[1] + bbMax[1]) / 2, (bbMin[2] + bbMax[2]) / 2];
  var size = v3sub(bbMax, bbMin);
  var maxDim = Math.max(size[0], size[1], size[2]) || 1;
  var hEl = document.getElementById('st-height');
  if (hEl) hEl.textContent = size[1] >= 0.01 ? (size[1] >= 100 ? size[1].toFixed(0) : size[1].toFixed(2)) + ' m' : (size[1] * 1000).toFixed(1) + ' mm';

  // ---- orbit camera ----
  var FOV = 0.6;
  var yaw = 0.7, pitch = 0.12, dist = (maxDim * 0.5) / Math.tan(FOV / 2) * 1.45;
  var minD = dist * 0.25, maxD = dist * 4;
  var lastTouch = 0;
  var pointers = {}, pinchD = 0;
  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', function (e) {
    canvas.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = [e.clientX, e.clientY];
    lastTouch = performance.now();
    var ks = Object.keys(pointers);
    if (ks.length === 2) {
      var p1 = pointers[ks[0]], p2 = pointers[ks[1]];
      pinchD = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!pointers[e.pointerId]) return;
    var prev = pointers[e.pointerId];
    pointers[e.pointerId] = [e.clientX, e.clientY];
    lastTouch = performance.now();
    var ks = Object.keys(pointers);
    if (ks.length === 1) {
      yaw += (e.clientX - prev[0]) * 0.011;
      pitch += (e.clientY - prev[1]) * 0.008;
      pitch = Math.max(-1.2, Math.min(1.35, pitch));
    } else if (ks.length === 2) {
      var p1 = pointers[ks[0]], p2 = pointers[ks[1]];
      var d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]);
      if (pinchD > 0) dist = Math.max(minD, Math.min(maxD, dist * pinchD / d));
      pinchD = d;
    }
  });
  function drop(e) { delete pointers[e.pointerId]; pinchD = 0; }
  canvas.addEventListener('pointerup', drop);
  canvas.addEventListener('pointercancel', drop);
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    lastTouch = performance.now();
    dist = Math.max(minD, Math.min(maxD, dist * (e.deltaY > 0 ? 1.09 : 0.92)));
  }, { passive: false });

  gl.enable(gl.DEPTH_TEST);
  var prevT = performance.now();
  function frame(now) {
    var dt = Math.min(0.1, (now - prevT) / 1000); prevT = now;
    if (now - lastTouch > 2600) yaw += dt * 0.4; // gentle turntable when idle
    var w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== (w * dpr | 0) || canvas.height !== (h * dpr | 0)) {
      canvas.width = w * dpr | 0; canvas.height = h * dpr | 0;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var eye = [
      center[0] + dist * Math.cos(pitch) * Math.sin(yaw),
      center[1] + dist * Math.sin(pitch),
      center[2] + dist * Math.cos(pitch) * Math.cos(yaw)];
    var view = mLook(eye, center, [0, 1, 0]);
    var proj = mPersp(FOV, (w || 1) / (h || 1), maxDim * 0.01, maxDim * 40);
    var vp = mMul(proj, view);
    gl.uniform3f(loc.uEye, eye[0], eye[1], eye[2]);
    prims.forEach(function (p) {
      if (p.doubleSided) gl.disable(gl.CULL_FACE);
      else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
      gl.uniformMatrix4fv(loc.uMVP, false, new Float32Array(mMul(vp, p.world)));
      gl.uniformMatrix4fv(loc.uM, false, new Float32Array(p.world));
      gl.uniform4fv(loc.uColor, p.color);
      gl.uniform1f(loc.uHasTex, p.tex ? 1 : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, p.tex ? p.tex.tex : whiteTex);
      gl.uniform1i(loc.uTex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.vboP);
      gl.enableVertexAttribArray(loc.aP); gl.vertexAttribPointer(loc.aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, p.vboN);
      gl.enableVertexAttribArray(loc.aN); gl.vertexAttribPointer(loc.aN, 3, gl.FLOAT, false, 0, 0);
      if (p.vboT && loc.aT >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, p.vboT);
        gl.enableVertexAttribArray(loc.aT); gl.vertexAttribPointer(loc.aT, 2, gl.FLOAT, false, 0, 0);
      } else if (loc.aT >= 0) { gl.disableVertexAttribArray(loc.aT); gl.vertexAttrib2f(loc.aT, 0, 0); }
      if (p.vboC && loc.aC >= 0) {
        gl.bindBuffer(gl.ARRAY_BUFFER, p.vboC);
        gl.enableVertexAttribArray(loc.aC); gl.vertexAttribPointer(loc.aC, p.colSize, gl.FLOAT, false, 0, 0);
      } else if (loc.aC >= 0) { gl.disableVertexAttribArray(loc.aC); gl.vertexAttrib4f(loc.aC, 1, 1, 1, 1); }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, p.ibo);
      gl.drawElements(gl.TRIANGLES, p.count, gl.UNSIGNED_INT, 0);
    });
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
} catch (err) { fail('Could not open the model: ' + (err && err.message || err)); }
})();
`;

function buildHTML(o) {
  const statCell = (v, l) =>
    '<div style="padding:13px 8px 11px;text-align:center;background:#f8eeda;">'
    + '<div style="font-family:\'SF Mono\',\'Cascadia Mono\',\'Consolas\',monospace;font-size:17px;font-weight:700;color:#3a2a1a;"' + (l === 'height' ? ' id="st-height"' : '') + '>' + v + '</div>'
    + '<div style="font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:#9a8468;margin-top:3px;">' + (l === 'height' ? 'height' : l) + '</div></div>';

  const s = o.stats;
  const cells = [
    statCell(s.trisLabel, 'triangles'), statCell(s.vertsLabel, 'vertices'),
    statCell('—', 'height'), statCell(s.materials, s.materials === 1 ? 'material' : 'materials'),
    statCell(s.bones || '—', 'bones'), statCell(s.morphs || '—', 'morph targets'),
    statCell(s.anims.length || '—', s.anims.length === 1 ? 'animation' : 'animations'), statCell(s.sizeLabel, 'file, all-in'),
  ].join('');

  const viewer = VIEWER_SRC.split('__FILE__').join(o.file.replace(/'/g, ''));
  const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
    + '<title>' + esc(o.title) + ' — character passport</title>\n'
    + '<style>html,body{margin:0;padding:0;}</style>\n</head>\n'
    + '<body style="min-height:100vh;display:grid;place-items:center;padding:26px 14px;box-sizing:border-box;'
    + 'background:#1d140c radial-gradient(ellipse 90% 70% at 50% 20%, #33241566, transparent);'
    + 'font-family:\'Avenir Next\',\'Segoe UI\',system-ui,sans-serif;">\n'

    + '<div style="width:min(640px,96vw);background:#f6ead6;border:4px solid #4a3220;border-radius:18px;overflow:hidden;box-shadow:0 18px 60px #00000073;">\n'

    // header
    + '<div style="display:flex;align-items:center;gap:12px;padding:16px 20px;background:#efdfc4;border-bottom:4px solid #4a3220;">'
    + '<span style="flex:none;width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;'
    + 'background:linear-gradient(135deg,#c66b3d,#4a3220);color:#fff6e0;font-size:19px;border:3px solid #4a3220;">\u2697</span>'
    + '<div style="flex:1;min-width:0;">'
    + '<div style="font-size:19px;font-weight:700;color:#2e2013;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(o.title) + '</div>'
    + '<div style="font-family:\'SF Mono\',\'Cascadia Mono\',\'Consolas\',monospace;font-size:9.5px;letter-spacing:.16em;color:#9a8468;">CHARACTER PASSPORT \u00b7 ' + esc(date.toUpperCase()) + '</div>'
    + '</div>'
    + '<button id="dl" title="Download the embedded .glb model" style="flex:none;display:flex;align-items:center;gap:7px;padding:8px 14px;'
    + 'border-radius:9px;border:3px solid #4a3220;background:#f6ead6;color:#4a3220;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;">\u2913 .glb</button>'
    + '</div>\n'

    // viewer
    + '<div style="position:relative;height:min(420px,58vh);background:#241a11 radial-gradient(ellipse 75% 60% at 50% 42%, #3d2c1a, #241a11 78%);">'
    + '<canvas id="cv" style="position:absolute;inset:0;width:100%;height:100%;display:block;"></canvas>'
    + '<div id="vhint" style="position:absolute;left:0;right:0;bottom:10px;text-align:center;font-family:\'SF Mono\',\'Cascadia Mono\',\'Consolas\',monospace;'
    + 'font-size:10px;letter-spacing:.1em;color:#c9b493;opacity:.65;pointer-events:none;">drag to orbit \u00b7 scroll to zoom</div>'
    + '</div>\n'

    // stats
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:2px;background:#4a3220;border-top:4px solid #4a3220;border-bottom:4px solid #4a3220;">' + cells + '</div>\n'

    // credits footer
    + '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:13px 20px;background:#efdfc4;">'
    + '<div style="flex:1;min-width:200px;font-size:12px;color:#5d4a34;line-height:1.5;">'
    + (o.author ? '<b style="color:#2e2013;">Made by ' + esc(o.author) + '</b> \u00b7 ' : '')
    + '<span style="font-family:\'SF Mono\',\'Cascadia Mono\',\'Consolas\',monospace;font-size:11px;padding:2px 8px;border-radius:12px;border:2px solid #c9b493;color:#5d4a34;">' + esc(o.licence) + '</span>'
    + (s.anims.length ? ' \u00b7 clips: ' + esc(s.anims.slice(0, 4).join(', ')) + (s.anims.length > 4 ? '\u2026' : '') : '')
    + '</div>'
    + '<div style="flex:none;font-family:\'SF Mono\',\'Cascadia Mono\',\'Consolas\',monospace;font-size:10px;letter-spacing:.08em;color:#9a8468;">BREWED IN <b style="color:#c66b3d;">POLYPOTION</b> \u00b7 FREE \u00b7 LOCAL</div>'
    + '</div>\n'

    + '</div>\n'
    + '<script type="application/octet-stream" id="glb-data">' + o.b64 + '</scr' + 'ipt>\n'
    + '<script>' + viewer + '</scr' + 'ipt>\n'
    + '</body>\n</html>\n';
}

// ---- main entry ----
// exportPassport(glbArrayBuffer, { name, author, licence }) → downloads
// "<name>.passport.html" and returns { file, stats }.
export function exportPassport(buffer, opts) {
  opts = opts || {};
  const base = (opts.name || 'character').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_\-]+/g, '_') || 'character';
  const stats = glbStats(buffer);
  const html = buildHTML({
    title: opts.title || opts.name || base,
    file: base,
    author: (opts.author || '').trim(),
    licence: opts.licence || 'CC BY 4.0',
    stats,
    b64: toB64(buffer),
  });
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = base + '.passport.html';
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 600);
  return { file: base + '.passport.html', stats };
}

window.PPPassport = { exportPassport, glbStats, buildHTML };
export default { exportPassport, glbStats, buildHTML };
export { buildHTML };
