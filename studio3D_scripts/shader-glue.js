// ============================================================
// shader-glue.js — shared GLSL glue strings for the shader library.
//
// These three snippets are concatenated into preset fragBodies at module-eval
// time (e.g. `LIQ + `...``), so they must be importable by BOTH the per-category
// preset files AND shader-lib.js's normalizeWild(). They live in this tiny
// leaf module (no imports) to avoid a circular import between shader-lib.js and
// the preset files. See shader-lib.js for the full fragment scope / uniforms.
//
//   AXIS         up vector, height (h/hn), radial coords from u_gravity + bbox
//   LIQ          = AXIS + world-level fill plane, slosh tilt, agitation ripple
//   GLASS_ABOVE  empty-glass tint above the fill line (uses u_color)
// ============================================================

export const AXIS = `
  vec3 upA = normalize(-u_gravity);
  float E = max(u_levMax - u_levMin, 0.0001);
  float h = dot(vObjPos, upA);
  float hn = clamp((h - u_levMin) / E, 0.0, 1.0);
  vec3 pPerp = vObjPos - upA * h;
  vec3 bA = normalize(cross(upA, vec3(0.93, 0.31, 0.19)));
  vec3 bB = cross(upA, bA);
  float ang = atan(dot(pPerp, bB), dot(pPerp, bA));
  float rad = length(pPerp) / E;
`;

export const LIQ = AXIS + `
  float lev = mix(u_levMin, u_levMax, clamp(u_fill, 0.0, 1.0));
  float tiltW = dot(pPerp, u_slosh) * 1.35;
  float ripple = snoise(pPerp * (13.0 / E) + u_time * u_speed * vec3(1.3, 0.0, 1.1)) * E * (0.006 + 0.055 * u_sloshMag);
  float surfH = lev + tiltW + ripple;
  float dSurf = h - surfH;
  float depth = clamp(-dSurf / E, 0.0, 1.0);
  float menis = 1.0 - smoothstep(0.0, E * 0.045, abs(dSurf));
`;

export const GLASS_ABOVE = `
  float fg = pow(fres, 2.0);
  col = u_color * 0.06 + vec3(0.9, 0.95, 1.0) * fg * 0.55;
  alpha = 0.10 + fg * 0.5;
`;
