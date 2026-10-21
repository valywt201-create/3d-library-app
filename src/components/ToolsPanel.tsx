import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  Activity, Bot, Brain, Calculator as CalcIcon, Database, Headphones, ListChecks,
  Network, ScanText, Sigma, StickyNote, Terminal,
} from 'lucide-react'
import { sfx } from '../shared'
import { useSettings } from '../lib/settings'
import { ACCENT } from './toolkit'
import FloatingWindow from './FloatingWindow'
import type { WinRect } from './FloatingWindow'
import QuickNotes from './QuickNotes'
import AIChat from './AIChat'

/* ============ الأدوات الثقيلة: تُحمَّل عند أول فتح فقط ============ */
const CalculatorTool = lazy(() => import('./Calculator'))
const CoordinateTool = lazy(() => import('./CoordinateSystem'))
const MathSolverTool = lazy(() => import('./AIMathSolver'))
const CodeTool = lazy(() => import('./CodePlayground'))
const QuizTool = lazy(() => import('./QuizGenerator'))
const DataTool = lazy(() => import('./DataAnalyzer'))
const WhiteboardTool = lazy(() => import('./Whiteboard'))
const DocumentTool = lazy(() => import('./DocumentTools'))
const TaskTool = lazy(() => import('./TaskRoadmap'))
const AudioTool = lazy(() => import('./AudioTools'))

// قائمة الأزرار: المعرّف والاسم والأيقونة والحجم الافتراضي للنافذة (المعرّفات مطابقة لكتالوج الإعدادات)
const TOOLS = [
  { id: 'calc', label: 'الحاسبة', Icon: CalcIcon, w: 380, h: 560 },
  { id: 'notes', label: 'ملاحظات', Icon: StickyNote, w: 360, h: 380 },
  { id: 'plot', label: 'الإحداثيات', Icon: Activity, w: 780, h: 640 },
  { id: 'chat', label: 'محادثة', Icon: Bot, w: 380, h: 480 },
  { id: 'math', label: 'حلّال الرياضيات', Icon: Sigma, w: 560, h: 560 },
  { id: 'code', label: 'الأكواد', Icon: Terminal, w: 700, h: 640 },
  { id: 'quiz', label: 'الأسئلة', Icon: Brain, w: 620, h: 600 },
  { id: 'data', label: 'البيانات', Icon: Database, w: 760, h: 640 },
  { id: 'board', label: 'اللوح', Icon: Network, w: 820, h: 600 },
  { id: 'docs', label: 'المستندات', Icon: ScanText, w: 620, h: 600 },
  { id: 'tasks', label: 'المهام', Icon: ListChecks, w: 560, h: 600 },
  { id: 'audio', label: 'التركيز', Icon: Headphones, w: 480, h: 560 },
]

// يعرض الأداة المطلوبة: كل حالة تكتب عنصر JSX صريحاً
function renderTool(id: string): ReactNode {
  switch (id) {
    case 'calc': return <CalculatorTool />
    case 'notes': return <QuickNotes />
    case 'plot': return <CoordinateTool />
    case 'chat': return <AIChat />
    case 'math': return <MathSolverTool />
    case 'code': return <CodeTool />
    case 'quiz': return <QuizTool />
    case 'data': return <DataTool />
    case 'board': return <WhiteboardTool />
    case 'docs': return <DocumentTool />
    case 'tasks': return <TaskTool />
    case 'audio': return <AudioTool />
    default: return null
  }
}

// يلتقط أخطاء التحميل (مثل حزمة غير مثبّتة) حتى لا ينهار التطبيق كله
class Boundary extends Component<{ children: ReactNode }, { err: string }> {
  state = { err: '' }
  static getDerivedStateFromError(e: Error) { return { err: e.message } }
  render() {
    if (this.state.err) {
      return (
        <p className="rounded-lg bg-red-500/10 p-4 text-sm text-red-200">
          تعذّر تحميل الأداة: {this.state.err}
          <br />
          تأكد من تنفيذ: npm install mathjs tesseract.js ثم أعد تشغيل الخادم.
        </p>
      )
    }
    return this.props.children
  }
}

/* ============ حالة النوافذ المفتوحة (لا علاقة لها بشجرة الأقسام) ============ */
interface Win {
  id: string
  z: number       // ترتيب الظهور: الأكبر في الأمام
  min: boolean    // هل النافذة مصغّرة
  rect: WinRect   // الموضع والحجم الأوليان
}

