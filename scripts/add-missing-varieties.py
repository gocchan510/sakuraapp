#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Add 27 new cherry blossom variety entries to src/data/varieties.json.
Entries start from no 933.
"""

import json
import sys

VARIETIES_PATH = "C:/Users/pcyus/Documents/sakura-app/src/data/varieties.json"

new_entries = [
    # ===== Group A: Independent varieties (19) =====

    {
        "id": "michinoku-shidare",
        "no": "933",
        "name": "みちのく枝垂",
        "reading": "ミチノクシダレ",
        "bloomSeason": "4月中旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "一重咲",
        "tags": ["枝垂れ", "一重", "エドヒガン系"],
        "summary": "東北地方原産のエドヒガン系枝垂れ桜",
        "features": "東北（みちのく）地方に自生するエドヒガンの枝垂れ性個体。しなやかに垂れ下がる長い枝に淡紅色の小花を密につけ、風情ある景色をつくり出す。一重咲きで花弁は5枚、直径約2〜2.5cm。葉の展開に先立って開花し、樹全体が花で覆われる。",
        "history": "東北地方の山野に自生する枝垂れ性の桜として知られ、その地方名「みちのく」を品種名に冠する。エドヒガンの変異個体として古くから植栽・保存されてきた。",
        "background": "エドヒガン（Cerasus itosakura）の枝垂れ変異品種。シダレザクラ（Cerasus spachiana）と同系統とされるが、東北地方固有の遺伝的特性を持つ個体群として区別されることがある。",
        "trivia": "「みちのく」は東北地方の古称。この桜はその雄大な自然を象徴する品種として地域で大切にされている。",
        "wikiTitleJa": None,
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
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["枝垂れ性", "東北地方固有品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yabu-higan",
        "no": "934",
        "name": "ヤブヒガン",
        "reading": "ヤブヒガン",
        "bloomSeason": "3月下旬〜4月上旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "一重咲",
        "tags": ["一重", "エドヒガン系", "野生種"],
        "summary": "山地の藪に自生するヒガンザクラの変種",
        "features": "山野の藪に生育するヒガンザクラの変種。エドヒガンに近縁で、小ぶりな淡紅〜白色の花を一重咲きで咲かせる。花径は約2cm。春の彼岸の頃に開花し、葉の展開と同時に、または先立って咲くことが多い。樹形はやや小さく、山地の低木林の縁などに生育する。",
        "history": "エドヒガンの変種として分類され、日本各地の山地に自生する。「ヤブ（藪）ヒガン（彼岸）」の名の通り、藪のような山地に自生し彼岸の頃に咲くことからこの名がついた。",
        "background": "ヒガンザクラ（Cerasus × subhirtella）の変種とされる。エドヒガンの血を引き、早春に咲く特性を持つ。学術的にはエドヒガン系の野生変種として扱われる。",
        "trivia": "ヤブヒガンは比較的目立たない存在だが、人里離れた山中で静かに開花する姿は、日本の原風景そのものとも言える。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "03-late",
            "end": "04-early",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 2,
            "stars": "★★",
            "label": "やや珍しい",
            "reasons": ["野生変種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "musashino",
        "no": "935",
        "name": "武蔵野",
        "reading": "ムサシノ",
        "bloomSeason": "4月上旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "一重咲",
        "tags": ["一重", "ソメイヨシノ系", "関東"],
        "summary": "武蔵野地方に由来するソメイヨシノ系の淡紅色一重咲き品種",
        "features": "武蔵野地方（現在の東京都西部〜埼玉南部）に由来するソメイヨシノ系の品種。淡紅色の一重咲きで、花弁は5枚、直径約3〜4cm。ソメイヨシノとほぼ同時期に開花し、樹形は開張性。街路樹や公園樹として利用されることがある。",
        "history": "武蔵野台地に由来する品種として名付けられた。ソメイヨシノと近縁の品種で、関東平野の桜文化を体現する一品種として扱われる。",
        "background": "ソメイヨシノ（Cerasus × yedoensis）に近縁の園芸品種。武蔵野の地名を冠するが、育成地や選抜の経緯の詳細は明確でない部分もある。",
        "trivia": "「武蔵野」という地名は、かつて広大な草原が広がっていた関東平野の台地地帯を指す雅称で、文学や芸術にも多く登場する。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-early",
            "end": "04-early",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 2,
            "stars": "★★",
            "label": "やや珍しい",
            "reasons": ["地域固有品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "mikawa-kanzakura",
        "no": "936",
        "name": "三河寒桜",
        "reading": "ミカワカンザクラ",
        "bloomSeason": "2月下旬〜3月上旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "一重咲",
        "tags": ["早咲き", "一重", "カンヒザクラ系", "愛知"],
        "summary": "愛知県三河地方の早咲き桜。カンヒザクラとヤマザクラの交雑系",
        "features": "愛知県三河地方に由来する早咲きの桜。カンヒザクラとヤマザクラの交雑種系と考えられており、2月下旬から3月上旬に淡紅色の一重咲きの花を咲かせる。花径は約3cm。花弁はわずかに丸みを帯び、ほんのりピンクがかった白色を呈する。寒い時期に開花するため「寒桜」の名が付く。",
        "history": "三河（愛知県）地方で自生または発見された早咲き品種。地域の早春の風物詩として知られ、寒桜の名の通り梅の花が終わる頃から咲き始める。",
        "background": "カンヒザクラ（Cerasus campanulata）とヤマザクラ（Cerasus jamasakura）の交雑由来とされる。早咲き性の遺伝子をカンヒザクラから受け継いでいると考えられる。",
        "trivia": "三河地方は豊かな自然に恵まれ、固有の植物品種が多い。三河寒桜は地域の植物多様性を示す一例でもある。",
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
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["早咲き", "地域固有品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yamato-hizakura",
        "no": "937",
        "name": "大和緋桜",
        "reading": "ヤマトヒザクラ",
        "bloomSeason": "4月上旬",
        "color": "濃紅",
        "colorCode": "#FF69B4",
        "flowerShape": "一重咲",
        "tags": ["一重", "濃紅", "奈良", "大和"],
        "summary": "奈良の大和地方原産の濃紅色一重咲き品種",
        "features": "奈良県（大和国）地方に由来する品種。鮮やかな濃紅色の一重咲き花を咲かせるのが特徴で、他の淡紅系品種とは一線を画す鮮明な色合いが印象的。花径は約3〜3.5cm。花弁5枚でやや丸みがあり、全体的にメリハリのある咲き姿。",
        "history": "大和（奈良）の地から発見・選抜されたとされる品種。大和の緋色の桜という意味合いで命名された。奈良は古来より花見文化が盛んで、多様な品種が保存されてきた地でもある。",
        "background": "ヤマザクラ（Cerasus jamasakura）系の品種と考えられるが、突出した花色の濃さが育種上の特徴。大和地方の植物文化を反映した品種の一つ。",
        "trivia": "「緋桜（ひざくら）」とは緋色（深い赤みがかった色）の桜を指し、古くから和歌や詩歌にも詠まれてきた。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-early",
            "end": "04-early",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["濃紅色", "地域固有品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "miyuki-zakura",
        "no": "938",
        "name": "御幸桜",
        "reading": "ミユキザクラ",
        "bloomSeason": "4月中旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "淡紅", "皇室"],
        "summary": "皇室ゆかりの名を持つ淡紅色八重咲き品種",
        "features": "「御幸（みゆき）」の名を持つ品種で、淡紅色の八重咲きが特徴。花弁数は10〜20枚程度で、花径は約3〜4cm。ふっくらとした丸みのある花形が雅やかな印象を与える。4月中旬に開花し、ソメイヨシノより1〜2週遅れて咲く。",
        "history": "「御幸」とは天皇・皇后の外出を意味する語で、皇室とゆかりのある場所や場面に関連した命名とされる。品種の由来や作出経緯の詳細は不明な点もある。",
        "background": "サトザクラ系（Cerasus serrulata）の八重咲き品種。類似品種の多いサトザクラ群の中で、その品名から特別な由緒を感じさせる品種の一つ。",
        "trivia": "「御幸」は「みゆき」と読み、天皇の行幸・皇后の行啓を指す言葉。桜の品種名に用いられることで格調高い印象を与える。",
        "wikiTitleJa": None,
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
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["八重咲き", "希少品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yamagata-otome",
        "no": "939",
        "name": "山形乙女",
        "reading": "ヤマガタオトメ",
        "bloomSeason": "4月下旬〜5月上旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "松前系", "山形", "晩咲き"],
        "summary": "山形県原産の松前系八重咲き品種。晩咲きで淡紅色",
        "features": "山形県で選抜・育成された松前系の八重咲き品種。淡紅色の花を4月下旬から5月上旬にかけて咲かせる晩咲き品種。花弁数は15〜25枚程度で、大輪のふっくらとした花形が特徴。寒冷な東北地方の気候に適した品種で、開花期間が比較的長い。",
        "history": "山形県で育成・選抜された品種で、松前桜の改良系統に属する。「乙女」の名はその可憐で優しい花の姿を乙女に例えたもの。東北地方の遅い春を彩る品種として知られる。",
        "background": "松前系サトザクラ（Cerasus serrulata 'Matsumae' group）の一品種。北海道松前で多数作出された改良品種群の系統を引く品種で、耐寒性に優れる。",
        "trivia": "山形県は桜の名所が多く、霞城公園や最上公園など多くの桜スポットが知られる。山形乙女はその豊かな桜文化の中から生まれた品種の一つ。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-late",
            "end": "05-early",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["八重咲き", "晩咲き", "地域固有品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "miya-no-yuki",
        "no": "940",
        "name": "宮の雪",
        "reading": "ミヤノユキ",
        "bloomSeason": "4月下旬",
        "color": "白",
        "colorCode": "#FFFFFF",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "白", "大輪", "松前系"],
        "summary": "松前系の白色大輪八重咲き品種。純白の花が雪を連想させる",
        "features": "白色の大輪八重咲きを誇る品種で、「宮の雪」の名は純白の花を雪に例えたもの。花弁数は20〜30枚程度で、花径は約4cm以上の大輪。4月下旬に開花し、満開時には枝が花で覆われ雪景色のような美しさを呈する。松前系の品種に属し、耐寒性も高い。",
        "history": "白系統の八重桜の中でも特に清楚な美しさを持つ品種として選抜された。「宮の雪」という品名は、その純白の花の情景を宮廷に降り積もる雪にたとえた雅名。",
        "background": "サトザクラ系（Cerasus serrulata）の白色八重咲き品種。松前系統の改良品種の一つで、白花系の代表的な八重桜品種として植栽される。",
        "trivia": "白い八重桜は「御衣黄」「鬱金」などの黄緑系とともに、桜の多様な色彩の中でも清楚さで際立つ。宮の雪はその白花の美を体現する品種。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-late",
            "end": "04-late",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["白色八重咲き", "大輪"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "miyamoto-wase",
        "no": "941",
        "name": "宮本早生",
        "reading": "ミヤモトワセ",
        "bloomSeason": "3月下旬〜4月上旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "一重咲",
        "tags": ["早咲き", "一重", "淡紅"],
        "summary": "早咲き性を持つ淡紅色一重咲き品種",
        "features": "「早生（わせ）」の名が示す通り、早咲き性を持つ品種。3月下旬から4月上旬にかけて淡紅色の一重咲き花を咲かせる。花弁は5枚、花径は約2.5〜3cm。葉の展開に先立って開花し、春を早く告げる品種として重宝される。",
        "history": "宮本氏によって選抜または発見された早咲き品種とされる。早咲き性の優良個体を品種として固定したもので、農業や園芸の観点から早期開花の特性が評価された。",
        "background": "エドヒガン系またはサトザクラ系の早咲き品種と考えられる。早咲き性の遺伝的特性を固定した選抜品種。",
        "trivia": "「早生（わせ）」は農業用語で収穫や成熟が早い品種を指す。桜においても早咲き性を評価して命名される場合がある。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "03-late",
            "end": "04-early",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["早咲き", "希少品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "miyazawa-wase",
        "no": "942",
        "name": "宮沢早生",
        "reading": "ミヤザワワセ",
        "bloomSeason": "3月下旬〜4月上旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "一重咲",
        "tags": ["早咲き", "一重", "淡紅"],
        "summary": "宮沢の名を持つ早咲きの淡紅色一重咲き品種",
        "features": "宮本早生と同様に早咲き性を持つ品種。3月下旬から4月上旬にかけて淡紅色の一重咲き花を咲かせる。花弁は5枚、花径は約2.5〜3cm。宮本早生とよく似た特性を持つが、別個体・別選抜の品種として区別される。",
        "history": "宮沢氏によって選抜または発見された早咲き品種。早咲き性の優良個体として選抜・固定されたもので、宮本早生とは異なる個体群から選ばれた品種。",
        "background": "エドヒガン系またはサトザクラ系の早咲き選抜品種。宮本早生と近縁の可能性があるが、育成者・選抜地が異なる別品種として扱われる。",
        "trivia": "早咲き桜の品種は、花見シーズンを早めに楽しみたい人々に喜ばれ、開花予報にも注目が集まる。宮沢早生はそうした早春を彩る貴重な品種のひとつ。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "03-late",
            "end": "04-early",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["早咲き", "希少品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yoshino-yamazakura",
        "no": "943",
        "name": "ヨシノ",
        "reading": "ヨシノ",
        "bloomSeason": "4月中旬",
        "color": "白",
        "colorCode": "#FFFFFF",
        "flowerShape": "一重咲",
        "tags": ["一重", "ヤマザクラ系", "吉野", "選抜品種"],
        "summary": "吉野山産ヤマザクラの優良選抜個体。ソメイヨシノとは別品種",
        "features": "吉野山（奈良県）に自生するヤマザクラ（Cerasus jamasakura）の優良選抜個体。白〜淡紅色の一重咲きで、花弁は5枚、花径は約3〜4cm。若葉は銅褐色で、開花と同時に展開する。ヤマザクラとしての正統な特徴を持ちつつ、特に樹勢や花付きに優れた個体として選抜された。",
        "history": "「吉野の桜」と言えばヤマザクラが有名で、かつて吉野山の花見といえばヤマザクラを指した。ヨシノはそのヤマザクラの中から選ばれた優良な個体であり、ソメイヨシノ（吉野桜）とは全く異なる品種である点に注意が必要。",
        "background": "学名Cerasus jamasakura（ヤマザクラ）の選抜品種。ソメイヨシノ（Cerasus × yedoensis）がしばしば「吉野」と呼ばれるが、本品種はそれとは別のヤマザクラ系統の選抜個体。吉野山の桜文化を代表するヤマザクラの正統な後継品種として位置づけられる。",
        "trivia": "吉野山（奈良）は日本最古の花見の地の一つで、山全体にヤマザクラが密植する壮大な景観で知られる。「ヨシノ」はそのヤマザクラ文化の象徴的品種。",
        "wikiTitleJa": "ヤマザクラ",
        "wikiTitleEn": "Cerasus jamasakura",
        "emoji": "🌸",
        "aliases": ["吉野", "ヤマザクラ（吉野選抜）"],
        "bloomPeriod": {
            "start": "04-mid",
            "end": "04-mid",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 2,
            "stars": "★★",
            "label": "やや珍しい",
            "reasons": ["選抜品種", "歴史的品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "rikyu-zakura",
        "no": "944",
        "name": "利休桜",
        "reading": "リキュウザクラ",
        "bloomSeason": "4月中旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "淡紅", "茶道"],
        "summary": "千利休にちなむとされる淡紅色の八重咲き品種",
        "features": "茶人・千利休（1522〜1591）にちなむとされる八重咲きの桜。淡紅〜白色の花を八重咲きで咲かせ、花弁数は10〜20枚程度。花径は約3〜3.5cm。利休の侘び茶の精神を反映するかのような、控えめながら品格ある花の姿が特徴。",
        "history": "千利休ゆかりの品種として伝わる桜。利休が茶室の庭に植えたとされる桜の系統、または利休を記念して命名された品種の可能性がある。茶の湯の世界と桜は深い縁があり、花見茶会は古来より行われてきた。",
        "background": "サトザクラ系（Cerasus serrulata）の八重咲き品種の一つ。「利休」の名を冠する品種は、茶道文化との繋がりを示す歴史的品種として価値がある。",
        "trivia": "千利休は安土桃山時代の茶人で、わび茶を大成した人物。茶室の庭には簡素ながら四季折々の花が植えられ、桜もその重要な要素のひとつであった。",
        "wikiTitleJa": None,
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
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["八重咲き", "歴史的品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yaguchi",
        "no": "945",
        "name": "矢口",
        "reading": "ヤグチ",
        "bloomSeason": "4月下旬",
        "color": "桃紅",
        "colorCode": "#FF69B4",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "桃紅", "東京", "古品種"],
        "summary": "東京・矢口原産の古品種。濃桃紅色の八重咲き",
        "features": "東京都大田区矢口地区に由来する古品種。濃い桃紅色の八重咲きが特徴で、花弁数は20〜30枚程度、花径は約3〜4cmの中〜大輪。4月下旬に開花するやや晩咲き品種。色鮮やかな花が密に咲き、観賞価値が高い。",
        "history": "東京都大田区矢口地区で古くから栽培されてきた品種。江戸時代から近代にかけて矢口周辺で保存されてきた地域品種で、東京の桜文化を伝える貴重な品種の一つ。",
        "background": "サトザクラ系（Cerasus serrulata）の八重咲き品種。東京の地名を冠する品種として、都市部の植物遺産という観点からも重要な品種。",
        "trivia": "矢口は現在の東京都大田区に属する地名。多摩川下流に位置し、江戸時代から花見の名所として知られた地域に由来する品種。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-late",
            "end": "04-late",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["八重咲き", "古品種", "地域固有品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "murata-zakura",
        "no": "946",
        "name": "村田桜",
        "reading": "ムラタザクラ",
        "bloomSeason": "4月中旬〜下旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "淡紅"],
        "summary": "村田の名を持つ淡紅色の八重咲き品種",
        "features": "淡紅色の八重咲きが特徴の品種。花弁数は15〜25枚程度で、ふっくらとした丸みのある花形。花径は約3〜4cm。4月中旬から下旬にかけて開花し、やや晩咲き傾向を持つ。",
        "history": "村田の名前を冠する品種で、育成者または発見地にちなんだ命名と考えられる。サトザクラ系の八重咲き品種として古くから保存・植栽されてきた。",
        "background": "サトザクラ系（Cerasus serrulata）の八重咲き品種の一つ。品種の来歴・詳細は記録が少ないが、日本花の会の桜見本園でその系統が保存されている。",
        "trivia": "日本の桜品種の多くは発見者や育成者、あるいは発見地の地名にちなんで命名される。村田桜もそのような伝統に則った命名品種の一つ。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-mid",
            "end": "04-late",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["八重咲き", "希少品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "ryumon-shidare",
        "no": "947",
        "name": "流紋枝垂",
        "reading": "リュウモンシダレ",
        "bloomSeason": "4月上旬〜中旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "半八重咲",
        "tags": ["枝垂れ", "半八重咲き", "淡紅"],
        "summary": "枝垂れ性の半八重咲き淡紅色品種",
        "features": "枝垂れ性を持つ半八重咲きの品種。淡紅色の花を咲かせ、花弁数は5〜10枚程度の半八重咲き。しなやかに垂れ下がる枝に花が連なり、清楚かつ風雅な美しさを見せる。花径は約2.5〜3cm。4月上旬から中旬に開花。",
        "history": "「流紋（りゅうもん）」の名は流れるような文様、または地名・人名に由来すると考えられる。枝垂れ性と半八重咲きを兼ね備えた比較的珍しい品種として保存されている。",
        "background": "エドヒガン系またはサトザクラ系の枝垂れ性品種と考えられる。枝垂れ桜の中でも八重咲き傾向を持つ品種は比較的少なく、独自の存在感を持つ。",
        "trivia": "「流紋（りゅうもん）」には流れるような美しい文様という意味がある。枝垂れる枝に連なる花の様子が流れる文様のように見えることからの命名とも考えられる。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-early",
            "end": "04-mid",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 4,
            "stars": "★★★★",
            "label": "とても珍しい",
            "reasons": ["枝垂れ性", "半八重咲き", "希少品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yabusame-zakura",
        "no": "948",
        "name": "流鏑馬桜",
        "reading": "ヤブサメザクラ",
        "bloomSeason": "4月中旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "一重咲",
        "tags": ["一重", "淡紅", "神社", "流鏑馬"],
        "summary": "流鏑馬の行事に縁のある淡紅色一重咲き品種",
        "features": "流鏑馬（やぶさめ）行事が行われる神社に関連した品種。淡紅色の一重咲きで、花弁は5枚、花径は約3cm。4月中旬に開花し、騎射の儀式が行われる春の境内を彩る。凛とした美しさを持つ一重咲きの品種。",
        "history": "流鏑馬を奉納する神社の境内に植えられ、その行事にちなんで命名されたとされる品種。武道の祭礼と桜が結びついた歴史的背景を持つ。流鏑馬は馬上で矢を射る武道であり、多くの神社で春の神事として行われる。",
        "background": "ヤマザクラ系またはサトザクラ系の一重咲き品種。神社境内での長期保存品種として、地域の文化・歴史と深く結びついている。",
        "trivia": "流鏑馬（やぶさめ）は馬に乗りながら矢を射る日本の伝統武道で、神社の祭礼として各地で行われる。鎌倉の鶴岡八幡宮の流鏑馬が特に有名。",
        "wikiTitleJa": None,
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
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["希少品種", "歴史的品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "ryugan",
        "no": "949",
        "name": "龍眼",
        "reading": "リュウガン",
        "bloomSeason": "4月中旬〜下旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "大輪", "淡紅"],
        "summary": "龍の眼を思わせる大輪の八重咲き品種",
        "features": "「龍眼（りゅうがん）」の名が示す通り、力強い印象の大輪八重咲き品種。淡紅〜白色の花を咲かせ、花弁数は20〜30枚程度、花径は約4cm以上の大輪。4月中旬から下旬に開花。密に咲く花が枝を覆い、壮観な咲き姿を見せる。",
        "history": "「龍眼」という命名は、大輪の花の迫力ある印象を龍の眼にたとえたものと考えられる。古典的な桜品種の命名法に則り、花の特徴を象徴的な表現で表した品種名。",
        "background": "サトザクラ系（Cerasus serrulata）の大輪八重咲き品種。大輪系サトザクラの中でも花形の美しさで評価される品種として保存されている。",
        "trivia": "龍眼（リュウガン・ロンガン）は東南アジア産のフルーツでもあるが、桜の「龍眼」は全く別の由来で、花の大きさと神秘的な美しさを龍の眼に例えたもの。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-mid",
            "end": "04-late",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["八重咲き", "大輪"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "ryokuryu-hananokai",
        "no": "950",
        "name": "緑龍",
        "reading": "リョクリュウ",
        "bloomSeason": "4月中旬",
        "color": "黄緑",
        "colorCode": "#ADDFAD",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "緑色", "珍しい", "日本花の会掲載"],
        "summary": "緑色の珍しい八重咲き品種。園里緑龍とは別品種",
        "features": "緑色の花を咲かせる珍しい八重咲き品種。花弁は淡い黄緑〜緑白色で、花弁数は15〜25枚程度。花径は約3〜4cm。御衣黄や鬱金と並ぶ緑系八重桜の一品種で、独特の色彩が花愛好家の注目を集める。「園里緑龍」（長野県須坂市産）とは別品種として扱われる。",
        "history": "緑龍の名は緑色の花と龍のたくましさを合わせた命名。緑系桜の品種は比較的少なく、植物学的にも特異な存在として保存・研究されている。園里緑龍（2008年に枝変わりで発見）とは来歴が異なる別品種。",
        "background": "サトザクラ系（Cerasus serrulata）の緑花八重咲き品種。緑系の花色はクロロフィルが花弁に発現することによるとされ、御衣黄・鬱金・緑桜などと同じ系統の色彩変異品種の一つ。",
        "trivia": "緑色の桜は「緑の桜」とも呼ばれ、花見の季節に異彩を放つ存在。その珍しさから熱心な花見愛好家の間で特に人気が高い。",
        "wikiTitleJa": None,
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
        "hasImage": False,
        "rarity": {
            "score": 5,
            "stars": "★★★★★",
            "label": "非常に珍しい",
            "reasons": ["緑色の花", "八重咲き", "超希少品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yae-fuyuzakura",
        "no": "951",
        "name": "八重冬桜",
        "reading": "ヤエフユザクラ",
        "bloomSeason": "11月〜12月・4月（二季咲き）",
        "color": "白",
        "colorCode": "#FFFFFF",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "二季咲き", "冬桜", "白"],
        "summary": "冬桜の八重咲き変種。晩秋〜冬と春の二季に開花",
        "features": "冬桜（フユザクラ）の八重咲き変種。白〜淡紅色の八重咲き花を咲かせ、花弁数は10〜20枚程度。晩秋の11月から冬の12月にかけてと、翌年4月頃の春にも咲く二季咲き性を持つ。冬の寒い時期に凛として咲く姿が特に印象深い。花径は約1.5〜2cmのやや小ぶりな花。",
        "history": "冬桜（Cerasus × parvifolia）の八重咲き変異個体として発見・選抜された品種。冬桜自体は豆桜（マメザクラ）とヤマザクラの交雑種と考えられており、その八重咲き変異個体が八重冬桜として固定された。",
        "background": "冬桜（Cerasus × parvifolia）の八重咲き変種。冬桜は秋と春の二季咲き性で知られるが、八重冬桜もその特性を受け継ぐ。学名は Cerasus × parvifolia 'Yaefuyuzakura' などと表記される場合がある。",
        "trivia": "冬に咲く桜は「冬桜」「十月桜」「子福桜」など複数の品種があるが、八重咲きの冬桜は特に珍しく、冬の庭園や公園で際立つ存在感を放つ。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "11-early",
            "end": "12-late",
            "secondary": {
                "start": "04-early",
                "end": "04-mid"
            },
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 5,
            "stars": "★★★★★",
            "label": "非常に珍しい",
            "reasons": ["八重咲き", "二季咲き（冬と春）", "冬咲き品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    # ===== Group B: Regional variants (8) =====

    {
        "id": "yamazakura-bandai",
        "no": "952",
        "name": "山桜（磐梯山産）",
        "reading": "ヤマザクラ（バンダイサンサン）",
        "bloomSeason": "4月下旬",
        "color": "白",
        "colorCode": "#FFFFFF",
        "flowerShape": "一重咲",
        "tags": ["一重", "ヤマザクラ", "福島", "地方変異"],
        "summary": "福島県・磐梯山産のヤマザクラ個体",
        "features": "福島県磐梯山産のヤマザクラ（Cerasus jamasakura）個体。白〜淡紅色の一重咲きで、花弁は5枚、花径は約3〜4cm。ヤマザクラの典型的な特徴を持ちながら、磐梯山の高地環境に適応した個体群として保存されている。若葉は銅褐色で開花とほぼ同時に展開する。",
        "history": "磐梯山（福島県耶麻郡北塩原村）の山中で採取・選抜されたヤマザクラ個体。磐梯山は猪苗代湖の北に位置する火山で、豊かな自然植生を持つ。その山中のヤマザクラが植物多様性の観点から保存対象として選ばれた。",
        "background": "ヤマザクラ（Cerasus jamasakura）の磐梯山産個体。同種でも産地によって形態的・遺伝的な変異が見られる場合があり、地域集団として保存価値が認められたもの。",
        "trivia": "磐梯山は「会津富士」とも呼ばれる名山で、1888年の大噴火で知られる。その豊かな自然の中で育ったヤマザクラは、地域の生態系を構成する重要な要素。",
        "wikiTitleJa": "ヤマザクラ",
        "wikiTitleEn": "Cerasus jamasakura",
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-late",
            "end": "04-late",
            "secondary": None,
            "regionNote": "福島県・磐梯山産"
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["地域固有個体", "保存品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yamazakura-nachi",
        "no": "953",
        "name": "山桜（那智山産）",
        "reading": "ヤマザクラ（ナチサンサン）",
        "bloomSeason": "4月中旬",
        "color": "白",
        "colorCode": "#FFFFFF",
        "flowerShape": "一重咲",
        "tags": ["一重", "ヤマザクラ", "和歌山", "那智", "地方変異"],
        "summary": "和歌山県・那智山産のヤマザクラ個体",
        "features": "和歌山県那智山産のヤマザクラ（Cerasus jamasakura）個体。白〜淡紅色の一重咲きで、花弁は5枚、花径は約3〜4cm。温暖な紀伊半島の気候に育ったヤマザクラで、磐梯山産より若干早い時期に開花する傾向がある。若葉は銅褐色。",
        "history": "那智山（和歌山県東牟婁郡那智勝浦町）は熊野那智大社と那智の滝で名高い霊山。その神聖な山域に自生するヤマザクラが保存対象として選抜された。古来から信仰の地であった那智山の自然遺産の一部として位置づけられる。",
        "background": "ヤマザクラ（Cerasus jamasakura）の那智山産個体。紀伊半島の暖温帯気候下で育つ個体群は、東北・山岳地帯の個体群と形態的・開花時期に違いが見られる。",
        "trivia": "那智山は世界遺産「紀伊山地の霊場と参詣道」の一部。日本三名瀑の那智の滝を擁するこの神聖な山域に咲くヤマザクラは、自然と信仰が融合した特別な存在。",
        "wikiTitleJa": "ヤマザクラ",
        "wikiTitleEn": "Cerasus jamasakura",
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-mid",
            "end": "04-mid",
            "secondary": None,
            "regionNote": "和歌山県・那智山産"
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["地域固有個体", "保存品種", "世界遺産地域産"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yamazakura-nikko",
        "no": "954",
        "name": "山桜（日光産）",
        "reading": "ヤマザクラ（ニッコウサン）",
        "bloomSeason": "4月中旬〜下旬",
        "color": "白",
        "colorCode": "#FFFFFF",
        "flowerShape": "一重咲",
        "tags": ["一重", "ヤマザクラ", "栃木", "日光", "地方変異"],
        "summary": "栃木県・日光産のヤマザクラ個体",
        "features": "栃木県日光産のヤマザクラ（Cerasus jamasakura）個体。白〜淡紅色の一重咲きで、花弁は5枚、花径は約3〜4cm。日光の山岳地帯の環境（標高・気温）に適応した個体群で、平地のヤマザクラより開花がやや遅い傾向がある。若葉は銅褐色。",
        "history": "日光（栃木県日光市）の山林に自生するヤマザクラから選抜・保存された個体。日光東照宮などの社寺林や日光国立公園の植生の一部として、日光のヤマザクラは地域自然遺産として重要。",
        "background": "ヤマザクラ（Cerasus jamasakura）の日光産個体。日光地域のヤマザクラは中程度の標高に自生し、関東山岳部の桜個体群として植物学的保存価値がある。",
        "trivia": "日光は「日光を見ずして結構と言うな」の格言で有名な名勝地。春の日光では東照宮周辺の桜も美しく、ヤマザクラもその自然景観を構成する重要な要素。",
        "wikiTitleJa": "ヤマザクラ",
        "wikiTitleEn": "Cerasus jamasakura",
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-mid",
            "end": "04-late",
            "secondary": None,
            "regionNote": "栃木県・日光産"
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["地域固有個体", "保存品種"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yae-yamazakura-yoshino",
        "no": "955",
        "name": "八重咲ヤマザクラ（吉野山産）",
        "reading": "ヤエザキヤマザクラ（ヨシノヤマサン）",
        "bloomSeason": "4月下旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "ヤマザクラ", "奈良", "吉野", "珍しい"],
        "summary": "奈良・吉野山産のヤマザクラの八重咲き個体。非常に珍しい",
        "features": "奈良県吉野山産のヤマザクラ（Cerasus jamasakura）の八重咲き個体。通常一重咲きのヤマザクラに稀に現れる八重咲き変異個体で、淡紅色の花弁を10枚以上重ねる。花径は約3〜4cm。4月下旬に開花し、吉野のヤマザクラとしての血統を持ちながら八重咲きという稀有な特性を有する。",
        "history": "吉野山（奈良県吉野郡吉野町）はヤマザクラの名所として日本最古の花見の地の一つ。その吉野山に自生するヤマザクラの中から、極めて稀な八重咲き個体が発見・選抜された。ヤマザクラの八重咲きは自然変異として稀に現れるもので、その保存価値は高い。",
        "background": "ヤマザクラ（Cerasus jamasakura）の八重咲き変異個体。ヤマザクラは通常一重咲きだが、まれに多弁化（八重咲き化）する変異個体が現れる。そのような個体を吉野山で確認・保存したもの。",
        "trivia": "吉野山のヤマザクラは「一目千本」と称される壮観な花景色で知られる。その吉野山でヤマザクラの八重咲き個体が発見されたことは、桜の多様性を示す貴重な発見。",
        "wikiTitleJa": "ヤマザクラ",
        "wikiTitleEn": "Cerasus jamasakura",
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-late",
            "end": "04-late",
            "secondary": None,
            "regionNote": "奈良県・吉野山産"
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 5,
            "stars": "★★★★★",
            "label": "非常に珍しい",
            "reasons": ["ヤマザクラの八重咲き変異", "吉野山産", "自然変異個体"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yae-yamazakura-unknown",
        "no": "956",
        "name": "八重咲ヤマザクラ（産地不明）",
        "reading": "ヤエザキヤマザクラ（サンチフメイ）",
        "bloomSeason": "4月下旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "ヤマザクラ", "産地不明", "珍しい"],
        "summary": "産地不明のヤマザクラ八重咲き個体",
        "features": "産地不明のヤマザクラ（Cerasus jamasakura）の八重咲き個体。通常一重咲きのヤマザクラに稀に現れる八重咲き変異個体で、淡紅色の花弁を10枚以上重ねる。花径は約3〜4cm。4月下旬に開花する。産地が特定されていないが、ヤマザクラの八重咲き変異として植物学的保存価値が高い。",
        "history": "産地が不明または記録が失われたヤマザクラの八重咲き個体。どこかの山野で自然変異として発生したと考えられるが、発見地・採取地の記録が残っていない。八重咲きヤマザクラそのものの希少性から、保存対象として選ばれた。",
        "background": "ヤマザクラ（Cerasus jamasakura）の八重咲き変異個体。吉野山産の個体（yae-yamazakura-yoshino）と同種の変異だが、産地が異なるか不明の別個体として管理されている。",
        "trivia": "植物の保存コレクションでは「産地不明（provenance unknown）」の個体が少なからず含まれる。記録が失われていても、遺伝資源としての保存価値があると判断された場合は収集・維持される。",
        "wikiTitleJa": "ヤマザクラ",
        "wikiTitleEn": "Cerasus jamasakura",
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-late",
            "end": "04-late",
            "secondary": None,
            "regionNote": "産地不明"
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 5,
            "stars": "★★★★★",
            "label": "非常に珍しい",
            "reasons": ["ヤマザクラの八重咲き変異", "自然変異個体"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yaezakura-akita",
        "no": "957",
        "name": "八重桜（秋田県産）",
        "reading": "ヤエザクラ（アキタケンサン）",
        "bloomSeason": "5月上旬",
        "color": "淡紅",
        "colorCode": "#FFB7C5",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "秋田", "晩咲き", "寒冷地"],
        "summary": "秋田県産の八重桜個体。寒冷地のため5月上旬に開花",
        "features": "秋田県産の八重桜個体。淡紅色の八重咲きで、花弁数は15〜25枚程度、花径は約3〜4cm。寒冷な秋田県の気候により、他地域より開花が遅く5月上旬に咲く。東北の遅い春を彩る品種として、寒冷地における桜の開花時期の幅広さを示す好例。",
        "history": "秋田県で採取・保存された八重桜の個体。秋田は東北地方北部の寒冷地で、桜の開花は本州でも最も遅い地域の一つ。この八重桜個体は秋田県の桜多様性を代表する保存資源として選ばれた。",
        "background": "サトザクラ系（Cerasus serrulata）の八重咲き品種の秋田県産個体と考えられる。寒冷地での長年の生育による耐寒性適応が見られる可能性がある。",
        "trivia": "秋田県の桜の名所としては角館の武家屋敷と枝垂桜が特に有名。また、秋田県は桜前線の終着点に近く、5月の連休頃に桜の見頃を迎えることも多い。",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "05-early",
            "end": "05-early",
            "secondary": None,
            "regionNote": "秋田県産（寒冷地）"
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 3,
            "stars": "★★★",
            "label": "珍しい",
            "reasons": ["八重咲き", "寒冷地産", "地域固有個体"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yae-ohshima-ko",
        "no": "958",
        "name": "八重咲大島（小）",
        "reading": "ヤエザキオオシマ（コ）",
        "bloomSeason": "4月中旬",
        "color": "白",
        "colorCode": "#FFFFFF",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "白", "小輪", "オオシマザクラ系"],
        "summary": "オオシマザクラの八重咲き小輪変種",
        "features": "オオシマザクラ（Cerasus speciosa）の八重咲き小輪変種。白色の花弁を10〜20枚程度重ね、花径は2〜3cm程度の小輪サイズ。通常のオオシマザクラは一重咲きだが、稀に多弁化した個体が現れることがある。4月中旬に開花し、清楚な小花が密に咲く。オオシマザクラの特有の芳香を持つ可能性がある。",
        "history": "オオシマザクラの多弁化（八重咲き）個体の中で小輪のものを選別・保存したもの。オオシマザクラは伊豆大島や伊豆半島に自生し、桜餅の葉として利用されることでも知られる。",
        "background": "オオシマザクラ（Cerasus speciosa）の八重咲き小輪変種。オオシマザクラは多くの栽培品種の親種となっており、その八重咲き変異個体は系統保存上の価値が高い。",
        "trivia": "オオシマザクラはその大きく濃い緑の葉が塩漬けされ、桜餅を包む「桜の葉」として全国的に利用される。花だけでなく葉も活用される実用的な桜。",
        "wikiTitleJa": "オオシマザクラ",
        "wikiTitleEn": "Cerasus speciosa",
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-mid",
            "end": "04-mid",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 4,
            "stars": "★★★★",
            "label": "とても珍しい",
            "reasons": ["オオシマザクラの八重咲き変異", "小輪", "自然変異個体"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },

    {
        "id": "yae-ohshima-nami",
        "no": "959",
        "name": "八重咲大島（並）",
        "reading": "ヤエザキオオシマ（ナミ）",
        "bloomSeason": "4月中旬",
        "color": "白",
        "colorCode": "#FFFFFF",
        "flowerShape": "八重咲",
        "tags": ["八重咲き", "白", "オオシマザクラ系"],
        "summary": "オオシマザクラの八重咲き並輪変種",
        "features": "オオシマザクラ（Cerasus speciosa）の八重咲き並輪（標準サイズ）変種。白色の花弁を10〜20枚程度重ね、花径は3〜4cm程度の標準サイズ。同じ八重咲き大島の小輪種（八重咲大島（小））より花が大きい。4月中旬に開花し、清楚な白花が美しい。オオシマザクラ特有の芳香を持つ。",
        "history": "オオシマザクラの多弁化（八重咲き）個体の中で標準サイズのものを選別・保存したもの。八重咲大島（小）と同時期に発見・選抜された可能性があり、花の大きさによって二つの系統として区別された。",
        "background": "オオシマザクラ（Cerasus speciosa）の八重咲き並輪変種。小輪種と同一親種の変異個体だが、花径が標準（並）サイズである点で区別される。オオシマザクラの系統多様性の保存上、両者の維持は重要。",
        "trivia": "「並（なみ）」は標準・普通サイズを意味し、「小（こ）」より一回り大きい花径。同じ品種の中でも花の大きさで系統を区別する植物学的な分類方法は、生物多様性保全の観点から重要。",
        "wikiTitleJa": "オオシマザクラ",
        "wikiTitleEn": "Cerasus speciosa",
        "emoji": "🌸",
        "aliases": [],
        "bloomPeriod": {
            "start": "04-mid",
            "end": "04-mid",
            "secondary": None,
            "regionNote": None
        },
        "images": [],
        "hasImage": False,
        "rarity": {
            "score": 4,
            "stars": "★★★★",
            "label": "とても珍しい",
            "reasons": ["オオシマザクラの八重咲き変異", "自然変異個体"]
        },
        "spots": [
            {"spotId": "yuki-sakura-farm", "spotName": "日本花の会 結城農場 桜見本園"}
        ]
    },
]


def main():
    # Load existing data
    with open(VARIETIES_PATH, encoding="utf-8") as f:
        varieties = json.load(f)

    print(f"Current count: {len(varieties)}")

    # Verify no duplicate IDs
    existing_ids = {v["id"] for v in varieties}
    new_ids = [e["id"] for e in new_entries]
    duplicates = [nid for nid in new_ids if nid in existing_ids]
    if duplicates:
        print(f"ERROR: Duplicate IDs found: {duplicates}")
        sys.exit(1)

    # Verify all 27 entries
    assert len(new_entries) == 27, f"Expected 27 entries, got {len(new_entries)}"

    # Check no numbers are correct (933-959)
    for i, entry in enumerate(new_entries):
        expected_no = str(933 + i).zfill(3)
        assert entry["no"] == expected_no, f"Entry {i} has no={entry['no']}, expected {expected_no}"

    # Append new entries
    varieties.extend(new_entries)

    # Write back
    with open(VARIETIES_PATH, "w", encoding="utf-8") as f:
        json.dump(varieties, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"New count: {len(varieties)}")
    print(f"Added {len(new_entries)} entries (no 933-959)")
    print("\nAdded entries:")
    for e in new_entries:
        print(f"  {e['no']}: {e['name']} ({e['id']})")


if __name__ == "__main__":
    main()
