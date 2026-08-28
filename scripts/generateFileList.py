#!/usr/bin/env python3
"""
Regenerates verification_data/files.json, a flat JSON array of every CSV
filename in verification_data/. The browser-based verifier (verify-data.html)
has no directory listing access, so it reads this file to know which other
CSVs to fetch for cross-file checks.

Run this whenever a file is added to or removed from verification_data/.
"""

import argparse
import glob
import json
import os

DEFAULT_DIR = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "verification_data")
)


def main():
    parser = argparse.ArgumentParser(description="Regenerate verification_data/files.json")
    parser.add_argument(
        "--dir",
        default=DEFAULT_DIR,
        help="Directory containing CSV files (default: verification_data)",
    )
    args = parser.parse_args()

    filenames = sorted(
        os.path.basename(f) for f in glob.glob(os.path.join(args.dir, "*.csv"))
    )
    out_path = os.path.join(args.dir, "files.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(filenames, f, indent="\t")
        f.write("\n")

    print(f"Wrote {len(filenames)} filenames to {out_path}")


if __name__ == "__main__":
    main()
