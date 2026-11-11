#!/usr/bin/env python3
"""Build Tilawah's bundled Daily Hadith pool from the verified fawazahmed0
hadith-api editions already downloaded into ../hadith-raw/.

No hadith text is generated or paraphrased. English and Arabic are copied
byte-for-byte (after whitespace normalisation for display) from the source
editions, and every entry keeps its collection + hadith number + section.
Selection is deterministic: broad universal themes are scored higher, texts
are length-bounded so a daily card stays readable, duplicates are removed,
and picks are spread evenly through each collection.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "hadith-raw"
OUT = ROOT / "app" / "data" / "hadith.json"

BOOKS = [
    ("bukhari", "Sahih al-Bukhari"),
    ("muslim", "Sahih Muslim"),
    ("tirmidhi", "Jami` at-Tirmidhi"),
    ("abudawud", "Sunan Abu Dawud"),
    ("ibnmajah", "Sunan Ibn Majah"),
]
PER_BOOK = 73  # 5 * 73 = 365, one for every day of the year

POSITIVE = [
    "intention", "allah", "prayer", "charity", "kind", "mercy", "merciful",
    "parents", "mother", "father", "neighbour", "neighbor", "knowledge",
    "learn", "truth", "honest", "patience", "patient", "heart", "believer",
    "muslim", "brother", "sister", "greet", "smile", "forgiv", "repent",
    "paradise", "good deed", "fast", "quran", "qur'an", "remembrance",
    "dhikr", "grateful", "gratitude", "trust in allah", "love", "gentle",
    "cleanliness", "purification", "modest", "speak good", "silence",
]
NEGATIVE = [
    "menstru", "sexual", "intercourse", "slave", "kill", "killed", "fight",
    "sword", "punish", "lashes", "stoning", "apostate", "jihad", "battle",
    "blood", "urine", "excrement", "wine", "intoxicat", "divorce",
    "menstrual", "postpartum", "funeral", "dead body", "corpse",
]


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def score(text: str) -> int:
    low = text.lower()
    s = sum(3 for w in POSITIVE if w in low)
    s -= sum(8 for w in NEGATIVE if w in low)
    # Prefer a direct saying over a long narrative chain in English.
    if "said:" in low or "saying" in low or "said," in low:
        s += 2
    return s


def main() -> None:
    pool = []
    seen = set()
    report = {}
    for slug, display in BOOKS:
        eng = json.loads((RAW / f"eng-{slug}.json").read_text(encoding="utf-8"))
        ara = json.loads((RAW / f"ara-{slug}.json").read_text(encoding="utf-8"))
        ara_by_num = {h["hadithnumber"]: h for h in ara["hadiths"]}
        sections = eng.get("metadata", {}).get("sections", {})

        candidates = []
        for h in eng["hadiths"]:
            num = h["hadithnumber"]
            en = clean(h.get("text"))
            ar = clean(ara_by_num.get(num, {}).get("text"))
            if not (120 <= len(en) <= 520 and 250 <= len(ar) <= 1800):
                continue
            key = re.sub(r"[^a-z0-9]+", " ", en.lower())[:140].strip()
            if key in seen:
                continue
            ref = h.get("reference") or {}
            section = sections.get(str(ref.get("book", "")), "")
            candidates.append({
                "book": display,
                "slug": slug,
                "number": num,
                "section": section,
                "en": en,
                "ar": ar,
                "grades": [
                    {"name": g.get("name", ""), "grade": g.get("grade", "")}
                    for g in (h.get("grades") or [])[:2]
                ],
                "_score": score(en),
                "_key": key,
            })

        # Best-scoring first, then take an even stride so the pool is not
        # clustered in the opening chapters of each collection.
        candidates.sort(key=lambda c: (-c["_score"], c["number"]))
        shortlist = candidates[: PER_BOOK * 3]
        shortlist.sort(key=lambda c: c["number"])
        stride = max(1, len(shortlist) // PER_BOOK)
        picked = []
        idx = 0
        used_sections = {}
        while len(picked) < PER_BOOK and shortlist:
            c = shortlist[idx % len(shortlist)]
            # Soft spread: avoid taking more than 10 from one section while
            # alternatives remain.
            if used_sections.get(c["section"], 0) >= 10 and len(shortlist) > PER_BOOK - len(picked):
                shortlist.pop(idx % len(shortlist))
                continue
            picked.append(c)
            used_sections[c["section"]] = used_sections.get(c["section"], 0) + 1
            shortlist.pop(idx % len(shortlist))
            idx += stride
        for c in picked:
            seen.add(c.pop("_key"))
            c.pop("_score")
            pool.append(c)
        report[slug] = {"candidates": len(candidates), "picked": len(picked)}

    # Interleave collections so consecutive days rotate sources.
    pool.sort(key=lambda x: x["number"])
    by_book = {slug: [p for p in pool if p["slug"] == slug] for slug, _ in BOOKS}
    daily = []
    for i in range(PER_BOOK):
        for slug, _ in BOOKS:
            if i < len(by_book[slug]):
                daily.append(by_book[slug][i])
    out = {
        "meta": {
            "count": len(daily),
            "source": "fawazahmed0/hadith-api editions (eng-* and ara-*), via jsDelivr",
            "note": "Texts copied from the source editions; references are collection + hadith number. Arabic editions include the chain of narration.",
        },
        "hadiths": daily,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"bytes": OUT.stat().st_size, "count": len(daily), "report": report}, indent=2))
    for h in daily[:2]:
        print("-", h["book"], h["number"], h["en"][:110])


if __name__ == "__main__":
    main()
