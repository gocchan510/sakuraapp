#!/usr/bin/env python3
"""
v3バッチ結果をspots.jsonにマージ。
- HIGH確信度: 無条件採用
- MEDIUM確信度: メジャー品種なら無条件採用、それ以外はスポット総数が20未満なら採用
"""
import json, csv
from pathlib import Path

BASE        = Path("C:/Users/pcyus/Documents/sakura-app")
SPOTS_JSON  = BASE / "src/data/spots.json"
RESULTS_DIR = BASE / "scripts/deepdive_v3_batches"
LOG_FILE    = BASE / "scripts/spot_deepdive_v3_log.csv"
CAND_FILE   = BASE / "scripts/variety_candidates_v3.csv"
SUMM_FILE   = BASE / "scripts/spot_deepdive_v3_summary.txt"

# ── メジャー品種（MEDIUM確信度でも無条件採用）────────────────────
MAJOR_VARIETIES = {
    "someiyoshino", "yamazakura", "shidarezakura", "oshimazakura",
    "ooyamazakura", "higan-zakura", "edohigan-zakura", "kohigan",
    "kanzan", "ichiyou", "fugenzou", "ukon", "gyoikou",
    "kawaduzakura", "kanhizakura", "jindai-akebono", "yoko",
    "shirotae", "taihaku", "amanogawa", "kasumizakura",
    "yamazakura", "jugatsu-zakura", "fuyu-zakura",
    "yaebenishidare-sanokei", "beni-shidare",
    "okame", "syuzenjikanzakura", "atamizakura",
    "ezoyamazakura", "chishima-zakura", "ooyamazakura",
    "shidare-yamazakura", "yoshino-yamazakura",
}

# 一般公園の上限
LIMIT_GENERAL   = 20
LIMIT_MULTI     = 50   # featuresに「多品種」含むスポット
LIMIT_ARBORETUM = 200  # 植物園・見本園

def get_limit(spot):
    features = " ".join(spot.get("features", []))
    name = spot.get("name", "")
    if any(k in name for k in ["植物園", "見本園", "樹木園", "結城農場"]):
        return LIMIT_ARBORETUM
    if any(k in features for k in ["多品種", "品種豊富"]):
        return LIMIT_MULTI
    return LIMIT_GENERAL

# ── データ読み込み ─────────────────────────────────────────────────
spots = json.loads(SPOTS_JSON.read_text(encoding="utf-8"))
spot_map = {s["id"]: i for i, s in enumerate(spots)}

total_before = sum(len(s.get("varieties", [])) for s in spots)
improved_count = 0
log_rows = []
cand_rows = []
high_added_total = 0
med_added_total  = 0
med_rejected_total = 0

# ── バッチ結果を処理 ──────────────────────────────────────────────
result_files = sorted(RESULTS_DIR.glob("result_*.json"))
print(f"Result files found: {len(result_files)}")

for rf in result_files:
    try:
        batch = json.loads(rf.read_text(encoding="utf-8"))
    except Exception as e:
        print(f"  Skip {rf.name}: {e}")
        continue

    for r in batch:
        sid = r.get("spot_id")
        if sid not in spot_map:
            continue

        idx   = spot_map[sid]
        spot  = spots[idx]
        existing = set(spot.get("varieties", []))
        before   = len(existing)
        limit    = get_limit(spot)

        # HIGH → 無条件採用
        high_ids = [v for v in r.get("high_confidence", []) if v not in existing]

        # MEDIUM → メジャー品種は無条件、それ以外は上限チェック
        med_ids_raw = [v for v in r.get("medium_confidence", []) if v not in existing and v not in high_ids]
        med_ids_accept = []
        med_ids_reject = []
        current_count = before + len(high_ids)

        for vid in med_ids_raw:
            if vid in MAJOR_VARIETIES:
                med_ids_accept.append(vid)
            elif current_count + len(med_ids_accept) < limit:
                med_ids_accept.append(vid)
            else:
                med_ids_reject.append(vid)

        added = high_ids + med_ids_accept
        if added:
            spots[idx]["varieties"] = list(existing) + added
            improved_count += 1

        high_added_total += len(high_ids)
        med_added_total  += len(med_ids_accept)
        med_rejected_total += len(med_ids_reject)

        # ログ
        log_rows.append({
            "spot_id":         sid,
            "spot_name":       r.get("spot_name", ""),
            "varieties_before": before,
            "varieties_after":  before + len(added),
            "added_high":       "|".join(high_ids),
            "added_medium":     "|".join(med_ids_accept),
            "rejected_medium":  "|".join(med_ids_reject),
            "source_batch":     rf.stem,
        })

        # MEDIUM却下ログ（候補として保存）
        for vid in med_ids_reject:
            detail = next(
                (d for d in r.get("medium_details", []) if d.get("id") == vid),
                {}
            )
            cand_rows.append({
                "spot_id":    sid,
                "spot_name":  r.get("spot_name", ""),
                "variety_id": vid,
                "variety_name": detail.get("name", vid),
                "evidence":   detail.get("evidence", ""),
                "source_url": detail.get("url", ""),
            })

# ── 保存 ──────────────────────────────────────────────────────────
SPOTS_JSON.write_text(json.dumps(spots, ensure_ascii=False, indent=2), encoding="utf-8")
print("spots.json saved.")

with open(LOG_FILE, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["spot_id","spot_name","varieties_before","varieties_after",
                                       "added_high","added_medium","rejected_medium","source_batch"])
    w.writeheader(); w.writerows(log_rows)

with open(CAND_FILE, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["spot_id","spot_name","variety_id","variety_name","evidence","source_url"])
    w.writeheader(); w.writerows(cand_rows)

# ── サマリー ──────────────────────────────────────────────────────
total_after = sum(len(s.get("varieties", [])) for s in spots)
four_plus   = sum(1 for s in spots if len(s.get("varieties", [])) >= 4)

summary = f"""=== 桜スポット品種深掘り v3 マージ結果 ===

Result files merged: {len(result_files)} batches
Spots processed:     {len(log_rows)}
Spots improved:      {improved_count}

Added HIGH:          {high_added_total} links
Added MEDIUM:        {med_added_total} links (メジャー品種 or 上限内)
Rejected MEDIUM:     {med_rejected_total} links → {CAND_FILE.name}

Before: avg {total_before/len(spots):.2f} varieties/spot
After:  avg {total_after/len(spots):.2f} varieties/spot

4品種以上スポット: {four_plus}/{len(spots)} ({four_plus/len(spots)*100:.1f}%)

Top improved spots:
"""

top = sorted(
    [r for r in log_rows if r["varieties_after"] > r["varieties_before"]],
    key=lambda r: r["varieties_after"] - r["varieties_before"],
    reverse=True
)[:15]
for r in top:
    diff = r["varieties_after"] - r["varieties_before"]
    summary += f"  {r['spot_name']}: {r['varieties_before']} → {r['varieties_after']} (+{diff})\n"

SUMM_FILE.write_text(summary, encoding="utf-8")
print(summary)
print("Done!")