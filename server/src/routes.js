import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { stringify } from "csv-stringify/sync";
import { auth, debtStatus } from "./middleware.js";
import { createSaleDocument, formatInvoice } from "./invoice.js";
import { buildDateRange, buildFinancialReport, buildProductSalesHistory } from "./reports.js";
import {
  debtFieldsFromSale,
  normalizePaymentMethod,
  normalizePaymentsInput,
  normalizeSaleRecord,
} from "./salePayments.js";
import { verifyDeletePassword } from "./deleteAuth.js";
import {
  applySaleStockChange,
  checkStockForNewSale,
  deductStockForNewSale,
  restoreStockFromNewSale,
} from "./saleStock.js";
import { LOW_STOCK_THRESHOLD, MAX_PRODUCTS_LIMIT, MAX_SALES_LIMIT } from "./constants.js";
import { markShopHasRealData } from "./shopDataMarker.js";
import { productImageUpload } from "./productUpload.js";
import {
  Customer,
  Debt,
  Expense,
  Payment,
  Product,
  Sale,
  ShiftCloseout,
  StockLog,
  StockPurchase,
  User,
} from "./models.js";

const router = express.Router();

function normalizeProductName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function productNameFilter(name) {
  const escaped = normalizeProductName(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { name: { $regex: `^${escaped}$`, $options: "i" } };
}

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
  const loginId = String(email || "").trim();
  let user = loginId ? await User.findOne({ email: loginId }) : null;
  if (!user && loginId) {
    const escaped = loginId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    user = await User.findOne({ email: { $regex: `^${escaped}$`, $options: "i" } });
  }
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ message: "Invalid credentials" });
  const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "1d" });
  res.json({ token, user: { id: user._id, email: user.email } });
});

router.use(auth);

