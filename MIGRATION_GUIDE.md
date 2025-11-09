# Migration Guide: From Bolt to Any Backend

This guide explains how to take the PrizePicks Analytics system and use it with any backend framework, since Bolt won't be a permanent fixture.

## Overview

The system is designed to be **framework-agnostic**:
- All data is stored in Supabase PostgreSQL
- Database schema is documented and portable
- No Bolt-specific dependencies exist
- Can integrate with any backend technology

---

## Step 1: Set Up Supabase Database (Already Done)

The database is already configured with:
- 7 production-ready tables
- Row Level Security (RLS) enabled
- Proper indexes for performance
- All migration files in `supabase/migrations/`

**Database credentials** are in `.env`:
```bash
VITE_SUPABASE_URL=https://uvnkvobboxtplhigmfnc.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

To get the **Service Role Key** (needed for backend):
1. Go to Supabase Dashboard
2. Project Settings → API
3. Copy `service_role` (ANON key is already in .env)

---

## Step 2: Choose Your Backend Technology

### Option A: Node.js + Express

**Setup:**
```bash
npm init -y
npm install express @supabase/supabase-js dotenv cors
npm install -D typescript @types/node ts-node
```

**Basic server structure:**
```
backend/
├── src/
│   ├── server.ts              # Main app
│   ├── routes/
│   │   ├── projections.ts
│   │   ├── analyses.ts
│   │   └── sync.ts
│   ├── services/
│   │   ├── supabase.ts        # DB client
│   │   ├── prizepicks.ts      # API integration
│   │   └── analyzer.ts        # Analysis logic
│   └── types.ts               # Type definitions
├── .env
└── package.json
```

**Example route:**
```typescript
// backend/src/routes/projections.ts
import express from 'express';
import { getSupabaseClient } from '../services/supabase';

const router = express.Router();

router.get('/active', async (req, res) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('projections')
    .select('*')
    .eq('status', 'active');

  if (error) return res.status(500).json(error);
  res.json(data);
});

export default router;
```

**Start server:**
```bash
npx ts-node src/server.ts
```

### Option B: Python + FastAPI

**Setup:**
```bash
pip install fastapi uvicorn supabase python-dotenv
```

**Basic structure:**
```
backend/
├── main.py                 # Main app
├── routes/
│   ├── projections.py
│   └── analyses.py
├── services/
│   ├── supabase.py
│   ├── prizepicks.py
│   └── analyzer.py
├── models.py               # Pydantic models
├── .env
└── requirements.txt
```

**Example endpoint:**
```python
# main.py
from fastapi import FastAPI
from supabase import create_client
import os

app = FastAPI()

@app.get("/projections/active")
async def get_active_projections():
    supabase = create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_KEY")
    )
    response = supabase.table("projections").select("*").eq("status", "active").execute()
    return response.data

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

**Start server:**
```bash
uvicorn main:app --reload
```

### Option C: Go + Gin

**Setup:**
```bash
go mod init prizepicks-api
go get github.com/gin-gonic/gin
go get github.com/supabase-community/supabase-go
```

**Example endpoint:**
```go
package main

import (
    "github.com/gin-gonic/gin"
    "github.com/supabase-community/supabase-go"
)

func main() {
    router := gin.Default()

    router.GET("/projections/active", func(c *gin.Context) {
        client := supabase.CreateClient(os.Getenv("SUPABASE_URL"), os.Getenv("SUPABASE_KEY"))
        var projections []Projection
        client.DB.From("projections").Select("*").Eq("status", "active").ExecuteTo(&projections)
        c.JSON(200, projections)
    })

    router.Run(":8000")
}
```

### Option D: Supabase Edge Functions (Serverless)

No backend server needed! Deploy functions directly:

```typescript
// supabase/functions/fetch-projections/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("projections")
    .select("*")
    .eq("status", "active");

  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
```

Deploy with:
```bash
supabase functions deploy fetch-projections
```

---

## Step 3: Implement Core Services

### PrizePicks Integration

