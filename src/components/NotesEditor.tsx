import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { BookOpenText, Bold, Code2, Heading2, Heading3, Italic, List, ListOrdered, LoaderCircle, Quote, Redo2, Save, Underline, Undo2 } from 'lucide-react'
import { dbGetNote, dbPutNote } from '../db'

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

      {saveError && <p role="alert" className="text-xs text-red-300">{saveError}</p>}
      <p className="text-[11px] opacity-45">تُحفظ هذه الملاحظات على هذا الجهاز وتبقى منفصلة لكل قسم وفرع.</p>
    </section>
  )
}
