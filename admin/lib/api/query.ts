import type {
  ListAdminAuditRequest,
  ListSupportTicketsRequest,
} from '@shared/contracts/admin'
import {
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
} from '@shared/contracts/admin'
import {
  CONTRIBUTION_STATUSES,
  PAYMENT_METHODS,
  type ListContributionsRequest,
} from '@shared/contracts/contributions'
import {
  EVENT_STATUSES,
  type ListEventsRequest,
} from '@shared/contracts/events'
import {
  FUND_STATUSES,
  type ListFundsRequest,
} from '@shared/contracts/funds'
import {
  TRUST_LEVELS,
  USER_ACCOUNT_STATUSES,
  type ListUsersRequest,
} from '@shared/contracts/users'
import type { ApiFieldError } from '@shared/contracts/common'
import type { ValidationResult } from './validation'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

type CommonListQuery = {
  cursor?: string
  limit?: number
  q?: string
  sort_by?: string
  sort_direction?: 'asc' | 'desc'
}

function issue(field: string, code: string, message: string): ApiFieldError {
  return { field, code, message }
}

function rejectUnknownQuery(
  params: URLSearchParams,
  allowed: readonly string[],
  errors: ApiFieldError[],
) {
  for (const key of new Set(params.keys())) {
    if (!allowed.includes(key)) {
      errors.push(issue(key, 'unknown_query_parameter', 'This query parameter is not supported.'))
    }
  }
}

function singleValue(
  params: URLSearchParams,
  key: string,
  errors: ApiFieldError[],
) {
  const all = params.getAll(key)
  if (all.length > 1) {
    errors.push(issue(key, 'duplicate_parameter', 'This query parameter may only be supplied once.'))
  }
  return all[0]
}

function parseCommon(
  params: URLSearchParams,
  allowedSortFields: readonly string[],
  errors: ApiFieldError[],
): CommonListQuery {
  const result: CommonListQuery = {}
  const cursor = singleValue(params, 'cursor', errors)
  if (cursor !== undefined) {
    if (!cursor || cursor.length > 512) errors.push(issue('cursor', 'invalid_cursor', 'Cursor is invalid.'))
    else result.cursor = cursor
  }

  const limit = singleValue(params, 'limit', errors)
  if (limit !== undefined) {
    if (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 100) {
      errors.push(issue('limit', 'invalid_limit', 'Limit must be an integer between 1 and 100.'))
    } else result.limit = Number(limit)
  }

  const q = singleValue(params, 'q', errors)
  if (q !== undefined) {
    if (!q.trim() || q.trim().length > 100) {
      errors.push(issue('q', 'invalid_search', 'Search text must contain between 1 and 100 characters.'))
    } else result.q = q.trim()
  }

  const sortBy = singleValue(params, 'sort_by', errors)
  if (sortBy !== undefined) {
    if (!allowedSortFields.includes(sortBy)) {
      errors.push(issue('sort_by', 'invalid_sort', 'Unsupported sort field.'))
    } else result.sort_by = sortBy
  }

  const sortDirection = singleValue(params, 'sort_direction', errors)
  if (sortDirection !== undefined) {
    if (sortDirection !== 'asc' && sortDirection !== 'desc') {
      errors.push(issue('sort_direction', 'invalid_sort_direction', 'Sort direction must be asc or desc.'))
    } else result.sort_direction = sortDirection
  }

  return result
}

function parseMulti(params: URLSearchParams, key: string) {
  return params
    .getAll(key)
    .flatMap(value => value.split(','))
    .map(value => value.trim())
    .filter(Boolean)
}

function parseClosedValues<T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
  errors: ApiFieldError[],
): T[] | undefined {
  const parsed = parseMulti(params, key)
  if (!parsed.length) return undefined
  const invalid = parsed.filter(value => !allowed.includes(value as T))
  if (invalid.length) {
    errors.push(issue(key, 'invalid_filter', `Unsupported ${key} value.`))
    return undefined
  }
  return [...new Set(parsed)] as T[]
}

function parseExtensibleValues(
  params: URLSearchParams,
  key: string,
  errors: ApiFieldError[],
) {
  const parsed = parseMulti(params, key)
  if (!parsed.length) return undefined
  if (parsed.some(value => value.length < 2 || value.length > 50 || /[\u0000-\u001f]/.test(value))) {
    errors.push(issue(key, 'invalid_filter', `${key} values must contain between 2 and 50 printable characters.`))
    return undefined
  }
  return [...new Set(parsed)]
}

function parseUuid(
  params: URLSearchParams,
  key: string,
  errors: ApiFieldError[],
) {
  const value = singleValue(params, key, errors)
  if (value === undefined) return undefined
  if (!UUID_PATTERN.test(value)) {
    errors.push(issue(key, 'invalid_uuid', 'Must be a valid UUID.'))
    return undefined
  }
  return value
}

function parseBoundedString(
  params: URLSearchParams,
  key: string,
  max: number,
  errors: ApiFieldError[],
) {
  const value = singleValue(params, key, errors)
  if (value === undefined) return undefined
  if (!value.trim() || value.trim().length > max) {
    errors.push(issue(key, 'invalid_string', `Must contain between 1 and ${max} characters.`))
    return undefined
  }
  return value.trim()
}

function parseDate(
  params: URLSearchParams,
  key: string,
  errors: ApiFieldError[],
) {
  const value = singleValue(params, key, errors)
  if (value === undefined) return undefined
  const parsed = DATE_PATTERN.test(value) ? new Date(`${value}T00:00:00Z`) : null
  if (!parsed || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    errors.push(issue(key, 'invalid_date', 'Must use YYYY-MM-DD format.'))
    return undefined
  }
  return value
}

