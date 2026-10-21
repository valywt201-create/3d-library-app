import type { Item } from './shared'

/* ============ الإعدادات (غيّرها هنا مباشرة) ============ */
export const GOOGLE_CLIENT_ID = '' // معرّف OAuth من Google Cloud Console (للنسخ الاحتياطي إلى Drive)

/* ============ أنواع مبسّطة لمكتبة Google Identity Services ============ */
interface TokenResponse {
  access_token?: string
  error?: string
}
interface TokenClient {
  requestAccessToken: () => void
}
interface GoogleOAuth2 {
  initTokenClient: (config: {
    client_id: string
    scope: string
    callback: (r: TokenResponse) => void
  }) => TokenClient
}
interface GoogleGlobal {
  accounts?: { oauth2?: GoogleOAuth2 }
}

// نقرأ الكائن العام google بدل استخدام any
const getGoogle = (): GoogleGlobal | undefined =>
  (window as unknown as { google?: GoogleGlobal }).google

let gToken: string | null = null

function loadGoogleScript(): Promise<void> {
  return new Promise<void>((res, rej) => {
    if (getGoogle()?.accounts) {
      res()
      return
    }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = () => res()
    s.onerror = () => rej(new Error('تعذّر تحميل سكربت Google'))
    document.head.appendChild(s)
  })
}

async function googleSignIn(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) throw new Error('ضع GOOGLE_CLIENT_ID في أعلى src/drive.ts أولاً')
  await loadGoogleScript()
  const oauth = getGoogle()?.accounts?.oauth2
  if (!oauth) throw new Error('تعذّر تهيئة تسجيل الدخول بحساب Google')
  return new Promise<void>((res, rej) => {
    oauth
      .initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: r => {
          if (r.access_token) {
            gToken = r.access_token
            res()
          } else {
            rej(new Error(r.error || 'فشل تسجيل الدخول'))
          }
        },
      })
      .requestAccessToken()
  })
}

async function uploadToDrive(name: string, blob: Blob): Promise<void> {
  if (!gToken) throw new Error('لم تسجّل الدخول')
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify({ name })], { type: 'application/json' }))
  form.append('file', blob)
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${gToken}` },
    body: form,
  })
  if (!r.ok) throw new Error(`فشل الرفع إلى Drive (${r.status})`)
}

// ينسخ كل الملفات المرفوعة احتياطياً، ويضيف اسم الفرع إلى اسم كل ملف
export async function backupAll(
  items: Item[],
  titleOf: (id: string) => string,
  onProgress: (msg: string) => void,
): Promise<number> {
  if (!gToken) await googleSignIn()
  const files = items.filter(i => i.file)
  for (const [n, i] of files.entries()) {
    onProgress(`جارٍ الرفع ${n + 1}/${files.length}`)
    await uploadToDrive(`${titleOf(i.nodeId)} - ${i.file!.name}`, i.file!)
  }
  return files.length
}