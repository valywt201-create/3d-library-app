import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { ACCENT, btn, field, panel } from './toolkit'

/* ============ مؤقت بومودورو ============ */
type ModeId = 'focus' | 'short' | 'long'
const MODES: { id: ModeId; label: string }[] = [{ id: 'focus', label: 'تركيز' }, { id: 'short', label: 'استراحة قصيرة' }, { id: 'long', label: 'استراحة طويلة' }]

function chime() {
  try {
    const c = new AudioContext()
    ;[660, 880, 1100].forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + i * 0.25
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.15, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.7)
    })
    setTimeout(() => c.close(), 1800)
  } catch { /* الصوت غير متاح */ }
}

/* ============ الأجواء الفضائية (مولَّدة بالكود بدون ملفات صوت) ============ */
type Kind = 'drone' | 'wind' | 'stars'
const KINDS: { id: Kind; label: string }[] = [{ id: 'drone', label: 'فضاء عميق' }, { id: 'wind', label: 'رياح كونية' }, { id: 'stars', label: 'نبضات نجمية' }]

function build(kind: Kind, ctx: AudioContext, out: AudioNode): () => void {
  const stops: (() => void)[] = []
  if (kind === 'drone') {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380; lp.connect(out)
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06
    const lg = ctx.createGain(); lg.gain.value = 160
    lfo.connect(lg); lg.connect(lp.frequency); lfo.start()
    ;[55, 82.41, 110.3, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (i - 1.5) * 6
      const g = ctx.createGain(); g.gain.value = 0.12
      o.connect(g); g.connect(lp); o.start(); stops.push(() => o.stop())
    })
    stops.push(() => lfo.stop())
  } else if (kind === 'wind') {
    const len = ctx.sampleRate * 4, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5 } // ضوضاء بنية ناعمة
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520
    const g = ctx.createGain(); g.gain.value = 0.35
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08
    const lg = ctx.createGain(); lg.gain.value = 0.2
    lfo.connect(lg); lg.connect(g.gain); lfo.start()
    src.connect(lp); lp.connect(g); g.connect(out); src.start()
    stops.push(() => src.stop(), () => lfo.stop())
  } else {
    const dl = ctx.createDelay(1); dl.delayTime.value = 0.45
    const fb = ctx.createGain(); fb.gain.value = 0.45
    dl.connect(fb); fb.connect(dl); dl.connect(out)
    let timer = 0
    const ping = () => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 500 + Math.random() * 1300
      const g = ctx.createGain(), t = ctx.currentTime
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
      o.connect(g); g.connect(out); g.connect(dl); o.start(t); o.stop(t + 1.7)
      timer = window.setTimeout(ping, 1200 + Math.random() * 3000)
    }
    ping()
    stops.push(() => clearTimeout(timer))
  }
  return () => stops.forEach(s => s())
}

export default function AudioTools() {
  const [mode, setMode] = useState<ModeId>('focus')
  const [mins, setMins] = useState({ focus: 25, short: 5, long: 15 })
  const [left, setLeft] = useState(25 * 60)
  const [run, setRun] = useState(false)
  const [done, setDone] = useState(0)
  const end = useRef(0)
  const finishRef = useRef(() => {})
  const total = mins[mode] * 60

  const switchMode = (m: ModeId) => { setMode(m); setLeft(mins[m] * 60); setRun(false) }
  finishRef.current = () => {
    setRun(false); chime()
    if (mode === 'focus') { const n = done + 1; setDone(n); switchMode(n % 4 === 0 ? 'long' : 'short') } else switchMode('focus')
  }
  useEffect(() => {
    if (!run) return
    const id = setInterval(() => { const l = Math.max(0, Math.round((end.current - Date.now()) / 1000)); setLeft(l); if (l === 0) finishRef.current() }, 250)
    return () => clearInterval(id)
  }, [run])

  const toggle = () => { if (!run) end.current = Date.now() + left * 1000; setRun(r => !r) }
  const C = 2 * Math.PI * 70

  // محرك الصوت
  const ctxRef = useRef<AudioContext | null>(null)
  const master = useRef<GainNode | null>(null)
  const live = useRef<Partial<Record<Kind, () => void>>>({})
  const [active, setActive] = useState<Kind[]>([])
  const [vol, setVol] = useState(0.6)

  const toggleKind = (k: Kind) => {
    if (live.current[k]) { live.current[k]!(); delete live.current[k]; return setActive(a => a.filter(x => x !== k)) }
    if (!ctxRef.current) { ctxRef.current = new AudioContext(); master.current = ctxRef.current.createGain(); master.current.gain.value = vol; master.current.connect(ctxRef.current.destination) }
    ctxRef.current.resume()
    live.current[k] = build(k, ctxRef.current, master.current!)
    setActive(a => [...a, k])
  }
  useEffect(() => { master.current?.gain.setTargetAtTime(vol, ctxRef.current?.currentTime ?? 0, 0.1) }, [vol])
  useEffect(() => () => { Object.values(live.current).forEach(s => s?.()); ctxRef.current?.close() }, [])

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className={`${panel} space-y-4 p-4 text-center`}>
        <div className="flex justify-center gap-2">
          {MODES.map(m => <button key={m.id} className={btn} onClick={() => switchMode(m.id)} style={mode === m.id ? { background: ACCENT, color: '#111' } : {}}>{m.label}</button>)}
        </div>
        <div className="relative mx-auto h-44 w-44">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
            <circle cx={80} cy={80} r={70} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={8} />
            <motion.circle cx={80} cy={80} r={70} fill="none" stroke={ACCENT} strokeWidth={8} strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - left / total) }} transition={{ duration: 0.3 }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-semibold tabular-nums" dir="ltr">{String(Math.floor(left / 60)).padStart(2, '0')}:{String(left % 60).padStart(2, '0')}</span>
            <span className="text-xs opacity-60">جلسات منجزة: {done}</span>
          </div>
        </div>
        <div className="flex justify-center gap-2">
          <button className={btn} onClick={toggle} style={{ background: ACCENT, color: '#111' }}>{run ? <><Pause size={14} className="ml-1 inline" />إيقاف مؤقت</> : <><Play size={14} className="ml-1 inline" />ابدأ</>}</button>
          <button className={btn} onClick={() => switchMode(mode)}><RotateCcw size={14} className="ml-1 inline" />إعادة</button>
        </div>
        <div className="flex justify-center gap-3 text-xs">
          {MODES.map(m => (
            <label key={m.id}>{m.label}
              <input type="number" min={1} max={120} value={mins[m.id]} className={`${field} mr-1 w-14`}
                onChange={e => { const v = Math.max(1, +e.target.value || 1); setMins(x => ({ ...x, [m.id]: v })); if (m.id === mode && !run) setLeft(v * 60) }} />
            </label>
          ))}
        </div>
      </div>

      <div className={`${panel} space-y-3 p-4`}>
        <p className="text-sm font-semibold">أجواء فضائية للتركيز</p>
        <div className="flex flex-wrap gap-2">
          {KINDS.map(k => <button key={k.id} className={btn} onClick={() => toggleKind(k.id)} style={active.includes(k.id) ? { background: ACCENT, color: '#111' } : {}}>{k.label}</button>)}
        </div>
        <label className="flex items-center gap-3 text-sm">مستوى الصوت
          <input type="range" min={0} max={1} step={0.05} value={vol} onChange={e => setVol(+e.target.value)} className="flex-1" />
        </label>
        <p className="text-xs opacity-60">الأصوات مولَّدة بالكود (Web Audio)، ويمكن تشغيل أكثر من جو معاً.</p>
      </div>
    </div>
  )
}