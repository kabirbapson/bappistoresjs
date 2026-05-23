import { Sale } from "./models.js";
import { normalizeSaleRecord } from "./salePayments.js";

function todayInvoicePrefix(now = new Date()) {
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `BSK-${yy}${mm}${dd}-`;
}

/** Next invoice # for today — uses highest existing BSK-YYMMDD-### (avoids duplicate key races). */
export async function nextInvoiceNumber() {
  const prefix = todayInvoicePrefix();
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const latest = await Sale.findOne({
    invoiceNumber: { $regex: `^${escaped}` },
  })
    .sort({ invoiceNumber: -1 })
    .select("invoiceNumber")
    .lean();

  let seq = 1;
  if (latest?.invoiceNumber?.startsWith(prefix)) {
    const tail = latest.invoiceNumber.slice(prefix.length);
    const n = Number.parseInt(tail, 10);
    if (Number.isFinite(n) && n >= seq) seq = n + 1;
  }

  return `${prefix}${String(seq).padStart(3, "0")}`;
}

function isDuplicateInvoiceError(err) {
  return err?.code === 11000 && (err?.keyPattern?.invoiceNumber || /invoiceNumber/.test(String(err?.message)));
}

/** Create sale with automatic retry if two checkouts race for the same invoice #. */
export async function createSaleDocument(payload) {
  const MAX_ATTEMPTS = 8;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const invoiceNumber = await nextInvoiceNumber();
    try {
      return await Sale.create({ ...payload, invoiceNumber });
    } catch (err) {
      if (isDuplicateInvoiceError(err)) continue;
      throw err;
    }
  }
  throw new Error("Could not create sale — invoice number conflict. Please try again.");
}

export function formatInvoice(sale, customer) {
  const normalized = normalizeSaleRecord(sale);
  const items = (normalized.products || []).map((line) => ({
    productId: line.productId,
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
    customerId: normalized.customerId,
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
