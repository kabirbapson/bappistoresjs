import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import mongoose from "mongoose";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  isCorruptionError,
  quarantineBrokenDb,
  removeStaleLocks,
  runMongodRepair,
  shopDataLooksEmpty,
  startDirectMongod,
  stopDirectMongod,
  verifyMongodBinary,
} from "./builtin-mongod.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Slow shop PCs need longer than default 10s after first 500MB+ download. */
const MONGO_STARTUP_TIMEOUT_MS = Number(
  process.env.MONGOMS_STARTUP_TIMEOUT || 300000,
);
if (!process.env.MONGOMS_STARTUP_TIMEOUT) {
  process.env.MONGOMS_STARTUP_TIMEOUT = String(MONGO_STARTUP_TIMEOUT_MS);
}

/** Saved on disk — survives shutdown and restart (project folder/data/mongodb). */
export const PERSISTENT_DB_PATH = path.resolve(
  __dirname,
  "../../../data/mongodb",
);

/** Downloaded mongod.exe cache (separate from shop data). */
export const MONGODB_BIN_CACHE = path.resolve(
  __dirname,
  "../../../data/mongodb-bin",
);

let memoryServer;
let useDirectMongod = false;

const connectOpts = { serverSelectionTimeoutMS: 30000 };

function isLocalMongoUri(uri) {
  return /mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri || "");
}

function shouldUseExternalMongo(uri) {
  const trimmed = (uri || "").trim();
  if (!trimmed) return false;
  if (/^(embedded|builtin|memory|local)$/i.test(trimmed)) return false;
  return true;
}

const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const BUNDLED_MONGOD = path.join(PROJECT_ROOT, "bundled", "mongod.exe");
const BUNDLED_MONGO_CACHE = path.join(PROJECT_ROOT, "bundled", "mongodb-cache");

function findBundledMongod() {
  if (existsSync(BUNDLED_MONGOD)) return BUNDLED_MONGOD;
  if (!existsSync(BUNDLED_MONGO_CACHE)) return null;
  return findMongodInTree(BUNDLED_MONGO_CACHE, 8);
}

