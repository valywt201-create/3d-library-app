import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useLibrary, useTree } from '../shared'
import { ACCENT, askAI, hasAI, panel } from './toolkit'

interface Msg {
  role: 'me' | 'ai'
  text: string
}

// محادثة عن مكتبتك: بحث محلي في الملفات، ومع AI_ENDPOINT (في toolkit.ts) تصبح محادثة ذكاء اصطناعي كاملة
export default function AIChat() {
  const { items } = useLibrary()
  const { titleOf } = useTree()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [msgs])

  const send = async (): Promise<void> => {
    const question = q.trim()
    if (!question || busy) return
    setQ('')
    setMsgs(m => [...m, { role: 'me', text: question }])
    setBusy(true)
    try {
      let answer: string
      if (hasAI()) {
        const ctx = items.map(i => `${i.name} (${i.kind}, ${titleOf(i.nodeId)})`).join('\n')
        answer = await askAI('chat', `ملفات المستخدم:\n${ctx || '(لا توجد ملفات)'}\n\nسؤال المستخدم: ${question}`)
      } else {
        const words = question.toLowerCase().split(/\s+/).filter(w => w.length > 1)
        const hits = items.filter(i => words.some(w => `${i.name} ${i.kind} ${titleOf(i.nodeId)}`.toLowerCase().includes(w)))
        answer = hits.length
          ? `وجدت ${hits.length}: ${hits.map(h => `${h.name} (${titleOf(h.nodeId)})`).join('، ')}.`
          : `لا توجد نتائج. مكتبتك تحتوي ${items.length} ملف. (للمحادثة الذكية ضع AI_ENDPOINT في toolkit.ts)`
      }
      setMsgs(m => [...m, { role: 'ai', text: answer }])
    } catch (e) {
      setMsgs(m => [...m, { role: 'ai', text: (e as Error).message }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-60 flex-col gap-2">
      <div className="flex-1 space-y-2 overflow-y-auto text-sm">
        {!msgs.length && <p className="opacity-60">اسأل عن أي ملف في مكتبتك، مثل «ابحث عن ملفات الصوت».</p>}
        {msgs.map((m, i) => (
          <p key={i} className={m.role === 'me' ? `${panel} p-2 opacity-90` : 'whitespace-pre-wrap p-1'} style={m.role === 'ai' ? { color: ACCENT } : undefined}>
            {m.text}
          </p>
        ))}
        {busy && <p className="text-xs opacity-60">جارٍ الكتابة…</p>}
        <div ref={end} />
      </div>
      <div className="flex gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void send()}
          placeholder="اكتب سؤالك"
          className="min-w-0 flex-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#a78bfa]"
        />
        <button aria-label="إرسال" disabled={busy} onClick={() => void send()} className="rounded-lg px-3 text-black transition active:scale-95 disabled:opacity-60" style={{ background: ACCENT }}>
          <Send size={15} className="-scale-x-100" />
        </button>
      </div>
    </div>
  )
}