import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

const STORAGE_KEY = 'sakura_favorites'

export type FavoriteEntry = { spotId: string; addedAt: number }

type FavoritesContextValue = {
  favorites: FavoriteEntry[]
  favoriteIds: Set<string>
  isFavorite: (spotId: string) => boolean
  toggle: (spotId: string) => boolean  // returns new state (true=favorited)
  add: (spotId: string) => void
  remove: (spotId: string) => void
  count: number
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

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>(loadFromStorage)

  // 変更時は localStorage に同期
  useEffect(() => {
    saveToStorage(favorites)
  }, [favorites])

  const favoriteIds = useMemo(() => new Set(favorites.map(f => f.spotId)), [favorites])

  const isFavorite = useCallback((spotId: string) => favoriteIds.has(spotId), [favoriteIds])

  const add = useCallback((spotId: string) => {
    setFavorites(prev => {
      if (prev.some(f => f.spotId === spotId)) return prev
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
      return [...prev, { spotId, addedAt: Date.now() }]
    })
    return newState
  }, [])

  const value = useMemo<FavoritesContextValue>(() => ({
    favorites,
    favoriteIds,
    isFavorite,
    toggle,
    add,
    remove,
    count: favorites.length,
  }), [favorites, favoriteIds, isFavorite, toggle, add, remove])

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within FavoritesProvider')
  return ctx
}
