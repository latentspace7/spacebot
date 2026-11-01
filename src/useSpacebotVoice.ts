import { useEffect, useRef, useState } from 'react'
import { defaultVoiceCopy } from './copy'
import { SpacebotVoiceClient, initialVoiceState } from './voiceClient'
import type { SpacebotVoiceCopy, SpacebotVoiceState, SpacebotVoiceTransport } from './types'

export type UseSpacebotVoiceOptions = {
  transport: SpacebotVoiceTransport
  title?: string
  maxDurationMs?: number
  copy?: Partial<SpacebotVoiceCopy>
}

export type SpacebotVoiceControls = {
  state: SpacebotVoiceState
  copy: SpacebotVoiceCopy
  start: (name?: string) => void
  stop: () => void
  reset: () => void
  toggleMute: () => void
  enablePlayback: () => void
}

export function useSpacebotVoice(options: UseSpacebotVoiceOptions): SpacebotVoiceControls {
  const copy = { ...defaultVoiceCopy(options.title?.trim() || 'Spacebot'), ...options.copy }
  const [state, setState] = useState(() => initialVoiceState(options.maxDurationMs))
  const client = useRef<SpacebotVoiceClient | null>(null)
  const latest = useRef({ options, copy })
  useEffect(() => { latest.current = { options, copy } })
  useEffect(() => {
    const onPageHide = (): void => client.current?.dispose()
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      client.current?.dispose()
      client.current = null
    }
  }, [])

  return {
    state,
    copy,
    start: (name) => {
      client.current?.dispose()
      const { options: current, copy: currentCopy } = latest.current
      const next = new SpacebotVoiceClient({ transport: current.transport, copy: currentCopy, maxDurationMs: current.maxDurationMs, onState: (value) => { if (client.current === next) setState(value) } })
      client.current = next
      void next.start(name)
    },
    stop: () => { client.current?.end() },
    reset: () => {
      client.current?.dispose()
      client.current = null
      setState(initialVoiceState(latest.current.options.maxDurationMs))
    },
    toggleMute: () => client.current?.toggleMute(),
    enablePlayback: () => { void client.current?.enablePlayback() },
  }
}
