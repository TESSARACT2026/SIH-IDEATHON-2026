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
| GET | `/api/v1/attractions/:id/suitability` | No | Explain whether an attraction fits a requested time and constraints. |
| GET | `/api/v1/live/weather` | No | Current weather from Open-Meteo. |
| GET | `/api/v1/live/forecast` | No | Daily forecast range from Open-Meteo. |
| GET | `/api/v1/live/route` | No | Distance and duration from OpenRouteService. |
| POST | `/api/v1/planner/generate` | Optional | Generate an itinerary; with `saveTrip: true` and bearer auth, also save the trip and itinerary. |
| POST | `/api/v1/nlu/extract` | No | Extract trip preferences from free text with Gemini or keyword fallback. |
| POST | `/api/v1/nlu/extract-delta` | No | Extract a structured what-if replan delta from free text. |
| POST | `/api/v1/nlu/narrate` | No | Generate itinerary narration with fact-marker validation. |
| POST | `/api/v1/nlu/speech` | No | Generate spoken narration audio with Gemini TTS. |
| POST | `/api/v1/nlu/voice-command` | Optional | Resolve a context-aware travel voice command. |
| POST | `/api/v1/feedback` | Yes | Validate and queue feedback response for review. |
| GET | `/api/v1/feedback/admin/review-queue` | Admin | List feedback awaiting review. |
| PATCH | `/api/v1/feedback/admin/:id/review` | Admin | Resolve feedback and optionally update a fact's verification status. |
| POST | `/api/v1/feedback/admin/facts/:factId/reverify` | Admin | Record a manual fact re-verification result. |
| GET | `/api/v1/crowd/attractions/:attractionId` | No | Get latest crowd signal for an attraction. |
| POST | `/api/v1/crowd/reports` | Yes | Submit a community crowd report. |
| GET | `/api/v1/favorites` | Yes | List current user's saved attractions. |
| POST | `/api/v1/favorites` | Yes | Add an attraction favorite. |
| DELETE | `/api/v1/favorites/:attractionId` | Yes | Remove an attraction favorite. |
| DELETE | `/api/v1/favorites/destinations/:destinationId` | Yes | Remove a destination favorite. |
| GET | `/api/v1/trips` | Yes | List current user's trips. |
| POST | `/api/v1/trips` | Yes | Create a trip. |
| GET | `/api/v1/trips/:id` | Yes | Get a trip owned by the current user. |
| GET | `/api/v1/trips/:id/export` | Yes | Export a saved trip itinerary snapshot as PDF. |
| GET | `/api/v1/trips/:id/offline-pack` | Yes | Download a saved trip offline survival pack as JSON. |
| GET | `/api/v1/trips/:id/hotel` | Yes | Get the selected hotel snapshot for a trip. |
| PUT | `/api/v1/trips/:id/hotel` | Yes | Save/replace a selected hotel snapshot on a trip. |
| DELETE | `/api/v1/trips/:id/hotel` | Yes | Remove the selected hotel snapshot from a trip. |
| GET | `/api/v1/trips/:id/hotels/recommendations` | Yes | Search hotels around the trip destination and rank by itinerary fit. |
| POST | `/api/v1/trips/:id/itinerary/replan` | Yes | Re-run deterministic planner with a what-if constraint delta. |
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
| GET | `/api/v1/budget/trips/:id/breakdown` | Yes | Calculate transparent saved-trip budget breakdown. |
| GET | `/api/v1/hotels/providers` | No | Inspect hotel provider readiness and missing API-key requirements. |
| GET | `/api/v1/hotels/search` | No | Trusted hotel discovery through Geoapify or OpenStreetMap/Overpass; never returns fake prices. |
| GET | `/api/v1/hotels/offers` | No | Live Staying API hotel offers when enough provider mapping is supplied. |
| GET | `/api/v1/hotels/booking-link` | No | Validate an external hotel booking URL against the safe provider allow-list. |
| GET | `/api/v1/hotels/:id` | No | Trusted hotel details by provider-backed hotel ID. |
| GET | `/api/v1/scoring/trip-health/:id` | Yes | Calculate trip risk/health score for a saved trip. |
| POST | `/api/v1/scoring/tourism-impact` | No | Compare popular and responsible route impact metrics. |
| GET | `/api/v1/scoring/trip-trust/:id` | Yes | Aggregate itinerary fact trust into a trip-level score. |
| POST | `/api/v1/scoring/destination-ratings` | No | Rate destinations against traveller date, time, budget, accessibility, interests, pace, and transport inputs. |
| POST | `/api/v1/groups` | Yes | Create a persisted group planning session. |
| GET | `/api/v1/groups/:code` | No | Get group planning session status. |
| POST | `/api/v1/groups/:code/join` | No | Submit participant preferences for a group plan. |
| POST | `/api/v1/groups/:code/generate` | No | Generate an itinerary from blended group preferences. |
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
`foot-walking`. The response includes distance, duration, route geometry, and
`source`. If routing fails, the backend returns `FALLBACK_STRAIGHT_LINE`
geometry instead of failing the whole request.

