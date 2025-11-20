/**
 * Generates a unique league code using uppercase alphanumeric characters
 * @param length - Length of the code (default: 6)
 * @returns A random code string
 */
export function generateLeagueCode(length: number = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Copies text to clipboard
 * @param text - Text to copy
 * @returns Promise that resolves when copy is complete
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
    } catch (fallbackErr) {
      console.error('Failed to copy text:', fallbackErr)
    }
    document.body.removeChild(textArea)
  }
}

/**
 * Gets the base URL for the application, including the base path if deployed to a subdirectory
 * @returns Base URL (e.g., "https://example.com" or "https://example.com/repo-name")
 */
export function getBaseUrl(): string {
  // Use import.meta.env.BASE_URL which Vite provides (includes trailing slash)
  const basePath = import.meta.env.BASE_URL || '/'
  // Remove trailing slash and combine with origin
  const basePathClean = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
  return window.location.origin + basePathClean
}

/**
 * Gets the production site URL for email redirects
 * ALWAYS returns the production URL, never localhost
 * Requires VITE_SITE_URL to be set in environment variables
 * @returns Production site URL (never localhost)
 * @throws Error if VITE_SITE_URL is not set
 */
export function getSiteUrl(): string {
  // VITE_SITE_URL must be set - this ensures emails always use production URL
  const siteUrl = import.meta.env.VITE_SITE_URL
  
  // Debug logging
  console.log('getSiteUrl() called')
  console.log('import.meta.env.VITE_SITE_URL:', import.meta.env.VITE_SITE_URL)
  console.log('All VITE_ env vars:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_')))
  
  if (!siteUrl) {
    const errorMessage = 
      'VITE_SITE_URL environment variable is required for email redirects.\n' +
      'Please set VITE_SITE_URL in your .env.frontend file to your production GitHub Pages URL.\n' +
      'Example: VITE_SITE_URL=https://yourusername.github.io/frisbee-games'
    console.error(errorMessage)
    throw new Error(errorMessage)
  }
  
  console.log('Returning siteUrl:', siteUrl)
  return siteUrl
}

/**
 * Calculates fantasy score for a player based on their stats
 * Formula: 3 * assists + 3 * goals + 9 * ds - 3 * turnovers
 * Where turnovers = drops + throwaways
 * @param goals - Number of goals
 * @param assists - Number of assists
 * @param ds - Number of defensive stops
 * @param drops - Number of drops
 * @param throwaways - Number of throwaways
 * @returns Fantasy score
 */
export function calculateFantasyScore(
  goals: number,
  assists: number,
  ds: number,
  drops: number,
  throwaways: number
): number {
  const turnovers = drops + throwaways
  return 3 * assists + 3 * goals + 9 * ds - 3 * turnovers
}

/**
 * Calculates handler score for a player based on their stats
 * Formula: 3 * assists + 1 * goals + 3 * ds - 1 * turnovers
 * Where turnovers = drops + throwaways
 * @param goals - Number of goals
 * @param assists - Number of assists
 * @param ds - Number of defensive stops
 * @param drops - Number of drops
 * @param throwaways - Number of throwaways
 * @returns Handler score
 */
export function calculateHandlerScore(
  goals: number,
  assists: number,
  ds: number,
  drops: number,
  throwaways: number
): number {
  const turnovers = drops + throwaways
  return 3 * assists + 1 * goals + 3 * ds - 1 * turnovers
}

/**
 * Calculates cutter score for a player based on their stats
 * Formula: 1 * assists + 3 * goals + 3 * ds - 1 * turnovers
 * Where turnovers = drops + throwaways
 * @param goals - Number of goals
 * @param assists - Number of assists
 * @param ds - Number of defensive stops
 * @param drops - Number of drops
 * @param throwaways - Number of throwaways
 * @returns Cutter score
 */
export function calculateCutterScore(
  goals: number,
  assists: number,
  ds: number,
  drops: number,
  throwaways: number
): number {
  const turnovers = drops + throwaways
  return 1 * assists + 3 * goals + 3 * ds - 1 * turnovers
}

