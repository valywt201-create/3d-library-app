import { useCallback, useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArchiveRestore, Bot, Check, Palette, RotateCcw, ShieldCheck, Sparkles, Trash2, Wrench, X } from 'lucide-react'
import { sfx, useLibrary, useTree } from '../shared'
import {
  ACCENT_PRESETS, AI_PERSONALITIES, TOOL_CATALOG, TRASH_RETENTION_DAYS,
  readableOn, resetSettings, toggleToolVisibility, updateSettings, useSettings,
} from '../lib/settings'
import type { ThemeId, ThemePalette } from '../lib/settings'
import { collectNodeIds, daysLeft, emptyTrash, removeFromTrash, useTrash } from '../lib/trash'
import type { TrashEntry } from '../lib/trash'
import { tr, useLocale } from '../lib/i18n'
import { requestStudyAI } from '../lib/studyAssistant'
import type { Locale } from '../lib/i18n'
import SupportHub from './SupportHub'
import LegalModal from './LegalModal'

type TabId = 'look' | 'tools' | 'trash' | 'ai' | 'legal' | 'support'
type LegalDocument = 'privacy' | 'terms'

const TABS: readonly { id: TabId; label: { en: string; ar: string }; Icon: typeof Palette }[] = [
  { id: 'look', label: { en: 'Appearance', ar: 'المظهر' }, Icon: Palette },
  { id: 'tools', label: { en: 'Tools', ar: 'الأدوات' }, Icon: Wrench },
  { id: 'trash', label: { en: 'Trash', ar: 'المحذوفات' }, Icon: Trash2 },
  { id: 'ai', label: { en: 'AI style', ar: 'أسلوب AI' }, Icon: Bot },
  { id: 'legal', label: { en: 'Privacy & Terms', ar: 'الخصوصية والشروط' }, Icon: ShieldCheck },
  { id: 'support', label: { en: 'Support', ar: 'الدعم' }, Icon: Sparkles },
]

const THEMES: readonly { id: ThemeId; label: { en: string; ar: string }; hint: { en: string; ar: string }; swatch: string }[] = [
  { id: 'space-live', label: { en: 'Live cosmos', ar: 'فضاء متحرك' }, hint: { en: 'Subtle animated stars', ar: 'نجوم متحركة بهدوء' }, swatch: 'linear-gradient(135deg,#10172c,#653b8f,#7dd3fc)' },
  { id: 'space-static', label: { en: 'Quiet cosmos', ar: 'فضاء هادئ' }, hint: { en: 'A calm, static night sky', ar: 'سماء ليلية ثابتة' }, swatch: 'linear-gradient(135deg,#10172c,#242447,#7384c7)' },
  { id: 'solid', label: { en: 'Midnight', ar: 'داكن بسيط' }, hint: { en: 'Minimal and focused', ar: 'بسيط ومريح للتركيز' }, swatch: 'linear-gradient(135deg,#090b11,#202330)' },
  { id: 'cats', label: { en: 'Velvet cats', ar: 'قطط مخملية' }, hint: { en: 'Warm feline-inspired tones', ar: 'درجات دافئة مستوحاة من القطط' }, swatch: 'linear-gradient(135deg,#30202b,#754c56,#e9aa80)' },
  { id: 'floral', label: { en: 'Rose garden', ar: 'حديقة الورد' }, hint: { en: 'Soft botanical accents', ar: 'لمسات نباتية ناعمة' }, swatch: 'linear-gradient(135deg,#251629,#75415b,#e5a5c4)' },
  { id: 'butterflies', label: { en: 'Butterfly dusk', ar: 'غسق الفراشات' }, hint: { en: 'Airy lilac and blue', ar: 'ليلكي وأزرق خفيفان' }, swatch: 'linear-gradient(135deg,#171729,#47406e,#aab8ff)' },
  { id: 'dark-vintage', label: { en: 'Dark vintage', ar: 'عتيق داكن' }, hint: { en: 'Warm ink and brass', ar: 'حبر دافئ ولمسات نحاسية' }, swatch: 'linear-gradient(135deg,#17120e,#3d3024,#b18a4b)' },
  { id: 'pastel-ai', label: { en: 'AI pastel studio', ar: 'استوديو باستيل AI' }, hint: { en: 'A palette made for your workspace', ar: 'لوحة ألوان مخصصة لمساحتك' }, swatch: 'linear-gradient(135deg,var(--pastel-background),var(--pastel-accent),var(--pastel-secondary))' },
]

