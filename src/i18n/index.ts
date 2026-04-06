import { createContext, useContext } from 'react'
import { ja } from './ja'
import { zhTW } from './zh-TW'

export type Lang = 'ja' | 'zh-TW'

export const translations = { ja, 'zh-TW': zhTW }

export const LangContext = createContext<{
  lang: Lang
  t: typeof ja
  setLang: (l: Lang) => void
}>({
  lang: 'ja',
  t: ja,
  setLang: () => {},
})

export const useLang = () => useContext(LangContext)
