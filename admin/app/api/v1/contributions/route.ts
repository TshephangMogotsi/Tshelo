import { parseListContributionsQuery } from '@/lib/api/query'
import { runApiList } from '@/lib/api/read-route'
import { listApiContributions } from '@/lib/data/api'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  return runApiList(request, parseListContributionsQuery, listApiContributions)
}
