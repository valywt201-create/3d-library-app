import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Download, FileUp, Save } from 'lucide-react'
import { useLibrary, useTree } from '../shared'
import { ACCENT, askAI, btn, copy, download, field, flattenTree, hasAI, panel } from './toolkit'

const STOP = new Set('the and for that with this from have are was were not but you your من في على إلى عن أن هذا هذه التي الذي ذلك كان أو ثم قد لم لا ما هو هي كما أي بعد قبل عند حتى'.split(' '))

// تلخيص استخلاصي محلي: نختار الجمل الأعلى وزناً حسب تكرار كلماتها المهمة
function summarize(text: string, n: number): string[] {
  const sents = text.split(/(?<=[.!?؟])\s+|\n+/).map(s => s.trim()).filter(s => s.split(/\s+/).length >= 4)
  const freq = new Map<string, number>()
  const words = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter(w => !STOP.has(w))
  sents.forEach(s => words(s).forEach(w => freq.set(w, (freq.get(w) ?? 0) + 1)))
  const scored = sents.map((s, i) => ({ s, i, v: words(s).reduce((a, w) => a + (freq.get(w) ?? 0), 0) / Math.sqrt(s.length) }))
  return scored.sort((a, b) => b.v - a.v).slice(0, n).sort((a, b) => a.i - b.i).map(x => x.s)
}

export default function DocumentTools() {
  const { items, add } = useLibrary()
  const { tree, path } = useTree()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [lang, setLang] = useState('ara+eng')
  const [text, setText] = useState('')
  const [prog, setProg] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [bullets, setBullets] = useState<string[]>([])
  const [n, setN] = useState(5)
  const [target, setTarget] = useState(path[path.length - 1] ?? '')

  useEffect(() => {
    if (!file) return setPreview('')
    const u = URL.createObjectURL(file)
    setPreview(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const ocr = async () => {
    if (!file) return
    setBusy(true); setProg(0); setMsg('جارٍ تجهيز محرك القراءة (أول مرة يحمّل بيانات اللغة من الإنترنت)…')
    try {
      const { createWorker } = await import('tesseract.js')
      const w = await createWorker(lang, 1, { logger: m => { if (m.status === 'recognizing text') { setProg(m.progress); setMsg('جارٍ قراءة النص…') } } })
      const { data } = await w.recognize(file)
      await w.terminate()
      setText(data.text.trim())
      setMsg(data.text.trim() ? 'تم استخراج النص. يمكنك تعديله ثم تلخيصه.' : 'لم يُعثر على نص. جرّب صورة أوضح أو لغة مختلفة.')
    } catch (e) { setMsg('تعذّر الاستخراج: ' + (e as Error).message) } finally { setBusy(false) }
  }

  const sum = async (ai: boolean) => {
    setMsg('')
    if (!ai) return setBullets(summarize(text, n))
    setBusy(true)
    try {
      const r = await askAI('summary', `لخّص النص التالي في نقاط موجزة باللغة العربية، كل نقطة في سطر يبدأ بـ "- ":\n${text.slice(0, 12000)}`)
      setBullets(r.split('\n').map(l => l.replace(/^[-•*\s]+/, '').trim()).filter(Boolean))
    } catch (e) { setMsg((e as Error).message) } finally { setBusy(false) }
  }

  const saveTxt = () => {
    if (!target) return setMsg('اختر فرعاً لحفظ الملف فيه')
    const body = bullets.length ? `${text}\n\n--- ملخص ---\n${bullets.map(b => '• ' + b).join('\n')}` : text
    const f = new File([body], `ocr-${new Date().toISOString().slice(0, 16)}.txt`, { type: 'text/plain' })
    add({ nodeId: target, name: f.name, kind: 'doc', url: URL.createObjectURL(f), size: f.size, file: f })
    setMsg('تم الحفظ كملف نصي في الفرع')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${btn} cursor-pointer`}><FileUp size={14} className="ml-1 inline" />رفع صورة<input type="file" accept="image/*" hidden onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = '' }} /></label>
        <select className={field} style={{ colorScheme: 'dark' }} defaultValue="" onChange={e => setFile(items.find(i => i.id === e.target.value)?.file ?? null)}>
          <option value="">من صور المكتبة…</option>
          {items.filter(i => i.file && (i.kind === 'image' || i.kind === 'drawing')).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select className={field} style={{ colorScheme: 'dark' }} value={lang} onChange={e => setLang(e.target.value)}>
          <option value="ara+eng">عربي + إنجليزي</option><option value="eng">إنجليزي</option><option value="ara">عربي</option>
        </select>
        <button className={btn} disabled={!file || busy} onClick={ocr} style={{ background: ACCENT, color: '#111' }}>استخراج النص</button>
      </div>
      {preview && <img src={preview} alt="الصورة المختارة" className="max-h-48 rounded-lg border border-white/10" />}
      {busy && <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full" style={{ background: ACCENT }} animate={{ width: `${Math.max(5, prog * 100)}%` }} /></div>}
      {msg && <p className="text-sm opacity-80">{msg}</p>}

      <textarea value={text} onChange={e => setText(e.target.value)} rows={8} placeholder="النص المستخرج (قابل للتحديد والتعديل). يمكنك أيضاً لصق أي نص هنا." className={`${field} w-full`} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button className={btn} onClick={() => copy(text)}><Copy size={13} className="ml-1 inline" />نسخ</button>
        <button className={btn} onClick={() => download('text.txt', text)}><Download size={13} className="ml-1 inline" />تنزيل txt</button>
        <label className="mr-auto">النقاط <input type="number" min={2} max={12} value={n} onChange={e => setN(+e.target.value || 5)} className={`${field} w-14`} /></label>
        <button className={btn} disabled={text.trim().length < 40} onClick={() => sum(false)} style={{ background: ACCENT, color: '#111' }}>تلخيص</button>
        {hasAI() && <button className={btn} disabled={busy || text.trim().length < 40} onClick={() => sum(true)}>تلخيص بالذكاء الاصطناعي</button>}
      </div>

      {bullets.length > 0 && (
        <div className={`${panel} space-y-2 p-3 text-sm`}>
          {bullets.map((b, i) => <motion.p key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>• {b}</motion.p>)}
          <div className="flex flex-wrap gap-2 pt-1">
            <button className={btn} onClick={() => copy(bullets.map(b => '• ' + b).join('\n'))}><Copy size={13} className="ml-1 inline" />نسخ الملخص</button>
            <button className={btn} onClick={() => download('summary.md', bullets.map(b => '- ' + b).join('\n'), 'text/markdown')}><Download size={13} className="ml-1 inline" />تنزيل md</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-sm">
        <select className={field} style={{ colorScheme: 'dark' }} value={target} onChange={e => setTarget(e.target.value)}>
          <option value="">اختر فرعاً للحفظ…</option>
          {flattenTree(tree).map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <button className={btn} disabled={!text.trim()} onClick={saveTxt}><Save size={13} className="ml-1 inline" />حفظ كملف نصي في الفرع</button>
      </div>
    </div>
  )
}