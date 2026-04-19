import {
  createContext, useContext, useState, useEffect,
  useCallback, type ReactNode,
} from 'react'

export type Lang = 'ja' | 'zh-TW' | 'en'

const LANG_KEY = 'sakura_lang'
const LANG_SELECTED_KEY = 'sakura_lang_selected'

// ── UI Strings 型定義 ─────────────────────────────────────────────────────
export interface Strings {
  tabs: { map: string; spots: string; calendar: string; zukan: string }
  status: {
    in_bloom: string; opening: string; falling: string; leaf: string
    budding: string; off_season: string; upcoming: string; all: string
  }
  zukan: {
    title: string
    recordCount: (n: number) => string
    filteredCount: (n: number, total: number) => string
    allBtn: string
    customRange: string
    discovered: (n: number, total: number) => string
    empty: string
    spotFilterBanner: (name: string, n: number) => string
    clearFilter: string
  }
  calendar: {
    title: string; subtitle: string; prefecture: string; prefLabel: string
    today: string; noVarieties: string; bloomBadge: string; loadingPref: string
    phaseOpening: string; phaseInBloom: string; phaseFalling: string
    rarityLabels: Record<number, string>
    varietyCount: (n: number) => string
    nowHere: string
    phaseBadge: { in_bloom: string; opening: string; falling: string }
  }
  spots: {
    title: string; searchPlaceholder: string
    sortBloom: string; sortPopular: string; sortDistance: string
    allPref: string; empty: string
    locating: string; locationDenied: string
    mapBtn: string; someiyoshino: string
  }
  detail: {
    backBtn: string; shareBtn: string; tabBasic: string; tabDetail: string
    bloomSeason: string; color: string; shape: string; rarity: string
    features: string; history: string; background: string; trivia: string
    sectionHistory: string; sectionBackground: string; sectionTrivia: string
    spots: string; noSpots: string
    reportTitle: string; reportBtn: string; reportLocating: string
    reportSelectSpot: string; reportCancel: string; reportManual: string
    reportDone: string; discovered: string; discoveryBadge: string
    allPref: string; prefLabel: string
    varietyCount: (n: number) => string
    distKm: (d: string) => string
    noSpotInPref: (pref: string) => string
    noSpotGlobal: string
    someiyoshinoRef: string
    peakLabel: string
    varietyCountLabel: string
  }
  lang: { title: string; ja: string; 'zh-TW': string; en: string; close: string }
  loading: { text: string }
  install: { android: string; ios: string; addBtn: string; closeBtn: string }
  map: {
    chips: {
      in_bloom: string; rare: string; many: string
      one_tree: string; near_station: string; free: string
    }
    statusLabel: Record<string, string>
    soLabel: Record<string, string>
    legendInBloom: string; legendFalling: string; legendBudding: string
    peakLabel: string; varietyCount: (n: number) => string
    nowBloomTitle: string; spotListBtn: string; routeBtn: string; shareBtn: string
    nearbyTitle: string; viewAllBtn: string
    searchPlaceholder: string
  }
}

