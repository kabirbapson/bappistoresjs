import { ShopSettings } from "./models.js";

const SINGLETON_KEY = "shop";

export const DEFAULT_SHOP_SETTINGS = {
  shopName: "",
  addresses: [],
  phones: [],
  logoUrl: "/logo.png",
  receiptTitle: "SALES INVOICE",
  receiptFooterArabic: "",
  logoIncludesReceiptHeader: false,
};

function cleanLines(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((line) => String(line || "").trim()).filter(Boolean);
}

export function normalizeShopSettings(doc) {
  const raw = doc?.toObject?.() ?? doc ?? {};
  return {
    shopName: String(raw.shopName || "").trim(),
    addresses: cleanLines(raw.addresses),
    phones: cleanLines(raw.phones),
    logoUrl: raw.logoUrl || DEFAULT_SHOP_SETTINGS.logoUrl,
    receiptTitle: String(raw.receiptTitle || DEFAULT_SHOP_SETTINGS.receiptTitle).trim(),
    receiptFooterArabic: String(raw.receiptFooterArabic || "").trim(),
    logoIncludesReceiptHeader: Boolean(raw.logoIncludesReceiptHeader),
  };
}

export async function getShopSettings() {
  let doc = await ShopSettings.findOne({ singleton: SINGLETON_KEY });
  if (!doc) {
    try {
      doc = await ShopSettings.create({ singleton: SINGLETON_KEY, ...DEFAULT_SHOP_SETTINGS });
    } catch (err) {
      if (err?.code === 11000) {
        doc = await ShopSettings.findOne({ singleton: SINGLETON_KEY });
      } else {
        throw err;
      }
    }
  }
  if (!doc) {
    throw new Error("Could not load shop settings");
  }
  return normalizeShopSettings(doc);
}

export async function updateShopSettings(body) {
  const patch = {
    shopName: String(body.shopName || "").trim(),
    addresses: cleanLines(body.addresses),
    phones: cleanLines(body.phones),
    receiptTitle: String(body.receiptTitle || DEFAULT_SHOP_SETTINGS.receiptTitle).trim(),
    receiptFooterArabic: String(body.receiptFooterArabic || "").trim(),
    logoIncludesReceiptHeader: Boolean(body.logoIncludesReceiptHeader),
  };
  if (body.logoUrl) {
    patch.logoUrl = String(body.logoUrl).trim();
  }

  const doc = await ShopSettings.findOneAndUpdate(
    { singleton: SINGLETON_KEY },
    { $set: patch, $setOnInsert: { singleton: SINGLETON_KEY } },
    { upsert: true, new: true },
  );
  return normalizeShopSettings(doc);
}

export async function setShopLogoUrl(logoUrl) {
  const doc = await ShopSettings.findOneAndUpdate(
    { singleton: SINGLETON_KEY },
    { $set: { logoUrl }, $setOnInsert: { singleton: SINGLETON_KEY } },
    { upsert: true, new: true },
  );
  return normalizeShopSettings(doc);
}
