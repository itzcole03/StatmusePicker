# Research Notes: PrizePicks & StatMuse Integration

## PrizePicks API
- URL: https://api.prizepicks.com/projections
- **Issue**: API is protected by PerimeterX CAPTCHA/bot protection
- Direct curl requests are blocked
- Browser access also requires CAPTCHA verification
- **Solution**: Will need to implement proper headers and potentially handle rate limiting in the backend

## StatMuse
- URL: https://www.statmuse.com
- Provides comprehensive sports statistics across multiple leagues (NBA, NFL, NHL, MLB, etc.)
- Has a search interface for querying player stats
- Shows trending performances and recent game stats
- **Approach**: Can search for player stats using their search functionality or potentially find an API endpoint

## Implementation Strategy
1. Create a backend service that:
   - Fetches PrizePicks projections (with proper headers/handling)
   - Queries StatMuse for player historical performance
   - Analyzes recent trends vs projection lines
   - Calculates confidence scores for over/under recommendations

2. Analysis methodology:
   - Compare projection line to player's recent averages (last 5-10 games)
   - Factor in opponent matchup
   - Consider home/away splits
   - Look at consistency (variance in performance)
   - Generate "over" or "under" recommendation with confidence level

3. Frontend will display:
   - Current projections from PrizePicks
   - Player recent stats from StatMuse
   - Recommendation (Over/Under)
   - Confidence score
   - Supporting data/reasoning
