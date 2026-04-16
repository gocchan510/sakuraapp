"""
generate_prefecture_varieties.py
都道府県×品種IDのマッピングを生成する。
spots.json から都道府県別の品種IDを集計し、
主要品種は全47都道府県に必ず含める。
"全国"キーに全862品種のIDリストを入れる。
出力: src/data/prefectureVarieties.json
"""

import json
import sys
import os

sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPOTS_JSON = os.path.join(BASE_DIR, 'src', 'data', 'spots.json')
VARIETIES_JSON = os.path.join(BASE_DIR, 'src', 'data', 'varieties.json')
OUTPUT_JSON = os.path.join(BASE_DIR, 'src', 'data', 'prefectureVarieties.json')

# ── データ読み込み ─────────────────────────────────────────────
with open(SPOTS_JSON, encoding='utf-8') as f:
    spots = json.load(f)

with open(VARIETIES_JSON, encoding='utf-8') as f:
    varieties = json.load(f)

all_variety_ids = sorted(v['id'] for v in varieties)
variety_id_set = set(all_variety_ids)

# ── 主要品種のID特定（varieties.json で name に一致するものを探す） ──
# 優先度順で最初にマッチしたIDを使う
MAJOR_NAME_PATTERNS = [
    'someiyoshino',     # IDで直接指定
    'kanzan',           # IDで直接指定
    'fugenzou',         # IDで直接指定（普賢象）
    'shidarezakura',    # IDで直接指定（枝垂桜）
    'yamazakura',       # IDで直接指定（ヤマザクラ）
]

# nameベースで追加検索する品種
MAJOR_NAME_KEYWORDS = {
    '吉野': None,   # 吉野という名前の品種
}

# nameキーワードから品種IDを探す
for keyword, _ in MAJOR_NAME_KEYWORDS.items():
    for v in varieties:
        if v.get('name') == keyword or v.get('name') == keyword + '桜':
            MAJOR_NAME_KEYWORDS[keyword] = v['id']
            break
    # まだ見つからなければ部分一致
    if MAJOR_NAME_KEYWORDS[keyword] is None:
        for v in varieties:
            if keyword in v.get('name', '') and len(v.get('name', '')) <= len(keyword) + 2:
                MAJOR_NAME_KEYWORDS[keyword] = v['id']
                break

# 存在するIDのみをMAJOR_VARIETIESに含める
MAJOR_VARIETIES = []
for vid in MAJOR_NAME_PATTERNS:
    if vid in variety_id_set:
        MAJOR_VARIETIES.append(vid)
    else:
        print(f"  [WARNING] Major variety ID not found: {vid}", file=sys.stderr)

for keyword, vid in MAJOR_NAME_KEYWORDS.items():
    if vid and vid in variety_id_set:
        MAJOR_VARIETIES.append(vid)
        print(f"  [INFO] Major variety '{keyword}' → ID: {vid}")
    else:
        print(f"  [WARNING] Major variety '{keyword}' not found", file=sys.stderr)

print(f"Major varieties ({len(MAJOR_VARIETIES)}): {MAJOR_VARIETIES}")

# ── 都道府県ごとに品種を集計 ──────────────────────────────────
pref_varieties: dict[str, set] = {}

# spots.jsonから集計
for spot in spots:
    pref = spot.get('prefecture', '')
    if not pref:
        continue
    if pref not in pref_varieties:
        pref_varieties[pref] = set()
    for vid in spot.get('varieties', []):
        if vid in variety_id_set:
            pref_varieties[pref].add(vid)

# 全47都道府県を確認（spots.jsonにない都道府県はMAJOR_VARIETIESのみ）
ALL_47_PREFS = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県',
    '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県',
    '沖縄県',
]

# 全都道府県に主要品種を追加
for pref in ALL_47_PREFS:
    if pref not in pref_varieties:
        pref_varieties[pref] = set()
    for vid in MAJOR_VARIETIES:
        pref_varieties[pref].add(vid)

# 既存データにも主要品種を追加
for pref in pref_varieties:
    for vid in MAJOR_VARIETIES:
        pref_varieties[pref].add(vid)

# ── "全国"キー：全862品種のIDリスト ──────────────────────────
pref_varieties['全国'] = set(all_variety_ids)

# ── ソートして出力 ─────────────────────────────────────────
result = {}

# 北から南の順に並べる
ordered_prefs = ALL_47_PREFS + ['全国']
for pref in ordered_prefs:
    if pref in pref_varieties:
        result[pref] = sorted(pref_varieties[pref])

# 上記に含まれない都道府県があれば追加（念のため）
for pref in sorted(pref_varieties.keys()):
    if pref not in result:
        result[pref] = sorted(pref_varieties[pref])

with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# ── サマリー表示 ──────────────────────────────────────────────
print(f"\n=== 都道府県別品種数サマリー ===")
pref_counts = {}
for pref in ALL_47_PREFS:
    count = len(result.get(pref, []))
    pref_counts[pref] = count

counts = list(pref_counts.values())
max_pref = max(pref_counts, key=pref_counts.get)
min_pref = min(pref_counts, key=pref_counts.get)
avg = sum(counts) / len(counts)

print(f"最多: {max_pref} ({pref_counts[max_pref]}品種)")
print(f"最少: {min_pref} ({pref_counts[min_pref]}品種)")
print(f"平均: {avg:.1f}品種")
print(f"全国（全品種）: {len(result.get('全国', []))}品種")
print(f"\n都道府県別詳細:")
for pref in ALL_47_PREFS:
    count = pref_counts.get(pref, 0)
    print(f"  {pref}: {count}品種")

print(f"\n出力先: {OUTPUT_JSON}")