// ── 日本語 ────────────────────────────────────────────────────────────────
const ja: Strings = {
  tabs: { map: '地図', spots: 'スポット', calendar: 'カレンダー', zukan: '図鑑' },
  status: {
    in_bloom: '満開・見頃', opening: '開花中', falling: '散り頃',
    leaf: '葉桜', budding: 'もうすぐ', off_season: '時期外', upcoming: '時期外', all: '全て',
  },
  zukan: {
    title: '🌸 桜図鑑',
    recordCount: (n) => `${n}品種収録`,
    filteredCount: (n, total) => `${n}件 / ${total}品種収録`,
    allBtn: 'すべて',
    customRange: '🗓 期間を指定',
    discovered: (n, total) => `発見済み: ${n}/${total}品種`,
    empty: 'この期間に咲く品種は見つかりませんでした',
    spotFilterBanner: (name, n) => `📍 ${name} の品種 (${n}件)`,
    clearFilter: '✕ 解除',
  },
  calendar: {
    title: '🗓️ 桜カレンダー', subtitle: '日付をタップして品種を確認',
    prefecture: '全国（東京基準）', prefLabel: '都道府県',
    today: '今日', noVarieties: 'この日は開花データがありません',
    bloomBadge: '今見頃', loadingPref: '📍 検出中...',
    phaseOpening: '🌷 開花中', phaseInBloom: '🌸 満開', phaseFalling: '🍃 散り頃',
    rarityLabels: {
      5: '★★★★★ 超レア', 4: '★★★★ とても珍しい',
      3: '★★★ 珍しい', 2: '★★ やや珍しい', 1: '★ よく見る',
    },
    varietyCount: (n) => `${n}品種`,
    nowHere: '← 今ここ',
    phaseBadge: { in_bloom: '満開・見頃', opening: '開花中', falling: '散り頃' },
  },
  spots: {
    title: 'スポット', searchPlaceholder: 'スポット名・都道府県で検索',
    sortBloom: '見頃順', sortPopular: '人気順', sortDistance: '距離順',
    allPref: '都道府県', empty: '該当するスポットがありません',
    locating: '位置情報を取得中...',
    locationDenied: '位置情報が取得できませんでした。人気順で表示します。',
    mapBtn: '地図で見る', someiyoshino: 'ソメイヨシノ',
  },
  detail: {
    backBtn: '‹', shareBtn: 'シェア', tabBasic: '基本情報', tabDetail: '詳細',
    bloomSeason: '開花時期', color: '花の色', shape: '花の形', rarity: 'レア度',
    features: '特徴', history: '歴史', background: '背景', trivia: 'トリビア',
    sectionHistory: '📜 歴史', sectionBackground: '🌍 背景', sectionTrivia: '💡 トリビア',
    spots: '🗺️ この品種が見られるスポット', noSpots: 'スポット情報なし',
    reportTitle: '目撃報告', reportBtn: '🌸 今見ている！', reportLocating: '📍 位置情報取得中...',
    reportSelectSpot: '近くのスポットを選択', reportCancel: 'キャンセル', reportManual: 'スポットを検索',
    reportDone: '報告しました！', discovered: '発見済み', discoveryBadge: '✓ 発見',
    allPref: '全国', prefLabel: '都道府県',
    varietyCount: (n) => `${n}品種`,
    distKm: (d) => `${d} km`,
    noSpotInPref: (p) => `${p}にはこの品種の観賞スポット情報がありません`,
    noSpotGlobal: 'この品種の観賞スポット情報はまだありません',
    someiyoshinoRef: '🌸 ソメイヨシノ:',
    peakLabel: '見頃:',
    varietyCountLabel: '品種',
  },
  lang: { title: '言語', ja: '日本語', 'zh-TW': '繁體中文', en: 'English', close: '閉じる' },
  loading: { text: '読み込み中...' },
  install: {
    android: '🌸 ホーム画面に追加してアプリとして使えます',
    ios: '🌸 Safari の 共有 →「ホーム画面に追加」でアプリとして使えます',
    addBtn: '追加', closeBtn: '✕',
  },
  map: {
    chips: {
      in_bloom: '🌸 今見頃', rare: '★★★+ 珍しい', many: '🌳 多品種',
      one_tree: '🌲 一本桜', near_station: '🚶 駅近', free: '🆓 無料',
    },
    statusLabel: {
      in_bloom: '🌸 満開・見頃', opening: '🌷 開花中', falling: '🍃 散り頃',
      leaf: '🌿 葉桜', budding: '🌱 もうすぐ咲く', upcoming: '🫧 まだ先', off_season: '⬜ 時期外',
    },
    soLabel: {
      in_bloom: '🟢 満開・見頃', opening: '🌷 開花中', falling: '🔴 散り頃',
      leaf: '🌿 葉桜', budding: '🟡 もうすぐ',
    },
    legendInBloom: '満開・見頃', legendFalling: '散り頃', legendBudding: 'もうすぐ',
    peakLabel: '見頃:', varietyCount: (n) => `${n}品種`,
    nowBloomTitle: '🌸 今見頃の品種', spotListBtn: '📋 スポット一覧で見る',
    routeBtn: '🚶 ルート', shareBtn: 'シェア', nearbyTitle: '📍 近くの見頃スポット',
    viewAllBtn: '全スポット',
    searchPlaceholder: 'スポット・品種を検索',
  },
}

