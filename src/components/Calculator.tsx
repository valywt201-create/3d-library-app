import { useState } from 'react'
import { evaluate, format } from 'mathjs'
import { ACCENT, btn, copy, field, panel } from './toolkit'

/* ============ الحاسبة العلمية ============ */
const D = Math.PI / 180
// في وضع الدرجات نستبدل الدوال المثلثية بنسخ تعمل بالدرجات
const degScope = {
  sin: (x: number) => Math.sin(x * D), cos: (x: number) => Math.cos(x * D), tan: (x: number) => Math.tan(x * D),
  asin: (x: number) => Math.asin(x) / D, acos: (x: number) => Math.acos(x) / D, atan: (x: number) => Math.atan(x) / D,
}
const KEYS: [string, string][] = [
  ['sin', 'sin('], ['cos', 'cos('], ['tan', 'tan('], ['(', '('], [')', ')'],
  ['asin', 'asin('], ['acos', 'acos('], ['atan', 'atan('], ['π', 'pi'], ['e', 'e'],
  ['log', 'log10('], ['ln', 'log('], ['√', 'sqrt('], ['xʸ', '^'], ['n!', '!'],
  ['7', '7'], ['8', '8'], ['9', '9'], ['÷', '/'], ['abs', 'abs('],
  ['4', '4'], ['5', '5'], ['6', '6'], ['×', '*'], ['mod', ' mod '],
  ['1', '1'], ['2', '2'], ['3', '3'], ['−', '-'], ['x²', '^2'],
  ['0', '0'], ['.', '.'], ['ans', 'ans'], ['+', '+'], ['10ˣ', '10^('],
]

