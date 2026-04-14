#!/usr/bin/env python3
"""
Web検索によるスポット品種情報の充実化スクリプト

使い方: python web_enrich_varieties.py [--start-id SPOT_ID] [--max N]

依存: pip install requests
"""
import json
import re
import os
import sys
import time
import csv
import unicodedata
from datetime import datetime

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("WARNING: requests not installed. Using urllib.")
    import urllib.request
    import urllib.parse

# ── パス ─────────────────────────────────────────────────────────────────
ROOT = r'C:\Users\pcyus\Documents\sakura-app'
SPOTS_FILE = os.path.join(ROOT, 'src', 'data', 'spots.json')
VARIETIES_FILE = os.path.join(ROOT, 'src', 'data', 'varieties.json')
PROGRESS_FILE = os.path.join(ROOT, 'scripts', 'spot_enrichment_progress.json')
LOG_FILE = os.path.join(ROOT, 'scripts', 'spot_variety_log.csv')

# ── スキップするスポット ───────────────────────────────────────────────────
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

# ── 正規化関数 ─────────────────────────────────────────────────────────────
def normalize(s):
    if not s:
        return ''
    s = unicodedata.normalize("NFKC", s)
    s = s.strip()
    # 全角スペース・半角スペース除去
    s = re.sub(r'[\s\u3000]+', '', s)
    s = s.lower()
    # 末尾の桜/ザクラ/ざくら除去
    s = re.sub(r'[桜ザクラざくら]+$', '', s)
    return s

# ── 品種マップ構築 ──────────────────────────────────────────────────────────
def build_variety_map(varieties):
    vmap = {}
    for v in varieties:
        vid = v['id']
        # name
        k = normalize(v.get('name', ''))
        if k:
            vmap[k] = vid
        # reading
        k = normalize(v.get('reading', ''))
        if k:
            vmap[k] = vid
        # aliases
        for alias in v.get('aliases', []):
            k = normalize(alias)
            if k:
                vmap[k] = vid
    return vmap

# ── 品種名 → ID変換 ─────────────────────────────────────────────────────────
def find_variety_id(name_str, vmap):
    if not name_str:
        return None
    # 括弧内除去
    name_str = re.sub(r'[（(][^）)]*[）)]', '', name_str).strip()
    key = normalize(name_str)
    if key in vmap:
        return vmap[key]
    # 末尾バリエーション試行
    for suffix in ['の花', 'の桜', 'ざくら', 'さくら', 'サクラ', 'ザクラ']:
        if key.endswith(suffix):
            k2 = key[:-len(suffix)]
            if k2 in vmap:
                return vmap[k2]
    return None

