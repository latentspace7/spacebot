import { NO_BACKEND, SpacebotError } from './transport'
import type { SpacebotVoiceCopy, SpacebotVoiceState, SpacebotVoiceTransport, VoiceServerEvent } from './types'

export const DEFAULT_VOICE_DURATION_MS = 120_000

export type SpacebotVoiceClientOptions = {
  transport: SpacebotVoiceTransport
  copy: SpacebotVoiceCopy
  maxDurationMs?: number
  onState: (state: SpacebotVoiceState) => void
}

export function initialVoiceState(maxDurationMs = DEFAULT_VOICE_DURATION_MS): SpacebotVoiceState {
  return { phase: 'idle', activity: 'listening', remaining: Math.round(maxDurationMs / 1000), muted: false, level: 0, warning: false, message: '', playbackBlocked: false }
}

export class SpacebotVoiceClient {
  private state: SpacebotVoiceState
  private readonly options: SpacebotVoiceClientOptions
  private readonly maxDurationMs: number
  private readonly abort = new AbortController()
  private peer?: RTCPeerConnection
  private events?: RTCDataChannel
  private microphone?: MediaStream
  private audio?: AudioContext
  private playback?: HTMLAudioElement
  private gain?: GainNode
  private analyser?: AnalyserNode
  private interval?: ReturnType<typeof setInterval>
  private startupTimer?: ReturnType<typeof setTimeout>
  private closeTimer?: ReturnType<typeof setTimeout>
  private deadline = 0
  private stopped = false
  private thinking = false
  private sessionStarted = false
  private remoteAudio = false

  constructor(options: SpacebotVoiceClientOptions) {
    this.options = options
    this.maxDurationMs = options.maxDurationMs ?? DEFAULT_VOICE_DURATION_MS
    this.state = initialVoiceState(this.maxDurationMs)
  }

  private get copy(): SpacebotVoiceCopy { return this.options.copy }

  private update(patch: Partial<SpacebotVoiceState>): void {
    this.state = { ...this.state, ...patch }
    this.options.onState(this.state)
  }

