"""
alias正規化マップ生成スクリプト
varieties.jsonから全エントリのname/reading/aliasesを展開し、
「生テキスト → variety_id」のマッピングJSONを生成する。

出力: scripts/alias_map.json
形式: { "染井吉野": "someiyoshino", "ソメイヨシノ": "someiyoshino", ... }
"""

import json
import re
import unicodedata
from pathlib import Path

BASE = Path(__file__).parent.parent
VARIETIES_JSON = BASE / "src/data/varieties.json"
OUTPUT_JSON = BASE / "scripts/alias_map.json"
OUTPUT_REPORT = BASE / "scripts/alias_map_report.txt"

varieties = json.loads(VARIETIES_JSON.read_text(encoding="utf-8"))


def normalize_key(s: str) -> str:
    """正規化キー生成：全角→半角、カタカナ→ひらがな、小文字化、スペース/中点/ハイフン除去"""
    if not s:
        return ""
    # Unicode正規化（全角英数→半角）
    s = unicodedata.normalize("NFKC", s)
    # カタカナ→ひらがな
    result = []
    for ch in s:
        cp = ord(ch)
        if 0x30A1 <= cp <= 0x30F6:  # カタカナ
            result.append(chr(cp - 0x60))
        else:
            result.append(ch)
    s = "".join(result)
    # 小文字化
    s = s.lower()
    # 区切り文字除去（スペース、中点、ハイフン、アンダースコア、ノ/の）
    s = re.sub(r"[\s\u30FB\u00B7\-_・]", "", s)
    # 「桜」「ざくら」「さくら」の表記ゆれを統一しない（あえて残す）
    return s


alias_map = {}      # normalized_key → variety_id
raw_map = {}        # raw_text → variety_id（最終出力）
conflicts = []      # 衝突ログ

def add_entry(raw: str, vid: str):
    """rawテキストとvariety_idを登録。衝突検出あり"""
    if not raw or not raw.strip():
        return
    raw = raw.strip()
    key = normalize_key(raw)
    if not key:
        return

    if key in alias_map and alias_map[key] != vid:
        conflicts.append({
            "key": key,
            "raw": raw,
            "existing_id": alias_map[key],
            "new_id": vid
        })
        return  # 先勝ち（衝突時は上書きしない）

    alias_map[key] = vid
    raw_map[raw] = vid


for v in varieties:
    vid = v["id"]
    name = v.get("name", "")
    reading = v.get("reading", "")

    # 1. name（漢字表記）
    add_entry(name, vid)

    # 2. reading（ひらがな）
    add_entry(reading, vid)

    # 3. カタカナ読み（readingをカタカナに変換）
    if reading:
        kata = ""
        for ch in reading:
            cp = ord(ch)
            if 0x3041 <= cp <= 0x3096:  # ひらがな
                kata += chr(cp + 0x60)
            else:
                kata += ch
        add_entry(kata, vid)

    # 4. aliases フィールド（配列 or 文字列）
    aliases = v.get("aliases", [])
    if isinstance(aliases, str):
        aliases = [a.strip() for a in aliases.split(",") if a.strip()]
    for alias in aliases:
        add_entry(alias, vid)

    # 5. id自体（スラッグ）
    add_entry(vid, vid)

    # 6. idのハイフンをスペースに置換したもの
    add_entry(vid.replace("-", " "), vid)

    # 7. idのハイフン除去
    add_entry(vid.replace("-", ""), vid)

    # 8. name の「桜」「ザクラ」「さくら」省略形
    # 例:「ソメイヨシノ（染井吉野）」形式に対応
    if "（" in name:
        core = name.split("（")[0].strip()
        add_entry(core, vid)
    if "(" in name:
        core = name.split("(")[0].strip()
        add_entry(core, vid)

