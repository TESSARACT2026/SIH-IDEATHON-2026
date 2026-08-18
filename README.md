<div align="center">
  
# 🛡️ MargDarshak
**Multilingual Trustworthy Travel Assistant**

*Built for the **Smart India Hackathon (SIH) 2026***

[![React](https://img.shields.io/badge/React-18-blue.svg?style=for-the-badge&logo=react)](https://reactjs.org/)
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
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Vanilla CSS (Glassmorphism design system)
- **i18n**: `react-i18next` for seamless language switching (en, hi, or)

### Backend
- **Framework**: Node.js + Express
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL + PostGIS for spatial queries)
- **Validation**: Zod (Runtime type safety & environment validation)
- **AI/LLM**: Google Gemini (via `@google/genai`)
- **Live APIs**: OpenRouteService (Travel matrices), Open-Meteo (Weather)

---

## 🚀 Running Locally

### Prerequisites
- Node.js (v24+)
- Supabase account & project

### 1. Database Setup
Run the SQL migrations located in `backend/prisma/schema.prisma` against your Supabase project to setup the geospatial database.

### 2. Environment Variables
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
GEMINI_API_KEY=your_gemini_api_key
ORS_API_KEY=your_openrouteservice_key
```

### 3. Start the Backend
```bash
cd backend
npm install
npm run dev
```
*(The backend will run on http://localhost:3001)*

### 4. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
*(The frontend will run on http://localhost:5173)*

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

---
<div align="center">
  <b>Developed for Smart India Hackathon (SIH) 2026</b>
</div>