  async start(name?: string): Promise<void> {
    if (this.state.phase !== 'idle' || this.stopped) return
    this.update({ phase: 'connecting' })
    this.startupTimer = setTimeout(() => this.fail(this.copy.connectTimeout), 25_000)
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') throw new Error(this.copy.unsupported)
      this.audio = new AudioContext()
      await this.audio.resume()
      if (this.stopped) return
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      if (this.stopped) { microphone.getTracks().forEach((track) => track.stop()); return }
      this.microphone = microphone
      const peer = new RTCPeerConnection()
      this.peer = peer
      for (const track of microphone.getAudioTracks()) peer.addTrack(track, microphone)
      peer.ontrack = ({ track }): void => {
        if (this.stopped || !this.audio) return
        const stream = new MediaStream([track])
        this.playback = new Audio()
        this.playback.srcObject = stream
        this.playback.volume = 0
        void this.playback.play().catch(() => { if (!this.stopped) this.update({ playbackBlocked: true }) })
        const source = this.audio.createMediaStreamSource(stream)
        this.analyser = this.audio.createAnalyser()
        this.analyser.fftSize = 256
        this.gain = this.audio.createGain()
        source.connect(this.analyser)
        this.analyser.connect(this.gain)
        this.gain.connect(this.audio.destination)
        this.scheduleSilence()
        this.update({ playbackBlocked: this.audio.state !== 'running' })
        this.remoteAudio = track.readyState === 'live'
        this.maybeConnected()
      }
      peer.onconnectionstatechange = (): void => {
        this.maybeConnected()
        if (['failed', 'disconnected'].includes(peer.connectionState) && !this.stopped) this.fail(this.copy.connectionLost)
      }
      const events = peer.createDataChannel('oai-events')
      this.events = events
      events.onopen = (): void => this.maybeConnected()
      events.onmessage = ({ data }): void => {
        try { this.handleLiveEvent(JSON.parse(data)) } catch { this.fail(this.copy.unreadable) }
      }
      events.onclose = (): void => { if (!this.stopped) this.fail(this.copy.connectionEnded) }
      await peer.setLocalDescription(await peer.createOffer())
      await this.waitForIce(peer)
      if (this.stopped) return
      const sdp = peer.localDescription?.sdp
      if (!sdp) throw new Error(this.copy.unavailable)
      await this.options.transport.connect({ sdp, ...(name?.trim() ? { name: name.trim() } : {}) }, { signal: this.abort.signal, onEvent: (event) => this.handleServerEvent(event) })
      if (!this.stopped) this.fail(this.copy.connectionEnded)
    } catch (error) {
      if (this.stopped) return
      this.fail(error instanceof SpacebotError && error.code === NO_BACKEND ? this.copy.noBackend
        : error instanceof DOMException && error.name === 'NotAllowedError' ? this.copy.microphoneDenied
        : error instanceof Error && error.message ? error.message : this.copy.unavailable)
    }
  }

  private maybeConnected(): void {
    if (!this.stopped && this.state.phase === 'connecting' && this.sessionStarted && this.remoteAudio
      && this.peer?.connectionState === 'connected' && this.events?.readyState === 'open') {
      clearTimeout(this.startupTimer)
      this.update({ phase: 'connected' })
    }
  }

  private waitForIce(peer: RTCPeerConnection): Promise<void> {
    if (peer.iceGatheringState === 'complete') return Promise.resolve()
    return new Promise((resolve, reject) => {
      const cleanup = (): void => {
        clearTimeout(timer)
        peer.removeEventListener('icegatheringstatechange', check)
        this.abort.signal.removeEventListener('abort', cancel)
      }
      const check = (): void => { if (peer.iceGatheringState === 'complete') { cleanup(); resolve() } }
      const cancel = (): void => { cleanup(); reject(new Error(this.copy.connectionEnded)) }
      const timer = setTimeout(() => { cleanup(); reject(new Error(this.copy.connectTimeout)) }, 8000)
      peer.addEventListener('icegatheringstatechange', check)
      this.abort.signal.addEventListener('abort', cancel, { once: true })
      check()
    })
  }

  private async handleServerEvent(event: VoiceServerEvent): Promise<void> {
    if (event.type === 'finalized') { this.end(); this.release(); return }
    if (this.stopped) return
    if (event.type === 'ready') {
      this.deadline = performance.now() + Math.min(this.maxDurationMs, event.remainingMs)
      this.scheduleSilence()
      this.interval = setInterval(() => this.tick(), 100)
      await this.peer?.setRemoteDescription({ type: 'answer', sdp: event.sdp })
    } else if (event.type === 'warning') {
      this.update({ warning: true })
    } else if (event.type === 'thinking') {
      this.thinking = event.active
    } else if (event.reason === 'error') {
      this.fail(this.copy.lost)
    } else {
      this.end(event.reason === 'restricted' ? this.copy.restricted : event.reason === 'timeout' ? this.copy.timeUp : undefined)
    }
  }

  private handleLiveEvent(event: { type?: unknown }): void {
    if (event.type === 'session.closed') { this.end(); this.release(); return }
    if (this.stopped) return
    if (event.type === 'session.started') {
      this.sessionStarted = true
      this.maybeConnected()
    } else if (event.type === 'session.failed' || event.type === 'error') {
      this.fail(this.copy.failed)
    }
  }

  private scheduleSilence(): void {
    if (!this.audio || !this.gain || !this.deadline) return
    this.gain.gain.setValueAtTime(0, this.audio.currentTime + Math.max(0, this.deadline - performance.now()) / 1000)
  }

  private tick(): void {
    if (this.stopped) return
    const remaining = Math.max(0, Math.ceil((this.deadline - performance.now()) / 1000))
    if (!remaining) { this.end(this.copy.timeUp); return }
    const samples = new Uint8Array(this.analyser?.fftSize || 0)
    this.analyser?.getByteTimeDomainData(samples)
    const level = samples.length ? Math.min(1, Math.sqrt(samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length) * 8) : 0
    this.update({ remaining, level, activity: level > 0.06 ? 'speaking' : this.thinking ? 'thinking' : 'listening' })
  }

  toggleMute(): void {
    if (this.stopped || this.state.phase !== 'connected') return
    const muted = !this.state.muted
    this.microphone?.getAudioTracks().forEach((track) => { track.enabled = !muted })
    this.update({ muted })
  }

  async enablePlayback(): Promise<void> {
    if (this.stopped) return
    try {
      await this.audio?.resume()
      await this.playback?.play()
      this.update({ playbackBlocked: this.audio?.state !== 'running' })
    } catch {
      this.update({ playbackBlocked: true })
    }
  }

  private fail(message: string): void {
    this.end(message)
    this.update({ phase: 'error', message })
  }

  end(message = this.copy.ended): void {
    if (this.stopped) return
    this.stopped = true
    clearTimeout(this.startupTimer)
    clearInterval(this.interval)
    this.microphone?.getTracks().forEach((track) => track.stop())
    this.playback?.pause()
    if (this.audio && this.gain) {
      this.gain.gain.cancelScheduledValues(this.audio.currentTime)
      this.gain.gain.setValueAtTime(0, this.audio.currentTime)
    }
    this.abort.abort()
    this.closeTimer = setTimeout(() => this.release(), 5000)
    this.update({ phase: 'ended', level: 0, message })
  }

  private release(): void {
    clearTimeout(this.closeTimer)
    this.events?.close()
    this.peer?.close()
    if (this.playback) this.playback.srcObject = null
    if (this.audio && this.audio.state !== 'closed') void this.audio.close().catch(() => undefined)
  }

  dispose(): void { this.end(); this.release() }
}
