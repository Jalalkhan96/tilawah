# Documented limitations — read this before trusting any score

Engine: `tilawah-engine-web-1.0.0` (app/js/engine.js)

## What the engine genuinely measures

1. Recording quality: duration, peak level, clipping ratio, voiced/silence ratio.
2. Acoustic alignment: banded DTW over per-frame log-energy, spectral centroid,
   zero-crossing rate and voicing — both sequences z-normalised, so the
   comparison is about *sound shape and timing*, not voice identity.
3. Timing: overall duration ratio vs the reference, pause behaviour, and
   per-word duration estimates (word boundaries on the reference are estimated
   from word length — an approximation, labelled as such in the UI).

## Supported issue categories (the validated subset)

- Recording too short / too quiet / mostly silence / clipping → inconclusive
  or a quality warning, never a "wrong recitation" claim.
- Passage cannot be aligned (wrong passage, extreme length mismatch) →
  **inconclusive**.
- Near-silent user segment where the reference has clear speech →
  "possible omitted or very quiet word" (red).
- Word segment much longer or much shorter than the aligned reference
  segment → timing warning (yellow).
- Word segment whose local DTW cost is very high → "sound shape differs
  notably" warning (yellow).

## What it does NOT do — by design and by honesty

- **No tajweed judgement.** Makhraj, ghunnah, madd rules, qalqalah etc. are
  NOT assessed. Forced alignment alone cannot detect them, and no validated
  rule-aware phoneme model is bundled.
- **No phoneme-level or letter-level diagnosis.** It cannot say "your س
  sounded like ص".
- **No speech-to-text as an assessment shortcut** (general Arabic ASR drops
  diacritics and normalises recitation differences — exactly what the master
  prompt forbids relying on).
- Word timings are **estimates** from the DTW path and length-proportioned
  reference boundaries; treat a single yellow word as "listen back", not proof.
- Scores are a heuristic mapping of DTW distance (calibration documented in
  code), useful for tracking your own practice over time — not a grade from
  a teacher and not a religious ruling.
- Different microphones, rooms and recitation styles shift the numbers. The
  engine returns *inconclusive* rather than guessing when the evidence is weak.

## Platform limits of the web edition

- Full-Quran audio is not bundled (it would be gigabytes). Ayahs are cached
  after first play, and whole surahs can be pre-downloaded; after that they
  work fully offline.
- The app must be served over HTTP(S) or localhost for microphone, service
  worker and IndexedDB to work; opening index.html as a file will load the
  text but some features will be blocked by the browser.
- iOS Safari requires the page to be added to the Home Screen (or used in
  Safari) for full PWA behaviour, and microphone recording uses the browser's
  MediaRecorder implementation.
