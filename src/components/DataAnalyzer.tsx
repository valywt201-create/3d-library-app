import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { FileUp } from 'lucide-react'
import { useLibrary } from '../shared'
import { ACCENT, btn, field, panel } from './toolkit'

type ChartType = 'bar' | 'line' | 'scatter' | 'pie'
const SERIES = ['#a78bfa', '#67e8f9', '#f9a8d4', '#fcd34d', '#86efac', '#fdba74']
const SAMPLE = 'الشهر,المبيعات,المصروفات\nيناير,120,80\nفبراير,150,90\nمارس,170,110\nأبريل,140,95\nمايو,200,130\nيونيو,230,150'
const toNum = (s?: string) => Number((s ?? '').replace(/,/g, '').trim())

// قارئ CSV يدعم الاقتباس والفاصلة والفاصلة المنقوطة والتاب
function parseCSV(t: string): string[][] {
  const first = t.split('\n')[0] ?? ''
  const d = first.includes('\t') ? '\t' : first.includes(';') && !first.includes(',') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], cur = '', q = false
  const endRow = () => { row.push(cur); cur = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = [] }
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === d) { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; endRow() }
    else cur += c
  }
  endRow()
  return rows
}

interface Ser { name: string; vals: number[] }

function Chart({ type, labels, series, xs }: { type: ChartType; labels: string[]; series: Ser[]; xs: number[] | null }) {
  const CW = 640, CH = 320, L = 52, R = 12, T = 12, B = 46
  const pw = CW - L - R, ph = CH - T - B
  const n = labels.length
  if (!n || !series.length) return <p className="py-10 text-center text-sm opacity-60">اختر عموداً رقمياً واحداً على الأقل للرسم</p>

  if (type === 'pie') {
    const s = series[0]
    const total = s.vals.reduce((a, v) => a + Math.max(0, v), 0) || 1
    const cx = 160, cy = CH / 2, r = 120
    const slices = s.vals.map((value, index) => {
      const previous = s.vals.slice(0, index).reduce((sum, item) => sum + Math.max(0, item), 0)
      const start = -Math.PI / 2 + (previous / total) * Math.PI * 2
      const end = start + (Math.max(0, value) / total) * Math.PI * 2
      return { value, index, start, end }
    })
    return (
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full">
        {slices.map(({ value, index, start, end }) => {
          const big = end - start > Math.PI ? 1 : 0
          const d = `M${cx} ${cy} L${cx + r * Math.cos(start)} ${cy + r * Math.sin(start)} A${r} ${r} 0 ${big} 1 ${cx + r * Math.cos(end)} ${cy + r * Math.sin(end)}Z`
          return <motion.path key={index} d={d} fill={SERIES[index % SERIES.length]} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.05 }}><title>{`${labels[index]}: ${value} (${((Math.max(0, value) / total) * 100).toFixed(1)}%)`}</title></motion.path>
        })}
        {labels.slice(0, 12).map((l, i) => (
          <g key={i} transform={`translate(330 ${24 + i * 22})`}>
            <rect width={12} height={12} rx={3} fill={SERIES[i % SERIES.length]} />
            <text x={18} y={11} fontSize={12} fill="#cbd0dc">{l.slice(0, 22)}</text>
          </g>
        ))}
      </svg>
    )
  }

  const all = series.flatMap(s => s.vals).filter(isFinite)
  const lo = Math.min(0, ...all), hi = Math.max(...all, 1)
  const Y = (v: number) => T + ph * (1 - (v - lo) / (hi - lo || 1))
  const xmin = xs ? Math.min(...xs) : 0, xmax = xs ? Math.max(...xs) : n - 1
  const X = (i: number) => (type === 'scatter' && xs ? L + pw * ((xs[i] - xmin) / (xmax - xmin || 1)) : L + (pw / n) * (i + 0.5))
  const bw = (pw / n) * 0.8 / series.length

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full">
      {[0, 1, 2, 3, 4].map(i => {
        const v = lo + ((hi - lo) * i) / 4
        return <g key={i}><line x1={L} x2={CW - R} y1={Y(v)} y2={Y(v)} stroke="rgba(255,255,255,.08)" /><text x={L - 6} y={Y(v) + 4} fontSize={10} fill="#9aa1b2" textAnchor="end">{+v.toPrecision(3)}</text></g>
      })}
      {labels.map((l, i) => (i % Math.ceil(n / 12) === 0 ? <text key={i} x={X(i)} y={CH - B + 16} fontSize={10} fill="#9aa1b2" textAnchor="middle">{l.slice(0, 10)}</text> : null))}
      {series.map((s, si) => {
        const col = SERIES[si % SERIES.length]
        if (type === 'bar') return s.vals.map((v, i) => (
          <motion.rect key={`${si}-${i}`} x={L + (pw / n) * i + (pw / n) * 0.1 + bw * si} y={Math.min(Y(v), Y(0))} width={bw} height={Math.abs(Y(v) - Y(0))} rx={2} fill={col}
            style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.02 }}><title>{`${labels[i]} — ${s.name}: ${v}`}</title></motion.rect>
        ))
        return (
          <g key={si}>
            {type === 'line' && <path d={s.vals.map((v, i) => `${i ? 'L' : 'M'}${X(i)} ${Y(v)}`).join('')} fill="none" stroke={col} strokeWidth={2.2} />}
            {s.vals.map((v, i) => <circle key={i} cx={X(i)} cy={Y(v)} r={type === 'scatter' ? 4 : 3.2} fill={col}><title>{`${labels[i]} — ${s.name}: ${v}`}</title></circle>)}
          </g>
        )
      })}
    </svg>
  )
}

