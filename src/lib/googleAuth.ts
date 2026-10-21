import { useSyncExternalStore } from 'react'

/* ============ الإعدادات ============ */
// معرّف عميل OAuth من Google Cloud Console، ويُقرأ من ملف .env
export const GOOGLE_CLIENT_ID: string = ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '').trim()
// لا نعدّ الإعداد صالحاً إلا إذا كان معرّف OAuth من نوع Web وبالصيغة المعروفة لدى Google.
export const isGoogleConfigured: boolean = /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID)

const KEY = 'atelier-google-auth-v1'
const SESSION_DAYS = 30
const DAY_MS = 86_400_000

/* ============ الأنواع ============ */
export interface GoogleUser {
  sub: string        // معرّف Google الثابت للمستخدم
  name: string
  email: string
  picture: string    // رابط الصورة (قد يكون فارغاً)
  signedInAt: number // وقت الدخول، لحساب مدة الجلسة المحلية
}

export interface AuthResult {
  error: string | null
}

interface AuthState {
  user: GoogleUser | null
}

/* ============ القراءة والكتابة الآمنة في localStorage ============ */
function isUser(v: unknown): v is GoogleUser {
  const u = v as Partial<GoogleUser> | null
  return (
    !!u &&
    typeof u.sub === 'string' &&
    typeof u.name === 'string' &&
    typeof u.email === 'string' &&
    typeof u.picture === 'string' &&
    typeof u.signedInAt === 'number'
  )
}

function load(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isUser(parsed)) return null
    if (Date.now() - parsed.signedInAt >= SESSION_DAYS * DAY_MS) {
      localStorage.removeItem(KEY) // انتهت الجلسة المحلية
      return null
    }
    return parsed
  } catch {
    return null // بيانات تالفة أو التخزين غير متاح
  }
}

function save(user: GoogleUser | null): void {
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user))
    else localStorage.removeItem(KEY)
  } catch { /* تجاهل: التخزين ممتلئ أو ممنوع */ }
}

/* ============ المتجر (يُقرأ من أي مكوّن عبر useGoogleAuth) ============ */
let state: AuthState = { user: load() }
const listeners = new Set<() => void>()

function setUser(user: GoogleUser | null): void {
  state = { user } // نستبدل الكائن كاملاً ليبقى snapshot ثابتاً بين التغييرات
  save(user)
  listeners.forEach(l => l())
}

// مزامنة عند الدخول أو الخروج من تبويب آخر
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== KEY) return
    state = { user: load() }
    listeners.forEach(l => l())
  })
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
const getSnapshot = (): AuthState => state

export function useGoogleAuth(): AuthState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/* ============ قراءة رمز Google (JWT) ============ */
function decodeJwt(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
    const json: unknown = JSON.parse(new TextDecoder().decode(bytes)) // TextDecoder لدعم الأسماء العربية
    return json && typeof json === 'object' ? (json as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// يتحقق من الرمز ويحفظ بيانات المستخدم محلياً (دون حفظ الرمز نفسه)
export function signInWithGoogleCredential(credential: string): AuthResult {
  const c = decodeJwt(credential)
  if (!c) return { error: 'استجابة Google غير صالحة' }

  const iss = c.iss
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') return { error: 'مصدر الاستجابة غير موثوق' }
  if (c.aud !== GOOGLE_CLIENT_ID) return { error: 'معرّف العميل لا يطابق هذا التطبيق' }
  const exp = c.exp
  if (typeof exp !== 'number' || exp * 1000 < Date.now()) return { error: 'انتهت صلاحية استجابة Google، أعد المحاولة' }

  const sub = c.sub
  const email = c.email
  if (typeof sub !== 'string' || typeof email !== 'string') return { error: 'بيانات الحساب ناقصة في استجابة Google' }
  const name = c.name
  const picture = c.picture

  setUser({
    sub,
    email,
    name: typeof name === 'string' && name ? name : email.split('@')[0],
    picture: typeof picture === 'string' ? picture : '',
    signedInAt: Date.now(),
  })
  return { error: null }
}

/* ============ تحميل زر Google الرسمي (Google Identity Services) ============ */
interface GsiCredentialResponse { credential?: string }
interface GsiButtonOptions {
  type: 'standard'
  theme: 'outline' | 'filled_blue' | 'filled_black'
  size: 'large' | 'medium' | 'small'
  shape: 'pill' | 'rectangular'
  text: 'signin_with' | 'signup_with' | 'continue_with'
  logo_alignment: 'left' | 'center'
  width: number
  locale: string
}
interface GsiId {
  initialize: (config: { client_id: string; callback: (r: GsiCredentialResponse) => void; ux_mode: 'popup' }) => void
  renderButton: (el: HTMLElement, options: GsiButtonOptions) => void
  disableAutoSelect: () => void
}

const getGsi = (): GsiId | undefined =>
  (window as unknown as { google?: { accounts?: { id?: GsiId } } }).google?.accounts?.id

const GSI_SRC = 'https://accounts.google.com/gsi/client'
let gsiPromise: Promise<GsiId> | null = null

function loadGsi(): Promise<GsiId> {
  const ready = getGsi()
  if (ready) return Promise.resolve(ready)
  gsiPromise ??= new Promise<GsiId>((res, rej) => {
    const done = (): void => {
      const g = getGsi()
      if (g) res(g)
      else { gsiPromise = null; rej(new Error('تعذّر تهيئة تسجيل الدخول بحساب Google')) }
    }
    const fail = (): void => {
      gsiPromise = null
      rej(new Error('تعذّر تحميل سكربت Google، تحقق من الإنترنت'))
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    const s = existing ?? document.createElement('script')
    s.addEventListener('load', done)
    s.addEventListener('error', fail)
    if (!existing) {
      s.src = GSI_SRC
      s.async = true
      document.head.appendChild(s)
    }
  })
  return gsiPromise
}

// يرسم زر Google داخل العنصر، وعند اكتمال الدخول يستدعي onResult
export async function renderGoogleButton(el: HTMLElement, width: number, onResult: (r: AuthResult) => void): Promise<void> {
  const gsi = await loadGsi()
  gsi.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: r => onResult(r.credential ? signInWithGoogleCredential(r.credential) : { error: 'لم تصل استجابة من Google' }),
    ux_mode: 'popup',
  })
  el.innerHTML = ''
  gsi.renderButton(el, { type: 'standard', theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'left', width, locale: 'ar' })
}

export function signOutGoogle(): void {
  setUser(null)
  try { getGsi()?.disableAutoSelect() } catch { /* تجاهل */ }
}
