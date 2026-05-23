/**
 * Offline fix (database must not be in use). Prefer scripts/fix-invoices.mjs
 * while START.bat is running — no need to close the app.
 */
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { closeDB, connectDB } from "./config/db.js";
import { fixDuplicateInvoices } from "./fixDuplicateInvoices.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

let exitCode = 0;

try {
  await connectDB(process.env.MONGO_URI || "");
  const result = await fixDuplicateInvoices();
  console.log(`\n${result.message}`);
  for (const line of result.changes) console.log(`  ${line}`);
} catch (err) {
  exitCode = 1;
  const msg = String(err?.message || err).toLowerCase();
  console.error("\nERROR:", err.message || err);
  if (msg.includes("lock") || msg.includes("already in use") || msg.includes("eaddrinuse")) {
    console.error(`
Database is locked. Either:
  • Leave START.bat OPEN and run FIX-INVOICES.bat again (uses live fix), or
  • Run STOP-APP.bat, wait 10 seconds, then FIX-INVOICES.bat
`);
  }
} finally {
  try {
    await closeDB();
  } catch {
    /* ignore */
  }
  process.exit(exitCode);
}
