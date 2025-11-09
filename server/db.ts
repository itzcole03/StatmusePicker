import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;

let _supabase: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

export interface InsertProjection {
  externalId: string;
  playerName: string;
  sport: string;
  league?: string | null;
  team?: string | null;
  opponent?: string | null;
  statType: string;
  lineScore: string;
  gameTime?: Date | null;
  status?: 'active' | 'completed' | 'cancelled';
}

export interface Projection extends InsertProjection {
  id: number;
  fetchedAt: string;
  createdAt: string;
}

export interface InsertAnalysis {
  projectionId: number;
  recommendation: 'over' | 'under' | 'skip';
  confidenceScore: number;
  recentAverage?: string | null;
  gamesAnalyzed?: number | null;
  reasoning?: string | null;
}

export interface Analysis extends InsertAnalysis {
  id: number;
  analyzedAt: string;
}

export interface InsertPlayerStat {
  playerName: string;
  sport: string;
  statType: string;
  recentGames?: string | null;
  average?: string | null;
}

export interface PlayerStat extends InsertPlayerStat {
  id: number;
  lastFetched: string;
}

export async function saveProjections(projectionsData: InsertProjection[]) {
  const supabase = getSupabase();

  for (const projection of projectionsData) {
    const { error } = await supabase
      .from('projections')
      .upsert({
        external_id: projection.externalId,
        player_name: projection.playerName,
        sport: projection.sport,
        league: projection.league,
        team: projection.team,
        opponent: projection.opponent,
        stat_type: projection.statType,
        line_score: projection.lineScore,
        game_time: projection.gameTime,
        status: projection.status || 'active',
        fetched_at: new Date().toISOString(),
      }, {
        onConflict: 'external_id',
      });

    if (error) {
      console.error('Error saving projection:', error);
      throw error;
    }
  }
}

export async function getActiveProjections(): Promise<Projection[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('projections')
    .select('*')
    .eq('status', 'active');

  if (error) {
    console.error('Error fetching projections:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    externalId: row.external_id,
    playerName: row.player_name,
    sport: row.sport,
    league: row.league,
    team: row.team,
    opponent: row.opponent,
    statType: row.stat_type,
    lineScore: row.line_score,
    gameTime: row.game_time ? new Date(row.game_time) : null,
    status: row.status,
    fetchedAt: row.fetched_at,
    createdAt: row.created_at,
  }));
}

export async function getProjectionById(id: number): Promise<Projection | undefined> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('projections')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching projection:', error);
    return undefined;
  }

  if (!data) return undefined;

  return {
    id: data.id,
    externalId: data.external_id,
    playerName: data.player_name,
    sport: data.sport,
    league: data.league,
    team: data.team,
    opponent: data.opponent,
    statType: data.stat_type,
    lineScore: data.line_score,
    gameTime: data.game_time ? new Date(data.game_time) : null,
    status: data.status,
    fetchedAt: data.fetched_at,
    createdAt: data.created_at,
  };
}

export async function saveAnalysis(analysisData: InsertAnalysis) {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('analyses')
    .insert({
      projection_id: analysisData.projectionId,
      recommendation: analysisData.recommendation,
      confidence_score: analysisData.confidenceScore,
      recent_average: analysisData.recentAverage,
      games_analyzed: analysisData.gamesAnalyzed,
      reasoning: analysisData.reasoning,
    });

  if (error) {
    console.error('Error saving analysis:', error);
    throw error;
  }
}

export async function getAnalysesByProjectionId(projectionId: number): Promise<Analysis[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('projection_id', projectionId)
    .order('analyzed_at', { ascending: true });

  if (error) {
    console.error('Error fetching analyses:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    projectionId: row.projection_id,
    recommendation: row.recommendation,
    confidenceScore: row.confidence_score,
    recentAverage: row.recent_average,
    gamesAnalyzed: row.games_analyzed,
    reasoning: row.reasoning,
    analyzedAt: row.analyzed_at,
  }));
}

export async function savePlayerStats(statsData: InsertPlayerStat) {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('player_stats')
    .upsert({
      player_name: statsData.playerName,
      sport: statsData.sport,
      stat_type: statsData.statType,
      recent_games: statsData.recentGames,
      average: statsData.average,
      last_fetched: new Date().toISOString(),
    }, {
      onConflict: 'player_name,sport,stat_type',
    });

  if (error) {
    console.error('Error saving player stats:', error);
    throw error;
  }
}

export async function getPlayerStatsByName(
  playerName: string,
  sport: string,
  statType: string
): Promise<PlayerStat | undefined> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_name', playerName)
    .eq('sport', sport)
    .eq('stat_type', statType)
    .maybeSingle();

  if (error) {
    console.error('Error fetching player stats:', error);
    return undefined;
  }

  if (!data) return undefined;

  return {
    id: data.id,
    playerName: data.player_name,
    sport: data.sport,
    statType: data.stat_type,
    recentGames: data.recent_games,
    average: data.average,
    lastFetched: data.last_fetched,
  };
}
