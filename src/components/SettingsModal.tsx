// 設定モーダル：言語選択 + 通知トグル
import { useEffect, useState } from 'react'
import { useLang, type Lang } from '../contexts/LangContext'
import { useFavorites } from '../contexts/FavoritesContext'
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  type PushPermissionState,
} from '../utils/push'

interface Props {
  open: boolean
  onClose: () => void
}

const API_CONFIGURED = !!import.meta.env.VITE_PUSH_API_BASE

export function SettingsModal({ open, onClose }: Props) {
  const { t, lang, setLang } = useLang()
  const { favorites } = useFavorites()
  const s = t('settings')
  const langLabels = t('lang')

  const [permission, setPermission] = useState<PushPermissionState>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // モーダルを開いた時だけ状態再評価
  useEffect(() => {
    if (!open) return
    setError(null)
    if (!isPushSupported()) {
      setPermission('unsupported')
      setSubscribed(false)
      return
    }
    setPermission(getNotificationPermission())
    getCurrentSubscription().then((sub) => setSubscribed(!!sub))
  }, [open])

  async function handleToggleOn() {
    setError(null)
    setWorking(true)
    try {
      let perm = permission
      if (perm === 'default') {
        perm = await requestNotificationPermission()
        setPermission(perm)
      }
      if (perm !== 'granted') return
      const favIds = favorites.map((f) => f.spotId)
      await subscribeToPush({ lang, favoriteSpotIds: favIds })
      setSubscribed(true)
    } catch (e) {
      console.error('[settings] subscribe failed', e)
      setError(s.errorRetry)
    } finally {
      setWorking(false)
    }
  }

  async function handleToggleOff() {
    setError(null)
    setWorking(true)
    try {
      await unsubscribeFromPush()
      setSubscribed(false)
    } catch (e) {
      console.error('[settings] unsubscribe failed', e)
      setError(s.errorRetry)
    } finally {
      setWorking(false)
    }
  }

  if (!open) return null

  // 通知セクションの状態メッセージ
  let notifMessage: string | null = null
  let toggleDisabled = working
  if (!API_CONFIGURED) {
    notifMessage = s.notifUnavailable
    toggleDisabled = true
  } else if (permission === 'unsupported') {
    notifMessage = s.notifUnsupported
    toggleDisabled = true
  } else if (permission === 'denied') {
    notifMessage = s.notifDenied
    toggleDisabled = true
  }

  return (
    <div className="settings-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="settings-modal__panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal__header">
          <h2 className="settings-modal__title">{s.title}</h2>
          <button
            className="settings-modal__close"
            onClick={onClose}
            aria-label={s.close}
          >✕</button>
        </div>

        <div className="settings-modal__body">
          {/* 言語セクション */}
          <section className="settings-section">
            <h3 className="settings-section__title">{s.langSection}</h3>
            <div className="settings-lang-list">
              {(['ja', 'zh-TW', 'en'] as Lang[]).map((l) => (
                <label key={l} className={`settings-lang-item${lang === l ? ' is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="app-lang"
                    value={l}
                    checked={lang === l}
                    onChange={() => setLang(l)}
                  />
                  <span>{langLabels[l]}</span>
                </label>
              ))}
            </div>
          </section>

          {/* 通知セクション */}
          <section className="settings-section">
            <h3 className="settings-section__title">{s.notifSection}</h3>
            <div className={`settings-toggle${toggleDisabled ? ' is-disabled' : ''}`}>
              <span className="settings-toggle__label">{s.notifToggle}</span>
              <label className="toggle-switch" aria-label={s.notifToggle}>
                <input
                  type="checkbox"
                  checked={subscribed}
                  disabled={toggleDisabled}
                  onChange={(e) => {
                    if (e.target.checked) handleToggleOn()
                    else handleToggleOff()
                  }}
                />
                <span className="toggle-switch__slider" aria-hidden="true" />
              </label>
            </div>
            <p className="settings-note">{s.notifNote}</p>
            {notifMessage && <p className="settings-note settings-note--warn">{notifMessage}</p>}
            {working && <p className="settings-note">{s.working}</p>}
            {error && <p className="settings-note settings-note--error">{error}</p>}
          </section>
        </div>
      </div>
    </div>
  )
}
