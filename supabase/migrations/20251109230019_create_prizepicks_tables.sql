/*
  # PrizePicks Analytics Database Schema

  ## Overview
  This migration creates the core tables for the PrizePicks analytics platform that compares
  projection lines with real player statistics to generate over/under recommendations.

  ## Tables Created

  ### 1. projections
  Stores PrizePicks projection data fetched from their API.
  - `id`: Auto-incrementing primary key
  - `external_id`: Unique ID from PrizePicks API
  - `player_name`: Name of the player
  - `sport`: Sport type (NFL, NBA, MLB, etc.)
  - `league`: League name
  - `team`: Player's team
  - `opponent`: Opposing team
  - `stat_type`: Type of statistic (Points, Rebounds, etc.)
  - `line_score`: The projection line value
  - `game_time`: Scheduled game time
  - `status`: Projection status (active/completed/cancelled)
  - `fetched_at`: Timestamp when fetched from API

  ### 2. analyses
  Stores AI-generated analysis results comparing projections to player stats.
  - `id`: Auto-incrementing primary key
  - `projection_id`: Foreign key to projections table
  - `recommendation`: Over/Under/Skip recommendation
  - `confidence_score`: 0-100 confidence level
  - `recent_average`: Player's recent average for the stat
  - `games_analyzed`: Number of games analyzed
  - `reasoning`: Detailed explanation of the recommendation
  - `analyzed_at`: Timestamp of analysis

  ### 3. player_stats
  Caches player statistics from StatMuse/LLM to reduce API calls.
  - `id`: Auto-incrementing primary key
  - `player_name`: Name of the player
  - `sport`: Sport type
  - `stat_type`: Type of statistic
  - `recent_games`: JSON array of recent game statistics
  - `average`: Recent average value
  - `last_fetched`: Timestamp of last fetch

  ## Security
  - All tables have RLS enabled
  - Public read access for authenticated and anonymous users
  - Only service role can write (handled by backend)

  ## Indexes
  - Unique index on projections.external_id
  - Index on analyses.projection_id for efficient lookups
  - Index on player_stats lookup fields
*/

-- Create projections table
CREATE TABLE IF NOT EXISTS projections (
  id BIGSERIAL PRIMARY KEY,
  external_id TEXT NOT NULL UNIQUE,
  player_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT,
  team TEXT,
  opponent TEXT,
  stat_type TEXT NOT NULL,
  line_score TEXT NOT NULL,
  game_time TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  fetched_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id BIGSERIAL PRIMARY KEY,
  projection_id BIGINT NOT NULL REFERENCES projections(id) ON DELETE CASCADE,
  recommendation TEXT NOT NULL CHECK (recommendation IN ('over', 'under', 'skip')),
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  recent_average TEXT,
  games_analyzed INTEGER,
  reasoning TEXT,
  analyzed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create player_stats cache table
CREATE TABLE IF NOT EXISTS player_stats (
  id BIGSERIAL PRIMARY KEY,
  player_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  stat_type TEXT NOT NULL,
  recent_games TEXT,
  average TEXT,
  last_fetched TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(player_name, sport, stat_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projections_status ON projections(status);
CREATE INDEX IF NOT EXISTS idx_projections_sport ON projections(sport);
CREATE INDEX IF NOT EXISTS idx_analyses_projection_id ON analyses(projection_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_lookup ON player_stats(player_name, sport, stat_type);

-- Enable Row Level Security
ALTER TABLE projections ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Public read access for projections"
  ON projections
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public read access for analyses"
  ON analyses
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Public read access for player_stats"
  ON player_stats
  FOR SELECT
  TO public
  USING (true);

-- Service role can write (backend only)
CREATE POLICY "Service role can insert projections"
  ON projections
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update projections"
  ON projections
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can insert analyses"
  ON analyses
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can insert player_stats"
  ON player_stats
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update player_stats"
  ON player_stats
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
