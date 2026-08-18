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
      'The Tshelo API exposes users, funds, events, contributions, and audited platform-admin operations.',
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
    { name: 'Contributions', description: 'Caller-visible contribution records.' },
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
          event_emoji: { type: ['string', 'null'] }, event_date: { type: 'string', format: 'date' },
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
      ContributionSummary: {
        type: 'object',
        required: ['id', 'fund_id', 'contributor_name', 'amount', 'currency_code', 'status', 'is_refunded', 'created_at'],
        properties: {
          id: { type: 'string', format: 'uuid' }, fund_id: { type: 'string', format: 'uuid' }, user_id: { type: ['string', 'null'], format: 'uuid' },
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
