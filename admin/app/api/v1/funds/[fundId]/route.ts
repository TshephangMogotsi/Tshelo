import { runApiDetail } from '@/lib/api/read-route'
import { getApiFund } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ fundId: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  return runApiDetail(
    request,
    params,
    'fundId',
    ({ client, actorUserId, resourceId }) => getApiFund(client, actorUserId, resourceId),
    { notFoundMessage: 'Fund not found.' },
  )
}
