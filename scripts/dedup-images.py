#!/usr/bin/env python3
"""
dedup-images.py — public/images/ 内の重複画像を検出・削除し varieties.json を更新
重複グループ内で features 文字数最多の品種に画像を残し、他から削除。
"""
import os, json, hashlib, csv, shutil
from collections import defaultdict

ROOT       = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
IMAGES_DIR = os.path.join(ROOT, 'public', 'images')
VAR_PATH   = os.path.join(ROOT, 'src', 'data', 'varieties.json')
CSV_PATH   = os.path.join(ROOT, 'scripts', 'duplicate_images_report.csv')

# ── varieties.json 読み込み ──────────────────────────────────────────────────
varieties = json.loads(open(VAR_PATH, encoding='utf-8').read())
var_by_id = {v['id']: v for v in varieties}

def features_len(variety_id: str) -> int:
    v = var_by_id.get(variety_id, {})
    features_text = v.get('features') or ''
    return len(features_text)

# ── SHA256 計算 ─────────────────────────────────────────────────────────────
print("SHA256 計算中...")
hash_to_files: dict[str, list[tuple[str, str]]] = defaultdict(list)
# (variety_id, filename) のリスト

total = 0
for variety_id in os.listdir(IMAGES_DIR):
    img_dir = os.path.join(IMAGES_DIR, variety_id)
    if not os.path.isdir(img_dir):
        continue
    for fname in sorted(os.listdir(img_dir)):
        if not fname.endswith('.webp'):
            continue
        fpath = os.path.join(img_dir, fname)
        h = hashlib.sha256(open(fpath, 'rb').read()).hexdigest()
        hash_to_files[h].append((variety_id, fname))
        total += 1

print(f"  {total} ファイルをスキャン")

# ── 重複グループ抽出 ─────────────────────────────────────────────────────────
dup_groups = {h: files for h, files in hash_to_files.items() if len(files) > 1}
print(f"  重複ハッシュ: {len(dup_groups)} グループ, 重複ファイル延べ: {sum(len(v) for v in dup_groups.values())} 件")

# ── 処理 ─────────────────────────────────────────────────────────────────────
csv_rows = []
deleted_count = 0
kept_count    = 0

for sha, file_list in sorted(dup_groups.items()):
    # 品種IDごとにまとめる（同一品種内の別ファイルが同一ハッシュの場合も考慮）
    variety_ids = list(dict.fromkeys(vid for vid, _ in file_list))  # 順序保持・重複除去

    # features 文字数で降順ソート → 最多を keeper に
    variety_ids_sorted = sorted(variety_ids, key=lambda vid: features_len(vid), reverse=True)
    keeper_id = variety_ids_sorted[0]
    losers    = variety_ids_sorted[1:]

    keeper_flen = features_len(keeper_id)

    for variety_id, fname in file_list:
        fpath = os.path.join(IMAGES_DIR, variety_id, fname)
        is_keeper = (variety_id == keeper_id)
        action = 'KEEP' if is_keeper else 'DELETE'

        csv_rows.append([
            sha[:16],
            variety_id,
            fname,
            action,
            keeper_id,
            features_len(variety_id),
        ])

        if not is_keeper:
            # ファイル削除
            if os.path.exists(fpath):
                os.remove(fpath)
                deleted_count += 1
        else:
            kept_count += 1

    # varieties.json 更新: loser の images 配列から該当エントリを削除
    for loser_id in losers:
        loser_files_in_group = [fname for vid, fname in file_list if vid == loser_id]
        v = var_by_id.get(loser_id)
        if not v:
            continue
        remaining = []
        for img in v.get('images', []):
            img_fname = os.path.basename(img.get('file', ''))
            if img_fname in loser_files_in_group:
                pass  # 削除
            else:
                remaining.append(img)
        v['images'] = remaining
        # 残ったファイルでリネーム（01, 02, 03 の連番を詰める）
        img_dir = os.path.join(IMAGES_DIR, loser_id)
        existing_webp = sorted(f for f in os.listdir(img_dir) if f.endswith('.webp')) if os.path.isdir(img_dir) else []
        # images配列もリセット（収集スクリプトが付与した file パスに合わせる）
        for i, img_entry in enumerate(v['images']):
            expected_fname = f"{i+1:02d}.webp"
            # 実ファイルが別名なら rename
            actual_fname = os.path.basename(img_entry.get('file', ''))
            if actual_fname != expected_fname and actual_fname in existing_webp:
                src = os.path.join(img_dir, actual_fname)
                dst = os.path.join(img_dir, expected_fname)
                if src != dst and not os.path.exists(dst):
                    os.rename(src, dst)
            img_entry['file'] = f"images/{loser_id}/{i+1:02d}.webp"

        v['hasImage'] = len(v['images']) > 0

# ── varieties.json 保存 ────────────────────────────────────────────────────
with open(VAR_PATH, 'w', encoding='utf-8') as f:
    json.dump(varieties, f, ensure_ascii=False, indent=2)
print(f"\nvarieties.json 更新完了")

# ── CSV 出力 ───────────────────────────────────────────────────────────────
with open(CSV_PATH, 'w', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerow(['sha256_prefix', 'variety_id', 'filename', 'action', 'keeper_id', 'features_len'])
    w.writerows(csv_rows)
print(f"CSV: {CSV_PATH} ({len(csv_rows)} 行)")

# ── サマリー ─────────────────────────────────────────────────────────────────
print(f"\n── サマリー ─────────────────────────")
print(f"  重複グループ: {len(dup_groups)} 件")
print(f"  削除ファイル: {deleted_count} 件")
print(f"  保持ファイル: {kept_count} 件（代表）")

# 更新後のhasImage件数
after_has = sum(1 for v in varieties if v.get('hasImage'))
print(f"  hasImage=True: {after_has} / {len(varieties)} 品種")

# 重複グループTOP5
print(f"\n重複グループ例（先頭5件）:")
for sha, file_list in list(sorted(dup_groups.items()))[:5]:
    ids = list(dict.fromkeys(vid for vid, _ in file_list))
    print(f"  {sha[:16]}... {ids}")
