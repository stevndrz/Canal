import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

// 1. Tabla Households
export const households = pgTable("households", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 2. Tabla Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").references(() => households.id),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// 3. Tabla Sessions
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// 4. Tabla Channels
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").references(() => households.id),
  name: text("name").notNull(),
  number: text("number"),
  category: text("category"),
  description: text("description"),
  logoText: text("logo_text"),
  logoUrl: text("logo_url"),
  streamUrl: text("stream_url"),
  color: text("color"),
  websiteUrl: text("website_url"),
  currentProgram: text("current_program"),
  nextProgram: text("next_program"),
  progress: integer("progress"),
  isFavorite: boolean("is_favorite").default(false),
  isLive: boolean("is_live").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// 5. Tabla Devices
export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").references(() => households.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  room: text("room").notNull(),
  status: text("status").notNull(),
  code: text("code").notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});