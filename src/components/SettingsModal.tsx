import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArchiveRestore, Bot, Check, Moon, Palette, RotateCcw, Sparkles, Square, Trash2, Wrench, X } from 'lucide-react'
import { sfx, useLibrary, useTree } from '../shared'
import {
  ACCENT_PRESETS, AI_PERSONALITIES, TOOL_CATALOG, TRASH_RETENTION_DAYS,
  readableOn, resetSettings, toggleToolVisibility, updateSettings, useSettings,
} from '../lib/settings'
import type { ThemeId } from '../lib/settings'
import { collectNodeIds, daysLeft, emptyTrash, removeFromTrash, useTrash } from '../lib/trash'
import type { TrashEntry } from '../lib/trash'

type TabId = 'look' | 'tools' | 'trash' | 'ai'

const TABS: { id: TabId; label: string; Icon: typeof Palette }[] = [
  { id: 'look', label: 'المظهر والثيمات', Icon: Palette },
  { id: 'tools', label: 'تخصيص الأدوات', Icon: Wrench },
  { id: 'trash', label: `سلة المهملات (${TRASH_RETENTION_DAYS} يوم)`, Icon: Trash2 },
  { id: 'ai', label: 'الذكاء الاصطناعي', Icon: Bot },
]

const THEMES: { id: ThemeId; label: string; hint: string; Icon: typeof Sparkles }[] = [
  { id: 'space-live', label: 'فضاء حيّ', hint: 'نجوم وكواكب متحركة', Icon: Sparkles },
  { id: 'space-static', label: 'فضاء ثابت', hint: 'سديم خفيف، أخف على الجوال', Icon: Moon },
  { id: 'solid', label: 'داكن سادة', hint: 'بلا خلفية متحركة، أعلى تباين', Icon: Square },
]

const HI = 'var(--accent)' // لون التوهّج العام، يتبع الإعدادات والفرع النشط

const fmtSize = (n: number): string => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

/* ============ مفتاح تبديل (Switch) ============ */
interface SwitchProps {
  on: boolean
  label: string
  onChange: (v: boolean) => void
}

function Switch({ on, label, onChange }: SwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ background: on ? HI : 'rgba(255,255,255,.15)' }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
        style={{ insetInlineStart: on ? '1.375rem' : '0.125rem' }}
      />
    </button>
  )
}

