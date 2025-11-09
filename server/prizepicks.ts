/**
 * PrizePicks API Integration
 * Fetches projections from the PrizePicks API
 */

interface PrizePicksProjection {
  id: string;
  type: string;
  attributes: {
    line_score: number;
    stat_type: string;
    description?: string;
    board_time?: string;
    odds_type?: string;
    status?: string;
  };
  relationships?: {
    new_player?: {
      data?: {
        id: string;
        type: string;
      };
    };
    league?: {
      data?: {
        id: string;
        type: string;
      };
    };
  };
}

interface PrizePicksPlayer {
  id: string;
  type: string;
  attributes: {
    name: string;
    team?: string;
    team_name?: string;
    position?: string;
  };
}

interface PrizePicksLeague {
  id: string;
  type: string;
  attributes: {
    name: string;
    sport?: string;
  };
}

interface PrizePicksResponse {
  data: PrizePicksProjection[];
  included?: Array<PrizePicksPlayer | PrizePicksLeague>;
}

/**
 * Fetch projections from PrizePicks API
 * The API endpoint is: https://partner-api.prizepicks.com/projections
 * Query params: per_page (default 1000), league_id (optional)
 */
export async function fetchPrizePicksProjections(leagueId?: string): Promise<PrizePicksResponse> {
  const baseUrl = 'https://partner-api.prizepicks.com/projections';
  const params = new URLSearchParams({
    per_page: '1000',
  });
  
  if (leagueId) {
    params.append('league_id', leagueId);
  }

  const url = `${baseUrl}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`PrizePicks API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as PrizePicksResponse;
  } catch (error) {
    console.error('Error fetching PrizePicks projections:', error);
    throw error;
  }
}

/**
 * Parse PrizePicks response and extract projection data with player/league info
 */
export function parsePrizePicksData(response: PrizePicksResponse) {
  const { data, included = [] } = response;

  // Create lookup maps for players and leagues
  const playersMap = new Map<string, PrizePicksPlayer>();
  const leaguesMap = new Map<string, PrizePicksLeague>();

  included.forEach((item) => {
    if (item.type === 'new_player') {
      playersMap.set(item.id, item as PrizePicksPlayer);
    } else if (item.type === 'league') {
      leaguesMap.set(item.id, item as PrizePicksLeague);
    }
  });

  // Map projections with player and league data
  return data.map((projection) => {
    const playerId = projection.relationships?.new_player?.data?.id;
    const leagueId = projection.relationships?.league?.data?.id;

    const player = playerId ? playersMap.get(playerId) : undefined;
    const league = leagueId ? leaguesMap.get(leagueId) : undefined;

    return {
      id: projection.id,
      playerName: player?.attributes.name || 'Unknown',
      team: player?.attributes.team_name || player?.attributes.team || '',
      sport: league?.attributes.sport || league?.attributes.name || '',
      league: league?.attributes.name || '',
      statType: projection.attributes.stat_type,
      lineScore: projection.attributes.line_score.toString(),
      gameTime: projection.attributes.board_time || null,
      status: projection.attributes.status || 'active',
    };
  });
}

/**
 * League IDs for different sports (from PrizePicks API)
 * These can be used to filter projections by sport
 */
export const LEAGUE_IDS = {
  NFL: '9',
  NBA: '7',
  MLB: '2',
  NHL: '8',
  CFB: '11',
  // Add more as needed
};
