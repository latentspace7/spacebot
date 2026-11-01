import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, Loader2, Mic, Send, Sparkles, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { defaultCopy } from './copy'
import { placementStyle } from './placement'
import { isLeadPhase } from './session'
import { SpacebotRobot } from './SpacebotRobot'
import { SpacebotVoice } from './SpacebotVoice'
import { noBackendError } from './transport'
import { useConversation } from './useConversation'
import { useSpacebotVoice } from './useSpacebotVoice'
import type { JSX } from 'react'
import type { FormEvent } from 'react'
import type { SpacebotProps, SpacebotVoiceTransport } from './types'

const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u
const missingVoiceTransport: SpacebotVoiceTransport = { connect: async () => { throw noBackendError() } }

function Widget(props: SpacebotProps): JSX.Element | null {
  const title = props.title?.trim() || 'Spacebot'
  const greeting = props.greeting?.trim() || `Hello, I'm ${title}! How can I help you today?`
  const copy = { ...defaultCopy, ...props.copy }
  const conversation = useConversation({ ...props, greeting, resolvedCopy: copy })
  const { session, draft, setDraft, error, busy, endFailed, send, end, startLead, leadEnabled, remainingTurns } = conversation
  const [internalOpen, setInternalOpen] = useState(props.defaultOpen ?? false)
  const open = props.open ?? internalOpen
  const reduceMotion = useReducedMotion()
  const voice = useSpacebotVoice({ transport: props.voice?.transport ?? missingVoiceTransport, title, maxDurationMs: props.voice?.maxDurationMs, copy: props.voice?.copy })
  const voiceCopy = voice.copy
  const askName = props.voice?.askName ?? true
  const [mode, setMode] = useState<'chat' | 'voice'>('chat')
  const [callerName, setCallerName] = useState('')
  const [nameError, setNameError] = useState('')
  const theme = props.theme ?? 'dark'
  const headingId = useId()
  const panelId = useId()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)
  const focusLauncher = useCallback(() => launcherRef.current?.focus(), [])
  const viewportRef = useRef<HTMLDivElement>(null)
  const phase = session?.phase
  const terminal = phase === 'sent' || phase === 'declined' || phase === 'restricted'
  const collecting = phase !== undefined && isLeadPhase(phase)
  const inputDisabled = busy || terminal || endFailed || (!collecting && remainingTurns === 0)
  const inputMaxLength = phase === 'collectingName' ? 100 : phase === 'collectingEmail' ? 254 : 1_000
  const placeholder = phase === 'collectingName' ? copy.namePlaceholder : phase === 'collectingEmail' ? copy.emailPlaceholder : phase === 'confirmingLead' ? copy.replyPlaceholder : copy.placeholder

  const changeOpen = (next: boolean): void => {
    if (props.open === undefined) setInternalOpen(next)
    props.onOpenChange?.(next)
  }
  const finish = async (): Promise<void> => {
    if (await end()) changeOpen(false)
  }
  const leaveVoice = (): void => { voice.reset(); setMode('chat') }
  const startVoice = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const name = callerName.trim()
    if (askName && (!name || name.length > 80 || !NAME_PATTERN.test(name))) { setNameError(voiceCopy.nameError); return }
    setNameError('')
    voice.start(askName ? name : undefined)
  }
  const close = (): void => {
    if (mode === 'voice') leaveVoice()
    if (props.closeBehavior === 'end') void finish()
    else changeOpen(false)
  }

  useEffect(() => {
    if (!open || !session) return
    const viewport = viewportRef.current
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [open, session])

  const ready = session !== null
  useEffect(() => {
    if (!open || !ready) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const timer = window.setTimeout(() => (inputRef.current ?? document.getElementById(panelId))?.focus(), reduceMotion ? 0 : 180)
    return () => {
      window.clearTimeout(timer)
      queueMicrotask(() => {
        if (previous?.isConnected && previous !== document.body) previous.focus()
        else focusLauncher()
      })
    }
  }, [open, ready, reduceMotion, focusLauncher, panelId])

  if (!session) return null
  return createPortal(
    <div className={`spacebot ${props.className ?? ''}`} data-theme={theme} style={props.style}>
      <AnimatePresence>
        {open && (
          <div className="spacebot-position spacebot-panel-position" style={placementStyle(props.placement, 'panel')}>
            <motion.section
              id={panelId}
              role="dialog"
              tabIndex={-1}
              aria-modal="false"
              aria-labelledby={headingId}
              initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 18, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 340, damping: 28 }}
              className="spacebot-panel"
              onKeyDown={(event) => {
                if (event.key === 'Escape' && phase !== 'ending' && phase !== 'submittingLead') { event.stopPropagation(); close() }
              }}
            >
              <header className="spacebot-header">
                <div className="spacebot-avatar"><SpacebotRobot waving className="spacebot-header-robot" /><span className="spacebot-status" /></div>
                <div className="spacebot-heading"><h2 id={headingId}>{title}<Sparkles aria-hidden="true" /></h2>{props.subtitle && <p>{props.subtitle}</p>}</div>
                {props.voice && (mode === 'chat'
                  ? <button type="button" className="spacebot-close spacebot-talk" onClick={() => setMode('voice')} disabled={busy || terminal} aria-label={voiceCopy.talkLabel} title={voiceCopy.talkLabel}><Mic aria-hidden="true" /></button>
                  : <button type="button" className="spacebot-close spacebot-talk" onClick={leaveVoice} aria-label={voiceCopy.backLabel} title={voiceCopy.backLabel}><ArrowLeft aria-hidden="true" /></button>)}
                <button type="button" className="spacebot-close" onClick={close} disabled={phase === 'submittingLead' || phase === 'ending'} aria-label={props.closeBehavior === 'end' ? `End ${title} conversation` : `Minimize ${title}`}><X aria-hidden="true" /></button>
              </header>
              {mode === 'voice' ? (
                <div className="spacebot-messages spacebot-voice-view">
                  {voice.state.phase === 'idle' ? (
                    <form className="spacebot-voice-start" onSubmit={startVoice}>
                      <SpacebotRobot className="spacebot-voice-start-robot" waving reduceMotion={reduceMotion} />
                      {askName && <>
                        <label htmlFor={`${panelId}-voice-name`}>{voiceCopy.namePrompt}</label>
                        <input id={`${panelId}-voice-name`} autoComplete="given-name" placeholder={voiceCopy.namePlaceholder} value={callerName} maxLength={80}
                          aria-invalid={Boolean(nameError)} onChange={(event) => { setCallerName(event.target.value); setNameError('') }} />
                        {nameError && <p role="alert" className="spacebot-error">{nameError}</p>}
                      </>}
                      <button type="submit" className="spacebot-voice-primary"><Mic aria-hidden="true" /> {voiceCopy.startLabel}</button>
                      {voiceCopy.privacyNotice && <p className="spacebot-voice-disclosure">{voiceCopy.privacyNotice}</p>}
                    </form>
                  ) : (
                    <SpacebotVoice state={voice.state} copy={voiceCopy} theme={theme} onEnd={voice.stop} onMute={voice.toggleMute} onEnablePlayback={voice.enablePlayback}
                      onRetry={() => voice.start(askName ? callerName.trim() : undefined)} onChat={leaveVoice} />
                  )}
                </div>
              ) : <>
              <div className="spacebot-messages" ref={viewportRef}>
                {phase === 'restricted' ? (
                  <div className="spacebot-terminal"><SpacebotRobot className="spacebot-terminal-robot" /><h3>{copy.restrictedTitle}</h3><p>{copy.restrictedMessage}</p></div>
                ) : (
                  <div className="spacebot-log" role="log" aria-label={`${title} conversation`} aria-live="polite" aria-relevant="additions text">
                    {session.messages.map((entry) => (
                      <div key={entry.id} className={`spacebot-message spacebot-message-${entry.role}`}>
                        <div className="spacebot-bubble">
                          {entry.content ? entry.role === 'assistant' ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml allowedElements={['p', 'strong', 'em', 'ul', 'ol', 'li', 'br', 'del']}>{entry.content}</ReactMarkdown>
                          ) : entry.content : <span className="spacebot-typing" aria-label={`${title} is responding`}><i /><i /><i /></span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <footer className="spacebot-footer">
                {error && <p role="alert" className="spacebot-error">{error}</p>}
                {phase === 'ending' || phase === 'submittingLead' ? <p className="spacebot-progress" role="status"><Loader2 className="spacebot-spin" aria-hidden="true" />{copy.endingLabel}</p> : endFailed ? (
                  <button className="spacebot-action" type="button" onClick={() => void finish()}>{copy.retryEndLabel}</button>
                ) : terminal ? (
                  <button className="spacebot-action" type="button" onClick={() => void end()}>{copy.newChatLabel}</button>
                ) : (
                  <>
                    {!collecting && remainingTurns === 0 && <p className="spacebot-limit">{copy.limitMessage}</p>}
                    <form className="spacebot-composer" onSubmit={(event) => { event.preventDefault(); void send() }}>
                      <textarea
                        ref={inputRef}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value.slice(0, inputMaxLength))}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() }
                        }}
                        placeholder={placeholder}
                        disabled={inputDisabled}
                        maxLength={inputMaxLength}
                        aria-label={`Message ${title}`}
                        rows={2}
                      />
                      <button className="spacebot-send" type="submit" disabled={!draft.trim() || inputDisabled} aria-label={copy.sendLabel}>{busy ? <Loader2 className="spacebot-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}</button>
                    </form>
                    <div className="spacebot-composer-meta"><span>{draft.length}/{inputMaxLength}</span></div>
                    {leadEnabled && !collecting && !session.lead.submitted && <button className="spacebot-link" type="button" disabled={busy} onClick={startLead}>{copy.handoffLabel}</button>}
                  </>
                )}
                {props.closeBehavior !== 'end' && !endFailed && !terminal && <button className="spacebot-link" type="button" disabled={busy} onClick={() => void finish()}>{copy.endLabel}</button>}
              </footer>
              </>}
            </motion.section>
          </div>
        )}
      </AnimatePresence>
      {!open && (
        <div className="spacebot-position spacebot-launcher-position" style={placementStyle(props.placement, 'launcher')}>
          <motion.button ref={launcherRef} type="button" className="spacebot-launcher" onClick={() => changeOpen(true)}
            animate={{ y: reduceMotion ? 0 : [0, -6, 0] }}
            whileHover={reduceMotion ? undefined : { scale: 1.1, rotate: -2 }}
            whileTap={reduceMotion ? undefined : { scale: 0.94, rotate: 2 }}
            transition={reduceMotion ? undefined : { duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            aria-label={`Open ${title} chat`} aria-expanded={false} aria-controls={panelId}>
            <SpacebotRobot className="spacebot-launcher-robot" waving />
            <span className="spacebot-tooltip">Chat with {title}</span><span className="spacebot-status" />
          </motion.button>
        </div>
      )}
    </div>, document.body,
  )
}

export function Spacebot(props: SpacebotProps): JSX.Element {
  return <Widget key={props.storage === false ? 'memory' : props.storage?.key ?? 'spacebot-session-v1'} {...props} />
}
