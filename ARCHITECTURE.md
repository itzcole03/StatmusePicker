# PrizePicks Analytics: System Architecture

## System Overview

A framework-agnostic sports betting analytics platform that compares PrizePicks projection lines with real player performance data to generate high-confidence Over/Under recommendations.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND LAYER                            │
│              (React, Vue, Angular, or any JS framework)          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
    ┌────▼────┐              ┌───────▼──────┐
    │ REST API│              │ Supabase JS  │
    │ Backend │              │ Client (SDK) │
    └────┬────┘              └───────┬──────┘
         │                           │
         └─────────────┬─────────────┘
                       │
         ┌─────────────▼──────────────┐
         │   SUPABASE PostgreSQL      │
         │      DATABASE (Core)       │
         └────────────────────────────┘
         │
    ┌────┴────────┬──────────┬─────────┐
    │             │          │         │
    ▼             ▼          ▼         ▼
┌────────┐  ┌─────────┐ ┌─────────┐ ┌──────────┐
│Project-│  │Analysis │ │Player   │ │API Sync  │
│ions    │  │Results  │ │Stats    │ │Logs      │
└────────┘  └─────────┘ └─────────┘ └──────────┘
```

---

## Database Layer

### Core Tables (7 Total)

#### Data Tables
1. **projections** - PrizePicks projection lines
2. **player_stats** - Cached player performance data
3. **analyses** - AI-generated Over/Under recommendations

#### Metadata Tables
4. **analysis_metadata** - Detailed calculation data
5. **model_performance** - Prediction accuracy tracking
6. **api_sync_log** - API call history and health
7. **user_preferences** - User settings and preferences

### Key Features
- **Row Level Security (RLS)** - All tables protected
- **Indexes** - Optimized for common queries
- **Foreign Keys** - Data integrity
- **Constraints** - Data validation at DB level

See `DATABASE_GUIDE.md` for detailed schema.

---

## Backend Layer

### Architecture Pattern
```
Request → Route → Service → Database
Response ← Formatting ← Business Logic ← Query
```

### Core Services

#### 1. PrizePicks Integration (`services/prizepicks.ts`)
- **Purpose**: Fetch and normalize projection data
- **Input**: PrizePicks API endpoint
- **Output**: Normalized projections for database
- **Sync Pattern**: Scheduled (every 4 hours recommended)

```typescript
export async function syncPrizePicksData(sport?: string) {
  // 1. Fetch from https://partner-api.prizepicks.com/projections
  // 2. Parse and normalize data
  // 3. Log sync status to api_sync_log
  // 4. Upsert to projections table
}
```

#### 2. StatMuse / Player Stats (`services/statmuse.ts`)
- **Purpose**: Get real player performance data
- **Input**: Player name, sport, stat type
- **Output**: Recent games, averages, trends
- **Caching**: 1-hour TTL to reduce API calls

```typescript
export async function getPlayerStats(
  playerName: string,
  sport: string,
  statType: string
) {
  // 1. Check cache (player_stats table)
  // 2. If not cached or stale, fetch from StatMuse/LLM
  // 3. Store in cache
  // 4. Return stats
}
```

#### 3. Analysis Engine (`services/analyzer.ts`)
- **Purpose**: Compare projections vs player stats
- **Input**: Projection, player stats
- **Output**: Over/Under recommendation + confidence
- **Factors**:
  - Recent average vs line
  - Hit rate in last 5 games
  - Performance consistency
  - Trend direction
  - Percent difference

```typescript
export async function analyzeProjection(projectionId: number) {
  // 1. Get projection data
  // 2. Get player stats
  // 3. Calculate metrics (variance, hit rate, etc.)
  // 4. Determine recommendation
  // 5. Calculate confidence score
  // 6. Save analysis + metadata
}
```

#### 4. Database Service (`services/supabase.ts`)
- **Purpose**: Handle all database operations
- **Pattern**: Singleton Supabase client
- **RLS**: Respects row-level security policies

```typescript
// Use service role key for backend writes
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

