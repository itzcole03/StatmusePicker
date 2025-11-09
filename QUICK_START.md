# Quick Start Guide

## For Developers (Framework-Agnostic Setup)

### Prerequisites
- Node.js 16+ or Python 3.9+ or Go 1.19+ (choose your backend)
- Supabase account (already configured)
- Git

---

## Quick Setup (Choose Your Backend)

### Node.js + Express (Recommended)

```bash
# 1. Create backend directory
mkdir backend
cd backend

# 2. Initialize project
npm init -y
npm install express @supabase/supabase-js dotenv cors
npm install -D typescript @types/node ts-node

# 3. Create structure
mkdir src/{routes,services}

# 4. Copy types from project
cp ../server/types.ts src/

# 5. Create .env
echo "SUPABASE_URL=https://uvnkvobboxtplhigmfnc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key" > .env

# 6. Create main server
cat > src/server.ts << 'EOF'
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

app.get('/api/projections/active', async (req, res) => {
  const { data, error } = await supabase
    .from('projections')
    .select('*')
    .eq('status', 'active');

  if (error) return res.status(500).json(error);
  res.json(data);
});

app.listen(8000, () => console.log('Server on http://localhost:8000'));
EOF

# 7. Start server
npx ts-node src/server.ts
```

### Python + FastAPI

```bash
# 1. Create backend directory
mkdir backend
cd backend

# 2. Create virtual env
python -m venv venv
source venv/bin/activate  # on Windows: venv\Scripts\activate

# 3. Install dependencies
pip install fastapi uvicorn supabase python-dotenv

# 4. Create .env
echo "SUPABASE_URL=https://uvnkvobboxtplhigmfnc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key" > .env

# 5. Create main.py
cat > main.py << 'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
import os

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

@app.get("/api/projections/active")
async def get_active_projections():
    response = supabase.table("projections").select("*").eq("status", "active").execute()
    return response.data

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
EOF

# 6. Start server
python main.py
```

---

## Database Credentials

Get your keys from Supabase Dashboard:

1. Go to: https://app.supabase.com/
2. Select your project
3. Settings → API
4. Copy these:
   - **Anon Key** (in `.env` as `VITE_SUPABASE_ANON_KEY`)
   - **Service Role Key** (backend only!)

```env
# .env (Frontend - Safe to commit)
VITE_SUPABASE_URL=https://uvnkvobboxtplhigmfnc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# .env.local (Backend - NEVER commit!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Common API Patterns

### Read Active Projections

**JavaScript:**
```typescript
const { data } = await supabase
  .from('projections')
  .select('*')
  .eq('status', 'active')
  .limit(10);
```

**SQL:**
```sql
SELECT * FROM projections WHERE status = 'active' LIMIT 10;
```

**cURL:**
```bash
curl -X GET 'https://uvnkvobboxtplhigmfnc.supabase.co/rest/v1/projections?status=eq.active&limit=10' \
  -H 'apikey: YOUR_ANON_KEY'
```

### Save Analysis

**JavaScript:**
```typescript
const { data } = await supabase
  .from('analyses')
  .insert({
    projection_id: 123,
    recommendation: 'over',
    confidence_score: 75,
    reasoning: 'Player averaging above line',
  });
```

**Python:**
```python
response = supabase.table('analyses').insert({
    'projection_id': 123,
    'recommendation': 'over',
    'confidence_score': 75,
    'reasoning': 'Player averaging above line'
}).execute()
```

### Get User Preferences

**JavaScript:**
```typescript
const { data } = await supabase
  .from('user_preferences')
  .select('*')
  .eq('user_id', userId)
  .single();
```

---

## Database Schema at a Glance

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| projections | PrizePicks lines | player_name, sport, line_score, status |
| analyses | Over/Under picks | projection_id, recommendation, confidence_score |
| player_stats | Cached performance | player_name, sport, average, recent_games |
| analysis_metadata | Detailed metrics | analysis_id, percent_difference, trend_indicator |
| model_performance | Accuracy tracking | analysis_id, is_correct, model_version |
| api_sync_log | API health | source, status, request_duration_ms |
| user_preferences | User settings | user_id, sports_to_track, risk_profile |

---

## Useful Queries

### High Confidence Picks
```sql
SELECT p.player_name, p.stat_type, p.line_score, a.recommendation, a.confidence_score
FROM projections p
JOIN analyses a ON p.id = a.projection_id
WHERE a.confidence_score >= 70
ORDER BY a.confidence_score DESC;
```

### Model Accuracy
```sql
SELECT
  model_version,
  COUNT(*) as total,
  SUM(CASE WHEN is_correct THEN 1 END)::FLOAT / COUNT(*) * 100 as accuracy
