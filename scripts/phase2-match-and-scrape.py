#!/usr/bin/env python3
"""
Phase 2: 日本花の会376品種と varieties.json を突合し、
未収録品種の詳細ページをスクレイプして追加する。
"""
import json, re, csv, os, time, unicodedata, urllib.request, urllib.error

ROOT     = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
VAR_PATH = os.path.join(ROOT, 'src', 'data', 'varieties.json')
CSV_PATH = os.path.join(ROOT, 'scripts', 'added_varieties.csv')

varieties = json.loads(open(VAR_PATH, encoding='utf-8').read())

# ── 正規化関数 ─────────────────────────────────────────────────
def nrm(s):
    if not s: return ''
    s = unicodedata.normalize('NFKC', s)
    s = s.strip().replace(' ', '').replace('\u3000', '')
    # 括弧・内容除去（比較用）
    s = re.sub(r'[（(【〔][^）)】〕]*[）)】〕]', '', s)
    return s.lower()

# 既存エントリの正規化済み名前セット（name + aliases）
existing_nrm = set()
for v in varieties:
    existing_nrm.add(nrm(v['name']))
    for a in v.get('aliases', []):
        existing_nrm.add(nrm(a))

# ── 日本花の会 376品種リスト ─────────────────────────────────────
HANANOKAI_VARIETIES = [
    # ア行(76)
    "会津薄墨","赤真珠","暁南殿","赤花真桜","赤実大島","阿岸小菊桜","旭山","東錦","熱海桜",
    "厚岸泰山府君","天城吉野","天の川","雨宿","アメリカ","荒川匂","嵐山","新珠","有明",
    "アーコレード","伊豆最福寺枝垂","伊豆多賀赤","伊豆多賀白","伊豆吉野","市原虎の尾",
    "一葉","早晩山","伊東桜","糸括","イベンシー","妹背","妹背（平野神社妹背）","伊予薄墨",
    "上野白雪枝垂","ウォーウィック","鬱金","雨情枝垂","薄重大島","薄毛大島","薄墨",
    "薄紅深山桜","渦桜","ウミネコ","ウミネコ異種","雲竜大島","永源寺","蝦夷錦","江戸",
    "江戸彼岸（市房紅）","江戸彼岸（大桜）","江戸彼岸（向野）","江戸彼岸（山高神代桜）",
    "エレガンスみゆき","円通寺桜","奥州里桜","大内桜","大寒桜","大草小彼岸","大沢桜",
    "オオシマザクラ","太田桜","大提灯","大撫子","大南殿","大原渚","大原渚異種","大峰桜",
    "大村桜","オカメ","奥丁字桜","鴛鴦桜","小根山彼岸","お房桜","麻績の里舞台桜",
    "御室有明","思川","思伊出桜",
    # カ行(70)
    "掛川桜","カスミザクラ","片丘桜","勝浦雛桜","蒲桜","鎌足桜","上磯海潮桜","神岡桜",
    "神山枝垂桜","河津桜","寒咲大島","簪桜","関山","カンパニュロイデス","カンヒザクラ",
    "カンヒザクラ（台湾産）","含満桜","菊枝垂","貴船雲珠","麒麟","近畿豆桜","金龍桜",
    "祇王寺祇女桜","御衣黄","暁鐘","玖島桜","釧路八重","熊谷","熊谷桜","クマノザクラ",
    "クラマ","鞍馬雲珠","鞍馬桜（肥後吉野）","クルサル","呉羽おとめ枝垂","啓翁桜",
    "気多の白菊桜","血脈桜原木","煙山紅山桜","兼六園菊桜","兼六園熊谷","下馬桜異種",
    "紅華","幸福","苔清水","九重","小汐山","越の加茂桜","越の彼岸（木村株）",
    "越の彼岸（越村原木）","越の福重","越の冬桜","湖上の舞","胡蝶","琴平","木の花桜",
    "小花八重大島","小彼岸","子福桜","小松乙女","駒繋","小豆桜","コリングウッド イングラム",
    "コンラディナエ × スミッティ セミプレナ","コンラディナエ セミプレナ","極楽寺桜",
    "御座の間匂","五所桜","御信桜","御殿場桜",
    # サ行(58)
    "さきがけ","咲耶姫","笹賀鴛鴦桜","笹部桜","里原","佐野桜","四季咲丁字桜","四季咲伴氏",
    "四季桜","静香","静桜","静匂","四川省峨眉山産","枝垂桜","枝垂桜（大仙白）","しだれ彼岸",
    "枝垂富士桜","枝垂山桜（仙台枝垂）","シナミザクラ","芝山","朱雀","修善寺寒桜",
    "シュミッティイ","松月","松月異種","勝道桜","勝道彼岸","正福寺桜","昭和桜","ショーサイ",
    "白雪","白雪姫","白妙","白普賢","シロフゲン（カラムタウト樹木園）","シロフゲン（キューガーデン）",
    "新墨染","親鸞上人数珠掛桜","十月桜","上匂","神代曙","水晶","須磨浦普賢象","墨染匂",
    "駿河台匂","駿府桜","瑞泉寺冬桜","清明さくら","仙台屋","仙台吉野","専念寺緋桜",
    "千里香","善正寺菊桜","衣通姫","園里黄桜","園里緑龍","染井紅","染井吉野",
    # タ行(26)
    "泰山府君","太白","タイハク","太平桜","大漁桜","手弱女","高岡越の彼岸","高砂",
    "高遠小彼岸桜","高松稚児","類嵐","たつご里桜","済州桜","秩父桜","千原桜","長州緋桜",
    "チョウジザクラ","筑紫桜","突羽根（平野突羽根）","椿寒桜","鶴菊桜","手毬","天賜香",
    "東海桜","東京桜","桃源",
    # ナ行(7)
    "内藤大島","名島桜","奈良の八重桜","匂桜","日光桜","二度桜","野田の大桜",
    # ハ行(63)
    "白山旗桜","旗重大島","蜂須賀桜","初御代桜","華加賀美","花笠","花筺桜","浜岡早咲",
    "早咲八重大島","梅護寺数珠掛桜","萬里香","火打谷菊桜","彼岸台桜","日暮","ひたち雅",
    "雛菊桜（菊咲奥丁字桜）","姫の沢","ヒュペヘンシス","ヒュペヘンシス？","日吉桜","鵯桜",
    "弘前三段咲","弘前雪明かり","ピンク ウェーブ","ピンク クラウド","ピンク パーフェクション",
    "ファースト レディー","斑入桜（B）","斑入り枝垂桜","福桜","福禄寿","普賢象","房桜",
    "富士桜 黄白散斑","二上桜","船津13号","船津3号","船原吉野","冬桜","古里桜異種",
    "プシリフローラ × ユンナエンシス？","平七桜","紅笠","紅時雨","紅枝垂","紅玉錦",
    "紅提灯","紅鶴桜","紅手毬","紅花高盆桜桃？","紅豊","弁殿","箒桜","宝珠桜","ホクサイ",
    "ホクサイ異種","北鵬","穂咲彼岸八重桜","ホソカワベニ","細川匂","ホワイトファスティギアータ",
    "牡丹","ポンドＣ",
    # マ行(42)
    "舞姫","真桜","増山","松前","松前愛染","松前薄重染井","松前薄紅九重","松前大潮",
    "松前花山院","松前白絹","松前花染衣","松前花都","松前早咲","松前福寿桜","松前紅珠恵",
    "松前紅緋衣","松前紅紫","松前八重寿","真鶴桜","マノガ","マメザクラ","御帝吉野",
    "御車返し","三島富士見桜","実生無名（妹背729実生）","実生無名（妹背730実生）",
    "実生無名（奥州里桜1224実生）","実生無名（松前八重寿869実生）","実生無名（御車返し270実生）",
    "三ヶ日桜","緑桜","水上太白","身延桜","雅（プリンセス雅）","明正寺","明徳慈眼桜",
    "霧社桜","紫桜","明月","望月桜","盛岡枝垂","森小町",
    # ヤ行(25)
    "八重曙","八重寒緋桜","八重の大島","八重の豆桜","八重紅大島","八重紅枝垂",
    "八重紅枝垂(佐野系)","八重紅虎の尾","八重紅彼岸","八重深山桜","八重紫桜（小清水系）",
    "八重紫桜（富山林試系）","薬王寺八重","八房桜","山越桜","ヤマザクラ","夢萩桜","楊貴妃",
    "楊貴妃（江戸系）","陽光","陽春","養老桜","横浜緋桜","横輪桜","予野の八重桜",
    # ラ行(4)
    "来迎寺菊桜","蘭蘭","龍雲院紅八重桜","ロイヤルバーガンディ",
    # ワ行(5)
    "稚木の桜","鷲の尾","渡辺桜","ワダイ","ワビヒト",
]
print(f"花の会リスト: {len(HANANOKAI_VARIETIES)}件")

