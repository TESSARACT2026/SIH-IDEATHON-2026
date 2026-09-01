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
the route level. Users, feedback, favorites, authenticated trip operations, and
analytics require a valid bearer token. Knowledge, attractions, live data,
planner, NLU, services, and public trip-share routes are reachable anonymously.

Admin review endpoints require both a valid bearer token and the user's email
in the comma-separated `ADMIN_EMAILS` environment variable.

## Endpoint Summary

| Method | Endpoint | Auth | Purpose |
|---|---|---:|---|
| GET | `/api/health` | No | Health, database connectivity, uptime, memory, environment. |
| GET | `/api/v1/users/me` | Yes | Current user profile and preferences. |
| PATCH | `/api/v1/users/me` | Yes | Update profile fields. |
| GET | `/api/v1/users/me/preferences` | Yes | Current user preferences, with defaults if none exist. |
| PUT | `/api/v1/users/me/preferences` | Yes | Upsert full preferences. |
| PATCH | `/api/v1/users/me/preferences` | Yes | Partially update preferences. |
| GET | `/api/v1/knowledge/destinations` | No | List destinations. |
| GET | `/api/v1/knowledge/destinations/:id` | No | Get one destination with attraction count. |
| GET | `/api/v1/knowledge/destinations/:id/attractions` | No | List destination attractions with filters. |
| GET | `/api/v1/attractions/:id/facts` | No | Get attraction fact provenance. |
| GET | `/api/v1/attractions/:id/alternatives` | No | Suggest similar same-destination attractions. |
| GET | `/api/v1/live/weather` | No | Current weather from Open-Meteo. |
| GET | `/api/v1/live/forecast` | No | Daily forecast range from Open-Meteo. |
| GET | `/api/v1/live/route` | No | Distance and duration from OpenRouteService. |
| POST | `/api/v1/planner/generate` | Optional | Generate an itinerary; with `saveTrip: true` and bearer auth, also save the trip and itinerary. |
| POST | `/api/v1/nlu/extract` | No | Extract trip preferences from free text with Gemini or keyword fallback. |
| POST | `/api/v1/nlu/narrate` | No | Generate itinerary narration with fact-marker validation. |
| POST | `/api/v1/nlu/speech` | No | Generate spoken narration audio with Gemini TTS. |
| POST | `/api/v1/feedback` | Yes | Validate and queue feedback response for review. |
| GET | `/api/v1/feedback/admin/review-queue` | Admin | List feedback awaiting review. |
| PATCH | `/api/v1/feedback/admin/:id/review` | Admin | Resolve feedback and optionally update a fact's verification status. |
| POST | `/api/v1/feedback/admin/facts/:factId/reverify` | Admin | Record a manual fact re-verification result. |
| GET | `/api/v1/crowd/attractions/:attractionId` | No | Get latest crowd signal for an attraction. |
| POST | `/api/v1/crowd/reports` | Yes | Submit a community crowd report. |
| GET | `/api/v1/favorites` | Yes | List current user's saved attractions. |
| POST | `/api/v1/favorites` | Yes | Add an attraction favorite. |
| DELETE | `/api/v1/favorites/:attractionId` | Yes | Remove an attraction favorite. |
| GET | `/api/v1/trips` | Yes | List current user's trips. |
| POST | `/api/v1/trips` | Yes | Create a trip. |
| GET | `/api/v1/trips/:id` | Yes | Get a trip owned by the current user. |
| GET | `/api/v1/trips/:id/export` | Yes | Export a saved trip itinerary snapshot as PDF. |
| PATCH | `/api/v1/trips/:id` | Yes | Update trip metadata and sharing state. |
| POST | `/api/v1/trips/:id/snapshot` | Yes | Save a frozen itinerary snapshot on a trip. |
| DELETE | `/api/v1/trips/:id` | Yes | Delete a trip owned by the current user. |
| GET | `/api/v1/trips/share/:token` | No | Public shared trip lookup. |
| GET | `/api/v1/trips/share/:token/export` | No | Export a public shared trip itinerary snapshot as PDF. |
| GET | `/api/v1/services/exchange-rates` | No | INR exchange rates with 24-hour cache. |
| GET | `/api/v1/services/holidays` | No | Public holidays with 30-day cache. |
| GET | `/api/v1/services/country-info/:code` | No | Country metadata with 30-day cache. |
| GET | `/api/v1/services/safety-pulse` | No | India travel safety pulse with fallback data. |
| GET | `/api/v1/emergency` | No | India emergency contacts, optionally destination-aware. |
| GET | `/api/v1/guide/destinations/:id` | No | Structured destination travel guide from stored trusted data. |
| GET | `/api/v1/guide/attractions/:id` | No | Structured attraction guide with provenance, crowd, and sensitivity data. |
| GET | `/api/v1/budget/destinations/:id` | No | Calculate destination ticket budget from verified/live price facts. |
| POST | `/api/v1/budget/estimate` | No | Calculate ticket budget for selected attractions. |
| GET | `/api/v1/analytics/dashboard` | Yes | Platform counts and fact accuracy percentage. |
| GET | `/api/v1/search` | No | Search destinations and attractions by text. |
| GET | `/api/v1/nearby` | No | Find attractions near a coordinate. |
| GET | `/api/v1/local-businesses` | No | Discover locally owned businesses for a destination. |

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

