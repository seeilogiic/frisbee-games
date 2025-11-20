import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { LEAGUE_TYPES, type LeagueType } from '@/lib/constants'
import { calculateFantasyScore } from '@/lib/utils'
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

export default function PlayerDetail() {
  const { leagueId, playerName } = useParams<{ leagueId: string; playerName: string }>()
  const navigate = useNavigate()
  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedPlayerStats | null>(null)
  const [gameStats, setGameStats] = useState<GameStats[]>([])
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    if (leagueId) {
      loadLeague()
    }
  }, [leagueId])

  useEffect(() => {
    if (league && playerName && league.type === LEAGUE_TYPES.DRAFT && league.teams.length > 0) {
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
      const { data, error: statsError } = await supabase
        .from('player_stats')
        .select('*')
        .eq('player_name', decodedPlayerName)
        .in('player_team', league.teams)
        .order('timestamp', { ascending: false })

      if (statsError) throw statsError

      if (!data || data.length === 0) {
        setAggregatedStats(null)
        setGameStats([])
        return
      }

      const stats = data as PlayerStat[]

      // Aggregate stats for summary
      const aggregated = aggregatePlayerStats(stats)
      setAggregatedStats(aggregated)

      // Group by game for game-by-game table
      const gameStatsList = groupStatsByGame(stats)
      setGameStats(gameStatsList)
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
            {/* Summary Stats Section */}
            <section className="player-stats-summary">
              <h2 className="section-title">Season Summary</h2>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Games Played</div>
                  <div className="stat-value">{aggregatedStats.games_played}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Score</div>
                  <div className="stat-value">{aggregatedStats.total_score.toFixed(1)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Avg Score/Game</div>
                  <div className="stat-value">{aggregatedStats.avg_score_per_game.toFixed(1)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Goals</div>
                  <div className="stat-value">{aggregatedStats.total_goals}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Assists</div>
                  <div className="stat-value">{aggregatedStats.total_assists}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Ds</div>
                  <div className="stat-value">{aggregatedStats.total_ds}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Avg Goals</div>
                  <div className="stat-value">{aggregatedStats.avg_goals.toFixed(1)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Avg Assists</div>
                  <div className="stat-value">{aggregatedStats.avg_assists.toFixed(1)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Avg Ds</div>
                  <div className="stat-value">{aggregatedStats.avg_ds.toFixed(1)}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total Turnovers</div>
                  <div className="stat-value">{aggregatedStats.total_turnovers}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Avg Turnovers</div>
                  <div className="stat-value">{aggregatedStats.avg_turnovers.toFixed(1)}</div>
                </div>
              </div>
            </section>

            {/* Game-by-Game Table */}
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
          </>
        )}
      </main>
    </div>
  )
}

