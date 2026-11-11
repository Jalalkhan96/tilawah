#!/usr/bin/env python3
"""Merge Urdu (ur.jalandhry), Pashto (ps.abdulwali) and English-Asad (en.asad)
translations into app/data/quran.json as per-ayah fields u / s / a.

Alignment is by the API's global ayah number, cross-checked against our
validated Tanzil data: every edition must yield exactly 6,236 ayahs, the
per-surah ayah counts must match ours, and the global numbering must be a
complete 1..6236 sequence. Any mismatch aborts — nothing is guessed.
"""
import json, os, sys

ROOT = os.path.expanduser('~/workspace/quran-pronunciation-app')
EDITIONS = {'u': 'ur.jalandhry.json', 's': 'ps.abdulwali.json', 'a': 'en.asad.json'}

def load_edition(fname):
    d = json.load(open(os.path.join(ROOT, 'data-raw', fname)))
    assert d['code'] == 200, fname
    by_global = {}
    counts = []
    for s in d['data']['surahs']:
        counts.append(len(s['ayahs']))
        for ay in s['ayahs']:
            by_global[ay['number']] = ay['text']
    return by_global, counts

def main():
    q = json.load(open(os.path.join(ROOT, 'app/data/quran.json')))
    ours_counts = [len(s['ayahs']) for s in q['surahs']]
    maps = {}
    for field, fname in EDITIONS.items():
        m, counts = load_edition(fname)
        assert len(m) == 6236, (fname, len(m))
        assert sorted(m) == list(range(1, 6237)), fname + ': global sequence incomplete'
        assert counts == ours_counts, fname + ': per-surah counts differ'
        assert all(isinstance(v, str) and v.strip() for v in m.values()), fname + ': empty text'
        maps[field] = m
        print(f'{fname}: OK — 6236 ayahs, counts match')
    for s in q['surahs']:
        for ay in s['ayahs']:
            for f, m in maps.items():
                ay[f] = m[ay['g']]
    out = os.path.join(ROOT, 'app/data/quran.json')
    with open(out, 'w', encoding='utf-8') as fh:
        json.dump(q, fh, ensure_ascii=False, separators=(',', ':'))
    print('written', out, os.path.getsize(out), 'bytes')
    # Spot checks
    a255 = q['surahs'][1]['ayahs'][254]
    print('2:255 UR:', a255['u'][:90])
    print('2:255 PS:', a255['s'][:90])
    print('2:255 ASAD:', a255['a'][:110])
    a11 = q['surahs'][0]['ayahs'][0]
    print('1:1 UR:', a11['u'][:80])

if __name__ == '__main__':
    main()