# ── 突合 ───────────────────────────────────────────────────────
unmatched = []
for name in HANANOKAI_VARIETIES:
    n = nrm(name)
    # 括弧付き品種は括弧なし版も照合
    n_base = re.sub(r'[（(【〔][^）)】〕]*[）)】〕]', '', name).strip()
    n_base_nrm = nrm(n_base)
    if n not in existing_nrm and n_base_nrm not in existing_nrm:
        unmatched.append(name)

print(f"未収録: {len(unmatched)}件")
for nm in unmatched:
    print(f"  - {nm}")

# ── ハノカイURLスラッグを逆引き（カテゴリページ取得済みリンクから） ──
# 花の会のURL形式: /sakura-zukan/{slug}/ → スラッグを取得するため
# 各カテゴリページをフェッチ
CATEGORY_URLS = [
    "https://www.hananokai.or.jp/sakura-zukan/category/a/",
    "https://www.hananokai.or.jp/sakura-zukan/category/ka/",
    "https://www.hananokai.or.jp/sakura-zukan/category/sa/",
    "https://www.hananokai.or.jp/sakura-zukan/category/ta/",
    "https://www.hananokai.or.jp/sakura-zukan/category/na/",
    "https://www.hananokai.or.jp/sakura-zukan/category/ha/",
    "https://www.hananokai.or.jp/sakura-zukan/category/ma/",
    "https://www.hananokai.or.jp/sakura-zukan/category/ya/",
    "https://www.hananokai.or.jp/sakura-zukan/category/ra/",
    "https://www.hananokai.or.jp/sakura-zukan/category/wa/",
]

