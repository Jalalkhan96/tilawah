# Validation report — 2026-10-23

## Quranic text (the part that must never be wrong)

Source: AlQuran Cloud API, edition `quran-uthmani` (Tanzil Uthmani text),
downloaded 2026-10-23. Raw file kept in `data-raw/quran-uthmani.json`
(SHA-256 begins `0df03e1d6da4fc81`). Translation: edition `en.sahih`
(Saheeh International). Bundled app data: `app/data/quran.json`
(SHA-256 `6910fda435c14f87091deb6cd21b3235c0895397770c24ff887b205d158bc7a4`).

`python3 tools/validate_data.py` — **14/14 checks passed**:

- 114 surahs; 6,236 ayahs in total.
- Per-surah ayah counts match the canonical counts exactly (all 114).
- Global ayah numbers sequential 1–6236; per-surah numbering sequential.
- No empty texts; every ayah has words and a translation.
- Juz metadata: values 1–30, non-decreasing across the Mushaf, all 30 present.
- Mushaf page metadata within 1–604.
- Bundled text is **identical to the source** for every ayah, with exactly
  one documented exception: a UTF-8 BOM encoding artefact at the very start
  of the first ayah of Al-Fatiha was stripped (it is an encoding marker, not
  Quranic text).
- Source characteristic, preserved deliberately: in this edition the Basmala
  is included inside ayah 1's text for 110 surahs (all except Surah 1, where
  it *is* ayah 1, and Surah 9, where it is absent). The app displays the text
  exactly as distributed and does not invent a separate Basmala line.

No Quranic text was generated, reconstructed or "completed" by any model.

## Audio endpoints (live-probed 2026-10-23)

`https://cdn.islamic.network/quran/audio/128/<reciter>/<globalAyah>.mp3`

- ar.alafasy ayahs 1 and 6236 → HTTP 200.
- ar.husary, ar.minshawi, ar.mahermuaiqly, ar.hudhaify (ayah 1) → HTTP 200.

## Comparison engine

`node tests/engine.test.mjs` — **11/11 checks passed** on synthetic signals:

- Identical recording → good/review status, score ≥ 70, duration ratio ≈ 1.
- Pure silence → inconclusive, no score (no fabricated verdict).
- Too-short recording → inconclusive.
- Recording with the middle word replaced by silence → not "good", and a
  word segment is flagged warn/error.
- 2× slower recitation → duration ratio > 1.5, still aligns.
- DTW identity check → distance ≈ 0.

These are signal-level unit tests, not a clinical accuracy study. No
false-positive/false-negative rates on real human recitation are claimed —
see LIMITATIONS.md.

## App smoke test (headless Chromium, local server)

- Page loads, `data/quran.json` loads, boot sequence completes.
- Home renders **114** surah items, **30** Juz chips, stats and engine version.
- Reader renders Al-Fatiha's 7 ayahs as selectable spans.
- Practice selectors contain all 114 surahs.
- HTTP checks: index / quran.json / engine.js / sw.js all return 200.

## Not tested / not claimed

- Real-device microphone behaviour (browser MediaRecorder) — needs a phone.
- iOS Safari PWA install quirks — needs a device.
- Human-recitation accuracy study — not performed; the engine's documented
  subset and inconclusive handling are the honest scope.

## Flutter edition (added 2026-10-23)

Project: `frontend/` — Flutter 3.47.5 / Dart 3.13.4, Riverpod 2.6,
sqflite, just_audio, record. The Dart alignment engine
(`lib/alignment_engine/engine.dart`) is a faithful port of the web engine
with the same thresholds and the same honest scope (timing / near-silent
segments / duration ratio only; `inconclusive` instead of a fabricated
score; no tajweed/makhraj claims).

- `flutter analyze` — **No issues found.**
- `flutter test` — **7/7 passed** (6 engine cases on synthetic signals
  mirroring the web tests, 1 dataset-integrity case re-checking the bundled
  `assets/quran/quran.json`: 114 surahs, 6,236 ayahs, canonical counts,
  sequential global numbering).
- Bundled Quran asset is byte-identical to the validated web edition.
- **APK not produced inside the build sandbox** — see the note in
  `docs/FLUTTER_BUILD.md`. The failure is environmental (the sandbox denies
  the loopback TCP connection Gradle's daemon requires), not a code or
  toolchain error: pub resolution, analysis and tests all run, and the
  Gradle distribution itself starts. The release APK builds with the
  commands in `docs/FLUTTER_BUILD.md` on a normal machine, or in this
  sandbox after the user enables the "other TCP" direct-network permission.
- Not tested: the Android native MP3-decode channel
  (`MainActivity.kt`) compiles as part of the APK build but has not run on
  a real device — a phone test remains the verification step. iOS has no
  decode channel in this build (documented in `docs/FLUTTER_BUILD.md`).
