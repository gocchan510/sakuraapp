#!/usr/bin/env python3
"""
sync-hananokai.py
Scrapes https://www.hananokai.or.jp/sakura-zukan/list/ for all sakura varieties,
compares against src/data/varieties.json, and adds any new entries.
"""

import json
import re
import time
import unicodedata
import sys
import os
from pathlib import Path

import requests
from bs4 import BeautifulSoup

# ── Config ──────────────────────────────────────────────────────────────────
LIST_URL = "https://www.hananokai.or.jp/sakura-zukan/list/"
DETAIL_BASE = "https://www.hananokai.or.jp/sakura-zukan/"
SPOT_ENTRY = {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}

SCRIPT_DIR = Path(__file__).parent
REPO_ROOT = SCRIPT_DIR.parent
VARIETIES_PATH = REPO_ROOT / "src" / "data" / "varieties.json"

SLEEP_SECONDS = 1.0
TIMEOUT = 15

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}

# ── Color code mapping ───────────────────────────────────────────────────────
COLOR_MAP = {
    "白": "#FFFFFF",
    "白色": "#FFFFFF",
    "淡紅": "#FFB7C5",
    "淡桃": "#FFB7C5",
    "淡桃色": "#FFB7C5",
    "淡紅色": "#FFB7C5",
    "紅": "#FF69B4",
    "紅色": "#FF69B4",
    "濃紅": "#FF69B4",
    "濃紅色": "#FF69B4",
    "紫紅": "#C96CA0",
    "紫": "#C9A0DC",
    "淡紫": "#C9A0DC",
    "淡紫色": "#C9A0DC",
    "黄緑": "#ADDFAD",
    "淡黄緑": "#ADDFAD",
    "淡黄緑色": "#ADDFAD",
    "黄白": "#FFFDD0",
    "絞り": "#FFB7C5",
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def normalize_name(name: str) -> str:
    """Normalize a variety name for comparison."""
    s = unicodedata.normalize("NFKC", name)
    # Remove bracket groups: （…） and (…)
    s = re.sub(r"[（(][^）)]*[）)]", "", s)
    # Remove all spaces (full-width and half-width)
    s = s.replace("\u3000", "").replace(" ", "")
    return s.lower()


def fetch(url: str) -> bytes:
    resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.content


def decode_content(content: bytes) -> str:
    """Try UTF-8 first, then Shift-JIS."""
    for enc in ("utf-8", "shift_jis", "cp932"):
        try:
            return content.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return content.decode("utf-8", errors="replace")


def parse_list_page(html: str):
    """Return list of (name, slug, reading, clean_url) from the list page."""
    soup = BeautifulSoup(html, "lxml")
    entries = []

    # Links have href like /sakura-zukan/{slug}/?n[]=...
    # Text is like: 品種名{name}フリガナ{reading}
    PATTERN = re.compile(r"/sakura-zukan/([^/?#]+)/?\??")

    seen_slugs = set()
    for a in soup.find_all("a", href=PATTERN):
        href = a["href"]
        # Extract slug
        m = PATTERN.search(href)
        if not m:
            continue
        slug = m.group(1)

        # Skip non-variety pages
        if slug in ("list", "flowershape", "sakura-zukan", ""):
            continue
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)

        text = a.get_text(strip=True)
        # Parse name and reading
        name_m = re.search(r"品種名(.+?)フリガナ", text)
        reading_m = re.search(r"フリガナ(.+)$", text)
        if name_m:
            name = name_m.group(1).strip()
            reading = reading_m.group(1).strip() if reading_m else ""
        else:
            # Fallback: use full text as name
            name = text.strip()
            reading = ""

        if not name:
            continue

        # Build clean URL (no query string)
        clean_url = f"https://www.hananokai.or.jp/sakura-zukan/{slug}/"
        entries.append((name, slug, reading, clean_url))

    return entries


def parse_bloom_period(text: str):
    """
    Convert Japanese bloom season text to bloomPeriod dict.
    e.g. "4月中旬" → {start: "04-mid", end: "04-mid", secondary: null}
    """
    PART_MAP = {"上旬": "early", "中旬": "mid", "下旬": "late"}
    MONTH_PART_RE = re.compile(r"(\d{1,2})月(上旬|中旬|下旬)?")

    def period_code(month: int, part) -> str:
        part_str = PART_MAP.get(part or "", "mid")
        return f"{month:02d}-{part_str}"

    if not text:
        return None

    # Split on ・ for "春・秋" type patterns
    parts = re.split(r"[・]", text)
    primary_text = parts[0].strip()

    # Check for range with 〜 or ~
    range_m = re.search(
        r"(\d{1,2})月(上旬|中旬|下旬)?[〜～](\d{1,2})?月?(上旬|中旬|下旬)?",
        primary_text,
    )
    if range_m:
        m1, p1, m2, p2 = range_m.groups()
        if not m2:
            m2 = m1
        start = period_code(int(m1), p1)
        end = period_code(int(m2), p2)
    else:
        months = MONTH_PART_RE.findall(primary_text)
        if not months:
            return None
        m1, p1 = months[0]
        m2, p2 = months[-1]
        start = period_code(int(m1), p1)
        end = period_code(int(m2), p2)

    # Secondary season from second part (e.g. "秋" or "10月")
    secondary = None
    if len(parts) > 1:
        sec_text = parts[1].strip()
        sec_months = MONTH_PART_RE.findall(sec_text)
        if sec_months:
            sm1, sp1 = sec_months[0]
            sm2, sp2 = sec_months[-1]
            secondary = {
                "start": period_code(int(sm1), sp1),
                "end": period_code(int(sm2), sp2),
            }
        elif "秋" in sec_text:
            secondary = {"start": "09-mid", "end": "11-mid"}

    return {"start": start, "end": end, "secondary": secondary}


