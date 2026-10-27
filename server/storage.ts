import { scripts, userSettings, type Script, type InsertScript, type Settings, type InsertSettings } from "@shared/schema";
import { eq, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getScripts(): Promise<Script[]>;
  getScript(id: number): Promise<Script | undefined>;
  createScript(script: InsertScript): Promise<Script>;
  updateScript(id: number, data: Partial<InsertScript>): Promise<Script | undefined>;
  deleteScript(id: number): Promise<void>;
  getNextNumber(): Promise<number>;
  getSettings(): Promise<Settings | undefined>;
  upsertSettings(settings: InsertSettings): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  async getScripts(): Promise<Script[]> {
    return db.select().from(scripts).orderBy(asc(scripts.number));
  }

  async getScript(id: number): Promise<Script | undefined> {
    const [script] = await db.select().from(scripts).where(eq(scripts.id, id));
    return script;
  }

  async createScript(script: InsertScript): Promise<Script> {
    const [created] = await db.insert(scripts).values(script).returning();
    return created;
  }

  async updateScript(id: number, data: Partial<InsertScript>): Promise<Script | undefined> {
    const [updated] = await db.update(scripts).set(data).where(eq(scripts.id, id)).returning();
    return updated;
  }

  async deleteScript(id: number): Promise<void> {
    await db.delete(scripts).where(eq(scripts.id, id));
  }

  async getNextNumber(): Promise<number> {
    const all = await this.getScripts();
    if (all.length === 0) return 1;
    return Math.max(...all.map(s => s.number)) + 1;
  }

  async getSettings(): Promise<Settings | undefined> {
    const [settings] = await db.select().from(userSettings);
    return settings;
  }

  async upsertSettings(data: InsertSettings): Promise<Settings> {
    const existing = await this.getSettings();
    if (existing) {
      const [updated] = await db.update(userSettings).set(data).where(eq(userSettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(userSettings).values(data).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
