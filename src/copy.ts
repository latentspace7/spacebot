import type { SpacebotCopy } from './types'

export const defaultCopy: SpacebotCopy = {
  placeholder: 'How can I help you?',
  consentPrompt: 'May I collect your name and email and share this conversation with the team so they can contact you? Please reply yes or no.',
  namePlaceholder: 'Enter your name…',
  emailPlaceholder: 'Enter your email address…',
  replyPlaceholder: 'Reply here…',
  handoffLabel: 'Request a follow-up',
  endLabel: 'End conversation',
  retryEndLabel: 'Retry sending transcript',
  endingLabel: 'Sending conversation…',
  newChatLabel: 'Start a new conversation',
  restrictedTitle: 'Chat ended',
  restrictedMessage: 'This conversation has ended because repeated requests were outside the assistant’s purpose.',
  limitMessage: 'This conversation has reached its message limit.',
  sendLabel: 'Send message',
  unavailableMessage: 'The assistant is temporarily unavailable. Please try again.',
  deliveryError: 'Your conversation could not be sent. It has been kept here so you can retry.',
  interruptedMessage: 'The response was interrupted.',
  leadSuccess: (name, canContinue) => `Thank you, ${name}. Your details and conversation have been sent to the team.${canContinue ? ' Is there anything else I can help you with?' : ' Someone will be in touch shortly.'}`,
}
