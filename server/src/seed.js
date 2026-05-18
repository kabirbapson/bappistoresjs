import 'dotenv/config'
import { closeDB, connectDB } from './config/db.js'
import { ensureSampleDataIfEmpty, upsertAdminFromEnv } from './bootstrap.js'
import { markShopHasRealData } from './shopDataMarker.js'

await connectDB(process.env.MONGO_URI)

await upsertAdminFromEnv()
await ensureSampleDataIfEmpty()
markShopHasRealData()

console.log('Seed complete — starter data: 1 product, 1 customer, 1 sample invoice')
await closeDB()
process.exit(0)
