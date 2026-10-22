import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { BookOpenText, Bold, Bot, Code2, Heading2, Heading3, Italic, List, ListChecks, ListOrdered, LoaderCircle, Quote, Redo2, Save, Send, Sparkles, Underline, Undo2 } from 'lucide-react'
import { dbGetNote, dbPutNote } from '../db'
import { requestStudyAI } from '../lib/studyAssistant'
import type { StudyAction } from '../lib/studyAssistant'

interface NotesEditorProps {
  nodeId: string
  title: string
}

type SaveState = 'loading' | 'saving' | 'saved' | 'error'
type EditorCommand = 'bold' | 'italic' | 'underline' | 'insertUnorderedList' | 'insertOrderedList' | 'undo' | 'redo'

const TOOLBAR_BUTTON = 'flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 text-sm transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-95'
const ALLOWED_TAGS = new Set(['P', 'DIV', 'BR', 'H2', 'H3', 'H4', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'A', 'HR'])

function sanitizeNoteHtml(html: string): string {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const cleanNode = (node: Node): Node[] => {
    if (node.nodeType === Node.TEXT_NODE) return [document.createTextNode(node.textContent ?? '')]
    if (!(node instanceof HTMLElement)) return Array.from(node.childNodes).flatMap(cleanNode)

    const children = Array.from(node.childNodes).flatMap(cleanNode)
    if (!ALLOWED_TAGS.has(node.tagName)) return children

    const clean = document.createElement(node.tagName.toLowerCase())
    for (const child of children) clean.appendChild(child)

    if (node.tagName === 'A') {
      const href = node.getAttribute('href')
      if (href) {
        try {
          const url = new URL(href, window.location.origin)
          if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') {
            clean.setAttribute('href', url.href)
            clean.setAttribute('target', '_blank')
            clean.setAttribute('rel', 'noopener noreferrer')
          }
        } catch {
          // تُحذف الروابط غير الصالحة ويظل نصها محفوظاً.
        }
      }
    }

    return [clean]
  }

  const wrapper = document.createElement('div')
  Array.from(parsed.body.childNodes).flatMap(cleanNode).forEach(node => wrapper.appendChild(node))
  return wrapper.innerHTML
}

function hasReadableText(html: string): boolean {
  const documentFragment = new DOMParser().parseFromString(html, 'text/html')
  return (documentFragment.body.textContent ?? '').trim().length > 0
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)
}

