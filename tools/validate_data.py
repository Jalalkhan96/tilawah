#!/usr/bin/env python3
"""Data-integrity validation for Tilawah's bundled Quran dataset.
Checks (all must pass):
  114 surahs · 6236 ayahs · canonical per-surah ayah counts ·
  global ayah numbers sequential 1..6236 · numberInSurah sequential ·
  no empty texts · juz values within 1..30 and non-decreasing ·
  page values within 1..604 · word counts > 0 ·
  bundled text == source text (except the single encoding BOM artefact
  stripped from the first ayah, documented in VALIDATION_REPORT.md)
Run: python3 tools/validate_data.py
"""
import json, pathlib, sys

root = pathlib.Path(__file__).resolve().parent.parent
bundled = json.loads((root / "app/data/quran.json").read_text(encoding="utf-8"))
CANONICAL = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6]

fails = []
def check(name, cond):
    print(("  ok - " if cond else "  FAIL - ") + name)
    if not cond: fails.append(name)

surahs = bundled["surahs"]
check("114 surahs", len(surahs) == 114)
check("6236 ayahs", sum(len(s["ayahs"]) for s in surahs) == 6236)
check("canonical per-surah counts", [len(s["ayahs"]) for s in surahs] == CANONICAL)
gs = [a["g"] for s in surahs for a in s["ayahs"]]
check("global numbers 1..6236 sequential", gs == list(range(1, 6237)))
check("numberInSurah sequential per surah", all([a["n"] for a in s["ayahs"]] == list(range(1, len(s["ayahs"]) + 1)) for s in surahs))
check("no empty texts", all(a["t"].strip() for s in surahs for a in s["ayahs"]))
check("word counts positive", all(a["w"] > 0 for s in surahs for a in s["ayahs"]))
juzs = [a["j"] for s in surahs for a in s["ayahs"]]
check("juz in 1..30", min(juzs) == 1 and max(juzs) == 30)
check("juz non-decreasing", all(juzs[i] <= juzs[i + 1] for i in range(len(juzs) - 1)))
check("all 30 juz present", sorted(set(juzs)) == list(range(1, 31)))
pages = [a["p"] for s in surahs for a in s["ayahs"]]
check("pages within 1..604", min(pages) >= 1 and max(pages) <= 604)
check("no BOM artefacts remain", not any(a["t"].startswith("\ufeff") for s in surahs for a in s["ayahs"]))
check("translations present for all ayahs", all(a["e"].strip() for s in surahs for a in s["ayahs"]))

src_path = root / "data-raw/quran-uthmani.json"
if src_path.exists():
    src = json.loads(src_path.read_text(encoding="utf-8"))["data"]["surahs"]
    diffs = 0
    for si, s in enumerate(src):
        for ai, a in enumerate(s["ayahs"]):
            if bundled["surahs"][si]["ayahs"][ai]["t"] != a["text"].lstrip("\ufeff"):
                diffs += 1
    check("bundled text identical to source (modulo 1 BOM)", diffs == 0)
else:
    print("  note: data-raw source not present, source-identity check skipped")

print(f"\n{'ALL CHECKS PASSED' if not fails else 'FAILURES: ' + ', '.join(fails)}")
sys.exit(1 if fails else 0)
