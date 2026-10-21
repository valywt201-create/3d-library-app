import { useRef, useState } from 'react'
import { Copy, Download, Play } from 'lucide-react'
import { ACCENT, btn, copy, download, panel, usePersisted } from './toolkit'

type Lang = 'py' | 'cpp'
const TEMPLATES: Record<Lang, string> = {
  py: '# مثال: أعداد أولية حتى 30\nprimes = [n for n in range(2, 30) if all(n % d for d in range(2, int(n ** 0.5) + 1))]\nprint("الأعداد الأولية:", primes)\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    int sum = 0;\n    for (int i = 1; i <= 10; i++) sum += i;\n    cout << "Sum = " << sum << endl;\n    return 0;\n}\n',
}
const KW: Record<Lang, string> = {
  py: 'def|class|if|elif|else|for|while|return|import|from|in|not|and|or|print|True|False|None|range|len|try|except|with|as|lambda',
  cpp: 'int|long|double|float|char|bool|void|if|else|for|while|return|include|using|namespace|std|cout|cin|endl|class|struct|const|auto|vector|string|new|delete',
}

// تلوين بسيط: تعليقات، نصوص، كلمات مفتاحية، أرقام (تمريرة واحدة فلا يتداخل التلوين)
function highlight(code: string, lang: Lang) {
  const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const cm = lang === 'py' ? '#.*' : '\\/\\/.*'
  const re = new RegExp(`(${cm})|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|\\b(${KW[lang]})\\b|\\b(\\d+\\.?\\d*)\\b`, 'g')
  return esc.replace(re, (m, c, s, k, n) =>
    `<span style="color:${c ? '#7c8294' : s ? '#86efac' : k ? '#c4b5fd' : n ? '#fcd34d' : 'inherit'}">${m}</span>`)
}

// تحميل بيئة Python (Pyodide) عند أول تشغيل فقط
let pyPromise: Promise<any> | null = null
function loadPy(): Promise<any> {
  pyPromise ??= new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js'
    s.onload = () => (window as any).loadPyodide().then(res, rej)
    s.onerror = () => { pyPromise = null; rej(new Error('تعذّر تحميل بيئة Python (تحتاج اتصالاً بالإنترنت)')) }
    document.head.appendChild(s)
  })
  return pyPromise
}

export default function CodePlayground() {
  const [lang, setLang] = useState<Lang>('py')
  const [codes, setCodes] = usePersisted<Record<Lang, string>>('atelier-code-v1', TEMPLATES)
  const [out, setOut] = useState('')
  const [busy, setBusy] = useState(false)
  const pre = useRef<HTMLPreElement>(null)
  const gut = useRef<HTMLDivElement>(null)
  const code = codes[lang]
  const setCode = (v: string) => setCodes(c => ({ ...c, [lang]: v }))

  const run = async () => {
    if (lang === 'cpp') return setOut('تشغيل C++ غير متاح داخل المتصفح بدون خادم تجميع. يمكنك التعديل والحفظ والتنزيل ثم تجميعه على جهازك.')
    setBusy(true)
    setOut('جارٍ التشغيل… (أول مرة يحمّل البيئة وقد يستغرق ثوانٍ)')
    try {
      const py = await loadPy()
      let buf = ''
      py.setStdout({ batched: (m: string) => { buf += m + '\n' } })
      py.setStderr({ batched: (m: string) => { buf += m + '\n' } })
      try { await py.runPythonAsync(code) } catch (e) { buf += String(e) }
      setOut(buf || '(لا يوجد ناتج)')
    } catch (e) { setOut((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['py', 'cpp'] as Lang[]).map(l => (
          <button key={l} className={btn} onClick={() => setLang(l)} style={lang === l ? { background: ACCENT, color: '#111' } : {}}>{l === 'py' ? 'Python' : 'C++'}</button>
        ))}
        <button className={`${btn} mr-auto`} onClick={() => copy(code)}><Copy size={13} className="ml-1 inline" />نسخ</button>
        <button className={btn} onClick={() => download(lang === 'py' ? 'main.py' : 'main.cpp', code)}><Download size={13} className="ml-1 inline" />تنزيل</button>
        <button className={btn} onClick={() => setCode(TEMPLATES[lang])}>مثال جاهز</button>
        <button className={btn} disabled={busy} onClick={run} style={{ background: ACCENT, color: '#111' }}><Play size={13} className="ml-1 inline" />تشغيل</button>
      </div>

      <div className={`${panel} relative h-80 overflow-hidden font-mono text-[13px] leading-5`} dir="ltr">
        <div ref={gut} className="pointer-events-none absolute left-0 top-0 w-10 select-none py-3 pr-2 text-right opacity-40">
          {code.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <pre ref={pre} aria-hidden className="pointer-events-none absolute left-10 top-0 m-0 min-w-full whitespace-pre p-3" dangerouslySetInnerHTML={{ __html: highlight(code, lang) + '\n' }} />
        <textarea
          value={code} spellCheck={false} wrap="off"
          onChange={e => setCode(e.target.value)}
          onScroll={e => {
            const t = e.currentTarget
            if (pre.current) pre.current.style.transform = `translate(${-t.scrollLeft}px,${-t.scrollTop}px)`
            if (gut.current) gut.current.style.transform = `translateY(${-t.scrollTop}px)`
          }}
          onKeyDown={e => {
            if (e.key !== 'Tab') return
            e.preventDefault()
            const t = e.currentTarget
            t.setRangeText('    ', t.selectionStart, t.selectionEnd, 'end')
            setCode(t.value)
          }}
          className="absolute inset-0 left-10 h-full w-[calc(100%-2.5rem)] resize-none overflow-auto whitespace-pre bg-transparent p-3 text-transparent caret-white outline-none"
        />
      </div>

      <pre className={`${panel} min-h-16 whitespace-pre-wrap p-3 font-mono text-sm`}>{out || 'الناتج يظهر هنا'}</pre>
      <p className="text-xs opacity-60">Python يعمل فعلاً داخل المتصفح (بدون input()). كودك يُحفظ تلقائياً.</p>
    </div>
  )
}