const PERSONALITY_COPY: Record<string, { en: { label: string; hint: string }; ar: { label: string; hint: string } }> = {
  short: { en: { label: 'Concise', hint: 'Short, direct answers.' }, ar: { label: 'مختصر', hint: 'إجابات قصيرة ومباشرة.' } },
  educational: { en: { label: 'Educational', hint: 'Clear steps and brief examples.' }, ar: { label: 'تعليمي', hint: 'خطوات واضحة وأمثلة قصيرة.' } },
  detailed: { en: { label: 'Detailed', hint: 'More depth and useful context.' }, ar: { label: 'مفصّل', hint: 'تفاصيل أوسع وسياق مفيد.' } },
  creative: { en: { label: 'Creative', hint: 'Fresh ideas and helpful analogies.' }, ar: { label: 'إبداعي', hint: 'أفكار جديدة وتشبيهات مفيدة.' } },
}

const HI = 'var(--accent)'
const fmtSize = (value: number): string => value > 1_048_576 ? `${(value / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`
const text = (locale: Locale, english: string, arabic: string): string => tr(locale, english, arabic)

interface SwitchProps {
  on: boolean
  label: string
  onChange: (value: boolean) => void
}

function Switch({ on, label, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
      style={{ background: on ? HI : 'rgba(255,255,255,.15)' }}
    >
      <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ insetInlineStart: on ? '1.375rem' : '0.125rem' }} />
    </button>
  )
}

