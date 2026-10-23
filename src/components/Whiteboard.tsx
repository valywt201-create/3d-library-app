import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { Hand, Link2, Pencil, StickyNote, Trash2 } from 'lucide-react'
import { ACCENT, btn, usePersisted } from './toolkit'

type Tool = 'move' | 'pen' | 'note' | 'link'
interface Note { id: string; x: number; y: number; text: string; color: string }
interface Board { notes: Note[]; links: [string, string][]; strokes: { id: string; d: string; c: string }[] }
type Act = { t: 'pan'; x: number; y: number } | { t: 'pen'; id: string } | { t: 'note'; id: string; dx: number; dy: number } | null
const NW = 170, NH = 110
const COLORS = ['#a78bfa', '#67e8f9', '#f9a8d4', '#fcd34d', '#86efac']

export default function Whiteboard() {
  const [board, setBoard] = usePersisted<Board>('atelier-board-v1', { notes: [], links: [], strokes: [] })
  const [tool, setTool] = useState<Tool>('move')
  const [view, setView] = useState({ x: 0, y: 0, k: 1 })
  const [sel, setSel] = useState<string | null>(null)
  const [from, setFrom] = useState<string | null>(null)
  const [color, setColor] = useState(COLORS[0])
  const svg = useRef<SVGSVGElement>(null)
  const act = useRef<Act>(null)

  // اللوح لا نهائي: تحريك بالسحب، وتكبير بالعجلة حول المؤشر
  useEffect(() => {
    const el = svg.current!
    const h = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top
      setView(v => { const k = Math.min(3, Math.max(0.25, v.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); const f = k / v.k; return { k, x: mx - (mx - v.x) * f, y: my - (my - v.y) * f } })
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [])

  const world = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = svg.current!.getBoundingClientRect()
    return [(e.clientX - r.left - view.x) / view.k, (e.clientY - r.top - view.y) / view.k]
  }

  const down = (e: RPointerEvent) => {
    svg.current!.setPointerCapture(e.pointerId)
    const [x, y] = world(e)
    if (tool === 'pen') {
      const id = crypto.randomUUID()
      setBoard(b => ({ ...b, strokes: [...b.strokes, { id, d: `M${x} ${y}`, c: color }] }))
      act.current = { t: 'pen', id }
    } else if (tool === 'note') {
      const id = crypto.randomUUID()
      setBoard(b => ({ ...b, notes: [...b.notes, { id, x: x - NW / 2, y: y - NH / 2, text: '', color }] }))
      setSel(id)
    } else { act.current = { t: 'pan', x: e.clientX, y: e.clientY }; setSel(null); setFrom(null) }
  }
  const move = (e: RPointerEvent) => {
    const a = act.current
    if (!a) return
    if (a.t === 'pan') { const dx = e.clientX - a.x, dy = e.clientY - a.y; act.current = { t: 'pan', x: e.clientX, y: e.clientY }; setView(v => ({ ...v, x: v.x + dx, y: v.y + dy })) }
    else if (a.t === 'pen') { const [x, y] = world(e); setBoard(b => ({ ...b, strokes: b.strokes.map(s => (s.id === a.id ? { ...s, d: `${s.d} L${x} ${y}` } : s)) })) }
    else { const [x, y] = world(e); setBoard(b => ({ ...b, notes: b.notes.map(n => (n.id === a.id ? { ...n, x: x - a.dx, y: y - a.dy } : n)) })) }
  }
  const noteDown = (e: RPointerEvent, n: Note) => {
    e.stopPropagation()
    setSel(n.id)
    if (tool === 'link') {
      if (!from) setFrom(n.id)
      else if (from !== n.id) { setBoard(b => (b.links.some(([p, q]) => (p === from && q === n.id) || (p === n.id && q === from)) ? b : { ...b, links: [...b.links, [from, n.id]] })); setFrom(null) }
      return
    }
    svg.current!.setPointerCapture(e.pointerId)
    const [x, y] = world(e)
    act.current = { t: 'note', id: n.id, dx: x - n.x, dy: y - n.y }
  }
   const del = () => {
    if (!sel) return
    setBoard(b => ({ ...b, notes: b.notes.filter(n => n.id !== sel), links: b.links.filter(([from, to]) => from !== sel && to !== sel) }))
    setSel(null)
}

  const byId = (id: string) => board.notes.find(n => n.id === id)
  const tb = (t: Tool) => ({ ...(tool === t ? { background: ACCENT, color: '#111' } : {}) })

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} style={tb('move')} onClick={() => setTool('move')}><Hand size={14} className="ml-1 inline" />تحريك</button>
        <button className={btn} style={tb('pen')} onClick={() => setTool('pen')}><Pencil size={14} className="ml-1 inline" />رسم</button>
        <button className={btn} style={tb('note')} onClick={() => setTool('note')}><StickyNote size={14} className="ml-1 inline" />بطاقة</button>
        <button className={btn} style={tb('link')} onClick={() => { setTool('link'); setFrom(null) }}><Link2 size={14} className="ml-1 inline" />ربط</button>
        {COLORS.map(c => <button key={c} aria-label="لون" onClick={() => setColor(c)} className="h-6 w-6 rounded-full transition active:scale-90" style={{ background: c, outline: color === c ? '2px solid #fff' : 'none' }} />)}
        <button className={`${btn} mr-auto`} disabled={!sel} onClick={del}><Trash2 size={14} className="ml-1 inline" />حذف المحدد</button>
        <button className={btn} onClick={() => setBoard(b => ({ ...b, strokes: [] }))}>مسح الرسم</button>
        <button className={btn} onClick={() => setView({ x: 0, y: 0, k: 1 })}>إعادة الضبط</button>
      </div>
      <p className="text-xs opacity-60">{tool === 'link' ? (from ? 'اختر البطاقة الثانية' : 'اختر البطاقة الأولى (انقر على شريطها العلوي). انقر على خط موجود لحذفه') : tool === 'note' ? 'انقر على اللوح لإضافة بطاقة' : tool === 'pen' ? 'ارسم بحرية' : 'اسحب اللوح للتحريك، وبالعجلة للتكبير'}</p>

      <svg
        ref={svg} onPointerDown={down} onPointerMove={move} onPointerUp={() => { act.current = null }}
        className="h-[65vh] w-full touch-none rounded-xl border border-white/10 bg-[#0f1219]" style={{ cursor: tool === 'move' ? 'grab' : 'crosshair' }}
      >
        <defs>
          <pattern id="wb-dots" width={24} height={24} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            <circle cx={1} cy={1} r={1} fill="rgba(255,255,255,.14)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wb-dots)" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {board.strokes.map(s => <path key={s.id} d={s.d} fill="none" stroke={s.c} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />)}
          {board.links.map(([p, q]) => {
            const a = byId(p), b = byId(q)
            if (!a || !b) return null
            const ax = a.x + NW / 2, ay = a.y + NH / 2, bx = b.x + NW / 2, by = b.y + NH / 2, mx = (ax + bx) / 2
            const d = `M${ax} ${ay} C${mx} ${ay} ${mx} ${by} ${bx} ${by}`
            return (
              <g key={p + q}>
                <path d={d} fill="none" stroke={ACCENT} strokeWidth={2} opacity={0.75} />
                <path d={d} fill="none" stroke="transparent" strokeWidth={14} style={{ cursor: tool === 'link' ? 'pointer' : 'inherit' }}
                  onPointerDown={e => { if (tool === 'link') { e.stopPropagation(); setBoard(bd => ({ ...bd, links: bd.links.filter(([x, y]) => !(x === p && y === q)) })) } }} />
              </g>
            )
          })}
          {board.notes.map(n => (
            <foreignObject key={n.id} x={n.x} y={n.y} width={NW} height={NH}>
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'rgba(20,23,31,.92)', border: `1px solid ${n.color}`, borderRadius: 10, boxShadow: sel === n.id || from === n.id ? `0 0 0 2px ${n.color}` : 'none' }}>
                <div onPointerDown={e => noteDown(e, n)} style={{ height: 18, background: n.color + '55', borderRadius: '9px 9px 0 0', cursor: tool === 'link' ? 'pointer' : 'grab' }} />
                <textarea
                  value={n.text} placeholder="اكتب فكرتك…"
                  onPointerDown={e => { e.stopPropagation(); setSel(n.id) }}
                  onChange={e => setBoard(b => ({ ...b, notes: b.notes.map(x => (x.id === n.id ? { ...x, text: e.target.value } : x)) }))}
                  style={{ flex: 1, background: 'transparent', color: '#eef0f4', border: 0, outline: 0, resize: 'none', padding: 6, fontSize: 13 }}
                />
              </div>
            </foreignObject>
          ))}
        </g>
      </svg>
    </div>
  )
}