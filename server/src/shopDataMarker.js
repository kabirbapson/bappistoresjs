import { existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SHOP_DATA_MARKER = path.resolve(__dirname, "../../../data/.shop-in-use");

export function markShopHasRealData() {
  mkdirSync(path.dirname(SHOP_DATA_MARKER), { recursive: true });
  if (!existsSync(SHOP_DATA_MARKER)) {
    writeFileSync(SHOP_DATA_MARKER, new Date().toISOString(), "utf8");
  }
}

export function shopHasBeenUsed() {
  return existsSync(SHOP_DATA_MARKER);
}
