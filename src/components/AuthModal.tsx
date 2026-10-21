import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, X } from 'lucide-react'
import { isSupabaseConfigured, signInWithEmail, signOutUser, signUpWithEmail, useAuth } from '../lib/supabase'
import { sfx } from '../shared'
import { ACCENT, btn, field } from './toolkit'

type Mode = 'signin' | 'signup'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AuthModal({ open, onClose }: Props) {
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  // تصفير النموذج في كل مرة تُفتح فيها النافذة
  useEffect(() => {
    if (!open) return
    setMode('signin')
    setEmail('')
    setPassword('')
    setConfirm('')
    setError('')
    setInfo('')
    setBusy(false)
  }, [open])

  // الإغلاق بمفتاح Esc
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        sfx.close()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const switchMode = (m: Mode): void => {
    setMode(m)
    setError('')
    setInfo('')
    setPassword('')
    setConfirm('')
  }

  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setError('')
    setInfo('')
    const mail = email.trim()
    if (!mail || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور')
      return
    }
    if (mode === 'signup') {
      if (password.length < 6) {
        setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
        return
      }
      if (password !== confirm) {
        setError('كلمتا المرور غير متطابقتين')
        return
      }
    }
    setBusy(true)
    try {
      const res = mode === 'signin' ? await signInWithEmail(mail, password) : await signUpWithEmail(mail, password)
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.needsConfirmation) {
        setInfo('تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.')
        setMode('signin')
        setPassword('')
        setConfirm('')
        return
      }
      sfx.success()
      onClose() // نجح الدخول: تتحدّث الحالة تلقائياً عبر مستمع الجلسة
    } finally {
      setBusy(false)
    }
  }

  const handleSignOut = async (): Promise<void> => {
    setBusy(true)
    const res = await signOutUser()
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    sfx.close()
    onClose()
  }

  const tab = (m: Mode): React.CSSProperties => (mode === m ? { background: ACCENT, color: '#111' } : {})

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="auth-modal"
          className="fixed inset-0 z-40 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              sfx.close()
              onClose()
            }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="تسجيل الدخول"
            dir="rtl"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-sm space-y-4 rounded-2xl border border-white/10 bg-[#0f1219]/90 p-5 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold" style={{ color: ACCENT }}>
                {user ? 'حسابك' : mode === 'signin' ? 'تسجيل الدخول' : 'إنشاء حساب'}
              </h2>
              <button
                aria-label="إغلاق"
                onClick={() => {
                  sfx.close()
                  onClose()
                }}
              >
                <X size={18} />
              </button>
            </div>

            {!isSupabaseConfigured ? (
              /* وضع الزائر: المفاتيح غير مضبوطة */
              <div className="space-y-2 text-sm">
                <p>أنت الآن في وضع الزائر، وكل ميزات التطبيق تعمل محلياً.</p>
                <p className="opacity-70">لتفعيل الحسابات والمزامنة السحابية:</p>
                <ol className="list-decimal space-y-1 pr-5 opacity-80">
                  <li>أنشئ مشروعاً في Supabase.</li>
                  <li>
                    أضف <span dir="ltr">VITE_SUPABASE_URL</span> و<span dir="ltr">VITE_SUPABASE_ANON_KEY</span> في ملف <span dir="ltr">.env</span>.
                  </li>
                  <li>شغّل سكربت SQL من SQL Editor.</li>
                  <li>أعد تشغيل خادم التطوير.</li>
                </ol>
              </div>
            ) : loading ? (
              <p className="py-4 text-center text-sm opacity-70">جارٍ التحقق من الجلسة…</p>
            ) : user ? (
              /* مستخدم مسجّل */
              <div className="space-y-3 text-sm">
                <p>
                  أنت مسجّل الدخول بالبريد:
                  <br />
                  <b className="break-all" dir="ltr">{user.email}</b>
                </p>
                {error && <p role="alert" className="text-red-300">{error}</p>}
                <button className={`${btn} flex items-center gap-2`} disabled={busy} onClick={handleSignOut}>
                  <LogOut size={14} />
                  {busy ? 'جارٍ الخروج…' : 'تسجيل الخروج'}
                </button>
              </div>
            ) : (
              /* نموذج الدخول / إنشاء حساب */
              <>
                <div className="flex gap-2">
                  <button type="button" className={btn} style={tab('signin')} onClick={() => switchMode('signin')}>
                    دخول
                  </button>
                  <button type="button" className={btn} style={tab('signup')} onClick={() => switchMode('signup')}>
                    حساب جديد
                  </button>
                </div>

                <form onSubmit={submit} className="space-y-3" noValidate>
                  <div className="space-y-1">
                    <label htmlFor="auth-email" className="text-sm opacity-80">البريد الإلكتروني</label>
                    <input
                      id="auth-email"
                      type="email"
                      dir="ltr"
                      autoComplete="email"
                      value={email}
                      onChange={ev => setEmail(ev.target.value)}
                      className={`${field} w-full`}
                      placeholder="name@example.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="auth-password" className="text-sm opacity-80">كلمة المرور</label>
                    <input
                      id="auth-password"
                      type="password"
                      dir="ltr"
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={ev => setPassword(ev.target.value)}
                      className={`${field} w-full`}
                    />
                  </div>
                  {mode === 'signup' && (
                    <div className="space-y-1">
                      <label htmlFor="auth-confirm" className="text-sm opacity-80">تأكيد كلمة المرور</label>
                      <input
                        id="auth-confirm"
                        type="password"
                        dir="ltr"
                        autoComplete="new-password"
                        value={confirm}
                        onChange={ev => setConfirm(ev.target.value)}
                        className={`${field} w-full`}
                      />
                    </div>
                  )}

                  {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                  {info && <p role="status" className="text-sm" style={{ color: ACCENT }}>{info}</p>}

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-black transition active:scale-95 disabled:opacity-60"
                    style={{ background: ACCENT }}
                  >
                    {busy ? 'يرجى الانتظار…' : mode === 'signin' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}