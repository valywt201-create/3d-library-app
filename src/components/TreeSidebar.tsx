import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { PALETTE, findNode, sfx, useLibrary, useTree } from '../shared'
import type { TNode } from '../shared'
import { TRASH_RETENTION_DAYS } from '../lib/settings'
import { collectNodeIds, moveToTrash } from '../lib/trash'
import Uploader from './Uploader'
import Sketchpad from './Sketchpad'
import Library from './Library'
import ToolsPanel from './ToolsPanel'
import NotesEditor from './NotesEditor'

/* ============ نموذج إضافة (قسم / فرع) ============ */
interface AddFormProps {
  placeholder: string
  color: string
  onSubmit: (title: string) => void
}

function AddForm({ placeholder, color, onSubmit }: AddFormProps) {
  const [v, setV] = useState('')

  const submit = (): void => {
    const t = v.trim()
    if (!t) return
    onSubmit(t)
    setV('')
  }

  return (
    <div className="flex gap-2">
      <input
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded bg-white/10 px-3 py-1.5 text-sm outline-none focus:ring-1"
        style={{ ['--tw-ring-color' as string]: color }}
      />
      <button
        aria-label={placeholder}
        onClick={submit}
        className="flex items-center gap-1 rounded px-3 py-1.5 text-sm font-semibold text-black"
        style={{ background: color }}
      >
        <Plus size={14} />إضافة
      </button>
    </div>
  )
}

/* ============ عقدة الشجرة (أكورديون متدرّج بعمق غير محدود) ============ */
interface TreeNodeItemProps {
  node: TNode
  parentPath: string[]
  depth: number
  onNotice: (msg: string) => void
}

