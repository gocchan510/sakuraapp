/**
 * 日付 → 「N月第K週」ラベルに変換
 * 1〜7日=第1週, 8〜14日=第2週, 15〜21日=第3週, 22日以降=第4週
 */
export function dateToWeekLabel(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const week = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : 4
  return `${month}月第${week}週`
}

/**
 * 指定の年月のカレンダー用セル配列を返す。
 * 日曜始まり。月の前後の余白は null で埋める。
 * 配列長は必ず 7 の倍数。
 */
export function getCalendarMonth(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()
  const startDow = firstDay.getDay() // 0 = 日曜

  const cells: (Date | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(year, month - 1, d))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/** 同じ日かどうか判定 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Date → "YYYY-MM-DD" 文字列 */
export function formatDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** "YYYY-MM-DD" → Date */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** "YYYY-MM-DD" → "4月5日（日）" 表示用文字列 */
export function formatDateDisplay(s: string, lang = 'ja'): string {
  const date = parseDateStr(s)
  const m = date.getMonth() + 1
  const d = date.getDate()
  const DOW_JA = ['日', '月', '火', '水', '木', '金', '土']
  const DOW_ZH = ['日', '一', '二', '三', '四', '五', '六']
  const dow = (lang === 'zh-TW' ? DOW_ZH : DOW_JA)[date.getDay()]
  return `${m}月${d}日（${dow}）`
}