function findMongodInTree(dir, maxDepth, depth = 0) {
  if (depth > maxDepth) return null;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === "mongod.exe") return full;
    if (entry.isDirectory()) {
      const inner = findMongodInTree(full, maxDepth, depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

function findSystemMongod() {
  if (process.env.MONGODB_SYSTEM_BINARY && existsSync(process.env.MONGODB_SYSTEM_BINARY)) {
    return process.env.MONGODB_SYSTEM_BINARY;
  }
  const bundled = findBundledMongod();
  if (bundled) return bundled;
  if (process.platform !== "win32") return null;
  const where = spawnSync("where.exe", ["mongod.exe"], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  if (where.status === 0 && where.stdout?.trim()) {
    return where.stdout.trim().split(/\r?\n/)[0].trim();
  }
  return null;
}

function isSpawnEftypeError(err) {
  const code = err?.code || err?.errno;
  return code === "EFTYPE" || String(err?.message || err).includes("EFTYPE");
}

function isStartupTimeout(err) {
  const msg = String(err?.message || err);
  return msg.includes("failed to start within") || msg.includes("GenericMMSError");
}

async function createMemoryServer({ clearCache = false } = {}) {
  if (clearCache && existsSync(MONGODB_BIN_CACHE)) {
    rmSync(MONGODB_BIN_CACHE, { recursive: true, force: true });
  }

  mkdirSync(PERSISTENT_DB_PATH, { recursive: true });
  mkdirSync(MONGODB_BIN_CACHE, { recursive: true });

  const systemBinary = findSystemMongod();
  const downloadDir =
    existsSync(BUNDLED_MONGO_CACHE) && !systemBinary
      ? BUNDLED_MONGO_CACHE
      : MONGODB_BIN_CACHE;
  const binary = {
    version: process.env.MONGOMS_VERSION || "7.0.14",
    downloadDir,
    ...(systemBinary ? { systemBinary } : {}),
  };

  return MongoMemoryServer.create({
    instance: {
      dbPath: PERSISTENT_DB_PATH,
      storageEngine: "wiredTiger",
    },
    binary,
  });
}

async function startDirectWithRecovery(binary) {
  try {
    verifyMongodBinary(binary);
    return await startDirectMongod({ binary, dbPath: PERSISTENT_DB_PATH });
  } catch (err) {
    if (!isCorruptionError(err)) throw err;

    console.warn("Database files may be damaged — attempting repair…");
    removeStaleLocks(PERSISTENT_DB_PATH);

    try {
      runMongodRepair(binary, PERSISTENT_DB_PATH);
      verifyMongodBinary(binary);
      return await startDirectMongod({ binary, dbPath: PERSISTENT_DB_PATH });
    } catch (repairErr) {
      if (shopDataLooksEmpty(PERSISTENT_DB_PATH)) {
        console.warn("No shop data found — creating a fresh database folder…");
        quarantineBrokenDb(PERSISTENT_DB_PATH);
        verifyMongodBinary(binary);
        return await startDirectMongod({ binary, dbPath: PERSISTENT_DB_PATH });
      }
      throw repairErr;
    }
  }
}

async function startBuiltInMongo() {
  const binary = findSystemMongod();
  if (binary) {
    try {
      useDirectMongod = true;
      return await startDirectWithRecovery(binary);
    } catch (directErr) {
      useDirectMongod = false;
      console.warn(
        `Direct mongod start failed — trying alternate engine (${directErr.message})`,
      );
      await stopDirectMongod();
    }
  }

  const timeoutAttempts = [MONGO_STARTUP_TIMEOUT_MS, 420000, 600000];
  let lastErr;

  for (let i = 0; i < timeoutAttempts.length; i++) {
    const timeoutMs = timeoutAttempts[i];
    process.env.MONGOMS_STARTUP_TIMEOUT = String(timeoutMs);

    if (i > 0) {
      console.warn(
        `Database still starting… retry ${i + 1}/${timeoutAttempts.length} (wait up to ${Math.round(timeoutMs / 1000)}s)`,
      );
      if (memoryServer) {
        try {
          await memoryServer.stop({ doCleanup: false });
        } catch {
          /* ignore */
        }
        memoryServer = undefined;
      }
    }

    try {
      const clearCache = i > 0 && lastErr && isSpawnEftypeError(lastErr);
      const server = await createMemoryServer({ clearCache });
      return { mode: "memory", server };
    } catch (err) {
      lastErr = err;
      if (isSpawnEftypeError(err) && i < timeoutAttempts.length - 1) {
        console.warn("Built-in MongoDB binary issue — clearing cache and retrying…");
        if (existsSync(MONGODB_BIN_CACHE)) {
          rmSync(MONGODB_BIN_CACHE, { recursive: true, force: true });
        }
        continue;
      }
      if (isStartupTimeout(err) && i < timeoutAttempts.length - 1) {
        continue;
      }
      break;
    }
  }

  const hint =
    "Built-in database could not start on this PC.\n" +
    "1) Double-click STOP-APP.bat, then REPAIR-DATABASE.bat, then START.bat.\n" +
    "2) Add this entire app folder to Windows Defender exclusions.\n" +
    "3) Move the folder to C:\\BappiStores (not Desktop) and try again.\n" +
    "4) Or install MongoDB Community and set in server\\.env:\n" +
    "   MONGO_URI=mongodb://127.0.0.1:27017/bappistores";
  throw new Error(`${hint}\n\nTechnical: ${lastErr?.message || lastErr}`);
}

export async function connectDB(uri) {
  if (mongoose.connection.readyState === 1) {
    return { mode: "existing", uri: mongoose.connection.host };
  }

  mkdirSync(PERSISTENT_DB_PATH, { recursive: true });

  if (shouldUseExternalMongo(uri)) {
    try {
      await mongoose.connect(uri, connectOpts);
      return { mode: "external", uri };
    } catch (error) {
      if (!isLocalMongoUri(uri)) throw error;
      console.warn(
        "Could not connect to MongoDB at MONGO_URI — using built-in database instead.",
      );
    }
  }

  const started = await startBuiltInMongo();

  let localUri;
  if (useDirectMongod && started?.uri) {
    localUri = started.uri;
  } else {
    memoryServer = started.server;
    localUri = memoryServer.getUri("bappistores");
  }

  await mongoose.connect(localUri, connectOpts);
  console.log(`Database folder: ${PERSISTENT_DB_PATH}`);
  console.log("Keep the data/mongodb folder — all sales and products are stored there.");
  return { mode: "persistent", uri: localUri };
}

export async function closeDB() {
  await mongoose.connection.close();
  if (useDirectMongod) {
    await stopDirectMongod();
    useDirectMongod = false;
  }
  if (memoryServer) {
    await memoryServer.stop({ doCleanup: false });
    memoryServer = undefined;
  }
}
