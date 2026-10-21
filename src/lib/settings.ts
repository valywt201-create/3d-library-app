import { useSyncExternalStore } from 'react'

/* ============ الأنواع ============ */
export type ThemeId = 'space-live' | 'space-static' | 'solid'
export type WindowStyle = 'glass' | 'solid'
export type AccentMode = 'auto' | 'custom'
export type AiPersonality = 'short' | 'educational' | 'detailed' | 'creative'

export interface Settings {
  theme: ThemeId             // خلفية التطبيق
  windowStyle: WindowStyle   // نوافذ زجاجية شفافة أو سادّة
  glassOpacity: number       // كثافة الزجاج من 0.3 إلى 0.98 (تُستخدم في الوضع الزجاجي فقط)
  accentMode: AccentMode     // لون التوهّج: تلقائي (يتبع الفرع النشط) أو مخصّص
  customAccent: string       // اللون المخصّص بصيغة #rrggbb
  hiddenTools: string[]      // معرّفات الأدوات المخفية من شريط الأدوات
  aiPersonality: AiPersonality
}

/* ============ ثوابت ============ */
export const SETTINGS_KEY = 'atelier-settings-v1'
const LEGACY_APPEARANCE_KEY = 'atelier-appearance-v1' // مفتاح إعداد الخلفية القديم (نرحّله مرة واحدة)
export const TRASH_RETENTION_DAYS = 60

const THEME_IDS = ['space-live', 'space-static', 'solid'] as const
const WINDOW_STYLES = ['glass', 'solid'] as const
const ACCENT_MODES = ['auto', 'custom'] as const
const AI_IDS = ['short', 'educational', 'detailed', 'creative'] as const

// كتالوج الأدوات (نفس المعرّفات المستخدمة في ToolsPanel)
export const TOOL_CATALOG: readonly { id: string; label: string }[] = [
  { id: 'calc', label: 'الحاسبة' },
  { id: 'notes', label: 'ملاحظات سريعة' },
  { id: 'plot', label: 'الإحداثيات' },
  { id: 'chat', label: 'محادثة المكتبة' },
  { id: 'math', label: 'حلّال الرياضيات' },
  { id: 'code', label: 'الأكواد' },
  { id: 'quiz', label: 'الأسئلة والبطاقات' },
  { id: 'data', label: 'تحليل البيانات' },
  { id: 'board', label: 'اللوح والخرائط الذهنية' },
  { id: 'docs', label: 'أدوات المستندات' },
  { id: 'tasks', label: 'المهام' },
  { id: 'audio', label: 'التركيز والصوت' },
]

export const ACCENT_PRESETS: readonly string[] = [
  '#a78bfa', '#67e8f9', '#f9a8d4', '#fcd34d', '#86efac', '#fdba74', '#93c5fd', '#f87171',
]

export const AI_PERSONALITIES: readonly { id: AiPersonality; label: string; hint: string; instruction: string }[] = [
  { id: 'short', label: 'مختصر', hint: 'إجابات قصيرة ومباشرة بلا تفاصيل زائدة', instruction: 'أجب بإيجاز شديد ومباشرة في جملتين أو ثلاث.' },
  { id: 'educational', label: 'تعليمي', hint: 'شرح مبسّط بخطوات وأمثلة قصيرة', instruction: 'اشرح بأسلوب تعليمي مبسّط على خطوات مع مثال قصير عند الحاجة.' },
  { id: 'detailed', label: 'مفصّل', hint: 'تحليل شامل مع الأسباب والحالات الخاصة', instruction: 'قدّم إجابة مفصّلة وشاملة تتضمن الأسباب والتفاصيل والحالات الخاصة.' },
  { id: 'creative', label: 'إبداعي', hint: 'تشبيهات وأفكار وزوايا جديدة', instruction: 'أجب بأسلوب إبداعي يستخدم التشبيهات والأفكار الجديدة مع الحفاظ على الدقة.' },
]

// نص التعليمات الذي يُضاف لطلبات الذكاء الاصطناعي بحسب الشخصية المختارة
export function aiInstruction(p: AiPersonality): string {
  return AI_PERSONALITIES.find(x => x.id === p)?.instruction ?? ''
}

/* ============ القيم الافتراضية والتحقق ============ */
function defaults(): Settings {
  // من يفضّل تقليل الحركة في نظامه تبدأ خلفيته ثابتة
  const calm = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return {
    theme: calm ? 'space-static' : 'space-live',
    windowStyle: 'glass',
    glassOpacity: 0.82,
    accentMode: 'auto',
    customAccent: '#a78bfa',
    hiddenTools: [],
    aiPersonality: 'educational',
  }
}

