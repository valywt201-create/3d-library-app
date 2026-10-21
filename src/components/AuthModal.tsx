import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, ShieldCheck, X } from 'lucide-react'
import { isGoogleConfigured, renderGoogleButton, signOutGoogle, useGoogleAuth } from '../lib/googleAuth'
import { sfx } from '../shared'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AuthModal({ open, onClose }: Props) {
  const { user } = useGoogleAuth()
  const btnRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose) // نحتفظ بأحدث onClose دون إعادة رسم زر Google كل مرة
  closeRef.current = onClose
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [broken, setBroken] = useState(false)

  const close = (): void => { sfx.close(); onClose() }

  // رسم زر Google عند فتح النافذة (للزائر فقط)
  useEffect(() => {
    if (!open || user || !isGoogleConfigured || !btnRef.current) return undefined
    let cancelled = false
    setError('')
    setReady(false)
    renderGoogleButton(btnRef.current, 300, r => {
      if (cancelled) return
      if (r.error) { setError(r.error); return }
      sfx.success()
      closeRef.current()
    })
      .then(() => { if (!cancelled) setReady(true) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'حدث خطأ غير متوقع') })
    return () => { cancelled = true }
  }, [open, user])

  useEffect(() => { setBroken(false) }, [user?.picture])

  // الإغلاق بمفتاح Esc
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { sfx.close(); closeRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="auth-modal"
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 2000 }} // فوق كل النوافذ العائمة
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="تسجيل الدخول"
            dir="rtl"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.2 }}
            className="glass-strong relative w-full max-w-sm overflow-hidden rounded-2xl"
          >
            {/* وهج علوي بلون التوهّج الحالي */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-30"
              style={{ background: 'radial-gradient(ellipse at top, var(--accent), transparent 70%)' }}
            />

            <div className="relative space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--accent)' }}>
                  {user ? 'حسابك' : 'تسجيل الدخول'}
                </h2>
                <button aria-label="إغلاق" onClick={close}><X size={18} /></button>
              </div>

              {user ? (
                /* ===== مستخدم مسجّل ===== */
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    {user.picture && !broken ? (
                      <img
                        src={user.picture}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={() => setBroken(true)}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                        style={{ boxShadow: '0 0 0 2px var(--accent)' }}
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-black" style={{ background: 'var(--accent)' }}>
                        {(user.name[0] ?? '?').toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{user.name}</p>
                      <p className="truncate text-xs opacity-70" dir="ltr">{user.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => { signOutGoogle(); sfx.close(); onClose() }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm transition hover:bg-white/20 active:scale-95"
                  >
                    <LogOut size={14} />تسجيل الخروج
                  </button>
                </div>
              ) : !isGoogleConfigured ? (
                /* ===== المعرّف غير مضبوط: خطوات الإعداد ===== */
                <div className="space-y-2 text-sm">
                  <p>تسجيل الدخول بحساب Google غير مفعّل بعد، والتطبيق يعمل كزائر.</p>
                  <ol className="list-decimal space-y-1 pr-5 text-xs opacity-80">
                    <li>أنشئ OAuth client ID من نوع Web في Google Cloud Console.</li>
                    <li>أضف <span dir="ltr">http://localhost:5173</span> إلى Authorized JavaScript origins.</li>
                    <li>ضع المعرّف في ملف <span dir="ltr">.env</span> باسم <span dir="ltr">VITE_GOOGLE_CLIENT_ID</span>.</li>
                    <li>أعد تشغيل خادم التطوير.</li>
                  </ol>
                </div>
              ) : (
                /* ===== زر Google ===== */
                <div className="space-y-4">
                  <p className="text-sm opacity-80">سجّل الدخول بحسابك في Google لتخصيص مكتبتك.</p>
                  <div className="flex min-h-11 items-center justify-center">
                    <div ref={btnRef} />
                    {!ready && !error && <span className="absolute text-xs opacity-60">جارٍ تحميل زر Google…</span>}
                  </div>
                  {error && <p role="alert" className="text-center text-sm text-red-300">{error}</p>}
                  <p className="flex items-start gap-2 text-[11px] opacity-60">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                    يُحفظ اسمك وبريدك وصورتك في هذا المتصفح فقط، ولا يُحفظ أي رمز دخول.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}