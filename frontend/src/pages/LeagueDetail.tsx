import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { LEAGUE_TYPES, type LeagueType } from '../lib/constants.js'
import { calculateFantasyScore, copyToClipboard } from '../lib/utils.js'
import './LeagueDetail.css'

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

type TabType = 'roster' | 'players'
type SortColumn = 'player_name' | 'games_played' | 'total_score' | 'avg_score_per_game' | 'avg_goals' | 'avg_assists' | 'avg_ds' | 'avg_turnovers'
type SortDirection = 'asc' | 'desc'

export default function LeagueDetail() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('players')
  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playerStats, setPlayerStats] = useState<AggregatedPlayerStats[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>('total_score')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  useEffect(() => {
    if (leagueId) {
      loadLeague()
    }
  }, [leagueId])

  useEffect(() => {
    if (league && league.type === LEAGUE_TYPES.DRAFT && league.teams.length > 0) {
      const loadPlayerStats = async () => {
        try {
          setLoadingStats(true)

          // Fetch all player stats for teams in this league
          const { data, error: statsError } = await supabase
            .from('player_stats')
            .select('*')
            .in('player_team', league.teams)

          if (statsError) throw statsError

          if (!data || data.length === 0) {
            setPlayerStats([])
            return
          }

          // Aggregate stats per player
          const aggregatedStats = aggregatePlayerStats(data as PlayerStat[])
          setPlayerStats(aggregatedStats)
        } catch (err: any) {
          console.error('Error loading player stats:', err)
          setError(err.message || 'Failed to load player stats')
        } finally {
          setLoadingStats(false)
        }
      }

      loadPlayerStats()
    }
  }, [league])

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

  const aggregatePlayerStats = (stats: PlayerStat[]): AggregatedPlayerStats[] => {
    const playerMap = new Map<string, {
      player_name: string
      player_team: string
      games: Set<string>
      total_goals: number
      total_assists: number
      total_ds: number
      total_drops: number
      total_throwaways: number
    }>()

    // Aggregate stats per player
    stats.forEach(stat => {
      const gameKey = `${stat.tournament_played}|${stat.game_played}`
      
      if (!playerMap.has(stat.player_name)) {
        playerMap.set(stat.player_name, {
          player_name: stat.player_name,
          player_team: stat.player_team,
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

    // Convert to array and calculate derived stats
    const aggregated: AggregatedPlayerStats[] = Array.from(playerMap.values()).map(player => {
      const games_played = player.games.size
      const total_turnovers = player.total_drops + player.total_throwaways
      const total_score = calculateFantasyScore(
        player.total_goals,
        player.total_assists,
        player.total_ds,
        player.total_drops,
        player.total_throwaways
      )

      return {
        player_name: player.player_name,
        player_team: player.player_team,
        games_played,
        total_goals: player.total_goals,
        total_assists: player.total_assists,
        total_ds: player.total_ds,
        total_drops: player.total_drops,
        total_throwaways: player.total_throwaways,
        total_turnovers,
        total_score,
        avg_score_per_game: games_played > 0 ? total_score / games_played : 0,
        avg_goals: games_played > 0 ? player.total_goals / games_played : 0,
        avg_assists: games_played > 0 ? player.total_assists / games_played : 0,
        avg_ds: games_played > 0 ? player.total_ds / games_played : 0,
        avg_turnovers: games_played > 0 ? total_turnovers / games_played : 0,
      }
    })

    return aggregated
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const getSortedStats = (): AggregatedPlayerStats[] => {
    const sorted = [...playerStats]
    sorted.sort((a, b) => {
      let aValue: number | string
      let bValue: number | string

      switch (sortColumn) {
        case 'player_name':
          aValue = a.player_name.toLowerCase()
          bValue = b.player_name.toLowerCase()
          break
        case 'games_played':
          aValue = a.games_played
          bValue = b.games_played
          break
        case 'total_score':
          aValue = a.total_score
          bValue = b.total_score
          break
        case 'avg_score_per_game':
          aValue = a.avg_score_per_game
          bValue = b.avg_score_per_game
          break
        case 'avg_goals':
          aValue = a.avg_goals
          bValue = b.avg_goals
          break
        case 'avg_assists':
          aValue = a.avg_assists
          bValue = b.avg_assists
          break
        case 'avg_ds':
          aValue = a.avg_ds
          bValue = b.avg_ds
          break
        case 'avg_turnovers':
          aValue = a.avg_turnovers
          bValue = b.avg_turnovers
          break
        default:
          return 0
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      } else {
        return sortDirection === 'asc'
          ? (aValue as number) - (bValue as number)
          : (bValue as number) - (aValue as number)
      }
    })

    return sorted
  }

  const handleBack = () => {
    navigate('/')
  }

  const handleShare = async () => {
    if (!league) return
    
    const shareLink = `${window.location.origin}/#/join?code=${league.code}`
    await copyToClipboard(shareLink)
    alert('Share link copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="league-detail-container">
        <div className="loading-text">Loading league...</div>
      </div>
    )
  }

  if (error || !league) {
    return (
      <div className="league-detail-container">
        <div className="error-message">{error || 'League not found'}</div>
        <button onClick={handleBack} className="back-button">
          Back to Home
        </button>
      </div>
    )
  }

  return (
    <div className="league-detail-container">
      <header className="league-detail-header">
        <div className="league-detail-header-content">
          <div className="league-detail-header-left">
            <button onClick={handleBack} className="back-button">
              ← Back
            </button>
            <div className="league-detail-title-section">
              <h1 className="league-detail-title">{league.name}</h1>
              <div className="league-detail-meta">
                <span className="league-type-badge">
                  {league.type === LEAGUE_TYPES.SALARY_CAP ? 'Salary Cap' : 'Draft'}
                </span>
                <span className="league-code">Code: {league.code}</span>
              </div>
            </div>
          </div>
          <button onClick={handleShare} className="share-button">
            Share
          </button>
        </div>
      </header>

      <main className="league-detail-content">
        {/* Tabs */}
        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'roster' ? 'active' : ''}`}
            onClick={() => setActiveTab('roster')}
          >
            ROSTER
          </button>
          <button
            className={`tab-button ${activeTab === 'players' ? 'active' : ''}`}
            onClick={() => setActiveTab('players')}
          >
            PLAYERS
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'roster' && (
            <div className="roster-tab-content">
              <p className="placeholder-text">Roster functionality coming soon.</p>
            </div>
          )}

          {activeTab === 'players' && (
            <div className="players-tab-content">
              {league.type !== LEAGUE_TYPES.DRAFT ? (
                <div className="info-message">
                  Player stats are only available for draft leagues.
                </div>
              ) : loadingStats ? (
                <div className="loading-text">Loading player stats...</div>
              ) : playerStats.length === 0 ? (
                <div className="no-data-text">No player stats available.</div>
              ) : (
                <div className="players-table-container">
                  <table className="players-table">
                    <thead>
                      <tr>
                        <th 
                          className="sortable-header"
                          onClick={() => handleSort('player_name')}
                          title="Name"
                        >
                          Name
                          {sortColumn === 'player_name' && (
                            <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable-header"
                          onClick={() => handleSort('games_played')}
                          title="Games Played"
                        >
                          GP
                          {sortColumn === 'games_played' && (
                            <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable-header"
                          onClick={() => handleSort('total_score')}
                          title="Score"
                        >
                          Score
                          {sortColumn === 'total_score' && (
                            <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable-header"
                          onClick={() => handleSort('avg_score_per_game')}
                          title="Average Score Per Game"
                        >
                          AVG
                          {sortColumn === 'avg_score_per_game' && (
                            <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable-header"
                          onClick={() => handleSort('avg_goals')}
                          title="Average Goals"
                        >
                          G
                          {sortColumn === 'avg_goals' && (
                            <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable-header"
                          onClick={() => handleSort('avg_assists')}
                          title="Average Assists"
                        >
                          A
                          {sortColumn === 'avg_assists' && (
                            <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable-header"
                          onClick={() => handleSort('avg_ds')}
                          title="Average Defensive Stops"
                        >
                          D
                          {sortColumn === 'avg_ds' && (
                            <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th 
                          className="sortable-header"
                          onClick={() => handleSort('avg_turnovers')}
                          title="Average Turnovers"
                        >
                          Turns
                          {sortColumn === 'avg_turnovers' && (
                            <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {getSortedStats().map((player, index) => (
                        <tr 
                          key={`${player.player_name}-${player.player_team}-${index}`}
                          className={index % 2 === 0 ? 'row-even' : 'row-odd'}
                        >
                          <td className="player-name-cell">
                            <div className="player-name">{player.player_name}</div>
                            <div className="player-team">{player.player_team}</div>
                          </td>
                          <td>{player.games_played}</td>
                          <td className="score-cell">{player.total_score.toFixed(1)}</td>
                          <td>{player.avg_score_per_game.toFixed(1)}</td>
                          <td>{player.avg_goals.toFixed(1)}</td>
                          <td>{player.avg_assists.toFixed(1)}</td>
                          <td>{player.avg_ds.toFixed(1)}</td>
                          <td>{player.avg_turnovers.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

