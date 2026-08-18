import 'server-only'

import {
  API_ERROR_HTTP_STATUS,
  type ApiError,
  type ApiErrorCode,
  type ApiResponse,
} from '@shared/contracts/common'
import type { ValidationResult } from './validation'
import type { ApiDataError } from '@/lib/data/api-pagination'

type DatabaseError = {
  code?: string
}

const JSON_HEADERS = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}
const MAX_JSON_BODY_BYTES = 128 * 1024

export function createRequestId() {
  return crypto.randomUUID()
}

export function successResponse<T>(
  data: T,
  requestId: string,
  status = 200,
) {
  const body: ApiResponse<T> = { ok: true, data, request_id: requestId }
  return Response.json(body, {
    status,
    headers: { ...JSON_HEADERS, 'X-Request-Id': requestId },
  })
}

export function errorResponse(
  error: ApiError,
  requestId: string,
  status = API_ERROR_HTTP_STATUS[error.code],
) {
  const body: ApiResponse<never> = { ok: false, error, request_id: requestId }
  return Response.json(body, {
    status,
    headers: { ...JSON_HEADERS, 'X-Request-Id': requestId },
  })
}

export function failureResponse(
  code: ApiErrorCode,
  message: string,
  requestId: string,
  options?: Pick<ApiError, 'retryable' | 'details' | 'field_errors'>,
) {
  return errorResponse({
    code,
    message,
    retryable: options?.retryable ?? code === 'INTERNAL_ERROR',
    details: options?.details,
    field_errors: options?.field_errors,
  }, requestId)
}

export async function readValidatedJson<T>(
  request: Request,
  requestId: string,
  validate: (input: unknown) => ValidationResult<T>,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('application/json') && !contentType.includes('+json')) {
    return {
      ok: false,
      response: failureResponse('BAD_REQUEST', 'Content-Type must be application/json.', requestId),
    }
  }

  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: failureResponse('BAD_REQUEST', 'The request body is too large.', requestId),
    }
  }

  let input: unknown
  try {
    const rawBody = await request.text()
    if (new TextEncoder().encode(rawBody).byteLength > MAX_JSON_BODY_BYTES) {
      return {
        ok: false,
        response: failureResponse('BAD_REQUEST', 'The request body is too large.', requestId),
      }
    }
    input = JSON.parse(rawBody)
  } catch {
    return {
      ok: false,
      response: failureResponse('BAD_REQUEST', 'The request body is not valid JSON.', requestId),
    }
  }

  const result = validate(input)
  if (!result.ok) {
    return {
      ok: false,
      response: failureResponse(
        'VALIDATION_FAILED',
        'One or more request fields are invalid.',
        requestId,
        { retryable: false, field_errors: result.fieldErrors },
      ),
    }
  }

  return result
}

export function databaseErrorResponse(error: DatabaseError, requestId: string) {
  const mapping: Partial<Record<string, { code: ApiErrorCode; message: string }>> = {
    '28000': { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
    '42501': { code: 'FORBIDDEN', message: 'This operation is not permitted.' },
    P0002: { code: 'NOT_FOUND', message: 'The requested resource was not found.' },
    '23505': { code: 'CONFLICT', message: 'The requested change conflicts with the current resource state.' },
    '23514': { code: 'CONFLICT', message: 'The requested state transition is not allowed.' },
    '22023': { code: 'VALIDATION_FAILED', message: 'The database rejected one or more request values.' },
  }
  const mapped = error.code ? mapping[error.code] : undefined

  if (mapped) {
    return failureResponse(mapped.code, mapped.message, requestId, { retryable: false })
  }

  console.error('API database operation failed', { requestId, code: error.code ?? 'unknown' })
  return failureResponse(
    'INTERNAL_ERROR',
    'The operation could not be completed.',
    requestId,
    { retryable: true },
  )
}

export function validationErrorResponse(
  fieldErrors: NonNullable<ApiError['field_errors']>,
  requestId: string,
) {
  return failureResponse(
    'VALIDATION_FAILED',
    'One or more request fields are invalid.',
    requestId,
    { retryable: false, field_errors: fieldErrors },
  )
}

export function dataServiceErrorResponse(error: ApiDataError, requestId: string) {
  if (error.kind === 'validation') {
    const validationFailure = error
    return failureResponse(
      'VALIDATION_FAILED',
      validationFailure.message,
      requestId,
      { retryable: false },
    )
  }

  return databaseErrorResponse(error.error, requestId)
}
