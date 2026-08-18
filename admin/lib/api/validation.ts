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
import type {
  CreateContributionRequest,
  CreatePledgeAllocationRequest,
  CreateSponsorshipAllocationRequest,
  DetectedPaymentAssignmentRequest,
  RefundContributionRequest,
  UpdateContributionRequest,
} from '@shared/contracts/contributions'
import { PAYMENT_METHODS } from '@shared/contracts/contributions'
import type { CreateEventRequest, RespondOrganiserInviteRequest } from '@shared/contracts/events'
import type {
  ConfigureFundAdminRequest,
  CreateFundRequest,
  CreateFundSponsorshipRequest,
  JoinFundRequest,
  UpdateFundMemberRequest,
  UpdateFundRequest,
  UpdateFundSponsorshipRequest,
} from '@shared/contracts/funds'
import {
  FUND_MEMBER_STATUSES,
  FUND_PERMISSION_KEYS,
  FUND_STATUSES,
} from '@shared/contracts/funds'
import type { MarkNotificationsReadRequest } from '@shared/contracts/notifications'
import type { CreateExpensesRequest, UpdateExpenseRequest } from '@shared/contracts/expenses'
import type { CreateReceiptUploadSessionRequest, ParseReceiptRequest } from '@shared/contracts/receipts'
import { RECEIPT_MEDIA_TYPES } from '@shared/contracts/receipts'
import type { CreateRichAuntieAwardRequest } from '@shared/contracts/rich-auntie'
import { RICH_AUNTIE_REASON_CODES } from '@shared/contracts/rich-auntie'
import type { CreateFundExportRequest } from '@shared/contracts/reports'
import { FUND_EXPORT_TYPES } from '@shared/contracts/reports'
import type { UpdateCurrentUserRequest } from '@shared/contracts/users'

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

function optionalBoolean(value: JsonObject, field: string, errors: ApiFieldError[]) {
  const candidate = value[field]
  if (candidate !== undefined && typeof candidate !== 'boolean') {
    errors.push(issue(field, 'invalid_boolean', 'Must be true or false.'))
  }
}

function optionalIsoDateTime(value: JsonObject, field: string, errors: ApiFieldError[]) {
  const candidate = value[field]
  if (candidate === undefined) return
  if (
    typeof candidate !== 'string' ||
    !candidate.includes('T') ||
    Number.isNaN(Date.parse(candidate))
  ) {
    errors.push(issue(field, 'invalid_datetime', 'Must be a valid ISO 8601 date-time.'))
  }
}

function validateCurrency(value: JsonObject, errors: ApiFieldError[]) {
  const currency = value.currency_code
  if (typeof currency !== 'string' || !CURRENCY_PATTERN.test(currency)) {
    errors.push(issue('currency_code', 'invalid_currency', 'Must be an uppercase three-letter currency code.'))
  }
}

function validateMoney(
  value: JsonObject,
  field: string,
  errors: ApiFieldError[],
  optional = false,
  nullable = false,
) {
  const candidate = value[field]
  if (optional && candidate === undefined) return
  if (nullable && candidate === null) return
  if (typeof candidate !== 'string' || !MONEY_PATTERN.test(candidate) || Number(candidate) <= 0) {
    errors.push(issue(field, 'invalid_money', 'Must be a positive decimal string with at most two decimal places.'))
  }
}

