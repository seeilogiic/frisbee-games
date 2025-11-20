import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { LEAGUE_TYPES, type LeagueType } from '@/lib/constants'
import { 
  calculateFantasyScore,
  calculateHandlerScore,
  calculateCutterScore,
  calculateDefenderScore,
  copyToClipboard, 
  getBaseUrl,
  getMostRecentTournamentStats,
  calculatePlayerPrices,
  calculateRemainingBudget,
  validateRoster,
  SALARY_CAP_BUDGET,
  SALARY_CAP_ROSTER,
  type PlayerStat as UtilsPlayerStat,
  type RosterPosition
} from '@/lib/utils'
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

interface SalaryCapPlayerStats {
  player_name: string
  player_team: string
  price: number
  captain_score: number
  handler_score: number // Placeholder for now
  cutter_score: number // Placeholder for now
  defender_score: number // Placeholder for now
  most_recent_tournament: string
  games_played_at_tournament: number
}

interface RosterPlayer {
  id: string
  player_name: string
  player_team: string
  position: RosterPosition
  price: number
}

type TabType = 'roster' | 'players'
type SortColumn = 'player_name' | 'games_played' | 'total_score' | 'avg_score_per_game' | 'avg_goals' | 'avg_assists' | 'avg_ds' | 'avg_turnovers' | 'price' | 'captain_score' | 'handler_score' | 'cutter_score' | 'defender_score' | 'most_recent_tournament' | 'games_played_at_tournament'
type SortDirection = 'asc' | 'desc'