router.get("/products", async (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 20), MAX_PRODUCTS_LIMIT);
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
  const name = normalizeProductName(req.body.name);
  if (!name) return res.status(400).json({ message: "Product name is required" });
  if (await Product.exists(productNameFilter(name))) {
    return res.status(409).json({ message: "A product with this name already exists" });
  }
  const doc = await Product.create({ ...req.body, name });
  markShopHasRealData();
  res.status(201).json(doc);
});
router.put("/products/:id", async (req, res) => {
  const doc = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!doc) return res.status(404).json({ message: "Product not found" });
  res.json(doc);
});
router.delete("/products/:id", async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});
router.post("/products/:id/restock", async (req, res) => {
  const qty = Number(req.body.quantity || 0);
  if (!qty || qty <= 0) {
    return res.status(400).json({ message: "Enter a valid restock quantity" });
  }
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
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
    if (!Number.isFinite(qty) || qty <= 0) {
      return { error: `Invalid quantity for ${product.name}` };
    }

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

async function syncSaleFromDebt(debt) {
  if (!debt.saleId) return;
  const sale = await Sale.findById(debt.saleId);
  if (!sale) return;

  const creditRemaining = Math.max(0, Number(debt.balance) || 0);
  const checkoutPaid = Number(sale.amountPaid) || 0;
  const debtPaid = Number(debt.amountPaid) || 0;

  sale.creditBalance = creditRemaining;
  if (creditRemaining <= 0) {
    sale.type = "paid";
    sale.creditBalance = 0;
  } else if (checkoutPaid > 0 || debtPaid > 0) {
    sale.type = "partial";
  } else {
    sale.type = "credit";
  }
  await sale.save();
}

router.post("/sales", async (req, res) => {
  try {
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

    const stockCheck = await checkStockForNewSale(products);
    if (stockCheck.error) return res.status(400).json({ message: stockCheck.error });

    const stock = await deductStockForNewSale(products);
    if (stock.error) return res.status(400).json({ message: stock.error });

    let sale;
    try {
      sale = await createSaleDocument({
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
        recordedBy: req.user?.email || "",
      });

      if (pay.creditBalance > 0) {
        await Debt.create({
          customerId: resolved.customerId,
          saleId: sale._id,
          ...debtFieldsFromSale(pay.creditBalance),
        });
      }
    } catch (err) {
      await restoreStockFromNewSale(stock.deducted || []);
      if (sale?._id) {
        await Sale.findByIdAndDelete(sale._id).catch(() => {});
      }
      throw err;
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
  const limit = Math.min(Number(req.query.limit) || 50, MAX_SALES_LIMIT);
  const page = Math.max(Number(req.query.page || 1), 1);
  const [items, total] = await Promise.all([
    Sale.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("customerId"),
    Sale.countDocuments(),
  ]);
  res.json({
    items: items.map((s) => formatInvoice(s, s.customerId)),
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
});

router.get("/sales/:id", async (req, res) => {
  const sale = await Sale.findById(req.params.id).populate("customerId");
  if (!sale) return res.status(404).json({ message: "Sale not found" });
  res.json(formatInvoice(sale, sale.customerId));
});

router.put("/sales/:id", async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    const snapshot = {
      products: sale.products,
      totalAmount: sale.totalAmount,
      totalCost: sale.totalCost,
      profit: sale.profit,
      type: sale.type,
      amountPaid: sale.amountPaid,
      creditBalance: sale.creditBalance,
      payments: sale.payments,
      customerId: sale.customerId,
      customerName: sale.customerName,
      note: sale.note,
    };

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
    if (debtSync.error) {
      const rollbackItems = snapshot.products.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
      }));
      await applySaleStockChange(sale.products, rollbackItems);
      Object.assign(sale, snapshot);
      await sale.save();
      return res.status(400).json({ message: debtSync.error });
    }

    const linkedDebt = await Debt.findOne({ saleId: sale._id });
    if (linkedDebt) {
      await syncSaleFromDebt(linkedDebt);
    }

    const populated = await Sale.findById(sale._id).populate("customerId");
    res.json(formatInvoice(populated, populated.customerId));
  } catch (err) {
    console.error("PUT /sales/:id failed:", err);
    res.status(500).json({ message: err.message || "Failed to update sale" });
  }
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

router.get("/debts", async (req, res) => {
  const period = req.query.period || "all";
  let filter = {};
  let from;
  let to;

  if (period !== "all") {
    ({ from, to } = buildDateRange({ period }));
    const paymentDebtIds = await Payment.distinct("debtId", {
      date: { $gte: from, $lte: to },
    });
    filter = {
      $or: [
        { createdAt: { $gte: from, $lte: to } },
        { _id: { $in: paymentDebtIds } },
      ],
    };
  }

  const items = await Debt.find(filter)
    .populate("customerId")
    .populate("saleId", "invoiceNumber amountPaid totalAmount date")
    .sort({ createdAt: -1 })
    .lean();

  let paymentsByDebt = new Map();
  if (period !== "all") {
    const paymentRows = await Payment.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      { $group: { _id: "$debtId", total: { $sum: "$amount" } } },
    ]);
    paymentsByDebt = new Map(paymentRows.map((r) => [String(r._id), r.total]));
  }

  const enriched = items.map((d) => {
    if (period === "all") return d;

    const sale = d.saleId;
    let checkoutPaidInPeriod = 0;
    if (sale?.date) {
      const saleDate = new Date(sale.date);
      if (saleDate >= from && saleDate <= to) {
        checkoutPaidInPeriod = sale.amountPaid || 0;
      }
    }

    return {
      ...d,
      paymentsInPeriod: paymentsByDebt.get(String(d._id)) || 0,
      checkoutPaidInPeriod,
    };
  });

  res.json({
    items: enriched,
    period,
    ...(period !== "all" ? { from, to } : {}),
  });
});
router.get("/debts/:id", async (req, res) => {
  const debt = await Debt.findById(req.params.id).populate("customerId");
  if (!debt) return res.status(404).json({ message: "Debt not found" });
  res.json(debt);
});

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
      else sale.type = "credit";
      await sale.save();
    }
  }

  await Debt.findByIdAndDelete(debt._id);
  res.json({ ok: true });
});