function optionalUuid(value: JsonObject, field: string, errors: ApiFieldError[]) {
  const candidate = value[field]
  if (candidate === undefined || candidate === null) return
  if (typeof candidate !== 'string' || !UUID_PATTERN.test(candidate)) {
    errors.push(issue(field, 'invalid_uuid', 'Must be a valid UUID or null.'))
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

export function validateUpdateCurrentUserRequest(
  input: unknown,
): ValidationResult<UpdateCurrentUserRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }

  const allowed = [
    'name', 'email', 'avatar_url', 'country_code', 'preferred_currency',
    'notifications_enabled', 'mobile_money_provider', 'bank_name', 'bank_branch_code',
    'bank_account_number', 'profile_completed', 'onboarding_completed',
    'terms_accepted_at', 'terms_version', 'privacy_accepted_at', 'privacy_version',
    'data_processing_consent', 'data_processing_consent_at',
  ] as const
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, allowed, errors)

  if (value.name !== undefined) {
    if (typeof value.name !== 'string' || value.name.trim().length < 2 || value.name.trim().length > 100) {
      errors.push(issue('name', 'invalid_string', 'Must contain between 2 and 100 characters.'))
    }
  }
  optionalString(value, 'email', errors, 255)
  if (typeof value.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
    errors.push(issue('email', 'invalid_email', 'Must be a valid email address or null.'))
  }
  optionalString(value, 'avatar_url', errors, 2000)
  optionalString(value, 'mobile_money_provider', errors, 100)
  optionalString(value, 'bank_name', errors, 100)
  optionalString(value, 'bank_branch_code', errors, 50)
  optionalString(value, 'bank_account_number', errors, 100)
  optionalString(value, 'terms_version', errors, 50)
  optionalString(value, 'privacy_version', errors, 50)
  for (const field of ['terms_version', 'privacy_version']) {
    if (value[field] !== undefined && typeof value[field] !== 'string') {
      errors.push(issue(field, 'invalid_string', 'Must be a string.'))
    }
  }

  if (value.country_code !== undefined && (
    typeof value.country_code !== 'string' ||
    !/^[A-Z]{2,3}$/.test(value.country_code)
  )) {
    errors.push(issue('country_code', 'invalid_country', 'Must be a two- or three-letter uppercase country code.'))
  }
  if (value.preferred_currency !== undefined && (
    typeof value.preferred_currency !== 'string' ||
    !CURRENCY_PATTERN.test(value.preferred_currency)
  )) {
    errors.push(issue('preferred_currency', 'invalid_currency', 'Must be an uppercase three-letter currency code.'))
  }

  for (const field of [
    'notifications_enabled', 'profile_completed', 'onboarding_completed',
    'data_processing_consent',
  ]) optionalBoolean(value, field, errors)
  for (const field of [
    'terms_accepted_at', 'privacy_accepted_at', 'data_processing_consent_at',
  ]) optionalIsoDateTime(value, field, errors)

  if (allowed.every(field => value[field] === undefined)) {
    errors.push(issue('body', 'empty_patch', 'At least one profile field must be supplied.'))
  }
  return finish<UpdateCurrentUserRequest>(value, errors)
}

export function validateMarkNotificationsReadRequest(
  input: unknown,
): ValidationResult<MarkNotificationsReadRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }

  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['notification_ids'], errors)
  if (!Array.isArray(value.notification_ids) || value.notification_ids.length < 1 || value.notification_ids.length > 100) {
    errors.push(issue('notification_ids', 'invalid_array', 'Must contain between 1 and 100 notification IDs.'))
  } else {
    const ids = value.notification_ids
    ids.forEach((id, index) => {
      if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
        errors.push(issue(`notification_ids.${index}`, 'invalid_uuid', 'Must be a valid UUID.'))
      }
    })
    if (new Set(ids).size !== ids.length) {
      errors.push(issue('notification_ids', 'duplicate_value', 'Notification IDs must be unique.'))
    }
  }
  return finish<MarkNotificationsReadRequest>(value, errors)
}

export function validateRespondOrganiserInviteRequest(
  input: unknown,
): ValidationResult<RespondOrganiserInviteRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }

  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['invite_id', 'accepted'], errors)
  requireUuid(value, 'invite_id', errors)
  if (typeof value.accepted !== 'boolean') {
    errors.push(issue('accepted', 'invalid_boolean', 'Must be true or false.'))
  }
  return finish<RespondOrganiserInviteRequest>(value, errors)
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

