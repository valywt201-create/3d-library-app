import { useState } from 'react'
import { Download, Eye, FileText, Music, Trash2 } from 'lucide-react'
import { sfx, useLibrary } from '../shared'

type Filter = 'all' | 'image' | 'audio' | 'doc'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'الكل' }, { id: 'image', label: 'صور' }, { id: 'audio', label: 'صوت' }, { id: 'doc', label: 'مستندات' },
]
const fmtSize = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

interface Props { nodeId: string; color: string }

// عرض ملفات فرع واحد فقط: تصنيف بالفلاتر + معاينة + عرض + تنزيل + حذف
export default function Library({ nodeId, color }: Props) {
  const { items, remove } = useLibrary()
  const [filter, setFilter] = useState<Filter>('all')
  const mine = items.filter(i => i.nodeId === nodeId) // عزل كامل بين الفروع
  const shown = mine.filter(i =>
    filter === 'all' ? true : filter === 'image' ? i.kind === 'image' || i.kind === 'drawing' : i.kind === filter,
  )

  if (!mine.length)
    return <p className="py-2 text-sm opacity-60">لا توجد ملفات في هذا الفرع بعد. ارفع ملفاً أو احفظ رسمة.</p>

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id); sfx.click() }}
            aria-pressed={filter === f.id}
            className="rounded-full px-3 py-0.5 text-xs"
            style={filter === f.id ? { background: color, color: '#111' } : { background: 'rgba(255,255,255,.1)' }}
          >
            {f.label}
          </button>
        ))}
      </div>
      {!shown.length && <p className="text-sm opacity-60">لا توجد ملفات من هذا النوع.</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {shown.map(i => (
          <li key={i.id} className="group relative rounded-lg bg-white/5 p-2 text-xs">
            {i.kind === 'image' || i.kind === 'drawing' ? (
              <img src={i.url} alt={i.name} className="h-24 w-full rounded object-cover" />
            ) : i.kind === 'audio' ? (
              <div className="flex h-24 flex-col justify-center gap-1">
                <Music size={18} style={{ color }} />
                <audio controls src={i.url} className="w-full" />
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center"><FileText size={28} style={{ color }} /></div>
            )}
            <p className="mt-1 truncate" title={i.name}>{i.name}</p>
            <div className="mt-1 flex items-center justify-between opacity-80">
              <span>{fmtSize(i.size)}</span>
              <span className="flex gap-2">
                <a href={i.url} target="_blank" rel="noreferrer" aria-label={`عرض ${i.name}`} title="عرض" onClick={() => sfx.click()}><Eye size={14} /></a>
                <a href={i.url} download={i.name} aria-label={`تنزيل ${i.name}`} title="تنزيل" onClick={() => sfx.click()}><Download size={14} /></a>
              </span>
            </div>
            <button
              aria-label={`حذف ${i.name}`}
              onClick={() => { remove(i.id); sfx.click() }}
              className="absolute left-1 top-1 rounded bg-black/60 p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <Trash2 size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}