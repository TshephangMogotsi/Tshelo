import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Contribution,
  ContributorPledgeBalance,
  CreateContributionRequest,
  CreatePledgeAllocationRequest,
  CreateSponsorshipAllocationRequest,
  DetectedPaymentAssignmentRequest,
  DetectedPaymentAssignmentResult,
  FundContributor,
  PledgeAllocation,
  RefundContributionRequest,
  SponsorshipAllocation,
  UpdateContributionRequest,
} from '@shared/contracts/contributions'
import type {
  CreateExpensesRequest,
  CreateExpensesResult,
  Expense,
  ListExpensesRequest,
  UpdateExpenseRequest,
} from '@shared/contracts/expenses'
import type {
  CreateReceiptUploadSessionRequest,
  ParsedReceipt,
  ReceiptUploadSession,
} from '@shared/contracts/receipts'
import type { Paginated } from '@shared/contracts/common'
import { type ContributionRow, toContribution } from './api-records'
import {
  type ApiDataResult,
  createPage,
  createQueryScope,
  dataFailure,
  dataSuccess,
  resolvePageWindow,
} from './api-pagination'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const CONTRIBUTION_SELECT = 'id, fund_id, contributor_id, user_id, contributor_name, contributor_phone, amount, pledged_amount, currency_code, payment_method, reference_number, status, detected_via, is_refunded, confirmed_at, receipt_number, notes, created_at, updated_at'
const EXPENSE_SELECT = 'id, fund_id, added_by, description, item_name, category, amount, currency_code, quantity, unit_price, vendor_name, receipt_url, is_sponsored, sponsored_by_user_id, sponsored_by_name, has_open_query, created_at, updated_at'
const RECEIPT_BUCKET = 'receipts'
const RECEIPT_SESSION_SECONDS = 2 * 60 * 60

function validUuid(value: string) {
  return UUID_PATTERN.test(value)
}

function money(value: unknown) {
  const normalized = String(value ?? '0').trim()
  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return '0.00'
  return `${match[1]}.${(match[2] ?? '').padEnd(2, '0')}`
}

function toExpense(row: Record<string, unknown>): Expense {
  return {
    id: row.id as string,
    fund_id: row.fund_id as string,
    added_by: row.added_by as string,
    description: row.description as string,
    item_name: row.item_name as string | null,
    category: row.category as string | null,
    amount: money(row.amount),
    currency_code: row.currency_code as Expense['currency_code'],
    quantity: row.quantity === null ? null : money(row.quantity),
    unit_price: row.unit_price === null ? null : money(row.unit_price),
    vendor_name: row.vendor_name as string | null,
    receipt_path: row.receipt_url as string | null,
    is_sponsored: Boolean(row.is_sponsored),
    sponsored_by_user_id: row.sponsored_by_user_id as string | null,
    sponsored_by_name: row.sponsored_by_name as string | null,
    has_open_query: Boolean(row.has_open_query),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function createApiContribution(
  client: SupabaseClient,
  actorUserId: string,
  input: CreateContributionRequest,
): Promise<ApiDataResult<Contribution>> {
  const confirmed = input.status === 'confirmed'
  const now = new Date().toISOString()
  const result = await client.from('contributions').insert({
    fund_id: input.fund_id,
    contributor_id: input.contributor_id ?? null,
    user_id: input.contributor_user_id ?? null,
    contributor_name: input.contributor_name.trim(),
    contributor_phone: input.contributor_phone.trim(),
    tagged_by: actorUserId,
    amount: input.amount,
    pledged_amount: input.status === 'pledged' ? input.amount : input.pledged_amount ?? null,
    currency_code: input.currency_code,
    payment_method: input.status === 'pledged' ? null : input.payment_method ?? null,
    reference_number: input.reference_number ?? null,
    detected_via: input.detected_via ?? 'manual',
    status: input.status,
    confirmed_by: confirmed ? actorUserId : null,
    confirmed_at: confirmed ? now : null,
    notes: input.notes ?? null,
    disclaimer_accepted: Boolean(input.disclaimer_accepted),
    disclaimer_accepted_at: input.disclaimer_accepted ? now : null,
  }).select(CONTRIBUTION_SELECT).single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(toContribution(result.data as ContributionRow))
}

export async function updateApiContribution(
  client: SupabaseClient,
  actorUserId: string,
  contributionId: string,
  input: UpdateContributionRequest,
): Promise<ApiDataResult<Contribution | null>> {
  if (!validUuid(contributionId)) return dataFailure({ kind: 'validation', message: 'contribution_id must be a valid UUID.' })
  const changes: Record<string, unknown> = { ...input }
  if (input.status === 'confirmed') {
    changes.confirmed_by = actorUserId
    changes.confirmed_at = new Date().toISOString()
  } else if (input.status !== undefined) {
    changes.confirmed_by = null
    changes.confirmed_at = null
  }
  if (input.status === 'pledged') {
    changes.payment_method = null
    changes.pledged_amount = input.amount ?? input.pledged_amount
  }
  const result = await client.from('contributions').update(changes).eq('id', contributionId).select(CONTRIBUTION_SELECT).maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? toContribution(result.data as ContributionRow) : null)
}

export async function refundApiContribution(
  client: SupabaseClient,
  actorUserId: string,
  contributionId: string,
  input: RefundContributionRequest,
): Promise<ApiDataResult<Contribution | null>> {
  const now = new Date().toISOString()
  const result = await client.from('contributions').update({
    status: 'refunded',
    is_refunded: true,
    refunded_at: now,
    refund_confirmed_by: actorUserId,
    refund_confirmed_at: now,
    notes: input.reason?.trim() || undefined,
  }).eq('id', contributionId).select(CONTRIBUTION_SELECT).maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? toContribution(result.data as ContributionRow) : null)
}

