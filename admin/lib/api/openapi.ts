const bearerSecurity = [{ bearerAuth: [] }]

const uuidPathParameter = (name: string, description: string) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', format: 'uuid' },
})

const listParameters = [
  {
    name: 'cursor',
    in: 'query',
    description: 'Opaque cursor returned by the previous page.',
    schema: { type: 'string' },
  },
  {
    name: 'limit',
    in: 'query',
    description: 'Number of records to return. Defaults to 25; maximum 100.',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  },
  {
    name: 'sort_direction',
    in: 'query',
    schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  },
]

const response = (description: string, schema: Record<string, unknown>, example?: unknown) => ({
  description,
  headers: {
    'X-Request-Id': {
      description: 'Request identifier also returned in the JSON envelope.',
      schema: { type: 'string', format: 'uuid' },
    },
  },
  content: {
    'application/json': {
      schema,
      ...(example === undefined ? {} : { example }),
    },
  },
})

const success = (schema: Record<string, unknown>) => ({
  type: 'object',
  required: ['ok', 'data', 'request_id'],
  properties: {
    ok: { type: 'boolean', const: true },
    data: schema,
    request_id: { type: 'string', format: 'uuid' },
  },
})

const paginated = (itemSchema: string) => success({
  type: 'object',
  required: ['items', 'page'],
  properties: {
    items: { type: 'array', items: { $ref: itemSchema } },
    page: { $ref: '#/components/schemas/Pagination' },
  },
})

const standardErrors = {
  '400': { $ref: '#/components/responses/BadRequest' },
  '401': { $ref: '#/components/responses/Unauthenticated' },
  '403': { $ref: '#/components/responses/Forbidden' },
  '404': { $ref: '#/components/responses/NotFound' },
  '409': { $ref: '#/components/responses/Conflict' },
  '422': { $ref: '#/components/responses/ValidationFailed' },
  '500': { $ref: '#/components/responses/InternalError' },
}

const jsonBody = (schema: Record<string, unknown>, example?: unknown) => ({
  required: true,
  content: {
    'application/json': {
      schema,
      ...(example === undefined ? {} : { example }),
    },
  },
})

const id = '00000000-0000-4000-8000-000000000000'

