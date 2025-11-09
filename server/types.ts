/**
 * Type definitions for PrizePicks Analytics Database
 *
 * These types are framework-agnostic and can be used with:
 * - Supabase JS client
 * - Custom REST/GraphQL clients
 * - Any ORM (Drizzle, Prisma, Sequelize, TypeORM, etc.)
 */

/**
 * Projection - PrizePicks projection line
 * Represents a player's stat projection from the PrizePicks API
 */
export interface Projection {
  id: number;
  external_id: string;
  player_name: string;
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'CFB';
  league?: string | null;
  team?: string | null;
  opponent?: string | null;
  stat_type: string;
  line_score: string;
  game_time?: string | null;
  status: 'active' | 'completed' | 'cancelled';
  fetched_at: string;
  created_at: string;
}

export interface InsertProjection {
  external_id: string;
  player_name: string;
  sport: string;
  league?: string | null;
  team?: string | null;
  opponent?: string | null;
  stat_type: string;
  line_score: string;
  game_time?: string | null;
  status?: 'active' | 'completed' | 'cancelled';
}

/**
 * Analysis - AI-generated Over/Under recommendation
 * Result of comparing projection lines with player statistics
 */
export interface Analysis {
  id: number;
  projection_id: number;
  recommendation: 'over' | 'under' | 'skip';
  confidence_score: number;
  recent_average?: string | null;
  games_analyzed?: number | null;
  reasoning?: string | null;
  analyzed_at: string;
}

export interface InsertAnalysis {
  projection_id: number;
  recommendation: 'over' | 'under' | 'skip';
  confidence_score: number;
  recent_average?: string | null;
  games_analyzed?: number | null;
  reasoning?: string | null;
}

/**
 * PlayerStats - Cached player statistics
 * Reduces API calls by caching recent performance data
 */
export interface PlayerStats {
  id: number;
  player_name: string;
  sport: string;
  stat_type: string;
  recent_games?: string | null;
  average?: string | null;
  last_fetched: string;
}

export interface InsertPlayerStats {
  player_name: string;
  sport: string;
  stat_type: string;
  recent_games?: string | null;
  average?: string | null;
}

/**
 * ApiSyncLog - Track API calls and syncs
 * Enables debugging, performance monitoring, and error recovery
 */
export interface ApiSyncLog {
  id: number;
  source: 'prizepicks' | 'statmuse';
  endpoint: string;
  sport?: string | null;
  status: 'success' | 'partial' | 'failed';
  records_fetched?: number | null;
  records_processed?: number | null;
  error_message?: string | null;
  request_duration_ms?: number | null;
  started_at: string;
  completed_at?: string | null;
}

export interface InsertApiSyncLog {
  source: 'prizepicks' | 'statmuse';
  endpoint: string;
  sport?: string | null;
  status: 'success' | 'partial' | 'failed';
  records_fetched?: number;
  records_processed?: number;
  error_message?: string | null;
  request_duration_ms?: number | null;
  started_at?: string;
  completed_at?: string | null;
}

/**
 * ModelPerformance - Track prediction accuracy
 * Used to evaluate and improve the analysis model
 */
export interface ModelPerformance {
  id: number;
  analysis_id: number;
  projection_id: number;
  prediction_over_under: 'over' | 'under';
  prediction_confidence: number;
  actual_outcome?: 'over' | 'under' | 'push' | 'cancelled' | 'unknown' | null;
  is_correct?: boolean | null;
  model_version?: string | null;
  evaluated_at: string;
}

export interface InsertModelPerformance {
  analysis_id: number;
  projection_id: number;
  prediction_over_under: 'over' | 'under';
  prediction_confidence: number;
  actual_outcome?: 'over' | 'under' | 'push' | 'cancelled' | 'unknown' | null;
  is_correct?: boolean | null;
  model_version?: string;
}

/**
 * UserPreferences - User settings (framework-agnostic)
 * Stored in database, not in frontend state
 */
export interface UserPreferences {
  id: number;
  user_id: string;
  sports_to_track: string[];
  min_confidence_threshold: number;
  enable_notifications: boolean;
  notification_channels: string[];
  risk_profile: 'conservative' | 'moderate' | 'aggressive';
  created_at: string;
  updated_at: string;
}

export interface InsertUserPreferences {
  user_id: string;
  sports_to_track?: string[];
  min_confidence_threshold?: number;
  enable_notifications?: boolean;
  notification_channels?: string[];
  risk_profile?: 'conservative' | 'moderate' | 'aggressive';
}

