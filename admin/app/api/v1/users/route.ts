import { parseListUsersQuery } from '@/lib/api/query'
import { runApiList } from '@/lib/api/read-route'
import { listApiUsers } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return runApiList(
    request,
    parseListUsersQuery,
    listApiUsers,
    { platformAdminOnly: true },
  )
}
