import { nextInvoiceNumber } from "./invoice.js";
import { Sale } from "./models.js";

/** Fix duplicate invoice numbers (safe while server is already connected to DB). */
export async function fixDuplicateInvoices() {
  const sales = await Sale.find({ invoiceNumber: { $exists: true, $ne: null } })
    .sort({ createdAt: 1 })
    .lean();

  const seen = new Map();
  const changes = [];
  let fixed = 0;

  for (const sale of sales) {
    const key = sale.invoiceNumber;
    if (!seen.has(key)) {
      seen.set(key, sale._id);
      continue;
    }

    const newNumber = await nextInvoiceNumber();
    await Sale.updateOne({ _id: sale._id }, { $set: { invoiceNumber: newNumber } });
    changes.push(`${key} → ${newNumber}`);
    fixed += 1;
  }

  return {
    ok: true,
    fixed,
    message: fixed
      ? `Fixed ${fixed} duplicate invoice(s).`
      : "No duplicate invoices found.",
    changes,
  };
}
