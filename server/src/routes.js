import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { stringify } from "csv-stringify/sync";
import { auth, debtStatus } from "./middleware.js";
import { formatInvoice, nextInvoiceNumber } from "./invoice.js";
import { buildDateRange, buildFinancialReport } from "./reports.js";
import {
  debtFieldsFromSale,
  normalizePaymentMethod,
  normalizePaymentsInput,
  normalizeSaleRecord,
} from "./salePayments.js";
import { verifyDeletePassword } from "./deleteAuth.js";
import { productImageUpload } from "./productUpload.js";
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
  const limit = Math.min(Number(req.query.limit || 20), 200);
  const q = req.query.q || "";
  const filter = q ? { name: { $regex: q, $options: "i" } } : {};
  const [items, total] = await Promise.all([
    Product.find(filter).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }),
    Product.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.ceil(total / limit) });
});
router.post("/products/image", (req, res, next) => {
  productImageUpload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Upload failed" });
    }
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    res.status(201).json({ imageUrl: `/uploads/products/${req.file.filename}` });
  });
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
  const filter = q
    ? {
        $or: [
          { name: { $regex: q, $options: "i" } },
          { phone: { $regex: q, $options: "i" } },
          { address: { $regex: q, $options: "i" } },
        ],
      }
    : {};
  const items = await Customer.find(filter).sort({ createdAt: -1 });
  res.json({ items });
});
router.post("/customers", async (req, res) => res.status(201).json(await Customer.create(req.body)));
router.put("/customers/:id", async (req, res) => {
  const doc = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!doc) return res.status(404).json({ message: "Customer not found" });
  res.json(doc);
});
router.delete("/customers/:id", async (req, res) => {
  const check = verifyDeletePassword(req);
  if (check.error) return res.status(403).json({ message: check.error });

  const openDebt = await Debt.findOne({ customerId: req.params.id, balance: { $gt: 0 } });
  if (openDebt) {
    return res.status(400).json({ message: "Customer has outstanding debt — settle on Debts page first" });
  }
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
router.get("/customers/:id/ledger", async (req, res) => {
  const { id } = req.params;
  const sales = await Sale.find({ customerId: id }).sort({ date: -1 });
  const payments = await Payment.find({ customerId: id }).sort({ date: -1 });
  const ledger = [
    ...sales.map((s) => ({ date: s.date, type: "purchase", amount: s.totalAmount, id: s._id })),
    ...payments.map((p) => ({ date: p.date, type: "payment", amount: p.amount, id: p._id })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json({ items: ledger });
});

async function resolveCustomer({ customerId, customerName }) {
  let customer = null;
  let name = (customerName || "").trim();

  if (customerId) {
    customer = await Customer.findById(customerId);
    if (!customer) return { error: "Customer not found" };
    name = customer.name;
  }

  if (!name) {
    return { error: "Customer name is required (select a customer or enter a walk-in name)" };
  }

  return { customer, customerName: name, customerId: customer?._id };
}

router.post("/sales", async (req, res) => {
  const { products, customerId, customerName, note, payments } = req.body;

  const resolved = await resolveCustomer({ customerId, customerName });
  if (resolved.error) return res.status(400).json({ message: resolved.error });

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

    const listPrice = Number(product.sellingPrice) || 0;
    const unitPrice =
      item.unitPrice != null && item.unitPrice !== ""
        ? Number(item.unitPrice)
        : listPrice;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ message: `Invalid sale price for ${product.name}` });
    }
    if (unitPrice > listPrice) {
      return res.status(400).json({
        message: `Sale price cannot be above list price (${listPrice}) for ${product.name}`,
      });
    }

    totalAmount += unitPrice * Number(item.quantity);
    totalCost += product.costPrice * Number(item.quantity);
    saleProducts.push({
      productId: product._id,
      productName: product.name,
      quantity: Number(item.quantity),
      costPrice: product.costPrice,
      sellingPrice: unitPrice,
    });
  }

  const pay = normalizePaymentsInput(payments, totalAmount);
  if (pay.error) return res.status(400).json({ message: pay.error });

  if (pay.creditBalance > 0 && !resolved.customerId) {
    return res.status(400).json({
      message: "Register the customer to record credit or partial payment",
    });
  }

  const invoiceNumber = await nextInvoiceNumber();
  const sale = await Sale.create({
    invoiceNumber,
    products: saleProducts,
    totalAmount,
    totalCost,
    profit: totalAmount - totalCost,
    type: pay.type,
    amountPaid: pay.amountPaid,
    creditBalance: pay.creditBalance,
    payments: pay.payments,
    customerId: resolved.customerId,
    customerName: resolved.customerName,
    note,
  });

  if (pay.creditBalance > 0) {
    await Debt.create({
      customerId: resolved.customerId,
      saleId: sale._id,
      ...debtFieldsFromSale(pay.creditBalance),
    });
  }

  res.status(201).json(formatInvoice(sale, resolved.customer));
});

