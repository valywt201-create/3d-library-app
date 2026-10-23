import { useRef, useState } from 'react'
import { Check, Copy, Download, Play } from 'lucide-react'
import { ACCENT, btn, download, panel, usePersisted } from './toolkit'
import { tr, useLocale } from '../lib/i18n'

type Lang = 'py' | 'cpp'
type PythonOutputHandler = { batched: (message: string) => void }

interface PyodideRuntime {
  setStdout: (handler: PythonOutputHandler) => void
  setStderr: (handler: PythonOutputHandler) => void
  runPythonAsync: (source: string) => Promise<unknown>
}

interface PyodideWindow extends Window {
  loadPyodide?: () => Promise<PyodideRuntime>
}

const TEMPLATES: Record<Lang, string> = {
  py: '# Example: prime numbers up to 30\nprimes = [n for n in range(2, 30) if all(n % d for d in range(2, int(n ** 0.5) + 1))]\nprint("Prime numbers:", primes)\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    int sum = 0;\n    for (int i = 1; i <= 10; i++) sum += i;\n    cout << "Sum = " << sum << endl;\n    return 0;\n}\n',
}

const KEYWORDS: Record<Lang, string> = {
  py: 'def|class|if|elif|else|for|while|return|import|from|in|not|and|or|print|True|False|None|range|len|try|except|with|as|lambda',
  cpp: 'int|long|double|float|char|bool|void|if|else|for|while|return|include|using|namespace|std|cout|cin|endl|class|struct|const|auto|vector|string|new|delete',
}

function highlight(source: string, language: Lang): string {
  const escaped = source.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const comment = language === 'py' ? '#.*' : '//.*'
  const expression = new RegExp(`(${comment})|("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')|\\b(${KEYWORDS[language]})\\b|\\b(\\d+\\.?\\d*)\\b`, 'g')
  return escaped.replace(expression, (match, commentText: string | undefined, stringText: string | undefined, keyword: string | undefined, number: string | undefined) =>
    `<span style="color:${commentText ? '#7c8294' : stringText ? '#86efac' : keyword ? '#c4b5fd' : number ? '#fcd34d' : 'inherit'}">${match}</span>`)
}

let pythonPromise: Promise<PyodideRuntime> | null = null

function loadPython(): Promise<PyodideRuntime> {
  if (!pythonPromise) {
    pythonPromise = new Promise<PyodideRuntime>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js'
      script.async = true
      script.onload = () => {
        const loader = (window as PyodideWindow).loadPyodide
        if (!loader) {
          pythonPromise = null
          reject(new Error('The Python runtime could not be initialized.'))
          return
        }
        void loader().then(resolve, error => {
          pythonPromise = null
          reject(error)
        })
      }
      script.onerror = () => {
        pythonPromise = null
        reject(new Error('The Python runtime could not be loaded.'))
      }
      document.head.appendChild(script)
    })
  }
  return pythonPromise
}

