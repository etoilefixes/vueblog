import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { env } from '../config/env.js'

export const pgPool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 20,
})

export const db = drizzle(pgPool)
