import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { stringify } from "csv-stringify/sync";
import { auth, debtStatus } from "./middleware.js";
import { Customer, Debt, Payment, Product, Sale, StockLog, User } from "./models.js";

const router = express.Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });
  const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1d" });
  res.json({ token, user: { id: user._id, email: user.email } });
});

router.use(auth);

router.get("/products", async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const q = req.query.q || "";
  const filter = q ? { name: { $regex: q, $options: "i" } } : {};
  const [items, total] = await Promise.all([
    Product.find(filter).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }),
    Product.countDocuments(filter)
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
router.post("/products", async (req, res) => res.status(201).json(await Product.create(req.body)));
router.put("/products/:id", async (req, res) => res.json(await Product.findByIdAndUpdate(req.params.id, req.body, { new: true })));
router.delete("/products/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
router.post("/products/:id/restock", async (req, res) => {
  const qty = Number(req.body.quantity || 0);
  const product = await Product.findById(req.params.id);
  product.quantity += qty;
  await product.save();
  await StockLog.create({ productId: product._id, change: qty, type: "restock" });
  res.json(product);
});

router.get("/customers", async (req, res) => {
  const q = req.query.q || "";
  const filter = q ? { name: { $regex: q, $options: "i" } } : {};
  const items = await Customer.find(filter).sort({ createdAt: -1 });
  res.json({ items });
});
router.post("/customers", async (req, res) => res.status(201).json(await Customer.create(req.body)));
router.get("/customers/:id/ledger", async (req, res) => {
  const { id } = req.params;
  const sales = await Sale.find({ customerId: id }).sort({ date: -1 });
  const payments = await Payment.find({ customerId: id }).sort({ date: -1 });
  const ledger = [
    ...sales.map((s) => ({ date: s.date, type: "purchase", amount: s.totalAmount, id: s._id })),
    ...payments.map((p) => ({ date: p.date, type: "payment", amount: p.amount, id: p._id }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ items: ledger });
});

router.post("/sales", async (req, res) => {
  const { products, type, customerId, note } = req.body;
  let totalAmount = 0;
  let totalCost = 0;
  const saleProducts = [];

  for (const item of products) {
    const product = await Product.findById(item.productId);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.quantity < item.quantity) {
      return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
    }
    product.quantity -= Number(item.quantity);
    await product.save();
    await StockLog.create({ productId: product._id, change: -Number(item.quantity), type: "sale" });

    totalAmount += product.sellingPrice * Number(item.quantity);
    totalCost += product.costPrice * Number(item.quantity);
    saleProducts.push({
      productId: product._id,
      quantity: Number(item.quantity),
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice
    });
  }

  const sale = await Sale.create({ products: saleProducts, totalAmount, totalCost, profit: totalAmount - totalCost, type, customerId: customerId || undefined, note });
  if (type === "credit") {
    await Debt.create({
      customerId,
      saleId: sale._id,
      totalAmount,
      amountPaid: 0,
      balance: totalAmount,
      status: "unpaid"
    });
  }
  res.status(201).json(sale);
});

router.get("/sales", async (req, res) => res.json({ items: await Sale.find().sort({ createdAt: -1 }) }));

router.get("/debts", async (req, res) => res.json({ items: await Debt.find().populate("customerId").sort({ createdAt: -1 }) }));
router.get("/debts/:id", async (req, res) => res.json(await Debt.findById(req.params.id).populate("customerId")));

router.post("/payments", async (req, res) => {
  const { debtId, amount, method } = req.body;
  const debt = await Debt.findById(debtId);
  if (!debt) return res.status(404).json({ message: "Debt not found" });
  debt.amountPaid += Number(amount);
  debt.balance = Math.max(0, debt.totalAmount - debt.amountPaid);
  debt.status = debtStatus(debt.balance, debt.totalAmount);
  await debt.save();
  const payment = await Payment.create({ debtId, customerId: debt.customerId, amount, method });
  res.status(201).json({ payment, debt });
});
router.get("/payments", async (req, res) => res.json({ items: await Payment.find().sort({ createdAt: -1 }) }));

router.get("/reports/dashboard", async (_req, res) => {
  const [totalProducts, lowStock, products, todaySales, debtTotals, paymentTotals] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ quantity: { $lte: 5 } }),
    Product.find(),
    Sale.aggregate([{ $match: { date: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }, { $group: { _id: null, total: { $sum: "$totalAmount" } } }]),
    Debt.aggregate([{ $group: { _id: null, total: { $sum: "$balance" } } }]),
    Payment.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
  ]);
  const totalStockValue = products.reduce((acc, p) => acc + p.quantity * p.costPrice, 0);
  const dailySales = await Sale.aggregate([
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, amount: { $sum: "$totalAmount" } } },
    { $sort: { _id: 1 } },
    { $limit: 14 }
  ]);
  res.json({
    cards: {
      totalProducts,
      totalStockValue,
      lowStockAlerts: lowStock,
      dailySales: todaySales[0]?.total || 0,
      outstandingDebt: debtTotals[0]?.total || 0,
      totalPaymentsReceived: paymentTotals[0]?.total || 0
    },
    dailySales
  });
});

router.get("/reports/export", async (req, res) => {
  const period = req.query.period || "daily";
  const format = period === "monthly" ? "%Y-%m" : period === "weekly" ? "%Y-%U" : "%Y-%m-%d";
  const rows = await Sale.aggregate([
    { $group: { _id: { $dateToString: { format, date: "$date" } }, sales: { $sum: "$totalAmount" }, profit: { $sum: "$profit" } } },
    { $sort: { _id: 1 } }
  ]);
  const csv = stringify(rows, { header: true, columns: ["_id", "sales", "profit"] });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${period}-report.csv"`);
  res.send(csv);
});

export default router;
