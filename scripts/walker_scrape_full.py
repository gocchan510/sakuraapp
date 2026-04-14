"""
Walker+ 全スポット品種スクレイピング（本番）
対象: spots.json の walker- プレフィックス スポット 1,389件
出力:
  scripts/walker_scrape_results.json   … 全結果
  scripts/walker_scrape_progress.json  … 進捗（途中再開用）
  scripts/walker_needs_deep_dive.json  … needs_deep_dive スポット一覧
  scripts/walker_unmatched.json        … unmatched 品種名一覧

status 定義:
  improved          … 新規品種IDが見つかった
  matched           … マッチしたが全て既存
  needs_deep_dive   … 「など全N品種」フラグあり（追加調査が必要）
  unmatched         … 品種名がalias_mapで解決できなかった
  error             … fetch失敗

複合例: improved+needs_deep_dive, improved+unmatched
"""

import json
import re
import time
import unicodedata
import urllib.request
import urllib.error
from html.parser import HTMLParser
from pathlib import Path

BASE        = Path(__file__).parent.parent
ALIAS_MAP   = json.loads((BASE / "scripts/alias_map.json").read_text(encoding="utf-8"))
SPOTS_ALL   = json.loads((BASE / "src/data/spots.json").read_text(encoding="utf-8"))
OUT_RESULTS = BASE / "scripts/walker_scrape_results.json"
OUT_PROGRESS= BASE / "scripts/walker_scrape_progress.json"
OUT_DEEPDIVE= BASE / "scripts/walker_needs_deep_dive.json"
OUT_UNMATCH = BASE / "scripts/walker_unmatched.json"

# Walker+ slug → variety_id
WALKER_SLUG_MAP = {
    "somei_yoshino":       "someiyoshino",
    "yaezakura":           None,               # 総称のため決め打ちしない
    "wild_cherry":         "yamazakura",
    "weeping_cherry":      "shidarezakura",
    "cerasus_campanulata": "kanhizakura",
    "cerasus_speciosa":    "oshimazakura",
    "edohigan":            "edohigan-zakura",
    "kasumizakura":        "kasumizakura",
    "yamazakura":          "yamazakura",
    "shidarezakura":       "shidarezakura",
    "kawazuzakura":        "kawaduzakura",
    "kohigan":             "kohigan",
    "shikizakura":         "shikizakura",
    "kanzan":              "kanzan",
    "ichiyou":             "ichiyou",
    "fugenzou":            "fugenzou",
    "gyoikou":             "gyoikou",
    "ukon":                "ukon",
    "shirotae":            "shirotae",
    "taihaku":             "taihaku",
    "amanogawa":           "amanogawa",
    "jindai_akebono":      "jindai-akebono",
    "yoko":                "yoko",
    "kanzakura":           "kanzakura",
    "higan":               "higan-zakura",
    "ooyamazakura":        "ooyamazakura",
    "atamizakura":         "atamizakura",
    "kawaduzakura":        "kawaduzakura",
    "angyo_zakura":        "angyo-zakura",
}


