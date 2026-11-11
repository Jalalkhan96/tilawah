#!/usr/bin/env python3
"""Build app/data/tajweed.json from the AlQuran Cloud quran-tajweed edition.

The edition carries the same Tanzil Uthmani text with tajweed rule markup:
  [x:123[text]  or  [x[text]   (x = rule code, 123 = meta id)
We store the marked text per global ayah number, but ONLY after verifying
that stripping the markup reproduces our validated ayah text exactly
(normalized compare: tatweel and whitespace unified). Any ayah that does
not match is dropped — the reader then shows the plain text for it.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
raw = json.loads((ROOT / 'data-raw/quran-tajweed.json').read_text())
ours = json.loads((ROOT / 'app/data/quran.json').read_text())

MARK = re.compile(r'\[([a-z])(?::\d+)?\[')

def strip_markup(t):
    t = MARK.sub('', t)
    return t.replace(']', '')

def norm(t):
    return re.sub(r'\s+', ' ', t.replace('ـ', '')).strip()

our_by_g = {}
for s in ours['surahs']:
    for a in s['ayahs']:
        our_by_g[a['g']] = a['t']

out = {}
exact = normalized = dropped = 0
for s in raw['data']['surahs']:
    for a in s['ayahs']:
        g = a['number']
        plain = strip_markup(a['text'])
        ref = our_by_g.get(g)
        if ref is None:
            dropped += 1
            continue
        if plain == ref:
            exact += 1
        elif norm(plain) == norm(ref):
            normalized += 1
        else:
            dropped += 1
            if dropped <= 3:
                print('MISMATCH g=', g)
                print('  taj:', plain[:90])
                print('  our:', ref[:90])
            continue
        out[str(g)] = a['text']

print(f'exact={exact} normalized-only={normalized} dropped={dropped} kept={len(out)}')
if len(out) < 6200:
    print('TOO MANY DROPPED — aborting'); sys.exit(1)
dest = ROOT / 'app/data/tajweed.json'
dest.write_text(json.dumps({'ayahs': out}, ensure_ascii=False, separators=(',', ':')))
print('wrote', dest, dest.stat().st_size, 'bytes')
