async function test() {
  try {
    const loginRes = await fetch("https://api-prod.prod.fsniwaikato.kiwi/prod/mobile/user/login/guest", {
      method: "POST",
      headers: {
        "User-Agent": "PAKnSAVEApp/4.32.0",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ banner: "PNS" })
    });
    
    if (loginRes.ok) {
      const data = await loginRes.json();
      console.log("Login full response:", JSON.stringify(data, null, 2));
    } else {
      console.log("Login failed:", loginRes.status, await loginRes.text());
    }
  } catch (err) {
    console.error(err);
  }
}
test();
