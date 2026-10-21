import { useState } from 'react'
import { Bot, Send, X } from 'lucide-react'
import { sfx, useLibrary, useTree } from '../shared'

/* ============ الإعدادات (غيّرها هنا مباشرة) ============ */
// اختياري: رابط خادمك الذي يحتفظ بمفتاح الذكاء الاصطناعي.
// يستقبل { question, context } ويعيد { answer }. لا تضع مفتاح النموذج داخل كود المتصفح أبداً.
const AI_ENDPOINT = ''

export default function AIAssistant() {
  const { items } = useLibrary()
  const { accent: color, titleOf } = useTree()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [log, setLog] = useState<{ role: 'me' | 'ai'; text: string }[]>([])

  const ask = async () => {
    const question = q.trim()
    if (!question) return
    setQ('')
    sfx.click()
    setLog(l => [...l, { role: 'me', text: question }])

    // البحث المحلي في أسماء الملفات وأنواعها وأسماء الفروع (يعمل دون أي إعداد)
    const words = question.toLowerCase().split(/\s+/).filter(w => w.length > 1)
    const hits = items.filter(i =>
      words.some(w => `${i.name} ${i.kind} ${titleOf(i.nodeId)}`.toLowerCase().includes(w)),
    )
    let answer = hits.length
      ? `وجدت ${hits.length}: ${hits.map(h => `${h.name} (${titleOf(h.nodeId)})`).join('، ')}.`
      : `لا توجد نتائج. مكتبتك تحتوي ${items.length} ملف.`

    if (AI_ENDPOINT) {
      try {
        const context = items.map(i => `${i.name} (${i.kind}, ${titleOf(i.nodeId)})`)
        const r = await fetch(AI_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question, context }),
        })
        answer = (await r.json()).answer
      } catch {
        answer += ' (تعذّر الوصول لخدمة الذكاء الاصطناعي، هذه نتائج البحث المحلي.)'
      }
    }
    setLog(l => [...l, { role: 'ai', text: answer }])
  }

  return (
    <div className="fixed bottom-4 left-4 z-20" dir="rtl">
      {open ? (
        <div className="flex h-96 w-80 max-w-[90vw] flex-col rounded-xl border border-white/10 bg-[#14171f]/95 shadow-xl">
          <div className="flex items-center justify-between border-b border-white/10 p-3">
            <b>مساعد المكتبة</b>
            <button aria-label="إغلاق المساعد" onClick={() => { setOpen(false); sfx.close() }}><X size={16} /></button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
            {!log.length && <p className="opacity-60">اسأل عن أي ملف رفعته، مثل «ابحث عن ملفات الصوت».</p>}
            {log.map((m, i) => (
              <p key={i} className={m.role === 'me' ? 'opacity-80' : ''} style={m.role === 'ai' ? { color } : {}}>{m.text}</p>
            ))}
          </div>
          <div className="flex gap-2 border-t border-white/10 p-2">
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask()}
              placeholder="ابحث في مكتبتك"
              className="min-w-0 flex-1 rounded bg-white/10 px-2 py-1 text-sm outline-none"
            />
            <button aria-label="إرسال" onClick={ask}><Send size={16} className="-scale-x-100" /></button>
          </div>
        </div>
      ) : (
        <button
          aria-label="فتح المساعد"
          onClick={() => { setOpen(true); sfx.open() }}
          className="rounded-full p-3 text-black"
          style={{ background: color }}
        >
          <Bot />
        </button>
      )}
    </div>
  )
}