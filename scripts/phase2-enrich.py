#!/usr/bin/env python3
"""Phase 2: 26件の仮IDを正式IDに置き換え、花の会APIから詳細情報を補完"""
import urllib.request, json, re, time

ROOT     = r'C:\Users\pcyus\Documents\sakura-app'
VAR_PATH = ROOT + r'\src\data\varieties.json'

BASE = 'https://www.hananokai.or.jp/sakura-zukan/wp-json/wp/v2/posts'
HDR  = {'User-Agent': 'Mozilla/5.0'}

# 全ポスト取得
all_posts = []
for page in range(1, 5):
    url = f'{BASE}?per_page=100&page={page}&_fields=slug,title,content,excerpt'
    req = urllib.request.Request(url, headers=HDR)
    with urllib.request.urlopen(req, timeout=15) as r:
        all_posts.extend(json.loads(r.read()))
    time.sleep(0.5)
slug_to_post = {p['slug']: p for p in all_posts}
print(f'API取得: {len(all_posts)}件')

SLUG_MAP = {
    '彼岸台桜':                     'higan-dai-zakura',
    'ヒュペヘンシス？':              'hupehensis-1',
    '鵯桜':                         'hiyodorizakura',
    '弘前雪明かり':                  'hirosaki-yukiakari',
    '斑入り枝垂桜':                  'fuiri-shidare-zakura',
    '富士桜 黄白散斑':               'fujizakura-ohaku-chirifu',
    'プシリフローラ × ユンナエンシス？': 'pusilliflora-yunnanensis',
    '紅花高盆桜桃？':                'benibana-koubon-outou',
    '宝珠桜':                        'hoshu-zakura',
    'ホクサイ':                      'hokusai',
    'ホクサイ異種':                  'hokusai-isyu',
    '北鵬':                          'hokuho',
    'ホソカワベニ':                   'hosokawa-beni',
    '増山':                          'masuyama',
    '松前大潮':                       'matsumae-osio',
    '松前花染衣':                     'matsumae-hanazomei',
    '松前紅珠恵':                     'matsumae-benitamae',
    '実生無名（妹背729実生）':        'mishoumumei-imose729',
    '実生無名（妹背730実生）':        'mishoumumei-imose730',
    '実生無名（奥州里桜1224実生）':   'mishoumumei-oushusatozakura1224',
    '実生無名（松前八重寿869実生）':  'mishoumumei-matsumaeyaekotobuki869',
    '実生無名（御車返し270実生）':    'mishoumumei-mikurumagaeshi270',
    '明正寺':                         'myoshoji',
    '明徳慈眼桜':                     'myotoku-jigenzakura',
    '霧社桜':                         'mushazakura',
    '森小町':                         'morikomachi',
}

OLD_ID_MAP = {
    '彼岸台桜':                     'hananokai-898e986c',
    'ヒュペヘンシス？':              'hananokai-89262331',
    '鵯桜':                         'hananokai-6f57a8cf',
    '弘前雪明かり':                  'hananokai-89341e6b',
    '斑入り枝垂桜':                  'hananokai-c798e897',
    '富士桜 黄白散斑':               'hananokai-1f58aa84',
    'プシリフローラ × ユンナエンシス？': 'hananokai-08ff7e85',
    '紅花高盆桜桃？':                'hananokai-7c430f92',
    '宝珠桜':                        'hananokai-9c19f6b6',
    'ホクサイ':                      'hananokai-5ef1d7c4',
    'ホクサイ異種':                  'hananokai-c24a9a3a',
    '北鵬':                          'hananokai-eb4269d3',
    'ホソカワベニ':                   'hananokai-2f1d9176',
    '増山':                          'hananokai-057539be',
    '松前大潮':                       'hananokai-16e62abe',
    '松前花染衣':                     'hananokai-dcbdbaec',
    '松前紅珠恵':                     'hananokai-eda3eee4',
    '実生無名（妹背729実生）':        '729',
    '実生無名（妹背730実生）':        '730',
    '実生無名（奥州里桜1224実生）':   '1224',
    '実生無名（松前八重寿869実生）':  '869',
    '実生無名（御車返し270実生）':    '270',
    '明正寺':                         'hananokai-5ed43f2d',
    '明徳慈眼桜':                     'hananokai-dc4df304',
    '霧社桜':                         'hananokai-07dc44ed',
    '森小町':                         'hananokai-ead6dabc',
}