# 追加: よくある表記ゆれの手動補完
MANUAL_ADDITIONS = [
    # (raw表記, variety_id)  ← varieties.jsonに既存IDのみ
    ("染井吉野", "someiyoshino"),
    ("ソメイヨシノ", "someiyoshino"),
    ("そめいよしの", "someiyoshino"),
    ("吉野桜", "someiyoshino"),
    ("ヨシノザクラ", "someiyoshino"),
    ("山桜", "yamazakura"),
    ("ヤマザクラ", "yamazakura"),
    ("やまざくら", "yamazakura"),
    ("枝垂桜", "shidarezakura"),
    ("枝垂れ桜", "shidarezakura"),
    ("シダレザクラ", "shidarezakura"),
    ("しだれざくら", "shidarezakura"),
    ("糸桜", "shidarezakura"),
    ("大島桜", "oshimazakura"),
    ("オオシマザクラ", "oshimazakura"),
    ("おおしまざくら", "oshimazakura"),
    ("大山桜", "ooyamazakura"),
    ("オオヤマザクラ", "ooyamazakura"),
    ("霞桜", "kasumizakura"),
    ("カスミザクラ", "kasumizakura"),
    ("彼岸桜", "higan-zakura"),
    ("ヒガンザクラ", "higan-zakura"),
    ("ひがんざくら", "higan-zakura"),
    ("江戸彼岸", "edohigan-zakura"),
    ("エドヒガン", "edohigan-zakura"),
    ("エドヒガンザクラ", "edohigan-zakura"),
    ("小彼岸", "kohigan"),
    ("コヒガン", "kohigan"),
    ("河津桜", "kawaduzakura"),
    ("カワヅザクラ", "kawaduzakura"),
    ("かわずざくら", "kawaduzakura"),
    ("寒緋桜", "kanhizakura"),
    ("カンヒザクラ", "kanhizakura"),
    ("緋寒桜", "kanhizakura"),
    ("ヒカンザクラ", "kanhizakura"),
    ("関山", "kanzan"),
    ("カンザン", "kanzan"),
    ("一葉", "ichiyou"),
    ("イチヨウ", "ichiyou"),
    ("普賢象", "fugenzou"),
    ("フゲンゾウ", "fugenzou"),
    ("御衣黄", "gyoikou"),
    ("ギョイコウ", "gyoikou"),
    ("鬱金", "ukon"),
    ("ウコン", "ukon"),
    ("白妙", "shirotae"),
    ("シロタエ", "shirotae"),
    ("大白桜", "taihaku"),
    ("タイハク", "taihaku"),
    ("天の川", "amanogawa"),
    ("アマノガワ", "amanogawa"),
    ("神代曙", "jindai-akebono"),
    ("ジンダイアケボノ", "jindai-akebono"),
    ("陽光", "yoko"),
    ("ヨウコウ", "yoko"),
    ("十月桜", "jugatsu-zakura"),
    ("ジュウガツザクラ", "jugatsu-zakura"),
    ("四季桜", "shikizakura"),
    ("シキザクラ", "shikizakura"),
    ("八重紅枝垂", "yaebenishidarezakura"),
    ("ヤエベニシダレ", "yaebenishidarezakura"),
    ("八重紅しだれ", "yaebenishidarezakura"),
    ("薄墨桜", "usuzumizakura"),
    ("ウスズミザクラ", "usuzumizakura"),
    ("三春滝桜", "miharu-takizakura"),
    ("滝桜", "miharu-takizakura"),
    ("神代桜", "jindaizakura"),
    ("山高神代桜", "jindaizakura"),
]

# valid IDチェック用セット
valid_ids = {v["id"] for v in varieties}

for raw, vid in MANUAL_ADDITIONS:
    if vid in valid_ids:
        add_entry(raw, vid)

# 出力: raw表記→IDのマップ（rawベース）
OUTPUT_JSON.write_text(
    json.dumps(raw_map, ensure_ascii=False, indent=2, sort_keys=True),
    encoding="utf-8"
)

# レポート出力
lines = [
    f"alias_map 生成完了",
    f"総エントリ数: {len(raw_map)}",
    f"対象品種ID数: {len(set(raw_map.values()))}",
    f"衝突件数: {len(conflicts)}",
    "",
    "=== 衝突ログ ===",
]
for c in conflicts:
    lines.append(f"  key={c['key']} raw={c['raw']} 既存={c['existing_id']} 新規={c['new_id']}")

lines += [
    "",
    "=== サンプル（先頭50件）===",
]
for i, (raw, vid) in enumerate(list(raw_map.items())[:50]):
    lines.append(f"  {raw!r} → {vid}")

OUTPUT_REPORT.write_text("\n".join(lines), encoding="utf-8")
print(f"Done. entries={len(raw_map)}, conflicts={len(conflicts)}")
print(f"Output: {OUTPUT_JSON}")
