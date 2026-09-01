const bearerSecurity = [{ bearerAuth: [] }, { cookieAuth: [] }] as const;

export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Travel Assistant API',
    version: '1.0.0',
    description: 'Backend API for destinations, live travel data, trip planning, saved trips, and trust signals.',
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'Health' },
    { name: 'Users' },
    { name: 'Knowledge' },
    { name: 'Attractions' },
    { name: 'Live Data' },
    { name: 'Planner' },
    { name: 'NLU' },
    { name: 'Feedback' },
    { name: 'Crowd' },
    { name: 'Favorites' },
    { name: 'Trips' },
    { name: 'Services' },
    { name: 'Emergency' },
    { name: 'Guide' },
    { name: 'Budget' },
    { name: 'Analytics' },
    { name: 'Search' },
    { name: 'Nearby' },
    { name: 'Local Businesses' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase access token.',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'access_token',
        description: 'Supabase access token stored in an access_token cookie.',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: { data: {} },
      },
      ApiError: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: {},
            },
            required: ['code', 'message'],
          },
        },
        required: ['error'],
      },
      UserProfileUpdate: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          preferredLanguage: { type: 'string', enum: ['en', 'hi', 'or'] },
          emergencyContactName: { type: 'string', maxLength: 100 },
          emergencyContactPhone: { type: 'string', maxLength: 20 },
        },
      },
      UserPreferences: {
        type: 'object',
        additionalProperties: false,
        properties: {
          budgetBand: { type: 'string', enum: ['BUDGET', 'MODERATE', 'PREMIUM'] },
          pace: { type: 'string', enum: ['RELAXED', 'MODERATE', 'PACKED'] },
          groupType: { type: 'string', enum: ['SOLO', 'COUPLE', 'FAMILY', 'GROUP'] },
          interests: { type: 'array', items: { type: 'string', maxLength: 100 }, maxItems: 20 },
          foodPreferences: { type: 'array', items: { type: 'string', maxLength: 100 }, maxItems: 20 },
          transportPreference: { type: 'string', enum: ['WALKING', 'PUBLIC_TRANSIT', 'CAB', 'OWN_VEHICLE', 'MIXED'] },
          accessibilityMobility: { type: 'boolean' },
          accessibilityVision: { type: 'boolean' },
          accessibilityHearing: { type: 'boolean' },
          accessibilityCognitive: { type: 'boolean' },
          accessibilityNotes: { type: 'string', maxLength: 500 },
          walkingToleranceMinutes: { type: 'integer', minimum: 5, maximum: 240 },
          indoorOutdoorPreference: { type: 'string', enum: ['indoor', 'outdoor', 'mixed'] },
          localBusinessPreference: { type: 'boolean' },
        },
      },
      PlannerRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['destinationId', 'startDate', 'days', 'preferences'],
        properties: {
          destinationId: { type: 'string', minLength: 1, maxLength: 100, description: 'UUID or legacy frontend slug.' },
          title: { type: 'string', minLength: 1, maxLength: 200 },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          days: { type: 'integer', minimum: 1, maximum: 14 },
          saveTrip: { type: 'boolean', default: false },
          preferences: {
            type: 'object',
            additionalProperties: false,
            properties: {
              pace: { type: 'string', enum: ['RELAXED', 'MODERATE', 'PACKED'], default: 'MODERATE' },
              accessibilityWheelchair: { type: 'boolean', default: false },
              accessibilityVision: { type: 'boolean', default: false },
              accessibilityHearing: { type: 'boolean', default: false },
              accessibilityCognitive: { type: 'boolean', default: false },
              interests: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20, default: [] },
              transportPreference: { type: 'string', enum: ['WALKING', 'PUBLIC_TRANSIT', 'CAB', 'OWN_VEHICLE', 'MIXED'], default: 'MIXED' },
              groupType: { type: 'string', enum: ['SOLO', 'COUPLE', 'FAMILY', 'GROUP'], default: 'SOLO' },
              walkingToleranceMinutes: { type: 'integer', minimum: 5, maximum: 240, default: 30 },
              indoorOutdoorPreference: { type: 'string', enum: ['indoor', 'outdoor', 'mixed'], default: 'mixed' },
              localBusinessPreference: { type: 'boolean', default: false },
            },
          },
        },
      },
      NluExtractRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['prompt'],
        properties: { prompt: { type: 'string', minLength: 5, maxLength: 1000 } },
      },
      NluNarrateRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['itinerary', 'validFactIds'],
        properties: {
          itinerary: {
            type: 'array',
            maxItems: 20,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['attractionName', 'startTime', 'endTime'],
              properties: {
                attractionName: { type: 'string', maxLength: 200 },
                startTime: { type: 'string' },
                endTime: { type: 'string' },
                factId: { type: 'string' },
                description: { type: 'string', maxLength: 1000 },
              },
            },
          },
          validFactIds: { type: 'array', items: { type: 'string', format: 'uuid' }, maxItems: 100 },
        },
      },
      NluSpeechRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string', minLength: 3, maxLength: 4000 },
          voiceName: { type: 'string', pattern: '^[A-Za-z][A-Za-z0-9_-]{1,63}$', default: 'Kore' },
          languageCode: { type: 'string', pattern: '^[a-z]{2,3}(-[A-Z]{2})?$' },
          format: { type: 'string', enum: ['wav', 'pcm'], default: 'wav' },
        },
      },
      FeedbackRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['entityId', 'entityType', 'feedbackType'],
        properties: {
          entityId: { type: 'string', minLength: 1, maxLength: 100, description: 'UUID; attraction feedback also accepts legacy frontend attraction slugs.' },
          entityType: { type: 'string', enum: ['ATTRACTION', 'FACT', 'CROWD_RECORD'] },
          feedbackType: { type: 'string', enum: ['INACCURATE', 'OUTDATED', 'OTHER'] },
          comment: { type: 'string', maxLength: 500 },
        },
      },
      FeedbackReviewRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['REVIEWED', 'ACCEPTED', 'REJECTED'] },
          factVerificationStatus: { type: 'string', enum: ['VERIFIED', 'LIVE', 'COMMUNITY', 'INFERRED', 'UNVERIFIED', 'OUTDATED', 'DISPUTED'] },
          notes: { type: 'string', maxLength: 500 },
        },
      },
      FactReverificationRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['verificationStatus'],
        properties: {
          verificationStatus: { type: 'string', enum: ['VERIFIED', 'LIVE', 'COMMUNITY', 'INFERRED', 'UNVERIFIED', 'OUTDATED', 'DISPUTED'] },
          notes: { type: 'string', maxLength: 500 },
        },
      },
      BudgetEstimateRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['attractionIds'],
        properties: {
          attractionIds: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 100 }, minItems: 1, maxItems: 50, description: 'UUIDs or legacy frontend slugs.' },
          travellerType: { type: 'string', enum: ['INDIAN', 'FOREIGN', 'CHILD'], default: 'INDIAN' },
          travellers: { type: 'integer', minimum: 1, maximum: 20, default: 1 },
        },
      },
      CrowdReportRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['attractionId', 'currentCrowdLevel'],
        properties: {
          attractionId: { type: 'string', minLength: 1, maxLength: 100, description: 'UUID or legacy frontend slug.' },
          currentCrowdLevel: { type: 'string', enum: ['LOW', 'MODERATE', 'HIGH', 'SEVERE'] },
          capacityValue: { type: 'integer', minimum: 0, maximum: 100000 },
        },
      },
      FavoriteRequest: {
        type: 'object',
        additionalProperties: false,
        oneOf: [{ required: ['attractionId'] }, { required: ['destinationId'] }],
        properties: {
          attractionId: { type: 'string', minLength: 1, maxLength: 100, description: 'UUID or legacy frontend slug.' },
          destinationId: { type: 'string', minLength: 1, maxLength: 100, description: 'UUID or legacy frontend slug.' },
        },
      },
      TripCreateRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['destinationId', 'startDate', 'endDate'],
        properties: {
          destinationId: { type: 'string', minLength: 1, maxLength: 100, description: 'UUID or legacy frontend slug.' },
          title: { type: 'string', minLength: 1, maxLength: 200, default: 'My Trip' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['DRAFT', 'PLANNED', 'ACTIVE', 'COMPLETED'], default: 'DRAFT' },
        },
      },
      TripUpdateRequest: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['DRAFT', 'PLANNED', 'ACTIVE', 'COMPLETED'] },
          isPublic: { type: 'boolean' },
        },
      },
      TripSnapshotRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['itinerarySnapshot'],
        properties: { itinerarySnapshot: { type: 'object', additionalProperties: true } },
      },
    },
    responses: {
      Ok: {
        description: 'Successful response.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
      },
      Created: {
        description: 'Created.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiResponse' } } },
      },
      BadRequest: {
        description: 'Validation error.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
      Unauthorized: {
        description: 'Missing or invalid bearer token.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
      Forbidden: {
        description: 'Authenticated user is not allowed to access the resource.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
      NotFound: {
        description: 'Resource not found.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
      Conflict: {
        description: 'Resource is not ready for the requested operation.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
      Pdf: {
        description: 'PDF document.',
        content: { 'application/pdf': { schema: { type: 'string', format: 'binary' } } },
      },
      Audio: {
        description: 'Audio document.',
        content: {
          'audio/wav': { schema: { type: 'string', format: 'binary' } },
          'audio/L16': { schema: { type: 'string', format: 'binary' } },
        },
      },
      ServiceUnavailable: {
        description: 'Upstream service unavailable.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
      },
    },
  },
  security: [],
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '503': { $ref: '#/components/responses/Ok' } },
      },
    },
    '/api/v1/users/me': {
      get: { security: bearerSecurity, tags: ['Users'], summary: 'Current user profile', responses: { '200': { $ref: '#/components/responses/Ok' }, '401': { $ref: '#/components/responses/Unauthorized' } } },
      patch: {
        security: bearerSecurity,
        tags: ['Users'],
        summary: 'Update profile fields',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfileUpdate' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/api/v1/users/me/preferences': {
      get: { security: bearerSecurity, tags: ['Users'], summary: 'Current user preferences', responses: { '200': { $ref: '#/components/responses/Ok' }, '401': { $ref: '#/components/responses/Unauthorized' } } },
      put: {
        security: bearerSecurity,
        tags: ['Users'],
        summary: 'Upsert full preferences',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserPreferences' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
      patch: {
        security: bearerSecurity,
        tags: ['Users'],
        summary: 'Partially update preferences',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/UserPreferences' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/api/v1/knowledge/destinations': {
      get: {
        tags: ['Knowledge'],
        summary: 'List destinations',
        parameters: [
          { name: 'region', in: 'query', schema: { type: 'string' } },
          { name: 'country', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/api/v1/knowledge/destinations/{id}': {
      get: {
        tags: ['Knowledge'],
        summary: 'Get one destination',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/knowledge/destinations/{id}/attractions': {
      get: {
        tags: ['Knowledge'],
        summary: 'List destination attractions',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' },
          { name: 'categories', in: 'query', schema: { type: 'string' }, description: 'Comma-separated category list.' },
          { name: 'accessibilityWheelchair', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'indoorOutdoor', in: 'query', schema: { type: 'string', enum: ['indoor', 'outdoor', 'mixed'] } },
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/attractions/{id}/facts': {
      get: {
        tags: ['Attractions'],
        summary: 'Get attraction fact provenance',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/attractions/{id}/alternatives': {
      get: {
        tags: ['Attractions'],
        summary: 'Suggest similar attractions',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/live/weather': {
      get: {
        tags: ['Live Data'],
        summary: 'Current weather',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lon', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/live/route': {
      get: {
        tags: ['Live Data'],
        summary: 'Distance and duration',
        parameters: [
          { name: 'startLat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'startLon', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
          { name: 'endLat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'endLon', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
          { name: 'profile', in: 'query', schema: { type: 'string', enum: ['driving-car', 'foot-walking'], default: 'driving-car' } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/planner/generate': {
      post: {
        security: [{}, ...bearerSecurity],
        tags: ['Planner'],
        summary: 'Generate an itinerary',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/PlannerRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/nlu/extract': {
      post: {
        tags: ['NLU'],
        summary: 'Extract trip preferences from text',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NluExtractRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/nlu/narrate': {
      post: {
        tags: ['NLU'],
        summary: 'Generate itinerary narration',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NluNarrateRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/nlu/speech': {
      post: {
        tags: ['NLU'],
        summary: 'Generate spoken narration audio',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NluSpeechRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Audio' }, '400': { $ref: '#/components/responses/BadRequest' }, '503': { $ref: '#/components/responses/ServiceUnavailable' } },
      },
    },
    '/api/v1/feedback': {
      post: {
        security: bearerSecurity,
        tags: ['Feedback'],
        summary: 'Queue feedback for review',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/FeedbackRequest' } } } },
        responses: { '201': { $ref: '#/components/responses/Created' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/api/v1/feedback/admin/review-queue': {
      get: {
        security: bearerSecurity,
        tags: ['Feedback'],
        summary: 'List feedback awaiting admin review',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING', 'REVIEWED', 'ACCEPTED', 'REJECTED'], default: 'PENDING' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '403': { $ref: '#/components/responses/Forbidden' } },
      },
    },
    '/api/v1/feedback/admin/{id}/review': {
      patch: {
        security: bearerSecurity,
        tags: ['Feedback'],
        summary: 'Resolve feedback and optionally update fact verification',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/FeedbackReviewRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '403': { $ref: '#/components/responses/Forbidden' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/feedback/admin/facts/{factId}/reverify': {
      post: {
        security: bearerSecurity,
        tags: ['Feedback'],
        summary: 'Record a manual fact re-verification result',
        parameters: [{ name: 'factId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/FactReverificationRequest' } } } },
        responses: { '201': { $ref: '#/components/responses/Created' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '403': { $ref: '#/components/responses/Forbidden' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/crowd/attractions/{attractionId}': {
      get: {
        tags: ['Crowd'],
        summary: 'Get latest crowd signal for an attraction',
        security: [],
        parameters: [{ name: 'attractionId', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/crowd/reports': {
      post: {
        security: bearerSecurity,
        tags: ['Crowd'],
        summary: 'Submit a community crowd report',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CrowdReportRequest' } } } },
        responses: { '201': { $ref: '#/components/responses/Created' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/favorites': {
      get: { security: bearerSecurity, tags: ['Favorites'], summary: 'List saved destinations and attractions', responses: { '200': { $ref: '#/components/responses/Ok' }, '401': { $ref: '#/components/responses/Unauthorized' } } },
      post: {
        security: bearerSecurity,
        tags: ['Favorites'],
        summary: 'Add destination or attraction favorite',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/FavoriteRequest' } } } },
        responses: { '201': { $ref: '#/components/responses/Created' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/api/v1/favorites/destinations/{destinationId}': {
      delete: {
        security: bearerSecurity,
        tags: ['Favorites'],
        summary: 'Remove destination favorite',
        parameters: [{ name: 'destinationId', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/api/v1/favorites/{attractionId}': {
      delete: {
        security: bearerSecurity,
        tags: ['Favorites'],
        summary: 'Remove attraction favorite',
        parameters: [{ name: 'attractionId', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/api/v1/trips': {
      get: { security: bearerSecurity, tags: ['Trips'], summary: 'List current user trips', responses: { '200': { $ref: '#/components/responses/Ok' }, '401': { $ref: '#/components/responses/Unauthorized' } } },
      post: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Create a trip',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TripCreateRequest' } } } },
        responses: { '201': { $ref: '#/components/responses/Created' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
    '/api/v1/trips/{id}': {
      get: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Get owned trip',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
      patch: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Update trip metadata and sharing',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TripUpdateRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
      delete: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Delete owned trip',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/trips/{id}/snapshot': {
      post: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Save an itinerary snapshot',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TripSnapshotRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/trips/{id}/export': {
      get: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Export owned trip itinerary as PDF',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { $ref: '#/components/responses/Pdf' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' }, '409': { $ref: '#/components/responses/Conflict' } },
      },
    },
    '/api/v1/trips/share/{token}': {
      get: {
        tags: ['Trips'],
        summary: 'Get a public shared trip',
        security: [],
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string', minLength: 8, maxLength: 128 } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/trips/share/{token}/export': {
      get: {
        tags: ['Trips'],
        summary: 'Export public shared trip itinerary as PDF',
        security: [],
        parameters: [{ name: 'token', in: 'path', required: true, schema: { type: 'string', minLength: 8, maxLength: 128 } }],
        responses: { '200': { $ref: '#/components/responses/Pdf' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' }, '409': { $ref: '#/components/responses/Conflict' } },
      },
    },
    '/api/v1/services/exchange-rates': {
      get: { tags: ['Services'], summary: 'INR exchange rates', responses: { '200': { $ref: '#/components/responses/Ok' } } },
    },
    '/api/v1/services/holidays': {
      get: {
        tags: ['Services'],
        summary: 'Public holidays',
        parameters: [
          { name: 'countryCode', in: 'query', schema: { type: 'string', minLength: 2, maxLength: 2, default: 'IN' } },
          { name: 'year', in: 'query', schema: { type: 'integer', minimum: 2020, maximum: 2100 } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/services/country-info/{code}': {
      get: {
        tags: ['Services'],
        summary: 'Country metadata',
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string', minLength: 2, maxLength: 3 } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/services/safety-pulse': {
      get: { tags: ['Services'], summary: 'India travel safety pulse', responses: { '200': { $ref: '#/components/responses/Ok' } } },
    },
    '/api/v1/emergency': {
      get: {
        tags: ['Emergency'],
        summary: 'India emergency contacts',
        security: [],
        parameters: [
          { name: 'countryCode', in: 'query', schema: { type: 'string', minLength: 2, maxLength: 2, default: 'IN' } },
          { name: 'destinationId', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/guide/destinations/{id}': {
      get: {
        tags: ['Guide'],
        summary: 'Structured destination travel guide',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/guide/attractions/{id}': {
      get: {
        tags: ['Guide'],
        summary: 'Structured attraction guide',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/budget/destinations/{id}': {
      get: {
        tags: ['Budget'],
        summary: 'Calculate destination ticket budget',
        security: [],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' },
          { name: 'travellerType', in: 'query', schema: { type: 'string', enum: ['INDIAN', 'FOREIGN', 'CHILD'], default: 'INDIAN' } },
          { name: 'travellers', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20, default: 1 } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/budget/estimate': {
      post: {
        tags: ['Budget'],
        summary: 'Calculate ticket budget for selected attractions',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BudgetEstimateRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/analytics/dashboard': {
      get: { security: bearerSecurity, tags: ['Analytics'], summary: 'Platform dashboard metrics', responses: { '200': { $ref: '#/components/responses/Ok' }, '401': { $ref: '#/components/responses/Unauthorized' } } },
    },
    '/api/v1/search': {
      get: {
        tags: ['Search'],
        summary: 'Search destinations and attractions',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2, maxLength: 100 } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['all', 'destination', 'attraction'], default: 'all' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20, default: 10 } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/nearby': {
      get: {
        tags: ['Nearby'],
        summary: 'Find attractions near a coordinate',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lon', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
          { name: 'radiusKm', in: 'query', schema: { type: 'number', minimum: 0.1, maximum: 100, default: 10 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
          { name: 'destinationId', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/local-businesses': {
      get: {
        tags: ['Local Businesses'],
        summary: 'Discover local businesses',
        parameters: [
          { name: 'destinationId', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' },
          { name: 'category', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 100 } },
          { name: 'locallyOwned', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'search', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 100 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
  },
} as const;

export const swaggerContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: https:",
  "font-src 'self' data: https:",
  "connect-src 'self'",
  "object-src 'none'",
].join('; ');

export const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>MargDarshak Backend API Docs</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f6f8fb; }
      .api-header {
        background: #0f172a;
        color: #f8fafc;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 18px 32px;
        border-bottom: 4px solid #14b8a6;
      }
      .api-header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 700; }
      .api-header p { margin: 0; color: #cbd5e1; font-size: 14px; }
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 28px 0; }
      .swagger-ui .scheme-container {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        box-shadow: none;
      }
      .swagger-ui .opblock { border-radius: 6px; box-shadow: none; }
      .swagger-ui .btn.authorize {
        border-color: #0f766e;
        color: #0f766e;
      }
      .swagger-ui .btn.authorize svg { fill: #0f766e; }
    </style>
  </head>
  <body>
    <header class="api-header">
      <h1>MargDarshak Backend API</h1>
      <p>OpenAPI documentation for knowledge, planner, trips, trust, guide, budget, PDF, and audio endpoints.</p>
    </header>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="/api/docs/swagger-init.js"></script>
  </body>
</html>`;

export const swaggerInitScript = `window.addEventListener('load', () => {
  window.ui = SwaggerUIBundle({
    url: '/api/openapi.json',
    dom_id: '#swagger-ui',
    deepLinking: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    persistAuthorization: true,
    tryItOutEnabled: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    defaultModelsExpandDepth: 1,
    presets: [SwaggerUIBundle.presets.apis],
    layout: 'BaseLayout'
  });
});`;
