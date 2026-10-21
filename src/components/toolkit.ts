import { useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { PALETTE, findNode } from '../shared'
import type { TNode } from '../shared'

/* ============ الأنماط المشتركة (زجاج داكن + بنفسجي) ============ */
export const ACCENT = '#a78bfa'
export const panel = 'rounded-xl border border-white/10 bg-white/[0.04] backdrop-blur-md'
export const btn = 'rounded-lg bg-white/10 px-3 py-1.5 text-sm transition hover:bg-white/20 active:scale-95'
export const field = 'rounded-lg bg-white/10 px-3 py-1.5 text-sm outline-none transition focus:ring-1 focus:ring-[#a78bfa]'

/* ============ الذكاء الاصطناعي (اختياري) ============ */
// رابط خادمك الوسيط الذي يحتفظ بمفتاح النموذج. يستقبل { task, prompt } ويعيد { answer }.
// لا تضع مفتاح النموذج داخل كود المتصفح أبداً.
export const AI_ENDPOINT: string = ''
export const hasAI = () => AI_ENDPOINT !== ''
export async function askAI(task: string, prompt: string): Promise<string> {
  if (!AI_ENDPOINT) throw new Error('ضع رابط الخادم في AI_ENDPOINT داخل src/components/toolkit.ts')
  const r = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task, prompt }),
  })
  if (!r.ok) throw new Error(`فشل الاتصال بخدمة الذكاء الاصطناعي (${r.status})`)
  return String((await r.json()).answer ?? '')
}

/* ============ مساعدات الشجرة ============ */
export interface FlatNode { id: string; label: string; ci: number }
export function flattenTree(nodes: TNode[], depth = 0): FlatNode[] {
  return nodes.flatMap(n => [{ id: n.id, label: '— '.repeat(depth) + n.title, ci: n.ci }, ...flattenTree(n.children, depth + 1)])
}
export const colorOf = (ci: number) => PALETTE[ci % PALETTE.length]
// معرّف الفرع وكل فروعه التابعة
export function subtreeIds(tree: TNode[], id: string): string[] {
  const walk = (n: TNode): string[] => [n.id, ...n.children.flatMap(walk)]
  const n = findNode(tree, id)
  return n ? walk(n) : []
}

/* ============ تنزيل ونسخ ============ */
export function download(name: string, text: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export const copy = (t: string) => navigator.clipboard?.writeText(t).catch(() => { /* تجاهل */ })

/* ============ حالة محفوظة في localStorage (كتابة مؤجلة 300ms) ============ */
export function usePersisted<T>(key: string, init: T): [T, Dispatch<SetStateAction<T>>] {
  const [v, setV] = useState<T>(() => {
    try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : init } catch { return init }
  })
  const latest = useRef(v)
  latest.current = v
  const write = () => { try { localStorage.setItem(key, JSON.stringify(latest.current)) } catch { /* تجاهل */ } }
  useEffect(() => { const t = setTimeout(write, 300); return () => clearTimeout(t) }, [v]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => write, []) // eslint-disable-line react-hooks/exhaustive-deps -- نكتب آخر قيمة عند إغلاق الأداة
  return [v, setV]
}