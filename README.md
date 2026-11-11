# Tilawah — Quran Pronunciation & Recitation Correction (Web Edition)

A privacy-first, offline-first **web app** built from the master prompt in
`quran_pronunciation_app_master_prompt.txt`. The prompt's target was Flutter;
this delivery implements the same product as a **Progressive Web App** (the
user asked for "app web"), so it runs on Android, iOS and desktop browsers and
can be installed to the home screen. The architecture mirrors the prompt:
verified Quranic text layer, audio layer, recording layer, a genuine local
acoustic-alignment engine, and a presentation layer — with **no runtime
backend, no login, no ads, no analytics**.

## Flutter Android/iOS edition (frontend/)

The same product is also implemented as a native Flutter app in
`frontend/` (Riverpod + SQLite + just_audio + record), matching the master
prompt's original Flutter spec. The acoustic engine is ported 1:1 to Dart
(`frontend/lib/alignment_engine/engine.dart`); reference MP3s are decoded
through a small Android MediaCodec platform channel. Build steps:
`docs/FLUTTER_BUILD.md`. Delivered verification: `flutter analyze` clean,
`flutter test` 7/7 (engine + bundled-data integrity).

## Run it (web edition)

```bash
cd app
python3 -m http.server 8080
# open http://localhost:8080
```

Any static host works (Netlify, Vercel, GitHub Pages, a local network server…).
HTTPS is required in production for microphone access and service workers.

## What works

- **Reader** — complete Quran, Uthmani script, RTL, flowing Mushaf-style text,
  tap-any-ayah selection, go-to-ayah, prev/next surah, bookmarks, English
  translation (Saheeh International) for the selected ayah, Arabic text size
  control, light / sepia / dark themes.
- **Navigation** — all 114 surahs, search (surah name, Arabic text, English
  text), and Juz 1–30 navigation computed from the verified per-ayah metadata
  (the reader also shows Juz / Mushaf page / Ruku / Hizb-quarter of the
  selected ayah).
- **Reference audio** — per-ayah MP3 (5 reciters) streamed from the Islamic
  Network CDN, with play / pause / stop, auto-advance, repeat ×1–×5 and
  0.75–1.5× speed. Played ayahs are cached automatically; a whole surah can be
  pre-downloaded for offline use from the Reader.
- **Recording** — in-browser microphone recording (permission requested only
  on Record), live waveform, timer, playback, delete.
- **Comparison engine** — 100% local: voice-activity detection, recording
  quality checks (silence, clipping, level, too-short), frame features
  (log-energy, spectral centroid, zero-crossing rate), banded **DTW alignment**
  against the reference, duration-ratio and per-word timing estimates, and
  colour feedback (green / yellow / red / gray) with tap-a-word explanations
  and confidence values. Uncertain or mismatched recordings return
  **inconclusive**, never a fabricated verdict.
- **History & settings** — practice sessions saved on-device (recordings too,
  if you enable it), progress summary on Home, full delete/reset controls.

## Layout

```
app/            the PWA (index.html, css/, js/app.js, js/engine.js, sw.js,
                manifest.webmanifest, icons/, data/quran.json)
data-raw/       the source datasets exactly as downloaded (for audit)
tools/          validate_data.py — data-integrity checks
tests/          engine.test.mjs — synthetic-signal engine tests (node)
docs/           VALIDATION_REPORT.md · LIMITATIONS.md · PRIVACY.md
```

## Verify

```bash
python3 tools/validate_data.py   # 14 data checks
node tests/engine.test.mjs       # 11 engine checks
```

## Data & licensing notes

- Quranic text: **quran-uthmani** edition from the AlQuran Cloud API (Tanzil
  Uthmani text). Preserved byte-for-byte except one encoding BOM artefact
  stripped from the very first ayah (documented in docs/VALIDATION_REPORT.md).
  In this source, the Basmala is part of ayah 1's text for most surahs
  (Surah 1: it is ayah 1; Surah 9: absent) — shown exactly as distributed.
- Translation: Saheeh International (en.sahih edition, same API).
- Audio: Islamic Network CDN per-ayah MP3s (ar.alafasy and others). Audio is
  streamed/cached at runtime, not redistributed in this package — check the
  CDN/edition terms before commercial redistribution.
- This package is a learning tool. It is **not** a substitute for a qualified
  Quran teacher, and its scores are **not** religious judgements.

## GitHub snapshot notes

This repository was uploaded as a text snapshot, so two kinds of generated /
binary files are **not** in the GitHub copy (they exist in the local package
and on the live deployment):

- **Data parts** (`app/data/parts*/ *-NNN.bin`, 130 files): byte-split chunks
  of the full JSON datasets in `app/data/`. Regenerate them from the full
  JSONs with:

  ```bash
  python3 tools/split_parts.py app/data/quran.json  app/data/parts         quran
  python3 tools/split_parts.py app/data/hadith.json app/data/parts-hadith  hadith
  python3 tools/split_parts.py app/data/tajweed.json app/data/parts-tajweed tajweed
  python3 tools/split_parts.py app/data/words.json  app/data/parts-words   words
  ```

  Each regenerated set is verified by the `sha256` in its
  `app/data/<name>.parts.json` manifest.
- **PWA icon PNGs** (`app/icons/icon-192.png`, `app/icons/icon-512.png`):
  binary files; the vector source `app/icons/icon.svg` is included. Add the
  PNGs with any normal git client or the GitHub web upload.

Raw source datasets (`data-raw/`, `hadith-raw/`, `words-raw/`) are audit
inputs kept locally and are not part of this repository; the built datasets
they produced are in `app/data/`.
