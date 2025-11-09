# PrizePicks Analytics Database Guide

## Overview

This database is designed to be **framework-agnostic** and **Bolt-independent**. It can be used with any backend framework (Node.js, Python, Go, Java, etc.) or directly via SQL/REST APIs.

The Supabase PostgreSQL database provides:
- Real-time projection data from PrizePicks API
- AI-powered statistical analysis
- Model performance tracking
- User preferences management
- Complete audit logging

**Database URL**: Available in `.env` as `VITE_SUPABASE_URL`
**Anon Key**: Available in `.env` as `VITE_SUPABASE_ANON_KEY`

---

## Table Schema

### Core Tables

#### 1. `projections`
Stores PrizePicks projection lines fetched from their API.

```sql
SELECT * FROM projections WHERE status = 'active' LIMIT 10;
```

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| external_id | TEXT | Unique ID from PrizePicks (UNIQUE) |
| player_name | TEXT | Player's name |
| sport | TEXT | Sport type (NFL, NBA, MLB, NHL, CFB) |
| league | TEXT | League name |
| team | TEXT | Player's team |
| opponent | TEXT | Opposing team |
| stat_type | TEXT | Stat type (Points, Rebounds, Assists, etc.) |
| line_score | TEXT | Projection line value |
| game_time | TIMESTAMPTZ | Scheduled game time |
| status | TEXT | 'active', 'completed', or 'cancelled' |
| fetched_at | TIMESTAMPTZ | When data was fetched from API |
| created_at | TIMESTAMPTZ | Record creation timestamp |

**Indexes**: `external_id` (UNIQUE), `status`, `sport`

---

#### 2. `analyses`
AI-generated over/under recommendations based on projection + player stats.

```sql
SELECT * FROM analyses WHERE confidence_score >= 65 ORDER BY analyzed_at DESC;
```

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| projection_id | BIGINT | FK to projections |
| recommendation | TEXT | 'over', 'under', or 'skip' |
| confidence_score | INTEGER | 0-100 confidence level |
| recent_average | TEXT | Player's recent average |
| games_analyzed | INTEGER | Number of games analyzed |
| reasoning | TEXT | Explanation of recommendation |
| analyzed_at | TIMESTAMPTZ | Analysis timestamp |

**Indexes**: `projection_id`

---

#### 3. `player_stats`
Caches player statistics to reduce API calls.

```sql
SELECT * FROM player_stats
WHERE player_name = 'Player Name' AND sport = 'NFL';
```

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| player_name | TEXT | Player's name |
| sport | TEXT | Sport type |
| stat_type | TEXT | Stat type (Points, Rebounds, etc.) |
| recent_games | TEXT | JSON array of recent game values |
| average | TEXT | Recent average value |
| last_fetched | TIMESTAMPTZ | Last update timestamp |

**Unique Constraint**: `(player_name, sport, stat_type)`

---

### Enhancement Tables

#### 4. `api_sync_log`
Tracks all API calls for debugging and performance monitoring.

```sql
SELECT * FROM api_sync_log
WHERE status = 'failed' ORDER BY started_at DESC;
```

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| source | TEXT | 'prizepicks' or 'statmuse' |
| endpoint | TEXT | API endpoint URL |
| sport | TEXT | Sport filter (if applicable) |
| status | TEXT | 'success', 'partial', or 'failed' |
| records_fetched | INTEGER | Count of records retrieved |
| records_processed | INTEGER | Count successfully processed |
| error_message | TEXT | Error details if failed |
| request_duration_ms | INTEGER | API response time |
| started_at | TIMESTAMPTZ | Sync start time |
| completed_at | TIMESTAMPTZ | Sync completion time |

**Indexes**: `source`, `status`, `started_at`

---

#### 5. `model_performance`
Tracks prediction accuracy for model evaluation and improvement.

