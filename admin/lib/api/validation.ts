import type {
  ModerateFundRequest,
  ModerateUserRequest,
  UpdateSupportTicketRequest,
  UpsertPlatformAdminRequest,
} from '@shared/contracts/admin'
import {
  FUND_MODERATION_ACTIONS,
  PLATFORM_ADMIN_ROLES,
  PLATFORM_ADMIN_STATUSES,
  SUPPORT_TICKET_PRIORITIES,
  SUPPORT_TICKET_STATUSES,
  USER_MODERATION_ACTIONS,
} from '@shared/contracts/admin'
import type { ApiFieldError, JsonValue } from '@shared/contracts/common'
import type { CreateEventRequest } from '@shared/contracts/events'
import type { CreateFundRequest } from '@shared/contracts/funds'

type JsonObject = Record<string, JsonValue | undefined>

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: ApiFieldError[] }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/
const CURRENCY_PATTERN = /^[A-Z]{3}$/
const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,12})(?:\.\d{1,2})?$/

function issue(field: string, code: string, message: string): ApiFieldError {
  return { field, code, message }
}

function objectValue(value: unknown): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as JsonObject
}

function rejectUnknownFields(
  value: JsonObject,
  allowed: readonly string[],
  errors: ApiFieldError[],
  prefix = '',
) {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      errors.push(issue(prefix ? `${prefix}.${key}` : key, 'unknown_field', 'This field is not supported.'))
    }
  }
}

function requireString(
  value: JsonObject,
  field: string,
  errors: ApiFieldError[],
  min: number,
  max: number,
) {
  const candidate = value[field]
  if (typeof candidate !== 'string' || candidate.trim().length < min || candidate.trim().length > max) {
    errors.push(issue(field, 'invalid_string', `Must contain between ${min} and ${max} characters.`))
  }
}

function optionalString(
  value: JsonObject,
  field: string,
  errors: ApiFieldError[],
  max: number,
) {
  const candidate = value[field]
  if (candidate === undefined || candidate === null) return
  if (typeof candidate !== 'string' || candidate.length > max) {
    errors.push(issue(field, 'invalid_string', `Must be a string of at most ${max} characters or null.`))
  }
}

function requireUuid(value: JsonObject, field: string, errors: ApiFieldError[]) {
  const candidate = value[field]
  if (typeof candidate !== 'string' || !UUID_PATTERN.test(candidate)) {
    errors.push(issue(field, 'invalid_uuid', 'Must be a valid UUID.'))
  }
}

function optionalDate(value: JsonObject, field: string, errors: ApiFieldError[]) {
  const candidate = value[field]
  if (candidate === undefined || candidate === null) return
  const parsed = typeof candidate === 'string' && DATE_PATTERN.test(candidate)
    ? new Date(`${candidate}T00:00:00Z`)
    : null
  if (!parsed || Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== candidate) {
    errors.push(issue(field, 'invalid_date', 'Must use YYYY-MM-DD format.'))
  }
}

function optionalTime(value: JsonObject, field: string, errors: ApiFieldError[]) {
  const candidate = value[field]
  if (candidate === undefined || candidate === null) return
  if (typeof candidate !== 'string' || !TIME_PATTERN.test(candidate)) {
    errors.push(issue(field, 'invalid_time', 'Must use HH:mm:ss format.'))
  }
}

function validateCurrency(value: JsonObject, errors: ApiFieldError[]) {
  const currency = value.currency_code
  if (typeof currency !== 'string' || !CURRENCY_PATTERN.test(currency)) {
    errors.push(issue('currency_code', 'invalid_currency', 'Must be an uppercase three-letter currency code.'))
  }
}

function finish<T>(value: JsonObject, errors: ApiFieldError[]): ValidationResult<T> {
  return errors.length > 0
    ? { ok: false, fieldErrors: errors }
    : { ok: true, value: value as unknown as T }
}

export function validateCreateEventRequest(input: unknown): ValidationResult<CreateEventRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }

  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, [
    'name', 'description', 'event_type', 'event_emoji', 'event_date', 'event_time',
    'event_end_date', 'event_end_time', 'venue_name', 'venue_address', 'currency_code',
    'organisers',
  ], errors)
  requireString(value, 'name', errors, 3, 200)
  requireString(value, 'event_type', errors, 2, 50)
  optionalString(value, 'description', errors, 4000)
  optionalString(value, 'event_emoji', errors, 16)
  optionalString(value, 'venue_name', errors, 200)
  optionalString(value, 'venue_address', errors, 2000)
  optionalDate(value, 'event_date', errors)
  if (value.event_date === undefined || value.event_date === null) {
    errors.push(issue('event_date', 'required', 'This field is required.'))
  }
  optionalDate(value, 'event_end_date', errors)
  optionalTime(value, 'event_time', errors)
  optionalTime(value, 'event_end_time', errors)
  validateCurrency(value, errors)

  if (value.organisers !== undefined) {
    if (!Array.isArray(value.organisers) || value.organisers.length > 20) {
      errors.push(issue('organisers', 'invalid_array', 'Must be an array containing at most 20 organisers.'))
    } else {
      value.organisers.forEach((organiser, index) => {
        const record = objectValue(organiser)
        if (!record) {
          errors.push(issue(`organisers.${index}`, 'invalid_type', 'Must be an object.'))
          return
        }
        rejectUnknownFields(record, ['name', 'phone'], errors, `organisers.${index}`)
        if (typeof record.name !== 'string' || record.name.trim().length < 1 || record.name.trim().length > 100) {
          errors.push(issue(`organisers.${index}.name`, 'invalid_string', 'Must contain between 1 and 100 characters.'))
        }
        if (typeof record.phone !== 'string' || !PHONE_PATTERN.test(record.phone)) {
          errors.push(issue(`organisers.${index}.phone`, 'invalid_phone', 'Must be an E.164 phone number.'))
        }
      })
    }
  }

  return finish<CreateEventRequest>(value, errors)
}

