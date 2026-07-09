# Pak'nSave Meal Optimizer - Technical Deep Dive

## 1. Architectural Overview
The **Pak'nSave Meal Optimizer** is a full-stack, reactive web application utilizing a **React-on-Vite frontend** and a **Node.js/Express backend**. The frontend serves primarily as an orchestrator, managing user state and visualization, while the backend functions as an intelligent computational engine for product matching, NLP processing, and optimization.

## 2. LLM Integration Points
The application uses the **Google Gemini API** (via `@google/genai`) to provide intelligent analysis at three key stages in the request lifecycle:

1.  **Dish Breakdown (`/api/dish-ingredients`)**:
    *   **Goal**: Decompose complex recipe names into structured raw ingredient lists.
    *   **Implementation**: A system prompt instructs Gemini to output raw ingredients (4-8 items), scaled for a specific serving size, mapped to NZ retail units. The response is strictly validated against a JSON schema to ensure parsing reliability.

2.  **NLP Profiler (`/api/optimize` - Semantic Analysis)**:
    *   **Goal**: Prevent "search index pollution" (e.g., matching "onion" with "onion rings").
    *   **Implementation**: Ingredients and user-defined constraints are sent to Gemini. The LLM generates a semantic profile containing `expected_category`, `positive_keywords`, `negative_keywords`, and `allowed_synonyms` for each item, which are then used by the backend to filter real-time supermarket data.

3.  **Optimizer Reporting (`/api/optimize` - Analytical Synthesis)**:
    *   **Goal**: Translate dry numerical data (prices, savings, item matches) into a human-friendly markdown report.
    *   **Implementation**: The backend sends the optimization summary JSON to Gemini, requesting a concise, professional culinary analysis.

4.  **Culinary Chat Assistant (`/api/chat`)**:
    *   **Goal**: Provides post-purchase guidance.
    *   **Implementation**: Maintains conversational context with the user, augmented by the specific results of their shopping optimization, enabling personalized storage and recipe-reuse tips.

## 3. The AI Matching Pipeline & NLP Filtering
The core of the "Match Tuner" is the `nlpFilterProducts` function in the backend.

### Matching Mechanism
1.  **Search API**: The backend queries the real Pak'nSave mobile API for a given ingredient.
2.  **Filtering (`nlpFilterProducts`)**:
    *   **Tokenization**: The product name is broken down into tokens, removing stop words.
    *   **Custom Rule Injection**: User-provided tuning (e.g., "Must include: organic") is applied first.
    *   **Negative Keyword Pruning**: Products containing words in the Gemini-generated `negative_keywords` list (e.g., "wrap", "chips", "pet") are removed **unless** the ingredient name explicitly contains that term (e.g., a "beef dog food" product is removed for "beef mince", but a "wrap" product is *not* removed if the user searched for "tortilla wrap").
    *   **Positive Keyword Verification**: Remaining products are validated against `positive_keywords` or `allowed_synonyms`. If a product fails this check, it is excluded.

## 4. Performance & Reliability Features
To ensure the application remains fast and respects API rate limits:

- **Aggressive Caching**:
    - **Product Catalog Cache (`productSearchCache`)**: Stores supermarket search results per store/ingredient combination in memory.
    - **NLP Profile Cache (`nlpProfileCache`)**: Prevents repetitive LLM calls for the same ingredient set.
    - **Dish Breakdown Cache (`dishBreakdownCache`)**: Caches recipe parsing results.
    - **Optimizer Report Cache (`aiReportCache`)**: Caches synthesized LLM reports.
- **Resilience**: 
    - The system includes a high-fidelity "mock generator" (`generateRealisticNZProducts`) that simulates realistic supermarket inventory if the Pak'nSave API is unreachable or rate-limited.
    - Known locations are hardcoded for instantaneous geocoding responses.
- **Optimization Logic**:
    - **Haversine Distance**: Calculates accurate distance between the user and nearby stores, filtering results to the closest 3 locations to optimize processing time.
    - **Portion-Cost Matching**: The backend calculates `purchase_cost` (total price of needed packs) and `portion_cost` (price of the exact quantity needed for the dish) to ensure the optimizer ranks items based on actual value, not just ticket price.
