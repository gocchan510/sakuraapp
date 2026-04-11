#!/usr/bin/env python3
"""Phase 1: 確実な新品種の追加 + alias更新"""
import json, csv, os

ROOT      = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
VAR_PATH  = os.path.join(ROOT, 'src', 'data', 'varieties.json')
CSV_PATH  = os.path.join(ROOT, 'scripts', 'added_varieties.csv')

varieties = json.loads(open(VAR_PATH, encoding='utf-8').read())
var_by_id = {v['id']: v for v in varieties}

log_rows = []

# ════════════════════════════════════════════════════════════════
# 新規追加エントリ
# ════════════════════════════════════════════════════════════════
NEW_VARIETIES = [
    {
        "id": "kiccho",
        "no": "903",
        "name": "吉兆",
        "reading": "きっちょう",
        "bloomSeason": "2月下旬〜3月上旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "一重咲き",
        "tags": ["一重", "早咲き", "小輪", "神奈川"],
        "summary": "東海桜の突然変異から生まれた早咲きの新品種。花が密に付き、見た人に吉い兆しをもたらすと命名",
        "features": "神奈川県川崎市の花き生産者・名古屋徹氏が2013年に東海桜の栽培株の中から突然変異として発見。東海桜より花芽が密に付き、花が多く咲く点が特徴。ソメイヨシノより早い2月下旬〜3月上旬に開花する早咲き品種で、薄桃色の一重小輪花が枝びっしりに咲く。子供の目線でも楽しめる花付きの多さが魅力。",
        "history": "2013年3月、川崎市宮前区の植木畑で東海桜の中に異なる個体を発見。突然変異と推定され、約10年の出願期間と台風被害を経て2026年1月に農林水産省に品種登録された。川崎市初の桜品種登録。育成者は名古屋徹氏。",
        "background": "親品種の東海桜（Cerasus × tokai-zakura）は早咲きのカンヒザクラ系品種。吉兆はその枝変わりで、さらに花付きが密になった改良型。命名は「見た人に吉い兆しが訪れるように」という願いから。",
        "trivia": "川崎市初のサクラ品種登録であり、育成者が市に苗木を寄贈して普及が始まっている。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "02-late",
            "end": "03-early",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False
    },
    {
        "id": "haruka",
        "no": "904",
        "name": "はるか",
        "reading": "はるか",
        "bloomSeason": "4月中旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "八重咲き",
        "tags": ["八重咲き", "遅咲き", "中輪", "福島復興", "多摩森林科学園育成"],
        "summary": "多摩森林科学園が育成した遅咲き八重桜。福島復興のシンボルとして綾瀬はるかが命名",
        "features": "森林研究・整備機構（旧森林総合研究所）多摩森林科学園で育成された八重咲きの栽培品種。花弁数は14〜19枚で、基部が白色に近い淡紅色の中輪花。ソメイヨシノより遅い4月中旬に開花し、葉の展開とほぼ同時。マメザクラ・エドヒガン・オオシマザクラ・ヤマザクラの4野生種の遺伝的関与が確認されている。",
        "history": "1999年に多摩森林科学園のサクラ保存林に植えられたオモイガワ（思川）から採取した種子を発芽させ育成。遺伝子解析により母親はオモイガワ、花粉親はタオヤメと推定。2013年にNHK大河ドラマ「八重の桜」にちなみ福島県復興のシンボルとして女優の綾瀬はるかが命名。2021年5月に品種登録（第28477号）。",
        "background": "農林水産省品種登録番号第28477号。福島県を中心に全国への植樹活動が進められており、農林水産省本省正面にも植えられている。学名はCerasus Sato-zakura Group 'Haruka' Katsuki。",
        "trivia": "「はるか」の名は女優の綾瀬はるかさんが命名。福島の「はるか先の未来」への希望も込められている。",
        "wikiTitleJa": "はるか (桜)",
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-mid",
            "end": "04-mid",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False
    },
    {
        "id": "hitachi-miyabi-zakura",
        "no": "905",
        "name": "ひたち雅",
        "reading": "ひたちみやび",
        "bloomSeason": "4月上旬〜中旬",
        "color": "淡紫ピンク",
        "colorCode": "#E8A0C8",
        "flowerShape": "八重咲き",
        "tags": ["八重咲き", "大輪", "茨城", "日本花の会認定"],
        "summary": "日本花の会結城農場で松前八重寿の実生から育成。日立市を象徴する八重大輪桜",
        "features": "蕾は鮮紫ピンク色、開花時は淡紫ピンクの大輪八重咲き。花弁数35〜44枚の豪華な花が散房状に咲く。花弁表面のしわが少なく、先端の切れ込みも少ない端正な花形が特徴。樹形は盃状の高木で樹勢が強健。日本花の会 園芸品種認定制度 第004号として認定。",
        "history": "日本花の会結城農場（茨城県結城市）の桜見本園において、当時の農場長・田中秀明氏が松前八重寿の実生から選抜。育成後に日立市へ寄贈され、市民公募による命名で「ひたち雅」と決まった。",
        "background": "日本花の会 園芸品種認定番号 第004号。「優美で華やかな品位を感じさせる花のイメージをもとに日立市を象徴する」として命名。親品種の松前八重寿はサトザクラ系の遅咲き大輪品種。",
        "trivia": "「雅」の字が示す通り、優雅で品のある花姿が特徴。茨城県日立市を象徴する桜として市民に親しまれている。",
        "wikiTitleJa": None,
        "wikiTitleEn": "Cerasus 'Hitachi Miyabi'",
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-early",
            "end": "04-mid",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False
    },
    {
        "id": "afterglow",
        "no": "906",
        "name": "アフターグロウ",
        "reading": "あふたーぐろう",
        "bloomSeason": "3月下旬〜4月上旬",
        "color": "桃色",
        "colorCode": "#FF9EC4",
        "flowerShape": "一重咲き",
        "tags": ["一重", "海外品種", "ソメイヨシノ系", "北米"],
        "summary": "アケボノの実生から米国で育成されたソメイヨシノ系品種。開花から散るまで濃いピンクを保つ",
        "features": "アケボノ（Prunus × yedoensis 'Akebono'）の実生として米国で選抜・育成されたソメイヨシノ系改良品種。アケボノとの最大の違いは、開花から落花まで花色が褪せずに濃いピンクを保つ点。アケボノは開花時の淡紅から白に近づいて散るのに対し、アフターグロウは鮮やかなピンクを最後まで維持する。上向きに広がる樹形で、秋の葉色は黄色。",
        "history": "米国でアケボノの実生として育成・選抜された品種。スミソニアン・ガーデンズ（ワシントンD.C.）や英国キール大学（国立観賞用サクラコレクション）などの著名機関が収集・評価している。英国王立園芸協会（RHS）にも登録。",
        "background": "学名はPrunus × yedoensis 'Afterglow'。北米の苗木流通でアケボノの代替品種として普及が進んでいる。樹高は成木で6〜8m程度。",
        "trivia": "「アフターグロウ」は英語で「残照・夕映え」を意味し、開花後も色褪せない花色を表す命名。",
        "wikiTitleJa": None,
        "wikiTitleEn": "Prunus × yedoensis 'Afterglow'",
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "03-late",
            "end": "04-early",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False
    },
]

