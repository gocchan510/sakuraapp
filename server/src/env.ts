// 環境変数の読み込みと型付け
// Secret Manager に CRLF が混入した場合の事故防止で trim() を噛ませる
const getEnv = (k: string) => (process.env[k] || '').replace(/[\r\n]+/g, '').trim()

export const env = {
  VAPID_PUBLIC_KEY: getEnv('VAPID_PUBLIC_KEY'),
  VAPID_PRIVATE_KEY: getEnv('VAPID_PRIVATE_KEY'),
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:pc.yusuke.510@gmail.com',
  DEBUG_API_TOKEN: getEnv('DEBUG_API_TOKEN'),
  GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'mymapbot',
  PORT: Number(process.env.PORT || 8080),
  NODE_ENV: process.env.NODE_ENV || 'development',
  // Cloud Scheduler からのOIDC呼び出し元サービスアカウント（cron検証用）
  CRON_CALLER_SA: process.env.CRON_CALLER_SA || '',
  // CORS許可オリジン
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'https://gocchan510.github.io,http://localhost:5173').split(','),
} as const

export function requireEnv(key: keyof typeof env): string {
  const v = env[key] as string
  if (!v) throw new Error(`Missing environment variable: ${key}`)
  return v
}
