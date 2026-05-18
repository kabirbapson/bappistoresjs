import bcrypt from 'bcryptjs'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { Customer, Product, Sale, User } from './models.js'
import { shopHasBeenUsed } from './shopDataMarker.js'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')
const setupCompleteFlag = join(projectRoot, '.setup-complete')

const SAMPLE_PRODUCTS = [
  { name: 'Coca-Cola 50cl Crate', category: 'Beverages', quantity: 15, costPrice: 4200, sellingPrice: 5000 },
  { name: 'Fanta Orange 50cl Crate', category: 'Beverages', quantity: 12, costPrice: 4000, sellingPrice: 4800 },
  { name: 'Maltina Malt Drink Crate', category: 'Beverages', quantity: 10, costPrice: 4500, sellingPrice: 5200 },
  { name: 'Eva Water 75cl Pack', category: 'Beverages', quantity: 30, costPrice: 1200, sellingPrice: 1500 },
]

const SAMPLE_CUSTOMERS = [
  { name: 'Ahmadu Bello', phone: '08031234567', address: 'Sabon Gari, Kano' },
  { name: 'Fatima Provision Store', phone: '08099887766', address: 'Fagge, Kano' },
  { name: 'Yusuf Trading', phone: '07012345678', address: 'Nassarawa, Kano' },
]

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

export async function ensureSampleDataIfEmpty() {
  if ((await Product.countDocuments()) === 0) {
    await Product.insertMany(SAMPLE_PRODUCTS)
    console.log('Bootstrap: sample products added')
  }
  if ((await Customer.countDocuments()) === 0) {
    await Customer.insertMany(SAMPLE_CUSTOMERS)
    console.log('Bootstrap: sample customers added')
  }
}

/**
 * On server start: ensure admin login only.
 * Sample products/customers are added only during SETUP (seed.js), never on every START.
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
