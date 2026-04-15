#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add new cherry blossom varieties to varieties.json
Starting from no=807 (current max is 959 based on JSON, but only 806 entries)
Wait - current last no=959 but only 806 entries means there's a gap.
We'll actually start from 807 sequentially (after the existing 806 entries).
"""

import json
import os
import sys

# File paths
VARIETIES_JSON = r"C:\Users\pcyus\Documents\sakura-app\src\data\varieties.json"
BATCH_RESULTS_JSON = r"C:\Users\pcyus\Documents\sakura-app\scripts\extracted_batch_results.json"
KANTO_JSON = r"C:\Users\pcyus\Documents\sakura-app\scripts\new_varieties_kanto.json"

# Exclusions
EXCLUDED_IDS = {
    "teru-te-momo",    # 花桃, not cherry
    "roto-zakura",     # Prunus davidiana, not cherry
    "gantan-zakura",   # alias to kanhizakura, handled separately
    "gyoio",           # 行仙 → already exists as gyoikou
    "daitochin",       # 大東陳 → already exists as ojochin
    "ezo-higan-zakura", # エゾヒガンザクラ → already exists as edohigan-zakura
    "ezo-zakura-kaiko", # 蝦夷桜（懐古園） → already exists as ezoyamazakura
}
EXCLUDED_NAMES = {
    "テルテモモ",
    "魯桃桜",
    "ガンタンザクラ",
    "行仙",
    "大東陳",
    "エゾヒガンザクラ",
    "蝦夷桜（小諸城址懐古園の蝦夷桜）",
}

# Color code mappings
COLOR_CODE_MAP = {
    "白": "#FFFFFF",
    "白色": "#FFFFFF",
    "白〜淡紅": "#FFF0F5",
    "白〜淡紅色": "#FFF0F5",
    "白（淡黄白色）": "#FFFFFF",
    "白（わずかに紅を帯びる個体あり）": "#FFFFFF",
    "白〜極淡紅（白糸の名の通り白色系）": "#FFFFFF",
    "白（ピンクの蕾から大輪の白い花へ）": "#FFFFFF",
    "淡白": "#FFF0F5",
    "淡紅": "#FFB7C5",
    "淡紅色": "#FFB7C5",
    "淡紅〜白": "#FFF0F5",
    "淡紅〜白色": "#FFF0F5",
    "淡紅〜薄紅": "#FFB7C5",
    "薄紅": "#FFB7C5",
    "淡いピンク": "#FFB7C5",
    "淡紅〜赤紫": "#E8637E",
    "淡紅〜えび茶（満開時ピンク）": "#E8A0B4",
    "紅": "#FF69B4",
    "紅色": "#FF69B4",
    "ピンク": "#FF69B4",
    "薄紅色": "#FFB7C5",
    "白〜淡紅色": "#FFF0F5",
    "淡紅色〜白（詳細は公式資料要確認）": "#FFF0F5",
    "淡紅色（花芯が濃紅）": "#FF8FA3",
    "淡紅紫〜紅紫色": "#DDA0DD",
    "紅紫": "#C06080",
    "濃紅": "#C2185B",
    "濃ピンク": "#C2185B",
    "黄緑": "#90EE90",
    "緑": "#90EE90",
    "紫": "#DDA0DD",
    "淡紫": "#DDA0DD",
    "不明": "#FFB7C5",
    "不明（要現地確認）": "#FFB7C5",
    "淡紅〜白（詳細は公式資料要確認）": "#FFF0F5",
    "淡紅色（推定）": "#FFB7C5",
    "紅色（推定）": "#FF69B4",
    "淡紅色・白（不明）": "#FFF0F5",
}

def get_color_code(color_str):
    if not color_str:
        return "#FFB7C5"
    if color_str in COLOR_CODE_MAP:
        return COLOR_CODE_MAP[color_str]
    # Fuzzy match
    for key, val in COLOR_CODE_MAP.items():
        if color_str.startswith(key) or key in color_str:
            return val
    # Default by keywords
    if "濃紅" in color_str or "濃ピンク" in color_str:
        return "#C2185B"
    if "紅紫" in color_str or "紫" in color_str:
        return "#DDA0DD"
    if "濃" in color_str and "紅" in color_str:
        return "#C2185B"
    if "白" in color_str and ("淡紅" in color_str or "薄紅" in color_str):
        return "#FFF0F5"
    if "白" in color_str:
        return "#FFFFFF"
    if "淡紅" in color_str or "薄紅" in color_str:
        return "#FFB7C5"
    if "紅" in color_str or "ピンク" in color_str:
        return "#FF69B4"
    if "緑" in color_str or "黄緑" in color_str:
        return "#90EE90"
    return "#FFB7C5"

RARITY_LABELS = {
    1: "普通",
    2: "やや珍しい",
    3: "珍しい",
    4: "とても珍しい",
    5: "非常に希少",
}
RARITY_STARS = {
    1: "★",
    2: "★★",
    3: "★★★",
    4: "★★★★",
    5: "★★★★★",
}

def normalize_rarity(rarity_obj):
    """Normalize rarity object - fix non-standard labels/stars."""
    if not rarity_obj:
        return {"score": 3, "stars": "★★★", "label": "珍しい", "reasons": []}
    score = rarity_obj.get("score", 3)
    if not isinstance(score, int) or score < 1 or score > 5:
        score = 3
    return {
        "score": score,
        "stars": RARITY_STARS.get(score, "★★★"),
        "label": RARITY_LABELS.get(score, "珍しい"),
        "reasons": rarity_obj.get("reasons", []),
    }

def parse_bloom_season_to_period(bloom_season):
    """Parse bloom_season string to bloomPeriod dict."""
    if not bloom_season:
        return {"start": "04-early", "end": "04-mid", "secondary": None, "regionNote": None}

    season = bloom_season.strip()

    # Month mapping
    month_map = {"1月": "01", "2月": "02", "3月": "03", "4月": "04", "5月": "05",
                 "6月": "06", "7月": "07", "8月": "08", "9月": "09", "10月": "10",
                 "11月": "11", "12月": "12"}
    period_map = {"上旬": "early", "中旬": "mid", "下旬": "late"}

    def extract_month_period(text):
        for m, mc in month_map.items():
            if m in text:
                for p, pc in period_map.items():
                    if p in text:
                        return f"{mc}-{pc}"
                return f"{mc}-mid"
        return None

    # Try to find start and end
    # Split on 〜 or ～
    parts = season.replace("～", "〜").split("〜")

    start = extract_month_period(parts[0]) if parts else None
    end = extract_month_period(parts[-1]) if len(parts) > 1 else None

    if not start:
        start = "04-early"
    if not end:
        end = start

    return {"start": start, "end": end, "secondary": None, "regionNote": None}

def make_tags_from_flower_shape(flower_shape, color, name):
    """Generate basic tags from flower shape."""
    tags = []
    if flower_shape:
        fs = flower_shape
        if "八重" in fs:
            tags.append("八重咲き")
        elif "一重" in fs:
            tags.append("一重咲き")
        elif "半八重" in fs:
            tags.append("半八重咲き")
        if "枝垂" in fs:
            tags.append("枝垂れ")
    return tags

def normalize_spots_batch1234(notable_spots):
    """Convert notable_spots (list of strings or dicts) to spots array."""
    if not notable_spots:
        return []
    spots = []
    for spot in notable_spots:
        if isinstance(spot, str):
            spots.append({"spotId": "", "spotName": spot})
        elif isinstance(spot, dict):
            name = spot.get("name", "")
            if name:
                spots.append({"spotId": "", "spotName": name})
    return spots

def normalize_spots_batch7(spots_raw):
    """Convert Batch7 spots format to standard format."""
    if not spots_raw:
        return []
    result = []
    for s in spots_raw:
        if isinstance(s, dict):
            spot_id = s.get("spotId", "")
            spot_name = s.get("spotName", "")
            if spot_name:
                result.append({"spotId": spot_id, "spotName": spot_name})
    return result

def convert_batch1234_variety(v):
    """Convert Batch1/2/3/4 style variety (variety_name, id_suggestion, etc.) to schema."""
    name = v.get("variety_name", "")
    id_slug = v.get("id_suggestion", "").strip()
    reading = v.get("reading", "")
    bloom_season = v.get("bloom_season", "")
    color = v.get("color", "淡紅")
    flower_shape = v.get("flower_shape", "一重咲き")
    summary = v.get("summary", "")
    features = v.get("features", "")
    history = v.get("history", "")
    background = v.get("background", "")
    trivia = v.get("trivia", "")
    wiki_ja = v.get("wiki_ja", None)
    wiki_en = v.get("wiki_en", None)
    notable_spots = v.get("notable_spots", [])

    # Clean up wiki values
    if wiki_ja and ("記事なし" in wiki_ja or "関連" in wiki_ja or "独立記事なし" in wiki_ja):
        wiki_ja = None
    if wiki_en and ("独立記事なし" in wiki_en or "関連" in wiki_en):
        wiki_en = None

    bloom_period = parse_bloom_season_to_period(bloom_season)
    tags = make_tags_from_flower_shape(flower_shape, color, name)

    # Normalize flower shape for display
    flower_shape_norm = flower_shape.replace("き", "").replace("一重咲", "一重咲").strip()
    if "一重咲" in flower_shape and "枝垂" in flower_shape:
        flower_shape_norm = "一重咲・枝垂れ"
    elif "八重咲" in flower_shape and "枝垂" in flower_shape:
        flower_shape_norm = "八重咲・枝垂れ"
    elif "一重咲" in flower_shape:
        flower_shape_norm = "一重咲"
    elif "八重咲" in flower_shape:
        flower_shape_norm = "八重咲"
    elif "半八重" in flower_shape:
        flower_shape_norm = "半八重咲"
    else:
        flower_shape_norm = flower_shape.split("・")[0].replace("き", "")

    # Rarity: default based on context
    rarity_score = 3
    if wiki_ja is None and wiki_en is None:
        rarity_score = 4
    if "天然記念物" in (features + history + background):
        rarity_score = 4
    if "絶滅危惧" in (features + history + background):
        rarity_score = 5
    if "固有" in name or "固有" in (features + background):
        rarity_score = max(rarity_score, 4)

    rarity = {
        "score": rarity_score,
        "stars": RARITY_STARS[rarity_score],
        "label": RARITY_LABELS[rarity_score],
        "reasons": [],
    }

    spots = normalize_spots_batch1234(notable_spots)

    return {
        "id": id_slug,
        "no": 0,  # to be assigned
        "name": name,
        "reading": reading,
        "bloomSeason": bloom_season,
        "color": color.split("（")[0].split("〜")[0].strip() if color else "淡紅",
        "colorCode": get_color_code(color),
        "flowerShape": flower_shape_norm,
        "tags": tags,
        "summary": summary,
        "features": features,
        "history": history,
        "background": background,
        "trivia": trivia,
        "wikiTitleJa": wiki_ja,
        "wikiTitleEn": wiki_en,
        "emoji": "🌸",
        "bloomPeriod": bloom_period,
        "images": [],
        "hasImage": False,
        "rarity": rarity,
        "spots": spots,
    }

def convert_batch3_variety(v):
    """Convert Batch3 style (id, name_ja, name_kana, flower, bloom_period, etc.)."""
    name = v.get("name_ja", "")
    id_slug = v.get("id", "").strip().replace("_", "-")
    reading = v.get("name_kana", "").split("・")[0].strip()

    flower = v.get("flower", {})
    color = flower.get("color", "淡紅色")
    flower_form = flower.get("form", "一重咲き")

    bloom_p = v.get("bloom_period", {})
    bloom_season = bloom_p.get("season", "4月中旬")

    features = v.get("characteristics", "")
    history = v.get("origin", "")
    background = ""
    trivia = v.get("trivia", "")
    summary = features[:100] + "..." if len(features) > 100 else features

    wiki_ja = v.get("wikipedia_ja", None)
    wiki_en = v.get("wikipedia_en", None)
    if wiki_ja and ("関連" in wiki_ja or "可能性" in wiki_ja):
        wiki_ja = None

    spots_raw = v.get("viewing_spots", [])
    spots = []
    for s in spots_raw:
        if isinstance(s, str) and s:
            spots.append({"spotId": "", "spotName": s})

    bloom_period = parse_bloom_season_to_period(bloom_season)
    tags = make_tags_from_flower_shape(flower_form, color, name)

    flower_shape_norm = "一重咲"
    if "八重" in flower_form:
        flower_shape_norm = "八重咲"
    elif "一重" in flower_form:
        flower_shape_norm = "一重咲"
    if "枝垂" in flower_form:
        flower_shape_norm += "・枝垂れ"

    data_confidence = v.get("data_confidence", "medium")
    rarity_score = 4
    if data_confidence == "low":
        rarity_score = 5
    elif data_confidence == "high":
        rarity_score = 4
    if "絶滅危惧" in (features + history):
        rarity_score = 5

    rarity = {
        "score": rarity_score,
        "stars": RARITY_STARS[rarity_score],
        "label": RARITY_LABELS[rarity_score],
        "reasons": [],
    }

    return {
        "id": id_slug,
        "no": 0,
        "name": name,
        "reading": reading,
        "bloomSeason": bloom_season,
        "color": color.split("（")[0].split("〜")[0].strip() if color else "淡紅",
        "colorCode": get_color_code(color),
        "flowerShape": flower_shape_norm,
        "tags": tags,
        "summary": summary,
        "features": features,
        "history": history,
        "background": background,
        "trivia": trivia,
        "wikiTitleJa": wiki_ja,
        "wikiTitleEn": wiki_en,
        "emoji": "🌸",
        "bloomPeriod": bloom_period,
        "images": [],
        "hasImage": False,
        "rarity": rarity,
        "spots": spots,
    }

def convert_batch6_variety(v):
    """Batch6 already uses correct schema, just normalize rarity."""
    result = dict(v)
    result["no"] = 0
    result["rarity"] = normalize_rarity(v.get("rarity", {}))
    if "images" not in result:
        result["images"] = []
    if "hasImage" not in result:
        result["hasImage"] = False
    # Normalize spots
    spots = result.get("spots", [])
    norm_spots = []
    for s in spots:
        if isinstance(s, dict):
            norm_spots.append({
                "spotId": s.get("spotId", ""),
                "spotName": s.get("spotName", ""),
            })
    result["spots"] = norm_spots
    return result

def convert_batch7_variety(v):
    """Batch7 already uses correct schema, just normalize rarity and spots."""
    result = dict(v)
    result["no"] = 0
    result["rarity"] = normalize_rarity(v.get("rarity", {}))
    if "images" not in result:
        result["images"] = []
    if "hasImage" not in result:
        result["hasImage"] = False
    # Normalize spots (Batch7 has different format)
    spots = result.get("spots", [])
    norm_spots = []
    for s in spots:
        if isinstance(s, dict):
            spot_id = s.get("spotId", "")
            spot_name = s.get("spotName", "")
            if spot_name:
                norm_spots.append({"spotId": spot_id, "spotName": spot_name})
    result["spots"] = norm_spots
    return result

def is_excluded(variety_dict):
    """Check if a variety should be excluded."""
    vid = variety_dict.get("id", "")
    vname = variety_dict.get("name", "")
    if vid in EXCLUDED_IDS:
        return True, f"id '{vid}' in excluded list"
    if vname in EXCLUDED_NAMES:
        return True, f"name '{vname}' in excluded list"
    # Check partial name matches
    for excl_name in EXCLUDED_NAMES:
        if excl_name in vname:
            return True, f"name contains excluded '{excl_name}'"
    return False, ""

def main():
    # Load current varieties.json
    print(f"Loading {VARIETIES_JSON}...")
    with open(VARIETIES_JSON, "r", encoding="utf-8") as f:
        current_varieties = json.load(f)

    print(f"Current count: {len(current_varieties)}")
    current_max_no = max(int(v["no"]) for v in current_varieties)
    print(f"Current max no: {current_max_no}")

    # Load batch results
    print(f"\nLoading {BATCH_RESULTS_JSON}...")
    with open(BATCH_RESULTS_JSON, "r", encoding="utf-8") as f:
        batch_results = json.load(f)

    # Load kanto varieties (Batch5)
    print(f"Loading {KANTO_JSON}...")
    with open(KANTO_JSON, "r", encoding="utf-8") as f:
        kanto_varieties = json.load(f)

    # Collect all new varieties
    new_varieties = []
    skipped = []

    # Track seen IDs to avoid duplicates
    seen_ids = set(v["id"] for v in current_varieties)

    # Process each batch
    # Order: Batch1 (野生種), Batch2 (松前系), Batch3 (弘前/山形), Batch4 (東北系),
    #        Batch5 (関東, from kanto_json), Batch6 (中部・東海), Batch7 (京都・九州)

    batch_processors = [
        ("Batch1", "batch1234"),
        ("Batch2", "batch1234"),
        ("Batch4", "batch1234"),
        ("Batch6", "batch6"),
        ("Batch7", "batch7"),
    ]

    for batch_key, batch_type in batch_processors:
        if batch_key not in batch_results:
            print(f"  WARNING: {batch_key} not found in batch_results")
            continue

        batch_data = batch_results[batch_key]
        varieties_list = batch_data.get("varieties", [])
        print(f"\nProcessing {batch_key} ({batch_type}): {len(varieties_list)} varieties")

        for v in varieties_list:
            try:
                if batch_type == "batch1234":
                    converted = convert_batch1234_variety(v)
                elif batch_type == "batch6":
                    converted = convert_batch6_variety(v)
                elif batch_type == "batch7":
                    converted = convert_batch7_variety(v)
                else:
                    converted = convert_batch1234_variety(v)

                # Check exclusion
                excl, reason = is_excluded(converted)
                if excl:
                    skipped.append((converted["name"], reason))
                    print(f"  SKIP: {converted['name']} ({reason})")
                    continue

                # Check duplicate id
                if converted["id"] in seen_ids:
                    skipped.append((converted["name"], f"duplicate id '{converted['id']}'"))
                    print(f"  SKIP (dup): {converted['name']} (id={converted['id']})")
                    continue

                seen_ids.add(converted["id"])
                new_varieties.append(converted)
                print(f"  ADD: {converted['name']} (id={converted['id']})")

            except Exception as e:
                name = v.get("variety_name", v.get("name", v.get("name_ja", "UNKNOWN")))
                skipped.append((name, f"conversion error: {e}"))
                print(f"  ERROR: {name}: {e}")

    # Process Batch3 (different schema)
    batch3_data = batch_results.get("Batch3", {})
    batch3_varieties = batch3_data.get("varieties", [])
    print(f"\nProcessing Batch3 (弘前/山形): {len(batch3_varieties)} varieties")

    for v in batch3_varieties:
        try:
            converted = convert_batch3_variety(v)

            excl, reason = is_excluded(converted)
            if excl:
                skipped.append((converted["name"], reason))
                print(f"  SKIP: {converted['name']} ({reason})")
                continue

            if converted["id"] in seen_ids:
                skipped.append((converted["name"], f"duplicate id '{converted['id']}'"))
                print(f"  SKIP (dup): {converted['name']} (id={converted['id']})")
                continue

            seen_ids.add(converted["id"])
            new_varieties.append(converted)
            print(f"  ADD: {converted['name']} (id={converted['id']})")

        except Exception as e:
            name = v.get("name_ja", "UNKNOWN")
            skipped.append((name, f"conversion error: {e}"))
            print(f"  ERROR: {name}: {e}")

    # Process Batch5 (kanto_varieties - already correct schema)
    print(f"\nProcessing Batch5/Kanto: {len(kanto_varieties)} varieties")
    for v in kanto_varieties:
        try:
            converted = dict(v)
            converted["no"] = 0  # to be assigned
            converted["rarity"] = normalize_rarity(v.get("rarity", {}))
            if "images" not in converted:
                converted["images"] = []
            if "hasImage" not in converted:
                converted["hasImage"] = False
            # Normalize spots
            spots = converted.get("spots", [])
            norm_spots = []
            for s in spots:
                if isinstance(s, dict):
                    norm_spots.append({
                        "spotId": s.get("spotId", ""),
                        "spotName": s.get("spotName", ""),
                    })
            converted["spots"] = norm_spots

            excl, reason = is_excluded(converted)
            if excl:
                skipped.append((converted["name"], reason))
                print(f"  SKIP: {converted['name']} ({reason})")
                continue

            if converted["id"] in seen_ids:
                skipped.append((converted["name"], f"duplicate id '{converted['id']}'"))
                print(f"  SKIP (dup): {converted['name']} (id={converted['id']})")
                continue

            seen_ids.add(converted["id"])
            new_varieties.append(converted)
            print(f"  ADD: {converted['name']} (id={converted['id']})")

        except Exception as e:
            name = v.get("name", "UNKNOWN")
            skipped.append((name, f"conversion error: {e}"))
            print(f"  ERROR: {name}: {e}")

    # Assign sequential no values starting from max_no + 1
    start_no = current_max_no + 1
    print(f"\nAssigning no values starting from {start_no}...")
    for i, v in enumerate(new_varieties):
        v["no"] = start_no + i

    print(f"\nTotal new varieties to add: {len(new_varieties)}")
    print(f"no range: {new_varieties[0]['no']} to {new_varieties[-1]['no']}")

    # Append to varieties.json
    updated_varieties = current_varieties + new_varieties

    print(f"\nWriting {len(updated_varieties)} entries to {VARIETIES_JSON}...")
    with open(VARIETIES_JSON, "w", encoding="utf-8") as f:
        json.dump(updated_varieties, f, ensure_ascii=False, indent=2)

    print("\n=== SUMMARY ===")
    print(f"Original count: {len(current_varieties)}")
    print(f"New varieties added: {len(new_varieties)}")
    print(f"Final count: {len(updated_varieties)}")
    print(f"\nSkipped ({len(skipped)}):")
    for name, reason in skipped:
        print(f"  - {name}: {reason}")

    print(f"\nNew varieties list:")
    for v in new_varieties:
        print(f"  no={v['no']}, id={v['id']}, name={v['name']}")

    # Verify
    print(f"\nVerifying...")
    with open(VARIETIES_JSON, "r", encoding="utf-8") as f:
        verify_data = json.load(f)
    print(f"Verified count: {len(verify_data)}")
    print(f"Expected: {len(updated_varieties)}")
    assert len(verify_data) == len(updated_varieties), "Count mismatch!"
    print("OK")

if __name__ == "__main__":
    main()
