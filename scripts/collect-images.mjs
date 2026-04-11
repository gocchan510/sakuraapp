#!/usr/bin/env node
/**
 * collect-images.mjs — 桜図鑑 品種画像一括収集
 *
 * Usage:
 *   node scripts/collect-images.mjs                          # 全品種
 *   node scripts/collect-images.mjs --resume                 # 中断再開
 *   node scripts/collect-images.mjs --variety somei-yoshino  # 1品種のみ
 *   node scripts/collect-images.mjs --dry-run                # 検索のみ（DL無し）
 *   node scripts/collect-images.mjs --source wikimedia       # ソース指定
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

// ── Paths ──────────────────────────────────────────────────────────────────
const VARIETIES_PATH = path.join(ROOT, 'src/data/varieties.json')
const PROGRESS_PATH  = path.join(__dirname, 'image_progress.json')
const REPORT_PATH    = path.join(__dirname, 'image_collection_report.csv')
const IMAGES_DIR     = path.join(ROOT, 'public/images')

// ── CLI Args ───────────────────────────────────────────────────────────────
const args        = process.argv.slice(2)
const OPT_RESUME  = args.includes('--resume')
const OPT_DRY_RUN = args.includes('--dry-run')
const varietyIdx  = args.indexOf('--variety')
const sourceIdx   = args.indexOf('--source')
const OPT_VARIETY = varietyIdx !== -1 ? args[varietyIdx + 1] : null
const OPT_SOURCE  = sourceIdx  !== -1 ? args[sourceIdx  + 1] : null  // wikimedia|inaturalist|gbif

const MAX_IMAGES = 3
const UA = 'SakuraZukan/1.0 (sakura-zukan app; educational non-commercial use)'

// ── Utilities ──────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchWithRetry(url, opts = {}, retries = 3) {
  const headers = { 'User-Agent': UA, ...opts.headers }
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers,
        signal: AbortSignal.timeout(15000),
      })
      if (res.ok) return res
      if (res.status === 429) { await sleep(5000 * (i + 1)); continue }
      if (res.status >= 500)  { await sleep(2000 * (i + 1)); continue }
      return res   // 4xx はリトライしない
    } catch (e) {
      if (i === retries - 1) throw e
      await sleep(2000 * (i + 1))
    }
  }
  return null
}

async function fetchJson(url, opts = {}) {
  const res = await fetchWithRetry(url, opts)
  if (!res?.ok) return null
  try { return await res.json() } catch { return null }
}

/** wikiTitleEn から属種名（学名）を抽出 */
function extractTaxon(wikiTitleEn) {
  if (!wikiTitleEn) return null
  let taxon = wikiTitleEn
    .replace(/'[^']+'/g, '')   // 栽培品種名を除去: 'Kanzan'
    .replace(/\s+/g, ' ')
    .trim()
  const parts = taxon.split(' ')
  if (parts.length >= 3 && parts[1] === '×') {
    return parts.slice(0, 3).join(' ')   // 種間雑種: Prunus × yedoensis
  }
  return parts.slice(0, 2).join(' ') || null
}

/** CCライセンスかどうか */
const CC_PATTERNS = ['cc0', 'cc-by', 'cc-by-sa', 'cc-by-nc', 'public domain', 'pd-']
function isAllowedLicense(license) {
  if (!license) return false
  const l = license.toLowerCase()
  return CC_PATTERNS.some(p => l.includes(p))
}

/** GBIFのCC URL → "CC-BY-SA-4.0" 形式に変換 */
function parseCCUrl(url) {
  const m = url.match(/licenses\/([a-z-]+)\/(\d[^/]*)/)
  if (m) return `CC-${m[1].toUpperCase()}-${m[2]}`
  if (url.includes('publicdomain/zero')) return 'CC0-1.0'
  return url
}

// ── Source 1: Wikimedia Commons ────────────────────────────────────────────

