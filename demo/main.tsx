import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Spacebot, SpacebotRobot } from '../src'
import type { SpacebotEvent, SpacebotPosition, SpacebotTransport } from '../src'
import '../src/styles.css'
import './demo.css'

const transport: SpacebotTransport = {
  async chat(request, { signal, onEvent }) {
    signal.throwIfAborted()
    onEvent({ type: 'delta', text: `You said: **${request.message}**\n\nThis demo runs locally. Connect a transport to use your own assistant, service, or application API.` })
    onEvent({ type: 'done' })
  },
  async leadIntake(request) {
    if (/^(no|nope)$/i.test(request.message)) return { intent: 'declines', name: null, email: null, reply: 'No problem. We can keep chatting.' }
    if (request.phase === 'confirmingLead') return { intent: 'affirms', name: null, email: null, reply: 'What name should we use?' }
    if (request.phase === 'collectingName') return { intent: 'provides_name', name: request.message, email: null, reply: 'What is your email address?' }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(request.message)) return { intent: 'asks_question', name: null, email: null, reply: 'Please enter a valid email address.' }
    return { intent: 'provides_email', name: null, email: request.message, reply: 'Thank you.' }
  },
  async submitLead() { return { success: true } },
  async submitTranscript() { return { success: true } },
}

function Demo() {
  const [position, setPosition] = useState<SpacebotPosition>('bottom-right')
  const [title, setTitle] = useState('Spacebot')
  const [open, setOpen] = useState(false)
  const [eventType, setEventType] = useState('Waiting for a conversation')
  const onEvent = (event: SpacebotEvent): void => { setEventType(event.type) }
  return (
    <main className="demo-page">
      <div className="demo-mark"><SpacebotRobot waving style={{ width: 92, height: 92 }} /><span>SPACEBOT / REACT</span></div>
      <h1>A friendly face.<br /><span>Your own intelligence.</span></h1>
      <p className="demo-intro">An animated chatbot you can place, name, and connect to your application. Try the controls, then start a conversation.</p>
      <div className="demo-controls">
        <label>Assistant title<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>Placement<select value={position} onChange={(event) => setPosition(event.target.value as SpacebotPosition)}>{(['bottom-right', 'bottom-left', 'top-right', 'top-left', 'center-right', 'center-left'] as const).map((value) => <option key={value}>{value}</option>)}</select></label>
        <button type="button" onClick={() => setOpen(true)}>Start a conversation ↗</button>
      </div>
      <div className="demo-notes"><p><strong>Self-contained styling</strong><br />This page has no Tailwind or application UI framework.</p><p><strong>Pluggable services</strong><br />Mock responses only. No network calls or email delivery.</p><p><strong>Structured events</strong><br /><code>{eventType}</code></p></div>
      <Spacebot title={title} subtitle="Local demo assistant" transport={transport} open={open} onOpenChange={setOpen} onEvent={onEvent} storage={false} placement={{ launcher: { position }, panel: { position, offsetY: 24 }, mobile: { launcher: { position }, panel: { position, offsetY: 24 } } }} />
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><Demo /></StrictMode>)
