import { Product, StockLog } from "./models.js";

function lineQty(item) {
  const qty = Number(item.quantity);
  if (!Number.isFinite(qty) || qty <= 0) return null;
  return Math.floor(qty);
}

/** Read-only stock check before a new sale. */
export async function checkStockForNewSale(products) {
  for (const item of products || []) {
    const qty = lineQty(item);
    if (qty == null) return { error: "Each line must have a valid quantity" };

    const product = await Product.findById(item.productId);
    if (!product) return { error: "Product not found" };
    if (product.quantity < qty) {
      return { error: `Insufficient stock for ${product.name}` };
    }
  }
  return { ok: true };
}

/** Atomically deduct stock for a new sale. */
export async function deductStockForNewSale(products) {
  const deducted = [];

  for (const item of products || []) {
    const qty = lineQty(item);
    if (qty == null) {
      await restoreStockFromNewSale(deducted);
      return { error: "Each line must have a valid quantity" };
    }

    const product = await Product.findOneAndUpdate(
      { _id: item.productId, quantity: { $gte: qty } },
      { $inc: { quantity: -qty } },
      { new: true },
    );
    if (!product) {
      const named = await Product.findById(item.productId);
      await restoreStockFromNewSale(deducted);
      return {
        error: named
          ? `Insufficient stock for ${named.name}`
          : "Product not found",
      };
    }

    await StockLog.create({
      productId: product._id,
      change: -qty,
      type: "sale",
    });
    deducted.push({ productId: product._id, quantity: qty });
  }

  return { ok: true, deducted };
}

/** Restore stock after a failed sale create. */
export async function restoreStockFromNewSale(items) {
  for (const item of items || []) {
    const qty = Number(item.quantity) || 0;
    if (qty <= 0) continue;

    const product = await Product.findByIdAndUpdate(
      item.productId,
      { $inc: { quantity: qty } },
      { new: true },
    );
    if (!product) continue;

    await StockLog.create({
      productId: product._id,
      change: qty,
      type: "restock",
    });
  }
}

/** Adjust stock when a sale is edited (net delta vs previous line items). */
export async function applySaleStockChange(oldProducts, newItems) {
  const oldById = new Map();
  for (const line of oldProducts || []) {
    const id = String(line.productId);
    oldById.set(id, (oldById.get(id) || 0) + (Number(line.quantity) || 0));
  }

  const newById = new Map();
  for (const item of newItems || []) {
    const qty = lineQty(item);
    if (qty == null) return { error: "Each line must have a valid quantity" };
    const id = String(item.productId);
    newById.set(id, (newById.get(id) || 0) + qty);
  }

  const allIds = new Set([...oldById.keys(), ...newById.keys()]);

  for (const productId of allIds) {
    const oldQty = oldById.get(productId) || 0;
    const newQty = newById.get(productId) || 0;
    if (oldQty === newQty) continue;

    const product = await Product.findById(productId);
    if (!product) return { error: "Product not found" };

    const available = product.quantity + oldQty;
    if (newQty > available) {
      return {
        error: `Insufficient stock for ${product.name} (max ${available} on this invoice)`,
      };
    }

    const delta = oldQty - newQty;
    if (delta < 0) {
      const need = -delta;
      const updated = await Product.findOneAndUpdate(
        { _id: productId, quantity: { $gte: need } },
        { $inc: { quantity: -need } },
        { new: true },
      );
      if (!updated) {
        return {
          error: `Insufficient stock for ${product.name} (max ${available} on this invoice)`,
        };
      }
    } else {
      product.quantity += delta;
      await product.save();
    }

    await StockLog.create({
      productId: product._id,
      change: delta,
      type: delta > 0 ? "restock" : "sale",
    });
  }

  return { ok: true };
}
