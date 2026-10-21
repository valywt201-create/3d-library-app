import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { sfx, useLibrary } from '../shared'
import type { Item } from '../shared'

// تحديد نوع الملف من نوعه (MIME)
const kindOf = (f: File): Item['kind'] =>
  f.type.startsWith('image/') ? 'image' : f.type.startsWith('audio/') ? 'audio' : 'doc'

interface Props { nodeId: string; color: string }

// منطقة رفع الملفات بالسحب والإفلات، وكل ملف يُربط بمعرّف الفرع (nodeId) فقط
export default function Uploader({ nodeId, color }: Props) {
  const { add } = useLibrary()
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  const take = (files: FileList | null) => {
    if (!files?.length) return
    Array.from(files).forEach(f =>
      add({ nodeId, name: f.name, kind: kindOf(f), url: URL.createObjectURL(f), size: f.size, file: f }),
    )
    sfx.success()
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); take(e.dataTransfer.files) }}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && input.current?.click()}
      className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed p-4 text-sm transition-colors"
      style={{ borderColor: color, background: over ? color + '33' : 'transparent' }}
    >
      <UploadCloud style={{ color }} />
      <span>اسحب الصور أو الصوتيات أو المستندات إلى هنا، أو انقر للاختيار</span>
      <input ref={input} type="file" multiple hidden onChange={e => { take(e.target.files); e.target.value = '' }} />
    </div>
  )
}