export function validateUpdateFundRequest(input: unknown): ValidationResult<UpdateFundRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const allowed = [
    'title', 'description', 'fund_emoji', 'goal_amount', 'type_specific_data',
    'event_date', 'event_time', 'event_location', 'contribution_deadline',
    'linked_event_id', 'is_private', 'status',
  ] as const
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, allowed, errors)
  if (value.title !== undefined) requireString(value, 'title', errors, 3, 200)
  optionalString(value, 'description', errors, 4000)
  optionalString(value, 'fund_emoji', errors, 16)
  optionalString(value, 'event_location', errors, 2000)
  optionalDate(value, 'event_date', errors)
  optionalDate(value, 'contribution_deadline', errors)
  optionalTime(value, 'event_time', errors)
  optionalBoolean(value, 'is_private', errors)
  if (value.goal_amount !== undefined && value.goal_amount !== null &&
      (typeof value.goal_amount !== 'string' || !MONEY_PATTERN.test(value.goal_amount))) {
    errors.push(issue('goal_amount', 'invalid_money', 'Must be a non-negative decimal string with at most two decimal places.'))
  }
  if (value.type_specific_data !== undefined && !objectValue(value.type_specific_data)) {
    errors.push(issue('type_specific_data', 'invalid_type', 'Must be a JSON object.'))
  }
  if (value.linked_event_id !== undefined && value.linked_event_id !== null) requireUuid(value, 'linked_event_id', errors)
  if (value.status !== undefined && !FUND_STATUSES.includes(value.status as never)) {
    errors.push(issue('status', 'invalid_status', 'Unsupported fund status.'))
  }
  if (allowed.every(field => value[field] === undefined)) errors.push(issue('body', 'empty_patch', 'At least one fund field must be supplied.'))
  return finish<UpdateFundRequest>(value, errors)
}

export function validateJoinFundRequest(input: unknown): ValidationResult<JoinFundRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['code'], errors)
  requireString(value, 'code', errors, 1, 32)
  return finish<JoinFundRequest>(value, errors)
}

export function validateUpdateFundMemberRequest(input: unknown): ValidationResult<UpdateFundMemberRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['status'], errors)
  if (!['joined', 'declined', 'removed'].includes(String(value.status)) ||
      !FUND_MEMBER_STATUSES.includes(value.status as never)) {
    errors.push(issue('status', 'invalid_status', 'Status must be joined, declined, or removed.'))
  }
  return finish<UpdateFundMemberRequest>(value, errors)
}

export function validateConfigureFundAdminRequest(input: unknown): ValidationResult<ConfigureFundAdminRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['permissions'], errors)
  if (!Array.isArray(value.permissions) || value.permissions.length < 1 || value.permissions.length > FUND_PERMISSION_KEYS.length) {
    errors.push(issue('permissions', 'invalid_array', 'Choose at least one valid fund permission.'))
  } else if (new Set(value.permissions).size !== value.permissions.length || value.permissions.some(key => !FUND_PERMISSION_KEYS.includes(key as never))) {
    errors.push(issue('permissions', 'invalid_permission', 'One or more permissions are invalid or duplicated.'))
  }
  return finish<ConfigureFundAdminRequest>(value, errors)
}

export function validateCreateFundSponsorshipRequest(input: unknown): ValidationResult<CreateFundSponsorshipRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['title', 'description', 'category', 'target_amount'], errors)
  requireString(value, 'title', errors, 2, 200)
  optionalString(value, 'description', errors, 500)
  optionalString(value, 'category', errors, 100)
  if (typeof value.target_amount !== 'string' || !MONEY_PATTERN.test(value.target_amount) || Number(value.target_amount) <= 0) {
    errors.push(issue('target_amount', 'invalid_money', 'Must be a positive decimal string with at most two decimal places.'))
  }
  return finish<CreateFundSponsorshipRequest>(value, errors)
}

