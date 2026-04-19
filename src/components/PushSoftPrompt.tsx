// お気に入り追加時に表示される通知オプトインバナー
import { useState } from 'react'
import { useLang } from '../contexts/LangContext'
import { useFavorites } from '../contexts/FavoritesContext'
import {
  isPushSupported,
  requestNotificationPermission,
  subscribeToPush,
} from '../utils/push'

export function PushSoftPrompt() {
  const { t, lang } = useLang()
  const { softPromptOpen, dismissSoftPrompt, favorites } = useFavorites()
  const s = t('softPrompt')
  const [working, setWorking] = useState(false)

  if (!softPromptOpen) return null
  if (!isPushSupported()) return null

  async function accept() {
    setWorking(true)
    try {
      const perm = await requestNotificationPermission()
      if (perm !== 'granted') {
        dismissSoftPrompt(true)
        return
      }
      await subscribeToPush({
        lang,
        favoriteSpotIds: favorites.map((f) => f.spotId),
      })
      dismissSoftPrompt(true)
    } catch (e) {
      console.warn('[soft-prompt] subscribe failed', e)
      dismissSoftPrompt(true)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="push-soft-prompt" role="dialog" aria-live="polite">
      <div className="push-soft-prompt__inner">
        <div className="push-soft-prompt__text">
          <div className="push-soft-prompt__title">{s.title}</div>
          <div className="push-soft-prompt__body">{s.body}</div>
        </div>
        <div className="push-soft-prompt__actions">
          <button
            className="push-soft-prompt__later"
            onClick={() => dismissSoftPrompt(true)}
            disabled={working}
          >{s.laterBtn}</button>
          <button
            className="push-soft-prompt__accept"
            onClick={accept}
            disabled={working}
          >{s.acceptBtn}</button>
        </div>
      </div>
    </div>
  )
}