```sql
SELECT
  model_version,
  COUNT(*) as total_predictions,
  SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as accuracy
FROM model_performance
WHERE evaluated_at > NOW() - INTERVAL '30 days'
GROUP BY model_version;
```

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| analysis_id | BIGINT | FK to analyses |
| projection_id | BIGINT | FK to projections |
| prediction_over_under | TEXT | 'over' or 'under' |
| prediction_confidence | INTEGER | Confidence score |
| actual_outcome | TEXT | 'over', 'under', 'push', 'cancelled', 'unknown' |
| is_correct | BOOLEAN | Whether prediction was correct |
| model_version | TEXT | Model version string |
| evaluated_at | TIMESTAMPTZ | Evaluation timestamp |

**Indexes**: `model_version`, `is_correct`, `analysis_id`

---

#### 6. `user_preferences`
Stores user settings (framework-agnostic).

```sql
SELECT * FROM user_preferences WHERE user_id = 'user-uuid';
```

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| user_id | UUID | Supabase auth user ID (UNIQUE) |
| sports_to_track | TEXT[] | Array of sports (e.g., `['NFL', 'NBA']`) |
| min_confidence_threshold | INTEGER | Minimum confidence (0-100) |
| enable_notifications | BOOLEAN | Whether to send alerts |
| notification_channels | TEXT[] | Array of channels (e.g., `['email']`) |
| risk_profile | TEXT | 'conservative', 'moderate', or 'aggressive' |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

**Indexes**: `user_id` (UNIQUE)

---

#### 7. `analysis_metadata`
Detailed intermediate analysis data for explainability.

```sql
SELECT * FROM analysis_metadata WHERE analysis_id = 123;
```

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Primary key |
| analysis_id | BIGINT | FK to analyses |
| recent_average_value | NUMERIC | Player's recent average |
| line_score_value | NUMERIC | Projection line |
| percent_difference | NUMERIC | % difference from line |
| hit_rate_5_games | NUMERIC | Hit rate in last 5 games |
| games_over_line | INTEGER | Games player went over |
| games_under_line | INTEGER | Games player went under |
| standard_deviation | NUMERIC | Statistical variance |
| coefficient_of_variation | NUMERIC | CV for consistency |
| trend_indicator | TEXT | 'increasing', 'stable', 'decreasing' |
| consistency_indicator | TEXT | 'high', 'medium', 'low' |
| last_game_performance | TEXT | Previous game result |
| last_3_games_average | NUMERIC | 3-game average |
| injury_status | TEXT | Injury notes |
| player_notes | TEXT | Additional context |
| created_at | TIMESTAMPTZ | Creation timestamp |

**Indexes**: `analysis_id`

---

## Access Patterns

### Using Direct SQL (Any Backend)

```sql
-- Get all active projections with latest analyses
SELECT
  p.*,
  a.recommendation,
  a.confidence_score,
  a.reasoning
FROM projections p
LEFT JOIN analyses a ON p.id = a.projection_id
WHERE p.status = 'active'
  AND a.analyzed_at = (
    SELECT MAX(analyzed_at)
    FROM analyses
    WHERE projection_id = p.id
  )
ORDER BY a.confidence_score DESC;

-- Get projections for a specific sport
SELECT * FROM projections
WHERE sport = 'NFL' AND status = 'active'
ORDER BY fetched_at DESC;

-- Calculate model accuracy
SELECT
  model_version,
  COUNT(*) as predictions,
  SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)::FLOAT /
    COUNT(*)::FLOAT as accuracy,
  AVG(prediction_confidence) as avg_confidence
FROM model_performance
WHERE evaluated_at > NOW() - INTERVAL '7 days'
GROUP BY model_version;
```

### Using Supabase REST API

Get active projections:
```bash
curl -X GET 'https://uvnkvobboxtplhigmfnc.supabase.co/rest/v1/projections?status=eq.active' \
  -H 'apikey: YOUR_ANON_KEY'
```

Get analyses with high confidence:
```bash
curl -X GET 'https://uvnkvobboxtplhigmfnc.supabase.co/rest/v1/analyses?confidence_score=gte.65' \
  -H 'apikey: YOUR_ANON_KEY'
```

### Using JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Get active projections
const { data: projections } = await supabase
  .from('projections')
  .select('*')
  .eq('status', 'active');

