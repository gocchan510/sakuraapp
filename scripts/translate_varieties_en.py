"""
varieties.json を英語に翻訳して varieties_en.json を生成。
並列処理（8スレッド）+ チェックポイント保存付き。
"""

import json, time, os, sys, io
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
from deep_translator import GoogleTranslator

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_PATH  = os.path.join(BASE_DIR, 'src', 'data', 'varieties.json')
OUTPUT_PATH = os.path.join(BASE_DIR, 'src', 'data', 'varieties_en.json')
CKPT_PATH   = os.path.join(BASE_DIR, 'scripts', 'translate_varieties_en_ckpt.json')

WORKERS = 8
BATCH_SAVE = 50
lock = threading.Lock()

TEXT_FIELDS = ['name', 'bloomSeason', 'color', 'flowerShape', 'summary', 'features', 'history', 'background', 'trivia']

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

def translate_variety(v):
    t = dict(v)

    for field in TEXT_FIELDS:
        if v.get(field):
            t[field] = tr(v[field])

    if v.get('tags'):
        t['tags'] = [tr(x) for x in v['tags']]

    if v.get('rarity'):
        r = dict(v['rarity'])
        if r.get('label'):
            r['label'] = tr(r['label'])
        if r.get('reasons'):
            r['reasons'] = [tr(x) for x in r['reasons']]
        t['rarity'] = r

    if v.get('spots'):
        t['spots'] = [dict(s, spotName=tr(s['spotName'])) if s.get('spotName') else s for s in v['spots']]

    return t

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
        varieties = json.load(f)

    done = load_checkpoint()
    done_ids = set(done.keys())
    pending = [v for v in varieties if v['id'] not in done_ids]

    print(f"総品種数: {len(varieties)}  翻訳済み: {len(done)}  残り: {len(pending)}")

    if not pending:
        print("すべて翻訳済み")
    else:
        counter = [len(done)]
        start = time.time()

        with ThreadPoolExecutor(max_workers=WORKERS) as executor:
            futures = {executor.submit(translate_variety, v): v for v in pending}
            for future in as_completed(futures):
                try:
                    result = future.result()
                except Exception as e:
                    orig = futures[future]
                    print(f"エラー {orig['id']}: {e}")
                    result = orig

                with lock:
                    done[result['id']] = result
                    counter[0] += 1
                    n = counter[0]
                    if n % BATCH_SAVE == 0:
                        save_checkpoint(done)
                        elapsed = time.time() - start
                        remaining = (len(varieties) - n) / max(n / max(elapsed, 0.001), 0.001)
                        print(f"[{n}/{len(varieties)}] 経過{elapsed:.0f}s 残り約{remaining:.0f}s")

    id_map = {v['id']: v for v in done.values()}
    ordered = [id_map[v['id']] for v in varieties if v['id'] in id_map]

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)
    save_checkpoint(done)
    print(f"完了: {len(ordered)}件 -> {OUTPUT_PATH}")

if __name__ == '__main__':
    main()
