import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  MapPin, 
  Sparkles, 
  TrendingDown, 
  Compass, 
  DollarSign, 
  ShoppingBag, 
  ChefHat, 
  Plus, 
  Minus, 
  Info, 
  ListOrdered, 
  Navigation, 
  RefreshCw, 
  Sliders, 
  HelpCircle, 
  Activity, 
  Check, 
  AlertCircle, 
  Map as MapIcon,
  ChevronRight,
  MessageSquare,
  FileText,
  Send,
  User,
  ArrowRight,
  X,
  AlertTriangle
} from "lucide-react";
import { STORES } from "./data/stores";
import { DISHES, DISH_QUANTITIES } from "./data/dishes";

interface IngredientItem {
  name: string;
  qty: string;
}

export function findQuantity(name: string, quantities: Record<string, string>): string {
  const getFallback = (n: string) => {
    const lowerName = n.toLowerCase();
    if (lowerName.includes("mince") || lowerName.includes("chicken") || lowerName.includes("beef") || lowerName.includes("lamb") || lowerName.includes("pork") || lowerName.includes("meat") || lowerName.includes("fish")) {
      return "500g";
    }
    if (lowerName.includes("sauce") || lowerName.includes("cream") || lowerName.includes("milk") || lowerName.includes("oil") || lowerName.includes("stock") || lowerName.includes("coconut")) {
      return "400ml";
    }
    if (lowerName.includes("tomato") || lowerName.includes("bean") || lowerName.includes("can") || lowerName.includes("lentil") || lowerName.includes("chickpea")) {
      return "1 can (400g)";
    }
    if (lowerName.includes("pasta") || lowerName.includes("spaghetti") || lowerName.includes("noodle") || lowerName.includes("rice") || lowerName.includes("flour") || lowerName.includes("sugar") || lowerName.includes("cheese")) {
      return "400g";
    }
    if (lowerName.includes("onion") || lowerName.includes("garlic") || lowerName.includes("carrot") || lowerName.includes("potato") || lowerName.includes("egg")) {
      return "4 pieces";
    }
    return "250g";
  };

  if (!quantities) return getFallback(name);
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  
  let val = "";
  if (quantities[name]) {
    val = quantities[name];
  } else {
    for (const key of Object.keys(quantities)) {
      if (key.toLowerCase() === name.toLowerCase()) {
        val = quantities[key];
        break;
      }
    }
    if (!val) {
      for (const key of Object.keys(quantities)) {
        const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanKey === cleanName || cleanKey.includes(cleanName) || cleanName.includes(cleanKey)) {
          val = quantities[key];
          break;
        }
      }
    }
  }

  if (!val) {
    return getFallback(name);
  }

  const cleanVal = val.trim().toLowerCase();
  if (cleanVal === "1 unit" || cleanVal === "unit" || cleanVal === "1unit" || cleanVal.includes("unit")) {
    return getFallback(name);
  }

  return val;
}

export function scaleQuantity(qtyStr: string, fromServings: number, toServings: number): string {
  if (!qtyStr) return "";
  const ratio = toServings / fromServings;
  
  const numMatch = qtyStr.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (numMatch) {
    const num = parseFloat(numMatch[1]);
    const rest = numMatch[2] || "";
    const scaledNum = num * ratio;
    
    let formattedNum = scaledNum.toFixed(1);
    if (formattedNum.endsWith(".0")) {
      formattedNum = Math.round(scaledNum).toString();
    } else {
      formattedNum = parseFloat(scaledNum.toFixed(2)).toString();
    }
    
    return `${formattedNum} ${rest}`.trim();
  }
  
  const fractionMatch = qtyStr.match(/^(\d+)\/(\d+)\s*(.*)$/);
  if (fractionMatch) {
    const num = parseFloat(fractionMatch[1]) / parseFloat(fractionMatch[2]);
    const rest = fractionMatch[3] || "";
    const scaledNum = num * ratio;
    let formattedNum = parseFloat(scaledNum.toFixed(2)).toString();
    return `${formattedNum} ${rest}`.trim();
  }
  
  return qtyStr;
}

interface LogMessage {
  time: string;
  text: string;
}

interface AgentChatBubble {
  sender: "agent" | "user";
  text: string;
  timestamp: string;
}

const simpleIcon = divIcon({
  className: 'bg-orange-500 w-9 h-9 rounded-full border-2 border-white shadow-sm',
  iconSize: [24, 24],
  iconAnchor: [18, 18],
});

const userIcon = divIcon({
  className: 'bg-emerald-500 w-9 h-9 rounded-full border-2 border-white shadow-md flex items-center justify-center animate-pulse',
  iconSize: [24, 24],
  iconAnchor: [18, 18],
});

const getBrandBadgeStyle = (brand: string) => {
  const b = brand.toLowerCase().trim();
  if (b === 'pams') {
    return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  }
  if (b === 'value') {
    return 'bg-red-100 text-red-800 border-red-200';
  }
  if (b === 'anchor') {
    return 'bg-blue-100 text-blue-800 border-blue-200';
  }
  if (b === 'meadow fresh') {
    return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  }
  const colors = [
    'bg-slate-100 text-slate-800 border-slate-200',
    'bg-amber-100 text-amber-800 border-amber-200',
    'bg-teal-100 text-teal-800 border-teal-200',
    'bg-indigo-100 text-indigo-800 border-indigo-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-pink-100 text-pink-800 border-pink-200',
  ];
  let hash = 0;
  for (let idx = 0; idx < brand.length; idx++) {
    hash += brand.charCodeAt(idx);
  }
  return colors[hash % colors.length];
};

