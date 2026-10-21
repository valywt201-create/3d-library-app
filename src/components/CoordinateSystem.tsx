import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { compile } from 'mathjs'
import type { EvalFunction } from 'mathjs'
import { Plus, RotateCcw, Trash2 } from 'lucide-react'
import { ACCENT, btn, field, panel } from './toolkit'

const W = 800
const H = 500
const COLORS = ['#a78bfa', '#67e8f9', '#f9a8d4', '#fcd34d', '#86efac', '#fdba74']
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : NaN)

type Rel = '=' | '<' | '>' | '<=' | '>='
type Parsed = { kind: 'fn'; f: EvalFunction } | { kind: 'rel'; g: EvalFunction; rel: Rel } | { kind: 'none' }

// y = f(x) يُرسم كمنحنى، وأي علاقة أخرى (متباينة أو معادلة ضمنية) تُرسم بالعينات
function parseLine(line: string): Parsed {
  const s = line.replace(/≤/g, '<=').replace(/≥/g, '>=').trim()
  if (!s) return { kind: 'none' }
  try {
    const m = s.match(/^(.*?)(<=|>=|<|>|=)(.*)$/)
    if (!m) return { kind: 'fn', f: compile(s) }
    const [, l, op, r] = m
    if (op === '=' && l.trim() === 'y') return { kind: 'fn', f: compile(r) }
    return { kind: 'rel', g: compile(`(${l}) - (${r})`), rel: op as Rel }
  } catch {
    return { kind: 'none' }
  }
}

