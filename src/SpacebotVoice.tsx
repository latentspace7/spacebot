import { useReducedMotion } from 'motion/react'
import { ArrowRight, Clock3, Mic, MicOff, PhoneOff, Volume2 } from 'lucide-react'
import { SpacebotRobot } from './SpacebotRobot'
import type { CSSProperties, JSX } from 'react'
import type { SpacebotVoiceCopy, SpacebotVoiceState } from './types'

export type SpacebotVoiceProps = {
  state: SpacebotVoiceState
  copy: SpacebotVoiceCopy
  theme?: 'dark' | 'light'
  className?: string
  style?: CSSProperties
  onEnd: () => void
  onMute: () => void
  onEnablePlayback: () => void
  onRetry?: () => void
  onChat?: () => void
}

export function SpacebotVoice({ state, copy, theme = 'dark', className, style, onEnd, onMute, onEnablePlayback, onRetry, onChat }: SpacebotVoiceProps): JSX.Element {
  const reduceMotion = useReducedMotion()
  const active = state.phase === 'connected'
  const finished = state.phase === 'ended' || state.phase === 'error'
  const connecting = state.phase === 'connecting'
  const status = connecting ? copy.connectingStatus : active
    ? state.activity === 'speaking' ? copy.speakingStatus : state.activity === 'thinking' ? copy.thinkingStatus : state.muted ? copy.mutedStatus : copy.listeningStatus
    : finished ? copy.endedStatus : copy.idleStatus

  return (
    <div className={`spacebot spacebot-voice ${className ?? ''}`} data-theme={theme} style={style}>
      <div className={`spacebot-voice-meta ${state.warning ? 'spacebot-voice-warning' : ''}`}>
        <span><span className={`spacebot-voice-dot ${active ? 'is-active' : ''}`} /> {active ? copy.liveLabel : copy.idleLabel}</span>
        <span aria-label={copy.remainingLabel(state.remaining)}><Clock3 aria-hidden="true" /> {Math.floor(state.remaining / 60)}:{String(state.remaining % 60).padStart(2, '0')}</span>
      </div>
      <div className={`spacebot-voice-orbit ${active ? 'is-active' : ''} ${state.activity === 'speaking' && active ? 'is-speaking' : ''}`}
        style={{ '--spacebot-voice-level': state.level } as CSSProperties} aria-hidden="true">
        <div className="spacebot-voice-ring" /><div className="spacebot-voice-ring spacebot-voice-ring-outer" />
        <SpacebotRobot className="spacebot-voice-robot" waving={!active && !connecting} reduceMotion={reduceMotion} />
      </div>
      <h3 className="spacebot-voice-status" role="status">{status}</h3>
      <div className="spacebot-voice-wave" aria-hidden="true">
        {[0.4, 0.7, 1, 0.6, 0.9, 0.5, 0.8].map((factor, index) => <span key={index} style={{ height: `${4 + state.level * factor * 28}px` }} />)}
      </div>
      {state.warning && active && <p className="spacebot-voice-notice" role="status">{copy.warningNotice}</p>}
      {finished && <p className="spacebot-voice-message" role={state.phase === 'error' ? 'alert' : 'status'}>{state.message}</p>}
      {state.playbackBlocked && active && <button type="button" className="spacebot-voice-secondary" onClick={onEnablePlayback}><Volume2 aria-hidden="true" /> {copy.enablePlayback}</button>}
      <div className="spacebot-voice-actions">
        {state.phase === 'error' && onRetry ? (
          <button type="button" className="spacebot-voice-primary" onClick={onRetry}><Mic aria-hidden="true" /> {copy.retry}</button>
        ) : active || connecting ? (
          <>
            <button type="button" className="spacebot-voice-mute" onClick={onMute} disabled={!active} aria-label={state.muted ? copy.unmute : copy.mute} aria-pressed={state.muted}>
              {state.muted ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
            </button>
            <button type="button" className="spacebot-voice-end" onClick={onEnd}><PhoneOff aria-hidden="true" /> {connecting ? copy.cancel : copy.end}</button>
          </>
        ) : null}
      </div>
      {!active && !connecting && onChat && <button type="button" className="spacebot-voice-chat" onClick={onChat}>{finished ? copy.continueInChat : copy.preferChat} <ArrowRight aria-hidden="true" /></button>}
      <p className="spacebot-voice-disclosure">{active ? copy.activeDisclosure : connecting ? copy.connectingDisclosure : copy.idleDisclosure}</p>
    </div>
  )
}