export default function App() {
  // Inputs state
  const [address, setAddress] = useState("Botany Town Centre, Auckland");
  const [showNewVersionModal, setShowNewVersionModal] = useState(true);

  // State for manual product overrides - persistent
  const [productOverrides, setProductOverrides] = useState<Record<string, 'include' | 'exclude'>>({});

  const toggleProductOverride = (productName: string, currentlyMatched: boolean) => {
    setProductOverrides(prev => {
      const next = { ...prev };
      // If currently matched (true), toggle to exclude.
      // If currently not matched (false), toggle to include.
      next[productName] = currentlyMatched ? 'exclude' : 'include';
      
      setTimeout(() => {
        recalculateLocalOptimization(customRules, next, optResults?.nlpProfiles || {});
      }, 0);

      return next;
    });
  };

  const resetProductOverride = (productName: string) => {
    setProductOverrides(prev => {
      const next = { ...prev };
      delete next[productName];

      setTimeout(() => {
        recalculateLocalOptimization(customRules, next, optResults?.nlpProfiles || {});
      }, 0);

      return next;
    });
  };

  // Helper to determine matched status, incorporating persistent manual overrides
  const getProductMatchedStatus = (p: any) => {
    const override = productOverrides[p.name];
    if (override) return override === 'include';
    return p.is_matched;
  };
  const [selectedDish, setSelectedDish] = useState("spaghetti bolognese");
  const [customDish, setCustomDish] = useState("");
  const [isCustomDish, setIsCustomDish] = useState(false);
  const [radius, setRadius] = useState(5);
  const [servings, setServings] = useState(4);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [baseIngredients, setBaseIngredients] = useState<IngredientItem[]>([]);
  
  // Guided Onboarding Agent State
  const [setupMode, setSetupMode] = useState<"agent" | "manual">("agent");
  const [agentStep, setAgentStep] = useState<"location" | "dish" | "distance" | "servings" | "review">("location");
  const [agentInput, setAgentInput] = useState("");
  const [agentHistory, setAgentHistory] = useState<AgentChatBubble[]>([
    {
      sender: "agent",
      text: "Kia ora! I am your AI grocery co-pilot. To optimize your meal's shopping basket, let's start with your location: Where are you shopping today? (Enter your suburb or address)",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // App UI State
  const [loading, setLoading] = useState(false);
  const [dishBuilderError, setDishBuilderError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [activeTab, setActiveTab] = useState<"matrix" | "tuner" | "recipe" | "ai" | "map" | "list">("matrix");
  const [recipe, setRecipe] = useState<any | null>(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [lastRecipeKey, setLastRecipeKey] = useState<string>("");
  
  // Results State
  const [optResults, setOptResults] = useState<any>(null);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string | null>(null);

  // AI Matching Fine-Tuning State
  const [customRules, setCustomRules] = useState<Record<string, { include: string; exclude: string; customPrompt: string }>>({});
  const [renderTrigger, setRenderTrigger] = useState(0);
  const [tuningIngredient, setTuningIngredient] = useState<string | null>(null);
  const [tuneIncludeTags, setTuneIncludeTags] = useState<string[]>([]);
  const [tuneExcludeTags, setTuneExcludeTags] = useState<string[]>([]);
  const [includeInput, setIncludeInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");
  const [tunePrompt, setTunePrompt] = useState("");
  const [btnAnimation, setBtnAnimation] = useState(false);
  const [customInstructionEvaluations, setCustomInstructionEvaluations] = useState<Record<string, Record<string, boolean>>>({});

  // Chat State
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "model"; text: string }>>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // References
  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const agentChatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  // Append logs function
  const addLog = (text: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, text }]);
  };

  // Recalculate optimization results and metrics instantly in the frontend based on priority of rules
  const recalculateLocalOptimization = (
    rules: Record<string, { include: string; exclude: string; customPrompt: string }>,
    overrides: Record<string, 'include' | 'exclude'>,
    nlpProfilesObj: any,
    customEvalsObj?: Record<string, Record<string, boolean>>
  ) => {
    if (!optResults || !optResults.allFoundProducts || !optResults.nearbyStores) return;

    const timestamp = () => `[${new Date().toLocaleTimeString()}]`;
    addLog(`⚡ Starting local real-time smart refiltering...`);

    const results: any[] = [];

    // For each store and ingredient, we want to find the best match under the current rules
    optResults.nearbyStores.forEach((store: any) => {
      ingredients.forEach((ing) => {
        const rawProducts = optResults.allFoundProducts[store.store_id]?.[ing.name] || [];
        const profile = nlpProfilesObj[ing.name];
        const rule = rules[ing.name];

        // Filter products according to priority:
        // 1. Manual Overrides
        // 2. Custom Gemini Instructions (Individual true/false API evaluation)
        // 3. Exclusions (Comma-separated custom exclusion list)
        // 4. Inclusions (Comma-separated custom inclusion list)
        // 5. Baseline AI NLP Profile
        
        let filtered = rawProducts.filter((p: any) => {
          const override = overrides[p.name];
          if (override === 'include') return true;
          if (override === 'exclude') return false;

          const pNameLower = p.name.toLowerCase();
          const brandLower = (p.brand || "").toLowerCase();
          const fullText = `${pNameLower} ${brandLower}`;

          // Priority 2: Custom Gemini Instructions (evaluated true/false individually)
          if (rule?.customPrompt) {
            const evals = customEvalsObj ? customEvalsObj[ing.name] : customInstructionEvaluations[ing.name];
            if (evals && evals[p.name] !== undefined) {
              if (!evals[p.name]) {
                return false;
              }
            }
          }

          // Priority 3: Exclusions (custom exclusion rules)
          if (rule?.exclude) {
            const excludeKeywords = rule.exclude.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
            for (const kw of excludeKeywords) {
              if (pNameLower.includes(kw) || brandLower.includes(kw)) {
                return false;
              }
            }
          }

          // Priority 4: Inclusions (custom inclusion rules)
          if (rule?.include) {
            const includeKeywords = rule.include.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
            if (includeKeywords.length > 0) {
              const matchedInclude = includeKeywords.some((kw: string) => pNameLower.includes(kw) || brandLower.includes(kw));
              if (!matchedInclude) {
                return false;
              }
            }
          }

          // Priority 5: Baseline AI NLP Profile (represented by positive/negative keywords)
          if (profile) {
            const positiveKeywords = (profile.positive_keywords || []).map((w: any) => w.toLowerCase()).filter(Boolean);
            const negativeKeywords = (profile.negative_keywords || []).map((w: any) => w.toLowerCase()).filter(Boolean);

            // Strict Negative Keyword Check
            const ingLower = ing.name.toLowerCase();
            for (const neg of negativeKeywords) {
              if (fullText.includes(neg) && !ingLower.includes(neg)) {
                return false;
              }
            }

            // Strict Positive Keyword Check
            if (positiveKeywords.length > 0) {
              const matchedCount = positiveKeywords.filter((k: string) => fullText.includes(k)).length;
              if (matchedCount === 0) {
                const hasSynonym = (profile.allowed_synonyms || []).some((syn: string) => syn && fullText.includes(syn.toLowerCase()));
                if (!hasSynonym) {
                  return false;
                }
              }
            }
          }

          return true;
        });

        // Detailed console logging for the terminal logs
        if (rule) {
          if (rule.exclude) {
            const excludeKeywords = rule.exclude.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
            excludeKeywords.forEach((kw: string) => {
              const excludedProducts = rawProducts.filter((p: any) => {
                const pNameLower = p.name.toLowerCase();
                const brandLower = (p.brand || "").toLowerCase();
                return pNameLower.includes(kw) || brandLower.includes(kw);
              });
              if (excludedProducts.length > 0) {
                addLog(`[Filter Action] Excluding product containing '${kw}' from ingredient '${ing.name}' at ${store.name} (Filtered out: '${excludedProducts[0].name}').`);
              }
            });
          }

          if (rule.include) {
            addLog(`[Filter Action] Applying custom inclusion keywords [${rule.include}] for ingredient '${ing.name}' at ${store.name}.`);
          }
        }

        rawProducts.forEach((p: any) => {
          const override = overrides[p.name];
          if (override) {
            addLog(`[Manual Override] Force-${override === 'include' ? 'including' : 'excluding'} product '${p.name}' for ingredient '${ing.name}' at ${store.name}.`);
          }
        });

        // If all filtered out, fall back to avoid blank states
        if (filtered.length === 0 && rawProducts.length > 0) {
          filtered = rawProducts;
        }

        // Sort by portion cost to find the cheapest match
        const sorted = [...filtered].sort((a, b) => a.portion_cost - b.portion_cost);
        const bestMatch = sorted[0];

        if (bestMatch) {
          results.push({
            store_id: store.store_id,
            store: store.name,
            distance_km: store.distance_km,
            ingredient: ing.name,
            qty_required: ing.qty,
            name: bestMatch.name,
            brand: bestMatch.brand,
            price: bestMatch.price,
            units: bestMatch.units,
            unit_label: bestMatch.unit_label || "",
            packs_needed: bestMatch.packs_needed || 1,
            purchase_cost: bestMatch.purchase_cost,
            portion_cost: bestMatch.portion_cost,
            is_mock: bestMatch.is_mock
          });
        }
      });
    });

    // Build comparison metrics
    const storeTotals: Record<string, { totalPurchase: number; totalPortion: number; itemsCount: number; distance_km: number; allIngredientsFound: boolean }> = {};
    optResults.nearbyStores.forEach((s: any) => {
      storeTotals[s.name] = { totalPurchase: 0, totalPortion: 0, itemsCount: 0, distance_km: s.distance_km, allIngredientsFound: true };
    });

    const ingredientsFoundAtStore: Record<string, Set<string>> = {};
    optResults.nearbyStores.forEach((s: any) => {
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

    const totalIngredients = ingredients.length;
    Object.keys(storeTotals).forEach(storeName => {
      if (ingredientsFoundAtStore[storeName].size < totalIngredients) {
        storeTotals[storeName].allIngredientsFound = false;
      }
    });

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

    const storesSummary = eligibleStores.length > 0 ? eligibleStores : Object.entries(storeTotals).map(([name, val]) => ({
      store: name,
      total_purchase: parseFloat(val.totalPurchase.toFixed(2)),
      total_portion: parseFloat(val.totalPortion.toFixed(2)),
      items_found: val.itemsCount,
      distance_km: parseFloat(val.distance_km.toFixed(2)),
      all_ingredients_found: val.allIngredientsFound
    })).sort((a, b) => a.total_purchase - b.total_purchase);

    const cheapestSingleStore = storesSummary[0] || { store: "N/A", total_purchase: 0, total_portion: 0, distance_km: 0, items_found: 0, all_ingredients_found: false };

    // Multi-Store Optimal
    let optimizedTotalPurchase = 0;
    let optimizedTotalPortion = 0;

    ingredients.forEach(ing => {
      const ingMatches = results.filter(r => r.ingredient === ing.name);
      if (ingMatches.length > 0) {
        ingMatches.sort((a, b) => a.purchase_cost - b.purchase_cost);
        const best = ingMatches[0];
        optimizedTotalPurchase += best.purchase_cost;
        optimizedTotalPortion += best.portion_cost;
      }
    });

    optimizedTotalPurchase = parseFloat(optimizedTotalPurchase.toFixed(2));
    optimizedTotalPortion = parseFloat(optimizedTotalPortion.toFixed(2));

    const totalSavings = parseFloat((cheapestSingleStore.total_purchase - optimizedTotalPurchase).toFixed(2));
    const savingsPct = cheapestSingleStore.total_purchase > 0 
      ? parseFloat(((totalSavings / cheapestSingleStore.total_purchase) * 100).toFixed(1))
      : 0;

    addLog(`[Refiltered Results] Single-store cheapest: ${cheapestSingleStore.store} ($${cheapestSingleStore.total_purchase.toFixed(2)}).`);
    addLog(`[Refiltered Results] Optimized mix-store total: $${optimizedTotalPurchase.toFixed(2)}. Potential Savings: $${totalSavings.toFixed(2)} (${savingsPct}%).`);

    // Update product matching status recursively
    const updatedAllFoundProducts = { ...optResults.allFoundProducts };
    optResults.nearbyStores.forEach((store: any) => {
      ingredients.forEach((ing) => {
        const rawProducts = optResults.allFoundProducts[store.store_id]?.[ing.name] || [];
        const profile = nlpProfilesObj[ing.name];
        const rule = rules[ing.name];

        updatedAllFoundProducts[store.store_id][ing.name] = rawProducts.map((p: any) => {
          const override = overrides[p.name];
          let matched = p.is_matched;
          if (override === 'include') matched = true;
          else if (override === 'exclude') matched = false;
          else {
            const pNameLower = p.name.toLowerCase();
            const brandLower = (p.brand || "").toLowerCase();
            const fullText = `${pNameLower} ${brandLower}`;

            // Priority 2: Custom Gemini Instructions
            if (rule?.customPrompt) {
              const evals = customEvalsObj ? customEvalsObj[ing.name] : customInstructionEvaluations[ing.name];
              if (evals && evals[p.name] !== undefined) {
                if (!evals[p.name]) {
                  matched = false;
                }
              }
            }

            // Priority 5: Baseline AI NLP Profile
            if (profile) {
              const positiveKeywords = (profile.positive_keywords || []).map((w: any) => w.toLowerCase()).filter(Boolean);
              const negativeKeywords = (profile.negative_keywords || []).map((w: any) => w.toLowerCase()).filter(Boolean);
              const ingLower = ing.name.toLowerCase();

              for (const neg of negativeKeywords) {
                if (fullText.includes(neg) && !ingLower.includes(neg)) {
                  matched = false;
                }
              }
              if (positiveKeywords.length > 0) {
                const matchedCount = positiveKeywords.filter((k: string) => fullText.includes(k)).length;
                if (matchedCount === 0) {
                  const hasSynonym = (profile.allowed_synonyms || []).some((syn: string) => syn && fullText.includes(syn.toLowerCase()));
                  if (!hasSynonym) {
                    matched = false;
                  }
                }
              }
            }

            // Priority 3: Exclusions
            if (rule?.exclude) {
              const excludeKeywords = rule.exclude.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
              if (excludeKeywords.some((kw: string) => pNameLower.includes(kw) || brandLower.includes(kw))) {
                matched = false;
              }
            }
            // Priority 4: Inclusions
            if (rule?.include) {
              const includeKeywords = rule.include.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
              if (includeKeywords.length > 0) {
                const matchedInclude = includeKeywords.some((kw: string) => pNameLower.includes(kw) || brandLower.includes(kw));
                if (!matchedInclude) {
                  matched = false;
                }
              }
            }
          }
          return { ...p, is_matched: matched };
        });
      });
    });

    setOptResults((prev: any) => ({
      ...prev,
      results,
      storesSummary,
      cheapestSingleStore,
      optimizedTotalPurchase,
      optimizedTotalPortion,
      totalSavings,
      savingsPct,
      allFoundProducts: updatedAllFoundProducts,
      nlpProfiles: nlpProfilesObj
    }));

    addLog("✅ Real-time local filtering and recalculations completed successfully!");
  };

  // Scroll logs to bottom within their own container
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // useEffect(() => {
  //   agentChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  // }, [agentHistory]);

  useEffect(() => {
  if (chatContainerRef.current) {
    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
  }
  }, [agentHistory]);


  // Handle address geocoding & auto GPS
  const detectGPS = () => {
    addLog("Requesting GPS coordinates from browser...");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          addLog(`GPS match successful: (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`);
          const gpsAddr = `GPS Position (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
          setAddress(gpsAddr);
          
          if (setupMode === "agent" && agentStep === "location") {
            handleAgentInputSubmit(gpsAddr);
          } else {
            runOptimizationDirect(latitude, longitude, gpsAddr);
          }
        },
        (err) => {
          addLog(`GPS access denied or timed out (${err.message}). Using manual address instead.`);
        }
      );
    } else {
      addLog("GPS Geolocation is not supported by this browser.");
    }
  };

  // Fetch ingredients for selected dish
  const loadIngredients = async (dishToLoad?: any) => {
    const dishName = (typeof dishToLoad === "string" && dishToLoad.trim()) 
      ? dishToLoad.trim() 
      : (isCustomDish ? customDish.trim() : selectedDish);
    if (!dishName) return;

    setLoading(true);
    setDishBuilderError(null);
    addLog(`Analyzing recipe composition for "${dishName}" (base servings: 4)...`);
    try {
      const res = await fetch("/api/dish-ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dish: dishName, servings: 4 })
      });
      if (res.ok) {
        const data = await res.json();
        const list: IngredientItem[] = data.ingredients.map((name: string) => ({
          name,
          qty: findQuantity(name, data.quantities)
        }));
        setBaseIngredients(list);
        addLog(`Recipe parsed successfully. Found ${list.length} key ingredients.`);
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || `Failed to analyze recipe for "${dishName}".`;
        setDishBuilderError(errMsg);
        addLog(`Error: ${errMsg}`);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setDishBuilderError(`Network error while breaking down "${dishName}": ${errMsg}`);
      addLog(`Failed to breakdown dish: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // Sync ingredients when servings scale changes
  useEffect(() => {
    if (baseIngredients.length > 0) {
      const scaledList = baseIngredients.map(item => ({
        name: item.name,
        qty: scaleQuantity(item.qty, 4, servings)
      }));
      setIngredients(scaledList);
    }
  }, [servings, baseIngredients]);

  const fetchRecipeIfNeeded = async () => {
    const currentDish = isCustomDish ? customDish : selectedDish;
    if (!currentDish || ingredients.length === 0) return;
    
    const key = `${currentDish.toLowerCase().trim()}-${servings}-${JSON.stringify(ingredients)}`;
    if (key === lastRecipeKey && recipe) return;

    setRecipeLoading(true);
    try {
      const res = await fetch("/api/generate-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish: currentDish,
          servings: servings,
          ingredients: ingredients.map(i => ({ name: i.name, qty: i.qty }))
        })
      });
      if (res.ok) {
        const data = await res.json();
        setRecipe(data);
        setLastRecipeKey(key);
      }
    } catch (err) {
      console.error("Error loading recipe:", err);
    } finally {
      setRecipeLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "recipe") {
      fetchRecipeIfNeeded();
    }
  }, [activeTab, ingredients, servings]);

  // Initial trigger
  useEffect(() => {
    runOptimization();
  }, []);

  // Run full optimization pipeline
  const runOptimization = async (overrideRules?: any) => {
    if (loading) return;
    setLoading(true);
    addLog(`Resolving address coordinates for "${address}"...`);

    try {
      const geoRes = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
      let lat = -36.9294911;
      let lon = 174.9139646;
      let resolvedAddress = address;

      if (geoRes.ok) {
        const geoData = await geoRes.json();
        lat = geoData.lat;
        lon = geoData.lon;
        resolvedAddress = geoData.display_name || address;
        addLog(`Verified location: ${resolvedAddress}`);
      }

      const dishName = isCustomDish ? customDish : selectedDish;
      const ingList = ingredients.map(i => i.name);
      const qtyMap: Record<string, string> = {};
      ingredients.forEach(i => {
        qtyMap[i.name] = i.qty;
      });

      const rulesToSend = overrideRules !== undefined ? overrideRules : customRules;

      // Helper to safely stringify and avoid circular references
      const safeStringify = (obj: any): string => {
        const seen = new WeakSet();
        return JSON.stringify(obj, (key, value) => {
          if (typeof value === "object" && value !== null) {
            // Avoid circular
            if (seen.has(value)) return undefined;
            seen.add(value);

            // Avoid DOM nodes / Window / Document / Cross-origin objects
            try {
              if (value instanceof Element || value instanceof Node || value === window || value === document) {
                return undefined;
              }
            } catch (e) {
              // If accessing instanceof throws (cross-origin), assume it's risky and skip
              return undefined;
            }
          }
          return value;
        });
      };

      addLog(`Sending optimization payload to server. Ingredients: ${ingList.length}...`);
      
      const optRes = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: safeStringify({
          address: resolvedAddress,
          lat,
          lon,
          dish: dishName,
          radius,
          servings,
          ingredients: ingList,
          quantities: qtyMap,
          customRules: rulesToSend
        })
      });

      if (optRes.ok && optRes.body) {
        const reader = optRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value);
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const msg = JSON.parse(line);
            if (msg.type === 'log') {
              addLog(msg.message.replace(/^\[.*?\]\s*/, ""));
            } else if (msg.type === 'result') {
              setOptResults(msg.data);
            }
          }
        }
        addLog("✅ PORTION OPTIMIZATION PIPELINE COMPLETED SUCCESSFULLY!");
      } else {
        let errorMsg = "Backend optimization server returned a failure state.";
        try {
          const errorData = await optRes.json();
          if (errorData.message) errorMsg = errorData.message;
        } catch {
          const errorText = await optRes.text();
          if (errorText) errorMsg = errorText;
        }
        addLog(`Error: ${errorMsg} (Status: ${optRes.status})`);
      }
    } catch (err) {
      console.error(err);
      addLog(`Critical failure connecting to full-stack optimizer service: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Direct optimization with pre-defined lat/lon (e.g. from GPS)
  const runOptimizationDirect = async (lat: number, lon: number, customAddr: string) => {
    setLoading(true);
    try {
      const dishName = isCustomDish ? customDish : selectedDish;
      const ingList = ingredients.map(i => i.name);
      const qtyMap: Record<string, string> = {};
      ingredients.forEach(i => {
        qtyMap[i.name] = i.qty;
      });

      addLog(`Launching optimizer with direct GPS coordinates...`);

      const optRes = await fetch("/api/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: customAddr,
          lat,
          lon,
          dish: dishName,
          radius,
          servings,
          ingredients: ingList,
          quantities: qtyMap,
          customRules
        })
      });

      if (optRes.ok) {
        const data = await optRes.json();
        setOptResults(data);
        if (data.logs) {
          data.logs.forEach((logLine: string) => {
            const cleanLine = logLine.replace(/^\[.*?\]\s*/, "");
            addLog(cleanLine);
          });
        }
        addLog("✅ GPS OPTIMIZATION COMPLETED SUCCESSFULLY!");
      }
    } catch (err) {
      addLog("Failed to complete GPS direct optimization.");
    } finally {
      setLoading(false);
    }
  };

  // AI Match Tuning Helpers
  const selectTuningIngredient = (ingName: string) => {
    setTuningIngredient(ingName);
    const existing = customRules[ingName] || { include: "", exclude: "", customPrompt: "" };
    
    // Parse the comma-separated strings into tag arrays
    const includes = existing.include ? existing.include.split(',').map(s => s.trim()).filter(Boolean) : [];
    const excludes = existing.exclude ? existing.exclude.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    setTuneIncludeTags(includes);
    setTuneExcludeTags(excludes);
    setIncludeInput("");
    setExcludeInput("");
    setTunePrompt(existing.customPrompt);
  };

  const commitIncludeTag = () => {
    const val = includeInput.trim();
    if (val) {
      const tags = val.split(/[,\n;]+/).map(t => t.trim()).filter(Boolean);
      setTuneIncludeTags(prev => {
        const next = [...prev];
        tags.forEach(tag => {
          if (!next.includes(tag)) {
            next.push(tag);
          }
        });
        return next;
      });
    }
    setIncludeInput("");
  };

  const commitExcludeTag = () => {
    const val = excludeInput.trim();
    if (val) {
      const tags = val.split(/[,\n;]+/).map(t => t.trim()).filter(Boolean);
      setTuneExcludeTags(prev => {
        const next = [...prev];
        tags.forEach(tag => {
          if (!next.includes(tag)) {
            next.push(tag);
          }
        });
        return next;
      });
    }
    setExcludeInput("");
  };

  const applyCustomRulesForIngredient = async (ingName: string) => {
    // If there is still text typed but not yet committed as a tag, treat it as a tag
    let finalIncludes = [...tuneIncludeTags];
    if (includeInput.trim()) {
      const val = includeInput.trim();
      if (!finalIncludes.includes(val)) {
        finalIncludes.push(val);
      }
    }

    let finalExcludes = [...tuneExcludeTags];
    if (excludeInput.trim()) {
      const val = excludeInput.trim();
      if (!finalExcludes.includes(val)) {
        finalExcludes.push(val);
      }
    }

    const includeStr = finalIncludes.join(',');
    const excludeStr = finalExcludes.join(',');

    addLog(`Applying custom rules for "${ingName}" without restarting the pipeline...`);
    setBtnAnimation(true);
    setTimeout(() => setBtnAnimation(false), 2000);
    setRenderTrigger(prev => prev + 1);

    const updatedRule = {
      include: includeStr,
      exclude: excludeStr,
      customPrompt: tunePrompt
    };

    const updatedRules = {
      ...customRules,
      [ingName]: updatedRule
    };
    setCustomRules(updatedRules);

    // Update local states to commit the tags
    setTuneIncludeTags(finalIncludes);
    setTuneExcludeTags(finalExcludes);
    setIncludeInput("");
    setExcludeInput("");

    // If custom instructions (customPrompt) are specified, call our brand new individual evaluation API
    if (tunePrompt.trim()) {
      addLog(`[Gemini custom instructions] Extracting products for "${ingName}" to individually evaluate them...`);
      const allProductsForIngName: any[] = [];
      const seenProductNames = new Set<string>();

      if (optResults && optResults.allFoundProducts && optResults.nearbyStores) {
        optResults.nearbyStores.forEach((store: any) => {
          const storeProducts = optResults.allFoundProducts[store.store_id]?.[ingName] || [];
          storeProducts.forEach((p: any) => {
            if (!seenProductNames.has(p.name)) {
              seenProductNames.add(p.name);
              allProductsForIngName.push({
                name: p.name,
                brand: p.brand,
                units: p.units,
                price: p.price
              });
            }
          });
        });
      }

      addLog(`[Gemini custom instructions] Found ${allProductsForIngName.length} unique products. Calling Gemini API to individually filter by instruction: "${tunePrompt}"...`);
      setLoading(true);
      try {
        const evaluateRes = await fetch("/api/evaluate-custom-instruction", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ingredient: ingName,
            customInstruction: tunePrompt,
            products: allProductsForIngName
          })
        });

        if (evaluateRes.ok) {
          const evaluationMap = await evaluateRes.json();
          
          // Compute updated evaluations
          const nextEvaluations = {
            ...customInstructionEvaluations,
            [ingName]: evaluationMap
          };
          setCustomInstructionEvaluations(nextEvaluations);

          const matchedCount = Object.values(evaluationMap).filter(Boolean).length;
          addLog(`[Gemini custom instructions] individual product filter complete! ${matchedCount} / ${allProductsForIngName.length} products matched custom rules.`);
          
          recalculateLocalOptimization(updatedRules, productOverrides, optResults?.nlpProfiles || {}, nextEvaluations);
        } else {
          addLog(`[Error] Failed to fetch updated Gemini product evaluations for "${ingName}". Using local keywords only.`);
          recalculateLocalOptimization(updatedRules, productOverrides, optResults?.nlpProfiles || {});
        }
      } catch (err) {
        addLog(`[Error] Failed to fetch updated Gemini product evaluations for "${ingName}": ${err instanceof Error ? err.message : String(err)}`);
        recalculateLocalOptimization(updatedRules, productOverrides, optResults?.nlpProfiles || {});
      } finally {
        setLoading(false);
      }
    } else {
      // For immediate inclusions/exclusions/overrides, run local refiltering instantly
      recalculateLocalOptimization(updatedRules, productOverrides, optResults?.nlpProfiles || {});
    }
  };

  const resetCustomRulesForIngredient = (ingName: string) => {
    const updatedRules = { ...customRules };
    delete updatedRules[ingName];
    setCustomRules(updatedRules);
    setTuneIncludeTags([]);
    setTuneExcludeTags([]);
    setIncludeInput("");
    setExcludeInput("");
    setTunePrompt("");
    
    // Clear evaluations as well
    const nextEvaluations = { ...customInstructionEvaluations };
    delete nextEvaluations[ingName];
    setCustomInstructionEvaluations(nextEvaluations);

    addLog(`Resetting custom filters for "${ingName}" to default NLP heuristics.`);
    
    // Fetch default clean profile in background if we had a custom instruction, otherwise just recalculate
    if (optResults?.nlpProfiles?.[ingName]) {
      setLoading(true);
      fetch("/api/nlp-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dish: isCustomDish ? customDish : selectedDish,
          ingredient: ingName,
          quantity: ingredients.find(i => i.name === ingName)?.qty || "1 unit"
        })
      })
      .then(res => res.json())
      .then(profile => {
        const nextNlpProfiles = {
          ...(optResults?.nlpProfiles || {}),
          [ingName]: profile
        };
        recalculateLocalOptimization(updatedRules, productOverrides, nextNlpProfiles, nextEvaluations);
      })
      .catch(() => {
        recalculateLocalOptimization(updatedRules, productOverrides, optResults?.nlpProfiles || {}, nextEvaluations);
      })
      .finally(() => {
        setLoading(false);
      });
    } else {
      recalculateLocalOptimization(updatedRules, productOverrides, optResults?.nlpProfiles || {}, nextEvaluations);
    }
  };

  const updateIngredientName = (index: number, newName: string) => {
    const updated = [...ingredients];
    updated[index].name = newName;
    setIngredients(updated);
    
    const updatedBase = [...baseIngredients];
    if (updatedBase[index]) {
      updatedBase[index].name = newName;
      setBaseIngredients(updatedBase);
    }
  };

  // Modify ingredient list dynamically before run
  const updateIngredientQty = (index: number, newQty: string) => {
    const updated = [...ingredients];
    updated[index].qty = newQty;
    setIngredients(updated);

    const updatedBase = [...baseIngredients];
    if (updatedBase[index]) {
      updatedBase[index].qty = scaleQuantity(newQty, servings, 4);
      setBaseIngredients(updatedBase);
    }
    addLog(`Updated ingredient "${updated[index].name}" portion size to: "${newQty}"`);
  };

  const removeIngredient = (index: number) => {
    const removed = ingredients[index];
    setIngredients(ingredients.filter((_, i) => i !== index));
    setBaseIngredients(baseIngredients.filter((_, i) => i !== index));
    addLog(`Removed ingredient "${removed.name}" from current comparison list.`);
  };

  const addCustomIngredient = () => {
    const newItem = { name: "", qty: "500g" };
    setIngredients(prev => [...prev, newItem]);
    setBaseIngredients(prev => [...prev, newItem]);
    addLog(`Spawned new empty ingredient row.`);
  };

  // Agent Chat Onboarding Pipeline
  const handleAgentInputSubmit = (forcedVal?: string) => {
    const text = forcedVal || agentInput.trim();
    if (!text && agentStep !== "servings") return;
    setAgentInput("");

    // Add user message
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedHistory: AgentChatBubble[] = [...agentHistory, { sender: "user" as const, text, timestamp }];
    setAgentHistory(updatedHistory);

    // Process step
    if (agentStep === "location") {
      setAddress(text);
      addLog(`Agent Onboarding Location set to: "${text}"`);
      
      setAgentHistory([
        ...updatedHistory,
        {
          sender: "agent" as const,
          text: `Sweet! I've marked your location as **${text}**. \n\nNext, what delicious meal are we cooking today? You can select a preset recipe like **Spaghetti Bolognese** or **Chicken Stir Fry**, or type any custom dish you can dream of!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setAgentStep("dish");
    } 
    else if (agentStep === "dish") {
      const lower = text.toLowerCase();
      let dishToFetch = text;
      if (DISHES[lower]) {
        setSelectedDish(lower);
        setIsCustomDish(false);
        dishToFetch = lower;
      } else {
        setCustomDish(text);
        setIsCustomDish(true);
      }
      addLog(`Agent Onboarding Dish target set to: "${text}"`);
      
      // Trigger ingredient loading immediately
      loadIngredients(dishToFetch);

      setAgentHistory([
        ...updatedHistory,
        {
          sender: "agent" as const,
          text: `Awesome choice! I'm fetching the core recipe ingredients for **${text}**. \n\nHow far are you willing to travel to get the best prices at nearby Pak'nSave outlets? (Specify your maximum search radius in kilometers)`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setAgentStep("distance");
    } 
    else if (agentStep === "distance") {
      const num = parseInt(text.replace(/[^0-9]/g, ""));
      const validRadius = isNaN(num) ? 5 : Math.max(2, Math.min(8, num));
      setRadius(validRadius);
      addLog(`Agent Onboarding Travel radius set to: ${validRadius}km`);

      setAgentHistory([
        ...updatedHistory,
        {
          sender: "agent" as const,
          text: `Understood, searching within a **${validRadius}km** radius. \n\nNow, how many portion servings are we preparing? I will automatically scale the raw ingredients to match your group size perfectly!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setAgentStep("servings");
    } 
    else if (agentStep === "servings") {
      addLog(`Agent Onboarding Portion servings set to: ${servings} people`);

      setAgentHistory([
        ...updatedHistory,
        {
          sender: "agent" as const,
          text: `Excellent! I have successfully generated and scaled the ingredient portion list for **${servings} people**. \n\nReview your active shopping list below. You can modify any individual portion size, add custom ingredients, or click the **Run Optimizer** button to find the absolute cheapest combination of stores!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setAgentStep("review");
    }
  };

  const resetAgentGuidedSetup = () => {
    setAgentStep("location");
    setAgentHistory([
      {
        sender: "agent",
        text: "Kia ora! I am your AI grocery co-pilot. Let's start fresh: Where are you located? (Enter your suburb or address)",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    addLog("Agent onboarding wizard reset.");
  };

  // Send message to AI Recipe Assistant (Q&A Chat)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatLoading) return;

    const userMsg = chatMessage.trim();
    setChatMessage("");
    setChatHistory(prev => [...prev, { role: "user", text: userMsg }]);
    setChatLoading(true);

    try {
      const dishName = isCustomDish ? customDish : selectedDish;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          history: chatHistory,
          dish: dishName,
          ingredients: ingredients,
          results: optResults ? optResults.results : []
        })
      });

      if (res.ok) {
        const data = await res.json();
        setChatHistory(prev => [...prev, { role: "model", text: data.reply }]);
      } else {
        setChatHistory(prev => [...prev, { role: "model", text: "I'm sorry, I'm having trouble responding right now. Please try again!" }]);
      }
    } catch (err) {
      setChatHistory(prev => [...prev, { role: "model", text: "Failed to connect to AI server. Please check your internet connection." }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Clean Markdown formatter helper for the AI Report
  const renderAIReport = (markdownText: string) => {
    if (!markdownText) return <p className="text-xs text-slate-400">Analyzing data...</p>;
    
    // Ensure there is always a blank line before and after a table block to force standard GFM parsing
    let processedText = markdownText
      .replace(/([^\n])\n\|/g, "$1\n\n|")
      .replace(/\|\n([^\n|])/g, "|\n\n$1");

    return (
      <div className="markdown-body prose prose-slate max-w-none text-xs text-slate-700 leading-relaxed">
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ children, ...props }: any) => <h1 {...props} className="text-lg font-bold text-slate-950 mt-6 mb-3 border-b border-slate-200 pb-1">{children}</h1>,
            h2: ({ children, ...props }: any) => <h2 {...props} className="text-md font-bold text-slate-900 mt-5 mb-2 border-b border-slate-100 pb-1">{children}</h2>,
            h3: ({ children, ...props }: any) => <h3 {...props} className="text-sm font-bold text-slate-800 mt-4 mb-2">{children}</h3>,
            h4: ({ children, ...props }: any) => <h4 {...props} className="text-xs font-bold text-slate-700 mt-3 mb-1">{children}</h4>,
            p: ({ children, ...props }: any) => <p {...props} className="text-xs text-slate-600 my-2 leading-relaxed">{children}</p>,
            ul: ({ children, ...props }: any) => <ul {...props} className="list-disc pl-5 my-2 space-y-1">{children}</ul>,
            ol: ({ children, ...props }: any) => <ol {...props} className="list-decimal pl-5 my-2 space-y-1">{children}</ol>,
            li: ({ children, ...props }: any) => <li {...props} className="text-xs text-slate-600 leading-relaxed mb-0.5">{children}</li>,
            strong: ({ children, ...props }: any) => <strong {...props} className="font-bold text-slate-800">{children}</strong>,
            em: ({ children, ...props }: any) => <em {...props} className="italic text-slate-600">{children}</em>,
            blockquote: ({ children, ...props }: any) => <blockquote {...props} className="border-l-4 border-slate-200 pl-4 italic text-slate-500 my-2">{children}</blockquote>,
            code: ({ children, ...props }: any) => <code {...props} className="font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-800">{children}</code>,
            table: ({ children, ...props }: any) => (
              <div className="overflow-x-auto my-4 border border-slate-200 rounded-lg shadow-2xs">
                <table {...props} className="min-w-full divide-y divide-slate-200 text-xs text-left">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children, ...props }: any) => <thead {...props} className="bg-slate-50">{children}</thead>,
            tbody: ({ children, ...props }: any) => <tbody {...props} className="divide-y divide-slate-100 bg-white">{children}</tbody>,
            tr: ({ children, ...props }: any) => <tr {...props} className="hover:bg-slate-50/50 transition-colors">{children}</tr>,
            th: ({ children, ...props }: any) => <th {...props} className="px-3 py-2 font-bold text-slate-800 border-b border-slate-200 text-[10px] uppercase tracking-wider">{children}</th>,
            td: ({ children, ...props }: any) => <td {...props} className="px-3 py-2 text-slate-600 text-[11px] font-medium">{children}</td>,
          }}
        >
          {processedText}
        </Markdown>
      </div>
    );
  };

  // Group matched ingredients by store for checklist
  const getGroupedShoppingList = () => {
    if (!optResults || !optResults.results) return [];
    
    const storeMap: Record<string, { storeName: string; distance: number; items: any[] }> = {};
    
    ingredients.forEach(ing => {
      const matches = optResults.results.filter((r: any) => r.ingredient === ing.name);
      if (matches.length > 0) {
        matches.sort((a: any, b: any) => a.purchase_cost - b.purchase_cost);
        const best = matches[0];
        
        if (!storeMap[best.store]) {
          storeMap[best.store] = {
            storeName: best.store,
            distance: best.distance_km,
            items: []
          };
        }
        storeMap[best.store].items.push(best);
      }
    });

    return Object.values(storeMap);
  };

  // Shopping List Checkboxes
  const [completedShoppingItems, setCompletedShoppingItems] = useState<Record<string, boolean>>({});
  const toggleShoppingItem = (id: string) => {
    setCompletedShoppingItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculate coordinates relative to a centered grid for the SVG map
  const getMapCoordinates = () => {
    if (!optResults || !optResults.nearbyStores) return { user: { x: 250, y: 250 }, stores: [] };

    const userLat = optResults.nearbyStores[0]?.latitude || -36.92949;
    const userLon = optResults.nearbyStores[0]?.longitude || 174.91396;
    
    const scale = 180; 

    const stores = optResults.nearbyStores.map((s: any) => {
      const dx = (s.longitude - userLon) * scale * 2.5;
      const dy = -(s.latitude - userLat) * scale * 2.5; 

      const x = Math.max(50, Math.min(450, 250 + dx));
      const y = Math.max(50, Math.min(450, 250 + dy));

      return {
        ...s,
        x,
        y
      };
    });

    return {
      user: { x: 250, y: 250 },
      stores
    };
  };

  const { user: mapUser, stores: mapStores } = getMapCoordinates();

  return (
    <div id="app-root" className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col antialiased">
      {/* GLOBAL DISH BUILDER ERROR POPUP */}
      {dishBuilderError && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="bg-rose-50 text-rose-600 p-3 rounded-full shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Dish Builder Analysis Failed</h3>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {dishBuilderError}
                </p>
                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-[10px] text-slate-500 font-mono mt-2">
                  Tip: Make sure your entry matches a realistic, cooking-friendly recipe or check that your Gemini API key is properly configured.
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDishBuilderError(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                Dismiss Error
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW VERSION NOTIFICATION POPUP */}
      {showNewVersionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-lg w-full p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center text-center">
            <div className="bg-emerald-50 text-emerald-600 p-4 rounded-full shrink-0 mb-5 shadow-inner">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>
            
            <h3 className="text-md sm:text-lg font-black text-slate-900 uppercase tracking-wide mb-3">
              A new app is available
            </h3>
            
            <p className="text-xs text-slate-600 leading-relaxed font-medium mb-6">
              This updated app supports <span className="font-bold text-slate-800">Pak'nSave</span>, <span className="font-bold text-slate-800">New World</span>, and <span className="font-bold text-slate-800">Woolworths</span> stores nationwide, and improves multi-threaded requests and LLM ingredient optimisation.
            </p>

            <div className="w-full bg-slate-50 border border-slate-150 rounded-xl p-4 mb-6 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Click the link below to proceed
              </span>
              <a 
                href="https://nz-meal-cost-optimiser-496619532397.australia-southeast2.run.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 break-all underline decoration-2 underline-offset-4 flex items-center gap-1.5"
              >
                https://nz-meal-cost-optimiser-496619532397.australia-southeast2.run.app/
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <a
                href="https://nz-meal-cost-optimiser-496619532397.australia-southeast2.run.app/"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all shadow-md hover:shadow-emerald-100 hover:scale-[1.01] active:scale-95 text-center cursor-pointer flex items-center justify-center gap-2"
              >
                Go to New Application
              </a>
              
              <button
                onClick={() => setShowNewVersionModal(false)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-semibold tracking-wide border border-slate-200/80 transition-all cursor-pointer active:scale-98"
              >
                Continue with the Pak'nsave demo app
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <header id="app-header" className="bg-white border-b border-slate-200 sticky top-0 z-50 py-3.5 px-6 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-sm">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-md font-bold text-slate-900 tracking-tight leading-none uppercase">NZ Meal Cost Optimizer</h1>
            <p className="text-[11px] text-slate-500 font-medium mt-1">Smart Portion-Matching across Pak'nSave Stores</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-semibold border border-slate-200/60">
            <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>AI Copilot Engine Connected</span>
          </div>
          <div className="text-[10px] font-bold text-slate-500 bg-slate-100 py-1 px-2.5 rounded-md border border-slate-200/60 uppercase font-mono tracking-wider">
            NZ Regional Portal
          </div>
        </div>
      </header>

      {/* CORE WORKSPACE */}
      <main id="app-workspace" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SIDEBAR: CONTROLS & AGENT LOGS (SPAN 4) */}
        <section id="sidebar-controls" className="lg:col-span-4 flex flex-col gap-6">
          
          {/* INTERACTIVE MODE SELECTOR */}
          <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1 shadow-xs">
            <button
              onClick={() => setSetupMode("agent")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                setupMode === "agent"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Guided Agent Setup
            </button>
            <button
              onClick={() => setSetupMode("manual")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                setupMode === "manual"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Manual Dashboard
            </button>
          </div>

          {/* ACTIVE ONBOARDING / CONFIG BOX */}
          {setupMode === "agent" ? (
            /* GUIDED AGENT WIZARD */
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col h-[480px] justify-between">
              
              {/* Wizard Title & Reset */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-50 text-emerald-700 p-1.5 rounded-md border border-emerald-100">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">AI Copilot Setup</h2>
                    <p className="text-[10px] text-slate-400 font-medium">Portion-Matched Planner</p>
                  </div>
                </div>
                <button
                  onClick={resetAgentGuidedSetup}
                  className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold underline flex items-center gap-1"
                >
                  Reset
                </button>
              </div>

              {/* Chat Log Window */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto py-4 space-y-3 pr-1 custom-scrollbar text-xs">
                {agentHistory.map((msg, i) => (
                  <div key={i} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`p-3 rounded-xl max-w-[85%] leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-slate-900 text-white font-medium rounded-tr-none shadow-xs"
                        : "bg-slate-50 border border-slate-200/80 text-slate-800 rounded-tl-none shadow-2xs"
                    }`}>
                      <p className="whitespace-pre-wrap">{msg.text.replace(/\*\*(.*?)\*\*/g, '$1')}</p>
                      <span className="text-[9px] text-slate-400 block mt-1.5 text-right font-mono font-medium">{msg.timestamp}</span>
                    </div>
                  </div>
                ))}
                <div ref={agentChatEndRef}></div>
              </div>

              {/* Interactive Step-specific inputs and suggestions */}
              <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
                
                {/* Step 1 Location Suggestions */}
                {agentStep === "location" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {["Botany", "Albany", "Hamilton", "Wellington"].map((suburb) => (
                        <button
                          key={suburb}
                          onClick={() => handleAgentInputSubmit(`${suburb}, New Zealand`)}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold py-1 px-2 rounded-lg transition-all"
                        >
                          📍 {suburb}
                        </button>
                      ))}
                      <button
                        onClick={detectGPS}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold py-1 px-2 rounded-lg transition-all"
                      >
                        📡 Use GPS Locate
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={agentInput}
                        onChange={(e) => setAgentInput(e.target.value)}
                        placeholder="Enter suburb or address..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-slate-900"
                        onKeyDown={(e) => e.key === "Enter" && handleAgentInputSubmit()}
                        title="Enter shopping suburb or address"
                      />
                      <button
                        onClick={() => handleAgentInputSubmit()}
                        className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Submit location"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2 Dish Suggestions */}
                {agentStep === "dish" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                      {["Spaghetti Bolognese", "Nachos", "Frittata", "Chicken Stir Fry"].map((dishOption) => (
                        <button
                          key={dishOption}
                          onClick={() => handleAgentInputSubmit(dishOption)}
                          className="bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold py-1 px-2 rounded-lg transition-all"
                        >
                          🍲 {dishOption}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={agentInput}
                        onChange={(e) => setAgentInput(e.target.value)}
                        placeholder="Type any custom meal..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-hidden focus:border-slate-900"
                        onKeyDown={(e) => e.key === "Enter" && handleAgentInputSubmit()}
                        title="Enter dish or recipe target"
                      />
                      <button
                        onClick={() => handleAgentInputSubmit()}
                        className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Submit recipe target"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3 Radius Selection */}
                {agentStep === "distance" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2 justify-between">
                      {["2", "4", "6", "8"].map((km) => (
                        <button
                          key={km}
                          onClick={() => handleAgentInputSubmit(`${km}km`)}
                          className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-bold py-1.5 rounded-lg transition-all font-mono"
                        >
                          {km} km
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="2"
                        max="8"
                        step="1"
                        value={radius}
                        onChange={(e) => setRadius(parseInt(e.target.value))}
                        className="flex-1 accent-slate-900 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                        title="Adjust travel search radius"
                      />
                      <span className="text-xs font-bold text-slate-700 font-mono shrink-0 w-10 text-right">{radius}km</span>
                    </div>
                    <button
                      onClick={() => handleAgentInputSubmit(`${radius}km`)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                    >
                      Confirm Travel Distance
                    </button>
                  </div>
                )}

                {/* Step 4 Portion Servings Counter */}
                {agentStep === "servings" && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-center gap-6 border border-slate-200 bg-slate-50 rounded-xl py-3 px-4">
                      <button
                        onClick={() => setServings(Math.max(1, servings - 1))}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                        title="Decrease portion servings"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-base font-extrabold text-slate-900 min-w-[100px] text-center">{servings} Servings</span>
                      <button
                        onClick={() => setServings(Math.min(12, servings + 1))}
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
                        title="Increase portion servings"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => handleAgentInputSubmit(`${servings} people`)}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                    >
                      Confirm Guest Scale
                    </button>
                  </div>
                )}

                {/* Step 5 Review and Execute */}
                {agentStep === "review" && (
                  <div className="flex flex-col gap-2">
                    <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-100 text-xs leading-relaxed flex gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Ready to Optimize!</strong> I have matched the portion sizes for <strong>{servings} portions</strong>. You can modify them anytime, or click below.
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        runOptimization();
                      }}
                      disabled={loading || ingredients.length === 0}
                      className={`w-full py-3 text-sm font-bold text-white rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 select-none ${
                        loading || ingredients.length === 0
                          ? "bg-slate-300 cursor-not-allowed"
                          : "bg-emerald-600 hover:bg-emerald-700 hover:shadow-md active:scale-[0.98] cursor-pointer"
                      }`}
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                          <span>OPTIMIZING BASKETS...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4.5 h-4.5" />
                          <span>RUN PORTION OPTIMIZER</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

              </div>
            </div>
          ) : (
            /* MANUAL CONFIGURATION BOX */
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold text-slate-950 uppercase tracking-wider flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-slate-600" />
                  Manual Settings
                </h2>
                <button 
                  onClick={detectGPS}
                  type="button"
                  className="text-[10px] text-slate-600 hover:text-slate-800 font-bold flex items-center gap-1 bg-slate-50 px-2 py-1 border border-slate-200 rounded-md transition-all cursor-pointer"
                >
                  <MapPin className="w-3 h-3 text-emerald-500" />
                  Use GPS
                </button>
              </div>

              {/* Address Input */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="input-address" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  1. Suburb or Delivery Location
                </label>
                <div className="relative">
                  <input 
                    id="input-address"
                    type="text" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter suburb or town centre..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-medium transition-all"
                  />
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {/* Dish Selector */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="input-dish" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    2. Recipe Target
                  </label>
                  <button 
                    onClick={() => setIsCustomDish(!isCustomDish)}
                    type="button"
                    className="text-[10px] text-slate-400 hover:text-slate-600 font-bold underline"
                  >
                    {isCustomDish ? "Preset" : "Custom"}
                  </button>
                </div>

                {isCustomDish ? (
                  <div className="relative">
                    <input 
                      id="input-dish"
                      type="text"
                      value={customDish}
                      onChange={(e) => setCustomDish(e.target.value)}
                      placeholder="Lamb Tagine, Butter Chicken..."
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-medium transition-all"
                    />
                    <ChefHat className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      id="select-dish"
                      value={selectedDish}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedDish(val);
                        setIsCustomDish(false);
                        loadIngredients(val);
                      }}
                      className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 font-medium appearance-none transition-all cursor-pointer"
                    >
                      {Object.keys(DISHES).map(dishKey => (
                        <option key={dishKey} value={dishKey}>
                          {dishKey.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                        </option>
                      ))}
                    </select>
                    <ChefHat className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <ChevronRight className="w-4 h-4 text-slate-400 absolute right-3 top-2.5 rotate-90 pointer-events-none" />
                  </div>
                )}
                <button
                  onClick={() => loadIngredients()}
                  disabled={loading}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold py-2 rounded-lg transition-all cursor-pointer mt-2"
                >
                  {loading ? "Analyzing..." : "Generate Ingredients"}
                </button>
              </div>

              {/* Slider / Portion Count */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="input-radius" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex justify-between">
                    <span>3. Radius</span>
                    <span className="text-slate-900 font-bold">{radius}km</span>
                  </label>
                  <input 
                    id="input-radius"
                    type="range"
                    min="2"
                    max="8"
                    step="1"
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value))}
                    className="w-full accent-slate-900 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    4. Portion Servings
                  </label>
                  <div className="flex items-center justify-between border border-slate-200 bg-slate-50 rounded-lg py-1 px-2">
                    <button 
                      onClick={() => setServings(Math.max(1, servings - 1))}
                      type="button"
                      className="p-1 rounded-md text-slate-500 hover:bg-slate-200 transition-colors"
                      aria-label="Decrease servings"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold text-slate-800">{servings} Pax</span>
                    <button 
                      onClick={() => setServings(Math.min(12, servings + 1))}
                      type="button"
                      className="p-1 rounded-md text-slate-500 hover:bg-slate-200 transition-colors"
                      aria-label="Increase servings"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Ingredient Checklist Container */}
              <div className="flex flex-col gap-2 mt-1 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Ingredients ({ingredients.length})
                  </span>
                  <button
                    onClick={addCustomIngredient}
                    type="button"
                    className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 cursor-pointer bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100"
                  >
                    <Plus className="w-3 h-3" /> Add New
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto flex flex-col gap-2 pr-1 custom-scrollbar">
                  {ingredients.map((ing, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-lg px-2.5 py-1.5 text-xs">
                      <input 
                        type="text"
                        value={ing.name}
                        onChange={(e) => updateIngredientName(idx, e.target.value)}
                        placeholder="Ingredient name"
                        className="font-semibold text-slate-700 truncate max-w-[140px] capitalize bg-transparent border-none focus:ring-0 px-0"
                        title="Ingredient name"
                      />
                      <div className="flex items-center gap-2">
                        <input 
                          type="text"
                          value={ing.qty}
                          onChange={(e) => updateIngredientQty(idx, e.target.value)}
                          className="w-16 bg-white border border-slate-200 rounded-md px-1 py-0.5 text-center text-[10px] font-medium text-slate-800"
                          title={`Quantity requirement for ${ing.name}`}
                        />
                        <button 
                          onClick={() => removeIngredient(idx)}
                          type="button"
                          className="text-slate-400 hover:text-red-500"
                          title="Remove item"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={runOptimization}
                disabled={loading || ingredients.length === 0}
                className={`w-full py-3 text-xs font-bold text-white rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  loading || ingredients.length === 0
                    ? "bg-slate-300 cursor-not-allowed" 
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>OPTIMIZING BASKETS...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>RUN PORTION OPTIMIZER</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* AGENT TERMINAL LOGGER */}
          <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 shadow-sm flex flex-col h-56">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  Agent Terminal Log
                </span>
              </div>
              <button 
                onClick={() => setLogs([])}
                type="button"
                className="text-[9px] text-slate-500 hover:text-slate-300 font-mono underline"
              >
                Clear
              </button>
            </div>

            <div ref={logContainerRef} className="flex-1 overflow-y-auto font-mono text-[10px] leading-relaxed text-slate-300 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {logs.map((log, i) => (
                <div key={i} className="flex gap-2 items-start hover:bg-slate-800/20 p-0.5 rounded-sm transition-colors">
                  <span className="text-slate-500 select-none">[{log.time}]</span>
                  <span className={log.text.includes("✅") ? "text-emerald-400 font-bold" : log.text.includes("WARNING") ? "text-amber-400" : "text-slate-300"}>
                    {log.text}
                  </span>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-slate-500 italic text-center pt-8">Console ready. Guided Onboarding steps and server updates appear here.</p>
              )}
              <div ref={logEndRef}></div>
            </div>
          </div>
        </section>
        
        {/* MAIN PANEL: DASHBOARD VISUALIZATIONS (SPAN 8) */}
        <section id="main-dashboard" className="lg:col-span-8 flex flex-col gap-6">
          
          {/* METRIC SUMMARY GRID */}
          {optResults ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Cheapest Single Store */}
              <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300 relative">
                {!optResults.cheapestSingleStore.all_ingredients_found && (
                  <div className="absolute -top-2 -right-2 bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1 rounded-full text-[9px] font-bold flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>Incomplete</span>
                  </div>
                )}
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cheapest Single Store</span>
                  <ShoppingBag className="w-4 h-4 text-slate-400" />
                </div>
                <div className="my-2">
                  <h3 className="text-xl font-extrabold text-slate-900">${optResults.cheapestSingleStore.total_purchase?.toFixed(2)}</h3>
                  <p className="text-xs text-slate-500 font-semibold truncate mt-0.5">Pak'nSave {optResults.cheapestSingleStore.store}</p>
                  {!optResults.cheapestSingleStore.all_ingredients_found && (
                    <p className="text-[10px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      Missing {ingredients.length - optResults.cheapestSingleStore.items_found} ingredient(s)
                    </p>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 border-t border-slate-100 pt-1.5 mt-1 font-semibold">
                  <Navigation className="w-3 h-3 text-emerald-500" />
                  <span>{optResults.cheapestSingleStore.distance_km}km from your location</span>
                </div>
              </div>

              {/* Multi-Store Optimized */}
              <div className="bg-emerald-950 text-emerald-50 rounded-xl border border-emerald-900 p-4.5 shadow-xs flex flex-col justify-between transition-all hover:border-emerald-800">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Multi-Store Optimal</span>
                  <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                </div>
                <div className="my-2">
                  <h3 className="text-xl font-extrabold text-white">${optResults.optimizedTotalPurchase?.toFixed(2)}</h3>
                  <p className="text-xs text-emerald-300 font-semibold mt-0.5">Optimal Portion Splits</p>
                </div>
                <div className="text-[10px] text-emerald-400 flex items-center justify-between border-t border-emerald-900 pt-1.5 mt-1 font-semibold">
                  <span className="flex items-center gap-1">
                    <ListOrdered className="w-3 h-3" />
                    <span>Best Portion match</span>
                  </span>
                  <span className="bg-emerald-800 text-white font-bold px-1.5 py-0.5 rounded text-[8px] uppercase font-mono tracking-wider">Best Value</span>
                </div>
              </div>

              {/* Total Savings */}
              <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-xs flex flex-col justify-between transition-all hover:border-slate-300">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Savings Potential</span>
                  <TrendingDown className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="my-2">
                  <h3 className="text-xl font-extrabold text-emerald-600">-${optResults.totalSavings?.toFixed(2)}</h3>
                  <p className="text-[10px] text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1">
                    Save {optResults.savingsPct}% overall
                  </p>
                </div>
                <div className="text-[10px] text-slate-400 border-t border-slate-100 pt-1.5 mt-1 font-semibold">
                  Scaled exactly to portion demands
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 border border-slate-200 border-dashed rounded-xl py-6 text-center text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
              <p className="text-xs font-semibold">Assembling live Auckland Pak'nSave database comparison...</p>
            </div>
          )}

          {/* MAIN CARD: TABS & RESULTS DETAILS */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex-1 flex flex-col overflow-hidden">
            
            {/* TAB SELECTOR */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 pt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab("matrix")}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "matrix" 
                    ? "border-slate-900 text-slate-900 font-extrabold" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <ShoppingBag className="w-4 h-4" />
                Comparison Matrix
              </button>

              <button
                onClick={() => {
                  setActiveTab("tuner");
                  // Auto-select first ingredient as active tuning target if none is selected
                  if (ingredients.length > 0 && !tuningIngredient) {
                    selectTuningIngredient(ingredients[0].name);
                  }
                }}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "tuner" 
                    ? "border-slate-900 text-slate-900 font-extrabold" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Sliders className="w-4 h-4" />
                AI Match Tuner
              </button>

              <button
                onClick={() => setActiveTab("recipe")}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "recipe" 
                    ? "border-slate-900 text-slate-900 font-extrabold" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <ChefHat className="w-4 h-4" />
                Recipe Guide
              </button>

              <button
                onClick={() => setActiveTab("ai")}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "ai" 
                    ? "border-slate-900 text-slate-900 font-extrabold" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                Portion Advisor AI
              </button>

              <button
                onClick={() => setActiveTab("map")}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "map" 
                    ? "border-slate-900 text-slate-900 font-extrabold" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <MapIcon className="w-4 h-4" />
                Store Router Map
              </button>

              <button
                onClick={() => setActiveTab("list")}
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "list" 
                    ? "border-slate-900 text-slate-900 font-extrabold" 
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Check className="w-4 h-4" />
                Shopping Checklist
              </button>
            </div>

            {/* TAB CONTENTS */}
            <div className="p-5 flex-1 flex flex-col">
              
              {/* TAB 1: COMPARISON MATRIX */}
              {activeTab === "matrix" && (() => {
                if (!optResults) {
                  return (
                    <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                      <RefreshCw className="w-8 h-8 animate-spin mb-3 text-slate-300" />
                      <p className="text-sm font-medium">Querying local New Zealand supermarket catalogs...</p>
                    </div>
                  );
                }

                // Calculate store totals dynamically based on currently matched products (respecting overrides/custom rules)
                const dynamicStoreTotals = optResults.nearbyStores.map((store: any) => {
                  let totalPurchase = 0;
                  let totalPortion = 0;
                  let itemsFound = 0;
                  
                  ingredients.forEach((ing) => {
                    let storeMatches: any[] = [];
                    if (optResults.allFoundProducts) {
                      const storeProducts = optResults.allFoundProducts[store.store_id]?.[ing.name] || [];
                      storeProducts.forEach((p: any) => {
                        const override = productOverrides[p.name];
                        let matched = p.is_matched;
                        if (override === 'exclude') matched = false;
                        else if (override === 'include') matched = true;
                        else {
                          const rule = customRules[ing.name];
                          if (rule) {
                            const pName = p.name.toLowerCase();
                            if (rule.exclude) {
                              const excludeKeywords = rule.exclude.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
                              if (excludeKeywords.length > 0 && excludeKeywords.some((kw: string) => pName.includes(kw))) {
                                matched = false;
                              }
                            }
                            if (rule.include) {
                              const includeKeywords = rule.include.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
                              if (includeKeywords.length > 0 && !includeKeywords.some((kw: string) => pName.includes(kw))) {
                                matched = false;
                              }
                            }
                          }
                        }

                        if (matched) {
                          storeMatches.push(p);
                        }
                      });
                    } else {
                      storeMatches = optResults.results.filter((r: any) => r.ingredient === ing.name && r.store === store.name);
                    }

                    if (storeMatches.length > 0) {
                      const bestMatch = [...storeMatches].sort((a, b) => a.portion_cost - b.portion_cost)[0];
                      totalPurchase += bestMatch.purchase_cost;
                      totalPortion += bestMatch.portion_cost;
                      itemsFound++;
                    }
                  });

                  return {
                    store_id: store.store_id,
                    name: store.name,
                    total_purchase: totalPurchase,
                    total_portion: totalPortion,
                    items_found: itemsFound
                  };
                });

                let dynamicOptimalPurchase = 0;
                let dynamicOptimalPortion = 0;

                ingredients.forEach((ing) => {
                  let allMatchedForIng: any[] = [];
                  optResults.nearbyStores.forEach((store: any) => {
                    if (optResults.allFoundProducts) {
                      const storeProducts = optResults.allFoundProducts[store.store_id]?.[ing.name] || [];
                      storeProducts.forEach((p: any) => {
                        const override = productOverrides[p.name];
                        let matched = p.is_matched;
                        if (override === 'exclude') matched = false;
                        else if (override === 'include') matched = true;
                        else {
                          const rule = customRules[ing.name];
                          if (rule) {
                            const pName = p.name.toLowerCase();
                            if (rule.exclude) {
                              const excludeKeywords = rule.exclude.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
                              if (excludeKeywords.length > 0 && excludeKeywords.some((kw: string) => pName.includes(kw))) {
                                matched = false;
                              }
                            }
                            if (rule.include) {
                              const includeKeywords = rule.include.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
                              if (includeKeywords.length > 0 && !includeKeywords.some((kw: string) => pName.includes(kw))) {
                                matched = false;
                              }
                            }
                          }
                        }

                        if (matched) {
                          allMatchedForIng.push(p);
                        }
                      });
                    } else {
                      const directMatches = optResults.results.filter((r: any) => r.ingredient === ing.name);
                      allMatchedForIng.push(...directMatches);
                    }
                  });

                  if (allMatchedForIng.length > 0) {
                    const bestAll = [...allMatchedForIng].sort((a, b) => a.portion_cost - b.portion_cost)[0];
                    dynamicOptimalPurchase += bestAll.purchase_cost;
                    dynamicOptimalPortion += bestAll.portion_cost;
                  }
                });

                return (
                  <div className="flex-1 flex flex-col">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                            <th className="py-2.5 px-3">Ingredient</th>
                            <th className="py-2.5 px-3">Portion Needed</th>
                            {optResults.nearbyStores.map((s: any) => (
                              <th key={s.store_id} className="py-2.5 px-3 truncate max-w-[120px]">
                                {s.name.replace("Pak'nSave ", "")}
                              </th>
                            ))}
                            <th className="py-2.5 px-3 text-emerald-800 bg-emerald-50 text-right">Optimal Match</th>
                          </tr>
                        </thead>
                        <tbody key={renderTrigger} className="divide-y divide-slate-100 text-xs">
                          {ingredients.map((ing, iIdx) => {
                            let productMatches: any[] = [];
                            if (optResults.allFoundProducts) {
                              optResults.nearbyStores.forEach((store: any) => {
                                const storeProducts = optResults.allFoundProducts[store.store_id]?.[ing.name] || [];
                                storeProducts.forEach((p: any) => {
                                  productMatches.push({
                                    ...p,
                                    ingredient: ing.name,
                                    store: store.name,
                                    store_id: store.store_id,
                                  });
                                });
                              });
                            } else {
                              productMatches = optResults.results.filter((r: any) => r.ingredient === ing.name);
                            }

                            // Full filter chain: manual override > custom rules > NLP match
                            productMatches = productMatches.filter((r: any) => {
                                const override = productOverrides[r.name];
                                if (override === 'exclude') return false;
                                if (override === 'include') return true;

                                const rule = customRules[ing.name];
                                if (rule) {
                                    const pName = r.name.toLowerCase();
                                    if (rule.exclude) {
                                      const excludeKeywords = rule.exclude.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
                                      if (excludeKeywords.length > 0 && excludeKeywords.some((kw: string) => pName.includes(kw))) {
                                        return false;
                                      }
                                    }
                                    if (rule.include) {
                                      const includeKeywords = rule.include.split(',').map((k: string) => k.trim().toLowerCase()).filter(Boolean);
                                      if (includeKeywords.length > 0 && !includeKeywords.some((kw: string) => pName.includes(kw))) {
                                        return false;
                                      }
                                    }
                                }

                                if (!r.is_matched) return false;
                                return true;
                            });
                            
                            if (productMatches.length === 0) return null; // Hide if all excluded
                            
                            let cheapestOverall: any = null;
                            if (productMatches.length > 0) {
                              cheapestOverall = [...productMatches].sort((a, b) => a.portion_cost - b.portion_cost)[0];
                            }

                            return (
                              <tr key={iIdx} className="hover:bg-slate-50/40 transition-colors">
                                <td className="py-3 px-3 font-semibold text-slate-900 capitalize">
                                  {ing.name}
                                </td>
                                <td className="py-3 px-3 text-slate-500 font-semibold font-mono">
                                  {ing.qty}
                                </td>

                                {optResults.nearbyStores.map((store: any) => {
                                  const storeMatches = productMatches.filter((m: any) => m.store === store.name);
                                  if (storeMatches.length === 0) {
                                    return <td key={store.store_id} className="py-3 px-3 text-slate-400 italic border border-slate-100">Not found</td>;
                                  }

                                  const sortedMatches = [...storeMatches].sort((a, b) => a.portion_cost - b.portion_cost);
                                  const cheapestInStore = sortedMatches[0];
                                  const isBestOverall = cheapestOverall && cheapestOverall.name === cheapestInStore.name && cheapestOverall.store === cheapestInStore.store;

                                  return (
                                    <td key={store.store_id} className="py-3 px-3 border border-slate-100 align-top max-w-[200px]">
                                      <div 
                                        className={`p-2 rounded-lg border transition-all text-left select-none ${
                                          isBestOverall 
                                            ? "bg-emerald-50/70 border-emerald-300" 
                                            : "bg-amber-50/40 border-amber-200"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-1">
                                          <p className="text-slate-800 font-semibold text-[11px] leading-tight truncate flex-1" title={cheapestInStore.name}>
                                            {cheapestInStore.brand && (
                                              <span className={`text-[8px] px-1 py-0.5 rounded-sm font-extrabold mr-1 border align-middle leading-none inline-block ${getBrandBadgeStyle(cheapestInStore.brand)}`}>
                                                {cheapestInStore.brand}
                                              </span>
                                            )}
                                            <span className="align-middle">{cheapestInStore.name}</span>
                                          </p>
                                          {isBestOverall ? (
                                            <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-bold shrink-0 shadow-2xs" title="Optimal Overall Match">★</span>
                                          ) : (
                                            <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] font-bold shrink-0 shadow-2xs" title="Cheapest In Store">✓</span>
                                          )}
                                        </div>
                                        
                                        <div className="flex justify-between items-center mt-1 text-[9px] font-mono text-slate-500">
                                          <span>Pack: <span className="font-bold text-slate-700">${parseFloat(cheapestInStore.price).toFixed(2)}</span> <span className="text-slate-400">({cheapestInStore.units})</span></span>
                                          <span className="text-slate-300">|</span>
                                          <span>Used: <span className="font-extrabold text-emerald-700">${cheapestInStore.portion_cost?.toFixed(2)}</span></span>
                                        </div>
                                      </div>
                                    </td>
                                  );
                                })}

                                <td className="py-3 px-3 bg-emerald-50/35 text-right border border-slate-100 align-top max-w-[200px]">
                                  {cheapestOverall ? (
                                    <div>
                                      <span className="text-[8px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded-full inline-block tracking-wide uppercase leading-none font-mono mb-1">
                                        {cheapestOverall.store.replace("Pak'nSave ", "").toUpperCase()}
                                      </span>
                                      <p className="text-slate-800 font-bold text-[11px] truncate">
                                        {cheapestOverall.brand && (
                                          <span className={`text-[8px] px-1 py-0.5 rounded-sm font-extrabold mr-1 border align-middle leading-none inline-block ${getBrandBadgeStyle(cheapestOverall.brand)}`}>
                                            {cheapestOverall.brand}
                                          </span>
                                        )}
                                        <span className="align-middle">{cheapestOverall.name}</span>
                                      </p>
                                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                                        Pack: ${parseFloat(cheapestOverall.price).toFixed(2)} <span className="text-slate-400">({cheapestOverall.units})</span>
                                      </p>
                                      <p className="text-[10px] font-mono text-emerald-800 font-bold">
                                        Used: ${cheapestOverall.portion_cost?.toFixed(2)}
                                      </p>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 italic">No match</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {/* SUB-TOTAL ROWS */}
                          <tr className="bg-slate-50 font-bold text-slate-900 border-t-2 border-slate-200">
                            <td className="py-3 px-3 text-[10px] uppercase tracking-wider text-slate-500">Totals (Buy Pack)</td>
                            <td className="py-3 px-3"></td>
                            {optResults.nearbyStores.map((store: any) => {
                              const dynamicStore = dynamicStoreTotals.find(s => s.store_id === store.store_id);
                              return (
                                <td key={store.store_id} className="py-3 px-3 font-mono font-extrabold text-slate-900 text-xs border border-slate-100">
                                  ${dynamicStore?.total_purchase?.toFixed(2) || "0.00"}
                                </td>
                              );
                            })}
                            <td className="py-3 px-3 bg-emerald-100/40 text-emerald-950 text-right font-mono font-extrabold text-xs border border-slate-100">
                              ${dynamicOptimalPurchase?.toFixed(2)}
                            </td>
                          </tr>

                          {/* PORTION USED SUB-TOTALS */}
                          <tr className="bg-slate-50 font-bold text-slate-500 border-t border-slate-200">
                            <td className="py-3 px-3 text-[10px] uppercase tracking-wider">Portion Cost (Used)</td>
                            <td className="py-3 px-3"></td>
                            {optResults.nearbyStores.map((store: any) => {
                              const dynamicStore = dynamicStoreTotals.find(s => s.store_id === store.store_id);
                              return (
                                <td key={store.store_id} className="py-3 px-3 font-mono text-slate-500 text-[10px] border border-slate-100">
                                  ${dynamicStore?.total_portion?.toFixed(2) || "0.00"}
                                </td>
                              );
                            })}
                            <td className="py-3 px-3 bg-emerald-50/20 text-emerald-800 text-right font-mono text-[10px] border border-slate-100">
                              ${dynamicOptimalPortion?.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>

                      {/* PORTION REMINDER NOTE */}
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 mt-5 text-xs text-amber-800 leading-relaxed flex gap-2.5">
                        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-bold font-sans">Smart Value Optimization:</strong> Splitting purchases between nearby Pak'nSave stores can lead to substantial grocery savings! Be sure to check out the <span className="font-bold underline cursor-pointer hover:text-amber-900" onClick={() => setActiveTab("ai")}>Portion Advisor Tab</span> to receive smart storage tips and recipe ideas to deal with leftovers like cheese, eggs, or milk.
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* TAB: RECIPE GUIDE */}
              {activeTab === "recipe" && (
                <div className="flex-1 flex flex-col">
                  {recipeLoading ? (
                    <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                      <RefreshCw className="w-8 h-8 animate-spin mb-3 text-slate-300" />
                      <p className="text-sm font-medium">Assembling dynamic recipe instructions...</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm">Combining generated ingredients, timing profiles, and kitchen safety disclaimers...</p>
                    </div>
                  ) : recipe ? (
                    <div className="space-y-6 max-w-3xl mx-auto w-full">
                      
                      {/* Recipe Header */}
                      <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Dynamic Culinary Guide</span>
                          <h3 className="text-xl font-extrabold text-slate-900 capitalize flex items-center gap-2 mt-0.5">
                            <ChefHat className="w-5 h-5 text-emerald-600" />
                            {recipe.dishName || (isCustomDish ? customDish : selectedDish)}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-2.5 text-xs">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                            Portions: <strong className="font-bold text-slate-900">{recipe.servings || servings}</strong>
                          </span>
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                            Prep Time: <strong className="font-bold text-slate-900">{recipe.prepTimeMinutes || 10} mins</strong>
                          </span>
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                            Cook Time: <strong className="font-bold text-slate-900">{(recipe.totalTimeMinutes - recipe.prepTimeMinutes) || 25} mins</strong>
                          </span>
                        </div>
                      </div>

                      {/* AI Recipe Warning */}
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 leading-relaxed flex gap-3 shadow-xs">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-1">
                          <p className="font-bold font-sans">⚠️ AI Culinary Safety Warning:</p>
                          <p className="text-amber-800">
                            {recipe.warning || "AI-generated recipes are experimental and might not be accurate or necessarily safe. Always exercise caution, ensure meat, seafood, or poultry is cooked to safe recommended internal temperatures, and double-check ingredients for allergen safety."}
                          </p>
                        </div>
                      </div>

                      {/* Measurement range disclaimer */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 text-xs">
                        <p className="font-semibold text-slate-900 mb-1 flex items-center gap-1.5">
                          <Info className="w-4 h-4 text-slate-500" />
                          Flexible Cooking & Ingredient Ranges
                        </p>
                        <p className="text-slate-600 leading-relaxed">
                          {recipe.measurementDisclaimer || "Measurements do not have to be rigid. You can adjust the weights or ingredient quantities within a reasonable range according to your family's preferences, taste, and the actual pack sizes purchased at your local Pak'nSave."}
                        </p>
                      </div>

                      {/* Ingredients Section */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        
                        {/* Generated Ingredients (In Stock / Bought) */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4.5">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Generated Ingredients (Used)
                          </h4>
                          <ul className="space-y-2 text-xs">
                            {(recipe.generatedIngredientsUsed || ingredients).map((ing: any, idx: number) => (
                              <li key={idx} className="flex items-start gap-2 text-slate-700">
                                <span className="text-emerald-600 font-bold mt-0.5">✓</span>
                                <span className="flex-1">
                                  <strong className="font-semibold text-slate-900 capitalize">{ing.name}</strong>
                                  <span className="text-slate-400 ml-1 font-mono">({ing.qty})</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Additional Pantry Staples Needed */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4.5">
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                            Additional Pantry Essentials
                          </h4>
                          <p className="text-[10px] text-slate-400 font-medium mb-3">
                            Common household staples you will need from your pantry (not generated as store purchases):
                          </p>
                          <ul className="space-y-2 text-xs">
                            {(recipe.additionalIngredientsNeeded || [
                              { name: "Salt & Black Pepper", qty: "to taste" },
                              { name: "Cooking Oil or Butter", qty: "1-2 tbsp" },
                              { name: "Water", qty: "as needed" }
                            ]).map((ing: any, idx: number) => (
                              <li key={idx} className="flex items-start gap-2 text-slate-600">
                                <span className="text-slate-400 mt-0.5">•</span>
                                <span className="flex-1">
                                  <span className="font-semibold text-slate-800 capitalize">{ing.name}</span>
                                  {ing.qty && <span className="text-slate-400 ml-1 font-mono">({ing.qty})</span>}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                      </div>

                      {/* Cooking Steps Timeline */}
                      <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-5 border-b border-slate-100 pb-3 flex items-center gap-1.5">
                          <ListOrdered className="w-4 h-4 text-slate-500" />
                          Step-by-Step Culinary Instructions
                        </h4>
                        
                        <div className="space-y-6 relative border-l-2 border-slate-100 pl-5 ml-2.5">
                          {(recipe.cookingSteps || []).map((step: any, idx: number) => (
                            <div key={idx} className="relative">
                              {/* Timeline dot */}
                              <div className="absolute -left-[29px] top-0.5 bg-slate-900 text-white rounded-full w-4.5 h-4.5 flex items-center justify-center text-[10px] font-bold shadow-xs">
                                {step.stepNumber || (idx + 1)}
                              </div>
                              
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <h5 className="font-bold text-slate-900 text-sm leading-none">{step.title}</h5>
                                  {step.durationMinutes && (
                                    <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                      ⏰ {step.durationMinutes} mins
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                                  {step.instruction}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Total Timing Summary Card */}
                        <div className="bg-emerald-50/30 border border-emerald-100 rounded-lg p-4.5 mt-6 flex justify-between items-center text-xs text-slate-700">
                          <div>
                            <p className="font-bold text-slate-800">Culinary Timing Summary</p>
                            <p className="text-slate-500 text-[10px] mt-0.5">Total estimated workspace dedication required</p>
                          </div>
                          <div className="text-right">
                            <span className="text-lg font-extrabold text-slate-900">{recipe.totalTimeMinutes || 35} minutes</span>
                            <p className="text-[10px] text-emerald-800 font-semibold mt-0.5">Ready to serve hot!</p>
                          </div>
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center">
                      <ChefHat className="w-10 h-10 text-slate-300 mb-3" />
                      <p className="text-sm font-semibold">No Recipe Found</p>
                      <p className="text-xs text-slate-400 mt-1">Please make sure ingredients are loaded before viewing the recipe guide.</p>
                      <button
                        onClick={fetchRecipeIfNeeded}
                        className="mt-4 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"
                      >
                        Generate Recipe Guide Now
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SHOPPING CHECKLIST */}
              {activeTab === "list" && (
                <div className="flex-1 flex flex-col">
                  {optResults ? (
                    <div className="space-y-6">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Optimized Store Routing Path ({getGroupedShoppingList().length} Stops)
                        </h3>
                        <div className="text-xs text-slate-500 font-semibold">
                          Purchased: {Object.keys(completedShoppingItems).filter(k => completedShoppingItems[k]).length} of {ingredients.length} items
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {getGroupedShoppingList().map((storeGroup: any, sIdx) => (
                          <div key={sIdx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 flex flex-col gap-3.5 hover:border-slate-300 transition-all">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="bg-slate-900 text-white font-bold text-[9px] px-2 py-0.5 rounded-full inline-block font-mono uppercase tracking-wider">
                                  Stop {sIdx + 1}
                                </span>
                                <h4 className="text-xs font-extrabold text-slate-900 mt-1.5">{storeGroup.storeName}</h4>
                              </div>
                              <span className="text-[10px] text-slate-500 font-bold bg-white border border-slate-200 px-2 py-1 rounded-md font-mono flex items-center gap-1 shadow-2xs">
                                <Navigation className="w-3 h-3 text-emerald-600 animate-pulse" />
                                {storeGroup.distance.toFixed(1)}km
                              </span>
                            </div>

                            <div className="border-t border-slate-200/60 pt-3 space-y-2">
                              {storeGroup.items.map((item: any, iIdx: number) => {
                                const itemId = `${item.store}-${item.ingredient}`;
                                const isChecked = completedShoppingItems[itemId] || false;

                                return (
                                  <div 
                                    key={iIdx} 
                                    onClick={() => toggleShoppingItem(itemId)}
                                    className={`flex items-start justify-between p-2.5 rounded-lg border transition-all cursor-pointer ${
                                      isChecked 
                                        ? "bg-slate-100/50 border-slate-200 opacity-60" 
                                        : "bg-white border-slate-100 hover:border-slate-200 shadow-2xs"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <input 
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {}} 
                                        className="rounded-sm accent-emerald-600 cursor-pointer w-4 h-4"
                                      />
                                      <div>
                                        <p className={`text-xs font-semibold capitalize ${isChecked ? "line-through text-slate-400" : "text-slate-800"}`}>
                                          {item.ingredient} <span className="text-[10px] font-normal text-slate-400">({item.qty_required})</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px] font-medium">{item.name}</p>
                                      </div>
                                    </div>

                                    <div className="text-right font-mono shrink-0">
                                      <span className="text-xs font-bold text-slate-800">${item.price}</span>
                                      <p className="text-[8px] text-slate-400 mt-0.5 font-sans font-semibold">Buy {item.packs_needed} pack</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-slate-300" />
                      <p className="text-sm font-medium">Assembling checklist routes...</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: SMART PORTION ADVISOR (AI CO-PILOT) */}
              {activeTab === "ai" && (
                <div className="flex-1 flex flex-col lg:grid lg:grid-cols-12 gap-5 min-h-[400px]">
                  
                  {/* LEFT: GENERATED AI REPORT (SPAN 7) */}
                  <div className="lg:col-span-7 bg-slate-50/50 rounded-xl p-5 border border-slate-200 flex flex-col overflow-y-auto max-h-[500px]">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
                      <FileText className="w-5 h-5 text-slate-700" />
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Gemini Portion Value Report
                      </h3>
                    </div>

                    <div className="flex-1 text-slate-700 space-y-3.5 pr-2 custom-scrollbar">
                      {optResults ? renderAIReport(optResults.aiReport) : (
                        <div className="py-10 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-slate-300" />
                          <p className="text-xs font-medium">Consulting portion models...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: INTERACTIVE EXPERT Q&A (SPAN 5) */}
                  <div className="lg:col-span-5 border border-slate-200 rounded-xl flex flex-col overflow-hidden bg-white shadow-2xs">
                    <div className="bg-slate-900 text-white p-3.5 flex items-center gap-2">
                      <ChefHat className="w-5 h-5 text-emerald-400 animate-pulse" />
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 leading-none">AI Kitchen Companion</h4>
                        <p className="text-[9px] text-slate-400 mt-0.5 leading-none font-medium">Ask cooking swaps or leftover conversions</p>
                      </div>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto max-h-72 space-y-3 custom-scrollbar text-xs bg-slate-50/20">
                      <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 text-slate-600 leading-relaxed font-sans">
                        👋 Kia ora! I'm here to help you store or cook with leftovers from your shopping trip. Ask me things like:
                        <ul className="list-disc ml-4 mt-2 space-y-1 text-[10px] font-semibold text-slate-500">
                          <li>"How do I store remaining beef mince?"</li>
                          <li>"What are some quick recipes for leftover eggs?"</li>
                          <li>"Can I swap cheese block for tasty shredded?"</li>
                        </ul>
                      </div>

                      {chatHistory.map((chat, i) => (
                        <div 
                          key={i} 
                          className={`flex ${chat.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div className={`p-3 rounded-lg max-w-[85%] leading-relaxed ${
                            chat.role === "user" 
                              ? "bg-slate-900 text-white font-medium rounded-tr-none shadow-xs" 
                              : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-2xs"
                          }`}>
                            {chat.role === "user" ? (
                              chat.text
                            ) : (
                              <Markdown
                                components={{
                                  h1: ({ children, ...props }: any) => <h1 {...props} className="text-xs font-bold text-slate-900 mt-2 mb-1 border-b border-slate-100 pb-0.5">{children}</h1>,
                                  h2: ({ children, ...props }: any) => <h2 {...props} className="text-xs font-bold text-slate-800 mt-2 mb-1">{children}</h2>,
                                  h3: ({ children, ...props }: any) => <h3 {...props} className="text-xs font-semibold text-slate-800 mt-1.5 mb-1">{children}</h3>,
                                  p: ({ children, ...props }: any) => <p {...props} className="text-xs text-slate-700 my-1 leading-relaxed">{children}</p>,
                                  ul: ({ children, ...props }: any) => <ul {...props} className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>,
                                  ol: ({ children, ...props }: any) => <ol {...props} className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>,
                                  li: ({ children, ...props }: any) => <li {...props} className="text-xs text-slate-700 leading-relaxed">{children}</li>,
                                  strong: ({ children, ...props }: any) => <strong {...props} className="font-bold text-slate-900">{children}</strong>,
                                  em: ({ children, ...props }: any) => <em {...props} className="italic text-slate-600">{children}</em>,
                                  code: ({ children, ...props }: any) => <code {...props} className="font-mono text-[9px] bg-slate-100 px-1 py-0.5 rounded text-slate-800">{children}</code>,
                                }}
                              >
                                {chat.text}
                              </Markdown>
                            )}
                          </div>
                        </div>
                      ))}

                      {chatLoading && (
                        <div className="flex justify-start animate-pulse">
                          <div className="bg-white border border-slate-200 p-3 rounded-lg text-slate-400 italic">
                            Typing recipe advice...
                          </div>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSendMessage} className="border-t border-slate-200 p-3 flex gap-2.5 bg-white">
                      <input 
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Ask about leftover recipes or swaps..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                        title="Chat prompt input"
                      />
                      <button 
                        type="submit"
                        disabled={!chatMessage.trim() || chatLoading}
                        className="bg-slate-900 text-white p-2.5 rounded-lg hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                        title="Send question"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>

                </div>
              )}

              {/* TAB 4: STORE ROUTER MAP */}
              {activeTab === "map" && (
                <div className="flex-1 flex flex-col items-center justify-center">
                  {optResults ? (
                    <div className="w-full max-w-2xl flex flex-col items-center">
                      <div className="flex items-center justify-between w-full border-b border-slate-100 pb-2 mb-4">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Map of nearby Local Pak'nSave Outlets
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold">Center represents you</span>
                      </div>

                      <div className="relative border border-slate-200 rounded-xl bg-slate-950 overflow-hidden w-full h-[400px] flex items-center justify-center shadow-inner">
                        {optResults && optResults.nearbyStores.length > 0 && (
                          <MapContainer 
                            center={[optResults.userLat || optResults.nearbyStores[0].latitude, optResults.userLon || optResults.nearbyStores[0].longitude]} 
                            zoom={13} 
                            style={{ height: "400px", width: "100%" }}
                          >
                            <TileLayer
                              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            />
                            {/* User Green Marker */}
                            <Marker icon={userIcon} position={[optResults.userLat || optResults.nearbyStores[0].latitude, optResults.userLon || optResults.nearbyStores[0].longitude]}>
                              <Popup>
                                <div className="p-1 font-sans">
                                  <h4 className="font-bold text-xs text-slate-800">Your Location</h4>
                                  <p className="text-[10px] text-slate-500 mt-0.5">{address}</p>
                                </div>
                              </Popup>
                            </Marker>
                            
                            {optResults.nearbyStores.map((store: any, idx: number) => (
                              <Marker key={idx} icon={simpleIcon} position={[store.latitude, store.longitude]}>
                                <Popup>{store.name}</Popup>
                              </Marker>
                            ))}
                          </MapContainer>
                        )}


                        <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-xs text-white p-2.5 rounded-lg text-[9px] space-y-1 border border-slate-800">
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>Your Location</span>
                          </div>
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span>Pak'nSave Outlets</span>
                          </div>
                        </div>

                        <div className="absolute bottom-3 bg-slate-900/90 backdrop-blur-xs text-[10px] text-slate-300 px-3 py-1.5 rounded-md border border-slate-800 flex items-center gap-1.5 font-semibold shadow-md">
                          <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{address}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-400">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-slate-300" />
                      <p className="text-sm font-medium">Awaiting optimization parameters to project outlet coordinates...</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: AI MATCH TUNER */}
              {activeTab === "tuner" && (
                <div className="flex-1 flex flex-col">
                  {/* Tab Explainer Header */}
                  <div className="border-b border-slate-100 pb-3 mb-2">
                    <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                      <Sliders className="w-4 h-4 text-slate-800" />
                      AI Match Tuner & Search Index Explorer
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed font-semibold">
                      Supermarkets often return processed products or erroneous items in their search catalogs. 
                      Use this dashboard to inspect the top 20 product results cached per store, define your own inclusion/exclusion keyword rules, and watch our Gemini NLP agent dynamically filter down matches to isolate exactly what you need.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4 flex-1">
                    {/* Left Column: Ingredients Selector and Custom Rules Editor (span 5) */}
                    <div className="lg:col-span-5 flex flex-col gap-5">
                      <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/35">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                          <ListOrdered className="w-4 h-4" /> Selected Dish Ingredients
                        </h3>
                        <div className="space-y-2">
                          {ingredients.map((ing) => {
                            const hasRule = !!customRules[ing.name];
                            const isSelected = tuningIngredient === ing.name;
                            const cachedProducts = optResults?.allFoundProducts?.[optResults?.nearbyStores?.[0]?.store_id]?.[ing.name] || [];
                            const matchCount = cachedProducts.filter((p: any) => p.is_matched).length;
                            return (
                              <button
                                key={ing.name}
                                onClick={() => selectTuningIngredient(ing.name)}
                                className={`w-full text-left p-3 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                                  isSelected
                                    ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold capitalize">{ing.name}</span>
                                  <span className={`text-[10px] ${isSelected ? "text-slate-300" : "text-slate-400"} font-mono`}>
                                    Qty: {ing.qty}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {cachedProducts.length > 0 && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isSelected ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"}`}>
                                      {matchCount}/{cachedProducts.length} matched
                                    </span>
                                  )}
                                  {hasRule && (
                                    <span className="bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                      Custom Rule
                                    </span>
                                  )}
                                  <ChevronRight className={`w-4 h-4 ${isSelected ? "text-white" : "text-slate-400"}`} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Rules Editing Form for selected ingredient */}
                      {tuningIngredient && (
                        <div className="border border-slate-200 rounded-xl p-4 bg-white shadow-2xs space-y-4">
                          <div className="border-b border-slate-100 pb-2">
                            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                              <Sliders className="w-4 h-4 text-emerald-500" />
                              Edit Rules: <span className="text-emerald-600 capitalize">"{tuningIngredient}"</span>
                            </h4>
                            <p className="text-[10px] text-slate-400 mt-1 font-medium leading-relaxed">
                              Define custom include/exclude rules. These will be sent directly to the Gemini NLP Agent to generate the precise positive/negative profile filters.
                            </p>
                          </div>

                          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-[10px] text-slate-600 space-y-1.5 shadow-2xs">
                            <span className="font-bold text-slate-800 uppercase tracking-wider block border-b border-slate-200/50 pb-1 text-[9px]">
                              Rule Execution Priority Hierarchy
                            </span>
                            <div className="space-y-1.5">
                              <div className="flex items-start gap-2">
                                <span className="bg-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">1</span>
                                <div>
                                  <span className="font-bold text-red-600">Manual Product Overrides</span>
                                  <p className="text-slate-400 text-[9px]">Forced inclusion or exclusion toggled directly on individual products (overrules all rules).</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="bg-orange-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">2</span>
                                <div>
                                  <span className="font-bold text-orange-800">Custom Gemini Instructions</span>
                                  <p className="text-slate-400 text-[9px]">AI reads target product metadata (name, brand, units, price) individually and returns true/false filter decisions.</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="bg-orange-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">3</span>
                                <div>
                                  <span className="font-bold text-orange-700">Must Exclude Rules</span>
                                  <p className="text-slate-400 text-[9px]">Strict keyword or brand terms that immediately discard matching products.</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="bg-amber-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">4</span>
                                <div>
                                  <span className="font-bold text-amber-700">Must Include Rules</span>
                                  <p className="text-slate-400 text-[9px]">Requires that products contain at least one of these exact text tags.</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="bg-yellow-400 text-slate-950 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">5</span>
                                <div>
                                  <span className="font-bold text-yellow-800">Baseline AI NLP Profile</span>
                                  <p className="text-slate-400 text-[9px]">Standard semantic keyword matches and category alignments.</p>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4 text-xs">
                            <div>
                              <label className="block text-slate-600 font-bold mb-1.5" htmlFor="must-include-field">
                                Must Include (Inclusions)
                              </label>
                              
                              {tuneIncludeTags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2 p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                                  {tuneIncludeTags.map((tag, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-150 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all hover:bg-emerald-100">
                                      <span>{tag}</span>
                                      <button
                                        type="button"
                                        onClick={() => setTuneIncludeTags(prev => prev.filter((_, i) => i !== idx))}
                                        className="hover:bg-emerald-200/60 rounded-full p-0.5 text-emerald-600 focus:outline-hidden cursor-pointer"
                                        title={`Remove "${tag}"`}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              <input
                                id="must-include-field"
                                type="text"
                                value={includeInput}
                                onChange={(e) => setIncludeInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitIncludeTag();
                                  }
                                }}
                                onBlur={commitIncludeTag}
                                placeholder="Type a keyword/brand and press Enter..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                              />
                              <span className="text-[9px] text-slate-400 mt-1 block">Press Enter or leave the field to save as a filter tag.</span>
                            </div>

                            <div>
                              <label className="block text-slate-600 font-bold mb-1.5" htmlFor="must-exclude-field">
                                Must Exclude (Exclusions)
                              </label>

                              {tuneExcludeTags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mb-2 p-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                                  {tuneExcludeTags.map((tag, idx) => (
                                    <span key={idx} className="inline-flex items-center gap-1 bg-rose-50 text-rose-800 border border-rose-150 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all hover:bg-rose-100">
                                      <span>{tag}</span>
                                      <button
                                        type="button"
                                        onClick={() => setTuneExcludeTags(prev => prev.filter((_, i) => i !== idx))}
                                        className="hover:bg-rose-200/60 rounded-full p-0.5 text-rose-600 focus:outline-hidden cursor-pointer"
                                        title={`Remove "${tag}"`}
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}

                              <input
                                id="must-exclude-field"
                                type="text"
                                value={excludeInput}
                                onChange={(e) => setExcludeInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    commitExcludeTag();
                                  }
                                }}
                                onBlur={commitExcludeTag}
                                placeholder="Type a term to filter out and press Enter..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
                              />
                              <span className="text-[9px] text-slate-400 mt-1 block">Press Enter or leave the field to save as a filter tag.</span>
                            </div>

                            <div>
                              <label className="block text-slate-600 font-bold mb-1.5" htmlFor="custom-instruction-field">
                                Custom Gemini Instructions (Optional)
                              </label>
                              <textarea
                                id="custom-instruction-field"
                                rows={2}
                                value={tunePrompt}
                                onChange={(e) => setTunePrompt(e.target.value)}
                                placeholder="e.g. Avoid processed products. Only select organic loose fresh produce."
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-hidden focus:border-slate-900 focus:ring-1 focus:ring-slate-900 resize-none"
                              />
                            </div>

                            <div className="flex gap-2.5 pt-2">
                              <button
                                type="button"
                                onClick={() => { 
                                  console.log("Button clicked, tuningIngredient:", tuningIngredient);
                                  applyCustomRulesForIngredient(tuningIngredient!);
                                }}
                                disabled={loading}
                                className={`z-50 flex-1 font-bold py-2.5 px-4 rounded-lg transition-all duration-300 cursor-pointer text-xs text-center font-semibold ${
                                  loading
                                    ? "bg-slate-700 text-slate-300"
                                    : btnAnimation
                                      ? "bg-emerald-500 text-white scale-[0.97] shadow-lg"
                                      : "bg-slate-900 text-white hover:bg-slate-800"
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                {loading ? "Optimizing..." : btnAnimation ? "Applied!" : "Apply Rules"}
                              </button>
                              {customRules[tuningIngredient] && (
                                <button
                                  onClick={() => resetCustomRulesForIngredient(tuningIngredient)}
                                  disabled={loading}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-lg transition-all cursor-pointer disabled:opacity-50 text-xs text-center border border-slate-200"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Manual Product Overrides Display */}
                          {Object.keys(productOverrides).length > 0 && (
                            <div className="border-t border-slate-100 pt-4 mt-4">
                              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                                Persistent Product Overrides
                              </h4>
                              <div className="space-y-1">
                                {Object.entries(productOverrides).map(([name, status]) => (
                                  <div key={name} className="flex items-center justify-between bg-slate-100 p-1.5 rounded text-[10px]">
                                    <span className="truncate max-w-[150px] font-medium" title={name}>{name}</span>
                                    <div className="flex items-center gap-1">
                                      <span className={`font-bold ${status === 'include' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                        {status === 'include' ? 'Included' : 'Excluded'}
                                      </span>
                                      <button onClick={() => resetProductOverride(name)} className="text-slate-400 hover:text-rose-500 ml-1">×</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Supermarket Search Explorer & Filters Status (span 7) */}
                    <div className="lg:col-span-7 border border-slate-200 rounded-xl p-4 bg-white shadow-2xs flex flex-col min-h-[450px]">
                      {!tuningIngredient ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
                          <Sliders className="w-10 h-10 stroke-1 mb-3 text-slate-300" />
                          <p className="text-xs font-semibold">Select an ingredient from the list to explore catalog search results.</p>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col h-full">
                          {/* Profile Header */}
                          <div className="border-b border-slate-100 pb-3 mb-4 flex items-center justify-between flex-wrap gap-2">
                            <div>
                              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Search className="w-4 h-4 text-emerald-500 animate-pulse" />
                                Supermarket Search Index (Top 20)
                              </h3>
                              <p className="text-[10px] text-slate-400 font-medium mt-0.5 leading-relaxed">
                                Matches shown in green passed the LLM classification, while red items were filtered.
                              </p>
                            </div>
                            {optResults?.nlpProfiles?.[tuningIngredient] && (
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 max-w-[280px]">
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 leading-none">LLM generated filters:</div>
                                <div className="flex flex-wrap gap-1">
                                  {optResults.nlpProfiles[tuningIngredient].positive_keywords.map((kw: string) => (
                                    <span key={kw} className="bg-emerald-50 text-emerald-700 text-[8px] font-bold px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-wider leading-none">+{kw}</span>
                                  ))}
                                  {optResults.nlpProfiles[tuningIngredient].negative_keywords.slice(0, 5).map((kw: string) => (
                                    <span key={kw} className="bg-rose-50 text-rose-700 text-[8px] font-bold px-1.5 py-0.5 rounded border border-rose-100 uppercase tracking-wider leading-none font-semibold">-{kw}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Supermarket products */}
                          <div className="flex-1 space-y-4 overflow-y-auto max-h-[480px] pr-1 custom-scrollbar">
                            {!optResults?.allFoundProducts ? (
                              <div className="py-20 text-center text-slate-400">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-slate-300" />
                                <p className="text-xs font-medium">Please run portion optimization first to populate the search index cache...</p>
                              </div>
                            ) : (
                              optResults.nearbyStores.map((store: any) => {
                                const products = optResults.allFoundProducts[store.store_id]?.[tuningIngredient] || [];
                                const passedCount = products.filter((p: any) => p.is_matched).length;
                                return (
                                  <div key={store.store_id} className="space-y-2 border border-slate-100 rounded-xl p-3 bg-slate-50/25">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 mb-2">
                                      <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-amber-500" />
                                        Pak'nSave {store.name}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-bold bg-white px-2 py-0.5 rounded-full border border-slate-100">
                                        {passedCount} / {products.length} matched
                                      </span>
                                    </div>

                                    {products.length === 0 ? (
                                      <p className="text-[10px] text-slate-400 italic py-2">No products loaded in the search index for this ingredient.</p>
                                    ) : (
                                      <div className="divide-y divide-slate-100">
                                        {products.map((p: any, idx: number) => (
                                          <div key={idx} className="py-2 flex items-center justify-between gap-3 text-xs">
                                            <div className="flex flex-col min-w-0">
                                              <span className="font-semibold text-slate-800 leading-tight truncate">
                                                {p.name}
                                              </span>
                                              <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                                {p.brand || "Generics / Bulk Fresh"} • {p.units || "Loose unit"}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                              <span className="font-bold text-slate-700 text-xs">${parseFloat(p.price).toFixed(2)}</span>
                                              <button 
                                                onClick={() => toggleProductOverride(p.name, getProductMatchedStatus(p))}
                                                className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                                  getProductMatchedStatus(p)
                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-150" 
                                                    : "bg-rose-50 text-rose-700 border border-rose-150"
                                                }`}
                                              >
                                                {getProductMatchedStatus(p) ? "Matched" : "Filtered"}
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>

        </section>

      </main>

      {/* FOOTER METRICS */}
      <footer id="app-footer" className="bg-white border-t border-slate-200 py-4.5 px-6 text-center text-xs text-slate-400 mt-10">
        <p className="font-medium">© 2026 NZ Meal Cost Optimizer • Polished with premium design guidelines & deep culinary AI models.</p>
        <p className="text-[10px] text-slate-300 mt-1 font-semibold">Database estimates represent Auckland regional catalogs. Direct APIs cached for fast comparison matching.</p>
      </footer>
    </div>
  );
}