/* ============ المستوى الثنائي XY ============ */
function Plot2D({ lines }: { lines: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [view, setView] = useState({ cx: 0, cy: 0, k: 40 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const parsed = useMemo(() => lines.map(parseLine), [lines])

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const c = cv.getContext('2d')!
    const { cx, cy, k } = view
    const X = (x: number) => W / 2 + (x - cx) * k
    const Y = (y: number) => H / 2 - (y - cy) * k
    const wx = (px: number) => cx + (px - W / 2) / k
    const wy = (py: number) => cy - (py - H / 2) / k

    c.fillStyle = '#0f1219'
    c.fillRect(0, 0, W, H)
    // الشبكة
    const raw = 70 / k
    const mag = 10 ** Math.floor(Math.log10(raw))
    const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw)!
    c.font = '11px sans-serif'
    c.lineWidth = 1
    for (let x = Math.ceil(wx(0) / step) * step; x <= wx(W); x += step) {
      c.strokeStyle = 'rgba(255,255,255,.07)'
      c.beginPath(); c.moveTo(X(x), 0); c.lineTo(X(x), H); c.stroke()
      if (Math.abs(x) > step / 2) { c.fillStyle = 'rgba(255,255,255,.45)'; c.fillText(String(+x.toPrecision(6)), X(x) + 3, Math.min(H - 4, Math.max(12, Y(0) + 13))) }
    }
    for (let y = Math.ceil(wy(H) / step) * step; y <= wy(0); y += step) {
      c.strokeStyle = 'rgba(255,255,255,.07)'
      c.beginPath(); c.moveTo(0, Y(y)); c.lineTo(W, Y(y)); c.stroke()
      if (Math.abs(y) > step / 2) { c.fillStyle = 'rgba(255,255,255,.45)'; c.fillText(String(+y.toPrecision(6)), Math.min(W - 30, Math.max(4, X(0) + 4)), Y(y) - 3) }
    }
    c.strokeStyle = 'rgba(255,255,255,.55)'
    c.lineWidth = 1.5
    c.beginPath(); c.moveTo(X(0), 0); c.lineTo(X(0), H); c.moveTo(0, Y(0)); c.lineTo(W, Y(0)); c.stroke()

    parsed.forEach((p, i) => {
      const col = COLORS[i % COLORS.length]
      if (p.kind === 'fn') {
        c.strokeStyle = col; c.lineWidth = 2.2; c.beginPath()
        const sc = { x: 0 }
        let pen = false, prev = 0
        for (let px = 0; px <= W; px += 1.5) {
          sc.x = wx(px)
          let y = NaN
          try { y = num(p.f.evaluate(sc)) } catch { /* خارج المجال */ }
          const py = Y(y)
          if (!isFinite(py) || Math.abs(py) > 5000 || (pen && Math.abs(py - prev) > H * 1.5)) { pen = false; continue }
          if (pen) c.lineTo(px, py); else { c.moveTo(px, py); pen = true }
          prev = py
        }
        c.stroke()
      } else if (p.kind === 'rel') {
        const S = 5, nx = Math.ceil(W / S), ny = Math.ceil(H / S), st = nx + 1
        const sc = { x: 0, y: 0 }
        const vals = new Float64Array(st * (ny + 1))
        for (let j = 0; j <= ny; j++) for (let a = 0; a <= nx; a++) {
          sc.x = wx(a * S); sc.y = wy(j * S)
          let v = NaN
          try { v = num(p.g.evaluate(sc)) } catch { /* خارج المجال */ }
          vals[j * st + a] = v
        }
        const ok = (v: number) => (p.rel === '<' ? v < 0 : p.rel === '>' ? v > 0 : p.rel === '<=' ? v <= 0 : p.rel === '>=' ? v >= 0 : false)
        if (p.rel !== '=') {
          c.fillStyle = col + '40' // التظليل
          for (let j = 0; j < ny; j++) for (let a = 0; a < nx; a++) { const v = vals[j * st + a]; if (!isNaN(v) && ok(v)) c.fillRect(a * S, j * S, S, S) }
        }
        c.fillStyle = col // الحدّ الفاصل: حيث تتغير إشارة القيمة
        for (let j = 0; j < ny; j++) for (let a = 0; a < nx; a++) {
          const v = vals[j * st + a], r = vals[j * st + a + 1], d = vals[(j + 1) * st + a]
          if (!isNaN(v) && ((!isNaN(r) && (v < 0) !== (r < 0)) || (!isNaN(d) && (v < 0) !== (d < 0)))) c.fillRect(a * S - 0.5, j * S - 0.5, 2.2, 2.2)
        }
      }
    })
  }, [view, parsed])

  // التكبير بالعجلة (مستمع أصلي حتى نمنع تمرير الصفحة)
  useEffect(() => {
    const el = ref.current!
    const h = (e: WheelEvent) => {
      e.preventDefault()
      setView(v => ({ ...v, k: Math.min(400, Math.max(4, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12))) }))
    }
    el.addEventListener('wheel', h, { passive: false })
    return () => el.removeEventListener('wheel', h)
  }, [])

  const down = (e: RPointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; ref.current!.setPointerCapture(e.pointerId) }
  const move = (e: RPointerEvent) => {
    const d = drag.current
    if (!d) return
    const s = W / ref.current!.getBoundingClientRect().width
    const dx = (e.clientX - d.x) * s, dy = (e.clientY - d.y) * s
    drag.current = { x: e.clientX, y: e.clientY }
    setView(v => ({ ...v, cx: v.cx - dx / v.k, cy: v.cy + dy / v.k }))
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={ref} width={W} height={H}
        className="w-full cursor-grab touch-none rounded-lg border border-white/10"
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drag.current = null }}
      />
      <div className="flex items-center justify-between text-xs opacity-70">
        <span>اسحب للتحريك، وبالعجلة للتكبير</span>
        <button className={btn} onClick={() => setView({ cx: 0, cy: 0, k: 40 })}><RotateCcw size={12} className="ml-1 inline" />إعادة الضبط</button>
      </div>
    </div>
  )
}