// ── 繁體中文 ──────────────────────────────────────────────────────────────
const zhTW: Strings = {
  tabs: { map: '地圖', spots: '景點', calendar: '日曆', zukan: '圖鑑' },
  status: {
    in_bloom: '滿開・賞花期', opening: '開花中', falling: '落花期',
    leaf: '葉櫻', budding: '即將開花', off_season: '非賞花期', upcoming: '非賞花期', all: '全部',
  },
  zukan: {
    title: '🌸 櫻花圖鑑',
    recordCount: (n) => `收錄 ${n} 個品種`,
    filteredCount: (n, total) => `${n} 件 / 共 ${total} 個品種`,
    allBtn: '全部',
    customRange: '🗓 指定期間',
    discovered: (n, total) => `已發現: ${n}/${total} 個品種`,
    empty: '此期間沒有符合的品種',
    spotFilterBanner: (name, n) => `📍 ${name} 的品種 (${n}件)`,
    clearFilter: '✕ 解除',
  },
  calendar: {
    title: '🗓️ 賞花日曆', subtitle: '點選日期查看品種',
    prefecture: '全國（東京基準）', prefLabel: '都道府縣',
    today: '今天', noVarieties: '這天沒有開花資料',
    bloomBadge: '現在盛開', loadingPref: '📍 偵測中...',
    phaseOpening: '🌷 開花中', phaseInBloom: '🌸 滿開', phaseFalling: '🍃 落花期',
    rarityLabels: {
      5: '★★★★★ 超稀有', 4: '★★★★ 非常稀有',
      3: '★★★ 稀有', 2: '★★ 略為稀有', 1: '★ 常見',
    },
    varietyCount: (n) => `${n}個品種`,
    nowHere: '← 現在',
    phaseBadge: { in_bloom: '滿開・賞花期', opening: '開花中', falling: '落花期' },
  },
  spots: {
    title: '景點', searchPlaceholder: '搜尋景點名稱・都道府縣',
    sortBloom: '賞花順', sortPopular: '人氣順', sortDistance: '距離順',
    allPref: '都道府縣', empty: '沒有符合的景點',
    locating: '正在取得位置資訊...',
    locationDenied: '無法取得位置資訊。改以人氣順顯示。',
    mapBtn: '在地圖上查看', someiyoshino: '染井吉野',
  },
  detail: {
    backBtn: '‹', shareBtn: '分享', tabBasic: '基本資訊', tabDetail: '詳細',
    bloomSeason: '開花時期', color: '花色', shape: '花形', rarity: '稀有度',
    features: '特徵', history: '歷史', background: '背景', trivia: '趣聞',
    sectionHistory: '📜 歷史', sectionBackground: '🌍 背景', sectionTrivia: '💡 趣聞',
    spots: '🗺️ 可觀賞此品種的景點', noSpots: '無景點資訊',
    reportTitle: '目擊報告', reportBtn: '🌸 我正在看！', reportLocating: '📍 取得位置資訊中...',
    reportSelectSpot: '選擇附近的景點', reportCancel: '取消', reportManual: '搜尋景點',
    reportDone: '已提交報告！', discovered: '已發現', discoveryBadge: '✓ 已發現',
    allPref: '全國', prefLabel: '都道府縣',
    varietyCount: (n) => `${n}個品種`,
    distKm: (d) => `${d} km`,
    noSpotInPref: (p) => `${p}沒有此品種的觀賞景點資訊`,
    noSpotGlobal: '此品種尚無觀賞景點資訊',
    someiyoshinoRef: '🌸 染井吉野:',
    peakLabel: '賞花期:',
    varietyCountLabel: '個品種',
  },
  lang: { title: '語言', ja: '日本語', 'zh-TW': '繁體中文', en: 'English', close: '關閉' },
  loading: { text: '讀取中...' },
  install: {
    android: '🌸 加入主畫面，像 App 一樣使用',
    ios: '🌸 在 Safari 點選「分享」→「加入主畫面」',
    addBtn: '加入', closeBtn: '✕',
  },
  map: {
    chips: {
      in_bloom: '🌸 現在賞花', rare: '★★★+ 稀有', many: '🌳 多品種',
      one_tree: '🌲 一棵樹', near_station: '🚶 近車站', free: '🆓 免費',
    },
    statusLabel: {
      in_bloom: '🌸 滿開・賞花期', opening: '🌷 開花中', falling: '🍃 落花期',
      leaf: '🌿 葉櫻', budding: '🌱 即將開花', upcoming: '🫧 還需等待', off_season: '⬜ 非賞花期',
    },
    soLabel: {
      in_bloom: '🟢 滿開・賞花期', opening: '🌷 開花中', falling: '🔴 落花期',
      leaf: '🌿 葉櫻', budding: '🟡 即將開花',
    },
    legendInBloom: '滿開・賞花期', legendFalling: '落花期', legendBudding: '即將開花',
    peakLabel: '賞花期:', varietyCount: (n) => `${n}個品種`,
    nowBloomTitle: '🌸 現在盛開的品種', spotListBtn: '📋 在景點列表查看',
    routeBtn: '🚶 路線', shareBtn: '分享', nearbyTitle: '📍 附近的賞花景點',
    viewAllBtn: '全部景點',
    searchPlaceholder: '搜尋景點・品種',
  },
}

