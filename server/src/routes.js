import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { stringify } from "csv-stringify/sync";
import { auth, debtStatus } from "./middleware.js";
import { createSaleDocument, formatInvoice } from "./invoice.js";
import { buildDateRange, buildFinancialReport } from "./reports.js";
import {
  debtFieldsFromSale,
  normalizePaymentMethod,
  normalizePaymentsInput,
  normalizeSaleRecord,
} from "./salePayments.js";
import { verifyDeletePassword } from "./deleteAuth.js";
import { applySaleStockChange } from "./saleStock.js";
import { markShopHasRealData } from "./shopDataMarker.js";
import { productImageUpload } from "./productUpload.js";
import { fixDuplicateInvoices } from "./fixDuplicateInvoices.js";
import { Customer, Debt, Payment, Product, Sale, StockLog, User } from "./models.js";

const router = express.Router();

/** Fix duplicate invoice numbers — no app restart; use FIX-INVOICES.bat while shop is open. */
router.post("/maintenance/fix-invoices", async (req, res) => {
  const key = req.headers["x-maintenance-key"];
  const expected = process.env.MAINTENANCE_SECRET || "local-fix-invoices";
  if (!key || key !== expected) {
    return res.status(403).json({ message: "Invalid maintenance key" });
  }
  try {
    const result = await fixDuplicateInvoices();
    res.json(result);
  } catch (err) {
    console.error("fix-invoices:", err);
    res.status(500).json({ message: err.message || "Fix failed" });
  }
});

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
router.post("/products", async (req, res) => {
  const doc = await Product.create(req.body);
  markShopHasRealData();
  res.status(201).json(doc);
});
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
router.post("/customers", async (req, res) => {
  const doc = await Customer.create(req.body);
  markShopHasRealData();
  res.status(201).json(doc);
});
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

async function buildSaleProductsFromInput(products) {
  let totalAmount = 0;
  let totalCost = 0;
  const saleProducts = [];

  for (const item of products) {
    const product = await Product.findById(item.productId);
    if (!product) return { error: "Product not found" };

    const listPrice = Number(product.sellingPrice) || 0;
    const unitPrice =
      item.unitPrice != null && item.unitPrice !== ""
        ? Number(item.unitPrice)
        : listPrice;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { error: `Invalid sale price for ${product.name}` };
    }
    if (unitPrice > listPrice) {
      return {
        error: `Sale price cannot be above list price (${listPrice}) for ${product.name}`,
      };
    }

    const qty = Number(item.quantity);
    totalAmount += unitPrice * qty;
    totalCost += product.costPrice * qty;
    saleProducts.push({
      productId: product._id,
      productName: product.name,
      quantity: qty,
      costPrice: product.costPrice,
      sellingPrice: unitPrice,
    });
  }

  return { saleProducts, totalAmount, totalCost };
}

async function deductStockForNewSale(products) {
  for (const item of products) {
    const product = await Product.findById(item.productId);
    if (!product) return { error: "Product not found" };
    if (product.quantity < item.quantity) {
      return { error: `Insufficient stock for ${product.name}` };
    }
    product.quantity -= Number(item.quantity);
    await product.save();
    await StockLog.create({
      productId: product._id,
      change: -Number(item.quantity),
      type: "sale",
    });
  }
  return { ok: true };
}

