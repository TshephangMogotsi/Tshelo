import { tsheloOpenApiDocument } from '@/lib/api/openapi'

export const runtime = 'nodejs'

export async function GET() {
  return Response.json(tsheloOpenApiDocument, {
    headers: {
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  })
}
