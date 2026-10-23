import { useCallback, useState } from 'react'

/* ============ إعدادات المظهر المحفوظة (الخلفية حية أم ثابتة) ============ */
export type BgMode = 'live' | 'static'
export interface Appearance { bg: BgMode }

const KEY = 'atelier-appearance-v1'

function load(): Appearance {
  try {
    const raw = localStorage.getItem(KEY)
    const p = raw ? (JSON.parse(raw) as Partial<Appearance>) : null
    if (p && (p.bg === 'live' || p.bg === 'static')) return { bg: p.bg }
  } catch { /* تجاهل: قيمة تالفة */ }
  // الافتراضي: ثابتة لمن يفضّل تقليل الحركة في نظامه، وحيّة لغيره
  const calm = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return { bg: calm ? 'static' : 'live' }
}

export function useAppearance(): [Appearance, (patch: Partial<Appearance>) => void] {
  const [appearance, setAppearance] = useState<Appearance>(load)
  const update = useCallback((patch: Partial<Appearance>) => {
    setAppearance(prev => {
      const next = { ...prev, ...patch }
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* تجاهل: التخزين ممتلئ أو ممنوع */ }
      return next
    })
  }, [])
  return [appearance, update]
}