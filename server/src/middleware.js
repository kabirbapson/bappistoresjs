import jwt from "jsonwebtoken";

export function auth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}

export function debtStatus(balance, totalAmount) {
  if (balance <= 0) return "paid";
  if (balance < totalAmount) return "partial";
  return "unpaid";
}
