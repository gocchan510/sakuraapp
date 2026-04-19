import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import type { ReactNode } from 'react'
import {
  syncFavorites,
  getCurrentSubscription,
  getNotificationPermission,
  isPushSupported,
} from '../utils/push'

const STORAGE_KEY = 'sakura_favorites'
const SOFT_PROMPT_KEY = 'sakura_push_prompted_at'  // 7日のクールダウン
const SOFT_PROMPT_COOLDOWN = 7 * 24 * 60 * 60 * 1000

export type FavoriteEntry = { spotId: string; addedAt: number }

type FavoritesContextValue = {
  favorites: FavoriteEntry[]
  favoriteIds: Set<string>
  isFavorite: (spotId: string) => boolean
  toggle: (spotId: string) => boolean  // returns new state (true=favorited)
  add: (spotId: string) => void
  remove: (spotId: string) => void
  count: number
  // soft prompt
  softPromptOpen: boolean
  dismissSoftPrompt: (cooldown?: boolean) => void
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

function loadFromStorage(): FavoriteEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x: any) => x && typeof x.spotId === 'string')
      .map((x: any) => ({
        spotId: x.spotId,
        addedAt: typeof x.addedAt === 'number' ? x.addedAt : Date.now(),
      }))
  } catch {
    return []
  }
}

function saveToStorage(list: FavoriteEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch {}
}

function shouldShowSoftPrompt(): boolean {
  if (!isPushSupported()) return false
  if (getNotificationPermission() !== 'default') return false
  const last = Number(localStorage.getItem(SOFT_PROMPT_KEY) || '0')
  if (last && Date.now() - last < SOFT_PROMPT_COOLDOWN) return false
  return true
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>(loadFromStorage)
  const [softPromptOpen, setSoftPromptOpen] = useState(false)
  const justAddedRef = useRef(false)
  const firstRunRef = useRef(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 変更時は localStorage に同期
  useEffect(() => {
    saveToStorage(favorites)
  }, [favorites])

  const favoriteIds = useMemo(() => new Set(favorites.map(f => f.spotId)), [favorites])

  const isFavorite = useCallback((spotId: string) => favoriteIds.has(spotId), [favoriteIds])

  const add = useCallback((spotId: string) => {
    setFavorites(prev => {
      if (prev.some(f => f.spotId === spotId)) return prev
      justAddedRef.current = true
      return [...prev, { spotId, addedAt: Date.now() }]
    })
  }, [])

  const remove = useCallback((spotId: string) => {
    setFavorites(prev => prev.filter(f => f.spotId !== spotId))
  }, [])

  const toggle = useCallback((spotId: string): boolean => {
    let newState = false
    setFavorites(prev => {
      if (prev.some(f => f.spotId === spotId)) {
        return prev.filter(f => f.spotId !== spotId)
      }
      newState = true
      justAddedRef.current = true
      return [...prev, { spotId, addedAt: Date.now() }]
    })
    return newState
  }, [])

  // ── バック同期（3秒デバウンス、subscribe済みの時だけ実行）────────────
  useEffect(() => {
    // 初回マウント時は同期しない（startup 時の自動同期は下の別 effect）
    if (firstRunRef.current) {
      firstRunRef.current = false
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const ids = favorites.map(f => f.spotId)
      syncFavorites(ids).catch(err => console.warn('[favorites] sync failed', err))
    }, 3000)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [favorites])

  // ── startup 時：subscribe 済みなら一度だけ同期（他端末で変更された可能性） ──
  useEffect(() => {
    ;(async () => {
      try {
        if (!isPushSupported()) return
        const sub = await getCurrentSubscription()
        if (!sub) return
        const ids = loadFromStorage().map(f => f.spotId)
        await syncFavorites(ids)
      } catch (e) {
        console.warn('[favorites] startup sync failed', e)
      }
    })()
    // mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── soft prompt：お気に入り追加時、未購読＆通知未決定なら促す ───────
  useEffect(() => {
    if (!justAddedRef.current) return
    justAddedRef.current = false
    if (!shouldShowSoftPrompt()) return
    // 既に subscribe 済みならスキップ
    getCurrentSubscription().then(sub => {
      if (!sub) setSoftPromptOpen(true)
    })
  }, [favorites])

  const dismissSoftPrompt = useCallback((cooldown = true) => {
    setSoftPromptOpen(false)
    if (cooldown) {
      try { localStorage.setItem(SOFT_PROMPT_KEY, String(Date.now())) } catch {}
    }
  }, [])

  const value = useMemo<FavoritesContextValue>(() => ({
    favorites,
    favoriteIds,
    isFavorite,
    toggle,
    add,
    remove,
    count: favorites.length,
    softPromptOpen,
    dismissSoftPrompt,
  }), [favorites, favoriteIds, isFavorite, toggle, add, remove, softPromptOpen, dismissSoftPrompt])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
