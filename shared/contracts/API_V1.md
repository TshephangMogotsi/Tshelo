# Tshelo API v1 endpoints

Status: mobile API migration, 18 August 2026

Mutation endpoints accept JSON request bodies. Every endpoint returns the shared `ApiResponse<T>` JSON envelope, sets `Cache-Control: no-store`, and includes the same generated request ID in the JSON `request_id` field and `X-Request-Id` response header.

Public discovery and documentation endpoints:

- `GET /api/v1` returns API availability, authentication guidance, resource links, and documentation links.
- `GET /api/openapi` returns the OpenAPI 3.1 contract used by tooling and API clients.
- `GET /api/docs` renders the interactive Scalar API reference, including examples and a browser-based request client.

Authenticated calls require `Authorization: Bearer <supabase-access-token>`. The API verifies the token and runs database work with the caller-scoped Supabase client. Request user IDs identify targets only; they never establish the actor.

| Method | Path | Request contract | Response data | Database boundary |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/users` | `ListUsersRequest` query | `Paginated<UserSummary>` | Caller-scoped `users` query; active platform admin required. |
| `GET` | `/api/v1/users/:userId` | UUID path parameter | `User` | Caller-scoped `users` query; RLS decides visibility. |
| `GET` | `/api/v1/events` | `ListEventsRequest` query | `Paginated<EventSummary>` | Caller-scoped `events` query; RLS decides visibility. |
| `GET` | `/api/v1/events/:eventId` | UUID path parameter | `{ event: Event; guests: EventGuest[] }` | Caller-scoped `events` and `event_guests` queries; RLS decides visibility. |
| `POST` | `/api/v1/events` | `CreateEventRequest` | `Event` | `create_standalone_event(...)` |
| `PATCH` | `/api/v1/events/:eventId` | `UpdateEventRequest` | `Event` | Caller-scoped event update; RLS decides authorization. |
| `DELETE` | `/api/v1/events/:eventId` | UUID path parameter | `{}` | `delete_event_only(...)` |
| `GET` | `/api/v1/events/:eventId/workspace` | UUID path parameter | `EventWorkspace` | Caller-scoped event, guest, budget, announcement, organiser, permission, and optional fund-workspace reads. |
| `POST` | `/api/v1/events/:eventId/leave` | UUID path parameter | `LeftEvent` | `leave_event(...)` |
| `POST` | `/api/v1/events/:eventId/complete` | `CompleteEventRequest` | `Event` | Caller-scoped standalone-event completion; RLS decides authorization. |
| `GET/PUT` | `/api/v1/events/:eventId/budget` | UUID path parameter / `UpdateEventBudgetRequest` | `EventBudget \| null` / `EventBudget` | Caller-scoped budget read/upsert; RLS decides authorization. |
| `POST` | `/api/v1/events/:eventId/announcements` | `CreateEventAnnouncementRequest` | `EventAnnouncement` | Caller-scoped announcement insert; RLS decides authorization. |
| `POST` | `/api/v1/events/:eventId/organiser-invites` | `InviteEventOrganiserRequest` | `{}` | `invite_event_fund_organiser(...)` |
| `GET` | `/api/v1/events/invite-preview` | `code` query | `EventInvitePreview` | `find_event_by_code(...)` |
| `POST` | `/api/v1/events/join` | `JoinEventRequest` | `JoinedEvent` | `join_event_by_code(...)` |
| `POST` | `/api/v1/events/event-funds` | `CreateEventFundRequest` | `CreatedEventFund` | `create_event_fund(...)`, followed by a caller-scoped venue-address update when supplied. |
| `GET` | `/api/v1/funds` | `ListFundsRequest` query | `Paginated<FundSummary>` | Caller-scoped `funds` query; RLS decides visibility. |
| `GET` | `/api/v1/funds/:fundId` | UUID path parameter | `FundDetail` | Caller-scoped fund, membership, contribution, expense, and member queries; RLS decides visibility. |
| `POST` | `/api/v1/funds` | `CreateFundRequest` | `Fund` | A linked `eventFund` uses `create_fund_for_existing_event(...)`; an unlinked standalone fund is one caller-scoped RLS insert. |
| `GET` | `/api/v1/funds/:fundId/report` | UUID path parameter | `FundReportBundle` | `get_fund_report_bundle(...)` returns all report and audit/edit history from one caller-scoped database statement snapshot. |
| `POST` | `/api/v1/funds/:fundId/exports` | `CreateFundExportRequest` | `FundExport` | `log_fund_export(...)` derives the exporter from `auth.uid()` and enforces `export_reports`. |
| `GET` | `/api/v1/contributions` | `ListContributionsRequest` query | `Paginated<ContributionSummary>` | Caller-scoped `contributions` query; RLS decides visibility. |
| `GET` | `/api/v1/contributions/:contributionId` | UUID path parameter | `Contribution` | Caller-scoped `contributions` query; RLS decides visibility. |
| `GET` | `/api/v1/admin/support-tickets` | `ListSupportTicketsRequest` query | `Paginated<SupportTicketSummary>` | Caller-scoped query after active platform-admin authorization. |
| `PATCH` | `/api/v1/admin/support-tickets` | `UpdateSupportTicketRequest` | `SupportTicketSummary` | `platform_admin_update_support_ticket(...)` |
| `GET` | `/api/v1/admin/audit` | `ListAdminAuditRequest` query | `Paginated<AdminAuditEntry>` | Caller-scoped query after active platform-admin authorization. |
| `POST` | `/api/v1/admin/users/moderate` | `ModerateUserRequest` | `UserSummary` | `platform_admin_moderate_user(...)` |
| `POST` | `/api/v1/admin/funds/moderate` | `ModerateFundRequest` | `FundSummary` | `platform_admin_moderate_fund(...)` |
| `PUT` | `/api/v1/admin/platform-admins` | `UpsertPlatformAdminRequest` | `PlatformAdmin` | `platform_admin_upsert(...)` |

Admin reads require an active `platform_admins` record and still use the caller-scoped client, so database RLS remains in force. The four admin mutations first apply the shared TypeScript role matrix for an early `403`, then the operation-specific database RPC repeats authorization and atomically performs the row lock, mutation, and audit insertion.

## Typed read-side services

The server-only data layer now implements the shared list contracts for users, funds, events, contributions, support tickets, and platform-admin audit history. It also implements detail reads for users, funds, events with guests, and contributions.

These services:

- accept a caller-scoped Supabase client and never create a service-role client;
- select only contract fields and map database rows through explicit public-record mappers;
- convert every database numeric money value into a decimal string;
- use a default page size of 25 and enforce the shared maximum of 100;
- issue opaque, query-scoped cursors and reject malformed or cross-query cursors;
- validate sort fields and UUID filters before building a database query;
- preserve RLS for all list, detail, membership, and aggregate reads.

The stable server-side export is `admin/lib/data/api.ts`. Route handlers are thin adapters around these services and do not rebuild filtering, mapping, aggregation, or pagination rules.

## Read query behavior

List handlers accept only the query fields defined by their shared request contract. Unknown fields, duplicate scalar fields, unsupported enum or sort values, malformed UUIDs, invalid date ranges, and limits outside `1..100` return `422 VALIDATION_FAILED`. Multi-value filters can be repeated or supplied as comma-separated values. Detail path IDs must be UUIDs.

List and detail handlers authenticate before parsing query or path input. Dynamic route parameters use the asynchronous App Router `params` contract. A resource hidden by RLS is returned as `404 NOT_FOUND`, without revealing whether it exists outside the caller's scope.

## Error behavior

- Malformed JSON or the wrong content type returns `400 BAD_REQUEST`.
- Contract validation returns `422 VALIDATION_FAILED` with structured `field_errors`.
- Authentication and authorization return `401 UNAUTHENTICATED` or `403 FORBIDDEN`.
- Missing resources return `404 NOT_FOUND`.
- Unique conflicts and invalid lifecycle transitions return `409 CONFLICT`.
- Unexpected database failures return a generic, retryable `500 INTERNAL_ERROR`; raw SQL errors are never returned to clients.
