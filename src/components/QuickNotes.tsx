import { Copy, Eraser } from 'lucide-react'
import { btn, copy, field, usePersisted } from './toolkit'

// ملاحظات سريعة: تُحفظ تلقائياً في المتصفح وتبقى بعد التحديث
export default function QuickNotes() {
  const [text, setText] = usePersisted<string>('atelier-quicknotes-v1', '')

  return (
    <div className="flex h-full min-h-48 flex-col gap-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="اكتب ملاحظتك هنا، تُحفظ تلقائياً…"
        className={`${field} min-h-40 w-full flex-1 resize-none`}
      />
      <div className="flex items-center justify-between text-xs">
        <span className="opacity-60">{text.length} حرف</span>
        <div className="flex gap-2">
          <button className={btn} onClick={() => copy(text)}><Copy size={13} className="ml-1 inline" />نسخ</button>
          <button className={btn} disabled={!text} onClick={() => { if (window.confirm('مسح كل الملاحظات؟')) setText('') }}>
            <Eraser size={13} className="ml-1 inline" />مسح
          </button>
        </div>
      </div>
    </div>
  )
}