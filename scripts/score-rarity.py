#!/usr/bin/env python3
"""
score-rarity.py — varieties.json の全品種にレア度スコア(1-5)を付与する
"""
import json, re, csv, os

ROOT     = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
VAR_PATH = os.path.join(ROOT, 'src', 'data', 'varieties.json')
CSV_PATH = os.path.join(ROOT, 'scripts', 'rarity_distribution.csv')

varieties = json.loads(open(VAR_PATH, encoding='utf-8').read())

# ── 花弁数抽出 ─────────────────────────────────────────────────
PETAL_PATTERNS = [
    r'花弁[はが約数：は]*\s*(\d+)\s*[枚個]',
    r'(\d+)\s*枚[のほど]*[の花弁]',
    r'花弁数[：は約\s]*(\d+)',
    r'(\d+)\s*枚.*?花弁',
    r'弁数[：は約\s]*(\d+)',
]

def extract_petal_count(text):
    if not text:
        return 0
    nums = []
    for pat in PETAL_PATTERNS:
        for m in re.finditer(pat, text):
            n = int(m.group(1))
            if 5 <= n <= 500:   # 明らかな誤抽出除外
                nums.append(n)
    return max(nums) if nums else 0

# ── スコアリング ────────────────────────────────────────────────
STAR_MAP = [
    (7, 5, "★★★★★", "激レア"),
    (4, 4, "★★★★",  "とても珍しい"),
    (2, 3, "★★★",   "珍しい"),
    (1, 2, "★★",    "やや珍しい"),
    (0, 1, "★",     "よく見る"),
]

def score_variety(v):
    raw   = 0
    reasons = []

    color   = v.get('color', '') or ''
    shape   = v.get('flowerShape', '') or ''
    tags    = v.get('tags', []) or []
    tags_str = ' '.join(tags)
    feat    = (v.get('features', '') or '') + ' ' + (v.get('background', '') or '') + ' ' + (v.get('history', '') or '')
    bp      = v.get('bloomPeriod') or {}
    name    = v.get('name', '')

    # ── 花色 ──────────────────────────────────────────────────
    if any(k in color for k in ['黄緑', '緑', '黄', '淡黄緑']):
        raw += 4; reasons.append('黄緑・緑系の珍しい花色')
    elif any(k in color for k in ['紫紅', '紅紫', '濃紅紫']):
        raw += 2; reasons.append('紫紅色の花')
    elif '濃紅' in color:
        raw += 1; reasons.append('濃紅色の花')
    if '緋' in color:
        raw += 2; reasons.append('緋色の花')

    # ── 花形 ──────────────────────────────────────────────────
    if '菊咲' in shape:
        raw += 3; reasons.append('菊咲き')
    if any(k in shape for k in ['不規則', '変わり咲き']):
        raw += 3; reasons.append('変わり咲き')
    if '半八重' in shape:
        raw += 1; reasons.append('半八重咲き')
    elif '八重' in shape:
        raw += 1; reasons.append('八重咲き')
    if '枝垂' in shape or 'しだれ' in shape:
        raw += 1; reasons.append('枝垂れ')

    # ── 開花特性 ──────────────────────────────────────────────
    start = bp.get('start') or ''
    if bp.get('secondary'):
        raw += 3; reasons.append('二季咲き（春と秋に開花）')
    if start.startswith('01-') or start.startswith('02-'):
        raw += 2; reasons.append('極早咲き（1〜2月）')
    if any(start.startswith(m) for m in ['10-', '11-', '12-']):
        raw += 3; reasons.append('秋冬咲き（10〜12月）')

    # ── 指定・希少性 ───────────────────────────────────────────
    if '天然記念物' in tags_str:
        raw += 3; reasons.append('国指定天然記念物')
    if any(k in feat for k in ['種苗法', '品種登録']):
        raw += 1; reasons.append('品種登録品')
    if any(k in feat for k in ['一本桜', '原木', '唯一現存', '唯一の']):
        raw += 2; reasons.append('一本桜・原木')
    if '野生種' in tags_str:
        raw += 1; reasons.append('野生種')
    if any(k in feat for k in ['新種', '新発見', '2016年発見', '2017年発見', '2018年発見']):
        raw += 2; reasons.append('新種・新発見')

    # ── 花弁数 ────────────────────────────────────────────────
    petals = extract_petal_count(feat)
    if petals >= 200:
        raw += 4; reasons.append(f'超多弁（{petals}枚以上）')
    elif petals >= 100:
        raw += 3; reasons.append(f'多弁（{petals}枚以上）')
    elif petals >= 50:
        raw += 2; reasons.append(f'多弁（{petals}枚）')
    elif petals >= 20:
        raw += 1; reasons.append(f'やや多弁（{petals}枚）')

    # ── 普及度マイナス ─────────────────────────────────────────
    if name in ['染井吉野', '河津桜', '八重桜']:
        raw -= 2
    if '荒川堤' in tags_str:
        raw -= 1

    # ── rawスコア → 5段階 ───────────────────────────────────
    raw = max(raw, 0)
    for threshold, score, stars, label in STAR_MAP:
        if raw >= threshold:
            break

    # ★の品種はreasons不要
    if score == 1:
        reasons = []

    return raw, score, stars, label, reasons

