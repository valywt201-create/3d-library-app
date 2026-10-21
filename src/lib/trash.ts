import { useSyncExternalStore } from 'react'
import type { Item, TNode } from '../shared'
import { TRASH_RETENTION_DAYS } from './settings'

/* ============ الأنواع ============ */
export const DAY_MS = 86_400_000

export interface TrashFile {
  nodeId: string          // الفرع الذي كان الملف فيه
  name: string
  kind: Item['kind']
  size: number
  file: File
}

export interface TrashEntry {
  id: string
  title: string           // اسم الفرع المحذوف
  node: TNode             // الفرع بكل فروعه الفرعية
  parentId: string | null // أبوه الأصلي (null = قسم رئيسي)
  index: number           // ترتيبه بين إخوته، لإعادته إلى مكانه بالضبط
  deletedAt: number
  expiresAt: number       // بعد هذا الوقت يُحذف نهائياً
  files: TrashFile[]
}

export interface MoveToTrashInput {
  node: TNode
  parentId: string | null
  index: number
  files: TrashFile[]
}

interface TrashState {
  entries: TrashEntry[]
  ready: boolean          // true بعد قراءة السلة المحفوظة
  error: string           // رسالة إن كان التخزين الدائم غير متاح
}

/* ============ دوال مساعدة عامة ============ */
export const collectNodeIds = (n: TNode): string[] => [n.id, ...n.children.flatMap(collectNodeIds)]

export const daysLeft = (e: TrashEntry, now: number = Date.now()): number =>
  Math.max(0, Math.ceil((e.expiresAt - now) / DAY_MS))

/* ============ قاعدة IndexedDB مستقلة للسلة ============ */
const DB_NAME = 'atelier-trash'
const STORE = 'entries'
let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((res, rej) => {
      if (typeof indexedDB === 'undefined') {
        rej(new Error('IndexedDB غير متاح'))
        return
      }
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => db.close()
        res(db)
      }
      req.onerror = () => rej(req.error ?? new Error('تعذّر فتح قاعدة السلة'))
    })
    dbPromise.catch(() => { dbPromise = null }) // نسمح بمحاولة جديدة لاحقاً
  }
  return dbPromise
}

async function idbGetAll(): Promise<TrashEntry[]> {
  const db = await openDB()
  return new Promise<TrashEntry[]>((res, rej) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    r.onsuccess = () => res(r.result as TrashEntry[])
    r.onerror = () => rej(r.error)
  })
}

async function idbPut(entry: TrashEntry): Promise<void> {
  const db = await openDB()
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => res()
    tx.onerror = tx.onabort = () => rej(tx.error) // الحصة الممتلئة تظهر هنا
  })
}

async function idbDelete(ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await openDB()
  return new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    ids.forEach(id => tx.objectStore(STORE).delete(id))
    tx.oncomplete = () => res()
    tx.onerror = tx.onabort = () => rej(tx.error)
  })
}

/* ============ المتجر (يُقرأ من أي مكوّن عبر useTrash) ============ */
let state: TrashState = { entries: [], ready: false, error: '' }
const listeners = new Set<() => void>()

function setState(next: TrashState): void {
  state = next // نستبدل الكائن كاملاً ليبقى snapshot ثابتاً بين التغييرات
  listeners.forEach(l => l())
}

const isEntry = (e: unknown): e is TrashEntry => {
  const x = e as Partial<TrashEntry> | null
  return !!x && typeof x.id === 'string' && typeof x.title === 'string' && !!x.node &&
    Array.isArray(x.files) && typeof x.expiresAt === 'number' && typeof x.deletedAt === 'number'
}

// يحذف نهائياً كل عنصر انتهت مدته
async function purgeExpired(): Promise<void> {
  const now = Date.now()
  const gone = state.entries.filter(e => e.expiresAt <= now).map(e => e.id)
  if (!gone.length) return
  try { await idbDelete(gone) } catch { return }
  const set = new Set(gone)
  setState({ ...state, entries: state.entries.filter(e => !set.has(e.id)) })
}

const initPromise: Promise<void> = (async () => {
  try {
    const all = (await idbGetAll()).filter(isEntry).sort((a, b) => b.deletedAt - a.deletedAt)
    setState({ entries: all, ready: true, error: '' })
    await purgeExpired()
  } catch {
    setState({ entries: [], ready: true, error: 'التخزين الدائم غير متاح في هذا المتصفح أو الوضع، لن تعمل سلة المهملات.' })
  }
})()

// فحص دوري كل ساعة أثناء بقاء التطبيق مفتوحاً
if (typeof window !== 'undefined') window.setInterval(() => { void purgeExpired() }, 3_600_000)

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}
const getSnapshot = (): TrashState => state

export function useTrash(): TrashState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

/* ============ العمليات ============ */
// ينقل فرعاً (وملفاته) إلى السلة. يعيد false إن تعذّر الحفظ (ولا يُحذف شيء حينها)
export async function moveToTrash(input: MoveToTrashInput): Promise<boolean> {
  await initPromise
  if (state.error) return false
  const now = Date.now()
  const entry: TrashEntry = {
    id: crypto.randomUUID(),
    title: input.node.title,
    node: input.node,
    parentId: input.parentId,
    index: input.index,
    deletedAt: now,
    expiresAt: now + TRASH_RETENTION_DAYS * DAY_MS,
    files: input.files,
  }
  try { await idbPut(entry) } catch { return false }
  setState({ ...state, entries: [entry, ...state.entries] })
  return true
}

// حذف نهائي لعنصر واحد
export async function removeFromTrash(id: string): Promise<boolean> {
  await initPromise
  try { await idbDelete([id]) } catch { return false }
  setState({ ...state, entries: state.entries.filter(e => e.id !== id) })
  return true
}

// إفراغ السلة بالكامل
export async function emptyTrash(): Promise<boolean> {
  await initPromise
  try { await idbDelete(state.entries.map(e => e.id)) } catch { return false }
  setState({ ...state, entries: [] })
  return true
}