#!/usr/bin/env python3
"""
Spot variety enrichment script.
Reads spots.json, does web searches for variety info, updates spots.json.
"""
import json
import re
import os
import sys
import unicodedata
from datetime import datetime

# Paths
BASE = r"C:\Users\pcyus\Documents\sakura-app"
SPOTS_FILE = os.path.join(BASE, "src", "data", "spots.json")
VARIETIES_FILE = os.path.join(BASE, "src", "data", "varieties.json")
PROGRESS_FILE = os.path.join(BASE, "scripts", "spot_enrichment_progress.json")
LOG_FILE = os.path.join(BASE, "scripts", "spot_variety_log.csv")

SKIP_IDS = {
    "zoheijo-osaka",
    "zoheijo-hiroshima",
    "shinjuku-gyoen",
    "hirosaki-park",
    "hirano-jinja",
    "nijo-castle",
    "matsumae-park",
    "yuki-sakura-farm",
}

def normalize(s):
    """Normalize string for matching: lowercase, full-width to half-width, remove spaces."""
    s = unicodedata.normalize("NFKC", s)
    s = s.lower().strip()
    # Remove trailing sakura
    s = re.sub(r'[桜ザクラざくら]$', '', s)
    s = re.sub(r'\s+', '', s)
    return s

def build_variety_map(varieties):
    """Build name/alias -> id mapping."""
    vmap = {}
    for v in varieties:
        vid = v["id"]
        # Name
        key = normalize(v["name"])
        vmap[key] = vid
        # Reading
        if v.get("reading"):
            vmap[normalize(v["reading"])] = vid
        # Aliases
        for alias in v.get("aliases", []):
            vmap[normalize(alias)] = vid
    return vmap

def find_variety_id(name_str, vmap):
    """Try to match a variety name string to an ID."""
    key = normalize(name_str)
    if key in vmap:
        return vmap[key]
    # Try removing common suffixes
    for suffix in ["の花", "の桜", "ざくら", "さくら", "サクラ"]:
        if key.endswith(suffix):
            k2 = key[:-len(suffix)]
            if k2 in vmap:
                return vmap[k2]
    return None

# Known variety name patterns for extraction from text
VARIETY_PATTERNS = [
    "ソメイヨシノ", "染井吉野", "オオシマザクラ", "大島桜", "ヤマザクラ", "山桜",
    "シダレザクラ", "枝垂桜", "枝垂れ桜", "しだれ桜",
    "ヤエザクラ", "八重桜", "八重咲",
    "カワヅザクラ", "河津桜",
    "ヒカンザクラ", "緋寒桜", "ヒガンザクラ", "彼岸桜",
    "カスミザクラ", "霞桜",
    "オオヤマザクラ", "大山桜",
    "エゾヤマザクラ", "蝦夷山桜",
    "カンヒザクラ", "寒緋桜",
    "コヒガンザクラ", "小彼岸桜",
    "ウスゲヨウコウ", "陽光",
    "ケイオウザクラ", "啓翁桜",
    "コシノヒガン", "越彼岸",
    "カンザン", "関山", "カンサン",
    "ギョイコウ", "御衣黄",
    "ウコン", "鬱金",
    "イチヨウ", "一葉",
    "フゲンゾウ", "普賢象",
    "アマノガワ", "天の川",
    "タイハク", "大白",
    "シロタエ", "白妙",
    "ショウゲツ", "松月",
    "コトヒラ", "琴平",
    "スルガダイニオイ", "駿河台匂",
    "アオバザクラ", "青葉桜",
    "シュゼンジカンザクラ", "修善寺寒桜",
    "コマツオトメ", "小松乙女",
    "オカメ", "おかめ",
    "ヨウコウ", "陽光",
    "ジンダイアケボノ", "神代曙",
    "アケボノ", "曙",
    "エドヒガン", "江戸彼岸",
    "マメザクラ", "豆桜",
    "ミヤマザクラ", "深山桜",
    "タカトオコヒガンザクラ", "高遠小彼岸桜",
    "コヒガン", "小彼岸",
    "ウスズミザクラ", "淡墨桜",
    "シロヒガン", "白彼岸",
    "イトザクラ", "糸桜",
    "ベニシダレ", "紅枝垂",
    "ヤエベニシダレ", "八重紅枝垂",
    "ヤエシロヤマザクラ", "八重白山桜",
    "スミゾメ", "墨染",
    "フクロクジュ", "福禄寿",
    "ヤエムラサキザクラ", "八重紫桜",
    "ミクルマガエシ", "御車返し",
    "チョウジザクラ", "丁字桜",
    "クルマガエシ", "車返し",
    "ミハルタキザクラ", "三春滝桜",
    "ベニヨシノ", "紅吉野",
    "センダイヤ", "仙台屋",
    "カイナンチェリー", "海南桜",
    "ハルメキ", "春めき",
    "ミドリノコバイモ", "緑の小梅",
    "コウゾウ", "紅造",
    "ヤエコウゾウ", "八重紅造",
    "ミシマザクラ", "三島桜",
    "ハナノカン", "花の缶",
    "オモイガワ", "思川",
    "コショウジュ", "紅笑寿",
    "ジュウガツザクラ", "十月桜",
    "コブクザクラ", "子福桜",
    "シキザクラ", "四季桜",
    "カラミザクラ", "唐実桜",
    "トウカイザクラ", "東海桜",
    "サトザクラ", "里桜",
    "ナデシコ", "撫子桜",
    "マキノザクラ", "牧野桜",
    "タイワンヒカンザクラ", "台湾緋寒桜",
    "スウィートバーレーン", "スイートバーレーン",
]

