import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { STORES } from "./src/data/stores.ts";
import { DISHES, DISH_QUANTITIES } from "./src/data/dishes.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini client (server-side only)
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const app = express();
app.use(express.json());

// Known locations for instant geocoding matching
const KNOWN_COORDS: Record<string, { lat: number; lon: number; display_name: string }> = {
  "botany town centre": { lat: -36.9294911, lon: 174.9139646, display_name: "Botany Town Centre, 501 Ti Rakau Drive, Auckland 2013" },
  "botany": { lat: -36.9294911, lon: 174.9139646, display_name: "Botany, Auckland, New Zealand" },
  "albany": { lat: -36.7307894, lon: 174.709932, display_name: "Albany, Auckland, New Zealand" },
  "manukau": { lat: -36.9929697, lon: 174.862599, display_name: "Manukau, Auckland, New Zealand" },
  "royal oak": { lat: -36.9105161, lon: 174.7752785, display_name: "Royal Oak, Auckland, New Zealand" },
  "mt albert": { lat: -36.8821778, lon: 174.7188376, display_name: "Mount Albert, Auckland, New Zealand" },
  "glen innes": { lat: -36.8758461, lon: 174.8551721, display_name: "Glen Innes, Auckland, New Zealand" },
  "ormiston": { lat: -36.9647454, lon: 174.9143936, display_name: "Flat Bush, Auckland, New Zealand" },
  "henderson": { lat: -36.8772447, lon: 174.6329565, display_name: "Henderson, Auckland, New Zealand" },
  "hamilton": { lat: -37.7872, lon: 175.2785, display_name: "Hamilton, Waikato, New Zealand" },
  "wellington": { lat: -41.2865, lon: 174.7762, display_name: "Wellington, New Zealand" },
  "christchurch": { lat: -43.5321, lon: 172.6362, display_name: "Christchurch, Canterbury, New Zealand" },
  "tauranga": { lat: -37.6878, lon: 176.1651, display_name: "Tauranga, Bay of Plenty, New Zealand" },
  "dunedin": { lat: -45.8788, lon: 170.5028, display_name: "Dunedin, Otago, New Zealand" },
};

// Pak'nSave API Client
class PaknSaveAPI {
  private token: string | null = null;
  private tokenExpiry: number = 0;

