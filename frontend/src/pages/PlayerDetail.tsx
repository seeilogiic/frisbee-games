import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { LEAGUE_TYPES, type LeagueType } from '@/lib/constants'
import { 
  calculateFantasyScore,
  getMostRecentTournamentStats,
  calculatePlayerPrices,
  type PlayerStat as UtilsPlayerStat
} from '@/lib/utils'
import './PlayerDetail.css'

interface League {
  id: string
  name: string
  type: LeagueType
  teams: string[]
  code: string
  created_by: string
  created_at: string
}

interface PlayerStat {
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

interface AggregatedPlayerStats {
  player_name: string
  player_team: string
  games_played: number
  total_goals: number
  total_assists: number
  total_ds: number
  total_drops: number
  total_throwaways: number
  total_turnovers: number
  total_score: number
  avg_score_per_game: number
  avg_goals: number
  avg_assists: number
  avg_ds: number
  avg_turnovers: number
}

interface LeagueAverages extends AggregatedPlayerStats {
  avg_total_score: number
  avg_total_goals: number
  avg_total_assists: number
  avg_total_ds: number
  avg_total_turnovers: number
}

interface GameStats {
  opponent: string
  tournament: string
  goals: number
  assists: number
  ds: number
  drops: number
  throwaways: number
  turnovers: number
  score: number
  timestamp?: string
}

interface SalaryCapStats {
  price: number
  captain_score: number
  handler_score: number
  cutter_score: number
  defender_score: number
  most_recent_tournament: string
  games_played_at_tournament: number
}

export default function PlayerDetail() {
  const { leagueId, playerName } = useParams<{ leagueId: string; playerName: string }>()
  const navigate = useNavigate()
  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedPlayerStats | null>(null)
  const [leagueAverages, setLeagueAverages] = useState<LeagueAverages | null>(null)
  const [gameStats, setGameStats] = useState<GameStats[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [activeView, setActiveView] = useState<'summary' | 'games'>('summary')
  const [salaryCapStats, setSalaryCapStats] = useState<SalaryCapStats | null>(null)
  const [allLeaguePlayerStats, setAllLeaguePlayerStats] = useState<PlayerStat[]>([])

  useEffect(() => {
    if (leagueId) {
      loadLeague()
    }
  }, [leagueId])

  useEffect(() => {
    if (league && playerName && league.teams.length > 0) {
      loadPlayerStats()
    }
  }, [league, playerName])

  const loadLeague = async () => {
    if (!leagueId) return

    try {
      setLoading(true)
      setError(null)

      const { data, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('id', leagueId)
        .single()

      if (leagueError) throw leagueError

      if (!data) {
        setError('League not found')
        return
      }

      setLeague(data as League)
    } catch (err: any) {
      console.error('Error loading league:', err)
      setError(err.message || 'Failed to load league')
    } finally {
      setLoading(false)
    }
  }

  const loadPlayerStats = async () => {
    if (!league || !playerName) return

    try {
      setLoadingStats(true)

      const decodedPlayerName = decodeURIComponent(playerName)

      // Fetch all player stats for this specific player in teams from this league
      const { data: playerData, error: playerStatsError } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_name', decodedPlayerName)
        .in('player_team', league.teams)
        .order('timestamp', { ascending: false })

      if (playerStatsError) throw playerStatsError

      // Fetch all player stats for all players in teams from this league (for league averages and price calculation)
      const { data: leagueData, error: leagueStatsError } = await supabase
        .from('player_stats')
        .select('*')
        .in('player_team', league.teams)
        .order('timestamp', { ascending: false })

      if (leagueStatsError) throw leagueStatsError

      if (!playerData || playerData.length === 0) {
        setAggregatedStats(null)
        setGameStats([])
        setLeagueAverages(null)
        setSalaryCapStats(null)
        return
      }

      const playerStats = playerData as PlayerStat[]
      const allLeagueStats = (leagueData || []) as PlayerStat[]
      setAllLeaguePlayerStats(allLeagueStats)

      // Aggregate stats for summary
      const aggregated = aggregatePlayerStats(playerStats)
      setAggregatedStats(aggregated)

      // Group by game for game-by-game table
      const gameStatsList = groupStatsByGame(playerStats)
      setGameStats(gameStatsList)

      // Calculate league averages
      if (allLeagueStats.length > 0) {
        const leagueAvg = calculateLeagueAverages(allLeagueStats)
        setLeagueAverages(leagueAvg)
      }

      // Calculate salary cap stats if it's a salary cap league
      if (league.type === LEAGUE_TYPES.SALARY_CAP) {
        calculateSalaryCapStats(playerStats, allLeagueStats)
      } else {
        setSalaryCapStats(null)
      }
    } catch (err: any) {
      console.error('Error loading player stats:', err)
      setError(err.message || 'Failed to load player stats')
    } finally {
      setLoadingStats(false)
    }
  }

  const aggregatePlayerStats = (stats: PlayerStat[]): AggregatedPlayerStats => {
    const games = new Set<string>()
    let total_goals = 0
    let total_assists = 0
    let total_ds = 0
    let total_drops = 0
    let total_throwaways = 0

    stats.forEach(stat => {
      const gameKey = `${stat.tournament_played}|${stat.game_played}`
      games.add(gameKey)
      total_goals += stat.goals
      total_assists += stat.assists
      total_ds += stat.ds
      total_drops += stat.drops
      total_throwaways += stat.throwaways
    })

    const games_played = games.size
    const total_turnovers = total_drops + total_throwaways
    const total_score = calculateFantasyScore(
      total_goals,
      total_assists,
      total_ds,
      total_drops,
      total_throwaways
    )

    return {
      player_name: stats[0]?.player_name || '',
      player_team: stats[0]?.player_team || '',
      games_played,
      total_goals,
      total_assists,
      total_ds,
      total_drops,
      total_throwaways,
      total_turnovers,
      total_score,
      avg_score_per_game: games_played > 0 ? total_score / games_played : 0,
      avg_goals: games_played > 0 ? total_goals / games_played : 0,
      avg_assists: games_played > 0 ? total_assists / games_played : 0,
      avg_ds: games_played > 0 ? total_ds / games_played : 0,
      avg_turnovers: games_played > 0 ? total_turnovers / games_played : 0,
    }
  }

  const calculateLeagueAverages = (allStats: PlayerStat[]): LeagueAverages => {
    // Aggregate stats per player (same logic as aggregatePlayerStats)
    const playerMap = new Map<string, {
      games: Set<string>
      total_goals: number
      total_assists: number
      total_ds: number
      total_drops: number
      total_throwaways: number
    }>()

    allStats.forEach(stat => {
      const gameKey = `${stat.tournament_played}|${stat.game_played}`
      
      if (!playerMap.has(stat.player_name)) {
        playerMap.set(stat.player_name, {
          games: new Set(),
          total_goals: 0,
          total_assists: 0,
          total_ds: 0,
          total_drops: 0,
          total_throwaways: 0,
        })
      }

      const player = playerMap.get(stat.player_name)!
      player.games.add(gameKey)
      player.total_goals += stat.goals
      player.total_assists += stat.assists
      player.total_ds += stat.ds
      player.total_drops += stat.drops
      player.total_throwaways += stat.throwaways
    })

    // Calculate per-player averages and totals, then average those
    let sumAvgScorePerGame = 0
    let sumAvgGoals = 0
    let sumAvgAssists = 0
    let sumAvgDs = 0
    let sumAvgTurnovers = 0
    let sumGamesPlayed = 0
    let sumTotalScore = 0
    let sumTotalGoals = 0
    let sumTotalAssists = 0
    let sumTotalDs = 0
    let sumTotalTurnovers = 0
    let count = 0

    playerMap.forEach(player => {
      const games_played = player.games.size
      if (games_played === 0) return

      const total_turnovers = player.total_drops + player.total_throwaways
      const total_score = calculateFantasyScore(
        player.total_goals,
        player.total_assists,
        player.total_ds,
        player.total_drops,
        player.total_throwaways
      )

      sumGamesPlayed += games_played
      sumAvgScorePerGame += total_score / games_played
      sumAvgGoals += player.total_goals / games_played
      sumAvgAssists += player.total_assists / games_played
      sumAvgDs += player.total_ds / games_played
      sumAvgTurnovers += total_turnovers / games_played
      sumTotalScore += total_score
      sumTotalGoals += player.total_goals
      sumTotalAssists += player.total_assists
      sumTotalDs += player.total_ds
      sumTotalTurnovers += total_turnovers
      count++
    })

    if (count === 0) {
      return {
        player_name: '',
        player_team: '',
        games_played: 0,
        total_goals: 0,
        total_assists: 0,
        total_ds: 0,
        total_drops: 0,
        total_throwaways: 0,
        total_turnovers: 0,
        total_score: 0,
        avg_score_per_game: 0,
        avg_goals: 0,
        avg_assists: 0,
        avg_ds: 0,
        avg_turnovers: 0,
        avg_total_score: 0,
        avg_total_goals: 0,
        avg_total_assists: 0,
        avg_total_ds: 0,
        avg_total_turnovers: 0,
      }
    }

    return {
      player_name: '',
      player_team: '',
      games_played: sumGamesPlayed / count,
      total_goals: 0,
      total_assists: 0,
      total_ds: 0,
      total_drops: 0,
      total_throwaways: 0,
      total_turnovers: 0,
      total_score: 0,
      avg_score_per_game: sumAvgScorePerGame / count,
      avg_goals: sumAvgGoals / count,
      avg_assists: sumAvgAssists / count,
      avg_ds: sumAvgDs / count,
      avg_turnovers: sumAvgTurnovers / count,
      avg_total_score: sumTotalScore / count,
      avg_total_goals: sumTotalGoals / count,
      avg_total_assists: sumTotalAssists / count,
      avg_total_ds: sumTotalDs / count,
      avg_total_turnovers: sumTotalTurnovers / count,
    }
  }

  const calculateSalaryCapStats = (playerStats: PlayerStat[], allLeagueStats: PlayerStat[]) => {
    // Get most recent tournament stats for this player
    const mostRecentStats = getMostRecentTournamentStats(playerStats as UtilsPlayerStat[])
    
    if (!mostRecentStats) {
      setSalaryCapStats(null)
      return
    }

    // Group all league stats by player to calculate prices
    const playerStatsMap = new Map<string, PlayerStat[]>()
    
    allLeagueStats.forEach(stat => {
      const key = `${stat.player_name}|${stat.player_team}`
      if (!playerStatsMap.has(key)) {
        playerStatsMap.set(key, [])
      }
      playerStatsMap.get(key)!.push(stat)
    })

    // Get most recent tournament stats for all players to calculate prices
    const playerScores: Array<{ player_name: string; player_team: string; captain_score: number }> = []
    
    playerStatsMap.forEach((playerStatList, key) => {
      const [player_name, player_team] = key.split('|')
      const playerMostRecentStats = getMostRecentTournamentStats(playerStatList as UtilsPlayerStat[])
      
      if (playerMostRecentStats) {
        playerScores.push({
          player_name,
          player_team,
          captain_score: playerMostRecentStats.captain_score,
        })
      }
    })

    // Calculate prices using min-max scaling
    const priceMap = calculatePlayerPrices(playerScores)
    
    // Get price for this player
    const playerKey = `${playerStats[0].player_name}|${playerStats[0].player_team}`
    const price = priceMap.get(playerKey) || 0

    setSalaryCapStats({
      price,
      captain_score: mostRecentStats.captain_score,
      handler_score: 0, // Placeholder
      cutter_score: 0, // Placeholder
      defender_score: 0, // Placeholder
      most_recent_tournament: mostRecentStats.tournament_name,
      games_played_at_tournament: mostRecentStats.games_played,
    })
  }

  const groupStatsByGame = (stats: PlayerStat[]): GameStats[] => {
    const gameMap = new Map<string, GameStats>()

    stats.forEach(stat => {
      const gameKey = `${stat.tournament_played}|${stat.game_played}`
      
      if (!gameMap.has(gameKey)) {
        gameMap.set(gameKey, {
          opponent: stat.game_played,
          tournament: stat.tournament_played,
          goals: 0,
          assists: 0,
          ds: 0,
          drops: 0,
          throwaways: 0,
          turnovers: 0,
          score: 0,
          timestamp: stat.timestamp,
        })
      }

      const game = gameMap.get(gameKey)!
      game.goals += stat.goals
      game.assists += stat.assists
      game.ds += stat.ds
      game.drops += stat.drops
      game.throwaways += stat.throwaways
    })

    // Calculate turnovers and score for each game
    const gameStatsList = Array.from(gameMap.values()).map(game => {
      game.turnovers = game.drops + game.throwaways
      game.score = calculateFantasyScore(
        game.goals,
        game.assists,
        game.ds,
        game.drops,
        game.throwaways
      )
      return game
    })

    // Sort by timestamp (most recent first)
    return gameStatsList.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      }
      return 0
    })
  }