def extract_varieties_from_text(text, vmap):
    """Extract variety IDs from text using pattern matching."""
    found_ids = set()

    for pattern in VARIETY_PATTERNS:
        if pattern in text:
            vid = find_variety_id(pattern, vmap)
            if vid:
                found_ids.add(vid)

    # Also try to find variety names followed by common patterns
    # e.g. "ソメイヨシノ約500本" or "関山(カンザン)"
    variety_mention_re = re.compile(r'([ァ-ヴーぁ-ん一-龥]{2,10}(?:桜|ザクラ|さくら)?)\s*(?:約?\d+本|\(|\s|、|。|が|は|を|の)')
    for m in variety_mention_re.finditer(text):
        name = m.group(1)
        vid = find_variety_id(name, vmap)
        if vid:
            found_ids.add(vid)

    return list(found_ids)

def extract_variety_count(text):
    """Extract variety count from text like '約30品種'."""
    m = re.search(r'約?\s*(\d+)\s*(?:品種|種類)', text)
    if m:
        return int(m.group(1))
    return None

def extract_variety_note(text):
    """Extract tree count notes."""
    notes = []
    # Pattern: "ソメイヨシノ約500本" or "約1000本"
    for m in re.finditer(r'([ァ-ヴーぁ-ん一-龥]{2,10}(?:桜|ザクラ)?)\s*約?\s*(\d+)\s*本', text):
        notes.append(f"{m.group(1)}{m.group(2)}本")
    for m in re.finditer(r'約\s*(\d+)\s*本', text):
        val = f"約{m.group(1)}本"
        if val not in notes:
            notes.append(val)
    return "、".join(notes[:3]) if notes else None

# Load data
print("Loading data files...")
with open(SPOTS_FILE, encoding="utf-8") as f:
    spots = json.load(f)
with open(VARIETIES_FILE, encoding="utf-8") as f:
    varieties = json.load(f)

vmap = build_variety_map(varieties)
print(f"Varieties loaded: {len(varieties)}, Mapping keys: {len(vmap)}")
print(f"Spots loaded: {len(spots)}")

# Load progress
progress = {}
if os.path.exists(PROGRESS_FILE):
    with open(PROGRESS_FILE, encoding="utf-8") as f:
        progress = json.load(f)
    print(f"Progress loaded: {progress.get('processed', 0)} already processed, last={progress.get('lastProcessedId', 'none')}")
else:
    print("No progress file found, starting fresh")

processed_count = progress.get("processed", 0)
last_processed_id = progress.get("lastProcessedId", None)

# Build set of spots that have been processed (from log)
processed_ids = set()
if os.path.exists(LOG_FILE):
    with open(LOG_FILE, encoding="utf-8") as f:
        for line in f:
            parts = line.strip().split(",")
            if len(parts) >= 1 and parts[0] not in ("spot_id", ""):
                processed_ids.add(parts[0])
    print(f"Previously logged spots: {len(processed_ids)}")

# Initialize log file if not exists
if not os.path.exists(LOG_FILE):
    with open(LOG_FILE, "w", encoding="utf-8") as f:
        f.write("spot_id,spot_name,varieties_added,variety_count_found,note\n")

print("Script setup complete. Ready for processing.")
print(f"Total spots to potentially process (excl. skips): {sum(1 for s in spots if s['id'] not in SKIP_IDS and s['id'] not in processed_ids)}")

# Export vmap for use
import pickle
with open(os.path.join(BASE, "scripts", "vmap_cache.pkl"), "wb") as f:
    pickle.dump(vmap, f)
print("vmap saved to cache")
