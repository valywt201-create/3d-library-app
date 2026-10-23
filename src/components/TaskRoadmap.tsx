import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Plus, Trash2 } from 'lucide-react'
import { useTree } from '../shared'
import { ACCENT, btn, colorOf, field, flattenTree, panel, usePersisted } from './toolkit'

interface Task { id: string; title: string; project: string; due: string; done: boolean }

const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} /></div>
)
const days = (d: string) => Math.ceil((new Date(d + 'T23:59:59').getTime() - Date.now()) / 864e5)
const dueLabel = (d: string) => { const n = days(d); return n < 0 ? `متأخرة ${-n} يوم` : n === 0 ? 'اليوم' : n === 1 ? 'غداً' : `بعد ${n} يوم` }

export default function TaskRoadmap() {
  const { tree } = useTree()
  const flat = useMemo(() => flattenTree(tree), [tree])
  const [tasks, setTasks] = usePersisted<Task[]>('atelier-tasks-v1', [])
  const [title, setTitle] = useState('')
  const [project, setProject] = useState('')
  const [due, setDue] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all')

  const proj = (id: string) => flat.find(f => f.id === id) // فرع محذوف يُعامل كمهمة عامة
  const add = () => { const t = title.trim(); if (!t) return; setTasks(a => [{ id: crypto.randomUUID(), title: t, project: project, due, done: false }, ...a]); setTitle('') }
  const pct = (l: Task[]) => (l.length ? Math.round((l.filter(t => t.done).length / l.length) * 100) : 0)

  const groups = [...new Set(tasks.map(t => (proj(t.project) ? t.project : '')))]
  const upcoming = tasks.filter(t => !t.done && t.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 5)
  const shown = tasks.filter(t => (filter === 'all' ? true : filter === 'done' ? t.done : !t.done)).sort((a, b) => Number(a.done) - Number(b.done) || (a.due || '9').localeCompare(b.due || '9'))

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className={`${panel} space-y-2 p-3`}>
        <div className="flex justify-between text-sm"><span>التقدم الكلي</span><b style={{ color: ACCENT }}>{pct(tasks)}%</b></div>
        <Bar pct={pct(tasks)} color={ACCENT} />
        {groups.length > 0 && (
          <div className="grid gap-2 pt-2 sm:grid-cols-2">
            {groups.map(g => {
              const list = tasks.filter(t => (proj(t.project) ? t.project : '') === g)
              const p = proj(g)
              return (
                <div key={g || 'general'} className="space-y-1 text-xs">
                  <div className="flex justify-between"><span>{p?.label.replace(/^[— ]+/, '') ?? 'عام'}</span><span>{list.filter(t => t.done).length}/{list.length}</span></div>
                  <Bar pct={pct(list)} color={p ? colorOf(p.ci) : '#9aa1b2'} />
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="مهمة جديدة…" className={`${field} min-w-40 flex-1`} />
        <select value={project} onChange={e => setProject(e.target.value)} className={field} style={{ colorScheme: 'dark' }}>
          <option value="">عام</option>
          {flat.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <input type="date" value={due} onChange={e => setDue(e.target.value)} className={field} style={{ colorScheme: 'dark' }} />
        <button className={btn} onClick={add} style={{ background: ACCENT, color: '#111' }}><Plus size={14} className="ml-1 inline" />إضافة</button>
      </div>

      {upcoming.length > 0 && (
        <div className={`${panel} p-3`}>
          <p className="mb-2 text-sm font-semibold">خارطة الطريق: الأقرب موعداً</p>
          <ol className="space-y-1 border-r-2 pr-3 text-sm" style={{ borderColor: ACCENT + '88' }}>
            {upcoming.map(t => <li key={t.id} className="flex justify-between gap-2"><span>{t.title}</span><span className={days(t.due) < 0 ? 'text-red-300' : 'opacity-70'}>{dueLabel(t.due)}</span></li>)}
          </ol>
        </div>
      )}

      <div className="flex gap-2">
        {([['all', 'الكل'], ['active', 'غير المنجزة'], ['done', 'المنجزة']] as const).map(([k, l]) => (
          <button key={k} className={btn} onClick={() => setFilter(k)} style={filter === k ? { background: ACCENT, color: '#111' } : {}}>{l}</button>
        ))}
      </div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {shown.map(t => {
            const p = proj(t.project)
            return (
              <motion.li layout key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className={`${panel} flex items-center gap-3 p-3`}>
                <button aria-label="إنجاز" onClick={() => setTasks(a => a.map(x => (x.id === t.id ? { ...x, done: !x.done } : x)))} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition active:scale-90" style={{ borderColor: ACCENT, background: t.done ? ACCENT : 'transparent' }}>
                  {t.done && <Check size={14} color="#111" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm ${t.done ? 'line-through opacity-50' : ''}`}>{t.title}</p>
                  <p className="text-xs opacity-60">{p ? p.label.replace(/^[— ]+/, '') : 'عام'}{t.due && <span className={!t.done && days(t.due) < 0 ? ' text-red-300' : ''}> · {dueLabel(t.due)}</span>}</p>
                </div>
                <button aria-label="حذف" onClick={() => setTasks(a => a.filter(x => x.id !== t.id))} className="opacity-60 hover:opacity-100"><Trash2 size={14} /></button>
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
      {!shown.length && <p className="py-4 text-center text-sm opacity-60">لا توجد مهام هنا. أضف أول مهمة من الأعلى.</p>}
    </div>
  )
}