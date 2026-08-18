import 'server-only'

import { createHash } from 'node:crypto'
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  type Paginated,
  type PaginationRequest,
} from '@shared/contracts/common'

type CursorPayload = {
  v: 1
  scope: string
  offset: number
}

export type ApiDataError =
  | { kind: 'validation'; message: string }
  | { kind: 'database'; error: { code?: string; message?: string } }

export type ApiDataResult<T> =
  | { data: T; error: null }
  | { data: null; error: ApiDataError }

export type PageWindow = {
  limit: number
  offset: number
  scope: string
}

const MAX_CURSOR_OFFSET = 1_000_000

export function dataSuccess<T>(data: T): ApiDataResult<T> {
  return { data, error: null }
}

export function dataFailure<T>(error: ApiDataError): ApiDataResult<T> {
  return { data: null, error }
}

function encodeCursor(payload: CursorPayload) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

function decodeCursor(cursor: string): CursorPayload | null {
  if (!cursor || cursor.length > 512) return null
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Partial<CursorPayload>
    if (
      parsed.v !== 1 ||
      typeof parsed.scope !== 'string' ||
      !Number.isSafeInteger(parsed.offset) ||
      (parsed.offset ?? -1) < 0 ||
      (parsed.offset ?? 0) > MAX_CURSOR_OFFSET
    ) return null
    return parsed as CursorPayload
  } catch {
    return null
  }
}

export function createQueryScope(resource: string, request: object) {
  const stableRequest = Object.fromEntries(
    Object.entries(request)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right)),
  )
  return createHash('sha256')
    .update(`${resource}:${JSON.stringify(stableRequest)}`)
    .digest('base64url')
    .slice(0, 22)
}

export function resolvePageWindow(
  request: PaginationRequest,
  scope: string,
): ApiDataResult<PageWindow> {
  const limit = request.limit ?? DEFAULT_PAGE_LIMIT
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_LIMIT) {
    return dataFailure({
      kind: 'validation',
      message: `Page limit must be between 1 and ${MAX_PAGE_LIMIT}.`,
    })
  }

  if (!request.cursor) return dataSuccess({ limit, offset: 0, scope })

  const cursor = decodeCursor(request.cursor)
  if (!cursor || cursor.scope !== scope) {
    return dataFailure({
      kind: 'validation',
      message: 'The pagination cursor is invalid for this query.',
    })
  }

  return dataSuccess({ limit, offset: cursor.offset, scope })
}

export function createPage<TSource, TPublic>(
  rows: TSource[],
  window: PageWindow,
  map: (row: TSource) => TPublic,
): Paginated<TPublic> {
  const hasMore = rows.length > window.limit
  const items = rows.slice(0, window.limit).map(map)

  return {
    items,
    page: {
      limit: window.limit,
      has_more: hasMore,
      next_cursor: hasMore
        ? encodeCursor({
          v: 1,
          scope: window.scope,
          offset: window.offset + window.limit,
        })
        : null,
    },
  }
}
