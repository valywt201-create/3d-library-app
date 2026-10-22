import { getGoogleIdToken } from './googleAuth'
import { supabase } from './supabase'

export type StudyAction = 'summarize' | 'quiz' | 'answer'

export interface StudyAIRequest {
  action: StudyAction
  nodeTitle: string
  notes: string
  question?: string
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
  if (!googleIdToken) {
    throw new Error('جلسة Google الموثّقة غير متاحة في علامة التبويب الحالية. سجّل الخروج ثم ادخل مجدداً من زر الحساب.')
  }

  if (!supabase) {
    throw new Error('اتصال Supabase غير مضبوط. أضف VITE_SUPABASE_URL ومفتاح VITE_SUPABASE_PUBLISHABLE_KEY أو VITE_SUPABASE_ANON_KEY إلى ملف البيئة ثم أعد تشغيل Vite.')
  }

  const notes = request.notes.trim()
  const question = request.question?.trim() ?? ''
  if (notes.length > MAX_NOTE_CHARACTERS) {
    throw new Error(`الملاحظات طويلة جداً لهذا الطلب؛ الحد الأقصى ${MAX_NOTE_CHARACTERS.toLocaleString('ar')} حرف.`)
  }
  if (request.action !== 'answer' && !notes) {
    throw new Error('أضف ملاحظات إلى هذا القسم قبل تلخيصها أو إنشاء اختبار.')
  }
  if (request.action === 'answer' && (!question || question.length > MAX_QUESTION_CHARACTERS)) {
    throw new Error(`اكتب سؤالاً لا يتجاوز ${MAX_QUESTION_CHARACTERS.toLocaleString('ar')} حرف.`)
  }

  const { data, error } = await supabase.functions.invoke<StudyAIResponse>('notes-ai', {
    body: {
      action: request.action,
      nodeTitle: request.nodeTitle,
      notes,
      question,
    },
    headers: {
      Authorization: `Bearer ${googleIdToken}`,
    },
  })

  if (error) {
    const serverMessage = await getServerErrorMessage(error)
    throw new Error(serverMessage ?? 'تعذّر الاتصال بمساعد الدراسة. تحقق من نشر وظيفة notes-ai وضبط أسرار Supabase، ثم حاول مجدداً.')
  }

  if (!data || typeof data.answer !== 'string' || !data.answer.trim()) {
    const message = typeof data?.error === 'string' ? data.error : ''
    throw new Error(message || 'لم تصل إجابة صالحة من مساعد الدراسة.')
  }

  return data.answer.trim()
}
