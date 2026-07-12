# NZ Meal Cost Optimizer

AI-powered grocery price optimizer that matches meal recipes to the cheapest products across New Zealand Pak'nSave stores.

## Features

- **Dish Ingredient Generator** — Breaks down any recipe into 4–8 core raw ingredients with NZ retail portion sizes
- **Supermarket NLP Profiler** — Filters supermarket search results using Gemini-generated semantic keyword profiles to avoid processed/packaged false matches
- **Multi-Store Optimization** — Compares prices across nearby Pak'nSave stores and recommends the cheapest single-store or mix-store strategy
- **Recipe Guide** — Generates dynamic step-by-step cooking instructions with food safety warnings
- **Culinary Chat Assistant** — Answers questions about leftover storage, ingredient swaps, and cooking tips

## Prerequisites

- Node.js 18+
- A Google Gemini API key (optional — falls back to local recipe presets)

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Copy the environment file and add your Gemini API key:
   ```
   cp .env.example .env
   ```
   Edit `.env` and set `GEMINI_API_KEY="your-key-here"`.

3. Start the dev server:
   ```
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server with Vite middleware |
| `npm run build` | Build frontend and bundle server for production |
| `npm run start` | Run production server |
| `npm run lint` | Type-check all TypeScript files |
| `npm run preview` | Preview the production build |

## Architecture

```
src/               React frontend (TypeScript)
  App.tsx          Main UI component with state management
  main.tsx         React DOM entry point
  index.css        Tailwind CSS imports
  data/
    stores.ts      60 Pak'nSave store locations (NZ-wide)
    dishes.ts      20+ preset recipes with portion quantities
server.ts          Express backend with Gemini API integration
vite.config.ts     Vite build configuration with Tailwind & React plugins
```