### Hotels

Hotel discovery is live-provider backed. It uses Geoapify Places when
`GEOAPIFY_API_KEY` is configured, then OpenStreetMap/Overpass as a controlled
fallback. Hotel discovery never returns fabricated hotel prices or live
availability.

`GET /api/v1/hotels/providers`

Returns configured/implemented status for Geoapify, OpenStreetMap/Overpass,
Staying API, and Booking.com Demand API placeholders.

`GET /api/v1/hotels/search?destinationId=bhubaneswar-odisha&checkIn=2026-09-05&checkOut=2026-09-08`

Accepted query params:

- `destinationId`: destination UUID or slug; required unless `lat` and `lon`
  are provided
- `lat`, `lon`: optional coordinate search pair
- `radiusKm`: `0.1..50`, default `5`
- `checkIn`, `checkOut`: optional `YYYY-MM-DD` date range
- `adults`: `1..10`, default `2`
- `rooms`: `1..5`, default `1`
- `priceBand`: `BUDGET`, `MODERATE`, or `PREMIUM`
- `amenities`: optional comma-separated desired amenities
- `type`: `hotel`, `guest_house`, `hostel`, `motel`, or `apartment`
- `wheelchairAccessible`, `wifi`, `parking`: `true` or `false`
- `sort`: `DISTANCE`, `TRUST`, or `RECOMMENDED`
- `limit`: `1..50`, default `20`

When no discovery provider returns usable data, the response is still explicit:

```json
{
  "data": {
    "hotels": [],
    "unavailable": {
      "code": "HOTEL_DISCOVERY_TEMPORARILY_UNAVAILABLE",
      "message": "No hotel provider returned usable data for this request. Please try a different location or retry later.",
      "action": "RETRY_LATER"
    },
    "providerStatus": {}
  }
}
```

Successful hotel search responses include provider-backed hotel IDs. Use those
IDs with `GET /api/v1/hotels/:id`.

Example hotel item shape:

```json
{
  "id": "geoapify:51...",
  "provider": "GEOAPIFY",
  "providerHotelId": "51...",
  "name": "Hotel Pal Heights",
  "latitude": 20.2984865,
  "longitude": 85.8229954,
  "distanceKm": 0.31,
  "address": "Hotel Pal Heights, Bhubaneswar, Odisha, India",
  "categories": ["accommodation", "accommodation.hotel"],
  "amenities": ["wifi"],
  "phone": null,
  "website": null,
  "starRating": null,
  "wheelchairAccessible": null,
  "pricing": {
    "available": false,
    "message": "Discovery providers do not prove live room prices. Use /api/v1/hotels/offers after an offers provider is configured."
  },
  "trust": {
    "status": "SOURCE_BACKED",
    "confidence": 0.82,
    "warnings": ["Availability and price are not verified by discovery data."],
    "summary": {
      "label": "MEDIUM",
      "score": 0.73,
      "sourceTier": "PROVIDER_PLACE_DATA",
      "fieldCompleteness": 0.43,
      "freshness": {
        "status": "FRESH",
        "score": 1,
        "fetchedAt": "2026-09-02T10:00:00.000Z"
      },
      "evidenceCount": 4,
      "missingFields": ["phone", "website", "starRating", "wheelchairAccessible"]
    }
  }
}
```

