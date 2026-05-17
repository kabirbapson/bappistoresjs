import { mkdirSync } from "fs";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { MongoMemoryServer } from "mongodb-memory-server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Saved on disk — survives shutdown and restart (project folder/data/mongodb). */
export const PERSISTENT_DB_PATH = path.resolve(
  __dirname,
  "../../../data/mongodb",
);

let memoryServer;

const connectOpts = { serverSelectionTimeoutMS: 8000 };

function isLocalMongoUri(uri) {
  return /mongodb:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(uri || "");
}

export async function connectDB(uri) {
  if (mongoose.connection.readyState === 1) {
    return { mode: "existing", uri: mongoose.connection.host };
  }

  mkdirSync(PERSISTENT_DB_PATH, { recursive: true });

  try {
    await mongoose.connect(uri, connectOpts);
    return { mode: "external", uri };
  } catch (error) {
    if (!isLocalMongoUri(uri)) throw error;

    if (!memoryServer) {
      memoryServer = await MongoMemoryServer.create({
        instance: {
          dbPath: PERSISTENT_DB_PATH,
          storageEngine: "wiredTiger",
          port: 27017,
        },
      });
    }

    const localUri = memoryServer.getUri("bappistores");
    await mongoose.connect(localUri, connectOpts);
    console.log(
      `Database saved in: ${PERSISTENT_DB_PATH}`,
    );
    console.log("Your sales, products, and debts persist after restart.");
    return { mode: "persistent", uri: localUri };
  }
}

export async function closeDB() {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop({ doCleanup: false });
    memoryServer = undefined;
  }
}
