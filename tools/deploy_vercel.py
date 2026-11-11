#!/usr/bin/env python3
"""Deploy the Tilawah PWA to the existing Vercel project 'tilawah'.

Uploads every file under app/ except the three full JSON datasets (the app
ships them as byte parts instead), then creates a production deployment
referencing the uploaded files by sha1/size. Same route that worked for
the v1 + premium-redesign deployments.
"""
import base64, hashlib, json, os, subprocess, sys

APP = os.path.expanduser('~/workspace/quran-pronunciation-app/app')
EXCLUDE = {'data/quran.json', 'data/words.json', 'data/hadith.json', 'data/tajweed.json'}
CLI = '/opt/hatch/bin/vercel'

def call(tool, args):
    p = subprocess.run([CLI, 'call-tool', '--name', tool, '--arguments-json', json.dumps(args)],
                       capture_output=True, text=True, timeout=180)
    out = (p.stdout or '') + (p.stderr or '')
    return p.returncode, out.strip()

def main():
    files = []
    for root, _dirs, names in os.walk(APP):
        for n in sorted(names):
            rel = os.path.relpath(os.path.join(root, n), APP)
            if rel not in EXCLUDE:
                files.append(rel)
    files.sort()
    print(f'{len(files)} files to deploy', flush=True)
    refs = []
    for i, rel in enumerate(files, 1):
        path = os.path.join(APP, rel)
        data = open(path, 'rb').read()
        sha = hashlib.sha1(data).hexdigest()
        print(f'[{i}/{len(files)}] {rel} ({len(data)} B)', flush=True)
        rc, out = call('upload_file', {'requestBody': base64.b64encode(data).decode(),
                                       'contentLength': len(data), 'xVercelDigest': sha})
        if rc != 0 or ('"error"' in out and 'already' not in out.lower()):
            print(f'UPLOAD FAILED {rel}: rc={rc} {out[:300]}', flush=True)
            sys.exit(1)
        refs.append({'file': rel, 'sha': sha, 'size': len(data)})
        if i % 10 == 0 or i == len(files):
            print(f'uploaded {i}/{len(files)}', flush=True)
    rc, out = call('create_deployment', {'requestBody': {
        'name': 'tilawah', 'target': 'production', 'files': refs,
        'projectSettings': {'framework': None}}})
    print('create_deployment rc=', rc, flush=True)
    print(out[:2000], flush=True)
    with open(os.path.expanduser('~/workspace/quran-pronunciation-app/last-deployment.json'), 'w') as f:
        f.write(out)

if __name__ == '__main__':
    main()
