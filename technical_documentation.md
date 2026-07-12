# NZ Meal Cost Optimizer - Technical Deep Dive

## 1. Architectural Design & Runtime Environment

The **NZ Meal Cost Optimizer** is built as a cohesive full-stack application running in a single container environment. It integrates a **React 19 Single Page Application (SPA)** with an **Express 4.x Backend Server** compiled for Node.js.

```
+---------------------------------------------------------------------------------------+
|                                    RUNTIME CONTAINER                                  |
|                                                                                       |
|   +--------------------------+                      +-----------------------------+   |
|   |   CLIENT-SIDE BROWSER    |                      |       EXPRESS BACKEND       |   |
|   |                          |                      |         (PORT 3000)         |   |
|   |  +--------------------+  |                      |  +-----------------------+  |   |
|   |  |     React UI       |  |                      |  |     API Router        |  |   |
|   |  |   (Leaflet Map)    |  |                      |  |   (REST & NDJSON)     |  |   |
|   |  +---------+----------+  |                      |  +-----------+-----------+  |   |
|   |            |             |                      |              |              |   |
|   |            | HTTP / POST |                      |              |              |   |
|   |            v             |                      |              v              |   |
|   |  +---------+----------+  |                      |  +-----------+-----------+  |   |
|   |  |  Local Recalculate |  |                      |  |   Portion Cost Calc   |  |   |
|   |  |    (State Sync)    |  |                      |  |     & Optimizers      |  |   |
|   |  +--------------------+  |                      |  +-----------+-----------+  |   |
|   |                          |                      |              |              |   |
|   +--------------------------+                      +--------------+--------------+   |
|                                                                    |                  |
|                                                     +--------------+--------------+   |
|                                                     |   Google Gemini API         |   |
|                                                     |   Pak'nSave Mobile API      |   |
|                                                     +-----------------------------+   |
+---------------------------------------------------------------------------------------+
```

### Full-Stack Build Integration
The dev environment and production build system are optimized for instant compilation and low cold-start latency:
- **Development**: The application boots using `tsx` (TypeScript Execute) to run `server.ts` directly. The backend serves the Express REST APIs and mounts Vite's dev server middleware (`createViteServer`) in development mode to handle hot-reloading client-side assets on Port 3000.
- **Production Build**: 
  1. The client assets are compiled using `vite build`, writing static production bundles into the `/dist` folder.
  2. The server-side code is bundled into a single self-contained CommonJS file (`dist/server.cjs`) using `esbuild` with the `--packages=external` flag. This bundler compiles all backend modules while keeping third-party Node packages external, completely bypassing relative import issues at runtime.
  3. The production container launches the app using `node dist/server.cjs`, serving the static React bundles and proxying API calls.

### Low-Latency NDJSON Streaming
The core `/api/optimize` endpoint uses **NDJSON (Newline Delimited JSON)** streaming. This allows the server to send step-by-step progress logs to the frontend as they happen (e.g., geocoding results, NLP profile generation, individual store scanning) and stream the final optimization payload at the end of the connection. The frontend reads this stream using the `ReadableStream` reader interface, updating the active terminal logs line-by-line without blocking the browser thread.

---

## 2. API Endpoints Deep Dive

The backend exposes 7 REST API routes:

### 1. `GET /api/geocode`
Converts a user-supplied address into precise coordinates.
- **Parameters**: `address` (string)
- **Mechanism**: Calls the Nominatim OpenStreetMap API. To ensure reliability and speed, it contains an in-memory cache of major New Zealand metropolitan centers (Auckland, Hamilton, Tauranga, Wellington, Christchurch, Dunedin).
- **Sample Request**: `/api/geocode?address=Auckland+Central`
- **Sample Response**:
  ```json
  {
    "lat": -36.84846,
    "lon": 174.76333,
    "display_name": "Auckland Central, Auckland, New Zealand"
  }
  ```

### 2. `POST /api/dish-ingredients`
Decomposes a custom dish name into raw ingredients.
- **Payload**: `{ "dish": "Spaghetti Bolognese", "servings": 4 }`
- **Mechanism**: Calls the Gemini API with a strict JSON schema requiring individual portion sizes. If the LLM call fails or is unavailable, the system pulls from a library of 20+ preset dishes in `src/data/dishes.ts` as a reliable fallback.
- **Sample Response**:
  ```json
  [
    { "name": "beef mince", "qty": "500g" },
    { "name": "canned tomatoes", "qty": "400g" },
    { "name": "spaghetti", "qty": "400g" },
    { "name": "onion", "qty": "1 unit" },
    { "name": "garlic", "qty": "2 cloves" }
  ]
  ```

### 3. `POST /api/optimize` (NDJSON Stream)
Runs the core grocery pricing and portion-matching engine.
- **Payload**:
  ```json
  {
    "address": "Auckland Central",
    "lat": -36.84846,
    "lon": 174.76333,
    "dish": "Spaghetti Bolognese",
    "radius": 10,
    "servings": 4,
    "ingredients": ["beef mince", "onion"],
    "quantities": { "beef mince": "500g", "onion": "1 unit" },
    "customRules": {}
  }
  ```
