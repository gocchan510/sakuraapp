#!/usr/bin/env python3
"""
enrich-spots.py — spots.json データ修正・品種紐付け強化
Tasks 1-5: 欠落追加、重複マージ、品種強化、一本桜紐付け、自動推定
"""
import json, re, csv
from collections import defaultdict

# ── パス ─────────────────────────────────────────────────────────────────
import os, sys
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SPOTS_PATH     = os.path.join(ROOT, 'src/data/spots.json')
VARIETIES_PATH = os.path.join(ROOT, 'src/data/varieties.json')
LOG_PATH       = os.path.join(ROOT, 'scripts/spot_enrichment_log.csv')

# ── 読み込み ──────────────────────────────────────────────────────────────
spots     = json.loads(open(SPOTS_PATH,     encoding='utf-8').read())
varieties = json.loads(open(VARIETIES_PATH, encoding='utf-8').read())

before_count   = len(spots)
before_variety = sum(1 for s in spots if s.get('varieties'))
print(f"Before: {before_count} spots, {before_variety} with varieties ({before_variety/before_count*100:.1f}%)")

# ── 品種逆引きインデックス ─────────────────────────────────────────────────
def nrm(s):
    """正規化: 空白除去・全角→半角・小文字"""
    if not s: return ''
    s = s.strip().replace('\u3000', '').replace(' ', '').replace('　', '')
    s = ''.join(chr(ord(c) - 0xFEE0) if '\uFF01' <= c <= '\uFF5E' else c for c in s)
    return s.lower()

variety_index = {}  # 正規化名 → id
for v in varieties:
    for key in [v.get('name',''), v.get('reading',''), *v.get('aliases', [])]:
        k = nrm(key)
        if k:
            variety_index[k] = v['id']

def resolve(names):
    """品種名リスト → (ids, unresolved)"""
    ids, unresolved = [], []
    for name in names:
        name = re.sub(r'[（(][^）)]*[）)]', '', name).strip()  # 括弧内除去
        k = nrm(name)
        if k in variety_index:
            vid = variety_index[k]
            if vid not in ids: ids.append(vid)
        elif name and len(name) >= 2:
            unresolved.append(name)
    return ids, unresolved

# ── ログ ──────────────────────────────────────────────────────────────────
log_rows = []
def log(task, spot_id, spot_name, action, details):
    log_rows.append([task, spot_id, spot_name, action, details])

# ════════════════════════════════════════════════════════════════════════════
# Task 1: 欠落スポットの追加
# ════════════════════════════════════════════════════════════════════════════
print("\n═ Task 1: 欠落スポット追加")

MISSING_SPOTS = [
    dict(
        id='tama-forest-science',
        name='多摩森林科学園',
        prefecture='東京都', city='八王子市',
        address='東京都八王子市廿里町1833-81',
        lat=35.638, lng=139.268,
        variety_names=['ヤマザクラ','オオヤマザクラ','オオシマザクラ','エドヒガン',
                        'カスミザクラ','マメザクラ','チョウジザクラ','ミヤマザクラ',
                        'ソメイヨシノ','カンザン','ウコン','フゲンゾウ','イチヨウ','タイハク'],
        varietyCount=250,
        varietyNote='約250品種1800本。野生種・名木クローン等を保全',
        peakMonth='3月下旬〜4月下旬',
        popularity=4, category='garden',
        features=['多品種','駐車場あり'], sources=['added'],
    ),
    dict(
        id='isazawa-kubozakura',
        name='伊佐沢の久保桜',
        prefecture='山形県', city='長井市',
        address='山形県長井市上伊佐沢2027',
        lat=38.075, lng=139.980,
        variety_names=['エドヒガン'],
        varietyCount=1,
        varietyNote='樹齢約1,200年。国指定天然記念物',
        peakMonth='4月中旬',
        popularity=4, category='one_tree',
        features=['天然記念物','一本桜'], sources=['added'],
    ),
    dict(
        id='yuki-sakura-farm',
        name='日本花の会 結城農場 桜見本園',
        prefecture='茨城県', city='結城市',
        address='茨城県結城市田間2217',
        lat=36.302, lng=139.892,
        variety_names=['エドヒガン','ヤマザクラ','オオヤマザクラ','カスミザクラ',
                        'オオシマザクラ','マメザクラ','コヒガン','ベニシダレ',
                        'イチヨウ','カンザン','ヤエベニシダレ','ギョイコウ',
                        'ウコン','アマノガワ','フゲンゾウ','カンヒザクラ'],
        varietyCount=400,
        varietyNote='約400品種1000本。一般公開は例年4月上旬〜中旬',
        peakMonth='4月上旬〜中旬',
        popularity=4, category='garden',
        features=['多品種'], sources=['added'],
    ),
]