function TreeNodeItem({ node, parentPath, depth, onNotice }: TreeNodeItemProps) {
  const { items } = useLibrary()
  const { tree, path, setPath, addNode, removeNode } = useTree()
  const [sketch, setSketch] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const color = PALETTE[node.ci % PALETTE.length]
  const myPath = [...parentPath, node.id]
  // المسار النشط يحتوي فرعاً واحداً فقط في كل مستوى، فيكفي فحص موضع هذا المستوى
  const open = path[depth] === node.id
  const active = open && path.length === myPath.length
  const count = items.filter(i => i.nodeId === node.id).length

  const toggle = (): void => {
    if (open) sfx.close()
    else sfx.open()
    setPath(open ? parentPath : myPath)
  }

  // الحذف: ينقل الفرع وملفاته إلى سلة المهملات، ولا يحذف شيئاً قبل نجاح الحفظ فيها
  const handleDelete = async (): Promise<void> => {
    if (deleting) return
    const ok = window.confirm(
      `نقل «${node.title}» وكل فروعه وملفاته إلى سلة المهملات؟\nيمكنك استعادته من الإعدادات خلال ${TRASH_RETENTION_DAYS} يوماً.`,
    )
    if (!ok) return
    setDeleting(true)

    const ids = new Set(collectNodeIds(node))
    const files = items.flatMap(i =>
      ids.has(i.nodeId) && i.file
        ? [{ nodeId: i.nodeId, name: i.name, kind: i.kind, size: i.size, file: i.file }]
        : [],
    )
    // موضعه الأصلي: أبوه وترتيبه بين إخوته
    const parentId = parentPath.length ? parentPath[parentPath.length - 1] : null
    const siblings = parentId === null ? tree : findNode(tree, parentId)?.children ?? []
    const index = Math.max(0, siblings.findIndex(n => n.id === node.id))

    const saved = await moveToTrash({ node, parentId, index, files })
    if (!saved) {
      const force = window.confirm('تعذّر حفظه في سلة المهملات (التخزين غير متاح أو ممتلئ).\nهل تريد حذفه نهائياً؟')
      if (!force) {
        setDeleting(false)
        return
      }
    }
    sfx.close()
    setPath(parentPath)
    removeNode(node.id)
    onNotice(
      saved
        ? `نُقل «${node.title}» إلى سلة المهملات، ويمكن استعادته من الإعدادات.`
        : `حُذف «${node.title}» نهائياً.`,
    )
  }

  return (
    <div
      className="overflow-hidden rounded-lg transition-shadow"
      style={{
        borderInlineStart: `3px solid ${color}`,
        background: open ? `linear-gradient(90deg, ${color}12, rgba(20,23,31,.78))` : 'rgba(20,23,31,.72)',
        boxShadow: open ? `0 0 0 1px ${color}55, 0 8px 24px ${color}22` : 'none',
      }}
    >
      <button
        aria-expanded={open}
        onClick={toggle}
        className={`flex w-full items-center justify-between gap-2 px-4 text-start ${
          depth === 0 ? 'py-3 text-lg font-semibold' : 'py-2 text-sm'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate" style={{ color: open ? color : undefined }}>{node.title}</span>
          {count > 0 && (
            <span className="rounded-full px-2 text-xs" style={{ background: color + '33', color }}>{count}</span>
          )}
          {active && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} aria-label="الفرع النشط" />
          )}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown size={18} /></motion.span>
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
            <div className="space-y-3 p-3">
              <Uploader nodeId={node.id} color={color} />

              <button
                onClick={() => { setSketch(s => !s); sfx.click() }}
                aria-pressed={sketch}
                className="flex items-center gap-1 rounded bg-white/10 px-2 py-1 text-sm hover:bg-white/20"
              >
                <Pencil size={14} />{sketch ? 'إخفاء لوحة الرسم' : 'لوحة رسم'}
              </button>
              {sketch && <Sketchpad nodeId={node.id} color={color} />}

              <Library nodeId={node.id} color={color} />

              {active && <NotesEditor key={node.id} nodeId={node.id} title={node.title} />}

              <div className="space-y-2 border-t border-white/10 pt-3">
                <AddForm
                  placeholder={`فرع جديد داخل «${node.title}»`}
                  color={color}
                  onSubmit={title => {
                    const id = addNode(node.id, title)
                    sfx.success()
                    setPath([...myPath, id])
                  }}
                />
                <button
                  onClick={() => { void handleDelete() }}
                  disabled={deleting}
                  className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 disabled:opacity-40"
                >
                  <Trash2 size={12} />{deleting ? 'جارٍ النقل…' : 'نقل هذا الفرع إلى سلة المهملات'}
                </button>
              </div>

              {node.children.length > 0 && (
                // الدرج: كل مستوى يُزاح درجة إضافية، وخط رابط بلون الأب يصل الفروع به
                <motion.div
                  initial={{ opacity: 0, paddingInlineStart: 0 }}
                  animate={{ opacity: 1, paddingInlineStart: 24 }}
                  exit={{ opacity: 0, paddingInlineStart: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="space-y-2"
                  style={{ borderInlineStart: `2px solid ${color}66`, marginInlineStart: 8 }}
                >
                  {node.children.map(ch => (
                    <div key={ch.id} className="relative">
                      <span
                        aria-hidden
                        style={{ position: 'absolute', insetInlineStart: -24, top: 20, width: 24, height: 2, background: color + '66' }}
                      />
                      <TreeNodeItem node={ch} parentPath={myPath} depth={depth + 1} onNotice={onNotice} />
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

/* ============ القائمة الجانبية (العمود الأيمن) ============ */
export default function TreeSidebar() {
  const { tree, setPath, addNode } = useTree()
  const [notice, setNotice] = useState('')

  // إشعار قصير يختفي وحده بعد 7 ثوانٍ
  useEffect(() => {
    if (!notice) return undefined
    const t = window.setTimeout(() => setNotice(''), 7000)
    return () => window.clearTimeout(t)
  }, [notice])

  return (
    <main
      className="space-y-3 py-6"
      style={{ width: 'min(44rem, 92vw)', marginLeft: 'auto', marginRight: 'clamp(8px, 5vw, 96px)' }}
    >
      <div className="glass rounded-lg p-3">
        <div className="mb-2 flex items-center gap-2 text-sm opacity-80">
          <FolderPlus size={16} />قسم رئيسي جديد
        </div>
        <AddForm
          placeholder="مثال: الجامعة، الأدعية، ملاحظات شخصية"
          color="var(--accent)"
          onSubmit={title => {
            const id = addNode(null, title)
            sfx.success()
            setPath([id])
          }}
        />
      </div>

      {notice && (
        <p role="status" className="glass rounded-lg px-3 py-2 text-sm" style={{ borderColor: 'var(--accent)' }}>
          {notice}
        </p>
      )}

      {/* شريط الأدوات: يفتح كل أداة في نافذة عائمة فوق الصفحة */}
      <div>
        <ToolsPanel />
      </div>

      {tree.length === 0 && (
        <p className="py-6 text-center text-sm opacity-60">لا توجد أقسام بعد. أضف قسمك الأول من الأعلى.</p>
      )}

      {tree.map(n => (
        <TreeNodeItem key={n.id} node={n} parentPath={[]} depth={0} onNotice={setNotice} />
      ))}
    </main>
  )
}
