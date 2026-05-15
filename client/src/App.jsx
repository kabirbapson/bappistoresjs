import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import toast from "react-hot-toast";
import api from "./api";
import { useAuthStore } from "./store";

const navItems = [
  ["Dashboard", "/"],
  ["Products", "/products"],
  ["Customers", "/customers"],
  ["Sales", "/sales"],
  ["Debts", "/debts"],
  ["Reports", "/reports"]
];

function Protected({ children }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

function Layout({ children }) {
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 md:grid-cols-[220px_1fr]">
        <aside className="rounded-xl bg-slate-900 p-4 text-white">
          <h1 className="text-xl font-bold">Bappi Stores</h1>
          <nav className="mt-6 space-y-1">
            {navItems.map(([label, path]) => (
              <Link
                key={path}
                to={path}
                className={`block rounded-lg px-3 py-2 text-sm ${location.pathname === path ? "bg-slate-700" : "hover:bg-slate-800"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <button onClick={logout} className="mt-6 w-full rounded-lg bg-rose-600 px-3 py-2 text-sm">
            Logout
          </button>
        </aside>
        <main>{children}</main>
      </div>
    </div>
  );
}

function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const token = useAuthStore((s) => s.token);
  const loading = useAuthStore((s) => s.loading);
  const [form, setForm] = useState({ email: "admin@bappi.com", password: "admin123" });
  if (token) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    try {
      await login(form);
      toast.success("Logged in");
    } catch (e2) {
      toast.error(e2.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-semibold">Admin Login</h2>
        <input className="w-full rounded border p-2" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input type="password" className="w-full rounded border p-2" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button disabled={loading} className="w-full rounded bg-slate-900 p-2 text-white">
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

function DashboardPage() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get("/reports/dashboard").then((res) => setStats(res.data));
  }, []);
  if (!stats) return <p className="rounded-xl bg-white p-6">Loading dashboard...</p>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Object.entries(stats.cards).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white p-4 shadow">
            <p className="text-xs text-slate-500">{k}</p>
            <p className="text-xl font-bold">{v}</p>
          </div>
        ))}
      </div>
      <div className="h-72 rounded-xl bg-white p-4 shadow">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.dailySales}>
            <XAxis dataKey="_id" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="amount" fill="#0f172a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ name: "", category: "", quantity: 0, costPrice: 0, sellingPrice: 0 });
  const load = () => api.get(`/products?q=${query}`).then((r) => setProducts(r.data.items));
  useEffect(load, [query]);

  const save = async (e) => {
    e.preventDefault();
    await api.post("/products", form);
    setForm({ name: "", category: "", quantity: 0, costPrice: 0, sellingPrice: 0 });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow">
        <form className="grid grid-cols-2 gap-2 md:grid-cols-6" onSubmit={save}>
          {Object.keys(form).map((key) => (
            <input
              key={key}
              required={key !== "category"}
              placeholder={key}
              type={key.includes("Price") || key === "quantity" ? "number" : "text"}
              value={form[key]}
              className="rounded border p-2"
              onChange={(e) => setForm({ ...form, [key]: key.includes("Price") || key === "quantity" ? Number(e.target.value) : e.target.value })}
            />
          ))}
          <button className="rounded bg-slate-900 p-2 text-white">Add</button>
        </form>
      </div>
      <input className="w-full rounded border bg-white p-2" placeholder="Search products..." value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="rounded-xl bg-white shadow">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>{["Name", "Category", "Qty", "Cost", "Sell", "Actions"].map((h) => <th key={h} className="p-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p._id} className="border-t">
                <td className="p-2">{p.name}</td><td className="p-2">{p.category}</td><td className="p-2">{p.quantity}</td><td className="p-2">{p.costPrice}</td><td className="p-2">{p.sellingPrice}</td>
                <td className="p-2"><button className="text-rose-600" onClick={() => api.delete(`/products/${p._id}`).then(load)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomersPage() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const load = () => api.get(`/customers?q=${search}`).then((r) => setRows(r.data.items));
  useEffect(load, [search]);
  const save = async (e) => {
    e.preventDefault();
    await api.post("/customers", form);
    setForm({ name: "", phone: "", address: "" });
    load();
  };
  return (
    <div className="space-y-4">
      <form onSubmit={save} className="grid grid-cols-1 gap-2 rounded-xl bg-white p-4 shadow md:grid-cols-4">
        {Object.keys(form).map((k) => <input key={k} placeholder={k} className="rounded border p-2" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required />)}
        <button className="rounded bg-slate-900 p-2 text-white">Add Customer</button>
      </form>
      <input className="w-full rounded border bg-white p-2" placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="space-y-2">
        {rows.map((c) => <div key={c._id} className="rounded-xl bg-white p-3 shadow"><p className="font-semibold">{c.name}</p><p className="text-xs text-slate-500">{c.phone} | {c.address}</p></div>)}
      </div>
    </div>
  );
}

function SalesPage() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ productId: "", quantity: 1, type: "cash", customerId: "", note: "" });
  const load = async () => {
    const [p, c] = await Promise.all([api.get("/products"), api.get("/customers")]);
    setProducts(p.data.items);
    setCustomers(c.data.items);
  };
  useEffect(() => { load(); }, []);
  const selectedProduct = useMemo(() => products.find((p) => p._id === form.productId), [products, form.productId]);
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/sales", {
        products: [{ productId: form.productId, quantity: Number(form.quantity) }],
        type: form.type,
        customerId: form.type === "credit" ? form.customerId : undefined,
        note: form.note
      });
      toast.success("Sale recorded");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed");
    }
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 shadow">
      <select className="w-full rounded border p-2" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required>
        <option value="">Select product</option>
        {products.map((p) => <option key={p._id} value={p._id}>{p.name} (Stock: {p.quantity})</option>)}
      </select>
      <input type="number" min={1} className="w-full rounded border p-2" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
      <select className="w-full rounded border p-2" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
        <option value="cash">Cash</option><option value="credit">Credit</option>
      </select>
      {form.type === "credit" && (
        <select className="w-full rounded border p-2" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
          <option value="">Select customer</option>
          {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
        </select>
      )}
      {selectedProduct && <p className="text-sm">Total: {(selectedProduct.sellingPrice * Number(form.quantity || 0)).toFixed(2)}</p>}
      <button className="rounded bg-slate-900 px-4 py-2 text-white">Record Sale</button>
    </form>
  );
}

function statusClass(status) {
  if (status === "paid") return "bg-green-100 text-green-700";
  if (status === "partial") return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function DebtsPage() {
  const [rows, setRows] = useState([]);
  const [payments, setPayments] = useState({});
  const load = () => api.get("/debts").then((r) => setRows(r.data.items));
  useEffect(load, []);
  const pay = async (debtId) => {
    const amount = Number(payments[debtId] || 0);
    if (!amount) return;
    await api.post("/payments", { debtId, amount, method: "cash" });
    setPayments({ ...payments, [debtId]: "" });
    load();
  };
  return (
    <div className="space-y-3">
      {rows.map((d) => (
        <div key={d._id} className="rounded-xl bg-white p-4 shadow">
          <p className="font-semibold">{d.customerId?.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span>Total: {d.totalAmount}</span><span>Paid: {d.amountPaid}</span><span>Balance: {d.balance}</span>
            <span className={`rounded px-2 py-1 text-xs ${statusClass(d.status)}`}>{d.status}</span>
          </div>
          <div className="mt-2 flex gap-2">
            <input type="number" className="rounded border p-2" value={payments[d._id] || ""} onChange={(e) => setPayments({ ...payments, [d._id]: e.target.value })} placeholder="Amount" />
            <button onClick={() => pay(d._id)} className="rounded bg-slate-900 px-3 py-2 text-sm text-white">Record Payment</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportsPage() {
  const [period, setPeriod] = useState("daily");
  const exportCsv = () => window.open(`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/reports/export?period=${period}`, "_blank");
  return (
    <div className="rounded-xl bg-white p-4 shadow">
      <h2 className="text-lg font-semibold">Sales Reports</h2>
      <select className="mt-2 rounded border p-2" value={period} onChange={(e) => setPeriod(e.target.value)}>
        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
      </select>
      <button onClick={exportCsv} className="ml-2 rounded bg-slate-900 px-3 py-2 text-white">Export CSV</button>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Protected><Layout><DashboardPage /></Layout></Protected>} />
      <Route path="/products" element={<Protected><Layout><ProductsPage /></Layout></Protected>} />
      <Route path="/customers" element={<Protected><Layout><CustomersPage /></Layout></Protected>} />
      <Route path="/sales" element={<Protected><Layout><SalesPage /></Layout></Protected>} />
      <Route path="/debts" element={<Protected><Layout><DebtsPage /></Layout></Protected>} />
      <Route path="/reports" element={<Protected><Layout><ReportsPage /></Layout></Protected>} />
    </Routes>
  );
}
