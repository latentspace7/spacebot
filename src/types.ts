import type { CSSProperties } from 'react'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  kind?: 'chat' | 'lead'
}

export type LeadIntakePhase = 'confirmingLead' | 'collectingName' | 'collectingEmail'
export type ConversationPhase = 'chat' | 'streaming' | LeadIntakePhase | 'submittingLead' | 'ending' | 'sent' | 'declined' | 'restricted' | 'error'
export type LeadDetails = { name: string; email: string; consent: boolean; submitted: boolean }
export type ConversationSnapshot = {
  sessionId: string
  messages: ChatMessage[]
  phase: ConversationPhase
  lead: LeadDetails
  remainingTurns?: number
}

export type ChatStreamEvent =
  | { type: 'meta'; turnCount?: number; remainingTurns?: number }
  | { type: 'delta' | 'replace'; text: string }
  | { type: 'done'; turnCount?: number; remainingTurns?: number; leadRequired?: boolean; restricted?: boolean }
  | { type: 'error'; code: string; message: string }

export type ChatRequest = {
  sessionId: string
  messageId: string
  message: string
  history: ChatMessage[]
  leadSubmitted?: boolean
}
export type LeadIntakeRequest = {
  sessionId: string
  messageId: string
  phase: LeadIntakePhase
  message: string
  name?: string
}
export type LeadIntakeResponse = {
  intent: 'provides_name' | 'provides_email' | 'provides_both' | 'affirms' | 'declines' | 'asks_question' | 'off_topic'
  name: string | null
  email: string | null
  reply: string
}
export type TranscriptRequest = { sessionId: string; transcript: ChatMessage[]; name?: string; email?: string }
export type LeadRequest = TranscriptRequest & { name: string; email: string; consent: true }
export type DeliveryResult = { success: true; alreadySent?: boolean }
export type RequestContext = { signal: AbortSignal }
export type SpacebotTransport = {
  chat: (request: ChatRequest, context: RequestContext & { onEvent: (event: ChatStreamEvent) => void }) => Promise<void>
  leadIntake?: (request: LeadIntakeRequest, context: RequestContext) => Promise<LeadIntakeResponse>
  submitLead?: (request: LeadRequest, context: RequestContext) => Promise<DeliveryResult>
  submitTranscript?: (request: TranscriptRequest, context: RequestContext) => Promise<DeliveryResult>
  queueTranscript?: (request: TranscriptRequest) => 'queued' | 'unavailable'
}

export type SpacebotEvent = (
  | { type: 'conversation.updated' | 'conversation.ended' | 'lead.submitted' | 'transcript.delivered' | 'transcript.queued' }
  | { type: 'message.completed'; message: ChatMessage }
  | { type: 'error'; operation: 'chat' | 'lead' | 'transcript'; code: string; message: string }
) & { conversation: ConversationSnapshot }

export type SpacebotPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center-left' | 'center-right'
export type PositionOptions = { position?: SpacebotPosition; offsetX?: number | string; offsetY?: number | string }
export type SpacebotPlacement = {
  launcher?: PositionOptions
  panel?: PositionOptions
  mobile?: { launcher?: PositionOptions; panel?: PositionOptions }
}
export type SpacebotStyle = CSSProperties & { [key: `--spacebot-${string}`]: string | number | undefined }
export type SpacebotCopy = {
  placeholder: string
  consentPrompt: string
  namePlaceholder: string
  emailPlaceholder: string
  replyPlaceholder: string
  handoffLabel: string
  endLabel: string
  retryEndLabel: string
  endingLabel: string
  newChatLabel: string
  restrictedTitle: string
  restrictedMessage: string
  limitMessage: string
  sendLabel: string
  unavailableMessage: string
  noBackendMessage: string
  deliveryError: string
  interruptedMessage: string
  leadSuccess: (name: string, canContinue: boolean) => string
}
export type VoiceConnectRequest = { sdp: string; name?: string }
export type VoiceEndReason = 'timeout' | 'ended' | 'restricted' | 'error'
export type VoiceServerEvent =
  | { type: 'ready'; sdp: string; remainingMs: number }
  | { type: 'warning' }
  | { type: 'thinking'; active: boolean }
  | { type: 'ended'; reason?: VoiceEndReason }
  | { type: 'finalized' }
export type SpacebotVoiceTransport = {
  connect: (request: VoiceConnectRequest, context: RequestContext & { onEvent: (event: VoiceServerEvent) => void | Promise<void> }) => Promise<void>
}
export type SpacebotVoiceState = {
  phase: 'idle' | 'connecting' | 'connected' | 'ended' | 'error'
  activity: 'listening' | 'speaking' | 'thinking'
  remaining: number
  muted: boolean
  level: number
  warning: boolean
  message: string
  playbackBlocked: boolean
}
export type SpacebotVoiceCopy = {
  unsupported: string
  microphoneDenied: string
  connectTimeout: string
  connectionLost: string
  connectionEnded: string
  unreadable: string
  unavailable: string
  noBackend: string
  failed: string
  lost: string
  ended: string
  timeUp: string
  restricted: string
  idleStatus: string
  connectingStatus: string
  speakingStatus: string
  thinkingStatus: string
  listeningStatus: string
  mutedStatus: string
  endedStatus: string
  liveLabel: string
  idleLabel: string
  remainingLabel: (seconds: number) => string
  warningNotice: string
  enablePlayback: string
  retry: string
  cancel: string
  end: string
  mute: string
  unmute: string
  continueInChat: string
  preferChat: string
  activeDisclosure: string
  connectingDisclosure: string
  idleDisclosure: string
  talkLabel: string
  backLabel: string
  namePrompt: string
  namePlaceholder: string
  nameError: string
  startLabel: string
  privacyNotice: string
}
export type SpacebotVoiceOptions = {
  transport: SpacebotVoiceTransport
  maxDurationMs?: number
  askName?: boolean
  copy?: Partial<SpacebotVoiceCopy>
}
export type SpacebotProps = {
  transport: SpacebotTransport
  title?: string
  subtitle?: string
  greeting?: string
  copy?: Partial<SpacebotCopy>
  placement?: SpacebotPlacement
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  storage?: false | { key: string }
  maxUserTurns?: number
  closeBehavior?: 'minimize' | 'end'
  transcriptPolicy?: { onEnd?: boolean; onPageHide?: boolean; requireConsent?: boolean }
  onEvent?: (event: SpacebotEvent) => void | Promise<void>
  theme?: 'dark' | 'light'
  voice?: SpacebotVoiceOptions
  className?: string
  style?: SpacebotStyle
}
