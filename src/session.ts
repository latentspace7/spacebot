import { sessionSchema } from './contracts'
import type { ChatMessage, ConversationSnapshot, LeadIntakePhase, TranscriptRequest } from './types'

export const GREETING_ID = '00000000-0000-4000-8000-000000000001'
export const EMPTY_LEAD = { name: '', email: '', consent: false, submitted: false }

export function createSession(greeting: string): ConversationSnapshot {
  return { sessionId: crypto.randomUUID(), messages: [{ id: GREETING_ID, role: 'assistant', content: greeting }], phase: 'chat', lead: { ...EMPTY_LEAD } }
}

export function recoverInterruptedMessages(messages: ChatMessage[], text: string): ChatMessage[] {
  const last = messages.at(-1)
  if (last?.role !== 'assistant' || last.content.trim()) return messages
  return messages.map((entry, index) => index === messages.length - 1 ? { ...entry, content: text } : entry)
}

export function loadSession(key: string | undefined, greeting: string, interruptedMessage: string): ConversationSnapshot {
  try {
    const raw = key ? sessionStorage.getItem(key) : null
    if (raw) {
      const result = sessionSchema.safeParse(JSON.parse(raw))
      if (result.success) {
        const session = result.data
        if (session.phase === 'streaming') {
          session.messages = recoverInterruptedMessages(session.messages, interruptedMessage)
        }
        if (['streaming', 'submittingLead', 'ending'].includes(session.phase)) session.phase = 'chat'
        return session
      }
    }
  } catch { return createSession(greeting) }
  return createSession(greeting)
}

export function saveSession(key: string | undefined, session: ConversationSnapshot): void {
  if (!key) return
  try { sessionStorage.setItem(key, JSON.stringify(session)) } catch { return }
}

export function apiMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter((message) => message.kind !== 'lead' && message.id !== GREETING_ID && message.id !== 'spacy-greeting')
    .map(({ id, role, content }) => ({ id, role, content }))
}

export function transcriptRequest(session: ConversationSnapshot): TranscriptRequest {
  const contact = session.lead.name && session.lead.email ? { name: session.lead.name, email: session.lead.email } : {}
  return { sessionId: session.sessionId, transcript: session.messages.filter((message) => message.content.trim()).map(({ id, role, content }) => ({ id, role, content })), ...contact }
}

export function isLeadPhase(phase: string): phase is LeadIntakePhase {
  return ['confirmingLead', 'collectingName', 'collectingEmail'].includes(phase)
}
