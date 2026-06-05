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
      <Route path="/customers" element={withLayout(CustomersPage)} />
      <Route path="/sales" element={withLayout(SalesPage)} />
      <Route path="/invoices" element={withLayout(InvoicesPage)} />
      <Route path="/debts" element={withLayout(DebtsPage)} />
      <Route path="/reports" element={withLayout(ReportsPage)} />
    </Routes>
    </ErrorBoundary>
  )
}
