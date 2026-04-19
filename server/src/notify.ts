// 日次ジョブ: 全購読を走査し、遷移検知 → Push 送信
import { iterateSubscriptions, updateLastNotified } from './firestore.ts'
import { sendPush } from './push.ts'
import { getSpot, getVarietyNames } from './spotLookup.ts'
import { computeSpotBloom, type BloomStatus } from '../../shared/spotBloom.ts'
import { notifyTitle, notifyBody } from './i18n.ts'

const APP_ORIGIN = 'https://gocchan510.github.io/sakuraapp'
const ICON_URL = `${APP_ORIGIN}/icon-192.png`
const BADGE_URL = `${APP_ORIGIN}/icon-192.png`

// 通知すべき遷移: 何も無い → in_bloom / budding → in_bloom / opening → in_bloom など
// シンプルに「前回通知時と違う&今日が見頃系ステータス」で判定
const NOTIFY_STATUSES: BloomStatus[] = ['in_bloom', 'opening']

export interface NotifyResult {
  subscriptionsProcessed: number
  notificationsSent: number
  subscriptionsRemoved: number
  errors: number
}

export async function runDailyNotify(today = new Date()): Promise<NotifyResult> {
  const result: NotifyResult = {
    subscriptionsProcessed: 0,
    notificationsSent: 0,
    subscriptionsRemoved: 0,
    errors: 0,
  }

  for await (const sub of iterateSubscriptions()) {
    result.subscriptionsProcessed += 1
    let subGone = false

    for (const spotId of sub.favoriteSpotIds ?? []) {
      if (subGone) break
      const spot = getSpot(spotId)
      if (!spot) continue

      const bloom = computeSpotBloom(spot, today)
      if (!NOTIFY_STATUSES.includes(bloom.status)) continue

      const last = sub.lastNotified?.[spotId]
      // 同じステータスで既に通知済みならスキップ
      if (last && last.status === bloom.status) continue

      const title = notifyTitle(sub.lang, bloom.status)
      const varieties = getVarietyNames(spot.varieties, sub.lang, 3)
      const body  = notifyBody(sub.lang, spot.name, bloom.status, varieties)
      const url = `${APP_ORIGIN}/#/map?spot=${encodeURIComponent(spotId)}`

      const res = await sendPush({
        subId: sub.id,
        endpoint: sub.endpoint,
        keys: sub.keys,
        payload: {
          title,
          body,
          icon: ICON_URL,
          badge: BADGE_URL,
          url,
          tag: `bloom-${spotId}`,
        },
      })

      if (res.ok) {
        result.notificationsSent += 1
        await updateLastNotified(sub.id, spotId, bloom.status).catch(() => {
          result.errors += 1
        })
        // 1日1通まで：1件送ったらこの購読は終了
        break
      } else if (res.gone) {
        result.subscriptionsRemoved += 1
        subGone = true
      } else {
        result.errors += 1
      }
    }
  }

  return result
}