FROM model_performance
GROUP BY model_version;
```

### API Health Last 24h
```sql
SELECT
  source,
  COUNT(*) as total_syncs,
  SUM(CASE WHEN status = 'success' THEN 1 END) as successful,
  AVG(request_duration_ms) as avg_duration_ms
FROM api_sync_log
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY source;
```

### Find Trending Players
```sql
SELECT p.player_name, COUNT(*) as projections, AVG(a.confidence_score) as avg_confidence
FROM projections p
JOIN analyses a ON p.id = a.projection_id
WHERE p.created_at > NOW() - INTERVAL '7 days'
GROUP BY p.player_name
ORDER BY avg_confidence DESC
LIMIT 20;
```

---

## Testing Connection

### Node.js
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const { data, error } = await supabase.from('projections').select('count');
console.log(error ? 'ERROR: ' + error.message : 'Connected! Total: ' + data);
```

### Python
```python
from supabase import create_client
import os

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
response = supabase.table("projections").select("count").execute()
print(f"Connected! Total: {response.data}")
```

### cURL
```bash
curl -X GET 'https://uvnkvobboxtplhigmfnc.supabase.co/rest/v1/projections' \
  -H 'apikey: YOUR_ANON_KEY' \
  -H 'Accept: application/vnd.pgrst.object+json' \
  | head -20
```

---

## Scheduled Jobs

### Node.js (node-cron)
```typescript
import cron from 'node-cron';

// Every 4 hours
cron.schedule('0 */4 * * *', async () => {
  console.log('Syncing PrizePicks...');
  // Sync logic here
});
```

### Python (APScheduler)
```python
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()
scheduler.add_job(sync_prizepicks, 'interval', hours=4)
scheduler.start()
```

### Linux (crontab)
```bash
crontab -e
# Add: 0 */4 * * * /usr/bin/node /path/to/sync.js
```

---

## Deployment

### Vercel (Node.js)
```bash
npm install -g vercel
vercel
# Follow prompts
```

### Railway
```bash
npm install -g railway
railway link
railway up
```

### Heroku
```bash
npm install -g heroku
heroku login
heroku create
git push heroku main
```

### Docker
```dockerfile
FROM node:18
WORKDIR /app
COPY . .
RUN npm install
EXPOSE 8000
CMD ["npm", "start"]
```

---

## Troubleshooting

### "Error: No rows returned" on single()
**Solution**: Use `maybeSingle()` instead
```typescript
const { data } = await supabase
  .from('table')
  .select()
  .eq('id', 123)
  .maybeSingle();  // Returns null instead of error
```

### "RLS policy denied" error
**Solution**: Use correct key for the operation
```typescript
// Frontend read (use anon key) ✓
const anon = createClient(url, anonKey);

// Backend write (use service role key) ✓
const admin = createClient(url, serviceRoleKey);
```

### Slow queries
**Solution**: Check indexes
```sql
EXPLAIN ANALYZE
SELECT * FROM projections WHERE sport = 'NFL' LIMIT 10;
```

### CORS errors
**Solution**: Add CORS middleware
```typescript
import cors from 'cors';
app.use(cors({
  origin: ['http://localhost:3000', 'https://example.com']
}));
```

---

## Environment Variables Checklist

```env
# Frontend (.env) - Safe to commit
VITE_SUPABASE_URL=https://uvnkvobboxtplhigmfnc.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=http://localhost:8000

# Backend (.env.local) - NEVER commit
SUPABASE_URL=https://uvnkvobboxtplhigmfnc.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_ENV=development

# Optional APIs
PRIZEPICKS_API_URL=https://partner-api.prizepicks.com
STATMUSE_API_URL=https://www.statmuse.com/api
```

---

## Next Steps

1. **Choose your backend** (Node.js / Python / Go / Serverless)
2. **Get Supabase keys** from dashboard
3. **Create `.env` file** with your credentials
4. **Test connection** with provided code snippets
5. **Read `DATABASE_GUIDE.md`** for detailed operations
6. **Read `MIGRATION_GUIDE.md`** for full setup
7. **Deploy** to production

---

## Resources

- **Database**: See `DATABASE_GUIDE.md`
- **Architecture**: See `ARCHITECTURE.md`
- **Migration**: See `MIGRATION_GUIDE.md`
- **Types**: See `server/types.ts`
- **Supabase Docs**: https://supabase.com/docs
- **Supabase JS Client**: https://supabase.com/docs/reference/javascript/

---

## Support

For issues:
1. Check Supabase logs: https://app.supabase.com/project/[PROJECT]/logs
2. Check database: https://app.supabase.com/project/[PROJECT]/sql
3. Test query: `SELECT * FROM projections LIMIT 1;`
4. Verify RLS: `SELECT tablename FROM pg_tables WHERE schemaname='public';`

Good luck! 🚀