export const tsheloOpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Tshelo API',
    version: '1.0.0',
    summary: 'One secure API for the Tshelo mobile and web applications.',
    description: [
      'The Tshelo API exposes users, funds, events, contributions, expenses, receipts, and audited platform-admin operations.',
      '',
      'Clients sign in with Supabase phone OTP, then send the Supabase access token as `Authorization: Bearer <token>`.',
      'The API derives the actor from that verified token and preserves Supabase Row Level Security for caller-scoped requests.',
      '',
      'Money values are decimal strings, dates use ISO 8601, and every response uses the same `ok`, `data`/`error`, and `request_id` envelope.',
    ].join('\n'),
    contact: { name: 'Diginav' },
  },
  servers: [
    { url: '/api/v1', description: 'Current host' },
    { url: 'https://tshelo-admin.vercel.app/api/v1', description: 'Production' },
  ],
  tags: [
    { name: 'Users', description: 'User profiles and platform-admin user discovery.' },
    { name: 'Funds', description: 'Fund discovery, detail, and creation.' },
    { name: 'Events', description: 'Event discovery, detail, guests, and creation.' },
    { name: 'Notifications', description: 'Caller-owned notifications and invite responses.' },
    { name: 'Rewards', description: 'Caller reward evaluation, progress, and snackbar delivery.' },
    { name: 'Contributions', description: 'Caller-visible contribution records.' },
    { name: 'Expenses', description: 'Fund expenses and sponsorship attribution.' },
    { name: 'Receipts', description: 'Short-lived direct uploads and receipt parsing.' },
    { name: 'Rich Auntie', description: 'Sponsorship eligibility, recognition awards, recipient history, and celebration status.' },
    { name: 'Platform admin', description: 'Role-gated, audited operations for authorised Tshelo staff.' },
  ],
  security: bearerSecurity,
  paths: {
    '/users': {
      get: {
        tags: ['Users'],
        operationId: 'listUsers',
        summary: 'List platform users',
        description: 'Returns a bounded page of users. An active platform-admin account is required.',
        parameters: [
          ...listParameters,
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Search by name or phone.' },
          { name: 'trust_level', in: 'query', schema: { type: 'array', items: { type: 'string', enum: ['new', 'basic', 'trusted', 'verified'] } }, style: 'form', explode: true },
          { name: 'status', in: 'query', schema: { type: 'array', items: { type: 'string', enum: ['active', 'flagged', 'banned'] } }, style: 'form', explode: true },
          { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['created_at', 'name', 'trust_score'] } },
        ],
        responses: {
          '200': response('Users returned.', paginated('#/components/schemas/UserSummary')),
          ...standardErrors,
        },
      },
    },
    '/users/{userId}': {
      get: {
        tags: ['Users'],
        operationId: 'getUser',
        summary: 'Get a user',
        description: 'Returns the user only when the caller can see it through RLS.',
        parameters: [uuidPathParameter('userId', 'User UUID.')],
        responses: {
          '200': response('User returned.', success({ $ref: '#/components/schemas/User' })),
          ...standardErrors,
        },
      },
    },
    '/users/me': {
      get: {
        tags: ['Users'], operationId: 'getCurrentUser', summary: 'Get the current user profile',
        responses: { '200': response('Profile returned.', success({ $ref: '#/components/schemas/User' })), ...standardErrors },
      },
      patch: {
        tags: ['Users'], operationId: 'updateCurrentUser', summary: 'Update the current user profile',
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateCurrentUserRequest' }),
        responses: { '200': response('Profile updated.', success({ $ref: '#/components/schemas/User' })), ...standardErrors },
      },
    },
    '/users/connections': {
      get: {
        tags: ['Users'], operationId: 'searchConnections', summary: 'Search relationship-scoped connections',
        description: 'Searches only users connected to the caller through active shared funds or events.',
        parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2, maxLength: 100 } }],
        responses: { '200': response('Connections returned.', success({ type: 'array', items: { $ref: '#/components/schemas/ConnectionSummary' } })), ...standardErrors },
      },
    },
    '/funds': {
      get: {
        tags: ['Funds'],
        operationId: 'listFunds',
        summary: 'List visible funds',
        parameters: [
          ...listParameters,
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'owner_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'member_user_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'type', in: 'query', schema: { type: 'array', items: { type: 'string' } }, style: 'form', explode: true },
          { name: 'status', in: 'query', schema: { type: 'array', items: { type: 'string', enum: ['active', 'closed', 'completed', 'cancelled'] } }, style: 'form', explode: true },
          { name: 'linked_event_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['created_at', 'title', 'goal_amount', 'contribution_deadline'] } },
        ],
        responses: {
          '200': response('Funds returned.', paginated('#/components/schemas/FundSummary')),
          ...standardErrors,
        },
      },
      post: {
        tags: ['Funds'],
        operationId: 'createFund',
        summary: 'Create a fund',
        description: 'Creates a standalone fund or an event-linked fund for the authenticated caller.',
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateFundRequest' }, {
          title: 'Kabo Family Fund',
          description: 'Shared family contribution fund.',
          fund_type: 'fund',
          currency_code: 'BWP',
          goal_amount: '25000.00',
          is_private: true,
        }),
        responses: {
          '201': response('Fund created.', success({ $ref: '#/components/schemas/Fund' })),
          ...standardErrors,
        },
      },
    },
    '/funds/{fundId}': {
      get: {
        tags: ['Funds'],
        operationId: 'getFund',
        summary: 'Get fund details',
        description: 'Returns the fund, caller membership, and computed financial totals.',
        parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        responses: {
          '200': response('Fund returned.', success({ $ref: '#/components/schemas/FundDetail' })),
          ...standardErrors,
        },
      },
      patch: {
        tags: ['Funds'], operationId: 'updateFund', summary: 'Update a fund',
        parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        requestBody: jsonBody({ type: 'object', minProperties: 1 }),
        responses: { '200': response('Fund updated.', success({ $ref: '#/components/schemas/Fund' })), ...standardErrors },
      },
      delete: {
        tags: ['Funds'], operationId: 'deleteFund', summary: 'Soft-delete a fund',
        parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        responses: { '200': response('Fund deleted.', success({ type: 'object', maxProperties: 0 })), ...standardErrors },
      },
    },
    '/funds/invite-preview': {
      get: {
        tags: ['Funds'], operationId: 'previewFundInvite', summary: 'Preview an invite code with caller-scoped privacy checks',
        parameters: [{ name: 'code', in: 'query', required: true, schema: { type: 'string', minLength: 1, maxLength: 32 } }],
        responses: { '200': response('Invite preview returned.', success({ type: 'object' })), ...standardErrors },
      },
    },
    '/funds/join': {
      post: {
        tags: ['Funds'], operationId: 'joinFund', summary: 'Join or request access to a fund',
        requestBody: jsonBody({ type: 'object', required: ['code'], properties: { code: { type: 'string' } } }),
        responses: { '200': response('Membership returned.', success({ type: 'object' })), ...standardErrors },
      },
    },
    '/funds/{fundId}/leave': {
      post: {
        tags: ['Funds'], operationId: 'leaveFund', summary: 'Leave a fund', parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        responses: { '200': response('Membership updated.', success({ type: 'object' })), ...standardErrors },
      },
    },
    '/funds/{fundId}/workspace': {
      get: {
        tags: ['Funds'], operationId: 'getFundWorkspace', summary: 'Get the complete mobile fund workspace', parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        responses: { '200': response('Workspace returned.', success({ type: 'object' })), ...standardErrors },
      },
    },
    '/funds/{fundId}/members': {
      get: {
        tags: ['Funds'], operationId: 'listFundMembers', summary: 'List the fund member directory', parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        responses: { '200': response('Members returned.', success({ type: 'array', items: { type: 'object' } })), ...standardErrors },
      },
    },
    '/funds/{fundId}/contributors': {
      get: { tags: ['Contributions'], operationId: 'listFundContributors', summary: 'List member and guest contributor identities', parameters: [uuidPathParameter('fundId', 'Fund UUID.')], responses: { '200': response('Contributors returned.', success({ type: 'array', items: { type: 'object' } })), ...standardErrors } },
    },
    '/funds/{fundId}/pledges': {
      get: { tags: ['Contributions'], operationId: 'listFundPledgeBalances', summary: 'List contributor pledge balances', parameters: [uuidPathParameter('fundId', 'Fund UUID.'), { name: 'contributor_id', in: 'query', schema: { type: 'string', format: 'uuid' } }], responses: { '200': response('Pledge balances returned.', success({ type: 'array', items: { type: 'object' } })), ...standardErrors } },
    },
    '/funds/{fundId}/members/{memberId}': {
      get: {
        tags: ['Funds'], operationId: 'getFundMember', summary: 'Get member details', parameters: [uuidPathParameter('fundId', 'Fund UUID.'), uuidPathParameter('memberId', 'Membership UUID.')],
        responses: { '200': response('Member returned.', success({ type: 'object' })), ...standardErrors },
      },
      patch: {
        tags: ['Funds'], operationId: 'updateFundMember', summary: 'Approve, decline, or remove a member', parameters: [uuidPathParameter('fundId', 'Fund UUID.'), uuidPathParameter('memberId', 'Membership UUID.')],
        requestBody: jsonBody({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['joined', 'declined', 'removed'] } } }),
        responses: { '200': response('Member updated.', success({ type: 'object', maxProperties: 0 })), ...standardErrors },
      },
    },
    '/funds/{fundId}/permissions': {
      get: {
        tags: ['Funds'], operationId: 'getEffectiveFundPermissions', summary: 'Get caller effective permissions', parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        responses: { '200': response('Permissions returned.', success({ type: 'array', items: { type: 'string' } })), ...standardErrors },
      },
    },
    '/funds/{fundId}/admin-permissions': {
      get: {
        tags: ['Funds'], operationId: 'listFundAdminPermissions', summary: 'List delegated admin permissions', parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        responses: { '200': response('Admin permissions returned.', success({ type: 'array', items: { type: 'object' } })), ...standardErrors },
      },
    },
    '/funds/{fundId}/members/{memberId}/admin': {
      put: {
        tags: ['Funds'], operationId: 'configureFundAdmin', summary: 'Configure member admin permissions', parameters: [uuidPathParameter('fundId', 'Fund UUID.'), uuidPathParameter('memberId', 'Membership UUID.')],
        requestBody: jsonBody({ type: 'object', required: ['permissions'], properties: { permissions: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string' } } } }),
        responses: { '200': response('Admin configured.', success({ type: 'object', maxProperties: 0 })), ...standardErrors },
      },
      delete: {
        tags: ['Funds'], operationId: 'removeFundAdmin', summary: 'Remove delegated admin access', parameters: [uuidPathParameter('fundId', 'Fund UUID.'), uuidPathParameter('memberId', 'Membership UUID.')],
        responses: { '200': response('Admin access removed.', success({ type: 'object', maxProperties: 0 })), ...standardErrors },
      },
    },
    '/funds/{fundId}/sponsorships': {
      get: {
        tags: ['Funds'], operationId: 'listFundSponsorships', summary: 'List sponsorship items', parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        responses: { '200': response('Sponsorships returned.', success({ type: 'array', items: { type: 'object' } })), ...standardErrors },
      },
      post: {
        tags: ['Funds'], operationId: 'createFundSponsorship', summary: 'Create a sponsorship item', parameters: [uuidPathParameter('fundId', 'Fund UUID.')], requestBody: jsonBody({ type: 'object' }),
        responses: { '201': response('Sponsorship created.', success({ type: 'object' })), ...standardErrors },
      },
    },
    '/funds/{fundId}/sponsorships/{itemId}': {
      patch: {
        tags: ['Funds'], operationId: 'updateFundSponsorship', summary: 'Update a sponsorship item', parameters: [uuidPathParameter('fundId', 'Fund UUID.'), uuidPathParameter('itemId', 'Sponsorship item UUID.')], requestBody: jsonBody({ type: 'object', minProperties: 1 }),
        responses: { '200': response('Sponsorship updated.', success({ type: 'object' })), ...standardErrors },
      },
    },
    '/funds/{fundId}/sponsorships/{itemId}/claim': {
      post: { tags: ['Funds'], operationId: 'claimFundSponsorship', summary: 'Claim a sponsorship item', parameters: [uuidPathParameter('fundId', 'Fund UUID.'), uuidPathParameter('itemId', 'Sponsorship item UUID.')], responses: { '200': response('Sponsorship claimed.', success({ type: 'object' })), ...standardErrors } },
    },
    '/funds/{fundId}/sponsorships/{itemId}/release': {
      post: { tags: ['Funds'], operationId: 'releaseFundSponsorship', summary: 'Release a sponsorship item', parameters: [uuidPathParameter('fundId', 'Fund UUID.'), uuidPathParameter('itemId', 'Sponsorship item UUID.')], responses: { '200': response('Sponsorship released.', success({ type: 'object' })), ...standardErrors } },
    },
    '/funds/{fundId}/activity': {
      get: { tags: ['Funds'], operationId: 'listFundActivity', summary: 'List fund audit activity', parameters: [uuidPathParameter('fundId', 'Fund UUID.'), ...listParameters.slice(0, 2)], responses: { '200': response('Activity returned.', success({ type: 'object' })), ...standardErrors } },
    },
    '/funds/{fundId}/activity/{entryId}': {
      get: { tags: ['Funds'], operationId: 'getFundActivityDetail', summary: 'Get activity and current record details', parameters: [uuidPathParameter('fundId', 'Fund UUID.'), uuidPathParameter('entryId', 'Activity UUID.')], responses: { '200': response('Activity detail returned.', success({ type: 'object' })), ...standardErrors } },
    },
    '/funds/{fundId}/report': {
      get: {
        tags: ['Funds'], operationId: 'getFundReport', summary: 'Get a stable fund report bundle',
        description: 'Returns financial, membership, sponsorship, award, audit, edit, and export data from one consistent database statement snapshot.',
        parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        responses: { '200': response('Report returned.', success({ $ref: '#/components/schemas/FundReportBundle' })), ...standardErrors },
      },
    },
    '/funds/{fundId}/exports': {
      post: {
        tags: ['Funds'], operationId: 'createFundExport', summary: 'Record a completed fund report export',
        parameters: [uuidPathParameter('fundId', 'Fund UUID.')],
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateFundExportRequest' }),
        responses: { '201': response('Export recorded.', success({ $ref: '#/components/schemas/FundExport' })), ...standardErrors },
      },
    },
    '/home/summary': {
      get: { tags: ['Funds'], operationId: 'getHomeSummary', summary: 'Get the current user home summary in one request', responses: { '200': response('Home summary returned.', success({ type: 'object' })), ...standardErrors } },
    },
    '/events': {
      get: {
        tags: ['Events'],
        operationId: 'listEvents',
        summary: 'List visible events',
        parameters: [
          ...listParameters,
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'creator_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'participant_user_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'type', in: 'query', schema: { type: 'array', items: { type: 'string' } }, style: 'form', explode: true },
          { name: 'status', in: 'query', schema: { type: 'array', items: { type: 'string', enum: ['active', 'completed', 'cancelled'] } }, style: 'form', explode: true },
          { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['created_at', 'event_date', 'name'] } },
        ],
        responses: {
          '200': response('Events returned.', paginated('#/components/schemas/EventSummary')),
          ...standardErrors,
        },
      },
      post: {
        tags: ['Events'],
        operationId: 'createEvent',
        summary: 'Create a standalone event',
        description: 'Atomically creates an event and optional organiser invitations for the authenticated caller.',
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateEventRequest' }, {
          name: 'Kabo Graduation Celebration',
          event_type: 'graduation',
          event_date: '2026-12-12',
          venue_name: 'Gaborone',
          currency_code: 'BWP',
          organisers: [{ name: 'Naledi Molefe', phone: '+26771000000' }],
        }),
        responses: {
          '201': response('Event created.', success({ $ref: '#/components/schemas/Event' })),
          ...standardErrors,
        },
      },
    },
    '/events/{eventId}': {
      get: {
        tags: ['Events'],
        operationId: 'getEvent',
        summary: 'Get an event and its guests',
        parameters: [uuidPathParameter('eventId', 'Event UUID.')],
        responses: {
          '200': response('Event returned.', success({
            type: 'object',
            required: ['event', 'guests'],
            properties: {
              event: { $ref: '#/components/schemas/Event' },
              guests: { type: 'array', items: { $ref: '#/components/schemas/EventGuest' } },
            },
          })),
          ...standardErrors,
        },
      },
      patch: {
        tags: ['Events'], operationId: 'updateEvent', summary: 'Update an event',
        parameters: [uuidPathParameter('eventId', 'Event UUID.')],
        requestBody: jsonBody({ type: 'object', minProperties: 1 }),
        responses: { '200': response('Event updated.', success({ $ref: '#/components/schemas/Event' })), ...standardErrors },
      },
      delete: {
        tags: ['Events'], operationId: 'deleteEvent', summary: 'Delete a standalone event',
        parameters: [uuidPathParameter('eventId', 'Event UUID.')],
        responses: { '200': response('Event deleted.', success({ type: 'object', maxProperties: 0 })), ...standardErrors },
      },
    },
    '/events/{eventId}/workspace': {
      get: {
        tags: ['Events'], operationId: 'getEventWorkspace', summary: 'Get the event screen workspace',
        description: 'Returns event, guest, budget, announcement, capability, and optional linked-fund data in one typed response.',
        parameters: [uuidPathParameter('eventId', 'Event UUID.')],
        responses: { '200': response('Event workspace returned.', success({ $ref: '#/components/schemas/EventWorkspace' })), ...standardErrors },
      },
    },
    '/events/{eventId}/leave': {
      post: {
        tags: ['Events'], operationId: 'leaveEvent', summary: 'Leave an event',
        parameters: [uuidPathParameter('eventId', 'Event UUID.')],
        responses: { '200': response('Event left.', success({ type: 'object' })), ...standardErrors },
      },
    },
    '/events/{eventId}/complete': {
      post: {
        tags: ['Events'], operationId: 'completeEvent', summary: 'Complete a standalone event',
        parameters: [uuidPathParameter('eventId', 'Event UUID.')],
        requestBody: jsonBody({ type: 'object', required: ['estimated_spend_amount'], properties: { estimated_spend_amount: { type: ['string', 'null'], pattern: '^\\d+(\\.\\d{1,2})?$' } } }),
        responses: { '200': response('Event completed.', success({ $ref: '#/components/schemas/Event' })), ...standardErrors },
      },
    },
    '/events/{eventId}/budget': {
      get: {
        tags: ['Events'], operationId: 'getEventBudget', summary: 'Get an event budget',
        parameters: [uuidPathParameter('eventId', 'Event UUID.')],
        responses: { '200': response('Event budget returned.', success({ oneOf: [{ $ref: '#/components/schemas/EventBudget' }, { type: 'null' }] })), ...standardErrors },
      },
      put: {
        tags: ['Events'], operationId: 'updateEventBudget', summary: 'Create or update an event budget',
        parameters: [uuidPathParameter('eventId', 'Event UUID.')],
        requestBody: jsonBody({ type: 'object', required: ['total_budget', 'currency_code'], properties: { total_budget: { type: 'string' }, currency_code: { type: 'string', pattern: '^[A-Z]{3}$' } } }),
        responses: { '200': response('Event budget updated.', success({ $ref: '#/components/schemas/EventBudget' })), ...standardErrors },
      },
    },
    '/events/{eventId}/announcements': {
      post: {
        tags: ['Events'], operationId: 'createEventAnnouncement', summary: 'Publish an event announcement',
        parameters: [uuidPathParameter('eventId', 'Event UUID.')],
        requestBody: jsonBody({ type: 'object', required: ['title', 'body'], properties: { title: { type: 'string' }, body: { type: 'string' } } }),
        responses: { '201': response('Announcement published.', success({ $ref: '#/components/schemas/EventAnnouncement' })), ...standardErrors },
      },
    },
    '/events/{eventId}/organiser-invites': {
      post: {
        tags: ['Events'], operationId: 'inviteEventOrganiser', summary: 'Invite an Event + Fund organiser',
        parameters: [uuidPathParameter('eventId', 'Event UUID.')],
        requestBody: jsonBody({ type: 'object', required: ['name', 'phone'], properties: { name: { type: 'string' }, phone: { type: 'string', example: '+26771000000' } } }),
        responses: { '201': response('Organiser invited.', success({ type: 'object', maxProperties: 0 })), ...standardErrors },
      },
    },
    '/events/invite-preview': {
      get: {
        tags: ['Events'], operationId: 'previewEventInvite', summary: 'Preview an event invite code',
        parameters: [{ name: 'code', in: 'query', required: true, schema: { type: 'string', minLength: 8, maxLength: 32 } }],
        responses: { '200': response('Event invite returned.', success({ $ref: '#/components/schemas/EventInvitePreview' })), ...standardErrors },
      },
    },
    '/events/join': {
      post: {
        tags: ['Events'], operationId: 'joinEvent', summary: 'Join an event by invite code',
        requestBody: jsonBody({ type: 'object', required: ['code'], properties: { code: { type: 'string', minLength: 8, maxLength: 32 } } }),
        responses: { '200': response('Event joined.', success({ type: 'object' })), ...standardErrors },
      },
    },
    '/events/event-funds': {
      post: {
        tags: ['Events'], operationId: 'createEventFund', summary: 'Create an Event + Fund workspace',
        description: 'Uses the atomic create_event_fund database function for event, fund, budget, membership, organiser invitations, and token accounting.',
        requestBody: jsonBody({ type: 'object', required: ['event_name', 'event_type', 'event_date', 'event_time', 'event_venue', 'fund_title', 'currency_code', 'budget', 'goal_percentage'] }),
        responses: { '201': response('Event + Fund created.', success({ type: 'object' })), ...standardErrors },
      },
    },
    '/events/organiser-invites/sync': {
      post: {
        tags: ['Events'], operationId: 'syncOrganiserInvites', summary: 'Attach pending organiser invitations',
        responses: { '200': response('Invitations synchronised.', success({ type: 'object', properties: { synced_count: { type: 'integer' } } })), ...standardErrors },
      },
    },
    '/events/organiser-invites/respond': {
      post: {
        tags: ['Events'], operationId: 'respondOrganiserInvite', summary: 'Accept or decline an organiser invitation',
        requestBody: jsonBody({ $ref: '#/components/schemas/RespondOrganiserInviteRequest' }),
        responses: { '200': response('Invitation response recorded.', success({ $ref: '#/components/schemas/OrganiserInviteResult' })), ...standardErrors },
      },
    },
    '/notifications': {
      get: {
        tags: ['Notifications'], operationId: 'listNotifications', summary: 'List current-user notifications',
        parameters: [
          ...listParameters,
          { name: 'type', in: 'query', schema: { type: 'array', items: { type: 'string' } }, style: 'form', explode: true },
          { name: 'unread_only', in: 'query', schema: { type: 'boolean' } },
          { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['created_at'] } },
        ],
        responses: { '200': response('Notifications returned.', paginated('#/components/schemas/Notification')), ...standardErrors },
      },
      patch: {
        tags: ['Notifications'], operationId: 'markNotificationsRead', summary: 'Mark notifications read',
        requestBody: jsonBody({ $ref: '#/components/schemas/MarkNotificationsReadRequest' }),
        responses: { '200': response('Notifications updated.', success({ type: 'object', properties: { updated_ids: { type: 'array', items: { type: 'string', format: 'uuid' } } } })), ...standardErrors },
      },
    },
    '/notifications/{notificationId}': {
      get: {
        tags: ['Notifications'], operationId: 'getNotification', summary: 'Get a current-user notification',
        parameters: [uuidPathParameter('notificationId', 'Notification UUID.')],
        responses: { '200': response('Notification returned.', success({ $ref: '#/components/schemas/Notification' })), ...standardErrors },
      },
    },
    '/rewards/evaluate': {
      post: {
        tags: ['Rewards'], operationId: 'evaluateRewards', summary: 'Evaluate current-user rewards',
        responses: { '200': response('Rewards evaluated.', success({ type: 'object', properties: { reward_count: { type: 'integer' } } })), ...standardErrors },
      },
    },
    '/rewards/progress': {
      get: {
        tags: ['Rewards'], operationId: 'getRewardProgress', summary: 'Get reward and trust progress',
        responses: { '200': response('Reward progress returned.', success({ $ref: '#/components/schemas/RewardProgressOverview' })), ...standardErrors },
      },
    },
    '/rewards/unseen': {
      get: {
        tags: ['Rewards'], operationId: 'listUnseenRewards', summary: 'List unseen reward snackbar items',
        responses: { '200': response('Unseen rewards returned.', success({ type: 'array', items: { $ref: '#/components/schemas/RewardSnackbarItem' } })), ...standardErrors },
      },
    },
    '/rewards/{rewardId}/seen': {
      patch: {
        tags: ['Rewards'], operationId: 'markRewardSeen', summary: 'Mark a reward snackbar item seen',
        parameters: [uuidPathParameter('rewardId', 'User reward UUID.')],
        responses: { '200': response('Reward marked seen.', success({ type: 'object', maxProperties: 0 })), ...standardErrors },
      },
    },
    '/contributions': {
      get: {
        tags: ['Contributions'],
        operationId: 'listContributions',
        summary: 'List visible contributions',
        parameters: [
          ...listParameters,
          { name: 'fund_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'user_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status', in: 'query', schema: { type: 'array', items: { type: 'string', enum: ['pledged', 'pending', 'confirmed', 'refunded', 'disputed'] } }, style: 'form', explode: true },
          { name: 'payment_method', in: 'query', schema: { type: 'array', items: { type: 'string' } }, style: 'form', explode: true },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'sort_by', in: 'query', schema: { type: 'string', enum: ['created_at', 'confirmed_at', 'amount'] } },
        ],
        responses: {
          '200': response('Contributions returned.', paginated('#/components/schemas/ContributionSummary')),
          ...standardErrors,
        },
      },
      post: {
        tags: ['Contributions'], operationId: 'createContribution', summary: 'Create a contribution or pledge', requestBody: jsonBody({ type: 'object', required: ['fund_id', 'contributor_name', 'contributor_phone', 'amount', 'currency_code', 'status'] }),
        responses: { '201': response('Contribution created.', success({ $ref: '#/components/schemas/Contribution' })), ...standardErrors },
      },
    },
    '/contributions/{contributionId}': {
      get: {
        tags: ['Contributions'],
        operationId: 'getContribution',
        summary: 'Get a contribution',
        parameters: [uuidPathParameter('contributionId', 'Contribution UUID.')],
        responses: {
          '200': response('Contribution returned.', success({ $ref: '#/components/schemas/Contribution' })),
          ...standardErrors,
        },
      },
      patch: {
        tags: ['Contributions'], operationId: 'updateContribution', summary: 'Edit a contribution', parameters: [uuidPathParameter('contributionId', 'Contribution UUID.')], requestBody: jsonBody({ type: 'object', minProperties: 1 }),
        responses: { '200': response('Contribution updated.', success({ $ref: '#/components/schemas/Contribution' })), ...standardErrors },
      },
    },
    '/contributions/{contributionId}/refund': {
      post: { tags: ['Contributions'], operationId: 'refundContribution', summary: 'Refund a contribution', parameters: [uuidPathParameter('contributionId', 'Contribution UUID.')], requestBody: jsonBody({ type: 'object', properties: { reason: { type: 'string', maxLength: 1000 } } }), responses: { '200': response('Contribution refunded.', success({ $ref: '#/components/schemas/Contribution' })), ...standardErrors } },
    },
    '/contributions/detected-assignment': {
      post: { tags: ['Contributions'], operationId: 'assignDetectedPayment', summary: 'Assign an SMS-detected payment to a fund', requestBody: jsonBody({ type: 'object', required: ['fund_id', 'detected'] }), responses: { '201': response('Payment assigned.', success({ type: 'object' })), ...standardErrors } },
    },
    '/pledge-allocations': {
      post: { tags: ['Contributions'], operationId: 'createPledgeAllocation', summary: 'Apply a payment to a pledge', requestBody: jsonBody({ type: 'object' }), responses: { '201': response('Allocation created.', success({ type: 'object' })), ...standardErrors } },
    },
    '/sponsorship-allocations': {
      post: { tags: ['Contributions'], operationId: 'createSponsorshipAllocation', summary: 'Apply a contribution to a sponsorship item', requestBody: jsonBody({ type: 'object' }), responses: { '201': response('Allocation created.', success({ type: 'object' })), ...standardErrors } },
    },
    '/expenses': {
      get: { tags: ['Expenses'], operationId: 'listExpenses', summary: 'List fund expenses', parameters: [...listParameters, { name: 'fund_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } }, { name: 'sponsored_by_user_id', in: 'query', schema: { type: 'string', format: 'uuid' } }], responses: { '200': response('Expenses returned.', success({ type: 'object' })), ...standardErrors } },
      post: { tags: ['Expenses'], operationId: 'createExpenses', summary: 'Create one or more fund expenses', requestBody: jsonBody({ type: 'object', required: ['fund_id', 'items'] }), responses: { '201': response('Expenses created.', success({ type: 'object', required: ['expenses', 'sponsorship_fulfilled'], properties: { expenses: { type: 'array', items: { type: 'object' } }, sponsorship_fulfilled: { type: 'boolean' } } })), ...standardErrors } },
    },
    '/expenses/{expenseId}': {
      patch: { tags: ['Expenses'], operationId: 'updateExpense', summary: 'Edit an expense', parameters: [uuidPathParameter('expenseId', 'Expense UUID.')], requestBody: jsonBody({ type: 'object', minProperties: 1 }), responses: { '200': response('Expense updated.', success({ type: 'object' })), ...standardErrors } },
    },
    '/receipts/upload-session': {
      post: { tags: ['Receipts'], operationId: 'createReceiptUploadSession', summary: 'Authorise a short-lived direct receipt upload', description: 'Returns a caller- and fund-scoped Supabase Storage signed upload URL; the image does not pass through Next.js.', requestBody: jsonBody({ type: 'object', required: ['fund_id', 'content_type', 'size_bytes'] }), responses: { '201': response('Upload session created.', success({ type: 'object' })), ...standardErrors } },
    },
    '/receipts/parse': {
      post: { tags: ['Receipts'], operationId: 'parseReceipt', summary: 'Parse and finalise an uploaded receipt', requestBody: jsonBody({ type: 'object', required: ['fund_id', 'object_path'] }), responses: { '200': response('Receipt parsed.', success({ type: 'object' })), ...standardErrors } },
    },
    '/rich-auntie/eligibility': {
      get: {
        tags: ['Rich Auntie'], operationId: 'getRichAuntieEligibility', summary: 'Get award eligibility and sponsorship progress',
        parameters: [
          { name: 'fund_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'recipient_user_id', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': response('Eligibility returned.', success({ $ref: '#/components/schemas/RichAuntieEligibility' })), ...standardErrors },
      },
    },
    '/rich-auntie/awards': {
      get: {
        tags: ['Rich Auntie'], operationId: 'listRichAuntieAwards', summary: 'List caller-visible award history',
        parameters: [...listParameters, { name: 'fund_id', in: 'query', schema: { type: 'string', format: 'uuid' } }, { name: 'recipient_user_id', in: 'query', schema: { type: 'string', format: 'uuid' } }, { name: 'awarded_by', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': response('Awards returned.', paginated('#/components/schemas/RichAuntieAward')), ...standardErrors },
      },
      post: {
        tags: ['Rich Auntie'], operationId: 'createRichAuntieAward', summary: 'Create a Rich Auntie award',
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateRichAuntieAwardRequest' }),
        responses: { '201': response('Award created.', success({ $ref: '#/components/schemas/RichAuntieAward' })), ...standardErrors },
      },
    },
    '/rich-auntie/recipients/{recipientUserId}/history': {
      get: {
        tags: ['Rich Auntie'], operationId: 'getRichAuntieRecipientHistory', summary: 'Get caller-visible recipient contribution and award history',
        parameters: [uuidPathParameter('recipientUserId', 'Recipient user UUID.')],
        responses: { '200': response('Recipient history returned.', success({ $ref: '#/components/schemas/RichAuntieRecipientHistory' })), ...standardErrors },
      },
    },
    '/rich-auntie/celebrations/{awardId}': {
      get: {
        tags: ['Rich Auntie'], operationId: 'getRichAuntieCelebration', summary: 'Get celebration details for an award',
        parameters: [uuidPathParameter('awardId', 'Award UUID.')],
        responses: { '200': response('Celebration details returned.', success({ type: 'object', required: ['award', 'is_recipient'], properties: { award: { $ref: '#/components/schemas/RichAuntieAward' }, is_recipient: { type: 'boolean' } } })), ...standardErrors },
      },
    },
    '/rich-auntie/status': {
      get: {
        tags: ['Rich Auntie'], operationId: 'getCurrentRichAuntieStatus', summary: 'Get the current caller’s Rich Auntie status',
        responses: { '200': response('Status returned.', success({ $ref: '#/components/schemas/RichAuntieRecipientHistory' })), ...standardErrors },
      },
    },
    '/admin/support-tickets': {
      get: {
        tags: ['Platform admin'],
        operationId: 'listSupportTickets',
        summary: 'List support tickets',
        description: 'Requires an active platform-admin account.',
        parameters: [
          ...listParameters,
          { name: 'q', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'array', items: { type: 'string' } }, style: 'form', explode: true },
          { name: 'priority', in: 'query', schema: { type: 'array', items: { type: 'string' } }, style: 'form', explode: true },
          { name: 'assigned_to', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': response('Tickets returned.', paginated('#/components/schemas/SupportTicket')),
          ...standardErrors,
        },
      },
      patch: {
        tags: ['Platform admin'],
        operationId: 'updateSupportTicket',
        summary: 'Update a support ticket',
        description: 'Audited operation for support, operations, and super-admin roles.',
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateSupportTicketRequest' }, {
          ticket_id: id,
          status: 'resolved',
          resolution_note: 'Member issue resolved after verification.',
        }),
        responses: {
          '200': response('Ticket updated.', success({ $ref: '#/components/schemas/SupportTicket' })),
          ...standardErrors,
        },
      },
    },
    '/admin/audit': {
      get: {
        tags: ['Platform admin'],
        operationId: 'listAdminAudit',
        summary: 'List platform-admin audit history',
        parameters: [
          ...listParameters,
          { name: 'actor_user_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'entity_type', in: 'query', schema: { type: 'string' } },
          { name: 'entity_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': response('Audit history returned.', paginated('#/components/schemas/AdminAuditEntry')),
          ...standardErrors,
        },
      },
    },
    '/admin/users/moderate': {
      post: {
        tags: ['Platform admin'],
        operationId: 'moderateUser',
        summary: 'Moderate a user',
        description: 'Audited operation for operations and super-admin roles.',
        requestBody: jsonBody({ $ref: '#/components/schemas/ModerateUserRequest' }, {
          user_id: id,
          action: 'flag',
          reason: 'Manual review requested.',
        }),
        responses: {
          '200': response('User moderated.', success({ $ref: '#/components/schemas/UserSummary' })),
          ...standardErrors,
        },
      },
    },
    '/admin/funds/moderate': {
      post: {
        tags: ['Platform admin'],
        operationId: 'moderateFund',
        summary: 'Moderate a fund',
        description: 'Audited operation for operations and super-admin roles.',
        requestBody: jsonBody({ $ref: '#/components/schemas/ModerateFundRequest' }, {
          fund_id: id,
          action: 'close',
          reason: 'Closed after platform review.',
        }),
        responses: {
          '200': response('Fund moderated.', success({ $ref: '#/components/schemas/FundSummary' })),
          ...standardErrors,
        },
      },
    },
    '/admin/platform-admins': {
      put: {
        tags: ['Platform admin'],
        operationId: 'upsertPlatformAdmin',
        summary: 'Create or update a platform administrator',
        description: 'Audited super-admin-only operation.',
        requestBody: jsonBody({ $ref: '#/components/schemas/UpsertPlatformAdminRequest' }, {
          user_id: id,
          role: 'support',
          status: 'active',
        }),
        responses: {
          '200': response('Platform administrator saved.', success({ $ref: '#/components/schemas/PlatformAdmin' })),
          ...standardErrors,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Supabase JWT',
        description: 'Supabase Auth access token obtained after phone OTP verification.',
      },
    },
    responses: {
      BadRequest: response('Malformed JSON or request.', { $ref: '#/components/schemas/ErrorEnvelope' }),
      Unauthenticated: response('Missing, invalid, or expired Supabase access token.', { $ref: '#/components/schemas/ErrorEnvelope' }, {
        ok: false,
        error: { code: 'UNAUTHENTICATED', message: 'A valid bearer access token is required.', retryable: false },
        request_id: id,
      }),
      Forbidden: response('The caller is not authorised for this operation.', { $ref: '#/components/schemas/ErrorEnvelope' }),
      NotFound: response('The resource is missing or hidden by RLS.', { $ref: '#/components/schemas/ErrorEnvelope' }),
      Conflict: response('The request conflicts with the resource lifecycle.', { $ref: '#/components/schemas/ErrorEnvelope' }),
      ValidationFailed: response('One or more request fields are invalid.', { $ref: '#/components/schemas/ErrorEnvelope' }),
      InternalError: response('Unexpected server error. Raw database errors are never exposed.', { $ref: '#/components/schemas/ErrorEnvelope' }),
    },
    schemas: {
      Pagination: {
        type: 'object',
        required: ['limit', 'next_cursor', 'has_more'],
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 100 },
          next_cursor: { type: ['string', 'null'] },
          has_more: { type: 'boolean' },
        },
      },
      ErrorEnvelope: {
        type: 'object',
        required: ['ok', 'error', 'request_id'],
        properties: {
          ok: { type: 'boolean', const: false },
          error: {
            type: 'object',
            required: ['code', 'message', 'retryable'],
            properties: {
              code: { type: 'string', enum: ['BAD_REQUEST', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND', 'CONFLICT', 'VALIDATION_FAILED', 'RATE_LIMITED', 'INTERNAL_ERROR'] },
              message: { type: 'string' },
              retryable: { type: 'boolean' },
              details: {},
              field_errors: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['field', 'code', 'message'],
                  properties: { field: { type: 'string' }, code: { type: 'string' }, message: { type: 'string' } },
                },
              },
            },
          },
          request_id: { type: 'string', format: 'uuid' },
        },
      },
      UserSummary: {
        type: 'object',
        required: ['id', 'name', 'phone', 'trust_level', 'trust_score', 'profile_completed', 'status', 'created_at'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          phone: { type: 'string', example: '+26771000000' },
          country_code: { type: ['string', 'null'] },
          trust_level: { type: 'string', enum: ['new', 'basic', 'trusted', 'verified'] },
          trust_score: { type: 'integer' },
          profile_completed: { type: 'boolean' },
          status: { type: 'string', enum: ['active', 'flagged', 'banned'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      User: {
        allOf: [
          { $ref: '#/components/schemas/UserSummary' },
          {
            type: 'object',
            properties: {
              email: { type: ['string', 'null'], format: 'email' },
              avatar_url: { type: ['string', 'null'], format: 'uri' },
              preferred_currency: { type: ['string', 'null'], minLength: 3, maxLength: 3 },
              token_balance: { type: 'integer' },
              onboarding_completed: { type: 'boolean' },
              notifications_enabled: { type: 'boolean' },
              last_active_at: { type: ['string', 'null'], format: 'date-time' },
              updated_at: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      UpdateCurrentUserRequest: {
        type: 'object', minProperties: 1, additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          email: { type: ['string', 'null'], format: 'email' }, avatar_url: { type: ['string', 'null'], format: 'uri' },
          country_code: { type: 'string' }, preferred_currency: { type: 'string', pattern: '^[A-Z]{3}$' }, notifications_enabled: { type: 'boolean' },
          mobile_money_provider: { type: ['string', 'null'] }, bank_name: { type: ['string', 'null'] }, bank_branch_code: { type: ['string', 'null'] }, bank_account_number: { type: ['string', 'null'] },
          profile_completed: { type: 'boolean' }, onboarding_completed: { type: 'boolean' },
          terms_accepted_at: { type: 'string', format: 'date-time' }, terms_version: { type: 'string' },
          privacy_accepted_at: { type: 'string', format: 'date-time' }, privacy_version: { type: 'string' },
          data_processing_consent: { type: 'boolean' }, data_processing_consent_at: { type: 'string', format: 'date-time' },
        },
      },
      ConnectionSummary: {
        type: 'object', required: ['user_id', 'name', 'phone'],
        properties: { user_id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, phone: { type: 'string' } },
      },
      FundSummary: {
        type: 'object',
        required: ['id', 'owner_id', 'title', 'fund_code', 'fund_type', 'currency_code', 'status', 'is_private', 'created_at'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          owner_id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          fund_code: { type: 'string' },
          fund_type: { type: 'string' },
          fund_emoji: { type: ['string', 'null'] },
          currency_code: { type: 'string', example: 'BWP' },
          goal_amount: { type: ['string', 'null'], example: '25000.00', description: 'Decimal string; never a JSON number.' },
          status: { type: 'string', enum: ['active', 'closed', 'completed', 'cancelled'] },
          contribution_deadline: { type: ['string', 'null'], format: 'date' },
          linked_event_id: { type: ['string', 'null'], format: 'uuid' },
          is_private: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Fund: {
        allOf: [
          { $ref: '#/components/schemas/FundSummary' },
          { type: 'object', properties: { description: { type: ['string', 'null'] }, type_specific_data: {}, updated_at: { type: 'string', format: 'date-time' } } },
        ],
      },
      FundDetail: {
        allOf: [
          { $ref: '#/components/schemas/Fund' },
          {
            type: 'object',
            properties: {
              membership: { type: ['object', 'null'] },
              totals: {
                type: 'object',
                properties: {
                  raised: { type: 'string' }, spent: { type: 'string' }, balance: { type: 'string' },
                  contribution_count: { type: 'integer' }, member_count: { type: 'integer' },
                },
              },
            },
          },
        ],
      },
      FundReportBundle: {
        type: 'object',
        required: ['history_snapshot_at', 'fund', 'contributions', 'expenses', 'members', 'contributors', 'pledge_balances', 'linked_event', 'sponsorship_items', 'rich_auntie_awards', 'member_profiles', 'audit_history', 'contribution_edits', 'expense_edits', 'export_history'],
        properties: {
          history_snapshot_at: { type: 'string', format: 'date-time', description: 'Timestamp identifying the single database statement snapshot used for every report section.' },
          fund: { type: 'object' },
          contributions: { type: 'array', items: { type: 'object' } },
          expenses: { type: 'array', items: { type: 'object' } },
          members: { type: 'array', items: { type: 'object' } },
          contributors: { type: 'array', items: { type: 'object' } },
          pledge_balances: { type: 'array', items: { type: 'object' } },
          linked_event: { type: ['object', 'null'] },
          sponsorship_items: { type: 'array', items: { type: 'object' } },
          rich_auntie_awards: { type: 'array', items: { type: 'object' } },
          member_profiles: { type: 'array', items: { type: 'object' } },
          audit_history: { type: 'array', items: { type: 'object' } },
          contribution_edits: { type: 'array', items: { type: 'object' } },
          expense_edits: { type: 'array', items: { type: 'object' } },
          export_history: { type: 'array', items: { $ref: '#/components/schemas/FundExport' } },
        },
      },
      CreateFundExportRequest: {
        type: 'object', required: ['export_type'], additionalProperties: false,
        properties: { export_type: { type: 'string', enum: ['pdf', 'csv', 'share'] } },
      },
      FundExport: {
        type: 'object', required: ['id', 'fund_id', 'exported_by', 'export_type', 'was_free', 'tokens_spent', 'created_at'],
        properties: {
          id: { type: 'string', format: 'uuid' }, fund_id: { type: 'string', format: 'uuid' }, exported_by: { type: 'string', format: 'uuid' },
          export_type: { type: 'string', enum: ['pdf', 'csv', 'share'] }, was_free: { type: 'boolean' }, tokens_spent: { type: 'integer', minimum: 0 }, created_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateFundRequest: {
        type: 'object',
        required: ['title', 'fund_type', 'currency_code'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 200 },
          description: { type: ['string', 'null'] },
          fund_type: { type: 'string' },
          fund_emoji: { type: ['string', 'null'] },
          currency_code: { type: 'string', pattern: '^[A-Z]{3}$' },
          goal_amount: { type: ['string', 'null'], pattern: '^\\d+(\\.\\d{1,2})?$' },
          type_specific_data: {},
          event_date: { type: ['string', 'null'], format: 'date' },
          event_time: { type: ['string', 'null'], format: 'time' },
          event_location: { type: ['string', 'null'] },
          contribution_deadline: { type: ['string', 'null'], format: 'date' },
          linked_event_id: { type: ['string', 'null'], format: 'uuid' },
          is_private: { type: 'boolean', default: false },
        },
      },
      EventSummary: {
        type: 'object',
        required: ['id', 'creator_id', 'event_code', 'name', 'event_type', 'event_date', 'currency_code', 'status', 'created_at'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          creator_id: { type: 'string', format: 'uuid' },
          event_code: { type: 'string' }, name: { type: 'string' }, event_type: { type: 'string' },
          event_emoji: { type: ['string', 'null'] }, event_date: { type: 'string', format: 'date' }, event_time: { type: ['string', 'null'], format: 'time' },
          venue_name: { type: ['string', 'null'] }, currency_code: { type: 'string' },
          linked_fund_id: { type: ['string', 'null'], format: 'uuid' },
          status: { type: 'string', enum: ['active', 'completed', 'cancelled'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      Event: {
        allOf: [
          { $ref: '#/components/schemas/EventSummary' },
          { type: 'object', properties: { description: { type: ['string', 'null'] }, event_time: { type: ['string', 'null'], format: 'time' }, event_end_date: { type: ['string', 'null'], format: 'date' }, event_end_time: { type: ['string', 'null'], format: 'time' }, venue_address: { type: ['string', 'null'] }, updated_at: { type: 'string', format: 'date-time' } } },
        ],
      },
      EventGuest: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, event_id: { type: 'string', format: 'uuid' },
          user_id: { type: ['string', 'null'], format: 'uuid' }, guest_name: { type: ['string', 'null'] },
          guest_phone: { type: ['string', 'null'] }, rsvp_status: { type: 'string', enum: ['pending', 'yes', 'no', 'maybe'] },
          plus_ones: { type: 'integer' }, created_at: { type: 'string', format: 'date-time' },
        },
      },
      EventBudget: {
        type: 'object', required: ['event_id', 'total_budget', 'currency_code'],
        properties: {
          event_id: { type: 'string', format: 'uuid' }, total_budget: { type: 'string', example: '25000.00' },
          currency_code: { type: 'string', pattern: '^[A-Z]{3}$' },
        },
      },
      EventAnnouncement: {
        type: 'object', required: ['id', 'event_id', 'author_id', 'author_name', 'title', 'body', 'created_at'],
        properties: {
          id: { type: 'string', format: 'uuid' }, event_id: { type: 'string', format: 'uuid' }, author_id: { type: 'string', format: 'uuid' },
          author_name: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, created_at: { type: 'string', format: 'date-time' },
        },
      },
      EventInvitePreview: {
        type: 'object',
        required: ['id', 'name', 'event_type', 'event_date', 'status', 'organiser_name', 'has_linked_fund', 'already_joined'],
        properties: {
          id: { type: 'string', format: 'uuid' }, name: { type: 'string' }, event_type: { type: 'string' }, event_emoji: { type: ['string', 'null'] },
          event_date: { type: 'string', format: 'date' }, event_time: { type: ['string', 'null'], format: 'time' }, venue_name: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['active', 'completed', 'cancelled'] }, organiser_name: { type: 'string' }, has_linked_fund: { type: 'boolean' }, already_joined: { type: 'boolean' },
        },
      },
      EventWorkspace: {
        type: 'object', required: ['event', 'guests', 'budget', 'announcements', 'capabilities', 'linked_fund'],
        properties: {
          event: { $ref: '#/components/schemas/Event' },
          guests: { type: 'array', items: { $ref: '#/components/schemas/EventGuest' } },
          budget: { oneOf: [{ $ref: '#/components/schemas/EventBudget' }, { type: 'null' }] },
          announcements: { type: 'array', items: { $ref: '#/components/schemas/EventAnnouncement' } },
          capabilities: {
            type: 'object', required: ['is_creator', 'is_organiser', 'can_leave_event', 'linked_fund_permissions'],
            properties: {
              is_creator: { type: 'boolean' }, is_organiser: { type: 'boolean' }, can_leave_event: { type: 'boolean' },
              linked_fund_permissions: { type: 'array', items: { type: 'string' } },
            },
          },
          linked_fund: { type: ['object', 'null'] },
        },
      },
      CreateEventRequest: {
        type: 'object',
        required: ['name', 'event_type', 'event_date', 'currency_code'],
        properties: {
          name: { type: 'string', minLength: 3, maxLength: 200 }, description: { type: ['string', 'null'] },
          event_type: { type: 'string' }, event_emoji: { type: ['string', 'null'] },
          event_date: { type: 'string', format: 'date' }, event_time: { type: ['string', 'null'], format: 'time' },
          event_end_date: { type: ['string', 'null'], format: 'date' }, event_end_time: { type: ['string', 'null'], format: 'time' },
          venue_name: { type: ['string', 'null'] }, venue_address: { type: ['string', 'null'] }, currency_code: { type: 'string', pattern: '^[A-Z]{3}$' },
          organisers: { type: 'array', maxItems: 20, items: { type: 'object', required: ['name', 'phone'], properties: { name: { type: 'string' }, phone: { type: 'string', example: '+26771000000' } } } },
        },
      },
      RespondOrganiserInviteRequest: {
        type: 'object', required: ['invite_id', 'accepted'], additionalProperties: false,
        properties: { invite_id: { type: 'string', format: 'uuid' }, accepted: { type: 'boolean' } },
      },
      OrganiserInviteResult: {
        type: 'object', required: ['event_id', 'fund_id', 'accepted'],
        properties: { event_id: { type: 'string', format: 'uuid' }, fund_id: { type: 'string', format: 'uuid' }, accepted: { type: 'boolean' } },
      },
      Notification: {
        type: 'object', required: ['id', 'user_id', 'type', 'title', 'body', 'is_read', 'created_at'],
        properties: {
          id: { type: 'string', format: 'uuid' }, user_id: { type: 'string', format: 'uuid' }, fund_id: { type: ['string', 'null'], format: 'uuid' },
          type: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, data: { type: ['object', 'null'], additionalProperties: true },
          is_read: { type: 'boolean' }, read_at: { type: ['string', 'null'], format: 'date-time' }, delivered_at: { type: ['string', 'null'], format: 'date-time' },
          opened_at: { type: ['string', 'null'], format: 'date-time' }, clicked_at: { type: ['string', 'null'], format: 'date-time' }, response_action: { type: ['string', 'null'] }, created_at: { type: 'string', format: 'date-time' },
        },
      },
      MarkNotificationsReadRequest: {
        type: 'object', required: ['notification_ids'], additionalProperties: false,
        properties: { notification_ids: { type: 'array', minItems: 1, maxItems: 100, uniqueItems: true, items: { type: 'string', format: 'uuid' } } },
      },
      RewardProgressOverview: {
        type: 'object', required: ['rewards', 'trust'],
        properties: {
          rewards: { type: 'array', items: { $ref: '#/components/schemas/RewardProgress' } },
          trust: { type: 'object', required: ['trust_score', 'trust_level'], properties: { trust_score: { type: 'integer' }, trust_level: { type: 'string' } } },
        },
      },
      RewardProgress: {
        type: 'object', required: ['reward_code', 'name', 'description', 'category', 'trust_points_reward', 'threshold', 'unit', 'current', 'is_earned'],
        properties: {
          reward_code: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' },
          trust_points_reward: { type: 'integer' }, threshold: { type: 'integer' }, unit: { type: 'string' }, icon: { type: ['string', 'null'] },
          current: { type: 'integer' }, is_earned: { type: 'boolean' }, earned_at: { type: ['string', 'null'], format: 'date-time' },
        },
      },
      RewardSnackbarItem: {
        type: 'object', required: ['user_reward_id', 'reward_code', 'name', 'description', 'category', 'trust_points_awarded', 'earned_at'],
        properties: {
          user_reward_id: { type: 'string', format: 'uuid' }, reward_code: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' },
          category: { type: 'string' }, icon: { type: ['string', 'null'] }, trust_points_awarded: { type: 'integer' }, earned_at: { type: 'string', format: 'date-time' },
        },
      },
      ContributionSummary: {
        type: 'object',
        required: ['id', 'fund_id', 'contributor_id', 'contributor_name', 'amount', 'currency_code', 'status', 'is_refunded', 'created_at'],
        properties: {
          id: { type: 'string', format: 'uuid' }, fund_id: { type: 'string', format: 'uuid' }, contributor_id: { type: 'string', format: 'uuid' }, user_id: { type: ['string', 'null'], format: 'uuid' },
          contributor_name: { type: 'string' }, amount: { type: 'string', example: '500.00' }, pledged_amount: { type: ['string', 'null'] },
          currency_code: { type: 'string', example: 'BWP' }, payment_method: { type: ['string', 'null'] },
          status: { type: 'string', enum: ['pledged', 'pending', 'confirmed', 'refunded', 'disputed'] }, is_refunded: { type: 'boolean' },
          confirmed_at: { type: ['string', 'null'], format: 'date-time' }, created_at: { type: 'string', format: 'date-time' },
        },
      },
      Contribution: {
        allOf: [
          { $ref: '#/components/schemas/ContributionSummary' },
          { type: 'object', properties: { contributor_phone: { type: 'string' }, reference_number: { type: ['string', 'null'] }, detected_via: { type: 'string' }, receipt_number: { type: ['string', 'null'] }, notes: { type: ['string', 'null'] }, updated_at: { type: 'string', format: 'date-time' } } },
        ],
      },
      RichAuntieAward: {
        type: 'object',
        required: ['id', 'fund_id', 'fund_title', 'recipient_user_id', 'recipient_name', 'reason_code', 'reason_label', 'awarded_by', 'awarded_by_name', 'notify_member', 'created_at'],
        properties: {
          id: { type: 'string', format: 'uuid' }, fund_id: { type: 'string', format: 'uuid' }, fund_title: { type: 'string' },
          recipient_user_id: { type: 'string', format: 'uuid' }, recipient_name: { type: 'string' }, sponsorship_item_id: { type: ['string', 'null'], format: 'uuid' },
          reason_code: { type: 'string', enum: ['bought_outfit', 'paid_catering', 'covered_tent', 'bought_cake', 'major_contribution', 'transport_costs', 'custom'] }, reason_label: { type: 'string' },
          awarded_by: { type: 'string', format: 'uuid' }, awarded_by_name: { type: 'string' }, notify_member: { type: 'boolean' }, created_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateRichAuntieAwardRequest: {
        type: 'object', required: ['fund_id', 'recipient_user_id', 'reason_code', 'reason_label', 'notify_member'],
        properties: {
          fund_id: { type: 'string', format: 'uuid' }, recipient_user_id: { type: 'string', format: 'uuid' }, sponsorship_item_id: { type: ['string', 'null'], format: 'uuid' },
          reason_code: { type: 'string' }, reason_label: { type: 'string', minLength: 2, maxLength: 200 }, notify_member: { type: 'boolean' },
        },
      },
      RichAuntieEligibility: {
        type: 'object', required: ['fund_id', 'recipient_user_id', 'recipient_name', 'can_award', 'sponsorship_progress'],
        properties: {
          fund_id: { type: 'string', format: 'uuid' }, recipient_user_id: { type: 'string', format: 'uuid' }, recipient_name: { type: 'string' }, can_award: { type: 'boolean' },
          sponsorship_progress: { type: 'array', items: { type: 'object', required: ['id', 'title', 'target_amount', 'allocated_amount', 'outstanding_amount', 'status', 'already_awarded', 'eligible'] } },
        },
      },
      RichAuntieRecipientHistory: {
        type: 'object', required: ['recipient_user_id', 'recipient_name', 'cash_given', 'fund_count', 'award_count', 'is_rich_auntie', 'is_consistent_contributor', 'awards'],
        properties: {
          recipient_user_id: { type: 'string', format: 'uuid' }, recipient_name: { type: 'string' }, cash_given: { type: 'string' }, fund_count: { type: 'integer' }, award_count: { type: 'integer' },
          is_rich_auntie: { type: 'boolean' }, is_consistent_contributor: { type: 'boolean' }, awards: { type: 'array', items: { $ref: '#/components/schemas/RichAuntieAward' } },
        },
      },
      SupportTicket: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }, ticket_number: { type: 'string' }, category: { type: 'string' },
          subject: { type: 'string' }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
          status: { type: 'string', enum: ['open', 'pending', 'in_progress', 'resolved', 'closed'] },
          assigned_to: { type: ['string', 'null'] }, created_at: { type: 'string', format: 'date-time' },
        },
      },
      UpdateSupportTicketRequest: {
        type: 'object', required: ['ticket_id'], properties: {
          ticket_id: { type: 'string', format: 'uuid' }, status: { type: 'string' }, priority: { type: 'string' },
          assigned_to: { type: ['string', 'null'] }, resolution_note: { type: ['string', 'null'] },
        },
      },
      ModerateUserRequest: {
        type: 'object', required: ['user_id', 'action'], properties: {
          user_id: { type: 'string', format: 'uuid' }, action: { type: 'string', enum: ['flag', 'unflag', 'ban', 'unban'] }, reason: { type: 'string' },
        },
      },
      ModerateFundRequest: {
        type: 'object', required: ['fund_id', 'action'], properties: {
          fund_id: { type: 'string', format: 'uuid' }, action: { type: 'string', enum: ['activate', 'close'] }, reason: { type: 'string' },
        },
      },
      UpsertPlatformAdminRequest: {
        type: 'object', required: ['user_id', 'role', 'status'], properties: {
          user_id: { type: 'string', format: 'uuid' }, role: { type: 'string', enum: ['support', 'operations', 'finance', 'super_admin'] }, status: { type: 'string', enum: ['active', 'inactive'] },
        },
      },
      PlatformAdmin: {
        type: 'object', properties: {
          user_id: { type: 'string', format: 'uuid' }, role: { type: 'string' }, name: { type: 'string' }, phone: { type: 'string' }, status: { type: 'string' },
        },
      },
      AdminAuditEntry: {
        type: 'object', properties: {
          id: { type: 'string', format: 'uuid' }, actor_user_id: { type: 'string', format: 'uuid' }, action: { type: 'string' },
          entity_type: { type: 'string' }, entity_id: { type: ['string', 'null'], format: 'uuid' }, metadata: {}, created_at: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
} as const
