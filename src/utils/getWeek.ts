/**
 * 今日の日付から spots.json の週インデックス（0〜47）を返す
 * index = (month - 1) * 4 + (weekInMonth - 1)
 */
export function getCurrentWeekIndex(): number {
  const today = new Date()
  const month = today.getMonth() + 1
  const day = today.getDate()
  const weekInMonth = Math.min(Math.ceil(day / 7), 4)
  return (month - 1) * 4 + (weekInMonth - 1)
}

/** インデックス（0〜47）→「N月第X週」ラベル */
export function getWeekLabel(index: number): string {
  const month = Math.floor(index / 4) + 1
  const weekInMonth = (index % 4) + 1
  return `${month}月第${weekInMonth}週`
}

/** 「N月第X週」ラベル → インデックス（0〜47）。一致しなければ -1 */
export function getWeekIndex(label: string): number {
  const m = label.match(/^(\d+)月第(\d+)週$/)
  if (!m) return -1
  return (Number(m[1]) - 1) * 4 + (Number(m[2]) - 1)
}

/** 全48週のラベル一覧 */
export const ALL_WEEK_LABELS: string[] = Array.from({ length: 48 }, (_, i) => getWeekLabel(i))
