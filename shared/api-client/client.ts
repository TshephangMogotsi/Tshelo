import type {
  AdminAuditEntry,
  ConnectionSummary,
  Contribution,
  ContributionSummary,
  ContributorPledgeBalance,
  CreateContributionRequest,
  CreateExpensesRequest,
  CreateExpensesResult,
  CreatePledgeAllocationRequest,
  CreateReceiptUploadSessionRequest,
  CreateSponsorshipAllocationRequest,
  CreateEventRequest,
  CreateFundRequest,
  Event,
  EventGuest,
  EventSummary,
  EvaluateRewardsResult,
  Expense,
  FundContributor,
  Fund,
  FundActivityDetail,
  FundActivityEntry,
  FundAdminPermissionRow,
  FundDetail,
  FundInvitePreview,
  FundMemberDetails,
  FundMemberDirectoryItem,
  FundPermission,
  FundSponsorshipItem,
  FundSummary,
  FundWorkspace,
  FundReportBundle,
  FundExport,
  CreateFundExportRequest,
  HomeSummary,
  JoinFundRequest,
  JoinFundResult,
  LeaveFundResult,
  ListFundActivityRequest,
  ListAdminAuditRequest,
  ListContributionsRequest,
  ListEventsRequest,
  ListExpensesRequest,
  ListFundsRequest,
  ListNotificationsRequest,
  ListSupportTicketsRequest,
  ListUsersRequest,
  ModerateFundRequest,
  ModerateUserRequest,
  Notification,
  Paginated,
  PlatformAdmin,
  ParsedReceipt,
  ParseReceiptRequest,
  PledgeAllocation,
  ReceiptUploadSession,
  RefundContributionRequest,
  CreateRichAuntieAwardRequest,
  ListRichAuntieAwardsRequest,
  RichAuntieAward,
  RichAuntieCelebration,
  RichAuntieEligibility,
  RichAuntieRecipientHistory,
  RespondOrganiserInviteRequest,
  RespondOrganiserInviteResult,
  RewardProgressOverview,
  RewardSnackbarItem,
  SearchConnectionsRequest,
  SyncOrganiserInvitesResult,
  SupportTicketSummary,
  SponsorshipAllocation,
  UpdateSupportTicketRequest,
  UpdateCurrentUserRequest,
  UpdateFundMemberRequest,
  UpdateFundRequest,
  UpdateFundSponsorshipRequest,
  UpdateContributionRequest,
  UpdateExpenseRequest,
  CreateFundSponsorshipRequest,
  ConfigureFundAdminRequest,
  UpsertPlatformAdminRequest,
  User,
  UserSummary,
} from '../contracts'
import { API_ERROR_CODES, type ApiError, type ApiResponse } from '../contracts/common'
import { toQueryString } from './query'

export type ApiAccessTokenProvider = () => Promise<string | null>

export type TsheloApiClientOptions = {
  baseUrl: string
  getAccessToken: ApiAccessTokenProvider
  refreshAccessToken?: ApiAccessTokenProvider
  fetch?: typeof fetch
  timeoutMs?: number
}

export type ApiCallOptions = {
  signal?: AbortSignal
}

type RequestOptions = ApiCallOptions & {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: object
}

export class TsheloApiError extends Error {
  readonly status: number
  readonly requestId: string | null
  readonly apiError: ApiError

  constructor(status: number, requestId: string | null, apiError: ApiError) {
    super(apiError.message)
    this.name = 'TsheloApiError'
    this.status = status
    this.requestId = requestId
    this.apiError = apiError
  }

  get code() {
    return this.apiError.code
  }

  get retryable() {
    return this.apiError.retryable
  }
}

export class TsheloApiProtocolError extends Error {
  readonly status: number
  readonly requestId: string | null

  constructor(message: string, status: number, requestId: string | null) {
    super(message)
    this.name = 'TsheloApiProtocolError'
    this.status = status
    this.requestId = requestId
  }
}