/**
 * AnalysisMetadata - Detailed analysis data
 * Stores intermediate calculations for explainability
 */
export interface AnalysisMetadata {
  id: number;
  analysis_id: number;
  recent_average_value?: number | null;
  line_score_value?: number | null;
  percent_difference?: number | null;
  hit_rate_5_games?: number | null;
  games_over_line?: number | null;
  games_under_line?: number | null;
  standard_deviation?: number | null;
  coefficient_of_variation?: number | null;
  trend_indicator?: 'increasing' | 'stable' | 'decreasing' | null;
  consistency_indicator?: 'high' | 'medium' | 'low' | null;
  last_game_performance?: string | null;
  last_3_games_average?: number | null;
  injury_status?: string | null;
  player_notes?: string | null;
  created_at: string;
}

export interface InsertAnalysisMetadata {
  analysis_id: number;
  recent_average_value?: number | null;
  line_score_value?: number | null;
  percent_difference?: number | null;
  hit_rate_5_games?: number | null;
  games_over_line?: number | null;
  games_under_line?: number | null;
  standard_deviation?: number | null;
  coefficient_of_variation?: number | null;
  trend_indicator?: 'increasing' | 'stable' | 'decreasing' | null;
  consistency_indicator?: 'high' | 'medium' | 'low' | null;
  last_game_performance?: string | null;
  last_3_games_average?: number | null;
  injury_status?: string | null;
  player_notes?: string | null;
}

/**
 * View Types - Common database views
 */

export interface ProjectionWithAnalysis extends Projection {
  analysis?: Analysis | null;
  metadata?: AnalysisMetadata | null;
}

export interface HighConfidencePick {
  player_name: string;
  sport: string;
  stat_type: string;
  line_score: string;
  recommendation: 'over' | 'under';
  confidence_score: number;
  reasoning: string;
  game_time?: string | null;
}

export interface ModelAccuracyMetrics {
  model_version: string;
  total_predictions: number;
  correct_predictions: number;
  accuracy_percent: number;
  average_confidence: number;
}

export interface ApiHealthStatus {
  source: 'prizepicks' | 'statmuse';
  last_sync?: string;
  status: 'success' | 'partial' | 'failed';
  records_processed: number;
  average_duration_ms: number;
}

/**
 * Request/Response types for API endpoints
 */

export interface FetchProjectionsRequest {
  sport?: 'NFL' | 'NBA' | 'MLB' | 'NHL' | 'CFB';
}

export interface FetchProjectionsResponse {
  success: boolean;
  count: number;
  timestamp: string;
}

export interface AnalyzeProjectionRequest {
  projectionId: number;
}

export interface AnalyzeProjectionResponse {
  projection: Projection;
  analysis: Analysis;
  metadata?: AnalysisMetadata;
}

export interface GetProjectionsResponse {
  data: ProjectionWithAnalysis[];
  total: number;
  page: number;
}

export interface GetHighConfidencePicksRequest {
  minConfidence?: number;
  sport?: string;
  limit?: number;
}

export interface GetHighConfidencePicksResponse {
  picks: HighConfidencePick[];
  total: number;
}

/**
 * Database operation helpers
 */

export type ProjectionRow = Projection;
export type AnalysisRow = Analysis;
export type ApiSyncLogRow = ApiSyncLog;
export type ModelPerformanceRow = ModelPerformance;
export type UserPreferencesRow = UserPreferences;
export type AnalysisMetadataRow = AnalysisMetadata;

export const TableNames = {
  PROJECTIONS: 'projections',
  ANALYSES: 'analyses',
  PLAYER_STATS: 'player_stats',
  API_SYNC_LOG: 'api_sync_log',
  MODEL_PERFORMANCE: 'model_performance',
  USER_PREFERENCES: 'user_preferences',
  ANALYSIS_METADATA: 'analysis_metadata',
} as const;

export const SportTypes = ['NFL', 'NBA', 'MLB', 'NHL', 'CFB'] as const;
export type SportType = typeof SportTypes[number];

export const RecommendationTypes = ['over', 'under', 'skip'] as const;
export type RecommendationType = typeof RecommendationTypes[number];

export const RiskProfiles = ['conservative', 'moderate', 'aggressive'] as const;
export type RiskProfile = typeof RiskProfiles[number];
