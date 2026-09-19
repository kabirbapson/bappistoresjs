import { Route, Routes } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Layout from './components/Layout'
import Protected from './components/Protected'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import DebtsPage from './pages/DebtsPage'
import LoginPage from './pages/LoginPage'
import ProductsPage from './pages/ProductsPage'
import InvoicesPage from './pages/InvoicesPage'
import ReportsPage from './pages/ReportsPage'
import SalesPage from './pages/SalesPage'
import ReceiveStockPage from './pages/ReceiveStockPage'
import ExpensesPage from './pages/ExpensesPage'
import CloseoutPage from './pages/CloseoutPage'

function withLayout(Page) {
  return (
    <Protected>
      <Layout>
        <Page />
      </Layout>
    </Protected>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={withLayout(DashboardPage)} />
      <Route path="/products" element={withLayout(ProductsPage)} />
      <Route path="/receive-stock" element={withLayout(ReceiveStockPage)} />
      <Route path="/receive stock" element={withLayout(ReceiveStockPage)} />
      <Route path="/receive%20stock" element={withLayout(ReceiveStockPage)} />
      <Route path="/stock-in" element={withLayout(ReceiveStockPage)} />
      <Route path="/customers" element={withLayout(CustomersPage)} />
      <Route path="/sales" element={withLayout(SalesPage)} />
      <Route path="/invoices" element={withLayout(InvoicesPage)} />
      <Route path="/debts" element={withLayout(DebtsPage)} />
      <Route path="/credit" element={withLayout(DebtsPage)} />
      <Route path="/expenses" element={withLayout(ExpensesPage)} />
      <Route path="/closeout" element={withLayout(CloseoutPage)} />
      <Route path="/reports" element={withLayout(ReportsPage)} />
      <Route path="*" element={withLayout(DashboardPage)} />
    </Routes>
    </ErrorBoundary>
  )
}