# ── テキストから品種抽出 ────────────────────────────────────────────────────
# 一般的な品種名パターン
KNOWN_VARIETY_NAMES = [
    "ソメイヨシノ", "染井吉野",
    "オオシマザクラ", "大島桜", "大シマザクラ",
    "ヤマザクラ", "山桜",
    "シダレザクラ", "枝垂桜", "枝垂れ桜", "しだれ桜",
    "ヤエザクラ", "八重桜",
    "カワヅザクラ", "河津桜", "河津ザクラ",
    "ヒカンザクラ", "緋寒桜",
    "ヒガンザクラ", "彼岸桜",
    "カスミザクラ", "霞桜",
    "オオヤマザクラ", "大山桜",
    "エゾヤマザクラ", "蝦夷山桜",
    "カンヒザクラ", "寒緋桜",
    "コヒガンザクラ", "小彼岸桜",
    "ケイオウザクラ", "啓翁桜",
    "コシノヒガン", "越彼岸",
    "カンザン", "関山",
    "ギョイコウ", "御衣黄",
    "ウコン", "鬱金",
    "イチヨウ", "一葉",
    "フゲンゾウ", "普賢象",
    "アマノガワ", "天の川",
    "タイハク", "大白",
    "シロタエ", "白妙",
    "ショウゲツ", "松月",
    "オモイガワ", "思川",
    "ジュウガツザクラ", "十月桜",
    "コブクザクラ", "子福桜",
    "シキザクラ", "四季桜",
    "ベニシダレ", "紅枝垂",
    "ヤエベニシダレ", "八重紅枝垂",
    "ヨウコウ", "陽光",
    "ジンダイアケボノ", "神代曙",
    "アケボノ", "曙",
    "エドヒガン", "江戸彼岸",
    "マメザクラ", "豆桜",
    "タカトオコヒガンザクラ", "高遠小彼岸桜",
    "コヒガン", "小彼岸",
    "ウスズミザクラ", "淡墨桜",
    "イトザクラ", "糸桜",
    "スミゾメ", "墨染",
    "フクロクジュ", "福禄寿",
    "ミクルマガエシ", "御車返し",
    "チョウジザクラ", "丁字桜",
    "ベニヨシノ", "紅吉野",
    "センダイヤ", "仙台屋",
    "ハルメキ", "春めき",
    "タイワンヒカンザクラ", "台湾緋寒桜",
    "シュゼンジカンザクラ", "修善寺寒桜",
    "コマツオトメ", "小松乙女",
    "オカメ",
    "サトザクラ", "里桜",
    "マキノザクラ", "牧野桜",
    "イトククリ", "糸括",
    "タカサゴ", "高砂",
    "チシマザクラ", "千島桜",
    "ケヤマザクラ",
    "カラミザクラ", "唐実桜",
    "シラユキ", "白雪",
    "アサヒヤマ", "旭山",
    "ミヤマザクラ", "深山桜",
    "ウスゲヨウコウ",
    "ミシマザクラ", "三島桜",
    "コウゾウ", "紅造",
    "ヤエコウゾウ", "八重紅造",
    "ハナモモ",
    "スウィートバーレーン", "スイートバーレーン",
    "フジザクラ", "富士桜",
    "ミツマタ",
    "ウバヒガン", "姥彼岸",
    "タネガシマザクラ", "種子島桜",
    "ヒナザクラ", "雛桜",
    "カワソメイヨシノ",
    "イチハラトラノオ", "市原虎の尾",
    "ウチュウ", "宇宙",
    "ショウワ", "昭和",
    "ユシマカンザクラ", "湯島寒桜",
    "ガンジツザクラ", "元日桜",
    "フユザクラ", "冬桜",
    "ランザン", "嵐山",
    "ヨシノ", "吉野",
    "ナデシコ", "撫子",
    "アカシガタザクラ",
    "マツマエギジン", "松前義人",
    "マツマエハナガサ", "松前花笠",
    "マツマエニシキ", "松前錦",
    "マツマエオトメ", "松前乙女",
    "マツマエシロタエ", "松前白妙",
    "マツマエカブサワ", "松前株沢",
    "ホウキザクラ", "帚桜",
    "タマガワ", "玉川",
    "アイズニシキ", "会津錦",
    "アイズウスズミ", "会津薄墨",
    "シラネシダレ", "白根枝垂",
    "イカリガシラ", "碇頭",
    "ナカノイチヨウ", "中野一葉",
    "ハタザクラ", "旗桜",
    "テマリ", "手毬",
]

def extract_varieties_from_text(text, vmap):
    """テキストから品種IDリストを抽出"""
    found_ids = set()

    # 既知品種名でスキャン
    for pattern in KNOWN_VARIETY_NAMES:
        if pattern in text:
            vid = find_variety_id(pattern, vmap)
            if vid:
                found_ids.add(vid)

    # 〜桜・〜ザクラ パターン
    variety_re = re.compile(
        r'([ァ-ヴーぁ-ん一-龥]{2,10}(?:桜|ザクラ|さくら)?)'
        r'(?:\s*約?\d+本|\s*\(|\s*（|\s+[がはをのにも]|、|。|「|」|\s*\n|$)'
    )
    for m in variety_re.finditer(text):
        name = m.group(1).strip()
        if len(name) >= 2:
            vid = find_variety_id(name, vmap)
            if vid:
                found_ids.add(vid)

    return list(found_ids)

def extract_variety_count(text):
    """品種数を抽出"""
    m = re.search(r'約?\s*(\d+)\s*(?:品種|種類)', text)
    if m:
        return int(m.group(1))
    return None

def extract_variety_note(text, spot_name=""):
    """本数メモを抽出"""
    notes = []
    # 品種名+本数
    for m in re.finditer(r'([ァ-ヴーぁ-ん一-龥]{2,8}(?:桜|ザクラ)?)\s*約?\s*(\d+)\s*本', text):
        notes.append(f"{m.group(1)}{m.group(2)}本")
    # 全体本数
    for m in re.finditer(r'約\s*(\d+)\s*本', text):
        val = f"約{m.group(1)}本"
        if val not in notes:
            notes.append(val)
    return "、".join(notes[:3]) if notes else None