export default function LeagueDetail() {
  const { leagueId } = useParams<{ leagueId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('players')
  const [league, setLeague] = useState<League | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playerStats, setPlayerStats] = useState<AggregatedPlayerStats[]>([])
  const [salaryCapStats, setSalaryCapStats] = useState<SalaryCapPlayerStats[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [sortColumn, setSortColumn] = useState<SortColumn>('total_score')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [rosterError, setRosterError] = useState<string | null>(null)
  const [showPositionModal, setShowPositionModal] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<SalaryCapPlayerStats | null>(null)

  // Update default sort column based on league type
  useEffect(() => {
    if (league) {
      if (league.type === LEAGUE_TYPES.SALARY_CAP) {
        setSortColumn('captain_score')
      } else {
        setSortColumn('total_score')
      }
    }
  }, [league])

  useEffect(() => {
    if (leagueId) {
      loadLeague()
    }
  }, [leagueId])

  useEffect(() => {
    if (league && league.teams.length > 0) {
      const loadPlayerStats = async () => {
        try {
          setLoadingStats(true)

          // Fetch all player stats for teams in this league, ordered by timestamp
          const { data, error: statsError } = await supabase
            .from('player_stats')
            .select('*')
            .in('player_team', league.teams)
            .order('timestamp', { ascending: false })

          if (statsError) throw statsError

          if (!data || data.length === 0) {
            setPlayerStats([])
            setSalaryCapStats([])
            return
          }

          const stats = data as PlayerStat[]

          if (league.type === LEAGUE_TYPES.DRAFT) {
            // Aggregate stats per player for draft leagues
            const aggregatedStats = aggregatePlayerStats(stats)
            setPlayerStats(aggregatedStats)
            setSalaryCapStats([])
          } else if (league.type === LEAGUE_TYPES.SALARY_CAP) {
            // Aggregate stats for salary cap leagues
            const salaryCapAggregated = aggregateSalaryCapPlayerStats(stats)
            setSalaryCapStats(salaryCapAggregated)
            setPlayerStats([])
          }
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

  useEffect(() => {
    if (league && league.type === LEAGUE_TYPES.SALARY_CAP && leagueId && salaryCapStats.length > 0) {
      loadRoster()
    }
  }, [league, leagueId, salaryCapStats.length])

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

  const aggregateSalaryCapPlayerStats = (stats: PlayerStat[]): SalaryCapPlayerStats[] => {
    // Group stats by player
    const playerStatsMap = new Map<string, PlayerStat[]>()
    
    stats.forEach(stat => {
      const key = `${stat.player_name}|${stat.player_team}`
      if (!playerStatsMap.has(key)) {
        playerStatsMap.set(key, [])
      }
      playerStatsMap.get(key)!.push(stat)
    })

    // Get most recent tournament stats for each player
    const playerScores: Array<{ player_name: string; player_team: string; captain_score: number }> = []
    const salaryCapStatsList: SalaryCapPlayerStats[] = []

    playerStatsMap.forEach((playerStatList, key) => {
      const [player_name, player_team] = key.split('|')
      const mostRecentStats = getMostRecentTournamentStats(playerStatList as UtilsPlayerStat[])
      
      if (mostRecentStats) {
        const handler_score = calculateHandlerScore(
          mostRecentStats.goals,
          mostRecentStats.assists,
          mostRecentStats.ds,
          mostRecentStats.drops,
          mostRecentStats.throwaways
        )
        const cutter_score = calculateCutterScore(
          mostRecentStats.goals,
          mostRecentStats.assists,
          mostRecentStats.ds,
          mostRecentStats.drops,
          mostRecentStats.throwaways
        )
        const defender_score = calculateDefenderScore(
          mostRecentStats.goals,
          mostRecentStats.assists,
          mostRecentStats.ds,
          mostRecentStats.drops,
          mostRecentStats.throwaways
        )

        playerScores.push({
          player_name,
          player_team,
          captain_score: mostRecentStats.captain_score,
        })

        salaryCapStatsList.push({
          player_name,
          player_team,
          price: 0, // Will be calculated after we have all scores
          captain_score: mostRecentStats.captain_score,
          handler_score,
          cutter_score,
          defender_score,
          most_recent_tournament: mostRecentStats.tournament_name,
          games_played_at_tournament: mostRecentStats.games_played,
        })
      }
    })

    // Calculate prices using min-max scaling
    const priceMap = calculatePlayerPrices(playerScores)

    // Update prices in the stats list
    return salaryCapStatsList.map(player => {
      const key = `${player.player_name}|${player.player_team}`
      const price = priceMap.get(key) || 0
      return { ...player, price }
    })
  }

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('desc')
    }
  }

  const getSortedStats = (): AggregatedPlayerStats[] | SalaryCapPlayerStats[] => {
    if (league?.type === LEAGUE_TYPES.SALARY_CAP) {
      const sorted = [...salaryCapStats]
      sorted.sort((a, b) => {
        let aValue: number | string
        let bValue: number | string

        switch (sortColumn) {
          case 'player_name':
            aValue = a.player_name.toLowerCase()
            bValue = b.player_name.toLowerCase()
            break
          case 'price':
            aValue = a.price
            bValue = b.price
            break
          case 'captain_score':
            aValue = a.captain_score
            bValue = b.captain_score
            break
          case 'handler_score':
            aValue = a.handler_score
            bValue = b.handler_score
            break
          case 'cutter_score':
            aValue = a.cutter_score
            bValue = b.cutter_score
            break
          case 'defender_score':
            aValue = a.defender_score
            bValue = b.defender_score
            break
          case 'most_recent_tournament':
            aValue = a.most_recent_tournament.toLowerCase()
            bValue = b.most_recent_tournament.toLowerCase()
            break
          case 'games_played_at_tournament':
            aValue = a.games_played_at_tournament
            bValue = b.games_played_at_tournament
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
    } else {
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
  }

  const handleBack = () => {
    navigate('/')
  }

  const handleShare = async () => {
    if (!league) return
    
    const shareLink = `${getBaseUrl()}/#/join?code=${league.code}`
    await copyToClipboard(shareLink)
    alert('Share link copied to clipboard!')
  }

  const loadRoster = async () => {
    if (!leagueId) return

    try {
      setLoadingRoster(true)
      setRosterError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRosterError('You must be logged in to view your roster')
        return
      }

      const { data, error } = await supabase
        .from('roster_players')
        .select('*')
        .eq('league_id', leagueId)
        .eq('user_id', user.id)

      if (error) throw error

      if (data) {
        // Enrich roster with prices from salaryCapStats
        const enrichedRoster = data.map(rosterPlayer => {
          const key = `${rosterPlayer.player_name}|${rosterPlayer.player_team}`
          const playerStats = salaryCapStats.find(p => `${p.player_name}|${p.player_team}` === key)
          return {
            id: rosterPlayer.id,
            player_name: rosterPlayer.player_name,
            player_team: rosterPlayer.player_team,
            position: rosterPlayer.position as RosterPosition,
            price: playerStats?.price || 0,
          }
        })
        setRoster(enrichedRoster)
      } else {
        setRoster([])
      }
    } catch (err: any) {
      console.error('Error loading roster:', err)
      setRosterError(err.message || 'Failed to load roster')
    } finally {
      setLoadingRoster(false)
    }
  }

  const addPlayerToRoster = async (player: SalaryCapPlayerStats, position: RosterPosition) => {
    if (!leagueId) return

    try {
      setRosterError(null)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRosterError('You must be logged in to manage your roster')
        return
      }

      // Check if player is already in roster
      const existingPlayer = roster.find(
        p => p.player_name === player.player_name && p.player_team === player.player_team
      )
      if (existingPlayer) {
        setRosterError('Player is already in your roster')
        return
      }

      // Check position limits
      const positionCounts = {
        captain: roster.filter(p => p.position === 'captain').length,
        handler: roster.filter(p => p.position === 'handler').length,
        cutter: roster.filter(p => p.position === 'cutter').length,
        defender: roster.filter(p => p.position === 'defender').length,
      }

      if (position === 'captain' && positionCounts.captain >= SALARY_CAP_ROSTER.captain) {
        setRosterError(`You can only have ${SALARY_CAP_ROSTER.captain} captain`)
        return
      }
      if (position === 'handler' && positionCounts.handler >= SALARY_CAP_ROSTER.handler) {
        setRosterError(`You can only have ${SALARY_CAP_ROSTER.handler} handlers`)
        return
      }
      if (position === 'cutter' && positionCounts.cutter >= SALARY_CAP_ROSTER.cutter) {
        setRosterError(`You can only have ${SALARY_CAP_ROSTER.cutter} cutters`)
        return
      }
      if (position === 'defender' && positionCounts.defender >= SALARY_CAP_ROSTER.defender) {
        setRosterError(`You can only have ${SALARY_CAP_ROSTER.defender} defenders`)
        return
      }

      // Check budget
      const newRoster = [...roster, { 
        id: '', 
        player_name: player.player_name, 
        player_team: player.player_team, 
        position, 
        price: player.price 
      }]
      const validation = validateRoster(newRoster.map(p => ({ position: p.position, price: p.price })))
      if (!validation.isValid) {
        setRosterError(validation.error || 'Cannot add player')
        return
      }

      // Add to database
      const { error } = await supabase
        .from('roster_players')
        .insert({
          league_id: leagueId,
          user_id: user.id,
          player_name: player.player_name,
          player_team: player.player_team,
          position,
        })

      if (error) throw error

      // Reload roster
      await loadRoster()
    } catch (err: any) {
      console.error('Error adding player to roster:', err)
      setRosterError(err.message || 'Failed to add player to roster')
    }
  }

  const removePlayerFromRoster = async (rosterPlayerId: string) => {
    try {
      setRosterError(null)

      const { error } = await supabase
        .from('roster_players')
        .delete()
        .eq('id', rosterPlayerId)

      if (error) throw error

      // Reload roster
      await loadRoster()
    } catch (err: any) {
      console.error('Error removing player from roster:', err)
      setRosterError(err.message || 'Failed to remove player from roster')
    }
  }

  const getPositionCounts = () => {
    return {
      captain: roster.filter(p => p.position === 'captain').length,
      handler: roster.filter(p => p.position === 'handler').length,
      cutter: roster.filter(p => p.position === 'cutter').length,
      defender: roster.filter(p => p.position === 'defender').length,
    }
  }

  const getRemainingBudget = () => {
    return calculateRemainingBudget(roster.map(p => ({ price: p.price })))
  }

  const getRosterSlots = () => {
    const slots: Array<{ position: RosterPosition; player: RosterPlayer | null }> = []
    
    // Captain slot
    const captainPlayer = roster.find(p => p.position === 'captain')
    slots.push({ position: 'captain', player: captainPlayer || null })
    
    // Handler slots (2)
    const handlers = roster.filter(p => p.position === 'handler')
    slots.push({ position: 'handler', player: handlers[0] || null })
    slots.push({ position: 'handler', player: handlers[1] || null })
    
    // Cutter slots (2)
    const cutters = roster.filter(p => p.position === 'cutter')
    slots.push({ position: 'cutter', player: cutters[0] || null })
    slots.push({ position: 'cutter', player: cutters[1] || null })
    
    // Defender slots (2)
    const defenders = roster.filter(p => p.position === 'defender')
    slots.push({ position: 'defender', player: defenders[0] || null })
    slots.push({ position: 'defender', player: defenders[1] || null })
    
    return slots
  }

  const handlePositionSelect = (position: RosterPosition) => {
    if (selectedPlayer) {
      addPlayerToRoster(selectedPlayer, position)
      setShowPositionModal(false)
      setSelectedPlayer(null)
    }
  }

  const openPositionModal = (player: SalaryCapPlayerStats) => {
    setSelectedPlayer(player)
    setShowPositionModal(true)
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
              {league.type === LEAGUE_TYPES.SALARY_CAP ? (
                <>
                  {loadingRoster ? (
                    <div className="loading-text">Loading roster...</div>
                  ) : (
                    <>
                      {/* Budget Display */}
                      <div className="roster-budget-section">
                        <div className="budget-info">
                          <span className="budget-label">Budget:</span>
                          <span className={`budget-amount ${getRemainingBudget() < 0 ? 'over-budget' : ''}`}>
                            ${getRemainingBudget()} / ${SALARY_CAP_BUDGET}
                          </span>
                        </div>
                        <div className="roster-structure-info">
                          <span>Roster: {roster.length} / 7 players</span>
                        </div>
                      </div>

                      {rosterError && (
                        <div className="error-message">{rosterError}</div>
                      )}

                      {/* Roster Table */}
                      <div className="roster-table-container">
                        <table className="roster-table">
                          <thead>
                            <tr>
                              <th>Position</th>
                              <th>Name</th>
                              <th>Cost</th>
                              <th>Score</th>
                              <th>Goals</th>
                              <th>Assists</th>
                              <th>Blocks</th>
                              <th>Turnovers</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getRosterSlots().map((slot, index) => (
                              <tr key={`${slot.position}-${index}`} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
                                <td className="position-cell">{slot.position}</td>
                                <td className="player-name-cell">
                                  {slot.player ? (
                                    <>
                                      <div 
                                        className="player-name clickable-player-name"
                                        onClick={() => navigate(`/player/${leagueId}/${encodeURIComponent(slot.player!.player_name)}`)}
                                        style={{ cursor: 'pointer' }}
                                      >
                                        {slot.player.player_name}
                                      </div>
                                      <div className="player-team">{slot.player.player_team}</div>
                                    </>
                                  ) : (
                                    <span className="empty-slot">—</span>
                                  )}
                                </td>
                                <td className="score-cell">
                                  {slot.player ? `$${Math.round(slot.player.price)}` : '—'}
                                </td>
                                <td className="score-cell">—</td>
                                <td>0</td>
                                <td>0</td>
                                <td>0</td>
                                <td>0</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="info-message">
                  Roster management is only available for salary cap leagues.
                </div>
              )}
            </div>
          )}

          {activeTab === 'players' && (
            <div className="players-tab-content">
              {loadingStats ? (
                <div className="loading-text">Loading player stats...</div>
              ) : league.type === LEAGUE_TYPES.DRAFT ? (
                playerStats.length === 0 ? (
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
                        {(getSortedStats() as AggregatedPlayerStats[]).map((player, index) => (
                          <tr 
                            key={`${player.player_name}-${player.player_team}-${index}`}
                            className={index % 2 === 0 ? 'row-even' : 'row-odd'}
                          >
                            <td className="player-name-cell">
                              <div 
                                className="player-name clickable-player-name"
                                onClick={() => navigate(`/player/${leagueId}/${encodeURIComponent(player.player_name)}`)}
                                style={{ cursor: 'pointer' }}
                              >
                                {player.player_name}
                              </div>
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
                )
              ) : league.type === LEAGUE_TYPES.SALARY_CAP ? (
                salaryCapStats.length === 0 ? (
                  <div className="no-data-text">No player stats available.</div>
                ) : (
                  <>
                    {/* Score Calculation Info */}
                    <div className="score-calculation-info">
                      <h3>Score Calculations</h3>
                      <ul>
                        <li><strong>Captain Score:</strong> 3 × assists + 3 × goals + 9 × defensive stops - 3 × turnovers (where turnovers = drops + throwaways)</li>
                        <li><strong>Handler Score:</strong> 3 × assists + 1 × goals + 3 × defensive stops - 1 × turnovers</li>
                        <li><strong>Cutter Score:</strong> 1 × assists + 3 × goals + 3 × defensive stops - 1 × turnovers</li>
                        <li><strong>Defender Score:</strong> 1 × assists + 1 × goals + 9 × defensive stops - 1 × turnovers</li>
                      </ul>
                    </div>
                    <div className="players-table-container">
                      <table className="players-table">
                      <thead>
                        <tr>
                          <th></th>
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
                            onClick={() => handleSort('price')}
                            title="Price"
                          >
                            Price
                            {sortColumn === 'price' && (
                              <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                            )}
                          </th>
                          <th 
                            className="sortable-header"
                            onClick={() => handleSort('captain_score')}
                            title="Captain Score"
                          >
                            Captain
                            {sortColumn === 'captain_score' && (
                              <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                            )}
                          </th>
                          <th 
                            className="sortable-header"
                            onClick={() => handleSort('handler_score')}
                            title="Handler Score"
                          >
                            Handler
                            {sortColumn === 'handler_score' && (
                              <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                            )}
                          </th>
                          <th 
                            className="sortable-header"
                            onClick={() => handleSort('cutter_score')}
                            title="Cutter Score"
                          >
                            Cutter
                            {sortColumn === 'cutter_score' && (
                              <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                            )}
                          </th>
                          <th 
                            className="sortable-header"
                            onClick={() => handleSort('defender_score')}
                            title="Defender Score"
                          >
                            Defender
                            {sortColumn === 'defender_score' && (
                              <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                            )}
                          </th>
                          <th 
                            className="sortable-header"
                            onClick={() => handleSort('most_recent_tournament')}
                            title="Most Recent Tournament"
                          >
                            Tournament
                            {sortColumn === 'most_recent_tournament' && (
                              <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                            )}
                          </th>
                          <th 
                            className="sortable-header"
                            onClick={() => handleSort('games_played_at_tournament')}
                            title="Games Played at Tournament"
                          >
                            GP
                            {sortColumn === 'games_played_at_tournament' && (
                              <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                            )}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(getSortedStats() as SalaryCapPlayerStats[]).map((player, index) => {
                          const isInRoster = roster.some(
                            r => r.player_name === player.player_name && r.player_team === player.player_team
                          )
                          const rosterPlayer = roster.find(
                            r => r.player_name === player.player_name && r.player_team === player.player_team
                          )
                          
                          const handleAddRemoveClick = () => {
                            if (isInRoster && rosterPlayer) {
                              removePlayerFromRoster(rosterPlayer.id)
                            } else {
                              openPositionModal(player)
                            }
                          }
                          
                          return (
                            <tr 
                              key={`${player.player_name}-${player.player_team}-${index}`}
                              className={index % 2 === 0 ? 'row-even' : 'row-odd'}
                            >
                              <td>
                                <button
                                  className={`roster-toggle-button ${isInRoster ? 'remove' : 'add'}`}
                                  onClick={handleAddRemoveClick}
                                  title={isInRoster ? 'Remove from roster' : 'Add to roster'}
                                >
                                  {isInRoster ? '−' : '+'}
                                </button>
                              </td>
                              <td className="player-name-cell">
                                <div 
                                  className="player-name clickable-player-name"
                                  onClick={() => navigate(`/player/${leagueId}/${encodeURIComponent(player.player_name)}`)}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {player.player_name}
                                </div>
                                <div className="player-team">{player.player_team}</div>
                              </td>
                              <td className="score-cell">${Math.round(player.price)}</td>
                              <td className="score-cell">{player.captain_score.toFixed(1)}</td>
                              <td>{player.handler_score.toFixed(1)}</td>
                              <td>{player.cutter_score.toFixed(1)}</td>
                              <td>{player.defender_score.toFixed(1)}</td>
                              <td>{player.most_recent_tournament}</td>
                              <td>{player.games_played_at_tournament}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>
                )
              ) : null}
            </div>
          )}
        </div>
      </main>

      {/* Position Selection Modal */}
      {showPositionModal && selectedPlayer && (
        <div className="modal-overlay" onClick={() => { setShowPositionModal(false); setSelectedPlayer(null) }}>
          <div className="modal-content position-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-button" onClick={() => { setShowPositionModal(false); setSelectedPlayer(null) }}>×</button>
            <h2 className="modal-title">Select Position for {selectedPlayer.player_name}</h2>
            <div className="position-selection-grid">
              {getRosterSlots().map((slot, index) => {
                const positionCounts = getPositionCounts()
                const isAvailable = slot.player === null
                const positionLabel = slot.position.charAt(0).toUpperCase() + slot.position.slice(1)
                const maxForPosition = slot.position === 'captain' ? SALARY_CAP_ROSTER.captain :
                                     slot.position === 'handler' ? SALARY_CAP_ROSTER.handler :
                                     slot.position === 'cutter' ? SALARY_CAP_ROSTER.cutter :
                                     SALARY_CAP_ROSTER.defender
                const currentCount = positionCounts[slot.position]
                const canAdd = currentCount < maxForPosition
                
                return (
                  <div
                    key={`${slot.position}-${index}`}
                    className={`position-slot ${isAvailable && canAdd ? 'available' : 'occupied'}`}
                    onClick={() => {
                      if (isAvailable && canAdd) {
                        handlePositionSelect(slot.position)
                      }
                    }}
                  >
                    <div className="position-slot-header">
                      <span className="position-label">{positionLabel}</span>
                      {slot.player && (
                        <span className="occupied-badge">Occupied</span>
                      )}
                    </div>
                    {slot.player ? (
                      <div className="position-slot-player">
                        <div className="player-name-small">{slot.player.player_name}</div>
                        <div className="player-team-small">{slot.player.player_team}</div>
                      </div>
                    ) : (
                      <div className="position-slot-empty">
                        {canAdd ? 'Click to add' : 'Full'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