  const handleBack = () => {
    if (leagueId) {
      navigate(`/league/${leagueId}`)
    } else {
      navigate('/')
    }
  }

  if (loading) {
    return (
      <div className="player-detail-container">
        <div className="loading-text">Loading player...</div>
      </div>
    )
  }

  if (error || !league) {
    return (
      <div className="player-detail-container">
        <div className="error-message">{error || 'League not found'}</div>
        <button onClick={handleBack} className="back-button">
          Back to League
        </button>
      </div>
    )
  }

  const decodedPlayerName = playerName ? decodeURIComponent(playerName) : ''

  return (
    <div className="player-detail-container">
      <header className="player-detail-header">
        <div className="player-detail-header-content">
          <div className="player-detail-header-left">
            <button onClick={handleBack} className="back-button">
              ← Back
            </button>
            <div className="player-detail-title-section">
              <h1 className="player-detail-title">{decodedPlayerName}</h1>
              {aggregatedStats && (
                <div className="player-detail-meta">
                  <span className="player-team-badge">{aggregatedStats.player_team}</span>
                  <span className="league-name-link" onClick={() => navigate(`/league/${leagueId}`)}>
                    {league.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="player-detail-content">
        {loadingStats ? (
          <div className="loading-text">Loading player stats...</div>
        ) : !aggregatedStats ? (
          <div className="no-data-text">No stats available for this player.</div>
        ) : (
          <>
            {/* View Toggle */}
            <div className="view-toggle-container">
              <button
                className={`view-toggle-button ${activeView === 'summary' ? 'active' : ''}`}
                onClick={() => setActiveView('summary')}
              >
                Season Summary
              </button>
              <button
                className={`view-toggle-button ${activeView === 'games' ? 'active' : ''}`}
                onClick={() => setActiveView('games')}
              >
                Game-by-Game Analysis
              </button>
            </div>

            {/* Summary Stats Section */}
            {activeView === 'summary' && (
              <>
                {/* Salary Cap Stats Section */}
                {league.type === LEAGUE_TYPES.SALARY_CAP && salaryCapStats && (
                  <section className="player-stats-summary salary-cap-stats">
                    <h2 className="section-title">Salary Cap Stats</h2>
                    <div className="summary-table-container">
                      <table className="summary-table">
                        <thead>
                          <tr>
                            <th>Stat</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="row-even">
                            <td className="stat-name">Price</td>
                            <td className="stat-value-cell">${salaryCapStats.price.toFixed(2)}</td>
                          </tr>
                          <tr className="row-odd">
                            <td className="stat-name">Captain Score</td>
                            <td className="stat-value-cell">{salaryCapStats.captain_score.toFixed(1)}</td>
                          </tr>
                          <tr className="row-even">
                            <td className="stat-name">Handler Score</td>
                            <td className="stat-value-cell">{salaryCapStats.handler_score.toFixed(1)}</td>
                          </tr>
                          <tr className="row-odd">
                            <td className="stat-name">Cutter Score</td>
                            <td className="stat-value-cell">{salaryCapStats.cutter_score.toFixed(1)}</td>
                          </tr>
                          <tr className="row-even">
                            <td className="stat-name">Defender Score</td>
                            <td className="stat-value-cell">{salaryCapStats.defender_score.toFixed(1)}</td>
                          </tr>
                          <tr className="row-odd">
                            <td className="stat-name">Most Recent Tournament</td>
                            <td className="stat-value-cell">{salaryCapStats.most_recent_tournament}</td>
                          </tr>
                          <tr className="row-even">
                            <td className="stat-name">Games Played at Tournament</td>
                            <td className="stat-value-cell">{salaryCapStats.games_played_at_tournament}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}
                <section className="player-stats-summary">
                  <h2 className="section-title">Season Summary</h2>
                <div className="summary-table-container">
                  <table className="summary-table">
                    <thead>
                      <tr>
                        <th>Stat</th>
                        <th>Player</th>
                        <th>League Avg</th>
                        <th>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="row-even">
                        <td className="stat-name">Games Played</td>
                        <td className="stat-value-cell">{aggregatedStats.games_played}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.games_played.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.games_played >= leagueAverages.games_played ? 'positive' : 'negative'}`}>
                              {aggregatedStats.games_played >= leagueAverages.games_played ? '+' : ''}
                              {(aggregatedStats.games_played - leagueAverages.games_played).toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="row-odd">
                        <td className="stat-name">Total Score</td>
                        <td className="stat-value-cell">{aggregatedStats.total_score.toFixed(1)}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.avg_total_score.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.total_score >= leagueAverages.avg_total_score ? 'positive' : 'negative'}`}>
                              {aggregatedStats.total_score >= leagueAverages.avg_total_score ? '+' : ''}
                              {(aggregatedStats.total_score - leagueAverages.avg_total_score).toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="row-even">
                        <td className="stat-name">Avg Score/Game</td>
                        <td className="stat-value-cell">{aggregatedStats.avg_score_per_game.toFixed(1)}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.avg_score_per_game.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.avg_score_per_game >= leagueAverages.avg_score_per_game ? 'positive' : 'negative'}`}>
                              {aggregatedStats.avg_score_per_game >= leagueAverages.avg_score_per_game ? '+' : ''}
                              {(aggregatedStats.avg_score_per_game - leagueAverages.avg_score_per_game).toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="row-odd">
                        <td className="stat-name">Total Goals</td>
                        <td className="stat-value-cell">{aggregatedStats.total_goals}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.avg_total_goals.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.total_goals >= leagueAverages.avg_total_goals ? 'positive' : 'negative'}`}>
                              {aggregatedStats.total_goals >= leagueAverages.avg_total_goals ? '+' : ''}
                              {(aggregatedStats.total_goals - leagueAverages.avg_total_goals).toFixed(0)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="row-even">
                        <td className="stat-name">Avg Goals</td>
                        <td className="stat-value-cell">{aggregatedStats.avg_goals.toFixed(1)}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.avg_goals.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.avg_goals >= leagueAverages.avg_goals ? 'positive' : 'negative'}`}>
                              {aggregatedStats.avg_goals >= leagueAverages.avg_goals ? '+' : ''}
                              {(aggregatedStats.avg_goals - leagueAverages.avg_goals).toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="row-odd">
                        <td className="stat-name">Total Assists</td>
                        <td className="stat-value-cell">{aggregatedStats.total_assists}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.avg_total_assists.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.total_assists >= leagueAverages.avg_total_assists ? 'positive' : 'negative'}`}>
                              {aggregatedStats.total_assists >= leagueAverages.avg_total_assists ? '+' : ''}
                              {(aggregatedStats.total_assists - leagueAverages.avg_total_assists).toFixed(0)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="row-even">
                        <td className="stat-name">Avg Assists</td>
                        <td className="stat-value-cell">{aggregatedStats.avg_assists.toFixed(1)}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.avg_assists.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.avg_assists >= leagueAverages.avg_assists ? 'positive' : 'negative'}`}>
                              {aggregatedStats.avg_assists >= leagueAverages.avg_assists ? '+' : ''}
                              {(aggregatedStats.avg_assists - leagueAverages.avg_assists).toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="row-odd">
                        <td className="stat-name">Total Ds</td>
                        <td className="stat-value-cell">{aggregatedStats.total_ds}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.avg_total_ds.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.total_ds >= leagueAverages.avg_total_ds ? 'positive' : 'negative'}`}>
                              {aggregatedStats.total_ds >= leagueAverages.avg_total_ds ? '+' : ''}
                              {(aggregatedStats.total_ds - leagueAverages.avg_total_ds).toFixed(0)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="row-even">
                        <td className="stat-name">Avg Ds</td>
                        <td className="stat-value-cell">{aggregatedStats.avg_ds.toFixed(1)}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.avg_ds.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.avg_ds >= leagueAverages.avg_ds ? 'positive' : 'negative'}`}>
                              {aggregatedStats.avg_ds >= leagueAverages.avg_ds ? '+' : ''}
                              {(aggregatedStats.avg_ds - leagueAverages.avg_ds).toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="row-odd">
                        <td className="stat-name">Total Turnovers</td>
                        <td className="stat-value-cell">{aggregatedStats.total_turnovers}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.avg_total_turnovers.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.total_turnovers <= leagueAverages.avg_total_turnovers ? 'positive' : 'negative'}`}>
                              {aggregatedStats.total_turnovers <= leagueAverages.avg_total_turnovers ? '' : '+'}
                              {(aggregatedStats.total_turnovers - leagueAverages.avg_total_turnovers).toFixed(0)}
                            </span>
                          )}
                        </td>
                      </tr>
                      <tr className="row-even">
                        <td className="stat-name">Avg Turnovers</td>
                        <td className="stat-value-cell">{aggregatedStats.avg_turnovers.toFixed(1)}</td>
                        <td className="stat-league-cell">
                          {leagueAverages ? leagueAverages.avg_turnovers.toFixed(1) : '-'}
                        </td>
                        <td className="stat-diff-cell">
                          {leagueAverages && (
                            <span className={`stat-diff-inline ${aggregatedStats.avg_turnovers <= leagueAverages.avg_turnovers ? 'positive' : 'negative'}`}>
                              {aggregatedStats.avg_turnovers <= leagueAverages.avg_turnovers ? '' : '+'}
                              {(aggregatedStats.avg_turnovers - leagueAverages.avg_turnovers).toFixed(1)}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
                </>
            )}

            {/* Game-by-Game Table */}
            {activeView === 'games' && (
              <section className="player-games-section">
                <h2 className="section-title">Game-by-Game Performance</h2>
                {gameStats.length === 0 ? (
                  <div className="no-data-text">No game data available.</div>
                ) : (
                  <div className="games-table-container">
                    <table className="games-table">
                      <thead>
                        <tr>
                          <th>Tournament</th>
                          <th>Opponent</th>
                          <th>Goals</th>
                          <th>Assists</th>
                          <th>Ds</th>
                          <th>Drops</th>
                          <th>Throwaways</th>
                          <th>Turnovers</th>
                          <th>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gameStats.map((game, index) => (
                          <tr 
                            key={`${game.tournament}-${game.opponent}-${index}`}
                            className={index % 2 === 0 ? 'row-even' : 'row-odd'}
                          >
                            <td>{game.tournament}</td>
                            <td>{game.opponent}</td>
                            <td>{game.goals}</td>
                            <td>{game.assists}</td>
                            <td>{game.ds}</td>
                            <td>{game.drops}</td>
                            <td>{game.throwaways}</td>
                            <td>{game.turnovers}</td>
                            <td className="score-cell">{game.score.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

