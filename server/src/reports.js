import mongoose from "mongoose";
import { Debt, Payment, Product, Sale } from "./models.js";

export function buildDateRange(query) {
  const period = query.period || "today";
  const now = new Date();
  let from;
  let to = new Date();

  if (query.from && query.to) {
    from = new Date(query.from);
    to = new Date(query.to);
    to.setHours(23, 59, 59, 999);
  } else if (period === "today") {
    from = new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  } else if (period === "yesterday") {
    from = new Date();
    from.setDate(from.getDate() - 1);
    from.setHours(0, 0, 0, 0);
    to = new Date(from);
    to.setHours(23, 59, 59, 999);
  } else if (period === "week") {
    from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  } else if (period === "lastMonth") {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    from.setHours(0, 0, 0, 0);
    to = new Date(now.getFullYear(), now.getMonth(), 0);
    to.setHours(23, 59, 59, 999);
  } else if (period === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  } else {
    from = new Date(now);
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  }

  return { from, to, period };
}

export async function buildFinancialReport(from, to) {
  const dateMatch = { date: { $gte: from, $lte: to } };

  const [salesAgg, productLines, productLineItems, recentSales, debtPayments] = await Promise.all([
    Sale.aggregate([
      { $match: dateMatch },
      {
        $group: {
          _id: null,
          salesCount: { $sum: 1 },
          totalSales: { $sum: "$totalAmount" },
          totalCost: { $sum: "$totalCost" },
          totalProfit: { $sum: "$profit" },
          collectedAtSale: { $sum: { $ifNull: ["$amountPaid", 0] } },
          creditExtended: { $sum: { $ifNull: ["$creditBalance", 0] } },
          cashCollected: {
            $sum: {
              $reduce: {
                input: { $ifNull: ["$payments", []] },
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [{ $eq: ["$$this.method", "cash"] }, "$$this.amount", 0],
                    },
                  ],
                },
              },
            },
          },
          posTransferCollected: {
            $sum: {
              $reduce: {
                input: { $ifNull: ["$payments", []] },
                initialValue: 0,
                in: {
                  $add: [
                    "$$value",
                    {
                      $cond: [
                        { $in: ["$$this.method", ["pos", "transfer"]] },
                        "$$this.amount",
                        0,
                      ],
                    },
                  ],
                },
              },
            },
          },
        },
      },
    ]),
    Sale.aggregate([
      { $match: dateMatch },
      { $unwind: "$products" },
      {
        $group: {
          _id: "$products.productName",
          productId: { $first: "$products.productId" },
          quantitySold: { $sum: "$products.quantity" },
          revenue: {
            $sum: { $multiply: ["$products.quantity", "$products.sellingPrice"] },
          },
          cost: {
            $sum: { $multiply: ["$products.quantity", "$products.costPrice"] },
          },
        },
      },
      {
        $addFields: {
          profit: { $subtract: ["$revenue", "$cost"] },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    Sale.aggregate([
      { $match: dateMatch },
      { $unwind: "$products" },
      {
        $project: {
          productId: "$products.productId",
          productName: "$products.productName",
          quantity: "$products.quantity",
          unitPrice: "$products.sellingPrice",
          costPrice: "$products.costPrice",
          lineTotal: {
            $multiply: ["$products.quantity", "$products.sellingPrice"],
          },
          lineCost: {
            $multiply: ["$products.quantity", "$products.costPrice"],
          },
          invoiceNumber: 1,
          date: 1,
          customerName: 1,
          recordedBy: 1,
          type: 1,
        },
      },
      {
        $addFields: {
          lineProfit: { $subtract: ["$lineTotal", "$lineCost"] },
        },
      },
      { $sort: { date: -1 } },
      { $limit: 500 },
    ]),
    Sale.find(dateMatch).sort({ date: -1 }).limit(100).populate("customerId"),
    Payment.aggregate([
      { $match: { date: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          cash: { $sum: { $cond: [{ $eq: ["$method", "cash"] }, "$amount", 0] } },
          pos: {
            $sum: {
              $cond: [{ $in: ["$method", ["pos", "transfer"]] }, "$amount", 0],
            },
          },
        },
      },
    ]),
  ]);

  const s = salesAgg[0] || {
    salesCount: 0,
    totalSales: 0,
    totalCost: 0,
    totalProfit: 0,
    collectedAtSale: 0,
    creditExtended: 0,
    cashCollected: 0,
    posTransferCollected: 0,
  };

  const dp = debtPayments[0] || { total: 0, cash: 0, pos: 0 };
  const outstandingDebt = await Debt.aggregate([
    { $group: { _id: null, total: { $sum: "$balance" } } },
  ]);

  const stockRows = await Product.find({}, { name: 1, quantity: 1 }).lean();
  const stockById = new Map(stockRows.map((p) => [String(p._id), p.quantity ?? 0]));
  const stockByName = new Map(stockRows.map((p) => [p.name, p.quantity ?? 0]));

  function quantityLeftForProduct(line) {
    const id = line.productId ? String(line.productId) : null;
    if (id && stockById.has(id)) return stockById.get(id);
    if (line._id && stockByName.has(line._id)) return stockByName.get(line._id);
    return null;
  }

  return {
    summary: {
      salesCount: s.salesCount,
      totalSales: s.totalSales,
      totalCost: s.totalCost,
      totalProfit: s.totalProfit,
      collectedAtSale: s.collectedAtSale,
      creditExtended: s.creditExtended,
      debtPaymentsReceived: dp.total,
      totalCollected: s.collectedAtSale + dp.total,
      outstandingDebt: outstandingDebt[0]?.total || 0,
      byMethod: {
        cash: s.cashCollected + dp.cash,
        pos: s.posTransferCollected + dp.pos,
      },
    },
    products: productLines.map((p) => ({
      productId: p.productId,
      productName: p._id,
      quantitySold: p.quantitySold,
      quantityLeft: quantityLeftForProduct(p),
      revenue: p.revenue,
      cost: p.cost,
      profit: p.profit,
    })),
    productLines: productLineItems.map((row) => ({
      productId: row.productId,
      productName: row.productName || "Item",
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      lineTotal: row.lineTotal,
      lineCost: row.lineCost,
      lineProfit: row.lineProfit,
      invoiceNumber: row.invoiceNumber,
      date: row.date,
      customerName: row.customerName || "Walk-in",
      recordedBy: row.recordedBy || "",
      type: row.type,
    })),
    sales: recentSales,
    debtPaymentsInPeriod: dp.total,
  };
}

export async function buildProductSalesHistory(productId, { from, to } = {}) {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return { error: "Invalid product id" };
  }

  const product = await Product.findById(productId).lean();
  if (!product) return { error: "Product not found" };

  const pid = new mongoose.Types.ObjectId(productId);
  const saleMatch = { "products.productId": pid };
  if (from && to) {
    saleMatch.date = { $gte: from, $lte: to };
  }

  const [lines, allTimeSoldRows] = await Promise.all([
    Sale.aggregate([
      { $match: saleMatch },
      { $unwind: "$products" },
      { $match: { "products.productId": pid } },
      {
        $project: {
          saleId: "$_id",
          invoiceNumber: 1,
          date: 1,
          customerName: { $ifNull: ["$customerName", "Walk-in"] },
          quantity: "$products.quantity",
          unitPrice: "$products.sellingPrice",
          lineTotal: {
            $multiply: ["$products.quantity", "$products.sellingPrice"],
          },
        },
      },
      { $sort: { date: -1 } },
    ]),
    Sale.aggregate([
      { $match: { "products.productId": pid } },
      { $unwind: "$products" },
      { $match: { "products.productId": pid } },
      { $group: { _id: null, total: { $sum: "$products.quantity" } } },
    ]),
  ]);

  let quantitySold = 0;
  let revenue = 0;
  for (const line of lines) {
    quantitySold += line.quantity || 0;
    revenue += line.lineTotal || 0;
  }

  const currentStock = product.quantity ?? 0;
  const allTimeQuantitySold = allTimeSoldRows[0]?.total ?? 0;
  const totalAdded = currentStock + allTimeQuantitySold;

  return {
    product: {
      id: product._id,
      name: product.name,
      addedAt: product.createdAt,
      currentStock,
      totalAdded,
      allTimeQuantitySold,
      listPrice: product.sellingPrice ?? 0,
    },
    scope: from && to ? "period" : "all",
    from: from || null,
    to: to || null,
    summary: {
      lineCount: lines.length,
      quantitySold,
      revenue,
      firstSale: lines.length ? lines[lines.length - 1].date : null,
      lastSale: lines.length ? lines[0].date : null,
    },
    lines: lines.map((row) => ({
      saleId: row.saleId,
      invoiceNumber: row.invoiceNumber,
      date: row.date,
      customerName: row.customerName,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      lineTotal: row.lineTotal,
    })),
  };
}
