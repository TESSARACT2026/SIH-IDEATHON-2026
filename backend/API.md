# API Documentation

Base URL: `/api/v1`

Health check: `/api/health`

Most API responses use:

```json
{
  "data": {}
}
```

Errors use:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## Authentication

The backend currently verifies Supabase access tokens. Send the Supabase session
access token on API requests:

```http
Authorization: Bearer <supabaseAccessToken>
```

There are no backend `/api/v1/auth/register`, `/api/v1/auth/login`,
`/api/v1/auth/refresh`, or `/api/v1/auth/logout` routes. Auth is handled by
Supabase on the frontend, then `AuthContext` attaches the access token to
`apiClient`.

Important current behavior: `backend/src/server.ts` mounts `requireAuth` at
`/api/v1`, so every endpoint below `/api/v1` requires a valid bearer token at
the server level. Some route handlers are written as public endpoints, but they
are not reachable anonymously while that global middleware remains in place.

## Endpoint Summary

| Method | Endpoint | Auth | Purpose |
|---|---|---:|---|
| GET | `/api/health` | No | Health, database connectivity, uptime, memory, environment. |
| GET | `/api/v1/users/me` | Yes | Current user profile and preferences. |
| PATCH | `/api/v1/users/me` | Yes | Update profile fields. |
| GET | `/api/v1/users/me/preferences` | Yes | Current user preferences, with defaults if none exist. |
| PUT | `/api/v1/users/me/preferences` | Yes | Upsert full preferences. |
| PATCH | `/api/v1/users/me/preferences` | Yes | Partially update preferences. |
| GET | `/api/v1/knowledge/destinations` | Yes | List destinations. |
| GET | `/api/v1/knowledge/destinations/:id` | Yes | Get one destination with attraction count. |
| GET | `/api/v1/knowledge/destinations/:id/attractions` | Yes | List destination attractions with filters. |
| GET | `/api/v1/attractions/:id/facts` | Yes | Get attraction fact provenance. |
| GET | `/api/v1/attractions/:id/alternatives` | Yes | Suggest similar same-destination attractions. |
| GET | `/api/v1/live/weather` | Yes | Current weather from Open-Meteo. |
| GET | `/api/v1/live/route` | Yes | Distance and duration from OpenRouteService. |
| POST | `/api/v1/planner/generate` | Yes | Generate an itinerary from preferences, trust data, weather, holidays, and routing. |
| POST | `/api/v1/nlu/extract` | Yes | Extract trip preferences from free text with Gemini or keyword fallback. |
| POST | `/api/v1/nlu/narrate` | Yes | Generate itinerary narration with fact-marker validation. |
| POST | `/api/v1/feedback` | Yes | Validate and queue feedback response. Does not persist yet. |
| GET | `/api/v1/favorites` | Yes | List current user's saved attractions. |
| POST | `/api/v1/favorites` | Yes | Add an attraction favorite. |
| DELETE | `/api/v1/favorites/:attractionId` | Yes | Remove an attraction favorite. |
| GET | `/api/v1/trips` | Yes | List current user's trips. |
| POST | `/api/v1/trips` | Yes | Create a trip. |
| GET | `/api/v1/trips/:id` | Yes | Get a trip owned by the current user. |
| PATCH | `/api/v1/trips/:id` | Yes | Update trip metadata and sharing state. |
| POST | `/api/v1/trips/:id/snapshot` | Yes | Save a frozen itinerary snapshot on a trip. |
| DELETE | `/api/v1/trips/:id` | Yes | Delete a trip owned by the current user. |
| GET | `/api/v1/trips/share/:token` | Yes* | Public share route in code, but blocked anonymously by global `/api/v1` auth. |
| GET | `/api/v1/services/exchange-rates` | Yes | INR exchange rates with 24-hour cache. |
| GET | `/api/v1/services/holidays` | Yes | Public holidays with 30-day cache. |
| GET | `/api/v1/services/country-info/:code` | Yes | Country metadata with 30-day cache. |
| GET | `/api/v1/services/safety-pulse` | Yes | India travel safety pulse with fallback data. |
| GET | `/api/v1/analytics/dashboard` | Yes | Platform counts and fact accuracy percentage. |

## Request Details

### Users

`PATCH /api/v1/users/me`

```json
{
  "name": "Optional Name",
  "preferredLanguage": "en",
  "emergencyContactName": "Optional Contact",
  "emergencyContactPhone": "+911234567890"
}
```

`PUT/PATCH /api/v1/users/me/preferences`

```json
{
  "budgetBand": "MODERATE",
  "pace": "RELAXED",
  "groupType": "FAMILY",
  "interests": ["Heritage", "Nature & Parks"],
  "foodPreferences": ["vegetarian"],
  "transportPreference": "MIXED",
  "accessibilityMobility": false,
  "accessibilityVision": false,
  "accessibilityHearing": false,
  "accessibilityCognitive": false,
  "accessibilityNotes": "Avoid long stairs",
  "walkingToleranceMinutes": 30,
  "indoorOutdoorPreference": "mixed",
  "localBusinessPreference": true
}
```

Allowed values:

- `preferredLanguage`: `en`, `hi`, `or`
- `budgetBand`: `BUDGET`, `MODERATE`, `PREMIUM`
- `pace`: `RELAXED`, `MODERATE`, `PACKED`
- `groupType`: `SOLO`, `COUPLE`, `FAMILY`, `GROUP`
- `transportPreference`: `WALKING`, `PUBLIC_TRANSIT`, `CAB`, `OWN_VEHICLE`, `MIXED`
- `indoorOutdoorPreference`: `indoor`, `outdoor`, `mixed`

### Knowledge And Attractions

`GET /api/v1/knowledge/destinations`

Query params:

- `region`: optional case-insensitive match
- `country`: optional case-insensitive match

`GET /api/v1/knowledge/destinations/:id/attractions`

Query params:

- `categories`: optional comma-separated category list
- `accessibilityWheelchair`: `true` or `false`
- `indoorOutdoor`: `indoor`, `outdoor`, or `mixed`
- `search`: optional name search, max 100 characters

Destination and attraction IDs accept 1-100 character strings. Seed data may use
slug IDs instead of UUIDs.

### Live Data

`GET /api/v1/live/weather?lat=20.2961&lon=85.8245`

`lat` must be `-90..90`; `lon` must be `-180..180`.

`GET /api/v1/live/route?startLat=20.2961&startLon=85.8245&endLat=20.27&endLon=85.84&profile=driving-car`

`profile` defaults to `driving-car`; allowed values are `driving-car` and
`foot-walking`.

### Planner

`POST /api/v1/planner/generate`

```json
{
  "destinationId": "bhubaneswar-odisha",
  "startDate": "2026-08-21T09:00:00.000Z",
  "endDate": "2026-08-23T18:00:00.000Z",
  "days": 3,
  "preferences": {
    "pace": "MODERATE",
    "accessibilityWheelchair": false,
    "accessibilityVision": false,
    "accessibilityHearing": false,
    "accessibilityCognitive": false,
    "interests": ["Heritage"],
    "transportPreference": "MIXED",
    "groupType": "SOLO",
    "walkingToleranceMinutes": 30,
    "indoorOutdoorPreference": "mixed",
    "localBusinessPreference": false
  }
}
```

Notes:

- `days` must be 1-14.
- `endDate` is accepted but ignored by the itinerary engine.
- The endpoint returns itinerary items, exclusions, and warnings. It does not
  create a trip or save a snapshot.

### NLU

`POST /api/v1/nlu/extract`

```json
{
  "prompt": "A relaxed family trip with temples, history, and short walks."
}
```

`prompt` must be 5-1000 characters.

`POST /api/v1/nlu/narrate`

```json
{
  "itinerary": [
    {
      "attractionName": "Lingaraj Temple",
      "startTime": "09:00",
      "endTime": "11:00",
      "factId": "00000000-0000-0000-0000-000000000000",
      "description": "Temple visit"
    }
  ],
  "validFactIds": ["00000000-0000-0000-0000-000000000000"]
}
```

`itinerary` supports up to 20 items. `validFactIds` supports up to 100 UUIDs.

### Feedback

`POST /api/v1/feedback`

```json
{
  "entityId": "fact-id-or-slug",
  "entityType": "FACT",
  "feedbackType": "OUTDATED",
  "comment": "The opening time has changed."
}
```

Allowed values:

- `entityType`: `ATTRACTION`, `FACT`, `CROWD_RECORD`
- `feedbackType`: `INACCURATE`, `OUTDATED`, `OTHER`

Current limitation: feedback is validated and logged, but not written to the
database.

### Favorites

`POST /api/v1/favorites`

```json
{
  "attractionId": "lingaraj-temple"
}
```

Adding a duplicate favorite is safe; the backend uses an upsert.

### Trips

`POST /api/v1/trips`

```json
{
  "destinationId": "bhubaneswar-odisha",
  "title": "My Trip",
  "startDate": "2026-08-21T09:00:00.000Z",
  "endDate": "2026-08-23T18:00:00.000Z",
  "status": "DRAFT"
}
```

`PATCH /api/v1/trips/:id`

```json
{
  "title": "Updated Trip",
  "startDate": "2026-08-21T09:00:00.000Z",
  "endDate": "2026-08-23T18:00:00.000Z",
  "status": "PLANNED",
  "isPublic": true
}
```

`POST /api/v1/trips/:id/snapshot`

```json
{
  "itinerarySnapshot": {
    "destinationId": "bhubaneswar-odisha",
    "days": 3,
    "itineraryItems": []
  }
}
```

Trip `:id` params must be UUIDs. `destinationId` accepts 1-100 character strings.
`status` values are `DRAFT`, `PLANNED`, `ACTIVE`, and `COMPLETED`. `endDate`
must be after `startDate` when creating a trip.

### Services

`GET /api/v1/services/holidays?countryCode=IN&year=2026`

- `countryCode`: two-letter country code, defaults to `IN`
- `year`: integer from `2020` to `2100`, defaults to the current year

`GET /api/v1/services/country-info/IN`

`code` must be 2-3 characters.

## Current Gaps

- Backend auth endpoints documented previously do not exist; use Supabase auth.
- Global `/api/v1` auth currently blocks routes intended to be public, including
  knowledge, live data, services, analytics, planner, NLU, and trip share.
- Feedback is not persisted.
- `POST /api/v1/planner/generate` does not save trips automatically.
- No backend endpoints exist yet for global search, nearby places, guide
  content, emergency contacts, admin feedback review, fact re-verification,
  crowd reports, local business discovery, budget tracking, PDF export, or
  server-side audio generation.