const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

function pick<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

// يضمن أن أي قيمة قادمة من التخزين أو الواجهة صالحة، فلا تنهار الواجهة بسبب بيانات تالفة
function sanitize(raw: unknown, base: Settings): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const known = new Set(TOOL_CATALOG.map(t => t.id))
  const hidden = Array.isArray(r.hiddenTools)
    ? [...new Set(r.hiddenTools.filter((x): x is string => typeof x === 'string' && known.has(x)))]
    : base.hiddenTools
  const op = typeof r.glassOpacity === 'number' && Number.isFinite(r.glassOpacity)
    ? Math.min(0.98, Math.max(0.3, r.glassOpacity))
    : base.glassOpacity
  return {
    theme: pick(r.theme, THEME_IDS, base.theme),
    windowStyle: pick(r.windowStyle, WINDOW_STYLES, base.windowStyle),
    glassOpacity: op,
    accentMode: pick(r.accentMode, ACCENT_MODES, base.accentMode),
    customAccent: isHex(r.customAccent) ? r.customAccent : base.customAccent,
    hiddenTools: hidden,
    aiPersonality: pick(r.aiPersonality, AI_IDS, base.aiPersonality),
  }
}

function load(): Settings {
  const base = defaults()
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return sanitize(JSON.parse(raw), base)
    // ترحيل إعداد الخلفية القديم (حيّة أو ثابتة) مرة واحدة
    const legacy = localStorage.getItem(LEGACY_APPEARANCE_KEY)
    if (legacy) {
      const p = JSON.parse(legacy) as { bg?: unknown }
      if (p.bg === 'live') return { ...base, theme: 'space-live' }
      if (p.bg === 'static') return { ...base, theme: 'space-static' }
    }
  } catch { /* تجاهل: بيانات تالفة أو التخزين غير متاح */ }
  return base
}

function persist(s: Settings): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch { /* تجاهل: التخزين ممتلئ أو ممنوع */ }
}

/* ============ تطبيق الإعدادات على الصفحة (متغيرات CSS) ============ */
const STYLE_ID = 'atelier-settings-style'

function apply(s: Settings): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  // في الوضع السادّ نلغي تمويه الخلفية ونجعل لون الزجاج معتماً بالكامل، فلا يتداخل النص مع ما خلفه
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement('style')
    el.id = STYLE_ID
    el.textContent = 'html[data-win-style="solid"] .glass-strong{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}'
    document.head.appendChild(el)
  }
  root.dataset.winStyle = s.windowStyle
  root.dataset.theme = s.theme
  root.style.setProperty('--glass-bg-strong', s.windowStyle === 'solid' ? 'rgb(14, 16, 30)' : `rgba(12, 14, 26, ${s.glassOpacity})`)
}

/* ============ المتجر (يُقرأ من أي مكوّن عبر useSettings) ============ */
let state: Settings = load()
const listeners = new Set<() => void>()
const emit = (): void => { listeners.forEach(l => l()) }

apply(state)

// مزامنة عند تغيير الإعدادات من تبويب آخر
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== SETTINGS_KEY) return
    state = load()
    apply(state)
    emit()
  })
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

export function getSettings(): Settings { return state }

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings)
}

export function updateSettings(patch: Partial<Settings>): void {
  state = sanitize({ ...state, ...patch }, state)
  persist(state)
  apply(state)
  emit()
}

export function resetSettings(): void {
  state = defaults()
  persist(state)
  apply(state)
  emit()
}

export function toggleToolVisibility(id: string): void {
  const hidden = state.hiddenTools.includes(id)
    ? state.hiddenTools.filter(x => x !== id)
    : [...state.hiddenTools, id]
  updateSettings({ hiddenTools: hidden })
}

/* ============ دوال مساعدة للألوان ============ */
// يختار لون التوهّج الفعلي: المخصّص إن فُعّل، وإلا لون الفرع النشط
export function resolveAccent(s: Settings, auto: string): string {
  return s.accentMode === 'custom' ? s.customAccent : auto
}

// لون النص الأنسب (داكن أو أبيض) فوق خلفية بهذا اللون
export function readableOn(hex: string): '#111' | '#fff' {
  if (!isHex(hex)) return '#111'
  const n = parseInt(hex.slice(1), 16)
  const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)
  return lum > 150 ? '#111' : '#fff'
}