router.post("/payments", async (req, res) => {
  const { debtId, amount, method } = req.body;
  const payAmount = Number(amount);
  let updated = null;

  try {
    if (!payAmount || payAmount <= 0) {
      return res.status(400).json({ message: "Enter a valid payment amount" });
    }

    const normalizedMethod = normalizePaymentMethod(method);
    if (!["cash", "pos"].includes(normalizedMethod)) {
      return res.status(400).json({ message: "Invalid payment method. Use cash or POS / transfer." });
    }

    updated = await Debt.findOneAndUpdate(
      { _id: debtId, balance: { $gte: payAmount } },
      [{ $set: { amountPaid: { $add: [{ $ifNull: ["$amountPaid", 0] }, payAmount] } } }],
      { new: true },
    );
    if (!updated) {
      const debt = await Debt.findById(debtId);
      if (!debt) return res.status(404).json({ message: "Debt not found" });
      return res.status(400).json({ message: "Payment cannot exceed the outstanding balance" });
    }

    updated.balance = Math.max(0, updated.totalAmount - updated.amountPaid);
    updated.status = debtStatus(updated.balance, updated.totalAmount);
    await updated.save();

    const payment = await Payment.create({
      debtId,
      customerId: updated.customerId,
      amount: payAmount,
      method: normalizedMethod,
    });

    await syncSaleFromDebt(updated);
    res.status(201).json({ payment, debt: updated });
  } catch (err) {
    if (updated) {
      await Debt.findByIdAndUpdate(debtId, { $inc: { amountPaid: -payAmount } });
      const reverted = await Debt.findById(debtId);
      if (reverted) {
        reverted.balance = Math.max(0, reverted.totalAmount - reverted.amountPaid);
        reverted.status = debtStatus(reverted.balance, reverted.totalAmount);
        await reverted.save();
        await syncSaleFromDebt(reverted);
      }
    }
    console.error("POST /payments failed:", err);
    res.status(500).json({ message: err.message || "Failed to record payment" });
  }
});
router.get("/payments", async (req, res) => res.json({ items: await Payment.find().sort({ createdAt: -1 }) }));

router.get("/reports/dashboard", async (_req, res) => {
  const [totalProducts, lowStock, products, todaySales, debtTotals, paymentTotals] = await Promise.all([
    Product.countDocuments(),
    Product.countDocuments({ quantity: { $lte: LOW_STOCK_THRESHOLD } }),
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
    period: req.query.period || "today",
    from,
    to,
    ...report,
    sales: report.sales.map((s) => formatInvoice(s, s.customerId)),
  });
});

router.get("/reports/products/:productId/history", async (req, res) => {
  try {
    let from;
    let to;
    if (req.query.scope === "period" && (req.query.period || (req.query.from && req.query.to))) {
      ({ from, to } = buildDateRange(req.query));
    }
    const result = await buildProductSalesHistory(req.params.productId, { from, to });
    if (result.error) {
      return res.status(result.error === "Product not found" ? 404 : 400).json({
        message: result.error,
      });
    }
    res.json(result);
  } catch (err) {
    console.error("GET /reports/products/:productId/history failed:", err);
    res.status(500).json({ message: err.message || "Failed to load product history" });
  }
});

router.get("/reports/export", async (req, res) => {
  const periodKey = req.query.period || "daily";
  const { from, to } = buildDateRange({
    period: periodKey === "monthly" ? "month" : periodKey === "weekly" ? "week" : "today",
    from: req.query.from,
    to: req.query.to,
  });
  const format = periodKey === "monthly" ? "%Y-%m" : periodKey === "weekly" ? "%Y-%U" : "%Y-%m-%d";
  const rows = await Sale.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    { $group: { _id: { $dateToString: { format, date: "$date" } }, sales: { $sum: "$totalAmount" }, profit: { $sum: "$profit" } } },
    { $sort: { _id: 1 } },
  ]);
  const csv = stringify(rows, { header: true, columns: ["_id", "sales", "profit"] });
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${periodKey}-report.csv"`);
  res.send(csv);
});

// ==========================================
// 1. Stock Purchases / Receive Stock (Purchases & Dealer Credit)
// ==========================================
router.get("/stock-purchases", async (req, res) => {
  try {
    const { period, status } = req.query;
    const filter = {};
    if (period && period !== "all") {
      const { from, to } = buildDateRange({ period });
      filter.date = { $gte: from, $lte: to };
    }
    if (status && status !== "all") {
      filter.status = status;
    }
    const items = await StockPurchase.find(filter).sort({ date: -1 }).lean();

    const totalAmount = items.reduce((s, d) => s + (d.totalAmount || 0), 0);
    const totalPaid = items.reduce((s, d) => s + (d.amountPaid || 0), 0);
    const totalBalance = items.reduce((s, d) => s + (d.balance || 0), 0);

    res.json({
      items,
      summary: {
        totalPurchases: totalAmount,
        totalPaid,
        totalBalance,
        count: items.length,
      },
    });
  } catch (err) {
    console.error("GET /stock-purchases failed:", err);
    res.status(500).json({ message: "Failed to load stock purchases" });
  }
});