// ── English ───────────────────────────────────────────────────────────────
const en: Strings = {
  tabs: { map: 'Map', spots: 'Spots', calendar: 'Calendar', zukan: 'Guide' },
  status: {
    in_bloom: 'Full Bloom', opening: 'Opening', falling: 'Falling',
    leaf: 'Leaf Stage', budding: 'Coming Soon', off_season: 'Off Season', upcoming: 'Off Season', all: 'All',
  },
  zukan: {
    title: '🌸 Sakura Guide',
    recordCount: (n) => `${n} varieties`,
    filteredCount: (n, total) => `${n} of ${total} varieties`,
    allBtn: 'All',
    customRange: '🗓 Custom Range',
    discovered: (n, total) => `Discovered: ${n}/${total}`,
    empty: 'No varieties found for this period',
    spotFilterBanner: (name, n) => `📍 Varieties at ${name} (${n})`,
    clearFilter: '✕ Clear',
  },
  calendar: {
    title: '🗓️ Bloom Calendar', subtitle: 'Tap a date to see varieties',
    prefecture: 'All Japan (Tokyo base)', prefLabel: 'Prefecture',
    today: 'Today', noVarieties: 'No bloom data for this day',
    bloomBadge: 'In Bloom Now', loadingPref: '📍 Detecting...',
    phaseOpening: '🌷 Opening', phaseInBloom: '🌸 Full Bloom', phaseFalling: '🍃 Falling',
    rarityLabels: {
      5: '★★★★★ Extremely Rare', 4: '★★★★ Very Rare',
      3: '★★★ Rare', 2: '★★ Uncommon', 1: '★ Common',
    },
    varietyCount: (n) => `${n} ${n === 1 ? 'variety' : 'varieties'}`,
    nowHere: '← Today',
    phaseBadge: { in_bloom: 'Full Bloom', opening: 'Opening', falling: 'Falling' },
  },
  spots: {
    title: 'Spots', searchPlaceholder: 'Search by name or prefecture',
    sortBloom: 'By Bloom', sortPopular: 'Popular', sortDistance: 'By Distance',
    allPref: 'Prefecture', empty: 'No spots found',
    locating: 'Getting location...',
    locationDenied: 'Could not get location. Showing by popularity.',
    mapBtn: 'View on Map', someiyoshino: 'Somei Yoshino',
  },
  detail: {
    backBtn: '‹', shareBtn: 'Share', tabBasic: 'Basic Info', tabDetail: 'Details',
    bloomSeason: 'Bloom Season', color: 'Color', shape: 'Shape', rarity: 'Rarity',
    features: 'Features', history: 'History', background: 'Background', trivia: 'Trivia',
    sectionHistory: '📜 History', sectionBackground: '🌍 Background', sectionTrivia: '💡 Trivia',
    spots: '🗺️ Where to See This Variety', noSpots: 'No spot info',
    reportTitle: 'Report Sighting', reportBtn: '🌸 I See It Now!', reportLocating: '📍 Getting location...',
    reportSelectSpot: 'Select Nearby Spot', reportCancel: 'Cancel', reportManual: 'Search Spots',
    reportDone: 'Reported!', discovered: 'Discovered', discoveryBadge: '✓ Found',
    allPref: 'All Japan', prefLabel: 'Prefecture',
    varietyCount: (n) => `${n} ${n === 1 ? 'variety' : 'varieties'}`,
    distKm: (d) => `${d} km`,
    noSpotInPref: (p) => `No viewing spots for this variety in ${p}`,
    noSpotGlobal: 'No viewing spot info available yet',
    someiyoshinoRef: '🌸 Somei Yoshino:',
    peakLabel: 'Peak:',
    varietyCountLabel: 'varieties',
  },
  lang: { title: 'Language', ja: '日本語', 'zh-TW': '繁體中文', en: 'English', close: 'Close' },
  loading: { text: 'Loading...' },
  install: {
    android: '🌸 Add to Home Screen to use as an app',
    ios: '🌸 In Safari: Share → "Add to Home Screen"',
    addBtn: 'Add', closeBtn: '✕',
  },
  map: {
    chips: {
      in_bloom: '🌸 In Bloom', rare: '★★★+ Rare', many: '🌳 Many Varieties',
      one_tree: '🌲 Single Tree', near_station: '🚶 Near Station', free: '🆓 Free',
    },
    statusLabel: {
      in_bloom: '🌸 Full Bloom', opening: '🌷 Opening', falling: '🍃 Falling',
      leaf: '🌿 Leaf Stage', budding: '🌱 Coming Soon', upcoming: '🫧 Not Yet', off_season: '⬜ Off Season',
    },
    soLabel: {
      in_bloom: '🟢 Full Bloom', opening: '🌷 Opening', falling: '🔴 Falling',
      leaf: '🌿 Leaf Stage', budding: '🟡 Coming Soon',
    },
    legendInBloom: 'Full Bloom', legendFalling: 'Falling', legendBudding: 'Coming Soon',
    peakLabel: 'Peak:', varietyCount: (n) => `${n} ${n === 1 ? 'variety' : 'varieties'}`,
    nowBloomTitle: '🌸 Varieties in Bloom Now', spotListBtn: '📋 View in Spot List',
    routeBtn: '🚶 Route', shareBtn: 'Share', nearbyTitle: '📍 Nearby Spots in Bloom',
    viewAllBtn: 'All Spots',
    searchPlaceholder: 'Search spots & varieties',
  },
}