// Use anon key for frontend reads
const supabasePublic = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
```

### API Routes

#### Projections API
```
GET  /api/projections/active          - List active projections
GET  /api/projections/:id             - Get single projection
POST /api/projections/fetch           - Sync from PrizePicks
POST /api/projections/analyze         - Analyze specific projection
POST /api/projections/analyze-all     - Batch analyze all
```

#### Analytics API
```
GET  /api/analytics/high-confidence   - Filter by confidence
GET  /api/analytics/by-sport/:sport   - Filter by sport
GET  /api/analytics/model-accuracy    - Model performance metrics
GET  /api/analytics/api-health        - Sync status
```

#### User API
```
GET  /api/user/preferences            - Get user settings
PUT  /api/user/preferences            - Update settings
POST /api/user/selections             - Save user picks
```

---

## Data Flow

### 1. Projection Fetch Flow
```
┌─────────────────┐
│  Scheduled Job  │
│  (4h interval)  │
└────────┬────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │ fetchPrizePicksProjections  │
    │ https://partner-api...      │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │ Log to api_sync_log         │
    │ (success/failure/duration)  │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │ Upsert to projections table │
    │ (on external_id conflict)   │
    └─────────────────────────────┘
```

### 2. Analysis Flow
```
┌──────────────────┐
│ New Projection   │
└────────┬─────────┘
         │
         ▼
    ┌─────────────────────────────┐
    │ getPlayerStats              │
    │ - Check cache               │
    │ - Fetch if needed           │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │ analyzeProjection           │
    │ - Calculate metrics         │
    │ - Determine recommendation  │
    │ - Calculate confidence      │
    └────────┬────────────────────┘
             │
             ▼
    ┌─────────────────────────────┐
    │ Save to analyses table      │
    │ + analysis_metadata         │
    └─────────────────────────────┘
```

### 3. Query Flow
```
Frontend Request
    │
    ▼
┌──────────────────────┐
│ API Endpoint         │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Authorization Check (RLS)    │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Supabase Query               │
│ (respects RLS)               │
└──────┬───────────────────────┘
       │
       ▼
┌──────────────────────────────┐
│ Format Response              │
└──────┬───────────────────────┘
       │
       ▼
Frontend Response
```

---

## Technology Stack

### Database
- **Supabase** (PostgreSQL)
- **Language**: SQL
- **ORM/Client**: Supabase JS client (or any ORM)
- **Port**: 5432 (tunneled through Supabase)

### Backend (Flexible - Choose One)
- **Node.js** + Express / Fastify / NestJS
- **Python** + FastAPI / Django / Flask
- **Go** + Gin / Echo
- **Supabase Edge Functions** (Serverless Deno)
- **Java** + Spring Boot
- **Rust** + Actix / Rocket

### Frontend (Flexible)
- **React** (recommended for our current setup)
- **Vue**
- **Angular**
- **Svelte**
- **Plain HTML/JS**

### External APIs
- **PrizePicks API** - https://partner-api.prizepicks.com
- **StatMuse API** - https://www.statmuse.com/api
- **LLM for Stats** - Claude API (via backend)

---

## Scalability Architecture

### Horizontal Scaling

#### Option 1: Multiple Backend Instances
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Backend #1  │  │ Backend #2  │  │ Backend #3  │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
                   Supabase DB
                 (Handles locks)
```

#### Option 2: Serverless Functions
```
┌──────────────────────────────────┐
│    Supabase Edge Functions       │
│  (Deno - auto-scaled)            │
│  - fetch-projections             │
│  - analyze-projection            │
│  - get-recommendations           │
└──────────┬───────────────────────┘
           │
           ▼
       Supabase DB
```

### Load Distribution
- **API Gateway**: Route to multiple backends
- **Database Connection Pooling**: Supabase handles automatically
- **Caching**: Redis layer (optional, on top)
- **CDN**: Cache analysis results (24h TTL)

---

## Error Handling & Resilience

### API Failures
```typescript
// Log all failures
await logApiSync({
  source: 'prizepicks',
  status: 'failed',
  error_message: error.message,
  request_duration_ms: elapsed
});

// Retry with exponential backoff
const maxRetries = 3;
let attempt = 0;
while (attempt < maxRetries) {
  try {
    return await fetchFromAPI();
  } catch (error) {
    attempt++;
    await sleep(Math.pow(2, attempt) * 1000);
  }
}
```

