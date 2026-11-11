#!/usr/bin/env python3
"""Build Tilawah's bundled word-by-word dataset (app/data/words.json).

Sources (both verified live, Oct 2026):
- Our validated Tanzil Uthmani text (app/data/quran.json) — the ONLY text the
  app displays. It is never modified here.
- Quran.com API v4 verses/by_chapter with words + Alafasy audio segments
  (../words-raw/chapter-NNN.json) — used for word segmentation metadata:
  per-word transliteration/translation and Alafasy segment timings.

Verified facts this builder relies on:
- Word-by-word audio lives at audio.qurancdn.com/wbw/{SSS}_{AAA}_{WWW}.mp3
  where WWW is the API word POSITION (1-based, pause marks excluded). The
  API's own audio_url strings are NOT used: after a pause mark they drift
  (e.g. 2:255 word 50 claims ..._058.mp3, which 404s; the real file is _050).
- Ayah 1 of surahs 2-114 (except 9) carries the Basmala merged into our text;
  the API excludes it there. Those 4 words map to Surah 1 Ayah 1's files.
- Standalone pause-mark tokens in our text (e.g. 'ۚ') have no word audio;
  they are highlighted together with the preceding word.

Per ayah we emit, keyed by global ayah number:
  m: our-token start index for each playable word (monotonic)
  s: [startMs, endMs] Alafasy segment per playable word (same order)
  w: [transliteration, translation] per playable word
  b: 4 when a merged Basmala prefix is present (segments then exclude the
     Basmala, so the app must not use segment timing for that ayah)
Ayahs whose token/word alignment cannot be verified exactly are listed in
the report and omitted (app falls back to whole-ayah play for them).
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QURAN = ROOT / "app" / "data" / "quran.json"
RAW = ROOT / "words-raw"
OUT = ROOT / "app" / "data" / "words.json"

MARKS = "".join(chr(c) for c in range(0x06D6, 0x06EE))  # ۖ..ۭ pause marks
# Drop: harakat/tanwin (U+064B-0652), maddah (U+0653), hamza below (U+0655),
# superscript alef (U+0670), tatweel (U+0640) and the pause-mark block.
NORM_DROP = re.compile("[ً-ْٰٕٓـ" + MARKS + "۞۩]")
PAUSE_ONLY = re.compile("^[" + MARKS + r"۞۩\s]+$")


def norm(s: str) -> str:
    s = NORM_DROP.sub("", s)
    # Hamza is written inconsistently between the two Tanzil-family sources
    # (letter ء vs tatweel + U+0654 vs fused أ, and 80:25 even drops it), so
    # comparison is hamza-insensitive: ء and U+0654 are dropped and carriers
    # reduce to their base letter. Whitespace and bidi/format marks are also
    # dropped (the API occasionally splits a word with a space, 2:181).
    s = s.replace("ٔ", "").replace("ء", "")
    s = s.replace("أ", "ا").replace("إ", "ا").replace("ٱ", "ا").replace("آ", "ا")
    s = s.replace("ؤ", "و").replace("ئ", "ي")
    s = re.sub(r"[\s\u200b-\u200f\ufeff]+", "", s)
    return s


BASMALA_NORM = norm("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")


def align(our_tokens, api_words):
    """Char-flow alignment between our display tokens and API words.
    Returns list of our-token start indices per API word, or None."""
    starts = []
    ti = 0          # our token index
    tbuf = ""       # normalized chars of current our-token group
    for w in api_words:
        target = norm(w)
        if not target:
            return None
        start = ti
        buf = tbuf
        while buf != target:
            if len(buf) > len(target) or not target.startswith(buf):
                return None
            if ti >= len(our_tokens):
                return None
            buf += norm(our_tokens[ti])
            ti += 1
        starts.append(start)
        tbuf = ""
    if ti != len(our_tokens):
        return None
    return starts


def main():
    quran = json.loads(QURAN.read_text(encoding="utf-8"))
    out = {}
    report = {"ok": 0, "basmala": 0, "failed": [], "no_segments": 0}

    # Basmala word metadata comes from Surah 1 Ayah 1 of the API data.
    ch1 = json.loads((RAW / "chapter-001.json").read_text(encoding="utf-8"))
    b_verse = ch1["verses"][0]
    b_words = [w for w in b_verse["words"] if w.get("char_type_name") != "end"]
    b_meta = [[(w.get("transliteration") or {}).get("text") or "",
               ((w.get("translation") or {}).get("text") or "").strip()] for w in b_words]
    b_segs = [[s[2], s[3]] for s in (b_verse.get("audio") or {}).get("segments", [])]

    for s_idx, surah in enumerate(quran["surahs"]):
        s_num = s_idx + 1
        raw = json.loads((RAW / f"chapter-{s_num:03}.json").read_text(encoding="utf-8"))
        verses = {v["verse_number"]: v for v in raw["verses"]}
        for ayah in surah["ayahs"]:
            a_num = ayah["n"]
            g = ayah["g"]
            verse = verses[a_num]
            api_words = [w for w in verse["words"] if w.get("char_type_name") != "end"]
            api_texts = [w.get("text_uthmani", "") for w in api_words]
            segs = [[s[2], s[3]] for s in (verse.get("audio") or {}).get("segments", [])]
            tokens = ayah["t"].split()

            has_basmala = (
                a_num == 1 and s_num not in (1, 9) and len(tokens) > 4
                and norm(" ".join(tokens[:4])) == BASMALA_NORM
            )
            body_tokens = tokens[4:] if has_basmala else tokens
            # Drop standalone pause-mark tokens: no audio of their own.
            play_tokens = [t for t in body_tokens if not PAUSE_ONLY.match(t)]
            # Token start indices must reference the FULL token array, so
            # compute positions before dropping pauses.
            pos = []
            ti = 4 if has_basmala else 0
            for t in body_tokens:
                if not PAUSE_ONLY.match(t):
                    pos.append(ti)
                ti += 1

            starts = align(play_tokens, api_texts)
            if starts is None:
                report["failed"].append(f"{s_num}:{a_num}")
                continue
            starts = [pos[i] for i in starts]

            meta = [[(w.get("transliteration") or {}).get("text") or "",
                     ((w.get("translation") or {}).get("text") or "").strip()] for w in api_words]
            if len(segs) != len(api_words):
                report["no_segments"] += 1
                segs = []
            entry = {"m": starts, "w": meta}
            if has_basmala:
                entry["m"] = [0, 1, 2, 3] + starts
                entry["w"] = b_meta + meta
                entry["b"] = 4
                entry["s"] = segs  # segments cover body words only
                report["basmala"] += 1
            else:
                entry["s"] = segs
            out[str(g)] = entry
            report["ok"] += 1

    OUT.write_text(json.dumps({"meta": {
        "source": "Quran.com API v4 words + Alafasy segments; WBW audio at audio.qurancdn.com/wbw by word position",
        "ayahs": report["ok"],
    }, "ayahs": out}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"bytes": OUT.stat().st_size, **report,
                      "failed_sample": report["failed"][:20]}, indent=2))


if __name__ == "__main__":
    main()
