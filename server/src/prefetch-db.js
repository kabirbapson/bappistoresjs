/**
 * Downloads / verifies the built-in MongoDB binary during SETUP (before seed).
 */
import "dotenv/config";
import { closeDB, connectDB } from "./config/db.js";

import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const bundledMongod = path.join(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.."),
  "bundled",
  "mongod.exe",
);

console.log("  → Connecting to built-in database engine…");
if (existsSync(bundledMongod)) {
  console.log("  → Using bundled MongoDB (no download)…");
} else {
  console.log("  → First time: downloads ~600MB then starts (2–5 min on slow PCs)…");
}
console.log("  → Please wait — do not close this window…");

await connectDB(process.env.MONGO_URI || "");

console.log("  → Built-in database engine is ready.");
await closeDB();
process.exit(0);
