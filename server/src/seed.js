import "dotenv/config";
import bcrypt from "bcryptjs";
import { closeDB, connectDB } from "./config/db.js";
import { Customer, Product, User } from "./models.js";

await connectDB(process.env.MONGO_URI);

const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@bappi.com";
const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
const hash = await bcrypt.hash(adminPassword, 10);

await User.updateOne({ email: adminEmail }, { email: adminEmail, password: hash }, { upsert: true });

if ((await Product.countDocuments()) === 0) {
  await Product.insertMany([
    { name: "Rice Bag 25kg", category: "Grocery", quantity: 40, costPrice: 30, sellingPrice: 35 },
    { name: "Sunflower Oil 5L", category: "Oil", quantity: 22, costPrice: 10, sellingPrice: 13 },
    { name: "Soap Bar", category: "Personal Care", quantity: 120, costPrice: 0.4, sellingPrice: 0.7 }
  ]);
}
if ((await Customer.countDocuments()) === 0) {
  await Customer.insertMany([
    { name: "Rahim Uddin", phone: "017XXXXXXXX", address: "Dhaka" },
    { name: "Karim Store", phone: "018XXXXXXXX", address: "Narayanganj" }
  ]);
}

console.log("Seed complete");
await closeDB();
process.exit(0);
