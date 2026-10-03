import { useCallback, useEffect, useRef, useState } from 'react'
import { deliverySchema, leadIntakeSchema, streamEventSchema } from './contracts'
import { apiMessages, createSession, EMPTY_LEAD, isLeadPhase, loadSession, recoverInterruptedMessages, saveSession, transcriptRequest } from './session'
import { SpacebotError } from './transport'
import type { ChatMessage, ChatStreamEvent, ConversationSnapshot, SpacebotCopy, SpacebotEvent, SpacebotProps } from './types'

type ConversationOptions = SpacebotProps & { greeting: string; resolvedCopy: SpacebotCopy }

function message(role: ChatMessage['role'], content: string, kind: 'chat' | 'lead' = 'chat'): ChatMessage {
  return { id: crypto.randomUUID(), role, content, kind }
}

export function useConversation(options: ConversationOptions) {
  const [initial] = useState(() => ({ greeting: options.greeting, interruptedMessage: options.resolvedCopy.interruptedMessage, key: options.storage === false ? undefined : options.storage?.key ?? 'spacebot-session-v1' }))
  const [session, setSession] = useState<ConversationSnapshot | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [endFailed, setEndFailed] = useState(false)
  const sessionRef = useRef<ConversationSnapshot | null>(null)
  const optionsRef = useRef(options)
  const controllerRef = useRef<AbortController | null>(null)
  const mounted = useRef(false)
  const requestRef = useRef(0)

  useEffect(() => { optionsRef.current = options }, [options])

  const emit = useCallback((event: SpacebotEvent): void => {
    try {
      const result = optionsRef.current.onEvent?.(structuredClone(event))
      if (result) void Promise.resolve(result).catch(() => undefined)
    } catch { return }
  }, [])

  const commit = useCallback((next: ConversationSnapshot): void => {
    if (!mounted.current) return
    sessionRef.current = next
    saveSession(initial.key, next)
    setSession(next)
    emit({ type: 'conversation.updated', conversation: next })
  }, [initial.key, emit])

  useEffect(() => {
    mounted.current = true
    let active = true
    queueMicrotask(() => {
      if (active) commit(loadSession(initial.key, initial.greeting, initial.interruptedMessage))
    })
    return () => {
      active = false
      mounted.current = false
      requestRef.current += 1
      controllerRef.current?.abort()
    }
  }, [initial, commit])

  useEffect(() => {
    const onPageHide = (): void => {
      const current = sessionRef.current
      const { transport, transcriptPolicy } = optionsRef.current
      if (!current || !transcriptPolicy?.onPageHide || (transcriptPolicy.requireConsent && !current.lead.consent)) return
      if (!current.messages.some((entry) => entry.role === 'user')) return
      try {
        if (transport.queueTranscript?.(transcriptRequest(current)) === 'queued') emit({ type: 'transcript.queued', conversation: current })
      } catch { return }
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [emit])

  const cancel = (): void => {
    requestRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    setBusy(false)
  }

  const begin = (): { controller: AbortController; currentRequest: number } => {
    cancel()
    const controller = new AbortController()
    controllerRef.current = controller
    setBusy(true)
    setError('')
    return { controller, currentRequest: requestRef.current }
  }

  const isCurrent = (id: number, controller: AbortController): boolean => mounted.current && requestRef.current === id && !controller.signal.aborted

  const fail = (cause: unknown, operation: 'chat' | 'lead' | 'transcript', current: ConversationSnapshot): void => {
    const code = cause instanceof SpacebotError ? cause.code : 'REQUEST_FAILED'
    const text = operation === 'transcript' ? options.resolvedCopy.deliveryError : cause instanceof SpacebotError ? cause.message : options.resolvedCopy.unavailableMessage
    setError(text)
    emit({ type: 'error', operation, code, message: text, conversation: current })
  }

  const remaining = (current: ConversationSnapshot): number => {
    const local = options.maxUserTurns === undefined ? Infinity : Math.max(0, options.maxUserTurns - apiMessages(current.messages).filter((entry) => entry.role === 'user').length)
    return Math.min(local, current.remainingTurns ?? Infinity)
  }
  const leadEnabled = Boolean(options.transport.leadIntake && options.transport.submitLead)

  const startLead = (): void => {
    const current = sessionRef.current
    if (!current || controllerRef.current || !leadEnabled || current.lead.submitted || isLeadPhase(current.phase) || ['restricted', 'sent', 'declined'].includes(current.phase)) return
    setDraft('')
    setError('')
    commit({ ...current, phase: 'confirmingLead', messages: [...current.messages, message('assistant', options.resolvedCopy.consentPrompt, 'lead')] })
  }

  const send = async (): Promise<void> => {
    const current = sessionRef.current
    const text = draft.trim()
    if (!current || !text || controllerRef.current || ['restricted', 'sent', 'declined', 'ending'].includes(current.phase)) return
    if (!isLeadPhase(current.phase) && remaining(current) === 0) { startLead(); return }
    const { controller, currentRequest } = begin()
    const active = (): boolean => isCurrent(currentRequest, controller)
    const leadPhase = isLeadPhase(current.phase) ? current.phase : null
    const userMessage = message('user', text, leadPhase ? 'lead' : 'chat')
    setDraft('')
    try {
      if (leadPhase && options.transport.leadIntake && options.transport.submitLead) {
        const result = leadIntakeSchema.parse(await options.transport.leadIntake({ sessionId: current.sessionId, messageId: userMessage.id, phase: leadPhase, message: text, ...(current.lead.name ? { name: current.lead.name } : {}) }, { signal: controller.signal }))
        if (!active()) return
        const progressed = ['affirms', 'provides_name', 'provides_email', 'provides_both'].includes(result.intent)
        const lead = { ...current.lead, name: result.name ?? current.lead.name, email: result.email ?? current.lead.email, consent: progressed || current.lead.consent }
        if (result.intent === 'declines') {
          commit({ ...current, phase: remaining(current) > 0 ? 'chat' : 'declined', lead: { ...EMPTY_LEAD }, messages: [...current.messages, userMessage, message('assistant', result.reply, 'lead')] })
        } else if (lead.consent && lead.name && lead.email) {
          const pending = { ...current, lead, phase: 'submittingLead' as const, messages: [...current.messages, userMessage] }
          commit(pending)
          const delivery = await options.transport.submitLead({ ...transcriptRequest(pending), name: lead.name, email: lead.email, consent: true }, { signal: controller.signal })
          deliverySchema.parse(delivery)
          if (!active()) return
          const canContinue = remaining(current) > 0
          const sent: ConversationSnapshot = { ...pending, phase: canContinue ? 'chat' : 'sent', lead: { ...lead, submitted: true }, messages: [...pending.messages, message('assistant', options.resolvedCopy.leadSuccess(lead.name, canContinue), 'lead')] }
          commit(sent)
          emit({ type: 'lead.submitted', conversation: sent })
        } else {
          commit({ ...current, lead, phase: progressed ? (lead.name ? 'collectingEmail' : 'collectingName') : leadPhase, messages: [...current.messages, userMessage, message('assistant', result.reply, 'lead')] })
        }
      } else {
        const assistant = message('assistant', '')
        commit({ ...current, phase: 'streaming', messages: [...current.messages, userMessage, assistant] })
        let complete = false
        const onEvent = (input: ChatStreamEvent): void => {
          if (!active() || complete) return
          const event = streamEventSchema.parse(input)
          const latest = sessionRef.current
          if (!latest) return
          if (event.type === 'error') throw new SpacebotError(event.code, event.message)
          if (event.type === 'delta' || event.type === 'replace') {
            commit({ ...latest, messages: latest.messages.map((entry) => entry.id === assistant.id ? { ...entry, content: event.type === 'replace' ? event.text : entry.content + event.text } : entry) })
          } else if (event.type === 'meta') {
            if (event.remainingTurns !== undefined) commit({ ...latest, remainingTurns: event.remainingTurns })
          } else if (event.type === 'done') {
            complete = true
            const next: ConversationSnapshot = { ...latest, phase: event.restricted ? 'restricted' : 'chat', ...(event.remainingTurns === undefined ? {} : { remainingTurns: event.remainingTurns }) }
            if (!event.restricted && !next.lead.submitted && leadEnabled && (event.leadRequired || remaining(next) === 0)) {
              next.phase = 'confirmingLead'
              if (!event.leadRequired) next.messages = [...next.messages, message('assistant', options.resolvedCopy.consentPrompt, 'lead')]
            }
            commit(next)
            const completedMessage = next.messages.find((entry) => entry.id === assistant.id)
            if (completedMessage) emit({ type: 'message.completed', conversation: next, message: completedMessage })
          }
        }
        await options.transport.chat({ sessionId: current.sessionId, messageId: userMessage.id, message: text, history: apiMessages(current.messages), leadSubmitted: current.lead.submitted }, { signal: controller.signal, onEvent })
        if (active() && !complete) throw new SpacebotError('INCOMPLETE_STREAM', 'The response was interrupted. Please try again.')
      }
    } catch (cause) {
      if (!active()) return
      const restricted = cause instanceof SpacebotError && cause.code === 'SESSION_RESTRICTED'
      const restored: ConversationSnapshot = { ...current, phase: restricted ? 'restricted' : leadPhase ?? 'error' }
      commit(restored)
      setDraft(text)
      fail(cause, leadPhase ? 'lead' : 'chat', restored)
    } finally {
      if (active()) { controllerRef.current = null; setBusy(false) }
    }
  }

  const end = async (): Promise<boolean> => {
    const current = sessionRef.current
    if (!current || current.phase === 'submittingLead' || current.phase === 'ending') return false
    const { controller, currentRequest } = begin()
    const active = (): boolean => isCurrent(currentRequest, controller)
    const resting: ConversationSnapshot = { ...current, phase: current.phase === 'streaming' ? 'chat' : current.phase, messages: current.phase === 'streaming' ? recoverInterruptedMessages(current.messages, options.resolvedCopy.interruptedMessage) : current.messages }
    commit({ ...resting, phase: 'ending' })
    try {
      const policy = options.transcriptPolicy
      const shouldSend = policy?.onEnd && (!policy.requireConsent || current.lead.consent) && current.messages.some((entry) => entry.role === 'user')
      if (shouldSend) {
        if (!options.transport.submitTranscript) throw new SpacebotError('MISSING_TRANSPORT', options.resolvedCopy.deliveryError)
        deliverySchema.parse(await options.transport.submitTranscript(transcriptRequest(current), { signal: controller.signal }))
        if (!active()) return false
        emit({ type: 'transcript.delivered', conversation: resting })
      }
      if (!active()) return false
      emit({ type: 'conversation.ended', conversation: resting })
      commit(createSession(options.greeting))
      setDraft('')
      setError('')
      setEndFailed(false)
      return true
    } catch (cause) {
      if (active()) { commit(resting); setEndFailed(true); fail(cause, 'transcript', resting) }
      return false
    } finally {
      if (active()) { controllerRef.current = null; setBusy(false) }
    }
  }

  return { session, draft, setDraft, error, busy, endFailed, send, end, startLead, leadEnabled, remainingTurns: session ? remaining(session) : Infinity }
}