function Scientific() {
  const [expr, setExpr] = useState('')
  const [res, setRes] = useState('')
  const [deg, setDeg] = useState(true)
  const [ans, setAns] = useState(0)
  const [hist, setHist] = useState<{ e: string; r: string }[]>([])

  const run = () => {
    if (!expr.trim()) return
    try {
      const v = evaluate(expr, { ...(deg ? degScope : {}), ans })
      const s = format(v, { precision: 12 })
      setRes(s)
      if (typeof v === 'number') setAns(v)
      setHist(h => [{ e: expr, r: s }, ...h].slice(0, 20))
    } catch {
      setRes('خطأ في التعبير')
    }
  }

  return (
    <div className="space-y-3">
      <div className={`${panel} p-3`} dir="ltr">
        <input
          value={expr}
          onChange={e => setExpr(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()}
          placeholder="sin(30) + 2^3 / sqrt(16)"
          className={`${field} w-full text-lg`}
        />
        <button onClick={() => copy(res)} className="mt-2 block min-h-8 w-full text-right text-2xl font-semibold" style={{ color: ACCENT }} title="انقر للنسخ">
          {res || '0'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={run} style={{ background: ACCENT, color: '#111' }}>=</button>
        <button className={btn} onClick={() => { setExpr(''); setRes('') }}>مسح</button>
        <button className={btn} onClick={() => setExpr(e => e.slice(0, -1))}>⌫</button>
        <button className={btn} onClick={() => setDeg(d => !d)}>{deg ? 'درجات DEG' : 'راديان RAD'}</button>
      </div>
      <div className="grid grid-cols-5 gap-2" dir="ltr">
        {KEYS.map(([l, ins]) => (
          <button key={l} className={`${btn} py-2.5`} onClick={() => setExpr(e => e + ins)}>{l}</button>
        ))}
      </div>
      {hist.length > 0 && (
        <ul className={`${panel} max-h-40 space-y-1 overflow-y-auto p-2 text-sm`} dir="ltr">
          {hist.map((h, i) => (
            <li key={i}>
              <button className="w-full text-left opacity-80 hover:opacity-100" onClick={() => setExpr(h.e)}>
                {h.e} = <b style={{ color: ACCENT }}>{h.r}</b>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/* ============ حاسبة المبرمجين (أعداد صحيحة 64 بت) ============ */
const BASES = [{ n: 16, l: 'HEX' }, { n: 10, l: 'DEC' }, { n: 8, l: 'OCT' }, { n: 2, l: 'BIN' }]

function parseBig(s: string, base: number): bigint | null {
  const t = s.trim().toLowerCase()
  const neg = t.startsWith('-')
  const body = neg ? t.slice(1) : t
  if (!body) return null
  let v = 0n
  for (const ch of body) {
    const d = '0123456789abcdef'.indexOf(ch)
    if (d < 0 || d >= base) return null
    v = v * BigInt(base) + BigInt(d)
  }
  return neg ? -v : v
}
// القيم السالبة تظهر بمتمّم الاثنين (64 بت) في غير النظام العشري
const show = (v: bigint, b: number) => (v < 0n && b !== 10 ? BigInt.asUintN(64, v) : v).toString(b).toUpperCase()

const OPS: [string, (a: bigint, b: bigint) => bigint | null][] = [
  ['+', (a, b) => a + b], ['−', (a, b) => a - b], ['×', (a, b) => a * b],
  ['÷', (a, b) => (b === 0n ? null : a / b)], ['%', (a, b) => (b === 0n ? null : a % b)],
  ['AND', (a, b) => a & b], ['OR', (a, b) => a | b], ['XOR', (a, b) => a ^ b],
  ['<<', (a, b) => (b < 0n || b > 63n ? null : a << b)], ['>>', (a, b) => (b < 0n || b > 63n ? null : a >> b)],
]

function Programmer() {
  const [base, setBase] = useState(10)
  const [a, setA] = useState('255')
  const [b, setB] = useState('15')
  const [res, setRes] = useState<bigint | null>(null)
  const [err, setErr] = useState('')
  const A = parseBig(a, base)
  const B = parseBig(b, base)

  const apply = (fn: (x: bigint, y: bigint) => bigint | null) => {
    if (A === null || B === null) return setErr('أدخل قيمتين صحيحتين بالنظام المختار')
    const r = fn(A, B)
    if (r === null) return setErr('عملية غير مسموحة (قسمة على صفر أو إزاحة خارج 0–63)')
    setErr('')
    setRes(BigInt.asIntN(64, r))
  }
  const table = (v: bigint | null) => (
    <div className="grid grid-cols-2 gap-2 text-sm" dir="ltr">
      {BASES.map(x => (
        <button key={x.n} className={`${panel} px-3 py-2 text-left`} onClick={() => v !== null && copy(show(v, x.n))} title="انقر للنسخ">
          <span className="opacity-60">{x.l} </span>
          <span className="break-all font-mono">{v === null ? '—' : show(v, x.n)}</span>
        </button>
      ))}
    </div>
  )

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {BASES.map(x => (
          <button key={x.n} onClick={() => setBase(x.n)} className={btn} style={base === x.n ? { background: ACCENT, color: '#111' } : {}}>{x.l}</button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2" dir="ltr">
        <label className="space-y-1 text-sm">A<input value={a} onChange={e => setA(e.target.value)} className={`${field} w-full font-mono`} /></label>
        <label className="space-y-1 text-sm">B<input value={b} onChange={e => setB(e.target.value)} className={`${field} w-full font-mono`} /></label>
      </div>
      <div className="flex flex-wrap gap-2" dir="ltr">
        {OPS.map(([l, fn]) => <button key={l} className={btn} onClick={() => apply(fn)}>{l}</button>)}
        <button className={btn} onClick={() => (A === null ? setErr('A غير صحيحة') : (setErr(''), setRes(BigInt.asIntN(64, ~A))))}>NOT A</button>
      </div>
      {err && <p className="text-sm text-red-300">{err}</p>}
      <div className="space-y-1"><p className="text-sm opacity-70">قيمة A بكل الأنظمة</p>{table(A)}</div>
      <div className="space-y-1"><p className="text-sm opacity-70">النتيجة</p>{table(res)}</div>
    </div>
  )
}

export default function Calculator() {
  const [mode, setMode] = useState<'sci' | 'prog'>('sci')
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex gap-2">
        <button className={btn} onClick={() => setMode('sci')} style={mode === 'sci' ? { background: ACCENT, color: '#111' } : {}}>علمية</button>
        <button className={btn} onClick={() => setMode('prog')} style={mode === 'prog' ? { background: ACCENT, color: '#111' } : {}}>مبرمجين</button>
      </div>
      {mode === 'sci' ? <Scientific /> : <Programmer />}
    </div>
  )
}