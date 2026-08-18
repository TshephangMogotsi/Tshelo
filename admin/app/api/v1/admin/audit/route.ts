import { parseListAdminAuditQuery } from '@/lib/api/query'
import { runApiList } from '@/lib/api/read-route'
import { listApiAdminAudit } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return runApiList(
    request,
    parseListAdminAuditQuery,
    listApiAdminAudit,
    { platformAdminOnly: true },
  )
}
