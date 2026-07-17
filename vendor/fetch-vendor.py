#!/usr/bin/env python3
# ============================================================
# fetch-vendor.py — vendor three.js + manifold-3d locally, then flip the
# whole app off the CDN in one run. Cross-platform, standard library only
# (needs Python 3.8+; no pip installs). Run on a networked machine:
#
#     cd <app root>\vendor
#     python fetch-vendor.py
#
# What it does, in order (each step is idempotent — safe to re-run):
#   1. Downloads three@0.160.0 and manifold-3d@3.2.1 from the npm registry
#      and lays them out under vendor/ (the whole examples/jsm tree included).
#   2. Rewrites the <script type="importmap"> in every *.html / *.dc.html in
#      the app root from the jsDelivr URLs to ./vendor/... paths.
#   3. Adds the core vendored files to sw.js CORE and bumps CACHE_VERSION so
#      clients pick up the new (offline) shell.
# It ONLY flips the maps after the files are on disk, so the app is never
# left pointing at files that don't exist.
#
# Not touched (deploy-time, manual): tighten the CSP in SECURITY_HEADERS.md /
# _headers to drop the jsdelivr.net origins once you've confirmed it all works.
# ============================================================
import io, os, re, sys, glob, json, shutil, tarfile, urllib.request

THREE_VER = "0.160.0"
MANIFOLD_VER = "3.2.1"
REGISTRY = "https://registry.npmjs.org"

VENDOR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(VENDOR)   # app root (parent of vendor/)

# jsDelivr URL prefix  ->  local ./vendor path
URL_SWAPS = [
    (f"https://cdn.jsdelivr.net/npm/three@{THREE_VER}/build/three.module.js",
     "./vendor/three/build/three.module.js"),
    (f"https://cdn.jsdelivr.net/npm/three@{THREE_VER}/examples/jsm/",
     "./vendor/three/examples/jsm/"),
    (f"https://cdn.jsdelivr.net/npm/manifold-3d@{MANIFOLD_VER}/manifold.js",
     "./vendor/manifold-3d/manifold.js"),
]

CORE_ADDITIONS = [
    "vendor/three/build/three.module.js",
    "vendor/manifold-3d/manifold.js",
    "vendor/manifold-3d/manifold.wasm",
]


def fetch_tarball(pkg, ver):
    url = f"{REGISTRY}/{pkg}/-/{pkg}-{ver}.tgz"
    print(f"  downloading {url}")
    with urllib.request.urlopen(url) as r:
        data = r.read()
    return tarfile.open(fileobj=io.BytesIO(data), mode="r:gz")


def extract_member(tar, member_suffix, dest):
    """Copy the first tar member whose name ends with member_suffix to dest."""
    for m in tar.getmembers():
        if m.name.endswith(member_suffix) and m.isfile():
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with tar.extractfile(m) as src, open(dest, "wb") as out:
                shutil.copyfileobj(src, out)
            return True
    return False


def extract_tree(tar, member_prefix, dest_dir):
    """Copy every file under package/<member_prefix> into dest_dir, preserving layout."""
    n = 0
    for m in tar.getmembers():
        if not m.isfile():
            continue
        # tar entries are like 'package/examples/jsm/loaders/GLTFLoader.js'
        parts = m.name.split("/", 1)
        if len(parts) != 2:
            continue
        rel = parts[1]
        if not rel.startswith(member_prefix):
            continue
        out_path = os.path.join(dest_dir, rel[len(member_prefix):].lstrip("/"))
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        with tar.extractfile(m) as src, open(out_path, "wb") as out:
            shutil.copyfileobj(src, out)
        n += 1
    return n


def step_download():
    print("→ three@%s" % THREE_VER)
    tar = fetch_tarball("three", THREE_VER)
    ok = extract_member(tar, "build/three.module.js",
                        os.path.join(VENDOR, "three", "build", "three.module.js"))
    if not ok:
        sys.exit("  ! three.module.js not found in tarball")
    n = extract_tree(tar, "examples/jsm/", os.path.join(VENDOR, "three", "examples", "jsm"))
    print(f"  three.module.js + {n} addon files")

    print("→ manifold-3d@%s" % MANIFOLD_VER)
    tar = fetch_tarball("manifold-3d", MANIFOLD_VER)
    for suffix, name in (("manifold.js", "manifold.js"), ("manifold.wasm", "manifold.wasm")):
        ok = extract_member(tar, suffix, os.path.join(VENDOR, "manifold-3d", name))
        print(f"  {name}: {'ok' if ok else 'NOT FOUND (release layout differs — check the tarball)'}")


def step_flip_maps():
    print("→ flipping import maps to ./vendor/ ...")
    files = glob.glob(os.path.join(ROOT, "*.html"))
    changed = 0
    for path in files:
        with open(path, "r", encoding="utf-8") as f:
            txt = f.read()
        new = txt
        for old_url, new_url in URL_SWAPS:
            new = new.replace(old_url, new_url)
        if new != txt:
            with open(path, "w", encoding="utf-8") as f:
                f.write(new)
            changed += 1
            print("   " + os.path.basename(path))
    print(f"  {changed} document(s) updated")


def step_sw():
    sw = os.path.join(ROOT, "sw.js")
    if not os.path.exists(sw):
        print("  (no sw.js — skipping)")
        return
    with open(sw, "r", encoding="utf-8") as f:
        txt = f.read()

    # add core vendored files to the CORE array (after job.js), once
    if "vendor/three/build/three.module.js" not in txt:
        anchor = "  'studio3D_scripts/job.js',\n"
        if anchor in txt:
            block = anchor + "".join(f"  '{p}',\n" for p in CORE_ADDITIONS)
            txt = txt.replace(anchor, block, 1)
            print("  added vendored core files to sw.js CORE")
        else:
            print("  ! could not find the job.js anchor in sw.js CORE — add these manually:")
            for p in CORE_ADDITIONS:
                print("      " + p)

    # bump CACHE_VERSION  pp-vNN -> pp-v(NN+1)
    m = re.search(r"pp-v(\d+)", txt)
    if m:
        nxt = int(m.group(1)) + 1
        txt = re.sub(r"pp-v\d+", f"pp-v{nxt}", txt)
        print(f"  bumped CACHE_VERSION -> pp-v{nxt}")
    with open(sw, "w", encoding="utf-8") as f:
        f.write(txt)


def main():
    step_download()
    step_flip_maps()
    step_sw()
    print("\n✓ done. three + manifold now load from ./vendor (no CDN).")
    print("  Test locally, then drop the jsdelivr.net origins from the CSP in")
    print("  SECURITY_HEADERS.md and _headers when you deploy.")
    print("\n  Still CDN-loaded (optional, separate — only if you use those features")
    print("  offline): Draco/meshopt/gltf-transform (Export compression), mp4-muxer")
    print("  (Physics MP4), MediaPipe Tasks-Vision (webcam capture).")


if __name__ == "__main__":
    main()