export function validateUpdateFundSponsorshipRequest(input: unknown): ValidationResult<UpdateFundSponsorshipRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  const allowed = ['title', 'description', 'category', 'target_amount', 'status'] as const
  rejectUnknownFields(value, allowed, errors)
  if (value.title !== undefined) requireString(value, 'title', errors, 2, 200)
  optionalString(value, 'description', errors, 500)
  optionalString(value, 'category', errors, 100)
  if (value.target_amount !== undefined && (typeof value.target_amount !== 'string' || !MONEY_PATTERN.test(value.target_amount) || Number(value.target_amount) <= 0)) {
    errors.push(issue('target_amount', 'invalid_money', 'Must be a positive decimal string with at most two decimal places.'))
  }
  if (value.status !== undefined && !['open', 'claimed', 'funded', 'fulfilled', 'cancelled'].includes(String(value.status))) {
    errors.push(issue('status', 'invalid_status', 'Unsupported sponsorship status.'))
  }
  if (allowed.every(field => value[field] === undefined)) errors.push(issue('body', 'empty_patch', 'At least one sponsorship field must be supplied.'))
  return finish<UpdateFundSponsorshipRequest>(value, errors)
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

export function validateCreateContributionRequest(input: unknown): ValidationResult<CreateContributionRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['fund_id', 'contributor_id', 'contributor_user_id', 'contributor_name', 'contributor_phone', 'amount', 'pledged_amount', 'currency_code', 'payment_method', 'reference_number', 'status', 'notes', 'disclaimer_accepted', 'detected_via'], errors)
  requireUuid(value, 'fund_id', errors)
  optionalUuid(value, 'contributor_id', errors)
  optionalUuid(value, 'contributor_user_id', errors)
  requireString(value, 'contributor_name', errors, 1, 100)
  if (typeof value.contributor_phone !== 'string' || !/^\+?[0-9][0-9 ()-]{5,19}$/.test(value.contributor_phone)) {
    errors.push(issue('contributor_phone', 'invalid_phone', 'Must be a valid phone number.'))
  }
  validateMoney(value, 'amount', errors)
  validateMoney(value, 'pledged_amount', errors, true, true)
  validateCurrency(value, errors)
  if (!['pledged', 'pending', 'confirmed'].includes(String(value.status))) errors.push(issue('status', 'invalid_status', 'Unsupported contribution status.'))
  if (value.payment_method !== undefined && value.payment_method !== null && !PAYMENT_METHODS.includes(value.payment_method as never)) errors.push(issue('payment_method', 'invalid_payment_method', 'Unsupported payment method.'))
  optionalString(value, 'reference_number', errors, 100)
  optionalString(value, 'notes', errors, 2000)
  optionalBoolean(value, 'disclaimer_accepted', errors)
  if (value.detected_via !== undefined && value.detected_via !== 'manual' && value.detected_via !== 'sms') errors.push(issue('detected_via', 'invalid_value', 'Must be manual or sms.'))
  return finish<CreateContributionRequest>(value, errors)
}

export function validateUpdateContributionRequest(input: unknown): ValidationResult<UpdateContributionRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const allowed = ['contributor_name', 'amount', 'pledged_amount', 'payment_method', 'reference_number', 'status', 'notes'] as const
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, allowed, errors)
  if (value.contributor_name !== undefined) requireString(value, 'contributor_name', errors, 1, 100)
  validateMoney(value, 'amount', errors, true)
  validateMoney(value, 'pledged_amount', errors, true, true)
  if (value.payment_method !== undefined && value.payment_method !== null && !PAYMENT_METHODS.includes(value.payment_method as never)) errors.push(issue('payment_method', 'invalid_payment_method', 'Unsupported payment method.'))
  optionalString(value, 'reference_number', errors, 100)
  optionalString(value, 'notes', errors, 2000)
  if (value.status !== undefined && !['pledged', 'pending', 'confirmed', 'disputed'].includes(String(value.status))) errors.push(issue('status', 'invalid_status', 'Use the refund operation to refund a contribution.'))
  if (allowed.every(field => value[field] === undefined)) errors.push(issue('body', 'empty_patch', 'At least one contribution field must be supplied.'))
  return finish<UpdateContributionRequest>(value, errors)
}

export function validateRefundContributionRequest(input: unknown): ValidationResult<RefundContributionRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['reason'], errors)
  optionalString(value, 'reason', errors, 1000)
  return finish<RefundContributionRequest>(value, errors)
}

