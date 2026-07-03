#!/usr/bin/env python3
# ============================================================
# chunker.py — split oversized .glb / .fbx / .gltf assets so they fit on
# Cloudflare Pages (25 MiB per-file limit) and reassemble in the browser
# via studio3D_scripts/chunk-loader.js.
#
# Just run it from the folder with your models:
#     python3 chunker.py
#
# It scans the CURRENT folder (recursively), splits every file over the
# limit into `<file>.part000`, `<file>.part001`, … plus a tiny
# `<file>.chunks.json`, and UPDATES manifest.json itself:
#   * sets "chunked":"true" + "chunks":N on files it split,
#   * clears those flags on files that are no longer chunked,
#   * ADDS a rich entry {id,label,path,ext,rig,rigged,source,tags} for any
#     model file that isn't in the manifest yet (so you never lose metadata
#     just by dropping in new characters), and
#   * NEVER touches existing labels/ids/tags/etc. — your edits are preserved.
#
# Flags (all optional):
#     --delete     also delete the original after splitting (needed before a
#                  Cloudflare deploy, since the whole file is over the limit)
#     --threshold  MB above which a file is split (default 24)
# ============================================================

import os
import re
import json
import glob
import argparse

PAD = 3                                   # digits in .partNNN (matches chunk-loader.js)
CHUNK_SIZE = 24 * 1024 * 1024             # 24 MiB — safely under Cloudflare's 25 MiB
EXTS = ('.glb', '.fbx', '.gltf')
DEFAULT_PREFIX = 'data/characters'        # manifest path prefix for new entries


def find_manifest():
    """Walk up from cwd looking for an existing manifest.json.
    If none is found anywhere, fall back to ./manifest.json in the current
    folder — sync_manifest() will create it fresh."""
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
    # clean any stale parts from a previous run
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
    """Remove any stale parts/sidecar for a file that is no longer chunked."""
    removed = False
    for old in glob.glob(path + '.part*') + glob.glob(path + '.chunks.json'):
        os.remove(old)
        removed = True
    return removed


def slugify(name):
    base = re.sub(r'\.[^.]+$', '', name).lower()
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', base))


def derive_tags(name):
    """Best-guess starter categories from the filename. Edit freely afterwards —
    the chunker never overwrites tags on an entry it has already seen."""
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


def new_entry(name, prefix, n):
    label = re.sub(r'\.[^.]+$', '', name)
    ext = (name.rsplit('.', 1)[-1] if '.' in name else 'glb').lower()
    e = {
        "id": slugify(name),
        "label": label,
        "path": (prefix.rstrip('/') + '/' + name) if prefix else name,
        "ext": ext,
        "rig": "unknown",
        "rigged": "false",
        "source": "local",
        "tags": derive_tags(name),
    }
    if n:
        e["chunked"] = "true"
        e["chunks"] = n
    return e


MANIFEST_COMMENT = (
    "Studio character library. Each entry: {id,label,path,ext,rig,rigged,"
    "source,tags,chunked?,chunks?}. rig=mixamo|autorig|unknown. tags are "
    "free-form categories used by the library filter (e.g. male,female,human,"
    "non-human,sfw,nsfw,t-pose). Add/edit tags freely — chunker.py never "
    "overwrites them. Paths are relative to the app root. Portraits go in "
    "data/characters/pfp/<id>.png"
)


def sync_manifest(manifest_path, results):
    """results: {basename_lower: {'n': chunks_or_None, 'name': original_basename}}.
    Always writes manifest_path, creating it from scratch if it doesn't exist."""
    if manifest_path and os.path.isfile(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            # Corrupt/empty manifest — back it up and start clean rather than crash.
            print(f"  ! manifest.json unreadable ({e}); backing up to manifest.json.bak")
            try:
                os.replace(manifest_path, manifest_path + '.bak')
            except OSError:
                pass
            data = {"comment": MANIFEST_COMMENT, "characters": []}
    else:
        # No manifest anywhere — create a fresh one.
        manifest_path = manifest_path or os.path.join(os.getcwd(), 'manifest.json')
        print(f"  creating new manifest at {os.path.relpath(manifest_path)}")
        data = {"comment": MANIFEST_COMMENT, "characters": []}
    is_list = isinstance(data, list)
    chars = data if is_list else data.setdefault('characters', [])

    # detect the path prefix already used in the manifest (e.g. data/characters)
    prefix = DEFAULT_PREFIX
    for c in chars:
        p = c.get('path', '')
        if '/' in p:
            prefix = os.path.dirname(p)
            break

    seen = set()
    changed = added = 0
    for c in chars:
        key = os.path.basename(c.get('path', '')).lower()
        seen.add(key)
        if key not in results:
            continue
        n = results[key]['n']
        if n:                                  # now chunked
            if c.get('chunked') != "true" or c.get('chunks') != n:
                c['chunked'] = "true"
                c['chunks'] = n
                changed += 1
        else:                                  # not chunked — clear stale flags
            if 'chunked' in c or 'chunks' in c:
                c.pop('chunked', None)
                c.pop('chunks', None)
                changed += 1

    # add rich entries for any model files not already in the manifest
    for key, info in sorted(results.items()):
        if key in seen:
            continue
        chars.append(new_entry(info['name'], prefix, info['n']))
        added += 1

    # always write — creating the file if it didn't exist, refreshing it otherwise
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
        f.write('\n')
    print(f"  manifest: {changed} updated, {added} added "
          f"({os.path.relpath(manifest_path)})")


def main():
    ap = argparse.ArgumentParser(description="Chunk oversized GLB/FBX in the current folder.")
    ap.add_argument('--threshold', type=float, default=CHUNK_SIZE / 1048576,
                    help="MB above which a file is split (default 24)")
    ap.add_argument('--delete', action='store_true',
                    help="delete the original after splitting")
    args = ap.parse_args()
    limit = args.threshold * 1048576

    # every model under the current folder, recursively
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
                print(f"  ok      {name} — {size/1048576:.1f} MB, under {args.threshold:.0f} MB")
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