router.post("/stock-purchases", async (req, res) => {
  const createdProductIds = [];
  const updatedProducts = [];
  const stockLogIds = [];
  let purchase;
  try {
    const {
      supplierName,
      date,
      items,
      amountPaid = 0,
      paymentMethod = "cash",
      notes,
    } = req.body;

    if (!supplierName || !supplierName.trim()) {
      return res.status(400).json({ message: "Supplier name is required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one product item is required" });
    }

    const resolvedItems = [];
    const seenProductIds = new Set();
    const seenNewNames = new Set();

    // Validate every item and calculate its value on the server before writing anything.
    for (const item of items) {
      const quantity = Number(item.quantity);
      const costPrice = Number(item.costPrice);
      if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(costPrice) || costPrice < 0) {
        return res.status(400).json({ message: "Each item needs a valid quantity and cost price" });
      }

      if (item.isNew) {
        const name = normalizeProductName(item.productName);
        if (!name) return res.status(400).json({ message: "New product name is required" });
        const sellingPrice = Number(item.sellingPrice);
        if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
          return res.status(400).json({ message: `Enter a valid selling price for ${name}` });
        }
        const nameKey = name.toLocaleLowerCase();
        if (seenNewNames.has(nameKey) || (await Product.exists(productNameFilter(name)))) {
          return res.status(409).json({ message: `A product named ${name} already exists` });
        }
        seenNewNames.add(nameKey);
        resolvedItems.push({ isNew: true, name, quantity, costPrice, sellingPrice, totalCost: quantity * costPrice });
      } else {
        const productId = String(item.productId || "");
        if (!productId || seenProductIds.has(productId)) {
          return res.status(400).json({ message: "Each existing product can appear only once per delivery" });
        }
        const product = await Product.findById(productId);
        if (!product) return res.status(400).json({ message: `Product not found: ${item.productName || item.productId}` });
        seenProductIds.add(productId);
        resolvedItems.push({
          isNew: false,
          product,
          quantity,
          costPrice,
          totalCost: quantity * costPrice,
        });
      }
    }

    const grandTotal = resolvedItems.reduce((sum, item) => sum + item.totalCost, 0);
    const requestedPayment = Number(amountPaid || 0);
    if (!Number.isFinite(requestedPayment) || requestedPayment < 0) {
      return res.status(400).json({ message: "Amount paid must be a valid positive number" });
    }
    const paidNum = Math.min(grandTotal, requestedPayment);
    const balance = Math.max(0, grandTotal - paidNum);
    const status = balance <= 0 ? "paid" : paidNum > 0 ? "partial" : "credit";

    // Create only after validation has succeeded for the entire delivery.
    for (const item of resolvedItems) {
      if (item.isNew) {
        item.product = await Product.create({
          name: item.name,
          category: "Beverages",
          quantity: 0,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
        });
        createdProductIds.push(item.product._id);
      }
    }

    purchase = await StockPurchase.create({
      supplierName: supplierName.trim(),
      date: date ? new Date(date) : new Date(),
      items: resolvedItems.map((it) => ({
        productId: it.product._id,
        productName: it.product.name,
        quantity: it.quantity,
        costPrice: it.costPrice,
        totalCost: it.totalCost,
      })),
      totalAmount: grandTotal,
      amountPaid: paidNum,
      balance,
      status,
      paymentMethod,
      notes,
      recordedBy: req.user?.email || "Admin",
    });

    // Automatically increment product quantities & update costPrice & log restock
    for (const item of resolvedItems) {
      updatedProducts.push({ id: item.product._id, quantity: item.quantity, previousCostPrice: item.product.costPrice });
      await Product.findByIdAndUpdate(item.product._id, {
        $inc: { quantity: item.quantity },
        $set: { costPrice: item.costPrice },
      });
      const stockLog = await StockLog.create({
        productId: item.product._id,
        change: item.quantity,
        type: "restock",
        date: purchase.date,
      });
      stockLogIds.push(stockLog._id);
    }

    markShopHasRealData();
    res.status(201).json(purchase);
  } catch (err) {
    // MongoDB runs locally as a standalone instance, so use compensating cleanup if a write fails.
    if (stockLogIds.length) await StockLog.deleteMany({ _id: { $in: stockLogIds } }).catch(() => {});
    if (purchase?._id) await StockPurchase.findByIdAndDelete(purchase._id).catch(() => {});
    for (const item of updatedProducts.reverse()) {
      if (!createdProductIds.some((id) => String(id) === String(item.id))) {
        await Product.findByIdAndUpdate(item.id, {
          $inc: { quantity: -item.quantity },
          $set: { costPrice: item.previousCostPrice },
        }).catch(() => {});
      }
    }
    if (createdProductIds.length) await Product.deleteMany({ _id: { $in: createdProductIds } }).catch(() => {});
    console.error("POST /stock-purchases failed:", err);
    res.status(500).json({ message: err.message || "Failed to record stock delivery" });
  }
});