export function validateDetectedPaymentAssignmentRequest(input: unknown): ValidationResult<DetectedPaymentAssignmentRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['fund_id', 'detected', 'notification_id'], errors)
  requireUuid(value, 'fund_id', errors)
  optionalUuid(value, 'notification_id', errors)
  if (!objectValue(value.detected)) errors.push(issue('detected', 'invalid_type', 'Must be a JSON object.'))
  return finish<DetectedPaymentAssignmentRequest>(value, errors)
}

function validateAllocation(input: unknown, sponsorship: boolean): ValidationResult<CreatePledgeAllocationRequest | CreateSponsorshipAllocationRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const fields = sponsorship
    ? ['fund_id', 'sponsorship_item_id', 'contribution_id', 'amount']
    : ['fund_id', 'contributor_id', 'pledge_contribution_id', 'payment_contribution_id', 'amount']
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, fields, errors)
  fields.filter(field => field !== 'amount').forEach(field => requireUuid(value, field, errors))
  validateMoney(value, 'amount', errors)
  return finish<CreatePledgeAllocationRequest | CreateSponsorshipAllocationRequest>(value, errors)
}

export function validateCreatePledgeAllocationRequest(input: unknown): ValidationResult<CreatePledgeAllocationRequest> {
  return validateAllocation(input, false) as ValidationResult<CreatePledgeAllocationRequest>
}

export function validateCreateSponsorshipAllocationRequest(input: unknown): ValidationResult<CreateSponsorshipAllocationRequest> {
  return validateAllocation(input, true) as ValidationResult<CreateSponsorshipAllocationRequest>
}

function validateExpenseItem(value: JsonObject, errors: ApiFieldError[], prefix: string, partial: boolean) {
  const allowed = partial
    ? ['description', 'item_name', 'category', 'amount', 'quantity', 'unit_price', 'vendor_name', 'sponsored_by_user_id', 'sponsored_by_name']
    : ['description', 'item_name', 'category', 'amount', 'currency_code', 'quantity', 'unit_price', 'vendor_name', 'receipt_path', 'sponsored_by_user_id', 'sponsored_by_name']
  rejectUnknownFields(value, allowed, errors, prefix)
  const field = (name: string) => `${prefix}.${name}`
  if (!partial || value.description !== undefined) {
    if (typeof value.description !== 'string' || value.description.trim().length < 1 || value.description.trim().length > 500) errors.push(issue(field('description'), 'invalid_string', 'Must contain between 1 and 500 characters.'))
  }
  for (const name of ['item_name', 'category', 'vendor_name', 'sponsored_by_name'] as const) {
    const candidate = value[name]
    if (candidate !== undefined && candidate !== null && (typeof candidate !== 'string' || candidate.length > 200)) errors.push(issue(field(name), 'invalid_string', 'Must be a string of at most 200 characters or null.'))
  }
  for (const name of ['amount', 'quantity', 'unit_price'] as const) {
    const candidate = value[name]
    if ((!partial && name === 'amount') || candidate !== undefined) {
      const nullable = name !== 'amount'
      if (!(nullable && candidate === null) && (typeof candidate !== 'string' || !MONEY_PATTERN.test(candidate) || Number(candidate) <= 0)) errors.push(issue(field(name), 'invalid_money', 'Must be a positive decimal string with at most two decimal places.'))
    }
  }
  if (!partial && (typeof value.currency_code !== 'string' || !CURRENCY_PATTERN.test(value.currency_code))) errors.push(issue(field('currency_code'), 'invalid_currency', 'Must be an uppercase three-letter currency code.'))
  for (const name of ['sponsored_by_user_id'] as const) {
    const candidate = value[name]
    if (candidate !== undefined && candidate !== null && (typeof candidate !== 'string' || !UUID_PATTERN.test(candidate))) errors.push(issue(field(name), 'invalid_uuid', 'Must be a valid UUID or null.'))
  }
  if (value.receipt_path !== undefined && value.receipt_path !== null && (typeof value.receipt_path !== 'string' || value.receipt_path.length > 500)) errors.push(issue(field('receipt_path'), 'invalid_string', 'Must be a string of at most 500 characters or null.'))
}

