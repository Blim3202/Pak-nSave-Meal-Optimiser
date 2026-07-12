# NZ Meal Cost Optimizer - App Documentation

## 1. Introduction & Solution Overview

### The Problem
The New Zealand grocery market faces significant inflation and lack of transparent pricing metrics. Consumers looking to cook healthy meals face three main challenges:
1. **Portion Mismatches**: Recipes call for specific quantities (e.g., "300g beef mince" or "2 eggs"), but supermarkets sell items in rigid bulk units (e.g., "500g pack" or "12-pack eggs"). Standard price comparison tools only look at total package price, ignoring the actual cost of the portions consumed.
2. **Search Index Pollution**: Querying online supermarket catalogs directly often returns hundreds of irrelevant items. For example, searching "onion" returns onion-flavored potato chips, frozen onion rings, soup sachets, and tortilla wraps rather than fresh brown or red onions.
3. **Store Fragmentation**: Prices for identical goods vary dramatically between local branches. Calculating whether it's cheaper to buy everything at a single store versus driving to two different close branches is mathematically tedious.

### The Solution
The **NZ Meal Cost Optimizer** is a full-stack, AI-driven application designed specifically for the New Zealand consumer. It breaks down any requested dish into raw ingredients, scales quantities dynamically, queries real-time product catalogs from nearby Pak'nSave stores (covering over 60 locations across NZ), and runs a multi-store portion-cost optimization. It filters out irrelevant search results using a 5-tier semantic cascade and presents the cheapest single-store and mix-and-match shopping solutions.

---

## 2. User Experience & Core Workflows

The application is structured as a high-density, single-screen dashboard using a professional dark/light themed interface with clear separation of panels, animated state changes, and live progress streams.

```
+---------------------------------------------------------------------------------+
|                            NZ MEAL COST OPTIMIZER                              |
+----------------------------+----------------------------------------------------+
| 1. Location & Settings     | 4. Optimization Results & Dashboard                |
| - GPS / Address Input      | - Live Process Terminal Logs                       |
| - Store Distance Slider    | - Cheapest Single Store vs. Mix & Match Matrix     |
|                            | - Cost Savings Metrics & Visualization Chart       |
+----------------------------+----------------------------+-----------------------+
| 2. Dish Selection & Serves | 5. Shopping Checklist     | 6. Interactive Map    |
| - Preset or Custom Input   | - Portion-cost checklist   | - Store Pinpoints     |
| - Serving Adjuster (1-12)  | - Store selectors          | - Route indicators    |
+----------------------------+----------------------------+-----------------------+
| 3. Dynamic Ingredient list | 7. AI Recipe Guide         | 8. Culinary Assistant |
| - Quantities scaling       | - Structured steps         | - Leftovers Chat      |
| - Rules & NLP fine-tuning  | - Safety warnings          | - Smart swaps         |
+----------------------------+----------------------------+-----------------------+
```

### A. Location & Store Proximity Settings
- **Address Geocoding**: Users input their home address, suburb, or street. The app uses Nominatim OpenStreetMap API (backed by a local known-coordinates cache for major NZ cities like Auckland, Wellington, and Christchurch) to resolve the location to latitude and longitude.
- **GPS Trigger**: A "Use Current Location" button requests standard browser geolocation coordinate access.
- **Distance Slider**: Adjusts the search radius from 1km to 30km. The backend calculates the Haversine distance to all 60+ Pak'nSave stores across New Zealand to identify the closest three qualifying stores for pricing analysis.

### B. Dish Selector & Serving Adjuster
- **Preset Recipe Deck**: A carousel of 20+ authentic recipes popular in New Zealand households, including Mince & Cheese Pie, Lamb Roast, Butter Chicken, Fish & Chips, and Pavlova.
- **Custom Dish Prompt**: An input bar where users can type any custom dish (e.g., "Spicy Thai Green Curry" or "NZ Lamb Shoulder Sliders"). A server-side Gemini agent decomposes the request into its raw culinary structure.
- **Servings Count**: Scalable from 1 to 12 servings. Changing this count instantly recalculates and scales the raw target ingredient weights in the frontend.

### C. Ingredients List & Real-time Custom Rules
- **Interactive Ingredient Grid**: Displays scaled weights and volume units (e.g., "500g", "12pk", "1L") alongside the ingredient names.
- **Tune Rules Modal**: Clicking on any ingredient opens a fine-tuning panel:
  - **Must Include (Inclusions)**: Enter exact tags or brand keywords (e.g., "organic", "Pam's") that must appear in matching products.
  - **Must Exclude (Exclusions)**: Enter keywords (e.g., "sauce", "chips") to immediately block irrelevant items.
  - **Custom Gemini Instructions**: Enter free-form directives (e.g., "only select grass-fed pasture beef" or "must be under $6"). The system sends these rules to a dedicated server-side Gemini API that evaluates matching products individually.

### D. Optimization Dashboard & Visualizer
- **Live Terminal Stream**: Displays real-time, low-latency NDJSON logs as the backend coordinates geocoding, calls the Gemini NLP Profiler, queries the Pak'nSave API, filters results, and computes optimal prices.
- **Comparison Matrix**: Compares total purchase price (the amount paid at checkout) and portion cost (the value of the exact quantity consumed in the recipe) across:
  - **Cheapest Single Store**: The local Pak'nSave that has all ingredients in stock for the lowest cumulative checkout price.
  - **Optimized Mix-and-Match**: A multi-store shopping solution where the user buys each ingredient from whichever local store has it cheapest, illustrating potential savings.