async function searchWikimedia(variety) {
  const results = []

  /**
   * Strategy A: Wikipedia記事（ja/en）内で使われている画像を取得
   *  → 最も品種に直結した画像が取れる
   */
  async function getImagesFromArticle(lang, title) {
    if (!title || results.length >= MAX_IMAGES) return
    await sleep(1000)
    const url =
      `https://${lang}.wikipedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(title)}` +
      `&prop=images&imlimit=10&format=json&origin=*`
    if (OPT_DRY_RUN) console.log(`    [Wikimedia-A] ${lang}.wikipedia article images: ${title}`)
    const data = await fetchJson(url)
    const page = Object.values(data?.query?.pages ?? {})[0]
    const images = page?.images ?? []
    if (OPT_DRY_RUN) console.log(`    → ${images.length}件のファイル名取得`)

    // 画像ファイルの詳細を Commons で取得
    const fileTitles = images
      .filter(i => /\.(jpe?g|png|webp|tiff?)$/i.test(i.title))
      .slice(0, 8)
      .map(i => i.title)
    if (!fileTitles.length) return
    await sleep(1000)
    await fetchImageInfoBatch(fileTitles)
  }

  /**
   * Strategy B: Commons でテキスト検索（ファイル名前空間）
   */
  async function searchCommonsFiles(query) {
    if (results.length >= MAX_IMAGES) return
    await sleep(1000)
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query` +
      `&list=search&srsearch=${encodeURIComponent(query)}` +
      `&srnamespace=6&srlimit=15&format=json&origin=*`
    if (OPT_DRY_RUN) console.log(`    [Wikimedia-B] Commons search: "${query}"`)
    const data = await fetchJson(url)
    const hits = data?.query?.search ?? []
    if (OPT_DRY_RUN) console.log(`    → ${hits.length}件ヒット`)
    // 画像ファイルのみ（jpg/jpeg/png/webp/tiff）を対象
    const fileTitles = hits
      .filter(h => /\.(jpe?g|png|webp|tiff?)$/i.test(h.title))
      .slice(0, 10)
      .map(h => h.title)
    if (OPT_DRY_RUN) console.log(`    → 画像ファイル: ${fileTitles.length}件`)
    if (!fileTitles.length) return
    await sleep(1000)
    await fetchImageInfoBatch(fileTitles)
  }

  /** Commons でファイルの imageinfo（URL・ライセンス等）を一括取得 */
  async function fetchImageInfoBatch(fileTitles) {
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query` +
      `&titles=${encodeURIComponent(fileTitles.join('|'))}` +
      `&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=1200` +
      `&format=json&origin=*`
    const data = await fetchJson(url)
    const pages = Object.values(data?.query?.pages ?? {})
    for (const page of pages) {
      if (results.length >= MAX_IMAGES) break
      const ii = page.imageinfo?.[0]
      if (!ii?.url) continue
      const meta     = ii.extmetadata ?? {}
      const license  = meta.LicenseShortName?.value ?? meta.License?.value ?? ''
      if (!isAllowedLicense(license)) continue
      const author   = (meta.Artist?.value ?? '').replace(/<[^>]+>/g, '').trim()
      const fileUrl  = ii.url
      if (results.some(r => r.url === fileUrl)) continue
      results.push({
        source: 'wikimedia',
        url: fileUrl,
        author,
        license: license || 'unknown',
        originalUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title ?? '')}`,
      })
    }
  }

  // ── 実行順 ──
  // 1. ja.wikipedia記事内の画像（最優先・最も品種に直結）
  await getImagesFromArticle('ja', variety.wikiTitleJa)

  // 2. en.wikipedia記事内の画像
  if (results.length < MAX_IMAGES) {
    await getImagesFromArticle('en', variety.wikiTitleEn)
  }

  // 3. CommonsでwikiTitleJaを検索
  if (results.length < MAX_IMAGES && variety.wikiTitleJa) {
    await searchCommonsFiles(variety.wikiTitleJa)
  }

  // 4. CommonsでwikiTitleEnを検索
  if (results.length < MAX_IMAGES && variety.wikiTitleEn) {
    await searchCommonsFiles(variety.wikiTitleEn)
  }

  // 5. 品種名 + "桜" で検索（fallback）
  if (results.length < MAX_IMAGES && variety.name && variety.name !== variety.wikiTitleJa) {
    await searchCommonsFiles(variety.name + ' 桜')
  }

  return results.slice(0, MAX_IMAGES)
}

// ── Source 2: iNaturalist ──────────────────────────────────────────────────

async function searchINaturalist(variety, existingUrls) {
  const taxon = extractTaxon(variety.wikiTitleEn)
  if (!taxon) {
    if (OPT_DRY_RUN) console.log(`    [iNat] 学名抽出不可 (wikiTitleEn: ${variety.wikiTitleEn ?? 'なし'})`)
    return []
  }
  if (OPT_DRY_RUN) console.log(`    [iNat] 学名: "${taxon}"`)
  await sleep(1000)

  const url =
    `https://api.inaturalist.org/v1/observations` +
    `?taxon_name=${encodeURIComponent(taxon)}` +
    `&photos=true&quality_grade=research&per_page=30&order_by=votes`
  const data = await fetchJson(url)
  const obs = data?.results ?? []
  if (OPT_DRY_RUN) console.log(`    → ${obs.length}件の観察記録`)

  const results = []
  const needed  = MAX_IMAGES - existingUrls.size

  for (const ob of obs) {
    if (results.length >= needed) break
    for (const photo of ob.photos ?? []) {
      if (results.length >= needed) break
      const license = photo.license_code ?? ''
      if (!isAllowedLicense(license)) continue
      const origUrl = (photo.url ?? '').replace('/square.', '/original.')
      if (!origUrl || existingUrls.has(origUrl)) continue
      existingUrls.add(origUrl)
      results.push({
        source: 'inaturalist',
        url: origUrl,
        author: ob.user?.login ?? '',
        license: license.toUpperCase().replace(/^cc-/, 'CC-').replace(/-(\d)$/, '-$1.0'),
        originalUrl: `https://www.inaturalist.org/photos/${photo.id}`,
      })
    }
  }
  return results
}

// ── Source 3: GBIF ─────────────────────────────────────────────────────────

async function searchGBIF(variety, existingUrls) {
  const taxon = extractTaxon(variety.wikiTitleEn)
  if (!taxon) {
    if (OPT_DRY_RUN) console.log(`    [GBIF] 学名抽出不可`)
    return []
  }
  if (OPT_DRY_RUN) console.log(`    [GBIF] 学名: "${taxon}"`)
  await sleep(1000)

  // Step 1: species match → usageKey
  const matchData = await fetchJson(
    `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(taxon)}&verbose=false`
  )
  const usageKey = matchData?.usageKey
  if (!usageKey) {
    if (OPT_DRY_RUN) console.log(`    [GBIF] usageKey 取得失敗`)
    return []
  }
  if (OPT_DRY_RUN) console.log(`    [GBIF] usageKey: ${usageKey}`)
  await sleep(1000)

  // Step 2: occurrence search with StillImage
  const occData = await fetchJson(
    `https://api.gbif.org/v1/occurrence/search` +
    `?taxonKey=${usageKey}&mediaType=StillImage&limit=20&hasCoordinate=false`
  )
  const occ = occData?.results ?? []
  if (OPT_DRY_RUN) console.log(`    → ${occ.length}件のオカレンス`)

  const results = []
  const needed  = MAX_IMAGES - existingUrls.size

  for (const o of occ) {
    if (results.length >= needed) break
    for (const media of o.media ?? []) {
      if (results.length >= needed) break
      if (media.type !== 'StillImage') continue
      const license = media.license ?? ''
      if (!isAllowedLicense(license)) continue
      const imgUrl = media.identifier
      if (!imgUrl || existingUrls.has(imgUrl)) continue
      existingUrls.add(imgUrl)
      results.push({
        source: 'gbif',
        url: imgUrl,
        author: media.creator ?? '',
        license: license.startsWith('http') ? parseCCUrl(license) : license,
        originalUrl: `https://www.gbif.org/occurrence/${o.key}`,
      })
    }
  }
  return results
}

// ── Image Download & Convert ───────────────────────────────────────────────

async function downloadAndConvert(imageResult, destPath) {
  const tmpPath = destPath + '.tmp'
  try {
    const res = await fetchWithRetry(imageResult.url, {}, 3)
    if (!res?.ok) {
      console.warn(`    ✗ HTTP ${res?.status}: ${imageResult.url.slice(0, 80)}`)
      return false
    }
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.startsWith('image/')) {
      console.warn(`    ✗ Not image (${contentType})`)
      return false
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 1000) {
      console.warn(`    ✗ Too small: ${buf.length}B`)
      return false
    }

    // 変換: WebP, 長辺1200px以下, quality=80
    let output = await sharp(buf)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()

    // 100KB超えたら quality=65 で再変換
    if (output.length > 100 * 1024) {
      output = await sharp(buf)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 65 })
        .toBuffer()
    }

    await fs.promises.writeFile(tmpPath, output)
    await fs.promises.rename(tmpPath, destPath)
    return true
  } catch (e) {
    console.warn(`    ✗ ${e.message}`)
    try { await fs.promises.unlink(tmpPath) } catch {}
    return false
  }
}

