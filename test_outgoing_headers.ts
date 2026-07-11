async function testOutgoingHeaders() {
  try {
    console.log("Fetching headers from httpbin.org...");
    const res = await fetch("https://httpbin.org/headers");
    const data = await res.json();
    console.log("Actual headers received by external server:");
    console.log(JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

testOutgoingHeaders();
