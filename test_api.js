async function test() {
  try {
    console.log("Starting API probe...");
    const loginRes = await fetch("https://api-prod.prod.fsniwaikato.kiwi/prod/mobile/user/login/guest", {
      method: "POST",
      headers: {
        "User-Agent": "PAKnSAVEApp/4.32.0",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ banner: "PNS" })
    });
    
    if (!loginRes.ok) {
      console.error("Login failed:", loginRes.status, await loginRes.text());
      return;
    }
    
    const loginData = await loginRes.json();
    const token = loginData.access_token;
    console.log("Logged in successfully! Token received:", token ? token.substring(0, 20) + "..." : "none");
    
    const headers = {
      "Authorization": `Bearer ${token}`,
      "access_token": token,
      "User-Agent": "PAKnSAVEApp/4.32.0",
      "Content-Type": "application/json"
    };

    // Try various endpoints to find stores
    const endpoints = [
      "https://api-prod.prod.fsniwaikato.kiwi/prod/mobile/stores",
      "https://api-prod.prod.fsniwaikato.kiwi/prod/mobile/stores/PNS",
      "https://api-prod.prod.fsniwaikato.kiwi/prod/mobile/ecomm-stores",
      "https://api-prod.prod.fsniwaikato.kiwi/prod/mobile/ecomm-stores/PNS",
      "https://api-prod.prod.fsniwaikato.kiwi/prod/mobile/stores/banner/PNS",
      "https://api-prod.prod.fsniwaikato.kiwi/prod/mobile/ecomm-products/PNS/stores"
    ];

    for (const ep of endpoints) {
      console.log(`\nProbing: ${ep}`);
      try {
        const r = await fetch(ep, { headers });
        console.log(`Status: ${r.status}`);
        if (r.ok) {
          const data = await r.json();
          console.log("Success! Data preview:", JSON.stringify(data).substring(0, 500));
        } else {
          console.log("Failed:", await r.text());
        }
      } catch (e) {
        console.log("Error probing:", e.message);
      }
    }

  } catch (err) {
    console.error("Unhandle error in probe:", err);
  }
}

test();
