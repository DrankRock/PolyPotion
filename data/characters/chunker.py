#!/usr/bin/env python3
# ============================================================
# chunker.py — split oversized .glb / .fbx / .gltf assets so they fit on
# Cloudflare Pages (25 MiB per-file limit) and reassemble in the browser
# via studio3D_scripts/chunk-loader.js.
#
#   python3 chunker.py
#
# It scans the CURRENT folder (recursively), splits every file over the limit
# into `<file>.part000`, … plus `<file>.chunks.json`, and UPDATES
# manifest.json.
#
# ---- LOD support (new) -------------------------------------------------
# Files named `<base>_<pct>.<ext>` (e.g. hero_100.glb, hero_60.glb,
# hero_10.glb) where a `_100` member exists are treated as ONE character with
# multiple LODs. Instead of separate manifest entries, the chunker writes a
# single entry for `<base>` with:
#     "path": "<…>/<base>_100.<ext>",     # the base/full-detail rung
#     "lods": [ {pct,path,chunked?,chunks?}, … ]   # high → low
# pct = percent of the ORIGINAL triangle count. The app's lod-switch.js picks
# a rung at runtime and drops to a coarser one when the viewport lags.
# Each rung is chunked independently, so a big _100 can be split while the
# small _10 stays whole — the flags live per-rung inside "lods".
# Existing labels/ids/tags are always preserved; only path/lods/chunk flags
# are refreshed.
#
# Flags:
#     --delete     also delete originals after splitting (needed pre-deploy)
#     --threshold  MB above which a file is split (default 24)
# ============================================================

import os
import re
import json
import glob
import argparse

PAD = 3
CHUNK_SIZE = 24 * 1024 * 1024
EXTS = ('.glb', '.fbx', '.gltf')
DEFAULT_PREFIX = 'data/characters'
LOD_RX = re.compile(r'^(?P<base>.+)_(?P<pct>\d{1,3})$')   # <base>_<pct>


def find_manifest():
    d = os.getcwd()
    while True:
        cand = os.path.join(d, 'manifest.json')
        if os.path.isfile(cand):
            return cand
        parent = os.path.dirname(d)
        if parent == d:
            return os.path.join(os.getcwd(), 'manifest.json')
        d = parent


def split(path, chunk_size):
    total = os.path.getsize(path)
    n = (total + chunk_size - 1) // chunk_size
    for old in glob.glob(path + '.part*'):
        os.remove(old)
    with open(path, 'rb') as f:
        for i in range(n):
            with open(f"{path}.part{i:0{PAD}d}", 'wb') as out:
                out.write(f.read(chunk_size))
    with open(path + '.chunks.json', 'w') as f:
        json.dump({"chunks": n, "size": total}, f)
    return n, total


def clear_parts(path):
    removed = False
    for old in glob.glob(path + '.part*') + glob.glob(path + '.chunks.json'):
        os.remove(old)
        removed = True
    return removed


def slugify(name):
    base = re.sub(r'\.[^.]+$', '', name).lower()
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', base))


def strip_ext(name):
    return re.sub(r'\.[^.]+$', '', name)


def parse_lod(name):
    """Return (base, pct) if `name` (with extension) looks like <base>_<pct>.ext
    with 1<=pct<=100, else (None, None)."""
    stem = strip_ext(name)
    m = LOD_RX.match(stem)
    if not m:
        return None, None
    pct = int(m.group('pct'))
    if 1 <= pct <= 100:
        return m.group('base'), pct
    return None, None


def derive_tags(name):
    n = name.lower()
    tags = []
    if re.search(r'\bwoman\b|\bwomen\b|girl|demoness|succubus|medusa|\bhag\b|goddess|queen|\bwitch\b|mother', n):
        tags.append('female')
    elif re.search(r'\bman\b|minotaur|\bking\b', n):
        tags.append('male')
    non_human = re.search(
        r'fox|minotaur|\bcow\b|dragon|lizard|lion|wolf|snake|\bcat\b|bunny|alien|skeleton|'
        r'slime|mushroom|zombie|medusa|gargoyl|demon|succubus|panther|spirit|tentacul|'
        r'monster|angel|laser|computer|metallic|storm', n)
    tags.append('non-human' if non_human else 'human')
    if re.match(r'^t-pose', n):
        tags.append('t-pose')
    return tags


