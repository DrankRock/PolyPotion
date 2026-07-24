#!/usr/bin/env python3
# ============================================================
# lodpack.py — ingest LOD-set zips exported from Studio (Decimate → "Export LOD
# set for Library") into your character library, and wire them into manifest.json.
#
# WHAT IT DOES, per zip found in  data/characters/new/*_LODset.zip :
#   1. Extracts it. A set is:
#        <Label>_100.glb  <Label>_60.glb  <Label>_30.glb  <Label>_12.glb …
#        <Label>_lods.manifest.json   (id, label, path, ext, lods[{pct,path,tris}])
#   2. Copies every rung .glb into  data/characters/  (replacing any existing
#      file of that name).
#   3. Removes the character's OLD single file + its chunk parts
#      (e.g. "Egyptian tomb spirit.glb", ".glb.part000…", ".glb.chunks.json") —
#      the _100 rung is the new base.
#   4. Chunks any rung .glb over the Cloudflare limit (24 MiB) into
#      "<file>.part000…" + "<file>.chunks.json" and deletes the whole .glb, so
#      nothing over the limit ships. Smaller rungs stay whole.
#   5. Updates data/characters/manifest.json: finds the matching character
#      (by id, then label) — PRESERVING its tags / rig / rigged / source /
#      portrait — and sets:
#         "path"  -> the _100 rung
#         "lods"  -> [{pct, path, tris, chunked?, chunks?}]  (high → low)
#      plus top-level chunked/chunks mirroring the _100 rung (old readers).
#      If no match exists, a new entry is appended (tags from the snippet).
#   6. Moves the processed zip to  data/characters/new/_done/  (so re-runs skip it).
#
# USAGE (run anywhere at/above data/characters, or inside it):
#     python3 lodpack.py            # DRY RUN — prints the plan, changes nothing
#     python3 lodpack.py --apply    # do it
#     python3 lodpack.py --apply --threshold 24   # custom split size in MiB
#     python3 lodpack.py --apply --keep-zip        # don't move the zips aside
#
# Safe to re-run. Non-destructive until --apply. Backs up manifest.json to
# manifest.json.bak before writing.
# ============================================================

import os
import re
import sys
import json
import glob
import shutil
import zipfile
import argparse

PAD = 3
EXTS = ('.glb', '.gltf', '.fbx')
LOD_RX = re.compile(r'^(?P<base>.+)_(?P<pct>\d{1,3})$')


# ---------------------------------------------------------------- locate library
def find_characters_dir():
    """Return the data/characters dir that holds manifest.json, searching cwd,
    ./data/characters, and parents."""
    cands = [
        os.getcwd(),
        os.path.join(os.getcwd(), 'data', 'characters'),
        os.path.join(os.getcwd(), 'characters'),
    ]
    d = os.getcwd()
    while True:
        cands.append(os.path.join(d, 'data', 'characters'))
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    for c in cands:
        if os.path.isfile(os.path.join(c, 'manifest.json')):
            return c
    # fall back: a dir literally named characters with a new/ subfolder
    for c in cands:
        if os.path.isdir(os.path.join(c, 'new')):
            return c
    return None


def slugify(name):
    base = re.sub(r'\.[^.]+$', '', name).lower()
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', base))


def parse_lod(name):
    stem = re.sub(r'\.[^.]+$', '', name)
    m = LOD_RX.match(stem)
    if not m:
        return None, None
    pct = int(m.group('pct'))
    return (m.group('base'), pct) if 1 <= pct <= 100 else (None, None)


# ---------------------------------------------------------------- chunking
def chunk_file(path, size, chunk_size, apply, log):
    """Plan/perform chunking for a rung. `size` is the file's byte size (known
    up front so dry runs work without the file living in chars_dir yet).
    Returns the chunk count, or None if the file is left whole. On --apply the
    whole glb is split and then deleted (it's over the limit)."""
    stale = glob.glob(path + '.part*') + glob.glob(path + '.chunks.json')
    if size <= chunk_size:
        for s in stale:
            log(f'      rm stale {os.path.basename(s)}')
            if apply:
                os.remove(s)
        return None
    n = (size + chunk_size - 1) // chunk_size
    log(f'      chunk {os.path.basename(path)}  {size/1048576:.1f} MB -> {n} parts, then delete whole glb')
    if not apply:
        return n
    for s in stale:
        os.remove(s)
    with open(path, 'rb') as f:
        for i in range(n):
            with open(f'{path}.part{i:0{PAD}d}', 'wb') as out:
                out.write(f.read(chunk_size))
    with open(path + '.chunks.json', 'w') as f:
        json.dump({'chunks': n, 'size': size}, f)
    os.remove(path)   # the whole glb must not ship (over the limit)
    return n


