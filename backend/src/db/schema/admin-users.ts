import { pgTable, uuid, varchar, smallint, timestamp } from 'drizzle-orm/pg-core'

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').primaryKey(),
  email: varchar('email', { length: 120 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 60 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 255 }),
  status: smallint('status').notNull().default(1),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
})
