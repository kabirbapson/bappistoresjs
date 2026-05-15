import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer;

export async function connectDB(uri) {
  try {
    await mongoose.connect(uri);
    return { mode: "external", uri };
  } catch (error) {
    const isLocalMongo = uri?.includes("127.0.0.1:27017") || uri?.includes("localhost:27017");
    if (!isLocalMongo) throw error;

    memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri("bappistores");
    await mongoose.connect(memoryUri);
    console.warn("Local MongoDB unavailable. Using in-memory MongoDB fallback.");
    return { mode: "memory", uri: memoryUri };
  }
}

export async function closeDB() {
  await mongoose.connection.close();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}
