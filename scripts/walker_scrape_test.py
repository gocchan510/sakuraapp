"""
Walker+スクレイピング テスト（5件）
URL: https://hanami.walkerplus.com/detail/{id}/data.html
「桜の種類」行を取得 → alias_map.jsonで即時マッチング
出力: scripts/walker_scrape_test_result.json
"""

import json
import re
import time
import urllib.request
import urllib.error
from pathlib import Path
from html.parser import HTMLParser

BASE = Path(__file__).parent.parent
ALIAS_MAP_JSON = BASE / "scripts/alias_map.json"
SPOTS_JSON     = BASE / "src/data/spots.json"
OUTPUT_JSON    = BASE / "scripts/walker_scrape_test_result.json"

alias_map = json.loads(ALIAS_MAP_JSON.read_text(encoding="utf-8"))
spots_all = json.loads(SPOTS_JSON.read_text(encoding="utf-8"))

import unicodedata

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


def lookup_variety(name: str) -> str | None:
    """品種名 → variety_id。alias_mapで直接 or 正規化後に検索"""
    # 直接マッチ
    if name in alias_map:
        return alias_map[name]
    # 正規化後マッチ
    key = normalize_key(name)
    for raw, vid in alias_map.items():
        if normalize_key(raw) == key:
            return vid
    return None


# Walker+ slug → variety_id マッピング
WALKER_SLUG_MAP = {
    "somei_yoshino":       "someiyoshino",
    "yaezakura":           "kanzan",          # 八重桜の代表としてカンザン（総称なので要注意）
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
}


class DataPageParser(HTMLParser):
    """
    Walker+ data.htmlから「桜の種類」行を抽出するパーサー
    構造: <tr><th><h4>桜の種類</h4></th><td>品種テキスト</td></tr>
    """
    def __init__(self):
        super().__init__()
        self.in_tr = False
        self.in_th = False
        self.in_td = False
        self.current_th = ""
        self.current_td_text = ""
        self.current_td_links = []  # [(text, href), ...]
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


def fetch_variety_data(spot_id: str) -> tuple[str | None, list | None, str | None]:
    """
    Walker+ data.html を取得し「桜の種類」テキストとリンク一覧を返す
    Returns: (variety_text, links[(text, href)], error_message)
    """
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
    """
    「桜の種類」テキストを解析
    Returns:
        {
          "raw_text": str,
          "variety_names": [str],       # カンマ区切りで分割した品種名リスト
          "total_count": int | None,    # 「など全N品種」のN
          "has_etc_flag": bool,         # 「など全N品種」があるか
        }
    """
    # 「など全N品種」「など全N種」パターン
    m = re.search(r'など全(\d+)[品種種類]+', text)
    total_count = int(m.group(1)) if m else None
    has_etc = m is not None

    # 品種名を取得（「など全N品種」部分を除去してカンマ分割）
    clean = re.sub(r'[、など全\d+品種種類]+$', '', text)
    # カンマ・読点で分割
    parts = re.split(r'[、,，]', clean)
    names = []
    for p in parts:
        p = p.strip()
        # 括弧内の別名も保持
        if p:
            names.append(p)

    return {
        "raw_text": text,
        "variety_names": names,
        "total_count": total_count,
        "has_etc_flag": has_etc,
    }


def process_spot(spot: dict) -> dict:
    """1スポットを処理してマッチング結果を返す"""
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
    unmatched = []

    # まずリンクのslugからマッチング（高精度）
    slug_matched_names = set()
    for link_text, href in (links or []):
        slug = href.rstrip("/").split("/")[-1]
        vid = WALKER_SLUG_MAP.get(slug) or lookup_variety(slug.replace("_", ""))
        if vid:
            matched.append({"name": link_text, "id": vid, "source": "slug"})
            slug_matched_names.add(link_text)
        else:
            # slugで取れなければテキストでlookup
            vid = lookup_variety(link_text)
            if vid:
                matched.append({"name": link_text, "id": vid, "source": "text"})
                slug_matched_names.add(link_text)

    # リンクに含まれなかった品種名（プレーンテキスト部分）をテキストマッチング
    for name in parsed["variety_names"]:
        if name in slug_matched_names:
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
            unmatched.append(name)

    # 重複ID除去（同じIDが複数名から来た場合）
    seen_ids = set()
    deduped = []
    for m in matched:
        if m["id"] not in seen_ids:
            deduped.append(m)
            seen_ids.add(m["id"])
    matched = deduped

    # 既存品種との差分
    existing = set(spot.get("varieties", []))
    new_ids = [m["id"] for m in matched if m["id"] not in existing]

    status = "improved" if new_ids else ("matched" if matched else "unmatched")
    if parsed["has_etc_flag"]:
        status += "+etc"

    return {
        "spot_id": sid,
        "spot_name": spot["name"],
        "prefecture": spot["prefecture"],
        "status": status,
        "raw_variety_text": variety_text,
        "total_count": parsed["total_count"],
        "has_etc_flag": parsed["has_etc_flag"],
        "variety_names_raw": parsed["variety_names"],
        "matched": matched,
        "unmatched": unmatched,
        "existing_varieties": list(existing),
        "new_variety_ids": new_ids,
    }


# ── テスト対象5件 ──────────────────────────────────────────
# 多様な品種数を持つスポットを選択
TEST_IDS = [
    "walker-ar0101e25532",  # 円山公園（2品種）
    "walker-ar0202e25563",  # 弘前公園（52品種）
    "walker-ar0313e25816",  # 新宿御苑（多品種）
    "walker-ar0101e25542",  # 北海道の多品種スポット
    "walker-ar0313e60170",  # 別の多品種スポット
]

test_spots = {s["id"]: s for s in spots_all if s["id"] in TEST_IDS}

results = []
for sid in TEST_IDS:
    spot = test_spots.get(sid)
    if not spot:
        print(f"[SKIP] {sid} not found in spots.json")
        continue

    print(f"Processing: {spot['name']} ({sid})...")
    result = process_spot(spot)
    results.append(result)

    print(f"  status: {result['status']}")
    if result.get("raw_variety_text"):
        print(f"  raw: {result['raw_variety_text'][:80]}")
    if result.get("matched"):
        print(f"  matched: {[m['id'] for m in result['matched']]}")
    if result.get("unmatched"):
        print(f"  unmatched: {result['unmatched']}")
    if result.get("new_variety_ids"):
        print(f"  NEW: {result['new_variety_ids']}")
    print()

    time.sleep(1)  # レート制限対策

OUTPUT_JSON.write_text(
    json.dumps(results, ensure_ascii=False, indent=2),
    encoding="utf-8"
)
print(f"\n結果を {OUTPUT_JSON} に保存しました")
