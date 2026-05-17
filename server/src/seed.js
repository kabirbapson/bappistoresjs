import 'dotenv/config'
import { closeDB, connectDB } from './config/db.js'
import { ensureSampleDataIfEmpty, upsertAdminFromEnv } from './bootstrap.js'

await connectDB(process.env.MONGO_URI)

await upsertAdminFromEnv()
await ensureSampleDataIfEmpty()

console.log('Seed complete — Bappi Stores Kano')
await closeDB()
process.exit(0)
