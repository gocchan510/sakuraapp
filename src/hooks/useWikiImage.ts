import { useState, useEffect } from 'react'

const cache: Record<string, string> = {}

export function useWikiImage(wikiTitleJa: string, wikiTitleEn: string): string | null {
  const key = wikiTitleJa || wikiTitleEn
  const [imageUrl, setImageUrl] = useState<string | null>(cache[key] ?? null)

  useEffect(() => {
    if (!key) return
    if (cache[key]) {
      setImageUrl(cache[key])
      return
    }

    const tryFetch = async (lang: 'ja' | 'en', title: string): Promise<string | null> => {
      try {
        const encoded = encodeURIComponent(title.replace(/_/g, ' '))
        const res = await fetch(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
          { signal: AbortSignal.timeout(6000) }
        )
        if (!res.ok) return null
        const data = await res.json()
        return data?.thumbnail?.source ?? data?.originalimage?.source ?? null
      } catch {
        return null
      }
    }

    ;(async () => {
      let url = await tryFetch('ja', wikiTitleJa)
      if (!url && wikiTitleEn) {
        url = await tryFetch('en', wikiTitleEn)
      }
      if (url) {
        cache[key] = url
        setImageUrl(url)
      }
    })()
  }, [key, wikiTitleJa, wikiTitleEn])

  return imageUrl
}
