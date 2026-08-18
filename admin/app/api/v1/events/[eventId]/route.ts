import { runApiDetail } from '@/lib/api/read-route'
import { getApiEvent } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ eventId: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  return runApiDetail(
    request,
    params,
    'eventId',
    ({ client, resourceId }) => getApiEvent(client, resourceId),
    { notFoundMessage: 'Event not found.' },
  )
}