// Get latest analysis for a projection
const { data: analysis } = await supabase
  .from('analyses')
  .select('*')
  .eq('projection_id', 123)
  .order('analyzed_at', { ascending: false })
  .limit(1)
  .single();

// Get user preferences
const { data: prefs } = await supabase
  .from('user_preferences')
  .select('*')
  .eq('user_id', userId)
  .single();
```

### Using Python

```python
import psycopg2
from supabase import create_client, Client

# Using Supabase client
url = "https://uvnkvobboxtplhigmfnc.supabase.co"
key = "YOUR_ANON_KEY"
supabase: Client = create_client(url, key)

# Get active projections
projections = supabase.table("projections").select("*").eq("status", "active").execute()

# Get model accuracy
accuracy = supabase.rpc("get_model_accuracy", {"days": 7}).execute()
```

---

## Security & Access Control

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

| Table | SELECT | INSERT | UPDATE |
|-------|--------|--------|--------|
| projections | Public | Service Role Only | Service Role Only |
| analyses | Public | Service Role Only | Service Role Only |
| player_stats | Public | Service Role Only | Service Role Only |
| api_sync_log | Public | Service Role Only | N/A |
| model_performance | Public | Service Role Only | N/A |
| user_preferences | Authenticated (own only) | Authenticated (own) | Authenticated (own) |
| analysis_metadata | Public | Service Role Only | N/A |

### Access Keys

- **Anon Key**: For frontend/public access (read-only for most tables)
- **Service Role Key**: For backend operations (available as `SUPABASE_SERVICE_ROLE_KEY`)

### Using Service Role for Backend

```typescript
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY // Use service role for writes
);

// Backend can insert projections
await supabaseAdmin
  .from('projections')
  .insert([{ external_id, player_name, sport, ... }]);
```

---

## Common Queries

### 1. Get High-Confidence Over/Under Picks
```sql
SELECT
  p.player_name,
  p.sport,
  p.stat_type,
  p.line_score,
  a.recommendation,
  a.confidence_score,
  a.reasoning
FROM projections p
JOIN analyses a ON p.id = a.projection_id
WHERE p.status = 'active'
  AND a.confidence_score >= 70
ORDER BY a.confidence_score DESC;
```

### 2. Track API Health
```sql
SELECT
  source,
  status,
  COUNT(*) as count,
  AVG(request_duration_ms) as avg_duration_ms
FROM api_sync_log
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY source, status;
```

### 3. Get Player Stats History
```sql
SELECT
  p.player_name,
  p.sport,
  p.stat_type,
  json_agg(a.confidence_score ORDER BY a.analyzed_at) as predictions,
  COUNT(a.id) as total_predictions
FROM projections p
LEFT JOIN analyses a ON p.id = a.projection_id
WHERE p.player_name = 'LeBron James'
GROUP BY p.player_name, p.sport, p.stat_type;
```

### 4. Calculate Win Rate by Sport
```sql
SELECT
  p.sport,
  COUNT(CASE WHEN mp.is_correct THEN 1 END) as correct,
  COUNT(*) as total,
  ROUND(
    100.0 * COUNT(CASE WHEN mp.is_correct THEN 1 END) / COUNT(*),
    2
  ) as accuracy_percent
FROM model_performance mp
JOIN analyses a ON mp.analysis_id = a.id
JOIN projections p ON a.projection_id = p.id
WHERE mp.evaluated_at > NOW() - INTERVAL '30 days'
GROUP BY p.sport;
```

### 5. Find Inconsistent Players
```sql
SELECT
  p.player_name,
  p.sport,
  COUNT(*) as projections,
  STDDEV(a.confidence_score) as confidence_variance
FROM projections p
JOIN analyses a ON p.id = a.projection_id
WHERE p.status = 'completed'
GROUP BY p.player_name, p.sport
HAVING STDDEV(a.confidence_score) > 15
ORDER BY confidence_variance DESC;
```

---

## Integration Patterns

### Pattern 1: Backend Service (Node.js/Express)

```typescript
// routes/projections.ts
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

