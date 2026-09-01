<div align="center">
  
# 🛡️ MargDarshak
**Multilingual Trustworthy Travel Assistant**

*Built for the **Smart India Hackathon (SIH) 2026***

[![React](https://img.shields.io/badge/React-19-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-24+-green.svg?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E.svg?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![Gemini API](https://img.shields.io/badge/Gemini-AI-orange.svg?style=for-the-badge&logo=google)](https://ai.google.dev/)

</div>

---

## 📖 Product Summary

**MargDarshak** is a next-generation travel planning assistant that users can trust the way they'd trust a knowledgeable, honest local friend — not a generic chatbot. 

It solves a critical problem with modern Generative AI: **hallucinations**. Instead of relying on an LLM to guess opening hours, travel distances, or ticket prices, MargDarshak uses a **Deterministic Planner Engine** coupled with a **Trust Validation Gate**. Every single fact presented to the user is 100% verified, traceable, and personalized to their accessibility and language needs.

The AI must never fabricate critical travel information. If it cannot be verified, it is marked as uncertain or omitted.

---

## ✨ Key Features

- 🛑 **Zero-Hallucination Architecture**: The LLM is strictly constrained to a read-only, narrative role. It is explicitly forbidden from inventing facts.
- 🛡️ **Trust Badges & Provenance**: Every itinerary item is tagged with a dynamic Trust Badge (🟢 **VERIFIED**, 🟡 **COMMUNITY**, ⚠️ **DISPUTED**). You always know *why* a place is recommended and *where* the data comes from.
- 🗺️ **Geospatial Deterministic Routing**: Uses PostGIS and OpenRouteService to calculate real-world travel times, distances, and capacity constraints before generating an itinerary.
- ♿ **Accessibility-First Design**: Accessibility constraints (wheelchair, walking-limited, etc.) materially change itinerary composition and routing. 
- 🌱 **Sustainability & Local Support**: Overcrowded or environmentally/culturally sensitive sites are proactively deprioritized with honest alternatives. Locally-owned businesses are highlighted when evidence-backed.
- 🌍 **Multilingual Support**: Fully localized in **English, Hindi, and Odia** without losing any trust signals or provenance in translation.
- 🎨 **Glassmorphism UI**: A beautiful, modern, and highly responsive user interface.

---

## 🏗️ Architecture: The Trust Validation Gate

1. **NLU Extraction**: The user provides a natural language prompt (e.g., *"I want a relaxed history trip"*). The system extracts rigid preferences (*Pace: RELAXED, Accessibility: true*).
2. **Deterministic Planner**: The backend engine strictly queries PostGIS for candidates matching the preferences, filters them by capacity constraints, and assigns scheduled slots using real-world travel times.
3. **LLM Narration**: A narrative summary is generated, but the LLM is **forced** to append citation IDs `[fact:123]`.
4. **Validation Gate**: The backend intercepts the LLM output, strips any hallucinated claims that lack a valid ID, and passes the clean, 100% verified payload to the frontend.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19 + Vite
- **Language**: TypeScript
- **Styling**: Vanilla CSS (Glassmorphism design system)
- **i18n**: `react-i18next` for seamless language switching (en, hi, or)
- **API Client**: Axios + Vite proxy to `/api/v1`

### Backend
- **Framework**: Node.js + Express
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL + PostGIS for spatial queries)
- **Validation**: Zod (Runtime type safety & environment validation)
- **AI/LLM**: Google Gemini (via `@google/genai`)
- **Live APIs**: OpenRouteService (Travel matrices), Open-Meteo (Weather)
- **Testing**: Vitest + Supertest E2E API flow tests

---

## 🚀 Running Locally

### Prerequisites
- Node.js (v24+)
- Supabase account & project
- Google Gemini API key
- OpenRouteService API key

### 1. Install Dependencies
```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2. Database Setup
Prisma owns the backend schema.

```bash
cd backend
npm run db:generate
npm run db:push
npm run db:seed
```

### 3. Environment Variables
Keep backend secrets in `backend/.env`. The backend config also attempts to read a root `.env`, but `backend/.env` is the cleanest local setup.

```bash
cp .env.example backend/.env
```

Backend `backend/.env`:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
DATABASE_URL=your_supabase_postgres_connection_string
GEMINI_API_KEY=your_gemini_api_key
ROUTING_API_KEY=your_openrouteservice_key
JWT_SECRET=your_jwt_secret
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY_DAYS=7
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
PORT=3001
```

Frontend public config belongs in `frontend/.env` or `frontend/.env.local`. Only use `VITE_` variables in frontend env files.

```env
VITE_API_BASE_URL=/api/v1
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
```

Do not put `DATABASE_URL`, `GEMINI_API_KEY`, `JWT_SECRET`, or Google OAuth secrets in frontend env files.

### 4. Google Auth Setup
In Google Cloud Console, create an OAuth client:
- Application type: `Web application`
- Authorized JavaScript origins:
  - `http://localhost:5173`
  - your production frontend origin
- Authorized redirect URI:
  - your Supabase callback URL from Supabase Dashboard → Authentication → Providers → Google

In Supabase Dashboard → Authentication → Providers → Google:
- Enable Google
- Paste the Google OAuth Client ID
- Paste the Google OAuth Client Secret

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `http://localhost:5173`
- Redirect URLs:
  - `http://localhost:5173/dashboard`
  - your production dashboard URL

### 5. Start the Backend
```bash
cd backend
npm run dev
```
*(The backend will run on http://localhost:3001)*

### 6. Start the Frontend
```bash
cd frontend
npm run dev
```
*(The frontend will run on http://localhost:5173)*

The Vite dev server proxies `/api` to `http://localhost:3001`, so frontend calls to `/api/v1/...` reach the backend without CORS headaches.

---

## 🧪 Testing

### Backend E2E API Flow
The backend includes a Vitest + Supertest flow test at:

```text
backend/tests/api-flow.test.ts
```

It checks protected route rejection, invalid UUID validation, cookie auth, and the saved-trip lifecycle: create, read by UUID, publish/share, update, delete, and verify not found.

Run it with the backend already started:

```bash
cd backend
npm run dev
```

In another terminal:

```bash
cd backend
API_TEST_BASE_URL=http://localhost:3001 API_TEST_BEARER_TOKEN=your_supabase_access_token npm test
```

If `API_TEST_BEARER_TOKEN` is omitted, auth-dependent tests are skipped and only unauthenticated checks run.

### Frontend Build Check
```bash
cd frontend
npm run build
```

---

## 🔌 API & Docs

- Health check: `GET http://localhost:3001/api/health`
- Swagger UI: `http://localhost:3001/api/docs`
- OpenAPI JSON: `http://localhost:3001/api/openapi.json`
- API base path: `/api/v1`

Protected routes accept either:
- `Authorization: Bearer <supabase_access_token>`
- `access_token=<supabase_access_token>` cookie

Main backend route groups:

```text
/api/v1/users
/api/v1/knowledge
/api/v1/attractions
/api/v1/live
/api/v1/planner
/api/v1/nlu
/api/v1/feedback
/api/v1/favorites
/api/v1/trips
/api/v1/services
/api/v1/analytics
/api/v1/search
/api/v1/nearby
/api/v1/local-businesses
/api/v1/crowd
/api/v1/emergency
/api/v1/guide
/api/v1/budget
```

Frontend API wrappers live in:

```text
frontend/src/api/client.ts
frontend/src/api/services/
```

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

---
<div align="center">
  <b>Developed for Smart India Hackathon (SIH) 2026</b>
</div>
