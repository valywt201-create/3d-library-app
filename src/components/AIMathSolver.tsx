import { useState } from 'react'
import { motion } from 'framer-motion'
import { compile, derivative, evaluate, format, parse, simplify } from 'mathjs'
import { ACCENT, btn, field, hasAI, panel } from './toolkit'
import { requestStudyAI } from '../lib/studyAssistant'

interface Step { t: string; mono?: boolean }
const fm = (x: number) => String(+x.toFixed(6))

/* ============ المنطق: محلّل تعبيرات + جدول الحقيقة ============ */
type F = (e: Record<string, boolean>) => boolean
const OPS: Record<string, string> = { and: 'AND', '&&': 'AND', '∧': 'AND', or: 'OR', '||': 'OR', '∨': 'OR', not: 'NOT', '!': 'NOT', '~': 'NOT', '¬': 'NOT', xor: 'XOR', '->': 'IMP', '=>': 'IMP', '→': 'IMP', '<->': 'IFF', '↔': 'IFF', true: 'TRUE', false: 'FALSE', '1': 'TRUE', '0': 'FALSE' }

function parseLogic(s: string) {
  const re = /\s*(<->|↔|->|=>|→|∧|∨|¬|&&|\|\||\(|\)|!|~|[A-Za-z_]\w*|[01])/y
  const toks: string[] = []
  while (re.lastIndex < s.length) {
    const m = re.exec(s)
    if (!m) { if (s.slice(re.lastIndex).trim() === '') break; throw new Error('رمز غير مفهوم') }
    toks.push(OPS[m[1].toLowerCase()] ?? m[1])
  }
  const vars = new Set<string>()
  let i = 0
  const prim = (): F => {
    const t = toks[i++]
    if (t === undefined) throw new Error('التعبير ناقص')
    if (t === 'NOT') { const f = prim(); return e => !f(e) }
    if (t === '(') { const f = iff(); if (toks[i++] !== ')') throw new Error('قوس غير مغلق'); return f }
    if (t === 'TRUE') return () => true
    if (t === 'FALSE') return () => false
    if (/^[A-Za-z_]\w*$/.test(t) && !['AND', 'OR', 'XOR', 'IMP', 'IFF'].includes(t)) { vars.add(t); return e => e[t] }
    throw new Error('رمز غير متوقع: ' + t)
  }
  const bin = (next: () => F, op: string, join: (a: boolean, b: boolean) => boolean): F => {
    let f = next()
    while (toks[i] === op) { i++; const a = f, g = next(); f = e => join(a(e), g(e)) }
    return f
  }
  const and = () => bin(prim, 'AND', (a, b) => a && b)
  const xor = () => bin(and, 'XOR', (a, b) => a !== b)
  const or = () => bin(xor, 'OR', (a, b) => a || b)
  const imp = (): F => { const f = or(); if (toks[i] === 'IMP') { i++; const g = imp(); return e => !f(e) || g(e) } return f }
  const iff = () => bin(imp, 'IFF', (a, b) => a === b)
  const f = iff()
  if (i < toks.length) throw new Error('تعبير غير مكتمل أو فيه رمز زائد')
  return { f, vars: [...vars].sort() }
}

function solveLogic(s: string): Step[] {
  const { f, vars } = parseLogic(s)
  if (vars.length > 6) return [{ t: 'عدد المتغيرات أكبر من 6، الجدول سيكون كبيراً جداً.' }]
  const rows: boolean[] = []
  const lines = [[...vars, 'النتيجة'].join('  ')]
  for (let m = 0; m < 2 ** vars.length; m++) {
    const env: Record<string, boolean> = {}
    vars.forEach((v, j) => { env[v] = !!((m >> (vars.length - 1 - j)) & 1) })
    const r = f(env)
    rows.push(r)
    lines.push([...vars.map(v => (env[v] ? '1' : '0').padEnd(v.length)), r ? '1' : '0'].join('  '))
  }
  const kind = rows.every(Boolean) ? 'تحصيل حاصل (Tautology): صحيح دائماً' : rows.every(r => !r) ? 'تناقض (Contradiction): خاطئ دائماً' : 'قابل للتحقق (Contingency): يصح في بعض الحالات ويخطئ في غيرها'
  return [
    { t: `المتغيرات: ${vars.join('، ') || 'لا يوجد'}. عدد الحالات الممكنة 2^${vars.length} = ${rows.length}.` },
    { t: 'نحسب قيمة التعبير في كل حالة (1 = صحيح، 0 = خاطئ):' },
    { t: lines.join('\n'), mono: true },
    { t: `الخلاصة: ${kind}.` },
  ]
}

