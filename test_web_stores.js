async function test() {
  try {
    console.log("Probing web stores APIs...");
    const urls = [
      "https://www.paknsave.co.nz/api/stores/getstores",
      "https://www.paknsave.co.nz/api/stores/getStores",
      "https://www.paknsave.co.nz/api/stores",
      "https://www.paknsave.co.nz/api/store/getstores",
      "https://www.paknsave.co.nz/api/store/getStores",
      "https://www.paknsave.co.nz/api/store"
    ];

    for (const url of urls) {
      console.log(`\nProbing: ${url}`);
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json"
          }
        });
        console.log(`Status: ${res.status}`);
        if (res.ok) {
          const text = await res.text();
          console.log("Success! Preview:", text.substring(0, 300));
        } else {
          console.log("Failed:", await res.text());
        }
      } catch (err) {
        console.log("Error probing:", err.message);
      }
    }
  } catch (err) {
    console.error(err);
  }
}
test();