existing_by_name = {nrm(s['name']): s for s in spots}
existing_by_id   = {s['id']: s for s in spots}

t1_added = 0
for ms in MISSING_SPOTS:
    # 表記ゆれを含めて既存チェック
    already = existing_by_name.get(nrm(ms['name']))
    if not already:
        # 部分マッチも確認
        for s in spots:
            if ms['name'] in s['name'] or s['name'] in ms['name']:
                already = s
                break
    if already:
        print(f"  スキップ: '{ms['name']}' は既存 ({already['id']})")
        log('missing_spot', ms['id'], ms['name'], 'skip', f"既存: {already['id']}")
        continue

    ids, _ = resolve(ms['variety_names'])
    new_spot = {
        'id':          ms['id'],
        'name':        ms['name'],
        'prefecture':  ms['prefecture'],
        'city':        ms['city'],
        'address':     ms['address'],
        'lat':         ms['lat'],
        'lng':         ms['lng'],
        'varieties':   ids,
        'varietyCount':ms['varietyCount'],
        'varietyNote': ms['varietyNote'],
        'peakMonth':   ms['peakMonth'],
        'popularity':  ms['popularity'],
        'category':    ms['category'],
        'features':    ms['features'],
        'sources':     ms['sources'],
        'imageUrl':    None,
    }
    spots.append(new_spot)
    existing_by_id[ms['id']] = new_spot
    t1_added += 1
    print(f"  追加: '{ms['name']}' (品種{len(ids)}件)")
    log('missing_spot', ms['id'], ms['name'], 'added', f"{len(ids)}品種")

print(f"  → {t1_added}件追加")

# ════════════════════════════════════════════════════════════════════════════
# Task 2: 重複マージ
# ════════════════════════════════════════════════════════════════════════════
print("\n═ Task 2: 重複マージ")

def spot_name_key(s):
    """重複判定用の正規化キー"""
    n = s['name']
    n = re.sub(r'[\s　]', '', n)
    n = re.sub(r'の桜$|桜$', '', n)
    n = re.sub(r'\(.*?\)|（.*?）', '', n)
    return nrm(n)

name_map = defaultdict(list)
for s in spots:
    name_map[spot_name_key(s)].append(s)

to_remove = set()
t2_merged = 0

for key, group in name_map.items():
    if len(group) < 2:
        continue

    walker_spots   = [s for s in group if any('walker'   in src for src in s.get('sources', []))]
    existing_spots = [s for s in group if any('existing' in src for src in s.get('sources', []))]
    added_spots    = [s for s in group if any('added'    in src for src in s.get('sources', []))]

    if walker_spots and existing_spots:
        base   = walker_spots[0]
        others = existing_spots + walker_spots[1:]
    elif len(walker_spots) >= 2:
        base   = walker_spots[0]
        others = walker_spots[1:]
    else:
        continue

    for other in others:
        # varieties 統合
        all_v = list(dict.fromkeys([*base.get('varieties', []), *other.get('varieties', [])]))
        base['varieties'] = all_v

        # varietyCount は大きい方
        bc = base.get('varietyCount') or 0
        oc = other.get('varietyCount') or 0
        base['varietyCount'] = max(bc, oc) or None

        # lat/lng: Walker+優先（base が Walker+ なのでそのまま。なければ other から）
        if not base.get('lat') and other.get('lat'):
            base['lat'] = other['lat']
            base['lng'] = other['lng']

        # features 統合
        base['features'] = list(dict.fromkeys([*base.get('features', []), *other.get('features', [])]))

        # sources 統合
        base['sources'] = list(dict.fromkeys([*base.get('sources', []), *other.get('sources', [])]))

        # 既存データのレガシーフィールドを保持
        for field in ['travelTime', 'within1hour', 'inMetro', 'comment', 'peakWeeks']:
            if base.get(field) is None and other.get(field) is not None:
                base[field] = other[field]

        to_remove.add(id(other))
        t2_merged += 1
        log('duplicate', base['id'], base['name'], 'merged', f"{base['id']} ← {other['id']}")