- **Stream Output**:
  ```json
  {"type": "log", "message": "[03:43:02] Geocoded address: Auckland Central"}
  {"type": "log", "message": "[03:43:03] Scanning inventory at Pak'nSave Mount Albert..."}
  {"type": "result", "data": { "nearbyStores": [...], "allFoundProducts": {...}, "optimizedMixStore": {...} }}
  ```

### 4. `POST /api/evaluate-custom-instruction`
Evaluates custom instructions on unique products individually.
- **Payload**:
  ```json
  {
    "ingredient": "beef mince",
    "customInstruction": "only select grass-fed pasture beef under $15",
    "products": [
      { "name": "Pams Beef Mince Regular 500g", "brand": "Pams", "units": "500g", "price": 10.99 },
      { "name": "Angus Grass Fed Prime Beef Mince 500g", "brand": "Angus Pure", "units": "500g", "price": 14.50 }
    ]
  }
  ```
- **Response**:
  ```json
  {
    "Pams Beef Mince Regular 500g": false,
    "Angus Grass Fed Prime Beef Mince 500g": true
  }
  ```

### 5. `POST /api/nlp-profile`
Generates semantic search profile keywords for an individual ingredient to support live tuning.
- **Payload**: `{ "dish": "Spaghetti", "ingredient": "garlic", "quantity": "3 cloves" }`
- **Response**:
  ```json
  {
    "expected_category": "Fresh Produce",
    "positive_keywords": ["garlic", "garlics"],
    "negative_keywords": ["bread", "salt", "sauce", "aioli", "crushed"],
    "allowed_synonyms": ["loose garlic", "fresh garlic"]
  }
  ```

### 6. `POST /api/generate-recipe`
Generates step-by-step cooking steps customized to the matched product types.
- **Payload**: `{ "dish": "Butter Chicken", "ingredients": ["chicken thigh", "cream"], "servings": 4 }`
- **Response**: A JSON list of recipe steps with custom durations, titles, safety markers, and allergen alerts.

### 7. `POST /api/chat`
Conversational portal for cooking questions, leftovers tips, and recipe swaps.
- **Payload**: `{ "message": "What can I make with my leftover tomato paste?", "history": [], "results": {} }`
- **Response**: A highly concise, targeted chat response (under 150 words).

---

## 3. The Portion-Cost Optimization Algorithm

The core value proposition of the system lies in its mathematical model for calculating portion costs:

```
                            +--------------------------+
                            |  1. Parse Required Qty   |
                            |   e.g., "500g" -> 500g   |
                            +------------+-------------+
                                         |
                                         v
                            +--------------------------+
                            |  2. Parse Product Size   |
                            |   e.g., "1kg" -> 1000g   |
                            +------------+-------------+
                                         |
                                         v
                            +--------------------------+
                            | 3. Compute Packs Needed  |
                            | Math.ceil(500 / 1000)=1  |
                            +------------+-------------+
                                         |
                                         v
                            +--------------------------+
                            |  4. Compute Ratio Used   |
                            |  500 / (1000 * 1) = 0.5  |
                            +------------+-------------+
                                         |
                                         v
                            +--------------------------+
                            |  5. Compute Portion Cost |
                            |  $15.00 * 0.5 = $7.50    |
                            +--------------------------+
```

### A. Unit Parsing and Normalization Mechanics
The program implements two main parsers, `parseQuantity` and `parseProductUnit`, which standardize text units (such as grams, kilograms, milliliters, liters, or discrete item counts) into comparable numeric values:
- **Mass Normalization**: Everything is standardized to **grams (g)**. "1.5kg" is converted to `1500`, "500g" to `500`.
- **Volume Normalization**: Everything is standardized to **milliliters (ml)**. "2L" is converted to `2000`, "250ml" to `250`.
- **Count Normalization**: Everything is standardized to a **count (unit)**. "12pk eggs" becomes `12`, "6-pack" becomes `6`, and "1 unit" becomes `1`.

### B. Mathematical Formulas
For any required ingredient quantity $R$ (standardized to base unit $u$) and product package size $P$ (standardized to base unit $u$) with package cost $C_{pack}$:

1. **Packs Needed**:
   $$N_{packs} = \lceil \frac{R}{P} \rceil$$
   *(If units cannot be parsed or do not match, the system falls back to $N_{packs} = 1$)*

2. **Ratio Used**:
   $$R_{used} = \frac{R}{P \times N_{packs}}$$

3. **Total Purchase Cost (Paid at Checkout)**:
   $$Cost_{purchase} = C_{pack} \times N_{packs}$$

4. **Portion Cost (Culinary Consumed Value)**:
   $$Cost_{portion} = Cost_{purchase} \times R_{used} = C_{pack} \times \frac{R}{P}$$