def remove_old_base(chars_dir, old_path, apply, log):
    """Delete the character's previous single file + its chunk sidecars."""
    if not old_path:
        return
    fname = os.path.basename(old_path)
    victims = [os.path.join(chars_dir, fname)]
    victims += glob.glob(os.path.join(chars_dir, fname + '.part*'))
    victims += glob.glob(os.path.join(chars_dir, fname + '.chunks.json'))
    for v in victims:
        if os.path.exists(v):
            log(f'      remove old {os.path.basename(v)}')
            if apply:
                os.remove(v)


# ---------------------------------------------------------------- manifest merge
def load_manifest(mpath):
    with open(mpath, 'r', encoding='utf-8') as f:
        return json.load(f)


def manifest_prefix(chars):
    for c in chars:
        p = c.get('path', '')
        if '/' in p:
            return os.path.dirname(p)
    return 'data/characters'


def full_path(prefix, name):
    return (prefix.rstrip('/') + '/' + name) if prefix else name


# ---------------------------------------------------------------- one zip
def process_zip(zip_path, chars_dir, data, chunk_size, apply, log):
    chars = data if isinstance(data, list) else data.setdefault('characters', [])
    prefix = manifest_prefix(chars)
    zbase = os.path.basename(zip_path)[:-len('_LODset.zip')]
    log(f'\n=== {os.path.basename(zip_path)}  (character: "{zbase}") ===')

    # 1. extract the whole zip into its OWN subfolder under new/_extract/
    extract_root = os.path.join(os.path.dirname(zip_path), '_extract', zbase)
    if os.path.isdir(extract_root):
        shutil.rmtree(extract_root)
    os.makedirs(extract_root, exist_ok=True)
    with zipfile.ZipFile(zip_path) as zf:
        zf.extractall(extract_root)

    # gather the extracted files (recursively — zips may nest a folder)
    extracted = {}   # basename -> full path on disk
    snippet = None
    for root, _dirs, files in os.walk(extract_root):
        for b in files:
            fp = os.path.join(root, b)
            if b.endswith('_lods.manifest.json') and snippet is None:
                try:
                    with open(fp, 'r', encoding='utf-8') as f:
                        snippet = json.load(f)
                except Exception as e:
                    log(f'  ! bad LOD manifest snippet ({e}); deriving from filenames')
            extracted[b] = fp

    # the rung glbs (<name>_<pct>.glb) with their on-disk size
    rungs = []   # (pct, filename, srcpath, size)
    for b, fp in extracted.items():
        base, pct = parse_lod(b)
        if base is not None and b.lower().endswith(EXTS):
            rungs.append((pct, b, fp, os.path.getsize(fp)))
    if not rungs:
        log('  ! no <name>_<pct>.glb found inside the zip — skipping')
        shutil.rmtree(extract_root, ignore_errors=True)
        return False
    rungs.sort(key=lambda x: -x[0])
    if not any(p == 100 for p, _, _, _ in rungs):
        log('  ! no _100 base rung in the set — skipping (need the full-detail rung)')
        shutil.rmtree(extract_root, ignore_errors=True)
        return False

    # tris lookup from the snippet, keyed by pct
    tris_by_pct = {}
    if snippet and isinstance(snippet.get('lods'), list):
        for l in snippet['lods']:
            try:
                tris_by_pct[int(l['pct'])] = int(l.get('tris') or 0)
            except Exception:
                pass

    # find the existing manifest entry this replaces
    snip_id = (snippet or {}).get('id') or slugify(zbase)
    snip_label = (snippet or {}).get('label') or zbase
    entry = None
    for c in chars:
        if c.get('id') == snip_id or slugify(c.get('label', '')) == slugify(snip_label):
            entry = c
            break

    placed_names = {fname for _, fname, _, _ in rungs}

    # 2. copy each rung glb from the extract folder into chars_dir (replacing)
    for pct, fname, src, _size in rungs:
        dst = os.path.join(chars_dir, fname)
        log(f'  rung {pct:>3}%  ->  {fname}')
        if apply:
            shutil.copyfile(src, dst)

    # 3. remove the old single base file (+ chunks) it used to point at
    if entry and entry.get('path') and os.path.basename(entry['path']) not in placed_names:
        remove_old_base(chars_dir, entry['path'], apply, log)

    # 4. chunk oversized rungs, build the lods array (sizes known from extract)
    lods = []
    base100 = None
    for pct, fname, _src, size in rungs:
        path_full = full_path(prefix, fname)
        if pct == 100:
            base100 = path_full
        n = chunk_file(os.path.join(chars_dir, fname), size, chunk_size, apply, log)
        rung = {'pct': pct, 'path': path_full}
        if pct in tris_by_pct:
            rung['tris'] = tris_by_pct[pct]
        if n:
            rung['chunked'] = 'true'
            rung['chunks'] = n
        lods.append(rung)
    lods.sort(key=lambda r: -r['pct'])

    # 5. update / create the manifest entry (preserve tags etc.)
    if entry is None:
        entry = {
            'id': snip_id, 'label': snip_label, 'path': base100, 'ext': 'glb',
            'rig': (snippet or {}).get('rig', 'unknown'),
            'rigged': (snippet or {}).get('rigged', 'false'),
            'source': (snippet or {}).get('source', 'local'),
            'tags': list((snippet or {}).get('tags', []) or []),
        }
        chars.append(entry)
        log(f'  + new manifest entry "{snip_label}"')
    else:
        log(f'  ~ updating manifest entry "{entry.get("label", snip_label)}" (tags kept)')
    entry['path'] = base100
    entry['ext'] = 'glb'
    entry['lods'] = lods
    b0 = lods[0]
    if b0.get('chunked'):
        entry['chunked'] = 'true'
        entry['chunks'] = b0['chunks']
    else:
        entry.pop('chunked', None)
        entry.pop('chunks', None)

    log('  lods: ' + ' · '.join(
        f"{l['pct']}%" + (f"({l['chunks']}ch)" if l.get('chunked') else '') for l in lods))

    # 6. clean the extract folder; move the zip aside so re-runs skip it
    if apply:
        shutil.rmtree(extract_root, ignore_errors=True)
        done = os.path.join(os.path.dirname(zip_path), '_done')
        os.makedirs(done, exist_ok=True)
        shutil.move(zip_path, os.path.join(done, os.path.basename(zip_path)))
    else:
        shutil.rmtree(extract_root, ignore_errors=True)
    return True


