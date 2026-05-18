/**
 * Renumber duplicate invoice numbers so the server can start cleanly.
 * Run: node src/fix-duplicate-invoices.js   (from server folder)
 */
import "dotenv/config";
import { closeDB, connectDB } from "./config/db.js";
import { Sale } from "./models.js";
import { nextInvoiceNumber } from "./invoice.js";

await connectDB(process.env.MONGO_URI || "");

const sales = await Sale.find({ invoiceNumber: { $exists: true, $ne: null } })
  .sort({ createdAt: 1 })
  .lean();

const seen = new Map();
let fixed = 0;

for (const sale of sales) {
  const key = sale.invoiceNumber;
  if (!seen.has(key)) {
    seen.set(key, sale._id);
    continue;
  }

  const newNumber = await nextInvoiceNumber();
  await Sale.updateOne({ _id: sale._id }, { $set: { invoiceNumber: newNumber } });
  console.log(`  ${key} → ${newNumber} (${sale._id})`);
  fixed += 1;
}

console.log(fixed ? `Fixed ${fixed} duplicate invoice(s).` : "No duplicate invoices found.");
await closeDB();
process.exit(0);
