import { ApiReference } from '@scalar/nextjs-api-reference'

export const runtime = 'nodejs'

export const GET = ApiReference({
  url: '/api/openapi',
  theme: 'purple',
  pageTitle: 'Tshelo API Reference',
})