/**
 * Calculates defender score for a player based on their stats
 * Formula: 1 * assists + 1 * goals + 9 * ds - 1 * turnovers
 * Where turnovers = drops + throwaways
 * @param goals - Number of goals
 * @param assists - Number of assists
 * @param ds - Number of defensive stops
 * @param drops - Number of drops
 * @param throwaways - Number of throwaways
 * @returns Defender score
 */
export function calculateDefenderScore(
  goals: number,
  assists: number,
  ds: number,
  drops: number,
  throwaways: number
): number {
  const turnovers = drops + throwaways
  return 1 * assists + 1 * goals + 9 * ds - 1 * turnovers
}

/**
 * Player stat interface for tournament calculations
 */
export interface PlayerStat {
  player_name: string
  player_team: string
  game_played: string
  tournament_played: string
  goals: number
  assists: number
  ds: number
  drops: number
  throwaways: number
  timestamp?: string
}

/**
 * Most recent tournament stats for a player
 */
export interface MostRecentTournamentStats {
  tournament_name: string
  games_played: number
  goals: number
  assists: number
  ds: number
  drops: number
  throwaways: number
  captain_score: number
}

/**
 * Gets the most recent tournament stats for a player
 * @param playerStats - Array of player stats, should be ordered by timestamp DESC
 * @returns Most recent tournament stats or null if no stats
 */
export function getMostRecentTournamentStats(
  playerStats: PlayerStat[]
): MostRecentTournamentStats | null {
  if (!playerStats || playerStats.length === 0) {
    return null
  }

  // Find the most recent tournament by timestamp
  const tournamentMap = new Map<string, {
    timestamp: string
    games: Set<string>
    goals: number
    assists: number
    ds: number
    drops: number
    throwaways: number
  }>()

  playerStats.forEach(stat => {
    const tournament = stat.tournament_played
    const gameKey = `${tournament}|${stat.game_played}`
    const timestamp = stat.timestamp || ''

    if (!tournamentMap.has(tournament)) {
      tournamentMap.set(tournament, {
        timestamp,
        games: new Set(),
        goals: 0,
        assists: 0,
        ds: 0,
        drops: 0,
        throwaways: 0,
      })
    }

    const tournamentData = tournamentMap.get(tournament)!
    tournamentData.games.add(gameKey)
    tournamentData.goals += stat.goals
    tournamentData.assists += stat.assists
    tournamentData.ds += stat.ds
    tournamentData.drops += stat.drops
    tournamentData.throwaways += stat.throwaways
    
    // Update timestamp if this one is more recent
    if (timestamp && (!tournamentData.timestamp || timestamp > tournamentData.timestamp)) {
      tournamentData.timestamp = timestamp
    }
  })

  // Find tournament with most recent timestamp
  let mostRecentTournament: string | null = null
  let mostRecentTimestamp: string = ''

  tournamentMap.forEach((data, tournament) => {
    if (data.timestamp && (!mostRecentTimestamp || data.timestamp > mostRecentTimestamp)) {
      mostRecentTimestamp = data.timestamp
      mostRecentTournament = tournament
    }
  })

  // Fallback: if no timestamps, use first tournament alphabetically
  if (!mostRecentTournament) {
    const tournaments = Array.from(tournamentMap.keys()).sort()
    mostRecentTournament = tournaments[0] || null
  }

  if (!mostRecentTournament) {
    return null
  }

  const tournamentData = tournamentMap.get(mostRecentTournament)!
  const captain_score = calculateFantasyScore(
    tournamentData.goals,
    tournamentData.assists,
    tournamentData.ds,
    tournamentData.drops,
    tournamentData.throwaways
  )

  return {
    tournament_name: mostRecentTournament,
    games_played: tournamentData.games.size,
    goals: tournamentData.goals,
    assists: tournamentData.assists,
    ds: tournamentData.ds,
    drops: tournamentData.drops,
    throwaways: tournamentData.throwaways,
    captain_score,
  }
}