spots = [s for s in spots if id(s) not in to_remove]
print(f"  → {t2_merged}件マージ (残{len(spots)}件)")

# ════════════════════════════════════════════════════════════════════════════
# Task 3: 主要スポットの品種強化
# ════════════════════════════════════════════════════════════════════════════
print("\n═ Task 3: 主要スポット品種強化")

ENRICHMENTS = {
    '造幣局': dict(
        variety_names=['関山','松月','普賢象','楊貴妃','一葉','福禄寿','大手毬',
                       '小手毬','紅手毬','大提灯','鬱金','御衣黄','養老','東錦',
                       '天城吉野','天の川','雨宿','浮牡丹','菊桜','衣笠',
                       '兼六園菊桜','紅豊','須磨浦普賢象','千原桜','長州緋桜',
                       '蘭蘭','旭山','雨情枝垂','思川','御殿場','染井吉野',
                       'オオシマザクラ','ヤマザクラ'],
        varietyCount=140,
    ),
    '上野恩賜公園': dict(
        variety_names=['ソメイヨシノ','カンザクラ','オオカンザクラ','カンヒザクラ',
                       'ヤマザクラ','オオシマザクラ','エドヒガン','コマツオトメ',
                       'ヨウコウ','松月','御衣黄','関山','一葉','天の川',
                       'ヤエベニシダレ','普賢象','鬱金','シダレザクラ','コヒガン',
                       'アケボノ','福禄寿','カワヅザクラ','ベニシダレ','秋色桜'],
        varietyCount=55,
    ),
    '高遠城址公園': dict(
        variety_names=['タカトオコヒガンザクラ','コヒガン','エドヒガン','マメザクラ','ヤマザクラ'],
        varietyCount=5,
    ),
    '千鳥ヶ淵': dict(
        variety_names=['ソメイヨシノ','ヤマザクラ','オオシマザクラ','カンザクラ',
                       'エドヒガン','オカメザクラ','イチヨウ','カンヒザクラ','ベニシダレ'],
        varietyCount=None,
    ),
    '吉野山': dict(
        variety_names=['シロヤマザクラ','ヤマザクラ','カスミザクラ','タカネザクラ'],
        varietyCount=None,
    ),
    '醍醐寺': dict(
        variety_names=['カワヅザクラ','シダレザクラ','ベニシダレ','ソメイヨシノ',
                       'ヤマザクラ','オオヤマザクラ'],
        varietyCount=None,
    ),
    '姫路城': dict(
        variety_names=['ソメイヨシノ','シダレザクラ','ヤマザクラ'],
        varietyCount=None,
    ),
    '熊本城': dict(
        variety_names=['ソメイヨシノ','ヤマザクラ','シダレザクラ','ベニシダレ',
                       '関山','御衣黄','鬱金','オオシマザクラ'],
        varietyCount=None,
    ),
    '松前公園': dict(
        variety_names=['ソメイヨシノ','エゾヤマザクラ','糸括','関山','雨宿',
                       '鬱金','南殿','オオヤマザクラ','オオシマザクラ','白絹',
                       '翁桜','養老桜','花香琴','大和錦','松前早咲','松前富貴','松前'],
        varietyCount=250,
    ),
    '弘前公園': dict(
        variety_names=['ソメイヨシノ','シダレザクラ','ヤエベニシダレ','ヤマザクラ',
                       'オオヤマザクラ','カスミザクラ','エドヒガン','コヒガン',
                       'オオシマザクラ','鬱金','松月','関山','普賢象','御衣黄','一葉','東錦'],
        varietyCount=52,
    ),
    '平野神社': dict(
        variety_names=['魁','平野寝覚','手弱女','突羽根','衣笠','胡蝶','嵐山',
                       '虎の尾','松月','御衣黄','八重紅枝垂','ソメイヨシノ',
                       'ヤマザクラ','シダレザクラ','オオシマザクラ','エドヒガン',
                       'カワズザクラ','カンザクラ'],
        varietyCount=60,
    ),
    '二条城': dict(
        variety_names=['カンヒザクラ','ソメイヨシノ','ヤマザクラ','シダレザクラ','ヤエベニシダレ'],
        varietyCount=50,
    ),
    '京都府立植物園': dict(
        variety_names=['カンヒザクラ','カンザクラ','ツバキカンザクラ','カワヅザクラ',
                       'オカメザクラ','ソメイヨシノ','ヤマザクラ','オオシマザクラ',
                       'オオヤマザクラ','エドヒガン','シダレザクラ','ヤエベニシダレ',
                       'ヨウコウ','アマノガワ','一葉','普賢象','関山','松月',
                       '楊貴妃','白妙','鬱金','御衣黄','タイハク'],
        varietyCount=180,
    ),
    '花見山': dict(
        variety_names=['ジュウガツザクラ','トウカイザクラ','ヒガンザクラ','カンヒザクラ',
                       'オカメザクラ','ソメイヨシノ','アマノガワ','鬱金'],
        varietyCount=None,
    ),
    '五稜郭': dict(
        variety_names=['ソメイヨシノ','シダレザクラ','ヤマザクラ'],
        varietyCount=None,
    ),
    '多摩森林科学園': dict(
        variety_names=['ヤマザクラ','オオヤマザクラ','オオシマザクラ','エドヒガン',
                       'カスミザクラ','マメザクラ','チョウジザクラ','ミヤマザクラ',
                       'ソメイヨシノ','カンザン','ウコン','フゲンゾウ','イチヨウ','タイハク'],
        varietyCount=250,
    ),
}