router.post("/stock-purchases/:id/pay", async (req, res) => {
  try {
    const purchase = await StockPurchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: "Stock purchase not found" });
    const amount = Number(req.body.amount || 0);
    if (amount <= 0) {
      return res.status(400).json({ message: "Payment amount must be greater than zero" });
    }
    if (amount > purchase.balance) {
      return res.status(400).json({ message: `Amount exceeds balance of ₦${purchase.balance}` });
    }

    purchase.amountPaid += amount;
    purchase.balance = Math.max(0, purchase.totalAmount - purchase.amountPaid);
    purchase.status = purchase.balance <= 0 ? "paid" : "partial";
    await purchase.save();

    res.json(purchase);
  } catch (err) {
    console.error("POST /stock-purchases/:id/pay failed:", err);
    res.status(500).json({ message: "Failed to record payment" });
  }
});

router.delete("/stock-purchases/:id", async (req, res) => {
  const { password } = req.body;
  if (!password || !verifyDeletePassword(password)) {
    return res.status(401).json({ message: "Incorrect password" });
  }
  try {
    const purchase = await StockPurchase.findById(req.params.id);
    if (!purchase) return res.status(404).json({ message: "Record not found" });

    // Reverse quantities added
    for (const item of purchase.items || []) {
      if (item.productId && Number(item.quantity) > 0) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -Number(item.quantity) },
        });
        await StockLog.create({
          productId: item.productId,
          change: -Number(item.quantity),
          type: "damage",
          date: new Date(),
        });
      }
    }

    await StockPurchase.findByIdAndDelete(req.params.id);
    res.json({ message: "Delivery record deleted and stock reversed" });
  } catch (err) {
    console.error("DELETE /stock-purchases/:id failed:", err);
    res.status(500).json({ message: "Failed to delete delivery record" });
  }
});

// ==========================================
// 2. Expenses & Financial Payables (Money Out)
// ==========================================
router.get("/expenses", async (req, res) => {
  try {
    const { period, type, status } = req.query;
    const filter = {};
    if (period && period !== "all") {
      const { from, to } = buildDateRange({ period });
      filter.date = { $gte: from, $lte: to };
    }
    if (type && type !== "all") {
      filter.type = type;
    }
    if (status && status !== "all") {
      filter.status = status;
    }

    const items = await Expense.find(filter).sort({ date: -1 }).lean();

    const totalExpenses = items
      .filter((i) => i.type === "expense")
      .reduce((s, i) => s + (i.amount || 0), 0);
    const totalBorrowed = items
      .filter((i) => i.type === "borrowed" && i.status === "pending")
      .reduce((s, i) => s + (i.amount || 0), 0);
    const totalPayable = items
      .filter((i) => i.type === "payable" && i.status === "pending")
      .reduce((s, i) => s + (i.amount || 0), 0);

    res.json({
      items,
      summary: {
        totalExpenses,
        totalBorrowed,
        totalPayable,
      },
    });
  } catch (err) {
    console.error("GET /expenses failed:", err);
    res.status(500).json({ message: "Failed to load expenses" });
  }
});

