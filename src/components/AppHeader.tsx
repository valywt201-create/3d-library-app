import { useEffect, useState } from 'react'
import { Library, Settings, UserRound } from 'lucide-react'
import { useAuth } from '../lib/supabase'
import { sfx } from '../shared'
import AuthModal from './AuthModal'

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/* ============ شارة الحساب: صورة المستخدم أو حالة الزائر ============ */
function ProfileBadge({ accent, onClick }: { accent: string; onClick: () => void }) {
  const { user, loading } = useAuth()
  const [broken, setBroken] = useState(false)
  const meta = user?.user_metadata as Record<string, unknown> | undefined
  const avatar = str(meta?.avatar_url) || str(meta?.picture)
  const name = str(meta?.full_name) || user?.email?.split('@')[0] || ''

  useEffect(() => { setBroken(false) }, [avatar]) // نعيد المحاولة عند تغيّر الصورة

  if (loading) return <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" aria-label="جارٍ التحقق من الحساب" />

  return (
    <button
      onClick={() => { sfx.click(); onClick() }}
      aria-label={user ? `حسابك: ${name}` : 'زائر، انقر لتسجيل الدخول'}
      title={user?.email ?? 'تسجيل الدخول'}
      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1 pe-3 ps-1 transition hover:bg-white/10 active:scale-95"
    >
      {user ? (
        avatar && !broken ? (
          <img src={avatar} alt="" onError={() => setBroken(true)} className="h-7 w-7 rounded-full object-cover" style={{ boxShadow: `0 0 0 2px ${accent}` }} />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-black" style={{ background: accent }}>
            {(name[0] ?? '?').toUpperCase()}
          </span>
        )
      ) : (
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10"><UserRound size={15} /></span>
      )}
      <span className="hidden max-w-28 truncate text-xs sm:inline">{user ? name : 'زائر'}</span>
    </button>
  )
}

/* ============ الترويسة العلوية ============ */
interface Props {
  accent: string
  onOpenSettings: () => void
}

export default function AppHeader({ accent, onOpenSettings }: Props) {
  const [authOpen, setAuthOpen] = useState(false)

  return (
    <>
      <header className="glass sticky top-0 z-20 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-black shadow-glow"
              style={{ background: `linear-gradient(135deg, ${accent}, #8b5cf6)` }}
            >
              <Library size={18} />
            </span>
            <h1 className="font-kufi truncate bg-gradient-to-l from-violet-300 via-white to-sky-300 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
              المكتبة النموذجية
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              aria-label="الإعدادات"
              aria-haspopup="dialog"
              title="الإعدادات"
              onClick={() => { sfx.open(); onOpenSettings() }}
              className="group flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 transition hover:bg-white/10 active:scale-95"
            >
              <Settings size={17} className="transition-transform duration-300 group-hover:rotate-90" />
            </button>
            <ProfileBadge accent={accent} onClick={() => setAuthOpen(true)} />
          </div>
        </div>
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}