#!/usr/bin/env python3
"""
Apply variety updates to spots.json based on web research.
Run: python apply_variety_updates.py
"""
import json
import os
from datetime import datetime

ROOT = r'C:\Users\pcyus\Documents\sakura-app'
SPOTS_FILE = os.path.join(ROOT, 'src', 'data', 'spots.json')
PROGRESS_FILE = os.path.join(ROOT, 'scripts', 'spot_enrichment_progress.json')
LOG_FILE = os.path.join(ROOT, 'scripts', 'spot_variety_log.csv')

# ── Updates dictionary: spot_id -> {varieties: [...], varietyCount: N, varietyNote: str} ──
UPDATES = {
    # 北海道 spots
    "walker-ar0101e536782": {
        "varieties_add": ["ezoyamazakura"],
        "note": "旭山記念公園：エゾヤマザクラ約150本"
    },
    "walker-ar0101e537272": {
        "varieties_add": ["someiyoshino", "ezoyamazakura"],
        "note": "新川さくら並木：ソメイヨシノとエゾヤマザクラが交互に植栽。約755本"
    },
    "walker-ar0101e60097": {
        "varieties_add": ["ezoyamazakura"],
        "note": "北海道立真駒内公園：エゾヤマザクラ・ヤエザクラ約700本"
    },
    "walker-ar0101e60090": {
        "varieties_add": ["ezoyamazakura", "kasumizakura", "chishima-zakura"],
        "count": 3,
        "note": "旭山公園：エゾヤマザクラ約3500本、カスミザクラ、チシマザクラ"
    },
    "walker-ar0101e100948": {
        "varieties_add": ["ezoyamazakura"],
        "note": "うらかわ千本桜：エゾヤマザクラ約1000本以上"
    },
    "walker-ar0101e23376": {
        "varieties_add": ["ezoyamazakura", "kasumizakura"],
        "note": "二十間道路桜並木：エゾヤマザクラ約7割・カスミザクラ・ミヤマザクラ。約2000本"
    },
    "walker-ar0101e60096": {
        "varieties_add": ["ezoyamazakura", "someiyoshino"],
        "note": "帯広市緑ケ丘公園：エゾヤマザクラ・ソメイヨシノ約780本"
    },
    "walker-ar0101e25556": {
        "varieties_add": ["ezoyamazakura", "someiyoshino", "chishima-zakura"],
        "count": 3,
        "note": "美唄東明公園：エゾヤマザクラ・ソメイヨシノ・チシマザクラ約2000本"
    },
    "walker-ar0101e60103": {
        "varieties_add": ["ezoyamazakura"],
        "note": "苫小牧市緑ヶ丘公園：エゾヤマザクラ・ヤエザクラ約2000本"
    },
    "walker-ar0101e60115": {
        "varieties_add": ["ezoyamazakura"],
        "note": "弥生公園（名寄）：エゾヤマザクラ約200本"
    },
    "walker-ar0101e25540": {
        "varieties_add": ["chishima-zakura"],
        "note": "清隆寺（根室）：チシマザクラ約30本"
    },
    "walker-ar0101e60104": {
        "varieties_add": ["ezoyamazakura", "someiyoshino"],
        "note": "登別桜並木：エゾヤマザクラ・ソメイヨシノ約2000本"
    },
    # 東京都
    "walker-ar0313e25849": {
        "varieties_add": ["someiyoshino", "oshimazakura", "kanzan"],
        "count": 3,
        "note": "目黒川：ソメイヨシノ・オオシマザクラ・カンザン約800本"
    },
    # 宮城県
    "walker-ar0204e25611": {
        "varieties_add": ["someiyoshino", "yamazakura", "shidarezakura"],
        "count": 5,
        "note": "船岡城址公園：ソメイヨシノ・ヤマザクラ・シダレザクラ等約1300本"
    },
}

print("Loading spots.json...")
with open(SPOTS_FILE, encoding='utf-8') as f:
    spots = json.load(f)

print(f"Loaded {len(spots)} spots")

# Build index
spot_index = {s['id']: i for i, s in enumerate(spots)}

updated_count = 0
log_lines = []

for spot_id, update in UPDATES.items():
    if spot_id not in spot_index:
        print(f"  WARNING: spot {spot_id} not found!")
        continue

    idx = spot_index[spot_id]
    spot = spots[idx]
    existing = set(spot.get('varieties', []))

    to_add = [v for v in update.get('varieties_add', []) if v not in existing]

    if to_add:
        spot['varieties'] = list(existing) + to_add
        updated_count += 1
        print(f"  Updated {spot_id} ({spot['name']}): +{to_add}")

    if update.get('count') and not spot.get('varietyCount'):
        spot['varietyCount'] = update['count']

    if update.get('note') and not spot.get('varietyNote'):
        spot['varietyNote'] = update['note']

    log_lines.append(f"{spot_id},{spot['name']},{len(to_add)},{update.get('count', '')},{update.get('note', '')}")

print(f"\nTotal spots updated: {updated_count}")

# Save spots.json
print("Saving spots.json...")
with open(SPOTS_FILE, 'w', encoding='utf-8') as f:
    json.dump(spots, f, ensure_ascii=False, indent=2)

# Save progress
progress = {
    'totalSpots': len(spots),
    'processed': len(UPDATES),
    'lastProcessedId': list(UPDATES.keys())[-1],
    'updatedAt': datetime.now().isoformat(),
    'batchNote': 'Initial batch from web search - Hokkaido and Tokyo spots'
}
with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
    json.dump(progress, f, ensure_ascii=False, indent=2)

# Append to log
import csv
log_exists = os.path.exists(LOG_FILE)
with open(LOG_FILE, 'a', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    if not log_exists:
        writer.writerow(['spot_id', 'spot_name', 'varieties_added', 'variety_count_found', 'note'])
    for line in log_lines:
        writer.writerow(line.split(',', 4))

print("Done!")
print(f"Progress saved to {PROGRESS_FILE}")
print(f"Log appended to {LOG_FILE}")
