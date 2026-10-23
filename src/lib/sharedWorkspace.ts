import { useSyncExternalStore } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { SharedNote, SharedWorkspaceCredentials } from './libraryApi'
import { supabase } from './supabase'

const STORAGE_KEY = 'atelier-shared-workspace-v1'
const listeners = new Set<() => void>()
const noteListeners = new Set<(note: SharedNote) => void>()

export interface SharedWorkspace extends SharedWorkspaceCredentials {}

function isWorkspace(value: unknown): value is SharedWorkspace {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.workspaceId === 'string' && typeof record.accessToken === 'string' &&
    /^[0-9a-f-]{36}$/i.test(record.workspaceId) && record.accessToken.length >= 32
}

function readWorkspace(): SharedWorkspace | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isWorkspace(parsed) ? parsed : null
  } catch {
    return null
  }
}

let workspace: SharedWorkspace | null = typeof window === 'undefined' ? null : readWorkspace()
let channel: RealtimeChannel | null = null
let channelWorkspaceId = ''
let channelReady: Promise<RealtimeChannel> | null = null

function emit(): void {
  listeners.forEach(listener => listener())
}

function stopChannel(): void {
  if (channel && supabase) void supabase.removeChannel(channel)
  channel = null
  channelWorkspaceId = ''
  channelReady = null
}

function setWorkspace(next: SharedWorkspace | null): void {
  if (workspace?.workspaceId !== next?.workspaceId || workspace?.accessToken !== next?.accessToken) {
    stopChannel()
  }
  workspace = next
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // تظل المشاركة متاحة في الجلسة الحالية حتى إن تعذر التخزين المحلي.
  }
  emit()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', event => {
    if (event.key !== STORAGE_KEY) return
    stopChannel()
    workspace = readWorkspace()
    emit()
  })
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = (): SharedWorkspace | null => workspace

export function useSharedWorkspace(): SharedWorkspace | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

export function activateWorkspace(next: SharedWorkspace): void {
  if (isWorkspace(next)) setWorkspace(next)
}

export function leaveSharedWorkspace(): void {
  setWorkspace(null)
}

export function activateWorkspaceFromInvite(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  const workspaceId = url.searchParams.get('workspace') ?? ''
  const params = new URLSearchParams(url.hash.replace(/^#/, ''))
  const accessToken = params.get('access') ?? ''
  const invitation: SharedWorkspace = { workspaceId, accessToken }
  if (!isWorkspace(invitation)) return

  setWorkspace(invitation)
  url.searchParams.delete('workspace')
  url.hash = ''
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`)
}

export function createWorkspaceInvite(workspaceValue: SharedWorkspace): string {
  const url = new URL(window.location.href)
  url.searchParams.set('workspace', workspaceValue.workspaceId)
  url.hash = new URLSearchParams({ access: workspaceValue.accessToken }).toString()
  return url.toString()
}

function ensureChannel(workspaceValue: SharedWorkspace): Promise<RealtimeChannel> {
  if (!supabase) return Promise.reject(new Error('Realtime is not configured.'))
  if (channel && channelWorkspaceId === workspaceValue.workspaceId && channelReady) return channelReady

  stopChannel()
  const nextChannel = supabase.channel(`library-live:${workspaceValue.workspaceId}`, {
    config: { broadcast: { ack: true, self: false } },
  })
  nextChannel.on('broadcast', { event: 'note-updated' }, event => {
    const note = event.payload
    if (!isSharedNote(note)) return
    noteListeners.forEach(listener => listener(note))
  })

  channel = nextChannel
  channelWorkspaceId = workspaceValue.workspaceId
  channelReady = new Promise<RealtimeChannel>((resolve, reject) => {
    nextChannel.subscribe(status => {
      if (status === 'SUBSCRIBED') resolve(nextChannel)
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        reject(new Error('Realtime connection is unavailable.'))
      }
    })
  })
  return channelReady
}

export function subscribeToSharedNotes(listener: (note: SharedNote) => void): () => void {
  const currentWorkspace = workspace
  if (!currentWorkspace || !supabase) return () => undefined

  noteListeners.add(listener)
  void ensureChannel(currentWorkspace).catch(() => undefined)
  return () => {
    noteListeners.delete(listener)
    if (noteListeners.size === 0) stopChannel()
  }
}

export async function broadcastSharedNote(note: SharedNote): Promise<void> {
  const currentWorkspace = workspace
  if (!currentWorkspace) return
  const activeChannel = await ensureChannel(currentWorkspace)
  const result = await activeChannel.send({ type: 'broadcast', event: 'note-updated', payload: note })
  if (result !== 'ok') throw new Error('The live update could not be sent.')
}

function isSharedNote(value: unknown): value is SharedNote {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return typeof record.nodeKey === 'string' && typeof record.title === 'string' &&
    typeof record.html === 'string' && typeof record.updatedAt === 'number' && Number.isFinite(record.updatedAt)
}