# ── 実行 ─────────────────────────────────────────────────────
dist = {1:0, 2:0, 3:0, 4:0, 5:0}
csv_rows = []

SPOTLIGHT = {'御衣黄', '兼六園菊桜', 'クマノザクラ', '染井吉野', '河津桜',
             '兼六園熊谷', '鬱金', '思川', 'アーコレード', '蘭蘭'}

for v in varieties:
    raw, score, stars, label, reasons = score_variety(v)
    v['rarity'] = {
        'score':   score,
        'stars':   stars,
        'label':   label,
        'reasons': reasons,
    }
    dist[score] += 1
    csv_rows.append([v['id'], v['name'], raw, stars, label, '|'.join(reasons)])

    if v['name'] in SPOTLIGHT:
        print(f"  {v['name']:20s} raw={raw:3d}  {stars}  {label}")
        if reasons: print(f"    reasons: {reasons}")

# ── 分布確認・閾値調整 ─────────────────────────────────────────
total = len(varieties)
print(f"\n--- 初回分布 ---")
for s in range(1, 6):
    bar = '★'*s + '  '*(5-s)
    print(f"  {bar}: {dist[s]:4d}品種 ({dist[s]/total*100:5.1f}%)")

star1_pct = dist[1] / total * 100
star5_pct = dist[5] / total * 100

if False and (star1_pct > 50 or star5_pct > 10):  # 閾値固定済みのため無効
    print(f"\n⚠ 分布偏り検出 (★={star1_pct:.1f}%, ★★★★★={star5_pct:.1f}%)")
    print("  閾値を自動調整します...")

    # 全品種のrawスコアを集計して分位数ベースで閾値再設定
    all_raws = []
    for v in varieties:
        raw, *_ = score_variety(v)
        all_raws.append(raw)
    all_raws.sort()

    # 目標分布: ★20%, ★★35%, ★★★25%, ★★★★15%, ★★★★★5%
    p20 = all_raws[int(total * 0.20)]
    p55 = all_raws[int(total * 0.55)]
    p80 = all_raws[int(total * 0.80)]
    p95 = all_raws[int(total * 0.95)]
    print(f"  分位数閾値: p20={p20}, p55={p55}, p80={p80}, p95={p95}")

    NEW_STAR_MAP = [
        (p95, 5, "★★★★★", "激レア"),
        (p80, 4, "★★★★",  "とても珍しい"),
        (p55, 3, "★★★",   "珍しい"),
        (p20, 2, "★★",    "やや珍しい"),
        (0,   1, "★",     "よく見る"),
    ]

    dist = {1:0, 2:0, 3:0, 4:0, 5:0}
    csv_rows = []
    for v in varieties:
        raw, _, _, _, reasons = score_variety(v)
        raw = max(raw, 0)
        for threshold, score, stars, label in NEW_STAR_MAP:
            if raw >= threshold:
                break
        if score == 1:
            reasons = []
        v['rarity'] = {'score': score, 'stars': stars, 'label': label, 'reasons': reasons}
        dist[score] += 1
        csv_rows.append([v['id'], v['name'], raw, stars, label, '|'.join(reasons)])

    print("\n--- 調整後分布 ---")
    for s in range(1, 6):
        bar = '★'*s + '  '*(5-s)
        print(f"  {bar}: {dist[s]:4d}品種 ({dist[s]/total*100:5.1f}%)")

# ── 保存 ─────────────────────────────────────────────────────
with open(VAR_PATH, 'w', encoding='utf-8') as f:
    json.dump(varieties, f, ensure_ascii=False, indent=2)
print(f"\nvarieties.json 保存完了 ({total}品種)")

with open(CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['id', 'name', 'raw_score', 'stars', 'label', 'reasons'])
    w.writerows(csv_rows)
print(f"CSV: {CSV_PATH} ({len(csv_rows)}行)")

print("\n=== スポットライト品種 ===")
for row in csv_rows:
    if row[1] in SPOTLIGHT:
        print(f"  {row[1]:20s}  raw={row[2]:3d}  {row[3]}  {row[5][:60]}")
