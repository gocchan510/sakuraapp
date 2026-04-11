#!/usr/bin/env python3
"""花の会詳細ページをスクレイプしてPhase2追加品種の情報を補完"""
import urllib.request, json, re, time

ROOT     = r'C:\Users\pcyus\Documents\sakura-app'
VAR_PATH = ROOT + r'\src\data\varieties.json'
HDR = {'User-Agent': 'Mozilla/5.0'}

SLUG_MAP = {
    '彼岸台桜': 'higan-dai-zakura',
    'ヒュペヘンシス？': 'hupehensis-1',
    '鵯桜': 'hiyodorizakura',
    '弘前雪明かり': 'hirosaki-yukiakari',
    '斑入り枝垂桜': 'fuiri-shidare-zakura',
    '富士桜 黄白散斑': 'fujizakura-ohaku-chirifu',
    'プシリフローラ × ユンナエンシス？': 'pusilliflora-yunnanensis',
    '紅花高盆桜桃？': 'benibana-koubon-outou',
    '宝珠桜': 'hoshu-zakura',
    'ホクサイ': 'hokusai',
    'ホクサイ異種': 'hokusai-isyu',
    '北鵬': 'hokuho',
    'ホソカワベニ': 'hosokawa-beni',
    '増山': 'masuyama',
    '松前大潮': 'matsumae-osio',
    '松前花染衣': 'matsumae-hanazomei',
    '松前紅珠恵': 'matsumae-benitamae',
    '実生無名（妹背729実生）': 'mishoumumei-imose729',
    '実生無名（妹背730実生）': 'mishoumumei-imose730',
    '実生無名（奥州里桜1224実生）': 'mishoumumei-oushusatozakura1224',
    '実生無名（松前八重寿869実生）': 'mishoumumei-matsumaeyaekotobuki869',
    '実生無名（御車返し270実生）': 'mishoumumei-mikurumagaeshi270',
    '明正寺': 'myoshoji',
    '明徳慈眼桜': 'myotoku-jigenzakura',
    '霧社桜': 'mushazakura',
    '森小町': 'morikomachi',
}

def clean(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s or '')).strip()

def parse_hananokai(html, name):
    info = {'name': name}
    m = re.search(r'<section id="detail">(.*?)</section>', html, re.DOTALL)
    if not m:
        return info
    detail = m.group(1)

    # DL/DD構造: <dt>KEY</dt><dd>VALUE</dd>
    pairs = re.findall(r'<dt>(.*?)</dt>\s*<dd>(.*?)</dd>', detail, re.DOTALL)
    for dt, dd in pairs:
        key = clean(dt)
        val = clean(dd)
        if 'フリガナ' in key or 'ふりがな' in key or '読み' in key:
            info['reading'] = val
        elif '学名' in key:
            info['gakumei'] = val
        elif '樹形' in key:
            info['treeshape'] = val
        elif '花形' in key or '花型' in key or '咲き方' in key:
            info['flowerShape'] = val
        elif '花の大きさ' in key or '花径' in key:
            info['flowerSize'] = val
        elif '花色' in key:
            info['color'] = val
        elif '開花期' in key or '開花時期' in key:
            info['bloomSeason'] = val
        elif '来歴' in key or '育成' in key:
            info['history'] = val

    # 説明文 (p タグ)
    paras = re.findall(r'<p[^>]*>(.*?)</p>', detail, re.DOTALL)
    txts = [clean(p) for p in paras if len(clean(p)) > 20]
    if txts:
        info['features'] = txts[0][:400]

    # 画像URL
    img_m = re.search(r'<img src="(https://www\.hananokai[^"]+\.jpg)"', detail)
    if img_m:
        info['imageUrl'] = img_m.group(1)

    return info

def color_code(c):
    for k, v in [('白','#FFFFFF'),('淡紅','#FFB7C5'),('微淡紅','#FFD0DC'),
                 ('紅','#E8274B'),('濃紅','#C0003C'),('ピンク','#FF9EC4'),
                 ('桃','#FF9EC4'),('黄緑','#9DC44A'),('緑','#5A8F3C'),
                 ('黄','#F5D800'),('紫','#9B59B6'),('淡紫','#D7A8E0')]:
        if k in (c or ''): return v
    return '#FFB7C5'

def bloom_period(s):
    def mc(t):
        for m in range(1,13):
            if f'{m}月' in t:
                sfx = 'early' if '上旬' in t else 'late' if '下旬' in t else 'mid'
                return f'{m:02d}-{sfx}'
        return None
    return {"start": mc(s or ''), "end": mc(s or ''), "secondary": None, "regionNote": None}

def build_tags(info):
    tags = ['日本花の会掲載']
    fs = info.get('flowerShape','')
    sz = info.get('flowerSize','')
    cl = info.get('color','')
    if '八重' in fs: tags.append('八重咲き')
    elif '一重' in fs: tags.append('一重')
    elif '半八重' in fs: tags.append('半八重')
    if '大輪' in sz: tags.append('大輪')
    elif '中輪' in sz: tags.append('中輪')
    elif '小輪' in sz: tags.append('小輪')
    if '白' in cl: tags.append('白')
    return tags

# varieties.json 更新
varieties = json.loads(open(VAR_PATH, encoding='utf-8').read())
var_by_id = {v['id']: v for v in varieties}

updated = 0
for name, slug in SLUG_MAP.items():
    if slug not in var_by_id:
        print(f'  SKIP (not in db): {slug}')
        continue

    url = f'https://www.hananokai.or.jp/sakura-zukan/{slug}/'
    print(f'  [{name}] {url}', end=' ')
    try:
        req = urllib.request.Request(url, headers=HDR)
        with urllib.request.urlopen(req, timeout=15) as r:
            html = r.read().decode('utf-8','replace')
        info = parse_hananokai(html, name)
        time.sleep(1.2)
    except Exception as e:
        print(f'ERROR: {e}')
        continue

    v = var_by_id[slug]
    if info.get('reading'):     v['reading']     = info['reading']
    if info.get('bloomSeason'): v['bloomSeason'] = info['bloomSeason']
    if info.get('color'):
        v['color']     = info['color']
        v['colorCode'] = color_code(info['color'])
    if info.get('flowerShape'): v['flowerShape'] = info['flowerShape']
    if info.get('features'):    v['features']    = info['features']
    if info.get('gakumei'):     v['wikiTitleEn'] = info['gakumei']
    if not v.get('summary') and info.get('features'):
        v['summary'] = info['features'][:80]
    v['tags']        = build_tags(info)
    v['bloomPeriod'] = bloom_period(v.get('bloomSeason',''))
    v['background']  = f"出典: 日本花の会 桜図鑑 {url}"
    updated += 1

    reading = info.get('reading','')
    bloom   = info.get('bloomSeason','')
    color   = info.get('color','')
    shape   = info.get('flowerShape','')
    print(f'読み={reading}  開花={bloom}  色={color}  花形={shape}')

varieties = sorted(var_by_id.values(), key=lambda v: int(v.get('no','999')) if str(v.get('no','')).isdigit() else 999)

with open(VAR_PATH, 'w', encoding='utf-8') as f:
    json.dump(varieties, f, ensure_ascii=False, indent=2)

print(f'\n完了: {updated}件更新, 総{len(varieties)}品種')