/* ============ المعادلات والمشتقات والتعابير ============ */
function freeVars(expr: string): string[] {
  const names = new Set<string>()
  parse(expr).traverse((node, path, parent) => {
    if (node.type === 'SymbolNode' && !(parent?.type === 'FunctionNode' && path === 'fn') && 'name' in node && typeof node.name === 'string') {
      names.add(node.name)
    }
  })
  for (const constant of ['pi', 'e', 'i', 'Infinity', 'NaN', 'true', 'false']) names.delete(constant)
  return [...names]
}

const term = (c: number, s: string) => (c === 0 ? '' : ` ${c < 0 ? '-' : '+'} ${Math.abs(c) === 1 && s ? '' : fm(Math.abs(c))}${s}`)

function solveEquation(eq: string): Step[] {
  const parts = eq.split('=')
  if (parts.length !== 2) return [{ t: 'اكتب معادلة واحدة فيها علامة = واحدة.' }]
  const [l, r] = parts
  const vars = freeVars(`(${l}) + (${r})`)
  if (vars.length !== 1) return [{ t: `المعادلة فيها ${vars.length} متغيرات. المحلّل المحلي يحلّ معادلات بمتغير واحد، استخدم زر الذكاء الاصطناعي للحالات الأعقد.` }]
  const v = vars[0]
  const g = compile(`(${l}) - (${r})`)
  const f = (x: number) => Number(g.evaluate({ [v]: x }))
  const c = f(0), p = f(1), m = f(-1)
  const a = (p + m - 2 * c) / 2, b = (p - m) / 2
  const isPoly = [2, 3, -2].every(x => Math.abs(f(x) - (a * x * x + b * x + c)) < 1e-6 * (1 + Math.abs(f(x))))
  const steps: Step[] = [{ t: `المتغير المجهول: ${v}. ننقل كل الحدود إلى طرف واحد فتصبح المعادلة f(${v}) = 0.` }]

  if (isPoly) {
    const poly = (term(a, `${v}²`) + term(b, v) + term(c, '')).trim().replace(/^\+ /, '') || '0'
    steps.push({ t: `بعد الترتيب: ${poly} = 0` })
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) < 1e-12) return [...steps, { t: Math.abs(c) < 1e-12 ? 'المعادلة صحيحة لكل قيم المتغير (عدد لا نهائي من الحلول).' : 'لا يوجد حل، لأن المعادلة تؤول إلى تناقض.' }]
      return [...steps, { t: `معادلة من الدرجة الأولى: ${fm(b)}${v} = ${fm(-c)}` }, { t: `نقسم على ${fm(b)}: ${v} = ${fm(-c / b)}` }, { t: `الحل: ${v} = ${fm(-c / b)}` }]
    }
    const d = b * b - 4 * a * c
    steps.push({ t: `معادلة تربيعية: a = ${fm(a)}، b = ${fm(b)}، c = ${fm(c)}.` }, { t: `المميّز Δ = b² − 4ac = ${fm(d)}` })
    if (d > 0) {
      const s = Math.sqrt(d)
      steps.push({ t: `Δ > 0 فيوجد حلّان حقيقيان مختلفان: ${v} = (−b ± √Δ) / 2a` }, { t: `${v}₁ = ${fm((-b + s) / (2 * a))}\n${v}₂ = ${fm((-b - s) / (2 * a))}`, mono: true })
    } else if (Math.abs(d) < 1e-12) {
      steps.push({ t: `Δ = 0 فيوجد حل واحد مكرر: ${v} = −b / 2a = ${fm(-b / (2 * a))}` })
    } else {
      steps.push({ t: `Δ < 0 فلا يوجد حل حقيقي، والحلّان مركّبان:` }, { t: `${v} = ${fm(-b / (2 * a))} ± ${fm(Math.sqrt(-d) / (2 * a))}i`, mono: true })
    }
    return steps
  }

  // حل عددي: مسح المجال ثم التنصيف
  const roots: number[] = []
  for (let x = -100; x < 100 && roots.length < 8; x += 0.05) {
    const y0 = f(x), y1 = f(x + 0.05)
    if (isFinite(y0) && isFinite(y1) && y0 * y1 <= 0 && y0 !== y1) {
      let lo = x, hi = x + 0.05
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2
        if (f(lo) * f(mid) <= 0) hi = mid
        else lo = mid
      }
      const rt = (lo + hi) / 2
      if (!roots.some(q => Math.abs(q - rt) < 1e-4)) roots.push(rt)
    }
  }
  steps.push({ t: 'المعادلة ليست كثيرة حدود من الدرجة ≤ 2، فنبحث عن الجذور عددياً في المجال [−100, 100] (تقريبي):' })
  steps.push({ t: roots.length ? roots.map(q => `${v} ≈ ${fm(q)}`).join('\n') : 'لم أجد جذوراً في هذا المجال.', mono: true })
  return steps
}