  private async ensureToken(): Promise<string | null> {
    const now = Date.now();
    if (this.token && now < this.tokenExpiry) {
      return this.token;
    }

    try {
      const res = await fetch("https://api-prod.prod.fsniwaikato.kiwi/prod/mobile/user/login/guest", {
        method: "POST",
        headers: {
          "User-Agent": "PAKnSAVEApp/4.32.0",
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({ banner: "PNS" }),
        signal: AbortSignal.timeout(2000)
      });

      if (!res.ok) {
        throw new Error(`PNS login failed: ${res.status}`);
      }

      const data = await res.json() as any;
      this.token = data.access_token;
      this.tokenExpiry = Date.now() + 45 * 60 * 1000; // Cache 45 mins
      return this.token;
    } catch (err) {
      console.error("PaknSave API Token Error:", err);
      return null;
    }
  }

  public async searchProducts(storeId: string, query: string): Promise<any> {
    try {
      const token = await this.ensureToken();
      if (!token) return null;

      const url = `https://api-prod.prod.fsniwaikato.kiwi/prod/mobile/ecomm-products/PNS/${storeId}/search?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "access_token": token,
          "User-Agent": "PAKnSAVEApp/4.32.0",
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify([]),
        signal: AbortSignal.timeout(2000)
      });

      if (!res.ok) {
        return null;
      }
      return await res.json();
    } catch (err) {
      console.error(`PaknSave API search failed for ${query}:`, err);
      return null;
    }
  }
}

const pnsApi = new PaknSaveAPI();

// Haversine distance calculator
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Convert Units Helper
function deriveUnitLabel(units: string): string {
  if (!units) return "each";
  const u = units.toLowerCase().trim();
  if (u === "kg") return "/kg";
  if (u === "l") return "/L";
  if (u.endsWith("g")) return `each (${units})`;
  if (u.endsWith("ml")) return `each (${units})`;
  if (u.endsWith("l") && u !== "l") return `each (${units})`;
  if (u.includes("pk") || u.includes("pack")) return `per pack (${units})`;
  return "each";
}

// Quantity Parsers for smart matching
function parseQuantity(str: string): { amount: number; unit: string } {
  const s = str.toLowerCase().replace(/\s+/g, "");
  
  const canGrams = s.match(/(\d+(?:\.\d+)?)\s*g/);
  if (s.includes("can") && canGrams) {
    return { amount: parseFloat(canGrams[1]), unit: "g" };
  }

  const kgMatch = s.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kgMatch) {
    return { amount: parseFloat(kgMatch[1]) * 1000, unit: "g" };
  }

  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*g/);
  if (gMatch) {
    return { amount: parseFloat(gMatch[1]), unit: "g" };
  }

  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*ml/);
  if (mlMatch) {
    return { amount: parseFloat(mlMatch[1]), unit: "ml" };
  }

  const lMatch = s.match(/(\d+(?:\.\d+)?)\s*l/);
  if (lMatch) {
    return { amount: parseFloat(lMatch[1]) * 1000, unit: "ml" };
  }

  const countMatch = s.match(/(\d+)\s*(?:egg|pack|clove|slice|fillet|head|medium|tsp|tbsp|jar|base|pouch|block|can|loaf|cup)/);
  if (countMatch) {
    return { amount: parseInt(countMatch[1]), unit: "count" };
  }

  const numMatch = s.match(/^(\d+(?:\.\d+)?)/);
  if (numMatch) {
    return { amount: parseFloat(numMatch[1]), unit: "count" };
  }

  return { amount: 1, unit: "each" };
}

function parseProductUnit(str: string): { amount: number; unit: string } {
  const s = str.toLowerCase().replace(/\s+/g, "");
  
  const kgMatch = s.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kgMatch) return { amount: parseFloat(kgMatch[1]) * 1000, unit: "g" };

  const gMatch = s.match(/(\d+(?:\.\d+)?)\s*g/);
  if (gMatch) return { amount: parseFloat(gMatch[1]), unit: "g" };

  const mlMatch = s.match(/(\d+(?:\.\d+)?)\s*ml/);
  if (mlMatch) return { amount: parseFloat(mlMatch[1]), unit: "ml" };

  const lMatch = s.match(/(\d+(?:\.\d+)?)\s*l/);
  if (lMatch) return { amount: parseFloat(lMatch[1]) * 1000, unit: "ml" };

  const pkMatch = s.match(/(\d+)\s*(?:pk|pack|pcs)/);
  if (pkMatch) return { amount: parseInt(pkMatch[1]), unit: "count" };

  if (s === "kg") return { amount: 1000, unit: "g" };
  if (s === "l") return { amount: 1000, unit: "ml" };

  const approxGrams = s.match(/~(\d+)\s*g/);
  if (approxGrams) return { amount: parseFloat(approxGrams[1]), unit: "g" };

  return { amount: 1, unit: "count" };
}

function calculatePortionDetails(requiredQtyStr: string, productUnitStr: string, price: number) {
  const req = parseQuantity(requiredQtyStr);
  const prod = parseProductUnit(productUnitStr);

  let packsNeeded = 1;
  let ratioUsed = 1;

  if (req.unit === prod.unit && prod.amount > 0) {
    packsNeeded = Math.ceil(req.amount / prod.amount);
    ratioUsed = req.amount / (prod.amount * packsNeeded);
  } else {
    packsNeeded = 1;
    ratioUsed = 1;
  }

  const purchaseCost = price * packsNeeded;
  const portionCost = purchaseCost * ratioUsed;

  return {
    packsNeeded,
    purchaseCost: parseFloat(purchaseCost.toFixed(2)),
    portionCost: parseFloat(portionCost.toFixed(2)),
    ratioUsed,
  };
}

function nlpFilterProducts(
  ingredient: string,
  products: any[],
  profile?: { expected_category?: string; positive_keywords: string[]; negative_keywords: string[]; allowed_synonyms: string[] },
  customRule?: { include?: string; exclude?: string }
): any[] {
  const ingLower = ingredient.toLowerCase().trim();
  
  // Base token extraction for local fallback
  const stopWords = new Set(["fresh", "organic", "raw", "pure", "pack", "bag", "large", "medium", "small", "loose", "each", "g", "kg", "ml", "l", "unit", "units"]);
  const ingTokens = ingLower.split(/[\s,/\-\(\)]+/).filter(t => t.length > 1 && !stopWords.has(t));
  
  // Use Gemini profile if available, otherwise construct standard local fallback lists
  const positiveKeywords = (profile?.positive_keywords || []).map(w => w?.toLowerCase()).filter(Boolean);
  const finalPositiveKeywords = positiveKeywords.length > 0 ? positiveKeywords : ingTokens;
  
  // Base negative keywords lists to filter out irrelevant categories or product forms
  const baseNegatives = [
    // Pets & Animal products
    "cat", "dog", "pet", "puppy", "kitten", "animal", "toy", "shampoo", "soap", "cleaner", "detergent", 
    "book", "magazine", "utensil", "plate", "cup", "bowl", "pot", "pan",
    // Processed carbs, wraps, chips (frequent false matches for onion, garlic, beef)
    "wrap", "wraps", "tortilla", "tortillas", "flatbread", "flatbreads", 
    "chip", "chips", "crisp", "crisps", "cracker", "crackers", "biscuit", "biscuits",
    // Flavours, powders, sachet soups, seasonings, gravy
    "soup", "sachet", "sachets", "mix", "mixes", "seasoning", "seasonings", "powder", "powders",
    "gravy", "stock", "cube", "cubes", "flavor", "flavour", "flavoured", "flavored",
    "dip", "dips", "ring", "rings", "patty", "patties", "burger", "burgers", "pie", "pies",
    "sausage", "sausages", "nugget", "nuggets", "salami", "bacon", "ham"
  ];

  const negativeKeywords = (profile?.negative_keywords || []).map(w => w?.toLowerCase()).filter(Boolean).concat(baseNegatives);
  
  return products.filter(p => {
    const prodLower = p.name.toLowerCase().trim();
    const brandLower = (p.brand || "").toLowerCase().trim();
    const fullText = `${prodLower} ${brandLower}`;

    // Apply strict custom exclusion rules if provided
    if (customRule?.exclude) {
      const customExcludes = customRule.exclude.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
      for (const ex of customExcludes) {
        if (fullText.includes(ex)) {
          return false;
        }
      }
    }

    // Apply strict custom inclusion rules if provided
    if (customRule?.include) {
      const customIncludes = customRule.include.toLowerCase().split(",").map(s => s.trim()).filter(Boolean);
      for (const inc of customIncludes) {
        if (!fullText.includes(inc)) {
          return false;
        }
      }
    }

    // 1. Strict Negative Check: if any negative keyword is present in product text,
    // but was NOT explicitly mentioned in the user's ingredient, filter it out!
    for (const neg of negativeKeywords) {
      if (fullText.includes(neg) && !ingLower.includes(neg)) {
        return false;
      }
    }

    // 2. Strict Positive Check (if we have positive keywords)
    if (finalPositiveKeywords.length > 0) {
      const matchedCount = finalPositiveKeywords.filter(k => fullText.includes(k)).length;
      
      // If none matched, reject unless allowed synonym is present
      if (matchedCount === 0) {
        const hasSynonym = (profile?.allowed_synonyms || []).some(syn => syn && fullText.includes(syn.toLowerCase())) || false;
        if (!hasSynonym) {
          return false;
        }
      }

      // If it has multiple positive tokens, check if we got the core noun.
      const coreNoun = finalPositiveKeywords[finalPositiveKeywords.length - 1];
      if (coreNoun && !fullText.includes(coreNoun)) {
        const pluralCoreNoun = coreNoun.endsWith("o") ? coreNoun + "oes" : coreNoun.endsWith("y") ? coreNoun.slice(0, -1) + "ies" : coreNoun + "s";
        const singularCoreNoun = coreNoun.endsWith("s") ? coreNoun.slice(0, -1) : coreNoun;
        
        if (!fullText.includes(pluralCoreNoun) && !fullText.includes(singularCoreNoun)) {
          const hasSynonym = (profile?.allowed_synonyms || []).some(syn => syn && fullText.includes(syn.toLowerCase())) || false;
          if (!hasSynonym && matchedCount < finalPositiveKeywords.length) {
            return false;
          }
        }
      }
    }

    return true;
  });
}

// Fallback search product generator when real API is offline
function generateRealisticNZProducts(ingredient: string, storeHash: number): any[] {
  const ing = ingredient.toLowerCase().trim();
  const priceVariance = 1 + (storeHash % 15 - 7) / 100; // Adds realistic +/- 7% store price difference
  
  const items = (() => {
    if (ing.includes("beef mince") || ing.includes("mince")) {
      return [
        { name: "Pams Beef Mince 500g", brand: "Pams", price: 1150, units: "500g" },
        { name: "Pams Prime Beef Mince 1kg", brand: "Pams", price: 1999, units: "1kg" },
        { name: "Angus Pure Beef Mince 500g", brand: "Angus Pure", price: 1350, units: "500g" },
        { name: "Value Beef Mince 500g", brand: "Value", price: 950, units: "500g" }
      ];
    }
    if (ing.includes("pasta") || ing.includes("spaghetti")) {
      return [
        { name: "Pams Spaghetti Pasta 500g", brand: "Pams", price: 180, units: "500g" },
        { name: "Value Spaghetti Pasta 500g", brand: "Value", price: 120, units: "500g" },
        { name: "San Remo Spaghetti No 5 500g", brand: "San Remo", price: 279, units: "500g" }
      ];
    }
    if (ing.includes("tomato") || ing.includes("tomatoes")) {
      return [
        { name: "Pams Diced Tomatoes 400g", brand: "Pams", price: 140, units: "400g" },
        { name: "Value Diced Tomatoes 400g", brand: "Value", price: 99, units: "400g" },
        { name: "Pams Chopped Tomatoes in Juice 400g", brand: "Pams", price: 140, units: "400g" }
      ];
    }
    if (ing.includes("egg") || ing.includes("eggs")) {
      return [
        { name: "Pams Free Range Eggs Large 10pk", brand: "Pams", price: 750, units: "10pk" },
        { name: "Pams Barn Eggs Large 12pk", brand: "Pams", price: 820, units: "12pk" },
        { name: "Value Eggs Mixed Size 10pk", brand: "Value", price: 650, units: "10pk" }
      ];
    }
    if (ing.includes("cheese")) {
      return [
        { name: "Pams Grated Tasty Cheese 250g", brand: "Pams", price: 550, units: "250g" },
        { name: "Pams Grated Colby Cheese 500g", brand: "Pams", price: 890, units: "500g" },
        { name: "Value Grated Mild Cheese 250g", brand: "Value", price: 420, units: "250g" }
      ];
    }
    if (ing.includes("milk")) {
      return [
        { name: "Meadow Fresh Original Milk Blue 2L", brand: "Meadow Fresh", price: 530, units: "2L" },
        { name: "Anchor Blue Milk 2L", brand: "Anchor", price: 580, units: "2L" },
        { name: "Pams Blue Milk 1L", brand: "Pams", price: 295, units: "1L" }
      ];
    }
    if (ing.includes("onion") || ing.includes("onions")) {
      return [
        { name: "Pams Brown Onions 1.5kg bag", brand: "Pams", price: 350, units: "1.5kg" },
        { name: "Loose Brown Onion each", brand: "Loose", price: 60, units: "each" }
      ];
    }
    if (ing.includes("potato") || ing.includes("potatoes")) {
      return [
        { name: "Pams Agria Potatoes 2kg bag", brand: "Pams", price: 499, units: "2kg" },
        { name: "Loose Agria Potato each", brand: "Loose", price: 80, units: "each" }
      ];
    }
    if (ing.includes("chicken breast") || ing.includes("chicken thigh") || ing.includes("chicken")) {
      return [
        { name: "Pams Chicken Breast Fillets 1kg", brand: "Pams", price: 1599, units: "1kg" },
        { name: "Tegel Chicken Breast Fillets 500g", brand: "Tegel", price: 1050, units: "500g" },
        { name: "Pams Chicken Thigh Fillets 1kg", brand: "Pams", price: 1699, units: "1kg" }
      ];
    }
    if (ing.includes("vegetable") || ing.includes("vegetables") || ing.includes("veg")) {
      return [
        { name: "Pams Stir Fry Vegetables 500g bag", brand: "Pams", price: 450, units: "500g" },
        { name: "Pams Mixed Vegetables Frozen 1kg", brand: "Pams", price: 399, units: "1kg" }
      ];
    }
    if (ing.includes("soy sauce")) {
      return [
        { name: "Lee Kum Kee Light Soy Sauce 250ml", brand: "Lee Kum Kee", price: 320, units: "250ml" },
        { name: "Pams Soy Sauce 150ml", brand: "Pams", price: 210, units: "150ml" }
      ];
    }
    if (ing.includes("oil")) {
      return [
        { name: "Pams Canola Oil 1L", brand: "Pams", price: 450, units: "1L" },
        { name: "Pams Rice Bran Oil 1L", brand: "Pams", price: 599, units: "1L" }
      ];
    }

    // Default NZ grocery brand products fallback
    return [
      { name: `Pams ${ingredient.charAt(0).toUpperCase() + ingredient.slice(1)} 500g`, brand: "Pams", price: 599, units: "500g" },
      { name: `Value ${ingredient.charAt(0).toUpperCase() + ingredient.slice(1)} 250g`, brand: "Value", price: 349, units: "250g" },
      { name: `Meadow Fresh ${ingredient.charAt(0).toUpperCase() + ingredient.slice(1)} 250g`, brand: "Meadow Fresh", price: 489, units: "250g" }
    ];
  })();

  return items.map((item, idx) => {
    const rawPrice = Math.round(item.price * priceVariance);
    const finalPrice = Math.max(idx === 1 ? rawPrice - 50 : rawPrice, 50); // Keep some healthy variation
    return {
      name: item.name,
      brand: item.brand,
      price: finalPrice / 100,
      units: item.units,
      unit_label: deriveUnitLabel(item.units)
    };
  });
}

// ── API ROUTES ──

// Geocoding Proxy
app.get("/api/geocode", async (req, res) => {
  const address = (req.query.address as string || "").trim();
  if (!address) {
    return res.status(400).json({ error: "Address parameter required" });
  }

  // Parse direct GPS coordinate format: "GPS Position (lat, lng)"
  const gpsMatch = address.match(/GPS\s*Position\s*\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/i);
  if (gpsMatch) {
    return res.json({
      lat: parseFloat(gpsMatch[1]),
      lon: parseFloat(gpsMatch[2]),
      display_name: `GPS Position (${gpsMatch[1]}, ${gpsMatch[2]})`
    });
  }

  // Check known locations for instantaneous response
  const lowerAddr = address.toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_COORDS)) {
    if (lowerAddr.includes(key)) {
      return res.json(coords);
    }
  }

  // Fallback to real Nominatim request
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", New Zealand")}&format=json&limit=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "NZMealCostOptimizer/1.0 GoogleAI"
      }
    });

    if (response.ok) {
      const data = await response.json() as any;
      if (data && data.length > 0) {
        return res.json({
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
          display_name: data[0].display_name
        });
      }
    }
    
    // Default fallback
    return res.json(KNOWN_COORDS["botany town centre"]);
  } catch (err) {
    console.warn("Geocoding failed, falling back to Botany Town Centre coords:", err);
    return res.json(KNOWN_COORDS["botany town centre"]);
  }
});

// Dynamic Dish Breakdown Generator via Gemini
app.post("/api/dish-ingredients", async (req, res) => {
  const { dish, servings = 4 } = req.body;
  if (!dish) {
    return res.status(400).json({ error: "Dish name is required" });
  }

  const normalized = dish.toLowerCase().trim();
  const cacheKey = `${normalized}-${servings}`;

  if (dishBreakdownCache[cacheKey]) {
    return res.json({ ...dishBreakdownCache[cacheKey], log: "Cache Hit: Ingredient breakdown loaded from memory." });
  }

  // If Gemini is not configured, fallback to offline DB
  if (!ai) {
    if (DISHES[normalized]) {
      const ings = DISHES[normalized];
      const qtys: Record<string, string> = {};
      ings.forEach(ing => {
        qtys[ing] = DISH_QUANTITIES[normalized]?.[ing] || "1 unit";
      });
      return res.json({ ingredients: ings, quantities: qtys, log: "Gemini client not initialized. Loaded local database preset." });
    }
    return res.status(400).json({ error: `AI Assistant is not initialized, and "${dish}" is not a recognized preset recipe. Please enter a recognized recipe preset or configure your Gemini API key in the workspace settings.` });
  }

  let response: any = null;
  try {
    console.log(`[Gemini] Breaking down dish: "${dish}"`);
    const prompt = `You are the Dish Ingredient Generator Agent for NZ MealCost Optimizer.
We need to break down the dish "${dish}" into its core cooking ingredients scaled precisely for a family of ${servings} people.

This dish can be a traditional recipe, a specific variation, a diet-friendly alternative, or a completely custom/creative culinary idea (e.g. "keto vegetarian lasagna", "dairy free butter chicken", or any descriptive text input). If it is a custom or descriptive dish, use your culinary expertise to infer the most appropriate core ingredients to make this dish delicious and realistic.

Please follow these strict guidelines:
1. Only return raw, individual cooking ingredients (e.g. "beef mince", "onion", "cheddar cheese", "canned chopped tomatoes") rather than prepared food kits, pre-cooked meals, or finished multi-ingredient meal-boxes.
2. Limit the list to between 4 and 8 core, essential raw ingredients. Avoid micro-ingredients (like "salt", "pepper", "water") unless critical.
3. Scale the raw and uncooked ingredient quantities realistically and appropriately for ${servings} servings. Use standard New Zealand retail unit pack sizes (e.g., "500g", "1kg", "1 can (400g)", "12pk", "1L").
4. Under NO circumstances should any quantity be "1 unit" or generic "unit". Use a specific, standard retail package size, weight, volume, or a clear piece/count description (e.g. "4 pieces", "1 bag (1.5kg)", "1 bunch").
5. Ensure that the amount of ingredient is correct for ${servings} servings.
6. Ensure that the ingredients are appropriately broken down into things you can find in a supermarket and are suitable for human consumption.

Respond ONLY with a JSON object containing "ingredients" (array of strings) and "quantities" (object mapping ingredient to quantity string). Do not include any introductory or concluding text.`;

    response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite", // Supports structured outputs
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["ingredients"],
          properties: {
            ingredients: {
              type: Type.ARRAY,
              description: "A list of 4-8 ingredients with their respective retail portions",
              items: {
                type: Type.OBJECT,
                required: ["name", "quantity"],
                properties: {
                  name: { 
                    type: Type.STRING, 
                    description: "The name of the raw ingredient" 
                  },
                  quantity: { 
                    type: Type.STRING, 
                    description: "The retail portion size" 
                  }
                }
              }
            }
          }
        }
      }
    });

    console.log(`[Gemini] Response received for "${dish}"`);
    if (response.text) {
      let rawText = response.text.trim();
      // Robust extraction of JSON from potential markdown wrappers
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        rawText = jsonMatch[0];
      }
      try {
        const parsed = JSON.parse(rawText);
        
        // Convert schema format: { ingredients: Array<{ name, quantity }> }
        // into expected format: { ingredients: string[], quantities: Record<string, string> }
        let ingredientsList: string[] = [];
        let quantitiesMap: Record<string, string> = {};

        if (parsed && Array.isArray(parsed.ingredients)) {
          parsed.ingredients.forEach((item: any) => {
            if (item && typeof item === "object" && item.name) {
              const name = item.name.trim();
              ingredientsList.push(name);
              quantitiesMap[name] = item.quantity || "1 unit";
            } else if (typeof item === "string") {
              ingredientsList.push(item);
              if (parsed.quantities && parsed.quantities[item]) {
                quantitiesMap[item] = parsed.quantities[item];
              } else {
                quantitiesMap[item] = "1 unit";
              }
            }
          });
        }

        if (ingredientsList.length === 0) {
          throw new Error("No ingredients parsed from Gemini response.");
        }

        const finalData = {
          ingredients: ingredientsList,
          quantities: quantitiesMap
        };

        dishBreakdownCache[cacheKey] = finalData;
        return res.json({ ...finalData, log: "Gemini successful." });
      } catch (parseErr) {
        console.error("Failed to parse JSON response:", rawText, parseErr);
        throw new Error(`Invalid JSON from Gemini. Raw response:\n${rawText}`);
      }
    }
    const emptyMsg = response?.text ? `Gemini returned text but response.text was falsy` : "Empty response from Gemini";
    throw new Error(emptyMsg);
  } catch (err: any) {
    console.error("Gemini breakdown failed:", err);
    
    // Check for authorization/blocked key errors and provide extremely clear, helpful error advice
    const errMsg = err.message || String(err);
    const isAuthError = errMsg.includes("UNAUTHENTICATED") || 
                        errMsg.includes("401") || 
                        errMsg.includes("API_KEY_SERVICE_BLOCKED") || 
                        errMsg.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED");

    if (isAuthError) {
      return res.status(401).json({
        error: `Gemini API key is unauthenticated or blocked. Your current key starts with 'AQ.', which Google's servers have restricted (ACCESS_TOKEN_TYPE_UNSUPPORTED or API_KEY_SERVICE_BLOCKED). To resolve this, go to Google AI Studio, generate a standard API key starting with 'AIzaSy...', and save it under the name 'GEMINI_API_KEY' in Settings > Secrets to override the blocked default.`
      });
    }

