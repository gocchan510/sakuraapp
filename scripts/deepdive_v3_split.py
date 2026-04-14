#!/usr/bin/env python3
"""
spots.json を50件バッチに分割してエージェント用入力ファイルを生成する
"""
import json, os
from pathlib import Path

BASE = Path("C:/Users/pcyus/Documents/sakura-app")
SPOTS_JSON  = BASE / "src/data/spots.json"
BATCHES_DIR = BASE / "scripts/deepdive_v3_batches"
BATCHES_DIR.mkdir(exist_ok=True)

spots = json.loads(SPOTS_JSON.read_text(encoding="utf-8"))

# 対象: varieties < 30
targets = [
    {"id": s["id"], "name": s["name"], "prefecture": s.get("prefecture",""),
     "existing_varieties": s.get("varieties", []),
     "features": s.get("features", [])}
    for s in spots
    if len(s.get("varieties", [])) < 30
]

print(f"Total targets: {len(targets)}")

BATCH_SIZE = 50
batches = [targets[i:i+BATCH_SIZE] for i in range(0, len(targets), BATCH_SIZE)]
print(f"Batches: {len(batches)} (x{BATCH_SIZE} spots each)")

for i, batch in enumerate(batches):
    out = BATCHES_DIR / f"batch_{i:03d}.json"
    out.write_text(json.dumps(batch, ensure_ascii=False, indent=2), encoding="utf-8")

print("Done. Batch files saved to:", BATCHES_DIR)
print("Run agent for each batch:")
for i in range(len(batches)):
    print(f"  batch_{i:03d}.json → result_{i:03d}.json")
