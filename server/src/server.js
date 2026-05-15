import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { closeDB, connectDB } from "./config/db.js";
import router from "./routes.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));
app.use("/api", router);

const port = process.env.PORT || 5000;
connectDB(process.env.MONGO_URI)
  .then((dbInfo) => {
    if (dbInfo.mode === "memory") {
      console.log("Running with in-memory MongoDB (data resets on restart).");
    }
    app.listen(port, () => console.log(`API running on ${port}`));
  })
  .catch((err) => {
    console.error("DB connection failed:", err.message);
    process.exit(1);
  });

process.on("SIGINT", async () => {
  await closeDB();
  process.exit(0);
});
