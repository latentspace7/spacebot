import { StrictMode } from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Spacebot } from '../src/Spacebot'
import { SpacebotRobot } from '../src/SpacebotRobot'
import { GREETING_ID } from '../src/session'
import type { ConversationSnapshot, SpacebotTransport } from '../src/types'

const transport: SpacebotTransport = {
  async chat(_request, { onEvent }) { onEvent({ type: 'delta', text: 'A helpful reply.' }); onEvent({ type: 'done', remainingTurns: 7 }) },
}
async function say(text = 'Hello'): Promise<void> {
  await userEvent.type(await screen.findByRole('textbox'), text)
  await userEvent.click(screen.getByRole('button', { name: 'Send message' }))
}
function stored(phase: ConversationSnapshot['phase'] = 'chat'): ConversationSnapshot {
  return { sessionId: crypto.randomUUID(), messages: [{ id: GREETING_ID, role: 'assistant', content: 'Welcome back.' }], phase, lead: { name: '', email: '', consent: false, submitted: false } }
}

describe('widget behavior', () => {
  it('supports controlled identity and survives observer exceptions', async () => {
    const observer = vi.fn(() => { throw new Error('observer failure') })
    const view = render(<Spacebot defaultOpen title="Spacy" transport={transport} storage={false} onEvent={observer} />)
    await say()
    expect(await screen.findByText('A helpful reply.')).toBeTruthy()
    view.rerender(<Spacebot defaultOpen title="Orbit" transport={transport} storage={false} onEvent={observer} />)
    expect(screen.getByRole('heading', { name: 'Orbit' })).toBeTruthy()
    expect(screen.getByText('A helpful reply.')).toBeTruthy()
  })
  it('keeps a conversation after failed transcript delivery and clears it only after retry', async () => {
    const submitTranscript = vi.fn<NonNullable<SpacebotTransport['submitTranscript']>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ success: true })
    render(<Spacebot defaultOpen transport={{ ...transport, submitTranscript }} closeBehavior="end" transcriptPolicy={{ onEnd: true }} />)
    await say()
    await screen.findByText('A helpful reply.')
    await userEvent.click(screen.getByRole('button', { name: 'End Spacebot conversation' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('A helpful reply.')).toBeTruthy()
    const before = JSON.parse(sessionStorage.getItem('spacebot-session-v1')!) as ConversationSnapshot
    await userEvent.click(screen.getByRole('button', { name: 'Retry sending transcript' }))
    await screen.findByRole('button', { name: 'Open Spacebot chat' })
    const after = JSON.parse(sessionStorage.getItem('spacebot-session-v1')!) as ConversationSnapshot
    expect(after.sessionId).not.toBe(before.sessionId)
    expect(after.messages).toHaveLength(1)
    expect(submitTranscript).toHaveBeenCalledTimes(2)
  })
  it('does not send untouched greetings and restores valid legacy sessions', async () => {
    sessionStorage.setItem('legacy', JSON.stringify(stored()))
    const submitTranscript = vi.fn()
    render(<Spacebot defaultOpen transport={{ ...transport, submitTranscript }} storage={{ key: 'legacy' }} closeBehavior="end" transcriptPolicy={{ onEnd: true }} />)
    expect(await screen.findByText('Welcome back.')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'End Spacebot conversation' }))
    await screen.findByRole('button', { name: 'Open Spacebot chat' })
    expect(submitTranscript).not.toHaveBeenCalled()
  })
  it('keeps minimize separate from transcript delivery', async () => {
    const submitTranscript = vi.fn()
    render(<Spacebot defaultOpen transport={{ ...transport, submitTranscript }} transcriptPolicy={{ onEnd: true }} />)
    await say()
    await screen.findByText('A helpful reply.')
    await userEvent.click(screen.getByRole('button', { name: 'Minimize Spacebot' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Open Spacebot chat' }))
    expect(await screen.findByText('A helpful reply.')).toBeTruthy()
    expect(submitTranscript).not.toHaveBeenCalled()
  })
  it('collects consent, name and email, and emits a structured submitted lead', async () => {
    const leadIntake = vi.fn<NonNullable<SpacebotTransport['leadIntake']>>()
      .mockResolvedValueOnce({ intent: 'affirms', name: null, email: null, reply: 'What is your name?' })
      .mockResolvedValueOnce({ intent: 'provides_name', name: 'Alex', email: null, reply: 'What is your email?' })
      .mockResolvedValueOnce({ intent: 'provides_email', name: null, email: 'alex@example.com', reply: 'Thanks.' })
    const submitLead = vi.fn<NonNullable<SpacebotTransport['submitLead']>>().mockResolvedValue({ success: true })
    const onEvent = vi.fn()
    render(<Spacebot defaultOpen storage={false} transport={{ ...transport, leadIntake, submitLead }} onEvent={onEvent} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Request a follow-up' }))
    await say('yes')
    await screen.findByText('What is your name?')
    await say('Alex')
    await screen.findByText('What is your email?')
    await say('alex@example.com')
    await waitFor(() => expect(submitLead).toHaveBeenCalledOnce())
    expect(submitLead.mock.calls[0]?.[0]).toMatchObject({ name: 'Alex', email: 'alex@example.com', consent: true })
    await waitFor(() => expect(onEvent.mock.calls.some(([event]) => event.type === 'lead.submitted')).toBe(true))
  })
  it('aborts in-flight work on unmount and ignores late transport events', async () => {
    let late: (() => void) | undefined
    let signal: AbortSignal | undefined
    const onEvent = vi.fn()
    const view = render(<StrictMode><Spacebot defaultOpen storage={false} onEvent={onEvent} transport={{ chat: async (_request, context) => { signal = context.signal; await new Promise<void>((resolve) => { late = () => { context.onEvent({ type: 'delta', text: 'too late' }); context.onEvent({ type: 'done' }); resolve() } }) } }} /></StrictMode>)
    await say()
    view.unmount()
    expect(signal?.aborted).toBe(true)
    const count = onEvent.mock.calls.length
    await act(async () => late?.())
    expect(onEvent.mock.calls.length).toBe(count)
  })
  it('allows new-session recovery from restricted state', async () => {
    sessionStorage.setItem('restricted', JSON.stringify(stored('restricted')))
    render(<Spacebot defaultOpen transport={transport} storage={{ key: 'restricted' }} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Start a new conversation' }))
    expect(await screen.findByRole('textbox')).toBeTruthy()
  })
  it('does not submit a declined lead', async () => {
    const submitLead = vi.fn()
    render(<Spacebot defaultOpen transport={{ ...transport, submitLead, leadIntake: async () => ({ intent: 'declines', name: null, email: null, reply: 'No problem.' }) }} storage={false} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Request a follow-up' }))
    await say('no')
    expect(await screen.findByText('No problem.')).toBeTruthy()
    expect(submitLead).not.toHaveBeenCalled()
  })
  it('restores the draft after a malformed stream and keeps Markdown HTML inert', async () => {
    const chat = vi.fn<SpacebotTransport['chat']>().mockImplementationOnce(async () => { throw new Error('bad stream') }).mockImplementationOnce(async (_request, { onEvent }) => {
      onEvent({ type: 'delta', text: '<script>window.bad = true</script>\n\n**Safe text**' })
      onEvent({ type: 'done' })
    })
    render(<Spacebot defaultOpen storage={false} transport={{ chat }} />)
    await say('Try again')
    await screen.findByRole('alert')
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('Try again')
    await userEvent.click(screen.getByRole('button', { name: 'Send message' }))
    expect(await screen.findByText('Safe text')).toBeTruthy()
    expect(document.querySelector('.spacebot script')).toBeNull()
  })
  it('queues page-exit transcripts once per event under Strict Mode without claiming delivery', async () => {
    const queueTranscript = vi.fn<NonNullable<SpacebotTransport['queueTranscript']>>().mockReturnValue('queued')
    const onEvent = vi.fn()
    render(<StrictMode><Spacebot defaultOpen transport={{ ...transport, queueTranscript }} transcriptPolicy={{ onPageHide: true }} onEvent={onEvent} /></StrictMode>)
    await say()
    await screen.findByText('A helpful reply.')
    act(() => { window.dispatchEvent(new Event('pagehide')) })
    expect(queueTranscript).toHaveBeenCalledOnce()
    expect(onEvent.mock.calls.some(([event]) => event.type === 'transcript.queued')).toBe(true)
    expect(onEvent.mock.calls.some(([event]) => event.type === 'transcript.delivered')).toBe(false)
    expect(JSON.parse(sessionStorage.getItem('spacebot-session-v1')!).messages.length).toBe(3)
  })
  it('honors consent-required page-exit delivery and tolerates blocked storage', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled') })
    const queueTranscript = vi.fn()
    render(<Spacebot defaultOpen transport={{ ...transport, queueTranscript }} transcriptPolicy={{ onPageHide: true, requireConsent: true }} />)
    await say()
    await screen.findByText('A helpful reply.')
    act(() => { window.dispatchEvent(new Event('pagehide')) })
    expect(queueTranscript).not.toHaveBeenCalled()
  })
  it('enforces the server turn limit without requiring lead capture', async () => {
    render(<Spacebot defaultOpen storage={false} transport={{ chat: async (_request, { onEvent }) => { onEvent({ type: 'delta', text: 'Last answer.' }); onEvent({ type: 'done', remainingTurns: 0 }) } }} />)
    await say()
    await screen.findByText('Last answer.')
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(true)
    expect(screen.getByText('This conversation has reached its message limit.')).toBeTruthy()
  })
  it('renders safely on the server and renders the robot independently', () => {
    expect(renderToString(<Spacebot transport={transport} />)).toBe('')
    expect(renderToString(<SpacebotRobot />)).toContain('<svg')
  })
  it('recovers an interrupted legacy stream without losing its user message', async () => {
    const previous = stored('streaming')
    previous.messages.push({ id: crypto.randomUUID(), role: 'user', content: 'Keep my question' }, { id: crypto.randomUUID(), role: 'assistant', content: '' })
    sessionStorage.setItem('interrupted', JSON.stringify(previous))
    render(<Spacebot defaultOpen transport={transport} storage={{ key: 'interrupted' }} />)
    expect(await screen.findByText('Keep my question')).toBeTruthy()
    expect(await screen.findByText('The response was interrupted.')).toBeTruthy()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false)
  })
  it('ignores a previous session response after end and restart', async () => {
    let finishOld: (() => void) | undefined
    render(<Spacebot defaultOpen storage={false} closeBehavior="end" transport={{ chat: async (_request, { onEvent }) => new Promise<void>((resolve) => { finishOld = () => { onEvent({ type: 'delta', text: 'stale answer' }); onEvent({ type: 'done' }); resolve() } }) }} />)
    await say('Old question')
    await userEvent.click(screen.getByRole('button', { name: 'End Spacebot conversation' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Open Spacebot chat' }))
    await act(async () => finishOld?.())
    expect(screen.queryByText('stale answer')).toBeNull()
    expect(screen.queryByText('Old question')).toBeNull()
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).disabled).toBe(false)
  })
})