export async function assignApiDetectedPayment(
  client: SupabaseClient,
  input: DetectedPaymentAssignmentRequest,
): Promise<ApiDataResult<DetectedPaymentAssignmentResult>> {
  const result = await client.rpc('record_detected_contribution', {
    p_fund_id: input.fund_id,
    p_detected: input.detected,
    p_notification_id: input.notification_id ?? null,
  }).single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data as DetectedPaymentAssignmentResult)
}

export async function listApiFundContributors(client: SupabaseClient, fundId: string): Promise<ApiDataResult<FundContributor[]>> {
  const result = await client.from('fund_contributors')
    .select('id, fund_id, user_id, display_name, phone, contributor_type, created_at')
    .eq('fund_id', fundId)
    .order('display_name', { ascending: true })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess((result.data ?? []).map(row => ({
    id: row.id as string, fund_id: row.fund_id as string, user_id: row.user_id as string | null,
    display_name: row.display_name as string, phone: row.phone as string,
    contributor_type: row.contributor_type as FundContributor['contributor_type'], created_at: row.created_at as string,
  })))
}

export async function listApiPledgeBalances(
  client: SupabaseClient,
  fundId: string,
  contributorId?: string,
): Promise<ApiDataResult<ContributorPledgeBalance[]>> {
  let query = client.from('contributor_pledge_balances')
    .select('pledge_id, fund_id, contributor_id, contributor_name, pledged_amount, allocated_amount, outstanding_amount, pledge_state, created_at')
    .eq('fund_id', fundId)
  if (contributorId) query = query.eq('contributor_id', contributorId)
  const result = await query.order('created_at', { ascending: true })
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess((result.data ?? []).map(row => ({
    pledge_id: row.pledge_id as string, fund_id: row.fund_id as string, contributor_id: row.contributor_id as string,
    contributor_name: row.contributor_name as string, pledged_amount: money(row.pledged_amount),
    allocated_amount: money(row.allocated_amount), outstanding_amount: money(row.outstanding_amount),
    pledge_state: row.pledge_state as ContributorPledgeBalance['pledge_state'], created_at: row.created_at as string,
  })))
}

export async function createApiPledgeAllocation(client: SupabaseClient, actorUserId: string, input: CreatePledgeAllocationRequest): Promise<ApiDataResult<PledgeAllocation>> {
  const result = await client.from('pledge_allocations').insert({ ...input, created_by: actorUserId }).select('id, fund_id, contributor_id, pledge_contribution_id, payment_contribution_id, amount, created_by, created_at').single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({ ...result.data, amount: money(result.data.amount) } as PledgeAllocation)
}

export async function createApiSponsorshipAllocation(client: SupabaseClient, actorUserId: string, input: CreateSponsorshipAllocationRequest): Promise<ApiDataResult<SponsorshipAllocation>> {
  const result = await client.from('sponsorship_item_allocations').insert({ ...input, created_by: actorUserId }).select('id, fund_id, sponsorship_item_id, contribution_id, amount, created_by, created_at').single()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({ ...result.data, amount: money(result.data.amount) } as SponsorshipAllocation)
}

export async function listApiExpenses(client: SupabaseClient, input: ListExpensesRequest): Promise<ApiDataResult<Paginated<Expense>>> {
  if (!input.fund_id) return dataFailure({ kind: 'validation', message: 'fund_id is required.' })
  const scope = createQueryScope('expenses', { fund_id: input.fund_id, sponsored_by_user_id: input.sponsored_by_user_id, from: input.from, to: input.to, sort_by: input.sort_by, sort_direction: input.sort_direction })
  const window = resolvePageWindow(input, scope)
  if (window.error) return window
  const sortBy = input.sort_by ?? 'created_at'
  const ascending = (input.sort_direction ?? 'desc') === 'asc'
  let query = client.from('expenses').select(EXPENSE_SELECT).eq('fund_id', input.fund_id).is('deleted_at', null)
  if (input.sponsored_by_user_id) query = query.eq('sponsored_by_user_id', input.sponsored_by_user_id)
  if (input.from) query = query.gte('created_at', `${input.from}T00:00:00.000Z`)
  if (input.to) query = query.lte('created_at', `${input.to}T23:59:59.999Z`)
  const result = await query.order(sortBy, { ascending }).order('id', { ascending }).range(window.data.offset, window.data.offset + window.data.limit)
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(createPage(result.data ?? [], window.data, row => toExpense(row as Record<string, unknown>)))
}