`GET /api/v1/hotels/offers?hotelId=staying:booking:hotel-123&checkIn=2026-09-05&checkOut=2026-09-08`

Uses the Staying API when `STAYING_API_KEY` is configured. Supported offer
lookups:

- Direct listing price: `hotelId=staying:<platform>:<listingId>` or
  `platform` + `providerHotelId`
- Price compare: `name` and/or `location`, or `googleHotelId`

If the frontend sends only a Geoapify/OSM discovery ID, the backend returns
`HOTEL_OFFERS_MAPPING_REQUIRED` instead of guessing prices.

Offer responses include total/nightly amounts, taxes/fees when supplied,
nights, rooms, adults, source attribution, and a sanitized booking URL when the
provider URL is on the safe allow-list.

`GET /api/v1/hotels/booking-link?url=https://www.booking.com/hotel/in/example.html`

Returns `{ allowed: true, url }` only for HTTPS URLs from approved hotel
provider domains. It does not create or confirm bookings.

`GET /api/v1/hotels/:id`

Accepts provider-backed IDs returned by hotel search:

- `geoapify:<place_id>`: fetched from Geoapify Place Details when
  `GEOAPIFY_API_KEY` is configured
- `osm:node/<id>`, `osm:way/<id>`, `osm:relation/<id>`: fetched from
  OpenStreetMap/Overpass

Details responses remain source-backed and still do not prove live room price
or availability.

Unsupported IDs return `400 INVALID_HOTEL_ID`. Provider failures return
`502 HOTEL_DETAILS_PROVIDER_ERROR`. Missing Geoapify key for a Geoapify detail
lookup returns `503 HOTEL_DETAILS_NOT_CONFIGURED`.

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
- Saved generated trips persist the normalized planner input so later replans
  keep the original preferences.

### NLU

`POST /api/v1/nlu/extract`

```json
{
  "prompt": "A relaxed family trip with temples, history, and short walks."
}
```

`prompt` must be 5-1000 characters.

`POST /api/v1/nlu/extract-delta`

```json
{
  "query": "What if it rains tomorrow?"
}
```

Returns a structured what-if delta accepted by
`POST /api/v1/trips/:id/itinerary/replan`. Supported delta types are
`weather_change`, `time_reduced`, `crowd_increase`, and `budget_change`.

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

`POST /api/v1/nlu/voice-command`

```json
{
  "utterance": "MargDarshak, mujhe abhi nearby kuch peaceful jagah chahiye.",
  "locale": "hi-IN",
  "context": {
    "tripId": "00000000-0000-4000-8000-000000002001",
    "lat": 20.2961,
    "lon": 85.8245,
    "remainingMinutes": 120
  }
}
```

Returns a deterministic intent, `spokenText`, context used, and either results
or a next API action. Supported intents include nearby recommendations,
itinerary readout, emergency help, offline-pack download, and what-if replans.
Trip-specific voice commands require bearer auth and enforce trip ownership.

### Feedback

`POST /api/v1/feedback`

```json
{
  "entityId": "00000000-0000-4000-8000-000000003001",
  "entityType": "FACT",
  "feedbackType": "OUTDATED",
  "reportType": "HOURS_INCORRECT",
  "comment": "The opening time has changed."
}
```

Allowed values:

- `entityType`: `ATTRACTION`, `FACT`, `CROWD_RECORD`
- `feedbackType`: `INACCURATE`, `OUTDATED`, `OTHER`
- `reportType`: optional structured report category: `CLOSED`, `PRICE_CHANGED`, `ACCESSIBILITY_INCORRECT`, `HOURS_INCORRECT`, `ROAD_BLOCKED`, `OVERCROWDED`, `FACILITY_UNAVAILABLE`, `OTHER`

