#!/usr/bin/env python3
"""Map AlQuran Cloud tajweed annotations onto OUR validated Tanzil text.

The quran-tajweed edition annotates a different ENCODING of the Uthmani
text. We never display that edition's text. Per ayah we fold both texts
into comparable units and require the folded unit sequences to be
IDENTICAL; only then are annotation spans translated into our character
coordinates via the unit index map. Ayahs that fail the proof render
plain — no exceptions.

Fold rules (each is an encoding convention, not a text change):
  drop: tatweel, ZWNJ/ZWJ, waqf signs U+06D6-06DC/06DE/06E8/06EA-06EC,
        spaces, and the Tanzil small-meem markers U+06ED/U+06E2
        (pronunciation signs the other edition writes as full letters
        or omits; where they are not purely additive the ayah fails
        the equality proof and is dropped)
  map:  0672/0673/0674/0675 -> 0670, 0652/06E0 -> 06DF, 066E -> 0649,
        06E7 -> 06E6
  units: theirs U+0623 (أ) == ours U+0621+U+064E (ءَ);
         theirs U+0625 (إ) == ours U+0621+U+0650 (ءِ);
         ours U+0649+U+0670 (ىٰ) == theirs U+0670 (ٰ)
Output: app/data/tajweed.json {g: [[start, end, code], ...]} in OUR
character coordinates (Basmala prefix included for ayah 1).
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
raw = json.loads((ROOT / 'data-raw/quran-tajweed.json').read_text())
ours = json.loads((ROOT / 'app/data/quran.json').read_text())

DROP = set('ـ‌‍') | {chr(c) for c in range(0x06D6, 0x06DD)} | {'۞', 'ۨ', '۪', '۫', '۬', 'ۭ', 'ۢ'}
MAP = {'ٲ': 'ٰ', 'ٳ': 'ٰ', 'ٴ': 'ٰ', 'ٵ': 'ٰ', 'ٮ': 'ى', 'ْ': '۟', '۠': '۟', 'ۧ': 'ۦ'}
OPEN = re.compile(r'\[([a-z])(?::\d+)?\[')

def fold_units(text, side=None):
    """Return (units, spans): units[k] is the folded unit string, spans[k]
    is (start, end) char range in `text` producing that unit. The same
    rules apply to both editions (symmetric fold)."""
    units, spans = [], []
    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch in DROP or ch == ' ':
            i += 1
            continue
        if ch == 'أ':
            units.append('ءَ'); spans.append((i, i + 1)); i += 1; continue
        if ch == 'إ':
            units.append('ءِ'); spans.append((i, i + 1)); i += 1; continue
        if ch == 'ء' and i + 1 < n and text[i + 1] in 'َِ':
            units.append('ء' + text[i + 1]); spans.append((i, i + 2)); i += 2; continue
        if ch == 'ى' and i + 1 < n and text[i + 1] == 'ٰ':
            units.append('ٰ'); spans.append((i, i + 2)); i += 2; continue
        units.append(MAP.get(ch, ch)); spans.append((i, i + 1)); i += 1
    return units, spans

def parse_marked(marked):
    plain, spans, stack = [], [], []
    i, n = 0, len(marked)
    while i < n:
        m = OPEN.match(marked, i)
        if m:
            stack.append((m.group(1), len(plain)))
            i = m.end()
            continue
        ch = marked[i]
        if ch == ']':
            if not stack:
                return None
            code, start = stack.pop()
            if len(plain) > start:
                spans.append([start, len(plain), code])
            i += 1
            continue
        if ch == '[':
            return None
        plain.append(ch)
        i += 1
    if stack:
        return None
    return ''.join(plain), spans

our_by_g, meta = {}, {}
for si, s in enumerate(ours['surahs']):
    for a in s['ayahs']:
        our_by_g[a['g']] = a['t']
        meta[a['g']] = (si + 1, a['n'])

out, kept_n, dropped = {}, 0, 0
for s in raw['data']['surahs']:
    for a in s['ayahs']:
        g = a['number']
        si, an = meta[g]
        parsed = parse_marked(a['text'])
        if parsed is None:
            dropped += 1
            continue
        their_plain, spans = parsed
        ref = our_by_g[g]
        offset = 0
        if an == 1 and si not in (1, 9):
            toks = ref.split(' ')
            offset = len(' '.join(toks[:4])) + 1
            ref = ' '.join(toks[4:])
        t_units, t_spans = fold_units(their_plain, 'theirs')
        o_units, o_spans = fold_units(ref, 'ours')
        if t_units != o_units:
            dropped += 1
            continue
        # their char index -> unit ordinal
        ordinal = {}
        for k, (st, en) in enumerate(t_spans):
            for idx in range(st, en):
                ordinal[idx] = k
        mapped = []
        ok = True
        for st, en, code in spans:
            while st < en and st not in ordinal:
                st += 1
            while en > st and (en - 1) not in ordinal:
                en -= 1
            if st >= en:
                continue
            try:
                os_ = o_spans[ordinal[st]][0]
                oe = o_spans[ordinal[en - 1]][1]
            except (KeyError, IndexError):
                ok = False
                break
            mapped.append([os_ + offset, oe + offset, code])
        if not ok or not mapped:
            dropped += 1
            continue
        out[str(g)] = mapped
        kept_n += 1

print(f'kept={kept_n} dropped={dropped} coverage={kept_n/6236:.1%}')
dest = ROOT / 'app/data/tajweed.json'
dest.write_text(json.dumps({'ayahs': out}, ensure_ascii=False, separators=(',', ':')))
print('wrote', dest, dest.stat().st_size, 'bytes')