def clean(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    return re.sub(r'\s+', ' ', s).strip()

def parse_content(html):
    info = {}
    rows = re.findall(r'<th[^>]*>(.*?)</th>\s*<td[^>]*>(.*?)</td>', html, re.DOTALL)
    for th, td in rows:
        th_t = clean(th); td_t = clean(td)
        if any(k in th_t for k in ['読み','ふりがな','よみ']):
            info['reading'] = td_t
        elif '開花' in th_t:
            info['bloomSeason'] = td_t
        elif '花色' in th_t:
            info['color'] = td_t
        elif any(k in th_t for k in ['花型','花形','咲き方']):
            info['flowerShape'] = td_t
        elif any(k in th_t for k in ['来歴','育成','発見']):
            info['history'] = td_t
        elif '特徴' in th_t:
            info['features'] = td_t
        elif '別名' in th_t:
            info['aliases_raw'] = td_t
    paras = [clean(p) for p in re.findall(r'<p[^>]*>(.*?)</p>', html, re.DOTALL) if len(clean(p)) > 30]
    if paras and not info.get('features'):    info['features'] = paras[0][:300]
    if len(paras) > 1 and not info.get('history'): info['history'] = paras[1][:200]
    return info

def color_code(c):
    for k, v in [('白','#FFFFFF'),('淡紅','#FFB7C5'),('紅','#E8274B'),('濃紅','#C0003C'),
                 ('ピンク','#FF9EC4'),('桃','#FF9EC4'),('黄緑','#9DC44A'),
                 ('緑','#5A8F3C'),('黄','#F5D800'),('紫','#9B59B6'),('淡紫','#D7A8E0')]:
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

# varieties.json 更新
varieties = json.loads(open(VAR_PATH, encoding='utf-8').read())
var_by_id = {v['id']: v for v in varieties}

updated = 0
for name, old_id in OLD_ID_MAP.items():
    new_id = SLUG_MAP[name]
    post   = slug_to_post.get(new_id)

    if old_id not in var_by_id:
        print(f'  SKIP (not found): {old_id}')
        continue

    v    = var_by_id.pop(old_id)
    info = parse_content(post['content']['rendered']) if post else {}
    summary = clean(post['excerpt']['rendered'])[:120] if post else ''

    v['id']         = new_id
    if info.get('reading'):     v['reading']     = info['reading']
    if info.get('bloomSeason'): v['bloomSeason'] = info['bloomSeason']
    if info.get('color'):
        v['color']     = info['color']
        v['colorCode'] = color_code(info['color'])
    if info.get('flowerShape'): v['flowerShape'] = info['flowerShape']
    if info.get('features'):    v['features']    = info['features']
    if info.get('history'):     v['history']     = info['history']
    if summary:                 v['summary']     = summary
    if info.get('aliases_raw'):
        v['aliases'] = [a.strip() for a in re.split(r'[、,，]', info['aliases_raw']) if a.strip()]
    v['bloomPeriod'] = bloom_period(v.get('bloomSeason',''))
    v['background']  = f"出典: 日本花の会 桜図鑑 https://www.hananokai.or.jp/sakura-zukan/{new_id}/"

    var_by_id[new_id] = v
    updated += 1
    print(f'  ✓ {name}: {old_id} -> {new_id}  読み={v.get("reading","")}  開花={v.get("bloomSeason","")}')

varieties = sorted(var_by_id.values(), key=lambda v: int(v.get('no','999')) if str(v.get('no','')).isdigit() else 999)

with open(VAR_PATH, 'w', encoding='utf-8') as f:
    json.dump(varieties, f, ensure_ascii=False, indent=2)

print(f'\n完了: {updated}件更新, 総{len(varieties)}品種')