# ── 検索関数 ────────────────────────────────────────────────────────────────
def search_web(query, num=5):
    """DuckDuckGo HTMLスクレイピングで検索"""
    snippets = []

    if HAS_REQUESTS:
        try:
            url = f"https://html.duckduckgo.com/html/?q={requests.utils.quote(query)}"
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept-Language': 'ja,en;q=0.9',
            }
            resp = requests.get(url, headers=headers, timeout=10)
            text = resp.text
            # スニペット抽出
            snippets_raw = re.findall(
                r'class="result__snippet"[^>]*>(.*?)</a>',
                text, re.DOTALL
            )
            for s in snippets_raw[:num]:
                clean = re.sub(r'<[^>]+>', '', s)
                clean = re.sub(r'\s+', ' ', clean).strip()
                snippets.append(clean)
        except Exception as e:
            print(f"  Search error: {e}")
    else:
        try:
            query_enc = urllib.parse.quote(query)
            url = f"https://html.duckduckgo.com/html/?q={query_enc}"
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0',
                'Accept-Language': 'ja,en;q=0.9',
            })
            with urllib.request.urlopen(req, timeout=10) as r:
                text = r.read().decode('utf-8', errors='replace')
            snippets_raw = re.findall(
                r'class="result__snippet"[^>]*>(.*?)</a>',
                text, re.DOTALL
            )
            for s in snippets_raw[:num]:
                clean = re.sub(r'<[^>]+>', '', s)
                clean = re.sub(r'\s+', ' ', clean).strip()
                snippets.append(clean)
        except Exception as e:
            print(f"  Search error: {e}")

    return snippets

# ── スポット名クリーンアップ ─────────────────────────────────────────────────
def clean_spot_name(name):
    """検索用にスポット名をクリーン"""
    name = re.sub(r'の桜まつり|の桜|の花見|桜まつり$|桜祭り$', '', name)
    name = re.sub(r'（[^）]*）|\([^)]*\)', '', name)
    name = name.strip()
    return name

# ── 名前からの自動品種推定 ────────────────────────────────────────────────────
def infer_from_name(spot_name, vmap):
    """スポット名から品種を推定"""
    inferred = []

    name_mappings = [
        ("河津桜", "kawazu-zakura"),
        ("カワヅザクラ", "kawazu-zakura"),
        ("枝垂", "shidarezakura"),
        ("しだれ", "shidarezakura"),
        ("シダレ", "shidarezakura"),
        ("ヒガン", "higanzakura"),
        ("彼岸", "higanzakura"),
        ("ソメイヨシノ", "someiyoshino"),
        ("染井吉野", "someiyoshino"),
        ("八重桜", "yaezakura"),
        ("ヤエザクラ", "yaezakura"),
        ("御衣黄", "gyoiko"),
        ("ギョイコウ", "gyoiko"),
        ("鬱金", "ukon"),
        ("ウコン", "ukon"),
        ("寒桜", "kanzakura"),
        ("カンザクラ", "kanzakura"),
        ("寒緋桜", "kanhizakura"),
        ("カンヒザクラ", "kanhizakura"),
        ("台湾緋寒桜", "taiwan-hikan-zakura"),
        ("淡墨", "usuzumizakura"),
        ("薄墨", "usuzumizakura"),
        ("冬桜", "fuyuzakura"),
        ("フユザクラ", "fuyuzakura"),
        ("四季桜", "shikizakura"),
        ("十月桜", "jugatsuzakura"),
        ("千島", "chishima-zakura"),
        ("チシマ", "chishima-zakura"),
        ("エゾヤマ", "ezoyamazakura"),
        ("蝦夷山", "ezoyamazakura"),
        ("オオヤマ", "ooyamazakura"),
        ("大山桜", "ooyamazakura"),
        ("山桜", "yamazakura"),
        ("ヤマザクラ", "yamazakura"),
    ]

    for keyword, vid in name_mappings:
        if keyword in spot_name:
            # vidがvmapの値に存在するか確認
            if vid in vmap.values():
                inferred.append(vid)

    return inferred

