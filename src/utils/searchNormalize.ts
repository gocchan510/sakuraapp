// ── 文字正規化 ──────────────────────────────────────────────────

/** 全角ASCII → 半角 */
function fullWidthToHalf(s: string): string {
  return s.replace(/[\uFF01-\uFF5E]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
}

/** カタカナ → ひらがな（長音符 ー はそのまま） */
function katakanaToHiragana(s: string): string {
  return s.replace(/[\u30A1-\u30F6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

/**
 * 検索用の正規化:
 * 全角→半角 → カタカナ→ひらがな → 小文字
 */
export function normalize(s: string): string {
  return katakanaToHiragana(fullWidthToHalf(s)).toLowerCase()
}

// ── ローマ字 → ひらがな変換 ───────────────────────────────────

// 長い順に並べることでグリーディマッチを保証
const ROMAJI_TABLE: [string, string][] = [
  // 3文字
  ['chi', 'ち'], ['tsu', 'つ'], ['shi', 'し'],
  ['sha', 'しゃ'], ['shu', 'しゅ'], ['she', 'しぇ'], ['sho', 'しょ'],
  ['cha', 'ちゃ'], ['chu', 'ちゅ'], ['che', 'ちぇ'], ['cho', 'ちょ'],
  ['tya', 'ちゃ'], ['tyu', 'ちゅ'], ['tyo', 'ちょ'],
  ['dzu', 'づ'],
  ['kya', 'きゃ'], ['kyu', 'きゅ'], ['kyo', 'きょ'],
  ['sya', 'しゃ'], ['syu', 'しゅ'], ['syo', 'しょ'],
  ['nya', 'にゃ'], ['nyu', 'にゅ'], ['nyo', 'にょ'],
  ['hya', 'ひゃ'], ['hyu', 'ひゅ'], ['hyo', 'ひょ'],
  ['mya', 'みゃ'], ['myu', 'みゅ'], ['myo', 'みょ'],
  ['rya', 'りゃ'], ['ryu', 'りゅ'], ['ryo', 'りょ'],
  ['gya', 'ぎゃ'], ['gyu', 'ぎゅ'], ['gyo', 'ぎょ'],
  ['bya', 'びゃ'], ['byu', 'びゅ'], ['byo', 'びょ'],
  ['pya', 'ぴゃ'], ['pyu', 'ぴゅ'], ['pyo', 'ぴょ'],
  ['jya', 'じゃ'], ['jyu', 'じゅ'], ['jyo', 'じょ'],
  // 2文字
  ['ka', 'か'], ['ki', 'き'], ['ku', 'く'], ['ke', 'け'], ['ko', 'こ'],
  ['sa', 'さ'], ['si', 'し'], ['su', 'す'], ['se', 'せ'], ['so', 'そ'],
  ['ta', 'た'], ['ti', 'ち'], ['tu', 'つ'], ['te', 'て'], ['to', 'と'],
  ['na', 'な'], ['ni', 'に'], ['nu', 'ぬ'], ['ne', 'ね'], ['no', 'の'],
  ['ha', 'は'], ['hi', 'ひ'], ['fu', 'ふ'], ['hu', 'ふ'], ['he', 'へ'], ['ho', 'ほ'],
  ['ma', 'ま'], ['mi', 'み'], ['mu', 'む'], ['me', 'め'], ['mo', 'も'],
  ['ya', 'や'], ['yu', 'ゆ'], ['yo', 'よ'],
  ['ra', 'ら'], ['ri', 'り'], ['ru', 'る'], ['re', 'れ'], ['ro', 'ろ'],
  ['wa', 'わ'], ['wo', 'を'],
  ['ga', 'が'], ['gi', 'ぎ'], ['gu', 'ぐ'], ['ge', 'げ'], ['go', 'ご'],
  ['za', 'ざ'], ['zi', 'じ'], ['zu', 'ず'], ['ze', 'ぜ'], ['zo', 'ぞ'],
  ['da', 'だ'], ['di', 'ぢ'], ['du', 'づ'], ['de', 'で'], ['do', 'ど'],
  ['ba', 'ば'], ['bi', 'び'], ['bu', 'ぶ'], ['be', 'べ'], ['bo', 'ぼ'],
  ['pa', 'ぱ'], ['pi', 'ぴ'], ['pu', 'ぷ'], ['pe', 'ぺ'], ['po', 'ぽ'],
  ['ja', 'じゃ'], ['ji', 'じ'], ['ju', 'じゅ'], ['je', 'じぇ'], ['jo', 'じょ'],
  // 1文字
  ['a', 'あ'], ['i', 'い'], ['u', 'う'], ['e', 'え'], ['o', 'お'],
]

// 長さ降順にソート済みテーブル（一度だけ計算）
const SORTED_TABLE = [...ROMAJI_TABLE].sort((a, b) => b[0].length - a[0].length)

/** ローマ字文字列をひらがなに変換（変換できない文字はそのまま） */
export function romajiToHiragana(input: string): string {
  const s = input.toLowerCase()
  let result = ''
  let i = 0

  while (i < s.length) {
    // 促音: 同じ子音が重なった場合（nn → ん, kk → っk）
    if (i + 1 < s.length && s[i] === s[i + 1] && s[i] !== 'n' && /[a-z]/.test(s[i])) {
      result += 'っ'
      i++
      continue
    }
    // nn → ん
    if (s[i] === 'n' && i + 1 < s.length && s[i + 1] === 'n') {
      result += 'ん'
      i += 2
      continue
    }
    // n + 子音（母音でもyでもない）→ ん
    if (s[i] === 'n' && i + 1 < s.length && !/[aiueoyn]/.test(s[i + 1])) {
      result += 'ん'
      i++
      continue
    }
    // グリーディマッチ
    let matched = false
    for (const [romaji, hira] of SORTED_TABLE) {
      if (s.startsWith(romaji, i)) {
        result += hira
        i += romaji.length
        matched = true
        break
      }
    }
    if (!matched) {
      result += s[i]
      i++
    }
  }

  // 末尾の n → ん
  return result.replace(/n$/g, 'ん')
}

/**
 * クエリ文字列から検索に使うバリアント一覧を生成する。
 * - 正規化済み（ひらがな＋小文字）
 * - 入力がASCIIのみならローマ字→ひらがな変換版も追加
 */
export function queryVariants(query: string): string[] {
  const norm = normalize(query)
  const variants = new Set<string>([norm])

  // ASCII のみ → ローマ字として変換
  if (/^[a-zA-Z]+$/.test(query.trim())) {
    const asHira = romajiToHiragana(query)
    if (asHira !== norm && asHira.length >= 2) variants.add(asHira)
  }

  return [...variants].filter(v => v.length >= 2)
}
