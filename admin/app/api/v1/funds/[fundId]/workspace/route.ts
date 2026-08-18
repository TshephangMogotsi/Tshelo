import { runApiDetail } from '@/lib/api/read-route'
import { getApiFundWorkspace } from '@/lib/data/api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ fundId: string }> }
export async function GET(request: Request, { params }: Context) {
  return runApiDetail(request, params, 'fundId', ({ client, actorUserId, resourceId }) => getApiFundWorkspace(client, actorUserId, resourceId), { notFoundMessage: 'Fund not found.' })
}
