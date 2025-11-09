# PrizePicks Scraping Research

## Key Files from GitHub Project
- parsebets.py - Parses betting data from PrizePicks
- iteratenba.py / iteratenfl.py - Iterates through NBA/NFL data
- createnbascore.py / createnflscore.py - Creates scores
- createjson.py - Creates JSON output

## Approach
The project uses "Reverse Engineering" to scrape PrizePicks website, not the API directly.
This suggests they're using browser automation (Selenium/Playwright) to bypass bot protection.

## Next Steps
1. Check parsebets.py to see how they fetch data
2. Look for Selenium/Playwright usage
3. Implement similar approach in our Node.js backend