// ── 200MB チェック ─────────────────────────────────────────────────────────

async function getTotalImagesSize() {
  let total = 0
  try {
    for (const dir of await fs.promises.readdir(IMAGES_DIR)) {
      const full = path.join(IMAGES_DIR, dir)
      const stat = await fs.promises.stat(full)
      if (!stat.isDirectory()) continue
      for (const file of await fs.promises.readdir(full)) {
        const fstat = await fs.promises.stat(path.join(full, file))
        total += fstat.size
      }
    }
  } catch {}
  return total
}

// ── 1品種処理 ──────────────────────────────────────────────────────────────

async function processVariety(variety) {
  const id = variety.id
  console.log(`\n── [${id}] ${variety.name} ──`)

  const collected  = []
  const seenUrls   = new Set()

  // ── Wikimedia ─────────────────────────────────────────────────────
  if (!OPT_SOURCE || OPT_SOURCE === 'wikimedia') {
    const wm = await searchWikimedia(variety)
    for (const r of wm) seenUrls.add(r.url)
    collected.push(...wm)
    console.log(`  Wikimedia: ${wm.length}件`)
  }

  // ── iNaturalist ───────────────────────────────────────────────────
  if ((!OPT_SOURCE || OPT_SOURCE === 'inaturalist') && collected.length < MAX_IMAGES) {
    const inat = await searchINaturalist(variety, seenUrls)
    collected.push(...inat)
    console.log(`  iNaturalist: ${inat.length}件`)
  }

  // ── GBIF ──────────────────────────────────────────────────────────
  if ((!OPT_SOURCE || OPT_SOURCE === 'gbif') && collected.length < MAX_IMAGES) {
    const gbif = await searchGBIF(variety, seenUrls)
    collected.push(...gbif)
    console.log(`  GBIF: ${gbif.length}件`)
  }

  const candidates = collected.slice(0, MAX_IMAGES)
  console.log(`  合計候補: ${candidates.length}枚`)

  // ── Dry run: URL表示 + HEAD確認 ───────────────────────────────────
  if (OPT_DRY_RUN) {
    for (const r of candidates) {
      let headStatus = '?'
      try {
        const hres = await fetchWithRetry(r.url, { method: 'HEAD' }, 2)
        headStatus = hres?.status ?? 'ERR'
      } catch { headStatus = 'ERR' }
      await sleep(500)
      console.log(`    [${r.source}] HEAD=${headStatus} | ${r.license} | ${r.url.slice(0, 80)}`)
    }
    return {
      id,
      imageCount: candidates.length,
      imageEntries: [],
      sourceCounts: countSources(candidates),
    }
  }

  // ── ダウンロード ──────────────────────────────────────────────────
  const destDir = path.join(IMAGES_DIR, id)
  await fs.promises.mkdir(destDir, { recursive: true })

  const imageEntries = []
  let idx = 1
  for (const r of candidates) {
    const filename = `${String(idx).padStart(2, '0')}.webp`
    const destPath = path.join(destDir, filename)
    process.stdout.write(`  ↓ ${filename} [${r.source}]...`)
    const ok = await downloadAndConvert(r, destPath)
    if (ok) {
      process.stdout.write(' ✓\n')
      imageEntries.push({
        file: `images/${id}/${filename}`,
        source: r.source,
        author: r.author,
        license: r.license,
        originalUrl: r.originalUrl,
      })
      idx++
    } else {
      process.stdout.write(' ✗\n')
    }
    await sleep(500)
  }

  return {
    id,
    imageCount: imageEntries.length,
    imageEntries,
    sourceCounts: countSources(imageEntries),
  }
}