async function syncDebtForSale(sale, pay, customerId) {
  const debt = await Debt.findOne({ saleId: sale._id });
  const credit = pay.creditBalance;

  if (credit > 0 && !customerId) {
    return { error: "Register the customer to record credit or partial payment" };
  }

  if (!debt) {
    if (credit > 0) {
      await Debt.create({
        customerId,
        saleId: sale._id,
        ...debtFieldsFromSale(credit),
      });
    }
    return {};
  }

  const paidOnDebt = debt.amountPaid || 0;

  if (credit <= 0) {
    if (paidOnDebt > 0) {
      debt.totalAmount = paidOnDebt;
      debt.balance = 0;
      debt.status = "paid";
      await debt.save();
    } else {
      await Payment.deleteMany({ debtId: debt._id });
      await Debt.findByIdAndDelete(debt._id);
    }
    return {};
  }

  if (paidOnDebt > credit) {
    return {
      error: `Customer already paid ${paidOnDebt} on this invoice debt. New credit is ${credit}. Adjust on the Debts page first.`,
    };
  }

  debt.customerId = customerId;
  debt.totalAmount = credit;
  debt.balance = credit - paidOnDebt;
  debt.status = debtStatus(debt.balance, debt.totalAmount);
  await debt.save();
  return {};
}

router.post("/sales", async (req, res) => {
  try {
    const { products, customerId, customerName, note, payments } = req.body;

    const resolved = await resolveCustomer({ customerId, customerName });
    if (resolved.error) return res.status(400).json({ message: resolved.error });

    const stock = await deductStockForNewSale(products);
    if (stock.error) return res.status(400).json({ message: stock.error });

    const built = await buildSaleProductsFromInput(products);
    if (built.error) return res.status(400).json({ message: built.error });
    const { saleProducts, totalAmount, totalCost } = built;

    const pay = normalizePaymentsInput(payments, totalAmount);
    if (pay.error) return res.status(400).json({ message: pay.error });

    if (pay.creditBalance > 0 && !resolved.customerId) {
      return res.status(400).json({
        message: "Register the customer to record credit or partial payment",
      });
    }

    const sale = await createSaleDocument({
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

    markShopHasRealData();
    res.status(201).json(formatInvoice(sale, resolved.customer));
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "Invoice number conflict. Please try recording the sale again.",
      });
    }
    console.error("POST /sales failed:", err);
    res.status(500).json({ message: err.message || "Failed to record sale" });
  }
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

router.put("/sales/:id", async (req, res) => {
  const sale = await Sale.findById(req.params.id);
  if (!sale) return res.status(404).json({ message: "Sale not found" });

  const { products, customerId, customerName, note, payments } = req.body;

  const resolved = await resolveCustomer({ customerId, customerName });
  if (resolved.error) return res.status(400).json({ message: resolved.error });

  const built = await buildSaleProductsFromInput(products);
  if (built.error) return res.status(400).json({ message: built.error });
  const { saleProducts, totalAmount, totalCost } = built;

  const pay = normalizePaymentsInput(payments, totalAmount);
  if (pay.error) return res.status(400).json({ message: pay.error });

  if (pay.creditBalance > 0 && !resolved.customerId) {
    return res.status(400).json({
      message: "Register the customer to record credit or partial payment",
    });
  }

  const existingDebt = await Debt.findOne({ saleId: sale._id });
  if (existingDebt && pay.creditBalance > 0 && (existingDebt.amountPaid || 0) > pay.creditBalance) {
    return res.status(400).json({
      message: `Customer already paid ${existingDebt.amountPaid} on this invoice debt. New credit is ${pay.creditBalance}. Adjust on the Debts page first.`,
    });
  }

  const stock = await applySaleStockChange(sale.products, products);
  if (stock.error) return res.status(400).json({ message: stock.error });

  sale.products = saleProducts;
  sale.totalAmount = totalAmount;
  sale.totalCost = totalCost;
  sale.profit = totalAmount - totalCost;
  sale.type = pay.type;
  sale.amountPaid = pay.amountPaid;
  sale.creditBalance = pay.creditBalance;
  sale.payments = pay.payments;
  sale.customerId = resolved.customerId;
  sale.customerName = resolved.customerName;
  if (note !== undefined) sale.note = note;
  await sale.save();

  const debtSync = await syncDebtForSale(sale, pay, resolved.customerId);
  if (debtSync.error) return res.status(400).json({ message: debtSync.error });

  const populated = await Sale.findById(sale._id).populate("customerId");
  res.json(formatInvoice(populated, populated.customerId));
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