    if (err.status === 429 || errMsg.includes("429")) {
      return res.status(429).json({ error: "AI rate limit exceeded. Please wait a minute and try again." });
    }

    // No fallback presets on AI failure (as requested to prevent silent false dishes)
    // If we got raw text from Gemini (even if unparseable), surface it in the error
    const rawResp = response?.text?.trim();
    if (rawResp) {
      return res.status(500).json({ error: `Gemini returned unparseable response:\n${rawResp.substring(0, 1000)}` });
    }
    return res.status(500).json({ error: `Gemini error: ${errMsg}` });
  }
});

// Simple top-level in-memory product catalog cache to prevent rate-limiting and make rule tuning instant
const productSearchCache: Record<string, any[]> = {};
const nlpProfileCache: Record<string, any> = {};
const aiReportCache: Record<string, string> = {};
const dishBreakdownCache: Record<string, any> = {};
const recipeCache: Record<string, any> = {};

// Dynamic Recipe Generator Guide
app.post("/api/generate-recipe", async (req, res) => {
  const { dish, servings = 4, ingredients = [] } = req.body;
  if (!dish) {
    return res.status(400).json({ error: "Dish name is required" });
  }

  const cacheKey = `${dish.toLowerCase().trim()}-${servings}-${JSON.stringify(ingredients)}`;
  if (recipeCache[cacheKey]) {
    return res.json(recipeCache[cacheKey]);
  }

  // Fallback in case Gemini is not available
  if (!ai) {
    const fallbackRecipe = {
      dishName: dish,
      servings,
      warning: "AI Assistant is not initialized. This is a local fallback recipe guide. Always ensure meat is fully cooked and exercise standard kitchen safety.",
      measurementDisclaimer: "Measurements are approximate. Adjust seasoning and portions to suit your personal preferences.",
      generatedIngredientsUsed: ingredients,
      additionalIngredientsNeeded: [
        { name: "Salt & Pepper", qty: "to taste" },
        { name: "Cooking Oil or Butter", qty: "1-2 tbsp" },
        { name: "Water", qty: "as needed" }
      ],
      cookingSteps: [
        {
          stepNumber: 1,
          title: "Preparation",
          instruction: "Wash any fresh produce, measure your ingredients, and prepare your workspace.",
          durationMinutes: 10
        },
        {
          stepNumber: 2,
          title: "Cooking the Base",
          instruction: "Heat oil or butter in a pan, sauté aromatics (like onions or garlic if present) until softened.",
          durationMinutes: 5
        },
        {
          stepNumber: 3,
          title: "Combine Ingredients",
          instruction: `Add the main ingredients (${ingredients.map((i: any) => i.name).join(", ") || "the generated ingredients"}). Cook until tender, heated through, or cooked to safe internal temperatures.`,
          durationMinutes: 15
        },
        {
          stepNumber: 4,
          title: "Season and Serve",
          instruction: "Adjust seasoning with salt, pepper, or other household spices. Serve hot and enjoy!",
          durationMinutes: 5
        }
      ],
      totalTimeMinutes: 35,
      prepTimeMinutes: 10
    };
    return res.json(fallbackRecipe);
  }

  try {
    const prompt = `You are an expert culinary assistant and recipe developer.
We need a dynamic, high-quality recipe guide for the dish: "${dish}" scaled for ${servings} servings.
The user has generated the following core ingredients in our app:
${JSON.stringify(ingredients, null, 2)}

Please follow these instructions strictly to construct the recipe:
1. Ensure ALL of the above generated ingredients are incorporated into the cooking steps.
2. In addition to the generated ingredients, identify other basic household items or pantry staples required (such as water, salt, pepper, oil, butter, common spices, and basic seasonings) and list them under additional ingredients.
3. Include an explicit safety and accuracy warning about AI-generated recipes. Explain that AI recipes might not be accurate or necessarily safe, and that meat/poultry must be cooked to recommended internal temperatures.
4. Include a disclaimer about measurements: emphasize that recipes don't have to use exact measurements and can use a range of weights/sizes according to the user's personal taste, preferences, and actual package sizes purchased.
5. Detail clear, step-by-step instructions for cooking, including estimated timing/durations for each step.

Respond ONLY with a JSON object matching this schema:
{
  "dishName": "Name of the dish",
  "servings": ${servings},
  "warning": "Explicit warning about AI recipe accuracy and food safety",
  "measurementDisclaimer": "Clear instruction that measurements are ranges and flexible",
  "generatedIngredientsUsed": [ { "name": "ingredient name", "qty": "approximate quantity or range" } ],
  "additionalIngredientsNeeded": [ { "name": "additional item", "qty": "approximate quantity or range" } ],
  "cookingSteps": [
    {
      "stepNumber": 1,
      "title": "Step title",
      "instruction": "Detailed clear instructions on cooking steps",
      "durationMinutes": 10
    }
  ],
  "totalTimeMinutes": 35,
  "prepTimeMinutes": 10
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["dishName", "servings", "warning", "measurementDisclaimer", "generatedIngredientsUsed", "additionalIngredientsNeeded", "cookingSteps", "totalTimeMinutes", "prepTimeMinutes"],
          properties: {
            dishName: { type: Type.STRING },
            servings: { type: Type.INTEGER },
            warning: { type: Type.STRING },
            measurementDisclaimer: { type: Type.STRING },
            generatedIngredientsUsed: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "qty"],
                properties: {
                  name: { type: Type.STRING },
                  qty: { type: Type.STRING }
                }
              }
            },
            additionalIngredientsNeeded: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "qty"],
                properties: {
                  name: { type: Type.STRING },
                  qty: { type: Type.STRING }
                }
              }
            },
            cookingSteps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["stepNumber", "title", "instruction", "durationMinutes"],
                properties: {
                  stepNumber: { type: Type.INTEGER },
                  title: { type: Type.STRING },
                  instruction: { type: Type.STRING },
                  durationMinutes: { type: Type.INTEGER }
                }
              }
            },
            totalTimeMinutes: { type: Type.INTEGER },
            prepTimeMinutes: { type: Type.INTEGER }
          }
        }
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      recipeCache[cacheKey] = parsed;
      return res.json(parsed);
    }
    throw new Error("No text response from Gemini");
  } catch (err: any) {
    console.error("Failed to generate recipe:", err);
    // Return standard fallback on failure
    const fallbackRecipe = {
      dishName: dish,
      servings,
      warning: "AI Assistant is currently offline or busy. Always ensure proper food safety protocols and check cooking temperatures thoroughly.",
      measurementDisclaimer: "Adjust ingredient ratios to match your package sizes and taste preferences.",
      generatedIngredientsUsed: ingredients,
      additionalIngredientsNeeded: [
        { name: "Salt & Pepper", qty: "to taste" },
        { name: "Cooking Oil or Butter", qty: "1-2 tbsp" },
        { name: "Water", qty: "as needed" }
      ],
      cookingSteps: [
        {
          stepNumber: 1,
          title: "Prep Work",
          instruction: "Wash, chop, and organize all ingredients.",
          durationMinutes: 10
        },
        {
          stepNumber: 2,
          title: "Sauté and Sear",
          instruction: "Heat your pan and cook the main proteins or aromatics.",
          durationMinutes: 10
        },
        {
          stepNumber: 3,
          title: "Simmer or Bake",
          instruction: "Cook everything together until fully done and safe to eat.",
          durationMinutes: 15
        }
      ],
      totalTimeMinutes: 35,
      prepTimeMinutes: 10
    };
    return res.json(fallbackRecipe);
  }
});

// Full optimization route
app.post("/api/optimize", async (req, res) => {
  const { address, lat, lon, dish, radius, servings, ingredients, quantities, customRules } = req.body;
  const userLat = lat || -36.9294911;
  const userLon = lon || 174.9139646;
  const radiusKm = radius || 5;
  const numServings = servings || 4;

  res.setHeader('Content-Type', 'application/x-ndjson');
  const send = (data: any) => res.write(JSON.stringify(data) + '\n');
  const logs = { push: (msg: string) => send({ type: 'log', message: msg }) };
  const timestamp = () => `[${new Date().toLocaleTimeString()}]`;

  logs.push(`${timestamp()} Geocoded address: "${address}" to (${userLat.toFixed(5)}, ${userLon.toFixed(5)})`);

  // Calculate distances to all 60 stores
  const storesWithDistance = STORES.map(store => {
    const dist = haversine(userLat, userLon, store.latitude, store.longitude);
    return { ...store, distance_km: dist };
  });

  // Filter within radius and sort
  let nearbyStores = storesWithDistance.filter(s => s.distance_km <= radiusKm);
  nearbyStores.sort((a, b) => a.distance_km - b.distance_km);

  logs.push(`${timestamp()} Found ${nearbyStores.length} stores within ${radiusKm}km.`);

  // If no stores within radius, fallback to nearest 3 stores
  if (nearbyStores.length === 0) {
    logs.push(`${timestamp()} WARNING: No stores found within ${radiusKm}km. Falling back to the nearest 3 stores.`);
    storesWithDistance.sort((a, b) => a.distance_km - b.distance_km);
    nearbyStores = storesWithDistance.slice(0, 3);
  } else {
    // Limit to top 3 closest stores to prevent PNS API rate limits and keep optimization fast
    nearbyStores = nearbyStores.slice(0, 3);
  }

  logs.push(`${timestamp()} Conducting optimization on: ${nearbyStores.map(s => `${s.name} (${s.distance_km.toFixed(1)}km)`).join(", ")}`);

  // Generate NLP Profiles using Gemini if available to make matching extremely precise
  const nlpProfiles: Record<string, { expected_category: string; positive_keywords: string[]; negative_keywords: string[]; allowed_synonyms: string[] }> = {};
  
  if (ai) {
    try {
      logs.push(`${timestamp()} Performing smart semantic analysis on ingredient list using Gemini NLP...`);
      
      const ingredientsMetadata = ingredients.map((ing: string) => {
        const requiredQty = quantities[ing] || "1 unit";
        const rule = customRules?.[ing];
        return {
          ingredient_name: ing,
          quantity: requiredQty,
          is_fresh_unprocessed: !ing.toLowerCase().includes("canned") && 
                                !ing.toLowerCase().includes("sauce") && 
                                !ing.toLowerCase().includes("paste") && 
                                !ing.toLowerCase().includes("sachet") && 
                                !ing.toLowerCase().includes("mix"),
          custom_user_rules: rule ? {
            must_include_brand_or_keywords: rule.include || "",
            must_exclude_brand_or_keywords: rule.exclude || "",
            custom_instruction: rule.customPrompt || ""
          } : undefined
        };
      });

      const cacheKey = JSON.stringify(ingredientsMetadata);
      if (nlpProfileCache[cacheKey]) {
        Object.assign(nlpProfiles, nlpProfileCache[cacheKey]);
        logs.push(`${timestamp()} [Cache Hit] Loaded NLP profiles from cache.`);
      } else {
        const profilePrompt = `We are optimizing grocery prices for the dish "${dish}".
For each of the following ingredients (along with their metadata of expected quantity/portion size, raw status, and any custom user rules), analyze their physical characteristics to prevent supermarket search engine pollution. Supermarkets often return unrelated processed items containing or flavoured with the ingredient.
For example:
- Searching for "onion" may return "onion tortilla wraps", "French onion dip", "onion soup sachets", "onion rings", "potato chips onion flavour", or "spring onion crackers".
- Searching for "beef mince" may return "beef burger patties", "beef mince pies", "beef sausages", "beef stock cubes", or "beef dog/cat food".
- Searching "lemons" may return "lemon flavoured lozenges".

You MUST strictly incorporate any user-specified custom rules. If they specify to exclude a brand (e.g. "Pam's") or product form (e.g. "soup sachet"), add those words (e.g., "pams", "soup", "sachet") to the negative_keywords. If they specify to include a keyword or brand (e.g. "organic"), add it to the positive_keywords.

We want to isolate only the exact, core cooking ingredient intended for the dish "${dish}" given its portion/quantity suitable for human consumption.

For each ingredient, define:
1. "expected_category": A broad category like "Fresh Produce", "Fresh Meat", "Pantry", "Bakery", "Dairy", "Canned Goods".
2. "positive_keywords": 2-4 words that MUST be present in the product name/brand or are highly specific to the ingredient (e.g. for "onion", ["onion", "onions"]).
3. "negative_keywords": Words representing completely different or processed product forms, wraps, tortillas, soup mixes, chips, crackers, seasoning packets, medicine, fragrances, cleaning products, or pet foods to exclude (e.g., for "onion", avoid ["wrap", "wraps", "tortilla", "tortillas", "flatbread", "flatbreads", "chip", "chips", "crisp", "crisps", "soup", "sachet", "sachets", "mix", "mixes", "dip", "dips", "sauce", "sauces", "ring", "rings", "seasoning", "cracker", "crackers", "shampoo", "soap", "pet", "dog", "cat", "medicine", "detergent", "scent", "flavoured"]).
4. "allowed_synonyms": Acceptable alternative names or synonyms (e.g., ["brown onion", "red onion", "white onion", "loose onion"]).

Ingredients with metadata to analyze:
${JSON.stringify(ingredientsMetadata, null, 2)}

Respond ONLY with a JSON object where each key is the exact ingredient name from the list, mapping to an object with "expected_category", "positive_keywords", "negative_keywords", and "allowed_synonyms".`;

        const profileResponse = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: profilePrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              additionalProperties: {
                type: Type.OBJECT,
                properties: {
                  expected_category: { type: Type.STRING },
                  positive_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  negative_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  allowed_synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["expected_category", "positive_keywords", "negative_keywords", "allowed_synonyms"]
              }
            }
          }
        });

        if (profileResponse.text) {
          const parsed = JSON.parse(profileResponse.text.trim());
          Object.assign(nlpProfiles, parsed);
          nlpProfileCache[cacheKey] = parsed;
          logs.push(`${timestamp()} Gemini NLP matching profiles generated for: ${Object.keys(nlpProfiles).join(", ")}.`);
        }
      }
    } catch (err) {
      console.error("Failed to generate Gemini NLP profiles:", err);
      logs.push(`${timestamp()} Note: Gemini NLP analysis failed, using fallback local NLP matching heuristics.`);
    }
  } else {
    logs.push(`${timestamp()} Note: Gemini client not initialized, using fallback local NLP matching heuristics.`);
  }

  const results: any[] = [];
  const allFoundProducts: Record<string, Record<string, any[]>> = {}; // store_id -> ingredient -> products[]

  // Query or fallback for each store and ingredient
  for (const store of nearbyStores) {
    allFoundProducts[store.store_id] = {};
    logs.push(`${timestamp()} Scanning inventory at Pak'nSave ${store.name}...`);

    for (const ing of ingredients) {
      let products: any[] = [];
      let isMock = false;
      const cacheKey = `${store.store_id}:${ing}`;

      if (productSearchCache[cacheKey]) {
        products = productSearchCache[cacheKey];
        isMock = products.some(p => p.is_mock);
        logs.push(`${timestamp()} [Cache Hit] Loaded cached Pak'nSave catalog for "${ing}" (${~~products.length} products).`);
      } else {
        // Call the real Pak'nSave API
        const searchRes = await pnsApi.searchProducts(store.store_id, ing);
        if (searchRes && searchRes.products && searchRes.products.length > 0) {
          products = searchRes.products.map((p: any) => ({
            name: p.name,
            brand: p.brand || "",
            price: (p.price || 0) / 100,
            units: p.units || "",
            unit_label: deriveUnitLabel(p.units || ""),
            is_mock: false
          }));
        } else {
          // Do not fall back to mock products or pricing to prevent giving false info to the customer
          products = [];
          isMock = false;
        }
        
        // Cache the raw supermarket catalog search results (keeping the top 20 search index matches)
        productSearchCache[cacheKey] = products.slice(0, 20);
        products = productSearchCache[cacheKey];
      }

      // Apply NLP Semantic Filtering with robust safety fallback and custom rules
      const profile = nlpProfiles[ing];
      const customRule = customRules?.[ing];
      let filteredProducts = nlpFilterProducts(ing, products, profile, customRule);
      
      if (filteredProducts.length === 0 && products.length > 0) {
        logs.push(`${timestamp()} [Warning] NLP matching was too restrictive for "${ing}" at ${store.name}. Falling back to top search matches.`);
        filteredProducts = products;
      } else {
        const removedCount = products.length - filteredProducts.length;
        if (removedCount > 0) {
          logs.push(`${timestamp()} [NLP Filter] Cleaned up ${removedCount} inappropriate matches for "${ing}" at ${store.name}.`);
        }
      }

      // Query only the top 20 ingredients (slicing to top 20 items per search)
      const top20Products = filteredProducts.slice(0, 20);
      const requiredQty = quantities[ing] || "1 unit";

      // Store ALL products (not just NLP-passed) with cost details so client-side
      // manual overrides / custom rules can re-filter from the full set
      allFoundProducts[store.store_id][ing] = products.map(p => {
        const isMatched = filteredProducts.some(f => f.name === p.name);
        const details = calculatePortionDetails(requiredQty, p.units, p.price);
        return { ...p, is_matched: isMatched, purchase_cost: details.purchaseCost, portion_cost: details.portionCost, packs_needed: details.packsNeeded };
      });

      const matchedWithCosts = top20Products.map(p => {
        const details = calculatePortionDetails(requiredQty, p.units, p.price);
        return { ...p, ...details };
      });

      // Filter products that fit the category or match name (simple heuristic)
      // Sort primarily by portion cost to find the cheapest relevant item
      matchedWithCosts.sort((a, b) => a.portionCost - b.portionCost);
      const bestMatch = matchedWithCosts[0];

      if (bestMatch) {
        results.push({
          store_id: store.store_id,
          store: store.name,
          distance_km: store.distance_km,
          ingredient: ing,
          qty_required: requiredQty,
          name: bestMatch.name,
          brand: bestMatch.brand,
          price: bestMatch.price, // Pack price
          units: bestMatch.units,
          unit_label: bestMatch.unit_label,
          packs_needed: bestMatch.packsNeeded,
          purchase_cost: bestMatch.purchaseCost,
          portion_cost: bestMatch.portionCost,
          is_mock: isMock
        });
      }
    }
  }

  logs.push(`${timestamp()} Parsing portion sizes and unit metrics for optimal savings...`);

  // Build the comparison table & calculate metrics
  // Cheapest Single Store totals - only include stores that have ALL ingredients with valid prices
  const storeTotals: Record<string, { totalPurchase: number; totalPortion: number; itemsCount: number; distance_km: number; allIngredientsFound: boolean }> = {};
  nearbyStores.forEach(s => {
    storeTotals[s.name] = { totalPurchase: 0, totalPortion: 0, itemsCount: 0, distance_km: s.distance_km, allIngredientsFound: true };
  });

  // Track which ingredients were found at each store with valid prices
  const ingredientsFoundAtStore: Record<string, Set<string>> = {};
  nearbyStores.forEach(s => {
    ingredientsFoundAtStore[s.name] = new Set<string>();
  });

  results.forEach(r => {
    if (storeTotals[r.store] && r.purchase_cost > 0) {
      storeTotals[r.store].totalPurchase += r.purchase_cost;
      storeTotals[r.store].totalPortion += r.portion_cost;
      storeTotals[r.store].itemsCount += 1;
      ingredientsFoundAtStore[r.store].add(r.ingredient);
    }
  });

  // Mark stores that don't have ALL ingredients with valid prices
  const totalIngredients = ingredients.length;
  Object.keys(storeTotals).forEach(storeName => {
    if (ingredientsFoundAtStore[storeName].size < totalIngredients) {
      storeTotals[storeName].allIngredientsFound = false;
    }
  });

  // Only consider stores that have ALL ingredients for "Cheapest Single Store"
  const eligibleStores = Object.entries(storeTotals)
    .filter(([_, val]) => val.allIngredientsFound)
    .map(([name, val]) => ({
      store: name,
      total_purchase: parseFloat(val.totalPurchase.toFixed(2)),
      total_portion: parseFloat(val.totalPortion.toFixed(2)),
      items_found: val.itemsCount,
      distance_km: parseFloat(val.distance_km.toFixed(2)),
      all_ingredients_found: true
    }))
    .sort((a, b) => a.total_purchase - b.total_purchase);

  // Fallback: if no store has all ingredients, use all stores but mark them as incomplete
  const storesSummary = eligibleStores.length > 0 ? eligibleStores : Object.entries(storeTotals).map(([name, val]) => ({
    store: name,
    total_purchase: parseFloat(val.totalPurchase.toFixed(2)),
    total_portion: parseFloat(val.totalPortion.toFixed(2)),
    items_found: val.itemsCount,
    distance_km: parseFloat(val.distance_km.toFixed(2)),
    all_ingredients_found: val.allIngredientsFound
  })).sort((a, b) => a.total_purchase - b.total_purchase);

  const cheapestSingleStore = storesSummary[0] || { store: "N/A", total_purchase: 0, total_portion: 0, distance_km: 0, items_found: 0, all_ingredients_found: false };

  // Best case (mix stores) total
  let optimizedTotalPurchase = 0;
  let optimizedTotalPortion = 0;
  const optimizedMixList: any[] = [];

  ingredients.forEach(ing => {
    const ingMatches = results.filter(r => r.ingredient === ing);
    if (ingMatches.length > 0) {
      ingMatches.sort((a, b) => a.purchase_cost - b.purchase_cost);
      const best = ingMatches[0];
      optimizedTotalPurchase += best.purchase_cost;
      optimizedTotalPortion += best.portion_cost;
      optimizedMixList.push(best);
    }
  });

  optimizedTotalPurchase = parseFloat(optimizedTotalPurchase.toFixed(2));
  optimizedTotalPortion = parseFloat(optimizedTotalPortion.toFixed(2));

  const totalSavings = parseFloat((cheapestSingleStore.total_purchase - optimizedTotalPurchase).toFixed(2));
  const savingsPct = cheapestSingleStore.total_purchase > 0 
    ? parseFloat(((totalSavings / cheapestSingleStore.total_purchase) * 100).toFixed(1))
    : 0;

  logs.push(`${timestamp()} Optimization complete! Single-store cheapest: ${cheapestSingleStore.store} ($${cheapestSingleStore.total_purchase.toFixed(2)}).`);
  logs.push(`${timestamp()} Mix-store optimized total: $${optimizedTotalPurchase.toFixed(2)}. Potential Savings: $${totalSavings.toFixed(2)} (${savingsPct}%).`);

  // Use Gemini to generate a high-fidelity Optimizer Report
  let aiReport = "AI recommendation is ready.";
  
  const reportCacheKey = JSON.stringify({
    dish,
    servings: numServings,
    cheapestStore: cheapestSingleStore.store,
    optimizedTotalPurchase,
    ingredientNames: ingredients.join(','),
  });

  if (aiReportCache[reportCacheKey]) {
    aiReport = aiReportCache[reportCacheKey];
    logs.push(`${timestamp()} [Cache Hit] Loaded AI optimizer report from cache.`);
  } else if (ai) {
    try {
      logs.push(`${timestamp()} Generating smart portion matching report via Gemini...`);
      const payloadSummary = {
        dish,
        servings: numServings,
        ingredients: ingredients.map(ing => ({
          name: ing,
          required: quantities[ing] || "1 unit"
        })),
        cheapestSingleStore,
        optimizedMixStore: {
          total_purchase: optimizedTotalPurchase,
          total_portion: optimizedTotalPortion,
          items: optimizedMixList.map(item => ({
            ingredient: item.ingredient,
            selected_product: item.name,
            selected_units: item.units,
            packs_needed: item.packs_needed,
            purchase_cost: item.purchase_cost,
            portion_cost: item.portion_cost,
            store: item.store
          }))
        }
      };

      const systemMessage = `You are a culinary price optimization assistant. Your job is to write a highly professional, visually appealing markdown report that analyzes portion size optimization, discusses smart matches (e.g. buying 1kg vs 500g, or dealing with leftovers like eggs and cheese), and explains how to get the best value from Auckland Pak'nSave stores. Do not include introductory text, go straight to the report. Use professional formatting with bold accents and clean bullet points. Keep it under 250 words.`;

      const aiRes = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: `Review the following NZ meal cost dataset and write a portion-matching optimization analysis:\n\n${JSON.stringify(payloadSummary, null, 2)}`,
        config: {
          systemInstruction: systemMessage,
        },
      });

      aiReport = aiRes.text || "Report generated.";
      aiReportCache[reportCacheKey] = aiReport;
    } catch (err) {
      console.warn("AI Report generation failed:", err);
      aiReport = `### Portion Optimizer Insights
- **Smart Sizing**: Buying bulk portions (e.g., 1kg mince or 2L milk) yields a much lower unit price. Leftover portions can be frozen or repurposed for other meals.
- **Mix-Store Strategy**: By purchasing different items at nearby stores, you can save **$${totalSavings.toFixed(2)} (${savingsPct}%)** at the cost of traveling between locations.
- **Recipe Advice**: Use the unused portions of cheese and onions to make delicious sides or freeze them for next week's meal prep!`;
    }
  } else {
    aiReport = `### Portion Optimizer Insights
- **Smart Sizing**: Buying bulk portions (e.g., 1kg mince or 2L milk) yields a much lower unit price. Leftover portions can be frozen or repurposed for other meals.
- **Mix-Store Strategy**: By purchasing different items at nearby stores, you can save **$${totalSavings.toFixed(2)} (${savingsPct}%)** at the cost of traveling between locations.
- **Recipe Advice**: Use the unused portions of cheese and onions to make delicious sides or freeze them for next week's meal prep!`;
  }

  send({
    type: 'result',
    data: {
      userLat,
      userLon,
      nearbyStores,
      storesSummary,
      results,
      cheapestSingleStore,
      optimizedTotalPurchase,
      optimizedTotalPortion,
      totalSavings,
      savingsPct,
      aiReport,
      allFoundProducts,
      nlpProfiles
    }
  });
  res.end();
});