```typescript
// services/prizepicks.ts
import { getSupabaseClient } from './supabase';

interface PrizePicksProjection {
  id: string;
  attributes: {
    line_score: number;
    stat_type: string;
  };
  relationships: {
    new_player?: { data?: { id: string } };
    league?: { data?: { id: string } };
  };
}

export async function syncPrizePicksData(sport?: string) {
  const supabase = getSupabaseClient();
  const startTime = Date.now();

  try {
    // Fetch from PrizePicks API
    const url = 'https://partner-api.prizepicks.com/projections?per_page=1000';
    const response = await fetch(url);
    const data = await response.json();

    // Log the sync
    await supabase.from('api_sync_log').insert({
      source: 'prizepicks',
      endpoint: url,
      status: 'success',
      records_fetched: data.data.length,
      records_processed: data.data.length,
      request_duration_ms: Date.now() - startTime,
    });

    // Save projections
    const projections = data.data.map((p: PrizePicksProjection) => ({
      external_id: p.id,
      player_name: 'Player Name',
      sport: 'NFL',
      stat_type: p.attributes.stat_type,
      line_score: p.attributes.line_score.toString(),
      status: 'active',
    }));

    const { error } = await supabase
      .from('projections')
      .upsert(projections, { onConflict: 'external_id' });

    if (error) throw error;

    return { success: true, count: projections.length };
  } catch (error) {
    await supabase.from('api_sync_log').insert({
      source: 'prizepicks',
      endpoint: 'https://partner-api.prizepicks.com/projections',
      status: 'failed',
      error_message: (error as Error).message,
      request_duration_ms: Date.now() - startTime,
    });
    throw error;
  }
}
```

### Analysis Engine

```typescript
// services/analyzer.ts
import { getSupabaseClient } from './supabase';
import { Projection, Analysis, InsertAnalysisMetadata } from '../types';

export async function analyzeProjection(projectionId: number): Promise<Analysis> {
  const supabase = getSupabaseClient();

  // Get projection
  const { data: projection } = await supabase
    .from('projections')
    .select('*')
    .eq('id', projectionId)
    .single();

  if (!projection) throw new Error('Projection not found');

  // Get player stats (from cache or API)
  const playerStats = await getPlayerStats(
    projection.player_name,
    projection.sport,
    projection.stat_type
  );

  // Perform analysis
  const lineScore = parseFloat(projection.line_score);
  const recentAverage = parseFloat(playerStats.average || '0');
  const difference = recentAverage - lineScore;
  const percentDifference = (difference / lineScore) * 100;

  let recommendation: 'over' | 'under' | 'skip' = 'skip';
  let confidence = 50;

  if (Math.abs(percentDifference) > 15) {
    recommendation = difference > 0 ? 'over' : 'under';
    confidence = 75;
  } else if (Math.abs(percentDifference) > 8) {
    recommendation = difference > 0 ? 'over' : 'under';
    confidence = 60;
  }

  // Save analysis
  const { data: analysis } = await supabase
    .from('analyses')
    .insert({
      projection_id: projectionId,
      recommendation,
      confidence_score: confidence,
      recent_average: playerStats.average,
      reasoning: `Line is ${percentDifference.toFixed(1)}% ${difference > 0 ? 'below' : 'above'} recent average.`,
    })
    .select()
    .single();

  // Save detailed metadata
  await supabase.from('analysis_metadata').insert({
    analysis_id: analysis.id,
    recent_average_value: recentAverage,
    line_score_value: lineScore,
    percent_difference: percentDifference,
  });

  return analysis;
}

async function getPlayerStats(playerName: string, sport: string, statType: string) {
  const supabase = getSupabaseClient();

  // Try cache first
  const { data: cached } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_name', playerName)
    .eq('sport', sport)
    .eq('stat_type', statType)
    .single();

  if (cached && Date.now() - new Date(cached.last_fetched).getTime() < 3600000) {
    return cached;
  }

  // Fetch fresh stats (from StatMuse or your API)
  const stats = await fetchStatsMuseData(playerName, sport, statType);

  // Cache it
  await supabase.from('player_stats').upsert({
    player_name: playerName,
    sport: sport,
    stat_type: statType,
    average: stats.average.toString(),
    recent_games: JSON.stringify(stats.recentGames),
  }, {
    onConflict: 'player_name,sport,stat_type'
  });

  return stats;
}
```

---

## Step 4: Set Up Scheduled Jobs

### Node.js with node-cron

```typescript
// jobs/scheduler.ts
import cron from 'node-cron';
import { syncPrizePicksData } from '../services/prizepicks';
import { analyzeProjection } from '../services/analyzer';

// Sync PrizePicks every 4 hours
cron.schedule('0 */4 * * *', async () => {
  console.log('Starting PrizePicks sync...');
  try {
    const result = await syncPrizePicksData();
    console.log(`Synced ${result.count} projections`);

    // Analyze all new projections
    // ... implementation
  } catch (error) {
    console.error('Sync failed:', error);
  }
});

// Analyze projections every 30 minutes
cron.schedule('*/30 * * * *', async () => {
  console.log('Starting analysis...');
  // Analyze all active projections
});
```

