import { runApiDetail } from '@/lib/api/read-route'
import { getApiUser } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  return runApiDetail(
    request,
    params,
    'userId',
    ({ client, resourceId }) => getApiUser(client, resourceId),
    { notFoundMessage: 'User not found.' },
  )
}