export default function CodePlayground() {
  const locale = useLocale()
  const [language, setLanguage] = useState<Lang>('py')
  const [codes, setCodes] = usePersisted<Record<Lang, string>>('atelier-code-v1', TEMPLATES)
  const [output, setOutput] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const editor = useRef<HTMLTextAreaElement>(null)
  const highlightedCode = useRef<HTMLPreElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const code = codes[language]
  const setCode = (value: string): void => setCodes(current => ({ ...current, [language]: value }))
  const text = (english: string, arabic: string): string => tr(locale, english, arabic)

  const copyCode = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setOutput(text('Clipboard access is unavailable. Select the code and copy it.', 'النسخ التلقائي غير متاح. حدّد الشيفرة وانسخها.'))
    }
  }

  const runPython = async (): Promise<void> => {
    if (language !== 'py' || busy) return
    setBusy(true)
    setOutput(text('Preparing the Python runtime…', 'جارٍ تجهيز بيئة Python…'))
    try {
      const python = await loadPython()
      let result = ''
      python.setStdout({ batched: (message: string) => { result += `${message}\n` } })
      python.setStderr({ batched: (message: string) => { result += `${message}\n` } })
      try {
        await python.runPythonAsync(code)
      } catch (error) {
        result += error instanceof Error ? error.message : String(error)
      }
      setOutput(result.trimEnd() || text('(No output)', '(لا يوجد ناتج)'))
    } catch (error) {
      setOutput(error instanceof Error ? error.message : text('The Python runtime could not be loaded.', 'تعذّر تحميل بيئة Python.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3" aria-label={text('Code playground', 'مساحة الأكواد')}>
      <div className="flex flex-wrap items-center gap-2">
        {(['py', 'cpp'] as const).map(item => (
          <button key={item} type="button" className={btn} aria-pressed={language === item} onClick={() => { setLanguage(item); setOutput('') }} style={language === item ? { background: ACCENT, color: '#111' } : undefined}>
            {item === 'py' ? 'Python' : 'C++'}
          </button>
        ))}
        <button type="button" className={`${btn} ms-auto`} onClick={() => { void copyCode() }}>
          {copied ? <Check size={13} className="me-1 inline" /> : <Copy size={13} className="me-1 inline" />}
          {copied ? text('Copied', 'تم النسخ') : text('Copy code', 'نسخ الشيفرة')}
        </button>
        <button type="button" className={btn} onClick={() => download(language === 'py' ? 'main.py' : 'main.cpp', code, 'text/plain')}>
          <Download size={13} className="me-1 inline" />{language === 'cpp' ? text('Download .cpp', 'تنزيل .cpp') : text('Download .py', 'تنزيل .py')}
        </button>
        <button type="button" className={btn} onClick={() => { setCode(TEMPLATES[language]); setOutput('') }}>{text('Reset example', 'استعادة المثال')}</button>
        {language === 'py' && <button type="button" className={btn} disabled={busy} onClick={() => { void runPython() }} style={{ background: ACCENT, color: '#111' }}><Play size={13} className="me-1 inline" />{busy ? text('Preparing…', 'جارٍ التجهيز…') : text('Run Python', 'تشغيل Python')}</button>}
      </div>

      <div className={`${panel} relative h-80 overflow-hidden font-mono text-[13px] leading-5`} dir="ltr">
        <div ref={gutter} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 w-10 select-none py-3 pr-2 text-right opacity-40">
          {code.split('\n').map((_, index) => <div key={index}>{index + 1}</div>)}
        </div>
        <pre ref={highlightedCode} aria-hidden="true" className="pointer-events-none absolute left-10 top-0 m-0 min-w-full whitespace-pre p-3" dangerouslySetInnerHTML={{ __html: `${highlight(code, language)}\n` }} />
        <textarea
          ref={editor}
          value={code}
          spellCheck={false}
          wrap="off"
          aria-label={text(`${language === 'cpp' ? 'C++' : 'Python'} source code`, `شيفرة ${language === 'cpp' ? 'C++' : 'Python'}`)}
          onChange={event => setCode(event.target.value)}
          onScroll={event => {
            const target = event.currentTarget
            if (highlightedCode.current) highlightedCode.current.style.transform = `translate(${-target.scrollLeft}px,${-target.scrollTop}px)`
            if (gutter.current) gutter.current.style.transform = `translateY(${-target.scrollTop}px)`
          }}
          onKeyDown={event => {
            if (event.key !== 'Tab') return
            event.preventDefault()
            const target = event.currentTarget
            target.setRangeText('    ', target.selectionStart, target.selectionEnd, 'end')
            setCode(target.value)
          }}
          className="absolute inset-0 left-10 h-full w-[calc(100%-2.5rem)] resize-none overflow-auto whitespace-pre bg-transparent p-3 text-transparent caret-white outline-none"
        />
      </div>

      {language === 'cpp' ? (
        <aside className={`${panel} space-y-2 p-3 text-sm`}>
          <h3 className="font-semibold">{text('Ready to build your C++ file', 'ملف C++ جاهز للتجميع')}</h3>
          <p className="text-xs leading-5 opacity-75">{text('Copy the code or download main.cpp, then compile it with a C++ compiler such as g++ or clang.', 'انسخ الشيفرة أو نزّل main.cpp، ثم جمّع الملف باستخدام مترجم C++ مثل g++ أو clang.')}</p>
          <pre dir="ltr" className="overflow-x-auto rounded-lg bg-black/25 p-2 text-xs">{text('g++ main.cpp -o main\n./main', 'g++ main.cpp -o main\n./main')}</pre>
          <p className="text-xs leading-5 opacity-65">{text('On Windows, run main.exe after compiling. Your source stays saved in this browser.', 'على Windows، شغّل main.exe بعد التجميع. تبقى الشيفرة محفوظة في هذا المتصفح.')}</p>
        </aside>
      ) : (
        <pre aria-live="polite" className={`${panel} min-h-16 whitespace-pre-wrap p-3 font-mono text-sm`}>{output || text('Output will appear here.', 'سيظهر الناتج هنا.')}</pre>
      )}
      {language === 'py' && <p className="text-xs opacity-60">{text('Python runs in this browser and your code is saved automatically.', 'يعمل Python داخل المتصفح وتُحفظ شيفرتك تلقائياً.')}</p>}
    </section>
  )
}
