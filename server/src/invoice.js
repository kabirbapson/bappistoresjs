import { Sale } from "./models.js";
import { normalizeSaleRecord } from "./salePayments.js";

export async function nextInvoiceNumber() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const count = await Sale.countDocuments({ createdAt: { $gte: start } });
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const seq = String(count + 1).padStart(3, "0");
  return `BSK-${yy}${mm}${dd}-${seq}`;
}

export function formatInvoice(sale, customer) {
  const normalized = normalizeSaleRecord(sale);
  const items = (normalized.products || []).map((line) => ({
    productName: line.productName || "Item",
    quantity: line.quantity,
    unitPrice: line.sellingPrice,
    lineTotal: line.quantity * line.sellingPrice,
  }));

  return {
    _id: normalized._id,
    invoiceNumber: normalized.invoiceNumber,
    date: normalized.date || normalized.createdAt,
    type: normalized.type,
    customerName: normalized.customerName || customer?.name || "Walk-in",
    customerPhone: customer?.phone || "",
    customerAddress: customer?.address || "",
    note: normalized.note || "",
    items,
    totalAmount: normalized.totalAmount,
    amountPaid: normalized.amountPaid,
    creditBalance: normalized.creditBalance,
    payments: normalized.payments || [],
  };
}
