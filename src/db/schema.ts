import { boolean, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const households = pgTable("households", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").references(() => households.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatar: text("avatar").notNull().default("FM"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").references(() => households.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  number: text("number").notNull(),
  category: text("category").notNull().default("General"),
  description: text("description").notNull().default(""),
  logoText: text("logo_text").notNull(),
  color: text("color").notNull().default("#0f766e"),
  streamUrl: text("stream_url").notNull().default(""),
  websiteUrl: text("website_url").notNull().default(""),
  currentProgram: text("current_program").notNull().default("Programación nacional"),
  nextProgram: text("next_program").notNull().default("Próximamente"),
  progress: integer("progress").notNull().default(35),
  isFavorite: boolean("is_favorite").notNull().default(false),
  isLive: boolean("is_live").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  householdId: integer("household_id").references(() => households.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("Smart TV"),
  room: text("room").notNull().default("Sala"),
  status: text("status").notNull().default("offline"),
  code: text("code").notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Channel = typeof channels.$inferSelect;
export type Device = typeof devices.$inferSelect;
