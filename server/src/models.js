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

const stockPurchaseSchema = new mongoose.Schema(
  {
    supplierName: { type: String, required: true },
    date: { type: Date, default: Date.now },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        productName: String,
        quantity: Number,
        costPrice: Number,
        totalCost: Number,
      },
    ],
    totalAmount: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: { type: String, enum: ["paid", "credit", "partial"], default: "paid" },
    paymentMethod: { type: String, enum: ["cash", "pos", "transfer", "credit"], default: "cash" },
    notes: String,
    recordedBy: String,
  },
  { timestamps: true }
);

const expenseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, default: "Operations" },
    type: { type: String, enum: ["expense", "borrowed", "payable"], default: "expense" },
    amount: { type: Number, required: true },
    paid: { type: Boolean, default: true },
    paymentMethod: { type: String, enum: ["cash", "pos", "transfer", "unpaid"], default: "cash" },
    personName: String,
    status: { type: String, enum: ["settled", "pending"], default: "settled" },
    date: { type: Date, default: Date.now },
    dueDate: Date,
    notes: String,
    recordedBy: String,
  },
  { timestamps: true }
);

const shiftCloseoutSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    openingCash: { type: Number, default: 0 },
    salesCash: { type: Number, default: 0 },
    debtPaymentsCash: { type: Number, default: 0 },
    cashExpenses: { type: Number, default: 0 },
    cashBorrowed: { type: Number, default: 0 },
    expectedCash: { type: Number, default: 0 },
    actualCash: { type: Number, default: 0 },
    difference: { type: Number, default: 0 },
    posTotal: { type: Number, default: 0 },
    transferTotal: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    notes: String,
    closedBy: String,
  },
  { timestamps: true }
);

const cashNoteSchema = new mongoose.Schema(
  {
    customerName: { type: String, required: true },
    description: String,
    totalAmount: Number,
    amountPaid: { type: Number, default: 0 },
    balance: Number,
    status: { type: String, enum: ["paid", "partial", "unpaid"], default: "unpaid" },
    recordedBy: String,
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const noteTransactionSchema = new mongoose.Schema(
  {
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: "CashNote", required: true },
    type: { type: String, enum: ["borrow", "payment"], required: true },
    amount: Number,
    reason: String,
    date: { type: Date, default: Date.now },
    method: { type: String, enum: ["cash", "pos", "transfer"], default: "cash" },
    recordedBy: String,
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
export const StockPurchase = mongoose.model("StockPurchase", stockPurchaseSchema);
export const Expense = mongoose.model("Expense", expenseSchema);
export const ShiftCloseout = mongoose.model("ShiftCloseout", shiftCloseoutSchema);
export const CashNote = mongoose.model("CashNote", cashNoteSchema);
export const NoteTransaction = mongoose.model("NoteTransaction", noteTransactionSchema);