function solveLocal(raw: string): Step[] {
  const s = raw.trim().replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  if (!s) return [{ t: 'اكتب معادلة أو تعبيراً أولاً.' }]
  if (/(\band\b|\bor\b|\bnot\b|\bxor\b|->|=>|<->|∧|∨|¬|→|↔|&&|\|\||!\s*[A-Za-z(])/i.test(s)) return solveLogic(s)
  const d = s.match(/^d\/d([a-z])\s+(.+)$/i)
  if (d) {
    const node = derivative(d[2], d[1])
    return [
      { t: `نشتق ${d[2]} بالنسبة إلى ${d[1]}، مستخدمين قواعد الاشتقاق (القوة، الجداء، السلسلة).` },
      { t: `المشتقة: ${node.toString()}`, mono: true },
      { t: `بعد التبسيط: ${simplify(node).toString()}`, mono: true },
    ]
  }
  if (/[<>≤≥]/.test(s)) return [{ t: 'المتباينات لا يحلّها المحلّل المحلي. ظلّلها في أداة «الإحداثيات»، أو استخدم زر الذكاء الاصطناعي.' }]
  if (s.includes('=')) return solveEquation(s)
  const vars = freeVars(s)
  if (!vars.length) return [{ t: `نحسب التعبير: ${s}` }, { t: `الناتج = ${format(evaluate(s), { precision: 14 })}`, mono: true }]
  return [{ t: `نبسّط التعبير: ${s}` }, { t: simplify(s).toString(), mono: true }]
}

const EXAMPLES = ['x^2 - 5x + 6 = 0', '2x + 3 = 11', 'd/dx x^3 * sin(x)', '(2 + 3)^2 / 5', 'p and (p -> q)', '(p or q) and not p']

export default function AIMathSolver() {
  const [input, setInput] = useState('x^2 - 5x + 6 = 0')
  const [steps, setSteps] = useState<Step[]>([])
  const [ai, setAi] = useState('')
  const [busy, setBusy] = useState(false)

  const solve = () => {
    setAi('')
    try { setSteps(solveLocal(input)) } catch (e) { setSteps([{ t: 'تعذّر الحل المحلي: ' + (e as Error).message }]) }
  }
  const explain = async () => {
    setBusy(true)
    try {
      setAi(await requestStudyAI({
        action: 'answer',
        nodeTitle: 'مسألة رياضية',
        notes: '',
        question: `حلّ المسألة التالية بالتفصيل خطوة بخطوة مع شرح كل خطوة باللغة العربية، ثم اذكر الجواب النهائي بوضوح:\n${input}`,
        language: 'ar',
      }))
    } catch { setAi('تعذّر الاتصال بمساعد الرياضيات. تحقّق من إعداد Supabase ونشر وظيفة notes-ai ثم أعد المحاولة.') } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <textarea
        value={input} onChange={e => setInput(e.target.value)} rows={3} dir="ltr"
        placeholder="x^2 - 5x + 6 = 0   |   d/dx x^3   |   p and (q -> p)"
        className={`${field} w-full font-mono`}
      />
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map(x => <button key={x} className="rounded-full bg-white/10 px-3 py-0.5 text-xs hover:bg-white/20" dir="ltr" onClick={() => setInput(x)}>{x}</button>)}
      </div>
      <div className="flex gap-2">
        <button className={btn} style={{ background: ACCENT, color: '#111' }} onClick={solve}>حل خطوة بخطوة</button>
        <button className={btn} disabled={busy || !input.trim()} onClick={explain} title={hasAI() ? '' : 'يتطلب إعداد Supabase وتسجيل الدخول'}>
          {busy ? 'جارٍ الشرح…' : 'شرح بالذكاء الاصطناعي'}
        </button>
      </div>
      {!hasAI() && <p className="text-xs opacity-60">يتطلب الشرح الذكي إعداد اتصال Supabase ونشر وظيفة notes-ai. يُحفظ مفتاح Gemini على الخادم فقط؛ ويظل الحل المحلي متاحاً بدونه.</p>}
      <div className="space-y-2">
        {steps.map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className={`${panel} p-3 text-sm`}>
            <span className="ml-2 font-semibold" style={{ color: ACCENT }}>{i + 1}.</span>
            {s.mono ? <pre className="mt-1 overflow-x-auto font-mono" dir="ltr">{s.t}</pre> : s.t}
          </motion.div>
        ))}
        {ai && <div className={`${panel} whitespace-pre-wrap p-3 text-sm`}>{ai}</div>}
      </div>
    </div>
  )
}
