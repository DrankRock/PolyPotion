#!/usr/bin/env python3
# ============================================================
# anim_chunker.py — prep motion clips (.fbx / .glb) for the Studio library
# on Cloudflare Pages (25 MiB per-file limit), reassembled in the browser
# by studio3D_scripts/chunk-loader.js.
#
# Just run it from your animations folder:
#     python3 anim_chunker.py
#
# What it does, per file:
#   * files over 20 MiB are split EVENLY into `<file>.part000`, … + a
#     `<file>.chunks.json` sidecar {chunks,size}. Even = a 27 MB clip becomes
#     2 × 13.5 MB, never an ugly 25 + 2 split.
#   * reads the REAL frame count + fps straight out of the FBX binary
#     (AnimationStack LocalStart/LocalStop KTime + GlobalSettings TimeMode;
#     handles FBX 7.0–7.7, 32- and 64-bit records, zlib'd KeyTime arrays as
#     fallback, ASCII FBX, and glTF/GLB via accessor max).
#   * UPDATES manifest.json itself: sets/clears chunked flags, fills in
#     frames/fps on entries where frames is 0/missing, and adds a full entry
#     {id,label,path,ext,frames,fps} for any clip not listed yet.
#     Existing ids/labels are never touched.
#
# Flags (all optional):
#     --delete          delete the original after splitting (needed before a
#                       Cloudflare deploy — the whole file is over the limit)
#     --threshold MB    split files above this size (default 20)
#     --refresh-frames  re-read frames/fps even on entries that already have them
# ============================================================

import os
import re
import json
import glob
import zlib
import struct
import argparse

PAD = 3
THRESHOLD = 20 * 1024 * 1024              # split anything over 20 MiB
EXTS = ('.fbx', '.glb', '.gltf')
DEFAULT_PREFIX = 'data/animations'

# ---------------------------------------------------------------- FBX probing

KTIME = 46186158000                        # FBX ticks per second
TIMEMODE_FPS = {0: 30, 1: 120, 2: 100, 3: 60, 4: 50, 5: 48, 6: 30, 7: 60,
                8: 29.97, 9: 30, 10: 29.97, 11: 25, 12: 24, 13: 1,
                14: 23.976, 16: 96, 17: 72, 18: 59.94}