export default function ToolsPanel() {
  const { hiddenTools } = useSettings()
  const [wins, setWins] = useState<Win[]>([])
  const zRef = useRef(0)
  const slotRef = useRef(0)

  const visibleTools = TOOLS.filter(t => !hiddenTools.includes(t.id))

  const nextZ = (): number => {
    zRef.current += 1
    return zRef.current
  }

  // عند إخفاء أداة من الإعدادات تُغلق نافذتها المفتوحة فوراً
  useEffect(() => {
    setWins(ws => {
      const next = ws.filter(w => !hiddenTools.includes(w.id))
      return next.length === ws.length ? ws : next
    })
  }, [hiddenTools])

  // الفتح: نافذة جديدة بإزاحة متتالية، أو رفع/استعادة النافذة المفتوحة
  const openTool = (id: string): void => {
    const def = TOOLS.find(t => t.id === id)
    if (!def) return
    setWins(ws => {
      const existing = ws.find(w => w.id === id)
      if (existing) return ws.map(w => (w.id === id ? { ...w, z: nextZ(), min: false } : w))
      const off = (slotRef.current % 6) * 30
      slotRef.current += 1
      return [...ws, { id, z: nextZ(), min: false, rect: { x: 24 + off, y: 80 + off, w: def.w, h: def.h } }]
    })
  }

  const closeTool = (id: string): void => setWins(ws => ws.filter(w => w.id !== id))
  const setMin = (id: string, min: boolean): void => setWins(ws => ws.map(w => (w.id === id ? { ...w, min } : w)))
  const focusTool = (id: string): void =>
    setWins(ws => {
      const w = ws.find(x => x.id === id)
      if (!w || w.z === zRef.current) return ws // هي أصلاً في الأمام
      return ws.map(x => (x.id === id ? { ...x, z: nextZ() } : x))
    })

  // النقر على أيقونة: افتح/ارفع، وإن كانت الأداة ظاهرة وفي الأمام فأغلقها
  const onIconClick = (id: string): void => {
    const w = wins.find(x => x.id === id)
    const isTop = !!w && !w.min && w.z === zRef.current
    if (isTop) {
      sfx.close()
      closeTool(id)
    } else {
      sfx.open()
      openTool(id)
    }
  }

  // Esc يغلق أعلى نافذة ظاهرة (ويتجاهل الأمر إن كانت نافذة حوار كاملة مفتوحة مثل الإعدادات)
  useEffect(() => {
    if (!wins.length) return undefined
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || document.querySelector('[aria-modal="true"]')) return
      const visible = wins.filter(w => !w.min)
      if (!visible.length) return
      const top = visible.reduce((a, b) => (a.z > b.z ? a : b))
      sfx.close()
      closeTool(top.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wins])

  return (
    <>
      <div className="glass rounded-lg p-3">
        {visibleTools.length === 0 ? (
          <p className="py-2 text-center text-xs opacity-60">كل الأدوات مخفية. أظهرها من الإعدادات ← تخصيص الأدوات.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {visibleTools.map(({ id, label, Icon }) => {
              const w = wins.find(x => x.id === id)
              return (
                <button
                  key={id}
                  onClick={() => onIconClick(id)}
                  aria-pressed={!!w}
                  className="relative flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] transition hover:bg-white/10 active:scale-95"
                  style={w && !w.min ? { background: ACCENT, color: '#111' } : undefined}
                >
                  <Icon size={18} />
                  {label}
                  {w && w.min && <span className="absolute bottom-1 h-1 w-4 rounded-full" style={{ background: ACCENT }} aria-label="مصغّرة" />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* النوافذ العائمة: تظهر فوق مساحة العمل دون المساس بالشجرة */}
      <AnimatePresence>
        {wins.map(w => {
          const def = TOOLS.find(t => t.id === w.id)
          if (!def || hiddenTools.includes(w.id)) return null
          return (
            <FloatingWindow
              key={w.id}
              title={def.label}
              icon={<def.Icon size={15} />}
              initial={w.rect}
              minimized={w.min}
              onMinimizeChange={m => setMin(w.id, m)}
              onClose={() => closeTool(w.id)}
              onFocus={() => focusTool(w.id)}
              zIndex={30 + w.z}
            >
              <Boundary>
                <Suspense fallback={<p className="py-10 text-center text-sm opacity-60">جارٍ التحميل…</p>}>
                  {renderTool(w.id)}
                </Suspense>
              </Boundary>
            </FloatingWindow>
          )
        })}
      </AnimatePresence>
    </>
  )
}