- **Recharts Visualization**: A high-contrast bar chart depicting savings across single-store alternatives and the optimized mix-and-match option.

### E. Shopping Checklist & Store Map
- **Portion-Cost Checklist**: Displays the selected products, required packages, brand details, unit sizes, checkout prices, and actual portion costs.
- **Interactive Leaflet Map**: Displays the user's location and pins the top 3 closest Pak'nSave stores. Color-coded markers highlight the cheapest single store and the stores involved in the mix-and-match route.

### F. Post-Optimization AI Copilots
- **Recipe Guide**: Generates custom step-by-step cooking steps based on the chosen dish, scaled servings, and exact products matched during optimization. Includes prep time, cook time, and New Zealand food safety indicators.
- **Culinary Chat Assistant**: A conversational interface where the user can chat with an AI assistant. The assistant is automatically supplied with context about the exact products purchased and can answer questions about storing leftover ingredients, reducing food waste, and making quick swaps.

---

## 3. Core AI Agents

The application's intelligence is powered by four distinct, server-side Gemini configurations using the `@google/genai` TypeScript SDK:

```
                  +----------------------------------+
                  |       USER RECIPE REQUEST        |
                  +-----------------+----------------+
                                    |
                                    v
                  +-----------------+----------------+
                  |   1. DISH INGREDIENT GENERATOR   |
                  |     (gemini-3.1-flash-lite)      |
                  +-----------------+----------------+
                                    |
                                    v
                  +-----------------+----------------+
                  |   2. SUPERMARKET NLP PROFILER    |
                  |     (gemini-3.1-flash-lite)      |
                  +-----------------+----------------+
                                    |
                                    v
                  +-----------------+----------------+
                  |  3. INDIVIDUAL PRODUCT EVALUATOR |
                  |     (gemini-3.1-flash-lite)      |
                  +-----------------+----------------+
                                    |
                                    v
                  +-----------------+----------------+
                  |    4. RECIPE & CHAT ASSISTANT    |
                  |     (gemini-3.1-flash-lite)      |
                  +-----------------+----------------+
```

### A. Dish Ingredient Generator
Decomposes a custom dish name into a clean, raw ingredient list suited for supermarket shopping.
- **Input**: Dish name + number of servings.
- **Output**: Strict JSON array containing 4 to 8 essential raw ingredients, their scaled portion quantities, and unit metrics.
- **Design Rule**: Excludes processed pre-made meals (e.g., returns "beef mince", "lasagna sheets", and "cheese" instead of "pre-made frozen lasagna"). It also excludes minor seasoning like water or salt to keep the shopping list focused on core cost drivers.

### B. Supermarket NLP Profiler
Acts as a semantic firewall to protect the search index from irrelevant processed goods.
- **Input**: Ingredient name + user-defined keyword rules.
- **Output**: A structured profile object mapping the ingredient to:
  - `expected_category`: (e.g., "Fresh Produce" or "Fresh Meat") to ensure structural indexing.
  - `positive_keywords`: Tokens that represent the authentic ingredient name (e.g., `["onion", "onions"]`).
  - `negative_keywords`: Tokens to block (e.g., `["wrap", "chips", "soup", "sachet", "mix"]`).
  - `allowed_synonyms`: Acceptable alternatives (e.g., `["brown onion", "red onion"]`).

### C. Individual Product Evaluator (Refilter API)
Individually evaluates product metadata against a user's custom instructions to determine matching eligibility.
- **Input**: Ingredient name + custom rule text + a JSON array of raw supermarket products (with name, brand, units, price).
- **Output**: A strict JSON object mapping each product's name to a `matched` boolean (true/false).
- **Benefit**: Unlike keyword-matching, this uses LLM reasoning to evaluate price boundaries, quality terms, and organic/free-range certifications.

### D. Cooking & Leftover Assistant
An interactive conversational agent that guides users through preparation and leftovers optimization.
- **Input**: Cooking queries, selected dish, scaled servings, and exact optimized shopping results.
- **Output**: Practical, brief responses (under 150 words) focused on New Zealand culinary standards, food safety, and leftovers utilization.

---

## 4. Technical Stack & Architecture

| Layer | Technology | Role |
|---|---|---|
| **Frontend Framework** | React 19 + TypeScript | Manages active dashboard state, geocoding coordinates, and real-time client-side optimization recalculations. |
| **Build Tooling** | Vite 6 + ESBuild | Standard single-page application dev server and production asset bundler. |
| **Backend Framework** | Node.js + Express 4 | Hosts REST API endpoints, proxies Pak'nSave Mobile API requests, and handles server-side Gemini SDK calls. |
| **AI Integration** | `@google/genai` (SDK v0.1.1) | Direct server-to-server integration with Google Gemini Models (`gemini-3.1-flash-lite`). |
| **Data Visualization** | Recharts (v2) | Renders clean, high-contrast bar charts comparing store pricing and potential savings. |
| **Geospatial Mapping** | Leaflet + React-Leaflet | Renders highly responsive maps with OpenStreetMap tile overlays, customer address indicators, and custom store markers. |
| **UI Components** | Tailwind CSS 4 + Lucide Icons | Utility-first CSS classes for a modern dark/light card interface, responsive flex/grid layouts, and vector icons. |
