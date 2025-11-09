import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Stores PrizePicks projections
 */
export const projections = mysqlTable("projections", {
  id: int("id").autoincrement().primaryKey(),
  externalId: varchar("externalId", { length: 128 }).notNull().unique(), // PrizePicks projection ID
  playerName: varchar("playerName", { length: 255 }).notNull(),
  sport: varchar("sport", { length: 64 }).notNull(),
  league: varchar("league", { length: 64 }),
  team: varchar("team", { length: 128 }),
  opponent: varchar("opponent", { length: 128 }),
  statType: varchar("statType", { length: 128 }).notNull(), // e.g., "Points", "Rebounds", "Assists"
  lineScore: varchar("lineScore", { length: 32 }).notNull(), // The projection line value
  gameTime: timestamp("gameTime"),
  status: mysqlEnum("status", ["active", "completed", "cancelled"]).default("active").notNull(),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Projection = typeof projections.$inferSelect;
export type InsertProjection = typeof projections.$inferInsert;

/**
 * Stores analysis results and recommendations
 */
export const analyses = mysqlTable("analyses", {
  id: int("id").autoincrement().primaryKey(),
  projectionId: int("projectionId").notNull(),
  recommendation: mysqlEnum("recommendation", ["over", "under", "skip"]).notNull(),
  confidenceScore: int("confidenceScore").notNull(), // 0-100
  recentAverage: varchar("recentAverage", { length: 32 }), // Player's recent average for this stat
  gamesAnalyzed: int("gamesAnalyzed"), // Number of recent games analyzed
  reasoning: text("reasoning"), // Explanation for the recommendation
  analyzedAt: timestamp("analyzedAt").defaultNow().notNull(),
});

export type Analysis = typeof analyses.$inferSelect;
export type InsertAnalysis = typeof analyses.$inferInsert;

/**
 * Cache for player statistics from StatMuse
 */
export const playerStats = mysqlTable("playerStats", {
  id: int("id").autoincrement().primaryKey(),
  playerName: varchar("playerName", { length: 255 }).notNull(),
  sport: varchar("sport", { length: 64 }).notNull(),
  statType: varchar("statType", { length: 128 }).notNull(),
  recentGames: text("recentGames"), // JSON array of recent game stats
  average: varchar("average", { length: 32 }),
  lastFetched: timestamp("lastFetched").defaultNow().notNull(),
});

export type PlayerStat = typeof playerStats.$inferSelect;
export type InsertPlayerStat = typeof playerStats.$inferInsert;