export async function createApiExpenses(client: SupabaseClient, actorUserId: string, input: CreateExpensesRequest): Promise<ApiDataResult<CreateExpensesResult>> {
  if (input.items.some(item => item.receipt_path && !validReceiptPath(item.receipt_path, input.fund_id, actorUserId))) {
    return dataFailure({ kind: 'validation', message: 'Receipt paths must belong to this caller and fund.' })
  }
  const rows = input.items.map(item => ({
    fund_id: input.fund_id, added_by: actorUserId, description: item.description.trim(),
    item_name: item.item_name ?? null, category: item.category ?? null, amount: item.amount,
    currency_code: item.currency_code, quantity: item.quantity ?? null, unit_price: item.unit_price ?? null,
    vendor_name: item.vendor_name ?? null, receipt_url: item.receipt_path ?? null,
    is_sponsored: Boolean(item.sponsored_by_user_id), sponsored_by_user_id: item.sponsored_by_user_id ?? null,
    sponsored_by_name: item.sponsored_by_name ?? null,
  }))
  const result = await client.from('expenses').insert(rows).select(EXPENSE_SELECT)
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  const expenses = (result.data ?? []).map(row => toExpense(row as Record<string, unknown>))
  if (input.fulfill_sponsorship_item_id && expenses[0]) {
    const sponsorship = await client.from('fund_sponsorship_items').update({
      status: 'fulfilled', linked_expense_id: expenses[0].id, fulfilled_at: new Date().toISOString(),
    }).eq('id', input.fulfill_sponsorship_item_id).eq('fund_id', input.fund_id).select('id').maybeSingle()
    if (sponsorship.error || !sponsorship.data) {
      return dataSuccess({ expenses, sponsorship_fulfilled: false })
    }
  }
  return dataSuccess({ expenses, sponsorship_fulfilled: true })
}

export async function updateApiExpense(client: SupabaseClient, expenseId: string, input: UpdateExpenseRequest): Promise<ApiDataResult<Expense | null>> {
  const changes: Record<string, unknown> = { ...input }
  if (input.description) changes.item_name = input.item_name ?? input.description
  if (input.sponsored_by_user_id !== undefined) changes.is_sponsored = Boolean(input.sponsored_by_user_id)
  const result = await client.from('expenses').update(changes).eq('id', expenseId).is('deleted_at', null).select(EXPENSE_SELECT).maybeSingle()
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess(result.data ? toExpense(result.data as Record<string, unknown>) : null)
}

export async function createApiReceiptUploadSession(
  client: SupabaseClient,
  actorUserId: string,
  input: CreateReceiptUploadSessionRequest,
): Promise<ApiDataResult<ReceiptUploadSession>> {
  const extension = input.content_type === 'image/png' ? 'png' : 'jpg'
  const objectPath = `${input.fund_id}/${actorUserId}/${crypto.randomUUID()}.${extension}`
  const result = await client.storage.from(RECEIPT_BUCKET).createSignedUploadUrl(objectPath)
  if (result.error) return dataFailure({ kind: 'database', error: result.error })
  return dataSuccess({
    object_path: objectPath,
    upload_url: result.data.signedUrl,
    content_type: input.content_type,
    expires_at: new Date(Date.now() + RECEIPT_SESSION_SECONDS * 1000).toISOString(),
  })
}

function validReceiptPath(path: string, fundId: string, actorUserId: string) {
  return path.startsWith(`${fundId}/${actorUserId}/`) && /^[0-9a-f/-]+\.(?:jpg|png)$/i.test(path)
}

export async function parseApiReceipt(
  client: SupabaseClient,
  actorUserId: string,
  fundId: string,
  objectPath: string,
): Promise<ApiDataResult<ParsedReceipt>> {
  if (!validReceiptPath(objectPath, fundId, actorUserId)) {
    return dataFailure({ kind: 'validation', message: 'The receipt object path does not belong to this caller and fund.' })
  }
  const result = await client.functions.invoke('parse-receipt', {
    body: { fundId, receiptPath: objectPath },
  })
  if (result.error) return dataFailure({ kind: 'database', error: { message: result.error.message } })
  const parsed = result.data as Record<string, unknown> | null
  if (!parsed || parsed.error) return dataFailure({ kind: 'validation', message: 'The uploaded receipt could not be parsed.' })
  const items = Array.isArray(parsed.items) ? parsed.items : []
  return dataSuccess({
    object_path: objectPath,
    is_receipt: parsed.is_receipt !== false,
    vendor: typeof parsed.vendor === 'string' ? parsed.vendor : null,
    date: typeof parsed.date === 'string' ? parsed.date : null,
    total: parsed.total === null || parsed.total === undefined ? null : money(parsed.total),
    items: items.flatMap(item => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      if (typeof row.name !== 'string') return []
      return [{ name: row.name, amount: money(row.amount), category: typeof row.category === 'string' ? row.category : null }]
    }),
  })
}