router.post("/expenses", async (req, res) => {
  try {
    const {
      title,
      category = "Operations",
      type = "expense",
      amount = 0,
      paid = true,
      paymentMethod = "cash",
      personName,
      dueDate,
      date,
      notes,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Description/Title is required" });
    }

    const amtNum = Math.max(0, Number(amount || 0));
    let status = "settled";
    if (type === "payable" && !paid) status = "pending";
    if (type === "borrowed" && !paid) status = "pending";

    const expense = await Expense.create({
      title: title.trim(),
      category,
      type,
      amount: amtNum,
      paid: status === "settled",
      paymentMethod,
      personName: personName?.trim(),
      status,
      date: date ? new Date(date) : new Date(),
      dueDate: dueDate ? new Date(dueDate) : null,
      notes,
      recordedBy: req.user?.email || "Admin",
    });

    res.status(201).json(expense);
  } catch (err) {
    console.error("POST /expenses failed:", err);
    res.status(500).json({ message: err.message || "Failed to record expense" });
  }
});

router.patch("/expenses/:id/settle", async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    expense.status = expense.status === "settled" ? "pending" : "settled";
    expense.paid = expense.status === "settled";
    await expense.save();

    res.json(expense);
  } catch (err) {
    console.error("PATCH /expenses/:id/settle failed:", err);
    res.status(500).json({ message: "Failed to update status" });
  }
});

router.delete("/expenses/:id", async (req, res) => {
  const { password } = req.body;
  if (!password || !verifyDeletePassword(password)) {
    return res.status(401).json({ message: "Incorrect password" });
  }
  try {
    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: "Expense deleted" });
  } catch (err) {
    console.error("DELETE /expenses/:id failed:", err);
    res.status(500).json({ message: "Failed to delete expense" });
  }
});

// ==========================================
// 4. Shift Closeout (Z-Report & Register Balancing)
// ==========================================
router.get("/closeout/preview", async (req, res) => {
  try {
    const targetDate = req.query.date ? new Date(req.query.date) : new Date();
    const from = new Date(targetDate);
    from.setHours(0, 0, 0, 0);
    const to = new Date(targetDate);
    to.setHours(23, 59, 59, 999);

    const dateMatch = { date: { $gte: from, $lte: to } };

    // 1. Sales
    const sales = await Sale.find(dateMatch).lean();
    let salesCash = 0;
    let posTotal = 0;
    let transferTotal = 0;
    let totalSales = 0;

    for (const s of sales) {
      totalSales += s.totalAmount || 0;
      for (const p of s.payments || []) {
        if (p.method === "cash") salesCash += p.amount || 0;
        else if (p.method === "pos") posTotal += p.amount || 0;
        else if (p.method === "transfer") transferTotal += p.amount || 0;
      }
    }

    // 2. Debt / Credit payments
    const payments = await Payment.find(dateMatch).lean();
    let debtPaymentsCash = 0;
    for (const p of payments) {
      if (p.method === "cash") debtPaymentsCash += p.amount || 0;
      else if (p.method === "pos") posTotal += p.amount || 0;
      else if (p.method === "transfer") transferTotal += p.amount || 0;
    }

    // 3. Cash Expenses & Cash Borrowed
    const expenses = await Expense.find(dateMatch).lean();
    let cashExpenses = 0;
    let cashBorrowed = 0;
    for (const exp of expenses) {
      if (exp.paymentMethod === "cash") {
        if (exp.type === "expense") {
          cashExpenses += exp.amount || 0;
        } else if (exp.type === "borrowed" && exp.status === "pending") {
          cashBorrowed += exp.amount || 0;
        }
      }
    }

    const expectedCash = salesCash + debtPaymentsCash - cashExpenses - cashBorrowed;

    res.json({
      date: targetDate,
      totalSales,
      salesCash,
      debtPaymentsCash,
      cashExpenses,
      cashBorrowed,
      expectedCash,
      posTotal,
      transferTotal,
      salesCount: sales.length,
    });
  } catch (err) {
    console.error("GET /closeout/preview failed:", err);
    res.status(500).json({ message: "Failed to generate closeout preview" });
  }
});