/* ============ تبويب سلة المهملات ============ */
function TrashTab() {
  const { entries, ready, error } = useTrash()
  const { restoreNode } = useTree()
  const { add } = useLibrary()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const chip = 'rounded-lg bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/20 active:scale-95 disabled:opacity-50'

  // الاستعادة: الفرع إلى موضعه الأصلي، وملفاته إلى المكتبة
  const restore = async (e: TrashEntry): Promise<void> => {
    if (busy) return
    setBusy(e.id)
    setMsg('')
    try {
      const res = restoreNode(e.node, e.parentId, e.index)
      if (res === 'conflict') {
        setMsg('تعذّرت الاستعادة: يوجد في الشجرة فرع بالمعرّف نفسه.')
        return
      }
      e.files.forEach(f =>
        add({ nodeId: f.nodeId, name: f.name, kind: f.kind, size: f.size, file: f.file, url: URL.createObjectURL(f.file) }),
      )
      await removeFromTrash(e.id)
      sfx.success()
      setMsg(
        res === 'root'
          ? `استُعيد «${e.title}» كقسم رئيسي لأن مكانه الأصلي لم يعد موجوداً.`
          : `استُعيد «${e.title}» إلى مكانه الأصلي.`,
      )
    } finally {
      setBusy(null)
    }
  }

  const purge = async (e: TrashEntry): Promise<void> => {
    if (busy || !window.confirm(`حذف «${e.title}» نهائياً؟ لا يمكن التراجع.`)) return
    setBusy(e.id)
    await removeFromTrash(e.id)
    sfx.close()
    setMsg('')
    setBusy(null)
  }

  const purgeAll = async (): Promise<void> => {
    if (busy || !window.confirm('إفراغ سلة المهملات نهائياً؟ لا يمكن التراجع.')) return
    setBusy('all')
    await emptyTrash()
    sfx.close()
    setMsg('')
    setBusy(null)
  }

  if (!ready) return <p className="py-6 text-center text-sm opacity-60">جارٍ تحميل السلة…</p>
  if (error) return <p className="py-6 text-center text-sm text-red-300">{error}</p>

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm opacity-80">
          تُحفظ العناصر المحذوفة {TRASH_RETENTION_DAYS} يوماً ثم تُحذف نهائياً. عدد العناصر: {entries.length}
        </p>
        <button className={chip} disabled={!entries.length || busy !== null} onClick={() => { void purgeAll() }}>إفراغ السلة</button>
      </div>

      {msg && <p role="status" className="text-sm" style={{ color: HI }}>{msg}</p>}

      {!entries.length ? (
        <div className="space-y-2 py-8 text-center">
          <Trash2 size={36} className="mx-auto opacity-40" />
          <p className="text-sm font-semibold">السلة فارغة</p>
          <p className="mx-auto max-w-sm text-xs opacity-60">الأقسام والفروع التي تحذفها تظهر هنا وتستطيع استعادتها.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map(e => {
            const left = daysLeft(e)
            const branches = collectNodeIds(e.node).length
            const size = e.files.reduce((a, f) => a + f.size, 0)
            return (
              <li key={e.id} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-semibold">{e.title}</p>
                    <p className="text-[11px] opacity-60">
                      {branches} فرع · {e.files.length} ملف ({fmtSize(size)}) · حُذف {new Date(e.deletedAt).toLocaleDateString('ar')}
                    </p>
                    <p className="text-[11px]" style={{ color: left <= 7 ? '#fca5a5' : undefined }}>
                      يُحذف نهائياً بعد {left} يوم
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      className={`${chip} flex items-center gap-1 text-xs`}
                      disabled={busy !== null}
                      onClick={() => { void restore(e) }}
                      style={{ background: HI, color: '#111' }}
                    >
                      <ArchiveRestore size={13} />استعادة
                    </button>
                    <button
                      className={`${chip} flex items-center gap-1 text-xs`}
                      disabled={busy !== null}
                      onClick={() => { void purge(e) }}
                      aria-label={`حذف ${e.title} نهائياً`}
                    >
                      <Trash2 size={13} />حذف نهائي
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/* ============ نافذة الإعدادات ============ */
interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsModal({ open, onClose }: Props) {
  const s = useSettings()
  const trash = useTrash()
  const [tab, setTab] = useState<TabId>('look')

  const onHi = s.accentMode === 'custom' ? readableOn(s.customAccent) : '#111'
  const sel = (active: boolean): CSSProperties => (active ? { background: HI, color: onHi } : {})

  // الإغلاق بمفتاح Esc
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { setTab('look'); sfx.close(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const close = (): void => { setTab('look'); sfx.close(); onClose() }
  const chip = 'rounded-lg bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/20 active:scale-95'
  const visibleCount = TOOL_CATALOG.filter(t => !s.hiddenTools.includes(t.id)).length

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-modal"
          className="fixed inset-0 flex items-center justify-center p-3"
          style={{ zIndex: 2000 }} // فوق كل النوافذ العائمة
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <div aria-hidden="true" className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={close} />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            dir="rtl"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className="glass-strong relative flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/40"
          >
            {/* الرأس */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <h2 id="settings-modal-title" className="text-lg font-semibold" style={{ color: HI }}>الإعدادات</h2>
              <div className="flex items-center gap-2">
                <button
                  className={`${chip} flex items-center gap-1 text-xs`}
                  onClick={() => { if (window.confirm('إعادة كل الإعدادات إلى الافتراضي؟')) { sfx.click(); resetSettings() } }}
                >
                  <RotateCcw size={13} />إعادة الضبط
                </button>
                <button aria-label="إغلاق الإعدادات" title="إغلاق" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-lg transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ outlineColor: HI }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* التبويبات */}
            <div role="tablist" aria-label="أقسام الإعدادات" className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 py-2">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => { sfx.click(); setTab(id) }}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition hover:bg-white/10 active:scale-95"
                  style={sel(tab === id)}
                >
                  <Icon size={14} />{label}
                  {id === 'trash' && trash.entries.length > 0 && (
                    <span className="rounded-full bg-black/30 px-1.5 text-[10px] tabular-nums">{trash.entries.length}</span>
                  )}
                </button>
              ))}
            </div>

            {/* المحتوى */}
            <div role="tabpanel" className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
              {/* ===== المظهر والثيمات ===== */}
              {tab === 'look' && (
                <>
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">خلفية التطبيق</h3>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {THEMES.map(({ id, label, hint, Icon }) => (
                        <button
                          key={id}
                          aria-pressed={s.theme === id}
                          onClick={() => { sfx.click(); updateSettings({ theme: id }) }}
                          className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-start transition hover:bg-white/10 active:scale-95"
                          style={s.theme === id ? { borderColor: HI, boxShadow: `0 0 0 1px ${HI}` } : undefined}
                        >
                          <Icon size={18} style={{ color: s.theme === id ? HI : undefined }} />
                          <p className="text-sm font-semibold">{label}</p>
                          <p className="text-[11px] opacity-60">{hint}</p>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">نوافذ الأدوات</h3>
                    <div className="flex gap-2">
                      <button className={chip} style={sel(s.windowStyle === 'glass')} aria-pressed={s.windowStyle === 'glass'} onClick={() => { sfx.click(); updateSettings({ windowStyle: 'glass' }) }}>
                        زجاجية شفافة
                      </button>
                      <button className={chip} style={sel(s.windowStyle === 'solid')} aria-pressed={s.windowStyle === 'solid'} onClick={() => { sfx.click(); updateSettings({ windowStyle: 'solid' }) }}>
                        عاتمة (أوضح للنص)
                      </button>
                    </div>

                    {s.windowStyle === 'glass' && (
                      <label className="flex items-center gap-3 text-sm">
                        <span className="shrink-0">الكثافة</span>
                        <input
                          type="range" min={30} max={98} step={1}
                          value={Math.round(s.glassOpacity * 100)}
                          onChange={e => updateSettings({ glassOpacity: Number(e.target.value) / 100 })}
                          className="flex-1"
                          aria-label="كثافة الزجاج"
                        />
                        <span className="w-10 text-end tabular-nums" dir="ltr">{Math.round(s.glassOpacity * 100)}%</span>
                      </label>
                    )}

                    {/* معاينة: نص خلفي يمرّ خلف نافذة بالإعدادات الحالية، فترى التباين مباشرة */}
                    <div className="relative overflow-hidden rounded-xl p-4" style={{ background: 'linear-gradient(120deg,#8b5cf6,#3b82f6,#f9a8d4)' }}>
                      <p aria-hidden className="select-none text-3xl font-black leading-none text-white/90">ABC أبجد 123 XYZ هوز</p>
                      <div
                        className="-mt-4 rounded-lg p-3 text-sm"
                        style={{
                          background: s.windowStyle === 'solid' ? '#0d1117' : `rgba(12,14,26,${s.glassOpacity})`,
                          backdropFilter: s.windowStyle === 'solid' ? 'none' : 'blur(24px)',
                          WebkitBackdropFilter: s.windowStyle === 'solid' ? 'none' : 'blur(24px)',
                          border: '1px solid rgba(167,139,250,.25)',
                        }}
                      >
                        معاينة نافذة أداة: هل النص واضح؟
                      </div>
                    </div>
                  </section>

                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">لون التوهّج</h3>
                    <div className="flex gap-2">
                      <button className={chip} style={sel(s.accentMode === 'auto')} aria-pressed={s.accentMode === 'auto'} onClick={() => { sfx.click(); updateSettings({ accentMode: 'auto' }) }}>
                        تلقائي (يتبع الفرع)
                      </button>
                      <button className={chip} style={sel(s.accentMode === 'custom')} aria-pressed={s.accentMode === 'custom'} onClick={() => { sfx.click(); updateSettings({ accentMode: 'custom' }) }}>
                        مخصّص
                      </button>
                    </div>
                    {s.accentMode === 'custom' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {ACCENT_PRESETS.map(c => (
                          <button
                            key={c}
                            aria-label={`اللون ${c}`}
                            aria-pressed={s.customAccent.toLowerCase() === c}
                            onClick={() => { sfx.click(); updateSettings({ customAccent: c }) }}
                            className="flex h-8 w-8 items-center justify-center rounded-full transition active:scale-90"
                            style={{ background: c, outline: s.customAccent.toLowerCase() === c ? '2px solid #fff' : 'none', outlineOffset: 2 }}
                          >
                            {s.customAccent.toLowerCase() === c && <Check size={14} color={readableOn(c)} />}
                          </button>
                        ))}
                        <label className="flex items-center gap-2 text-xs opacity-80">
                          لون آخر
                          <input type="color" value={s.customAccent} onChange={e => updateSettings({ customAccent: e.target.value })} aria-label="اختيار لون مخصص" />
                        </label>
                      </div>
                    )}
                  </section>
                </>
              )}

              {/* ===== تخصيص الأدوات ===== */}
              {tab === 'tools' && (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm opacity-80">الظاهرة في شريط الأدوات: {visibleCount} من {TOOL_CATALOG.length}</p>
                    <div className="flex gap-2">
                      <button className={chip} onClick={() => { sfx.click(); updateSettings({ hiddenTools: [] }) }}>إظهار الكل</button>
                      <button className={chip} onClick={() => { sfx.click(); updateSettings({ hiddenTools: TOOL_CATALOG.map(t => t.id) }) }}>إخفاء الكل</button>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {TOOL_CATALOG.map(t => {
                      const on = !s.hiddenTools.includes(t.id)
                      return (
                        <li key={t.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                          <span className={on ? '' : 'opacity-50'}>{t.label}</span>
                          <Switch on={on} label={`إظهار ${t.label}`} onChange={() => { sfx.click(); toggleToolVisibility(t.id) }} />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {/* ===== سلة المهملات ===== */}
              {tab === 'trash' && <TrashTab />}

              {/* ===== الذكاء الاصطناعي ===== */}
              {tab === 'ai' && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">أسلوب الإجابة</h3>
                  <div role="radiogroup" aria-label="شخصية الذكاء الاصطناعي" className="grid gap-2 sm:grid-cols-2">
                    {AI_PERSONALITIES.map(p => (
                      <button
                        key={p.id}
                        role="radio"
                        aria-checked={s.aiPersonality === p.id}
                        onClick={() => { sfx.click(); updateSettings({ aiPersonality: p.id }) }}
                        className="space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-start transition hover:bg-white/10 active:scale-95"
                        style={s.aiPersonality === p.id ? { borderColor: HI, boxShadow: `0 0 0 1px ${HI}` } : undefined}
                      >
                        <p className="text-sm font-semibold" style={{ color: s.aiPersonality === p.id ? HI : undefined }}>{p.label}</p>
                        <p className="text-[11px] opacity-60">{p.hint}</p>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
