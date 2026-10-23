import { getGoogleIdToken } from './googleAuth'
import type { Locale } from './i18n'
import { supabase } from './supabase'

export type StudyAction = 'summarize' | 'quiz' | 'answer' | 'theme'

export interface StudyAIRequest {
  action: StudyAction
  nodeTitle: string
  notes: string
  question?: string
  language?: Locale
}

interface StudyAIResponse {
  answer?: unknown
  error?: unknown
}

const MAX_NOTE_CHARACTERS = 16_000
const MAX_QUESTION_CHARACTERS = 1_200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function getServerErrorMessage(error: unknown): Promise<string | null> {
  if (!isRecord(error) || !(error.context instanceof Response)) return null
  try {
    const responseBody: unknown = await error.context.clone().json()
    return isRecord(responseBody) && typeof responseBody.error === 'string' ? responseBody.error : null
  } catch {
    return null
  }
}

export async function requestStudyAI(request: StudyAIRequest): Promise<string> {
  const googleIdToken = getGoogleIdToken()
  if (!googleIdToken) throw new Error('Sign in or reconnect your Google account to continue.')
  if (!supabase) throw new Error('Study tools are getting ready. Please try again soon.')

  const notes = request.notes.trim()
  const question = request.question?.trim() ?? ''
  if (request.action !== 'theme' && notes.length > MAX_NOTE_CHARACTERS) {
    throw new Error('Choose a focused passage to work with.')
  }
  if (request.action !== 'answer' && request.action !== 'theme' && !notes) {
    throw new Error('Add some notes to this section to get started.')
  }
  if (request.action === 'answer' && !question) {
    throw new Error('What would you like to explore?')
  }
  if (request.action === 'answer' && question.length > MAX_QUESTION_CHARACTERS) {
    throw new Error('Could you make your question a little more focused?')
  }

  const { data, error } = await supabase.functions.invoke<StudyAIResponse>('notes-ai', {
    body: {
      action: request.action,
      nodeTitle: request.nodeTitle,
      notes,
      question,
      language: request.language ?? 'en',
    },
    headers: { Authorization: `Bearer ${googleIdToken}` },
  })

  if (error) {
    const serverMessage = await getServerErrorMessage(error)
    throw new Error(serverMessage ?? 'Something interrupted the request. Please try again.')
  }
  if (!data || typeof data.answer !== 'string' || !data.answer.trim()) {
    const message = typeof data?.error === 'string' ? data.error : ''
    throw new Error(message || 'No response came through this time. Please try again.')
  }
  return data.answer.trim()
}