export function validateCreateFundRequest(input: unknown): ValidationResult<CreateFundRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }

  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, [
    'title', 'description', 'fund_type', 'fund_emoji', 'currency_code', 'goal_amount',
    'type_specific_data', 'event_date', 'event_time', 'event_location',
    'contribution_deadline', 'linked_event_id', 'is_private',
  ], errors)
  requireString(value, 'title', errors, 3, 200)
  requireString(value, 'fund_type', errors, 2, 50)
  optionalString(value, 'description', errors, 4000)
  optionalString(value, 'fund_emoji', errors, 16)
  optionalString(value, 'event_location', errors, 2000)
  validateCurrency(value, errors)
  optionalDate(value, 'event_date', errors)
  optionalDate(value, 'contribution_deadline', errors)
  optionalTime(value, 'event_time', errors)

  if (value.goal_amount !== undefined && value.goal_amount !== null) {
    if (typeof value.goal_amount !== 'string' || !MONEY_PATTERN.test(value.goal_amount)) {
      errors.push(issue('goal_amount', 'invalid_money', 'Must be a non-negative decimal string with at most two decimal places.'))
    }
  }
  if (value.type_specific_data !== undefined && !objectValue(value.type_specific_data)) {
    errors.push(issue('type_specific_data', 'invalid_type', 'Must be a JSON object.'))
  }
  if (value.linked_event_id !== undefined && value.linked_event_id !== null) {
    requireUuid(value, 'linked_event_id', errors)
    if (value.fund_type !== 'eventFund') {
      errors.push(issue('fund_type', 'invalid_linked_fund_type', 'A fund linked to an event must use the eventFund type.'))
    }
  } else if (value.fund_type === 'eventFund') {
    errors.push(issue('linked_event_id', 'required', 'An eventFund must identify its existing event.'))
  }
  if (value.is_private !== undefined && typeof value.is_private !== 'boolean') {
    errors.push(issue('is_private', 'invalid_boolean', 'Must be true or false.'))
  }

  return finish<CreateFundRequest>(value, errors)
}

export function validateUpdateSupportTicketRequest(input: unknown): ValidationResult<UpdateSupportTicketRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }

  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['ticket_id', 'status', 'priority', 'assigned_to', 'resolution_note'], errors)
  requireUuid(value, 'ticket_id', errors)
  if (value.status !== undefined && !SUPPORT_TICKET_STATUSES.includes(value.status as never)) {
    errors.push(issue('status', 'invalid_status', 'Unsupported support ticket status.'))
  }
  if (value.priority !== undefined && !SUPPORT_TICKET_PRIORITIES.includes(value.priority as never)) {
    errors.push(issue('priority', 'invalid_priority', 'Unsupported support ticket priority.'))
  }
  optionalString(value, 'assigned_to', errors, 100)
  optionalString(value, 'resolution_note', errors, 4000)
  if (['status', 'priority', 'assigned_to', 'resolution_note'].every(field => value[field] === undefined)) {
    errors.push(issue('body', 'empty_patch', 'At least one ticket field must be supplied.'))
  }
  return finish<UpdateSupportTicketRequest>(value, errors)
}

export function validateModerateUserRequest(input: unknown): ValidationResult<ModerateUserRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }

  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['user_id', 'action', 'reason'], errors)
  requireUuid(value, 'user_id', errors)
  if (!USER_MODERATION_ACTIONS.includes(value.action as never)) {
    errors.push(issue('action', 'invalid_action', 'Unsupported user moderation action.'))
  }
  optionalString(value, 'reason', errors, 1000)
  if ((value.action === 'flag' || value.action === 'ban') && (typeof value.reason !== 'string' || !value.reason.trim())) {
    errors.push(issue('reason', 'required', 'A reason is required for this action.'))
  }
  return finish<ModerateUserRequest>(value, errors)
}

export function validateModerateFundRequest(input: unknown): ValidationResult<ModerateFundRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }

  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['fund_id', 'action', 'reason'], errors)
  requireUuid(value, 'fund_id', errors)
  if (!FUND_MODERATION_ACTIONS.includes(value.action as never)) {
    errors.push(issue('action', 'invalid_action', 'Unsupported fund moderation action.'))
  }
  optionalString(value, 'reason', errors, 1000)
  if (typeof value.reason !== 'string' || !value.reason.trim()) {
    errors.push(issue('reason', 'required', 'A reason is required for fund moderation.'))
  }
  return finish<ModerateFundRequest>(value, errors)
}

export function validateUpsertPlatformAdminRequest(input: unknown): ValidationResult<UpsertPlatformAdminRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }

  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['user_id', 'role', 'status'], errors)
  requireUuid(value, 'user_id', errors)
  if (!PLATFORM_ADMIN_ROLES.includes(value.role as never)) {
    errors.push(issue('role', 'invalid_role', 'Unsupported platform administrator role.'))
  }
  if (!PLATFORM_ADMIN_STATUSES.includes(value.status as never)) {
    errors.push(issue('status', 'invalid_status', 'Unsupported platform administrator status.'))
  }
  return finish<UpsertPlatformAdminRequest>(value, errors)
}
