"""
spots.json を英語に翻訳して spots_en.json を生成するスクリプト。
並列処理（10スレッド）+ チェックポイント保存付き。
"""

import json, time, os, sys, io
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from deep_translator import GoogleTranslator

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_PATH  = os.path.join(BASE_DIR, 'src', 'data', 'spots.json')
OUTPUT_PATH = os.path.join(BASE_DIR, 'src', 'data', 'spots_en.json')
CKPT_PATH   = os.path.join(BASE_DIR, 'scripts', 'translate_spots_en_ckpt.json')

TRANSLATE_FIELDS = ['name', 'prefecture', 'city', 'address', 'varietyNote', 'peakMonth']
WORKERS = 10
BATCH_SAVE = 100
lock = threading.Lock()

def tr(text, retries=3):
    if not text or not str(text).strip():
        return text
    for attempt in range(retries):
        try:
            return GoogleTranslator(source='ja', target='en').translate(str(text))
        except Exception:
            if attempt < retries - 1:
                time.sleep(1 + attempt)
            else:
                return text

def translate_spot(spot):
    translated = dict(spot)
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
                    if n % BATCH_SAVE == 0:
                        save_checkpoint(done)
                        elapsed = time.time() - start
                        remaining = (len(spots) - n) / max(n / max(elapsed, 0.001), 0.001)
                        print(f"[{n}/{len(spots)}] 経過{elapsed:.0f}s 残り約{remaining:.0f}s")

    id_map = {v['id']: v for v in done.values()}
    ordered = [id_map[s['id']] for s in spots if s['id'] in id_map]

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)
    save_checkpoint(done)
    print(f"\n✅ 完了！ → {OUTPUT_PATH}  ({len(ordered)}件)")

if __name__ == '__main__':
    main()
