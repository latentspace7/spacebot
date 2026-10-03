import { describe, expect, it, vi } from 'vitest'
import { consumeChatStream, createHttpTransport } from '../src/transport'

function stream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close() } })
}

describe('stream protocol', () => {
  it('handles fragmented CRLF frames, comments, unicode and a final frame without a delimiter', async () => {
    const events = vi.fn()
    await consumeChatStream(stream([': heartbeat\r\n\r\ndata: {"type":"del', 'ta","text":"Hello 🤖"}\r', '\n\r\ndata: {"type":"done"}']), events)
    expect(events.mock.calls.map(([event]) => event)).toEqual([{ type: 'delta', text: 'Hello 🤖' }, { type: 'done' }])
  })
  it('rejects malformed and incomplete streams', async () => {
    await expect(consumeChatStream(stream(['data: {"type":"delta","text":3}\n\n']), vi.fn())).rejects.toMatchObject({ code: 'INVALID_STREAM' })
    await expect(consumeChatStream(stream(['data: {"type":"delta","text":"partial"}\n\n']), vi.fn())).rejects.toMatchObject({ code: 'INCOMPLETE_STREAM' })
  })
  it('cancels a pending read and releases the reader on abort', async () => {
    const canceled = vi.fn()
    const source = new ReadableStream<Uint8Array>({ cancel: canceled })
    const controller = new AbortController()
    const pending = consumeChatStream(source, vi.fn(), controller.signal)
    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(canceled).toHaveBeenCalledOnce()
    expect(source.locked).toBe(false)
  })
})

describe('HTTP adapter', () => {
  it('projects messages to the existing strict wire contract and accepts duplicate transcript success', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ success: true, alreadySent: true })))
    const transport = createHttpTransport({ endpoints: { chat: '/chat', transcripts: '/transcripts' }, fetch: fetcher, headers: { Authorization: 'Bearer example' } })
    const payload = { sessionId: 'session', transcript: [{ id: '1', role: 'user' as const, content: 'Hello', kind: 'lead' as const }] }
    await expect(transport.submitTranscript!(payload, { signal: new AbortController().signal })).resolves.toEqual({ success: true, alreadySent: true })
    const init = fetcher.mock.calls[0]?.[1]
    expect(JSON.parse(String(init?.body))).toEqual({ sessionId: 'session', transcript: [{ id: '1', role: 'user', content: 'Hello' }] })
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer example')
  })
  it('preserves server errors and rejects unsuccessful delivery bodies', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ code: 'RATE_LIMITED', message: 'Please wait' }), { status: 429 })).mockResolvedValueOnce(new Response('{"success":false}'))
    const transport = createHttpTransport({ endpoints: { chat: '/chat', transcripts: '/transcripts' }, fetch: fetcher })
    const payload = { sessionId: 'session', transcript: [] }
    await expect(transport.submitTranscript!(payload, { signal: new AbortController().signal })).rejects.toMatchObject({ code: 'RATE_LIMITED', message: 'Please wait' })
    await expect(transport.submitTranscript!(payload, { signal: new AbortController().signal })).rejects.toThrow()
  })
  it('does not queue oversized transcripts or resolve asynchronous auth on page exit', () => {
    const fetcher = vi.fn<typeof fetch>()
    const transport = createHttpTransport({ endpoints: { chat: '/chat', transcripts: '/transcripts' }, fetch: fetcher })
    expect(transport.queueTranscript!({ sessionId: 's', transcript: [{ id: '1', role: 'user', content: 'x'.repeat(65_536) }] })).toBe('unavailable')
    expect(fetcher).not.toHaveBeenCalled()
  })
})
