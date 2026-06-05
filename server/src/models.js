import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  { email: { type: String, unique: true }, password: String },
  { timestamps: true }
);
const productSchema = new mongoose.Schema(
  {
    name: String,
    category: String,
    imageUrl: String,
    quantity: { type: Number, default: 0 },
    costPrice: Number,
    sellingPrice: Number,
  },
  { timestamps: true }
);
const customerSchema = new mongoose.Schema(
  { name: String, phone: String, address: String },
  { timestamps: true }
);
const saleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true, sparse: true },
    products: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      productName: String,
      quantity: Number,
      costPrice: Number,
      sellingPrice: Number,
    }],
    totalAmount: Number,
    totalCost: Number,
    profit: Number,
    type: { type: String, enum: ["paid", "partial", "credit", "cash"], default: "paid" },
    amountPaid: { type: Number, default: 0 },
    creditBalance: { type: Number, default: 0 },
    payments: [{
      method: { type: String, enum: ["cash", "pos", "transfer"] },
      amount: Number,
    }],
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerName: String,
    note: String,
    recordedBy: String,
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
const debtSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale" },
    totalAmount: Number,
    amountPaid: { type: Number, default: 0 },
    balance: Number,
    status: { type: String, enum: ["paid", "partial", "unpaid"], default: "unpaid" },
    createdAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);
const paymentSchema = new mongoose.Schema(
  {
    debtId: { type: mongoose.Schema.Types.ObjectId, ref: "Debt", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    amount: Number,
    date: { type: Date, default: Date.now },
    method: { type: String, enum: ["cash", "pos", "transfer"], default: "cash" },
  },
  { timestamps: true }
);
const stockLogSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    change: Number,
    type: { type: String, enum: ["restock", "sale", "damage"] },
    date: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
export const Product = mongoose.model("Product", productSchema);
export const Customer = mongoose.model("Customer", customerSchema);
export const Sale = mongoose.model("Sale", saleSchema);
export const Debt = mongoose.model("Debt", debtSchema);
export const Payment = mongoose.model("Payment", paymentSchema);
export const StockLog = mongoose.model("StockLog", stockLogSchema);
