import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as RPointerEvent } from 'react'
import { Eraser, Pencil, Save, Trash2 } from 'lucide-react'
import { sfx, useLibrary } from '../shared'

interface Props { nodeId: string; color: string }

// لوحة الرسم: تحفظ الرسمة كصورة PNG داخل الفرع نفسه
export default function Sketchpad({ nodeId, color }: Props) {
  const cv = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [pen, setPen] = useState(color)
  const [size, setSize] = useState(4)
  const [erase, setErase] = useState(false)
  const { add } = useLibrary()

  // تعبئة اللوحة بلون الخلفية الداكن (تُستخدم عند البدء وعند المسح)
  const fill = () => {
    const c = cv.current!.getContext('2d')!
    c.fillStyle = '#12151c'
    c.fillRect(0, 0, 900, 500)
  }
  useEffect(() => { fill() }, [])

  // تحويل موضع المؤشر إلى إحداثيات اللوحة الحقيقية (900×500)
  const pt = (e: RPointerEvent): [number, number] => {
    const r = cv.current!.getBoundingClientRect()
    return [((e.clientX - r.left) * 900) / r.width, ((e.clientY - r.top) * 500) / r.height]
  }
  const down = (e: RPointerEvent) => {
    drawing.current = true
    cv.current!.setPointerCapture(e.pointerId)
    const c = cv.current!.getContext('2d')!
    c.beginPath()
    c.moveTo(...pt(e))
  }
  const move = (e: RPointerEvent) => {
    if (!drawing.current) return
    const c = cv.current!.getContext('2d')!
    c.lineCap = 'round'
    c.lineJoin = 'round'
    c.strokeStyle = erase ? '#12151c' : pen
    c.lineWidth = erase ? size * 4 : size
    c.lineTo(...pt(e))
    c.stroke()
  }
  const save = () =>
    cv.current!.toBlob(b => {
      if (!b) return
      const name = `sketch-${new Date().toISOString().slice(0, 16)}.png`
      add({ nodeId, name, kind: 'drawing', url: URL.createObjectURL(b), size: b.size, file: new File([b], name, { type: 'image/png' }) })
      sfx.success()
    })

  const btn = 'flex items-center gap-1 rounded px-2 py-1 text-sm bg-white/10 hover:bg-white/20'
  return (
    <div className="space-y-2" dir="ltr">
      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} aria-pressed={!erase} onClick={() => { setErase(false); sfx.click() }}><Pencil size={14} />قلم</button>
        <button className={btn} aria-pressed={erase} onClick={() => { setErase(true); sfx.click() }}><Eraser size={14} />ممحاة</button>
        <input type="color" aria-label="لون القلم" value={pen} onChange={e => setPen(e.target.value)} />
        <input type="range" aria-label="حجم الفرشاة" min={1} max={20} value={size} onChange={e => setSize(+e.target.value)} />
        <button className={btn} onClick={() => { fill(); sfx.click() }}><Trash2 size={14} />مسح</button>
        <button className={btn + ' ml-auto'} style={{ background: color, color: '#111' }} onClick={save}><Save size={14} />حفظ في الفرع</button>
      </div>
      <canvas
        ref={cv}
        width={900}
        height={500}
        className="w-full touch-none rounded-lg border border-white/10"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={() => { drawing.current = false }}
      />
    </div>
  )
}