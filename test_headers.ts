import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Save the original fetch
const originalFetch = globalThis.fetch;

// Intercept global fetch
globalThis.fetch = async function (input: any, init: any) {
  const url = input.toString();
  console.log("\n================ GLOBAL FETCH INTERCEPTED ================");
  console.log("URL:", url);
  if (init) {
    console.log("Method:", init.method || "GET");
    
    // Extract headers correctly
    const headerObj: any = {};
    if (init.headers) {
      if (typeof init.headers.forEach === 'function') {
        init.headers.forEach((value: string, key: string) => {
          headerObj[key] = value;
        });
      } else if (typeof init.headers.entries === 'function') {
        for (const [key, value] of init.headers.entries()) {
          headerObj[key] = value;
        }
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          headerObj[key] = value;
        }
      } else {
        Object.assign(headerObj, init.headers);
      }
    }
    
    // Mask sensitive authorization info
    const maskedHeaders = { ...headerObj };
    if (maskedHeaders.authorization) {
      maskedHeaders.authorization = maskedHeaders.authorization.substring(0, 15) + "...";
    }
    if (maskedHeaders["x-goog-api-key"]) {
      maskedHeaders["x-goog-api-key"] = maskedHeaders["x-goog-api-key"].substring(0, 10) + "...";
    }
    
    console.log("Headers:");
    console.log(JSON.stringify(maskedHeaders, null, 2));
  }
  console.log("==========================================================\n");
  
  return originalFetch(input, init);
};

async function testHeaders() {
  const key = process.env.GEMINI_API_KEY!;
  
  const ai = new GoogleGenAI({
    apiKey: key,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      }
    }
  });

  try {
    await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Hi",
    });
  } catch (err: any) {
    console.error("Test finished with error:", err.message);
  }
}

testHeaders();
