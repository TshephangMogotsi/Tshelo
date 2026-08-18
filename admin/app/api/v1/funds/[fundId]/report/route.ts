import { runApiDetail } from '@/lib/api/read-route'
import { getApiFundReport } from '@/lib/data/api'

export const runtime = 'nodejs'

type Context = { params: Promise<{ fundId: string }> }

export async function GET(request: Request, { params }: Context) {
  return runApiDetail(
    request,
    params,
    'fundId',
    ({ client, resourceId }) => getApiFundReport(client, resourceId),
    { notFoundMessage: 'Fund report not found.' },
  )
}
