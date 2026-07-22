#!/usr/bin/env python3
# ============================================================
# lodgroup.py — one-shot migration: fold existing `<base>_<pct>` files in your
# library into LOD sets inside manifest.json, WITHOUT re-chunking anything.
#
# Run it once in data/characters (or wherever manifest.json lives):
#     python3 lodgroup.py            # dry run — prints what it would do
#     python3 lodgroup.py --apply    # actually rewrite manifest.json
#
# What it does:
#   * finds files named  <base>_100.<ext>, <base>_60.<ext>, …  (pct 1..100)
#   * a group with a `_100` member becomes ONE character entry with a
#     "lods":[{pct,path,chunked?,chunks?}] array (high -> low). pct = % of
#     original triangles.
#   * merges into an existing entry when one matches (by base filename, id, or
#     label) so your labels / tags / rig flags are preserved; otherwise adds a
#     fresh entry.
#   * reads each rung's `.chunks.json` sidecar (if present) to carry the
#     chunked/chunks flags per rung — so it stays correct for already-split
#     files. It never splits or deletes anything.
#
# After running, deploy as usual. For NEW files, just use the updated
# chunker.py, which does this grouping automatically.
# ============================================================

import os
import re
import json
import glob
import argparse

EXTS = ('.glb', '.fbx', '.gltf')
LOD_RX = re.compile(r'^(?P<base>.+)_(?P<pct>\d{1,3})$')


def slugify(name):
    base = re.sub(r'\.[^.]+$', '', name).lower()
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', base))


def strip_ext(name):
    return re.sub(r'\.[^.]+$', '', name)


def parse_lod(name):
    m = LOD_RX.match(strip_ext(name))
    if not m:
        return None, None
    pct = int(m.group('pct'))
    return (m.group('base'), pct) if 1 <= pct <= 100 else (None, None)


def sidecar_chunks(path):
    """If <path>.chunks.json exists, return its chunk count, else None."""
    sc = path + '.chunks.json'
    if os.path.isfile(sc):
        try:
            with open(sc, 'r', encoding='utf-8') as f:
                return int(json.load(f).get('chunks') or 0) or None
        except (json.JSONDecodeError, OSError, ValueError):
            return None
    # also treat presence of .part000 as chunked even without a sidecar
    parts = sorted(glob.glob(path + '.part*'))
    return len(parts) or None


def find_manifest():
    d = os.getcwd()
    while True:
        cand = os.path.join(d, 'manifest.json')
        if os.path.isfile(cand):
            return cand
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


def main():
    ap = argparse.ArgumentParser(description="Fold existing _<pct> files into manifest LOD sets.")
    ap.add_argument('--apply', action='store_true', help="write manifest.json (default: dry run)")
    args = ap.parse_args()

    mpath = find_manifest()
    if not mpath:
        print("No manifest.json found from", os.getcwd())
        return
    with open(mpath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    chars = data if isinstance(data, list) else data.get('characters', [])

    prefix = 'data/characters'
    for c in chars:
        p = c.get('path', '')
        if '/' in p:
            prefix = os.path.dirname(p)
            break

    # scan for _<pct> files (also include parts' base names that were deleted:
    # detect via .chunks.json sidecars)
    seen_files = set()
    for p in glob.glob('**/*', recursive=True):
        low = p.lower()
        if os.path.isfile(p) and low.endswith(EXTS):
            seen_files.add(os.path.basename(p))
    for sc in glob.glob('**/*.chunks.json', recursive=True):
        seen_files.add(os.path.basename(sc)[:-len('.chunks.json')])

    groups = {}   # (base_lower, ext) -> {base, ext, rungs:{pct:name}}
    for name in seen_files:
        base, pct = parse_lod(name)
        if base is None:
            continue
        ext = (name.rsplit('.', 1)[-1] if '.' in name else 'glb').lower()
        gk = (base.lower(), ext)
        groups.setdefault(gk, {'base': base, 'ext': ext, 'rungs': {}})['rungs'][pct] = name

    real = {gk: g for gk, g in groups.items() if 100 in g['rungs']}
    if not real:
        print("No LOD sets found (need a <base>_100 file). Nothing to do.")
        return

    by_basename = {os.path.basename(c.get('path', '')).lower(): c for c in chars if c.get('path')}

    def full(name):
        return (prefix.rstrip('/') + '/' + name) if prefix else name

    changed = added = 0
    for gk, g in sorted(real.items()):
        base100 = g['rungs'][100]
        lods = []
        for pct in sorted(g['rungs'].keys(), reverse=True):
            nm = g['rungs'][pct]
            d = {"pct": pct, "path": full(nm)}
            n = sidecar_chunks(nm) or sidecar_chunks(os.path.join(prefix, nm))
            if n:
                d["chunked"] = "true"
                d["chunks"] = n
            lods.append(d)

        entry = by_basename.get(base100.lower())
        if entry is None:
            for c in chars:
                if c.get('id') == slugify(g['base']) or slugify(c.get('label', '')) == slugify(g['base']):
                    entry = c
                    break
        rung_desc = ' · '.join(f"{l['pct']}%" + ('(chunked)' if l.get('chunked') else '') for l in lods)
        if entry is None:
            entry = {"id": slugify(g['base']), "label": g['base'], "path": full(base100),
                     "ext": g['ext'], "rig": "unknown", "rigged": "false", "source": "local", "tags": []}
            chars.append(entry)
            added += 1
            print(f"  + NEW  {g['base']}  [{rung_desc}]")
        else:
            print(f"  ~ set  {entry.get('label', g['base'])}  [{rung_desc}]")
            changed += 1
        entry['path'] = full(base100)
        entry['lods'] = lods
        b0 = lods[0]
        if 'chunked' in b0:
            entry['chunked'] = "true"
            entry['chunks'] = b0['chunks']
        else:
            entry.pop('chunked', None)
            entry.pop('chunks', None)

    print(f"\n{len(real)} LOD set(s): {changed} merged into existing, {added} new.")
    if args.apply:
        with open(mpath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            f.write('\n')
        print(f"Wrote {os.path.relpath(mpath)}.")
    else:
        print("Dry run — re-run with --apply to write manifest.json.")


if __name__ == '__main__':
    main()