def probe_fbx_binary(data):
    """Walk the binary FBX node tree collecting LocalStart/LocalStop KTimes,
    TimeMode/CustomFrameRate, and (as a fallback) the max KeyTime."""
    ver = struct.unpack_from('<I', data, 23)[0]
    big = ver >= 7500                      # 7.5+ = 64-bit record headers
    info = {'start': None, 'stop': None, 'timemode': None,
            'customfps': None, 'maxkey': 0}

    def read_props(pos, count):
        vals = []
        for _ in range(count):
            t = chr(data[pos]); pos += 1
            if t == 'Y':
                vals.append(struct.unpack_from('<h', data, pos)[0]); pos += 2
            elif t == 'C':
                vals.append(data[pos] != 0); pos += 1
            elif t == 'I':
                vals.append(struct.unpack_from('<i', data, pos)[0]); pos += 4
            elif t == 'F':
                vals.append(struct.unpack_from('<f', data, pos)[0]); pos += 4
            elif t == 'D':
                vals.append(struct.unpack_from('<d', data, pos)[0]); pos += 8
            elif t == 'L':
                vals.append(struct.unpack_from('<q', data, pos)[0]); pos += 8
            elif t in 'SR':
                ln = struct.unpack_from('<I', data, pos)[0]; pos += 4
                vals.append(data[pos:pos + ln] if t == 'S' else None); pos += ln
            elif t in 'fdlib':
                n, enc, clen = struct.unpack_from('<III', data, pos); pos += 12
                if t == 'l':               # KeyTime arrays — decode for fallback
                    raw = data[pos:pos + clen]
                    if enc:
                        try:
                            raw = zlib.decompress(raw)
                        except zlib.error:
                            raw = b''
                    if len(raw) >= 8:
                        arr = struct.unpack_from('<%dq' % (len(raw) // 8), raw)
                        info['maxkey'] = max(info['maxkey'], max(arr))
                    vals.append(None)
                    pos += clen
                else:
                    vals.append(None)
                    pos += (clen if enc else n * {'f': 4, 'd': 8, 'i': 4, 'b': 1}[t])
            else:                          # unknown type — bail on this record
                return vals, None
        return vals, pos

    def handle(name, vals):
        if name != 'P' or not vals or not isinstance(vals[0], bytes):
            return
        p = vals[0].decode('latin1', 'replace')
        nums = [v for v in vals[1:] if isinstance(v, (int, float)) and not isinstance(v, bool)]
        if not nums:
            return
        v = nums[-1]
        if p == 'LocalStop':
            info['stop'] = max(info['stop'] or 0, v)
        elif p == 'LocalStart':
            info['start'] = v if info['start'] is None else min(info['start'], v)
        elif p == 'ReferenceStop' and not info['stop']:
            info['stop'] = v
        elif p == 'TimeMode':
            info['timemode'] = int(v)
        elif p == 'CustomFrameRate':
            info['customfps'] = float(v)

    def walk(pos, end):
        while pos < end:
            if big:
                if pos + 25 > len(data):
                    return
                eo, np_, pl = struct.unpack_from('<QQQ', data, pos)
                nl = data[pos + 24]; hp = pos + 25
            else:
                if pos + 13 > len(data):
                    return
                eo, np_, pl = struct.unpack_from('<III', data, pos)
                nl = data[pos + 12]; hp = pos + 13
            if eo == 0:                    # null terminator record
                return
            name = data[hp:hp + nl].decode('latin1', 'replace'); hp += nl
            vals, after = read_props(hp, np_)
            handle(name, vals)
            if hp + pl < eo:               # nested children present
                walk(hp + pl, eo)
            pos = eo

    walk(27, len(data))
    return info


def probe_fbx_ascii(data):
    text = data.decode('latin1', 'replace')
    info = {'start': 0, 'stop': None, 'timemode': None, 'customfps': None, 'maxkey': 0}
    stops = [int(m) for m in re.findall(r'"LocalStop",[^,]*,[^,]*,[^,]*,\s*(\d+)', text)]
    if stops:
        info['stop'] = max(stops)
    m = re.search(r'"TimeMode",[^,]*,[^,]*,[^,]*,\s*(\d+)', text)
    if m:
        info['timemode'] = int(m.group(1))
    m = re.search(r'"CustomFrameRate",[^,]*,[^,]*,[^,]*,\s*([\d.]+)', text)
    if m:
        info['customfps'] = float(m.group(1))
    return info


def probe_glb(data):
    """glTF/GLB: duration = max input-accessor 'max' across all samplers."""
    if data[:4] == b'glTF':
        jlen = struct.unpack_from('<I', data, 12)[0]
        doc = json.loads(data[20:20 + jlen])
    else:
        doc = json.loads(data)
    dur = 0.0
    for anim in doc.get('animations', []):
        for s in anim.get('samplers', []):
            acc = doc['accessors'][s['input']]
            if acc.get('max'):
                dur = max(dur, float(acc['max'][0]))
    return dur


def read_frames(path):
    """Returns (frames, fps) — (0, 30) when nothing could be extracted."""
    try:
        with open(path, 'rb') as f:
            data = f.read()
        ext = path.rsplit('.', 1)[-1].lower()
        if ext in ('glb', 'gltf'):
            dur = probe_glb(data)
            return (int(round(dur * 30)) + 1 if dur else 0), 30
        # FBX
        if data[:20] == b'Kaydara FBX Binary  ':
            info = probe_fbx_binary(data)
        else:
            info = probe_fbx_ascii(data)
        cf = info.get('customfps')
        fps = cf if (cf and cf > 0) else (TIMEMODE_FPS.get(info.get('timemode'), 30) or 30)
        if fps <= 0:
            fps = 30
        fps_out = int(round(fps)) if abs(fps - round(fps)) < 0.05 else fps
        start = info.get('start') or 0
        stop = info.get('stop') or 0
        if stop <= start and info.get('maxkey'):
            stop, start = info['maxkey'], 0
        if stop > start:
            return max(0, int(round((stop - start) / KTIME * fps)) + 1), fps_out
        return 0, fps_out
    except Exception as e:
        print(f"  ! frame probe failed for {os.path.basename(path)}: {e}")
        return 0, 30


# ---------------------------------------------------------------- chunking

def split_even(path, threshold):
    """Split into ceil(size/threshold) EQUAL parts (a 27 MB file → 2 × 13.5 MB,
    never 25 + 2). Sidecar format matches chunk-loader.js exactly."""
    total = os.path.getsize(path)
    n = (total + threshold - 1) // threshold
    part = (total + n - 1) // n
    for old in glob.glob(path + '.part*'):
        os.remove(old)
    with open(path, 'rb') as f:
        for i in range(n):
            with open(f"{path}.part{i:0{PAD}d}", 'wb') as out:
                out.write(f.read(part))
    with open(path + '.chunks.json', 'w') as f:
        json.dump({"chunks": n, "size": total}, f)
    return n, total, part


def clear_parts(path):
    removed = False
    for old in glob.glob(path + '.part*') + glob.glob(path + '.chunks.json'):
        os.remove(old)
        removed = True
    return removed


# ---------------------------------------------------------------- manifest

def slugify(name):
    base = re.sub(r'\.[^.]+$', '', name).lower()
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', base)).replace('-', '_')


MANIFEST_COMMENT = (
    "Motion clips available in the Studio library. Each entry: {id,label,path,"
    "ext,frames,fps,chunked?,chunks?}. Files over 20 MiB are split into even "
    ".partNNN pieces by anim_chunker.py (chunk-loader.js reassembles them). "
    "frames/fps are read from the file automatically — set frames to 0 to have "
    "the chunker re-read them. Mixamo clips work as-is, with or without skin."
)


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


def sync_manifest(manifest_path, results, refresh):
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
            data = {"comment": MANIFEST_COMMENT, "animations": []}
    else:
        manifest_path = manifest_path or os.path.join(os.getcwd(), 'manifest.json')
        print(f"  creating new manifest at {os.path.relpath(manifest_path)}")
        data = {"comment": MANIFEST_COMMENT, "animations": []}
    anims = data.setdefault('animations', []) if isinstance(data, dict) else data

    prefix = DEFAULT_PREFIX
    for a in anims:
        p = a.get('path', '')
        if '/' in p:
            prefix = os.path.dirname(p)
            break

    seen = set()
    changed = added = 0
    for a in anims:
        key = os.path.basename(a.get('path', '')).lower()
        seen.add(key)
        r = results.get(key)
        if not r:
            continue
        before = (a.get('chunked'), a.get('chunks'), a.get('frames'), a.get('fps'))
        if r['n']:
            a['chunked'] = "true"
            a['chunks'] = r['n']
        else:
            a.pop('chunked', None)
            a.pop('chunks', None)
        if r['frames'] and (refresh or not a.get('frames')):
            a['frames'] = r['frames']
            a['fps'] = r['fps']
        if (a.get('chunked'), a.get('chunks'), a.get('frames'), a.get('fps')) != before:
            changed += 1

    for key, r in sorted(results.items()):
        if key in seen:
            continue
        label = re.sub(r'\.[^.]+$', '', r['name'])
        e = {
            "id": slugify(r['name']),
            "label": label,
            "path": prefix.rstrip('/') + '/' + r['name'],
            "ext": r['name'].rsplit('.', 1)[-1].lower(),
            "frames": r['frames'],
            "fps": r['fps'],
            "source": "mixamo",
        }
        if r['n']:
            e["chunked"] = "true"
            e["chunks"] = r['n']
        anims.append(e)
        added += 1

    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
        f.write('\n')
    print(f"  manifest: {changed} updated, {added} added ({os.path.relpath(manifest_path)})")


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description="Chunk oversized motion clips + read their frame counts.")
    ap.add_argument('--threshold', type=float, default=THRESHOLD / 1048576,
                    help="MB above which a file is split into even parts (default 20)")
    ap.add_argument('--delete', action='store_true',
                    help="delete the original after splitting")
    ap.add_argument('--refresh-frames', action='store_true',
                    help="re-read frames/fps even on entries that already have them")
    args = ap.parse_args()
    limit = int(args.threshold * 1048576)

    files = [p for p in glob.glob('**/*', recursive=True)
             if os.path.isfile(p) and p.lower().endswith(EXTS)
             and '.part' not in p]
    if not files:
        print(f"No {'/'.join(EXTS)} files found under {os.getcwd()}")
        return

    print(f"anim_chunker — {len(files)} clip(s) under {os.getcwd()}")
    results = {}
    for p in sorted(files):
        name = os.path.basename(p)
        size = os.path.getsize(p)
        frames, fps = read_frames(p)
        ftxt = f"{frames}f @ {fps}fps" if frames else "frames unknown"
        if size <= limit:
            if clear_parts(p):
                print(f"  unchunk {name} — {size/1048576:.1f} MB, removed stale parts · {ftxt}")
            else:
                print(f"  ok      {name} — {size/1048576:.1f} MB · {ftxt}")
            results[name.lower()] = {'n': None, 'name': name, 'frames': frames, 'fps': fps}
            continue
        n, total, part = split_even(p, limit)
        results[name.lower()] = {'n': n, 'name': name, 'frames': frames, 'fps': fps}
        print(f"  split   {name} — {total/1048576:.1f} MB -> {n} even parts of {part/1048576:.1f} MB · {ftxt}")
        if args.delete:
            os.remove(p)
            print(f"          removed original {name}")

    sync_manifest(find_manifest(), results, args.refresh_frames)
    print("done.")


if __name__ == '__main__':
    main()
