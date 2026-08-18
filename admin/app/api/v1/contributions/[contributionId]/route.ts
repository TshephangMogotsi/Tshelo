import { runApiDetail } from '@/lib/api/read-route'
import { getApiContribution } from '@/lib/data/api'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ contributionId: string }>
}

export async function GET(request: Request, { params }: RouteContext) {
  return runApiDetail(
    request,
    params,
    'contributionId',
    ({ client, resourceId }) => getApiContribution(client, resourceId),
    { notFoundMessage: 'Contribution not found.' },
  )
}
