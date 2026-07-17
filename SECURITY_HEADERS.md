# Security headers — Cloudflare setup (5 min)

GitHub Pages cannot set response headers; since Cloudflare fronts the site,
add ONE rule: Dashboard → your zone → **Rules → Transform Rules →
Modify Response Header** → "Set static" for each header below, applied to
all incoming requests.

## Fixes the red issues

Strict-Transport-Security:
  max-age=31536000; includeSubDomains; preload
  (also fixes "No HSTS". Enable SSL/TLS → Edge Certificates → HSTS instead if you prefer.)

X-Frame-Options:
  SAMEORIGIN
  (the tool workspaces iframe each other same-origin, so SAMEORIGIN is safe — do NOT use DENY.)

Content-Security-Policy — start with Report-Only for a week, watch the console, then enforce:
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://esm.sh https://cdn.jsdelivr.net https://unpkg.com blob:;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src https://fonts.gstatic.com;
  img-src 'self' data: blob:;
  media-src 'self' blob:;
  connect-src 'self' blob: data: https://esm.sh https://cdn.jsdelivr.net https://unpkg.com https://fonts.googleapis.com https://fonts.gstatic.com https://storage.googleapis.com https://api.anthropic.com https://api.deepseek.com https://generativelanguage.googleapis.com;
  worker-src 'self' blob:;
  frame-src 'self';
  object-src 'none'; base-uri 'self'; frame-ancestors 'self';
  (one line, semicolon-separated. 'unsafe-inline' is required — the shell uses inline
  scripts; 'unsafe-eval' is required — the DC runtime (support.js) compiles each tool's
  logic class with Function(), which CSP counts as eval; without it every *.dc.html tool
  renders template-only (all {{ }} holes blank). esm.sh serves three.js;
  storage.googleapis.com serves the MediaPipe models; the three AI endpoints are for
  text-to-pose. If a tool breaks, the console names the blocked origin — add it to connect-src.)

## The warnings

Permissions-Policy:
  camera=(self), microphone=(), geolocation=(), payment=(), usb=()
  (camera=self is REQUIRED — MoCap uses the webcam in a same-origin iframe.)

Cross-Origin-Opener-Policy:  same-origin
Cross-Origin-Resource-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
  Use **credentialless**, NOT require-corp. Credentialless grants cross-origin
  isolation (so SharedArrayBuffer + the ⚡ threads badge light up and the WASM
  solvers go multi-threaded) WITHOUT demanding a CORP header on every
  cross-origin response — so esm.sh / fonts / the MediaPipe models keep loading.
  require-corp would break them. (Supported in Chromium; Firefox/Safari simply
  don't isolate and the solvers fall back to 1-thread, which is fine.)
  For Netlify / Cloudflare Pages, the ready-made `_headers` file at the repo
  root sets this and everything above — no dashboard clicks.

DNSSEC: Cloudflare dashboard → DNS → Settings → Enable DNSSEC, then add the
DS record at Namecheap (Domain → Advanced DNS → DNSSEC). Purely dashboard-side.

security.txt: already added at /.well-known/security.txt — set the Canonical
line to your real domain once it's live.

Social tags: added in index.html — replace social-card.png with a real
1200×630 image and make the og:image URL absolute once the domain is live.
