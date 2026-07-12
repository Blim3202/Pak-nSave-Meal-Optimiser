# NZ Meal Cost Optimizer - App Documentation

## 1. Overview
The **NZ Meal Cost Optimizer** is an AI-powered web application for the New Zealand consumer market. It breaks down meals into raw ingredients, searches real Pak'nSave product catalogs across 60+ stores, and finds the cheapest combination of purchases using smart portion-cost matching.

## 2. Core AI Agents
Three Gemini-powered agents drive the application:

### A. Dish Ingredient Generator
Converts a meal name (preset or custom) into 4–8 core raw ingredients with NZ retail portion sizes.
- **Model**: `gemini-3.1-flash-lite` with structured JSON output (schema-validated)
- **Fallback**: 20+ preset recipes in `src/data/dishes.ts` when Gemini is unavailable
- **Portion Scaling**: Quantities dynamically scale from 4-serving base to user-specified servings

### B. Supermarket NLP Profiler
Creates semantic search profiles per ingredient to filter out irrelevant products from the Pak'nSave API.
- **Positive/Negative Keywords**: Gemini generates include/exclude keyword lists for each ingredient
- **Synonym Handling**: Maps alternate names (e.g., "ground beef" for "beef mince")
- **Custom Rules**: User-defined include/exclude rules are injected into the LLM prompt

### C. Recipe Generator & Chat Assistant
Two post-optimization features:
- **Recipe Guide** (`/api/generate-recipe`): Generates step-by-step cooking instructions with timing and safety warnings
- **Culinary Chat** (`/api/chat`): Conversational Q&A about leftovers, storage, and ingredient swaps

## 3. Technical Flow
1. **Location Input** — Address or GPS coordinates → geocoded to lat/lon
2. **Dish Selection** — Preset or custom dish → ingredient list via Gemini or local cache
3. **Portion Scaling** — Ingredients scaled to user-specified servings
4. **Store Proximity** — 60 Pak'nSave stores filtered by Haversine distance within user's radius (top 3)
5. **Product Search** — Real Pak'nSave mobile API queried per ingredient per store
6. **NLP Filtering** — Gemini-generated keyword profiles applied via `nlpFilterProducts()`
7. **Cost Optimization** — Portion-cost calculation finds cheapest per-ingredient and per-store totals
8. **Reporting** — Comparison matrix, shopping checklist, store map, and AI-generated markdown report

## 4. Technical Stack
| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, Vite 6 |
| Backend | Express 4, tsx (dev runner) |
| AI | Google Gemini API (`@google/genai`) — model `gemini-3.1-flash-lite` |
| Maps | Leaflet + react-leaflet (OpenStreetMap tiles) |
| Icons | lucide-react |
| Data | Static JSON stores (60 stores, 20+ recipes) |

## 5. API Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/geocode?address=...` | Geocode address to lat/lon (Nominatim + known-location cache) |
| POST | `/api/dish-ingredients` | Break down dish into raw ingredients with portion sizes |
| POST | `/api/optimize` | Full price optimization pipeline (NDJSON stream) |
| POST | `/api/generate-recipe` | Generate step-by-step cooking instructions |
| POST | `/api/chat` | Conversational cooking & leftovers assistant |
