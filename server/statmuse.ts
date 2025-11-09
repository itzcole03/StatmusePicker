/**
 * StatMuse Integration
 * Uses LLM to query and analyze player statistics
 */

import { invokeLLM } from "./_core/llm";

export interface PlayerStatsSummary {
  playerName: string;
  sport: string;
  statType: string;
  recentAverage: number | null;
  last5Games: number[];
  last10Games: number[];
  consistency: 'high' | 'medium' | 'low';
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Query StatMuse-style statistics using LLM
 * The LLM will provide recent game statistics for a player
 */
export async function getPlayerStats(
  playerName: string,
  sport: string,
  statType: string
): Promise<PlayerStatsSummary> {
  const prompt = `You are a sports statistics expert. Provide recent performance data for ${playerName} in ${sport} for the stat: ${statType}.

Please provide:
1. Last 5 games statistics for ${statType}
2. Last 10 games statistics for ${statType}
3. Recent average (last 5-10 games)
4. Performance consistency (high/medium/low based on variance)
5. Trend (increasing/stable/decreasing)

Format your response as JSON with this structure:
{
  "playerName": "${playerName}",
  "sport": "${sport}",
  "statType": "${statType}",
  "recentAverage": <number or null>,
  "last5Games": [<array of numbers>],
  "last10Games": [<array of numbers>],
  "consistency": "high" | "medium" | "low",
  "trend": "increasing" | "stable" | "decreasing"
}

If you don't have exact data, provide realistic estimates based on the player's typical performance level. If the player is unknown or the stat doesn't apply, return null for recentAverage and empty arrays.`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "You are a sports statistics expert with knowledge of player performance across all major sports. Provide accurate, realistic statistics.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "player_stats",
          strict: true,
          schema: {
            type: "object",
            properties: {
              playerName: { type: "string" },
              sport: { type: "string" },
              statType: { type: "string" },
              recentAverage: { type: ["number", "null"] },
              last5Games: {
                type: "array",
                items: { type: "number" },
              },
              last10Games: {
                type: "array",
                items: { type: "number" },
              },
              consistency: {
                type: "string",
                enum: ["high", "medium", "low"],
              },
              trend: {
                type: "string",
                enum: ["increasing", "stable", "decreasing"],
              },
            },
            required: ["playerName", "sport", "statType", "recentAverage", "last5Games", "last10Games", "consistency", "trend"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0].message.content;
    if (!content || typeof content !== 'string') {
      throw new Error("No content in LLM response");
    }

    const stats = JSON.parse(content) as PlayerStatsSummary;
    return stats;
  } catch (error) {
    console.error("Error fetching player stats:", error);
    // Return empty stats on error
    return {
      playerName,
      sport,
      statType,
      recentAverage: null,
      last5Games: [],
      last10Games: [],
      consistency: 'low',
      trend: 'stable',
    };
  }
}

/**
 * Analyze multiple projections in batch
 */
export async function batchGetPlayerStats(
  projections: Array<{ playerName: string; sport: string; statType: string }>
): Promise<PlayerStatsSummary[]> {
  // Process in parallel with a limit to avoid rate limiting
  const BATCH_SIZE = 5;
  const results: PlayerStatsSummary[] = [];

  for (let i = 0; i < projections.length; i += BATCH_SIZE) {
    const batch = projections.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((proj) => getPlayerStats(proj.playerName, proj.sport, proj.statType))
    );
    results.push(...batchResults);
  }

  return results;
}