// Dynamic leftover and cooking chat assistant
app.post("/api/chat", async (req, res) => {
  const { message, history, dish, ingredients, results } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  if (!ai) {
    return res.json({
      reply: "The Gemini AI key is currently not configured, but I can tell you that the best way to utilize leftovers is to freeze them or incorporate them into a standard frittata or stir fry next week!"
    });
  }

  try {
    const formattedHistory = (history || []).map((h: any) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }]
    }));

    // Setup the system instruction explaining the context of the groceries found
    const systemInstruction = `You are a professional NZ culinary assistant helping the user cook "${dish}" and make the most out of their Pak'nSave grocery shopping.
Here is the shopping list they optimized: ${JSON.stringify(results || [], null, 2)}.
Answer their culinary questions, give tips for using unused portions (e.g. freezing cheese, storing leftover mince), and provide recipe advice. Keep answers friendly, professional, practical, and highly concise (under 150 words).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: [
        ...formattedHistory.map((h: any) => ({
          role: h.role,
          parts: [{ text: h.parts[0].text }]
        })),
        { role: "user", parts: [{ text: message }] }
      ],
      config: {
        systemInstruction,
      }
    });

    return res.json({ reply: response.text || "I'm here to help!" });
  } catch (err) {
    console.error("AI Chat failed:", err);
    return res.json({ reply: "I'm sorry, I'm having trouble connecting to my culinary brain right now. However, most leftover ingredients can be kept in airtight containers for 3-5 days!" });
  }
});


// ── FRONTEND INTEGRATION & MIDDLEWARE ──

const startServer = async () => {
  // If in production, serve built index.html
  if (process.env.NODE_ENV === "production" || process.env.VITE_PROD === "true") {
    console.log("Starting server in PRODUCTION mode...");
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  } else {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully listening on http://0.0.0.0:${PORT}`);
  });
};

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