def get_color_code(color_text: str) -> str:
    if not color_text:
        return "#FFB7C5"
    for key, code in COLOR_MAP.items():
        if key in color_text:
            return code
    return "#FFB7C5"


def clean_text(element) -> str:
    """Extract clean text from a BeautifulSoup element."""
    if element is None:
        return ""
    return re.sub(r"\s+", " ", element.get_text(separator=" ", strip=True)).strip()


def get_dl_fields(soup) -> dict:
    """Extract all dt:dd pairs from the page's dl elements."""
    fields = {}
    for dl in soup.find_all("dl"):
        dts = dl.find_all("dt")
        dds = dl.find_all("dd")
        for dt, dd in zip(dts, dds):
            key = dt.get_text(strip=True)
            val = dd.get_text(separator=" ", strip=True)
            val = re.sub(r"\s+", " ", val).strip()
            fields[key] = val
    return fields


def parse_detail_page(html: str, slug: str, name_from_list: str, reading_from_list: str) -> dict:
    """Parse a detail page and return a partial variety dict."""
    soup = BeautifulSoup(html, "lxml")

    # Extract dl fields
    fields = get_dl_fields(soup)

    result = {
        "id": slug,
        "name": name_from_list,
        "reading": "",
        "bloomSeason": "",
        "color": "",
        "colorCode": "#FFB7C5",
        "flowerShape": "",
        "tags": [],
        "summary": "",
        "features": "",
        "history": "",
        "background": "",
        "trivia": "",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "bloomPeriod": None,
        "spots": [SPOT_ENTRY],
    }

    # Name from DL or list
    result["name"] = fields.get("品種名", name_from_list)

    # Reading: フリガナ from DL or list
    reading = fields.get("フリガナ", reading_from_list)
    # Convert katakana reading to hiragana
    result["reading"] = katakana_to_hiragana(reading)

    # Bloom season
    bloom = fields.get("開花期", fields.get("開花時期", ""))
    result["bloomSeason"] = bloom
    if bloom:
        bp = parse_bloom_period(bloom)
        if bp:
            result["bloomPeriod"] = bp

    # Color
    color = fields.get("花色", "")
    result["color"] = color
    result["colorCode"] = get_color_code(color)

    # Flower shape
    shape = fields.get("花形", fields.get("咲き方", ""))
    result["flowerShape"] = shape

    # ── Main content paragraphs ──────────────────────────────────────────────
    main = (
        soup.find("article")
        or soup.find("div", class_=re.compile(r"entry|content|post|body|single", re.I))
        or soup.find("div", id=re.compile(r"content|main|post", re.I))
        or soup.find("main")
    )

    if main:
        for tag in main.find_all(["nav", "header", "footer", "aside", "script", "style"]):
            tag.decompose()

        paragraphs = [
            re.sub(r"\s+", " ", p.get_text(separator=" ", strip=True)).strip()
            for p in main.find_all("p")
            if len(p.get_text(strip=True)) > 10
        ]
    else:
        # Fallback: body paragraphs
        paragraphs = [
            re.sub(r"\s+", " ", p.get_text(separator=" ", strip=True)).strip()
            for p in soup.find_all("p")
            if len(p.get_text(strip=True)) > 10
        ]

    if paragraphs:
        result["summary"] = paragraphs[0][:120]
        result["features"] = " ".join(paragraphs[:3])
        if len(paragraphs) > 3:
            result["history"] = " ".join(paragraphs[3:6])
        if len(paragraphs) > 6:
            result["background"] = " ".join(paragraphs[6:9])
        if len(paragraphs) > 9:
            result["trivia"] = " ".join(paragraphs[9:12])

    # ── Build tags ───────────────────────────────────────────────────────────
    tags = []
    if "八重" in shape:
        tags.append("八重咲")
    elif "一重" in shape:
        tags.append("一重咲")
    size_field = fields.get("花の大きさ", "")
    if "大輪" in size_field:
        tags.append("大輪")
    elif "小輪" in size_field:
        tags.append("小輪")
    if "二季" in bloom or "秋" in bloom:
        tags.append("二季咲き")
    result["tags"] = tags

    return result