# ── メイン処理 ──────────────────────────────────────────────────────────────
def main():
    # コマンドライン引数
    start_id = None
    max_process = 100  # デフォルト100件
    for i, arg in enumerate(sys.argv[1:]):
        if arg == '--start-id' and i + 2 <= len(sys.argv) - 1:
            start_id = sys.argv[i + 2]
        elif arg == '--max' and i + 2 <= len(sys.argv) - 1:
            max_process = int(sys.argv[i + 2])

    print(f"Loading data files...")
    with open(SPOTS_FILE, encoding='utf-8') as f:
        spots = json.load(f)
    with open(VARIETIES_FILE, encoding='utf-8') as f:
        varieties = json.load(f)

    vmap = build_variety_map(varieties)
    print(f"Varieties: {len(varieties)}, Map keys: {len(vmap)}")
    print(f"Spots: {len(spots)}")

    # プログレスロード
    progress = {}
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, encoding='utf-8') as f:
            progress = json.load(f)
        print(f"Progress: {progress.get('processed', 0)} processed, last={progress.get('lastProcessedId', 'none')}")

    # ログ済みスポットID
    processed_ids = set()
    if os.path.exists(LOG_FILE):
        with open(LOG_FILE, encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get('spot_id'):
                    processed_ids.add(row['spot_id'])
    print(f"Already logged: {len(processed_ids)}")

    # ログファイル初期化
    log_exists = os.path.exists(LOG_FILE)
    log_f = open(LOG_FILE, 'a', encoding='utf-8', newline='')
    log_writer = csv.writer(log_f)
    if not log_exists:
        log_writer.writerow(['spot_id', 'spot_name', 'varieties_added', 'variety_count_found', 'note'])

    # 処理開始位置
    start_processing = (start_id is None)
    processed_this_run = 0
    updated_spots = 0

    for spot in spots:
        sid = spot['id']

        # スタートID待ち
        if not start_processing:
            if sid == start_id:
                start_processing = True
            else:
                continue

        # スキップ
        if sid in SKIP_IDS:
            continue

        # 既処理スキップ
        if sid in processed_ids:
            continue

        # すでに品種がある場合はスキップ（既存を削除しないため処理をスキップ可）
        # ただし varietyCount/varietyNote の更新は行う
        existing_varieties = set(spot.get('varieties', []))

        # 最大件数チェック
        if processed_this_run >= max_process:
            print(f"\n最大処理数 {max_process} に達しました。終了します。")
            break

        spot_name = spot.get('name', '')
        clean_name = clean_spot_name(spot_name)
        pref = spot.get('prefecture', '')

        print(f"\n[{processed_this_run+1}] {sid} / {spot_name}")

        new_ids = set()
        found_count = None
        found_note = None

        # -- 名前からの推定 --
        inferred = infer_from_name(spot_name, vmap)
        if inferred:
            new_ids.update(inferred)
            print(f"  名前から推定: {inferred}")

        # -- Web検索（すでに品種が複数ある場合はスキップ）--
        if len(existing_varieties) < 2:
            queries = [
                f"{clean_name} {pref} 桜 品種",
                f"{clean_name} 桜 種類",
            ]

            all_text = ""
            for q in queries[:2]:
                print(f"  検索: {q}")
                snippets = search_web(q)
                all_text += " ".join(snippets)
                time.sleep(1)

            if all_text:
                found_ids = extract_varieties_from_text(all_text, vmap)
                new_ids.update(found_ids)
                found_count = extract_variety_count(all_text)
                found_note = extract_variety_note(all_text, spot_name)
                if found_ids:
                    print(f"  検索で発見: {found_ids}")
                if found_count:
                    print(f"  品種数: {found_count}")

        # -- スポット更新 --
        to_add = new_ids - existing_varieties
        if to_add:
            spot['varieties'] = list(existing_varieties) + list(to_add)
            updated_spots += 1

        if found_count and not spot.get('varietyCount'):
            spot['varietyCount'] = found_count

        if found_note and not spot.get('varietyNote'):
            spot['varietyNote'] = found_note

        # ログ記録
        log_writer.writerow([
            sid, spot_name, len(to_add),
            found_count or '',
            found_note or ''
        ])
        log_f.flush()

        processed_ids.add(sid)
        processed_this_run += 1

        # 30件ごとに保存
        if processed_this_run % 30 == 0:
            print(f"\n--- 30件処理完了。保存中... ---")
            with open(SPOTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(spots, f, ensure_ascii=False, indent=2)

            progress = {
                'totalSpots': len(spots),
                'processed': len(processed_ids),
                'lastProcessedId': sid,
                'updatedAt': datetime.now().isoformat(),
            }
            with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
                json.dump(progress, f, ensure_ascii=False, indent=2)
            print(f"  saved. processed={len(processed_ids)}, updated={updated_spots}")

    # 最終保存
    print(f"\n=== 処理完了 ===")
    print(f"処理数: {processed_this_run}, 更新数: {updated_spots}")

    with open(SPOTS_FILE, 'w', encoding='utf-8') as f:
        json.dump(spots, f, ensure_ascii=False, indent=2)

    progress = {
        'totalSpots': len(spots),
        'processed': len(processed_ids),
        'lastProcessedId': spots[-1]['id'] if spots else '',
        'updatedAt': datetime.now().isoformat(),
    }
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)

    log_f.close()
    print("完了。")

if __name__ == '__main__':
    main()
