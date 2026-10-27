import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const scripts = pgTable("scripts", {
  id: serial("id").primaryKey(),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  fontSize: integer("font_size").notNull().default(48),
  speed: integer("speed").notNull().default(3),
  mirrored: boolean("mirrored").notNull().default(false),
  googleDocId: text("google_doc_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScriptSchema = createInsertSchema(scripts).omit({
  id: true,
  createdAt: true,
});

export type InsertScript = z.infer<typeof insertScriptSchema>;
export type Script = typeof scripts.$inferSelect;

export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  defaultFontSize: integer("default_font_size").notNull().default(48),
  defaultSpeed: integer("default_speed").notNull().default(3),
  defaultMirrored: boolean("default_mirrored").notNull().default(false),
  defaultMargin: integer("default_margin").notNull().default(5),
});

export const insertSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
});

export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof userSettings.$inferSelect;
