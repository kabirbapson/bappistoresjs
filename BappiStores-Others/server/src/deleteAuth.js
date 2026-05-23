/** Password required for destructive deletes (customers, sales/invoices, debts). */
export function verifyDeletePassword(req) {
  const expected = process.env.DELETE_PASSWORD || "Bappi@123";
  const password = req.body?.password;
  if (!password || password !== expected) {
    return { error: "Incorrect password" };
  }
  return {};
}
