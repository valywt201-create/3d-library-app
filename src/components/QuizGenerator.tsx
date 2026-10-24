import { useState } from 'react'
import { motion } from 'framer-motion'
import { ACCENT, btn, field, hasAI, flattenTree, panel, subtreeIds } from './toolkit'
import { useLibrary, useTree } from '../shared'
import { requestStudyAI } from '../lib/studyAssistant'

interface Card { q: string; a: string; options?: string[] }
function isCard(value: unknown): value is Card {
  if (typeof value !== 'object' || value === null) return false
  const card = value as Record<string, unknown>
  return typeof card.q === 'string' && typeof card.a === 'string' && Array.isArray(card.options) && card.options.length === 4 && card.options.every(option => typeof option === 'string')
}

const STOP = new Set('this that with from have which their there where these those about would could should because between through after before other into than then them they were what when will your also been being more most some such only over very'.split(' '))
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5)

// مولّد محلي: يخفي أهم كلمة في كل جملة ويجعلها سؤال «أكمل الفراغ» مع مشتتات من النص نفسه
function makeCards(text: string, max: number): Card[] {
  const sents = text.split(/(?<=[.!?؟])\s+|\n+/).map(s => s.trim()).filter(s => { const n = s.split(/\s+/).length; return n >= 6 && n <= 40 })
  const kw = (s: string) => (s.match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter(w => !STOP.has(w.toLowerCase())).sort((a, b) => b.length - a.length)[0]
  const pool = [...new Set(sents.map(kw).filter((w): w is string => !!w))]
  return shuffle(sents).slice(0, max).flatMap(s => {
    const a = kw(s)
    if (!a) return []
    const q = s.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), '_____')
    const d = shuffle(pool.filter(p => p.toLowerCase() !== a.toLowerCase())).slice(0, 3)
    return [{ q, a, options: d.length === 3 ? shuffle([a, ...d]) : undefined }]
  })
}

