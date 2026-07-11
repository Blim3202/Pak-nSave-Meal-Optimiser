import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function testGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("GEMINI_API_KEY is not defined in environment.");
    return;
  }
  console.log("GEMINI_API_KEY is defined. Length:", key.length);
  console.log("Starts with:", key.substring(0, 10));
  
  try {
    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    console.log("Calling ai.models.generateContent with model: gemini-3.5-flash...");
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Hello! Reply in exactly three words.",
    });

    console.log("Success! Response:");
    console.log(response.text);
  } catch (error: any) {
    console.error("Error encountered calling Gemini:");
    console.error(error);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testGemini();