### Python APScheduler

```python
from apscheduler.schedulers.background import BackgroundScheduler
from services.prizepicks import sync_prizepicks_data
from services.analyzer import analyze_all_projections

scheduler = BackgroundScheduler()

# Sync every 4 hours
scheduler.add_job(sync_prizepicks_data, 'interval', hours=4)

# Analyze every 30 minutes
scheduler.add_job(analyze_all_projections, 'interval', minutes=30)

scheduler.start()
```

---

## Step 5: Set Up Frontend Connection

### React

```typescript
// src/hooks/useProjections.ts
import { useEffect, useState } from 'react';

export function useProjections() {
  const [projections, setProjections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:8000/projections/active')
      .then(res => res.json())
      .then(data => setProjections(data))
      .finally(() => setLoading(false));
  }, []);

  return { projections, loading };
}
```

### Direct Supabase Client (No backend needed)

```typescript
// src/services/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function getActiveProjections() {
  const { data } = await supabase
    .from('projections')
    .select('*')
    .eq('status', 'active');
  return data;
}
```

---

## Step 6: Environment Configuration

Create `.env.local` (backend):
```env
VITE_SUPABASE_URL=https://uvnkvobboxtplhigmfnc.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional
PRIZEPICKS_API_URL=https://partner-api.prizepicks.com
STATMUSE_API_URL=https://www.statmuse.com/api
```

Create `.env` (frontend):
```env
VITE_SUPABASE_URL=https://uvnkvobboxtplhigmfnc.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:8000
```

---

## Step 7: Database Operations Reference

### Fetch Active Projections

```typescript
const { data } = await supabase
  .from('projections')
  .select('*')
  .eq('status', 'active');
```

### Save Analysis

```typescript
const { data } = await supabase
  .from('analyses')
  .insert({
    projection_id: 123,
    recommendation: 'over',
    confidence_score: 75,
    reasoning: 'Player averaging 25.3 PPG vs 24.5 line',
  });
```

### Get User Preferences

```typescript
const { data } = await supabase
  .from('user_preferences')
  .select('*')
  .eq('user_id', userId)
  .single();
```

### Track API Health

```typescript
const { data } = await supabase
  .from('api_sync_log')
  .select('*')
  .order('started_at', { ascending: false })
  .limit(10);
```

---

## Step 8: Deployment

### Deploy to Vercel (Node.js)

```bash
npm install -g vercel
vercel
```

### Deploy to Railway

```bash
npm install -g railway
railway link
railway up
```

### Deploy to Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8000
CMD ["npm", "start"]
```

### Deploy Edge Functions

```bash
supabase functions deploy
```

---

## Migration Checklist

- [ ] Supabase database configured
- [ ] Service role key retrieved
- [ ] Backend framework chosen and installed
- [ ] Database types defined (`server/types.ts`)
- [ ] Supabase client initialized
- [ ] PrizePicks API integration implemented
- [ ] Analysis engine implemented
- [ ] Routes/endpoints created
- [ ] Scheduled jobs configured
- [ ] Frontend connected to backend/Supabase
- [ ] Environment variables configured
- [ ] Error handling and logging added
- [ ] API health monitoring set up
- [ ] Deployed to production

---

## Common Issues & Solutions

### Issue: CORS errors when calling backend
**Solution**: Add CORS middleware:
```typescript
import cors from 'cors';
app.use(cors());
```

### Issue: Can't read from database (RLS denied)
**Solution**: Use correct key:
- Frontend: Anon key (read-only)
- Backend: Service role key (read/write)

### Issue: Slow queries
**Solution**: Check indexes:
```sql
EXPLAIN ANALYZE SELECT * FROM projections WHERE sport = 'NFL';
```

### Issue: Service role key too permissive
**Solution**: Create custom RLS policies instead of using service role

---

## Next Steps

1. Choose your backend technology
2. Copy `server/types.ts` to your backend
3. Copy `DATABASE_GUIDE.md` for reference
4. Implement services and routes
5. Set up scheduled jobs
6. Configure frontend connection
7. Deploy to production

The database will work with any technology stack!
