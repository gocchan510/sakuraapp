"""
spots.json を繁体字中国語に翻訳して spots_zh-TW.json を生成するスクリプト。
並列処理（10スレッド）+ チェックポイント保存付き。
"""

import json, time, os, sys, io
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from deep_translator import GoogleTranslator

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_PATH  = os.path.join(BASE_DIR, 'src', 'data', 'spots.json')
OUTPUT_PATH = os.path.join(BASE_DIR, 'src', 'data', 'spots_zh-TW.json')
CKPT_PATH   = os.path.join(BASE_DIR, 'scripts', 'translate_spots_ckpt.json')

TRANSLATE_FIELDS = ['name', 'city', 'address', 'varietyNote', 'peakMonth']
WORKERS = 10
BATCH_SAVE = 100
lock = threading.Lock()

PREF_MAP = {
    '北海道': '北海道',    '青森県': '青森縣',    '岩手県': '岩手縣',
    '宮城県': '宮城縣',    '秋田県': '秋田縣',    '山形県': '山形縣',
    '福島県': '福島縣',    '茨城県': '茨城縣',    '栃木県': '栃木縣',
    '群馬県': '群馬縣',    '埼玉県': '埼玉縣',    '千葉県': '千葉縣',
    '東京都': '東京都',    '神奈川県': '神奈川縣', '新潟県': '新潟縣',
    '富山県': '富山縣',    '石川県': '石川縣',    '福井県': '福井縣',
    '山梨県': '山梨縣',    '長野県': '長野縣',    '岐阜県': '岐阜縣',
    '静岡県': '靜岡縣',    '愛知県': '愛知縣',    '三重県': '三重縣',
    '滋賀県': '滋賀縣',    '京都府': '京都府',    '大阪府': '大阪府',
    '兵庫県': '兵庫縣',    '奈良県': '奈良縣',    '和歌山県': '和歌山縣',
    '鳥取県': '鳥取縣',    '島根県': '島根縣',    '岡山県': '岡山縣',
    '広島県': '廣島縣',    '山口県': '山口縣',    '徳島県': '德島縣',
    '香川県': '香川縣',    '愛媛県': '愛媛縣',    '高知県': '高知縣',
    '福岡県': '福岡縣',    '佐賀県': '佐賀縣',    '長崎県': '長崎縣',
    '熊本県': '熊本縣',    '大分県': '大分縣',    '宮崎県': '宮崎縣',
    '鹿児島県': '鹿兒島縣','沖縄県': '沖繩縣',
}

def tr(text, retries=3):
    if not text or not str(text).strip():
        return text
    for attempt in range(retries):
        try:
            t = GoogleTranslator(source='ja', target='zh-TW')
            return t.translate(str(text))
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(1 + attempt)
            else:
                return text  # 全失敗→原文

def translate_spot(spot):
    translated = dict(spot)
    translated['prefecture'] = PREF_MAP.get(spot.get('prefecture', ''), spot.get('prefecture', ''))
    for field in TRANSLATE_FIELDS:
        val = spot.get(field)
        if val:
            translated[field] = tr(val)
    if spot.get('features'):
        translated['features'] = [tr(f) for f in spot['features']]
    return translated

def load_checkpoint():
    if os.path.exists(CKPT_PATH):
        with open(CKPT_PATH, encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_checkpoint(done):
    with open(CKPT_PATH, 'w', encoding='utf-8') as f:
        json.dump(done, f, ensure_ascii=False, indent=2)

def main():
    with open(INPUT_PATH, encoding='utf-8') as f:
        spots = json.load(f)

    done = load_checkpoint()
    done_ids = set(done.keys())
    pending = [s for s in spots if s['id'] not in done_ids]

    print(f"総スポット数: {len(spots)}  翻訳済み: {len(done)}  残り: {len(pending)}")
    if not pending:
        print("すべて翻訳済み。出力ファイルを生成します。")
    else:
        counter = {'n': len(done)}
        start = time.time()

        with ThreadPoolExecutor(max_workers=WORKERS) as executor:
            futures = {executor.submit(translate_spot, spot): spot for spot in pending}
            for future in as_completed(futures):
                spot = futures[future]
                try:
                    result = future.result()
                except Exception as e:
                    print(f"  ⚠ エラー {spot['id']}: {e}")
                    result = spot
                with lock:
                    done[result['id']] = result
                    counter['n'] += 1
                    n = counter['n']
                    elapsed = time.time() - start
                    rate = (n - len(done) + len(pending) - len(pending) + n) / max(elapsed, 1)
                    remaining = (len(spots) - n) / max((n - (len(done) - len(pending))) / max(elapsed, 0.001), 0.001)
                    print(f"[{n}/{len(spots)}] {result.get('name','')[:30]}  残り約{remaining:.0f}秒")
                    if n % BATCH_SAVE == 0:
                        save_checkpoint(done)
                        print(f"  💾 チェックポイント保存 ({n}件)")

    # 元の順序で出力
    id_map = {v['id']: v for v in done.values()}
    ordered = [id_map[s['id']] for s in spots if s['id'] in id_map]

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)
    save_checkpoint(done)
    print(f"\n✅ 完了！ → {OUTPUT_PATH}  ({len(ordered)}件)")

if __name__ == '__main__':
    main()
