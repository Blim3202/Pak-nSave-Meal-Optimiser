import dotenv from "dotenv";
dotenv.config();

async function testBearerToken() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error("No key found.");
    return;
  }
  
  console.log("Testing REST call with Authorization: Bearer <AQ...>");
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "Hello! Reply in exactly three words." }] }]
      })
    });
    
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

testBearerToken();
