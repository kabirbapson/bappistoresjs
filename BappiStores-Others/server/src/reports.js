import { Debt, Payment, Sale } from "./models.js";

export function buildDateRange(query) {
  const period = query.period || "month";
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
  } else if (period === "week") {
    from = new Date(now);
    from.setDate(from.getDate() - 7);
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return { from, to, period };
}

export async function buildFinancialReport(from, to) {
  const dateMatch = { date: { $gte: from, $lte: to } };

  const [salesAgg, productLines, recentSales, debtPayments] = await Promise.all([
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
          category: { $first: "$products.productName" },
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
      productName: p._id,
      quantitySold: p.quantitySold,
      revenue: p.revenue,
      cost: p.cost,
      profit: p.profit,
    })),
    sales: recentSales,
    debtPaymentsInPeriod: dp.total,
  };
}
