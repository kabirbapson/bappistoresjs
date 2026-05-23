/**
 * Pre-download MongoDB for offline shop zip (run from build:share).
 * Usage: node src/download-bundled-mongo.js
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { MongoBinary } from "mongodb-memory-server-core";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const version = process.env.MONGOMS_VERSION || "7.0.14";
const cacheDir = path.join(root, "bundled", "mongodb-cache");

mkdirSync(path.join(root, "bundled"), { recursive: true });
process.env.MONGOMS_VERSION = version;
process.env.MONGOMS_DOWNLOAD_DIR = cacheDir;
process.env.MONGOMS_STARTUP_TIMEOUT = "600000";

console.log(`Downloading MongoDB ${version} for offline installs (~600MB)…`);

const mongodPath = await MongoBinary.getPath({
  version,
  downloadDir: cacheDir,
});

console.log(`MongoDB binary ready: ${mongodPath}`);

const bundledCopy = path.join(root, "bundled", "mongod.exe");
copyFileSync(mongodPath, bundledCopy);
writeFileSync(path.join(root, "bundled", "mongod-path.txt"), mongodPath, "utf8");
console.log("Saved bundled/mongod.exe");