const STRINGS: Record<Lang, Strings> = { ja, 'zh-TW': zhTW, en }

// ── Context 型 ────────────────────────────────────────────────────────────
interface LangContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  strings: Strings
  spotsMap: Map<string, any>
  varietiesMap: Map<string, any>
  loading: boolean
  langSelected: boolean
  markLangSelected: () => void
}

const LangContext = createContext<LangContextValue | null>(null)

// ── モジュールレベルキャッシュ ─────────────────────────────────────────────
let cacheEn: { spots: Map<string, any>; varieties: Map<string, any> } | null = null
let cacheZh: { spots: Map<string, any>; varieties: Map<string, any> } | null = null

async function loadTranslations(lang: Lang): Promise<{ spots: Map<string, any>; varieties: Map<string, any> }> {
  if (lang === 'ja') return { spots: new Map(), varieties: new Map() }

  if (lang === 'en') {
    if (!cacheEn) {
      const [spotsData, varietiesData] = await Promise.all([
        import('../data/spots_en.json'),
        import('../data/varieties_en.json'),
      ])
      cacheEn = {
        spots: new Map((spotsData.default as any[]).map(s => [s.id, s])),
        varieties: new Map((varietiesData.default as any[]).map(v => [v.id, v])),
      }
    }
    return cacheEn
  }

  // zh-TW
  if (!cacheZh) {
    const [spotsData, varietiesData] = await Promise.all([
      import('../data/spots_zh-TW.json'),
      import('../data/varieties_zh-TW.json'),
    ])
    cacheZh = {
      spots: new Map((spotsData.default as any[]).map(s => [s.id, s])),
      varieties: new Map((varietiesData.default as any[]).map(v => [v.id, v])),
    }
  }
  return cacheZh
}