t3_count = 0
for spot in spots:
    for keyword, data in ENRICHMENTS.items():
        if keyword not in spot['name']:
            continue
        ids, unresolved = resolve(data['variety_names'])
        before_len = len(spot.get('varieties', []))
        merged = list(dict.fromkeys([*spot.get('varieties', []), *ids]))
        spot['varieties'] = merged
        added_count = len(merged) - before_len

        if data.get('varietyCount'):
            cur = spot.get('varietyCount') or 0
            if data['varietyCount'] > cur:
                spot['varietyCount'] = data['varietyCount']

        if added_count > 0:
            t3_count += added_count
            log('enrichment', spot['id'], spot['name'], 'varieties_updated',
                f"+{added_count}品種 (計{len(merged)}件, 未解決:{unresolved[:3]})")
            print(f"  {spot['name']}: +{added_count}品種 → 計{len(merged)}件")

print(f"  → {t3_count}品種追加")

# ════════════════════════════════════════════════════════════════════════════
# Task 4: 一本桜への品種自動紐付け
# ════════════════════════════════════════════════════════════════════════════
print("\n═ Task 4: 一本桜への品種紐付け")

ONE_TREE_MAP = {
    '三春滝桜':   ['ベニシダレ','エドヒガン'],
    '神代桜':     ['エドヒガン'],
    '山高神代':   ['エドヒガン'],
    '淡墨桜':     ['エドヒガン'],
    '根尾谷':     ['エドヒガン'],
    '石戸蒲桜':   ['カバザクラ','エドヒガン'],
    '醍醐桜':     ['エドヒガン'],
    '狩宿の下馬': ['ヤマザクラ'],
    '臥龍桜':     ['エドヒガン'],
    '荘川桜':     ['エドヒガン'],
    '久保桜':     ['エドヒガン'],
}

NAME_KW = {
    '河津桜':     ['カワヅザクラ'],
    'カワヅザクラ':['カワヅザクラ'],
    '枝垂':       ['シダレザクラ'],
    'しだれ':     ['シダレザクラ'],
    'エドヒガン': ['エドヒガン'],
    '彼岸桜':     ['エドヒガン'],
    'ヤマザクラ': ['ヤマザクラ'],
    '山桜':       ['ヤマザクラ'],
    'ソメイヨシノ':['ソメイヨシノ'],
    '染井吉野':   ['ソメイヨシノ'],
    '大山桜':     ['オオヤマザクラ'],
}

t4_count = 0
for spot in spots:
    is_one_tree = (spot.get('category') == 'one_tree' or
                   '一本桜' in spot.get('features', []))
    if not is_one_tree:
        continue
    if spot.get('varieties'):
        continue

    added = []
    text = spot['name'] + ' ' + (spot.get('varietyNote') or '')

    for kw, vnames in ONE_TREE_MAP.items():
        if kw in text:
            ids, _ = resolve(vnames)
            added.extend(ids)
    for kw, vnames in NAME_KW.items():
        if kw in text:
            ids, _ = resolve(vnames)
            added.extend(ids)

    added = list(dict.fromkeys(added))
    if added:
        spot['varieties'] = added
        t4_count += 1
        log('one_tree', spot['id'], spot['name'], 'variety_linked', '+'.join(added))

