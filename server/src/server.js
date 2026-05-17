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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  if (dbInfo.mode === "memory") {
    console.log("Running with in-memory MongoDB (data resets on restart).");
  }
  await bootstrapIfEmpty();
  console.log("Database ready.");

  server = app.listen(port, () => {
    console.log(`API listening on http://127.0.0.1:${port}`);
  });
}

start().catch((err) => {
  console.error("Startup failed:", err.message);
  process.exit(1);
});

process.on("SIGINT", async () => {
  server?.close();
  await closeDB();
  process.exit(0);
});
