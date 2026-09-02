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
    { name: 'Hotels' },
    { name: 'Scoring' },
    { name: 'Groups' },
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
              budgetBand: { type: 'string', enum: ['BUDGET', 'MODERATE', 'PREMIUM'], default: 'MODERATE' },
              preferredStartTime: { type: 'string', pattern: '^([01]\\\\d|2[0-3]):[0-5]\\\\d$', default: '09:00' },
            },
          },
        },
      },
      DestinationRatingRequest: {
        type: 'object',
        additionalProperties: false,
        properties: {
          destinationIds: { type: 'array', items: { type: 'string', minLength: 1, maxLength: 100 }, maxItems: 100 },
          startDate: { type: 'string', description: 'Travel date or date-time.' },
          preferredTime: { type: 'string', pattern: '^([01]\\\\d|2[0-3]):[0-5]\\\\d$', default: '09:00' },
          days: { type: 'integer', minimum: 1, maximum: 14, default: 3 },
          pace: { type: 'string', enum: ['RELAXED', 'MODERATE', 'PACKED'], default: 'MODERATE' },
          accessibilityWheelchair: { type: 'boolean', default: false },
          accessibilityVision: { type: 'boolean', default: false },
          accessibilityHearing: { type: 'boolean', default: false },
          accessibilityCognitive: { type: 'boolean', default: false },
          interests: { type: 'array', items: { type: 'string', maxLength: 50 }, maxItems: 20 },
          transportPreference: { type: 'string', enum: ['WALKING', 'PUBLIC_TRANSIT', 'CAB', 'OWN_VEHICLE', 'MIXED'], default: 'MIXED' },
          budgetBand: { type: 'string', enum: ['BUDGET', 'MODERATE', 'PREMIUM'], default: 'MODERATE' },
          preferences: { $ref: '#/components/schemas/PlannerRequest/properties/preferences' },
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
      NluVoiceCommandRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['utterance'],
        properties: {
          utterance: { type: 'string', minLength: 2, maxLength: 1000 },
          locale: { type: 'string', pattern: '^[a-z]{2,3}(-[A-Z]{2})?$', default: 'en-IN' },
          context: {
            type: 'object',
            additionalProperties: false,
            properties: {
              tripId: { type: 'string', format: 'uuid' },
              destinationId: { type: 'string', minLength: 1, maxLength: 100 },
              lat: { type: 'number', minimum: -90, maximum: 90 },
              lon: { type: 'number', minimum: -180, maximum: 180 },
              radiusKm: { type: 'number', minimum: 0.1, maximum: 50, default: 10 },
              now: { type: 'string', format: 'date-time' },
              remainingMinutes: { type: 'integer', minimum: 15, maximum: 1440 },
              preferences: { $ref: '#/components/schemas/PlannerRequest/properties/preferences' },
            },
          },
        },
      },
      WhatIfDeltaRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['query'],
        properties: {
          query: { type: 'string', minLength: 3, maxLength: 500 },
        },
      },
      ReplanRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['delta'],
        properties: {
          delta: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'payload'],
            properties: {
              type: { type: 'string', enum: ['weather_change', 'time_reduced', 'crowd_increase', 'budget_change'] },
              payload: {
                type: 'object',
                additionalProperties: true,
                description: 'weather_change supports affectedDays; budget_change supports maxBudgetPerPerson or decreaseByPerPerson.',
              },
            },
          },
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
          reportType: { type: 'string', enum: ['CLOSED', 'PRICE_CHANGED', 'ACCESSIBILITY_INCORRECT', 'HOURS_INCORRECT', 'ROAD_BLOCKED', 'OVERCROWDED', 'FACILITY_UNAVAILABLE', 'OTHER'] },
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
      TripBudgetBreakdownQuery: {
        type: 'object',
        properties: {
          travellerType: { type: 'string', enum: ['INDIAN', 'FOREIGN', 'CHILD'], default: 'INDIAN' },
          travellers: { type: 'integer', minimum: 1, maximum: 20, default: 1 },
        },
      },
      TourismImpactRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['destinationId', 'startDate', 'days', 'preferences'],
        properties: {
          destinationId: { type: 'string', minLength: 1, maxLength: 100 },
          startDate: { type: 'string', format: 'date-time' },
          days: { type: 'integer', minimum: 1, maximum: 14 },
          preferences: { $ref: '#/components/schemas/PlannerRequest/properties/preferences' },
        },
      },
      GroupCreateRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['destinationId', 'startDate', 'days'],
        properties: {
          destinationId: { type: 'string', minLength: 1, maxLength: 100, description: 'UUID or legacy frontend slug.' },
          startDate: { type: 'string', format: 'date-time' },
          days: { type: 'integer', minimum: 1, maximum: 14 },
          title: { type: 'string', minLength: 1, maxLength: 200, default: 'Group Trip' },
        },
      },
      GroupJoinRequest: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'preferences'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
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
              walkingToleranceMinutes: { type: 'integer', minimum: 5, maximum: 240, default: 30 },
            },
          },
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
        properties: {
          itinerarySnapshot: { type: 'object', additionalProperties: true },
          plannerInput: { type: 'object', additionalProperties: true },
        },
      },
      HotelProviderStatus: {
        type: 'object',
        additionalProperties: false,
        properties: {
          provider: {
            type: 'string',
            enum: [
              'Geoapify Places',
              'OpenStreetMap/Overpass',
              'Geoapify Place Details',
              'OpenStreetMap/Overpass Details',
              'Staying API',
              'Booking.com Demand API',
            ],
          },
          capabilities: { type: 'array', items: { type: 'string', enum: ['DISCOVERY', 'DETAILS', 'OFFERS'] } },
          configured: { type: 'boolean' },
          implemented: { type: 'boolean' },
          status: { type: 'string', enum: ['READY', 'MISSING_API_KEY', 'IMPLEMENTATION_PENDING', 'FUTURE_PARTNER_ACCESS_REQUIRED'] },
          requiredEnv: { type: 'array', items: { type: 'string' } },
          nextPhase: { oneOf: [{ type: 'integer' }, { type: 'string' }] },
        },
      },
      HotelUnavailableState: {
        type: 'object',
        additionalProperties: false,
        properties: {
          code: { type: 'string' },
          message: { type: 'string' },
          action: {
            type: 'string',
            enum: ['CONFIGURE_PROVIDER_KEY', 'WAIT_FOR_PROVIDER_IMPLEMENTATION', 'REQUEST_PARTNER_ACCESS', 'RETRY_LATER'],
          },
        },
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
    '/api/v1/attractions/{id}/suitability': {
      get: {
        tags: ['Attractions'],
        summary: 'Explain attraction suitability for a time and constraints',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 }, description: 'UUID or legacy frontend slug.' },
          { name: 'time', in: 'query', required: true, schema: { type: 'string', pattern: '^\\d{2}:\\d{2}$' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'accessibilityWheelchair', in: 'query', schema: { type: 'boolean', default: false } },
          { name: 'accessibilityVision', in: 'query', schema: { type: 'boolean', default: false } },
          { name: 'accessibilityHearing', in: 'query', schema: { type: 'boolean', default: false } },
          { name: 'accessibilityCognitive', in: 'query', schema: { type: 'boolean', default: false } },
          { name: 'walkingToleranceMinutes', in: 'query', schema: { type: 'integer', minimum: 5, maximum: 240 } },
          { name: 'weatherCondition', in: 'query', schema: { type: 'string', enum: ['clear', 'cloudy', 'rain', 'snow', 'thunderstorm', 'extreme_heat', 'unknown'] } },
          { name: 'maxTempC', in: 'query', schema: { type: 'number', minimum: -30, maximum: 60 } },
        ],
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
    '/api/v1/live/forecast': {
      get: {
        tags: ['Live Data'],
        summary: 'Daily forecast range',
        parameters: [
          { name: 'lat', in: 'query', required: true, schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lon', in: 'query', required: true, schema: { type: 'number', minimum: -180, maximum: 180 } },
          { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/live/route': {
      get: {
        tags: ['Live Data'],
        summary: 'Distance and duration',
        description: 'Returns distance, duration, route geometry, and source. Falls back to straight-line geometry when routing provider data is unavailable.',
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
    '/api/v1/nlu/voice-command': {
      post: {
        security: [{}, ...bearerSecurity],
        tags: ['NLU'],
        summary: 'Resolve a context-aware travel voice command',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/NluVoiceCommandRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/nlu/extract-delta': {
      post: {
        tags: ['NLU'],
        summary: 'Extract a structured what-if replan delta',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/WhatIfDeltaRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
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
    '/api/v1/trips/{id}/offline-pack': {
      get: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Download owned trip offline survival pack',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' }, '409': { $ref: '#/components/responses/Conflict' } },
      },
    },
    '/api/v1/trips/{id}/hotel': {
      get: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Get selected trip hotel snapshot',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
      put: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Save or replace selected trip hotel snapshot',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['hotel'],
                properties: {
                  hotel: { type: 'object', additionalProperties: true },
                  offer: { type: 'object', additionalProperties: true },
                },
              },
            },
          },
        },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
      delete: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Remove selected trip hotel snapshot',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/trips/{id}/hotels/recommendations': {
      get: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Recommend hotels ranked by itinerary fit',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/trips/{id}/itinerary/replan': {
      post: {
        security: bearerSecurity,
        tags: ['Trips'],
        summary: 'Re-run deterministic planner with a what-if delta',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ReplanRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
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
    '/api/v1/budget/trips/{id}/breakdown': {
      get: {
        security: bearerSecurity,
        tags: ['Budget'],
        summary: 'Calculate transparent budget breakdown for a saved trip',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'travellerType', in: 'query', schema: { type: 'string', enum: ['INDIAN', 'FOREIGN', 'CHILD'], default: 'INDIAN' } },
          { name: 'travellers', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 20, default: 1 } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' }, '409': { $ref: '#/components/responses/Conflict' } },
      },
    },
    '/api/v1/hotels/providers': {
      get: {
        tags: ['Hotels'],
        summary: 'Inspect hotel provider readiness',
        security: [],
        responses: { '200': { $ref: '#/components/responses/Ok' } },
      },
    },
    '/api/v1/hotels/search': {
      get: {
        tags: ['Hotels'],
        summary: 'Search trusted hotels from provider-backed discovery',
        description: 'Uses Geoapify Places when GEOAPIFY_API_KEY is configured, then OpenStreetMap/Overpass as fallback. Discovery responses never fabricate room prices or live availability.',
        security: [],
        parameters: [
          { name: 'destinationId', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 100 } },
          { name: 'lat', in: 'query', schema: { type: 'number', minimum: -90, maximum: 90 } },
          { name: 'lon', in: 'query', schema: { type: 'number', minimum: -180, maximum: 180 } },
          { name: 'radiusKm', in: 'query', schema: { type: 'number', minimum: 0.1, maximum: 50, default: 5 } },
          { name: 'checkIn', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'checkOut', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'adults', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10, default: 2 } },
          { name: 'rooms', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5, default: 1 } },
          { name: 'priceBand', in: 'query', schema: { type: 'string', enum: ['BUDGET', 'MODERATE', 'PREMIUM'] } },
          { name: 'amenities', in: 'query', schema: { type: 'string', maxLength: 200 }, description: 'Comma-separated desired amenities.' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['hotel', 'guest_house', 'hostel', 'motel', 'apartment'] } },
          { name: 'wheelchairAccessible', in: 'query', schema: { type: 'boolean' } },
          { name: 'wifi', in: 'query', schema: { type: 'boolean' } },
          { name: 'parking', in: 'query', schema: { type: 'boolean' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['DISTANCE', 'TRUST', 'RECOMMENDED'], default: 'DISTANCE' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/hotels/offers': {
      get: {
        tags: ['Hotels'],
        summary: 'Fetch trusted hotel offers once providers are configured',
        description: 'Fetches Staying API hotel offers when a direct listing id or price-compare mapping is supplied. Live 202 Accepted jobs are polled briefly before returning retry-later metadata. Never fabricates prices.',
        security: [],
        parameters: [
          { name: 'hotelId', in: 'query', required: true, schema: { type: 'string', minLength: 1, maxLength: 150 } },
          { name: 'providerHotelId', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 200 } },
          { name: 'platform', in: 'query', schema: { type: 'string', enum: ['airbnb', 'booking', 'vrbo', 'expedia', 'hotels', 'google', 'tripadvisor'] } },
          { name: 'name', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 200 } },
          { name: 'location', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 200 } },
          { name: 'googleHotelId', in: 'query', schema: { type: 'string', minLength: 1, maxLength: 200 } },
          { name: 'checkIn', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'checkOut', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'adults', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10, default: 2 } },
          { name: 'rooms', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5, default: 1 } },
          { name: 'currency', in: 'query', schema: { type: 'string', minLength: 3, maxLength: 3, default: 'INR' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10, default: 5 } },
        ],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/hotels/booking-link': {
      get: {
        tags: ['Hotels'],
        summary: 'Validate a safe external hotel booking link',
        security: [],
        parameters: [{ name: 'url', in: 'query', required: true, schema: { type: 'string', format: 'uri' } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/hotels/{id}': {
      get: {
        tags: ['Hotels'],
        summary: 'Get trusted hotel details by provider-backed hotel id',
        description: 'Accepts geoapify:<place_id> and osm:node/<id>, osm:way/<id>, or osm:relation/<id>. Details remain source-backed and never prove live room price or availability.',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1, maxLength: 150 } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' }, '502': { $ref: '#/components/responses/ServiceUnavailable' }, '503': { $ref: '#/components/responses/ServiceUnavailable' } },
      },
    },
    '/api/v1/scoring/trip-health/{id}': {
      get: {
        security: bearerSecurity,
        tags: ['Scoring'],
        summary: 'Calculate trip health/risk score',
        description: 'Includes weather, crowd, transport/routing, closure, accessibility, emergency-readiness, data-quality sub-scores, and deterministic mitigation actions for risky trips.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/scoring/tourism-impact': {
      post: {
        tags: ['Scoring'],
        summary: 'Compare popular and responsible route impact metrics',
        description: 'Returns route-level crowd, local-business, travel-distance, environmental, cultural-sensitivity, and overall impact-score metrics.',
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TourismImpactRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/scoring/trip-trust/{id}': {
      get: {
        security: bearerSecurity,
        tags: ['Scoring'],
        summary: 'Aggregate trip-level trust score',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/scoring/destination-ratings': {
      post: {
        security: [],
        tags: ['Scoring'],
        summary: 'Rate destinations against traveller inputs',
        description: 'Returns deterministic destination fit scores from travel date, preferred time, duration, pace, accessibility needs, interests, transport mode, and budget band.',
        requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/DestinationRatingRequest' } } } },
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' } },
      },
    },
    '/api/v1/groups': {
      post: {
        security: bearerSecurity,
        tags: ['Groups'],
        summary: 'Create a group planning session',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GroupCreateRequest' } } } },
        responses: { '201': { $ref: '#/components/responses/Created' }, '400': { $ref: '#/components/responses/BadRequest' }, '401': { $ref: '#/components/responses/Unauthorized' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/groups/{code}': {
      get: {
        tags: ['Groups'],
        summary: 'Get group planning session status',
        security: [],
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string', minLength: 6, maxLength: 20 } }],
        responses: { '200': { $ref: '#/components/responses/Ok' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/groups/{code}/join': {
      post: {
        tags: ['Groups'],
        summary: 'Submit participant preferences',
        security: [],
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string', minLength: 6, maxLength: 20 } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/GroupJoinRequest' } } } },
        responses: { '201': { $ref: '#/components/responses/Created' }, '400': { $ref: '#/components/responses/BadRequest' }, '404': { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/api/v1/groups/{code}/generate': {
      post: {
        tags: ['Groups'],
        summary: 'Generate itinerary from blended group preferences',
        security: [],
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string', minLength: 6, maxLength: 20 } }],
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
