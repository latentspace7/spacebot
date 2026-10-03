import { deliverySchema, leadIntakeSchema, streamEventSchema } from './contracts'
import type { ChatMessage, ChatStreamEvent, SpacebotTransport, TranscriptRequest } from './types'

export class SpacebotError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = 'SpacebotError' }
}

export type HttpTransportOptions = {
  endpoints: { chat: string; leadIntake?: string; leads?: string; transcripts?: string }
  headers?: HeadersInit | (() => HeadersInit | Promise<HeadersInit>)
  credentials?: RequestCredentials
  fetch?: typeof globalThis.fetch
}

export async function consumeChatStream(stream: ReadableStream<Uint8Array>, onEvent: (event: ChatStreamEvent) => void, signal?: AbortSignal): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let complete = false
  const cancel = (): void => { void reader.cancel().catch(() => undefined) }
  const consume = (frame: string): void => {
    const data = frame.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
    if (!data) return
    let event: ChatStreamEvent
    try { event = streamEventSchema.parse(JSON.parse(data)) } catch { throw new SpacebotError('INVALID_STREAM', 'The service returned an invalid chat event.') }
    if (event.type === 'error') throw new SpacebotError(event.code, event.message)
    onEvent(event)
    if (event.type === 'done') complete = true
  }
  signal?.addEventListener('abort', cancel, { once: true })
  try {
    signal?.throwIfAborted()
    while (!complete) {
      const { value, done } = await reader.read()
      signal?.throwIfAborted()
      buffer += decoder.decode(value, { stream: !done })
      if (buffer.length > 1_000_000) throw new SpacebotError('INVALID_STREAM', 'The chat event is too large.')
      let boundary: RegExpExecArray | null
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const frame = buffer.slice(0, boundary.index)
        buffer = buffer.slice(boundary.index + boundary[0].length)
        consume(frame)
        if (complete) break
      }
      if (done) {
        if (!complete && buffer.trim()) consume(buffer)
        break
      }
    }
    if (!complete) throw new SpacebotError('INCOMPLETE_STREAM', 'The response was interrupted. Please try again.')
  } finally {
    signal?.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function messagesOnly(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(({ id, role, content }) => ({ id, role, content }))
}

function transcriptBody(request: TranscriptRequest): TranscriptRequest {
  return { sessionId: request.sessionId, transcript: messagesOnly(request.transcript), ...(request.name ? { name: request.name } : {}), ...(request.email ? { email: request.email } : {}) }
}

export function createHttpTransport(options: HttpTransportOptions): SpacebotTransport {
  const requestFetch: typeof fetch = (...args) => (options.fetch ?? globalThis.fetch)(...args)
  const headers = async (): Promise<Headers> => {
    const result = new Headers(typeof options.headers === 'function' ? await options.headers() : options.headers)
    result.set('Content-Type', 'application/json')
    return result
  }
  const post = async (url: string, body: unknown, signal: AbortSignal): Promise<Response> => {
    const response = await requestFetch(url, { method: 'POST', headers: await headers(), credentials: options.credentials ?? 'same-origin', body: JSON.stringify(body), signal })
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null)
      const error = typeof payload === 'object' && payload !== null ? payload : {}
      const code = 'code' in error && typeof error.code === 'string' ? error.code : `HTTP_${response.status}`
      const message = 'message' in error && typeof error.message === 'string' ? error.message : 'The service could not process this request.'
      throw new SpacebotError(code, message)
    }
    return response
  }
  const json = async (response: Response): Promise<unknown> => {
    try { return await response.json() } catch { throw new SpacebotError('INVALID_RESPONSE', 'The service returned an invalid response.') }
  }
  const transport: SpacebotTransport = {
    async chat(request, { signal, onEvent }) {
      const response = await post(options.endpoints.chat, { sessionId: request.sessionId, messageId: request.messageId, message: request.message, history: messagesOnly(request.history), ...(request.leadSubmitted === undefined ? {} : { leadSubmitted: request.leadSubmitted }) }, signal)
      if (!response.body) throw new SpacebotError('MISSING_STREAM', 'Streaming is not supported by this service.')
      await consumeChatStream(response.body, onEvent, signal)
    },
  }
  const { leadIntake, leads, transcripts } = options.endpoints
  if (leadIntake) transport.leadIntake = async (request, { signal }) => leadIntakeSchema.parse(await json(await post(leadIntake, { sessionId: request.sessionId, messageId: request.messageId, phase: request.phase, message: request.message, ...(request.name ? { name: request.name } : {}) }, signal)))
  if (leads) transport.submitLead = async (request, { signal }) => deliverySchema.parse(await json(await post(leads, { ...transcriptBody(request), name: request.name, email: request.email, consent: request.consent }, signal)))
  if (transcripts) {
    transport.submitTranscript = async (request, { signal }) => deliverySchema.parse(await json(await post(transcripts, transcriptBody(request), signal)))
    transport.queueTranscript = (request) => {
      const body = JSON.stringify(transcriptBody(request))
      if (new Blob([body]).size > 60_000) return 'unavailable'
      try {
        const sameOrigin = typeof location !== 'undefined' && new URL(transcripts, location.href).origin === location.origin
        if (sameOrigin && !options.headers && !options.fetch && options.credentials !== 'omit' && typeof navigator !== 'undefined' && navigator.sendBeacon?.(transcripts, new Blob([body], { type: 'application/json' }))) return 'queued'
        if (typeof options.headers === 'function') return 'unavailable'
        const requestHeaders = new Headers(options.headers)
        requestHeaders.set('Content-Type', 'application/json')
        void requestFetch(transcripts, { method: 'POST', headers: requestHeaders, credentials: options.credentials ?? 'same-origin', body, keepalive: true }).catch(() => undefined)
        return 'queued'
      } catch { return 'unavailable' }
    }
  }
  return transport
}