export default function NotesEditor({ nodeId, title }: NotesEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const currentHtmlRef = useRef('')
  const dirtyRef = useRef(false)
  const revisionRef = useRef(0)
  const saveTimerRef = useRef<number | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('loading')
  const [revision, setRevision] = useState(0)
  const [hasContent, setHasContent] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantBusy, setAssistantBusy] = useState(false)
  const [assistantQuestion, setAssistantQuestion] = useState('')
  const [assistantAnswer, setAssistantAnswer] = useState('')
  const [assistantError, setAssistantError] = useState('')

  useEffect(() => {
    let cancelled = false
    dbGetNote(nodeId)
      .then(note => {
        if (cancelled) return
        const safeHtml = sanitizeNoteHtml(note?.html ?? '')
        currentHtmlRef.current = safeHtml
        dirtyRef.current = false
        revisionRef.current = 0
        if (editorRef.current) editorRef.current.innerHTML = safeHtml
        setHasContent(hasReadableText(safeHtml))
        setSaveState('saved')
      })
      .catch(() => {
        if (cancelled) return
        currentHtmlRef.current = ''
        if (editorRef.current) editorRef.current.innerHTML = ''
        setSaveError('تعذّر تحميل الملاحظات من التخزين المحلي. أعد تحميل الصفحة أو تحقق من مساحة المتصفح.')
        setSaveState('error')
      })

    return () => { cancelled = true }
  }, [nodeId])

  useEffect(() => {
    if (revision === 0) return undefined

    let cancelled = false
    const timer = window.setTimeout(() => {
      saveTimerRef.current = null
      setSaveState('saving')
      setSaveError('')
      const html = sanitizeNoteHtml(currentHtmlRef.current)
      currentHtmlRef.current = html
      dbPutNote({ nodeId, html, updatedAt: Date.now() })
        .then(() => {
          if (cancelled) return
          if (revisionRef.current === revision) dirtyRef.current = false
          setSaveState(revisionRef.current === revision ? 'saved' : 'saving')
        })
        .catch(() => {
          if (cancelled) return
          setSaveError('تعذّر حفظ الملاحظات. قد تكون مساحة تخزين المتصفح ممتلئة أو غير متاحة.')
          setSaveState('error')
      })
    }, 500)
    saveTimerRef.current = timer

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (saveTimerRef.current === timer) saveTimerRef.current = null
    }
  }, [nodeId, revision])

  const markDirty = (): void => {
    dirtyRef.current = true
    revisionRef.current += 1
    setRevision(revisionRef.current)
  }

  const saveImmediately = (): void => {
    if (!dirtyRef.current || !editorRef.current) return
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const version = revisionRef.current
    const html = sanitizeNoteHtml(editorRef.current.innerHTML)
    currentHtmlRef.current = html
    setSaveState('saving')
    setSaveError('')
    dbPutNote({ nodeId, html, updatedAt: Date.now() })
      .then(() => {
        if (revisionRef.current !== version) return
        dirtyRef.current = false
        setSaveState('saved')
      })
      .catch(() => {
        dirtyRef.current = true
        setSaveError('تعذّر حفظ الملاحظات. قد تكون مساحة تخزين المتصفح ممتلئة أو غير متاحة.')
        setSaveState('error')
      })
  }

  const runAssistant = async (action: StudyAction): Promise<void> => {
    if (assistantBusy) return

    const notes = editorRef.current?.innerText.trim() ?? ''
    const question = assistantQuestion.trim()
    if (action !== 'answer' && !notes) {
      setAssistantError('أضف ملاحظات إلى هذا القسم قبل تلخيصها أو إنشاء اختبار.')
      return
    }
    if (action === 'answer' && !question) {
      setAssistantError('اكتب سؤالاً أولاً ليجيب عنه المساعد.')
      return
    }

    setAssistantBusy(true)
    setAssistantError('')
    setAssistantAnswer('')
    try {
      const answer = await requestStudyAI({
        action,
        nodeTitle: title,
        notes,
        question,
      })
      setAssistantAnswer(answer)
      if (action === 'answer') setAssistantQuestion('')
    } catch (error) {
      setAssistantError(error instanceof Error ? error.message : 'تعذّر إكمال طلب مساعد الدراسة.')
    } finally {
      setAssistantBusy(false)
    }
  }

  const runCommand = (command: EditorCommand): void => {
    if (!editorRef.current || saveState === 'loading') return
    editorRef.current.focus()
    document.execCommand(command, false)
    currentHtmlRef.current = editorRef.current.innerHTML
    setHasContent(hasReadableText(currentHtmlRef.current))
    markDirty()
  }

  const formatBlock = (tag: 'h2' | 'h3' | 'blockquote'): void => {
    if (!editorRef.current || saveState === 'loading') return
    editorRef.current.focus()
    document.execCommand('formatBlock', false, tag)
    currentHtmlRef.current = editorRef.current.innerHTML
    setHasContent(hasReadableText(currentHtmlRef.current))
    markDirty()
  }

  const insertCodeBlock = (): void => {
    if (!editorRef.current || saveState === 'loading') return
    editorRef.current.focus()
    const selectedText = window.getSelection()?.toString() ?? ''
    const code = selectedText ? escapeHtml(selectedText) : '\u200b'
    document.execCommand('insertHTML', false, `<pre><code>${code}</code></pre><p><br></p>`)
    currentHtmlRef.current = editorRef.current.innerHTML
    setHasContent(hasReadableText(currentHtmlRef.current))
    markDirty()
  }

  const insertStudyTemplate = (): void => {
    if (!editorRef.current || saveState === 'loading') return
    editorRef.current.focus()
    document.execCommand(
      'insertHTML',
      false,
      '<h2>ملاحظات الدراسة</h2><p><strong>الفكرة الرئيسة:</strong> </p><p><strong>مصطلحات ومفاهيم:</strong></p><ul><li> </li></ul><p><strong>أسئلة للمراجعة:</strong></p><ol><li> </li></ol><h3>ملخص المحاضرة</h3><p><br></p>',
    )
    currentHtmlRef.current = editorRef.current.innerHTML
    setHasContent(hasReadableText(currentHtmlRef.current))
    markDirty()
  }

  const onEditorInput = (): void => {
    if (!editorRef.current) return
    currentHtmlRef.current = editorRef.current.innerHTML
    setHasContent(hasReadableText(currentHtmlRef.current))
    markDirty()
  }

  const statusText = saveState === 'loading'
    ? 'جارٍ تحميل الملاحظات…'
    : saveState === 'saving'
      ? 'جارٍ الحفظ…'
      : saveState === 'error'
        ? 'تعذّر الحفظ'
        : 'حُفظت التغييرات محلياً'

  const button = (label: string, icon: ReactNode, onClick: () => void, extraClass = '') => (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={saveState === 'loading'}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
      className={`${TOOLBAR_BUTTON} disabled:cursor-not-allowed disabled:opacity-40 ${extraClass}`}
    >
      {icon}
    </button>
  )

  return (
    <section aria-label={`ملاحظات ${title}`} className="space-y-3 rounded-xl border border-white/10 bg-black/10 p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <BookOpenText size={17} className="shrink-0" style={{ color: 'var(--accent)' }} />
          <h3 className="truncate text-sm font-semibold">ملاحظات القسم: {title}</h3>
        </div>
        <p role="status" aria-live="polite" className={`flex items-center gap-1 text-xs ${saveState === 'error' ? 'text-red-300' : 'opacity-60'}`}>
          {saveState === 'loading' || saveState === 'saving'
            ? <LoaderCircle size={13} className="animate-spin" />
            : <Save size={13} />}
          {statusText}
        </p>
      </header>

      <div role="toolbar" aria-label="تنسيق الملاحظات" className="flex flex-wrap gap-1.5">
        {button('عنوان رئيسي', <Heading2 size={16} />, () => formatBlock('h2'))}
        {button('عنوان فرعي', <Heading3 size={16} />, () => formatBlock('h3'))}
        {button('غامق', <Bold size={15} />, () => runCommand('bold'))}
        {button('مائل', <Italic size={15} />, () => runCommand('italic'))}
        {button('تسطير', <Underline size={15} />, () => runCommand('underline'))}
        {button('قائمة نقطية', <List size={15} />, () => runCommand('insertUnorderedList'))}
        {button('قائمة مرقمة', <ListOrdered size={15} />, () => runCommand('insertOrderedList'))}
        {button('اقتباس', <Quote size={15} />, () => formatBlock('blockquote'))}
        {button('كتلة برمجية', <Code2 size={15} />, insertCodeBlock)}
        {button('قالب ملاحظات دراسة وملخص محاضرة', <BookOpenText size={15} />, insertStudyTemplate, 'px-2')}
        {button('تراجع', <Undo2 size={15} />, () => runCommand('undo'))}
        {button('إعادة', <Redo2 size={15} />, () => runCommand('redo'))}
      </div>

      <div className="relative">
        {!hasContent && saveState !== 'loading' && (
          <p aria-hidden="true" className="pointer-events-none absolute inset-x-3 top-3 z-10 text-sm leading-7 opacity-40">
            اكتب ملاحظاتك أو ملخص المحاضرة أو النصوص الطويلة هنا…
          </p>
        )}
        <div
          ref={editorRef}
          contentEditable={saveState !== 'loading'}
          suppressContentEditableWarning
          role="textbox"
          aria-label={`محرر ملاحظات ${title}`}
          aria-multiline="true"
          aria-busy={saveState === 'loading'}
          dir="rtl"
          onInput={onEditorInput}
          onPaste={event => {
            event.preventDefault()
            const text = event.clipboardData.getData('text/plain')
            document.execCommand('insertText', false, text)
            onEditorInput()
          }}
          onBlur={() => {
            if (editorRef.current) currentHtmlRef.current = sanitizeNoteHtml(editorRef.current.innerHTML)
            saveImmediately()
          }}
          className="min-h-56 max-h-[60vh] overflow-y-auto rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm leading-7 outline-none transition focus:border-white/25 focus:ring-1 focus:ring-white/10 [&_a]:text-sky-300 [&_blockquote]:my-2 [&_blockquote]:border-r-2 [&_blockquote]:border-violet-300 [&_blockquote]:pr-3 [&_code]:rounded [&_code]:bg-black/30 [&_code]:px-1 [&_h2]:my-3 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:my-2 [&_h3]:text-base [&_h3]:font-semibold [&_li]:mr-5 [&_ol]:list-decimal [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/50 [&_pre]:p-3 [&_ul]:list-disc"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-violet-300/20 bg-violet-400/[0.04]">
        <button
          type="button"
          aria-expanded={assistantOpen}
          onClick={() => setAssistantOpen(value => !value)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold transition hover:bg-white/5"
        >
          <span className="flex items-center gap-2">
            <Bot size={17} style={{ color: 'var(--accent)' }} />
            مساعد الدراسة
          </span>
          <span className="text-xs opacity-60">{assistantOpen ? 'إخفاء' : 'تلخيص، اختبار، سؤال'}</span>
        </button>

        {assistantOpen && (
          <div className="space-y-3 border-t border-white/10 p-3">
            <p className="text-xs leading-6 opacity-70">
              لا تُرسل الملاحظات تلقائياً. عند اختيار إجراء أدناه، يُرسل نص هذا القسم إلى Google Gemini لمعالجته؛ لا ترسل معلومات لا تريد مشاركتها مع الخدمة.
            </p>
            <p className="text-[11px] leading-5 text-amber-100/70">
              وفق صفحة أسعار Gemini الحالية، قد تستخدم Google بيانات الطبقة المجانية لتحسين منتجاتها. تجنّب إرسال معلومات حساسة، وراجع شروط الخدمة قبل الاستخدام.
            </p>
            <p className="text-[11px] leading-5 opacity-55">
              يتطلب المساعد جلسة Google فعالة في علامة التبويب الحالية؛ بعد إعادة تحميل الصفحة، سجّل الخروج ثم الدخول مجدداً إذا طُلب تجديد الجلسة.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={assistantBusy || !hasContent}
                onClick={() => void runAssistant('summarize')}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles size={14} />تلخيص الملاحظات
              </button>
              <button
                type="button"
                disabled={assistantBusy || !hasContent}
                onClick={() => void runAssistant('quiz')}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ListChecks size={14} />إنشاء اختبار مراجعة
              </button>
            </div>

            <form
              className="space-y-2"
              onSubmit={event => {
                event.preventDefault()
                void runAssistant('answer')
              }}
            >
              <label htmlFor={`study-question-${nodeId}`} className="block text-xs font-medium">اسأل عن هذا القسم</label>
              <div className="flex items-end gap-2">
                <textarea
                  id={`study-question-${nodeId}`}
                  value={assistantQuestion}
                  onChange={event => setAssistantQuestion(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault()
                      void runAssistant('answer')
                    }
                  }}
                  rows={2}
                  maxLength={1_200}
                  placeholder="اكتب سؤالاً مرتبطاً بملاحظات القسم…"
                  dir="auto"
                  className="min-h-11 min-w-0 flex-1 resize-y rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/25 focus:ring-1 focus:ring-white/10"
                />
                <button
                  type="submit"
                  disabled={assistantBusy || !assistantQuestion.trim()}
                  aria-label="إرسال السؤال إلى مساعد الدراسة"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-black transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: 'var(--accent)' }}
                >
                  {assistantBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} className="-scale-x-100" />}
                </button>
              </div>
              <p className="text-[10px] opacity-45">يمكنك الضغط على Ctrl+Enter للإرسال.</p>
            </form>

            {assistantBusy && (
              <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs opacity-70">
                <LoaderCircle size={14} className="animate-spin" />جارٍ إعداد إجابة من ملاحظات هذا القسم…
              </p>
            )}
            {assistantError && <p role="alert" className="rounded-lg border border-red-300/20 bg-red-400/10 p-2 text-xs text-red-200">{assistantError}</p>}
            {assistantAnswer && (
              <div aria-live="polite" className="space-y-1 rounded-lg border border-white/10 bg-black/20 p-3">
                <h4 className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>إجابة مساعد الدراسة</h4>
                <p dir="auto" className="whitespace-pre-wrap text-sm leading-7">{assistantAnswer}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {saveError && <p role="alert" className="text-xs text-red-300">{saveError}</p>}
      <p className="text-[11px] opacity-45">تُحفظ هذه الملاحظات على هذا الجهاز وتبقى منفصلة لكل قسم وفرع.</p>
    </section>
  )
}
