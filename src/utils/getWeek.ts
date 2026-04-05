/**
 * 今日の日付から spots.json の配列インデックス（0〜47）を返す
 * 月ごとに4週固定: index = (month - 1) * 4 + (weekInMonth - 1)
 */
export function getCurrentWeekIndex(): number {
  const today = new Date()
  const month = today.getMonth() + 1 // 1〜12
  const day = today.getDate()
  const weekInMonth = Math.min(Math.ceil(day / 7), 4) // 1〜4（29日以降も第4週に収める）
  return (month - 1) * 4 + (weekInMonth - 1)
}