/**
 * Scales a value from min-max range to $1-$20 range
 * Formula: price = 1 + (score - minScore) / (maxScore - minScore) * 19
 * @param score - The score to scale
 * @param minScore - Minimum score in the range
 * @param maxScore - Maximum score in the range
 * @returns Scaled price between $1 and $20 as a whole number
 */
export function scalePrice(score: number, minScore: number, maxScore: number): number {
  if (maxScore === minScore) {
    return 11 // Middle value if all scores are the same (rounded)
  }
  const price = 1 + ((score - minScore) / (maxScore - minScore)) * 19
  return Math.round(price) // Round to whole number
}

/**
 * Calculates player prices for all players using min-max scaling
 * @param playerScores - Array of objects with player info and captain_score
 * @returns Map of player keys (name|team) to prices
 */
export function calculatePlayerPrices(
  playerScores: Array<{ player_name: string; player_team: string; captain_score: number }>
): Map<string, number> {
  if (playerScores.length === 0) {
    return new Map()
  }

  const scores = playerScores.map(p => p.captain_score)
  const minScore = Math.min(...scores)
  const maxScore = Math.max(...scores)

  const priceMap = new Map<string, number>()
  playerScores.forEach(player => {
    const key = `${player.player_name}|${player.player_team}`
    const price = scalePrice(player.captain_score, minScore, maxScore)
    priceMap.set(key, price)
  })

  return priceMap
}

/**
 * Salary cap league constants
 */
export const SALARY_CAP_BUDGET = 70
export const SALARY_CAP_ROSTER = {
  captain: 1,
  handler: 2,
  cutter: 2,
  defender: 2,
} as const

export type RosterPosition = 'captain' | 'handler' | 'cutter' | 'defender'

/**
 * Calculates total roster cost
 * @param roster - Array of roster players with prices
 * @returns Total cost
 */
export function calculateRosterCost(
  roster: Array<{ price: number }>
): number {
  return roster.reduce((sum, player) => sum + player.price, 0)
}

/**
 * Calculates remaining budget
 * @param roster - Array of roster players with prices
 * @returns Remaining budget
 */
export function calculateRemainingBudget(
  roster: Array<{ price: number }>
): number {
  const totalCost = calculateRosterCost(roster)
  return SALARY_CAP_BUDGET - totalCost
}

/**
 * Validates roster structure and budget
 * Note: Roster does not need to be full - can be empty or partially filled
 * @param roster - Array of roster players with position and price
 * @returns Object with isValid flag and error message if invalid
 */
export function validateRoster(
  roster: Array<{ position: RosterPosition; price: number }>
): { isValid: boolean; error?: string } {
  const positionCounts = {
    captain: 0,
    handler: 0,
    cutter: 0,
    defender: 0,
  }

  roster.forEach(player => {
    positionCounts[player.position]++
  })

  // Check position limits (max allowed, not required)
  if (positionCounts.captain > SALARY_CAP_ROSTER.captain) {
    return { isValid: false, error: `Cannot have more than ${SALARY_CAP_ROSTER.captain} captain` }
  }
  if (positionCounts.handler > SALARY_CAP_ROSTER.handler) {
    return { isValid: false, error: `Cannot have more than ${SALARY_CAP_ROSTER.handler} handlers` }
  }
  if (positionCounts.cutter > SALARY_CAP_ROSTER.cutter) {
    return { isValid: false, error: `Cannot have more than ${SALARY_CAP_ROSTER.cutter} cutters` }
  }
  if (positionCounts.defender > SALARY_CAP_ROSTER.defender) {
    return { isValid: false, error: `Cannot have more than ${SALARY_CAP_ROSTER.defender} defenders` }
  }

  // Check budget
  const totalCost = calculateRosterCost(roster)
  if (totalCost > SALARY_CAP_BUDGET) {
    return { isValid: false, error: `Total cost ($${totalCost.toFixed(2)}) exceeds budget ($${SALARY_CAP_BUDGET})` }
  }

  return { isValid: true }
}

