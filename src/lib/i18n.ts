import { useSyncExternalStore } from 'react'

export type Locale = 'en' | 'ar'
export type TextDirection = 'ltr' | 'rtl'

const STORAGE_KEY = 'atelier-locale-v1'
const listeners = new Set<() => void>()

function readLocale(): Locale {
  if (typeof window === 'undefined') return 'ar'
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar'
  } catch {
    return 'ar'
  }
}

let locale: Locale = readLocale()

function applyLocale(value: Locale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = value
  document.documentElement.dir = value === 'ar' ? 'rtl' : 'ltr'
}

applyLocale(locale)

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return
    locale = readLocale()
    applyLocale(locale)
    listeners.forEach(listener => listener())
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): Locale => locale

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'ar')
}

export function setLocale(next: Locale): void {
  if (locale === next) return
  locale = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // يظل التبديل فعالاً حتى إن تعذر التخزين المحلي.
  }
  applyLocale(next)
  listeners.forEach(listener => listener())
}

export function directionOf(value: Locale): TextDirection {
  return value === 'ar' ? 'rtl' : 'ltr'
}

export function tr(value: Locale, english: string, arabic: string): string {
  return value === 'ar' ? arabic : english
}
