import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { PALETTE, findNode, sfx, useLibrary, useTree } from '../shared'
import type { TNode } from '../shared'
import { TRASH_RETENTION_DAYS, useSettings } from '../lib/settings'
import { tr, useLocale } from '../lib/i18n'
import { collectNodeIds, moveToTrash } from '../lib/trash'
import Uploader from './Uploader'
import Sketchpad from './Sketchpad'
import Library from './Library'
import ToolsPanel from './ToolsPanel'
import NotesEditor from './NotesEditor'

interface AddFormProps {
  placeholder: string
  color: string
  addLabel: string
  onSubmit: (title: string) => void
}

function AddForm({ placeholder, color, addLabel, onSubmit }: AddFormProps) {
  const [value, setValue] = useState('')
  const submit = (): void => {
    const title = value.trim()
    if (!title) return
    onSubmit(title)
    setValue('')
  }

  return (
    <div className="flex gap-2">
      <input
        value={value}
        onChange={event => setValue(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter') submit() }}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm outline-none transition focus:border-white/20 focus:ring-1"
        style={{ ['--tw-ring-color' as string]: color }}
      />
      <button
        type="button"
        aria-label={addLabel}
        onClick={submit}
        className="flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-black transition active:scale-95"
        style={{ background: color }}
      >
        <Plus size={14} />{addLabel}
      </button>
    </div>
  )
}

interface TreeNodeItemProps {
  node: TNode
  parentPath: string[]
  depth: number
  onNotice: (message: string) => void
}

function TreeNodeItem({ node, parentPath, depth, onNotice }: TreeNodeItemProps) {
  const locale = useLocale()
  const { viewMode } = useSettings()
  const { items } = useLibrary()
  const { tree, path, setPath, addNode, removeNode } = useTree()
  const [sketchOpen, setSketchOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const color = PALETTE[node.ci % PALETTE.length]
  const myPath = [...parentPath, node.id]
  const open = path[depth] === node.id
  const active = open && path.length === myPath.length
  const count = items.filter(item => item.nodeId === node.id).length
  const text = (english: string, arabic: string): string => tr(locale, english, arabic)
  const nodePathKey = myPath
    .map(id => findNode(tree, id)?.title.trim().normalize('NFKC').toLocaleLowerCase(locale) ?? '')
    .filter(Boolean)
    .join('/')

  const toggle = (): void => {
    if (open) sfx.close()
    else sfx.open()
    setPath(open ? parentPath : myPath)
  }

  const handleDelete = async (): Promise<void> => {
    if (deleting) return
    const message = text(
      `Move “${node.title}” and its sections and files to the trash? You can restore it from Settings for ${TRASH_RETENTION_DAYS} days.`,
      `نقل «${node.title}» وكل فروعه وملفاته إلى المحذوفات؟ يمكنك استعادته من الإعدادات خلال ${TRASH_RETENTION_DAYS} يوماً.`,
    )
    if (!window.confirm(message)) return
    setDeleting(true)

    const ids = new Set(collectNodeIds(node))
    const files = items.flatMap(item => ids.has(item.nodeId) && item.file
      ? [{ nodeId: item.nodeId, name: item.name, kind: item.kind, size: item.size, file: item.file }]
      : [])
    const parentId = parentPath.length ? parentPath[parentPath.length - 1] : null
    const siblings = parentId === null ? tree : findNode(tree, parentId)?.children ?? []
    const index = Math.max(0, siblings.findIndex(sibling => sibling.id === node.id))
    const saved = await moveToTrash({ node, parentId, index, files })

    if (!saved) {
      const force = window.confirm(text(
        'The trash could not be saved in this browser. Permanently delete this section?',
        'تعذّر حفظ العنصر في المحذوفات. هل تريد حذفه نهائياً؟',
      ))
      if (!force) {
        setDeleting(false)
        return
      }
    }

    sfx.close()
    setPath(parentPath)
    removeNode(node.id)
    onNotice(saved
      ? text(`“${node.title}” was moved to the trash.`, `نُقل «${node.title}» إلى المحذوفات.`)
      : text(`“${node.title}” was permanently removed.`, `حُذف «${node.title}» نهائياً.`))
  }

  return (
    <div
      className="overflow-hidden rounded-xl transition-shadow"
      style={{
        borderInlineStart: `3px solid ${color}`,
        background: open ? `linear-gradient(90deg, ${color}12, rgba(20,23,31,.78))` : 'rgba(20,23,31,.72)',
        boxShadow: open ? `0 0 0 1px ${color}55, 0 8px 24px ${color}22` : 'none',
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-2 px-4 text-start transition hover:bg-white/[0.03] ${depth === 0 ? (viewMode === 'compact' ? 'py-2.5 text-base font-semibold sm:text-lg' : 'py-3 text-base font-semibold sm:text-lg') : (viewMode === 'compact' ? 'py-2 text-sm' : 'py-2.5 text-sm')}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate" style={{ color: open ? color : undefined }}>{node.title}</span>
          {count > 0 && <span className="rounded-full px-2 text-xs tabular-nums" style={{ background: color + '33', color }}>{count}</span>}
          {active && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-label={text('Selected section', 'القسم المحدد')} />}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown size={18} /></motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className={`${viewMode === 'compact' ? 'space-y-2.5' : 'space-y-3'} p-3`}>
              <Uploader nodeId={node.id} color={color} />
              <button
                type="button"
                onClick={() => { setSketchOpen(value => !value); sfx.click() }}
                aria-pressed={sketchOpen}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-sm transition hover:bg-white/20"
              >
                <Pencil size={14} />{sketchOpen ? text('Hide sketchpad', 'إخفاء لوحة الرسم') : text('Sketchpad', 'لوحة الرسم')}
              </button>
              {sketchOpen && <Sketchpad nodeId={node.id} color={color} />}
              <Library nodeId={node.id} color={color} />
              {active && <NotesEditor key={node.id} nodeId={node.id} title={node.title} nodePathKey={nodePathKey} />}

              <div className="space-y-2 border-t border-white/10 pt-3">
                <AddForm
                  placeholder={text(`New section inside “${node.title}”`, `فرع جديد داخل «${node.title}»`)}
                  color={color}
                  addLabel={text('Add', 'إضافة')}
                  onSubmit={title => {
                    const id = addNode(node.id, title)
                    sfx.success()
                    setPath([...myPath, id])
                  }}
                />
                <button
                  type="button"
                  onClick={() => { void handleDelete() }}
                  disabled={deleting}
                  className="flex items-center gap-1.5 text-xs opacity-65 transition hover:opacity-100 disabled:opacity-40"
                >
                  <Trash2 size={12} />{deleting ? text('Moving…', 'جارٍ النقل…') : text('Move this section to trash', 'نقل هذا الفرع إلى المحذوفات')}
                </button>
              </div>

              {node.children.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, paddingInlineStart: 0 }}
                  animate={{ opacity: 1, paddingInlineStart: 24 }}
                  exit={{ opacity: 0, paddingInlineStart: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-2"
                  style={{ borderInlineStart: `2px solid ${color}66`, marginInlineStart: 8 }}
                >
                  {node.children.map(child => (
                    <div key={child.id} className="relative">
                      <span aria-hidden="true" style={{ position: 'absolute', insetInlineStart: -24, top: 20, width: 24, height: 2, background: color + '66' }} />
                      <TreeNodeItem node={child} parentPath={myPath} depth={depth + 1} onNotice={onNotice} />
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function TreeSidebar() {
  const locale = useLocale()
  const { viewMode } = useSettings()
  const compactMode = viewMode === 'compact'
  const { tree, setPath, addNode } = useTree()
  const [notice, setNotice] = useState('')
  const text = (english: string, arabic: string): string => tr(locale, english, arabic)

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 6_000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return (
    <main
      data-tour="tree-categories"
      data-view-mode={viewMode}
      data-panel-side={locale === 'ar' ? 'right' : 'left'}
      className={compactMode
        ? `fixed bottom-0 top-14 z-10 w-full max-w-[31rem] overflow-y-auto overscroll-contain border-white/10 bg-slate-950/90 px-3 py-4 shadow-2xl shadow-black/40 backdrop-blur-2xl transition-[width,transform] duration-300 ease-out sm:px-4 sm:py-5 ${locale === 'ar' ? 'right-0 border-l' : 'left-0 border-r'}`
        : 'relative mx-auto w-full max-w-none space-y-3 px-3 py-5 transition-[max-width,padding] duration-300 ease-out sm:px-5 sm:py-6'}
    >
      <section className={`glass rounded-2xl border border-white/[0.06] ${compactMode ? 'p-3 sm:p-4' : 'p-3.5 sm:p-4'}`}>
        <div className="mb-2.5 flex items-center gap-2 text-sm font-medium text-white/80">
          <FolderPlus size={16} style={{ color: 'var(--accent)' }} />{text('Create a top-level category', 'إنشاء قسم رئيسي')}
        </div>
        <AddForm
          placeholder={text('Trading, Welding, Quran, Art, Learning…', 'التداول، اللحام، القرآن، الفن، التعلم…')}
          color="var(--accent)"
          addLabel={text('Add category', 'إضافة قسم')}
          onSubmit={title => {
            const id = addNode(null, title)
            sfx.success()
            setPath([id])
          }}
        />
      </section>

      {notice && <p role="status" className="glass rounded-xl border border-white/10 px-3 py-2 text-sm">{notice}</p>}

      <section aria-label={text('Library tools', 'أدوات المكتبة')}>
        <ToolsPanel />
      </section>

      {tree.length === 0 && <p className="py-6 text-center text-sm opacity-60">{text('No categories yet. Create your first one above.', 'لا توجد أقسام بعد. أنشئ أول قسم من الأعلى.')}</p>}
      <div className={compactMode ? 'space-y-2' : 'space-y-2.5'}>
        {tree.map(node => <TreeNodeItem key={node.id} node={node} parentPath={[]} depth={0} onNotice={setNotice} />)}
      </div>
    </main>
  )
}