Feedback is stored with `PENDING` status and its `reportType` for manual review.
Submitting feedback does not automatically downgrade or rewrite trusted facts.

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
    "plannerInput": {},
    "itineraryItems": []
  }
}
```

If `plannerInput` is present either beside `itinerarySnapshot` or inside it,
the backend stores it for later replans.

`GET /api/v1/trips/:id/export`

Returns `application/pdf` for the current user's saved `itinerarySnapshot`.

`GET /api/v1/trips/:id/offline-pack`

Returns a JSON offline survival pack for the current user's saved
`itinerarySnapshot`, including itinerary stops, trusted fact summaries,
destination coordinates, emergency contacts, personal emergency contact,
selected hotel snapshot, route-segment geometry hints, language phrases,
warnings, alternatives, and last verified timestamps.

`GET /api/v1/trips/:id/hotel`

Returns the selected hotel snapshot saved on the trip, or `null`.

`PUT /api/v1/trips/:id/hotel`

```json
{
  "hotel": {
    "id": "staying:booking:hotel-123",
    "provider": "STAYING",
    "providerHotelId": "hotel-123",
    "name": "Hotel Utkal",
    "latitude": 20.297,
    "longitude": 85.825,
    "pricing": { "available": true, "totalAmount": 3600, "currency": "INR" }
  },
  "offer": {
    "totalAmount": 3600,
    "currency": "INR",
    "bookingUrl": "https://www.booking.com/hotel/in/utkal.html"
  }
}
```

Saves/replaces `itinerarySnapshot.selectedHotel`. No fake price is created.

`DELETE /api/v1/trips/:id/hotel`

Removes `itinerarySnapshot.selectedHotel`.

`GET /api/v1/trips/:id/hotels/recommendations`

Runs hotel discovery around the trip destination and ranks results by distance
from itinerary stops, hotel trust, accessibility context, and budget context.

`GET /api/v1/trips/share/:token/export`

Returns the same PDF export for public shared trips. Export responses never
include owner IDs, owner email, or share tokens inside the document.

`POST /api/v1/trips/:id/itinerary/replan`

```json
{
  "delta": {
    "type": "weather_change",
    "payload": {
      "condition": "rain",
      "affectedDays": [1]
    }
  }
}
```

Supported delta types:

- `weather_change`: `condition` is `rain`, `extreme_heat`, or `storm`; optional
  `affectedDays` limits indoor substitutions to specific trip days.
- `time_reduced`: accepts `newDayEnd` as `HH:MM` or `reduceDays`.
- `crowd_increase`: accepts `strictFilter`.
- `budget_change`: accepts `maxBudgetPerPerson` as an absolute per-person
  ceiling, or `decreaseByPerPerson` to reduce the current itinerary budget.

Replanning uses the persisted planner input from generated trips. Old/manual
trips without planner memory fall back to moderate pace, mixed transport, and
no accessibility/interests constraints.
Each successful replan updates the trip snapshot and stores a new itinerary
version.

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

`GET /api/v1/budget/trips/:id/breakdown?travellerType=INDIAN&travellers=2`

Returns a transparent saved-trip estimate broken into transportation, entry
tickets, accommodation when a selected hotel exists, food, local experiences,
and buffer. Entry tickets come from verified/live `ticket_price` facts frozen in
the trip snapshot. Accommodation uses only saved selected-hotel offer/pricing;
if no live/saved price exists, it is shown as unavailable instead of guessed.
The response also includes a ready `budgetReductionAction` for the existing
what-if replan route.

### Attraction Suitability

`GET /api/v1/attractions/konark-sun-temple/suitability?time=14:00&accessibilityWheelchair=true&walkingToleranceMinutes=30`

- `time`: required `HH:MM`.
- `date`: optional ISO date-time; when present, forecast weather is checked for that day.
- `accessibilityWheelchair`, `accessibilityVision`, `accessibilityHearing`,
  `accessibilityCognitive`: optional booleans.
- `walkingToleranceMinutes`: optional 5-240 minute tolerance.
- `weatherCondition` and `maxTempC`: optional explicit weather override for
  deterministic simulations/tests.

Returns `recommended`, deterministic reasons including "why not" constraints,
weather metadata, and suitable alternatives when the place is not recommended.

### Scoring

`GET /api/v1/scoring/trip-health/:id`

Requires auth. Computes weather, crowd, transport/routing,
closure/sensitivity, accessibility, emergency-readiness, and data-quality
sub-scores for the current user's saved trip. The response includes
`mitigation.riskCrossed`, `mitigation.shouldReplan`, and deterministic action
objects; weather, crowd, and transport actions include a ready
`POST /api/v1/trips/:id/itinerary/replan` delta.

`POST /api/v1/scoring/tourism-impact`

```json
{
  "destinationId": "bhubaneswar-odisha",
  "startDate": "2026-09-03T09:00:00.000Z",
  "days": 2,
  "preferences": {
    "pace": "MODERATE",
    "accessibilityWheelchair": false,
    "accessibilityVision": false,
    "accessibilityHearing": false,
    "accessibilityCognitive": false,
    "interests": ["Heritage"],
    "transportPreference": "MIXED"
  }
}
```

Returns popular and responsible route plans with crowd pressure, local-business
exposure, travel-distance, environmental sensitivity, cultural sensitivity, and
overall impact-score metrics.

`POST /api/v1/scoring/destination-ratings`

```json
{
  "destinationIds": ["bhubaneswar-odisha", "jaipur-rajasthan"],
  "startDate": "2026-09-05T09:00:00.000Z",
  "preferredTime": "09:00",
  "days": 3,
  "pace": "MODERATE",
  "budgetBand": "BUDGET",
  "accessibilityWheelchair": true,
  "interests": ["Museums & Culture"],
  "transportPreference": "MIXED"
}
```

Returns sorted destination fit ratings computed from stored attraction data,
verified/live ticket facts, accessibility fields, selected interests, seasonal
travel date, preferred start time, trip duration, pace, budget band, and
transport preference. Auth is not required.

Example response:

```json
{
  "data": {
    "ratings": [
      {
        "destinationId": "bhubaneswar-odisha",
        "destinationName": "Bhubaneswar",
        "score": 86,
        "label": "Excellent Fit",
        "summary": "3/8 stops support wheelchair access",
        "topReasons": [
          "3/8 stops support wheelchair access",
          "5/8 attractions match selected interests",
          "8/8 stops fit budget ticket assumptions"
        ],
        "breakdown": [
          {
            "category": "accessibility",
            "score": 38,
            "weight": 25,
            "reasons": ["3/8 stops support wheelchair access"]
          }
        ],
        "computedAt": "2026-09-02T14:15:00.000Z"
      }
    ],
    "computedAt": "2026-09-02T14:15:00.000Z"
  }
}
```

If `destinationIds` is omitted, all destinations are rated. Legacy frontend
destination slugs are accepted. Invalid dates, times, budget bands, pace, or
transport values return `400 VALIDATION_ERROR`.

`GET /api/v1/scoring/trip-trust/:id`

Requires auth. Aggregates fact verification status, freshness, and unresolved
conflicts into a trip-level trust score.

### Groups

`POST /api/v1/groups`

```json
{
  "destinationId": "bhubaneswar-odisha",
  "startDate": "2026-09-03T09:00:00.000Z",
  "days": 2,
  "title": "Family Trip"
}
```

Creates a persisted group planning session and returns a join code.

`POST /api/v1/groups/:code/join`

```json
{
  "name": "Asha",
  "preferences": {
    "pace": "RELAXED",
    "accessibilityWheelchair": false,
    "accessibilityVision": false,
    "accessibilityHearing": false,
    "accessibilityCognitive": false,
    "interests": ["Heritage", "Local Food & Markets"],
    "transportPreference": "MIXED",
    "walkingToleranceMinutes": 30
  }
}
```

`GET /api/v1/groups/:code`

Returns group status and submitted participant summaries.

`POST /api/v1/groups/:code/generate`

Generates an itinerary from persisted participant preferences.

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
