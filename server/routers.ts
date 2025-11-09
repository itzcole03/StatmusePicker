import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { fetchPrizePicksProjections, parsePrizePicksData, LEAGUE_IDS } from "./prizepicks";
import { getPlayerStats } from "./statmuse";
import { analyzeProjection } from "./analyzer";
import { saveProjections, getActiveProjections, saveAnalysis, getAnalysesByProjectionId } from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  projections: router({
    // Fetch and save latest projections from PrizePicks
    fetch: publicProcedure
      .input(z.object({
        sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'CFB']).optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const leagueId = input.sport ? LEAGUE_IDS[input.sport] : undefined;
          const response = await fetchPrizePicksProjections(leagueId);
          const parsedData = parsePrizePicksData(response);

          // Save to database
          await saveProjections(
            parsedData.map((p) => ({
              externalId: p.id,
              playerName: p.playerName,
              sport: p.sport,
              league: p.league,
              team: p.team,
              opponent: '',
              statType: p.statType,
              lineScore: p.lineScore,
              gameTime: p.gameTime ? new Date(p.gameTime) : null,
              status: p.status as 'active' | 'completed' | 'cancelled',
            }))
          );

          return {
            success: true,
            count: parsedData.length,
          };
        } catch (error) {
          console.error('Error fetching projections:', error);
          throw new Error('Failed to fetch projections');
        }
      }),

    // Get all active projections
    list: publicProcedure.query(async () => {
      const projectionsData = await getActiveProjections();
      return projectionsData;
    }),

    // Analyze a specific projection
    analyze: publicProcedure
      .input(z.object({
        projectionId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { getProjectionById } = await import('./db');
        const projection = await getProjectionById(input.projectionId);
        if (!projection) {
          throw new Error('Projection not found');
        }

        // Get player stats
        const playerStats = await getPlayerStats(
          projection.playerName,
          projection.sport,
          projection.statType
        );

        // Analyze
        const analysis = analyzeProjection(parseFloat(projection.lineScore), playerStats);

        // Save analysis
        await saveAnalysis({
          projectionId: projection.id,
          recommendation: analysis.recommendation,
          confidenceScore: analysis.confidenceScore,
          recentAverage: analysis.recentAverage,
          gamesAnalyzed: analysis.gamesAnalyzed,
          reasoning: analysis.reasoning,
        });

        return {
          ...projection,
          analysis,
        };
      }),

    // Get projections with their analyses
    withAnalyses: publicProcedure.query(async () => {
      const projectionsData = await getActiveProjections();
      
      const projectionsWithAnalyses = await Promise.all(
        projectionsData.map(async (projection) => {
          const analyses = await getAnalysesByProjectionId(projection.id);
          const latestAnalysis = analyses.length > 0 ? analyses[analyses.length - 1] : null;
          
          return {
            ...projection,
            analysis: latestAnalysis,
          };
        })
      );

      return projectionsWithAnalyses;
    }),

    // Analyze all active projections
    analyzeAll: publicProcedure.mutation(async () => {
      const projectionsData = await getActiveProjections();
      
      let analyzed = 0;
      for (const projection of projectionsData) {
        try {
          // Get player stats
          const playerStats = await getPlayerStats(
            projection.playerName,
            projection.sport,
            projection.statType
          );

          // Analyze
          const analysis = analyzeProjection(parseFloat(projection.lineScore), playerStats);

          // Save analysis
          await saveAnalysis({
            projectionId: projection.id,
            recommendation: analysis.recommendation,
            confidenceScore: analysis.confidenceScore,
            recentAverage: analysis.recentAverage,
            gamesAnalyzed: analysis.gamesAnalyzed,
            reasoning: analysis.reasoning,
          });

          analyzed++;
        } catch (error) {
          console.error(`Error analyzing projection ${projection.id}:`, error);
        }
      }

      return {
        success: true,
        analyzed,
        total: projectionsData.length,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