function normalizeBaseUrl(input: string) {
  const url = new URL(input)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Tshelo API base URL must use HTTP or HTTPS.')
  }
  if (url.username || url.password) {
    throw new Error('Tshelo API base URL must not contain credentials.')
  }
  url.pathname = url.pathname.replace(/\/$/, '')
  url.search = ''
  url.hash = ''
  return url.toString().replace(/\/$/, '')
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (!value || typeof value !== 'object') return false
  const envelope = value as {
    ok?: unknown
    data?: unknown
    error?: { code?: unknown; message?: unknown; retryable?: unknown }
    request_id?: unknown
  }
  if (typeof envelope.ok !== 'boolean' || typeof envelope.request_id !== 'string') return false
  if (envelope.ok) return Object.prototype.hasOwnProperty.call(envelope, 'data')
  return Boolean(
    envelope.error &&
    typeof envelope.error.code === 'string' &&
    (API_ERROR_CODES as readonly string[]).includes(envelope.error.code) &&
    typeof envelope.error.message === 'string' &&
    typeof envelope.error.retryable === 'boolean',
  )
}

function joinSignals(callerSignal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new Error('Tshelo API request timed out.')), timeoutMs)
  const abortFromCaller = () => controller.abort(callerSignal?.reason)

  if (callerSignal?.aborted) abortFromCaller()
  else callerSignal?.addEventListener('abort', abortFromCaller, { once: true })

  return {
    signal: controller.signal,
    release() {
      clearTimeout(timeout)
      callerSignal?.removeEventListener('abort', abortFromCaller)
    },
  }
}