# ════════════════════════════════════════════════════════════════
# alias追加のみ
# ════════════════════════════════════════════════════════════════
ALIAS_UPDATES = {
    'omoidezakura': '思い出桜',   # 思伊出桜の別表記
    'hanakagami':   '花鏡',       # 華加賀美の通称
}

# ════════════════════════════════════════════════════════════════
# 実行
# ════════════════════════════════════════════════════════════════
added = []
for new_v in NEW_VARIETIES:
    varieties.append(new_v)
    added.append(new_v['id'])
    print(f"  追加: {new_v['name']} ({new_v['id']}, no={new_v['no']})")
    log_rows.append([new_v['id'], new_v['name'], 'web_research', 'phase1'])

for vid, alias in ALIAS_UPDATES.items():
    v = var_by_id[vid]
    if alias not in v.get('aliases', []):
        v.setdefault('aliases', []).append(alias)
        print(f"  alias追加: {v['name']} ← {alias}")
        log_rows.append([vid, alias, 'alias_update', 'phase1'])

# ════════════════════════════════════════════════════════════════
# 保存
# ════════════════════════════════════════════════════════════════
with open(VAR_PATH, 'w', encoding='utf-8') as f:
    json.dump(varieties, f, ensure_ascii=False, indent=2)
print(f"\nvarieties.json 保存: {len(varieties)}品種")

# CSV（既存があれば追記）
mode = 'a' if os.path.exists(CSV_PATH) else 'w'
with open(CSV_PATH, mode, encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    if mode == 'w':
        w.writerow(['id', 'name', 'source', 'phase'])
    w.writerows(log_rows)
print(f"CSV: {CSV_PATH}")
