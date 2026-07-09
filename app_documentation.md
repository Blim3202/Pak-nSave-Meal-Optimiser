# Pak'nSave Meal Optimizer - Documentation

## 1. Overview
The **Pak'nSave Meal Optimizer** is a specialized AI-powered application designed for the New Zealand consumer market. Its primary objective is to streamline meal planning and grocery shopping by intelligently decomposing desired dishes into specific, supermarket-friendly raw ingredients. By integrating with local retail knowledge, the app aims to reduce shopping complexity, minimize food waste, and provide culinary guidance tailored to NZ household habits.

## 2. Core Functional Agents
The application's intelligence is distributed across three specialized AI agents, each serving a distinct purpose in the meal-to-shopping pipeline:

### A. Dish Ingredient Generator
This agent is the entry point. It converts a user-defined meal (e.g., "Spaghetti Bolognese") into a structured list of essential raw ingredients.
- **Constraints**: Focuses on 4-8 high-impact ingredients.
- **Scaling**: Dynamically adjusts quantities based on the number of servings, targeting standard NZ retail unit sizes (e.g., 500g, 400g cans).
- **Rule**: Strictly prohibits pre-made or processed meals, ensuring the user shops for fresh, base-level ingredients.

### B. Supermarket NLP Profiler
Once ingredients are generated, this agent creates a semantic "search profile" for each item to ensure accurate mapping to supermarket inventory.
- **Noise Reduction**: Uses negative keywords to filter out irrelevant products (e.g., searching for "onion" but excluding "onion-flavored chips" or "onion wraps").
- **Precision**: Handles synonyms (e.g., "beef mince" vs. "ground beef") and maps ingredients to appropriate aisle categories.

### C. Leftover & Cooking Assistant
The interactive component of the app that provides post-shopping guidance.
- **Culinary Advice**: Offers storage tips and preparation techniques suitable for NZ kitchens.
- **Waste Reduction**: Smartly suggests follow-up meals that utilize leftover ingredients from previous shops.
- **Tone**: Focused on actionable, brief, and friendly guidance.

## 3. How It Works (Technical Flow)
The application operates as a reactive web application that orchestrates interaction between the user, the LLM backend (Gemini), and the UI:

1.  **Input Gathering**: The user interacts with the React frontend to specify location, dish preference, and budget/dietary constraints.
2.  **Orchestration**: The `App.tsx` component manages the state machine of the user journey (Location -> Dish -> Distance/Radius).
3.  **LLM Processing**: For each step, the app sends context to the Gemini backend, which triggers the appropriate agent based on the `AGENTS.md` guidelines.
4.  **Data Retrieval**: The application maps the processed ingredients against internal store data (`src/data/stores.ts`) and dish repository (`src/data/dishes.ts`) to provide actionable shopping results.
5.  **Reactive UI**: The frontend dynamically updates to show progress, ingredient lists, and shopping suggestions, maintaining a clean state without unnecessary re-renders or page reloads.

## 4. Technical Stack
- **Frontend**: React (TypeScript) for the UI, utilizing Tailwind CSS for styling and `lucide-react` for iconography.
- **Backend/Integration**: Vite-based development environment. Employs asynchronous communication with the Gemini API to handle the intelligence layers.
- **Data Architecture**: Structured JSON-based data stores for dishes and store information, ensuring rapid lookups.
- **Agent Governance**: The `AGENTS.md` file serves as a system-prompt configuration, ensuring consistent behavior across all AI-driven interactions.

## 5. User Workflow
1.  **Start**: The user opens the application.
2.  **Define**: The user selects or enters a suburb/address (to determine the local Pak'nSave branch).
3.  **Select**: The user picks a dish (or enters a custom one).
4.  **Process**: The system generates the raw ingredient list.
5.  **Refine**: The NLP profiler generates search terms for the store.
6.  **Assist**: The user receives the shopping list and can ask the Assistant for storage tips or reuse recipes for leftovers.