export default function QuizGenerator() {
  const { items } = useLibrary()
  const { tree } = useTree()
  const [branch, setBranch] = useState('')
  const [text, setText] = useState('')
  const [count, setCount] = useState(8)
  const [useAi, setUseAi] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [mode, setMode] = useState<'cards' | 'quiz'>('cards')
  const [idx, setIdx] = useState(0)
  const [flip, setFlip] = useState(false)
  const [pick, setPick] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const loadFrom = async () => {
    const ids = branch ? subtreeIds(tree, branch) : null
    const files = items.filter(i => i.file && /\.(txt|md|csv|json)$/i.test(i.name) && (!ids || ids.includes(i.nodeId)))
    if (!files.length) return setMsg('لا توجد ملفات نصية (.txt .md .csv .json) في هذا النطاق. يمكنك لصق النص يدوياً، أو استخرجه من صورة عبر أداة المستندات.')
    setText((await Promise.all(files.map(i => i.file!.text()))).join('\n\n'))
    setMsg(`تم جلب ${files.length} ملف`)
  }

  const generate = async () => {
    setMsg(''); setBusy(true)
    try {
      let out: Card[] = []
      if (useAi && hasAI()) {
        const response = await requestStudyAI({ action: 'quiz', nodeTitle: 'اختبار مراجعة', notes: text.slice(0, 12_000), language: 'ar', questionCount: count })
        const start = response.indexOf('[')
        const end = response.lastIndexOf(']')
        if (start < 0 || end < start) throw new Error('لم تُرجع الخدمة مصفوفة أسئلة صالحة. حاول مرة أخرى.')
        const parsed: unknown = JSON.parse(response.slice(start, end + 1))
        if (!Array.isArray(parsed) || parsed.length < count || !parsed.every(isCard)) throw new Error('صيغة الأسئلة غير مكتملة. حاول مرة أخرى.')
        out = parsed.slice(0, count)
      } else out = makeCards(text, count)
      if (!out.length) setMsg('لم أتمكن من توليد أسئلة. تأكد أن النص يحتوي جملاً كاملة (6 كلمات فأكثر).')
      setCards(out); setIdx(0); setFlip(false); setPick(null); setScore(0)
    } catch (e) { setMsg('تعذّر التوليد: ' + (e as Error).message) } finally { setBusy(false) }
  }

  const quiz = cards.filter(c => c.options)
  const list = mode === 'quiz' ? quiz : cards
  const cur = list[idx]
  const go = (d: number) => { setIdx(i => Math.min(list.length - 1, Math.max(0, i + d))); setFlip(false); setPick(null) }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={branch} onChange={e => setBranch(e.target.value)} className={field} style={{ colorScheme: 'dark' }}>
          <option value="">كل الفروع</option>
          {flattenTree(tree).map(n => <option key={n.id} value={n.id}>{n.label}</option>)}
        </select>
        <button className={btn} onClick={loadFrom}>جلب نصوص الملفات</button>
      </div>
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="الصق ملاحظاتك هنا، أو اضغط «جلب نصوص الملفات»" className={`${field} w-full`} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label>عدد الأسئلة <input type="number" min={2} max={30} value={count} onChange={e => setCount(+e.target.value || 8)} className={`${field} w-16`} /></label>
        {hasAI() && <label className="flex items-center gap-1"><input type="checkbox" checked={useAi} onChange={e => setUseAi(e.target.checked)} />بالذكاء الاصطناعي</label>}
        <button className={btn} disabled={busy || text.trim().length < 40} onClick={generate} style={{ background: ACCENT, color: '#111' }}>{busy ? 'جارٍ التوليد…' : 'توليد'}</button>
      </div>
      {msg && <p className="text-sm opacity-80">{msg}</p>}

      {cards.length > 0 && (
        <>
          <div className="flex gap-2">
            <button className={btn} onClick={() => { setMode('cards'); setIdx(0); setFlip(false) }} style={mode === 'cards' ? { background: ACCENT, color: '#111' } : {}}>بطاقات</button>
            <button className={btn} onClick={() => { setMode('quiz'); setIdx(0); setPick(null); setScore(0) }} style={mode === 'quiz' ? { background: ACCENT, color: '#111' } : {}}>اختبار</button>
            <span className="mr-auto self-center text-sm opacity-70">{list.length ? `${idx + 1} / ${list.length}` : ''}{mode === 'quiz' && ` — النتيجة ${score}`}</span>
          </div>
          {!cur && <p className="text-sm opacity-70">لا توجد أسئلة بخيارات (النص قصير). استخدم وضع البطاقات.</p>}
          {cur && mode === 'cards' && (
            <motion.button
              key={idx} onClick={() => setFlip(f => !f)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, rotateX: flip ? 180 : 0 }}
              className={`${panel} flex min-h-40 w-full items-center justify-center p-5 text-center text-lg`}
            >
              <span style={{ transform: flip ? 'rotateX(180deg)' : 'none', color: flip ? ACCENT : undefined, display: 'block' }}>{flip ? cur.a : cur.q}</span>
            </motion.button>
          )}
          {cur && mode === 'quiz' && (
            <div className="space-y-2">
              <p className={`${panel} p-4 text-lg`}>{cur.q}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {cur.options!.map(o => {
                  const shown = pick !== null
                  const bg = !shown ? 'rgba(255,255,255,.1)' : o === cur.a ? '#34d39955' : o === pick ? '#f8717155' : 'rgba(255,255,255,.05)'
                  return (
                    <button key={o} disabled={shown} className="rounded-lg px-3 py-2 text-sm transition" style={{ background: bg }}
                      onClick={() => { setPick(o); if (o === cur.a) setScore(s => s + 1) }}>{o}</button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button className={btn} disabled={idx === 0} onClick={() => go(-1)}>السابق</button>
            <button className={btn} disabled={idx >= list.length - 1} onClick={() => go(1)}>التالي</button>
          </div>
        </>
      )}
    </div>
  )
}