router.get('/active', async (req, res) => {
  const { data, error } = await supabase
    .from('projections')
    .select('*')
    .eq('status', 'active');

  if (error) return res.status(500).json(error);
  res.json(data);
});

router.post('/fetch', async (req, res) => {
  // Fetch from PrizePicks API
  const projections = await fetchPrizePicksData();

  // Log the sync
  await supabase.from('api_sync_log').insert({
    source: 'prizepicks',
    endpoint: 'https://partner-api.prizepicks.com/projections',
    status: 'success',
    records_fetched: projections.length,
    started_at: new Date(),
  });

  // Save projections
  const { error } = await supabase
    .from('projections')
    .upsert(projections, { onConflict: 'external_id' });

  res.json({ success: true, count: projections.length });
});

export default router;
```

### Pattern 2: Edge Function

```typescript
// supabase/functions/analyze-projection/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js";

serve(async (req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const { projectionId } = await req.json();

  // Get projection
  const { data: projection } = await supabase
    .from('projections')
    .select('*')
    .eq('id', projectionId)
    .single();

  // Get player stats
  const { data: stats } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_name', projection.player_name)
    .single();

  // Analyze and save
  const analysis = analyzeProjection(projection, stats);

  await supabase
    .from('analyses')
    .insert(analysis);

  return new Response(JSON.stringify(analysis), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

### Pattern 3: Scheduled Jobs (Node.js Cron)

```typescript
// jobs/sync-projections.ts
import cron from 'node-cron';
import { fetchProjections } from './prizepicks';
import { analyzeProjections } from './analyzer';

cron.schedule('0 */4 * * *', async () => {
  console.log('Syncing projections...');

  const projections = await fetchProjections();
  await saveToDatabase(projections);

  const analyses = await analyzeProjections(projections);
  await saveAnalyses(analyses);
});
```

---

## Migration & Backup

### Exporting Data

```bash
# Export all projections to CSV
curl -X GET 'https://uvnkvobboxtplhigmfnc.supabase.co/rest/v1/projections' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Accept: text/csv' > projections.csv
```

### Using pg_dump (PostgreSQL)

```bash
pg_dump -h db.uvnkvobboxtplhigmfnc.supabase.co \
  -U postgres \
  -d postgres \
  --tables 'public.projections,public.analyses' \
  > backup.sql
```

---

## Performance Optimization

### Recommended Indexes

Already created:
- `idx_projections_status` - Filter by active/completed
- `idx_projections_sport` - Filter by sport
- `idx_analyses_projection_id` - Join analyses
- `idx_api_sync_log_started_at` - Time-based queries
- `idx_model_performance_is_correct` - Accuracy queries

### Query Optimization Tips

1. **Always use WHERE clauses** for large tables
2. **Use LIMIT** when fetching multiple records
3. **Create filtered views** for common queries
4. **Use EXPLAIN** to optimize slow queries

```sql
EXPLAIN ANALYZE
SELECT * FROM projections
WHERE sport = 'NFL' AND status = 'active'
LIMIT 10;
```

---

## Troubleshooting

### No Records Appearing?

Check RLS policies:
```sql
SELECT tablename, policyname FROM pg_policies
WHERE tablename = 'projections';
```

### Slow Queries?

Check index usage:
```sql
EXPLAIN ANALYZE
SELECT * FROM analyses WHERE confidence_score > 70;
```

### Connection Issues?

Verify credentials:
```bash
psql -h db.uvnkvobboxtplhigmfnc.supabase.co \
  -U postgres \
  -d postgres
```

---

## Next Steps

1. **Set up backend API** - Use any framework (Express, FastAPI, Go, etc.)
2. **Implement sync jobs** - Keep PrizePicks data updated
3. **Build frontend** - Connect via REST or Supabase client
4. **Add monitoring** - Track `api_sync_log` for health
5. **Evaluate models** - Use `model_performance` table for accuracy tracking

All code is **framework-agnostic** and can be migrated anytime!