### C. Multi-Store Matrix Assembly
To find the absolute cheapest combination, the optimizer compiles store totals across the top 3 closest locations:
- **Cheapest Single Store**: Computes $\sum_{i} Cost_{purchase}(i)$ for each store across all ingredients. The store with the lowest cumulative total checkout price is crowned the single-store winner.
- **Mix-and-Match Optimized Route**: Computes $\min_{s} (Cost_{purchase}(i, s))$ for each ingredient $i$ across all stores $s$. This creates a shopping route detailing exactly what to buy at each store, and calculates total travel and grocery savings.

---

## 4. Custom Rule Filtering Cascade Hierarchy

Matching real supermarket products to recipe ingredients is governed by a **5-tier cascade hierarchy**. This cascade applies strict criteria, custom AI logic, and manual overrides sequentially to determine product eligibility.

```
                  +----------------------------------------------+
                  |           RAW SUPERMARKET CATALOG            |
                  +----------------------+-----------------------+
                                         |
                                         v
                  +----------------------+-----------------------+
                  |  LEVEL 1: MANUAL PRODUCT OVERRIDES           |
                  |  - User explicitly clicks "Include/Exclude"  |
                  +----------------------+-----------------------+
                                         |
                                         v
                  +----------------------+-----------------------+
                  |  LEVEL 2: CUSTOM GEMINI INSTRUCTION EVAL     |
                  |  - /api/evaluate-custom-instruction (true/false) |
                  +----------------------+-----------------------+
                                         |
                                         v
                  +----------------------+-----------------------+
                  |  LEVEL 3: MUST EXCLUDE TAG RULES             |
                  |  - Comma-separated strict user exclude tags  |
                  +----------------------+-----------------------+
                                         |
                                         v
                  +----------------------+-----------------------+
                  |  LEVEL 4: MUST INCLUDE TAG RULES             |
                  |  - Comma-separated strict user include tags  |
                  +----------------------+-----------------------+
                                         |
                                         v
                  +----------------------+-----------------------+
                  |  LEVEL 5: BASELINE AI NLP PROFILE            |
                  |  - Negative keyword pruning                  |
                  |  - Positive keyword verification             |
                  |  - Core noun checking (singular/plural)      |
                  +----------------------------------------------+
```

### Level 1: Manual Product Overrides (User Controlled)
- **Visual Color Indicator**: Red Bullet (Level 1)
- **Behavior**: If the user clicks "Exclude" or "Include" on a specific product card, that choice bypasses all automated rules. This gives the user final say over the results.

### Level 2: Custom Gemini Instructions (Individual Evaluation)
- **Visual Color Indicator**: Orange Bullet (Level 2)
- **Behavior**: Applies when a user writes free-form text rules (e.g., "only use organic" or "exclude budget brands"). The system makes an API call to `/api/evaluate-custom-instruction`, which evaluates the products individually.

### Level 3: Must Exclude Rules
- **Visual Color Indicator**: Orange Bullet (Level 3)
- **Behavior**: A comma-separated list of strict text tokens (e.g., `pams, value`). Any product whose name or brand contains any of these terms is immediately excluded.

### Level 4: Must Include Rules
- **Visual Color Indicator**: Amber Bullet (Level 4)
- **Behavior**: A comma-separated list of strict text tokens (e.g., `organic, free range`). The product name or brand must contain at least one of these terms to remain eligible.

### Level 5: Baseline AI NLP Profile
- **Visual Color Indicator**: Yellow Bullet (Level 5)
- **Behavior**: Standard semantic filtering:
  - **Pruning**: Excludes products matching broad negative keywords (e.g., "chips", "dips", "soup", "sachets") to clean up search results.
  - **Verification**: Verifies that positive keywords or allowed synonyms appear in the product details.
  - **Core Noun Check**: Checks that the primary ingredient noun is present in the product name (accounting for singular/plural variations like "onion" and "onions").

---

## 5. Caching & Performance Architecture

To maintain a fast, reliable, and rate-limit-resistant user experience, the backend implements five separate in-memory caches:

1. **`productSearchCache`**: Caches raw Pak'nSave search results keyed by `store_id:ingredient` to prevent rate-limiting from the Pak'nSave API and keep searches instantaneous.
2. **`nlpProfileCache`**: Caches the generated Gemini NLP keyword profiles keyed by the serialized ingredient metadata. This avoids redundant LLM profiling calls when recalculating plans.
3. **`customInstructionCache`**: Caches the individual product boolean evaluation maps keyed by `ingredient::customInstruction`, keeping fine-tuning fast and efficient.
4. **`aiReportCache`**: Caches the generated Markdown portion-matching reports keyed by the hash of the ingredients, servings, and cheapest store.
5. **`dishBreakdownCache`**: Caches the ingredient breakdowns of custom dishes.
6. **`recipeCache`**: Caches the generated recipe steps to ensure cooking guides load instantly on repeat clicks.