def rung_dict(prefix, name, n):
    d = {"pct": None, "path": (prefix.rstrip('/') + '/' + name) if prefix else name}
    if n:
        d["chunked"] = "true"
        d["chunks"] = n
    return d


def new_entry(base_label, prefix, ext):
    e = {
        "id": slugify(base_label),
        "label": base_label,
        "path": "",
        "ext": ext,
        "rig": "unknown",
        "rigged": "false",
        "source": "local",
        "tags": derive_tags(base_label),
    }
    return e


MANIFEST_COMMENT = (
    "Studio character library. Each entry: {id,label,path,ext,rig,rigged,"
    "source,tags,chunked?,chunks?,lods?}. rig=mixamo|autorig|unknown. "
    "lods=[{pct,path,chunked?,chunks?}] high->low, pct=% of original tris "
    "(base rung is _100); the app auto-switches rungs when the viewport lags. "
    "tags are free-form (male,female,human,non-human,sfw,nsfw,t-pose) and are "
    "never overwritten by chunker.py. Paths relative to app root. Portraits: "
    "data/characters/pfp/<id>.png"
)


def sync_manifest(manifest_path, results):
    """results: {basename_lower: {'n': chunks_or_None, 'name': original_basename}}."""
    if manifest_path and os.path.isfile(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"  ! manifest.json unreadable ({e}); backing up to manifest.json.bak")
            try:
                os.replace(manifest_path, manifest_path + '.bak')
            except OSError:
                pass
            data = {"comment": MANIFEST_COMMENT, "characters": []}
    else:
        manifest_path = manifest_path or os.path.join(os.getcwd(), 'manifest.json')
        print(f"  creating new manifest at {os.path.relpath(manifest_path)}")
        data = {"comment": MANIFEST_COMMENT, "characters": []}
    is_list = isinstance(data, list)
    chars = data if is_list else data.setdefault('characters', [])

    prefix = DEFAULT_PREFIX
    for c in chars:
        p = c.get('path', '')
        if '/' in p:
            prefix = os.path.dirname(p)
            break

    # ---- classify results into LOD sets and plain singles ----------------
    # lod_sets[(base_lower, ext)] = { 'base': base_orig, 'ext': ext,
    #                                 'rungs': {pct: {'name':.., 'n':..}} }
    lod_sets = {}
    singles = {}                       # key -> info (non-LOD files)
    for key, info in results.items():
        base, pct = parse_lod(info['name'])
        ext = (info['name'].rsplit('.', 1)[-1] if '.' in info['name'] else 'glb').lower()
        if base is not None:
            gk = (base.lower(), ext)
            grp = lod_sets.setdefault(gk, {'base': base, 'ext': ext, 'rungs': {}})
            grp['rungs'][pct] = {'name': info['name'], 'n': info['n']}
        else:
            singles[key] = info
    # a group is a real LOD set only if it has a _100 (forced base convention);
    # otherwise its members are treated as ordinary standalone files.
    real_sets = {}
    for gk, grp in lod_sets.items():
        if 100 in grp['rungs']:
            real_sets[gk] = grp
        else:
            for pct, r in grp['rungs'].items():
                singles[r['name'].lower()] = {'n': r['n'], 'name': r['name']}

    # index existing entries by basename-of-path and by id/base-name for LODs
    by_basename = {}
    for c in chars:
        bn = os.path.basename(c.get('path', '')).lower()
        if bn:
            by_basename[bn] = c

    def lods_for(grp):
        out = []
        for pct in sorted(grp['rungs'].keys(), reverse=True):
            r = grp['rungs'][pct]
            d = {"pct": pct, "path": (prefix.rstrip('/') + '/' + r['name']) if prefix else r['name']}
            if r['n']:
                d["chunked"] = "true"
                d["chunks"] = r['n']
            out.append(d)
        return out

    changed = added = 0

    # ---- apply LOD sets --------------------------------------------------
    for gk, grp in real_sets.items():
        base100 = grp['rungs'][100]['name']
        base_bn = base100.lower()
        entry = by_basename.get(base_bn)
        # or find an existing entry whose label/id matches the base (path may
        # currently point at an unsuffixed original)
        if entry is None:
            for c in chars:
                if slugify(c.get('label', '')) == slugify(grp['base']) or c.get('id') == slugify(grp['base']):
                    entry = c
                    break
        lods = lods_for(grp)
        base_path = (prefix.rstrip('/') + '/' + base100) if prefix else base100
        if entry is None:
            entry = new_entry(grp['base'], prefix, grp['ext'])
            chars.append(entry)
            added += 1
        entry['path'] = base_path
        entry['ext'] = grp['ext']
        entry['lods'] = lods
        # top-level chunk flags mirror the base (_100) rung so old readers work
        b0 = lods[0]
        if 'chunked' in b0:
            entry['chunked'] = "true"
            entry['chunks'] = b0['chunks']
        else:
            entry.pop('chunked', None)
            entry.pop('chunks', None)
        changed += 1

    # ---- apply plain singles (original behaviour) ------------------------
    seen = set(by_basename.keys())
    for key, info in sorted(singles.items()):
        n = info['n']
        entry = by_basename.get(key)
        if entry is not None:
            if n:
                if entry.get('chunked') != "true" or entry.get('chunks') != n:
                    entry['chunked'] = "true"
                    entry['chunks'] = n
                    changed += 1
            else:
                if 'chunked' in entry or 'chunks' in entry:
                    entry.pop('chunked', None)
                    entry.pop('chunks', None)
                    changed += 1
        else:
            e = new_entry(strip_ext(info['name']), prefix, (info['name'].rsplit('.', 1)[-1]).lower())
            e['path'] = (prefix.rstrip('/') + '/' + info['name']) if prefix else info['name']
            if n:
                e['chunked'] = "true"
                e['chunks'] = n
            chars.append(e)
            added += 1

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
        f.write('\n')
    print(f"  manifest: {changed} updated, {added} added, "
          f"{len(real_sets)} LOD set(s) ({os.path.relpath(manifest_path)})")


