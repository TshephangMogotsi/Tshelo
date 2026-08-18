import { runApiDetail } from '@/lib/api/read-route'
import { getApiFundPermissions } from '@/lib/data/api'

export const runtime = 'nodejs'
type Context = { params: Promise<{ fundId: string }> }
export async function GET(request: Request, { params }: Context) {
  return runApiDetail(request, params, 'fundId', async ({ client, resourceId }) => {
    const result = await getApiFundPermissions(client, resourceId)
    return result.error ? result : { data: result.data, error: null }
  }, { notFoundMessage: 'Fund not found.' })
}
