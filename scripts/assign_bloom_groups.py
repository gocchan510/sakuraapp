#!/usr/bin/env python3
"""
assign_bloom_groups.py
varieties.json の全品種に bloomGroup を付与し、bloomPeriod を削除する。
someiyoshinoOffset フィールドは全品種 null にする（将来の個別研究用）。
"""

import json
import collections
import sys

sys.stdout.reconfigure(encoding='utf-8')

VARIETIES_PATH = 'C:/Users/pcyus/Documents/sakura-app/src/data/varieties.json'


def classify(name, vid, tags, bp_start, bp_end, summary, features):
    tags_set = set(tags)
    start_mon = int(bp_start[:2]) if bp_start else 6
    start_jun = bp_start[3:] if bp_start else ''

    # 1. 二季咲き
    if '二季咲き' in tags_set or start_mon >= 10:
        return 'fuyu'

    # 2. カンヒザクラ系（1〜2月咲き含む）
    if 'カンヒザクラ系' in tags_set or start_mon <= 2 \
       or any(k in name for k in ['寒緋', '河津', 'カワヅ', '緋寒']):
        return 'kanhizakura'

    # 3. エドヒガン・シダレ系
    if 'エドヒガン系' in tags_set:
        return 'edohigan'
    if '枝垂れ' in tags_set and start_mon <= 3:
        return 'edohigan'
    if bp_start in ('03-early',) and '枝垂れ' in tags_set:
        return 'edohigan'

    # 4. ソメイヨシノ
    if 'ソメイヨシノ系' in tags_set or vid == 'someiyoshino' or name == 'ソメイヨシノ':
        return 'someiyoshino'

    # 5. ヤマザクラ・オオシマ系
    if 'ヤマザクラ系' in tags_set or 'オオシマザクラ系' in tags_set:
        return 'yamazakura'

    # 6. マメザクラ・カスミザクラ系
    if 'マメザクラ系' in tags_set or 'カスミザクラ系' in tags_set:
        return 'kasumizakura'
    if start_mon == 5 and start_jun in ('mid', 'late'):
        return 'kasumizakura'

    # 7. サトザクラ系の細分類（bloomPeriodで判断）
    # sato-early: 03-late 〜 04-early, or 04-mid で end が 04-mid以下
    if bp_start in ('03-late', '04-early'):
        return 'sato-early'
    if bp_start == '04-mid':
        if bp_end in ('04-mid', '04-early', '03-late'):
            return 'sato-early'
        else:
            return 'sato-mid'
    if bp_start == '04-late':
        return 'sato-mid'
    if start_mon == 5 and start_jun == 'early':
        return 'sato-late'
    if start_mon == 5:
        return 'sato-late'

    # 03-mid はソメイヨシノ系が多い
    if bp_start == '03-mid':
        return 'someiyoshino'
    if bp_start == '03-early':
        return 'edohigan'

    return 'unknown'


def main():
    with open(VARIETIES_PATH, encoding='utf-8') as f:
        data = json.load(f)

    print(f'Loaded {len(data)} varieties')

    group_counts = collections.Counter()
    unknown_names = []

    for v in data:
        bp = v.get('bloomPeriod')
        bp_start = bp['start'] if bp else None
        bp_end = bp['end'] if bp else None

        group = classify(
            name=v.get('name', ''),
            vid=v.get('id', ''),
            tags=v.get('tags', []),
            bp_start=bp_start,
            bp_end=bp_end,
            summary=v.get('summary', ''),
            features=v.get('features', ''),
        )

        v['bloomGroup'] = group
        v['someiyoshinoOffset'] = None

        # bloomPeriod を削除
        if 'bloomPeriod' in v:
            del v['bloomPeriod']

        group_counts[group] += 1
        if group == 'unknown':
            unknown_names.append(v.get('name', ''))

    # 書き出し
    with open(VARIETIES_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print('\n=== bloomGroup 分類結果サマリー ===')
    for group, cnt in sorted(group_counts.items(), key=lambda x: -x[1]):
        print(f'  {group:20s}: {cnt:4d}件')
    print(f'  {"合計":20s}: {sum(group_counts.values()):4d}件')

    if unknown_names:
        print(f'\n=== unknown ({len(unknown_names)}件) 代表例 ===')
        for name in unknown_names[:10]:
            print(f'  - {name}')

    print('\n完了: varieties.json を更新しました')


if __name__ == '__main__':
    main()
