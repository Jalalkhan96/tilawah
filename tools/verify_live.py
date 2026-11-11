#!/usr/bin/env python3
"""Verify the live Tilawah deployment: re-download every data part from the
production URL, reassemble, and compare byte count + sha256 against the
manifests the live site itself serves. Also spot-checks the v3 fields."""
import hashlib, json, sys, time, urllib.request

BASE = 'https://tilawah-eight.vercel.app'
DATASETS = [
    ('data/quran.parts.json', 'data/parts/quran'),
    ('data/words.parts.json', 'data/parts-words/words'),
    ('data/hadith.parts.json', 'data/parts-hadith/hadith'),
    ('data/tajweed.parts.json', 'data/parts-tajweed/tajweed'),
]

def fetch(url, tries=4):
    last = None
    for _ in range(tries):
        try:
            with urllib.request.urlopen(url, timeout=40) as r:
                return r.read()
        except Exception as e:  # proxy flakiness — retry a few times
            last = e
            time.sleep(2)
    raise RuntimeError(f'fetch failed {url}: {last}')

def main():
    ok_all = True
    for manifest_path, prefix in DATASETS:
        m = json.loads(fetch(f'{BASE}/{manifest_path}'))
        buf = b''
        for i in range(m['parts']):
            buf += fetch(f'{BASE}/{prefix}-{i:03}.bin')
        ok = len(buf) == m['bytes'] and hashlib.sha256(buf).hexdigest() == m['sha256']
        ok_all &= ok
        print(f"{prefix}: {'REASSEMBLY OK' if ok else 'MISMATCH'} ({len(buf)}/{m['bytes']} bytes)", flush=True)
        if prefix.endswith('quran'):
            q = json.loads(buf)
            a = q['surahs'][1]['ayahs'][254]
            print('  2:255 keys:', sorted(a.keys()))
            print('  UR:', a['u'][:40])
            print('  PS:', a['s'][:40])
            print('  ASAD:', a['a'][:60])
    # v4 spot checks: service worker version, v4 script, hadith Urdu, tajweed coverage
    sw = fetch(f'{BASE}/sw.js').decode('utf-8', 'replace')
    v4js = fetch(f'{BASE}/js/v4.js').decode('utf-8', 'replace')
    home = fetch(f'{BASE}/').decode('utf-8', 'replace')
    checks = [
        ('SW is tilawah-shell-v7', 'tilawah-shell-v7' in sw),
        ('SW precaches tajweed parts', 'parts-tajweed/tajweed-006.bin' in sw),
        ('SW caches everyayah audio', 'everyayah.com' in sw),
        ('v4.js has EveryAyah reciters', 'eya.ghamdi' in v4js and 'Husary_Muallim_128kbps' in v4js),
        ('v4.js has 25 translation packs', 'ml.abdulhameed' in v4js and 'fr.hamidullah' in v4js),
        ('home loads v4.js', 'js/v4.js' in home),
        ('home has Listen view', 'id="view-listen"' in home),
        ('home has 16 tabs', home.count('data-view=') >= 16),
    ]
    for name, ok in checks:
        ok_all &= ok
        print(f'{name}: {"OK" if ok else "FAIL"}', flush=True)
    print('ALL OK' if ok_all else 'FAILURES PRESENT')
    sys.exit(0 if ok_all else 1)

if __name__ == '__main__':
    main()