print("\nカテゴリページからURL取得中...")
name_to_url = {}
HEADERS = {"User-Agent": "SakuraZukan/1.0 (research; contact: educational)"}

for cat_url in CATEGORY_URLS:
    try:
        req = urllib.request.Request(cat_url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode('utf-8', errors='replace')
        # <a href="/sakura-zukan/XXX/">NAME</a> を抽出
        links = re.findall(r'<a href="(/sakura-zukan/[^/]+/)"[^>]*>([^<]+)</a>', html)
        for href, nm in links:
            nm_clean = nm.strip()
            if nm_clean and 'category' not in href and 'list' not in href:
                name_to_url[nm_clean] = 'https://www.hananokai.or.jp' + href
        time.sleep(1)
    except Exception as e:
        print(f"  ERROR {cat_url}: {e}")

print(f"  URL取得: {len(name_to_url)}件")

# 未収録品種のURLを特定
unmatched_with_url = []
for name in unmatched:
    url = name_to_url.get(name)
    # 括弧なし版でも試す
    if not url:
        base = re.sub(r'[（(【〔][^）)】〕]*[）)】〕]', '', name).strip()
        url = name_to_url.get(base)
    unmatched_with_url.append((name, url))
    print(f"  {name}: {url or '(URL不明)'}")

# ── 詳細ページスクレイプ ────────────────────────────────────────
def fetch_detail(url):
    """花の会詳細ページから品種情報を取得"""
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode('utf-8', errors='replace')
        return html
    except Exception as e:
        print(f"    fetch error {url}: {e}")
        return None

def parse_detail(html, name, url):
    """HTMLから品種情報をパース"""
    info = {'name': name, 'source_url': url}

    # 読み (ふりがな)
    m = re.search(r'<span[^>]*class="[^"]*furigana[^"]*"[^>]*>([^<]+)</span>', html)
    if not m:
        m = re.search(r'ふりがな[^>]*>[^<]*<[^>]+>([ぁ-ん\s]+)', html)
    if m:
        info['reading'] = m.group(1).strip()

    # テーブル行から各フィールドを抽出
    rows = re.findall(r'<th[^>]*>([^<]+)</th>\s*<td[^>]*>(.*?)</td>', html, re.DOTALL)
    for th, td in rows:
        th = th.strip()
        td_text = re.sub(r'<[^>]+>', '', td).strip()
        td_text = re.sub(r'\s+', ' ', td_text)
        if '開花時期' in th or '開花期' in th:
            info['bloomSeason'] = td_text
        elif '花色' in th:
            info['color'] = td_text
        elif '花型' in th or '花形' in th:
            info['flowerShape'] = td_text
        elif '来歴' in th or '育成' in th:
            info['history'] = td_text
        elif '特徴' in th:
            info['features'] = td_text
        elif '別名' in th:
            info['aliases'] = [a.strip() for a in re.split(r'[、,，]', td_text) if a.strip()]
        elif '学名' in th:
            info['gakumei'] = td_text

    # summary: metaタグから
    m = re.search(r'<meta name="description" content="([^"]+)"', html)
    if m:
        info['summary'] = m.group(1).strip()[:100]

    # ページ内の説明文（.entry-content の最初のp）
    m = re.search(r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>\s*<p[^>]*>(.*?)</p>', html, re.DOTALL)
    if m:
        txt = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        if len(txt) > 20:
            info['description'] = txt[:300]

    return info

def color_to_code(color):
    MAP = {
        '白': '#FFFFFF', '淡紅': '#FFB7C5', '淡紅色': '#FFB7C5',
        '紅': '#E8274B', '紅色': '#E8274B', '濃紅': '#C0003C',
        'ピンク': '#FF9EC4', '桃色': '#FF9EC4', '桃': '#FF9EC4',
        '薄紅': '#FFB7C5', '黄緑': '#9DC44A', '緑': '#5A8F3C',
        '黄': '#F5D800', '淡黄': '#F5EBA0', '白緑': '#D4EBC1',
        '紫': '#9B59B6', '淡紫': '#D7A8E0',
    }
    for k, v in MAP.items():
        if k in (color or ''):
            return v
    return '#FFB7C5'

def bloom_period_from_season(season):
    """開花時期文字列 → bloomPeriod オブジェクト"""
    if not season:
        return {"start": None, "end": None, "secondary": None, "regionNote": None}
    s = season
    def month_code(text):
        for m in ['1','2','3','4','5','6','7','8','9','10','11','12']:
            if f'{m}月' in text:
                mn = int(m)
                if '上旬' in text: sfx = 'early'
                elif '下旬' in text: sfx = 'late'
                else: sfx = 'mid'
                return f'{mn:02d}-{sfx}'
        return None
    start = month_code(s)
    return {"start": start, "end": start, "secondary": None, "regionNote": None}

# ── 未収録品種を追加 ────────────────────────────────────────────
print(f"\n詳細ページ取得・追加中...")
max_no = max(int(v.get('no','0')) for v in varieties if v.get('no','').isdigit())
added_count = 0
log_rows = []

for name, url in unmatched_with_url:
    print(f"  [{name}]", end=' ')
    html = fetch_detail(url)
    time.sleep(1.2)

    info = parse_detail(html, name, url) if html else {'name': name}

    # ID生成（読みのローマ字は使えないのでname-hashで代替）
    import hashlib
    slug = re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD', name).encode('ascii','ignore').decode().lower()).strip('-')
    if not slug:
        slug = 'hananokai-' + hashlib.md5(name.encode()).hexdigest()[:8]
    # 重複ID回避
    existing_ids = {v['id'] for v in varieties}
    base_slug = slug
    i = 2
    while slug in existing_ids:
        slug = f"{base_slug}-{i}"; i += 1

    max_no += 1
    color = info.get('color', '')
    new_v = {
        "id": slug,
        "no": str(max_no),
        "name": name,
        "reading": info.get('reading', ''),
        "bloomSeason": info.get('bloomSeason', ''),
        "color": color,
        "colorCode": color_to_code(color),
        "flowerShape": info.get('flowerShape', ''),
        "tags": ["日本花の会掲載"],
        "summary": info.get('summary', f'{name}。日本花の会桜図鑑掲載品種。'),
        "features": info.get('features', '') or info.get('description', ''),
        "history": info.get('history', ''),
        "background": f"出典: 日本花の会 桜図鑑 {url or ''}",
        "trivia": "",
        "wikiTitleJa": None,
        "wikiTitleEn": None,
        "emoji": "🌸",
        "aliases": info.get('aliases', []),
        "bloomPeriod": bloom_period_from_season(info.get('bloomSeason','')),
        "images": [],
        "hasImage": False
    }
    varieties.append(new_v)
    added_count += 1
    print(f"→ {slug} (no={max_no})")
    log_rows.append([slug, name, 'hananokai', 'phase2'])

# ── 保存 ───────────────────────────────────────────────────────
with open(VAR_PATH, 'w', encoding='utf-8') as f:
    json.dump(varieties, f, ensure_ascii=False, indent=2)
print(f"\nvarieties.json 保存: {len(varieties)}品種 (+{added_count}件)")

# CSV追記
with open(CSV_PATH, 'a', encoding='utf-8-sig', newline='') as f:
    w = csv.writer(f)
    w.writerows(log_rows)
print(f"CSV追記: {len(log_rows)}件 → {CSV_PATH}")