def normalize_key(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFKC", s)
    result = []
    for ch in s:
        cp = ord(ch)
        if 0x30A1 <= cp <= 0x30F6:
            result.append(chr(cp - 0x60))
        else:
            result.append(ch)
    s = "".join(result).lower()
    s = re.sub(r"[\s\u30FB\u00B7\-_・]", "", s)
    return s


def lookup_variety(name: str):
    if not name:
        return None
    if name in ALIAS_MAP:
        return ALIAS_MAP[name]
    key = normalize_key(name)
    for raw, vid in ALIAS_MAP.items():
        if normalize_key(raw) == key:
            return vid
    return None


class DataPageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_tr = False
        self.in_th = False
        self.in_td = False
        self.current_th = ""
        self.current_td_text = ""
        self.current_td_links = []
        self.current_link_text = ""
        self.current_link_href = ""
        self.in_link = False
        self.target_td_text = None
        self.target_td_links = None
        self._found_sakura_th = False

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "tr":
            self.in_tr = True
            self.current_th = ""
            self.current_td_text = ""
            self.current_td_links = []
            self._found_sakura_th = False
        elif tag == "th" and self.in_tr:
            self.in_th = True
        elif tag == "td" and self.in_tr:
            self.in_td = True
        elif tag == "a" and self.in_td:
            self.in_link = True
            self.current_link_text = ""
            self.current_link_href = attrs_dict.get("href", "")

    def handle_endtag(self, tag):
        if tag == "tr":
            self.in_tr = False
            if self._found_sakura_th and self.current_td_text:
                self.target_td_text = self.current_td_text.strip()
                self.target_td_links = list(self.current_td_links)
        elif tag == "th":
            self.in_th = False
            if "桜の種類" in self.current_th:
                self._found_sakura_th = True
        elif tag == "td":
            self.in_td = False
        elif tag == "a" and self.in_link:
            self.in_link = False
            if self.in_td:
                self.current_td_links.append((self.current_link_text.strip(), self.current_link_href))

    def handle_data(self, data):
        if self.in_th:
            self.current_th += data
        if self.in_td:
            self.current_td_text += data
            if self.in_link:
                self.current_link_text += data


def fetch_variety_data(spot_id: str):
    wid = spot_id.replace("walker-", "")
    url = f"https://hanami.walkerplus.com/detail/{wid}/data.html"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return None, None, f"HTTP {e.code}"
    except Exception as e:
        return None, None, str(e)
    parser = DataPageParser()
    parser.feed(html)
    return parser.target_td_text, parser.target_td_links, None


def parse_variety_field(text: str) -> dict:
    m = re.search(r'など全(\d+)[品種種類]+', text)
    total_count = int(m.group(1)) if m else None
    has_etc = m is not None
    clean = re.sub(r'[、など全\d+品種種類]+$', '', text)
    parts = re.split(r'[、,，]', clean)
    names = [p.strip() for p in parts if p.strip()]
    return {"variety_names": names, "total_count": total_count, "has_etc_flag": has_etc}


def process_spot(spot: dict) -> dict:
    sid = spot["id"]
    variety_text, links, err = fetch_variety_data(sid)

    if err or not variety_text:
        return {
            "spot_id": sid,
            "spot_name": spot["name"],
            "prefecture": spot["prefecture"],
            "status": "error",
            "error": err or "桜の種類フィールドなし",
        }

    parsed = parse_variety_field(variety_text)

    matched = []
    unmatched_names = []
    slug_matched = set()

    # 1. slug マッチング（リンクから）
    for link_text, href in (links or []):
        slug = href.rstrip("/").split("/")[-1]
        vid = WALKER_SLUG_MAP.get(slug)
        if vid is None and slug in WALKER_SLUG_MAP:
            slug_matched.add(link_text)
            continue  # 総称（yaezakura等）はスキップ
        if vid is None:
            vid = lookup_variety(slug.replace("_", "")) or lookup_variety(link_text)
        if vid:
            matched.append({"name": link_text, "id": vid, "source": "slug"})
            slug_matched.add(link_text)

    # 2. テキストマッチング（リンク外の品種名）
    for name in parsed["variety_names"]:
        if name in slug_matched:
            continue
        vid = lookup_variety(name)
        if not vid:
            base = re.sub(r'[（(][^)）]*[)）]', '', name).strip()
            vid = lookup_variety(base) if base != name else None
        if not vid:
            m2 = re.search(r'[（(]([^)）]+)[)）]', name)
            if m2:
                vid = lookup_variety(m2.group(1))
        if vid:
            matched.append({"name": name, "id": vid, "source": "text"})
        else:
            unmatched_names.append(name)

    # 重複ID除去
    seen_ids = set()
    deduped = []
    for m in matched:
        if m["id"] not in seen_ids:
            deduped.append(m)
            seen_ids.add(m["id"])
    matched = deduped

    existing = set(spot.get("varieties", []))
    new_ids = [m["id"] for m in matched if m["id"] not in existing]

    # status 判定（複合可）
    statuses = []
    if new_ids:
        statuses.append("improved")
    elif matched:
        statuses.append("matched")
    if parsed["has_etc_flag"]:
        statuses.append("needs_deep_dive")
    if unmatched_names:
        statuses.append("unmatched")
    if not statuses:
        statuses.append("no_data")

    return {
        "spot_id": sid,
        "spot_name": spot["name"],
        "prefecture": spot["prefecture"],
        "status": "+".join(statuses),
        "raw_variety_text": variety_text,
        "total_count": parsed["total_count"],
        "has_etc_flag": parsed["has_etc_flag"],
        "variety_names_raw": parsed["variety_names"],
        "matched": matched,
        "unmatched": unmatched_names,
        "existing_count": len(existing),
        "new_variety_ids": new_ids,
    }


# ── 進捗ロード（途中再開対応） ──────────────────────────────────
done_ids = set()
results = []
if OUT_PROGRESS.exists():
    prog = json.loads(OUT_PROGRESS.read_text(encoding="utf-8"))
    done_ids = set(prog.get("done_ids", []))
    print(f"[再開] 既処理: {len(done_ids)}件")
if OUT_RESULTS.exists():
    results = json.loads(OUT_RESULTS.read_text(encoding="utf-8"))

# ── 対象スポット ────────────────────────────────────────────────
walker_spots = [s for s in SPOTS_ALL if s["id"].startswith("walker-")]
targets = [s for s in walker_spots if s["id"] not in done_ids]
total = len(walker_spots)
print(f"対象: {total}件 / 残り: {len(targets)}件")

# ── メインループ ────────────────────────────────────────────────
SAVE_INTERVAL = 50

for i, spot in enumerate(targets):
    result = process_spot(spot)
    results.append(result)
    done_ids.add(spot["id"])

    status = result["status"]
    new_n  = len(result.get("new_variety_ids", []))
    print(f"[{len(done_ids)}/{total}] {spot['name']} → {status}"
          + (f" +{new_n}件" if new_n else ""))

    # 定期保存
    if len(done_ids) % SAVE_INTERVAL == 0:
        OUT_RESULTS.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        OUT_PROGRESS.write_text(json.dumps({"done_ids": list(done_ids)}, ensure_ascii=False), encoding="utf-8")
        print(f"  → 保存済み ({len(done_ids)}件)")

    time.sleep(0.8)

# ── 最終保存 ────────────────────────────────────────────────────
OUT_RESULTS.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
OUT_PROGRESS.write_text(json.dumps({"done_ids": list(done_ids)}, ensure_ascii=False), encoding="utf-8")

# ── サマリー集計 ────────────────────────────────────────────────
improved      = [r for r in results if "improved"        in r["status"]]
needs_dive    = [r for r in results if "needs_deep_dive" in r["status"]]
unmatched_r   = [r for r in results if "unmatched"       in r["status"]]
errors        = [r for r in results if r["status"] == "error"]
total_new     = sum(len(r.get("new_variety_ids", [])) for r in results)

print(f"\n=== 完了 ===")
print(f"処理: {len(results)}件")
print(f"improved: {len(improved)}件 (新規紐づけ計 {total_new}件)")
print(f"needs_deep_dive: {len(needs_dive)}件")
print(f"unmatched品種あり: {len(unmatched_r)}件")
print(f"error: {len(errors)}件")

# needs_deep_dive リスト出力
OUT_DEEPDIVE.write_text(
    json.dumps([{"spot_id": r["spot_id"], "spot_name": r["spot_name"],
                 "prefecture": r["prefecture"], "total_count": r.get("total_count"),
                 "matched_count": len(r.get("matched", [])),
                 "raw_variety_text": r.get("raw_variety_text", "")}
                for r in needs_dive],
               ensure_ascii=False, indent=2), encoding="utf-8")

# unmatched 品種名集計
all_unmatched = {}
for r in unmatched_r:
    for name in r.get("unmatched", []):
        all_unmatched[name] = all_unmatched.get(name, 0) + 1
OUT_UNMATCH.write_text(
    json.dumps(sorted(all_unmatched.items(), key=lambda x: -x[1]),
               ensure_ascii=False, indent=2), encoding="utf-8")

print(f"\nneeds_deep_dive → {OUT_DEEPDIVE}")
print(f"unmatched集計   → {OUT_UNMATCH}")
print(f"全結果          → {OUT_RESULTS}")
