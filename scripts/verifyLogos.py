#!/usr/bin/env python3
"""
Verification script for web/js/companies.json logo links.

Fetches each company's "logo" URL and checks that it resolves to a working
image file. Prints [PASS]/[FAIL] per company and a summary; exits non-zero
if any FAILs are found.
"""

import argparse
import json
import os
import sys

import requests

DEFAULT_COMPANIES = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "js", "companies.json")
)

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; RenewviaRECBot/1.0)"}
TIMEOUT = 20

# Magic-byte signatures for common raster formats. Some servers report an
# incorrect Content-Type (e.g. text/html or binary/octet-stream) even though
# the body is a real image, so we sniff the bytes instead of trusting headers.
_SIGNATURES = [
    (b"\x89PNG\r\n\x1a\n", "PNG"),
    (b"\xff\xd8\xff", "JPEG"),
    (b"GIF87a", "GIF"),
    (b"GIF89a", "GIF"),
    (b"RIFF", "WEBP"),  # followed by "WEBP" at offset 8, checked separately
    (b"BM", "BMP"),
    (b"\x00\x00\x01\x00", "ICO"),
]


def _sniff_image_type(body):
    """Return a short format label if body looks like a known image, else None."""
    if body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return "WEBP"
    for sig, label in _SIGNATURES:
        if label == "WEBP":
            continue
        if body.startswith(sig):
            return label
    stripped = body.lstrip()[:256].lower()
    if b"<svg" in stripped or (stripped.startswith(b"<?xml") and b"<svg" in body[:2048].lower()):
        return "SVG"
    return None


def check_logo(name, url):
    if not url or not url.startswith(("http://", "https://")):
        return "FAIL", f"Not a valid http(s) URL: {url!r}"

    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT, allow_redirects=True)
    except requests.RequestException as e:
        return "FAIL", f"Request error: {e}"

    if resp.status_code != 200:
        return "FAIL", f"HTTP {resp.status_code}"

    fmt = _sniff_image_type(resp.content)
    if fmt is None:
        ct = resp.headers.get("Content-Type", "")
        return "FAIL", f"Response body is not a recognized image format (Content-Type: {ct!r})"

    size = len(resp.content)
    return "PASS", f"{fmt}, {size} bytes"


def main():
    parser = argparse.ArgumentParser(description="Verify company logo links in companies.json.")
    parser.add_argument(
        "--companies",
        default=DEFAULT_COMPANIES,
        help="Path to companies.json (default: web/js/companies.json relative to this script)",
    )
    args = parser.parse_args()

    try:
        with open(args.companies, encoding="utf-8") as f:
            companies = json.load(f)
    except Exception as e:
        print(f"[FAIL] Could not load companies.json from {args.companies!r}: {e}")
        sys.exit(1)

    counters = {"PASS": 0, "FAIL": 0}
    results = []
    for company in companies:
        name = company.get("name", "<unnamed>")
        url = company.get("logo", "")
        level, msg = check_logo(name, url)
        counters[level] += 1
        results.append((level, name, msg, url))
        print(f"[{level}] {name}: {msg}")
        print(f"       {url}")

    print(f"\n{'='*70}")
    print("SUMMARY")
    print(f"{'='*70}")
    print(f"  PASS: {counters['PASS']}   FAIL: {counters['FAIL']}   TOTAL: {len(companies)}")

    if counters["FAIL"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