router.get("/sales", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const items = await Sale.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("customerId");
  res.json({
    items: items.map((s) => formatInvoice(s, s.customerId)),
  });
});

router.get("/sales/:id", async (req, res) => {
  const sale = await Sale.findById(req.params.id).populate("customerId");
  if (!sale) return res.status(404).json({ message: "Sale not found" });
  res.json(formatInvoice(sale, sale.customerId));
});

router.delete("/sales/:id", async (req, res) => {
  const check = verifyDeletePassword(req);
  if (check.error) return res.status(403).json({ message: check.error });

  const sale = await Sale.findById(req.params.id);
  if (!sale) return res.status(404).json({ message: "Sale not found" });

  for (const line of sale.products || []) {
    const product = await Product.findById(line.productId);
    if (!product) continue;
    const qty = Number(line.quantity) || 0;
    product.quantity += qty;
    await product.save();
    await StockLog.create({ productId: product._id, change: qty, type: "restock" });
  }

  const debt = await Debt.findOne({ saleId: sale._id });
  if (debt) {
    await Payment.deleteMany({ debtId: debt._id });
    await Debt.findByIdAndDelete(debt._id);
  }

  await Sale.findByIdAndDelete(sale._id);
  res.json({ ok: true });
});

router.get("/debts", async (req, res) => res.json({ items: await Debt.find().populate("customerId").sort({ createdAt: -1 }) }));
router.get("/debts/:id", async (req, res) => res.json(await Debt.findById(req.params.id).populate("customerId")));

router.delete("/debts/:id", async (req, res) => {
  const check = verifyDeletePassword(req);
  if (check.error) return res.status(403).json({ message: check.error });

  const debt = await Debt.findById(req.params.id);
  if (!debt) return res.status(404).json({ message: "Debt not found" });

  await Payment.deleteMany({ debtId: debt._id });

  if (debt.saleId) {
    const sale = await Sale.findById(debt.saleId);
    if (sale) {
      const total = sale.totalAmount || 0;
      const paid = sale.amountPaid || 0;
      sale.creditBalance = 0;
      if (paid >= total && total > 0) sale.type = "paid";
      else if (paid > 0) sale.type = "partial";
      else sale.type = "paid";
      await sale.save();
    }
  }

  await Debt.findByIdAndDelete(debt._id);
  res.json({ ok: true });
});

router.post("/payments", async (req, res) => {
  const { debtId, amount, method } = req.body;
  const debt = await Debt.findById(debtId);
  if (!debt) return res.status(404).json({ message: "Debt not found" });
  debt.amountPaid += Number(amount);
  debt.balance = Math.max(0, debt.totalAmount - debt.amountPaid);
  debt.status = debtStatus(debt.balance, debt.totalAmount);
  await debt.save();
  const normalizedMethod = normalizePaymentMethod(method);
  if (!["cash", "pos"].includes(normalizedMethod)) {
    return res.status(400).json({ message: "Invalid payment method. Use cash or POS / transfer." });
  }
  const payment = await Payment.create({
    debtId,
    customerId: debt.customerId,
    amount,
    method: normalizedMethod,
  });
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
    Payment.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);
  const totalStockValue = products.reduce((acc, p) => acc + p.quantity * p.costPrice, 0);
  const dailySales = await Sale.aggregate([
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, amount: { $sum: "$totalAmount" } } },
    { $sort: { _id: 1 } },
    { $limit: 14 },
  ]);
  res.json({
    cards: {
      totalProducts,
      totalStockValue,
      lowStockAlerts: lowStock,
      dailySales: todaySales[0]?.total || 0,
      outstandingDebt: debtTotals[0]?.total || 0,
      totalPaymentsReceived: paymentTotals[0]?.total || 0,
    },
    dailySales,
  });
});

router.get("/reports/detailed", async (req, res) => {
  const { from, to } = buildDateRange(req.query);
  const report = await buildFinancialReport(from, to);
  res.json({
    period: req.query.period || "month",
    from,
    to,
    ...report,
    sales: report.sales.map((s) => formatInvoice(s, s.customerId)),
  });
});

router.get("/reports/export", async (req, res) => {
  const period = req.query.period || "daily";
  const format = period === "monthly" ? "%Y-%m" : period === "weekly" ? "%Y-%U" : "%Y-%m-%d";
  const rows = await Sale.aggregate([
    { $group: { _id: { $dateToString: { format, date: "$date" } }, sales: { $sum: "$totalAmount" }, profit: { $sum: "$profit" } } },
    { $sort: { _id: 1 } },
  ]);
  const csv = stringify(rows, { header: true, columns: ["_id", "sales", "profit"] });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${period}-report.csv"`);
  res.send(csv);
});

export default router;