/* ============ السطح ثلاثي الأبعاد XYZ ============ */
function Surface({ fn }: { fn: EvalFunction }) {
  const geo = useMemo(() => {
    const R = 5, N = 64
    const g = new THREE.PlaneGeometry(2 * R, 2 * R, N, N) // مستوى XY، والارتفاع z
    const p = g.attributes.position as THREE.BufferAttribute
    const zs: number[] = []
    const sc = { x: 0, y: 0 }
    for (let i = 0; i < p.count; i++) {
      sc.x = p.getX(i); sc.y = p.getY(i)
      let z = 0
      try { const v = num(fn.evaluate(sc)); z = isNaN(v) ? 0 : Math.max(-8, Math.min(8, v)) } catch { /* خارج المجال */ }
      zs.push(z)
      p.setZ(i, z)
    }
    const lo = Math.min(...zs), hi = Math.max(...zs)
    const col = new Float32Array(p.count * 3)
    const cc = new THREE.Color()
    zs.forEach((z, i) => { cc.setHSL(0.78 - 0.28 * ((z - lo) / (hi - lo || 1)), 0.7, 0.55); cc.toArray(col, i * 3) })
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.computeVertexNormals()
    return g
  }, [fn])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial vertexColors side={THREE.DoubleSide} roughness={0.55} />
    </mesh>
  )
}

function Plot3D() {
  const [expr, setExpr] = useState('sin(x) * cos(y)')
  const [rot, setRot] = useState({ spin: 0.6, tilt: 0.7 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const fn = useMemo(() => { try { return compile(expr.replace(/^\s*z\s*=/i, '')) } catch { return null } }, [expr])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2" dir="ltr">
        <span className="text-sm opacity-70">z =</span>
        <input value={expr} onChange={e => setExpr(e.target.value)} className={`${field} flex-1`} placeholder="x^2 + y^2" />
      </div>
      {!fn && <p className="text-sm text-red-300">التعبير غير صالح</p>}
      <div
        className="h-[420px] cursor-grab touch-none overflow-hidden rounded-lg border border-white/10 bg-[#0f1219]"
        onPointerDown={e => { drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture(e.pointerId) }}
        onPointerMove={e => {
          const d = drag.current
          if (!d) return
          drag.current = { x: e.clientX, y: e.clientY }
          setRot(r => ({ spin: r.spin + (e.clientX - d.x) * 0.01, tilt: Math.max(-0.2, Math.min(1.5, r.tilt + (e.clientY - d.y) * 0.01)) }))
        }}
        onPointerUp={() => { drag.current = null }}
      >
        <Canvas camera={{ position: [0, 4, 13], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 6]} intensity={1.6} />
          <group rotation={[rot.tilt, 0, 0]}>
            <gridHelper args={[10, 10, '#6b5fa8', '#2a2f3d']} />
            <group rotation={[-Math.PI / 2, 0, rot.spin]}>
              <axesHelper args={[6]} />
              {fn && <Surface fn={fn} />}
            </group>
          </group>
        </Canvas>
      </div>
      <p className="text-xs opacity-70">اسحب لتدوير السطح. المدى من −5 إلى 5 في x وy.</p>
    </div>
  )
}

export default function CoordinateSystem() {
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [lines, setLines] = useState(['y = x^2', 'y > 2x + 1'])
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button className={btn} onClick={() => setMode('2d')} style={mode === '2d' ? { background: ACCENT, color: '#111' } : {}}>ثنائي XY</button>
        <button className={btn} onClick={() => setMode('3d')} style={mode === '3d' ? { background: ACCENT, color: '#111' } : {}}>ثلاثي XYZ</button>
      </div>
      {mode === '2d' ? (
        <>
          <div className={`${panel} space-y-2 p-3`} dir="ltr">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                <input value={l} onChange={e => setLines(a => a.map((x, j) => (j === i ? e.target.value : x)))} className={`${field} flex-1`} placeholder="y = x^2   |   y > 2x + 1   |   x^2 + y^2 <= 9" />
                <button aria-label="حذف السطر" onClick={() => setLines(a => a.filter((_, j) => j !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
            <button className={btn} onClick={() => setLines(a => [...a, ''])}><Plus size={14} className="ml-1 inline" />دالة أو متباينة</button>
          </div>
          <Plot2D lines={lines} />
        </>
      ) : <Plot3D />}
    </div>
  )
}