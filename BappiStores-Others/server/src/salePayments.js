import { debtStatus } from "./middleware.js";

export const PAYMENT_METHODS = ["cash", "pos"];

/** POS and bank transfer are recorded as `pos`. Legacy `transfer` is accepted. */
export function normalizePaymentMethod(method) {
  const m = String(method || "cash").toLowerCase();
  if (m === "transfer") return "pos";
  return m;
}

export function normalizePaymentsInput(rows, totalAmount) {
  const payments = (rows || [])
    .map((p) => ({
      method: normalizePaymentMethod(p.method),
      amount: Math.round(Number(p.amount) || 0),
    }))
    .filter((p) => p.amount > 0);

  if (payments.some((p) => !PAYMENT_METHODS.includes(p.method))) {
    return { error: "Invalid payment method. Use cash or POS / transfer." };
  }

  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  if (amountPaid > totalAmount) {
    return { error: "Amount paid cannot exceed sale total" };
  }

  const creditBalance = totalAmount - amountPaid;
  let type = "paid";
  if (creditBalance > 0 && amountPaid > 0) type = "partial";
  if (creditBalance > 0 && amountPaid <= 0) type = "credit";

  return { payments, amountPaid, creditBalance, type };
}

export function normalizeSaleRecord(sale) {
  const total = sale.totalAmount || 0;
  let amountPaid = sale.amountPaid ?? 0;
  let creditBalance = sale.creditBalance ?? 0;
  let payments = (sale.payments?.length ? sale.payments : []).map((p) => ({
    ...p,
    method: normalizePaymentMethod(p.method),
  }));
  let type = sale.type || "paid";

  if (type === "cash") {
    type = "paid";
    amountPaid = total;
    creditBalance = 0;
    if (!payments.length) payments = [{ method: "cash", amount: total }];
  } else if (type === "credit" && !sale.amountPaid && sale.amountPaid !== 0) {
    type = "credit";
    amountPaid = 0;
    creditBalance = total;
  }

  if (creditBalance === 0 && amountPaid >= total && total > 0) type = "paid";
  if (amountPaid > 0 && creditBalance > 0) type = "partial";

  return { ...sale.toObject?.() ?? sale, type, amountPaid, creditBalance, payments };
}

export function debtFieldsFromSale(creditBalance) {
  return {
    totalAmount: creditBalance,
    amountPaid: 0,
    balance: creditBalance,
    status: debtStatus(creditBalance, creditBalance),
  };
}
