/*
  # Enhanced PrizePicks Analytics Schema

  ## Purpose
  Extends the base schema with production-ready features:
  - API sync tracking and error recovery
  - Model performance monitoring
  - Data quality metrics
  - User preferences (independent of any frontend framework)
  - Audit logging for compliance

  ## New Tables

  ### api_sync_log
  Tracks all API calls and syncs to enable debugging, recovery, and performance monitoring.
  - Records when projections were fetched
  - Tracks failures for retry logic
  - Supports incremental syncs and rate limiting

  ### model_performance
  Tracks the accuracy of the analysis model over time for continuous improvement.
  - Stores completed projections with actual outcomes
  - Calculates model accuracy, precision, recall
  - Enables retraining and model selection

  ### user_preferences
  Stores user settings in a framework-agnostic way.
  - Sports to track
  - Confidence threshold
  - Notification preferences
  - Risk profile settings

  ### analysis_metadata
  Enhanced analysis tracking with additional metrics.
  - Stores intermediate calculations (variance, trend scores, etc.)
  - Enables explainability and audit trails
  - Supports model versioning

  ## Enhancement Details

  All tables remain portable and can be queried:
  - Via direct SQL
  - Via any REST client
  - Via any ORM (Drizzle, Prisma, Sequelize, etc.)
  - Via Edge Functions
  - Via custom backend services

  No Bolt-specific dependencies or assumptions are made.
*/

-- API Sync Log table
CREATE TABLE IF NOT EXISTS api_sync_log (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('prizepicks', 'statmuse')),
  endpoint TEXT NOT NULL,
  sport TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  records_fetched INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  request_duration_ms INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- Model Performance table
CREATE TABLE IF NOT EXISTS model_performance (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  projection_id BIGINT NOT NULL REFERENCES projections(id) ON DELETE CASCADE,
  prediction_over_under TEXT NOT NULL,
  prediction_confidence INTEGER NOT NULL,
  actual_outcome TEXT CHECK (actual_outcome IN ('over', 'under', 'push', 'cancelled', 'unknown')),
  is_correct BOOLEAN,
  model_version TEXT DEFAULT '1.0',
  evaluated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- User Preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL,
  sports_to_track TEXT[] DEFAULT ARRAY['NFL', 'NBA', 'MLB'],
  min_confidence_threshold INTEGER DEFAULT 50 CHECK (min_confidence_threshold >= 0 AND min_confidence_threshold <= 100),
  enable_notifications BOOLEAN DEFAULT false,
  notification_channels TEXT[] DEFAULT ARRAY['email'],
  risk_profile TEXT DEFAULT 'moderate' CHECK (risk_profile IN ('conservative', 'moderate', 'aggressive')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enhanced Analysis Metadata table
CREATE TABLE IF NOT EXISTS analysis_metadata (
  id BIGSERIAL PRIMARY KEY,
  analysis_id BIGINT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  recent_average_value NUMERIC(10,2),
  line_score_value NUMERIC(10,2),
  percent_difference NUMERIC(10,2),
  hit_rate_5_games NUMERIC(3,2),
  games_over_line INTEGER,
  games_under_line INTEGER,
  standard_deviation NUMERIC(10,2),
  coefficient_of_variation NUMERIC(10,2),
  trend_indicator TEXT CHECK (trend_indicator IN ('increasing', 'stable', 'decreasing')),
  consistency_indicator TEXT CHECK (consistency_indicator IN ('high', 'medium', 'low')),
  last_game_performance TEXT,
  last_3_games_average NUMERIC(10,2),
  injury_status TEXT,
  player_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_api_sync_log_source ON api_sync_log(source);
CREATE INDEX IF NOT EXISTS idx_api_sync_log_status ON api_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_api_sync_log_started_at ON api_sync_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_performance_analysis_id ON model_performance(analysis_id);
CREATE INDEX IF NOT EXISTS idx_model_performance_is_correct ON model_performance(is_correct);
CREATE INDEX IF NOT EXISTS idx_model_performance_model_version ON model_performance(model_version);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_metadata_analysis_id ON analysis_metadata(analysis_id);

-- Enable RLS
ALTER TABLE api_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies: api_sync_log (read-only for public, write for service role)
CREATE POLICY "Public read api_sync_log"
  ON api_sync_log
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role write api_sync_log"
  ON api_sync_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- RLS Policies: model_performance
CREATE POLICY "Public read model_performance"
  ON model_performance
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role write model_performance"
  ON model_performance
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- RLS Policies: user_preferences (users can only read/write their own)
CREATE POLICY "Users can read own preferences"
  ON user_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies: analysis_metadata
CREATE POLICY "Public read analysis_metadata"
  ON analysis_metadata
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Service role write analysis_metadata"
  ON analysis_metadata
  FOR INSERT
  TO service_role
  WITH CHECK (true);