def main():
    ap = argparse.ArgumentParser(description='Ingest *_LODset.zip files into the character library + manifest.')
    ap.add_argument('--apply', action='store_true', help='perform changes (default: dry run)')
    ap.add_argument('--threshold', type=float, default=24.0, help='chunk size in MiB (default 24)')
    ap.add_argument('--keep-zip', action='store_true', help='do not move processed zips to new/_done/')
    args = ap.parse_args()
    chunk_size = int(args.threshold * 1048576)

    chars_dir = find_characters_dir()
    if not chars_dir:
        print('Could not find data/characters/manifest.json from', os.getcwd())
        sys.exit(1)
    new_dir = os.path.join(chars_dir, 'new')
    mpath = os.path.join(chars_dir, 'manifest.json')
    zips = sorted(glob.glob(os.path.join(new_dir, '*_LODset.zip')))

    print(f'library : {chars_dir}')
    print(f'manifest: {mpath}')
    print(f'incoming: {new_dir}  ({len(zips)} LOD set(s))')
    print(f'mode    : {"APPLY" if args.apply else "DRY RUN (use --apply to write)"}')
    if not zips:
        print('Nothing to do — no *_LODset.zip in the new/ folder.')
        return

    data = load_manifest(mpath)
    log = print
    done = 0
    for z in zips:
        try:
            if process_zip(z, chars_dir, data, chunk_size, args.apply, log):
                done += 1
        except Exception as e:
            log(f'  ! FAILED on {os.path.basename(z)}: {e}')

    if args.apply:
        shutil.copyfile(mpath, mpath + '.bak')
        with open(mpath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
            f.write('\n')
        print(f'\n✓ {done}/{len(zips)} set(s) ingested. manifest.json updated (backup: manifest.json.bak).')
    else:
        print(f'\nDry run complete — {done}/{len(zips)} set(s) ready. Re-run with --apply to write.')


if __name__ == '__main__':
    main()
