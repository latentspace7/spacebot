import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { defaultVoiceCopy } from '../src/copy'
import { Spacebot } from '../src/Spacebot'
import { SpacebotVoice } from '../src/SpacebotVoice'
import { consumeVoiceStream, createHttpTransport, createHttpVoiceTransport } from '../src/transport'
import { initialVoiceState } from '../src/voiceClient'
import type { SpacebotTransport, SpacebotVoiceTransport } from '../src/types'

function stream(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close() } })
}
const chat: SpacebotTransport = { async chat(_request, { onEvent }) { onEvent({ type: 'delta', text: 'Hi.' }); onEvent({ type: 'done' }) } }
const signal = (): AbortSignal => new AbortController().signal

describe('voice protocol', () => {
  it('validates known events and ignores application-specific ones', async () => {
    const events = vi.fn()
    await consumeVoiceStream(stream(['data: {"type":"ready","sdp":"v=0","remainingMs":120000}\n\n', 'data: {"type":"transcript_delivery","status":"sent"}\n\ndata: {"type":"thinking","active":true}\n\n', 'data: {"type":"ended","reason":"timeout"}']), events)
    expect(events.mock.calls.map(([event]) => event)).toEqual([{ type: 'ready', sdp: 'v=0', remainingMs: 120000 }, { type: 'thinking', active: true }, { type: 'ended', reason: 'timeout' }])
    await expect(consumeVoiceStream(stream(['data: {"type":"ready","sdp":""}\n\n']), vi.fn())).rejects.toMatchObject({ code: 'INVALID_STREAM' })
  })
  it('posts the offer and caller name to the configured endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream(['data: {"type":"finalized"}\n\n']), { headers: { 'Content-Type': 'text/event-stream' } }))
    const events = vi.fn()
    await createHttpVoiceTransport({ endpoint: '/voice', fetch: fetcher }).connect({ sdp: 'v=0', name: 'Ada' }, { signal: signal(), onEvent: events })
    expect(fetcher.mock.calls[0]?.[0]).toBe('/voice')
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({ sdp: 'v=0', name: 'Ada' })
    expect(events).toHaveBeenCalledWith({ type: 'finalized' })
  })
})

describe('missing backend', () => {
  it('reports a missing chat or voice backend for 404s, HTML fallbacks, and network failures', async () => {
    const missing = [new Response('Not found', { status: 404 }), new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } })]
    for (const response of missing) {
      const voice = createHttpVoiceTransport({ endpoint: '/voice', fetch: vi.fn<typeof fetch>().mockResolvedValue(response.clone()) })
      await expect(voice.connect({ sdp: 'v=0' }, { signal: signal(), onEvent: vi.fn() })).rejects.toMatchObject({ code: 'NO_BACKEND' })
    }
    const offline = createHttpTransport({ endpoints: { chat: '/chat' }, fetch: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')) })
    await expect(offline.chat({ sessionId: 's', messageId: 'm', message: 'Hi', history: [] }, { signal: signal(), onEvent: vi.fn() })).rejects.toMatchObject({ code: 'NO_BACKEND' })
  })
  it('tells visitors to connect a backend instead of showing a generic failure', async () => {
    render(<Spacebot defaultOpen storage={false} transport={createHttpTransport({ endpoints: { chat: '/missing' }, fetch: vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 404 })) })} />)
    await userEvent.type(await screen.findByRole('textbox'), 'Hello')
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect((await screen.findByRole('alert')).textContent).toContain('docs/backend.md')
  })
})

describe('voice interface', () => {
  it('offers voice only when configured and asks for a name before calling', async () => {
    const connect = vi.fn<SpacebotVoiceTransport['connect']>()
    const view = render(<Spacebot defaultOpen storage={false} title="Spacy" transport={chat} />)
    await screen.findByRole('textbox')
    expect(screen.queryByRole('button', { name: 'Talk to Spacy' })).toBeNull()
    view.rerender(<Spacebot defaultOpen storage={false} title="Spacy" transport={chat} voice={{ transport: { connect } }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Talk to Spacy' }))
    await userEvent.click(screen.getByRole('button', { name: 'Start voice call' }))
    expect(screen.getByRole('alert').textContent).toContain('letters')
    expect(connect).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Back to chat' }))
    expect(await screen.findByRole('textbox')).toBeTruthy()
  })
  it('explains when the browser cannot place a voice call', async () => {
    render(<Spacebot defaultOpen storage={false} title="Spacy" transport={chat} voice={{ transport: { connect: vi.fn() }, askName: false }} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Talk to Spacy' }))
    await userEvent.click(screen.getByRole('button', { name: 'Start voice call' }))
    expect((await screen.findByRole('alert')).textContent).toContain('microphone support')
  })
  it('renders call states with configurable copy', () => {
    const copy = { ...defaultVoiceCopy('Spacy'), liveLabel: 'On air' }
    render(<SpacebotVoice state={{ ...initialVoiceState(), phase: 'connected', activity: 'speaking' }} copy={copy} theme="light" onEnd={vi.fn()} onMute={vi.fn()} onEnablePlayback={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toBe('Spacy is speaking')
    expect(screen.getByText('On air')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mute microphone' })).toBeTruthy()
  })
})
