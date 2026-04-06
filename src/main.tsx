import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './App.css'
import { LangContext, translations } from './i18n'
import type { Lang } from './i18n'

function Root() {
  const saved = (localStorage.getItem('lang') as Lang) ?? 'ja'
  const [lang, setLangState] = useState<Lang>(saved)
  const setLang = (l: Lang) => {
    localStorage.setItem('lang', l)
    setLangState(l)
  }
  return (
    <LangContext.Provider value={{ lang, t: translations[lang], setLang }}>
      <App />
    </LangContext.Provider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
