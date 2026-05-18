import "dotenv/config";
import cors from "cors";
import express from "express";
import { existsSync } from "fs";
import mongoose from "mongoose";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import { closeDB, connectDB } from "./config/db.js";
import { bootstrapIfEmpty } from "./bootstrap.js";
import router from "./routes.js";
import { productUploadsDir } from "./productUpload.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsRoot = path.resolve(__dirname, "../uploads");
const clientDist = path.resolve(__dirname, "../../client/dist");
const clientIndex = path.join(clientDist, "index.html");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    ok: connected,
    status: connected ? "ready" : "starting",
  });
});

app.use("/uploads", express.static(uploadsRoot));
app.use("/api", router);

if (existsSync(clientIndex)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(clientIndex);
  });
  console.log(`Serving app UI from ${clientDist}`);
}

const port = Number(process.env.PORT) || 5000;
let server;

async function start() {
  const dbInfo = await connectDB(process.env.MONGO_URI);
  if (dbInfo.mode === "persistent") {
    console.log("Using on-disk database (data kept when you shut down the PC).");
  } else if (dbInfo.mode === "external") {
    console.log("Connected to MongoDB at", process.env.MONGO_URI);
  }
  await bootstrapIfEmpty();
  console.log("Database ready.");

  const host = process.env.APP_HOST || "bappistores";
  server = app.listen(port, "0.0.0.0", () => {
    console.log(`Open the app: http://${host}:${port}`);
    console.log(`            http://localhost:${port}`);
  });
}

process.on("unhandledRejection", (err) => {
  console.error("Unhandled error (app keeps running):", err?.message || err);
});

start().catch((err) => {
  console.error("Startup failed:", err.message);
  if (err.code === 11000) {
    console.error(
      "Duplicate invoice in database. From server folder run: node src/fix-duplicate-invoices.js",
    );
  }
  process.exit(1);
});

process.on("SIGINT", async () => {
  server?.close();
  await closeDB();
  process.exit(0);
});
