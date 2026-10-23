import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Eraser, Pencil, Save, Trash2 } from 'lucide-react'
import { sfx, useLibrary } from '../shared'
import { tr, useLocale } from '../lib/i18n'

interface Props {
  nodeId: string
  color: string
}

export default function Sketchpad({ nodeId, color }: Props) {
  const locale = useLocale()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [pen, setPen] = useState(color)
  const [size, setSize] = useState(4)
  const [erase, setErase] = useState(false)
  const { add } = useLibrary()
  const text = (english: string, arabic: string): string => tr(locale, english, arabic)

  const fill = (): void => {
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    context.fillStyle = '#12151c'
    context.fillRect(0, 0, 900, 500)
  }

  useEffect(() => { fill() }, [])

  const point = (event: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    if (!bounds) return [0, 0]
    return [((event.clientX - bounds.left) * 900) / bounds.width, ((event.clientY - bounds.top) * 500) / bounds.height]
  }

  const startDrawing = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    drawing.current = true
    canvas.setPointerCapture(event.pointerId)
    context.beginPath()
    context.moveTo(...point(event))
  }

  const draw = (event: ReactPointerEvent<HTMLCanvasElement>): void => {
    if (!drawing.current) return
    const context = canvasRef.current?.getContext('2d')
    if (!context) return
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = erase ? '#12151c' : pen
    context.lineWidth = erase ? size * 4 : size
    context.lineTo(...point(event))
    context.stroke()
  }

  const save = (): void => {
    canvasRef.current?.toBlob(blob => {
      if (!blob) return
      const name = `sketch-${new Date().toISOString().slice(0, 16)}.png`
      add({ nodeId, name, kind: 'drawing', url: URL.createObjectURL(blob), size: blob.size, file: new File([blob], name, { type: 'image/png' }) })
      sfx.success()
    })
  }

  const buttonClass = 'flex items-center gap-1 rounded px-2 py-1 text-sm bg-white/10 hover:bg-white/20'
  return (
    <div className="space-y-2" dir="ltr">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} aria-pressed={!erase} onClick={() => { setErase(false); sfx.click() }}><Pencil size={14} />{text('Pen', 'قلم')}</button>
        <button type="button" className={buttonClass} aria-pressed={erase} onClick={() => { setErase(true); sfx.click() }}><Eraser size={14} />{text('Eraser', 'ممحاة')}</button>
        <input type="color" aria-label={text('Pen color', 'لون القلم')} value={pen} onChange={event => setPen(event.target.value)} />
        <input type="range" aria-label={text('Brush size', 'حجم الفرشاة')} min={1} max={20} value={size} onChange={event => setSize(Number(event.target.value))} />
        <button type="button" className={buttonClass} onClick={() => { fill(); sfx.click() }}><Trash2 size={14} />{text('Clear', 'مسح')}</button>
        <button type="button" className={`${buttonClass} ms-auto`} style={{ background: color, color: '#111' }} onClick={save}><Save size={14} />{text('Save to section', 'حفظ في الفرع')}</button>
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        aria-label={text('Drawing canvas', 'لوحة الرسم')}
        className="w-full touch-none rounded-lg border border-white/10"
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={() => { drawing.current = false }}
        onPointerCancel={() => { drawing.current = false }}
      />
    </div>
  )
}
