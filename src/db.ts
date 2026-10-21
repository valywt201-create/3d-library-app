/* ============ طبقة IndexedDB للملفات (بدون مكتبات خارجية) ============ */
const DB_NAME = 'atelier-library'
const STORE = 'items'

// السجل المحفوظ لكل ملف: الملف نفسه (File) مع بياناته
export interface StoredItem {
  id: string
  nodeId: string
  name: string
  kind: 'image' | 'audio' | 'doc' | 'drawing'
  size: number
  file: File
  createdAt: number // لاستعادة ترتيب الإضافة الأصلي
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((res, rej) => {
      if (typeof indexedDB === 'undefined') return rej(new Error('IndexedDB غير متاح'))
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
      }
      req.onsuccess = () => {
        const db = req.result
        db.onversionchange = () => db.close() // يسمح بتحديث القاعدة من تبويب آخر
        res(db)
      }
      req.onerror = () => rej(req.error ?? new Error('تعذّر فتح قاعدة البيانات'))
    })
    dbPromise.catch(() => { dbPromise = null }) // نسمح بمحاولة جديدة لاحقاً
  }
  return dbPromise
}

export async function dbGetAll(): Promise<StoredItem[]> {
  const db = await openDB()
  return new Promise((res, rej) => {
    const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    r.onsuccess = () => res(r.result as StoredItem[])
    r.onerror = () => rej(r.error)
  })
}

export async function dbPut(rec: StoredItem): Promise<void> {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(rec)
    tx.oncomplete = () => res()
    tx.onerror = tx.onabort = () => rej(tx.error) // الحصة الممتلئة تظهر هنا كـ QuotaExceededError
  })
}

export async function dbDelete(ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    ids.forEach(id => tx.objectStore(STORE).delete(id))
    tx.oncomplete = () => res()
    tx.onerror = tx.onabort = () => rej(tx.error)
  })
}