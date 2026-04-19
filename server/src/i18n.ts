// 通知文言の多言語対応
import type { Lang } from './firestore.ts'
import type { BloomStatus } from '../../shared/spotBloom.ts'

export function notifyTitle(lang: Lang, status: BloomStatus): string {
  if (status === 'in_bloom') {
    return { ja: '🌸 満開になりました！', en: '🌸 Now in full bloom!', 'zh-TW': '🌸 櫻花盛開了！' }[lang]
  }
  if (status === 'opening') {
    return { ja: '🌸 咲き始めました', en: '🌸 Cherry blossoms opening', 'zh-TW': '🌸 櫻花開始綻放' }[lang]
  }
  return { ja: '🌸 桜情報', en: '🌸 Sakura update', 'zh-TW': '🌸 櫻花資訊' }[lang]
}

export function notifyBody(
  lang: Lang,
  spotName: string,
  status: BloomStatus,
  varieties: string[] = [],
): string {
  const vjoin = (sep: string) => (varieties.length > 0 ? varieties.join(sep) : '')

  if (lang === 'en') {
    const v = vjoin(', ')
    const vPart = v ? ` Varieties: ${v}.` : ''
    if (status === 'in_bloom') return `${spotName} is in full bloom now. Go see it this weekend!${vPart}`
    if (status === 'opening') return `${spotName} is starting to bloom.${vPart}`
    return `${spotName} has a sakura update.${vPart}`
  }
  if (lang === 'zh-TW') {
    const v = vjoin('、')
    const vPart = v ? `（品種：${v}）` : ''
    if (status === 'in_bloom') return `${spotName}現在盛開中，週末快去賞櫻吧！${vPart}`
    if (status === 'opening') return `${spotName}開始綻放了。${vPart}`
    return `${spotName}有櫻花資訊更新。${vPart}`
  }
  // ja
  const v = vjoin('・')
  const vPart = v ? `（品種：${v}）` : ''
  if (status === 'in_bloom') return `${spotName}が満開です。この週末、見に行きませんか？${vPart}`
  if (status === 'opening') return `${spotName}が咲き始めました。${vPart}`
  return `${spotName}の桜情報が更新されました。${vPart}`
}
