import { authenticateApiRequest } from '@/lib/api/auth'
import { createRequestId, dataServiceErrorResponse, errorResponse, failureResponse, readValidatedJson, successResponse, validationErrorResponse } from '@/lib/api/http'
import { parseListEventGuestsQuery, validateUuidParameter } from '@/lib/api/query'
import { validateInviteEventGuestsRequest } from '@/lib/api/validation'
import { getApiEvent, inviteApiEventGuests, listApiEventGuests, markApiEventGuestEmailInvitationSent } from '@/lib/data/api'
import { sendEventInvitationEmail } from '@/lib/event-invitation-email'

export const runtime = 'nodejs'

type RouteContext = { params: Promise<{ eventId: string }> }

export async function GET(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const query = parseListEventGuestsQuery(new URL(request.url).searchParams)
  if (!query.ok) return validationErrorResponse(query.fieldErrors, requestId)
  const values = await params
  const eventId = validateUuidParameter(values.eventId, 'eventId')
  if (!eventId.ok) return validationErrorResponse(eventId.fieldErrors, requestId)
  const result = await listApiEventGuests(authentication.auth.supabase, eventId.value, query.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  return successResponse(result.data, requestId)
}

export async function POST(request: Request, { params }: RouteContext) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) return errorResponse(authentication.error, requestId, authentication.status)
  const body = await readValidatedJson(request, requestId, validateInviteEventGuestsRequest)
  if (!body.ok) return body.response
  const values = await params
  const eventId = validateUuidParameter(values.eventId, 'eventId')
  if (!eventId.ok) return validationErrorResponse(eventId.fieldErrors, requestId)
  const input = {
    guests: body.value.guests.map(guest => (
      guest.guest_email
        ? { ...guest, invitation_channel: 'email' as const }
        : guest
    )),
  }
  const emailRequested = input.guests.some(guest => guest.invitation_channel === 'email')

  const eventResult = emailRequested
    ? await getApiEvent(authentication.auth.supabase, eventId.value)
    : null
  if (eventResult?.error) return dataServiceErrorResponse(eventResult.error, requestId)
  if (emailRequested && !eventResult?.data) {
    return failureResponse('NOT_FOUND', 'Event not found.', requestId, { retryable: false })
  }

  const result = await inviteApiEventGuests(authentication.auth.supabase, eventId.value, input)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)

  const guests = await Promise.all(result.data.map(async guest => {
    if (!eventResult?.data || guest.invitation_channel !== 'email' || !guest.guest_email) return guest

    try {
      await sendEventInvitationEmail(eventResult.data.event, guest)
      const marked = await markApiEventGuestEmailInvitationSent(
        authentication.auth.supabase,
        eventId.value,
        guest.id,
      )
      if (marked.error) {
        const message = marked.error.kind === 'database'
          ? marked.error.error.message ?? 'The delivered invitation could not be recorded.'
          : marked.error.message
        throw new Error(message)
      }
      return marked.data
    } catch (error) {
      console.error('Event invitation email could not be sent', {
        requestId,
        eventId: eventId.value,
        guestId: guest.id,
        message: error instanceof Error ? error.message : 'Unknown error',
      })
      return guest
    }
  }))

  return successResponse(guests, requestId, 201)
}