### Data Integrity
- **Unique constraints**: No duplicate projections
- **Foreign keys**: Prevent orphaned analyses
- **Transactions**: Atomic operations
- **RLS**: Prevent unauthorized access

### Monitoring
```sql
-- Check sync health
SELECT
  source,
  COUNT(*) as syncs,
  SUM(CASE WHEN status = 'success' THEN 1 END) as successful,
  AVG(request_duration_ms) as avg_duration
FROM api_sync_log
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY source;

-- Check analysis accuracy
SELECT
  model_version,
  SUM(CASE WHEN is_correct THEN 1 END)::FLOAT / COUNT(*) as accuracy
FROM model_performance
WHERE evaluated_at > NOW() - INTERVAL '7 days'
GROUP BY model_version;
```

---

## Security Architecture

### Authentication
- **Supabase Auth**: Built-in user management
- **JWT Tokens**: Secure API access
- **RLS Policies**: Database-level access control

### Authorization
- **Public Access**: Read projections/analyses (anonymous)
- **Authenticated**: User preferences (own data only)
- **Service Role**: Backend writes only

### Secrets Management
```env
# Frontend (.env)
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_ANON_KEY=...        # Public, safe to expose

# Backend (.env.local)
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...      # PRIVATE, never expose
PRIZEPICKS_API_URL=...
```

### API Security
- **CORS**: Restrict cross-origin requests
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Sanitize all inputs
- **Output Encoding**: Prevent XSS

---

## Deployment Architecture

### Development
```
Local Backend → Local Supabase (tunneled) → Frontend (localhost:3000)
```

### Staging
```
Staging Backend → Supabase Project → Frontend (staging.example.com)
```

### Production
```
┌─────────────────────────────────────┐
│     CloudFlare / Vercel Edge        │
│  (CDN + Geo-distribution)           │
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
Backend Service    Frontend
(Node/Python/Go)   (React)
    │                 │
    └────────┬────────┘
             │
             ▼
        Supabase DB
      (Production)
```

---

## Monitoring & Observability

### Metrics to Track

1. **API Health**
   - Sync success rate
   - Average fetch duration
   - Error types and frequency

2. **Model Performance**
   - Accuracy per sport
   - Confidence score distribution
   - Win rate by model version

3. **System Health**
   - Database query latency
   - RLS policy violations
   - Cache hit rates

4. **Business Metrics**
   - Total projections analyzed
   - High-confidence pick rate
   - User engagement

### Observability Tools
- **Logging**: Supabase Logs or ELK stack
- **Metrics**: Prometheus + Grafana
- **Tracing**: Jaeger or DataDog
- **Alerts**: PagerDuty or Slack

---

## Migration Path

```
┌──────────────────────────────────────┐
│  Phase 1: MVP (Current)              │
│  - Supabase DB established           │
│  - Core tables created               │
│  - Types documented                  │
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Phase 2: Backend Selection          │
│  - Choose framework                  │
│  - Implement services                │
│  - Set up routes                     │
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Phase 3: Integration                │
│  - Connect PrizePicks API            │
│  - Implement analysis engine         │
│  - Add scheduled jobs                │
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Phase 4: Frontend Update            │
│  - Connect to new backend            │
│  - Add user preferences              │
│  - Optimize performance              │
└──────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│  Phase 5: Production Deployment      │
│  - Set up monitoring                 │
│  - Configure CI/CD                   │
│  - Launch!                           │
└──────────────────────────────────────┘
```

---

## Summary

This architecture is:
- **Framework-agnostic**: No dependency on any single technology
- **Scalable**: Handle growth without redesign
- **Secure**: RLS + authentication at every layer
- **Maintainable**: Clear separation of concerns
- **Portable**: Database and APIs are universal
- **Production-ready**: Built-in monitoring and error handling

**The database is the single source of truth. The backend and frontend are interchangeable.**

See the following for implementation details:
- `DATABASE_GUIDE.md` - Database operations
- `MIGRATION_GUIDE.md` - Step-by-step backend setup
- `server/types.ts` - TypeScript type definitions