export function validateCreateExpensesRequest(input: unknown): ValidationResult<CreateExpensesRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['fund_id', 'items', 'fulfill_sponsorship_item_id'], errors)
  requireUuid(value, 'fund_id', errors)
  optionalUuid(value, 'fulfill_sponsorship_item_id', errors)
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 50) errors.push(issue('items', 'invalid_array', 'Must contain between 1 and 50 expense items.'))
  else value.items.forEach((item, index) => {
    const record = objectValue(item)
    if (!record) errors.push(issue(`items.${index}`, 'invalid_type', 'Must be a JSON object.'))
    else validateExpenseItem(record, errors, `items.${index}`, false)
  })
  return finish<CreateExpensesRequest>(value, errors)
}

export function validateUpdateExpenseRequest(input: unknown): ValidationResult<UpdateExpenseRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  validateExpenseItem(value, errors, 'body', true)
  if (!Object.keys(value).length) errors.push(issue('body', 'empty_patch', 'At least one expense field must be supplied.'))
  return finish<UpdateExpenseRequest>(value, errors)
}

export function validateCreateReceiptUploadSessionRequest(input: unknown): ValidationResult<CreateReceiptUploadSessionRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['fund_id', 'content_type', 'size_bytes'], errors)
  requireUuid(value, 'fund_id', errors)
  if (!RECEIPT_MEDIA_TYPES.includes(value.content_type as never)) errors.push(issue('content_type', 'invalid_media_type', 'Only JPEG and PNG receipts are supported.'))
  if (!Number.isInteger(value.size_bytes) || Number(value.size_bytes) < 1 || Number(value.size_bytes) > 5 * 1024 * 1024) errors.push(issue('size_bytes', 'invalid_size', 'Receipt size must be between 1 byte and 5 MB.'))
  return finish<CreateReceiptUploadSessionRequest>(value, errors)
}

export function validateParseReceiptRequest(input: unknown): ValidationResult<ParseReceiptRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['fund_id', 'object_path'], errors)
  requireUuid(value, 'fund_id', errors)
  requireString(value, 'object_path', errors, 1, 500)
  return finish<ParseReceiptRequest>(value, errors)
}

export function validateCreateRichAuntieAwardRequest(
  input: unknown,
): ValidationResult<CreateRichAuntieAwardRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, [
    'fund_id', 'recipient_user_id', 'sponsorship_item_id',
    'reason_code', 'reason_label', 'notify_member',
  ], errors)
  requireUuid(value, 'fund_id', errors)
  requireUuid(value, 'recipient_user_id', errors)
  optionalUuid(value, 'sponsorship_item_id', errors)
  if (!RICH_AUNTIE_REASON_CODES.includes(value.reason_code as never)) {
    errors.push(issue('reason_code', 'invalid_reason', 'Unsupported Rich Auntie reason.'))
  }
  requireString(value, 'reason_label', errors, 2, 200)
  if (typeof value.notify_member !== 'boolean') {
    errors.push(issue('notify_member', 'invalid_boolean', 'Must be true or false.'))
  }
  return finish<CreateRichAuntieAwardRequest>(value, errors)
}

export function validateCreateFundExportRequest(
  input: unknown,
): ValidationResult<CreateFundExportRequest> {
  const value = objectValue(input)
  if (!value) return { ok: false, fieldErrors: [issue('body', 'invalid_type', 'Must be a JSON object.')] }
  const errors: ApiFieldError[] = []
  rejectUnknownFields(value, ['export_type'], errors)
  if (!FUND_EXPORT_TYPES.includes(value.export_type as never)) {
    errors.push(issue('export_type', 'invalid_export_type', 'Must be pdf, csv, or share.'))
  }
  return finish<CreateFundExportRequest>(value, errors)
}
