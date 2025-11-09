import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, projections, analyses, playerStats, InsertProjection, InsertAnalysis, InsertPlayerStat } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Projection queries
export async function saveProjections(projectionsData: InsertProjection[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Use upsert to avoid duplicates
  for (const projection of projectionsData) {
    await db.insert(projections).values(projection).onDuplicateKeyUpdate({
      set: {
        playerName: projection.playerName,
        sport: projection.sport,
        league: projection.league,
        team: projection.team,
        opponent: projection.opponent,
        statType: projection.statType,
        lineScore: projection.lineScore,
        gameTime: projection.gameTime,
        status: projection.status,
        fetchedAt: new Date(),
      },
    });
  }
}

export async function getActiveProjections() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(projections).where(eq(projections.status, 'active'));
}

export async function getProjectionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(projections).where(eq(projections.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// Analysis queries
export async function saveAnalysis(analysisData: InsertAnalysis) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(analyses).values(analysisData);
}

export async function getAnalysesByProjectionId(projectionId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(analyses).where(eq(analyses.projectionId, projectionId));
}

// Player stats queries
export async function savePlayerStats(statsData: InsertPlayerStat) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(playerStats).values(statsData);
}

export async function getPlayerStatsByName(playerName: string, sport: string, statType: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(playerStats)
    .where(eq(playerStats.playerName, playerName))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}