// ── Provider ──────────────────────────────────────────────────────────────
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null
    if (saved === 'ja' || saved === 'zh-TW' || saved === 'en') return saved
    return 'ja'
  })
  const [langSelected, setLangSelected] = useState(
    () => !!localStorage.getItem(LANG_SELECTED_KEY)
  )
  const [loading, setLoading] = useState(false)
  const [spotsMap, setSpotsMap] = useState<Map<string, any>>(new Map())
  const [varietiesMap, setVarietiesMap] = useState<Map<string, any>>(new Map())

  useEffect(() => {
    if (lang === 'ja') {
      setSpotsMap(new Map())
      setVarietiesMap(new Map())
      return
    }
    setLoading(true)
    loadTranslations(lang).then(({ spots, varieties }) => {
      setSpotsMap(spots)
      setVarietiesMap(varieties)
      setLoading(false)
    })
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem(LANG_KEY, l)
  }, [])

  const markLangSelected = useCallback(() => {
    setLangSelected(true)
    localStorage.setItem(LANG_SELECTED_KEY, '1')
  }, [])

  return (
    <LangContext.Provider value={{
      lang, setLang,
      strings: STRINGS[lang],
      spotsMap, varietiesMap,
      loading, langSelected, markLangSelected,
    }}>
      {children}
    </LangContext.Provider>
  )
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')

  const { lang, spotsMap, varietiesMap, strings } = ctx

  const t = useCallback(<S extends keyof Strings>(section: S): Strings[S] => {
    return strings[section]
  }, [strings])

  const tSpot = useCallback((spot: any): any => {
    if (lang === 'ja') return spot
    const tr = spotsMap.get(spot.id)
    if (!tr) return spot
    return {
      ...spot,
      name: tr.name ?? spot.name,
      prefecture: tr.prefecture ?? spot.prefecture,
      city: tr.city ?? spot.city,
      features: tr.features ?? spot.features,
    }
  }, [lang, spotsMap])

  const tVariety = useCallback((variety: any): any => {
    if (lang === 'ja') return variety
    const tr = varietiesMap.get(variety.id)
    if (!tr) return variety
    const result: any = {
      ...variety,
      name: tr.name ?? variety.name,
      bloomSeason: tr.bloomSeason ?? variety.bloomSeason,
      color: tr.color ?? variety.color,
      flowerShape: tr.flowerShape ?? variety.flowerShape,
      summary: tr.summary ?? variety.summary,
      features: tr.features ?? variety.features,
      history: tr.history ?? variety.history,
      background: tr.background ?? variety.background,
      trivia: tr.trivia ?? variety.trivia,
      tags: tr.tags ?? variety.tags,
    }
    if (variety.rarity && tr.rarity) {
      result.rarity = {
        ...variety.rarity,
        label: tr.rarity.label ?? variety.rarity.label,
        reasons: tr.rarity.reasons ?? variety.rarity.reasons,
      }
    }
    return result
  }, [lang, varietiesMap])

  return { ...ctx, t, tSpot, tVariety }
}