def main():
    ap = argparse.ArgumentParser(description="Chunk oversized GLB/FBX; group LOD sets.")
    ap.add_argument('--threshold', type=float, default=CHUNK_SIZE / 1048576,
                    help="MB above which a file is split (default 24)")
    ap.add_argument('--delete', action='store_true',
                    help="delete the original after splitting")
    args = ap.parse_args()
    limit = args.threshold * 1048576

    files = [p for p in glob.glob('**/*', recursive=True)
             if os.path.isfile(p) and p.lower().endswith(EXTS)]
    if not files:
        print(f"No {'/'.join(EXTS)} files found under {os.getcwd()}")
        return

    print(f"chunker — {len(files)} model(s) under {os.getcwd()}")
    results = {}
    for p in sorted(files):
        name = os.path.basename(p)
        key = name.lower()
        size = os.path.getsize(p)
        if size <= limit:
            if clear_parts(p):
                print(f"  unchunk {name} — {size/1048576:.1f} MB, removed stale parts")
            else:
                print(f"  ok      {name} — {size/1048576:.1f} MB")
            results[key] = {'n': None, 'name': name}
            continue
        n, total = split(p, CHUNK_SIZE)
        results[key] = {'n': n, 'name': name}
        print(f"  split   {name} — {total/1048576:.1f} MB -> {n} parts")
        if args.delete:
            os.remove(p)
            print(f"          removed original {name}")

    sync_manifest(find_manifest(), results)
    print("done.")


if __name__ == '__main__':
    main()
