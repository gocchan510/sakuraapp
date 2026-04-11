#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
link_variety_spots.py
Links varieties.json (779 varieties) with spots.json (1433 spots) across 5 phases.
Updates both JSON files and writes a CSV log.
"""

import json
import csv
import re
import sys
import os
from collections import defaultdict

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VARIETIES_PATH = os.path.join(BASE_DIR, "src", "data", "varieties.json")
SPOTS_PATH     = os.path.join(BASE_DIR, "src", "data", "spots.json")
CSV_PATH       = os.path.join(BASE_DIR, "scripts", "variety_spot_links.csv")

# ---------------------------------------------------------------------------
# Load data
# ---------------------------------------------------------------------------
print("Loading data files...")
with open(VARIETIES_PATH, encoding="utf-8") as f:
    varieties = json.load(f)
with open(SPOTS_PATH, encoding="utf-8") as f:
    spots = json.load(f)

print(f"  Loaded {len(varieties)} varieties, {len(spots)} spots")

# ---------------------------------------------------------------------------
# Build lookup dictionaries
# ---------------------------------------------------------------------------
variety_by_id    = {v["id"]: v for v in varieties}
spot_by_id       = {s["id"]: s for s in spots}

# name -> variety id  (longest match wins; we'll sort by length later)
name_to_variety  = {}   # key: normalized name, value: variety id
alias_to_variety = {}

def normalize_name(s):
    """Remove spaces, normalize for matching."""
    s = s.strip()
    s = re.sub(r"[\s\u3000]+", "", s)
    return s

for v in varieties:
    n = normalize_name(v["name"])
    if n:
        name_to_variety[n] = v["id"]
    for alias in (v.get("aliases") or []):
        a = normalize_name(alias)
        if a:
            alias_to_variety[a] = v["id"]

# All variety name candidates (name + aliases), sorted longest-first for greedy matching
all_variety_names = {}  # normalized -> variety_id
all_variety_names.update(alias_to_variety)
all_variety_names.update(name_to_variety)  # name overrides alias if conflict
sorted_variety_names = sorted(all_variety_names.keys(), key=len, reverse=True)

# spot name -> spot id
spot_name_to_id  = {s["name"]: s["id"] for s in spots}
# also build id -> name for easy access
spot_id_to_name  = {s["id"]: s["name"] for s in spots}

# ---------------------------------------------------------------------------
# Link storage: links[(variety_id, spot_id)] = {linkSource, evidence}
# ---------------------------------------------------------------------------
links = {}

def add_link(variety_id, spot_id, link_source, evidence):
    key = (variety_id, spot_id)
    if key not in links:
        links[key] = {"linkSource": link_source, "evidence": evidence}

# ---------------------------------------------------------------------------
# PHASE A: Extract spot keywords from variety text
# ---------------------------------------------------------------------------
print("\n=== PHASE A: Extract spot keywords from variety text ===")

# Build keyword dict: keyword -> [(spot_id, spot_name)]
# Include spot name (if 3+ chars) and address substrings (4+ chars)
keyword_to_spots = defaultdict(list)  # keyword -> list of (spot_id, spot_name)

def extract_address_keywords(address):
    """Extract meaningful location substrings from address (4+ chars)."""
    if not address:
        return []
    keywords = []
    # Match city/ward/town patterns
    patterns = [
        r"[\u4e00-\u9fff\u30a0-\u30ff\u3040-\u309f]{4,}(?:市|区|町|村|郡)",
        r"[\u4e00-\u9fff\u30a0-\u30ff\u3040-\u309f]{4,}(?:公園|神社|城|山|川|湖|池)",
    ]
    for pat in patterns:
        for m in re.finditer(pat, address):
            kw = m.group()
            if len(kw) >= 4:
                keywords.append(kw)
    return keywords

for spot in spots:
    sname = spot["name"]
    sid = spot["id"]
    # Add full spot name if 3+ chars
    if len(sname) >= 3:
        keyword_to_spots[sname].append((sid, sname))
    # Also add spot name without common suffixes like の桜、公園の桜 etc.
    cleaned = re.sub(r"の桜.*$", "", sname)
    cleaned = re.sub(r"（.*?）", "", cleaned).strip()
    if len(cleaned) >= 3 and cleaned != sname:
        keyword_to_spots[cleaned].append((sid, sname))
    # Address keywords
    addr = spot.get("address") or ""
    for kw in extract_address_keywords(addr):
        keyword_to_spots[kw].append((sid, sname))

# Special address-derived mappings
ADDR_KEYWORD_OVERRIDES = {
    "弘前市":  "弘前公園",
    "松前町":  "松前公園",
}

# Add specific city->spot overrides
for kw, spot_name_target in ADDR_KEYWORD_OVERRIDES.items():
    # Find spot ids with that name
    for spot in spots:
        if spot_name_target in spot["name"]:
            keyword_to_spots[kw].append((spot["id"], spot["name"]))

# Sort keywords longest-first for greedy matching
sorted_keywords = sorted(keyword_to_spots.keys(), key=len, reverse=True)

def get_variety_text(v):
    """Concatenate all text fields of a variety."""
    parts = []
    for field in ["features", "history", "background", "trivia"]:
        val = v.get(field) or ""
        if val:
            parts.append(val)
    return " ".join(parts)

phase_a_count = 0
for v in varieties:
    text = get_variety_text(v)
    if not text:
        continue
    matched_spots = set()
    for kw in sorted_keywords:
        if len(kw) < 3:
            continue
        if kw in text:
            for (sid, sname) in keyword_to_spots[kw]:
                if sid not in matched_spots:
                    matched_spots.add(sid)
                    add_link(v["id"], sid, "text_extraction",
                             f"Keyword '{kw}' found in {v['id']} text")
                    phase_a_count += 1

print(f"  Phase A links: {phase_a_count}")

# ---------------------------------------------------------------------------
# PHASE B: Extract variety names from spot varietyNote
# ---------------------------------------------------------------------------
print("\n=== PHASE B: Extract variety names from spot varietyNote ===")

phase_b_count = 0
for spot in spots:
    note = spot.get("varietyNote") or ""
    if not note:
        continue
    note_norm = normalize_name(note)
    # Try to find variety names in note (longest match first)
    pos = 0
    note_len = len(note_norm)
    found_in_note = set()
    i = 0
    while i < len(note_norm):
        matched = False
        for vname in sorted_variety_names:
            if note_norm[i:i+len(vname)] == vname:
                vid = all_variety_names[vname]
                if vid not in found_in_note:
                    found_in_note.add(vid)
                    add_link(vid, spot["id"], "variety_note",
                             f"Variety name '{vname}' found in spot '{spot['name']}' varietyNote")
                    phase_b_count += 1
                i += len(vname)
                matched = True
                break
        if not matched:
            i += 1

print(f"  Phase B links: {phase_b_count}")

# ---------------------------------------------------------------------------
# PHASE C: Web search results for major spots
# ---------------------------------------------------------------------------
print("\n=== PHASE C: Web search results for major spots ===")

# Web-search results collected above (variety names found per spot)
# Format: spot_search_term -> list of Japanese variety names
WEB_SEARCH_RESULTS = {
    "造幣局": [
        # From造幣局 mint.go.jp pages
        "東錦", "天城吉野", "天の川", "雨宿", "綾錦", "有明",
        "伊豆最福寺枝垂", "市原虎の尾", "一葉", "糸括", "妹背", "伊予薄墨", "伊予菊桜", "伊予熊谷",
        "鬱金", "雨情枝垂", "渦桜",
        "永源寺", "江戸",
        "大沢桜", "大島桜", "大提灯", "大手毬", "奥都", "御室有明", "思川",
        "春日井", "鎌足桜", "寒桜", "簪桜", "関山", "関東有明",
        "祇王寺祇女桜", "菊桜", "黄桜", "衣笠", "貴船雲珠桜", "御衣黄", "暁鐘", "桐ヶ谷", "麒麟",
        "紅華", "高台寺", "幸福", "九重", "御座の間匂", "御信桜", "胡蝶", "小手毬", "御殿匂", "琴平", "駒繋",
        "笹賀鴛鴦桜", "笹部桜", "佐野桜",
        "泰山府君", "太白", "手弱女", "高遠小彼岸桜", "瀧香", "類嵐",
        "花笠", "花染衣", "林一号", "林二号", "萬里香",
        "舞姫", "松前", "松前薄紅九重", "松前琴糸桜", "松前花都", "松前紅紫", "松前八重寿",
        "御車返", "都錦",
        "二尊院普賢象", "二度桜",
        "福桜", "福禄寿", "普賢象", "不断桜",
        "八重曙", "八重紅大島", "八重紅枝垂", "八重紅虎の尾", "八重紫桜", "山越紫",
        "楊貴妃", "養老桜",
        "蘭蘭",
        "カンザン", "フゲンゾウ", "ショウゲツ", "ヨウキヒ",
    ],
    "新宿御苑": [
        "アタミザクラ", "アマノガワ", "アマヤドリ", "アメリカ", "アラシヤマ", "イズヨシノ",
        "イチハラトラノオ", "イチヨウ", "イモセ", "ウコン", "ウスズミ", "エド", "エドヒガン",
        "オオカンザクラ", "オオシマザクラ", "オオタザクラ", "オオヤマザクラ", "オカメ",
        "カスミザクラ", "カワヅザクラ", "カンザン", "カンヒザクラ", "ギョイコウ",
        "ケンロクエンキクザクラ", "コシオヤマ", "ゴショザクラ", "ゴショミクルマガエシ", "コトヒラ",
        "コヒガン", "コブクザクラ", "コマツナギ", "ササベザクラ", "サツマカンザクラ",
        "シシンデンサコンノサクラ", "シダレサクラ", "シバヤマ", "ジュウガツザクラ", "ジュウニガツザクラ",
        "シュゼンジカンザクラ", "ショウゲツ", "シラユキ", "シロタエ", "スザク", "スルガダイニオイ",
        "ソメイヨシノ", "タイハク", "タイワンヒザクラ", "タカトオコヒガン", "タグイアラシ",
        "タマユメザクラ", "チョウジザクラ", "チョウシュウヒザクラ", "ツバキカンザクラ", "トウカイザクラ",
        "バイゴジジュズカケザクラ", "ヒマラヤザクラ", "ヒマラヤヒザクラ", "ヒヨシザクラ",
        "フクロクジュ", "フゲンゾウ", "ベニシダレ", "ベニヅルザクラ", "ベニユタカ", "ベンドノ",
        "ホウシュザクラ", "マスヤマ", "マメザクラ", "ミギワザクラ", "ムラサキザクラ",
        "ヤエベニシダレ", "ヤマザクラ", "ヨウコウ", "ヨコハマヒザクラ", "ワシノオ",
        # kanji versions
        "天の川", "雨宿", "大島桜", "大山桜", "一葉", "鬱金", "彼岸桜", "御衣黄", "関山", "河津桜",
        "寒桜", "寒緋桜", "山桜", "枝垂桜", "染井吉野", "大寒桜",
        "修善寺寒桜", "松月", "白妙", "陽光", "横浜緋桜",
    ],
    "上野": [
        "ソメイヨシノ", "河津桜", "寒緋桜", "寒桜", "上野人気桜", "御衣黄", "関山",
        "魁桜", "カンザクラ", "コウヅザクラ", "ヨウコウ",
        "上野白雪枝垂", "輪王寺御車返し",
        "大島桜", "エドヒガン",
    ],
    "弘前公園": [
        "ソメイヨシノ", "シダレザクラ", "エドヒガン", "コヒガン", "オオヤマザクラ", "ファーストレディ",
        "白糸枝垂", "オオシマザクラ", "大寒桜", "八重紅枝垂", "船原吉野", "紅豊",
        "御車返し", "寒緋桜", "思川", "昭和桜", "佐野桜", "咲耶姫", "仙台枝垂",
        "鵯桜", "白妙", "衣通姫", "太白", "水上", "八重紅大島", "陽光", "横浜緋桜",
        "鬱金", "普賢象", "関山", "松月", "須磨浦普賢象", "カスミザクラ", "東錦",
        "御衣黄", "天の川", "大提灯", "一葉", "兼六園菊桜", "琴平",
        "梅護寺数珠掛桜", "千里香", "手毬", "日暮", "弘前雪明かり", "福禄寿",
        "松前紅玉錦", "ヤマザクラ", "ベニシダレ", "子福桜", "十月桜", "オカメ",
    ],
    "平野神社": [
        "河津桜", "ソメイヨシノ", "山桜", "枝垂桜", "彼岸桜", "大島桜", "寒桜",
        "エドヒガン", "寝覚桜", "平野妹背", "魁桜", "突羽根", "衣笠", "胡蝶",
        "桃桜",
    ],
    "二条城": [
        "カンヒザクラ", "ケイオウザクラ", "シダレザクラ", "ソメイヨシノ", "ヤマザクラ",
        "ヤエベニシダレ", "サトザクラ",
        "寒緋桜", "枝垂桜", "染井吉野", "山桜", "八重紅枝垂",
    ],
    "京都府立植物園": [
        "河津桜", "八重桜", "ソメイヨシノ", "山桜", "枝垂桜", "彼岸桜", "冬桜",
        "寒緋桜", "大島桜", "寒桜", "エドヒガン", "御衣黄", "鬱金", "大原渚",
        "太白", "ヤエベニシダレ",
    ],
    "松前公園": [
        "ソメイヨシノ", "蝦夷霞桜", "糸括", "関山", "雨宿", "鬱金", "南殿桜",
        "糸括", "雨宿", "鬱金", "八重紅枝垂",
        "松前早咲", "松前", "糸括り",
    ],
    "多摩森林科学園": [
        "ソメイヨシノ", "山桜", "大島桜", "エドヒガン", "枝垂桜", "寒緋桜",
        "関山", "一葉", "普賢象", "御衣黄", "鬱金",
    ],
    "結城農場": [
        "エドヒガン", "大漁桜", "ジンダイアケボノ", "マイヒメ", "ハナカガミ",
        "一葉", "紅華", "関山",
        "ソメイヨシノ", "大島桜", "山桜", "枝垂桜",
    ],
    "広島": [
        # 造幣局広島支局 花のまわりみち
        "関山", "松月", "普賢象", "大手毬", "紅手毬",
        "カンザン", "ショウゲツ", "フゲンゾウ",
    ],
    "林業試験場": [
        "兼六園菊桜", "河津桜", "ソメイヨシノ", "八重紅枝垂", "深山桜",
        "鵯桜",
    ],
    "相模": [
        # さくら百華の道
        "河津桜", "ソメイヨシノ", "山桜", "枝垂桜", "彼岸桜", "冬桜", "寒緋桜",
        "大島桜", "寒桜", "エドヒガン", "オカメ", "啓翁桜", "苔清水", "小松乙女",
        "白雪", "神代曙", "駿河台匂", "仙台屋", "太白", "大漁桜", "陽光",
    ],
    "花見山": [
        "トウカイザクラ", "ヒガンザクラ", "ロトウザクラ", "ソメイヨシノ", "カンヒザクラ",
        "東海桜", "彼岸桜", "十月桜", "オカメ", "天の川", "鬱金桜",
    ],
    "高遠": [
        "タカトオコヒガン", "タカトオコヒガンザクラ", "高遠小彼岸桜",
        "コヒガン",
    ],
    "吉野": [
        "ヤマザクラ", "シロヤマザクラ", "山桜", "白山桜",
    ],
    "国花苑": [
        "ソメイヨシノ", "山桜", "枝垂桜", "八重桜", "大島桜", "冬桜",
    ],
    "千鳥ヶ淵": [
        "ソメイヨシノ", "大島桜", "エドヒガン", "修善寺寒桜", "ショカワザクラ",
    ],
    "国立劇場": [
        "駿河桜", "駿河小町", "小松乙女", "神代曙", "仙台屋",
    ],
}

# Build reverse lookup: Japanese variety name -> variety_id
# Using a comprehensive map with both kanji and kana forms
def find_variety_by_japanese_name(jname):
    """Try to find a variety id by Japanese name (kanji or kana)."""
    n = normalize_name(jname)
    # Direct lookup
    if n in name_to_variety:
        return name_to_variety[n]
    if n in alias_to_variety:
        return alias_to_variety[n]
    # Try removing 桜/ザクラ/さくら suffix variants
    for suffix in ["桜", "ザクラ", "さくら", "ざくら"]:
        if n.endswith(suffix):
            stripped = n[:-len(suffix)]
            if stripped in name_to_variety:
                return name_to_variety[stripped]
            if stripped in alias_to_variety:
                return alias_to_variety[stripped]
    # Try adding 桜 suffix
    for suffix in ["桜", "ザクラ"]:
        candidate = n + suffix
        if candidate in name_to_variety:
            return name_to_variety[candidate]
        if candidate in alias_to_variety:
            return alias_to_variety[candidate]
    return None

# Kana->Kanji and known name mappings for tricky cases
KANA_TO_KANJI = {
    "ソメイヨシノ": "染井吉野",
    "カンザン": "関山",
    "フゲンゾウ": "普賢象",
    "ショウゲツ": "松月",
    "ヨウキヒ": "楊貴妃",
    "ギョイコウ": "御衣黄",
    "イチヨウ": "一葉",
    "ウコン": "鬱金",
    "タイハク": "太白",
    "ヤマザクラ": "山桜",
    "エドヒガン": "江戸彼岸",
    "オオシマザクラ": "大島桜",
    "オオヤマザクラ": "大山桜",
    "カンヒザクラ": "寒緋桜",
    "シダレザクラ": "枝垂桜",
    "カスミザクラ": "霞桜",
    "マメザクラ": "豆桜",
    "カワヅザクラ": "河津桜",
    "ヨコハマヒザクラ": "横浜緋桜",
    "ヨウコウ": "陽光",
    "ベニシダレ": "紅枝垂",
    "ヤエベニシダレ": "八重紅枝垂",
    "コヒガン": "小彼岸",
    "アマノガワ": "天の川",
    "アマヤドリ": "雨宿",
    "タカトオコヒガン": "高遠小彼岸",
    "タカトオコヒガンザクラ": "高遠小彼岸桜",
    "タグイアラシ": "類嵐",
    "ケンロクエンキクザクラ": "兼六園菊桜",
    "バイゴジジュズカケザクラ": "梅護寺数珠掛桜",
    "シロタエ": "白妙",
    "スルガダイニオイ": "駿河台匂",
    "トウカイザクラ": "東海桜",
    "ヒヨシザクラ": "日吉桜",
    "コブクザクラ": "子福桜",
    "ジュウガツザクラ": "十月桜",
    "ジュウニガツザクラ": "十二月桜",
    "シュゼンジカンザクラ": "修善寺寒桜",
    "ツバキカンザクラ": "椿寒桜",
    "オオカンザクラ": "大寒桜",
    "イチハラトラノオ": "市原虎の尾",
    "ワシノオ": "鷲の尾",
    "タマユメザクラ": "玉夢桜",
    "ムラサキザクラ": "紫桜",
    "ミギワザクラ": "水際桜",
    "ベニユタカ": "紅豊",
    "サツマカンザクラ": "薩摩寒桜",
    "チョウジザクラ": "丁子桜",
    "ヒマラヤザクラ": "ヒマラヤザクラ",
    "ファーストレディ": "ファーストレディ",
    "イズヨシノ": "伊豆吉野",
    "ベニヅルザクラ": "紅鶴桜",
    "マスヤマ": "桝山",
    "ホウシュザクラ": "宝珠桜",
    "ベンドノ": "弁殿",
    "コシオヤマ": "小塩山",
    "スザク": "朱雀",
    "シバヤマ": "柴山",
    "コマツナギ": "駒繋",
    "ゴショザクラ": "御所桜",
    "ゴショミクルマガエシ": "御所御車返し",
    "コトヒラ": "琴平",
    "イモセ": "妹背",
    "エド": "江戸",
    "アタミザクラ": "熱海桜",
    "アメリカ": "アメリカ",
    "アラシヤマ": "嵐山",
    "チョウシュウヒザクラ": "長州緋桜",
    "タイワンヒザクラ": "台湾緋桜",
    "ヒマラヤヒザクラ": "ヒマラヤ緋桜",
    "シシンデンサコンノサクラ": "紫宸殿左近の桜",
    "ウスズミ": "薄墨",
    "オオタザクラ": "大田桜",
    "ケイオウザクラ": "啓翁桜",
    "ロトウザクラ": "老桃桜",
    "ヒガンザクラ": "彼岸桜",
    "ショカワザクラ": "庄川桜",
}

def find_variety_comprehensive(jname):
    """Enhanced lookup trying kana->kanji conversions too."""
    vid = find_variety_by_japanese_name(jname)
    if vid:
        return vid
    # Try kana->kanji conversion
    if jname in KANA_TO_KANJI:
        vid = find_variety_by_japanese_name(KANA_TO_KANJI[jname])
        if vid:
            return vid
    # Try substring: if name contains 'の', try before it
    if "の" in jname:
        candidate = jname.split("の")[0]
        vid = find_variety_by_japanese_name(candidate)
        if vid:
            return vid
    return None

# Find spots for each web search term
def find_spots_by_search_term(term):
    """Find spot IDs whose name contains the search term."""
    return [s["id"] for s in spots if term in s["name"]]

phase_c_count = 0
for search_term, variety_names in WEB_SEARCH_RESULTS.items():
    matching_spots = find_spots_by_search_term(search_term)
    if not matching_spots:
        print(f"  WARNING: No spots found for search term '{search_term}'")
        continue
    print(f"  Search term '{search_term}': {len(matching_spots)} spots, {len(variety_names)} variety names")
    for vname in variety_names:
        vid = find_variety_comprehensive(vname)
        if vid:
            for sid in matching_spots:
                add_link(vid, sid, "web_search",
                         f"Web search: '{vname}' at spot containing '{search_term}'")
                phase_c_count += 1

print(f"  Phase C links: {phase_c_count}")

# ---------------------------------------------------------------------------
# PHASE D: One-tree and named spots
# ---------------------------------------------------------------------------
print("\n=== PHASE D: One-tree and named spots ===")

# Known one-tree linkings
ONE_TREE_LINKS = [
    ("三春滝桜",    "edohigan-zakura"),
    ("山高神代桜",  "edohigan-zakura"),
    ("根尾谷淡墨桜","edohigan-zakura"),
    ("醍醐桜",      "edohigan-zakura"),   # Okayama
    ("石戸蒲",      None),                # kaba-zakura - 石戸蒲ザクラ
    ("荘川桜",      "edohigan-zakura"),
    ("伊佐沢の久保", "edohigan-zakura"),  # 伊佐沢の久保ザクラ
    ("樽見の大",    "edohigan-zakura"),   # 樽見の大桜 / 樽見の大ザクラ
]

# Find kaba-zakura variety id (蒲桜 = kaba-sakura)
kaba_id = None
for v in varieties:
    if v["id"] == "kaba-sakura" or "蒲桜" in (v.get("name") or ""):
        kaba_id = v["id"]
        break
if not kaba_id:
    for v in varieties:
        if "kaba" in v["id"].lower() and "sakura" in v["id"].lower():
            kaba_id = v["id"]
            break
if kaba_id:
    print(f"  Found kaba-sakura id: {kaba_id}")

phase_d_count = 0
for spot_contains, variety_id in ONE_TREE_LINKS:
    if variety_id is None and spot_contains == "石戸蒲桜":
        variety_id = kaba_id
    if not variety_id:
        print(f"  WARNING: Could not find variety id for one-tree '{spot_contains}'")
        continue
    if variety_id not in variety_by_id:
        print(f"  WARNING: variety_id '{variety_id}' not in varieties data")
        continue
    for spot in spots:
        if spot_contains in spot["name"]:
            add_link(variety_id, spot["id"], "one_tree",
                     f"One-tree/named spot: '{spot_contains}' linked to {variety_id}")
            phase_d_count += 1

# Pattern matching for spot names
PATTERN_LINKS = [
    ("河津",    "kawadu"),      # kawaduzakura
    ("枝垂",    "shidare"),     # shidarezakura
    ("ソメイヨシノ", "somei"), # somei-yoshino
    ("山桜",    "yamazakura"),
    ("エドヒガン", "edohigan"),
    ("大山桜",  "oyamazakura"),
    ("大島桜",  "oshima"),
]

# Find variety ids by id prefix/substring
def find_variety_by_id_pattern(pattern):
    """Find variety ids matching a pattern (case-insensitive substring of id)."""
    return [v["id"] for v in varieties if pattern.lower() in v["id"].lower()]

for spot_keyword, variety_id_pattern in PATTERN_LINKS:
    matching_variety_ids = find_variety_by_id_pattern(variety_id_pattern)
    if not matching_variety_ids:
        print(f"  WARNING: No variety found for id pattern '{variety_id_pattern}'")
        continue
    # Use the first (or most specific) match
    vid = matching_variety_ids[0]
    for spot in spots:
        if spot_keyword in spot["name"]:
            add_link(vid, spot["id"], "one_tree",
                     f"Pattern match: spot name contains '{spot_keyword}' -> {vid}")
            phase_d_count += 1

print(f"  Phase D links: {phase_d_count}")

# ---------------------------------------------------------------------------
# PHASE E: Origin name reverse-linking
# ---------------------------------------------------------------------------
print("\n=== PHASE E: Origin name reverse-linking ===")

# Origin prefix -> spot search term
ORIGIN_PREFIX_LINKS = [
    ("松前",     "松前公園"),
    ("弘前",     "弘前公園"),
    ("河津",     "河津"),
    ("高遠",     "高遠"),
    ("荒川",     "荒川"),
    ("造幣局",   "造幣局"),
]

# Special variety id matches
SPECIAL_ID_LINKS = [
    ("kawazu",   "河津"),
]

phase_e_count = 0
for v in varieties:
    vname = v.get("name") or ""
    vfeatures = v.get("features") or ""
    vtags = v.get("tags") or []
    vid = v["id"]

    linked_spot_terms = set()

    # Check name prefix
    for prefix, spot_term in ORIGIN_PREFIX_LINKS:
        if vname.startswith(prefix) or (prefix in vfeatures):
            linked_spot_terms.add(spot_term)

    # Check tags
    for tag in vtags:
        for prefix, spot_term in ORIGIN_PREFIX_LINKS:
            if prefix in tag:
                linked_spot_terms.add(spot_term)

    # Check variety id patterns
    for id_pattern, spot_term in SPECIAL_ID_LINKS:
        if id_pattern in vid.lower():
            linked_spot_terms.add(spot_term)

    # 造幣局 tags
    if "造幣局" in " ".join(vtags) or "造幣局" in vname:
        linked_spot_terms.add("造幣局")

    for spot_term in linked_spot_terms:
        for spot in spots:
            if spot_term in spot["name"]:
                add_link(vid, spot["id"], "origin_name",
                         f"Origin name: variety '{vname}' ({vid}) origin matches '{spot_term}'")
                phase_e_count += 1

print(f"  Phase E links: {phase_e_count}")

# ---------------------------------------------------------------------------
# Summary of all collected links
# ---------------------------------------------------------------------------
print(f"\n=== Total unique links collected: {len(links)} ===")
by_source = defaultdict(int)
for (vid, sid), info in links.items():
    by_source[info["linkSource"]] += 1
for src, cnt in sorted(by_source.items()):
    print(f"  {src}: {cnt}")

# ---------------------------------------------------------------------------
# Apply links to varieties.json
# ---------------------------------------------------------------------------
print("\n=== Applying links to varieties.json ===")

# Group links by variety
variety_links = defaultdict(list)  # variety_id -> [(spot_id, spot_name, linkSource)]
for (vid, sid), info in links.items():
    sname = spot_id_to_name.get(sid, sid)
    variety_links[vid].append({
        "spotId": sid,
        "spotName": sname,
        "linkSource": info["linkSource"],
    })

varieties_updated = 0
for v in varieties:
    vid = v["id"]
    new_spot_entries = variety_links.get(vid, [])

    existing_spots = v.get("spots") or []
    existing_spot_ids = {entry["spotId"] for entry in existing_spots}

    added = 0
    for entry in new_spot_entries:
        if entry["spotId"] not in existing_spot_ids:
            existing_spots.append(entry)
            existing_spot_ids.add(entry["spotId"])
            added += 1

    if added > 0:
        v["spots"] = existing_spots
        varieties_updated += 1
    elif existing_spots and "spots" not in v:
        v["spots"] = existing_spots

print(f"  Updated {varieties_updated} varieties with spots")

# ---------------------------------------------------------------------------
# Apply links to spots.json
# ---------------------------------------------------------------------------
print("\n=== Applying links to spots.json ===")

# Group links by spot
spot_links = defaultdict(set)  # spot_id -> set of variety_ids
for (vid, sid) in links.keys():
    spot_links[sid].add(vid)

spots_updated = 0
for spot in spots:
    sid = spot["id"]
    new_variety_ids = spot_links.get(sid, set())

    existing_varieties = spot.get("varieties") or []
    existing_set = set(existing_varieties)

    added = []
    for vid in new_variety_ids:
        if vid not in existing_set:
            existing_varieties.append(vid)
            existing_set.add(vid)
            added.append(vid)

    if added:
        spot["varieties"] = existing_varieties
        spots_updated += 1

print(f"  Updated {spots_updated} spots with variety ids")

# ---------------------------------------------------------------------------
# Write updated JSON files
# ---------------------------------------------------------------------------
print("\n=== Writing updated JSON files ===")

with open(VARIETIES_PATH, "w", encoding="utf-8") as f:
    json.dump(varieties, f, ensure_ascii=False, indent=2)
print(f"  Written: {VARIETIES_PATH}")

with open(SPOTS_PATH, "w", encoding="utf-8") as f:
    json.dump(spots, f, ensure_ascii=False, indent=2)
print(f"  Written: {SPOTS_PATH}")

# ---------------------------------------------------------------------------
# Write CSV log
# ---------------------------------------------------------------------------
print("\n=== Writing CSV log ===")

with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["variety_id", "variety_name", "spot_id", "spot_name", "link_source", "evidence"])
    for (vid, sid), info in sorted(links.items()):
        v = variety_by_id.get(vid, {})
        vname = v.get("name", vid)
        sname = spot_id_to_name.get(sid, sid)
        writer.writerow([
            vid,
            vname,
            sid,
            sname,
            info["linkSource"],
            info["evidence"],
        ])

print(f"  Written: {CSV_PATH}")
print(f"  Total CSV rows: {len(links)}")

# ---------------------------------------------------------------------------
# Final summary
# ---------------------------------------------------------------------------
print("\n" + "="*60)
print("FINAL SUMMARY")
print("="*60)
print(f"Total unique (variety, spot) links: {len(links)}")
print(f"Varieties with at least one spot:   {sum(1 for v in varieties if v.get('spots'))}")
print(f"Spots with at least one variety:    {sum(1 for s in spots if s.get('varieties'))}")
print(f"\nLinks by source:")
for src, cnt in sorted(by_source.items()):
    print(f"  {src:20s}: {cnt}")

# Top 10 most-linked spots
spot_link_counts = defaultdict(int)
for (vid, sid) in links.keys():
    spot_link_counts[sid] += 1
top_spots = sorted(spot_link_counts.items(), key=lambda x: -x[1])[:10]
print(f"\nTop 10 most-linked spots:")
for sid, cnt in top_spots:
    print(f"  {spot_id_to_name.get(sid, sid)[:40]:40s} : {cnt} varieties")

# Top 10 most-linked varieties
variety_link_counts = defaultdict(int)
for (vid, sid) in links.keys():
    variety_link_counts[vid] += 1
top_varieties = sorted(variety_link_counts.items(), key=lambda x: -x[1])[:10]
print(f"\nTop 10 most-linked varieties:")
for vid, cnt in top_varieties:
    v = variety_by_id.get(vid, {})
    print(f"  {v.get('name', vid)[:30]:30s} : {cnt} spots")

print("\nDone!")
