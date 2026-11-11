#!/usr/bin/env python3
"""Split a data file into 90,000-byte parts + manifest, the same scheme the
app already uses for quran.json (hosts/upload limits never see a huge file;
bytes are joined before UTF-8 decoding, so split multi-byte chars are safe).

Usage: split_parts.py <source-file> <out-dir> <name-prefix>
Writes <name-prefix>-NNN.bin files into <out-dir> and prints the manifest.
"""
import hashlib
import json
import sys
from pathlib import Path

PART = 90_000


def main() -> None:
    src, out_dir, prefix = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
    data = src.read_bytes()
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob(f"{prefix}-*.bin"):
        old.unlink()
    n = (len(data) + PART - 1) // PART
    for i in range(n):
        (out_dir / f"{prefix}-{i:03}.bin").write_bytes(data[i * PART:(i + 1) * PART])
    manifest = {
        "parts": n,
        "bytes": len(data),
        "partBytes": PART,
        "sha256": hashlib.sha256(data).hexdigest(),
    }
    (out_dir.parent / f"{prefix}.parts.json").write_text(json.dumps(manifest, indent=1))
    print(json.dumps({**manifest, "prefix": prefix}))


if __name__ == "__main__":
    main()