export default function DataAnalyzer() {
  const { items } = useLibrary()
  const [text, setText] = useState(SAMPLE)
  const [type, setType] = useState<ChartType>('bar')
  const [xi, setXi] = useState(0)
  const [ys, setYs] = useState<number[]>([1, 2])

  const rows = useMemo(() => parseCSV(text), [text])
  const head = rows[0] ?? []
  const body = rows.slice(1, 61) // حتى 60 صفاً حتى يبقى الرسم مقروءاً
  const numeric = head.map((_, c) => { const v = body.map(r => r[c]).filter(x => (x ?? '').trim() !== ''); return v.length > 0 && v.every(x => !isNaN(toNum(x))) })

  const load = (t: string) => {
    setText(t)
    const r = parseCSV(t), h = r[0] ?? [], b = r.slice(1, 61)
    const num = h.map((_, c) => { const v = b.map(x => x[c]).filter(x => (x ?? '').trim() !== ''); return v.length > 0 && v.every(x => !isNaN(toNum(x))) })
    const x = Math.max(0, num.findIndex(n => !n))
    setXi(x)
    setYs(h.map((_, i) => i).filter(i => num[i] && i !== x).slice(0, 3))
  }

  const labels = body.map(r => r[xi] ?? '')
  const series: Ser[] = ys.filter(c => numeric[c]).map(c => ({ name: head[c] ?? '', vals: body.map(r => toNum(r[c])) }))
  const xs = numeric[xi] ? body.map(r => toNum(r[xi])) : null
  const stat = (v: number[]) => { const f = v.filter(isFinite); const s = f.reduce((a, b) => a + b, 0); return { n: f.length, min: Math.min(...f), max: Math.max(...f), sum: s, avg: s / (f.length || 1) } }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${btn} cursor-pointer`}><FileUp size={14} className="ml-1 inline" />استيراد CSV<input type="file" accept=".csv,.tsv,.txt" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) load(await f.text()); e.target.value = '' }} /></label>
        <select className={field} style={{ colorScheme: 'dark' }} defaultValue="" onChange={async e => { const f = items.find(i => i.id === e.target.value)?.file; if (f) load(await f.text()) }}>
          <option value="">من ملفات المكتبة…</option>
          {items.filter(i => i.file && /\.(csv|tsv|txt)$/i.test(i.name)).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <textarea value={text} onChange={e => load(e.target.value)} rows={4} dir="ltr" className={`${field} w-full font-mono text-xs`} />

      {head.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {(['bar', 'line', 'scatter', 'pie'] as ChartType[]).map(t => (
              <button key={t} className={btn} onClick={() => setType(t)} style={type === t ? { background: ACCENT, color: '#111' } : {}}>{{ bar: 'أعمدة', line: 'خطي', scatter: 'نقطي', pie: 'دائري' }[t]}</button>
            ))}
            <label>المحور X <select value={xi} onChange={e => setXi(+e.target.value)} className={field} style={{ colorScheme: 'dark' }}>{head.map((h, i) => <option key={i} value={i}>{h}</option>)}</select></label>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            {head.map((h, i) => numeric[i] && (
              <label key={i} className="flex items-center gap-1"><input type="checkbox" checked={ys.includes(i)} onChange={e => setYs(a => (e.target.checked ? [...a, i] : a.filter(x => x !== i)))} />{h}</label>
            ))}
          </div>
          <div className={`${panel} p-3`}><Chart type={type} labels={labels} series={series} xs={xs} /></div>
          <div className={`${panel} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead><tr className="opacity-60"><th className="p-2 text-right">العمود</th><th>العدد</th><th>الأدنى</th><th>الأعلى</th><th>المتوسط</th><th>المجموع</th></tr></thead>
              <tbody>{series.map(s => { const st = stat(s.vals); return <tr key={s.name} className="border-t border-white/10 text-center"><td className="p-2 text-right">{s.name}</td><td>{st.n}</td><td>{+st.min.toFixed(3)}</td><td>{+st.max.toFixed(3)}</td><td>{+st.avg.toFixed(3)}</td><td>{+st.sum.toFixed(3)}</td></tr> })}</tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