def katakana_to_hiragana(text: str) -> str:
    """Convert katakana characters to hiragana."""
    result = []
    for ch in text:
        cp = ord(ch)
        if 0x30A1 <= cp <= 0x30F6:  # Katakana range
            result.append(chr(cp - 0x60))
        else:
            result.append(ch)
    return "".join(result)


def slugify_no(n: int) -> str:
    return str(n).zfill(3)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("sync-hananokai.py  -  Hananokai Sakura Zukan Sync")
    print("=" * 60)

    # Load varieties.json
    print(f"\nLoading {VARIETIES_PATH} ...")
    with open(VARIETIES_PATH, "r", encoding="utf-8") as f:
        varieties: list[dict] = json.load(f)

    print(f"  Loaded {len(varieties)} existing entries.")
    max_no = max(int(v.get("no", "0")) for v in varieties)
    print(f"  Current max no: {max_no}")

    # Build normalized lookup: normalized_name -> True
    existing_norm = set()
    for v in varieties:
        existing_norm.add(normalize_name(v["name"]))
        for alias in v.get("aliases", []):
            existing_norm.add(normalize_name(alias))

    # Fetch list page
    print(f"\nFetching list page: {LIST_URL}")
    try:
        raw = fetch(LIST_URL)
    except Exception as e:
        print(f"  ERROR fetching list page: {e}")
        sys.exit(1)

    html = decode_content(raw)
    list_entries = parse_list_page(html)
    print(f"  Found {len(list_entries)} varieties on list page.")

    # Compare
    unmatched = []
    matched_count = 0
    for name, slug, reading, clean_url in list_entries:
        norm = normalize_name(name)
        if norm in existing_norm:
            matched_count += 1
        else:
            unmatched.append((name, slug, reading, clean_url))

    print(f"  Already in DB: {matched_count}")
    print(f"  Unmatched (new): {len(unmatched)}")

    if not unmatched:
        print("\nAll varieties already in DB. Nothing to add.")
        return

    # Process unmatched
    print(f"\nProcessing {len(unmatched)} unmatched varieties...")
    next_no = max_no + 1
    added = []
    failed = []

    for idx, (name, slug, reading, detail_url) in enumerate(unmatched, 1):
        print(f"  [{idx}/{len(unmatched)}] {name}  =>  {detail_url}")
        time.sleep(SLEEP_SECONDS)

        try:
            raw_detail = fetch(detail_url)
            detail_html = decode_content(raw_detail)
            entry = parse_detail_page(detail_html, slug, name, reading)
        except Exception as e:
            print(f"    ERROR: {e}")
            failed.append((name, slug, str(e)))
            continue

        # Assign no
        entry["no"] = slugify_no(next_no)
        next_no += 1

        # Build ordered entry matching DB schema
        ordered = {
            "id": entry["id"],
            "no": entry["no"],
            "name": entry["name"],
            "reading": entry.get("reading", ""),
            "bloomSeason": entry.get("bloomSeason", ""),
            "color": entry.get("color", ""),
            "colorCode": entry.get("colorCode", "#FFB7C5"),
            "flowerShape": entry.get("flowerShape", ""),
            "tags": entry.get("tags", []),
            "summary": entry.get("summary", ""),
            "features": entry.get("features", ""),
            "history": entry.get("history", ""),
            "background": entry.get("background", ""),
            "trivia": entry.get("trivia", ""),
            "wikiTitleJa": entry.get("wikiTitleJa", None),
            "wikiTitleEn": entry.get("wikiTitleEn", None),
            "emoji": "🌸",
        }
        if entry.get("bloomPeriod"):
            ordered["bloomPeriod"] = entry["bloomPeriod"]
        ordered["spots"] = entry["spots"]

        varieties.append(ordered)
        added.append((name, slug, entry["no"]))
        print(f"    -> Added: no={ordered['no']}, id={ordered['id']}, name={ordered['name']}")

    # Remove the erroneously added 'flowershape' entry if present from prior run
    varieties = [v for v in varieties if v.get("id") != "flowershape"]

    # Save updated varieties.json
    print(f"\nWriting updated varieties.json ({len(varieties)} total entries) ...")
    with open(VARIETIES_PATH, "w", encoding="utf-8") as f:
        json.dump(varieties, f, ensure_ascii=False, indent=2)
    print("  Done.")

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"  Varieties on hananokai list page : {len(list_entries)}")
    print(f"  Already in DB                    : {matched_count}")
    print(f"  Unmatched                        : {len(unmatched)}")
    print(f"  Successfully added               : {len(added)}")
    print(f"  Failed to parse                  : {len(failed)}")

    if added:
        print("\nAdded varieties:")
        for n, s, no in added:
            print(f"  [{no}] {n}  ({s})")

    if failed:
        print("\nFailed varieties:")
        for n, s, err in failed:
            print(f"  - {n} ({s}): {err}")


if __name__ == "__main__":
    main()