function finish<T>(value: T, errors: ApiFieldError[]): ValidationResult<T> {
  return errors.length ? { ok: false, fieldErrors: errors } : { ok: true, value }
}

export function validateUuidParameter(value: string, field: string): ValidationResult<string> {
  return UUID_PATTERN.test(value)
    ? { ok: true, value }
    : { ok: false, fieldErrors: [issue(field, 'invalid_uuid', 'Must be a valid UUID.')] }
}

export function parseListUsersQuery(params: URLSearchParams): ValidationResult<ListUsersRequest> {
  const errors: ApiFieldError[] = []
  rejectUnknownQuery(params, ['cursor', 'limit', 'q', 'sort_by', 'sort_direction', 'trust_level', 'status'], errors)
  const value = {
    ...parseCommon(params, ['created_at', 'name', 'trust_score'], errors),
    trust_level: parseClosedValues(params, 'trust_level', TRUST_LEVELS, errors),
    status: parseClosedValues(params, 'status', USER_ACCOUNT_STATUSES, errors),
  } as ListUsersRequest
  return finish(value, errors)
}

export function parseListFundsQuery(params: URLSearchParams): ValidationResult<ListFundsRequest> {
  const errors: ApiFieldError[] = []
  rejectUnknownQuery(params, [
    'cursor', 'limit', 'q', 'sort_by', 'sort_direction', 'owner_id', 'member_user_id',
    'type', 'status', 'linked_event_id',
  ], errors)
  const value = {
    ...parseCommon(params, ['created_at', 'title', 'goal_amount', 'contribution_deadline'], errors),
    owner_id: parseUuid(params, 'owner_id', errors),
    member_user_id: parseUuid(params, 'member_user_id', errors),
    type: parseExtensibleValues(params, 'type', errors),
    status: parseClosedValues(params, 'status', FUND_STATUSES, errors),
    linked_event_id: parseUuid(params, 'linked_event_id', errors),
  } as ListFundsRequest
  return finish(value, errors)
}

export function parseListEventsQuery(params: URLSearchParams): ValidationResult<ListEventsRequest> {
  const errors: ApiFieldError[] = []
  rejectUnknownQuery(params, [
    'cursor', 'limit', 'q', 'sort_by', 'sort_direction', 'creator_id',
    'participant_user_id', 'type', 'status',
  ], errors)
  const value = {
    ...parseCommon(params, ['created_at', 'event_date', 'name'], errors),
    creator_id: parseUuid(params, 'creator_id', errors),
    participant_user_id: parseUuid(params, 'participant_user_id', errors),
    type: parseExtensibleValues(params, 'type', errors),
    status: parseClosedValues(params, 'status', EVENT_STATUSES, errors),
  } as ListEventsRequest
  return finish(value, errors)
}

export function parseListContributionsQuery(params: URLSearchParams): ValidationResult<ListContributionsRequest> {
  const errors: ApiFieldError[] = []
  rejectUnknownQuery(params, [
    'cursor', 'limit', 'sort_by', 'sort_direction', 'fund_id', 'user_id',
    'status', 'payment_method', 'from', 'to',
  ], errors)
  const value = {
    ...parseCommon(params, ['created_at', 'confirmed_at', 'amount'], errors),
    fund_id: parseUuid(params, 'fund_id', errors),
    user_id: parseUuid(params, 'user_id', errors),
    status: parseClosedValues(params, 'status', CONTRIBUTION_STATUSES, errors),
    payment_method: parseClosedValues(params, 'payment_method', PAYMENT_METHODS, errors),
    from: parseDate(params, 'from', errors),
    to: parseDate(params, 'to', errors),
  } as ListContributionsRequest
  if (value.from && value.to && value.from > value.to) {
    errors.push(issue('from', 'invalid_date_range', 'The from date cannot be after the to date.'))
  }
  return finish(value, errors)
}

export function parseListSupportTicketsQuery(params: URLSearchParams): ValidationResult<ListSupportTicketsRequest> {
  const errors: ApiFieldError[] = []
  rejectUnknownQuery(params, [
    'cursor', 'limit', 'q', 'sort_by', 'sort_direction', 'status', 'priority', 'assigned_to',
  ], errors)
  const value = {
    ...parseCommon(params, ['created_at', 'priority', 'status'], errors),
    status: parseClosedValues(params, 'status', SUPPORT_TICKET_STATUSES, errors),
    priority: parseClosedValues(params, 'priority', SUPPORT_TICKET_PRIORITIES, errors),
    assigned_to: parseBoundedString(params, 'assigned_to', 100, errors),
  } as ListSupportTicketsRequest
  return finish(value, errors)
}

export function parseListAdminAuditQuery(params: URLSearchParams): ValidationResult<ListAdminAuditRequest> {
  const errors: ApiFieldError[] = []
  rejectUnknownQuery(params, [
    'cursor', 'limit', 'sort_by', 'sort_direction', 'actor_user_id',
    'entity_type', 'entity_id', 'action',
  ], errors)
  const value = {
    ...parseCommon(params, ['created_at'], errors),
    actor_user_id: parseUuid(params, 'actor_user_id', errors),
    entity_type: parseBoundedString(params, 'entity_type', 100, errors),
    entity_id: parseUuid(params, 'entity_id', errors),
    action: parseBoundedString(params, 'action', 100, errors),
  } as ListAdminAuditRequest
  return finish(value, errors)
}
