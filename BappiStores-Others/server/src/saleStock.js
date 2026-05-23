import { Product, StockLog } from "./models.js";

/** Adjust stock when a sale is edited (net delta vs previous line items). */
export async function applySaleStockChange(oldProducts, newItems) {
  const oldById = new Map();
  for (const line of oldProducts || []) {
    const id = String(line.productId);
    oldById.set(id, (oldById.get(id) || 0) + (Number(line.quantity) || 0));
  }

  const newById = new Map();
  for (const item of newItems || []) {
    const id = String(item.productId);
    newById.set(id, (newById.get(id) || 0) + (Number(item.quantity) || 0));
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
    product.quantity += delta;
    await product.save();
    await StockLog.create({
      productId: product._id,
      change: delta,
      type: delta > 0 ? "restock" : "sale",
    });
  }

  return { ok: true };
}
