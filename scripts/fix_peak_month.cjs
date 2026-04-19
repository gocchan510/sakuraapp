/**
 * spots.json の peakMonth をテキスト → 数値に正規化するスクリプト。
 *
 * 変換ロジック:
 *   1. 文字列から `N月` パターンをすべて抽出
 *   2. 最後に登場する月（= 見頃の終端 = ピーク）を使用
 *   3. 抽出できなければ null
 *
 * 実行: node scripts/fix_peak_month.cjs
 */

const fs   = require('fs')
const path = require('path')

const SPOTS_PATH = path.resolve(__dirname, '..', 'src', 'data', 'spots.json')

function extractPeakMonth(raw) {
  if (raw === null || raw === undefined) return null
  const s = String(raw)

  // 数値のみの場合はそのまま
  const asNum = parseInt(s, 10)
  if (!isNaN(asNum) && String(asNum) === s.trim()) {
    return (asNum >= 1 && asNum <= 12) ? asNum : null
  }

  // "N月" をすべて抽出し、最後の月をpeakとして使用
  const matches = [...s.matchAll(/(\d{1,2})月/g)].map(m => parseInt(m[1], 10))
  if (matches.length === 0) return null

  const peak = matches[matches.length - 1]
  return (peak >= 1 && peak <= 12) ? peak : null
}

const spots = JSON.parse(fs.readFileSync(SPOTS_PATH, 'utf-8'))

let fixed = 0, nulled = 0, unchanged = 0
const distribution = {}

const updated = spots.map(spot => {
  const original = spot.peakMonth
  const newVal   = extractPeakMonth(original)

  if (typeof original === 'number') {
    unchanged++
    distribution[original] = (distribution[original] || 0) + 1
    return spot
  }

  if (newVal !== null) {
    fixed++
    distribution[newVal] = (distribution[newVal] || 0) + 1
  } else {
    nulled++
  }

  return { ...spot, peakMonth: newVal }
})

fs.writeFileSync(SPOTS_PATH, JSON.stringify(updated, null, 2), 'utf-8')

console.log(`✅ 完了:`)
console.log(`   修正: ${fixed}件`)
console.log(`   null化: ${nulled}件`)
console.log(`   元々数値: ${unchanged}件`)
console.log(`\n月別分布:`)
Object.keys(distribution).sort((a,b)=>Number(a)-Number(b)).forEach(m => {
  console.log(`   ${m}月: ${distribution[m]}件`)
})
