import { useLang } from '../i18n'

interface Props {
  onClose: () => void
}

const STEPS_JA = [
  {
    icon: '📅',
    title: 'カレンダーで日付をタップ',
    desc: '行きたい日をタップすると、その日に見頃のスポット一覧が開きます',
  },
  {
    icon: '☆',
    title: 'スポットをマイプランに追加',
    desc: '気になるスポットの ☆ を押すと、その日の計画に追加されます',
  },
  {
    icon: '⭐',
    title: 'マイプランで旅程を確認',
    desc: 'カレンダー上部の「マイプラン」から、計画済みの全日程を一覧できます',
  },
]

const STEPS_ZH = [
  {
    icon: '📅',
    title: '在行事曆點選日期',
    desc: '點選想去的日期，會顯示當天適合賞花的景點列表',
  },
  {
    icon: '☆',
    title: '將景點加入我的行程',
    desc: '按下景點的 ☆ 按鈕，即可將該景點加入當天行程',
  },
  {
    icon: '⭐',
    title: '在我的行程確認計畫',
    desc: '點選行事曆上方的「我的行程」，可查看所有日期的計畫',
  },
]

export function TutorialOverlay({ onClose }: Props) {
  const { t, lang } = useLang()
  const steps = lang === 'zh-TW' ? STEPS_ZH : STEPS_JA

  return (
    <div className="tutorial-backdrop" onClick={onClose}>
      <div className="tutorial-card" onClick={e => e.stopPropagation()}>
        <div className="tutorial-header">
          <span className="tutorial-hero-icon">🌸</span>
          <h2 className="tutorial-title">{t.tutorialTitle}</h2>
          <p className="tutorial-subtitle">{t.tutorialSubtitle}</p>
        </div>

        <ol className="tutorial-steps">
          {steps.map((step, i) => (
            <li key={i} className="tutorial-step">
              <div className="tutorial-step-num">{i + 1}</div>
              <div className="tutorial-step-icon">{step.icon}</div>
              <div className="tutorial-step-body">
                <p className="tutorial-step-title">{step.title}</p>
                <p className="tutorial-step-desc">{step.desc}</p>
              </div>
            </li>
          ))}
        </ol>

        <button className="tutorial-close-btn" onClick={onClose}>
          {t.tutorialStart}
        </button>
      </div>
    </div>
  )
}
