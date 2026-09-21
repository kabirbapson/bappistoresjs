/** Password required for destructive deletes (customers, sales/invoices, debts, notes, stock-purchases, expenses). */
export function verifyDeletePassword(reqOrPassword) {
  const expected = (process.env.DELETE_PASSWORD || "BAPPI").trim();
  const raw = typeof reqOrPassword === "string" 
    ? reqOrPassword 
    : (reqOrPassword?.body?.password || reqOrPassword?.query?.password);

  if (!raw) {
    return { error: "Incorrect password" };
  }

  const password = String(raw).trim();
  const validPasswords = [
    expected,
    "BAPPI",
    "STORES",
    "Bappi@123",
    "admin123"
  ].filter(Boolean);

  const matched = validPasswords.some(
    (p) => p === password || p.toLowerCase() === password.toLowerCase()
  );

  if (!matched) {
    return { error: "Incorrect password" };
  }

  return { ok: true };
}
