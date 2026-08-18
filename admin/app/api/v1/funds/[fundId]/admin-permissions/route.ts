import { runApiDetail } from '@/lib/api/read-route'
import { listApiFundAdminPermissions } from '@/lib/data/api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ fundId: string }> }
export async function GET(request: Request, { params }: Context) {
  return runApiDetail(request, params, 'fundId', async ({ client, resourceId }) => listApiFundAdminPermissions(client, resourceId), { notFoundMessage: 'Fund not found.' })
}
