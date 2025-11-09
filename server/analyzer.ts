/**
 * Analysis Engine
 * Compares PrizePicks projections with player statistics to generate recommendations
 */

import { PlayerStatsSummary } from './statmuse';

export interface AnalysisResult {
  recommendation: 'over' | 'under' | 'skip';
  confidenceScore: number; // 0-100
  reasoning: string;
  recentAverage: string | null;
  gamesAnalyzed: number;
}

/**
 * Calculate variance/consistency of recent games
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  
  return Math.sqrt(variance); // Standard deviation
}

/**
 * Analyze a projection against player statistics
 */
export function analyzeProjection(
  lineScore: number,
  playerStats: PlayerStatsSummary
): AnalysisResult {
  const { recentAverage, last5Games, last10Games, consistency, trend } = playerStats;

  // If no data available, skip
  if (recentAverage === null || last5Games.length === 0) {
    return {
      recommendation: 'skip',
      confidenceScore: 0,
      reasoning: 'Insufficient data available for analysis',
      recentAverage: null,
      gamesAnalyzed: 0,
    };
  }

  // Calculate how far the line is from recent average
  const difference = recentAverage - lineScore;
  const percentDifference = (difference / lineScore) * 100;

  // Count games over/under the line
  const gamesOver = last5Games.filter((val: number) => val > lineScore).length;
  const gamesUnder = last5Games.filter((val: number) => val < lineScore).length;
  const hitRate = Math.max(gamesOver, gamesUnder) / last5Games.length;

  // Calculate standard deviation
  const stdDev = calculateVariance(last5Games);
  const coefficientOfVariation = stdDev / recentAverage;

  // Determine recommendation
  let recommendation: 'over' | 'under' | 'skip' = 'skip';
  let baseConfidence = 0;
  let reasoning = '';

  // Strong signals
  if (Math.abs(percentDifference) > 15) {
    // Line is significantly different from average
    recommendation = difference > 0 ? 'over' : 'under';
    baseConfidence = 70;
    reasoning = `Player's recent average (${recentAverage.toFixed(1)}) is ${Math.abs(percentDifference).toFixed(1)}% ${difference > 0 ? 'above' : 'below'} the line (${lineScore}). `;
  } else if (Math.abs(percentDifference) > 8) {
    // Moderate difference
    recommendation = difference > 0 ? 'over' : 'under';
    baseConfidence = 55;
    reasoning = `Player's recent average (${recentAverage.toFixed(1)}) is moderately ${difference > 0 ? 'above' : 'below'} the line (${lineScore}). `;
  } else if (hitRate >= 0.8) {
    // Strong hit rate in one direction
    recommendation = gamesOver > gamesUnder ? 'over' : 'under';
    baseConfidence = 60;
    reasoning = `Player has hit ${recommendation} in ${Math.max(gamesOver, gamesUnder)} of last ${last5Games.length} games. `;
  } else {
    // Weak signal
    recommendation = 'skip';
    baseConfidence = 30;
    reasoning = `Line (${lineScore}) is close to recent average (${recentAverage.toFixed(1)}), making this a coin flip. `;
  }

  // Adjust confidence based on consistency
  let confidenceAdjustment = 0;
  if (consistency === 'high') {
    confidenceAdjustment = 10;
    reasoning += 'Player shows high consistency. ';
  } else if (consistency === 'low') {
    confidenceAdjustment = -15;
    reasoning += 'Player shows high variance in performance. ';
  }

  // Adjust confidence based on trend
  if (trend === 'increasing' && recommendation === 'over') {
    confidenceAdjustment += 10;
    reasoning += 'Player is trending upward. ';
  } else if (trend === 'decreasing' && recommendation === 'under') {
    confidenceAdjustment += 10;
    reasoning += 'Player is trending downward. ';
  } else if (trend === 'increasing' && recommendation === 'under') {
    confidenceAdjustment -= 10;
    reasoning += 'Caution: Player is trending upward. ';
  } else if (trend === 'decreasing' && recommendation === 'over') {
    confidenceAdjustment -= 10;
    reasoning += 'Caution: Player is trending downward. ';
  }

  // Final confidence score (clamped to 0-100)
  const confidenceScore = Math.max(0, Math.min(100, baseConfidence + confidenceAdjustment));

  // If confidence is too low, recommend skip
  if (confidenceScore < 45 && recommendation !== 'skip') {
    recommendation = 'skip';
    reasoning += 'Low confidence - recommend skipping this pick.';
  }

  return {
    recommendation,
    confidenceScore: Math.round(confidenceScore),
    reasoning: reasoning.trim(),
    recentAverage: recentAverage.toFixed(1),
    gamesAnalyzed: last5Games.length,
  };
}

/**
 * Batch analyze multiple projections
 */
export function batchAnalyze(
  projections: Array<{ lineScore: number; playerStats: PlayerStatsSummary }>
): AnalysisResult[] {
  return projections.map(({ lineScore, playerStats }) =>
    analyzeProjection(lineScore, playerStats)
  );
}
