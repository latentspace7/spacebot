import * as z from 'zod/mini'

export const messageSchema = z.object({
  id: z.string().check(z.minLength(1)), role: z.enum(['user', 'assistant']), content: z.string().check(z.maxLength(100_000)),
  kind: z.optional(z.enum(['chat', 'lead'])),
})
export const sessionSchema = z.object({
  sessionId: z.uuid(),
  messages: z.array(messageSchema).check(z.minLength(1), z.maxLength(500)),
  phase: z.enum(['chat', 'streaming', 'confirmingLead', 'collectingName', 'collectingEmail', 'submittingLead', 'ending', 'sent', 'declined', 'restricted', 'error']),
  lead: z.object({ name: z.string(), email: z.string(), consent: z.boolean(), submitted: z.boolean() }),
  remainingTurns: z.optional(z.int().check(z.nonnegative())),
})
const turns = { turnCount: z.optional(z.int().check(z.nonnegative())), remainingTurns: z.optional(z.int().check(z.nonnegative())) }
export const streamEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('meta'), ...turns }),
  z.object({ type: z.literal('delta'), text: z.string() }),
  z.object({ type: z.literal('replace'), text: z.string() }),
  z.object({ type: z.literal('done'), ...turns, leadRequired: z.optional(z.boolean()), restricted: z.optional(z.boolean()) }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
])
export const leadIntakeSchema = z.object({
  intent: z.enum(['provides_name', 'provides_email', 'provides_both', 'affirms', 'declines', 'asks_question', 'off_topic']),
  name: z.nullable(z.string().check(z.trim(), z.minLength(2), z.maxLength(100))),
  email: z.nullable(z.email().check(z.maxLength(254))),
  reply: z.string().check(z.minLength(1)),
})
export const deliverySchema = z.object({ success: z.literal(true), alreadySent: z.optional(z.boolean()) })
