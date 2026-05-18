import bcrypt from 'bcryptjs'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { createSaleDocument } from './invoice.js'
import { Customer, Product, Sale, StockLog, User } from './models.js'
import { shopHasBeenUsed } from './shopDataMarker.js'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const setupCompleteFlag = join(projectRoot, '.setup-complete')

/** One generic row each — white-label shops replace these in the app. */
const STARTER_PRODUCT = {
  name: 'Sample product',
  category: 'General',
  quantity: 10,
  costPrice: 100,
  sellingPrice: 150,
}

const STARTER_CUSTOMER = {
  name: 'Sample customer',
  phone: '08000000000',
  address: 'Your shop address',
}

/** Create or update admin from env (used by `npm run seed` and empty DB bootstrap). */
export async function upsertAdminFromEnv() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@bappi.com'
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123'
  const hash = await bcrypt.hash(adminPassword, 10)
  await User.updateOne(
    { email: adminEmail },
    { $set: { email: adminEmail, password: hash } },
    { upsert: true },
  )
}

async function ensureStarterInvoice(product, customer) {
  const qty = 1
  const unitPrice = product.sellingPrice
  const totalAmount = unitPrice * qty
  const totalCost = product.costPrice * qty

  product.quantity = Math.max(0, product.quantity - qty)
  await product.save()
  await StockLog.create({
    productId: product._id,
    change: -qty,
    type: 'sale',
  })

  await createSaleDocument({
    products: [
      {
        productId: product._id,
        productName: product.name,
        quantity: qty,
        costPrice: product.costPrice,
        sellingPrice: unitPrice,
      },
    ],
    totalAmount,
    totalCost,
    profit: totalAmount - totalCost,
    type: 'paid',
    amountPaid: totalAmount,
    creditBalance: 0,
    payments: [{ method: 'cash', amount: totalAmount }],
    customerId: customer._id,
    customerName: customer.name,
    note: 'Example invoice — delete after you add your own sales',
  })
}

/** Fresh shop: 1 sample product, 1 customer, 1 paid invoice (only when collections are empty). */
export async function ensureSampleDataIfEmpty() {
  let product = await Product.findOne()
  if (!product) {
    const created = await Product.create(STARTER_PRODUCT)
    product = created
    console.log('Bootstrap: sample product added (replace in Products)')
  }

  let customer = await Customer.findOne()
  if (!customer) {
    const created = await Customer.create(STARTER_CUSTOMER)
    customer = created
    console.log('Bootstrap: sample customer added (replace in Customers)')
  }

  if ((await Sale.countDocuments()) === 0 && product && customer) {
    await ensureStarterInvoice(product, customer)
    console.log('Bootstrap: sample invoice added (see Invoices — delete when ready)')
  }
}

/**
 * On server start: ensure admin login only.
 * Starter samples run during SETUP (seed.js) or first start on an empty shop DB.
 */
export async function bootstrapIfEmpty() {
  const userCount = await User.countDocuments()
  if (userCount === 0) {
    await upsertAdminFromEnv()
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@bappi.com'
    console.log(`Bootstrap: created admin ${email} (password from SEED_ADMIN_PASSWORD or default admin123)`)
  }

  const saleCount = await Sale.countDocuments()
  const hasRealShop =
    shopHasBeenUsed() || existsSync(setupCompleteFlag) || saleCount > 0

  if (!hasRealShop) {
    await ensureSampleDataIfEmpty()
  }
}