Destination and attraction IDs accept UUIDs and the legacy frontend slugs from
the original fallback data.

### Live Data

`GET /api/v1/live/weather?lat=20.2961&lon=85.8245`

`lat` must be `-90..90`; `lon` must be `-180..180`.
Use this endpoint with browser geolocation coordinates for client-location
real-time weather. The response includes current temperature, condition,
humidity, wind speed, source, and timestamp when the upstream provider returns
them. Backend weather responses are cached for 10 minutes.

`GET /api/v1/live/forecast?lat=20.2961&lon=85.8245&startDate=2026-09-01&endDate=2026-09-04`

Returns one daily forecast card per available date in the inclusive range.

`GET /api/v1/live/route?startLat=20.2961&startLon=85.8245&endLat=20.27&endLon=85.84&profile=driving-car`

`profile` defaults to `driving-car`; allowed values are `driving-car` and
`foot-walking`.

### Planner

`POST /api/v1/planner/generate`

```json
{
  "destinationId": "00000000-0000-4000-8000-000000001001",
  "title": "Odisha Heritage Weekend",
  "startDate": "2026-08-21T09:00:00.000Z",
  "endDate": "2026-08-23T18:00:00.000Z",
  "days": 3,
  "saveTrip": false,
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
- `endDate` is optional for generation; when saving, it defaults to the final
  itinerary day at 18:00 if omitted.
- `saveTrip` defaults to `false`. When `true`, the request must include a valid
  bearer token and the response includes `savedTrip.tripId` and
  `savedTrip.itineraryId`.

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

`POST /api/v1/nlu/speech`

```json
{
  "text": "Say warmly: Welcome to Bhubaneswar.",
  "voiceName": "Kore",
  "languageCode": "en-US",
  "format": "wav"
}
```

- `text`: 3-4000 characters.
- `voiceName`: Gemini prebuilt voice name, defaults to `Kore`.
- `languageCode`: optional BCP-47-style language code such as `en-US` or `hi-IN`.
- `format`: `wav` or `pcm`; defaults to `wav`.

Returns binary audio (`audio/wav` by default). If Gemini TTS is unavailable, the
route returns `503 AUDIO_UNAVAILABLE`.

### Feedback

`POST /api/v1/feedback`

```json
{
  "entityId": "00000000-0000-4000-8000-000000003001",
  "entityType": "FACT",
  "feedbackType": "OUTDATED",
  "comment": "The opening time has changed."
}
```

Allowed values:

- `entityType`: `ATTRACTION`, `FACT`, `CROWD_RECORD`
- `feedbackType`: `INACCURATE`, `OUTDATED`, `OTHER`

Feedback is stored with `PENDING` status for manual review. Submitting feedback
does not automatically downgrade or rewrite trusted facts.

`GET /api/v1/feedback/admin/review-queue?status=PENDING&limit=20`

- `status`: `PENDING`, `REVIEWED`, `ACCEPTED`, or `REJECTED`; defaults to `PENDING`.
- `limit`: 1-50 items; defaults to 20.

`PATCH /api/v1/feedback/admin/:id/review`

```json
{
  "status": "ACCEPTED",
  "factVerificationStatus": "DISPUTED",
  "notes": "Official source needs recheck before restoring verified status."
}
```

`factVerificationStatus` is optional and only valid when the feedback targets a
fact. When provided, the backend updates the fact, refreshes `lastChecked`, and
writes a `VerificationRecord`.

`POST /api/v1/feedback/admin/facts/:factId/reverify`

```json
{
  "verificationStatus": "VERIFIED",
  "notes": "Confirmed against official tourism source."
}
```

### Crowd

`GET /api/v1/crowd/attractions/lingaraj-temple`

`attractionId` accepts UUIDs and legacy frontend attraction slugs.

`POST /api/v1/crowd/reports`

```json
{
  "attractionId": "lingaraj-temple",
  "currentCrowdLevel": "HIGH",
  "capacityValue": 250
}
```

Allowed `currentCrowdLevel` values are `LOW`, `MODERATE`, `HIGH`, and `SEVERE`.
Community reports are stored with `COMMUNITY` verification status and do not
overwrite verified or live crowd records.

### Favorites

`POST /api/v1/favorites`

```json
{
  "attractionId": "00000000-0000-4000-8000-000000002001"
}
```

Adding a duplicate favorite is safe; the backend uses an upsert.

### Trips

`POST /api/v1/trips`

```json
{
  "destinationId": "00000000-0000-4000-8000-000000001001",
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
    "destinationId": "00000000-0000-4000-8000-000000001001",
    "days": 3,
    "itineraryItems": []
  }
}
```

`GET /api/v1/trips/:id/export`

Returns `application/pdf` for the current user's saved `itinerarySnapshot`.

`GET /api/v1/trips/share/:token/export`

Returns the same PDF export for public shared trips. Export responses never
include owner IDs, owner email, or share tokens inside the document.

Trip `:id` params must be UUIDs. `destinationId` accepts UUIDs and legacy
frontend destination slugs.
`status` values are `DRAFT`, `PLANNED`, `ACTIVE`, and `COMPLETED`. `endDate`
must be after `startDate` when creating or updating a trip. Public share
responses return ISO date strings and never include owner IDs, owner email, or
the raw `shareToken`.

### Services

`GET /api/v1/services/holidays?countryCode=IN&year=2026`

- `countryCode`: two-letter country code, defaults to `IN`
- `year`: integer from `2020` to `2100`, defaults to the current year

`GET /api/v1/services/country-info/IN`

`code` must be 2-3 characters.

### Emergency

`GET /api/v1/emergency?destinationId=bhubaneswar-odisha&countryCode=IN`

- `countryCode`: currently supports `IN`; defaults to `IN`.
- `destinationId`: optional UUID or legacy frontend destination slug.

The response includes national emergency numbers and adds regional contacts for
destinations where official state sources are mapped.

### Guide

`GET /api/v1/guide/destinations/bhubaneswar-odisha`

`GET /api/v1/guide/attractions/lingaraj-temple`

Destination and attraction IDs accept UUIDs and legacy frontend slugs. Guide
responses are structured from stored database records and include fact sources,
verification status, latest crowd signal, sensitivity flags, accessibility
fields, and missing-trusted-fact warnings. The guide API does not generate or
invent travel claims.

### Budget

`GET /api/v1/budget/destinations/bhubaneswar-odisha?travellerType=INDIAN&travellers=2`

`POST /api/v1/budget/estimate`

```json
{
  "attractionIds": ["lingaraj-temple", "odisha-state-museum"],
  "travellerType": "INDIAN",
  "travellers": 2
}
```

- `travellerType`: `INDIAN`, `FOREIGN`, or `CHILD`; defaults to `INDIAN`.
- `travellers`: 1-20; defaults to 1.

Budget totals only include `ticket_price` facts whose verification status is
`VERIFIED` or `LIVE`. Community or unverified prices are returned as line items
with warnings but excluded from the total.

### Search

`GET /api/v1/search?q=temple&type=all&limit=10`

- `q`: required text query, 2-100 characters.
- `type`: `all`, `destination`, or `attraction`; defaults to `all`.
- `limit`: 1-20 results; defaults to 10.

### Nearby

`GET /api/v1/nearby?lat=20.2961&lon=85.8245&radiusKm=10&limit=10`

- `lat`: required latitude from `-90` to `90`.
- `lon`: required longitude from `-180` to `180`.
- `radiusKm`: 0.1-100, defaults to 10.
- `limit`: 1-50, defaults to 10.
- `destinationId`: optional UUID or legacy frontend destination slug.

### Local Businesses

`GET /api/v1/local-businesses?destinationId=bhubaneswar-odisha&locallyOwned=true&limit=20`

- `destinationId`: optional UUID or legacy frontend destination slug.
- `category`: optional text filter.
- `locallyOwned`: `true` or `false`.
- `search`: optional name search, 1-100 characters.
- `limit`: 1-50, defaults to 20.

## Current Gaps

- Backend auth endpoints documented previously do not exist; use Supabase auth.
- No remaining backend feature gaps are currently documented here.
