#!/usr/bin/env python3
"""
PUBLIC_BOUNDARY Guard: Ensures the public boundary policy exists and contains required sections.
Used by CI gates to enforce governance compliance.
"""
import pathlib
import sys

def main():
    p = pathlib.Path("docs/governance/PUBLIC_BOUNDARY.md")
    if not p.exists():
        print("FAIL: PUBLIC_BOUNDARY.md missing")
        sys.exit(1)

    t = p.read_text(encoding="utf-8", errors="ignore")

    # Required sections (match actual content)
    must = [
        "What this repository includes",
        "What is intentionally excluded",
        "Enforcement",
    ]

    missing = [m for m in must if m not in t]
    if missing:
        print("FAIL: PUBLIC_BOUNDARY missing sections:", missing)
        sys.exit(1)

    print("PASS: PUBLIC_BOUNDARY sections OK")

if __name__ == "__main__":
    main()
