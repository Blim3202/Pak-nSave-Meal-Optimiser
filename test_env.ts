import dotenv from "dotenv";
dotenv.config();

function dumpEnv() {
  console.log("=== ENVIRONMENT KEYS ===");
  for (const key of Object.keys(process.env).sort()) {
    const val = process.env[key] || "";
    let display = "undefined";
    if (val) {
      display = val.length > 10 
        ? `${val.substring(0, 5)}... (len: ${val.length})` 
        : `val: ${val}`;
    }
    console.log(`${key}: ${display}`);
  }
}

dumpEnv();
