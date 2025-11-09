# PrizePicks API Solution

## Working Endpoints Discovered

From the mada949/PrizePicks-API repository, I found the working endpoints:

### 1. Leagues Endpoint
```
https://partner-api.prizepicks.com/leagues
```
Returns all available leagues with their IDs.

### 2. Projections Endpoint
```
https://partner-api.prizepicks.com/projections?per_page=1000
```
Optional parameters:
- `league_id`: Filter by specific league (e.g., 7 for NFL, 9 for NBA)
- `per_page`: Number of results (max 1000)

## Key Differences from Previous Attempt

1. **Correct Domain**: Use `partner-api.prizepicks.com` NOT `api.prizepicks.com`
2. **No Authentication Required**: These endpoints are public
3. **Proper Headers**: Standard browser headers work fine

## Implementation Plan

1. Update `server/prizepicks.ts` to use the correct endpoint
2. Add proper error handling
3. Test with real data
4. Remove mock data fallback once confirmed working