export function createTsheloApiClient(options: TsheloApiClientOptions) {
  const baseUrl = normalizeBaseUrl(options.baseUrl)
  const fetchImpl = options.fetch ?? fetch
  const timeoutMs = options.timeoutMs ?? 15_000
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) {
    throw new Error('Tshelo API timeout must be a positive number.')
  }

  async function execute(path: string, token: string | null, request: RequestOptions) {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (request.body) headers['Content-Type'] = 'application/json'

    const abort = joinSignals(request.signal, timeoutMs)
    try {
      return await fetchImpl(`${baseUrl}${path}`, {
        method: request.method ?? 'GET',
        headers,
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal: abort.signal,
      })
    } finally {
      abort.release()
    }
  }

  async function parse<T>(response: Response): Promise<T> {
    const requestId = response.headers.get('x-request-id')
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new TsheloApiProtocolError(
        'The Tshelo API returned a non-JSON response.',
        response.status,
        requestId,
      )
    }
    if (!requestId) {
      throw new TsheloApiProtocolError(
        'The Tshelo API response is missing its request identifier.',
        response.status,
        null,
      )
    }
    let envelope: unknown
    try {
      envelope = JSON.parse(await response.text())
    } catch {
      throw new TsheloApiProtocolError(
        'The Tshelo API returned invalid JSON.',
        response.status,
        requestId,
      )
    }

    if (!isApiResponse(envelope)) {
      throw new TsheloApiProtocolError(
        'The Tshelo API returned an invalid response envelope.',
        response.status,
        requestId,
      )
    }
    if (requestId !== envelope.request_id) {
      throw new TsheloApiProtocolError(
        'The Tshelo API returned mismatched request identifiers.',
        response.status,
        requestId,
      )
    }
    if (!envelope.ok) {
      if (response.ok) {
        throw new TsheloApiProtocolError(
          'The Tshelo API returned error data with a success status.',
          response.status,
          envelope.request_id,
        )
      }
      throw new TsheloApiError(response.status, envelope.request_id, envelope.error)
    }
    if (!response.ok) {
      throw new TsheloApiProtocolError(
        'The Tshelo API returned success data with an error status.',
        response.status,
        envelope.request_id,
      )
    }

    return envelope.data as T
  }

  async function request<T>(path: string, requestOptions: RequestOptions = {}) {
    let accessToken = await options.getAccessToken()
    let response = await execute(path, accessToken, requestOptions)

    if (response.status === 401 && options.refreshAccessToken) {
      accessToken = await options.refreshAccessToken()
      if (accessToken) response = await execute(path, accessToken, requestOptions)
    }

    return parse<T>(response)
  }

  return {
    users: {
      list(input: ListUsersRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<UserSummary>>(`/api/v1/users${toQueryString(input)}`, call)
      },
      get(userId: string, call?: ApiCallOptions) {
        return request<User>(`/api/v1/users/${encodeURIComponent(userId)}`, call)
      },
      me(call?: ApiCallOptions) {
        return request<User>('/api/v1/users/me', call)
      },
      updateMe(input: UpdateCurrentUserRequest, call?: ApiCallOptions) {
        return request<User>('/api/v1/users/me', { ...call, method: 'PATCH', body: input })
      },
      searchConnections(input: SearchConnectionsRequest, call?: ApiCallOptions) {
        return request<ConnectionSummary[]>(
          `/api/v1/users/connections${toQueryString(input)}`,
          call,
        )
      },
    },
    funds: {
      list(input: ListFundsRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<FundSummary>>(`/api/v1/funds${toQueryString(input)}`, call)
      },
      get(fundId: string, call?: ApiCallOptions) {
        return request<FundDetail>(`/api/v1/funds/${encodeURIComponent(fundId)}`, call)
      },
      create(input: CreateFundRequest, call?: ApiCallOptions) {
        return request<Fund>('/api/v1/funds', { ...call, method: 'POST', body: input })
      },
      update(fundId: string, input: UpdateFundRequest, call?: ApiCallOptions) {
        return request<Fund>(`/api/v1/funds/${encodeURIComponent(fundId)}`, { ...call, method: 'PATCH', body: input })
      },
      remove(fundId: string, call?: ApiCallOptions) {
        return request<Record<string, never>>(`/api/v1/funds/${encodeURIComponent(fundId)}`, { ...call, method: 'DELETE' })
      },
      previewInvite(code: string, call?: ApiCallOptions) {
        return request<FundInvitePreview>(`/api/v1/funds/invite-preview${toQueryString({ code })}`, call)
      },
      join(input: JoinFundRequest, call?: ApiCallOptions) {
        return request<JoinFundResult>('/api/v1/funds/join', { ...call, method: 'POST', body: input })
      },
      leave(fundId: string, call?: ApiCallOptions) {
        return request<LeaveFundResult>(`/api/v1/funds/${encodeURIComponent(fundId)}/leave`, { ...call, method: 'POST' })
      },
      workspace(fundId: string, call?: ApiCallOptions) {
        return request<FundWorkspace>(`/api/v1/funds/${encodeURIComponent(fundId)}/workspace`, call)
      },
      listMembers(fundId: string, call?: ApiCallOptions) {
        return request<FundMemberDirectoryItem[]>(`/api/v1/funds/${encodeURIComponent(fundId)}/members`, call)
      },
      getMember(fundId: string, memberId: string, call?: ApiCallOptions) {
        return request<FundMemberDetails>(`/api/v1/funds/${encodeURIComponent(fundId)}/members/${encodeURIComponent(memberId)}`, call)
      },
      updateMember(fundId: string, memberId: string, input: UpdateFundMemberRequest, call?: ApiCallOptions) {
        return request<Record<string, never>>(`/api/v1/funds/${encodeURIComponent(fundId)}/members/${encodeURIComponent(memberId)}`, { ...call, method: 'PATCH', body: input })
      },
      permissions(fundId: string, call?: ApiCallOptions) {
        return request<FundPermission[]>(`/api/v1/funds/${encodeURIComponent(fundId)}/permissions`, call)
      },
      listAdminPermissions(fundId: string, call?: ApiCallOptions) {
        return request<FundAdminPermissionRow[]>(`/api/v1/funds/${encodeURIComponent(fundId)}/admin-permissions`, call)
      },
      configureAdmin(fundId: string, memberId: string, input: ConfigureFundAdminRequest, call?: ApiCallOptions) {
        return request<Record<string, never>>(`/api/v1/funds/${encodeURIComponent(fundId)}/members/${encodeURIComponent(memberId)}/admin`, { ...call, method: 'PUT', body: input })
      },
      removeAdmin(fundId: string, memberId: string, call?: ApiCallOptions) {
        return request<Record<string, never>>(`/api/v1/funds/${encodeURIComponent(fundId)}/members/${encodeURIComponent(memberId)}/admin`, { ...call, method: 'DELETE' })
      },
      listSponsorships(fundId: string, call?: ApiCallOptions) {
        return request<FundSponsorshipItem[]>(`/api/v1/funds/${encodeURIComponent(fundId)}/sponsorships`, call)
      },
      createSponsorship(fundId: string, input: CreateFundSponsorshipRequest, call?: ApiCallOptions) {
        return request<FundSponsorshipItem>(`/api/v1/funds/${encodeURIComponent(fundId)}/sponsorships`, { ...call, method: 'POST', body: input })
      },
      updateSponsorship(fundId: string, itemId: string, input: UpdateFundSponsorshipRequest, call?: ApiCallOptions) {
        return request<FundSponsorshipItem>(`/api/v1/funds/${encodeURIComponent(fundId)}/sponsorships/${encodeURIComponent(itemId)}`, { ...call, method: 'PATCH', body: input })
      },
      claimSponsorship(fundId: string, itemId: string, call?: ApiCallOptions) {
        return request<FundSponsorshipItem>(`/api/v1/funds/${encodeURIComponent(fundId)}/sponsorships/${encodeURIComponent(itemId)}/claim`, { ...call, method: 'POST' })
      },
      releaseSponsorship(fundId: string, itemId: string, call?: ApiCallOptions) {
        return request<FundSponsorshipItem>(`/api/v1/funds/${encodeURIComponent(fundId)}/sponsorships/${encodeURIComponent(itemId)}/release`, { ...call, method: 'POST' })
      },
      activity(fundId: string, input: ListFundActivityRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<FundActivityEntry>>(`/api/v1/funds/${encodeURIComponent(fundId)}/activity${toQueryString(input)}`, call)
      },
      activityDetail(fundId: string, entryId: string, call?: ApiCallOptions) {
        return request<FundActivityDetail>(`/api/v1/funds/${encodeURIComponent(fundId)}/activity/${encodeURIComponent(entryId)}`, call)
      },
      report(fundId: string, call?: ApiCallOptions) {
        return request<FundReportBundle>(`/api/v1/funds/${encodeURIComponent(fundId)}/report`, call)
      },
      createExport(fundId: string, input: CreateFundExportRequest, call?: ApiCallOptions) {
        return request<FundExport>(`/api/v1/funds/${encodeURIComponent(fundId)}/exports`, { ...call, method: 'POST', body: input })
      },
    },
    home: {
      summary(call?: ApiCallOptions) {
        return request<HomeSummary>('/api/v1/home/summary', call)
      },
    },
    events: {
      list(input: ListEventsRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<EventSummary>>(`/api/v1/events${toQueryString(input)}`, call)
      },
      get(eventId: string, call?: ApiCallOptions) {
        return request<{ event: Event; guests: EventGuest[] }>(
          `/api/v1/events/${encodeURIComponent(eventId)}`,
          call,
        )
      },
      create(input: CreateEventRequest, call?: ApiCallOptions) {
        return request<Event>('/api/v1/events', { ...call, method: 'POST', body: input })
      },
      syncOrganiserInvites(call?: ApiCallOptions) {
        return request<SyncOrganiserInvitesResult>('/api/v1/events/organiser-invites/sync', {
          ...call,
          method: 'POST',
        })
      },
      respondOrganiserInvite(input: RespondOrganiserInviteRequest, call?: ApiCallOptions) {
        return request<RespondOrganiserInviteResult>('/api/v1/events/organiser-invites/respond', {
          ...call,
          method: 'POST',
          body: input,
        })
      },
    },
    notifications: {
      list(input: ListNotificationsRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<Notification>>(
          `/api/v1/notifications${toQueryString(input)}`,
          call,
        )
      },
      get(notificationId: string, call?: ApiCallOptions) {
        return request<Notification>(
          `/api/v1/notifications/${encodeURIComponent(notificationId)}`,
          call,
        )
      },
      markRead(notificationIds: string[], call?: ApiCallOptions) {
        return request<{ updated_ids: string[] }>('/api/v1/notifications', {
          ...call,
          method: 'PATCH',
          body: { notification_ids: notificationIds },
        })
      },
    },
    rewards: {
      evaluate(call?: ApiCallOptions) {
        return request<EvaluateRewardsResult>('/api/v1/rewards/evaluate', {
          ...call,
          method: 'POST',
        })
      },
      progress(call?: ApiCallOptions) {
        return request<RewardProgressOverview>('/api/v1/rewards/progress', call)
      },
      listUnseen(call?: ApiCallOptions) {
        return request<RewardSnackbarItem[]>('/api/v1/rewards/unseen', call)
      },
      markSeen(rewardId: string, call?: ApiCallOptions) {
        return request<Record<string, never>>(
          `/api/v1/rewards/${encodeURIComponent(rewardId)}/seen`,
          { ...call, method: 'PATCH' },
        )
      },
    },
    contributions: {
      list(input: ListContributionsRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<ContributionSummary>>(
          `/api/v1/contributions${toQueryString(input)}`,
          call,
        )
      },
      get(contributionId: string, call?: ApiCallOptions) {
        return request<Contribution>(
          `/api/v1/contributions/${encodeURIComponent(contributionId)}`,
          call,
        )
      },
      create(input: CreateContributionRequest, call?: ApiCallOptions) {
        return request<Contribution>('/api/v1/contributions', { ...call, method: 'POST', body: input })
      },
      update(contributionId: string, input: UpdateContributionRequest, call?: ApiCallOptions) {
        return request<Contribution>(`/api/v1/contributions/${encodeURIComponent(contributionId)}`, { ...call, method: 'PATCH', body: input })
      },
      refund(contributionId: string, input: RefundContributionRequest = {}, call?: ApiCallOptions) {
        return request<Contribution>(`/api/v1/contributions/${encodeURIComponent(contributionId)}/refund`, { ...call, method: 'POST', body: input })
      },
      assignDetected(input: import('../contracts').DetectedPaymentAssignmentRequest, call?: ApiCallOptions) {
        return request<import('../contracts').DetectedPaymentAssignmentResult>('/api/v1/contributions/detected-assignment', { ...call, method: 'POST', body: input })
      },
      listContributors(fundId: string, call?: ApiCallOptions) {
        return request<FundContributor[]>(`/api/v1/funds/${encodeURIComponent(fundId)}/contributors`, call)
      },
      listPledgeBalances(fundId: string, contributorId?: string, call?: ApiCallOptions) {
        return request<ContributorPledgeBalance[]>(`/api/v1/funds/${encodeURIComponent(fundId)}/pledges${toQueryString({ contributor_id: contributorId })}`, call)
      },
      createPledgeAllocation(input: CreatePledgeAllocationRequest, call?: ApiCallOptions) {
        return request<PledgeAllocation>('/api/v1/pledge-allocations', { ...call, method: 'POST', body: input })
      },
      createSponsorshipAllocation(input: CreateSponsorshipAllocationRequest, call?: ApiCallOptions) {
        return request<SponsorshipAllocation>('/api/v1/sponsorship-allocations', { ...call, method: 'POST', body: input })
      },
    },
    expenses: {
      list(input: ListExpensesRequest, call?: ApiCallOptions) {
        return request<Paginated<Expense>>(`/api/v1/expenses${toQueryString(input)}`, call)
      },
      create(input: CreateExpensesRequest, call?: ApiCallOptions) {
        return request<CreateExpensesResult>('/api/v1/expenses', { ...call, method: 'POST', body: input })
      },
      update(expenseId: string, input: UpdateExpenseRequest, call?: ApiCallOptions) {
        return request<Expense>(`/api/v1/expenses/${encodeURIComponent(expenseId)}`, { ...call, method: 'PATCH', body: input })
      },
    },
    receipts: {
      createUploadSession(input: CreateReceiptUploadSessionRequest, call?: ApiCallOptions) {
        return request<ReceiptUploadSession>('/api/v1/receipts/upload-session', { ...call, method: 'POST', body: input })
      },
      parse(input: ParseReceiptRequest, call?: ApiCallOptions) {
        return request<ParsedReceipt>('/api/v1/receipts/parse', { ...call, method: 'POST', body: input })
      },
    },
    richAuntie: {
      eligibility(fundId: string, recipientUserId: string, call?: ApiCallOptions) {
        return request<RichAuntieEligibility>(`/api/v1/rich-auntie/eligibility${toQueryString({ fund_id: fundId, recipient_user_id: recipientUserId })}`, call)
      },
      listAwards(input: ListRichAuntieAwardsRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<RichAuntieAward>>(`/api/v1/rich-auntie/awards${toQueryString(input)}`, call)
      },
      createAward(input: CreateRichAuntieAwardRequest, call?: ApiCallOptions) {
        return request<RichAuntieAward>('/api/v1/rich-auntie/awards', { ...call, method: 'POST', body: input })
      },
      recipientHistory(recipientUserId: string, call?: ApiCallOptions) {
        return request<RichAuntieRecipientHistory>(`/api/v1/rich-auntie/recipients/${encodeURIComponent(recipientUserId)}/history`, call)
      },
      celebration(awardId: string, call?: ApiCallOptions) {
        return request<RichAuntieCelebration>(`/api/v1/rich-auntie/celebrations/${encodeURIComponent(awardId)}`, call)
      },
      status(call?: ApiCallOptions) {
        return request<RichAuntieRecipientHistory>('/api/v1/rich-auntie/status', call)
      },
    },
    admin: {
      listSupportTickets(input: ListSupportTicketsRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<SupportTicketSummary>>(
          `/api/v1/admin/support-tickets${toQueryString(input)}`,
          call,
        )
      },
      updateSupportTicket(input: UpdateSupportTicketRequest, call?: ApiCallOptions) {
        return request<SupportTicketSummary>('/api/v1/admin/support-tickets', {
          ...call,
          method: 'PATCH',
          body: input,
        })
      },
      listAudit(input: ListAdminAuditRequest = {}, call?: ApiCallOptions) {
        return request<Paginated<AdminAuditEntry>>(
          `/api/v1/admin/audit${toQueryString(input)}`,
          call,
        )
      },
      moderateUser(input: ModerateUserRequest, call?: ApiCallOptions) {
        return request<UserSummary>('/api/v1/admin/users/moderate', {
          ...call,
          method: 'POST',
          body: input,
        })
      },
      moderateFund(input: ModerateFundRequest, call?: ApiCallOptions) {
        return request<FundSummary>('/api/v1/admin/funds/moderate', {
          ...call,
          method: 'POST',
          body: input,
        })
      },
      upsertPlatformAdmin(input: UpsertPlatformAdminRequest, call?: ApiCallOptions) {
        return request<PlatformAdmin>('/api/v1/admin/platform-admins', {
          ...call,
          method: 'PUT',
          body: input,
        })
      },
    },
  }
}

export type TsheloApiClient = ReturnType<typeof createTsheloApiClient>
