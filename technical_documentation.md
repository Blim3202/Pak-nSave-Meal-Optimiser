# NZ Meal Cost Optimizer - Technical Deep Dive

## 1. Architectural Overview
The **NZ Meal Cost Optimizer** is a full-stack, reactive web application utilizing a **React-on-Vite frontend** and a **Node.js/Express backend**. The frontend manages user state and visualization, while the backend handles product matching, NLP processing, cost optimization, and Gemini AI integration.

### API Routes
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/geocode` | Geocode address to lat/lon (Nominatim + known-location cache) |
| `POST` | `/api/dish-ingredients` | Break down dish into raw ingredients via Gemini or preset cache |
| `POST` | `/api/optimize` | Full optimization pipeline — streams NDJSON logs + result |
| `POST` | `/api/generate-recipe` | Generate step-by-step cooking instructions via Gemini |
| `POST` | `/api/chat` | Conversational Q&A about leftovers, swaps, and cooking tips |

## 2. LLM Integration Points
The application uses the **Google Gemini API** (via `@google/genai`, model `gemini-3.1-flash-lite`) at four stages:

1.  **Dish Breakdown (`/api/dish-ingredients`)**:
    - Decomposes recipe names into structured raw ingredient lists (4–8 items)
    - Uses `responseMimeType: "application/json"` with a strict JSON schema for reliable parsing
    - Falls back to 20+ preset recipes in `src/data/dishes.ts` when Gemini is unavailable

2.  **NLP Profiler (`/api/optimize` — Semantic Analysis)**:
    - Generates per-ingredient semantic profiles: `expected_category`, `positive_keywords`, `negative_keywords`, `allowed_synonyms`
    - User-defined include/exclude rules are injected into the LLM prompt
    - Profiles are cached in `nlpProfileCache` to avoid redundant LLM calls

3.  **Optimizer Reporting (`/api/optimize` — Analytical Synthesis)**:
    - Translates numerical optimization results into a human-friendly markdown report
    - Uses `systemInstruction` config for consistent tone and formatting
    - Cached in `aiReportCache` keyed by dish/servings/cheapest-store hash

4.  **Recipe Generation (`/api/generate-recipe`)**:
    - Uses structured JSON schema output for reliable step parsing
    - Includes explicit safety warnings and measurement disclaimers in system prompt

5.  **Culinary Chat (`/api/chat`)**:
    - Conversational context maintained via `contents` array with formatted history
    - System instruction includes the user's specific shopping results for personalized advice
    - Target: under 150 words per response

## 3. The AI Matching Pipeline & NLP Filtering
The core filtering function is `nlpFilterProducts()` in `server.ts`.

### Matching Mechanism
1.  **Search API**: Queries the real Pak'nSave mobile API per store + ingredient combination (uses guest auth token with 45-min cache).
2.  **Filtering (`nlpFilterProducts`)**:
    - **Custom Rule Injection**: User-defined include/exclude rules applied first (highest priority)
    - **Negative Keyword Pruning**: Products containing Gemini-generated `negative_keywords` are removed unless the ingredient itself contains that term
    - **Positive Keyword Verification**: Remaining products are validated against `positive_keywords` or `allowed_synonyms`
    - **Core Noun Check**: Ensures the primary ingredient noun appears in the product name (with plural/singular handling)
3.  **Portion Cost Calculation** (`calculatePortionDetails`):
    - Compares required quantity vs product unit size to compute `packs_needed`, `purchase_cost`, and `portion_cost`
    - Normalizes units (g, ml, count) for cross-product comparison

## 4. Performance & Reliability Features

- **Aggressive Caching**:
    - **`productSearchCache`**: Caches Pak'nSave API responses per store/ingredient (20 results)
    - **`nlpProfileCache`**: Prevents repetitive Gemini NLP profiling calls
    - **`dishBreakdownCache`**: Caches recipe parsing results per dish+servings key
    - **`aiReportCache`**: Caches synthesized optimization reports
    - **`recipeCache`**: Caches generated recipe guides per dish+servings+ingredients key
- **Resilience**:
    - Pak'nSave API uses guest auth tokens with automatic refresh; failures return empty arrays (no fake data)
    - Hardcoded known coordinates for instantaneous geocoding of major NZ locations
    - Gemini failures fall back to local recipe presets and heuristic-based NLP matching
- **Optimization Logic**:
    - **Haversine Distance**: Calculates distance from user to all 60 stores; filters to top 3 within radius
    - **Portion-Cost Matching**: Ranks products by `portion_cost` (exact used amount) rather than pack price
    - **Multi-Store Optimization**: Finds cheapest per-ingredient across all stores for an optimal mix-and-match strategy
