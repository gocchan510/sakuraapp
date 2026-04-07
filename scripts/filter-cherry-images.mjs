/**
 * imageUrl のファイル名に桜キーワードが含まれないものを null に戻す
 * 実行: node scripts/filter-cherry-images.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SPOTS_PATH = path.join(__dirname, '../src/data/spots.json')

function isCherryBlossomUrl(url) {
  if (!url) return false
  // URLからファイル名部分を取り出す
  const decoded = decodeURIComponent(url)
  const lower = decoded.toLowerCase()
  return (
    lower.includes('sakura') ||
    lower.includes('cherry') ||
    lower.includes('blossom') ||
    lower.includes('hanami') ||
    lower.includes('桜') ||
    lower.includes('cherryblossom') ||
    // NDL（国立国会図書館）のデジタルアーカイブ: 古い桜の写真が多い
    // ただし内容不明なので保留
    lower.includes('_sakura') ||
    lower.includes('sakura_')
  )
}

const spots = JSON.parse(fs.readFileSync(SPOTS_PATH, 'utf-8'))
let kept = 0, removed = 0

for (const spot of spots) {
  if (!spot.imageUrl) continue
  if (isCherryBlossomUrl(spot.imageUrl)) {
    kept++
    console.log(`✓ ${spot.name.padEnd(20)} ${spot.imageUrl.split('/').pop()?.slice(0, 50)}`)
  } else {
    console.log(`✗ ${spot.name.padEnd(20)} ${spot.imageUrl.split('/').pop()?.slice(0, 50)} → null`)
    spot.imageUrl = null
    removed++
  }
}

fs.writeFileSync(SPOTS_PATH, JSON.stringify(spots, null, 2), 'utf-8')
console.log(`\n保持: ${kept}件, 除去: ${removed}件`)
