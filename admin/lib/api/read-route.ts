import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { ValidationResult } from './validation'
import type { ApiDataResult } from '@/lib/data/api-pagination'
import { authenticateApiRequest } from './auth'
import {
  createRequestId,
  dataServiceErrorResponse,
  errorResponse,
  failureResponse,
  successResponse,
  validationErrorResponse,
} from './http'
import { authorizePlatformAdminRead } from './platform-admin'
import { validateUuidParameter } from './query'

type ListRouteOptions = {
  platformAdminOnly?: boolean
}

type DetailRouteOptions = ListRouteOptions & {
  notFoundMessage: string
}

export async function runApiList<TRequest, TResponse>(
  request: Request,
  parse: (params: URLSearchParams) => ValidationResult<TRequest>,
  load: (client: SupabaseClient, request: TRequest) => Promise<ApiDataResult<TResponse>>,
  options: ListRouteOptions = {},
) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) {
    return errorResponse(authentication.error, requestId, authentication.status)
  }

  if (options.platformAdminOnly) {
    const authorization = await authorizePlatformAdminRead(authentication.auth)
    if (!authorization.ok) {
      return errorResponse(authorization.error, requestId, authorization.status)
    }
  }

  const parsed = parse(new URL(request.url).searchParams)
  if (!parsed.ok) return validationErrorResponse(parsed.fieldErrors, requestId)

  const result = await load(authentication.auth.supabase, parsed.value)
  if (result.error) return dataServiceErrorResponse(result.error, requestId)

  return successResponse(result.data, requestId)
}

export async function runApiDetail<TKey extends string, TResponse>(
  request: Request,
  params: Promise<Record<TKey, string>>,
  parameterName: TKey,
  load: (context: {
    client: SupabaseClient
    actorUserId: string
    resourceId: string
  }) => Promise<ApiDataResult<TResponse | null>>,
  options: DetailRouteOptions,
) {
  const requestId = createRequestId()
  const authentication = await authenticateApiRequest(request)
  if (!authentication.ok) {
    return errorResponse(authentication.error, requestId, authentication.status)
  }

  if (options.platformAdminOnly) {
    const authorization = await authorizePlatformAdminRead(authentication.auth)
    if (!authorization.ok) {
      return errorResponse(authorization.error, requestId, authorization.status)
    }
  }

  const resolvedParams = await params
  const resourceId = validateUuidParameter(resolvedParams[parameterName], parameterName)
  if (!resourceId.ok) return validationErrorResponse(resourceId.fieldErrors, requestId)

  const result = await load({
    client: authentication.auth.supabase,
    actorUserId: authentication.auth.actor.user_id,
    resourceId: resourceId.value,
  })
  if (result.error) return dataServiceErrorResponse(result.error, requestId)
  if (!result.data) {
    return failureResponse(
      'NOT_FOUND',
      options.notFoundMessage,
      requestId,
      { retryable: false },
    )
  }

  return successResponse(result.data, requestId)
}