function countSources(items) {
  const c = { wikimedia: 0, inaturalist: 0, gbif: 0 }
  for (const i of items) c[i.source] = (c[i.source] ?? 0) + 1
  return c
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║  桜図鑑 画像収集スクリプト v2        ║')
  console.log('╚══════════════════════════════════════╝')
  if (OPT_DRY_RUN)  console.log('  モード: ドライラン（ダウンロードなし）')
  if (OPT_RESUME)   console.log('  モード: 再開')
  if (OPT_VARIETY)  console.log(`  対象: ${OPT_VARIETY}`)
  if (OPT_SOURCE)   console.log(`  ソース: ${OPT_SOURCE}`)

  // Load varieties
  const varieties = JSON.parse(await fs.promises.readFile(VARIETIES_PATH, 'utf8'))
  console.log(`\n品種数: ${varieties.length}`)

  // Load progress
  let progress = {}
  const useProgress = (OPT_RESUME || !OPT_DRY_RUN) && !OPT_VARIETY
  if (useProgress) {
    try {
      progress = JSON.parse(await fs.promises.readFile(PROGRESS_PATH, 'utf8'))
      const done = Object.values(progress).filter(v => typeof v === 'object' && v.status === 'complete').length
      console.log(`進捗ファイル読み込み: ${done}件完了済み`)
    } catch { /* 初回は存在しない */ }
  }

  // 対象品種を絞り込む
  let targets = varieties
  if (OPT_VARIETY) {
    targets = varieties.filter(v => v.id === OPT_VARIETY)
    if (!targets.length) {
      console.error(`エラー: 品種 "${OPT_VARIETY}" が見つかりません`)
      process.exit(1)
    }
  }

  // imagesDirを作成
  if (!OPT_DRY_RUN) {
    await fs.promises.mkdir(IMAGES_DIR, { recursive: true })
  }

  // 推定所要時間
  if (!OPT_DRY_RUN && !OPT_VARIETY) {
    const remaining = targets.filter(v => !progress[v.id]?.status).length
    const estMin = Math.ceil(remaining * 9 / 60)  // ~9秒/品種
    console.log(`未処理: ${remaining}品種 (推定所要時間: 約${estMin}分)\n`)
  }

  // 統計
  const stats = { total: 0, withImage: 0, noImage: 0, sources: { wikimedia: 0, inaturalist: 0, gbif: 0 } }
  const reportRows = []

  for (let i = 0; i < targets.length; i++) {
    const variety = targets[i]
    const id = variety.id

    // 完了済みスキップ（resume時）
    if (useProgress && progress[id]?.status === 'complete') {
      const prev = progress[id]
      reportRows.push({
        id, name: variety.name,
        wikimedia_count: 0, inaturalist_count: 0, gbif_count: 0,
        total: prev.imageCount ?? 0,
        status: 'complete(skipped)',
      })
      continue
    }

    stats.total++

    let result
    try {
      result = await processVariety(variety)
    } catch (e) {
      console.error(`  エラー: ${e.message}`)
      if (!OPT_DRY_RUN) {
        progress[id] = { status: 'error', error: e.message }
        await fs.promises.writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2))
      }
      reportRows.push({ id, name: variety.name, wikimedia_count: 0, inaturalist_count: 0, gbif_count: 0, total: 0, status: 'error' })
      stats.noImage++
      continue
    }

    // varieties.json を更新
    if (!OPT_DRY_RUN) {
      variety.images   = result.imageEntries
      variety.hasImage = result.imageEntries.length > 0

      // 進捗保存
      progress[id] = { status: 'complete', imageCount: result.imageCount }
      progress['last-processed'] = id
      await fs.promises.writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2))
    }

    // 統計更新
    if (result.imageCount > 0) {
      stats.withImage++
      stats.sources.wikimedia    += result.sourceCounts.wikimedia
      stats.sources.inaturalist  += result.sourceCounts.inaturalist
      stats.sources.gbif         += result.sourceCounts.gbif
    } else {
      stats.noImage++
    }

    reportRows.push({
      id, name: variety.name,
      wikimedia_count:   result.sourceCounts.wikimedia,
      inaturalist_count: result.sourceCounts.inaturalist,
      gbif_count:        result.sourceCounts.gbif,
      total:             result.imageCount,
      status: result.imageCount > 0 ? 'complete' : 'no_image',
    })

    // 10品種ごとに varieties.json を中間保存
    if (!OPT_DRY_RUN && (i + 1) % 10 === 0) {
      await fs.promises.writeFile(VARIETIES_PATH, JSON.stringify(varieties, null, 2))
      console.log(`\n  [中間保存] varieties.json (${i + 1}/${targets.length})`)
    }

    // 200MB チェック
    if (!OPT_DRY_RUN && (i + 1) % 50 === 0) {
      const sizeMB = (await getTotalImagesSize()) / (1024 * 1024)
      console.log(`\n  [容量チェック] images/: ${sizeMB.toFixed(1)} MB`)
      if (sizeMB > 200) {
        console.warn('  ⚠ 200MB超。quality=55 で全ファイルを再変換します...')
        await recompressAll(55)
      }
    }
  }

  // 最終保存
  if (!OPT_DRY_RUN) {
    await fs.promises.writeFile(VARIETIES_PATH, JSON.stringify(varieties, null, 2))
    console.log('\nvarieties.json 更新完了')

    // CSV レポート
    const header = 'id,name,wikimedia_count,inaturalist_count,gbif_count,total,status\n'
    const rows = reportRows.map(r =>
      `${r.id},"${r.name}",${r.wikimedia_count},${r.inaturalist_count},${r.gbif_count},${r.total},${r.status}`
    ).join('\n')
    await fs.promises.writeFile(REPORT_PATH, '\uFEFF' + header + rows, 'utf8')
    console.log(`レポート: ${REPORT_PATH}`)
  }

  // サマリー
  const totalImgs = stats.sources.wikimedia + stats.sources.inaturalist + stats.sources.gbif
  const pct = stats.total > 0 ? ((stats.withImage / stats.total) * 100).toFixed(1) : '0.0'
  console.log('\n╔══════════════════════════════════════╗')
  console.log('║  サマリー                            ║')
  console.log('╚══════════════════════════════════════╝')
  console.log(`Total varieties:        ${stats.total}`)
  if (!OPT_DRY_RUN) {
    console.log(`With images:            ${stats.withImage} (${pct}%)`)
    console.log(`Without images:         ${stats.noImage}`)
    console.log(`Total images downloaded:${totalImgs}`)
    console.log(`  Wikimedia:            ${stats.sources.wikimedia}`)
    console.log(`  iNaturalist:          ${stats.sources.inaturalist}`)
    console.log(`  GBIF:                 ${stats.sources.gbif}`)
  }
}

/** 全WebPを低品質で再変換（200MB超過時） */
async function recompressAll(quality = 55) {
  let recompressed = 0
  for (const dir of await fs.promises.readdir(IMAGES_DIR)) {
    const full = path.join(IMAGES_DIR, dir)
    const stat = await fs.promises.stat(full)
    if (!stat.isDirectory()) continue
    for (const file of await fs.promises.readdir(full)) {
      if (!file.endsWith('.webp')) continue
      const fp = path.join(full, file)
      try {
        const buf = await fs.promises.readFile(fp)
        const out = await sharp(buf).webp({ quality }).toBuffer()
        await fs.promises.writeFile(fp, out)
        recompressed++
      } catch {}
    }
  }
  console.log(`  再変換完了: ${recompressed}ファイル`)
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