router.post("/closeout", async (req, res) => {
  try {
    const {
      date,
      openingCash = 0,
      salesCash = 0,
      debtPaymentsCash = 0,
      cashExpenses = 0,
      cashBorrowed = 0,
      expectedCash = 0,
      actualCash = 0,
      posTotal = 0,
      transferTotal = 0,
      totalSales = 0,
      notes,
    } = req.body;

    const diff = Number(actualCash) - (Number(expectedCash) + Number(openingCash));

    const closeout = await ShiftCloseout.create({
      date: date ? new Date(date) : new Date(),
      openingCash: Number(openingCash),
      salesCash: Number(salesCash),
      debtPaymentsCash: Number(debtPaymentsCash),
      cashExpenses: Number(cashExpenses),
      cashBorrowed: Number(cashBorrowed),
      expectedCash: Number(expectedCash) + Number(openingCash),
      actualCash: Number(actualCash),
      difference: diff,
      posTotal: Number(posTotal),
      transferTotal: Number(transferTotal),
      totalSales: Number(totalSales),
      notes,
      closedBy: req.user?.email || "Admin",
    });

    res.status(201).json(closeout);
  } catch (err) {
    console.error("POST /closeout failed:", err);
    res.status(500).json({ message: "Failed to save shift closeout" });
  }
});

router.get("/closeout/history", async (req, res) => {
  try {
    const history = await ShiftCloseout.find().sort({ date: -1 }).limit(60).lean();
    res.json(history);
  } catch (err) {
    console.error("GET /closeout/history failed:", err);
    res.status(500).json({ message: "Failed to load closeout history" });
  }
});

// ==========================================
// 5. Database Backup (Download JSON & Local Snapshot)
// ==========================================
router.get("/backup/download", async (req, res) => {
  try {
    const [
      users,
      products,
      customers,
      sales,
      debts,
      payments,
      stockLogs,
      stockPurchases,
      expenses,
      shiftCloseouts,
    ] = await Promise.all([
      User.find({}, { password: 0 }).lean(),
      Product.find().lean(),
      Customer.find().lean(),
      Sale.find().lean(),
      Debt.find().lean(),
      Payment.find().lean(),
      StockLog.find().lean(),
      StockPurchase.find().lean(),
      Expense.find().lean(),
      ShiftCloseout.find().lean(),
    ]);

    const backupData = {
      exportedAt: new Date().toISOString(),
      store: "Ashuk & Ashman Beverages",
      version: "1.0.0",
      data: {
        users,
        products,
        customers,
        sales,
        debts,
        payments,
        stockLogs,
        stockPurchases,
        expenses,
        shiftCloseouts,
      },
    };

    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="BappiStores-Backup-${stamp}.json"`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    console.error("GET /backup/download failed:", err);
    res.status(500).json({ message: "Failed to create download backup" });
  }
});

router.post("/backup/local", async (req, res) => {
  try {
    const { existsSync, mkdirSync, cpSync, writeFileSync } = await import("fs");
    const { join } = await import("path");

    const root = process.cwd();
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const dest = join(root, "Backups", `BappiStores-${stamp}`);

    mkdirSync(dest, { recursive: true });

    const [products, customers, sales, debts, payments, stockPurchases, expenses, shiftCloseouts] = await Promise.all([
      Product.find().lean(),
      Customer.find().lean(),
      Sale.find().lean(),
      Debt.find().lean(),
      Payment.find().lean(),
      StockPurchase.find().lean(),
      Expense.find().lean(),
      ShiftCloseout.find().lean(),
    ]);

    writeFileSync(
      join(dest, "backup-data.json"),
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          products,
          customers,
          sales,
          debts,
          payments,
          stockPurchases,
          expenses,
          shiftCloseouts,
        },
        null,
        2
      ),
      "utf8"
    );

    const uploadsDir = join(root, "server", "uploads");
    if (existsSync(uploadsDir)) {
      cpSync(uploadsDir, join(dest, "server-uploads"), { recursive: true });
    }

    res.json({
      success: true,
      path: dest,
      stamp,
    });
  } catch (err) {
    console.error("POST /backup/local failed:", err);
    res.status(500).json({ message: err.message || "Failed to create local backup" });
  }
});

export default router;