function TrashTab() {
  const locale = useLocale()
  const { entries, ready, error } = useTrash()
  const { restoreNode } = useTree()
  const { add } = useLibrary()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const chip = 'rounded-lg bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/20 active:scale-95 disabled:opacity-50'

  const restore = async (entry: TrashEntry): Promise<void> => {
    if (busy) return
    setBusy(entry.id)
    setMessage('')
    try {
      const result = restoreNode(entry.node, entry.parentId, entry.index)
      if (result === 'conflict') {
        setMessage(text(locale, 'This section could not be restored because an item with the same ID already exists.', 'تعذّرت الاستعادة لوجود عنصر بالمعرّف نفسه.'))
        return
      }
      entry.files.forEach(file => add({
        nodeId: file.nodeId,
        name: file.name,
        kind: file.kind,
        size: file.size,
        file: file.file,
        url: URL.createObjectURL(file.file),
      }))
      await removeFromTrash(entry.id)
      sfx.success()
      setMessage(result === 'root'
        ? text(locale, `“${entry.title}” was restored as a top-level section.`, `استُعيد «${entry.title}» كقسم رئيسي.`)
        : text(locale, `“${entry.title}” was restored.`, `استُعيد «${entry.title}».`))
    } finally {
      setBusy(null)
    }
  }

  const purge = async (entry: TrashEntry): Promise<void> => {
    if (busy || !window.confirm(text(locale, `Permanently delete “${entry.title}”? This cannot be undone.`, `حذف «${entry.title}» نهائياً؟ لا يمكن التراجع.`))) return
    setBusy(entry.id)
    await removeFromTrash(entry.id)
    sfx.close()
    setMessage('')
    setBusy(null)
  }

  const purgeAll = async (): Promise<void> => {
    if (busy || !window.confirm(text(locale, 'Empty the trash permanently? This cannot be undone.', 'إفراغ المحذوفات نهائياً؟ لا يمكن التراجع.'))) return
    setBusy('all')
    await emptyTrash()
    sfx.close()
    setMessage('')
    setBusy(null)
  }

  if (!ready) return <p className="py-6 text-center text-sm opacity-60">{text(locale, 'Loading items…', 'جارٍ تحميل العناصر…')}</p>
  if (error) return <p className="py-6 text-center text-sm text-rose-200">{text(locale, 'Trash is unavailable in this browser.', 'سلة المحذوفات غير متاحة في هذا المتصفح.')}</p>

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-5 opacity-70">
          {text(locale, `Items are kept for ${TRASH_RETENTION_DAYS} days. ${entries.length} item(s).`, `تُحفظ العناصر ${TRASH_RETENTION_DAYS} يوماً. العدد: ${entries.length}.`)}
        </p>
        <button type="button" className={chip} disabled={!entries.length || busy !== null} onClick={() => { void purgeAll() }}>
          {text(locale, 'Empty trash', 'إفراغ السلة')}
        </button>
      </div>
      {message && <p role="status" className="text-sm" style={{ color: HI }}>{message}</p>}
      {!entries.length ? (
        <div className="space-y-2 py-8 text-center">
          <Trash2 size={34} className="mx-auto opacity-35" />
          <p className="text-sm font-semibold">{text(locale, 'Nothing here', 'السلة فارغة')}</p>
          <p className="mx-auto max-w-sm text-xs leading-5 opacity-60">{text(locale, 'Deleted sections and their files will appear here.', 'تظهر هنا الأقسام والملفات التي تحذفها.')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map(entry => {
            const left = daysLeft(entry)
            const branches = collectNodeIds(entry.node).length
            const size = entry.files.reduce((total, file) => total + file.size, 0)
            return (
              <li key={entry.id} className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-semibold">{entry.title}</p>
                    <p className="text-[11px] opacity-60">
                      {text(locale, `${branches} section(s) · ${entry.files.length} file(s) · `, `${branches} فرع · ${entry.files.length} ملف · `)}{fmtSize(size)} · {new Date(entry.deletedAt).toLocaleDateString(locale)}
                    </p>
                    <p className="text-[11px] opacity-70">{text(locale, `Removal in ${left} day(s)`, `الحذف النهائي بعد ${left} يوم`)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className={`${chip} flex items-center gap-1 text-xs`} disabled={busy !== null} onClick={() => { void restore(entry) }} style={{ background: HI, color: '#111' }}>
                      <ArchiveRestore size={13} />{text(locale, 'Restore', 'استعادة')}
                    </button>
                    <button type="button" className={`${chip} flex items-center gap-1 text-xs`} disabled={busy !== null} onClick={() => { void purge(entry) }} aria-label={text(locale, `Delete ${entry.title} permanently`, `حذف ${entry.title} نهائياً`)}>
                      <Trash2 size={13} />{text(locale, 'Delete', 'حذف نهائي')}
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

interface Props {
  open: boolean
  onClose: () => void
  onRequestAuth: () => void
}

function parseThemePalette(answer: string): ThemePalette | null {
  try {
    const start = answer.indexOf('{')
    const end = answer.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed: unknown = JSON.parse(answer.slice(start, end + 1))
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Record<string, unknown>
    const colors = [record.background, record.surface, record.accent, record.secondary, record.text]
    return colors.every(color => typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)) ? colors as unknown as ThemePalette : null
  } catch {
    return null
  }
}

export default function SettingsModal({ open, onClose, onRequestAuth }: Props) {
  const locale = useLocale()
  const settings = useSettings()
  const trash = useTrash()
  const [tab, setTab] = useState<TabId>('look')
  const [themeBusy, setThemeBusy] = useState(false)
  const [themeMessage, setThemeMessage] = useState('')
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(null)
  const foreground = settings.accentMode === 'custom' ? readableOn(settings.customAccent) : '#111'
  const buttonStyle = (active: boolean): CSSProperties => active ? { background: HI, color: foreground } : {}
  const chip = 'rounded-lg bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/20 active:scale-95'
  const visibleCount = TOOL_CATALOG.filter(tool => !settings.hiddenTools.includes(tool.id)).length
  const text = (english: string, arabic: string): string => tr(locale, english, arabic)

  const close = useCallback((): void => {
    setTab('look')
    setLegalDocument(null)
    sfx.close()
    onClose()
  }, [onClose])
  const closeLegal = useCallback((): void => setLegalDocument(null), [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close, open])

  const generatePastelPalette = async (): Promise<void> => {
    if (themeBusy) return
    setThemeBusy(true)
    setThemeMessage('')
    try {
      const answer = await requestStudyAI({ action: 'theme', nodeTitle: 'Pastel theme', notes: '', language: locale })
      const palette = parseThemePalette(answer)
      if (!palette) throw new Error(text('The palette could not be applied. Please generate it again.', 'تعذّر تطبيق لوحة الألوان. حاول إنشاءها مرة أخرى.'))
      updateSettings({ theme: 'pastel-ai', pastelPalette: palette })
      setThemeMessage(text('A new palette is ready.', 'أصبحت لوحة الألوان الجديدة جاهزة.'))
      sfx.success()
    } catch {
      setThemeMessage(text('The palette could not be created right now. Please try again.', 'تعذّر إنشاء لوحة الألوان الآن. حاول مرة أخرى.'))
    } finally {
      setThemeBusy(false)
    }
  }

  return (
    <>
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-modal"
          className="fixed inset-0 z-[1500] flex items-start justify-end px-3 pt-[4.5rem] sm:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          onMouseDown={event => { if (event.target === event.currentTarget) close() }}
        >
          <div aria-hidden="true" className="absolute inset-0 bg-black/15 backdrop-blur-[1px]" />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-modal-title"
            className="glass-strong relative flex max-h-[min(78dvh,38rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/12 shadow-2xl shadow-black/35"
            initial={{ opacity: 0, y: -8, x: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, x: 8, scale: 0.99 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onMouseDown={event => event.stopPropagation()}
            onClick={event => event.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-45">{text('Workspace', 'مساحة العمل')}</p>
                <h2 id="settings-modal-title" className="mt-0.5 text-base font-semibold" style={{ color: HI }}>{text('Settings & support', 'الإعدادات والدعم')}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  className={`${chip} flex items-center gap-1.5 text-xs`}
                  onClick={() => { if (window.confirm(text('Restore default settings?', 'إعادة الإعدادات الافتراضية؟'))) { sfx.click(); resetSettings() } }}
                >
                  <RotateCcw size={13} />{text('Reset', 'إعادة الضبط')}
                </button>
                <button type="button" aria-label={text('Close settings', 'إغلاق الإعدادات')} title={text('Close', 'إغلاق')} onClick={close} className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2" style={{ outlineColor: HI }}>
                  <X size={18} />
                </button>
              </div>
            </header>

            <nav role="tablist" aria-label={text('Settings sections', 'أقسام الإعدادات')} className="flex gap-1 overflow-x-auto border-b border-white/10 px-2.5 py-2">
              {TABS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => { sfx.click(); setTab(id) }}
                  className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition hover:bg-white/10 active:scale-95"
                  style={buttonStyle(tab === id)}
                >
                  <Icon size={14} />{label[locale]}
                  {id === 'trash' && trash.entries.length > 0 && <span className="rounded-full bg-black/25 px-1.5 text-[10px] tabular-nums">{trash.entries.length}</span>}
                </button>
              ))}
            </nav>

            <div role="tabpanel" className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-4">
              {tab === 'look' && (
                <div className="space-y-5">
                  <section className="space-y-2.5">
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold">{text('Visual theme', 'السمة البصرية')}</h3>
                        <p className="mt-0.5 text-[11px] opacity-55">{text('Choose a quiet style for your workspace.', 'اختر أسلوباً هادئاً لمساحة عملك.')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {THEMES.map(theme => (
                        <button
                          key={theme.id}
                          type="button"
                          aria-pressed={settings.theme === theme.id}
                          onClick={() => { sfx.click(); updateSettings({ theme: theme.id }) }}
                          className="overflow-hidden rounded-xl border border-white/10 text-start transition hover:-translate-y-0.5 hover:bg-white/[0.08] active:scale-[0.98]"
                          style={settings.theme === theme.id ? { borderColor: HI, boxShadow: `0 0 0 1px ${HI}` } : undefined}
                        >
                          <span className="block h-10" style={{ background: theme.swatch }} />
                          <span className="block px-2.5 py-2">
                            <span className="block truncate text-xs font-semibold">{theme.label[locale]}</span>
                            <span className="mt-0.5 block truncate text-[10px] opacity-55">{theme.hint[locale]}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => { void generatePastelPalette() }}
                      disabled={themeBusy}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200/15 bg-violet-300/[0.08] px-3 py-2.5 text-xs font-medium transition hover:bg-violet-300/[0.14] disabled:opacity-50"
                    >
                      <Sparkles size={14} className={themeBusy ? 'animate-pulse' : ''} />
                      {themeBusy ? text('Creating a pastel palette…', 'جارٍ إنشاء لوحة باستيل…') : text('Create a fresh AI pastel palette', 'أنشئ لوحة باستيل جديدة بالذكاء الاصطناعي')}
                    </button>
                    {themeMessage && <p role="status" className="text-xs leading-5 opacity-75">{themeMessage}</p>}
                  </section>

                  <section className="space-y-3 border-t border-white/10 pt-4">
                    <h3 className="text-sm font-semibold">{text('Tool windows', 'نوافذ الأدوات')}</h3>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={chip} style={buttonStyle(settings.windowStyle === 'glass')} aria-pressed={settings.windowStyle === 'glass'} onClick={() => { sfx.click(); updateSettings({ windowStyle: 'glass' }) }}>{text('Soft glass', 'زجاج ناعم')}</button>
                      <button type="button" className={chip} style={buttonStyle(settings.windowStyle === 'solid')} aria-pressed={settings.windowStyle === 'solid'} onClick={() => { sfx.click(); updateSettings({ windowStyle: 'solid' }) }}>{text('Solid surface', 'سطح معتم')}</button>
                    </div>
                    {settings.windowStyle === 'glass' && (
                      <label className="flex items-center gap-3 text-xs">
                        <span className="shrink-0">{text('Glass opacity', 'شفافية الزجاج')}</span>
                        <input type="range" min={30} max={98} step={1} value={Math.round(settings.glassOpacity * 100)} onChange={event => updateSettings({ glassOpacity: Number(event.target.value) / 100 })} className="flex-1 accent-violet-300" />
                        <span className="w-10 text-end tabular-nums" dir="ltr">{Math.round(settings.glassOpacity * 100)}%</span>
                      </label>
                    )}
                  </section>

                  <section className="space-y-2 border-t border-white/10 pt-4">
                    <h3 className="text-sm font-semibold">{text('Accent color', 'لون التمييز')}</h3>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={chip} style={buttonStyle(settings.accentMode === 'auto')} aria-pressed={settings.accentMode === 'auto'} onClick={() => { sfx.click(); updateSettings({ accentMode: 'auto' }) }}>{text('Follow theme', 'يتبع السمة')}</button>
                      <button type="button" className={chip} style={buttonStyle(settings.accentMode === 'custom')} aria-pressed={settings.accentMode === 'custom'} onClick={() => { sfx.click(); updateSettings({ accentMode: 'custom' }) }}>{text('Custom', 'مخصص')}</button>
                    </div>
                    {settings.accentMode === 'custom' && (
                      <div className="flex flex-wrap items-center gap-2">
                        {ACCENT_PRESETS.map(color => (
                          <button
                            key={color}
                            type="button"
                            aria-label={text(`Accent ${color}`, `لون التمييز ${color}`)}
                            aria-pressed={settings.customAccent.toLowerCase() === color}
                            onClick={() => { sfx.click(); updateSettings({ customAccent: color }) }}
                            className="flex h-7 w-7 items-center justify-center rounded-full transition active:scale-90"
                            style={{ background: color, outline: settings.customAccent.toLowerCase() === color ? '2px solid #fff' : 'none', outlineOffset: 2 }}
                          >
                            {settings.customAccent.toLowerCase() === color && <Check size={13} color={readableOn(color)} />}
                          </button>
                        ))}
                        <label className="flex items-center gap-2 text-xs opacity-80">
                          {text('Choose a color', 'اختر لوناً')}
                          <input type="color" value={settings.customAccent} onChange={event => updateSettings({ customAccent: event.target.value })} aria-label={text('Choose custom accent', 'اختيار لون مخصص')} />
                        </label>
                      </div>
                    )}
                  </section>
                  {settings.theme === 'pastel-ai' && <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-5 opacity-65">{text('Pastel palette: ', 'لوحة الباستيل: ')}{settings.pastelPalette.join(' · ')}</p>}
                </div>
              )}

              {tab === 'tools' && (
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs opacity-70">{text(`${visibleCount} of ${TOOL_CATALOG.length} tools are visible`, `${visibleCount} من ${TOOL_CATALOG.length} أداة ظاهرة`)}</p>
                    <div className="flex gap-2">
                      <button type="button" className={chip} onClick={() => { sfx.click(); updateSettings({ hiddenTools: [] }) }}>{text('Show all', 'إظهار الكل')}</button>
                      <button type="button" className={chip} onClick={() => { sfx.click(); updateSettings({ hiddenTools: TOOL_CATALOG.map(tool => tool.id) }) }}>{text('Hide all', 'إخفاء الكل')}</button>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {TOOL_CATALOG.map(tool => {
                      const visible = !settings.hiddenTools.includes(tool.id)
                      return (
                        <li key={tool.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.025] px-3 py-2 text-sm">
                          <span className={visible ? '' : 'opacity-50'}>{tool.label}</span>
                          <Switch on={visible} label={text(`Show ${tool.label}`, `إظهار ${tool.label}`)} onChange={() => { sfx.click(); toggleToolVisibility(tool.id) }} />
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )}

              {tab === 'trash' && <TrashTab />}

              {tab === 'ai' && (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">{text('Response style', 'أسلوب الإجابة')}</h3>
                    <p className="mt-1 text-xs opacity-55">{text('Choose the tone that feels right for your study sessions.', 'اختر الأسلوب المناسب لجلسات دراستك.')}</p>
                  </div>
                  <div role="radiogroup" aria-label={text('AI response style', 'أسلوب إجابة الذكاء الاصطناعي')} className="grid gap-2 sm:grid-cols-2">
                    {AI_PERSONALITIES.map(personality => {
                      const copy = PERSONALITY_COPY[personality.id][locale]
                      return (
                        <button
                          key={personality.id}
                          type="button"
                          role="radio"
                          aria-checked={settings.aiPersonality === personality.id}
                          onClick={() => { sfx.click(); updateSettings({ aiPersonality: personality.id }) }}
                          className="space-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-start transition hover:bg-white/[0.08] active:scale-[0.99]"
                          style={settings.aiPersonality === personality.id ? { borderColor: HI, boxShadow: `0 0 0 1px ${HI}` } : undefined}
                        >
                          <p className="text-sm font-semibold" style={{ color: settings.aiPersonality === personality.id ? HI : undefined }}>{copy.label}</p>
                          <p className="text-[11px] opacity-60">{copy.hint}</p>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {tab === 'legal' && (
                <section dir={locale === 'ar' ? 'rtl' : 'ltr'} className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold">{text('Privacy and legal terms', 'الخصوصية والشروط القانونية')}</h3>
                    <p className="mt-1 text-xs leading-6 opacity-65">{text('Learn how vexale handles files, accounts, and AI features, and review the terms governing your use of the library.', 'راجع كيفية تعامل vexale مع الملفات والحسابات وميزات الذكاء الاصطناعي، والشروط المنظمة لاستخدام المكتبة.')}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <article className="space-y-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
                      <div className="flex items-center gap-2 text-violet-200"><ShieldCheck size={17} /><h4 className="text-sm font-semibold">{text('Privacy Policy', 'سياسة الخصوصية')}</h4></div>
                      <p className="text-xs leading-6 opacity-70">{text('Details about local and cloud data, file and AI processing, retention, and your choices.', 'تفاصيل البيانات المحلية والسحابية ومعالجة الملفات والذكاء الاصطناعي والاحتفاظ والخيارات المتاحة لك.')}</p>
                      <button type="button" className={`${chip} w-full`} onClick={() => setLegalDocument('privacy')}>{text('Read Privacy Policy', 'قراءة سياسة الخصوصية')}</button>
                    </article>
                    <article className="space-y-3 rounded-xl border border-white/10 bg-white/[0.035] p-4">
                      <div className="flex items-center gap-2 text-violet-200"><ShieldCheck size={17} /><h4 className="text-sm font-semibold">{text('Terms of Service', 'شروط الخدمة')}</h4></div>
                      <p className="text-xs leading-6 opacity-70">{text('Details about accounts, content, acceptable use, AI limits, and responsibilities.', 'تفاصيل الحسابات والمحتوى والاستخدام المقبول وحدود الذكاء الاصطناعي والمسؤوليات.')}</p>
                      <button type="button" className={`${chip} w-full`} onClick={() => setLegalDocument('terms')}>{text('Read Terms of Service', 'قراءة شروط الخدمة')}</button>
                    </article>
                  </div>
                  <p className="rounded-xl border border-amber-200/15 bg-amber-100/[0.04] p-3 text-xs leading-6 text-amber-100/80">{text('These documents identify vexale Development Team in Iraq and vexale.support@gmail.com as the responsible entity and contact.', 'تحدد الوثيقتان فريق تطوير vexale في العراق وبريد vexale.support@gmail.com بوصفهما الجهة المسؤولة ووسيلة التواصل.')}</p>
                </section>
              )}

              {tab === 'support' && (
                <div className="space-y-4">
                  <SupportHub onRequestAuth={onRequestAuth} />
                  <section className="space-y-2 border-t border-white/10 pt-4">
                    <h3 className="text-sm font-semibold">{text('Legal information', 'المعلومات القانونية')}</h3>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={chip} onClick={() => setLegalDocument('privacy')}>{text('Privacy Policy', 'سياسة الخصوصية')}</button>
                      <button type="button" className={chip} onClick={() => setLegalDocument('terms')}>{text('Terms of Service', 'شروط الخدمة')}</button>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    <LegalModal document={legalDocument} onSelect={setLegalDocument} onClose={closeLegal} />
    </>
  )
}