print(f"  → {t4_count}件紐付け")

# ════════════════════════════════════════════════════════════════════════════
# Task 5: 品種0件スポットの自動推定
# ════════════════════════════════════════════════════════════════════════════
print("\n═ Task 5: 品種0件の自動推定")

AUTO_MAP = {
    '河津桜':     'kawaduzakura',
    'カワヅザクラ':'kawaduzakura',
    '枝垂桜':     'shidarezakura',
    'しだれ桜':   'shidarezakura',
    'シダレザクラ':'shidarezakura',
    'ソメイヨシノ':'someiyoshino',
    '染井吉野':   'someiyoshino',
    'ヤマザクラ': 'yamazakura',
    '山桜':       'yamazakura',
    'オオヤマザクラ':'ooyamazakura',
    '大山桜':     'ooyamazakura',
    'エゾヤマザクラ':'ezoyamazakura',
    '蝦夷山桜':   'ezoyamazakura',
    'エドヒガン': 'edohigan-zakura',
    '彼岸桜':     'higanzakura',
    'コヒガン':   'kohigan',
}

t5_count = 0
for spot in spots:
    if spot.get('varieties'):
        continue
    text = (spot['name'] + ' ' +
            (spot.get('varietyNote') or '') + ' ' +
            (spot.get('peakMonth') or ''))
    estimated = list(dict.fromkeys(
        vid for kw, vid in AUTO_MAP.items() if kw in text
    ))
    if estimated:
        spot['varieties'] = estimated
        t5_count += 1
        log('auto_estimate', spot['id'], spot['name'], 'variety_estimated',
            '+'.join(estimated))

print(f"  → {t5_count}件推定")

# ════════════════════════════════════════════════════════════════════════════
# 最終検証
# ════════════════════════════════════════════════════════════════════════════
print("\n═ 最終検証")

# 1. 重複ID
ids = [s['id'] for s in spots]
dup_ids = {x for x in ids if ids.count(x) > 1}
if dup_ids:
    print(f"  ✗ 重複ID: {dup_ids}")
else:
    print(f"  ✓ 重複ID: 0件")

# 2. 47都道府県
PREFS_47 = ['北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県',
            '茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県',
            '新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県',
            '静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県',
            '奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県',
            '徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県',
            '熊本県','大分県','宮崎県','鹿児島県','沖縄県']
covered = {s['prefecture'] for s in spots}
missing_p = [p for p in PREFS_47 if p not in covered]
status = '✓' if not missing_p else f'✗ 欠: {missing_p}'
print(f"  都道府県カバレッジ: {47 - len(missing_p)}/47 {status}")

# 3. 造幣局・多摩森林科学園の品種数
for kw, min_v in [('造幣局', 100), ('多摩森林科学園', 100)]:
    s = next((x for x in spots if kw in x['name']), None)
    if s:
        v = len(s.get('varieties', []))
        print(f"  {kw}: varieties={v} {'✓' if v >= min_v else '✗'}")
    else:
        print(f"  {kw}: NOT FOUND ✗")

# 4. 三春滝桜・山高神代桜
for name in ['三春滝桜', '山高神代桜', '神代桜']:
    s = next((x for x in spots if name in x['name']), None)
    if s:
        print(f"  {name}: {s.get('varieties', [])} ({'✓' if s.get('varieties') else '✗'})")

after_count   = len(spots)
after_variety = sum(1 for s in spots if s.get('varieties'))
print(f"\nAfter: {after_count} spots, {after_variety} with varieties ({after_variety/after_count*100:.1f}%)")
print(f"  Task1 追加: {t1_added}件")
print(f"  Task2 マージ: {t2_merged}件")
print(f"  Task3 品種追加: {t3_count}品種（延べ）")
print(f"  Task4 一本桜紐付け: {t4_count}件")
print(f"  Task5 自動推定: {t5_count}件")

# ── 保存 ─────────────────────────────────────────────────────────────────
with open(SPOTS_PATH, 'w', encoding='utf-8') as f:
    json.dump(spots, f, ensure_ascii=False, indent=2)
print(f"\nspots.json 保存完了")

with open(LOG_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['task','spot_id','spot_name','action','details'])
    writer.writerows(log_rows)
print(f"ログ: {LOG_PATH} ({len(log_rows)}件)")
